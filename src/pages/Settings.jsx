import React, { useRef, useState } from 'react';
import useStore from '../store/useStore';
import { useGoogleLogin } from '@react-oauth/google';
import { uploadBackupToDrive, downloadBackupFromDrive, listBackupsFromDrive } from '../utils/driveSync';
import { parseGoodData } from '../utils/goodParser';
import GoodImportModal from '../components/GoodImportModal';

export default function Settings() {
  const {
    roster,
    trackedWeapons,
    inventory,
    serverRegion,
    setServerRegion,
    showDbBuilder,
    setShowDbBuilder,
    autoBackupEnabled,
    setAutoBackupEnabled,
    setGoogleSession,
    importData,
    importGoodData,
    resetStore
  } = useStore();

  const fileInputRef = useRef(null);
  const goodFileInputRef = useRef(null);
  
  const [pendingImportData, setPendingImportData] = useState(null);
  
  // Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);
  const [cloudBackups, setCloudBackups] = useState([]);

  // HoYoLAB State
  const [hoyolabLtuid, setHoyolabLtuid] = useState(localStorage.getItem('hoyolab_ltuid') || '');
  const [hoyolabLtoken, setHoyolabLtoken] = useState(localStorage.getItem('hoyolab_ltoken') || '');

  const handleSaveHoyolab = () => {
    localStorage.setItem('hoyolab_ltuid', hoyolabLtuid);
    localStorage.setItem('hoyolab_ltoken', hoyolabLtoken);
    alert('HoYoLAB credentials saved locally!');
  };

  const loginForSync = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleSession(tokenResponse.access_token, tokenResponse.expires_in);
      await handleCloudBackup(tokenResponse.access_token);
      await fetchBackups(tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  });

  const loginForRestore = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleSession(tokenResponse.access_token, tokenResponse.expires_in);
      await fetchBackups(tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  });

  const fetchBackups = async (token) => {
    try {
      const backups = await listBackupsFromDrive(token);
      setCloudBackups(backups);
    } catch (error) {
      console.error(error);
      alert('Failed to fetch backups from Google Drive.');
    }
  };

  const handleCloudBackup = async (token) => {
    try {
      setIsSyncing(true);
      const dataToExport = {
        roster,
        trackedWeapons,
        inventory,
        serverRegion,
        showDbBuilder
      };
      await uploadBackupToDrive(token, dataToExport);
      setLastSyncedTime(new Date().toLocaleString());
      alert('Cloud sync successful!');
    } catch (error) {
      console.error(error);
      alert('Failed to sync to Google Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudRestore = async (fileId) => {
    const token = useStore.getState().googleAccessToken;
    if (!token) {
      alert('Please connect to Google Drive first.');
      return;
    }
    
    try {
      setIsRestoring(true);
      const data = await downloadBackupFromDrive(token, fileId);
      if (data) {
        importData(data);
        alert('Cloud restore successful!');
      } else {
        alert('No backup found in Google Drive.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to restore from Google Drive.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExport = () => {
    const dataToExport = {
      roster,
      trackedWeapons,
      inventory,
      serverRegion,
      showDbBuilder
    };
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
          importData(parsedData);
          alert('Data imported successfully!');
        }
      } catch (error) {
        alert('Failed to import data. Invalid JSON file.');
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
        setPendingImportData(goodData);
      } catch (error) {
        alert('Failed to parse GOOD data. Please ensure it is a valid format.');
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
    alert(`GOOD Data Synced!\nImported ${matCount} materials, ${charCount} characters, and ${weaponCount} weapons.`);
    setPendingImportData(null);
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
      resetStore();
      alert('Data reset successfully.');
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="mb-8 flex items-center gap-3">
        <span className="text-3xl">⚙️</span>
        <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--color-text-main)]">
          Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Cloud Backup Card */}
        <div className="genshin-card p-6 flex flex-col gap-4">
          <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2 flex justify-between items-center">
            <span>Cloud Backup</span>
            <span className="text-sm">☁️</span>
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Seamlessly sync your progression data to your Google Drive's hidden AppData folder. Maintain up to 5 rolling backups.
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-main)]">Auto-Backup</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Sync on app open (requires recent login).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={autoBackupEnabled}
                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-[var(--elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-[var(--border)]"></div>
            </label>
          </div>

          {lastSyncedTime && (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              Last manually synced: {lastSyncedTime}
            </p>
          )}
          
          <div className="flex flex-col gap-3 mt-2">
            <button 
              className="genshin-btn w-full flex justify-center items-center gap-2" 
              onClick={() => loginForSync()}
              disabled={isSyncing || isRestoring}
            >
              <span>{isSyncing ? '⏳' : '☁️'}</span> 
              {isSyncing ? 'Syncing...' : 'Sync to Google Drive'}
            </button>
            <button 
              className="genshin-btn-ghost w-full flex justify-center items-center gap-2" 
              onClick={() => loginForRestore()}
              disabled={isSyncing || isRestoring}
            >
              <span>{isRestoring ? '⏳' : '🌩️'}</span> 
              {isRestoring ? 'Restoring...' : 'Connect to View Backups'}
            </button>
          </div>

          {cloudBackups.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-main)] border-b border-[var(--border)] pb-1">
                Available Backups
              </h3>
              {cloudBackups.map((backup) => (
                <div key={backup.id} className="flex justify-between items-center bg-[var(--elevated)] p-2 rounded border border-[var(--border)]">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--color-text-main)]">
                      {new Date(backup.createdTime).toLocaleString()}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {backup.name}
                    </span>
                  </div>
                  <button 
                    className="text-xs bg-primary text-[#0d0f1a] px-3 py-1 rounded hover:opacity-90 font-bold transition-opacity"
                    onClick={() => handleCloudRestore(backup.id)}
                    disabled={isRestoring}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Local Data Management Card */}
        <div className="genshin-card p-6 flex flex-col gap-4">
          <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Local Data Management
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Export your roster and inventory to a file, or import an existing backup.
          </p>
          <div className="flex flex-col gap-3 mt-2">
            <button className="genshin-btn w-full flex justify-center items-center gap-2" onClick={handleExport}>
              <span>📥</span> Export Backup (.json)
            </button>
            <div className="flex gap-3">
              <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              <button className="genshin-btn-ghost flex-1 flex justify-center items-center gap-2" onClick={handleImportClick}>
                <span>📤</span> Import Backup
              </button>
              <button className="genshin-btn-ghost flex-1 flex justify-center items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-400" onClick={handleReset}>
                <span>⚠️</span> Factory Reset
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Kamera Sync Card */}
        <div className="genshin-card p-6 flex flex-col gap-4">
          <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2 flex justify-between items-center">
            <span>Inventory Kamera Sync</span>
            <span className="text-sm">📷</span>
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Sync your characters, weapons, and materials using a GOOD format JSON file exported from Inventory Kamera.
          </p>
          <div className="flex flex-col gap-3 mt-2">
            <input 
              type="file" 
              accept=".json" 
              ref={goodFileInputRef} 
              onChange={handleGoodFileChange} 
              style={{ display: 'none' }} 
            />
            <button className="genshin-btn w-full flex justify-center items-center gap-2" onClick={handleGoodImportClick}>
              <span>🔄</span> Import GOOD Format JSON
            </button>
            <p className="text-xs text-[var(--color-text-muted)] italic">
              Note: This preserves your existing target levels and talents.
            </p>
          </div>
        </div>

        {/* Planner Preferences Card */}
        <div className="genshin-card p-6 flex flex-col gap-4">
          <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Planner Preferences
          </h2>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[var(--color-text-main)]">Server Region</label>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">
              Determines daily domain material rotations.
            </p>
            <select 
              className="bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary"
              value={serverRegion}
              onChange={(e) => setServerRegion(e.target.value)}
            >
              <option value="Asia">Asia</option>
              <option value="NA">North America</option>
              <option value="EU">Europe</option>
              <option value="TW/HK/MO">TW, HK, MO</option>
            </select>
          </div>
        </div>

        {/* Developer Tools Card */}
        <div className="genshin-card p-6 flex flex-col gap-4">
          <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Developer Tools
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-main)]">Show DB Builder</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Enable the database generation tool in the sidebar.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={showDbBuilder}
                onChange={(e) => setShowDbBuilder(e.target.checked)}
              />
              <div className="w-11 h-6 bg-[var(--elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-[var(--border)]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* HoYoLAB API Configuration Card */}
      <div className="genshin-card p-6 flex flex-col gap-4 mt-6">
        <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
          HoYoLAB API Configuration
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Provide your HoYoLAB cookies to enable live sync for Resin and Realm Currency. Your credentials are saved locally in your browser.
        </p>
        <div className="flex flex-col gap-3 mt-2">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">ltuid_v2 (or ltuid)</label>
            <input 
              type="password" 
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary"
              value={hoyolabLtuid}
              onChange={(e) => setHoyolabLtuid(e.target.value)}
              placeholder="Enter ltuid"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">ltoken_v2 (or ltoken)</label>
            <input 
              type="password" 
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary"
              value={hoyolabLtoken}
              onChange={(e) => setHoyolabLtoken(e.target.value)}
              placeholder="Enter ltoken"
            />
          </div>
          <button 
            className="genshin-btn w-full mt-2" 
            onClick={handleSaveHoyolab}
          >
            Save Credentials
          </button>
        </div>
      </div>

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

