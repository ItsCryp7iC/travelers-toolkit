import React, { useState } from 'react';
import { formatNumber, formatItemName } from '../../utils/calculator';
import { formatPlannerQuantity } from '../../utils/plannerTabs';

const CATEGORY_LABELS = {
  talent_materials: 'Talent Books',
  weapon_ascension: 'Weapon Ascension Materials',
  common_enemy: 'Common Enemy Drops',
  elite_enemy: 'Elite Enemy Drops',
  character_gems: 'Character Ascension Gems',
};

const CATEGORY_ICONS = {
  talent_materials: '📚',
  weapon_ascension: '🗡️',
  common_enemy: '👾',
  elite_enemy: '🛡️',
  character_gems: '💎',
};

export default function PlannerCraftingChecklist({
  craftingPlan,
  craftingMode = 'crafting-aware',
  userMora = 0,
  progressionMora = 0,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (craftingMode !== 'crafting-aware' || !craftingPlan || !craftingPlan.requiresCrafting) {
    return null;
  }

  const activeFamilies = Object.values(craftingPlan.families || {}).filter(
    (f) => f.steps && f.steps.length > 0
  );

  if (activeFamilies.length === 0) return null;

  // Group active families by category
  const groupedByCategory = {};
  activeFamilies.forEach((familyPlan) => {
    const cat = familyPlan.category || 'other';
    if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
    groupedByCategory[cat].push(familyPlan);
  });

  const totalCraftsCount = craftingPlan.craftingSteps.reduce((acc, s) => acc + s.count, 0);
  const totalProducedUnits = craftingPlan.craftingSteps.reduce(
    (acc, s) => acc + s.totalOutputProduced,
    0
  );
  const craftingMora = craftingPlan.craftingMora || 0;
  const isAffordable = craftingPlan.isAffordableMora !== false;
  const totalCombinedMora = progressionMora + craftingMora;
  const moraShortage = Math.max(0, craftingMora - userMora);

  return (
    <div
      className="mb-4 sm:mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-surface to-bg-base shadow-sm overflow-hidden"
      data-testid="planner-crafting-checklist"
    >
      {/* ── Summary Header ── */}
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shrink-0">
            🔨
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text)] tracking-tight">
                Consolidated Crafting Checklist
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {activeFamilies.length} {activeFamilies.length === 1 ? 'family' : 'families'} •{' '}
                {craftingPlan.craftingSteps.length} {craftingPlan.craftingSteps.length === 1 ? 'recipe' : 'recipes'}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Upgrading lower-tier inventory yields{' '}
              <b className="text-emerald-400 font-semibold">{totalProducedUnits.toLocaleString()}</b> higher-tier{' '}
              {totalProducedUnits === 1 ? 'material' : 'materials'}, reducing farming needs.
            </p>
          </div>
        </div>

        {/* ── Actions & Mora Pill ── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end md:self-auto flex-wrap">
          <div
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
              isAffordable
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
            title={
              isAffordable
                ? `Owned Mora (${userMora.toLocaleString()}) covers alchemy fees`
                : `Short by ${moraShortage.toLocaleString()} Mora to execute all crafts`
            }
          >
            <span>{isAffordable ? '💰' : '⚠️'}</span>
            <span>Fee: {formatNumber(craftingMora)} Mora</span>
            {!isAffordable && <span className="text-[10px] opacity-90 hidden sm:inline">(Short)</span>}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 transition-colors cursor-pointer flex items-center gap-1.5"
            aria-expanded={isExpanded}
            aria-controls="planner-crafting-checklist-body"
            id="toggle-crafting-checklist-btn"
          >
            <span>{isExpanded ? 'Hide Checklist' : 'View Full Checklist'}</span>
            <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* ── Collapsible Body ── */}
      {isExpanded && (
        <div id="planner-crafting-checklist-body" className="border-t border-amber-500/20 p-3.5 sm:p-4 bg-black/20 space-y-4">
          {/* Mora Reconciliation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
              <p className="text-[10px] text-[var(--muted)] uppercase font-semibold tracking-wider">Progression Mora</p>
              <p className="text-xs sm:text-sm font-bold text-gray-200 mt-0.5">{formatPlannerQuantity(progressionMora)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-amber-500/20">
              <p className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider">+ Additional Crafting</p>
              <p className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">+{formatPlannerQuantity(craftingMora)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
              <p className="text-[10px] text-[var(--muted)] uppercase font-semibold tracking-wider">Combined Total Mora</p>
              <p className="text-xs sm:text-sm font-bold text-amber-200 mt-0.5">{formatPlannerQuantity(totalCombinedMora)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
              <p className="text-[10px] text-[var(--muted)] uppercase font-semibold tracking-wider">Owned Inventory Mora</p>
              <p className={`text-xs sm:text-sm font-bold mt-0.5 ${isAffordable ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formatPlannerQuantity(userMora)}
              </p>
            </div>
          </div>

          {/* Families List Grouped by Category */}
          <div className="space-y-4 pt-1">
            {Object.entries(groupedByCategory).map(([category, families]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  <span>{CATEGORY_ICONS[category] || '📦'}</span>
                  <span>{CATEGORY_LABELS[category] || category}</span>
                  <span className="text-[11px] font-normal lowercase opacity-75">
                    ({families.length} {families.length === 1 ? 'family' : 'families'})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {families.map((fam) => {
                    const isAllCovered = fam.allCoveredByCrafting;
                    const remainingShortages = Object.entries(fam.adjustedShortages || {})
                      .filter(([_, qty]) => qty > 0);
                    const leftovers = Object.entries(fam.projectedInventory || {})
                      .filter(([_, qty]) => qty > 0);

                    return (
                      <div
                        key={fam.familyId}
                        className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-amber-400/40 transition-colors flex flex-col justify-between gap-2.5"
                      >
                        {/* Family Header */}
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">
                            {fam.familyName}
                          </h4>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isAllCovered
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isAllCovered ? '✅ Covered by crafting' : '🌾 Farming required'}
                          </span>
                        </div>

                        {/* Ordered Crafting Steps */}
                        <div className="space-y-1.5 text-xs bg-black/20 p-2 rounded-lg border border-white/5">
                          {fam.steps.map((step, idx) => (
                            <div key={step.recipeId} className="flex items-start justify-between gap-2 text-[11px]">
                              <div className="min-w-0">
                                <span className="text-[var(--muted)] font-mono mr-1.5">{idx + 1}.</span>
                                <span>
                                  Craft <b className="text-emerald-400">{step.totalOutputProduced.toLocaleString()}×</b>{' '}
                                  {formatItemName(step.outputItemName)}
                                </span>
                                <span className="text-[var(--muted)] ml-1">
                                  (uses {step.totalInputConsumed.toLocaleString()}× {formatItemName(step.inputItemName)})
                                </span>
                              </div>
                              <span className="text-amber-300 shrink-0 font-medium font-mono">
                                {formatPlannerQuantity(step.totalMoraCost)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Footer Status & Leftovers */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--muted)] pt-1 border-t border-white/5">
                          <span>
                            Fee: <b className="text-amber-300 font-semibold">{fam.craftingMora.toLocaleString()} Mora</b>
                          </span>

                          {remainingShortages.length > 0 ? (
                            <span className="text-amber-300">
                              Still need to farm:{' '}
                              {remainingShortages
                                .map(([id, qty]) => `${qty}× ${formatItemName(id)}`)
                                .join(', ')}
                            </span>
                          ) : leftovers.length > 0 ? (
                            <span className="text-teal-300">
                              Leftover: {leftovers.map(([id, qty]) => `${qty}× ${formatItemName(id)}`).join(', ')}
                            </span>
                          ) : (
                            <span className="text-emerald-400">Zero material leftover</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

