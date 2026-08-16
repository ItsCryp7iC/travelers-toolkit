import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getRarityClass, getStars } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import CustomSelect from './CustomSelect'
import { getCharacterAvatar, getWeaponIcon } from '../utils/assetHelper'
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

function TalentSlider({ value, onChange, label, elementColor, minOverride = 1 }) {
  const min = minOverride;
  const max = 10;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-end mb-1">
        <label className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">
          {label}
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold font-cinzel leading-none" style={{ color: elementColor }}>
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

export default function AddCharacterModal({ onClose }) {
  const roster = useStore((s) => s.roster)
  const batchAddCharacters = useStore((s) => s.batchAddCharacters)
  const bulkUpdateCharacters = useStore((s) => s.bulkUpdateCharacters)
  const addTrackedWeapon = useStore((s) => s.addTrackedWeapon)
  const modalRef = useRef(null)

  // Step 1 state
  const [step, setStep] = useState(1)
  const [selectedCharacters, setSelectedCharacters] = useState([])
  const [weaponAssignments, setWeaponAssignments] = useState({})
  const [search, setSearch] = useState('')
  const [elementFilter, setElementFilter] = useState('All')

  // Step 2 state (Global defaults)
  const [level, setLevel] = useState(1)
  const [ascension, setAscension] = useState(0)
  const [talents, setTalents] = useState({ normal: 1, skill: 1, burst: 1 })
  
  const [targetLevel, setTargetLevel] = useState(90)
  const [targetAscension, setTargetAscension] = useState(6)
  const [targetTalents, setTargetTalents] = useState({ normal: 10, skill: 10, burst: 10 })

  const allElements = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]

  const filteredCharacters = useMemo(() => {
    let list = charactersData.filter((c) => !roster[c.name])
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.element?.toLowerCase().includes(q))
    }
    if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
    return list.sort((a, b) => {
      const aRarity = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0)
      const bRarity = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0)
      return bRarity - aRarity || a.name.localeCompare(b.name)
    })
  }, [roster, search, elementFilter])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const toggleCharacter = (char) => {
    setSelectedCharacters(prev => {
      const isSelected = prev.some(c => c.name === char.name)
      if (isSelected) return prev.filter(c => c.name !== char.name)
      return [...prev, char]
    })
  }

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredCharacters.every(fc => selectedCharacters.some(sc => sc.name === fc.name))
    if (allFilteredSelected) {
      const filteredNames = new Set(filteredCharacters.map(c => c.name))
      setSelectedCharacters(prev => prev.filter(sc => !filteredNames.has(sc.name)))
    } else {
      const newSelections = [...selectedCharacters]
      filteredCharacters.forEach(fc => {
        if (!newSelections.some(sc => sc.name === fc.name)) {
          newSelections.push(fc)
        }
      })
      setSelectedCharacters(newSelections)
    }
  }

  const handleConfirm = () => {
    if (selectedCharacters.length === 0) return
    const names = selectedCharacters.map(c => c.name)
    batchAddCharacters(names)
    bulkUpdateCharacters(names, {
      level,
      ascension,
      targetLevel,
      targetAscension,
      talents,
      targetTalents
    })
    
    names.forEach(charName => {
      const wName = weaponAssignments[charName];
      if (wName) {
        addTrackedWeapon(wName, charName);
      }
    })
    
    // Clear state and close
    setSelectedCharacters([])
    setWeaponAssignments({})
    onClose()
  }

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)] animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface)] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 className="font-cinzel font-bold text-lg text-[var(--text)]">
              {step === 1 ? 'Add Character to Roster' : `${selectedCharacters.length} Characters Selected`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors border border-[var(--border)]">←</button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors border border-[var(--border)]">✕</button>
          </div>
        </div>

        {/* ── STEP 1: Select Characters ── */}
        {step === 1 && (
          <>
            <div className="px-6 py-3 border-b border-[var(--border)] shrink-0 space-y-3 bg-[var(--surface)]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
                <input autoFocus type="search" placeholder="Search characters…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 flex-1">
                  {allElements.map((el) => {
                    const cfg = ELEMENTS[el]
                    return (
                      <button key={el} onClick={() => setElementFilter(el)} className={`filter-pill text-[11px] py-1 ${elementFilter === el ? 'active' : ''}`}>
                        {cfg ? cfg.emoji : '🌐'} {el}
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={toggleSelectAll}
                  className="genshin-btn-ghost text-xs px-4 py-2 border border-[var(--border)]"
                >
                  {filteredCharacters.length > 0 && filteredCharacters.every(fc => selectedCharacters.some(sc => sc.name === fc.name)) ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg)]">
              {filteredCharacters.length === 0 && !search && elementFilter === 'All' ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="text-4xl mb-3">🎉</span>
                  <p className="font-cinzel font-semibold text-[var(--text)]">All characters are in your roster!</p>
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {filteredCharacters.map((char) => {
                    const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown
                    const wpCfg = WEAPON_TYPES[char.weapon_type]
                    const isSelected = selectedCharacters.some(sc => sc.name === char.name)
                    
                    return (
                      <button
                        key={char.name}
                        onClick={() => toggleCharacter(char)}
                        className={`group flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center cursor-pointer relative overflow-hidden ${
                          isSelected 
                            ? 'border-[var(--gold)] bg-[rgba(200,169,110,0.1)] shadow-[0_0_10px_rgba(200,169,110,0.15)]' 
                            : 'border-[var(--border)] bg-[var(--surface)] hover:border-white/20 hover:bg-[var(--elevated)]'
                        }`}
                      >
                        {/* Checkbox Overlay */}
                        <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-colors z-20 ${
                          isSelected ? 'bg-[var(--gold)] border-[var(--gold)] text-black' : 'border-[var(--muted)] bg-black/40'
                        }`}>
                          {isSelected && <span className="text-[10px] leading-none">✓</span>}
                        </div>

                        <div className="w-14 h-14 rounded-xl flex items-center justify-center relative shadow-md overflow-hidden" style={{ background: elCfg.avatarGradient }}>
                          <GenshinImage 
                            src={getCharacterAvatar(char.name)}
                            alt={char.name}
                            className="w-full h-full object-cover absolute inset-0 z-10"
                            fallback={
                              <span className="relative z-10 font-cinzel text-xl" style={{ color: elCfg.color, textShadow: `0 0 12px ${elCfg.color}` }}>
                                {getInitials(char.name)}
                              </span>
                            }
                          />
                        </div>
                        <div className="min-w-0 w-full">
                          <p className={`font-cinzel text-[11px] font-semibold truncate ${isSelected ? 'text-[var(--gold)]' : 'text-[var(--text)]'}`}>{formatName(char.name)}</p>
                          <p className={`text-[10px] ${getRarityClass(char.rarity)}`}>{getStars(char.rarity)}</p>
                          <div className="flex justify-center gap-1 mt-1">
                            <span className="text-[10px]">{elCfg.emoji}</span>
                            {wpCfg && <span className="text-[10px]">{wpCfg.emoji}</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Step 1 Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] flex justify-between items-center shrink-0 rounded-b-2xl">
              <span className="text-sm font-semibold text-[var(--muted)]">
                {selectedCharacters.length} selected
              </span>
              <div className="flex gap-3">
                <button onClick={onClose} className="genshin-btn-ghost text-sm">Cancel</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedCharacters.length === 0}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-opacity shadow-md ${
                    selectedCharacters.length > 0 
                      ? 'bg-[var(--gold)] text-[var(--bg)] hover:opacity-90' 
                      : 'bg-[var(--elevated)] text-[var(--muted)] cursor-not-allowed border border-[var(--border)]'
                  }`}
                >
                  Next: Configure ({selectedCharacters.length})
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Configure ── */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[var(--bg)]">
              {/* Global Config */}
              <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)]">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">⚙️</span>
                  <h3 className="font-cinzel font-bold text-[var(--text)] text-lg">Global Baseline Configuration</h3>
                </div>
                <p className="text-[var(--muted)] text-xs mb-6 max-w-2xl">
                  These settings will be applied as the default starting and target states for all {selectedCharacters.length} characters in this batch.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Current State */}
                  <div className="modal-state-panel bg-[var(--bg)] border-none">
                    <p className="text-[10px] font-bold tracking-widest uppercase mb-4 text-[#C8A96E]">📍 Current State</p>
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
                      elementColor="#C8A96E" 
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
                        elementColor="#C8A96E" 
                      />
                    </div>
                    
                    <div className="mt-6 border-t border-[var(--border)] pt-4">
                      <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-3">Talent Levels</p>
                      <div className="grid grid-cols-3 gap-3">
                        <TalentSlider label="Normal" value={talents.normal} elementColor="#C8A96E" onChange={(v) => {
                          setTalents(prev => ({...prev, normal: v}));
                          if(v > targetTalents.normal) setTargetTalents(prev => ({...prev, normal: v}));
                        }} />
                        <TalentSlider label="Skill" value={talents.skill} elementColor="#C8A96E" onChange={(v) => {
                          setTalents(prev => ({...prev, skill: v}));
                          if(v > targetTalents.skill) setTargetTalents(prev => ({...prev, skill: v}));
                        }} />
                        <TalentSlider label="Burst" value={talents.burst} elementColor="#C8A96E" onChange={(v) => {
                          setTalents(prev => ({...prev, burst: v}));
                          if(v > targetTalents.burst) setTargetTalents(prev => ({...prev, burst: v}));
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Target State */}
                  <div className="modal-state-panel bg-[var(--bg)] border-none">
                    <p className="text-[10px] font-bold tracking-widest uppercase mb-4 text-[#C8A96E]">🎯 Target State</p>
                    <AscensionSelector 
                      value={targetAscension} 
                      onChange={(a) => { 
                        setTargetAscension(a); 
                        setTargetLevel(clampLevel(targetLevel, a)) 
                      }} 
                      label="Ascension" 
                      elementColor="#C8A96E"
                      minValid={ascension} 
                    />
                    <div className="mt-4">
                      <LevelSlider 
                        value={targetLevel} 
                        onChange={setTargetLevel} 
                        ascension={targetAscension} 
                        label="Level" 
                        elementColor="#C8A96E"
                        minOverride={targetAscension === ascension ? level : undefined} 
                      />
                    </div>

                    <div className="mt-6 border-t border-[var(--border)] pt-4">
                      <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-3">Target Talents</p>
                      <div className="grid grid-cols-3 gap-3">
                        <TalentSlider label="Normal" value={targetTalents.normal} elementColor="#C8A96E" minOverride={talents.normal} onChange={(v) => setTargetTalents(prev => ({...prev, normal: v}))} />
                        <TalentSlider label="Skill" value={targetTalents.skill} elementColor="#C8A96E" minOverride={talents.skill} onChange={(v) => setTargetTalents(prev => ({...prev, skill: v}))} />
                        <TalentSlider label="Burst" value={targetTalents.burst} elementColor="#C8A96E" minOverride={talents.burst} onChange={(v) => setTargetTalents(prev => ({...prev, burst: v}))} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div>
                <h3 className="font-cinzel font-bold text-[var(--text)] text-lg mb-4 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Characters to Add
                </h3>
                
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--elevated)] border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-16 text-center">Icon</th>
                        <th className="px-4 py-3 font-semibold">Character Name</th>
                        <th className="px-4 py-3 font-semibold w-1/2">Assign Weapon (Optional)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {selectedCharacters.map((char) => {
                        const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown;
                        const wpCfg = WEAPON_TYPES[char.weapon_type];
                        const assignedValue = weaponAssignments[char.name] || '';
                        
                        const compatibleWeapons = weaponsData.filter(w => w.type === char.weapon_type);
                        
                        return (
                          <tr key={char.name} className="hover:bg-[var(--elevated)] transition-colors">
                            <td className="px-4 py-3 text-center">
                              <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center relative shadow-sm overflow-hidden" style={{ background: elCfg.avatarGradient }}>
                                <GenshinImage src={getCharacterAvatar(char.name)} alt={char.name} className="w-full h-full object-cover absolute inset-0 z-10" />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-cinzel font-semibold text-[var(--text)] text-sm">{formatName(char.name)}</p>
                              <div className="flex gap-2 items-center mt-1 text-[10px]">
                                <span className={getRarityClass(char.rarity)}>{getStars(char.rarity)}</span>
                                <span className="text-[var(--muted)] flex items-center gap-1">{wpCfg?.emoji} {char.weapon_type}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <CustomSelect
                                placeholder="— Unassigned —"
                                value={assignedValue}
                                onChange={(newVal) => setWeaponAssignments(prev => ({ ...prev, [char.name]: newVal }))}
                                options={[
                                  { id: '', name: '— Unassigned —', icon: null, rarity: 0 },
                                  ...compatibleWeapons.map(w => ({
                                    id: w.name,
                                    name: formatName(w.name),
                                    icon: getWeaponIcon(w.name),
                                    rarity: w.rarity
                                  }))
                                ]}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Step 2 Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button onClick={onClose} className="genshin-btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md flex items-center gap-2"
              >
                <span>➕</span> Confirm & Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
