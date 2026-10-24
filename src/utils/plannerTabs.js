export const PLANNER_TABS = [
  { id: 'daily_action', label: 'Daily Action', icon: '📅' },
  { id: 'currency_exp', label: 'Currency & EXP', icon: '/CurrencyExp.png' },
  { id: 'normal_boss', label: 'Normal Boss', icon: '/NormalBoss.png' },
  { id: 'weekly_boss', label: 'Weekly Boss', icon: '/WeeklyBoss.png' },
  { id: 'talent', label: 'Talents', icon: '/TalentMats.png' },
  { id: 'common_enhancement', label: 'Common Mats', icon: '/CommonEnemy.png' },
  { id: 'elite_enhancement', label: 'Elite Mats', icon: '/EliteEnemy.png' },
  { id: 'weapon_ascension', label: 'Weapon Mats', icon: '/WeaponAscMats.png' },
  { id: 'local_specialty', label: 'Local Specialty', icon: '/LocalSpecialties.png' },
  { id: 'character_gem', label: 'Gems', icon: '/Gems.png' },
  { id: 'forging_materials', label: 'Forging Mats', icon: '/Forging.png' },
  { id: 'per_character', label: 'Characters', icon: '/Characters.png' },
  { id: 'per_weapon', label: 'Weapons', icon: '/Weapons.png' }
];

export function getPlannerTabId(tabParam) {
  if (!tabParam) return 'daily_action';
  const found = PLANNER_TABS.find((t) => t.id === tabParam);
  return found ? found.id : 'daily_action';
}

/**
 * Format a planner quantity:
 * - Uses thousands separators for numbers < 1,000,000 (e.g. 12,500, 1,234, 168)
 * - Uses compact formatting with 2 decimals for large numbers >= 1,000,000 (e.g. 42.59M, 299.15M, 1.00B)
 * - Returns '0' for null/undefined/NaN
 */
export function formatPlannerQuantity(qty) {
  if (qty == null || isNaN(Number(qty))) return '0';
  const n = Number(qty);
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  return n.toLocaleString();
}
