import { useMemo } from 'react';
import charactersData from '../../utils/characters';
import normalBossData from '../../data/normal_boss.json';
import localSpecialtyData from '../../data/local_specialty.json';
import weeklyBossData from '../../data/weekly_boss.json';
import talentData from '../../data/talent_materials.json';
import commonEnemyData from '../../data/common_enemy.json';
import eliteEnemyData from '../../data/elite_enemy.json';
import weaponAscensionData from '../../data/weapon_ascension.json';

function unique(arr) { return [...new Set(arr.filter(Boolean).sort())] }

export function useDataSuggestions() {
  return useMemo(() => {
    const chars = charactersData;

    const worldBoss = unique(normalBossData.map(m => m.name));
    const weeklyBoss = unique(weeklyBossData.map(m => m.name));
    const talentBook = unique(talentData.map(m => m.name));
    const mobMaterial = unique(commonEnemyData.map(m => m.name));
    const localSpec = unique(localSpecialtyData.map(m => m.name));
    const gemstone = unique(chars.map(c => c.materials?.gem_family_id));

    const ascensionMat = unique(weaponAscensionData.map(m => m.name));
    const eliteMat = unique(eliteEnemyData.map(m => m.name));
    const mobMat = mobMaterial;

    return { worldBoss, weeklyBoss, talentBook, mobMaterial, localSpec, gemstone, ascensionMat, eliteMat, mobMat };
  }, []);
}
