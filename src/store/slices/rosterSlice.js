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
        weaponId, weaponProgression
      } = draft;

      const newRoster = { ...state.roster };
      let updatedWeapons = [...state.trackedWeapons];

      let charEntry = newRoster[name] || {
        level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        equippedWeaponId: null, tracked: true, calculatedCosts: null
      };

      const isTraveler = name.startsWith('Traveler ');
      const currentWeaponId = getTravelerAwareWeaponId(name, charEntry, updatedWeapons);

      if ('weaponId' in draft) {
        const targetWeaponId = weaponId || null;
        const targetWeapon = targetWeaponId ? updatedWeapons.find(w => w.id === targetWeaponId) : null;

        if (!targetWeapon) {
          // Unassign any currently equipped weapon
          if (currentWeaponId) {
            if (isTraveler) {
              updatedWeapons = updatedWeapons.map(w =>
                w.assignedTo?.startsWith('Traveler ') ? { ...w, assignedTo: null } : w
              );
            } else {
              updatedWeapons = updatedWeapons.map(w =>
                w.id === currentWeaponId ? { ...w, assignedTo: null } : w
              );
            }
          }
          charEntry = {
            ...charEntry,
            equippedWeaponId: null,
          };
        } else {
          // A valid existing weapon was selected
          // 1. If character had a different weapon before, unassign it
          if (currentWeaponId && currentWeaponId !== targetWeaponId) {
            if (isTraveler) {
              updatedWeapons = updatedWeapons.map(w =>
                w.assignedTo?.startsWith('Traveler ') && w.id !== targetWeaponId ? { ...w, assignedTo: null } : w
              );
            } else {
              updatedWeapons = updatedWeapons.map(w =>
                w.id === currentWeaponId ? { ...w, assignedTo: null } : w
              );
            }
          }

          // 2. If target weapon was assigned to another character, clean up previous owner
          if (targetWeapon.assignedTo && targetWeapon.assignedTo !== name) {
            const previousOwner = targetWeapon.assignedTo;
            if (!previousOwner.startsWith('Traveler ') && newRoster[previousOwner]) {
              newRoster[previousOwner] = {
                ...newRoster[previousOwner],
                equippedWeaponId: null,
              };
            }
          }

          // 3. Assign target weapon and update its progression
          updatedWeapons = updatedWeapons.map(w => {
            if (w.id === targetWeaponId) {
              return {
                ...w,
                assignedTo: name,
                ...(weaponProgression || {}),
              };
            }
            return w;
          });

          // 4. Update charEntry equippedWeaponId
          charEntry = {
            ...charEntry,
            equippedWeaponId: isTraveler ? null : targetWeaponId,
          };
        }
      }

      charEntry = {
        ...charEntry,
        level: level ?? charEntry.level,
        ascension: ascension ?? charEntry.ascension,
        targetLevel: targetLevel ?? charEntry.targetLevel,
        targetAscension: targetAscension ?? charEntry.targetAscension,
        talents: talents ?? charEntry.talents,
        targetTalents: targetTalents ?? charEntry.targetTalents,
      };
      charEntry = recalculateCharacterCosts(name, charEntry);
      newRoster[name] = charEntry;

      if (isTraveler) {
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

          const isTraveler = name.startsWith('Traveler ');
          if (isTraveler) {
            updatedEntry.equippedWeaponId = null;
          }

          if ('equippedWeaponId' in currentPatch && currentPatch.equippedWeaponId !== newRoster[name].equippedWeaponId) {
            // A. Unassign old weapon from this character (so the old weapon has no owner)
            if (isTraveler) {
              updatedWeapons = updatedWeapons.map(w =>
                w.assignedTo?.startsWith('Traveler ') ? { ...w, assignedTo: null } : w
              );
            } else if (newRoster[name].equippedWeaponId) {
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
                  if (!newWeapon.assignedTo.startsWith('Traveler ') && newRoster[newWeapon.assignedTo]) {
                    newRoster[newWeapon.assignedTo] = {
                      ...newRoster[newWeapon.assignedTo],
                      equippedWeaponId: null
                    }
                  }
                }

                // C. Hand the new weapon to this character
                updatedWeapons = updatedWeapons.map(w =>
                  w.id === finalWeaponId ? { ...w, assignedTo: name } : w
                )
              }

              // Ensure updatedEntry uses the valid UUID for non-Travelers, or null for Travelers
              updatedEntry.equippedWeaponId = isTraveler ? null : finalWeaponId;
            }
          }

          // Recalculate costs per user request
          const finalCharEntry = recalculateCharacterCosts(name, updatedEntry);

          newRoster[name] = finalCharEntry;
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
