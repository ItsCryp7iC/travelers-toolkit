import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import weaponsData from '../data/weapons.json'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getStars, getRarityClass, getRarityBg, getWeaponTheme } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import CustomSelect from './CustomSelect'
import { getWeaponIcon, getCharacterAvatar, getWeaponTypeIcon } from '../utils/assetHelper'
import { clampLevel, getLevelRange, ASCENSION_CAPS } from '../utils/calculator'

function AscensionSelector({ value, onChange, label, elementColor, minValid = 0 }) {
  const getPhaseMax = (a) => a === 6 ? 90 : ASCENSION_CAPS[a];
  
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
        {label}
      </p>
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label={label}>
        {[0, 1, 2, 3, 4, 5, 6].map((a) => {
          const disabled = a < minValid;
          return (
            <button
              key={a}
              disabled={disabled}
              onClick={() => onChange(a)}
              title={`A${a} — Max Lv${getPhaseMax(a)}`}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all duration-150 border ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              style={
                value === a
                  ? { background: `${elementColor}25`, borderColor: elementColor, color: elementColor, boxShadow: `0 0 12px ${elementColor}40` }
                  : { background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }
              }
            >
              {a}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-[var(--muted)] mt-1">
        Max Level: <span style={{ color: elementColor }}>Lv{getPhaseMax(value)}</span>
      </p>
    </div>
  )
}

function LevelSlider({ value, onChange, ascension, label, elementColor, minOverride }) {
  const range = getLevelRange(ascension)
  const min = minOverride !== undefined ? Math.max(range.min, minOverride) : range.min
  const max = Math.min(range.max, 90)
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <label className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">
          {label}
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold font-cinzel leading-none" style={{ color: elementColor }}>
            {value}
          </span>
          <span className="text-[10px] text-[var(--muted)]">/ {max}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="level-slider w-full"
        style={{ '--slider-color': elementColor, '--pct': `${pct}%` }}
      />
    </div>
  )
}

const ALL_TYPES     = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES  = ['All', '🟡 5★', '🟣 4★', '🔵 3★', '🟢 2★', '⚪ 1★']
const LEVEL_MAX     = 90
const ASC_MAX       = 6

export default function AddWeaponModal({ onClose, existingWeapon = null, initialWeapon = null, onNext, onPrev, hasNext, hasPrev, slideDirection = 'next', currentIndex }) {
  const roster         = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const addTrackedWeapon = useStore((s) => s.addTrackedWeapon)
  const updateTrackedWeapon = useStore((s) => s.updateTrackedWeapon)

  const modalRef = useRef(null)

  // Step 1 state
  const [step, setStep]                   = useState((existingWeapon || initialWeapon) ? 2 : 1) // 1=Select, 2=Configure
  const [selectedWeapon, setSelectedWeapon] = useState(existingWeapon ? existingWeapon.data : (initialWeapon || null))
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('All')
  const [rarityFilter, setRarityFilter]   = useState('All')

  // Step 2 state
  const [level,          setLevel]          = useState(existingWeapon ? existingWeapon.level : 1)
  const [ascension,      setAscension]      = useState(existingWeapon ? existingWeapon.ascension : 0)
  const [targetLevel,    setTargetLevel]    = useState(existingWeapon ? existingWeapon.targetLevel : 90)
  const [targetAscension, setTargetAscension] = useState(existingWeapon ? (existingWeapon.targetAscension ?? 6) : 6)
  const [assignedTo,     setAssignedTo]     = useState(existingWeapon ? (existingWeapon.assignedTo || '') : '')

  // Sync state when navigating between duplicate weapons
  useEffect(() => {
    if (existingWeapon) {
      setSelectedWeapon(existingWeapon.data)
      setLevel(existingWeapon.level || 1)
      setAscension(existingWeapon.ascension || 0)
      setTargetLevel(existingWeapon.targetLevel || 90)
      setTargetAscension(existingWeapon.targetAscension ?? 6)
      setAssignedTo(existingWeapon.assignedTo || '')
    }
  }, [existingWeapon, currentIndex])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext()
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNext, onPrev, hasNext, hasPrev])

  const filteredWeapons = useMemo(() => {
    let list = [...weaponsData]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((w) => w?.name?.toLowerCase().includes(q))
    }
    if (typeFilter !== 'All') list = list.filter((w) => w.type === typeFilter)
    if (rarityFilter !== 'All') {
      const rFilterNum = parseInt(rarityFilter.match(/\d+/)?.[0] || '0', 10)
      list = list.filter((w) => {
        const wRarity = typeof w.rarity === 'string' ? (w.rarity.match(/★/g)?.length || parseInt(w.rarity) || 0) : (w.rarity || 0)
        return wRarity === rFilterNum
      })
    }
    return list.sort((a, b) => {
        const aRarity = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0)
        const bRarity = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0)
        return bRarity - aRarity || (a.name || '').localeCompare(b.name || '')
    })
  }, [search, typeFilter, rarityFilter])

  // Roster characters of compatible weapon type for the selected weapon
  const compatibleChars = useMemo(() => {
    if (!selectedWeapon) return []
    return Object.keys(roster)
      .map((name) => charactersData.find((c) => c.name === name))
      .filter((c) => c && c.weapon_type === selectedWeapon.type)
  }, [roster, selectedWeapon])

  const handleSelectWeapon = (weapon) => {
    setSelectedWeapon(weapon)
    setStep(2)
  }

  const handleConfirm = () => {
    if (!selectedWeapon) return

    const charEntry = assignedTo ? roster[assignedTo] : null
    const charAlreadyHasWeapon = charEntry?.equippedWeaponId

    if (assignedTo && charAlreadyHasWeapon && existingWeapon?.id !== charAlreadyHasWeapon) {
      const existingEquip = trackedWeapons.find((w) => w.id === charAlreadyHasWeapon)
      const existingName = existingEquip ? formatName(existingEquip.weaponName) : 'a weapon'
      const confirmed = window.confirm(
        `${formatName(assignedTo)} already has "${existingName}" equipped. Replace it with "${formatName(selectedWeapon.name)}"?`
      )
      if (!confirmed) return
    }

    if (existingWeapon) {
      updateTrackedWeapon(existingWeapon.id, {
        level,
        ascension,
        targetLevel,
        targetAscension,
        assignedTo: assignedTo || null
      })
    } else {
      const newId = addTrackedWeapon(selectedWeapon.name, assignedTo || null)
      if (newId) {
        updateTrackedWeapon(newId, {
          level,
          ascension,
          targetLevel,
          targetAscension
        })
      }
    }
    onClose()
  }

  const rarityColor = selectedWeapon ? RARITY_COLORS[selectedWeapon.rarity] || '#C8A96E' : '#C8A96E'

  return createPortal(
    <div
      className="modal-overlay relative"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {hasPrev && onPrev && step === 2 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="fixed left-0 top-0 bottom-0 w-16 md:w-32 z-[60] flex items-center justify-center cursor-pointer transition-all hover:bg-gradient-to-r hover:from-white/10 hover:to-transparent group border-none outline-none"
          aria-label="Previous weapon"
        >
          <svg className="w-12 h-12 md:w-20 md:h-20 text-white/20 group-hover:text-white transition-all group-hover:-translate-x-2 duration-300 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {hasNext && onNext && step === 2 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="fixed right-0 top-0 bottom-0 w-16 md:w-32 z-[60] flex items-center justify-center cursor-pointer transition-all hover:bg-gradient-to-l hover:from-white/10 hover:to-transparent group border-none outline-none"
          aria-label="Next weapon"
        >
          <svg className="w-12 h-12 md:w-20 md:h-20 text-white/20 group-hover:text-white transition-all group-hover:translate-x-2 duration-300 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      <div
        ref={modalRef}
        className="w-full max-w-[1000px] bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)] animate-slide-up overflow-hidden"
      >
        <div key={currentIndex !== undefined ? currentIndex : (selectedWeapon?.name || 'select')} className={`${slideDirection === 'next' ? 'animate-swipe-next' : 'animate-swipe-prev'} flex flex-col flex-1 h-full min-h-0`}>
        {/* Header */}
        {step === 1 ? (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="font-cinzel font-bold text-lg text-[var(--text)]">Select a Weapon</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors">✕</button>
          </div>
        ) : (
          (() => {
            const theme = getWeaponTheme(selectedWeapon.rarity);
            return (
              <div className={`relative p-6 rounded-t-2xl border-b border-gray-700/50 ${theme.header} shrink-0`}>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => setStep(1)} className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white/70 flex items-center justify-center transition-colors">←</button>
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white/70 flex items-center justify-center transition-colors">✕</button>
                </div>
                <div className="flex gap-4 items-center">
                  <div className={`w-20 h-20 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden ${getRarityBg(selectedWeapon.rarity)}`}>
                    <GenshinImage src={getWeaponIcon(selectedWeapon.name)} alt={selectedWeapon.name} className="w-16 h-16 object-contain absolute inset-0 z-10 m-auto" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 font-cinzel">{formatName(selectedWeapon.name)}</h2>
                    <div className="flex gap-2 text-sm flex-wrap">
                      <span className="px-3 py-1 bg-black/30 rounded-full text-gray-200 text-sm flex items-center gap-1.5 shadow-inner backdrop-blur-sm">
                        <img 
                          src={getWeaponTypeIcon(selectedWeapon.type)} 
                          alt={selectedWeapon.type} 
                          className="w-4 h-4 object-contain opacity-75" 
                        />
                        {selectedWeapon.type}
                      </span>
                      <span className="px-3 py-1 bg-black/30 rounded-full text-yellow-400 text-sm tracking-widest shadow-inner flex items-center justify-center">
                        {getStars(selectedWeapon.rarity) || '★'}
                      </span>
                      {existingWeapon && (
                        <span className="px-3 py-1 bg-green-900/50 rounded-full text-green-300 backdrop-blur-sm shadow-sm font-bold">✓ In Armory</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* ── STEP 1: Select Weapon ── */}
        {step === 1 && (
          <>
            <div className="px-6 py-3 border-b border-[var(--border)] shrink-0 space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
                <input autoFocus type="search" placeholder="Search weapons…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map((t) => (
                  <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill text-[11px] py-1 ${typeFilter === t ? 'active' : ''}`}>
                    {WEAPON_TYPES[t]?.emoji || '🌐'} {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_RARITIES.map((r) => (
                  <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill text-[11px] py-1 ${rarityFilter === r ? 'active' : ''}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-6 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredWeapons.map((wp) => {
                  const wpCfg = WEAPON_TYPES[wp.type] || { emoji: '✨' }
                  const rColor = RARITY_COLORS[wp.rarity] || '#C8A96E'
                  return (
                    <button
                      key={wp.name}
                      onClick={() => handleSelectWeapon(wp)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] hover:bg-[var(--elevated)] transition-all text-left group"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl shadow relative overflow-hidden ${getRarityBg(wp.rarity)}`} style={{ border: `1px solid ${rColor}40` }}>
                        <GenshinImage 
                          src={getWeaponIcon(wp.name)} 
                          alt={wp.name} 
                          className="w-full h-full object-contain absolute inset-0 z-10 p-1" 
                          fallback={<span className="relative z-10 font-cinzel">{wpCfg.emoji}</span>} 
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-cinzel text-[11px] font-semibold text-[var(--text)] truncate">{formatName(wp.name)}</p>
                        <p className={`text-[10px] ${getRarityClass(wp.rarity)}`}>{getStars(wp.rarity)}</p>
                        <p className="text-[10px] text-[var(--muted)]">{wp.type}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Configure Weapon ── */}
        {step === 2 && selectedWeapon && (
          <>
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-6 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent flex flex-col gap-6">
              {/* Level sliders */}
              <div className="space-y-4">
                {(() => {
                  const theme = getWeaponTheme(selectedWeapon.rarity);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                      <div className="modal-state-panel">
                        <p className={`text-[10px] font-bold tracking-widest uppercase mb-4 ${theme.text}`}>📍 Weapon Current</p>
                        <AscensionSelector 
                          value={ascension} 
                          onChange={(a) => { 
                            setAscension(a); 
                            const clampedLevel = clampLevel(level, a);
                            setLevel(clampedLevel); 
                            if (a > targetAscension) setTargetAscension(a);
                            if (clampedLevel > targetLevel) setTargetLevel(clampedLevel);
                          }} 
                          label="Ascension" 
                          elementColor={theme.elementColor} 
                        />
                        <div className="mt-4">
                          <LevelSlider 
                            value={level} 
                            onChange={(l) => {
                              setLevel(l);
                              if (l > targetLevel) setTargetLevel(l);
                            }} 
                            ascension={ascension} 
                            label="Level" 
                            elementColor={theme.elementColor} 
                          />
                        </div>
                      </div>
                      <div className="modal-state-panel">
                        <p className={`text-[10px] font-bold tracking-widest uppercase mb-4 ${theme.text}`}>🎯 Weapon Target</p>
                        <AscensionSelector 
                          value={targetAscension} 
                          onChange={(a) => { 
                            setTargetAscension(a); 
                            setTargetLevel(clampLevel(targetLevel, a)) 
                          }} 
                          label="Ascension" 
                          elementColor={theme.elementColor}
                          minValid={ascension} 
                        />
                        <div className="mt-4">
                          <LevelSlider 
                            value={targetLevel} 
                            onChange={setTargetLevel} 
                            ascension={targetAscension} 
                            label="Level" 
                            elementColor={theme.elementColor}
                            minOverride={targetAscension === ascension ? level : undefined} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Assign to character */}
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-2">Assign to Character (optional)</h3>
                {compatibleChars.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] italic">No rostered characters use {selectedWeapon.type}s.</p>
                ) : (
                  <CustomSelect
                    placeholder="— Unassigned (Standalone) —"
                    value={assignedTo}
                    onChange={(newVal) => setAssignedTo(newVal)}
                    options={[
                      { id: '', name: '— Unassigned (Standalone) —', icon: null, rarity: 0 },
                      ...compatibleChars.map((c) => {
                        const entry = roster[c.name]
                        const hasWeapon = entry?.equippedWeaponId
                        const equippedWeaponName = hasWeapon ? trackedWeapons.find(w => w.id === hasWeapon)?.weaponName : null
                        const charData = charactersData.find(cd => cd.name === c.name)
                        return {
                          id: c.name,
                          name: formatName(c.name),
                          subtitle: equippedWeaponName ? `⚠️ (has ${formatName(equippedWeaponName)})` : '',
                          icon: getCharacterAvatar(c.name),
                          rarity: charData ? charData.rarity : 0,
                          secondaryIcon: equippedWeaponName ? getWeaponIcon(equippedWeaponName) : null
                        }
                      })
                    ]}
                  />
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
              <button onClick={onClose} className="genshin-btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md"
              >
                Add to Armory
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>,
    document.body
  )
}
