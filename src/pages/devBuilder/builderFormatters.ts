import { toPascalCase } from '../../utils/assetHelper';
import { WEAPON_TYPE_MAP } from './constants';
import type { CharacterBuilderInput, WeaponBuilderInput } from '../../types/devBuilder';

export type MaterialLookupMap = Record<string, string>;

export interface GeneratedCharacterEntry {
  id: string;
  name: string;
  rarity: string;
  weapon_type: string;
  element: string;
  materials: {
    world_boss_material_id: string;
    weekly_boss_material_id: string;
    talent_material_family_id: string;
    enemy_material_family_id: string;
    local_specialty_id: string;
    gem_family_id: string;
  };
  release_order: number;
}

export interface GeneratedWeaponEntry {
  id: string;
  name: string;
  rarity: string;
  type: string;
  materials: {
    ascension_material_family_id: string;
    enhancement_material_family_id: string;
    enemy_material_family_id: string;
  };
  release_order: number;
}

export interface WeaponReleaseOrderEntry {
  rarity: string | number;
  type: string;
  release_order?: number;
}

export const sanitizeText = <T>(str: T): T | string => typeof str === 'string' ? str.replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '') : str;

export function formatCharData(d: CharacterBuilderInput, releaseOrderNum: number, lookupMap: MaterialLookupMap): GeneratedCharacterEntry {
  return {
    id: toPascalCase(d.name || ''),
    name: sanitizeText(d.name) as string,
    rarity: "★".repeat(d.rarity),
    weapon_type: d.weapon_type,
    element: d.element,
    materials: {
      world_boss_material_id: lookupMap[d.materials.world_boss_material_id] || '',
      weekly_boss_material_id: lookupMap[d.materials.weekly_boss_material_id] || '',
      talent_material_family_id: lookupMap[d.materials.talent_material_family_id] || '',
      enemy_material_family_id: lookupMap[d.materials.enemy_material_family_id] || '',
      local_specialty_id: lookupMap[d.materials.local_specialty_id] || '',
      gem_family_id: lookupMap[d.materials.gem_family_id] || '',
    },
    release_order: releaseOrderNum
  }
}

export function formatWeaponData(d: WeaponBuilderInput, allWeapons: WeaponReleaseOrderEntry[], lookupMap: MaterialLookupMap): GeneratedWeaponEntry {
  const typeBlock = (WEAPON_TYPE_MAP as Record<string, number>)[d.type] || 1;
  const rarity = d.rarity || 5;

  let maxSequence = 0;
  for (const w of allWeapons) {
    const wRarity = typeof w.rarity === 'string' ? w.rarity.length : w.rarity;
    if (wRarity === rarity && w.type === d.type && w.release_order) {
      const roStr = Number(w.release_order).toFixed(3);
      const seqStr = roStr.slice(3);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSequence) {
        maxSequence = seqNum;
      }
    }
  }

  const nextSequence = maxSequence + 1;
  const sequenceStr = String(nextSequence).padStart(2, '0');
  const releaseOrderNum = parseFloat(`${rarity}.${typeBlock}${sequenceStr}`);

  return {
    id: toPascalCase(d.name || ''),
    name: sanitizeText(d.name) as string,
    rarity: "★".repeat(d.rarity),
    type: d.type,
    materials: {
      ascension_material_family_id: lookupMap[d.materials.ascension_material_family_id] || '',
      enhancement_material_family_id: lookupMap[d.materials.enhancement_material_family_id] || '',
      enemy_material_family_id: lookupMap[d.materials.enemy_material_family_id] || '',
    },
    release_order: releaseOrderNum
  }
}
