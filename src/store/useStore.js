import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createSettingsSlice } from './slices/settingsSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createSyncSlice } from './slices/syncSlice';
import { createImportSlice } from './slices/importSlice';
import { createResinSlice } from './slices/resinSlice';
import { createRosterSlice } from './slices/rosterSlice';
import { createWeaponsSlice } from './slices/weaponsSlice';
import { createInventorySlice } from './slices/inventorySlice';
import { createGoalsSlice } from './slices/goalsSlice';
import { createHelpersSlice } from './slices/helpersSlice';
import { STORE_NAME, STORE_VERSION, migrateStore, partializeStore } from './persistence';

/**
 * Zustand global store for Traveler's Toolkit.
 */
const useStore = create(
  persist(
    (set, get) => ({
      ...createSettingsSlice(set, get),
      ...createSessionSlice(set, get),
      ...createSyncSlice(set, get),
      ...createImportSlice(set, get),
      ...createResinSlice(set, get),
      ...createRosterSlice(set, get),
      ...createWeaponsSlice(set, get),
      ...createInventorySlice(set, get),
      ...createGoalsSlice(set, get),
      ...createHelpersSlice(set, get),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      migrate: migrateStore,
      partialize: partializeStore,
    }
  )
);

export default useStore;
