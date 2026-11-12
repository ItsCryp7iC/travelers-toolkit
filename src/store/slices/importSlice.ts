import charactersData from '../../utils/characters';
import weaponsData from '../../data/weapons.json';
import { getPrimaryInventoryList } from '../../utils/dataManager';
import { calculateWeaponCost } from '../../utils/calculator';
import { syncTravelerAscension, recalculateCharacterCosts } from '../helpers/rosterHelpers';
import { recordActivity, clearActivityHistory, VALID_SOURCES } from '../../activity';

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
  achievementProgress: Record<string, unknown>;
  googleConnected: boolean;
  googleUser: unknown | null;
  hoyolabConnected: boolean;
}

type StateUpdater<S> = Partial<S> | ((state: S) => Partial<S>);
type SetState<S> = (update: StateUpdater<S>) => void;
type GetState<S> = () => S;

export interface ImportContext {
  source?: string;
  origin?: 'manual_file' | 'manual_cloud_restore' | 'automatic_cloud_recovery' | string;
  silent?: boolean;
  fileName?: string;
  fileId?: string;
  logActivity?: boolean;
}

export interface ImportSliceActions {
  importData: (data: NormalizedBackupData, context?: string | ImportContext) => void;
  importGoodData: (goodPayload: NormalizedGoodPayload, context?: string | ImportContext) => void;
  resetStore: (context?: { logActivity?: boolean; clearHistory?: boolean }) => void;
}

function resolveContext(contextArg?: string | ImportContext): ImportContext {
  if (typeof contextArg === 'string') {
    return { source: contextArg };
  }
  if (typeof contextArg === 'object' && contextArg !== null) {
    return contextArg;
  }
  return {};
}

export const createImportSlice = (
  set: SetState<ImportSliceState>,
  get: unknown
): ImportSliceActions => {
  const getState = get as GetState<ImportSliceState>;

  return {
    importData: (data, contextArg) => {
      const prev = getState ? getState() : ({} as ImportSliceState);
      const ctx = resolveContext(contextArg);

      set({
        roster: data.roster || {},
        trackedWeapons: data.trackedWeapons || [],
        inventory: data.inventory || {},
        serverRegion: data.serverRegion || 'Asia',
        showDbBuilder: data.showDbBuilder ?? false,
        displayTimeZone: data.displayTimeZone || 'auto',
        achievementProgress: data.achievementProgress || {},
      });

      if (ctx.silent) return;

      try {
        const isCloud =
          ctx.source === 'settings_cloud_sync' ||
          ctx.origin === 'manual_cloud_restore' ||
          ctx.origin === 'automatic_cloud_recovery';

        const action = isCloud ? 'cloud_backup_restored' : 'local_backup_restored';
        let validSource = 'settings_backup';
        if (isCloud) {
          validSource = ctx.origin === 'automatic_cloud_recovery' ? 'system' : 'settings_cloud_sync';
        } else if (ctx.source && VALID_SOURCES.has(ctx.source as any)) {
          validSource = ctx.source;
        }

        const charCount = Object.keys(data.roster || {}).length;
        const weaponCount = (data.trackedWeapons || []).length;
        const matCount = Object.keys(data.inventory || {}).length;
        const achCount = Object.keys(data.achievementProgress || {}).filter(
          (k) => (data.achievementProgress as Record<string, { completed?: boolean }>)[k]?.completed
        ).length;

        let summary = `Restored local backup: ${charCount} character(s), ${weaponCount} weapon(s), ${matCount} material(s).`;
        if (isCloud) {
          if (ctx.origin === 'automatic_cloud_recovery') {
            summary = `Automatically restored cloud recovery backup: ${charCount} character(s), ${weaponCount} weapon(s), ${matCount} material(s).`;
          } else {
            summary = `Restored cloud backup: ${charCount} character(s), ${weaponCount} weapon(s), ${matCount} material(s).`;
          }
        }

        recordActivity({
          category: 'import_sync',
          action,
          source: validSource as any,
          entityType: 'backup',
          entityId: ctx.fileId || ctx.fileName || (isCloud ? 'cloud_backup' : 'local_backup'),
          summary,
          changes: [],
          metadata: {
            characterCount: charCount,
            weaponCount,
            materialCount: matCount,
            achievementCount: achCount,
            serverRegion: data.serverRegion || 'Asia',
            displayTimeZone: data.displayTimeZone || 'auto',
            ...(ctx.origin ? { origin: ctx.origin } : {}),
            ...(ctx.fileName ? { fileName: ctx.fileName } : {}),
            ...(ctx.fileId ? { fileId: ctx.fileId } : {}),
          },
        });
      } catch (err) {
        console.error('[ImportSlice] Failed to record importData activity:', err);
      }
    },

    importGoodData: (goodPayload, contextArg) => {
      const state = getState ? getState() : ({} as ImportSliceState);
      const ctx = resolveContext(contextArg);

      // 1. Materials
      const prevInventory = state.inventory || {};
      const newInventory: Inventory = { ...prevInventory };
      const canonicalMats = new Set(getPrimaryInventoryList().map((m: { matKey: string }) => m.matKey));

      let materialsUpdated = 0;
      Object.entries(goodPayload.materials ?? {}).forEach(([matKey, qty]) => {
        if (canonicalMats.has(matKey)) {
          if (prevInventory[matKey] !== qty) {
            materialsUpdated++;
          }
          newInventory[matKey] = qty;
        }
      });

      // 2. Roster
      const prevRoster = state.roster || {};
      const newRoster: Roster = { ...prevRoster };
      const importedChars = goodPayload.characters || [];

      let charactersCreated = 0;
      let charactersUpdated = 0;

      importedChars.forEach((char) => {
        const existing = prevRoster[char.name];
        if (!existing) {
          charactersCreated++;
        } else {
          const changed =
            char.level !== existing.level ||
            char.ascension !== existing.ascension ||
            char.talents?.normal !== existing.talents?.normal ||
            char.talents?.skill !== existing.talents?.skill ||
            char.talents?.burst !== existing.talents?.burst;
          if (changed) {
            charactersUpdated++;
          }
        }

        const fallback = existing || {
          targetLevel: 90,
          targetAscension: 6,
          targetTalents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: null,
          tracked: true,
          calculatedCosts: null,
        };

        const entryUpdate: RosterEntry = {
          level: char.level,
          ascension: char.ascension,
          talents: char.talents,
          // STRICT RULE: preserve existing target properties
          targetLevel: fallback.targetLevel,
          targetAscension: fallback.targetAscension,
          targetTalents: fallback.targetTalents,
          equippedWeaponId: fallback.equippedWeaponId,
          tracked: fallback.tracked,
          calculatedCosts: fallback.calculatedCosts,
        };

        newRoster[char.name] = entryUpdate;
        recalculateCharacterCosts(char.name, newRoster[char.name]);
      });

      if (importedChars.some((c) => c.name.startsWith('Traveler '))) {
        syncTravelerAscension(newRoster);
      }

      // 3. Weapons
      const prevWeapons = state.trackedWeapons || [];
      let newWeapons: TrackedWeapon[] = prevWeapons;
      const importedWeapons = goodPayload.weapons || [];

      let weaponsCreated = 0;
      let weaponsUpdated = 0;
      let assignmentsChanged = 0;

      if (importedWeapons.length > 0) {
        newWeapons = prevWeapons.map((tw) => ({ ...tw }));
        const matchedExistingIds = new Set<string>();

        importedWeapons.forEach((w) => {
          const targetLocation = w.location || null;
          // Match existing weapon by name and assignment
          const existing = prevWeapons.find(
            (ew) => !matchedExistingIds.has(ew.id) && ew.weaponName === w.weaponName && ew.assignedTo === targetLocation
          );
          if (existing) {
            matchedExistingIds.add(existing.id);
          }
          const id = existing ? existing.id : crypto.randomUUID();

          if (!existing) {
            weaponsCreated++;
          } else {
            const changed =
              w.level !== existing.level ||
              w.ascension !== existing.ascension ||
              (w.refinement ?? 1) !== existing.currentRefinement ||
              targetLocation !== existing.assignedTo;
            if (changed) {
              weaponsUpdated++;
            }
          }

          // If target location was claimed by another weapon, unassign that weapon
          if (targetLocation) {
            const isTraveler = targetLocation.startsWith('Traveler ');
            newWeapons.forEach((pw) => {
              if (pw.id !== id) {
                const matchesLocation = isTraveler
                  ? pw.assignedTo?.startsWith('Traveler ')
                  : pw.assignedTo === targetLocation;
                if (matchesLocation) {
                  pw.assignedTo = null;
                  assignmentsChanged++;
                }
              }
            });
          }

          const mergedWeapon: TrackedWeapon = {
            id,
            weapon_id: w.weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
            weaponName: w.weaponName,
            level: w.level,
            ascension: w.ascension,
            targetLevel: existing?.targetLevel ?? 90,
            targetAscension: existing?.targetAscension ?? 6,
            currentRefinement: w.refinement ?? 1,
            targetRefinement: existing?.targetRefinement ?? (w.refinement ?? 1),
            assignedTo: targetLocation,
            createdAt: existing?.createdAt ?? Date.now(),
            hasEventBonus: existing?.hasEventBonus,
          };

          const wData = weaponsData.find((wd: { name: string }) => wd.name === mergedWeapon.weaponName);
          if (wData) {
            mergedWeapon.costs = calculateWeaponCost(
              wData,
              mergedWeapon.level,
              mergedWeapon.targetLevel,
              mergedWeapon.ascension,
              mergedWeapon.targetAscension,
              Boolean(mergedWeapon.hasEventBonus),
              newRoster
            ) as WeaponCalculatedCosts;
          }

          if (existing) {
            const idx = newWeapons.findIndex((tw) => tw.id === existing.id);
            if (idx !== -1) {
              newWeapons[idx] = mergedWeapon;
            } else {
              newWeapons.push(mergedWeapon);
            }
          } else {
            newWeapons.push(mergedWeapon);
          }

          if (targetLocation && newRoster[targetLocation] && !targetLocation.startsWith('Traveler ')) {
            if (newRoster[targetLocation].equippedWeaponId !== id) {
              assignmentsChanged++;
            }
            newRoster[targetLocation] = {
              ...newRoster[targetLocation],
              equippedWeaponId: id,
            };
          }
        });
      }

      set({
        inventory: newInventory,
        roster: newRoster,
        trackedWeapons: newWeapons,
      });

      if (ctx.silent) return;

      const totalChanges =
        materialsUpdated + charactersCreated + charactersUpdated + weaponsCreated + weaponsUpdated;

      if (totalChanges === 0) {
        return; // Suppress no-op
      }

      try {
        const unresolved = (goodPayload as Record<string, any>).unresolved;
        const unresolvedCount = unresolved
          ? (unresolved.characters?.length || 0) +
            (unresolved.weapons?.length || 0) +
            (unresolved.materials?.length || 0) +
            (unresolved.locations?.length || 0)
          : 0;

        recordActivity({
          category: 'import_sync',
          action: 'good_import_applied',
          source: 'settings_good_import',
          entityType: 'backup',
          entityId: 'good_import',
          summary: `Imported GOOD data: ${materialsUpdated} material(s), ${charactersCreated + charactersUpdated} character(s), ${weaponsCreated + weaponsUpdated} weapon(s).`,
          changes: [],
          metadata: {
            materialsUpdated,
            charactersCreated,
            charactersUpdated,
            weaponsCreated,
            weaponsUpdated,
            assignmentsChanged,
            unresolvedCount,
          },
        });
      } catch (err) {
        console.error('[ImportSlice] Failed to record good import activity:', err);
      }
    },

    resetStore: (context) => {
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
        achievementProgress: {},
      });

      let historyCleared = false;
      let clearFailed = false;

      if (context?.logActivity) {
        if (context.clearHistory) {
          try {
            historyCleared = clearActivityHistory() === true;
            clearFailed = !historyCleared;
          } catch (err) {
            console.error('[ImportSlice] Failed to clear activity history:', err);
            historyCleared = false;
            clearFailed = true;
          }
        }
        try {
          const summary = context.clearHistory
            ? historyCleared
              ? 'Performed factory reset and cleared activity history.'
              : 'Performed factory reset (activity history clear failed).'
            : 'Performed factory reset (activity history retained).';

          recordActivity({
            category: 'settings_system',
            action: 'factory_reset_performed',
            source: 'settings_preferences',
            entityType: 'setting',
            entityId: 'factory_reset',
            summary,
            changes: [],
            metadata: {
              historyCleared,
            },
          });
        } catch (err) {
          console.error('[ImportSlice] Failed to record reset activity:', err);
        }
      }

      return { domainReset: true, historyCleared, clearFailed };
    },
  };
};
