/**
 * Traveler's Toolkit — Activity Event Factory and Recording API
 * Authoritative specification: docs/activity-history-architecture.md
 */

import {
  ActivityEvent,
  ActivityEventInput,
  RecordActivityResult,
  FieldChange,
  ACTIVITY_SCHEMA_VERSION,
} from './activityTypes';
import {
  validateActivityEvent,
  truncateEventPayload,
} from './activityValidation';
import { useActivityStore } from './activityStore';

export interface EventFactoryOptions {
  idGenerator?: () => string;
  clock?: () => string;
}

function defaultIdGenerator(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Standard UUID v4 generation fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function defaultClock(): string {
  return new Date().toISOString();
}

/**
 * Event Factory: constructs a normalized, validated, and truncated ActivityEvent.
 */
export function createActivityEvent(
  input: ActivityEventInput,
  options?: EventFactoryOptions
): { event?: ActivityEvent; error?: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Event input must be a non-null object.' };
  }

  const id = input.id || (options?.idGenerator || defaultIdGenerator)();
  const timestamp = input.timestamp || (options?.clock || defaultClock)();

  const candidate: ActivityEvent = {
    id,
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    timestamp,
    category: input.category,
    action: input.action,
    source: input.source,
    summary: input.summary,
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.entityName ? { entityName: input.entityName } : {}),
    ...(input.transactionId ? { transactionId: input.transactionId } : {}),
    ...(input.changes ? { changes: input.changes } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const validation = validateActivityEvent(candidate);
  if (!validation.isValid || !validation.event) {
    return { error: validation.error || 'Event validation failed.' };
  }

  const truncated = truncateEventPayload(validation.event);
  return { event: truncated };
}

/**
 * Main recording API entry point.
 * Guarantees non-blocking execution: errors are contained and reported as a typed result.
 */
export function recordActivity(
  input: ActivityEventInput,
  options?: EventFactoryOptions
): RecordActivityResult {
  try {
    const factoryResult = createActivityEvent(input, options);
    if (!factoryResult.event) {
      return {
        success: false,
        status: 'invalid_rejected',
        message: factoryResult.error || 'Failed to create valid event.',
      };
    }

    return useActivityStore.getState().appendEvent(factoryResult.event);
  } catch (err) {
    console.error('[ActivityLogger] Unexpected failure during recording:', err);
    return {
      success: false,
      status: 'persistence_error',
      message: (err as Record<string, unknown>)?.message
        ? String((err as Record<string, unknown>).message)
        : 'Unexpected recording failure.',
      error: err,
    };
  }
}

/**
 * Deep equality comparison for detecting no-op mutations.
 */
export function hasFieldDifferences(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (
    a === null ||
    typeof a !== 'object' ||
    b === null ||
    typeof b !== 'object'
  ) {
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return true;
  if (Array.isArray(a)) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return true;
    for (let i = 0; i < arrA.length; i++) {
      if (hasFieldDifferences(arrA[i], arrB[i])) return true;
    }
    return false;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return true;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return true;
    if (hasFieldDifferences(objA[k], objB[k])) return true;
  }
  return false;
}

/**
 * Helper to calculate structured before/after diffs between two records.
 */
export function calculateFieldDiffs<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldLabels?: Record<string, string>
): FieldChange[] {
  const changes: FieldChange[] = [];
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  for (const field of allKeys) {
    const valBefore = before?.[field];
    const valAfter = after?.[field];

    if (hasFieldDifferences(valBefore, valAfter)) {
      const change: FieldChange = {
        field,
        before: valBefore,
        after: valAfter,
      };
      if (fieldLabels?.[field]) {
        change.label = fieldLabels[field];
      }
      if (typeof valBefore === 'number' && typeof valAfter === 'number') {
        const diff = valAfter - valBefore;
        change.delta = diff > 0 ? `+${diff}` : `${diff}`;
      }
      changes.push(change);
    }
  }

  return changes;
}
