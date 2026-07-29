/**
 * calculator.js — Genshin Impact Character Progression Cost Engine
 *
 * Reads from costs.json for leveling costs (mora + hero wits).
 * Ascension material quantities are standard Genshin values (hardcoded,
 * since costs.json only contains leveling data).
 *
 * Usage:
 *   import { calculateProgressionCost } from './calculator'
 *   const costs = calculateProgressionCost(character, fromLevel, fromAsc, toLevel, toAsc, costsData)
 */

// ─── Ascension Level Caps ──────────────────────────────────────────────────
// ascension phase → max level allowed at that ascension
export const ASCENSION_CAPS = [20, 40, 50, 60, 70, 80, 90]

// ─── Min level per ascension phase ────────────────────────────────────────
export const ASCENSION_MIN = [1, 20, 40, 50, 60, 70, 80]

/**
 * Get the valid level range for a given ascension phase.
 * @param {number} ascension 0-6
 * @returns {{ min: number, max: number }}
 */
export function getLevelRange(ascension) {
  return {
    min: ASCENSION_MIN[ascension] ?? 1,
    max: ASCENSION_CAPS[ascension] ?? 90,
  }
}

/**
 * Clamp a level to be valid for the given ascension.
 */
export function clampLevel(level, ascension) {
  const { min, max } = getLevelRange(ascension)
  return Math.min(Math.max(level, min), max)
}

// ─── Gemstone Tier Suffixes ────────────────────────────────────────────────
// index = gemTier (0=Sliver, 1=Fragment, 2=Chunk, 3=Full gemstone)
const GEM_TIER_SUFFIX = ['Sliver', 'Fragment', 'Chunk', '']

/** Build full gemstone material name from base + tier */
export function buildGemName(gemBase, tier) {
  const suffix = GEM_TIER_SUFFIX[tier]
  return suffix ? `${gemBase}${suffix}` : gemBase
}

// ─── Ascension Phase Costs ─────────────────────────────────────────────────
// Index 0 = phase A0→A1, index 5 = phase A5→A6
// gemTier: 0=Sliver, 1=Fragment, 2=Chunk, 3=Full
// mob: [tier1, tier2, tier3] quantities
const ASCENSION_PHASES_5STAR = [
  { mora: 20000,  gemTier: 0, gemQty: 1, boss: 0,  local: 3,  mob: [3,  0,  0]  },
  { mora: 40000,  gemTier: 1, gemQty: 3, boss: 2,  local: 10, mob: [0,  15, 0]  },
  { mora: 60000,  gemTier: 1, gemQty: 6, boss: 4,  local: 20, mob: [0,  12, 0]  },
  { mora: 80000,  gemTier: 2, gemQty: 3, boss: 8,  local: 30, mob: [0,  0,  18] },
  { mora: 100000, gemTier: 2, gemQty: 6, boss: 12, local: 45, mob: [0,  0,  12] },
  { mora: 120000, gemTier: 3, gemQty: 6, boss: 20, local: 60, mob: [0,  0,  24] },
]

const ASCENSION_PHASES_4STAR = [
  { mora: 12500,  gemTier: 0, gemQty: 1, boss: 0,  local: 3,  mob: [3,  0,  0]  },
  { mora: 17500,  gemTier: 1, gemQty: 3, boss: 2,  local: 10, mob: [0,  15, 0]  },
  { mora: 25000,  gemTier: 1, gemQty: 6, boss: 4,  local: 20, mob: [0,  12, 0]  },
  { mora: 30000,  gemTier: 2, gemQty: 3, boss: 8,  local: 30, mob: [0,  0,  18] },
  { mora: 37500,  gemTier: 2, gemQty: 6, boss: 12, local: 45, mob: [0,  0,  12] },
  { mora: 45000,  gemTier: 3, gemQty: 6, boss: 20, local: 60, mob: [0,  0,  24] },
]

// ─── Mob tier label builder ────────────────────────────────────────────────
const MOB_TIER_LABELS = ['Common', 'Uncommon', 'Rare']

/**
 * Build mob material display names from the mob_material base string.
 * e.g., "Slime" → ["Slime", "Slime Condensate", "Slime Concentrate"]
 * Since the JSON only has the base name, we append tier labels.
 */
export function buildMobNames(mobBase) {
  return [
    mobBase,                      // Tier 1 — basic drop
    `${mobBase} (Uncommon)`,      // Tier 2
    `${mobBase} (Rare)`,          // Tier 3
  ]
}

// ─── Main Calculation Function ─────────────────────────────────────────────

/**
 * Calculate total resources needed to go from current to target state.
 *
 * @param {Object} character    — Character object from characters.json
 * @param {number} fromLevel    — Current level (1-90)
 * @param {number} fromAsc      — Current ascension (0-6)
 * @param {number} toLevel      — Target level (1-90)
 * @param {number} toAsc        — Target ascension (0-6)
 * @param {Object} costsData    — Parsed costs.json { character_levels: [...] }
 *
 * @returns {Object} {
 *   mora, heroWits,
 *   gemstones: { [materialName]: qty },
 *   worldBoss: { [materialName]: qty } | null,
 *   localSpecialty: { [materialName]: qty },
 *   mob: { [materialName]: qty },
 *   ascensionMora,
 *   levelingMora,
 * }
 */
export function calculateProgressionCost(
  character,
  fromLevel,
  fromAsc,
  toLevel,
  toAsc,
  costsData
) {
  const { rarity, materials } = character
  const phases = rarity >= 5 ? ASCENSION_PHASES_5STAR : ASCENSION_PHASES_4STAR

  // Build a level→cost lookup from costs.json
  const levelMap = {}
  for (const entry of costsData.character_levels) {
    levelMap[entry.level] = entry
  }

  // ── Leveling cost (mora + hero wits) ──────────────────────────────────────
  // costs.json values = cumulative cost remaining from that level to 90.
  // Cost from A→B = remaining[A] - remaining[B]
  const fromEntry = levelMap[fromLevel]
  const toEntry   = levelMap[toLevel]

  let levelingMora = 0
  let heroWits     = 0

  if (fromEntry && toEntry && toLevel > fromLevel) {
    levelingMora = Math.max(0, fromEntry.mora_required - toEntry.mora_required)
    heroWits     = Math.max(0, fromEntry.hero_wits - toEntry.hero_wits)
  }

  // ── Ascension cost ─────────────────────────────────────────────────────────
  let ascensionMora = 0
  const gemstones     = {}
  const worldBoss     = {}
  const localSpecialty = {}
  const mob           = {}

  const gemBase  = materials?.gemstone    || 'BrilliantDiamond'
  const bossName = materials?.world_boss  || null
  const localName = materials?.local_specialty || 'Unknown'
  const mobBase  = materials?.mob_material || 'Common'
  const mobNames = buildMobNames(mobBase)

  // Loop through each ascension phase between fromAsc and toAsc
  for (let phase = fromAsc; phase < toAsc; phase++) {
    const p = phases[phase]
    if (!p) continue

    ascensionMora += p.mora

    // Gemstones
    const gemName = buildGemName(gemBase, p.gemTier)
    gemstones[gemName] = (gemstones[gemName] || 0) + p.gemQty

    // World boss (only phases 1+ require boss drops)
    if (p.boss > 0 && bossName && bossName !== 'nan') {
      worldBoss[bossName] = (worldBoss[bossName] || 0) + p.boss
    }

    // Local specialty
    localSpecialty[localName] = (localSpecialty[localName] || 0) + p.local

    // Mob materials (3 tiers)
    p.mob.forEach((qty, tier) => {
      if (qty > 0) {
        const mName = mobNames[tier]
        mob[mName] = (mob[mName] || 0) + qty
      }
    })
  }

  const totalMora = levelingMora + ascensionMora

  return {
    totalMora,
    levelingMora,
    ascensionMora,
    heroWits,
    gemstones,
    worldBoss: Object.keys(worldBoss).length > 0 ? worldBoss : null,
    localSpecialty,
    mob,
    // Convenience flags
    hasAnyCost: totalMora > 0 || heroWits > 0 || Object.keys(gemstones).length > 0,
  }
}

/**
 * Format a large number with commas and optional suffix (K, M).
 */
export function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000)    return n.toLocaleString()
  return n.toString()
}

/**
 * Get human-readable display name for a material key (CamelCase → "Camel Case").
 */
export function formatMaterialName(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

// ─── Talent Book Tier Key Builders ─────────────────────────────────────────
// bookBase e.g. "Freedom" → tier2 key: "FreedomTeachings", tier3: "FreedomGuide", tier4: "FreedomPhilosophies"
export function buildBookKey(bookBase, tier) {
  if (!bookBase || bookBase === 'nan') return null
  const SUFFIXES = { 2: 'Teachings', 3: 'Guide', 4: 'Philosophies' }
  return `${bookBase}${SUFFIXES[tier] || ''}`
}

// ─── Talent Upgrade Cost Table ─────────────────────────────────────────────
// Index 0 = upgrade 1→2, index 8 = upgrade 9→10
// bookTier: 2=★★ Teachings, 3=★★★ Guide, 4=★★★★ Philosophies
// mob: [tier1qty, tier2qty, tier3qty]
// weekly: qty of weekly boss mat required
// crown: qty of Crown of Insight required
export const TALENT_LEVEL_COSTS = [
  // 1→2
  { mora: 12500,  bookTier: 2, bookQty: 3,  mob: [6, 0, 0], weekly: 0, crown: 0 },
  // 2→3
  { mora: 17500,  bookTier: 3, bookQty: 2,  mob: [0, 3, 0], weekly: 0, crown: 0 },
  // 3→4
  { mora: 25000,  bookTier: 3, bookQty: 4,  mob: [0, 4, 0], weekly: 0, crown: 0 },
  // 4→5
  { mora: 30000,  bookTier: 3, bookQty: 6,  mob: [0, 6, 0], weekly: 0, crown: 0 },
  // 5→6
  { mora: 37500,  bookTier: 3, bookQty: 9,  mob: [0, 9, 0], weekly: 0, crown: 0 },
  // 6→7
  { mora: 120000, bookTier: 4, bookQty: 4,  mob: [0, 0, 4], weekly: 1, crown: 0 },
  // 7→8
  { mora: 260000, bookTier: 4, bookQty: 6,  mob: [0, 0, 6], weekly: 1, crown: 0 },
  // 8→9
  { mora: 450000, bookTier: 4, bookQty: 12, mob: [0, 0, 9], weekly: 2, crown: 0 },
  // 9→10
  { mora: 700000, bookTier: 4, bookQty: 16, mob: [0, 0, 12],weekly: 2, crown: 1 },
]

/**
 * Calculate total cost for upgrading a single talent from `fromLv` to `toLv`.
 *
 * @param {Object} character   — character object with materials.talent_book / weekly_boss / mob_material
 * @param {number} fromLv      — current talent level (1-10)
 * @param {number} toLv        — target talent level  (1-10)
 *
 * @returns {Object} {
 *   talentMora, books: { [bookKey]: qty }, mob: { [mobKey]: qty },
 *   weeklyBoss: { [bossKey]: qty } | null, crown: number
 * }
 */
export function calculateTalentCost(character, fromLv, toLv) {
  if (toLv <= fromLv) return { talentMora: 0, books: {}, mob: {}, weeklyBoss: null, crown: 0, hasAnyCost: false }

  const bookBase   = character?.materials?.talent_book  || null
  const weeklyName = character?.materials?.weekly_boss  || null
  const mobBase    = character?.materials?.mob_material || 'CommonMat'
  const mobNames   = buildMobNames(mobBase)

  let talentMora = 0
  let crown      = 0
  const books    = {}
  const mob      = {}
  const weekly   = {}

  for (let lv = fromLv; lv < toLv; lv++) {
    const phase = TALENT_LEVEL_COSTS[lv - 1] // index 0 = 1→2
    if (!phase) continue

    talentMora += phase.mora

    // Talent books
    if (bookBase && bookBase !== 'nan') {
      const bookKey = buildBookKey(bookBase, phase.bookTier)
      if (bookKey) books[bookKey] = (books[bookKey] || 0) + phase.bookQty
    }

    // Mob materials
    phase.mob.forEach((qty, tier) => {
      if (qty > 0) {
        const mName = mobNames[tier]
        mob[mName] = (mob[mName] || 0) + qty
      }
    })

    // Weekly boss
    if (phase.weekly > 0 && weeklyName && weeklyName !== 'nan') {
      weekly[weeklyName] = (weekly[weeklyName] || 0) + phase.weekly
    }

    // Crown
    crown += phase.crown
  }

  return {
    talentMora,
    books,
    mob,
    weeklyBoss: Object.keys(weekly).length > 0 ? weekly : null,
    crown,
    hasAnyCost: talentMora > 0 || Object.keys(books).length > 0,
  }
}

/**
 * Calculate total talent cost for all 3 skills combined.
 *
 * @param {Object} character
 * @param {Object} talentState  { normalFrom, normalTo, skillFrom, skillTo, burstFrom, burstTo }
 *
 * @returns merged cost object identical in shape to calculateTalentCost()
 */
export function calculateAllTalentsCost(character, talentState) {
  const {
    normalFrom = 1, normalTo = 1,
    skillFrom  = 1, skillTo  = 1,
    burstFrom  = 1, burstTo  = 1,
  } = talentState

  const normal = calculateTalentCost(character, normalFrom, normalTo)
  const skill  = calculateTalentCost(character, skillFrom,  skillTo)
  const burst  = calculateTalentCost(character, burstFrom,  burstTo)

  const mergeObj = (a, b) => {
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v
    return out
  }

  const allBooks  = mergeObj(mergeObj(normal.books, skill.books), burst.books)
  const allMob    = mergeObj(mergeObj(normal.mob,   skill.mob),   burst.mob)
  const allWeekly = mergeObj(
    normal.weeklyBoss || {},
    mergeObj(skill.weeklyBoss || {}, burst.weeklyBoss || {})
  )

  return {
    talentMora:  normal.talentMora + skill.talentMora + burst.talentMora,
    books:       allBooks,
    mob:         allMob,
    weeklyBoss:  Object.keys(allWeekly).length > 0 ? allWeekly : null,
    crown:       normal.crown + skill.crown + burst.crown,
    hasAnyCost:  normal.hasAnyCost || skill.hasAnyCost || burst.hasAnyCost,
  }
}

// ─── Talent Book Domain Schedule ───────────────────────────────────────────
// Standard Genshin server reset day = Monday 4:00 UTC+8.
// Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// Sunday = all books available
export const TALENT_BOOK_SCHEDULES = {
  // Mon / Thu
  MonThu: ['Freedom', 'Prosperity', 'Diligence'],
  // Tue / Fri
  TueFri: ['Resistance', 'Ballad', 'Gold'],
  // Wed / Sat
  WedSat: ['Ballad', 'Elegance', 'Light', 'Admonition', 'Praxis', 'Ingenuity',
           'Equity', 'Justice', 'Order', 'Conflict', 'Contention', 'Kindling',
           'Moonlight', 'Elysium', 'Transience', 'Vagrancy'],
}

// Complete canonical schedule (mirrors in-game domain availability)
export const BOOK_SCHEDULE_BY_DAY = {
  // 0 = Sunday — all books available (special day)
  0: ['Freedom','Prosperity','Diligence','Resistance','Ballad','Gold',
      'Elegance','Light','Admonition','Praxis','Ingenuity','Equity',
      'Justice','Order','Conflict','Contention','Kindling','Moonlight',
      'Elysium','Transience','Vagrancy'],
  // 1 = Monday / 4 = Thursday
  1: ['Freedom','Prosperity','Diligence','Admonition','Ingenuity',
      'Equity','Conflict','Kindling','Moonlight','Vagrancy'],
  4: ['Freedom','Prosperity','Diligence','Admonition','Ingenuity',
      'Equity','Conflict','Kindling','Moonlight','Vagrancy'],
  // 2 = Tuesday / 5 = Friday
  2: ['Resistance','Ballad','Gold','Praxis','Justice',
      'Contention','Elysium','Transience'],
  5: ['Resistance','Ballad','Gold','Praxis','Justice',
      'Contention','Elysium','Transience'],
  // 3 = Wednesday / 6 = Saturday
  3: ['Diligence','Elegance','Light','Order','Equity',
      'Conflict','Kindling','Moonlight'],
  6: ['Diligence','Elegance','Light','Order','Equity',
      'Conflict','Kindling','Moonlight'],
}

/**
 * Returns the list of talent book bases available today (server time).
 * Uses local UTC time as approximation.
 */
export function getTodayBooks() {
  const day = new Date().getDay() // 0=Sun … 6=Sat
  return BOOK_SCHEDULE_BY_DAY[day] || BOOK_SCHEDULE_BY_DAY[0]
}

/**
 * Get the day-of-week label for the schedule group.
 */
export function getDayLabel(day) {
  const labels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return labels[day] ?? 'Unknown'
}

// ═══════════════════════════════════════════════════════════════════════════
//   WEAPON COST ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ─── Weapon Ascension Phase Costs ─────────────────────────────────────────
// Phases 0-5 = A0→A1 through A5→A6
// ascMat: [tier1, tier2, tier3, tier4] quantities (Debris/Fragment/Bit/Mist for example)
// elite: [tier1, tier2, tier3] quantities  (e.g., Slime / Slime Condensate / Slime Concentrate)
// mob:   [tier1, tier2, tier3] quantities  (e.g., Treasure Hoarder / Senior / Captain)
// ore:   Mystic Enhancement Ore equivalent (1 Mystic = 3 Fine = 9 Basic)

const WEAPON_ASCENSION_5STAR = [
  // A0→A1
  { mora: 10000,  ascMat: [3,0,0,0], elite: [3,0,0], mob: [2,0,0] },
  // A1→A2
  { mora: 20000,  ascMat: [0,3,0,0], elite: [0,3,0], mob: [0,4,0] },
  // A2→A3
  { mora: 30000,  ascMat: [0,6,0,0], elite: [0,6,0], mob: [0,6,0] },
  // A3→A4
  { mora: 45000,  ascMat: [0,0,3,0], elite: [0,0,3], mob: [0,0,3] },
  // A4→A5
  { mora: 55000,  ascMat: [0,0,6,0], elite: [0,0,6], mob: [0,0,6] },
  // A5→A6
  { mora: 65000,  ascMat: [0,0,0,4], elite: [0,0,4], mob: [0,0,9] },
]

const WEAPON_ASCENSION_4STAR = [
  { mora: 5000,   ascMat: [3,0,0,0], elite: [2,0,0], mob: [1,0,0] },
  { mora: 15000,  ascMat: [0,3,0,0], elite: [0,2,0], mob: [0,3,0] },
  { mora: 20000,  ascMat: [0,6,0,0], elite: [0,4,0], mob: [0,5,0] },
  { mora: 30000,  ascMat: [0,0,3,0], elite: [0,0,2], mob: [0,0,2] },
  { mora: 35000,  ascMat: [0,0,6,0], elite: [0,0,4], mob: [0,0,4] },
  { mora: 45000,  ascMat: [0,0,0,4], elite: [0,0,3], mob: [0,0,6] },
]

const WEAPON_ASCENSION_3STAR = [
  { mora: 5000,   ascMat: [2,0,0,0], elite: [1,0,0], mob: [1,0,0] },
  { mora: 10000,  ascMat: [0,2,0,0], elite: [0,2,0], mob: [0,2,0] },
  { mora: 15000,  ascMat: [0,4,0,0], elite: [0,3,0], mob: [0,3,0] },
  { mora: 20000,  ascMat: [0,0,2,0], elite: [0,0,1], mob: [0,0,1] },
  { mora: 25000,  ascMat: [0,0,4,0], elite: [0,0,2], mob: [0,0,3] },
  { mora: 30000,  ascMat: [0,0,0,3], elite: [0,0,2], mob: [0,0,4] },
]

// Weapon leveling mora cost (cumulative from 1 to each level — the delta approach)
// Standard values per rarity:
// 5★: 300 mora/lv early, scales up
// We use simplified flat per-level costs aggregated by phase bracket (1-20, 21-40, etc.)
// Source: genshin.honeyhunterworld.com weapon upgrade table
const WEAPON_LEVELING_MORA_5STAR = [
  // [fromLv, toLv, moraPerLevel]
  [1,  20, 800],
  [20, 40, 1200],
  [40, 50, 1600],
  [50, 60, 2400],
  [60, 70, 3200],
  [70, 80, 4800],
  [80, 90, 6400],
]
const WEAPON_LEVELING_MORA_4STAR = [
  [1,  20, 500],
  [20, 40, 800],
  [40, 50, 1000],
  [50, 60, 1500],
  [60, 70, 2000],
  [70, 80, 3000],
  [80, 90, 4000],
]
const WEAPON_LEVELING_MORA_3STAR = [
  [1,  20, 250],
  [20, 40, 400],
  [40, 50, 500],
  [50, 60, 750],
  [60, 70, 1000],
  [70, 80, 1500],
  [80, 90, 2000],
]

// Mystic Enhancement Ore needed per level bracket (per level)
// 1 Mystic Ore = 1 unit here; Fine Ore = 0.33; Basic = 0.11
const WEAPON_ORE_PER_LEVEL_5STAR = [
  [1,  20, 2],
  [20, 40, 3],
  [40, 50, 4],
  [50, 60, 5],
  [60, 70, 6],
  [70, 80, 8],
  [80, 90, 10],
]
const WEAPON_ORE_PER_LEVEL_4STAR = [
  [1,  20, 1],
  [20, 40, 2],
  [40, 50, 2],
  [50, 60, 3],
  [60, 70, 4],
  [70, 80, 5],
  [80, 90, 7],
]
const WEAPON_ORE_PER_LEVEL_3STAR = [
  [1,  20, 1],
  [20, 40, 1],
  [40, 50, 1],
  [50, 60, 2],
  [60, 70, 2],
  [70, 80, 3],
  [80, 90, 4],
]

// ─── Weapon Ascension Material Tier Key Builders ───────────────────────────
// Each weapon ascension material has 4 tiers.
// Since weapons.json has no material names, we label generically with the
// ascension_mat field if present, else fallback to "WeaponAscMat".
// Tier suffixes: '' (T1) / 'Fragment' (T2) / 'Bit' (T3) / 'Mist' (T4)
const WEAPON_ASC_TIER_SUFFIX = ['', 'Fragment', 'Bit', 'Mist']
const WEAPON_ASC_TIER_LABELS = ['Debris ★', 'Fragment ★★', 'Chunk ★★★', 'Core ★★★★']

export function buildWeaponAscMatKey(base, tier) {
  // tier: 0=lowest, 3=highest
  const suffix = WEAPON_ASC_TIER_SUFFIX[tier]
  return suffix ? `${base}${suffix}` : base
}

// Elite mob tier labels (weapon-specific)
const WEAPON_ELITE_SUFFIX = ['', '(Uncommon)', '(Rare)']

export function buildWeaponEliteKey(base, tier) {
  const suffix = WEAPON_ELITE_SUFFIX[tier]
  return suffix ? `${base} ${suffix}` : base
}

// ─── Weapon Ore Key ─────────────────────────────────────────────────────
export const WEAPON_ORE_KEY = 'MysticEnhancementOre'

// ─── Main Weapon Cost Calculator ──────────────────────────────────────────
/**
 * Calculate total resources to ascend + level a weapon.
 *
 * @param {Object} weapon      — weapon object from weapons.json
 * @param {number} fromLevel   — current level  (1-90)
 * @param {number} fromAsc     — current ascension (0-6)
 * @param {number} toLevel     — target level   (1-90)
 * @param {number} toAsc       — target ascension (0-6)
 *
 * @returns {Object} {
 *   weaponMora, mysticOre, fineOre, normalOre,
 *   ascMats:  { [matKey]: qty },
 *   eliteMob: { [matKey]: qty },
 *   mob:      { [matKey]: qty },
 *   hasAnyCost: boolean,
 * }
 */
export function calculateWeaponCost(weapon, fromLevel, fromAsc, toLevel, toAsc) {
  if (!weapon) return { weaponMora: 0, mysticOre: 0, fineOre: 0, normalOre: 0, ascMats: {}, eliteMob: {}, mob: {}, hasAnyCost: false }

  const rarity = weapon.rarity ?? 3
  const ascBase    = (weapon.materials?.ascension_mat && weapon.materials.ascension_mat !== '')
    ? weapon.materials.ascension_mat
    : `${weapon.name}AscMat`        // fallback synthetic key
  const eliteBase  = (weapon.materials?.elite_mat && weapon.materials.elite_mat !== '')
    ? weapon.materials.elite_mat
    : `WeaponElite`
  const mobBase    = (weapon.materials?.mob_mat && weapon.materials.mob_mat !== '')
    ? weapon.materials.mob_mat
    : `WeaponMob`

  const phases = rarity >= 5 ? WEAPON_ASCENSION_5STAR
               : rarity >= 4 ? WEAPON_ASCENSION_4STAR
               : WEAPON_ASCENSION_3STAR

  const levelingMoraTable = rarity >= 5 ? WEAPON_LEVELING_MORA_5STAR
                          : rarity >= 4 ? WEAPON_LEVELING_MORA_4STAR
                          : WEAPON_LEVELING_MORA_3STAR

  const oreTable = rarity >= 5 ? WEAPON_ORE_PER_LEVEL_5STAR
                 : rarity >= 4 ? WEAPON_ORE_PER_LEVEL_4STAR
                 : WEAPON_ORE_PER_LEVEL_3STAR

  // ── Leveling cost ────────────────────────────────────────────────────────
  let levelingMora = 0
  let mysticOre    = 0

  if (toLevel > fromLevel) {
    for (const [bracketFrom, bracketTo, moraPerLv] of levelingMoraTable) {
      const overlapFrom = Math.max(fromLevel, bracketFrom)
      const overlapTo   = Math.min(toLevel,   bracketTo)
      if (overlapTo > overlapFrom) {
        levelingMora += (overlapTo - overlapFrom) * moraPerLv
      }
    }
    for (const [bracketFrom, bracketTo, orePerLv] of oreTable) {
      const overlapFrom = Math.max(fromLevel, bracketFrom)
      const overlapTo   = Math.min(toLevel,   bracketTo)
      if (overlapTo > overlapFrom) {
        mysticOre += (overlapTo - overlapFrom) * orePerLv
      }
    }
  }

  // ── Ascension cost ────────────────────────────────────────────────────────
  let ascensionMora = 0
  const ascMats  = {}
  const eliteMob = {}
  const mob      = {}

  for (let phase = fromAsc; phase < toAsc; phase++) {
    const p = phases[phase]
    if (!p) continue

    ascensionMora += p.mora

    // Ascension materials (4 tiers)
    p.ascMat.forEach((qty, tier) => {
      if (qty > 0) {
        const k = buildWeaponAscMatKey(ascBase, tier)
        ascMats[k] = (ascMats[k] || 0) + qty
      }
    })

    // Elite mob drops (3 tiers)
    p.elite.forEach((qty, tier) => {
      if (qty > 0) {
        const k = buildWeaponEliteKey(eliteBase, tier)
        eliteMob[k] = (eliteMob[k] || 0) + qty
      }
    })

    // Normal mob drops (3 tiers)
    p.mob.forEach((qty, tier) => {
      if (qty > 0) {
        const k = buildMobNames(mobBase)[tier]
        mob[k] = (mob[k] || 0) + qty
      }
    })
  }

  const weaponMora = levelingMora + ascensionMora

  return {
    weaponMora,
    levelingMora,
    ascensionMora,
    mysticOre,
    fineOre: 0,
    normalOre: 0,
    ascMats,
    eliteMob,
    mob,
    hasAnyCost: weaponMora > 0 || mysticOre > 0 || Object.keys(ascMats).length > 0
  }
}

// ─── Weapon Domain Schedule ────────────────────────────────────────────────
// Standard Genshin weapon ascension material domains:
//   Decarabian / Boreal Wolf / Dandelion Gladiator  →  Mon / Thu
//   Guyun / Mist Veiled / Aerosiderite              →  Tue / Fri
//   Coral Branch / Narukami / Oasis Garden          →  Wed / Sat
//   Sunday: ALL available
// We use the ascension_mat base name to map to a schedule group.
// Since weapons.json fields are empty we store the schedule by WEAPON NAME prefix
// and canonical base-name lists from in-game knowledge.

export const WEAPON_ASCENSION_MAT_BASES = [
  // Mon / Thu — Mondstadt / Boreal Wolf
  'DecarabianTreasure', 'BorealWolfMercury', 'DandelionGladiatorFragment',
  // Tue / Fri — Liyue
  'GuyunPiece', 'MistVeiledElixir', 'ChunLanThunder',
  // Wed / Sat — Inazuma / Sumeru / Fontaine
  'CoralBranchOfSharedGod', 'NarukamiValor', 'OasisGardenTurquoise',
  'TalentBook',
]

export const WEAPON_MAT_SCHEDULE_BY_DAY = {
  0: 'all',    // Sunday
  1: 'MonThu',
  4: 'MonThu',
  2: 'TueFri',
  5: 'TueFri',
  3: 'WedSat',
  6: 'WedSat',
}

// Map canonical weapon ascension mat series to their schedule group
// Key = any portion of the ascMat base name; value = schedule group
export const WEAPON_MAT_GROUPS = {
  MonThu: [
    'Decarabian','BorealWolf','DandelionGladiator',
    'GalesongQuill','SacrificalKnife','Mask',
  ],
  TueFri: [
    'Guyun','MistVeiled','Aerosiderite',
    'TaliasMedallion','DistantSea','NarukamiValor',
  ],
  WedSat: [
    'CoralBranch','NarukamiValor','OasisGarden',
    'KijinAscension','SacredLord','BeginnersProtector',
  ],
}

export function getWeaponMatScheduleGroup(ascMatBase) {
  if (!ascMatBase) return null
  for (const [group, bases] of Object.entries(WEAPON_MAT_GROUPS)) {
    if (bases.some((b) => ascMatBase.toLowerCase().includes(b.toLowerCase()))) {
      return group
    }
  }
  return null
}

/**
 * Returns today's weapon ascension material group name (or 'all' on Sunday).
 */
export function getTodayWeaponMatGroup() {
  const day = new Date().getDay()
  return WEAPON_MAT_SCHEDULE_BY_DAY[day] || 'all'
}

