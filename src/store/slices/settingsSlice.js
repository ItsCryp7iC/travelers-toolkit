export const createSettingsSlice = (set, get) => ({
  serverRegion: 'Asia',
  setServerRegion: (region) => set({ serverRegion: region }),
  showDbBuilder: false,
  setShowDbBuilder: (show) => set({ showDbBuilder: show }),
  autoBackupEnabled: false,
  setAutoBackupEnabled: (val) => set({ autoBackupEnabled: val }),
});
