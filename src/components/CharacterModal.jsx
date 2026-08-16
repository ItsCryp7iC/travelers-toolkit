import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../store/useStore'
import costsData from '../data/costs.json'
import weaponsData from '../data/weapons.json'
import {
  ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass,
} from '../utils/gameData'
import GenshinImage from './GenshinImage'
import CustomSelect from './CustomSelect'
import { getElementIcon, getCharacterAvatar, getWeaponTypeIcon, getWeaponIcon } from '../utils/assetHelper'
import {
  calculateProgressionCost, calculateTalentCost, calculateAllTalentsCost, calculateWeaponCost,
  clampLevel, getLevelRange, ASCENSION_CAPS,
  formatNumber, formatMaterialName, WEAPON_ORE_KEY
} from '../utils/calculator'

// ─── Ascension Phase Selector ──────────────────────────────────────────────
export function AscensionSelector({ value, onChange, label, elementColor, isCharacter = false }) {
  const getPhaseMax = (a) => (a === 6 && !isCharacter) ? 90 : ASCENSION_CAPS[a];

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
            title={`A${a} — Max Lv${getPhaseMax(a)}`}
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
        Max Level: <span style={{ color: elementColor }}>Lv{getPhaseMax(value)}</span>
      </p>
    </div>
  )
}

// ─── Level Slider ─────────────────────────────────────────────────────────
export function LevelSlider({ value, onChange, ascension, label, elementColor, isCharacter = false }) {
  const range = getLevelRange(ascension)
  const min = range.min
  const max = isCharacter ? range.max : Math.min(range.max, 90)

  const handleChange = (val) => {
    let num = Number(val)
    if (isCharacter && ascension === 6 && num > 90) {
      if (num < 98) num = 95
      else num = 100
    }
    onChange(num)
  }

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">{label}</p>
        <span className="font-cinzel font-bold text-lg leading-none" style={{ color: elementColor }}>{value}</span>
      </div>
      <div className="relative py-1">
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="level-slider w-full"
          style={{ '--slider-color': elementColor, '--pct': `${pct}%` }}
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
export function TalentStepper({ value, onChange, min = 1, max = 10, elementColor, id }) {
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
export function TalentRow({ icon, label, fromVal, toVal, onFromChange, onToChange, elementColor, charName, skill }) {
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
export default function CharacterModal({ character, onClose, onNext, onPrev, hasNext, hasPrev, slideDirection = 'next' }) {
  const { name, rarity, element, weapon_type, materials } = character

  const rosterEntry = useStore((s) => s.roster[name])
  const fullRoster = useStore((s) => s.roster)
  const addCharacter = useStore((s) => s.addCharacter)
  const updateCharacter = useStore((s) => s.updateCharacter)
  const removeCharacter = useStore((s) => s.removeCharacter)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const addTrackedWeapon = useStore((s) => s.addTrackedWeapon)
  const updateTrackedWeapon = useStore((s) => s.updateTrackedWeapon)
  const unassignWeapon = useStore((s) => s.unassignWeapon)
  const inRoster = Boolean(rosterEntry)

  const elConfig = ELEMENTS[element] || ELEMENTS.Unknown
  const wpConfig = WEAPON_TYPES[weapon_type]
  const displayName = formatName(name)
  const initials = getInitials(name)
  const stars = getStars(rarity)
  const rarityClass = getRarityClass(rarity)

  // ── Progression state ────────────────────────────────────────────────────
  const [fromAsc, setFromAsc] = useState(rosterEntry?.ascension ?? 0)
  const [fromLevel, setFromLevel] = useState(rosterEntry?.level ?? 1)
  const [toAsc, setToAsc] = useState(rosterEntry?.targetAscension ?? 6)
  const [toLevel, setToLevel] = useState(rosterEntry?.targetLevel ?? 90)

  // ── Talent state ─────────────────────────────────────────────────────────
  const [normalFrom, setNormalFrom] = useState(rosterEntry?.talents?.normal ?? 1)
  const [skillFrom, setSkillFrom] = useState(rosterEntry?.talents?.skill ?? 1)
  const [burstFrom, setBurstFrom] = useState(rosterEntry?.talents?.burst ?? 1)
  const [normalTo, setNormalTo] = useState(rosterEntry?.targetTalents?.normal ?? 10)
  const [skillTo, setSkillTo] = useState(rosterEntry?.targetTalents?.skill ?? 10)
  const [burstTo, setBurstTo] = useState(rosterEntry?.targetTalents?.burst ?? 10)

  // ── Weapon state — local draft mirrors equippedWeaponId until Save ──────────
  const [localWeaponId, setLocalWeaponId] = useState(rosterEntry?.equippedWeaponId ?? null)

  // Derive display data from localWeaponId against the live trackedWeapons list
  const trackedWeapon = localWeaponId ? trackedWeapons.find((w) => w.id === localWeaponId) : null
  const equippedWeaponName = trackedWeapon?.weaponName ?? null

  // Local slider state — mirrors the tracked weapon's progression
  const [weaponFromAsc, setWeaponFromAsc] = useState(trackedWeapon?.ascension ?? 0)
  const [weaponFromLevel, setWeaponFromLevel] = useState(trackedWeapon?.level ?? 1)
  const [weaponToAsc, setWeaponToAsc] = useState(trackedWeapon?.targetAscension ?? 6)
  const [weaponToLevel, setWeaponToLevel] = useState(trackedWeapon?.targetLevel ?? 90)

  // Pre-filter valid weapons for this character's weapon type strictly
  const compatibleWeapons = useMemo(() => {
    return (weaponsData || [])
      .filter(w => {
        const wType = (w.type || w.weapon_type || '').toLowerCase().trim();
        const cType = (character.weapon || character.weapon_type || '').toLowerCase().trim();
        return wType === cType;
      })
      .sort((a, b) => {
        // Sort by string length of the stars (e.g., '★★★★★' is 5, '★★★★' is 4)
        const rarityA = (a.rarity || '').length;
        const rarityB = (b.rarity || '').length;
        return rarityB - rarityA;
      });
  }, [character])

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
      setNormalTo(rosterEntry.targetTalents?.normal ?? 10)
      setSkillTo(rosterEntry.targetTalents?.skill ?? 10)
      setBurstTo(rosterEntry.targetTalents?.burst ?? 10)
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
  const handleToAscChange = useCallback((a) => { setToAsc(a); setToLevel((lv) => clampLevel(lv, a)) }, [])

  const safeToAsc = Math.max(toAsc, fromAsc)
  const safeToLevel = safeToAsc === fromAsc ? Math.max(toLevel, fromLevel) : toLevel

  const handleWeaponFromAscChange = useCallback((a) => { setWeaponFromAsc(a); setWeaponFromLevel((lv) => clampLevel(lv, a)) }, [])
  const handleWeaponToAscChange = useCallback((a) => { setWeaponToAsc(a); setWeaponToLevel((lv) => clampLevel(lv, a)) }, [])

  const safeWeaponToAsc = Math.max(weaponToAsc, weaponFromAsc)
  const safeWeaponToLevel = safeWeaponToAsc === weaponFromAsc ? Math.max(weaponToLevel, weaponFromLevel) : weaponToLevel

  // ── Live calculation ─────────────────────────────────────────────────────
  const ascCosts = useMemo(
    () => calculateProgressionCost(character, fromLevel, safeToLevel),
    [character, fromLevel, safeToLevel]
  )

  const normalCosts = useMemo(() => calculateTalentCost(character, normalFrom, normalTo), [character, normalFrom, normalTo]);
  const skillCosts = useMemo(() => calculateTalentCost(character, skillFrom, skillTo), [character, skillFrom, skillTo]);
  const burstCosts = useMemo(() => calculateTalentCost(character, burstFrom, burstTo), [character, burstFrom, burstTo]);

  const weaponCosts = useMemo(
    () => {
      if (!selectedWeaponData) return {};
      return calculateWeaponCost(selectedWeaponData, weaponFromLevel, safeWeaponToLevel, weaponFromAsc, safeWeaponToAsc, false, fullRoster)
    },
    [selectedWeaponData, weaponFromLevel, safeWeaponToLevel, weaponFromAsc, safeWeaponToAsc, fullRoster]
  )

  const totalCosts = {};
  const allCostObjects = [ascCosts, normalCosts, skillCosts, burstCosts, weaponCosts];

  allCostObjects.forEach(costObj => {
    if (!costObj) return;
    Object.entries(costObj).forEach(([key, val]) => {
      if (typeof val === 'number' && val > 0) {
        totalCosts[key] = (totalCosts[key] || 0) + val;
      }
    });
  });

  const hasAnyCost = Object.values(totalCosts).some(val => val > 0);

  // ── Save to Zustand ──────────────────────────────────────────────────────
  const handleSave = () => {
    if (!inRoster) addCharacter(name)
    updateCharacter(name, {
      level: fromLevel,
      ascension: fromAsc,
      targetLevel: safeToLevel,
      targetAscension: safeToAsc,
      talents: { normal: normalFrom, skill: skillFrom, burst: burstFrom },
      targetTalents: { normal: normalTo, skill: skillTo, burst: burstTo },
      equippedWeaponId: localWeaponId, // write the draft ID to persist the link
    })
    onClose()
  }

  // ── Keyboard / scroll lock ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext()
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onNext, onPrev, hasNext, hasPrev])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const elColor = elConfig.color

  // Removed modal render trace logs

  return createPortal(
    <div
      id="char-modal-overlay"
      className="modal-overlay relative"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true"
      aria-label={`${displayName} character details`}
    >
      {hasPrev && onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="fixed left-0 top-0 bottom-0 w-16 md:w-32 z-[60] flex items-center justify-center cursor-pointer transition-all hover:bg-gradient-to-r hover:from-white/10 hover:to-transparent group border-none outline-none"
          aria-label="Previous character"
        >
          <svg className="w-12 h-12 md:w-20 md:h-20 text-white/20 group-hover:text-white transition-all group-hover:-translate-x-2 duration-300 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {hasNext && onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="fixed right-0 top-0 bottom-0 w-16 md:w-32 z-[60] flex items-center justify-center cursor-pointer transition-all hover:bg-gradient-to-l hover:from-white/10 hover:to-transparent group border-none outline-none"
          aria-label="Next character"
        >
          <svg className="w-12 h-12 md:w-20 md:h-20 text-white/20 group-hover:text-white transition-all group-hover:translate-x-2 duration-300 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      <div className="modal-panel" id="char-modal-panel">
        <div key={name} className={`${slideDirection === 'next' ? 'animate-swipe-next' : 'animate-swipe-prev'} flex flex-col h-full`}>
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
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border"
                  style={{ background: elConfig.colorDim, borderColor: `${elColor}60`, color: elColor }}>
                  <GenshinImage src={getElementIcon(element)} alt={element} className="w-6 h-6 object-contain" fallback={<span>{elConfig.emoji}</span>} />
                  <span>{element}</span>
                </span>
                {wpConfig && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-[var(--border)] text-[var(--muted)] bg-black/20">
                    <GenshinImage src={getWeaponTypeIcon(weapon_type)} alt={weapon_type} className="w-6 h-6 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
                    <span>{weapon_type}</span>
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
                <AscensionSelector value={fromAsc} onChange={handleFromAscChange} label="Ascension" elementColor={elColor} isCharacter={true} />
                <div className="mt-4">
                  <LevelSlider value={fromLevel} onChange={setFromLevel} ascension={fromAsc} label="Level" elementColor={elColor} isCharacter={true} />
                </div>
              </div>
              <div className="modal-state-panel">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Target State</p>
                <AscensionSelector value={safeToAsc} onChange={handleToAscChange} label="Ascension" elementColor={elColor} isCharacter={true} />
                <div className="mt-4">
                  <LevelSlider value={safeToLevel} onChange={setToLevel} ascension={safeToAsc} label="Level" elementColor={elColor} isCharacter={true} />
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
              <CustomSelect
                placeholder="-- No Weapon Equipped --"
                value={equippedWeaponName || ''}
                onChange={(newName) => {
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
                options={[
                  { id: '', name: '— No Weapon Equipped —', icon: null, rarity: 0 },
                  ...compatibleWeapons.map(w => ({
                    id: w.name,
                    name: formatName(w.name),
                    icon: getWeaponIcon(w.name),
                    rarity: w.rarity
                  }))
                ]}
              />
            </div>

            {equippedWeaponName && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                <div className="modal-state-panel">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">📍 Weapon Current</p>
                  <AscensionSelector value={weaponFromAsc} onChange={(a) => { setWeaponFromAsc(a); if (localWeaponId) updateTrackedWeapon(localWeaponId, { ascension: a }) }} label="Ascension" elementColor="#9CA3AF" isCharacter={false} />
                  <div className="mt-4">
                    <LevelSlider value={weaponFromLevel} onChange={(lv) => { setWeaponFromLevel(lv); if (localWeaponId) updateTrackedWeapon(localWeaponId, { level: lv }) }} ascension={weaponFromAsc} label="Level" elementColor="#9CA3AF" isCharacter={false} />
                  </div>
                </div>
                <div className="modal-state-panel">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Weapon Target</p>
                  <AscensionSelector value={safeWeaponToAsc} onChange={(a) => { setWeaponToAsc(a); if (localWeaponId) updateTrackedWeapon(localWeaponId, { targetAscension: a }) }} label="Ascension" elementColor="var(--gold)" isCharacter={false} />
                  <div className="mt-4">
                    <LevelSlider value={safeWeaponToLevel} onChange={(lv) => { setWeaponToLevel(lv); if (localWeaponId) updateTrackedWeapon(localWeaponId, { targetLevel: lv }) }} ascension={safeWeaponToAsc} label="Level" elementColor="var(--gold)" isCharacter={false} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ✨ Required Resources ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨ */}
          {weaponCosts?.has_ascension_discount && (
            <div className="mb-4 bg-green-900/20 border border-green-700/50 rounded-lg p-3 flex items-center justify-center gap-2">
              <span className="text-xl">✨</span>
              <p className="text-green-400 text-sm font-semibold">
                50% Ascension Mora reduction active via {weaponCosts.discount_source}'s passive!
              </p>
            </div>
          )}
          <section className="mb-6">
            <h3 className="modal-section-title">💰 Required Resources</h3>
            {hasAnyCost ? (
              <>
                <div className="rounded-xl border border-[var(--border)] overflow-hidden mb-4">
                  <CostRow icon="💰" label="Total Mora" value={formatNumber(totalCosts['mora'] || 0)} accent="#C8A96E" large />
                  {totalCosts['heros_wit'] > 0 && (
                    <CostRow icon="📚" label="Hero's Wit" value={`×${totalCosts['heros_wit']}`} accent="#60A5FA" />
                  )}
                  {totalCosts['mystic_ore'] > 0 && (
                    <CostRow icon="💠" label="Mystic Enh. Ore" value={`×${totalCosts['mystic_ore']}`} accent="#F472B6" />
                  )}
                  {totalCosts['crown'] > 0 && (
                    <CostRow icon="👑" label="Crown of Insight" value={`×${totalCosts['crown']}`} accent="#FBBF24" />
                  )}
                </div>

                <MaterialGroup icon="⭐" title="Awakening" items={totalCosts['masterless_stella_fortuna'] > 0 ? { "Masterless Stella Fortuna": totalCosts['masterless_stella_fortuna'] } : null} elementColor={elColor} />

                <MaterialGroup icon="💎" title="Character Ascension Gems" items={Object.fromEntries(
                  Object.entries({
                    "Sliver": totalCosts['gem_sliver'],
                    "Fragment": totalCosts['gem_fragment'],
                    "Chunk": totalCosts['gem_chunk'],
                    "Gemstone": totalCosts['gem_gemstone']
                  }).filter(([_, v]) => v > 0)
                )} elementColor={elColor} />

                <MaterialGroup icon="🐉" title="World Boss" items={totalCosts['boss_material'] > 0 ? { "Boss Material": totalCosts['boss_material'] } : null} elementColor={elColor} />

                <MaterialGroup icon="🌸" title="Local Specialty" items={totalCosts['local_specialty'] > 0 ? { "Local Specialty": totalCosts['local_specialty'] } : null} elementColor={elColor} />

                <MaterialGroup icon="📖" title="Talent Books" items={Object.fromEntries(
                  Object.entries({
                    "2-Star Book": totalCosts['2_star_talent_material'],
                    "3-Star Book": totalCosts['3_star_talent_material'],
                    "4-Star Book": totalCosts['4_star_talent_material']
                  }).filter(([_, v]) => v > 0)
                )} elementColor={elColor} />

                <MaterialGroup icon="🐺" title="Weekly Boss" items={totalCosts['weekly_boss_material'] > 0 ? { "Weekly Boss Material": totalCosts['weekly_boss_material'] } : null} elementColor={elColor} />

                <MaterialGroup icon="🔗" title="Weapon Ascension" items={Object.fromEntries(
                  Object.entries({
                    "2-Star Material": totalCosts['2_star_ascension_material'],
                    "3-Star Material": totalCosts['3_star_ascension_material'],
                    "4-Star Material": totalCosts['4_star_ascension_material'],
                    "5-Star Material": totalCosts['5_star_ascension_material']
                  }).filter(([_, v]) => v > 0)
                )} elementColor="var(--gold)" />

                <MaterialGroup icon="🛡️" title="Weapon Elite Drops" items={Object.fromEntries(
                  Object.entries({
                    "2-Star Material": totalCosts['2_star_enhancement_material'],
                    "3-Star Material": totalCosts['3_star_enhancement_material'],
                    "4-Star Material": totalCosts['4_star_enhancement_material']
                  }).filter(([_, v]) => v > 0)
                )} elementColor="var(--gold)" />

                <MaterialGroup icon="⚔️" title="Enemy Drops" items={Object.fromEntries(
                  Object.entries({
                    "1-Star Material": totalCosts['1_star_enemy_material'],
                    "2-Star Material": totalCosts['2_star_enemy_material'],
                    "3-Star Material": totalCosts['3_star_enemy_material']
                  }).filter(([_, v]) => v > 0)
                )} elementColor={elColor} />
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
                  { label: 'Character Ascension Gem', value: materials.gemstone, icon: '💎' },
                  { label: 'Local Specialty', value: materials.local_specialty, icon: '🌸' },
                  { label: 'Normal Boss Material', value: materials.world_boss, icon: '🐉' },
                  { label: 'Weekly Boss Material', value: materials.weekly_boss, icon: '🐺' },
                  { label: 'Talent Material', value: materials.talent_book, icon: '📚' },
                  { label: 'Common Enhancement Material', value: materials.mob_material, icon: '⚔️' },
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
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px ${elColor}40`; e.currentTarget.style.transform = '' }}
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
      </div>
    </div>,
    document.body
  )
}
