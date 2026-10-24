import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import CharactersTable from '../components/CharactersTable'
import CharacterModal from '../components/CharacterModal'
import AddCharacterModal from '../components/AddCharacterModal'
import BulkEditCharacterModal from '../components/BulkEditCharacterModal'
import SortDirectionButton from '../components/SortDirectionButton'
import { compareNullableNumber, compareNullableString } from '../utils/sortUtils'
import charactersData from '../utils/characters'
import weaponsData from '../data/weapons.json'
import useStore from '../store/useStore'
import { getTravelerAwareWeaponId } from '../utils/travelerHelper'
import { resolveCharacterMaterials } from '../utils/dataManager'
import { ELEMENTS, WEAPON_TYPES } from '../utils/gameData'
import { getElementIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import { calculateProgressionCost, calculateAllTalentsCost } from '../utils/calculator'
import GenshinImage from '../components/GenshinImage'

const ALL_ELEMENTS = ['All', 'Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']
const ALL_WEAPONS  = ['All', 'Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst']
const ALL_RARITIES = ['All', '🟡 5★', '🟣 4★']

// Hoisted static lookup maps to avoid repeated O(N) array scans
const characterByName = new Map(charactersData.map((c, idx) => [c.name, { ...c, sl_no: idx + 1 }]))
const weaponByName = new Map(weaponsData.map((w) => [w.name, w]))

export default function Characters() {
  const roster         = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const updateCharacter = useStore((s) => s.updateCharacter)
  const removeCharacter = useStore((s) => s.removeCharacter)
  const batchRemoveCharacters = useStore((s) => s.batchRemoveCharacters)
  const bulkUpdateCharacters = useStore((s) => s.bulkUpdateCharacters)

  const [search,        setSearch]        = useState('')
  const [elementFilter, setElementFilter] = useState('All')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [rarityFilter,  setRarityFilter]  = useState('All')
  const [sortOrder,     setSortOrder]     = useState('Release')
  const [sortDirection, setSortDirection] = useState('asc')

  // R2.1: Always default to table regardless of viewport
  const [viewMode, setViewMode] = useState('table') // 'table' | 'card'

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingChar, setEditingChar] = useState(null)
  const [selectedNames, setSelectedNames] = useState([])
  const [slideDirection, setSlideDirection] = useState('next')

  // R2.1: Mobile collapsible search/filter state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Count active (non-default) filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (elementFilter !== 'All') count++
    if (weaponFilter !== 'All') count++
    if (rarityFilter !== 'All') count++
    if (sortOrder !== 'Release') count++
    if (sortDirection !== 'asc') count++
    return count
  }, [elementFilter, weaponFilter, rarityFilter, sortOrder, sortDirection])

  // Build full character objects for rostered characters, calculate their maths and pre-resolve materials
  const rostered = useMemo(() => {
    const trackedMap = new Map(trackedWeapons.map((w) => [w.id, w]))
    return Object.keys(roster)
      .map((name) => {
        const data = characterByName.get(name)
        if (!data) return null

        const entry = roster[name]

        // Progression Math
        const fromLevel = entry.level ?? 1
        const fromAsc = entry.ascension ?? 0
        const toLevel = entry.targetLevel ?? 90
        const toAsc = entry.targetAscension ?? 6

        const ascCosts = calculateProgressionCost(data, fromLevel, toLevel, fromAsc, toAsc)

        // Talent Math
        const talents = entry.talents || { normal: 1, skill: 1, burst: 1 }
        const targetTalents = entry.targetTalents || { normal: 1, skill: 1, burst: 1 }

        const talentCosts = calculateAllTalentsCost(data, {
          auto: { current: talents.normal, target: targetTalents.normal },
          skill: { current: talents.skill, target: targetTalents.skill },
          burst: { current: talents.burst, target: targetTalents.burst },
        })

        // Weapon
        let eqWeapon = null
        const awareWeaponId = getTravelerAwareWeaponId(data.name, entry, trackedWeapons)
        if (awareWeaponId) {
          const tracked = trackedMap.get(awareWeaponId)
          if (tracked) {
            const wData = weaponByName.get(tracked.weaponName)
            eqWeapon = { tracked, data: wData }
          }
        }

        const resolvedMaterials = resolveCharacterMaterials(data)

        return {
          ...data,
          sl_no: data.sl_no,
          entry,
          ascCosts,
          talentCosts,
          eqWeapon,
          resolvedMaterials
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
    if (rarityFilter !== 'All') {
      const rFilterNum = parseInt(rarityFilter.match(/\d+/)?.[0] || '0', 10)
      list = list.filter((c) => {
        const cRarity = typeof c.rarity === 'string' ? (c.rarity.match(/★/g)?.length || parseInt(c.rarity, 10) || 0) : (c.rarity || 0)
        return cRarity === rFilterNum
      })
    }

    const dirMult = sortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortOrder === 'Release') {
        return compareNullableNumber(a.release_order, b.release_order, sortDirection);
      } else if (sortOrder === 'Name') {
        return compareNullableString(a.name, b.name, sortDirection);
      } else if (sortOrder === 'Rarity') {
        const rarityA = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity, 10) || 0) : (a.rarity || 0);
        const rarityB = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity, 10) || 0) : (b.rarity || 0);
        return (rarityA - rarityB) * dirMult;
      } else if (sortOrder === 'Element') {
        return compareNullableString(a.element, b.element, sortDirection);
      } else if (sortOrder === 'Weapon') {
        const wA = a.weapon || a.weapon_type || '';
        const wB = b.weapon || b.weapon_type || '';
        return compareNullableString(wA, wB, sortDirection);
      }
      return 0;
    });
  }, [rostered, search, elementFilter, weaponFilter, rarityFilter, sortOrder, sortDirection])

  return (
    <div className="animate-fade-in">
      <BulkEditCharacterModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedIds={selectedNames}
        onSave={(patch) => {
          bulkUpdateCharacters(selectedNames, patch);
          setBulkModalOpen(false);
          setSelectedNames([]);
        }}
      />

      {/* ── Page Header ── */}
      <div className="sticky top-[var(--topbar-h,64px)] z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-3 sm:pb-4 pt-2 mb-4 sm:mb-6 border-b border-[var(--border)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <img src="/Characters.png" alt="My Roster" className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
          <div>
            <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)] leading-tight">My Roster</h1>
            <p className="text-[var(--muted)] text-xs sm:text-sm">
              {rostered.length} character{rostered.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {selectedNames.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete these ${selectedNames.length} characters?`)) {
                    batchRemoveCharacters(selectedNames);
                    setSelectedNames([]);
                  }
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors shadow-md animate-fade-in whitespace-nowrap min-h-[40px]"
              >
                Delete Selected ({selectedNames.length})
              </button>
              <button
                onClick={() => setBulkModalOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--bg)] transition-colors shadow-md animate-fade-in whitespace-nowrap min-h-[40px]"
              >
                Bulk Edit ({selectedNames.length})
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
                ⊞ Cards
              </button>
            </div>
            <button
              id="add-character-btn"
              onClick={() => setIsBatchModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md whitespace-nowrap min-h-[40px]"
            >
              + Batch Add Characters
            </button>
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {rostered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-32 text-center px-4">
          <span className="text-6xl mb-5">⚔️</span>
          <h3 className="font-semibold text-[var(--text)] text-xl mb-2">Your roster is empty</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Add characters to start tracking their progression goals and material costs.</p>
          <button onClick={() => setIsBatchModalOpen(true)} className="genshin-btn-ghost">+ Add Character</button>
        </div>
      ) : (
        <>
          {/* ── Mobile Search/Filter Toggle Buttons (< 768px) ── */}
          <div className="flex md:hidden items-center gap-2 mb-3">
            <button
              id="char-mobile-search-toggle"
              onClick={() => setMobileSearchOpen(v => !v)}
              aria-expanded={mobileSearchOpen}
              aria-controls="char-mobile-search-panel"
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
              id="char-mobile-filters-toggle"
              onClick={() => setMobileFiltersOpen(v => !v)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="char-mobile-filters-panel"
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
            <span className="text-[var(--muted)] text-[10px] whitespace-nowrap shrink-0">{filtered.length}/{rostered.length}</span>
          </div>

          {/* ── Mobile Search Panel ── */}
          {mobileSearchOpen && (
            <div id="char-mobile-search-panel" className="md:hidden mb-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input
                  type="search"
                  placeholder="Search roster…"
                  className="search-input w-full h-10 pl-9 pr-3 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search roster"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ── Mobile Filters Panel ── */}
          {mobileFiltersOpen && (
            <div id="char-mobile-filters-panel" className="md:hidden bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-3">
              {/* Sort row */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="relative flex-1">
                  <select
                    id="sort-select-mobile"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors min-h-[36px]"
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
                <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
              </div>

              <div className="genshin-divider my-2" />

              {/* Element filters */}
              <div className="mb-2">
                <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">Element</p>
                <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by element">
                  {ALL_ELEMENTS.map((el) => {
                    const cfg = ELEMENTS[el]
                    return (
                      <button key={el} onClick={() => setElementFilter(el)} className={`filter-pill shrink-0 ${elementFilter === el ? 'active' : ''}`}>
                        {el !== 'All' ? (
                          <GenshinImage src={getElementIcon(el)} alt={el} className="w-4 h-4 object-contain inline-block mr-1 shrink-0" fallback={<span>{cfg?.emoji}</span>} />
                        ) : <span className="mr-1">⚪</span>}
                        {el}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Weapon + Rarity filters */}
              <div className="mb-2">
                <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">Weapon</p>
                <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by weapon type">
                  {ALL_WEAPONS.map((wp) => {
                    const cfg = WEAPON_TYPES[wp]
                    return (
                      <button key={wp} onClick={() => setWeaponFilter(wp)} className={`filter-pill shrink-0 ${weaponFilter === wp ? 'active' : ''}`}>
                        {wp !== 'All' ? (
                          <GenshinImage src={getWeaponTypeIcon(wp)} alt={wp} className="w-4 h-4 object-contain inline-block mr-1 shrink-0" fallback={<span>{cfg?.emoji}</span>} />
                        ) : <span className="mr-1">⚔️</span>}
                        {wp}
                      </button>
                    )
                  })}
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
                  placeholder="Search roster…"
                  className="search-input w-full h-10 pl-9 pr-3 text-xs sm:text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search roster"
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
                  <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
                </div>

                <span className="text-[var(--muted)] text-xs whitespace-nowrap shrink-0">{filtered.length} / {rostered.length} shown</span>
              </div>
            </div>

            <div className="genshin-divider my-2.5 sm:my-4" />

            {/* Element filters */}
            <div className="mb-2.5 sm:mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-1.5 sm:mb-2">
                Element
              </p>
              <div className="flex items-center gap-2 overflow-x-auto flex-nowrap md:flex-wrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by element">
                {ALL_ELEMENTS.map((el) => {
                  const cfg = ELEMENTS[el]
                  return (
                    <button key={el} onClick={() => setElementFilter(el)} className={`filter-pill shrink-0 ${elementFilter === el ? 'active' : ''}`}>
                      {el !== 'All' ? (
                        <GenshinImage src={getElementIcon(el)} alt={el} className="w-5 h-5 object-contain inline-block mr-1.5 sm:mr-2 shrink-0" fallback={<span>{cfg?.emoji}</span>} />
                      ) : <span className="mr-1.5 sm:mr-2">⚪</span>}
                      {el}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Weapon + Rarity filters */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-1.5 sm:mb-2">
                  Weapon
                </p>
                <div className="flex items-center gap-2 overflow-x-auto flex-nowrap md:flex-wrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by weapon type">
                  {ALL_WEAPONS.map((wp) => {
                    const cfg = WEAPON_TYPES[wp]
                    return (
                      <button key={wp} onClick={() => setWeaponFilter(wp)} className={`filter-pill shrink-0 ${weaponFilter === wp ? 'active' : ''}`}>
                        {wp !== 'All' ? (
                          <GenshinImage src={getWeaponTypeIcon(wp)} alt={wp} className="w-5 h-5 object-contain inline-block mr-1.5 sm:mr-2 shrink-0" fallback={<span>{cfg?.emoji}</span>} />
                        ) : <span className="mr-1.5 sm:mr-2">⚔️</span>}
                        {wp}
                      </button>
                    )
                  })}
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
              <CharactersTable
                data={filtered}
                selectedNames={selectedNames}
                setSelectedNames={setSelectedNames}
                setEditingChar={setEditingChar}
                updateCharacter={updateCharacter}
                removeCharacter={removeCharacter}
              />
            </div>
          )}

          {/* ── Card View ── */}
          {viewMode === 'card' && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((char) => (
                <CharacterCard key={char.name} character={char} onClick={() => setEditingChar(char)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {isBatchModalOpen && <AddCharacterModal onClose={() => setIsBatchModalOpen(false)} onSelect={(char) => { setIsBatchModalOpen(false); setEditingChar(char); }} />}
      {editingChar && (() => {
        const editingCharIndex = filtered.findIndex((c) => c.name === editingChar.name);
        return (
          <CharacterModal
            character={editingChar}
            onClose={() => setEditingChar(null)}
            onNext={() => {
              if (editingCharIndex >= 0 && editingCharIndex < filtered.length - 1) {
                setSlideDirection('next');
                setEditingChar(filtered[editingCharIndex + 1]);
              }
            }}
            onPrev={() => {
              if (editingCharIndex > 0) {
                setSlideDirection('prev');
                setEditingChar(filtered[editingCharIndex - 1]);
              }
            }}
            hasNext={editingCharIndex >= 0 && editingCharIndex < filtered.length - 1}
            hasPrev={editingCharIndex > 0}
            slideDirection={slideDirection}
          />
        );
      })()}
    </div>
  )
}
