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

  it('handles SAME weapon update (preserves UUID, updates progression, no new weapon)', () => {
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
      weaponId: 'w1',
      weaponProgression: { level: 20, ascension: 1 }
    });

    const state = store.getStore();
    expect(state.roster.Jean.level).toBe(50);
    expect(state.roster.Jean.equippedWeaponId).toBe('w1');
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].id).toBe('w1');
    expect(state.trackedWeapons[0].level).toBe(20);
    expect(state.trackedWeapons[0].ascension).toBe(1);
    expect(state.trackedWeapons[0].assignedTo).toBe('Jean');
  });

  it('handles assigning existing unassigned weapon (reuses UUID, unassigns old weapon, no new weapon)', () => {
    const initialState = {
      roster: { Jean: { level: 1, equippedWeaponId: 'w1' } },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 1 },
        { id: 'w2', weaponName: 'Sword B', assignedTo: null, level: 40 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Jean', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'w2',
      weaponProgression: { level: 45, ascension: 2 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);
    const oldW = state.trackedWeapons.find(w => w.id === 'w1');
    expect(oldW.assignedTo).toBeNull(); // Old weapon unassigned

    const newW = state.trackedWeapons.find(w => w.id === 'w2');
    expect(newW.assignedTo).toBe('Jean');
    expect(newW.level).toBe(45);
    expect(state.roster.Jean.equippedWeaponId).toBe('w2');
  });

  it('handles stealing weapon assigned to another character (cleans up previous owner, reassigns UUID, no new weapon)', () => {
    const initialState = {
      roster: {
        Ayaka: { level: 90, equippedWeaponId: 'w-mistsplitter' },
        Skirk: { level: 80, equippedWeaponId: 'w-amenoma' }
      },
      trackedWeapons: [
        { id: 'w-mistsplitter', weaponName: 'Mistsplitter Reforged', assignedTo: 'Ayaka', level: 90 },
        { id: 'w-amenoma', weaponName: 'Amenoma Kageuchi', assignedTo: 'Skirk', level: 80 }
      ]
    };
    const store = getSlice(initialState);
    // Ayaka equips Skirk's Amenoma
    store.saveCharacterDraft('Ayaka', {
      level: 90, ascension: 6, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'w-amenoma',
      weaponProgression: { level: 85 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);

    // Ayaka now has w-amenoma
    expect(state.roster.Ayaka.equippedWeaponId).toBe('w-amenoma');
    const amenoma = state.trackedWeapons.find(w => w.id === 'w-amenoma');
    expect(amenoma.assignedTo).toBe('Ayaka');
    expect(amenoma.level).toBe(85);

    // Skirk's equipped weapon was cleaned up (unarmed)
    expect(state.roster.Skirk.equippedWeaponId).toBeNull();

    // Ayaka's old Mistsplitter is unassigned
    const mistsplitter = state.trackedWeapons.find(w => w.id === 'w-mistsplitter');
    expect(mistsplitter.assignedTo).toBeNull();
  });

  it('handles unassigning weapon (weaponId: null unassigns without deleting weapon)', () => {
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
      weaponId: null,
      weaponProgression: null
    });

    const state = store.getStore();
    expect(state.roster.Jean.equippedWeaponId).toBeNull();
    expect(state.trackedWeapons).toHaveLength(1);
    const oldW = state.trackedWeapons.find(w => w.id === 'w1');
    expect(oldW.assignedTo).toBeNull(); // Unassigned, NOT deleted
  });

  it('handles invalid weaponId safely (does not create new weapon, unassigns)', () => {
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
      weaponId: 'non-existent-uuid',
      weaponProgression: null
    });

    const state = store.getStore();
    expect(state.roster.Jean.equippedWeaponId).toBeNull();
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].assignedTo).toBeNull();
  });

  it('handles duplicate copies of same weapon (assigns exact selected UUID, leaves other copy untouched)', () => {
    const initialState = {
      roster: {
        Ayaka: { level: 90, equippedWeaponId: 'amenoma-1' },
        Skirk: { level: 80, equippedWeaponId: null }
      },
      trackedWeapons: [
        { id: 'amenoma-1', weaponName: 'Amenoma Kageuchi', assignedTo: 'Ayaka', level: 90, currentRefinement: 5 },
        { id: 'amenoma-2', weaponName: 'Amenoma Kageuchi', assignedTo: null, level: 20, currentRefinement: 1 }
      ]
    };
    const store = getSlice(initialState);
    // Skirk chooses copy 2
    store.saveCharacterDraft('Skirk', {
      level: 80, ascension: 5, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'amenoma-2',
      weaponProgression: { level: 50 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);
    // Copy 1 is still Ayaka's
    const copy1 = state.trackedWeapons.find(w => w.id === 'amenoma-1');
    expect(copy1.assignedTo).toBe('Ayaka');
    expect(copy1.level).toBe(90);
    expect(state.roster.Ayaka.equippedWeaponId).toBe('amenoma-1');

    // Copy 2 is Skirk's with updated level
    const copy2 = state.trackedWeapons.find(w => w.id === 'amenoma-2');
    expect(copy2.assignedTo).toBe('Skirk');
    expect(copy2.level).toBe(50);
    expect(state.roster.Skirk.equippedWeaponId).toBe('amenoma-2');
  });

  it('creates character if not in roster and assigns existing weapon', () => {
    const initialState = {
      roster: {},
      trackedWeapons: [
        { id: 'claymore-1', weaponName: 'Claymore A', assignedTo: null, level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Diluc', {
      level: 20, ascension: 1, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'claymore-1',
      weaponProgression: { level: 20, ascension: 1 }
    });

    const state = store.getStore();
    expect(state.roster.Diluc).toBeDefined();
    expect(state.roster.Diluc.level).toBe(20);
    expect(state.roster.Diluc.equippedWeaponId).toBe('claymore-1');
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].id).toBe('claymore-1');
    expect(state.trackedWeapons[0].assignedTo).toBe('Diluc');
    expect(state.trackedWeapons[0].level).toBe(20);
  });

  it('TEST A - unchanged Traveler save preserves shared weapon', () => {
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
      weaponId: 'uuid-a',
      weaponProgression: { level: 1, ascension: 0 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].id).toBe('uuid-a');
    expect(state.trackedWeapons[0].assignedTo).toBe('Traveler Geo');
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
  });

  it('TEST B - updates progression on shared Traveler weapon', () => {
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
      weaponId: 'uuid-a',
      weaponProgression: { level: 50, ascension: 3 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.trackedWeapons[0].id).toBe('uuid-a');
    expect(state.trackedWeapons[0].level).toBe(50);
  });

  it('TEST C - Traveler weapon replacement reuses existing weapon, unassigns old Traveler weapon', () => {
    const initialState = {
      roster: {
        'Traveler Anemo': { level: 1, equippedWeaponId: null },
        'Traveler Geo': { level: 1, equippedWeaponId: null }
      },
      trackedWeapons: [
        { id: 'uuid-a', weaponName: 'Sword A', assignedTo: 'Traveler Anemo', level: 1 },
        { id: 'uuid-b', weaponName: 'Sword B', assignedTo: null, level: 1 }
      ]
    };
    const store = getSlice(initialState);
    store.saveCharacterDraft('Traveler Geo', {
      level: 1, ascension: 0, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'uuid-b',
      weaponProgression: { level: 10, ascension: 0 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);
    const oldW = state.trackedWeapons.find(w => w.id === 'uuid-a');
    expect(oldW.assignedTo).toBeNull(); // Unassigned from Traveler

    const newW = state.trackedWeapons.find(w => w.id === 'uuid-b');
    expect(newW.assignedTo).toBe('Traveler Geo');
    expect(newW.level).toBe(10);
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
  });

  it('TEST D - Traveler weapon removal unassigns without deleting weapon', () => {
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
      weaponId: null,
      weaponProgression: null
    });

    const state = store.getStore();
    const oldW = state.trackedWeapons.find(w => w.id === 'uuid-a');
    expect(oldW.assignedTo).toBeNull();
    expect(state.trackedWeapons).toHaveLength(1);
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
  });

  it('TEST E - ordinary character stealing weapon from Traveler unassigns Traveler properly', () => {
    const initialState = {
      roster: {
        'Traveler Anemo': { level: 90, equippedWeaponId: null },
        Jean: { level: 80, equippedWeaponId: 'w-jean-old' }
      },
      trackedWeapons: [
        { id: 'w-trav', weaponName: 'Dull Blade', assignedTo: 'Traveler Anemo', level: 70 },
        { id: 'w-jean-old', weaponName: 'Favonius Sword', assignedTo: 'Jean', level: 80 }
      ]
    };
    const store = getSlice(initialState);
    // Jean steals Traveler's Dull Blade
    store.saveCharacterDraft('Jean', {
      level: 80, ascension: 5, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'w-trav',
      weaponProgression: { level: 75 }
    });

    const state = store.getStore();
    expect(state.trackedWeapons).toHaveLength(2);

    const travWeapon = state.trackedWeapons.find(w => w.id === 'w-trav');
    expect(travWeapon.assignedTo).toBe('Jean');
    expect(travWeapon.level).toBe(75);
    expect(state.roster.Jean.equippedWeaponId).toBe('w-trav');

    const jeanOld = state.trackedWeapons.find(w => w.id === 'w-jean-old');
    expect(jeanOld.assignedTo).toBeNull();

    // Traveler roster entry equippedWeaponId is null
    expect(state.roster['Traveler Anemo'].equippedWeaponId).toBeNull();
  });

  it('INVARIANT TEST - trackedWeapons length never increases during saveCharacterDraft', () => {
    const initialState = {
      roster: {
        Jean: { level: 80, equippedWeaponId: 'w1' }
      },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 80 },
        { id: 'w2', weaponName: 'Sword B', assignedTo: null, level: 40 }
      ]
    };
    const store = getSlice(initialState);
    const beforeCount = store.getStore().trackedWeapons.length;

    store.saveCharacterDraft('Jean', {
      level: 85, ascension: 6, targetLevel: 90, targetAscension: 6,
      talents: {}, targetTalents: {},
      weaponId: 'w2',
      weaponProgression: { level: 50, ascension: 2 }
    });

    const afterCount = store.getStore().trackedWeapons.length;
    expect(afterCount).toBe(beforeCount);
  });
});
