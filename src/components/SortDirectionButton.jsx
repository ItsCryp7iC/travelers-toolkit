import React from 'react';

export default function SortDirectionButton({ direction, onToggle }) {
  const isAsc = direction === 'asc';
  
  return (
    <button
      type="button"
      onClick={() => onToggle(isAsc ? 'desc' : 'asc')}
      className="bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs rounded-lg px-3 py-2 hover:border-[var(--gold)] focus:border-[var(--gold)] transition-colors flex items-center gap-1"
      aria-label={isAsc ? 'Sort descending' : 'Sort ascending'}
      title="Sort ascending/descending"
    >
      <span>{isAsc ? '↑' : '↓'}</span>
      <span>{isAsc ? 'Asc' : 'Desc'}</span>
    </button>
  );
}
