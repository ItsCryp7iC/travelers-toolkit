import React, { useState } from 'react'
import useStore from '../store/useStore'
import CharacterModal from './CharacterModal'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import weaponsData from '../data/weapons.json'
import GenshinImage from './GenshinImage'
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon } from '../utils/assetHelper'

/**
 * CharacterCard
 * Displays a character's element-gradient avatar, name, rarity stars,
 * element badge, and weapon type badge.
 *
 * Clicking the card opens the CharacterModal for detailed progression planning.
 * The "Add / Remove" button toggles roster membership without opening the modal.
 */
export default function CharacterCard({ character, hideRoster = false, onClick }) {
  const { name, rarity, element, weapon_type } = character
  const [modalOpen, setModalOpen] = useState(false)

  const addCharacter    = useStore((s) => s.addCharacter)
  const removeCharacter = useStore((s) => s.removeCharacter)
  const inRoster        = useStore((s) => Boolean(s.roster[name]))
  const rosterEntry     = useStore((s) => s.roster[name])
  const trackedWeapons  = useStore((s) => s.trackedWeapons)

  const equippedWeapon  = rosterEntry?.equippedWeaponId
    ? trackedWeapons.find((w) => w.id === rosterEntry.equippedWeaponId)
    : null
  const equippedWeaponData = equippedWeapon
    ? weaponsData.find((w) => w.name === equippedWeapon.weaponName)
    : null
  const equippedWpConfig = equippedWeaponData ? (WEAPON_TYPES[equippedWeaponData.type] || null) : null

  const elConfig    = ELEMENTS[element] || ELEMENTS.Unknown
  const wpConfig    = WEAPON_TYPES[weapon_type]
  const displayName = formatName(name)
  const initials    = getInitials(name)
  const stars       = getStars(rarity)
  const rarityClass = getRarityClass(rarity)

  const handleToggleRoster = (e) => {
    e.stopPropagation()
    inRoster ? removeCharacter(name) : addCharacter(name)
  }

  const handleCardClick = () => {
    if (onClick) onClick(character)
    else setModalOpen(true)
  }

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

        {/* ── Weapon equipped badge ── */}
        {!hideRoster && inRoster && equippedWpConfig && (
          <div
            className="absolute top-2 left-2 z-10 text-xs rounded-full px-1 py-0.5 bg-black/50 border border-white/20 leading-none"
            title={`Equipped: ${equippedWeapon?.weaponName}`}
          >
            <GenshinImage 
              src={getWeaponIcon(equippedWeapon.weaponName)} 
              alt={equippedWeapon.weaponName}
              className="w-4 h-4 object-contain"
              fallback={equippedWpConfig.emoji} 
            />
          </div>
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
            <span className="text-xs font-semibold text-white">View Details</span>
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
            className="font-semibold text-[var(--text)] leading-tight mb-2 truncate"
            style={{ fontSize: displayName.length > 14 ? '11px' : '13px' }}
            title={displayName}
          >
            {displayName}
          </h3>

          {/* Element + Weapon badges */}
          <div className="flex flex-wrap gap-1 mb-3">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] bg-[var(--elevated)]">
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
              className="w-full text-xs font-semibold py-1.5 rounded-lg transition-all duration-200"
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

      {/* ── Character Detail Modal ── */}
      {modalOpen && (
        <CharacterModal
          character={character}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
