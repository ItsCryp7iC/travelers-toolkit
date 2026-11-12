import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useActivityStore,
  getActivityEvents,
  getActivityEventById,
  getActivityStorageStatus,
  subscribeToActivity,
  clearActivityHistory,
  detachStorageListener,
} from './activityStore';
import {
  ActivityEvent,
  ACTIVITY_STORAGE_KEY,
  MAX_ACTIVITY_EVENT_COUNT,
  MAX_ACTIVITY_SERIALIZED_BYTES,
} from './activityTypes';

function makeSyntheticEvent(
  index: number,
  timestampOffsetMs = 0
): ActivityEvent {
  const hex = index.toString(16).padStart(12, '0');
  const baseTime = new Date('2026-11-12T10:00:00.000Z').getTime();
  return {
    id: `00000000-0000-4000-8000-${hex}`,
    schemaVersion: 1,
    timestamp: new Date(baseTime + timestampOffsetMs).toISOString(),
    category: 'inventory',
    action: 'inventory_updated',
    source: 'inventory_page',
    entityType: 'material',
    entityId: `mat_${index}`,
    entityName: `Material ${index}`,
    summary: `Material ${index} updated.`,
    changes: [
      { field: 'quantity', before: 0, after: index, delta: `+${index}` },
    ],
  };
}

describe('Activity History — Persistent Storage & Retention Engine', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearActivityHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    detachStorageListener();
    window.localStorage.clear();
  });

  it('uses the dedicated persistence key travelers-toolkit-activity-log', () => {
    const event = makeSyntheticEvent(1);
    const res = useActivityStore.getState().appendEvent(event);
    expect(res.success).toBe(true);
    expect(window.localStorage.getItem(ACTIVITY_STORAGE_KEY)).not.toBeNull();
    // Invariant: main store key must NEVER be touched by activity store!
    expect(window.localStorage.getItem('travelers-toolkit-store')).toBeNull();
  });

  it('initializes cleanly from empty storage without creating events', () => {
    expect(getActivityEvents()).toEqual([]);
    const status = getActivityStorageStatus();
    expect(status.eventCount).toBe(0);
    expect(status.persistenceErrorCount).toBe(0);
  });

  it('successfully appends, persists, and retrieves events by ID', () => {
    const e1 = makeSyntheticEvent(1);
    const e2 = makeSyntheticEvent(2, 1000);

    const res1 = useActivityStore.getState().appendEvent(e1);
    const res2 = useActivityStore.getState().appendEvent(e2);

    expect(res1.status).toBe('recorded');
    expect(res2.status).toBe('recorded');

    const all = getActivityEvents();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(e1.id);
    expect(all[1].id).toBe(e2.id);

    expect(getActivityEventById(e1.id)).toEqual(e1);
    expect(getActivityEventById('non-existent-id')).toBeUndefined();
  });

  it('notifies subscribers upon append and clear', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToActivity(listener);

    const e1 = makeSyntheticEvent(1);
    useActivityStore.getState().appendEvent(e1);

    expect(listener).toHaveBeenCalled();
    expect(listener).toHaveBeenLastCalledWith([e1]);

    clearActivityHistory();
    expect(listener).toHaveBeenLastCalledWith([]);

    unsubscribe();
  });

  it('suppresses duplicate event IDs idempotently without appending duplicates', () => {
    const e1 = makeSyntheticEvent(1);
    const firstRes = useActivityStore.getState().appendEvent(e1);
    expect(firstRes.status).toBe('recorded');

    // Attempt to append identical event ID
    const dupRes = useActivityStore.getState().appendEvent(e1);
    expect(dupRes.success).toBe(false);
    expect(dupRes.status).toBe('duplicate_ignored');

    expect(getActivityEvents()).toHaveLength(1);
  });

  it('enforces the 1,000 maximum event count limit with FIFO pruning', () => {
    // Seed initial 995 events directly to storage to avoid slow test overhead
    const seedEvents = Array.from({ length: 995 }, (_, idx) =>
      makeSyntheticEvent(idx + 1, (idx + 1) * 1000)
    );
    window.localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        lastUpdated: new Date().toISOString(),
        events: seedEvents,
      })
    );
    useActivityStore.getState().reconcileFromDisk();

    // Append 10 more events sequentially to exceed 1,000 limit
    for (let i = 996; i <= 1005; i++) {
      const e = makeSyntheticEvent(i, i * 1000);
      useActivityStore.getState().appendEvent(e);
    }

    const events = getActivityEvents();
    expect(events.length).toBe(MAX_ACTIVITY_EVENT_COUNT); // 1,000

    // The first 5 events (i = 1 to 5) should have been pruned FIFO
    expect(events[0].entityId).toBe('mat_6');
    expect(events[events.length - 1].entityId).toBe('mat_1005');

    const status = getActivityStorageStatus();
    expect(status.eventCount).toBe(1000);
    expect(status.lastPruneTimestamp).not.toBeNull();
  }, 15000);

  it('enforces the 750 KiB serialized size limit by pruning oldest events', () => {
    // Seed heavy events (~2.5 KB payload each) to approach 750 KiB
    const heavyPayload = 'x'.repeat(2500);
    const seedEvents: ActivityEvent[] = Array.from(
      { length: 300 },
      (_, idx) => ({
        ...makeSyntheticEvent(idx + 1, (idx + 1) * 1000),
        metadata: { padding: heavyPayload },
      })
    );
    window.localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        lastUpdated: new Date().toISOString(),
        events: seedEvents,
      })
    );
    useActivityStore.getState().reconcileFromDisk();

    // Append 15 more heavy events sequentially to exceed 750 KiB limit
    for (let i = 301; i <= 315; i++) {
      const e: ActivityEvent = {
        ...makeSyntheticEvent(i, i * 1000),
        metadata: { padding: heavyPayload },
      };
      useActivityStore.getState().appendEvent(e);
    }

    const status = getActivityStorageStatus();
    expect(status.serializedBytes).toBeLessThanOrEqual(
      MAX_ACTIVITY_SERIALIZED_BYTES
    );
    expect(status.lastPruneTimestamp).not.toBeNull();
  }, 15000);

  it('handles QuotaExceededError by emergency pruning 30% and retrying once', () => {
    // Populate with 10 events
    for (let i = 1; i <= 10; i++) {
      useActivityStore.getState().appendEvent(makeSyntheticEvent(i, i * 1000));
    }
    expect(getActivityEvents()).toHaveLength(10);

    // Mock Storage.prototype.setItem to throw QuotaExceededError on the first attempt, then succeed on retry
    let callCount = 0;
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      k: string,
      v: string
    ) {
      callCount++;
      if (callCount === 1) {
        const quotaError = new DOMException(
          'Storage quota exceeded',
          'QuotaExceededError'
        );
        throw quotaError;
      }
      return originalSetItem.call(this, k, v);
    });

    const newEvent = makeSyntheticEvent(11, 11000);
    const res = useActivityStore.getState().appendEvent(newEvent);

    // Should succeed because retry succeeded after emergency 30% eviction
    expect(res.success).toBe(true);
    expect(res.status).toBe('recorded');
    // 10 events + 1 = 11 events; 11 * 0.7 = 7 events after emergency 30% eviction
    expect(getActivityEvents().length).toBeLessThanOrEqual(8);
  });

  it('returns quota_exceeded and increments error counter if retry still fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const res = useActivityStore.getState().appendEvent(makeSyntheticEvent(1));
    expect(res.success).toBe(false);
    expect(res.status).toBe('quota_exceeded');

    const status = getActivityStorageStatus();
    expect(status.persistenceErrorCount).toBe(1);
  });

  it('does NOT represent failed persistence as a saved event in memory or across reloads', () => {
    // 1. Seed store with 2 events
    useActivityStore.getState().appendEvent(makeSyntheticEvent(1, 1000));
    useActivityStore.getState().appendEvent(makeSyntheticEvent(2, 2000));
    expect(getActivityEvents()).toHaveLength(2);

    // 2. Mock storage write failure
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Simulated disk I/O error', 'QuotaExceededError');
    });

    const failedEvent = makeSyntheticEvent(999, 999000);
    const appendResult = useActivityStore.getState().appendEvent(failedEvent);

    // Invariant 1: Append returns explicit failure result
    expect(appendResult.success).toBe(false);
    expect(appendResult.status).toBe('quota_exceeded');

    // Invariant 2: Failed event is NOT added to in-memory events or accessible by ID
    expect(getActivityEvents()).toHaveLength(2);
    expect(getActivityEventById(failedEvent.id)).toBeUndefined();
    expect(getActivityEvents().some((e) => e.id === failedEvent.id)).toBe(false);

    // Invariant 3: Simulating a page reload (reconcileFromDisk) confirms disk never fabricated persistence
    useActivityStore.getState().reconcileFromDisk();
    expect(getActivityEvents()).toHaveLength(2);
    expect(getActivityEventById(failedEvent.id)).toBeUndefined();

    // Invariant 4: Persistence error count was accurately tracked
    const status = getActivityStorageStatus();
    expect(status.persistenceErrorCount).toBe(1);
  });

  it('does NOT represent failed persistence as a saved event in memory or across reloads', () => {
    // 1. Seed store with 2 events
    useActivityStore.getState().appendEvent(makeSyntheticEvent(1, 1000));
    useActivityStore.getState().appendEvent(makeSyntheticEvent(2, 2000));
    expect(getActivityEvents()).toHaveLength(2);

    // 2. Mock storage write failure
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Simulated disk I/O error', 'QuotaExceededError');
    });

    const failedEvent = makeSyntheticEvent(999, 999000);
    const appendResult = useActivityStore.getState().appendEvent(failedEvent);

    // Invariant 1: Append returns explicit failure result
    expect(appendResult.success).toBe(false);
    expect(appendResult.status).toBe('quota_exceeded');

    // Invariant 2: Failed event is NOT added to in-memory events or accessible by ID
    expect(getActivityEvents()).toHaveLength(2);
    expect(getActivityEventById(failedEvent.id)).toBeUndefined();
    expect(getActivityEvents().some((e) => e.id === failedEvent.id)).toBe(
      false
    );

    // Invariant 3: Simulating a page reload (reconcileFromDisk) confirms disk never fabricated persistence
    useActivityStore.getState().reconcileFromDisk();
    expect(getActivityEvents()).toHaveLength(2);
    expect(getActivityEventById(failedEvent.id)).toBeUndefined();

    // Invariant 4: Persistence error count was accurately tracked
    const status = getActivityStorageStatus();
    expect(status.persistenceErrorCount).toBe(1);
  });

  it('recovers gracefully from corrupted JSON in storage without throwing', () => {
    window.localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      '{ invalid json string...'
    );

    // Trigger reconciliation
    useActivityStore.getState().reconcileFromDisk();

    expect(getActivityEvents()).toEqual([]);
    const status = getActivityStorageStatus();
    expect(status.corruptedEntriesRecovered).toBeGreaterThan(0);
  });

  it('refuses to overwrite unsupported future schema versions on disk', () => {
    const futureEnvelope = {
      schemaVersion: 99,
      lastUpdated: new Date().toISOString(),
      events: [{ id: 'future' }],
    };
    window.localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify(futureEnvelope)
    );

    const res = useActivityStore.getState().appendEvent(makeSyntheticEvent(1));
    expect(res.success).toBe(false);
    expect(res.status).toBe('persistence_error');
    expect(res.message).toContain('unsupported schema version');

    // Verify disk content was NOT overwritten
    const rawDisk = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    expect(rawDisk).toContain('"schemaVersion":99');
  });
});
