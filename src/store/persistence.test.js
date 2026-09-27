import { describe, it, expect } from 'vitest';
import { migrateStore, partializeStore } from './persistence';

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
});
