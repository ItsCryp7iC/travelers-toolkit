import React from 'react';

export default function HoyolabSyncBadge({ status }) {
  if (status === 'new') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-green-500/20 text-green-400">New</span>;
  if (status === 'update') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400">Update</span>;
  if (status === 'unchanged') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[var(--surface-light)] text-[var(--muted)]">Unchanged</span>;
  if (status === 'conflict') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/20 text-red-400">Conflict</span>;
  if (status === 'unmapped') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-orange-500/20 text-orange-400">Unmapped</span>;
  if (status === 'ignored') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[var(--surface-light)] text-[var(--muted)]">Ignored</span>;
  return null;
}
