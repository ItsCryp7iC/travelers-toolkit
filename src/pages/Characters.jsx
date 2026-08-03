import React, { useState, useMemo } from 'react'
import CharacterCard from '../components/CharacterCard'
import CharacterModal from '../components/CharacterModal'
import AddCharacterModal from '../components/AddCharacterModal'
import BulkEditCharacterModal from '../components/BulkEditCharacterModal'
import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import costsData from '../data/costs.json'
import useStore from '../store/useStore'
import { resolveCharacterMaterials } from '../utils/dataManager'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import { calculateProgressionCost, calculateTalentCost, calculateAllTalentsCost, formatNumber, buildMobNames, buildBookKey } from '../utils/calculator'
import GenshinImage from '../components/GenshinImage'
import MatQuantity from '../components/MatQuantity'

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
  const removeCharacter = useStore((s) => s.removeCharacter)
  const bulkUpdateCharacters = useStore((s) => s.bulkUpdateCharacters)

  const [search,        setSearch]        = useState('')
  const [elementFilter, setElementFilter] = useState('All')
  const [weaponFilter,  setWeaponFilter]  = useState('All')
  const [rarityFilter,  setRarityFilter]  = useState('All')
  const [sortOrder,     setSortOrder]     = useState('Release')
  const [viewMode,      setViewMode]      = useState('table') // 'table' | 'card'

  const [addModalOpen,  setAddModalOpen]  = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingChar,   setEditingChar]   = useState(null)
  const [selectedNames, setSelectedNames] = useState([])

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
        
        const ascCosts = calculateProgressionCost(data, fromLevel, toLevel)
        
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
          {selectedNames.length > 0 && (
            <button
              onClick={() => setBulkModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--bg)] transition-colors shadow-md"
            >
              Bulk Edit ({selectedNames.length})
            </button>
          )}
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
          <span className="text-6xl mb-5">⚔️</span>
          <h3 className="font-cinzel font-semibold text-[var(--text)] text-xl mb-2">Your roster is empty</h3>
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
              <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
                <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
                <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm border-collapse whitespace-nowrap min-w-max">
                  <thead>
                    {/* Top Header Grouping */}
                    <tr className="bg-[var(--elevated)] border-b border-[var(--border)]">
                      <th colSpan="6" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)] sticky left-0 z-30 bg-[var(--elevated)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Identity</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)]">Current State</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--gold)] border-r border-[var(--border)]">Target State</th>
                      <th colSpan="9" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Ascension Requirements</th>
                      <th colSpan="12" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Talent Requirements</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-green-400 border-r border-[var(--border)]">Grand Totals</th>
                      <th className="px-4 py-2 border-b border-[var(--border)]"></th>
                    </tr>
                    {/* Sub Headers */}
                    <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">
                      {/* Identity (Sticky) */}
                      <th className="text-center px-4 py-2 font-semibold sticky left-0 z-20 bg-[var(--surface)] w-[40px] min-w-[40px] max-w-[40px]">
                        <input 
                          type="checkbox" 
                          className="accent-[var(--gold)] cursor-pointer w-4 h-4"
                          checked={filtered.length > 0 && selectedNames.length === filtered.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNames(filtered.map(c => c.name))
                            } else {
                              setSelectedNames([])
                            }
                          }}
                        />
                      </th>
                      <th className="text-center px-4 py-2 font-semibold sticky left-[40px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]">Sl</th>
                      <th className="text-left px-4 py-2 font-semibold sticky left-[88px] z-20 bg-[var(--surface)] w-[200px] min-w-[200px] max-w-[200px]">Character</th>
                      <th className="text-center px-4 py-2 font-semibold sticky left-[288px] z-20 bg-[var(--surface)] w-[82px] min-w-[82px] max-w-[82px]">Element</th>
                      <th className="text-center px-4 py-2 font-semibold sticky left-[370px] z-20 bg-[var(--surface)] w-[80px] min-w-[80px] max-w-[80px]">Weapon</th>
                      <th className="text-left px-4 py-2 font-semibold sticky left-[450px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Equipped</th>
                      
                      {/* Current State */}
                      <th className="text-center px-3 py-2 font-semibold">Lv</th>
                      <th className="text-center px-3 py-2 font-semibold">NA</th>
                      <th className="text-center px-3 py-2 font-semibold">Skill</th>
                      <th className="text-center px-3 py-2 font-semibold border-r border-[var(--border)]">Burst</th>
                      
                      {/* Target State */}
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)]">Lv</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)]">NA</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)]">Skill</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)] border-r border-[var(--border)]">Burst</th>

                      {/* Ascension Math */}
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="Hero's Wit">Wit</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Normal Boss Material">N.Boss</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Local Specialty">Local</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Character Ascension Gem (All Tiers)">Stones</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="3★ Common Enhancement Material">Enh 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="2★ Common Enhancement Material">Enh 2★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="1★ Common Enhancement Material">Enh 1★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#FBBF24]" title="Masterless Stella Fortuna">Stella</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E] border-r border-[var(--border)]">Asc. Mora</th>

                      {/* Talent Math */}
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="4★ Talent Material">Tal 4★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="3★ Talent Material">Tal 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="2★ Talent Material">Tal 2★</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Weekly Boss Material">Wk.Boss</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#FBBF24]" title="Crown of Insight">Crown</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="3★ Common Enhancement Material">Enh 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="2★ Common Enhancement Material">Enh 2★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="1★ Common Enhancement Material">Enh 1★</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E]" title="Normal Attack Mora">NA Mora</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E]" title="Elemental Skill Mora">Skill Mora</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E]" title="Elemental Burst Mora">Burst Mora</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E] border-r border-[var(--border)]">Talent Mora</th>
                      
                      {/* Grand Totals */}
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="Total 3★ Common Enhancement Material">Enh 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="Total 2★ Common Enhancement Material">Enh 2★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="Total 1★ Common Enhancement Material">Enh 1★</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E] border-r border-[var(--border)]">Total Mora</th>
                      
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((char, idx) => {
                      try {
                        const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown
                      const wpCfg = WEAPON_TYPES[char.weapon_type]
                      const entry = char.entry
                      const asc = char.ascCosts
                      const tal = char.talentCosts
                      const eqWeapon = char.eqWeapon

                      // Resolve full material objects
                      const resolvedMats = resolveCharacterMaterials(char)

                      // Aggregate Stones
                      const totalStones = (asc.gem_silver || 0) + (asc.gem_fragment || 0) + (asc.gem_chunk || 0) + (asc.gem_gemstone || 0)

                      // Grand Totals Calculations
                      const grandEnh3 = (asc['3_star_enemy_material'] || 0) + (tal['3_star_enemy_material'] || 0)
                      const grandEnh2 = (asc['2_star_enemy_material'] || 0) + (tal['2_star_enemy_material'] || 0)
                      const grandEnh1 = (asc['1_star_enemy_material'] || 0) + (tal['1_star_enemy_material'] || 0)
                      const grandMora = (asc.mora || 0) + (tal.mora || 0)

                      return (
                        <tr
                          key={char.name}
                          className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors ${idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'}`}
                        >
                          {/* Identity Group (Sticky) */}
                          <td className="px-4 py-2 text-center sticky left-0 z-10 bg-inherit w-[40px] min-w-[40px] max-w-[40px]">
                            <input 
                              type="checkbox"
                              className="accent-[var(--gold)] cursor-pointer w-4 h-4"
                              checked={selectedNames.includes(char.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedNames(prev => [...prev, char.name])
                                } else {
                                  setSelectedNames(prev => prev.filter(n => n !== char.name))
                                }
                              }}
                            />
                          </td>
                          <td 
                            className="px-4 py-2 text-center text-xs text-[var(--muted)] sticky left-[40px] z-10 bg-inherit border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px] cursor-pointer"
                            onClick={() => setEditingChar(char)}
                          >
                            {char.sl_no}
                          </td>
                          <td 
                            className="px-4 py-2 sticky left-[88px] z-10 bg-inherit border-r border-transparent w-[200px] min-w-[200px] max-w-[200px] cursor-pointer"
                            onClick={() => setEditingChar(char)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow relative overflow-hidden" style={{ background: elCfg.avatarGradient }}>
                                <GenshinImage 
                                  src={getCharacterAvatar(char.name)} 
                                  alt={char.name} 
                                  className="w-full h-full object-cover absolute inset-0 z-10" 
                                  fallback={<span className="font-cinzel text-xs relative z-10" style={{ color: elCfg.color }}>{getInitials(char.name)}</span>} 
                                />
                              </div>
                              <div className="truncate">
                                <p className="font-cinzel text-xs font-semibold text-[var(--text)] truncate">{formatName(char.name)}</p>
                                <p className={`text-[10px] ${getRarityClass(char.rarity)}`}>{getStars(char.rarity)}</p>
                              </div>
                            </div>
                          </td>
                          <td 
                            className="px-4 py-2 text-center sticky left-[288px] z-10 bg-inherit w-[82px] min-w-[82px] max-w-[82px] cursor-pointer"
                            onClick={() => setEditingChar(char)}
                          >
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border overflow-hidden" style={{ background: elCfg.colorDim, borderColor: elCfg.color + '50', color: elCfg.color }} title={char.element}>
                              <GenshinImage src={getElementIcon(char.element)} alt={char.element} className="w-8 h-8 object-contain shrink-0" fallback={elCfg.emoji} />
                            </span>
                          </td>
                          <td 
                            className="px-4 py-2 text-center sticky left-[370px] z-10 bg-inherit w-[80px] min-w-[80px] max-w-[80px] cursor-pointer"
                            onClick={() => setEditingChar(char)}
                          >
                            <GenshinImage src={getWeaponTypeIcon(char.weapon_type || char.weapon)} alt={char.weapon_type || char.weapon} className="w-8 h-8 object-contain inline-block shrink-0" fallback={<span>{wpCfg?.emoji}</span>} />
                          </td>
                          <td 
                            className="px-4 py-2 sticky left-[450px] z-10 bg-inherit border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)] cursor-pointer"
                            onClick={() => setEditingChar(char)}
                          >
                            {eqWeapon ? (
                              <div className="flex items-center gap-3">
                                <GenshinImage 
                                  src={getWeaponIcon(eqWeapon.tracked.weaponName)} 
                                  alt={eqWeapon.tracked.weaponName} 
                                  className="w-8 h-8 object-contain shrink-0" 
                                  fallback={<span className="text-xl shrink-0">{WEAPON_TYPES[eqWeapon.data?.type]?.emoji || '⚔️'}</span>} 
                                />
                                <div className="truncate min-w-0">
                                  <p className="text-[11px] font-semibold text-[var(--text)] truncate">{formatName(eqWeapon.tracked.weaponName)}</p>
                                  <p className="text-[9px] text-[var(--muted)]">Lv{eqWeapon.tracked.level}→{eqWeapon.tracked.targetLevel}</p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] italic">None</span>
                            )}
                          </td>
                          
                          {/* Current State */}
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono text-[11px] text-[var(--text)]">{entry?.level ?? 1}</span>
                              {isAscended(entry?.level ?? 1, entry?.ascension ?? 0) && (entry?.level ?? 1) < 90 && (
                                <img 
                                  src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" 
                                  alt="Ascended" 
                                  className="w-3 h-3 opacity-80 object-contain"
                                  title="Ascended"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)]">{entry?.talents?.normal ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)]">{entry?.talents?.skill ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)] border-r border-[var(--border)]">{entry?.talents?.burst ?? 1}</td>
                          
                          {/* Target State */}
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono text-[11px] text-[var(--gold)]">{entry?.targetLevel ?? 90}</span>
                              {isAscended(entry?.targetLevel ?? 90, entry?.targetAscension ?? 6) && (entry?.targetLevel ?? 90) < 90 && (
                                <img 
                                  src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" 
                                  alt="Ascended" 
                                  className="w-3 h-3 opacity-80 object-contain"
                                  title="Ascended"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)]">{entry?.targetTalents?.normal ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)]">{entry?.targetTalents?.skill ?? 1}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)] border-r border-[var(--border)]">{entry?.targetTalents?.burst ?? 1}</td>

                          {/* Ascension Math */}
                          <td className="px-3 py-2"><MatQuantity val={asc?.heros_wit} icon="📘" color="text-[#60A5FA]" nameKey="Hero's Wit" category="Experience" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc?.boss_material} icon="👹" nameKey={resolvedMats?.worldBoss?.name || ''} category="Normal Boss Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc?.local_specialty} icon="🌸" nameKey={resolvedMats?.localSpecialty?.name || ''} category="Local Specialty" /></td>
                          <td className="px-3 py-2"><MatQuantity val={totalStones} icon="💎" nameKey={resolvedMats?.gem?.tiers?.['4_star']?.name || ''} category="Character Ascension Gem" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc?.['3_star_enemy_material']} icon="💧" color="text-[#A78BFA]" nameKey={resolvedMats?.enemy?.tiers?.['3_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc?.['2_star_enemy_material']} icon="💧" color="text-[#60A5FA]" nameKey={resolvedMats?.enemy?.tiers?.['2_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc?.['1_star_enemy_material']} icon="💧" color="text-[#9CA3AF]" nameKey={resolvedMats?.enemy?.tiers?.['1_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={asc?.masterless_stella_fortuna} icon="⭐" color="text-[#FBBF24]" nameKey="Masterless Stella Fortuna" category="others" /></td>
                          <td className="px-3 py-2 border-r border-[var(--border)]"><MatQuantity val={asc?.mora} icon="🪙" color="text-[#C8A96E]" align="right" nameKey="Mora" category="Currency" /></td>

                          {/* Talent Math */}
                          <td className="px-3 py-2"><MatQuantity val={tal?.['4_star_talent_material']} icon="📜" color="text-[#A78BFA]" nameKey={resolvedMats?.talent?.tiers?.['4_star']?.name} category="Talent Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.['3_star_talent_material']} icon="📜" color="text-[#60A5FA]" nameKey={resolvedMats?.talent?.tiers?.['3_star']?.name} category="Talent Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.['2_star_talent_material']} icon="📜" color="text-[#9CA3AF]" nameKey={resolvedMats?.talent?.tiers?.['2_star']?.name} category="Talent Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.weekly_boss_material} icon="🐉" nameKey={resolvedMats?.weeklyBoss?.name || ''} category="Weekly Boss Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.crown} icon="👑" color="text-[#FBBF24]" nameKey="Crown of Insight" category="Experience" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.['3_star_enemy_material']} icon="⚔️" color="text-[#A78BFA]" nameKey={resolvedMats?.enemy?.tiers?.['3_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.['2_star_enemy_material']} icon="⚔️" color="text-[#60A5FA]" nameKey={resolvedMats?.enemy?.tiers?.['2_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={tal?.['1_star_enemy_material']} icon="⚔️" color="text-[#9CA3AF]" nameKey={resolvedMats?.enemy?.tiers?.['1_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2 text-[#C8A96E]">
                              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-8 h-8 object-contain shrink-0" />
                              <span className="text-[11px] font-mono font-bold">{formatNumber(tal?.mora_na)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2 text-[#C8A96E]">
                              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-8 h-8 object-contain shrink-0" />
                              <span className="text-[11px] font-mono font-bold">{formatNumber(tal?.mora_skill)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2 text-[#C8A96E]">
                              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-8 h-8 object-contain shrink-0" />
                              <span className="text-[11px] font-mono font-bold">{formatNumber(tal?.mora_burst)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-[var(--border)]">
                            <div className="flex items-center justify-center gap-2 text-[#C8A96E]">
                              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-8 h-8 object-contain shrink-0" />
                              <span className="text-[11px] font-mono font-bold">{formatNumber(tal?.mora)}</span>
                            </div>
                          </td>
                          
                          {/* Grand Totals */}
                          <td className="px-3 py-2"><MatQuantity val={grandEnh3} icon="⚔️" color="text-[#A78BFA]" nameKey={resolvedMats?.enemy?.tiers?.['3_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={grandEnh2} icon="⚔️" color="text-[#60A5FA]" nameKey={resolvedMats?.enemy?.tiers?.['2_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2"><MatQuantity val={grandEnh1} icon="⚔️" color="text-[#9CA3AF]" nameKey={resolvedMats?.enemy?.tiers?.['1_star']?.name} category="Common Enhancement Material" /></td>
                          <td className="px-3 py-2 border-r border-[var(--border)]">
                            <div className="flex items-center justify-center gap-2 text-[#C8A96E]">
                              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-8 h-8 object-contain shrink-0" />
                              <span className="text-[11px] font-mono font-bold">{formatNumber(grandMora)}</span>
                            </div>
                          </td>
                          
                          {/* Actions */}
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => removeCharacter(char.name)}
                              className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    } catch (e) {
                      console.error('Failed to render character row:', char.id, e)
                      return null
                    }
                  })}
                  </tbody>
                </table>
              </div>
            </div>
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
      {addModalOpen && <AddCharacterModal onClose={() => setAddModalOpen(false)} onSelect={(char) => { setAddModalOpen(false); setEditingChar(char); }} />}
      {editingChar && <CharacterModal character={editingChar} onClose={() => setEditingChar(null)} />}
    </div>
  )
}
