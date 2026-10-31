import React, { useState } from 'react';

export default function HoyoAccountSelectStep({
  accounts = [],
  onSelectAccount,
  onCancel,
  isSubmitting,
  error,
}) {
  const initialUid = accounts.length > 0 ? accounts[0].uid : null;
  const [selectedUid, setSelectedUid] = useState(initialUid);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedUid) return;
    onSelectAccount(selectedUid);
  };

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex flex-col gap-4 text-center py-2">
        <span className="text-3xl shrink-0" aria-hidden="true">
          ⚠️
        </span>
        <h3 className="text-base font-bold text-[var(--color-text-main)] break-words">
          No Genshin Impact Accounts Found
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed break-words">
          We could not find any Genshin Impact game accounts linked to this HoYoLAB profile.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="genshin-btn px-6 py-2.5 w-full sm:w-auto min-h-[44px] flex items-center justify-center text-center"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-1 break-words">
          Select Genshin Impact Account
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] break-words">
          {accounts.length === 1
            ? 'Confirm the game profile you would like to connect to Traveler’s Toolkit.'
            : 'Choose which linked Genshin Impact profile you want to sync.'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2 break-words"
        >
          <span aria-hidden="true" className="shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 max-h-56 sm:max-h-60 overflow-y-auto pr-1 custom-scrollbar">
        {accounts.map((acc) => {
          const isSelected = selectedUid === acc.uid;
          return (
            <div
              key={acc.uid}
              onClick={() => setSelectedUid(acc.uid)}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 min-h-[52px] ${
                isSelected
                  ? 'bg-primary/10 border-primary shadow-sm'
                  : 'bg-[var(--elevated)] border-[var(--border)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--color-text-main)] truncate max-w-[160px] sm:max-w-[220px]">
                    {acc.nickname || 'Traveler'}
                  </span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface)] text-primary border border-[var(--border)] shrink-0">
                    AR {acc.level}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-[var(--color-text-muted)] break-all">
                  <span>{acc.serverName || acc.server}</span>
                  <span>•</span>
                  <span className="font-mono">UID: {acc.uid}</span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-[#0d0f1a]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                {isSelected && <div className="w-2 h-2 bg-[#0d0f1a] rounded-full" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 mt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--elevated)] transition-colors disabled:opacity-50 w-full sm:w-auto min-h-[44px] flex items-center justify-center text-center"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !selectedUid}
          className="genshin-btn px-6 py-2.5 min-w-[130px] w-full sm:w-auto min-h-[44px] flex justify-center items-center gap-2 text-center"
        >
          {isSubmitting ? (
            <>
              <span className="inline-block animate-spin" aria-hidden="true">
                ⏳
              </span>
              <span>Connecting...</span>
            </>
          ) : (
            'Connect Account'
          )}
        </button>
      </div>
    </form>
  );
}
