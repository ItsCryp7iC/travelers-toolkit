import React, { useState } from 'react';

// Glossary mapping for individual rotation action tokens
export const ROTATION_GLOSSARY = {
  NA: 'Normal Attack',
  N: 'Normal Attack',
  N1: 'Normal Attack (Hit 1)',
  N2: 'Normal Attack (Hit 2)',
  N3: 'Normal Attack (Hit 3)',
  N4: 'Normal Attack (Hit 4)',
  N5: 'Normal Attack (Hit 5)',
  CA: 'Charged Attack',
  C: 'Charged Attack',
  E: 'Elemental Skill',
  tE: 'Tap Elemental Skill',
  hE: 'Hold Elemental Skill',
  h3E: 'Hold Elemental Skill (Max Stacks)',
  Q: 'Elemental Burst',
  D: 'Dash Cancel',
  J: 'Jump Cancel',
  P: 'Plunging Attack',
  Swap: 'Swap to Teammate',
  N2C: '2 Normal Attacks into Charged Attack',
  N1C: '1 Normal Attack into Charged Attack',
  N3D: '3 Normal Attacks into Dash Cancel',
  N5D: '5 Normal Attacks into Dash Cancel',
  N2D: '2 Normal Attacks into Dash Cancel',
  N2E: '2 Normal Attacks into Skill',
  N3E: '3 Normal Attacks into Skill',
  N4E: '4 Normal Attacks into Skill',
  N2CJ: '2 Normal Attacks, Charged Attack, Jump Cancel',
  N2CD: '2 Normal Attacks, Charged Attack, Dash Cancel',
  N3CJ: '3 Normal Attacks, Charged Attack, Jump Cancel',
  N3CD: '3 Normal Attacks, Charged Attack, Dash Cancel',
};

/**
 * Clean and decode HTML entities that might be present in the rotation string
 */
function decodeRotation(raw) {
  if (!raw) return '';
  return raw
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

/**
 * Interactive Rotation Badge
 * Displays ability combo sequences with styling and tooltip breakdown
 */
export default function RotationBadge({ rotation }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cleanRotation = decodeRotation(rotation);

  return (
    <span className="relative inline-block my-1 mx-0.5 align-middle">
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={`Rotation combo: ${cleanRotation}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 border border-sky-400/30 text-sky-200 hover:text-sky-100 font-mono text-xs font-semibold shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400/50"
      >
        <span className="text-[11px] text-sky-400" aria-hidden="true">
          ⚡
        </span>
        <span className="tracking-wide">{cleanRotation}</span>
      </button>

      {/* Floating combo breakdown tooltip */}
      {showTooltip && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 bg-slate-900 border border-sky-500/30 rounded-xl shadow-xl text-left text-[11px] text-slate-200 z-50 pointer-events-none backdrop-blur-md space-y-1 block"
        >
          <span className="block font-semibold text-sky-300 border-b border-white/10 pb-1">
            Combo Sequence:
          </span>
          <span className="block text-slate-300 font-mono text-[10px] break-words">
            {cleanRotation}
          </span>
          <span className="block text-[10px] text-slate-400 pt-0.5">
            Key: NA=Normal, CA=Charged, E=Skill, Q=Burst, D=Dash, J=Jump
          </span>
        </span>
      )}
    </span>
  );
}
