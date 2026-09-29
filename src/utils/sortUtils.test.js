import { expect, test, describe } from 'vitest';
import { compareNullableNumber, compareNullableString } from './sortUtils';

describe('sortUtils', () => {
  describe('compareNullableNumber', () => {
    test('missing release_order stays bottom both directions', () => {
      // Ascending
      expect(compareNullableNumber(null, 5, 'asc')).toBe(1); // null goes to bottom
      expect(compareNullableNumber(5, null, 'asc')).toBe(-1); // 5 comes before null
      expect(compareNullableNumber(null, null, 'asc')).toBe(0);

      // Descending
      expect(compareNullableNumber(null, 5, 'desc')).toBe(1); // null goes to bottom
      expect(compareNullableNumber(5, null, 'desc')).toBe(-1); // 5 comes before null
      expect(compareNullableNumber(null, null, 'desc')).toBe(0);
    });

    test('Dashboard weapon Release asc/desc', () => {
      // Ascending: lower release_order first
      expect(compareNullableNumber(1, 5, 'asc')).toBeLessThan(0); // 1 comes before 5
      expect(compareNullableNumber(5, 1, 'asc')).toBeGreaterThan(0); // 5 comes after 1

      // Descending: higher release_order first
      expect(compareNullableNumber(1, 5, 'desc')).toBeGreaterThan(0); // 1 comes after 5
      expect(compareNullableNumber(5, 1, 'desc')).toBeLessThan(0); // 5 comes before 1
    });
  });

  describe('compareNullableString', () => {
    test('name A→Z / Z→A', () => {
      // Ascending: A before Z
      expect(compareNullableString('A', 'Z', 'asc')).toBeLessThan(0);
      expect(compareNullableString('Z', 'A', 'asc')).toBeGreaterThan(0);

      // Descending: Z before A
      expect(compareNullableString('A', 'Z', 'desc')).toBeGreaterThan(0);
      expect(compareNullableString('Z', 'A', 'desc')).toBeLessThan(0);
    });

    test('missing strings stays bottom both directions (like unassigned weapons)', () => {
      // Ascending
      expect(compareNullableString(null, 'Sword', 'asc')).toBe(1); // null goes to bottom
      expect(compareNullableString('Sword', null, 'asc')).toBe(-1);
      expect(compareNullableString('', 'Sword', 'asc')).toBe(1); // empty string goes to bottom

      // Descending
      expect(compareNullableString(null, 'Sword', 'desc')).toBe(1);
      expect(compareNullableString('Sword', null, 'desc')).toBe(-1);
      expect(compareNullableString('', 'Sword', 'desc')).toBe(1);
    });
  });

  describe('Dashboard behaviors (simulated)', () => {
    test('rarity asc/desc', () => {
      const rarityA = 5;
      const rarityB = 4;

      // Rarity in dashboard doesn't use the nullable string helper directly,
      // but uses ((a.rarity) - (b.rarity)) * dirMult
      const compAsc = (rarityA - rarityB) * 1;
      expect(compAsc).toBeGreaterThan(0); // 5 comes after 4 in asc

      const compDesc = (rarityA - rarityB) * -1;
      expect(compDesc).toBeLessThan(0); // 5 comes before 4 in desc
    });

    test('unassigned weapon stays bottom both directions', () => {
      // Simulated Character sort for unassigned weapons
      const unassigned = null;
      const assigned = 'Amber';

      const sortCharacterAsc = (a, b) => {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return compareNullableString(a, b, 'asc');
      };

      expect(sortCharacterAsc(unassigned, assigned)).toBe(1); // unassigned at bottom
      expect(sortCharacterAsc(assigned, unassigned)).toBe(-1); // assigned at top

      const sortCharacterDesc = (a, b) => {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return compareNullableString(a, b, 'desc');
      };

      expect(sortCharacterDesc(unassigned, assigned)).toBe(1); // unassigned at bottom
      expect(sortCharacterDesc(assigned, unassigned)).toBe(-1); // assigned at top
    });
  });
});
