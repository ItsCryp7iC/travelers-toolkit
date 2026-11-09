import { useMemo } from 'react';
import { aggregateRosterCosts, getForgingCosts, computeToFarm } from '../../utils/aggregator';
import weaponForgingData from '../../data/weapon_forging.json';
import { computeCraftingPlan } from '../../utils/craftingEngine';
import { isMaterialCraftable, getFamilyForMaterial } from '../../data/craftingRecipes';
import {
  groupTalentBooks,
  groupWeaponAscensionMaterials,
  groupGemstones,
  groupWeeklyBosses,
  groupNormalBosses,
  groupLocalSpecialties,
  groupEliteEnemies,
  groupCommonEnemies
} from './plannerGrouping';

/**
 * Augments a toFarm dataset with crafting-adjusted shortages and metadata.
 */
function enhanceToFarm(baseToFarm, craftingPlan, mode) {
  if (!baseToFarm) return baseToFarm;

  const enhanceItem = (item) => {
    if (!item) return item;
    const rawShortage = typeof item.rawToFarm === 'number' ? item.rawToFarm : item.toFarm;
    const adjustedShortage = craftingPlan.adjustedShortages[item.name] !== undefined
      ? craftingPlan.adjustedShortages[item.name]
      : rawShortage;
    const activeToFarm = mode === 'raw' ? rawShortage : adjustedShortage;
    const step = craftingPlan.craftingSteps.find((s) => s.outputItemId === item.name);
    const craftQuantity = step ? step.totalOutputProduced : 0;
    const family = getFamilyForMaterial(item.name);
    const familyPlan = family ? craftingPlan.families[family.familyId] : null;

    return {
      ...item,
      rawToFarm: rawShortage,
      craftingAdjustedToFarm: adjustedShortage,
      toFarm: activeToFarm,
      craftQuantity,
      craftingPlan: familyPlan,
      isCraftable: isMaterialCraftable(item.name),
    };
  };

  const mapList = (list) => (Array.isArray(list) ? list.map(enhanceItem) : list);

  const enhanced = {
    ...baseToFarm,
    mora: enhanceItem(baseToFarm.mora),
    heroWits: enhanceItem(baseToFarm.heroWits),
    crown: enhanceItem(baseToFarm.crown),
    mysticOre: enhanceItem(baseToFarm.mysticOre),
    fineOre: enhanceItem(baseToFarm.fineOre),
    normalOre: enhanceItem(baseToFarm.normalOre),
    stellaFortuna: enhanceItem(baseToFarm.stellaFortuna),
    gemstones: mapList(baseToFarm.gemstones),
    worldBoss: mapList(baseToFarm.worldBoss),
    localSpecialty: mapList(baseToFarm.localSpecialty),
    mob: mapList(baseToFarm.mob),
    talentBooks: mapList(baseToFarm.talentBooks),
    weeklyBoss: mapList(baseToFarm.weeklyBoss),
    weaponAscMats: mapList(baseToFarm.weaponAscMats),
    eliteMob: mapList(baseToFarm.eliteMob),
    forgingMats: mapList(baseToFarm.forgingMats),
  };

  // Recalculate allDone based on active mode
  if (mode === 'raw') {
    enhanced.allDone = baseToFarm.allDone;
  } else {
    // In crafting-aware mode, allDone requires no partial calculation errors
    // and every material's adjusted shortage to be 0
    let allCovered = !baseToFarm.isPartial;
    if (allCovered) {
      for (const key of Object.keys(enhanced)) {
        if (['totalItems', 'allDone', 'mora', 'crown', 'isPartial', 'oreExp'].includes(key)) continue;
        const val = enhanced[key];
        if (Array.isArray(val)) {
          if (val.some((i) => i && i.toFarm > 0)) {
            allCovered = false;
            break;
          }
        } else if (val && val.toFarm > 0) {
          allCovered = false;
          break;
        }
      }
    }
    enhanced.allDone = allCovered;
  }

  return enhanced;
}

export default function usePlannerData({ roster, trackedWeapons, inventory, craftingMode = 'crafting-aware' }) {
  const totals = useMemo(() => aggregateRosterCosts(roster, trackedWeapons), [roster, trackedWeapons]);
  const forgingTotals = useMemo(() => getForgingCosts(trackedWeapons, weaponForgingData), [trackedWeapons]);

  const combinedTotals = useMemo(() => {
    const combinedCosts = { ...totals.totalCosts };
    for (const [k, v] of Object.entries(forgingTotals.totalCosts || {})) {
      combinedCosts[k] = (combinedCosts[k] || 0) + v;
    }
    return {
      totalCosts: combinedCosts,
      categories: { ...totals.categories, ...forgingTotals.categories },
      rarities: { ...totals.rarities, ...forgingTotals.rarities },
      breakdown: [...(totals.breakdown || []), ...(forgingTotals.breakdown || [])]
    };
  }, [totals, forgingTotals]);

  // 1. Raw baseline calculation
  const rawToFarm = useMemo(() => computeToFarm(combinedTotals, inventory), [combinedTotals, inventory]);

  // 2. Pure deterministic crafting plan calculation
  const craftingPlan = useMemo(() => {
    return computeCraftingPlan(combinedTotals.totalCosts, inventory, {
      priority: 'highest-tier',
      affordabilityMora: inventory?.['Mora'] ?? 0,
    });
  }, [combinedTotals.totalCosts, inventory]);

  // 3. Crafting-adjusted shortage dataset
  const craftingAdjustedToFarm = useMemo(() => {
    return enhanceToFarm(rawToFarm, craftingPlan, 'crafting-aware');
  }, [rawToFarm, craftingPlan]);

  // 4. Enhanced raw shortage dataset
  const enhancedRawToFarm = useMemo(() => {
    return enhanceToFarm(rawToFarm, craftingPlan, 'raw');
  }, [rawToFarm, craftingPlan]);

  // 5. Active toFarm model based on current craftingMode
  const toFarm = craftingMode === 'raw' ? enhancedRawToFarm : craftingAdjustedToFarm;

  const groupedBooksData = useMemo(
    () => groupTalentBooks(toFarm.talentBooks, totals, trackedWeapons),
    [toFarm.talentBooks, totals, trackedWeapons]
  );

  const groupedWeaponMatsData = useMemo(
    () => groupWeaponAscensionMaterials(toFarm.weaponAscMats, totals, trackedWeapons),
    [toFarm.weaponAscMats, totals, trackedWeapons]
  );

  const groupedGemstonesData = useMemo(
    () => groupGemstones(toFarm.gemstones, totals, trackedWeapons),
    [toFarm.gemstones, totals, trackedWeapons]
  );

  const groupedWeeklyBosses = useMemo(
    () => groupWeeklyBosses(toFarm.weeklyBoss, totals, trackedWeapons),
    [toFarm.weeklyBoss, totals, trackedWeapons]
  );

  const groupedNormalBosses = useMemo(
    () => groupNormalBosses(toFarm.worldBoss, totals, trackedWeapons),
    [toFarm.worldBoss, totals, trackedWeapons]
  );

  const groupedLocalSpecialties = useMemo(
    () => groupLocalSpecialties(toFarm.localSpecialty, totals, trackedWeapons),
    [toFarm.localSpecialty, totals, trackedWeapons]
  );

  const groupedEliteEnemies = useMemo(
    () => groupEliteEnemies(toFarm.eliteMob, totals, trackedWeapons),
    [toFarm.eliteMob, totals, trackedWeapons]
  );

  const groupedCommonEnemies = useMemo(
    () => groupCommonEnemies(toFarm.mob, totals, trackedWeapons),
    [toFarm.mob, totals, trackedWeapons]
  );

  const remainingTotals = useMemo(() => {
    let mora = toFarm.mora?.toFarm || 0;
    let crowns = toFarm.crown?.toFarm || 0;
    let sumItems = 0;
    let rawSumItems = 0;
    let craftingAdjustedSumItems = 0;

    for (const key of Object.keys(toFarm)) {
      if (['totalItems', 'allDone', 'mora', 'crown', 'isPartial', 'oreExp'].includes(key)) continue;
      const val = toFarm[key];
      if (Array.isArray(val)) {
        val.forEach(item => {
          if (item?.toFarm) sumItems += item.toFarm;
          if (typeof item?.rawToFarm === 'number') rawSumItems += item.rawToFarm;
          if (typeof item?.craftingAdjustedToFarm === 'number') craftingAdjustedSumItems += item.craftingAdjustedToFarm;
        });
      } else if (val?.toFarm) {
        sumItems += val.toFarm;
        if (typeof val?.rawToFarm === 'number') rawSumItems += val.rawToFarm;
        if (typeof val?.craftingAdjustedToFarm === 'number') craftingAdjustedSumItems += val.craftingAdjustedToFarm;
      }
    }
    return {
      mora,
      crowns,
      sumItems,
      rawSumItems,
      craftingAdjustedSumItems,
      craftingMora: craftingPlan.craftingMora,
      totalMoraWithCrafting: mora + craftingPlan.craftingMora,
      isAffordableMora: craftingPlan.isAffordableMora,
    };
  }, [toFarm, craftingPlan]);

  const statusIndicators = useMemo(() => {
    return {
      allMaterialsDirectlyStocked: craftingPlan.allMaterialsDirectlyStocked,
      allMaterialsCoveredAfterCrafting: craftingPlan.allMaterialsCoveredByCrafting,
      requiresCrafting: craftingPlan.requiresCrafting,
      requiresFarming: remainingTotals.sumItems > 0,
      craftingMoraAffordable: craftingPlan.isAffordableMora,
      isPartial: totals.isPartial,
    };
  }, [craftingPlan, remainingTotals.sumItems, totals.isPartial]);

  return {
    totals,
    forgingTotals,
    combinedTotals,
    rawToFarm: enhancedRawToFarm,
    craftingAdjustedToFarm,
    activeToFarm: toFarm,
    toFarm,
    craftingPlan,
    craftingMode,
    groupedBooksData,
    groupedWeaponMatsData,
    groupedGemstonesData,
    groupedWeeklyBosses,
    groupedNormalBosses,
    groupedLocalSpecialties,
    groupedEliteEnemies,
    groupedCommonEnemies,
    remainingTotals,
    statusIndicators
  };
}
