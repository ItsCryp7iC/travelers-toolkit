import { downloadRecoveryBackupFromDrive } from './driveSync';

export function getBackupPayload(state) {
  return {
    roster: state.roster,
    trackedWeapons: state.trackedWeapons,
    inventory: state.inventory,
    serverRegion: state.serverRegion,
    showDbBuilder: state.showDbBuilder,
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
    const data = await downloadRecoveryBackupFromDrive();
    importData(data);
    return true;
  } catch (err) {
    if (err.status === 404) {
      return false; // No recovery backup found
    }
    throw err;
  }
};
