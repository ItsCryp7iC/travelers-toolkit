import React, { useState, useEffect } from 'react'
import { ASCENSION_CAPS } from '../utils/calculator'
import { LevelSlider, AscensionSelector } from './CharacterModal'

export default function BulkEditWeaponModal({ isOpen, onClose, selectedIds, onSave }) {
  // Toggles
  const [overrideCurrentLevel, setOverrideCurrentLevel] = useState(false)
  const [overrideTargetLevel, setOverrideTargetLevel] = useState(false)

  // Baseline initial state for bulk edit
  const [fromLevel, setFromLevel] = useState(1)
  const [fromAsc, setFromAsc] = useState(0)
  const [toLevel, setToLevel] = useState(90)
  const [toAsc, setToAsc] = useState(6)

  // Use a generic purple/gold color
  const elColor = "#9CA3AF"
  const targetColor = "var(--gold)"

  // Auto-clamp Current Level when Current Ascension changes
  useEffect(() => {
    const minLevel = fromAsc === 0 ? 1 : ASCENSION_CAPS[fromAsc - 1];
    const maxLevel = ASCENSION_CAPS[fromAsc];

    if (fromLevel < minLevel) setFromLevel(minLevel);
    else if (fromLevel > maxLevel) setFromLevel(maxLevel);
  }, [fromAsc]);

  // Auto-clamp Target Level when Target Ascension changes
  useEffect(() => {
    const minLevel = toAsc === 0 ? 1 : ASCENSION_CAPS[toAsc - 1];
    const maxLevel = ASCENSION_CAPS[toAsc];

    if (toLevel < minLevel) setToLevel(minLevel);
    else if (toLevel > maxLevel) setToLevel(maxLevel);
  }, [toAsc]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Reset state to baseline on close
      setOverrideCurrentLevel(false)
      setOverrideTargetLevel(false)
      setFromLevel(1)
      setFromAsc(0)
      setToLevel(90)
      setToAsc(6)
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleApply = () => {
    try {
      const patch = {}
      
      if (overrideCurrentLevel) {
        patch.level = fromLevel
        patch.ascension = fromAsc
      }
      
      if (overrideTargetLevel) {
        patch.targetLevel = toLevel
        patch.targetAscension = toAsc
      }
      
      if (Object.keys(patch).length === 0) {
        console.warn("No overrides selected. Closing modal.");
        onClose()
        return
      }

      console.log("Dispatching bulk update for:", selectedIds, "with patch:", patch);
      if (onSave) {
        onSave(patch)
      } else {
        onClose()
      }
    } catch (error) {
      console.error("Bulk Edit Apply Failed:", error);
      alert("An error occurred while applying overrides. Check console.");
    }
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
              Bulk Edit Weapons
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="bg-[var(--gold)]/10 text-[var(--gold)] px-6 py-2 text-xs font-semibold text-center border-b border-[var(--gold)]/20">
          Updating {selectedIds.length} weapons
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          
          {/* Progression Section */}
          <section>
            <h3 className="modal-section-title text-sm mb-4">📈 Weapon Progression Overrides</h3>
            <div className="grid grid-cols-2 gap-8">
              {/* CURRENT */}
              <div className="space-y-4 relative">
                <div className="absolute -right-4 top-0 bottom-0 w-px bg-[var(--border)] hidden md:block"></div>
                <label className="flex items-center gap-2 cursor-pointer w-max mb-2">
                  <input type="checkbox" checked={overrideCurrentLevel} onChange={e => setOverrideCurrentLevel(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${overrideCurrentLevel ? 'text-[var(--gold)]' : 'text-[var(--muted)]'}`}>Current</span>
                </label>
                <div className={`transition-opacity ${overrideCurrentLevel ? '' : 'opacity-40 pointer-events-none'}`}>
                  <AscensionSelector value={fromAsc} onChange={setFromAsc} label="Phase" elementColor={elColor} isCharacter={false} />
                  <div className="mt-4"><LevelSlider value={fromLevel} onChange={setFromLevel} ascension={fromAsc} label="Level" elementColor={elColor} isCharacter={false} /></div>
                </div>
              </div>

              {/* TARGET */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer w-max mb-2">
                  <input type="checkbox" checked={overrideTargetLevel} onChange={e => setOverrideTargetLevel(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${overrideTargetLevel ? 'text-[var(--gold)]' : 'text-[var(--muted)]'}`}>Target</span>
                </label>
                <div className={`transition-opacity ${overrideTargetLevel ? '' : 'opacity-40 pointer-events-none'}`}>
                  <AscensionSelector value={safeToAsc} onChange={setToAsc} label="Phase" elementColor={targetColor} isCharacter={false} />
                  <div className="mt-4"><LevelSlider value={safeToLevel} onChange={setToLevel} ascension={safeToAsc} label="Level" elementColor={targetColor} isCharacter={false} /></div>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0 bg-[var(--surface)]">
          <button onClick={onClose} className="genshin-btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleApply}
            className="px-6 py-2 rounded-xl text-sm font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-lg shadow-[var(--gold)]/20"
          >
            Apply Overrides
          </button>
        </div>
      </div>
    </div>
  )
}
