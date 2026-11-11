import React from 'react';
import { formatItemName } from '../../utils/calculator';
import { getMaterialIcon } from '../../utils/assetHelper';
import { formatPlannerQuantity } from '../../utils/plannerTabs';
import { getThirdCellPresentation } from '../../utils/plannerSurplus';

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

function ProgressBar({ owned, required, toFarm, guaranteedToFarm, accent }) {
  const isGuaranteedCovered = (typeof guaranteedToFarm === 'number' ? guaranteedToFarm === 0 : toFarm === 0);
  const isLikelyCovered = !isGuaranteedCovered && toFarm === 0;
  const pct = required > 0
    ? (isGuaranteedCovered ? 100 : Math.min(100, Math.round((owned / required) * 100)))
    : 100;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--elevated)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isGuaranteedCovered ? '#4ADE80' : isLikelyCovered ? '#60A5FA' : accent || 'var(--gold)',
          }}
        />
      </div>
      <span
        className="text-xs font-bold tabular-nums"
        style={{ color: isGuaranteedCovered ? '#4ADE80' : isLikelyCovered ? '#60A5FA' : 'var(--muted)' }}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function PlannerItemCard({ item, accent }) {
  const rarityBg = RARITY_COLORS[item.rarity || 3] || RARITY_COLORS[3];
  const isGuaranteedCovered =
    typeof item.guaranteedToFarm === 'number' ? item.guaranteedToFarm === 0 : item.toFarm === 0;
  const isLikelyCovered = !isGuaranteedCovered && item.toFarm === 0;
  const isEstimatedDiff =
    typeof item.guaranteedToFarm === 'number' && item.toFarm !== item.guaranteedToFarm;

  const craftQuantity = item.craftQuantity || 0;
  const isOptimized = Boolean(
    (item.isBonusActive && item.optimizedStep) ||
    (item.expectedCrafts !== undefined && item.expectedCrafts !== craftQuantity)
  );
  const displayCraftCount = isOptimized
    ? Math.round(item.expectedCrafts ?? craftQuantity)
    : craftQuantity;
  const expectedOutput = isOptimized
    ? (item.expectedCraftQuantity ?? craftQuantity)
    : craftQuantity;
  const hasCrafting = isOptimized ? displayCraftCount > 0 : craftQuantity > 0;
  const thirdCell = getThirdCellPresentation({
    required: item.required,
    owned: item.owned,
    toFarm: item.toFarm,
    guaranteedShortage: item.guaranteedToFarm,
    expectedShortage: item.toFarm,
    isBonusActive: item.isBonusActive,
    isCraftable: false,
    accent,
  });

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors relative overflow-hidden group self-start w-full">

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
          <span className="text-xs font-semibold text-[var(--text)] truncate mr-2" title={formatItemName(item.name)}>{formatItemName(item.name)}</span>
          <span
            className="font-bold text-xs shrink-0"
            style={{
              color: isGuaranteedCovered
                ? '#4ADE80'
                : isLikelyCovered
                ? '#60A5FA'
                : accent || 'var(--gold)',
            }}
            title={
              isGuaranteedCovered
                ? 'All stocked'
                : isLikelyCovered
                ? `Guaranteed shortage: ${item.guaranteedToFarm} | Likely covered with bonus`
                : isEstimatedDiff
                ? `Est. To Farm: ${item.toFarm} (Guaranteed: ${item.guaranteedToFarm})`
                : `To Farm: ${(item.toFarm || 0).toLocaleString()}`
            }
          >
            {isGuaranteedCovered
              ? '✅'
              : isLikelyCovered
              ? '🎲 ~0'
              : isEstimatedDiff
              ? `×~${formatPlannerQuantity(item.toFarm)}`
              : `×${formatPlannerQuantity(item.toFarm)}`}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-[var(--muted)] mb-1 flex-wrap">
          <span title={`Need: ${(item.required || 0).toLocaleString()}`}>Need: <b className="text-[var(--text)] font-semibold">{formatPlannerQuantity(item.required)}</b></span>
          <span title={`Have: ${(item.owned || 0).toLocaleString()}`}>Have: <b className="font-semibold" style={{ color: item.owned > 0 ? '#4ADE80' : 'var(--muted)' }}>{formatPlannerQuantity(item.owned)}</b></span>
          {hasCrafting && (
            <span
              className="text-amber-400 font-semibold"
              title={
                isOptimized
                  ? `Est. craft operations: ≈${displayCraftCount.toLocaleString()} (Guaranteed: ${craftQuantity.toLocaleString()}) | Est. output: ~${Math.round(expectedOutput).toLocaleString()}`
                  : `Recommended craft: ${craftQuantity.toLocaleString()}`
              }
            >
              Craft:{' '}
              <b className="text-amber-300 font-bold">
                {isOptimized ? `≈${formatPlannerQuantity(displayCraftCount)}` : `+${formatPlannerQuantity(craftQuantity)}`}
              </b>
            </span>
          )}
          <span
            data-testid={thirdCell.isExtra ? `material-extra-${item.name}` : `material-to-farm-${item.name}`}
            title={thirdCell.title}
          >
            {thirdCell.label}:{' '}
            <b
              className="font-semibold"
              style={{ color: thirdCell.color }}
            >
              {thirdCell.formattedValue}
            </b>
          </span>
        </div>
        <ProgressBar
          owned={item.owned}
          required={item.required}
          toFarm={item.toFarm}
          guaranteedToFarm={item.guaranteedToFarm}
          accent={accent}
        />
      </div>
    </div>
  )
}
