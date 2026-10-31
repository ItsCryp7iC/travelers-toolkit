import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import { reconcileCharacters, getSafeWeaponCycles } from '../utils/hoyolabCharacterReconciliation';
import { buildHoyolabApplyPlan } from '../utils/hoyolabSyncApply';
import { getElementIcon } from '../utils/assetHelper';
import HoyolabCharacterCard from './hoyolabSync/HoyolabCharacterCard';
import HoyolabSyncSummary from './hoyolabSync/HoyolabSyncSummary';
import notify from '../utils/notify';
import { acquireBodyScrollLock } from '../utils/scrollLock';

export const isCharacterActionable = (char) => {
  if (!char) return false;
  if (['new', 'update'].includes(char.status)) return true;
  if (Object.values(char.changes || {}).some(x => x && x.direction === 'local-ahead')) return true;

  const wStatus = char.weaponReconciliation?.status;
  if (['would-create', 'existing-tracked-match', 'suggested-instance', 'ambiguous', 'ambiguous-existing-match', 'equipment-mismatch'].includes(wStatus)) return true;
  if (wStatus === 'matched-instance' && char.weaponReconciliation?.changes && Object.keys(char.weaponReconciliation.changes).length > 0) return true;

  return false;
};

export default function HoyolabSyncPreviewModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // UI Selections State
  const [selectedChars, setSelectedChars] = useState({});
  const [weaponChoices, setWeaponChoices] = useState({});
  const [localAheadOverrides, setLocalAheadOverrides] = useState({});
  const [selectedDerivedTravelers, setSelectedDerivedTravelers] = useState({});
  // Apply State

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [planSummary, setPlanSummary] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const isApplyingRef = useRef(false);

  const roster = useStore(s => s.roster) || {};
  const trackedWeapons = useStore(s => s.trackedWeapons) || [];
  const applyHoyolabSync = useStore(s => s.applyHoyolabSync);

  useEffect(() => {
    if (isOpen) {
      fetchSyncPreview();
    } else {
      setReconciliationResult(null);
      setError(null);
      setFilter('All');
      setSearchQuery('');
      setSelectedChars({});
      setWeaponChoices({});
      setLocalAheadOverrides({});
      setSelectedDerivedTravelers({});
      setShowConfirmation(false);
      setApplyResult(null);
      setIsApplying(false);
      isApplyingRef.current = false;
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

  // Lock body scroll while modal or confirmation is open, restoring previous overflow state
  useEffect(() => {
    if (!isOpen) return;
    return acquireBodyScrollLock();
  }, [isOpen]);

  useEffect(() => {
    if (!showConfirmation) return;
    return acquireBodyScrollLock();
  }, [showConfirmation]);

  const fetchSyncPreview = async () => {
    setLoading(true);
    setError(null);
    setReconciliationResult(null);
    setSearchQuery('');
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
      const safeCycles = getSafeWeaponCycles(result.characters);

      result.characters.forEach(c => {
        if (c.status === 'ignored' || c.status === 'unmapped' || c.status === 'conflict') return;

        // An equipment-mismatch or ambiguous weapon row requires user decision;
        // do not auto-select it.
        const wStatus = c.weaponReconciliation?.status;
        if (['equipment-mismatch', 'ambiguous', 'ambiguous-existing-match'].includes(wStatus)) return;

        // For existing-tracked-match assigned to another character, only auto-select if part of a safe cycle!
        if (wStatus === 'existing-tracked-match' || wStatus === 'suggested-instance') {
          const cand = c.weaponReconciliation?.candidateInstance || c.weaponReconciliation?.candidates?.[0];
          if (cand?.assignedTo && !safeCycles.has(c.rosterKey)) {
            return;
          }
        }

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
        if (c.weaponReconciliation && (c.weaponReconciliation.status === 'existing-tracked-match' || c.weaponReconciliation.status === 'suggested-instance')) hasWeaponChange = true;
        if (c.weaponReconciliation && c.weaponReconciliation.status === 'matched-instance' && (c.weaponReconciliation.hasWeaponUpdate || Object.keys(c.weaponReconciliation.changes || {}).length > 0)) hasWeaponChange = true;

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

  const charactersByHoyolabId = useMemo(() => {
    const map = new Map();
    if (reconciliationResult?.characters) {
      reconciliationResult.characters.forEach(c => {
        map.set(String(c.hoyolabId), c);
        map.set(Number(c.hoyolabId), c);
      });
    }
    return map;
  }, [reconciliationResult]);

  const handleSelectAllSafe = () => {
    if (!reconciliationResult) return;
    const safeCycles = getSafeWeaponCycles(reconciliationResult.characters);
    const newSelected = {};
    reconciliationResult.characters.forEach(c => {
      if (c.rosterKey?.startsWith('Traveler ') && !isCharacterActionable(c)) return;
      if (['unmapped', 'conflict', 'ignored'].includes(c.status)) return;

      const wStatus = c.weaponReconciliation?.status;
      const wChoice = weaponChoices[c.hoyolabId];
      if (['equipment-mismatch', 'ambiguous', 'ambiguous-existing-match'].includes(wStatus) && !wChoice) {
        return;
      }

      if (wStatus === 'existing-tracked-match' || wStatus === 'suggested-instance') {
        const cand = c.weaponReconciliation?.candidateInstance || c.weaponReconciliation?.candidates?.[0];
        if (cand?.assignedTo && !safeCycles.has(c.rosterKey) && !wChoice) {
          return;
        }
      }

      if (['new', 'update', 'unchanged'].includes(c.status)) {
        newSelected[c.hoyolabId] = true;
      }
    });
    setSelectedChars(newSelected);
  };

  const handleClearAll = () => {
    setSelectedChars({});
  };

  const toggleCharSelection = useCallback((id) => {
    setSelectedChars(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

  const handleWeaponChoice = useCallback((id, choice) => {
    setWeaponChoices(prev => ({ ...prev, [id]: choice }));
  }, []);

  const toggleLocalAheadOverride = useCallback((id, fieldKey) => {
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
  }, []);

  const prepareApply = () => {
    if (!reconciliationResult) return;
    const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars, weaponChoices, localAheadOverrides, selectedDerivedTravelers });

    // Count for summary
    let newCount = 0;
    let updateCount = 0;
    let weaponCreatedCount = 0;
    let weaponUpdatedCount = 0;

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
    if (isApplyingRef.current) return;
    isApplyingRef.current = true;
    setIsApplying(true);
    try {
      const result = applyHoyolabSync(planSummary.plan);
      setApplyResult(result);
      setShowConfirmation(false);
    } catch (e) {
      notify.error("Failed to apply sync: " + e.message);
      setIsApplying(false);
      isApplyingRef.current = false;
      setShowConfirmation(false);
    }
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
    (trackedWeapons || []).forEach(w => {
      map[w.id] = w;
    });
    return map;
  }, [trackedWeapons]);

  const isTravelerVisible = useMemo(() => {
    if (!activeTraveler) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const activeName = (activeTraveler.rosterKey || '').toLowerCase();
    const activeElement = (activeTravelerElement || '').toLowerCase();
    const localWeapon = (trackedWeaponsMap?.[activeTraveler.local?.equippedWeaponId]?.weaponName || activeTraveler.weaponReconciliation?.equippedInstance?.weaponName || '').toLowerCase();
    const remoteWeapon = (activeTraveler.weaponReconciliation?.weaponName || activeTraveler.hoyolab?.weapon?.name || '').toLowerCase();

    if (
      activeName.includes(query) ||
      'traveler'.includes(query) ||
      activeElement.includes(query) ||
      localWeapon.includes(query) ||
      remoteWeapon.includes(query)
    ) {
      return true;
    }

    return travelerVariants.some(tv => tv.element.toLowerCase().includes(query));
  }, [activeTraveler, searchQuery, activeTravelerElement, trackedWeaponsMap, travelerVariants]);

  const filteredChars = useMemo(() => {
    if (!reconciliationResult) return [];
    const query = searchQuery.trim().toLowerCase();

    return reconciliationResult.characters.filter(c => {
      if (activeTraveler && c.hoyolabId === activeTraveler.hoyolabId) return false;
      if (filter === 'New' && c.status !== 'new') return false;
      if (filter === 'Updates' && c.status !== 'update') return false;
      if (filter === 'Unchanged' && c.status !== 'unchanged') return false;
      if (filter === 'Needs Attention') {
        const isNeedsAttention = ['conflict', 'unmapped'].includes(c.status) ||
          c.needsAttention ||
          c.weaponReconciliation?.status === 'equipment-mismatch' ||
          c.weaponReconciliation?.status === 'ambiguous' ||
          Object.values(c.changes || {}).some(x => x && x.direction === 'local-ahead');
        if (!isNeedsAttention) return false;
      }

      if (query) {
        const charName = (c.rosterKey || c.hoyolab?.name || '').toLowerCase();
        const localWeapon = (trackedWeaponsMap?.[c.local?.equippedWeaponId]?.weaponName || c.weaponReconciliation?.equippedInstance?.weaponName || '').toLowerCase();
        const remoteWeapon = (c.weaponReconciliation?.weaponName || c.hoyolab?.weapon?.name || '').toLowerCase();
        const element = (c.hoyolab?.element || '').toLowerCase();

        const matches = charName.includes(query) ||
          localWeapon.includes(query) ||
          remoteWeapon.includes(query) ||
          element.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [reconciliationResult, activeTraveler, filter, searchQuery, trackedWeaponsMap]);

  const selectedCharCount = useMemo(() => {
    return Object.keys(selectedChars).filter(id => {
      if (!selectedChars[id]) return false;
      const char = charactersByHoyolabId.get(id);
      if (char?.rosterKey?.startsWith('Traveler ') && !isCharacterActionable(char)) return false;
      return true;
    }).length;
  }, [selectedChars, charactersByHoyolabId]);

  const selectedTravelerCount = Object.values(selectedDerivedTravelers).filter(Boolean).length;
  const hasSelections = selectedCharCount > 0 || selectedTravelerCount > 0;
  const totalSelectedCount = selectedCharCount + selectedTravelerCount;

  const { canApply, applyBlockReason } = useMemo(() => {
    if (!reconciliationResult || !hasSelections) return { canApply: false, applyBlockReason: 'No characters selected.' };

    const conflicts = [];
    const unmapped = [];
    const weaponUnresolved = [];
    const assignedUnresolved = [];
    const weaponClaimants = new Map(); // uuid -> { weaponName, names: [] }

    // Safe cycles among selected characters only
    const safeCycleCharKeys = getSafeWeaponCycles(reconciliationResult.characters, (c) => !!selectedChars[c.hoyolabId]);

    Object.keys(selectedChars).forEach(hoyolabId => {
      if (!selectedChars[hoyolabId]) return;

      const c = charactersByHoyolabId.get(hoyolabId);
      if (!c) return;

      const name = c.rosterKey || c.hoyolab?.name || `ID:${hoyolabId}`;
      const wChoice = weaponChoices[hoyolabId];
      const wRecon = c.weaponReconciliation;
      const wStatus = wRecon?.status;

      if (c.status === 'conflict') conflicts.push(name);
      if (c.status === 'unmapped') unmapped.push(name);

      if (['ambiguous', 'ambiguous-existing-match'].includes(wStatus) && !wChoice) {
        weaponUnresolved.push({ name, type: 'ambiguous' });
      } else if (wStatus === 'equipment-mismatch' && !wChoice) {
        weaponUnresolved.push({ name, type: 'mismatch' });
      } else if (['existing-tracked-match', 'suggested-instance'].includes(wStatus)) {
        const cand = wRecon?.candidateInstance || wRecon?.candidates?.[0];
        const isAssigned = !!cand?.assignedTo;
        const isSafeCycle = isAssigned && safeCycleCharKeys.has(c.rosterKey);

        if (isAssigned && !isSafeCycle && (!wChoice || wChoice === '')) {
          assignedUnresolved.push({
            name,
            weaponName: cand?.weaponName || wRecon?.weaponName,
            assignedTo: cand?.assignedTo
          });
        }
      }

      // Track weapon instance assignments to detect duplicate assignments
      if (wChoice && wChoice.startsWith('assign|')) {
        const uuid = wChoice.split('|')[1];
        const weaponName = wRecon?.weaponName || 'Tracked weapon';
        if (!weaponClaimants.has(uuid)) {
          weaponClaimants.set(uuid, { weaponName, names: [] });
        }
        weaponClaimants.get(uuid).names.push(name);
      } else if (!wChoice && ['existing-tracked-match', 'suggested-instance'].includes(wStatus)) {
        const cand = wRecon?.candidateInstance || wRecon?.candidates?.[0];
        const isAssigned = !!cand?.assignedTo;
        const isSafeCycle = isAssigned && safeCycleCharKeys.has(c.rosterKey);
        if (!isAssigned || isSafeCycle) {
          const uuid = cand?.id;
          if (uuid) {
            const weaponName = cand?.weaponName || wRecon?.weaponName || 'Tracked weapon';
            if (!weaponClaimants.has(uuid)) {
              weaponClaimants.set(uuid, { weaponName, names: [] });
            }
            weaponClaimants.get(uuid).names.push(name);
          }
        }
      } else if ((!wChoice || wChoice === 'update-existing') && wStatus === 'matched-instance') {
        const uuid = wRecon?.equippedInstanceId;
        if (uuid) {
          const weaponName = wRecon?.weaponName || 'Tracked weapon';
          if (!weaponClaimants.has(uuid)) {
            weaponClaimants.set(uuid, { weaponName, names: [] });
          }
          weaponClaimants.get(uuid).names.push(name);
        }
      }
    });

    if (conflicts.length > 0) {
      return { canApply: false, applyBlockReason: `Conflict in: ${conflicts.join(', ')}. Please deselect conflicting characters.` };
    }
    if (unmapped.length > 0) {
      return { canApply: false, applyBlockReason: `Cannot apply unmapped character: ${unmapped.join(', ')}.` };
    }
    if (weaponUnresolved.length > 0) {
      const hasAmbiguous = weaponUnresolved.some(u => u.type === 'ambiguous');
      const prefix = hasAmbiguous ? 'Please resolve weapon ambiguities' : 'Please resolve weapon assignment';
      return { canApply: false, applyBlockReason: `${prefix} for: ${weaponUnresolved.map(u => u.name).join(', ')}.` };
    }
    if (assignedUnresolved.length > 0) {
      const first = assignedUnresolved[0];
      return {
        canApply: false,
        applyBlockReason: `${first.weaponName} is currently assigned to ${first.assignedTo}. Resolve the assignment before applying.`
      };
    }

    // Validate uniqueness: no 2 characters claim the same weapon instance
    for (const [, { weaponName, names }] of weaponClaimants.entries()) {
      if (names.length > 1) {
        return {
          canApply: false,
          applyBlockReason: `Weapon assignment conflict: ${weaponName} is selected for both ${names.join(' and ')}.`
        };
      }
    }

    return { canApply: true, applyBlockReason: '' };
  }, [reconciliationResult, hasSelections, selectedChars, weaponChoices, charactersByHoyolabId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !applyResult) {
          if (showConfirmation) setShowConfirmation(false);
          else onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoyolab-sync-modal-title"
        className="bg-[var(--bg)] border-0 sm:border border-[var(--border)] rounded-none sm:rounded-2xl w-full max-w-5xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          <h2 id="hoyolab-sync-modal-title" className="text-base sm:text-xl font-bold text-[var(--text)] flex items-center gap-2 truncate">
            Sync Characters from HoYoLAB
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-light)] transition-colors shrink-0"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg)] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--muted)]">Fetching and mapping characters...</p>
            </div>
          ) : error ? (
            <div className="p-4 sm:p-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 sm:p-6 text-center">
                <span className="text-4xl block mb-2">⚠️</span>
                <h3 className="text-red-400 font-bold mb-2">Sync Failed</h3>
                <p className="text-red-300/80 text-sm break-words">{error}</p>
                <button
                  type="button"
                  onClick={fetchSyncPreview}
                  className="mt-4 px-4 py-2 bg-[var(--surface-light)] rounded-lg text-sm hover:bg-[var(--border)] transition-colors min-h-[40px]"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : applyResult ? (
            <div className="p-6 sm:p-10 flex flex-col items-center justify-center text-center">
              <span className="text-5xl mb-4">✅</span>
              <h2 className="text-2xl font-bold text-green-400 mb-6">Sync Complete</h2>
              <div className="bg-[var(--surface)] p-4 sm:p-6 rounded-xl border border-[var(--border)] w-full max-w-sm">
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
                  <div className="flex justify-between py-2 border-t border-[var(--border)]">
                    <span className="text-[var(--muted)]">Traveler Variants Added</span>
                    <span className="font-bold text-[var(--text)]">{applyResult.travelerVariantsAdded}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 sm:mt-8 px-6 py-2.5 bg-[var(--gold)] text-[var(--bg)] font-bold rounded-xl shadow-lg hover:scale-105 transition-transform min-h-[44px] w-full sm:w-auto"
              >
                Review Updated State
              </button>
            </div>
          ) : reconciliationResult ? (
            <div className="flex flex-col h-full">
              {/* Summary */}
              <HoyolabSyncSummary summary={reconciliationResult.summary} />

              {/* Traveler Section */}
              {activeTraveler && isTravelerVisible && (
                <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 p-3 sm:p-4 bg-[var(--surface-light)] border border-[var(--border)] rounded-xl relative overflow-hidden">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-[var(--text)] text-lg flex items-center gap-2">
                        Traveler
                      </h3>
                    </div>

                    {/* Active Traveler Card */}
                    <HoyolabCharacterCard
                      char={activeTraveler}
                      isTravelerCard={true}
                      isSelected={selectedChars[activeTraveler.hoyolabId]}
                      onToggleSelect={toggleCharSelection}
                      isActionable={isCharacterActionable(activeTraveler)}
                      localAheadOverrides={localAheadOverrides}
                      onToggleLocalAheadOverride={toggleLocalAheadOverride}
                      weaponChoice={weaponChoices[activeTraveler.hoyolabId]}
                      onWeaponChoice={handleWeaponChoice}
                      trackedWeaponsMap={trackedWeaponsMap}
                    />

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
                <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 p-3 sm:p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="font-bold text-cyan-400">Welcome to Traveler's Toolkit</h3>
                    <p className="text-sm text-[var(--muted)]">Import your current HoYoLAB roster into Traveler's Toolkit. Planner targets will remain editable after import.</p>
                  </div>
                </div>
              )}

              {/* Sticky Search & Filter Toolbar */}
              <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-10 flex flex-col gap-2.5 shrink-0">
                {/* ROW 1: Search + Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full">
                  <div className="relative flex-1 min-w-0">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search characters or weapons..."
                      aria-label="Search characters or weapons"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-9 pr-8 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors min-h-[40px]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] text-xs p-1 rounded-md"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllSafe}
                      className="flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-[var(--surface)] hover:bg-[var(--border)] rounded-xl text-cyan-400 transition-colors min-h-[40px] text-center"
                    >
                      Select All Safe
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-[var(--surface)] hover:bg-[var(--border)] rounded-xl text-[var(--muted)] hover:text-[var(--text)] transition-colors min-h-[40px] text-center"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* ROW 2: Filter Chips */}
                <div className="flex items-center gap-1.5 sm:gap-2 pt-0.5 overflow-x-auto no-scrollbar pb-0.5">
                  {['All', 'New', 'Updates', 'Unchanged', 'Needs Attention'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap shrink-0 transition-colors ${filter === f ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div className="p-3 sm:p-4 md:p-6 space-y-3">
                {filteredChars.map((char) => (
                  <HoyolabCharacterCard
                    key={char.hoyolabId}
                    char={char}
                    isTravelerCard={false}
                    isSelected={selectedChars[char.hoyolabId]}
                    onToggleSelect={toggleCharSelection}
                    isActionable={isCharacterActionable(char)}
                    localAheadOverrides={localAheadOverrides}
                    onToggleLocalAheadOverride={toggleLocalAheadOverride}
                    weaponChoice={weaponChoices[char.hoyolabId]}
                    onWeaponChoice={handleWeaponChoice}
                    trackedWeaponsMap={trackedWeaponsMap}
                  />
                ))}
                {filteredChars.length === 0 && (
                  <div className="text-center py-10 text-[var(--muted)] italic">
                    {searchQuery.trim() ? "No matching characters or weapons." : "No characters match this filter."}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!applyResult && (
          <div className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 z-10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="order-2 sm:order-1 px-4 py-2.5 text-[var(--muted)] hover:text-[var(--text)] transition-colors font-bold text-sm min-h-[44px] sm:min-h-0 text-center rounded-xl hover:bg-[var(--surface-light)] sm:hover:bg-transparent"
            >
              Cancel
            </button>
            <div className="order-1 sm:order-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              {!canApply && applyBlockReason && (
                <span className="text-xs text-amber-400 font-medium text-center sm:text-right max-w-md break-words">
                  {applyBlockReason}
                </span>
              )}
              <button
                type="button"
                onClick={prepareApply}
                disabled={!canApply}
                title={applyBlockReason}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all min-h-[44px] flex items-center justify-center text-center ${canApply ? 'bg-[var(--gold)] text-[var(--bg)] hover:scale-105' : 'bg-[var(--surface-light)] text-[var(--muted)] opacity-50 cursor-not-allowed'}`}
              >
                Apply Selected ({totalSelectedCount})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowConfirmation(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-confirm-title"
            className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-sm flex flex-col shadow-2xl p-4 sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <h3 id="sync-confirm-title" className="text-lg sm:text-xl font-bold mb-4 text-[var(--text)] break-words">
              Apply HoYoLAB Sync?
            </h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Characters to Add</span><span className="font-bold text-green-400">{planSummary.newCount}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Characters to Update</span><span className="font-bold text-blue-400">{planSummary.updateCount}</span></div>
              {planSummary.travelerVariantsCount > 0 && (
                <div className="flex justify-between"><span className="text-[var(--muted)]">Traveler Variants to Add</span><span className="font-bold text-purple-400">{planSummary.travelerVariantsCount}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[var(--muted)]">Weapons to Create</span><span className="font-bold text-cyan-400">{planSummary.weaponCreatedCount}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Existing Weapons to Reassign/Update</span><span className="font-bold text-[var(--text)]">{planSummary.weaponUpdatedCount}</span></div>
              <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-blue-300 text-xs border border-blue-500/20 break-words">
                Planner targets will be safely preserved.
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2.5 text-[var(--muted)] hover:text-[var(--text)] text-sm font-bold min-h-[44px] sm:min-h-0 text-center rounded-xl hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApply}
                disabled={isApplying}
                className="px-5 py-2.5 bg-green-500 text-black font-bold rounded-xl text-sm hover:bg-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)] min-h-[44px] flex items-center justify-center text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? 'Applying...' : 'Apply Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
