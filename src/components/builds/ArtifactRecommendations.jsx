import React, { useState } from 'react';
import SafeHtml from './SafeHtml';

// Source-backed explanations for generic pseudo-set categories
export const PSEUDO_SET_EXPLANATIONS = {
  'atk-set': {
    tag: '+18% ATK',
    label: 'Any 2-Piece +18% ATK Set',
    description: 'Any 2pc set granting +18% ATK (e.g. Gladiator’s Finale, Shimenawa’s Reminiscence, Vermillion Hereafter)',
  },
  'em-set': {
    tag: '+80 EM',
    label: 'Any 2-Piece +80 EM Set',
    description: 'Any 2pc set granting +80 Elemental Mastery (e.g. Gilded Dreams, Wanderer’s Troupe, Flower of Paradise Lost)',
  },
  'er-set': {
    tag: '+20% ER',
    label: 'Any 2-Piece +20% ER Set',
    description: 'Any 2pc set granting +20% Energy Recharge (e.g. Emblem of Severed Fate)',
  },
  'hp-set': {
    tag: '+20% HP',
    label: 'Any 2-Piece +20% HP Set',
    description: 'Any 2pc set granting +20% HP (e.g. Tenacity of the Millelith, Vourukasha’s Glow)',
  },
  'healing-set': {
    tag: '+15% Healing',
    label: 'Any 2-Piece +15% Healing Set',
    description: 'Any 2pc set granting +15% Healing Bonus (e.g. Maiden Beloved, Ocean-Hued Clam)',
  },
  'hydro-set': {
    tag: '+15% Hydro',
    label: 'Any 2-Piece +15% Hydro DMG Set',
    description: 'Any 2pc set granting +15% Hydro DMG Bonus (e.g. Heart of Depth, Nymph’s Dream)',
  },
  'cryo-set': {
    tag: '+15% Cryo',
    label: 'Any 2-Piece +15% Cryo DMG Set',
    description: 'Any 2pc set granting +15% Cryo DMG Bonus (e.g. Blizzard Strayer)',
  },
  'anemo-set': {
    tag: '+15% Anemo',
    label: 'Any 2-Piece +15% Anemo DMG Set',
    description: 'Any 2pc set granting +15% Anemo DMG Bonus (e.g. Viridescent Venerer, Desert Pavilion Chronicle)',
  },
  'physical-set': {
    tag: '+25% Physical',
    label: 'Any 2-Piece +25% Physical DMG Set',
    description: 'Any 2pc set granting +25% Physical DMG (e.g. Bloodstained Chivalry, Pale Flame)',
  },
  'def-set': {
    tag: '+30% DEF',
    label: 'Any 2-Piece +30% DEF Set',
    description: 'Any 2pc set granting +30% DEF (e.g. Husk of Opulent Dreams)',
  },
};

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
 * Single artifact item pill / line
 */
function ArtifactItemRow({ item }) {
  const isPseudo = Boolean(item.isPseudoSet);
  const pseudoInfo = item.pseudoStatTag
    ? PSEUDO_SET_EXPLANATIONS[item.pseudoStatTag]
    : null;

  return (
    <div className="flex-1 min-w-0 bg-slate-950/60 border border-white/5 rounded-xl p-2.5 sm:p-3 transition-colors hover:border-white/15">
      <div className="flex items-start gap-2.5">
        {/* Artifact Slot / Piece Badge */}
        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0 text-base shadow-sm">
          {item.pieces === 4 ? '🏺' : '🧩'}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-white truncate">
                {item.name}
              </span>
              {isPseudo && (
                <span
                  title={
                    pseudoInfo?.description ||
                    'Generic 2-piece category: use any matching 2-piece bonus set'
                  }
                  className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
                >
                  Category
                </span>
              )}
            </div>

            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase flex-shrink-0 ${
                item.pieces === 4
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              }`}
            >
              {item.pieces}-Piece
            </span>
          </div>

          {/* Pseudo-set clarification */}
          {isPseudo && pseudoInfo && (
            <p className="text-[11px] text-amber-300/80 leading-relaxed italic">
              {pseudoInfo.description}
            </p>
          )}

          {/* Item Specific Note */}
          {item.note && (
            <div className="pt-0.5 text-[11px] text-slate-300 leading-relaxed">
              <SafeHtml content={item.note} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a single group option within a rank (could be 4pc, 2pc+2pc, chooseTwo, or choices)
 */
function ArtifactGroupOption({ group }) {
  const { chooseTwo, items = [], choices = [] } = group;

  // Pattern 1: chooseTwo — Choose any two different 2-piece bonuses from the pool
  if (chooseTwo && items.length > 0) {
    return (
      <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3 sm:p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
          <span aria-hidden="true">🔄</span>
          <span>Choose any two 2-Piece bonuses (2pc + 2pc):</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Equip any two different 2-piece sets from the options below:
        </p>
        <div className="grid grid-cols-1 gap-2 pt-1">
          {items.map((it, idx) => (
            <ArtifactItemRow
              key={`chooseTwo-${it.sourceSetId || it.name}-${idx}`}
              item={it}
            />
          ))}
        </div>
      </div>
    );
  }

  // Pattern 2: Fixed items + choice pool(s)
  if (choices.length > 0) {
    return (
      <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3 sm:p-3.5 space-y-3">
        {/* Fixed required set(s) if any */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Fixed 2-Piece Bonus:
            </span>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <ArtifactItemRow
                  key={`fixed-${it.sourceSetId || it.name}-${idx}`}
                  item={it}
                />
              ))}
            </div>
          </div>
        )}

        {/* Choice pools */}
        {choices.map((choicePool, poolIdx) => (
          <div key={`pool-${poolIdx}`} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
              <span aria-hidden="true">➕</span>
              <span>
                {items.length > 0 || poolIdx > 0
                  ? '+ Choose One 2-Piece Bonus from Pool:'
                  : `Choose One 2-Piece Bonus from Pool ${poolIdx + 1}:`}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              {(choicePool.items || []).map((chItem, chIdx) => (
                <ArtifactItemRow
                  key={`pool-${poolIdx}-${chItem.sourceSetId || chItem.name}-${chIdx}`}
                  item={chItem}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Pattern 3: Standard single 4-piece set or fixed 2pc + 2pc combination
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <ArtifactItemRow
          key={`standard-${it.sourceSetId || it.name}-${idx}`}
          item={it}
        />
      ))}
    </div>
  );
}

/**
 * Artifact Sets & Combinations Component
 * Faithfully renders 4-piece sets, 2-piece combinations, choose-two groups,
 * separate choice pools, pseudo-set explanations, conditional sets, and section notes.
 */
export default function ArtifactRecommendations({ artifacts }) {
  const rankedGroups = artifacts?.rankedGroups || [];
  const conditional = artifacts?.conditional || [];
  const sectionNotes = artifacts?.sectionNotes || [];
  const [showConditional, setShowConditional] = useState(true);

  if (rankedGroups.length === 0 && conditional.length === 0) {
    return (
      <section
        aria-label="Artifact Recommendations"
        className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>🏺</span>
            <span>Artifact Sets & Combinations</span>
          </h3>
          <span className="text-[11px] text-slate-500">0 Set Options</span>
        </div>
        <p className="text-xs text-slate-400 italic text-center py-4">
          No artifact set recommendations available for this build.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Artifact Recommendations"
      className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            🏺
          </span>
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Artifact Sets & Combinations
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
            <span>Artifact Selection Context</span>
          </div>
          {sectionNotes.map((noteHtml, idx) => (
            <SafeHtml key={idx} content={noteHtml} />
          ))}
        </div>
      )}

      {/* Ranked Groups */}
      <div className="space-y-3">
        {rankedGroups.map((rg) => {
          const groups = rg.groups || [];
          return (
            <div
              key={rg.rank}
              className="flex items-start gap-2.5 sm:gap-3 p-2.5 bg-slate-900/60 border border-white/5 rounded-2xl"
            >
              {/* Rank Position Badge */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border mt-1 shadow-sm ${getRankBadgeStyle(
                  rg.rank,
                )}`}
              >
                #{rg.rank}
              </div>

              {/* Artifact Groups within this rank */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {groups.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold pt-0.5">
                    <span>Equivalent Set Options</span>
                    <span className="text-slate-500">(≈ Shared Rank)</span>
                  </div>
                )}
                <div className="space-y-2.5">
                  {groups.map((group, gIdx) => (
                    <ArtifactGroupOption key={gIdx} group={group} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conditional Artifacts Section */}
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
                Conditional Artifact Options ({conditional.length})
              </span>
            </div>
            <span className="text-amber-300 text-xs">
              {showConditional ? '▲' : '▼'}
            </span>
          </button>

          {showConditional && (
            <div className="space-y-2 pl-1">
              <p className="text-[11px] text-slate-400 italic">
                These sets excel under specific party synergies, team reaction triggers,
                or dedicated support roles:
              </p>
              <div className="space-y-2">
                {conditional.map((condGroup, idx) => (
                  <div
                    key={idx}
                    className="border-l-2 border-amber-500/40 pl-2.5"
                  >
                    <ArtifactGroupOption group={condGroup} />
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
