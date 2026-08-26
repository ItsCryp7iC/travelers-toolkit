import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import CharactersTable from '../components/CharactersTable'
import CharacterModal from '../components/CharacterModal'
import AddCharacterModal from '../components/AddCharacterModal'
import BulkEditCharacterModal from '../components/BulkEditCharacterModal'
import charactersData from '../utils/characters'
import weaponsData from '../data/weapons.json'
import costsData from '../data/costs.json'
import useStore from '../store/useStore'
import { resolveCharacterMaterials } from '../utils/dataManager'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import { calculateProgressionCost, calculateTalentCost, calculateAllTalentsCost, formatNumber, buildMobNames, buildBookKey, toggleMilestoneAscension, isMilestone } from '../utils/calculator'
import GenshinImage from '../components/GenshinImage'
import MatQuantity from '../components/MatQuantity'
import InlineNumberInput from '../components/InlineNumberInput'

const ALL_ELEMENTS = ['All', 'Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']
const ALL_WEAPONS  = ['All', 'Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst']
const ALL_RARITIES = ['All', '🟡 5★', '🟣 4★']

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
  const [viewMode,      setViewMode]      = useState('table') // 'table' | 'card'

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingChar, setEditingChar] = useState(null)
  const [selectedNames, setSelectedNames] = useState([])
  const [slideDirection, setSlideDirection] = useState('next')

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
    if (rarityFilter !== 'All') {
      const rFilterNum = parseInt(rarityFilter.match(/\d+/)?.[0] || '0', 10)
      list = list.filter((c) => {
        const cRarity = typeof c.rarity === 'string' ? (c.rarity.match(/★/g)?.length || parseInt(c.rarity) || 0) : (c.rarity || 0)
        return cRarity === rFilterNum
      })
    }
    
    return [...list].sort((a, b) => {
      if (sortOrder === 'Release') {
        const orderA = a.release_order ?? 999;
        const orderB = b.release_order ?? 999;
        return orderA - orderB;
      }
      if (sortOrder === 'Name') return a.name.localeCompare(b.name);
      if (sortOrder === 'Rarity') {
        const rarityA = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0);
        const rarityB = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0);
        return rarityB - rarityA; // Descending: 5-star to 4-star
      }
      if (sortOrder === 'Element') return (a.element || '').localeCompare(b.element || '');
      if (sortOrder === 'Weapon') {
        const wA = a.weapon || a.weapon_type || '';
        const wB = b.weapon || b.weapon_type || '';
        return wA.localeCompare(wB);
      }
      return 0;
    });
  }, [rostered, search, elementFilter, weaponFilter, rarityFilter, sortOrder])

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
      <div className="sticky top-16 z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-4 pt-2 mb-6 border-b border-[var(--border)] shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚔️</span>
            <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)]">My Roster</h1>
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
          {selectedNames.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete these ${selectedNames.length} characters?`)) {
                    batchRemoveCharacters(selectedNames);
                    setSelectedNames([]);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors shadow-md animate-fade-in"
              >
                Delete Selected ({selectedNames.length})
              </button>
              <button
                onClick={() => setBulkModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--bg)] transition-colors shadow-md animate-fade-in"
              >
                Bulk Edit ({selectedNames.length})
              </button>
            </>
          )}
          <button
            id="add-character-btn"
            onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 transition-opacity shadow-md"
          >
            + Batch Add Characters
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {rostered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <span className="text-6xl mb-5">⚔️</span>
          <h3 className="font-semibold text-[var(--text)] text-xl mb-2">Your roster is empty</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs mb-6">Add characters to start tracking their progression goals and material costs.</p>
          <button onClick={() => setAddModalOpen(true)} className="genshin-btn-ghost">+ Add Character</button>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-6">
            {/* Search row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input type="search" placeholder="Search roster…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search roster" />
              </div>
              
              {/* Sort dropdown */}
              <div className="relative">
                <select
                  id="sort-select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
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
              
              <span className="text-[var(--muted)] text-xs whitespace-nowrap">{filtered.length} / {rostered.length} shown</span>
            </div>

            <div className="genshin-divider mb-4" />

            {/* Element filters */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
                Element
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by element">
                {ALL_ELEMENTS.map((el) => {
                  const cfg = ELEMENTS[el]
                  return (
                    <button key={el} onClick={() => setElementFilter(el)} className={`filter-pill ${elementFilter === el ? 'active' : ''}`}>
                      {el !== 'All' ? (
                        <GenshinImage src={getElementIcon(el)} alt={el} className="w-5 h-5 object-contain inline-block mr-2" fallback={<span>{cfg?.emoji}</span>} />
                      ) : <span className="mr-2">⚪</span>}
                      {el}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Weapon + Rarity filters */}
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
                  Weapon
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by weapon type">
                  {ALL_WEAPONS.map((wp) => {
                    const cfg = WEAPON_TYPES[wp]
                    return (
                      <button key={wp} onClick={() => setWeaponFilter(wp)} className={`filter-pill ${weaponFilter === wp ? 'active' : ''}`}>
                        {wp !== 'All' ? (
                          <GenshinImage src={getWeaponTypeIcon(wp)} alt={wp} className="w-5 h-5 object-contain inline-block mr-2" fallback={<span>{cfg?.emoji}</span>} />
                        ) : <span className="mr-2">⚔️</span>}
                        {wp}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
                  Rarity
                </p>
                <div className="flex gap-2" role="group" aria-label="Filter by rarity">
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
            <CharactersTable 
              data={filtered} 
              selectedNames={selectedNames} 
              setSelectedNames={setSelectedNames} 
              setEditingChar={setEditingChar} 
              updateCharacter={updateCharacter} 
              removeCharacter={removeCharacter} 
            />
          )}

          {/* ── Card View ── */}
          {viewMode === 'card' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
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
