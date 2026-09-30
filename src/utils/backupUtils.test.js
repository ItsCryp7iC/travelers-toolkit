import { describe, it, expect } from 'vitest';
import { normalizeBackupForImport, BACKUP_SCHEMA_VERSION } from './backupUtils';

describe('Backup Normalization', () => {
  it('normalizes valid v1 backup', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        serverRegion: 'Asia',
        showDbBuilder: false
      }
    };
    const result = normalizeBackupForImport(raw);
    expect(result.roster).toEqual({});
    expect(result.trackedWeapons).toEqual([]);
    expect(result.inventory).toEqual({});
    expect(result.serverRegion).toBe('Asia');
    expect(result.achievementProgress).toEqual({}); // Absent field normalizes to {}
  });

  it('normalizes valid legacy v0 backup', () => {
    const raw = {
      roster: {},
      trackedWeapons: [],
      inventory: {},
      serverRegion: 'Europe',
      showDbBuilder: true
    };
    const result = normalizeBackupForImport(raw);
    expect(result.roster).toEqual({});
    expect(result.trackedWeapons).toEqual([]);
    expect(result.inventory).toEqual({});
    expect(result.serverRegion).toBe('Europe');
    expect(result.showDbBuilder).toBe(true);
  });

  it('rejects unrelated object', () => {
    const raw = {
      randomField: 123
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('rejects future schema version', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: 999,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/newer version/);
  });

  it('rejects wrong app', () => {
    const raw = {
      app: 'wrong-app',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/not a Traveler's Toolkit backup/);
  });

  it('rejects invalid createdAt', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: 'invalid-date',
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('rejects non-array trackedWeapons', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: {}, // Should be array
        inventory: {},
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('rejects non-string serverRegion', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        serverRegion: 123 // Should be string
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('rejects non-boolean showDbBuilder', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        showDbBuilder: 'true' // Should be boolean
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('normalizes valid achievement progress', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        achievementProgress: {
          '80001': { completed: true, completedAt: null }
        }
      }
    };
    const result = normalizeBackupForImport(raw);
    expect(result.achievementProgress['80001']).toEqual({ completed: true, completedAt: null });
  });

  it('rejects malformed achievement progress', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        achievementProgress: {
          '80001': { completed: 'true' } // invalid
        }
      }
    };
    const result = normalizeBackupForImport(raw);
    expect(result.achievementProgress).toEqual({});
  });

  it('normalizes valid achievement progress but drops unknown IDs', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        achievementProgress: {
          '80001': { completed: true, completedAt: null },
          '999999999': { completed: true, completedAt: null }
        }
      }
    };
    const result = normalizeBackupForImport(raw);
    expect(result.achievementProgress['80001']).toBeDefined();
    expect(result.achievementProgress['999999999']).toBeUndefined();
  });

  it('rejects top-level null achievementProgress', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        achievementProgress: null
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('rejects top-level array achievementProgress', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        achievementProgress: []
      }
    };
    expect(() => normalizeBackupForImport(raw)).toThrow(/invalid or corrupted/);
  });

  it('accepts explicitly empty achievementProgress object', () => {
    const raw = {
      app: 'travelers-toolkit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        achievementProgress: {}
      }
    };
    const result = normalizeBackupForImport(raw);
    expect(result.achievementProgress).toEqual({});
  });
});
