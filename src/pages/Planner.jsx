import React, { useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';
import { formatNumber } from '../utils/calculator';
import PlannerStats from '../components/Planner/PlannerStats';
import PlannerEmptyState from '../components/Planner/PlannerEmptyState';
import PlannerTabContent from '../components/Planner/PlannerTabContent';
import usePlannerData from './planner/usePlannerData';
import { PLANNER_TABS, getPlannerTabId } from '../utils/plannerTabs';

export default function Planner() {
  const roster = useStore(s => s.roster);
  const trackedWeapons = useStore(s => s.trackedWeapons);
  const inventory = useStore(s => s.inventory);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = getPlannerTabId(rawTab);
  const tabsContainerRef = useRef(null);

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

  const handleTabChange = useCallback((tabId) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const activeBtn = container.querySelector(`[id="planner-tab-${activeTab}"]`);
    if (!activeBtn) return;

    const scrollActiveIntoView = () => {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeBtn.getBoundingClientRect();

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      if (containerRect.width > 0 && activeRect.width > 0) {
        const isComfortablyVisible =
          activeRect.left >= containerRect.left + 16 &&
          activeRect.right <= containerRect.right - 16;

        if (!isComfortablyVisible) {
          const offset = activeRect.left - containerRect.left + container.scrollLeft;
          const targetScrollLeft = offset - (container.clientWidth / 2) + (activeRect.width / 2);

          if (typeof container.scrollTo === 'function') {
            container.scrollTo({
              left: Math.max(0, targetScrollLeft),
              behavior: prefersReducedMotion ? 'auto' : 'smooth',
            });
          } else {
            container.scrollLeft = Math.max(0, targetScrollLeft);
          }
        }
      } else if (typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    };

    scrollActiveIntoView();
    const rafId = requestAnimationFrame(scrollActiveIntoView);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab]);

  const hasRoster = Object.keys(roster).length > 0;

  if (!hasRoster) return (
    <div className="animate-fade-in">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 sm:gap-3 mb-1">
          <img src="/Planner.png" alt="Planner" className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm shrink-0" />
          <h1 className="font-bold text-xl sm:text-2xl md:text-3xl text-[var(--text)]">Planner</h1>
        </div>
        <p className="text-[var(--muted)] text-xs sm:text-sm">Plan and track materials for your characters and weapons</p>
      </div>
      <PlannerEmptyState />
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* ── Page Header & In-Page Category Navigation ── */}
      <div className="sticky top-[var(--topbar-h,64px)] z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-2 sm:pb-3 pt-1 mb-4 sm:mb-6 border-b border-[var(--border)] shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img src="/Planner.png" alt="Planner" className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-xl sm:text-2xl md:text-3xl text-[var(--text)] truncate leading-tight">Resource Planner</h1>
              <p className="text-[var(--muted)] text-xs sm:text-sm truncate">
                Grand total across {totals.trackedCount} tracked character{totals.trackedCount !== 1 ? 's' : ''} — inventory subtracted
              </p>
            </div>
          </div>
        </div>

        {/* ── Category Tabs Strip ── */}
        <div
          ref={tabsContainerRef}
          role="tablist"
          aria-label="Planner Categories"
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {PLANNER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`planner-tab-${tab.id}`}
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--primary)] text-white shadow-md shadow-amber-900/20 ring-1 ring-amber-400/30'
                    : 'bg-[var(--surface)] text-[var(--muted)] hover:text-white hover:bg-gray-800/80 border border-[var(--border)]'
                }`}
              >
                {typeof tab.icon === 'string' && tab.icon.startsWith('/') ? (
                  <img src={tab.icon} alt="" className="w-4 h-4 object-contain shrink-0" aria-hidden="true" />
                ) : (
                  <span className="text-sm" aria-hidden="true">{tab.icon}</span>
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grand Total Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
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
      <div className="mt-6 sm:mt-10 p-3.5 sm:p-4 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-[var(--surface)]">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">📦 Update your inventory</p>
          <p className="text-xs text-[var(--muted)]">The To-Farm list auto-updates as you add materials</p>
        </div>
        <Link to="/inventory" id="go-to-inventory-btn"
          className="genshin-btn text-xs px-4 py-2 whitespace-nowrap self-start sm:self-auto flex-shrink-0">
          Open Inventory →
        </Link>
      </div>
    </div>
  );
}
