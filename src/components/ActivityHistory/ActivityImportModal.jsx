import React, { useEffect, useRef } from 'react';
import { acquireBodyScrollLock } from '../../utils/scrollLock';

export default function ActivityImportModal({
  importData,
  onConfirm,
  onCancel,
  isImporting = false,
}) {
  const modalRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const prevActiveElementRef = useRef(null);

  useEffect(() => {
    prevActiveElementRef.current = document.activeElement;
    const releaseScrollLock = acquireBodyScrollLock();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isImporting) {
        onCancel();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === firstEl ||
            !modalRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (
            document.activeElement === lastEl ||
            !modalRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on confirm button
    if (confirmBtnRef.current && !confirmBtnRef.current.disabled) {
      confirmBtnRef.current.focus();
    }

    return () => {
      releaseScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
      if (
        prevActiveElementRef.current &&
        typeof prevActiveElementRef.current.focus === 'function'
      ) {
        prevActiveElementRef.current.focus();
      }
    };
  }, [onCancel, isImporting]);

  if (!importData) return null;

  const {
    fileName,
    declaredCount,
    validCount,
    invalidCount,
    duplicateCount,
    newCount,
    fileDuplicatesCount = 0,
    existingDuplicatesCount = duplicateCount ?? 0,
    newCandidateCount = newCount ?? 0,
  } = importData;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      aria-describedby="import-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-[#0a1128] border border-[#C8A96E]/40 rounded-xl shadow-2xl p-5 sm:p-6 space-y-5 text-white"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">
              📥
            </span>
            <h2
              id="import-modal-title"
              className="text-lg font-bold text-white tracking-tight"
            >
              Import Activity History
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="text-slate-400 hover:text-white text-lg p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* File Details & Summary Stats */}
        <div className="space-y-3 text-sm">
          <p id="import-modal-description" className="text-slate-300 leading-relaxed">
            Preview of historical activity events found in{' '}
            <strong className="text-white font-mono break-all">
              {fileName || 'selected file'}
            </strong>
            :
          </p>

          <div className="grid grid-cols-2 gap-2 bg-black/40 p-3.5 rounded-lg border border-white/10 text-xs">
            <div>
              <span className="text-slate-400 block">Declared in File</span>
              <span className="text-base font-semibold text-slate-200">
                {declaredCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Valid Events</span>
              <span className="text-base font-semibold text-emerald-400">
                {validCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">New to Add</span>
              <span className="text-base font-semibold text-[#C8A96E]">
                {newCandidateCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Existing Duplicates</span>
              <span className="text-base font-semibold text-slate-400">
                {existingDuplicatesCount}
              </span>
            </div>
            {fileDuplicatesCount > 0 && (
              <div className="col-span-2 pt-1 border-t border-white/5 flex items-center justify-between text-slate-400">
                <span>Duplicate Records in File</span>
                <span className="font-semibold text-slate-300">
                  {fileDuplicatesCount}
                </span>
              </div>
            )}
            {invalidCount > 0 && (
              <div className="col-span-2 pt-1 border-t border-white/5">
                <span className="text-amber-400 block">
                  ⚠️ {invalidCount} malformed/invalid event(s) will be skipped.
                </span>
              </div>
            )}
          </div>

          {/* Retention notice */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span> Storage Retention Notice
            </p>
            <p className="text-amber-200/90 leading-relaxed">
              Activity History enforces retention bounds of 1,000 events and 750
              KiB. If the merged total exceeds these bounds, the oldest events
              will be pruned automatically.
            </p>
          </div>

          <p className="text-xs text-slate-400 italic">
            Note: Importing activity history is informational and does not
            modify your inventory, characters, weapons, or achievements.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isImporting || validCount === 0}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-black bg-[#C8A96E] hover:bg-[#d8b97e] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isImporting ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  );
}