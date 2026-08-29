import talentMatsData from '../data/talent_materials.json'
import commonEnemyData from '../data/common_enemy.json'
import eliteEnemyData from '../data/elite_enemy.json'
import weaponAscData from '../data/weapon_ascension.json'
import characterGemsData from '../data/character_gems.json'
import weeklyBossData from '../data/weekly_boss.json'
import normalBossData from '../data/normal_boss.json'
import localSpecialtyData from '../data/local_specialty.json'
import craftingMatsData from '../data/crafting_materials.json'
import miscMaterialsData from '../data/misc_materials.json'
import weaponsData from '../data/weapons.json'

const DB = {
  talent: Object.fromEntries(talentMatsData.map(i => [i.id, i])),
  common: Object.fromEntries(commonEnemyData.map(i => [i.id, i])),
  elite: Object.fromEntries(eliteEnemyData.map(i => [i.id, i])),
  weapon: Object.fromEntries(weaponAscData.map(i => [i.id, i])),
  gems: Object.fromEntries(characterGemsData.map(i => [i.id, i])),
  weekly: Object.fromEntries(weeklyBossData.map(i => [i.id, i])),
  normal: Object.fromEntries(normalBossData.map(i => [i.id, i])),
  local: Object.fromEntries(localSpecialtyData.map(i => [i.id, i])),
  crafting: Object.fromEntries(craftingMatsData.map(i => [i.id, i])),
  misc: Object.fromEntries(miscMaterialsData.map(i => [i.id, i])),
}

function toSnakeCase(str) {
  if (!str) return '';
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '').replace(/ /g, '_').replace(/'/g, '').toLowerCase();
}


const getRarity = (key) => {
  if (key.includes('5_star')) return 5;
  if (key.includes('4_star') || key === 'gem_gemstone' || key === 'crown' || key === 'boss_material' || key === 'weekly_boss_material') return 4;
  if (key.includes('3_star') || key === 'gem_chunk') return 3;
  if (key.includes('2_star') || key === 'gem_fragment') return 2;
  if (key.includes('1_star') || key === 'gem_sliver' || key === 'local_specialty') return 1;
  return 3; // fallback
}

/**
 * Returns { id: string, category: string, name: string, rarity: number }
 */
export function resolveSpecificItem(genericKey, character = null, weapon = null) {
  const rarity = getRarity(genericKey);
  
  if (genericKey === 'mora') return { id: 'mora', category: 'mora', name: 'Mora', rarity: 3 }
  if (genericKey === 'heros_wit') return { id: 'heros_wit', category: 'heroWits', name: "Hero's Wit", rarity: 4 }
  if (genericKey === 'crown') return { id: 'crown_of_insight', category: 'crown', name: 'Crown of Insight', rarity: 5 }
  if (genericKey === 'mystic_ore') return { id: 'mystic_enhancement_ore', category: 'mysticOre', name: 'Mystic Enhancement Ore', rarity: 3 }
  if (genericKey === 'masterless_stella_fortuna') return { id: 'masterless_stella_fortuna', category: 'stellaFortuna', name: 'Masterless Stella Fortuna', rarity: 5 }

  // Character specific
  if (character && character.materials) {
    const mats = character.materials;
    
    // Gems
    if (genericKey.startsWith('gem_')) {
      const tierMap = {
        'gem_sliver': '1_star',
        'gem_fragment': '2_star',
        'gem_chunk': '3_star',
        'gem_gemstone': '4_star'
      }
      const family = DB.gems[mats.gem_family_id]
      if (family && family.tiers[tierMap[genericKey]]) {
        const item = family.tiers[tierMap[genericKey]]
        return { id: toSnakeCase(item.name), category: 'gemstones', name: item.name, rarity }
      }
    }
    
    // Normal Boss
    if (genericKey === 'boss_material') {
      const boss = DB.normal[mats.world_boss_material_id]
      if (boss) return { id: toSnakeCase(boss.name), category: 'worldBoss', name: boss.name, rarity }
    }
    
    // Local Specialty
    if (genericKey === 'local_specialty') {
      const local = DB.local[mats.local_specialty_id]
      if (local) return { id: toSnakeCase(local.name), category: 'localSpecialty', name: local.name, rarity }
    }
    
    // Common Enemy (Character)
    if (genericKey.endsWith('_enemy_material')) {
      const tierMap = {
        '1_star_enemy_material': '1_star',
        '2_star_enemy_material': '2_star',
        '3_star_enemy_material': '3_star'
      }
      const family = DB.common[mats.enemy_material_family_id]
      if (family && family.tiers[tierMap[genericKey]]) {
        const item = family.tiers[tierMap[genericKey]]
        return { id: toSnakeCase(item.name), category: 'mob', name: item.name, rarity }
      }
    }
    
    // Talent Books
    if (genericKey.endsWith('_talent_material')) {
      const tierMap = {
        '2_star_talent_material': '2_star',
        '3_star_talent_material': '3_star',
        '4_star_talent_material': '4_star'
      }
      
      let familyId = mats.talent_material_family_id;
      let tierKey = genericKey;
      
      const parts = genericKey.split('_');
      if (parts.length > 4) { // e.g., ["Freedom", "2", "star", "talent", "material"]
         familyId = parts[0];
         tierKey = parts.slice(1).join('_');
      }
      
      const family = DB.talent[familyId]
      if (family && family.tiers[tierMap[tierKey]]) {
        const item = family.tiers[tierMap[tierKey]]
        return { id: item.id || toSnakeCase(item.name), category: 'talentBooks', name: item.name, rarity: parseInt(tierKey.charAt(0)) || rarity }
      }
    }
    
    // Weekly Boss
    if (genericKey === 'weekly_boss_material') {
      const weekly = DB.weekly[mats.weekly_boss_material_id]
      if (weekly) return { id: toSnakeCase(weekly.name), category: 'weeklyBoss', name: weekly.name, rarity }
    }
  }

  // Weapon specific
  if (weapon && weapon.materials) {
    const mats = weapon.materials;
    
    // Weapon Ascension
    if (genericKey.endsWith('_ascension_material')) {
      const tierMap = {
        '2_star_ascension_material': '2_star',
        '3_star_ascension_material': '3_star',
        '4_star_ascension_material': '4_star',
        '5_star_ascension_material': '5_star'
      }
      let family = DB.weapon[mats.ascension_material_family_id]

      if (family && family.tiers[tierMap[genericKey]]) {
        const item = family.tiers[tierMap[genericKey]]
        return { id: item.id || toSnakeCase(item.name), category: 'weaponAscMats', name: item.name, rarity }
      }
      
      return { id: genericKey, category: 'weaponAscMats', name: genericKey, rarity }
    }
    
    // Elite Enemy
    if (genericKey.endsWith('_enhancement_material')) {
      const tierMap = {
        '2_star_enhancement_material': '2_star',
        '3_star_enhancement_material': '3_star',
        '4_star_enhancement_material': '4_star'
      }
      let family = DB.elite[mats.enhancement_material_family_id]
      if (family && family.tiers[tierMap[genericKey]]) {
        const item = family.tiers[tierMap[genericKey]]
        return { id: toSnakeCase(item.name), category: 'eliteMob', name: item.name, rarity }
      }
      return { id: genericKey, category: 'eliteMob', name: genericKey, rarity }
    }
    
    // Common Enemy (Weapon)
    if (genericKey.endsWith('_enemy_material')) {
      const tierMap = {
        '1_star_enemy_material': '1_star',
        '2_star_enemy_material': '2_star',
        '3_star_enemy_material': '3_star'
      }
      let family = DB.common[mats.enemy_material_family_id] || DB.elite[mats.enemy_material_family_id]
      if (family && family.tiers[tierMap[genericKey]]) {
        const item = family.tiers[tierMap[genericKey]]
        return { id: toSnakeCase(item.name), category: 'mob', name: item.name, rarity }
      }
      return { id: genericKey, category: 'mob', name: genericKey, rarity }
    }
  }

  // Crafting Materials (Billets / Ores)
  if (DB.crafting[genericKey]) {
    const item = DB.crafting[genericKey]
    return { id: item.id, category: 'Crafting Material', name: item.name, rarity: item.kind === 'billet' ? 4 : 1 }
  }

  if (genericKey === 'weekly_boss_material' || genericKey === 'boss_material') return { id: genericKey, category: 'unknown', name: 'Unknown Boss Material', rarity: 4 }
  if (genericKey === 'local_specialty') return { id: genericKey, category: 'localSpecialty', name: 'Unknown Local Specialty', rarity: 1 }

  // Fallback for everything else
  return { id: genericKey, category: 'unknown', name: genericKey, rarity: rarity }
}

/**
 * Returns { familyId, familyName, region, tiers: [{ id, name, rarity }, ...] }
 */
export function getJsonData(id) {
  const searchDatabases = [Object.values(DB.talent), Object.values(DB.weapon), Object.values(DB.gems), Object.values(DB.elite), Object.values(DB.common)];
  for (const db of searchDatabases) {
    const family = db.find(group => 
      group.id === id || 
      (group.tiers && Object.values(group.tiers).some(tier => (tier.id || toSnakeCase(tier.name)) === id))
    );
    if (family) {
      return {
        familyId: family.id,
        familyName: family.name,
        region: family.region || family.element,
        domain: family.domain,
        days: family.days,
        tiers: Object.entries(family.tiers).map(([k, t]) => ({ 
          id: t.id || toSnakeCase(t.name), 
          name: t.name, 
          rarity: parseInt(k) || 3
        })).sort((a, b) => b.rarity - a.rarity)
      };
    }
  }
  return null;
}

// ─── Startup Sanity Check ─────────────────────────────────────────────────
// Assert every weapon's material family IDs resolve to a real entry with a
// DIRECT id match. Throws on first failure so data mismatches surface
// immediately instead of causing silent missing-material bugs.

function validateWeaponMaterialIds() {
  const allEnemy = { ...DB.common, ...DB.elite }

  for (const weapon of weaponsData) {
    if (!weapon.materials) continue

    const ascId = weapon.materials.ascension_material_family_id
    if (ascId && !DB.weapon[ascId]) {
      throw new Error(
        `[Data Integrity] Weapon "${weapon.name}" has ascension_material_family_id "${ascId}" ` +
        `which does not match any id in weapon_ascension.json`
      )
    }

    const enhId = weapon.materials.enhancement_material_family_id
    if (enhId && !DB.elite[enhId]) {
      throw new Error(
        `[Data Integrity] Weapon "${weapon.name}" has enhancement_material_family_id "${enhId}" ` +
        `which does not match any id in elite_enemy.json`
      )
    }

    const enemyId = weapon.materials.enemy_material_family_id
    if (enemyId && !allEnemy[enemyId]) {
      throw new Error(
        `[Data Integrity] Weapon "${weapon.name}" has enemy_material_family_id "${enemyId}" ` +
        `which does not match any id in common_enemy.json or elite_enemy.json`
      )
    }
  }
}

validateWeaponMaterialIds()
