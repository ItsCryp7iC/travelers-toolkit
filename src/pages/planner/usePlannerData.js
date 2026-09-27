import { useMemo } from 'react';
import { aggregateRosterCosts, getForgingCosts, computeToFarm } from '../../utils/aggregator';
import weaponForgingData from '../../data/weapon_forging.json';
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

export default function usePlannerData({ roster, trackedWeapons, inventory }) {
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

  const toFarm = useMemo(() => computeToFarm(combinedTotals, inventory), [combinedTotals, inventory]);

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

    for (const key of Object.keys(toFarm)) {
      if (['totalItems', 'allDone', 'mora', 'crown'].includes(key)) continue;
      const val = toFarm[key];
      if (Array.isArray(val)) {
        val.forEach(item => {
          if (item?.toFarm) sumItems += item.toFarm;
        });
      } else if (val?.toFarm) {
        sumItems += val.toFarm;
      }
    }
    return { mora, crowns, sumItems };
  }, [toFarm]);

  return {
    totals,
    forgingTotals,
    combinedTotals,
    toFarm,
    groupedBooksData,
    groupedWeaponMatsData,
    groupedGemstonesData,
    groupedWeeklyBosses,
    groupedNormalBosses,
    groupedLocalSpecialties,
    groupedEliteEnemies,
    groupedCommonEnemies,
    remainingTotals
  };
}
