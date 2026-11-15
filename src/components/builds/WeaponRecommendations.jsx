import React, { useState } from 'react';
import GenshinImage from '../GenshinImage';
import { getWeaponIcon, getWeaponTypeIcon } from '../../utils/assetHelper';
import SafeHtml from './SafeHtml';

/**
 * Format refinement display (e.g. 5 -> "R5", "R1" -> "R1")
 */
function formatRefinement(ref) {
  if (ref === null || ref === undefined) return null;
  const str = String(ref).trim();
  if (str.toUpperCase().startsWith('R')) return str.toUpperCase();
  return `R${str}`;
}

/**
 * Rank badge color accent
 */
function getRankBadgeStyle(rank) {
  switch (rank) {
    case 1:
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20';
    case 2:
      return 'bg-slate-300/20 text-slate-200 border-slate-300/40';
    case 3:
      return 'bg-amber-700/20 text-amber-400 border-amber-700/40';
    default:
      return 'bg-slate-800 text-slate-400 border-white/10';
  }
}

/**
 * Rarity stars styling
 */
function getRarityStars(rarity) {
  const num = Number(rarity) || 0;
  if (num === 5) return { stars: '★★★★★', color: 'text-amber-400' };
  if (num === 4) return { stars: '★★★★', color: 'text-purple-400' };
  if (num === 3) return { stars: '★★★', color: 'text-blue-400' };
  return { stars: '★', color: 'text-slate-400' };
}

/**
 * Single weapon item row within a ranked tier
 */
function WeaponRow({ item, weaponType }) {
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const refinement = formatRefinement(item.refinement);
  const { stars, color: starColor } = getRarityStars(item.rarity);
  const iconSrc = getWeaponIcon(item.toolkitWeaponId || item.name);

  return (
    <div className="flex-1 min-w-0 bg-slate-950/60 border border-white/5 rounded-xl p-2.5 sm:p-3 transition-colors hover:border-white/15">
      <div className="flex items-start gap-3">
        {/* Weapon Icon with Graceful Fallback */}
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 border border-white/10 relative shadow-sm">
          <GenshinImage
            src={iconSrc}
            alt={item.name}
            className="w-full h-full object-cover"
            fallback={
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 p-1">
                {weaponType ? (
                  <GenshinImage
                    src={getWeaponTypeIcon(weaponType)}
                    alt=""
                    className="w-5 h-5 object-contain opacity-50"
                    fallback={<span className="text-xs">⚔️</span>}
                  />
                ) : (
                  <span className="text-xs">⚔️</span>
                )}
              </div>
            }
          />
          {refinement && (
            <span className="absolute bottom-0 right-0 bg-sky-950/90 text-sky-300 font-mono text-[9px] font-bold px-1 rounded-tl border-t border-l border-sky-400/30">
              {refinement}
            </span>
          )}
        </div>

        {/* Weapon Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-white truncate">
                {item.name}
              </span>
              {!item.isToolkitItem && (
                <span
                  title="Source guide recommendation without local Toolkit catalog mapping"
                  className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-white/10"
                >
                  Source
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {refinement && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {refinement}
                </span>
              )}
              {item.rarity && (
                <span className={`text-[10px] font-bold ${starColor}`}>
                  {stars}
                </span>
              )}
            </div>
          </div>

          {/* Item Specific Note */}
          {item.note && (
            <div className="pt-1">
              <div
                className={`text-[11px] text-slate-300 leading-relaxed ${
                  !isNoteExpanded && item.note.length > 140
                    ? 'line-clamp-2'
                    : ''
                }`}
              >
                <SafeHtml content={item.note} />
              </div>
              {item.note.length > 140 && (
                <button
                  type="button"
                  onClick={() => setIsNoteExpanded((prev) => !prev)}
                  className="text-[10px] font-medium text-sky-400 hover:text-sky-300 transition-colors mt-0.5 focus:outline-none"
                >
                  {isNoteExpanded ? 'Show less ▲' : 'Read details ▼'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Weapons Recommendations Component
 * Displays prioritized weapon tiers, multi-weapon options, refinement requirements,
 * conditional weapons, and editorial section notes.
 */
export default function WeaponRecommendations({ weapons, weaponType }) {
  const rankedGroups = weapons?.rankedGroups || [];
  const conditional = weapons?.conditional || [];
  const sectionNotes = weapons?.sectionNotes || [];
  const [showConditional, setShowConditional] = useState(true);

  if (rankedGroups.length === 0 && conditional.length === 0) {
    return (
      <section
        aria-label="Weapons Recommendations"
        className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>⚔️</span>
            <span>Weapons Recommendations</span>
          </h3>
          <span className="text-[11px] text-slate-500">0 Ranked Tiers</span>
        </div>
        <p className="text-xs text-slate-400 italic text-center py-4">
          No weapon recommendations available for this build.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Weapons Recommendations"
      className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            ⚔️
          </span>
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Weapons Recommendations
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-white/5">
          {rankedGroups.length}{' '}
          {rankedGroups.length === 1 ? 'Ranked Tier' : 'Ranked Tiers'}
        </span>
      </div>

      {/* Section Level Notes */}
      {sectionNotes.length > 0 && (
        <div
          role="note"
          className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/20 text-xs text-sky-200/90 space-y-1.5"
        >
          <div className="flex items-center gap-1.5 font-semibold text-sky-300 text-[11px] uppercase tracking-wider">
            <span>ℹ️</span>
            <span>Weapon Ranking Context</span>
          </div>
          {sectionNotes.map((noteHtml, idx) => (
            <SafeHtml key={idx} content={noteHtml} />
          ))}
        </div>
      )}

      {/* Ranked Groups */}
      <div className="space-y-2.5">
        {rankedGroups.map((group) => {
          const items = group.items || [];
          return (
            <div
              key={group.rank}
              className="flex items-start gap-2.5 sm:gap-3 p-2 bg-slate-900/60 border border-white/5 rounded-2xl"
            >
              {/* Rank Position Badge */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border mt-1 shadow-sm ${getRankBadgeStyle(
                  group.rank,
                )}`}
              >
                #{group.rank}
              </div>

              {/* Weapon Options within this Rank (Equivalent Tiers) */}
              <div className="flex-1 min-w-0 space-y-2">
                {items.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold pt-0.5">
                    <span>Equivalent Options</span>
                    <span className="text-slate-500">(≈ Shared Rank)</span>
                  </div>
                )}
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <WeaponRow
                      key={item.sourceWeaponId || `${group.rank}-${idx}`}
                      item={item}
                      weaponType={weaponType}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conditional Weapons Section */}
      {conditional.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowConditional((prev) => !prev)}
            className="w-full flex items-center justify-between text-left p-2.5 rounded-xl bg-amber-950/20 hover:bg-amber-950/30 border border-amber-500/30 transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-amber-400 text-xs" aria-hidden="true">
                ⚡
              </span>
              <span className="text-xs font-semibold text-amber-200">
                Conditional Weapon Options ({conditional.length})
              </span>
            </div>
            <span className="text-amber-300 text-xs">
              {showConditional ? '▲' : '▼'}
            </span>
          </button>

          {showConditional && (
            <div className="space-y-2 pl-1">
              <p className="text-[11px] text-slate-400 italic">
                These weapons are highly effective under specific team compositions,
                energy thresholds, or buff conditions:
              </p>
              <div className="space-y-2">
                {conditional.map((condItem, idx) => (
                  <div
                    key={condItem.sourceWeaponId || idx}
                    className="border-l-2 border-amber-500/40 pl-2.5"
                  >
                    <WeaponRow item={condItem} weaponType={weaponType} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
