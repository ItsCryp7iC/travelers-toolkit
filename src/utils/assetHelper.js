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

const CATEGORY_MAP = {
  'Normal Boss Material': 'normal_boss_materials',
  'Weekly Boss Material': 'weekly_boss_materials',
  'Common Enhancement Material': 'common_enhancement_materials',
  'Talent Material': 'talent_materials',
  'Local Specialty': 'local_specialties',
  'Character Ascension Gem': 'character_ascension_gems',
  'Weapon Ascension Material': 'weapon_ascension_materials',
  'Elite Enhancement Material': 'elite_enhancement_materials',
  'Experience': 'experience',
  'Currency': 'others',
  'Ores': 'experience',
}

export function getMaterialIcon(materialName, category) {
  if (!materialName) return ''
  let fileName = materialName.replace(/[^a-zA-Z0-9]/g, '');
  
  // Explicit filename mappings for CDN assets that differ from in-game label
  if (materialName === 'Adventurer Exp') {
    fileName = 'AdventurersExperience';
  }

  let folder = CATEGORY_MAP[category] || 'misc'
  if (materialName === 'Crown of Insight' || fileName === 'CrownofInsight') {
    folder = 'others'
  }
  if (materialName === 'Masterless Stella Fortuna' || fileName === 'MasterlessStellaFortuna' || materialName === 'masterless_stella_fortuna') {
    folder = 'others'
  }
  if (materialName === 'Dream Solvent' || fileName === 'DreamSolvent') {
    folder = 'others' // CDN puts Dream Solvent in 'others'
  }
  if (materialName === 'Fragile Resin' || fileName === 'FragileResin') {
    folder = 'others'
  }

  const experienceItems = [
    "Hero's Wit", "Adventurer's Experience", "Adventurer Exp", "Wanderer's Advice",
    "Mystic Enhancement Ore", "Fine Enhancement Ore", "Enhancement Ore"
  ];
  if (experienceItems.includes(materialName)) {
    folder = 'experience';
  }

  return `${BASE_URL}/${folder}/${fileName}.png`
}
