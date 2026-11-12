import {
  prepareCraftingInventoryTransaction,
  validateCraftingInventoryTransaction,
} from '../../utils/craftingInventoryTransaction';
import { compareCraftingSessionSource } from '../../utils/craftingSession';
import { calculateAuthoritativeGrossRequirements } from '../../utils/aggregator';
import { partializeStore } from '../persistence';
import { recordActivity, VALID_SOURCES } from '../../activity';

/**
 * Checks equality of two inventory records, treating missing keys and 0 as equivalent.
 */
function areInventoriesEqual(diskInv, memInv) {
  if (diskInv === memInv) return true;
  const d = diskInv || {};
  const m = memInv || {};
  const allKeys = new Set([...Object.keys(d), ...Object.keys(m)]);
  for (const k of allKeys) {
    const dVal = d[k] ?? 0;
    const mVal = m[k] ?? 0;
    if (dVal !== mVal) return false;
  }
  return true;
}

/**
 * Pure deep equality comparison for JSON-compatible structures in persisted state.
 */
function isDeepEqual(a, b) {
  if (a === b) return true;
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

export const createInventorySlice = (set, get) => ({
  inventory: {},
  appliedCraftingTransactions: [],

  setInventory: (materialName, qty, source = 'system') => {
    if (typeof materialName !== 'string' || !materialName.trim()) {
      return;
    }
    const num = Number(qty);
    if (!Number.isFinite(num) || isNaN(num)) {
      return;
    }
    const nextQty = Math.max(0, Math.floor(num));

    const currentInventory = get().inventory || {};
    const hasExistingKey = Object.prototype.hasOwnProperty.call(
      currentInventory,
      materialName
    );
    const prevQty = currentInventory[materialName] ?? 0;

    // Suppress no-op if the key already exists and has the exact same quantity
    if (hasExistingKey && prevQty === nextQty) {
      return;
    }

    // 1. Commit domain mutation atomically
    set((state) => ({
      inventory: { ...state.inventory, [materialName]: nextQty },
    }));

    // Suppress logging if effective quantity did not change (e.g. missing key initialized to 0)
    if (prevQty === nextQty) {
      return;
    }

    // 2. Activity logging (strictly outside state updater)
    try {
      const validSource =
        typeof source === 'string' && VALID_SOURCES.has(source)
          ? source
          : 'system';
      const deltaVal = nextQty - prevQty;
      const deltaStr =
        deltaVal > 0 ? `+${deltaVal.toLocaleString()}` : deltaVal.toLocaleString();
      const action =
        validSource === 'inventory_stepper'
          ? deltaVal > 0
            ? 'inventory_incremented'
            : 'inventory_decremented'
          : 'inventory_updated';

      recordActivity({
        category: 'inventory',
        action,
        source: validSource,
        entityType: 'material',
        entityId: materialName,
        entityName: materialName,
        summary: `${materialName} changed from ${prevQty.toLocaleString()} to ${nextQty.toLocaleString()}.`,
        changes: [
          {
            field: 'quantity',
            before: prevQty,
            after: nextQty,
            delta: deltaStr,
          },
        ],
        metadata: {
          materialKey: materialName,
        },
      });
    } catch (logErr) {
      console.error('[Inventory] Failed to log activity event:', logErr);
    }
  },

  incrementInventory: (materialName, amount = 1, source = 'system') => {
    if (typeof materialName !== 'string' || !materialName.trim()) {
      return;
    }
    const deltaNum = Number(amount);
    if (!Number.isFinite(deltaNum) || isNaN(deltaNum) || deltaNum === 0) {
      return;
    }

    const currentInventory = get().inventory || {};
    const hasExistingKey = Object.prototype.hasOwnProperty.call(
      currentInventory,
      materialName
    );
    const prevQty = currentInventory[materialName] ?? 0;
    const nextQty = Math.max(0, Math.floor(prevQty + deltaNum));

    // Suppress no-op (e.g. decrementing already-zero quantity to zero when key already exists)
    if (hasExistingKey && prevQty === nextQty) {
      return;
    }

    // 1. Commit domain mutation atomically
    set((state) => ({
      inventory: {
        ...state.inventory,
        [materialName]: nextQty,
      },
    }));

    // Suppress logging if effective quantity did not change (e.g. decrementing missing key from 0 to 0)
    if (prevQty === nextQty) {
      return;
    }

    // 2. Activity logging (strictly outside state updater)
    try {
      const validSource =
        typeof source === 'string' && VALID_SOURCES.has(source)
          ? source
          : 'system';
      const effectiveDelta = nextQty - prevQty;
      const deltaStr =
        effectiveDelta > 0
          ? `+${effectiveDelta.toLocaleString()}`
          : effectiveDelta.toLocaleString();
      const action =
        effectiveDelta > 0 ? 'inventory_incremented' : 'inventory_decremented';

      recordActivity({
        category: 'inventory',
        action,
        source: validSource,
        entityType: 'material',
        entityId: materialName,
        entityName: materialName,
        summary: `${materialName} changed from ${prevQty.toLocaleString()} to ${nextQty.toLocaleString()}.`,
        changes: [
          {
            field: 'quantity',
            before: prevQty,
            after: nextQty,
            delta: deltaStr,
          },
        ],
        metadata: {
          materialKey: materialName,
        },
      });
    } catch (logErr) {
      console.error('[Inventory] Failed to log activity event:', logErr);
    }
  },

  /**
   * Applies an authorized, confirmed crafting inventory transaction to persistent inventory.
   *
   * Executes inside a single atomic Zustand set() state transition:
   * 1. Revalidates transaction structure and identity.
   * 2. Re-evaluates complete confirmed event ledger against canonical database.
   * 3. Verifies current saved inventory and Mora exact-match starting snapshot.
   * 4. Enforces duplicate submission protection.
   * 5. Checks cross-tab storage consistency.
   * 6. Applies all material deltas and Mora changes atomically.
   * 7. Verifies storage persistence outcome (distinguishing applied vs rejected vs uncertain).
   *
   * @param {object} preparedTransaction - Prepared CraftingInventoryTransaction from C2-A
   * @param {object} expectedSessionContext - Active CraftingSessionState or { session }
   * @returns {import('../../utils/craftingInventoryTransaction').ApplyCraftingTransactionResult}
   */
  applyCraftingTransaction: (preparedTransaction, expectedSessionContext) => {
    // 1. Transaction parameter sanity
    if (!preparedTransaction || typeof preparedTransaction !== 'object') {
      return {
        success: false,
        status: 'rejected',
        code: 'INVALID_TRANSACTION',
        message: 'Transaction object is missing or malformed.',
      };
    }

    if (!preparedTransaction.transactionId || typeof preparedTransaction.transactionId !== 'string') {
      return {
        success: false,
        status: 'rejected',
        code: 'INVALID_TRANSACTION_ID',
        message: 'Transaction ID is missing or invalid.',
      };
    }

    if (preparedTransaction.status !== 'valid') {
      return {
        success: false,
        status: 'rejected',
        code: 'INVALID_TRANSACTION_STATUS',
        message: 'Cannot apply transaction with invalid status.',
      };
    }

    // 2. Session context parameter sanity
    if (!expectedSessionContext) {
      return {
        success: false,
        status: 'rejected',
        code: 'MISSING_SESSION_CONTEXT',
        message: 'Session context is required to apply transaction.',
      };
    }

    const session = expectedSessionContext.session || expectedSessionContext;
    if (!session || !session.sessionId || !session.snapshot || !session.events) {
      return {
        success: false,
        status: 'rejected',
        code: 'INVALID_SESSION_CONTEXT',
        message: 'Session context is incomplete or malformed.',
      };
    }

    // 3. Duplicate submission check (in-memory)
    const appliedList = get().appliedCraftingTransactions || [];
    if (appliedList.includes(preparedTransaction.transactionId)) {
      return {
        success: false,
        status: 'rejected',
        code: 'DUPLICATE_TRANSACTION',
        message: 'This crafting transaction has already been applied.',
      };
    }

    // 4. Starting balances exact-match check against live state
    const currentStore = get();
    for (const [tierId, expectedStart] of Object.entries(preparedTransaction.startingBalances || {})) {
      const currentVal = tierId === 'Mora' ? (currentStore.inventory?.['Mora'] ?? 0) : (currentStore.inventory?.[tierId] ?? 0);
      if (currentVal !== expectedStart) {
        return {
          success: false,
          status: 'rejected',
          code: 'SOURCE_CONFLICT',
          message: `Current balance for ${tierId} (${currentVal}) does not match transaction starting balance (${expectedStart}).`,
        };
      }
    }

    // 5. Construct live authoritative source at execution time
    const liveSource = {
      inventory: currentStore.inventory || {},
      grossRequirements: calculateAuthoritativeGrossRequirements(currentStore),
      mora: currentStore.inventory?.['Mora'] ?? 0,
    };

    // 6. Independently calculate the canonical expected transaction from session & live source
    const canonicalPrep = prepareCraftingInventoryTransaction(session, liveSource);
    if (!canonicalPrep.isPrepared || !canonicalPrep.transaction) {
      const err = canonicalPrep.errors[0];
      return {
        success: false,
        status: 'rejected',
        code: err?.code || 'TRANSACTION_PREPARATION_FAILED',
        message: err?.message || 'Cannot prepare canonical transaction from current state.',
      };
    }

    const canonicalTx = canonicalPrep.transaction;

    // 7. Strict completeness & equivalence validation between submitted and canonical transactions

    // 7.1 Session identity
    if (preparedTransaction.sessionId !== canonicalTx.sessionId) {
      return {
        success: false,
        status: 'rejected',
        code: 'SESSION_ID_MISMATCH',
        message: `Session ID "${preparedTransaction.sessionId}" does not match canonical session "${canonicalTx.sessionId}".`,
      };
    }

    // 7.2 Material family
    if (preparedTransaction.familyId !== canonicalTx.familyId) {
      return {
        success: false,
        status: 'rejected',
        code: 'FAMILY_ID_MISMATCH',
        message: `Family ID "${preparedTransaction.familyId}" does not match canonical family "${canonicalTx.familyId}".`,
      };
    }

    // 7.3 Transaction identity (do not trust caller-supplied ID as proof of validity)
    if (preparedTransaction.transactionId !== canonicalTx.transactionId) {
      return {
        success: false,
        status: 'rejected',
        code: 'TRANSACTION_ID_MISMATCH',
        message: `Transaction ID "${preparedTransaction.transactionId}" does not match canonical transaction "${canonicalTx.transactionId}".`,
      };
    }

    // 7.4 Event identity and ledger revision
    if (preparedTransaction.ledgerFingerprint !== canonicalTx.ledgerFingerprint) {
      return {
        success: false,
        status: 'rejected',
        code: 'LEDGER_FINGERPRINT_MISMATCH',
        message: 'Transaction ledger fingerprint does not match canonical ledger revision.',
      };
    }

    if (
      !Array.isArray(preparedTransaction.eventIds) ||
      preparedTransaction.eventIds.length !== canonicalTx.eventIds.length ||
      preparedTransaction.eventIds.some((id, idx) => id !== canonicalTx.eventIds[idx])
    ) {
      return {
        success: false,
        status: 'rejected',
        code: 'EVENT_IDS_MISMATCH',
        message: 'Transaction event IDs do not match canonical event ledger.',
      };
    }

    // 7.5 Source fingerprint
    if (preparedTransaction.sourceFingerprint !== canonicalTx.sourceFingerprint) {
      return {
        success: false,
        status: 'rejected',
        code: 'SOURCE_FINGERPRINT_MISMATCH',
        message: 'Source fingerprint does not match canonical source fingerprint.',
      };
    }

    // 7.6 Operations, batches, and Mora spent counts
    if (preparedTransaction.totalOperations !== canonicalTx.totalOperations) {
      return {
        success: false,
        status: 'rejected',
        code: 'OPERATIONS_MISMATCH',
        message: `Submitted operations (${preparedTransaction.totalOperations}) does not match canonical operations (${canonicalTx.totalOperations}).`,
      };
    }

    if (preparedTransaction.totalBatches !== canonicalTx.totalBatches) {
      return {
        success: false,
        status: 'rejected',
        code: 'BATCHES_MISMATCH',
        message: `Submitted batches (${preparedTransaction.totalBatches}) does not match canonical batches (${canonicalTx.totalBatches}).`,
      };
    }

    if (preparedTransaction.totalMoraSpent !== canonicalTx.totalMoraSpent) {
      return {
        success: false,
        status: 'rejected',
        code: 'MORA_SPENT_MISMATCH',
        message: `Submitted Mora spent (${preparedTransaction.totalMoraSpent}) does not match canonical Mora spent (${canonicalTx.totalMoraSpent}).`,
      };
    }

    // 7.7 Complete set of delta keys and values, including Mora
    const submittedDeltaKeys = Object.keys(preparedTransaction.deltas || {}).sort();
    const canonicalDeltaKeys = Object.keys(canonicalTx.deltas || {}).sort();

    if (
      submittedDeltaKeys.length !== canonicalDeltaKeys.length ||
      submittedDeltaKeys.some((k, idx) => k !== canonicalDeltaKeys[idx])
    ) {
      return {
        success: false,
        status: 'rejected',
        code: 'DELTA_MISMATCH',
        message: 'Submitted delta keys do not match canonical expected deltas.',
      };
    }

    for (const key of canonicalDeltaKeys) {
      if (preparedTransaction.deltas[key] !== canonicalTx.deltas[key]) {
        return {
          success: false,
          status: 'rejected',
          code: 'DELTA_MISMATCH',
          message: `Submitted delta for ${key} (${preparedTransaction.deltas[key]}) does not match canonical delta (${canonicalTx.deltas[key]}).`,
        };
      }
    }

    // 7.8 Complete set of starting balances
    const submittedStartKeys = Object.keys(preparedTransaction.startingBalances || {}).sort();
    const canonicalStartKeys = Object.keys(canonicalTx.startingBalances || {}).sort();

    if (
      submittedStartKeys.length !== canonicalStartKeys.length ||
      submittedStartKeys.some((k, idx) => k !== canonicalStartKeys[idx])
    ) {
      return {
        success: false,
        status: 'rejected',
        code: 'STARTING_BALANCES_MISMATCH',
        message: 'Submitted starting balance keys do not match canonical starting balances.',
      };
    }

    for (const key of canonicalStartKeys) {
      if (preparedTransaction.startingBalances[key] !== canonicalTx.startingBalances[key]) {
        return {
          success: false,
          status: 'rejected',
          code: 'STARTING_BALANCES_MISMATCH',
          message: `Submitted starting balance for ${key} does not match canonical starting balance.`,
        };
      }
    }

    // 7.9 Complete set of ending balances
    const submittedEndKeys = Object.keys(preparedTransaction.endingBalances || {}).sort();
    const canonicalEndKeys = Object.keys(canonicalTx.endingBalances || {}).sort();

    if (
      submittedEndKeys.length !== canonicalEndKeys.length ||
      submittedEndKeys.some((k, idx) => k !== canonicalEndKeys[idx])
    ) {
      return {
        success: false,
        status: 'rejected',
        code: 'ENDING_BALANCE_MISMATCH',
        message: 'Submitted ending balance keys do not match canonical ending balances.',
      };
    }

    for (const key of canonicalEndKeys) {
      if (preparedTransaction.endingBalances[key] !== canonicalTx.endingBalances[key]) {
        return {
          success: false,
          status: 'rejected',
          code: 'ENDING_BALANCE_MISMATCH',
          message: `Submitted ending balance for ${key} (${preparedTransaction.endingBalances[key]}) does not match canonical ending balance (${canonicalTx.endingBalances[key]}).`,
        };
      }
    }

    // 7.10 Validate canonical transaction against live source
    const validation = validateCraftingInventoryTransaction(canonicalTx, liveSource);
    if (!validation.isValid) {
      const err = validation.errors[0];
      return {
        success: false,
        status: 'rejected',
        code: err?.code || 'INVALID_TRANSACTION',
        message: err?.message || 'Canonical transaction failed live validation.',
      };
    }

    // 5. Cross-tab persistent storage consistency preflight (Whole-state check)
    if (typeof window !== 'undefined' && window.localStorage) {
      let rawDisk;
      try {
        rawDisk = window.localStorage.getItem('travelers-toolkit-store');
      } catch (readErr) {
        return {
          success: false,
          status: 'rejected',
          code: 'STORAGE_READ_ERROR',
          message: `Failed to read persistent storage: ${readErr?.message || 'Storage inaccessible'}`,
        };
      }

      if (rawDisk) {
        let diskParsed;
        try {
          diskParsed = JSON.parse(rawDisk);
        } catch (_jsonErr) {
          return {
            success: false,
            status: 'rejected',
            code: 'STORAGE_CORRUPTED',
            message: 'Persistent storage contains corrupted data.',
          };
        }

        const diskState = diskParsed?.state || {};
        const memPersisted = JSON.parse(JSON.stringify(partializeStore(get())));

        // 5.1 Check entire inventory (material family, Mora, and unrelated items)
        if (!areInventoriesEqual(diskState.inventory, memPersisted.inventory)) {
          return {
            success: false,
            status: 'rejected',
            code: 'STORAGE_SOURCE_MISMATCH',
            message: 'Persistent inventory has changed in another window. Please refresh.',
          };
        }

        // 5.2 Check all other persisted domain fields (roster, trackedWeapons, goals, etc.)
        for (const [key, memVal] of Object.entries(memPersisted)) {
          if (key === 'inventory') continue;
          const diskVal = diskState[key];
          if (!isDeepEqual(diskVal, memVal)) {
            return {
              success: false,
              status: 'rejected',
              code: 'STORAGE_SOURCE_MISMATCH',
              message: `Persistent ${key} has changed in another window. Please refresh.`,
            };
          }
        }
      }
    }

    // 6. Execute atomic state update inside set()
    let rejection = null;
    let nextInventory = null;
    let updatedAppliedList = null;

    let persistenceFailed = false;
    let persistenceErrorMessage = '';

    try {
      set((state) => {
        // A. In-lock duplicate check
        if ((state.appliedCraftingTransactions || []).includes(canonicalTx.transactionId)) {
          rejection = {
            code: 'DUPLICATE_TRANSACTION',
            message: 'This crafting transaction has already been applied.',
          };
          return state;
        }

        // B. Strict starting balances exact-match check against live state
        for (const [tierId, expectedStart] of Object.entries(canonicalTx.startingBalances || {})) {
          const currentVal = tierId === 'Mora' ? (state.inventory?.['Mora'] ?? 0) : (state.inventory?.[tierId] ?? 0);
          if (currentVal !== expectedStart) {
            rejection = {
              code: 'SOURCE_CONFLICT',
              message: `Current balance for ${tierId} (${currentVal}) does not match transaction starting balance (${expectedStart}).`,
            };
            return state;
          }
        }

        // C. Verify source freshness
        const inLockLiveSource = {
          inventory: state.inventory || {},
          grossRequirements: calculateAuthoritativeGrossRequirements(state),
          mora: state.inventory?.['Mora'] ?? 0,
        };
        const comparison = compareCraftingSessionSource(
          session.snapshot,
          inLockLiveSource,
          session.acknowledgedFingerprint
        );

        if (comparison.status === 'conflict_unreviewed') {
          rejection = {
            code: 'UNREVIEWED_SOURCE_CONFLICT',
            message: 'Live inventory or progression requirements have changed.',
          };
          return state;
        }

        if (comparison.status === 'conflict_continued' || session.acknowledgedFingerprint) {
          rejection = {
            code: 'CONTINUED_SOURCE_CONFLICT',
            message: 'Cannot apply crafting transaction from an acknowledged stale snapshot.',
          };
          return state;
        }

        if (!comparison.isFresh || comparison.hasConflict) {
          rejection = {
            code: 'SOURCE_CONFLICT',
            message: 'Live source has diverged from transaction starting snapshot.',
          };
          return state;
        }

        // D. Calculate next inventory and verify non-negative post-conditions
        const draftInventory = { ...state.inventory };
        for (const [tierId, delta] of Object.entries(canonicalTx.deltas || {})) {
          const current = draftInventory[tierId] ?? 0;
          const next = current + delta;
          if (next < 0) {
            rejection = {
              code: tierId === 'Mora' ? 'INSUFFICIENT_MORA' : 'INSUFFICIENT_INGREDIENTS',
              message: `Resulting balance for ${tierId} would be negative (${next}).`,
            };
            return state;
          }
          draftInventory[tierId] = next;
        }

        // E. Verify ending balances against expected ending balances
        for (const [tierId, expectedEnd] of Object.entries(canonicalTx.endingBalances || {})) {
          if (draftInventory[tierId] !== expectedEnd) {
            rejection = {
              code: 'ENDING_BALANCE_MISMATCH',
              message: `Resulting balance for ${tierId} (${draftInventory[tierId]}) does not match expected ending balance (${expectedEnd}).`,
            };
            return state;
          }
        }

        nextInventory = draftInventory;
        updatedAppliedList = [...(state.appliedCraftingTransactions || []), canonicalTx.transactionId];

        return {
          inventory: nextInventory,
          appliedCraftingTransactions: updatedAppliedList,
        };
      });
    } catch (err) {
      persistenceFailed = true;
      persistenceErrorMessage = err?.message || 'Storage write failed';
    }

    if (rejection) {
      return {
        success: false,
        status: 'rejected',
        code: rejection.code,
        message: rejection.message,
      };
    }

    // 7. Verify persistent storage outcome
    if (!persistenceFailed && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem('travelers-toolkit-store');
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const [tierId, expectedEnd] of Object.entries(preparedTransaction.endingBalances || {})) {
            const diskVal = tierId === 'Mora' ? parsed?.state?.inventory?.['Mora'] : parsed?.state?.inventory?.[tierId];
            if (diskVal !== expectedEnd) {
              persistenceFailed = true;
              persistenceErrorMessage = `Persisted storage balance for ${tierId} (${diskVal}) does not match expected (${expectedEnd}).`;
              break;
            }
          }
        }
      } catch (e) {
        persistenceFailed = true;
        persistenceErrorMessage = e?.message || 'Failed to verify persistence in storage.';
      }
    }

    if (persistenceFailed) {
      try {
        recordActivity({
          category: 'crafting',
          action: 'crafting_transaction_uncertain',
          source: 'crafting_results_modal',
          entityType: 'crafting_transaction',
          entityId: preparedTransaction.transactionId,
          transactionId: preparedTransaction.transactionId,
          summary: `Crafting transaction persistence could not be verified: ${persistenceErrorMessage}`,
          metadata: {
            transactionId: preparedTransaction.transactionId,
            reason: persistenceErrorMessage,
          },
        });
      } catch (logErr) {
        console.error('[Crafting] Failed to log diagnostic uncertain event:', logErr);
      }

      return {
        success: false,
        status: 'uncertain',
        code: 'PERSISTENCE_FAILURE',
        message: `Inventory was applied in memory, but persistent storage failed: ${persistenceErrorMessage}`,
        transactionId: preparedTransaction.transactionId,
      };
    }

    try {
      const bonusType = session?.snapshot?.bonusType || null;
      const changes = Object.entries(canonicalTx.deltas || {}).map(([key, delta]) => {
        const before = canonicalTx.startingBalances?.[key] ?? 0;
        const after = canonicalTx.endingBalances?.[key] ?? (before + delta);
        const deltaStr = delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
        return {
          field: key,
          before,
          after,
          delta: deltaStr,
        };
      });

      recordActivity({
        category: 'crafting',
        action: 'crafting_transaction_applied',
        source: 'crafting_results_modal',
        entityType: 'crafting_transaction',
        entityId: canonicalTx.transactionId,
        entityName: canonicalTx.familyName || canonicalTx.familyId,
        transactionId: canonicalTx.transactionId,
        summary: `Applied crafting transaction for ${canonicalTx.familyName || canonicalTx.familyId}: ${canonicalTx.totalBatches} batch${canonicalTx.totalBatches === 1 ? '' : 'es'} (${canonicalTx.totalOperations} operation${canonicalTx.totalOperations === 1 ? '' : 's'}).`,
        changes,
        metadata: {
          familyId: canonicalTx.familyId,
          familyName: canonicalTx.familyName || canonicalTx.familyId,
          totalBatches: canonicalTx.totalBatches,
          totalOperations: canonicalTx.totalOperations,
          totalMoraSpent: canonicalTx.totalMoraSpent,
          bonusType,
        },
      });
    } catch (logErr) {
      console.error('[Crafting] Failed to log crafting applied event:', logErr);
    }

    return {
      success: true,
      status: 'applied',
      transactionId: preparedTransaction.transactionId,
      appliedAt: Date.now(),
      updatedInventory: nextInventory,
      deltas: preparedTransaction.deltas,
    };
  },
});
