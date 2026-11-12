/**
 * Traveler's Toolkit — Activity History Type Definitions
 * Authoritative specification: docs/activity-history-architecture.md
 */

export const ACTIVITY_STORAGE_KEY = 'travelers-toolkit-activity-log' as const;
export const ACTIVITY_SCHEMA_VERSION = 1 as const;
export const MAX_ACTIVITY_EVENT_COUNT = 1000 as const;
export const MAX_ACTIVITY_SERIALIZED_BYTES = 768000 as const; // 750 KiB
export const TARGET_MAX_EVENT_BYTES = 4096 as const; // 4 KiB
export const MAX_TRUNCATED_CHANGES_COUNT = 50 as const;

export type ActivityCategory =
  | 'inventory'
  | 'characters'
  | 'weapons'
  | 'achievements'
  | 'crafting'
  | 'import_sync'
  | 'settings_system'
  | 'goals';

export type ActivityEntityType =
  | 'material'
  | 'character'
  | 'weapon'
  | 'achievement'
  | 'crafting_transaction'
  | 'backup'
  | 'sync_session'
  | 'setting'
  | 'goal';

export type ActivitySource =
  | 'inventory_page'
  | 'inventory_stepper'
  | 'planner_inline'
  | 'character_modal'
  | 'characters_table'
  | 'character_bulk_edit'
  | 'armory_modal'
  | 'weapons_table'
  | 'weapons_bulk_edit'
  | 'achievements_page'
  | 'achievements_settings'
  | 'crafting_results_modal'
  | 'settings_good_import'
  | 'settings_backup'
  | 'settings_cloud_sync'
  | 'settings_preferences'
  | 'hoyolab_character_sync'
  | 'dashboard_quick_add'
  | 'activity_history_import'
  | 'system';

export type ActivityAction =
  // Inventory
  | 'inventory_updated'
  | 'inventory_incremented'
  | 'inventory_decremented'
  | 'inventory_bulk_updated'
  // Characters
  | 'character_added'
  | 'character_removed'
  | 'character_updated'
  | 'characters_batch_added'
  | 'characters_batch_removed'
  | 'characters_bulk_updated'
  // Weapons
  | 'weapon_added'
  | 'weapon_removed'
  | 'weapon_updated'
  | 'weapons_batch_added'
  | 'weapons_batch_removed'
  | 'weapons_bulk_updated'
  | 'weapon_assigned'
  | 'weapon_unassigned'
  // Achievements
  | 'achievement_completed'
  | 'achievement_uncompleted'
  | 'achievements_imported_replace'
  | 'achievements_imported_merge'
  | 'achievements_cleared'
  | 'achievements_stage_cascade'
  // Crafting
  | 'crafting_transaction_applied'
  | 'crafting_transaction_uncertain'
  // Imports & Sync
  | 'good_import_applied'
  | 'local_backup_restored'
  | 'cloud_backup_restored'
  | 'hoyolab_character_sync_applied'
  | 'cloud_backup_created'
  | 'cloud_backup_failed'
  | 'activity_history_imported'
  // Settings & System
  | 'server_region_changed'
  | 'display_timezone_changed'
  | 'auto_backup_toggled'
  | 'db_builder_toggled'
  | 'factory_reset_performed'
  // Goals
  | 'goal_added'
  | 'goal_updated'
  | 'goal_removed';

export interface FieldChange {
  /** Property or field path that changed (e.g. 'quantity', 'level', 'targetLevel') */
  field: string;
  /** Human-readable field label (e.g. 'Level', 'Normal Attack') */
  label?: string;
  /** Value prior to mutation */
  before: unknown;
  /** Value following mutation */
  after: unknown;
  /** Formatted difference (e.g. '+1,089', '-14,400') */
  delta?: string | number;
}

export interface ActivityEvent {
  /** Unique UUID v4 for the event */
  id: string;
  /** Event schema version */
  schemaVersion: 1;
  /** Canonical ISO-8601 UTC timestamp */
  timestamp: string;
  /** High-level operational category */
  category: ActivityCategory;
  /** Specific action performed */
  action: ActivityAction;
  /** Component or workflow where the change originated */
  source: ActivitySource;
  /** Canonical entity type classification */
  entityType?: ActivityEntityType;
  /** Canonical entity identity */
  entityId?: string;
  /** Canonical human-readable entity display name */
  entityName?: string;
  /** Concise, human-readable summary of the committed change */
  summary: string;
  /** Granular before/after differences for affected fields */
  changes?: FieldChange[];
  /** Domain-specific structured metadata */
  metadata?: Record<string, unknown>;
  /** Associated transaction ID for crafting or bulk transactions */
  transactionId?: string;
  /** Indicates if field-level changes were truncated due to per-event size limits */
  truncated?: boolean;
}

export interface ActivityStorageEnvelope {
  schemaVersion: 1;
  lastUpdated: string;
  events: ActivityEvent[];
}

export interface ActivityHistoryExportPayloadV1 {
  app: 'travelers-toolkit';
  format: 'travelers-toolkit-activity-history';
  schemaVersion: 1;
  exportedAt: string;
  eventCount: number;
  events: ActivityEvent[];
}

export type RecordActivityStatus =
  | 'recorded'
  | 'duplicate_ignored'
  | 'invalid_rejected'
  | 'storage_unavailable'
  | 'quota_exceeded'
  | 'serialization_error'
  | 'persistence_error';

export interface RecordActivityResult {
  success: boolean;
  status: RecordActivityStatus;
  eventId?: string;
  message?: string;
  error?: unknown;
}

export interface SetEventsFromImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  addedCount: number;
  deduplicatedCount: number;
  invalidCount: number;
  prunedCount: number;
  retainedCount: number;
  error?: unknown;
}

export interface ActivityStorageStatus {
  eventCount: number;
  serializedBytes: number;
  maxEventCount: number;
  maxSerializedBytes: number;
  lastPruneTimestamp: string | null;
  persistenceErrorCount: number;
  corruptedEntriesRecovered: number;
  schemaVersion: number;
}

export interface ActivityEventInput {
  id?: string;
  timestamp?: string;
  category: ActivityCategory;
  action: ActivityAction;
  source: ActivitySource;
  entityType?: ActivityEntityType;
  entityId?: string;
  entityName?: string;
  summary: string;
  changes?: FieldChange[];
  metadata?: Record<string, unknown>;
  transactionId?: string;
}
