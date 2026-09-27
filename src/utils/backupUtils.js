import { downloadRecoveryBackupFromDrive } from './driveSync';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP_ID = 'travelers-toolkit';

export function getBackupPayload(state) {
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
    }
  };
}

function validateBackupData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (!data.roster || typeof data.roster !== 'object' || Array.isArray(data.roster)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (!Array.isArray(data.trackedWeapons)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (!data.inventory || typeof data.inventory !== 'object' || Array.isArray(data.inventory)) {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (data.serverRegion !== undefined && typeof data.serverRegion !== 'string') {
    throw new Error('The backup file is invalid or corrupted.');
  }
  if (data.showDbBuilder !== undefined && typeof data.showDbBuilder !== 'boolean') {
    throw new Error('The backup file is invalid or corrupted.');
  }
}

export function normalizeBackupForImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  // Legacy v0 fallback
  if (raw.app === undefined && raw.schemaVersion === undefined) {
    if (!('roster' in raw) || !('trackedWeapons' in raw) || !('inventory' in raw)) {
      throw new Error('The backup file is invalid or corrupted.');
    }
    validateBackupData(raw);

    return {
      roster: raw.roster,
      trackedWeapons: raw.trackedWeapons,
      inventory: raw.inventory,
      serverRegion: raw.serverRegion || 'Asia',
      showDbBuilder: raw.showDbBuilder ?? false,
    };
  }

  // Schema Validation
  if ('app' in raw && raw.app !== BACKUP_APP_ID) {
    throw new Error(`This file is not a Traveler's Toolkit backup.`);
  }

  if (raw.schemaVersion === undefined || typeof raw.schemaVersion !== 'number') {
    throw new Error('The backup file is invalid or corrupted.');
  }

  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(`This backup was created by a newer version of Traveler's Toolkit and cannot be restored by this version.`);
  }

  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  if (!raw.createdAt || typeof raw.createdAt !== 'string' || isNaN(Date.parse(raw.createdAt))) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
    throw new Error('The backup file is invalid or corrupted.');
  }

  validateBackupData(raw.data);

  // Schema v1
  return {
    roster: raw.data.roster,
    trackedWeapons: raw.data.trackedWeapons,
    inventory: raw.data.inventory,
    serverRegion: raw.data.serverRegion || 'Asia',
    showDbBuilder: raw.data.showDbBuilder ?? false,
  };
}

export const isLocalUserDataEmpty = (state) => {
  const isRosterEmpty = !state.roster || Object.keys(state.roster).length === 0;
  const isWeaponsEmpty = !state.trackedWeapons || state.trackedWeapons.length === 0;
  const isInventoryEmpty = !state.inventory || Object.keys(state.inventory).length === 0;
  return isRosterEmpty && isWeaponsEmpty && isInventoryEmpty;
};

export const restoreLatestRecoveryBackup = async (importData) => {
  try {
    const raw = await downloadRecoveryBackupFromDrive();
    const normalized = normalizeBackupForImport(raw);
    importData(normalized);
    return true;
  } catch (err) {
    if (err.status === 404) {
      return false; // No recovery backup found
    }
    throw err;
  }
};
