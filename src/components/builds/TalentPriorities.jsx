import React from 'react';
import SafeHtml from './SafeHtml';

/**
 * Talent icon and color mapping
 */
function getTalentMeta(talentKey, name) {
  const key = (talentKey || name || '').toLowerCase();
  if (key.includes('burst') || key === 'q') {
    return {
      label: 'Elemental Burst',
      short: 'Burst',
      icon: '💥',
      accent: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      badge: 'Q',
    };
  }
  if (key.includes('skill') || key === 'e') {
    return {
      label: 'Elemental Skill',
      short: 'Skill',
      icon: '⚡',
      accent: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      badge: 'E',
    };
  }
  return {
    label: 'Normal Attack',
    short: 'Normal Attack',
    icon: '🎯',
    accent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    badge: 'NA',
  };
}

/**
 * Talent Priorities Component
 * Displays relative upgrade priority sequences (Burst, Skill, Normal Attack),
 * preserving strict order vs. approximate equality, talent-specific notes,
 * and general section tips.
 */
export default function TalentPriorities({ talents }) {
  const priorityGroups = talents?.priorityGroups || [];
  const sectionNotes = talents?.sectionNotes || [];

  if (priorityGroups.length === 0) {
    return (
      <section
        aria-label="Talent Priorities"
        className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>✨</span>
            <span>Talent Priority Sequence</span>
          </h3>
          <span className="text-[11px] text-slate-500">Unspecified</span>
        </div>
        <p className="text-xs text-slate-400 italic text-center py-4">
          No talent priorities specified for this build role.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Talent Priorities"
      className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            ✨
          </span>
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
            Talent Priorities
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-white/5">
          Upgrade Sequence
        </span>
      </div>

      {/* Visual Sequence Pipeline */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 p-3 bg-slate-950/70 border border-white/10 rounded-xl">
          {priorityGroups.map((group, gIdx) => {
            const isApprox = Boolean(group.isApproximate);
            const items = group.items || [];

            return (
              <React.Fragment key={group.rank || gIdx}>
                {gIdx > 0 && (
                  <div
                    className="text-sky-400/80 font-bold text-sm select-none px-1"
                    aria-hidden="true"
                    title="Higher priority than"
                  >
                    &gt;
                  </div>
                )}

                <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-white/10 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    #{group.rank}
                  </span>

                  <div className="flex items-center gap-1">
                    {items.map((it, itIdx) => {
                      const meta = getTalentMeta(it.talentKey, it.name);
                      return (
                        <React.Fragment key={it.talentKey || itIdx}>
                          {itIdx > 0 && (
                            <span
                              className="text-amber-400 font-bold text-xs px-0.5"
                              title={
                                isApprox
                                  ? 'Approximately equal upgrade priority'
                                  : 'Equal priority'
                              }
                            >
                              ≈
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${meta.accent}`}
                          >
                            <span>{meta.icon}</span>
                            <span>{it.name || meta.short}</span>
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Detailed cards for talents with specific notes */}
        <div className="space-y-2">
          {priorityGroups.map((group) => {
            const items = group.items || [];
            const isApprox = Boolean(group.isApproximate);

            return (
              <div
                key={group.rank}
                className="p-3 rounded-xl bg-slate-950/50 border border-white/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-300 font-bold text-[11px] flex items-center justify-center border border-white/10">
                      {group.rank}
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {items.map((it) => it.name).join(isApprox ? ' ≈ ' : ' = ')}
                    </span>
                  </div>

                  {isApprox && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      ≈ Approx. Equal
                    </span>
                  )}
                </div>

                {/* Talent specific notes */}
                {items.some((it) => it.note) && (
                  <div className="space-y-1.5 pl-7">
                    {items
                      .filter((it) => it.note)
                      .map((it, nIdx) => (
                        <div
                          key={nIdx}
                          className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-white/5"
                        >
                          <strong className="text-white font-medium">
                            {it.name}:
                          </strong>{' '}
                          <SafeHtml content={it.note} />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* General Talents Section Notes */}
        {sectionNotes.length > 0 && (
          <div
            role="note"
            className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/20 text-xs text-sky-200/90 space-y-1.5"
          >
            <div className="flex items-center gap-1.5 font-semibold text-sky-300 text-[11px] uppercase tracking-wider">
              <span>ℹ️</span>
              <span>Talent Sequence Advice</span>
            </div>
            {sectionNotes.map((noteHtml, idx) => (
              <SafeHtml key={idx} content={noteHtml} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
