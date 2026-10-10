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

    const { canonicalId, rosterKey, character: canonicalData } = charMap;
    const localChar = roster[rosterKey];

    const isNew = !localChar;
    if (isNew) {
      result.summary.newCharacters++;
    } else {
      result.summary.existingCharacters++;
    }

    // 1. Character Progression Validation
    const isProgressionValid = isValidProgression(syncChar.level, syncChar.ascension);
    let status = isNew ? "new" : "unchanged";
    let hasLocalAhead = false;
    let hasUpdate = false;

    const changes = {};

    if (!isProgressionValid) {
      status = "conflict";
      result.summary.charactersWithConflicts++;
    } else if (!isNew) {
      // Compare Level
      const lvlCmp = compareField(localChar.level, syncChar.level);
      if (lvlCmp.direction !== "same") {
        changes.level = lvlCmp;
        hasUpdate = true;
        if (lvlCmp.direction === "local-ahead") hasLocalAhead = true;
      }

      // Compare Ascension
      const asc = syncChar.ascension ?? 0; // If missing, assume 0
      const ascCmp = compareField(localChar.ascension, asc);
      if (ascCmp.direction !== "same") {
        changes.ascension = ascCmp;
        hasUpdate = true;
        if (ascCmp.direction === "local-ahead") hasLocalAhead = true;
      }

      // Compare Talents
      if (syncChar.talents) {
        changes.talents = {};
        let talentDiff = false;

        ['normal', 'skill', 'burst'].forEach(t => {
          const remoteT = syncChar.talents[t] ?? 1;
          const localT = (localChar.talents && localChar.talents[t]) ? localChar.talents[t] : 1;
          const tCmp = compareField(localT, remoteT);
          if (tCmp.direction !== "same") {
            changes.talents[t] = tCmp;
            talentDiff = true;
            hasUpdate = true;
            if (tCmp.direction === "local-ahead") hasLocalAhead = true;
          }
        });

        if (!talentDiff) {
          delete changes.talents;
        }
      }

      if (hasUpdate && status !== "conflict") {
        status = "update";
        result.summary.charactersWithUpdates++;
        if (hasLocalAhead) {
          result.summary.localAheadCharacters++;
        }
      } else if (status === "unchanged") {
        result.summary.unchangedCharacters++;
      }
    }

    // 2. Weapon Reconciliation
    let weaponReconciliation = null;
    const wepMap = mapHoyolabWeapon(syncChar.weapon);

    if (wepMap.status === "unmapped") {
      weaponReconciliation = { status: "unmapped", hoyolab: syncChar.weapon };
    } else {
      const canonicalWeapon = wepMap.weapon;
      const remoteWep = syncChar.weapon;

      let equippedInstance = null;
      if (localChar && localChar.equippedWeaponId) {
        equippedInstance = trackedWeapons.find(w => w.id === localChar.equippedWeaponId);
      }

      if (equippedInstance) {
        // Compare identity
        const expectedWepId = canonicalWeapon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (equippedInstance.weapon_id === expectedWepId) {
          // Matched Instance!
          weaponReconciliation = {
            status: "matched-instance",
            canonicalId: canonicalWeapon.id,
            weaponName: canonicalWeapon.name,
            hoyolabId: remoteWep.id,
            equippedInstanceId: equippedInstance.id,
            changes: {}
          };
          result.summary.weaponMatched++;

          // Compare weapon fields
          const wLvl = compareField(equippedInstance.level, remoteWep.level);
          if (wLvl.direction !== "same") weaponReconciliation.changes.level = wLvl;

          const wAsc = compareField(equippedInstance.ascension, remoteWep.ascension ?? 0);
          if (wAsc.direction !== "same") weaponReconciliation.changes.ascension = wAsc;

          const wRef = compareField(equippedInstance.currentRefinement, remoteWep.refinement ?? 1);
          if (wRef.direction !== "same") weaponReconciliation.changes.refinement = wRef;

        } else {
          // Mismatch
          weaponReconciliation = {
            status: "equipment-mismatch",
            canonicalId: canonicalWeapon.id,
            weaponName: canonicalWeapon.name,
            hoyolabId: remoteWep.id,
            equippedInstanceId: equippedInstance.id
          };
          result.summary.weaponMismatch++;
        }
      } else {
        // No equipped instance, search candidates
        const expectedWepId = canonicalWeapon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const candidates = trackedWeapons.filter(w => w.weapon_id === expectedWepId && !w.assignedTo);

        if (candidates.length === 1) {
          weaponReconciliation = {
            status: "suggested-instance",
            canonicalId: canonicalWeapon.id,
            weaponName: canonicalWeapon.name,
            hoyolabId: remoteWep.id,
            candidates: candidates
          };
          result.summary.weaponSuggested++;
        } else if (candidates.length > 1) {
          weaponReconciliation = {
            status: "ambiguous",
            canonicalId: canonicalWeapon.id,
            weaponName: canonicalWeapon.name,
            hoyolabId: remoteWep.id,
            candidates: candidates
          };
          result.summary.weaponAmbiguous++;
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

    result.characters.push({
      hoyolabId: syncChar.id,
      canonicalId,
      rosterKey,
      status,
      hoyolab: syncChar,
      local: localChar || null,
      changes,
      weaponReconciliation
    });
  }

  return result;
}
