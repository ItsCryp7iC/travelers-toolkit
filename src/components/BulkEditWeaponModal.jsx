import React, { useState, useEffect, useMemo } from 'react'
import { ASCENSION_CAPS } from '../utils/calculator'
import { LevelSlider, AscensionSelector } from './CharacterModal'
import useStore from '../store/useStore'
import weaponsData from '../data/weapons.json'
import charactersData from '../utils/characters'
import { RARITY_COLORS, formatName, getStars, getRarityClass, getRarityBg } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import CustomSelect from './CustomSelect'
import { getWeaponIcon, getCharacterAvatar } from '../utils/assetHelper'
export default function BulkEditWeaponModal({ isOpen, onClose, selectedIds, onSave }) {
  // Store
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const roster = useStore((s) => s.roster)

  const globallyAssignedCharacterIds = useMemo(() => {
    return new Set(trackedWeapons.map(w => w.assignedTo).filter(Boolean));
  }, [trackedWeapons]);

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

  // Character assignments state
  const [assignments, setAssignments] = useState({})

  // Compute full weapon data for selected weapons
  const selectedWeaponsList = useMemo(() => {
    return selectedIds.map(id => {
      const tw = trackedWeapons.find(w => w.id === id)
      if (!tw) return null
      const data = weaponsData.find(w => w.name === tw.weaponName) || { name: tw.weaponName, rarity: 3, type: 'Unknown' }
      return { ...tw, data }
    }).filter(Boolean)
  }, [selectedIds, trackedWeapons])

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
      const initialAssignments = {}
      selectedWeaponsList.forEach(w => {
        initialAssignments[w.id] = w.assignedTo || ''
      })
      setAssignments(initialAssignments)
    } else {
      document.body.style.overflow = ''
      // Reset state to baseline on close
      setOverrideCurrentLevel(false)
      setOverrideTargetLevel(false)
      setFromLevel(1)
      setFromAsc(0)
      setToLevel(90)
      setToAsc(6)
      setAssignments({})
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen, selectedWeaponsList])

  if (!isOpen) return null

  const handleApply = () => {
    try {
      const payloads = selectedWeaponsList.map(w => {
        const payload = { id: w.id }
        
        if (overrideCurrentLevel) {
          payload.level = fromLevel
          payload.ascension = fromAsc
        }
        
        if (overrideTargetLevel) {
          payload.targetLevel = toLevel
          payload.targetAscension = toAsc
        }
        
        const newAssignment = assignments[w.id] || null;
        if (newAssignment !== w.assignedTo) {
          payload.assignedTo = newAssignment;
        }

        return payload;
      }).filter(p => Object.keys(p).length > 1);

      if (payloads.length === 0) {
        console.warn("No overrides selected. Closing modal.");
        onClose()
        return
      }

      console.log("Dispatching bulk update for payloads:", payloads);
      if (onSave) {
        onSave(payloads)
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
        className="w-full max-w-3xl bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)] animate-slide-up relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-xl text-[var(--text)]">
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

          {/* Character Assignments Section */}
          <section>
            <h3 className="modal-section-title text-sm mb-4">📋 Character Assignments</h3>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm max-h-60 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--elevated)] border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-16 text-center">Icon</th>
                    <th className="px-4 py-3 font-semibold">Weapon Name</th>
                    <th className="px-4 py-3 font-semibold w-1/2">Assign to Character</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {selectedWeaponsList.map((wp) => {
                    const assignedToOthers = Object.entries(assignments)
                      .filter(([id, char]) => id !== wp.id && char !== '')
                      .map(([_, char]) => char)

                    const initialAssigned = wp.assignedTo;
                    const compatibleChars = Object.keys(roster)
                      .map((name) => charactersData.find((c) => c.name === name))
                      .filter((c) => {
                        if (!c || c.weapon_type !== wp.data.type) return false;
                        if (assignedToOthers.includes(c.name)) return false;
                        if (globallyAssignedCharacterIds.has(c.name) && c.name !== initialAssigned) return false;
                        return true;
                      })

                    const assignedValue = assignments[wp.id] || ''
                    const rColor = RARITY_COLORS[wp.data.rarity] || '#C8A96E'
                    
                    return (
                      <tr key={wp.id} className="hover:bg-[var(--elevated)] transition-colors">
                        <td className="px-4 py-3 text-center">
                          <div className={`w-10 h-10 mx-auto rounded-lg shadow flex items-center justify-center relative overflow-hidden ${getRarityBg(wp.data.rarity)}`} style={{ border: `1px solid ${rColor}40` }}>
                            <GenshinImage 
                              src={getWeaponIcon(wp.weaponName)} 
                              alt={wp.weaponName} 
                              className="w-full h-full object-contain absolute inset-0 z-10 p-1" 
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[var(--text)] text-sm">{formatName(wp.weaponName)}</p>
                          <div className="flex gap-2 items-center mt-1 text-xs">
                            <span className={getRarityClass(wp.data.rarity)}>{getStars(wp.data.rarity)}</span>
                            <span className="text-[var(--muted)]">{wp.data.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {compatibleChars.length === 0 ? (
                            <p className="text-xs text-[var(--muted)] italic">No compatible rostered characters.</p>
                          ) : (
                            <CustomSelect
                              placeholder="— Unassigned (Standalone) —"
                              value={assignedValue}
                              onChange={(newVal) => setAssignments(prev => ({ ...prev, [wp.id]: newVal }))}
                              options={[
                                { id: '', name: '— Unassigned (Standalone) —', icon: null, rarity: 0 },
                                ...compatibleChars.map((c) => {
                                  const entry = roster[c.name]
                                  const hasWeapon = entry?.equippedWeaponId
                                  const equippedWeaponName = hasWeapon ? trackedWeapons.find(w => w.id === hasWeapon)?.weaponName : null
                                  return {
                                    id: c.name,
                                    name: formatName(c.name),
                                    subtitle: equippedWeaponName && hasWeapon !== wp.id ? `⚠️ (has ${formatName(equippedWeaponName)})` : '',
                                    icon: getCharacterAvatar(c.name),
                                    rarity: c.rarity || 0,
                                    secondaryIcon: equippedWeaponName && hasWeapon !== wp.id ? getWeaponIcon(equippedWeaponName) : null
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
