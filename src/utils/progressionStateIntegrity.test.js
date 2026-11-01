import { describe, it, expect } from 'vitest';
import {
  getWeaponMaxLevel,
  getWeaponMaxAscension,
  resolveCoherentProgression,
  validateLevelAscension,
  diagnoseCharacterRecord,
  diagnoseWeaponRecord,
  diagnoseTrackedWeapons,
  diagnoseProgressionState,
} from './progressionContracts';
import { calculateProgressionCost, calculateWeaponCost } from './calculator';
import { aggregateRosterCosts } from './aggregator';
import { createRosterSlice } from '../store/slices/rosterSlice';
import { createWeaponsSlice } from '../store/slices/weaponsSlice';

describe('Phase C2B.2A — Progression State Validation & Mutation Integrity', () => {
  const dummy5StarChar = {
    name: 'Raiden Shogun',
    rarity: 5,
    materials: {
      world_boss_material_id: 'StormBeads',
      gem_family_id: 'VajradaAmethyst',
      local_specialty_id: 'AmakumoFruit',
      enemy_material_family_id: 'Handguard',
    },
  };

  const dummyWeapon5Star = {
    id: 'w-engulfing',
    weaponName: 'Engulfing Lightning',
    rarity: 5,
    type: 'Polearm',
  };

  // Helper to create an isolated mock Zustand store for testing store actions
  const createMockStore = (initialState = {}) => {
    let state = {
      roster: {},
      trackedWeapons: [],
      ...initialState,
    };
    const set = (updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    };
    const get = () => state;

    const rosterSlice = createRosterSlice(set, get);
    const weaponsSlice = createWeaponsSlice(set, get);

    return {
      ...rosterSlice,
      ...weaponsSlice,
      getState: () => state,
    };
  };

  // ═════════════════════════════════════════════════════════════════════════
  // 1. CHARACTER CONTRACTS & FIXTURES 1–14
  // ═════════════════════════════════════════════════════════════════════════

  describe('Character Progression Contracts & Fixtures 1–14', () => {
    it('Fixture 1: Level 90 A6 -> Level 1 via table edit normalizes to Level 1 A0', () => {
      const coherent = resolveCoherentProgression(1, 6, 'character', null, 'current');
      expect(coherent).toEqual({ level: 1, ascension: 0 });

      // Store test
      const store = createMockStore({
        roster: {
          'Raiden Shogun': {
            level: 90,
            ascension: 6,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Raiden Shogun', { level: 1 });
      const char = store.getState().roster['Raiden Shogun'];
      expect(char.level).toBe(1);
      expect(char.ascension).toBe(0);
    });

    it('Fixture 2: Target Level 90 A6 -> Level 20 via table edit normalizes to Target Level 20 A1', () => {
      const coherent = resolveCoherentProgression(20, 6, 'character', null, 'target');
      expect(coherent).toEqual({ level: 20, ascension: 1 });

      const store = createMockStore({
        roster: {
          Sayu: {
            level: 1,
            ascension: 0,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Sayu', { targetLevel: 20 });
      const char = store.getState().roster['Sayu'];
      expect(char.targetLevel).toBe(20);
      expect(char.targetAscension).toBe(1);
    });

    it('Fixture 3: Target Level 90 A6 -> Level 40 normalizes to Target Level 40 A2', () => {
      const coherent = resolveCoherentProgression(40, 6, 'character', null, 'target');
      expect(coherent).toEqual({ level: 40, ascension: 2 });

      const store = createMockStore({
        roster: {
          Aloy: {
            level: 20,
            ascension: 1,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Aloy', { targetLevel: 40 });
      expect(store.getState().roster['Aloy'].targetLevel).toBe(40);
      expect(store.getState().roster['Aloy'].targetAscension).toBe(2);
    });

    it('Fixture 4: Target Level 90 A6 -> Level 50 normalizes to Target Level 50 A3', () => {
      const coherent = resolveCoherentProgression(50, 6, 'character', null, 'target');
      expect(coherent).toEqual({ level: 50, ascension: 3 });

      const store = createMockStore({
        roster: {
          'Raiden Shogun': {
            level: 40,
            ascension: 2,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Raiden Shogun', { targetLevel: 50 });
      expect(store.getState().roster['Raiden Shogun'].targetLevel).toBe(50);
      expect(store.getState().roster['Raiden Shogun'].targetAscension).toBe(3);
    });

    it('Fixture 5: Target Level 90 A6 -> Level 60 normalizes to Target Level 60 A4', () => {
      const coherent = resolveCoherentProgression(60, 6, 'character', null, 'target');
      expect(coherent).toEqual({ level: 60, ascension: 4 });

      const store = createMockStore({
        roster: {
          Thoma: {
            level: 50,
            ascension: 3,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Thoma', { targetLevel: 60 });
      expect(store.getState().roster['Thoma'].targetLevel).toBe(60);
      expect(store.getState().roster['Thoma'].targetAscension).toBe(4);
    });

    it('Fixture 6: Target Level 90 A6 -> Level 70 normalizes to Target Level 70 A5', () => {
      const coherent = resolveCoherentProgression(70, 6, 'character', null, 'target');
      expect(coherent).toEqual({ level: 70, ascension: 5 });

      const store = createMockStore({
        roster: {
          'Arataki Itto': {
            level: 60,
            ascension: 4,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Arataki Itto', { targetLevel: 70 });
      expect(store.getState().roster['Arataki Itto'].targetLevel).toBe(70);
      expect(store.getState().roster['Arataki Itto'].targetAscension).toBe(5);
    });

    it('Fixture 7: Level 80 A5 and Level 80 A6 both remain valid', () => {
      const valA5 = validateLevelAscension(80, 5, 'character');
      const valA6 = validateLevelAscension(80, 6, 'character');
      expect(valA5.isValid).toBe(true);
      expect(valA6.isValid).toBe(true);

      // Editing level to 80 preserves existing A6
      expect(resolveCoherentProgression(80, 6, 'character', null, 'current')).toEqual({
        level: 80,
        ascension: 6,
      });
      // Editing level to 80 preserves existing A5
      expect(resolveCoherentProgression(80, 5, 'character', null, 'current')).toEqual({
        level: 80,
        ascension: 5,
      });
    });

    it('Fixture 8: Same-level ascension toggle changes only the intended phase', () => {
      const store = createMockStore({
        roster: {
          Bennett: {
            level: 80,
            ascension: 5,
            targetLevel: 90,
            targetAscension: 6,
          },
        },
      });
      store.updateCharacter('Bennett', { ascension: 6 });
      const char = store.getState().roster['Bennett'];
      expect(char.level).toBe(80);
      expect(char.ascension).toBe(6);
    });

    it('Fixture 9: Level 1 A0 -> Level 90 A6 produces full correct progression costs', () => {
      const cost = calculateProgressionCost(dummy5StarChar, 1, 90, 0, 6);
      expect(cost.isInvalid).toBeUndefined();
      expect(cost.mora).toBe(2092530);
      expect(cost.heros_wit).toBe(419);
      expect(cost.boss_material).toBe(46);
      expect(cost.local_specialty).toBe(168);
      expect(cost.gem_gemstone).toBe(6);
    });

    it('Fixture 10: Level 80 A6 -> Level 90 A6 charges no ascension materials', () => {
      const cost = calculateProgressionCost(dummy5StarChar, 80, 90, 6, 6);
      expect(cost.isInvalid).toBeUndefined();
      expect(cost.mora).toBe(684625);
      expect(cost.heros_wit).toBe(172);
      expect(cost.boss_material).toBeUndefined();
      expect(cost.local_specialty).toBeUndefined();
      expect(cost.gem_gemstone).toBeUndefined();
    });

    it('Fixture 11: Invalid loaded legacy records are detected without being overwritten', () => {
      // Simulate loaded legacy state with impossible Lv 1 A6
      const store = createMockStore({
        roster: {
          'Kuki Shinobu': {
            level: 1,
            ascension: 6,
            targetLevel: 90,
            targetAscension: 6,
            notes: 'Legacy record',
          },
        },
      });

      // 1. Diagnostic detects the defect accurately
      const issues = diagnoseCharacterRecord(
        'Kuki Shinobu',
        store.getState().roster['Kuki Shinobu']
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].scope).toBe('current');
      expect(issues[0].status).toBe('invalid');
      expect(issues[0].reason).toContain('Ascension 6 is invalid for level 1');
      expect(issues[0].isUnambiguous).toBe(true);
      expect(issues[0].suggestedCorrection).toEqual({ level: 1, ascension: 0 });

      // 2. Persisted record was NOT automatically overwritten
      const state = store.getState().roster['Kuki Shinobu'];
      expect(state.level).toBe(1);
      expect(state.ascension).toBe(6);
    });

    it('Fixture 12: Unrelated character updates preserve existing progression fields', () => {
      const store = createMockStore({
        roster: {
          'Kuki Shinobu': {
            level: 1,
            ascension: 6, // Corrupted legacy state
            targetLevel: 90,
            targetAscension: 6,
            equippedWeaponId: null,
          },
        },
      });

      // Update unrelated field (e.g. equipped weapon ID)
      store.updateCharacter('Kuki Shinobu', { equippedWeaponId: 'w-uuid-999' });

      const state = store.getState().roster['Kuki Shinobu'];
      expect(state.equippedWeaponId).toBe('w-uuid-999');
      // Must not silently repair or rewrite progression
      expect(state.level).toBe(1);
      expect(state.ascension).toBe(6);
    });

    it('Fixture 13: Current and target ordering is enforced or safely rejected', () => {
      const store = createMockStore({
        roster: {
          Zhongli: {
            level: 50,
            ascension: 3,
            targetLevel: 80,
            targetAscension: 6,
          },
        },
      });

      // Attempt to lower target below current (targetLevel: 20 < level: 50)
      store.updateCharacter('Zhongli', { targetLevel: 20 });
      const afterTargetDrop = store.getState().roster['Zhongli'];
      // Target is clamped to current level (50) and current is NOT changed
      expect(afterTargetDrop.level).toBe(50);
      expect(afterTargetDrop.targetLevel).toBe(50);
      expect(afterTargetDrop.targetAscension).toBe(3);

      // Now raise current level past target (level: 90 > targetLevel: 50)
      store.updateCharacter('Zhongli', { level: 90 });
      const afterCurrentRaise = store.getState().roster['Zhongli'];
      expect(afterCurrentRaise.level).toBe(90);
      expect(afterCurrentRaise.ascension).toBe(6);
      expect(afterCurrentRaise.targetLevel).toBe(90);
      expect(afterCurrentRaise.targetAscension).toBe(6);
    });

    it('Fixture 14: Level 100 supported states remain valid according to actual rules', () => {
      const val90 = validateLevelAscension(90, 6, 'character');
      const val95 = validateLevelAscension(95, 6, 'character');
      const val100 = validateLevelAscension(100, 6, 'character');

      expect(val90.isValid).toBe(true);
      expect(val95.isValid).toBe(true);
      expect(val100.isValid).toBe(true);

      // Stella Fortuna calculation succeeds
      const cost95 = calculateProgressionCost(dummy5StarChar, 90, 95, 6, 6);
      expect(cost95.masterless_stella_fortuna).toBe(1);
      const cost100 = calculateProgressionCost(dummy5StarChar, 90, 100, 6, 6);
      expect(cost100.masterless_stella_fortuna).toBe(3);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. WEAPON CONTRACTS & FIXTURES 15–20
  // ═════════════════════════════════════════════════════════════════════════

  describe('Weapon Progression Contracts & Fixtures 15–20', () => {
    it('Fixture 15: Lowering a current weapon level from a high ascension', () => {
      // 5★ weapon: Level 90 A6 -> Level 1 normalizes to Level 1 A0
      const coherent5 = resolveCoherentProgression(1, 6, 'weapon', 5, 'current');
      expect(coherent5).toEqual({ level: 1, ascension: 0 });

      // 1★ weapon: Level 70 A4 -> Level 1 normalizes to Level 1 A0
      const coherent1 = resolveCoherentProgression(1, 4, 'weapon', 1, 'current');
      expect(coherent1).toEqual({ level: 1, ascension: 0 });

      const store = createMockStore({
        trackedWeapons: [
          {
            id: 'w-1',
            weaponName: 'Aquila Favonia',
            rarity: 5,
            level: 90,
            ascension: 6,
            targetLevel: 90,
            targetAscension: 6,
          },
        ],
      });
      store.updateTrackedWeapon('w-1', { level: 1 });
      const w = store.getState().trackedWeapons[0];
      expect(w.level).toBe(1);
      expect(w.ascension).toBe(0);
    });

    it('Fixture 16: Lowering a target weapon level', () => {
      // 5★ weapon: Target 90 A6 -> Target 20 normalizes to Target 20 A1
      const coherent = resolveCoherentProgression(20, 6, 'weapon', 5, 'target');
      expect(coherent).toEqual({ level: 20, ascension: 1 });

      const store = createMockStore({
        trackedWeapons: [
          {
            id: 'w-1',
            weaponName: 'Aquila Favonia',
            rarity: 5,
            level: 1,
            ascension: 0,
            targetLevel: 90,
            targetAscension: 6,
          },
        ],
      });
      store.updateTrackedWeapon('w-1', { targetLevel: 20 });
      const w = store.getState().trackedWeapons[0];
      expect(w.targetLevel).toBe(20);
      expect(w.targetAscension).toBe(1);
    });

    it('Fixture 17: Valid same-level weapon ascension', () => {
      // At weapon Level 80, both A5 and A6 are valid
      const valA5 = validateLevelAscension(80, 5, 'weapon', 5);
      const valA6 = validateLevelAscension(80, 6, 'weapon', 5);
      expect(valA5.isValid).toBe(true);
      expect(valA6.isValid).toBe(true);

      const store = createMockStore({
        trackedWeapons: [
          {
            id: 'w-1',
            weaponName: 'Aquila Favonia',
            rarity: 5,
            level: 80,
            ascension: 5,
            targetLevel: 90,
            targetAscension: 6,
          },
        ],
      });
      store.updateTrackedWeapon('w-1', { ascension: 6 });
      const w = store.getState().trackedWeapons[0];
      expect(w.level).toBe(80);
      expect(w.ascension).toBe(6);

      // Low-tier weapon (1★ Dull Blade) caps at 70 A4
      expect(getWeaponMaxLevel(1)).toBe(70);
      expect(getWeaponMaxAscension(1)).toBe(4);
      const valDull60A3 = validateLevelAscension(60, 3, 'weapon', 1);
      const valDull60A4 = validateLevelAscension(60, 4, 'weapon', 1);
      expect(valDull60A3.isValid).toBe(true);
      expect(valDull60A4.isValid).toBe(true);
    });

    it('Fixture 18: Duplicate tracked weapon UUIDs are detected and prevented', () => {
      const mockWeapons = [
        { id: 'dup-uuid-1', weaponName: 'Favonius Sword', level: 80, ascension: 6, targetLevel: 90, targetAscension: 6 },
        { id: 'dup-uuid-1', weaponName: 'Favonius Lance', level: 70, ascension: 5, targetLevel: 90, targetAscension: 6 },
      ];

      // Diagnostics detect the duplicate UUID
      const issues = diagnoseTrackedWeapons(mockWeapons);
      const dupIssue = issues.find((i) => i.scope === 'identity');
      expect(dupIssue).toBeDefined();
      expect(dupIssue.reason).toContain('Duplicate tracked weapon UUID: dup-uuid-1');

      // addTrackedWeapon refuses to reuse existing UUID
      const store = createMockStore({ trackedWeapons: mockWeapons });
      const newId = store.addTrackedWeapon('Rust', null, { id: 'dup-uuid-1' });
      expect(newId).not.toBe('dup-uuid-1');
      expect(typeof newId).toBe('string');
    });

    it('Fixture 19: Unrelated weapon updates preserve progression', () => {
      const store = createMockStore({
        trackedWeapons: [
          {
            id: 'w-corrupt',
            weaponName: 'Favonius Sword',
            rarity: 4,
            level: 1,
            ascension: 6, // Corrupted legacy state
            targetLevel: 90,
            targetAscension: 6,
            currentRefinement: 1,
            targetRefinement: 5,
            assignedTo: null,
          },
        ],
      });

      // Update refinement
      store.updateTrackedWeapon('w-corrupt', { currentRefinement: 3 });
      const w = store.getState().trackedWeapons[0];
      expect(w.currentRefinement).toBe(3);
      // Progression is untouched
      expect(w.level).toBe(1);
      expect(w.ascension).toBe(6);
    });

    it('Fixture 20: Invalid weapon records are detected without silent repair', () => {
      // Level 20 with targetAscension 6
      const invalidCost = calculateWeaponCost(dummyWeapon5Star, 20, 20, 0, 6, false, {});
      expect(invalidCost.isInvalid).toBe(true);
      expect(invalidCost.invalidReason).toContain('Target weapon state invalid');
      expect(invalidCost.total_mora).toBe(0);
      expect(invalidCost['5_star_ascension_material']).toBeUndefined();

      // Diagnostics report the defect
      const issues = diagnoseWeaponRecord({
        id: 'w-test',
        weaponName: 'Engulfing Lightning',
        level: 20,
        ascension: 0,
        targetLevel: 20,
        targetAscension: 6,
      }, dummyWeapon5Star);

      expect(issues).toHaveLength(1);
      expect(issues[0].scope).toBe('target');
      expect(issues[0].status).toBe('invalid');
      expect(issues[0].reason).toContain('Ascension 6 is invalid for level 20');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. READ-ONLY STATE DIAGNOSTICS SUITE
  // ═════════════════════════════════════════════════════════════════════════

  describe('Read-Only State Diagnostics Suite', () => {
    it('evaluates clean roster and armory as valid with 0 issues', () => {
      const cleanState = {
        roster: {
          'Raiden Shogun': { level: 90, ascension: 6, targetLevel: 90, targetAscension: 6 },
          Bennett: { level: 80, ascension: 6, targetLevel: 90, targetAscension: 6 },
          Sayu: { level: 20, ascension: 1, targetLevel: 20, targetAscension: 1 },
        },
        trackedWeapons: [
          { id: 'w-1', weaponName: 'Aquila Favonia', rarity: 5, level: 90, ascension: 6, targetLevel: 90, targetAscension: 6 },
        ],
      };

      const report = diagnoseProgressionState(cleanState);
      expect(report.isValid).toBe(true);
      expect(report.issuesCount).toBe(0);
      expect(report.characterIssues).toEqual([]);
      expect(report.weaponIssues).toEqual([]);
    });

    it('identifies multiple corrupted records simultaneously with actionable diagnostics', () => {
      const corruptedState = {
        roster: {
          'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
          Sayu: { level: 20, ascension: 0, targetLevel: 20, targetAscension: 6 },
        },
        trackedWeapons: [
          { id: 'w-1', weaponName: 'Favonius Sword', rarity: 4, level: 40, ascension: 6, targetLevel: 40, targetAscension: 6 },
        ],
      };

      const report = diagnoseProgressionState(corruptedState);
      expect(report.isValid).toBe(false);
      expect(report.issuesCount).toBe(4); // Kuki Shinobu current, Sayu target, Favonius current & target
      expect(report.characterIssues.some((i) => i.entityIdentifier === 'Kuki Shinobu')).toBe(true);
      expect(report.characterIssues.some((i) => i.entityIdentifier === 'Sayu')).toBe(true);
      expect(report.weaponIssues.some((i) => i.entityIdentifier === 'w-1')).toBe(true);
    });
  });
describe('Planner Aggregation & Invalid Progression Isolation', () => {
    it('aggregateRosterCosts excludes invalid character and weapon plans and reports invalidPlans and isPartial', () => {
      const roster = {
        Jean: {
          level: 80,
          targetLevel: 90,
          ascension: 5,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
        },
        Sayu: {
          level: 20,
          targetLevel: 20,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
        },
      };
      const trackedWeapons = [
        {
          id: 'w-1',
          weaponName: 'Aquila Favonia',
          level: 80,
          targetLevel: 90,
          ascension: 5,
          targetAscension: 6,
        },
        {
          id: 'w-2',
          weaponName: 'Favonius Sword',
          level: 20,
          targetLevel: 20,
          ascension: 6,
          targetAscension: 6,
        },
      ];

      const res = aggregateRosterCosts(roster, trackedWeapons);
      expect(res.invalidCount).toBe(2);
      expect(res.isPartial).toBe(true);
      expect(res.invalidPlans).toHaveLength(2);
      expect(res.invalidPlans.find((p) => p.name === 'Sayu' && !p.isWeapon)).toBeDefined();
      expect(res.invalidPlans.find((p) => p.name === 'Favonius Sword' && p.isWeapon)).toBeDefined();
      // Valid records are present in breakdown
      expect(res.breakdown.some((b) => b.name === 'Jean')).toBe(true);
      expect(res.breakdown.some((b) => b.name === 'Aquila Favonia')).toBe(true);
      // Invalid records are excluded from breakdown
      expect(res.breakdown.some((b) => b.name === 'Sayu')).toBe(false);
      expect(res.breakdown.some((b) => b.name === 'Favonius Sword')).toBe(false);
    });
  });

  describe('Duplicate Weapon UUID Identity Guard', () => {
    it('generates a new UUID when adding a weapon whose ID already exists', () => {
      const store = createMockStore({
        trackedWeapons: [
          { id: 'fav-1', weaponName: 'Favonius Sword', level: 1, ascension: 0, currentLevel: 1, currentAscension: 0 },
        ],
      });

      // Try adding another weapon with the same ID
      store.addTrackedWeapon('Favonius Sword', null, { id: 'fav-1', currentLevel: 20, currentAscension: 0 });

      const state = store.getState();
      expect(state.trackedWeapons).toHaveLength(2);
      expect(state.trackedWeapons[0].id).toBe('fav-1');
      expect(state.trackedWeapons[1].id).not.toBe('fav-1');
      expect(state.trackedWeapons[1].id).toBeTruthy();
    });

    it('updateTrackedWeapon modifies ONLY the targeted weapon instance and preserves siblings', () => {
      const store = createMockStore({
        trackedWeapons: [
          { id: 'fav-1', weaponName: 'Favonius Sword', level: 20, ascension: 0, currentRefinement: 1 },
          { id: 'fav-2', weaponName: 'Favonius Sword', level: 80, ascension: 6, currentRefinement: 5 },
        ],
      });

      store.updateTrackedWeapon('fav-1', { currentRefinement: 2 });

      const state = store.getState();
      expect(state.trackedWeapons[0].currentRefinement).toBe(2);
      expect(state.trackedWeapons[1].currentRefinement).toBe(5);
    });
  });
});
