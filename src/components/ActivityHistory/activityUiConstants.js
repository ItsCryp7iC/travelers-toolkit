/**
 * Traveler's Toolkit — Activity History UI Constants
 * Authoritative specification: docs/activity-history-architecture.md
 */

export const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Categories' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'characters', label: 'Characters' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'import_sync', label: 'Imports & Sync' },
  { id: 'settings_system', label: 'Settings & System' },
  { id: 'goals', label: 'Goals' },
];

export const CATEGORY_METADATA = {
  inventory: {
    label: 'Inventory',
    icon: '🎒',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  characters: {
    label: 'Characters',
    icon: '👤',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  weapons: {
    label: 'Weapons',
    icon: '⚔️',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  achievements: {
    label: 'Achievements',
    icon: '🏆',
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  },
  crafting: {
    label: 'Crafting',
    icon: '🧪',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  import_sync: {
    label: 'Imports & Sync',
    icon: '🔄',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  settings_system: {
    label: 'Settings & System',
    icon: '⚙️',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
  goals: {
    label: 'Goals',
    icon: '🎯',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

export const ACTION_LABELS = {
  inventory_updated: 'Inventory Updated',
  inventory_incremented: 'Inventory Incremented',
  inventory_decremented: 'Inventory Decremented',
  inventory_bulk_updated: 'Inventory Bulk Updated',
  character_added: 'Character Added',
  character_removed: 'Character Removed',
  character_updated: 'Character Updated',
  characters_batch_added: 'Characters Batch Added',
  characters_batch_removed: 'Characters Batch Removed',
  characters_bulk_updated: 'Characters Bulk Updated',
  weapon_added: 'Weapon Added',
  weapon_removed: 'Weapon Removed',
  weapon_updated: 'Weapon Updated',
  weapons_batch_added: 'Weapons Batch Added',
  weapons_batch_removed: 'Weapons Batch Removed',
  weapons_bulk_updated: 'Weapons Bulk Updated',
  weapon_assigned: 'Weapon Assigned',
  weapon_unassigned: 'Weapon Unassigned',
  achievement_completed: 'Achievement Completed',
  achievement_uncompleted: 'Achievement Uncompleted',
  achievements_imported_replace: 'Achievements Imported (Replace)',
  achievements_imported_merge: 'Achievements Imported (Merge)',
  achievements_cleared: 'Achievements Cleared',
  achievements_stage_cascade: 'Achievement Stage Cascade',
  crafting_transaction_applied: 'Crafting Completed',
  crafting_transaction_uncertain: 'Crafting Uncertain',
  good_import_applied: 'GOOD Import Applied',
  local_backup_restored: 'Local Backup Restored',
  cloud_backup_restored: 'Cloud Backup Restored',
  hoyolab_character_sync_applied: 'HoYoLAB Sync Applied',
  cloud_backup_created: 'Cloud Backup Completed',
  cloud_backup_failed: 'Cloud Backup Failed',
  activity_history_imported: 'Activity History Imported',
  server_region_changed: 'Server Region Changed',
  display_timezone_changed: 'Display Timezone Changed',
  auto_backup_toggled: 'Auto Backup Toggled',
  db_builder_toggled: 'Database Builder Toggled',
  factory_reset_performed: 'Factory Reset',
  goal_added: 'Goal Added',
  goal_updated: 'Goal Updated',
  goal_removed: 'Goal Removed',
};

export const SOURCE_LABELS = {
  inventory_page: 'Inventory Page',
  inventory_stepper: 'Inventory Stepper',
  planner_inline: 'Resource Planner',
  character_modal: 'Character Modal',
  characters_table: 'Characters Table',
  character_bulk_edit: 'Bulk Edit Characters',
  armory_modal: 'Armory Modal',
  weapons_table: 'Weapons Table',
  weapons_bulk_edit: 'Bulk Edit Weapons',
  achievements_page: 'Achievements Page',
  achievements_settings: 'Achievement Settings',
  crafting_results_modal: 'Crafting Results',
  settings_good_import: 'GOOD Import',
  settings_backup: 'Settings Backup',
  settings_cloud_sync: 'Cloud Sync',
  settings_preferences: 'Settings Preferences',
  hoyolab_character_sync: 'HoYoLAB Sync',
  dashboard_quick_add: 'Dashboard Quick Add',
  activity_history_import: 'History Import',
  system: 'System',
};

export const DATE_RANGE_OPTIONS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
];

export const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
];

export const PAGE_SIZE = 50;

