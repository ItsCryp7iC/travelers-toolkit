import React, { useState } from 'react';
import SafeHtml from './SafeHtml';

/**
 * Editorial Notes & Gameplay Guidance Component
 * Renders complete English editorial tips, ability mechanics, rotation guides,
 * rotation notation glossary, and calculation credits.
 */
export default function BuildEditorialNotes({
  notes = [],
  gameplayTips = [],
  calculationCredits = [],
  guideRoleUrl,
}) {
  const [showRotationGlossary, setShowRotationGlossary] = useState(true);

  const hasNotes = notes.length > 0;
  const hasTips = gameplayTips.length > 0;
  const hasCredits = calculationCredits.length > 0;

  if (!hasNotes && !hasTips && !hasCredits) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ── Main Editorial Guidance & Tips Section ── */}
      <section
        aria-label="Build Notes and Gameplay Tips"
        className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl" aria-hidden="true">
              📝
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase">
                Build Guidance & Gameplay Tips
              </h3>
              <p className="text-xs text-slate-400">
                Playstyle breakdown, ability synergies, rotation sequencing, and rotation notation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRotationGlossary((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-sky-300 text-xs font-medium border border-white/10 transition-colors self-start sm:self-auto"
          >
            <span>⚡ Rotation Glossary</span>
            <span className="text-[10px] text-slate-400">
              {showRotationGlossary ? '▲' : '▼'}
            </span>
          </button>
        </div>

        {/* Expandable Rotation Notation Glossary */}
        {showRotationGlossary && (
          <div
            role="region"
            aria-label="Rotation Notation Guide"
            className="p-4 rounded-xl bg-slate-950/80 border border-sky-500/20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>📖</span>
                <span>Rotation & Combo Notation Key</span>
              </h4>
              <span className="text-[10px] text-slate-400">Standard Theorycrafting Symbols</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">NA / N1..N5</span>
                <p className="text-[11px] text-slate-300">Normal Attack (Hits 1 to 5)</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">CA / C</span>
                <p className="text-[11px] text-slate-300">Charged Attack</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">E / tE / hE</span>
                <p className="text-[11px] text-slate-300">Skill (Tap E / Hold E)</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">Q</span>
                <p className="text-[11px] text-slate-300">Elemental Burst</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">D</span>
                <p className="text-[11px] text-slate-300">Dash / Sprint Cancel</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">J / P</span>
                <p className="text-[11px] text-slate-300">Jump Cancel / Plunge</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">N2C / N1C</span>
                <p className="text-[11px] text-slate-300">Normal into Charged Attack</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 space-y-0.5">
                <span className="font-mono font-bold text-sky-300 text-xs">Swap / &gt;</span>
                <p className="text-[11px] text-slate-300">Switch character / Then</p>
              </div>
            </div>
          </div>
        )}

        {/* 1. General Editorial Notes */}
        {hasNotes && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Role Analysis & Playstyle Details
            </h4>
            <div className="space-y-3 bg-slate-950/60 border border-white/5 rounded-xl p-4 sm:p-5">
              {notes.map((noteObj, idx) => (
                <div key={idx} className="space-y-1">
                  <SafeHtml content={noteObj.renderedHtml} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Gameplay & Mechanics Tips */}
        {hasTips && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Key Mechanics & Gameplay Nuances
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gameplayTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/60 border border-white/5 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                    <span aria-hidden="true">💡</span>
                    <span>{tip.title}</span>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <SafeHtml content={tip.renderedHtml} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Calculation Credits & Attribution Region ── */}
      <section
        aria-label="Calculation Credits and Attribution"
        className="bg-slate-900/30 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>🧮</span>
              <span>Theorycrafting & Calculation Credits</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Calculations, damage simulations, and weapon tier rankings provided by community theorycrafters:
            </p>
          </div>

          {guideRoleUrl && (
            <a
              href={guideRoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 underline underline-offset-2 transition-colors self-start sm:self-auto"
            >
              <span>View Source Build Guide</span>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>

        {hasCredits ? (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {calculationCredits.map((credit, idx) => {
              const isLink = Boolean(credit.link);
              const content = (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">
                    {credit.category || 'Calc'}:
                  </span>
                  <span className="font-semibold text-white">
                    {credit.author || 'Contributor'}
                  </span>
                  {isLink && (
                    <span className="text-[10px] text-sky-400" aria-hidden="true">
                      ↗
                    </span>
                  )}
                </span>
              );

              if (isLink) {
                return (
                  <a
                    key={idx}
                    href={credit.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                    title={`View calculation sheet by ${credit.author}`}
                  >
                    {content}
                  </a>
                );
              }

              return <div key={idx}>{content}</div>;
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Standard Helper Team consensus calculations and community testing.
          </p>
        )}

        <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            Recommendations are provided by Genshin Impact Helper Team and remain copyrighted by their contributors.
          </span>
          <span className="text-slate-600">
            Traveler&apos;s Toolkit is an independent open-source tool not affiliated with HoYoverse.
          </span>
        </div>
      </section>
    </div>
  );
}
