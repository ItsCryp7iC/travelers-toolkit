import { describe, it, expect } from 'vitest';
import {
  CRAFTING_FAMILIES,
  CRAFTING_RECIPES,
  CRAFTING_FAMILY_BY_ID,
  CRAFTING_RECIPE_BY_OUTPUT,
  ITEM_TO_FAMILY_MAP,
  getCraftingFamily,
  getRecipeForOutput,
  getFamilyForMaterial,
  isMaterialCraftable,
  getAllCraftingFamilies,
  getAllCraftingRecipes,
} from './craftingRecipes';
import { getPrimaryInventoryList } from '../utils/dataManager';

describe('Canonical Crafting Recipe Registry Integrity (Section 4)', () => {
  const primaryInventory = getPrimaryInventoryList();
  const validInventoryIds = new Set(primaryInventory.map((item) => item.matKey));

  it('1. all input IDs resolve to existing canonical inventory items', () => {
    CRAFTING_RECIPES.forEach((recipe) => {
      expect(
        validInventoryIds.has(recipe.inputItemId),
        `Recipe ${recipe.id} inputItemId "${recipe.inputItemId}" not found in primary inventory list`
      ).toBe(true);
    });
  });

  it('2. all output IDs resolve to existing canonical inventory items', () => {
    CRAFTING_RECIPES.forEach((recipe) => {
      expect(
        validInventoryIds.has(recipe.outputItemId),
        `Recipe ${recipe.id} outputItemId "${recipe.outputItemId}" not found in primary inventory list`
      ).toBe(true);
    });
  });

  it('3. every recipe has a globally unique ID', () => {
    const seenIds = new Set<string>();
    CRAFTING_RECIPES.forEach((recipe) => {
      expect(seenIds.has(recipe.id), `Duplicate recipe ID: ${recipe.id}`).toBe(false);
      seenIds.add(recipe.id);
    });
    expect(CRAFTING_RECIPES.length).toBe(247);
  });

  it('4. every family has a unique ID', () => {
    const seenFamilyIds = new Set<string>();
    CRAFTING_FAMILIES.forEach((family) => {
      expect(seenFamilyIds.has(family.familyId), `Duplicate family ID: ${family.familyId}`).toBe(
        false
      );
      seenFamilyIds.add(family.familyId);
    });
    expect(CRAFTING_FAMILIES.length).toBe(109);
  });

  it('5. no material belongs to conflicting crafting families', () => {
    const materialFamilyMap = new Map<string, string>();
    CRAFTING_FAMILIES.forEach((family) => {
      family.tiers.forEach((tier) => {
        const existing = materialFamilyMap.get(tier.id);
        if (existing) {
          expect(
            existing,
            `Material "${tier.id}" belongs to multiple families: "${existing}" and "${family.familyId}"`
          ).toBe(family.familyId);
        }
        materialFamilyMap.set(tier.id, family.familyId);
      });
    });
  });

  it('6. every recipe has positive integer ingredient (3) and output (1) quantities', () => {
    CRAFTING_RECIPES.forEach((recipe) => {
      expect(Number.isInteger(recipe.inputQty)).toBe(true);
      expect(recipe.inputQty).toBe(3);
      expect(Number.isInteger(recipe.outputQty)).toBe(true);
      expect(recipe.outputQty).toBe(1);
    });
  });

  it('7. Mora costs are finite, nonnegative integers', () => {
    CRAFTING_RECIPES.forEach((recipe) => {
      expect(Number.isInteger(recipe.moraCost)).toBe(true);
      expect(recipe.moraCost).toBeGreaterThan(0);
      expect(Number.isFinite(recipe.moraCost)).toBe(true);
    });
  });

  it('8. no cycles exist in crafting recipes', () => {
    const adjacency = new Map<string, string>();
    CRAFTING_RECIPES.forEach((r) => {
      adjacency.set(r.inputItemId, r.outputItemId);
    });

    CRAFTING_RECIPES.forEach((recipe) => {
      const visited = new Set<string>();
      let curr: string | undefined = recipe.inputItemId;
      while (curr) {
        expect(visited.has(curr), `Cycle detected involving item: ${curr}`).toBe(false);
        visited.add(curr);
        curr = adjacency.get(curr);
      }
    });
  });

  it('9. recipes do not produce lower-tier or equal-tier materials', () => {
    CRAFTING_FAMILIES.forEach((family) => {
      family.recipes.forEach((recipe) => {
        const inTier = family.tiers.find((t) => t.id === recipe.inputItemId);
        const outTier = family.tiers.find((t) => t.id === recipe.outputItemId);
        expect(inTier).toBeDefined();
        expect(outTier).toBeDefined();
        if (inTier && outTier) {
          expect(outTier.tierIndex).toBe(inTier.tierIndex + 1);
          expect(outTier.rarity).toBeGreaterThan(inTier.rarity);
        }
      });
    });
  });

  it('10. duplicate conflicting recipes are rejected (each output has exactly 1 recipe)', () => {
    const outputRecipeMap = new Map<string, string>();
    CRAFTING_RECIPES.forEach((recipe) => {
      expect(
        outputRecipeMap.has(recipe.outputItemId),
        `Multiple recipes produce output "${recipe.outputItemId}"`
      ).toBe(false);
      outputRecipeMap.set(recipe.outputItemId, recipe.id);
    });
  });

  it('11. Brilliant Diamond has no tier-up recipes and is marked non-craftable', () => {
    const diamondFamily = getCraftingFamily('BrilliantDiamond');
    expect(diamondFamily).toBeDefined();
    expect(diamondFamily?.isCraftable).toBe(false);
    expect(diamondFamily?.recipes.length).toBe(0);
    expect(diamondFamily?.tiers.length).toBe(4);

    // Verify individual Diamond items are not craftable
    expect(isMaterialCraftable('BrilliantDiamondFragment')).toBe(false);
    expect(isMaterialCraftable('BrilliantDiamondChunk')).toBe(false);
    expect(isMaterialCraftable('BrilliantDiamondGemstone')).toBe(false);
  });

  it('12. unsupported materials (boss drops, specialties, EXP books) have no recipes', () => {
    const unsupported = [
      'EverflameSeed',
      'DvalinsSigh',
      'WindwheelAster',
      'HerosWit',
      'Mora',
      'CrownOfInsight',
      'MysticEnhancementOre',
      'northlander_sword_billet',
    ];
    unsupported.forEach((id) => {
      expect(isMaterialCraftable(id)).toBe(false);
      expect(getRecipeForOutput(id)).toBeUndefined();
    });
  });

  it('13. material category and rarity are consistent with verified game data', () => {
    // Check Elemental Gemstones have 2★, 3★, 4★, 5★
    const pyroGem = getCraftingFamily('AgnidusAgate');
    expect(pyroGem).toBeDefined();
    expect(pyroGem?.tiers.map((t) => t.rarity)).toEqual([2, 3, 4, 5]);

    // Check Common Enemy Drops have 1★, 2★, 3★
    const slime = getCraftingFamily('Slime');
    expect(slime?.tiers.map((t) => t.rarity)).toEqual([1, 2, 3]);

    // Check Elite Enemy Drops have 2★, 3★, 4★
    const mitachurl = getCraftingFamily('Mitachurl');
    expect(mitachurl?.tiers.map((t) => t.rarity)).toEqual([2, 3, 4]);

    // Check Weapon Ascension has 2★, 3★, 4★, 5★
    const decarabian = getCraftingFamily('DecarabianTiles');
    expect(decarabian?.tiers.map((t) => t.rarity)).toEqual([2, 3, 4, 5]);

    // Check Talent Books have 2★, 3★, 4★
    const freedom = getCraftingFamily('Freedom');
    expect(freedom?.tiers.map((t) => t.rarity)).toEqual([2, 3, 4]);
  });

  it('14. four-tier families contain exactly 3 adjacent conversions', () => {
    const fourTierFamilies = CRAFTING_FAMILIES.filter(
      (f) => f.tiers.length === 4 && f.isCraftable
    );
    expect(fourTierFamilies.length).toBe(31); // 24 weapon + 7 elemental gems
    fourTierFamilies.forEach((f) => {
      expect(f.recipes.length).toBe(3);
      expect(f.recipes[0].inputItemId).toBe(f.tiers[0].id);
      expect(f.recipes[0].outputItemId).toBe(f.tiers[1].id);
      expect(f.recipes[1].inputItemId).toBe(f.tiers[1].id);
      expect(f.recipes[1].outputItemId).toBe(f.tiers[2].id);
      expect(f.recipes[2].inputItemId).toBe(f.tiers[2].id);
      expect(f.recipes[2].outputItemId).toBe(f.tiers[3].id);
    });
  });

  it('15. three-tier families contain exactly 2 adjacent conversions', () => {
    const threeTierFamilies = CRAFTING_FAMILIES.filter((f) => f.tiers.length === 3);
    expect(threeTierFamilies.length).toBe(77); // 19 common + 34 elite + 24 talent
    threeTierFamilies.forEach((f) => {
      expect(f.recipes.length).toBe(2);
      expect(f.recipes[0].inputItemId).toBe(f.tiers[0].id);
      expect(f.recipes[0].outputItemId).toBe(f.tiers[1].id);
      expect(f.recipes[1].inputItemId).toBe(f.tiers[1].id);
      expect(f.recipes[1].outputItemId).toBe(f.tiers[2].id);
    });
  });

  it('16. every supported eligible material family in repo catalog is accounted for', () => {
    const allFamilies = getAllCraftingFamilies();
    expect(allFamilies.length).toBe(109);

    const commonFamilies = allFamilies.filter((f) => f.category === 'common_enemy');
    expect(commonFamilies.length).toBe(19);

    const eliteFamilies = allFamilies.filter((f) => f.category === 'elite_enemy');
    expect(eliteFamilies.length).toBe(34);

    const talentFamilies = allFamilies.filter((f) => f.category === 'talent_materials');
    expect(talentFamilies.length).toBe(24);

    const weaponFamilies = allFamilies.filter((f) => f.category === 'weapon_ascension');
    expect(weaponFamilies.length).toBe(24);

    const gemFamilies = allFamilies.filter((f) => f.category === 'character_gems');
    expect(gemFamilies.length).toBe(8);

    const allRecipes = getAllCraftingRecipes();
    expect(allRecipes.length).toBe(247);
  });

  it('17. recipe exceptions remain explicitly represented', () => {
    // Vishap FossilizedBoneShard exception (50 Mora instead of standard 125)
    const boneRecipe = getRecipeForOutput('FossilizedBoneShard');
    expect(boneRecipe).toBeDefined();
    expect(boneRecipe?.moraCost).toBe(50);
    expect(boneRecipe?.isException).toBe(true);
    expect(boneRecipe?.exceptionNote).toContain('Vishap Fossilized Bone Shard');

    // Mirror Maiden CrystalPrism exception (25 Mora instead of standard 50)
    const prism3Recipe = getRecipeForOutput('CrystalPrism');
    expect(prism3Recipe).toBeDefined();
    expect(prism3Recipe?.moraCost).toBe(25);
    expect(prism3Recipe?.isException).toBe(true);

    // Mirror Maiden PolarizingPrism exception (50 Mora instead of standard 125)
    const prism4Recipe = getRecipeForOutput('PolarizingPrism');
    expect(prism4Recipe).toBeDefined();
    expect(prism4Recipe?.moraCost).toBe(50);
    expect(prism4Recipe?.isException).toBe(true);

    // Check helper lookups
    const slimeFamily = getFamilyForMaterial('SlimeConcentrate');
    expect(slimeFamily?.familyId).toBe('Slime');
    expect(CRAFTING_FAMILY_BY_ID.get('Slime')).toBe(slimeFamily);
    expect(CRAFTING_RECIPE_BY_OUTPUT.get('SlimeConcentrate')?.id).toBe('craft_SlimeConcentrate');
  });
});

