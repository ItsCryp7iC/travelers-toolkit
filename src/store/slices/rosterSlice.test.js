import { describe, it, expect, vi } from 'vitest';
import { createRosterSlice } from './rosterSlice';

vi.mock('../helpers/rosterHelpers', () => ({
  syncTravelerAscension: vi.fn(),
  recalculateCharacterCosts: (name, entry) => ({ ...entry, calculatedCosts: {} })
}));

describe('rosterSlice saveCharacterDraft', () => {
  const getSlice = (initialState) => {
    let state = { ...initialState };
    const set = (updater) => { state = { ...state, ...updater(state) }; };
    const get = () => state;
    return { ...createRosterSlice(set, get), getStore: () => state };
  };

  it('handles SAME weapon update', () => {
    const initialState = {
      roster: { Jean: { level: 1, equippedWeaponId: 'w1' } },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Jean', {
      level: 50, ascension: 3, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Sword A',
      weaponProgression: { level: 20, ascension: 1 }
    });

    const state = store.getStore();
    expect(state.roster.Jean.level).toBe(50);
    expect(state.roster.Jean.equippedWeaponId).toBe('w1');
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].level).toBe(20);
    expect(state.trackedWeapons[0].assignedTo).toBe('Jean');
  });

  it('handles NEW weapon replacement (A -> B)', () => {
    const initialState = {
      roster: { Jean: { level: 1, equippedWeaponId: 'w1' } },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Jean', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Sword B',
      weaponProgression: { level: 1, ascension: 0 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);
    const oldW = state.trackedWeapons.find(w => w.id === 'w1');
    expect(oldW.assignedTo).toBeNull(); // Unassigned old weapon

    const newW = state.trackedWeapons.find(w => w.id !== 'w1');
    expect(newW.weaponName).toBe('Sword B');
    expect(newW.assignedTo).toBe('Jean');
    expect(state.roster.Jean.equippedWeaponId).toBe(newW.id);
  });

  it('handles REMOVE weapon', () => {
    const initialState = {
      roster: { Jean: { level: 1, equippedWeaponId: 'w1' } },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Jean', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: null,
      weaponProgression: null
    });

    const state = store.getStore();
    expect(state.roster.Jean.equippedWeaponId).toBeNull();
    const oldW = state.trackedWeapons.find(w => w.id === 'w1');
    expect(oldW.assignedTo).toBeNull(); // Unassigned
  });

  it('creates character if not in roster', () => {
    const initialState = { roster: {}, trackedWeapons: [] };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Diluc', {
      level: 20, ascension: 1, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Claymore A',
      weaponProgression: { level: 20, ascension: 1 }
    });

    const state = store.getStore();
    expect(state.roster.Diluc).toBeDefined();
    expect(state.roster.Diluc.level).toBe(20);
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].weaponName).toBe('Claymore A');
    expect(state.trackedWeapons[0].assignedTo).toBe('Diluc');
  });

  it('TEST A - unchanged Traveler save', () => {
    const initialState = {
      roster: {
        'Traveler Anemo': { level: 1, equippedWeaponId: null },
        'Traveler Geo': { level: 1, equippedWeaponId: null }
      },
      trackedWeapons: [
        { id: 'uuid-a', weaponName: 'Sword A', assignedTo: 'Traveler Anemo', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Traveler Geo', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Sword A',
      weaponProgression: { level: 1, ascension: 0 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].id).toBe('uuid-a');
    expect(state.trackedWeapons[0].assignedTo).toBe('Traveler Anemo');
    // Traveler Geo equippedWeaponId remains null
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
  });

  it('TEST B - Traveler progression save', () => {
    const initialState = {
      roster: {
        'Traveler Anemo': { level: 1, equippedWeaponId: null },
        'Traveler Geo': { level: 1, equippedWeaponId: null }
      },
      trackedWeapons: [
        { id: 'uuid-a', weaponName: 'Sword A', assignedTo: 'Traveler Anemo', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Traveler Geo', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Sword A',
      weaponProgression: { level: 50, ascension: 3 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].id).toBe('uuid-a');
    expect(state.trackedWeapons[0].level).toBe(50);
  });

  it('TEST C - Traveler weapon replacement', () => {
    const initialState = {
      roster: {
        'Traveler Anemo': { level: 1, equippedWeaponId: null },
        'Traveler Geo': { level: 1, equippedWeaponId: null }
      },
      trackedWeapons: [
        { id: 'uuid-a', weaponName: 'Sword A', assignedTo: 'Traveler Anemo', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Traveler Geo', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Sword B',
      weaponProgression: { level: 1, ascension: 0 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);
    const oldW = state.trackedWeapons.find(w => w.id === 'uuid-a');
    expect(oldW.assignedTo).toBeNull(); // Should be unassigned from Traveler Anemo

    const newW = state.trackedWeapons.find(w => w.id !== 'uuid-a');
    expect(newW.weaponName).toBe('Sword B');
    expect(newW.assignedTo).toBe('Traveler Geo');
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
  });

  it('TEST D - Traveler weapon removal', () => {
    const initialState = {
      roster: {
        'Traveler Anemo': { level: 1, equippedWeaponId: null },
        'Traveler Geo': { level: 1, equippedWeaponId: null }
      },
      trackedWeapons: [
        { id: 'uuid-a', weaponName: 'Sword A', assignedTo: 'Traveler Anemo', level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Traveler Geo', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: null,
      weaponProgression: null
    });

    const state = store.getStore();
    const oldW = state.trackedWeapons.find(w => w.id === 'uuid-a');
    expect(oldW.assignedTo).toBeNull();
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
  });

  it('SCHEMA CONSISTENCY TEST - new weapon refinement defaults', () => {
    const initialState = { roster: {}, trackedWeapons: [] };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Diluc', {
      level: 20, ascension: 1, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponName: 'Claymore A',
      weaponProgression: { level: 20, ascension: 1, targetLevel: 90, targetAscension: 6 }
    });

    const state = store.getStore();
    const newW = state.trackedWeapons[0];

    // Explicit assertions for refinement
    expect(newW.currentRefinement).toBe(1);
    expect(newW.targetRefinement).toBe(1);

    // Assert overall shape
    expect(newW).toHaveProperty('id');
    expect(newW).toHaveProperty('weapon_id', 'claymorea');
    expect(newW).toHaveProperty('weaponName', 'Claymore A');
    expect(newW).toHaveProperty('level', 20);
    expect(newW).toHaveProperty('ascension', 1);
    expect(newW).toHaveProperty('targetLevel', 90);
    expect(newW).toHaveProperty('targetAscension', 6);
    expect(newW).toHaveProperty('currentRefinement', 1);
    expect(newW).toHaveProperty('targetRefinement', 1);
    expect(newW).toHaveProperty('assignedTo', 'Diluc');
    expect(newW).toHaveProperty('createdAt');
  });
});
