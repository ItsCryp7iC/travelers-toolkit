/**
 * Traveler's Toolkit — Planner Surplus Accounting Utilities
 * Phase PLANNER-UI-R3 / PLANNER-UI-R3.1
 *
 * Pure, deterministic helpers for computing raw extra surplus,
 * retrieving guaranteed unallocated planning leftovers, and resolving
 * the dynamic third statistics cell presentation.
 */

import { formatPlannerQuantity } from './plannerTabs';

/**
 * Calculates raw surplus for a material:
 * materials owned beyond direct progression requirements, before accounting for crafting allocations.
 *
 * Formula: Math.max(0, owned - required)
 *
 * @param {number|unknown} owned Current quantity in inventory
 * @param {number|unknown} required Direct progression requirement
 * @returns {number} Non-negative integer surplus
 */
export function calculateRawSurplus(owned, required) {
  const normOwned =
    typeof owned === 'number' && Number.isFinite(owned)
      ? Math.max(0, Math.floor(owned))
      : 0;

  const normRequired =
    typeof required === 'number' && Number.isFinite(required)
      ? Math.max(0, Math.floor(required))
      : 0;

  return Math.max(0, normOwned - normRequired);
}

/**
 * Retrieves the unallocated quantity remaining after a guaranteed crafting plan has been allocated.
 * Sourced directly from familyPlan.projectedInventory[materialId].
 *
 * Returns null if familyPlan or projectedInventory is missing or invalid.
 * Does NOT synthesize a fabricated zero when projection data is unavailable.
 *
 * @param {object|null|undefined} familyPlan The family crafting plan computed by allocateFamilyCrafting()
 * @param {string} materialId Canonical material ID
 * @returns {number|null} Unallocated non-negative integer quantity or null
 */
export function getGuaranteedUnallocatedQuantity(familyPlan, materialId) {
  if (!familyPlan || typeof familyPlan !== 'object') return null;
  if (!familyPlan.projectedInventory || typeof familyPlan.projectedInventory !== 'object') return null;
  if (!materialId || typeof materialId !== 'string') return null;

  const val = familyPlan.projectedInventory[materialId];
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;

  return Math.max(0, Math.floor(val));
}

/**
 * Formats an accessible tooltip/title for the Extra statistic.
 *
 * @param {object} params
 * @param {number} params.rawExtra The calculated raw surplus
 * @param {number} params.owned Current owned quantity
 * @param {number} params.required Current required quantity
 * @param {boolean} [params.isCraftable=false] Whether the material belongs to a craftable family
 * @returns {string} Accessible description string
 */
export function formatSurplusTitle({ rawExtra, owned, required, isCraftable = false }) {
  if (rawExtra <= 0) return '';

  const normOwned =
    typeof owned === 'number' && Number.isFinite(owned)
      ? Math.max(0, Math.floor(owned))
      : 0;

  const normRequired =
    typeof required === 'number' && Number.isFinite(required)
      ? Math.max(0, Math.floor(required))
      : 0;

  if (normRequired === 0) {
    return `No current plan requires this item. All ${formatPlannerQuantity(normOwned)} owned are surplus.`;
  }

  if (isCraftable) {
    return 'Extra before crafting. Some materials may be needed for higher-tier crafting.';
  }

  return 'Materials owned beyond current progression requirements.';
}

/**
 * Resolves the presentation of the dynamic third statistics cell (PLANNER-UI-R3.1).
 *
 * Selects presentation according to priority:
 * 1. Case A: Positive effective shortage remains (label: 'To Farm', value: formatted shortage, color: accent)
 * 2. Case B: Bonus-likely coverage (guaranteed > 0, expected === 0) (label: 'To Farm', value: '🎲 ~0', color: '#60A5FA')
 * 3. Case C: Positive raw surplus (no effective shortage & rawExtra > 0) (label: 'Extra', value: `+${formatPlannerQuantity(rawExtra)}`, color: '#34D399')
 * 4. Case D: Sufficiently covered (no shortage & rawExtra === 0) (label: 'To Farm', value: '0', color: 'var(--muted)')
 *
 * @param {object} params
 * @param {number|unknown} params.required Progression requirement
 * @param {number|unknown} params.owned Current inventory quantity
 * @param {number|unknown} params.toFarm Effective shortage to farm
 * @param {number|unknown} [params.guaranteedShortage] Shortage from guaranteed crafting plan
 * @param {number|unknown} [params.expectedShortage] Shortage from bonus forecast
 * @param {boolean} [params.isBonusActive=false] Whether crafting bonus is enabled
 * @param {boolean} [params.isCraftable=false] Whether material belongs to a craftable family
 * @param {string} [params.accent='var(--gold)'] Card accent color for shortage
 * @returns {object} { label, formattedValue, rawValue, color, isExtra, isLikelyCovered, title, rawExtra }
 */
export function getThirdCellPresentation({
  required = 0,
  owned = 0,
  toFarm = 0,
  guaranteedShortage = 0,
  expectedShortage = 0,
  isBonusActive = false,
  isCraftable = false,
  accent = 'var(--gold)',
}) {
  const normOwned =
    typeof owned === 'number' && Number.isFinite(owned)
      ? Math.max(0, Math.floor(owned))
      : 0;

  const normRequired =
    typeof required === 'number' && Number.isFinite(required)
      ? Math.max(0, Math.floor(required))
      : 0;

  const rawExtra = calculateRawSurplus(normOwned, normRequired);

  // A positive fractional or integer shortage must strictly remain a shortage.
  const isShortage = typeof toFarm === 'number' && Number.isFinite(toFarm) && toFarm > 0;

  const isLikelyCovered = Boolean(
    isBonusActive &&
      typeof guaranteedShortage === 'number' &&
      guaranteedShortage > 0 &&
      expectedShortage === 0
  );

  // ── Priority 1: Case A — Farming shortage remains ──
  if (isShortage) {
    const isEstimatedDiff = Boolean(
      isBonusActive &&
        typeof expectedShortage === 'number' &&
        typeof guaranteedShortage === 'number' &&
        expectedShortage !== guaranteedShortage
    );

    const formattedValue = isEstimatedDiff
      ? `~${formatPlannerQuantity(toFarm)}`
      : formatPlannerQuantity(toFarm);

    let title = isEstimatedDiff
      ? `Est. To Farm: ${expectedShortage} (Guaranteed: ${guaranteedShortage})`
      : `To Farm: ${(toFarm || 0).toLocaleString()}`;

    if (rawExtra > 0) {
      title += ` (Raw extra: +${formatPlannerQuantity(rawExtra)})`;
    }

    const innerTitle = isEstimatedDiff ? `Guaranteed shortage: ${guaranteedShortage}` : undefined;

    return {
      label: 'To Farm',
      formattedValue,
      rawValue: toFarm,
      color: accent || 'var(--gold)',
      isExtra: false,
      isLikelyCovered: false,
      title,
      innerTitle,
      rawExtra,
    };
  }

  // ── Priority 2: Case B — Bonus-likely coverage ──
  if (isLikelyCovered) {
    return {
      label: 'To Farm',
      formattedValue: '🎲 ~0',
      rawValue: 0,
      color: '#60A5FA',
      isExtra: false,
      isLikelyCovered: true,
      title: `Guaranteed shortage: ${guaranteedShortage}`,
      innerTitle: `Guaranteed shortage: ${guaranteedShortage}`,
      rawExtra,
    };
  }

  // ── Priority 3: Case C — Positive raw surplus ──
  if (rawExtra > 0) {
    let title;
    if (normRequired === 0) {
      title = `No current plan requires this item. All ${formatPlannerQuantity(normOwned)} owned are surplus.`;
    } else if (isCraftable) {
      title = 'Extra before crafting. Some materials may be needed for higher-tier crafting.';
    } else {
      title = 'Materials owned beyond current progression requirements.';
    }

    return {
      label: 'Extra',
      formattedValue: `+${formatPlannerQuantity(rawExtra)}`,
      rawValue: rawExtra,
      color: '#34D399',
      isExtra: true,
      isLikelyCovered: false,
      title,
      rawExtra,
    };
  }

  // ── Priority 4: Case D — No shortage and no surplus ──
  return {
    label: 'To Farm',
    formattedValue: '0',
    rawValue: 0,
    color: 'var(--muted)',
    isExtra: false,
    isLikelyCovered: false,
    title: 'To Farm: 0',
    rawExtra: 0,
  };
}

export { getThirdCellPresentation as resolveThirdCellPresentation };
