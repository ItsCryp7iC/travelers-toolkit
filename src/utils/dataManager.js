import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import bossMaterials from '../data/boss_materials.json'
import enemyMaterials from '../data/enemy_materials.json'
import localSpecialty from '../data/local_specialty.json'
import talentMaterials from '../data/talent_materials.json'
import weaponAscension from '../data/weapon_ascension.json'

// ─── Element / Gemstone Info ──────────────────────────────────────────────

const TIER_STARS_GEM = ['Sliver ★', 'Fragment ★★', 'Chunk ★★★', 'Gemstone ★★★★']
const TIER_STARS_WEAPON = ['Debris ★', 'Fragment ★★', 'Chunk ★★★', 'Core ★★★★'] // generic fallback
const TIER_STARS_MOB_COMMON = ['Common', 'Uncommon', 'Rare']
const TIER_STARS_BOOK = ['Teachings', 'Guide', 'Philosophies']

// ─── Lookup Maps ────────────────────────────────────────────────────────
const lookupBoss = new Map(bossMaterials.map(item => [item.id, item]))
const lookupEnemy = new Map(enemyMaterials.map(item => [item.id, item]))
const lookupLocal = new Map(localSpecialty.map(item => [item.id, item]))
const lookupTalent = new Map(talentMaterials.map(item => [item.id, item]))
const lookupWeaponAsc = new Map(weaponAscension.map(item => [item.id, item]))

const ID_ALIASES = {
  // Weapon Ascension Aliases
  decarabian: 'decarabiantiles',
  borealwolf: 'borealwolfteeth',
  dandeliongladiator: 'dandelionshackles',
  guyun: 'guyunpillar',
  mistveiled: 'elixir',
  distantsea: 'branchesofadistantsea',
  narukami: 'narukamismagatama',
  mask: 'onimask',
  scorchingmight: 'scorchingmights',
  ancientchord: 'ancientchords',
  puresacreddewdrop: 'sacreddewdrops',
  blazingsacrificialheart: 'blazingsacrificialhearts',
  sacredlord: 'deliriousmasksofthesacredlord',
  nightwind: 'nightwindsmystics',
  // Enemy Material Aliases
  fatui: 'fatuiskirmisher',
  fungi: 'fungus',
}

const resolveId = (id) => {
  if (!id) return null
  return ID_ALIASES[id] || id
}

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

  const worldBossId = resolveId(m.world_boss_material_id)
  const weeklyBossId = resolveId(m.weekly_boss_material_id)
  const talentId = resolveId(m.talent_material_family_id)
  const enemyId = resolveId(m.enemy_material_family_id)
  const localId = resolveId(m.local_specialty_id)

  const resolved = {
    worldBoss: worldBossId ? (lookupBoss.get(worldBossId) || SAFE_FALLBACK) : SAFE_FALLBACK,
    weeklyBoss: weeklyBossId ? (lookupBoss.get(weeklyBossId) || SAFE_FALLBACK) : SAFE_FALLBACK,
    talent: SAFE_FALLBACK,
    enemy: SAFE_FALLBACK,
    localSpecialty: localId ? (lookupLocal.get(localId) || SAFE_FALLBACK) : SAFE_FALLBACK,
    gem: m.gem_family_id ? GEM_INFO[m.gem_family_id] || SAFE_FALLBACK : SAFE_FALLBACK
  }

  // Generate 4 tiers for gems based on baseName
  if (resolved.gem && resolved.gem.baseName) {
    const base = resolved.gem.baseName
    resolved.gem.tiers = {
      '1_star': { name: `${base} Sliver` },
      '2_star': { name: `${base} Fragment` },
      '3_star': { name: `${base} Chunk` },
      '4_star': { name: `${base} Gemstone` }
    }
  }

  const talentData = talentId ? lookupTalent.get(talentId) : null
  if (talentData) {
    resolved.talent = { ...talentData }
  }

  const enemyData = enemyId ? lookupEnemy.get(enemyId) : null
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
  const dbWeapon = weaponsData.find(w => w.id === safeId);

  if (!dbWeapon || !dbWeapon.materials) {
    return { ascensionFamily: SAFE_FALLBACK, eliteFamily: SAFE_FALLBACK, commonFamily: SAFE_FALLBACK };
  }

  const rawAsc = dbWeapon.materials.ascension_material_family_id;
  const rawElite = dbWeapon.materials.enhancement_material_family_id;
  const rawCommon = dbWeapon.materials.enemy_material_family_id;

  // Apply aliases robustly
  const ascId = typeof resolveId === 'function' ? resolveId(rawAsc) : (ID_ALIASES[rawAsc] || rawAsc);
  const eliteId = typeof resolveId === 'function' ? resolveId(rawElite) : (ID_ALIASES[rawElite] || rawElite);
  const commonId = typeof resolveId === 'function' ? resolveId(rawCommon) : (ID_ALIASES[rawCommon] || rawCommon);

  // Fallback to whichever variable name the import actually uses
  const ascDataArray = typeof weaponAscensionData !== 'undefined' ? weaponAscensionData : (typeof weaponAscension !== 'undefined' ? weaponAscension : []);
  const enemyDataArray = typeof enemyMaterialsData !== 'undefined' ? enemyMaterialsData : (typeof enemyMaterials !== 'undefined' ? enemyMaterials : []);

  const ascensionFamily = ascDataArray.find(mat => mat.id === ascId) || SAFE_FALLBACK;
  const eliteFamily = enemyDataArray.find(mat => mat.id === eliteId) || SAFE_FALLBACK;
  const commonFamily = enemyDataArray.find(mat => mat.id === commonId) || SAFE_FALLBACK;

  return { ascensionFamily, eliteFamily, commonFamily };
}

// ─── Master Inventory List Generator ─────────────────────────────────────

export const getPrimaryInventoryList = () => {
  const mats = new Map()

  const addMat = (key, cat, subCat, label, sublabel, accent, iconCategory, rarity, sortOrder) => {
    if (!key || key === 'nan' || mats.has(key)) return
    mats.set(key, { matKey: key, category: cat, subCategory: subCat, label, sublabel, accent, iconCategory: iconCategory || null, rarity: rarity || 0, sortOrder: sortOrder || 999 })
  }

  // 1. Currency & Experience (Universal Hardcoded)
  addMat('Mora', 'Currency', null, 'Mora', 'Currency', '#FAB632', 'Currency', 5, 1)
  addMat('HeroWit', 'Experience', null, "Hero's Wit", 'EXP Book ★★★★', '#60A5FA', 'Experience', 4, 2)
  addMat('AdventurerExp', 'Experience', null, 'Adventurer Exp', 'EXP Book ★★', '#4ADE80', 'Experience', 2, 3)
  addMat('WandererAdvice', 'Experience', null, "Wanderer's Advice", 'EXP Book ★', '#9CA3AF', 'Experience', 1, 4)
  addMat('Crown', 'Experience', null, 'Crown of Insight', 'Talent Level-Up', '#FBBF24', 'Experience', 5, 5)
  addMat('masterless_stella_fortuna', 'Experience', null, 'Masterless Stella Fortuna', 'Awakening', '#FBBF24', 'Experience', 5, 6)
  addMat('MysticEnhancementOre', 'Experience', null, 'Mystic Enhancement Ore', 'Weapon EXP ★★★', '#60A5FA', 'Experience', 3, 7)
  addMat('FineEnhancementOre', 'Experience', null, 'Fine Enhancement Ore', 'Weapon EXP ★★', '#4ADE80', 'Experience', 2, 8)
  addMat('EnhancementOre', 'Experience', null, 'Enhancement Ore', 'Weapon EXP ★', '#9CA3AF', 'Experience', 1, 9)
  addMat('DreamSolvent', 'Experience', null, 'Dream Solvent', 'Consumable', '#C8A96E', 'Experience', 4, 10)
  addMat('FragileResin', 'Experience', null, 'Fragile Resin', 'Consumable', '#60A5FA', 'Experience', 4, 11)

  // 2. Boss Materials
  bossMaterials.forEach(b => {
    if (b.type === 'normal_boss') {
      addMat(b.id, 'Boss Drops', 'Normal Boss', b.name, 'Normal Boss', '#EF6D22', 'Normal Boss Material', 4, b.sortOrder)
    } else if (b.type === 'weekly_boss') {
      addMat(b.id, 'Boss Drops', 'Weekly Boss', b.name, 'Weekly Boss', '#A855F7', 'Weekly Boss Material', 5, b.sortOrder)
    }
  })

  // 3. Enemy Drops
  enemyMaterials.forEach(e => {
    const subCat = e.type === 'elite_enemy' ? 'Elite Enhancement Material' : 'Common Enhancement Material'
    const colorCycle = e.type === 'elite_enemy' ? ['#9CA3AF', '#60A5FA', '#A78BFA', '#F59E0B'] : ['#9CA3AF', '#60A5FA', '#A78BFA']
    const rarityCycle = e.type === 'elite_enemy' ? [2, 3, 4, 5] : [1, 2, 3]
    const tiers = extractTiers(e.tiers)
    tiers.forEach((t, i) => {
      addMat(t.id, 'Enemy Drops', subCat, t.name, ['Common', 'Uncommon', 'Rare', 'Epic'][i], colorCycle[i] || '#C8A96E', subCat, rarityCycle[i] || 1, t.sortOrder)
    })
  })

  // 4. Local Specialties
  localSpecialty.forEach(l => {
    addMat(l.id, 'Local Specialty', null, l.name, 'Local Specialty', '#22C55E', 'Local Specialty', 1, l.sortOrder)
  })

  // 5. Talent Materials
  talentMaterials.forEach(t => {
    const tiers = extractTiers(t.tiers)
    const talentRarities = [2, 3, 4]
    tiers.forEach((tier, i) => {
      addMat(tier.id, 'Talent Materials', null, tier.name, TIER_STARS_BOOK[i] || 'Book', '#60A5FA', 'Talent Material', talentRarities[i] || 2, tier.sortOrder)
    })
  })

  // 6. Weapon Ascension Materials
  weaponAscension.forEach(w => {
    const tiers = extractTiers(w.tiers)
    const weaponAscRarities = [2, 3, 4, 5]
    tiers.forEach((tier, i) => {
      addMat(tier.id, 'Weapon Ascension Material', null, tier.name, TIER_STARS_WEAPON[i] || 'Ascension', '#F59E0B', 'Weapon Ascension Material', weaponAscRarities[i] || 2, tier.sortOrder)
    })
  })

  return Array.from(mats.values()).sort((a, b) => a.label.localeCompare(b.label))
}
