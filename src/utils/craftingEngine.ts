import {
  CRAFTING_FAMILIES,
  CRAFTING_RECIPES,
  CRAFTING_FAMILY_BY_ID,
  CRAFTING_RECIPE_BY_OUTPUT,
  ITEM_TO_FAMILY_MAP,
  CraftingCategory,
  CraftingFamily,
  CraftingRecipe,
} from '../data/craftingRecipes';

export interface CraftingStep {
  recipeId: string;
  familyId: string;
  category: CraftingCategory;
  inputItemId: string;
  inputItemName: string;
  inputQty: number; // 3
  outputItemId: string;
  outputItemName: string;
  outputQty: number; // 1
  count: number; // integer >= 1
  totalInputConsumed: number; // count * inputQty
  totalOutputProduced: number; // count * outputQty
  moraCostPerCraft: number;
  totalMoraCost: number; // count * moraCostPerCraft
}

export interface FamilyCraftingPlan {
  familyId: string;
  category: CraftingCategory;
  familyName: string;
  isCraftable: boolean;
  steps: CraftingStep[];
  directShortages: Record<string, number>;
  adjustedShortages: Record<string, number>;
  projectedInventory: Record<string, number>;
  craftingMora: number;
  allDirectlyStocked: boolean;
  allCoveredByCrafting: boolean;
  requiresCrafting: boolean;
}

export type CraftingDiagnosticCode =
  | 'NEGATIVE_QUANTITY'
  | 'FRACTIONAL_QUANTITY'
  | 'NON_NUMERIC_STRING'
  | 'NUMERIC_STRING_CONVERTED'
  | 'NON_FINITE_QUANTITY'
  | 'UNKNOWN_ITEM_KEY'
  | 'UNCRAFTABLE_ITEM'
  | 'INSUFFICIENT_MORA';

export interface CraftingDiagnostic {
  code: CraftingDiagnosticCode;
  severity: 'warning' | 'info';
  message: string;
  itemId?: string;
  rawValue?: unknown;
}

export interface CraftingPlanOptions {
  priority?: 'highest-tier' | 'direct-first';
  affordabilityMora?: number;
}

export interface CraftingPlanResult {
  directShortages: Record<string, number>;
  adjustedShortages: Record<string, number>;
  craftingSteps: CraftingStep[];
  projectedInventory: Record<string, number>;
  craftingMora: number;
  moraByFamily: Record<string, number>;
  moraByRecipe: Record<string, number>;
  isAffordableMora: boolean | null;
  remainingMoraAfterCrafting: number | null;
  remainingFarming: Record<string, number>;
  allMaterialsDirectlyStocked: boolean;
  allMaterialsCoveredByCrafting: boolean;
  requiresCrafting: boolean;
  families: Record<string, FamilyCraftingPlan>;
  diagnostics: CraftingDiagnostic[];
}

/**
 * Normalizes input quantities and reports diagnostics for malformed inputs.
 */
function normalizeQuantity(
  val: unknown,
  key: string,
  source: 'inventory' | 'requirements',
  diagnostics: CraftingDiagnostic[]
): number {
  if (val === undefined || val === null) {
    return 0;
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      diagnostics.push({
        code: 'NON_FINITE_QUANTITY',
        severity: 'warning',
        message: `Non-finite ${source} quantity for item "${key}" (${val}) normalized to 0`,
        itemId: key,
        rawValue: val,
      });
      return 0;
    }
    if (val < 0) {
      diagnostics.push({
        code: 'NEGATIVE_QUANTITY',
        severity: 'warning',
        message: `Negative ${source} quantity for item "${key}" (${val}) clamped to 0`,
        itemId: key,
        rawValue: val,
      });
      return 0;
    }
    if (!Number.isInteger(val)) {
      const floored = Math.floor(val);
      diagnostics.push({
        code: 'FRACTIONAL_QUANTITY',
        severity: 'warning',
        message: `Fractional ${source} quantity for item "${key}" (${val}) floored to ${floored}`,
        itemId: key,
        rawValue: val,
      });
      return floored;
    }
    return val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || isNaN(parsed)) {
      diagnostics.push({
        code: 'NON_NUMERIC_STRING',
        severity: 'warning',
        message: `Non-numeric string ${source} value for item "${key}" ("${val}") normalized to 0`,
        itemId: key,
        rawValue: val,
      });
      return 0;
    }
    const floored = Math.max(0, Math.floor(parsed));
    diagnostics.push({
      code: 'NUMERIC_STRING_CONVERTED',
      severity: 'info',
      message: `Numeric string ${source} value for item "${key}" ("${val}") converted to integer ${floored}`,
      itemId: key,
      rawValue: val,
    });
    return floored;
  }

  diagnostics.push({
    code: 'NON_NUMERIC_STRING',
    severity: 'warning',
    message: `Unsupported ${source} value type (${typeof val}) for item "${key}" normalized to 0`,
    itemId: key,
    rawValue: val,
  });
  return 0;
}

/**
 * Computes a pure, deterministic crafting allocation for a single crafting family.
 */
function allocateFamilyCrafting(
  family: CraftingFamily,
  normReq: Record<string, number>,
  normInv: Record<string, number>,
  priority: 'highest-tier' | 'direct-first'
): FamilyCraftingPlan {
  const tiers = family.tiers;
  const numTiers = tiers.length;

  const directShortages: Record<string, number> = {};
  const adjustedShortages: Record<string, number> = {};
  const projectedInventory: Record<string, number> = {};

  const owned = tiers.map((t) => normInv[t.id] ?? 0);
  const required = tiers.map((t) => normReq[t.id] ?? 0);

  // Direct reservation: physical inventory is first reserved against direct demand
  const directReserved = tiers.map((_, i) => Math.min(owned[i], required[i]));
  const directDeficit = tiers.map((_, i) => required[i] - directReserved[i]);
  const availableSurplus = tiers.map((_, i) => owned[i] - directReserved[i]);

  tiers.forEach((t, i) => {
    directShortages[t.id] = directDeficit[i];
  });

  const stepsMap: Record<number, number> = {}; // recipe step index (from tier i to i+1) -> count
  for (let i = 0; i < numTiers - 1; i++) {
    stepsMap[i] = 0;
  }

  if (family.isCraftable && numTiers > 1) {
    if (priority === 'highest-tier') {
      // Allocate to highest tier shortages first, down to tier 1
      for (let target = numTiers - 1; target >= 1; target--) {
        if (directDeficit[target] <= 0) continue;

        // Calculate max target tier units craftable from available surpluses below target
        let avail = 0;
        for (let j = 0; j < target; j++) {
          avail = Math.floor((avail + availableSurplus[j]) / 3);
        }

        const unitsToCraft = Math.min(directDeficit[target], avail);
        if (unitsToCraft <= 0) continue;

        // Deduce ingredients consumed from each lower tier
        let neededFromBelow = unitsToCraft * 3;
        stepsMap[target - 1] += unitsToCraft;
        directDeficit[target] -= unitsToCraft;

        for (let j = target - 1; j >= 0; j--) {
          const fromCurrentSurplus = Math.min(neededFromBelow, availableSurplus[j]);
          availableSurplus[j] -= fromCurrentSurplus;
          neededFromBelow -= fromCurrentSurplus;

          if (j > 0 && neededFromBelow > 0) {
            stepsMap[j - 1] += neededFromBelow;
            neededFromBelow = neededFromBelow * 3;
          }
        }
      }
    } else {
      // 'direct-first': satisfy immediate lower tier direct shortages before promoting
      for (let source = 0; source < numTiers - 1; source++) {
        const next = source + 1;
        const maxCraftable = Math.floor(availableSurplus[source] / 3);
        if (maxCraftable <= 0) continue;

        // In direct-first, only craft what satisfies next tier's deficit directly
        // unless next tier can promote further
        const unitsToCraft = Math.min(directDeficit[next], maxCraftable);
        if (unitsToCraft > 0) {
          stepsMap[source] += unitsToCraft;
          availableSurplus[source] -= unitsToCraft * 3;
          directDeficit[next] -= unitsToCraft;
        }
      }
    }
  }

  // Final accounting for the family
  const steps: CraftingStep[] = [];
  let familyCraftingMora = 0;

  for (let i = 0; i < numTiers - 1; i++) {
    const craftCount = stepsMap[i] || 0;
    if (craftCount > 0) {
      const recipe = family.recipes[i];
      const stepMora = craftCount * recipe.moraCost;
      familyCraftingMora += stepMora;

      steps.push({
        recipeId: recipe.id,
        familyId: family.familyId,
        category: family.category,
        inputItemId: recipe.inputItemId,
        inputItemName: tiers[i].name,
        inputQty: recipe.inputQty,
        outputItemId: recipe.outputItemId,
        outputItemName: tiers[i + 1].name,
        outputQty: recipe.outputQty,
        count: craftCount,
        totalInputConsumed: craftCount * recipe.inputQty,
        totalOutputProduced: craftCount * recipe.outputQty,
        moraCostPerCraft: recipe.moraCost,
        totalMoraCost: stepMora,
      });
    }
  }

  // Calculate adjusted shortages and projected leftovers
  tiers.forEach((t, i) => {
    adjustedShortages[t.id] = directDeficit[i];
    projectedInventory[t.id] = availableSurplus[i];
  });

  const allDirectlyStocked = tiers.every((t) => directShortages[t.id] === 0);
  const allCoveredByCrafting = tiers.every((t) => adjustedShortages[t.id] === 0);
  const requiresCrafting = steps.length > 0;

  return {
    familyId: family.familyId,
    category: family.category,
    familyName: family.name,
    isCraftable: family.isCraftable,
    steps,
    directShortages,
    adjustedShortages,
    projectedInventory,
    craftingMora: familyCraftingMora,
    allDirectlyStocked,
    allCoveredByCrafting,
    requiresCrafting,
  };
}

/**
 * Computes a pure, deterministic crafting plan across all material demands and inventory.
 *
 * @param grossRequirements - Map of canonical material ID to gross demanded quantity
 * @param inventory - Map of canonical material ID to currently owned quantity
 * @param options - Allocation priority ('highest-tier' | 'direct-first') and optional Mora affordability context
 * @returns Complete CraftingPlanResult with direct shortages, adjusted shortages, steps, leftovers, and diagnostics
 */
export function computeCraftingPlan(
  grossRequirements: Record<string, unknown> = {},
  inventory: Record<string, unknown> = {},
  options: CraftingPlanOptions = {}
): CraftingPlanResult {
  const diagnostics: CraftingDiagnostic[] = [];
  const priority = options.priority ?? 'highest-tier';

  // 1. Safe normalization without mutating inputs
  const normReq: Record<string, number> = {};
  for (const [key, val] of Object.entries(grossRequirements)) {
    normReq[key] = normalizeQuantity(val, key, 'requirements', diagnostics);
  }

  const normInv: Record<string, number> = {};
  for (const [key, val] of Object.entries(inventory)) {
    normInv[key] = normalizeQuantity(val, key, 'inventory', diagnostics);
  }

  const directShortages: Record<string, number> = {};
  const adjustedShortages: Record<string, number> = {};
  const projectedInventory: Record<string, number> = {};
  const remainingFarming: Record<string, number> = {};
  const allCraftingSteps: CraftingStep[] = [];
  const familiesResult: Record<string, FamilyCraftingPlan> = {};
  const moraByFamily: Record<string, number> = {};
  const moraByRecipe: Record<string, number> = {};
  let totalCraftingMora = 0;

  // 2. Process all registered crafting families
  const processedItemIds = new Set<string>();

  for (const family of CRAFTING_FAMILIES) {
    const familyPlan = allocateFamilyCrafting(family, normReq, normInv, priority);
    familiesResult[family.familyId] = familyPlan;

    if (familyPlan.steps.length > 0) {
      allCraftingSteps.push(...familyPlan.steps);
      moraByFamily[family.familyId] = familyPlan.craftingMora;
      totalCraftingMora += familyPlan.craftingMora;

      familyPlan.steps.forEach((step) => {
        moraByRecipe[step.recipeId] = (moraByRecipe[step.recipeId] || 0) + step.totalMoraCost;
      });
    }

    family.tiers.forEach((t) => {
      processedItemIds.add(t.id);
      directShortages[t.id] = familyPlan.directShortages[t.id] || 0;
      adjustedShortages[t.id] = familyPlan.adjustedShortages[t.id] || 0;
      projectedInventory[t.id] = familyPlan.projectedInventory[t.id] || 0;
      if (adjustedShortages[t.id] > 0) {
        remainingFarming[t.id] = adjustedShortages[t.id];
      }
    });
  }

  // 3. Process uncraftable items or items not belonging to any crafting family
  // (e.g., Mora, Hero's Wit, Local Specialties, Boss Drops, Billets, etc.)
  const allReferencedItemIds = new Set([
    ...Object.keys(normReq),
    ...Object.keys(normInv),
  ]);

  for (const itemId of allReferencedItemIds) {
    if (processedItemIds.has(itemId)) continue;

    const req = normReq[itemId] || 0;
    const own = normInv[itemId] || 0;
    const shortage = Math.max(0, req - own);
    const leftover = Math.max(0, own - req);

    directShortages[itemId] = shortage;
    adjustedShortages[itemId] = shortage; // Uncraftable: adjusted === direct
    projectedInventory[itemId] = leftover;

    if (shortage > 0) {
      remainingFarming[itemId] = shortage;
    }

    if (req > 0 && !ITEM_TO_FAMILY_MAP.has(itemId)) {
      diagnostics.push({
        code: 'UNCRAFTABLE_ITEM',
        severity: 'info',
        message: `Material "${itemId}" does not belong to any 3:1 alchemy crafting family; direct shortage calculated`,
        itemId,
      });
    }
  }

  // 4. Overall status indicators
  const allMaterialsDirectlyStocked = Object.values(directShortages).every((s) => s === 0);
  const allMaterialsCoveredByCrafting = Object.values(adjustedShortages).every((s) => s === 0);
  const requiresCrafting = allCraftingSteps.length > 0;

  // 5. Mora affordability calculation
  let ownedMora: number | null = null;
  if (options.affordabilityMora !== undefined) {
    ownedMora = Math.max(0, Math.floor(options.affordabilityMora));
  } else if (normInv['Mora'] !== undefined) {
    ownedMora = normInv['Mora'];
  }

  let isAffordableMora: boolean | null = null;
  let remainingMoraAfterCrafting: number | null = null;

  if (ownedMora !== null) {
    isAffordableMora = ownedMora >= totalCraftingMora;
    remainingMoraAfterCrafting = Math.max(0, ownedMora - totalCraftingMora);
    if (!isAffordableMora && totalCraftingMora > 0) {
      diagnostics.push({
        code: 'INSUFFICIENT_MORA',
        severity: 'warning',
        message: `Owned Mora (${ownedMora.toLocaleString()}) is insufficient to cover crafting fees (${totalCraftingMora.toLocaleString()})`,
      });
    }
  }

  return {
    directShortages,
    adjustedShortages,
    craftingSteps: allCraftingSteps,
    projectedInventory,
    craftingMora: totalCraftingMora,
    moraByFamily,
    moraByRecipe,
    isAffordableMora,
    remainingMoraAfterCrafting,
    remainingFarming,
    allMaterialsDirectlyStocked,
    allMaterialsCoveredByCrafting,
    requiresCrafting,
    families: familiesResult,
    diagnostics,
  };
}

