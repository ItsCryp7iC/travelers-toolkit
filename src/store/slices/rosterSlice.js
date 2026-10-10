import { syncTravelerAscension, recalculateCharacterCosts } from '../helpers/rosterHelpers';
import { getTravelerAwareWeaponId } from '../../utils/travelerHelper';

export const createRosterSlice = (set, get) => ({
  roster: {},

  addCharacter: (name) =>
    set((state) => {
      if (state.roster[name]) return state // already exists, no-op
      return {
        roster: {
          ...state.roster,
          [name]: {
            level: 1,
            ascension: 0,
            targetLevel: 90,
            targetAscension: 6,
            talents:       { normal: 1, skill: 1, burst: 1 },
            targetTalents: { normal: 10, skill: 10, burst: 10 },
            equippedWeaponId: null, // references trackedWeapons[].id
            tracked: true,
            calculatedCosts: null
          },
        },
      }
    }),

  saveCharacterDraft: (name, draft) =>
    set((state) => {
      const {
        level, ascension, targetLevel, targetAscension, talents, targetTalents,
        weaponName, weaponProgression
      } = draft;

      const newRoster = { ...state.roster };
      let updatedWeapons = [...state.trackedWeapons];

      let charEntry = newRoster[name] || {
        level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        equippedWeaponId: null, tracked: true, calculatedCosts: null
      };

      let finalWeaponId = getTravelerAwareWeaponId(name, charEntry, updatedWeapons);
      const currentWeapon = finalWeaponId ? updatedWeapons.find(w => w.id === finalWeaponId) : null;

      if (!weaponName) {
        if (finalWeaponId) {
          updatedWeapons = updatedWeapons.map(w => w.id === finalWeaponId ? { ...w, assignedTo: null } : w);
          finalWeaponId = null;
        }
      } else {
        if (currentWeapon && currentWeapon.weaponName === weaponName) {
          updatedWeapons = updatedWeapons.map(w => w.id === finalWeaponId ? { ...w, ...weaponProgression } : w);
        } else {
          if (finalWeaponId) {
            updatedWeapons = updatedWeapons.map(w => w.id === finalWeaponId ? { ...w, assignedTo: null } : w);
          }
          finalWeaponId = crypto.randomUUID();
          updatedWeapons.push({
            id: finalWeaponId,
            weapon_id: weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
            weaponName: weaponName,
            assignedTo: name,
            createdAt: Date.now(),
            currentRefinement: 1,
            targetRefinement: 1,
            ...weaponProgression
          });
        }
      }

      const isTraveler = name.startsWith('Traveler ');
      charEntry = {
        ...charEntry,
        level, ascension, targetLevel, targetAscension,
        talents, targetTalents,
        equippedWeaponId: isTraveler ? null : finalWeaponId
      };
      charEntry = recalculateCharacterCosts(name, charEntry);
      newRoster[name] = charEntry;

      if (name.startsWith('Traveler ')) {
        syncTravelerAscension(newRoster, name);
      }

      return { roster: newRoster, trackedWeapons: updatedWeapons };
    }),

  batchAddCharacters: (namesArray) =>
    set((state) => {
      let hasChanges = false
      const newRoster = { ...state.roster }

      namesArray.forEach((name) => {
        if (!newRoster[name]) {
          newRoster[name] = {
            level: 1,
            ascension: 0,
            targetLevel: 90,
            targetAscension: 6,
            talents:       { normal: 1, skill: 1, burst: 1 },
            targetTalents: { normal: 10, skill: 10, burst: 10 },
            equippedWeaponId: null,
            tracked: true,
            calculatedCosts: null
          }
          hasChanges = true
        }
      })

      if (!hasChanges) return state
      syncTravelerAscension(newRoster);
      return { roster: newRoster }
    }),

  removeCharacter: (name) =>
    set((state) => {
      const next = { ...state.roster }
      delete next[name]
      // Unassign any weapon that was pointing to this character
      const updatedWeapons = state.trackedWeapons.map((w) =>
        w.assignedTo === name ? { ...w, assignedTo: null } : w
      )
      return { roster: next, trackedWeapons: updatedWeapons }
    }),

  batchRemoveCharacters: (names) =>
    set((state) => {
      const next = { ...state.roster }
      names.forEach(name => delete next[name])

      // Unassign any weapon that was pointing to any of these characters
      const updatedWeapons = state.trackedWeapons.map((w) =>
        names.includes(w.assignedTo) ? { ...w, assignedTo: null } : w
      )
      return { roster: next, trackedWeapons: updatedWeapons }
    }),

  updateCharacter: (name, patch) =>
    set((state) => {
      let charEntry = { ...state.roster[name], ...patch }
      charEntry = recalculateCharacterCosts(name, charEntry)

      const newRoster = {
        ...state.roster,
        [name]: charEntry,
      }
      if (name.startsWith('Traveler ')) {
        syncTravelerAscension(newRoster, name);
      }
      return { roster: newRoster }
    }),

  bulkUpdateCharacters: (identifiersOrPayloads, patch) =>
    set((state) => {
      const isFirstArgPayloads = Array.isArray(identifiersOrPayloads) && identifiersOrPayloads.length > 0 && typeof identifiersOrPayloads[0] === 'object';
      const isSecondArgPayloads = Array.isArray(patch) && patch.length > 0 && typeof patch[0] === 'object';
      const isPayloads = isFirstArgPayloads || isSecondArgPayloads;

      const payloadsArray = isFirstArgPayloads ? identifiersOrPayloads : (isSecondArgPayloads ? patch : null);

      const newRoster = { ...state.roster }
      let updatedWeapons = state.trackedWeapons;
      let hasChanges = false

      const payloadsMap = isPayloads ?
        payloadsArray.reduce((acc, p) => ({ ...acc, [p.name]: p }), {}) :
        null;

      const targetNames = isPayloads ? payloadsArray.map(p => p.name) : identifiersOrPayloads;

      targetNames.forEach((name) => {
        if (newRoster[name]) {
          const currentPatch = isPayloads ? payloadsMap[name] : patch;
          const updatedEntry = { ...newRoster[name], ...currentPatch }

          if ('equippedWeaponId' in currentPatch && currentPatch.equippedWeaponId !== newRoster[name].equippedWeaponId) {
            // A. Unassign old weapon from this character (so the old weapon has no owner)
            if (newRoster[name].equippedWeaponId) {
              updatedWeapons = updatedWeapons.map(w =>
                w.id === newRoster[name].equippedWeaponId ? { ...w, assignedTo: null } : w
              )
            }

            // B. The new weapon might belong to someone else. Rip it out of their hands.
            const newWeaponIdStr = currentPatch.equippedWeaponId;
            if (newWeaponIdStr) {
              let finalWeaponId = newWeaponIdStr;
              if (newWeaponIdStr.startsWith('NEW:')) {
                const weaponName = newWeaponIdStr.substring(4);
                finalWeaponId = crypto.randomUUID();
                const newWeapon = {
                  id: finalWeaponId,
                  weapon_id: weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
                  weaponName: weaponName,
                  level: 1,
                  ascension: 0,
                  targetLevel: 90,
                  targetAscension: 6,
                  assignedTo: name,
                  createdAt: Date.now(),
                };
                updatedWeapons = [...updatedWeapons, newWeapon];
              } else {
                const newWeapon = updatedWeapons.find(w => w.id === finalWeaponId);
                if (newWeapon && newWeapon.assignedTo && newWeapon.assignedTo !== name) {
                  newRoster[newWeapon.assignedTo] = {
                    ...newRoster[newWeapon.assignedTo],
                    equippedWeaponId: null
                  }
                }

                // C. Hand the new weapon to this character
                updatedWeapons = updatedWeapons.map(w =>
                  w.id === finalWeaponId ? { ...w, assignedTo: name } : w
                )
              }

              // Ensure updatedEntry uses the valid UUID instead of the 'NEW:' placeholder
              updatedEntry.equippedWeaponId = finalWeaponId;
            }
          }

          // Recalculate costs per user request
          recalculateCharacterCosts(name, updatedEntry);

          newRoster[name] = updatedEntry
          hasChanges = true
        }
      })
      if (!hasChanges) return state

      if (targetNames.some(name => name.startsWith('Traveler '))) {
        const travelerNames = targetNames.filter(name => name.startsWith('Traveler '));
        syncTravelerAscension(newRoster, travelerNames[travelerNames.length - 1]);
      }

      return { roster: newRoster, trackedWeapons: updatedWeapons }
    }),

  isInRoster: (name) => Boolean(get().roster[name]),
});
