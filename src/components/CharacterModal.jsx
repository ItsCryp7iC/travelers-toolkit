import { acquireBodyScrollLock } from '../utils/scrollLock';
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../store/useStore'

import weaponsData from '../data/weapons.json'
import {
  ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass,
} from '../utils/gameData'
import GenshinImage from './GenshinImage'
import CustomSelect from './CustomSelect'
import { getElementIcon, getCharacterAvatar, getWeaponTypeIcon, getWeaponIcon } from '../utils/assetHelper'
import { getTravelerAwareWeaponId } from '../utils/travelerHelper'
import {
  clampLevel, getLevelRange, ASCENSION_CAPS
} from '../utils/calculator'

// ─── Ascension Phase Selector ──────────────────────────────────────────────
export function AscensionSelector({ value, onChange, label, elementColor, isCharacter = false }) {
  const getPhaseMax = (a) => (a === 6 && !isCharacter) ? 90 : ASCENSION_CAPS[a];

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
      <p className="text-xs text-[var(--muted)] mt-1">
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
        <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase">{label}</p>
        <span className="font-bold text-lg leading-none" style={{ color: elementColor }}>{value}</span>
      </div>
      <div className="relative py-1">
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="level-slider w-full"
          style={{ '--slider-color': elementColor, '--pct': `${pct}%` }}
          aria-label={`${label} level`}
        />
        <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
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
        className="w-8 h-7 rounded-lg border flex items-center justify-center font-bold text-sm select-none"
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:py-2.5 sm:px-3 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base sm:text-lg w-5 sm:w-6 text-center flex-shrink-0">{icon}</span>
        <p className="text-xs font-semibold sm:font-medium text-[var(--text)] truncate">{label}</p>
      </div>
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0 self-end sm:self-center">
        <div className="text-center">
          <p className="text-[10px] sm:text-xs text-[var(--muted)] mb-0.5 sm:mb-1 tracking-wider">CURRENT</p>
          <TalentStepper
            value={fromVal} onChange={onFromChange}
            elementColor="#9CA3AF"
            id={`talent-${charName}-${skill}-from`}
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 px-0.5 sm:px-1">
          <div className="h-px w-4 sm:w-6" style={{ background: `${elementColor}40` }} />
          <span className="text-[10px] sm:text-xs text-[var(--muted)]">→</span>
          <div className="h-px w-4 sm:w-6" style={{ background: `${elementColor}40` }} />
        </div>
        <div className="text-center">
          <p className="text-[10px] sm:text-xs text-[var(--muted)] mb-0.5 sm:mb-1 tracking-wider">TARGET</p>
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

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function CharacterModal({ character, onClose, onNext, onPrev, hasNext, hasPrev, slideDirection = 'next' }) {
  const { name, rarity, element, weapon_type, materials } = character

  const rosterEntry = useStore((s) => s.roster[name])
  const saveCharacterDraft = useStore((s) => s.saveCharacterDraft)
  const removeCharacter = useStore((s) => s.removeCharacter)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
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
  const getInitialWeapon = useCallback(() => {
    const initialId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
    return initialId ? trackedWeapons.find((w) => w.id === initialId) : null;
  }, [name, rosterEntry, trackedWeapons]);

  const [draftWeaponId, setDraftWeaponId] = useState(() => {
    return getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
  });

  // Local slider state — mirrors the draft weapon's progression
  const [weaponFromAsc, setWeaponFromAsc] = useState(() => {
    const initialId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
    const w = initialId ? trackedWeapons.find((item) => item.id === initialId) : null;
    return w?.ascension ?? 0;
  });
  const [weaponFromLevel, setWeaponFromLevel] = useState(() => {
    const initialId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
    const w = initialId ? trackedWeapons.find((item) => item.id === initialId) : null;
    return w?.level ?? 1;
  });
  const [weaponToAsc, setWeaponToAsc] = useState(() => {
    const initialId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
    const w = initialId ? trackedWeapons.find((item) => item.id === initialId) : null;
    return w?.targetAscension ?? 6;
  });
  const [weaponToLevel, setWeaponToLevel] = useState(() => {
    const initialId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
    const w = initialId ? trackedWeapons.find((item) => item.id === initialId) : null;
    return w?.targetLevel ?? 90;
  });

  // Pre-filter valid weapons for this character's weapon type from trackedWeapons only
  const compatibleOwnedWeapons = useMemo(() => {
    const cType = (character.weapon || character.weapon_type || '').toLowerCase().trim();

    return (trackedWeapons || [])
      .map((tw) => {
        const staticData = (weaponsData || []).find(
          (sw) =>
            sw.name === tw.weaponName ||
            (tw.weapon_id && sw.id && sw.id.toLowerCase() === tw.weapon_id.toLowerCase())
        );
        if (!staticData) return null; // Safely exclude invalid / unmapped static instances
        const wType = (staticData.type || staticData.weapon_type || '').toLowerCase().trim();
        if (wType !== cType) return null; // Safely exclude incompatible weapon types
        return {
          instance: tw,
          staticData,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const rarityA =
          typeof a.staticData.rarity === 'string'
            ? a.staticData.rarity.match(/★/g)?.length || parseInt(a.staticData.rarity, 10) || 0
            : Number(a.staticData.rarity) || 0;
        const rarityB =
          typeof b.staticData.rarity === 'string'
            ? b.staticData.rarity.match(/★/g)?.length || parseInt(b.staticData.rarity, 10) || 0
            : Number(b.staticData.rarity) || 0;
        if (rarityB !== rarityA) return rarityB - rarityA;
        const levelDiff = (b.instance.level ?? 1) - (a.instance.level ?? 1);
        if (levelDiff !== 0) return levelDiff;
        return (a.instance.weaponName || '').localeCompare(b.instance.weaponName || '');
      });
  }, [trackedWeapons, character]);

  const weaponOptions = useMemo(() => {
    return [
      { id: '', name: '— No Weapon Equipped —', subtitle: null, icon: null, rarity: 0 },
      ...compatibleOwnedWeapons.map(({ instance, staticData }) => ({
        id: instance.id,
        name: formatName(staticData.name || instance.weaponName),
        subtitle: `Lv ${instance.level ?? 1} R${instance.currentRefinement || 1} • ${
          instance.assignedTo ? `Assigned to: ${formatName(instance.assignedTo)}` : 'Unassigned'
        }`,
        icon: getWeaponIcon(staticData.name || instance.weaponName),
        rarity: staticData.rarity,
      })),
    ];
  }, [compatibleOwnedWeapons]);

  // ── Sync externally (re-opening same modal or navigating next/prev) ─────────
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
      const currentId = getTravelerAwareWeaponId(name, rosterEntry, trackedWeapons);
      const w = currentId ? trackedWeapons.find((item) => item.id === currentId) : null;
      setDraftWeaponId(w?.id ?? null);
      setWeaponFromAsc(w?.ascension ?? 0);
      setWeaponFromLevel(w?.level ?? 1);
      setWeaponToAsc(w?.targetAscension ?? 6);
      setWeaponToLevel(w?.targetLevel ?? 90);
    } else {
      setFromAsc(0);
      setFromLevel(1);
      setToAsc(6);
      setToLevel(90);
      setNormalFrom(1);
      setSkillFrom(1);
      setBurstFrom(1);
      setNormalTo(10);
      setSkillTo(10);
      setBurstTo(10);
      const currentId = getTravelerAwareWeaponId(name, null, trackedWeapons);
      const w = currentId ? trackedWeapons.find((item) => item.id === currentId) : null;
      setDraftWeaponId(w?.id ?? null);
      setWeaponFromAsc(w?.ascension ?? 0);
      setWeaponFromLevel(w?.level ?? 1);
      setWeaponToAsc(w?.targetAscension ?? 6);
      setWeaponToLevel(w?.targetLevel ?? 90);
    }
  }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFromAscChange = useCallback((a) => { setFromAsc(a); setFromLevel((lv) => clampLevel(lv, a)) }, [])
  const handleToAscChange = useCallback((a) => { setToAsc(a); setToLevel((lv) => clampLevel(lv, a)) }, [])

  const safeToAsc = Math.max(toAsc, fromAsc)
  const safeToLevel = safeToAsc === fromAsc ? Math.max(toLevel, fromLevel) : toLevel

  const handleWeaponFromAscChange = useCallback((a) => { setWeaponFromAsc(a); setWeaponFromLevel((lv) => clampLevel(lv, a)) }, [])
  const handleWeaponToAscChange = useCallback((a) => { setWeaponToAsc(a); setWeaponToLevel((lv) => clampLevel(lv, a)) }, [])

  const safeWeaponToAsc = Math.max(weaponToAsc, weaponFromAsc)
  const safeWeaponToLevel = safeWeaponToAsc === weaponFromAsc ? Math.max(weaponToLevel, weaponFromLevel) : weaponToLevel

  // ── Save to Zustand ──────────────────────────────────────────────────────
  const handleSave = () => {
    saveCharacterDraft(name, {
      level: fromLevel,
      ascension: fromAsc,
      targetLevel: safeToLevel,
      targetAscension: safeToAsc,
      talents: { normal: normalFrom, skill: skillFrom, burst: burstFrom },
      targetTalents: { normal: normalTo, skill: skillTo, burst: burstTo },
      weaponId: draftWeaponId,
      weaponProgression: draftWeaponId ? {
        ascension: weaponFromAsc,
        level: weaponFromLevel,
        targetAscension: safeWeaponToAsc,
        targetLevel: safeWeaponToLevel
      } : null
    });
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
    return acquireBodyScrollLock()
  }, [])

  const elColor = elConfig.color

  // Removed modal render trace logs

  return createPortal(
    <div
      id="char-modal-overlay"
      className="modal-overlay relative flex items-center justify-center p-0 sm:p-4 md:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true"
      aria-label={`${displayName} character details`}
    >
      {hasPrev && onPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 md:w-32 z-[60] items-center justify-center cursor-pointer transition-all hover:bg-gradient-to-r hover:from-white/10 hover:to-transparent group border-none outline-none"
          aria-label="Previous character"
        >
          <svg className="w-12 h-12 md:w-20 md:h-20 text-white/20 group-hover:text-white transition-all group-hover:-translate-x-2 duration-300 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {hasNext && onNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="hidden md:flex fixed right-0 top-0 bottom-0 w-16 md:w-32 z-[60] items-center justify-center cursor-pointer transition-all hover:bg-gradient-to-l hover:from-white/10 hover:to-transparent group border-none outline-none"
          aria-label="Next character"
        >
          <svg className="w-12 h-12 md:w-20 md:h-20 text-white/20 group-hover:text-white transition-all group-hover:translate-x-2 duration-300 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      <div className="w-full max-w-[1000px] flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl bg-[var(--elevated)] border-0 sm:border border-[var(--border)] animate-slide-up" id="char-modal-panel">
        <div key={name} className={`${slideDirection === 'next' ? 'animate-swipe-next' : 'animate-swipe-prev'} flex flex-col flex-1 h-full min-h-0`}>
        {/* ── Header ─────────────────────────────────────── */}
        <div className="modal-header relative shrink-0" style={{ background: elConfig.avatarGradient }}>
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse at 20% 50%, ${elColor}, transparent 60%)` }} />
          <div className="relative flex items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:pt-6 pb-3.5 sm:pb-5">
            <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-2xl sm:text-3xl flex-shrink-0 border-2 relative overflow-hidden"
                style={{ background: `${elColor}22`, borderColor: `${elColor}60`, color: elColor, textShadow: `0 0 20px ${elColor}` }}>
                <GenshinImage
                  src={getCharacterAvatar(name)}
                  alt={name}
                  className="w-full h-full object-cover absolute inset-0 z-10"
                  fallback={<span className="relative z-10">{initials}</span>}
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-xs sm:text-sm ${rarityClass}`}>{stars}</span>
                <h2 className="font-bold text-lg sm:text-2xl text-[var(--text)] leading-tight mt-0.5 line-clamp-2 sm:line-clamp-none break-words" title={displayName}>{displayName}</h2>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium border"
                    style={{ background: elConfig.colorDim, borderColor: `${elColor}60`, color: elColor }}>
                    <GenshinImage src={getElementIcon(element)} alt={element} className="w-4 h-4 sm:w-6 sm:h-6 object-contain" fallback={<span>{elConfig.emoji}</span>} />
                    <span>{element}</span>
                  </span>
                  {wpConfig && (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium border border-[var(--border)] text-[var(--muted)] bg-black/20">
                      <GenshinImage src={getWeaponTypeIcon(weapon_type)} alt={weapon_type} className="w-4 h-4 sm:w-6 sm:h-6 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
                      <span>{weapon_type}</span>
                    </span>
                  )}
                  {inRoster && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border"
                      style={{ background: 'rgba(200,169,110,0.2)', borderColor: 'rgba(200,169,110,0.5)', color: 'var(--gold)' }}>
                      ✓ In Roster
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Navigation + Close Controls */}
            <div className="flex items-center gap-1.5 shrink-0 z-20 self-start sm:self-center">
              {hasPrev && onPrev && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  className="w-8 h-8 rounded-lg flex md:hidden items-center justify-center text-white hover:text-white transition-colors bg-black/40 hover:bg-black/60 font-bold"
                  aria-label="Previous character"
                >‹</button>
              )}
              {hasNext && onNext && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  className="w-8 h-8 rounded-lg flex md:hidden items-center justify-center text-white hover:text-white transition-colors bg-black/40 hover:bg-black/60 font-bold"
                  aria-label="Next character"
                >›</button>
              )}
              <button
                id="modal-close-btn"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors bg-black/40 hover:bg-black/60"
                aria-label="Close modal"
              >✕</button>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────── */}
        <div className="modal-body flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3.5 sm:p-6 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent">

          {/* ── Character Progression Range ──────────────────────── */}
          <section className="mb-6">
            <h3 className="modal-section-title">⚙️ Character Progression</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="modal-state-panel">
                <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-4">📍 Current State</p>
                <AscensionSelector value={fromAsc} onChange={handleFromAscChange} label="Ascension" elementColor={elColor} isCharacter={true} />
                <div className="mt-4">
                  <LevelSlider value={fromLevel} onChange={setFromLevel} ascension={fromAsc} label="Level" elementColor={elColor} isCharacter={true} />
                </div>
              </div>
              <div className="modal-state-panel">
                <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Target State</p>
                <AscensionSelector value={safeToAsc} onChange={handleToAscChange} label="Ascension" elementColor={elColor} isCharacter={true} />
                <div className="mt-4">
                  <LevelSlider value={safeToLevel} onChange={setToLevel} ascension={safeToAsc} label="Level" elementColor={elColor} isCharacter={true} />
                </div>
              </div>
            </div>
            {/* Range bar */}
            <div className="mt-4 flex items-center gap-2 sm:gap-3 p-2.5 sm:px-4 sm:py-3 rounded-xl"
              style={{ background: `${elColor}10`, border: `1px solid ${elColor}30` }}>
              {/* Character Avatar */}
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 shadow-md relative overflow-hidden" style={{ background: elConfig.avatarGradient }}>
                <GenshinImage
                  src={getCharacterAvatar(name)}
                  alt={name}
                  className="w-full h-full object-cover absolute inset-0 z-10"
                  fallback={<span className="text-sm sm:text-xl relative z-10" style={{ color: elConfig.color }}>{name.substring(0, 1).toUpperCase()}</span>}
                />
              </div>
              <span className="font-bold text-xs sm:text-sm whitespace-nowrap" style={{ color: elColor }}>A{fromAsc} Lv{fromLevel}</span>
              <div className="flex-1 flex items-center gap-1 min-w-[20px]">
                <div className="flex-1 h-px" style={{ background: `${elColor}40` }} />
                <span className="text-[10px] sm:text-xs text-[var(--muted)] px-1">to</span>
                <div className="flex-1 h-px" style={{ background: `${elColor}40` }} />
              </div>
              <span className="font-bold text-xs sm:text-sm whitespace-nowrap" style={{ color: elColor }}>A{safeToAsc} Lv{safeToLevel}</span>
            </div>
          </section>

          {/* ── Talents ────────────────────────────────── */}
          <section className="mb-4 sm:mb-6">
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
          <section className="mb-4 sm:mb-6">
            <h3 className="modal-section-title">🗡️ Equipped Weapon</h3>
            <div className="mb-4">
              <CustomSelect
                placeholder="— No Weapon Equipped —"
                value={draftWeaponId || ''}
                onChange={(newId) => {
                  const selectedId = newId || null;
                  setDraftWeaponId(selectedId);
                  if (selectedId) {
                    const targetWeapon = trackedWeapons.find((w) => w.id === selectedId);
                    if (targetWeapon) {
                      setWeaponFromAsc(targetWeapon.ascension ?? 0);
                      setWeaponFromLevel(targetWeapon.level ?? 1);
                      setWeaponToAsc(targetWeapon.targetAscension ?? 6);
                      setWeaponToLevel(targetWeapon.targetLevel ?? 90);
                    }
                  } else {
                    setWeaponFromAsc(0);
                    setWeaponFromLevel(1);
                    setWeaponToAsc(6);
                    setWeaponToLevel(90);
                  }
                }}
                options={weaponOptions}
              />
              {compatibleOwnedWeapons.length === 0 && (
                <p className="text-xs text-[var(--muted)] mt-1.5">
                  No compatible tracked weapons in your Armory.
                </p>
              )}
            </div>

            {draftWeaponId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 mt-4">
                <div className="modal-state-panel">
                  <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-4">📍 Weapon Current</p>
                  <AscensionSelector value={weaponFromAsc} onChange={handleWeaponFromAscChange} label="Ascension" elementColor="#9CA3AF" isCharacter={false} />
                  <div className="mt-4">
                    <LevelSlider value={weaponFromLevel} onChange={setWeaponFromLevel} ascension={weaponFromAsc} label="Level" elementColor="#9CA3AF" isCharacter={false} />
                  </div>
                </div>
                <div className="modal-state-panel">
                  <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-4">🎯 Weapon Target</p>
                  <AscensionSelector value={safeWeaponToAsc} onChange={handleWeaponToAscChange} label="Ascension" elementColor="var(--gold)" isCharacter={false} />
                  <div className="mt-4">
                    <LevelSlider value={safeWeaponToLevel} onChange={setWeaponToLevel} ascension={safeWeaponToAsc} label="Level" elementColor="var(--gold)" isCharacter={false} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Actions ────────────────────────────────── */}
          <div className="pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-2 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2.5 sm:gap-3 shrink-0">
            <button
              id="modal-save-btn" onClick={handleSave}
              className="flex-1 py-3 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${elColor}, ${elColor}99)`, color: '#0D0F1A', boxShadow: `0 4px 20px ${elColor}40` }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 6px 28px ${elColor}60`; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px ${elColor}40`; e.currentTarget.style.transform = '' }}
            >
              {inRoster ? '💾 Save Progress' : '➕ Add & Save to Roster'}
            </button>
            {inRoster && (
              <button id="modal-remove-btn"
                onClick={() => { removeCharacter(name); onClose() }}
                aria-label={`Remove ${displayName} from roster`}
                title={`Remove ${displayName} from roster`}
                className="px-4 py-3 min-h-[44px] rounded-xl font-medium text-sm transition-all border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
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
