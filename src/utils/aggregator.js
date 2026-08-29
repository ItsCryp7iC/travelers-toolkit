/**
 * aggregator.js — Grand-total resource calculator across entire tracked roster
 *
 * Usage:
 *   import { aggregateRosterCosts, computeToFarm } from './aggregator'
 */

import charactersData from './characters'
import weaponsData from '../data/weapons.json'
import costsData from '../data/costs.json'
import { calculateProgressionCost, calculateTalentCost, calculateAllTalentsCost, calculateWeaponCost, WEAPON_ORE_KEY } from './calculator'
import { resolveSpecificItem } from './resolver'

// Build a fast character lookup
const CHAR_MAP = Object.fromEntries(charactersData.map((c) => [c.name, c]))
const WEAPON_MAP = Object.fromEntries(weaponsData.map((w) => [w.name, w]))

/**
 * Merge two flat cost-map objects together (add quantities).
 * @param {Object} acc  accumulator { [key]: qty }
 * @param {Object} src  new values  { [key]: qty }
 */
function merge(acc, src) {
  if (!src) return
  for (const [k, v] of Object.entries(src)) {
    acc[k] = (acc[k] || 0) + v
  }
}

/**
 * Calculate grand totals of every material required by all tracked roster
 * characters that have a progression goal set.
 *
 * @param {Object} roster  — Zustand roster slice { [charName]: entry }
 */
export function aggregateRosterCosts(roster, trackedWeapons = []) {
  const grandTotalCosts = {}
  const grandTotalCategories = {}
  const grandTotalRarities = {}
  const breakdown = []

  for (const [charName, entry] of Object.entries(roster)) {
    const fromLevel = entry.level ?? 1
    const fromAsc = entry.ascension ?? 0
    const toLevel = entry.targetLevel ?? 90
    const toAsc = entry.targetAscension ?? 6

    const ascNoop = fromAsc === toAsc && fromLevel >= toLevel

    const talentState = {
      normalFrom: entry.talents?.normal ?? 1,
      normalTo: entry.targetTalents?.normal ?? 1,
      skillFrom: entry.talents?.skill ?? 1,
      skillTo: entry.targetTalents?.skill ?? 1,
      burstFrom: entry.talents?.burst ?? 1,
      burstTo: entry.targetTalents?.burst ?? 1,
    }
    const talentNoop =
      talentState.normalTo <= talentState.normalFrom &&
      talentState.skillTo <= talentState.skillFrom &&
      talentState.burstTo <= talentState.burstFrom

    if (ascNoop && talentNoop) continue

    const character = CHAR_MAP[charName]
    if (!character) continue

    let ascCosts = null
    if (!ascNoop) {
      ascCosts = calculateProgressionCost(character, fromLevel, toLevel)
    }

    let normalCosts = null, skillCosts = null, burstCosts = null
    if (!talentNoop) {
      normalCosts = calculateTalentCost(character, talentState.normalFrom, talentState.normalTo)
      skillCosts = calculateTalentCost(character, talentState.skillFrom, talentState.skillTo)
      burstCosts = calculateTalentCost(character, talentState.burstFrom, talentState.burstTo)
    }

    const totalCosts = {}

    const processCosts = (costObj, isWeapon = false) => {
      if (!costObj) return
      Object.entries(costObj).forEach(([key, val]) => {
        if (typeof val === 'number' && val > 0) {
          const resolved = resolveSpecificItem(key, isWeapon ? null : character, isWeapon ? wData : null);
          const finalId = resolved.id;
          totalCosts[finalId] = (totalCosts[finalId] || 0) + val
          grandTotalCosts[finalId] = (grandTotalCosts[finalId] || 0) + val
          grandTotalCategories[finalId] = resolved.category;
          grandTotalRarities[finalId] = resolved.rarity;
        }
      })
    }

    processCosts(ascCosts, false)
    processCosts(normalCosts, false)
    processCosts(skillCosts, false)
    processCosts(burstCosts, false)

    if (Object.values(totalCosts).some(val => val > 0)) {
      breakdown.push({ name: charName, character, entry, totalCosts, talentState })
    }
  }

  for (const weapon of trackedWeapons) {
    const wFromLv = weapon.level ?? 1
    const wToLv = weapon.targetLevel ?? 90
    const wFromAsc = weapon.ascension ?? 0
    const wToAsc = weapon.targetAscension ?? 6

    if (wFromAsc === wToAsc && wFromLv >= wToLv) continue

    const wData = WEAPON_MAP[weapon.weaponName]
    if (!wData) continue

    const weaponCosts = calculateWeaponCost(wData, wFromLv, wToLv, wFromAsc, wToAsc, false, roster)

    const totalCosts = {}
    const processWeaponCosts = (costObj) => {
      if (!costObj) return
      Object.entries(costObj).forEach(([key, val]) => {
        if (typeof val === 'number' && val > 0) {
          const resolved = resolveSpecificItem(key, null, wData);
          const finalId = resolved.id;
          totalCosts[finalId] = (totalCosts[finalId] || 0) + val
          grandTotalCosts[finalId] = (grandTotalCosts[finalId] || 0) + val
          grandTotalCategories[finalId] = resolved.category;
          grandTotalRarities[finalId] = resolved.rarity;
        }
      })
    }

    processWeaponCosts(weaponCosts)

    if (Object.values(totalCosts).some(val => val > 0)) {
      breakdown.push({ name: weapon.weaponName, isWeapon: true, entry: weapon, totalCosts })
    }
  }

  return {
    totalCosts: grandTotalCosts,
    categories: grandTotalCategories,
    rarities: grandTotalRarities,
    breakdown,
    trackedCount: breakdown.length,
  }
}

export function computeToFarm(totals, inventory) {
  const inv = inventory || {}
  const totalCosts = totals.totalCosts || {}
  const categories = totals.categories || {}
  const rarities = totals.rarities || {}

  const allItems = Object.entries(totalCosts)
    .map(([name, required]) => {
      const owned = inv[name] || 0
      const toFarm = Math.max(0, required - owned)
      return {
        name,
        required,
        owned,
        toFarm,
        category: categories[name] || 'unknown',
        rarity: rarities[name] || 3
      }
    })
    .filter(item => item.toFarm > 0)
    .sort((a, b) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      return a.name.localeCompare(b.name);
    })

  const filterCategory = (cat) => allItems.filter(item => item.category === cat)

  return {
    mora: allItems.find(i => i.name === 'mora'),
    heroWits: allItems.find(i => i.name === 'heros_wit'),
    crown: allItems.find(i => i.name === 'crown_of_insight'),
    mysticOre: allItems.find(i => i.name === 'mystic_enhancement_ore'),
    stellaFortuna: allItems.find(i => i.name === 'masterless_stella_fortuna'),
    gemstones: filterCategory('gemstones'),
    worldBoss: filterCategory('worldBoss'),
    localSpecialty: filterCategory('localSpecialty'),
    mob: filterCategory('mob'),
    talentBooks: filterCategory('talentBooks'),
    weeklyBoss: filterCategory('weeklyBoss'),
    weaponAscMats: filterCategory('weaponAscMats'),
    eliteMob: filterCategory('eliteMob'),
    craftingMats: allItems.filter(item => item.category === 'billet' || item.category === 'forgingOre' || item.category === 'Crafting Material'),
    totalItems: allItems.length,
    allDone: allItems.length === 0,
  }
}

/**
 * Calculate the forging costs for a single weapon based on its refinement delta.
 * @param {Object} weapon - The tracked weapon object from the store.
 * @param {number} currentRefinement - Current refinement level (0-5).
 * @param {number} targetRefinement - Target refinement level (0-5).
 * @param {Object} forgingData - Imported weapon_forging.json
 * @returns {Object} Cost map of material IDs to quantities.
 */
export function calculateForgingCost(weapon, currentRefinement, targetRefinement, forgingData) {
  if (targetRefinement <= currentRefinement || !forgingData) return {};
  const originalWeapon = WEAPON_MAP[weapon.weaponName];
  const recipeId = originalWeapon ? originalWeapon.id : weapon.weaponName;
  const recipe = forgingData[recipeId] || forgingData[weapon.weaponName];
  if (!recipe) return {};

  const delta = targetRefinement - currentRefinement;
  const costs = {};

  if (recipe.billet) {
    costs[recipe.billet.id] = (recipe.billet.qty ?? 1) * delta;
  }
  for (const ore of (recipe.ores ?? [])) {
    const oreQty = (ore.qty ?? 0) * delta;
    if (oreQty > 0) costs[ore.id] = oreQty;
  }
  if (recipe.mora) {
    costs['mora'] = recipe.mora * delta;
  }

  return costs;
}

/**
 * Aggregate the total materials required for all entries in trackedWeapons.
 *
 * @param {Array}  trackedWeapons - Zustand trackedWeapons slice
 * @param {Object} forgingData  - Imported weapon_forging.json (keyed by weapon id)
 * @returns {{ totalCosts, categories, rarities, breakdown }}
 *   Same shape as aggregateRosterCosts, so it's drop-in compatible with rendering code.
 *   Category values for new material types:
 *     - 'billet'     for billet items (Northlander/Midlander/Borderland * type)
 *     - 'forgingOre' for regional ores (Crystal Chunk, Amethyst Lump, etc.)
 *     - 'mora'       for Mora cost
 */
export function getCraftingCosts(trackedWeapons, forgingData) {
  const grandTotalCosts = {}
  const grandTotalCategories = {}
  const grandTotalRarities = {}
  const breakdown = []

  if (!forgingData || !trackedWeapons?.length) {
    return { totalCosts: grandTotalCosts, categories: grandTotalCategories, rarities: grandTotalRarities, breakdown }
  }

  for (const weapon of trackedWeapons) {
    const curRefine = weapon.currentRefinement ?? 1;
    const tgtRefine = weapon.targetRefinement ?? 1;
    
    if (tgtRefine <= curRefine) continue;

    const wData = WEAPON_MAP[weapon.weaponName];
    const recipeKey = wData ? wData.id : weapon.weaponName.replace(/[^a-zA-Z]/g, '');
    const recipe = forgingData[recipeKey];
    if (!recipe) continue;

    const totalCosts = calculateForgingCost(weapon, curRefine, tgtRefine, forgingData);

    // ── Update Categories and Rarities ──────────────────────────────────────
    if (recipe.billet && totalCosts[recipe.billet.id]) {
      grandTotalCategories[recipe.billet.id] = 'billet'
      grandTotalRarities[recipe.billet.id] = 4
    }
    for (const ore of (recipe.ores ?? [])) {
      if (totalCosts[ore.id]) {
        grandTotalCategories[ore.id] = 'forgingOre'
        grandTotalRarities[ore.id] = 1
      }
    }
    if (totalCosts['mora']) {
      grandTotalCategories['mora'] = 'mora'
      grandTotalRarities['mora'] = 1
    }

    // ── Merge into grand totals ─────────────────────────────────────────────
    for (const [id, qty] of Object.entries(totalCosts)) {
      grandTotalCosts[id] = (grandTotalCosts[id] || 0) + qty;
    }

    breakdown.push({
      id: weapon.id,
      name: weapon.weaponName,
      weaponId: weapon.weapon_id,
      quantity: tgtRefine - curRefine,
      recipe,
      totalCosts,
    })
  }

  return {
    totalCosts: grandTotalCosts,
    categories: grandTotalCategories,
    rarities: grandTotalRarities,
    breakdown,
    trackedCount: breakdown.length,
  }
}

// ─── Master Material Registry ──────────────────────────────────────────────
// All known materials from characters.json, categorised for the Inventory UI.
// Mob materials include 3 tiers per base (Common / Uncommon / Rare).

// Gemstone base names (4 tiers each: Sliver / Fragment / Chunk / Full)
export const GEM_BASES = [
  'AgnidusAgate',    // Pyro
  'NagadusEmerald',  // Dendro
  'PrithivaTopaz',   // Geo
  'ShivadaJade',     // Cryo
  'VajradaAmethyst', // Electro
  'VarunadaLazurite',// Hydro
  'VayudaTurquoise', // Anemo
  'BrilliantDiamond',// Multi / Traveler
]
export const GEM_TIERS = ['Sliver', 'Fragment', 'Chunk', '']
export const GEM_TIER_LABELS = ['Sliver ★', 'Fragment ★★', 'Chunk ★★★', 'Gemstone ★★★★']

export const WORLD_BOSS_MATS = [
  'ArtificedSpareClockworkComponentCoppelia',
  'ArtificedSpareClockworkComponentCoppelius',
  'BasaltPillar', 'CleansingHeart', 'CloudseamScale', 'CrystallineBloom',
  'CyclicMilitaryKuuvahkiCore', 'DewofRepudiation', 'DragonheirsFalseFin',
  'EmperorsResolution', 'EnsnaringGaze', 'EverflameSeed', 'EvergloomRing',
  'FontemerUnihorn', 'FragmentofaGoldenMelody', 'GoldInscribedSecretSourceCore',
  'HoarfrostCore', 'HurricaneSeed', 'JuvenileJade', 'LightGuidingTetrahedron',
  'LightbearingScaleFeather', 'LightningPrism', 'MajesticHookedBeak',
  'MarionetteCore', 'MarkoftheBindingBlessing', 'OverripeFlamegranate',
  'PerpetualCaliber', 'PerpetualHeart', 'PrecisionKuuvahkiStampingDie',
  'PseudoStamens', 'QuelledCreeper', 'RadiantAntler', 'RemnantOfTheDreadwing',
  'RiftbornRegalia', 'RunicFang', 'SecretSourceAirflowAccumulator',
  'SmolderingPearl', 'SparklessStatueCore', 'StormBeads',
  'TalismanoftheEnigmaticLand', 'ThunderclapFruitcore', 'TourbillonDevice',
  'WaterThatFailedToTranscend',
]

export const LOCAL_SPECIALTY_MATS = [
  'AmakumoFruit', 'BerylConch', 'BrilliantChrysanthemum', 'CallaLily',
  'Cecilia', 'ClearwaterJade', 'CorLapis', 'CrystalMarrow', 'DandelionSeed',
  'Dendrobium', 'Dracolite', 'FluorescentFungus', 'FrostlampFlower',
  'GlazeLily', 'GlowingHornshroom', 'HennaBerry', 'JueyunChili',
  'KalpalataLotus', 'LakelightLily', 'LumidouceBell', 'Lumitoile',
  'MoonfallSilver', 'MourningFlower', 'NakuWeed', 'NilotpalaLotus',
  'NoctilucousJade', 'Onikabuto', 'Padisarah', 'PhilanemoMushroom',
  'PineAmber', 'PortableBearing', 'Qingxin', 'QuenepaBerry', 'RainbowRose',
  'RomaritimeFlower', 'RukkhashavaMushrooms', 'SakuraBloom', 'SandGreasePupa',
  'SangoPearl', 'SaurianClawSucculent', 'Scarab', 'SeaGanoderma',
  'SilkFlower', 'SkysplitGembloom', 'SmallLampGrass', 'SprayfeatherGill',
  'SpringOfTheFirstDewdrop', 'Starconch', 'SubdetectionUnit', 'Trishiraite',
  'Valberry', 'Violetgrass', 'WindwheelAster', 'WinterIcelea',
  'WitheringPurpurbloom', 'Wolfhook',
]

// Mob base names (each generates 3 keys: base, base (Uncommon), base (Rare))
export const MOB_BASES = [
  'ClockworkMeka', 'Fatui', 'FatuiOprichniki', 'FontemerAberrant',
  'Fungi', 'Hilichurl', 'HilichurlShooter', 'Landcruisers',
  'NatlanSaurian', 'Nobushi', 'Samachurl', 'SauroformTribalWarriors',
  'Slime', 'Specters', 'TheEremites', 'TreasureHoarder', 'Whopperflower',
]

/** Expand a mob base into 3 keyed tier names */
export function getMobTierKeys(base) {
  return [base, `${base} (Uncommon)`, `${base} (Rare)`]
}

/** Expand a gemstone base into 4 keyed tier names */
export function getGemTierKeys(base) {
  return GEM_TIERS.map((t) => (t ? `${base}${t}` : base))
}
