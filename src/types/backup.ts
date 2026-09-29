import type { Roster, TrackedWeapon, Inventory } from './domain';

/**
 * BackupDataV1 represents the core user data packaged into a v1 backup.
 */
export interface BackupDataV1 {
  roster: Roster;
  trackedWeapons: TrackedWeapon[];
  inventory: Inventory;
  serverRegion: string;
  showDbBuilder: boolean;
  displayTimeZone?: string;
}

/**
 * BackupPayloadV1 is the outer envelope for a schema v1 backup.
 */
export interface BackupPayloadV1 {
  app: 'travelers-toolkit';
  schemaVersion: 1;
  createdAt: string; // ISO Date String
  data: BackupDataV1;
}

/**
 * LegacyBackupV0 represents an older unversioned backup format, which
 * included everything at the top level and may be missing some newer fields.
 */
export interface LegacyBackupV0 {
  app?: undefined;
  schemaVersion?: undefined;
  roster: Roster;
  trackedWeapons: TrackedWeapon[];
  serverRegion?: string;
  showDbBuilder?: boolean;
  displayTimeZone?: string;
}

/**
 * NormalizedBackupData represents the reliable internal format that
 * `normalizeBackupForImport` returns to be imported into the store.
 */
export interface NormalizedBackupData {
  roster: Roster;
  trackedWeapons: TrackedWeapon[];
  inventory: Inventory;
  serverRegion: string;
  showDbBuilder: boolean;
  displayTimeZone: string;
}
