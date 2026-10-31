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
    // Authoritative Row 81 Mora delta in costs.json is 647,990
    expect(result.totalCosts.Mora).toBe(647990);
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
    // 647,990 (Jean) + 247,648 (Favonius Sword) = 895,638 Mora
    expect(result.totalCosts.Mora).toBe(647990 + 247648);
    expect(result.totalCosts.Mora).toBe(895638);
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
