import React from 'react';

export default function HoyolabWeaponResolver({
  char,
  choice,
  onChoiceChange
}) {
  const hoyolabId = char.hoyolabId;
  const currentChoice = choice || 'ignore';

  return (
    <div className="flex flex-col gap-2 mt-2 bg-[var(--surface-light)] p-3 rounded border border-[var(--border)]">
      <span className="text-xs font-bold text-[var(--text)]">Resolve Weapon Assignment:</span>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`w_${hoyolabId}`}
            checked={currentChoice === 'ignore'}
            onChange={() => onChoiceChange(hoyolabId, 'ignore')}
          />
          <span className="text-[var(--muted)]">Leave Unchanged</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`w_${hoyolabId}`}
            checked={currentChoice === 'create'}
            onChange={() => onChoiceChange(hoyolabId, 'create')}
          />
          <span className="text-cyan-400">Create New Tracked Instance</span>
        </label>
        {char.weaponReconciliation?.candidates?.map(cand => {
          const rLvl = char.hoyolab.weapon?.level ?? 1;
          const rRef = char.hoyolab.weapon?.refinement ?? 1;
          const showsUpgrade = (cand.level < rLvl || cand.currentRefinement < rRef);
          return (
            <label key={cand.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                className="mt-1"
                name={`w_${hoyolabId}`}
                checked={currentChoice === `assign|${cand.id}`}
                onChange={() => onChoiceChange(hoyolabId, `assign|${cand.id}`)}
              />
              <div className="flex flex-col">
                <span className="text-blue-400">
                  Use existing: Lv {cand.level} R{cand.currentRefinement} {showsUpgrade ? `→ Lv ${rLvl} R${rRef}` : ''} {cand.assignedTo ? `(Assigned: ${cand.assignedTo})` : '(Unassigned)'}
                </span>
                {showsUpgrade && currentChoice === `assign|${cand.id}` && (
                  <span className="text-xs text-blue-300/70 mt-0.5">Current stats will be synced to HoYoLAB</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
