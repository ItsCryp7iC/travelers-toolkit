import { downloadRecoveryBackupFromDrive } from './driveSync';
import { normalizeAchievementProgress } from './achievementProgress';
import type { BackupPayloadV1, NormalizedBackupData } from '../types/backup';
import type { PersistedStore } from '../types/domain';

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_APP_ID = 'travelers-toolkit' as const;

export function getBackupPayload(state: Pick<PersistedStore, 'roster' | 'trackedWeapons' | 'inventory' | 'serverRegion' | 'showDbBuilder' | 'displayTimeZone' | 'achievementProgress'>): BackupPayloadV1 {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      roster: state.roster,
      trackedWeapons: state.trackedWeapons,
      inventory: state.inventory,
      serverRegion: state.serverRegion,
      showDbBuilder: state.showDbBuilder,
      displayTimeZone: state.displayTimeZone,
      achievementProgress: state.achievementProgress,
    }
  };
}

interface ShallowValidatedBackupData {
  roster: Record<string, unknown>;
  trackedWeapons: unknown[];
  inventory: Record<string, unknown>;
  serverRegion?: string;
  showDbBuilder?: boolean;
  displayTimeZone?: string;
  achievementProgress?: unknown;
}

function validateBackupData(data: unknown): asserts data is ShallowValidatedBackupData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  // Note: These runtime checks validate the top-level shape, not the deep structure.
  const d = data as Record<string, unknown>;

  if (!d.roster || typeof d.roster !== 'object' || Array.isArray(d.roster)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (!Array.isArray(d.trackedWeapons)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (!d.inventory || typeof d.inventory !== 'object' || Array.isArray(d.inventory)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (d.serverRegion !== undefined && typeof d.serverRegion !== 'string') {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (d.showDbBuilder !== undefined && typeof d.showDbBuilder !== 'boolean') {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (d.displayTimeZone !== undefined && typeof d.displayTimeZone !== 'string') {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (d.achievementProgress !== undefined && (typeof d.achievementProgress !== 'object' || d.achievementProgress === null || Array.isArray(d.achievementProgress))) {
    throw new Error('The backup file is invalid or corrupted.');
  }
}

export function normalizeBackupForImport(raw: unknown): NormalizedBackupData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  const rawObj = raw as Record<string, unknown>;

  // Legacy v0 fallback
  if (rawObj.app === undefined && rawObj.schemaVersion === undefined) {
    if (!('roster' in rawObj) || !('trackedWeapons' in rawObj) || !('inventory' in rawObj)) {
      throw new Error('The backup file is invalid or corrupted.');
    }
    validateBackupData(raw);

    // The existing runtime boundary historically accepts shallow structure,
    // so this cast represents the established application contract rather
    // than proof of deep validation.
    return {
      roster: raw.roster as NormalizedBackupData['roster'],
      trackedWeapons: raw.trackedWeapons as NormalizedBackupData['trackedWeapons'],
      inventory: raw.inventory as NormalizedBackupData['inventory'],
      serverRegion: raw.serverRegion || 'Asia',
      showDbBuilder: raw.showDbBuilder ?? false,
      displayTimeZone: raw.displayTimeZone || 'auto',
      achievementProgress: raw.achievementProgress ? normalizeAchievementProgress(raw.achievementProgress) : {},
    };
  }

  // Schema Validation
  if ('app' in rawObj && rawObj.app !== BACKUP_APP_ID) {
    throw new Error(`This file is not a Traveler's Toolkit backup.`);
  }

  if (rawObj.schemaVersion === undefined || typeof rawObj.schemaVersion !== 'number') {
    throw new Error('The backup file is invalid or corrupted.');
  }

  if (rawObj.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(`This backup was created by a newer version of Traveler's Toolkit and cannot be restored by this version.`);
  }

  if (rawObj.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  if (typeof rawObj.createdAt !== 'string' || isNaN(Date.parse(rawObj.createdAt))) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  if (!rawObj.data || typeof rawObj.data !== 'object' || Array.isArray(rawObj.data)) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  validateBackupData(rawObj.data);

  // Schema v1
  // The existing runtime boundary historically accepts shallow structure,
  // so this cast represents the established application contract rather
  // than proof of deep validation.
  return {
    roster: rawObj.data.roster as NormalizedBackupData['roster'],
    trackedWeapons: rawObj.data.trackedWeapons as NormalizedBackupData['trackedWeapons'],
    inventory: rawObj.data.inventory as NormalizedBackupData['inventory'],
    serverRegion: rawObj.data.serverRegion || 'Asia',
    showDbBuilder: rawObj.data.showDbBuilder ?? false,
    displayTimeZone: rawObj.data.displayTimeZone || 'auto',
    achievementProgress: rawObj.data.achievementProgress ? normalizeAchievementProgress(rawObj.data.achievementProgress) : {},
  };
}

export const isLocalUserDataEmpty = (state: Pick<PersistedStore, 'roster' | 'trackedWeapons' | 'inventory'>): boolean => {
  const isRosterEmpty = !state.roster || Object.keys(state.roster).length === 0;
  const isWeaponsEmpty = !state.trackedWeapons || state.trackedWeapons.length === 0;
  const isInventoryEmpty = !state.inventory || Object.keys(state.inventory).length === 0;
  return isRosterEmpty && isWeaponsEmpty && isInventoryEmpty;
};

export const restoreLatestRecoveryBackup = async (importData: (data: NormalizedBackupData) => void): Promise<boolean> => {
  try {
    const raw = await downloadRecoveryBackupFromDrive();
    const normalized = normalizeBackupForImport(raw);
    importData(normalized);
    return true;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      (err as Record<string, unknown>).status === 404
    ) {
      return false; // No recovery backup found
    }
    throw err;
  }
};
