import { describe, it, expect, beforeEach, vi } from 'vitest';
import useStore from './useStore';

// Stub randomUUID for test environments that might lack it (like some older jsdom)
if (!globalThis.crypto) {
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  let counter = 0;
  globalThis.crypto.randomUUID = () => `test-uuid-${counter++}`;
}

describe('Zustand Store Integrity', () => {
  beforeEach(() => {
    // Clear localStorage
    window.localStorage.clear();
    // Reset store state
    useStore.getState().resetStore();
    // Reset the internal weapon counter for uuid stub
    if (globalThis.crypto.randomUUID.toString().includes('counter')) {
      globalThis.crypto.randomUUID = (() => {
        let counter = 0;
        return () => `test-uuid-${counter++}`;
      })();
    }
  });

  describe('Character Roster State', () => {
    it('addCharacter initializes with correct defaults', () => {
      useStore.getState().addCharacter('Amber');
      const roster = useStore.getState().roster;

      expect(roster['Amber']).toBeDefined();
      expect(roster['Amber'].level).toBe(1);
      expect(roster['Amber'].ascension).toBe(0);
      expect(roster['Amber'].targetLevel).toBe(90);
      expect(roster['Amber'].targetAscension).toBe(6);
      expect(roster['Amber'].talents).toEqual({ normal: 1, skill: 1, burst: 1 });
      expect(roster['Amber'].equippedWeaponId).toBeNull();
    });

    it('duplicate addCharacter does not overwrite or corrupt', () => {
      useStore.getState().addCharacter('Amber');
      useStore.getState().updateCharacter('Amber', { level: 20 });

      useStore.getState().addCharacter('Amber');
      const roster = useStore.getState().roster;
      expect(roster['Amber'].level).toBe(20);
    });

    it('removeCharacter clears character and unassigns weapon', () => {
      useStore.getState().addCharacter('Amber');
      const weaponId = useStore.getState().addTrackedWeapon('Hunters Bow', 'Amber');

      let state = useStore.getState();
      expect(state.roster['Amber'].equippedWeaponId).toBe(weaponId);
      expect(state.trackedWeapons[0].assignedTo).toBe('Amber');

      useStore.getState().removeCharacter('Amber');

      state = useStore.getState();
      expect(state.roster['Amber']).toBeUndefined();
      expect(state.trackedWeapons[0].assignedTo).toBeNull();
    });
  });

  describe('Traveler Synchronization', () => {
    it('synchronizes level and ascension fields between Traveler variants', () => {
      useStore.getState().batchAddCharacters(['Traveler Anemo', 'Traveler Geo']);

      useStore.getState().updateCharacter('Traveler Anemo', {
        level: 50,
        ascension: 2,
        targetLevel: 80,
        targetAscension: 5
      });

      const roster = useStore.getState().roster;
      expect(roster['Traveler Geo'].level).toBe(50);
      expect(roster['Traveler Geo'].ascension).toBe(2);
      expect(roster['Traveler Geo'].targetLevel).toBe(80);
      expect(roster['Traveler Geo'].targetAscension).toBe(5);
    });
  });

  describe('Weapon Assignment Invariants', () => {
    it('addTrackedWeapon establishes bidirectional relationship', () => {
      useStore.getState().addCharacter('Kaeya');
      const wId = useStore.getState().addTrackedWeapon('Cool Steel', 'Kaeya');

      const state = useStore.getState();
      expect(state.trackedWeapons[0].assignedTo).toBe('Kaeya');
      expect(state.roster['Kaeya'].equippedWeaponId).toBe(wId);
    });

    it('replace existing equipped weapon updates relationships correctly', () => {
      useStore.getState().addCharacter('Kaeya');
      const w1Id = useStore.getState().addTrackedWeapon('Cool Steel', 'Kaeya');
      const w2Id = useStore.getState().addTrackedWeapon('Harbinger of Dawn', 'Kaeya');

      const state = useStore.getState();
      const w1 = state.trackedWeapons.find(w => w.id === w1Id);
      const w2 = state.trackedWeapons.find(w => w.id === w2Id);

      expect(w1.assignedTo).toBeNull();
      expect(w2.assignedTo).toBe('Kaeya');
      expect(state.roster['Kaeya'].equippedWeaponId).toBe(w2Id);
    });

    it('moving weapon between characters updates relationships correctly', () => {
      useStore.getState().addCharacter('Kaeya');
      useStore.getState().addCharacter('Jean');
      const wId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Kaeya');

      useStore.getState().assignWeaponToCharacter(wId, 'Jean');

      const state = useStore.getState();
      const w = state.trackedWeapons.find(w => w.id === wId);

      expect(state.roster['Kaeya'].equippedWeaponId).toBeNull();
      expect(state.roster['Jean'].equippedWeaponId).toBe(wId);
      expect(w.assignedTo).toBe('Jean');
    });

    it('unassignWeapon clears both sides', () => {
      useStore.getState().addCharacter('Kaeya');
      const wId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Kaeya');

      useStore.getState().unassignWeapon(wId);

      const state = useStore.getState();
      expect(state.trackedWeapons[0].assignedTo).toBeNull();
      expect(state.roster['Kaeya'].equippedWeaponId).toBeNull();
    });

    it('removeTrackedWeapon removes weapon and clears character equippedWeaponId', () => {
      useStore.getState().addCharacter('Kaeya');
      const wId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Kaeya');

      useStore.getState().removeTrackedWeapon(wId);

      const state = useStore.getState();
      expect(state.trackedWeapons.length).toBe(0);
      expect(state.roster['Kaeya'].equippedWeaponId).toBeNull();
    });
  });

  describe('updateTrackedWeapon Integrity', () => {
    it('reassigning a weapon clears the previous owners roster reference and the new owners previous weapon', () => {
      useStore.getState().addCharacter('CharA');
      useStore.getState().addCharacter('CharB');
      const wA = useStore.getState().addTrackedWeapon('SwordA', 'CharA');
      const wB = useStore.getState().addTrackedWeapon('SwordB', 'CharB');

      // Assign CharA's weapon to CharB via updateTrackedWeapon
      useStore.getState().updateTrackedWeapon(wA, { assignedTo: 'CharB' });

      const state = useStore.getState();
      const updatedWA = state.trackedWeapons.find(w => w.id === wA);
      const updatedWB = state.trackedWeapons.find(w => w.id === wB);

      expect(updatedWA.assignedTo).toBe('CharB');
      expect(updatedWB.assignedTo).toBeNull(); // CharB's old weapon should be ripped out
      expect(state.roster['CharA'].equippedWeaponId).toBeNull();
      expect(state.roster['CharB'].equippedWeaponId).toBe(wA);
    });
  });

  describe('Batch Weapon Removal', () => {
    it('batchRemoveWeapons removes targeted weapons and clears roster references', () => {
      useStore.getState().addCharacter('CharA');
      useStore.getState().addCharacter('CharB');
      const wA = useStore.getState().addTrackedWeapon('SwordA', 'CharA');
      const wB = useStore.getState().addTrackedWeapon('SwordB', 'CharB');

      useStore.getState().batchRemoveWeapons([wA]);

      const state = useStore.getState();
      expect(state.trackedWeapons.length).toBe(1);
      expect(state.trackedWeapons[0].id).toBe(wB);
      expect(state.roster['CharA'].equippedWeaponId).toBeNull();
      expect(state.roster['CharB'].equippedWeaponId).toBe(wB);
    });
  });

  describe('Character bulkUpdateCharacters NEW: weapon behavior', () => {
    it('bulkUpdateCharacters replaces NEW: prefix with actual UUID and assigns weapon', () => {
      useStore.getState().addCharacter('CharA');

      useStore.getState().bulkUpdateCharacters(['CharA'], { equippedWeaponId: 'NEW:Dull Blade' });

      const state = useStore.getState();
      const newWeaponId = state.roster['CharA'].equippedWeaponId;

      expect(newWeaponId).toBeDefined();
      expect(newWeaponId).not.toContain('NEW:');

      const weapon = state.trackedWeapons.find(w => w.id === newWeaponId);
      expect(weapon).toBeDefined();
      expect(weapon.weaponName).toBe('Dull Blade');
      expect(weapon.assignedTo).toBe('CharA');
    });
  });

  describe('Inventory State', () => {
    it('setInventory does not allow a negative stored quantity', () => {
      useStore.getState().setInventory('Mora', -50);
      expect(useStore.getState().inventory['Mora']).toBe(0);
    });

    it('incrementInventory updates correctly', () => {
      useStore.getState().incrementInventory('Mora', 100);
      expect(useStore.getState().inventory['Mora']).toBe(100);
      useStore.getState().incrementInventory('Mora', -50);
      expect(useStore.getState().inventory['Mora']).toBe(50);
    });
  });

  describe('Backup Import State Safety', () => {
    it('importData ignores malicious arbitrary fields', () => {
      const maliciousData = {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        serverRegion: 'Asia',
        showDbBuilder: false,
        maliciousUnexpectedField: 'should-not-enter-store'
      };

      useStore.getState().importData(maliciousData);
      const state = useStore.getState();
      expect(state.maliciousUnexpectedField).toBeUndefined();
    });
  });

  describe('GOOD Import Store Safety', () => {
    it('importGoodData ignores non-canonical material keys', () => {
      const goodPayload = {
        format: 'GOOD',
        materials: {
          'Mora': 123,
          'TotallyFakeMaterial': 999
        }
      };

      useStore.getState().importGoodData(goodPayload);
      const inventory = useStore.getState().inventory;

      expect(inventory['Mora']).toBe(123);
      expect(inventory['TotallyFakeMaterial']).toBeUndefined();
    });

    it('importGoodData canonical integration', () => {
      const goodPayload = {
        format: 'GOOD',
        characters: [{ name: 'Venti', level: 80, ascension: 5, talents: { normal: 6, skill: 6, burst: 6 } }],
        weapons: [{ weaponName: 'The Stringless', level: 80, ascension: 5, refinement: 1, location: 'Venti' }]
      };

      useStore.getState().importGoodData(goodPayload);
      const state = useStore.getState();

      expect(state.roster['Venti']).toBeDefined();
      expect(state.roster['Venti'].level).toBe(80);

      const weapon = state.trackedWeapons.find(w => w.weaponName === 'The Stringless');
      expect(weapon).toBeDefined();
      expect(state.roster['Venti'].equippedWeaponId).toBe(weapon.id);
    });

    it('importGoodData character preserves existing target fields', () => {
      useStore.getState().addCharacter('Venti');
      useStore.getState().updateCharacter('Venti', {
        targetLevel: 70,
        targetAscension: 4,
        targetTalents: { normal: 8, skill: 8, burst: 8 }
      });

      const goodPayload = {
        format: 'GOOD',
        characters: [{ name: 'Venti', level: 60, ascension: 3, talents: { normal: 4, skill: 4, burst: 4 } }],
        weapons: []
      };

      useStore.getState().importGoodData(goodPayload);
      const state = useStore.getState();

      expect(state.roster['Venti'].targetLevel).toBe(70);
      expect(state.roster['Venti'].targetAscension).toBe(4);
      expect(state.roster['Venti'].targetTalents).toEqual({ normal: 8, skill: 8, burst: 8 });
      expect(state.roster['Venti'].level).toBe(60); // from GOOD
    });

    it('importGoodData weapon preserves existing targetLevel/targetAscension on match', () => {
      useStore.getState().addCharacter('Venti');
      const wId = useStore.getState().addTrackedWeapon('The Stringless', 'Venti');
      useStore.getState().updateTrackedWeapon(wId, {
        targetLevel: 80,
        targetAscension: 5
      });

      const goodPayload = {
        format: 'GOOD',
        characters: [],
        weapons: [{ weaponName: 'The Stringless', level: 70, ascension: 4, location: 'Venti' }]
      };

      useStore.getState().importGoodData(goodPayload);
      const state = useStore.getState();
      const weapon = state.trackedWeapons.find(w => w.weaponName === 'The Stringless');

      expect(weapon.targetLevel).toBe(80);
      expect(weapon.targetAscension).toBe(5);
      expect(weapon.level).toBe(70); // from GOOD
    });

    it('importGoodData weapon unknown cost behavior does not crash', () => {
      const goodPayload = {
        format: 'GOOD',
        characters: [],
        weapons: [{ weaponName: 'Unknown Weapon That Does Not Exist', level: 70, ascension: 4, location: '' }]
      };

      expect(() => {
        useStore.getState().importGoodData(goodPayload);
      }).not.toThrow();

      const state = useStore.getState();
      const weapon = state.trackedWeapons.find(w => w.weaponName === 'Unknown Weapon That Does Not Exist');
      expect(weapon).toBeDefined();
      expect(weapon.costs).toBeUndefined(); // Should not have calculated costs since it doesn't exist in data
    });
  });

  describe('Reset Behavior', () => {
    it('resetStore clears state to defaults without network calls', () => {
      useStore.getState().addCharacter('CharA');
      useStore.getState().setInventory('Mora', 100);

      useStore.getState().resetStore();

      const state = useStore.getState();
      expect(Object.keys(state.roster).length).toBe(0);
      expect(state.trackedWeapons.length).toBe(0);
      expect(Object.keys(state.inventory).length).toBe(0);
      expect(state.goals.length).toBe(0);
      expect(state.serverRegion).toBe('Asia');
      expect(state.showDbBuilder).toBe(false);
      expect(state.autoBackupEnabled).toBe(false);
      expect(state.resinCount).toBe(200);
      expect(state.resinTimestamp).toBeDefined();
    });
  });

  describe('Persistence Safety', () => {
    it('does not persist authentication fields', () => {
      // Manually set auth fields that shouldn't be persisted
      useStore.setState({
        googleConnected: true,
        googleUser: { name: 'Test' },
        hoyolabConnected: true,
        syncPayload: { someData: 123 }
      });

      // Zustand persist middleware exposes partialize if we check the config
      // But a more robust way is to check localStorage directly if the persist middleware has written.
      // We will trigger a persist by updating a valid field, wait a tick, then inspect localStorage.

      useStore.setState({ serverRegion: 'Europe' });

      const rawStored = window.localStorage.getItem('travelers-toolkit-store');
      expect(rawStored).not.toBeNull();

      const stored = JSON.parse(rawStored);
      const persistedState = stored.state;

      expect(persistedState.serverRegion).toBe('Europe');
      expect(persistedState.googleConnected).toBeUndefined();
      expect(persistedState.googleUser).toBeUndefined();
      expect(persistedState.hoyolabConnected).toBeUndefined();
      expect(persistedState.syncPayload).toBeUndefined();
      expect(persistedState.googleAccessToken).toBeUndefined();
      expect(persistedState.tokenExpiry).toBeUndefined();
      expect(persistedState.hoyolabLtuid).toBeUndefined();
      expect(persistedState.hoyolabLtoken).toBeUndefined();
    });
  });
});
