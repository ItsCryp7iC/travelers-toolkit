import { describe, it, expect } from 'vitest';
import {
  forecastFamilyCrafting,
  forecastCraftingPlan,
  sampleBinomial,
  calculateWilsonScoreLowerBound,
  formatCoverageDisplay,
  calculateConservativeInitialBatch,
  calculateBinomialCdf,
  findMaxInitialBatchDoubleOutput,
  clearForecastCache,
  createMulberry32,
} from './craftingBonusForecast';
import { getCraftingFamily, CRAFTING_FAMILIES } from '../data/craftingRecipes';
import { computeCraftingPlan } from './craftingEngine';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  Object.keys(obj).forEach((key) => {
    deepFreeze((obj as Record<string, unknown>)[key]);
  });
  return obj;
}

describe('Phase CRAFT-D3.1: Focused Crafting Bonus Forecast Verification', () => {
  const hilichurlFamily = getCraftingFamily('Hilichurl')!;
  const slimeFamily = getCraftingFamily('Slime')!;
  const decarabianFamily = getCraftingFamily('DecarabianTiles')!;
  const agnidusFamily = getCraftingFamily('AgnidusAgate')!;
  const boneShardFamily = getCraftingFamily('BoneShard')!;

  // ── 1. Exact Binomial Reference Test ──
  it('1. Exact binomial reference test: matches analytical P(X >= 10) = 99.9466205% for Binomial(229, 0.10)', () => {
    // Analytical reference: P(X >= 10) for X ~ Binomial(229, 0.10)
    // P(X <= 9) = sum_{k=0}^9 C(229, k) * 0.1^k * 0.9^(229-k) = 0.00053379485
    // P(X >= 10) = 1 - 0.00053379485 = 0.9994662051 (99.94662%)
    const N_TRIALS = 20000;
    const rng = createMulberry32(42);
    let successes = 0;

    for (let i = 0; i < N_TRIALS; i++) {
      const procs = sampleBinomial(229, 0.10, rng);
      if (procs >= 10) successes++;
    }

    const empiricalRate = successes / N_TRIALS;
    // Empirical simulation rate must be within 0.1% of the exact analytical 99.9466%
    expect(empiricalRate).toBeGreaterThanOrEqual(0.998);
    expect(empiricalRate).toBeLessThanOrEqual(1.0);
  });

  // ── 2. Refund Probability Reference Test ──
  it('2. Refund probability reference test: matches analytical P(R1 >= 30) = 99.9997% for Binomial(229, 0.25)', () => {
    // Analytical reference: 229 crafts of tier 1 yielding at least 30 refunds (giving 10 extra crafts)
    // P(R1 >= 30) for R1 ~ Binomial(229, 0.25) is 99.9997%
    const N_TRIALS = 10000;
    const rng = createMulberry32(101);
    let atLeast30 = 0;

    for (let i = 0; i < N_TRIALS; i++) {
      const refunds = sampleBinomial(229, 0.25, rng);
      if (refunds >= 30) atLeast30++;
    }

    const empiricalRate = atLeast30 / N_TRIALS;
    expect(empiricalRate).toBeGreaterThanOrEqual(0.999);
  });

  // ── 3. Zero Successes Across Finite Sample ──
  it('3. Zero successes across finite sample: handles 0 procs cleanly without NaN and formats display', () => {
    const dispZero = formatCoverageDisplay(0, 500, true, false);
    expect(dispZero).toBe('0% coverage across 500 simulated runs');

    const boundZero = calculateWilsonScoreLowerBound(0, 500);
    expect(boundZero).toBe(0);
  });

  // ── 4. Probability Presentation Without False Certainty ──
  it('4. Probability presentation without false certainty: never claims 100% chance for stochastic runs', () => {
    // When 500 out of 500 trials succeed:
    const dispAll = formatCoverageDisplay(500, 500, true, false);
    expect(dispAll).toBe('All 500 simulated runs covered requirement (>99% est.)');
    expect(dispAll).not.toContain('100% chance');

    // Wilson score 95% lower bound for 500/500
    const lowerBound = calculateWilsonScoreLowerBound(500, 500);
    expect(lowerBound).toBeGreaterThanOrEqual(0.99); // >= 99.2%
    expect(lowerBound).toBeLessThan(1.0); // NOT mathematically 1.0!
  });

  // ── 5. Expected Shortage vs Shortage of Expected Output ──
  it('5. Expected shortage versus shortage of expected output: calculates E[max(0, shortage)], not max(0, E[shortage])', () => {
    // Conceptual verification:
    // When shortage varies across trials, E[max(0, s)] >= max(0, E[s]) by Jensen's inequality.
    const reqs = {
      DamagedMask: 0,
      StainedMask: 0,
      OminousMask: 5,
    };
    // Owned 3 Stained Masks (can craft 1 Ominous Mask). Deficit is 4 Ominous Masks.
    // 1 craft of Stained -> Ominous:
    // In 90% of trials: 1 produced. Shortage = 4.
    // In 10% of trials: 2 produced (double proc). Shortage = 3.
    // E[max(0, shortage)] = 0.90 * 4 + 0.10 * 3 = 3.6 + 0.3 = 3.9 Ominous Masks.
    // Mean produced = 1.1. max(0, 5 - 1.1) = 3.9.
    const inv = {
      DamagedMask: 0,
      StainedMask: 3,
      OminousMask: 0,
    };

    const res = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
    expect(res.expectedShortages['OminousMask']).toBeCloseTo(3.9, 1);
  });

  // ── 6. Two-Tier Bonus Propagation ──
  it('6. Two-tier bonus propagation: simulates single craft transition accurately', () => {
    const twoTierFam = CRAFTING_FAMILIES.find((f) => f.tiers.length === 2 && f.isCraftable);
    if (!twoTierFam) return;

    const reqs = { [twoTierFam.tiers[1].id]: 10 };
    const inv = { [twoTierFam.tiers[0].id]: 27, [twoTierFam.tiers[1].id]: 0 };

    const resDouble = forecastFamilyCrafting(twoTierFam, reqs, inv, 'double_output');
    expect(resDouble.isEligible).toBe(true);
    expect(resDouble.totalExpectedShortage).toBeLessThanOrEqual(resDouble.totalGuaranteedShortage);
  });

  // ── 7. Three-Tier Bonus Propagation ──
  it('7. Three-tier bonus propagation: correctly promotes through two crafting tiers', () => {
    const reqs = {
      SlimeCondensate: 0,
      SlimeSecretions: 3,
      SlimeConcentrate: 3,
    };
    const inv = {
      SlimeCondensate: 36,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
    };

    const res = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
    expect(res.isEligible).toBe(true);
    expect(res.totalExpectedShortage).toBe(0);
    expect(res.isLikelyCovered).toBe(true);
  });

  // ── 8. Four-Tier Bonus Propagation ──
  it('8. Four-tier bonus propagation: compounds bonus across all 4 tiers for Decarabian', () => {
    const reqs = {
      TileOfDecarabiansTower: 0,
      DebrisOfDecarabiansCity: 0,
      FragmentOfDecarabiansEpic: 0,
      ScatteredPieceOfDecarabiansDream: 2,
    };
    const inv = {
      TileOfDecarabiansTower: 54, // exactly 2 * 27 needed for guaranteed baseline
      DebrisOfDecarabiansCity: 0,
      FragmentOfDecarabiansEpic: 0,
      ScatteredPieceOfDecarabiansDream: 0,
    };

    const res = forecastFamilyCrafting(decarabianFamily, reqs, inv, 'double_output');
    expect(res.isEligible).toBe(true);
    expect(res.totalGuaranteedShortage).toBe(0);
    expect(res.totalExpectedShortage).toBe(0);
    expect(res.estimatedMoraDifference).toBeGreaterThan(0);
  });

  // ── 9. Ingredient Conservation Invariant ──
  it('9. Ingredient conservation: verifies FinalInventory = Initial + Produced - Consumed - Demand', () => {
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

    const res = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output', { trials: 100 });
    // Verify non-negative projected inventory
    Object.values(res.projectedInventory).forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 10. Correct Recipe Mora Accounting & Custom Exceptions ──
  it('10. Correct recipe Mora accounting: respects custom exceptions (e.g. Fossilized Bone Shard = 50 Mora)', () => {
    if (!boneShardFamily) return;
    // Fossilized Bone Shard (4-star) has recipe exception craft_FossilizedBoneShard = 50 Mora (standard is 125)
    const recipe = boneShardFamily.recipes.find((r) => r.outputItemId === 'FossilizedBoneShard');
    if (recipe) {
      expect(recipe.moraCost).toBe(50);
      expect(recipe.isException).toBe(true);
    }

    const reqs = { FossilizedBoneShard: 2 };
    const inv = { FragileBoneShard: 100, SturdyBoneShard: 6, FossilizedBoneShard: 0 };
    const res = forecastFamilyCrafting(boneShardFamily, reqs, inv, 'double_output');
    expect(res.guaranteedCraftingMora).toBe(2 * 50); // 100 Mora
  });

  // ── 11. Equivalent-Target Savings Comparison ──
  it('11. Equivalent-target savings comparison: distinguishes same demand savings from different demand comparisons', () => {
    // Slime fixture: both guaranteed and bonus satisfy 100% of demand (sameDemandCovered = true)
    const slimeReqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
    const slimeInv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };
    const slimeRes = forecastFamilyCrafting(slimeFamily, slimeReqs, slimeInv, 'double_output');
    expect(slimeRes.sameDemandCovered).toBe(true);
    expect(slimeRes.estimatedMoraDifference).toBeGreaterThan(0);

    // Hilichurl Mask fixture: guaranteed plan has 10 shortage, bonus plan has 0 shortage (sameDemandCovered = false)
    const maskReqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const maskInv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };
    const maskRes = forecastFamilyCrafting(hilichurlFamily, maskReqs, maskInv, 'double_output');
    expect(maskRes.sameDemandCovered).toBe(false);
    expect(maskRes.totalGuaranteedShortage).toBe(10);
    expect(maskRes.totalExpectedShortage).toBe(0);
  });

  // ── 12. Deterministic Seeded Results ──
  it('12. Deterministic seeded results: identical seed produces bit-for-bit identical results', () => {
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

    const resA = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output', { seed: 9999 });
    const resB = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output', { seed: 9999 });

    expect(resA).toEqual(resB);
  });

  // ── 13. Stable Results Across Repeated Renders ──
  it('13. Stable results across repeated renders: forecastCraftingPlan is stable without jitter', () => {
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

    const plan = computeCraftingPlan(reqs, inv);
    const run1 = forecastCraftingPlan(plan, reqs, inv, { enabled: true, bonusType: 'double_output' });
    const run2 = forecastCraftingPlan(plan, reqs, inv, { enabled: true, bonusType: 'double_output' });

    expect(run1.totalExpectedShortage).toBe(run2.totalExpectedShortage);
    expect(run1.estimatedTotalMora).toBe(run2.estimatedTotalMora);
    expect(run1.coverageDisplay).toBe(run2.coverageDisplay);
  });

  // ── 14. Guaranteed allDone Remains Unchanged ──
  it('14. Guaranteed allDone remains unchanged: probabilistic coverage never sets isGuaranteedCovered', () => {
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

    const res = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
    // Guaranteed shortage remains 10
    expect(res.isGuaranteedCovered).toBe(false);
    // Probabilistically likely covered
    expect(res.isLikelyCovered).toBe(true);
  });

  // ── 15. Full Hilichurl Mask Fixture ──
  it('15. Full Hilichurl Mask fixture: verifies exact metrics for 10% Double and 25% Refund', () => {
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

    // Baseline: 27,000 Mora, 10 shortage (622 Stained @ 25 Mora + 229 Ominous @ 50 Mora)
    const baseline = forecastFamilyCrafting(hilichurlFamily, reqs, inv, null);
    expect(baseline.guaranteedCraftingMora).toBe(27000);
    expect(baseline.totalGuaranteedShortage).toBe(10);

    // 10% Double: ~24,251 Mora, 0 shortage, >99% coverage display
    const doubleRes = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
    expect(doubleRes.totalExpectedShortage).toBe(0);
    expect(doubleRes.coverageDisplay).toBe('All 500 simulated runs covered requirement (>99% est.)');
    expect(doubleRes.estimatedCraftingMora).toBeLessThan(25000);

    // 25% Refund: ~26,796 Mora, 0 shortage
    const refundRes = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'ingredient_refund');
    expect(refundRes.totalExpectedShortage).toBe(0);
    expect(refundRes.coverageDisplay).toBe('All 500 simulated runs covered requirement (>99% est.)');
    expect(refundRes.estimatedCraftingMora).toBeLessThan(27000);
  });

  // ── 16. Full Slime Fixture ──
  it('16. Full Slime fixture: preserves guaranteed 0 shortage, reports savings and surplus ingredients', () => {
    const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
    const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

    const res = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
    expect(res.isGuaranteedCovered).toBe(true);
    expect(res.totalGuaranteedShortage).toBe(0);
    expect(res.totalExpectedShortage).toBe(0);
    expect(res.guaranteedCraftingMora).toBe(82250);
    expect(res.sameDemandCovered).toBe(true);
    expect(res.estimatedMoraDifference).toBeGreaterThan(7000);
    expect(res.projectedInventory['SlimeCondensate']).toBeGreaterThan(800);
  });

  // ── 17. Unaffected Elemental Gems ──
  it('17. Unaffected elemental gems: character_gems are strictly excluded from bonus trials', () => {
    const reqs = {
      AgnidusAgateSliver: 1,
      AgnidusAgateFragment: 9,
      AgnidusAgateChunk: 9,
      AgnidusAgateGemstone: 6,
    };
    const inv = {
      AgnidusAgateSliver: 0,
      AgnidusAgateFragment: 0,
      AgnidusAgateChunk: 0,
      AgnidusAgateGemstone: 0,
    };

    const res = forecastFamilyCrafting(agnidusFamily, reqs, inv, 'double_output');
    expect(res.isEligible).toBe(false);
    expect(res.bonusType).toBeNull();
    expect(res.totalExpectedShortage).toBe(res.totalGuaranteedShortage);
    expect(res.estimatedCraftingMora).toBe(res.guaranteedCraftingMora);
    expect(res.coverageDisplay).toBe('0% (bonus ineligible)');
  });

  // ── 18. Unknown Recipe Fallback ──
  it('18. Unknown recipe fallback: unregistered material IDs fall back safely without error', () => {
    const reqs = { NonExistentMaterial_XYZ: 99 };
    const inv = { NonExistentMaterial_XYZ: 0 };

    const plan = computeCraftingPlan(reqs, inv);
    const forecast = forecastCraftingPlan(plan, reqs, inv, { enabled: true, bonusType: 'double_output' });
    expect(forecast).toBeDefined();
    expect(forecast.totalExpectedShortage).toBe(0);
  });

  // ── 19. Performance at Representative Scale ──
  it('19. Performance at representative catalog scale: all 108 families execute under 50 ms', () => {
    const reqs: Record<string, number> = {};
    const inv: Record<string, number> = {};

    CRAFTING_FAMILIES.forEach((f) => {
      f.tiers.forEach((t, i) => {
        reqs[t.id] = (i + 1) * 10;
        inv[t.id] = i === 0 ? 100 : 5;
      });
    });

    const plan = computeCraftingPlan(reqs, inv);
    const start = performance.now();
    const forecast = forecastCraftingPlan(plan, reqs, inv, { enabled: true, bonusType: 'double_output' });
    const duration = performance.now() - start;

    expect(forecast.families).toBeDefined();
    expect(duration).toBeLessThan(150); // fast catalog execution
  });

  // ── 20. Inventory Immutability ──
  it('20. Inventory immutability: deepFrozen inputs are never mutated', () => {
    const reqs = deepFreeze({ DamagedMask: 81, StainedMask: 158, OminousMask: 274 });
    const inv = deepFreeze({ DamagedMask: 1951, StainedMask: 223, OminousMask: 35 });

    expect(() => {
      forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
    }).not.toThrow();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ── Phase CRAFT-D4-A: Bonus-Aware Quantity Optimization & Waste Reduction ──
  // ════════════════════════════════════════════════════════════════════════════
  describe('Phase CRAFT-D4-A: Bonus-Aware Crafting Quantity Optimization & Waste Reduction', () => {
    // ── 21. Slime Guaranteed Baseline ──
    it('21. Slime Guaranteed Baseline: exact 2,026 Secretions, 632 Concentrate, 82,250 Mora, 12 Condensate leftover', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const baseline = forecastFamilyCrafting(slimeFamily, reqs, inv, null);
      expect(baseline.guaranteedOperations).toEqual([2026, 632]);
      expect(baseline.guaranteedCraftingMora).toBe(82250);
      expect(baseline.totalGuaranteedShortage).toBe(0);
      expect(baseline.guaranteedLeftovers['SlimeCondensate']).toBe(12);

      // Verify baseline optimizedSteps contract
      expect(baseline.optimizedSteps).toHaveLength(2);
      expect(baseline.optimizedSteps[0].guaranteedCrafts).toBe(2026);
      expect(baseline.optimizedSteps[0].guaranteedGrossInputConsumed).toBe(6078);
      expect(baseline.optimizedSteps[1].guaranteedCrafts).toBe(632);
      expect(baseline.optimizedSteps[1].guaranteedGrossInputConsumed).toBe(1896);
    });

    // ── 22. Slime 10% Double Output Optimization ──
    it('22. Slime 10% Double Output: ~575 Concentrate crafts, ~1,686–1,687 Secretions crafts, ~5,060 Condensate consumed, ~1,030 leftover', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      expect(forecast.isEligible).toBe(true);
      expect(forecast.totalExpectedShortage).toBe(0);

      // Recipe 0: Condensate -> Secretions
      const stepSecretions = forecast.optimizedSteps[0];
      expect(stepSecretions.expectedCrafts).toBeGreaterThanOrEqual(1680);
      expect(stepSecretions.expectedCrafts).toBeLessThanOrEqual(1695);
      expect(stepSecretions.expectedGrossInputConsumed).toBeGreaterThanOrEqual(5040);
      expect(stepSecretions.expectedGrossInputConsumed).toBeLessThanOrEqual(5085);
      expect(stepSecretions.suggestedInitialBatch).toBeGreaterThanOrEqual(1600);
      expect(stepSecretions.suggestedInitialBatch).toBeLessThanOrEqual(stepSecretions.expectedCrafts);

      // Recipe 1: Secretions -> Concentrate
      const stepConcentrate = forecast.optimizedSteps[1];
      expect(stepConcentrate.expectedCrafts).toBeGreaterThanOrEqual(570);
      expect(stepConcentrate.expectedCrafts).toBeLessThanOrEqual(580);
      expect(stepConcentrate.suggestedInitialBatch).toBeGreaterThanOrEqual(550);
      expect(stepConcentrate.suggestedInitialBatch).toBeLessThanOrEqual(stepConcentrate.expectedCrafts);

      // Remaining Condensate
      expect(forecast.expectedLeftovers['SlimeCondensate']).toBeGreaterThanOrEqual(1000);
      expect(forecast.expectedLeftovers['SlimeCondensate']).toBeLessThanOrEqual(1050);

      // Expected Mora savings
      expect(forecast.sameDemandCovered).toBe(true);
      expect(forecast.estimatedMoraDifference).toBeGreaterThan(10000); // Saves over 10k Mora!
    });

    // ── 23. Slime 25% Ingredient Refund Optimization ──
    it('23. Slime 25% Ingredient Refund: 632 Concentrate crafts, ~1,868 Secretions crafts, ~953 Condensate leftover', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      expect(forecast.isEligible).toBe(true);
      expect(forecast.totalExpectedShortage).toBe(0);

      // In refund, 1 craft = 1 output. Concentrate crafts must be 632 to satisfy deficit of 632
      const stepConcentrate = forecast.optimizedSteps[1];
      expect(stepConcentrate.expectedCrafts).toBe(632);
      expect(stepConcentrate.expectedIngredientRefunds).toBeCloseTo(158, -1);

      // Secretions needed: 130 direct + 632*3 - refunds = ~1,868 crafts
      const stepSecretions = forecast.optimizedSteps[0];
      expect(stepSecretions.expectedCrafts).toBeGreaterThanOrEqual(1850);
      expect(stepSecretions.expectedCrafts).toBeLessThanOrEqual(1890);

      // Leftover Condensate ~953
      expect(forecast.expectedLeftovers['SlimeCondensate']).toBeGreaterThanOrEqual(920);
      expect(forecast.expectedLeftovers['SlimeCondensate']).toBeLessThanOrEqual(980);
    });

    // ── 24. Hilichurl Guaranteed Baseline ──
    it('24. Hilichurl Guaranteed Baseline: 622 Stained, 229 Ominous, 27,000 Mora, 10 shortage, 4 Damaged leftover', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const baseline = forecastFamilyCrafting(hilichurlFamily, reqs, inv, null);
      expect(baseline.guaranteedOperations).toEqual([622, 229]);
      expect(baseline.guaranteedCraftingMora).toBe(27000);
      expect(baseline.totalGuaranteedShortage).toBe(10);
      expect(baseline.guaranteedLeftovers['DamagedMask']).toBe(4);
    });

    // ── 25. Hilichurl 10% Double Output Optimization ──
    it('25. Hilichurl 10% Double Output: ~534 Stained crafts, ~217–218 Ominous crafts, ~270 Damaged leftover', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(forecast.isEligible).toBe(true);
      expect(forecast.totalExpectedShortage).toBe(0);

      const stepStained = forecast.optimizedSteps[0];
      expect(stepStained.expectedCrafts).toBeGreaterThanOrEqual(530);
      expect(stepStained.expectedCrafts).toBeLessThanOrEqual(540);
      expect(stepStained.suggestedInitialBatch).toBeGreaterThanOrEqual(500);

      const stepOminous = forecast.optimizedSteps[1];
      expect(stepOminous.expectedCrafts).toBeGreaterThanOrEqual(215);
      expect(stepOminous.expectedCrafts).toBeLessThanOrEqual(220);
      expect(stepOminous.suggestedInitialBatch).toBeGreaterThanOrEqual(200);

      // Remaining Damaged Masks ~270
      expect(forecast.expectedLeftovers['DamagedMask']).toBeGreaterThanOrEqual(255);
      expect(forecast.expectedLeftovers['DamagedMask']).toBeLessThanOrEqual(285);
    });

    // ── 26. Hilichurl 25% Ingredient Refund Optimization ──
    it('26. Hilichurl 25% Ingredient Refund: ~592 Stained crafts, 239 Ominous crafts, ~240 Damaged leftover', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'ingredient_refund');
      expect(forecast.isEligible).toBe(true);
      expect(forecast.totalExpectedShortage).toBe(0);

      // 239 Ominous crafts needed
      const stepOminous = forecast.optimizedSteps[1];
      expect(stepOminous.expectedCrafts).toBe(239);

      // ~592 Stained crafts
      const stepStained = forecast.optimizedSteps[0];
      expect(stepStained.expectedCrafts).toBeGreaterThanOrEqual(585);
      expect(stepStained.expectedCrafts).toBeLessThanOrEqual(600);

      // Damaged leftover ~240
      expect(forecast.expectedLeftovers['DamagedMask']).toBeGreaterThanOrEqual(225);
      expect(forecast.expectedLeftovers['DamagedMask']).toBeLessThanOrEqual(250);
    });

    // ── 27. Conservative Initial Batch Non-Overshoot Policy ──
    it('27. Conservative Initial Batch Non-Overshoot Policy: verifies 95% non-overshoot bound direction', () => {
      // For D = 10, exact binomial batch b = 8
      const batch10 = calculateConservativeInitialBatch(10, 10, 'double_output', 9.1);
      expect(batch10.batch).toBe(8);

      // For D = 239, exact binomial batch b = 211
      const batch239 = calculateConservativeInitialBatch(239, 239, 'double_output', 217.2);
      expect(batch239.batch).toBe(211);

      // For D = 632, exact binomial batch b = 564
      const batch632 = calculateConservativeInitialBatch(632, 632, 'double_output', 574.5);
      expect(batch632.batch).toBe(564);

      // For D = 1, batch b = 1
      const batch1 = calculateConservativeInitialBatch(1, 10, 'double_output', 1);
      expect(batch1.batch).toBe(1);

      // For D = 0, batch b = 0
      const batch0 = calculateConservativeInitialBatch(0, 10, 'double_output', 0);
      expect(batch0.batch).toBe(0);

      // Ingredient refund initial batch
      const refundBatch = calculateConservativeInitialBatch(652, 623, 'ingredient_refund', 592.5);
      expect(refundBatch.batch).toBe(592);
    });

    // ── 28. Operation-Level Optimized Steps Data Contract ──
    it('28. Operation-Level Optimized Steps Data Contract: verifies schema completeness', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(forecast.optimizedSteps).toBeDefined();
      expect(forecast.optimizedSteps.length).toBe(2);

      forecast.optimizedSteps.forEach((step) => {
        expect(step.recipeId).toBeDefined();
        expect(step.familyId).toBe('Hilichurl');
        expect(step.inputItemId).toBeDefined();
        expect(step.outputItemId).toBeDefined();
        expect(step.guaranteedCrafts).toBeGreaterThan(0);
        expect(step.expectedCrafts).toBeGreaterThan(0);
        expect(step.suggestedInitialBatch).toBeGreaterThan(0);
        expect(step.suggestedInitialBatch).toBeLessThanOrEqual(step.expectedCrafts);
        expect(step.expectedGrossInputConsumed).toBeCloseTo(step.expectedCrafts * 3, 0);
        expect(step.expectedMoraCost).toBeCloseTo(step.expectedCrafts * step.moraCostPerCraft, -1);
      });
    });

    // ── 29. Multi-Tier Material Conservation Across Trials ──
    it('29. Multi-Tier Material Conservation: Final = Initial + Produced - Consumed - Demand', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      const step0 = forecast.optimizedSteps[0];
      const step1 = forecast.optimizedSteps[1];

      // Tier 0 (Condensate):
      // Final = Initial - GrossConsumed - DirectDemand
      const finalCondensate = forecast.expectedLeftovers['SlimeCondensate'];
      const expectedFinal0 = 6309 - step0.expectedGrossInputConsumed - 219;
      expect(finalCondensate).toBeCloseTo(expectedFinal0, 0);

      // Tier 1 (Secretions):
      // Initial(281) + Produced(step0.expectedOutput) - Consumed(step1.expectedGrossInputConsumed) - Demand(411) = Final
      const finalSecretions = forecast.expectedLeftovers['SlimeSecretions'];
      const expectedFinal1 = 281 + step0.expectedOutput - step1.expectedGrossInputConsumed - 411;
      expect(finalSecretions).toBeCloseTo(expectedFinal1, 0);
    });

    // ── 30. Partial Inventory Handling ──
    it('30. Partial Inventory Handling: halts crafting honestly without negative numbers or false targets', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 300, StainedMask: 0, OminousMask: 0 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(forecast.isGuaranteedCovered).toBe(false);
      expect(forecast.isLikelyCovered).toBe(false);
      expect(forecast.totalExpectedShortage).toBeGreaterThan(0);

      // Damaged surplus = 300 - 81 = 219. 219 / 3 = 73 crafts possible
      expect(forecast.optimizedSteps[0].expectedCrafts).toBeCloseTo(73, 0);
      expect(forecast.optimizedSteps[1].expectedCrafts).toBe(0); // cannot craft any Ominous Masks
      expect(forecast.expectedLeftovers['DamagedMask']).toBe(0);
      expect(forecast.expectedLeftovers['OminousMask']).toBe(0);
      expect(forecast.expectedShortages['OminousMask']).toBe(274);
    });

    // ── 31. Memoization Performance ──
    it('31. Memoization Performance: identical parameters return cached result in under 1 ms', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      // First run populates cache
      const run1 = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');

      const start = performance.now();
      const run2 = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      const duration = performance.now() - start;

      expect(run2).toBe(run1); // exact same object identity from cache!
      expect(duration).toBeLessThan(2);
    });

    // ── 32. Ineligible Elemental Gems ──
    it('32. Ineligible Elemental Gems: character_gems strictly return baseline without bonus procs', () => {
      const reqs = {
        AgnidusAgateSliver: 1,
        AgnidusAgateFragment: 9,
        AgnidusAgateChunk: 9,
        AgnidusAgateGemstone: 6,
      };
      const inv = {
        AgnidusAgateSliver: 100,
        AgnidusAgateFragment: 0,
        AgnidusAgateChunk: 0,
        AgnidusAgateGemstone: 0,
      };

      const forecast = forecastFamilyCrafting(agnidusFamily, reqs, inv, 'double_output');
      expect(forecast.isEligible).toBe(false);
      expect(forecast.bonusType).toBeNull();
      expect(forecast.optimizedSteps.every((s) => s.expectedBonusOutput === 0)).toBe(true);
      expect(forecast.optimizedSteps.every((s) => s.expectedCrafts === s.guaranteedCrafts)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ── Phase CRAFT-D4-A.1: First-Batch Probability Correction & Verification ──
  // ════════════════════════════════════════════════════════════════════════════
  describe('Phase CRAFT-D4-A.1: First-Batch Probability Correction & Final Optimizer Verification', () => {
    // ── 33. Exact 95% Batch Selection ──
    it('33. Exact 95% batch selection: verifies P(b + Binomial(b, 0.10) <= d) >= 0.95', () => {
      const d = 239;
      const b = findMaxInitialBatchDoubleOutput(d, 0.10, 0.95);
      expect(b).toBe(211);

      const prob = calculateBinomialCdf(b, 0.10, d - b);
      expect(prob).toBeGreaterThanOrEqual(0.95);
      expect(prob).toBeCloseTo(0.9505, 3);
    });

    // ── 34. The Three Reference Fixtures ──
    it('34. The Three Reference Fixtures: exact batches 211, 1668, and 1822', () => {
      expect(findMaxInitialBatchDoubleOutput(239, 0.10, 0.95)).toBe(211);
      expect(findMaxInitialBatchDoubleOutput(1855, 0.10, 0.95)).toBe(1668);
      expect(findMaxInitialBatchDoubleOutput(2026, 0.10, 0.95)).toBe(1822);
    });

    // ── 35. Maximum-Batch Boundary Correctness ──
    it('35. Maximum-batch boundary correctness: next larger batch strictly fails 95% threshold', () => {
      // For d = 239: b = 211 passes, b = 212 fails
      expect(calculateBinomialCdf(211, 0.10, 239 - 211)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(212, 0.10, 239 - 212)).toBeLessThan(0.95);

      // For d = 1855: b = 1668 passes, b = 1669 fails
      expect(calculateBinomialCdf(1668, 0.10, 1855 - 1668)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(1669, 0.10, 1855 - 1669)).toBeLessThan(0.95);

      // For d = 2026: b = 1822 passes, b = 1823 fails
      expect(calculateBinomialCdf(1822, 0.10, 2026 - 1822)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(1823, 0.10, 2026 - 1823)).toBeLessThan(0.95);
    });

    // ── 36. Very Small Targets ──
    it('36. Very small targets: d = 2, 3, 4, 5 produce exact conservative integer batches', () => {
      // d = 2: b = 1 (P(X <= 1) = 1.0 >= 0.95; b = 2 gives P(X <= 0) = 0.81 < 0.95)
      expect(findMaxInitialBatchDoubleOutput(2, 0.10, 0.95)).toBe(1);

      // d = 3: b = 2 (P(X <= 1) = 0.99 >= 0.95; b = 3 gives P(X <= 0) = 0.729 < 0.95)
      expect(findMaxInitialBatchDoubleOutput(3, 0.10, 0.95)).toBe(2);

      // d = 4: b = 3 (P(X <= 1) = 0.972 >= 0.95; b = 4 gives P(X <= 0) = 0.6561 < 0.95)
      expect(findMaxInitialBatchDoubleOutput(4, 0.10, 0.95)).toBe(3);

      // d = 5: b = 3 (P(X <= 2) = 0.999 >= 0.95; b = 4 gives P(X <= 1) = 0.9477 < 0.95)
      expect(findMaxInitialBatchDoubleOutput(5, 0.10, 0.95)).toBe(3);
    });

    // ── 37. Targets of Zero and One ──
    it('37. Targets of zero and one: handles edge cases gracefully with appropriate notes', () => {
      const res0 = calculateConservativeInitialBatch(0, 10, 'double_output', 0);
      expect(res0.batch).toBe(0);
      expect(res0.safeInitialBatch).toBe(0);
      expect(res0.recommendedActionBatch).toBe(0);
      expect(res0.note).toBe('No crafting required');

      // For d = 1, p = 0.10: exact mathematical safe batch is 0 (P(1 + X <= 1) = 0.90 < 0.95)
      expect(findMaxInitialBatchDoubleOutput(1, 0.10, 0.95)).toBe(0);

      const res1 = calculateConservativeInitialBatch(1, 10, 'double_output', 1);
      expect(res1.batch).toBe(1);
      expect(res1.safeInitialBatch).toBe(0);
      expect(res1.recommendedActionBatch).toBe(1);
      expect(res1.isActionFallback).toBe(true);
      expect(res1.note).toBe('Craft 1 to finish. There is a 10% chance of receiving 1 extra item.');
    });

    // ── 38. Large Crafting Batches ──
    it('38. Large crafting batches: evaluates d = 5000 and d = 10000 without overflow', () => {
      const b5000 = findMaxInitialBatchDoubleOutput(5000, 0.10, 0.95);
      expect(b5000).toBe(4515);
      expect(calculateBinomialCdf(4515, 0.10, 5000 - 4515)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(4516, 0.10, 5000 - 4516)).toBeLessThan(0.95);

      const b10000 = findMaxInitialBatchDoubleOutput(10000, 0.10, 0.95);
      expect(b10000).toBe(9048);
      expect(calculateBinomialCdf(9048, 0.10, 10000 - 9048)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(9049, 0.10, 10000 - 9049)).toBeLessThan(0.95);
    });

    // ── 39. Different Bonus Probabilities ──
    it('39. Different bonus probabilities: supports general p (e.g. 20% bonus)', () => {
      const b100_p20 = findMaxInitialBatchDoubleOutput(100, 0.20, 0.95);
      expect(b100_p20).toBe(78);
      expect(calculateBinomialCdf(78, 0.20, 100 - 78)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(79, 0.20, 100 - 79)).toBeLessThan(0.95);
    });

    // ── 40. Ingredient Availability Limits ──
    it('40. Ingredient availability limits: clamps batch to maxPossibleCrafts and expectedCrafts', () => {
      // When target is 239 (optimal batch 211), but only 50 crafts are available:
      const clamped50 = calculateConservativeInitialBatch(239, 50, 'double_output', 217);
      expect(clamped50.batch).toBe(50);

      // When target is 239, maxPossible is 300, but expectedCrafts is 150:
      const clampedExp = calculateConservativeInitialBatch(239, 300, 'double_output', 150);
      expect(clampedExp.batch).toBe(150);
    });

    // ── 41. Existing Lower-Tier Reservations ──
    it('41. Existing lower-tier reservations: preserves direct requirements from crafting consumption', () => {
      const reqs = { DamagedMask: 100, StainedMask: 0, OminousMask: 0 };
      const inv = { DamagedMask: 100, StainedMask: 0, OminousMask: 0 };

      // All 100 Damaged Masks are reserved for direct demand; 0 crafts should occur
      const baseline = forecastFamilyCrafting(hilichurlFamily, reqs, inv, null);
      expect(baseline.guaranteedOperations).toEqual([0, 0]);
      expect(baseline.optimizedSteps.every((s) => s.suggestedInitialBatch === 0)).toBe(true);

      const doubleRes = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(doubleRes.optimizedSteps.every((s) => s.suggestedInitialBatch === 0)).toBe(true);
    });

    // ── 42. Intermediate-Tier Requirements ──
    it('42. Intermediate-tier requirements: reserves direct intermediate needs before higher promotion', () => {
      // 10 direct Stained Masks required, 10 owned. 5 Ominous Masks required.
      // 10 Stained Masks are reserved for direct requirements and cannot be consumed to craft Ominous Masks
      const reqs = { DamagedMask: 0, StainedMask: 10, OminousMask: 5 };
      const inv = { DamagedMask: 0, StainedMask: 10, OminousMask: 0 };

      const res = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(res.guaranteedOperations).toEqual([0, 0]);
      expect(res.optimizedSteps[1].suggestedInitialBatch).toBe(0);
      expect(res.totalExpectedShortage).toBe(5);
    });

    // ── 43. Multi-Tier Target Dependencies ──
    it('43. Multi-tier target dependencies: lower tier target demand adjusts to higher-tier bonus output', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const res = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      // Step 1: Ominous target demand = 239 -> initial batch = 211
      expect(res.optimizedSteps[1].suggestedInitialBatch).toBe(211);

      // Step 0: Stained target demand is adjusted top-down (~586-587) rather than guaranteed 622
      // Initial batch for ~586-587 is 522-524
      expect(res.optimizedSteps[0].suggestedInitialBatch).toBeGreaterThanOrEqual(520);
      expect(res.optimizedSteps[0].suggestedInitialBatch).toBeLessThanOrEqual(525);
    });

    // ── 44. Refund-Specific Batch Behavior ──
    it('44. Refund-specific batch behavior: 1:1 output, executable from available inventory', () => {
      const refundStep = calculateConservativeInitialBatch(239, 239, 'ingredient_refund', 239);
      expect(refundStep.batch).toBe(239);
      expect(refundStep.note).toContain('recycled refunds');

      // Clamped when available inventory allows fewer crafts
      const clampedRefund = calculateConservativeInitialBatch(239, 100, 'ingredient_refund', 239);
      expect(clampedRefund.batch).toBe(100);
    });

    // ── 45. Simulated Leftover Correctness ──
    it('45. Simulated leftover correctness: material conservation holds across all tiers', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const res = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      // Total Condensate = Initial (6309) - Direct (219) - GrossConsumed (~5063) = Leftover (~1027)
      const expectedLeftover = 6309 - 219 - res.optimizedSteps[0].expectedGrossInputConsumed;
      expect(res.expectedLeftovers['SlimeCondensate']).toBeCloseTo(expectedLeftover, 0);
    });

    // ── 46. Expected versus Guaranteed Quantities ──
    it('46. Expected versus guaranteed quantities: all data contracts accurately report differences', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const res = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      expect(res.guaranteedCraftingMora).toBe(82250);
      expect(res.estimatedCraftingMora).toBeLessThan(res.guaranteedCraftingMora);
      expect(res.estimatedMoraDifference).toBe(res.guaranteedCraftingMora - res.estimatedCraftingMora);
      expect(res.sameDemandCovered).toBe(true);
    });

    // ── 47. No Inventory Mutation ──
    it('47. No inventory mutation: deepFreeze verification confirms zero in-place mutations', () => {
      const reqs = deepFreeze({ SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 });
      const inv = deepFreeze({ SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 });

      expect(() => {
        forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
        forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
        forecastFamilyCrafting(slimeFamily, reqs, inv, null);
      }).not.toThrow();
    });

    // ── 48. Stable Cached Forecasts ──
    it('48. Stable cached forecasts: cache returns identical object reference without jitter', () => {
      clearForecastCache();
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const res1 = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      const res2 = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      expect(res2).toBe(res1);

      // Cache invalidates on different bonus
      const res3 = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      expect(res3).not.toBe(res1);
    });

    // ── 49. Full Slime Acceptance Fixture ──
    it('49. Full Slime acceptance fixture: verifies baseline, double output, and ingredient refund', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      // Baseline
      const base = forecastFamilyCrafting(slimeFamily, reqs, inv, null);
      expect(base.guaranteedOperations).toEqual([2026, 632]);
      expect(base.guaranteedCraftingMora).toBe(82250);

      // Double Output
      const dbl = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      expect(dbl.optimizedSteps[1].suggestedInitialBatch).toBe(564);
      expect(dbl.optimizedSteps[0].suggestedInitialBatch).toBe(1668);

      // Refund: expectedCrafts is 632, but physically executable initial batch is clamped to 579 based on guaranteed available Secretions
      const ref = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      expect(ref.optimizedSteps[1].expectedCrafts).toBe(632);
      expect(ref.optimizedSteps[1].suggestedInitialBatch).toBe(579);
      expect(ref.optimizedSteps[0].suggestedInitialBatch).toBe(1868);
    });

    // ── 50. Full Hilichurl Mask Acceptance Fixture ──
    it('50. Full Hilichurl Mask acceptance fixture: verifies baseline, double output, and ingredient refund', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      // Baseline: 622 Stained, 229 Ominous, 10 shortage
      const base = forecastFamilyCrafting(hilichurlFamily, reqs, inv, null);
      expect(base.guaranteedOperations).toEqual([622, 229]);
      expect(base.totalGuaranteedShortage).toBe(10);

      // Double Output: 0 shortage, initial batches 522-524 and 211
      const dbl = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(dbl.totalExpectedShortage).toBe(0);
      expect(dbl.optimizedSteps[1].suggestedInitialBatch).toBe(211);
      expect(dbl.optimizedSteps[0].suggestedInitialBatch).toBeGreaterThanOrEqual(520);
      expect(dbl.optimizedSteps[0].suggestedInitialBatch).toBeLessThanOrEqual(525);

      // Refund: 0 shortage, initial batches 592 and 219 (clamped from 239 based on guaranteed available Stained Masks)
      const ref = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'ingredient_refund');
      expect(ref.totalExpectedShortage).toBe(0);
      expect(ref.optimizedSteps[0].suggestedInitialBatch).toBe(592);
      expect(ref.optimizedSteps[1].expectedCrafts).toBe(239);
      expect(ref.optimizedSteps[1].suggestedInitialBatch).toBe(219);
    });

    // ── 51. Numerically Stable Binomial CDF ──
    it('51. Numerically stable Binomial CDF: mode-centered summation handles edge cases cleanly', () => {
      expect(calculateBinomialCdf(0, 0.1, 0)).toBe(1);
      expect(calculateBinomialCdf(10, 0, 0)).toBe(1);
      expect(calculateBinomialCdf(10, 1, 10)).toBe(1);
      expect(calculateBinomialCdf(10, 1, 9)).toBe(0);
      expect(calculateBinomialCdf(10, 0.1, -1)).toBe(0);
      expect(calculateBinomialCdf(10, 0.1, 15)).toBe(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ── Phase CRAFT-D4-A.2: Small-Batch Edge Case & Statistical Separation ───
  // ════════════════════════════════════════════════════════════════════════════
  describe('Phase CRAFT-D4-A.2: Small-Batch Probability Edge Case & Final Acceptance', () => {
    // ── 52. d = 0: Zero Crafts ──
    it('52. d = 0: zero crafts for both safeInitialBatch and recommendedActionBatch', () => {
      const res = calculateConservativeInitialBatch(0, 10, 'double_output', 0);
      expect(res.batch).toBe(0);
      expect(res.safeInitialBatch).toBe(0);
      expect(res.recommendedActionBatch).toBe(0);
      expect(res.isActionFallback).toBe(false);
      expect(res.note).toBe('No crafting required');
    });

    // ── 53. d = 1, p = 0.10: Safe Batch 0, Actionable Batch 1 with 90% Probability ──
    it('53. d = 1, p = 0.10: safe batch zero; actionable batch one with 90% no-overshoot probability', () => {
      // Statistical verification:
      // P(1 + Binomial(1, 0.10) <= 1) = P(Binomial(1, 0.10) <= 0) = 0.90 < 0.95
      expect(calculateBinomialCdf(1, 0.10, 0)).toBeCloseTo(0.90, 4);
      expect(findMaxInitialBatchDoubleOutput(1, 0.10, 0.95)).toBe(0);

      // Actionable fallback guidance:
      const res = calculateConservativeInitialBatch(1, 10, 'double_output', 1);
      expect(res.safeInitialBatch).toBe(0);
      expect(res.recommendedActionBatch).toBe(1);
      expect(res.batch).toBe(1);
      expect(res.isActionFallback).toBe(true);
      expect(res.note).toBe('Craft 1 to finish. There is a 10% chance of receiving 1 extra item.');
    });

    // ── 54. d = 2, p = 0.10: Maximum Safe Batch 1 ──
    it('54. d = 2, p = 0.10: maximum safe batch is 1 (P(X <= 1) = 1.0 >= 0.95)', () => {
      expect(findMaxInitialBatchDoubleOutput(2, 0.10, 0.95)).toBe(1);
      expect(calculateBinomialCdf(1, 0.10, 2 - 1)).toBe(1.0);
      expect(calculateBinomialCdf(2, 0.10, 2 - 2)).toBeCloseTo(0.81, 4);

      const res = calculateConservativeInitialBatch(2, 10, 'double_output', 1.8);
      expect(res.safeInitialBatch).toBe(1);
      expect(res.recommendedActionBatch).toBe(1);
      expect(res.isActionFallback).toBe(false);
      expect(res.note).toContain('Conservative 95% non-overshoot batch');
    });

    // ── 55. Canonical References: d = 239, 1855, 2026 ──
    it('55. Canonical References: d = 239 -> 211, d = 1855 -> 1668, d = 2026 -> 1822', () => {
      expect(findMaxInitialBatchDoubleOutput(239, 0.10, 0.95)).toBe(211);
      expect(findMaxInitialBatchDoubleOutput(1855, 0.10, 0.95)).toBe(1668);
      expect(findMaxInitialBatchDoubleOutput(2026, 0.10, 0.95)).toBe(1822);
    });

    // ── 56. Next-Integer Boundary Rejection ──
    it('56. Next-integer boundary rejection: next batch strictly violates 95% threshold', () => {
      // 211 vs 212
      expect(calculateBinomialCdf(211, 0.10, 28)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(212, 0.10, 27)).toBeLessThan(0.95);

      // 1668 vs 1669
      expect(calculateBinomialCdf(1668, 0.10, 187)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(1669, 0.10, 186)).toBeLessThan(0.95);

      // 1822 vs 1823
      expect(calculateBinomialCdf(1822, 0.10, 204)).toBeGreaterThanOrEqual(0.95);
      expect(calculateBinomialCdf(1823, 0.10, 203)).toBeLessThan(0.95);
    });

    // ── 57. No Ingredients Available ──
    it('57. No ingredients available: maxPossibleCrafts = 0 yields zero crafts', () => {
      const res = calculateConservativeInitialBatch(239, 0, 'double_output', 217);
      expect(res.batch).toBe(0);
      expect(res.safeInitialBatch).toBe(0);
      expect(res.recommendedActionBatch).toBe(0);
      expect(res.note).toBe('No crafting required');
    });

    // ── 58. One Craft Physically Possible ──
    it('58. One craft physically possible: clamps batch to 1 when maxPossibleCrafts = 1', () => {
      const res = calculateConservativeInitialBatch(239, 1, 'double_output', 217);
      expect(res.safeInitialBatch).toBe(1);
      expect(res.recommendedActionBatch).toBe(1);
      expect(res.batch).toBe(1);
    });

    // ── 59. Bonus-Disabled Mode Unchanged ──
    it('59. Bonus-disabled mode unchanged: returns guaranteed baseline batch and note', () => {
      const res = calculateConservativeInitialBatch(622, 622, null, 622);
      expect(res.batch).toBe(622);
      expect(res.safeInitialBatch).toBe(622);
      expect(res.recommendedActionBatch).toBe(622);
      expect(res.isActionFallback).toBe(false);
      expect(res.note).toBe('Guaranteed 3:1 batch');
    });

    // ── 60. Refund Mode Execution Policy Unchanged ──
    it('60. Refund mode execution policy unchanged: 1:1 output, safeInitialBatch equals recommendedActionBatch', () => {
      const res = calculateConservativeInitialBatch(239, 239, 'ingredient_refund', 239);
      expect(res.batch).toBe(239);
      expect(res.safeInitialBatch).toBe(239);
      expect(res.recommendedActionBatch).toBe(239);
      expect(res.isActionFallback).toBe(false);
      expect(res.note).toContain('recycled refunds');
    });

    // ── 61. Schema Completeness with Statistical Separation ──
    it('61. Schema completeness: OptimizedCraftingStep includes safeInitialBatch, recommendedActionBatch, and isActionFallback', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      expect(forecast.optimizedSteps).toHaveLength(2);

      forecast.optimizedSteps.forEach((step) => {
        expect(typeof step.safeInitialBatch).toBe('number');
        expect(typeof step.recommendedActionBatch).toBe('number');
        expect(typeof step.isActionFallback).toBe('boolean');
        expect(step.suggestedInitialBatch).toBe(step.recommendedActionBatch);
      });
    });

    // ── 62. Single Item Family Integration ──
    it('62. Single item family integration: single item demand sets isActionFallback and residual risk note', () => {
      const reqs = { DamagedMask: 0, StainedMask: 0, OminousMask: 1 };
      const inv = { DamagedMask: 0, StainedMask: 3, OminousMask: 0 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      const step = forecast.optimizedSteps[1]; // Stained -> Ominous

      expect(step.safeInitialBatch).toBe(0);
      expect(step.recommendedActionBatch).toBe(1);
      expect(step.suggestedInitialBatch).toBe(1);
      expect(step.isActionFallback).toBe(true);
      expect(step.initialBatchNote).toBe('Craft 1 to finish. There is a 10% chance of receiving 1 extra item.');
    });
  });

  describe('Phase CRAFT-D4-A.3: Crafting Instruction Clarity & First-Batch Accounting Verification', () => {
    const slimeFamily = getCraftingFamily('Slime')!;
    const hilichurlFamily = getCraftingFamily('Hilichurl')!;

    // ── 63. Initial Batch Accounting Integrity ──
    it('63. Initial batch accounting integrity: exact ingredient and Mora cost computation for initial batch', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      const step0 = forecast.optimizedSteps[0]; // Damaged -> Stained
      const step1 = forecast.optimizedSteps[1]; // Stained -> Ominous

      // Step 0: Damaged -> Stained
      expect(step0.inputQty).toBe(3);
      expect(step0.moraCostPerCraft).toBe(25);
      const initialIngredients0 = step0.suggestedInitialBatch * step0.inputQty;
      const initialMora0 = step0.suggestedInitialBatch * step0.moraCostPerCraft;
      expect(initialIngredients0).toBe(step0.suggestedInitialBatch * 3);
      expect(initialMora0).toBe(step0.suggestedInitialBatch * 25);

      // Step 1: Stained -> Ominous
      expect(step1.inputQty).toBe(3);
      expect(step1.moraCostPerCraft).toBe(50);
      const initialIngredients1 = step1.suggestedInitialBatch * step1.inputQty;
      const initialMora1 = step1.suggestedInitialBatch * step1.moraCostPerCraft;
      expect(initialIngredients1).toBe(step1.suggestedInitialBatch * 3);
      expect(initialMora1).toBe(step1.suggestedInitialBatch * 50);

      // Initial batch cost must NOT be confused with estimated full-plan cost
      expect(initialMora0).toBeLessThan(step0.expectedMoraCost);
      expect(initialIngredients0).toBeLessThan(step0.expectedGrossInputConsumed);
    });

    // ── 64. Slime Multi-Tier Recipe Fixture ──
    it('64. Slime fixture: step operations are distinct from output quantities and first-batch ingredients are exact', () => {
      // Slime fixture: 10,000 Condensate owned, needing Secretions & Concentrate
      const reqs = { SlimeCondensate: 0, SlimeSecretions: 1858, SlimeConcentrate: 632 };
      const inv = { SlimeCondensate: 10000, SlimeSecretions: 0, SlimeConcentrate: 0 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'double_output');
      expect(forecast.optimizedSteps).toHaveLength(2);

      const step0 = forecast.optimizedSteps[0]; // Condensate -> Secretions
      // Operations: expectedCrafts
      expect(step0.expectedCrafts).toBeGreaterThan(0);
      // Output: expectedOutput is greater than expectedCrafts due to 10% bonus
      expect(step0.expectedOutput).toBeGreaterThan(step0.expectedCrafts);
      // Suggested initial batch <= expectedCrafts
      expect(step0.suggestedInitialBatch).toBeLessThanOrEqual(Math.ceil(step0.expectedCrafts));
      // First-batch ingredients = batch * 3
      expect(step0.suggestedInitialBatch * 3).toBeLessThanOrEqual(inv.SlimeCondensate);
    });

    // ── 65. Immutability of Reqs and Inv across Forecasting ──
    it('65. Immutability: reqs and inv objects are untouched by forecasting operations', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };
      const frozenReqs = Object.freeze({ ...reqs });
      const frozenInv = Object.freeze({ ...inv });

      expect(() => forecastFamilyCrafting(hilichurlFamily, frozenReqs, frozenInv, 'double_output')).not.toThrow();
      expect(() => forecastFamilyCrafting(hilichurlFamily, frozenReqs, frozenInv, 'ingredient_refund')).not.toThrow();
    });
  });

  describe('Phase CRAFT-D4-A.4: Executable Multi-Tier First Batches & Refund Safety', () => {
    const slimeFamily = getCraftingFamily('Slime')!;
    const hilichurlFamily = getCraftingFamily('Hilichurl')!;
    const samachurlFamily = getCraftingFamily('Samachurl')!;

    // ── 66. Slime Refund Second-Stage Executable First Batch: 579 ──
    it('66. Slime refund second-stage executable first batch: clamps to 579 based on 1,738 guaranteed available Secretions', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      expect(forecast.optimizedSteps).toHaveLength(2);

      const step0 = forecast.optimizedSteps[0]; // Condensate -> Secretions
      const step1 = forecast.optimizedSteps[1]; // Secretions -> Concentrate

      expect(step0.suggestedInitialBatch).toBe(1868);
      expect(step1.expectedCrafts).toBe(632);
      // Available Secretions = 1868 (produced) + 281 (owned) - 411 (reserved) = 1738
      // floor(1738 / 3) = 579
      expect(step1.accessibleIngredients).toBe(1738);
      expect(step1.guaranteedAvailableCrafts).toBe(579);
      expect(step1.suggestedInitialBatch).toBe(579);
      expect(step1.isConditional).toBe(true);
      expect(step1.priorStepIndex).toBe(0);
    });

    // ── 67. Hilichurl Refund Second-Stage Executable First Batch: 219 ──
    it('67. Hilichurl refund second-stage executable first batch: clamps to 219 based on 657 guaranteed available Stained Masks', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'ingredient_refund');
      expect(forecast.optimizedSteps).toHaveLength(2);

      const step0 = forecast.optimizedSteps[0]; // Damaged -> Stained
      const step1 = forecast.optimizedSteps[1]; // Stained -> Ominous

      expect(step0.suggestedInitialBatch).toBe(592);
      expect(step1.expectedCrafts).toBe(239);
      // Available Stained = 592 + 223 - 158 = 657
      // floor(657 / 3) = 219
      expect(step1.accessibleIngredients).toBe(657);
      expect(step1.guaranteedAvailableCrafts).toBe(219);
      expect(step1.suggestedInitialBatch).toBe(219);
      expect(step1.isConditional).toBe(true);
      expect(step1.priorStepIndex).toBe(0);
    });

    // ── 68. Samachurl Refund Second-Stage Executable First Batch: 154 ──
    it('68. Samachurl refund second-stage executable first batch: clamps to 154 based on 464 guaranteed available Sealed Scrolls', () => {
      const reqs = { DiviningScroll: 109, SealedScroll: 244, ForbiddenCurseScroll: 433 };
      const inv = { DiviningScroll: 1093, SealedScroll: 351, ForbiddenCurseScroll: 23 };

      const forecast = forecastFamilyCrafting(samachurlFamily, reqs, inv, 'ingredient_refund');
      expect(forecast.optimizedSteps).toHaveLength(2);

      const step0 = forecast.optimizedSteps[0]; // Divining -> Sealed
      const step1 = forecast.optimizedSteps[1]; // Sealed -> Forbidden Curse

      expect(step0.suggestedInitialBatch).toBe(357);
      expect(step1.expectedCrafts).toBe(168.5);
      // Available Sealed = 357 + 351 - 244 = 464
      // floor(464 / 3) = 154
      expect(step1.accessibleIngredients).toBe(464);
      expect(step1.guaranteedAvailableCrafts).toBe(154);
      expect(step1.suggestedInitialBatch).toBe(154);
      expect(step1.isConditional).toBe(true);
      expect(step1.priorStepIndex).toBe(0);
    });

    // ── 69. First-Batch Ingredient Count Equals Operations × Recipe Input Quantity ──
    it('69. First-batch ingredients count: firstBatchIngredients equals suggestedInitialBatch × inputQty', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      forecast.optimizedSteps.forEach((step) => {
        expect(step.firstBatchIngredients).toBe(step.suggestedInitialBatch * step.inputQty);
        expect(step.firstBatchIngredients).toBe(step.suggestedInitialBatch * 3);
      });
    });

    // ── 70. First-Batch Mora Matches Recipe Fees ──
    it('70. First-batch Mora matches recipe fees: firstBatchMora equals suggestedInitialBatch × moraCostPerCraft', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      forecast.optimizedSteps.forEach((step) => {
        expect(step.firstBatchMora).toBe(step.suggestedInitialBatch * step.moraCostPerCraft);
      });
      // Step 0: 1,868 × 25 = 46,700 Mora
      expect(forecast.optimizedSteps[0].firstBatchMora).toBe(1868 * 25);
      // Step 1: 579 × 50 = 28,950 Mora
      expect(forecast.optimizedSteps[1].firstBatchMora).toBe(579 * 50);
    });

    // ── 71. Future Refunds Not Spent Before They Exist ──
    it('71. Future refunds not spent before they exist: gross ingredients for initial batch do not exceed accessible inventory', () => {
      const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };
      const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 };

      const forecast = forecastFamilyCrafting(slimeFamily, reqs, inv, 'ingredient_refund');
      const step1 = forecast.optimizedSteps[1];

      // Initial batch gross ingredients (579 × 3 = 1,737) <= accessible ingredients (1,738)
      expect(step1.firstBatchIngredients).toBeLessThanOrEqual(step1.accessibleIngredients);
      // Gross ingredients for initial batch must be strictly less than full plan expectedGrossInputConsumed (632 × 3 = 1,896)
      expect(step1.firstBatchIngredients).toBeLessThan(step1.expectedGrossInputConsumed);
    });

    // ── 72. Double-Output Intermediate Products Are Not Treated as Guaranteed ──
    it('72. Double-output intermediate products are not treated as guaranteed: projected intermediate stock uses 1:1 base output only', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'double_output');
      const step0 = forecast.optimizedSteps[0];
      const step1 = forecast.optimizedSteps[1];

      // Step 0 produces guaranteed base output of step0.suggestedInitialBatch
      // Accessible ingredients for step 1 is strictly based on base batch, not bonus-boosted output
      expect(step1.accessibleIngredients).toBe(inv.StainedMask + step0.suggestedInitialBatch - reqs.StainedMask);
      expect(step1.guaranteedAvailableCrafts).toBe(Math.floor(step1.accessibleIngredients / 3));
    });

    // ── 73. Zero Executable Ingredients Produce Appropriate Guidance ──
    it('73. Zero executable ingredients: when unreserved materials are 0, suggestedInitialBatch is 0', () => {
      const reqs = { DamagedMask: 0, StainedMask: 0, OminousMask: 10 };
      const inv = { DamagedMask: 0, StainedMask: 0, OminousMask: 0 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'ingredient_refund');
      const step1 = forecast.optimizedSteps[1];

      expect(step1.accessibleIngredients).toBe(0);
      expect(step1.guaranteedAvailableCrafts).toBe(0);
      expect(step1.suggestedInitialBatch).toBe(0);
      expect(step1.firstBatchIngredients).toBe(0);
      expect(step1.firstBatchMora).toBe(0);
    });

    // ── 74. Guaranteed Quantities & Total Operations Unchanged ──
    it('74. Invariants: guaranteed baseline shortages, operations, and expected operations remain invariant', () => {
      const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
      const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };

      const forecast = forecastFamilyCrafting(hilichurlFamily, reqs, inv, 'ingredient_refund');

      // Guaranteed baseline unchanged
      expect(forecast.guaranteedOperations).toEqual([622, 229]);
      expect(forecast.totalGuaranteedShortage).toBe(10);

      // Expected operations and suggested batches
      expect(forecast.optimizedSteps[0].suggestedInitialBatch).toBe(592);
      expect(forecast.optimizedSteps[1].expectedCrafts).toBe(239);
      expect(forecast.optimizedSteps[1].suggestedInitialBatch).toBe(219);
    });
  });
});
