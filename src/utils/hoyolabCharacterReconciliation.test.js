import { describe, it, expect } from 'vitest';
import { reconcileCharacters } from './hoyolabCharacterReconciliation';

describe('hoyolabCharacterReconciliation', () => {
  it('new character', () => {
    const syncArray = [{
      id: 10000046, // Hu Tao
      level: 90,
      ascension: 6,
      talents: { normal: 10, skill: 10, burst: 10 },
      weapon: { id: 13501, level: 90, ascension: 6, refinement: 1 }
    }];
    const roster = {};
    const trackedWeapons = [];

    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.summary.newCharacters).toBe(1);

    const c = res.characters[0];
    expect(c.status).toBe('new');
    expect(c.canonicalId).toBe('HuTao');
    expect(c.weaponReconciliation.status).toBe('would-create');
  });

  it('unchanged character', () => {
    const syncArray = [{
      id: 10000046,
      level: 80,
      ascension: 5,
      talents: { normal: 8, skill: 8, burst: 8 },
      weapon: { id: 13501, level: 90, ascension: 6, refinement: 1 }
    }];
    const roster = {
      'Hu Tao': {
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        equippedWeaponId: 'uuid1'
      }
    };
    const trackedWeapons = [
      { id: 'uuid1', weapon_id: 'staffofhoma', level: 90, ascension: 6, currentRefinement: 1, assignedTo: 'Hu Tao' }
    ];

    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.summary.unchangedCharacters).toBe(1);
    expect(res.summary.weaponMatched).toBe(1);

    const c = res.characters[0];
    expect(c.status).toBe('unchanged');
    expect(c.weaponReconciliation.status).toBe('matched-instance');
    expect(c.weaponReconciliation.changes).toEqual({});
  });

  it('remote higher level / ascension / talents', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      ascension: 6,
      talents: { normal: 10, skill: 10, burst: 10 }
    }];
    const roster = {
      'Hu Tao': {
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 }
      }
    };
    const trackedWeapons = [];

    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.summary.charactersWithUpdates).toBe(1);
    expect(res.summary.localAheadCharacters).toBe(0);

    const c = res.characters[0];
    expect(c.status).toBe('update');
    expect(c.changes.level.direction).toBe('remote-ahead');
    expect(c.changes.ascension.direction).toBe('remote-ahead');
    expect(c.changes.talents.normal.direction).toBe('remote-ahead');
  });

  it('local higher level (local-ahead)', () => {
    const syncArray = [{
      id: 10000046,
      level: 80,
      ascension: 5,
      talents: { normal: 8, skill: 8, burst: 8 }
    }];
    const roster = {
      'Hu Tao': {
        level: 90,
        ascension: 6,
        talents: { normal: 8, skill: 8, burst: 8 }
      }
    };
    const res = reconcileCharacters(syncArray, roster, []);
    expect(res.summary.localAheadCharacters).toBe(1);
    expect(res.characters[0].changes.level.direction).toBe('local-ahead');
  });

  it('mixed direction changes', () => {
    const syncArray = [{
      id: 10000046,
      level: 80,
      ascension: 5,
      talents: { normal: 8, skill: 8, burst: 8 }
    }];
    const roster = {
      'Hu Tao': {
        level: 90,
        ascension: 6,
        talents: { normal: 6, skill: 6, burst: 6 }
      }
    };
    const res = reconcileCharacters(syncArray, roster, []);
    expect(res.characters[0].changes.level.direction).toBe('local-ahead');
    expect(res.characters[0].changes.ascension.direction).toBe('local-ahead');
    expect(res.characters[0].changes.talents.normal.direction).toBe('remote-ahead');
  });

  it('invalid remote progression state', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      ascension: 5 // Impossible, max level for A5 is 80
    }];
    const roster = { 'Hu Tao': { level: 80, ascension: 5 } };
    const res = reconcileCharacters(syncArray, roster, []);
    expect(res.characters[0].status).toBe('conflict');
    expect(res.summary.charactersWithConflicts).toBe(1);
  });

  it('equipment mismatch', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      weapon: { id: 13501 } // Staff of Homa
    }];
    const roster = {
      'Hu Tao': { level: 90, equippedWeaponId: 'uuid1' }
    };
    const trackedWeapons = [
      { id: 'uuid1', weapon_id: 'dragonsbane', assignedTo: 'Hu Tao' }
    ];
    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.characters[0].weaponReconciliation.status).toBe('equipment-mismatch');
  });

  it('weapon would-create', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      weapon: { id: 13501 } // Staff of Homa
    }];
    const roster = {
      'Hu Tao': { level: 90 } // No weapon
    };
    const res = reconcileCharacters(syncArray, roster, []);
    expect(res.characters[0].weaponReconciliation.status).toBe('would-create');
  });

  it('weapon one candidate (suggested)', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      weapon: { id: 13501 } // Staff of Homa
    }];
    const roster = {
      'Hu Tao': { level: 90 }
    };
    const trackedWeapons = [
      { id: 'uuid_homa', weapon_id: 'staffofhoma', assignedTo: null }
    ];
    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.characters[0].weaponReconciliation.status).toBe('suggested-instance');
    expect(res.characters[0].weaponReconciliation.candidates.length).toBe(1);
  });

  it('weapon multiple candidates (ambiguous)', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      weapon: { id: 13501 }
    }];
    const roster = { 'Hu Tao': { level: 90 } };
    const trackedWeapons = [
      { id: 'uuid_homa1', weapon_id: 'staffofhoma', assignedTo: null },
      { id: 'uuid_homa2', weapon_id: 'staffofhoma', assignedTo: null }
    ];
    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.characters[0].weaponReconciliation.status).toBe('ambiguous');
    expect(res.characters[0].weaponReconciliation.candidates.length).toBe(2);
  });

  it('empty roster scenario', () => {
    const syncArray = [{ id: 10000046, level: 90, weapon: { id: 13501, level: 90 } }];
    const roster = {};
    const trackedWeapons = [];

    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.summary.newCharacters).toBe(1);
    expect(res.summary.weaponWouldCreate).toBe(1);
    expect(res.characters[0].status).toBe('new');
    expect(res.characters[0].weaponReconciliation.status).toBe('would-create');
  });

  it('stale local characters are ignored', () => {
    const syncArray = [];
    const roster = { 'Hu Tao': { level: 90 } };
    const res = reconcileCharacters(syncArray, roster, []);
    expect(res.characters.length).toBe(0);
    // There should be no characters in the reconciliation result since it only maps remote characters
  });

  it('target fields are immutable and ignored in comparison', () => {
    const syncArray = [{ id: 10000046, level: 80, ascension: 5, weapon: { id: 13501, level: 80, ascension: 5 } }];
    const roster = {
      'Hu Tao': {
        level: 80, ascension: 5,
        targetLevel: 90, targetAscension: 6,
        targetTalents: { normal: 10, skill: 10, burst: 10 },
        equippedWeaponId: 'w1'
      }
    };
    const trackedWeapons = [{
      id: 'w1', weapon_id: 'staffofhoma', level: 80, ascension: 5,
      targetLevel: 90, targetAscension: 6, targetRefinement: 5,
      assignedTo: 'Hu Tao'
    }];

    const res = reconcileCharacters(syncArray, roster, trackedWeapons);
    expect(res.characters[0].status).toBe('unchanged');
    expect(res.characters[0].weaponReconciliation.status).toBe('matched-instance');
  });

  it('excludes Manekin records intentionally', () => {
    const syncArray = [
      { id: 10000117, level: 90 }, // Manekin
      { id: 10000118, level: 90 }, // Manekina
      { id: 10000046, level: 90 }  // Hu Tao
    ];

    const res = reconcileCharacters(syncArray, {}, []);
    expect(res.summary.totalRemote).toBe(3);
    expect(res.summary.ignored).toBe(2);
    expect(res.summary.syncRelevant).toBe(1);
    expect(res.summary.newCharacters).toBe(1); // Only Hu Tao is new

    const ignored = res.characters.filter(c => c.status === 'ignored');
    expect(ignored.length).toBe(2);
    expect(ignored[0].hoyolabId).toBe(10000117);
    expect(ignored[1].hoyolabId).toBe(10000118);
  });
  it('existing character + remote talents missing -> no talent diff, local untouched', () => {
    const syncArray = [{ id: 10000046, level: 80, ascension: 5 }]; // No talents
    const roster = {
      'Hu Tao': {
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 }
      }
    };
    const res = reconcileCharacters(syncArray, roster, []);
    expect(res.summary.unchangedCharacters).toBe(1);
    const c = res.characters[0];
    expect(c.status).toBe('unchanged');
    expect(c.changes).toEqual({});
    expect(c.hoyolab.talents).toBeUndefined();
  });

  it('new ordinary character + remote talents missing -> no fake 1/1/1 diff', () => {
    const syncArray = [{ id: 10000046, level: 90, ascension: 6 }]; // No talents
    const res = reconcileCharacters(syncArray, {}, []);
    expect(res.summary.newCharacters).toBe(1);
    const c = res.characters[0];
    expect(c.status).toBe('new');
    expect(c.changes).toEqual({});
    expect(c.hoyolab.talents).toBeUndefined();
  });
});
