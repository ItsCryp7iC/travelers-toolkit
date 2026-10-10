import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import { reconcileCharacters } from '../utils/hoyolabCharacterReconciliation';
import { buildHoyolabApplyPlan } from '../utils/hoyolabSyncApply';
import { getElementIcon } from '../utils/assetHelper';

export default function HoyolabSyncPreviewModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [filter, setFilter] = useState('All');

  // UI Selections State
  const [selectedChars, setSelectedChars] = useState({});
  const [weaponChoices, setWeaponChoices] = useState({});
  const [localAheadOverrides, setLocalAheadOverrides] = useState({});
  const [selectedDerivedTravelers, setSelectedDerivedTravelers] = useState({});
  // Apply State

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);

  const roster = useStore(s => s.roster);
  const trackedWeapons = useStore(s => s.trackedWeapons);
  const applyHoyolabSync = useStore(s => s.applyHoyolabSync);

  useEffect(() => {
    if (isOpen) {
      fetchSyncPreview();
    } else {
      setReconciliationResult(null);
      setError(null);
      setFilter('All');
      setSelectedChars({});
      setWeaponChoices({});
      setLocalAheadOverrides({});
      setSelectedDerivedTravelers({});
      setShowConfirmation(false);
      setApplyResult(null);

    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showConfirmation) {
          setShowConfirmation(false);
        } else if (!loading && !applyResult) {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmation, loading, applyResult, onClose]);

  const fetchSyncPreview = async () => {
    setLoading(true);
    setError(null);
    setReconciliationResult(null);
    setSelectedChars({});
    setWeaponChoices({});
    setLocalAheadOverrides({});
    setSelectedDerivedTravelers({});
    setShowConfirmation(false);
    setApplyResult(null);

    try {
      const res = await fetch('/api/hoyolab/character-sync-preview', { method: 'POST' });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Your HoYoLAB session has expired. Reconnect HoYoLAB and try again.");
        if (res.status === 403) throw new Error("Battle Chronicle data is private. Enable character details in HoYoLAB settings.");
        if (res.status === 429) throw new Error("HoYoLAB is rate-limiting requests. Please try again in a little while.");
        throw new Error("Could not load HoYoLAB character data. Your Toolkit data was not changed.");
      }
      const data = await res.json();
      const result = reconcileCharacters(data.characters || [], roster, trackedWeapons);
      setReconciliationResult(result);

      // Default Selection
      const defaultSelected = {};
      result.characters.forEach(c => {
        if (c.status === 'ignored' || c.status === 'unmapped' || c.status === 'conflict') return;

        let hasRemoteAhead = false;
        if (c.status === 'new') hasRemoteAhead = true;

        if (c.changes) {
          Object.values(c.changes).forEach(change => {
            if (change && change.direction === 'remote-ahead') hasRemoteAhead = true;
            if (change && typeof change === 'object' && !change.direction) {
              Object.values(change).forEach(tc => {
                if (tc && tc.direction === 'remote-ahead') hasRemoteAhead = true;
              });
            }
          });
        }

        let hasWeaponChange = false;
        if (c.weaponReconciliation && c.weaponReconciliation.status === 'would-create') hasWeaponChange = true;
        if (c.weaponReconciliation && c.weaponReconciliation.status === 'matched-instance' && Object.keys(c.weaponReconciliation.changes || {}).length > 0) hasWeaponChange = true;

        if (hasRemoteAhead || hasWeaponChange) {
          defaultSelected[c.hoyolabId] = true;
        }
      });
      setSelectedChars(defaultSelected);

    } catch (e) {
      setError(e.message || 'Unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const isCharacterActionable = (char) => {
    if (!char) return false;
    if (['new', 'update'].includes(char.status)) return true;
    if (Object.values(char.changes || {}).some(x => x && x.direction === 'local-ahead')) return true;

    const wStatus = char.weaponReconciliation?.status;
    if (['would-create', 'suggested-instance', 'ambiguous', 'equipment-mismatch'].includes(wStatus)) return true;
    if (wStatus === 'matched-instance' && char.weaponReconciliation?.changes && Object.keys(char.weaponReconciliation.changes).length > 0) return true;

    return false;
  };

  const handleSelectAllSafe = () => {
    if (!reconciliationResult) return;
    const newSelected = {};
    reconciliationResult.characters.forEach(c => {
      if (c.rosterKey?.startsWith('Traveler ') && !isCharacterActionable(c)) return;
      if (['new', 'update', 'unchanged'].includes(c.status) && !['unmapped', 'conflict'].includes(c.status)) {
        newSelected[c.hoyolabId] = true;
      }
    });
    setSelectedChars(newSelected);
  };

  const handleClearAll = () => {
    setSelectedChars({});
  };

  const toggleCharSelection = (id) => {
    setSelectedChars(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleWeaponChoice = (id, choice) => {
    setWeaponChoices(prev => ({ ...prev, [id]: choice }));
  };

  const toggleLocalAheadOverride = (id, fieldKey) => {
    setLocalAheadOverrides(prev => {
      const charOverrides = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...charOverrides,
          [fieldKey]: !charOverrides[fieldKey]
        }
      };
    });
  };

  const prepareApply = () => {
    if (!reconciliationResult) return;
    const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars, weaponChoices, localAheadOverrides, selectedDerivedTravelers });


    // Count for summary
    let newCount = 0;
    let updateCount = 0;
    let weaponCreatedCount = 0;
    let weaponUpdatedCount = 0;
    let hasUnresolvedAmbiguity = false;
    let hasInvalidConflict = false;

    plan.characters.forEach(c => {
      if (c.isNew) newCount++;
      else updateCount++;

      if (c.weapon) {
        if (c.weapon.action === 'create') weaponCreatedCount++;
        else if (c.weapon.action === 'assign') weaponUpdatedCount++;
      }
    });

    const travelerVariantsCount = Object.values(selectedDerivedTravelers).filter(Boolean).length;
    setPlanSummary({ newCount, updateCount, weaponCreatedCount, weaponUpdatedCount, travelerVariantsCount, plan });
    setShowConfirmation(true);
  };




  const confirmApply = () => {
    try {
      const result = applyHoyolabSync(planSummary.plan);
      setApplyResult(result);
    } catch (e) {
      alert("Failed to apply sync: " + e.message);
    }
    setShowConfirmation(false);
  };



  const renderBadge = (status) => {
    if (status === 'new') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-green-500/20 text-green-400">New</span>;
    if (status === 'update') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400">Update</span>;
    if (status === 'unchanged') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[var(--surface-light)] text-[var(--muted)]">Unchanged</span>;
    if (status === 'conflict') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/20 text-red-400">Conflict</span>;
    if (status === 'unmapped') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-orange-500/20 text-orange-400">Unmapped</span>;
    if (status === 'ignored') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[var(--surface-light)] text-[var(--muted)]">Ignored</span>;
    return null;
  };

  const { activeTraveler, activeTravelerElement, travelerVariants } = useMemo(() => {
    let activeTraveler = null;
    let activeTravelerElement = null;
    let travelerVariants = [];
    const ALL_TRAVELER_ELEMENTS = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];

    if (reconciliationResult) {
      const travelerChar = reconciliationResult.characters.find(c => c.rosterKey?.startsWith('Traveler '));
      if (travelerChar && ['new', 'update', 'unchanged'].includes(travelerChar.status)) {
        activeTraveler = travelerChar;
        activeTravelerElement = travelerChar.rosterKey.replace('Traveler ', '');
        travelerVariants = ALL_TRAVELER_ELEMENTS.map(e => {
          let status = 'missing';
          if (e === activeTravelerElement) status = 'active';
          else if (roster[`Traveler ${e}`]) status = 'exists';
          return { element: e, status };
        });
      }
    }
    return { activeTraveler, activeTravelerElement, travelerVariants };
  }, [reconciliationResult, roster]);

  const handleSelectAllTravelers = () => {
    const newSel = { ...selectedDerivedTravelers };
    travelerVariants.forEach(tv => {
      if (tv.status === 'missing') newSel[tv.element] = true;
    });
    setSelectedDerivedTravelers(newSel);
  };

  const toggleTravelerSelection = (elem) => {
    setSelectedDerivedTravelers(prev => ({ ...prev, [elem]: !prev[elem] }));
  };

  const trackedWeaponsMap = useMemo(() => {
    const map = {};
    trackedWeapons.forEach(w => map[w.id] = w);
    return map;
  }, [trackedWeapons]);

  const filteredChars = useMemo(() => {
    if (!reconciliationResult) return [];
    return reconciliationResult.characters.filter(c => {
      if (activeTraveler && c.hoyolabId === activeTraveler.hoyolabId) return false;
      if (filter === 'All') return true;
      if (filter === 'New') return c.status === 'new';
      if (filter === 'Updates') return c.status === 'update';
      if (filter === 'Unchanged') return c.status === 'unchanged';
      if (filter === 'Needs Attention') return ['conflict', 'unmapped'].includes(c.status) || c.weaponReconciliation?.status === 'equipment-mismatch' || Object.values(c.changes || {}).some(x => x && x.direction === 'local-ahead');
      return true;
    });
  }, [reconciliationResult, activeTraveler, filter]);

  const renderCharacterCard = (char, isTravelerCard = false) => (
    <div key={char.hoyolabId} className={`bg-[var(--surface)] border ${selectedChars[char.hoyolabId] ? 'border-cyan-500/50' : 'border-[var(--border)]'} rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center transition-colors`}>
      {/* Checkbox */}
      {char.status !== 'unmapped' && char.status !== 'ignored' && (!isTravelerCard || isCharacterActionable(char)) && (
        <label className="flex items-center gap-3 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={!!selectedChars[char.hoyolabId]}
            onChange={() => toggleCharSelection(char.hoyolabId)}
            className="w-5 h-5 rounded border-[var(--border)] bg-[var(--bg)] checked:bg-cyan-500"
          />
        </label>
      )}

      {/* Char Info */}
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-lg text-[var(--text)]">{char.rosterKey || char.hoyolab.name}</span>
          {renderBadge(char.status)}
        </div>

        {char.status === 'unmapped' ? (
          <div className="text-orange-400 text-xs">Not yet supported by Toolkit data (ID: {char.hoyolabId})</div>
        ) : char.status === 'ignored' ? (
          <div className="text-[var(--muted)] text-xs">Excluded from planning sync</div>
        ) : !isTravelerCard ? (
          <div className="text-[var(--muted)] text-xs">
            C{char.hoyolab.constellation} • Friendship {char.hoyolab.friendship}
          </div>
        ) : null}
      </div>

      {/* Diff Area */}
      {char.status !== 'unmapped' && char.status !== 'ignored' && (
        <div className="flex-[2] grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm w-full md:w-auto">

          {/* Level & Asc */}
          <div className="text-[var(--muted)] pt-1">Level</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-mono">
              {char.status === 'new' ? (
                <span className="text-cyan-400">Lv {char.hoyolab.level} A{char.hoyolab.ascension || 0}</span>
              ) : (
                <>
                  <span>Lv {char.local?.level} A{char.local?.ascension}</span>
                  {(char.changes?.level || char.changes?.ascension) && (
                    <>
                      <span className="text-[var(--muted)]">→</span>
                      <span className={(char.changes?.level?.direction === 'local-ahead' || char.changes?.ascension?.direction === 'local-ahead') ? 'text-yellow-400' : 'text-cyan-400'}>
                        Lv {char.hoyolab.level} A{char.hoyolab.ascension || 0}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {((char.changes?.level?.direction === 'local-ahead' || char.changes?.ascension?.direction === 'local-ahead')) && (
              <div className="flex items-center gap-2 mt-1 bg-yellow-500/10 p-2 rounded text-xs border border-yellow-500/20">
                <span className="text-yellow-400">Toolkit is ahead.</span>
                <button
                  onClick={() => toggleLocalAheadOverride(char.hoyolabId, 'level')}
                  className="px-2 py-1 bg-[var(--surface)] hover:bg-[var(--border)] rounded text-[var(--text)] ml-auto"
                >
                  {localAheadOverrides[char.hoyolabId]?.level ? 'Using HoYoLAB' : 'Keep Toolkit'}
                </button>
              </div>
            )}
          </div>

          {/* Talents */}
          <div className="text-[var(--muted)] pt-1">Talents</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-mono">
              {char.status === 'new' ? (
                <span className="text-cyan-400">
                  {char.hoyolab.talents?.normal || 1} / {char.hoyolab.talents?.skill || 1} / {char.hoyolab.talents?.burst || 1}
                </span>
              ) : (
                <>
                  <span>{char.local?.talents?.normal} / {char.local?.talents?.skill} / {char.local?.talents?.burst}</span>
                  {char.changes?.talents && (
                    <>
                      <span className="text-[var(--muted)]">→</span>
                      <span className={Object.values(char.changes.talents).some(t => t.direction === 'local-ahead') ? 'text-yellow-400' : 'text-cyan-400'}>
                        {char.hoyolab.talents?.normal || 1} / {char.hoyolab.talents?.skill || 1} / {char.hoyolab.talents?.burst || 1}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {(char.changes?.talents && Object.values(char.changes.talents).some(t => t.direction === 'local-ahead')) && (
              <div className="flex items-center gap-2 mt-1 bg-yellow-500/10 p-2 rounded text-xs border border-yellow-500/20">
                <span className="text-yellow-400">Toolkit talents ahead.</span>
                <button
                  onClick={() => toggleLocalAheadOverride(char.hoyolabId, 'skill')}
                  className="px-2 py-1 bg-[var(--surface)] hover:bg-[var(--border)] rounded text-[var(--text)] ml-auto"
                >
                  {localAheadOverrides[char.hoyolabId]?.skill ? 'Using HoYoLAB' : 'Keep Toolkit'}
                </button>
              </div>
            )}
          </div>

          {/* Weapon */}
          <div className="text-[var(--muted)] pt-1">Weapon</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {char.weaponReconciliation?.status === 'unmapped' ? (
                <span className="text-orange-400">Unmapped ({char.weaponReconciliation?.hoyolab?.id})</span>
              ) : char.weaponReconciliation?.status === 'would-create' || char.status === 'new' ? (
                <span className="text-cyan-400">
                  {char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level} R{char.hoyolab.weapon?.refinement || 1}
                </span>
              ) : char.weaponReconciliation?.status === 'equipment-mismatch' ? (
                <div className="flex flex-col">
                  <span className="text-[var(--text)] line-through opacity-70">
                    {trackedWeaponsMap[char.weaponReconciliation.equippedInstanceId]?.weaponName || 'Unknown'}
                  </span>
                  <span className="text-yellow-400">{char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level}</span>
                </div>
              ) : char.weaponReconciliation?.status === 'ambiguous' ? (
                <span className="text-yellow-400">
                  {char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level} (Ambiguous)
                </span>
              ) : char.weaponReconciliation?.status === 'suggested-instance' ? (
                <span className="text-blue-400">
                  {char.weaponReconciliation?.weaponName} (Suggest unassigned)
                </span>
              ) : char.weaponReconciliation?.status === 'matched-instance' ? (
                <span className={Object.keys(char.weaponReconciliation?.changes || {}).length > 0 ? "text-cyan-400" : "text-[var(--text)]"}>
                  {char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level} R{char.hoyolab.weapon?.refinement || 1}
                </span>
              ) : null}
            </div>

            {/* Weapon Action Resolver */}
            {selectedChars[char.hoyolabId] && ['ambiguous', 'suggested-instance', 'equipment-mismatch'].includes(char.weaponReconciliation?.status) && (
              <div className="flex flex-col gap-2 mt-2 bg-[var(--surface-light)] p-3 rounded border border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">Resolve Weapon Assignment:</span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name={`w_${char.hoyolabId}`} checked={weaponChoices[char.hoyolabId] === 'ignore' || !weaponChoices[char.hoyolabId]} onChange={() => handleWeaponChoice(char.hoyolabId, 'ignore')} />
                    <span className="text-[var(--muted)]">Leave Unchanged</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name={`w_${char.hoyolabId}`} checked={weaponChoices[char.hoyolabId] === 'create'} onChange={() => handleWeaponChoice(char.hoyolabId, 'create')} />
                    <span className="text-cyan-400">Create New Tracked Instance</span>
                  </label>
                  {char.weaponReconciliation?.candidates?.map(cand => {
                    const rLvl = char.hoyolab.weapon?.level ?? 1;
                    const rRef = char.hoyolab.weapon?.refinement ?? 1;
                    const showsUpgrade = (cand.level < rLvl || cand.currentRefinement < rRef);
                    return (
                      <label key={cand.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input type="radio" className="mt-1" name={`w_${char.hoyolabId}`} checked={weaponChoices[char.hoyolabId] === `assign|${cand.id}`} onChange={() => handleWeaponChoice(char.hoyolabId, `assign|${cand.id}`)} />
                        <div className="flex flex-col">
                          <span className="text-blue-400">
                            Use existing: Lv {cand.level} R{cand.currentRefinement} {showsUpgrade ? `→ Lv ${rLvl} R${rRef}` : ''} {cand.assignedTo ? `(Assigned: ${cand.assignedTo})` : '(Unassigned)'}
                          </span>
                          {showsUpgrade && weaponChoices[char.hoyolabId] === `assign|${cand.id}` && (
                            <span className="text-xs text-blue-300/70 mt-0.5">Current stats will be synced to HoYoLAB</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );

  const selectedCharCount = Object.keys(selectedChars).filter(id => {
    if (!selectedChars[id]) return false;
    const char = reconciliationResult?.characters.find(c => c.hoyolabId === id);
    if (char?.rosterKey?.startsWith('Traveler ') && !isCharacterActionable(char)) return false;
    return true;
  }).length;
  const selectedTravelerCount = Object.values(selectedDerivedTravelers).filter(Boolean).length;
  const hasSelections = selectedCharCount > 0 || selectedTravelerCount > 0;
  const totalSelectedCount = selectedCharCount + selectedTravelerCount;

  const { canApply, applyBlockReason } = useMemo(() => {
    if (!reconciliationResult || !hasSelections) return { canApply: false, applyBlockReason: 'No characters selected.' };

    let hasUnresolvedAmbiguity = false;
    let hasInvalidConflict = false;

    Object.keys(selectedChars).forEach(hoyolabId => {
      if (!selectedChars[hoyolabId]) return;

      const c = reconciliationResult.characters.find(rc => rc.hoyolabId == hoyolabId);
      if (!c) return;

      const weaponChoice = weaponChoices[hoyolabId];
      if (c.status === 'conflict') hasInvalidConflict = true;
      if (c.weaponReconciliation?.status === 'ambiguous' && !weaponChoice) hasUnresolvedAmbiguity = true;
      if (c.weaponReconciliation?.status === 'equipment-mismatch' && !weaponChoice) hasUnresolvedAmbiguity = true;
    });

    if (hasInvalidConflict) return { canApply: false, applyBlockReason: 'Please deselect conflicting characters.' };
    if (hasUnresolvedAmbiguity) return { canApply: false, applyBlockReason: 'Please resolve weapon ambiguities.' };
    return { canApply: true, applyBlockReason: '' };
  }, [reconciliationResult, hasSelections, selectedChars, weaponChoices]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            Sync Characters from HoYoLAB
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors p-1">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--muted)]">Fetching and mapping characters...</p>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <span className="text-4xl block mb-2">⚠️</span>
                <h3 className="text-red-400 font-bold mb-2">Sync Failed</h3>
                <p className="text-red-300/80 text-sm">{error}</p>
                <button onClick={fetchSyncPreview} className="mt-4 px-4 py-2 bg-[var(--surface-light)] rounded-lg text-sm hover:bg-[var(--border)] transition-colors">
                  Retry
                </button>
              </div>
            </div>
          ) : applyResult ? (
            <div className="p-10 flex flex-col items-center justify-center">
              <span className="text-5xl mb-4">✅</span>
              <h2 className="text-2xl font-bold text-green-400 mb-6">Sync Complete</h2>
              <div className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)] w-full max-w-sm">
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--muted)]">Characters Added</span>
                  <span className="font-bold text-[var(--text)]">{applyResult.charactersAdded}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--muted)]">Characters Updated</span>
                  <span className="font-bold text-[var(--text)]">{applyResult.charactersUpdated}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--muted)]">Weapons Created</span>
                  <span className="font-bold text-[var(--text)]">{applyResult.weaponsCreated}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[var(--muted)]">Existing Weapons Updated/Reassigned</span>
                  <span className="font-bold text-[var(--text)]">{applyResult.weaponsUpdatedOrReassigned}</span>
                </div>
                {applyResult.travelerVariantsAdded > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--muted)]">Traveler Variants Added</span>
                    <span className="font-bold text-[var(--text)]">{applyResult.travelerVariantsAdded}</span>
                  </div>
                )}

              </div>
              <button onClick={onClose} className="mt-8 px-6 py-2 bg-[var(--gold)] text-[var(--bg)] font-bold rounded-xl shadow-lg hover:scale-105 transition-transform">
                Review Updated State
              </button>
            </div>
          ) : reconciliationResult ? (
            <div className="flex flex-col h-full">
              {/* Summary */}
              <div className="p-4 bg-[var(--surface-light)] border-b border-[var(--border)]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-[var(--text)]">{reconciliationResult.summary.totalRemote}</div>
                    <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Found</div>
                    {reconciliationResult.summary.ignored > 0 && (
                      <div className="text-[var(--muted)] text-[10px] mt-1 opacity-80">{reconciliationResult.summary.syncRelevant} syncable • {reconciliationResult.summary.ignored} ignored</div>
                    )}
                  </div>
                  <div className="bg-[var(--surface)] border border-green-500/20 p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-green-400">{reconciliationResult.summary.newCharacters}</div>
                    <div className="text-[var(--muted)] text-xs uppercase tracking-wide">New</div>
                  </div>
                  <div className="bg-[var(--surface)] border border-blue-500/20 p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-blue-400">{reconciliationResult.summary.charactersWithUpdates}</div>
                    <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Updates</div>
                  </div>
                  <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-[var(--text)]">{reconciliationResult.summary.unchangedCharacters}</div>
                    <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Up to date</div>
                  </div>
                </div>
              </div>

              {/* Traveler Section */}
              {activeTraveler && (
                <div className="mx-6 mt-4 p-4 bg-[var(--surface-light)] border border-[var(--border)] rounded-xl relative overflow-hidden">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-[var(--text)] text-lg flex items-center gap-2">
                        Traveler
                      </h3>
                    </div>

                    {/* Active Traveler Card */}
                    {renderCharacterCard(activeTraveler, true)}

                    {/* Traveler Variants */}
                    <div className="mt-2 pt-4 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-bold text-[var(--text)] text-sm">Variants</h4>
                        <span className="group relative cursor-help text-[var(--muted)] text-sm">
                          ⓘ
                          <span className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50 text-left">
                            Why? Inactive Traveler talent progression is not exposed by HoYoLAB.
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center mb-3">
                        {travelerVariants.map(tv => {
                          const isMissing = tv.status === 'missing';
                          const isActive = tv.status === 'active';
                          const isExists = tv.status === 'exists';
                          const isSelected = !!selectedDerivedTravelers[tv.element];

                          let btnClass = "px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors border ";

                          if (isActive) {
                            btnClass += "bg-[var(--surface-light)] border-[var(--border)] text-[var(--text)] opacity-60 cursor-not-allowed";
                          } else if (isExists) {
                            btnClass += "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] opacity-60 cursor-not-allowed";
                          } else if (isSelected) {
                            btnClass += "bg-cyan-500/20 border-cyan-500 text-cyan-400 cursor-pointer hover:bg-cyan-500/30";
                          } else {
                            btnClass += "bg-[var(--surface)] border-[var(--border)] text-[var(--text)] cursor-pointer hover:border-cyan-500/50 hover:text-cyan-400";
                          }

                          return (
                            <button
                              key={tv.element}
                              disabled={!isMissing}
                              onClick={() => isMissing && toggleTravelerSelection(tv.element)}
                              className={btnClass}
                            >
                              <img src={getElementIcon(tv.element)} alt={tv.element} className="w-4 h-4 object-contain" />
                              <span>{tv.element}</span>
                              {isActive && <span className="text-xs ml-1 font-normal opacity-80">• Active</span>}
                              {isExists && <span className="text-xs ml-1 font-normal opacity-80">• Exists</span>}
                              {isSelected && <span className="text-xs ml-1 font-normal opacity-80">• Add</span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mt-4">
                        <p className="text-xs text-[var(--muted)] max-w-xl leading-relaxed">
                          HoYoLAB only exposes real talent progression for the active Traveler element. Other variants share your level/ascension and start at 1/1/1 talents.
                        </p>
                        {travelerVariants.some(tv => tv.status === 'missing') && (
                          <button
                            onClick={handleSelectAllTravelers}
                            className="px-4 py-2 text-xs font-bold bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--border)] hover:text-[var(--text)] rounded-lg text-[var(--muted)] shrink-0 transition-colors"
                          >
                            Select All Missing
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Controls */}

              {Object.keys(roster).length === 0 && reconciliationResult.summary.syncRelevant > 0 && (
                <div className="mx-6 mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="font-bold text-cyan-400">Welcome to Traveler's Toolkit</h3>
                    <p className="text-sm text-[var(--muted)]">Import your current HoYoLAB roster into Traveler's Toolkit. Planner targets will remain editable after import.</p>
                  </div>
                </div>
              )}

              <div className="px-6 py-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg)] sticky top-0 z-10 mt-2">
                <div className="flex gap-2 overflow-x-auto">
                  {['All', 'New', 'Updates', 'Unchanged', 'Needs Attention'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${filter === f ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={handleSelectAllSafe} className="px-3 py-1.5 text-sm font-bold bg-[var(--surface)] hover:bg-[var(--border)] rounded text-cyan-400">
                    Select All Safe
                  </button>
                  <button onClick={handleClearAll} className="px-3 py-1.5 text-sm font-bold bg-[var(--surface)] hover:bg-[var(--border)] rounded text-[var(--muted)]">
                    Clear All
                  </button>
                </div>
              </div>

              {/* Rows */}
              <div className="p-4 md:p-6 space-y-3">
                {filteredChars.map((char) => renderCharacterCard(char))}
                {filteredChars.length === 0 && (
                  <div className="text-center py-10 text-[var(--muted)] italic">
                    No characters match this filter.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!applyResult && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex justify-between items-center z-10">
            <button onClick={onClose} className="px-5 py-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors font-bold text-sm">
              Cancel
            </button>
            <button
              onClick={prepareApply}
              disabled={!canApply}
              title={applyBlockReason}
              className={`px-5 py-2 rounded-xl font-bold text-sm shadow-lg transition-all ${canApply ? 'bg-[var(--gold)] text-[var(--bg)] hover:scale-105' : 'bg-[var(--surface-light)] text-[var(--muted)] opacity-50 cursor-not-allowed'}`}
            >
              Apply Selected ({totalSelectedCount})
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-sm flex flex-col shadow-2xl p-6">
            <h3 className="text-xl font-bold mb-4">Apply HoYoLAB Sync?</h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Characters to Add</span><span className="font-bold text-green-400">{planSummary.newCount}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Characters to Update</span><span className="font-bold text-blue-400">{planSummary.updateCount}</span></div>
              {planSummary.travelerVariantsCount > 0 && (
                <div className="flex justify-between"><span className="text-[var(--muted)]">Traveler Variants to Add</span><span className="font-bold text-purple-400">{planSummary.travelerVariantsCount}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[var(--muted)]">Weapons to Create</span><span className="font-bold text-cyan-400">{planSummary.weaponCreatedCount}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Existing Weapons to Reassign/Update</span><span className="font-bold text-[var(--text)]">{planSummary.weaponUpdatedCount}</span></div>
              <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-blue-300 text-xs border border-blue-500/20">


                Planner targets will be safely preserved.
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 text-[var(--muted)] hover:text-[var(--text)] text-sm font-bold">
                Cancel
              </button>
              <button onClick={confirmApply} className="px-4 py-2 bg-green-500 text-black font-bold rounded-xl text-sm hover:bg-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                Apply Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
