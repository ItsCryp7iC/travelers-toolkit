import React, { useState } from 'react';
import { formatNumber, formatItemName } from '../../utils/calculator';
import { formatPlannerQuantity } from '../../utils/plannerTabs';
import { isBonusEligibleCategory } from '../../data/craftingBonuses';

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
  craftingBonusOptions = null,
  bonusForecast = null,
  inventory = {},
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMathExplainer, setShowMathExplainer] = useState(false);

  if (craftingMode !== 'crafting-aware' || !craftingPlan || !craftingPlan.requiresCrafting) {
    return null;
  }

  const isBonusActive = Boolean(craftingBonusOptions?.enabled && bonusForecast);
  const bonusLabel =
    craftingBonusOptions?.bonusType === 'ingredient_refund'
      ? '25% Ingredient Refund'
      : '10% Double Output';

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

  const guaranteedCraftsCount = craftingPlan.craftingSteps.reduce((acc, s) => acc + s.count, 0);
  const totalProducedUnits = craftingPlan.craftingSteps.reduce(
    (acc, s) => acc + s.totalOutputProduced,
    0
  );
  const guaranteedMora = craftingPlan.craftingMora || 0;
  const effectiveMora = isBonusActive ? (bonusForecast?.estimatedTotalMora ?? guaranteedMora) : guaranteedMora;
  const moraSavings = isBonusActive ? (bonusForecast?.estimatedTotalMoraSavings ?? 0) : 0;
  const isAffordable = userMora >= effectiveMora;
  const totalCombinedMora = progressionMora + effectiveMora;
  const moraShortage = Math.max(0, effectiveMora - userMora);

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
              {isBonusActive && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <span>🎲</span>
                  <span>Bonus: {bonusLabel}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Upgrading lower-tier inventory yields{' '}
              <b className="text-emerald-400 font-semibold">{totalProducedUnits.toLocaleString()}</b> higher-tier{' '}
              {totalProducedUnits === 1 ? 'material' : 'materials'}, reducing farming needs.
              {isBonusActive && moraSavings > 0 && (
                <span className="text-blue-300 ml-1">
                  Estimated fee diff: ~<b>{moraSavings.toLocaleString()}</b> Mora
                  {bonusForecast?.sameDemandCovered ? ' (equivalent demand)' : ' (fulfills additional demand)'}.
                </span>
              )}
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
            <span>Fee: {isBonusActive ? `~${formatNumber(effectiveMora)}` : `${formatNumber(guaranteedMora)}`} Mora</span>
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
              <p className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider">
                {isBonusActive ? 'Estimated Crafting Fee' : '+ Additional Crafting'}
              </p>
              <p className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">
                +{formatPlannerQuantity(effectiveMora)}
                {isBonusActive && moraSavings > 0 && (
                  <span className="text-[10px] text-blue-300 font-normal ml-1">
                    (saves ~{formatPlannerQuantity(moraSavings)})
                  </span>
                )}
              </p>
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

                    const familyForecast = bonusForecast?.families?.[fam.familyId] || null;
                    const isEligible = isBonusActive && familyForecast?.isEligible;
                    const isLikelyCovered = isEligible && familyForecast.isLikelyCovered;

                    return (
                      <div
                        key={fam.familyId}
                        className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-amber-400/40 transition-colors flex flex-col justify-between gap-2.5"
                      >
                        {/* Family Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">
                              {fam.familyName}
                            </h4>
                            {isBonusActive && !isEligible && (
                              <span className="text-[10px] text-[var(--muted)]">
                                Ineligible category (No bonus applied)
                              </span>
                            )}
                            {isBonusActive && isLikelyCovered && familyForecast?.coverageDisplay && (
                              <p className="text-[10px] text-blue-300/80 mt-0.5">
                                {familyForecast.coverageDisplay}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                              isAllCovered
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : isLikelyCovered
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                            title={isLikelyCovered && familyForecast ? familyForecast.coverageDisplay : undefined}
                          >
                            {isAllCovered
                              ? '✅ Covered by crafting'
                              : isLikelyCovered
                              ? `🎲 Likely covered with ${craftingBonusOptions.bonusType === 'ingredient_refund' ? '25% Refund' : '10% Double'}`
                              : '🌾 Farming required'}
                          </span>
                        </div>

                        {/* Ordered Crafting Steps */}
                        <div className="space-y-2 text-xs bg-black/20 p-2.5 rounded-lg border border-white/5">
                          {fam.steps.map((step, idx) => {
                            const optStep = isEligible
                              ? familyForecast?.optimizedSteps?.find((s) => s.recipeId === step.recipeId)
                              : null;
                            const showBonusStep =
                              isBonusActive && isEligible && optStep && (optStep.expectedCrafts > 0 || step.count > 0);

                            if (!showBonusStep) {
                              return (
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
                              );
                            }

                            const isRefund = craftingBonusOptions.bonusType === 'ingredient_refund';
                            const inputQtyPerCraft = optStep.inputQty || 3;
                            const initialBatchCount = optStep.suggestedInitialBatch;
                            const initialIngredients = optStep.firstBatchIngredients ?? (initialBatchCount * inputQtyPerCraft);
                            const initialMora = optStep.firstBatchMora ?? (initialBatchCount * optStep.moraCostPerCraft);

                            const priorStepIndex = fam.steps.findIndex(
                              (s, sIdx) => sIdx < idx && s.outputItemId === step.inputItemId
                            );
                            const effectivePriorIndex = optStep.priorStepIndex ?? (priorStepIndex !== -1 ? priorStepIndex : null);
                            const isConditional = Boolean(optStep.isConditional || (priorStepIndex !== -1 && (inventory?.[step.inputItemId] ?? 0) < initialIngredients));
                            const ownedInput = optStep.currentlyOwnedIngredients ?? (inventory?.[step.inputItemId] ?? inventory?.[step.inputItemName] ?? 0);
                            const directReserved = optStep.directIngredientRequirement ?? 0;
                            const accessibleGuaranteed = optStep.accessibleIngredients ?? initialIngredients;

                            return (
                              <div
                                key={step.recipeId}
                                className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-2.5"
                                data-testid={`optimized-step-${step.recipeId}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-amber-400 font-mono text-xs font-bold">{idx + 1}.</span>
                                    <span className="font-bold text-gray-100 text-xs sm:text-sm truncate">
                                      {formatItemName(step.outputItemName)}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                                      ≈{Math.round(optStep.expectedCrafts).toLocaleString()} crafts
                                    </span>
                                  </div>
                                  <span className="text-amber-300 font-mono text-xs shrink-0 font-semibold">
                                    Est. fee ~{formatPlannerQuantity(optStep.expectedMoraCost)} Mora
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {/* Panel 1: Suggested First Batch */}
                                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                                        {isConditional && effectivePriorIndex !== null
                                          ? `Suggested 1st batch (after Step ${effectivePriorIndex + 1}):`
                                          : 'Suggested 1st batch:'}
                                      </span>
                                      {optStep.isActionFallback && (
                                        <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
                                          Finish craft
                                        </span>
                                      )}
                                    </div>
                                    {initialBatchCount > 0 ? (
                                      <ul className="text-[11px] text-amber-100/90 space-y-0.5 list-disc list-inside">
                                        <li>
                                          {isConditional ? (
                                            <>
                                              Craft <b className="text-white font-semibold">up to {initialBatchCount.toLocaleString()}×</b>{' '}
                                              <span className="text-[10px] text-amber-200/80">(based on guaranteed available ingredients)</span>
                                            </>
                                          ) : (
                                            <>
                                              Craft <b className="text-white font-semibold">{initialBatchCount.toLocaleString()}×</b>
                                            </>
                                          )}
                                        </li>
                                        <li>
                                          Use <b className="text-white font-semibold">{initialIngredients.toLocaleString()}×</b> {formatItemName(step.inputItemName)}
                                        </li>
                                        <li>
                                          Spend <b className="text-white font-semibold">{formatPlannerQuantity(initialMora)}</b> Mora
                                        </li>
                                      </ul>
                                    ) : (
                                      <div className="text-[11px] text-amber-200/90 py-1 space-y-1">
                                        <p className="font-semibold text-amber-300">0 crafts currently executable</p>
                                        {effectivePriorIndex !== null && (
                                          <p className="text-[10px] text-[var(--muted)]">
                                            Complete Step {effectivePriorIndex + 1} first to obtain required materials.
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {isConditional && effectivePriorIndex !== null ? (
                                      <p className="text-[10px] text-amber-200/90 italic pt-0.5">
                                        *Check your actual {formatItemName(step.inputItemName)} after Step {effectivePriorIndex + 1}. Bonus results may change this limit.*
                                      </p>
                                    ) : optStep.initialBatchNote ? (
                                      <p className="text-[10px] text-amber-200/80 italic pt-0.5">
                                        {optStep.initialBatchNote}
                                      </p>
                                    ) : null}
                                  </div>

                                  {/* Panel 2: Estimated Full Optimization */}
                                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
                                        Estimated full optimization:
                                      </span>
                                      <span className="text-[10px] text-[var(--muted)]">
                                        Guaranteed baseline: {step.count.toLocaleString()} crafts
                                      </span>
                                    </div>
                                    <ul className="text-[11px] text-gray-300 space-y-0.5 list-disc list-inside">
                                      <li>
                                        Approx. <b className="text-gray-100 font-semibold">≈{Math.round(optStep.expectedCrafts).toLocaleString()}</b> crafts
                                      </li>
                                      <li>
                                        Total output <b className="text-emerald-400 font-semibold">~{Math.round(optStep.expectedOutput).toLocaleString()}×</b> {formatItemName(step.outputItemName)}
                                        {optStep.expectedBonusOutput > 0 && (
                                          <span className="text-blue-300 text-[10px] ml-1">
                                            (+~{Math.round(optStep.expectedBonusOutput).toLocaleString()} bonus)
                                          </span>
                                        )}
                                      </li>
                                      <li>
                                        Consumes <b className="text-gray-100 font-semibold">~{Math.round(optStep.expectedGrossInputConsumed).toLocaleString()}×</b> {formatItemName(step.inputItemName)}
                                        {isRefund && optStep.expectedIngredientRefunds > 0 && (
                                          <span className="text-teal-300 text-[10px] ml-1">
                                            (net ~{Math.round(optStep.expectedNetInputConsumed).toLocaleString()})
                                          </span>
                                        )}
                                      </li>
                                    </ul>
                                  </div>
                                </div>

                                {isConditional && effectivePriorIndex !== null && (
                                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-1.5">
                                    <span className="shrink-0">⚠️</span>
                                    <div>
                                      <span className="font-semibold">Multi-stage dependency: </span>
                                      <span>
                                        Requires {initialIngredients.toLocaleString()}× {formatItemName(step.inputItemName)} for 1st batch, but only {ownedInput.toLocaleString()}× currently in inventory.
                                        {directReserved > 0 ? ` (${directReserved.toLocaleString()}× reserved for direct ascension).` : ''}
                                        {accessibleGuaranteed > 0 && ` Guaranteed available after Step ${effectivePriorIndex + 1}: ${accessibleGuaranteed.toLocaleString()}×.`}
                                        {' '}Complete Step {effectivePriorIndex + 1} crafts first, then check actual inventory before proceeding.
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {isBonusActive && isEligible && (
                            <p className="text-[10px] text-amber-300/80 italic pt-1 border-t border-white/5">
                              ⚠️ Check resulting materials after each batch. Random bonus outcomes can change the remaining quantity needed.
                            </p>
                          )}
                        </div>

                        {/* Footer Status & Leftovers */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--muted)] pt-1 border-t border-white/5">
                          <span>
                            Fee:{' '}
                            <b className="text-amber-300 font-semibold">
                              {isEligible && familyForecast.estimatedCraftingMora !== (fam.craftingMora || 0)
                                ? `~${Math.round(familyForecast.estimatedCraftingMora).toLocaleString()} Mora (Baseline: ${(fam.craftingMora || 0).toLocaleString()} Mora)`
                                : `${(fam.craftingMora || 0).toLocaleString()} Mora`}
                            </b>
                          </span>

                          {remainingShortages.length > 0 ? (
                            isLikelyCovered ? (
                              <span className="text-blue-300 font-medium">
                                Guaranteed shortage: {remainingShortages.map(([id, qty]) => `${qty}× ${formatItemName(id)}`).join(', ')} | Est. shortage: ~0
                              </span>
                            ) : isEligible && familyForecast.totalExpectedShortage < fam.totalShortage ? (
                              <span className="text-amber-300">
                                Est. need to farm: ~{familyForecast.totalExpectedShortage} (Guaranteed: {remainingShortages.map(([id, qty]) => `${qty}× ${formatItemName(id)}`).join(', ')})
                              </span>
                            ) : (
                              <span className="text-amber-300">
                                Still need to farm:{' '}
                                {remainingShortages
                                  .map(([id, qty]) => `${qty}× ${formatItemName(id)}`)
                                  .join(', ')}
                              </span>
                            )
                          ) : isEligible && familyForecast ? (
                            <div className="text-teal-300">
                              <span>
                                Est. leftover:{' '}
                                {Object.entries(familyForecast.expectedLeftovers || {})
                                  .filter(([_, qty]) => qty > 0)
                                  .map(([id, qty]) => `${Math.round(qty).toLocaleString()}× ${formatItemName(id)}`)
                                  .join(', ') || '0'}
                              </span>
                              {leftovers.length > 0 && (
                                <span className="text-[var(--muted)] text-[10px] ml-1.5">
                                  (Baseline: {leftovers.map(([id, qty]) => `${qty}× ${formatItemName(id)}`).join(', ')})
                                </span>
                              )}
                              {familyForecast.estimatedMoraDifference > 0 && (
                                <span className="text-blue-300 ml-1.5 font-medium">
                                  ({familyForecast.sameDemandCovered ? 'Saves' : 'Fee diff:'} ~{Math.round(familyForecast.estimatedMoraDifference).toLocaleString()} Mora)
                                </span>
                              )}
                            </div>
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

          {/* ── Mathematical Explainer Panel ── */}
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowMathExplainer((prev) => !prev)}
              className="text-[11px] font-semibold text-[var(--muted)] hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              aria-expanded={showMathExplainer}
            >
              <span>ℹ️</span>
              <span>How Crafting Bonus Forecasting Works</span>
              <span className="text-[10px]">{showMathExplainer ? '▲' : '▼'}</span>
            </button>
            {showMathExplainer && (
              <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] text-[var(--muted)] space-y-2">
                <p>
                  <b className="text-gray-200">Generic Alchemy Crafting Bonuses:</b> In Genshin Impact, players can select characters or mechanics that grant crafting bonuses at the alchemy crafting bench.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-300">
                  <li>
                    <b className="text-amber-300">10% Double Output:</b> Each craft has an independent 10% probability of duplicating the crafted product (+1 unit). Extra products cascade into higher tiers, reducing lower-tier material and Mora requirements.
                  </li>
                  <li>
                    <b className="text-amber-300">25% Ingredient Refund:</b> Each craft has an independent 25% probability of refunding 1 input ingredient. Refunded ingredients are recursively recycled into further crafting operations.
                  </li>
                </ul>
                <p>
                  <b className="text-gray-200">Deterministic Monte Carlo Model:</b> We simulate 500 adaptive crafting runs per material family with deterministic PRNG seeding to compute the exact expected shortage <span className="font-mono text-amber-200">E[max(0, required - produced)]</span>.
                </p>
                <p className="text-blue-300/90">
                  * Note: Guaranteed shortages are strictly preserved. Probabilistic forecasts do not change your actual inventory or guarantee in-game RNG outcomes. When all 500 simulated runs succeed, coverage probability is reported as &gt;99% estimate rather than absolute certainty.
                </p>
                <p className="text-blue-300/90">
                  * Note on Refunds: Ingredient refunds return raw materials to your inventory, not Mora. Any additional crafting operations utilizing refunded materials are charged standard alchemy crafting fees.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
