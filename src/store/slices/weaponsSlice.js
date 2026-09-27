import weaponsData from '../../data/weapons.json';
import { calculateWeaponCost } from '../../utils/calculator';

export const createWeaponsSlice = (set, get) => ({
  trackedWeapons: [],

  addTrackedWeapon: (weaponName, assignedTo = null, config = {}) => {
    // Generate the ID outside set() so we can return it to the caller
    const id = crypto.randomUUID()
    const newWeapon = {
      id,
      weapon_id: weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
      weaponName,
      level: config.currentLevel ?? 1,
      ascension: config.currentAscension ?? 0,
      targetLevel: config.targetLevel ?? 90,
      targetAscension: config.targetAscension ?? 6,
      currentRefinement: config.currentRefinement ?? 1,
      targetRefinement: config.targetRefinement ?? 1,
      assignedTo,
      createdAt: Date.now(),
    }
    set((state) => {
      let updatedRoster = state.roster
      if (assignedTo && state.roster[assignedTo]) {
        // Unassign the old weapon first
        const oldId = state.roster[assignedTo].equippedWeaponId
        const updatedWeapons = state.trackedWeapons.map((w) =>
          w.id === oldId ? { ...w, assignedTo: null } : w
        )
        updatedRoster = {
          ...state.roster,
          [assignedTo]: { ...state.roster[assignedTo], equippedWeaponId: id },
        }
        return { trackedWeapons: [...updatedWeapons, newWeapon], roster: updatedRoster }
      }
      return { trackedWeapons: [...state.trackedWeapons, newWeapon] }
    })
    return id // ← caller can use this to update local draft state
  },

  removeTrackedWeapon: (id) =>
    set((state) => {
      const weapon = state.trackedWeapons.find((w) => w.id === id)
      let updatedRoster = state.roster
      if (weapon?.assignedTo && state.roster[weapon.assignedTo]) {
        updatedRoster = {
          ...state.roster,
          [weapon.assignedTo]: {
            ...state.roster[weapon.assignedTo],
            equippedWeaponId: null,
          },
        }
      }
      return {
        trackedWeapons: state.trackedWeapons.filter((w) => w.id !== id),
        roster: updatedRoster,
      }
    }),

  batchRemoveWeapons: (ids) =>
    set((state) => {
      let updatedRoster = { ...state.roster }

      ids.forEach(id => {
        const weapon = state.trackedWeapons.find(w => w.id === id)
        if (weapon?.assignedTo && updatedRoster[weapon.assignedTo]) {
          updatedRoster[weapon.assignedTo] = {
            ...updatedRoster[weapon.assignedTo],
            equippedWeaponId: null,
          }
        }
      })

      return {
        trackedWeapons: state.trackedWeapons.filter((w) => !ids.includes(w.id)),
        roster: updatedRoster,
      }
    }),

  updateTrackedWeapon: (id, patch) =>
    set((state) => {
      let updatedWeapons = state.trackedWeapons;
      let updatedRoster = { ...state.roster };

      const weapon = updatedWeapons.find((w) => w.id === id);
      if (!weapon) return state;

      // 1. Did the assignment change?
      if ('assignedTo' in patch && patch.assignedTo !== weapon.assignedTo) {

        // A. Unassign this weapon from its previous owner
        if (weapon.assignedTo && updatedRoster[weapon.assignedTo]) {
          updatedRoster[weapon.assignedTo] = {
            ...updatedRoster[weapon.assignedTo],
            equippedWeaponId: null,
          };
        }

        // B. If the new owner already has a different weapon, rip it out of their hands
        const newCharName = patch.assignedTo;
        if (newCharName && updatedRoster[newCharName]) {
          const charPreviousWeaponId = updatedRoster[newCharName].equippedWeaponId;
          if (charPreviousWeaponId && charPreviousWeaponId !== id) {
            updatedWeapons = updatedWeapons.map((w) =>
              w.id === charPreviousWeaponId ? { ...w, assignedTo: null } : w
            );
          }

          // C. Hand the new owner this weapon
          updatedRoster[newCharName] = {
            ...updatedRoster[newCharName],
            equippedWeaponId: id,
          };
        }
      }

      // 2. Finally, apply the standard patch to the target weapon itself
      updatedWeapons = updatedWeapons.map((w) => {
        if (w.id === id) {
          const updated = { ...w, ...patch };
          if ('currentRefinement' in patch) {
            updated.currentRefinement = Math.max(0, Math.min(5, Number(updated.currentRefinement) || 0));
          }
          if ('targetRefinement' in patch) {
            updated.targetRefinement = Math.max(0, Math.min(5, Number(updated.targetRefinement) || 0));
          }
          return updated;
        }
        return w;
      });

      return { trackedWeapons: updatedWeapons, roster: updatedRoster };
    }),

  bulkUpdateWeapons: (identifiersOrPayloads, patch) =>
    set((state) => {
      const isPayloads = Array.isArray(identifiersOrPayloads) && identifiersOrPayloads.length > 0 && typeof identifiersOrPayloads[0] === 'object';

      let updatedRoster = { ...state.roster };

      const unassignFromChar = (charName) => {
         if (charName && updatedRoster[charName]) {
             updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: null };
         }
      }

      const assignToChar = (charName, weaponId) => {
         if (charName && updatedRoster[charName]) {
             updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: weaponId };
         }
      }

      const payloadsMap = isPayloads ?
        identifiersOrPayloads.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) :
        null;

      const updatedArmory = state.trackedWeapons.map(weapon => {
        const isMatch = isPayloads ? payloadsMap[weapon.id] : (identifiersOrPayloads.includes(weapon.id) || identifiersOrPayloads.includes(weapon.weaponName));

        if (isMatch) {
          const currentPatch = isPayloads ? payloadsMap[weapon.id] : patch;
          const updatedWeapon = { ...weapon, ...currentPatch };

          if ('assignedTo' in currentPatch && currentPatch.assignedTo !== weapon.assignedTo) {
             unassignFromChar(weapon.assignedTo);
             if (currentPatch.assignedTo && updatedRoster[currentPatch.assignedTo]?.equippedWeaponId) {
                 // The character already has a weapon; we will unassign it in the second pass
             }
             assignToChar(currentPatch.assignedTo, weapon.id);
          }

          const wData = weaponsData.find(w => w.name === updatedWeapon.weaponName);
          if (wData) {
            const newCosts = calculateWeaponCost(
              wData,
              updatedWeapon.level || 1,
              updatedWeapon.targetLevel || 90,
              updatedWeapon.ascension || 0,
              updatedWeapon.targetAscension || 6,
              updatedWeapon.hasEventBonus,
              Object.values(state.roster)
            );
            return { ...updatedWeapon, costs: newCosts };
          }
          return updatedWeapon;
        }
        return weapon;
      });

      // Second pass: unassign weapons that were replaced
      const currentlyEquippedWeaponIds = Object.values(updatedRoster).map(c => c.equippedWeaponId).filter(Boolean);
      const finalArmory = updatedArmory.map(w => {
         if (w.assignedTo && !currentlyEquippedWeaponIds.includes(w.id)) {
             return { ...w, assignedTo: null };
         }
         return w;
      });

      return { trackedWeapons: finalArmory, roster: updatedRoster };
    }),

  assignWeaponToCharacter: (weaponId, charName) =>
    set((state) => {
      let updatedWeapons = state.trackedWeapons
      let updatedRoster = { ...state.roster }

      // Unassign old weapon currently on this character
      const charEntry = updatedRoster[charName]
      if (charEntry?.equippedWeaponId && charEntry.equippedWeaponId !== weaponId) {
        updatedWeapons = updatedWeapons.map((w) =>
          w.id === charEntry.equippedWeaponId ? { ...w, assignedTo: null } : w
        )
      }

      // Unassign this weapon from any previous character
      const weapon = updatedWeapons.find((w) => w.id === weaponId)
      if (weapon?.assignedTo && weapon.assignedTo !== charName) {
        updatedRoster = {
          ...updatedRoster,
          [weapon.assignedTo]: { ...updatedRoster[weapon.assignedTo], equippedWeaponId: null },
        }
      }

      // Assign the weapon to the character
      updatedWeapons = updatedWeapons.map((w) =>
        w.id === weaponId ? { ...w, assignedTo: charName } : w
      )
      updatedRoster = {
        ...updatedRoster,
        [charName]: { ...updatedRoster[charName], equippedWeaponId: weaponId },
      }

      return { trackedWeapons: updatedWeapons, roster: updatedRoster }
    }),

  unassignWeapon: (weaponId) =>
    set((state) => {
      const weapon = state.trackedWeapons.find((w) => w.id === weaponId)
      let updatedRoster = state.roster
      if (weapon?.assignedTo && state.roster[weapon.assignedTo]) {
        updatedRoster = {
          ...state.roster,
          [weapon.assignedTo]: { ...state.roster[weapon.assignedTo], equippedWeaponId: null },
        }
      }
      return {
        trackedWeapons: state.trackedWeapons.map((w) =>
          w.id === weaponId ? { ...w, assignedTo: null } : w
        ),
        roster: updatedRoster,
      }
    }),
});
