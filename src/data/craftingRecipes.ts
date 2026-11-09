import commonEnemyData from './common_enemy.json';
import eliteEnemyData from './elite_enemy.json';
import talentMatsData from './talent_materials.json';
import weaponAscData from './weapon_ascension.json';
import characterGemsData from './character_gems.json';

export type CraftingCategory =
  | 'common_enemy'
  | 'elite_enemy'
  | 'talent_materials'
  | 'weapon_ascension'
  | 'character_gems';

export interface CraftingTier {
  id: string;
  name: string;
  rarity: number;
  tierIndex: number;
}

export interface CraftingRecipe {
  id: string;
  familyId: string;
  category: CraftingCategory;
  inputItemId: string;
  inputQty: number;
  outputItemId: string;
  outputQty: number;
  moraCost: number;
  isException?: boolean;
  exceptionNote?: string;
}

export interface CraftingFamily {
  familyId: string;
  category: CraftingCategory;
  name: string;
  isCraftable: boolean;
  tiers: CraftingTier[];
  recipes: CraftingRecipe[];
}

/**
 * Verified recipe Mora exceptions in Genshin Impact.
 * Keyed by recipe ID (craft_<outputItemId>).
 */
const RECIPE_MORA_EXCEPTIONS: Record<string, { moraCost: number; note: string }> = {
  // Vishap 4-star Fossilized Bone Shard: costs 50 Mora instead of standard 125 Mora
  craft_FossilizedBoneShard: {
    moraCost: 50,
    note: 'Vishap Fossilized Bone Shard (4-star) costs 50 Mora in game alchemy bench (standard elite tier 3 is 125 Mora)',
  },
  // Mirror Maiden 3-star Crystal Prism: costs 25 Mora instead of standard 50 Mora
  craft_CrystalPrism: {
    moraCost: 25,
    note: 'Mirror Maiden Crystal Prism (3-star) costs 25 Mora in game alchemy bench (standard elite tier 2 is 50 Mora)',
  },
  // Mirror Maiden 4-star Polarizing Prism: costs 50 Mora instead of standard 125 Mora
  craft_PolarizingPrism: {
    moraCost: 50,
    note: 'Mirror Maiden Polarizing Prism (4-star) costs 50 Mora in game alchemy bench (standard elite tier 3 is 125 Mora)',
  },
};

/**
 * Standard baseline Mora costs by category and transition step.
 * Step 0: lowest -> mid
 * Step 1: mid -> high
 * Step 2: high -> max (for 4-tier families)
 */
const STANDARD_MORA_COSTS: Record<CraftingCategory, number[]> = {
  common_enemy: [25, 50],
  elite_enemy: [50, 125],
  talent_materials: [175, 550],
  weapon_ascension: [125, 350, 1075],
  character_gems: [300, 900, 2700],
};

/**
 * Standard game rarities by category.
 */
const STANDARD_RARITIES: Record<CraftingCategory, number[]> = {
  common_enemy: [1, 2, 3],
  elite_enemy: [2, 3, 4],
  talent_materials: [2, 3, 4],
  weapon_ascension: [2, 3, 4, 5],
  character_gems: [2, 3, 4, 5], // Sliver = 2*, Fragment = 3*, Chunk = 4*, Gemstone = 5*
};

interface RawFamilyEntry {
  id: string;
  name: string;
  tiers?: Record<string, { id: string; name: string; sortOrder?: number }>;
}

function buildFamily(
  raw: RawFamilyEntry,
  category: CraftingCategory,
  tierKeyOrder: string[],
  isCraftable: boolean = true
): CraftingFamily {
  const tiers: CraftingTier[] = [];
  const recipes: CraftingRecipe[] = [];

  const rawTiers = raw.tiers || {};
  const rarities = STANDARD_RARITIES[category];

  tierKeyOrder.forEach((key, index) => {
    const rawTier = rawTiers[key];
    if (rawTier) {
      tiers.push({
        id: rawTier.id,
        name: rawTier.name,
        rarity: rarities[index] ?? (index + 1),
        tierIndex: index,
      });
    }
  });

  if (isCraftable && tiers.length > 1) {
    for (let i = 0; i < tiers.length - 1; i++) {
      const inputTier = tiers[i];
      const outputTier = tiers[i + 1];
      const recipeId = `craft_${outputTier.id}`;

      let moraCost = STANDARD_MORA_COSTS[category][i];
      let isException = false;
      let exceptionNote: string | undefined;

      const customException = RECIPE_MORA_EXCEPTIONS[recipeId];
      if (customException) {
        moraCost = customException.moraCost;
        isException = true;
        exceptionNote = customException.note;
      }

      recipes.push({
        id: recipeId,
        familyId: raw.id,
        category,
        inputItemId: inputTier.id,
        inputQty: 3,
        outputItemId: outputTier.id,
        outputQty: 1,
        moraCost,
        isException,
        exceptionNote,
      });
    }
  }

  return {
    familyId: raw.id,
    category,
    name: raw.name,
    isCraftable: isCraftable && recipes.length > 0,
    tiers,
    recipes,
  };
}

function compileRegistry(): CraftingFamily[] {
  const families: CraftingFamily[] = [];

  // 1. Common Enemy Drops (19 families, 3 tiers)
  (commonEnemyData as RawFamilyEntry[]).forEach((raw) => {
    families.push(buildFamily(raw, 'common_enemy', ['1_star', '2_star', '3_star']));
  });

  // 2. Elite Enemy Drops (33 families, 3 tiers)
  (eliteEnemyData as RawFamilyEntry[]).forEach((raw) => {
    families.push(buildFamily(raw, 'elite_enemy', ['2_star', '3_star', '4_star']));
  });

  // 3. Talent Materials (24 families, 3 tiers)
  (talentMatsData as RawFamilyEntry[]).forEach((raw) => {
    families.push(buildFamily(raw, 'talent_materials', ['2_star', '3_star', '4_star']));
  });

  // 4. Weapon Ascension Materials (24 families, 4 tiers)
  (weaponAscData as RawFamilyEntry[]).forEach((raw) => {
    families.push(buildFamily(raw, 'weapon_ascension', ['2_star', '3_star', '4_star', '5_star']));
  });

  // 5. Character Ascension Gems (8 families, 4 tiers)
  // Note: BrilliantDiamond is non-craftable (AR rewards only)
  (characterGemsData as RawFamilyEntry[]).forEach((raw) => {
    const isCraftable = raw.id !== 'BrilliantDiamond';
    families.push(
      buildFamily(raw, 'character_gems', ['1_star', '2_star', '3_star', '4_star'], isCraftable)
    );
  });

  return Object.freeze(families) as unknown as CraftingFamily[];
}

export const CRAFTING_FAMILIES: readonly CraftingFamily[] = compileRegistry();

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = Object.freeze(
  CRAFTING_FAMILIES.flatMap((f) => f.recipes)
);

export const CRAFTING_FAMILY_BY_ID: ReadonlyMap<string, CraftingFamily> = new Map(
  CRAFTING_FAMILIES.map((f) => [f.familyId, f])
);

export const CRAFTING_RECIPE_BY_ID: ReadonlyMap<string, CraftingRecipe> = new Map(
  CRAFTING_RECIPES.map((r) => [r.id, r])
);

export const CRAFTING_RECIPE_BY_OUTPUT: ReadonlyMap<string, CraftingRecipe> = new Map(
  CRAFTING_RECIPES.map((r) => [r.outputItemId, r])
);

export const ITEM_TO_FAMILY_MAP: ReadonlyMap<string, CraftingFamily> = new Map(
  CRAFTING_FAMILIES.flatMap((f) => f.tiers.map((t) => [t.id, f]))
);

export function getCraftingFamily(familyId: string): CraftingFamily | undefined {
  return CRAFTING_FAMILY_BY_ID.get(familyId);
}

export function getRecipeForOutput(outputItemId: string): CraftingRecipe | undefined {
  return CRAFTING_RECIPE_BY_OUTPUT.get(outputItemId);
}

export function getFamilyForMaterial(itemId: string): CraftingFamily | undefined {
  return ITEM_TO_FAMILY_MAP.get(itemId);
}

export function isMaterialCraftable(itemId: string): boolean {
  return CRAFTING_RECIPE_BY_OUTPUT.has(itemId);
}

export function getAllCraftingFamilies(): readonly CraftingFamily[] {
  return CRAFTING_FAMILIES;
}

export function getAllCraftingRecipes(): readonly CraftingRecipe[] {
  return CRAFTING_RECIPES;
}

