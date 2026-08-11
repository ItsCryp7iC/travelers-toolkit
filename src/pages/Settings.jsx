import React, { useRef } from 'react';
import useStore from '../store/useStore';

export default function Settings() {
  const {
    roster,
    trackedWeapons,
    inventory,
    serverRegion,
    setServerRegion,
    showDbBuilder,
    setShowDbBuilder,
    importData,
    resetStore
  } = useStore();

  const fileInputRef = useRef(null);

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
        
        {/* Data Management Card */}
        <div className="genshin-card p-6 flex flex-col gap-4">
          <h2 className="font-cinzel text-lg font-bold text-primary border-b border-[var(--border)] pb-2">
            Data Management
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
    </div>
  );
}
