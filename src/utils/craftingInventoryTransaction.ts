import {
  CraftingFamily,
  getCraftingFamily,
} from '../data/craftingRecipes';
import { isBonusEligibleCategory } from '../data/craftingBonuses';
import {
  CraftingSessionState,
  CraftingResultEvent,
  LiveCraftingSource,
  compareCraftingSessionSource,
} from './craftingSession';

export interface TransactionDiagnostic {
  field: string;
  code: string;
  message: string;
}

export interface MaterialDelta {
  itemId: string;
  itemName: string;
  tierIndex: number;
  startingQuantity: number;
  delta: number;
  endingQuantity: number;
}

export interface MoraDelta {
  startingMora: number;
  delta: number;
  endingMora: number;
}

export interface ConfirmedCraftingDeltasResult {
  isValid: boolean;
  errors: TransactionDiagnostic[];
  materialDeltas: Record<string, number>;
  allMaterialDeltas: MaterialDelta[];
  activeMaterialDeltas: MaterialDelta[];
  moraDelta: MoraDelta;
  totalOperations: number;
  totalBatches: number;
  totalMoraSpent: number;
  replayedInventory: Record<string, number>;
  replayedMora: number;
}

export interface CraftingInventoryTransaction {
  transactionId: string;
  sessionId: string;
  familyId: string;
  familyName: string;
  eventIds: string[];
  ledgerFingerprint: string;
  sourceFingerprint: string;
  startingBalances: Record<string, number>;
  deltas: Record<string, number>;
  endingBalances: Record<string, number>;
  totalOperations: number;
  totalBatches: number;
  totalMoraSpent: number;
  createdAt: number;
  status: 'valid' | 'invalid';
  diagnostics: TransactionDiagnostic[];
}

export interface InventoryTransactionPreviewRow {
  itemId: string;
  itemName: string;
  tierIndex: number;
  savedNow: number;
  change: number;
  after: number;
}

export interface InventoryTransactionPreview {
  familyId: string;
  familyName: string;
  totalBatches: number;
  totalOperations: number;
  totalMoraSpent: number;
  materialChanges: InventoryTransactionPreviewRow[];
  allMaterialChanges: InventoryTransactionPreviewRow[];
  moraChange: {
    savedNow: number;
    change: number;
    after: number;
  };
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
}

export interface CraftingInventoryTransactionPreparationResult {
  isPrepared: boolean;
  transaction: CraftingInventoryTransaction | null;
  preview: InventoryTransactionPreview | null;
  errors: TransactionDiagnostic[];
}

export interface TransactionValidationResult {
  isValid: boolean;
  errors: TransactionDiagnostic[];
}

/**
 * Deterministic 32-bit FNV-1a string hash.
 */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Validates that a number is a non-negative, finite, safe integer.
 */
function isNonNegativeSafeInteger(n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isSafeInteger(n) &&
    n >= 0 &&
    !Number.isNaN(n) &&
    Number.isFinite(n)
  );
}

/**
 * Validates that a number is a finite, safe integer (can be positive, zero, or negative).
 */
function isSafeInteger(n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isSafeInteger(n) &&
    !Number.isNaN(n) &&
    Number.isFinite(n)
  );
}

/**
 * Pure, deterministic calculation and revalidation of confirmed crafting session deltas.
 *
 * Revalidates the entire chronological event ledger against canonical recipe definitions,
 * verifies stored derived fields against canonical re-evaluations, verifies intermediate
 * ingredient and Mora feasibility at each event, and cross-checks final replayed ending
 * balances against the session's stored shadow inventory.
 */
export function calculateConfirmedCraftingDeltas(
  session: CraftingSessionState
): ConfirmedCraftingDeltasResult {
  const errors: TransactionDiagnostic[] = [];

  const defaultMoraDelta: MoraDelta = {
    startingMora: session?.snapshot?.startingMora ?? 0,
    delta: 0,
    endingMora: session?.snapshot?.startingMora ?? 0,
  };

  const emptyResult: ConfirmedCraftingDeltasResult = {
    isValid: false,
    errors,
    materialDeltas: {},
    allMaterialDeltas: [],
    activeMaterialDeltas: [],
    moraDelta: defaultMoraDelta,
    totalOperations: 0,
    totalBatches: 0,
    totalMoraSpent: 0,
    replayedInventory: {},
    replayedMora: 0,
  };

  if (!session || !session.snapshot) {
    errors.push({
      field: 'session',
      code: 'NO_SESSION',
      message: 'No active crafting session provided.',
    });
    return emptyResult;
  }

  const { snapshot, events, ledger } = session;

  if (!events || events.length === 0) {
    errors.push({
      field: 'events',
      code: 'EMPTY_LEDGER',
      message: 'Cannot prepare inventory transaction: no crafting events have been recorded.',
    });
    return emptyResult;
  }

  const family = getCraftingFamily(snapshot.familyId);
  if (!family) {
    errors.push({
      field: 'familyId',
      code: 'UNKNOWN_FAMILY',
      message: `Unknown material family "${snapshot.familyId}".`,
    });
    return emptyResult;
  }

  // Check snapshot starting quantities
  for (const tier of family.tiers) {
    const qty = snapshot.startingInventory[tier.id];
    if (qty !== undefined && !isNonNegativeSafeInteger(qty)) {
      errors.push({
        field: tier.id,
        code: 'UNSAFE_INTEGER',
        message: `Starting inventory for ${tier.name} must be a non-negative safe integer.`,
      });
    }
  }

  if (!isNonNegativeSafeInteger(snapshot.startingMora)) {
    errors.push({
      field: 'startingMora',
      code: 'UNSAFE_INTEGER',
      message: 'Starting Mora must be a non-negative safe integer.',
    });
  }

  if (errors.length > 0) {
    return emptyResult;
  }

  // Initialize replaying balances
  const replayedInventory: Record<string, number> = {};
  family.tiers.forEach((tier) => {
    replayedInventory[tier.id] = snapshot.startingInventory[tier.id] ?? 0;
  });
  let replayedMora = snapshot.startingMora;

  const seenEventIds = new Set<string>();
  let totalOperations = 0;
  let totalMoraSpent = 0;

  // Build canonical recipe map for the active family
  const canonicalRecipeMap = new Map<string, typeof family.recipes[number]>();
  for (const r of family.recipes || []) {
    canonicalRecipeMap.set(r.id, r);
  }

  // Build snapshot recipe map for definition consistency
  const snapshotRecipeMap = new Map<string, typeof snapshot.recipes[number]>();
  for (const r of snapshot.recipes || []) {
    snapshotRecipeMap.set(r.id, r);
  }

  // Chronologically replay and strictly validate each event
  for (let idx = 0; idx < events.length; idx++) {
    const event = events[idx];
    const eventPrefix = `Event ${idx + 1} (${event.eventId || 'unidentified'})`;

    // 1. Event identity & duplicate checks
    if (!event.eventId || typeof event.eventId !== 'string') {
      errors.push({
        field: `events[${idx}].eventId`,
        code: 'INVALID_EVENT_ID',
        message: `${eventPrefix}: missing or invalid event ID.`,
      });
      continue;
    }

    if (seenEventIds.has(event.eventId)) {
      errors.push({
        field: `events[${idx}].eventId`,
        code: 'DUPLICATE_EVENT_ID',
        message: `${eventPrefix}: duplicate event ID "${event.eventId}" detected in ledger.`,
      });
      continue;
    }
    seenEventIds.add(event.eventId);

    // 2. Canonical recipe resolution & family membership
    const canonicalRecipe = canonicalRecipeMap.get(event.recipeId);
    if (!canonicalRecipe) {
      errors.push({
        field: `events[${idx}].recipeId`,
        code: 'UNKNOWN_RECIPE',
        message: `${eventPrefix}: recipe "${event.recipeId}" does not belong to family "${family.familyId}".`,
      });
      continue;
    }

    const snapshotRecipe = snapshotRecipeMap.get(event.recipeId);
    if (!snapshotRecipe) {
      errors.push({
        field: `events[${idx}].recipeId`,
        code: 'RECIPE_CHANGED',
        message: `${eventPrefix}: recipe "${event.recipeId}" is not present in session snapshot.`,
      });
      continue;
    }

    // Verify recipe mapping and fees match canonical definitions
    if (
      event.inputItemId !== canonicalRecipe.inputItemId ||
      event.outputItemId !== canonicalRecipe.outputItemId ||
      event.inputQtyPerCraft !== canonicalRecipe.inputQty ||
      event.outputQtyPerCraft !== canonicalRecipe.outputQty ||
      event.moraCostPerCraft !== canonicalRecipe.moraCost ||
      snapshotRecipe.inputItemId !== canonicalRecipe.inputItemId ||
      snapshotRecipe.outputItemId !== canonicalRecipe.outputItemId ||
      snapshotRecipe.inputQty !== canonicalRecipe.inputQty ||
      snapshotRecipe.outputQty !== canonicalRecipe.outputQty ||
      snapshotRecipe.moraCost !== canonicalRecipe.moraCost
    ) {
      errors.push({
        field: `events[${idx}].recipeId`,
        code: 'RECIPE_DEF_MISMATCH',
        message: `${eventPrefix}: recipe definition or fees do not match canonical database.`,
      });
      continue;
    }

    // 3. Operation count validation
    if (!isSafeInteger(event.operationsPerformed) || event.operationsPerformed <= 0) {
      errors.push({
        field: `events[${idx}].operationsPerformed`,
        code: 'INVALID_OPERATION_COUNT',
        message: `${eventPrefix}: operations count must be a positive safe integer (received: ${event.operationsPerformed}).`,
      });
      continue;
    }
    const b = event.operationsPerformed;

    // 4. Bonus type & actual output/refund validation
    const bonusType = event.bonusType ?? snapshot.bonusType;
    if (bonusType && !isBonusEligibleCategory(snapshot.category)) {
      errors.push({
        field: `events[${idx}].bonusType`,
        code: 'INVALID_BONUS_RESULT',
        message: `${eventPrefix}: bonus type "${bonusType}" is not permitted for category "${snapshot.category}".`,
      });
      continue;
    }

    if (!isNonNegativeSafeInteger(event.totalOutputReceived)) {
      errors.push({
        field: `events[${idx}].totalOutputReceived`,
        code: 'UNSAFE_INTEGER',
        message: `${eventPrefix}: totalOutputReceived must be a non-negative safe integer.`,
      });
      continue;
    }

    if (!isNonNegativeSafeInteger(event.bonusOutputReceived)) {
      errors.push({
        field: `events[${idx}].bonusOutputReceived`,
        code: 'UNSAFE_INTEGER',
        message: `${eventPrefix}: bonusOutputReceived must be a non-negative safe integer.`,
      });
      continue;
    }

    if (!isNonNegativeSafeInteger(event.refundsReceived)) {
      errors.push({
        field: `events[${idx}].refundsReceived`,
        code: 'UNSAFE_INTEGER',
        message: `${eventPrefix}: refundsReceived must be a non-negative safe integer.`,
      });
      continue;
    }

    if (bonusType === 'double_output') {
      if (event.refundsReceived !== 0) {
        errors.push({
          field: `events[${idx}].refundsReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: refundsReceived must be 0 for double_output bonus.`,
        });
        continue;
      }
      if (event.totalOutputReceived < b) {
        errors.push({
          field: `events[${idx}].totalOutputReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: totalOutputReceived (${event.totalOutputReceived}) cannot be less than crafted batches (${b}).`,
        });
        continue;
      }
      if (event.bonusOutputReceived !== event.totalOutputReceived - b) {
        errors.push({
          field: `events[${idx}].bonusOutputReceived`,
          code: 'LEDGER_INTEGRITY_MISMATCH',
          message: `${eventPrefix}: bonusOutputReceived (${event.bonusOutputReceived}) must equal totalOutputReceived (${event.totalOutputReceived}) - operations (${b}).`,
        });
        continue;
      }
    } else if (bonusType === 'ingredient_refund') {
      if (event.totalOutputReceived !== b) {
        errors.push({
          field: `events[${idx}].totalOutputReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: totalOutputReceived (${event.totalOutputReceived}) must equal operations (${b}) for refund bonus.`,
        });
        continue;
      }
      if (event.bonusOutputReceived !== 0) {
        errors.push({
          field: `events[${idx}].bonusOutputReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: bonusOutputReceived must be 0 for refund bonus.`,
        });
        continue;
      }
      if (event.refundsReceived > b) {
        errors.push({
          field: `events[${idx}].refundsReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: refundsReceived (${event.refundsReceived}) cannot exceed operations performed (${b}).`,
        });
        continue;
      }
    } else {
      // No bonus
      if (event.totalOutputReceived !== b) {
        errors.push({
          field: `events[${idx}].totalOutputReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: totalOutputReceived (${event.totalOutputReceived}) must equal operations (${b}) when no bonus is active.`,
        });
        continue;
      }
      if (event.bonusOutputReceived !== 0) {
        errors.push({
          field: `events[${idx}].bonusOutputReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: bonusOutputReceived must be 0 when no bonus is active.`,
        });
        continue;
      }
      if (event.refundsReceived !== 0) {
        errors.push({
          field: `events[${idx}].refundsReceived`,
          code: 'INVALID_BONUS_RESULT',
          message: `${eventPrefix}: refundsReceived must be 0 when no bonus is active.`,
        });
        continue;
      }
    }

    // 5. Recalculate canonical event values
    const recalcGross = b * canonicalRecipe.inputQty;
    const recalcRefunds = event.refundsReceived;
    const recalcNet = recalcGross - recalcRefunds;
    const recalcMora = b * canonicalRecipe.moraCost;

    // 6. Verify stored derived fields match canonical calculations
    if (event.grossInputConsumed !== recalcGross) {
      errors.push({
        field: `events[${idx}].grossInputConsumed`,
        code: 'LEDGER_INTEGRITY_MISMATCH',
        message: `${eventPrefix}: stored grossInputConsumed (${event.grossInputConsumed}) does not match recalculated value (${recalcGross}).`,
      });
      continue;
    }

    if (event.netInputConsumed !== recalcNet) {
      errors.push({
        field: `events[${idx}].netInputConsumed`,
        code: 'LEDGER_INTEGRITY_MISMATCH',
        message: `${eventPrefix}: stored netInputConsumed (${event.netInputConsumed}) does not match recalculated value (${recalcNet}).`,
      });
      continue;
    }

    if (event.moraSpent !== recalcMora) {
      errors.push({
        field: `events[${idx}].moraSpent`,
        code: 'LEDGER_INTEGRITY_MISMATCH',
        message: `${eventPrefix}: stored moraSpent (${event.moraSpent}) does not match recalculated value (${recalcMora}).`,
      });
      continue;
    }

    // 7. Enforce physical ingredient and Mora feasibility at this event step
    const currentInputBalance = replayedInventory[event.inputItemId] ?? 0;
    if (currentInputBalance < recalcGross) {
      errors.push({
        field: `events[${idx}].grossInputConsumed`,
        code: 'INSUFFICIENT_INGREDIENTS',
        message: `${eventPrefix}: requires ${recalcGross.toLocaleString()} ${event.inputItemId}, but only ${currentInputBalance.toLocaleString()} was available at step ${idx + 1}.`,
      });
      continue;
    }

    if (replayedMora < recalcMora) {
      errors.push({
        field: `events[${idx}].moraSpent`,
        code: 'INSUFFICIENT_MORA',
        message: `${eventPrefix}: requires ${recalcMora.toLocaleString()} Mora, but only ${replayedMora.toLocaleString()} was available at step ${idx + 1}.`,
      });
      continue;
    }

    // 8. Apply event to running replay balances
    replayedInventory[event.inputItemId] = currentInputBalance - recalcGross + recalcRefunds;
    replayedInventory[event.outputItemId] =
      (replayedInventory[event.outputItemId] ?? 0) + event.totalOutputReceived;
    replayedMora -= recalcMora;

    totalOperations += b;
    totalMoraSpent += recalcMora;
  }

  if (errors.length > 0) {
    return {
      ...emptyResult,
      errors,
    };
  }

  // Cross-check replayed ending inventory against session stored shadow inventory
  if (ledger && ledger.shadowInventory) {
    for (const tier of family.tiers) {
      const replayedQty = replayedInventory[tier.id] ?? 0;
      const shadowQty = ledger.shadowInventory[tier.id] ?? 0;
      if (replayedQty !== shadowQty) {
        errors.push({
          field: tier.id,
          code: 'LEDGER_INTEGRITY_MISMATCH',
          message: `Replayed ending inventory for ${tier.name} (${replayedQty}) does not match session shadow inventory (${shadowQty}).`,
        });
      }
    }

    const expectedEndingMora = snapshot.startingMora - totalMoraSpent;
    const shadowEndingMora = ledger.shadowInventory['Mora'] ?? ledger.remainingMora;
    if (shadowEndingMora !== undefined && shadowEndingMora !== expectedEndingMora) {
      errors.push({
        field: 'Mora',
        code: 'LEDGER_INTEGRITY_MISMATCH',
        message: `Replayed ending Mora (${expectedEndingMora}) does not match session remaining Mora (${shadowEndingMora}).`,
      });
    }

    if (ledger.totalMoraSpent !== undefined && ledger.totalMoraSpent !== totalMoraSpent) {
      errors.push({
        field: 'totalMoraSpent',
        code: 'LEDGER_INTEGRITY_MISMATCH',
        message: `Replayed total Mora spent (${totalMoraSpent}) does not match session totalMoraSpent (${ledger.totalMoraSpent}).`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      ...emptyResult,
      errors,
    };
  }

  // Compute final cumulative deltas
  const materialDeltas: Record<string, number> = {};
  const allMaterialDeltas: MaterialDelta[] = [];
  const activeMaterialDeltas: MaterialDelta[] = [];

  family.tiers.forEach((tier) => {
    const startQty = snapshot.startingInventory[tier.id] ?? 0;
    const endQty = replayedInventory[tier.id] ?? 0;
    const delta = endQty - startQty;

    materialDeltas[tier.id] = delta;

    const row: MaterialDelta = {
      itemId: tier.id,
      itemName: tier.name,
      tierIndex: tier.tierIndex,
      startingQuantity: startQty,
      delta,
      endingQuantity: endQty,
    };

    allMaterialDeltas.push(row);
    if (delta !== 0) {
      activeMaterialDeltas.push(row);
    }
  });

  const moraDelta: MoraDelta = {
    startingMora: snapshot.startingMora,
    delta: -totalMoraSpent,
    endingMora: replayedMora,
  };

  return {
    isValid: true,
    errors: [],
    materialDeltas,
    allMaterialDeltas,
    activeMaterialDeltas,
    moraDelta,
    totalOperations,
    totalBatches: events.length,
    totalMoraSpent,
    replayedInventory,
    replayedMora,
  };
}

/**
 * Derives a presentation-friendly preview of an inventory transaction.
 */
export function deriveInventoryTransactionPreview(
  transaction: CraftingInventoryTransaction
): InventoryTransactionPreview {
  const family = getCraftingFamily(transaction.familyId);
  const tiers = family?.tiers || [];

  const allMaterialChanges: InventoryTransactionPreviewRow[] = tiers.map((tier) => {
    const savedNow = transaction.startingBalances[tier.id] ?? 0;
    const change = transaction.deltas[tier.id] ?? 0;
    const after = transaction.endingBalances[tier.id] ?? savedNow;
    return {
      itemId: tier.id,
      itemName: tier.name,
      tierIndex: tier.tierIndex,
      savedNow,
      change,
      after,
    };
  });

  const materialChanges = allMaterialChanges.filter((m) => m.change !== 0);

  const savedMoraNow = transaction.startingBalances['Mora'] ?? 0;
  const moraChangeVal = transaction.deltas['Mora'] ?? 0;
  const moraAfter = transaction.endingBalances['Mora'] ?? savedMoraNow;

  const blockingReasons = transaction.diagnostics.map((d) => d.message);

  return {
    familyId: transaction.familyId,
    familyName: transaction.familyName,
    totalBatches: transaction.totalBatches,
    totalOperations: transaction.totalOperations,
    totalMoraSpent: transaction.totalMoraSpent,
    materialChanges,
    allMaterialChanges,
    moraChange: {
      savedNow: savedMoraNow,
      change: moraChangeVal,
      after: moraAfter,
    },
    canApply: transaction.status === 'valid',
    blockingReasons,
    warnings: [],
  };
}

/**
 * Validates a previously prepared crafting inventory transaction against current live source state.
 *
 * Fails closed if live inventory, Mora, or requirements have diverged, or if the transaction
 * contains diagnostics or negative ending balances.
 */
export function validateCraftingInventoryTransaction(
  transaction: CraftingInventoryTransaction | null,
  liveSource: LiveCraftingSource
): TransactionValidationResult {
  const errors: TransactionDiagnostic[] = [];

  if (!transaction) {
    errors.push({
      field: 'transaction',
      code: 'INVALID_TRANSACTION',
      message: 'Transaction object is missing or null.',
    });
    return { isValid: false, errors };
  }

  if (transaction.status !== 'valid') {
    return {
      isValid: false,
      errors: transaction.diagnostics.length > 0
        ? [...transaction.diagnostics]
        : [
            {
              field: 'status',
              code: 'INVALID_TRANSACTION',
              message: 'Transaction has invalid status.',
            },
          ],
    };
  }

  const liveInv = liveSource.inventory || {};
  const liveMora = Math.max(
    0,
    Number(liveSource.mora !== undefined ? liveSource.mora : liveInv['Mora']) || 0
  );

  // Check all starting balances against current live state
  for (const [itemId, expectedStartingQty] of Object.entries(transaction.startingBalances)) {
    if (itemId === 'Mora') {
      if (liveMora !== expectedStartingQty) {
        errors.push({
          field: 'Mora',
          code: 'STALE_PREVIEW',
          message: `Live Mora (${liveMora.toLocaleString()}) has changed since transaction was prepared (expected ${expectedStartingQty.toLocaleString()}).`,
        });
      }
    } else {
      const currentLiveQty = Math.max(0, Number(liveInv[itemId]) || 0);
      if (currentLiveQty !== expectedStartingQty) {
        errors.push({
          field: itemId,
          code: 'STALE_PREVIEW',
          message: `Live inventory for "${itemId}" (${currentLiveQty.toLocaleString()}) has changed since transaction was prepared (expected ${expectedStartingQty.toLocaleString()}).`,
        });
      }
    }
  }

  // Check ending balances
  for (const [itemId, endingQty] of Object.entries(transaction.endingBalances)) {
    if (endingQty < 0) {
      errors.push({
        field: itemId,
        code: itemId === 'Mora' ? 'INSUFFICIENT_MORA' : 'INSUFFICIENT_INGREDIENTS',
        message: `Resulting balance for ${itemId} would be negative (${endingQty}).`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Pure preparation of an authorized inventory transaction from an active crafting session.
 *
 * 1. Strictly re-evaluates chronological event ledger and material conservation.
 * 2. Cross-checks against stored shadow inventory.
 * 3. Enforces strict source freshness (both conflict_unreviewed AND conflict_continued are rejected).
 * 4. Generates a deterministic transaction identity.
 * 5. Constructs the immutable transaction and preview models.
 */
export function prepareCraftingInventoryTransaction(
  session: CraftingSessionState,
  liveSource: LiveCraftingSource
): CraftingInventoryTransactionPreparationResult {
  const errors: TransactionDiagnostic[] = [];

  if (!session || !session.snapshot) {
    errors.push({
      field: 'session',
      code: 'NO_SESSION',
      message: 'No active crafting session provided.',
    });
    return {
      isPrepared: false,
      transaction: null,
      preview: null,
      errors,
    };
  }

  // 1. Calculate and strictly revalidate confirmed deltas
  const deltasResult = calculateConfirmedCraftingDeltas(session);
  if (!deltasResult.isValid) {
    return {
      isPrepared: false,
      transaction: null,
      preview: null,
      errors: deltasResult.errors,
    };
  }

  // 2. Freshness and source compatibility validation
  const comparison = compareCraftingSessionSource(
    session.snapshot,
    liveSource,
    session.acknowledgedFingerprint
  );

  if (comparison.status === 'conflict_unreviewed') {
    errors.push({
      field: 'source',
      code: 'UNREVIEWED_SOURCE_CONFLICT',
      message:
        'Live inventory, Mora, or requirements have changed. Review conflicts before applying.',
    });
  } else if (comparison.status === 'conflict_continued') {
    errors.push({
      field: 'source',
      code: 'CONTINUED_SOURCE_CONFLICT',
      message:
        'Cannot apply crafting results from an acknowledged stale snapshot. Application to real inventory requires an exact match with current inventory.',
    });
  } else if (!comparison.isFresh || comparison.hasConflict) {
    errors.push({
      field: 'source',
      code: 'SOURCE_CONFLICT',
      message: 'Session starting snapshot does not match current live source.',
    });
  }

  // Exact-match checks on family tier items and Mora
  const family = getCraftingFamily(session.snapshot.familyId);
  if (family) {
    const liveInv = liveSource.inventory || {};
    for (const tier of family.tiers) {
      const liveQty = Math.max(0, Number(liveInv[tier.id]) || 0);
      const snapQty = session.snapshot.startingInventory[tier.id] ?? 0;
      if (liveQty !== snapQty) {
        errors.push({
          field: tier.id,
          code: 'SOURCE_CONFLICT',
          message: `Current inventory for ${tier.name} (${liveQty.toLocaleString()}) does not match session starting snapshot (${snapQty.toLocaleString()}).`,
        });
      }
    }

    const liveMora = Math.max(
      0,
      Number(liveSource.mora !== undefined ? liveSource.mora : liveInv['Mora']) || 0
    );
    const snapMora = session.snapshot.startingMora ?? 0;
    if (liveMora !== snapMora) {
      errors.push({
        field: 'Mora',
        code: 'SOURCE_CONFLICT',
        message: `Current Mora (${liveMora.toLocaleString()}) does not match session starting Mora (${snapMora.toLocaleString()}).`,
      });
    }
  }

  // 3. Post-condition validation (resulting quantities must be non-negative)
  for (const [tierId, delta] of Object.entries(deltasResult.materialDeltas)) {
    const startQty = session.snapshot.startingInventory[tierId] ?? 0;
    const endQty = startQty + delta;
    if (endQty < 0) {
      errors.push({
        field: tierId,
        code: 'INSUFFICIENT_INGREDIENTS',
        message: `Resulting balance for ${tierId} would be negative: ${endQty}.`,
      });
    }
  }

  const endMora = session.snapshot.startingMora + deltasResult.moraDelta.delta;
  if (endMora < 0) {
    errors.push({
      field: 'Mora',
      code: 'INSUFFICIENT_MORA',
      message: `Resulting Mora balance would be negative: ${endMora.toLocaleString()}.`,
    });
  }

  // 4. Construct starting balances and deltas maps
  const startingBalances: Record<string, number> = {};
  const deltas: Record<string, number> = {};
  const endingBalances: Record<string, number> = {};

  if (family) {
    for (const tier of family.tiers) {
      startingBalances[tier.id] = session.snapshot.startingInventory[tier.id] ?? 0;
      deltas[tier.id] = deltasResult.materialDeltas[tier.id] ?? 0;
      endingBalances[tier.id] = deltasResult.replayedInventory[tier.id] ?? 0;
    }
  }
  startingBalances['Mora'] = session.snapshot.startingMora;
  deltas['Mora'] = deltasResult.moraDelta.delta;
  endingBalances['Mora'] = deltasResult.moraDelta.endingMora;

  // 5. Generate deterministic ledger fingerprint and transaction ID
  const eventIds = session.events.map((e) => e.eventId);
  const ledgerString = session.events
    .map(
      (e) =>
        `${e.eventId}:${e.recipeId}:${e.operationsPerformed}:${e.totalOutputReceived}:${e.refundsReceived}:${e.moraSpent}`
    )
    .join(';');
  const ledgerFingerprint = hashString(ledgerString);
  const sourceFingerprint = session.snapshot.fingerprint;

  const identityPayload = `${session.snapshot.familyId}@${session.sessionId}@${eventIds.join(',')}@${ledgerFingerprint}@${sourceFingerprint}`;
  const transactionId = `tx_${session.snapshot.familyId}_ev${session.events.length}_${hashString(identityPayload)}`;

  const isValid = errors.length === 0;

  const transaction: CraftingInventoryTransaction = {
    transactionId,
    sessionId: session.sessionId,
    familyId: session.snapshot.familyId,
    familyName: session.snapshot.familyName,
    eventIds,
    ledgerFingerprint,
    sourceFingerprint,
    startingBalances,
    deltas,
    endingBalances,
    totalOperations: deltasResult.totalOperations,
    totalBatches: deltasResult.totalBatches,
    totalMoraSpent: deltasResult.totalMoraSpent,
    createdAt: Date.now(),
    status: isValid ? 'valid' : 'invalid',
    diagnostics: errors,
  };

  const preview = deriveInventoryTransactionPreview(transaction);

  return {
    isPrepared: isValid,
    transaction,
    preview,
    errors,
  };
}

