import React, { useState, useMemo } from 'react'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import weaponsData from '../data/weapons.json'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import { ELEMENTS } from '../utils/gameData'

const ALL_TYPES    = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '5★', '4★', '3★', '2★', '1★']

export default function Weapons() {
  const trackedWeapons   = useStore((s) => s.trackedWeapons)
  const roster           = useStore((s) => s.roster)
  const removeTrackedWeapon = useStore((s) => s.removeTrackedWeapon)

  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [sortBy,       setSortBy]       = useState('rarity')
  const [viewMode,     setViewMode]     = useState('table') // 'table' | 'card'
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Enrich tracked weapons with their static metadata
  const enriched = useMemo(() => {
    return trackedWeapons.map((tw) => {
      const data = weaponsData.find((w) => w.name === tw.weaponName) || { name: tw.weaponName, rarity: 3, type: 'Unknown', materials: {} }
      const assignedChar = tw.assignedTo ? charactersData.find((c) => c.name === tw.assignedTo) : null
      return { ...tw, data, assignedChar }
    })
  }, [trackedWeapons])

  const filtered = useMemo(() => {
    let list = [...enriched]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((w) => w?.weaponName?.toLowerCase().includes(q) || w?.data?.type?.toLowerCase().includes(q))
    }
    if (typeFilter !== 'All') list = list.filter((w) => w.data?.type === typeFilter)
    if (rarityFilter !== 'All') {
      const r = parseInt(rarityFilter[0], 10)
      list = list.filter((w) => w.data?.rarity === r)
    }
    list.sort((a, b) => {
      if (sortBy === 'rarity') return (b.data?.rarity || 0) - (a.data?.rarity || 0) || (a.weaponName || '').localeCompare(b.weaponName || '')
      return (a.weaponName || '').localeCompare(b.weaponName || '')
    })
    return list
  }, [enriched, search, typeFilter, rarityFilter, sortBy])

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🗡️</span>
            <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">My Armory</h1>
          </div>
          <p className="text-[var(--muted)] text-sm ml-11">
            {trackedWeapons.length} weapon{trackedWeapons.length !== 1 ? 's' : ''} tracked
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
            id="add-weapon-btn"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md"
          >
            + Add Weapon
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {trackedWeapons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <span className="text-6xl mb-5">🗡️</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-xl mb-2">Your armory is empty</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Add weapons to track their progression and assign them to your roster characters.</p>
          <button onClick={() => setAddModalOpen(true)} className="genshin-btn-ghost">+ Add Weapon</button>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input type="search" placeholder="Search armory…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="relative">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors">
                  <option value="rarity">Sort: Rarity</option>
                  <option value="name">Sort: Name</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
              </div>
              <span className="text-[var(--muted)] text-xs">{filtered.length} / {trackedWeapons.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill ${typeFilter === t ? 'active' : ''}`}>
                  {WEAPON_TYPES[t]?.emoji || '🌐'} {t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_RARITIES.map((r) => (
                <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill ${rarityFilter === r ? 'active' : ''}`}>
                  {r === 'All' ? '🌐' : r === '5★' ? '⭐' : r === '4★' ? '💜' : '⚪'} {r}
                </button>
              ))}
            </div>
          </div>

          {/* ── Table View ── */}
          {viewMode === 'table' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-widest text-[var(--muted)]">
                    <th className="text-left px-4 py-3 font-semibold">Weapon</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Type</th>
                    <th className="text-center px-4 py-3 font-semibold">Lv</th>
                    <th className="text-center px-4 py-3 font-semibold">→ Lv</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Assigned Character</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wp, idx) => {
                    const rColor = RARITY_COLORS[wp.data?.rarity] || '#C8A96E'
                    const wpCfg  = WEAPON_TYPES[wp.data?.type] || { emoji: '⚔️' }
                    const assignedChar = wp.assignedChar
                    const elCfg = assignedChar ? (ELEMENTS[assignedChar.element] || ELEMENTS.Unknown) : null

                    return (
                      <tr
                        key={wp.id}
                        className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0 shadow" style={{ background: `${rColor}20`, border: `1px solid ${rColor}40` }}>
                              {wpCfg.emoji}
                            </div>
                            <div>
                              <p className="font-cinzel text-xs font-semibold text-[var(--text)]">{formatName(wp.weaponName)}</p>
                              <p className={`text-[10px] ${getRarityClass(wp.data?.rarity)}`}>{getStars(wp.data?.rarity || 1)}</p>
                            </div>
                          </div>
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-[var(--muted)]">{wpCfg.emoji} {wp.data?.type || '—'}</span>
                        </td>
                        {/* Current Level */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs font-bold text-[var(--text)]">{wp.level}</span>
                        </td>
                        {/* Target Level */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs font-bold text-[var(--gold)]">{wp.targetLevel}</span>
                        </td>
                        {/* Assigned character */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          {assignedChar && elCfg ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow" style={{ background: elCfg.avatarGradient }}>
                                <span className="font-cinzel text-[10px]" style={{ color: elCfg.color }}>{getInitials(assignedChar.name)}</span>
                              </div>
                              <span className="text-xs text-[var(--text)]">{formatName(assignedChar.name)}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--muted)] italic">Unassigned</span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeTrackedWeapon(wp.id)}
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
              {filtered.map((wp) => (
                <WeaponCard key={wp.id} weapon={wp.data} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modal ── */}
      {addModalOpen && <AddWeaponModal onClose={() => setAddModalOpen(false)} />}
    </div>
  )
}
