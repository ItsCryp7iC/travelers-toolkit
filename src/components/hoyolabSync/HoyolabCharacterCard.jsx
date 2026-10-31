import React from 'react';
import HoyolabSyncBadge from './HoyolabSyncBadge';
import HoyolabWeaponResolver from './HoyolabWeaponResolver';

export default function HoyolabCharacterCard({
  char,
  isTravelerCard = false,
  isSelected,
  onToggleSelect,
  isActionable,
  localAheadOverrides,
  onToggleLocalAheadOverride,
  weaponChoice,
  onWeaponChoice,
  trackedWeaponsMap
}) {
  return (
    <div className={`bg-[var(--surface)] border ${isSelected ? 'border-cyan-500/50' : 'border-[var(--border)]'} rounded-xl p-3 sm:p-4 flex flex-col md:flex-row gap-3 sm:gap-4 items-start md:items-center transition-colors`}>
      {/* Checkbox */}
      {char.status !== 'unmapped' && char.status !== 'ignored' && (!isTravelerCard || isActionable) && (
        <label className="flex items-center gap-2.5 shrink-0 cursor-pointer min-h-[40px]">
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect(char.hoyolabId)}
            className="w-5 h-5 rounded border-[var(--border)] bg-[var(--bg)] checked:bg-cyan-500 cursor-pointer"
          />
        </label>
      )}

      {/* Char Info */}
      <div className="flex-1 min-w-0 md:min-w-[180px]">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-bold text-base sm:text-lg text-[var(--text)] truncate">{char.rosterKey || char.hoyolab?.name}</span>
          <HoyolabSyncBadge status={char.status} />
        </div>

        {char.status === 'unmapped' ? (
          <div className="text-orange-400 text-xs break-words">Not yet supported by Toolkit data (ID: {char.hoyolabId})</div>
        ) : char.status === 'ignored' ? (
          <div className="text-[var(--muted)] text-xs">Excluded from planning sync</div>
        ) : !isTravelerCard ? (
          <div className="text-[var(--muted)] text-xs">
            C{char.hoyolab?.constellation} • Friendship {char.hoyolab?.friendship}
          </div>
        ) : null}
      </div>

      {/* Diff Area */}
      {char.status !== 'unmapped' && char.status !== 'ignored' && (
        <div className="flex-[2] grid grid-cols-[auto_1fr] gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3 text-sm w-full md:w-auto">

          {/* Level & Asc */}
          <div className="text-[var(--muted)] pt-1 text-xs sm:text-sm font-medium">Level</div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm">
              {char.status === 'new' ? (
                <span className="text-cyan-400">Lv {char.hoyolab?.level} A{char.hoyolab?.ascension || 0}</span>
              ) : (
                <>
                  <span>Lv {char.local?.level} A{char.local?.ascension}</span>
                  {(char.changes?.level || char.changes?.ascension) && (
                    <>
                      <span className="text-[var(--muted)]">→</span>
                      <span className={(char.changes?.level?.direction === 'local-ahead' || char.changes?.ascension?.direction === 'local-ahead') ? 'text-yellow-400' : 'text-cyan-400'}>
                        Lv {char.hoyolab?.level} A{char.hoyolab?.ascension || 0}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {((char.changes?.level?.direction === 'local-ahead' || char.changes?.ascension?.direction === 'local-ahead')) && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1 bg-yellow-500/10 p-2 rounded-lg text-xs border border-yellow-500/20">
                <span className="text-yellow-400">Toolkit is ahead.</span>
                <button
                  type="button"
                  onClick={() => onToggleLocalAheadOverride(char.hoyolabId, 'level')}
                  className="px-2.5 py-1 min-h-[32px] bg-[var(--surface)] hover:bg-[var(--border)] rounded text-[var(--text)] ml-auto text-xs"
                >
                  {localAheadOverrides?.[char.hoyolabId]?.level ? 'Using HoYoLAB' : 'Keep Toolkit'}
                </button>
              </div>
            )}
          </div>

          {/* Talents */}
          <div className="text-[var(--muted)] pt-1 text-xs sm:text-sm font-medium">Talents</div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm">
              {char.status === 'new' ? (
                <span className="text-cyan-400">
                  {char.hoyolab?.talents?.normal || 1} / {char.hoyolab?.talents?.skill || 1} / {char.hoyolab?.talents?.burst || 1}
                </span>
              ) : (
                <>
                  <span>{char.local?.talents?.normal} / {char.local?.talents?.skill} / {char.local?.talents?.burst}</span>
                  {char.changes?.talents && (
                    <>
                      <span className="text-[var(--muted)]">→</span>
                      <span className={Object.values(char.changes.talents).some(t => t?.direction === 'local-ahead') ? 'text-yellow-400' : 'text-cyan-400'}>
                        {char.hoyolab?.talents?.normal || 1} / {char.hoyolab?.talents?.skill || 1} / {char.hoyolab?.talents?.burst || 1}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {(char.changes?.talents && Object.values(char.changes.talents).some(t => t?.direction === 'local-ahead')) && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1 bg-yellow-500/10 p-2 rounded-lg text-xs border border-yellow-500/20">
                <span className="text-yellow-400">Toolkit talents ahead.</span>
                <button
                  type="button"
                  onClick={() => onToggleLocalAheadOverride(char.hoyolabId, 'skill')}
                  className="px-2.5 py-1 min-h-[32px] bg-[var(--surface)] hover:bg-[var(--border)] rounded text-[var(--text)] ml-auto text-xs"
                >
                  {localAheadOverrides?.[char.hoyolabId]?.skill ? 'Using HoYoLAB' : 'Keep Toolkit'}
                </button>
              </div>
            )}
          </div>

          {/* Weapon */}
          <div className="text-[var(--muted)] pt-1 text-xs sm:text-sm font-medium">Weapon</div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              {char.weaponReconciliation?.status === 'unmapped' ? (
                <span className="text-orange-400">Unmapped ({char.weaponReconciliation?.hoyolab?.id})</span>
              ) : char.weaponReconciliation?.status === 'would-create' || char.status === 'new' ? (
                <span className="text-cyan-400">
                  {char.weaponReconciliation?.weaponName} Lv {char.hoyolab?.weapon?.level} R{char.hoyolab?.weapon?.refinement || 1}
                </span>
              ) : char.weaponReconciliation?.status === 'equipment-mismatch' ? (
                <div className="flex flex-col">
                  <span className="text-[var(--text)] line-through opacity-70">
                    {trackedWeaponsMap?.[char.weaponReconciliation.equippedInstanceId]?.weaponName || 'Unknown'}
                  </span>
                  <span className="text-yellow-400">{char.weaponReconciliation?.weaponName} Lv {char.hoyolab?.weapon?.level}</span>
                </div>
              ) : char.weaponReconciliation?.status === 'existing-tracked-match' ? (
                <div className="flex flex-col">
                  {char.weaponReconciliation.equippedInstanceId && (
                    <span className="text-[var(--text)] line-through opacity-70">
                      {trackedWeaponsMap?.[char.weaponReconciliation.equippedInstanceId]?.weaponName || 'Unknown'}
                    </span>
                  )}
                  <span className="text-cyan-400 font-medium">
                    {char.weaponReconciliation?.weaponName}
                    <span className="text-xs text-[var(--muted)] ml-1 font-normal">
                      (Armory{char.weaponReconciliation.candidateAssignedTo ? `: ${char.weaponReconciliation.candidateAssignedTo}` : ': Unassigned'})
                    </span>
                  </span>
                  {char.weaponReconciliation.hasWeaponUpdate && (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs font-mono">
                      {char.weaponReconciliation.changes?.level && (
                        <span className="text-cyan-400">
                          <span className="text-[var(--muted)]">Lv {char.weaponReconciliation.changes.level.local}</span>
                          {' → '}
                          Lv {char.weaponReconciliation.changes.level.remote}
                        </span>
                      )}
                      {char.weaponReconciliation.changes?.refinement && (
                        <span className="text-cyan-400">
                          <span className="text-[var(--muted)]">R{char.weaponReconciliation.changes.refinement.local}</span>
                          {' → '}
                          R{char.weaponReconciliation.changes.refinement.remote}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (char.weaponReconciliation?.status === 'ambiguous' || char.weaponReconciliation?.status === 'ambiguous-existing-match') ? (
                <span className="text-yellow-400">
                  {char.weaponReconciliation?.weaponName} Lv {char.hoyolab?.weapon?.level} (Ambiguous)
                </span>
              ) : char.weaponReconciliation?.status === 'suggested-instance' ? (
                <span className="text-blue-400">
                  {char.weaponReconciliation?.weaponName} (Suggest unassigned)
                </span>
              ) : char.weaponReconciliation?.status === 'matched-instance' ? (
                <div className="flex flex-col font-mono text-sm">
                  <span className="font-sans font-medium text-[var(--text)]">
                    {char.weaponReconciliation?.weaponName}
                  </span>
                  {char.weaponReconciliation?.hasWeaponUpdate ? (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs">
                      {char.weaponReconciliation.changes?.level ? (
                        <span className="text-cyan-400">
                          <span className="text-[var(--muted)]">Lv {char.weaponReconciliation.changes.level.local}</span>
                          {' → '}
                          Lv {char.weaponReconciliation.changes.level.remote}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">Lv {char.hoyolab?.weapon?.level}</span>
                      )}
                      {char.weaponReconciliation.changes?.refinement ? (
                        <span className="text-cyan-400">
                          <span className="text-[var(--muted)]">R{char.weaponReconciliation.changes.refinement.local}</span>
                          {' → '}
                          R{char.weaponReconciliation.changes.refinement.remote}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">R{char.hoyolab?.weapon?.refinement || 1}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">
                      Lv {char.hoyolab?.weapon?.level} R{char.hoyolab?.weapon?.refinement || 1}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            {/* Decision warning when required */}
            {isSelected && (
              ['equipment-mismatch', 'ambiguous', 'ambiguous-existing-match'].includes(char.weaponReconciliation?.status) ||
              (char.weaponReconciliation?.status === 'existing-tracked-match' && char.weaponReconciliation.candidateAssignedTo)
            ) && !weaponChoice && (
              <div className="text-xs text-amber-400 flex items-center gap-1 font-medium mt-1">
                ⚠️ Weapon decision required to apply this character
              </div>
            )}

            {/* Weapon Action Resolver */}
            {isSelected && (
              ['ambiguous', 'ambiguous-existing-match', 'suggested-instance', 'equipment-mismatch', 'existing-tracked-match'].includes(char.weaponReconciliation?.status) ||
              (char.weaponReconciliation?.status === 'matched-instance' && char.weaponReconciliation?.hasWeaponUpdate)
            ) && (
              <HoyolabWeaponResolver
                char={char}
                choice={weaponChoice}
                onChoiceChange={onWeaponChoice}
              />
            )}
          </div>

        </div>
      )}
    </div>
  );
}
