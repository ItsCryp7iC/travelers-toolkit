import React from 'react';
import SafeHtml from './SafeHtml';

/**
 * Main stat slot config (Sands, Goblet, Circlet)
 */
const MAIN_STAT_SLOTS = [
  {
    key: 'sands',
    title: 'Sands of Eon',
    shortLabel: 'Sands',
    icon: '⏳',
    color: 'text-amber-300',
    border: 'border-amber-500/20',
  },
  {
    key: 'goblet',
    title: 'Goblet of Eonothem',
    shortLabel: 'Goblet',
    icon: '🍷',
    color: 'text-rose-300',
    border: 'border-rose-500/20',
  },
  {
    key: 'circlet',
    title: 'Circlet of Logos',
    shortLabel: 'Circlet',
    icon: '👑',
    color: 'text-sky-300',
    border: 'border-sky-500/20',
  },
];

/**
 * Artifact Stat & Substat Priorities Component
 * Displays main stat recommendations across Sands, Goblet, and Circlet,
 * alongside ranked substat priority sequences and ER requirement guidance.
 */
export default function ArtifactStatPriorities({ artifacts }) {
  const mainStats = artifacts?.mainStats || {};
  const substats = artifacts?.substats || {};
  const mainSectionNotes = mainStats?.sectionNotes || [];
  const subPriorityGroups = substats?.priorityGroups || [];
  const subSectionNotes = substats?.sectionNotes || [];

  return (
    <section
      aria-label="Artifact Stats & Substats"
      className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-5"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            📊
          </span>
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Artifact Main Stats & Substats
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-white/5">
          Stat Optimization
        </span>
      </div>

      {/* ── 1. Main Stat Recommendations ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <span>Primary Main Stats</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MAIN_STAT_SLOTS.map((slot) => {
            const statItems = mainStats[slot.key] || [];

            return (
              <div
                key={slot.key}
                className={`bg-slate-950/70 border ${slot.border} rounded-xl p-3 sm:p-3.5 space-y-2 flex flex-col justify-between`}
              >
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <span className="text-base" aria-hidden="true">
                    {slot.icon}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {slot.shortLabel}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {slot.title}
                    </span>
                  </div>
                </div>

                {statItems.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    Flexible / Not Specified
                  </p>
                ) : (
                  <div className="space-y-2 py-0.5">
                    {statItems.map((st, idx) => (
                      <div
                        key={st.statKey || `${slot.key}-${idx}`}
                        className="space-y-1"
                      >
                        <div className="flex items-center gap-1.5">
                          {idx > 0 && (
                            <span className="text-slate-500 text-xs font-semibold">
                              /
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-100">
                            {st.name}
                          </span>
                        </div>
                        {st.note && (
                          <div className="text-[10px] text-slate-400 leading-normal pl-2 border-l border-white/10">
                            <SafeHtml content={st.note} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Main Stats Section Notes */}
        {mainSectionNotes.length > 0 && (
          <div
            role="note"
            className="p-2.5 rounded-lg bg-slate-950/40 border border-white/5 text-[11px] text-slate-300 space-y-1"
          >
            {mainSectionNotes.map((note, idx) => (
              <SafeHtml key={idx} content={note} />
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Substat Priorities ── */}
      <div className="pt-3 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span>Substat Upgrade Priority</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {subPriorityGroups.length}{' '}
            {subPriorityGroups.length === 1 ? 'Priority Tier' : 'Priority Tiers'}
          </span>
        </div>

        {subPriorityGroups.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            Standard offensive and energy scaling substats.
          </p>
        ) : (
          <div className="space-y-2">
            {subPriorityGroups.map((group) => {
              const items = group.items || [];

              return (
                <div
                  key={group.rank}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                >
                  {/* Rank position badge */}
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-sky-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/10">
                    {group.rank}
                  </div>

                  {/* Substat alternatives within this priority tier */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {items.map((sub, idx) => (
                        <React.Fragment key={sub.statKey || idx}>
                          {idx > 0 && (
                            <span className="text-slate-500 text-xs font-semibold">
                              ≈
                            </span>
                          )}
                          <span className="text-xs font-semibold text-white">
                            {sub.name}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Any notes on individual substats in this group */}
                    {items.some((sub) => sub.note) && (
                      <div className="space-y-1 pt-0.5">
                        {items
                          .filter((sub) => sub.note)
                          .map((sub, nIdx) => (
                            <div
                              key={nIdx}
                              className="text-[10px] text-slate-400 pl-2 border-l border-sky-500/30"
                            >
                              <strong className="text-slate-300 font-medium">
                                {sub.name}:
                              </strong>{' '}
                              <SafeHtml content={sub.note} />
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Substats Section Notes (e.g. Energy Recharge Requirements) */}
        {subSectionNotes.length > 0 && (
          <div
            role="note"
            className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/20 text-xs text-sky-200/90 space-y-1.5"
          >
            <div className="flex items-center gap-1.5 font-semibold text-sky-300 text-[11px] uppercase tracking-wider">
              <span>⚡</span>
              <span>Energy Recharge & Substat Guidance</span>
            </div>
            {subSectionNotes.map((noteHtml, idx) => (
              <SafeHtml key={idx} content={noteHtml} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
