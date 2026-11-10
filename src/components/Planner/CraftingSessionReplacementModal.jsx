import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import { getCraftingFamily } from '../../data/craftingRecipes';
import { acquireBodyScrollLock } from '../../utils/scrollLock';

export default function CraftingSessionReplacementModal() {
  const session = useCraftingSessionStore((s) => s.session);
  const pending = useCraftingSessionStore((s) => s.pendingReplacement);
  const confirmReplacement = useCraftingSessionStore((s) => s.confirmReplacement);
  const cancelReplacement = useCraftingSessionStore((s) => s.cancelReplacement);
  const openDrawer = useCraftingSessionStore((s) => s.openDrawer);

  useEffect(() => {
    if (!pending) return;
    const releaseScrollLock = acquireBodyScrollLock();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cancelReplacement();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pending, cancelReplacement]);

  if (!pending || !session) return null;

  const targetFamily = getCraftingFamily(pending.familyId);
  const targetFamilyName = targetFamily?.name || pending.familyId;
  const activeFamilyName = session.snapshot.familyName;
  const eventCount = session.events.length;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in text-[var(--text)]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="replacement-dialog-title"
      data-testid="session-replacement-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancelReplacement();
      }}
    >
      <div className="w-full max-w-md bg-[var(--elevated)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 id="replacement-dialog-title" className="text-base font-bold text-amber-400">
              Active Crafting Session in Progress
            </h4>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Only one active crafting session is supported at a time.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          You currently have an active crafting session for <b className="text-white">{activeFamilyName}</b> with{' '}
          <b className="text-amber-300">{eventCount} recorded {eventCount === 1 ? 'batch' : 'batches'}</b>.
          Starting a new session for <b className="text-white">{targetFamilyName}</b> will permanently discard your progress in the active session.
        </p>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
          <button
            type="button"
            id="resume-active-session-btn"
            data-testid="resume-active-session-btn"
            onClick={() => {
              cancelReplacement();
              openDrawer();
            }}
            className="genshin-btn-ghost px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Resume {activeFamilyName}
          </button>
          <button
            type="button"
            id="cancel-replacement-btn"
            data-testid="cancel-replacement-btn"
            onClick={cancelReplacement}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-replacement-btn"
            data-testid="confirm-replacement-btn"
            onClick={confirmReplacement}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg cursor-pointer transition-colors"
          >
            Discard & Start {targetFamilyName}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}

