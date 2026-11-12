import { describe, it, expect, beforeEach } from 'vitest';
import {
  createActivityExportPayload,
  validateActivityImportPayload,
  ACTIVITY_EXPORT_APP_ID,
  ACTIVITY_EXPORT_FORMAT,
} from './activityInterchange';
import {
  useActivityStore,
  getActivityEvents,
  clearActivityHistory,
} from './activityStore';
import { ActivityEvent } from './activityTypes';

function makeEvent(idSuffix: string, timestamp: string): ActivityEvent {
  const hex = idSuffix.padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${hex}`,
    schemaVersion: 1,
    timestamp,
    category: 'inventory',
    action: 'inventory_updated',
    source: 'inventory_page',
    summary: `Item ${idSuffix} updated`,
  };
}

describe('Activity History — Standalone File Interchange (Export & Import)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearActivityHistory();
  });

  it('creates a compliant standalone export envelope with schema version 1', () => {
    const e1 = makeEvent('1', '2026-11-12T10:00:00.000Z');
    const e2 = makeEvent('2', '2026-11-12T11:00:00.000Z');

    const exportPayload = createActivityExportPayload([e1, e2]);

    expect(exportPayload.app).toBe(ACTIVITY_EXPORT_APP_ID);
    expect(exportPayload.format).toBe(ACTIVITY_EXPORT_FORMAT);
    expect(exportPayload.schemaVersion).toBe(1);
    expect(exportPayload.eventCount).toBe(2);
    expect(exportPayload.events).toEqual([e1, e2]);
    expect(new Date(exportPayload.exportedAt).getTime()).not.toBeNaN();
  });

  it('validates a valid import payload and preserves original timestamps', () => {
    const originalTime = '2025-05-01T08:00:00.000Z';
    const importedEvent = makeEvent('1', originalTime);

    const payload = {
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      exportedAt: '2026-11-12T12:00:00.000Z',
      eventCount: 1,
      events: [importedEvent],
    };

    const result = validateActivityImportPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.skippedCount).toBe(0);

    // Invariant: original historical timestamp is preserved!
    expect(result.events[0].timestamp).toBe(originalTime);
  });

  it('skips malformed and invalid event records while reporting skipped count', () => {
    const validEvent = makeEvent('1', '2026-11-12T10:00:00.000Z');
    const invalidEvent1 = { id: 'invalid-uuid', summary: 'Missing fields' };
    const invalidEvent2 = null;

    const payload = {
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      exportedAt: '2026-11-12T12:00:00.000Z',
      eventCount: 3,
      events: [validEvent, invalidEvent1, invalidEvent2],
    };

    const result = validateActivityImportPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.skippedCount).toBe(2);
  });

  it('accepts a payload produced by createActivityExportPayload without manual modification (round-trip)', () => {
    const e1 = makeEvent('1', '2026-11-12T10:00:00.000Z');
    const e2 = makeEvent('2', '2026-11-12T11:00:00.000Z');
    const e3 = makeEvent('3', '2026-11-12T12:00:00.000Z');

    // 1. Generate export payload
    const exportedPayload = createActivityExportPayload([e1, e2, e3]);

    // 2. Validate import payload directly without manual manipulation
    const validationResult = validateActivityImportPayload(exportedPayload);

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toEqual([]);
    expect(validationResult.skippedCount).toBe(0);
    expect(validationResult.events).toEqual([e1, e2, e3]);
  });

  it('rejects payloads with invalid format discriminators, unsupported versions, and malformed envelopes', () => {
    // Malformed envelope root (null, primitives, arrays)
    expect(validateActivityImportPayload(null).valid).toBe(false);
    expect(validateActivityImportPayload('string').valid).toBe(false);
    expect(validateActivityImportPayload([]).valid).toBe(false);

    // Wrong app
    expect(
      validateActivityImportPayload({
        app: 'wrong-app',
        format: 'travelers-toolkit-activity-history',
        schemaVersion: 1,
        events: [],
      }).valid
    ).toBe(false);

    // Wrong format discriminator
    expect(
      validateActivityImportPayload({
        app: 'travelers-toolkit',
        format: 'good-format',
        schemaVersion: 1,
        events: [],
      }).valid
    ).toBe(false);

    // Missing format discriminator
    expect(
      validateActivityImportPayload({
        app: 'travelers-toolkit',
        schemaVersion: 1,
        events: [],
      }).valid
    ).toBe(false);

    // Future schema version (e.g. 2, 99)
    expect(
      validateActivityImportPayload({
        app: 'travelers-toolkit',
        format: 'travelers-toolkit-activity-history',
        schemaVersion: 99,
        events: [],
      }).valid
    ).toBe(false);

    // Legacy unsupported schema version (e.g. 0)
    expect(
      validateActivityImportPayload({
        app: 'travelers-toolkit',
        format: 'travelers-toolkit-activity-history',
        schemaVersion: 0,
        events: [],
      }).valid
    ).toBe(false);

    // Missing events array
    expect(
      validateActivityImportPayload({
        app: 'travelers-toolkit',
        format: 'travelers-toolkit-activity-history',
        schemaVersion: 1,
      }).valid
    ).toBe(false);
  });

  it('validates eventCount handling including non-numeric, negative, and mismatched array lengths', () => {
    const validEvent = makeEvent('1', '2026-11-12T10:00:00.000Z');

    // Non-numeric eventCount
    const nonNumericRes = validateActivityImportPayload({
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      eventCount: '1',
      events: [validEvent],
    });
    expect(nonNumericRes.valid).toBe(false);
    expect(nonNumericRes.errors[0]).toContain('Invalid "eventCount" property');

    // Negative eventCount
    const negativeRes = validateActivityImportPayload({
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      eventCount: -5,
      events: [validEvent],
    });
    expect(negativeRes.valid).toBe(false);
    expect(negativeRes.errors[0]).toContain('Invalid "eventCount" property');

    // Non-integer eventCount
    const floatRes = validateActivityImportPayload({
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      eventCount: 1.5,
      events: [validEvent],
    });
    expect(floatRes.valid).toBe(false);
    expect(floatRes.errors[0]).toContain('Invalid "eventCount" property');

    // Mismatched eventCount (declared 10, but events array has 1)
    const mismatchRes = validateActivityImportPayload({
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      eventCount: 10,
      events: [validEvent],
    });
    expect(mismatchRes.valid).toBe(false);
    expect(mismatchRes.errors[0]).toContain('Event count mismatch');
  });

  it('merges imported events with existing local events and deduplicates IDs', () => {
    const existing = makeEvent('1', '2026-11-12T10:00:00.000Z');
    useActivityStore.getState().appendEvent(existing);

    const importedDuplicate = makeEvent('1', '2026-11-12T10:00:00.000Z');
    const importedNew = makeEvent('2', '2026-11-12T11:00:00.000Z');

    const result = useActivityStore
      .getState()
      .setEventsFromImport([importedDuplicate, importedNew]);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1); // Duplicate skipped

    const all = getActivityEvents();
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.id)).toEqual([existing.id, importedNew.id]);
  });
});
