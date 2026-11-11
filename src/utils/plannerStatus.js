/**
 * Pure helper for computing family-level coverage and farming status in the Planner.
 *
 * Cases:
 * A. Already stocked: All direct requirements covered by existing inventory (owned >= required for all tiers).
 * B. Crafting required, no additional farming: Crafting-aware mode, not directly stocked, but guaranteed crafting covers all shortages.
 * C. Farming required: Positive effective farming shortage remains (applies to craftable, non-craftable, raw mode, multi-tier, single-tier).
 * D. Likely covered with bonuses: Active bonus forecast predicts 100% / likely coverage (~0 remaining farming), but guaranteed shortage > 0.
 * E. Farming reduced with bonus: Active bonus forecast reduces expected farming relative to guaranteed shortage, but does not eliminate it.
 * F. No demand: Total required across all tiers is 0 (returns null).
 * Non-farmable currency cards (Mora, EXP): Omit status badge (returns null).
 */

export function computeFamilyStatus({
  familyObj,
  familyData,
  items,
  globalCosts = {},
  inventory = {},
  craftingMode = 'crafting-aware',
  familyPlan = null,
  isBonusActive = false,
  familyForecast = null,
  craftingBonusOptions = null,
}) {
  if (!familyObj) return null;
  const tiers = familyData?.tiers || familyObj.familyData?.tiers;
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return null;

  // Non-farmable currency cards (Mora, EXP): omit farming status
  if (familyObj.type === 'currency') return null;

  // 1. Calculate requirements, inventory, and shortages across all tiers
  let totalRequired = 0;
  let hasAnyShortage = false;

  for (const tier of tiers) {
    const itemObj = items?.[tier.id]?.item;
    let required = globalCosts[tier.id] ?? 0;
    if (itemObj && typeof itemObj.required === 'number') {
      required = itemObj.required;
    }
    const owned = inventory[tier.id] ?? 0;
    const directShortage = Math.max(0, required - owned);

    totalRequired += required;

    if (directShortage > 0) {
      hasAnyShortage = true;
    }
  }

  // Case F: No progression demand across the family
  if (totalRequired === 0) {
    return null;
  }

  // Case A: Already stocked directly
  // All relevant direct material requirements are covered by existing inventory
  if (!hasAnyShortage) {
    return {
      label: 'Already stocked',
      bg: 'rgba(74, 222, 128, 0.15)',
      text: '#4ADE80',
      border: 'rgba(74, 222, 128, 0.3)',
      icon: '✅',
    };
  }

  // If in 'raw' mode, crafting-aware and bonus optimizations are disabled
  if (craftingMode === 'raw') {
    return {
      label: 'Farming required',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    };
  }

  // 2. Crafting-Aware Mode
  const isCraftable = Boolean(familyPlan && familyPlan.isCraftable);

  // Case B: Crafting required, no additional farming
  // Raw inventory does not directly cover requirements, but guaranteed crafting plan does
  if (isCraftable && familyPlan.allCoveredByCrafting) {
    return {
      label: 'Crafting required — No additional farming',
      bg: 'rgba(78, 201, 176, 0.15)',
      text: '#4EC9B0',
      border: 'rgba(78, 201, 176, 0.3)',
      icon: '🔨',
    };
  }

  // Case D: Likely covered with bonuses
  // Eligible bonus forecast predicts coverage (estimated farming ~ 0), but guaranteed shortages remain positive
  if (isBonusActive && familyForecast?.isLikelyCovered) {
    const bonusName =
      craftingBonusOptions?.bonusType === 'ingredient_refund'
        ? '25% Refund'
        : '10% Double';
    return {
      label: `Likely covered with ${bonusName}`,
      bg: 'rgba(96, 165, 250, 0.15)',
      text: '#60A5FA',
      border: 'rgba(96, 165, 250, 0.3)',
      icon: '🎲',
    };
  }

  // Case E: Farming reduced with bonus
  // Bonus reduces expected farming compared to guaranteed shortage, but does not eliminate it
  if (
    isBonusActive &&
    familyForecast &&
    typeof familyForecast.totalExpectedShortage === 'number' &&
    typeof familyPlan?.totalShortage === 'number' &&
    familyForecast.totalExpectedShortage < familyPlan.totalShortage
  ) {
    return {
      label: 'Farming reduced with bonus',
      bg: 'rgba(249, 115, 22, 0.15)',
      text: '#F97316',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🌾',
    };
  }

  // Case C: Farming required
  // Positive effective farming shortage remains (covers craftable, non-craftable, single-tier, multi-tier)
  return {
    label: 'Farming required',
    bg: 'rgba(249, 115, 22, 0.15)',
    text: '#F97316',
    border: 'rgba(249, 115, 22, 0.3)',
    icon: '🌾',
  };
}

