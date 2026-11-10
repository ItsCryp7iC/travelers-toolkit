import { describe, it, expect } from 'vitest';
import {
  CRAFTING_BONUSES,
  isBonusEligibleCategory,
  DEFAULT_CRAFTING_BONUS_TYPE,
  CRAFTING_BONUS_OPTIONS,
} from './craftingBonuses';

describe('Crafting Bonuses Registry', () => {
  it('defines the two canonical crafting bonus mechanics', () => {
    expect(Object.keys(CRAFTING_BONUSES)).toEqual(['double_output', 'ingredient_refund']);
  });

  it('correctly configures double_output bonus', () => {
    const bonus = CRAFTING_BONUSES.double_output;
    expect(bonus.probability).toBe(0.1);
    expect(bonus.extraOutput).toBe(1);
    expect(bonus.eligibleCategories).toEqual([
      'common_enemy',
      'elite_enemy',
      'talent_materials',
      'weapon_ascension',
    ]);
  });

  it('correctly configures ingredient_refund bonus', () => {
    const bonus = CRAFTING_BONUSES.ingredient_refund;
    expect(bonus.probability).toBe(0.25);
    expect(bonus.refundedIngredients).toBe(1);
    expect(bonus.eligibleCategories).toEqual([
      'common_enemy',
      'elite_enemy',
      'talent_materials',
      'weapon_ascension',
    ]);
  });

  it('validates category eligibility correctly', () => {
    expect(isBonusEligibleCategory('common_enemy', 'double_output')).toBe(true);
    expect(isBonusEligibleCategory('elite_enemy', 'double_output')).toBe(true);
    expect(isBonusEligibleCategory('talent_materials', 'double_output')).toBe(true);
    expect(isBonusEligibleCategory('weapon_ascension', 'double_output')).toBe(true);

    expect(isBonusEligibleCategory('common_enemy', 'ingredient_refund')).toBe(true);
    expect(isBonusEligibleCategory('elite_enemy', 'ingredient_refund')).toBe(true);
    expect(isBonusEligibleCategory('talent_materials', 'ingredient_refund')).toBe(true);
    expect(isBonusEligibleCategory('weapon_ascension', 'ingredient_refund')).toBe(true);

    // Ineligible categories
    expect(isBonusEligibleCategory('character_gems', 'double_output')).toBe(false);
    expect(isBonusEligibleCategory('character_gems', 'ingredient_refund')).toBe(false);
    expect(isBonusEligibleCategory('world_boss', 'double_output')).toBe(false);
    expect(isBonusEligibleCategory('local_specialty', 'double_output')).toBe(false);
  });

  it('defaults to double_output', () => {
    expect(DEFAULT_CRAFTING_BONUS_TYPE).toBe('double_output');
    expect(CRAFTING_BONUS_OPTIONS).toHaveLength(2);
  });
});

