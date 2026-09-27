import React, { useState } from 'react';
import { formatName } from '../../utils/gameData';
import { formatNumber } from '../../utils/calculator';

export default function PlannerBreakdownRow({ entry: { name, entry, totalCosts, talentState, weaponState } }) {
  const [open, setOpen] = useState(false)
  const displayName = formatName(name)

  const totalMora = totalCosts?.mora || 0

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--elevated)] transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
          style={{ background: 'rgba(200,169,110,0.15)', color: 'var(--gold)' }}>
          {displayName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)] truncate">{displayName}</p>
          <p className="text-xs text-[var(--muted)]">
            A{entry.ascension ?? 0} Lv{entry.level ?? 1} → A{entry.targetAscension ?? 6} Lv{entry.targetLevel ?? 90}
            {talentState && (
              <span className="ml-2">
                • Talents {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}→{talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
              </span>
            )}
            {weaponState && weaponState.equippedWeapon && (
              <span className="ml-2 border-l border-[var(--border)] pl-2">
                🗡️ {formatName(weaponState.equippedWeapon)} {weaponState.weaponFromLv}→{weaponState.weaponToLv}
              </span>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-[var(--gold)]">{formatNumber(totalMora)}</p>
          <p className="text-xs text-[var(--muted)]">Total Mora</p>
        </div>
        <span className="text-[var(--muted)] text-xs ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {totalCosts?.heros_wit > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">📚 Hero's Wit</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts.heros_wit}</p>
              </div>
            )}
            {totalCosts?.mystic_ore > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">💠 Mystic Ore</p>
                <p className="text-sm font-bold text-[#F472B6]">×{totalCosts.mystic_ore}</p>
              </div>
            )}
            {totalCosts?.crown > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">👑 Crowns</p>
                <p className="text-sm font-bold text-[#FBBF24]">×{totalCosts.crown}</p>
              </div>
            )}
            {totalCosts?.masterless_stella_fortuna > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">⭐ Stella Fortuna</p>
                <p className="text-sm font-bold text-[#FBBF24]">×{totalCosts.masterless_stella_fortuna}</p>
              </div>
            )}

            {/* Gemstones */}
            {['gem_sliver', 'gem_fragment', 'gem_chunk', 'gem_gemstone'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">💎 {formatName(key.replace('gem_', ''))}</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Boss & Local */}
            {totalCosts?.boss_material > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">🐉 Boss Material</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts.boss_material}</p>
              </div>
            )}
            {totalCosts?.local_specialty > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">🌸 Local Specialty</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts.local_specialty}</p>
              </div>
            )}

            {/* Talent Books */}
            {['2_star_talent_material', '3_star_talent_material', '4_star_talent_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">📖 {key.split('_')[0]}-Star Book</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Weekly Boss */}
            {totalCosts?.weekly_boss_material > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">🐺 Weekly Boss</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts.weekly_boss_material}</p>
              </div>
            )}

            {/* Weapon Asc Mats */}
            {['2_star_ascension_material', '3_star_ascension_material', '4_star_ascension_material', '5_star_ascension_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">🔗 {key.split('_')[0]}-Star Asc. Mat</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Elite Drops */}
            {['2_star_enhancement_material', '3_star_enhancement_material', '4_star_enhancement_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">🛡️ {key.split('_')[0]}-Star Elite Mat</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Mob Drops */}
            {['1_star_enemy_material', '2_star_enemy_material', '3_star_enemy_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--muted)] mb-0.5">⚔️ {key.split('_')[0]}-Star Mob Drop</p>
                <p className="text-sm font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
