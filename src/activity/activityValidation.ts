/**
 * Traveler's Toolkit — Activity Event Validation, Sanitization, and Sizing
 * Authoritative specification: docs/activity-history-architecture.md
 */

import {
  ActivityEvent,
  ActivityCategory,
  ActivityAction,
  ActivitySource,
  ActivityEntityType,
  FieldChange,
  TARGET_MAX_EVENT_BYTES,
  MAX_TRUNCATED_CHANGES_COUNT,
  ACTIVITY_SCHEMA_VERSION,
} from './activityTypes';

export const VALID_CATEGORIES: ReadonlySet<ActivityCategory> = new Set([
  'inventory',
  'characters',
  'weapons',
  'achievements',
  'crafting',
  'import_sync',
  'settings_system',
  'goals',
]);

export const VALID_SOURCES: ReadonlySet<ActivitySource> = new Set([
  'inventory_page',
  'inventory_stepper',
  'planner_inline',
  'character_modal',
  'characters_table',
  'character_bulk_edit',
  'armory_modal',
  'weapons_table',
  'weapons_bulk_edit',
  'achievements_page',
  'achievements_settings',
  'crafting_results_modal',
  'settings_good_import',
  'settings_backup',
  'settings_cloud_sync',
  'settings_preferences',
  'hoyolab_character_sync',
  'dashboard_quick_add',
  'activity_history_import',
  'system',
]);

export const VALID_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  'inventory_updated',
  'inventory_incremented',
  'inventory_decremented',
  'inventory_bulk_updated',
  'character_added',
  'character_removed',
  'character_updated',
  'characters_batch_added',
  'characters_batch_removed',
  'characters_bulk_updated',
  'weapon_added',
  'weapon_removed',
  'weapon_updated',
  'weapons_batch_added',
  'weapons_batch_removed',
  'weapons_bulk_updated',
  'weapon_assigned',
  'weapon_unassigned',
  'achievement_completed',
  'achievement_uncompleted',
  'achievements_imported_replace',
  'achievements_imported_merge',
  'achievements_cleared',
  'achievements_stage_cascade',
  'crafting_transaction_applied',
  'crafting_transaction_uncertain',
  'good_import_applied',
  'local_backup_restored',
  'cloud_backup_restored',
  'hoyolab_character_sync_applied',
  'cloud_backup_created',
  'cloud_backup_failed',
  'activity_history_imported',
  'server_region_changed',
  'display_timezone_changed',
  'auto_backup_toggled',
  'db_builder_toggled',
  'factory_reset_performed',
  'goal_added',
  'goal_removed',
]);

export const VALID_ENTITY_TYPES: ReadonlySet<ActivityEntityType> = new Set([
  'material',
  'character',
  'weapon',
  'achievement',
  'crafting_transaction',
  'backup',
  'sync_session',
  'setting',
  'goal',
]);

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY_REGEX =
  /token|auth|cookie|password|secret|credential|header|session_id|ltoken|ltuid|bearer/i;

/**
 * Calculates exact serialized UTF-8 byte consumption for a string or object.
 */
export function getSerializedByteSize(data: unknown): number {
  if (data === null || data === undefined) return 0;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  if (typeof Blob !== 'undefined') {
    return new Blob([str]).size;
  }
  // Fallback for environments lacking TextEncoder and Blob
  return unescape(encodeURIComponent(str)).length;
}

export function isValidUUID(id: unknown): boolean {
  return typeof id === 'string' && UUID_V4_REGEX.test(id);
}

export function isValidISOTimestamp(ts: unknown): boolean {
  if (typeof ts !== 'string') return false;
  const parsed = Date.parse(ts);
  if (isNaN(parsed)) return false;
  // Verify standard ISO format (YYYY-MM-DDTHH:mm:ss...)
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(ts);
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_REGEX.test(key);
}

/**
 * Recursively sanitizes metadata by omitting any keys that resemble sensitive credentials.
 */
export function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (isSensitiveKey(k)) continue;
    if (typeof v === 'function' || typeof v === 'symbol' || v === undefined)
      continue;

    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const sanitizedSub = sanitizeMetadata(v as Record<string, unknown>);
      if (sanitizedSub && Object.keys(sanitizedSub).length > 0) {
        clean[k] = sanitizedSub;
      }
    } else if (Array.isArray(v)) {
      clean[k] = v.filter(
        (item) =>
          typeof item !== 'function' &&
          typeof item !== 'symbol' &&
          item !== undefined
      );
    } else {
      clean[k] = v;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Validates a single field change, suppressing identical before/after values.
 */
export function validateFieldChange(raw: unknown): FieldChange | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.field !== 'string' || !c.field.trim()) return null;

  // Suppress no-op field changes where values are strictly equal
  if (c.before === c.after && c.before !== undefined) {
    return null;
  }

  const result: FieldChange = {
    field: c.field.trim(),
    before: c.before,
    after: c.after,
  };

  if (typeof c.label === 'string' && c.label.trim()) {
    result.label = c.label.trim();
  }
  if (typeof c.delta === 'string' || typeof c.delta === 'number') {
    result.delta = c.delta;
  }

  return result;
}

export interface EventValidationResult {
  isValid: boolean;
  event?: ActivityEvent;
  error?: string;
}

/**
 * Defensive runtime validation for ActivityEvent records.
 */
export function validateActivityEvent(raw: unknown): EventValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { isValid: false, error: 'Event must be a non-null object.' };
  }

  const e = raw as Record<string, unknown>;

  // 1. Mandatory Identity and Version
  if (!isValidUUID(e.id)) {
    return {
      isValid: false,
      error: `Invalid or missing event ID (expected UUID v4): "${String(e.id)}".`,
    };
  }

  if (e.schemaVersion !== ACTIVITY_SCHEMA_VERSION) {
    return {
      isValid: false,
      error: `Unsupported schema version: ${String(e.schemaVersion)}.`,
    };
  }

  // 2. Mandatory Timestamp
  if (!isValidISOTimestamp(e.timestamp)) {
    return {
      isValid: false,
      error: `Invalid ISO-8601 timestamp: "${String(e.timestamp)}".`,
    };
  }

  // 3. Category, Action, Source
  if (!VALID_CATEGORIES.has(e.category as ActivityCategory)) {
    return {
      isValid: false,
      error: `Invalid category: "${String(e.category)}".`,
    };
  }

  if (!VALID_ACTIONS.has(e.action as ActivityAction)) {
    return { isValid: false, error: `Invalid action: "${String(e.action)}".` };
  }

  if (!VALID_SOURCES.has(e.source as ActivitySource)) {
    return { isValid: false, error: `Invalid source: "${String(e.source)}".` };
  }

  // 4. Summary
  if (typeof e.summary !== 'string' || !e.summary.trim()) {
    return {
      isValid: false,
      error: 'Event summary must be a non-empty string.',
    };
  }

  // 5. Optional Entity Fields
  const entityType = VALID_ENTITY_TYPES.has(e.entityType as ActivityEntityType)
    ? (e.entityType as ActivityEntityType)
    : undefined;

  const entityId =
    typeof e.entityId === 'string' && e.entityId.trim()
      ? e.entityId.trim()
      : undefined;
  const entityName =
    typeof e.entityName === 'string' && e.entityName.trim()
      ? e.entityName.trim()
      : undefined;
  const transactionId =
    typeof e.transactionId === 'string' && e.transactionId.trim()
      ? e.transactionId.trim()
      : undefined;

  // 6. Optional Structured Changes
  let changes: FieldChange[] | undefined = undefined;
  if (Array.isArray(e.changes)) {
    const validChanges = e.changes
      .map(validateFieldChange)
      .filter((c): c is FieldChange => c !== null);
    if (validChanges.length > 0) {
      changes = validChanges;
    }
  }

  // 7. Optional Metadata (sanitized)
  const metadata = sanitizeMetadata(
    e.metadata as Record<string, unknown> | undefined
  );

  const event: ActivityEvent = {
    id: e.id as string,
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    timestamp: e.timestamp as string,
    category: e.category as ActivityCategory,
    action: e.action as ActivityAction,
    source: e.source as ActivitySource,
    summary: e.summary.trim(),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(entityName ? { entityName } : {}),
    ...(transactionId ? { transactionId } : {}),
    ...(changes ? { changes } : {}),
    ...(metadata ? { metadata } : {}),
    ...(e.truncated ? { truncated: true } : {}),
  };

  return { isValid: true, event };
}

/**
 * Truncates non-mandatory field details if an event payload exceeds the target per-event cap.
 * Invariant: Mandatory fields (id, timestamp, category, action, source, summary, transactionId)
 * are NEVER truncated.
 */
export function truncateEventPayload(
  event: ActivityEvent,
  targetMaxBytes = TARGET_MAX_EVENT_BYTES
): ActivityEvent {
  const currentBytes = getSerializedByteSize(event);
  if (currentBytes <= targetMaxBytes) {
    return event;
  }

  const copy: ActivityEvent = { ...event };

  // Step 1: Truncate changes array to MAX_TRUNCATED_CHANGES_COUNT if larger
  if (copy.changes && copy.changes.length > MAX_TRUNCATED_CHANGES_COUNT) {
    const totalCount = copy.changes.length;
    copy.changes = copy.changes.slice(0, MAX_TRUNCATED_CHANGES_COUNT);
    copy.truncated = true;
    copy.metadata = {
      ...(copy.metadata || {}),
      totalChangesCount: totalCount,
      recordedChangesCount: MAX_TRUNCATED_CHANGES_COUNT,
    };
  }

  // Step 2: If still oversized, progressively reduce changes
  if (
    getSerializedByteSize(copy) > targetMaxBytes &&
    copy.changes &&
    copy.changes.length > 10
  ) {
    const totalCount =
      (copy.metadata?.totalChangesCount as number) || copy.changes.length;
    copy.changes = copy.changes.slice(0, 10);
    copy.truncated = true;
    copy.metadata = {
      ...(copy.metadata || {}),
      totalChangesCount: totalCount,
      recordedChangesCount: 10,
    };
  }

  // Step 3: If still oversized, drop changes entirely while preserving metadata & summary
  if (getSerializedByteSize(copy) > targetMaxBytes && copy.changes) {
    const totalCount =
      (copy.metadata?.totalChangesCount as number) || copy.changes.length;
    delete copy.changes;
    copy.truncated = true;
    copy.metadata = {
      ...(copy.metadata || {}),
      totalChangesCount: totalCount,
      recordedChangesCount: 0,
    };
  }

  return copy;
}

/**
 * Deterministic chronological comparison:
 * Primary: Timestamp ascending (older first).
 * Secondary: UUID string comparison (stable tie-breaker).
 */
export function compareEventsChronologically(
  a: ActivityEvent,
  b: ActivityEvent
): number {
  const timeA = Date.parse(a.timestamp);
  const timeB = Date.parse(b.timestamp);
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.id.localeCompare(b.id);
}
