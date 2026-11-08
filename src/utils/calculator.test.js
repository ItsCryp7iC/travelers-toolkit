import { describe, it, expect } from 'vitest';
import {
  getLevelRange,
  clampLevel,
  buildGemName,
  buildBookKey,
  formatNumber,
  formatItemName,
  formatMaterialName,
  calculateProgressionCost,
  calculateTalentCost,
  calculateAllTalentsCost,
  calculateWeaponCost,
  isCharacterInRoster,
  getWeaponAscensionDiscount
} from './calculator';
import weaponsData from '../data/weapons.json';
import charactersData from './characters'; // Need to load from correct path if needed, we can just mock characters

// Small invariant helper
function assertValidQuantities(costs) {
  Object.entries(costs).forEach(([key, value]) => {
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
      expect(value, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });
}

describe('Calculator Level Range Helpers', () => {
  it('getLevelRange returns expected min/max for Ascension 0', () => {
    expect(getLevelRange(0)).toEqual({ min: 1, max: 20 });
  });

  it('getLevelRange returns expected min/max for Ascension 6', () => {
    expect(getLevelRange(6)).toEqual({ min: 80, max: 100 });
  });

  it('clampLevel clamps below minimum', () => {
    expect(clampLevel(10, 2)).toEqual(40); // Asc 2 min is 40
  });

  it('clampLevel clamps above maximum', () => {
    expect(clampLevel(90, 0)).toEqual(20); // Asc 0 max is 20
  });

  it('clampLevel leaves valid level unchanged', () => {
    expect(clampLevel(50, 2)).toEqual(50); // Asc 2 is 40-50
  });
});

describe('Calculator Material Helpers', () => {
  it('buildGemName constructs suffixes correctly', () => {
    expect(buildGemName('AgnidusAgate', 0)).toBe('AgnidusAgateSliver');
    expect(buildGemName('AgnidusAgate', 1)).toBe('AgnidusAgateFragment');
    expect(buildGemName('AgnidusAgate', 2)).toBe('AgnidusAgateChunk');
    expect(buildGemName('AgnidusAgate', 3)).toBe('AgnidusAgate');
  });

  it('buildBookKey constructs talent book keys', () => {
    expect(buildBookKey('Freedom', 2)).toBe('FreedomTeachings');
    expect(buildBookKey('Freedom', 3)).toBe('FreedomGuide');
    expect(buildBookKey('Freedom', 4)).toBe('FreedomPhilosophies');
    expect(buildBookKey('nan', 2)).toBeNull();
  });

  it('formatNumber formats millions and invalid numbers', () => {
    expect(formatNumber(1500000)).toBe('1.50M');
    expect(formatNumber(12500)).toBe('12,500');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
  });

  it('formatItemName formats snake_case correctly', () => {
    expect(formatItemName('heros_wit')).toBe('Heros Wit');
    expect(formatItemName('agnidus_agate_sliver')).toBe('Agnidus Agate Sliver');
  });

  it('formatMaterialName formats PascalCase correctly', () => {
    expect(formatMaterialName('AgnidusAgateSliver')).toBe('Agnidus Agate Sliver');
  });
});

describe('Calculator Progression Regressions', () => {
  const dummy5StarChar = { rarity: 5, materials: { world_boss_material_id: 'BossMat' } };
  const dummy4StarChar = { rarity: 4, materials: { world_boss_material_id: 'BossMat' } };

  it('keeps same-level ascension costs at L80 A5 → A6', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 80, 80, 5, 6);
    expect(Object.keys(cost).length).toBeGreaterThan(0);
    expect(cost.mora).toBeGreaterThan(0);
    expect(cost.boss_material).toBeGreaterThan(0);
    expect(cost.local_specialty).toBeGreaterThan(0);
    expect(cost.heros_wit).toBeUndefined(); // Should not charge XP for same-level asc
    assertValidQuantities(cost);
  });

  it('exact no-op L80 A6 → L80 A6 returns empty', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 80, 80, 6, 6);
    expect(cost).toEqual({});
  });

  it('full progression sanity L1 A0 → L90 A6', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 1, 90, 0, 6);
    expect(cost.mora).toBeGreaterThan(0);
    expect(cost.heros_wit).toBeGreaterThan(0);
    expect(cost.boss_material).toBeGreaterThan(0);
    assertValidQuantities(cost);
  });

  it('preserves distinction between milestone ascensions (L80 A5 vs L80 A6)', () => {
    const costA5 = calculateProgressionCost(dummy5StarChar, 80, 90, 5, 6);
    const costA6 = calculateProgressionCost(dummy5StarChar, 80, 90, 6, 6);
    // A5 -> A6 includes the ascension cost, so mora should be higher
    expect(costA5.mora).toBeGreaterThan(costA6.mora);
  });

  it('preserves distinction between milestone ascensions (L40 A1 vs L40 A2)', () => {
    const costA1 = calculateProgressionCost(dummy5StarChar, 40, 50, 1, 2);
    const costA2 = calculateProgressionCost(dummy5StarChar, 40, 50, 2, 2);
    expect(costA1.mora).toBeGreaterThan(costA2.mora);
  });

  it('same-level ascension mora is identical between 4-star and 5-star (canonical Genshin cost)', () => {
    const cost5 = calculateProgressionCost(dummy5StarChar, 80, 80, 5, 6);
    const cost4 = calculateProgressionCost(dummy4StarChar, 80, 80, 5, 6);
    expect(cost5.mora).toBe(120000);
    expect(cost4.mora).toBe(120000);
  });

  it('omits world boss material for Traveler', () => {
    const traveler = charactersData.find(c => c.name.startsWith('Traveler '));
    expect(traveler).toBeDefined();
    const cost = calculateProgressionCost(traveler, 1, 90, 0, 6);
    expect(cost.boss_material).toBeUndefined();
  });
});

describe('Calculator Talent Regressions', () => {
  const dummyChar = {
    materials: { talent_material_family_ids: ['Freedom', 'Freedom', 'Freedom'] }
  };

  it('single talent no-op 6 → 6 returns empty', () => {
    const cost = calculateTalentCost(dummyChar, 6, 6);
    expect(cost).toEqual({});
  });

  it('single talent progression 6 → 10', () => {
    const cost = calculateTalentCost(dummyChar, 6, 10);
    expect(cost.mora).toBeGreaterThan(0);
    expect(cost.weekly_boss_material).toBeGreaterThan(0);
    expect(cost.crown).toBe(1);
    expect(cost['Freedom_4_star_talent_material']).toBeGreaterThan(0); // Philosophies
    assertValidQuantities(cost);
  });

  it('all talents aggregation provides consistent totals', () => {
    const talents = {
      auto: { current: 1, target: 2 },
      skill: { current: 6, target: 8 },
      burst: { current: 9, target: 10 }
    };
    const cost = calculateAllTalentsCost(dummyChar, talents);
    expect(cost.mora).toBeGreaterThan(0);
    expect(cost.mora_na).toBeGreaterThan(0);
    expect(cost.mora_skill).toBeGreaterThan(0);
    expect(cost.mora_burst).toBeGreaterThan(0);
    expect(cost.mora).toEqual(cost.mora_na + cost.mora_skill + cost.mora_burst);
    assertValidQuantities(cost);
  });
});

describe('Calculator Weapon Regressions', () => {

  const harbinger = weaponsData.find(w => w.id === 'HarbingerOfDawn');
  const favonius = weaponsData.find(w => w.rarity === '★★★★');
  const aquila = weaponsData.find(w => w.rarity === '★★★★★' && w.type === 'Sword');
  const skywardHarp = weaponsData.find(w => w.rarity === '★★★★★' && w.type === 'Bow');

  it('3★ Harbinger of Dawn L80 A6 -> L90 A6 exact expected numbers', () => {
    const cost = calculateWeaponCost(harbinger, 80, 90, 6, 6, false, {});
    expect(cost.mystic_ore).toBe(163);
    expect(cost.fine_ore).toBe(2);
    expect(cost.normal_ore).toBe(2);
    expect(cost.wasted_exp).toBe(325);
    expect(cost.total_mora).toBe(163448);

    // No ascension materials
    expect(cost['3_star_ascension_material']).toBeUndefined();
    expect(cost['4_star_enhancement_material']).toBeUndefined();
    expect(cost['3_star_enemy_material']).toBeUndefined();
    assertValidQuantities(cost);
  });

  it('4★ representative weapon L80 A6 -> L90 A6 no ascension materials', () => {
    const cost = calculateWeaponCost(favonius, 80, 90, 6, 6, false, {});
    expect(cost.mystic_ore).toBeGreaterThan(0);
    expect(cost['4_star_ascension_material']).toBeUndefined();
    expect(cost['5_star_ascension_material']).toBeUndefined();
    assertValidQuantities(cost);
  });

  it('5★ representative weapon L80 A6 -> L90 A6 no ascension materials', () => {
    const cost = calculateWeaponCost(aquila, 80, 90, 6, 6, false, {});
    expect(cost.mystic_ore).toBeGreaterThan(0);
    expect(cost['5_star_ascension_material']).toBeUndefined();
    assertValidQuantities(cost);
  });

  it('Same-level ascension: L80 A5 -> L80 A6 zero ore, correct phase materials, correct ascension Mora', () => {
    const cost = calculateWeaponCost(aquila, 80, 80, 5, 6, false, {});
    expect(cost.mystic_ore).toBe(0);
    expect(cost.fine_ore).toBe(0);
    expect(cost.normal_ore).toBe(0);
    expect(cost.total_mora).toBe(65000); // 5★ A6 is 65k
    expect(cost['5_star_ascension_material']).toBe(6);
    expect(cost['4_star_enhancement_material']).toBe(27);
    expect(cost['3_star_enemy_material']).toBe(18);
    assertValidQuantities(cost);
  });

  it('Earlier milestone: L40 A2 -> L50 A2 no ascension materials', () => {
    const cost = calculateWeaponCost(aquila, 40, 50, 2, 2, false, {});
    expect(cost.mystic_ore).toBeGreaterThan(0);
    expect(cost['3_star_ascension_material']).toBeUndefined();
    assertValidQuantities(cost);
  });

  it('Pre-ascension: L40 A1 -> L50 A2 exactly A1->A2 materials + enhancement', () => {
    const cost = calculateWeaponCost(aquila, 40, 50, 1, 2, false, {});
    expect(cost.mystic_ore).toBeGreaterThan(0);
    expect(cost['3_star_ascension_material']).toBe(5);
    expect(cost['2_star_enhancement_material']).toBe(18);
    expect(cost['1_star_enemy_material']).toBe(12);
    assertValidQuantities(cost);
  });

  it('Full progression: L1 A0 -> L90 A6 all phases once', () => {
    const cost = calculateWeaponCost(aquila, 1, 90, 0, 6, false, {});
    expect(cost.mystic_ore).toBeGreaterThan(0);
    // 5+0+0+0+0+0
    expect(cost['2_star_ascension_material']).toBe(5);
    // 0+5+9+0+0+0
    expect(cost['3_star_ascension_material']).toBe(14);
    // 0+0+0+5+9+0
    expect(cost['4_star_ascension_material']).toBe(14);
    // 0+0+0+0+0+6
    expect(cost['5_star_ascension_material']).toBe(6);
    assertValidQuantities(cost);
  });

  it('Exact no-op: L90 A6 -> L90 A6', () => {
    const cost = calculateWeaponCost(aquila, 90, 90, 6, 6, false, {});
    expect(cost).toEqual({}); // The updated calculation correctly returns early
  });

  it('Event bonus reduces exp needed', () => {
    const costNormal = calculateWeaponCost(aquila, 1, 90, 0, 6, false, {});
    const costBonus = calculateWeaponCost(aquila, 1, 90, 0, 6, true, {});
    expect(costBonus.mystic_ore).toBeLessThan(costNormal.mystic_ore);
    expect(costBonus.total_mora).toBeLessThan(costNormal.total_mora);
  });

  it('Passive discount: Raiden reduces Sword ascension mora by 50%', () => {
    const costNormal = calculateWeaponCost(aquila, 80, 80, 5, 6, false, {});
    const costDiscounted = calculateWeaponCost(aquila, 80, 80, 5, 6, false, { 'Raiden Shogun': {} });
    expect(costDiscounted.total_mora).toBe(Math.ceil(costNormal.total_mora / 2));
    expect(costDiscounted.has_ascension_discount).toBe(true);
    expect(costDiscounted.discount_source).toBe('Raiden Shogun');
  });

  it('Passive discount: Wanderer reduces Bow ascension mora by 50%', () => {
    const costNormal = calculateWeaponCost(skywardHarp, 80, 80, 5, 6, false, {});
    const costDiscounted = calculateWeaponCost(skywardHarp, 80, 80, 5, 6, false, { 'Wanderer': {} });
    expect(costDiscounted.total_mora).toBe(Math.ceil(costNormal.total_mora / 2));
    expect(costDiscounted.has_ascension_discount).toBe(true);
    expect(costDiscounted.discount_source).toBe('Wanderer');
  });

  it('Passive discount: Wanderer does NOT reduce Sword ascension mora', () => {
    const costNormal = calculateWeaponCost(aquila, 80, 80, 5, 6, false, {});
    const costDiscounted = calculateWeaponCost(aquila, 80, 80, 5, 6, false, { 'Wanderer': {} });
    expect(costDiscounted.total_mora).toBe(costNormal.total_mora);
    expect(costDiscounted.has_ascension_discount).toBe(false);
  });

  it('Passive discount: works when charactersRoster is an array of objects or strings', () => {
    const costNormal = calculateWeaponCost(aquila, 80, 80, 5, 6, false, []);
    const costArrayObj = calculateWeaponCost(aquila, 80, 80, 5, 6, false, [{ name: 'Raiden Shogun' }]);
    const costArrayStr = calculateWeaponCost(aquila, 80, 80, 5, 6, false, ['Raiden Shogun']);

    expect(costArrayObj.total_mora).toBe(Math.ceil(costNormal.total_mora / 2));
    expect(costArrayObj.has_ascension_discount).toBe(true);
    expect(costArrayObj.discount_source).toBe('Raiden Shogun');

    expect(costArrayStr.total_mora).toBe(Math.ceil(costNormal.total_mora / 2));
    expect(costArrayStr.has_ascension_discount).toBe(true);

    const wandererCost = calculateWeaponCost(skywardHarp, 80, 80, 5, 6, false, [{ name: 'Wanderer' }]);
    expect(wandererCost.has_ascension_discount).toBe(true);
    expect(wandererCost.discount_source).toBe('Wanderer');
  });

  it('Invalid reverse progression returns empty object', () => {
    const cost1 = calculateWeaponCost(aquila, 90, 80, 6, 5, false, {});
    const cost2 = calculateWeaponCost(aquila, 80, 80, 6, 5, false, {});
    const cost3 = calculateWeaponCost(aquila, 50, 40, 2, 2, false, {});
    expect(cost1).toEqual({});
    expect(cost2).toEqual({});
    expect(cost3).toEqual({});
  });

  it('does not mutate input arguments', () => {
    const charInput = {
      name: 'TestChar',
      rarity: 5,
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      materials: { world_boss_material_id: 'Boss' }
    };
    const freezeChar = Object.freeze({ ...charInput });
    expect(() => calculateProgressionCost(freezeChar)).not.toThrow();

    const weaponInput = {
      name: 'Aquila Favonia',
      rarity: 5,
      type: 'Sword'
    };
    const freezeWeapon = Object.freeze({ ...weaponInput });
    expect(() => calculateWeaponCost(freezeWeapon, 1, 90, 0, 6, false, {})).not.toThrow();
  });
});

describe('Table-Driven Progression Boundaries', () => {
  const dummy5Star = { rarity: 5, materials: { world_boss_material_id: 'BossMat' } };

  describe.each([
    { fromLv: 1, toLv: 1, fromAsc: 0, toAsc: 0, desc: 'L1 A0 -> L1 A0 exact no-op', expectEmpty: true },
    { fromLv: 80, toLv: 80, fromAsc: 5, toAsc: 5, desc: 'L80 A5 -> L80 A5 exact no-op', expectEmpty: true },
    { fromLv: 90, toLv: 90, fromAsc: 6, toAsc: 6, desc: 'L90 A6 -> L90 A6 exact no-op', expectEmpty: true },
    { fromLv: 90, toLv: 80, fromAsc: 6, toAsc: 5, desc: 'Target < Current (L90 A6 -> L80 A5)', expectEmpty: true },
    { fromLv: 80, toLv: 80, fromAsc: 5, toAsc: 6, desc: 'Same-level ascension L80 A5 -> A6', expectEmpty: false, zeroExp: true },
    { fromLv: 1, toLv: 90, fromAsc: 0, toAsc: 6, desc: 'Full progression L1 A0 -> L90 A6', expectEmpty: false, hasExp: true },
    { fromLv: 80, toLv: 90, fromAsc: 6, toAsc: 6, desc: 'Leveling only L80 A6 -> L90 A6', expectEmpty: false, hasExp: true, zeroBoss: true },
    { fromLv: 90, toLv: 95, fromAsc: 6, toAsc: 6, desc: 'Constellation milestone L90 -> L95 awards 1 stella fortuna', expectEmpty: false, stella: 1 },
    { fromLv: 90, toLv: 100, fromAsc: 6, toAsc: 6, desc: 'Constellation milestone L90 -> L100 awards 3 stella fortuna', expectEmpty: false, stella: 3 },
  ])('Character progression: $desc', ({ fromLv, toLv, fromAsc, toAsc, expectEmpty, zeroExp, hasExp, zeroBoss, stella }) => {
    it(`calculates expected cost structure`, () => {
      const cost = calculateProgressionCost(dummy5Star, fromLv, toLv, fromAsc, toAsc);
      if (expectEmpty) {
        expect(cost).toEqual({});
      } else {
        expect(Object.keys(cost).length).toBeGreaterThan(0);
        if (zeroExp) {
          expect(cost.heros_wit).toBeUndefined();
        }
        if (hasExp) {
          expect(cost.heros_wit).toBeGreaterThan(0);
        }
        if (zeroBoss) {
          expect(cost.boss_material).toBeUndefined();
        }
        if (stella) {
          expect(cost.masterless_stella_fortuna).toBe(stella);
        }
        assertValidQuantities(cost);
      }
    });
  });
});

describe('DEF-C2-01 & DEF-C2-02 Authoritative Character Progression Boundaries', () => {
  const dummy5StarChar = {
    rarity: 5,
    materials: {
      world_boss_material_id: 'BossMat',
      gem_family_id: 'VayudaTurquoise',
      local_specialty_id: 'DandelionSeed',
      enemy_material_family_id: 'HilichurlMask',
    },
  };
  const dummy4StarChar = {
    rarity: 4,
    materials: {
      world_boss_material_id: 'BossMat',
      gem_family_id: 'PyroGem',
      local_specialty_id: 'SmallLampGrass',
      enemy_material_family_id: 'HilichurlArrowhead',
    },
  };

  it('1. Level 80 A6 -> Level 90 A6: exact leveling costs, zero ascension items', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 80, 90, 6, 6);
    expect(cost.mora).toBe(684625);
    expect(cost.heros_wit).toBe(172);
    expect(cost.boss_material).toBeUndefined();
    expect(cost.gem_gemstone).toBeUndefined();
    expect(cost.local_specialty).toBeUndefined();
    expect(cost['3_star_enemy_material']).toBeUndefined();
  });

  it('2. Level 80 A5 -> Level 90 A6: combined leveling + Phase 6 ascension materials', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 80, 90, 5, 6);
    expect(cost.mora).toBe(804625); // 684,625 + 120,000
    expect(cost.heros_wit).toBe(172);
    expect(cost.boss_material).toBe(20);
    expect(cost.gem_gemstone).toBe(6);
    expect(cost.local_specialty).toBe(60);
    expect(cost['3_star_enemy_material']).toBe(24);
  });

  it('3. Level 80 A5 -> Level 80 A6: Phase 6 ascension only (zero leveling EXP/Mora)', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 80, 80, 5, 6);
    expect(cost.mora).toBe(120000);
    expect(cost.heros_wit).toBeUndefined();
    expect(cost.boss_material).toBe(20);
    expect(cost.gem_gemstone).toBe(6);
    expect(cost.local_specialty).toBe(60);
    expect(cost['3_star_enemy_material']).toBe(24);
  });

  it('4. Level 80 A6 -> Level 80 A6: exact no-op returns {}', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 80, 80, 6, 6);
    expect(cost).toEqual({});
  });

  it('5. Level 70 A5 -> Level 80 A5: leveling only across milestone (zero ascension items)', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 70, 80, 5, 5);
    expect(cost.mora).toBe(322375);
    expect(cost.heros_wit).toBe(80);
    expect(cost.boss_material).toBeUndefined();
    expect(cost.gem_chunk).toBeUndefined();
    expect(cost.gem_gemstone).toBeUndefined();
    expect(cost.local_specialty).toBeUndefined();
    expect(cost['3_star_enemy_material']).toBeUndefined();
  });

  it('6. Level 70 A4 -> Level 80 A5: leveling + Phase 5 ascension materials', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 70, 80, 4, 5);
    expect(cost.mora).toBe(422375); // 322,375 + 100,000
    expect(cost.heros_wit).toBe(80);
    expect(cost.boss_material).toBe(12);
    expect(cost.gem_chunk).toBe(6);
    expect(cost.local_specialty).toBe(45);
    expect(cost['3_star_enemy_material']).toBe(12);
  });

  it('7. Level 70 A5 -> Level 80 A6: leveling + Phase 6 ascension materials', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 70, 80, 5, 6);
    expect(cost.mora).toBe(442375); // 322,375 + 120,000
    expect(cost.heros_wit).toBe(80);
    expect(cost.boss_material).toBe(20);
    expect(cost.gem_gemstone).toBe(6);
    expect(cost.local_specialty).toBe(60);
    expect(cost['3_star_enemy_material']).toBe(24);
  });

  it('8. Level 20 A0 -> Level 20 A1: Phase 1 ascension only', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 20, 20, 0, 1);
    expect(cost.mora).toBe(20000);
    expect(cost.heros_wit).toBeUndefined();
    expect(cost.gem_sliver).toBe(1);
    expect(cost.local_specialty).toBe(3);
    expect(cost['1_star_enemy_material']).toBe(3);
    expect(cost.boss_material).toBeUndefined();
  });

  it('9. Level 20 A1 -> Level 40 A1: exact Level 20 -> 40 leveling, 0 ascension items', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 20, 40, 1, 1);
    expect(cost.mora).toBe(115665);
    expect(cost.heros_wit).toBe(29);
    expect(cost.boss_material).toBeUndefined();
    expect(cost.gem_sliver).toBeUndefined();
    expect(cost.gem_fragment).toBeUndefined();
    expect(cost.local_specialty).toBeUndefined();
  });

  it('10. Level 20 A1 -> Level 40 A2: leveling + Phase 2 ascension', () => {
    const cost = calculateProgressionCost(dummy5StarChar, 20, 40, 1, 2);
    expect(cost.mora).toBe(155665); // 115,665 + 40,000
    expect(cost.heros_wit).toBe(29);
    expect(cost.boss_material).toBe(2);
    expect(cost.gem_fragment).toBe(3);
    expect(cost.local_specialty).toBe(10);
    expect(cost['1_star_enemy_material']).toBe(15);
  });

  it('11. 4★ character parity: 4★ and 5★ yield identical Mora and material quantities', () => {
    const cost5 = calculateProgressionCost(dummy5StarChar, 80, 80, 5, 6);
    const cost4 = calculateProgressionCost(dummy4StarChar, 80, 80, 5, 6);
    expect(cost4.mora).toBe(cost5.mora);
    expect(cost4.mora).toBe(120000);
    expect(cost4.boss_material).toBe(cost5.boss_material);
    expect(cost4.local_specialty).toBe(cost5.local_specialty);

    const full5 = calculateProgressionCost(dummy5StarChar, 1, 90, 0, 6);
    const full4 = calculateProgressionCost(dummy4StarChar, 1, 90, 0, 6);
    expect(full4.mora).toBe(full5.mora);
    expect(full4.mora).toBe(2092530);
    expect(full4.heros_wit).toBe(full5.heros_wit);
    expect(full4.heros_wit).toBe(419);
  });

  it('12. Constellation milestones: awards 1 stella fortuna at 95 and 3 at 100', () => {
    const cost95 = calculateProgressionCost(dummy5StarChar, 90, 95, 6, 6);
    expect(cost95.masterless_stella_fortuna).toBe(1);

    const cost100 = calculateProgressionCost(dummy5StarChar, 90, 100, 6, 6);
    expect(cost100.masterless_stella_fortuna).toBe(3);
  });
});

describe('DEF-C2-06 Authoritative 1★ and 2★ Weapon Ascension Mora', () => {
  const dullBlade = weaponsData.find(w => w.name === 'Dull Blade');
  const silverSword = weaponsData.find(w => w.name === 'Silver Sword');

  // 1★ Dull Blade
  it('1★ weapon: individual ascension phase Mora matches authoritative schedule [0, 5000, 5000, 10000]', () => {
    // Phase 0: 20 A0 -> 20 A1 (0 Mora)
    const p0 = calculateWeaponCost(dullBlade, 20, 20, 0, 1, false, {});
    expect(p0.total_mora).toBe(0);

    // Phase 1: 40 A1 -> 40 A2 (5,000 Mora)
    const p1 = calculateWeaponCost(dullBlade, 40, 40, 1, 2, false, {});
    expect(p1.total_mora).toBe(5000);

    // Phase 2: 50 A2 -> 50 A3 (5,000 Mora)
    const p2 = calculateWeaponCost(dullBlade, 50, 50, 2, 3, false, {});
    expect(p2.total_mora).toBe(5000);

    // Phase 3: 60 A3 -> 60 A4 (10,000 Mora)
    const p3 = calculateWeaponCost(dullBlade, 60, 60, 3, 4, false, {});
    expect(p3.total_mora).toBe(10000);
  });

  it('1★ weapon: full 1 -> 70 A0 -> A4 progression calculates exactly 71,988 leveling + 20,000 ascension = 91,988 Mora', () => {
    const cost = calculateWeaponCost(dullBlade, 1, 70, 0, 4, false, {});
    expect(cost.total_mora).toBe(91988);
    assertValidQuantities(cost);
  });

  it('1★ weapon: capped at Ascension 4 / Level 70 (higher progression is invalid)', () => {
    const invalidTarget = calculateWeaponCost(dullBlade, 1, 90, 0, 6, false, {});
    expect(invalidTarget.isInvalid).toBe(true);
  });

  it('1★ weapon: completed 70 A4 -> 70 A4 yields empty cost object', () => {
    const completed = calculateWeaponCost(dullBlade, 70, 70, 4, 4, false, {});
    expect(completed).toEqual({});
  });

  // 2★ Silver Sword
  it('2★ weapon: individual ascension phase Mora matches authoritative schedule [5000, 5000, 10000, 15000]', () => {
    // Phase 0: 20 A0 -> 20 A1 (5,000 Mora)
    const p0 = calculateWeaponCost(silverSword, 20, 20, 0, 1, false, {});
    expect(p0.total_mora).toBe(5000);

    // Phase 1: 40 A1 -> 40 A2 (5,000 Mora)
    const p1 = calculateWeaponCost(silverSword, 40, 40, 1, 2, false, {});
    expect(p1.total_mora).toBe(5000);

    // Phase 2: 50 A2 -> 50 A3 (10,000 Mora)
    const p2 = calculateWeaponCost(silverSword, 50, 50, 2, 3, false, {});
    expect(p2.total_mora).toBe(10000);

    // Phase 3: 60 A3 -> 60 A4 (15,000 Mora)
    const p3 = calculateWeaponCost(silverSword, 60, 60, 3, 4, false, {});
    expect(p3.total_mora).toBe(15000);
  });

  it('2★ weapon: full 1 -> 70 A0 -> A4 progression calculates exactly 107,968 leveling + 35,000 ascension = 142,968 Mora', () => {
    const cost = calculateWeaponCost(silverSword, 1, 70, 0, 4, false, {});
    expect(cost.total_mora).toBe(142968);
    assertValidQuantities(cost);
  });

  it('2★ weapon: capped at Ascension 4 / Level 70 (higher progression is invalid)', () => {
    const invalidTarget = calculateWeaponCost(silverSword, 1, 80, 0, 5, false, {});
    expect(invalidTarget.isInvalid).toBe(true);
  });

  it('2★ weapon: completed 70 A4 -> 70 A4 yields empty cost object', () => {
    const completed = calculateWeaponCost(silverSword, 70, 70, 4, 4, false, {});
    expect(completed).toEqual({});
  });
});

describe('DEF-C2-03 Roster Detection (isCharacterInRoster)', () => {
  it('detects character in Zustand dictionary state.roster format', () => {
    const roster = {
      'Raiden Shogun': { level: 90, ascension: 6 },
      'Wanderer': { level: 80, ascension: 5 },
    };
    expect(isCharacterInRoster(roster, 'Raiden Shogun')).toBe(true);
    expect(isCharacterInRoster(roster, 'Wanderer')).toBe(true);
    expect(isCharacterInRoster(roster, 'Zhongli')).toBe(false);
  });

  it('handles canonical alias variations (e.g., RaidenShogun without space)', () => {
    const rosterWithSpacelessKey = {
      'RaidenShogun': { level: 90, ascension: 6 },
    };
    expect(isCharacterInRoster(rosterWithSpacelessKey, 'Raiden Shogun')).toBe(true);
  });

  it('rejects unowned character records ({ owned: false }, null, undefined, false)', () => {
    const roster = {
      'Raiden Shogun': { owned: false, level: 1 },
      'Wanderer': null,
      'Zhongli': undefined,
      'Furina': false,
    };
    expect(isCharacterInRoster(roster, 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster(roster, 'Wanderer')).toBe(false);
    expect(isCharacterInRoster(roster, 'Zhongli')).toBe(false);
    expect(isCharacterInRoster(roster, 'Furina')).toBe(false);
  });

  it('detects character in array of objects format (name or id)', () => {
    const arrayByName = [{ name: 'Raiden Shogun' }, { name: 'Nahida' }];
    const arrayById = [{ id: 'RaidenShogun' }];
    const arrayUnowned = [{ name: 'Raiden Shogun', owned: false }];

    expect(isCharacterInRoster(arrayByName, 'Raiden Shogun')).toBe(true);
    expect(isCharacterInRoster(arrayById, 'Raiden Shogun')).toBe(true);
    expect(isCharacterInRoster(arrayUnowned, 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster(arrayByName, 'Wanderer')).toBe(false);
  });

  it('detects character in array of strings format', () => {
    const stringArray = ['Raiden Shogun', 'Bennett'];
    expect(isCharacterInRoster(stringArray, 'Raiden Shogun')).toBe(true);
    expect(isCharacterInRoster(stringArray, 'Wanderer')).toBe(false);
  });

  it('detects character in Set format', () => {
    const rosterSet = new Set(['Wanderer', 'Kazuha']);
    expect(isCharacterInRoster(rosterSet, 'Wanderer')).toBe(true);
    expect(isCharacterInRoster(rosterSet, 'Raiden Shogun')).toBe(false);
  });

  it('returns false safely for empty, null, undefined, or invalid inputs', () => {
    expect(isCharacterInRoster(null, 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster(undefined, 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster({}, 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster([], 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster('invalid', 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster(12345, 'Raiden Shogun')).toBe(false);
    expect(isCharacterInRoster({ 'Raiden Shogun': {} }, null)).toBe(false);
  });
});

describe('DEF-C2-03 Weapon Ascension Discount Determination (getWeaponAscensionDiscount)', () => {
  const sword = { type: 'Sword' };
  const polearm = { type: 'Polearm' };
  const bow = { type: 'Bow' };
  const catalyst = { type: 'Catalyst' };
  const claymore = { type: 'Claymore' };

  it('Raiden Shogun grants 50% discount to Swords and Polearms only', () => {
    const roster = { 'Raiden Shogun': { level: 90 } };
    expect(getWeaponAscensionDiscount(sword, roster)).toEqual({ multiplier: 0.5, hasDiscount: true, discountSource: 'Raiden Shogun' });
    expect(getWeaponAscensionDiscount(polearm, roster)).toEqual({ multiplier: 0.5, hasDiscount: true, discountSource: 'Raiden Shogun' });
    expect(getWeaponAscensionDiscount(bow, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
    expect(getWeaponAscensionDiscount(catalyst, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
    expect(getWeaponAscensionDiscount(claymore, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
  });

  it('Wanderer grants 50% discount to Bows and Catalysts only', () => {
    const roster = { 'Wanderer': { level: 90 } };
    expect(getWeaponAscensionDiscount(bow, roster)).toEqual({ multiplier: 0.5, hasDiscount: true, discountSource: 'Wanderer' });
    expect(getWeaponAscensionDiscount(catalyst, roster)).toEqual({ multiplier: 0.5, hasDiscount: true, discountSource: 'Wanderer' });
    expect(getWeaponAscensionDiscount(sword, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
    expect(getWeaponAscensionDiscount(polearm, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
    expect(getWeaponAscensionDiscount(claymore, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
  });

  it('Claymores receive no discount even when both passives are owned', () => {
    const roster = { 'Raiden Shogun': {}, 'Wanderer': {} };
    expect(getWeaponAscensionDiscount(claymore, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
  });

  it('Owning both Raiden and Wanderer does not double-stack on any weapon type', () => {
    const roster = { 'Raiden Shogun': {}, 'Wanderer': {} };
    expect(getWeaponAscensionDiscount(sword, roster).multiplier).toBe(0.5);
    expect(getWeaponAscensionDiscount(polearm, roster).multiplier).toBe(0.5);
    expect(getWeaponAscensionDiscount(bow, roster).multiplier).toBe(0.5);
    expect(getWeaponAscensionDiscount(catalyst, roster).multiplier).toBe(0.5);
    expect(getWeaponAscensionDiscount(claymore, roster).multiplier).toBe(1.0);
  });

  it('Neither owned yields multiplier 1.0 and no discount', () => {
    const roster = {};
    expect(getWeaponAscensionDiscount(sword, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
    expect(getWeaponAscensionDiscount(bow, roster)).toEqual({ multiplier: 1, hasDiscount: false, discountSource: null });
  });
});

describe('DEF-C2-03 Mora Calculation Separation & Interaction', () => {
  const aquila = weaponsData.find(w => w.name === 'Aquila Favonia');
  const skywardHarp = weaponsData.find(w => w.name === 'Skyward Harp');

  it('leveling-only progression (80 A6 -> 90 A6) receives 0 discount even when Raiden is owned', () => {
    const noDiscount = calculateWeaponCost(aquila, 80, 90, 6, 6, false, {});
    const withRaiden = calculateWeaponCost(aquila, 80, 90, 6, 6, false, { 'Raiden Shogun': {} });
    expect(noDiscount.total_mora).toBe(371478);
    expect(withRaiden.total_mora).toBe(371478);
    expect(withRaiden.has_ascension_discount).toBe(true);
  });

  it('same-level ascension progression (80 A5 -> 80 A6) applies 50% discount strictly to ascension Mora', () => {
    const noDiscount = calculateWeaponCost(aquila, 80, 80, 5, 6, false, {});
    const withRaiden = calculateWeaponCost(aquila, 80, 80, 5, 6, false, { 'Raiden Shogun': {} });
    expect(noDiscount.total_mora).toBe(65000);
    expect(withRaiden.total_mora).toBe(32500); // Math.ceil(65000 * 0.5)
  });

  it('combined leveling and ascension progression (80 A5 -> 90 A6) discounts only ascension Mora (not leveling)', () => {
    const noDiscount = calculateWeaponCost(aquila, 80, 90, 5, 6, false, {});
    const withRaiden = calculateWeaponCost(aquila, 80, 90, 5, 6, false, { 'Raiden Shogun': {} });
    // Base: 371,478 leveling + 65,000 ascension = 436,478
    expect(noDiscount.total_mora).toBe(436478);
    // Discounted: 371,478 leveling + 32,500 ascension = 403,978
    expect(withRaiden.total_mora).toBe(403978);
    expect(withRaiden.total_mora).toBe(371478 + 32500);
  });

  it('multi-phase progression (1 A0 -> 90 A6) discounts full cumulative ascension Mora accurately', () => {
    const noDiscount = calculateWeaponCost(aquila, 1, 90, 0, 6, false, {});
    const withRaiden = calculateWeaponCost(aquila, 1, 90, 0, 6, false, { 'Raiden Shogun': {} });
    // Leveling: 906,445. Total ascension Mora: 225,000.
    expect(noDiscount.total_mora).toBe(1131445);
    // With 50% ascension discount: 906,445 + 112,500 = 1,018,945
    expect(withRaiden.total_mora).toBe(1018945);
    expect(noDiscount.total_mora - withRaiden.total_mora).toBe(112500);
  });

  it('Wanderer Bow discount behaves identically on Bow combined leveling and ascension', () => {
    const noDiscount = calculateWeaponCost(skywardHarp, 80, 90, 5, 6, false, {});
    const withWanderer = calculateWeaponCost(skywardHarp, 80, 90, 5, 6, false, { 'Wanderer': {} });
    expect(noDiscount.total_mora).toBe(436478);
    expect(withWanderer.total_mora).toBe(403978);
  });
});
