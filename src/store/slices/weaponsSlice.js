import weaponsData from '../../data/weapons.json';
import { calculateWeaponCost } from '../../utils/calculator';
import { normalizeWeaponPatch } from '../../utils/progressionContracts';
import {
  recordActivity,
  VALID_SOURCES,
  extractWeaponMeaningfulChanges,
} from '../../activity';

export const createWeaponsSlice = (set, get) => ({
  trackedWeapons: [],

  addTrackedWeapon: (weaponName, assignedTo = null, config = {}, contextArg = 'system') => {
    // Generate the ID outside set() so we can return it to the caller
    // Guard against duplicate UUID (Fixture 18)
    const existingWeapons = get().trackedWeapons || [];
    const id = config?.id && !existingWeapons.some((w) => w.id === config.id) ? config.id : crypto.randomUUID();
    const wData = weaponsData.find((w) => w.name === weaponName);
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
      hasEventBonus: Boolean(config.hasEventBonus),
      assignedTo,
      createdAt: Date.now(),
    };
    if (wData) {
      newWeapon.costs = calculateWeaponCost(
        wData,
        newWeapon.level,
        newWeapon.targetLevel,
        newWeapon.ascension,
        newWeapon.targetAscension,
        newWeapon.hasEventBonus,
        get().roster
      );
    }
    set((state) => {
      if (assignedTo && state.roster[assignedTo]) {
        const isTraveler = assignedTo.startsWith('Traveler ');
        if (isTraveler) {
          // Unassign any weapon assigned to ANY Traveler variant
          const updatedWeapons = state.trackedWeapons.map((w) =>
            w.assignedTo?.startsWith('Traveler ') ? { ...w, assignedTo: null } : w
          );
          return { trackedWeapons: [...updatedWeapons, newWeapon], roster: state.roster };
        }
        // Unassign the old weapon first
        const oldId = state.roster[assignedTo].equippedWeaponId;
        const updatedWeapons = state.trackedWeapons.map((w) =>
          w.id === oldId ? { ...w, assignedTo: null } : w
        );
        const updatedRoster = {
          ...state.roster,
          [assignedTo]: { ...state.roster[assignedTo], equippedWeaponId: id },
        };
        return { trackedWeapons: [...updatedWeapons, newWeapon], roster: updatedRoster };
      }
      return { trackedWeapons: [...state.trackedWeapons, newWeapon] };
    });

    let effectiveSource = 'system';
    let isBatchGroup = false;

    if (typeof contextArg === 'string') {
      if (VALID_SOURCES.has(contextArg)) effectiveSource = contextArg;
    } else if (typeof contextArg === 'object' && contextArg !== null) {
      if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
        effectiveSource = contextArg.source;
      }
      if (contextArg.batchGroup === true) {
        isBatchGroup = true;
      }
    }

    if (typeof config === 'object' && config !== null) {
      if (typeof config.source === 'string' && VALID_SOURCES.has(config.source)) {
        effectiveSource = config.source;
      }
      if (config.batchGroup === true) {
        isBatchGroup = true;
      }
    }

    if (!isBatchGroup) {
      try {
        const changes = [];
        if (assignedTo) {
          changes.push({
            field: 'assignedTo',
            before: null,
            after: assignedTo,
            label: 'Assigned To',
          });
        }
        recordActivity({
          category: 'weapons',
          action: 'weapon_added',
          source: effectiveSource,
          entityType: 'weapon',
          entityId: id,
          entityName: weaponName,
          summary: `Added ${weaponName} to the armory.`,
          changes,
          metadata: {
            weaponName,
            level: newWeapon.level,
            targetLevel: newWeapon.targetLevel,
            refinement: newWeapon.currentRefinement,
            assignedTo: assignedTo || null,
          },
        });
      } catch (err) {
        console.error('[Weapons] Failed to log activity event:', err);
      }
    }

    return id; // ← caller can use this to update local draft state
  },

  batchAddWeapons: (weaponsList, contextArg = 'system') => {
    if (!Array.isArray(weaponsList) || weaponsList.length === 0) return [];

    let effectiveSource = 'system';
    if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
      effectiveSource = contextArg;
    } else if (typeof contextArg === 'object' && contextArg !== null) {
      if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
        effectiveSource = contextArg.source;
      }
    }

    const addedIds = [];
    const addedNames = [];
    const weaponAssignments = [];
    let initialConfig = null;

    weaponsList.forEach((item) => {
      const weaponName = typeof item === 'string' ? item : item.weaponName || item.name;
      const assignedTo = typeof item === 'object' ? item.assignedTo || null : null;
      const config = typeof item === 'object' ? item.config || item : {};
      if (!initialConfig && typeof config === 'object' && config !== null) {
        initialConfig = config;
      }
      const newId = get().addTrackedWeapon(weaponName, assignedTo, config, {
        source: effectiveSource,
        batchGroup: true,
      });
      if (newId) {
        addedIds.push(newId);
        addedNames.push(weaponName);
        if (assignedTo) {
          weaponAssignments.push({
            weaponId: newId,
            weaponName,
            assignedTo,
          });
        }
      }
    });

    if (addedIds.length > 0) {
      try {
        recordActivity({
          category: 'weapons',
          action: 'weapons_batch_added',
          source: effectiveSource,
          entityType: 'weapon',
          entityId: 'batch_weapons',
          summary: `Added ${addedIds.length} weapon${addedIds.length === 1 ? '' : 's'} to the armory.`,
          changes: [],
          metadata: {
            addedCount: addedIds.length,
            weaponsCreated: addedIds.length,
            weaponIds: addedIds,
            weaponNames: addedNames,
            ...(weaponAssignments.length > 0 ? { weaponAssignments } : {}),
            ...(initialConfig?.currentLevel !== undefined ? { initialLevel: initialConfig.currentLevel } : {}),
            ...(initialConfig?.currentAscension !== undefined ? { initialAscension: initialConfig.currentAscension } : {}),
            ...(initialConfig?.targetLevel !== undefined ? { targetLevel: initialConfig.targetLevel } : {}),
            ...(initialConfig?.targetAscension !== undefined ? { targetAscension: initialConfig.targetAscension } : {}),
          },
        });
      } catch (err) {
        console.error('[Weapons] Failed to log activity event:', err);
      }
    }

    return addedIds;
  },

  removeTrackedWeapon: (id, contextArg = 'system') => {
    const weapon = get().trackedWeapons?.find((w) => w.id === id);
    if (!weapon) return; // not found, no-op!

    set((state) => {
      let updatedRoster = state.roster;
      if (weapon?.assignedTo && !weapon.assignedTo.startsWith('Traveler ') && state.roster[weapon.assignedTo]) {
        updatedRoster = {
          ...state.roster,
          [weapon.assignedTo]: {
            ...state.roster[weapon.assignedTo],
            equippedWeaponId: null,
          },
        };
      }
      return {
        trackedWeapons: state.trackedWeapons.filter((w) => w.id !== id),
        roster: updatedRoster,
      };
    });

    try {
      let validSource = 'system';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }
      const changes = [];
      if (weapon.assignedTo) {
        changes.push({
          field: 'assignedTo',
          before: weapon.assignedTo,
          after: null,
          label: 'Assigned To',
        });
      }
      recordActivity({
        category: 'weapons',
        action: 'weapon_removed',
        source: validSource,
        entityType: 'weapon',
        entityId: id,
        entityName: weapon.weaponName,
        summary: `Removed ${weapon.weaponName} from the armory.`,
        ...(changes.length > 0 ? { changes } : {}),
        metadata: {
          weaponName: weapon.weaponName,
          unassignedFrom: weapon.assignedTo || null,
        },
      });
    } catch (err) {
      console.error('[Weapons] Failed to log activity event:', err);
    }
  },

  batchRemoveWeapons: (ids, contextArg = 'system') => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const existingWeapons = get().trackedWeapons?.filter((w) => ids.includes(w.id)) || [];
    if (existingWeapons.length === 0) return; // no-op!

    set((state) => {
      let updatedRoster = { ...state.roster };

      ids.forEach((id) => {
        const weapon = state.trackedWeapons.find((w) => w.id === id);
        if (weapon?.assignedTo && !weapon.assignedTo.startsWith('Traveler ') && updatedRoster[weapon.assignedTo]) {
          updatedRoster[weapon.assignedTo] = {
            ...updatedRoster[weapon.assignedTo],
            equippedWeaponId: null,
          };
        }
      });

      return {
        trackedWeapons: state.trackedWeapons.filter((w) => !ids.includes(w.id)),
        roster: updatedRoster,
      };
    });

    try {
      let validSource = 'system';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }
      recordActivity({
        category: 'weapons',
        action: 'weapons_batch_removed',
        source: validSource,
        summary: `Removed ${existingWeapons.length} weapons from the armory.`,
        metadata: {
          removedCount: existingWeapons.length,
          weaponIds: existingWeapons.map((w) => w.id),
          weaponNames: existingWeapons.map((w) => w.weaponName),
        },
      });
    } catch (err) {
      console.error('[Weapons] Failed to log activity event:', err);
    }
  },

  updateTrackedWeapon: (id, patch, contextArg = 'system') => {
    const prevWeapon = get().trackedWeapons?.find((w) => w.id === id);
    if (!prevWeapon) return;

    let effectiveSource = 'system';
    let isBatchGroup = false;
    if (typeof contextArg === 'string') {
      if (VALID_SOURCES.has(contextArg)) effectiveSource = contextArg;
    } else if (typeof contextArg === 'object' && contextArg !== null) {
      if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
        effectiveSource = contextArg.source;
      }
      if (contextArg.batchGroup === true) isBatchGroup = true;
    }

    set((state) => {
      let updatedWeapons = state.trackedWeapons;
      let updatedRoster = { ...state.roster };

      const weapon = updatedWeapons.find((w) => w.id === id);
      if (!weapon) return state;

      // 1. Did the assignment change?
      if ('assignedTo' in patch && patch.assignedTo !== weapon.assignedTo) {
        // A. Unassign this weapon from its previous owner
        if (weapon.assignedTo && !weapon.assignedTo.startsWith('Traveler ') && updatedRoster[weapon.assignedTo]) {
          updatedRoster[weapon.assignedTo] = {
            ...updatedRoster[weapon.assignedTo],
            equippedWeaponId: null,
          };
        }

        // B. If the new owner already has a different weapon, rip it out of their hands
        const newCharName = patch.assignedTo;
        if (newCharName) {
          const isNewTraveler = newCharName.startsWith('Traveler ');
          if (isNewTraveler) {
            // Rip weapon out of hands of ANY Traveler variant
            updatedWeapons = updatedWeapons.map((w) =>
              w.id !== id && w.assignedTo?.startsWith('Traveler ') ? { ...w, assignedTo: null } : w
            );
            // Traveler roster entries must keep equippedWeaponId: null
          } else if (updatedRoster[newCharName]) {
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
      }

      // 2. Finally, apply the normalized patch to the target weapon itself
      const wData = weaponsData.find((wd) => wd.name === weapon.weaponName) || weapon.data;
      const normalizedPatch = normalizeWeaponPatch(weapon, patch, wData?.rarity || weapon.rarity);

      updatedWeapons = updatedWeapons.map((w) => {
        if (w.id === id) {
          const updated = { ...w, ...normalizedPatch };
          if ('currentRefinement' in patch) {
            updated.currentRefinement = Math.max(0, Math.min(5, Number(updated.currentRefinement) || 0));
          }
          if ('targetRefinement' in patch) {
            updated.targetRefinement = Math.max(0, Math.min(5, Number(updated.targetRefinement) || 0));
          }
          if (wData) {
            updated.costs = calculateWeaponCost(
              wData,
              updated.level || 1,
              updated.targetLevel || 90,
              updated.ascension || 0,
              updated.targetAscension || 6,
              Boolean(updated.hasEventBonus),
              updatedRoster
            );
          }
          return updated;
        }
        return w;
      });

      return { trackedWeapons: updatedWeapons, roster: updatedRoster };
    });

    if (isBatchGroup) return;

    try {
      const nextWeapon = get().trackedWeapons?.find((w) => w.id === id);
      if (!nextWeapon) return;

      const changes = extractWeaponMeaningfulChanges(prevWeapon, nextWeapon);
      if (changes.length === 0) {
        return; // Suppress no-op!
      }

      // Check if assignment changed
      const assignmentChanged = prevWeapon.assignedTo !== nextWeapon.assignedTo;
      const progressionChanged = changes.some((c) => c.field !== 'assignedTo');

      let action = 'weapon_updated';
      let summary = `${prevWeapon.weaponName} progression updated.`;

      if (assignmentChanged && !progressionChanged) {
        if (nextWeapon.assignedTo) {
          action = 'weapon_assigned';
          summary = `Assigned ${prevWeapon.weaponName} to ${nextWeapon.assignedTo}.`;
        } else {
          action = 'weapon_unassigned';
          summary = `Unassigned ${prevWeapon.weaponName} from ${prevWeapon.assignedTo}.`;
        }
      } else if (assignmentChanged && progressionChanged) {
        action = 'weapon_updated';
        summary = `${prevWeapon.weaponName} progression and assignment updated.`;
      }

      recordActivity({
        category: 'weapons',
        action,
        source: effectiveSource,
        entityType: 'weapon',
        entityId: id,
        entityName: prevWeapon.weaponName,
        summary,
        changes,
        metadata: {
          weaponName: prevWeapon.weaponName,
          modifiedFields: changes.map((c) => c.field),
        },
      });
    } catch (err) {
      console.error('[Weapons] Failed to log activity event:', err);
    }
  },

  bulkUpdateWeapons: (identifiersOrPayloads, patchOrSource, contextArg) => {
    if (!Array.isArray(identifiersOrPayloads) || identifiersOrPayloads.length === 0) {
      return;
    }

    const isPayloads =
      typeof identifiersOrPayloads[0] === 'object' && identifiersOrPayloads[0] !== null;

    let patch = {};
    let effectiveSource = 'system';
    let isBatchGroup = false;

    if (isPayloads) {
      if (typeof patchOrSource === 'string') {
        if (VALID_SOURCES.has(patchOrSource)) effectiveSource = patchOrSource;
      } else if (typeof patchOrSource === 'object' && patchOrSource !== null) {
        if (typeof patchOrSource.source === 'string' && VALID_SOURCES.has(patchOrSource.source)) {
          effectiveSource = patchOrSource.source;
        }
        if (patchOrSource.batchGroup === true) isBatchGroup = true;
      }
      if (typeof contextArg === 'string') {
        if (VALID_SOURCES.has(contextArg)) effectiveSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          effectiveSource = contextArg.source;
        }
        if (contextArg.batchGroup === true) isBatchGroup = true;
      }
    } else {
      if (typeof patchOrSource === 'object' && patchOrSource !== null) {
        patch = patchOrSource;
      }
      if (typeof contextArg === 'string') {
        if (VALID_SOURCES.has(contextArg)) effectiveSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          effectiveSource = contextArg.source;
        }
        if (contextArg.batchGroup === true) isBatchGroup = true;
      }
    }

    const prevWeapons = get().trackedWeapons || [];

    set((state) => {
      let updatedRoster = { ...state.roster };

      const unassignFromChar = (charName) => {
        if (charName && !charName.startsWith('Traveler ') && updatedRoster[charName]) {
          updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: null };
        }
      };

      const assignToChar = (charName, weaponId) => {
        if (charName && !charName.startsWith('Traveler ') && updatedRoster[charName]) {
          updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: weaponId };
        }
      };

      const payloadsMap = isPayloads
        ? identifiersOrPayloads.reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
        : null;

      const updatedArmory = state.trackedWeapons.map((weapon) => {
        const isMatch = isPayloads
          ? payloadsMap[weapon.id]
          : identifiersOrPayloads.includes(weapon.id) ||
            identifiersOrPayloads.includes(weapon.weaponName);

        if (isMatch) {
          const currentPatch = isPayloads ? payloadsMap[weapon.id] : patch;
          const wDataMatch = weaponsData.find((w) => w.name === weapon.weaponName);
          const normalizedPatch = normalizeWeaponPatch(
            weapon,
            currentPatch,
            wDataMatch?.rarity || weapon.rarity
          );
          const updatedWeapon = { ...weapon, ...normalizedPatch };

          if ('assignedTo' in currentPatch && currentPatch.assignedTo !== weapon.assignedTo) {
            unassignFromChar(weapon.assignedTo);
            assignToChar(currentPatch.assignedTo, weapon.id);
          }

          const wData = weaponsData.find((w) => w.name === updatedWeapon.weaponName);
          if (wData) {
            const newCosts = calculateWeaponCost(
              wData,
              updatedWeapon.level || 1,
              updatedWeapon.targetLevel || 90,
              updatedWeapon.ascension || 0,
              updatedWeapon.targetAscension || 6,
              Boolean(updatedWeapon.hasEventBonus),
              updatedRoster
            );
            return { ...updatedWeapon, costs: newCosts };
          }
          return updatedWeapon;
        }
        return weapon;
      });

      // Second pass: unassign weapons that were replaced (exempting shared Traveler weapons)
      const currentlyEquippedWeaponIds = Object.values(updatedRoster)
        .map((c) => c.equippedWeaponId)
        .filter(Boolean);
      const finalArmory = updatedArmory.map((w) => {
        if (
          w.assignedTo &&
          !w.assignedTo.startsWith('Traveler ') &&
          !currentlyEquippedWeaponIds.includes(w.id)
        ) {
          return { ...w, assignedTo: null };
        }
        return w;
      });

      return { trackedWeapons: finalArmory, roster: updatedRoster };
    });

    if (isBatchGroup) return;

    try {
      const nextWeapons = get().trackedWeapons || [];
      const changedWeapons = [];

      for (const nextW of nextWeapons) {
        const prevW = prevWeapons.find((w) => w.id === nextW.id);
        if (prevW) {
          const diffs = extractWeaponMeaningfulChanges(prevW, nextW);
          if (diffs.length > 0) {
            changedWeapons.push(nextW);
          }
        }
      }

      if (changedWeapons.length === 0) {
        return; // Suppress no-op!
      }

      recordActivity({
        category: 'weapons',
        action: 'weapons_bulk_updated',
        source: effectiveSource,
        summary: `Updated progression for ${changedWeapons.length} weapons.`,
        metadata: {
          updatedCount: changedWeapons.length,
          weaponIds: changedWeapons.map((w) => w.id),
          weaponNames: changedWeapons.map((w) => w.weaponName),
        },
      });
    } catch (err) {
      console.error('[Weapons] Failed to log activity event:', err);
    }
  },

  assignWeaponToCharacter: (weaponId, charName, contextArg = 'system') => {
    const weapon = get().trackedWeapons?.find((w) => w.id === weaponId);
    if (!weapon) return;

    // Suppress no-op if weapon is already assigned to this character
    if (weapon.assignedTo === charName) {
      return;
    }

    const prevOwner = weapon.assignedTo;
    const isTraveler = charName.startsWith('Traveler ');
    const charPrevWeaponId = isTraveler
      ? null
      : get().roster[charName]?.equippedWeaponId;

    set((state) => {
      let updatedWeapons = state.trackedWeapons;
      let updatedRoster = { ...state.roster };

      // Unassign old weapon currently on this character (or on ANY Traveler variant if assigning to Traveler)
      if (isTraveler) {
        updatedWeapons = updatedWeapons.map((w) =>
          w.id !== weaponId && w.assignedTo?.startsWith('Traveler ') ? { ...w, assignedTo: null } : w
        );
      } else {
        const charEntry = updatedRoster[charName];
        if (charEntry?.equippedWeaponId && charEntry.equippedWeaponId !== weaponId) {
          updatedWeapons = updatedWeapons.map((w) =>
            w.id === charEntry.equippedWeaponId ? { ...w, assignedTo: null } : w
          );
        }
      }

      // Unassign this weapon from any previous character
      if (
        weapon?.assignedTo &&
        weapon.assignedTo !== charName &&
        !weapon.assignedTo.startsWith('Traveler ') &&
        updatedRoster[weapon.assignedTo]
      ) {
        updatedRoster[weapon.assignedTo] = {
          ...updatedRoster[weapon.assignedTo],
          equippedWeaponId: null,
        };
      }

      // Assign the weapon to the character
      updatedWeapons = updatedWeapons.map((w) =>
        w.id === weaponId ? { ...w, assignedTo: charName } : w
      );
      if (!isTraveler && updatedRoster[charName]) {
        updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: weaponId };
      }

      return { trackedWeapons: updatedWeapons, roster: updatedRoster };
    });

    try {
      let validSource = 'system';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }
      const changes = [
        {
          field: 'assignedTo',
          before: prevOwner || null,
          after: charName,
          label: 'Assigned To',
        },
      ];
      if (charPrevWeaponId && charPrevWeaponId !== weaponId) {
        changes.push({
          field: 'displacedWeaponId',
          before: charPrevWeaponId,
          after: null,
          label: 'Replaced Weapon',
        });
      }

      recordActivity({
        category: 'weapons',
        action: 'weapon_assigned',
        source: validSource,
        entityType: 'weapon',
        entityId: weaponId,
        entityName: weapon.weaponName,
        summary: `Assigned ${weapon.weaponName} to ${charName}.`,
        changes,
        metadata: {
          weaponName: weapon.weaponName,
          previousOwner: prevOwner || null,
          newOwner: charName,
          replacedWeaponId: charPrevWeaponId || null,
        },
      });
    } catch (err) {
      console.error('[Weapons] Failed to log activity event:', err);
    }
  },

  unassignWeapon: (weaponId, contextArg = 'system') => {
    const weapon = get().trackedWeapons?.find((w) => w.id === weaponId);
    if (!weapon || !weapon.assignedTo) {
      return; // Not found or already unassigned, no-op!
    }

    const prevOwner = weapon.assignedTo;

    set((state) => {
      let updatedRoster = state.roster;
      if (weapon?.assignedTo && !weapon.assignedTo.startsWith('Traveler ') && state.roster[weapon.assignedTo]) {
        updatedRoster = {
          ...state.roster,
          [weapon.assignedTo]: { ...state.roster[weapon.assignedTo], equippedWeaponId: null },
        };
      }
      return {
        trackedWeapons: state.trackedWeapons.map((w) =>
          w.id === weaponId ? { ...w, assignedTo: null } : w
        ),
        roster: updatedRoster,
      };
    });

    try {
      let validSource = 'system';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }

      recordActivity({
        category: 'weapons',
        action: 'weapon_unassigned',
        source: validSource,
        entityType: 'weapon',
        entityId: weaponId,
        entityName: weapon.weaponName,
        summary: `Unassigned ${weapon.weaponName} from ${prevOwner}.`,
        changes: [
          {
            field: 'assignedTo',
            before: prevOwner,
            after: null,
            label: 'Assigned To',
          },
        ],
        metadata: {
          weaponName: weapon.weaponName,
          unassignedFrom: prevOwner,
        },
      });
    } catch (err) {
      console.error('[Weapons] Failed to log activity event:', err);
    }
  },
});
