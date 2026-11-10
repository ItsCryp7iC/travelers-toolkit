import {
  CRAFTING_FAMILY_BY_ID,
  CRAFTING_RECIPE_BY_ID,
  CraftingCategory,
  CraftingFamily,
  CraftingRecipe,
  getCraftingFamily,
} from '../data/craftingRecipes';
import {
  CraftingBonusType,
  isBonusEligibleCategory,
} from '../data/craftingBonuses';
import {
  computeCraftingPlan,
  CraftingPlanResult,
  CraftingStep,
} from './craftingEngine';
import {
  forecastFamilyCrafting,
  FamilyCraftingForecast,
  OptimizedCraftingStep,
} from './craftingBonusForecast';

export type CraftingSessionBonusType = 'double_output' | 'ingredient_refund' | null;

export interface SessionMaterialItem {
  id: string;
  name: string;
  rarity: number;
  tierIndex: number;
}

export interface SessionRecipe {
  id: string;
  sourceTierIndex: number;
  targetTierIndex: number;
  inputItemId: string;
  inputItemName: string;
  inputQty: number; // 3
  outputItemId: string;
  outputItemName: string;
  outputQty: number; // 1
  moraCost: number;
}

export interface CraftingSessionSnapshot {
  familyId: string;
  familyName: string;
  category: CraftingCategory;
  isCraftable: boolean;
  materialIds: string[];
  materials: SessionMaterialItem[];
  recipes: SessionRecipe[];
  startingInventory: Record<string, number>;
  grossRequirements: Record<string, number>;
  startingMora: number;
  bonusType: CraftingSessionBonusType;
  fingerprint: string;
  createdAt: number;
}

export interface CraftingResultEvent {
  eventId: string;
  timestamp: number;
  recipeId: string;
  recipeName: string;
  sourceTierIndex: number;
  targetTierIndex: number;
  inputItemId: string;
  outputItemId: string;
  inputQtyPerCraft: number; // 3
  outputQtyPerCraft: number; // 1
  moraCostPerCraft: number;
  bonusType: CraftingSessionBonusType;
  operationsPerformed: number; // b >= 1
  totalOutputReceived: number; // >= b
  bonusOutputReceived: number; // totalOutputReceived - b (for double_output)
  refundsReceived: number; // >= 0 and <= b (for ingredient_refund)
  grossInputConsumed: number; // b * 3
  netInputConsumed: number; // gross - refunds
  moraSpent: number; // b * moraCostPerCraft
  userNote?: string;
}

export interface SessionValidationDiagnostic {
  field: string;
  code: string;
  message: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  errors: SessionValidationDiagnostic[];
}

export interface DerivedSessionLedgerState {
  shadowInventory: Record<string, number>;
  totalMoraSpent: number;
  remainingMora: number;
  confirmedOperationsByRecipe: Record<string, number>;
  confirmedOutputByRecipe: Record<string, number>;
  confirmedBonusOutputByRecipe: Record<string, number>;
  confirmedRefundsByRecipe: Record<string, number>;
  confirmedGrossConsumedByItem: Record<string, number>;
  confirmedNetConsumedByItem: Record<string, number>;
  totalEventsCount: number;
}

export interface CraftingSessionState {
  sessionId: string;
  snapshot: CraftingSessionSnapshot;
  events: CraftingResultEvent[];
  ledger: DerivedSessionLedgerState;
  remainingPlan: CraftingPlanResult;
  remainingForecast: FamilyCraftingForecast | null;
  nextRecommendedStep: OptimizedCraftingStep | null;
  updatedAt: number;
}

export interface RecordCraftingResultInput {
  eventId?: string;
  recipeId: string;
  operationsPerformed: number;
  totalOutputReceived?: number;
  bonusOutputReceived?: number;
  refundsReceived?: number;
  bonusType?: CraftingSessionBonusType;
  userNote?: string;
  timestamp?: number;
}

/**
 * Computes a deterministic relevant-state fingerprint for the session family.
 * Unrelated inventory items (outside this family) are strictly excluded.
 */
export function computeSessionFingerprint(
  family: CraftingFamily,
  inventory: Record<string, unknown> = {},
  grossRequirements: Record<string, unknown> = {},
  bonusType: CraftingSessionBonusType = null,
  mora: number = 0
): string {
  const itemIds = family.tiers.map((t) => t.id).sort();
  const invEntries = itemIds
    .map((id) => `${id}:${Math.max(0, Number(inventory[id]) || 0)}`)
    .join('|');
  const reqEntries = itemIds
    .map((id) => `${id}:${Math.max(0, Number(grossRequirements[id]) || 0)}`)
    .join('|');
  const moraVal = Math.max(0, Number(mora) || 0);
  const bonusStr = bonusType ?? 'none';
  return `${family.familyId}@${bonusStr}#INV[${invEntries}|Mora:${moraVal}]#REQ[${reqEntries}]`;
}

/**
 * Generates an RFC4122 compliant v4 UUID.
 * Uses crypto.randomUUID where available with deterministic fallback.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalizes input quantities safely and non-destructively.
 */
function cleanNonNegativeInt(val: unknown): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val <= 0) return 0;
    return Math.floor(val);
  }
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

/**
 * Creates an immutable CraftingSessionState.
 * Captures initial frozen snapshots and calculates the initial plan.
 */
export function createCraftingSession(options: {
  familyId: string;
  inventory: Record<string, unknown>;
  grossRequirements: Record<string, unknown>;
  bonusType?: CraftingSessionBonusType;
  sessionId?: string;
  timestamp?: number;
}): CraftingSessionState {
  const family = getCraftingFamily(options.familyId);
  if (!family) {
    throw new Error(`Unknown crafting family ID: "${options.familyId}"`);
  }

  const bonusType = options.bonusType ?? null;
  const now = options.timestamp ?? Date.now();
  const sessionId = options.sessionId ?? generateUUID();

  // Normalize family inventory and requirements
  const materialIds = family.tiers.map((t) => t.id);
  const startingInventory: Record<string, number> = {};
  const grossRequirements: Record<string, number> = {};

  materialIds.forEach((id) => {
    startingInventory[id] = cleanNonNegativeInt(options.inventory[id]);
    grossRequirements[id] = cleanNonNegativeInt(options.grossRequirements[id]);
  });

  const startingMora = cleanNonNegativeInt(options.inventory['Mora']);
  startingInventory['Mora'] = startingMora;

  const materials: SessionMaterialItem[] = family.tiers.map((t) => ({
    id: t.id,
    name: t.name,
    rarity: t.rarity,
    tierIndex: t.tierIndex,
  }));

  const recipes: SessionRecipe[] = (family.recipes || []).map((r, s) => ({
    id: r.id,
    sourceTierIndex: s,
    targetTierIndex: s + 1,
    inputItemId: r.inputItemId,
    inputItemName: family.tiers[s]?.name || r.inputItemId,
    inputQty: r.inputQty,
    outputItemId: r.outputItemId,
    outputItemName: family.tiers[s + 1]?.name || r.outputItemId,
    outputQty: r.outputQty,
    moraCost: r.moraCost,
  }));

  const fingerprint = computeSessionFingerprint(
    family,
    startingInventory,
    grossRequirements,
    bonusType,
    startingMora
  );

  const snapshot: CraftingSessionSnapshot = {
    familyId: family.familyId,
    familyName: family.name,
    category: family.category,
    isCraftable: family.isCraftable,
    materialIds,
    materials,
    recipes,
    startingInventory,
    grossRequirements,
    startingMora,
    bonusType,
    fingerprint,
    createdAt: now,
  };

  const ledger = replayCraftingSession(snapshot, []);
  const remaining = calculateRemainingSessionPlan(snapshot, ledger);

  return {
    sessionId,
    snapshot,
    events: [],
    ledger,
    remainingPlan: remaining.remainingPlan,
    remainingForecast: remaining.remainingForecast,
    nextRecommendedStep: remaining.nextRecommendedStep,
    updatedAt: now,
  };
}

/**
 * Replays an ordered append-only crafting event ledger starting from the immutable snapshot.
 * Pure, deterministic, and preserves material conservation.
 */
export function replayCraftingSession(
  snapshot: CraftingSessionSnapshot,
  events: readonly CraftingResultEvent[]
): DerivedSessionLedgerState {
  const shadowInventory: Record<string, number> = { ...snapshot.startingInventory };
  let totalMoraSpent = 0;

  const confirmedOperationsByRecipe: Record<string, number> = {};
  const confirmedOutputByRecipe: Record<string, number> = {};
  const confirmedBonusOutputByRecipe: Record<string, number> = {};
  const confirmedRefundsByRecipe: Record<string, number> = {};
  const confirmedGrossConsumedByItem: Record<string, number> = {};
  const confirmedNetConsumedByItem: Record<string, number> = {};

  for (const event of events) {
    const inputId = event.inputItemId;
    const outputId = event.outputItemId;
    const recipeId = event.recipeId;

    // 1. Gross input deduction
    shadowInventory[inputId] = (shadowInventory[inputId] || 0) - event.grossInputConsumed;
    confirmedGrossConsumedByItem[inputId] =
      (confirmedGrossConsumedByItem[inputId] || 0) + event.grossInputConsumed;

    // 2. Refund addition
    if (event.refundsReceived > 0) {
      shadowInventory[inputId] = (shadowInventory[inputId] || 0) + event.refundsReceived;
      confirmedRefundsByRecipe[recipeId] =
        (confirmedRefundsByRecipe[recipeId] || 0) + event.refundsReceived;
    }
    confirmedNetConsumedByItem[inputId] =
      (confirmedNetConsumedByItem[inputId] || 0) + event.netInputConsumed;

    // 3. Produced output addition
    shadowInventory[outputId] = (shadowInventory[outputId] || 0) + event.totalOutputReceived;
    confirmedOutputByRecipe[recipeId] =
      (confirmedOutputByRecipe[recipeId] || 0) + event.totalOutputReceived;
    confirmedBonusOutputByRecipe[recipeId] =
      (confirmedBonusOutputByRecipe[recipeId] || 0) + event.bonusOutputReceived;

    // 4. Mora deduction
    shadowInventory['Mora'] = (shadowInventory['Mora'] || 0) - event.moraSpent;
    totalMoraSpent += event.moraSpent;

    // 5. Operations count tracking
    confirmedOperationsByRecipe[recipeId] =
      (confirmedOperationsByRecipe[recipeId] || 0) + event.operationsPerformed;
  }

  return {
    shadowInventory,
    totalMoraSpent,
    remainingMora: shadowInventory['Mora'] || 0,
    confirmedOperationsByRecipe,
    confirmedOutputByRecipe,
    confirmedBonusOutputByRecipe,
    confirmedRefundsByRecipe,
    confirmedGrossConsumedByItem,
    confirmedNetConsumedByItem,
    totalEventsCount: events.length,
  };
}

/**
 * Recalculates remaining crafting requirements and bonus forecasts
 * based on original frozen gross demand and updated shadow inventory.
 */
export function calculateRemainingSessionPlan(
  snapshot: CraftingSessionSnapshot,
  ledger: DerivedSessionLedgerState,
  events: readonly CraftingResultEvent[] = []
): {
  remainingPlan: CraftingPlanResult;
  remainingForecast: FamilyCraftingForecast | null;
  nextRecommendedStep: OptimizedCraftingStep | null;
} {
  const family = getCraftingFamily(snapshot.familyId);
  if (!family || !snapshot.isCraftable) {
    const emptyPlan = computeCraftingPlan(snapshot.grossRequirements, ledger.shadowInventory);
    return {
      remainingPlan: emptyPlan,
      remainingForecast: null,
      nextRecommendedStep: null,
    };
  }

  // 1. Guaranteed CRAFT-B plan from current shadow inventory
  const remainingPlan = computeCraftingPlan(
    snapshot.grossRequirements,
    ledger.shadowInventory,
    {
      priority: 'highest-tier',
      affordabilityMora: ledger.remainingMora,
    }
  );

  // 2. Bonus forecast for future unperformed operations
  let remainingForecast: FamilyCraftingForecast | null = null;
  let nextRecommendedStep: OptimizedCraftingStep | null = null;
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  if (snapshot.bonusType !== null && isBonusEligibleCategory(snapshot.category, snapshot.bonusType)) {
    remainingForecast = forecastFamilyCrafting(
      family,
      snapshot.grossRequirements,
      ledger.shadowInventory,
      snapshot.bonusType
    );

    // Pick step in natural bottom-up sequential progression
    if (remainingForecast && remainingForecast.optimizedSteps.length > 0) {
      let activeStep: OptimizedCraftingStep | null = null;

      // If a previous tier was completed, advance to next higher tier if ready and executable
      if (lastEvent) {
        activeStep =
          remainingForecast.optimizedSteps.find(
            (s) =>
              s.sourceTierIndex > lastEvent.sourceTierIndex &&
              (s.suggestedInitialBatch > 0 || s.expectedCrafts > 0) &&
              s.immediatelyExecutableCrafts >= s.suggestedInitialBatch
          ) || null;
      }

      // If no higher tier step is ready, pick the first step with remaining work
      if (!activeStep) {
        activeStep =
          remainingForecast.optimizedSteps.find(
            (s) => s.suggestedInitialBatch > 0 || s.expectedCrafts > 0
          ) || null;
      }

      nextRecommendedStep = activeStep;
    }
  } else {
    // Bonus-disabled mode: pick first step with remaining guaranteed crafts
    const famPlan = remainingPlan.families[snapshot.familyId];
    if (famPlan && famPlan.steps && famPlan.steps.length > 0) {
      let activeStep: CraftingStep | null = null;

      if (lastEvent) {
        activeStep =
          famPlan.steps.find((s) => {
            const recipe = family.recipes.find((r) => r.id === s.recipeId);
            if (!recipe) return false;
            const sIdx = family.tiers.findIndex((t) => t.id === recipe.inputItemId);
            const guarAvail = Math.floor(
              Math.max(
                0,
                (ledger.shadowInventory[recipe.inputItemId] || 0) -
                  (snapshot.grossRequirements[recipe.inputItemId] || 0)
              ) / recipe.inputQty
            );
            return sIdx > lastEvent.sourceTierIndex && s.count > 0 && guarAvail >= s.count;
          }) || null;
      }

      if (!activeStep) {
        activeStep = famPlan.steps.find((s) => s.count > 0) || null;
      }

      if (activeStep) {
        const recipe = family.recipes.find((r) => r.id === activeStep.recipeId);
        if (recipe) {
          const sIdx = family.tiers.findIndex((t) => t.id === recipe.inputItemId);
          const guarAvail = Math.floor(
            Math.max(0, (ledger.shadowInventory[recipe.inputItemId] || 0) - (snapshot.grossRequirements[recipe.inputItemId] || 0)) / recipe.inputQty
          );
          nextRecommendedStep = {
            recipeId: recipe.id,
            familyId: family.familyId,
            category: family.category,
            sourceTierIndex: sIdx,
            targetTierIndex: sIdx + 1,
            inputItemId: recipe.inputItemId,
            inputItemName: family.tiers[sIdx]?.name || recipe.inputItemId,
            inputQty: recipe.inputQty,
            outputItemId: recipe.outputItemId,
            outputItemName: family.tiers[sIdx + 1]?.name || recipe.outputItemId,
            outputQty: recipe.outputQty,
            moraCostPerCraft: recipe.moraCost,
            guaranteedCrafts: activeStep.count,
            guaranteedOutput: activeStep.totalOutputProduced,
            guaranteedGrossInputConsumed: activeStep.totalInputConsumed,
            guaranteedMoraCost: activeStep.totalMoraCost,
            expectedCrafts: activeStep.count,
            expectedOutput: activeStep.totalOutputProduced,
            expectedBonusOutput: 0,
            expectedIngredientRefunds: 0,
            expectedGrossInputConsumed: activeStep.totalInputConsumed,
            expectedNetInputConsumed: activeStep.totalInputConsumed,
            expectedMoraCost: activeStep.totalMoraCost,
            suggestedInitialBatch: activeStep.count,
            safeInitialBatch: activeStep.count,
            recommendedActionBatch: activeStep.count,
            isActionFallback: false,
            initialBatchNote: 'Guaranteed 3:1 batch',
            isConditional: false,
            priorStepIndex: null,
            immediatelyExecutableCrafts: guarAvail,
            guaranteedAvailableCrafts: guarAvail,
            currentlyOwnedIngredients: ledger.shadowInventory[recipe.inputItemId] || 0,
            directIngredientRequirement: snapshot.grossRequirements[recipe.inputItemId] || 0,
            accessibleIngredients: Math.max(0, (ledger.shadowInventory[recipe.inputItemId] || 0) - (snapshot.grossRequirements[recipe.inputItemId] || 0)),
            firstBatchIngredients: activeStep.count * recipe.inputQty,
            firstBatchMora: activeStep.count * recipe.moraCost,
          };
        }
      }
    }
  }

  return {
    remainingPlan,
    remainingForecast,
    nextRecommendedStep,
  };
}

/**
 * Validates a proposed crafting result against session rules,
 * canonical recipe specifications, and current shadow inventory.
 */
export function validateCraftingResultInput(
  session: CraftingSessionState,
  input: RecordCraftingResultInput
): SessionValidationResult {
  const errors: SessionValidationDiagnostic[] = [];

  // 1. Session and family sanity
  const family = getCraftingFamily(session.snapshot.familyId);
  if (!family) {
    errors.push({
      field: 'familyId',
      code: 'INVALID_FAMILY',
      message: `Unknown crafting family "${session.snapshot.familyId}".`,
    });
    return { isValid: false, errors };
  }

  // 2. Recipe verification
  const recipe = family.recipes.find((r) => r.id === input.recipeId);
  if (!recipe) {
    errors.push({
      field: 'recipeId',
      code: 'INVALID_RECIPE_ID',
      message: `Recipe "${input.recipeId}" does not exist in family "${family.name}".`,
    });
    return { isValid: false, errors };
  }

  // 3. Duplicate event ID check
  if (input.eventId && session.events.some((e) => e.eventId === input.eventId)) {
    errors.push({
      field: 'eventId',
      code: 'DUPLICATE_EVENT_ID',
      message: `An event with ID "${input.eventId}" has already been recorded in this session.`,
    });
    return { isValid: false, errors };
  }

  // 4. Bonus type consistency
  if (input.bonusType !== undefined && input.bonusType !== session.snapshot.bonusType) {
    errors.push({
      field: 'bonusType',
      code: 'BONUS_TYPE_MISMATCH',
      message: `Cannot record event with bonusType "${input.bonusType}" in a session configured for "${session.snapshot.bonusType}".`,
    });
  }

  // 5. Operations count validation
  const ops = input.operationsPerformed;
  if (typeof ops !== 'number' || !Number.isFinite(ops) || ops <= 0 || !Number.isInteger(ops)) {
    errors.push({
      field: 'operationsPerformed',
      code: 'INVALID_OPERATIONS_COUNT',
      message: 'Crafting operations performed must be a positive integer.',
    });
    return { isValid: false, errors };
  }

  // 6. Gross ingredients availability (Physical execution policy)
  const currentShadow = session.ledger.shadowInventory;
  const grossNeeded = ops * recipe.inputQty;
  const currentAvailableInput = currentShadow[recipe.inputItemId] ?? 0;
  if (currentAvailableInput < grossNeeded) {
    errors.push({
      field: 'operationsPerformed',
      code: 'INSUFFICIENT_GROSS_INGREDIENTS',
      message: `Cannot execute ${ops} crafts of "${recipe.outputItemId}": requires ${grossNeeded} gross ingredients, but only ${currentAvailableInput} are currently available in shadow inventory. Please record smaller sequential sub-batches.`,
    });
  }

  // 7. Mora fee affordability
  const moraNeeded = ops * recipe.moraCost;
  const currentMora = currentShadow['Mora'] ?? 0;
  if (currentMora < moraNeeded) {
    errors.push({
      field: 'operationsPerformed',
      code: 'INSUFFICIENT_MORA',
      message: `Cannot execute ${ops} crafts: requires ${moraNeeded} Mora, but only ${currentMora} Mora is available.`,
    });
  }

  // 8. Mechanic-specific output / refund validation
  const activeBonusType = session.snapshot.bonusType;
  const isEligible = isBonusEligibleCategory(session.snapshot.category, activeBonusType || 'double_output');

  if (activeBonusType === 'double_output') {
    const baseOutput = ops * recipe.outputQty;
    let totalOutput = input.totalOutputReceived;

    if (totalOutput === undefined) {
      if (input.bonusOutputReceived !== undefined) {
        totalOutput = baseOutput + input.bonusOutputReceived;
      } else {
        totalOutput = baseOutput;
      }
    }

    if (typeof totalOutput !== 'number' || !Number.isFinite(totalOutput) || !Number.isInteger(totalOutput)) {
      errors.push({
        field: 'totalOutputReceived',
        code: 'INVALID_OUTPUT_QUANTITY',
        message: 'Total output received must be an integer.',
      });
    } else {
      if (totalOutput < baseOutput) {
        errors.push({
          field: 'totalOutputReceived',
          code: 'OUTPUT_BELOW_MINIMUM',
          message: `Total output received (${totalOutput}) cannot be less than base crafted output (${baseOutput}).`,
        });
      }
      const maxOutput = baseOutput * 2;
      if (totalOutput > maxOutput) {
        errors.push({
          field: 'totalOutputReceived',
          code: 'OUTPUT_EXCEEDS_MAXIMUM',
          message: `Total output received (${totalOutput}) cannot exceed twice the base crafted output (${maxOutput}) for 10% Double Output.`,
        });
      }
      if (!isEligible && totalOutput > baseOutput) {
        errors.push({
          field: 'totalOutputReceived',
          code: 'INELIGIBLE_BONUS_CATEGORY',
          message: `Category "${session.snapshot.category}" is not eligible for Double Output bonuses.`,
        });
      }
    }
  } else if (activeBonusType === 'ingredient_refund') {
    const refunds = input.refundsReceived ?? 0;
    if (typeof refunds !== 'number' || !Number.isFinite(refunds) || !Number.isInteger(refunds)) {
      errors.push({
        field: 'refundsReceived',
        code: 'INVALID_REFUND_QUANTITY',
        message: 'Refunds received must be an integer.',
      });
    } else {
      if (refunds < 0) {
        errors.push({
          field: 'refundsReceived',
          code: 'NEGATIVE_REFUND',
          message: `Refund count (${refunds}) cannot be negative.`,
        });
      }
      if (refunds > ops) {
        errors.push({
          field: 'refundsReceived',
          code: 'REFUND_EXCEEDS_OPERATIONS',
          message: `Refund count (${refunds}) cannot exceed operations performed (${ops}).`,
        });
      }
      if (!isEligible && refunds > 0) {
        errors.push({
          field: 'refundsReceived',
          code: 'INELIGIBLE_BONUS_CATEGORY',
          message: `Category "${session.snapshot.category}" is not eligible for Ingredient Refund bonuses.`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Appends a confirmed crafting result event to the session ledger.
 * Pure and non-mutating: returns a newly computed CraftingSessionState.
 */
export function recordCraftingResult(
  session: CraftingSessionState,
  input: RecordCraftingResultInput
): CraftingSessionState {
  const validation = validateCraftingResultInput(session, input);
  if (!validation.isValid) {
    const firstErr = validation.errors[0];
    throw new Error(`Invalid crafting result: [${firstErr.code}] ${firstErr.message}`);
  }

  const family = getCraftingFamily(session.snapshot.familyId)!;
  const recipe = family.recipes.find((r) => r.id === input.recipeId)!;
  const sIdx = family.tiers.findIndex((t) => t.id === recipe.inputItemId);
  const tIdx = sIdx + 1;

  const ops = input.operationsPerformed;
  const baseOutput = ops * recipe.outputQty;
  const eventId = input.eventId ?? generateUUID();
  const timestamp = input.timestamp ?? Date.now();
  const bonusType = session.snapshot.bonusType;

  let totalOutputReceived = baseOutput;
  let bonusOutputReceived = 0;
  let refundsReceived = 0;

  if (bonusType === 'double_output') {
    if (input.totalOutputReceived !== undefined) {
      totalOutputReceived = input.totalOutputReceived;
      bonusOutputReceived = totalOutputReceived - baseOutput;
    } else if (input.bonusOutputReceived !== undefined) {
      bonusOutputReceived = input.bonusOutputReceived;
      totalOutputReceived = baseOutput + bonusOutputReceived;
    }
  } else if (bonusType === 'ingredient_refund') {
    refundsReceived = input.refundsReceived ?? 0;
  }

  const grossInputConsumed = ops * recipe.inputQty;
  const netInputConsumed = grossInputConsumed - refundsReceived;
  const moraSpent = ops * recipe.moraCost;

  const event: CraftingResultEvent = {
    eventId,
    timestamp,
    recipeId: recipe.id,
    recipeName: `${family.tiers[sIdx]?.name || recipe.inputItemId} → ${family.tiers[tIdx]?.name || recipe.outputItemId}`,
    sourceTierIndex: sIdx,
    targetTierIndex: tIdx,
    inputItemId: recipe.inputItemId,
    outputItemId: recipe.outputItemId,
    inputQtyPerCraft: recipe.inputQty,
    outputQtyPerCraft: recipe.outputQty,
    moraCostPerCraft: recipe.moraCost,
    bonusType,
    operationsPerformed: ops,
    totalOutputReceived,
    bonusOutputReceived,
    refundsReceived,
    grossInputConsumed,
    netInputConsumed,
    moraSpent,
    userNote: input.userNote,
  };

  const nextEvents = [...session.events, event];
  const nextLedger = replayCraftingSession(session.snapshot, nextEvents);
  const remaining = calculateRemainingSessionPlan(session.snapshot, nextLedger, nextEvents);

  return {
    sessionId: session.sessionId,
    snapshot: session.snapshot,
    events: nextEvents,
    ledger: nextLedger,
    remainingPlan: remaining.remainingPlan,
    remainingForecast: remaining.remainingForecast,
    nextRecommendedStep: remaining.nextRecommendedStep,
    updatedAt: timestamp,
  };
}

/**
 * Undoes the most recently recorded crafting result event.
 * Pure and non-mutating: returns a newly computed CraftingSessionState.
 */
export function undoLastCraftingResult(
  session: CraftingSessionState
): CraftingSessionState {
  if (session.events.length === 0) {
    return session;
  }

  const nextEvents = session.events.slice(0, -1);
  const nextLedger = replayCraftingSession(session.snapshot, nextEvents);
  const remaining = calculateRemainingSessionPlan(session.snapshot, nextLedger, nextEvents);

  return {
    sessionId: session.sessionId,
    snapshot: session.snapshot,
    events: nextEvents,
    ledger: nextLedger,
    remainingPlan: remaining.remainingPlan,
    remainingForecast: remaining.remainingForecast,
    nextRecommendedStep: remaining.nextRecommendedStep,
    updatedAt: Date.now(),
  };
}
