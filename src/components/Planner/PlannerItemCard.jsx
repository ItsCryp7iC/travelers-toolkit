import React from 'react';
import { formatItemName } from '../../utils/calculator';
import { getMaterialIcon } from '../../utils/assetHelper';

export const RARITY_COLORS = {
  5: 'rgba(219, 177, 98, 0.2)', // Gold
  4: 'rgba(175, 140, 209, 0.2)', // Purple
  3: 'rgba(92, 172, 238, 0.2)', // Blue
  2: 'rgba(141, 198, 126, 0.2)', // Green
  1: 'rgba(164, 170, 181, 0.2)', // Gray
};

export const RARITY_BORDERS = {
  5: 'var(--rarity-5)',
  4: 'var(--rarity-4)',
  3: 'var(--rarity-3)',
  2: 'var(--rarity-2)',
  1: 'var(--rarity-1)',
};

function ProgressBar({ owned, required, accent }) {
  const pct = required > 0 ? Math.min(100, Math.round((owned / required) * 100)) : 100
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--elevated)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct >= 100 ? '#4ADE80' : accent || 'var(--gold)' }} />
      </div>
      <span className="text-xs font-bold tabular-nums"
        style={{ color: pct >= 100 ? '#4ADE80' : 'var(--muted)' }}>
        {pct}%
      </span>
    </div>
  )
}

export default function PlannerItemCard({ item, accent }) {
  const rarityBg = RARITY_COLORS[item.rarity || 3] || RARITY_COLORS[3];

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors relative overflow-hidden group">

      {/* Background Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: rarityBg }} />

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden" style={{ background: rarityBg }}>
        <img
          src={getMaterialIcon(item.name, item.category)}
          alt={formatItemName(item.name)}
          className="w-10 h-10 object-contain z-10 drop-shadow-md"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
        />
        {/* Fallback icon if image fails to load */}
        <span className="text-xl absolute hidden">📦</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-xs font-semibold text-[var(--text)] truncate mr-2">{formatItemName(item.name)}</span>
          <span className="font-bold text-xs" style={{ color: item.toFarm === 0 ? '#4ADE80' : (accent || 'var(--gold)') }}>
            {item.toFarm === 0 ? '✅' : `×${item.toFarm}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)] mb-1">
          <span>Need: <b className="text-[var(--text)]">{item.required}</b></span>
          <span>Have: <b style={{ color: item.owned > 0 ? '#4ADE80' : 'var(--muted)' }}>{item.owned}</b></span>
          <span>To Farm: <b style={{ color: item.toFarm > 0 ? accent || 'var(--gold)' : 'var(--muted)' }}>{item.toFarm}</b></span>
        </div>
        <ProgressBar owned={item.owned} required={item.required} accent={accent} />
      </div>
    </div>
  )
}
