import { describe, it, expect } from 'vitest';
import {
  calculateRawSurplus,
  getGuaranteedUnallocatedQuantity,
  formatSurplusTitle,
  getThirdCellPresentation,
  resolveThirdCellPresentation,
} from './plannerSurplus';

describe('plannerSurplus utility suite (PLANNER-UI-R3 & R3.1)', () => {
  // ── 1. Positive Raw Extra ──
  it('1. calculates positive raw extra when owned exceeds required (Fixture A: Slime Condensate)', () => {
    // Need: 121, Have: 1,209 -> Extra: 1,088
    expect(calculateRawSurplus(1209, 121)).toBe(1088);
  });

  // ── 2. Zero Raw Extra when owned equals required ──
  it('2. returns zero when owned equals required (Fixture D)', () => {
    // Need: 121, Have: 121 -> Extra: 0
    expect(calculateRawSurplus(121, 121)).toBe(0);
  });

  // ── 3. Negative difference clamped to zero ──
  it('3. clamps negative mathematical difference to zero when owned is less than required (Fixture C)', () => {
    // Need: 121, Have: 100 -> Extra: 0 (shortage of 21)
    expect(calculateRawSurplus(100, 121)).toBe(0);
  });

  // ── 4. Noncraftable material surplus ──
  it('4. calculates raw extra for noncraftable materials (Fixture B: Philanemo Mushroom)', () => {
    // Need: 10, Have: 18 -> Extra: 8
    expect(calculateRawSurplus(18, 10)).toBe(8);
  });

  // ── 5. Zero requirements with positive inventory ──
  it('5. treats all owned materials as surplus when required is zero', () => {
    // Need: 0, Have: 50 -> Extra: 50
    expect(calculateRawSurplus(50, 0)).toBe(50);
  });

  // ── 6. No inventory and no demand ──
  it('6. returns zero when owned is zero and required is zero', () => {
    expect(calculateRawSurplus(0, 0)).toBe(0);
  });

  // ── 7. Input validation and edge cases ──
  it('7. safely handles invalid, undefined, null, negative, and fractional inputs', () => {
    expect(calculateRawSurplus(undefined, 10)).toBe(0);
    expect(calculateRawSurplus(10, undefined)).toBe(10);
    expect(calculateRawSurplus(null, null)).toBe(0);
    expect(calculateRawSurplus('invalid', 10)).toBe(0);
    expect(calculateRawSurplus(-50, 10)).toBe(0);
    expect(calculateRawSurplus(50, -10)).toBe(50);
    expect(calculateRawSurplus(100.8, 50.2)).toBe(50);
    expect(calculateRawSurplus(NaN, 5)).toBe(0);
    expect(calculateRawSurplus(Infinity, 5)).toBe(0);
  });

  // ── 8. Large quantities ──
  it('8. preserves exact numerical precision for large quantities without overflow', () => {
    expect(calculateRawSurplus(1000000, 500)).toBe(999500);
    expect(calculateRawSurplus(9007199254740991, 1)).toBe(9007199254740990);
  });

  // ── 9. getGuaranteedUnallocatedQuantity ──
  describe('getGuaranteedUnallocatedQuantity', () => {
    it('9. retrieves unallocated surplus from valid familyPlan.projectedInventory', () => {
      const familyPlan = {
        familyId: 'Slime',
        projectedInventory: {
          SlimeCondensate: 788,
          SlimeSecretions: 0,
          SlimeConcentrate: 15,
        },
      };

      expect(getGuaranteedUnallocatedQuantity(familyPlan, 'SlimeCondensate')).toBe(788);
      expect(getGuaranteedUnallocatedQuantity(familyPlan, 'SlimeSecretions')).toBe(0);
      expect(getGuaranteedUnallocatedQuantity(familyPlan, 'SlimeConcentrate')).toBe(15);
    });

    it('10. returns null when familyPlan or projectedInventory is missing', () => {
      expect(getGuaranteedUnallocatedQuantity(null, 'SlimeCondensate')).toBeNull();
      expect(getGuaranteedUnallocatedQuantity(undefined, 'SlimeCondensate')).toBeNull();
      expect(getGuaranteedUnallocatedQuantity({}, 'SlimeCondensate')).toBeNull();
      expect(getGuaranteedUnallocatedQuantity({ projectedInventory: null }, 'SlimeCondensate')).toBeNull();
      expect(getGuaranteedUnallocatedQuantity({ projectedInventory: {} }, 'MissingMaterial')).toBeNull();
    });

    it('11. returns null for invalid materialId', () => {
      const familyPlan = { projectedInventory: { SlimeCondensate: 100 } };
      expect(getGuaranteedUnallocatedQuantity(familyPlan, null)).toBeNull();
      expect(getGuaranteedUnallocatedQuantity(familyPlan, '')).toBeNull();
      expect(getGuaranteedUnallocatedQuantity(familyPlan, 123)).toBeNull();
    });

    it('12. clamps negative or fractional numbers in projectedInventory safely', () => {
      const familyPlan = {
        projectedInventory: {
          InvalidNeg: -10,
          Fractional: 12.7,
        },
      };
      expect(getGuaranteedUnallocatedQuantity(familyPlan, 'InvalidNeg')).toBe(0);
      expect(getGuaranteedUnallocatedQuantity(familyPlan, 'Fractional')).toBe(12);
    });
  });

  // ── 13. formatSurplusTitle ──
  describe('formatSurplusTitle', () => {
    it('13. formats accessible description for craftable surplus with reservation context', () => {
      const title = formatSurplusTitle({
        rawExtra: 1088,
        owned: 1209,
        required: 121,
        isCraftable: true,
      });
      expect(title).toBe(
        'Extra before crafting. Some materials may be needed for higher-tier crafting.'
      );
    });

    it('14. formats accessible description for noncraftable surplus without crafting mentions', () => {
      const title = formatSurplusTitle({
        rawExtra: 8,
        owned: 18,
        required: 10,
        isCraftable: false,
      });
      expect(title).toBe('Materials owned beyond current progression requirements.');
    });

    it('15. formats description for zero-demand materials', () => {
      const title = formatSurplusTitle({
        rawExtra: 50,
        owned: 50,
        required: 0,
        isCraftable: true,
      });
      expect(title).toBe('No current plan requires this item. All 50 owned are surplus.');
    });

    it('16. returns empty string when rawExtra is 0 or negative', () => {
      expect(formatSurplusTitle({ rawExtra: 0, owned: 10, required: 10 })).toBe('');
      expect(formatSurplusTitle({ rawExtra: -5, owned: 5, required: 10 })).toBe('');
    });
  });

  // ── Dynamic Third Cell Presentation (PLANNER-UI-R3.1) ──
  describe('getThirdCellPresentation', () => {
    it('17. Case A: renders To Farm when effective shortage is positive', () => {
      const result = getThirdCellPresentation({
        required: 411,
        owned: 300,
        toFarm: 77,
        guaranteedShortage: 111,
        expectedShortage: 77,
        isBonusActive: true,
        isCraftable: true,
        accent: '#4ADE80',
      });

      expect(result.label).toBe('To Farm');
      expect(result.formattedValue).toBe('~77');
      expect(result.rawValue).toBe(77);
      expect(result.color).toBe('#4ADE80');
      expect(result.isExtra).toBe(false);
      expect(result.isLikelyCovered).toBe(false);
      expect(result.title).toBe('Est. To Farm: 77 (Guaranteed: 111)');
    });

    it('18. Case A: preserves positive fractional expected shortage as shortage without rounding to 0', () => {
      const result = getThirdCellPresentation({
        required: 10,
        owned: 9,
        toFarm: 0.4,
        guaranteedShortage: 1,
        expectedShortage: 0.4,
        isBonusActive: true,
        isCraftable: true,
      });

      expect(result.label).toBe('To Farm');
      expect(result.isExtra).toBe(false);
      expect(result.rawValue).toBe(0.4);
      expect(result.formattedValue).toBe('~0.4');
      expect(result.title).toBe('Est. To Farm: 0.4 (Guaranteed: 1)');
    });

    it('19. Case A: prioritizes To Farm if effective shortage is positive even if rawExtra is present', () => {
      const result = getThirdCellPresentation({
        required: 100,
        owned: 120,
        toFarm: 15,
        guaranteedShortage: 15,
        expectedShortage: 15,
        isBonusActive: false,
        isCraftable: true,
        accent: '#FBBF24',
      });

      expect(result.label).toBe('To Farm');
      expect(result.formattedValue).toBe('15');
      expect(result.isExtra).toBe(false);
      expect(result.title).toContain('To Farm: 15');
      expect(result.title).toContain('Raw extra: +20');
    });

    it('20. Case B: renders To Farm: 🎲 ~0 when guaranteedShortage > 0 but expectedShortage === 0', () => {
      const result = getThirdCellPresentation({
        required: 10,
        owned: 5,
        toFarm: 0,
        guaranteedShortage: 5,
        expectedShortage: 0,
        isBonusActive: true,
        isCraftable: true,
      });

      expect(result.label).toBe('To Farm');
      expect(result.formattedValue).toBe('🎲 ~0');
      expect(result.color).toBe('#60A5FA');
      expect(result.isExtra).toBe(false);
      expect(result.isLikelyCovered).toBe(true);
      expect(result.title).toBe('Guaranteed shortage: 5');
    });

    it('21. Case C: renders Extra with + prefix and green color when no shortage and rawExtra > 0 (craftable)', () => {
      // Need: 219, Have: 6,011 -> Extra +5,792
      const result = getThirdCellPresentation({
        required: 219,
        owned: 6011,
        toFarm: 0,
        guaranteedShortage: 0,
        expectedShortage: 0,
        isBonusActive: false,
        isCraftable: true,
      });

      expect(result.label).toBe('Extra');
      expect(result.formattedValue).toBe('+5,792');
      expect(result.rawValue).toBe(5792);
      expect(result.color).toBe('#34D399');
      expect(result.isExtra).toBe(true);
      expect(result.isLikelyCovered).toBe(false);
      expect(result.title).toBe(
        'Extra before crafting. Some materials may be needed for higher-tier crafting.'
      );
    });

    it('22. Case C: renders Extra with appropriate tooltip for noncraftable materials (Philanemo Mushroom)', () => {
      // Need: 10, Have: 18 -> Extra +8
      const result = getThirdCellPresentation({
        required: 10,
        owned: 18,
        toFarm: 0,
        guaranteedShortage: 0,
        expectedShortage: 0,
        isBonusActive: false,
        isCraftable: false,
      });

      expect(result.label).toBe('Extra');
      expect(result.formattedValue).toBe('+8');
      expect(result.isExtra).toBe(true);
      expect(result.title).toBe('Materials owned beyond current progression requirements.');
    });

    it('23. Case C: renders Extra with zero-demand tooltip when required is 0', () => {
      const result = getThirdCellPresentation({
        required: 0,
        owned: 50,
        toFarm: 0,
        guaranteedShortage: 0,
        expectedShortage: 0,
        isBonusActive: false,
        isCraftable: true,
      });

      expect(result.label).toBe('Extra');
      expect(result.formattedValue).toBe('+50');
      expect(result.isExtra).toBe(true);
      expect(result.title).toBe('No current plan requires this item. All 50 owned are surplus.');
    });

    it('24. Case D: renders To Farm 0 when sufficiently covered and rawExtra is 0 (Fixture D)', () => {
      const result = getThirdCellPresentation({
        required: 121,
        owned: 121,
        toFarm: 0,
        guaranteedShortage: 0,
        expectedShortage: 0,
        isBonusActive: false,
        isCraftable: true,
      });

      expect(result.label).toBe('To Farm');
      expect(result.formattedValue).toBe('0');
      expect(result.color).toBe('var(--muted)');
      expect(result.isExtra).toBe(false);
      expect(result.isLikelyCovered).toBe(false);
      expect(result.title).toBe('To Farm: 0');
    });

    it('25. resolves identical results via resolveThirdCellPresentation alias', () => {
      expect(resolveThirdCellPresentation).toBe(getThirdCellPresentation);
    });
  });
});
