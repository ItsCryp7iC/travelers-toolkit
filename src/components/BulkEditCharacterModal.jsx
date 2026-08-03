import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'

// Minimal slider for bulk edit without character-specific contexts
function MinimalLevelSlider({ value, min, max, onChange, disabled }) {
  return (
    <div className={`flex items-center gap-3 bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)] transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[10px] font-mono font-bold text-[var(--muted)] bg-[var(--bg)] px-2 py-1 rounded min-w-[36px] text-center">
        {min}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 accent-[var(--gold)]"
        disabled={disabled}
      />
      <span className="text-[11px] font-mono font-bold text-[var(--gold)] bg-[var(--elevated)] px-2 py-1 rounded min-w-[40px] text-center border border-[var(--border)]">
        {value}
      </span>
    </div>
  )
}

function MinimalAscensionSelector({ value, max, onChange, disabled }) {
  return (
    <div className={`flex items-center gap-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {[0, 1, 2, 3, 4, 5, 6].map((a) => (
        <button
          key={a}
          onClick={() => onChange(a)}
          disabled={a > max || disabled}
          className={`w-7 h-7 rounded font-cinzel text-xs font-bold border transition-colors ${
            value === a
              ? 'bg-[var(--gold)] border-[var(--gold)] text-[var(--bg)] shadow-[0_0_8px_rgba(200,169,110,0.4)]'
              : a > max
              ? 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] opacity-30 cursor-not-allowed'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--gold)]'
          }`}
        >
          {a === 0 ? '-' : '✦'.repeat(a)}
        </button>
      ))}
    </div>
  )
}

export default function BulkEditCharacterModal({ isOpen, onClose, selectedIds, onSave }) {
  // Current State Overrides
  const [overrideFromLevel, setOverrideFromLevel] = useState(false)
  const [overrideFromAsc, setOverrideFromAsc] = useState(false)
  const [overrideNormalFrom, setOverrideNormalFrom] = useState(false)
  const [overrideSkillFrom, setOverrideSkillFrom] = useState(false)
  const [overrideBurstFrom, setOverrideBurstFrom] = useState(false)

  const [fromLevel, setFromLevel] = useState(1)
  const [fromAsc, setFromAsc] = useState(0)
  const [normalFrom, setNormalFrom] = useState(1)
  const [skillFrom, setSkillFrom] = useState(1)
  const [burstFrom, setBurstFrom] = useState(1)

  // Target State Overrides
  const [overrideToLevel, setOverrideToLevel] = useState(false)
  const [overrideToAsc, setOverrideToAsc] = useState(false)
  const [overrideNormalTo, setOverrideNormalTo] = useState(false)
  const [overrideSkillTo, setOverrideSkillTo] = useState(false)
  const [overrideBurstTo, setOverrideBurstTo] = useState(false)

  const [toLevel, setToLevel] = useState(90)
  const [toAsc, setToAsc] = useState(6)
  const [normalTo, setNormalTo] = useState(10)
  const [skillTo, setSkillTo] = useState(10)
  const [burstTo, setBurstTo] = useState(10)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Reset state
      setOverrideFromLevel(false); setOverrideFromAsc(false);
      setOverrideNormalFrom(false); setOverrideSkillFrom(false); setOverrideBurstFrom(false);
      setOverrideToLevel(false); setOverrideToAsc(false);
      setOverrideNormalTo(false); setOverrideSkillTo(false); setOverrideBurstTo(false);
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    const currentTalents = {}
    if (overrideNormalFrom) currentTalents.normal = normalFrom
    if (overrideSkillFrom) currentTalents.skill = skillFrom
    if (overrideBurstFrom) currentTalents.burst = burstFrom

    const targetTalents = {}
    if (overrideNormalTo) targetTalents.normal = normalTo
    if (overrideSkillTo) targetTalents.skill = skillTo
    if (overrideBurstTo) targetTalents.burst = burstTo

    onSave({
      level: overrideFromLevel ? fromLevel : undefined,
      ascension: overrideFromAsc ? fromAsc : undefined,
      targetLevel: overrideToLevel ? toLevel : undefined,
      targetAscension: overrideToAsc ? toAsc : undefined,
      talentsPatch: Object.keys(currentTalents).length > 0 ? currentTalents : undefined,
      targetTalentsPatch: Object.keys(targetTalents).length > 0 ? targetTalents : undefined
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-2xl bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="font-cinzel font-bold text-lg text-[var(--text)]">
            Bulk Edit ({selectedIds.length} Characters)
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* CURRENT STATE */}
          <section>
            <h3 className="modal-section-title">📉 Current State Overrides</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Level */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideFromLevel} onChange={(e) => setOverrideFromLevel(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Override Level
                </label>
                <MinimalLevelSlider value={fromLevel} min={1} max={90} onChange={(val) => { setFromLevel(val); setOverrideFromLevel(true); }} disabled={!overrideFromLevel} />
              </div>

              {/* Ascension */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideFromAsc} onChange={(e) => setOverrideFromAsc(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Override Ascension
                </label>
                <MinimalAscensionSelector value={fromAsc} max={6} onChange={(val) => { setFromAsc(val); setOverrideFromAsc(true); }} disabled={!overrideFromAsc} />
              </div>

              {/* Normal Attack */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideNormalFrom} onChange={(e) => setOverrideNormalFrom(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Normal Attack
                </label>
                <MinimalLevelSlider value={normalFrom} min={1} max={10} onChange={(val) => { setNormalFrom(val); setOverrideNormalFrom(true); }} disabled={!overrideNormalFrom} />
              </div>

              {/* Skill */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideSkillFrom} onChange={(e) => setOverrideSkillFrom(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Elemental Skill
                </label>
                <MinimalLevelSlider value={skillFrom} min={1} max={10} onChange={(val) => { setSkillFrom(val); setOverrideSkillFrom(true); }} disabled={!overrideSkillFrom} />
              </div>

              {/* Burst */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideBurstFrom} onChange={(e) => setOverrideBurstFrom(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Elemental Burst
                </label>
                <MinimalLevelSlider value={burstFrom} min={1} max={10} onChange={(val) => { setBurstFrom(val); setOverrideBurstFrom(true); }} disabled={!overrideBurstFrom} />
              </div>
            </div>
          </section>

          {/* TARGET STATE */}
          <section>
            <h3 className="modal-section-title">📈 Target State Overrides</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Level */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideToLevel} onChange={(e) => setOverrideToLevel(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Override Target Level
                </label>
                <MinimalLevelSlider value={toLevel} min={1} max={90} onChange={(val) => { setToLevel(val); setOverrideToLevel(true); }} disabled={!overrideToLevel} />
              </div>

              {/* Ascension */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideToAsc} onChange={(e) => setOverrideToAsc(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Override Target Ascension
                </label>
                <MinimalAscensionSelector value={toAsc} max={6} onChange={(val) => { setToAsc(val); setOverrideToAsc(true); }} disabled={!overrideToAsc} />
              </div>

              {/* Normal Attack */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideNormalTo} onChange={(e) => setOverrideNormalTo(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Target Normal Attack
                </label>
                <MinimalLevelSlider value={normalTo} min={1} max={10} onChange={(val) => { setNormalTo(val); setOverrideNormalTo(true); }} disabled={!overrideNormalTo} />
              </div>

              {/* Skill */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideSkillTo} onChange={(e) => setOverrideSkillTo(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Target Elemental Skill
                </label>
                <MinimalLevelSlider value={skillTo} min={1} max={10} onChange={(val) => { setSkillTo(val); setOverrideSkillTo(true); }} disabled={!overrideSkillTo} />
              </div>

              {/* Burst */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                  <input type="checkbox" checked={overrideBurstTo} onChange={(e) => setOverrideBurstTo(e.target.checked)} className="accent-[var(--gold)] w-4 h-4 cursor-pointer" />
                  Target Elemental Burst
                </label>
                <MinimalLevelSlider value={burstTo} min={1} max={10} onChange={(val) => { setBurstTo(val); setOverrideBurstTo(true); }} disabled={!overrideBurstTo} />
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="genshin-btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md"
          >
            Apply Overrides
          </button>
        </div>
      </div>
    </div>
  )
}
