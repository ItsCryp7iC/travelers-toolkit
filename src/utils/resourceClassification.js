/**
 * resourceClassification.js — Explicit Resource and Metric Classification Contract
 *
 * Distinguishes between:
 * 1. Genuine resource quantities (consumable items with inventory presence: Mora, Ores, Ascension/Talent materials, Drops)
 * 2. Informational metrics & diagnostics (total_exp, exp_to_next_level, wasted_exp, calculation flags)
 */

export const INFORMATIONAL_METRIC_KEYS = new Set([
  'total_exp',
  'totalExp',
  'exp_to_next_level',
  'expToNextLevel',
  'wasted_exp',
  'wastedExp',
  'has_ascension_discount',
  'hasAscensionDiscount',
  'discount_source',
  'discountSource',
  'has_event_bonus',
  'hasEventBonus',
  'effective_exp',
  'effectiveExp',
  'isInvalid',
  'invalidReason',
  'level',
  'currentLevel',
  'targetLevel',
  'ascension',
  'currentAscension',
  'targetAscension',
]);

/**
 * Returns true if the key is a known informational metric or diagnostic flag.
 * @param {string} key
 * @returns {boolean}
 */
export function isInformationalMetric(key) {
  if (!key || typeof key !== 'string') return false;
  return INFORMATIONAL_METRIC_KEYS.has(key);
}

/**
 * Returns true if the key represents a genuine inventory resource.
 * @param {string} key
 * @returns {boolean}
 */
export function isGenuineResourceKey(key) {
  if (!key || typeof key !== 'string') return false;
  return !INFORMATIONAL_METRIC_KEYS.has(key);
}

/**
 * Filters a raw cost object to retain only genuine material/currency quantities.
 * Preserves unexpected keys so that new materials are never silently ignored.
 *
 * @param {Object} costObj
 * @returns {Object}
 */
export function filterResourceCosts(costObj) {
  if (!costObj || typeof costObj !== 'object') return {};
  const filtered = {};
  for (const [key, val] of Object.entries(costObj)) {
    if (!isInformationalMetric(key) && typeof val === 'number' && val > 0) {
      filtered[key] = val;
    }
  }
  return filtered;
}

