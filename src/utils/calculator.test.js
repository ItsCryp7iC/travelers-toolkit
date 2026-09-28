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
  calculateWeaponCost
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

  it('same-level ascension mora differs between 4-star and 5-star', () => {
    const cost5 = calculateProgressionCost(dummy5StarChar, 80, 80, 5, 6);
    const cost4 = calculateProgressionCost(dummy4StarChar, 80, 80, 5, 6);
    expect(cost5.mora).toBeGreaterThan(cost4.mora);
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

  it('Invalid reverse progression returns empty object', () => {
    const cost1 = calculateWeaponCost(aquila, 90, 80, 6, 5, false, {});
    const cost2 = calculateWeaponCost(aquila, 80, 80, 6, 5, false, {});
    const cost3 = calculateWeaponCost(aquila, 50, 40, 2, 2, false, {});
    expect(cost1).toEqual({});
    expect(cost2).toEqual({});
    expect(cost3).toEqual({});
  });
});
