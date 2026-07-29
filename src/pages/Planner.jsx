import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useStore from '../store/useStore'
import { aggregateRosterCosts, computeToFarm } from '../utils/aggregator'
import { formatNumber, formatMaterialName } from '../utils/calculator'
import { formatName } from '../utils/gameData'
import FarmableToday from '../components/FarmableToday'

// ─── Progress Bar ─────────────────────────────────────────────────────────
function ProgressBar({ owned, required, accent }) {
  const pct = required > 0 ? Math.min(100, Math.round((owned / required) * 100)) : 100
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--elevated)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct >= 100 ? '#4ADE80' : accent || 'var(--gold)' }} />
      </div>
      <span className="text-[9px] font-bold tabular-nums"
        style={{ color: pct >= 100 ? '#4ADE80' : 'var(--muted)' }}>
        {pct}%
      </span>
    </div>
  )
}

// ─── To-Farm Item Card ────────────────────────────────────────────────────
function ToFarmCard({ item, accent, icon }) {
  return (
    <div className="to-farm-card" style={{ '--farm-accent': accent || '#C8A96E' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm flex-shrink-0">{icon || '📦'}</span>
          <span className="text-xs font-medium text-[var(--text)] truncate">{formatMaterialName(item.name)}</span>
        </div>
        <span className="font-cinzel font-bold text-sm flex-shrink-0" style={{ color: accent || 'var(--gold)' }}>
          ×{item.toFarm}
        </span>
      </div>
      <div className="flex justify-between text-[9px] text-[var(--muted)] mb-1">
        <span>Have: <b style={{ color: item.owned > 0 ? '#4ADE80' : 'var(--muted)' }}>{item.owned}</b></span>
        <span>Need: <b className="text-[var(--text)]">{item.required}</b></span>
      </div>
      <ProgressBar owned={item.owned} required={item.required} accent={accent} />
    </div>
  )
}

// ─── To-Farm Category ─────────────────────────────────────────────────────
function ToFarmCategory({ icon, title, items, accent, emptyMsg }) {
  if (!items || items.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="planner-section-title mb-3">{icon} {title}</h3>
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--muted)] text-xs">
          <span>✅</span> {emptyMsg || 'All stocked up!'}
        </div>
      </div>
    )
  }
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="planner-section-title">{icon} {title}</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }}>
          {items.length} items
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => (
          <ToFarmCard key={item.name} item={item} accent={accent} icon={icon} />
        ))}
      </div>
    </div>
  )
}

// ─── Per-Character Breakdown Row ──────────────────────────────────────────
function BreakdownRow({ entry: { name, entry, costs, talentCosts, weaponCosts, talentState, weaponState } }) {
  const [open, setOpen] = useState(false)
  const displayName = formatName(name)

  const totalMora = (costs?.totalMora ?? 0) + (talentCosts?.talentMora ?? 0) + (weaponCosts?.weaponMora ?? 0)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--elevated)] transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-cinzel font-bold text-xs flex-shrink-0"
          style={{ background: 'rgba(200,169,110,0.15)', color: 'var(--gold)' }}>
          {displayName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)] truncate">{displayName}</p>
          <p className="text-[10px] text-[var(--muted)]">
            A{entry.ascension ?? 0} Lv{entry.level ?? 1} → A{entry.targetAscension ?? 6} Lv{entry.targetLevel ?? 90}
            {talentState && (
              <span className="ml-2">
                · Talents {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}→{talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
              </span>
            )}
            {weaponState && weaponState.equippedWeapon && (
              <span className="ml-2 border-l border-[var(--border)] pl-2">
                🗡️ {formatName(weaponState.equippedWeapon)} {weaponState.weaponFromLv}→{weaponState.weaponToLv}
              </span>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-cinzel font-bold text-[var(--gold)]">{formatNumber(totalMora)}</p>
          <p className="text-[9px] text-[var(--muted)]">Total Mora</p>
        </div>
        <span className="text-[var(--muted)] text-xs ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {costs && [
              { label: 'Leveling Mora',  value: formatNumber(costs.levelingMora),  icon: '📈' },
              { label: 'Ascension Mora', value: formatNumber(costs.ascensionMora), icon: '🔮' },
              { label: "Hero's Wit",     value: `×${costs.heroWits}`,             icon: '📚' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">{icon} {label}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">{value}</p>
              </div>
            ))}
            {talentCosts && talentCosts.talentMora > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">📖 Talent Mora</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">{formatNumber(talentCosts.talentMora)}</p>
              </div>
            )}
            {talentCosts && talentCosts.crown > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">👑 Crowns</p>
                <p className="text-sm font-cinzel font-bold text-[#FBBF24]">×{talentCosts.crown}</p>
              </div>
            )}
            {costs && Object.entries(costs.gemstones || {}).map(([mat, qty]) => (
              <div key={mat} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">💎 {formatMaterialName(mat)}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{qty}</p>
              </div>
            ))}
            {talentCosts && Object.entries(talentCosts.books || {}).map(([mat, qty]) => (
              <div key={mat} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">📖 {formatMaterialName(mat)}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{qty}</p>
              </div>
            ))}
            {weaponCosts && weaponCosts.weaponMora > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🗡️ Weapon Mora</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">{formatNumber(weaponCosts.weaponMora)}</p>
              </div>
            )}
            {weaponCosts && weaponCosts.mysticOre > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">💠 Mystic Ore</p>
                <p className="text-sm font-cinzel font-bold text-[#F472B6]">×{weaponCosts.mysticOre}</p>
              </div>
            )}
            {weaponCosts && Object.entries(weaponCosts.ascMats || {}).map(([mat, qty]) => (
              <div key={mat} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🔗 {formatMaterialName(mat)}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{qty}</p>
              </div>
            ))}
            {weaponCosts && Object.entries(weaponCosts.eliteMob || {}).map(([mat, qty]) => (
              <div key={mat} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🛡️ {formatMaterialName(mat)}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{qty}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary Stat Card ────────────────────────────────────────────────────
function PlannerStat({ icon, label, value, accent, sub }) {
  return (
    <div className="stat-card flex-col items-start gap-1 py-4">
      <div className="flex items-center gap-2 w-full">
        <div className="stat-icon w-9 h-9" style={{ background: `${accent || '#C8A96E'}18` }}>{icon}</div>
        <p className="text-[var(--muted)] text-xs">{label}</p>
      </div>
      <p className="font-cinzel font-bold text-xl pl-1 leading-none mt-1" style={{ color: accent || 'var(--gold)' }}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-[var(--muted)] pl-1">{sub}</p>}
    </div>
  )
}

// ─── Empty Roster Prompt ──────────────────────────────────────────────────
function EmptyRosterPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6"
        style={{ background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)' }}>
        🗺️
      </div>
      <h2 className="font-cinzel font-bold text-xl text-[var(--text)] mb-3">No Characters in Roster</h2>
      <p className="text-[var(--muted)] text-sm max-w-sm mb-6">
        Head to the Dashboard, add characters to your roster, and set their progression targets. The Planner will calculate everything needed.
      </p>
      <Link to="/" className="genshin-btn text-sm px-6 py-2.5" id="go-to-dashboard-btn">
        ➕ Add Characters
      </Link>
    </div>
  )
}

// ─── Main Planner Page ────────────────────────────────────────────────────
export default function Planner() {
  const roster    = useStore((s) => s.roster)
  const inventory = useStore((s) => s.inventory)
  const [view, setView] = useState('toFarm')

  const totals = useMemo(() => aggregateRosterCosts(roster), [roster])
  const toFarm = useMemo(() => computeToFarm(totals, inventory), [totals, inventory])

  const hasRoster = Object.keys(roster).length > 0

  if (!hasRoster) return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📋</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">Planner</h1>
        </div>
      </div>
      <EmptyRosterPrompt />
    </div>
  )

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📋</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">Resource Planner</h1>
        </div>
        <p className="text-[var(--muted)] text-sm ml-11">
          Grand total across {totals.trackedCount} tracked character{totals.trackedCount !== 1 ? 's' : ''} — inventory subtracted
        </p>
      </div>

      {/* ── Grand Total Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <PlannerStat icon="👥" label="Tracked Characters" value={totals.trackedCount}                  accent="#4EC9B0" />
        <PlannerStat icon="🪙" label="Total Mora"         value={formatNumber(totals.totalMora)}        accent="#FAB632" />
        <PlannerStat icon="👑" label="Crowns Needed"      value={totals.totalCrowns || 0}              accent="#FBBF24"
          sub={totals.totalCrowns > 0 ? 'Crown of Insight' : 'None needed'} />
        <PlannerStat icon="🎒" label="Still to Farm"      value={toFarm.totalItems}
          accent={toFarm.allDone ? '#4ADE80' : '#F97316'}
          sub={toFarm.allDone ? '✅ All stocked!' : 'material lines'} />
      </div>

      {/* ── Farmable Today Widget ── */}
      <div className="mb-8">
        <FarmableToday />
      </div>

      {/* ── All-Done Banner ── */}
      {toFarm.allDone && (
        <div className="rounded-2xl border mb-8 px-6 py-5 flex items-center gap-4"
          style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' }}>
          <span className="text-3xl">🎉</span>
          <div>
            <p className="font-cinzel font-bold text-lg" style={{ color: '#4ADE80' }}>Inventory is fully stocked!</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Your current inventory covers all progression goals. Time to ascend!</p>
          </div>
        </div>
      )}

      {/* ── View Toggle ── */}
      <div className="flex gap-2 mb-6 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] w-fit">
        {[
          { id: 'toFarm',    label: '🌾 To-Farm List' },
          { id: 'breakdown', label: '📊 Per Character' },
        ].map(({ id, label }) => (
          <button key={id} id={`planner-view-${id}`} onClick={() => setView(id)}
            className="px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
            style={
              view === id
                ? { background: 'rgba(200,169,110,0.15)', color: 'var(--gold)', border: '1px solid rgba(200,169,110,0.3)' }
                : { background: 'transparent', color: 'var(--muted)', border: '1px solid transparent' }
            }>
            {label}
          </button>
        ))}
      </div>

      {/* ── To-Farm View ── */}
      {view === 'toFarm' && (
        <div className="animate-fade-in">
          {/* Currency & EXP */}
          {(toFarm.mora || toFarm.heroWits || toFarm.crown || toFarm.mysticOre) && (
            <div className="mb-6">
              <h3 className="planner-section-title mb-3">🪙 Currency & EXP</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {toFarm.mora  && <ToFarmCard item={{ name: 'Mora',    ...toFarm.mora  }} accent="#FAB632" icon="🪙" />}
                {toFarm.heroWits && <ToFarmCard item={{ name: 'HeroWit', ...toFarm.heroWits }} accent="#60A5FA" icon="📚" />}
                {toFarm.mysticOre && <ToFarmCard item={{ name: 'Mystic Enh. Ore', ...toFarm.mysticOre }} accent="#F472B6" icon="💠" />}
                {toFarm.crown && <ToFarmCard item={{ name: 'Crown',   ...toFarm.crown }} accent="#FBBF24" icon="👑" />}
              </div>
            </div>
          )}

          <ToFarmCategory icon="📖" title="Talent Material"      items={toFarm.talentBooks}    accent="#A855F7" emptyMsg="All talent books covered" />
          <ToFarmCategory icon="👑" title="Weekly Boss Material"  items={toFarm.weeklyBoss}     accent="#FBBF24" emptyMsg="All weekly boss drops covered" />
          <ToFarmCategory icon="🔗" title="Weapon Ascension Material"   items={toFarm.weaponAscMats}  accent="var(--gold)" emptyMsg="All weapon domains covered" />
          <ToFarmCategory icon="💎" title="Character Ascension Gem"          items={toFarm.gemstones}      accent="#C8A96E" emptyMsg="All gemstones covered" />
          <ToFarmCategory icon="🐉" title="Normal Boss Material"   items={toFarm.worldBoss}      accent="#F97316" emptyMsg="All boss drops covered" />
          <ToFarmCategory icon="🛡️" title="Elite Enhancement Material"    items={toFarm.eliteMob}       accent="var(--gold)" emptyMsg="All elite drops covered" />
          <ToFarmCategory icon="🌸" title="Local Specialty"  items={toFarm.localSpecialty} accent="#4ADE80" emptyMsg="All local specialties covered" />
          <ToFarmCategory icon="⚔️" title="Common Enhancement Material"          items={toFarm.mob}            accent="#A855F7" emptyMsg="All mob drops covered" />
        </div>
      )}

      {/* ── Per-Character Breakdown ── */}
      {view === 'breakdown' && (
        <div className="animate-fade-in">
          <p className="text-xs text-[var(--muted)] mb-4">Click a row to expand the full cost breakdown</p>
          {totals.breakdown.length > 0
            ? totals.breakdown.map((entry) => <BreakdownRow key={entry.name} entry={entry} />)
            : <div className="text-center py-12 text-[var(--muted)]"><p>No characters have active goals yet.</p></div>
          }
        </div>
      )}

      {/* ── Inventory link ── */}
      <div className="mt-10 p-4 rounded-xl border border-[var(--border)] flex items-center justify-between gap-4 bg-[var(--surface)]">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">📦 Update your inventory</p>
          <p className="text-xs text-[var(--muted)]">The To-Farm list auto-updates as you add materials</p>
        </div>
        <Link to="/inventory" id="go-to-inventory-btn"
          className="genshin-btn text-xs px-4 py-2 whitespace-nowrap flex-shrink-0">
          Open Inventory →
        </Link>
      </div>
    </div>
  )
}
