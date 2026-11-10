import { describe, it, expect } from 'vitest';
import { computeCraftingPlan, CraftingPlanResult } from './craftingEngine';
import { getCraftingFamily, getAllCraftingFamilies } from '../data/craftingRecipes';

/**
 * Deep-freezes an object to guarantee that any mutation attempt in the engine throws an error.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  Object.keys(obj).forEach((key) => {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object') {
      deepFreeze(val);
    }
  });
  return obj;
}

/**
 * Verifies the Material Conservation Invariant for every tier in the result:
 * FinalInventory = InitialOwned + CraftedProduced - CraftedConsumed - DemandAllocated
 */
function assertMaterialConservation(
  req: Record<string, number>,
  inv: Record<string, number>,
  result: CraftingPlanResult
) {
  const allItemIds = new Set([
    ...Object.keys(req),
    ...Object.keys(inv),
    ...Object.keys(result.projectedInventory),
  ]);

  allItemIds.forEach((itemId) => {
    const initialOwned = Math.max(0, Math.floor(inv[itemId] ?? 0));
    const grossRequired = Math.max(0, Math.floor(req[itemId] ?? 0));
    const projectedLeftover = result.projectedInventory[itemId] ?? 0;
    const adjustedShortage = result.adjustedShortages[itemId] ?? 0;

    // Demand satisfied
    const demandAllocated = grossRequired - adjustedShortage;

    // Crafted produced and consumed
    let craftedProduced = 0;
    let craftedConsumed = 0;

    result.craftingSteps.forEach((step) => {
      if (step.outputItemId === itemId) {
        craftedProduced += step.totalOutputProduced;
      }
      if (step.inputItemId === itemId) {
        craftedConsumed += step.totalInputConsumed;
      }
    });

    const expectedFinal = initialOwned + craftedProduced - craftedConsumed - demandAllocated;
    expect(
      projectedLeftover,
      `Material conservation violated for "${itemId}": expected ${expectedFinal}, got ${projectedLeftover}`
    ).toBe(expectedFinal);
    expect(projectedLeftover).toBeGreaterThanOrEqual(0);
    expect(adjustedShortage).toBeGreaterThanOrEqual(0);
  });
}

describe('Material Crafting Engine — Authoritative Acceptance Fixtures', () => {
  it('Fixture 01 (Section 7): Slime Acceptance Fixture (Zero Farming, 82,250 Mora)', () => {
    const rawReq = {
      SlimeCondensate: 219,
      SlimeSecretions: 411,
      SlimeConcentrate: 689,
    };
    const rawInv = {
      SlimeCondensate: 6309,
      SlimeSecretions: 281,
      SlimeConcentrate: 57,
      Mora: 100000,
    };

    deepFreeze(rawReq);
    deepFreeze(rawInv);

    const result = computeCraftingPlan(rawReq, rawInv);

    // 1. Recommended crafting quantities
    expect(result.craftingSteps.length).toBe(2);

    // Step 1: Craft Secretions
    const step1 = result.craftingSteps[0];
    expect(step1.recipeId).toBe('craft_SlimeSecretions');
    expect(step1.outputItemId).toBe('SlimeSecretions');
    expect(step1.count).toBe(2026);
    expect(step1.totalInputConsumed).toBe(6078);
    expect(step1.totalOutputProduced).toBe(2026);
    expect(step1.totalMoraCost).toBe(50650); // 2026 * 25

    // Step 2: Craft Concentrate
    const step2 = result.craftingSteps[1];
    expect(step2.recipeId).toBe('craft_SlimeConcentrate');
    expect(step2.outputItemId).toBe('SlimeConcentrate');
    expect(step2.count).toBe(632);
    expect(step2.totalInputConsumed).toBe(1896);
    expect(step2.totalOutputProduced).toBe(632);
    expect(step2.totalMoraCost).toBe(31600); // 632 * 50

    // 2. Projected remaining inventory
    expect(result.projectedInventory.SlimeCondensate).toBe(12);
    expect(result.projectedInventory.SlimeSecretions).toBe(0);
    expect(result.projectedInventory.SlimeConcentrate).toBe(0);

    // 3. Adjusted shortages & remaining farming
    expect(result.adjustedShortages.SlimeCondensate).toBe(0);
    expect(result.adjustedShortages.SlimeSecretions).toBe(0);
    expect(result.adjustedShortages.SlimeConcentrate).toBe(0);
    expect(Object.keys(result.remainingFarming).length).toBe(0);

    // 4. Exact Mora calculation
    expect(result.craftingMora).toBe(82250); // 50,650 + 31,600
    expect(result.moraByFamily.Slime).toBe(82250);
    expect(result.moraByRecipe.craft_SlimeSecretions).toBe(50650);
    expect(result.moraByRecipe.craft_SlimeConcentrate).toBe(31600);

    // 5. Affordability
    expect(result.isAffordableMora).toBe(true);
    expect(result.remainingMoraAfterCrafting).toBe(100000 - 82250);

    // 6. Status flags
    expect(result.allMaterialsDirectlyStocked).toBe(false);
    expect(result.allMaterialsCoveredByCrafting).toBe(true);
    expect(result.requiresCrafting).toBe(true);

    // 7. Material conservation check
    assertMaterialConservation(rawReq, rawInv, result);
  });

  it('Fixture 04 (Section 8): Four-Tier Acceptance Fixture — Decarabian (Zero Farming, 3,250 Mora)', () => {
    const rawReq = {
      ScatteredPieceOfDecarabiansDream: 1,
    };
    const rawInv = {
      TileOfDecarabiansTower: 27,
      DebrisOfDecarabiansCity: 0,
      FragmentOfDecarabiansEpic: 0,
      ScatteredPieceOfDecarabiansDream: 0,
      Mora: 10000,
    };

    deepFreeze(rawReq);
    deepFreeze(rawInv);

    const result = computeCraftingPlan(rawReq, rawInv);

    expect(result.craftingSteps.length).toBe(3);

    // Step 1: Tile -> Debris
    expect(result.craftingSteps[0].outputItemId).toBe('DebrisOfDecarabiansCity');
    expect(result.craftingSteps[0].count).toBe(9);
    expect(result.craftingSteps[0].totalInputConsumed).toBe(27);
    expect(result.craftingSteps[0].totalMoraCost).toBe(9 * 125); // 1,125

    // Step 2: Debris -> Fragment
    expect(result.craftingSteps[1].outputItemId).toBe('FragmentOfDecarabiansEpic');
    expect(result.craftingSteps[1].count).toBe(3);
    expect(result.craftingSteps[1].totalInputConsumed).toBe(9);
    expect(result.craftingSteps[1].totalMoraCost).toBe(3 * 350); // 1,050

    // Step 3: Fragment -> Dream
    expect(result.craftingSteps[2].outputItemId).toBe('ScatteredPieceOfDecarabiansDream');
    expect(result.craftingSteps[2].count).toBe(1);
    expect(result.craftingSteps[2].totalInputConsumed).toBe(3);
    expect(result.craftingSteps[2].totalMoraCost).toBe(1 * 1075); // 1,075

    // Total Mora: 1125 + 1050 + 1075 = 3250
    expect(result.craftingMora).toBe(3250);
    expect(result.moraByFamily.DecarabianTiles).toBe(3250);

    // Leftovers & Shortages
    expect(result.projectedInventory.TileOfDecarabiansTower).toBe(0);
    expect(result.projectedInventory.DebrisOfDecarabiansCity).toBe(0);
    expect(result.projectedInventory.FragmentOfDecarabiansEpic).toBe(0);
    expect(result.projectedInventory.ScatteredPieceOfDecarabiansDream).toBe(0);
    expect(result.adjustedShortages.ScatteredPieceOfDecarabiansDream).toBe(0);

    assertMaterialConservation(rawReq, rawInv, result);
  });
});

describe('Material Crafting Engine — Regression Fixtures Suite (Section 9 & 13)', () => {
  it('Fixture 02: Exact 3:1 conversion (Single Step)', () => {
    const req = { SlimeSecretions: 1 };
    const inv = { SlimeCondensate: 3, SlimeSecretions: 0 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(1);
    expect(res.craftingSteps[0].count).toBe(1);
    expect(res.craftingSteps[0].totalInputConsumed).toBe(3);
    expect(res.projectedInventory.SlimeCondensate).toBe(0);
    expect(res.adjustedShortages.SlimeSecretions).toBe(0);
    expect(res.craftingMora).toBe(25);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 03: Two consecutive crafting steps (9:1 conversion)', () => {
    const req = { SlimeConcentrate: 1 };
    const inv = { SlimeCondensate: 9 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(2);
    expect(res.craftingSteps[0].outputItemId).toBe('SlimeSecretions');
    expect(res.craftingSteps[0].count).toBe(3);
    expect(res.craftingSteps[1].outputItemId).toBe('SlimeConcentrate');
    expect(res.craftingSteps[1].count).toBe(1);
    expect(res.adjustedShortages.SlimeConcentrate).toBe(0);
    expect(res.projectedInventory.SlimeCondensate).toBe(0);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 05: Higher-tier inventory already sufficient (No De-Crafting)', () => {
    const req = { SlimeCondensate: 5, SlimeConcentrate: 2 };
    const inv = { SlimeConcentrate: 10, SlimeCondensate: 0 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(0); // Zero crafts
    expect(res.directShortages.SlimeCondensate).toBe(5);
    expect(res.adjustedShortages.SlimeCondensate).toBe(5); // Cannot de-craft Concentrate
    expect(res.adjustedShortages.SlimeConcentrate).toBe(0);
    expect(res.projectedInventory.SlimeConcentrate).toBe(8); // 10 - 2
    expect(res.allMaterialsCoveredByCrafting).toBe(false);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 06: Lower-tier inventory already sufficient (Surplus Base)', () => {
    const req = { SlimeCondensate: 10, SlimeSecretions: 5, SlimeConcentrate: 2 };
    const inv = { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    // Concentrate needs 2 (requires 6 Secretions).
    // Secretions needs 5 + 6 = 11 (requires 33 Condensate).
    // Condensate needs 10 direct + 33 = 43.
    // 100 - 43 = 57 leftover.
    expect(res.craftingSteps[0].count).toBe(11);
    expect(res.craftingSteps[1].count).toBe(2);
    expect(res.projectedInventory.SlimeCondensate).toBe(57);
    expect(res.allMaterialsCoveredByCrafting).toBe(true);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 07: Intermediate-tier surplus', () => {
    const req = { SlimeSecretions: 2, SlimeConcentrate: 10 };
    const inv = { SlimeSecretions: 20, SlimeConcentrate: 0 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    // 2 Secretions reserved for direct req; 18 surplus Secretions can craft 6 Concentrate.
    // Remaining Concentrate shortage: 10 - 6 = 4.
    expect(res.craftingSteps.length).toBe(1);
    expect(res.craftingSteps[0].count).toBe(6);
    expect(res.adjustedShortages.SlimeConcentrate).toBe(4);
    expect(res.adjustedShortages.SlimeSecretions).toBe(0);
    expect(res.projectedInventory.SlimeSecretions).toBe(0);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 08: Zero inventory', () => {
    const req = { SlimeCondensate: 10, SlimeSecretions: 10, SlimeConcentrate: 10 };
    const inv = {};
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(0);
    expect(res.adjustedShortages.SlimeCondensate).toBe(10);
    expect(res.adjustedShortages.SlimeSecretions).toBe(10);
    expect(res.adjustedShortages.SlimeConcentrate).toBe(10);
    expect(res.allMaterialsCoveredByCrafting).toBe(false);
  });

  it('Fixture 09 (Section 9): Partial inventory with documented allocation policy', () => {
    const req = { SlimeSecretions: 5, SlimeConcentrate: 10 };
    const inv = { SlimeCondensate: 15 };
    deepFreeze(req);
    deepFreeze(inv);

    // Default 'highest-tier' priority:
    const resHighest = computeCraftingPlan(req, inv, { priority: 'highest-tier' });
    // 15 Condensate crafts 5 Secretions.
    // Under highest-tier priority, 3 of those 5 Secretions craft 1 Concentrate.
    // The remaining 2 Secretions satisfy 2 of the 5 direct Secretions demand.
    expect(resHighest.craftingSteps[0].count).toBe(5); // 5 Secretions crafted
    expect(resHighest.craftingSteps[1].count).toBe(1); // 1 Concentrate crafted
    expect(resHighest.adjustedShortages.SlimeConcentrate).toBe(9); // 10 - 1
    expect(resHighest.adjustedShortages.SlimeSecretions).toBe(3); // 5 - 2
    expect(resHighest.projectedInventory.SlimeCondensate).toBe(0);
    assertMaterialConservation(req, inv, resHighest);

    // Counterexample demonstration: 'direct-first' priority:
    const resDirect = computeCraftingPlan(req, inv, { priority: 'direct-first' });
    // In direct-first, direct demand for Secretions (5) consumes all 5 crafted Secretions.
    // Zero Secretions promoted to Concentrate.
    expect(resDirect.craftingSteps.length).toBe(1);
    expect(resDirect.craftingSteps[0].count).toBe(5);
    expect(resDirect.adjustedShortages.SlimeConcentrate).toBe(10);
    expect(resDirect.adjustedShortages.SlimeSecretions).toBe(0);
    assertMaterialConservation(req, inv, resDirect);
  });

  it('Fixture 10: Mixed-tier inventory with no dead surplus', () => {
    // T0: Owned 9, Req 2 (Surplus 7)
    // T1: Owned 4, Req 3 (Surplus 1)
    // T2: Owned 1, Req 4 (Deficit 3)
    const req = { SlimeCondensate: 2, SlimeSecretions: 3, SlimeConcentrate: 4 };
    const inv = { SlimeCondensate: 9, SlimeSecretions: 4, SlimeConcentrate: 1 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    // 7 surplus Condensate crafts 2 Secretions (uses 6, leaving 1 leftover).
    // Total Secretions available = 1 surplus owned + 2 crafted = 3.
    // 3 Secretions crafts 1 Concentrate!
    // Concentrate shortage = 4 - 1 - 1 = 2 to farm.
    // Secretions shortage = 0.
    // Condensate shortage = 0.
    // Leftovers: 1 Condensate, 0 Secretions, 0 Concentrate.
    expect(res.craftingSteps[0].count).toBe(2);
    expect(res.craftingSteps[1].count).toBe(1);
    expect(res.adjustedShortages.SlimeConcentrate).toBe(2);
    expect(res.projectedInventory.SlimeCondensate).toBe(1);
    expect(res.projectedInventory.SlimeSecretions).toBe(0);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 11 & 12 & 13: Multiple characters/weapons sharing a global inventory pool', () => {
    // Character A needs 10 Condensate, 5 Secretions
    // Character B needs 5 Secretions, 2 Concentrate
    // Pre-aggregated gross demand: 10 Condensate, 10 Secretions, 2 Concentrate
    const req = {
      SlimeCondensate: 10,
      SlimeSecretions: 10,
      SlimeConcentrate: 2,
    };
    const inv = {
      SlimeCondensate: 100,
    };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    // 2 Concentrate needs 6 Secretions.
    // Total Secretions needed = 10 direct + 6 = 16.
    // 16 Secretions needs 48 Condensate.
    // Total Condensate needed = 10 direct + 48 = 58.
    // Leftover: 100 - 58 = 42.
    expect(res.craftingSteps[0].count).toBe(16);
    expect(res.craftingSteps[1].count).toBe(2);
    expect(res.projectedInventory.SlimeCondensate).toBe(42);
    expect(res.allMaterialsCoveredByCrafting).toBe(true);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 14: Multiple unrelated material families calculated independently', () => {
    const req = {
      SlimeConcentrate: 1,
      OminousMask: 1,
      PhilosophiesOfFreedom: 1,
    };
    const inv = {
      SlimeCondensate: 9,
      DamagedMask: 9,
      TeachingsOfFreedom: 9,
    };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.allMaterialsCoveredByCrafting).toBe(true);
    expect(res.craftingSteps.length).toBe(6); // 2 steps per family * 3 families
    expect(res.moraByFamily.Slime).toBe(3 * 25 + 1 * 50); // 125
    expect(res.moraByFamily.Hilichurl).toBe(3 * 25 + 1 * 50); // 125
    expect(res.moraByFamily.Freedom).toBe(3 * 175 + 1 * 550); // 1075
    expect(res.craftingMora).toBe(125 + 125 + 1075);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 15: Zero required items', () => {
    const req = { SlimeCondensate: 0, SlimeSecretions: 0 };
    const inv = { SlimeCondensate: 50, SlimeSecretions: 20 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(0);
    expect(res.projectedInventory.SlimeCondensate).toBe(50);
    expect(res.projectedInventory.SlimeSecretions).toBe(20);
    expect(res.allMaterialsDirectlyStocked).toBe(true);
    expect(res.allMaterialsCoveredByCrafting).toBe(true);
    expect(res.requiresCrafting).toBe(false);
  });

  it('Fixture 16: Already completed plans (directly stocked)', () => {
    const req = { SlimeCondensate: 5, SlimeSecretions: 5, SlimeConcentrate: 5 };
    const inv = { SlimeCondensate: 10, SlimeSecretions: 10, SlimeConcentrate: 10 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(0);
    expect(res.projectedInventory.SlimeCondensate).toBe(5);
    expect(res.projectedInventory.SlimeSecretions).toBe(5);
    expect(res.projectedInventory.SlimeConcentrate).toBe(5);
    expect(res.allMaterialsDirectlyStocked).toBe(true);
    expect(res.requiresCrafting).toBe(false);
  });

  it('Fixture 17, 18, 19, 20: Uncraftable materials and missing recipes', () => {
    const req = {
      EverflameSeed: 20, // Normal Boss (uncraftable)
      DvalinsSigh: 6, // Weekly Boss (uncraftable)
      BrilliantDiamondGemstone: 6, // Non-craftable AR reward gem
      UnknownMaterialX: 10, // Missing from registry
    };
    const inv = {
      EverflameSeed: 5,
      DvalinsSigh: 2,
      BrilliantDiamondChunk: 18, // Cannot craft into Gemstone!
    };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps.length).toBe(0);
    expect(res.adjustedShortages.EverflameSeed).toBe(15);
    expect(res.adjustedShortages.DvalinsSigh).toBe(4);
    expect(res.adjustedShortages.BrilliantDiamondGemstone).toBe(6);
    expect(res.adjustedShortages.UnknownMaterialX).toBe(10);
    expect(res.projectedInventory.BrilliantDiamondChunk).toBe(18); // Untouched
    expect(res.diagnostics.some((d) => d.itemId === 'UnknownMaterialX')).toBe(true);
  });

  it('Fixture 21: Malformed and negative input normalization', () => {
    const req = {
      SlimeConcentrate: '2' as unknown as number,
      SlimeSecretions: 5.8,
    };
    const inv = {
      SlimeCondensate: -10,
      SlimeSecretions: 'invalid_number' as unknown as number,
      SlimeConcentrate: null as unknown as number,
      Mora: NaN,
    };

    const res = computeCraftingPlan(req, inv);
    expect(res.directShortages.SlimeConcentrate).toBe(2);
    expect(res.directShortages.SlimeSecretions).toBe(5); // Floored
    expect(res.projectedInventory.SlimeCondensate).toBe(0); // Clamped from -10
    expect(res.diagnostics.some((d) => d.code === 'NEGATIVE_QUANTITY')).toBe(true);
    expect(res.diagnostics.some((d) => d.code === 'FRACTIONAL_QUANTITY')).toBe(true);
    expect(res.diagnostics.some((d) => d.code === 'NON_NUMERIC_STRING')).toBe(true);
  });

  it('Fixture 22: Crafting boundary remainders (1 and 2)', () => {
    const req = { SlimeSecretions: 2 };
    const inv = { SlimeCondensate: 8 }; // 8 = 2 * 3 + 2 remainder
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingSteps[0].count).toBe(2);
    expect(res.projectedInventory.SlimeCondensate).toBe(2); // Remainder 2
    expect(res.adjustedShortages.SlimeSecretions).toBe(0);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 23: Maximum-tier shortage with complete lower-tier depletion', () => {
    const req = { SlimeConcentrate: 20 }; // Needs 60 Secretions = 180 Condensate
    const inv = { SlimeCondensate: 90 };
    deepFreeze(req);
    deepFreeze(inv);

    const res = computeCraftingPlan(req, inv);
    // 90 Condensate crafts 30 Secretions -> 10 Concentrate
    expect(res.craftingSteps[0].count).toBe(30);
    expect(res.craftingSteps[1].count).toBe(10);
    expect(res.adjustedShortages.SlimeConcentrate).toBe(10); // 20 - 10
    expect(res.projectedInventory.SlimeCondensate).toBe(0);
    assertMaterialConservation(req, inv, res);
  });

  it('Fixture 24: Immutability assertion (Zero mutation of caller inputs)', () => {
    const req = { SlimeCondensate: 10 };
    const inv = { SlimeCondensate: 50 };
    deepFreeze(req);
    deepFreeze(inv);

    expect(() => computeCraftingPlan(req, inv)).not.toThrow();
  });

  it('Fixture 25: Correct allDone / allMaterialsCoveredByCrafting behavior', () => {
    const req = { SlimeSecretions: 1 };
    const inv = { SlimeCondensate: 3 };
    const res = computeCraftingPlan(req, inv);

    expect(res.allMaterialsDirectlyStocked).toBe(false);
    expect(res.allMaterialsCoveredByCrafting).toBe(true);
    expect(res.requiresCrafting).toBe(true);
  });

  it('Verified Mora Exceptions: Vishap Bone Shards and Mirror Maiden Prisms', () => {
    // 1. Vishap FossilizedBoneShard exception (50 Mora instead of 125)
    const vishapReq = { FossilizedBoneShard: 1 };
    const vishapInv = { SturdyBoneShard: 3 };
    const vishapRes = computeCraftingPlan(vishapReq, vishapInv);
    expect(vishapRes.craftingMora).toBe(50); // Verified exception!

    // 2. Mirror Maiden Crystal Prism (25 Mora) & Polarizing Prism (50 Mora)
    const maidenReq = { PolarizingPrism: 1 };
    const maidenInv = { DismalPrism: 9 };
    const maidenRes = computeCraftingPlan(maidenReq, maidenInv);
    // Dismal -> Crystal: 3 crafts * 25 Mora = 75
    // Crystal -> Polarizing: 1 craft * 50 Mora = 50
    // Total = 125 Mora (instead of standard 3*50 + 1*125 = 275 Mora)
    expect(maidenRes.craftingMora).toBe(125);
  });

  it('Section 10: Mora affordability and solvency testing', () => {
    const req = { SlimeConcentrate: 1 }; // Needs 9 Condensate, 3 Secretions crafts (75 Mora) + 1 Concentrate craft (50 Mora) = 125 Mora
    const inv = { SlimeCondensate: 9, Mora: 100 }; // 100 Mora owned, 125 needed

    const res = computeCraftingPlan(req, inv);
    expect(res.craftingMora).toBe(125);
    expect(res.allMaterialsCoveredByCrafting).toBe(true); // Materials ARE available
    expect(res.isAffordableMora).toBe(false); // Mora is INSUFFICIENT
    expect(res.remainingMoraAfterCrafting).toBe(0);
    expect(res.diagnostics.some((d) => d.code === 'INSUFFICIENT_MORA')).toBe(true);

    // With explicit affordability option
    const resSolvent = computeCraftingPlan(req, inv, { affordabilityMora: 500 });
    expect(resSolvent.isAffordableMora).toBe(true);
    expect(resSolvent.remainingMoraAfterCrafting).toBe(375);
  });

  it('Fixture 28: Performance Benchmark across entire 108-family catalog', () => {
    const catalogReq: Record<string, number> = {};
    const catalogInv: Record<string, number> = {};

    getAllCraftingFamilies().forEach((fam) => {
      fam.tiers.forEach((tier, i) => {
        catalogReq[tier.id] = (i + 1) * 10;
        catalogInv[tier.id] = (4 - i) * 15;
      });
    });

    const start = performance.now();
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      computeCraftingPlan(catalogReq, catalogInv);
    }
    const duration = performance.now() - start;
    const avgPerCall = duration / iterations;

    // Performance target: well under 10ms per calculation on realistic catalog scale across 50 iterations
    expect(avgPerCall).toBeLessThan(10);
  });
});

