/**
 * Traveler's Toolkit — Activity History Standalone Interchange (Import/Export)
 * Authoritative specification: docs/activity-history-architecture.md
 */

import {
  ActivityEvent,
  ActivityHistoryExportPayloadV1,
  ACTIVITY_SCHEMA_VERSION,
} from './activityTypes';
import { validateActivityEvent } from './activityValidation';

export const ACTIVITY_EXPORT_APP_ID = 'travelers-toolkit' as const;
export const ACTIVITY_EXPORT_FORMAT =
  'travelers-toolkit-activity-history' as const;

export function createActivityExportPayload(
  events: ActivityEvent[]
): ActivityHistoryExportPayloadV1 {
  return {
    app: ACTIVITY_EXPORT_APP_ID,
    format: ACTIVITY_EXPORT_FORMAT,
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    events: [...events],
  };
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  events: ActivityEvent[];
  skippedCount: number;
}

/**
 * Validates a standalone Activity History JSON import envelope and its contained records.
 *
 * Strict Invariants:
 * 1. Historical event imports must NOT be interpreted as newly performed inventory or progression actions.
 * 2. The import feature must NEVER modify roster, inventory, weapons, achievements, or domain data.
 * 3. Original timestamps are strictly preserved; records are never re-stamped.
 */
export function validateActivityImportPayload(
  raw: unknown
): ImportValidationResult {
  const result: ImportValidationResult = {
    valid: false,
    errors: [],
    events: [],
    skippedCount: 0,
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    result.errors.push('The import payload must be a non-null object.');
    return result;
  }

  const p = raw as Record<string, unknown>;

  if (p.app !== ACTIVITY_EXPORT_APP_ID) {
    result.errors.push(
      `Invalid application identifier (expected "${ACTIVITY_EXPORT_APP_ID}").`
    );
  }

  if (p.format !== ACTIVITY_EXPORT_FORMAT) {
    result.errors.push(
      `Invalid format identifier (expected "${ACTIVITY_EXPORT_FORMAT}").`
    );
  }

  if (typeof p.schemaVersion !== 'number') {
    result.errors.push('Missing or invalid schema version.');
  } else if (p.schemaVersion > ACTIVITY_SCHEMA_VERSION) {
    result.errors.push(
      `Unsupported schema version (${p.schemaVersion}). This file was created by a newer version of Traveler's Toolkit.`
    );
  } else if (p.schemaVersion < ACTIVITY_SCHEMA_VERSION) {
    result.errors.push(
      `Unsupported legacy schema version (${p.schemaVersion}).`
    );
  }

  if (!Array.isArray(p.events)) {
    result.errors.push('The import payload is missing an "events" array.');
  }

  if (
    p.eventCount !== undefined &&
    (typeof p.eventCount !== 'number' ||
      !Number.isInteger(p.eventCount) ||
      p.eventCount < 0)
  ) {
    result.errors.push(
      'Invalid "eventCount" property (must be a non-negative integer).'
    );
  } else if (
    typeof p.eventCount === 'number' &&
    Array.isArray(p.events) &&
    p.eventCount !== p.events.length
  ) {
    result.errors.push(
      `Event count mismatch: declared eventCount is ${p.eventCount}, but found ${p.events.length} elements in "events" array.`
    );
  }

  if (result.errors.length > 0) {
    return result;
  }

  const rawEvents = p.events as unknown[];
  const validEvents: ActivityEvent[] = [];
  let skippedCount = 0;

  for (const item of rawEvents) {
    const itemValidation = validateActivityEvent(item);
    if (itemValidation.isValid && itemValidation.event) {
      validEvents.push(itemValidation.event);
    } else {
      skippedCount++;
    }
  }

  return {
    valid: true,
    errors: [],
    events: validEvents,
    skippedCount,
  };
}
