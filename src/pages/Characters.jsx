import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import CharacterModal from '../components/CharacterModal'
import AddCharacterModal from '../components/AddCharacterModal'
import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'

const ALL_ELEMENTS = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]
const ALL_WEAPONS  = ['All', ...Object.keys(WEAPON_TYPES)]

export default function Characters() {
  const roster         = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const removeCharacter = useStore((s) => s.removeCharacter)

  const [search,        setSearch]        = useState('')
  const [elementFilter, setElementFilter] = useState('All')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [sortBy,        setSortBy]        = useState('name')
  const [viewMode,      setViewMode]      = useState('table') // 'table' | 'card'

  const [addModalOpen,  setAddModalOpen]  = useState(false)
  const [editingChar,   setEditingChar]   = useState(null)

  // Build full character objects for rostered characters
  const rostered = useMemo(() => {
    return Object.keys(roster)
      .map((name) => charactersData.find((c) => c.name === name))
      .filter(Boolean)
  }, [roster])

  const filtered = useMemo(() => {
    let list = [...rostered]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.element?.toLowerCase().includes(q))
    }
    if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
    if (weaponFilter  !== 'All') list = list.filter((c) => c.weapon_type === weaponFilter)
    list.sort((a, b) => {
      if (sortBy === 'rarity')  return b.rarity - a.rarity
      if (sortBy === 'element') return (a.element || '').localeCompare(b.element || '')
      return a.name.localeCompare(b.name)
    })
    return list
  }, [rostered, search, elementFilter, weaponFilter, sortBy])

  const getEquippedWeapon = (charName) => {
    const entry = roster[charName]
    if (!entry?.equippedWeaponId) return null
    const tracked = trackedWeapons.find((w) => w.id === entry.equippedWeaponId)
    if (!tracked) return null
    const data = weaponsData.find((w) => w.name === tracked.weaponName)
    return { tracked, data }
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
          <span className="text-6xl mb-5">👤</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-xl mb-2">Your roster is empty</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Start tracking characters by clicking the button above or adding them from the Dashboard.</p>
          <button onClick={() => setAddModalOpen(true)} className="genshin-btn-ghost">+ Add Character</button>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="relative flex-1 min-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input type="search" placeholder="Search roster…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="relative">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors">
                  <option value="name">Sort: Name</option>
                  <option value="rarity">Sort: Rarity</option>
                  <option value="element">Sort: Element</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
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
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-widest text-[var(--muted)]">
                    <th className="text-left px-4 py-3 font-semibold">Character</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Element</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Weapon</th>
                    <th className="text-center px-4 py-3 font-semibold">Lv</th>
                    <th className="text-center px-4 py-3 font-semibold">→ Lv</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Equipped Weapon</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((char, idx) => {
                    const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown
                    const wpCfg = WEAPON_TYPES[char.weapon_type]
                    const entry = roster[char.name]
                    const eqWeapon = getEquippedWeapon(char.name)

                    return (
                      <tr
                        key={char.name}
                        className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                        onClick={() => setEditingChar(char)}
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow" style={{ background: elCfg.avatarGradient }}>
                              <span className="font-cinzel text-sm" style={{ color: elCfg.color }}>{getInitials(char.name)}</span>
                            </div>
                            <div>
                              <p className="font-cinzel text-xs font-semibold text-[var(--text)]">{formatName(char.name)}</p>
                              <p className={`text-[10px] ${getRarityClass(char.rarity)}`}>{getStars(char.rarity)}</p>
                            </div>
                          </div>
                        </td>
                        {/* Element */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border" style={{ background: elCfg.colorDim, borderColor: elCfg.color + '50', color: elCfg.color }}>
                            {elCfg.emoji} {char.element}
                          </span>
                        </td>
                        {/* Weapon Type */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          {wpCfg && <span className="text-xs text-[var(--muted)]">{wpCfg.emoji} {char.weapon_type}</span>}
                        </td>
                        {/* Current Level */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs font-bold text-[var(--text)]">{entry?.level ?? 1}</span>
                        </td>
                        {/* Target Level */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs font-bold text-[var(--gold)]">{entry?.targetLevel ?? 90}</span>
                        </td>
                        {/* Equipped Weapon */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {eqWeapon ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{WEAPON_TYPES[eqWeapon.data?.type]?.emoji || '⚔️'}</span>
                              <div>
                                <p className="text-xs font-semibold text-[var(--text)]">{formatName(eqWeapon.tracked.weaponName)}</p>
                                <p className="text-[10px] text-[var(--muted)]">Lv {eqWeapon.tracked.level} → {eqWeapon.tracked.targetLevel}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--muted)] italic">None equipped</span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => removeCharacter(char.name)}
                            className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
