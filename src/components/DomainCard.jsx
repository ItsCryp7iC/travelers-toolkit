import React, { useState } from 'react'
import { toPascalCase } from '../utils/assetHelper'
import { formatItemName } from '../utils/calculator'
import { formatPlannerQuantity } from '../utils/plannerTabs'
import { getFamilyForMaterial } from '../data/craftingRecipes'
import useCraftingSessionStore from '../store/useCraftingSessionStore'

const RARITY_COLORS = {
  5: '#D87A34',
  4: '#9370DB',
  3: '#4A9EFF',
  2: '#6B8E23',
  1: '#808080'
}

export default function DomainCard({
  domainName,
  familyObj,
  accent,
  globalCosts,
  inventory,
  itemFolder = "weapon_ascension_materials",
  craftingMode = 'crafting-aware',
  craftingPlan = null,
  craftingBonusOptions = null,
  bonusForecast = null,
}) {
  const [expandedCrafting, setExpandedCrafting] = useState(false);
  const activeFamilyId = useCraftingSessionStore((s) => s.session?.snapshot?.familyId);
  const startSession = useCraftingSessionStore((s) => s.startSession);
  const openDrawer = useCraftingSessionStore((s) => s.openDrawer);

  const { familyName, familyData, items, neededBy } = familyObj;

  const chars = neededBy?.filter(e => e.type === 'character') || [];
  const weaps = neededBy?.filter(e => e.type === 'weapon') || [];

  if (!familyData || !familyData.tiers) return null;

  // Resolve family plan and bonus forecast for craftable families
  const familyKeyCandidate = familyData?.familyId || familyObj.familyId || familyObj.familyKey;
  let resolvedFamilyId = familyKeyCandidate;
  if (!resolvedFamilyId && familyData.tiers?.[0]?.id) {
    const fam = getFamilyForMaterial(familyData.tiers[0].id);
    if (fam) resolvedFamilyId = fam.familyId;
  }
  const familyPlan = craftingPlan?.families?.[resolvedFamilyId] || familyObj.craftingPlan || null;
  const familyForecast = bonusForecast?.families?.[resolvedFamilyId] || null;
  const isBonusActive =
    craftingMode === 'crafting-aware' &&
    Boolean(craftingBonusOptions?.enabled) &&
    Boolean(familyForecast?.isEligible);

  const isFamilyActiveSession = Boolean(resolvedFamilyId && activeFamilyId === resolvedFamilyId);
  const canCraftFamily = Boolean(resolvedFamilyId && familyPlan && familyPlan.isCraftable && familyPlan.requiresCrafting);

  const handleSessionAction = () => {
    if (!resolvedFamilyId) return;
    if (isFamilyActiveSession) {
      openDrawer();
    } else {
      startSession({
        familyId: resolvedFamilyId,
        inventory,
        grossRequirements: globalCosts,
        bonusType: craftingBonusOptions?.enabled ? craftingBonusOptions.bonusType : null,
        startingMora: inventory?.['Mora'] ?? 0,
      });
    }
  };

  // Compute family-level crafting status pill
  let familyStatusPill = null;
  if (craftingMode === 'crafting-aware' && familyPlan && familyPlan.isCraftable) {
    if (familyPlan.allDirectlyStocked) {
      familyStatusPill = {
        label: 'Already stocked',
        bg: 'rgba(74, 222, 128, 0.15)',
        text: '#4ADE80',
        border: 'rgba(74, 222, 128, 0.3)',
        icon: '✅'
      };
    } else if (familyPlan.requiresCrafting && familyPlan.allCoveredByCrafting) {
      familyStatusPill = {
        label: 'Crafting required — No additional farming',
        bg: 'rgba(78, 201, 176, 0.15)',
        text: '#4EC9B0',
        border: 'rgba(78, 201, 176, 0.3)',
        icon: '🔨'
      };
    } else if (isBonusActive && familyForecast?.isLikelyCovered) {
      const bonusName = craftingBonusOptions.bonusType === 'ingredient_refund' ? '25% Refund' : '10% Double';
      familyStatusPill = {
        label: `Likely covered with ${bonusName}`,
        bg: 'rgba(96, 165, 250, 0.15)',
        text: '#60A5FA',
        border: 'rgba(96, 165, 250, 0.3)',
        icon: '🎲'
      };
    } else if (familyPlan.requiresCrafting && !familyPlan.allCoveredByCrafting) {
      familyStatusPill = {
        label: isBonusActive && familyForecast && familyForecast.totalExpectedShortage < familyPlan.totalShortage
          ? 'Farming reduced with bonus'
          : 'Farming required',
        bg: 'rgba(249, 115, 22, 0.15)',
        text: '#F97316',
        border: 'rgba(249, 115, 22, 0.3)',
        icon: '🌾'
      };
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors overflow-hidden relative group">
      {/* Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" style={{ background: accent }} />

      {/* Header */}
      <div
        className="px-3 py-2 border-b border-[var(--border)] flex flex-col gap-1.5"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <span className="text-xs shrink-0 mt-0.5" aria-hidden="true">
              {familyObj.type === 'weekly_boss'
                ? '👑'
                : familyObj.type === 'world_boss'
                ? '🐉'
                : familyObj.type === 'elite_mob'
                ? '🛡️'
                : familyObj.type === 'gemstones'
                ? '💎'
                : '🏛️'}
            </span>
            <span
              className="text-xs font-bold tracking-wider uppercase text-[var(--muted)] leading-snug break-words"
              title={
                ['weekly_boss', 'world_boss', 'elite_mob', 'gemstones', 'currency'].includes(familyObj.type)
                  ? domainName
                  : `Domain: ${domainName}`
              }
            >
              {['weekly_boss', 'world_boss', 'elite_mob', 'gemstones', 'currency'].includes(familyObj.type)
                ? domainName
                : `Domain: ${domainName}`}
            </span>
          </div>
          {canCraftFamily && (
            <button
              type="button"
              onClick={handleSessionAction}
              id={`domain-crafting-session-btn-${resolvedFamilyId}`}
              data-testid={`domain-crafting-session-btn-${resolvedFamilyId}`}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                isFamilyActiveSession
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-xs font-bold'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30'
              }`}
              title={
                isFamilyActiveSession
                  ? 'Continue active crafting session'
                  : 'Start an interactive crafting session'
              }
            >
              <span aria-hidden="true">🔨</span>
              <span>{isFamilyActiveSession ? 'Continue' : 'Start'}</span>
            </button>
          )}
        </div>
        {familyStatusPill && (
          <div className="flex items-center min-w-0">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border max-w-full truncate"
              style={{
                background: familyStatusPill.bg,
                color: familyStatusPill.text,
                borderColor: familyStatusPill.border,
              }}
              title={familyStatusPill.label}
            >
              <span className="shrink-0" aria-hidden="true">{familyStatusPill.icon}</span>
              <span className="truncate">{familyStatusPill.label}</span>
            </span>
          </div>
        )}
      </div>

      {/* Body: Tier List */}
      <div className="p-3 space-y-2.5 flex-1">
        {familyData.tiers.map(tier => {
          const itemObj = items[tier.id]?.item;
          let required = globalCosts[tier.id] ?? 0;
          if (itemObj) {
            required = itemObj.required ?? globalCosts[tier.id] ?? 0;
          }
          const owned = inventory[tier.id] ?? 0;
          const directShortage = Math.max(0, required - owned);
          const guaranteedShortage =
            itemObj?.guaranteedToFarm ??
            itemObj?.craftingAdjustedToFarm ??
            (familyPlan?.adjustedShortages?.[tier.id] ?? directShortage);
          const expectedShortage =
            isBonusActive && familyForecast?.expectedShortages?.[tier.id] !== undefined
              ? familyForecast.expectedShortages[tier.id]
              : (itemObj?.expectedShortage ?? guaranteedShortage);

          const toFarm = craftingMode === 'raw'
            ? directShortage
            : (isBonusActive ? expectedShortage : guaranteedShortage);

          let craftQuantity = 0;
          if (craftingMode === 'crafting-aware') {
            if (itemObj && typeof itemObj.craftQuantity === 'number') {
              craftQuantity = itemObj.craftQuantity;
            } else if (familyPlan?.steps) {
              const step = familyPlan.steps.find((s) => s.outputItemId === tier.id);
              if (step) craftQuantity = step.totalOutputProduced;
            }
          }

          const optStep = isBonusActive
            ? (familyForecast?.optimizedSteps?.find((s) => s.outputItemId === tier.id) || itemObj?.optimizedStep || null)
            : null;
          const isOptimized = Boolean(isBonusActive && optStep);
          const displayCraftCount = isOptimized
            ? Math.round(optStep.expectedCrafts ?? craftQuantity)
            : craftQuantity;
          const expectedOutput = isOptimized
            ? (optStep.expectedOutput ?? craftQuantity)
            : craftQuantity;
          const hasCrafting = craftingMode === 'crafting-aware' && (isOptimized ? displayCraftCount > 0 : craftQuantity > 0);

          if (required === 0 && owned === 0 && familyObj.type !== 'currency') return null;

          const isFullyCovered = craftingMode === 'crafting-aware'
            ? guaranteedShortage === 0
            : (required > 0 && owned >= required);
          const isLikelyCoveredTier =
            isBonusActive && guaranteedShortage > 0 && expectedShortage === 0;

          const percent = required > 0
            ? (isFullyCovered ? 100 : Math.min(100, (owned / required) * 100))
            : (owned > 0 ? 100 : 0);
          const rarityColor = RARITY_COLORS[tier.rarity] || RARITY_COLORS[3];

          return (
            <div
              key={tier.id}
              className="flex flex-col gap-2 p-2.5 rounded-lg bg-black/15 border border-white/5 hover:border-white/10 transition-colors"
            >
              {/* Row 1: Material Identity */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: rarityColor }}
                  aria-hidden="true"
                />
                <img
                  src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/${itemFolder}/${toPascalCase(tier.name)}.png`}
                  alt={tier.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-md shrink-0"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                  }}
                />
                <span className="hidden text-xl shrink-0" aria-hidden="true">📦</span>
                <span
                  className="text-xs sm:text-sm font-semibold leading-snug break-words flex-1 min-w-0"
                  style={{ color: rarityColor }}
                  title={formatItemName(tier.name)}
                >
                  {formatItemName(tier.name)}
                </span>
              </div>

              {/* Row 2: 3-Column Statistics Grid */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {/* Need */}
                <div
                  className="flex flex-col items-center justify-center py-1 px-1.5 rounded bg-black/25 border border-white/5 min-w-0"
                  title={`Need: ${(required || 0).toLocaleString()}`}
                >
                  <span className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider truncate w-full">
                    Need<span className="sr-only">: </span>
                  </span>
                  <span className="font-bold text-[var(--text)] text-xs sm:text-sm truncate w-full">
                    {formatPlannerQuantity(required)}
                  </span>
                </div>

                {/* Have */}
                <div
                  className="flex flex-col items-center justify-center py-1 px-1.5 rounded bg-black/25 border border-white/5 min-w-0"
                  title={`Have: ${(owned || 0).toLocaleString()}`}
                >
                  <span className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider truncate w-full">
                    Have<span className="sr-only">: </span>
                  </span>
                  <span className="font-bold text-[var(--text)] text-xs sm:text-sm truncate w-full">
                    {formatPlannerQuantity(owned)}
                  </span>
                </div>

                {/* To Farm */}
                <div
                  className="flex flex-col items-center justify-center py-1 px-1.5 rounded bg-black/25 border border-white/5 min-w-0"
                  title={
                    isBonusActive && expectedShortage !== guaranteedShortage
                      ? `Est. To Farm: ${expectedShortage} (Guaranteed: ${guaranteedShortage})`
                      : `To Farm: ${(toFarm || 0).toLocaleString()}`
                  }
                >
                  <span className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider truncate w-full">
                    To Farm<span className="sr-only">: </span>
                  </span>
                  <span
                    className="font-bold text-xs sm:text-sm truncate w-full"
                    style={{
                      color: isFullyCovered
                        ? 'var(--muted)'
                        : isLikelyCoveredTier
                        ? '#60A5FA'
                        : toFarm > 0
                        ? accent
                        : 'var(--muted)',
                    }}
                  >
                    {isLikelyCoveredTier ? (
                      <span title={`Guaranteed shortage: ${guaranteedShortage}`}>🎲 ~0</span>
                    ) : isBonusActive && expectedShortage !== guaranteedShortage ? (
                      <span title={`Guaranteed shortage: ${guaranteedShortage}`}>~{formatPlannerQuantity(toFarm)}</span>
                    ) : (
                      formatPlannerQuantity(toFarm)
                    )}
                  </span>
                </div>
              </div>

              {/* Row 3: Crafting Indicator (when applicable) */}
              {hasCrafting && (
                <div
                  className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20"
                  title={
                    isOptimized
                      ? `Est. craft operations: ≈${displayCraftCount.toLocaleString()} (Guaranteed: ${craftQuantity.toLocaleString()}) | Est. output: ~${Math.round(expectedOutput).toLocaleString()}`
                      : `Recommended craft: ${craftQuantity.toLocaleString()}`
                  }
                >
                  <span aria-hidden="true">🔨</span>
                  <span>Craft: </span>
                  <span className="font-bold text-amber-300">
                    {isOptimized
                      ? `≈${formatPlannerQuantity(displayCraftCount)}`
                      : `+${formatPlannerQuantity(craftQuantity)}`}
                  </span>
                </div>
              )}

              {/* Row 4: Subtle Progress Indicator */}
              <div className="h-1 bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)] relative">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all"
                  style={{
                    width: `${percent}%`,
                    background: isFullyCovered
                      ? '#4ADE80'
                      : isLikelyCoveredTier
                      ? '#60A5FA'
                      : rarityColor,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Expandable Per-Family Crafting Instructions */}
      {craftingMode === 'crafting-aware' && familyPlan && familyPlan.steps && familyPlan.steps.length > 0 && (
        <div className="px-3 pb-3 border-t border-[var(--border)] pt-2.5 bg-black/10">
          <button
            type="button"
            onClick={() => setExpandedCrafting((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer py-1"
            aria-expanded={expandedCrafting}
          >
            <span className="flex items-center gap-1.5">
              <span>🔨</span>
              <span>Crafting Instructions ({familyPlan.steps.length} step{familyPlan.steps.length !== 1 ? 's' : ''})</span>
            </span>
            <span className="text-[11px] text-[var(--muted)] flex items-center gap-1">
              <span>
                Fee:{' '}
                {isBonusActive && familyForecast && familyForecast.estimatedCraftingMora !== familyPlan.craftingMora
                  ? `~${Math.round(familyForecast.estimatedCraftingMora).toLocaleString()} Mora`
                  : `${(familyPlan.craftingMora || 0).toLocaleString()} Mora`}
              </span>
              <span>{expandedCrafting ? '▲' : '▼'}</span>
            </span>
          </button>

          {expandedCrafting && (
            <div className="mt-2 space-y-2 text-xs bg-black/25 p-2.5 rounded-lg border border-white/5">
              {familyPlan.steps.map((step, idx) => {
                const optStep = isBonusActive && familyForecast?.optimizedSteps
                  ? familyForecast.optimizedSteps.find((s) => s.recipeId === step.recipeId)
                  : null;
                const showBonus = Boolean(isBonusActive && optStep);

                const isRefund = craftingBonusOptions?.bonusType === 'ingredient_refund';
                const inputQtyPerCraft = optStep?.inputQty || 3;
                const initialBatchCount = optStep?.suggestedInitialBatch || 0;
                const initialIngredients = optStep?.firstBatchIngredients ?? (initialBatchCount * inputQtyPerCraft);
                const initialMora = optStep?.firstBatchMora ?? (initialBatchCount * (optStep?.moraCostPerCraft || (step.totalMoraCost / (step.count || 1))));

                const priorStepIndex = familyPlan.steps.findIndex(
                  (s, sIdx) => sIdx < idx && s.outputItemId === step.inputItemId
                );
                const effectivePriorIndex = optStep?.priorStepIndex ?? (priorStepIndex !== -1 ? priorStepIndex : null);
                const isConditional = Boolean(optStep?.isConditional || (priorStepIndex !== -1 && (inventory?.[step.inputItemId] ?? 0) < initialIngredients));

                return (
                  <div key={step.recipeId} className="flex flex-col gap-1 border-b border-white/5 last:border-b-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between font-medium text-gray-200">
                      <span>
                        {idx + 1}. Craft{' '}
                        <b className="text-emerald-400">
                          {showBonus ? `~${Math.round(optStep.expectedOutput).toLocaleString()}` : step.totalOutputProduced.toLocaleString()}
                        </b>{' '}
                        {formatItemName(step.outputItemName)}
                        {showBonus && (
                          <span className="text-[10px] text-blue-300 font-normal ml-1">
                            (≈{Math.round(optStep.expectedCrafts).toLocaleString()} crafts)
                          </span>
                        )}
                      </span>
                      <span className="text-amber-300 text-[11px]">
                        {showBonus
                          ? `Est. fee ~${formatPlannerQuantity(optStep.expectedMoraCost)} Mora`
                          : `${(step.totalMoraCost || 0).toLocaleString()} Mora`}
                      </span>
                    </div>

                    {showBonus ? (
                      <div className="text-[11px] space-y-0.5">
                        <p className="text-amber-200/90 font-medium">
                          • {isConditional && effectivePriorIndex !== null
                            ? `Suggested 1st batch (after Step ${effectivePriorIndex + 1}): Up to ${initialBatchCount.toLocaleString()}× crafts (uses ${initialIngredients.toLocaleString()}× ${formatItemName(step.inputItemName)}, ${formatPlannerQuantity(initialMora)} Mora)`
                            : `Suggested 1st batch: Craft ${initialBatchCount.toLocaleString()}× (uses ${initialIngredients.toLocaleString()}× ${formatItemName(step.inputItemName)}, ${formatPlannerQuantity(initialMora)} Mora)`}
                        </p>
                        <p className="text-[var(--muted)]">
                          • Est. full plan: ~{Math.round(optStep.expectedGrossInputConsumed).toLocaleString()}× {formatItemName(step.inputItemName)} consumed
                          {isRefund && optStep.expectedIngredientRefunds > 0 && ` (net ~${Math.round(optStep.expectedNetInputConsumed).toLocaleString()})`}
                          {' '}(Baseline: {step.count.toLocaleString()} crafts)
                        </p>
                        {isConditional && effectivePriorIndex !== null && (
                          <p className="text-[10px] text-amber-300/90 italic">
                            *Check your actual {formatItemName(step.inputItemName)} after Step {effectivePriorIndex + 1}. Bonus results may change this limit.*
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted)]">
                        Use {step.totalInputConsumed.toLocaleString()}× {formatItemName(step.inputItemName)}
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="pt-1.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--muted)]">
                <span>
                  Total Fee:{' '}
                  <b className="text-amber-300">
                    {isBonusActive && familyForecast && familyForecast.estimatedCraftingMora !== familyPlan.craftingMora
                      ? `~${Math.round(familyForecast.estimatedCraftingMora).toLocaleString()} Mora (Baseline: ${(familyPlan.craftingMora || 0).toLocaleString()} Mora)`
                      : `${(familyPlan.craftingMora || 0).toLocaleString()} Mora`}
                  </b>
                </span>
                {(() => {
                  if (isBonusActive && familyForecast?.expectedLeftovers) {
                    const estLeftovers = Object.entries(familyForecast.expectedLeftovers)
                      .filter(([_, qty]) => qty > 0)
                      .map(([id, qty]) => `${Math.round(qty).toLocaleString()} ${formatItemName(familyData.tiers.find((t) => t.id === id)?.name || id)}`);
                    if (estLeftovers.length === 0) return null;
                    return (
                      <span className="text-teal-300">
                        Est. leftover: {estLeftovers.join(', ')}
                        {familyForecast.estimatedMoraDifference > 0 && (
                          <span className="text-blue-300 ml-1">
                            ({familyForecast.sameDemandCovered ? 'saves' : 'fee diff:'} ~{Math.round(familyForecast.estimatedMoraDifference).toLocaleString()} Mora)
                          </span>
                        )}
                      </span>
                    );
                  }
                  const leftovers = Object.entries(familyPlan.projectedInventory || {})
                    .filter(([_, qty]) => qty > 0)
                    .map(([id, qty]) => `${qty.toLocaleString()} ${formatItemName(familyData.tiers.find((t) => t.id === id)?.name || id)}`);
                  if (leftovers.length === 0) return null;
                  return (
                    <span className="text-teal-300">
                      Projected leftover: {leftovers.join(', ')}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer (Needed By) */}
      {(chars.length > 0 || weaps.length > 0) && (
        <div className="px-3 pb-3 mt-auto">
          <div className="h-px w-full bg-[var(--border)] mb-2 opacity-50" />
          <p className="text-xs font-semibold tracking-widest text-[var(--muted)] uppercase mb-1.5">Needed By</p>
          <div>
            {chars.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {chars.map((entity, i) => (
                  <div key={`char-${i}`} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                    <img
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/characters/${toPascalCase(entity.name)}.png`}
                      alt={entity.name}
                      title={entity.name}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs z-0" title={entity.name}>👤</div>
                  </div>
                ))}
              </div>
            )}

            {weaps.length > 0 && (
              <div className={`flex flex-wrap gap-1 ${chars.length > 0 ? 'mt-2' : ''}`}>
                {weaps.map((entity, i) => (
                  <div key={`weap-${i}`} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                    <img
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/weapons/${toPascalCase(entity.name)}.png`}
                      alt={entity.name}
                      title={entity.name}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs z-0" title={entity.name}>👤</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
