import { calculateConfirmedCraftingDeltas } from '../../utils/craftingInventoryTransaction';
import { compareCraftingSessionSource } from '../../utils/craftingSession';
import { partializeStore } from '../persistence';

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

  setInventory: (materialName, qty) =>
    set((state) => ({
      inventory: { ...state.inventory, [materialName]: Math.max(0, qty) },
    })),

  incrementInventory: (materialName, amount = 1) =>
    set((state) => ({
      inventory: {
        ...state.inventory,
        [materialName]: (state.inventory[materialName] || 0) + amount,
      },
    })),

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

    if (session.sessionId !== preparedTransaction.sessionId) {
      return {
        success: false,
        status: 'rejected',
        code: 'SESSION_ID_MISMATCH',
        message: `Session ID "${session.sessionId}" does not match transaction "${preparedTransaction.sessionId}".`,
      };
    }

    if (session.snapshot.familyId !== preparedTransaction.familyId) {
      return {
        success: false,
        status: 'rejected',
        code: 'FAMILY_ID_MISMATCH',
        message: `Family ID "${session.snapshot.familyId}" does not match transaction "${preparedTransaction.familyId}".`,
      };
    }

    if (session.snapshot.fingerprint !== preparedTransaction.sourceFingerprint) {
      return {
        success: false,
        status: 'rejected',
        code: 'SOURCE_FINGERPRINT_MISMATCH',
        message: 'Source fingerprint does not match transaction.',
      };
    }

    // 3. Revalidate entire confirmed event ledger from scratch
    const deltasResult = calculateConfirmedCraftingDeltas(session);
    if (!deltasResult.isValid) {
      const err = deltasResult.errors[0];
      return {
        success: false,
        status: 'rejected',
        code: err?.code || 'LEDGER_INTEGRITY_MISMATCH',
        message: err?.message || 'Event ledger failed canonical revalidation.',
      };
    }

    // Recheck deltas against transaction
    for (const [tierId, delta] of Object.entries(preparedTransaction.deltas || {})) {
      if (tierId === 'Mora') {
        if (deltasResult.moraDelta.delta !== delta) {
          return {
            success: false,
            status: 'rejected',
            code: 'DELTA_MISMATCH',
            message: 'Mora delta does not match canonical revalidation.',
          };
        }
      } else {
        if (deltasResult.materialDeltas[tierId] !== delta) {
          return {
            success: false,
            status: 'rejected',
            code: 'DELTA_MISMATCH',
            message: `Material delta for ${tierId} does not match canonical revalidation.`,
          };
        }
      }
    }

    // 4. Duplicate submission check (in-memory)
    const appliedList = get().appliedCraftingTransactions || [];
    if (appliedList.includes(preparedTransaction.transactionId)) {
      return {
        success: false,
        status: 'rejected',
        code: 'DUPLICATE_TRANSACTION',
        message: 'This crafting transaction has already been applied.',
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
        if ((state.appliedCraftingTransactions || []).includes(preparedTransaction.transactionId)) {
          rejection = {
            code: 'DUPLICATE_TRANSACTION',
            message: 'This crafting transaction has already been applied.',
          };
          return state;
        }

        // B. Strict starting balances exact-match check against live state
        for (const [tierId, expectedStart] of Object.entries(preparedTransaction.startingBalances || {})) {
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
        const liveSource = {
          inventory: state.inventory,
          grossRequirements: state.goals || {},
          mora: state.inventory?.['Mora'],
        };
        const comparison = compareCraftingSessionSource(
          session.snapshot,
          liveSource,
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
        for (const [tierId, delta] of Object.entries(preparedTransaction.deltas || {})) {
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
        for (const [tierId, expectedEnd] of Object.entries(preparedTransaction.endingBalances || {})) {
          if (draftInventory[tierId] !== expectedEnd) {
            rejection = {
              code: 'ENDING_BALANCE_MISMATCH',
              message: `Resulting balance for ${tierId} (${draftInventory[tierId]}) does not match expected ending balance (${expectedEnd}).`,
            };
            return state;
          }
        }

        nextInventory = draftInventory;
        updatedAppliedList = [...(state.appliedCraftingTransactions || []), preparedTransaction.transactionId];

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
      return {
        success: false,
        status: 'uncertain',
        code: 'PERSISTENCE_FAILURE',
        message: `Inventory was applied in memory, but persistent storage failed: ${persistenceErrorMessage}`,
        transactionId: preparedTransaction.transactionId,
      };
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
