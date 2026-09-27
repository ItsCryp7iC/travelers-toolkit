export const createHelpersSlice = (set, get) => ({
  getRosterCount: () => Object.keys(get().roster).length,
  getFiveStarCount: (characters) =>
    Object.keys(get().roster).filter(
      (name) => characters.find((c) => c.name === name)?.rarity === 5
    ).length,
});
