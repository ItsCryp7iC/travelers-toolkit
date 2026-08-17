import React from 'react'
import { WEAPON_TYPES, formatName, getStars, getRarityClass, RARITY_COLORS, getRarityBg } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getWeaponIcon, getWeaponTypeIcon } from '../utils/assetHelper'

export default function WeaponCard({ weapon, onClick }) {
  const { name, rarity, type } = weapon
  const wpConfig = WEAPON_TYPES[type] || { emoji: '✨', label: 'Unknown' }
  const displayName = formatName(name)
  const stars = getStars(rarity)
  const rarityClass = getRarityClass(rarity)
  const rarityColor = RARITY_COLORS[rarity] || '#C8A96E'

  return (
    <article
      className="char-card group"
      data-rarity={rarity}
      data-weapon={type}
      id={`weapon-card-${name.toLowerCase().replace(/\s+/g, '-')}`}
      aria-label={`${displayName} — ${type}`}
      onClick={() => onClick && onClick(weapon)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick && onClick(weapon) }}
    >
      {/* 🌟 Avatar / Rarity Gradient 🌟 */}
      <div
        className={`char-card-avatar rounded-t-[14px] relative ${getRarityBg(rarity)}`}
        style={{ 
          borderBottom: `2px solid ${rarityColor}`
        }}
      >
        {/* Decorative shimmer */}
        <div
          className="absolute inset-0 opacity-20 rounded-t-[14px]"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${rarityColor}, transparent 70%)`,
          }}
        />

        {/* Weapon Image / Fallback Type Emoji */}
        <GenshinImage 
          src={getWeaponIcon(name)}
          alt={displayName}
          className="w-full h-full object-contain absolute inset-0 z-10 rounded-t-[14px] p-2"
          fallback={
            <span
              className="relative z-10 select-none font-cinzel text-4xl"
              style={{
                color: rarityColor,
                textShadow: `0 0 24px ${rarityColor}`,
              }}
            >
              {wpConfig.emoji}
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
      <div className="char-card-body pb-4">
        {/* Name */}
        <h3
          className="font-cinzel font-semibold text-[var(--text)] leading-tight mb-2 truncate"
          style={{ fontSize: displayName.length > 14 ? '11px' : '13px' }}
          title={displayName}
        >
          {displayName}
        </h3>

        {/* Weapon badge */}
        <div className="flex flex-wrap gap-1 mb-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] bg-[var(--elevated)]">
            <GenshinImage src={getWeaponTypeIcon(type)} alt={type} className="w-3 h-3 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
            <span>{type || 'Unknown'}</span>
          </span>
        </div>
      </div>
    </article>
  )
}
