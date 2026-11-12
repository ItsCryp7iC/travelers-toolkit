import React, { useEffect, useRef } from 'react';
import { acquireBodyScrollLock } from '../../utils/scrollLock';

export default function ActivityClearModal({
  onConfirm,
  onCancel,
  isClearing = false,
}) {
  const modalRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const prevActiveElementRef = useRef(null);

  useEffect(() => {
    prevActiveElementRef.current = document.activeElement;
    const releaseScrollLock = acquireBodyScrollLock();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isClearing) {
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

    // Initial focus on Cancel button for safety
    if (cancelBtnRef.current) {
      cancelBtnRef.current.focus();
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
  }, [onCancel, isClearing]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-modal-title"
      aria-describedby="clear-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-[#0a1128] border border-rose-500/40 rounded-xl shadow-2xl p-5 sm:p-6 space-y-5 text-white"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">
              🗑️
            </span>
            <h2
              id="clear-modal-title"
              className="text-lg font-bold text-white tracking-tight"
            >
              Clear Activity History?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isClearing}
            className="text-slate-400 hover:text-white text-lg p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div
          id="clear-modal-description"
          className="space-y-3 text-sm text-slate-300 leading-relaxed"
        >
          <p>
            This permanently removes recorded activity from this browser. Your
            inventory, characters, weapons, achievements, and other saved data
            will not be affected.
          </p>
          <p className="text-xs text-rose-300/80 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
            This action cannot be undone. Any local activity history records will
            be deleted immediately.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={isClearing}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isClearing}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isClearing ? 'Clearing...' : 'Clear History'}
          </button>
        </div>
      </div>
    </div>
  );
}