import React, { useState, useMemo, useEffect, useRef } from 'react'
import weaponsData from '../data/weapons.json'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getStars, getRarityClass } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getWeaponIcon } from '../utils/assetHelper'
import { clampLevel, getLevelRange, ASCENSION_CAPS } from '../utils/calculator'

function AscensionSelector({ value, onChange, label, elementColor }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
        {label}
      </p>
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label={label}>
        {[0, 1, 2, 3, 4, 5, 6].map((a) => (
          <button
            key={a}
            onClick={() => onChange(a)}
            title={`A${a} → Max Lv${ASCENSION_CAPS[a]}`}
            className="w-8 h-8 rounded-lg text-xs font-bold transition-all duration-150 border"
            style={
              value === a
                ? { background: `${elementColor}25`, borderColor: elementColor, color: elementColor, boxShadow: `0 0 12px ${elementColor}40` }
                : { background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }
            }
          >
            {a}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--muted)] mt-1">
        Max Level: <span style={{ color: elementColor }}>Lv{ASCENSION_CAPS[value]}</span>
      </p>
    </div>
  )
}

function LevelSlider({ value, onChange, ascension, label, elementColor }) {
  const { min, max } = getLevelRange(ascension)
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
        className="genshin-slider w-full"
        style={{ '--slider-color': elementColor }}
      />
    </div>
  )
}

const ALL_TYPES     = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES  = ['All', '🟡 5★', '🟣 4★', '🔵 3★', '🟢 2★', '⚪ 1★']
const LEVEL_MAX     = 90
const ASC_MAX       = 6

export default function AddWeaponModal({ onClose }) {
  const roster         = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const addTrackedWeapon = useStore((s) => s.addTrackedWeapon)

  const modalRef = useRef(null)

  // Step 1 state
  const [step, setStep]                   = useState(1) // 1=Select, 2=Configure
  const [selectedWeapon, setSelectedWeapon] = useState(null)
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('All')
  const [rarityFilter, setRarityFilter]   = useState('All')

  // Step 2 state
  const [level,          setLevel]          = useState(1)
  const [ascension,      setAscension]      = useState(0)
  const [targetLevel,    setTargetLevel]    = useState(90)
  const [targetAscension, setTargetAscension] = useState(6)
  const [assignedTo,     setAssignedTo]     = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

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

    if (assignedTo && charAlreadyHasWeapon) {
      const existingWeapon = trackedWeapons.find((w) => w.id === charAlreadyHasWeapon)
      const existingName = existingWeapon ? formatName(existingWeapon.weaponName) : 'a weapon'
      const confirmed = window.confirm(
        `${formatName(assignedTo)} already has "${existingName}" equipped. Replace it with "${formatName(selectedWeapon.name)}"?`
      )
      if (!confirmed) return
    }

    addTrackedWeapon(selectedWeapon.name, assignedTo || null)
    onClose()
  }

  const rarityColor = selectedWeapon ? RARITY_COLORS[selectedWeapon.rarity] || '#C8A96E' : '#C8A96E'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)] animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors">← Back</button>
            )}
            <h2 className="font-cinzel font-bold text-lg text-[var(--text)]">
              {step === 1 ? 'Select a Weapon' : `Configure: ${formatName(selectedWeapon?.name || '')}`}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors">✕</button>
        </div>

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
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {filteredWeapons.map((wp) => {
                  const wpCfg = WEAPON_TYPES[wp.type] || { emoji: '✨' }
                  const rColor = RARITY_COLORS[wp.rarity] || '#C8A96E'
                  return (
                    <button
                      key={wp.name}
                      onClick={() => handleSelectWeapon(wp)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] hover:bg-[var(--elevated)] transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl shadow relative overflow-hidden" style={{ background: `${rColor}20`, border: `1px solid ${rColor}40` }}>
                        <GenshinImage 
                          src={getWeaponIcon(wp.name)} 
                          alt={wp.name} 
                          className="w-full h-full object-cover absolute inset-0 z-10" 
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

        {/* ── STEP 2: Configure ── */}
        {step === 2 && selectedWeapon && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Selected weapon summary */}
              <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: `${rarityColor}10`, borderColor: `${rarityColor}30` }}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 shadow relative overflow-hidden" style={{ background: `${rarityColor}20`, border: `1px solid ${rarityColor}40` }}>
                  <GenshinImage 
                    src={getWeaponIcon(selectedWeapon.name)} 
                    alt={selectedWeapon.name} 
                    className="w-full h-full object-cover absolute inset-0 z-10" 
                    fallback={<span className="relative z-10 font-cinzel">{WEAPON_TYPES[selectedWeapon.type]?.emoji || '⚔️'}</span>} 
                  />
                </div>
                <div>
                  <p className="font-cinzel font-bold text-base text-[var(--text)]">{formatName(selectedWeapon.name)}</p>
                  <p className={`text-xs ${getRarityClass(selectedWeapon.rarity)}`}>{getStars(selectedWeapon.rarity)}</p>
                  <p className="text-xs text-[var(--muted)]">{selectedWeapon.type}</p>
                </div>
              </div>

              {/* Level sliders */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                  <div className="modal-state-panel">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">📍 Weapon Current</p>
                    <AscensionSelector value={ascension} onChange={(a) => { setAscension(a); setLevel(clampLevel(level, a)) }} label="Ascension" elementColor="#9CA3AF" />
                    <div className="mt-4">
                      <LevelSlider value={level} onChange={setLevel} ascension={ascension} label="Level" elementColor="#9CA3AF" />
                    </div>
                  </div>
                  <div className="modal-state-panel">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Weapon Target</p>
                    <AscensionSelector value={targetAscension} onChange={(a) => { setTargetAscension(a); setTargetLevel(clampLevel(targetLevel, a)) }} label="Ascension" elementColor="var(--gold)" />
                    <div className="mt-4">
                      <LevelSlider value={targetLevel} onChange={setTargetLevel} ascension={targetAscension} label="Level" elementColor="var(--gold)" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Assign to character */}
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-2">Assign to Character (optional)</h3>
                {compatibleChars.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] italic">No rostered characters use {selectedWeapon.type}s.</p>
                ) : (
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-sm rounded-xl px-4 py-2.5 outline-none focus:border-[var(--gold)] transition-colors"
                  >
                    <option value="">— Unassigned (Standalone) —</option>
                    {compatibleChars.map((c) => {
                      const entry = roster[c.name]
                      const hasWeapon = entry?.equippedWeaponId
                      return (
                        <option key={c.name} value={c.name}>
                          {formatName(c.name)}{hasWeapon ? ' ⚠️ (has weapon)' : ''}
                        </option>
                      )
                    })}
                  </select>
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
  )
}
