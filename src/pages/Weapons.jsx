import React, { useState, useMemo } from 'react'
import WeaponCard from '../components/WeaponCard'
import AddWeaponModal from '../components/AddWeaponModal'
import weaponsData from '../data/weapons.json'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { WEAPON_TYPES, RARITY_COLORS, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData'
import { ELEMENTS } from '../utils/gameData'
import { calculateWeaponCost, formatNumber, buildWeaponAscMatKey, buildWeaponEliteKey, buildMobNames, formatMaterialName } from '../utils/calculator'
import MatQuantity from '../components/MatQuantity'

const ALL_TYPES    = ['All', ...Object.keys(WEAPON_TYPES)]
const ALL_RARITIES = ['All', '5★', '4★', '3★', '2★', '1★']

const MatCell = ({ qty, nameKey, icon = '📦', color = '', className = '' }) => {
  if (!qty) return <td className={`px-3 py-2 text-center ${className}`}><span className="text-[var(--muted)] opacity-50">-</span></td>
  return (
    <td className={`px-3 py-1 text-center ${className}`}>
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-1 text-[9px] text-[var(--muted)] leading-tight max-w-[65px]">
          <span>{icon}</span>
          <span className="truncate" title={formatMaterialName(nameKey)}>{formatMaterialName(nameKey)}</span>
        </div>
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
  const [sortConfig,   setSortConfig]   = useState({ key: 'created_at', direction: 'asc' })
  const [viewMode,     setViewMode]     = useState('table') // 'table' | 'card'
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Enrich tracked weapons with their static metadata and costs
  const enriched = useMemo(() => {
    // First, map over tracked weapons and calculate costs
    const mapped = trackedWeapons.map((tw) => {
      const data = weaponsData.find((w) => w.name === tw.weaponName) || { name: tw.weaponName, rarity: 3, type: 'Unknown', materials: {} }
      const assignedChar = tw.assignedTo ? charactersData.find((c) => c.name === tw.assignedTo) : null
      
      const costs = calculateWeaponCost(data, tw.level, tw.ascension, tw.targetLevel, tw.targetAscension)

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
      const r = parseInt(rarityFilter[0], 10)
      list = list.filter((w) => w.data?.rarity === r)
    }
    
    list.sort((a, b) => {
      let valA, valB
      switch (sortConfig.key) {
        case 'sl_no': valA = a.sl_no; valB = b.sl_no; break
        case 'name': valA = a.weaponName; valB = b.weaponName; break
        case 'type': valA = a.data?.type; valB = b.data?.type; break
        case 'rarity': valA = a.data?.rarity || 0; valB = b.data?.rarity || 0; break
        case 'level': valA = a.level; valB = b.level; break
        case 'created_at': valA = a.createdAt || 0; valB = b.createdAt || 0; break
        default: valA = a.createdAt || 0; valB = b.createdAt || 0;
      }
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    
    return list
  }, [enriched, search, typeFilter, rarityFilter, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null
    return <span className="ml-1 text-[var(--gold)]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

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
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
                <input type="search" placeholder="Search armory…" className="search-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <span className="text-[var(--muted)] text-xs">{filtered.length} / {trackedWeapons.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`filter-pill ${typeFilter === t ? 'active' : ''}`}>
                  {WEAPON_TYPES[t]?.emoji || '🌐'} {t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_RARITIES.map((r) => (
                <button key={r} onClick={() => setRarityFilter(r)} className={`filter-pill ${rarityFilter === r ? 'active' : ''}`}>
                  {r === 'All' ? '🌐' : r === '5★' ? '⭐' : r === '4★' ? '💜' : '⚪'} {r}
                </button>
              ))}
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
                      <th className="text-center px-4 py-2 font-semibold cursor-pointer hover:text-[var(--text)] sticky left-0 z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]" onClick={() => handleSort('sl_no')}>Sl<SortIcon columnKey="sl_no"/></th>
                      <th className="text-left px-4 py-2 font-semibold cursor-pointer hover:text-[var(--text)] sticky left-[48px] z-20 bg-[var(--surface)] w-[200px] min-w-[200px] max-w-[200px]" onClick={() => handleSort('name')}>Weapon<SortIcon columnKey="name"/></th>
                      <th className="text-center px-4 py-2 font-semibold cursor-pointer hover:text-[var(--text)] sticky left-[248px] z-20 bg-[var(--surface)] w-[82px] min-w-[82px] max-w-[82px]" onClick={() => handleSort('type')}>Type<SortIcon columnKey="type"/></th>
                      <th className="text-left px-4 py-2 font-semibold sticky left-[330px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">Assigned Character</th>
                      
                      {/* State */}
                      <th className="text-center px-3 py-2 font-semibold cursor-pointer hover:text-[var(--text)]" onClick={() => handleSort('level')}>Lv<SortIcon columnKey="level"/></th>
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
                      const rColor = RARITY_COLORS[wp.data?.rarity] || '#C8A96E'
                      const wpCfg  = WEAPON_TYPES[wp.data?.type] || { emoji: '⚔️' }
                      const assignedChar = wp.assignedChar
                      const elCfg = assignedChar ? (ELEMENTS[assignedChar.element] || ELEMENTS.Unknown) : null
                      const costs = wp.costs
                      
                      const ascBase = wp.data?.materials?.ascension_mat || 'WeaponAscMat'
                      const eliteBase = wp.data?.materials?.elite_mat || 'WeaponElite'
                      const mobBase = wp.data?.materials?.mob_mat || 'WeaponMob'
                      const mobNames = buildMobNames(mobBase)

                      return (
                        <tr
                          key={wp.id}
                          className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors ${idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'}`}
                        >
                          {/* Identity Group (Sticky) */}
                          <td className="px-4 py-2 text-center text-xs text-[var(--muted)] sticky left-0 z-10 bg-inherit border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]">{wp.sl_no}</td>
                          <td className="px-4 py-2 sticky left-[48px] z-10 bg-inherit border-r border-transparent w-[200px] min-w-[200px] max-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl shrink-0 shadow" style={{ background: `${rColor}20`, border: `1px solid ${rColor}40` }}>
                                {wpCfg.emoji}
                              </div>
                              <div className="truncate">
                                <p className="font-cinzel text-xs font-semibold text-[var(--text)] truncate">{formatName(wp.weaponName)}</p>
                                <p className={`text-[10px] ${getRarityClass(wp.data?.rarity)}`}>{getStars(wp.data?.rarity || 1)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center sticky left-[248px] z-10 bg-inherit text-lg w-[82px] min-w-[82px] max-w-[82px]" title={wp.data?.type}>
                            {wpCfg.emoji}
                          </td>
                          <td className="px-4 py-2 sticky left-[330px] z-10 bg-inherit border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]">
                            {assignedChar && elCfg ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow" style={{ background: elCfg.avatarGradient }}>
                                  <span className="font-cinzel text-[10px]" style={{ color: elCfg.color }}>{getInitials(assignedChar.name)}</span>
                                </div>
                                <span className="text-xs text-[var(--text)] truncate min-w-0">{formatName(assignedChar.name)}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] italic">Unassigned</span>
                            )}
                          </td>
                          
                          {/* State */}
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--text)]">{wp.level}</td>
                          <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--gold)] border-r border-[var(--border)]">{wp.targetLevel}</td>
                          
                          {/* Enhancement Math */}
                          <td className="px-3 py-2"><MatQuantity val={costs.mysticOre} icon="🔮" color="text-[#F472B6]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={costs.fineOre} icon="🪨" color="text-[#60A5FA]" /></td>
                          <td className="px-3 py-2"><MatQuantity val={costs.normalOre} icon="🪨" color="text-[#9CA3AF]" /></td>
                          <td className="px-3 py-2 border-r border-[var(--border)]"><MatQuantity val={costs.weaponMora} icon="🪙" color="text-[#C8A96E]" align="right" /></td>

                          {/* Ascension Mats */}
                          <MatCell qty={costs.ascMats?.[buildWeaponAscMatKey(ascBase, 3)]} nameKey={buildWeaponAscMatKey(ascBase, 3)} icon="✨" color="text-[#FBBF24]" />
                          <MatCell qty={costs.ascMats?.[buildWeaponAscMatKey(ascBase, 2)]} nameKey={buildWeaponAscMatKey(ascBase, 2)} icon="🔮" color="text-[#A78BFA]" />
                          <MatCell qty={costs.ascMats?.[buildWeaponAscMatKey(ascBase, 1)]} nameKey={buildWeaponAscMatKey(ascBase, 1)} icon="💎" color="text-[#60A5FA]" />
                          <MatCell qty={costs.ascMats?.[buildWeaponAscMatKey(ascBase, 0)]} nameKey={buildWeaponAscMatKey(ascBase, 0)} icon="🔸" color="text-[#9CA3AF]" className="border-r border-[var(--border)]" />

                          {/* Elite Mats */}
                          <MatCell qty={costs.eliteMob?.[buildWeaponEliteKey(eliteBase, 2)]} nameKey={buildWeaponEliteKey(eliteBase, 2)} icon="👑" color="text-[#A78BFA]" />
                          <MatCell qty={costs.eliteMob?.[buildWeaponEliteKey(eliteBase, 1)]} nameKey={buildWeaponEliteKey(eliteBase, 1)} icon="🏵️" color="text-[#60A5FA]" />
                          <MatCell qty={costs.eliteMob?.[buildWeaponEliteKey(eliteBase, 0)]} nameKey={buildWeaponEliteKey(eliteBase, 0)} icon="🦴" color="text-[#9CA3AF]" className="border-r border-[var(--border)]" />

                          {/* Mob Mats */}
                          <MatCell qty={costs.mob?.[mobNames[2]]} nameKey={mobNames[2]} icon="👻" color="text-[#A78BFA]" />
                          <MatCell qty={costs.mob?.[mobNames[1]]} nameKey={mobNames[1]} icon="💧" color="text-[#60A5FA]" />
                          <MatCell qty={costs.mob?.[mobNames[0]]} nameKey={mobNames[0]} icon="🦠" color="text-[#9CA3AF]" className="border-r border-[var(--border)]" />
                          
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
