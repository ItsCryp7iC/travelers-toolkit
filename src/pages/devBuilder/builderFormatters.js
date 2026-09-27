import { toPascalCase } from '../../utils/assetHelper';
import { WEAPON_TYPE_MAP } from './constants';

export const sanitizeText = (str) => typeof str === 'string' ? str.replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '') : str;

export function formatCharData(d, releaseOrderNum, lookupMap) {
  return {
    id: toPascalCase(d.name || ''),
    name: sanitizeText(d.name),
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

export function formatWeaponData(d, allWeapons, lookupMap) {
  const typeBlock = WEAPON_TYPE_MAP[d.type] || 1;
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
    name: sanitizeText(d.name),
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
