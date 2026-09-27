import charactersData from '../../utils/characters';
import weaponsData from '../../data/weapons.json';
import { getPrimaryInventoryList } from '../../utils/dataManager';
import { calculateWeaponCost } from '../../utils/calculator';
import { syncTravelerAscension, recalculateCharacterCosts } from '../helpers/rosterHelpers';

export const createImportSlice = (set, get) => ({
  importData: (data) => set({
    roster: data.roster || {},
    trackedWeapons: data.trackedWeapons || [],
    inventory: data.inventory || {},
    serverRegion: data.serverRegion || 'Asia',
    showDbBuilder: data.showDbBuilder ?? false,
  }),
  importGoodData: (goodPayload) => set((state) => {
    // 1. Materials
    const newInventory = { ...state.inventory };
    const canonicalMats = new Set(getPrimaryInventoryList().map(m => m.matKey));
    Object.entries(goodPayload.materials || {}).forEach(([matKey, qty]) => {
      if (canonicalMats.has(matKey)) {
        newInventory[matKey] = qty;
      }
    });

    // 2. Roster
    const newRoster = { ...state.roster };
    (goodPayload.characters || []).forEach(char => {
      const existing = newRoster[char.name] || {
        targetLevel: 90,
        targetAscension: 6,
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        equippedWeaponId: null,
        tracked: true,
        calculatedCosts: null
      };

      newRoster[char.name] = {
        ...existing,
        level: char.level,
        ascension: char.ascension,
        talents: char.talents,
        // STRICT RULE: preserve existing target properties
        targetLevel: existing.targetLevel,
        targetAscension: existing.targetAscension,
        targetTalents: existing.targetTalents,
      };

      recalculateCharacterCosts(char.name, newRoster[char.name]);
    });

    // 3. Weapons
    let newWeapons = [];
    (goodPayload.weapons || []).forEach(w => {
       // Attempt to preserve target levels for weapons by matching name and assignment
       const existing = state.trackedWeapons.find(ew => ew.weaponName === w.weaponName && ew.assignedTo === w.location);
       const id = existing ? existing.id : crypto.randomUUID();
       const newWeapon = {
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
       const wData = weaponsData.find(wd => wd.name === newWeapon.weaponName);
       if (wData) {
         newWeapon.costs = calculateWeaponCost(
            wData,
            newWeapon.level,
            newWeapon.targetLevel,
            newWeapon.ascension,
            newWeapon.targetAscension,
            newWeapon.hasEventBonus,
            Object.values(newRoster)
         );
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
      googleConnected: false,
      googleUser: null,
      hoyolabConnected: false,
    })
  },
});
