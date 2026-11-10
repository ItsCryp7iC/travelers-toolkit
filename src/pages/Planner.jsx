import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';
import { formatNumber } from '../utils/calculator';
import PlannerStats from '../components/Planner/PlannerStats';
import PlannerEmptyState from '../components/Planner/PlannerEmptyState';
import PlannerTabContent from '../components/Planner/PlannerTabContent';
import PlannerCraftingChecklist from '../components/Planner/PlannerCraftingChecklist';
import CraftingSessionDrawer from '../components/Planner/CraftingSessionDrawer';
import CraftingSessionReplacementModal from '../components/Planner/CraftingSessionReplacementModal';
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
  const [showInvalidDetails, setShowInvalidDetails] = useState(false);
  const [craftingMode, setCraftingMode] = useState('crafting-aware');
  const [craftingBonusOptions, setCraftingBonusOptions] = useState({
    enabled: false,
    bonusType: 'double_output',
  });

  const {
    totals,
    combinedTotals,
    toFarm,
    craftingPlan,
    bonusForecast,
    groupedBooksData,
    groupedWeaponMatsData,
    groupedGemstonesData,
    groupedWeeklyBosses,
    groupedNormalBosses,
    groupedLocalSpecialties,
    groupedEliteEnemies,
    groupedCommonEnemies,
    remainingTotals
  } = usePlannerData({
    roster,
    trackedWeapons,
    inventory,
    craftingMode,
    craftingBonusOptions,
  });

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
        <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3 flex-wrap">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img src="/Planner.png" alt="Planner" className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-xl sm:text-2xl md:text-3xl text-[var(--text)] truncate leading-tight">Resource Planner</h1>
              <p className="text-[var(--muted)] text-xs sm:text-sm truncate">
                {(() => {
                  const charPlanCount = totals.activeCharacterPlans ?? totals.characterCount ?? 0;
                  const weapPlanCount = totals.activeWeaponPlans ?? totals.weaponCount ?? 0;
                  const invalidCount = totals.invalidCount ?? 0;
                  if (charPlanCount > 0 && weapPlanCount > 0) {
                    return `Resources across ${charPlanCount} character plan${charPlanCount !== 1 ? 's' : ''} and ${weapPlanCount} weapon plan${weapPlanCount !== 1 ? 's' : ''} — inventory subtracted`;
                  }
                  if (weapPlanCount > 0) {
                    return `Resources across ${weapPlanCount} weapon plan${weapPlanCount !== 1 ? 's' : ''} — inventory subtracted`;
                  }
                  if (charPlanCount > 0) {
                    return `Resources across ${charPlanCount} character plan${charPlanCount !== 1 ? 's' : ''} — inventory subtracted`;
                  }
                  if (invalidCount > 0) {
                    return `${invalidCount} invalid progression record${invalidCount !== 1 ? 's' : ''} excluded from planning`;
                  }
                  return 'No outstanding upgrade plans';
                })()}
              </p>
            </div>
          </div>

          {/* Controls: Mode & Crafting Bonuses */}
          <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-auto">
            {/* Crafting Mode Toggle */}
            <div
              className="flex items-center bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] shrink-0"
              role="group"
              aria-label="Calculation Mode"
            >
              <button
                type="button"
                id="crafting-mode-aware-btn"
                onClick={() => setCraftingMode('crafting-aware')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  craftingMode === 'crafting-aware'
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-white'
                }`}
                aria-pressed={craftingMode === 'crafting-aware'}
              >
                <span>🔨</span>
                <span>Crafting-Aware</span>
              </button>
              <button
                type="button"
                id="crafting-mode-raw-btn"
                onClick={() => setCraftingMode('raw')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  craftingMode === 'raw'
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-white'
                }`}
                aria-pressed={craftingMode === 'raw'}
              >
                <span>📦</span>
                <span>Raw Shortages</span>
              </button>
            </div>

            {/* Crafting Bonus Controls (Crafting-Aware mode only) */}
            {craftingMode === 'crafting-aware' && (
              <div
                className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] shrink-0"
                role="group"
                aria-label="Crafting Bonus Options"
              >
                {/* Control 1: Include Crafting Bonuses */}
                <button
                  type="button"
                  id="crafting-bonus-toggle-btn"
                  onClick={() =>
                    setCraftingBonusOptions((prev) => ({
                      ...prev,
                      enabled: !prev.enabled,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    craftingBonusOptions.enabled
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-[var(--muted)] hover:text-white'
                  }`}
                  aria-pressed={craftingBonusOptions.enabled}
                  title="Include generic alchemy crafting bonuses (probabilistic forecast)"
                >
                  <span>🎲</span>
                  <span>Include Crafting Bonuses</span>
                </button>

                {/* Control 2: Bonus Type (Visible only when Control 1 is enabled) */}
                {craftingBonusOptions.enabled && (
                  <div
                    id="crafting-bonus-type-group"
                    className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg border border-white/5"
                    role="radiogroup"
                    aria-label="Bonus Type"
                  >
                    <button
                      type="button"
                      id="crafting-bonus-type-double"
                      role="radio"
                      aria-checked={craftingBonusOptions.bonusType === 'double_output'}
                      onClick={() =>
                        setCraftingBonusOptions((prev) => ({
                          ...prev,
                          bonusType: 'double_output',
                        }))
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        craftingBonusOptions.bonusType === 'double_output'
                          ? 'bg-[var(--primary)] text-white shadow-sm'
                          : 'text-[var(--muted)] hover:text-white'
                      }`}
                      title="10% chance to duplicate output"
                    >
                      10% Double
                    </button>
                    <button
                      type="button"
                      id="crafting-bonus-type-refund"
                      role="radio"
                      aria-checked={craftingBonusOptions.bonusType === 'ingredient_refund'}
                      onClick={() =>
                        setCraftingBonusOptions((prev) => ({
                          ...prev,
                          bonusType: 'ingredient_refund',
                        }))
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        craftingBonusOptions.bonusType === 'ingredient_refund'
                          ? 'bg-[var(--primary)] text-white shadow-sm'
                          : 'text-[var(--muted)] hover:text-white'
                      }`}
                      title="25% chance to refund 1 consumed ingredient"
                    >
                      25% Refund
                    </button>
                  </div>
                )}
              </div>
            )}
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

      {/* ── Partial Totals Warning ── */}
      {totals.isPartial && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 sm:mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 sm:p-4 text-xs text-amber-300 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="text-base leading-none select-none mt-0.5 shrink-0" aria-hidden="true">⚠️</span>
              <div className="min-w-0">
                <p className="font-semibold text-amber-200 leading-snug">
                  Some progression records are invalid. Resource totals are incomplete.
                </p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  {totals.invalidCount} {totals.invalidCount === 1 ? 'record has' : 'records have'} invalid level or ascension combinations and {totals.invalidCount === 1 ? 'was' : 'were'} excluded from calculations.
                </p>
              </div>
            </div>
            {totals.invalidPlans && totals.invalidPlans.length > 0 && (
              <button
                type="button"
                onClick={() => setShowInvalidDetails(prev => !prev)}
                className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-[11px] font-medium text-amber-200 transition-colors shrink-0 cursor-pointer"
                aria-expanded={showInvalidDetails}
                aria-controls="planner-invalid-records-list"
              >
                {showInvalidDetails ? 'Hide Affected Records ▲' : 'View Affected Records ▼'}
              </button>
            )}
          </div>
          {showInvalidDetails && totals.invalidPlans && totals.invalidPlans.length > 0 && (
            <div id="planner-invalid-records-list" className="mt-3 pt-3 border-t border-amber-500/20 flex flex-col gap-1.5">
              <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold mb-0.5">
                Affected Characters & Weapons ({totals.invalidPlans.length}):
              </p>
              <ul className="space-y-1.5 pl-1 max-h-48 overflow-y-auto pr-1">
                {totals.invalidPlans.map((plan, idx) => (
                  <li key={`${plan.name}-${idx}`} className="flex flex-wrap items-baseline gap-1.5 text-[11px] bg-black/20 p-1.5 rounded border border-amber-500/15">
                    <span className="font-semibold text-amber-200 shrink-0">
                      {plan.isWeapon ? '🗡️' : '👤'} {plan.name}:
                    </span>
                    <span className="text-amber-300/80 break-words">{plan.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Consolidated Crafting Checklist ── */}
      <PlannerCraftingChecklist
        craftingPlan={craftingPlan}
        craftingMode={craftingMode}
        userMora={inventory?.['Mora'] ?? 0}
        progressionMora={remainingTotals.mora}
        craftingBonusOptions={craftingBonusOptions}
        bonusForecast={bonusForecast}
        inventory={inventory}
        grossRequirements={combinedTotals.totalCosts}
      />

      {/* ── Grand Total Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
        <PlannerStats
          icon={<img src="/Characters.png" alt="Active Character Plans" className="w-5 h-5 object-contain drop-shadow-sm" />}
          label="Active Character Plans"
          value={totals.activeCharacterPlans ?? totals.characterCount ?? 0}
          sub={
            (totals.activeWeaponPlans ?? totals.weaponCount ?? 0) > 0
              ? `+ ${totals.activeWeaponPlans ?? totals.weaponCount} weapon plan${(totals.activeWeaponPlans ?? totals.weaponCount) !== 1 ? 's' : ''}`
              : undefined
          }
          accent="#4EC9B0"
        />
        <PlannerStats
          icon={<img src="/CurrencyExp.png" alt="Total Mora" className="w-5 h-5 object-contain drop-shadow-sm" />}
          label="Total Mora"
          value={formatNumber(remainingTotals.mora)}
          sub={
            craftingMode === 'crafting-aware' && remainingTotals.craftingMora > 0
              ? (craftingBonusOptions.enabled && remainingTotals.estimatedMoraSavings > 0
                ? `+ ~${formatNumber(remainingTotals.estimatedCraftingMora)} crafting fee (${bonusForecast?.sameDemandCovered ? 'saves' : 'fee diff:'} ~${formatNumber(remainingTotals.estimatedMoraSavings)})`
                : `+ ${formatNumber(remainingTotals.craftingMora)} crafting fee`)
              : undefined
          }
          accent="#FAB632"
        />
        <PlannerStats icon={<img src="/CrownOfInsight.png" alt="Crowns Needed" className="w-5 h-5 object-contain drop-shadow-sm" />} label="Crowns Needed" value={remainingTotals.crowns} accent="#FBBF24"
          sub={remainingTotals.crowns > 0 ? 'Crown of Insight' : 'None needed'} />
        <PlannerStats
          icon="🎒"
          label={
            craftingMode === 'crafting-aware' && craftingBonusOptions.enabled
              ? 'Still to Farm (Est.)'
              : 'Still to Farm'
          }
          value={
            craftingMode === 'crafting-aware' && craftingBonusOptions.enabled
              ? toFarm.likelyAllDone && !toFarm.allDone
                ? '🎲 ~0'
                : `≈${formatNumber(Math.round(remainingTotals.sumItems))}`
              : formatNumber(remainingTotals.sumItems)
          }
          accent={
            toFarm.allDone
              ? '#4ADE80'
              : (craftingMode === 'crafting-aware' && craftingBonusOptions.enabled && toFarm.likelyAllDone)
              ? '#60A5FA'
              : '#F97316'
          }
          sub={
            toFarm.allDone
              ? (craftingMode === 'crafting-aware' && craftingPlan?.requiresCrafting ? '🔨 Covered by crafting!' : '✅ All stocked!')
              : (craftingMode === 'crafting-aware' && craftingBonusOptions.enabled && toFarm.likelyAllDone)
              ? `🎲 Likely covered with bonuses! (Guaranteed: ${formatNumber(remainingTotals.craftingAdjustedSumItems)})`
              : (craftingMode === 'crafting-aware' && craftingBonusOptions.enabled && remainingTotals.craftingAdjustedSumItems !== remainingTotals.sumItems)
              ? `Est. ≈${formatNumber(Math.round(remainingTotals.sumItems))} left (Guaranteed: ${formatNumber(remainingTotals.craftingAdjustedSumItems)})`
              : `${formatNumber(remainingTotals.sumItems)} materials left`
          }
        />
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
        craftingMode={craftingMode}
        craftingPlan={craftingPlan}
        craftingBonusOptions={craftingBonusOptions}
        bonusForecast={bonusForecast}
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

      {/* ── Ephemeral Crafting Session Drawer & Replacement Dialog ── */}
      <CraftingSessionDrawer
        liveInventory={inventory}
        liveGrossRequirements={combinedTotals.totalCosts}
        liveMora={inventory?.['Mora'] ?? 0}
      />
      <CraftingSessionReplacementModal />
    </div>
  );
}
