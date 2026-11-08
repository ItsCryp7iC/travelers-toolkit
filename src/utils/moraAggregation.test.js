import { describe, it, expect } from 'vitest';
import { calculateWeaponCost } from './calculator';
import { aggregateRosterCosts, computeToFarm } from './aggregator';
import weaponsData from '../data/weapons.json';

const aquila = weaponsData.find(w => w.name === 'Aquila Favonia');

describe('C1D — Mora Normalization & Aggregation Integrity', () => {
  // 1. One character with leveling costs
  it('1. calculates exact leveling Mora for a character (Jean 80/90 A6 -> 90 A6)', () => {
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
    const result = aggregateRosterCosts(roster, []);
    // Authoritative Level 80 A6 -> 90 A6 leveling Mora is 684,625
    expect(result.totalCosts.Mora).toBe(684625);
    expect(result.totalCosts.mora).toBeUndefined();
    expect(result.totalCosts.total_mora).toBeUndefined();
  });

  // 2. One weapon with leveling-only costs
  it('2. calculates exact leveling-only Mora for a 4★ weapon (Favonius Sword 80/90 A6 -> 90 A6)', () => {
    const trackedWeapons = [
      {
        id: 'fav-1',
        weaponName: 'Favonius Sword',
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
    ];
    const result = aggregateRosterCosts({}, trackedWeapons);
    // Authoritative 4★ leveling Mora 80->90 from costs.json is 247,648
    expect(result.totalCosts.Mora).toBe(247648);
    expect(result.totalCosts.mora).toBeUndefined();
    expect(result.totalCosts.total_mora).toBeUndefined();
  });

  // 3. One weapon needing ascension and leveling
  it('3. calculates exact ascension + leveling Mora for a 5★ weapon (Aquila Favonia 80/80 A5 -> 90 A6)', () => {
    const trackedWeapons = [
      {
        id: 'aquila-1',
        weaponName: 'Aquila Favonia',
        level: 80,
        targetLevel: 90,
        ascension: 5,
        targetAscension: 6,
      },
    ];
    const result = aggregateRosterCosts({}, trackedWeapons);
    // Authoritative 5★ leveling Mora (371,478) + Phase 5 ascension Mora (65,000) = 436,478
    expect(result.totalCosts.Mora).toBe(436478);
    expect(result.totalCosts.mora).toBeUndefined();
    expect(result.totalCosts.total_mora).toBeUndefined();
  });

  // 4. One character with incomplete talents
  it('4. calculates exact talent Mora for character (Jean 90/90 A6, Talents 8/8/8 -> 10/10/10)', () => {
    const roster = {
      Jean: {
        level: 90,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 8, skill: 8, burst: 8 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
    };
    const result = aggregateRosterCosts(roster, []);
    // Each talent 8->10: 450,000 + 700,000 = 1,150,000 Mora * 3 = 3,450,000 Mora
    expect(result.totalCosts.Mora).toBe(3450000);
    expect(result.totalCosts.mora).toBeUndefined();
    expect(result.totalCosts.total_mora).toBeUndefined();
  });

  // 5. One character plus one weapon with combined Mora requirements
  it('5. aggregates combined character and weapon Mora without key collision or double-counting', () => {
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
    const trackedWeapons = [
      {
        id: 'fav-1',
        weaponName: 'Favonius Sword',
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
    ];
    const result = aggregateRosterCosts(roster, trackedWeapons);
    // 684,625 (Jean) + 247,648 (Favonius Sword) = 932,273 Mora
    expect(result.totalCosts.Mora).toBe(684625 + 247648);
    expect(result.totalCosts.Mora).toBe(932273);
  });

  // 6. Mora inventory below, equal to, and above total gross requirement
  it('6. subtracts Mora inventory correctly against aggregate demand (below, equal, above)', () => {
    const totals = {
      totalCosts: { Mora: 895638 },
      categories: { Mora: 'mora' },
      rarities: { Mora: 3 },
    };

    // Below gross requirement
    const toFarmBelow = computeToFarm(totals, { Mora: 300000 });
    expect(toFarmBelow.mora.required).toBe(895638);
    expect(toFarmBelow.mora.owned).toBe(300000);
    expect(toFarmBelow.mora.toFarm).toBe(595638);

    // Equal to gross requirement
    const toFarmEqual = computeToFarm(totals, { Mora: 895638 });
    expect(toFarmEqual.mora.toFarm).toBe(0);

    // Above gross requirement (non-negative clamp)
    const toFarmAbove = computeToFarm(totals, { Mora: 1500000 });
    expect(toFarmAbove.mora.toFarm).toBe(0);
  });

  // 7. Weapon Card and Table presentation parity
  it('7. ensures Weapon Table calculation and Weapon Card totalCosts produce identical Mora', () => {
    // Table calculation: raw calculateWeaponCost
    const tableCosts = calculateWeaponCost(aquila, 80, 90, 5, 6, false, {});
    expect(tableCosts.total_mora).toBe(436478);

    // Aggregate / Card calculation via aggregateRosterCosts
    const agg = aggregateRosterCosts({}, [
      {
        id: 'aquila-test',
        weaponName: 'Aquila Favonia',
        level: 80,
        targetLevel: 90,
        ascension: 5,
        targetAscension: 6,
      },
    ]);
    expect(agg.totalCosts.Mora).toBe(tableCosts.total_mora);
    expect(agg.breakdown[0].totalCosts.Mora).toBe(tableCosts.total_mora);
  });

  // 8. No duplicate Mora keys in the aggregate
  it('8. confirms exactly one canonical Mora key exists in grand total costs', () => {
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
    const trackedWeapons = [
      {
        id: 'fav-1',
        weaponName: 'Favonius Sword',
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
    ];
    const result = aggregateRosterCosts(roster, trackedWeapons);
    const moraKeys = Object.keys(result.totalCosts).filter(k => k.toLowerCase().includes('mora'));
    expect(moraKeys).toEqual(['Mora']);
  });

  // 9. A fully completed weapon requiring zero Mora
  it('9. charges zero Mora for a fully completed weapon (90/90 A6 -> 90/90 A6)', () => {
    const trackedWeapons = [
      {
        id: 'fav-completed',
        weaponName: 'Favonius Sword',
        level: 90,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
    ];
    const result = aggregateRosterCosts({}, trackedWeapons);
    expect(result.totalCosts.Mora).toBeUndefined();
    expect(result.breakdown.length).toBe(0);
    expect(result.weaponCount).toBe(0);
  });

  // 10. Two tracked copies of the same weapon with separate UUIDs and independent costs
  it('10. tracks two copies of the same weapon with separate UUIDs and independent Mora costs', () => {
    const trackedWeapons = [
      {
        id: 'fav-uuid-1',
        weaponName: 'Favonius Sword',
        level: 1,
        targetLevel: 90,
        ascension: 0,
        targetAscension: 6,
      },
      {
        id: 'fav-uuid-2',
        weaponName: 'Favonius Sword',
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
      },
    ];
    const result = aggregateRosterCosts({}, trackedWeapons);
    expect(result.breakdown.length).toBe(2);
    expect(result.weaponCount).toBe(2);

    const w1 = result.breakdown.find(b => b.entry.id === 'fav-uuid-1');
    const w2 = result.breakdown.find(b => b.entry.id === 'fav-uuid-2');
    expect(w1).toBeTruthy();
    expect(w2).toBeTruthy();

    // W1 (1->90) has higher Mora than W2 (80->90)
    expect(w1.totalCosts.Mora).toBeGreaterThan(w2.totalCosts.Mora);
    expect(w2.totalCosts.Mora).toBe(247648);

    // Grand total Mora is the exact sum of both instances
    expect(result.totalCosts.Mora).toBe(w1.totalCosts.Mora + w2.totalCosts.Mora);
  });
});

describe('C2C-B — Cross-Page Mora and Weapon Ascension Discount Parity', () => {
  const aquila = weaponsData.find(w => w.name === 'Aquila Favonia'); // Sword
  const skywardHarp = weaponsData.find(w => w.name === 'Skyward Harp'); // Bow
  const wgs = weaponsData.find(w => w.name === "Wolf's Gravestone"); // Claymore

  it('1. gross Mora matches across Table, Card, Store, and Planner when neither character owned', () => {
    const roster = {};
    const trackedWeapon = {
      id: 'aquila-parity-1',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };

    // 1. Direct Table calculation
    const tableMora = calculateWeaponCost(aquila, trackedWeapon.level, trackedWeapon.targetLevel, trackedWeapon.ascension, trackedWeapon.targetAscension, Boolean(trackedWeapon.hasEventBonus), roster).total_mora;

    // 2. Card calculation
    const cardMora = calculateWeaponCost(aquila, trackedWeapon.level, trackedWeapon.targetLevel, trackedWeapon.ascension, trackedWeapon.targetAscension, Boolean(trackedWeapon.hasEventBonus), roster).total_mora;

    // 3. Planner aggregate breakdown & total
    const agg = aggregateRosterCosts(roster, [trackedWeapon]);
    const plannerCardMora = agg.breakdown[0].totalCosts.Mora;
    const plannerGrandTotalMora = agg.totalCosts.Mora;

    // Base Mora: 371,478 leveling + 65,000 ascension = 436,478
    expect(tableMora).toBe(436478);
    expect(cardMora).toBe(436478);
    expect(plannerCardMora).toBe(436478);
    expect(plannerGrandTotalMora).toBe(436478);
  });

  it('2. gross Mora matches across Table, Card, Store, and Planner with Raiden Shogun owned (Sword discounted)', () => {
    const roster = {
      'Raiden Shogun': { level: 90, ascension: 6 },
    };
    const trackedWeapon = {
      id: 'aquila-parity-raiden',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };

    const tableMora = calculateWeaponCost(aquila, trackedWeapon.level, trackedWeapon.targetLevel, trackedWeapon.ascension, trackedWeapon.targetAscension, Boolean(trackedWeapon.hasEventBonus), roster).total_mora;
    const cardMora = calculateWeaponCost(aquila, trackedWeapon.level, trackedWeapon.targetLevel, trackedWeapon.ascension, trackedWeapon.targetAscension, Boolean(trackedWeapon.hasEventBonus), roster).total_mora;
    const agg = aggregateRosterCosts(roster, [trackedWeapon]);
    const plannerCardMora = agg.breakdown[0].totalCosts.Mora;
    const plannerGrandTotalMora = agg.totalCosts.Mora;

    // Discounted: 371,478 leveling + 32,500 ascension = 403,978
    expect(tableMora).toBe(403978);
    expect(cardMora).toBe(403978);
    expect(plannerCardMora).toBe(403978);
    expect(plannerGrandTotalMora).toBe(403978);
  });

  it('3. gross Mora matches across Table, Card, Store, and Planner with Wanderer owned (Bow discounted, Sword not)', () => {
    const roster = {
      'Wanderer': { level: 90, ascension: 6 },
    };
    const trackedBow = {
      id: 'harp-parity-wanderer',
      weaponName: 'Skyward Harp',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };
    const trackedSword = {
      id: 'aquila-parity-no-discount',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };

    // Bow gets discount
    const bowTableMora = calculateWeaponCost(skywardHarp, trackedBow.level, trackedBow.targetLevel, trackedBow.ascension, trackedBow.targetAscension, Boolean(trackedBow.hasEventBonus), roster).total_mora;
    const bowCardMora = calculateWeaponCost(skywardHarp, trackedBow.level, trackedBow.targetLevel, trackedBow.ascension, trackedBow.targetAscension, Boolean(trackedBow.hasEventBonus), roster).total_mora;
    expect(bowTableMora).toBe(403978);
    expect(bowCardMora).toBe(403978);

    // Sword gets NO discount
    const swordTableMora = calculateWeaponCost(aquila, trackedSword.level, trackedSword.targetLevel, trackedSword.ascension, trackedSword.targetAscension, Boolean(trackedSword.hasEventBonus), roster).total_mora;
    expect(swordTableMora).toBe(436478);

    const agg = aggregateRosterCosts(roster, [trackedBow, trackedSword]);
    const bowBreakdown = agg.breakdown.find(b => b.entry.id === trackedBow.id);
    const swordBreakdown = agg.breakdown.find(b => b.entry.id === trackedSword.id);

    expect(bowBreakdown.totalCosts.Mora).toBe(403978);
    expect(swordBreakdown.totalCosts.Mora).toBe(436478);
    expect(agg.totalCosts.Mora).toBe(403978 + 436478);
  });

  it('4. gross Mora matches when both Raiden and Wanderer are owned (each discounts its own weapon type, Claymore unaffected)', () => {
    const roster = {
      'Raiden Shogun': { level: 90, ascension: 6 },
      'Wanderer': { level: 90, ascension: 6 },
    };
    const trackedSword = {
      id: 'sword-both',
      weaponName: 'Aquila Favonia',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };
    const trackedBow = {
      id: 'bow-both',
      weaponName: 'Skyward Harp',
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };
    const trackedClaymore = {
      id: 'claymore-both',
      weaponName: "Wolf's Gravestone",
      level: 80,
      targetLevel: 90,
      ascension: 5,
      targetAscension: 6,
    };

    const swordCost = calculateWeaponCost(aquila, 80, 90, 5, 6, false, roster).total_mora;
    const bowCost = calculateWeaponCost(skywardHarp, 80, 90, 5, 6, false, roster).total_mora;
    const claymoreCost = calculateWeaponCost(wgs, 80, 90, 5, 6, false, roster).total_mora;

    expect(swordCost).toBe(403978); // discounted by Raiden
    expect(bowCost).toBe(403978); // discounted by Wanderer
    expect(claymoreCost).toBe(436478); // untouched by passives

    const agg = aggregateRosterCosts(roster, [trackedSword, trackedBow, trackedClaymore]);
    expect(agg.totalCosts.Mora).toBe(403978 + 403978 + 436478);
  });

  it('5. aggregates multiple distinct weapon UUIDs independently and subtracts Mora inventory only once at grand total level', () => {
    const roster = {
      'Raiden Shogun': { level: 90, ascension: 6 },
    };
    const trackedWeapons = [
      {
        id: 'sword-copy-1',
        weaponName: 'Aquila Favonia',
        level: 80,
        targetLevel: 90,
        ascension: 5,
        targetAscension: 6,
      },
      {
        id: 'sword-copy-2',
        weaponName: 'Aquila Favonia',
        level: 80,
        targetLevel: 90,
        ascension: 5,
        targetAscension: 6,
      },
    ];

    const agg = aggregateRosterCosts(roster, trackedWeapons);
    expect(agg.breakdown.length).toBe(2);
    expect(agg.breakdown[0].totalCosts.Mora).toBe(403978);
    expect(agg.breakdown[1].totalCosts.Mora).toBe(403978);
    expect(agg.totalCosts.Mora).toBe(807956);

    // Compute to farm with 500k inventory
    const toFarm = computeToFarm(agg, { Mora: 500000 });
    expect(toFarm.mora.required).toBe(807956);
    expect(toFarm.mora.owned).toBe(500000);
    expect(toFarm.mora.toFarm).toBe(307956);
  });

  it('6. preserves invalid progression status and zero cost for completed weapons in aggregation', () => {
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
    const invalidWeapon = {
      id: 'invalid-weapon-1',
      weaponName: 'Aquila Favonia',
      level: 1,
      targetLevel: 90,
      ascension: 6, // Incompatible
      targetAscension: 6,
    };
    const completedWeapon = {
      id: 'completed-weapon-1',
      weaponName: 'Aquila Favonia',
      level: 90,
      targetLevel: 90,
      ascension: 6,
      targetAscension: 6,
    };

    const agg = aggregateRosterCosts(roster, [invalidWeapon, completedWeapon]);
    expect(agg.invalidCount).toBe(1);
    expect(agg.isPartial).toBe(true);
    expect(agg.invalidPlans.some(p => p.id === 'invalid-weapon-1')).toBe(true);
    expect(agg.breakdown.some(b => b.entry.id === 'completed-weapon-1')).toBe(false);
    expect(agg.totalCosts.Mora).toBeUndefined();
  });
});
