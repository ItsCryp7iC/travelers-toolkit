import React, { useMemo } from 'react'
import useStore from '../store/useStore'
import { WEAPON_TYPES, formatName, getStars, getRarityClass, RARITY_COLORS } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getWeaponIcon, getWeaponTypeIcon, getMaterialIcon, toPascalCase, getCharacterAvatar } from '../utils/assetHelper'
import { calculateWeaponCost, formatNumber, formatItemName } from '../utils/calculator'
import { calculateForgingCost } from '../utils/aggregator'
import { resolveSpecificItem } from '../utils/resolver'
import weaponForgingData from '../data/weapon_forging.json'

export default function WeaponCard({ weapon, onClick }) {
  const { name, rarity, type } = weapon
  const wpConfig = WEAPON_TYPES[type] || { emoji: '✨', label: 'Unknown' }
  const displayName = formatName(name)
  
  const inArmory = useStore((s) => Boolean(s.trackedWeapons.some(w => w.weaponName === name)))
  // We'll just grab the FIRST entry of this weapon if there are multiple. 
  // (Assuming armory cards represent the weapon type, but could show first instance's progress)
  const armoryEntry = useStore((s) => s.trackedWeapons.find(w => w.weaponName === name))
  const inventory = useStore((s) => s.inventory)
  
  // Find who has this equipped
  const roster = useStore((s) => s.roster)
  const equippedBy = useMemo(() => {
    if (!armoryEntry) return null;
    return Object.entries(roster).find(([charName, entry]) => entry.equippedWeaponId === armoryEntry.id)?.[0]
  }, [roster, armoryEntry])

  const getRarityGradient = (r) => {
    switch (Number(r)) {
      case 5: return 'from-amber-500/10'; // Gold
      case 4: return 'from-purple-500/10'; // Purple
      case 3: return 'from-blue-500/10'; // Blue
      case 2: return 'from-green-500/10'; // Green
      case 1: return 'from-gray-500/10'; // Gray
      default: return 'from-white/5';
    }
  }

  const getSortWeight = (matId, category) => {
    const catWeight = {
      'experience': 1, 'weaponAscMats': 2, 'eliteMob': 3, 'mob': 4, 'Crafting Material': 5
    }[category] || 99;
    let tierWeight = 0;
    if (matId.includes('1_star')) tierWeight = 1;
    else if (matId.includes('2_star')) tierWeight = 2;
    else if (matId.includes('3_star')) tierWeight = 3;
    else if (matId.includes('4_star')) tierWeight = 4;
    else if (matId.includes('5_star')) tierWeight = 5;
    return catWeight * 100 + tierWeight;
  }

  const { totalCosts, categories } = useMemo(() => {
    if (!inArmory || !armoryEntry) return { totalCosts: null, categories: null }

    const fromLevel = armoryEntry.level ?? 1
    const fromAsc = armoryEntry.ascension ?? 0
    const toLevel = armoryEntry.targetLevel ?? 90
    const toAsc = armoryEntry.targetAscension ?? 6
    
    const fromRef = armoryEntry.refinement ?? 1
    const toRef = armoryEntry.targetRefinement ?? 1

    const ascNoop = fromAsc === toAsc && fromLevel >= toLevel
    const refNoop = toRef <= fromRef

    if (ascNoop && refNoop) return { totalCosts: {}, categories: {} }

    let ascCosts = null
    if (!ascNoop) ascCosts = calculateWeaponCost(weapon, fromLevel, toLevel)

    let refCosts = null
    if (!refNoop) {
      const forgeRecipe = weaponForgingData[name]
      if (forgeRecipe) {
        refCosts = calculateForgingCost(weapon, fromRef, toRef, weaponForgingData)
      }
    }

    const costs = {}
    const cats = {}
    const processCosts = (costObj) => {
      if (!costObj) return
      Object.entries(costObj).forEach(([key, val]) => {
        if (key === 'totalExp' || key === 'normalOre' || key === 'fineOre' || key === 'wastedExp' || key === 'expToNextLevel') return;
        if (typeof val === 'number' && val > 0) {
          let resolvedKey = key;
          if (key === 'totalMora') resolvedKey = 'mora';
          if (key === 'mysticOre') resolvedKey = 'mystic_enhancement_ore';

          const resolved = resolveSpecificItem(resolvedKey, null, weapon);
          const finalId = resolved.id;
          costs[finalId] = (costs[finalId] || 0) + val
          cats[finalId] = resolved.category
        }
      })
    }

    processCosts(ascCosts)
    processCosts(refCosts)

    return { totalCosts: costs, categories: cats }
  }, [inArmory, armoryEntry, weapon])

  return (
    <article
      className={`bg-gradient-to-br ${getRarityGradient(rarity)} to-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden transition-colors hover:border-[var(--gold)]/50 group cursor-pointer h-full`}
      onClick={() => onClick && onClick(weapon)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick && onClick(weapon) }}
    >
      {/* Decorative element shimmer */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 30%, ${RARITY_COLORS[rarity]}, transparent 70%)` }}
      />



      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[var(--gold)] bg-[var(--surface)] flex-shrink-0 relative">
          <GenshinImage 
            src={getWeaponIcon(name)} 
            alt={displayName}
            className="w-full h-full object-cover relative z-10 p-1"
            fallback={
              <span className="relative z-10 select-none text-[var(--gold)] text-xl flex items-center justify-center w-full h-full">
                {wpConfig.emoji}
              </span>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[var(--text)] text-sm truncate font-bold">{displayName}</h3>
          {inArmory && totalCosts ? (
             <p className="text-xs text-[var(--gold)] tracking-wider">Mora: {formatNumber(totalCosts?.mora || 0)}</p>
          ) : (
             <div className="flex flex-wrap gap-1 mt-1">
                <span className={`text-xs tracking-wide leading-none ${getRarityClass(rarity)}`}>{getStars(rarity)}</span>
             </div>
          )}
        </div>
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {inArmory && equippedBy && (
              <div
                className="w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center overflow-hidden"
                title={`Equipped by: ${formatName(equippedBy)}`}
              >
                <GenshinImage 
                  src={getCharacterAvatar(equippedBy)} 
                  alt={equippedBy}
                  className="w-full h-full object-cover"
                  fallback={<span className="text-xs">{formatName(equippedBy).charAt(0)}</span>}
                />
              </div>
            )}
            {weapon.type && (
              <div
                className="w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center p-1.5"
                title={weapon.type}
              >
                <GenshinImage 
                  src={getWeaponTypeIcon(weapon.type)} 
                  alt={weapon.type} 
                  className="w-full h-full object-contain opacity-80" 
                  fallback={<span>{wpConfig.emoji}</span>}
                />
              </div>
            )}
          </div>
      </div>

      {/* State Block */}
      {inArmory && armoryEntry ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/20 p-2 rounded-lg border border-white/5">
            <p className="text-xs text-[var(--muted)] mb-0.5 uppercase tracking-wider">Level</p>
            <p className="text-gray-200 truncate">
              Lv. {armoryEntry.level ?? 1} 
              <span className="text-[var(--gold)] mx-1">→</span> 
              {armoryEntry.targetLevel ?? 90}
            </p>
          </div>
          <div className="bg-black/20 p-2 rounded-lg border border-white/5">
            <p className="text-xs text-[var(--muted)] mb-0.5 uppercase tracking-wider">Refine</p>
            <p className="text-gray-200 truncate">
              R{armoryEntry.refinement ?? 1}
              <span className="text-[var(--gold)] mx-1">→</span>
              R{armoryEntry.targetRefinement ?? 1}
            </p>
          </div>
        </div>
      ) : (
         <div className="flex-1 flex items-center justify-center py-2 text-xs text-[var(--muted)] italic border border-dashed border-white/10 rounded-lg">
           Not in armory
         </div>
      )}

      {/* Materials Block */}
      {inArmory && totalCosts && (
        <div className="border-t border-white/5 pt-2 flex-1 flex flex-col">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Required Materials</p>
          {Object.keys(totalCosts || {}).length === 0 ? (
            <p className="text-xs text-[var(--gold)] italic mt-auto mb-auto">Maxed out! 🎉</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(totalCosts)
                .filter(([matId, qty]) => qty > 0 && matId !== 'mora')
                .sort(([idA], [idB]) => {
                  const weightA = getSortWeight(idA, categories[idA]);
                  const weightB = getSortWeight(idB, categories[idB]);
                  if (weightA === weightB) return idA.localeCompare(idB);
                  return weightA - weightB;
                })
                .slice(0, 10) // Display cap if there are too many items to prevent huge cards
                .map(([matId, qty]) => {
                  const owned = inventory[matId] || 0;
                  const toFarm = Math.max(0, qty - owned);
                  
                  return (
                    <div key={matId} className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-black/30 border border-white/5 relative group/mat hover:border-primary/30 transition-colors">
                      <img 
                        src={getMaterialIcon(matId, categories[matId])} 
                        alt={formatItemName(matId)} 
                        className="w-8 h-8 object-contain mb-1 drop-shadow-md"
                        title={`${formatItemName(matId)}\nNeeded: ${toFarm} (Total: ${qty})`}
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                      />
                      <span className="hidden text-sm mb-1" title={formatItemName(matId)}>📦</span>
                      
                      <span className={`text-xs font-semibold leading-tight ${toFarm === 0 ? 'text-[#4ADE80]' : 'text-gray-300'}`}>
                        {toFarm === 0 ? '✅' : `×${formatNumber(toFarm)}`}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
