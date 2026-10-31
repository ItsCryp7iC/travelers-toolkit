import React from 'react';

export default function HoyolabSyncSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="p-3 sm:p-4 bg-[var(--surface-light)] border-b border-[var(--border)] shrink-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 max-w-4xl mx-auto">
        <div className="bg-[var(--surface)] border border-[var(--border)] p-3 sm:p-4 rounded-xl text-center">
          <div className="text-xl sm:text-2xl font-bold text-[var(--text)]">{summary.totalRemote}</div>
          <div className="text-[var(--muted)] text-[11px] sm:text-xs uppercase tracking-wide">Found</div>
          {summary.ignored > 0 && (
            <div className="text-[var(--muted)] text-[10px] mt-1 opacity-80 break-words">{summary.syncRelevant} syncable • {summary.ignored} ignored</div>
          )}
        </div>
        <div className="bg-[var(--surface)] border border-green-500/20 p-3 sm:p-4 rounded-xl text-center">
          <div className="text-xl sm:text-2xl font-bold text-green-400">{summary.newCharacters}</div>
          <div className="text-[var(--muted)] text-[11px] sm:text-xs uppercase tracking-wide">New</div>
        </div>
        <div className="bg-[var(--surface)] border border-blue-500/20 p-3 sm:p-4 rounded-xl text-center">
          <div className="text-xl sm:text-2xl font-bold text-blue-400">{summary.charactersWithUpdates}</div>
          <div className="text-[var(--muted)] text-[11px] sm:text-xs uppercase tracking-wide">Updates</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] p-3 sm:p-4 rounded-xl text-center">
          <div className="text-xl sm:text-2xl font-bold text-[var(--text)]">{summary.unchangedCharacters}</div>
          <div className="text-[var(--muted)] text-[11px] sm:text-xs uppercase tracking-wide">Up to date</div>
        </div>
      </div>
    </div>
  );
}
