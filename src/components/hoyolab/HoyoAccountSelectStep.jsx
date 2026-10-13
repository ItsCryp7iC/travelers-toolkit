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
        <span className="text-3xl" aria-hidden="true">
          ⚠️
        </span>
        <h3 className="text-base font-bold text-[var(--color-text-main)]">
          No Genshin Impact Accounts Found
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          We could not find any Genshin Impact game accounts linked to this HoYoLAB profile.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="genshin-btn px-6 py-2"
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
        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-1">
          Select Genshin Impact Account
        </h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          {accounts.length === 1
            ? 'Confirm the game profile you would like to connect to Traveler’s Toolkit.'
            : 'Choose which linked Genshin Impact profile you want to sync.'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-xs flex items-center gap-2"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
        {accounts.map((acc) => {
          const isSelected = selectedUid === acc.uid;
          return (
            <div
              key={acc.uid}
              onClick={() => setSelectedUid(acc.uid)}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                isSelected
                  ? 'bg-primary/10 border-primary shadow-sm'
                  : 'bg-[var(--elevated)] border-[var(--border)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--color-text-main)]">
                    {acc.nickname || 'Traveler'}
                  </span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface)] text-primary border border-[var(--border)]">
                    AR {acc.level}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>{acc.serverName || acc.server}</span>
                  <span>•</span>
                  <span className="font-mono">UID: {acc.uid}</span>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-[#0d0f1a]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                {isSelected && <div className="w-1.5 h-1.5 bg-[#0d0f1a] rounded-full" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 mt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--elevated)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !selectedUid}
          className="genshin-btn px-6 py-2 min-w-[130px] flex justify-center items-center gap-2"
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
