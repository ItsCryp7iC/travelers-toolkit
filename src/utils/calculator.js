/**
 * calculator.js — Genshin Impact Character Progression Cost Engine
 *
 * Reads from costs.json for leveling costs (mora + hero wits).
 * Ascension material quantities are standard Genshin values (hardcoded,
 * since costs.json only contains leveling data).
 *
 * Usage:
 *   import { calculateProgressionCost } from './calculator'
 *   const costs = calculateProgressionCost(character, fromLevel, toLevel, fromAsc, toAsc)
 */

import costsData from '../data/costs.json';
import { validateLevelAscension } from './progressionContracts';

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
// ─── Ascension Phase Costs ─────────────────────────────────────────────────
// Index 0 = phase A0→A1, index 5 = phase A5→A6
// In Genshin Impact, character ascension costs (Mora and materials) are uniform
// across both 4★ and 5★ characters.
export const ASCENSION_PHASE_COSTS = [
  { mora: 20000,  boss_material: 0,  local_specialty: 3,  gem_sliver: 1,   '1_star_enemy_material': 3 },
  { mora: 40000,  boss_material: 2,  local_specialty: 10, gem_fragment: 3, '1_star_enemy_material': 15 },
  { mora: 60000,  boss_material: 4,  local_specialty: 20, gem_fragment: 6, '2_star_enemy_material': 12 },
  { mora: 80000,  boss_material: 8,  local_specialty: 30, gem_chunk: 3,    '2_star_enemy_material': 18 },
  { mora: 100000, boss_material: 12, local_specialty: 45, gem_chunk: 6,    '3_star_enemy_material': 12 },
  { mora: 120000, boss_material: 20, local_specialty: 60, gem_gemstone: 6, '3_star_enemy_material': 24 },
];

export const ASCENSION_PHASES_5STAR = [
  { mora: 20000,  gemTier: 0, gemQty: 1, boss: 0,  local: 3,  mob: [3,  0,  0]  },
  { mora: 40000,  gemTier: 1, gemQty: 3, boss: 2,  local: 10, mob: [15, 0,  0]  },
  { mora: 60000,  gemTier: 1, gemQty: 6, boss: 4,  local: 20, mob: [0,  12, 0]  },
  { mora: 80000,  gemTier: 2, gemQty: 3, boss: 8,  local: 30, mob: [0,  18, 0]  },
  { mora: 100000, gemTier: 2, gemQty: 6, boss: 12, local: 45, mob: [0,  0,  12] },
  { mora: 120000, gemTier: 3, gemQty: 6, boss: 20, local: 60, mob: [0,  0,  24] },
];

// 4★ and 5★ character ascension costs are identical in Genshin Impact (DEF-C2-01)
export const ASCENSION_PHASES_4STAR = ASCENSION_PHASES_5STAR;

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
 * @param {number} toLevel      — Target level (1-90)
 * @param {number} fromAsc      — Current ascension (0-6)
 * @param {number} toAsc        — Target ascension (0-6)
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

const MILESTONE_ASC_MORA = { 20: 20000, 40: 40000, 50: 60000, 60: 80000, 70: 100000, 80: 120000 };

function getRemainingAscensionMora(level) {
  let sum = 0;
  for (const [m, cost] of Object.entries(MILESTONE_ASC_MORA)) {
    if (level <= Number(m)) sum += cost;
  }
  return sum;
}

function getPureLevelingMora(row) {
  if (!row) return 0;
  return Math.max(0, (row.mora || 0) - getRemainingAscensionMora(row.level));
}

export function calculateProgressionCost(character, fromLv, toLv, fromAsc, toAsc) {
  if (!costsData?.character_levels) return {};

  // Extract levels — accept both positional args and character object properties
  let rawFromLv = fromLv;
  let rawToLv = toLv;
  let rawFromAsc = fromAsc;
  let rawToAsc = toAsc;

  if (character && typeof character === 'object') {
    if (rawFromLv === undefined) rawFromLv = character.currentLevel ?? character.level ?? character.current?.level;
    if (rawToLv === undefined) rawToLv = character.targetLevel ?? character.target?.level;
    if (rawFromAsc === undefined) rawFromAsc = character.currentAscension ?? character.ascension ?? character.current?.ascension;
    if (rawToAsc === undefined) rawToAsc = character.targetAscension ?? character.target?.ascension;
  }

  // Canonical fallbacks when truly omitted
  if (rawFromLv === undefined) rawFromLv = 1;
  if (rawToLv === undefined) rawToLv = 90;
  if (rawFromAsc === undefined) rawFromAsc = 0;
  if (rawToAsc === undefined) rawToAsc = 6;

  // Explicit validation safeguards: detect invalid inputs without silent clamping
  const fromValidation = validateLevelAscension(rawFromLv, rawFromAsc, 'character');
  const toValidation = validateLevelAscension(rawToLv, rawToAsc, 'character');

  if (!fromValidation.isValid || !toValidation.isValid) {
    const reasons = [
      !fromValidation.isValid && `Current state invalid: ${fromValidation.reason}`,
      !toValidation.isValid && `Target state invalid: ${toValidation.reason}`,
    ].filter(Boolean).join('; ');

    return {
      isInvalid: true,
      invalidReason: reasons,
      mora: 0,
      total_mora: 0,
    };
  }

  const numFromLv = fromValidation.numericLevel;
  const numToLv = toValidation.numericLevel;
  const numFromAsc = fromValidation.numericAscension;
  const numToAsc = toValidation.numericAscension;

  // Completed or reverse target: standard no-op
  if (numFromLv > numToLv || (numFromLv === numToLv && numFromAsc >= numToAsc)) {
    return {};
  }

  const result = {};

  // 1. Leveling costs (EXP and Leveling Mora)
  // Clamp lookup levels within costs.json range [1, 90]
  const clampedFromLv = Math.min(Math.max(numFromLv, 1), 90);
  const clampedToLv   = Math.min(Math.max(numToLv, 1), 90);

  let levelingMora = 0;
  let levelingWits = 0;

  if (clampedFromLv < clampedToLv) {
    const fromRow = costsData.character_levels.find(x => x.level === clampedFromLv);
    const toRow   = costsData.character_levels.find(x => x.level === clampedToLv);

    if (fromRow && toRow) {
      levelingMora = Math.max(0, getPureLevelingMora(fromRow) - getPureLevelingMora(toRow));
      levelingWits = Math.max(0, (fromRow.heros_wit || 0) - (toRow.heros_wit || 0));
    }
  }

  // 2. Ascension costs (Ascension Mora & Materials)
  let totalAscMora = 0;
  const ascMats = {};

  if (numFromAsc < numToAsc) {
    const startPhase = Math.max(0, Math.min(numFromAsc, 6));
    const endPhase   = Math.max(0, Math.min(numToAsc, 6));

    for (let p = startPhase; p < endPhase; p++) {
      const phaseData = ASCENSION_PHASE_COSTS[p];
      if (phaseData) {
        totalAscMora += phaseData.mora || 0;
        for (const [k, v] of Object.entries(phaseData)) {
          if (k !== 'mora' && v > 0) {
            ascMats[k] = (ascMats[k] || 0) + v;
          }
        }
      }
    }
  }

  // Combine Mora
  const combinedMora = levelingMora + totalAscMora;
  if (combinedMora > 0) result.mora = combinedMora;

  // Leveling EXP
  if (levelingWits > 0) result.heros_wit = levelingWits;

  // Ascension materials
  for (const [k, v] of Object.entries(ascMats)) {
    if (v > 0) result[k] = v;
  }

  // Stella Fortuna for constellation unlocks at 95 and 100
  let stellaFortuna = 0;
  if (rawFromLv < 95 && rawToLv >= 95) stellaFortuna += 1;
  if (rawFromLv < 100 && rawToLv === 100) stellaFortuna += 2;
  if (stellaFortuna > 0) result['masterless_stella_fortuna'] = stellaFortuna;

  // Traveler / No-Boss check
  if (character && character.materials && !character.materials.world_boss_material_id) {
    delete result.boss_material;
  }

  return result;
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

  const books = character?.materials?.talent_material_family_ids;

  if (books && books.length === 3) {
    const total = {};
    for (let i = sLv; i < tLv; i++) {
       const cost = TALENT_LEVEL_COSTS[i - 1]; // since index 0 is 1->2
       if (!cost) continue;

       total.mora = (total.mora || 0) + cost.mora;
       if (cost.mob[0]) total['1_star_enemy_material'] = (total['1_star_enemy_material'] || 0) + cost.mob[0];
       if (cost.mob[1]) total['2_star_enemy_material'] = (total['2_star_enemy_material'] || 0) + cost.mob[1];
       if (cost.mob[2]) total['3_star_enemy_material'] = (total['3_star_enemy_material'] || 0) + cost.mob[2];
       if (cost.weekly) total['weekly_boss_material'] = (total['weekly_boss_material'] || 0) + cost.weekly;
       if (cost.crown) total['crown'] = (total['crown'] || 0) + cost.crown;

       if (cost.bookQty > 0) {
           const bookIndex = (i - 1) % 3;
           const bookFamily = books[bookIndex];
           const bookTierStr = `${cost.bookTier}_star_talent_material`;
           const customKey = `${bookFamily}_${bookTierStr}`;
           total[customKey] = (total[customKey] || 0) + cost.bookQty;
       }
    }
    return total;
  }

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
  // A0→A1: T1 asc (5), T1 elite (5), T1 mob (3)
  { mora: 10000,  ascMat: [5,0,0,0], elite: [5,0,0], mob: [3,0,0] },
  // A1→A2: T2 asc (5), T1 elite (18), T1 mob (12)
  { mora: 20000,  ascMat: [0,5,0,0], elite: [18,0,0], mob: [12,0,0] },
  // A2→A3: T2 asc (9), T2 elite (9), T2 mob (9)
  { mora: 30000,  ascMat: [0,9,0,0], elite: [0,9,0], mob: [0,9,0] },
  // A3→A4: T3 asc (5), T2 elite (18), T2 mob (14)
  { mora: 45000,  ascMat: [0,0,5,0], elite: [0,18,0], mob: [0,14,0] },
  // A4→A5: T3 asc (9), T3 elite (14), T3 mob (9)
  { mora: 55000,  ascMat: [0,0,9,0], elite: [0,0,14], mob: [0,0,9] },
  // A5→A6: T4 asc (6), T3 elite (27), T3 mob (18)
  { mora: 65000,  ascMat: [0,0,0,6], elite: [0,0,27], mob: [0,0,18] },
]

const WEAPON_ASCENSION_4STAR = [
  // Phase 0: T1 asc (3), T1 elite (3), T1 mob (2)
  { mora: 5000,   ascMat: [3,0,0,0], elite: [3,0,0], mob: [2,0,0] },
  // Phase 1: T2 asc (3), T1 elite (12), T1 mob (8)
  { mora: 15000,  ascMat: [0,3,0,0], elite: [12,0,0], mob: [8,0,0] },
  // Phase 2: T2 asc (6), T2 elite (6), T2 mob (6)
  { mora: 20000,  ascMat: [0,6,0,0], elite: [0,6,0], mob: [0,6,0] },
  // Phase 3: T3 asc (3), T2 elite (12), T2 mob (9)
  { mora: 30000,  ascMat: [0,0,3,0], elite: [0,12,0], mob: [0,9,0] },
  // Phase 4: T3 asc (6), T3 elite (9), T3 mob (6)
  { mora: 35000,  ascMat: [0,0,6,0], elite: [0,0,9], mob: [0,0,6] },
  // Phase 5: T4 asc (4), T3 elite (18), T3 mob (12)
  { mora: 45000,  ascMat: [0,0,0,4], elite: [0,0,18], mob: [0,0,12] },
]

const WEAPON_ASCENSION_3STAR = [
  // Phase 0: T1 asc (2), T1 elite (2), T1 mob (1)
  { mora: 5000,   ascMat: [2,0,0,0], elite: [2,0,0], mob: [1,0,0] },
  // Phase 1: T2 asc (2), T1 elite (8), T1 mob (5)
  { mora: 10000,  ascMat: [0,2,0,0], elite: [8,0,0], mob: [5,0,0] },
  // Phase 2: T2 asc (4), T2 elite (4), T2 mob (4)
  { mora: 15000,  ascMat: [0,4,0,0], elite: [0,4,0], mob: [0,4,0] },
  // Phase 3: T3 asc (2), T2 elite (8), T2 mob (6)
  { mora: 20000,  ascMat: [0,0,2,0], elite: [0,8,0], mob: [0,6,0] },
  // Phase 4: T3 asc (4), T3 elite (6), T3 mob (4)
  { mora: 25000,  ascMat: [0,0,4,0], elite: [0,0,6], mob: [0,0,4] },
  // Phase 5: T4 asc (3), T3 elite (12), T3 mob (8)
  { mora: 30000,  ascMat: [0,0,0,3], elite: [0,0,12], mob: [0,0,8] },
]

const WEAPON_ASCENSION_2STAR = [
  // Phase 0: T1 asc (1), T1 elite (1), T1 mob (1)
  { mora: 5000,   ascMat: [1,0,0,0], elite: [1,0,0], mob: [1,0,0] },
  // Phase 1: T2 asc (1), T1 elite (5), T1 mob (4)
  { mora: 5000,   ascMat: [0,1,0,0], elite: [5,0,0], mob: [4,0,0] },
  // Phase 2: T2 asc (3), T2 elite (3), T2 mob (3)
  { mora: 10000,  ascMat: [0,3,0,0], elite: [0,3,0], mob: [0,3,0] },
  // Phase 3: T3 asc (1), T2 elite (5), T2 mob (4)
  { mora: 15000,  ascMat: [0,0,1,0], elite: [0,5,0], mob: [0,4,0] },
]

const WEAPON_ASCENSION_1STAR = [
  // Phase 0: T1 asc (1), T1 elite (1), T1 mob (1)
  { mora: 0,      ascMat: [1,0,0,0], elite: [1,0,0], mob: [1,0,0] },
  // Phase 1: T2 asc (1), T1 elite (4), T1 mob (2)
  { mora: 5000,   ascMat: [0,1,0,0], elite: [4,0,0], mob: [2,0,0] },
  // Phase 2: T2 asc (2), T2 elite (2), T2 mob (2)
  { mora: 5000,   ascMat: [0,2,0,0], elite: [0,2,0], mob: [0,2,0] },
  // Phase 3: T3 asc (1), T2 elite (4), T2 mob (3)
  { mora: 10000,  ascMat: [0,0,1,0], elite: [0,4,0], mob: [0,3,0] },
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

// ─── Weapon Ascension Mora Discount Helpers ──────────────────────────────
const CHARACTER_CANONICAL_ALIASES = {
  'Raiden Shogun': ['Raiden Shogun', 'RaidenShogun'],
  'Wanderer': ['Wanderer'],
};

/**
 * Checks whether an eligible character is owned in the roster.
 * Supports:
 * - Zustand state.roster (name-keyed dictionary, e.g. { 'Raiden Shogun': { level: 90, ... } })
 * - Array of character objects ({ name: 'Raiden Shogun' } or { id: 'RaidenShogun' })
 * - Array of character name/ID strings (['Raiden Shogun'])
 * - Set of character name/ID strings
 * - Explicitly rejects unowned character entries ({ owned: false }, null, undefined)
 *
 * @param {any} charactersRoster
 * @param {string} targetCharName
 * @returns {boolean}
 */
export function isCharacterInRoster(charactersRoster, targetCharName) {
  if (!charactersRoster || !targetCharName) return false;

  const validIdentifiers = CHARACTER_CANONICAL_ALIASES[targetCharName] || [targetCharName];

  // Set lookup
  if (charactersRoster instanceof Set) {
    return validIdentifiers.some((id) => charactersRoster.has(id));
  }

  // Array lookup
  if (Array.isArray(charactersRoster)) {
    return charactersRoster.some((item) => {
      if (!item) return false;
      if (typeof item === 'string') {
        return validIdentifiers.includes(item);
      }
      if (typeof item === 'object') {
        if ('owned' in item && item.owned === false) return false;
        return validIdentifiers.includes(item.name) || validIdentifiers.includes(item.id);
      }
      return false;
    });
  }

  // Object / Dictionary lookup (e.g. Zustand state.roster)
  if (typeof charactersRoster === 'object') {
    return validIdentifiers.some((id) => {
      const entry = charactersRoster[id];
      if (entry === undefined || entry === null) return false;
      if (typeof entry === 'object' && 'owned' in entry && entry.owned === false) return false;
      if (typeof entry === 'boolean') return entry;
      return true;
    });
  }

  return false;
}

/**
 * Determines weapon ascension discount eligibility based on weapon type and roster.
 *
 * Rules:
 * - Raiden Shogun: 50% reduction in Sword and Polearm ascension Mora.
 * - Wanderer: 50% reduction in Bow and Catalyst ascension Mora.
 * - Claymores: no discount from these passives.
 * - Both owned: applies to their respective classes without double stacking.
 *
 * @param {Object} weapon - Weapon object (must contain type)
 * @param {any} charactersRoster - Roster state
 * @returns {{ multiplier: number, hasDiscount: boolean, discountSource: string|null }}
 */
export function getWeaponAscensionDiscount(weapon, charactersRoster = {}) {
  const weaponType = weapon?.type;
  if (!weaponType) {
    return { multiplier: 1, hasDiscount: false, discountSource: null };
  }

  const hasRaiden = isCharacterInRoster(charactersRoster, 'Raiden Shogun');
  const hasWanderer = isCharacterInRoster(charactersRoster, 'Wanderer');

  if (hasRaiden && (weaponType === 'Sword' || weaponType === 'Polearm')) {
    return { multiplier: 0.5, hasDiscount: true, discountSource: 'Raiden Shogun' };
  }

  if (hasWanderer && (weaponType === 'Bow' || weaponType === 'Catalyst')) {
    return { multiplier: 0.5, hasDiscount: true, discountSource: 'Wanderer' };
  }

  return { multiplier: 1, hasDiscount: false, discountSource: null };
}

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
export function calculateWeaponCost(weapon, fromLv, toLv, fromAsc, toAsc, hasEventBonus = false, charactersRoster = {}) {
  let rarityNum = 5;
  if (weapon?.rarity) {
    rarityNum = typeof weapon.rarity === 'string' ? (weapon.rarity.match(/★/g) || []).length || parseInt(weapon.rarity) || 5 : weapon.rarity;
  }
  const rarity = `${rarityNum}_star`;
  if (!costsData?.weapon_levels?.[rarity]) return {};
  const rawFromLv = fromLv !== undefined ? fromLv : (weapon?.level ?? 1);
  const rawToLv = toLv !== undefined ? toLv : (weapon?.targetLevel ?? 90);
  const rawFromAsc = fromAsc !== undefined ? fromAsc : (weapon?.ascension ?? 0);
  const rawToAsc = toAsc !== undefined ? toAsc : (weapon?.targetAscension ?? 6);

  // Explicit validation safeguards: detect invalid inputs without silent clamping
  const fromValidation = validateLevelAscension(rawFromLv, rawFromAsc, 'weapon', rarityNum);
  const toValidation = validateLevelAscension(rawToLv, rawToAsc, 'weapon', rarityNum);

  if (!fromValidation.isValid || !toValidation.isValid) {
    const reasons = [
      !fromValidation.isValid && `Current weapon state invalid: ${fromValidation.reason}`,
      !toValidation.isValid && `Target weapon state invalid: ${toValidation.reason}`,
    ].filter(Boolean).join('; ');

    return {
      isInvalid: true,
      invalidReason: reasons,
      total_mora: 0,
    };
  }

  const sLv = fromValidation.numericLevel;
  const tLv = toValidation.numericLevel;
  const sAsc = fromValidation.numericAscension;
  const tAsc = toValidation.numericAscension;

  if (sLv > tLv || (sLv === tLv && sAsc >= tAsc)) {
    return {};
  }

  const arr = costsData.weapon_levels[rarity];
  const sObj = arr.find(x => x.level === sLv) || arr[0];
  const tObj = arr.find(x => x.level === tLv) || arr[arr.length - 1];

  // Base level differences (total_exp)
  const result = calculateDifference(sObj, tObj, false);

  // 1. Strip all stale ascension materials and mora from the cumulative level difference calculation
  const keysToRemove = [
    '5_star_ascension_material', '4_star_ascension_material', '3_star_ascension_material', '2_star_ascension_material',
    '4_star_enhancement_material', '3_star_enhancement_material', '2_star_enhancement_material',
    '3_star_enemy_material', '2_star_enemy_material', '1_star_enemy_material',
    'mora', 'mystic_ore', 'exp_to_next_level'
  ];
  keysToRemove.forEach(k => delete result[k]);

  // 2. Calculate precise ore distribution and wasted exp
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

  // 3. Add genuine ascension phase costs
  if (sAsc < tAsc) {
    let ascArray = WEAPON_ASCENSION_5STAR;
    if (rarityNum === 4) ascArray = WEAPON_ASCENSION_4STAR;
    if (rarityNum === 3) ascArray = WEAPON_ASCENSION_3STAR;
    if (rarityNum === 2) ascArray = WEAPON_ASCENSION_2STAR;
    if (rarityNum === 1) ascArray = WEAPON_ASCENSION_1STAR;

    for (let i = sAsc; i < tAsc; i++) {
      const phase = ascArray[i];
      if (!phase) continue;

      ascensionMora += phase.mora || 0;

      if (phase.ascMat[0]) result['2_star_ascension_material'] = (result['2_star_ascension_material'] || 0) + phase.ascMat[0];
      if (phase.ascMat[1]) result['3_star_ascension_material'] = (result['3_star_ascension_material'] || 0) + phase.ascMat[1];
      if (phase.ascMat[2]) result['4_star_ascension_material'] = (result['4_star_ascension_material'] || 0) + phase.ascMat[2];
      if (phase.ascMat[3]) result['5_star_ascension_material'] = (result['5_star_ascension_material'] || 0) + phase.ascMat[3];

      if (phase.elite[0]) result['2_star_enhancement_material'] = (result['2_star_enhancement_material'] || 0) + phase.elite[0];
      if (phase.elite[1]) result['3_star_enhancement_material'] = (result['3_star_enhancement_material'] || 0) + phase.elite[1];
      if (phase.elite[2]) result['4_star_enhancement_material'] = (result['4_star_enhancement_material'] || 0) + phase.elite[2];

      if (phase.mob[0]) result['1_star_enemy_material'] = (result['1_star_enemy_material'] || 0) + phase.mob[0];
      if (phase.mob[1]) result['2_star_enemy_material'] = (result['2_star_enemy_material'] || 0) + phase.mob[1];
      if (phase.mob[2]) result['3_star_enemy_material'] = (result['3_star_enemy_material'] || 0) + phase.mob[2];
    }
  }

  const { multiplier: ascensionMultiplier, hasDiscount, discountSource } = getWeaponAscensionDiscount(weapon, charactersRoster);

  result.has_ascension_discount = hasDiscount;
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
