import { describe, it, expect, beforeEach } from 'vitest';
import { calculateWeaponCost } from './calculator';
import { aggregateRosterCosts, computeToFarm } from './aggregator';
import weaponsData from '../data/weapons.json';
import useStore from '../store/useStore';
import { executeRepairTransaction } from './progressionRecovery';
import { diagnoseProgressionState } from './progressionContracts';
import { normalizeBackupForImport } from './backupUtils';

const favoniusSword = weaponsData.find((w) => w.name === 'Favonius Sword');
const stringlessBow = weaponsData.find((w) => w.name === 'The Stringless');

describe('Phase C2C-D — Event Weapon Enhancement Bonus & Cross-Page Parity', () => {
  beforeEach(() => {
    useStore.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
    });
  });

  // 1. Bonus disabled
  it('1. calculates standard enhancement requirements when bonus is disabled', () => {
    const cost = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, false, {});
    // 4★ 1 to 90 base EXP: 6,042,650
    expect(cost.total_exp).toBe(6042650);
    expect(cost.effective_exp).toBe(6042650);
    expect(cost.has_event_bonus).toBe(false);
    expect(cost.mystic_ore).toBe(604);
    expect(cost.fine_ore).toBe(1);
    expect(cost.normal_ore).toBe(2);
    // Enhancement Mora: 604,265; 4★ Ascension Mora: 150,000; Total: 754,265
    expect(cost.total_mora).toBe(754265);
  });

  // 2. Bonus enabled
  it('2. calculates 1.5× event-adjusted enhancement requirements when bonus is enabled', () => {
    const cost = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, true, {});
    // 4★ 1 to 90 effective EXP: ceil(6,042,650 / 1.5) = 4,028,434
    expect(cost.total_exp).toBe(6042650);
    expect(cost.effective_exp).toBe(4028434);
    expect(cost.has_event_bonus).toBe(true);
    expect(cost.mystic_ore).toBe(402);
    expect(cost.fine_ore).toBe(4);
    expect(cost.normal_ore).toBe(2);
    // Enhancement Mora: 402,844; 4★ Ascension Mora: 150,000; Total: 552,844
    expect(cost.total_mora).toBe(552844);
  });

  // 3. Leveling-only progression
  it('3. applies bonus strictly to leveling-only progression without ascension fee', () => {
    // Favonius Sword Level 1 A0 -> 20 A0 (81,000 EXP)
    const normal = calculateWeaponCost(favoniusSword, 1, 20, 0, 0, false, {});
    const bonus = calculateWeaponCost(favoniusSword, 1, 20, 0, 0, true, {});

    expect(normal.total_exp).toBe(81000);
    expect(normal.total_mora).toBe(8100);
    expect(normal.mystic_ore).toBe(8);

    // ceil(81,000 / 1.5) = 54,000 EXP
    expect(bonus.effective_exp).toBe(54000);
    expect(bonus.total_mora).toBe(5400);
    expect(bonus.mystic_ore).toBe(5);
    expect(bonus.fine_ore).toBe(2);
    expect(bonus.normal_ore).toBe(0);
  });

  // 4. Ascension-only progression
  it('4. leaves ascension-only progression completely identical whether bonus is enabled or disabled', () => {
    // Favonius Sword Level 20 A0 -> 20 A1 (0 EXP, Phase 1 Ascension)
    const normal = calculateWeaponCost(favoniusSword, 20, 20, 0, 1, false, {});
    const bonus = calculateWeaponCost(favoniusSword, 20, 20, 0, 1, true, {});

    expect(normal.total_mora).toBe(5000);
    expect(bonus.total_mora).toBe(5000);
    expect(bonus.mystic_ore).toBe(0);
    expect(bonus.fine_ore).toBe(0);
    expect(bonus.normal_ore).toBe(0);
    expect(bonus['2_star_ascension_material']).toBe(normal['2_star_ascension_material']);
  });

  // 5. Combined leveling and ascension
  it('5. correctly computes combined leveling and ascension progression with bonus', () => {
    // Favonius Sword Level 20 A0 -> 40 A2
    // EXP: 496,125 - 81,000 = 415,125 EXP
    // Ascension Mora: 5,000 (A1) + 15,000 (A2) = 20,000
    const normal = calculateWeaponCost(favoniusSword, 20, 40, 0, 2, false, {});
    const bonus = calculateWeaponCost(favoniusSword, 20, 40, 0, 2, true, {});

    // Normal: 41,513 enhancement Mora + 20,000 ascension = 61,513
    expect(normal.total_mora).toBe(61513);
    expect(normal.mystic_ore).toBe(41);

    // Bonus: ceil(415,125 / 1.5) = 276,750 EXP -> 27,675 enhancement Mora + 20,000 ascension = 47,675
    expect(bonus.effective_exp).toBe(276750);
    expect(bonus.total_mora).toBe(47675);
    expect(bonus.mystic_ore).toBe(27);
    expect(bonus.fine_ore).toBe(3);
    expect(bonus.normal_ore).toBe(2);
  });

  // 6. Partially leveled weapon
  it('6. applies bonus to remaining levels on a partially leveled weapon', () => {
    // Favonius Sword Level 50 A2 -> 90 A6
    // Base EXP: 6,042,650 - 914,850 = 5,127,800 EXP
    // Ascension Mora: Phase 2 (20k) + Phase 3 (30k) + Phase 4 (35k) + Phase 5 (45k) = 130,000
    const bonus = calculateWeaponCost(favoniusSword, 50, 90, 2, 6, true, {});
    // ceil(5,127,800 / 1.5) = 3,418,534 EXP -> 341,854 enhancement Mora + 130,000 ascension = 471,854
    expect(bonus.effective_exp).toBe(3418534);
    expect(bonus.mystic_ore).toBe(341);
    expect(bonus.fine_ore).toBe(4);
    expect(bonus.normal_ore).toBe(2);
    expect(bonus.total_mora).toBe(471854);
  });

  // 7. Full weapon progression material parity
  it('7. preserves exact ascension material quantities between bonus enabled and disabled', () => {
    const normal = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, false, {});
    const bonus = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, true, {});

    expect(bonus['2_star_ascension_material']).toBe(normal['2_star_ascension_material']);
    expect(bonus['3_star_ascension_material']).toBe(normal['3_star_ascension_material']);
    expect(bonus['4_star_ascension_material']).toBe(normal['4_star_ascension_material']);
    expect(bonus['5_star_ascension_material']).toBe(normal['5_star_ascension_material']);
    expect(bonus['2_star_enhancement_material']).toBe(normal['2_star_enhancement_material']);
    expect(bonus['3_star_enhancement_material']).toBe(normal['3_star_enhancement_material']);
    expect(bonus['4_star_enhancement_material']).toBe(normal['4_star_enhancement_material']);
    expect(bonus['1_star_enemy_material']).toBe(normal['1_star_enemy_material']);
    expect(bonus['2_star_enemy_material']).toBe(normal['2_star_enemy_material']);
    expect(bonus['3_star_enemy_material']).toBe(normal['3_star_enemy_material']);
  });

  // 8. Small EXP remainder
  it('8. handles small EXP remainder properly with event bonus active', () => {
    // 4★ Level 1 A0 -> 5 A0 requires 3,125 EXP
    const normal = calculateWeaponCost(favoniusSword, 1, 5, 0, 0, false, {});
    const bonus = calculateWeaponCost(favoniusSword, 1, 5, 0, 0, true, {});

    // Normal: 3,125 EXP -> 0 Mystic, 1 Fine (2,000), 3 Normal (1,200) -> 75 wasted
    expect(normal.mystic_ore).toBe(0);
    expect(normal.fine_ore).toBe(1);
    expect(normal.normal_ore).toBe(3);

    // Bonus: ceil(3,125 / 1.5) = 2,084 EXP -> 0 Mystic, 1 Fine (2,000), 1 Normal (400) -> 316 wasted
    expect(bonus.effective_exp).toBe(2084);
    expect(bonus.mystic_ore).toBe(0);
    expect(bonus.fine_ore).toBe(1);
    expect(bonus.normal_ore).toBe(1);
    expect(bonus.total_mora).toBe(209);
  });

  // 9. Multiple ore types in aggregator and computeToFarm
  it('9. aggregates multiple ore types accurately under event bonus demand', () => {
    const trackedWeapons = [{
      id: 'w-fav-bonus',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 5,
      ascension: 0,
      targetAscension: 0,
      hasEventBonus: true,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    expect(totals.totalCosts.FineEnhancementOre).toBe(1);
    expect(totals.totalCosts.EnhancementOre).toBe(1);
    expect(totals.totalCosts.MysticEnhancementOre).toBeUndefined();

    const toFarm = computeToFarm(totals, {});
    expect(toFarm.fineOre.toFarm).toBe(1);
    expect(toFarm.normalOre.toFarm).toBe(1);
    expect(toFarm.oreExp.outstandingExp).toBe(2400);
  });

  // 10. Two identical weapon names with separate UUIDs
  it('10. maintains independent bonus settings on duplicate weapon copies', () => {
    const w1 = {
      id: 'fav-copy-1',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: true,
    };
    const w2 = {
      id: 'fav-copy-2',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: false,
    };

    const totals = aggregateRosterCosts({}, [w1, w2]);
    expect(totals.breakdown[0].totalCosts.Mora).toBe(552844);
    expect(totals.breakdown[1].totalCosts.Mora).toBe(754265);
    expect(totals.totalCosts.Mora).toBe(552844 + 754265);
    expect(totals.totalCosts.MysticEnhancementOre).toBe(402 + 604);
  });

  // 11. Bulk edit of the bonus flag
  it('11. bulk updates event bonus flag across multiple tracked weapons', () => {
    useStore.setState({
      trackedWeapons: [
        { id: 'w1', weaponName: 'Favonius Sword', level: 1, targetLevel: 90, ascension: 0, targetAscension: 6, hasEventBonus: false },
        { id: 'w2', weaponName: 'The Stringless', level: 1, targetLevel: 90, ascension: 0, targetAscension: 6, hasEventBonus: false },
      ],
    });

    useStore.getState().bulkUpdateWeapons(['w1', 'w2'], { hasEventBonus: true });

    const state = useStore.getState();
    expect(state.trackedWeapons[0].hasEventBonus).toBe(true);
    expect(state.trackedWeapons[1].hasEventBonus).toBe(true);
    expect(state.trackedWeapons[0].costs.has_event_bonus).toBe(true);
    expect(state.trackedWeapons[0].costs.total_mora).toBe(552844);
  });

  // 12. Flag persistence after store manipulation
  it('12. preserves hasEventBonus on single weapon update and creation', () => {
    const id = useStore.getState().addTrackedWeapon('Favonius Sword', null, {
      currentLevel: 1,
      targetLevel: 90,
      currentAscension: 0,
      targetAscension: 6,
      hasEventBonus: true,
    });

    let state = useStore.getState();
    let weapon = state.trackedWeapons.find((w) => w.id === id);
    expect(weapon.hasEventBonus).toBe(true);
    expect(weapon.costs.total_mora).toBe(552844);

    // Update level, ensure hasEventBonus remains intact
    useStore.getState().updateTrackedWeapon(id, { level: 20 });
    state = useStore.getState();
    weapon = state.trackedWeapons.find((w) => w.id === id);
    expect(weapon.hasEventBonus).toBe(true);
    expect(weapon.costs.total_exp).toBe(6042650 - 81000);
  });

  // 13. Backup/restore fidelity
  it('13. preserves hasEventBonus through backup normalization and validation', () => {
    const rawBackup = {
      app: 'travelers-toolkit',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        inventory: {},
        trackedWeapons: [
          {
            id: 'backup-weapon-1',
            weaponName: 'Favonius Sword',
            level: 80,
            targetLevel: 90,
            ascension: 5,
            targetAscension: 6,
            hasEventBonus: true,
          },
        ],
      },
    };

    const normalized = normalizeBackupForImport(rawBackup);
    expect(normalized.trackedWeapons[0].hasEventBonus).toBe(true);
  });

  // 14. GOOD import default behavior
  it('14. defaults new imported weapons to undefined/falsy hasEventBonus and preserves existing', () => {
    useStore.setState({
      trackedWeapons: [
        {
          id: 'existing-w',
          weaponName: 'Favonius Sword',
          level: 20,
          targetLevel: 90,
          ascension: 1,
          targetAscension: 6,
          hasEventBonus: true,
          assignedTo: 'Jean',
        },
      ],
      roster: {
        Jean: { level: 80, ascension: 6, equippedWeaponId: 'existing-w' },
      },
    });

    const goodPayload = {
      format: 'GOOD',
      version: 2,
      source: 'Test',
      characters: [{ name: 'Jean', level: 80, ascension: 6, talents: { normal: 1, skill: 1, burst: 1 } }],
      weapons: [
        { weaponName: 'Favonius Sword', level: 40, ascension: 2, location: 'Jean', refinement: 1 },
        { weaponName: 'The Stringless', level: 1, ascension: 0, location: '', refinement: 1 },
      ],
    };

    useStore.getState().importGoodData(goodPayload);

    const weapons = useStore.getState().trackedWeapons;
    const fav = weapons.find((w) => w.weaponName === 'Favonius Sword');
    const str = weapons.find((w) => w.weaponName === 'The Stringless');

    // Existing weapon kept explicit true
    expect(fav.hasEventBonus).toBe(true);
    // Newly imported weapon did not accidentally enable bonus
    expect(Boolean(str.hasEventBonus)).toBe(false);
  });

  // 15. Raiden/Wanderer discounts combined with the bonus
  it('15. correctly combines 1.5× enhancement bonus with character ascension Mora discounts', () => {
    // 4★ Sword with Raiden Shogun:
    // Event enhancement Mora: 402,844
    // Raiden discounted ascension Mora: 150,000 / 2 = 75,000
    // Total: 477,844
    const swordWithRaiden = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, true, { 'Raiden Shogun': {} });
    expect(swordWithRaiden.has_event_bonus).toBe(true);
    expect(swordWithRaiden.has_ascension_discount).toBe(true);
    expect(swordWithRaiden.discount_source).toBe('Raiden Shogun');
    expect(swordWithRaiden.total_mora).toBe(477844);

    // 4★ Bow with Wanderer:
    // Event enhancement Mora: 402,844
    // Wanderer discounted ascension Mora: 150,000 / 2 = 75,000
    // Total: 477,844
    const bowWithWanderer = calculateWeaponCost(stringlessBow, 1, 90, 0, 6, true, { Wanderer: {} });
    expect(bowWithWanderer.has_event_bonus).toBe(true);
    expect(bowWithWanderer.has_ascension_discount).toBe(true);
    expect(bowWithWanderer.discount_source).toBe('Wanderer');
    expect(bowWithWanderer.total_mora).toBe(477844);
  });

  // 16. No discount stacking / cross-type contamination
  it('16. prevents character ascension discounts from crossing weapon types under event bonus', () => {
    // Sword with Wanderer (no discount on sword)
    const swordWithWanderer = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, true, { Wanderer: {} });
    expect(swordWithWanderer.has_ascension_discount).toBe(false);
    expect(swordWithWanderer.total_mora).toBe(552844);

    // Bow with Raiden (no discount on bow)
    const bowWithRaiden = calculateWeaponCost(stringlessBow, 1, 90, 0, 6, true, { 'Raiden Shogun': {} });
    expect(bowWithRaiden.has_ascension_discount).toBe(false);
    expect(bowWithRaiden.total_mora).toBe(552844);
  });

  // 17. Ascension Mora unaffected by the EXP bonus
  it('17. proves ascension Mora is strictly identical between bonus enabled and disabled', () => {
    const normal = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, false, {});
    const bonus = calculateWeaponCost(favoniusSword, 1, 90, 0, 6, true, {});

    const normalEnhancementMora = Math.ceil(normal.total_exp / 10);
    const bonusEnhancementMora = Math.ceil(bonus.effective_exp / 10);

    const normalAscensionMora = normal.total_mora - normalEnhancementMora;
    const bonusAscensionMora = bonus.total_mora - bonusEnhancementMora;

    expect(normalAscensionMora).toBe(150000);
    expect(bonusAscensionMora).toBe(150000);
    expect(normal.total_mora - bonus.total_mora).toBe(normalEnhancementMora - bonusEnhancementMora);
  });

  // 18. Invalid progression reporting
  it('18. flags invalid weapon progression records without performing bonus calculation', () => {
    const invalidCost = calculateWeaponCost(favoniusSword, 1, 90, 6, 6, true, {});
    expect(invalidCost.isInvalid).toBe(true);
    expect(invalidCost.total_mora).toBe(0);
    expect(invalidCost.mystic_ore).toBeUndefined();
  });

  // 19. Armory Table & Card parity
  it('19. enforces exact Mora parity between Armory Table and Card calculations with bonus', () => {
    const weaponEntry = {
      id: 'w-table-card-parity',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: true,
    };
    const roster = { 'Raiden Shogun': {} };

    // Table invocation pattern (Weapons.jsx:69)
    const tableCost = calculateWeaponCost(
      favoniusSword,
      weaponEntry.level,
      weaponEntry.targetLevel,
      weaponEntry.ascension,
      weaponEntry.targetAscension,
      Boolean(weaponEntry.hasEventBonus),
      roster
    );

    // Card invocation pattern (WeaponCard.jsx:66)
    const cardCost = calculateWeaponCost(
      favoniusSword,
      weaponEntry.level,
      weaponEntry.targetLevel,
      weaponEntry.ascension,
      weaponEntry.targetAscension,
      Boolean(weaponEntry.hasEventBonus),
      roster
    );

    expect(tableCost.total_mora).toBe(477844);
    expect(cardCost.total_mora).toBe(477844);
  });

  // 20. Resource Planner parity
  it('20. enforces exact Mora parity between Planner aggregation and Armory with bonus', () => {
    const weaponEntry = {
      id: 'w-planner-parity',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: true,
    };
    const roster = {
      'Raiden Shogun': {
        level: 90,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 10, skill: 10, burst: 10 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
    };

    const totals = aggregateRosterCosts(roster, [weaponEntry]);
    const weaponBreakdown = totals.breakdown.find((b) => b.isWeapon);
    expect(weaponBreakdown.totalCosts.Mora).toBe(477844);
    expect(totals.totalCosts.Mora).toBe(477844);
  });

  // 21. Inventory subtraction under event bonus
  it('21. pools inventory against event-adjusted ore requirements correctly', () => {
    const totals = {
      totalCosts: {
        MysticEnhancementOre: 402,
        FineEnhancementOre: 4,
        EnhancementOre: 2,
        Mora: 552844,
      },
      categories: {
        MysticEnhancementOre: 'mysticOre',
        FineEnhancementOre: 'mysticOre',
        EnhancementOre: 'mysticOre',
        Mora: 'mora',
      },
      rarities: {
        MysticEnhancementOre: 3,
        FineEnhancementOre: 2,
        EnhancementOre: 1,
        Mora: 3,
      },
    };

    // User owns 300 Mystic Ores (3,000,000 EXP out of 4,028,800 EXP required)
    const toFarm = computeToFarm(totals, { MysticEnhancementOre: 300, Mora: 600000 });
    expect(toFarm.allDone).toBe(false);
    expect(toFarm.oreExp.outstandingExp).toBe(1028800);
    // Outstanding 1,028,800 EXP -> 102 Mystic (1,020,000), 4 Fine (8,000), 2 Normal (800)
    expect(toFarm.mysticOre.toFarm).toBe(102);
    expect(toFarm.fineOre.toFarm).toBe(4);
    expect(toFarm.normalOre.toFarm).toBe(2);
    expect(toFarm.mora.toFarm).toBe(0);
  });

  // 22. allDone correctness with event bonus
  it('22. marks allDone true when inventory satisfies event-adjusted ore requirements', () => {
    const totals = {
      totalCosts: {
        MysticEnhancementOre: 402,
        FineEnhancementOre: 4,
        EnhancementOre: 2,
        Mora: 552844,
      },
      categories: {
        MysticEnhancementOre: 'mysticOre',
        FineEnhancementOre: 'mysticOre',
        EnhancementOre: 'mysticOre',
        Mora: 'mora',
      },
      rarities: {
        MysticEnhancementOre: 3,
        FineEnhancementOre: 2,
        EnhancementOre: 1,
        Mora: 3,
      },
    };

    // Exactly 403 Mystic Ores owned (4,030,000 EXP >= 4,028,800 gross EXP) and sufficient Mora
    const toFarm = computeToFarm(totals, { MysticEnhancementOre: 403, Mora: 552844 });
    expect(toFarm.oreExp.outstandingExp).toBe(0);
    expect(toFarm.mysticOre.toFarm).toBe(0);
    expect(toFarm.fineOre.toFarm).toBe(0);
    expect(toFarm.normalOre.toFarm).toBe(0);
    expect(toFarm.mora.toFarm).toBe(0);
    expect(toFarm.allDone).toBe(true);
  });

  // 23. All 13 Planner category behavior
  it('23. guarantees non-ore categories remain unaffected and informational metrics never leak', () => {
    const trackedWeapons = [{
      id: 'fav-cat-check',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: true,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    const toFarm = computeToFarm(totals, {});

    // Ensure metrics never appear in categories
    expect(totals.categories.has_event_bonus).toBeUndefined();
    expect(totals.categories.effective_exp).toBeUndefined();
    expect(totals.categories.total_exp).toBeUndefined();
    expect(totals.categories.wasted_exp).toBeUndefined();

    // Check official categories
    expect(toFarm.weaponAscMats.length).toBeGreaterThan(0);
    expect(toFarm.eliteMob.length).toBeGreaterThan(0);
    expect(toFarm.mob.length).toBeGreaterThan(0);
    expect(toFarm.totalItems).toBeGreaterThan(0);
  });

  // 24. Existing C2B recovery regression coverage
  it('24. truthfully preserves hasEventBonus across progression scan and repair transactions', () => {
    const corruptedState = {
      roster: {},
      trackedWeapons: [
        {
          id: 'corrupt-w-bonus',
          weaponName: 'Favonius Sword',
          level: 1,
          targetLevel: 90,
          ascension: 6, // Invalid: Lv 1 A6
          targetAscension: 6,
          hasEventBonus: true,
        },
      ],
      inventory: {},
    };

    const diag = diagnoseProgressionState({ trackedWeapons: corruptedState.trackedWeapons, weaponsData });
    expect(diag.isValid).toBe(false);
    expect(diag.invalidWeaponsCount).toBe(1);
    expect(diag.invalidWeapons[0].entry.hasEventBonus).toBe(true);

    const repairs = [
      {
        id: 'corrupt-w-bonus',
        type: 'weapon',
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
      },
    ];

    let appliedState = null;
    const result = executeRepairTransaction({
      repairs,
      getState: () => corruptedState,
      setState: (next) => {
        appliedState = next;
      },
      backupValidated: true,
      persistenceStorage: null,
      weaponsData,
    });
    expect(result.success).toBe(true);

    const repairedWeapon = appliedState.trackedWeapons[0];
    expect(repairedWeapon.hasEventBonus).toBe(true);
    expect(repairedWeapon.ascension).toBe(0);
    expect(repairedWeapon.calculatedCosts.has_event_bonus).toBe(true);
    expect(repairedWeapon.calculatedCosts.total_mora).toBe(552844);
  });
});
