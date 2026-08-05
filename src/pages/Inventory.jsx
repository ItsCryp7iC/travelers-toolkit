import React, { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { getPrimaryInventoryList } from '../utils/dataManager'
import { getRarityBg } from '../utils/gameData'
import { getMaterialIcon } from '../utils/assetHelper'
import GenshinImage from '../components/GenshinImage'

// ─── Element / Gemstone Color Map ──────────────────────────────────────────
const GEM_COLORS = {
  AgnidusAgate:     { color: '#F97316', label: 'Pyro',    emoji: '🔥' },
  NagadusEmerald:   { color: '#4ADE80', label: 'Dendro',  emoji: '🌿' },
  PrithivaTopaz:    { color: '#FAB632', label: 'Geo',     emoji: '⛰️' },
  ShivadaJade:      { color: '#BAE6FD', label: 'Cryo',    emoji: '❄️' },
  VajradaAmethyst:  { color: '#A855F7', label: 'Electro', emoji: '⚡' },
  VarunadaLazurite: { color: '#60A5FA', label: 'Hydro',   emoji: '💧' },
  VayudaTurquoise:  { color: '#4EC9B0', label: 'Anemo',   emoji: '🌪️' },
  BrilliantDiamond: { color: '#E8E3D5', label: 'All',     emoji: '💎' },
}

const getCardOuterBg = (rarity) => {
  const r = parseInt(rarity, 10);
  switch (r) {
    case 5: return "bg-gradient-to-b from-yellow-700/20 to-gray-900/80 border-yellow-700/30";
    case 4: return "bg-gradient-to-b from-purple-700/20 to-gray-900/80 border-purple-700/30";
    case 3: return "bg-gradient-to-b from-blue-700/20 to-gray-900/80 border-blue-700/30";
    case 2: return "bg-gradient-to-b from-green-700/20 to-gray-900/80 border-green-700/30";
    case 1: return "bg-gradient-to-b from-gray-600/20 to-gray-900/80 border-gray-600/30";
    default: return "bg-gradient-to-b from-gray-800/40 to-gray-900/90 border-gray-700/50";
  }
};

// ─── Stepper Card — Portrait Layout ───────────────────────────────────────
function MaterialCard({ matKey, label, accent, sublabel, iconCategory, rarity }) {
  const qty          = useStore((s) => s.inventory[matKey] || 0)
  const setInventory = useStore((s) => s.setInventory)

  const handleChange = (v) => {
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 0) setInventory(matKey, n)
  }

  const step = (delta) => setInventory(matKey, Math.max(0, qty + delta))

  const accentColor = accent || '#C8A96E'
  const rarityBgClass = getRarityBg(rarity || 0)
  const iconUrl = getMaterialIcon(label, iconCategory)

  return (
    <div
      className={`flex flex-col items-center justify-between p-4 rounded-2xl border w-full h-full group backdrop-blur-sm ${getCardOuterBg(rarity)}`}
      style={{ '--mat-accent': accentColor }}
      id={`inv-${matKey.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {/* ── Top Metadata ── */}
      <div className="text-center mb-4 w-full">
        <h3
          className="font-semibold text-lg text-white truncate w-full px-2"
          title={label}
        >
          {label}
        </h3>
        {sublabel && (
          <span className="text-xs text-gray-400 font-medium block mt-0.5">{sublabel}</span>
        )}
      </div>

      {/* ── Rarity Portrait Box ── */}
      <div className={`w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-2xl flex items-center justify-center shadow-inner ring-1 ring-white/10 mb-4 flex-shrink-0 ${rarityBgClass}`}>
        <GenshinImage
          src={iconUrl}
          alt={label}
          className="w-3/4 h-3/4 object-contain drop-shadow-xl relative z-10"
          fallback={
            <span className="text-4xl opacity-50">📦</span>
          }
        />
      </div>

      {/* ── Count Display ── */}
      <span
        className="text-3xl font-bold mb-3"
        style={{ color: accentColor }}
      >
        {(qty || 0).toLocaleString()}
      </span>

      {/* ── Pill Stepper ── */}
      <div className="w-full px-2">
        <div className="flex items-center gap-1 bg-gray-950/80 border border-gray-600/50 rounded-full p-1.5 shadow-sm w-full">
          <button
            onClick={() => step(-1)}
            className="flex-1 text-center font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-full py-0.5 transition-colors"
            aria-label={`Decrease ${label}`}
          >−</button>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => handleChange(e.target.value)}
            className="w-12 sm:w-16 text-center bg-transparent text-white font-semibold outline-none focus:ring-1 focus:ring-[var(--mat-accent)] rounded"
            aria-label={`${label} quantity`}
          />
          <button
            onClick={() => step(1)}
            className="flex-1 text-center font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-full py-0.5 transition-colors"
            aria-label={`Increase ${label}`}
          >+</button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Stats Row ──────────────────────────────────────────────────────
function QuickStats() {
  const inventory = useStore((s) => s.inventory)
  const filledCount = Object.values(inventory).filter((v) => v > 0).length
  const moraQty    = inventory['Mora']    || 0
  const witsQty    = inventory['HeroWit'] || 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        { label: 'Materials Tracked', value: filledCount,                   icon: '📦', accent: '#C8A96E' },
        { label: 'Mora',              value: moraQty.toLocaleString(),       icon: '🪙', accent: '#FAB632' },
        { label: "Hero's Wit",        value: witsQty,                        icon: '📚', accent: '#60A5FA' },
        { label: 'Total Slots',       value: Object.keys(inventory).length,  icon: '🗂️', accent: '#A855F7' },
      ].map(({ label, value, icon, accent }) => (
        <div key={label} className="stat-card">
          <div className="stat-icon" style={{ background: `${accent}18` }}>{icon}</div>
          <div>
            <p className="text-[var(--muted)] text-xs mb-0.5">{label}</p>
            <p className="font-cinzel font-bold text-lg leading-none" style={{ color: accent }}>
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Inventory Page ─────────────────────────────────────────────────

const PRIMARY_TABS = [
  { id: 'Currency & Experience', label: 'Currency & Exp', icon: '🪙' },
  { id: 'Boss Drops', label: 'Boss Drops', icon: '🐉' },
  { id: 'Talent Materials', label: 'Talent Mats', icon: '📚' },
  { id: 'Enemy Drops', label: 'Enemy Drops', icon: '⚔️' },
  { id: 'Weapon Ascension Material', label: 'Weapon Asc', icon: '🗡️' },
  { id: 'Local Specialty', label: 'Local Spec', icon: '🌸' },
  { id: 'Character Ascension Gem', label: 'Character Gems', icon: '💎' },
]

const SUB_TABS = {
  'Boss Drops': ['Normal Boss', 'Weekly Boss'],
  'Enemy Drops': ['Common Enhancement Material', 'Elite Enhancement Material'],
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('Currency & Experience')
  const [activeSubTab, setActiveSubTab] = useState('')

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    if (SUB_TABS[tabId]) {
      setActiveSubTab(SUB_TABS[tabId][0])
    } else {
      setActiveSubTab('')
    }
  }

  // Generate an exhaustive categorized list of all materials in the game
  const allMaterials = useMemo(() => getPrimaryInventoryList(), [])

  // Filter items based on active tabs
  const filteredMats = useMemo(() => {
    return allMaterials.filter(mat => {
      if (activeTab === 'Currency & Experience') {
        return mat.category === 'Currency' || mat.category === 'Experience'
      }
      if (activeTab === 'Boss Drops' || activeTab === 'Enemy Drops') {
        return mat.subCategory === activeSubTab
      }
      return mat.category === activeTab
    })
  }, [allMaterials, activeTab, activeSubTab])

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📦</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">
            Inventory
          </h1>
        </div>
        <p className="text-[var(--muted)] text-sm ml-11">
          Track your current material counts — updates sync automatically to the Planner
        </p>
      </div>

      {/* ── Quick Stats ── */}
      <QuickStats />

      {/* ── Primary Tabs ── */}
      <div className="flex flex-wrap gap-2 mb-4 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        {PRIMARY_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`inv-tab-${id.replace(/\s+/g, '-')}`}
            onClick={() => handleTabClick(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-1 justify-center whitespace-nowrap"
            style={
              activeTab === id
                ? {
                    background: 'rgba(200,169,110,0.15)',
                    color: 'var(--gold)',
                    border: '1px solid rgba(200,169,110,0.3)',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--muted)',
                    border: '1px solid transparent',
                  }
            }
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Secondary Tabs ── */}
      {SUB_TABS[activeTab] && (
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {SUB_TABS[activeTab].map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubTab(sub)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
              style={
                activeSubTab === sub
                  ? {
                      background: 'var(--gold)',
                      color: '#000',
                    }
                  : {
                      background: 'var(--surface)',
                      color: 'var(--muted)',
                      border: '1px solid var(--border)',
                    }
              }
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* ── Content Grid ── */}
      <div className="animate-fade-in grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 mt-6">
        {[...filteredMats].sort((a, b) => {
          return (a.sortOrder || 9999) - (b.sortOrder || 9999);
        }).map((mat) => (
          <MaterialCard
            key={mat.matKey}
            matKey={mat.matKey}
            label={mat.label}
            sublabel={mat.sublabel}
            accent={mat.accent}
            iconCategory={mat.iconCategory}
            rarity={mat.rarity}
          />
        ))}
        {filteredMats.length === 0 && (
          <div className="col-span-full py-12 text-center text-[var(--muted)] text-sm">
            No materials found for this category.
          </div>
        )}
      </div>
    </div>
  )
}
