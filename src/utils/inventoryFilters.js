export const INVENTORY_TABS = [
  { id: 'all', label: 'All', icon: '/Inventory.png' },
  { id: 'currency_exp', label: 'Currency & Exp', icon: '/CurrencyExp.png' },
  { id: 'normal_boss', label: 'Normal Boss', icon: '/NormalBoss.png' },
  { id: 'weekly_boss', label: 'Weekly Boss', icon: '/WeeklyBoss.png' },
  { id: 'talent_mats', label: 'Talent Mats', icon: '/TalentMats.png' },
  { id: 'common_mats', label: 'Common Mats', icon: '/CommonEnemy.png' },
  { id: 'elite_mats', label: 'Elite Mats', icon: '/EliteEnemy.png' },
  { id: 'weapon_asc', label: 'Weapon Asc', icon: '/WeaponAscMats.png' },
  { id: 'local_spec', label: 'Local Spec', icon: '/LocalSpecialties.png' },
  { id: 'character_gems', label: 'Character Gems', icon: '/Gems.png' },
  { id: 'billet', label: 'Billet', icon: '/Forging.png' },
  { id: 'forging_ore', label: 'Forging Ore', icon: '/Forging.png' },
];

export const INVENTORY_TAB_CONFIG = {
  all: {
    label: 'All',
    filter: () => true
  },
  currency_exp: {
    label: 'Currency & Exp',
    filter: (mat) => mat.category === 'Currency' || mat.category === 'Experience'
  },
  normal_boss: {
    label: 'Normal Boss',
    filter: (mat) => mat.subCategory === 'Normal Boss'
  },
  weekly_boss: {
    label: 'Weekly Boss',
    filter: (mat) => mat.subCategory === 'Weekly Boss'
  },
  talent_mats: {
    label: 'Talent Mats',
    filter: (mat) => mat.category === 'Talent Materials'
  },
  common_mats: {
    label: 'Common Mats',
    filter: (mat) => mat.subCategory === 'Common Enhancement Material'
  },
  elite_mats: {
    label: 'Elite Mats',
    filter: (mat) => mat.subCategory === 'Elite Enhancement Material'
  },
  weapon_asc: {
    label: 'Weapon Asc',
    filter: (mat) => mat.category === 'Weapon Ascension Material'
  },
  local_spec: {
    label: 'Local Spec',
    filter: (mat) => mat.category === 'Local Specialty'
  },
  character_gems: {
    label: 'Character Gems',
    filter: (mat) => mat.category === 'Character Ascension Gem'
  },
  billet: {
    label: 'Billet',
    filter: (mat) => mat.subCategory === 'Billet'
  },
  forging_ore: {
    label: 'Forging Ore',
    filter: (mat) => mat.subCategory === 'Forging Ore'
  }
};

export function getInventoryTabId(tabParam) {
  // Legacy mappings
  if (tabParam === 'boss_drops') return 'normal_boss';
  if (tabParam === 'enemy_drops') return 'common_mats';
  if (tabParam === 'forging_mats') return 'billet';

  // Fallback to default if totally invalid
  if (!tabParam || !INVENTORY_TAB_CONFIG[tabParam]) {
    return 'currency_exp';
  }

  return tabParam;
}

export function filterMaterialsByTab(materials, tabId) {
  const config = INVENTORY_TAB_CONFIG[tabId];
  if (!config) return [];
  return materials.filter(config.filter);
}

export function formatInventoryQuantity(qty) {
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
