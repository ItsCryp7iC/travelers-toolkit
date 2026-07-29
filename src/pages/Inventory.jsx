import React, { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { formatMaterialName } from '../utils/calculator'
import {
  GEM_BASES, GEM_TIERS, GEM_TIER_LABELS,
  WORLD_BOSS_MATS, LOCAL_SPECIALTY_MATS,
  MOB_BASES, getGemTierKeys, getMobTierKeys,
} from '../utils/aggregator'

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

// ─── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, accent }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: `${accent || '#C8A96E'}18` }}
      >
        {icon}
      </div>
      <div>
        <h2 className="font-cinzel font-bold text-sm text-[var(--text)]">{title}</h2>
        <p className="text-[9px] text-[var(--muted)] tracking-wider">{count} items</p>
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

// ─── Gemstone Section ────────────────────────────────────────────────────
function GemstoneSection() {
  return (
    <section className="mb-10">
      <SectionHeader icon="💎" title="Character Ascension Gems" count={GEM_BASES.length * 4} accent="#C8A96E" />
      <div className="space-y-5">
        {GEM_BASES.map((base) => {
          const cfg = GEM_COLORS[base] || { color: '#C8A96E', label: '', emoji: '💎' }
          return (
            <div key={base}>
              <div className="flex items-center gap-2 mb-2">
                <span>{cfg.emoji}</span>
                <span
                  className="text-xs font-semibold font-cinzel"
                  style={{ color: cfg.color }}
                >
                  {formatMaterialName(base)}
                </span>
                <span className="text-[9px] text-[var(--muted)] border border-[var(--border)] rounded px-1">
                  {cfg.label}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GEM_TIERS.map((tier, i) => {
                  const key   = tier ? `${base}${tier}` : base
                  const label = tier || formatMaterialName(base)
                  return (
                    <MaterialCard
                      key={key}
                      matKey={key}
                      label={label || 'Gemstone'}
                      sublabel={GEM_TIER_LABELS[i]}
                      accent={cfg.color}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Boss Drop Section ───────────────────────────────────────────────────
function BossSection() {
  return (
    <section className="mb-10">
      <SectionHeader icon="🐉" title="Normal Boss Materials" count={WORLD_BOSS_MATS.length} accent="#F97316" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {WORLD_BOSS_MATS.map((mat) => (
          <MaterialCard
            key={mat}
            matKey={mat}
            label={formatMaterialName(mat)}
            accent="#EF6D22"
            small
          />
        ))}
      </div>
    </section>
  )
}

// ─── Local Specialty Section ─────────────────────────────────────────────
function LocalSection() {
  return (
    <section className="mb-10">
      <SectionHeader icon="🌸" title="Local Specialties" count={LOCAL_SPECIALTY_MATS.length} accent="#4ADE80" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {LOCAL_SPECIALTY_MATS.map((mat) => (
          <MaterialCard
            key={mat}
            matKey={mat}
            label={formatMaterialName(mat)}
            accent="#22C55E"
            small
          />
        ))}
      </div>
    </section>
  )
}

// ─── Mob Material Section ────────────────────────────────────────────────
function MobSection() {
  return (
    <section className="mb-10">
      <SectionHeader icon="⚔️" title="Enhancement Mats" count={MOB_BASES.length * 3} accent="#A855F7" />
      <div className="space-y-4">
        {MOB_BASES.map((base) => {
          const keys = getMobTierKeys(base)
          const labels = [
            formatMaterialName(base),
            `${formatMaterialName(base)} (Uncommon)`,
            `${formatMaterialName(base)} (Rare)`,
          ]
          return (
            <div key={base}>
              <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
                ⚔️ {formatMaterialName(base)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {keys.map((k, i) => (
                  <MaterialCard
                    key={k}
                    matKey={k}
                    label={labels[i]}
                    sublabel={['Common', 'Uncommon', 'Rare'][i]}
                    accent={['#9CA3AF', '#A855F7', '#6366F1'][i]}
                    small
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Currency Section ────────────────────────────────────────────────────
function CurrencySection() {
  return (
    <section className="mb-10">
      <SectionHeader icon="🪙" title="Currency & EXP" count={2} accent="#FAB632" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MaterialCard matKey="Mora"          label="Mora"          accent="#FAB632" sublabel="Currency" />
        <MaterialCard matKey="HeroWit"       label="Hero's Wit"    accent="#60A5FA" sublabel="EXP Book ★★★★" />
        <MaterialCard matKey="AdventurerExp" label="Adventurer Exp" accent="#4ADE80" sublabel="EXP Book ★★" />
        <MaterialCard matKey="WandererAdvice" label="Wanderer's Advice" accent="#9CA3AF" sublabel="EXP Book ★" />
      </div>
    </section>
  )
}

// ─── Main Inventory Page ─────────────────────────────────────────────────
export default function Inventory() {
  const [tab, setTab] = useState('gemstones')

  const tabs = [
    { id: 'gemstones', label: 'Character Ascension Gems',  icon: '💎' },
    { id: 'boss',      label: 'Boss Drops', icon: '🐉' },
    { id: 'local',     label: 'Local Spec', icon: '🌸' },
    { id: 'mob',       label: 'Enhancement Mats',  icon: '⚔️' },
    { id: 'currency',  label: 'Currency',   icon: '🪙' },
  ]

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

      {/* ── Category Tabs ── */}
      <div className="flex flex-wrap gap-2 mb-6 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`inv-tab-${id}`}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-1 justify-center"
            style={
              tab === id
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

      {/* ── Content Panel ── */}
      <div className="animate-fade-in">
        {tab === 'gemstones' && <GemstoneSection />}
        {tab === 'boss'      && <BossSection />}
        {tab === 'local'     && <LocalSection />}
        {tab === 'mob'       && <MobSection />}
        {tab === 'currency'  && <CurrencySection />}
      </div>
    </div>
  )
}
