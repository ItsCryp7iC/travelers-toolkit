import React, { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import CharacterModal from './CharacterModal'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import weaponsData from '../data/weapons.json'
import GenshinImage from './GenshinImage'
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon, getMaterialIcon, toPascalCase } from '../utils/assetHelper'
import { calculateProgressionCost, calculateTalentCost, formatNumber, formatItemName } from '../utils/calculator'
import { resolveSpecificItem } from '../utils/resolver'
import { getTravelerAwareWeaponId } from '../utils/travelerHelper'

/**
 * CharacterCard (Rich Layout)
 */
export default function CharacterCard({ character, hideRoster = false, onClick, variant = 'detailed' }) {
  const { name, rarity, element, weapon_type } = character
  const [modalOpen, setModalOpen] = useState(false)

  const addCharacter = useStore((s) => s.addCharacter)
  const removeCharacter = useStore((s) => s.removeCharacter)
  const inRoster = useStore((s) => Boolean(s.roster[name]))
  const rosterEntry = useStore((s) => s.roster[name])
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const inventory = useStore((s) => s.inventory)

  const awareWeaponId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
  const equippedWeapon = awareWeaponId
    ? trackedWeapons.find((w) => w.id === awareWeaponId)
    : null
  const equippedWeaponData = equippedWeapon
    ? weaponsData.find((w) => w.name === equippedWeapon.weaponName)
    : null
  const equippedWpConfig = equippedWeaponData ? (WEAPON_TYPES[equippedWeaponData.type] || null) : null

  const elConfig = ELEMENTS[element] || ELEMENTS.Unknown
  const wpConfig = WEAPON_TYPES[weapon_type]
  const displayName = formatName(name)
  const avatarUrl = getCharacterAvatar(name)

  const handleToggleRoster = (e) => {
    e.stopPropagation()
    inRoster ? removeCharacter(name) : addCharacter(name)
  }

  const handleCardClick = () => {
    if (onClick) onClick(character)
    else setModalOpen(true)
  }

  const getElementGradient = (el) => {
    switch (el?.toLowerCase()) {
      case 'pyro': return 'from-red-500/10'
      case 'hydro': return 'from-blue-500/10'
      case 'anemo': return 'from-teal-400/10'
      case 'electro': return 'from-purple-500/10'
      case 'dendro': return 'from-green-500/10'
      case 'cryo': return 'from-cyan-400/10'
      case 'geo': return 'from-yellow-500/10'
      default: return 'from-white/5'
    }
  }

  const getSortWeight = (matId, category) => {
    const catWeight = {
      'experience': 1, 'heroWits': 1, 'localSpecialty': 2, 'gemstones': 3,
      'worldBoss': 4, 'mob': 5, 'talentBooks': 6, 'weeklyBoss': 7, 'crown': 8,
    }[category] || 99;
    let tierWeight = 0;
    if (category === 'gemstones') {
      if (matId.includes('sliver')) tierWeight = 1;
      else if (matId.includes('fragment')) tierWeight = 2;
      else if (matId.includes('chunk')) tierWeight = 3;
      else if (matId.includes('gemstone')) tierWeight = 4;
    } else if (matId.includes('1_star')) {
      tierWeight = 1;
    } else if (matId.includes('2_star')) {
      tierWeight = 2;
    } else if (matId.includes('3_star')) {
      tierWeight = 3;
    } else if (matId.includes('4_star')) {
      tierWeight = 4;
    } else if (matId.includes('5_star')) {
      tierWeight = 5;
    } else if (category === 'talentBooks') {
      const match = matId.match(/(\d)_star/);
      if (match) tierWeight = parseInt(match[1]);
    }
    return catWeight * 100 + tierWeight;
  }

  const { totalCosts, categories, talentState } = useMemo(() => {
    if (!inRoster || !rosterEntry) return { totalCosts: null, categories: null, talentState: null }

    const fromLevel = rosterEntry.level ?? 1
    const fromAsc = rosterEntry.ascension ?? 0
    const toLevel = rosterEntry.targetLevel ?? 90
    const toAsc = rosterEntry.targetAscension ?? 6

    const ascNoop = fromAsc === toAsc && fromLevel >= toLevel

    const tState = {
      normalFrom: rosterEntry.talents?.normal ?? 1,
      normalTo: rosterEntry.targetTalents?.normal ?? 1,
      skillFrom: rosterEntry.talents?.skill ?? 1,
      skillTo: rosterEntry.targetTalents?.skill ?? 1,
      burstFrom: rosterEntry.talents?.burst ?? 1,
      burstTo: rosterEntry.targetTalents?.burst ?? 1,
    }
    const talentNoop = tState.normalTo <= tState.normalFrom && tState.skillTo <= tState.skillFrom && tState.burstTo <= tState.burstFrom

    if (ascNoop && talentNoop) return { totalCosts: {}, categories: {}, talentState: tState }

    let ascCosts = null
    if (!ascNoop) ascCosts = calculateProgressionCost(character, fromLevel, toLevel)

    let normalCosts = null, skillCosts = null, burstCosts = null
    if (!talentNoop) {
      normalCosts = calculateTalentCost(character, tState.normalFrom, tState.normalTo)
      skillCosts = calculateTalentCost(character, tState.skillFrom, tState.skillTo)
      burstCosts = calculateTalentCost(character, tState.burstFrom, tState.burstTo)
    }

    const costs = {}
    const cats = {}
    const processCosts = (costObj, isAscension = false) => {
      if (!costObj) return
      Object.entries(costObj).forEach(([key, val]) => {
        if (typeof val === 'number' && val > 0) {
          const resolved = resolveSpecificItem(key, character, null, isAscension);
          const finalId = resolved.id;
          costs[finalId] = (costs[finalId] || 0) + val
          cats[finalId] = resolved.category
        }
      })
    }

    processCosts(ascCosts, true)
    processCosts(normalCosts, false)
    processCosts(skillCosts, false)
    processCosts(burstCosts, false)

    return { totalCosts: costs, categories: cats, talentState: tState }
  }, [inRoster, rosterEntry, character])

  const initials = getInitials(name)
  const stars = getStars(rarity)
  const rarityClass = getRarityClass(rarity)

  if (variant === 'compact') {
    return (
      <>
        <article
          className="char-card group"
          data-element={element}
          data-rarity={rarity}
          data-weapon={weapon_type}
          id={`char-card-${name.toLowerCase().replace(/\s+/g, '-')}`}
          aria-label={`${displayName} — ${element} ${weapon_type}`}
          onClick={handleCardClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
        >
          {/* ── Roster Badge ── */}
          {!hideRoster && inRoster && (
            <div className="roster-badge" title="In your roster">✓</div>
          )}

          {/* ── Avatar / Element Gradient ── */}
          <div
            className="char-card-avatar"
            style={{ background: elConfig.avatarGradient }}
          >
            {/* Decorative element shimmer */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${elConfig.color}, transparent 70%)`,
              }}
            />

            {/* Avatar Image / Fallback Initials */}
            <GenshinImage
              src={getCharacterAvatar(name)}
              alt={displayName}
              className="w-full h-full object-cover absolute inset-0 z-10 rounded-t-[14px]"
              fallback={
                <span
                  className="relative z-10 select-none"
                  style={{
                    color: elConfig.color,
                    textShadow: `0 0 24px ${elConfig.color}`,
                    fontSize: name.length > 10 ? '1.6rem' : '2.2rem',
                  }}
                >
                  {initials}
                </span>
              }
            />

            {/* View details hint on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded-t-[14px]"
                 style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
              <span className="text-xs text-white">View Details</span>
            </div>

            {/* Rarity corner ribbon */}
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 flex justify-between items-end z-10">
              <span className={`text-xs tracking-wide leading-none ${rarityClass}`}>{stars}</span>
            </div>
          </div>

          {/* ── Card Body ── */}
          <div className="char-card-body">
            {/* Name */}
            <h3
              className=" text-[var(--text)] leading-tight mb-2 truncate"
              style={{ fontSize: displayName.length > 14 ? '11px' : '13px' }}
              title={displayName}
            >
              {displayName}
            </h3>

            {/* Element + Weapon badges */}
            <div className="flex flex-wrap gap-1 mb-3">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
                style={{
                  background: elConfig.colorDim,
                  borderColor: elConfig.color + '60',
                  color: elConfig.color,
                }}
              >
                <GenshinImage src={getElementIcon(element)} alt={element} className="w-3 h-3 object-contain" fallback={<span>{elConfig.emoji}</span>} />
                <span>{element}</span>
              </span>

              {wpConfig && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] bg-[var(--elevated)]">
                  <GenshinImage src={getWeaponTypeIcon(weapon_type)} alt={weapon_type} className="w-3 h-3 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
                  <span>{weapon_type}</span>
                </span>
              )}
            </div>

            {/* Add / Remove Roster Button */}
            {!hideRoster && (
              <button
                id={`roster-btn-${name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={handleToggleRoster}
                className="w-full text-xs py-1.5 rounded-lg transition-all duration-200"
                style={
                  inRoster
                    ? {
                        background: 'rgba(200,169,110,0.12)',
                        border: '1px solid rgba(200,169,110,0.4)',
                        color: 'var(--gold)',
                      }
                    : {
                        background: elConfig.colorDim,
                        border: `1px solid ${elConfig.color}40`,
                        color: elConfig.color,
                      }
                }
                onMouseEnter={(e) => {
                  if (inRoster) {
                    e.currentTarget.textContent = '✕ Remove'
                    e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'
                    e.currentTarget.style.color = '#EF4444'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.textContent = inRoster ? '✓ In Roster' : '+ Add to Roster'
                  if (inRoster) {
                    e.currentTarget.style.background = 'rgba(200,169,110,0.12)'
                    e.currentTarget.style.borderColor = 'rgba(200,169,110,0.4)'
                    e.currentTarget.style.color = 'var(--gold)'
                  } else {
                    e.currentTarget.style.background = elConfig.colorDim
                    e.currentTarget.style.borderColor = elConfig.color + '40'
                    e.currentTarget.style.color = elConfig.color
                  }
                }}
              >
                {inRoster ? '✓ In Roster' : '+ Add to Roster'}
              </button>
            )}
          </div>
        </article>

        {modalOpen && (
          <CharacterModal
            character={character}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <article
        className={`bg-gradient-to-br ${getElementGradient(element)} to-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden transition-colors hover:border-[var(--gold)]/50 group cursor-pointer h-full`}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
      >
        {/* Decorative element shimmer */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 30%, ${elConfig.color}, transparent 70%)` }}
        />



        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[var(--gold)] bg-[var(--surface)] flex-shrink-0 relative">
            <GenshinImage 
              src={avatarUrl} 
              alt={displayName}
              className="w-full h-full object-cover relative z-10"
              fallback={
                <span className="relative z-10 select-none text-[var(--gold)] text-xl flex items-center justify-center w-full h-full">
                  {getInitials(name)}
                </span>
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[var(--text)] text-sm truncate font-bold">{displayName}</h3>
            {inRoster && totalCosts ? (
               <p className="text-xs text-[var(--gold)] tracking-wider">Mora: {formatNumber(totalCosts?.mora || 0)}</p>
            ) : (
               <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`text-xs tracking-wide leading-none ${getRarityClass(rarity)}`}>{getStars(rarity)}</span>
               </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {!hideRoster && inRoster && equippedWeapon && equippedWpConfig && (
              <div
                className="w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center p-1.5"
                title={`Equipped: ${equippedWeapon.weaponName}`}
              >
                <GenshinImage 
                  src={getWeaponIcon(equippedWeapon.weaponName)} 
                  alt={equippedWeapon.weaponName}
                  className="w-full h-full object-contain"
                  fallback={equippedWpConfig.emoji} 
                />
              </div>
            )}
            {character?.element && (
              <div
                className="w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center p-1.5"
                title={character.element}
              >
                <GenshinImage 
                  src={getElementIcon(element)} 
                  alt={character.element} 
                  className="w-full h-full object-contain opacity-80" 
                  fallback={<span>{elConfig.emoji}</span>}
                />
              </div>
            )}
          </div>
        </div>

        {/* State Block */}
        {inRoster && rosterEntry ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/20 p-2 rounded-lg border border-white/5">
              <p className="text-xs text-[var(--muted)] mb-0.5 uppercase tracking-wider">Level</p>
              <p className="text-gray-200 truncate">
                Lv. {rosterEntry.level ?? 1} 
                <span className="text-[var(--gold)] mx-1">→</span> 
                {rosterEntry.targetLevel ?? 90}
              </p>
            </div>
            <div className="bg-black/20 p-2 rounded-lg border border-white/5">
              <p className="text-xs text-[var(--muted)] mb-0.5 uppercase tracking-wider">Talents</p>
              {talentState ? (
                <p className="text-gray-200 text-xs truncate">
                  {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}
                  <span className="text-[var(--gold)] mx-0.5">→</span>
                  {talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
                </p>
              ) : (
                <p className="text-gray-500 text-xs">Maxed</p>
              )}
            </div>
          </div>
        ) : (
           <div className="flex-1 flex items-center justify-center py-2 text-xs text-[var(--muted)] italic border border-dashed border-white/10 rounded-lg">
             Not in roster
           </div>
        )}

        {/* Materials Block */}
        {inRoster && totalCosts && (
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

        {/* Add / Remove Roster Button */}
        {!hideRoster && (
          <div className="mt-auto pt-2">
            <button
              onClick={handleToggleRoster}
              className="w-full text-xs py-1.5 rounded-lg transition-all duration-200 font-semibold"
              style={
                inRoster
                  ? {
                      background: 'rgba(200,169,110,0.12)',
                      border: '1px solid rgba(200,169,110,0.4)',
                      color: 'var(--gold)',
                    }
                  : {
                      background: elConfig.colorDim,
                      border: `1px solid ${elConfig.color}40`,
                      color: elConfig.color,
                    }
              }
              onMouseEnter={(e) => {
                if (inRoster) {
                  e.currentTarget.textContent = '✕ Remove'
                  e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'
                  e.currentTarget.style.color = '#EF4444'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.textContent = inRoster ? '✓ In Roster' : '+ Add to Roster'
                if (inRoster) {
                  e.currentTarget.style.background = 'rgba(200,169,110,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(200,169,110,0.4)'
                  e.currentTarget.style.color = 'var(--gold)'
                } else {
                  e.currentTarget.style.background = elConfig.colorDim
                  e.currentTarget.style.borderColor = elConfig.color + '40'
                  e.currentTarget.style.color = elConfig.color
                }
              }}
            >
              {inRoster ? '✓ In Roster' : '+ Add to Roster'}
            </button>
          </div>
        )}
      </article>

      {modalOpen && (
        <CharacterModal
          character={character}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
