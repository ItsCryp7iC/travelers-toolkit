import charactersData from '../../utils/characters';
import weaponsData from '../../data/weapons.json';
import { getPrimaryInventoryList } from '../../utils/dataManager';
import { calculateWeaponCost } from '../../utils/calculator';
import { syncTravelerAscension, recalculateCharacterCosts } from '../helpers/rosterHelpers';

import type { NormalizedBackupData } from '../../types/backup';
import type { NormalizedGoodPayload } from '../../types/good';
import type { Roster, TrackedWeapon, Inventory, RosterEntry, WeaponCalculatedCosts } from '../../types/domain';

// "Minimal Zustand set/get structural types"
export interface ImportSliceState {
  roster: Roster;
  trackedWeapons: TrackedWeapon[];
  inventory: Inventory;
  goals: unknown[];
  resinCount: number;
  resinTimestamp: number;
  serverRegion: string;
  showDbBuilder: boolean;
  autoBackupEnabled: boolean;
  displayTimeZone: string;
  googleConnected: boolean;
  googleUser: unknown | null;
  hoyolabConnected: boolean;
}

type StateUpdater<S> = Partial<S> | ((state: S) => Partial<S>);
type SetState<S> = (update: StateUpdater<S>) => void;

export interface ImportSliceActions {
  importData: (data: NormalizedBackupData) => void;
  importGoodData: (goodPayload: NormalizedGoodPayload) => void;
  resetStore: () => void;
}

export const createImportSlice = (set: SetState<ImportSliceState>, _get: unknown): ImportSliceActions => ({
  importData: (data) => set({
    roster: data.roster || {},
    trackedWeapons: data.trackedWeapons || [],
    inventory: data.inventory || {},
    serverRegion: data.serverRegion || 'Asia',
    showDbBuilder: data.showDbBuilder ?? false,
    displayTimeZone: data.displayTimeZone || 'auto',
  }),
  importGoodData: (goodPayload) => set((state) => {
    // 1. Materials
    const newInventory: Inventory = { ...state.inventory };
    const canonicalMats = new Set(getPrimaryInventoryList().map((m: { matKey: string }) => m.matKey));
    Object.entries(goodPayload.materials ?? {}).forEach(([matKey, qty]) => {
      if (canonicalMats.has(matKey)) {
        newInventory[matKey] = qty;
      }
    });

    // 2. Roster
    const newRoster: Roster = { ...state.roster };
    (goodPayload.characters || []).forEach(char => {
      const existing = newRoster[char.name] || {
        targetLevel: 90,
        targetAscension: 6,
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        equippedWeaponId: null,
        tracked: true,
        calculatedCosts: null
      };

      const entryUpdate: RosterEntry = {
        level: char.level,
        ascension: char.ascension,
        talents: char.talents,
        // STRICT RULE: preserve existing target properties
        targetLevel: existing.targetLevel,
        targetAscension: existing.targetAscension,
        targetTalents: existing.targetTalents,
        equippedWeaponId: existing.equippedWeaponId,
        tracked: existing.tracked,
        calculatedCosts: existing.calculatedCosts
      };

      newRoster[char.name] = entryUpdate;

      // Note: recalculateCharacterCosts mutates the entry
      recalculateCharacterCosts(char.name, newRoster[char.name]);
    });

    // 3. Weapons
    const newWeapons: TrackedWeapon[] = [];
    (goodPayload.weapons || []).forEach(w => {
       // Attempt to preserve target levels for weapons by matching name and assignment
       const existing = state.trackedWeapons.find(ew => ew.weaponName === w.weaponName && ew.assignedTo === w.location);
       const id = existing ? existing.id : crypto.randomUUID();
       const newWeapon: TrackedWeapon = {
         id,
         weapon_id: w.weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
         weaponName: w.weaponName,
         level: w.level,
         ascension: w.ascension,
         targetLevel: existing?.targetLevel ?? 90,
         targetAscension: existing?.targetAscension ?? 6,
         assignedTo: w.location || null,
         createdAt: existing?.createdAt ?? Date.now()
       };

       // Calculate weapon costs if possible
       const wData = weaponsData.find((wd: { name: string }) => wd.name === newWeapon.weaponName);
       if (wData) {
         newWeapon.costs = calculateWeaponCost(
            wData,
            newWeapon.level,
            newWeapon.targetLevel,
            newWeapon.ascension,
            newWeapon.targetAscension,
            newWeapon.hasEventBonus,
            Object.values(newRoster)
         ) as WeaponCalculatedCosts;
       }

       newWeapons.push(newWeapon);

       if (w.location && newRoster[w.location]) {
         newRoster[w.location].equippedWeaponId = id;
       }
    });

    syncTravelerAscension(newRoster);

    return {
      inventory: newInventory,
      roster: newRoster,
      trackedWeapons: newWeapons,
    };
  }),
  resetStore: () => {
    set({
      roster: {},
      trackedWeapons: [],
      inventory: {},
      goals: [],
      resinCount: 200,
      resinTimestamp: Date.now(),
      serverRegion: 'Asia',
      showDbBuilder: false,
      autoBackupEnabled: false,
      displayTimeZone: 'auto',
      googleConnected: false,
      googleUser: null,
      hoyolabConnected: false,
    });
  },
});
