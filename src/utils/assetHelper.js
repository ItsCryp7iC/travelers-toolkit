const BASE_URL = 'https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main'

/**
 * Convert string to snake_case equivalent used in the CDN
 * e.g. "Normal Boss Material" -> "normal_boss_materials"
 */
export function formatAssetString(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

/**
 * Convert string to PascalCase used in the CDN filenames
 * e.g. "Arataki Itto" -> "AratakiItto"
 * e.g. "Hero's Wit" -> "HerosWit"
 */
export const toPascalCase = (str) => {
  if (!str) return '';

  // 1. Insert a space between lowercase and uppercase letters (kamisatoAyato -> kamisato Ayato)
  const spacedStr = str.replace(/([a-z])([A-Z])/g, '$1 $2');

  // 2. Replace special characters (like underscores, hyphens, parentheses, apostrophes) with spaces
  return spacedStr
    .replace(/['’]/g, '') // CRITICAL: Strip apostrophes entirely (e.g., Hero's -> Heros)
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/) // Split by any whitespace
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export function getCharacterAvatar(name) {
  return `${BASE_URL}/characters/${toPascalCase(name)}.png`
}

export function getWeaponIcon(name) {
  return `${BASE_URL}/weapons/${toPascalCase(name)}.png`
}

export function getElementIcon(element) {
  return `${BASE_URL}/elements/${toPascalCase(element)}.png`
}

export function getWeaponTypeIcon(type) {
  return `${BASE_URL}/billets/${toPascalCase(type)}.png`
}

import normalBoss from '../data/normal_boss.json';
import weeklyBoss from '../data/weekly_boss.json';
import commonEnemy from '../data/common_enemy.json';
import eliteEnemy from '../data/elite_enemy.json';
import localSpecialty from '../data/local_specialty.json';
import talentMaterials from '../data/talent_materials.json';
import weaponAscension from '../data/weapon_ascension.json';
import characterGems from '../data/character_gems.json';

let categoryMapCache = null;
function getResolvedCategory(fileName) {
  if (!categoryMapCache) {
    categoryMapCache = {};
    const mapTiers = (data, catName) => {
      data.forEach(item => {
        if (item.tiers) {
          Object.values(item.tiers).forEach(t => categoryMapCache[toPascalCase(t.name)] = catName);
        } else {
          categoryMapCache[toPascalCase(item.name)] = catName;
        }
      });
    };
    mapTiers(normalBoss, 'Normal Boss Drops');
    mapTiers(weeklyBoss, 'Weekly Boss Drops');
    mapTiers(commonEnemy, 'Common Enemy Drops');
    mapTiers(eliteEnemy, 'Elite Enemy Drops');
    mapTiers(talentMaterials, 'Talent Materials');
    mapTiers(weaponAscension, 'Weapon Ascension Mats');
    mapTiers(localSpecialty, 'Local Specialties');
    mapTiers(characterGems, 'Character Ascension Gems');
  }
  return categoryMapCache[fileName];
}

export function getMaterialIcon(materialName, category) {
  if (!materialName) return '';

  let fileName = toPascalCase(materialName);

  const experienceItems = ['HerosWit', 'AdventurersExperience', 'WanderersAdvice', 'MysticEnhancementOre', 'FineEnhancementOre', 'EnhancementOre'];
  const othersItems = ['Mora', 'CrownOfInsight', 'MasterlessStellaFortuna', 'DreamSolvent', 'FragileResin', 'TheCornerstoneOfStarsAndFlames'];

  let folder = 'others';
  const resolvedCategory = getResolvedCategory(fileName) || category;

  if (experienceItems.includes(fileName) || experienceItems.includes(toPascalCase(materialName))) {
    folder = 'experience';
  } else if (othersItems.includes(fileName) || othersItems.includes(toPascalCase(materialName))) {
    folder = 'others';
  } else if (resolvedCategory === 'Normal Boss Drops' || resolvedCategory === 'Normal Boss Material') {
    folder = 'normal_boss_materials';
  } else if (resolvedCategory === 'Weekly Boss Drops' || resolvedCategory === 'Weekly Boss Material') {
    folder = 'weekly_boss_materials';
  } else if (resolvedCategory === 'Common Enemy Drops' || resolvedCategory === 'Common Enhancement Material') {
    folder = 'common_enhancement_materials';
  } else if (resolvedCategory === 'Elite Enemy Drops' || resolvedCategory === 'Elite Enhancement Material') {
    folder = 'elite_enhancement_materials';
  } else if (resolvedCategory === 'Talent Materials' || resolvedCategory === 'Talent Material') {
    folder = 'talent_materials';
  } else if (resolvedCategory === 'Weapon Ascension Mats' || resolvedCategory === 'Weapon Ascension Material') {
    folder = 'weapon_ascension_materials';
  } else if (resolvedCategory === 'Local Specialties' || resolvedCategory === 'Local Specialty') {
    folder = 'local_specialties';
  } else if (resolvedCategory === 'Character Ascension Gems' || resolvedCategory === 'Character Ascension Gem') {
    folder = 'character_ascension_gems';
  }

  return `${BASE_URL}/${folder}/${fileName}.png`;
}
