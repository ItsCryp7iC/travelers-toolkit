import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useStore from '../store/useStore'
import { aggregateRosterCosts, computeToFarm } from '../utils/aggregator'
import { formatNumber, formatItemName } from '../utils/calculator'
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

const RARITY_COLORS = {
  5: 'rgba(219, 177, 98, 0.2)', // Gold
  4: 'rgba(175, 140, 209, 0.2)', // Purple
  3: 'rgba(92, 172, 238, 0.2)', // Blue
  2: 'rgba(141, 198, 126, 0.2)', // Green
  1: 'rgba(164, 170, 181, 0.2)', // Gray
}

const RARITY_BORDERS = {
  5: 'var(--rarity-5)',
  4: 'var(--rarity-4)',
  3: 'var(--rarity-3)',
  2: 'var(--rarity-2)',
  1: 'var(--rarity-1)',
}

// ─── Tailored Item Card ────────────────────────────────────────────────────
export function ItemCard({ item, accent }) {
  const rarityBg = RARITY_COLORS[item.rarity || 3] || RARITY_COLORS[3];
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors relative overflow-hidden group">
      
      {/* Background Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: rarityBg }} />
      
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden" style={{ background: rarityBg }}>
        <img 
          src={`/assets/items/${item.name}.png`} 
          alt={formatItemName(item.name)}
          className="w-10 h-10 object-contain z-10 drop-shadow-md"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
        />
        {/* Fallback icon if image fails to load */}
        <span className="text-xl absolute hidden">📦</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-xs font-semibold text-[var(--text)] truncate mr-2">{formatItemName(item.name)}</span>
          <span className="font-cinzel font-bold text-xs" style={{ color: accent || 'var(--gold)' }}>
            ×{item.toFarm}
          </span>
        </div>
        <div className="flex justify-between text-[9px] text-[var(--muted)] mb-1">
          <span>Have: <b style={{ color: item.owned > 0 ? '#4ADE80' : 'var(--muted)' }}>{item.owned}</b></span>
          <span>Need: <b className="text-[var(--text)]">{item.required}</b></span>
        </div>
        <ProgressBar owned={item.owned} required={item.required} accent={accent} />
      </div>
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <ItemCard key={item.name} item={item} accent={accent} />
        ))}
      </div>
    </div>
  )
}

// ─── Per-Character Breakdown Row ──────────────────────────────────────────
function BreakdownRow({ entry: { name, entry, totalCosts, talentState, weaponState } }) {
  const [open, setOpen] = useState(false)
  const displayName = formatName(name)

  const totalMora = totalCosts?.mora || 0

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
                • Talents {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}→{talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
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
            {totalCosts?.heros_wit > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">📚 Hero's Wit</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.heros_wit}</p>
              </div>
            )}
            {totalCosts?.mystic_ore > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">💠 Mystic Ore</p>
                <p className="text-sm font-cinzel font-bold text-[#F472B6]">×{totalCosts.mystic_ore}</p>
              </div>
            )}
            {totalCosts?.crown > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">👑 Crowns</p>
                <p className="text-sm font-cinzel font-bold text-[#FBBF24]">×{totalCosts.crown}</p>
              </div>
            )}
            {totalCosts?.masterless_stella_fortuna > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">⭐ Stella Fortuna</p>
                <p className="text-sm font-cinzel font-bold text-[#FBBF24]">×{totalCosts.masterless_stella_fortuna}</p>
              </div>
            )}
            
            {/* Gemstones */}
            {['gem_sliver', 'gem_fragment', 'gem_chunk', 'gem_gemstone'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">💎 {formatName(key.replace('gem_', ''))}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Boss & Local */}
            {totalCosts?.boss_material > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🐉 Boss Material</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.boss_material}</p>
              </div>
            )}
            {totalCosts?.local_specialty > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🌸 Local Specialty</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.local_specialty}</p>
              </div>
            )}
            
            {/* Talent Books */}
            {['2_star_talent_material', '3_star_talent_material', '4_star_talent_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">📖 {key.split('_')[0]}-Star Book</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}
            
            {/* Weekly Boss */}
            {totalCosts?.weekly_boss_material > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🐺 Weekly Boss</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.weekly_boss_material}</p>
              </div>
            )}
            
            {/* Weapon Asc Mats */}
            {['2_star_ascension_material', '3_star_ascension_material', '4_star_ascension_material', '5_star_ascension_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🔗 {key.split('_')[0]}-Star Asc. Mat</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}
            
            {/* Elite Drops */}
            {['2_star_enhancement_material', '3_star_enhancement_material', '4_star_enhancement_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🛡️ {key.split('_')[0]}-Star Elite Mat</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}
            
            {/* Mob Drops */}
            {['1_star_enemy_material', '2_star_enemy_material', '3_star_enemy_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">⚔️ {key.split('_')[0]}-Star Mob Drop</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
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
  const roster = useStore(s => s.roster)
  const trackedWeapons = useStore(s => s.trackedWeapons)
  const inventory = useStore(s => s.inventory)

  const [view, setView] = useState('toFarm')

  const totals = useMemo(() => aggregateRosterCosts(roster, trackedWeapons), [roster, trackedWeapons])
  const toFarm = useMemo(() => computeToFarm(totals, inventory), [totals, inventory])

  const hasRoster = Object.keys(roster).length > 0

  const remainingTotals = useMemo(() => {
    let mora = toFarm.mora?.toFarm || 0;
    let crowns = toFarm.crown?.toFarm || 0;
    let sumItems = 0;
    
    for (const key of Object.keys(toFarm)) {
      if (['totalItems', 'allDone', 'mora', 'crown'].includes(key)) continue;
      const val = toFarm[key];
      if (Array.isArray(val)) {
        val.forEach(item => {
          if (item?.toFarm) sumItems += item.toFarm;
        });
      } else if (val?.toFarm) {
        sumItems += val.toFarm;
      }
    }
    return { mora, crowns, sumItems };
  }, [toFarm]);

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
        <PlannerStat icon="🪙" label="Total Mora"         value={formatNumber(remainingTotals.mora)}        accent="#FAB632" />
        <PlannerStat icon="👑" label="Crowns Needed"      value={remainingTotals.crowns}              accent="#FBBF24"
          sub={remainingTotals.crowns > 0 ? 'Crown of Insight' : 'None needed'} />
        <PlannerStat icon="🎒" label="Still to Farm"      value={formatNumber(remainingTotals.sumItems)}
          accent={toFarm.allDone ? '#4ADE80' : '#F97316'}
          sub={toFarm.allDone ? '✅ All stocked!' : 'materials left'} />
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
          {(toFarm.mora || toFarm.heroWits || toFarm.crown || toFarm.mysticOre || toFarm.stellaFortuna) && (
            <div className="mb-6">
              <h3 className="planner-section-title mb-3">🪙 Currency & EXP</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {toFarm.mora  && <ItemCard item={toFarm.mora} accent="#FAB632" />}
                {toFarm.heroWits && <ItemCard item={toFarm.heroWits} accent="#60A5FA" />}
                {toFarm.mysticOre && <ItemCard item={toFarm.mysticOre} accent="#F472B6" />}
                {toFarm.crown && <ItemCard item={toFarm.crown} accent="#FBBF24" />}
                {toFarm.stellaFortuna && <ItemCard item={toFarm.stellaFortuna} accent="#FBBF24" />}
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
