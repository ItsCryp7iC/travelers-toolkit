export const createInventorySlice = (set, get) => ({
  inventory: {},

  setInventory: (materialName, qty) =>
    set((state) => ({
      inventory: { ...state.inventory, [materialName]: Math.max(0, qty) },
    })),

  incrementInventory: (materialName, amount = 1) =>
    set((state) => ({
      inventory: {
        ...state.inventory,
        [materialName]: (state.inventory[materialName] || 0) + amount,
      },
    })),
});
