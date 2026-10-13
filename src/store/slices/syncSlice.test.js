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

  it('propagates selected hoyolabAccount.uid into POST /api/notes request payload', async () => {
    useStore.setState({
      hoyolabConnected: true,
      isSyncing: false,
      hoyolabAccount: {
        uid: 700123456,
        nickname: 'TravelerMain',
        server: 'os_euro',
        serverName: 'Europe',
        level: 60,
      },
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          resin: { current: 160, max: 200, recovery_time_seconds: 0 },
          realm_currency: { current: 2400, max: 2400, recovery_time_seconds: 0 },
        }),
    });

    const result = await useStore.getState().handleSyncNotes(false);
    expect(result.success).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 700123456 }),
    });
  });

  it('sends empty payload to /api/notes when hoyolabAccount is null', async () => {
    useStore.setState({
      hoyolabConnected: true,
      isSyncing: false,
      hoyolabAccount: null,
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          resin: { current: 160, max: 200, recovery_time_seconds: 0 },
          realm_currency: { current: 2400, max: 2400, recovery_time_seconds: 0 },
        }),
    });

    const result = await useStore.getState().handleSyncNotes(false);
    expect(result.success).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });
});
