import { mapHoyolabCharacter, mapHoyolabWeapon, EXCLUDED_HOYOLAB_CHARACTER_IDS } from './hoyolabCharacterMapping';

const MAX_LEVELS = {
  0: 20,
  1: 40,
  2: 50,
  3: 60,
  4: 70,
  5: 80,
  6: 90
};

const MIN_LEVELS = {
  0: 1,
  1: 20,
  2: 40,
  3: 50,
  4: 60,
  5: 70,
  6: 80
};

function isValidProgression(level, ascension) {
  if (ascension == null || level == null) return true; // Can't validate
  if (ascension < 0 || ascension > 6) return false;
  if (level > MAX_LEVELS[ascension]) return false;
  if (level < MIN_LEVELS[ascension]) return false;
  return true;
}

function compareField(local, remote) {
  if (local === remote) return { direction: "same", local, remote };
  return {
    direction: local > remote ? "local-ahead" : "remote-ahead",
    local,
    remote
  };
}

export function normalizeWeaponSlug(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSameBaseWeapon(instance, canonicalWeapon) {
  if (!instance || !canonicalWeapon) return false;
  // 1. Direct canonical id match (e.g. "AmenomaKageuchi" === "AmenomaKageuchi")
  if (instance.weapon_id && instance.weapon_id === canonicalWeapon.id) return true;
  // 2. Normalized slug match of weapon_id against canonical id or name
  const instSlug = normalizeWeaponSlug(instance.weapon_id);
  const canIdSlug = normalizeWeaponSlug(canonicalWeapon.id);
  const canNameSlug = normalizeWeaponSlug(canonicalWeapon.name);
  if (instSlug && (instSlug === canIdSlug || instSlug === canNameSlug)) return true;
  // 3. Display name or name slug match
  if (instance.weaponName && instance.weaponName === canonicalWeapon.name) return true;
  if (instance.weaponName && normalizeWeaponSlug(instance.weaponName) === canNameSlug) return true;
  return false;
}

export function reconcileCharacters(syncArray, roster, trackedWeapons) {
  const result = {
    characters: [],
    summary: {
      totalRemote: syncArray.length,
      ignored: 0,
      syncRelevant: 0,
      mapped: 0,
      unmapped: 0,
      newCharacters: 0,
      existingCharacters: 0,
      unchangedCharacters: 0,
      charactersWithUpdates: 0,
      charactersWithConflicts: 0,
      localAheadCharacters: 0,
      weaponMatched: 0,
      weaponMismatch: 0,
      weaponWouldCreate: 0,
      weaponAmbiguous: 0,
      weaponSuggested: 0
    }
  };

  for (const syncChar of syncArray) {
    if (EXCLUDED_HOYOLAB_CHARACTER_IDS.has(syncChar.id)) {
      result.summary.ignored++;
      result.characters.push({
        status: "ignored",
        hoyolabId: syncChar.id,
        hoyolab: syncChar
      });
      continue;
    }

    result.summary.syncRelevant++;
    const charMap = mapHoyolabCharacter(syncChar);

    if (charMap.status === "unmapped") {
      result.summary.unmapped++;
      result.characters.push({
        status: "unmapped",
        hoyolabId: syncChar.id,
        hoyolab: syncChar
      });
      continue;
    }

    result.summary.mapped++;

    const { canonicalId, rosterKey } = charMap;
    const localChar = roster[rosterKey];
    const isNew = !localChar;

    // 1. Character Progression Validation & Diff
    const isProgressionValid = isValidProgression(syncChar.level, syncChar.ascension);
    let hasLocalAhead = false;
    let hasCharUpdate = false;
    const changes = {};

    if (!isNew && isProgressionValid) {
      // Compare Level
      const lvlCmp = compareField(localChar.level, syncChar.level);
      if (lvlCmp.direction !== "same") {
        changes.level = lvlCmp;
        hasCharUpdate = true;
        if (lvlCmp.direction === "local-ahead") hasLocalAhead = true;
      }

      // Compare Ascension
      const asc = syncChar.ascension ?? 0;
      const ascCmp = compareField(localChar.ascension, asc);
      if (ascCmp.direction !== "same") {
        changes.ascension = ascCmp;
        hasCharUpdate = true;
        if (ascCmp.direction === "local-ahead") hasLocalAhead = true;
      }

      // Compare Talents
      if (syncChar.talents) {
        changes.talents = {};
        let talentDiff = false;

        ['normal', 'skill', 'burst'].forEach(t => {
          if (syncChar.talents[t] === undefined || syncChar.talents[t] === null) {
            return;
          }
          const remoteT = syncChar.talents[t];
          const localT = (localChar.talents && localChar.talents[t]) ? localChar.talents[t] : 1;
          const tCmp = compareField(localT, remoteT);
          if (tCmp.direction !== "same") {
            changes.talents[t] = tCmp;
            talentDiff = true;
            hasCharUpdate = true;
            if (tCmp.direction === "local-ahead") hasLocalAhead = true;
          }
        });

        if (!talentDiff) {
          delete changes.talents;
        }
      }
    }

    // 2. Weapon Reconciliation
    let weaponReconciliation;
    const wepMap = mapHoyolabWeapon(syncChar.weapon);

    if (wepMap.status === "unmapped") {
      weaponReconciliation = { status: "unmapped", hoyolab: syncChar.weapon };
    } else {
      const canonicalWeapon = wepMap.weapon;
      const remoteWep = syncChar.weapon;

      let equippedInstance = null;
      if (localChar) {
        if (rosterKey.startsWith('Traveler ')) {
          equippedInstance = trackedWeapons.find(w => w.assignedTo && w.assignedTo.startsWith('Traveler '));
        } else if (localChar.equippedWeaponId) {
          equippedInstance = trackedWeapons.find(w => w.id === localChar.equippedWeaponId);
        }
      }

      if (equippedInstance && isSameBaseWeapon(equippedInstance, canonicalWeapon)) {
        // Matched Instance!
        const weaponChanges = {};
        const localLvl = equippedInstance.level ?? 1;
        const remoteLvl = remoteWep.level ?? 1;
        const wLvl = compareField(localLvl, remoteLvl);
        if (wLvl.direction !== "same") weaponChanges.level = wLvl;

        if (remoteWep.ascension != null) {
          const localAsc = equippedInstance.ascension ?? 0;
          const remoteAsc = remoteWep.ascension;
          const wAsc = compareField(localAsc, remoteAsc);
          if (wAsc.direction !== "same") weaponChanges.ascension = wAsc;
        }

        if (remoteWep.refinement != null) {
          const localRef = equippedInstance.currentRefinement ?? 1;
          const remoteRef = remoteWep.refinement;
          const wRef = compareField(localRef, remoteRef);
          if (wRef.direction !== "same") weaponChanges.refinement = wRef;
        }

        const hasWeaponUpdate = Object.keys(weaponChanges).length > 0;

        weaponReconciliation = {
          status: "matched-instance",
          canonicalId: canonicalWeapon.id,
          weaponName: canonicalWeapon.name,
          hoyolabId: remoteWep.id,
          equippedInstanceId: equippedInstance.id,
          equippedInstance,
          changes: weaponChanges,
          hasWeaponUpdate
        };
        result.summary.weaponMatched++;
      } else {
        // Search Armory for compatible tracked instances of remote base weapon
        const candidates = trackedWeapons.filter(w => isSameBaseWeapon(w, canonicalWeapon));

        if (candidates.length === 1) {
          const cand = candidates[0];
          const weaponChanges = {};
          const localLvl = cand.level ?? 1;
          const remoteLvl = remoteWep.level ?? 1;
          const wLvl = compareField(localLvl, remoteLvl);
          if (wLvl.direction !== "same") weaponChanges.level = wLvl;

          if (remoteWep.ascension != null) {
            const localAsc = cand.ascension ?? 0;
            const remoteAsc = remoteWep.ascension;
            const wAsc = compareField(localAsc, remoteAsc);
            if (wAsc.direction !== "same") weaponChanges.ascension = wAsc;
          }

          if (remoteWep.refinement != null) {
            const localRef = cand.currentRefinement ?? 1;
            const remoteRef = remoteWep.refinement;
            const wRef = compareField(localRef, remoteRef);
            if (wRef.direction !== "same") weaponChanges.refinement = wRef;
          }

          const hasWeaponUpdate = Object.keys(weaponChanges).length > 0;
          const status = equippedInstance ? "existing-tracked-match" : (cand.assignedTo ? "existing-tracked-match" : "suggested-instance");

          weaponReconciliation = {
            status,
            canonicalId: canonicalWeapon.id,
            weaponName: canonicalWeapon.name,
            hoyolabId: remoteWep.id,
            candidateInstance: cand,
            candidateInstanceId: cand.id,
            candidateAssignedTo: cand.assignedTo || null,
            equippedInstanceId: equippedInstance?.id || null,
            equippedInstance: equippedInstance || null,
            candidates: [cand],
            changes: weaponChanges,
            hasWeaponUpdate
          };
          result.summary.weaponSuggested++;
        } else if (candidates.length > 1) {
          const status = equippedInstance ? "ambiguous-existing-match" : "ambiguous";
          weaponReconciliation = {
            status,
            canonicalId: canonicalWeapon.id,
            weaponName: canonicalWeapon.name,
            hoyolabId: remoteWep.id,
            equippedInstanceId: equippedInstance?.id || null,
            equippedInstance: equippedInstance || null,
            candidates: candidates
          };
          result.summary.weaponAmbiguous++;
        } else {
          // Zero matching instances in Armory
          if (equippedInstance) {
            weaponReconciliation = {
              status: "equipment-mismatch",
              canonicalId: canonicalWeapon.id,
              weaponName: canonicalWeapon.name,
              hoyolabId: remoteWep.id,
              equippedInstanceId: equippedInstance.id,
              equippedInstance
            };
            result.summary.weaponMismatch++;
          } else {
            weaponReconciliation = {
              status: "would-create",
              canonicalId: canonicalWeapon.id,
              weaponName: canonicalWeapon.name,
              hoyolabId: remoteWep.id
            };
            result.summary.weaponWouldCreate++;
          }
        }
      }
    }

    // 3. Status Classification
    const characterDiff = hasCharUpdate;
    const isDifferentEquipped = !!(localChar && ['existing-tracked-match', 'equipment-mismatch', 'suggested-instance', 'ambiguous', 'ambiguous-existing-match', 'would-create'].includes(weaponReconciliation?.status));
    const isMatchedWeaponUpdate = !!(weaponReconciliation?.status === 'matched-instance' && weaponReconciliation?.hasWeaponUpdate);
    const weaponDiff = isDifferentEquipped || isMatchedWeaponUpdate;
    const hasAnyUpdate = characterDiff || weaponDiff;

    let status;
    if (!isProgressionValid) {
      status = "conflict";
      result.summary.charactersWithConflicts++;
    } else if (isNew) {
      status = "new";
      result.summary.newCharacters++;
    } else {
      result.summary.existingCharacters++;
      if (hasAnyUpdate) {
        status = "update";
        result.summary.charactersWithUpdates++;
        const hasWeaponLocalAhead = weaponReconciliation?.changes &&
          Object.values(weaponReconciliation.changes).some(c => c.direction === 'local-ahead');
        if (hasLocalAhead || hasWeaponLocalAhead) {
          result.summary.localAheadCharacters++;
        }
      } else {
        status = "unchanged";
        result.summary.unchangedCharacters++;
      }
    }

    const needsAttention = status === 'conflict' ||
      status === 'unmapped' ||
      weaponReconciliation?.status === 'unmapped' ||
      weaponReconciliation?.status === 'equipment-mismatch' ||
      weaponReconciliation?.status === 'ambiguous' ||
      weaponReconciliation?.status === 'ambiguous-existing-match' ||
      (weaponReconciliation?.status === 'existing-tracked-match' && !!weaponReconciliation.candidateAssignedTo) ||
      hasLocalAhead;

    const weaponResolution = weaponReconciliation?.status === 'matched-instance' && weaponReconciliation?.hasWeaponUpdate
      ? 'update-existing'
      : (weaponReconciliation?.status || 'none');

    result.characters.push({
      hoyolabId: syncChar.id,
      canonicalId,
      rosterKey,
      status,
      characterDiff,
      weaponDiff,
      weaponResolution,
      needsAttention,
      hoyolab: syncChar,
      local: localChar || null,
      changes,
      weaponReconciliation
    });
  }

  // Detect and resolve safe weapon cycles (e.g. Ayaka <-> Skirk swaps)
  const safeCycles = getSafeWeaponCycles(result.characters);
  result.characters.forEach(c => {
    if (c.weaponReconciliation?.status === 'existing-tracked-match' && c.weaponReconciliation.candidateAssignedTo) {
      if (safeCycles.has(c.rosterKey)) {
        const hasWeaponLocalAhead = c.weaponReconciliation?.changes &&
          Object.values(c.weaponReconciliation.changes).some(ch => ch?.direction === 'local-ahead');
        const hasCharLocalAhead = c.changes &&
          (Object.values(c.changes).some(ch => ch?.direction === 'local-ahead') ||
           (c.changes.talents && Object.values(c.changes.talents).some(ch => ch?.direction === 'local-ahead')));
        if (!hasWeaponLocalAhead && !hasCharLocalAhead && c.status !== 'conflict' && c.status !== 'unmapped') {
          c.needsAttention = false;
        }
      }
    }
  });

  return result;
}

/**
 * Finds sets of characters that form valid closed reassignment cycles
 * (e.g. Ayaka -> Amenoma owned by Skirk, Skirk -> Mistsplitter owned by Ayaka).
 */
export function getSafeWeaponCycles(characters, selectedFilter = null) {
  const charByRosterKey = new Map();
  characters.forEach(c => {
    if (c.rosterKey) {
      if (!selectedFilter || selectedFilter(c)) {
        charByRosterKey.set(c.rosterKey, c);
      }
    }
  });

  const safeCycleCharKeys = new Set();

  characters.forEach(startChar => {
    if (!charByRosterKey.has(startChar.rosterKey)) return;
    if (startChar.weaponReconciliation?.status !== 'existing-tracked-match') return;
    const cand = startChar.weaponReconciliation.candidateInstance || startChar.weaponReconciliation.candidates?.[0];
    if (!cand || !cand.assignedTo) return;

    const visited = [];
    let curr = startChar;

    while (curr) {
      if (visited.includes(curr.rosterKey)) {
        if (curr.rosterKey === startChar.rosterKey) {
          visited.forEach(k => safeCycleCharKeys.add(k));
        }
        break;
      }
      visited.push(curr.rosterKey);

      const nextCand = curr.weaponReconciliation?.candidateInstance || curr.weaponReconciliation?.candidates?.[0];
      if (!nextCand || !nextCand.assignedTo) break;

      const nextChar = charByRosterKey.get(nextCand.assignedTo);
      if (!nextChar || nextChar.status === 'conflict' || nextChar.status === 'unmapped') {
        break;
      }
      if (nextChar.weaponReconciliation?.status !== 'existing-tracked-match') {
        break;
      }
      curr = nextChar;
    }
  });

  return safeCycleCharKeys;
}
