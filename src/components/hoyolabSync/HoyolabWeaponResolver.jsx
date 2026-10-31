import React from 'react';

export default function HoyolabWeaponResolver({
  char,
  choice,
  onChoiceChange
}) {
  const hoyolabId = char.hoyolabId;
  const status = char.weaponReconciliation?.status;

  if (status === 'matched-instance') {
    const currentChoice = choice || 'update-existing';
    return (
      <div className="flex flex-col gap-2 mt-2 bg-[var(--surface-light)] p-3 rounded-xl border border-[var(--border)]">
        <span className="text-xs font-bold text-[var(--text)]">Weapon Update Action:</span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
            <input
              type="radio"
              name={`w_${hoyolabId}`}
              value="update-existing"
              checked={currentChoice === 'update-existing'}
              onChange={() => onChoiceChange(hoyolabId, 'update-existing')}
            />
            <span className="text-cyan-400 font-medium break-words">Update Existing Weapon</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
            <input
              type="radio"
              name={`w_${hoyolabId}`}
              value="ignore"
              checked={currentChoice === 'ignore'}
              onChange={() => onChoiceChange(hoyolabId, 'ignore')}
            />
            <span className="text-[var(--muted)] break-words">Leave Weapon Unchanged</span>
          </label>
        </div>
      </div>
    );
  }

  if (status === 'existing-tracked-match') {
    const candidate = char.weaponReconciliation?.candidateInstance || char.weaponReconciliation?.candidates?.[0];
    const isAssigned = !!candidate?.assignedTo;
    const currentChoice = choice || (!isAssigned && candidate ? `assign|${candidate.id}` : '');
    const isRequired = isAssigned && !choice;

    const rLvl = char.hoyolab?.weapon?.level ?? 1;
    const rRef = char.hoyolab?.weapon?.refinement ?? 1;
    const showsUpgrade = candidate && (candidate.level < rLvl || candidate.currentRefinement < rRef);

    return (
      <div className={`flex flex-col gap-2 mt-2 bg-[var(--surface-light)] p-3 rounded-xl border ${isRequired ? 'border-amber-500/50 bg-amber-500/5' : 'border-[var(--border)]'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text)]">Resolve Weapon Assignment:</span>
          {isRequired && (
            <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
              Decision Required
            </span>
          )}
        </div>
        {isRequired && (
          <p className="text-xs text-amber-300/80">
            {candidate?.weaponName || char.weaponReconciliation?.weaponName} is currently assigned to {candidate.assignedTo}. Using it will remove that assignment.
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
            <input
              type="radio"
              name={`w_${hoyolabId}`}
              value="ignore"
              checked={currentChoice === 'ignore'}
              onChange={() => onChoiceChange(hoyolabId, 'ignore')}
            />
            <span className="text-[var(--muted)] break-words">Leave Weapon Unchanged</span>
          </label>

          {candidate && (
            <label className="flex items-start gap-2 text-sm cursor-pointer min-h-[36px]">
              <input
                type="radio"
                className="mt-1"
                name={`w_${hoyolabId}`}
                value={`assign|${candidate.id}`}
                checked={currentChoice === `assign|${candidate.id}`}
                onChange={() => onChoiceChange(hoyolabId, `assign|${candidate.id}`)}
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-cyan-400 font-medium break-words">
                  Use Existing Tracked Weapon
                </span>
                <span className="text-xs text-[var(--text)] break-words">
                  {candidate.weaponName || char.weaponReconciliation?.weaponName} — Lv {candidate.level} R{candidate.currentRefinement}
                  {showsUpgrade && (
                    <span className="text-cyan-400 font-mono ml-1.5">
                      → Lv {rLvl} R{rRef}
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--muted)] break-words">
                  {candidate.assignedTo ? (
                    <span className="text-amber-400/90 font-medium">Currently assigned to: {candidate.assignedTo}</span>
                  ) : (
                    'Currently unassigned'
                  )}
                </span>
                {showsUpgrade && currentChoice === `assign|${candidate.id}` && (
                  <span className="text-xs text-cyan-300/70 mt-0.5 break-words">Stats will be updated to match HoYoLAB</span>
                )}
              </div>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
            <input
              type="radio"
              name={`w_${hoyolabId}`}
              value="create"
              checked={currentChoice === 'create'}
              onChange={() => onChoiceChange(hoyolabId, 'create')}
            />
            <span className="text-[var(--muted)] hover:text-cyan-400 transition-colors break-words">Create New Tracked Instance</span>
          </label>
        </div>
      </div>
    );
  }

  const currentChoice = choice || '';
  const isRequired = ['equipment-mismatch', 'ambiguous', 'ambiguous-existing-match'].includes(status) && !choice;

  return (
    <div className={`flex flex-col gap-2 mt-2 bg-[var(--surface-light)] p-3 rounded-xl border ${isRequired ? 'border-amber-500/50 bg-amber-500/5' : 'border-[var(--border)]'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text)]">Resolve Weapon Assignment:</span>
        {isRequired && (
          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
            Decision Required
          </span>
        )}
      </div>
      {isRequired && (
        <p className="text-xs text-amber-300/80">
          Please choose whether to equip the remote weapon or keep your current local weapon.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
          <input
            type="radio"
            name={`w_${hoyolabId}`}
            value="ignore"
            checked={currentChoice === 'ignore'}
            onChange={() => onChoiceChange(hoyolabId, 'ignore')}
          />
          <span className="text-[var(--muted)] break-words">Leave Weapon Unchanged</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
          <input
            type="radio"
            name={`w_${hoyolabId}`}
            value="create"
            checked={currentChoice === 'create'}
            onChange={() => onChoiceChange(hoyolabId, 'create')}
          />
          <span className="text-cyan-400 break-words">Create New Tracked Instance</span>
        </label>
        {char.weaponReconciliation?.candidates?.map(cand => {
          const rLvl = char.hoyolab.weapon?.level ?? 1;
          const rRef = char.hoyolab.weapon?.refinement ?? 1;
          const showsUpgrade = (cand.level < rLvl || cand.currentRefinement < rRef);
          return (
            <label key={cand.id} className="flex items-start gap-2 text-sm cursor-pointer min-h-[36px]">
              <input
                type="radio"
                className="mt-1"
                name={`w_${hoyolabId}`}
                value={`assign|${cand.id}`}
                checked={currentChoice === `assign|${cand.id}`}
                onChange={() => onChoiceChange(hoyolabId, `assign|${cand.id}`)}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-cyan-400 font-medium break-words">
                  Use existing: Lv {cand.level} R{cand.currentRefinement} ({cand.weaponName || char.weaponReconciliation?.weaponName}) — {cand.assignedTo ? `assigned to ${cand.assignedTo}` : 'unassigned'}
                  {showsUpgrade && (
                    <span className="text-cyan-400 font-mono ml-1.5">
                      → Lv {rLvl} R{rRef}
                    </span>
                  )}
                </span>
                {showsUpgrade && currentChoice === `assign|${cand.id}` && (
                  <span className="text-xs text-cyan-300/70 mt-0.5 break-words">Stats will be updated to match HoYoLAB</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
