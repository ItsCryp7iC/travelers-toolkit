import React, { useState, useMemo } from 'react'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import BatchAddWeaponModal from '../components/BatchAddWeaponModal'
import BulkEditWeaponModal from '../components/BulkEditWeaponModal'
import SortDirectionButton from '../components/SortDirectionButton'
import { compareNullableNumber, compareNullableString } from '../utils/sortUtils'
import ForgingQueuePanel from '../components/ForgingQueuePanel'
import weaponsData from '../data/weapons.json'
import charactersData from '../utils/characters'
import useStore from '../store/useStore'
import { WEAPON_TYPES } from '../utils/gameData'
import { calculateWeaponCost } from '../utils/calculator'
import { resolveWeaponMaterials } from '../utils/dataManager'
import { getWeaponTypeIcon } from '../utils/assetHelper'
import GenshinImage from '../components/GenshinImage'
import WeaponsTable from '../components/WeaponsTable'

const ALL_TYPES    = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '🟡 5★', '🟣 4★', '🔵 3★', '🟢 2★', '⚪ 1★']

// Hoisted static lookup maps to avoid repeated O(N) array scans
const weaponById = new Map(weaponsData.map((w) => [w.id, w]))
const weaponByName = new Map(weaponsData.map((w) => [w.name, w]))
const characterByName = new Map(charactersData.map((c) => [c.name, c]))

export default function Weapons() {
  const trackedWeapons      = useStore((s) => s.trackedWeapons)
  const removeTrackedWeapon = useStore((s) => s.removeTrackedWeapon)
  const batchRemoveWeapons  = useStore((s) => s.batchRemoveWeapons)
  const updateTrackedWeapon = useStore((s) => s.updateTrackedWeapon)
  const bulkUpdateWeapons   = useStore((s) => s.bulkUpdateWeapons)

  const [pageTab,      setPageTab]      = useState('armory') // 'armory' | 'forge'
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [sortOrder,    setSortOrder]    = useState('Release')
  const [sortDirection, setSortDirection] = useState('asc')

  // R2.1: Always default to table regardless of viewport
  const [viewMode, setViewMode] = useState('table') // 'table' | 'card'
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingWeapon, setEditingWeapon] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [slideDirection, setSlideDirection] = useState('next')

  // R2.1: Mobile collapsible search/filter state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Count active (non-default) filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (typeFilter !== 'All') count++
    if (rarityFilter !== 'All') count++
    if (sortOrder !== 'Release') count++
    if (sortDirection !== 'asc') count++
    return count
  }, [typeFilter, rarityFilter, sortOrder, sortDirection])

  // Enrich tracked weapons with their static metadata, pre-resolved materials and costs
  const enriched = useMemo(() => {
    const mapped = trackedWeapons.map((tw) => {
      const data = weaponById.get(tw.weapon_id) || weaponByName.get(tw.weaponName) || { name: tw.weaponName, rarity: 3, type: 'Unknown', materials: {} }
      const assignedChar = tw.assignedTo ? (characterByName.get(tw.assignedTo) || null) : null
      const costs = calculateWeaponCost(data, tw.level, tw.targetLevel, tw.ascension, tw.targetAscension, tw.hasEventBonus)
      const resolvedMaterials = resolveWeaponMaterials(data)

      return { ...tw, data, assignedChar, costs, resolvedMaterials }
    })
    
    // Default sort chronological based on createdAt
    mapped.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    
    // Add sequential Sl No
    return mapped.map((w, idx) => ({ ...w, sl_no: idx + 1 }))
  }, [trackedWeapons])

  const filtered = useMemo(() => {
    let list = [...enriched]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((w) => w?.weaponName?.toLowerCase().includes(q) || w?.data?.type?.toLowerCase().includes(q))
    }
    if (typeFilter !== 'All') list = list.filter((w) => w.data?.type === typeFilter)
    if (rarityFilter !== 'All') {
      const rFilterNum = parseInt(rarityFilter.match(/\d+/)?.[0] || '0', 10)
      list = list.filter((w) => {
        const rawRarity = w.data?.rarity
        const wRarity = typeof rawRarity === 'string' ? (rawRarity.match(/★/g)?.length || parseInt(rawRarity, 10) || 0) : (rawRarity || 0)
        return wRarity === rFilterNum
      })
    }
    
    const dirMult = sortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortOrder === 'Release') {
        return compareNullableNumber(a.data?.release_order, b.data?.release_order, sortDirection);
      } else if (sortOrder === 'Name') {
        return compareNullableString(a.weaponName, b.weaponName, sortDirection);
      } else if (sortOrder === 'Rarity') {
        const rarityA = typeof a.data?.rarity === 'string' ? (a.data.rarity.match(/★/g)?.length || parseInt(a.data.rarity) || 0) : (a.data?.rarity || 0);
        const rarityB = typeof b.data?.rarity === 'string' ? (b.data.rarity.match(/★/g)?.length || parseInt(b.data.rarity) || 0) : (b.data?.rarity || 0);
        return (rarityA - rarityB) * dirMult;
      } else if (sortOrder === 'Type') {
        return compareNullableString(a.data?.type, b.data?.type, sortDirection);
      } else if (sortOrder === 'Character') {
        const charA_Name = a.assignedTo;
        const charB_Name = b.assignedTo;

        if (!charA_Name && !charB_Name) return compareNullableNumber(a.data?.release_order, b.data?.release_order, sortDirection);
        if (!charA_Name) return 1;
        if (!charB_Name) return -1;

        const charA = a.assignedChar || {};
        const charB = b.assignedChar || {};
        
        const charOrderComp = compareNullableNumber(charA.release_order, charB.release_order, sortDirection);
        if (charOrderComp !== 0) return charOrderComp;
        
        return compareNullableNumber(a.data?.release_order, b.data?.release_order, sortDirection);
      }
      return 0;
    })
  }, [enriched, search, typeFilter, rarityFilter, sortOrder, sortDirection])

  return (
    <div className="animate-fade-in">
      <BulkEditWeaponModal 
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedIds={selectedIds}
        onSave={(payloads) => {
          if (Array.isArray(payloads)) {
            bulkUpdateWeapons(payloads);
          } else {
            bulkUpdateWeapons(selectedIds, payloads);
          }
          setBulkModalOpen(false);
          setSelectedIds([]);
        }}
      />
      {/* 🔮 Page Header 🔮 */}
      <div className="sticky top-[var(--topbar-h,64px)] z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-3 sm:pb-4 pt-2 mb-4 sm:mb-6 border-b border-[var(--border)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <img src={pageTab === 'armory' ? '/Weapons.png' : '/Forging.png'} alt={pageTab === 'armory' ? 'My Armory' : 'To Forge'} className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
          <div>
            <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)] leading-tight">
              {pageTab === 'armory' ? 'My Armory' : 'To Forge'}
            </h1>
            <p className="text-[var(--muted)] text-xs sm:text-sm">
              {pageTab === 'armory'
                ? `${trackedWeapons.length} weapon${trackedWeapons.length !== 1 ? 's' : ''} tracked`
                : 'Track weapons you want to forge'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Page tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)] shrink-0">
            <button
              id="weapons-tab-armory"
              onClick={() => setPageTab('armory')}
              className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center ${pageTab === 'armory' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
            >
              🗡️ My Armory
            </button>
            <button
              id="weapons-tab-forge"
              onClick={() => setPageTab('forge')}
              className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center ${pageTab === 'forge' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
            >
              ⚒️ To Forge
            </button>
          </div>

          {/* Armory-only controls */}
          {pageTab === 'armory' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete these ${selectedIds.length} weapons?`)) {
                        batchRemoveWeapons(selectedIds);
                        setSelectedIds([]);
                      }
                    }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors shadow-md animate-fade-in whitespace-nowrap min-h-[40px]"
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                  <button
                    onClick={() => setBulkModalOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--bg)] transition-colors shadow-md animate-fade-in whitespace-nowrap min-h-[40px]"
                  >
                    Bulk Edit ({selectedIds.length})
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between sm:justify-end gap-2">
                {/* View toggle */}
                <div className="flex rounded-lg overflow-hidden border border-[var(--border)] shrink-0">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center ${viewMode === 'table' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    ☰ Table
                  </button>
                  <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] flex items-center justify-center ${viewMode === 'card' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    📋 Cards
                  </button>
                </div>
                <button
                  id="add-weapon-btn"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md whitespace-nowrap min-h-[40px]"
                >
                  + Batch Add Weapons
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── To Forge tab ── */}
      {pageTab === 'forge' && <ForgingQueuePanel />}

      {/* ── My Armory tab ── */}
      {pageTab === 'armory' && (
        <>
          {/* ── Empty state ── */}
          {trackedWeapons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 md:py-32 text-center px-4">
              <span className="text-6xl mb-5">🗡️</span>
              <h3 className="font-semibold text-[var(--text)] text-xl mb-2">Your armory is empty</h3>
              <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Add weapons to track their progression and assign them to your roster characters.</p>
              <button onClick={() => setIsBatchModalOpen(true)} className="genshin-btn-ghost">+ Batch Add Weapons</button>
            </div>
          ) : (
            <>
              {/* ── Mobile Search/Filter Toggle Buttons (< 768px) ── */}
              <div className="flex md:hidden items-center gap-2 mb-3">
                <button
                  id="wpn-mobile-search-toggle"
                  onClick={() => setMobileSearchOpen(v => !v)}
                  aria-expanded={mobileSearchOpen}
                  aria-controls="wpn-mobile-search-panel"
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
                    search.trim()
                      ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/10'
                      : 'border-[var(--border)] text-[var(--muted)] bg-[var(--surface)]'
                  }`}
                >
                  🔍 Search
                  {search.trim() && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setSearch('');
                        }
                      }}
                      className="ml-1 text-[10px] bg-[var(--gold)]/20 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-[var(--gold)]/40 cursor-pointer"
                      aria-label="Clear search"
                    >✕</span>
                  )}
                </button>
                <button
                  id="wpn-mobile-filters-toggle"
                  onClick={() => setMobileFiltersOpen(v => !v)}
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="wpn-mobile-filters-panel"
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
                    activeFilterCount > 0
                      ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/10'
                      : 'border-[var(--border)] text-[var(--muted)] bg-[var(--surface)]'
                  }`}
                >
                  ⚙ Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1 text-[10px] bg-[var(--gold)] text-[var(--bg)] rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeFilterCount}</span>
                  )}
                </button>
                <span className="text-[var(--muted)] text-[10px] whitespace-nowrap shrink-0">{filtered.length}/{trackedWeapons.length}</span>
              </div>

              {/* ── Mobile Search Panel ── */}
              {mobileSearchOpen && (
                <div id="wpn-mobile-search-panel" className="md:hidden mb-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                    <input
                      type="search"
                      placeholder="Search armory…"
                      className="search-input w-full h-10 pl-9 pr-3 text-xs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search armory"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* ── Mobile Filters Panel ── */}
              {mobileFiltersOpen && (
                <div id="wpn-mobile-filters-panel" className="md:hidden bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-3">
                  {/* Sort row */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="relative flex-1">
                      <select
                        id="sort-select-mobile"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="w-full appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors min-h-[36px]"
                        aria-label="Sort weapons"
                      >
                        <option value="Release">by Release</option>
                        <option value="Name">by Name</option>
                        <option value="Rarity">by Rarity</option>
                        <option value="Type">by Type</option>
                        <option value="Character">by Character</option>
                      </select>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
                    </div>
                    <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
                  </div>

                  <div className="genshin-divider my-2" />

                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">Weapon</p>
                    <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by weapon type">
                      {ALL_TYPES.map((t) => (
                        <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill shrink-0 ${typeFilter === t ? 'active' : ''}`}>
                          {t !== 'All' ? (
                            <GenshinImage src={getWeaponTypeIcon(t)} alt={t} className="w-4 h-4 object-contain inline-block mr-1 shrink-0" fallback={<span>{WEAPON_TYPES[t]?.emoji}</span>} />
                          ) : <span className="mr-1">⚔️</span>}
                          <span>{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">Rarity</p>
                    <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by rarity">
                      {ALL_RARITIES.map((r) => (
                        <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill shrink-0 ${rarityFilter === r ? 'active' : ''}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Desktop Filters (≥ 768px) ── */}
              <div className="hidden md:block bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6">
                {/* Search row */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                    <input
                      type="search"
                      placeholder="Search armory…"
                      className="search-input w-full h-10 pl-9 pr-3 text-xs sm:text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search armory"
                    />
                  </div>

                  {/* Sort dropdown */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 md:flex-initial">
                      <div className="relative flex-1 md:flex-initial">
                        <select
                          id="sort-select"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                          className="w-full appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors min-h-[40px]"
                          aria-label="Sort weapons"
                        >
                          <option value="Release">by Release</option>
                          <option value="Name">by Name</option>
                          <option value="Rarity">by Rarity</option>
                          <option value="Type">by Type</option>
                          <option value="Character">by Character</option>
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
                      </div>
                      <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
                    </div>

                    <span className="text-[var(--muted)] text-xs whitespace-nowrap shrink-0">{filtered.length} / {trackedWeapons.length} shown</span>
                  </div>
                </div>

                <div className="genshin-divider my-2.5 sm:my-4" />

                <div className="flex flex-col md:flex-row gap-3 sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-1.5 sm:mb-2">
                      Weapon
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto flex-nowrap md:flex-wrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by weapon type">
                      {ALL_TYPES.map((t) => (
                        <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill shrink-0 ${typeFilter === t ? 'active' : ''}`}>
                          {t !== 'All' ? (
                            <GenshinImage src={getWeaponTypeIcon(t)} alt={t} className="w-5 h-5 object-contain inline-block mr-1.5 sm:mr-2 shrink-0" fallback={<span>{WEAPON_TYPES[t]?.emoji}</span>} />
                          ) : <span className="mr-1.5 sm:mr-2">⚔️</span>}
                          <span>{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-1.5 sm:mb-2">
                      Rarity
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto flex-nowrap md:flex-wrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by rarity">
                      {ALL_RARITIES.map((r) => (
                        <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill shrink-0 ${rarityFilter === r ? 'active' : ''}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Table View ── */}
              {viewMode === 'table' && (
                <div className="w-full min-w-0 max-w-full overflow-hidden">
                  <WeaponsTable
                    data={filtered}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    setEditingWeapon={setEditingWeapon}
                    updateWeapon={updateTrackedWeapon}
                    removeWeapon={(id) => {
                      if (window.confirm('Are you sure you want to delete this weapon?')) {
                        removeTrackedWeapon(id);
                      }
                    }}
                  />
                </div>
              )}

              {/* ── Card View ── */}
              {viewMode === 'card' && (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((wp) => (
                    <WeaponCard
                      key={wp.id}
                      weapon={wp.data}
                      trackedWeapon={wp}
                      onClick={() => setEditingWeapon(wp)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {isBatchModalOpen && <BatchAddWeaponModal onClose={() => setIsBatchModalOpen(false)} />}
      {editingWeapon && (() => {
        const editingWeaponIndex = filtered.findIndex((w) => w === editingWeapon);
        return (
          <AddWeaponModal
            existingWeapon={editingWeapon}
            onClose={() => setEditingWeapon(null)}
            onNext={() => {
              if (editingWeaponIndex >= 0 && editingWeaponIndex < filtered.length - 1) {
                setSlideDirection('next');
                setEditingWeapon(filtered[editingWeaponIndex + 1]);
              }
            }}
            onPrev={() => {
              if (editingWeaponIndex > 0) {
                setSlideDirection('prev');
                setEditingWeapon(filtered[editingWeaponIndex - 1]);
              }
            }}
            hasNext={editingWeaponIndex >= 0 && editingWeaponIndex < filtered.length - 1}
            hasPrev={editingWeaponIndex > 0}
            slideDirection={slideDirection}
            currentIndex={editingWeaponIndex}
          />
        );
      })()}
    </div>
  )
}
