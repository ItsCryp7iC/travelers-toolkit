import { describe, it, expect } from 'vitest';
import { migrateStore, partializeStore } from './persistence';
import useStore from './useStore';

describe('Zustand Persistence Migrations', () => {
  it('migrates v1 -> v2 (legacy weapons)', () => {
    // Stub randomUUID for this test if not natively available
    if (!globalThis.crypto) globalThis.crypto = {};
    if (!globalThis.crypto.randomUUID) {
      let counter = 0;
      globalThis.crypto.randomUUID = () => `test-uuid-${counter++}`;
    }

    const legacyState = {
      roster: {
        'Amber': {
          level: 20,
          equippedWeapon: 'Hunters Bow',
          weaponLevel: 20,
          weaponAscension: 1,
          targetWeaponLevel: 90,
          targetWeaponAscension: 6,
        },
        'Kaeya': {
          level: 40,
        } // no weapon
      }
    };

    const migrated = migrateStore(legacyState, 1);

    // Kaeya should remain unchanged
    expect(migrated.roster['Kaeya'].equippedWeapon).toBeUndefined();

    // Amber should have weapon migrated to trackedWeapons
    expect(migrated.roster['Amber'].equippedWeapon).toBeUndefined();
    expect(migrated.roster['Amber'].weaponLevel).toBeUndefined();

    const weaponId = migrated.roster['Amber'].equippedWeaponId;
    expect(weaponId).toBeDefined();

    expect(migrated.trackedWeapons.length).toBe(1);
    const w = migrated.trackedWeapons[0];
    expect(w.id).toBe(weaponId);
    expect(w.weaponName).toBe('Hunters Bow');
    expect(w.level).toBe(20);
    expect(w.ascension).toBe(1);
    expect(w.targetLevel).toBe(90);
    expect(w.targetAscension).toBe(6);
    expect(w.assignedTo).toBe('Amber');
  });

  it('migrates v3 -> v5', () => {
    const legacyState = {
      craftQueue: ['something'],
      trackedWeapons: [
        { id: 'w1', weaponName: 'Favonius Sword' }
      ],
      googleAccessToken: 'secret',
      hoyolabLtuid: '123'
    };

    const migrated = migrateStore(legacyState, 3);

    // v3 -> v4
    expect(migrated.craftQueue).toBeUndefined();
    expect(migrated.trackedWeapons[0].currentRefinement).toBe(1);
    expect(migrated.trackedWeapons[0].targetRefinement).toBe(1);

    // v4 -> v5
    expect(migrated.googleAccessToken).toBeUndefined();
    expect(migrated.hoyolabLtuid).toBeUndefined();
  });

  it('migrates v4 -> v5 (sensitive fields removed)', () => {
    const legacyState = {
      roster: { 'Amber': {} },
      trackedWeapons: [],
      googleAccessToken: 'secret',
      tokenExpiry: 123,
      googleUser: { name: 'User' },
      hoyolabLtuid: '123',
      hoyolabLtoken: 'secret',
      syncPayload: 'someData' // wait, this was not removed in v5 migration actually, only auth fields!
    };

    const migrated = migrateStore(legacyState, 4);

    expect(migrated.roster).toBeDefined();
    expect(migrated.trackedWeapons).toBeDefined();

    expect(migrated.googleAccessToken).toBeUndefined();
    expect(migrated.tokenExpiry).toBeUndefined();
    expect(migrated.googleUser).toBeUndefined();
    expect(migrated.hoyolabLtuid).toBeUndefined();
    expect(migrated.hoyolabLtoken).toBeUndefined();
  });

  it('migrates v1 -> v2 without trackedWeapons array', () => {
    const legacyState = {
      roster: {}
    };
    const migrated = migrateStore(legacyState, 1);
    expect(Array.isArray(migrated.trackedWeapons)).toBe(true);
    expect(migrated.trackedWeapons.length).toBe(0);
  });

  it('migrates v1 -> v2 does not duplicate if equippedWeaponId exists', () => {
    const legacyState = {
      roster: {
        'Amber': {
          equippedWeapon: 'Hunters Bow',
          equippedWeaponId: 'existing-id'
        }
      },
      trackedWeapons: []
    };
    const migrated = migrateStore(legacyState, 1);
    expect(migrated.trackedWeapons.length).toBe(0);
  });

  it('migrates v2 -> v3 initializes craftQueue and v4 removes it', () => {
    const legacyState = {};
    const migrated = migrateStore(legacyState, 2);
    // craftQueue is initialized in v3 but removed in v4
    expect(migrated.craftQueue).toBeUndefined();
  });

  it('migrates v6 -> v7 initializes achievementProgress', () => {
    const legacyState = {
      displayTimeZone: 'Asia/Tokyo'
    };
    const migrated = migrateStore(legacyState, 6);
    expect(migrated.achievementProgress).toEqual({});
    expect(migrated.displayTimeZone).toBe('Asia/Tokyo');
  });

  it('rehydrates historical achievement states securely (re-normalization)', () => {
    const legacyState = {
      achievementProgress: {
        '80129': { completed: true, completedAt: '2026-01-01T00:00:00.000Z' }
      }
    };
    const migrated = migrateStore(legacyState, 6);
    expect(migrated.achievementProgress['80127']).toEqual({ completed: true, completedAt: null });
    expect(migrated.achievementProgress['80128']).toEqual({ completed: true, completedAt: null });
    expect(migrated.achievementProgress['80129']).toEqual({ completed: true, completedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('migrates v7 -> v8 initializes lastHoyolabCharacterSyncAt to null if missing', () => {
    const legacyState = {};
    const migrated = migrateStore(legacyState, 7);
    expect(migrated.lastHoyolabCharacterSyncAt).toBeNull();
  });

  it('migrates v7 -> v8 preserves existing valid lastHoyolabCharacterSyncAt', () => {
    const legacyState = {
      lastHoyolabCharacterSyncAt: 1234567890
    };
    const migrated = migrateStore(legacyState, 7);
    expect(migrated.lastHoyolabCharacterSyncAt).toBe(1234567890);
  });

  it('migrates v7 -> v8 nullifies malformed timestamp', () => {
    const legacyState = {
      lastHoyolabCharacterSyncAt: "not-a-number"
    };
    const migrated = migrateStore(legacyState, 7);
    expect(migrated.lastHoyolabCharacterSyncAt).toBeNull();
  });

  it('migrates older state -> v8 completely', () => {
    const legacyState = {
      roster: {
        'Amber': {
          equippedWeapon: 'Hunters Bow',
          weaponLevel: 20
        }
      }
    };
    const migrated = migrateStore(legacyState, 1);
    expect(migrated.lastHoyolabCharacterSyncAt).toBeNull();
    expect(migrated.trackedWeapons.length).toBe(1);
    expect(migrated.achievementProgress).toEqual({});
  });

  it('partializeStore returns exactly the persisted whitelist', () => {
    const fullState = {
      autoBackupEnabled: true,
      goals: [],
      inventory: {},
      resinCount: 160,
      resinTimestamp: 1000,
      roster: {},
      serverRegion: 'Europe',
      showDbBuilder: true,
      trackedWeapons: [],
      // Extra auth fields
      googleConnected: true,
      googleUser: { name: 'Test' },
      googleAccessToken: 'secret',
      hoyolabConnected: true,
      syncPayload: 'data',
      displayTimeZone: 'auto'
    };
    const result = partializeStore(fullState);
    const keys = Object.keys(result).sort();
    expect(keys).toEqual([
      'achievementProgress',
      'autoBackupEnabled',
      'displayTimeZone',
      'goals',
      'inventory', 'lastHoyolabCharacterSyncAt', 'resinCount',
      'resinTimestamp',
      'roster',
      'serverRegion',
      'showDbBuilder',
      'trackedWeapons'
    ]);
  });

  it('hydrates representative pre-Phase-3 persisted state completely without loss or corruption', async () => {
    const prePhase3PersistedState = {
      roster: {
        'Amber': {
          level: 80,
          ascension: 5,
          targetLevel: 90,
          targetAscension: 6,
          talents: { normal: 6, skill: 6, burst: 6 },
          equippedWeaponId: 'weapon-amber-favonius'
        },
        'Traveler Geo': {
          level: 70,
          ascension: 4,
          targetLevel: 80,
          targetAscension: 5,
          talents: { normal: 6, skill: 6, burst: 6 },
          equippedWeaponId: null // Traveler invariant: equippedWeaponId is null
        },
        'Traveler Anemo': {
          level: 70,
          ascension: 4,
          targetLevel: 80,
          targetAscension: 5,
          talents: { normal: 1, skill: 1, burst: 1 },
          equippedWeaponId: null
        }
      },
      trackedWeapons: [
        {
          id: 'weapon-amber-favonius',
          weaponName: 'Favonius Warbow',
          level: 80,
          ascension: 5,
          targetLevel: 90,
          targetAscension: 6,
          currentRefinement: 3,
          targetRefinement: 5,
          assignedTo: 'Amber'
        },
        {
          id: 'weapon-traveler-favonius',
          weaponName: 'Favonius Sword',
          level: 70,
          ascension: 4,
          targetLevel: 80,
          targetAscension: 5,
          currentRefinement: 1,
          targetRefinement: 1,
          assignedTo: 'Traveler Geo'
        }
      ],
      inventory: {
        mora: 1500000,
        hero_wit: 250,
        brilliant_diamond_sliver: 1
      },
      goals: [
        { id: 'goal-1', character: 'Amber', type: 'ascension' }
      ],
      resinCount: 145,
      resinTimestamp: 1710000000000,
      serverRegion: 'America',
      showDbBuilder: false,
      autoBackupEnabled: true,
      displayTimeZone: 'America/New_York',
      achievementProgress: {
        '80129': { completed: true, completedAt: '2026-01-01T12:00:00.000Z' },
        '80001': { completed: true, completedAt: null }
      },
      lastHoyolabCharacterSyncAt: 1710000500000
    };

    // 1. Migration check: v8 input should pass through cleanly
    const migratedV8 = migrateStore(prePhase3PersistedState, 8);
    expect(migratedV8.roster).toEqual(prePhase3PersistedState.roster);
    expect(migratedV8.trackedWeapons).toEqual(prePhase3PersistedState.trackedWeapons);
    expect(migratedV8.displayTimeZone).toBe('America/New_York');
    expect(migratedV8.lastHoyolabCharacterSyncAt).toBe(1710000500000);

    // 2. Full hydration via Zustand persist
    window.localStorage.setItem(
      'travelers-toolkit-store',
      JSON.stringify({
        state: prePhase3PersistedState,
        version: 8
      })
    );

    await useStore.persist.rehydrate();
    const hydrated = useStore.getState();

    // Verify roster and Traveler invariants
    expect(hydrated.roster['Amber'].level).toBe(80);
    expect(hydrated.roster['Amber'].equippedWeaponId).toBe('weapon-amber-favonius');
    expect(hydrated.roster['Traveler Geo'].equippedWeaponId).toBeNull();
    expect(hydrated.roster['Traveler Anemo'].equippedWeaponId).toBeNull();

    // Verify weapon tracking and assignment
    expect(hydrated.trackedWeapons.length).toBe(2);
    expect(hydrated.trackedWeapons[0].assignedTo).toBe('Amber');
    expect(hydrated.trackedWeapons[1].assignedTo).toBe('Traveler Geo');

    // Verify inventory, goals, resin
    expect(hydrated.inventory.mora).toBe(1500000);
    expect(hydrated.inventory.hero_wit).toBe(250);
    expect(hydrated.goals.length).toBe(1);
    expect(hydrated.resinCount).toBe(145);

    // Verify settings, region, timezone, sync
    expect(hydrated.serverRegion).toBe('America');
    expect(hydrated.showDbBuilder).toBe(false);
    expect(hydrated.autoBackupEnabled).toBe(true);
    expect(hydrated.displayTimeZone).toBe('America/New_York');
    expect(hydrated.lastHoyolabCharacterSyncAt).toBe(1710000500000);

    // Verify achievement progress
    expect(hydrated.achievementProgress['80129']).toEqual({
      completed: true,
      completedAt: '2026-01-01T12:00:00.000Z'
    });

    // Verify partialize produces exact clean schema without leaking any catalog definitions
    const persisted = partializeStore(hydrated);
    expect(persisted).toEqual(prePhase3PersistedState);
  });
});
