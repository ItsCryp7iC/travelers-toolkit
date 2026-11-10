import { useMemo } from 'react';
import { aggregateRosterCosts, getForgingCosts, computeToFarm } from '../../utils/aggregator';
import weaponForgingData from '../../data/weapon_forging.json';
import { computeCraftingPlan } from '../../utils/craftingEngine';
import { forecastCraftingPlan } from '../../utils/craftingBonusForecast';
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
function enhanceToFarm(baseToFarm, craftingPlan, mode, craftingBonusOptions, bonusForecast) {
  if (!baseToFarm) return baseToFarm;

  const isBonusActive = mode === 'crafting-aware' && Boolean(craftingBonusOptions?.enabled);

  const enhanceItem = (item) => {
    if (!item) return item;
    const rawShortage = typeof item.rawToFarm === 'number' ? item.rawToFarm : item.toFarm;
    const guaranteedShortage = craftingPlan.adjustedShortages[item.name] !== undefined
      ? craftingPlan.adjustedShortages[item.name]
      : rawShortage;

    const expectedShortage = (isBonusActive && bonusForecast?.expectedShortages?.[item.name] !== undefined)
      ? bonusForecast.expectedShortages[item.name]
      : guaranteedShortage;

    const activeToFarm = mode === 'raw'
      ? rawShortage
      : (isBonusActive ? expectedShortage : guaranteedShortage);

    const step = craftingPlan.craftingSteps.find((s) => s.outputItemId === item.name);
    const craftQuantity = step ? step.totalOutputProduced : 0;
    const family = getFamilyForMaterial(item.name);
    const familyPlan = family ? craftingPlan.families[family.familyId] : null;
    const familyForecast = family && bonusForecast ? bonusForecast.families[family.familyId] : null;
    const optimizedStep = familyForecast?.optimizedSteps?.find((s) => s.outputItemId === item.name) || null;
    const expectedCraftQuantity = (isBonusActive && optimizedStep) ? optimizedStep.expectedOutput : craftQuantity;
    const expectedCrafts = (isBonusActive && optimizedStep) ? optimizedStep.expectedCrafts : (step?.count || 0);
    const suggestedInitialBatch = (isBonusActive && optimizedStep) ? optimizedStep.suggestedInitialBatch : craftQuantity;

    return {
      ...item,
      rawToFarm: rawShortage,
      craftingAdjustedToFarm: guaranteedShortage,
      guaranteedToFarm: guaranteedShortage,
      expectedShortage,
      toFarm: activeToFarm,
      craftQuantity,
      expectedCraftQuantity,
      expectedCrafts,
      suggestedInitialBatch,
      optimizedStep,
      craftingPlan: familyPlan,
      bonusForecast: familyForecast,
      isCraftable: isMaterialCraftable(item.name),
      isBonusEligible: familyForecast?.isEligible ?? false,
      isBonusActive,
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

  // Recalculate allDone and likelyAllDone based on active mode
  if (mode === 'raw') {
    enhanced.allDone = baseToFarm.allDone;
    enhanced.likelyAllDone = baseToFarm.allDone;
  } else {
    // In crafting-aware mode, guaranteed allDone requires every material's guaranteed shortage to be 0.
    // Probabilistic bonuses never grant guaranteed allDone.
    let allGuaranteedCovered = !baseToFarm.isPartial;
    let allLikelyCovered = !baseToFarm.isPartial;

    if (!baseToFarm.isPartial) {
      for (const key of Object.keys(enhanced)) {
        if (['totalItems', 'allDone', 'likelyAllDone', 'mora', 'crown', 'isPartial', 'oreExp'].includes(key)) continue;
        const val = enhanced[key];
        if (Array.isArray(val)) {
          for (const i of val) {
            if (i) {
              if (i.guaranteedToFarm > 0) allGuaranteedCovered = false;
              if (i.toFarm > 0) allLikelyCovered = false;
            }
          }
        } else if (val) {
          if (val.guaranteedToFarm > 0) allGuaranteedCovered = false;
          if (val.toFarm > 0) allLikelyCovered = false;
        }
      }
    }

    enhanced.allDone = allGuaranteedCovered;
    enhanced.likelyAllDone = allLikelyCovered;
  }

  return enhanced;
}

export default function usePlannerData({
  roster,
  trackedWeapons,
  inventory,
  craftingMode = 'crafting-aware',
  craftingBonusOptions = { enabled: false, bonusType: 'double_output' },
}) {
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

  // 3. Pure deterministic bonus-aware crafting forecast
  const bonusForecast = useMemo(() => {
    return forecastCraftingPlan(
      craftingPlan,
      combinedTotals.totalCosts,
      inventory,
      craftingBonusOptions
    );
  }, [craftingPlan, combinedTotals.totalCosts, inventory, craftingBonusOptions]);

  // 4. Crafting-adjusted shortage dataset
  const craftingAdjustedToFarm = useMemo(() => {
    return enhanceToFarm(rawToFarm, craftingPlan, 'crafting-aware', craftingBonusOptions, bonusForecast);
  }, [rawToFarm, craftingPlan, craftingBonusOptions, bonusForecast]);

  // 5. Enhanced raw shortage dataset
  const enhancedRawToFarm = useMemo(() => {
    return enhanceToFarm(rawToFarm, craftingPlan, 'raw', craftingBonusOptions, bonusForecast);
  }, [rawToFarm, craftingPlan, craftingBonusOptions, bonusForecast]);

  // 6. Active toFarm model based on current craftingMode
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
    let expectedSumItems = 0;

    for (const key of Object.keys(toFarm)) {
      if (['totalItems', 'allDone', 'likelyAllDone', 'mora', 'crown', 'isPartial', 'oreExp'].includes(key)) continue;
      const val = toFarm[key];
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (item?.toFarm) sumItems += item.toFarm;
          if (typeof item?.rawToFarm === 'number') rawSumItems += item.rawToFarm;
          if (typeof item?.guaranteedToFarm === 'number') craftingAdjustedSumItems += item.guaranteedToFarm;
          if (typeof item?.expectedShortage === 'number') expectedSumItems += item.expectedShortage;
        });
      } else if (val) {
        if (val?.toFarm) sumItems += val.toFarm;
        if (typeof val?.rawToFarm === 'number') rawSumItems += val.rawToFarm;
        if (typeof val?.guaranteedToFarm === 'number') craftingAdjustedSumItems += val.guaranteedToFarm;
        if (typeof val?.expectedShortage === 'number') expectedSumItems += val.expectedShortage;
      }
    }

    const effectiveCraftingMora =
      craftingMode === 'crafting-aware' && craftingBonusOptions?.enabled
        ? (bonusForecast?.estimatedTotalMora ?? craftingPlan.craftingMora)
        : craftingPlan.craftingMora;

    return {
      mora,
      crowns,
      sumItems,
      rawSumItems,
      craftingAdjustedSumItems,
      expectedSumItems,
      craftingMora: craftingPlan.craftingMora,
      estimatedCraftingMora: bonusForecast?.estimatedTotalMora ?? craftingPlan.craftingMora,
      estimatedMoraSavings: bonusForecast?.estimatedTotalMoraSavings ?? 0,
      totalMoraWithCrafting: mora + effectiveCraftingMora,
      isAffordableMora: craftingPlan.isAffordableMora,
    };
  }, [toFarm, craftingPlan, bonusForecast, craftingMode, craftingBonusOptions]);

  const statusIndicators = useMemo(() => {
    return {
      allMaterialsDirectlyStocked: craftingPlan.allMaterialsDirectlyStocked,
      allMaterialsCoveredAfterCrafting: craftingPlan.allMaterialsCoveredByCrafting,
      requiresCrafting: craftingPlan.requiresCrafting,
      requiresFarming: remainingTotals.sumItems > 0,
      craftingMoraAffordable: craftingPlan.isAffordableMora,
      isLikelyCovered: bonusForecast?.allLikelyCovered ?? craftingPlan.allMaterialsCoveredByCrafting,
      isPartial: totals.isPartial,
    };
  }, [craftingPlan, remainingTotals.sumItems, bonusForecast, totals.isPartial]);

  return {
    totals,
    forgingTotals,
    combinedTotals,
    rawToFarm: enhancedRawToFarm,
    craftingAdjustedToFarm,
    activeToFarm: toFarm,
    toFarm,
    craftingPlan,
    bonusForecast,
    craftingBonusOptions,
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
