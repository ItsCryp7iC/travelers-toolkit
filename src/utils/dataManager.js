import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import miscMaterials from '../data/misc_materials.json'
import normalBoss from '../data/normal_boss.json'
import weeklyBoss from '../data/weekly_boss.json'
import commonEnemy from '../data/common_enemy.json'
import eliteEnemy from '../data/elite_enemy.json'
import localSpecialty from '../data/local_specialty.json'
import talentMaterials from '../data/talent_materials.json'
import weaponAscension from '../data/weapon_ascension.json'
import characterGems from '../data/character_gems.json'

// ─── Element / Gemstone Info ──────────────────────────────────────────────

const TIER_STARS_GEM = ['Sliver ★', 'Fragment ★★', 'Chunk ★★★', 'Gemstone ★★★★']
const TIER_STARS_WEAPON = ['Debris ★', 'Fragment ★★', 'Chunk ★★★', 'Core ★★★★'] // generic fallback
const TIER_STARS_MOB_COMMON = ['Common', 'Uncommon', 'Rare']
const TIER_STARS_BOOK = ['Teachings', 'Guide', 'Philosophies']

// ─── Lookup Maps ────────────────────────────────────────────────────────
const lookupBoss = new Map([...normalBoss, ...weeklyBoss].map(item => [item.id, item]))
const lookupEnemy = new Map([...commonEnemy, ...eliteEnemy].map(item => [item.id, item]))
const lookupLocal = new Map(localSpecialty.map(item => [item.id, item]))
const lookupTalent = new Map(talentMaterials.map(item => [item.id, item]))
const lookupWeaponAsc = new Map(weaponAscension.map(item => [item.id, item]))
const lookupGems = new Map(characterGems.map(item => [item.id, item]))

const SAFE_FALLBACK = { name: 'Unknown', id: 'unknown', tiers: {} }


// Helper to safely get tiers array sorted by star (from lowest to highest)
const extractTiers = (tiersObj) => {
  if (!tiersObj) return []
  // Standard format in our JSON: "1_star", "2_star", "3_star", "4_star", "5_star"
  const keys = Object.keys(tiersObj).sort() // 1_star, 2_star, etc.
  return keys.map(k => tiersObj[k])
}

// ─── Resolver Functions ──────────────────────────────────────────────────

export const resolveCharacterMaterials = (char) => {
  const m = char?.materials
  if (!m) return null

  const resolved = {
    worldBoss: m.world_boss_material_id ? (lookupBoss.get(m.world_boss_material_id) || SAFE_FALLBACK) : SAFE_FALLBACK,
    weeklyBoss: m.weekly_boss_material_id ? (lookupBoss.get(m.weekly_boss_material_id) || SAFE_FALLBACK) : SAFE_FALLBACK,
    talent: SAFE_FALLBACK,
    enemy: SAFE_FALLBACK,
    localSpecialty: m.local_specialty_id ? (lookupLocal.get(m.local_specialty_id) || SAFE_FALLBACK) : SAFE_FALLBACK,
    gem: m.gem_family_id ? (lookupGems.get(m.gem_family_id) || SAFE_FALLBACK) : SAFE_FALLBACK
  }

  const talentData = m.talent_material_family_id ? lookupTalent.get(m.talent_material_family_id) : null
  if (talentData) {
    resolved.talent = { ...talentData }
  }

  const enemyData = m.enemy_material_family_id ? lookupEnemy.get(m.enemy_material_family_id) : null
  if (enemyData) {
    resolved.enemy = { ...enemyData }
  }

  return resolved
}

export function resolveWeaponMaterials(weaponState) {
  const SAFE_FALLBACK = { name: 'Unknown', id: 'unknown', tiers: {} };

  // Extract identifier
  const identifier = typeof weaponState === 'string'
    ? weaponState
    : (weaponState.weapon_id || weaponState.weaponId || weaponState.weaponKey || weaponState.weapon || weaponState.name || weaponState.id);

  if (!identifier) return { ascensionFamily: SAFE_FALLBACK, eliteFamily: SAFE_FALLBACK, commonFamily: SAFE_FALLBACK };

  // Sanitize identifier to match database schema (e.g., "WolfsGravestone" -> "wolfsgravestone")
  const safeId = identifier.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Match against the database strictly using the sanitized ID
  const dbWeapon = weaponsData.find(w => w.id.toLowerCase() === safeId);

  if (!dbWeapon || !dbWeapon.materials) {
    return { ascensionFamily: SAFE_FALLBACK, eliteFamily: SAFE_FALLBACK, commonFamily: SAFE_FALLBACK };
  }

  // IDs in weapons.json now match reference files directly — no alias resolution needed
  const ascId = dbWeapon.materials.ascension_material_family_id;
  const eliteId = dbWeapon.materials.enhancement_material_family_id;
  const commonId = dbWeapon.materials.enemy_material_family_id;

  const ascensionFamily = lookupWeaponAsc.get(ascId) || SAFE_FALLBACK;
  const eliteFamily = lookupEnemy.get(eliteId) || SAFE_FALLBACK;
  const commonFamily = lookupEnemy.get(commonId) || SAFE_FALLBACK;

  return { ascensionFamily, eliteFamily, commonFamily };
}

// ─── Master Inventory List Generator ─────────────────────────────────────

const flattenAndFormatMaterials = (dataArray, category, subCategory, getSublabel, getIconCategory, getRarity) => {
  const getUniversalAccent = (rarity) => {
    if (rarity === 5) return '#FBBF24';
    if (rarity === 4) return '#A855F7';
    if (rarity === 3) return '#60A5FA';
    if (rarity === 2) return '#4ADE80';
    return '#9CA3AF';
  };

  return dataArray.flatMap(item => {
    if (item.tiers) {
      const keys = Object.keys(item.tiers).sort();
      return keys.map((k, index) => {
        const tierItem = item.tiers[k];
        const computedRarity = getRarity ? getRarity(item, tierItem, k, index) : (parseInt(k) || 0);
        return {
          matKey: tierItem.id,
          label: tierItem.name,
          category: category || item.category,
          subCategory: subCategory || item.type || null,
          sublabel: getSublabel ? getSublabel(item, tierItem, k, index) : (subCategory || category),
          accent: getUniversalAccent(computedRarity),
          iconCategory: getIconCategory ? getIconCategory(item, tierItem, k, index) : (subCategory || category),
          rarity: computedRarity,
          sortOrder: tierItem.sortOrder
        };
      });
    } else {
      const computedRarity = getRarity ? getRarity(item, null, null, null) : (item.rarity || 0);
      return {
        matKey: item.id,
        label: item.name,
        category: category || item.category,
        subCategory: subCategory || item.type || null,
        sublabel: getSublabel ? getSublabel(item, null, null, null) : (subCategory || category),
        accent: getUniversalAccent(computedRarity),
        iconCategory: getIconCategory ? getIconCategory(item, null, null, null) : (subCategory || category),
        rarity: computedRarity,
        sortOrder: item.sortOrder
      };
    }
  });
};

export const getPrimaryInventoryList = () => {
  const formattedMisc = flattenAndFormatMaterials(miscMaterials, null, null,
    (item) => {
      if (item.name.includes('Wit') || item.name.includes('Advice') || item.name.includes('Exp')) return `EXP Book ${'★'.repeat(item.rarity)}`;
      if (item.name.includes('Ore')) return `Weapon EXP ${'★'.repeat(item.rarity)}`;
      if (item.id === 'Crown') return 'Talent Level-Up';
      if (item.id === 'masterless_stella_fortuna') return 'Awakening';
      if (item.id === 'DreamSolvent' || item.id === 'FragileResin') return 'Consumable';
      return item.category;
    },
    (item) => item.category,
    (item) => item.rarity
  );

  const formattedNormalBoss = flattenAndFormatMaterials(normalBoss, 'Boss Drops', 'Normal Boss', () => 'Normal Boss', () => 'Normal Boss Material', () => 4);
  const formattedWeeklyBoss = flattenAndFormatMaterials(weeklyBoss, 'Boss Drops', 'Weekly Boss', () => 'Weekly Boss', () => 'Weekly Boss Material', () => 5);

  const formattedCommonEnemy = flattenAndFormatMaterials(commonEnemy, 'Enemy Drops', 'Common Enhancement Material',
    (item, t, k, i) => ['Common', 'Uncommon', 'Rare', 'Epic'][i] || 'Common',
    () => 'Common Enhancement Material',
    (item, t, k, i) => [1, 2, 3][i] || 1
  );

  const formattedEliteEnemy = flattenAndFormatMaterials(eliteEnemy, 'Enemy Drops', 'Elite Enhancement Material',
    (item, t, k, i) => ['Common', 'Uncommon', 'Rare', 'Epic'][i] || 'Common',
    () => 'Elite Enhancement Material',
    (item, t, k, i) => [2, 3, 4, 5][i] || 2
  );

  const formattedLocal = flattenAndFormatMaterials(localSpecialty, 'Local Specialty', null, () => 'Local Specialty', () => 'Local Specialty', () => 1);

  const formattedTalent = flattenAndFormatMaterials(talentMaterials, 'Talent Materials', null,
    (item, t, k, i) => TIER_STARS_BOOK[i] || 'Book',
    () => 'Talent Material',
    (item, t, k, i) => [2, 3, 4][i] || 2
  );

  const formattedWeapon = flattenAndFormatMaterials(weaponAscension, 'Weapon Ascension Material', null,
    (item, t, k, i) => TIER_STARS_WEAPON[i] || 'Ascension',
    () => 'Weapon Ascension Material',
    (item, t, k, i) => [2, 3, 4, 5][i] || 2
  );

  const formattedGems = flattenAndFormatMaterials(characterGems, 'Character Ascension Gem', null,
    (item, t, k, i) => TIER_STARS_GEM[i] || 'Gem',
    () => 'Character Ascension Gem',
    (item, t, k, i) => [2, 3, 4, 5][i] || 2
  );

  return [
    ...formattedMisc,
    ...formattedNormalBoss,
    ...formattedWeeklyBoss,
    ...formattedCommonEnemy,
    ...formattedEliteEnemy,
    ...formattedLocal,
    ...formattedTalent,
    ...formattedWeapon,
    ...formattedGems
  ];
}
