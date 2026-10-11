import { describe, it, expect } from 'vitest';
import { createWeaponsSlice } from './weaponsSlice';

describe('weaponsSlice Invariant & Assignment Safety', () => {
  const getSlice = (initialState = {}) => {
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
    return { ...createWeaponsSlice(set, get), getStore: () => state };
  };

  describe('addTrackedWeapon', () => {
    it('creates bidirectional assignment for ordinary characters', () => {
      const store = getSlice({
        roster: { Jean: { level: 80, equippedWeaponId: null } },
      });
      const id = store.addTrackedWeapon('Favonius Sword', 'Jean');
      const state = store.getStore();

      expect(state.roster.Jean.equippedWeaponId).toBe(id);
      expect(state.trackedWeapons).toHaveLength(1);
      expect(state.trackedWeapons[0].id).toBe(id);
      expect(state.trackedWeapons[0].assignedTo).toBe('Jean');
    });

    it('preserves Traveler weapon invariant: roster equippedWeaponId remains null', () => {
      const store = getSlice({
        roster: {
          'Traveler Geo': { level: 90, equippedWeaponId: null },
          'Traveler Anemo': { level: 90, equippedWeaponId: null },
        },
      });
      const id = store.addTrackedWeapon('Dull Blade', 'Traveler Geo');
      const state = store.getStore();

      expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
      expect(state.roster['Traveler Anemo'].equippedWeaponId).toBeNull();
      expect(state.trackedWeapons[0].id).toBe(id);
      expect(state.trackedWeapons[0].assignedTo).toBe('Traveler Geo');
    });

    it('unassigns previous Traveler weapon when adding new weapon to Traveler', () => {
      const store = getSlice({
        roster: {
          'Traveler Geo': { level: 90, equippedWeaponId: null },
          'Traveler Anemo': { level: 90, equippedWeaponId: null },
        },
        trackedWeapons: [
          { id: 'w-old', weaponName: 'Silver Sword', assignedTo: 'Traveler Anemo' },
        ],
      });
      const newId = store.addTrackedWeapon('Dull Blade', 'Traveler Geo');
      const state = store.getStore();

      const oldW = state.trackedWeapons.find((w) => w.id === 'w-old');
      const newW = state.trackedWeapons.find((w) => w.id === newId);

      expect(oldW.assignedTo).toBeNull();
      expect(newW.assignedTo).toBe('Traveler Geo');
      expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
    });
  });

  describe('assignWeaponToCharacter', () => {
    it('maintains strict exclusivity when reassigning weapons between characters', () => {
      const store = getSlice({
        roster: {
          Jean: { level: 80, equippedWeaponId: 'w1' },
          Kaeya: { level: 70, equippedWeaponId: 'w2' },
        },
        trackedWeapons: [
          { id: 'w1', weaponName: 'Favonius Sword', assignedTo: 'Jean' },
          { id: 'w2', weaponName: 'Prototype Rancour', assignedTo: 'Kaeya' },
        ],
      });

      // Reassign w1 to Kaeya
      store.assignWeaponToCharacter('w1', 'Kaeya');
      const state = store.getStore();

      // Jean no longer has w1
      expect(state.roster.Jean.equippedWeaponId).toBeNull();
      // Kaeya has w1
      expect(state.roster.Kaeya.equippedWeaponId).toBe('w1');
      // w1 is assignedTo Kaeya
      expect(state.trackedWeapons.find((w) => w.id === 'w1').assignedTo).toBe('Kaeya');
      // w2 becomes unassigned
      expect(state.trackedWeapons.find((w) => w.id === 'w2').assignedTo).toBeNull();
    });

    it('preserves Traveler weapon invariant on assign', () => {
      const store = getSlice({
        roster: {
          'Traveler Dendro': { level: 90, equippedWeaponId: null },
        },
        trackedWeapons: [
          { id: 'w1', weaponName: 'Sapwood Blade', assignedTo: null },
        ],
      });

      store.assignWeaponToCharacter('w1', 'Traveler Dendro');
      const state = store.getStore();

      expect(state.roster['Traveler Dendro'].equippedWeaponId).toBeNull();
      expect(state.trackedWeapons[0].assignedTo).toBe('Traveler Dendro');
    });
  });

  describe('bulkUpdateWeapons', () => {
    it('does NOT unassign weapon assigned to Traveler during bulk updates', () => {
      const store = getSlice({
        roster: {
          'Traveler Geo': { level: 90, equippedWeaponId: null },
          Jean: { level: 80, equippedWeaponId: 'w-jean' },
        },
        trackedWeapons: [
          { id: 'w-trav', weaponName: 'Dull Blade', level: 1, targetLevel: 90, assignedTo: 'Traveler Geo' },
          { id: 'w-jean', weaponName: 'Aquila Favonia', level: 80, targetLevel: 90, assignedTo: 'Jean' },
        ],
      });

      // Run bulk update on weapons
      store.bulkUpdateWeapons(['w-trav', 'w-jean'], { targetLevel: 90 });
      const state = store.getStore();

      const travWeapon = state.trackedWeapons.find((w) => w.id === 'w-trav');
      const jeanWeapon = state.trackedWeapons.find((w) => w.id === 'w-jean');

      // Traveler weapon must remain assigned
      expect(travWeapon.assignedTo).toBe('Traveler Geo');
      expect(jeanWeapon.assignedTo).toBe('Jean');
      expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
      expect(state.roster.Jean.equippedWeaponId).toBe('w-jean');
    });
  });

  describe('updateTrackedWeapon refinement bounds', () => {
    it('clamps refinement to [0, 5]', () => {
      const store = getSlice({
        trackedWeapons: [
          { id: 'w1', weaponName: 'The Flute', currentRefinement: 1, targetRefinement: 1, assignedTo: null },
        ],
      });

      store.updateTrackedWeapon('w1', { currentRefinement: 10, targetRefinement: -2 });
      const state = store.getStore();

      expect(state.trackedWeapons[0].currentRefinement).toBe(5);
      expect(state.trackedWeapons[0].targetRefinement).toBe(0);
    });
  });

  describe('removeTrackedWeapon & unassignWeapon', () => {
    it('unassigns cleanly without leaving dangling equippedWeaponId', () => {
      const store = getSlice({
        roster: {
          Bennett: { level: 80, equippedWeaponId: 'w1' },
        },
        trackedWeapons: [
          { id: 'w1', weaponName: 'Sapwood Blade', assignedTo: 'Bennett' },
        ],
      });

      store.unassignWeapon('w1');
      let state = store.getStore();
      expect(state.roster.Bennett.equippedWeaponId).toBeNull();
      expect(state.trackedWeapons[0].assignedTo).toBeNull();

      store.assignWeaponToCharacter('w1', 'Bennett');
      state = store.getStore();
      expect(state.roster.Bennett.equippedWeaponId).toBe('w1');

      store.removeTrackedWeapon('w1');
      state = store.getStore();
      expect(state.roster.Bennett.equippedWeaponId).toBeNull();
      expect(state.trackedWeapons).toHaveLength(0);
    });
  });
});
