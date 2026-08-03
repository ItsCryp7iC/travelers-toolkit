import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { LevelSlider, AscensionSelector, TalentRow } from './CharacterModal'

export default function BulkEditCharacterModal({ isOpen, onClose, selectedIds, onSave }) {
  // Baseline initial state for bulk edit
  const [fromLevel, setFromLevel] = useState(1)
  const [fromAsc, setFromAsc] = useState(0)
  const [toLevel, setToLevel] = useState(90)
  const [toAsc, setToAsc] = useState(6)

  const [normalFrom, setNormalFrom] = useState(1)
  const [skillFrom, setSkillFrom] = useState(1)
  const [burstFrom, setBurstFrom] = useState(1)

  const [normalTo, setNormalTo] = useState(10)
  const [skillTo, setSkillTo] = useState(10)
  const [burstTo, setBurstTo] = useState(10)

  // Use a generic gold color for the bulk edit modal since it applies to many elements
  const elColor = "var(--gold)"

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Reset state to baseline on close
      setFromLevel(1)
      setFromAsc(0)
      setToLevel(90)
      setToAsc(6)
      setNormalFrom(1)
      setSkillFrom(1)
      setBurstFrom(1)
      setNormalTo(10)
      setSkillTo(10)
      setBurstTo(10)
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    const patch = {
      level: fromLevel,
      ascension: fromAsc,
      targetLevel: toLevel,
      targetAscension: toAsc,
      talents: {
        normal: normalFrom,
        skill: skillFrom,
        burst: burstFrom
      },
      targetTalents: {
        normal: normalTo,
        skill: skillTo,
        burst: burstTo
      }
    }
    
    // Instead of doing shallow talentsPatch, we provide full nested objects 
    // to override them perfectly, which simplifies the store logic significantly!
    onSave(patch)
  }

  // Ensure safe values for UI sliders based on current min selections
  const safeToLevel = Math.max(toLevel, fromLevel)
  const safeToAsc = Math.max(toAsc, fromAsc)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)] animate-slide-up relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <h2 className="font-cinzel font-bold text-xl text-[var(--text)]">
              Bulk Edit Configuration
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="bg-[var(--gold)]/10 text-[var(--gold)] px-6 py-2 text-xs font-semibold text-center border-b border-[var(--gold)]/20">
          Updating {selectedIds.length} characters
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          
          {/* Progression Section */}
          <section>
            <h3 className="modal-section-title text-sm mb-4">📈 Character Progression Overrides</h3>
            <div className="grid grid-cols-2 gap-8">
              {/* CURRENT */}
              <div className="space-y-4 relative">
                <div className="absolute -right-4 top-0 bottom-0 w-px bg-[var(--border)] hidden md:block"></div>
                <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Current</div>
                <AscensionSelector value={fromAsc} onChange={setFromAsc} label="Phase" elementColor={elColor} isCharacter={true} />
                <LevelSlider value={fromLevel} onChange={setFromLevel} ascension={fromAsc} label="Level" elementColor={elColor} isCharacter={true} />
              </div>

              {/* TARGET */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-[var(--gold)] uppercase tracking-wider mb-2">Target</div>
                <AscensionSelector value={safeToAsc} onChange={setToAsc} label="Phase" elementColor={elColor} isCharacter={true} />
                <LevelSlider value={safeToLevel} onChange={setToLevel} ascension={safeToAsc} label="Level" elementColor={elColor} isCharacter={true} />
              </div>
            </div>
          </section>

          {/* Talents Section */}
          <section>
            <h3 className="modal-section-title text-sm mb-4">⚔️ Talent Progression Overrides</h3>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] px-4 py-2">
              <TalentRow 
                icon="⚔️" 
                label="Normal Attack" 
                fromVal={normalFrom} 
                toVal={normalTo} 
                onFromChange={setNormalFrom} 
                onToChange={setNormalTo} 
                elementColor={elColor} 
                charName="bulk" 
                skill="normal" 
              />
              <TalentRow 
                icon="✨" 
                label="Elemental Skill" 
                fromVal={skillFrom} 
                toVal={skillTo} 
                onFromChange={setSkillFrom} 
                onToChange={setSkillTo} 
                elementColor={elColor} 
                charName="bulk" 
                skill="skill" 
              />
              <TalentRow 
                icon="💥" 
                label="Elemental Burst" 
                fromVal={burstFrom} 
                toVal={burstTo} 
                onFromChange={setBurstFrom} 
                onToChange={setBurstTo} 
                elementColor={elColor} 
                charName="bulk" 
                skill="burst" 
              />
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0 bg-[var(--surface)]">
          <button onClick={onClose} className="genshin-btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-sm font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-lg shadow-[var(--gold)]/20"
          >
            Apply Overrides
          </button>
        </div>
      </div>
    </div>
  )
}
