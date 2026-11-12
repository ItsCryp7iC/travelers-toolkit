import { normalizeCharacterPatch } from '../../utils/progressionContracts';
import { syncTravelerAscension, recalculateCharacterCosts } from '../helpers/rosterHelpers';
import { getTravelerAwareWeaponId } from '../../utils/travelerHelper';
import {
  recordActivity,
  VALID_SOURCES,
  extractCharacterMeaningfulChanges,
  extractWeaponMeaningfulChanges,
} from '../../activity';

export const createRosterSlice = (set, get) => ({
  roster: {},

  addCharacter: (name, contextArg = 'system') => {
    if (typeof name !== 'string' || !name.trim()) return;
    const canonicalName = name.trim();
    const currentRoster = get().roster || {};
    if (currentRoster[canonicalName]) return; // already exists, no-op

    set((state) => ({
      roster: {
        ...state.roster,
        [canonicalName]: {
          level: 1,
          ascension: 0,
          targetLevel: 90,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: null, // references trackedWeapons[].id
          tracked: true,
          calculatedCosts: null,
        },
      },
    }));

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
        category: 'characters',
        action: 'character_added',
        source: validSource,
        entityType: 'character',
        entityId: canonicalName,
        entityName: canonicalName,
        summary: `Added ${canonicalName} to the character roster.`,
        changes: [
          { field: 'level', before: null, after: 1, label: 'Level' },
          { field: 'ascension', before: null, after: 0, label: 'Ascension' },
          { field: 'targetLevel', before: null, after: 90, label: 'Target Level' },
          { field: 'targetAscension', before: null, after: 6, label: 'Target Ascension' },
        ],
        metadata: {
          initialLevel: 1,
          targetLevel: 90,
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  saveCharacterDraft: (name, draft, contextArg = 'character_modal') => {
    const prevRoster = get().roster || {};
    const prevChar = prevRoster[name];
    const prevWeapons = get().trackedWeapons || [];

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

      const rawProgression = {
        ...(level !== undefined ? { level } : {}),
        ...(ascension !== undefined ? { ascension } : {}),
        ...(targetLevel !== undefined ? { targetLevel } : {}),
        ...(targetAscension !== undefined ? { targetAscension } : {}),
      };
      const normalizedProgression = normalizeCharacterPatch(charEntry, rawProgression);

      charEntry = {
        ...charEntry,
        ...normalizedProgression,
        talents: talents ?? charEntry.talents,
        targetTalents: targetTalents ?? charEntry.targetTalents,
      };
      charEntry = recalculateCharacterCosts(name, charEntry);
      newRoster[name] = charEntry;

      if (isTraveler) {
        syncTravelerAscension(newRoster, name);
      }

      return { roster: newRoster, trackedWeapons: updatedWeapons };
    });

    try {
      const nextRoster = get().roster || {};
      const nextChar = nextRoster[name];
      const nextWeapons = get().trackedWeapons || [];

      if (!nextChar) return;

      let validSource = 'character_modal';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }

      if (!prevChar) {
        recordActivity({
          category: 'characters',
          action: 'character_added',
          source: validSource,
          entityType: 'character',
          entityId: name,
          entityName: name,
          summary: `Added ${name} to the character roster.`,
          changes: extractCharacterMeaningfulChanges(null, nextChar),
          metadata: {
            initialLevel: nextChar.level,
            targetLevel: nextChar.targetLevel,
          },
        });
        return;
      }

      const charChanges = extractCharacterMeaningfulChanges(prevChar, nextChar);

      // Weapon assignment diff
      const isTraveler = name.startsWith('Traveler ');
      if (isTraveler) {
        const prevW = prevWeapons.find((w) => w.assignedTo?.startsWith('Traveler '));
        const nextW = nextWeapons.find((w) => w.assignedTo?.startsWith('Traveler '));
        if (prevW?.id !== nextW?.id) {
          charChanges.push({
            field: 'equippedWeapon',
            label: 'Equipped Weapon',
            before: prevW?.weaponName || null,
            after: nextW?.weaponName || null,
          });
        }
      } else {
        if (prevChar.equippedWeaponId !== nextChar.equippedWeaponId) {
          const prevW = prevWeapons.find((w) => w.id === prevChar.equippedWeaponId);
          const nextW = nextWeapons.find((w) => w.id === nextChar.equippedWeaponId);
          const idx = charChanges.findIndex((c) => c.field === 'equippedWeaponId');
          if (idx >= 0) {
            charChanges[idx] = {
              field: 'equippedWeapon',
              label: 'Equipped Weapon',
              before: prevW?.weaponName || prevChar.equippedWeaponId || null,
              after: nextW?.weaponName || nextChar.equippedWeaponId || null,
            };
          } else {
            charChanges.push({
              field: 'equippedWeapon',
              label: 'Equipped Weapon',
              before: prevW?.weaponName || prevChar.equippedWeaponId || null,
              after: nextW?.weaponName || nextChar.equippedWeaponId || null,
            });
          }
        }
      }

      // Check weapon progression diff on equipped weapon if provided
      if (draft && draft.weaponProgression) {
        const assignedWId = isTraveler
          ? nextWeapons.find((w) => w.assignedTo?.startsWith('Traveler '))?.id
          : nextChar.equippedWeaponId;
        if (assignedWId) {
          const prevW = prevWeapons.find((w) => w.id === assignedWId);
          const nextW = nextWeapons.find((w) => w.id === assignedWId);
          if (prevW && nextW) {
            const wDiffs = extractWeaponMeaningfulChanges(prevW, nextW);
            for (const wd of wDiffs) {
              if (wd.field !== 'assignedTo') {
                charChanges.push({
                  field: `weapon.${wd.field}`,
                  label: `Equipped Weapon ${wd.label || wd.field}`,
                  before: wd.before,
                  after: wd.after,
                  ...(wd.delta !== undefined ? { delta: wd.delta } : {}),
                });
              }
            }
          }
        }
      }

      if (charChanges.length === 0) {
        return; // Suppress no-op!
      }

      recordActivity({
        category: 'characters',
        action: 'character_updated',
        source: validSource,
        entityType: 'character',
        entityId: name,
        entityName: name,
        summary: `${name}'s progression updated.`,
        changes: charChanges,
        metadata: {
          modifiedFields: charChanges.map((c) => c.field),
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  batchAddCharacters: (namesArray, configOrSource = 'system', trailingContext = {}) => {
    if (!Array.isArray(namesArray) || namesArray.length === 0) return;
    const prevRoster = get().roster || {};

    let effectiveSource = 'system';
    let initialConfig = null;
    let isBatchGroup = false;

    if (typeof configOrSource === 'string') {
      if (VALID_SOURCES.has(configOrSource)) effectiveSource = configOrSource;
      if (typeof trailingContext === 'object' && trailingContext !== null) {
        initialConfig = trailingContext;
        if (trailingContext.batchGroup === true) isBatchGroup = true;
      }
    } else if (typeof configOrSource === 'object' && configOrSource !== null) {
      initialConfig = configOrSource;
      if (typeof configOrSource.source === 'string' && VALID_SOURCES.has(configOrSource.source)) {
        effectiveSource = configOrSource.source;
      }
      if (configOrSource.batchGroup === true) isBatchGroup = true;
      if (typeof trailingContext === 'object' && trailingContext !== null) {
        if (trailingContext.batchGroup === true) isBatchGroup = true;
        if (typeof trailingContext.source === 'string' && VALID_SOURCES.has(trailingContext.source)) {
          effectiveSource = trailingContext.source;
        }
      } else if (typeof trailingContext === 'string' && VALID_SOURCES.has(trailingContext)) {
        effectiveSource = trailingContext;
      }
    }

    set((state) => {
      let hasChanges = false;
      const newRoster = { ...state.roster };

      namesArray.forEach((name) => {
        if (!newRoster[name]) {
          let charEntry = {
            level: initialConfig?.level ?? 1,
            ascension: initialConfig?.ascension ?? 0,
            targetLevel: initialConfig?.targetLevel ?? 90,
            targetAscension: initialConfig?.targetAscension ?? 6,
            talents: {
              normal: initialConfig?.talents?.normal ?? 1,
              skill: initialConfig?.talents?.skill ?? 1,
              burst: initialConfig?.talents?.burst ?? 1,
            },
            targetTalents: {
              normal: initialConfig?.targetTalents?.normal ?? 10,
              skill: initialConfig?.targetTalents?.skill ?? 10,
              burst: initialConfig?.targetTalents?.burst ?? 10,
            },
            equippedWeaponId: null,
            tracked: true,
            calculatedCosts: null,
          };
          charEntry = recalculateCharacterCosts(name, charEntry);
          newRoster[name] = charEntry;
          hasChanges = true;
        }
      });

      if (!hasChanges) return state;
      syncTravelerAscension(newRoster);
      return { roster: newRoster };
    });

    try {
      const nextRoster = get().roster || {};
      const addedNames = namesArray.filter(
        (name) => !prevRoster[name] && Boolean(nextRoster[name])
      );

      if (addedNames.length === 0) {
        return; // Suppress no-op
      }

      if (isBatchGroup) {
        return; // Suppressed for grouped workflow (e.g. AddCharacterModal)
      }

      recordActivity({
        category: 'characters',
        action: 'characters_batch_added',
        source: effectiveSource,
        entityType: 'character',
        entityId: 'batch_characters',
        summary: `Added ${addedNames.length} character${addedNames.length === 1 ? '' : 's'} to the roster.`,
        changes: [],
        metadata: {
          addedCount: addedNames.length,
          characterNames: addedNames.slice(0, 50),
          ...(initialConfig ? { initialLevel: initialConfig.level, initialAscension: initialConfig.ascension } : {}),
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  removeCharacter: (name, contextArg = 'system') => {
    if (typeof name !== 'string' || !name.trim()) return;
    const canonicalName = name.trim();
    const prevRoster = get().roster || {};
    const prevChar = prevRoster[canonicalName];
    if (!prevChar) return; // not in roster, no-op!

    const prevWeapons = get().trackedWeapons || [];
    const unassignedWeapons = prevWeapons.filter(
      (w) => w.assignedTo === canonicalName
    );

    set((state) => {
      const next = { ...state.roster };
      delete next[canonicalName];
      // Unassign any weapon that was pointing to this character
      const updatedWeapons = state.trackedWeapons.map((w) =>
        w.assignedTo === canonicalName ? { ...w, assignedTo: null } : w
      );
      return { roster: next, trackedWeapons: updatedWeapons };
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
      if (unassignedWeapons.length > 0) {
        unassignedWeapons.forEach((w) => {
          changes.push({
            field: 'equippedWeapon',
            before: w.weaponName,
            after: null,
            label: 'Equipped Weapon',
          });
        });
      }

      recordActivity({
        category: 'characters',
        action: 'character_removed',
        source: validSource,
        entityType: 'character',
        entityId: canonicalName,
        entityName: canonicalName,
        summary: `Removed ${canonicalName} from the character roster.`,
        ...(changes.length > 0 ? { changes } : {}),
        metadata: {
          unassignedWeaponIds: unassignedWeapons.map((w) => w.id),
          unassignedWeaponCount: unassignedWeapons.length,
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  batchRemoveCharacters: (names, contextArg = 'system') => {
    if (!Array.isArray(names) || names.length === 0) return;
    const prevRoster = get().roster || {};
    const actuallyRemoved = names.filter((n) => Boolean(prevRoster[n]));
    if (actuallyRemoved.length === 0) return; // no-op

    set((state) => {
      const next = { ...state.roster };
      names.forEach((name) => delete next[name]);

      // Unassign any weapon that was pointing to any of these characters
      const updatedWeapons = state.trackedWeapons.map((w) =>
        names.includes(w.assignedTo) ? { ...w, assignedTo: null } : w
      );
      return { roster: next, trackedWeapons: updatedWeapons };
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
        category: 'characters',
        action: 'characters_batch_removed',
        source: validSource,
        summary: `Removed ${actuallyRemoved.length} characters from the roster.`,
        metadata: {
          removedCount: actuallyRemoved.length,
          characterNames: actuallyRemoved.slice(0, 50),
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  updateCharacter: (name, patch, contextArg = 'system') => {
    const prevChar = get().roster?.[name];
    if (!prevChar) return;

    set((state) => {
      const existing = state.roster[name];
      if (!existing) return state;

      const normalizedPatch = normalizeCharacterPatch(existing, patch);
      let charEntry = { ...existing, ...normalizedPatch };
      charEntry = recalculateCharacterCosts(name, charEntry);

      const newRoster = {
        ...state.roster,
        [name]: charEntry,
      };
      if (name.startsWith('Traveler ')) {
        syncTravelerAscension(newRoster, name);
      }
      return { roster: newRoster };
    });

    try {
      const nextChar = get().roster?.[name];
      if (!nextChar) return;

      const changes = extractCharacterMeaningfulChanges(prevChar, nextChar);
      if (changes.length === 0) {
        return; // Suppress no-op
      }

      let validSource = 'system';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }

      recordActivity({
        category: 'characters',
        action: 'character_updated',
        source: validSource,
        entityType: 'character',
        entityId: name,
        entityName: name,
        summary: `${name}'s progression updated.`,
        changes,
        metadata: {
          modifiedFields: changes.map((c) => c.field),
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  bulkUpdateCharacters: (identifiersOrPayloads, patchOrSource, contextArg = 'system') => {
    const isFirstArgPayloads =
      Array.isArray(identifiersOrPayloads) &&
      identifiersOrPayloads.length > 0 &&
      typeof identifiersOrPayloads[0] === 'object';
    const isSecondArgPayloads =
      Array.isArray(patchOrSource) && patchOrSource.length > 0 && typeof patchOrSource[0] === 'object';
    const isPayloads = isFirstArgPayloads || isSecondArgPayloads;

    const payloadsArray = isFirstArgPayloads
      ? identifiersOrPayloads
      : isSecondArgPayloads
      ? patchOrSource
      : null;

    const targetNames = isPayloads
      ? payloadsArray.map((p) => p.name)
      : identifiersOrPayloads;

    let patch = {};
    let effectiveSource = 'system';
    let isBatchGroup = false;

    if (isFirstArgPayloads) {
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
    } else if (isSecondArgPayloads) {
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

    const prevRoster = get().roster || {};

    set((state) => {
      const newRoster = { ...state.roster };
      let updatedWeapons = state.trackedWeapons;
      let hasChanges = false;

      const payloadsMap = isPayloads
        ? payloadsArray.reduce((acc, p) => ({ ...acc, [p.name]: p }), {})
        : null;

      targetNames.forEach((name) => {
        if (newRoster[name]) {
          const currentPatch = isPayloads ? payloadsMap[name] : patch;
          const normalizedPatch = normalizeCharacterPatch(
            newRoster[name],
            currentPatch
          );
          const updatedEntry = { ...newRoster[name], ...normalizedPatch };

          const isTraveler = name.startsWith('Traveler ');
          if (isTraveler) {
            updatedEntry.equippedWeaponId = null;
          }

          if (
            'equippedWeaponId' in currentPatch &&
            currentPatch.equippedWeaponId !== newRoster[name].equippedWeaponId
          ) {
            // A. Unassign old weapon from this character (so the old weapon has no owner)
            if (isTraveler) {
              updatedWeapons = updatedWeapons.map((w) =>
                w.assignedTo?.startsWith('Traveler ')
                  ? { ...w, assignedTo: null }
                  : w
              );
            } else if (newRoster[name].equippedWeaponId) {
              updatedWeapons = updatedWeapons.map((w) =>
                w.id === newRoster[name].equippedWeaponId
                  ? { ...w, assignedTo: null }
                  : w
              );
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
                const newWeapon = updatedWeapons.find(
                  (w) => w.id === finalWeaponId
                );
                if (
                  newWeapon &&
                  newWeapon.assignedTo &&
                  newWeapon.assignedTo !== name
                ) {
                  if (
                    !newWeapon.assignedTo.startsWith('Traveler ') &&
                    newRoster[newWeapon.assignedTo]
                  ) {
                    newRoster[newWeapon.assignedTo] = {
                      ...newRoster[newWeapon.assignedTo],
                      equippedWeaponId: null,
                    };
                  }
                }

                // C. Hand the new weapon to this character
                updatedWeapons = updatedWeapons.map((w) =>
                  w.id === finalWeaponId ? { ...w, assignedTo: name } : w
                );
              }

              // Ensure updatedEntry uses the valid UUID for non-Travelers, or null for Travelers
              updatedEntry.equippedWeaponId = isTraveler ? null : finalWeaponId;
            }
          }

          // Recalculate costs per user request
          const finalCharEntry = recalculateCharacterCosts(name, updatedEntry);

          newRoster[name] = finalCharEntry;
          hasChanges = true;
        }
      });
      if (!hasChanges) return state;

      if (targetNames.some((name) => name.startsWith('Traveler '))) {
        const travelerNames = targetNames.filter((name) =>
          name.startsWith('Traveler ')
        );
        syncTravelerAscension(
          newRoster,
          travelerNames[travelerNames.length - 1]
        );
      }

      return { roster: newRoster, trackedWeapons: updatedWeapons };
    });

    if (isBatchGroup) return;

    try {
      const nextRoster = get().roster || {};
      const changedCharacters = [];

      if (Array.isArray(targetNames)) {
        for (const name of targetNames) {
          if (prevRoster[name] && nextRoster[name]) {
            const diffs = extractCharacterMeaningfulChanges(
              prevRoster[name],
              nextRoster[name]
            );
            if (diffs.length > 0) {
              changedCharacters.push(name);
            }
          }
        }
      }

      if (changedCharacters.length === 0) {
        return; // Suppress no-op
      }

      const validSource =
        typeof effectiveSource === 'string' &&
        VALID_SOURCES.has(effectiveSource)
          ? effectiveSource
          : 'system';

      recordActivity({
        category: 'characters',
        action: 'characters_bulk_updated',
        source: validSource,
        summary: `Updated progression for ${changedCharacters.length} characters.`,
        metadata: {
          count: changedCharacters.length,
          characterNames: changedCharacters.slice(0, 50),
        },
      });
    } catch (err) {
      console.error('[Roster] Failed to log activity event:', err);
    }
  },

  isInRoster: (name) => Boolean(get().roster[name]),
});
