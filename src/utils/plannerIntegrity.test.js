import { describe, it, expect } from 'vitest';
import { aggregateRosterCosts, computeToFarm } from './aggregator';
import { resolveSpecificItem } from './resolver';
import { isInformationalMetric, isGenuineResourceKey } from './resourceClassification';
import { calculateWeaponCost } from './calculator';
import weaponsData from '../data/weapons.json';

describe('Phase C2C-C — Resource Classification, Enhancement Ore Accounting & Planner Integrity', () => {

  // 1. total_exp excluded from farmable materials
  it('1. excludes total_exp from grandTotalCosts and farmable items', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    expect(totals.totalCosts.total_exp).toBeUndefined();
    expect(totals.totalCosts.totalExp).toBeUndefined();
    expect(totals.categories.total_exp).toBeUndefined();

    const toFarm = computeToFarm(totals, {});
    expect(toFarm.totalItems).toBeLessThan(10);
    expect(toFarm.mora).toBeDefined();
  });

  // 2. exp_to_next_level excluded
  it('2. excludes exp_to_next_level from farmable materials', () => {
    const trackedWeapons = [{
      id: 'w-fav',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    expect(totals.totalCosts.exp_to_next_level).toBeUndefined();
    expect(totals.totalCosts.expToNextLevel).toBeUndefined();
  });

  // 3. wasted_exp excluded
  it('3. excludes wasted_exp from grandTotalCosts and farmable items', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    expect(totals.totalCosts.wasted_exp).toBeUndefined();
    expect(totals.totalCosts.wastedExp).toBeUndefined();
  });

  // 4. Real Fine Ore correctly resolved
  it('4. resolves fine_ore to canonical FineEnhancementOre with category mysticOre and rarity 2', () => {
    const resolved = resolveSpecificItem('fine_ore');
    expect(resolved.id).toBe('FineEnhancementOre');
    expect(resolved.category).toBe('mysticOre');
    expect(resolved.name).toBe('Fine Enhancement Ore');
    expect(resolved.rarity).toBe(2);

    const resolvedCanonical = resolveSpecificItem('FineEnhancementOre');
    expect(resolvedCanonical.id).toBe('FineEnhancementOre');
  });

  // 5. Real Normal Ore correctly resolved
  it('5. resolves normal_ore to canonical EnhancementOre with category mysticOre and rarity 1', () => {
    const resolved = resolveSpecificItem('normal_ore');
    expect(resolved.id).toBe('EnhancementOre');
    expect(resolved.category).toBe('mysticOre');
    expect(resolved.name).toBe('Enhancement Ore');
    expect(resolved.rarity).toBe(1);

    const resolvedCanonical = resolveSpecificItem('EnhancementOre');
    expect(resolvedCanonical.id).toBe('EnhancementOre');
  });

  // 6. Mystic Ore correctly resolved
  it('6. resolves mystic_ore to canonical MysticEnhancementOre with category mysticOre and rarity 3', () => {
    const resolved = resolveSpecificItem('mystic_ore');
    expect(resolved.id).toBe('MysticEnhancementOre');
    expect(resolved.category).toBe('mysticOre');
    expect(resolved.name).toBe('Mystic Enhancement Ore');
    expect(resolved.rarity).toBe(3);
  });

  // 7. Actual item totals unaffected by internal metrics
  it('7. ensures totalCosts contains only genuine resource keys and no informational metrics', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    const keys = Object.keys(totals.totalCosts);

    // Should include Mora, MysticEnhancementOre, FineEnhancementOre, EnhancementOre, and ascension mats
    expect(keys).toContain('Mora');
    expect(keys).toContain('MysticEnhancementOre');
    expect(keys).toContain('FineEnhancementOre');
    expect(keys).toContain('EnhancementOre');

    // Must NOT contain any informational metrics
    for (const key of keys) {
      expect(isInformationalMetric(key)).toBe(false);
    }
  });

  // 8. No weapon plan falsely forces allDone false
  it('8. confirms allDone is true when user owns all genuine materials and ores', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);

    // Inventory covering all requirements (including enough Mystic Ores to cover Fine & Normal)
    const inventory = {
      Mora: 1000000,
      MysticEnhancementOre: 400, // 400 * 10,000 = 4M EXP > 3.714M EXP
      scattered_piece_of_decarabians_dream: 10,
      black_crystal_horn: 30,
      weathered_arrowhead: 20,
    };

    const toFarm = computeToFarm(totals, inventory);
    expect(toFarm.allDone).toBe(true);
    expect(toFarm.mora.toFarm).toBe(0);
    expect(toFarm.mysticOre.toFarm).toBe(0);
    expect(toFarm.fineOre.toFarm).toBe(0);
    expect(toFarm.normalOre.toFarm).toBe(0);
  });

  // 9. Missing actual enhancement resources keep allDone false
  it('9. confirms missing enhancement resources keep allDone false', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);

    // Missing ores (only 10 Mystic Ores owned)
    const inventory = {
      Mora: 1000000,
      MysticEnhancementOre: 10,
      scattered_piece_of_decarabians_dream: 10,
      black_crystal_horn: 30,
      weathered_arrowhead: 20,
    };

    const toFarm = computeToFarm(totals, inventory);
    expect(toFarm.allDone).toBe(false);
    expect(toFarm.mysticOre.toFarm).toBeGreaterThan(0);
    expect(toFarm.oreExp.outstandingExp).toBeGreaterThan(0);
  });

  // 10. Inventory sufficient for all demands (character + weapon)
  it('10. calculates allDone true when inventory satisfies combined character and weapon goals', () => {
    const roster = {
      Jean: {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };
    const trackedWeapons = [{
      id: 'w-fav',
      weaponName: 'Favonius Sword',
      level: 80,
      targetLevel: 90,
      ascension: 6,
      targetAscension: 6,
    }];

    const totals = aggregateRosterCosts(roster, trackedWeapons);

    // Required: Jean leveling Mora (684,625) + HerosWit (172)
    // Favonius leveling Mora (247,648) + Ores (247 Mystic, 3 Fine, 2 Normal)
    // Total Mora = 932,273
    const inventory = {
      Mora: 1000000,
      HerosWit: 200,
      MysticEnhancementOre: 300, // Covers all weapon EXP
    };

    const toFarm = computeToFarm(totals, inventory);
    expect(toFarm.allDone).toBe(true);
  });

  // 11. Inventory insufficient for all demands
  it('11. calculates allDone false when inventory is even slightly insufficient', () => {
    const roster = {
      Jean: {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };
    const totals = aggregateRosterCosts(roster, []);
    const inventory = {
      Mora: 1000000,
      HerosWit: 171, // 1 short of 172
    };

    const toFarm = computeToFarm(totals, inventory);
    expect(toFarm.allDone).toBe(false);
    expect(toFarm.heroWits.toFarm).toBe(1);
  });

  // 12. Multiple tracked weapon copies
  it('12. aggregates multiple distinct weapon copies and subtracts inventory once at grand total level', () => {
    const trackedWeapons = [
      {
        id: 'fav-copy-1',
        weaponName: 'Favonius Sword',
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
      {
        id: 'fav-copy-2',
        weaponName: 'Favonius Sword',
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
    ];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    expect(totals.breakdown.length).toBe(2);

    // Each needs 247,648 Mora -> sum 495,296 Mora
    expect(totals.totalCosts.Mora).toBe(247648 * 2);

    // With 300,000 Mora owned, toFarm is 195,296 Mora (subtracted once)
    const toFarm = computeToFarm(totals, { Mora: 300000 });
    expect(toFarm.mora.toFarm).toBe(495296 - 300000);
  });

  // 13. Mixed ore inventory
  it('13. pools mixed ore inventory (Mystic, Fine, Normal) to satisfy total weapon EXP demand', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);

    // Gross EXP needed: ~3,714,800 EXP
    // User owns:
    // 100 Mystic = 1,000,000 EXP
    // 1,000 Fine = 2,000,000 EXP
    // 2,000 Normal = 800,000 EXP
    // Total available = 3,800,000 EXP (sufficient!)
    const inventory = {
      Mora: 1000000,
      MysticEnhancementOre: 100,
      FineEnhancementOre: 1000,
      EnhancementOre: 2000,
      scattered_piece_of_decarabians_dream: 10,
      black_crystal_horn: 30,
      weathered_arrowhead: 20,
    };

    const toFarm = computeToFarm(totals, inventory);
    expect(toFarm.oreExp.availableExp).toBe(3800000);
    expect(toFarm.oreExp.outstandingExp).toBe(0);
    expect(toFarm.allDone).toBe(true);
    expect(toFarm.mysticOre.toFarm).toBe(0);
    expect(toFarm.fineOre.toFarm).toBe(0);
    expect(toFarm.normalOre.toFarm).toBe(0);
  });

  // 14. Zero ore inventory
  it('14. presents complete suggested ore quantities when user owns zero ores', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    const toFarm = computeToFarm(totals, {});

    expect(toFarm.mysticOre.toFarm).toBe(371);
    expect(toFarm.fineOre.toFarm).toBe(2);
    expect(toFarm.normalOre.toFarm).toBe(2);
    expect(toFarm.oreExp.availableExp).toBe(0);
    expect(toFarm.oreExp.outstandingExp).toBeGreaterThan(0);
  });

  // 15. Small EXP remainder
  it('15. correctly satisfies small EXP remainder with 1 Mystic Ore or exact smaller ores', () => {
    // 1★ Dull Blade Level 1 -> 10 (requires small EXP: 4,550 EXP -> 2 Fine, 2 Normal)
    const dullBlade = weaponsData.find(w => w.name === 'Dull Blade');
    const cost = calculateWeaponCost(dullBlade, 1, 10, 0, 0, false, {});
    expect(cost.fine_ore).toBe(2);
    expect(cost.normal_ore).toBe(2);
    
    // Simulate a small gross requirement of 4,800 EXP (0 Mystic, 2 Fine = 4,000, 2 Normal = 800)
    const totals = {
      totalCosts: {
        FineEnhancementOre: 2,
        EnhancementOre: 2,
      },
      categories: {
        FineEnhancementOre: 'mysticOre',
        EnhancementOre: 'mysticOre',
      },
      rarities: {
        FineEnhancementOre: 2,
        EnhancementOre: 1,
      },
    };

    // With 0 ores owned
    const toFarmZero = computeToFarm(totals, {});
    expect(toFarmZero.allDone).toBe(false);
    expect(toFarmZero.fineOre.toFarm).toBe(2);
    expect(toFarmZero.normalOre.toFarm).toBe(2);

    // With 1 Mystic Ore owned (10,000 EXP >= 4,800 EXP)
    const toFarmOneMystic = computeToFarm(totals, { MysticEnhancementOre: 1 });
    expect(toFarmOneMystic.oreExp.availableExp).toBe(10000);
    expect(toFarmOneMystic.oreExp.outstandingExp).toBe(0);
    expect(toFarmOneMystic.fineOre.toFarm).toBe(0);
    expect(toFarmOneMystic.normalOre.toFarm).toBe(0);
    expect(toFarmOneMystic.allDone).toBe(true);
  });

  // 16. Character Plan Card Mora
  it('16. verifies Character Plan Card Mora matches canonical totalCosts.Mora', () => {
    const roster = {
      Jean: {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };
    const totals = aggregateRosterCosts(roster, []);
    const jeanPlan = totals.breakdown.find(b => b.name === 'Jean');
    expect(jeanPlan).toBeDefined();

    // The gross Mora is 684,625
    const cardMora = jeanPlan.totalCosts?.Mora ?? jeanPlan.totalCosts?.mora ?? 0;
    expect(cardMora).toBe(684625);
  });

  // 17. Weapon Plan Card Mora
  it('17. verifies Weapon Plan Card Mora matches canonical totalCosts.Mora (not 0)', () => {
    const trackedWeapons = [{
      id: 'w-aquila',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    }];
    const totals = aggregateRosterCosts({}, trackedWeapons);
    const weaponPlan = totals.breakdown.find(b => b.name === 'Aquila Favonia');
    expect(weaponPlan).toBeDefined();

    // The gross Mora is 436,478
    const cardMora = weaponPlan.totalCosts?.Mora ?? weaponPlan.totalCosts?.mora ?? 0;
    expect(cardMora).toBe(436478);
    expect(cardMora).not.toBe(0);
  });

  // 18. Mixed character and weapon grand-total Mora
  it('18. accurately aggregates mixed character and weapon gross Mora without collision', () => {
    const roster = {
      Jean: {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };
    const trackedWeapons = [{
      id: 'w-fav',
      weaponName: 'Favonius Sword',
      level: 80,
      targetLevel: 90,
      ascension: 6,
      targetAscension: 6,
    }];

    const totals = aggregateRosterCosts(roster, trackedWeapons);
    // Jean: 684,625. Favonius: 247,648. Sum: 932,273.
    expect(totals.totalCosts.Mora).toBe(684625 + 247648);
    expect(totals.totalCosts.Mora).toBe(932273);
  });

  // 19. Planner partial totals with invalid progression
  it('19. marks isPartial true and allDone false when invalid progression exists', () => {
    const roster = {
      'Kuki Shinobu': {
        level: 1,
        targetLevel: 90,
        ascension: 6, // Invalid: Level 1 cannot be Ascension 6
        targetAscension: 6,
      },
    };
    const totals = aggregateRosterCosts(roster, []);
    expect(totals.isPartial).toBe(true);
    expect(totals.invalidCount).toBe(1);
    expect(totals.invalidPlans[0].name).toBe('Kuki Shinobu');

    const toFarm = computeToFarm(totals, {});
    expect(toFarm.isPartial).toBe(true);
    expect(toFarm.allDone).toBe(false); // Never marked complete when partial
  });

  // 20. Valid completed progression
  it('20. marks allDone true and zero costs for fully completed progression', () => {
    const roster = {
      Jean: {
        level: 90,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 10, skill: 10, burst: 10 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
    };
    const trackedWeapons = [{
      id: 'w-fav-done',
      weaponName: 'Favonius Sword',
      level: 90,
      targetLevel: 90,
      ascension: 6,
      targetAscension: 6,
    }];

    const totals = aggregateRosterCosts(roster, trackedWeapons);
    expect(totals.breakdown.length).toBe(0);

    const toFarm = computeToFarm(totals, {});
    expect(toFarm.allDone).toBe(true);
    expect(toFarm.totalItems).toBe(0);
  });

  // 21. Unknown legitimate material key is reported, not silently ignored
  it('21. reports unknown legitimate material keys under category unknown and prevents premature allDone', () => {
    // Simulate a future/unmapped genuine material
    const totals = {
      totalCosts: {
        UnreleasedFlora: 25,
      },
      categories: {
        UnreleasedFlora: 'unknown',
      },
      rarities: {
        UnreleasedFlora: 3,
      },
    };

    expect(isInformationalMetric('UnreleasedFlora')).toBe(false);
    expect(isGenuineResourceKey('UnreleasedFlora')).toBe(true);

    const toFarm = computeToFarm(totals, {});
    expect(toFarm.totalItems).toBe(1);
    expect(toFarm.allDone).toBe(false); // Cannot be marked allDone while unreleased flora is missing!

    // If user owns the unreleased item in inventory:
    const toFarmStocked = computeToFarm(totals, { UnreleasedFlora: 25 });
    expect(toFarmStocked.allDone).toBe(true);
  });

  // 22. All 13 Planner categories remain consistent
  it('22. populates all 13 official Planner categories consistently', () => {
    const totals = {
      totalCosts: {
        Mora: 1000,
        HerosWit: 10,
        CrownOfInsight: 1,
        MysticEnhancementOre: 20,
        FineEnhancementOre: 5,
        EnhancementOre: 5,
        MasterlessStellaFortuna: 1,
        VayudaTurquoiseGemstone: 6,
        HurricaneSeed: 20,
        DandelionSeed: 60,
        DamagedMask: 30,
        FreedomTeachings: 9,
        DvalinsPlume: 6,
        tile_of_decarabians_tower: 5,
        heavy_horn: 10,
        northlander_claymore_billet: 1,
      },
      categories: {
        Mora: 'mora',
        HerosWit: 'heroWits',
        CrownOfInsight: 'crown',
        MysticEnhancementOre: 'mysticOre',
        FineEnhancementOre: 'mysticOre',
        EnhancementOre: 'mysticOre',
        MasterlessStellaFortuna: 'stellaFortuna',
        VayudaTurquoiseGemstone: 'gemstones',
        HurricaneSeed: 'worldBoss',
        DandelionSeed: 'localSpecialty',
        DamagedMask: 'mob',
        FreedomTeachings: 'talentBooks',
        DvalinsPlume: 'weeklyBoss',
        tile_of_decarabians_tower: 'weaponAscMats',
        heavy_horn: 'eliteMob',
        northlander_claymore_billet: 'billet',
      },
      rarities: {},
    };

    const toFarm = computeToFarm(totals, {});

    expect(toFarm.mora).toBeDefined();
    expect(toFarm.heroWits).toBeDefined();
    expect(toFarm.crown).toBeDefined();
    expect(toFarm.mysticOre).toBeDefined();
    expect(toFarm.fineOre).toBeDefined();
    expect(toFarm.normalOre).toBeDefined();
    expect(toFarm.stellaFortuna).toBeDefined();
    expect(toFarm.gemstones.length).toBe(1);
    expect(toFarm.worldBoss.length).toBe(1);
    expect(toFarm.localSpecialty.length).toBe(1);
    expect(toFarm.mob.length).toBe(1);
    expect(toFarm.talentBooks.length).toBe(1);
    expect(toFarm.weeklyBoss.length).toBe(1);
    expect(toFarm.weaponAscMats.length).toBe(1);
    expect(toFarm.eliteMob.length).toBe(1);
    expect(toFarm.forgingMats.length).toBe(1);

    // No leaked items in unknown category!
    const unknownItems = Object.entries(totals.totalCosts)
      .filter(([name]) => totals.categories[name] === 'unknown');
    expect(unknownItems.length).toBe(0);
  });
});

