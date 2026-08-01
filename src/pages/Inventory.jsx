import React, { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { getPrimaryInventoryList } from '../utils/dataManager'

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

// ─── Stepper Card ─────────────────────────────────────────────────────────
function MaterialCard({ matKey, label, accent, sublabel, small }) {
  const qty          = useStore((s) => s.inventory[matKey] || 0)
  const setInventory = useStore((s) => s.setInventory)

  const handleChange = (v) => {
    const n = parseInt(v, 10)
    if (!isNaN(n)) setInventory(matKey, n)
  }

  const step = (delta) => setInventory(matKey, Math.max(0, qty + delta))

  const accentColor = accent || '#C8A96E'

  return (
    <div
      className="material-card group"
      style={{ '--mat-accent': accentColor }}
      id={`inv-${matKey.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {/* Top color bar */}
      <div
        className="material-card-bar"
        style={{ background: accentColor }}
      />

      {/* Label */}
      <div className="px-3 pt-3 pb-1 flex-1">
        <p
          className={`font-medium text-[var(--text)] leading-tight ${small ? 'text-[10px]' : 'text-[11px]'}`}
          title={label}
        >
          {label}
        </p>
        {sublabel && (
          <p className="text-[9px] text-[var(--muted)] mt-0.5 leading-tight">{sublabel}</p>
        )}
      </div>

      {/* Qty display */}
      <div
        className="mx-3 mb-1 text-center font-cinzel font-bold text-xl leading-none"
        style={{ color: qty > 0 ? accentColor : 'var(--muted)' }}
      >
        {qty}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 px-3 pb-3">
        <button
          onClick={() => step(-1)}
          className="stepper-btn"
          aria-label={`Decrease ${label}`}
        >−</button>
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => handleChange(e.target.value)}
          className="stepper-input"
          aria-label={`${label} quantity`}
        />
        <button
          onClick={() => step(1)}
          className="stepper-btn"
          aria-label={`Increase ${label}`}
        >+</button>
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
      <div className="animate-fade-in grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {filteredMats.map((mat) => (
          <MaterialCard
            key={mat.matKey}
            matKey={mat.matKey}
            label={mat.label}
            sublabel={mat.sublabel}
            accent={mat.accent}
            small={activeTab !== 'Currency & Experience'}
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
