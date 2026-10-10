import { describe, it, expect, vi, beforeEach } from 'vitest';
import useStore from '../useStore';

describe('syncSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ isSyncing: false, hoyolabConnected: true, syncPayload: null });
    global.fetch = vi.fn();
  });

  it('prevents concurrent syncs via isSyncing guard', async () => {
    // Setup fetch to be slow so we can trigger concurrency
    let resolveFetch;
    const fetchPromise = new Promise(resolve => {
      resolveFetch = resolve;
    });

    global.fetch.mockReturnValue(fetchPromise);

    // Start first sync
    const p1 = useStore.getState().handleSyncNotes(true);

    // Verify it set isSyncing
    expect(useStore.getState().isSyncing).toBe(true);

    // Start second sync immediately
    const result2 = await useStore.getState().handleSyncNotes(true);

    // Second sync should instantly abort with already_syncing
    expect(result2).toEqual({ error: 'already_syncing' });

    // Resolve the first sync
    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ data: 'mock' })
    });

    const result1 = await p1;
    expect(result1.success).toBe(true);

    // Only 1 fetch call should have been made
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify flag was reset
    expect(useStore.getState().isSyncing).toBe(false);
  });
});
