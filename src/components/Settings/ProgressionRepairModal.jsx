import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import {
  createPreRepairBackup,
  validateRepairBatch,
  executeRepairTransaction,
  computeRepairDiff,
} from '../../utils/progressionRecovery';
import { STORE_NAME } from '../../store/persistence';
import { acquireBodyScrollLock } from '../../utils/scrollLock';
import notify from '../../utils/notify';
import defaultWeaponsData from '../../data/weapons.json';

export default function ProgressionRepairModal({
  isOpen,
  selectedRepairs = [],
  onClose,
  onRepairSuccess,
  roster: customRoster,
  trackedWeapons: customTrackedWeapons,
  weaponsData = defaultWeaponsData,
}) {
  const storeState = useStore((s) => s) || {};
  const currentState = useMemo(() => {
    return {
      ...storeState,
      roster: customRoster !== undefined ? customRoster : storeState.roster,
      trackedWeapons: customTrackedWeapons !== undefined ? customTrackedWeapons : storeState.trackedWeapons,
    };
  }, [storeState, customRoster, customTrackedWeapons]);

  // Wizard steps: 'backup' -> 'preview' -> 'result'
  const [step, setStep] = useState('backup');

  // Backup state
  const [backupResult, setBackupResult] = useState(null);
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);

  // Execution state
  const [isApplying, setIsApplying] = useState(false);
  const [transactionResult, setTransactionResult] = useState(null);

  // Cross-tab concurrency observation
  const [isStorageStale, setIsStorageStale] = useState(false);
  const [storageStaleMessage, setStorageStaleMessage] = useState(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const releaseScrollLock = acquireBodyScrollLock();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isApplying) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      releaseScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isApplying, onClose]);

  // Cross-tab storage change observer
  useEffect(() => {
    if (!isOpen) return;
    const handleStorageChange = (e) => {
      if (e.key === STORE_NAME || e.key === null) {
        setIsStorageStale(true);
        setStorageStaleMessage(
          'External changes from another browser tab or window were detected in storage. Please close this dialog and re-scan.'
        );
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isOpen]);

  // Initialize backup snapshot upon opening
  useEffect(() => {
    if (isOpen) {
      setStep('backup');
      setHasDownloadedBackup(false);
      setHasConfirmedSaved(false);
      setTransactionResult(null);
      setIsStorageStale(false);
      setStorageStaleMessage(null);

      const backup = createPreRepairBackup(currentState);
      setBackupResult(backup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Validation of the selected repairs batch against current state
  const batchValidation = useMemo(() => {
    if (!isOpen || selectedRepairs.length === 0) return { isValid: true, error: null };
    return validateRepairBatch(selectedRepairs, currentState, weaponsData);
  }, [isOpen, selectedRepairs, currentState, weaponsData]);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    if (!backupResult?.isValid || !backupResult?.jsonString) {
      notify.error('Cannot download: backup snapshot failed validation.');
      return;
    }

    try {
      const blob = new Blob([backupResult.jsonString], { type: 'application/json' });
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `travelers-toolkit-pre-repair-backup-${timestamp}.json`;

      if (typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        a.click();
      }

      setHasDownloadedBackup(true);
      notify.info('Backup file download triggered. Please verify it is saved on your device.');
    } catch (err) {
      notify.error(`Failed to trigger download: ${err?.message || 'Download error'}`);
    }
  };

  const handleProceedToPreview = () => {
    if (!backupResult?.isValid) {
      notify.error('Backup creation or validation failed. Repairs are blocked.');
      return;
    }
    if (!hasConfirmedSaved) {
      notify.warning('Please confirm that you have saved the backup file before continuing.');
      return;
    }
    setStep('preview');
  };

  const handleApplyRepairs = () => {
    if (isApplying || isStorageStale) return;
    setIsApplying(true);

    const result = executeRepairTransaction({
      repairs: selectedRepairs,
      getState: () => currentState,
      setState: (patch) => {
        useStore.setState(patch);
      },
      backupValidated: Boolean(backupResult?.isValid && hasConfirmedSaved),
      weaponsData,
    });

    setIsApplying(false);
    setTransactionResult(result);
    setStep('result');

    if (result.success) {
      notify.success(`Successfully repaired ${result.repairedCount} record${result.repairedCount === 1 ? '' : 's'}!`);
      if (typeof onRepairSuccess === 'function') {
        onRepairSuccess(result);
      }
    } else {
      notify.error(`Repair failed: ${result.error || 'Transaction rolled back.'}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repair-modal-title"
    >
      <div className="genshin-card w-full max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl border border-[var(--border)] overflow-hidden">
        {/* Modal Header */}
        <div className="border-b border-[var(--border)] pb-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl sm:text-2xl" aria-hidden="true">🛠️</span>
            <h2 id="repair-modal-title" className="text-base sm:text-lg font-bold text-primary truncate">
              {step === 'backup' && 'Mandatory Pre-Repair Backup'}
              {step === 'preview' && 'Review & Confirm Repairs'}
              {step === 'result' && (transactionResult?.success ? 'Repair Succeeded' : 'Repair Failed')}
            </h2>
          </div>
          <button
            type="button"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-xl font-bold p-1 rounded min-w-[32px] min-h-[32px] flex items-center justify-center focus:outline-none"
            onClick={onClose}
            disabled={isApplying}
            aria-label="Close repair modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 text-xs sm:text-sm text-[var(--color-text-main)]">
          {/* STEP 1: MANDATORY BACKUP */}
          {step === 'backup' && (
            <div className="flex flex-col gap-3.5">
              <p className="text-[var(--color-text-muted)] leading-relaxed">
                Before making any changes to your saved progression records, Traveler's Toolkit requires creating a
                verified backup. In the unlikely event of an unexpected error, this backup ensures your data can be
                restored safely.
              </p>

              {/* Backup Validation Status Card */}
              <div
                className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
                  backupResult?.isValid
                    ? 'bg-green-950/20 border-green-500/30 text-green-300'
                    : 'bg-red-950/20 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span>{backupResult?.isValid ? '✓' : '⚠️'}</span>
                    <span>
                      {backupResult?.isValid
                        ? 'Pre-Repair Backup Snapshot Created & Validated'
                        : 'Backup Snapshot Validation Failed'}
                    </span>
                  </span>
                  {backupResult?.isValid && (
                    <span className="text-[11px] font-mono opacity-80">v{backupResult.schemaVersion}</span>
                  )}
                </div>
                {backupResult?.isValid ? (
                  <p className="text-[11px] text-green-300/80 leading-relaxed">
                    The backup snapshot was verified against the application's restore normalization schema.
                  </p>
                ) : (
                  <p className="text-[11px] text-red-300/90 leading-relaxed">
                    Error: {backupResult?.error || 'Unable to create valid backup snapshot.'}
                  </p>
                )}
              </div>

              {/* Download Action */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  className="genshin-btn flex items-center justify-center gap-2 min-h-[42px] px-4 font-semibold text-xs sm:text-sm"
                  onClick={handleDownloadBackup}
                  disabled={!backupResult?.isValid}
                  aria-label="Download pre-repair backup file"
                >
                  <span aria-hidden="true">📥</span>
                  <span>
                    {hasDownloadedBackup ? 'Download Backup Again (.json)' : 'Download Pre-Repair Backup (.json)'}
                  </span>
                </button>
                <p className="text-[11px] text-[var(--color-text-muted)] italic text-center">
                  Browser download triggers do not guarantee the file was saved. Please verify the file is stored safely.
                </p>
              </div>

              {/* Explicit Confirmation Checkbox */}
              <div className="p-3 rounded-lg bg-[var(--elevated)] border border-[var(--border)] flex items-start gap-3 mt-1">
                <input
                  type="checkbox"
                  id="confirm-saved-backup"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] text-primary focus:ring-primary cursor-pointer shrink-0"
                  checked={hasConfirmedSaved}
                  onChange={(e) => setHasConfirmedSaved(e.target.checked)}
                  disabled={!hasDownloadedBackup}
                  aria-label="Confirm backup saved"
                />
                <label
                  htmlFor="confirm-saved-backup"
                  className={`text-xs leading-relaxed cursor-pointer select-none ${
                    !hasDownloadedBackup ? 'text-[var(--color-text-muted)] opacity-60' : 'text-[var(--color-text-main)]'
                  }`}
                >
                  <strong className="block text-[var(--color-text-main)]">
                    I confirm that I have downloaded and saved this backup file to my device.
                  </strong>
                  I understand that proceeding will apply the selected corrections to my saved character and weapon data.
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & CONFIRMATION */}
          {step === 'preview' && (
            <div className="flex flex-col gap-3.5">
              <p className="text-[var(--color-text-muted)] leading-relaxed">
                Review the exact before-and-after values for the {selectedRepairs.length} record
                {selectedRepairs.length === 1 ? '' : 's'} selected for repair. No data has been modified yet.
              </p>

              {/* Batch Stale / Pre-Validation Warning */}
              {!batchValidation.isValid && (
                <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-300 flex items-start gap-2">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="flex flex-col text-xs leading-relaxed">
                    <strong className="font-bold">Validation Issue Detected:</strong>
                    <span>{batchValidation.error}</span>
                  </div>
                </div>
              )}

              {/* Cross-Tab Concurrency Warning */}
              {isStorageStale && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 flex items-start gap-2">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="flex flex-col text-xs leading-relaxed">
                    <strong className="font-bold">External Storage Modification:</strong>
                    <span>{storageStaleMessage || 'Browser storage was updated by another tab. Please close this modal and re-scan.'}</span>
                  </div>
                </div>
              )}

              {/* Proposed Repairs Diff Table/Cards */}
              <div className="flex flex-col gap-2.5 max-h-[45vh] overflow-y-auto pr-1">
                {selectedRepairs.map((repair) => {
                  const diffs = computeRepairDiff(repair.originalRecord, repair);
                  return (
                    <div
                      key={repair.id}
                      className="p-3 rounded-lg bg-[var(--elevated)] border border-[var(--border)] flex flex-col gap-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              repair.type === 'character'
                                ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/30'
                                : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {repair.type === 'character' ? '👤 Character' : '🗡️ Weapon'}
                          </span>
                          <span className="font-bold truncate text-sm text-[var(--color-text-main)]">
                            {repair.name || repair.id}
                          </span>
                          <span className="text-[11px] text-[var(--color-text-muted)] font-mono truncate hidden sm:inline">
                            ({repair.id})
                          </span>
                        </div>
                        {repair.isAmbiguous && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            User Chosen
                          </span>
                        )}
                      </div>

                      {/* Diffs List */}
                      <div className="flex flex-col gap-1 text-xs">
                        {diffs.length > 0 ? (
                          diffs.map((d, dIdx) => (
                            <div key={dIdx} className="flex items-center justify-between gap-2 text-xs py-0.5">
                              <span className="text-[var(--color-text-muted)]">{d.label}:</span>
                              <span className="font-mono flex items-center gap-1.5">
                                <span className="text-red-400 line-through">{String(d.before)}</span>
                                <span className="text-[var(--color-text-muted)]">→</span>
                                <span className="text-green-400 font-bold">{String(d.after)}</span>
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)] italic">No fields modified.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 rounded bg-blue-950/20 border border-blue-500/30 text-blue-200 text-xs leading-relaxed">
                <p className="font-semibold flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>Batch Application with In-Memory Rollback</span>
                </p>
                <p className="mt-0.5 text-blue-300/80">
                  Repairs will be applied as a single atomic batch in memory with automatic rollback if post-validation fails.
                  Unselected records remain strictly untouched. The downloaded backup file protects against system or browser crashes.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT REPORT */}
          {step === 'result' && (
            <div className="flex flex-col gap-3.5">
              {transactionResult?.success ? (
                <div className="p-4 rounded-lg bg-green-950/20 border border-green-500/30 text-green-300 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <h3 className="font-bold text-base text-green-400">Repair Transaction Succeeded</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-green-300/90">
                    Successfully corrected {transactionResult.repairedCount} progression record
                    {transactionResult.repairedCount === 1 ? '' : 's'}. All affected Roster, Armory, and Planner costs
                    have been automatically recalculated.
                  </p>
                  <p className="text-[11px] text-green-300/70 italic mt-1">
                    An in-memory diagnostic re-scan has verified that the repaired records satisfy domain progression
                    contracts.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-red-950/20 border border-red-500/30 text-red-300 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">❌</span>
                    <h3 className="font-bold text-base text-red-400">Repair Transaction Failed</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-red-300/90">
                    {transactionResult?.error || 'An unexpected error occurred during repair application.'}
                  </p>
                  {transactionResult?.rollbackApplied && (
                    <p className="text-[11px] text-amber-300/90 font-semibold mt-1">
                      ✓ Rollback successfully executed: your stored data was restored to its pre-transaction state.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="border-t border-[var(--border)] pt-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {step === 'backup' && (
            <>
              <button
                type="button"
                className="genshin-btn-ghost px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="genshin-btn px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold"
                onClick={handleProceedToPreview}
                disabled={!backupResult?.isValid || !hasConfirmedSaved}
                aria-label="Proceed to Preview"
              >
                Proceed to Preview →
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                className="genshin-btn-ghost px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold"
                onClick={() => setStep('backup')}
                disabled={isApplying}
              >
                ← Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="genshin-btn-ghost px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold"
                  onClick={onClose}
                  disabled={isApplying}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="genshin-btn px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold"
                  onClick={handleApplyRepairs}
                  disabled={isApplying || !batchValidation.isValid || isStorageStale}
                  aria-label="Confirm & Apply Selected Repairs"
                >
                  {isApplying ? 'Applying...' : `Confirm & Apply ${selectedRepairs.length} Repairs`}
                </button>
              </div>
            </>
          )}

          {step === 'result' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                className="genshin-btn px-5 py-2 min-h-[40px] text-xs sm:text-sm font-semibold"
                onClick={onClose}
                aria-label="Close"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

