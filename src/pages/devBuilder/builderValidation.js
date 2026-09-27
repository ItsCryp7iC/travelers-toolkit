import { useMemo } from 'react';
import normalBossData from '../../data/normal_boss.json';
import localSpecialtyData from '../../data/local_specialty.json';
import weeklyBossData from '../../data/weekly_boss.json';
import talentData from '../../data/talent_materials.json';
import commonEnemyData from '../../data/common_enemy.json';
import eliteEnemyData from '../../data/elite_enemy.json';
import weaponAscensionData from '../../data/weapon_ascension.json';
import { ELEMENTS, getGemFamily } from './constants';

export function useMaterialLookupMap(matQueue, stagedUpdates) {
  return useMemo(() => {
    const map = {};

    const extractToMap = (items) => {
      items.forEach(item => {
        if (item.id) {
          map[item.id] = item.id;
          if (item.name) map[item.name] = item.id;
        }
        if (item.tiers) {
          Object.values(item.tiers).forEach(t => {
            if (t.id) {
              map[t.id] = t.id;
              if (t.name) map[t.name] = t.id;
            }
          });
        }
      });
    };

    extractToMap(normalBossData);
    extractToMap(localSpecialtyData);
    extractToMap(weeklyBossData);
    extractToMap(talentData);
    extractToMap(commonEnemyData);
    extractToMap(eliteEnemyData);
    extractToMap(weaponAscensionData);

    const flatMatQueue = matQueue.flat();
    extractToMap(flatMatQueue);

    const stagedMats = [
      ...stagedUpdates['normal_boss.json'],
      ...stagedUpdates['local_specialty.json'],
      ...stagedUpdates['weekly_boss.json'],
      ...stagedUpdates['talent_materials.json'],
      ...stagedUpdates['common_enemy.json'],
      ...stagedUpdates['elite_enemy.json'],
      ...(stagedUpdates['weapon_ascension.json'] || []),
    ];
    extractToMap(stagedMats);

    ELEMENTS.forEach(el => {
      const gem = getGemFamily(el);
      map[gem] = gem;
    });

    return map;
  }, [matQueue, stagedUpdates]);
}

export function getMissingMaterials(mode, charData, weaponData, materialLookupMap) {
  if (mode === 'material') return [];

  const activeMaterials = mode === 'character'
    ? Object.values(charData.materials)
    : Object.values(weaponData.materials);

  const missing = [];
  for (const m of activeMaterials) {
    if (!m || m.trim() === '') continue;
    if (!materialLookupMap[m.trim()]) {
      missing.push(m.trim());
    }
  }
  return missing;
}
