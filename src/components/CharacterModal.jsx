import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../store/useStore'
import costsData from '../data/costs.json'
import weaponsData from '../data/weapons.json'
import {
  ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass,
} from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getElementIcon, getCharacterAvatar } from '../utils/assetHelper'
import {
  calculateProgressionCost, calculateAllTalentsCost, calculateWeaponCost,
  clampLevel, getLevelRange, ASCENSION_CAPS,
  formatNumber, formatMaterialName, WEAPON_ORE_KEY
} from '../utils/calculator'

// ─── Ascension Phase Selector ──────────────────────────────────────────────
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
            title={`A${a} — Max Lv${ASCENSION_CAPS[a]}`}
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

// ─── Level Slider ─────────────────────────────────────────────────────────
function LevelSlider({ value, onChange, ascension, label, elementColor }) {
  const { min, max } = getLevelRange(ascension)
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">{label}</p>
        <span className="font-cinzel font-bold text-lg leading-none" style={{ color: elementColor }}>{value}</span>
      </div>
      <div className="relative py-1">
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="level-slider w-full"
          style={{ '--slider-color': elementColor }}
          aria-label={`${label} level`}
        />
        <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1">
          <span>{min}</span><span>{max}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Talent Level Stepper ─────────────────────────────────────────────────
function TalentStepper({ value, onChange, min = 1, max = 10, elementColor, id }) {
  const step = (d) => onChange(Math.min(max, Math.max(min, value + d)))
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => step(-1)}
        disabled={value <= min}
        className="w-7 h-7 rounded-lg border text-sm font-bold flex items-center justify-center transition-all disabled:opacity-30"
        style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }}
        aria-label="Decrease talent level"
      >−</button>
      <div
        id={id}
        className="w-8 h-7 rounded-lg border flex items-center justify-center font-cinzel font-bold text-sm select-none"
        style={{ background: `${elementColor}15`, borderColor: `${elementColor}50`, color: elementColor }}
      >
        {value}
      </div>
      <button
        onClick={() => step(1)}
        disabled={value >= max}
        className="w-7 h-7 rounded-lg border text-sm font-bold flex items-center justify-center transition-all disabled:opacity-30"
        style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }}
        aria-label="Increase talent level"
      >+</button>
    </div>
  )
}

// ─── Talent Row ────────────────────────────────────────────────────────────
function TalentRow({ icon, label, fromVal, toVal, onFromChange, onToChange, elementColor, charName, skill }) {
  const safeToVal = Math.max(toVal, fromVal)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--text)] truncate">{label}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-center">
          <p className="text-[8px] text-[var(--muted)] mb-1 tracking-wider">CURRENT</p>
          <TalentStepper
            value={fromVal} onChange={onFromChange}
            elementColor="#9CA3AF"
            id={`talent-${charName}-${skill}-from`}
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 px-1">
          <div className="h-px w-6" style={{ background: `${elementColor}40` }} />
          <span className="text-[9px] text-[var(--muted)]">→</span>
          <div className="h-px w-6" style={{ background: `${elementColor}40` }} />
        </div>
        <div className="text-center">
          <p className="text-[8px] text-[var(--muted)] mb-1 tracking-wider">TARGET</p>
          <TalentStepper
            value={safeToVal} onChange={(v) => onToChange(Math.max(v, fromVal))}
            elementColor={elementColor}
            id={`talent-${charName}-${skill}-to`}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Cost Row ────────────────────────────────────────────────────────────
function CostRow({ icon, label, value, accent, large }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="text-base w-6 text-center">{icon}</span>
        <span className="text-xs text-[var(--muted)]">{label}</span>
      </div>
      <span className={`font-cinzel font-bold ${large ? 'text-base' : 'text-sm'}`} style={{ color: accent || 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Material Group ────────────────────────────────────────────────────────
function MaterialGroup({ icon, title, items, elementColor }) {
  if (!items || Object.keys(items).length === 0) return null
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </p>
      <div className="space-y-0 rounded-xl overflow-hidden border border-[var(--border)]">
        {Object.entries(items).map(([mat, qty]) => (
          <div key={mat} className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)] last:border-0">
            <span className="text-xs text-[var(--text)]">{formatMaterialName(mat)}</span>
            <span className="font-cinzel font-bold text-sm" style={{ color: elementColor }}>×{qty}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function CharacterModal({ character, onClose }) {
  const { name, rarity, element, weapon_type, materials } = character

  const rosterEntry        = useStore((s) => s.roster[name])
  const addCharacter        = useStore((s) => s.addCharacter)
  const updateCharacter     = useStore((s) => s.updateCharacter)
  const removeCharacter     = useStore((s) => s.removeCharacter)
  const trackedWeapons      = useStore((s) => s.trackedWeapons)
  const addTrackedWeapon    = useStore((s) => s.addTrackedWeapon)
  const updateTrackedWeapon = useStore((s) => s.updateTrackedWeapon)
  const unassignWeapon      = useStore((s) => s.unassignWeapon)
  const inRoster = Boolean(rosterEntry)

  const elConfig    = ELEMENTS[element] || ELEMENTS.Unknown
  const wpConfig    = WEAPON_TYPES[weapon_type]
  const displayName = formatName(name)
  const initials    = getInitials(name)
  const stars       = getStars(rarity)
  const rarityClass = getRarityClass(rarity)

  // ── Progression state ────────────────────────────────────────────────────
  const [fromAsc,   setFromAsc]   = useState(rosterEntry?.ascension        ?? 0)
  const [fromLevel, setFromLevel] = useState(rosterEntry?.level            ?? 1)
  const [toAsc,     setToAsc]     = useState(rosterEntry?.targetAscension  ?? 6)
  const [toLevel,   setToLevel]   = useState(rosterEntry?.targetLevel      ?? 90)

  // ── Talent state ─────────────────────────────────────────────────────────
  const [normalFrom, setNormalFrom] = useState(rosterEntry?.talents?.normal         ?? 1)
  const [skillFrom,  setSkillFrom]  = useState(rosterEntry?.talents?.skill          ?? 1)
  const [burstFrom,  setBurstFrom]  = useState(rosterEntry?.talents?.burst          ?? 1)
  const [normalTo,   setNormalTo]   = useState(rosterEntry?.targetTalents?.normal   ?? 1)
  const [skillTo,    setSkillTo]    = useState(rosterEntry?.targetTalents?.skill    ?? 1)
  const [burstTo,    setBurstTo]    = useState(rosterEntry?.targetTalents?.burst    ?? 1)

  // ── Weapon state — local draft mirrors equippedWeaponId until Save ──────────
  const [localWeaponId, setLocalWeaponId] = useState(rosterEntry?.equippedWeaponId ?? null)

  // Derive display data from localWeaponId against the live trackedWeapons list
  const trackedWeapon      = localWeaponId ? trackedWeapons.find((w) => w.id === localWeaponId) : null
  const equippedWeaponName = trackedWeapon?.weaponName ?? null

  // Local slider state — mirrors the tracked weapon's progression
  const [weaponFromAsc,   setWeaponFromAsc]   = useState(trackedWeapon?.ascension      ?? 0)
  const [weaponFromLevel, setWeaponFromLevel] = useState(trackedWeapon?.level          ?? 1)
  const [weaponToAsc,     setWeaponToAsc]     = useState(trackedWeapon?.targetAscension ?? 6)
  const [weaponToLevel,   setWeaponToLevel]   = useState(trackedWeapon?.targetLevel    ?? 90)

  // Pre-filter valid weapons for this character's weapon type strictly
  const availableWeapons = useMemo(() => {
    return weaponsData
      .filter(w => w.type && w.type.trim().toLowerCase() === weapon_type.trim().toLowerCase())
      .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
  }, [weapon_type])

  const selectedWeaponData = useMemo(() => {
    return equippedWeaponName ? weaponsData.find(w => w.name === equippedWeaponName) : null
  }, [equippedWeaponName])

  // ── Sync externally (re-opening same modal) ───────────────────────────────
  useEffect(() => {
    if (rosterEntry) {
      setFromAsc(rosterEntry.ascension ?? 0)
      setFromLevel(rosterEntry.level ?? 1)
      setToAsc(rosterEntry.targetAscension ?? 6)
      setToLevel(rosterEntry.targetLevel ?? 90)
      setNormalFrom(rosterEntry.talents?.normal ?? 1)
      setSkillFrom(rosterEntry.talents?.skill ?? 1)
      setBurstFrom(rosterEntry.talents?.burst ?? 1)
      setNormalTo(rosterEntry.targetTalents?.normal ?? 1)
      setSkillTo(rosterEntry.targetTalents?.skill ?? 1)
      setBurstTo(rosterEntry.targetTalents?.burst ?? 1)
    }
  }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local weapon sliders when the tracked weapon changes
  useEffect(() => {
    if (trackedWeapon) {
      setWeaponFromAsc(trackedWeapon.ascension ?? 0)
      setWeaponFromLevel(trackedWeapon.level ?? 1)
      setWeaponToAsc(trackedWeapon.targetAscension ?? 6)
      setWeaponToLevel(trackedWeapon.targetLevel ?? 90)
    } else {
      setWeaponFromAsc(0)
      setWeaponFromLevel(1)
      setWeaponToAsc(6)
      setWeaponToLevel(90)
    }
  }, [localWeaponId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFromAscChange = useCallback((a) => { setFromAsc(a); setFromLevel((lv) => clampLevel(lv, a)) }, [])
  const handleToAscChange   = useCallback((a) => { setToAsc(a);   setToLevel((lv) => clampLevel(lv, a)) }, [])

  const safeToAsc   = Math.max(toAsc, fromAsc)
  const safeToLevel = safeToAsc === fromAsc ? Math.max(toLevel, fromLevel) : toLevel

  const handleWeaponFromAscChange = useCallback((a) => { setWeaponFromAsc(a); setWeaponFromLevel((lv) => clampLevel(lv, a)) }, [])
  const handleWeaponToAscChange   = useCallback((a) => { setWeaponToAsc(a);   setWeaponToLevel((lv) => clampLevel(lv, a)) }, [])

  const safeWeaponToAsc   = Math.max(weaponToAsc, weaponFromAsc)
  const safeWeaponToLevel = safeWeaponToAsc === weaponFromAsc ? Math.max(weaponToLevel, weaponFromLevel) : weaponToLevel

  // ── Live calculation ─────────────────────────────────────────────────────
  const ascCosts = useMemo(
    () => calculateProgressionCost(character, fromLevel, fromAsc, safeToLevel, safeToAsc, costsData),
    [character, fromLevel, fromAsc, safeToLevel, safeToAsc]
  )

  const talentCosts = useMemo(
    () => calculateAllTalentsCost(character, { normalFrom, normalTo, skillFrom, skillTo, burstFrom, burstTo }),
    [character, normalFrom, normalTo, skillFrom, skillTo, burstFrom, burstTo]
  )

  const weaponCosts = useMemo(
    () => {
      if (!selectedWeaponData) return { weaponMora: 0, mysticOre: 0, ascMats: {}, eliteMob: {}, mob: {}, hasAnyCost: false }
      return calculateWeaponCost(selectedWeaponData, weaponFromLevel, weaponFromAsc, safeWeaponToLevel, safeWeaponToAsc)
    },
    [selectedWeaponData, weaponFromLevel, weaponFromAsc, safeWeaponToLevel, safeWeaponToAsc]
  )

  const combinedMora = ascCosts.totalMora + talentCosts.talentMora + weaponCosts.weaponMora
  const hasAnyCost   = ascCosts.hasAnyCost || talentCosts.hasAnyCost || weaponCosts.hasAnyCost

  // Merge mob mats from ascension, talents, and weapon
  const allMob = { ...ascCosts.mob }
  if (talentCosts.mob) {
    for (const [k, v] of Object.entries(talentCosts.mob)) {
      allMob[k] = (allMob[k] || 0) + v
    }
  }
  if (weaponCosts.mob) {
    for (const [k, v] of Object.entries(weaponCosts.mob)) {
      allMob[k] = (allMob[k] || 0) + v
    }
  }

  // Merge elite mobs if weapon uses them (weapons use elite mats, characters don't typically but we handle it safely)
  const allEliteMob = { ...weaponCosts.eliteMob }

  // ── Save to Zustand ──────────────────────────────────────────────────────
  const handleSave = () => {
    if (!inRoster) addCharacter(name)
    updateCharacter(name, {
      level:            fromLevel,
      ascension:        fromAsc,
      targetLevel:      safeToLevel,
      targetAscension:  safeToAsc,
      talents:          { normal: normalFrom, skill: skillFrom, burst: burstFrom },
      targetTalents:    { normal: normalTo,   skill: skillTo,   burst: burstTo   },
      equippedWeaponId: localWeaponId, // write the draft ID to persist the link
    })
    onClose()
  }

  // ── Keyboard / scroll lock ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const elColor = elConfig.color

  return createPortal(
    <div
      id="char-modal-overlay"
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true"
      aria-label={`${displayName} character details`}
    >
      <div className="modal-panel" id="char-modal-panel">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="modal-header" style={{ background: elConfig.avatarGradient }}>
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse at 20% 50%, ${elColor}, transparent 60%)` }} />
          <div className="relative flex items-center gap-5 p-6 pb-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-cinzel font-bold text-3xl flex-shrink-0 border-2 relative overflow-hidden"
              style={{ background: `${elColor}22`, borderColor: `${elColor}60`, color: elColor, textShadow: `0 0 20px ${elColor}` }}>
              <GenshinImage 
                src={getCharacterAvatar(name)} 
                alt={name} 
                className="w-full h-full object-cover absolute inset-0 z-10" 
                fallback={<span className="relative z-10">{initials}</span>} 
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${rarityClass}`}>{stars}</span>
              <h2 className="font-cinzel font-bold text-2xl text-[var(--text)] leading-tight mt-0.5 truncate">{displayName}</h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{ background: elConfig.colorDim, borderColor: `${elColor}60`, color: elColor }}>
                  <GenshinImage src={getElementIcon(element)} alt={element} className="w-4 h-4 object-contain" fallback={<span>{elConfig.emoji}</span>} />
                  <span>{element}</span>
                </span>
                {wpConfig && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] bg-black/20">
                    {wpConfig.emoji} {weapon_type}
                  </span>
                )}
                {inRoster && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
                    style={{ background: 'rgba(200,169,110,0.2)', borderColor: 'rgba(200,169,110,0.5)', color: 'var(--gold)' }}>
                    ✓ In Roster
                  </span>
                )}
              </div>
            </div>
            <button id="modal-close-btn" onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              style={{ background: 'rgba(0,0,0,0.3)' }} aria-label="Close modal">✕</button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────── */}
        <div className="modal-body">

          {/* ── Character Progression Range ──────────────────────── */}
          <section className="mb-6">
            <h3 className="modal-section-title">⚙️ Character Progression</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="modal-state-panel">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">📍 Current State</p>
                <AscensionSelector value={fromAsc} onChange={handleFromAscChange} label="Ascension" elementColor={elColor} />
                <div className="mt-4">
                  <LevelSlider value={fromLevel} onChange={setFromLevel} ascension={fromAsc} label="Level" elementColor={elColor} />
                </div>
              </div>
              <div className="modal-state-panel">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Target State</p>
                <AscensionSelector value={safeToAsc} onChange={handleToAscChange} label="Ascension" elementColor={elColor} />
                <div className="mt-4">
                  <LevelSlider value={safeToLevel} onChange={setToLevel} ascension={safeToAsc} label="Level" elementColor={elColor} />
                </div>
              </div>
            </div>
            {/* Range bar */}
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: `${elColor}10`, border: `1px solid ${elColor}30` }}>
              {/* Character Avatar */}
              <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden" style={{ background: elConfig.avatarGradient }}>
                <GenshinImage 
                  src={getCharacterAvatar(name)} 
                  alt={name} 
                  className="w-full h-full object-cover absolute inset-0 z-10" 
                  fallback={<span className="font-cinzel text-xl relative z-10" style={{ color: elConfig.color }}>{name.substring(0, 1).toUpperCase()}</span>} 
                />
              </div>
              <span className="font-cinzel font-bold text-sm" style={{ color: elColor }}>A{fromAsc} Lv{fromLevel}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-px" style={{ background: `${elColor}40` }} />
                <span className="text-[10px] text-[var(--muted)] px-1">to</span>
                <div className="flex-1 h-px" style={{ background: `${elColor}40` }} />
              </div>
              <span className="font-cinzel font-bold text-sm" style={{ color: elColor }}>A{safeToAsc} Lv{safeToLevel}</span>
            </div>
          </section>

          {/* ── Talents ────────────────────────────────── */}
          <section className="mb-6">
            <h3 className="modal-section-title">📖 Talent Levels</h3>
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--elevated)]">
              <TalentRow
                icon="⚔️" label="Normal Attack"
                fromVal={normalFrom} toVal={normalTo}
                onFromChange={setNormalFrom} onToChange={setNormalTo}
                elementColor={elColor} charName={name} skill="normal"
              />
              <TalentRow
                icon="💠" label="Elemental Skill"
                fromVal={skillFrom} toVal={skillTo}
                onFromChange={setSkillFrom} onToChange={setSkillTo}
                elementColor={elColor} charName={name} skill="skill"
              />
              <TalentRow
                icon="🌀" label="Elemental Burst"
                fromVal={burstFrom} toVal={burstTo}
                onFromChange={setBurstFrom} onToChange={setBurstTo}
                elementColor={elColor} charName={name} skill="burst"
              />
            </div>
          </section>

          {/* ── Equipped Weapon ─────────────────────────── */}
          <section className="mb-6">
            <h3 className="modal-section-title">🗡️ Equipped Weapon</h3>
            <div className="mb-4">
            <select
                className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-xl px-4 py-3 outline-none focus:border-[var(--gold)] transition-colors"
                value={equippedWeaponName || ''}
                onChange={(e) => {
                  const newName = e.target.value || null
                  if (!newName) {
                    // User cleared the weapon
                    if (localWeaponId) unassignWeapon(localWeaponId)
                    setLocalWeaponId(null)
                  } else if (newName !== equippedWeaponName) {
                    // New weapon selected: unassign old, create new tracked entry, capture ID
                    if (localWeaponId) unassignWeapon(localWeaponId)
                    const newId = addTrackedWeapon(newName, name)
                    setLocalWeaponId(newId)
                  }
                }}
              >
                <option value="">-- No Weapon Equipped --</option>
                {/* Group by rarity */}
                {[5, 4, 3, 2, 1].map((r) => {
                  const items = availableWeapons.filter(w => w.rarity === r)
                  if (items.length === 0) return null
                  return (
                    <optgroup key={r} label={`${'\u2605'.repeat(r)} Weapons`}>
                      {items.map(w => (
                        <option key={w.name} value={w.name}>{formatName(w.name)}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {equippedWeaponName && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                <div className="modal-state-panel">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">📍 Weapon Current</p>
                  <AscensionSelector value={weaponFromAsc} onChange={(a) => { setWeaponFromAsc(a); if (localWeaponId) updateTrackedWeapon(localWeaponId, { ascension: a }) }} label="Ascension" elementColor="#9CA3AF" />
                  <div className="mt-4">
                    <LevelSlider value={weaponFromLevel} onChange={(lv) => { setWeaponFromLevel(lv); if (localWeaponId) updateTrackedWeapon(localWeaponId, { level: lv }) }} ascension={weaponFromAsc} label="Level" elementColor="#9CA3AF" />
                  </div>
                </div>
                <div className="modal-state-panel">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Weapon Target</p>
                  <AscensionSelector value={safeWeaponToAsc} onChange={(a) => { setWeaponToAsc(a); if (localWeaponId) updateTrackedWeapon(localWeaponId, { targetAscension: a }) }} label="Ascension" elementColor="var(--gold)" />
                  <div className="mt-4">
                    <LevelSlider value={safeWeaponToLevel} onChange={(lv) => { setWeaponToLevel(lv); if (localWeaponId) updateTrackedWeapon(localWeaponId, { targetLevel: lv }) }} ascension={safeWeaponToAsc} label="Level" elementColor="var(--gold)" />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Required Resources ─────────────────────── */}
          <section className="mb-6">
            <h3 className="modal-section-title">💰 Required Resources</h3>
            {hasAnyCost ? (
              <>
                <div className="rounded-xl border border-[var(--border)] overflow-hidden mb-4">
                  <CostRow icon="🪙" label="Total Mora" value={formatNumber(combinedMora)} accent="#C8A96E" large />
                  {ascCosts.levelingMora > 0 && (
                    <CostRow icon="📈" label="└ Char Leveling"   value={formatNumber(ascCosts.levelingMora)}   accent="#A07840" />
                  )}
                  {ascCosts.ascensionMora > 0 && (
                    <CostRow icon="🔮" label="└ Char Ascension"  value={formatNumber(ascCosts.ascensionMora)}  accent="#A07840" />
                  )}
                  {talentCosts.talentMora > 0 && (
                    <CostRow icon="📖" label="└ Talent Mora"     value={formatNumber(talentCosts.talentMora)} accent="#A07840" />
                  )}
                  {weaponCosts.weaponMora > 0 && (
                    <CostRow icon="🗡️" label="└ Weapon Mora"     value={formatNumber(weaponCosts.weaponMora)} accent="#A07840" />
                  )}
                  {ascCosts.heroWits > 0 && (
                    <CostRow icon="📚" label="Hero's Wit"        value={`×${ascCosts.heroWits}`}              accent="#60A5FA" />
                  )}
                  {weaponCosts.mysticOre > 0 && (
                    <CostRow icon="💠" label="Mystic Enh. Ore"   value={`×${weaponCosts.mysticOre}`}          accent="#F472B6" />
                  )}
                  {talentCosts.crown > 0 && (
                    <CostRow icon="👑" label="Crown of Insight"  value={`×${talentCosts.crown}`}              accent="#FBBF24" />
                  )}
                </div>

                <MaterialGroup icon="💎" title="Character Ascension Gems"        items={ascCosts.gemstones}   elementColor={elColor} />
                {ascCosts.worldBoss && (
                  <MaterialGroup icon="🐉" title="World Boss"     items={ascCosts.worldBoss}   elementColor={elColor} />
                )}
                <MaterialGroup icon="🌸" title="Local Specialty"  items={ascCosts.localSpecialty} elementColor={elColor} />
                <MaterialGroup icon="📖" title="Talent Books"     items={talentCosts.books}    elementColor={elColor} />
                {talentCosts.weeklyBoss && (
                  <MaterialGroup icon="👑" title="Weekly Boss"    items={talentCosts.weeklyBoss} elementColor={elColor} />
                )}
                <MaterialGroup icon="🔗" title="Weapon Ascension" items={weaponCosts.ascMats}  elementColor="var(--gold)" />
                <MaterialGroup icon="🛡️" title="Elite Mob Drops"  items={allEliteMob}          elementColor="var(--gold)" />
                {Object.keys(allMob).length > 0 && (
                  <MaterialGroup icon="⚔️" title="Mob Drops"     items={allMob}               elementColor={elColor} />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-8 text-center rounded-xl border border-[var(--border)]">
                <span className="text-3xl mb-2">✅</span>
                <p className="text-[var(--muted)] text-sm">Already at target — no resources needed!</p>
              </div>
            )}
          </section>

          {/* ── Material Sources ────────────────────────── */}
          {materials && (
            <section className="mb-6">
              <h3 className="modal-section-title">📖 Material Sources</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Character Ascension Gem', value: materials.gemstone,        icon: '💎' },
                  { label: 'Local Specialty',         value: materials.local_specialty, icon: '🌸' },
                  { label: 'Normal Boss Material',    value: materials.world_boss,      icon: '🐉' },
                  { label: 'Weekly Boss Material',    value: materials.weekly_boss,     icon: '🐺' },
                  { label: 'Talent Material',         value: materials.talent_book,     icon: '📚' },
                  { label: 'Common Enhancement Material', value: materials.mob_material,    icon: '⚔️' },
                ].filter(({ value }) => value && value !== 'nan').map(({ label, value, icon }) => (
                  <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[9px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-0.5">{icon} {label}</p>
                    <p className="text-xs text-[var(--text)] font-medium">{formatMaterialName(value)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Actions ────────────────────────────────── */}
          <div className="flex gap-3 pt-2 pb-1">
            <button
              id="modal-save-btn" onClick={handleSave}
              className="flex-1 py-3 rounded-xl font-cinzel font-bold text-sm transition-all duration-200"
              style={{ background: `linear-gradient(135deg, ${elColor}, ${elColor}99)`, color: '#0D0F1A', boxShadow: `0 4px 20px ${elColor}40` }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 6px 28px ${elColor}60`; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px ${elColor}40`;  e.currentTarget.style.transform = '' }}
            >
              {inRoster ? '💾 Save Progress' : '➕ Add & Save to Roster'}
            </button>
            {inRoster && (
              <button id="modal-remove-btn"
                onClick={() => { removeCharacter(name); onClose() }}
                className="px-4 py-3 rounded-xl font-medium text-sm transition-all border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)]">
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
