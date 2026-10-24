import React from 'react';

export default function PlannerStat({ icon, label, value, accent, sub }) {
  return (
    <div className="stat-card flex-col items-start gap-1 p-2.5 sm:py-3.5 sm:px-4">
      <div className="flex items-center gap-2 w-full min-w-0">
        <div className="stat-icon w-8 h-8 sm:w-9 sm:h-9 shrink-0" style={{ background: `${accent || '#C8A96E'}18` }}>{icon}</div>
        <p className="text-[var(--muted)] text-[10px] sm:text-xs truncate flex-1 min-w-0">{label}</p>
      </div>
      <p className="font-bold text-base sm:text-xl pl-0.5 leading-tight mt-0.5 sm:mt-1 truncate max-w-full" style={{ color: accent || 'var(--gold)' }} title={String(value)}>
        {value}
      </p>
      {sub && <p className="text-[10px] sm:text-xs text-[var(--muted)] pl-0.5 truncate max-w-full" title={sub}>{sub}</p>}
    </div>
  );
}
