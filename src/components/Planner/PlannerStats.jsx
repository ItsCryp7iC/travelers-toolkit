import React from 'react';

export default function PlannerStat({ icon, label, value, accent, sub }) {
  return (
    <div className="stat-card flex-col items-start gap-1 py-4">
      <div className="flex items-center gap-2 w-full">
        <div className="stat-icon w-9 h-9" style={{ background: `${accent || '#C8A96E'}18` }}>{icon}</div>
        <p className="text-[var(--muted)] text-xs">{label}</p>
      </div>
      <p className="font-bold text-xl pl-1 leading-none mt-1" style={{ color: accent || 'var(--gold)' }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--muted)] pl-1">{sub}</p>}
    </div>
  )
}
