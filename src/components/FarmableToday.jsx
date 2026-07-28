/**
 * FarmableToday.jsx — "What can I farm today?" domain schedule widget.
 *
 * Uses the user's Planner To-Farm list and cross-references which
 * Talent Books and Weapon Ascension materials are available in domains today.
 * Also shows which Weekly Boss drops are still needed as a reminder.
 */
import React, { useMemo } from 'react'
import useStore from '../store/useStore'
import { aggregateRosterCosts, computeToFarm } from '../utils/aggregator'
import { 
  getTodayBooks, getDayLabel, formatMaterialName,
  getTodayWeaponMatGroup, WEAPON_MAT_GROUPS 
} from '../utils/calculator'

const DAY_SCHEDULE_LABEL = {
  1: 'Mon / Thu',
  2: 'Tue / Fri',
  3: 'Wed / Sat',
  4: 'Mon / Thu',
  5: 'Tue / Fri',
  6: 'Wed / Sat',
  0: 'Sunday — All Available',
}

const WEEKDAY_COLORS = {
  1: '#60A5FA', 4: '#60A5FA',  // Mon/Thu — blue
  2: '#4ADE80', 5: '#4ADE80',  // Tue/Fri — green
  3: '#F97316', 6: '#F97316',  // Wed/Sat — orange
  0: '#C8A96E',                // Sunday  — gold
}

// Reusable Pill component for Books and Weapon Mats
function ItemPill({ matKey, qty, color, needed, icon }) {
  const label = formatMaterialName(matKey)
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
      style={
        needed
          ? { background: `${color}10`, borderColor: `${color}40`, boxShadow: `0 0 8px ${color}15` }
          : { background: 'var(--elevated)', borderColor: 'var(--border)', opacity: 0.5 }
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span className="text-xs text-[var(--text)] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {needed && (
          <span className="font-cinzel font-bold text-xs" style={{ color }}>
            ×{qty}
          </span>
        )}
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${needed ? '' : 'opacity-50'}`}
          style={needed
            ? { background: `${color}20`, color }
            : { background: 'var(--border)', color: 'var(--muted)' }
          }>
          {needed ? 'NEEDED' : 'DONE'}
        </span>
      </div>
    </div>
  )
}

export default function FarmableToday() {
  const roster    = useStore((s) => s.roster)
  const inventory = useStore((s) => s.inventory)

  const today    = new Date().getDay()   // 0=Sun … 6=Sat
  const dayLabel   = DAY_SCHEDULE_LABEL[today]
  const dayColor   = WEEKDAY_COLORS[today] || '#C8A96E'

  const totals  = useMemo(() => aggregateRosterCosts(roster), [roster])
  const toFarm  = useMemo(() => computeToFarm(totals, inventory), [totals, inventory])

  // ── Talent Books ───────────────────────────────────────────────────────────
  const todayBooks = useMemo(() => getTodayBooks(), [])
  const neededBooksMap = useMemo(() => {
    const map = {}
    for (const item of (toFarm.talentBooks || [])) {
      map[item.name] = item.toFarm
    }
    return map
  }, [toFarm.talentBooks])

  const todayBooksFarmable = useMemo(() => {
    const result = []
    for (const base of todayBooks) {
      const matchedEntries = Object.entries(neededBooksMap).filter(([k]) => k.startsWith(base))
      if (matchedEntries.length > 0) {
        for (const [matKey, qty] of matchedEntries) {
          result.push({ matKey, qty, needed: true })
        }
      } else {
        result.push({ matKey: `${base}Philosophies`, qty: 0, needed: false })
      }
    }
    return result
  }, [todayBooks, neededBooksMap])

  // ── Weapon Mats ────────────────────────────────────────────────────────────
  const todayWeaponGroup = useMemo(() => getTodayWeaponMatGroup(), [])
  const neededWeaponMap = useMemo(() => {
    const map = {}
    for (const item of (toFarm.weaponAscMats || [])) {
      map[item.name] = item.toFarm
    }
    return map
  }, [toFarm.weaponAscMats])

  const todayWeaponFarmable = useMemo(() => {
    const result = []
    if (todayWeaponGroup === 'all') {
      // Sunday: just show all needed weapon mats without the "Done" pills
      for (const [matKey, qty] of Object.entries(neededWeaponMap)) {
        result.push({ matKey, qty, needed: true })
      }
    } else {
      const bases = WEAPON_MAT_GROUPS[todayWeaponGroup] || []
      for (const base of bases) {
        const matchedEntries = Object.entries(neededWeaponMap).filter(([k]) => k.toLowerCase().includes(base.toLowerCase()))
        if (matchedEntries.length > 0) {
          for (const [matKey, qty] of matchedEntries) {
            result.push({ matKey, qty, needed: true })
          }
        } else {
          result.push({ matKey: `${base} (Domain)`, qty: 0, needed: false })
        }
      }
    }
    return result
  }, [todayWeaponGroup, neededWeaponMap])

  // ── Aggregation ────────────────────────────────────────────────────────────
  const farmableCount = todayBooksFarmable.filter((b) => b.needed).length + todayWeaponFarmable.filter((w) => w.needed).length
  const weeklyNeeded  = toFarm.weeklyBoss || []

  if (Object.keys(roster).length === 0) return null

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${dayColor}30`, background: `${dayColor}06` }}
      id="farmable-today-widget"
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: `${dayColor}20` }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${dayColor}18` }}>
            📅
          </div>
          <div>
            <h3 className="font-cinzel font-bold text-sm text-[var(--text)]">
              Farmable Today
            </h3>
            <p className="text-[10px] tracking-widest font-semibold mt-0.5" style={{ color: dayColor }}>
              {getDayLabel(today).toUpperCase()} — {dayLabel}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-cinzel font-bold text-lg leading-none" style={{ color: farmableCount > 0 ? dayColor : '#4ADE80' }}>
            {farmableCount}
          </p>
          <p className="text-[9px] text-[var(--muted)]">items needed</p>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Talent Books */}
        <p className="text-[10px] font-semibold tracking-widest text-[var(--muted)] uppercase mb-3">
          📖 Available Talent Books
        </p>

        {todayBooksFarmable.length === 0 ? (
          <div className="text-center py-4 text-[var(--muted)] text-xs">
            {today === 0
              ? 'All talent books are available today — farm anything!'
              : 'No talent books needed from today\'s domains.'}
          </div>
        ) : (
          <div className="space-y-1.5 mb-4">
            {todayBooksFarmable.map(({ matKey, qty, needed }) => (
              <ItemPill key={matKey} matKey={matKey} qty={qty} color={dayColor} needed={needed} icon="📖" />
            ))}
          </div>
        )}

        <div className="genshin-divider my-4" />

        {/* Weapon Materials */}
        <p className="text-[10px] font-semibold tracking-widest text-[var(--muted)] uppercase mb-3">
          🔗 Available Weapon Mats
        </p>

        {todayWeaponFarmable.length === 0 ? (
          <div className="text-center py-4 text-[var(--muted)] text-xs">
            {today === 0
              ? 'All weapon materials are available today!'
              : 'No weapon materials needed from today\'s domains.'}
          </div>
        ) : (
          <div className="space-y-1.5 mb-4">
            {todayWeaponFarmable.map(({ matKey, qty, needed }) => (
              <ItemPill key={matKey} matKey={matKey} qty={qty} color="var(--gold)" needed={needed} icon="🔗" />
            ))}
          </div>
        )}

        {/* Weekly Boss reminder */}
        {weeklyNeeded.length > 0 && (
          <>
            <div className="genshin-divider my-4" />
            <p className="text-[10px] font-semibold tracking-widest text-[var(--muted)] uppercase mb-3">
              👑 Weekly Boss Reminders
            </p>
            <div className="space-y-1.5">
              {weeklyNeeded.map((item) => (
                <div key={item.name}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                  style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">👑</span>
                    <span className="text-xs text-[var(--text)] truncate">{formatMaterialName(item.name)}</span>
                  </div>
                  <span className="font-cinzel font-bold text-xs text-[#FBBF24] flex-shrink-0">×{item.toFarm}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* All done message */}
        {farmableCount === 0 && weeklyNeeded.length === 0 && (
          <div className="text-center py-2 mt-4">
            <span className="text-2xl">🎉</span>
            <p className="text-xs text-[var(--muted)] mt-1">Nothing left to farm today!</p>
          </div>
        )}
      </div>
    </div>
  )
}
