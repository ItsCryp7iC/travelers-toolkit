/**
 * aggregator.js — Grand-total resource calculator across entire tracked roster
 *
 * Usage:
 *   import { aggregateRosterCosts, computeToFarm } from './aggregator'
 */

import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import costsData from '../data/costs.json'
import { calculateProgressionCost, calculateAllTalentsCost, calculateWeaponCost, WEAPON_ORE_KEY } from './calculator'

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
export function aggregateRosterCosts(roster) {
  const totalGemstones    = {}
  const totalWorldBoss    = {}
  const totalLocal        = {}
  const totalMob          = {}
  const totalTalentBooks  = {}
  const totalWeeklyBoss   = {}
  const totalWeaponAsc    = {}
  const totalEliteMob     = {}
  
  let   totalMora         = 0
  let   totalHeroWits     = 0
  let   totalCrowns       = 0
  let   totalMysticOre    = 0
  const breakdown         = []

  for (const [charName, entry] of Object.entries(roster)) {
    const fromLevel = entry.level           ?? 1
    const fromAsc   = entry.ascension       ?? 0
    const toLevel   = entry.targetLevel     ?? 90
    const toAsc     = entry.targetAscension ?? 6

    // Check if there is any meaningful ascension/level goal
    const ascNoop = fromAsc === toAsc && fromLevel >= toLevel

    // Read talent goals
    const talentState = {
      normalFrom: entry.talents?.normal         ?? 1,
      normalTo:   entry.targetTalents?.normal   ?? 1,
      skillFrom:  entry.talents?.skill          ?? 1,
      skillTo:    entry.targetTalents?.skill    ?? 1,
      burstFrom:  entry.talents?.burst          ?? 1,
      burstTo:    entry.targetTalents?.burst    ?? 1,
    }
    const talentNoop =
      talentState.normalTo <= talentState.normalFrom &&
      talentState.skillTo  <= talentState.skillFrom  &&
      talentState.burstTo  <= talentState.burstFrom

    // Read weapon goals
    const weaponState = {
      equippedWeapon: entry.equippedWeapon,
      weaponFromLv:   entry.weaponLevel ?? 1,
      weaponToLv:     entry.targetWeaponLevel ?? 90,
      weaponFromAsc:  entry.weaponAscension ?? 0,
      weaponToAsc:    entry.targetWeaponAscension ?? 6,
    }
    const weaponNoop =
      !weaponState.equippedWeapon ||
      (weaponState.weaponFromAsc === weaponState.weaponToAsc &&
       weaponState.weaponFromLv >= weaponState.weaponToLv)

    if (ascNoop && talentNoop && weaponNoop) continue

    const character = CHAR_MAP[charName]
    if (!character) continue

    // ── Ascension / leveling costs ──────────────────────────────────────────
    let costs = null
    if (!ascNoop) {
      costs = calculateProgressionCost(character, fromLevel, fromAsc, toLevel, toAsc, costsData)
      if (costs.hasAnyCost) {
        totalMora     += costs.totalMora
        totalHeroWits += costs.heroWits
        merge(totalGemstones, costs.gemstones)
        merge(totalWorldBoss, costs.worldBoss)
        merge(totalLocal,     costs.localSpecialty)
        merge(totalMob,       costs.mob)
      } else {
        costs = null
      }
    }

    // ── Talent costs ─────────────────────────────────────────────────────────
    let talentCosts = null
    if (!talentNoop) {
      talentCosts = calculateAllTalentsCost(character, talentState)
      if (talentCosts.hasAnyCost) {
        totalMora    += talentCosts.talentMora
        totalCrowns  += talentCosts.crown
        merge(totalTalentBooks, talentCosts.books)
        merge(totalWeeklyBoss,  talentCosts.weeklyBoss)
        merge(totalMob,         talentCosts.mob)
      } else {
        talentCosts = null
      }
    }

    // ── Weapon costs ─────────────────────────────────────────────────────────
    let weaponCosts = null
    if (!weaponNoop && weaponState.equippedWeapon) {
      const wData = WEAPON_MAP[weaponState.equippedWeapon]
      weaponCosts = calculateWeaponCost(wData, weaponState.weaponFromLv, weaponState.weaponFromAsc, weaponState.weaponToLv, weaponState.weaponToAsc)
      if (weaponCosts && weaponCosts.hasAnyCost) {
        totalMora      += weaponCosts.weaponMora
        totalMysticOre += weaponCosts.mysticOre
        merge(totalWeaponAsc, weaponCosts.ascMats)
        merge(totalEliteMob,  weaponCosts.eliteMob)
        merge(totalMob,       weaponCosts.mob)
      } else {
        weaponCosts = null
      }
    }

    if (!costs && !talentCosts && !weaponCosts) continue

    breakdown.push({ name: charName, character, entry, costs, talentCosts, weaponCosts, talentState, weaponState })
  }

  return {
    totalMora,
    totalHeroWits,
    totalCrowns,
    totalMysticOre,
    gemstones:      totalGemstones,
    worldBoss:      totalWorldBoss,
    localSpecialty: totalLocal,
    mob:            totalMob,
    talentBooks:    totalTalentBooks,
    weeklyBoss:     totalWeeklyBoss,
    weaponAscMats:  totalWeaponAsc,
    eliteMob:       totalEliteMob,
    breakdown,
    trackedCount:   breakdown.length,
  }
}

/**
 * Subtract current inventory from the grand total to get what still needs
 * to be farmed. Only includes items where required > owned.
 */
export function computeToFarm(totals, inventory) {
  const inv = inventory || {}

  function delta(materialMap) {
    if (!materialMap || Object.keys(materialMap).length === 0) return []
    return Object.entries(materialMap)
      .map(([name, required]) => {
        const owned  = inv[name] || 0
        const toFarm = Math.max(0, required - owned)
        return { name, required, owned, toFarm }
      })
      .filter((item) => item.toFarm > 0)
      .sort((a, b) => b.toFarm - a.toFarm)
  }

  const gemsDelta    = delta(totals.gemstones)
  const bossDelta    = delta(totals.worldBoss)
  const localDelta   = delta(totals.localSpecialty)
  const mobDelta     = delta(totals.mob)
  const booksDelta   = delta(totals.talentBooks)
  const weeklyDelta  = delta(totals.weeklyBoss)
  const wAscDelta    = delta(totals.weaponAscMats)
  const eliteDelta   = delta(totals.eliteMob)

  const moraOwned  = inv['Mora']    || 0
  const witsOwned  = inv['HeroWit'] || 0
  const crownOwned = inv['Crown']   || 0
  const oreOwned   = inv[WEAPON_ORE_KEY] || 0
  
  const moraFarm   = Math.max(0, (totals.totalMora     || 0) - moraOwned)
  const witsFarm   = Math.max(0, (totals.totalHeroWits || 0) - witsOwned)
  const crownFarm  = Math.max(0, (totals.totalCrowns   || 0) - crownOwned)
  const oreFarm    = Math.max(0, (totals.totalMysticOre || 0) - oreOwned)

  const moraLine  = moraFarm  > 0 ? { required: totals.totalMora,     owned: moraOwned,  toFarm: moraFarm, name: 'Mora'  } : null
  const witsLine  = witsFarm  > 0 ? { required: totals.totalHeroWits, owned: witsOwned,  toFarm: witsFarm, name: 'HeroWit'  } : null
  const crownLine = crownFarm > 0 ? { required: totals.totalCrowns,   owned: crownOwned, toFarm: crownFarm, name: 'Crown' } : null
  const oreLine   = oreFarm   > 0 ? { required: totals.totalMysticOre, owned: oreOwned,  toFarm: oreFarm, name: WEAPON_ORE_KEY } : null

  const totalItems =
    (moraLine  ? 1 : 0) + (witsLine ? 1 : 0) + (crownLine ? 1 : 0) + (oreLine ? 1 : 0) +
    gemsDelta.length + bossDelta.length + localDelta.length + mobDelta.length +
    booksDelta.length + weeklyDelta.length + wAscDelta.length + eliteDelta.length

  return {
    mora:           moraLine,
    heroWits:       witsLine,
    crown:          crownLine,
    mysticOre:      oreLine,
    gemstones:      gemsDelta,
    worldBoss:      bossDelta,
    localSpecialty: localDelta,
    mob:            mobDelta,
    talentBooks:    booksDelta,
    weeklyBoss:     weeklyDelta,
    weaponAscMats:  wAscDelta,
    eliteMob:       eliteDelta,
    totalItems,
    allDone:        totalItems === 0,
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
  'BasaltPillar','CleansingHeart','CloudseamScale','CrystallineBloom',
  'CyclicMilitaryKuuvahkiCore','DewofRepudiation','DragonheirsFalseFin',
  'EmperorsResolution','EnsnaringGaze','EverflameSeed','EvergloomRing',
  'FontemerUnihorn','FragmentofaGoldenMelody','GoldInscribedSecretSourceCore',
  'HoarfrostCore','HurricaneSeed','JuvenileJade','LightGuidingTetrahedron',
  'LightbearingScaleFeather','LightningPrism','MajesticHookedBeak',
  'MarionetteCore','MarkoftheBindingBlessing','OverripeFlamegranate',
  'PerpetualCaliber','PerpetualHeart','PrecisionKuuvahkiStampingDie',
  'PseudoStamens','QuelledCreeper','RadiantAntler','RemnantoftheDreadwing',
  'RiftbornRegalia','RunicFang','SecretSourceAirflowAccumulator',
  'SmolderingPearl','SparklessStatueCore','StormBeads',
  'TalismanoftheEnigmaticLand','ThunderclapFruitcore','TourbillonDevice',
  'WaterThatFailedToTranscend',
]

export const LOCAL_SPECIALTY_MATS = [
  'AmakumoFruit','BerylConch','BrilliantChrysanthemum','CallaLily',
  'Cecilia','ClearwaterJade','CorLapis','CrystalMarrow','DandelionSeed',
  'Dendrobium','Dracolite','FluorescentFungus','FrostlampFlower',
  'GlazeLily','GlowingHornshroom','HennaBerry','JueyunChili',
  'KalpalataLotus','LakelightLily','LumidouceBell','Lumitoile',
  'MoonfallSilver','MourningFlower','NakuWeed','NilotpalaLotus',
  'NoctilucousJade','Onikabuto','Padisarah','PhilanemoMushroom',
  'PineAmber','PortableBearing','Qingxin','QuenepaBerry','RainbowRose',
  'RomaritimeFlower','RukkhashavaMushrooms','SakuraBloom','SandGreasePupa',
  'SangoPearl','SaurianClawSucculent','Scarab','SeaGanoderma',
  'SilkFlower','SkysplitGembloom','SmallLampGrass','SprayfeatherGill',
  'SpringoftheFirstDewdrop','Starconch','SubdetectionUnit','Trishiraite',
  'Valberry','Violetgrass','WindwheelAster','WinterIcelea',
  'WitheringPurpurbloom','Wolfhook',
]

// Mob base names (each generates 3 keys: base, base (Uncommon), base (Rare))
export const MOB_BASES = [
  'ClockworkMeka','Fatui','FatuiOprichniki','FontemerAberrant',
  'Fungi','Hilichurl','HilichurlShooter','Landcruisers',
  'NatlanSaurian','Nobushi','Samachurl','SauroformTribalWarriors',
  'Slime','Specters','TheEremites','TreasureHoarder','Whopperflower',
]

/** Expand a mob base into 3 keyed tier names */
export function getMobTierKeys(base) {
  return [base, `${base} (Uncommon)`, `${base} (Rare)`]
}

/** Expand a gemstone base into 4 keyed tier names */
export function getGemTierKeys(base) {
  return GEM_TIERS.map((t) => (t ? `${base}${t}` : base))
}
