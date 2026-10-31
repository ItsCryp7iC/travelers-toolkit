import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getTravelerAwareWeaponId } from '../utils/travelerHelper'
import weaponsData from '../data/weapons.json'
import charactersData from '../utils/characters'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getStars, getRarityClass, getRarityBg, getWeaponTheme } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { acquireBodyScrollLock } from '../utils/scrollLock'
import CustomSelect from './CustomSelect'
import { getWeaponIcon, getCharacterAvatar, getWeaponTypeIcon } from '../utils/assetHelper'
import { clampLevel, getLevelRange, ASCENSION_CAPS } from '../utils/calculator'

function AscensionSelector({ value, onChange, label, elementColor, minValid = 0 }) {
  const getPhaseMax = (a) => a === 6 ? 90 : ASCENSION_CAPS[a];
  
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
      <p className="text-xs text-[var(--muted)] mt-1">
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
        <label className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase">
          {label}
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold leading-none" style={{ color: elementColor }}>
            {value}
          </span>
          <span className="text-xs text-[var(--muted)]">/ {max}</span>
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

export default function BatchAddWeaponModal({ isOpen, onClose }) {
  const roster = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const addTrackedWeapon = useStore((s) => s.addTrackedWeapon)
  const updateTrackedWeapon = useStore((s) => s.updateTrackedWeapon)

  const globallyAssignedCharacterIds = useMemo(() => {
    return new Set(trackedWeapons.map(w => w.assignedTo).filter(Boolean));
  }, [trackedWeapons]);

  const modalRef = useRef(null)

  // Step 1 state
  const [step, setStep] = useState(1) // 1=Select, 2=Configure
  const [selectedQuantities, setSelectedQuantities] = useState({})
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')

  // Step 2 state (Global defaults)
  const [level, setLevel] = useState(1)
  const [ascension, setAscension] = useState(0)
  const [targetLevel, setTargetLevel] = useState(90)
  const [targetAscension, setTargetAscension] = useState(6)
  
  // Per-weapon assignments: { weaponName: 'characterName' }
  const [assignments, setAssignments] = useState({})

  useEffect(() => {
    return acquireBodyScrollLock()
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

  const handleQuantityChange = (weaponName, delta) => {
    setSelectedQuantities(prev => {
      const current = prev[weaponName] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [weaponName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [weaponName]: next };
    });
  };

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredWeapons.every(fw => selectedQuantities[fw.name] > 0)
    if (allFilteredSelected) {
      // Deselect all filtered
      const filteredNames = new Set(filteredWeapons.map(w => w.name))
      setSelectedQuantities(prev => {
        const next = { ...prev }
        filteredNames.forEach(name => delete next[name])
        return next
      })
    } else {
      // Select 1 of each filtered if not already selected
      setSelectedQuantities(prev => {
        const next = { ...prev }
        filteredWeapons.forEach(fw => {
          if (!next[fw.name]) next[fw.name] = 1
        })
        return next
      })
    }
  }

  // Expand quantities for Step 2
  const expandedSelectedWeapons = useMemo(() => {
    const expanded = [];
    Object.entries(selectedQuantities).forEach(([weaponName, qty]) => {
      const weaponData = weaponsData.find(w => w.name === weaponName);
      if (weaponData) {
        for (let i = 0; i < qty; i++) {
          expanded.push({
            ...weaponData,
            uniqueId: `${weaponName}-${i}`
          });
        }
      }
    });
    return expanded;
  }, [selectedQuantities]);
  
  const totalSelectedCount = expandedSelectedWeapons.length;

  const getCompatibleChars = (weaponType) => {
    return Object.keys(roster)
      .map((name) => charactersData.find((c) => c.name === name))
      .filter((c) => c && c.weapon_type === weaponType)
  }

  const handleConfirm = () => {
    if (totalSelectedCount === 0) return

    expandedSelectedWeapons.forEach((weapon) => {
      const charAssigned = assignments[weapon.uniqueId] || null
      const newId = addTrackedWeapon(weapon.name, charAssigned)
      if (newId) {
        updateTrackedWeapon(newId, {
          level,
          ascension,
          targetLevel,
          targetAscension
        })
      }
    })

    onClose()
  }

  return createPortal(
    <div
      className="modal-overlay p-0 sm:p-4 md:p-6 flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-add-weapon-title"
        className="w-full max-w-4xl bg-[var(--elevated)] rounded-none sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] border-0 sm:border border-[var(--border)] animate-slide-up overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface)] rounded-t-none sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 id="batch-add-weapon-title" className="font-bold text-base sm:text-lg text-[var(--text)]">
              {step === 1 ? 'Select Weapons' : `${totalSelectedCount} Weapons Selected`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} aria-label="Back to weapon selection" className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors border border-[var(--border)]">←</button>
            )}
            <button onClick={onClose} aria-label="Close modal" className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors border border-[var(--border)]">✕</button>
          </div>
        </div>

        {/* ── STEP 1: Select Weapons ── */}
        {step === 1 && (
          <>
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-[var(--border)] shrink-0 space-y-2.5 sm:space-y-3 bg-[var(--surface)]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
                <input autoFocus type="search" placeholder="Search weapons…" className="search-input w-full min-h-[40px]" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
                <div className="flex flex-col gap-1.5 sm:gap-2 flex-1">
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {ALL_TYPES.map((t) => (
                      <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill text-xs py-1 ${typeFilter === t ? 'active' : ''}`}>
                        {WEAPON_TYPES[t]?.emoji || '🌐'} {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {ALL_RARITIES.map((r) => (
                      <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill text-xs py-1 ${rarityFilter === r ? 'active' : ''}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={toggleSelectAll}
                  className="genshin-btn-ghost text-xs px-3 py-1.5 sm:px-4 sm:py-2 border border-[var(--border)]"
                >
                  {filteredWeapons.every(fw => selectedQuantities[fw.name] > 0) ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-[var(--bg)] min-h-0">
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredWeapons.map((wp) => {
                  const wpCfg = WEAPON_TYPES[wp.type] || { emoji: '✨' }
                  const rColor = RARITY_COLORS[wp.rarity] || '#C8A96E'
                  const isSelected = selectedQuantities[wp.name] > 0
                  
                  return (
                    <div
                      key={wp.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => !isSelected && handleQuantityChange(wp.name, 1)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isSelected) {
                          e.preventDefault();
                          handleQuantityChange(wp.name, 1);
                        }
                      }}
                      className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all text-left group relative overflow-hidden cursor-pointer ${
                        isSelected 
                          ? 'border-[var(--gold)] bg-[rgba(200,169,110,0.1)] shadow-[0_0_10px_rgba(200,169,110,0.15)]' 
                          : 'border-[var(--border)] bg-[var(--surface)] hover:border-white/20 hover:bg-[var(--elevated)]'
                      }`}
                    >
                      {/* Checkbox / Quantity Overlay */}
                      {isSelected ? (
                        <div className="absolute bottom-2 right-2 flex items-center bg-black/85 rounded-md border border-[var(--gold)] z-20 shadow-md" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <button onClick={() => handleQuantityChange(wp.name, -1)} aria-label={`Decrease ${wp.name} quantity`} className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--gold)] hover:text-white hover:bg-white/10 rounded-l-md flex items-center justify-center font-bold text-sm">-</button>
                          <span className="px-1.5 text-xs text-[var(--gold)] font-bold min-w-[16px] text-center">{selectedQuantities[wp.name]}</span>
                          <button onClick={() => handleQuantityChange(wp.name, 1)} aria-label={`Increase ${wp.name} quantity`} className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--gold)] hover:text-white hover:bg-white/10 rounded-r-md flex items-center justify-center font-bold text-sm">+</button>
                        </div>
                      ) : (
                        <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full border border-[var(--muted)] bg-black/40 flex items-center justify-center transition-colors z-20" />
                      )}

                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl shadow relative overflow-hidden ${getRarityBg(wp.rarity)}`} style={{ border: `1px solid ${rColor}40` }}>
                        <GenshinImage 
                          src={getWeaponIcon(wp.name)} 
                          alt={wp.name} 
                          className="w-full h-full object-contain absolute inset-0 z-10 p-1" 
                          fallback={<span className="relative z-10 ">{wpCfg.emoji}</span>} 
                        />
                      </div>
                      <div className="min-w-0 pr-12">
                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-[var(--gold)]' : 'text-[var(--text)]'}`}>{formatName(wp.name)}</p>
                        <p className={`text-xs ${getRarityClass(wp.rarity)}`}>{getStars(wp.rarity)}</p>
                        <p className="text-xs text-[var(--muted)]">{wp.type}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step 1 Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row justify-between items-center gap-2.5 sm:gap-3 shrink-0 rounded-b-none sm:rounded-b-2xl">
              <span className="text-sm font-semibold text-[var(--muted)] order-2 sm:order-1">
                {totalSelectedCount} selected
              </span>
              <div className="flex gap-2.5 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
                <button onClick={onClose} className="genshin-btn-ghost text-sm min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial">Cancel</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={totalSelectedCount === 0}
                  className={`px-5 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-opacity shadow-md min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial ${
                    totalSelectedCount > 0 
                      ? 'bg-[var(--gold)] text-[var(--bg)] hover:opacity-90' 
                      : 'bg-[var(--elevated)] text-[var(--muted)] cursor-not-allowed border border-[var(--border)]'
                  }`}
                >
                  Next: Configure ({totalSelectedCount})
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Configure ── */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-5 sm:space-y-8 bg-[var(--bg)] min-h-0">
              {/* Global Level Sliders */}
              <div className="bg-[var(--surface)] p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="text-lg sm:text-xl">⚙️</span>
                  <h3 className="font-bold text-[var(--text)] text-base sm:text-lg">Global Baseline Configuration</h3>
                </div>
                <p className="text-[var(--muted)] text-xs mb-4 sm:mb-6 max-w-2xl">
                  These settings will be applied as the default starting and target levels for all {totalSelectedCount} weapons in this batch.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="modal-state-panel bg-[var(--bg)] border-none">
                    <p className="text-xs font-bold tracking-widest uppercase mb-4 text-[#C8A96E]">📍 Current Level</p>
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
                  </div>
                  <div className="modal-state-panel bg-[var(--bg)] border-none">
                    <p className="text-xs font-bold tracking-widest uppercase mb-4 text-[#C8A96E]">🎯 Target Level</p>
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
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div>
                <h3 className="font-bold text-[var(--text)] text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="text-lg sm:text-xl">📋</span>
                  Character Assignments
                </h3>
                
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[460px]">
                    <thead className="bg-[var(--elevated)] border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                      <tr>
                        <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold w-14 sm:w-16 text-center">Icon</th>
                        <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Weapon Name</th>
                        <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold w-1/2 min-w-[200px]">Assign to Character (Optional)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {expandedSelectedWeapons.map((wp) => {
                        const assignedToOthers = Object.entries(assignments)
                          .filter(([id, char]) => id !== wp.uniqueId && char !== '')
                          .map(([_, char]) => char);

                        const compatibleChars = getCompatibleChars(wp.type).filter((c) => {
                          if (assignedToOthers.includes(c.name)) return false;
                          if (globallyAssignedCharacterIds.has(c.name)) return false;
                          return true;
                        });
                        const assignedValue = assignments[wp.uniqueId] || '';
                        const rColor = RARITY_COLORS[wp.rarity] || '#C8A96E';
                        
                        return (
                          <tr key={wp.uniqueId} className="hover:bg-[var(--elevated)] transition-colors">
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                              <div className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-lg shadow flex items-center justify-center relative overflow-hidden ${getRarityBg(wp.rarity)}`} style={{ border: `1px solid ${rColor}40` }}>
                                <GenshinImage 
                                  src={getWeaponIcon(wp.name)} 
                                  alt={wp.name} 
                                  className="w-full h-full object-contain absolute inset-0 z-10 p-1" 
                                />
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                              <p className="font-semibold text-[var(--text)] text-sm">{formatName(wp.name)}</p>
                              <div className="flex gap-2 items-center mt-0.5 sm:mt-1 text-xs">
                                <span className={getRarityClass(wp.rarity)}>{getStars(wp.rarity)}</span>
                                <span className="text-[var(--muted)]">{wp.type}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                              {compatibleChars.length === 0 ? (
                                <p className="text-xs text-[var(--muted)] italic">No compatible rostered characters.</p>
                              ) : (
                                <CustomSelect
                                  placeholder="— Unassigned (Standalone) —"
                                  value={assignedValue}
                                  onChange={(newVal) => setAssignments(prev => ({ ...prev, [wp.uniqueId]: newVal }))}
                                  options={[
                                    { id: '', name: '— Unassigned (Standalone) —', icon: null, rarity: 0 },
                                    ...compatibleChars.map((c) => {
                                      const entry = roster[c.name]
                                      const hasWeapon = getTravelerAwareWeaponId(c.name, entry, trackedWeapons)
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
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 shrink-0 rounded-b-none sm:rounded-b-2xl">
              <button onClick={onClose} className="genshin-btn-ghost text-sm min-h-[42px] sm:min-h-0 w-full sm:w-auto">Cancel</button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2 min-h-[42px] sm:min-h-0 w-full sm:w-auto"
              >
                <span>➕</span> Add to Armory
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
