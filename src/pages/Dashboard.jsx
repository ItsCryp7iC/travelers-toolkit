import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CharacterCard from '../components/CharacterCard'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import BatchAddWeaponModal from '../components/BatchAddWeaponModal'
import weaponsData from '../data/weapons.json'
import ResinTracker from '../components/ResinTracker'
import RealmCurrencyTracker from '../components/RealmCurrencyTracker'
import charactersData from '../utils/characters'
import CookiePromptModal from '../components/CookiePromptModal'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import GenshinImage from '../components/GenshinImage'
import { getElementIcon, getWeaponTypeIcon, getCharacterAvatar } from '../utils/assetHelper'
import SortDirectionButton from '../components/SortDirectionButton'
import { compareNullableNumber, compareNullableString } from '../utils/sortUtils'
import notify from '../utils/notify'

const ALL_ELEMENTS = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]
const ALL_WEAPONS = ['All', ...Object.keys(WEAPON_TYPES)]
const RARITY_FILTERS = [
 { label: 'All', value: 'All' },
 { label: '🟡 5★', value: 5 },
 { label: '🟣 4★', value: 4 }
]

const TOTAL_5_STAR_CHARS = charactersData.filter((c) => Number(c.rarity?.length || c.rarity || 0) === 5).length
const TOTAL_4_STAR_CHARS = charactersData.filter((c) => Number(c.rarity?.length || c.rarity || 0) === 4).length
const TOTAL_5_STAR_WEAPONS = weaponsData.filter((w) => Number(w.rarity?.length || w.rarity || 0) === 5).length
const TOTAL_4_STAR_WEAPONS = weaponsData.filter((w) => Number(w.rarity?.length || w.rarity || 0) === 4).length

// Summary stats
function StatCard({ icon, label, value, accent }) {
 return (
 <div className="stat-card">
 <div
 className="stat-icon shrink-0"
 style={{ background: accent ? `${accent}20` : 'rgba(200,169,110,0.12)' }}
 >
 {icon}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-[var(--muted)] text-[11px] sm:text-xs mb-0.5 truncate">{label}</p>
 <p
 className="text-lg sm:text-xl font-bold leading-none truncate"
 style={{ color: accent || 'var(--gold)' }}
 >
 {value}
 </p>
 </div>
 </div>
 )
}

export default function Dashboard() {
 const navigate = useNavigate();
 const hoyolabConnected = useStore((s) => s.hoyolabConnected);

 const hasCookie = hoyolabConnected;
 const rosterCount = useStore((s) => Object.keys(s.roster).length)
 const batchAddCharacters = useStore((s) => s.batchAddCharacters)
 const trackedWeaponsCount = useStore((s) => s.trackedWeapons ? s.trackedWeapons.length : 0)

 const [activeTab, setActiveTab] = useState('characters');
 const [selectedWeapon, setSelectedWeapon] = useState(null);
 const [showBatchWeaponModal, setShowBatchWeaponModal] = useState(false);
 const syncPayload = useStore((s) => s.syncPayload);
 const isSyncing = useStore((s) => s.isSyncing);
 const globalHandleSyncNotes = useStore((s) => s.handleSyncNotes);
 const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);

 const handleSyncNotes = async (isAuto = false) => {
   const res = await globalHandleSyncNotes(isAuto);
   if (res?.error) {
     if (res.error === 'no_cookie' || res.error === 'auth_failed') {
       if (!isAuto) {
         setIsCookieModalOpen(true);
       }
       if (res.error === 'auth_failed' && !isCookieModalOpen && !isAuto) {
         notify.error(res.message || "Authentication failed. Please check your cookies.");
       }
     } else {
       if (!isCookieModalOpen && !isAuto) {
         notify.error("Failed to sync Real-Time Notes: " + res.error);
       }
     }
   } else {
     setIsCookieModalOpen(false); // Close modal on success
   }
 }

 useEffect(() => {
   handleSyncNotes(true)
 }, [])

 const handleAddAllCharacters = () => {
 const currentRoster = useStore.getState().roster;
 const missing = charactersData.filter((c) => !currentRoster[c.name])
 if (missing.length === 0) {
 notify.info("All available characters are already in your roster!")
 return
 }

 if (!window.confirm(`Are you sure you want to add all ${missing.length} missing characters to your roster?`)) return

 batchAddCharacters(missing.map((c) => c.name))
 notify.success(`Successfully added ${missing.length} missing characters!`)
 }

 const [search, setSearch] = useState('')
 const [elementFilter, setElementFilter] = useState('All')
 const [weaponFilter, setWeaponFilter] = useState('All')
 const [rarityFilter, setRarityFilter] = useState('All')
 const [sortBy, setSortBy] = useState('Release') // 'Release' | 'Name' | 'Rarity' | 'Element'
 const [sortDirection, setSortDirection] = useState('desc')
 const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
 const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

 const activeFilterCount = useMemo(() => {
   let count = 0;
   if (activeTab === 'characters' && elementFilter !== 'All') count++;
   if (weaponFilter !== 'All') count++;
   if (rarityFilter !== 'All') count++;
   return count;
 }, [activeTab, elementFilter, weaponFilter, rarityFilter]);

 const handleClearAllFilters = () => {
   setSearch('');
   setElementFilter('All');
   setWeaponFilter('All');
   setRarityFilter('All');
 };

 // Filtered + sorted characters
 const filtered = useMemo(() => {
 const dirMult = sortDirection === 'asc' ? 1 : -1;
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
 if (weaponFilter !== 'All') list = list.filter((c) => c.weapon_type === weaponFilter)
 list = list.filter((c) => {
 const matchesRarity = rarityFilter === 'All' || Number(c.rarity?.length || c.rarity || 0) === Number(rarityFilter);
 return matchesRarity;
 })

 list.sort((a, b) => {
 if (sortBy === 'Release') {
 return compareNullableNumber(a.release_order, b.release_order, sortDirection);
 } else if (sortBy === 'Rarity') {
 const rarityA = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0);
 const rarityB = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0);
 return (rarityA - rarityB) * dirMult;
 } else if (sortBy === 'Element') {
 return compareNullableString(a.element, b.element, sortDirection);
 } else if (sortBy === 'Weapon') {
 const wA = a.weapon || a.weapon_type || '';
 const wB = b.weapon || b.weapon_type || '';
 return compareNullableString(wA, wB, sortDirection);
 } else if (sortBy === 'Name') {
 return compareNullableString(a.name, b.name, sortDirection);
 }
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
 if (sortBy === 'Release') {
 return compareNullableNumber(a.release_order, b.release_order, sortDirection);
 } else if (sortBy === 'Rarity') {
 return ((a.rarity || 0) - (b.rarity || 0)) * dirMult;
 } else if (sortBy === 'Weapon') {
 return compareNullableString(a.type, b.type, sortDirection);
 } else if (sortBy === 'Name') {
 return compareNullableString(a.name, b.name, sortDirection);
 }
 return 0;
 })
 return list
 }
 }, [activeTab, search, elementFilter, weaponFilter, rarityFilter, sortBy, sortDirection])

 // Stats

 return (
 <div className="animate-fade-in">
 {/* ── Page Header ────────────────────────────── */}
 <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
 <div>
 <div className="flex items-center gap-3 mb-1">
 <img src="/Dashboard.png" alt="Dashboard" className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
 <h1 className=" text-2xl md:text-3xl text-[var(--text)]">
 Dashboard
 </h1>
 </div>
 <p className="text-[var(--muted)] text-xs sm:text-sm sm:ml-11">
 {activeTab === 'characters' ? 'Browse all characters and manage your roster' : 'Browse and track your weapons'}
 </p>
 </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
 <button
 onClick={() => handleSyncNotes(false)}
 disabled={isSyncing}
 className="flex items-center justify-center gap-2 px-4 py-2 border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 min-h-[40px] w-full sm:w-auto text-center"
 >
 <span className="text-lg">🔄</span>
 {isSyncing ? 'Syncing...' : 'Sync Resin & Realm Currency'}
 </button>

 {activeTab === 'characters' ? (
 <button
 onClick={handleAddAllCharacters}
 className="flex items-center justify-center gap-2 px-4 py-2 border border-primary/50 text-primary hover:bg-primary/10 rounded-lg text-sm transition-colors shadow-sm min-h-[40px] w-full sm:w-auto text-center"
 >
 <span className="text-lg">✦</span>
 Add All Available Characters
 </button>
 ) : (
 <button
 onClick={() => setShowBatchWeaponModal(true)}
 className="flex items-center justify-center gap-2 px-4 py-2 border border-primary/50 text-primary hover:bg-primary/10 rounded-lg text-sm transition-colors shadow-sm min-h-[40px] w-full sm:w-auto text-center"
 >
 <span className="text-lg">✦</span>
 Batch Add Weapons
 </button>
 )}
 </div>
 </div>

 {/* ── Trackers ────────────────────────────── */}
  {hasCookie ? (
    !syncPayload ? (
      <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md flex flex-col items-center justify-center text-center min-h-[160px]">
        <div className="text-4xl mb-3 animate-spin w-10 h-10 flex items-center justify-center">🔄</div>
        <p className="text-[var(--text)] text-sm max-w-md">
          Syncing your Resin & Realm Currency...
        </p>
      </div>
    ) : (
      <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ResinTracker syncData={syncPayload.resin} />
        {syncPayload.realm_currency && (
          <RealmCurrencyTracker syncData={syncPayload.realm_currency} />
        )}
      </div>
    )
  ) : (
 <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md flex flex-col items-center justify-center text-center min-h-[160px]">
 <div className="text-4xl mb-3">🌙</div>
 <p className="text-[var(--text)] mb-4 text-sm max-w-md">
 Add your HoYo Cookie ID in Settings to show your live in-game Resin and Realm Currency counters.
 </p>
 <button 
 onClick={() => navigate('/settings')}
 className="px-5 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-bold hover:bg-primary hover:text-gray-900 transition-all duration-300"
 >
 Go to Settings
 </button>
 </div>
 )}

 {/* ── Tab Toggle ──────────────────────────────── */}
 <div className="flex justify-center mb-8">
 <div className="bg-[var(--elevated)] border border-[var(--border)] p-1 rounded-full inline-flex">
 <button
 onClick={() => setActiveTab('characters')}
 className={`px-6 py-2 rounded-full text-sm transition-all ${activeTab === 'characters'
 ? 'bg-primary text-gray-900 shadow-md'
 : 'text-[var(--muted)] hover:text-white'
 }`}
 >
 Characters
 </button>
 <button
 onClick={() => setActiveTab('weapons')}
 className={`px-6 py-2 rounded-full text-sm transition-all ${activeTab === 'weapons'
 ? 'bg-primary text-gray-900 shadow-md'
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
 <StatCard icon={<img src="/Characters.png" alt="Characters" className="w-6 h-6 object-contain" />} label="Total Characters" value={charactersData.length} />
 <StatCard icon="🟡" label="5★ Characters" value={TOTAL_5_STAR_CHARS} accent="#FFD700" />
 <StatCard icon="🟣" label="4★ Characters" value={TOTAL_4_STAR_CHARS} accent="#B07FE8" />
 <StatCard icon="📋" label="In My Roster" value={rosterCount} accent="#4EC9B0" />
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
 <StatCard icon="🗡️" label="Total Weapons" value={weaponsData.length} />
 <StatCard icon="🟡" label="5★ Weapons" value={TOTAL_5_STAR_WEAPONS} accent="#FFD700" />
 <StatCard icon="🟣" label="4★ Weapons" value={TOTAL_4_STAR_WEAPONS} accent="#B07FE8" />
 <StatCard icon="📋" label="Tracked Weapons" value={trackedWeaponsCount} accent="#4EC9B0" />
 </div>
 )}

 {/* ── Mobile Search/Filter Toggle Buttons (< 768px) ── */}
 <div className="flex md:hidden items-center gap-2 mb-3">
 <button
 id="dashboard-mobile-search-toggle"
 onClick={() => setMobileSearchOpen((v) => !v)}
 aria-expanded={mobileSearchOpen}
 aria-controls="dashboard-mobile-search-panel"
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
 onClick={(e) => {
 e.stopPropagation();
 setSearch('');
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.stopPropagation();
 setSearch('');
 }
 }}
 className="ml-1 text-[10px] bg-[var(--gold)]/20 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-[var(--gold)]/40 cursor-pointer"
 aria-label="Clear search"
 >
 ✕
 </span>
 )}
 </button>
 <button
 id="dashboard-mobile-filters-toggle"
 onClick={() => setMobileFiltersOpen((v) => !v)}
 aria-expanded={mobileFiltersOpen}
 aria-controls="dashboard-mobile-filters-panel"
 className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
 activeFilterCount > 0
 ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/10'
 : 'border-[var(--border)] text-[var(--muted)] bg-[var(--surface)]'
 }`}
 >
 ⚙ Filters
 {activeFilterCount > 0 && (
 <span className="ml-1 text-[10px] bg-[var(--gold)] text-[var(--bg)] rounded-full w-4 h-4 flex items-center justify-center font-bold">
 {activeFilterCount}
 </span>
 )}
 </button>
 <span className="text-[var(--muted)] text-[10px] whitespace-nowrap shrink-0">
 {filtered.length}/{activeTab === 'characters' ? charactersData.length : weaponsData.length}
 </span>
 </div>

 {/* ── Mobile Search Panel (< 768px) ── */}
 {mobileSearchOpen && (
 <div id="dashboard-mobile-search-panel" className="md:hidden mb-3 animate-fade-in">
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">
 🔍
 </span>
 <input
 id="dashboard-search-mobile"
 type="search"
 placeholder={activeTab === 'characters' ? "Search characters or elements…" : "Search weapons…"}
 className="search-input w-full h-10 pl-9 pr-3 text-xs"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 aria-label={activeTab === 'characters' ? "Search characters" : "Search weapons"}
 autoFocus
 />
 </div>
 </div>
 )}

 {/* ── Mobile Filters Panel (< 768px) ── */}
 {mobileFiltersOpen && (
 <div id="dashboard-mobile-filters-panel" className="md:hidden bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-4 animate-fade-in">
 {/* Sort row */}
 <div className="flex items-center gap-2 mb-3">
 <div className="relative flex-1">
 <select
 id="dashboard-sort-select-mobile"
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value)}
 className="w-full appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors min-h-[36px]"
 aria-label="Sort options"
 >
 <option value="Release">by Release</option>
 <option value="Name">by Name</option>
 <option value="Rarity">by Rarity</option>
 <option value="Element">by Element</option>
 <option value="Weapon">by Weapon</option>
 </select>
 <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
 </div>
 <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
 {activeFilterCount > 0 && (
 <button
 onClick={handleClearAllFilters}
 className="text-xs text-[var(--gold)] hover:underline whitespace-nowrap px-2 py-1 min-h-[36px] flex items-center"
 >
 Clear
 </button>
 )}
 </div>

 {/* Element filters */}
 {activeTab === 'characters' && (
 <div className="mb-3">
 <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">
 Element
 </p>
 <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by element">
 {ALL_ELEMENTS.map((el) => {
 const config = ELEMENTS[el];
 return (
 <button
 key={el}
 id={`filter-element-mobile-${el.toLowerCase()}`}
 onClick={() => setElementFilter(el)}
 data-element={el}
 className={`filter-pill shrink-0 ${elementFilter === el ? 'active' : ''}`}
 aria-pressed={elementFilter === el}
 >
 {el !== 'All' ? (
 <GenshinImage src={getElementIcon(el)} alt={el} className="w-4 h-4 object-contain inline-block mr-1.5 shrink-0" fallback={<span>{config?.emoji}</span>} />
 ) : <span className="mr-1.5">🌐</span>}
 <span>{el}</span>
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Weapon filters */}
 <div className="mb-3">
 <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">
 Weapon
 </p>
 <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by weapon type">
 {ALL_WEAPONS.map((w) => (
 <button
 key={w}
 id={`filter-weapon-mobile-${w.toLowerCase()}`}
 onClick={() => setWeaponFilter(w)}
 className={`filter-pill shrink-0 ${weaponFilter === w ? 'active' : ''}`}
 aria-pressed={weaponFilter === w}
 >
 {w !== 'All' ? (
 <GenshinImage src={getWeaponTypeIcon(w)} alt={w} className="w-4 h-4 object-contain inline-block mr-1.5 shrink-0" fallback={<span>{WEAPON_TYPES[w]?.emoji}</span>} />
 ) : <span className="mr-1.5">🌐</span>}
 <span>{w}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Rarity filters */}
 <div>
 <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">
 Rarity
 </p>
 <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by rarity">
 {[...RARITY_FILTERS, ...(activeTab === 'weapons' ? [
 { label: '🔵 3★', value: 3 },
 { label: '🟢 2★', value: 2 },
 { label: '⚪ 1★', value: 1 }
 ] : [])].map((r) => (
 <button
 key={r.value}
 id={`filter-rarity-mobile-${String(r.value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`}
 onClick={() => setRarityFilter(r.value)}
 className={`filter-pill shrink-0 ${rarityFilter === r.value ? 'active' : ''}`}
 aria-pressed={rarityFilter === r.value}
 >
 {r.label}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* ── Desktop Filter & Search Bar (≥ 768px) ─────────────────────── */}
 <div className="hidden md:block bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-6">
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
 <div className="flex items-center gap-2">
 <div className="relative">
 <select
 id="sort-select"
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value)}
 className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors"
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

 {/* Result count */}
 <span className="text-[var(--muted)] text-xs whitespace-nowrap">
 {filtered.length} / {activeTab === 'characters' ? charactersData.length : weaponsData.length} shown
 </span>
 </div>

 <div className="genshin-divider mb-4" />

 {/* Element filters */}
 {activeTab === 'characters' && (
 <div className="mb-3">
 <p className="text-xs text-[var(--muted)] tracking-widest uppercase mb-2">
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
 <p className="text-xs text-[var(--muted)] tracking-widest uppercase mb-2">
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
 <p className="text-xs text-[var(--muted)] tracking-widest uppercase mb-2">
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
 className="grid gap-3 sm:gap-4"
 style={{
 gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
 }}
 >
 {filtered.map((item) => (
 activeTab === 'characters'
 ? <CharacterCard key={item.name} character={item} variant="compact" />
 : <WeaponCard key={item.id} weapon={item} onClick={() => setSelectedWeapon(item)} variant="compact" />
 ))}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center py-24 text-center">
 <span className="text-5xl mb-4">🔍</span>
 <h3 className=" text-[var(--text)] text-lg mb-2">
 No {activeTab} found
 </h3>
 <p className="text-[var(--muted)] text-sm max-w-xs">
 Try adjusting the filters or search query to see more {activeTab}.
 </p>
 <button
 id="clear-filters-btn"
 onClick={handleClearAllFilters}
 className="mt-5 genshin-btn-ghost min-h-[40px]"
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

 {showBatchWeaponModal && (
 <BatchAddWeaponModal onClose={() => setShowBatchWeaponModal(false)} />
 )}

 {isCookieModalOpen && (
 <CookiePromptModal
 onClose={() => setIsCookieModalOpen(false)}
 onSaveAndSync={() => handleSyncNotes(false)}
 />
 )}
 </div>
 )
}
