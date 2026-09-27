import normalBossData from '../../data/normal_boss.json'
import localSpecialtyData from '../../data/local_specialty.json'
import weeklyBossData from '../../data/weekly_boss.json'
import talentData from '../../data/talent_materials.json'
import commonEnemyData from '../../data/common_enemy.json'
import eliteEnemyData from '../../data/elite_enemy.json'
import weaponAscensionData from '../../data/weapon_ascension.json'
import { toPascalCase } from '../../utils/assetHelper';
import { sanitizeText } from './builderFormatters';
import type { MaterialSubcategory } from '../../types/devBuilder';

export interface GeneratedTier {
  id: string;
  name: string;
  sortOrder: number;
}

export interface NormalBossBuilderInput { name?: string; bossName?: string; region?: string; }
export interface NormalBossGenerated { id: string; name: string; type: 'normal_boss'; boss_name: string; region: string; sortOrder: number; }

export interface LocalSpecBuilderInput { name?: string; region?: string; }
export interface LocalSpecGenerated { id: string; name: string; region: string; sortOrder: number; }

export interface WeeklyBossBuilderInput { bossName?: string; region?: string; mat1?: string; mat2?: string; mat3?: string; }
export interface WeeklyBossGenerated { id: string; name: string; type: 'weekly_boss'; boss_name: string; region: string; sortOrder: number; }

export interface TalentBuilderInput { series1?: string; series2?: string; series3?: string; domain?: string; region?: string; }
export interface TalentGenerated { id: string; name: string; region: string; tiers: Record<string, GeneratedTier>; domain: string; days: number[]; }

export interface WeaponAscBuilderInput { series1Name?: string; s1_5?: string; s1_4?: string; s1_3?: string; s1_2?: string; series2Name?: string; s2_5?: string; s2_4?: string; s2_3?: string; s2_2?: string; series3Name?: string; s3_5?: string; s3_4?: string; s3_3?: string; s3_2?: string; domain?: string; region?: string; }
export interface WeaponAscGenerated { id: string; name: string; region: string; tiers: Record<string, GeneratedTier>; domain: string; days: number[]; }

export interface CommonDropBuilderInput { groupName?: string; star3?: string; star2?: string; star1?: string; }
export interface CommonDropGenerated { id: string; name: string; type: 'common_enemy'; tiers: Record<string, GeneratedTier>; }

export interface EliteDropBuilderInput { groupName?: string; star4?: string; star3?: string; star2?: string; }
export interface EliteDropGenerated { id: string; name: string; type: 'elite_enemy'; tiers: Record<string, GeneratedTier>; }

export type GeneratedMaterialOutput =
  | NormalBossGenerated
  | LocalSpecGenerated
  | WeeklyBossGenerated[]
  | TalentGenerated[]
  | WeaponAscGenerated[]
  | CommonDropGenerated
  | EliteDropGenerated;

export const floatAdd = (base: number, increment: number): number => parseFloat((base + increment).toFixed(3));

interface SortOrderItem {
  sortOrder?: number;
  tiers?: Record<string, { sortOrder?: number }>;
}

export const getLastSortOrder = (dataArray: SortOrderItem[], defaultOrder: number, tierKey?: string): number => {
  if (!dataArray || dataArray.length === 0) return defaultOrder;
  const lastItem = dataArray[dataArray.length - 1];
  if (tierKey && lastItem.tiers && lastItem.tiers[tierKey] && lastItem.tiers[tierKey].sortOrder !== undefined) {
    return lastItem.tiers[tierKey].sortOrder!;
  }
  return lastItem.sortOrder || defaultOrder;
}

export function buildMatJson(subCat: 'normal_boss', data: NormalBossBuilderInput, queueLength: number): NormalBossGenerated;
export function buildMatJson(subCat: 'local_spec', data: LocalSpecBuilderInput, queueLength: number): LocalSpecGenerated;
export function buildMatJson(subCat: 'weekly_boss', data: WeeklyBossBuilderInput, queueLength: number): WeeklyBossGenerated[];
export function buildMatJson(subCat: 'talent', data: TalentBuilderInput, queueLength: number): TalentGenerated[];
export function buildMatJson(subCat: 'weapon_asc', data: WeaponAscBuilderInput, queueLength: number): WeaponAscGenerated[];
export function buildMatJson(subCat: 'common_drop', data: CommonDropBuilderInput, queueLength: number): CommonDropGenerated;
export function buildMatJson(subCat: 'elite_drop', data: EliteDropBuilderInput, queueLength: number): EliteDropGenerated;
export function buildMatJson<T>(subCat: string, data: T, queueLength: number): T | GeneratedMaterialOutput;
export function buildMatJson(subCat: string, data: unknown, queueLength: number): unknown {
  switch (subCat) {
    case 'normal_boss': {
      const typedData = data as NormalBossBuilderInput;
      const baseOrder = getLastSortOrder(normalBossData, 2.000);
      return {
        id: toPascalCase(typedData.name || ''),
        name: sanitizeText(typedData.name) as string,
        type: 'normal_boss',
        boss_name: sanitizeText(typedData.bossName || '') as string,
        region: typedData.region || 'Unknown',
        sortOrder: floatAdd(baseOrder, (queueLength + 1) * 0.001)
      }
    }
    case 'local_spec': {
      const typedData = data as LocalSpecBuilderInput;
      const baseOrder = getLastSortOrder(localSpecialtyData, 8.000);
      return {
        id: toPascalCase(typedData.name || ''),
        name: sanitizeText(typedData.name) as string,
        region: typedData.region || 'Unknown',
        sortOrder: floatAdd(baseOrder, (queueLength + 1) * 0.001)
      }
    }
    case 'weekly_boss': {
      const typedData = data as WeeklyBossBuilderInput;
      const baseOrder = getLastSortOrder(weeklyBossData, 3.000);
      const startOrder = floatAdd(baseOrder, queueLength * 0.001);
      return [
        {
          id: toPascalCase(typedData.mat1 || ''),
          name: sanitizeText(typedData.mat1) as string,
          type: 'weekly_boss',
          boss_name: sanitizeText(typedData.bossName || '') as string,
          region: typedData.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.001)
        },
        {
          id: toPascalCase(typedData.mat2 || ''),
          name: sanitizeText(typedData.mat2) as string,
          type: 'weekly_boss',
          boss_name: sanitizeText(typedData.bossName || '') as string,
          region: typedData.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.002)
        },
        {
          id: toPascalCase(typedData.mat3 || ''),
          name: sanitizeText(typedData.mat3) as string,
          type: 'weekly_boss',
          boss_name: sanitizeText(typedData.bossName || '') as string,
          region: typedData.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.003)
        }
      ]
    }
    case 'talent': {
      const typedData = data as TalentBuilderInput;
      const baseOrder = getLastSortOrder(talentData, 4.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);

      const createSeries = (s: string, days: number[], offset: number) => ({
        id: toPascalCase(s),
        name: sanitizeText(s) as string,
        region: typedData.region || 'Unknown',
        tiers: {
          "4_star": {
            id: toPascalCase("Philosophies of " + s),
            name: sanitizeText("Philosophies of " + s) as string,
            sortOrder: floatAdd(startOrder, offset + 0.001)
          },
          "3_star": {
            id: toPascalCase("Guide to " + s),
            name: sanitizeText("Guide to " + s) as string,
            sortOrder: floatAdd(startOrder, offset + 0.002)
          },
          "2_star": {
            id: toPascalCase("Teachings of " + s),
            name: sanitizeText("Teachings of " + s) as string,
            sortOrder: floatAdd(startOrder, offset + 0.003)
          }
        },
        domain: typedData.domain || '',
        days
      });

      return [
        createSeries(typedData.series1 || '', [1, 4], 0.000),
        createSeries(typedData.series2 || '', [2, 5], 0.003),
        createSeries(typedData.series3 || '', [3, 6], 0.006)
      ];
    }
    case 'weapon_asc': {
      const typedData = data as WeaponAscBuilderInput;
      const baseOrder = getLastSortOrder(weaponAscensionData, 7.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.004);

      const createSeries = (name: string, d5: string, d4: string, d3: string, d2: string, days: number[], offset: number) => ({
        id: toPascalCase(name || ''),
        name: sanitizeText(name) as string,
        region: typedData.region || 'Unknown',
        tiers: {
          "5_star": {
            id: toPascalCase(d5 || ''),
            name: sanitizeText(d5) as string,
            sortOrder: floatAdd(startOrder, offset + 0.001)
          },
          "4_star": {
            id: toPascalCase(d4 || ''),
            name: sanitizeText(d4) as string,
            sortOrder: floatAdd(startOrder, offset + 0.002)
          },
          "3_star": {
            id: toPascalCase(d3 || ''),
            name: sanitizeText(d3) as string,
            sortOrder: floatAdd(startOrder, offset + 0.003)
          },
          "2_star": {
            id: toPascalCase(d2 || ''),
            name: sanitizeText(d2) as string,
            sortOrder: floatAdd(startOrder, offset + 0.004)
          }
        },
        domain: typedData.domain || '',
        days
      });

      return [
        createSeries(typedData.series1Name || '', typedData.s1_5 || '', typedData.s1_4 || '', typedData.s1_3 || '', typedData.s1_2 || '', [1, 4], 0.000),
        createSeries(typedData.series2Name || '', typedData.s2_5 || '', typedData.s2_4 || '', typedData.s2_3 || '', typedData.s2_2 || '', [2, 5], 0.004),
        createSeries(typedData.series3Name || '', typedData.s3_5 || '', typedData.s3_4 || '', typedData.s3_3 || '', typedData.s3_2 || '', [3, 6], 0.008)
      ];
    }
    case 'common_drop': {
      const typedData = data as CommonDropBuilderInput;
      const baseOrder = getLastSortOrder(commonEnemyData, 5.000, '1_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return {
        id: toPascalCase(typedData.groupName || ''),
        name: sanitizeText(typedData.groupName) as string,
        type: 'common_enemy',
        tiers: {
          "3_star": {
            id: toPascalCase(typedData.star3 || ''),
            name: sanitizeText(typedData.star3) as string,
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "2_star": {
            id: toPascalCase(typedData.star2 || ''),
            name: sanitizeText(typedData.star2) as string,
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "1_star": {
            id: toPascalCase(typedData.star1 || ''),
            name: sanitizeText(typedData.star1) as string,
            sortOrder: floatAdd(startOrder, 0.003)
          }
        }
      }
    }
    case 'elite_drop': {
      const typedData = data as EliteDropBuilderInput;
      const baseOrder = getLastSortOrder(eliteEnemyData, 6.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return {
        id: toPascalCase(typedData.groupName || ''),
        name: sanitizeText(typedData.groupName) as string,
        type: 'elite_enemy',
        tiers: {
          "4_star": {
            id: toPascalCase(typedData.star4 || ''),
            name: sanitizeText(typedData.star4) as string,
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "3_star": {
            id: toPascalCase(typedData.star3 || ''),
            name: sanitizeText(typedData.star3) as string,
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "2_star": {
            id: toPascalCase(typedData.star2 || ''),
            name: sanitizeText(typedData.star2) as string,
            sortOrder: floatAdd(startOrder, 0.003)
          }
        }
      }
    }
    default:
      return data
  }
}
