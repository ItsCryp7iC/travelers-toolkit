import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';
import { formatNumber } from '../utils/calculator';
import PlannerStats from '../components/Planner/PlannerStats';
import PlannerEmptyState from '../components/Planner/PlannerEmptyState';
import PlannerTabContent from '../components/Planner/PlannerTabContent';
import usePlannerData from './planner/usePlannerData';



export default function Planner() {
  const roster = useStore(s => s.roster);
  const trackedWeapons = useStore(s => s.trackedWeapons);
  const inventory = useStore(s => s.inventory);

  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'daily_action';

  const {
    totals,
    toFarm,
    groupedBooksData,
    groupedWeaponMatsData,
    groupedGemstonesData,
    groupedWeeklyBosses,
    groupedNormalBosses,
    groupedLocalSpecialties,
    groupedEliteEnemies,
    groupedCommonEnemies,
    remainingTotals
  } = usePlannerData({ roster, trackedWeapons, inventory });

  const hasRoster = Object.keys(roster).length > 0;

  if (!hasRoster) return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <img src="/Planner.png" alt="Planner" className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
          <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)]">Planner</h1>
        </div>
      </div>
      <PlannerEmptyState />
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <img src="/Planner.png" alt="Planner" className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
          <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)]">Resource Planner</h1>
        </div>
        <p className="text-[var(--muted)] text-sm ml-11">
          Grand total across {totals.trackedCount} tracked character{totals.trackedCount !== 1 ? 's' : ''} — inventory subtracted
        </p>
      </div>

      {/* ── Grand Total Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <PlannerStats icon={<img src="/Characters.png" alt="Tracked Characters" className="w-5 h-5 object-contain drop-shadow-sm" />} label="Tracked Characters" value={totals.trackedCount} accent="#4EC9B0" />
        <PlannerStats icon={<img src="/CurrencyExp.png" alt="Total Mora" className="w-5 h-5 object-contain drop-shadow-sm" />} label="Total Mora" value={formatNumber(remainingTotals.mora)} accent="#FAB632" />
        <PlannerStats icon={<img src="/CrownOfInsight.png" alt="Crowns Needed" className="w-5 h-5 object-contain drop-shadow-sm" />} label="Crowns Needed" value={remainingTotals.crowns} accent="#FBBF24"
          sub={remainingTotals.crowns > 0 ? 'Crown of Insight' : 'None needed'} />
        <PlannerStats icon="🎒" label="Still to Farm" value={formatNumber(remainingTotals.sumItems)}
          accent={toFarm.allDone ? '#4ADE80' : '#F97316'}
          sub={toFarm.allDone ? '✅ All stocked!' : 'materials left'} />
      </div>

      {/* ── Tab Content ── */}
      <PlannerTabContent
        activeTab={activeTab}
        toFarm={toFarm}
        totals={totals}
        inventory={inventory}
        groupedBooksData={groupedBooksData}
        groupedWeaponMatsData={groupedWeaponMatsData}
        groupedGemstonesData={groupedGemstonesData}
        groupedWeeklyBosses={groupedWeeklyBosses}
        groupedNormalBosses={groupedNormalBosses}
        groupedLocalSpecialties={groupedLocalSpecialties}
        groupedEliteEnemies={groupedEliteEnemies}
        groupedCommonEnemies={groupedCommonEnemies}
      />

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
  );
}
