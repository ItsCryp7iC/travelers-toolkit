import { describe, it, expect } from 'vitest';
import { computeFamilyStatus } from './plannerStatus';

describe('computeFamilyStatus Unit & Acceptance Fixture Suite (PLANNER-UI-R2.1)', () => {
  // ── Fixture A: Valberry (Non-craftable Local Specialty) ──
  it('Fixture A: Valberry with Need 60, Have 5, To Farm 55 displays Farming required', () => {
    const familyObj = {
      familyName: 'Valberry',
      type: 'local_specialty',
      familyData: {
        familyId: 'Valberry',
        tiers: [{ id: 'Valberry', name: 'Valberry', rarity: 1 }],
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { Valberry: 60 },
      inventory: { Valberry: 5 },
      craftingMode: 'crafting-aware',
    });

    expect(status).toEqual({
      label: 'Farming required',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    });
  });

  // ── Fixture B: Humanoid Ruin Machine (Elite mob, craftable family, no crafting steps needed) ──
  it('Fixture B: Humanoid Ruin Machine with positive shortages on all tiers displays Farming required', () => {
    const familyObj = {
      familyName: 'Humanoid Ruin Machine',
      type: 'elite_mob',
      familyData: {
        familyId: 'Chaos',
        tiers: [
          { id: 'ChaosDevice', name: 'Chaos Device', rarity: 2 },
          { id: 'ChaosCircuit', name: 'Chaos Circuit', rarity: 3 },
          { id: 'ChaosCore', name: 'Chaos Core', rarity: 4 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: false, // No crafting steps possible with 0 lower tier inventory
      allCoveredByCrafting: false,
      totalShortage: 1128,
      adjustedShortages: {
        ChaosDevice: 254,
        ChaosCircuit: 273,
        ChaosCore: 601,
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { ChaosDevice: 254, ChaosCircuit: 273, ChaosCore: 601 },
      inventory: { ChaosDevice: 0, ChaosCircuit: 0, ChaosCore: 0 },
      craftingMode: 'crafting-aware',
      familyPlan,
    });

    expect(status).toEqual({
      label: 'Farming required',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    });
  });

  // ── Fixture C: Abyss Mage (Craftable with crafting steps + remaining shortages) ──
  it('Fixture C: Abyss Mage requiring both farming and crafting displays Farming required', () => {
    const familyObj = {
      familyName: 'Abyss Mage',
      type: 'mob',
      familyData: {
        familyId: 'LeyLineSprout',
        tiers: [
          { id: 'DeadLeyLineBranch', name: 'Dead Ley Line Branch', rarity: 2 },
          { id: 'DeadLeyLineLeaves', name: 'Dead Ley Line Leaves', rarity: 3 },
          { id: 'LeyLineSprouts', name: 'Ley Line Sprouts', rarity: 4 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: false,
      totalShortage: 30,
      steps: [{ outputItemId: 'DeadLeyLineLeaves', totalOutputProduced: 5 }],
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { DeadLeyLineBranch: 10, DeadLeyLineLeaves: 20, LeyLineSprouts: 15 },
      inventory: { DeadLeyLineBranch: 5, DeadLeyLineLeaves: 2, LeyLineSprouts: 0 },
      craftingMode: 'crafting-aware',
      familyPlan,
    });

    expect(status).toEqual({
      label: 'Farming required',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    });
  });

  // ── Fixture D: Philanemo Mushroom (Fully Stocked Non-craftable) ──
  it('Fixture D: Philanemo Mushroom with Need 10, Have 18 displays Already stocked', () => {
    const familyObj = {
      familyName: 'Philanemo Mushroom',
      type: 'local_specialty',
      familyData: {
        familyId: 'PhilanemoMushroom',
        tiers: [{ id: 'PhilanemoMushroom', name: 'Philanemo Mushroom', rarity: 1 }],
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { PhilanemoMushroom: 10 },
      inventory: { PhilanemoMushroom: 18 },
      craftingMode: 'crafting-aware',
    });

    expect(status).toEqual({
      label: 'Already stocked',
      bg: 'rgba(74, 222, 128, 0.15)',
      text: '#4ADE80',
      border: 'rgba(74, 222, 128, 0.3)',
      icon: '✅',
    });
  });

  // ── Fixture E: Slime (Crafting covers all vs Insufficient inventory) ──
  it('Fixture E1: Slime when guaranteed crafting covers all remaining shortages displays Crafting required — No additional farming', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: true,
      totalShortage: 0,
      adjustedShortages: {
        SlimeCondensate: 0,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { SlimeCondensate: 0, SlimeSecretions: 50, SlimeConcentrate: 30 },
      inventory: { SlimeCondensate: 1000, SlimeSecretions: 10, SlimeConcentrate: 5 },
      craftingMode: 'crafting-aware',
      familyPlan,
    });

    expect(status).toEqual({
      label: 'Crafting required — No additional farming',
      bg: 'rgba(78, 201, 176, 0.15)',
      text: '#4EC9B0',
      border: 'rgba(78, 201, 176, 0.3)',
      icon: '🔨',
    });
  });

  it('Fixture E2: Slime when inventory is insufficient displays Farming required', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: false,
      totalShortage: 45,
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { SlimeCondensate: 0, SlimeSecretions: 50, SlimeConcentrate: 30 },
      inventory: { SlimeCondensate: 20, SlimeSecretions: 5, SlimeConcentrate: 0 },
      craftingMode: 'crafting-aware',
      familyPlan,
    });

    expect(status).toEqual({
      label: 'Farming required',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    });
  });

  // ── Fixture F: Probabilistic bonus forecast ──
  it('Fixture F: Probabilistic bonus coverage displays honest Likely covered label', () => {
    const familyObj = {
      familyName: 'Talent Books',
      type: 'domain',
      familyData: {
        familyId: 'Freedom',
        tiers: [
          { id: 'TeachingsOfFreedom', name: 'Teachings of Freedom', rarity: 2 },
          { id: 'GuideToFreedom', name: 'Guide to Freedom', rarity: 3 },
          { id: 'PhilosophiesOfFreedom', name: 'Philosophies of Freedom', rarity: 4 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: false,
      totalShortage: 8,
    };

    const familyForecast = {
      isEligible: true,
      isLikelyCovered: true,
      totalExpectedShortage: 0,
    };

    const statusRefund = computeFamilyStatus({
      familyObj,
      globalCosts: { TeachingsOfFreedom: 0, GuideToFreedom: 20, PhilosophiesOfFreedom: 10 },
      inventory: { TeachingsOfFreedom: 50, GuideToFreedom: 5, PhilosophiesOfFreedom: 2 },
      craftingMode: 'crafting-aware',
      familyPlan,
      isBonusActive: true,
      familyForecast,
      craftingBonusOptions: { enabled: true, bonusType: 'ingredient_refund' },
    });

    expect(statusRefund).toEqual({
      label: 'Likely covered with 25% Refund',
      bg: 'rgba(96, 165, 250, 0.15)',
      text: '#60A5FA',
      border: 'rgba(96, 165, 250, 0.3)',
      icon: '🎲',
    });

    const statusDouble = computeFamilyStatus({
      familyObj,
      globalCosts: { TeachingsOfFreedom: 0, GuideToFreedom: 20, PhilosophiesOfFreedom: 10 },
      inventory: { TeachingsOfFreedom: 50, GuideToFreedom: 5, PhilosophiesOfFreedom: 2 },
      craftingMode: 'crafting-aware',
      familyPlan,
      isBonusActive: true,
      familyForecast,
      craftingBonusOptions: { enabled: true, bonusType: 'double_product' },
    });

    expect(statusDouble).toEqual({
      label: 'Likely covered with 10% Double',
      bg: 'rgba(96, 165, 250, 0.15)',
      text: '#60A5FA',
      border: 'rgba(96, 165, 250, 0.3)',
      icon: '🎲',
    });
  });

  // ── Bonus reduces farming but does not eliminate it ──
  it('Farming reduced with bonus when forecast reduces expected shortage below guaranteed shortage', () => {
    const familyObj = {
      familyName: 'Hilichurl Masks',
      type: 'mob',
      familyData: {
        familyId: 'Mask',
        tiers: [
          { id: 'DamagedMask', name: 'Damaged Mask', rarity: 1 },
          { id: 'StainedMask', name: 'Stained Mask', rarity: 2 },
          { id: 'OminousMask', name: 'Ominous Mask', rarity: 3 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: false,
      totalShortage: 50,
    };

    const familyForecast = {
      isEligible: true,
      isLikelyCovered: false,
      totalExpectedShortage: 32,
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { DamagedMask: 0, StainedMask: 60, OminousMask: 40 },
      inventory: { DamagedMask: 30, StainedMask: 10, OminousMask: 5 },
      craftingMode: 'crafting-aware',
      familyPlan,
      isBonusActive: true,
      familyForecast,
      craftingBonusOptions: { enabled: true, bonusType: 'ingredient_refund' },
    });

    expect(status).toEqual({
      label: 'Farming reduced with bonus',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    });
  });

  // ── Raw Shortages Mode ──
  it('Raw Shortages mode ignores crafting plans and bonus forecasts', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
        ],
      },
    };

    const familyPlan = {
      isCraftable: true,
      allCoveredByCrafting: true, // Would be covered in crafting mode
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { SlimeCondensate: 0, SlimeSecretions: 50 },
      inventory: { SlimeCondensate: 500, SlimeSecretions: 10 },
      craftingMode: 'raw',
      familyPlan,
    });

    // In raw mode, 10 < 50 means raw farming is required
    expect(status).toEqual({
      label: 'Farming required',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    });
  });

  it('Raw Shortages mode displays Already stocked when all raw requirements are met', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
        ],
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { SlimeCondensate: 10, SlimeSecretions: 50 },
      inventory: { SlimeCondensate: 20, SlimeSecretions: 55 },
      craftingMode: 'raw',
    });

    expect(status).toEqual({
      label: 'Already stocked',
      bg: 'rgba(74, 222, 128, 0.15)',
      text: '#4ADE80',
      border: 'rgba(74, 222, 128, 0.3)',
      icon: '✅',
    });
  });

  // ── Case F: No Demand ──
  it('Returns null when total demand across all tiers is 0', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
        ],
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { SlimeCondensate: 0 },
      inventory: { SlimeCondensate: 100 },
      craftingMode: 'crafting-aware',
    });

    expect(status).toBeNull();
  });

  // ── Currency / Mora cards ──
  it('Returns null for currency cards so no farming badge is displayed', () => {
    const familyObj = {
      familyName: 'Mora',
      type: 'currency',
      familyData: {
        familyId: 'Mora',
        tiers: [{ id: 'Mora', name: 'Mora', rarity: 3 }],
      },
    };

    const status = computeFamilyStatus({
      familyObj,
      globalCosts: { Mora: 5000000 },
      inventory: { Mora: 1000000 },
      craftingMode: 'crafting-aware',
    });

    expect(status).toBeNull();
  });
});

