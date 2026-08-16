/**
 * calculator.js — Genshin Impact Character Progression Cost Engine
 *
 * Reads from costs.json for leveling costs (mora + hero wits).
 * Ascension material quantities are standard Genshin values (hardcoded,
 * since costs.json only contains leveling data).
 *
 * Usage:
 *   import { calculateProgressionCost } from './calculator'
 *   const costs = calculateProgressionCost(character, fromLevel, fromAsc, toLevel, toAsc)
 */

import costsData from '../data/costs.json';

function extractLevel(lv) {
    if (lv === null || lv === undefined) return 1;
    if (typeof lv === 'object') return parseInt(lv.level || lv.current || lv.target || lv.value || 1, 10);
    if (typeof lv === 'string') return parseInt(lv.replace(/[^0-9]/g, ''), 10) || 1;
    return parseInt(lv, 10) || 1;
}

// ─── Ascension Level Caps ──────────────────────────────────────────────────
// ascension phase → max level allowed at that ascension
export const ASCENSION_CAPS = [20, 40, 50, 60, 70, 80, 100]

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
// Universal dynamic subtractor
function calculateDifference(startObj, targetObj, isDescending = true) {
  const result = {};
  if (!startObj || !targetObj) return result;
  Object.keys(startObj).forEach(key => {
    if (key !== 'level') {
      const diff = isDescending 
        ? (startObj[key] || 0) - (targetObj[key] || 0)
        : (targetObj[key] || 0) - (startObj[key] || 0);
      if (diff > 0) result[key] = diff;
    }
  });
  return result;
}

/**
 * Milestone levels where an ascension gating exists.
 * At these levels, being "ascended" means lookup should use level+1
 * (the ascension materials are encoded in the gap between these rows).
 * 
 * EFFECTIVE LEVEL RULE (applied independently to both sides):
 *   effectiveLookupLevel = rawLevel + (1 if ascended past this milestone)
 * 
 * costs.json is a DESCENDING cumulative-remaining table:
 *   row[80] = total cost remaining from L80 pre-ascension to L90
 *   row[81] = total cost remaining from L80 post-ascension to L90
 *   row[80] - row[81] = exactly the phase-6 ascension cost
 */
const MILESTONE_TO_DEFAULT_ASC = { 20: 1, 40: 2, 50: 3, 60: 4, 70: 5, 80: 6 };

/**
 * Compute the effective lookup level for costs.json.
 * If rawLevel is a milestone AND the character has already ascended past it,
 * we use rawLevel+1 (the "post-ascension" row), otherwise rawLevel.
 * @param {number} rawLevel  - raw level number
 * @param {number} ascension - current ascension phase (0-6)
 */
function effectiveLookupLevel(rawLevel, ascension) {
  const lv = Math.min(rawLevel, 90);
  const ascAtMilestone = MILESTONE_TO_DEFAULT_ASC[lv];
  // If this level IS a milestone and ascension >= what's needed to have passed it → use lv+1
  if (ascAtMilestone !== undefined && ascension >= ascAtMilestone) {
    return Math.min(lv + 1, 90);
  }
  return lv;
}

export function calculateProgressionCost(character, fromLv, toLv, fromAsc, toAsc) {
  if (!costsData?.character_levels) return {};

  // Extract levels — accept both positional args and character object properties
  const rawFromLv  = extractLevel(character?.currentLevel  ?? character?.level              ?? fromLv ?? 1);
  const rawToLv    = extractLevel(character?.targetLevel    ?? character?.target?.level      ?? toLv   ?? 90);
  const rawFromAsc = character?.currentAscension ?? character?.ascension ?? character?.current?.ascension ?? fromAsc ?? 0;
  const rawToAsc   = character?.targetAscension  ?? character?.target?.ascension             ?? toAsc  ?? 6;

  // Compute effective lookup levels — this is the key to ascension-phase awareness
  const eLvFrom = effectiveLookupLevel(rawFromLv, rawFromAsc);
  const eLvTo   = effectiveLookupLevel(rawToLv,   rawToAsc);

  // No-op guard: if effective positions are identical, nothing to do
  if (eLvFrom >= eLvTo) return {};

  const fromObj = costsData.character_levels.find(x => x.level === eLvFrom) || costsData.character_levels[0];
  const toObj   = costsData.character_levels.find(x => x.level === eLvTo)   || costsData.character_levels[costsData.character_levels.length - 1];

  const result = calculateDifference(fromObj, toObj, true);

  // ── Same-level ascension correction ────────────────────────────────────────
  // The effective-level trick (eLvFrom=80, eLvTo=81) makes costs.json return
  // the correct ascension MATERIALS, but the cumulative mora and heros_wit
  // deltas between those two rows also include one level-step's worth of XP
  // cost (80→81) which does NOT apply when the raw level hasn't changed.
  //
  // Fix: if the player's raw level is unchanged, strip heros_wit entirely and
  // replace mora with pure ascension mora read directly from ASCENSION_PHASES
  // (which is always correct regardless of cumulative table encoding).
  if (rawFromLv === rawToLv) {
    delete result.heros_wit;

    let rarityNum = 5;
    if (character?.rarity) {
      rarityNum = typeof character.rarity === 'string'
        ? (character.rarity.match(/★/g) || []).length || parseInt(character.rarity) || 5
        : character.rarity;
    }
    const ascArray = rarityNum === 4 ? ASCENSION_PHASES_4STAR : ASCENSION_PHASES_5STAR;

    // Sum mora for only the ascension phases being crossed, ignoring XP mora
    let pureAscMora = 0;
    for (let i = rawFromAsc; i < rawToAsc; i++) {
      pureAscMora += ascArray[i]?.mora ?? 0;
    }

    if (pureAscMora > 0) {
      result.mora = pureAscMora;
    } else {
      delete result.mora;
    }
  }

  // Stella Fortuna for constellation unlocks at 95 and 100
  let stellaFortuna = 0;
  if (rawFromLv < 95 && rawToLv >= 95) stellaFortuna += 1;
  if (rawFromLv < 100 && rawToLv === 100) stellaFortuna += 2;
  if (stellaFortuna > 0) result['masterless_stella_fortuna'] = stellaFortuna;

  return result;
}

// ─── Regression tests ──────────────────────────────────────────────────────
// Run once at module load in dev to catch silent regressions.
if (import.meta.env?.DEV && costsData?.character_levels) {
  // Test 1: same level, different ascension phase → must be nonzero
  // Razor: L80 A5 (not ascended) → L80 A6 (ascended)
  const t1 = calculateProgressionCost(null, 80, 80, 5, 6);
  if (!t1 || Object.keys(t1).length === 0) {
    console.error('[Calculator REGRESSION] L80 A5 → L80 A6 returned empty — same-level ascension diff broken!', t1);
  } else {
    console.assert(t1.boss_material > 0, '[Calculator REGRESSION] L80 A5→A6: boss_material should be > 0, got', t1.boss_material);
    console.assert(t1.local_specialty > 0, '[Calculator REGRESSION] L80 A5→A6: local_specialty should be > 0, got', t1.local_specialty);
    console.assert(t1.mora > 0, '[Calculator REGRESSION] L80 A5→A6: mora should be > 0, got', t1.mora);
  }

  // Test 2: same level AND same ascension → must be zero (Barbara case)
  const t2 = calculateProgressionCost(null, 80, 80, 6, 6);
  if (t2 && Object.keys(t2).length > 0) {
    console.error('[Calculator REGRESSION] L80 A6 → L80 A6 returned nonzero — should be empty!', t2);
  }

  // Test 3: sanity direction — L1 A0 → L90 A6 must have positive mora
  const t3 = calculateProgressionCost(null, 1, 90, 0, 6);
  console.assert((t3.mora ?? 0) > 0, '[Calculator REGRESSION] L1→L90 full: mora should be > 0, got', t3.mora);
}

/**
 * Format a large number with commas and optional suffix (K, M).
 */
export function formatNumber(num) {
  if (num === undefined || num === null || isNaN(Number(num))) {
    return '0';
  }
  
  const n = Number(num);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000)    return n.toLocaleString()
  return n.toString()
}

/**
 * Get human-readable display name for a material key.
 * Converts snake_case to "Title Case".
 */
export function formatItemName(rawKey) {
  if (!rawKey) return '';
  return rawKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Keep the old one just in case it's used elsewhere
export function formatMaterialName(key) {
  if (!key) return '';
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
  if (!costsData?.talent_levels) return {};
  const sLv = extractLevel(fromLv);
  const tLv = extractLevel(toLv);
  const sObj = costsData.talent_levels.find(x => x.level === sLv) || costsData.talent_levels[0];
  const tObj = costsData.talent_levels.find(x => x.level === tLv) || costsData.talent_levels[costsData.talent_levels.length - 1];
  return calculateDifference(sObj, tObj, true);
}

export function calculateAllTalentsCost(character, talents) {
  const auto = calculateTalentCost(character, talents?.auto?.current, talents?.auto?.target);
  const skill = calculateTalentCost(character, talents?.skill?.current, talents?.skill?.target);
  const burst = calculateTalentCost(character, talents?.burst?.current, talents?.burst?.target);
  
  const total = {};
  [auto, skill, burst].forEach(tObj => {
    Object.entries(tObj).forEach(([k, v]) => {
      total[k] = (total[k] || 0) + v;
    });
  });
  
  // Track individual mora for table breakdown
  total.mora_na = auto.mora || 0;
  total.mora_skill = skill.mora || 0;
  total.mora_burst = burst.mora || 0;
  
  return total;
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

export const DOMAIN_MAPPINGS = {
  // Talent Books
  'Freedom': 'Forsaken Rift',
  'Resistance': 'Forsaken Rift',
  'Ballad': 'Forsaken Rift',
  'Prosperity': 'Taishan Mansion',
  'Diligence': 'Taishan Mansion',
  'Gold': 'Taishan Mansion',
  'Transience': 'Violet Court',
  'Elegance': 'Violet Court',
  'Light': 'Violet Court',
  'Admonition': 'Steeple of Ignorance',
  'Ingenuity': 'Steeple of Ignorance',
  'Praxis': 'Steeple of Ignorance',
  'Equity': 'Pale Forgotten Glory',
  'Justice': 'Pale Forgotten Glory',
  'Order': 'Pale Forgotten Glory',
  'Contention': 'Blazing Ruins',
  'Kindling': 'Blazing Ruins',
  'Conflict': 'Blazing Ruins',
  
  // Weapon Materials
  'Decarabian': 'Cecilia Garden',
  'BorealWolf': 'Cecilia Garden',
  'DandelionGladiator': 'Cecilia Garden',
  'Guyun': 'Hidden Palace of Lianshan Formula',
  'MistVeiled': 'Hidden Palace of Lianshan Formula',
  'Aerosiderite': 'Hidden Palace of Lianshan Formula',
  'CoralBranch': 'Court of Flowing Sand',
  'NarukamiValor': 'Court of Flowing Sand',
  'Mask': 'Court of Flowing Sand',
  'OasisGarden': 'Tower of Abject Pride',
  'ScorchingMight': 'Tower of Abject Pride',
  'ForestDew': 'Tower of Abject Pride',
  'BrokenGoblet': 'Echoes of the Deep Tides',
  'PureSacredDewdrop': 'Echoes of the Deep Tides',
  'PristineSea': 'Echoes of the Deep Tides',
  'SacrificialHeart': 'Ancient Watchtower',
  'DeliriousDecadence': 'Ancient Watchtower',
  'BlazingSacrificialHeart': 'Ancient Watchtower',
  
  // Handling the grouped constants from WEAPON_MAT_GROUPS just in case:
  'GalesongQuill': 'Echoes of the Deep Tides',
}

export function getDomainForMaterial(materialName) {
  if (!materialName) return 'Unknown Domain';
  for (const [key, domain] of Object.entries(DOMAIN_MAPPINGS)) {
    if (materialName.toLowerCase().includes(key.toLowerCase())) {
      return domain;
    }
  }
  return 'Unknown Domain';
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
export function calculateWeaponCost(weapon, fromLv, toLv, fromAsc, toAsc, hasEventBonus = false, charactersRoster = []) {
  let rarityNum = 5;
  if (weapon?.rarity) {
    rarityNum = typeof weapon.rarity === 'string' ? (weapon.rarity.match(/★/g) || []).length || parseInt(weapon.rarity) || 5 : weapon.rarity;
  }
  const rarity = `${rarityNum}_star`;
  if (!costsData?.weapon_levels?.[rarity]) return {};
  const sLv = extractLevel(fromLv);
  const tLv = extractLevel(toLv);
  const arr = costsData.weapon_levels[rarity];
  const sObj = arr.find(x => x.level === sLv) || arr[0];
  const tObj = arr.find(x => x.level === tLv) || arr[arr.length - 1];
  const result = calculateDifference(sObj, tObj, false); // Weapons ascend, so cost goes up

  // Calculate precise ore distribution
  let totalExpNeeded = result.total_exp || 0;
  if (hasEventBonus) {
    totalExpNeeded = Math.ceil(totalExpNeeded / 1.5);
  }
  
  if (totalExpNeeded > 0) {
    const mysticOre = Math.floor(totalExpNeeded / 10000);
    const fineOre = Math.floor((totalExpNeeded % 10000) / 2000);
    const normalOre = Math.ceil((totalExpNeeded % 2000) / 400);
    const totalProvidedExp = (mysticOre * 10000) + (fineOre * 2000) + (normalOre * 400);
    
    result.mystic_ore = mysticOre;
    result.fine_ore = fineOre;
    result.normal_ore = normalOre;
    result.wasted_exp = totalProvidedExp - totalExpNeeded;
  } else {
    result.mystic_ore = 0;
    result.fine_ore = 0;
    result.normal_ore = 0;
    result.wasted_exp = 0;
  }

  const enhancementMora = Math.ceil(totalExpNeeded / 10);
  let ascensionMora = 0;
  
  if (fromAsc !== undefined && toAsc !== undefined && toAsc > fromAsc) {
    let ascArray = WEAPON_ASCENSION_5STAR;
    if (rarityNum === 4) ascArray = WEAPON_ASCENSION_4STAR;
    if (rarityNum <= 3) ascArray = WEAPON_ASCENSION_3STAR;
    
    for (let i = fromAsc; i < toAsc; i++) {
      if (ascArray[i]) {
        ascensionMora += ascArray[i].mora || 0;
      }
    }
  }

  const hasRaiden = Object.keys(charactersRoster).includes('Raiden Shogun');
  const hasWanderer = Object.keys(charactersRoster).includes('Wanderer');

  let ascensionMultiplier = 1;
  let discountSource = null;

  if (hasRaiden && (weapon?.type === 'Sword' || weapon?.type === 'Polearm')) {
      ascensionMultiplier = 0.5;
      discountSource = 'Raiden Shogun';
  } else if (hasWanderer && (weapon?.type === 'Bow' || weapon?.type === 'Catalyst')) {
      ascensionMultiplier = 0.5;
      discountSource = 'Wanderer';
  }

  result.has_ascension_discount = !!discountSource;
  result.discount_source = discountSource;
  
  ascensionMora = Math.ceil(ascensionMora * ascensionMultiplier);

  result.total_mora = enhancementMora + ascensionMora;

  return result;
}

export const toggleMilestoneAscension = (level, currentAscension) => {
  if (level === 20) return currentAscension === 0 ? 1 : 0;
  if (level === 40) return currentAscension === 1 ? 2 : 1;
  if (level === 50) return currentAscension === 2 ? 3 : 2;
  if (level === 60) return currentAscension === 3 ? 4 : 3;
  if (level === 70) return currentAscension === 4 ? 5 : 4;
  if (level === 80) return currentAscension === 5 ? 6 : 5;
  return currentAscension; 
};

export const isMilestone = (level) => [20, 40, 50, 60, 70, 80].includes(Number(level));
