import React, { useState, useMemo } from 'react'
import WeaponCard from '../components/WeaponCard'
import WeaponInfoModal from '../components/WeaponInfoModal'
import weaponsData from '../data/weapons.json'
import { WEAPON_TYPES } from '../utils/gameData'

const ALL_WEAPONS  = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '5★', '4★', '3★', '2★', '1★']

export default function Weapons() {
  const [search,        setSearch]        = useState('')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [rarityFilter,  setRarityFilter]  = useState('All')
  const [sortBy,        setSortBy]        = useState('rarity')
  
  const [viewingWeapon, setViewingWeapon] = useState(null)

  // Filtered + sorted weapons
  const filtered = useMemo(() => {
    let list = [...weaponsData]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((w) =>
        w?.name?.toLowerCase().includes(q) ||
        w?.type?.toLowerCase().includes(q)
      )
    }
    if (weaponFilter !== 'All') list = list.filter((w) => w.type === weaponFilter)
    if (rarityFilter !== 'All') {
      const r = parseInt(rarityFilter[0], 10)
      list = list.filter((w) => w.rarity === r)
    }

    list.sort((a, b) => {
      if (sortBy === 'rarity') return (b.rarity || 0) - (a.rarity || 0) || (a.name || '').localeCompare(b.name || '')
      return (a.name || '').localeCompare(b.name || '')
    })

    return list
  }, [search, weaponFilter, rarityFilter, sortBy])

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗡️</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">
            Weapons
          </h1>
        </div>
        <p className="text-[var(--muted)] text-sm ml-11">
          Browse all {weaponsData.length} weapons, compare ascension materials, and find the perfect match.
        </p>
      </div>

      {/* ── Filter & Search Bar ─────────────────────── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-6">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">
              🔍
            </span>
            <input
              id="weapon-search"
              type="search"
              placeholder="Search weapons or types…"
              className="search-input w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search weapons"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors"
              aria-label="Sort weapons"
            >
              <option value="rarity">Sort: Rarity</option>
              <option value="name">Sort: Name</option>
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
          </div>

          {/* Result count */}
          <span className="text-[var(--muted)] text-xs whitespace-nowrap">
            {filtered.length} / {weaponsData.length} shown
          </span>
        </div>

        <div className="genshin-divider mb-4" />

        {/* Weapon + Rarity filters */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
              Weapon Type
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by weapon type">
              {ALL_WEAPONS.map((w) => (
                <button
                  key={w}
                  id={`filter-weapon-${w.toLowerCase()}`}
                  onClick={() => setWeaponFilter(w)}
                  className={`filter-pill ${weaponFilter === w ? 'active' : ''}`}
                  aria-pressed={weaponFilter === w}
                >
                  {WEAPON_TYPES[w]?.emoji || '🌐'} {w}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
              Rarity
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by rarity">
              {ALL_RARITIES.map((r) => (
                <button
                  key={r}
                  id={`filter-rarity-${r.replace('★', 'star').toLowerCase()}`}
                  onClick={() => setRarityFilter(r)}
                  className={`filter-pill ${rarityFilter === r ? 'active' : ''}`}
                  aria-pressed={rarityFilter === r}
                >
                  {r === '5★' ? '⭐' : r === '4★' ? '💜' : r === 'All' ? '🌐' : '⚪'} {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Weapon Grid ──────────────────────────── */}
      {filtered.length > 0 ? (
        <div
          id="weapon-grid"
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
          }}
        >
          {filtered.map((wp) => (
            <WeaponCard 
              key={wp.name} 
              weapon={wp} 
              onClick={(w) => setViewingWeapon(w)} 
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">🔍</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-lg mb-2">
            No weapons found
          </h3>
          <p className="text-[var(--muted)] text-sm max-w-xs">
            Try adjusting the filters or search query to see more weapons.
          </p>
          <button
            id="clear-filters-btn"
            onClick={() => { setSearch(''); setWeaponFilter('All'); setRarityFilter('All') }}
            className="mt-5 genshin-btn-ghost"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Info Modal ──────────────────────────────── */}
      {viewingWeapon && (
        <WeaponInfoModal 
          weapon={viewingWeapon} 
          onClose={() => setViewingWeapon(null)} 
        />
      )}
    </div>
  )
}
