import { describe, it, expect } from 'vitest';
import { applyHoyolabPlanToState, validateHoyolabApplyPlan, buildHoyolabApplyPlan } from './hoyolabSyncApply';

describe('hoyolabSyncApply', () => {
  describe('CHARACTER APPLY', () => {
    it('applies new character with exact current fields, preserves default targets', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao',
          isNew: true,
          fields: { level: 80, ascension: 5, normal: 8, skill: 8, burst: 8 },
          expectedState: null
        }]
      };
      const res = applyHoyolabPlanToState({ roster: {}, trackedWeapons: [], plan });
      const huTao = res.roster['Hu Tao'];
      expect(huTao.level).toBe(80);
      expect(huTao.ascension).toBe(5);
      expect(huTao.talents).toEqual({ normal: 8, skill: 8, burst: 8 });
      expect(huTao.targetLevel).toBe(90);
      expect(huTao.targetAscension).toBe(6);
      expect(huTao.targetTalents).toEqual({ normal: 10, skill: 10, burst: 10 });
      expect(huTao.tracked).toBe(true);
      expect(huTao.unknownRemoteField).toBeUndefined();
    });

    it('updates existing character while preserving targets and tracked flag', () => {
      const roster = {
        'Hu Tao': {
          level: 80, ascension: 5, targetLevel: 80, targetAscension: 5,
          talents: { normal: 8, skill: 8, burst: 8 }, targetTalents: { normal: 9, skill: 9, burst: 9 },
          tracked: false
        }
      };
      const plan = {
        characters: [{ rosterKey: 'Hu Tao', isNew: false, fields: { level: 90, ascension: 6 } }]
      };
      const res = applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });
      const huTao = res.roster['Hu Tao'];
      expect(huTao.level).toBe(90);
      expect(huTao.ascension).toBe(6);
      expect(huTao.targetLevel).toBe(80);
      expect(huTao.targetAscension).toBe(5);
      expect(huTao.tracked).toBe(false);
    });
  });

  describe('FIELD DIRECTION', () => {
    it('remote-ahead applies and local-ahead stays local by default', () => {
      // Tested via buildHoyolabApplyPlan logic
      const reconciliationResult = {
        characters: [{
          status: 'update', hoyolabId: '1', canonicalId: 'Char1',
          changes: {
            level: { direction: 'remote-ahead', remote: 90, local: 80 },
            ascension: { direction: 'local-ahead', remote: 5, local: 6 }
          }
        }]
      };
      const plan = buildHoyolabApplyPlan({
        reconciliationResult, selectedChars: { '1': true }, weaponChoices: {}, localAheadOverrides: {}
      });
      expect(plan.characters[0].fields.level).toBe(90);
      expect(plan.characters[0].fields.ascension).toBeUndefined(); // kept local
    });

    it('explicit local-ahead override applies remote value', () => {
      const reconciliationResult = {
        characters: [{
          status: 'update', hoyolabId: '1', canonicalId: 'Char1',
          changes: { ascension: { direction: 'local-ahead', remote: 5, local: 6 } }
        }]
      };
      const plan = buildHoyolabApplyPlan({
        reconciliationResult, selectedChars: { '1': true }, weaponChoices: {},
        localAheadOverrides: { '1': { ascension: true } }
      });
      expect(plan.characters[0].fields.ascension).toBe(5);
    });
  });

  describe('TRAVELER', () => {
    it('syncs shared progression but isolates talents and targets', () => {
      const roster = {
        'Traveler Anemo': {
          level: 80, ascension: 5, targetLevel: 90, targetAscension: 6,
          talents: { normal: 8, skill: 8, burst: 8 }, targetTalents: { normal: 9, skill: 9, burst: 9 }
        },
        'Traveler Geo': {
          level: 80, ascension: 5, targetLevel: 80, targetAscension: 5,
          talents: { normal: 1, skill: 1, burst: 1 }, targetTalents: { normal: 1, skill: 1, burst: 1 }
        }
      };
      const plan = { characters: [{ rosterKey: 'Traveler Anemo', isNew: false, fields: { level: 90, ascension: 6, normal: 9 } }] };
      const res = applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });

      const anemo = res.roster['Traveler Anemo'];
      const geo = res.roster['Traveler Geo'];

      // Active updates
      expect(anemo.level).toBe(90);
      expect(anemo.ascension).toBe(6);
      expect(anemo.talents.normal).toBe(9);

      // Other receives current
      expect(geo.level).toBe(90);
      expect(geo.ascension).toBe(6);

      // Other targets and talents preserved
      expect(geo.targetLevel).toBe(80);
      expect(geo.targetAscension).toBe(5);
      expect(geo.targetTalents.normal).toBe(1);
      expect(geo.talents.normal).toBe(1);
    });

    it('new Traveler import does NOT auto-create other elements', () => {
      const plan = { characters: [{ rosterKey: 'Traveler Anemo', isNew: true, fields: { level: 90 } }] };
      const res = applyHoyolabPlanToState({ roster: {}, trackedWeapons: [], plan });
      expect(res.roster['Traveler Anemo']).toBeDefined();
      expect(res.roster['Traveler Geo']).toBeUndefined();
    });
  });

  describe('WEAPON CREATE', () => {
    it('creates exactly one UUID with proper fields, assigns it, and keeps equivalent apply idempotent', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: true, fields: {},
          weapon: { action: 'create', weapon_id: 'w1', name: 'W1', level: 80, ascension: 5, refinement: 2 }
        }]
      };
      const uuidFactory = () => 'test-uuid';
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': { equippedWeaponId: null } }, trackedWeapons: [], plan, uuidFactory });

      expect(res.result.weaponsCreated).toBe(1);
      const w = res.trackedWeapons[0];
      expect(w.id).toBe('test-uuid');
      expect(w.level).toBe(80);
      expect(w.ascension).toBe(5);
      expect(w.currentRefinement).toBe(2);
      expect(w.targetLevel).toBe(90);
      expect(w.targetAscension).toBe(6);
      expect(w.targetRefinement).toBe(2);
      expect(w.assignedTo).toBe('Hu Tao');
      expect(res.roster['Hu Tao'].equippedWeaponId).toBe('test-uuid');
    });
  });

  describe('EXISTING WEAPON', () => {
    it('matched instance current fields update, targets preserved, replacing unassigns old instance', () => {
      const roster = { 'Hu Tao': { equippedWeaponId: 'old-uuid' } };
      const trackedWeapons = [
        { id: 'old-uuid', assignedTo: 'Hu Tao' },
        { id: 'new-uuid', level: 80, targetLevel: 80, assignedTo: null }
      ];
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {},
          weapon: { action: 'assign', uuid: 'new-uuid', updateFields: { level: 90 } }
        }]
      };
      const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

      expect(res.trackedWeapons.find(w => w.id === 'old-uuid').assignedTo).toBeNull();
      const newWep = res.trackedWeapons.find(w => w.id === 'new-uuid');
      expect(newWep.assignedTo).toBe('Hu Tao');
      expect(newWep.level).toBe(90);
      expect(newWep.targetLevel).toBe(80);
    });
  });

  describe('STALE PREVIEW', () => {
    it('rejects stale instruction when character progression changed after preview', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: { level: 90 },
          expectedState: { rosterKey: 'Hu Tao', character: { level: 80, ascension: 5, equippedWeaponId: null } }
        }]
      };
      const roster = { 'Hu Tao': { level: 85, ascension: 5, equippedWeaponId: null } }; // progression changed
      const validation = validateHoyolabApplyPlan(plan, { roster, trackedWeapons: [] });
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('progression changed locally');
    });

    it('rejects stale instruction when character talent changed after preview', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: { level: 90 },
          expectedState: { rosterKey: 'Hu Tao', character: { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: null } }
        }]
      };
      const roster = { 'Hu Tao': { level: 80, ascension: 5, talents: { normal: 9, skill: 8, burst: 8 }, equippedWeaponId: null } }; // talent changed
      const validation = validateHoyolabApplyPlan(plan, { roster, trackedWeapons: [] });
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('talents changed locally');
    });

    it('rejects stale instruction when weapon ascension changed after preview', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {},
          expectedState: {
            rosterKey: 'Hu Tao',
            character: { level: 80, ascension: 5, equippedWeaponId: 'w1' },
            weapon: { uuid: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 5, currentRefinement: 1, assignedTo: 'Hu Tao' }
          },
          weapon: { uuid: 'w1', action: 'assign' }
        }]
      };
      const roster = { 'Hu Tao': { level: 80, ascension: 5, equippedWeaponId: 'w1' } };
      const trackedWeapons = [{ id: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 6, currentRefinement: 1, assignedTo: 'Hu Tao' }]; // ascension changed
      const validation = validateHoyolabApplyPlan(plan, { roster, trackedWeapons });
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('ascension changed locally');
    });

    it('rejects stale instruction when weapon refinement changed after preview', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {},
          expectedState: {
            rosterKey: 'Hu Tao',
            character: { level: 80, ascension: 5, equippedWeaponId: 'w1' },
            weapon: { uuid: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 5, currentRefinement: 1, assignedTo: 'Hu Tao' }
          },
          weapon: { uuid: 'w1', action: 'assign' }
        }]
      };
      const roster = { 'Hu Tao': { level: 80, ascension: 5, equippedWeaponId: 'w1' } };
      const trackedWeapons = [{ id: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 5, currentRefinement: 2, assignedTo: 'Hu Tao' }]; // refinement changed
      const validation = validateHoyolabApplyPlan(plan, { roster, trackedWeapons });
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('refinement changed locally');
    });

    it('rejects stale instruction when weapon assignment changed after preview', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {},
          expectedState: {
            rosterKey: 'Hu Tao',
            character: { level: 80, ascension: 5, equippedWeaponId: 'w1' },
            weapon: { uuid: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 5, currentRefinement: 1, assignedTo: 'Hu Tao' }
          },
          weapon: { uuid: 'w1', action: 'assign' }
        }]
      };
      const roster = { 'Hu Tao': { level: 80, ascension: 5, equippedWeaponId: 'w1' } };
      const trackedWeapons = [{ id: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 5, currentRefinement: 1, assignedTo: 'Zhongli' }]; // assignment changed
      const validation = validateHoyolabApplyPlan(plan, { roster, trackedWeapons });
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('assignment changed locally');
    });

    it('should NOT invalidate when unrelated target field changed after preview', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: { level: 90 },
          expectedState: { rosterKey: 'Hu Tao', character: { level: 80, ascension: 5, equippedWeaponId: null } }
        }]
      };
      const roster = { 'Hu Tao': { level: 80, ascension: 5, targetLevel: 80, equippedWeaponId: null } }; // targetLevel changed, but that's safe
      const validation = validateHoyolabApplyPlan(plan, { roster, trackedWeapons: [] });
      expect(validation.valid).toBe(true);
    });
  });

  describe('PHASE C REGRESSIONS', () => {
    it('existing character plan has expectedState (Alhaitham bug)', () => {
      const reconciliationResult = {
        characters: [{
          status: 'update', hoyolabId: '1', canonicalId: 'Alhaitham', rosterKey: 'Alhaitham',
          hoyolab: { level: 90, ascension: 6, talents: { normal: 9, skill: 9, burst: 9 } },
          local: { level: 1, ascension: 0, talents: { normal: 1, skill: 1, burst: 1 }, equippedWeaponId: null },
          changes: { level: { direction: 'remote-ahead', remote: 90, local: 1 } }
        }]
      };
      const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars: { '1': true }, weaponChoices: {}, localAheadOverrides: {} });
      expect(plan.characters[0].expectedState).toBeDefined();
      expect(plan.characters[0].expectedState.character.level).toBe(1);
    });

    it('new char + would-create defaults to weapon create and applies correctly', () => {
      const reconciliationResult = {
        characters: [{
          status: 'new', hoyolabId: '2', canonicalId: 'Kamisato Ayaka', rosterKey: 'Kamisato Ayaka',
          hoyolab: { level: 90, ascension: 6, weapon: { level: 90, ascension: 6, refinement: 3 } },
          weaponReconciliation: { status: 'would-create', canonicalId: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi' }
        }]
      };
      const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars: { '2': true }, weaponChoices: {}, localAheadOverrides: {} });
      expect(plan.characters[0].weapon).toEqual({ action: 'create', weapon_id: 'amenomakageuchi', name: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 3 });

      const res = applyHoyolabPlanToState({ roster: {}, trackedWeapons: [], plan, uuidFactory: () => 'uuid-new' });
      expect(res.roster['Kamisato Ayaka'].equippedWeaponId).toBe('uuid-new');
      expect(res.trackedWeapons[0].id).toBe('uuid-new');
      expect(res.trackedWeapons[0].level).toBe(90);
    });

    it('buildHoyolabApplyPlan derives Traveler level/ascension strictly from remote, even if local differs or active is unselected', () => {
      const reconciliationResult = {
        characters: [{
          status: 'update', hoyolabId: '99', canonicalId: 'Traveler', rosterKey: 'Traveler Cryo',
          hoyolab: { level: 80, ascension: 6, talents: { normal: 6, skill: 6, burst: 6 } }, // REMOTE Lv80 A6
          local: { level: 70, ascension: 5, talents: { normal: 6, skill: 6, burst: 6 } }, // LOCAL Lv70 A5
          changes: { level: { direction: 'remote-ahead', remote: 80, local: 70 } }
        }]
      };
      // Select derived Traveler Geo, but DO NOT select the active Traveler Cryo for update!
      const plan = buildHoyolabApplyPlan({
        reconciliationResult,
        selectedChars: {}, // Active Traveler NOT selected
        weaponChoices: {},
        localAheadOverrides: {},
        selectedDerivedTravelers: { 'Geo': true } // Derived Variant SELECTED
      });

      expect(plan.characters.length).toBe(0); // No regular char updates
      expect(plan.derivedTravelerVariants.length).toBe(1);

      const geoInstruction = plan.derivedTravelerVariants[0];
      expect(geoInstruction.rosterKey).toBe('Traveler Geo');
      expect(geoInstruction.sourceRemoteLevel).toBe(80);
      expect(geoInstruction.sourceRemoteAscension).toBe(6);
      expect(geoInstruction.fields.level).toBe(80); // Strict remote derivation
      expect(geoInstruction.fields.ascension).toBe(6);
    });

    it('unchanged character + would-create supports weapon-only apply', () => {
      const reconciliationResult = {
        characters: [{
          status: 'unchanged', hoyolabId: '3', canonicalId: 'Kamisato Ayaka', rosterKey: 'Kamisato Ayaka',
          hoyolab: { level: 90, weapon: { level: 90 } },
          local: { level: 90, equippedWeaponId: null },
          weaponReconciliation: { status: 'would-create', canonicalId: 'amenomakageuchi' }
        }]
      };
      const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars: { '3': true }, weaponChoices: {}, localAheadOverrides: {} });
      expect(plan.characters[0].weapon.action).toBe('create');
      expect(Object.keys(plan.characters[0].fields).length).toBe(0);

      const res = applyHoyolabPlanToState({ roster: { 'Kamisato Ayaka': { level: 90, targetLevel: 90 } }, trackedWeapons: [], plan, uuidFactory: () => 'w-uuid' });
      expect(res.result.weaponsCreated).toBe(1);
      expect(res.result.charactersUpdated).toBe(0); // Only weapon changed
      expect(res.roster['Kamisato Ayaka'].equippedWeaponId).toBe('w-uuid');
      expect(res.roster['Kamisato Ayaka'].targetLevel).toBe(90);
    });

    it('Use Existing candidate assigns instance and updates fields', () => {
      const reconciliationResult = {
        characters: [{
          status: 'update', hoyolabId: '4', canonicalId: 'Wanderer', rosterKey: 'Wanderer',
          hoyolab: { level: 90, weapon: { level: 90, ascension: 6, refinement: 5 } },
          local: { level: 1, equippedWeaponId: null },
          weaponReconciliation: {
            status: 'suggested-instance',
            candidates: [{ id: 'w1', level: 1, ascension: 0, currentRefinement: 1 }]
          }
        }]
      };
      const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars: { '4': true }, weaponChoices: { '4': 'assign|w1' }, localAheadOverrides: {} });
      expect(plan.characters[0].weapon).toEqual({
        action: 'assign', uuid: 'w1', updateFields: { level: 90, ascension: 6, refinement: 5 }
      });

      const trackedWeapons = [{ id: 'w1', level: 1, ascension: 0, currentRefinement: 1, targetLevel: 90 }];
      const res = applyHoyolabPlanToState({ roster: { 'Wanderer': {} }, trackedWeapons, plan });
      expect(res.trackedWeapons[0].level).toBe(90);
      expect(res.trackedWeapons[0].assignedTo).toBe('Wanderer');
      expect(res.trackedWeapons[0].targetLevel).toBe(90); // Preserved targets
    });

    it('explicit Create New produces a second copy while retaining old manual copy', () => {
      const reconciliationResult = {
        characters: [{
          status: 'update', hoyolabId: '5', canonicalId: 'Wanderer', rosterKey: 'Wanderer',
          hoyolab: { level: 90, weapon: { level: 90, ascension: 6, refinement: 5 } },
          weaponReconciliation: { canonicalId: 'fruitof', candidates: [{ id: 'w1', level: 1 }] }
        }]
      };
      const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars: { '5': true }, weaponChoices: { '5': 'create' }, localAheadOverrides: {} });
      expect(plan.characters[0].weapon.action).toBe('create');

      const trackedWeapons = [{ id: 'w1', level: 1, assignedTo: null }];
      const res = applyHoyolabPlanToState({ roster: { 'Wanderer': {} }, trackedWeapons, plan, uuidFactory: () => 'w2' });
      expect(res.trackedWeapons.length).toBe(2);
      expect(res.trackedWeapons.find(w => w.id === 'w1').level).toBe(1); // untouched
      expect(res.trackedWeapons.find(w => w.id === 'w2').level).toBe(90); // new copy
    });

    it('local-ahead weapon field stays local by default', () => {
      const reconciliationResult = {
        characters: [{
          status: 'unchanged', hoyolabId: '6',
          hoyolab: { weapon: { level: 80 } },
          weaponReconciliation: {
            status: 'suggested-instance',
            candidates: [{ id: 'w1', level: 90 }] // local-ahead
          }
        }]
      };
      const plan = buildHoyolabApplyPlan({ reconciliationResult, selectedChars: { '6': true }, weaponChoices: { '6': 'assign|w1' }, localAheadOverrides: {} });
      expect(plan.characters[0].weapon.updateFields.level).toBeUndefined(); // kept local
    });

    describe('SAME WEAPON RECONCILIATION & RESOLUTION', () => {
      it('matched-instance defaults to update-existing and preserves targets when remote exceeds target', () => {
        const reconciliationResult = {
          characters: [{
            status: 'update',
            hoyolabId: 'ayaka-1',
            canonicalId: 'Kamisato Ayaka',
            rosterKey: 'Kamisato Ayaka',
            hoyolab: {
              level: 90,
              weapon: { name: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 5 }
            },
            local: { level: 90, equippedWeaponId: 'amenoma-inst-1' },
            weaponReconciliation: {
              status: 'matched-instance',
              instance: {
                id: 'amenoma-inst-1',
                weapon_id: 'amenomakageuchi',
                level: 80,
                ascension: 5,
                currentRefinement: 3,
                targetLevel: 80,
                targetAscension: 5,
                targetRefinement: 3,
                assignedTo: 'Kamisato Ayaka'
              },
              hasWeaponUpdate: true,
              changes: {
                level: { local: 80, remote: 90 },
                ascension: { local: 5, remote: 6 },
                refinement: { local: 3, remote: 5 }
              }
            }
          }]
        };

        // 1. Plan built with default (empty weaponChoices)
        const plan = buildHoyolabApplyPlan({
          reconciliationResult,
          selectedChars: { 'ayaka-1': true },
          weaponChoices: {},
          localAheadOverrides: {}
        });

        expect(plan.characters[0].weapon).toEqual({
          action: 'assign',
          uuid: 'amenoma-inst-1',
          updateFields: { level: 90, ascension: 6, refinement: 5 }
        });

        // 2. Apply plan
        const trackedWeapons = [
          {
            id: 'amenoma-inst-1',
            weapon_id: 'amenomakageuchi',
            level: 80,
            ascension: 5,
            currentRefinement: 3,
            targetLevel: 80,
            targetAscension: 5,
            targetRefinement: 3,
            assignedTo: 'Kamisato Ayaka'
          }
        ];
        const roster = {
          'Kamisato Ayaka': {
            level: 90,
            ascension: 6,
            equippedWeaponId: 'amenoma-inst-1'
          }
        };

        const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

        const updatedWep = res.trackedWeapons.find(w => w.id === 'amenoma-inst-1');
        expect(updatedWep.level).toBe(90);
        expect(updatedWep.ascension).toBe(6);
        expect(updatedWep.currentRefinement).toBe(5);
        // Targets preserved even though remote exceeds target
        expect(updatedWep.targetLevel).toBe(80);
        expect(updatedWep.targetAscension).toBe(5);
        expect(updatedWep.targetRefinement).toBe(3);
        // Assignment preserved
        expect(updatedWep.assignedTo).toBe('Kamisato Ayaka');
        expect(res.roster['Kamisato Ayaka'].equippedWeaponId).toBe('amenoma-inst-1');
        expect(res.result.weaponsCreated).toBe(0);
        expect(res.result.weaponsUpdatedOrReassigned).toBe(1);
      });

      it('isolates duplicate copies: only the assigned instance is updated', () => {
        const reconciliationResult = {
          characters: [{
            status: 'update',
            hoyolabId: 'ayaka-1',
            canonicalId: 'Kamisato Ayaka',
            rosterKey: 'Kamisato Ayaka',
            hoyolab: {
              level: 90,
              weapon: { name: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 5 }
            },
            local: { level: 90, equippedWeaponId: 'amenoma-copy-2' },
            weaponReconciliation: {
              status: 'matched-instance',
              instance: {
                id: 'amenoma-copy-2',
                weapon_id: 'amenomakageuchi',
                level: 80,
                ascension: 5,
                currentRefinement: 1,
                assignedTo: 'Kamisato Ayaka'
              },
              hasWeaponUpdate: true,
              changes: {
                level: { local: 80, remote: 90 },
                ascension: { local: 5, remote: 6 }
              }
            }
          }]
        };

        const plan = buildHoyolabApplyPlan({
          reconciliationResult,
          selectedChars: { 'ayaka-1': true },
          weaponChoices: { 'ayaka-1': 'update-existing' },
          localAheadOverrides: {}
        });

        const trackedWeapons = [
          {
            id: 'amenoma-copy-1',
            weapon_id: 'amenomakageuchi',
            level: 70,
            ascension: 4,
            currentRefinement: 1,
            assignedTo: 'Jean'
          },
          {
            id: 'amenoma-copy-2',
            weapon_id: 'amenomakageuchi',
            level: 80,
            ascension: 5,
            currentRefinement: 1,
            assignedTo: 'Kamisato Ayaka'
          }
        ];
        const roster = {
          'Kamisato Ayaka': { level: 90, equippedWeaponId: 'amenoma-copy-2' },
          'Jean': { level: 80, equippedWeaponId: 'amenoma-copy-1' }
        };

        const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

        const copy1 = res.trackedWeapons.find(w => w.id === 'amenoma-copy-1');
        const copy2 = res.trackedWeapons.find(w => w.id === 'amenoma-copy-2');

        // Copy 1 remains completely untouched
        expect(copy1.level).toBe(70);
        expect(copy1.ascension).toBe(4);
        expect(copy1.assignedTo).toBe('Jean');

        // Copy 2 updated
        expect(copy2.level).toBe(90);
        expect(copy2.ascension).toBe(6);
        expect(copy2.assignedTo).toBe('Kamisato Ayaka');
      });

      it('odette equipment-mismatch with ignore weapon applies character update safely', () => {
        const reconciliationResult = {
          characters: [{
            status: 'update',
            hoyolabId: 'odette-1',
            canonicalId: 'Odette',
            rosterKey: 'Odette',
            hoyolab: {
              level: 90,
              talents: { normal: 9, skill: 9, burst: 9 },
              weapon: { name: 'Athame Artis', level: 90, ascension: 6, refinement: 1 }
            },
            local: {
              level: 80,
              talents: { normal: 8, skill: 8, burst: 8 },
              equippedWeaponId: 'finale-inst-1'
            },
            changes: {
              level: { direction: 'remote-ahead', local: 80, remote: 90 },
              talents: {
                normal: { direction: 'remote-ahead', local: 8, remote: 9 }
              }
            },
            weaponReconciliation: {
              status: 'equipment-mismatch',
              remoteWeapon: { name: 'Athame Artis', level: 90 },
              localInstance: { id: 'finale-inst-1', weapon_id: 'finaleofthedeep', name: 'Finale of the Deep' }
            }
          }]
        };

        // User chose 'ignore' (Leave Weapon Unchanged)
        const plan = buildHoyolabApplyPlan({
          reconciliationResult,
          selectedChars: { 'odette-1': true },
          weaponChoices: { 'odette-1': 'ignore' },
          localAheadOverrides: {}
        });

        // Weapon action should be omitted / none (null)
        expect(plan.characters[0].weapon).toBeNull();
        expect(plan.characters[0].fields.level).toBe(90);

        const trackedWeapons = [
          {
            id: 'finale-inst-1',
            weapon_id: 'finaleofthedeep',
            level: 80,
            assignedTo: 'Odette'
          }
        ];
        const roster = {
          'Odette': {
            level: 80,
            talents: { normal: 8, skill: 8, burst: 8 },
            equippedWeaponId: 'finale-inst-1'
          }
        };

        const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

        expect(res.roster['Odette'].level).toBe(90);
        expect(res.roster['Odette'].talents.normal).toBe(9);
        expect(res.roster['Odette'].equippedWeaponId).toBe('finale-inst-1');
        // Weapon remains unchanged
        expect(res.trackedWeapons[0].id).toBe('finale-inst-1');
        expect(res.trackedWeapons[0].level).toBe(80);
        expect(res.result.weaponsCreated).toBe(0);
        expect(res.result.weaponsUpdatedOrReassigned).toBe(0);
      });
    });
  });

  describe('RESULT METRIC SEMANTICS', () => {
    it('A. unchanged existing character + would-create weapon', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {}, weapon: { action: 'create', weapon_id: 'staffofhoma' }
        }]
      };
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': { level: 90 } }, trackedWeapons: [], plan, uuidFactory: () => 'w1' });
      expect(res.result.charactersUpdated).toBe(0);
      expect(res.result.weaponsCreated).toBe(1);
    });

    it('B. unchanged existing character + use-existing candidate whose assignment and stats all change', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w1', updateFields: { level: 90 } }
        }]
      };
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': { level: 90 } }, trackedWeapons: [{ id: 'w1', level: 80, assignedTo: null }], plan });
      expect(res.result.charactersUpdated).toBe(0);
      expect(res.result.weaponsUpdatedOrReassigned).toBe(1);
    });

    it('C. existing character progression update + create weapon', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: { level: 90 }, weapon: { action: 'create', weapon_id: 'staffofhoma' }
        }]
      };
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': { level: 80 } }, trackedWeapons: [], plan, uuidFactory: () => 'w1' });
      expect(res.result.charactersUpdated).toBe(1);
      expect(res.result.weaponsCreated).toBe(1);
      expect(res.result.weaponsUpdatedOrReassigned).toBe(0);
    });

    it('D. existing weapon with only stats changed', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w1', updateFields: { level: 90 } }
        }]
      };
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': { equippedWeaponId: 'w1' } }, trackedWeapons: [{ id: 'w1', level: 80, assignedTo: 'Hu Tao' }], plan });
      expect(res.result.charactersUpdated).toBe(0);
      expect(res.result.weaponsUpdatedOrReassigned).toBe(1);
    });

    it('E. existing weapon with only assignment changed', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w1' }
        }]
      };
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': {} }, trackedWeapons: [{ id: 'w1', assignedTo: null }], plan });
      expect(res.result.charactersUpdated).toBe(0);
      expect(res.result.weaponsUpdatedOrReassigned).toBe(1);
    });

    it('F. existing weapon with assignment + level + ascension + refinement changed', () => {
      const plan = {
        characters: [{
          rosterKey: 'Hu Tao', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w1', updateFields: { level: 90, ascension: 6, refinement: 5 } }
        }]
      };
      const res = applyHoyolabPlanToState({ roster: { 'Hu Tao': {} }, trackedWeapons: [{ id: 'w1', level: 1, ascension: 0, currentRefinement: 1, assignedTo: null }], plan });
      expect(res.result.weaponsUpdatedOrReassigned).toBe(1);
    });

    it('G. two separate existing weapons affected', () => {
      const plan = {
        characters: [
          { rosterKey: 'Hu Tao', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w1', updateFields: { level: 90 } } },
          { rosterKey: 'Zhongli', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w2', updateFields: { level: 90 } } }
        ]
      };
      const res = applyHoyolabPlanToState({
        roster: { 'Hu Tao': { equippedWeaponId: 'w1' }, 'Zhongli': { equippedWeaponId: 'w2' } },
        trackedWeapons: [{ id: 'w1', level: 80, assignedTo: 'Hu Tao' }, { id: 'w2', level: 80, assignedTo: 'Zhongli' }],
        plan
      });
      expect(res.result.weaponsUpdatedOrReassigned).toBe(2);
    });
  });

  describe('ATOMICITY', () => {
    it('applies completely isolated nested copies (tested by nature of spread operator and validation)', () => {
      const roster = { 'Hu Tao': { level: 80 } };
      const plan = { characters: [{ rosterKey: 'Hu Tao', isNew: false, fields: { level: 90 } }] };
      applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });
      expect(roster['Hu Tao'].level).toBe(80); // Original untouched
    });

    it('guarantees transactional atomicity across the real Zustand set() hook', () => {
      // Simulate real Zustand behavior by creating a mock store API
      let state = {
        roster: {
          'ValidChar': { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: null },
          'InvalidChar': { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: null }
        },
        trackedWeapons: []
      };
      const set = (updater) => {
        const nextPartial = updater(state);
        // If updater returns state directly, it means abort (as implemented in slice)
        if (nextPartial !== state) {
          state = { ...state, ...nextPartial };
        }
      };

      const applyHoyolabSync = (plan) => {
        let finalResult = null;
        let errorToThrow = null;

        set((s) => {
          const validation = validateHoyolabApplyPlan(plan, s);
          if (!validation.valid) {
            errorToThrow = new Error(validation.reason || 'Apply plan validation failed.');
            return s; // No-op, aborts transaction cleanly
          }
          const { roster, trackedWeapons, result } = applyHoyolabPlanToState({
            roster: s.roster,
            trackedWeapons: s.trackedWeapons,
            plan,
            uuidFactory: () => 'test-uuid'
          });
          finalResult = result;
          return { roster, trackedWeapons };
        });

        if (errorToThrow) throw errorToThrow;
        return finalResult;
      };

      const plan = {
        characters: [
          {
            rosterKey: 'ValidChar', isNew: false, fields: { level: 90 },
            expectedState: { rosterKey: 'ValidChar', character: { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: null } }
          },
          {
            rosterKey: 'InvalidChar', isNew: false, fields: { level: 90 },
            expectedState: { rosterKey: 'InvalidChar', character: { level: 85, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: null } } // Expects 85, but current is 80
          }
        ]
      };

      const beforeState = JSON.parse(JSON.stringify(state));

      expect(() => {
        applyHoyolabSync(plan);
      }).toThrow('progression changed locally');

      // State MUST be completely pristine, no partial application of 'ValidChar'
      expect(state.roster).toEqual(beforeState.roster);
      expect(state.trackedWeapons).toEqual(beforeState.trackedWeapons);
    });
  });

  describe('IDEMPOTENCY', () => {
    it('reapplying the same plan twice generates 0 further updates', () => {
      const plan = { characters: [{ rosterKey: 'Hu Tao', isNew: false, fields: { level: 90 } }] };
      const roster = { 'Hu Tao': { level: 90 } };
      const res = applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });
      expect(res.result.charactersUpdated).toBe(0);
      expect(res.result.weaponsCreated).toBe(0);
    });
  });

  describe('DERIVED TRAVELER VARIANTS', () => {
    it('creates derived traveler variant correctly', () => {
      const roster = {
        'Traveler Cryo': { level: 80, ascension: 6, talents: { normal: 1, skill: 2, burst: 3 }, equippedWeaponId: null }
      };
      const plan = {
        characters: [],
        derivedTravelerVariants: [{
          rosterKey: 'Traveler Anemo',
          sourceTravelerKey: 'Traveler Cryo',
          sourceRemoteLevel: 80,
          sourceRemoteAscension: 6,
          expectedState: {
            rosterKey: 'Traveler Cryo',
            character: { level: 80, ascension: 6 }
          },
          fields: { level: 80, ascension: 6 }
        }]
      };

      const { valid } = validateHoyolabApplyPlan(plan, { roster, trackedWeapons: [] });
      expect(valid).toBe(true);

      const res = applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });

      // Should create new variant
      const anemo = res.roster['Traveler Anemo'];
      expect(anemo.level).toBe(80);
      expect(anemo.ascension).toBe(6);
      expect(anemo.talents).toEqual({ normal: 1, skill: 1, burst: 1 });
      expect(anemo.targetLevel).toBe(90);
      expect(anemo.targetAscension).toBe(6);
      expect(anemo.targetTalents).toEqual({ normal: 10, skill: 10, burst: 10 });
      expect(anemo.tracked).toBe(true);
      expect(anemo.equippedWeaponId).toBeNull(); // No weapon duplicated

      // Should not mutate existing source variant
      expect(res.roster['Traveler Cryo'].talents).toEqual({ normal: 1, skill: 2, burst: 3 });

      // Metric updated
      expect(res.result.travelerVariantsAdded).toBe(1);
    });

    it('creates derived traveler from remote even if active not selected for update', () => {
      // Local is Lv70, Remote is Lv80. User does NOT select active Traveler for update.
      const roster = {
        'Traveler Cryo': { level: 70, ascension: 5, talents: { normal: 1, skill: 2, burst: 3 }, equippedWeaponId: null }
      };
      const plan = {
        characters: [], // Empty because active Traveler wasn't selected
        derivedTravelerVariants: [{
          rosterKey: 'Traveler Geo',
          sourceTravelerKey: 'Traveler Cryo',
          sourceRemoteLevel: 80,
          sourceRemoteAscension: 6,
          expectedState: {
            rosterKey: 'Traveler Cryo',
            character: { level: 70, ascension: 5 }
          },
          fields: { level: 80, ascension: 6 }
        }]
      };

      const { valid } = validateHoyolabApplyPlan(plan, { roster, trackedWeapons: [] });
      expect(valid).toBe(true);

      const res = applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });

      // Derived variant uses REMOTE level/ascension
      const geo = res.roster['Traveler Geo'];
      expect(geo.level).toBe(80);
      expect(geo.ascension).toBe(6);
      expect(geo.talents).toEqual({ normal: 1, skill: 1, burst: 1 });

      // Active variant remains at local level since it wasn't updated
      expect(res.roster['Traveler Cryo'].level).toBe(70);
      expect(res.roster['Traveler Cryo'].ascension).toBe(5);
    });

    it('rejects derived traveler if source is stale', () => {
      const roster = {
        'Traveler Cryo': { level: 90, ascension: 6 } // Level changed locally
      };
      const plan = {
        characters: [],
        derivedTravelerVariants: [{
          rosterKey: 'Traveler Anemo',
          sourceRemoteLevel: 80,
          sourceRemoteAscension: 6,
          expectedState: {
            rosterKey: 'Traveler Cryo',
            character: { level: 80, ascension: 6 }
          },
          fields: { level: 80, ascension: 6 }
        }]
      };

      const { valid, reason } = validateHoyolabApplyPlan(plan, { roster, trackedWeapons: [] });
      expect(valid).toBe(false);
      expect(reason).toContain('progression changed locally');
    });

    it('idempotent derived creation', () => {
      const roster = {
        'Traveler Cryo': { level: 80, ascension: 6 },
        'Traveler Anemo': { level: 80, ascension: 6, talents: { normal: 6, skill: 6, burst: 6 }, targetLevel: 80 }
      };
      const plan = {
        characters: [],
        derivedTravelerVariants: [{
          rosterKey: 'Traveler Anemo',
          sourceRemoteLevel: 80,
          sourceRemoteAscension: 6,
          expectedState: {
            rosterKey: 'Traveler Cryo',
            character: { level: 80, ascension: 6 }
          },
          fields: { level: 80, ascension: 6 }
        }]
      };

      const res = applyHoyolabPlanToState({ roster, trackedWeapons: [], plan });

      const anemo = res.roster['Traveler Anemo'];
      expect(anemo.talents.normal).toBe(6); // Not reset to 1
      expect(anemo.targetLevel).toBe(80); // Not reset to 90
      expect(res.result.travelerVariantsAdded).toBe(0); // Not counted as added
    });
  });

  describe('STAGE C1.1: EXISTING-WEAPON REASSIGNMENT APPLY & CYCLES', () => {
    it('1. unique unassigned weapon reassignment: assigns UUID, unassigns old weapon, no instances created', () => {
      const roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'uuid-mistsplitter' }
      };
      const trackedWeapons = [
        { id: 'uuid-mistsplitter', weapon_id: 'mistsplitterreforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'uuid-amenoma', weapon_id: 'amenomakageuchi', level: 80, currentRefinement: 1, assignedTo: null }
      ];

      const plan = {
        characters: [{
          rosterKey: 'Kamisato Ayaka',
          isNew: false,
          fields: {},
          weapon: {
            action: 'assign',
            uuid: 'uuid-amenoma',
            updateFields: { level: 90, refinement: 5 }
          }
        }]
      };

      const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

      expect(res.trackedWeapons.length).toBe(2);
      expect(res.result.weaponsCreated).toBe(0);
      expect(res.result.weaponsUpdatedOrReassigned).toBe(2); // old unassigned + new assigned & updated

      const mist = res.trackedWeapons.find(w => w.id === 'uuid-mistsplitter');
      const amenoma = res.trackedWeapons.find(w => w.id === 'uuid-amenoma');

      expect(mist.assignedTo).toBeNull();
      expect(amenoma.assignedTo).toBe('Kamisato Ayaka');
      expect(amenoma.level).toBe(90);
      expect(amenoma.currentRefinement).toBe(5);
      expect(res.roster['Kamisato Ayaka'].equippedWeaponId).toBe('uuid-amenoma');
    });

    it('2. Ayaka/Skirk two-way swap: swaps UUIDs coherently without creating instances', () => {
      const roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'uuid-mistsplitter' },
        'Skirk': { level: 90, equippedWeaponId: 'uuid-amenoma' }
      };
      const trackedWeapons = [
        { id: 'uuid-mistsplitter', weapon_id: 'mistsplitterreforged', assignedTo: 'Kamisato Ayaka', level: 90 },
        { id: 'uuid-amenoma', weapon_id: 'amenomakageuchi', assignedTo: 'Skirk', level: 90 }
      ];

      const plan = {
        characters: [
          {
            rosterKey: 'Kamisato Ayaka',
            isNew: false,
            fields: {},
            weapon: { action: 'assign', uuid: 'uuid-amenoma' }
          },
          {
            rosterKey: 'Skirk',
            isNew: false,
            fields: {},
            weapon: { action: 'assign', uuid: 'uuid-mistsplitter' }
          }
        ]
      };

      const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

      // Invariants:
      expect(res.trackedWeapons.length).toBe(2);
      expect(res.result.weaponsCreated).toBe(0);

      // UUIDs preserved
      const mist = res.trackedWeapons.find(w => w.id === 'uuid-mistsplitter');
      const amenoma = res.trackedWeapons.find(w => w.id === 'uuid-amenoma');
      expect(mist).toBeDefined();
      expect(amenoma).toBeDefined();

      // Desired assignments swapped
      expect(amenoma.assignedTo).toBe('Kamisato Ayaka');
      expect(mist.assignedTo).toBe('Skirk');

      expect(res.roster['Kamisato Ayaka'].equippedWeaponId).toBe('uuid-amenoma');
      expect(res.roster['Skirk'].equippedWeaponId).toBe('uuid-mistsplitter');
    });

    it('3. three-character cyclic reassignment (A -> B, B -> C, C -> A)', () => {
      const roster = {
        'CharA': { equippedWeaponId: 'w-a' },
        'CharB': { equippedWeaponId: 'w-b' },
        'CharC': { equippedWeaponId: 'w-c' }
      };
      const trackedWeapons = [
        { id: 'w-a', weapon_id: 'weapona', assignedTo: 'CharA' },
        { id: 'w-b', weapon_id: 'weaponb', assignedTo: 'CharB' },
        { id: 'w-c', weapon_id: 'weaponc', assignedTo: 'CharC' }
      ];

      const plan = {
        characters: [
          { rosterKey: 'CharA', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w-b' } },
          { rosterKey: 'CharB', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w-c' } },
          { rosterKey: 'CharC', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w-a' } }
        ]
      };

      const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

      expect(res.trackedWeapons.length).toBe(3);
      expect(res.result.weaponsCreated).toBe(0);

      expect(res.trackedWeapons.find(w => w.id === 'w-b').assignedTo).toBe('CharA');
      expect(res.trackedWeapons.find(w => w.id === 'w-c').assignedTo).toBe('CharB');
      expect(res.trackedWeapons.find(w => w.id === 'w-a').assignedTo).toBe('CharC');

      expect(res.roster['CharA'].equippedWeaponId).toBe('w-b');
      expect(res.roster['CharB'].equippedWeaponId).toBe('w-c');
      expect(res.roster['CharC'].equippedWeaponId).toBe('w-a');
    });

    it('4. reused existing instance stat update while preserving planner target fields', () => {
      const roster = {
        'Kamisato Ayaka': { equippedWeaponId: null }
      };
      const trackedWeapons = [
        {
          id: 'w-amenoma',
          weapon_id: 'amenomakageuchi',
          level: 80,
          ascension: 5,
          currentRefinement: 1,
          targetLevel: 90,
          targetAscension: 6,
          targetRefinement: 5,
          assignedTo: null
        }
      ];

      const plan = {
        characters: [{
          rosterKey: 'Kamisato Ayaka',
          isNew: false,
          fields: {},
          weapon: {
            action: 'assign',
            uuid: 'w-amenoma',
            updateFields: { level: 90, ascension: 6, refinement: 5 }
          }
        }]
      };

      const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });
      const w = res.trackedWeapons[0];

      // Current stats updated
      expect(w.level).toBe(90);
      expect(w.ascension).toBe(6);
      expect(w.currentRefinement).toBe(5);

      // Planner target fields preserved
      expect(w.targetLevel).toBe(90);
      expect(w.targetAscension).toBe(6);
      expect(w.targetRefinement).toBe(5);
      expect(w.assignedTo).toBe('Kamisato Ayaka');
    });

    it('5. final assignment uniqueness invariant: no duplicate assignment', () => {
      const roster = {
        'CharA': { equippedWeaponId: 'w1' },
        'CharB': { equippedWeaponId: 'w2' }
      };
      const trackedWeapons = [
        { id: 'w1', assignedTo: 'CharA' },
        { id: 'w2', assignedTo: 'CharB' }
      ];

      const plan = {
        characters: [
          { rosterKey: 'CharA', isNew: false, fields: {}, weapon: { action: 'assign', uuid: 'w2' } }
        ]
      };

      const res = applyHoyolabPlanToState({ roster, trackedWeapons, plan });

      // w2 assigned to CharA
      expect(res.trackedWeapons.find(w => w.id === 'w2').assignedTo).toBe('CharA');
      // w1 became unassigned
      expect(res.trackedWeapons.find(w => w.id === 'w1').assignedTo).toBeNull();

      // Invariant: each weapon is assigned to at most 1 character
      const assignments = res.trackedWeapons.map(w => w.assignedTo).filter(Boolean);
      const uniqueAssignments = new Set(assignments);
      expect(assignments.length).toBe(uniqueAssignments.size);
    });
  });
});
