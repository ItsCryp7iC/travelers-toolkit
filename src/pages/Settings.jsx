import React, { useRef, useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { uploadBackupToDrive, downloadBackupFromDrive, listBackupsFromDrive, getAutoBackupStatus } from '../utils/driveSync';
import { parseGoodData } from '../utils/goodParser';
import { getBackupPayload, normalizeBackupForImport } from '../utils/backupUtils';
import { triggerGoogleAuth } from '../utils/googleAuthHelper';
import GoodImportModal from '../components/GoodImportModal';
import AchievementData from '../components/Settings/AchievementData';
import HoyoLoginModal from '../components/hoyolab/HoyoLoginModal';
import { buildTimeZoneOptions, getTimeZoneDisplayLabel } from '../utils/timeZoneUtils';
import notify from '../utils/notify';

const timeZoneOptions = buildTimeZoneOptions();

export default function Settings() {
  const serverRegion = useStore((s) => s.serverRegion);
  const setServerRegion = useStore((s) => s.setServerRegion);
  const showDbBuilder = useStore((s) => s.showDbBuilder);
  const setShowDbBuilder = useStore((s) => s.setShowDbBuilder);
  const autoBackupEnabled = useStore((s) => s.autoBackupEnabled);
  const setAutoBackupEnabled = useStore((s) => s.setAutoBackupEnabled);
  const importData = useStore((s) => s.importData);
  const importGoodData = useStore((s) => s.importGoodData);
  const resetStore = useStore((s) => s.resetStore);
  const displayTimeZone = useStore((s) => s.displayTimeZone);
  const setDisplayTimeZone = useStore((s) => s.setDisplayTimeZone);

  const fileInputRef = useRef(null);
  const goodFileInputRef = useRef(null);

  const [pendingImportData, setPendingImportData] = useState(null);

  // Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);
  const [cloudBackups, setCloudBackups] = useState([]);
  const [autoBackupStatus, setAutoBackupStatus] = useState(null);

  const googleConnected = useStore((s) => s.googleConnected);
  const disconnectGoogleSession = useStore((s) => s.disconnectGoogleSession);

  useEffect(() => {
    if (googleConnected) {
      fetchBackups();
    }
  }, [googleConnected]);

  useEffect(() => {
    const handleAutoBackupUpdated = () => {
      if (googleConnected) {
        fetchBackups();
      }
    };
    window.addEventListener('google_auto_backup_updated', handleAutoBackupUpdated);
    return () => window.removeEventListener('google_auto_backup_updated', handleAutoBackupUpdated);
  }, [googleConnected]);

  const hoyolabConnected = useStore((s) => s.hoyolabConnected);
  const hoyolabAccount = useStore((s) => s.hoyolabAccount);
  const connectHoyolabSession = useStore((s) => s.connectHoyolabSession);
  const disconnectHoyolabSession = useStore((s) => s.disconnectHoyolabSession);

  const [isHoyoLoginOpen, setIsHoyoLoginOpen] = useState(false);
  const [hoyolabLtuid, setHoyolabLtuid] = useState('');
  const [hoyolabLtoken, setHoyolabLtoken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectHoyolab = async () => {
    if (!hoyolabLtuid || !hoyolabLtoken) {
      notify.warning('Please enter both ltuid and ltoken.');
      return;
    }
    setIsConnecting(true);
    const res = await connectHoyolabSession(hoyolabLtuid, hoyolabLtoken);
    setIsConnecting(false);
    if (res.success) {
      setHoyolabLtuid('');
      setHoyolabLtoken('');
      notify.success('HoYoLAB connected successfully!');
    } else {
      notify.error(`Connection failed: ${res.message || res.error}`);
    }
  };

  const handleDisconnectHoyolab = async () => {
    await disconnectHoyolabSession();
    notify.info('HoYoLAB disconnected.');
  };



  const fetchBackups = async () => {
    try {
      const backups = await listBackupsFromDrive();
      setCloudBackups(backups);

      const autoStatus = await getAutoBackupStatus();
      setAutoBackupStatus(autoStatus);
    } catch (error) {
      console.error(error);
      if (error.status === 401) {
        disconnectGoogleSession();
      }
      notify.error('Failed to fetch backups from Google Drive.');
    }
  };

  const handleCloudBackup = async () => {
    try {
      setIsSyncing(true);
      const dataToExport = getBackupPayload(useStore.getState());
      await uploadBackupToDrive(dataToExport);
      setLastSyncedTime(new Date().toLocaleString());
      notify.success('Cloud sync successful!');
    } catch (error) {
      console.error(error);
      if (error.status === 401) {
        disconnectGoogleSession();
      }
      notify.error('Failed to sync to Google Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudRestore = async (fileId) => {
    if (!useStore.getState().googleConnected) {
      notify.warning('Please connect to Google Drive first.');
      return;
    }

    try {
      setIsRestoring(true);
      const data = await downloadBackupFromDrive(fileId);
      if (data) {
        const normalized = normalizeBackupForImport(data);
        importData(normalized);
        notify.success('Cloud restore successful!');
      } else {
        notify.warning('No backup found in Google Drive.');
      }
    } catch (error) {
      console.error(error);
      if (error.status === 401) {
        disconnectGoogleSession();
      }
      notify.error('Failed to restore from Google Drive.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExport = () => {
    const dataToExport = getBackupPayload(useStore.getState());
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'travelers-toolkit-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (parsedData) {
          const normalized = normalizeBackupForImport(parsedData);
          importData(normalized);
          notify.success('Data imported successfully!');
        }
      } catch (error) {
        notify.error(error.message || 'Failed to import data. Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleGoodImportClick = () => {
    if (goodFileInputRef.current) {
      goodFileInputRef.current.click();
    }
  };

  const handleGoodFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        const goodData = parseGoodData(parsedData);

        const hasKnown = goodData.characters.length > 0 || goodData.weapons.length > 0 || Object.keys(goodData.materials).length > 0;
        if (!hasKnown) {
          notify.warning("No recognized Traveler's Toolkit data was found in this GOOD file.");
          return;
        }

        setPendingImportData(goodData);
      } catch (error) {
        notify.error('Failed to parse GOOD data. Please ensure it is a valid format.');
        console.error(error);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleGoodImportConfirm = (finalData) => {
    importGoodData(finalData);
    const matCount = Object.keys(finalData.materials || {}).length;
    const charCount = (finalData.characters || []).length;
    const weaponCount = (finalData.weapons || []).length;

    let msg = `GOOD Data Synced!\nImported ${matCount} materials, ${charCount} characters, and ${weaponCount} weapons.`;

    if (pendingImportData?.unresolved) {
      const u = pendingImportData.unresolved;
      const totalUnknown = u.characters.length + u.weapons.length + u.materials.length + u.locations.length;
      if (totalUnknown > 0) {
        msg += `\n\nSome entries were skipped because they were unsupported or invalid:\n`;
        if (u.materials.length > 0) msg += `- ${u.materials.length} materials\n`;
        if (u.characters.length > 0) msg += `- ${u.characters.length} characters\n`;
        if (u.weapons.length > 0) msg += `- ${u.weapons.length} weapons\n`;
        if (u.locations.length > 0) msg += `- ${u.locations.length} locations\n`;
      }
    }

    notify.success(msg);
    setPendingImportData(null);
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
      try {
        await disconnectHoyolabSession();
      } catch (error) {
        console.error("Failed to disconnect from HoYoLAB during reset", error);
      } finally {
        resetStore();
        notify.success('Data reset successfully.');
      }
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-12 px-3.5 sm:px-6 md:px-8">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8 flex items-center gap-2.5 sm:gap-3">
        <span className="text-2xl sm:text-3xl">⚙️</span>
        <h1 className="font-bold text-2xl md:text-3xl text-[var(--color-text-main)]">
          Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

        {/* Cloud Backup Card */}
        <div className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4">
          <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2 flex justify-between items-center">
            <span>Cloud Backup</span>
            <span className="text-sm">☁️</span>
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Seamlessly sync your progression data to your Google Drive's hidden AppData folder. Maintain up to 5 rolling backups.
          </p>

          <div className="flex items-center justify-between gap-3 mt-1 sm:mt-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-main)]">Auto-Backup</p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Automatically backs up changes when Google Drive is connected.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoBackupEnabled}
                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                aria-label="Toggle auto-backup"
              />
              <div className="w-11 h-6 bg-[var(--elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-[var(--border)]"></div>
            </label>
          </div>

          {autoBackupStatus !== null && googleConnected && (
            <div className="mt-1">
              <p className="text-sm font-semibold text-[var(--color-text-main)]">Latest automatic backup:</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {autoBackupStatus.exists
                  ? new Date(autoBackupStatus.modifiedTime).toLocaleString()
                  : 'No automatic backup yet.'}
              </p>
            </div>
          )}

          {lastSyncedTime && (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              Last manually synced: {lastSyncedTime}
            </p>
          )}

          <div className="flex flex-col gap-2.5 sm:gap-3 mt-1 sm:mt-2">
            <button
              className="genshin-btn w-full flex justify-center items-center gap-2 min-h-[40px] text-xs sm:text-sm"
              onClick={async () => {
                if (useStore.getState().googleConnected) {
                  await handleCloudBackup();
                  await fetchBackups();
                } else {
                  const connected = await triggerGoogleAuth();
                  if (connected) {
                    await handleCloudBackup();
                    await fetchBackups();
                  }
                }
              }}
              disabled={isSyncing || isRestoring}
            >
              <span>{isSyncing ? '⏳' : '☁️'}</span>
              {isSyncing ? 'Syncing...' : 'Sync to Google Drive'}
            </button>
            <button
              className="genshin-btn-ghost w-full flex justify-center items-center gap-2 min-h-[40px] text-xs sm:text-sm"
              onClick={async () => {
                if (useStore.getState().googleConnected) {
                  await fetchBackups();
                } else {
                  const connected = await triggerGoogleAuth();
                  if (connected) {
                    await fetchBackups();
                  }
                }
              }}
              disabled={isSyncing || isRestoring}
            >
              <span>{isRestoring ? '⏳' : '🌩️'}</span>
              {isRestoring ? 'Restoring...' : 'Connect to View Backups'}
            </button>
          </div>

          {cloudBackups.length > 0 && (
            <div className="mt-2 sm:mt-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-main)] border-b border-[var(--border)] pb-1">
                Manual Backups
              </h3>
              {cloudBackups.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between gap-2.5 sm:gap-3 bg-[var(--elevated)] p-2.5 sm:p-3 rounded-lg border border-[var(--border)]">
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="text-xs font-semibold text-[var(--color-text-main)]">
                      {new Date(backup.createdTime).toLocaleString()}
                    </span>
                    <span
                      className="text-xs text-[var(--color-text-muted)] truncate block mt-0.5"
                      title={backup.name}
                      aria-label={`Backup file: ${backup.name}`}
                    >
                      {backup.name}
                    </span>
                  </div>
                  <button
                    className="text-xs bg-primary text-[#0d0f1a] px-3.5 py-1.5 rounded-md hover:opacity-90 font-bold transition-opacity shrink-0 min-h-[36px] flex items-center justify-center"
                    onClick={() => handleCloudRestore(backup.id)}
                    disabled={isRestoring}
                    aria-label={`Restore backup from ${new Date(backup.createdTime).toLocaleString()}`}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Local Data Management Card */}
        <div className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4">
          <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Local Data Management
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Export your roster and inventory to a file, or import an existing backup.
          </p>
          <div className="flex flex-col gap-2.5 sm:gap-3 mt-1 sm:mt-2">
            <button className="genshin-btn w-full flex justify-center items-center gap-2 min-h-[40px] text-xs sm:text-sm" onClick={handleExport}>
              <span>📥</span> Export Backup (.json)
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-label="Upload backup JSON file"
            />
            <button className="genshin-btn-ghost w-full flex justify-center items-center gap-2 min-h-[40px] text-xs sm:text-sm" onClick={handleImportClick}>
              <span>📤</span> Import Backup
            </button>
          </div>

          {/* Separated Danger Zone for Factory Reset */}
          <div className="mt-2 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚠️</span> Danger Zone
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-medium">Irreversible</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Permanently resets all stored data and returns Traveler's Toolkit to its initial state.
            </p>
            <button
              id="factory-reset-btn"
              className="genshin-btn-ghost w-full flex justify-center items-center gap-2 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-400 bg-red-950/10 hover:bg-red-950/20 transition-all min-h-[40px] font-semibold text-xs sm:text-sm mt-0.5"
              onClick={handleReset}
            >
              <span>⚠️</span> Factory Reset
            </button>
          </div>
        </div>

        {/* Inventory Kamera Sync Card */}
        <div className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4">
          <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2 flex justify-between items-center">
            <span>Inventory Kamera Sync</span>
            <span className="text-sm">📷</span>
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Sync your characters, weapons, and materials using a GOOD format JSON file exported from Inventory Kamera.
          </p>

          <div className="bg-[var(--elevated)] p-3.5 sm:p-4 rounded-lg border border-[var(--border)] mt-1 sm:mt-2">
            <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-1">Need a GOOD file?</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3 sm:mb-4 leading-relaxed">
              Use the Traveler’s Toolkit-compatible Inventory Kamera fork to scan your Genshin characters, weapons, and materials and export them as a GOOD JSON file.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <a
                href="https://github.com/ItsCryp7iC/Inventory_Kamera/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="genshin-btn flex-1 flex justify-center items-center gap-2 text-center min-h-[40px] text-xs sm:text-sm"
              >
                <span>⬇️</span> Get Inventory Kamera
              </a>
              <a
                href="https://github.com/ItsCryp7iC/Inventory_Kamera"
                target="_blank"
                rel="noopener noreferrer"
                className="genshin-btn-ghost flex-1 flex justify-center items-center gap-2 text-center min-h-[40px] text-xs sm:text-sm"
              >
                <span>🔗</span> View on GitHub
              </a>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-3 sm:mt-4 opacity-80 text-center leading-relaxed">
              Based on the open-source <a href="https://github.com/Andrewthe13th/Inventory_Kamera" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">Inventory Kamera project</a> and maintained for Traveler’s Toolkit compatibility.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:gap-3 mt-1">
            <input
              type="file"
              accept=".json"
              ref={goodFileInputRef}
              onChange={handleGoodFileChange}
              style={{ display: 'none' }}
              aria-label="Upload GOOD format JSON file"
            />
            <button className="genshin-btn w-full flex justify-center items-center gap-2 min-h-[40px] text-xs sm:text-sm" onClick={handleGoodImportClick}>
              <span>🔄</span> Import GOOD Format JSON
            </button>
            <p className="text-xs text-[var(--color-text-muted)] italic text-center">
              Note: This preserves your existing target levels and talents.
            </p>
          </div>
        </div>

        <AchievementData />

        {/* Regional Preferences Card */}
        <div className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4">
          <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Regional Preferences
          </h2>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <label htmlFor="server-region-select" className="text-sm font-semibold text-[var(--color-text-main)]">
              Server Region
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">
              Determines daily domain material rotations.
            </p>
            <select
              id="server-region-select"
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-xs sm:text-sm text-[var(--color-text-main)] outline-none focus:border-primary min-h-[40px] cursor-pointer"
              value={serverRegion}
              onChange={(e) => setServerRegion(e.target.value)}
              aria-label="Select server region"
            >
              <option value="Asia">Asia</option>
              <option value="NA">North America</option>
              <option value="EU">Europe</option>
              <option value="TW/HK/MO">TW, HK, MO</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <label htmlFor="display-timezone-select" className="text-sm font-semibold text-[var(--color-text-main)]">
              Display Time Zone
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">
              Controls the exact fill times shown for Resin and Realm Currency.
            </p>
            <select
              id="display-timezone-select"
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-xs sm:text-sm text-[var(--color-text-main)] outline-none focus:border-primary min-h-[40px] cursor-pointer"
              value={displayTimeZone}
              onChange={(e) => setDisplayTimeZone(e.target.value)}
              aria-label="Select display time zone"
            >
              <option value="auto">Auto — Device time zone</option>
              {timeZoneOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {displayTimeZone === 'auto'
                ? `Detected: ${getTimeZoneDisplayLabel(displayTimeZone)}`
                : `Selected: ${getTimeZoneDisplayLabel(displayTimeZone)}`}
            </p>
          </div>
        </div>

        {/* Developer Tools Card */}
        <div className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4">
          <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Developer Tools
          </h2>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-main)]">Show DB Builder</p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Enable the database generation tool in the sidebar.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showDbBuilder}
                onChange={(e) => setShowDbBuilder(e.target.checked)}
                aria-label="Toggle database builder in sidebar"
              />
              <div className="w-11 h-6 bg-[var(--elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-[var(--border)]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* HoYoLAB Connection Card */}
      <div className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 mt-4 sm:mt-6">
        <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2 flex justify-between items-center">
          <span>Connect HoYoLAB</span>
          <span className="text-sm">🌟</span>
        </h2>
        {hoyolabConnected ? (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0" />
              <p className="text-sm font-semibold text-green-500">Connected</p>
              {hoyolabAccount && (
                <span className="text-xs text-[var(--color-text-muted)] font-mono break-all sm:break-normal">
                  ({hoyolabAccount.nickname || 'Traveler'} • UID: {hoyolabAccount.uid})
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
              Live Resin &amp; Realm Currency sync enabled
            </p>
            <button
              className="genshin-btn w-full min-h-[40px] text-xs sm:text-sm"
              onClick={handleDisconnectHoyolab}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 sm:gap-4">
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              Connect your HoYoLAB account to enable live sync for Resin, Realm Currency, and character progress.
            </p>

            {/* Recommended: Sign in with HoYoLAB */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="genshin-btn w-full flex flex-wrap justify-center items-center gap-2 py-2.5 min-h-[42px] text-xs sm:text-sm"
                onClick={() => setIsHoyoLoginOpen(true)}
              >
                <span>🌟</span>
                <span>Sign in with HoYoLAB</span>
                <span className="text-[10px] font-bold bg-[#0d0f1a] text-primary px-1.5 py-0.5 rounded ml-1">
                  Recommended
                </span>
              </button>
            </div>

            {/* Advanced / fallback: Manual Cookie Entry */}
            <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Enter cookies manually
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Advanced / fallback
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="hoyolab-ltuid" className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">
                    ltuid_v2 (or ltuid)
                  </label>
                  <input
                    id="hoyolab-ltuid"
                    type="password"
                    autoComplete="off"
                    className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-xs sm:text-sm text-[var(--color-text-main)] outline-none focus:border-primary min-h-[40px]"
                    value={hoyolabLtuid}
                    onChange={(e) => setHoyolabLtuid(e.target.value)}
                    placeholder="Enter ltuid"
                    disabled={isConnecting}
                  />
                </div>
                <div>
                  <label htmlFor="hoyolab-ltoken" className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">
                    ltoken_v2 (or ltoken)
                  </label>
                  <input
                    id="hoyolab-ltoken"
                    type="password"
                    autoComplete="off"
                    className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-xs sm:text-sm text-[var(--color-text-main)] outline-none focus:border-primary min-h-[40px]"
                    value={hoyolabLtoken}
                    onChange={(e) => setHoyolabLtoken(e.target.value)}
                    placeholder="Enter ltoken"
                    disabled={isConnecting}
                  />
                </div>
                <button
                  type="button"
                  className="genshin-btn w-full mt-2 min-h-[40px] text-xs sm:text-sm"
                  onClick={handleConnectHoyolab}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <HoyoLoginModal
        isOpen={isHoyoLoginOpen}
        onClose={() => setIsHoyoLoginOpen(false)}
        onSuccess={() => {
          setIsHoyoLoginOpen(false);
        }}
      />

      {pendingImportData && (
        <GoodImportModal
          parsedData={pendingImportData}
          onConfirm={handleGoodImportConfirm}
          onCancel={() => setPendingImportData(null)}
        />
      )}
    </div>
  );
}

