export const createResinSlice = (set, get) => ({
  resinCount: 200,
  resinTimestamp: Date.now(),
  setResin: (amount) => set({
    resinCount: Math.min(200, Math.max(0, amount)),
    resinTimestamp: Date.now(),
  }),
});
