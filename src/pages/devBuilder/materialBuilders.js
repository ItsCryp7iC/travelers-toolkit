import normalBossData from '../../data/normal_boss.json'
import localSpecialtyData from '../../data/local_specialty.json'
import weeklyBossData from '../../data/weekly_boss.json'
import talentData from '../../data/talent_materials.json'
import commonEnemyData from '../../data/common_enemy.json'
import eliteEnemyData from '../../data/elite_enemy.json'
import weaponAscensionData from '../../data/weapon_ascension.json'
import { toPascalCase } from '../../utils/assetHelper';
import { sanitizeText } from './builderFormatters';

export const floatAdd = (base, increment) => parseFloat((base + increment).toFixed(3));

export const getLastSortOrder = (dataArray, defaultOrder, tierKey) => {
  if (!dataArray || dataArray.length === 0) return defaultOrder;
  const lastItem = dataArray[dataArray.length - 1];
  if (tierKey && lastItem.tiers && lastItem.tiers[tierKey]) {
    return lastItem.tiers[tierKey].sortOrder;
  }
  return lastItem.sortOrder || defaultOrder;
}

export function buildMatJson(subCat, data, queueLength) {
  switch (subCat) {
    case 'normal_boss': {
      const baseOrder = getLastSortOrder(normalBossData, 2.000);
      return {
        id: toPascalCase(data.name || ''),
        name: sanitizeText(data.name),
        type: 'normal_boss',
        boss_name: sanitizeText(data.bossName || ''),
        region: data.region || 'Unknown',
        sortOrder: floatAdd(baseOrder, (queueLength + 1) * 0.001)
      }
    }
    case 'local_spec': {
      const baseOrder = getLastSortOrder(localSpecialtyData, 8.000);
      return {
        id: toPascalCase(data.name || ''),
        name: sanitizeText(data.name),
        region: data.region || 'Unknown',
        sortOrder: floatAdd(baseOrder, (queueLength + 1) * 0.001)
      }
    }
    case 'weekly_boss': {
      const baseOrder = getLastSortOrder(weeklyBossData, 3.000);
      const startOrder = floatAdd(baseOrder, queueLength * 0.001);
      return [
        {
          id: toPascalCase(data.mat1 || ''),
          name: sanitizeText(data.mat1),
          type: 'weekly_boss',
          boss_name: sanitizeText(data.bossName || ''),
          region: data.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.001)
        },
        {
          id: toPascalCase(data.mat2 || ''),
          name: sanitizeText(data.mat2),
          type: 'weekly_boss',
          boss_name: sanitizeText(data.bossName || ''),
          region: data.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.002)
        },
        {
          id: toPascalCase(data.mat3 || ''),
          name: sanitizeText(data.mat3),
          type: 'weekly_boss',
          boss_name: sanitizeText(data.bossName || ''),
          region: data.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.003)
        }
      ]
    }
    case 'talent': {
      const baseOrder = getLastSortOrder(talentData, 4.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);

      const createSeries = (s, days, offset) => ({
        id: toPascalCase(s),
        name: sanitizeText(s),
        region: data.region || 'Unknown',
        tiers: {
          "4_star": {
            id: toPascalCase("Philosophies of " + s),
            name: sanitizeText("Philosophies of " + s),
            sortOrder: floatAdd(startOrder, offset + 0.001)
          },
          "3_star": {
            id: toPascalCase("Guide to " + s),
            name: sanitizeText("Guide to " + s),
            sortOrder: floatAdd(startOrder, offset + 0.002)
          },
          "2_star": {
            id: toPascalCase("Teachings of " + s),
            name: sanitizeText("Teachings of " + s),
            sortOrder: floatAdd(startOrder, offset + 0.003)
          }
        },
        domain: data.domain || '',
        days
      });

      return [
        createSeries(data.series1 || '', [1, 4], 0.000),
        createSeries(data.series2 || '', [2, 5], 0.003),
        createSeries(data.series3 || '', [3, 6], 0.006)
      ];
    }
    case 'weapon_asc': {
      const baseOrder = getLastSortOrder(weaponAscensionData, 7.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.004);

      const createSeries = (name, d5, d4, d3, d2, days, offset) => ({
        id: toPascalCase(name || ''),
        name: sanitizeText(name),
        region: data.region || 'Unknown',
        tiers: {
          "5_star": {
            id: toPascalCase(d5 || ''),
            name: sanitizeText(d5),
            sortOrder: floatAdd(startOrder, offset + 0.001)
          },
          "4_star": {
            id: toPascalCase(d4 || ''),
            name: sanitizeText(d4),
            sortOrder: floatAdd(startOrder, offset + 0.002)
          },
          "3_star": {
            id: toPascalCase(d3 || ''),
            name: sanitizeText(d3),
            sortOrder: floatAdd(startOrder, offset + 0.003)
          },
          "2_star": {
            id: toPascalCase(d2 || ''),
            name: sanitizeText(d2),
            sortOrder: floatAdd(startOrder, offset + 0.004)
          }
        },
        domain: data.domain || '',
        days
      });

      return [
        createSeries(data.series1Name, data.s1_5, data.s1_4, data.s1_3, data.s1_2, [1, 4], 0.000),
        createSeries(data.series2Name, data.s2_5, data.s2_4, data.s2_3, data.s2_2, [2, 5], 0.004),
        createSeries(data.series3Name, data.s3_5, data.s3_4, data.s3_3, data.s3_2, [3, 6], 0.008)
      ];
    }
    case 'common_drop': {
      const baseOrder = getLastSortOrder(commonEnemyData, 5.000, '1_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return {
        id: toPascalCase(data.groupName || ''),
        name: sanitizeText(data.groupName),
        type: 'common_enemy',
        tiers: {
          "3_star": {
            id: toPascalCase(data.star3 || ''),
            name: sanitizeText(data.star3),
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "2_star": {
            id: toPascalCase(data.star2 || ''),
            name: sanitizeText(data.star2),
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "1_star": {
            id: toPascalCase(data.star1 || ''),
            name: sanitizeText(data.star1),
            sortOrder: floatAdd(startOrder, 0.003)
          }
        }
      }
    }
    case 'elite_drop': {
      const baseOrder = getLastSortOrder(eliteEnemyData, 6.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return {
        id: toPascalCase(data.groupName || ''),
        name: sanitizeText(data.groupName),
        type: 'elite_enemy',
        tiers: {
          "4_star": {
            id: toPascalCase(data.star4 || ''),
            name: sanitizeText(data.star4),
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "3_star": {
            id: toPascalCase(data.star3 || ''),
            name: sanitizeText(data.star3),
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "2_star": {
            id: toPascalCase(data.star2 || ''),
            name: sanitizeText(data.star2),
            sortOrder: floatAdd(startOrder, 0.003)
          }
        }
      }
    }
    default:
      return data
  }
}
