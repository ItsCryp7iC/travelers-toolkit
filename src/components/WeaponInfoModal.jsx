import React, { useEffect, useRef } from 'react'
import { WEAPON_TYPES, formatName, getStars, getRarityClass, RARITY_COLORS } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getWeaponIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import { formatMaterialName } from '../utils/calculator'

export default function WeaponInfoModal({ weapon, onClose }) {
  const modalRef = useRef(null)
  const { name, rarity, type, materials } = weapon
  const displayName = formatName(name)
  const wpConfig = WEAPON_TYPES[type] || { emoji: '✨', label: 'Unknown' }
  const rarityClass = getRarityClass(rarity)
  const rarityColor = RARITY_COLORS[rarity] || '#C8A96E'

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
          <p className="text-[10px] text-[var(--muted)] font-semibold tracking-widest uppercase mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-[var(--text)] truncate">{formatMaterialName(value)}</p>
        </div>
      </div>
    )
  }

  const hasMaterials = materials && (materials.ascension_mat || materials.elite_mat || materials.mob_mat)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-[var(--elevated)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up border"
        style={{ borderColor: `${rarityColor}40` }}
      >
        {/* ── Header ── */}
        <header
          className="relative p-6 shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${rarityColor}40 0%, ${rarityColor}10 100%)` }}
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
                 style={{ borderColor: rarityColor, color: rarityColor, textShadow: `0 0 16px ${rarityColor}` }}>
              <GenshinImage 
                src={getWeaponIcon(name)} 
                alt={name} 
                className="w-full h-full object-cover absolute inset-0 z-10" 
                fallback={<span className="font-cinzel text-4xl relative z-10">{wpConfig.emoji}</span>} 
              />
            </div>
            <div>
              <h2 className="font-cinzel font-bold text-2xl text-[var(--text)] drop-shadow-md mb-1">{displayName}</h2>
              <div className="flex gap-2 items-center flex-wrap">
                <span className={`text-sm tracking-wide ${rarityClass} drop-shadow-md`}>{getStars(rarity)}</span>
                <span className="text-white/80 text-sm px-3 py-1 rounded-full bg-black/30 border border-white/20 flex items-center gap-1.5">
                  <GenshinImage src={getWeaponTypeIcon(type)} alt={type} className="w-6 h-6 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
                  <span>{type || 'Unknown'}</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
               style={{ background: `radial-gradient(circle at 80% 50%, ${rarityColor}, transparent 60%)` }} />
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div>
            <h3 className="font-cinzel font-bold text-lg mb-4 text-[var(--gold)] flex items-center gap-2">
              <span className="text-[var(--muted)] text-sm">🎒</span> Progression Materials
            </h3>
            
            {hasMaterials ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {renderMaterial('Weapon Ascension Material', materials?.ascension_mat, '✨')}
              {renderMaterial('Elite Enhancement Material', materials?.elite_mat, '🏵️')}
              {renderMaterial('Common Enhancement Material', materials?.mob_mat, '⚔️')}
            </div>
            ) : (
              <div className="text-center py-6 border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--muted)] text-sm">
                Material data for this weapon is currently unavailable.
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  )
}
