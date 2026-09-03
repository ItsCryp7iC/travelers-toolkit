import React, { useState, useMemo } from 'react'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import BatchAddWeaponModal from '../components/BatchAddWeaponModal'
import BulkEditWeaponModal from '../components/BulkEditWeaponModal'
import ForgingQueuePanel from '../components/ForgingQueuePanel'
import weaponsData from '../data/weapons.json'
import charactersData from '../utils/characters'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getInitials, getStars, getRarityClass, getRarityBg } from '../utils/gameData'
import { ELEMENTS } from '../utils/gameData'
import { calculateWeaponCost, formatNumber, buildWeaponAscMatKey, buildWeaponEliteKey, buildMobNames, formatMaterialName, toggleMilestoneAscension, isMilestone } from '../utils/calculator'
import { resolveWeaponMaterials } from '../utils/dataManager'
import GenshinImage from '../components/GenshinImage'
import { getWeaponIcon, getCharacterAvatar, getMaterialIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import MatQuantity from '../components/MatQuantity'
import InlineNumberInput from '../components/InlineNumberInput'
import WeaponsTable from '../components/WeaponsTable'

const ALL_TYPES    = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '🟡 5★', '🟣 4★', '🔵 3★', '🟢 2★', '⚪ 1★']

const isAscended = (level, ascension) => {
  if (level === 20 && ascension >= 1) return true;
  if (level === 40 && ascension >= 2) return true;
  if (level === 50 && ascension >= 3) return true;
  if (level === 60 && ascension >= 4) return true;
  if (level === 70 && ascension >= 5) return true;
  if (level === 80 && ascension >= 6) return true;
  if (level === 90 && ascension >= 6) return true;
  return false;
}

const MatCell = ({ qty, color = 'text-[var(--text)]', nameKey, category, className = '' }) => {
  if (!qty) return <td className={`px-3 py-2 text-center ${className}`}><span className="text-[var(--muted)] opacity-50">-</span></td>
  const fallbackStr = nameKey ? nameKey.substring(0, 2).toUpperCase() : '??'
  const iconFallback = <span className="text-xs font-bold text-[var(--muted)] border border-[var(--border)] rounded px-0.5 bg-[var(--elevated)] opacity-70" title={nameKey}>{fallbackStr}</span>
  return (
    <td className={`px-3 py-1 text-center ${className}`}>
      <div className="flex items-center justify-center gap-2">
        <GenshinImage src={getMaterialIcon(nameKey, category)} alt={nameKey} className="w-8 h-8 object-contain shrink-0" fallback={iconFallback} />
        <span className={`text-xs font-bold ${color}`}>{qty}</span>
      </div>
    </td>
  )
}

export default function Weapons() {
  const trackedWeapons      = useStore((s) => s.trackedWeapons)
  const roster              = useStore((s) => s.roster)
  const removeTrackedWeapon = useStore((s) => s.removeTrackedWeapon)
  const batchRemoveWeapons  = useStore((s) => s.batchRemoveWeapons)
  const updateTrackedWeapon = useStore((s) => s.updateTrackedWeapon)
  const bulkUpdateWeapons   = useStore((s) => s.bulkUpdateWeapons)

  const [pageTab,      setPageTab]      = useState('armory') // 'armory' | 'forge'
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [sortOrder,    setSortOrder]    = useState('Release')
  const [viewMode,     setViewMode]     = useState('table') // 'table' | 'card'
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingWeapon, setEditingWeapon] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [slideDirection, setSlideDirection] = useState('next')

  // Enrich tracked weapons with their static metadata and costs
  const enriched = useMemo(() => {
    // First, map over tracked weapons and calculate costs
    const mapped = trackedWeapons.map((tw) => {
      const data = weaponsData.find((w) => w.id === tw.weapon_id) || weaponsData.find((w) => w.name === tw.weaponName) || { name: tw.weaponName, rarity: 3, type: 'Unknown', materials: {} }
      const assignedChar = tw.assignedTo ? charactersData.find((c) => c.name === tw.assignedTo) : null
      
      const costs = calculateWeaponCost(data, tw.level, tw.targetLevel, tw.ascension, tw.targetAscension, tw.hasEventBonus, roster)

      return { ...tw, data, assignedChar, costs }
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
        const wRarity = typeof w.data?.rarity === 'string' ? (w.data.rarity.match(/★/g)?.length || parseInt(w.data.rarity) || 0) : (w.data?.rarity || 0)
        return wRarity === rFilterNum
      })
    }
    
    return [...list].sort((a, b) => {
      if (sortOrder === 'Release') {
        const orderA = a.data?.release_order ?? 999;
        const orderB = b.data?.release_order ?? 999;
        return orderA - orderB;
      }
      if (sortOrder === 'Name') return a.weaponName.localeCompare(b.weaponName);
      if (sortOrder === 'Rarity') {
        const rarityA = typeof a.data?.rarity === 'string' ? (a.data.rarity.match(/★/g)?.length || parseInt(a.data.rarity) || 0) : (a.data?.rarity || 0);
        const rarityB = typeof b.data?.rarity === 'string' ? (b.data.rarity.match(/★/g)?.length || parseInt(b.data.rarity) || 0) : (b.data?.rarity || 0);
        return rarityB - rarityA;
      }
      if (sortOrder === 'Type') return (a.data?.type || '').localeCompare(b.data?.type || '');
      if (sortOrder === 'Character') {
        const charA_Name = a.assignedTo;
        const charB_Name = b.assignedTo;

        if (!charA_Name && !charB_Name) return (a.data?.release_order ?? 999) - (b.data?.release_order ?? 999);
        if (!charA_Name) return 1;
        if (!charB_Name) return -1;

        const charA = charactersData.find(c => c.name === charA_Name) || {};
        const charB = charactersData.find(c => c.name === charB_Name) || {};
        
        const orderA = charA.release_order ?? 999;
        const orderB = charB.release_order ?? 999;
        
        if (orderA !== orderB) return orderA - orderB;
        
        return (a.data?.release_order ?? 999) - (b.data?.release_order ?? 999);
      }
      return 0;
    })
  }, [enriched, search, typeFilter, rarityFilter, sortOrder])

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
      <div className="sticky top-16 z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-4 pt-2 mb-6 border-b border-[var(--border)] shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img src={pageTab === 'armory' ? '/Weapons.png' : '/Forging.png'} alt={pageTab === 'armory' ? 'My Armory' : 'To Forge'} className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
            <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)]">
              {pageTab === 'armory' ? 'My Armory' : 'To Forge'}
            </h1>
          </div>
          <p className="text-[var(--muted)] text-sm ml-11">
            {pageTab === 'armory'
              ? `${trackedWeapons.length} weapon${trackedWeapons.length !== 1 ? 's' : ''} tracked`
              : 'Track weapons you want to forge'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Page tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
            <button
              id="weapons-tab-armory"
              onClick={() => setPageTab('armory')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${pageTab === 'armory' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
            >
              🗡️ My Armory
            </button>
            <button
              id="weapons-tab-forge"
              onClick={() => setPageTab('forge')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${pageTab === 'forge' ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
            >
              ⚒️ To Forge
            </button>
          </div>
          {/* Armory-only controls */}
          {pageTab === 'armory' && (
            <>
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
                  📋 Cards
                </button>
              </div>
              {selectedIds.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete these ${selectedIds.length} weapons?`)) {
                        batchRemoveWeapons(selectedIds);
                        setSelectedIds([]);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors shadow-md animate-fade-in"
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                  <button
                    onClick={() => setBulkModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--bg)] transition-colors shadow-md animate-fade-in"
                  >
                    Bulk Edit ({selectedIds.length})
                  </button>
                </>
              )}
              <button
                id="add-weapon-btn"
                onClick={() => setIsBatchModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md"
              >
                + Batch Add Weapons
              </button>
            </>
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
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <span className="text-6xl mb-5">🗡️</span>
          <h3 className="font-semibold text-[var(--text)] text-xl mb-2">Your armory is empty</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Add weapons to track their progression and assign them to your roster characters.</p>
          <button onClick={() => setIsBatchModalOpen(true)} className="genshin-btn-ghost">+ Batch Add Weapons</button>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-6">
            {/* Search row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input type="search" placeholder="Search armory…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search armory" />
              </div>
              
              {/* Sort dropdown */}
              <div className="relative">
                <select
                  id="sort-select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors"
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
              
              <span className="text-[var(--muted)] text-xs whitespace-nowrap">{filtered.length} / {trackedWeapons.length} shown</span>
            </div>
            
            <div className="genshin-divider mb-4" />
            
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
                  Weapon
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_TYPES.map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill ${typeFilter === t ? 'active' : ''}`}>
                      {t !== 'All' ? (
                        <GenshinImage src={getWeaponTypeIcon(t)} alt={t} className="w-5 h-5 object-contain inline-block mr-2" fallback={<span>{WEAPON_TYPES[t]?.emoji}</span>} />
                      ) : <span className="mr-2">⚔️</span>}
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
                  Rarity
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_RARITIES.map((r) => (
                    <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill ${rarityFilter === r ? 'active' : ''}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Table View ── */}
          {viewMode === 'table' && (
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
          )}

          {/* ── Card View ── */}
          {viewMode === 'card' && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((wp) => (
                <WeaponCard key={wp.id} weapon={wp.data} onClick={() => setEditingWeapon(wp)} />
              ))}
            </div>
          )}
        </>
      )}
      </>
    )}
    {/* end armory tab */}

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
