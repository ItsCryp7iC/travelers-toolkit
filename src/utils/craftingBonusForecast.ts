import {
  CRAFTING_FAMILIES,
  CraftingCategory,
  CraftingFamily,
} from '../data/craftingRecipes';
import {
  CraftingBonusType,
  DEFAULT_CRAFTING_BONUS_TYPE,
  isBonusEligibleCategory,
} from '../data/craftingBonuses';
import { CraftingPlanResult } from './craftingEngine';

export interface CraftingBonusOptions {
  enabled: boolean;
  bonusType?: CraftingBonusType;
}

/**
 * Detailed optimization statistics for an individual crafting recipe step.
 */
export interface OptimizedCraftingStep {
  recipeId: string;
  familyId: string;
  category: CraftingCategory;
  sourceTierIndex: number;
  targetTierIndex: number;
  inputItemId: string;
  inputItemName: string;
  inputQty: number; // 3
  outputItemId: string;
  outputItemName: string;
  outputQty: number; // 1
  moraCostPerCraft: number;

  // A. Guaranteed baseline (from CRAFT-B)
  guaranteedCrafts: number;
  guaranteedOutput: number;
  guaranteedGrossInputConsumed: number;
  guaranteedMoraCost: number;

  // B. Expected bonus-aware total
  expectedCrafts: number;
  expectedOutput: number;
  expectedBonusOutput: number;
  expectedIngredientRefunds: number;
  expectedGrossInputConsumed: number;
  expectedNetInputConsumed: number;
  expectedMoraCost: number;

  // C. Suggested conservative initial batch & actionable guidance
  suggestedInitialBatch: number; // Recommended actionable batch (backward compatible)
  safeInitialBatch: number; // Statistically satisfies specified threshold (e.g. 0 for d = 1)
  recommendedActionBatch: number; // Feasible action batch (e.g. 1 for d = 1)
  isActionFallback: boolean; // True when safeInitialBatch is 0 and action fallback is used
  initialBatchNote: string;

  // D. Multi-tier executable batch safety & dependency tracking (CRAFT-D4-A.4)
  isConditional: boolean; // True when step depends on materials from earlier steps
  priorStepIndex: number | null; // Index of preceding step providing input materials, or null
  immediatelyExecutableCrafts: number; // Maximum crafts executable right now from physical inventory
  guaranteedAvailableCrafts: number; // Maximum crafts executable after earlier steps complete their recommended batch
  currentlyOwnedIngredients: number; // Raw owned inventory of input item
  directIngredientRequirement: number; // Direct requirement for input item (reserved)
  accessibleIngredients: number; // Guaranteed accessible ingredients before starting this batch
  firstBatchIngredients: number; // Gross ingredients required to begin suggested 1st batch
  firstBatchMora: number; // Mora fee required to execute suggested 1st batch
}

export interface InitialBatchResult {
  batch: number; // Recommended actionable batch (backward compatible)
  safeInitialBatch: number; // Statistically satisfies specified threshold
  recommendedActionBatch: number; // Feasible action batch
  isActionFallback: boolean; // True when safeInitialBatch is 0 and action fallback is used
  note: string;
}

export interface FamilyCraftingForecast {
  familyId: string;
  category: CraftingCategory;
  familyName: string;
  isEligible: boolean;
  isCraftable: boolean;
  bonusType: CraftingBonusType | null;

  // Simulation execution details
  trials: number;
  coveredTrials: number;
  isAllSimulatedCovered: boolean;
  confidenceBound95: number;
  coverageDisplay: string;

  // Guaranteed baseline (from CRAFT-B)
  guaranteedShortages: Record<string, number>;
  totalGuaranteedShortage: number;
  guaranteedCraftingMora: number;
  guaranteedOperations: number[];
  guaranteedLeftovers: Record<string, number>;

  // Forecasted values
  expectedShortages: Record<string, number>;
  totalExpectedShortage: number;
  coverageProbability: number; // 0 to 1
  estimatedCraftingMora: number;
  estimatedMoraDifference: number; // guaranteedCraftingMora - estimatedCraftingMora
  sameDemandCovered: boolean; // true if guaranteed and forecast satisfy identical net demand
  estimatedMoraSavings: number; // preserved for backward compatibility
  estimatedOperations: number[];
  projectedInventory: Record<string, number>; // synonym for expectedLeftovers
  expectedLeftovers: Record<string, number>;
  expectedGrossConsumed: Record<string, number>;
  expectedNetConsumed: Record<string, number>;

  // Operation-level optimized steps
  optimizedSteps: OptimizedCraftingStep[];

  // Status flags
  isGuaranteedCovered: boolean;
  isLikelyCovered: boolean;
}

export interface ItemBonusForecast {
  itemId: string;
  familyId?: string;
  category?: string;
  isEligible: boolean;
  guaranteedShortage: number;
  expectedShortage: number;
  coverageProbability: number;
  likelyCovered: boolean;
}

export interface CraftingBonusForecastResult {
  enabled: boolean;
  bonusType: CraftingBonusType;
  families: Record<string, FamilyCraftingForecast>;
  byItemId: Record<string, ItemBonusForecast>;
  byRecipeId: Record<string, OptimizedCraftingStep>;
  optimizedSteps: OptimizedCraftingStep[];
  expectedShortages: Record<string, number>;
  totalGuaranteedShortage: number;
  totalExpectedShortage: number;
  totalGuaranteedCraftingMora: number;
  totalEstimatedCraftingMora: number;
  totalEstimatedMoraSavings: number;
  estimatedTotalMora: number;
  estimatedTotalMoraSavings: number;
  estimatedTotalOperations: number;
  overallCoverageProbability: number;
  coverageDisplay: string;
  sameDemandCovered: boolean;
  allLikelyCovered: boolean;
  allSimulatedCovered: boolean;
  isGuaranteed: false;
}

/**
 * High-performance, deterministic 32-bit PRNG (Mulberry32).
 */
export function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a stable integer seed from a string identifier.
 */
export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Standard Normal Box-Muller sample.
 */
export function sampleNormal(rng: () => number): number {
  const u1 = Math.max(1e-15, rng());
  const u2 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Fast Binomial sampling with exact Bernoulli loop for n <= 1000
 * and continuity-corrected Gaussian for very large n > 1000.
 */
export function sampleBinomial(n: number, p: number, rng: () => number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n === 1) return rng() < p ? 1 : 0;
  if (n === 2) return (rng() < p ? 1 : 0) + (rng() < p ? 1 : 0);
  if (n === 3) return (rng() < p ? 1 : 0) + (rng() < p ? 1 : 0) + (rng() < p ? 1 : 0);

  if (n <= 1000) {
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (rng() < p) count++;
    }
    return count;
  }

  // Gaussian approximation with continuity correction for very large n > 1000
  const mean = n * p;
  const std = Math.sqrt(n * p * (1 - p));
  const z = sampleNormal(rng);
  const sample = Math.round(mean + z * std);
  return Math.max(0, Math.min(n, sample));
}

/**
 * Computes Wilson score 95% lower confidence bound for a binomial proportion.
 * For k successes in n trials, z = 1.95996 (~1.96).
 */
export function calculateWilsonScoreLowerBound(k: number, n: number, z: number = 1.95996): number {
  if (n <= 0) return 0;
  const p = k / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centerAdjusted = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  const lower = (centerAdjusted - spread) / denominator;
  return Math.max(0, Math.min(1, Number(lower.toFixed(4))));
}

/**
 * Formats coverage probability display without false empirical certainty.
 */
export function formatCoverageDisplay(
  coveredTrials: number,
  trials: number,
  isEligible: boolean,
  isGuaranteedCovered: boolean
): string {
  if (isGuaranteedCovered) {
    return '100% (guaranteed baseline)';
  }
  if (!isEligible) {
    return '0% (bonus ineligible)';
  }
  if (coveredTrials === trials) {
    return `All ${trials} simulated runs covered requirement (>99% est.)`;
  }
  if (coveredTrials === 0) {
    return `0% coverage across ${trials} simulated runs`;
  }
  const pct = Math.round((coveredTrials / trials) * 100);
  return `~${pct}% est. coverage (${coveredTrials}/${trials} simulated runs)`;
}

/**
 * Numerically stable, exact Binomial CDF: P(X <= k) for X ~ Binomial(n, p).
 * Uses mode-centered unnormalized weights to prevent arithmetic overflow and underflow,
 * even for very large n (e.g. n > 10,000).
 */
export function calculateBinomialCdf(n: number, p: number, k: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  if (n <= 0) return 1;

  // Mode of Binomial(n, p)
  const mode = Math.floor((n + 1) * p);
  const factorUp = p / (1 - p);
  const factorDown = (1 - p) / p;

  let sumTotal = 1.0;
  let sumK = mode <= k ? 1.0 : 0.0;

  // Downward pass from mode - 1 down to 0
  let currentW = 1.0;
  for (let i = mode - 1; i >= 0; i--) {
    currentW *= ((i + 1) / (n - i)) * factorDown;
    if (currentW < 1e-18 * sumTotal && i < k) break;
    sumTotal += currentW;
    if (i <= k) sumK += currentW;
  }

  // Upward pass from mode + 1 up to n
  currentW = 1.0;
  for (let i = mode + 1; i <= n; i++) {
    currentW *= ((n - i + 1) / i) * factorUp;
    if (currentW < 1e-18 * sumTotal && i > k) break;
    sumTotal += currentW;
    if (i <= k) sumK += currentW;
  }

  return Math.min(1, Math.max(0, sumK / sumTotal));
}

/**
 * Finds the largest integer batch n such that:
 * P(Binomial(n, p) <= targetDemand - n) >= threshold (0.95).
 * Uses binary search over [1, targetDemand] with exact binomial CDF evaluation.
 */
export function findMaxInitialBatchDoubleOutput(
  targetDemand: number,
  p: number = 0.10,
  threshold: number = 0.95
): number {
  if (targetDemand <= 0) return 0;

  let low = 1;
  let high = targetDemand;
  let best = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const k = targetDemand - mid;
    const prob = calculateBinomialCdf(mid, p, k);
    if (prob >= threshold) {
      best = mid;
      low = mid + 1; // Try larger batch
    } else {
      high = mid - 1; // Overshoot risk too high
    }
  }

  return best;
}

/**
 * Calculates a conservative initial crafting batch to minimize overshooting
 * the target requirement before checking actual game bench output.
 *
 * For 10% Double Output:
 * Uses exact Binomial CDF to find the largest integer batch b such that
 * P(b + Binomial(b, 0.10) <= targetDemand) >= 0.95,
 * bounded by ingredient availability and expected crafts.
 *
 * When targetDemand = 1, statistical safeInitialBatch is 0 (since 1 craft has a 10%
 * overshoot risk, achieving only 90% non-overshoot confidence).
 * In this edge case, an actionable fallback batch of 1 is recommended with explicit
 * disclosure of the 10% residual risk ("Craft 1 to finish. There is a 10% chance of receiving 1 extra item.").
 *
 * For 25% Ingredient Refund:
 * Each craft produces exactly 1 output (no bonus output per craft).
 * Crafts the net requirement bounded by available inventory,
 * without planning speculative future refunds that haven't occurred yet.
 */
export function calculateConservativeInitialBatch(
  targetDemand: number,
  maxPossibleCrafts: number,
  bonusType: CraftingBonusType | null,
  expectedCrafts: number
): InitialBatchResult {
  if (targetDemand <= 0 || maxPossibleCrafts <= 0 || expectedCrafts <= 0) {
    return {
      batch: 0,
      safeInitialBatch: 0,
      recommendedActionBatch: 0,
      isActionFallback: false,
      note: 'No crafting required',
    };
  }

  if (bonusType === 'ingredient_refund') {
    // Each craft produces exactly 1 product.
    // Initial batch crafts the net requirement bounded by available inventory,
    // without planning speculative future refunds that haven't occurred yet.
    const flooredExp = Math.max(1, Math.floor(expectedCrafts));
    const b = Math.min(targetDemand, maxPossibleCrafts, flooredExp);
    return {
      batch: b,
      safeInitialBatch: b,
      recommendedActionBatch: b,
      isActionFallback: false,
      note: 'Craft net requirement; recycled refunds will fulfill remaining deficit',
    };
  }

  if (bonusType === 'double_output') {
    const safeBatch = findMaxInitialBatchDoubleOutput(targetDemand, 0.10, 0.95);
    const flooredExp = Math.max(1, Math.floor(expectedCrafts));
    const clampedSafe = Math.min(safeBatch, maxPossibleCrafts, flooredExp);

    if (clampedSafe > 0) {
      return {
        batch: clampedSafe,
        safeInitialBatch: clampedSafe,
        recommendedActionBatch: clampedSafe,
        isActionFallback: false,
        note: 'Conservative 95% non-overshoot batch; check inventory before crafting remainder',
      };
    }

    // When safeBatch is 0 (e.g. d = 1 where P(1 + X <= 1) = 0.90 < 0.95):
    // Fall back to actionable guidance with explicit residual risk disclosure.
    const actionBatch = Math.min(1, maxPossibleCrafts);
    if (actionBatch > 0) {
      return {
        batch: actionBatch,
        safeInitialBatch: 0,
        recommendedActionBatch: actionBatch,
        isActionFallback: true,
        note: 'Craft 1 to finish. There is a 10% chance of receiving 1 extra item.',
      };
    }

    return {
      batch: 0,
      safeInitialBatch: 0,
      recommendedActionBatch: 0,
      isActionFallback: false,
      note: '0 crafts currently executable; awaiting ingredients from earlier steps',
    };
  }

  const flooredExp = Math.max(1, Math.floor(expectedCrafts));
  const b = Math.min(targetDemand, maxPossibleCrafts, flooredExp);
  return {
    batch: b,
    safeInitialBatch: b,
    recommendedActionBatch: b,
    isActionFallback: false,
    note: 'Guaranteed 3:1 batch',
  };
}

export const DEFAULT_TRIALS = 500;

// High-performance LRU / bounded memoization cache for forecast results
const FORECAST_CACHE = new Map<string, FamilyCraftingForecast>();
const MAX_CACHE_SIZE = 1000;

/**
 * Clears the forecast cache. Useful for test isolation.
 */
export function clearForecastCache(): void {
  FORECAST_CACHE.clear();
}

/**
 * Runs a pure, deterministic multi-tier adaptive simulation for a single material family.
 */
export function forecastFamilyCrafting(
  family: CraftingFamily,
  grossRequirements: Record<string, number>,
  inventory: Record<string, number>,
  bonusType: CraftingBonusType | null,
  options: { trials?: number; seed?: number } = {}
): FamilyCraftingForecast {
  const tiers = family.tiers;
  const numTiers = tiers.length;
  const isEligible = bonusType !== null && isBonusEligibleCategory(family.category, bonusType);
  const activeBonusType = isEligible ? bonusType : null;

  const reqs = tiers.map((t) => Math.max(0, Number(grossRequirements[t.id]) || 0));
  const invs = tiers.map((t) => Math.max(0, Number(inventory[t.id]) || 0));
  const moraCosts = (family.recipes || []).map((r) => r.moraCost);

  // Memoization lookup key
  const TRIALS = options.trials ?? DEFAULT_TRIALS;
  const baseSeed = options.seed ?? (hashString(family.familyId) ^ 0x5a17e0b5);
  const cacheKey = `${family.familyId}:${activeBonusType || 'none'}:${TRIALS}:${baseSeed}:${reqs.join(',')}:${invs.join(',')}`;

  const cached = FORECAST_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Direct reservation: physical inventory is first reserved against direct demand
  const directReserved = tiers.map((_, i) => Math.min(invs[i], reqs[i]));
  const directDeficit = tiers.map((_, i) => reqs[i] - directReserved[i]);
  const availableSurplus = tiers.map((_, i) => invs[i] - directReserved[i]);

  // 2. Canonical CRAFT-B baseline allocation (pure deterministic)
  const guarDeficit = [...directDeficit];
  const guarSurplus = [...availableSurplus];
  const guaranteedCrafts = new Array(numTiers - 1).fill(0);
  let guaranteedMora = 0;

  if (family.isCraftable && numTiers > 1) {
    for (let target = numTiers - 1; target >= 1; target--) {
      if (guarDeficit[target] <= 0) continue;

      let avail = 0;
      for (let j = 0; j < target; j++) {
        avail = Math.floor((avail + guarSurplus[j]) / 3);
      }

      const unitsToCraft = Math.min(guarDeficit[target], avail);
      if (unitsToCraft <= 0) continue;

      let neededFromBelow = unitsToCraft * 3;
      guaranteedCrafts[target - 1] += unitsToCraft;
      guarDeficit[target] -= unitsToCraft;
      guaranteedMora += unitsToCraft * moraCosts[target - 1];

      for (let j = target - 1; j >= 0; j--) {
        const fromCurrentSurplus = Math.min(neededFromBelow, guarSurplus[j]);
        guarSurplus[j] -= fromCurrentSurplus;
        neededFromBelow -= fromCurrentSurplus;

        if (j > 0 && neededFromBelow > 0) {
          guaranteedCrafts[j - 1] += neededFromBelow;
          guaranteedMora += neededFromBelow * moraCosts[j - 1];
          neededFromBelow = neededFromBelow * 3;
        }
      }
    }
  }

  const guaranteedShortagesMap: Record<string, number> = {};
  const guaranteedLeftoversMap: Record<string, number> = {};
  tiers.forEach((t, i) => {
    guaranteedShortagesMap[t.id] = guarDeficit[i];
    guaranteedLeftoversMap[t.id] = guarSurplus[i];
  });
  const totalGuaranteedShortage = guarDeficit.reduce((a, b) => a + b, 0);
  const isGuaranteedCovered = totalGuaranteedShortage === 0;

  // Build baseline steps
  const buildBaselineSteps = (): OptimizedCraftingStep[] => {
    if (!family.isCraftable || numTiers <= 1) return [];
    const baselineProjectedStock = [...invs];
    return (family.recipes || []).map((recipe, s) => {
      const count = guaranteedCrafts[s] || 0;
      const ownedUnreserved = Math.max(0, invs[s] - reqs[s]);
      const immediatelyExecutable = Math.floor(ownedUnreserved / 3);
      const accessible = Math.max(0, baselineProjectedStock[s] - reqs[s]);
      const guaranteedAvailable = Math.floor(accessible / 3);

      const initialBatchInfo = calculateConservativeInitialBatch(count, count, null, count);
      const batch = initialBatchInfo.recommendedActionBatch;

      // Update projected stock for next step
      baselineProjectedStock[s] -= batch * 3;
      if (s + 1 < numTiers) {
        baselineProjectedStock[s + 1] += batch;
      }

      return {
        recipeId: recipe.id,
        familyId: family.familyId,
        category: family.category,
        sourceTierIndex: s,
        targetTierIndex: s + 1,
        inputItemId: recipe.inputItemId,
        inputItemName: family.tiers[s]?.name || recipe.inputItemId,
        inputQty: 3,
        outputItemId: recipe.outputItemId,
        outputItemName: family.tiers[s + 1]?.name || recipe.outputItemId,
        outputQty: 1,
        moraCostPerCraft: recipe.moraCost,
        guaranteedCrafts: count,
        guaranteedOutput: count,
        guaranteedGrossInputConsumed: count * 3,
        guaranteedMoraCost: count * recipe.moraCost,
        expectedCrafts: count,
        expectedOutput: count,
        expectedBonusOutput: 0,
        expectedIngredientRefunds: 0,
        expectedGrossInputConsumed: count * 3,
        expectedNetInputConsumed: count * 3,
        expectedMoraCost: count * recipe.moraCost,
        suggestedInitialBatch: batch,
        safeInitialBatch: initialBatchInfo.safeInitialBatch,
        recommendedActionBatch: batch,
        isActionFallback: initialBatchInfo.isActionFallback || false,
        initialBatchNote: initialBatchInfo.note,
        isConditional: s > 0 && ownedUnreserved < batch * 3,
        priorStepIndex: s > 0 ? s - 1 : null,
        immediatelyExecutableCrafts: immediatelyExecutable,
        guaranteedAvailableCrafts: guaranteedAvailable,
        currentlyOwnedIngredients: invs[s],
        directIngredientRequirement: reqs[s],
        accessibleIngredients: accessible,
        firstBatchIngredients: batch * 3,
        firstBatchMora: batch * recipe.moraCost,
      };
    });
  };

  // If family is not eligible, not craftable, or bonus is disabled, forecast matches guaranteed baseline
  const hasCraftableSurplus = availableSurplus.slice(0, numTiers - 1).some((s) => s >= 3);
  if (!isEligible || !family.isCraftable || numTiers <= 1 || (!hasCraftableSurplus && guaranteedCrafts.every((c) => c === 0))) {
    const baseSteps = buildBaselineSteps();
    const grossConsumed: Record<string, number> = {};
    const netConsumed: Record<string, number> = {};
    tiers.forEach((t, i) => {
      grossConsumed[t.id] = i < numTiers - 1 ? guaranteedCrafts[i] * 3 : 0;
      netConsumed[t.id] = grossConsumed[t.id];
    });

    return {
      familyId: family.familyId,
      category: family.category,
      familyName: family.name,
      isEligible: isEligible && family.isCraftable && numTiers > 1,
      isCraftable: family.isCraftable,
      bonusType: null,
      trials: 0,
      coveredTrials: 0,
      isAllSimulatedCovered: false,
      confidenceBound95: isGuaranteedCovered ? 1.0 : 0.0,
      coverageDisplay: isGuaranteedCovered ? '100% (guaranteed baseline)' : '0% (bonus ineligible)',
      guaranteedShortages: guaranteedShortagesMap,
      totalGuaranteedShortage,
      guaranteedCraftingMora: guaranteedMora,
      guaranteedOperations: guaranteedCrafts,
      guaranteedLeftovers: guaranteedLeftoversMap,
      expectedShortages: guaranteedShortagesMap,
      totalExpectedShortage: totalGuaranteedShortage,
      coverageProbability: isGuaranteedCovered ? 1 : 0,
      estimatedCraftingMora: guaranteedMora,
      estimatedMoraDifference: 0,
      sameDemandCovered: true,
      estimatedMoraSavings: 0,
      estimatedOperations: guaranteedCrafts,
      projectedInventory: guaranteedLeftoversMap,
      expectedLeftovers: guaranteedLeftoversMap,
      expectedGrossConsumed: grossConsumed,
      expectedNetConsumed: netConsumed,
      optimizedSteps: baseSteps,
      isGuaranteedCovered,
      isLikelyCovered: isGuaranteedCovered,
    };
  }

  // 3. Deterministic Monte Carlo Simulation with Adaptive Multi-Tier Optimization
  const rng = createMulberry32(baseSeed);

  const sumShortage = new Array(numTiers).fill(0);
  const sumSurplus = new Array(numTiers).fill(0);
  const sumCrafts = new Array(numTiers - 1).fill(0);
  const sumBonusOutputs = new Array(numTiers - 1).fill(0);
  const sumRefunds = new Array(numTiers - 1).fill(0);
  let sumMora = 0;
  let coveredTrials = 0;

  const deficit = new Array(numTiers).fill(0);
  const surplus = new Array(numTiers).fill(0);
  const trialCrafts = new Array(numTiers - 1).fill(0);
  const trialBonusOutputs = new Array(numTiers - 1).fill(0);
  const trialRefunds = new Array(numTiers - 1).fill(0);

  for (let trial = 0; trial < TRIALS; trial++) {
    for (let i = 0; i < numTiers; i++) {
      deficit[i] = directDeficit[i];
      surplus[i] = availableSurplus[i];
    }
    for (let i = 0; i < numTiers - 1; i++) {
      trialCrafts[i] = 0;
      trialBonusOutputs[i] = 0;
      trialRefunds[i] = 0;
    }
    let trialMora = 0;

    // Satisfy higher tier deficits down to tier 1
    for (let target = numTiers - 1; target >= 1; target--) {
      while (deficit[target] > 0) {
        let promoted = false;
        for (let s = 0; s < target; s++) {
          if (surplus[s] >= 3) {
            const maxC = Math.floor(surplus[s] / 3);
            const neededNext =
              s + 1 === target
                ? deficit[target]
                : Math.max(deficit[s + 1], Math.min(27, deficit[target] * 3));
            const batch = Math.min(neededNext, maxC);

            if (batch > 0) {
              promoted = true;
              trialCrafts[s] += batch;
              surplus[s] -= batch * 3;
              trialMora += batch * moraCosts[s];

              let procs = 0;
              let refunds = 0;
              if (activeBonusType === 'double_output') {
                procs = sampleBinomial(batch, 0.1, rng);
              } else if (activeBonusType === 'ingredient_refund') {
                refunds = sampleBinomial(batch, 0.25, rng);
                surplus[s] += refunds;
              }

              trialBonusOutputs[s] += procs;
              trialRefunds[s] += refunds;

              const totalProduced = batch + procs;
              if (deficit[s + 1] > 0) {
                const sat = Math.min(deficit[s + 1], totalProduced);
                deficit[s + 1] -= sat;
                surplus[s + 1] += totalProduced - sat;
              } else {
                surplus[s + 1] += totalProduced;
              }
            }
          }
        }
        if (!promoted) break;
      }
    }

    // Satisfy any remaining direct deficits in lower tiers (e.g. tier 1)
    for (let target = numTiers - 2; target >= 1; target--) {
      while (deficit[target] > 0) {
        let promoted = false;
        for (let s = target - 1; s >= 0; s--) {
          if (surplus[s] >= 3) {
            const batch = Math.min(deficit[target], Math.floor(surplus[s] / 3));
            if (batch > 0) {
              trialCrafts[s] += batch;
              surplus[s] -= batch * 3;
              trialMora += batch * moraCosts[s];

              let procs = 0;
              let refunds = 0;
              if (activeBonusType === 'double_output') {
                procs = sampleBinomial(batch, 0.1, rng);
              } else if (activeBonusType === 'ingredient_refund') {
                refunds = sampleBinomial(batch, 0.25, rng);
                surplus[s] += refunds;
              }

              trialBonusOutputs[s] += procs;
              trialRefunds[s] += refunds;

              const totalProduced = batch + procs;
              const sat = Math.min(deficit[target], totalProduced);
              deficit[target] -= sat;
              surplus[target] += totalProduced - sat;
              promoted = true;
            }
          }
        }
        if (!promoted) break;
      }
    }

    const trialTotalShortage = deficit.reduce((a, b) => a + b, 0);
    if (trialTotalShortage === 0) coveredTrials++;

    for (let i = 0; i < numTiers; i++) {
      sumShortage[i] += deficit[i];
      sumSurplus[i] += surplus[i];
    }
    for (let i = 0; i < numTiers - 1; i++) {
      sumCrafts[i] += trialCrafts[i];
      sumBonusOutputs[i] += trialBonusOutputs[i];
      sumRefunds[i] += trialRefunds[i];
    }
    sumMora += trialMora;
  }

  // 4. Aggregate Expected Statistics
  const expectedShortagesMap: Record<string, number> = {};
  const projectedInventoryMap: Record<string, number> = {};
  const grossConsumedMap: Record<string, number> = {};
  const netConsumedMap: Record<string, number> = {};

  tiers.forEach((t, i) => {
    expectedShortagesMap[t.id] = Number((sumShortage[i] / TRIALS).toFixed(2));
    projectedInventoryMap[t.id] = Number((sumSurplus[i] / TRIALS).toFixed(1));
    if (i < numTiers - 1) {
      const meanC = sumCrafts[i] / TRIALS;
      const meanR = sumRefunds[i] / TRIALS;
      grossConsumedMap[t.id] = Number((meanC * 3).toFixed(1));
      netConsumedMap[t.id] = Number((meanC * 3 - meanR).toFixed(1));
    } else {
      grossConsumedMap[t.id] = 0;
      netConsumedMap[t.id] = 0;
    }
  });

  const totalExpectedShortage = Number(
    (sumShortage.reduce((a, b) => a + b, 0) / TRIALS).toFixed(2)
  );
  const coverageProbability = Number((coveredTrials / TRIALS).toFixed(3));
  const isAllSimulatedCovered = coveredTrials === TRIALS;
  const confidenceBound95 = calculateWilsonScoreLowerBound(coveredTrials, TRIALS);
  const coverageDisplay = formatCoverageDisplay(
    coveredTrials,
    TRIALS,
    isEligible,
    isGuaranteedCovered
  );

  const estimatedCraftingMora = Math.round(sumMora / TRIALS);
  const estimatedMoraDifference = guaranteedMora - estimatedCraftingMora;
  const sameDemandCovered = totalGuaranteedShortage === totalExpectedShortage;
  const estimatedMoraSavings = Math.max(0, estimatedMoraDifference);
  const estimatedOperations = sumCrafts.map((c) => Number((c / TRIALS).toFixed(1)));

  // Build Operation-Level Optimized Steps
  // Calculate top-down bonus-aware target demand for each crafting step
  const stepTargetDemands = new Array(numTiers - 1).fill(0);
  if (family.isCraftable && numTiers > 1) {
    const tierDeficit = tiers.map((_, i) => Math.max(0, reqs[i] - invs[i]));
    const tierSurplus = tiers.map((_, i) => Math.max(0, invs[i] - reqs[i]));

    for (let s = numTiers - 2; s >= 0; s--) {
      const targetTier = s + 1;
      const targetD = tierDeficit[targetTier];

      if (targetD <= 0) {
        stepTargetDemands[s] = 0;
        continue;
      }

      stepTargetDemands[s] = targetD;

      let craftsForTarget = targetD;
      if (activeBonusType === 'double_output') {
        craftsForTarget = Math.round(targetD / 1.1);
      } else if (activeBonusType === 'ingredient_refund') {
        craftsForTarget = targetD;
      }

      let netIngredients = craftsForTarget * 3;
      if (activeBonusType === 'ingredient_refund') {
        netIngredients -= Math.round(craftsForTarget * 0.25);
      }

      if (tierSurplus[s] >= netIngredients) {
        tierSurplus[s] -= netIngredients;
      } else {
        const remainingNeed = netIngredients - tierSurplus[s];
        tierSurplus[s] = 0;
        tierDeficit[s] += remainingNeed;
      }
    }
  }

  const projectedGuaranteedStock = [...invs];

  const optimizedSteps: OptimizedCraftingStep[] = (family.recipes || []).map((recipe, s) => {
    const meanCrafts = sumCrafts[s] / TRIALS;
    const meanBonus = sumBonusOutputs[s] / TRIALS;
    const meanRefund = sumRefunds[s] / TRIALS;
    const guarC = guaranteedCrafts[s] || 0;

    // Target demand served by this recipe step
    const targetDemand =
      activeBonusType === null
        ? guarC
        : (stepTargetDemands[s] || Math.round(meanCrafts + meanBonus));

    const ownedUnreserved = Math.max(0, invs[s] - reqs[s]);
    const immediatelyExecutableCrafts = Math.floor(ownedUnreserved / 3);

    // Guaranteed accessible ingredients before starting step s:
    // Unreserved physical inventory plus guaranteed 1:1 output from earlier recommended batches
    const accessibleIngredients = Math.max(0, projectedGuaranteedStock[s] - reqs[s]);
    const guaranteedAvailableCrafts = Math.floor(accessibleIngredients / 3);

    // Initial batch bound:
    // For 25% Refund:
    // At s = 0, net ingredient cost is ~2.25 per craft over time with refunds.
    // At s > 0, initial batch must strictly clamp to immediately executable operations
    // from guaranteed available ingredients: floor(accessible / 3).
    // For 10% Double Output and baseline:
    // Preserves exact 95% non-overshoot batch policy and baseline demand.
    let maxPossibleCrafts: number;
    if (activeBonusType === 'ingredient_refund') {
      if (s === 0) {
        maxPossibleCrafts = Math.max(targetDemand, Math.floor(accessibleIngredients / 2.25));
      } else {
        maxPossibleCrafts = guaranteedAvailableCrafts;
      }
    } else {
      maxPossibleCrafts = targetDemand;
    }

    const initialBatchInfo = calculateConservativeInitialBatch(
      targetDemand,
      maxPossibleCrafts,
      activeBonusType,
      meanCrafts
    );

    const batch = initialBatchInfo.recommendedActionBatch;

    // Update projected guaranteed stock for subsequent steps:
    // Deduct gross ingredients consumed by this batch: batch * 3
    // Add ONLY guaranteed 1:1 output produced by this batch: batch * 1
    // (Stochastic bonus outputs and future refunds are strictly excluded)
    projectedGuaranteedStock[s] -= batch * 3;
    if (s + 1 < numTiers) {
      projectedGuaranteedStock[s + 1] += batch;
    }

    const isConditional = s > 0 && ownedUnreserved < batch * 3;
    const firstBatchIngredients = batch * 3;
    const firstBatchMora = batch * recipe.moraCost;

    return {
      recipeId: recipe.id,
      familyId: family.familyId,
      category: family.category,
      sourceTierIndex: s,
      targetTierIndex: s + 1,
      inputItemId: recipe.inputItemId,
      inputItemName: family.tiers[s]?.name || recipe.inputItemId,
      inputQty: 3,
      outputItemId: recipe.outputItemId,
      outputItemName: family.tiers[s + 1]?.name || recipe.outputItemId,
      outputQty: 1,
      moraCostPerCraft: recipe.moraCost,
      guaranteedCrafts: guarC,
      guaranteedOutput: guarC,
      guaranteedGrossInputConsumed: guarC * 3,
      guaranteedMoraCost: guarC * recipe.moraCost,
      expectedCrafts: Number(meanCrafts.toFixed(1)),
      expectedOutput: Number((meanCrafts + meanBonus).toFixed(1)),
      expectedBonusOutput: Number(meanBonus.toFixed(1)),
      expectedIngredientRefunds: Number(meanRefund.toFixed(1)),
      expectedGrossInputConsumed: Number((meanCrafts * 3).toFixed(1)),
      expectedNetInputConsumed: Number((meanCrafts * 3 - meanRefund).toFixed(1)),
      expectedMoraCost: Math.round(meanCrafts * recipe.moraCost),
      suggestedInitialBatch: batch,
      safeInitialBatch: initialBatchInfo.safeInitialBatch,
      recommendedActionBatch: batch,
      isActionFallback: initialBatchInfo.isActionFallback || false,
      initialBatchNote: initialBatchInfo.note,
      isConditional,
      priorStepIndex: s > 0 ? s - 1 : null,
      immediatelyExecutableCrafts,
      guaranteedAvailableCrafts,
      currentlyOwnedIngredients: invs[s],
      directIngredientRequirement: reqs[s],
      accessibleIngredients,
      firstBatchIngredients,
      firstBatchMora,
    };
  });

  const isLikelyCovered =
    isGuaranteedCovered || totalExpectedShortage === 0 || coverageProbability >= 0.95;

  const result: FamilyCraftingForecast = {
    familyId: family.familyId,
    category: family.category,
    familyName: family.name,
    isEligible: true,
    isCraftable: family.isCraftable,
    bonusType: activeBonusType,
    trials: TRIALS,
    coveredTrials,
    isAllSimulatedCovered,
    confidenceBound95,
    coverageDisplay,
    guaranteedShortages: guaranteedShortagesMap,
    totalGuaranteedShortage,
    guaranteedCraftingMora: guaranteedMora,
    guaranteedOperations: guaranteedCrafts,
    guaranteedLeftovers: guaranteedLeftoversMap,
    expectedShortages: expectedShortagesMap,
    totalExpectedShortage,
    coverageProbability,
    estimatedCraftingMora,
    estimatedMoraDifference,
    sameDemandCovered,
    estimatedMoraSavings,
    estimatedOperations,
    projectedInventory: projectedInventoryMap,
    expectedLeftovers: projectedInventoryMap,
    expectedGrossConsumed: grossConsumedMap,
    expectedNetConsumed: netConsumedMap,
    optimizedSteps,
    isGuaranteedCovered,
    isLikelyCovered,
  };

  if (FORECAST_CACHE.size >= MAX_CACHE_SIZE) {
    FORECAST_CACHE.clear();
  }
  FORECAST_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Computes a complete bonus forecast across all crafting families and material requirements.
 */
export function forecastCraftingPlan(
  guaranteedPlan: CraftingPlanResult,
  grossRequirements: Record<string, unknown> = {},
  inventory: Record<string, unknown> = {},
  options: CraftingBonusOptions = { enabled: false, bonusType: DEFAULT_CRAFTING_BONUS_TYPE }
): CraftingBonusForecastResult {
  const enabled = !!options.enabled;
  const bonusType = options.bonusType ?? DEFAULT_CRAFTING_BONUS_TYPE;

  // Normalize inputs safely
  const normReq: Record<string, number> = {};
  for (const [k, v] of Object.entries(grossRequirements)) {
    normReq[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  const normInv: Record<string, number> = {};
  for (const [k, v] of Object.entries(inventory)) {
    normInv[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0;
  }

  const familiesResult: Record<string, FamilyCraftingForecast> = {};
  const byItemId: Record<string, ItemBonusForecast> = {};
  const byRecipeId: Record<string, OptimizedCraftingStep> = {};
  const allOptimizedSteps: OptimizedCraftingStep[] = [];

  let totalGuaranteedShortage = 0;
  let totalExpectedShortage = 0;
  let totalGuaranteedCraftingMora = 0;
  let totalEstimatedCraftingMora = 0;
  let totalEstimatedMoraSavings = 0;
  let weightedCoverageSum = 0;
  let familiesCount = 0;
  let allFamiliesSimulatedCovered = true;

  for (const family of CRAFTING_FAMILIES) {
    const forecast = forecastFamilyCrafting(
      family,
      normReq,
      normInv,
      enabled ? bonusType : null
    );

    familiesResult[family.familyId] = forecast;

    totalGuaranteedShortage += forecast.totalGuaranteedShortage;
    totalExpectedShortage += forecast.totalExpectedShortage;
    totalGuaranteedCraftingMora += forecast.guaranteedCraftingMora;
    totalEstimatedCraftingMora += forecast.estimatedCraftingMora;
    totalEstimatedMoraSavings += forecast.estimatedMoraSavings;

    if (forecast.totalGuaranteedShortage > 0 || forecast.totalExpectedShortage > 0) {
      weightedCoverageSum += forecast.coverageProbability;
      familiesCount++;
      if (!forecast.isAllSimulatedCovered && !forecast.isGuaranteedCovered) {
        allFamiliesSimulatedCovered = false;
      }
    }

    // Populate recipe-level and global step indices
    forecast.optimizedSteps.forEach((step) => {
      byRecipeId[step.recipeId] = step;
      allOptimizedSteps.push(step);
    });

    // Populate item-level forecast index
    family.tiers.forEach((tier) => {
      byItemId[tier.id] = {
        itemId: tier.id,
        familyId: family.familyId,
        category: family.category,
        isEligible: forecast.isEligible,
        guaranteedShortage: forecast.guaranteedShortages[tier.id] ?? 0,
        expectedShortage: forecast.expectedShortages[tier.id] ?? 0,
        coverageProbability: forecast.coverageProbability,
        likelyCovered: (forecast.expectedShortages[tier.id] ?? 0) === 0,
      };
    });
  }

  const overallCoverageProbability =
    familiesCount > 0 ? Number((weightedCoverageSum / familiesCount).toFixed(3)) : 1.0;

  const expectedShortagesMap: Record<string, number> = {};
  for (const [id, item] of Object.entries(byItemId)) {
    expectedShortagesMap[id] = item.expectedShortage;
  }

  const estimatedTotalOperations = Object.values(familiesResult).reduce(
    (sum, f) => sum + f.estimatedOperations.reduce((a, b) => a + b, 0),
    0
  );

  const totalGuarShortageFixed = Number(totalGuaranteedShortage.toFixed(2));
  const totalExpShortageFixed = Number(totalExpectedShortage.toFixed(2));
  const sameDemandCovered = totalGuarShortageFixed === totalExpShortageFixed;

  const coverageDisplay =
    totalGuarShortageFixed === 0
      ? '100% (guaranteed baseline)'
      : allFamiliesSimulatedCovered
      ? `All ${DEFAULT_TRIALS} simulated runs covered requirements (>99% est.)`
      : `~${Math.round(overallCoverageProbability * 100)}% est. coverage`;

  return {
    enabled,
    bonusType,
    families: familiesResult,
    byItemId,
    byRecipeId,
    optimizedSteps: allOptimizedSteps,
    expectedShortages: expectedShortagesMap,
    totalGuaranteedShortage: totalGuarShortageFixed,
    totalExpectedShortage: totalExpShortageFixed,
    totalGuaranteedCraftingMora,
    totalEstimatedCraftingMora,
    totalEstimatedMoraSavings,
    estimatedTotalMora: totalEstimatedCraftingMora,
    estimatedTotalMoraSavings: totalEstimatedMoraSavings,
    estimatedTotalOperations,
    overallCoverageProbability,
    coverageDisplay,
    sameDemandCovered,
    allLikelyCovered: totalExpectedShortage === 0,
    allSimulatedCovered: allFamiliesSimulatedCovered,
    isGuaranteed: false,
  };
}
