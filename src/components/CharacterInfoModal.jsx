import React, { useEffect, useRef } from 'react'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getCharacterAvatar, getElementIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import { formatMaterialName } from '../utils/calculator'

export default function CharacterInfoModal({ character, onClose }) {
  const modalRef = useRef(null)
  const { name, rarity, element, weapon_type, materials } = character
  const displayName = formatName(name)
  const elConfig = ELEMENTS[element] || ELEMENTS.Unknown
  const wpConfig = WEAPON_TYPES[weapon_type]

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const renderMaterial = (label, value, icon) => {
    if (!value || value === 'nan' || value === 'None') return null
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-[var(--surface)] border-[var(--border)]">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)] font-semibold tracking-widest uppercase mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-[var(--text)] truncate">{formatMaterialName(value)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-[var(--elevated)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up border"
        style={{ borderColor: `${elConfig.color}40` }}
      >
        {/* ── Header ── */}
        <header
          className="relative p-6 shrink-0 overflow-hidden"
          style={{ background: elConfig.avatarGradient }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors z-20"
          >
            ✕
          </button>

          <div className="relative z-10 flex gap-5 items-center">
            <div className="w-20 h-20 rounded-xl bg-black/20 flex items-center justify-center border-2 shadow-lg relative overflow-hidden"
                 style={{ borderColor: elConfig.color, color: elConfig.color, textShadow: `0 0 16px ${elConfig.color}` }}>
              <GenshinImage 
                src={getCharacterAvatar(name)} 
                alt={name} 
                className="w-full h-full object-cover absolute inset-0 z-10" 
                fallback={<span className="font-cinzel text-4xl relative z-10">{getInitials(name)}</span>} 
              />
            </div>
            <div>
              <h2 className="font-cinzel font-bold text-2xl text-white drop-shadow-md mb-1">{displayName}</h2>
              <div className="flex gap-2 items-center flex-wrap">
                <span className={`text-sm tracking-wide ${getRarityClass(rarity)} drop-shadow-md`}>{getStars(rarity)}</span>
                <span className="text-white/80 text-sm px-3 py-1 rounded-full bg-black/30 border border-white/20 flex items-center gap-1.5">
                  <GenshinImage src={getElementIcon(element)} alt={element} className="w-6 h-6 object-contain" fallback={<span>{elConfig.emoji}</span>} />
                  <span>{element}</span>
                </span>
                {wpConfig && (
                  <span className="text-white/80 text-sm px-3 py-1 rounded-full bg-black/30 border border-white/20 flex items-center gap-1.5">
                    <GenshinImage src={getWeaponTypeIcon(weapon_type)} alt={weapon_type} className="w-6 h-6 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
                    <span>{weapon_type}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
               style={{ background: `radial-gradient(circle at 80% 50%, ${elConfig.color}, transparent 60%)` }} />
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div>
            <h3 className="font-cinzel font-bold text-lg mb-4 text-[var(--gold)] flex items-center gap-2">
              <span className="text-[var(--muted)] text-sm">🎒</span> Progression Materials
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderMaterial('Character Ascension Gem', materials?.gemstone, '💎')}
              {renderMaterial('Normal Boss Material', materials?.world_boss, '🐉')}
              {renderMaterial('Weekly Boss Material', materials?.weekly_boss, '👑')}
              {renderMaterial('Talent Material', materials?.talent_book, '📖')}
              {renderMaterial('Local Specialty', materials?.local_specialty, '🌸')}
              {renderMaterial('Common Enhancement Material', materials?.mob_material, '⚔️')}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
