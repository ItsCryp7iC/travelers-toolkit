/**
 * aggregator.js — Grand-total resource calculator across entire tracked roster
 *
 * Usage:
 *   import { aggregateRosterCosts, computeToFarm } from './aggregator'
 */

import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import costsData from '../data/costs.json'
import { calculateProgressionCost, calculateTalentCost, calculateAllTalentsCost, calculateWeaponCost, WEAPON_ORE_KEY } from './calculator'

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
  const grandTotalCosts = {}
  const breakdown = []

  for (const [charName, entry] of Object.entries(roster)) {
    const fromLevel = entry.level           ?? 1
    const fromAsc   = entry.ascension       ?? 0
    const toLevel   = entry.targetLevel     ?? 90
    const toAsc     = entry.targetAscension ?? 6

    const ascNoop = fromAsc === toAsc && fromLevel >= toLevel

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

    let weaponCosts = null
    if (!weaponNoop && weaponState.equippedWeapon) {
      const wData = WEAPON_MAP[weaponState.equippedWeapon]
      weaponCosts = calculateWeaponCost(wData, weaponState.weaponFromLv, weaponState.weaponToLv)
    }

    const totalCosts = {}
    const allCostObjects = [ascCosts, normalCosts, skillCosts, burstCosts, weaponCosts]
    
    allCostObjects.forEach(costObj => {
      if (!costObj) return
      Object.entries(costObj).forEach(([key, val]) => {
        if (typeof val === 'number' && val > 0) {
          totalCosts[key] = (totalCosts[key] || 0) + val
          grandTotalCosts[key] = (grandTotalCosts[key] || 0) + val
        }
      })
    })

    if (Object.values(totalCosts).some(val => val > 0)) {
      breakdown.push({ name: charName, character, entry, totalCosts, talentState, weaponState })
    }
  }

  return {
    totalCosts: grandTotalCosts,
    breakdown,
    trackedCount: breakdown.length,
  }
}

export function computeToFarm(totals, inventory) {
  const inv = inventory || {}
  const totalCosts = totals.totalCosts || {}

  const allItems = Object.entries(totalCosts)
    .map(([name, required]) => {
      const owned = inv[name] || 0
      const toFarm = Math.max(0, required - owned)
      return { name, required, owned, toFarm }
    })
    .filter(item => item.toFarm > 0)
    .sort((a, b) => b.toFarm - a.toFarm)

  const filterKeys = (keys) => allItems.filter(item => keys.includes(item.name))

  return {
    mora: allItems.find(i => i.name === 'mora'),
    heroWits: allItems.find(i => i.name === 'heros_wit'),
    crown: allItems.find(i => i.name === 'crown'),
    mysticOre: allItems.find(i => i.name === 'mystic_ore'),
    stellaFortuna: allItems.find(i => i.name === 'masterless_stella_fortuna'),
    gemstones: filterKeys(['gem_silver', 'gem_fragment', 'gem_chunk', 'gem_gemstone']),
    worldBoss: filterKeys(['boss_material']),
    localSpecialty: filterKeys(['local_specialty']),
    mob: filterKeys(['1_star_enemy_material', '2_star_enemy_material', '3_star_enemy_material']),
    talentBooks: filterKeys(['2_star_talent_material', '3_star_talent_material', '4_star_talent_material']),
    weeklyBoss: filterKeys(['weekly_boss_material']),
    weaponAscMats: filterKeys(['2_star_ascension_material', '3_star_ascension_material', '4_star_ascension_material', '5_star_ascension_material']),
    eliteMob: filterKeys(['2_star_enhancement_material', '3_star_enhancement_material', '4_star_enhancement_material']),
    totalItems: allItems.length,
    allDone: allItems.length === 0,
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
