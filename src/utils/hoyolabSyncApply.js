import { recalculateCharacterCosts, syncTravelerCurrentProgression } from '../store/helpers/rosterHelpers';

/**
 * Validates the apply plan against current state to prevent stale overwrites.
 */
export function validateHoyolabApplyPlan(plan, currentState) {
  if (!plan || !plan.characters) return { valid: false, reason: "Invalid plan" };
  const { roster, trackedWeapons } = currentState;

  for (const instruction of plan.characters) {
    if (instruction.expectedState) {
      const { rosterKey, character, weapon } = instruction.expectedState;

      if (character) {
        const localChar = roster[rosterKey];
        if (!localChar) return { valid: false, reason: `Character ${rosterKey} missing locally but expected in plan.` };
        if (localChar.level !== character.level || localChar.ascension !== character.ascension) return { valid: false, reason: `Character ${rosterKey} progression changed locally.` };

        const localNorm = localChar.talents?.normal ?? 1;
        const localSkill = localChar.talents?.skill ?? 1;
        const localBurst = localChar.talents?.burst ?? 1;
        const expNorm = character.talents?.normal ?? 1;
        const expSkill = character.talents?.skill ?? 1;
        const expBurst = character.talents?.burst ?? 1;
        if (localNorm !== expNorm || localSkill !== expSkill || localBurst !== expBurst) {
          return { valid: false, reason: `Character ${rosterKey} talents changed locally.` };
        }

        if (localChar.equippedWeaponId !== character.equippedWeaponId) return { valid: false, reason: `Character ${rosterKey} equipment changed locally.` };
      } else if (!instruction.isNew) {
        // If it wasn't new, it should have an expected state
        return { valid: false, reason: `Character ${rosterKey} missing expected state.` };
      }

      if (weapon && weapon.uuid) {
        const localWep = trackedWeapons.find(w => w.id === weapon.uuid);
        if (!localWep) return { valid: false, reason: `Weapon ${weapon.uuid} missing locally.` };
        if (localWep.weapon_id !== weapon.weapon_id) return { valid: false, reason: `Weapon ${weapon.uuid} identity changed locally.` };
        if (localWep.assignedTo !== weapon.assignedTo) return { valid: false, reason: `Weapon ${weapon.uuid} assignment changed locally.` };
        if (weapon.level !== undefined && localWep.level !== weapon.level) return { valid: false, reason: `Weapon ${weapon.uuid} level changed locally.` };
        if (weapon.ascension !== undefined && localWep.ascension !== weapon.ascension) return { valid: false, reason: `Weapon ${weapon.uuid} ascension changed locally.` };
        if (weapon.currentRefinement !== undefined && localWep.currentRefinement !== weapon.currentRefinement) return { valid: false, reason: `Weapon ${weapon.uuid} refinement changed locally.` };
      }
    }
  }

  if (plan.derivedTravelerVariants) {
    for (const instruction of plan.derivedTravelerVariants) {
      if (instruction.expectedState) {
        const { rosterKey, character } = instruction.expectedState;
        if (character) {
          const localChar = roster[rosterKey];
          if (!localChar) return { valid: false, reason: `Source character ${rosterKey} missing locally but expected in plan.` };
          if (localChar.level !== character.level || localChar.ascension !== character.ascension) return { valid: false, reason: `Source character ${rosterKey} progression changed locally.` };
        } else {
          const localChar = roster[rosterKey];
          if (localChar) return { valid: false, reason: `Source character ${rosterKey} expected to be new but exists locally.` };
        }
      }
    }
  }

  return { valid: true };
}

export function buildHoyolabApplyPlan({ reconciliationResult, selectedChars, weaponChoices, localAheadOverrides, selectedDerivedTravelers }) {
  const plan = { characters: [], derivedTravelerVariants: [] };

  if (!reconciliationResult) return plan;

  for (const char of reconciliationResult.characters) {
    if (!selectedChars[char.hoyolabId]) continue;

    // We only process 'new' and 'update' and 'unchanged' (if weapon changes)
    // Actually if selected, we process it.

    const fields = {};
    const applyField = (fieldKey, cmpObj) => {
      if (!cmpObj) return;
      if (cmpObj.direction === 'remote-ahead') {
        fields[fieldKey] = cmpObj.remote;
      } else if (cmpObj.direction === 'local-ahead') {
        if (localAheadOverrides[char.hoyolabId] && localAheadOverrides[char.hoyolabId][fieldKey]) {
          fields[fieldKey] = cmpObj.remote;
        }
      }
    };

    if (char.status === 'new') {
      fields.level = char.hoyolab.level;
      fields.ascension = char.hoyolab.ascension;
      if (char.hoyolab.talents) {
        fields.normal = char.hoyolab.talents.normal;
        fields.skill = char.hoyolab.talents.skill;
        fields.burst = char.hoyolab.talents.burst;
      }
    } else if (char.status === 'update') {
      applyField('level', char.changes?.level);
      applyField('ascension', char.changes?.ascension);
      if (char.changes?.talents) {
        applyField('normal', char.changes.talents.normal);
        applyField('skill', char.changes.talents.skill);
        applyField('burst', char.changes.talents.burst);
      }
    }

    let weapon = null;
    const wChoice = weaponChoices[char.hoyolabId];
    if (wChoice !== 'ignore' && char.weaponReconciliation && char.weaponReconciliation.status !== 'unmapped') {
      if (wChoice === 'create' || (char.weaponReconciliation.status === 'would-create' && !wChoice)) {
        weapon = {
          action: 'create',
          weapon_id: char.weaponReconciliation.canonicalId,
          name: char.weaponReconciliation.weaponName,
          level: char.hoyolab.weapon?.level,
          ascension: char.hoyolab.weapon?.ascension,
          refinement: char.hoyolab.weapon?.refinement
        };
      } else if (wChoice && wChoice.startsWith('assign|')) {
        const uuid = wChoice.split('|')[1];
        const wUpdate = {};

        // Find the chosen candidate instance to compute safe remote-ahead
        let chosenCandidate = null;
        if (char.weaponReconciliation.equippedInstanceId === uuid) {
          chosenCandidate = char.weaponReconciliation.equippedInstance;
        } else if (char.weaponReconciliation.candidates) {
          chosenCandidate = char.weaponReconciliation.candidates.find(c => c.id === uuid);
        }

        if (chosenCandidate) {
          const remoteWep = char.hoyolab.weapon;
          const rLvl = remoteWep?.level ?? 1;
          const rAsc = remoteWep?.ascension ?? 0;
          const rRef = remoteWep?.refinement ?? 1;

          const applyWField = (fieldKey, localValue, remoteValue) => {
            if (localValue < remoteValue) {
               wUpdate[fieldKey] = remoteValue;
            } else if (localValue > remoteValue) {
               if (localAheadOverrides[char.hoyolabId] && localAheadOverrides[char.hoyolabId][`weapon_${fieldKey}`]) {
                 wUpdate[fieldKey] = remoteValue;
               }
            }
          };

          applyWField('level', chosenCandidate.level, rLvl);
          applyWField('ascension', chosenCandidate.ascension, rAsc);
          applyWField('refinement', chosenCandidate.currentRefinement, rRef);
        }

        weapon = {
          action: 'assign',
          uuid,
          updateFields: wUpdate
        };
      } else if (char.weaponReconciliation.status === 'matched-instance' && !wChoice) {
        // Safe default for matched instance
        const uuid = char.weaponReconciliation.equippedInstanceId;
        const wUpdate = {};
        const changes = char.weaponReconciliation.changes || {};

        const applyWField = (fieldKey, cmpObj) => {
          if (!cmpObj) return;
          if (cmpObj.direction === 'remote-ahead') {
            wUpdate[fieldKey] = cmpObj.remote;
          } else if (cmpObj.direction === 'local-ahead') {
            if (localAheadOverrides[char.hoyolabId] && localAheadOverrides[char.hoyolabId][`weapon_${fieldKey}`]) {
              wUpdate[fieldKey] = cmpObj.remote;
            }
          }
        };
        applyWField('level', changes.level);
        applyWField('ascension', changes.ascension);
        applyWField('refinement', changes.refinement);

        weapon = {
          action: 'assign',
          uuid,
          updateFields: wUpdate
        };
      }
    }

    if (Object.keys(fields).length > 0 || weapon || char.status === 'new') {
      const expectedState = {
        rosterKey: char.rosterKey || char.canonicalId,
        character: char.local ? {
          level: char.local.level,
          ascension: char.local.ascension,
          talents: char.local.talents ? { ...char.local.talents } : null,
          equippedWeaponId: char.local.equippedWeaponId
        } : null,
        weapon: null
      };

      if (weapon && weapon.uuid) {
        // Find expected weapon state from reconciliation
        let expectedWep = null;
        if (char.weaponReconciliation?.equippedInstanceId === weapon.uuid) {
          expectedWep = char.weaponReconciliation.equippedInstance;
        } else if (char.weaponReconciliation?.candidateInstances) {
          expectedWep = char.weaponReconciliation.candidateInstances.find(w => w.id === weapon.uuid);
        }
        if (expectedWep) {
          expectedState.weapon = {
            uuid: weapon.uuid,
            weapon_id: expectedWep.weapon_id,
            level: expectedWep.level,
            ascension: expectedWep.ascension,
            currentRefinement: expectedWep.currentRefinement,
            assignedTo: expectedWep.assignedTo
          };
        }
      }

      plan.characters.push({
        hoyolabId: char.hoyolabId,
        rosterKey: char.rosterKey || char.canonicalId,
        isNew: char.status === 'new',
        fields,
        weapon,
        hoyolab: char.hoyolab,
        expectedState
      });
    }
  }

  if (selectedDerivedTravelers && reconciliationResult) {
    const activeTraveler = reconciliationResult.characters.find(c => c.rosterKey?.startsWith('Traveler '));
    // The active traveler doesn't strictly need to be selected in `selectedChars` for derivation,
    // but the HoYoLAB record itself must be present to copy level/ascension.
    if (activeTraveler && Object.keys(selectedDerivedTravelers).some(k => selectedDerivedTravelers[k])) {
      const activeElement = activeTraveler.rosterKey.replace('Traveler ', '');
      for (const [elem, selected] of Object.entries(selectedDerivedTravelers)) {
        if (selected && elem !== activeElement) {
          plan.derivedTravelerVariants.push({
            rosterKey: `Traveler ${elem}`,
            sourceTravelerKey: activeTraveler.rosterKey,
            expectedState: {
              rosterKey: activeTraveler.rosterKey,
              character: activeTraveler.local ? {
                level: activeTraveler.local.level,
                ascension: activeTraveler.local.ascension
              } : null
            },
            sourceRemoteLevel: activeTraveler.hoyolab.level,
            sourceRemoteAscension: activeTraveler.hoyolab.ascension,
            fields: {
              level: activeTraveler.hoyolab.level,
              ascension: activeTraveler.hoyolab.ascension
            }
          });
        }
      }
    }
  }

  return plan;
}

/**
 * Applies the validated HoYoLAB sync plan to the existing state.
 * Returns { roster, trackedWeapons, result }
 */
export function applyHoyolabPlanToState({ roster, trackedWeapons, plan, uuidFactory = () => crypto.randomUUID() }) {
  const nextRoster = { ...roster };
  const nextWeapons = [...trackedWeapons];

  const result = {
    charactersAdded: 0,
    charactersUpdated: 0,
    charactersFieldsUpdated: 0,
    weaponsCreated: 0,
    weaponsUpdatedOrReassigned: 0,
    travelerVariantsAdded: 0,
    skipped: 0,
    conflicts: []
  };

  if (!plan || !plan.characters) {
    return { roster: nextRoster, trackedWeapons: nextWeapons, result };
  }

  // Helper to resolve traveler's shared weapon logic
  const getTravelerAwareWeaponId = (weaps, rosterKey) => {
    if (rosterKey.startsWith('Traveler ')) {
      const w = weaps.find(w => w.assignedTo && w.assignedTo.startsWith('Traveler '));
      return w ? w.id : null;
    }
    const w = weaps.find(w => w.assignedTo === rosterKey);
    return w ? w.id : null;
  };

  const unassignWeapon = (weaponId) => {
    const wIndex = nextWeapons.findIndex(w => w.id === weaponId);
    if (wIndex !== -1) {
      if (nextWeapons[wIndex].assignedTo !== null) {
        affectedExistingWeaponIds.add(weaponId);
      }
      nextWeapons[wIndex] = { ...nextWeapons[wIndex], assignedTo: null };
    }
  };

  const assignWeapon = (weaponId, rosterKey) => {
    const wIndex = nextWeapons.findIndex(w => w.id === weaponId);
    if (wIndex !== -1) {
      if (nextWeapons[wIndex].assignedTo !== rosterKey) {
        affectedExistingWeaponIds.add(weaponId);
      }
      nextWeapons[wIndex] = { ...nextWeapons[wIndex], assignedTo: rosterKey };
    }
  };

  const affectedExistingWeaponIds = new Set();

  for (const instruction of plan.characters) {
    const { rosterKey, isNew, fields, weapon, hoyolab } = instruction;

    // We optionally keep constellation/friendship
    const extraFields = {};
    if (hoyolab && typeof hoyolab.constellation === 'number') {
      extraFields.constellation = hoyolab.constellation;
    }
    if (hoyolab && typeof hoyolab.friendship === 'number') {
      extraFields.friendship = hoyolab.friendship;
    }

    if (isNew) {
      // Create new character
      const newChar = {
        level: fields.level ?? 1,
        ascension: fields.ascension ?? 0,
        targetLevel: 90,
        targetAscension: 6,
        talents: {
          normal: fields.normal ?? 1,
          skill: fields.skill ?? 1,
          burst: fields.burst ?? 1
        },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        tracked: true,
        equippedWeaponId: null, // Will be set later
        ...extraFields
      };

      nextRoster[rosterKey] = newChar;
      recalculateCharacterCosts(rosterKey, nextRoster[rosterKey]);
      result.charactersAdded++;
    } else {
      // Update existing character
      if (Object.keys(fields).length > 0 || Object.keys(extraFields).length > 0) {
        const existing = nextRoster[rosterKey];
        const nextChar = {
          ...existing,
          ...extraFields
        };

        let actuallyChanged = false;

        // Check extra fields
        if (extraFields.constellation !== undefined && existing.constellation !== extraFields.constellation) actuallyChanged = true;
        if (extraFields.friendship !== undefined && existing.friendship !== extraFields.friendship) actuallyChanged = true;

        if ('level' in fields && existing.level !== fields.level) { nextChar.level = fields.level; actuallyChanged = true; }
        if ('ascension' in fields && existing.ascension !== fields.ascension) { nextChar.ascension = fields.ascension; actuallyChanged = true; }

        if ('normal' in fields || 'skill' in fields || 'burst' in fields) {
          const tNorm = fields.normal ?? existing.talents?.normal ?? 1;
          const tSkill = fields.skill ?? existing.talents?.skill ?? 1;
          const tBurst = fields.burst ?? existing.talents?.burst ?? 1;
          if (existing.talents?.normal !== tNorm || existing.talents?.skill !== tSkill || existing.talents?.burst !== tBurst) {
            nextChar.talents = {
              ...existing.talents,
              normal: tNorm,
              skill: tSkill,
              burst: tBurst
            };
            actuallyChanged = true;
          }
        }

        if (actuallyChanged) {
          nextRoster[rosterKey] = nextChar;
          recalculateCharacterCosts(rosterKey, nextRoster[rosterKey]);
          result.charactersUpdated++;
          result.characterFieldsUpdated += Object.keys(fields).length;
        }
      }
    }

    // Traveler Sync
    if (rosterKey.startsWith('Traveler ')) {
      syncTravelerCurrentProgression(nextRoster, rosterKey);
    }

    // Handle Weapon
    if (weapon) {
      let finalWeaponId = null;

      if (weapon.action === 'create') {
        finalWeaponId = uuidFactory();
        const targetRefinement = Math.max(weapon.refinement || 1, 1); // targetRefinement shouldn't be lower
        const newWep = {
          id: finalWeaponId,
          weapon_id: weapon.weapon_id,
          weaponName: weapon.name,
          level: weapon.level || 1,
          ascension: weapon.ascension || 0,
          currentRefinement: weapon.refinement || 1,
          targetLevel: 90,
          targetAscension: 6,
          targetRefinement: targetRefinement,
          hasEventBonus: false,
          assignedTo: rosterKey,
          createdAt: Date.now()
        };
        nextWeapons.push(newWep);
        result.weaponsCreated++;
      } else if (weapon.action === 'assign' && weapon.uuid) {
        finalWeaponId = weapon.uuid;
        const wIndex = nextWeapons.findIndex(w => w.id === weapon.uuid);
        if (wIndex !== -1) {
          const oldAssignedTo = nextWeapons[wIndex].assignedTo;
          let updated = false;

          const updatedWeapon = { ...nextWeapons[wIndex] };
          if (weapon.updateFields) {
            if ('level' in weapon.updateFields) { updatedWeapon.level = weapon.updateFields.level; updated = true; }
            if ('ascension' in weapon.updateFields) { updatedWeapon.ascension = weapon.updateFields.ascension; updated = true; }
            if ('refinement' in weapon.updateFields) { updatedWeapon.currentRefinement = weapon.updateFields.refinement; updated = true; }
          }

          if (oldAssignedTo !== rosterKey) {
            // Need to change assignment
            updatedWeapon.assignedTo = rosterKey;
            affectedExistingWeaponIds.add(weapon.uuid);
          }

          nextWeapons[wIndex] = updatedWeapon;
          if (updated) {
            affectedExistingWeaponIds.add(weapon.uuid);
          }
        }
      }

      // Now set equippedWeaponId on the character safely
      if (finalWeaponId) {
        // Find existing assigned weapon (using traveler semantics if necessary)
        const oldWeaponId = getTravelerAwareWeaponId(nextWeapons, rosterKey);

        if (oldWeaponId && oldWeaponId !== finalWeaponId) {
          unassignWeapon(oldWeaponId);
        }

        // For Traveler, we don't store equippedWeaponId directly on the variant to avoid desync
        if (!rosterKey.startsWith('Traveler ')) {
          nextRoster[rosterKey].equippedWeaponId = finalWeaponId;
        }
        assignWeapon(finalWeaponId, rosterKey);
      }
    }
  }

  if (plan.derivedTravelerVariants) {
    for (const instruction of plan.derivedTravelerVariants) {
      const { rosterKey, fields } = instruction;

      // Idempotency: if it already exists, do not overwrite/reset
      if (nextRoster[rosterKey]) continue;

      nextRoster[rosterKey] = {
        level: fields.level ?? 1,
        ascension: fields.ascension ?? 0,
        targetLevel: 90,
        targetAscension: 6,
        talents: {
          normal: 1,
          skill: 1,
          burst: 1
        },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        tracked: true,
        equippedWeaponId: null
      };

      recalculateCharacterCosts(rosterKey, nextRoster[rosterKey]);
      result.travelerVariantsAdded++;
    }
  }

  result.weaponsUpdatedOrReassigned = affectedExistingWeaponIds.size;

  return { roster: nextRoster, trackedWeapons: nextWeapons, result };
}
