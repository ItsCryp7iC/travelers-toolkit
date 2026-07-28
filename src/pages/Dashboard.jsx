import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import ResinTracker from '../components/ResinTracker'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES } from '../utils/gameData'

const ALL_ELEMENTS = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]
const ALL_WEAPONS  = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '5★', '4★']

// Summary stats
function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stat-card">
      <div
        className="stat-icon"
        style={{ background: accent ? `${accent}20` : 'rgba(200,169,110,0.12)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[var(--muted)] text-xs mb-0.5">{label}</p>
        <p
          className="font-cinzel font-bold text-xl leading-none"
          style={{ color: accent || 'var(--gold)' }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const roster = useStore((s) => s.roster)

  const [search,        setSearch]        = useState('')
  const [elementFilter, setElementFilter] = useState('All')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [rarityFilter,  setRarityFilter]  = useState('All')
  const [sortBy,        setSortBy]        = useState('name') // 'name' | 'rarity' | 'element'

  // Filtered + sorted characters
  const filtered = useMemo(() => {
    let list = [...charactersData]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.element?.toLowerCase().includes(q)
      )
    }
    if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
    if (weaponFilter  !== 'All') list = list.filter((c) => c.weapon_type === weaponFilter)
    if (rarityFilter  !== 'All') {
      const r = rarityFilter === '5★' ? 5 : 4
      list = list.filter((c) => c.rarity === r)
    }

    list.sort((a, b) => {
      if (sortBy === 'rarity') return b.rarity - a.rarity
      if (sortBy === 'element') return (a.element || '').localeCompare(b.element || '')
      return a.name.localeCompare(b.name)
    })

    return list
  }, [search, elementFilter, weaponFilter, rarityFilter, sortBy])

  // Stats
  const total5Star  = charactersData.filter((c) => c.rarity === 5).length
  const total4Star  = charactersData.filter((c) => c.rarity === 4).length
  const rosterCount = Object.keys(roster).length
  const elementCount = [...new Set(charactersData.map((c) => c.element).filter(Boolean))].length

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏔️</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">
            Dashboard
          </h1>
        </div>
        <p className="text-[var(--muted)] text-sm ml-11">
          Browse all characters and manage your roster
        </p>
      </div>

      {/* ── Resin Tracker ────────────────────────────── */}
      <div className="mb-8">
        <ResinTracker />
      </div>

      {/* ── Stats Strip ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👥" label="Total Characters" value={charactersData.length} />
        <StatCard icon="⭐" label="5★ Characters"   value={total5Star}  accent="#FFD700" />
        <StatCard icon="💜" label="4★ Characters"   value={total4Star}  accent="#B07FE8" />
        <StatCard icon="📋" label="In My Roster"    value={rosterCount} accent="#4EC9B0" />
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
              id="character-search"
              type="search"
              placeholder="Search characters or elements…"
              className="search-input w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search characters"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors"
              aria-label="Sort characters"
            >
              <option value="name">Sort: Name</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="element">Sort: Element</option>
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
          </div>

          {/* Result count */}
          <span className="text-[var(--muted)] text-xs whitespace-nowrap">
            {filtered.length} / {charactersData.length} shown
          </span>
        </div>

        <div className="genshin-divider mb-4" />

        {/* Element filters */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
            Element
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by element">
            {ALL_ELEMENTS.map((el) => {
              const config = ELEMENTS[el]
              return (
                <button
                  key={el}
                  id={`filter-element-${el.toLowerCase()}`}
                  onClick={() => setElementFilter(el)}
                  data-element={el}
                  className={`filter-pill ${elementFilter === el ? 'active' : ''}`}
                  aria-pressed={elementFilter === el}
                >
                  {config ? config.emoji : '🌐'}
                  <span>{el}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Weapon + Rarity filters */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
              Weapon
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
            <div className="flex gap-2" role="group" aria-label="Filter by rarity">
              {ALL_RARITIES.map((r) => (
                <button
                  key={r}
                  id={`filter-rarity-${r.replace('★', 'star').toLowerCase()}`}
                  onClick={() => setRarityFilter(r)}
                  className={`filter-pill ${rarityFilter === r ? 'active' : ''}`}
                  aria-pressed={rarityFilter === r}
                >
                  {r === '5★' ? '⭐' : r === '4★' ? '💜' : '🌐'} {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Character Grid ──────────────────────────── */}
      {filtered.length > 0 ? (
        <div
          id="character-grid"
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
          }}
        >
          {filtered.map((char) => (
            <CharacterCard key={char.name} character={char} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">🔍</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-lg mb-2">
            No characters found
          </h3>
          <p className="text-[var(--muted)] text-sm max-w-xs">
            Try adjusting the filters or search query to see more characters.
          </p>
          <button
            id="clear-filters-btn"
            onClick={() => { setSearch(''); setElementFilter('All'); setWeaponFilter('All'); setRarityFilter('All') }}
            className="mt-5 genshin-btn-ghost"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}
