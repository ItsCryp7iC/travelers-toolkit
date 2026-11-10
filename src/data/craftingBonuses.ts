import { CraftingCategory } from './craftingRecipes';

export type CraftingBonusType = 'double_output' | 'ingredient_refund';

export interface CraftingBonus {
  id: CraftingBonusType;
  label: string;
  shortLabel: string;
  probability: number;
  extraOutput?: number;
  refundedIngredients?: number;
  eligibleCategories: CraftingCategory[];
  description: string;
}

/**
 * Master declarative definitions of generic Genshin Impact crafting bonus mechanics.
 * Supports:
 * - 10% Double Output (0.10 chance of +1 product)
 * - 25% Ingredient Refund (0.25 chance of 1 returned ingredient)
 *
 * Eligible categories:
 * - common_enemy
 * - elite_enemy
 * - talent_materials
 * - weapon_ascension
 *
 * Ineligible:
 * - character_gems (elemental gems have no alchemy bonus passives in Genshin Impact)
 * - normal boss, weekly boss, local specialties, ores, forging
 */
export const CRAFTING_BONUSES: Record<CraftingBonusType, CraftingBonus> = {
  double_output: {
    id: 'double_output',
    label: '10% Double Output',
    shortLabel: '10% Double',
    probability: 0.1,
    extraOutput: 1,
    eligibleCategories: [
      'common_enemy',
      'elite_enemy',
      'talent_materials',
      'weapon_ascension',
    ],
    description: 'Each eligible crafting operation has a 10% chance of producing one additional output item.',
  },
  ingredient_refund: {
    id: 'ingredient_refund',
    label: '25% Ingredient Refund',
    shortLabel: '25% Refund',
    probability: 0.25,
    refundedIngredients: 1,
    eligibleCategories: [
      'common_enemy',
      'elite_enemy',
      'talent_materials',
      'weapon_ascension',
    ],
    description: 'Each eligible crafting operation has a 25% chance of returning one consumed base ingredient.',
  },
};

export const DEFAULT_CRAFTING_BONUS_TYPE: CraftingBonusType = 'double_output';

export const CRAFTING_BONUS_OPTIONS: Array<{ id: CraftingBonusType; label: string; shortLabel: string }> = [
  { id: 'double_output', label: '10% Double Output', shortLabel: '10% Double' },
  { id: 'ingredient_refund', label: '25% Ingredient Refund', shortLabel: '25% Refund' },
];

/**
 * Checks whether a given crafting category is eligible for the specified crafting bonus mechanic.
 */
export function isBonusEligibleCategory(
  category: string,
  bonusType: CraftingBonusType = DEFAULT_CRAFTING_BONUS_TYPE
): boolean {
  const bonus = CRAFTING_BONUSES[bonusType];
  if (!bonus) return false;
  return bonus.eligibleCategories.includes(category as CraftingCategory);
}

