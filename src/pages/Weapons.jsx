import React, { useState, useMemo } from 'react'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import weaponsData from '../data/weapons.json'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import { ELEMENTS } from '../utils/gameData'
import { calculateWeaponCost, formatNumber, buildWeaponAscMatKey, buildWeaponEliteKey, buildMobNames, formatMaterialName } from '../utils/calculator'
import { resolveWeaponMaterials } from '../utils/dataManager'
import GenshinImage from '../components/GenshinImage'
import { getWeaponIcon, getCharacterAvatar, getMaterialIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import MatQuantity from '../components/MatQuantity'

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
  const iconFallback = <span className="text-[10px] font-bold text-[var(--muted)] border border-[var(--border)] rounded px-0.5 bg-[var(--elevated)] opacity-70" title={nameKey}>{fallbackStr}</span>
  return (
    <td className={`px-3 py-1 text-center ${className}`}>
      <div className="flex items-center justify-center gap-2">
        <GenshinImage src={getMaterialIcon(nameKey, category)} alt={nameKey} className="w-8 h-8 object-contain shrink-0" fallback={iconFallback} />
        <span className={`font-mono text-[11px] font-bold ${color}`}>{qty}</span>
      </div>
    </td>
  )
}

export default function Weapons() {
  const trackedWeapons   = useStore((s) => s.trackedWeapons)
  const roster           = useStore((s) => s.roster)
  const removeTrackedWeapon = useStore((s) => s.removeTrackedWeapon)

  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [sortOrder,    setSortOrder]    = useState('Release')
  const [viewMode,     setViewMode]     = useState('table') // 'table' | 'card'
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Enrich tracked weapons with their static metadata and costs
  const enriched = useMemo(() => {
    // First, map over tracked weapons and calculate costs
    const mapped = trackedWeapons.map((tw) => {
      const data = weaponsData.find((w) => w.id === tw.weapon_id) || weaponsData.find((w) => w.name === tw.weaponName) || { name: tw.weaponName, rarity: 3, type: 'Unknown', materials: {} }
      const assignedChar = tw.assignedTo ? charactersData.find((c) => c.name === tw.assignedTo) : null
      
      const costs = calculateWeaponCost(data, tw.level, tw.targetLevel)

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
                <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
                <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
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
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm border-collapse whitespace-nowrap min-w-max">
                  <thead>
                    {/* Top Header Grouping */}
                    <tr className="bg-[var(--elevated)] border-b border-[var(--border)]">
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)] sticky left-0 z-30 bg-[var(--elevated)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Identity</th>
                      <th colSpan="2" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)]">State</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Enhancement</th>
                      <th colSpan="4" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Weapon Ascension Material</th>
                      <th colSpan="3" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Elite Enhancement Material</th>
                      <th colSpan="3" className="px-4 py-2 text-center text-[10px] uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]">Common Enhancement Material</th>
                      <th className="px-4 py-2 border-b border-[var(--border)]"></th>
                    </tr>
                    {/* Sub Headers */}
                    <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">
                      {/* Identity (Sticky) */}
                      <th className="text-center px-4 py-2 font-semibold sticky left-0 z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]">Sl</th>
                      <th className="text-left px-4 py-2 font-semibold sticky left-[48px] z-20 bg-[var(--surface)] w-[200px] min-w-[200px] max-w-[200px]">Weapon</th>
                      <th className="text-center px-4 py-2 font-semibold sticky left-[248px] z-20 bg-[var(--surface)] w-[82px] min-w-[82px] max-w-[82px]">Type</th>
                      <th className="text-left px-4 py-2 font-semibold sticky left-[330px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Assigned Character</th>
                      
                      {/* State */}
                      <th className="text-center px-3 py-2 font-semibold">Lv</th>
                      <th className="text-center px-3 py-2 font-semibold text-[var(--gold)] border-r border-[var(--border)]">→ Lv</th>
                      
                      {/* Enhancement Math */}
                      <th className="text-center px-3 py-2 font-semibold text-[#F472B6]" title="Mystic Enhancement Ore">Mystic Ore</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="Fine Enhancement Ore">Fine Ore</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF]" title="Enhancement Ore">Normal Ore</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#C8A96E] border-r border-[var(--border)]">Mora</th>

                      {/* Ascension Mats */}
                      <th className="text-center px-3 py-2 font-semibold text-[#FBBF24]" title="5★ Weapon Ascension Material">Asc 5★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="4★ Weapon Ascension Material">Asc 4★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="3★ Weapon Ascension Material">Asc 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF] border-r border-[var(--border)]" title="2★ Weapon Ascension Material">Asc 2★</th>

                      {/* Elite Mats */}
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="4★ Elite Enhancement Material">Elite 4★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="3★ Elite Enhancement Material">Elite 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF] border-r border-[var(--border)]" title="2★ Elite Enhancement Material">Elite 2★</th>

                      {/* Mob Mats */}
                      <th className="text-center px-3 py-2 font-semibold text-[#A78BFA]" title="3★ Common Enhancement Material">Enh 3★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#60A5FA]" title="2★ Common Enhancement Material">Enh 2★</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#9CA3AF] border-r border-[var(--border)]" title="1★ Common Enhancement Material">Enh 1★</th>
                      
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((wp, idx) => {
                      try {
                        const rColor = RARITY_COLORS[wp.data?.rarity] || '#C8A96E'
                      const wpCfg  = WEAPON_TYPES[wp.data?.type] || { emoji: '⚔️' }
                      const assignedChar = wp.assignedChar
                      const elCfg = assignedChar ? (ELEMENTS[assignedChar.element] || ELEMENTS.Unknown) : null
                      const costs = calculateWeaponCost(wp.data, wp.level, wp.targetLevel)
                      
                      const resolvedMats = resolveWeaponMaterials(wp.data)

                      return (
                        <tr
                          key={wp.id}
                          className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors ${idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'}`}
                        >
                          {/* Identity Group (Sticky) */}
                          <td className="px-4 py-2 text-center text-xs text-[var(--muted)] sticky left-0 z-10 bg-inherit border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]">{wp.sl_no}</td>
                          <td className="px-4 py-2 sticky left-[48px] z-10 bg-inherit border-r border-transparent w-[200px] min-w-[200px] max-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl shrink-0 shadow relative overflow-hidden" style={{ background: `${rColor}20`, border: `1px solid ${rColor}40` }}>
                                <GenshinImage 
                                  src={getWeaponIcon(wp.weaponName)} 
                                  alt={wp.weaponName} 
                                  className="w-full h-full object-cover absolute inset-0 z-10" 
                                  fallback={<span className="font-cinzel text-sm relative z-10" style={{ color: rColor }}>{wpCfg.emoji}</span>} 
                                />
                              </div>
                              <div className="truncate">
                                <p className="font-cinzel text-xs font-semibold text-[var(--text)] truncate">{formatName(wp.weaponName)}</p>
                                <p className={`text-[10px] ${getRarityClass(wp.data?.rarity)}`}>{getStars(wp.data?.rarity || 1)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center sticky left-[248px] z-10 bg-inherit w-[82px] min-w-[82px] max-w-[82px]" title={wp.data?.type}>
                            <GenshinImage src={getWeaponTypeIcon(wp.data?.type)} alt={wp.data?.type} className="w-8 h-8 object-contain inline-block shrink-0" fallback={<span>{wpCfg?.emoji}</span>} />
                          </td>
                          <td className="px-4 py-2 sticky left-[330px] z-10 bg-inherit border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">
                            {assignedChar && elCfg ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow relative overflow-hidden" style={{ background: elCfg.avatarGradient }}>
                                  <GenshinImage 
                                    src={getCharacterAvatar(assignedChar.name)} 
                                    alt={assignedChar.name} 
                                    className="w-full h-full object-cover absolute inset-0 z-10" 
                                    fallback={<span className="font-cinzel text-[10px] relative z-10" style={{ color: elCfg.color }}>{getInitials(assignedChar.name)}</span>} 
                                  />
                                </div>
                                <span className="text-xs text-[var(--text)] truncate min-w-0">{formatName(assignedChar.name)}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] italic">Unassigned</span>
                            )}
                          </td>
                          
                          {/* State */}
                          <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-mono text-[11px] text-[var(--text)]">{wp.level ?? 1}</span>
                                {isAscended(wp.level ?? 1, wp.ascension ?? 0) && (wp.level ?? 1) < 90 && (
                                  <img 
                                    src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" 
                                    alt="Ascended" 
                                    className="w-3 h-3 opacity-80 object-contain"
                                    title="Ascended"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 border-r border-[var(--border)]">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-mono text-[11px] text-[var(--gold)]">{wp.targetLevel ?? 90}</span>
                                {isAscended(wp.targetLevel ?? 90, wp.targetAscension ?? 6) && (wp.targetLevel ?? 90) < 90 && (
                                  <img 
                                    src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" 
                                    alt="Ascended" 
                                    className="w-3 h-3 opacity-80 object-contain"
                                    title="Ascended"
                                  />
                                )}
                              </div>
                            </td>
                          
                          {/* Enhancement Math */}
                          <td className="px-3 py-2"><MatQuantity val={costs?.mystic_ore} icon="🔮" color="text-[#F472B6]" nameKey="Mystic Enhancement Ore" category="Ores" /></td>
                          <td className="px-3 py-2"><MatQuantity val={0} icon="🪨" color="text-[#60A5FA]" nameKey="Fine Enhancement Ore" category="Ores" /></td>
                          <td className="px-3 py-2"><MatQuantity val={0} icon="🪨" color="text-[#9CA3AF]" nameKey="Enhancement Ore" category="Ores" /></td>
                          <td className="px-3 py-2 border-r border-[var(--border)]"><MatQuantity val={costs?.mora} icon="🪙" color="text-[#C8A96E]" align="right" nameKey="Mora" category="Currency" /></td>

                          {/* Ascension Mats */}
                          <MatCell qty={costs?.['5_star_ascension_material']} nameKey={resolvedMats?.ascensionFamily?.tiers?.['5_star']?.name} icon="✨" color="text-[#FBBF24]" category="Weapon Ascension Material" />
                          <MatCell qty={costs?.['4_star_ascension_material']} nameKey={resolvedMats?.ascensionFamily?.tiers?.['4_star']?.name} icon="🔮" color="text-[#A78BFA]" category="Weapon Ascension Material" />
                          <MatCell qty={costs?.['3_star_ascension_material']} nameKey={resolvedMats?.ascensionFamily?.tiers?.['3_star']?.name} icon="💎" color="text-[#60A5FA]" category="Weapon Ascension Material" />
                          <MatCell qty={costs?.['2_star_ascension_material']} nameKey={resolvedMats?.ascensionFamily?.tiers?.['2_star']?.name} icon="🔸" color="text-[#9CA3AF]" className="border-r border-[var(--border)]" category="Weapon Ascension Material" />

                          {/* Elite Mats */}
                          <MatCell qty={costs?.['4_star_enhancement_material']} nameKey={resolvedMats?.eliteFamily?.tiers?.['4_star']?.name} icon="👑" color="text-[#A78BFA]" category="Elite Enhancement Material" />
                          <MatCell qty={costs?.['3_star_enhancement_material']} nameKey={resolvedMats?.eliteFamily?.tiers?.['3_star']?.name} icon="🏵️" color="text-[#60A5FA]" category="Elite Enhancement Material" />
                          <MatCell qty={costs?.['2_star_enhancement_material']} nameKey={resolvedMats?.eliteFamily?.tiers?.['2_star']?.name} icon="🦴" color="text-[#9CA3AF]" className="border-r border-[var(--border)]" category="Elite Enhancement Material" />

                          {/* Mob Mats */}
                          <MatCell qty={costs?.['3_star_enemy_material']} nameKey={resolvedMats?.commonFamily?.tiers?.['3_star']?.name} icon="👻" color="text-[#A78BFA]" category="Common Enhancement Material" />
                          <MatCell qty={costs?.['2_star_enemy_material']} nameKey={resolvedMats?.commonFamily?.tiers?.['2_star']?.name} icon="💧" color="text-[#60A5FA]" category="Common Enhancement Material" />
                          <MatCell qty={costs?.['1_star_enemy_material']} nameKey={resolvedMats?.commonFamily?.tiers?.['1_star']?.name} icon="🦠" color="text-[#9CA3AF]" className="border-r border-[var(--border)]" category="Common Enhancement Material" />
                          
                          {/* Actions */}
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeTrackedWeapon(wp.id)}
                              className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    } catch (e) {
                      console.error('Failed to render weapon row:', wp.id, e)
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
