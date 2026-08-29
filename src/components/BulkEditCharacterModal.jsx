import React, { useState, useEffect, useMemo } from 'react'
import useStore from '../store/useStore'
import { ASCENSION_CAPS } from '../utils/calculator'
import { LevelSlider, AscensionSelector, TalentRow } from './CharacterModal'
import CustomSelect from './CustomSelect'
import { RARITY_COLORS, formatName, getStars, getRarityClass, getRarityBg, WEAPON_TYPES } from '../utils/gameData'
import { getWeaponIcon, getCharacterAvatar, getWeaponTypeIcon } from '../utils/assetHelper'
import charactersData from '../utils/characters'
import weaponsData from '../data/weapons.json'

export default function BulkEditCharacterModal({ isOpen, onClose, selectedIds, onSave }) {
  const bulkUpdateCharacters = useStore(s => s.bulkUpdateCharacters)
  const trackedWeapons = useStore(s => s.trackedWeapons)
  const roster = useStore(s => s.roster)

  const globallyAssignedWeaponIds = useMemo(() => {
    return new Set(trackedWeapons.filter(w => Boolean(w.assignedTo)).map(w => w.id));
  }, [trackedWeapons]);
  
  // Toggles
  const [overrideCurrentLevel, setOverrideCurrentLevel] = useState(false)
  const [overrideTargetLevel, setOverrideTargetLevel] = useState(false)
  const [overrideCurrentTalents, setOverrideCurrentTalents] = useState(false)
  const [overrideTargetTalents, setOverrideTargetTalents] = useState(false)

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

  const [assignments, setAssignments] = useState({})

  const selectedCharactersList = useMemo(() => {
    return selectedIds.map(id => {
      const charData = charactersData.find(c => c.name === id)
      const rosterEntry = roster[id] || {}
      return { id, data: charData, rosterEntry }
    }).filter(c => c.data)
  }, [selectedIds, roster])

  // Use a generic gold color for the bulk edit modal since it applies to many elements
  const elColor = "var(--gold)"

  // Auto-clamp Current Level when Current Ascension changes
  useEffect(() => {
    const minLevel = fromAsc === 0 ? 1 : ASCENSION_CAPS[fromAsc - 1];
    const maxLevel = fromAsc === 6 ? 100 : ASCENSION_CAPS[fromAsc];

    if (fromLevel < minLevel) setFromLevel(minLevel);
    else if (fromLevel > maxLevel) setFromLevel(maxLevel);
  }, [fromAsc]);

  // Auto-clamp Target Level when Target Ascension changes
  useEffect(() => {
    const minLevel = toAsc === 0 ? 1 : ASCENSION_CAPS[toAsc - 1];
    const maxLevel = toAsc === 6 ? 100 : ASCENSION_CAPS[toAsc];

    if (toLevel < minLevel) setToLevel(minLevel);
    else if (toLevel > maxLevel) setToLevel(maxLevel);
  }, [toAsc]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      const initAssignments = {}
      selectedIds.forEach(id => {
        initAssignments[id] = roster[id]?.equippedWeaponId || ''
      })
      setAssignments(initAssignments)
    } else {
      document.body.style.overflow = ''
      // Reset state to baseline on close
      setOverrideCurrentLevel(false)
      setOverrideTargetLevel(false)
      setOverrideCurrentTalents(false)
      setOverrideTargetTalents(false)
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
      
      if (overrideCurrentTalents) {
        patch.talents = {
          normal: normalFrom,
          skill: skillFrom,
          burst: burstFrom
        }
      }
      
      if (overrideTargetTalents) {
        patch.targetTalents = {
          normal: normalTo,
          skill: skillTo,
          burst: burstTo
        }
      }
      
      let hasAssignmentChanges = false;
      const payloads = selectedIds.map(id => {
        const payload = { name: id, ...patch }
        const oldWeapon = roster[id]?.equippedWeaponId || ''
        const newWeapon = assignments[id] || ''
        if (oldWeapon !== newWeapon) {
          payload.equippedWeaponId = newWeapon ? newWeapon : null
          hasAssignmentChanges = true
        }
        return payload
      })
      
      if (Object.keys(patch).length === 0 && !hasAssignmentChanges) {
        console.warn("No overrides selected. Closing modal.");
        onClose()
        return
      }

      console.log("Dispatching bulk update for characters with payloads:", payloads);
      if (onSave) {
        onSave(payloads)
      } else {
        bulkUpdateCharacters(payloads, patch)
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
                <label className="flex items-center gap-2 cursor-pointer w-max mb-2">
                  <input type="checkbox" checked={overrideCurrentLevel} onChange={e => setOverrideCurrentLevel(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${overrideCurrentLevel ? 'text-[var(--gold)]' : 'text-[var(--muted)]'}`}>Current</span>
                </label>
                <div className={`transition-opacity ${overrideCurrentLevel ? '' : 'opacity-40 pointer-events-none'}`}>
                  <AscensionSelector value={fromAsc} onChange={setFromAsc} label="Phase" elementColor={elColor} isCharacter={true} />
                  <div className="mt-4"><LevelSlider value={fromLevel} onChange={setFromLevel} ascension={fromAsc} label="Level" elementColor={elColor} isCharacter={true} /></div>
                </div>
              </div>

              {/* TARGET */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer w-max mb-2">
                  <input type="checkbox" checked={overrideTargetLevel} onChange={e => setOverrideTargetLevel(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${overrideTargetLevel ? 'text-[var(--gold)]' : 'text-[var(--muted)]'}`}>Target</span>
                </label>
                <div className={`transition-opacity ${overrideTargetLevel ? '' : 'opacity-40 pointer-events-none'}`}>
                  <AscensionSelector value={safeToAsc} onChange={setToAsc} label="Phase" elementColor={elColor} isCharacter={true} />
                  <div className="mt-4"><LevelSlider value={safeToLevel} onChange={setToLevel} ascension={safeToAsc} label="Level" elementColor={elColor} isCharacter={true} /></div>
                </div>
              </div>
            </div>
          </section>

          {/* Talents Section */}
          <section>
            <h3 className="modal-section-title text-sm mb-4">⚔️ Talent Progression Overrides</h3>
            <div className="grid grid-cols-2 gap-4 mb-2 px-2">
              <label className="flex items-center gap-2 cursor-pointer w-max justify-end ml-auto pr-6">
                <input type="checkbox" checked={overrideCurrentTalents} onChange={e => setOverrideCurrentTalents(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                <span className={`text-xs font-bold uppercase tracking-wider ${overrideCurrentTalents ? 'text-[var(--gold)]' : 'text-[var(--muted)]'}`}>Override Current</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer w-max pl-2">
                <input type="checkbox" checked={overrideTargetTalents} onChange={e => setOverrideTargetTalents(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                <span className={`text-xs font-bold uppercase tracking-wider ${overrideTargetTalents ? 'text-[var(--gold)]' : 'text-[var(--muted)]'}`}>Override Target</span>
              </label>
            </div>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] px-4 py-2">
              <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0 relative">
                {(!overrideCurrentTalents || !overrideTargetTalents) && (
                  <div className="absolute inset-y-0 right-0 w-[140px] flex pointer-events-none z-10">
                    <div className={`w-1/2 h-full ${overrideCurrentTalents ? '' : 'bg-[var(--surface)]/50 backdrop-blur-[1px]'}`}></div>
                    <div className={`w-1/2 h-full ${overrideTargetTalents ? '' : 'bg-[var(--surface)]/50 backdrop-blur-[1px]'}`}></div>
                  </div>
                )}
                <div className="w-full">
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
              </div>
            </div>
          </section>

          {/* Weapon Assignments Section */}
          <section>
            <h3 className="modal-section-title text-sm mb-4">🗡️ Weapon Assignments</h3>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                <div className="space-y-2">
                  {selectedCharactersList.map((c) => {
                    const assignedToOthers = Object.entries(assignments)
                      .filter(([id, wId]) => id !== c.id && wId !== '')
                      .map(([_, wId]) => wId)

                    const initialAssignedWeapon = roster[c.id]?.equippedWeaponId || '';
                    const compatibleWeapons = trackedWeapons.filter((w) => {
                      const wData = weaponsData.find(wd => wd.name === w.weaponName)
                      if (!wData || wData.type !== c.data.weapon_type) return false;
                      if (assignedToOthers.includes(w.id)) return false;
                      if (globallyAssignedWeaponIds.has(w.id) && w.id !== initialAssignedWeapon) return false;
                      return true;
                    })

                    const assignedValue = assignments[c.id] || '';
                    const rColor = RARITY_COLORS[c.data.rarity] || '#C8A96E';
                    
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-2 bg-[var(--bg)]/50 rounded-lg border border-[var(--border)]">
                        <div className="relative shrink-0 flex items-center justify-center">
                          <img 
                            src={getCharacterAvatar(c.data.name)}
                            alt={c.data.name} 
                            className="w-10 h-10 object-contain rounded-md"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[var(--text)] truncate">
                              {formatName(c.data.name)}
                            </span>
                          </div>
                        </div>
                        <div className="w-56 shrink-0">
                          <CustomSelect
                            placeholder="— Unassigned —"
                            value={assignedValue}
                            onChange={(newVal) => setAssignments(prev => ({ ...prev, [c.id]: newVal }))}
                            options={[
                              { id: '', name: '— Unassigned —', icon: null, rarity: 0 },
                              ...compatibleWeapons.map((w) => {
                                const wData = weaponsData.find(wd => wd.name === w.weaponName)
                                return {
                                  id: w.id,
                                  name: formatName(w.weaponName),
                                  icon: getWeaponIcon(w.weaponName),
                                  rarity: wData ? wData.rarity : 0,
                                  subtitle: `Armory: Lvl ${w.level}/${w.targetLevel}`
                                }
                              }),
                              ...weaponsData.filter(wd => wd.type === c.data.weapon_type).map((wd) => ({
                                id: `NEW:${wd.name}`,
                                name: formatName(wd.name),
                                icon: getWeaponIcon(wd.name),
                                rarity: wd.rarity,
                                subtitle: `New (Lv. 1 → 90)`
                              }))
                            ]}
                          />
                        </div>
                      </div>
                    )
                  })}
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
