import type { PersistedStore } from '../types/domain';
import { normalizeAchievementProgress } from '../utils/achievementProgress';

export const STORE_NAME = 'travelers-toolkit-store';
export const STORE_VERSION = 7;

export interface LegacyRosterEntry extends Record<string, unknown> {
  equippedWeapon?: string;
  weaponLevel?: number;
  weaponAscension?: number;
  targetWeaponLevel?: number;
  targetWeaponAscension?: number;
  equippedWeaponId?: string | null;
}

export interface LegacyTrackedWeapon extends Record<string, unknown> {
  currentRefinement?: number;
  targetRefinement?: number;
}

export interface LegacyPersistedState extends Record<string, unknown> {
  trackedWeapons?: LegacyTrackedWeapon[];
  roster?: Record<string, LegacyRosterEntry>;
  craftQueue?: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const migrateStore = (persistedState: unknown, fromVersion: number): unknown => {
  // Defensive boundary: Zustand persisted state must be an object.
  // We explicitly normalize malformed non-object inputs (like strings or arrays) to {}
  // instead of spreading them, which differs slightly from historical JS behavior ({ ..."abc" })
  // but safely prevents corrupted index-based properties.
  let state: LegacyPersistedState = isRecord(persistedState)
    ? (persistedState as LegacyPersistedState)
    : {};

  // v1 → v2: convert old string `equippedWeapon` fields into `trackedWeapons` entries
  if (fromVersion < 2) {
    const migrated = { ...state }
    migrated.trackedWeapons = migrated.trackedWeapons ?? []
    const roster = migrated.roster ?? {}

    for (const [charName, entry] of Object.entries(roster)) {
      // Skip if already migrated or no legacy string weapon
      if (entry.equippedWeaponId || !entry.equippedWeapon) continue

      // Create a new tracked weapon from the legacy string
      const id = crypto.randomUUID()
      migrated.trackedWeapons.push({
        id,
        weaponName: entry.equippedWeapon,
        level: entry.weaponLevel ?? 1,
        ascension: entry.weaponAscension ?? 0,
        targetLevel: entry.targetWeaponLevel ?? 90,
        targetAscension: entry.targetWeaponAscension ?? 6,
        assignedTo: charName,
      })

      // Update the roster entry to use the new ID
      migrated.roster![charName] = {
        ...entry,
        equippedWeaponId: id,
        // Remove legacy flat fields
        equippedWeapon: undefined,
        weaponLevel: undefined,
        weaponAscension: undefined,
        targetWeaponLevel: undefined,
        targetWeaponAscension: undefined,
      }
    }
    state = migrated
  }
  // v2 → v3: introduce craftQueue slice
  if (fromVersion < 3) {
    state = { ...state, craftQueue: state.craftQueue ?? [] }
  }
  // v3 → v4: migrate to refinement tracking, remove craftQueue
  if (fromVersion < 4) {
    state = { ...state }
    delete state.craftQueue
    if (state.trackedWeapons) {
      state.trackedWeapons = state.trackedWeapons.map((w) => ({
        ...w,
        currentRefinement: w.currentRefinement ?? 1,
        targetRefinement: w.targetRefinement ?? 1,
      }))
    }
  }
  // v4 → v5: remove authentication/session properties from persisted state
  if (fromVersion < 5) {
    state = { ...state }
    delete state.googleAccessToken
    delete state.tokenExpiry
    delete state.googleUser
    delete state.hoyolabLtuid
    delete state.hoyolabLtoken
  }
  // v5 → v6: add displayTimeZone setting
  if (fromVersion < 6) {
    state = { ...state, displayTimeZone: state.displayTimeZone ?? 'auto' }
  }
  // v6 → v7: add achievementProgress
  if (fromVersion < 7) {
    let safeProgress = {}
    try {
      if (state.achievementProgress) {
        safeProgress = normalizeAchievementProgress(state.achievementProgress)
      }
    } catch {
      safeProgress = {}
    }
    state = { ...state, achievementProgress: safeProgress }
  }
  return state
}

export const partializeStore = (state: PersistedStore & Record<string, unknown>): PersistedStore => ({
  roster: state.roster,
  trackedWeapons: state.trackedWeapons,
  inventory: state.inventory,
  goals: state.goals,
  resinCount: state.resinCount,
  resinTimestamp: state.resinTimestamp,
  serverRegion: state.serverRegion,
  showDbBuilder: state.showDbBuilder,
  autoBackupEnabled: state.autoBackupEnabled,
  displayTimeZone: state.displayTimeZone,
  achievementProgress: state.achievementProgress,
})
