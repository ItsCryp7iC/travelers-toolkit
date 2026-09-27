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
});
