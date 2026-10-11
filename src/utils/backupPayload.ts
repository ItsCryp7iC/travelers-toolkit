import type { BackupPayloadV1 } from '../types/backup';
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

export const isLocalUserDataEmpty = (state: Pick<PersistedStore, 'roster' | 'trackedWeapons' | 'inventory'>): boolean => {
  const isRosterEmpty = !state.roster || Object.keys(state.roster).length === 0;
  const isWeaponsEmpty = !state.trackedWeapons || state.trackedWeapons.length === 0;
  const isInventoryEmpty = !state.inventory || Object.keys(state.inventory).length === 0;
  return isRosterEmpty && isWeaponsEmpty && isInventoryEmpty;
};
