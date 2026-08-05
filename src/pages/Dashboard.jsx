import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import weaponsData from '../data/weapons.json'
import ResinTracker from '../components/ResinTracker'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import GenshinImage from '../components/GenshinImage'
import { getElementIcon, getWeaponTypeIcon, getCharacterAvatar } from '../utils/assetHelper'

const ALL_ELEMENTS = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]
const ALL_WEAPONS  = ['All', ...Object.keys(WEAPON_TYPES)]
const RARITY_FILTERS = [
  { label: 'All', value: 'All' },
  { label: '🟡 5★', value: 5 },
  { label: '🟣 4★', value: 4 }
]

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
  const batchAddCharacters = useStore((s) => s.batchAddCharacters)
  const trackedWeapons = useStore((s) => s.trackedWeapons) || []

  const [activeTab, setActiveTab] = useState('characters');
  const [selectedWeapon, setSelectedWeapon] = useState(null);

  const handleAddAllCharacters = () => {
    const missing = charactersData.filter((c) => !roster[c.name])
    if (missing.length === 0) {
      alert("All available characters are already in your roster!")
      return
    }
    
    if (!window.confirm(`Are you sure you want to add all ${missing.length} missing characters to your roster?`)) return
    
    batchAddCharacters(missing.map((c) => c.name))
    alert(`Successfully added ${missing.length} missing characters!`)
  }

  const [search,        setSearch]        = useState('')
  const [elementFilter, setElementFilter] = useState('All')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [rarityFilter,  setRarityFilter]  = useState('All')
  const [sortBy,        setSortBy]        = useState('Release') // 'Release' | 'Name' | 'Rarity' | 'Element'

  // Filtered + sorted characters
  const filtered = useMemo(() => {
    if (activeTab === 'characters') {
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
        list = list.filter((c) => {
          const matchesRarity = rarityFilter === 'All' || Number(c.rarity?.length || c.rarity || 0) === Number(rarityFilter);
          return matchesRarity;
        })

      list.sort((a, b) => {
        if (sortBy === 'Release') {
          const orderA = a.release_order ?? 999;
          const orderB = b.release_order ?? 999;
          return orderA - orderB;
        }
        if (sortBy === 'Rarity') {
          const rarityA = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0);
          const rarityB = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0);
          return rarityB - rarityA;
        }
        if (sortBy === 'Element') return (a.element || '').localeCompare(b.element || '')
        if (sortBy === 'Weapon') {
          const wA = a.weapon || a.weapon_type || '';
          const wB = b.weapon || b.weapon_type || '';
          return wA.localeCompare(wB);
        }
        if (sortBy === 'Name') return a.name.localeCompare(b.name)
        return 0;
      })

      return list
    } else {
      let list = [...weaponsData]
      if (search.trim()) {
        const q = search.toLowerCase()
        list = list.filter((w) => w.name.toLowerCase().includes(q))
      }
      if (weaponFilter !== 'All') list = list.filter((w) => w.type === weaponFilter)
        list = list.filter((w) => {
          const matchesRarity = rarityFilter === 'All' || Number(w.rarity?.length || w.rarity || 0) === Number(rarityFilter);
          return matchesRarity;
        })
      list.sort((a, b) => {
        if (sortBy === 'Rarity' || sortBy === 'Release') {
          return (b.rarity || 0) - (a.rarity || 0)
        }
        if (sortBy === 'Weapon') {
          return (a.type || '').localeCompare(b.type || '')
        }
        if (sortBy === 'Name') return a.name.localeCompare(b.name)
        return 0;
      })
      return list
    }
  }, [activeTab, search, elementFilter, weaponFilter, rarityFilter, sortBy])

  // Stats
  const total5StarChars = charactersData.filter((c) => Number(c.rarity?.length || c.rarity || 0) === 5).length
  const total4StarChars = charactersData.filter((c) => Number(c.rarity?.length || c.rarity || 0) === 4).length
  const rosterCount = Object.keys(roster).length
  const total5StarWeapons = weaponsData.filter((w) => Number(w.rarity?.length || w.rarity || 0) === 5).length
  const total4StarWeapons = weaponsData.filter((w) => Number(w.rarity?.length || w.rarity || 0) === 4).length
  const trackedWeaponsCount = trackedWeapons.length

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ────────────────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌍</span>
            <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">
              Dashboard
            </h1>
          </div>
          <p className="text-[var(--muted)] text-sm ml-11">
            {activeTab === 'characters' ? 'Browse all characters and manage your roster' : 'Browse and track your weapons'}
          </p>
        </div>
        
        {activeTab === 'characters' && (
          <button 
            onClick={handleAddAllCharacters}
            className="flex items-center gap-2 px-4 py-2 border border-[#C8A96E]/50 text-[#C8A96E] hover:bg-[#C8A96E]/10 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <span className="text-lg">✦</span>
            Add All Available Characters
          </button>
        )}
      </div>

      {/* ── Resin Tracker ────────────────────────────── */}
      <div className="mb-6">
        <ResinTracker />
      </div>

      {/* ── Tab Toggle ──────────────────────────────── */}
      <div className="flex justify-center mb-8">
        <div className="bg-[var(--elevated)] border border-[var(--border)] p-1 rounded-full inline-flex">
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'characters' 
                ? 'bg-[var(--gold)] text-gray-900 shadow-md' 
                : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            Characters
          </button>
          <button
            onClick={() => setActiveTab('weapons')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'weapons' 
                ? 'bg-[var(--gold)] text-gray-900 shadow-md' 
                : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            Weapons
          </button>
        </div>
      </div>

      {/* ── Stats Strip ────────────────────────────── */}
      {activeTab === 'characters' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
          <StatCard icon="👥" label="Total Characters" value={charactersData.length} />
          <StatCard icon="⭐" label="5★ Characters"   value={total5StarChars}  accent="#FFD700" />
          <StatCard icon="💜" label="4★ Characters"   value={total4StarChars}  accent="#B07FE8" />
          <StatCard icon="📋" label="In My Roster"    value={rosterCount} accent="#4EC9B0" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
          <StatCard icon="🗡️" label="Total Weapons" value={weaponsData.length} />
          <StatCard icon="⭐" label="5★ Weapons"   value={total5StarWeapons}  accent="#FFD700" />
          <StatCard icon="💜" label="4★ Weapons"   value={total4StarWeapons}  accent="#B07FE8" />
          <StatCard icon="📋" label="Tracked Weapons" value={trackedWeaponsCount} accent="#4EC9B0" />
        </div>
      )}

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
              placeholder={activeTab === 'characters' ? "Search characters or elements…" : "Search weapons…"}
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
                <option value="Release">by Release</option>
                <option value="Name">by Name</option>
                <option value="Rarity">by Rarity</option>
                <option value="Element">by Element</option>
                <option value="Weapon">by Weapon</option>
              </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
          </div>

          {/* Result count */}
          <span className="text-[var(--muted)] text-xs whitespace-nowrap">
            {filtered.length} / {activeTab === 'characters' ? charactersData.length : weaponsData.length} shown
          </span>
        </div>

        <div className="genshin-divider mb-4" />

        {/* Element filters */}
        {activeTab === 'characters' && (
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
                    {el !== 'All' ? (
                      <GenshinImage src={getElementIcon(el)} alt={el} className="w-5 h-5 object-contain inline-block mr-2" fallback={<span>{config?.emoji}</span>} />
                    ) : <span className="mr-2">🌐</span>}
                    <span>{el}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
                  {w !== 'All' ? (
                    <GenshinImage src={getWeaponTypeIcon(w)} alt={w} className="w-5 h-5 object-contain inline-block mr-2" fallback={<span>{WEAPON_TYPES[w]?.emoji}</span>} />
                  ) : <span className="mr-2">🌐</span>}
                  <span>{w}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
              Rarity
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by rarity">
              {[...RARITY_FILTERS, ...(activeTab === 'weapons' ? [
                { label: '🔵 3★', value: 3 },
                { label: '🟢 2★', value: 2 },
                { label: '⚪ 1★', value: 1 }
              ] : [])].map((r) => (
                  <button
                    key={r.value}
                    id={`filter-rarity-${String(r.value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`}
                    onClick={() => setRarityFilter(r.value)}
                    className={`filter-pill ${rarityFilter === r.value ? 'active' : ''}`}
                    aria-pressed={rarityFilter === r.value}
                  >
                    {r.label}
                  </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Character Grid ──────────────────────────── */}
      {filtered.length > 0 ? (
        <div
          id="dashboard-grid"
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
          }}
        >
          {filtered.map((item) => (
            activeTab === 'characters' 
              ? <CharacterCard key={item.name} character={item} />
              : <WeaponCard key={item.id} weapon={item} onClick={() => setSelectedWeapon(item)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">🔍</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-lg mb-2">
            No {activeTab} found
          </h3>
          <p className="text-[var(--muted)] text-sm max-w-xs">
            Try adjusting the filters or search query to see more {activeTab}.
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

      {selectedWeapon && (
        <AddWeaponModal 
          initialWeapon={selectedWeapon}
          onClose={() => setSelectedWeapon(null)} 
        />
      )}
    </div>
  )
}
