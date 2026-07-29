import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import CharacterModal from '../components/CharacterModal'
import AddCharacterModal from '../components/AddCharacterModal'
import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import costsData from '../data/costs.json'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import { calculateProgressionCost, calculateAllTalentsCost, formatNumber, buildMobNames, buildBookKey } from '../utils/calculator'
import MatQuantity from '../components/MatQuantity'

const ALL_ELEMENTS = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]
const ALL_WEAPONS  = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '5★', '4★']

export default function Characters() {
  const roster         = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const removeCharacter = useStore((s) => s.removeCharacter)

  const [search,        setSearch]        = useState('')
  const [elementFilter, setElementFilter] = useState('All')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [sortConfig,    setSortConfig]    = useState({ key: 'sl_no', direction: 'asc' })
  const [viewMode,      setViewMode]      = useState('table') // 'table' | 'card'

  const [addModalOpen,  setAddModalOpen]  = useState(false)
  const [editingChar,   setEditingChar]   = useState(null)

  // Build full character objects for rostered characters, calculate their maths
  const rostered = useMemo(() => {
    return Object.keys(roster)
      .map((name) => {
        const data = charactersData.find((c) => c.name === name)
        if (!data) return null
        
        const sl_no = charactersData.findIndex((c) => c.name === name) + 1
        const entry = roster[name]
        
        // Progression Math
        const fromLevel = entry.level ?? 1
        const fromAsc = entry.ascension ?? 0
        const toLevel = entry.targetLevel ?? 90
        const toAsc = entry.targetAscension ?? 6
        
        const ascCosts = calculateProgressionCost(data, fromLevel, fromAsc, Math.max(toLevel, fromLevel), Math.max(toAsc, fromAsc), costsData)
        
        // Talent Math
        const talents = entry.talents || { normal: 1, skill: 1, burst: 1 }
        const targetTalents = entry.targetTalents || { normal: 1, skill: 1, burst: 1 }
        
        const talentCosts = calculateAllTalentsCost(data, {
          normalFrom: talents.normal, normalTo: targetTalents.normal,
          skillFrom: talents.skill,   skillTo: targetTalents.skill,
          burstFrom: talents.burst,   burstTo: targetTalents.burst,
        })

        // Weapon
        let eqWeapon = null
        if (entry.equippedWeaponId) {
          const tracked = trackedWeapons.find((w) => w.id === entry.equippedWeaponId)
          if (tracked) {
            const wData = weaponsData.find((w) => w.name === tracked.weaponName)
            eqWeapon = { tracked, data: wData }
          }
        }

        return {
          ...data,
          sl_no,
          entry,
          ascCosts,
          talentCosts,
          eqWeapon
        }
      })
      .filter(Boolean)
  }, [roster, trackedWeapons])

  const filtered = useMemo(() => {
    let list = [...rostered]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.element?.toLowerCase().includes(q))
    }
    if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
    if (weaponFilter  !== 'All') list = list.filter((c) => c.weapon_type === weaponFilter)
    
    list.sort((a, b) => {
      let valA, valB
      switch (sortConfig.key) {
        case 'sl_no': valA = a.sl_no; valB = b.sl_no; break
        case 'name': valA = a.name; valB = b.name; break
        case 'element': valA = a.element; valB = b.element; break
        case 'rarity': valA = a.rarity; valB = b.rarity; break
        case 'level': valA = a.entry.level ?? 1; valB = b.entry.level ?? 1; break
        default: valA = a.sl_no; valB = b.sl_no;
      }
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    
    return list
  }, [rostered, search, elementFilter, weaponFilter, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null
    return <span className="ml-1 text-[var(--gold)]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚔️</span>
            <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">My Roster</h1>
          </div>
          <p className="text-[var(--muted)] text-sm ml-11">
            {rostered.length} character{rostered.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'table' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
            >
              ☰ Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'card' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
            >
              ⊞ Cards
            </button>
          </div>
          <button
            id="add-character-btn"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md"
          >
            + Add Character
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {rostered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <span className="text-6xl mb-5">⚔️</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-xl mb-2">Your roster is empty</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Add characters to start tracking their progression goals and material costs.</p>
          <button onClick={() => setAddModalOpen(true)} className="genshin-btn-ghost">+ Add Character</button>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input type="search" placeholder="Search roster…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <span className="text-[var(--muted)] text-xs">{filtered.length} / {rostered.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_ELEMENTS.map((el) => {
                const cfg = ELEMENTS[el]
                return (
                  <button key={el} onClick={() => setElementFilter(el)} className={`filter-pill ${elementFilter === el ? 'active' : ''}`}>
                    {cfg ? cfg.emoji : '🌐'} {el}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Table View ── */}
          {viewMode === 'table' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm border-collapse whitespace-nowrap min-w-max">
                  <thead>
                    {/* Top Header Grouping */}
                    <tr className="bg-[var(--elevated)] border-b border-[var(--border)]">
                      <th colSpan="5" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)] sticky left-0 z-30 bg-[var(--elevated)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Identity</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)]">Current State</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--gold)] border-r border-[var(--border)]">Target State</th>
                      <th colSpan="8" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Ascension Requirements</th>
                      <th colSpan="7" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Talent Requirements</th>
                      <th className="px-4 py-2 border-b border-[var(--border)]"></th>
                    </tr>
                    {/* Sub Headers */}
                    <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">
                      {/* Identity (Sticky) */}
                      <th className="text-center px-4 py-2 font-semibold cursor-pointer hover:text-[var(--text)] sticky left-0 z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]" onClick={() => handleSort('sl_no')}>Sl<SortIcon columnKey="sl_no"/></th>
                      <th className="text-left px-4 py-2 font-semibold cursor-pointer hover:text-[var(--text)] sticky left-[48px] z-20 bg-[var(--surface)] w-[200px] min-w-[200px] max-w-[200px]" onClick={() => handleSort('name')}>Character<SortIcon columnKey="name"/></th>
                      <th className="text-center px-4 py-2 font-semibold cursor-pointer hover:text-[var(--text)] sticky left-[248px] z-20 bg-[var(--surface)] w-[82px] min-w-[82px] max-w-[82px]" onClick={() => handleSort('element')}>Element<SortIcon columnKey="element"/></th>
                      <th className="text-center px-4 py-2 font-semibold sticky left-[330px] z-20 bg-[var(--surface)] w-[80px] min-w-[80px] max-w-[80px]">Weapon</th>
                      <th className="text-left px-4 py-2 font-semibold sticky left-[410px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Equipped</th>
                      
                      {/* Current State */}
                      <th className="text-center px-3 py-2 font-semibold cursor-pointer hover:text-[var(--text)]" onClick={() => handleSort('level')}>Lv<SortIcon columnKey="level"/></th>
                      <th className="text-center px-3 py-2 font-semibold">NA</th>
                      <th className="text-center px-3 py-2 font-semibold">Skill</th>
                      <th className="text-center px-3 py-2 font-semibold border-r border-[var(--border)]">Burst</th>
                      
                      {/* Target State */}
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)]">Lv</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)]">NA</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)]">Skill</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)] border-r border-[var(--border)]">Burst</th>

                      {/* Ascension Math */}
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="Hero's Wit">Wit</th>
                      <th className="text-center px-3 py-2 font-semibold" title="World Boss Drop">W.Boss</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Local Specialty">Local</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Gemstones (All Tiers)">Stones</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="3★ Mob Mats">Mob 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="2★ Mob Mats">Mob 2★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="1★ Mob Mats">Mob 1★</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E] border-r border-[var(--border)]">Asc. Mora</th>

                      {/* Talent Math */}
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="4★ Talent Books">Bk 4★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="3★ Talent Books">Bk 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="2★ Talent Books">Bk 2★</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Weekly Boss Drop">Wk.Boss</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#FBBF24]" title="Crown of Insight">Crown</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Mob Mats (All Tiers)">Mob Mats</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E] border-r border-[var(--border)]">Talent Mora</th>
                      
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((char, idx) => {
                      const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown
                      const wpCfg = WEAPON_TYPES[char.weapon_type]
                      const entry = char.entry
                      const asc = char.ascCosts
                      const tal = char.talentCosts
                      const eqWeapon = char.eqWeapon

                      // Aggregate Stones (Sum of all values in gemstones object)
                      const totalStones = Object.values(asc.gemstones || {}).reduce((a, b) => a + b, 0)
                      
                      // Derive specific tier names to pluck from the cost objects
                      const mobNames = buildMobNames(char.materials?.mob_material || 'Common')
                      const bookBase = char.materials?.talent_book
                      
                      // Talent Mob Mats (All Tiers combined for simplicity)
                      const talMobTotal = Object.values(tal.mob || {}).reduce((a, b) => a + b, 0)

                      return (
                        <tr
                          key={char.name}
                          className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'}`}
                          onClick={() => setEditingChar(char)}
                        >
                          {/* Identity Group (Sticky) */}
                          <td className="px-4 py-2 text-center text-xs text-[var(--muted)] sticky left-0 z-10 bg-inherit border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]">{char.sl_no}</td>
                          <td className="px-4 py-2 sticky left-[48px] z-10 bg-inherit border-r border-transparent w-[200px] min-w-[200px] max-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow" style={{ background: elCfg.avatarGradient }}>
                                <span className="font-cinzel text-xs" style={{ color: elCfg.color }}>{getInitials(char.name)}</span>
                              </div>
                              <div className="truncate">
                                <p className="font-cinzel text-xs font-semibold text-[var(--text)] truncate">{formatName(char.name)}</p>
                                <p className={`text-[10px] ${getRarityClass(char.rarity)}`}>{getStars(char.rarity)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center sticky left-[248px] z-10 bg-inherit w-[82px] min-w-[82px] max-w-[82px]">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border" style={{ background: elCfg.colorDim, borderColor: elCfg.color + '50', color: elCfg.color }} title={char.element}>
                              {elCfg.emoji}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center sticky left-[330px] z-10 bg-inherit text-lg w-[80px] min-w-[80px] max-w-[80px]" title={char.weapon_type}>
                            {wpCfg?.emoji}
                          </td>
                          <td className="px-4 py-2 sticky left-[410px] z-10 bg-inherit border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">
                            {eqWeapon ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm shrink-0">{WEAPON_TYPES[eqWeapon.data?.type]?.emoji || '⚔️'}</span>
                                <div className="truncate min-w-0">
                                  <p className="text-[11px] font-semibold text-[var(--text)] truncate">{formatName(eqWeapon.tracked.weaponName)}</p>
                                  <p className="text-[9px] text-[var(--muted)]">Lv{eqWeapon.tracked.level}→{eqWeapon.tracked.targetLevel}</p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] italic">None</span>
                            )}
                          </td>
                          
                          {/* Current State */}
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--text)]">{entry?.level ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)]">{entry?.talents?.normal ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)]">{entry?.talents?.skill ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)] border-r border-[var(--border)]">{entry?.talents?.burst ?? 1}</td>
                          
                          {/* Target State */}
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)]">{entry?.targetLevel ?? 90}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)]">{entry?.targetTalents?.normal ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)]">{entry?.targetTalents?.skill ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)] border-r border-[var(--border)]">{entry?.targetTalents?.burst ?? 1}</td>

                          {/* Ascension Math */}
                          <td className="px-3 py-2"><MatQuantity val={asc.heroWits} icon="📘" color="text-[#60A5FA]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc.worldBoss ? Object.values(asc.worldBoss)[0] : 0} icon="👹" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc.localSpecialty ? Object.values(asc.localSpecialty)[0] : 0} icon="🌸" /></td>
                          <td className="px-3 py-2"><MatQuantity val={totalStones} icon="💎" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc.mob?.[mobNames[2]] || 0} icon="💧" color="text-[#A78BFA]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc.mob?.[mobNames[1]] || 0} icon="💧" color="text-[#60A5FA]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc.mob?.[mobNames[0]] || 0} icon="💧" color="text-[#9CA3AF]" /></td>
                          <td className="px-3 py-2 border-r border-[var(--border)]"><MatQuantity val={asc.totalMora} icon="🪙" color="text-[#C8A96E]" align="right" /></td>

                          {/* Talent Math */}
                          <td className="px-3 py-2"><MatQuantity val={tal.books?.[buildBookKey(bookBase, 4)] || 0} icon="📜" color="text-[#A78BFA]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal.books?.[buildBookKey(bookBase, 3)] || 0} icon="📜" color="text-[#60A5FA]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal.books?.[buildBookKey(bookBase, 2)] || 0} icon="📜" color="text-[#9CA3AF]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal.weeklyBoss ? Object.values(tal.weeklyBoss)[0] : 0} icon="🐉" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal.crown} icon="👑" color="text-[#FBBF24]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={talMobTotal} icon="💧" /></td>
                          <td className="px-3 py-2 border-r border-[var(--border)]"><MatQuantity val={tal.talentMora} icon="🪙" color="text-[#C8A96E]" align="right" /></td>
                          
                          {/* Actions */}
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => removeCharacter(char.name)}
                              className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Card View ── */}
          {viewMode === 'card' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
              {filtered.map((char) => (
                <CharacterCard key={char.name} character={char} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {addModalOpen && <AddCharacterModal onClose={() => setAddModalOpen(false)} />}
      {editingChar && <CharacterModal character={editingChar} onClose={() => setEditingChar(null)} />}
    </div>
  )
}
