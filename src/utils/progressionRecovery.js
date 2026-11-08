/**
 * src/utils/progressionRecovery.js
 *
 * Controlled Legacy Progression Recovery Utilities (Phase C2B.2B.2).
 * Provides backup snapshot creation, compatibility validation, repair candidate generation,
 * batch pre-validation, stale preview detection, and atomic repair transactions with rollback.
 */

import { getBackupPayload } from './backupPayload';
import { normalizeBackupForImport } from './backupUtils';
import {
  validateLevelAscension,
  validateProgressionOrdering,
  getValidCharacterAscensions,
  getValidWeaponAscensions,
  getCharacterLevelRangeForAscension,
  getWeaponLevelRangeForAscension,
  isCharacterMilestone,
  isWeaponMilestone,
} from './progressionContracts';
import { recalculateCharacterCosts, syncTravelerAscension } from '../store/helpers/rosterHelpers';
import { calculateWeaponCost } from './calculator';
import { STORE_NAME } from '../store/persistence';
import defaultWeaponsData from '../data/weapons.json';

/**
 * Captures a complete backup snapshot of the current application state and validates
 * its round-trip compatibility against the application's normalizeBackupForImport contract.
 *
 * @param {object} state - Zustand store state (or mock store state)
 * @returns {{ isValid: boolean, payload: object|null, jsonString: string|null, error: string|null }}
 */
export function createPreRepairBackup(state) {
  try {
    if (!state || typeof state !== 'object') {
      return {
        isValid: false,
        payload: null,
        jsonString: null,
        error: 'Cannot create backup: store state is missing or invalid.',
      };
    }

    const payload = getBackupPayload(state);

    // Validate structure against the authoritative backup importer
    const normalized = normalizeBackupForImport(payload);
    if (!normalized || typeof normalized !== 'object') {
      return {
        isValid: false,
        payload: null,
        jsonString: null,
        error: 'Pre-repair backup validation failed: normalization produced empty data.',
      };
    }

    const jsonString = JSON.stringify(payload, null, 2);
    return {
      isValid: true,
      payload,
      jsonString,
      createdAt: payload.createdAt,
      schemaVersion: payload.schemaVersion,
      appId: payload.app,
      error: null,
    };
  } catch (err) {
    return {
      isValid: false,
      payload: null,
      jsonString: null,
      error: err?.message || 'Failed to generate and validate pre-repair backup.',
    };
  }
}

/**
 * Validates that an existing backup payload is compatible with the restore contract.
 *
 * @param {object} backupPayload
 * @returns {{ isValid: boolean, error: string|null }}
 */
export function validateBackupCompatibility(backupPayload) {
  try {
    if (!backupPayload || typeof backupPayload !== 'object') {
      return { isValid: false, error: 'Backup payload is missing or not an object.' };
    }
    const normalized = normalizeBackupForImport(backupPayload);
    return {
      isValid: Boolean(normalized && typeof normalized === 'object'),
      error: null,
    };
  } catch (err) {
    return {
      isValid: false,
      error: err?.message || 'Backup compatibility validation failed.',
    };
  }
}

/**
 * Generates valid progression correction candidates for an invalid record.
 * Handles both unambiguous recommendations and ambiguous milestone options.
 *
 * @param {object} record - Diagnosed invalid record from diagnoseProgressionState
 * @param {Array} weaponsData - Weapon catalog data
 * @returns {Array<object>} Candidate repair options
 */
export function getProgressionRepairOptions(record, weaponsData = defaultWeaponsData) {
  if (!record || !record.entry) return [];

  const candidates = [];
  const isChar = record.type === 'character';
  const rarity = record.entry?.rarity || (weaponsData || []).find((w) => w.name === record.name)?.rarity;

  const curLv = record.currentLevel ?? (isChar ? 1 : 1);
  const curAsc = record.currentAscension ?? 0;
  const tgtLv = record.targetLevel ?? (isChar ? 90 : 90);
  const tgtAsc = record.targetAscension ?? 6;

  // 1. Analyze Current Progression options
  const validCurAscs = isChar
    ? getValidCharacterAscensions(curLv)
    : getValidWeaponAscensions(curLv, rarity);

  const curLevelRange = isChar
    ? getCharacterLevelRangeForAscension(curAsc)
    : getWeaponLevelRangeForAscension(curAsc, rarity);

  // Check if current level is a milestone with multiple ascensions
  const isMilestone = isChar ? isCharacterMilestone(curLv) : isWeaponMilestone(curLv, rarity);

  if (validCurAscs.length > 0) {
    validCurAscs.forEach((allowedAsc) => {
      // Don't propose the exact same invalid state
      if (allowedAsc !== curAsc) {
        const optionLabel = isMilestone
          ? `Set Current Ascension to ${allowedAsc} (${allowedAsc > 0 ? 'Ascended' : 'Unascended'} at Level ${curLv})`
          : `Adjust Current Ascension to ${allowedAsc} (matches Level ${curLv})`;

        candidates.push({
          id: `asc-${allowedAsc}`,
          label: optionLabel,
          strategy: 'adjust_ascension',
          isAmbiguous: isMilestone && validCurAscs.length > 1,
          proposedLevel: curLv,
          proposedAscension: allowedAsc,
          proposedTargetLevel: Math.max(tgtLv, curLv),
          proposedTargetAscension: Math.max(tgtAsc, allowedAsc),
        });
      }
    });
  }

  // Alternative option: adjust level to match current ascension
  if (curLevelRange && (curLv < curLevelRange.min || curLv > curLevelRange.max)) {
    // Propose minimum valid level for current ascension
    const proposedL = curLevelRange.min;
    candidates.push({
      id: `level-${proposedL}`,
      label: `Adjust Current Level to ${proposedL} (matches Ascension ${curAsc})`,
      strategy: 'adjust_level',
      isAmbiguous: true, // Choosing level over ascension is always ambiguous
      proposedLevel: proposedL,
      proposedAscension: curAsc,
      proposedTargetLevel: Math.max(tgtLv, proposedL),
      proposedTargetAscension: Math.max(tgtAsc, curAsc),
    });
  }

  // If target progression is also invalid, include target normalization
  const validTgtAscs = isChar
    ? getValidCharacterAscensions(tgtLv)
    : getValidWeaponAscensions(tgtLv, rarity);

  if (validTgtAscs.length > 0 && !validTgtAscs.includes(tgtAsc)) {
    // Need target ascension fix
    const bestTgtAsc = validTgtAscs[validTgtAscs.length - 1]; // highest valid target ascension
    candidates.forEach((cand) => {
      cand.proposedTargetAscension = Math.max(cand.proposedTargetAscension, bestTgtAsc);
    });
  }

  return candidates;
}

/**
 * Computes the exact before and after field differences for a proposed repair.
 *
 * @param {object} originalRecord - Original entity record
 * @param {object} proposed - Proposed values
 * @returns {Array<{ field: string, label: string, before: any, after: any }>}
 */
export function computeRepairDiff(originalRecord, proposed) {
  const diff = [];
  if (!originalRecord || !proposed) return diff;

  const checks = [
    { field: 'level', label: 'Current Level', before: originalRecord.level, after: proposed.proposedLevel },
    { field: 'ascension', label: 'Current Ascension', before: originalRecord.ascension, after: proposed.proposedAscension },
    { field: 'targetLevel', label: 'Target Level', before: originalRecord.targetLevel, after: proposed.proposedTargetLevel },
    { field: 'targetAscension', label: 'Target Ascension', before: originalRecord.targetAscension, after: proposed.proposedTargetAscension },
  ];

  checks.forEach(({ field, label, before, after }) => {
    if (after !== undefined && after !== before) {
      diff.push({ field, label, before: before ?? '—', after });
    }
  });

  return diff;
}

/**
 * Validates a single repair proposal against domain progression contracts.
 *
 * @param {object} repair
 * @param {object} [catalogData]
 * @returns {{ isValid: boolean, error: string|null }}
 */
export function validateRepairProposal(repair, _catalogData = null) {
  if (!repair) return { isValid: false, error: 'Repair proposal is missing.' };

  const { type, proposedLevel, proposedAscension, proposedTargetLevel, proposedTargetAscension, rarity } = repair;

  // Validate current level/ascension
  const curVal = validateLevelAscension(proposedLevel, proposedAscension, type, rarity);
  if (!curVal.isValid) {
    return {
      isValid: false,
      error: `Proposed current progression is invalid: ${curVal.reason}`,
    };
  }

  // Validate target level/ascension
  const tgtVal = validateLevelAscension(proposedTargetLevel, proposedTargetAscension, type, rarity);
  if (!tgtVal.isValid) {
    return {
      isValid: false,
      error: `Proposed target progression is invalid: ${tgtVal.reason}`,
    };
  }

  // Validate progression ordering: target >= current
  const ordVal = validateProgressionOrdering(proposedLevel, proposedAscension, proposedTargetLevel, proposedTargetAscension);
  if (!ordVal.isValid) {
    return {
      isValid: false,
      error: `Proposed progression violates ordering: ${ordVal.reason}`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates an entire batch of selected repairs against current store state and progression contracts.
 * Performs stale preview detection by ensuring stored records have not drifted from original preview snapshots.
 *
 * @param {Array<object>} repairs - Array of repair proposals
 * @param {object} currentState - Current Zustand store state
 * @param {Array} [weaponsData] - Optional weapon catalog
 * @returns {{ isValid: boolean, isStale?: boolean, isInvalidProposal?: boolean, error: string|null }}
 */
export function validateRepairBatch(repairs, currentState, weaponsData = defaultWeaponsData) {
  if (!Array.isArray(repairs) || repairs.length === 0) {
    return { isValid: false, error: 'No repairs provided for batch validation.' };
  }

  if (!currentState || typeof currentState !== 'object') {
    return { isValid: false, error: 'Current application state is unavailable.' };
  }

  const { roster = {}, trackedWeapons = [] } = currentState;
  const weaponMap = new Map((weaponsData || []).map((w) => [w.name, w]));

  // Check for duplicate or missing identifiers in the batch
  const seenEntities = new Set();
  for (const r of repairs) {
    if (!r.id || typeof r.id !== 'string' || r.id.trim() === '') {
      return {
        isValid: false,
        isInvalidProposal: true,
        error: `Invalid repair proposal: missing or empty ${r.type || 'entity'} identifier.`,
      };
    }
    const key = `${r.type}:${r.id}`;
    if (seenEntities.has(key)) {
      return {
        isValid: false,
        isInvalidProposal: true,
        error: `Duplicate repair instructions detected for ${r.type} '${r.id}'. Batch must contain at most one repair per entity.`,
      };
    }
    seenEntities.add(key);
  }

  for (const repair of repairs) {
    const { id, type, originalRecord } = repair;

    if (type === 'character') {
      const stored = roster[id];
      if (!stored) {
        return {
          isValid: false,
          isStale: true,
          error: `Character '${id}' no longer exists in current roster. Preview is stale.`,
        };
      }

      // Stale preview check
      if (
        originalRecord &&
        (stored.level !== originalRecord.level ||
          stored.ascension !== originalRecord.ascension ||
          stored.targetLevel !== originalRecord.targetLevel ||
          stored.targetAscension !== originalRecord.targetAscension)
      ) {
        return {
          isValid: false,
          isStale: true,
          staleRecordId: id,
          error: `Character '${id}' has been modified since the preview was generated. Please refresh the scan.`,
        };
      }

      // Proposal validation
      const proposalVal = validateRepairProposal(repair);
      if (!proposalVal.isValid) {
        return {
          isValid: false,
          isInvalidProposal: true,
          error: `Invalid repair proposal for character '${id}': ${proposalVal.error}`,
        };
      }
    } else if (type === 'weapon') {
      const matches = trackedWeapons.filter((w) => w.id === id);
      if (matches.length === 0) {
        return {
          isValid: false,
          isStale: true,
          error: `Tracked weapon '${id}' no longer exists. Preview is stale.`,
        };
      }

      if (matches.length > 1) {
        return {
          isValid: false,
          isAmbiguousIdentity: true,
          error: `Cannot repair weapon '${matches[0].weaponName || id}': duplicate identifier '${id}' detected across ${matches.length} tracked weapon records. Identity must be resolved before progression can be repaired safely.`,
        };
      }

      const stored = matches[0];

      // Stale preview check
      if (
        originalRecord &&
        (stored.level !== originalRecord.level ||
          stored.ascension !== originalRecord.ascension ||
          stored.targetLevel !== originalRecord.targetLevel ||
          stored.targetAscension !== originalRecord.targetAscension)
      ) {
        return {
          isValid: false,
          isStale: true,
          staleRecordId: id,
          error: `Weapon '${stored.weaponName || id}' has been modified since the preview was generated. Please refresh the scan.`,
        };
      }

      // Proposal validation
      const wData = weaponMap.get(stored.weaponName) || stored.data;
      const proposalVal = validateRepairProposal({ ...repair, rarity: wData?.rarity || stored.rarity });
      if (!proposalVal.isValid) {
        return {
          isValid: false,
          isInvalidProposal: true,
          error: `Invalid repair proposal for weapon '${stored.weaponName || id}': ${proposalVal.error}`,
        };
      }
    } else {
      return { isValid: false, error: `Unknown entity type '${type}' for repair '${id}'.` };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Executes an atomic progression repair transaction with in-memory rollback and persistence verification.
 *
 * @param {object} options
 * @param {Array<object>} options.repairs - Selected validated repair proposals
 * @param {Function} options.getState - Function returning current store state
 * @param {Function} options.setState - Function applying state update to store
 * @param {boolean} options.backupValidated - Whether mandatory backup was validated and acknowledged
 * @param {object} [options.persistenceStorage] - Storage backend (defaults to window.localStorage)
 * @param {Array} [options.weaponsData] - Optional weapon catalog
 * @param {boolean} [options.simulatePersistenceFailure] - Optional test hook to simulate storage failure
 * @returns {{ success: boolean, repairedCount?: number, repairedIds?: string[], error?: string, rollbackApplied: boolean, rollbackFailed?: boolean, isStale?: boolean, isAmbiguousIdentity?: boolean }}
 */
export function executeRepairTransaction({
  repairs,
  getState,
  setState,
  backupValidated,
  persistenceStorage = typeof window !== 'undefined' ? window.localStorage : null,
  weaponsData = defaultWeaponsData,
  simulatePersistenceFailure = false,
}) {
  // 1. Mandatory backup precondition
  if (!backupValidated) {
    return {
      success: false,
      error: 'Pre-repair backup has not been validated. Creating and saving a backup is mandatory before applying repairs.',
      rollbackApplied: false,
    };
  }

  if (!Array.isArray(repairs) || repairs.length === 0) {
    return {
      success: false,
      error: 'No repairs selected.',
      rollbackApplied: false,
    };
  }

  const currentState = getState ? getState() : null;
  if (!currentState || typeof currentState !== 'object') {
    return {
      success: false,
      error: 'Current application state is unavailable.',
      rollbackApplied: false,
    };
  }

  const selectedCharIds = new Set(repairs.filter((r) => r.type === 'character').map((r) => r.id));
  const selectedWeaponIds = new Set(repairs.filter((r) => r.type === 'weapon').map((r) => r.id));

  // 2. Cross-Tab Concurrency Verification (fail-closed against external writes)
  if (persistenceStorage && typeof persistenceStorage.getItem === 'function') {
    try {
      const rawPersisted = persistenceStorage.getItem(STORE_NAME);
      if (rawPersisted) {
        const parsed = JSON.parse(rawPersisted);
        const persistedState = parsed?.state || parsed;
        const persistedRoster = persistedState?.roster || {};
        const persistedWeapons = persistedState?.trackedWeapons || [];

        // Check selected repairs against persisted storage
        for (const repair of repairs) {
          if (repair.type === 'character') {
            const pStored = persistedRoster[repair.id];
            if (!pStored) {
              return {
                success: false,
                isStale: true,
                error: `External modification detected: Character '${repair.id}' no longer exists in browser storage. Transaction aborted to prevent overwriting newer state.`,
                rollbackApplied: false,
              };
            }
            if (
              repair.originalRecord &&
              (pStored.level !== repair.originalRecord.level ||
                pStored.ascension !== repair.originalRecord.ascension ||
                pStored.targetLevel !== repair.originalRecord.targetLevel ||
                pStored.targetAscension !== repair.originalRecord.targetAscension)
            ) {
              return {
                success: false,
                isStale: true,
                error: `External modification detected: Character '${repair.id}' was modified by another browser tab. Transaction aborted to prevent overwriting newer state.`,
                rollbackApplied: false,
              };
            }
          } else if (repair.type === 'weapon') {
            const pMatches = persistedWeapons.filter((w) => w.id === repair.id);
            if (pMatches.length === 0) {
              return {
                success: false,
                isStale: true,
                error: `External modification detected: Tracked weapon '${repair.id}' no longer exists in browser storage. Transaction aborted to prevent overwriting newer state.`,
                rollbackApplied: false,
              };
            }
            if (pMatches.length > 1) {
              return {
                success: false,
                isAmbiguousIdentity: true,
                error: `Cannot repair weapon: duplicate identifier '${repair.id}' detected in browser storage. Identity must be resolved first.`,
                rollbackApplied: false,
              };
            }
            const pStored = pMatches[0];
            if (
              repair.originalRecord &&
              (pStored.level !== repair.originalRecord.level ||
                pStored.ascension !== repair.originalRecord.ascension ||
                pStored.targetLevel !== repair.originalRecord.targetLevel ||
                pStored.targetAscension !== repair.originalRecord.targetAscension)
            ) {
              return {
                success: false,
                isStale: true,
                error: `External modification detected: Weapon '${pStored.weaponName || repair.id}' was modified by another browser tab. Transaction aborted to prevent overwriting newer state.`,
                rollbackApplied: false,
              };
            }
          }
        }

        // Check unselected characters in persisted storage for drift
        const currentRosterKeys = Object.keys(currentState.roster || {});
        for (const key of currentRosterKeys) {
          if (!selectedCharIds.has(key) && !key.startsWith('Traveler ')) {
            const cChar = currentState.roster[key];
            const pChar = persistedRoster[key];
            if (!pChar || cChar.level !== pChar.level || cChar.ascension !== pChar.ascension) {
              return {
                success: false,
                isStale: true,
                error: `External modification detected: Character '${key}' was modified in another browser tab. Transaction aborted to preserve newer data.`,
                rollbackApplied: false,
              };
            }
          }
        }

        // Check unselected weapons in persisted storage for drift
        for (const w of currentState.trackedWeapons || []) {
          if (!selectedWeaponIds.has(w.id)) {
            const pW = persistedWeapons.find((x) => x.id === w.id);
            if (!pW || pW.level !== w.level || pW.ascension !== w.ascension) {
              return {
                success: false,
                isStale: true,
                error: `External modification detected: Weapon '${w.weaponName || w.id}' was modified in another browser tab. Transaction aborted to preserve newer data.`,
                rollbackApplied: false,
              };
            }
          }
        }
      }
    } catch (storageCheckErr) {
      console.warn('Storage pre-flight verification warning:', storageCheckErr);
    }
  }

  // 3. Pre-flight batch validation & proposal checks
  const preValidation = validateRepairBatch(repairs, currentState, weaponsData);
  if (!preValidation.isValid) {
    return {
      success: false,
      isStale: preValidation.isStale,
      isInvalidProposal: preValidation.isInvalidProposal,
      isAmbiguousIdentity: preValidation.isAmbiguousIdentity,
      error: preValidation.error,
      rollbackApplied: false,
    };
  }

  // 4. Capture verified in-memory rollback snapshot
  const rollbackSnapshot = {
    roster: JSON.parse(JSON.stringify(currentState.roster || {})),
    trackedWeapons: JSON.parse(JSON.stringify(currentState.trackedWeapons || [])),
  };

  try {
    // 5. Construct updated state
    const updatedRoster = { ...currentState.roster };
    const updatedWeapons = (currentState.trackedWeapons || []).map((w) => ({ ...w }));

    for (const repair of repairs) {
      if (repair.type === 'character') {
        const existingChar = updatedRoster[repair.id];
        if (!existingChar) {
          throw new Error(`Character '${repair.id}' not found during application.`);
        }

        let updatedChar = {
          ...existingChar,
          level: repair.proposedLevel ?? existingChar.level,
          ascension: repair.proposedAscension ?? existingChar.ascension,
          targetLevel: repair.proposedTargetLevel ?? existingChar.targetLevel,
          targetAscension: repair.proposedTargetAscension ?? existingChar.targetAscension,
        };

        // Recalculate character progression and talent costs
        updatedChar = recalculateCharacterCosts(repair.id, updatedChar);
        updatedRoster[repair.id] = updatedChar;

        // If Traveler variant, sync ascension across variants
        if (repair.id.startsWith('Traveler ')) {
          syncTravelerAscension(updatedRoster, repair.id);
        }
      } else if (repair.type === 'weapon') {
        const matches = updatedWeapons.filter((w) => w.id === repair.id);
        if (matches.length !== 1) {
          throw new Error(
            `Tracked weapon '${repair.id}' cannot be uniquely resolved (found ${matches.length} matching records).`
          );
        }

        const wIdx = updatedWeapons.findIndex((w) => w.id === repair.id);
        const existingW = updatedWeapons[wIdx];
        const updatedW = {
          ...existingW,
          level: repair.proposedLevel ?? existingW.level,
          ascension: repair.proposedAscension ?? existingW.ascension,
          targetLevel: repair.proposedTargetLevel ?? existingW.targetLevel,
          targetAscension: repair.proposedTargetAscension ?? existingW.targetAscension,
        };

        // Recalculate weapon costs
        const wData = (weaponsData || []).find((wd) => wd.name === updatedW.weaponName) || updatedW.data;
        if (wData) {
          updatedW.calculatedCosts = calculateWeaponCost(
            wData,
            updatedW.level,
            updatedW.targetLevel,
            updatedW.ascension,
            updatedW.targetAscension,
            updatedW.currentRefinement || 1,
            updatedW.targetRefinement || 1
          );
        }
        updatedWeapons[wIdx] = updatedW;
      }
    }

    // 6. Verify unselected records remain completely untouched
    Object.keys(currentState.roster || {}).forEach((name) => {
      if (!selectedCharIds.has(name) && !name.startsWith('Traveler ')) {
        if (updatedRoster[name] !== currentState.roster[name]) {
          throw new Error(`Unselected character '${name}' was modified during repair.`);
        }
      }
    });

    (currentState.trackedWeapons || []).forEach((w, idx) => {
      if (!selectedWeaponIds.has(w.id)) {
        if (updatedWeapons[idx].id !== w.id || updatedWeapons[idx].level !== w.level) {
          throw new Error(`Unselected weapon '${w.id}' was modified during repair.`);
        }
      }
    });

    // 7. Post-application validation of all repaired records
    for (const repair of repairs) {
      if (repair.type === 'character') {
        const c = updatedRoster[repair.id];
        const valC = validateLevelAscension(c.level, c.ascension, 'character');
        const valT = validateLevelAscension(c.targetLevel, c.targetAscension, 'character');
        const valO = validateProgressionOrdering(c.level, c.ascension, c.targetLevel, c.targetAscension);
        if (!valC.isValid || !valT.isValid || !valO.isValid) {
          throw new Error(
            `Post-repair validation failed for character '${repair.id}': ${valC.reason || valT.reason || valO.reason}`
          );
        }
      } else if (repair.type === 'weapon') {
        const w = updatedWeapons.find((x) => x.id === repair.id);
        const wData = (weaponsData || []).find((wd) => wd.name === w.weaponName) || w.data;
        const valC = validateLevelAscension(w.level, w.ascension, 'weapon', wData?.rarity);
        const valT = validateLevelAscension(w.targetLevel, w.targetAscension, 'weapon', wData?.rarity);
        const valO = validateProgressionOrdering(w.level, w.ascension, w.targetLevel, w.targetAscension);
        if (!valC.isValid || !valT.isValid || !valO.isValid) {
          throw new Error(
            `Post-repair validation failed for weapon '${w.weaponName || repair.id}': ${valC.reason || valT.reason || valO.reason}`
          );
        }
      }
    }

    // Hook for simulated persistence failure testing
    if (simulatePersistenceFailure) {
      throw new Error('Simulated storage quota exceeded or persistence failure.');
    }

    // 8. Apply atomic state update to store
    if (setState) {
      setState({
        roster: updatedRoster,
        trackedWeapons: updatedWeapons,
      });
    }

    // 9. Verify persistence integrity
    if (persistenceStorage) {
      try {
        if (typeof persistenceStorage.getItem === 'function') {
          const stored = persistenceStorage.getItem(STORE_NAME);
          if (stored) {
            JSON.parse(stored);
          }
        }
      } catch (storageErr) {
        throw new Error(`Persistence verification failed: ${storageErr?.message || 'Storage error'}`, {
          cause: storageErr,
        });
      }
    }

    return {
      success: true,
      repairedCount: repairs.length,
      repairedIds: repairs.map((r) => r.id),
      rollbackApplied: false,
      error: null,
    };
  } catch (err) {
    let rollbackApplied = false;
    let rollbackError = null;

    // Immediate rollback to snapshot
    if (setState && rollbackSnapshot) {
      try {
        setState({
          roster: rollbackSnapshot.roster,
          trackedWeapons: rollbackSnapshot.trackedWeapons,
        });
        rollbackApplied = true;
      } catch (rollbackErr) {
        rollbackError = rollbackErr?.message || 'Rollback state application threw an error';
        console.error('Critical: Rollback failed during repair transaction:', rollbackErr);
      }
    }

    const errorMessage = rollbackError
      ? `Transaction failed (${err?.message || 'Unknown error'}) and rollback failed: ${rollbackError}`
      : (err?.message || 'Repair transaction failed and was rolled back.');

    return {
      success: false,
      error: errorMessage,
      rollbackApplied,
      rollbackFailed: Boolean(rollbackError),
    };
  }
}

