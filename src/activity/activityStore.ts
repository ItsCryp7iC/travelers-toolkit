/**
 * Traveler's Toolkit — Persistent Activity History Store
 * Authoritative specification: docs/activity-history-architecture.md
 *
 * CRITICAL STORAGE SCOPE NOTE:
 * Browser localStorage enforces an origin-wide storage quota (typically 5–10 MiB
 * across all keys combined for the domain origin).
 * While travelers-toolkit-activity-log is strictly isolated from travelers-toolkit-store
 * (preventing state corruption, schema mismatch, and false crafting transaction
 * snapshot dirty rejections), both keys consume storage from the same shared quota.
 * The dual retention limits (1,000 count cap and 750 KiB serialized size cap) along
 * with emergency 30% quota eviction are strictly enforced to ensure Activity History
 * remains bounded and does not monopolize the origin quota needed by the main domain store.
 *
 * PERSISTENCE INTEGRITY INVARIANT:
 * A failed durable write to localStorage MUST NOT be represented as a successfully
 * saved historical event. If writing to disk fails (due to quota or I/O error):
 * - The append returns { success: false, status: 'quota_exceeded' | 'persistence_error' }
 * - The unpersisted event is NOT added to the persistent `events` array
 * - Subscribers and UI consumers will not see unpersisted phantom records
 * - Browser reload will not fabricate persistence
 * - The failure is caught and contained, remaining non-blocking for domain mutations
 */

import { create } from 'zustand';
import {
  ActivityEvent,
  ActivityStorageEnvelope,
  ActivityStorageStatus,
  RecordActivityResult,
  SetEventsFromImportResult,
  ACTIVITY_STORAGE_KEY,
  ACTIVITY_SCHEMA_VERSION,
  MAX_ACTIVITY_EVENT_COUNT,
  MAX_ACTIVITY_SERIALIZED_BYTES,
} from './activityTypes';
import {
  validateActivityEvent,
  getSerializedByteSize,
  compareEventsChronologically,
  truncateEventPayload,
} from './activityValidation';

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function isQuotaExceededError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 1014
    );
  }
  const msg = String((err as Record<string, unknown>)?.message || '');
  const name = String((err as Record<string, unknown>)?.name || '');
  return /quota/i.test(msg) || /quota/i.test(name);
}

interface DiskReadResult {
  envelope: ActivityStorageEnvelope;
  corruptedCount: number;
  unsupportedSchema: boolean;
  error?: unknown;
}

/**
 * Safely reads, parses, and normalizes the activity envelope from localStorage.
 */
function readEnvelopeFromDisk(): DiskReadResult {
  const defaultEnvelope: ActivityStorageEnvelope = {
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    lastUpdated: new Date().toISOString(),
    events: [],
  };

  if (!isStorageAvailable()) {
    return {
      envelope: defaultEnvelope,
      corruptedCount: 0,
      unsupportedSchema: false,
    };
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
  } catch (err) {
    return {
      envelope: defaultEnvelope,
      corruptedCount: 0,
      unsupportedSchema: false,
      error: err,
    };
  }

  if (!raw || !raw.trim()) {
    return {
      envelope: defaultEnvelope,
      corruptedCount: 0,
      unsupportedSchema: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    // Malformed JSON recovery: do not crash, flag diagnostic
    return {
      envelope: defaultEnvelope,
      corruptedCount: 1,
      unsupportedSchema: false,
      error: parseErr,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      envelope: defaultEnvelope,
      corruptedCount: 1,
      unsupportedSchema: false,
    };
  }

  const p = parsed as Record<string, unknown>;

  // Schema Version Invariant:
  // If stored data has a higher schema version than this application supports,
  // do NOT overwrite it! Signal unsupported future version.
  if (
    typeof p.schemaVersion === 'number' &&
    p.schemaVersion > ACTIVITY_SCHEMA_VERSION
  ) {
    return {
      envelope: defaultEnvelope,
      corruptedCount: 0,
      unsupportedSchema: true,
    };
  }

  const rawEvents = Array.isArray(p.events) ? p.events : [];
  const validEvents: ActivityEvent[] = [];
  let corruptedCount = 0;

  for (const item of rawEvents) {
    const validation = validateActivityEvent(item);
    if (validation.isValid && validation.event) {
      validEvents.push(validation.event);
    } else {
      corruptedCount++;
    }
  }

  validEvents.sort(compareEventsChronologically);

  return {
    envelope: {
      schemaVersion: ACTIVITY_SCHEMA_VERSION,
      lastUpdated:
        typeof p.lastUpdated === 'string'
          ? p.lastUpdated
          : new Date().toISOString(),
      events: validEvents,
    },
    corruptedCount,
    unsupportedSchema: false,
  };
}

/**
 * Applies the dual retention limits (1,000 count and 750 KiB serialized size),
 * pruning oldest events FIFO.
 */
function applyDualRetentionPruning(
  events: ActivityEvent[],
  maxCount = MAX_ACTIVITY_EVENT_COUNT,
  maxBytes = MAX_ACTIVITY_SERIALIZED_BYTES
): { prunedEvents: ActivityEvent[]; wasPruned: boolean } {
  let list = [...events];
  let wasPruned = false;

  // 1. Enforce Event Count Limit
  if (list.length > maxCount) {
    list = list.slice(list.length - maxCount);
    wasPruned = true;
  }

  // 2. Enforce Serialized Byte Size Limit
  const makeEnvelope = (evs: ActivityEvent[]): ActivityStorageEnvelope => ({
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    lastUpdated: new Date().toISOString(),
    events: evs,
  });

  let currentBytes = getSerializedByteSize(makeEnvelope(list));

  // Prune oldest until size is under threshold using binary search
  // for O(log N) stringifications instead of O(N^2) serializations
  if (currentBytes > maxBytes && list.length > 0) {
    wasPruned = true;
    let low = 1;
    let high = list.length;
    let bestCut = list.length;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testList = list.slice(mid);
      const testBytes = getSerializedByteSize(makeEnvelope(testList));
      if (testBytes <= maxBytes) {
        bestCut = mid;
        high = mid - 1; // Try to retain more events (smaller cut)
      } else {
        low = mid + 1; // Need to cut more events
      }
    }
    list = list.slice(bestCut);
  }

  return { prunedEvents: list, wasPruned };
}

export interface ActivityStoreState {
  events: ActivityEvent[];
  storageStatus: ActivityStorageStatus;
  appendEvent: (event: ActivityEvent) => RecordActivityResult;
  clearHistory: () => boolean;
  getEvents: () => ActivityEvent[];
  getEventById: (id: string) => ActivityEvent | undefined;
  reconcileFromDisk: () => void;
  setEventsFromImport: (
    importedEvents: ActivityEvent[]
  ) => SetEventsFromImportResult;
}

// Initial state reading from disk safely
const initialDisk = readEnvelopeFromDisk();
const initialEvents = initialDisk.unsupportedSchema
  ? []
  : initialDisk.envelope.events;

export const useActivityStore = create<ActivityStoreState>((set, get) => ({
  events: initialEvents,
  storageStatus: {
    eventCount: initialEvents.length,
    serializedBytes: getSerializedByteSize(initialDisk.envelope),
    maxEventCount: MAX_ACTIVITY_EVENT_COUNT,
    maxSerializedBytes: MAX_ACTIVITY_SERIALIZED_BYTES,
    lastPruneTimestamp: null,
    persistenceErrorCount: 0,
    corruptedEntriesRecovered: initialDisk.corruptedCount,
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
  },

  getEvents: () => get().events,

  getEventById: (id: string) => get().events.find((e) => e.id === id),

  clearHistory: (): boolean => {
    const emptyEnvelope: ActivityStorageEnvelope = {
      schemaVersion: ACTIVITY_SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      events: [],
    };

    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(
          ACTIVITY_STORAGE_KEY,
          JSON.stringify(emptyEnvelope)
        );
      } catch (err) {
        console.error(
          '[ActivityStore] Failed to clear persistent storage:',
          err
        );
        set((state) => ({
          storageStatus: {
            ...state.storageStatus,
            persistenceErrorCount: state.storageStatus.persistenceErrorCount + 1,
          },
        }));
        return false;
      }
    } else {
      return false;
    }

    set((state) => ({
      events: [],
      storageStatus: {
        ...state.storageStatus,
        eventCount: 0,
        serializedBytes: getSerializedByteSize(emptyEnvelope),
        persistenceErrorCount: 0,
        corruptedEntriesRecovered: 0,
        lastPruneTimestamp: null,
      },
    }));
    return true;
  },

  reconcileFromDisk: () => {
    const diskResult = readEnvelopeFromDisk();
    if (diskResult.unsupportedSchema) {
      console.warn(
        '[ActivityStore] Reconcile skipped: disk contains unsupported future schema version.'
      );
      return;
    }

    const diskEvents = diskResult.envelope.events;
    set((state) => ({
      events: diskEvents,
      storageStatus: {
        ...state.storageStatus,
        eventCount: diskEvents.length,
        serializedBytes: getSerializedByteSize(diskResult.envelope),
        corruptedEntriesRecovered:
          state.storageStatus.corruptedEntriesRecovered +
          diskResult.corruptedCount,
      },
    }));
  },

  /**
   * Appends an event using the Read-Merge-Prune-Write cycle to prevent multi-tab overwrites.
   */
  appendEvent: (rawEvent: ActivityEvent): RecordActivityResult => {
    // 1. Validation and truncation
    const validation = validateActivityEvent(rawEvent);
    if (!validation.isValid || !validation.event) {
      return {
        success: false,
        status: 'invalid_rejected',
        message: validation.error || 'Event failed validation.',
      };
    }

    const event = truncateEventPayload(validation.event);

    // 2. Read latest disk state before write (mitigating multi-tab stale cache races)
    const diskResult = readEnvelopeFromDisk();
    if (diskResult.unsupportedSchema) {
      return {
        success: false,
        status: 'persistence_error',
        message:
          'Storage contains a newer, unsupported schema version. Cannot append.',
      };
    }

    let existingEvents = diskResult.envelope.events;

    // 3. Deduplication check
    if (existingEvents.some((e) => e.id === event.id)) {
      return {
        success: false,
        status: 'duplicate_ignored',
        eventId: event.id,
        message: `Event with ID "${event.id}" already exists.`,
      };
    }

    // 4. Merge and deterministically sort
    existingEvents.push(event);
    existingEvents.sort(compareEventsChronologically);

    // 5. Dual-Bound Retention Pruning (1,000 count / 750 KiB)
    const { prunedEvents, wasPruned } =
      applyDualRetentionPruning(existingEvents);
    const pruneTimestamp = wasPruned
      ? new Date().toISOString()
      : get().storageStatus.lastPruneTimestamp;

    const envelope: ActivityStorageEnvelope = {
      schemaVersion: ACTIVITY_SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      events: prunedEvents,
    };

    let serializedJson = '';
    try {
      serializedJson = JSON.stringify(envelope);
    } catch (serErr) {
      return {
        success: false,
        status: 'serialization_error',
        message: 'Failed to serialize activity envelope.',
        error: serErr,
      };
    }

    // 6. Write to localStorage with Quota Recovery
    let writeSuccess = false;
    let persistenceStatus: RecordActivityResult['status'] = 'recorded';
    let persistenceErrorMessage: string | undefined = undefined;

    if (!isStorageAvailable()) {
      persistenceStatus = 'storage_unavailable';
      persistenceErrorMessage =
        'localStorage is unavailable in this environment.';
    } else {
      try {
        window.localStorage.setItem(ACTIVITY_STORAGE_KEY, serializedJson);
        writeSuccess = true;
      } catch (writeErr) {
        if (isQuotaExceededError(writeErr)) {
          // Emergency eviction: drop oldest 30% of events and retry once
          const emergencyCount = Math.max(
            1,
            Math.floor(envelope.events.length * 0.7)
          );
          const emergencyEvents = envelope.events.slice(
            envelope.events.length - emergencyCount
          );
          const emergencyEnvelope: ActivityStorageEnvelope = {
            ...envelope,
            lastUpdated: new Date().toISOString(),
            events: emergencyEvents,
          };

          try {
            const emergencyJson = JSON.stringify(emergencyEnvelope);
            window.localStorage.setItem(ACTIVITY_STORAGE_KEY, emergencyJson);
            writeSuccess = true;
            envelope.events = emergencyEvents;
            serializedJson = emergencyJson;
          } catch (retryErr) {
            persistenceStatus = 'quota_exceeded';
            persistenceErrorMessage =
              'Storage quota exceeded even after emergency pruning.';
          }
        } else {
          persistenceStatus = 'persistence_error';
          persistenceErrorMessage = (writeErr as Record<string, unknown>)
            ?.message
            ? String((writeErr as Record<string, unknown>).message)
            : 'Failed to write to persistent storage.';
        }
      }
    }

    // 7. Update in-memory state and notify subscribers
    const newBytes = getSerializedByteSize(serializedJson || envelope);

    set((state) => ({
      events: writeSuccess ? envelope.events : state.events,
      storageStatus: {
        ...state.storageStatus,
        eventCount: writeSuccess ? envelope.events.length : state.events.length,
        serializedBytes: writeSuccess
          ? newBytes
          : state.storageStatus.serializedBytes,
        lastPruneTimestamp: writeSuccess
          ? pruneTimestamp
          : state.storageStatus.lastPruneTimestamp,
        persistenceErrorCount: writeSuccess
          ? state.storageStatus.persistenceErrorCount
          : state.storageStatus.persistenceErrorCount + 1,
        corruptedEntriesRecovered:
          state.storageStatus.corruptedEntriesRecovered +
          diskResult.corruptedCount,
      },
    }));

    if (!writeSuccess) {
      return {
        success: false,
        status: persistenceStatus,
        eventId: event.id,
        message: persistenceErrorMessage,
      };
    }

    return {
      success: true,
      status: 'recorded',
      eventId: event.id,
    };
  },

  setEventsFromImport: (
    importedEvents: ActivityEvent[]
  ): SetEventsFromImportResult => {
    const diskResult = readEnvelopeFromDisk();
    if (diskResult.unsupportedSchema) {
      return {
        success: false,
        imported: 0,
        skipped: importedEvents.length,
        addedCount: 0,
        deduplicatedCount: 0,
        invalidCount: importedEvents.length,
        prunedCount: 0,
        retainedCount: diskResult.envelope.events.length,
      };
    }

    const currentMap = new Map<string, ActivityEvent>();
    diskResult.envelope.events.forEach((e) => currentMap.set(e.id, e));

    let importedCount = 0;
    let deduplicatedCount = 0;
    let invalidCount = 0;

    for (const raw of importedEvents) {
      const validation = validateActivityEvent(raw);
      if (!validation.isValid || !validation.event) {
        invalidCount++;
        continue;
      }
      if (currentMap.has(validation.event.id)) {
        deduplicatedCount++; // Deduplicate
        continue;
      }
      currentMap.set(validation.event.id, validation.event);
      importedCount++;
    }

    const merged = Array.from(currentMap.values());
    merged.sort(compareEventsChronologically);

    const { prunedEvents, wasPruned } = applyDualRetentionPruning(merged);
    const prunedCount = merged.length - prunedEvents.length;

    const envelope: ActivityStorageEnvelope = {
      schemaVersion: ACTIVITY_SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      events: prunedEvents,
    };

    let writeSuccess = true;
    let writeError: unknown = undefined;
    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(
          ACTIVITY_STORAGE_KEY,
          JSON.stringify(envelope)
        );
      } catch (err) {
        writeSuccess = false;
        writeError = err;
        console.error(
          '[ActivityStore] Failed to write imported events to storage:',
          err
        );
      }
    } else {
      writeSuccess = false;
    }

    if (!writeSuccess) {
      set((state) => ({
        storageStatus: {
          ...state.storageStatus,
          persistenceErrorCount: state.storageStatus.persistenceErrorCount + 1,
        },
      }));
      return {
        success: false,
        imported: 0,
        skipped: deduplicatedCount + invalidCount,
        addedCount: 0,
        deduplicatedCount,
        invalidCount,
        prunedCount: 0,
        retainedCount: get().events.length,
        error: writeError,
      };
    }

    set((state) => ({
      events: envelope.events,
      storageStatus: {
        ...state.storageStatus,
        eventCount: envelope.events.length,
        serializedBytes: getSerializedByteSize(envelope),
        lastPruneTimestamp: wasPruned
          ? new Date().toISOString()
          : state.storageStatus.lastPruneTimestamp,
      },
    }));

    return {
      success: true,
      imported: importedCount,
      skipped: deduplicatedCount + invalidCount,
      addedCount: importedCount,
      deduplicatedCount,
      invalidCount,
      prunedCount,
      retainedCount: envelope.events.length,
    };
  },
}));

/**
 * Native cross-tab storage event synchronization handler.
 */
function handleStorageEvent(e: StorageEvent): void {
  if (e.key === ACTIVITY_STORAGE_KEY) {
    useActivityStore.getState().reconcileFromDisk();
  }
}

let storageListenerAttached = false;

export function attachStorageListener(): void {
  if (typeof window !== 'undefined' && !storageListenerAttached) {
    window.addEventListener('storage', handleStorageEvent);
    storageListenerAttached = true;
  }
}

export function detachStorageListener(): void {
  if (typeof window !== 'undefined' && storageListenerAttached) {
    window.removeEventListener('storage', handleStorageEvent);
    storageListenerAttached = false;
  }
}

// Auto-attach in browser environment
if (typeof window !== 'undefined') {
  attachStorageListener();
}

/**
 * Public functional API
 */
export function getActivityEvents(): ActivityEvent[] {
  return useActivityStore.getState().getEvents();
}

export function getActivityEventById(id: string): ActivityEvent | undefined {
  return useActivityStore.getState().getEventById(id);
}

export function getActivityStorageStatus(): ActivityStorageStatus {
  return useActivityStore.getState().storageStatus;
}

export function subscribeToActivity(
  listener: (events: ActivityEvent[]) => void
): () => void {
  return useActivityStore.subscribe((state) => listener(state.events));
}

export function clearActivityHistory(): boolean {
  return useActivityStore.getState().clearHistory();
}
