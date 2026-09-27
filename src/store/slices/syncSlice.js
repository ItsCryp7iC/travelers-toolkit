export const createSyncSlice = (set, get) => ({
  syncPayload: null,
  isSyncing: false,
  setSyncPayload: (payload) => set({ syncPayload: payload }),
  setIsSyncing: (val) => set({ isSyncing: val }),
  handleSyncNotes: async (isAuto = false) => {
    const { hoyolabConnected, setHoyolabConnected } = get();
    if (!hoyolabConnected) return { error: 'no_cookie' };

    set({ isSyncing: true });
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.detail || 'Authentication failed.';
        if (res.status === 401) {
          setHoyolabConnected(false);
          return { error: 'auth_failed', message: errMsg };
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      const now = Date.now();
      if (data.resin) data.resin.targetFullTime = now + (data.resin.recovery_time_seconds * 1000);
      if (data.realm_currency) data.realm_currency.targetFullTime = now + (data.realm_currency.recovery_time_seconds * 1000);
      set({ syncPayload: data });
      return { success: true };
    } catch (err) {
      console.error(err);
      return { error: err.message };
    } finally {
      set({ isSyncing: false });
    }
  },
});
