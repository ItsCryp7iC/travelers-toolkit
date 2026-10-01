import React, { useState, useRef } from 'react';
import useStore from '../../store/useStore';
import { parseAchievementImport } from '../../utils/achievementImport';
import { exportAchievementData } from '../../utils/achievementExport';

export default function AchievementData() {
  const setAchievementProgress = useStore((s) => s.setAchievementProgress);
  const achievementProgress = useStore((s) => s.achievementProgress);
  
  const completedCount = Object.keys(achievementProgress || {}).length;
  
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const result = parseAchievementImport(data);
      if (!result.present) {
        setImportStatus({ type: 'error', message: 'No achievement data was found in this file.' });
        return;
      }

      setImportStatus({ type: 'preview', result });
    } catch (err) {
      if (err instanceof SyntaxError) {
        setImportStatus({ type: 'error', message: 'This file contains invalid JSON.' });
      } else {
        setImportStatus({ type: 'error', message: err.message });
      }
    }
  };

  const confirmImport = () => {
    if (importStatus?.type !== 'preview') return;
    const { result } = importStatus;

    setAchievementProgress(result.progress, { mode: 'replace' });

    if (result.validIds.length === 0) {
      setImportStatus({ type: 'success', message: 'Achievement progress cleared.' });
    } else {
      let msg = `Imported ${result.validIds.length.toLocaleString()} completed achievements.`;
      if (result.unknownIds.length > 0) {
        msg += ` ${result.unknownIds.length.toLocaleString()} unknown IDs were skipped.`;
      }
      setImportStatus({ type: 'success', message: msg });
    }
  };

  const cancelImport = () => {
    setImportStatus(null);
  };

  const handleExportClick = () => {
    const dataToExport = exportAchievementData(achievementProgress);
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    a.href = url;
    a.download = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}_travelers-toolkit-achievements.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="genshin-card p-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-primary border-b border-[var(--border)] pb-2 flex justify-between items-center">
        <span>Achievement Data</span>
        <span className="text-sm">🏆</span>
      </h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        Export your completed achievement IDs to a file, or import an existing completion array.
        Note: Achievement-only exports do not retain completion timestamps. Use full Traveler's Toolkit backups to retain precise dates.
      </p>

      <div className="flex flex-col gap-3 mt-2">
        <button className="genshin-btn w-full flex justify-center items-center gap-2" onClick={handleExportClick}>
          <span>📥</span> Export Achievements (.json)
        </button>
        <div className="flex gap-3">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
          <button className="genshin-btn-ghost w-full flex justify-center items-center gap-2" onClick={handleImportClick}>
            <span>📤</span> Import Achievements
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="bg-[var(--elevated)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3 shadow-lg mt-2">
          {importStatus.type === 'error' && (
            <div className="text-red-400 text-sm flex items-center justify-between">
              <span>{importStatus.message}</span>
              <button onClick={cancelImport} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
            </div>
          )}

          {importStatus.type === 'success' && (
            <div className="text-green-400 text-sm flex items-center justify-between">
              <span>{importStatus.message}</span>
              <button onClick={cancelImport} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
            </div>
          )}

          {importStatus.type === 'preview' && (
            <div className="flex flex-col gap-3">
              <div className="text-[var(--text)] text-sm">
                {importStatus.result.validIds.length === 0 ? (
                  <span className="text-yellow-400 font-medium">This import will clear all local achievement completions.</span>
                ) : (
                  <span className="text-primary font-medium">This import will replace your current local achievement completion state.</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-black/20 p-3 rounded border border-[var(--border)]">
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Current Completed</div>
                  <div className="font-medium text-[var(--text)]">{completedCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Imported Known</div>
                  <div className="font-medium text-green-400">{importStatus.result.validIds.length.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Unknown Skipped</div>
                  <div className={`font-medium ${importStatus.result.unknownIds.length > 0 ? 'text-yellow-400' : 'text-[var(--muted)]'}`}>
                    {importStatus.result.unknownIds.length.toLocaleString()}
                  </div>
                </div>
                {importStatus.result.duplicateIds.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Duplicates</div>
                    <div className="font-medium text-[var(--muted)]">{importStatus.result.duplicateIds.length.toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={confirmImport} className="bg-primary hover:bg-primary/80 text-black font-semibold px-4 py-1.5 rounded transition-colors text-sm">
                  Confirm Replacement
                </button>
                <button onClick={cancelImport} className="bg-white/5 hover:bg-white/10 text-[var(--text)] px-4 py-1.5 rounded border border-[var(--border)] transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
