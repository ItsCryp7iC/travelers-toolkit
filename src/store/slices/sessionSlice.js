export const createSessionSlice = (set, get) => ({
  googleConnected: false,
  googleUser: null,
  checkGoogleSession: async () => {
    try {
      const res = await fetch('/api/google/session');
      if (res.ok) {
        const data = await res.json();
        set({ googleConnected: data.connected, googleUser: data.user || null });
        return data.connected;
      }
    } catch (err) {
      console.error(err);
    }
    set({ googleConnected: false, googleUser: null });
    return false;
  },
  disconnectGoogleSession: async () => {
    try {
      await fetch('/api/google/session', { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
    set({ googleConnected: false, googleUser: null });
  },

  hoyolabConnected: false,
  setHoyolabConnected: (val) => set({ hoyolabConnected: val }),
  checkHoyolabSession: async () => {
    try {
      const res = await fetch('/api/hoyolab/session');
      if (res.ok) {
        const data = await res.json();
        set({ hoyolabConnected: data.connected });
        return data.connected;
      }
    } catch (err) {
      console.error(err);
    }
    set({ hoyolabConnected: false });
    return false;
  },
  connectHoyolabSession: async (ltuid, ltoken) => {
    try {
      const res = await fetch('/api/hoyolab/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ltuid, ltoken })
      });
      if (res.ok) {
        const data = await res.json();
        set({ hoyolabConnected: data.connected });
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({}));
        return { error: 'auth_failed', message: errData.detail || 'Authentication failed.' };
      }
    } catch (err) {
      console.error(err);
      return { error: err.message };
    }
  },
  disconnectHoyolabSession: async () => {
    try {
      await fetch('/api/hoyolab/session', { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
    set({ hoyolabConnected: false });
  },
});
