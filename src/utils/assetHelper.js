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

  str = str.replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '');

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

/**
 * Icon for a forgeable weapon billet item (Northlander/Midlander/Borderland Sword Billet, etc.)
 * Uses the new `billet_items/` CDN folder — distinct from `billets/` which holds weapon-type icons.
 * e.g. "Northlander Sword Billet" → billet_items/NorthladerSwordBillet.png
 */
export function getBilletIcon(billetName) {
  return `${BASE_URL}/billet_items/${toPascalCase(billetName)}.png`
}

/**
 * Icon for a forging ore material (Crystal Chunk, Amethyst Lump, Condessence Crystal, etc.)
 * Uses the new `forging_ores/` CDN folder.
 * e.g. "Crystal Chunk" → forging_ores/CrystalChunk.png
 */
export function getForgingOreIcon(oreName) {
  return `${BASE_URL}/forging_ores/${toPascalCase(oreName)}.png`
}

import normalBoss from '../data/normal_boss.json';
import weeklyBoss from '../data/weekly_boss.json';
import commonEnemy from '../data/common_enemy.json';
import eliteEnemy from '../data/elite_enemy.json';
import localSpecialty from '../data/local_specialty.json';
import talentMaterials from '../data/talent_materials.json';
import weaponAscension from '../data/weapon_ascension.json';
import characterGems from '../data/character_gems.json';
import forgingMaterials from '../data/forging_materials.json';

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
    mapTiers(forgingMaterials, 'Forging Material');
  }
  return categoryMapCache[fileName];
}

export function getMaterialIcon(materialName, category) {
  if (!materialName) return '';

  let fileName = toPascalCase(materialName);
  // Explicit filename mappings for CDN assets that differ from in-game label
  if (fileName.toLowerCase() === 'crownofinsight') {
    fileName = 'CrownOfInsight';
  }

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
  } else if (resolvedCategory === 'Forging Material' || resolvedCategory === 'billet' || resolvedCategory === 'forgingOre') {
    folder = 'forging_materials';
  }

  return `${BASE_URL}/${folder}/${fileName}.png`;
}

// ── CB4D: Artifact & Attribute Static Image Manifests & Resolution ──

export const ARTIFACT_SET_FILENAMES = [
  'ADayCarvedFromRisingWinds.png',
  'Adventurer.png',
  'ArchaicPetra.png',
  'AubadeofMorningstarandMoon.png',
  'Berserker.png',
  'BlizzardStrayer.png',
  'BloodstainedChivalry.png',
  'BraveHeart.png',
  'CelestialGift.png',
  'CrimsonWitchofFlames.png',
  'CrystalTearoftheWanderer.png',
  'DeepwoodMemories.png',
  'DefendersWill.png',
  'DesertPavilionChronicle.png',
  'DisenchantmentinDeepShadow.png',
  'EchoesofanOffering.png',
  'EmblemofSeveredFate.png',
  'FinaleoftheDeepGalleries.png',
  'FlowerofParadiseLost.png',
  'FragmentofHarmonicWhimsy.png',
  'Gambler.png',
  'GildedDreams.png',
  'GladiatorsFinale.png',
  'GoldenTroupe.png',
  'HeartofDepth.png',
  'HeartoftheFurnace.png',
  'HuskofOpulentDreams.png',
  'Initiate.png',
  'Instructor.png',
  'Lavawalker.png',
  'LongNightsOath.png',
  'LuckyDog.png',
  'MaidenBeloved.png',
  'MarechausseeHunter.png',
  'MartialArtist.png',
  'NightoftheSkysUnveiling.png',
  'NighttimeWhispersintheEchoingWoods.png',
  'NoblesseOblige.png',
  'NymphsDream.png',
  'ObsidianCodex.png',
  'OceanHuedClam.png',
  'PaleFlame.png',
  'PrayersforDestiny.png',
  'PrayersforIllumination.png',
  'PrayersforWisdom.png',
  'PrayerstoSpringtime.png',
  'ResolutionofSojourner.png',
  'RetracingBolide.png',
  'ScarletProof.png',
  'Scholar.png',
  'ScrolloftheHeroofCinderCity.png',
  'ShimenawasReminiscence.png',
  'SilkenMoonsSerenade.png',
  'SongofDaysPast.png',
  'TenacityoftheMillelith.png',
  'TheExile.png',
  'ThunderingFury.png',
  'Thundersoother.png',
  'TinyMiracle.png',
  'TravelingDoctor.png',
  'UnfinishedReverie.png',
  'VermillionHereafter.png',
  'ViridescentVenerer.png',
  'VourukashasGlow.png',
  'WanderersTroupe.png',
];

export const ATTRIBUTE_FILENAMES = [
  'ATK.png',
  'ATKPercentage.png',
  'AnemoDMGBonus.png',
  'AnemoRES.png',
  'BurstDMGBonus.png',
  'CRITDMG.png',
  'CRITRate.png',
  'Circlet.png',
  'CryoDMGBonus.png',
  'CryoRES.png',
  'DEF.png',
  'DEFPercentage.png',
  'DendroDMGBonus.png',
  'DendroRES.png',
  'ElectroDMGBonus.png',
  'ElectroRES.png',
  'ElementalMastery.png',
  'EnergyRecharge.png',
  'Flower.png',
  'GeoDMGBonus.png',
  'GeoRES.png',
  'Goblet.png',
  'HP.png',
  'HPPercentage.png',
  'HealingBonus.png',
  'HydroDMGBonus.png',
  'HydroRES.png',
  'NormalandChargedAttackDMGBonus.png',
  'PhysicalDMGBonus.png',
  'PhysicalRES.png',
  'Plume.png',
  'PyroDMGBonus.png',
  'PyroRES.png',
  'Sands.png',
  'ShieldStrength.png',
  'SkillDMGBonus.png',
];

export const PSEUDO_SET_ATTRIBUTE_MAP = {
  'atk-set': 'ATKPercentage.png',
  'em-set': 'ElementalMastery.png',
  'er-set': 'EnergyRecharge.png',
  'hp-set': 'HPPercentage.png',
  'healing-set': 'HealingBonus.png',
  'hydro-set': 'HydroDMGBonus.png',
  'cryo-set': 'CryoDMGBonus.png',
  'anemo-set': 'AnemoDMGBonus.png',
  'physical-set': 'PhysicalDMGBonus.png',
  'def-set': 'DEFPercentage.png',
};

export const ARTIFACT_SLOT_MAP = {
  sands: 'Sands.png',
  goblet: 'Goblet.png',
  circlet: 'Circlet.png',
  flower: 'Flower.png',
  plume: 'Plume.png',
};

function normalizeStatKey(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/%/g, 'percentage')
    .replace(/[^a-z0-9]/g, '');
}

// Normalized index for all 64 real artifact sets in CDN
const ARTIFACT_SET_MAP = {};
for (const file of ARTIFACT_SET_FILENAMES) {
  const base = file.replace(/\.png$/, '');
  ARTIFACT_SET_MAP[normalizeStatKey(base)] = file;
}

// Explicit aliases matching sourceSetIds and common short forms
const ARTIFACT_SET_ALIASES = {
  noblesse: 'NoblesseOblige.png',
  scroll: 'ScrolloftheHeroofCinderCity.png',
  millelith: 'TenacityoftheMillelith.png',
  mh: 'MarechausseeHunter.png',
  emblem: 'EmblemofSeveredFate.png',
  hotf: 'HeartoftheFurnace.png',
  exile: 'TheExile.png',
  shimenawa: 'ShimenawasReminiscence.png',
  crimsonwitch: 'CrimsonWitchofFlames.png',
  desertpavilion: 'DesertPavilionChronicle.png',
  bolide: 'RetracingBolide.png',
  gladiator: 'GladiatorsFinale.png',
  gladiators: 'GladiatorsFinale.png',
  echoes: 'EchoesofanOffering.png',
  clam: 'OceanHuedClam.png',
  fopl: 'FlowerofParadiseLost.png',
  tf: 'ThunderingFury.png',
  risingwinds: 'ADayCarvedFromRisingWinds.png',
  maiden: 'MaidenBeloved.png',
  codex: 'ObsidianCodex.png',
  vv: 'ViridescentVenerer.png',
  notsu: 'NightoftheSkysUnveiling.png',
  ts: 'Thundersoother.png',
  vourukasha: 'VourukashasGlow.png',
  bloodstained: 'BloodstainedChivalry.png',
  hod: 'HeartofDepth.png',
  nymph: 'NymphsDream.png',
  vermillion: 'VermillionHereafter.png',
  nighttimewhispers: 'NighttimeWhispersintheEchoingWoods.png',
  sms: 'SilkenMoonsSerenade.png',
};
for (const [k, v] of Object.entries(ARTIFACT_SET_ALIASES)) {
  ARTIFACT_SET_MAP[normalizeStatKey(k)] = v;
}

// Normalized index for all 36 attribute icons in CDN
const ATTRIBUTE_MAP = {};
for (const file of ATTRIBUTE_FILENAMES) {
  const base = file.replace(/\.png$/, '');
  ATTRIBUTE_MAP[normalizeStatKey(base)] = file;
}

const ATTRIBUTE_ALIASES = {
  // Stat keys & aliases
  atkpercentage: 'ATKPercentage.png',
  atk: 'ATK.png',
  flatatk: 'ATK.png',

  hppercentage: 'HPPercentage.png',
  hp: 'HP.png',
  flathp: 'HP.png',

  defpercentage: 'DEFPercentage.png',
  def: 'DEF.png',
  flatdef: 'DEF.png',

  er: 'EnergyRecharge.png',
  energyrecharge: 'EnergyRecharge.png',

  em: 'ElementalMastery.png',
  elementalmastery: 'ElementalMastery.png',

  cr: 'CRITRate.png',
  critrate: 'CRITRate.png',

  cd: 'CRITDMG.png',
  critdmg: 'CRITDMG.png',
  critdamage: 'CRITDMG.png',

  healingbonus: 'HealingBonus.png',
  healingbonuspercentage: 'HealingBonus.png',

  pyrodmg: 'PyroDMGBonus.png',
  pyrodmgbonus: 'PyroDMGBonus.png',
  pyrodmgbonuspercentage: 'PyroDMGBonus.png',

  hydrodmg: 'HydroDMGBonus.png',
  hydrodmgbonus: 'HydroDMGBonus.png',
  hydrodmgbonuspercentage: 'HydroDMGBonus.png',

  cryodmg: 'CryoDMGBonus.png',
  cryodmgbonus: 'CryoDMGBonus.png',
  cryodmgbonuspercentage: 'CryoDMGBonus.png',

  electrodmg: 'ElectroDMGBonus.png',
  electrodmgbonus: 'ElectroDMGBonus.png',
  electrodmgbonuspercentage: 'ElectroDMGBonus.png',

  anemodmg: 'AnemoDMGBonus.png',
  anemodmgbonus: 'AnemoDMGBonus.png',
  anemodmgbonuspercentage: 'AnemoDMGBonus.png',

  geodmg: 'GeoDMGBonus.png',
  geodmgbonus: 'GeoDMGBonus.png',
  geodmgbonuspercentage: 'GeoDMGBonus.png',

  dendrodmg: 'DendroDMGBonus.png',
  dendrodmgbonus: 'DendroDMGBonus.png',
  dendrodmgbonuspercentage: 'DendroDMGBonus.png',

  physicaldmg: 'PhysicalDMGBonus.png',
  physicaldmgbonus: 'PhysicalDMGBonus.png',
  physicaldmgbonuspercentage: 'PhysicalDMGBonus.png',

  // Slots
  sands: 'Sands.png',
  goblet: 'Goblet.png',
  circlet: 'Circlet.png',
  flower: 'Flower.png',
  plume: 'Plume.png',
};
for (const [k, v] of Object.entries(ATTRIBUTE_ALIASES)) {
  ATTRIBUTE_MAP[normalizeStatKey(k)] = v;
}
for (const [k, v] of Object.entries(PSEUDO_SET_ATTRIBUTE_MAP)) {
  ATTRIBUTE_MAP[normalizeStatKey(k)] = v;
}

/**
 * Resolves artifact set icon URL using verified static manifest filenames.
 * Supports exact name, normalized name, or sourceSetId alias.
 * Also supports pseudo-set category tags by resolving to their semantic attribute icon.
 * Returns null if no asset is available (e.g. unreleased set), allowing graceful UI fallback.
 */
export function getArtifactSetIcon(name, optionalSourceId) {
  if (optionalSourceId) {
    const normId = normalizeStatKey(optionalSourceId);
    if (ARTIFACT_SET_MAP[normId]) {
      return `${BASE_URL}/artifact_sets/${ARTIFACT_SET_MAP[normId]}`;
    }
    const pseudoId = PSEUDO_SET_ATTRIBUTE_MAP[optionalSourceId.toLowerCase().trim()];
    if (pseudoId) {
      return `${BASE_URL}/attributes/${pseudoId}`;
    }
  }

  if (name) {
    const normName = normalizeStatKey(name);
    if (ARTIFACT_SET_MAP[normName]) {
      return `${BASE_URL}/artifact_sets/${ARTIFACT_SET_MAP[normName]}`;
    }
    const pseudoName = PSEUDO_SET_ATTRIBUTE_MAP[name.toLowerCase().trim()];
    if (pseudoName) {
      return `${BASE_URL}/attributes/${pseudoName}`;
    }
  }

  return null;
}

/**
 * Resolves authentic artifact slot icon URL (Sands, Goblet, Circlet, Flower, Plume).
 */
export function getArtifactSlotIcon(slotKey) {
  if (!slotKey) return null;
  const file = ARTIFACT_SLOT_MAP[slotKey.toLowerCase().trim()];
  return file ? `${BASE_URL}/attributes/${file}` : null;
}

/**
 * Resolves attribute icon URL for main stats, substats, or elemental bonuses.
 * Composite labels (e.g. "CRIT Rate / CRIT DMG") return null to avoid mis-mapping
 * to a single arbitrary stat. Use getAttributeIcons for composite stats.
 */
export function getAttributeIcon(statName, optionalStatKey) {
  if (optionalStatKey) {
    if (optionalStatKey.includes('/')) return null;
    const file = ATTRIBUTE_MAP[normalizeStatKey(optionalStatKey)];
    if (file) return `${BASE_URL}/attributes/${file}`;
  }
  if (statName) {
    if (statName.includes('/')) return null;
    const file = ATTRIBUTE_MAP[normalizeStatKey(statName)];
    if (file) return `${BASE_URL}/attributes/${file}`;
  }
  return null;
}

/**
 * Resolves an array of attribute icon URLs. For composite stat labels
 * (e.g. "CRIT Rate / CRIT DMG", "CRIT Rate / CRIT DMG / HP%"),
 * resolves each individual stat component into its respective icon URL.
 * Returns an empty array if no component matches or if input is empty.
 */
export function getAttributeIcons(statName, optionalStatKey) {
  const target = statName || optionalStatKey;
  if (!target) return [];
  if (target.includes('/')) {
    const parts = target.split(/\s*\/\s*/);
    const urls = [];
    for (const part of parts) {
      const cleanPart = part.replace(/^\[\[stat:/, '').replace(/\]\]$/, '').trim();
      const icon = getAttributeIcon(cleanPart);
      if (icon) urls.push(icon);
    }
    return urls;
  }
  const single = getAttributeIcon(statName, optionalStatKey);
  return single ? [single] : [];
}
