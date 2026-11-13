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

  it('existing character + partial missing talent (burst) -> preserves local burst, diffs others', () => {
    const syncArray = [{
      id: 10000046,
      level: 90,
      ascension: 6,
      talents: { normal: 10, skill: 10, burst: null }
    }];
    const roster = {
      'Hu Tao': {
        level: 90,
        ascension: 6,
        talents: { normal: 8, skill: 8, burst: 8 }
      }
    };
    const res = reconcileCharacters(syncArray, roster, []);
    const c = res.characters[0];
    expect(c.status).toBe('update');
    expect(c.changes.talents.normal.direction).toBe('remote-ahead');
    expect(c.changes.talents.skill.direction).toBe('remote-ahead');
    expect(c.changes.talents.burst).toBeUndefined(); // Burst must NOT be diffed (local 8 is preserved instead of defaulting to 1)
  });

  describe('Phase D: Malformed / Partial Remote Data', () => {
    it('missing talents on existing character does not overwrite with 1/1/1', () => {
      const syncArray = [{ id: 10000046, level: 90 }]; // Hu Tao without talents
      const roster = {
        'Hu Tao': { level: 80, talents: { normal: 8, skill: 8, burst: 8 } }
      };
      const res = reconcileCharacters(syncArray, roster, []);
      expect(res.characters[0].status).toBe('update');
      expect(res.characters[0].hasTalentDiff).toBeFalsy();
    });

    it('missing talents on ordinary new character does not invent diff', () => {
      const syncArray = [{ id: 10000046, level: 90 }]; // Hu Tao without talents
      const res = reconcileCharacters(syncArray, {}, []);
      expect(res.characters[0].status).toBe('new');
      expect(res.characters[0].hasTalentDiff).toBeFalsy();
    });

    it('unmapped character is safely skipped', () => {
      const syncArray = [{ id: 99999999, level: 90 }];
      const res = reconcileCharacters(syncArray, {}, []);
      expect(res.characters[0].status).toBe('unmapped');
    });

    it('malformed optional weapon data is handled', () => {
      const syncArray = [{ id: 10000046, level: 90, weapon: { id: null, level: null } }];
      const res = reconcileCharacters(syncArray, {}, []);
      expect(res.characters[0].weaponReconciliation.status).toBe('unmapped');
    });
  });

  describe('Phase D: Large-Account Dry Run', () => {
    it('builds internally consistent plan for large account', () => {
      const syncArray = [
        { id: 10000002, level: 90, ascension: 6, weapon: { id: 11414, level: 90, refinement: 1 } }, // Ayaka (unchanged)
        { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90, refinement: 1 } }, // Hu Tao (update)
        { id: 10000030, level: 80, ascension: 5, weapon: { id: 11501, level: 80, refinement: 1 } }, // Zhongli (new)
        { id: 10000007, level: 90, ascension: 6, element: 'Geo', weapon: { id: 11401, level: 90 } }, // Traveler Geo (active)
        { id: 10000117, level: 90 } // Manekin
      ];

      const roster = {
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w1' },
        'Hu Tao': { level: 80, ascension: 5 },
        'Traveler Anemo': { level: 70, ascension: 4 }
      };

      const trackedWeapons = [
        { id: 'w1', weapon_id: 'amenomakageuchi', level: 90, currentRefinement: 1, assignedTo: 'Kamisato Ayaka' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);

      expect(res.summary.totalRemote).toBe(5);
      expect(res.summary.ignored).toBe(1); // Manekin
      expect(res.summary.syncRelevant).toBe(4);
      expect(res.summary.newCharacters).toBe(2); // Zhongli, Traveler Geo (new variant)
      expect(res.summary.charactersWithUpdates).toBe(1); // Hu Tao
      // Wait, Traveler Geo is active, local roster has Traveler Anemo. Active traveler gets mapped to active element (Geo).
      // Since Geo is not in roster, it's 'new' status. Let's check:
      const geoTraveler = res.characters.find(c => c.rosterKey === 'Traveler Geo');
      expect(geoTraveler.status).toBe('new');
    });
  });

  describe('STAGE C1: WEAPON RECONCILIATION & CLASSIFICATION', () => {
    it('exact Ayaka scenario: weapon-only level change classifies as WEAPON-UPDATE', () => {
      const syncArray = [{
        id: 10000002, // Kamisato Ayaka
        level: 90,
        ascension: 6,
        talents: { normal: 10, skill: 10, burst: 10 },
        weapon: { id: 11414, level: 90, ascension: 6, refinement: 1 } // Amenoma Kageuchi Lv 90
      }];

      const roster = {
        'Kamisato Ayaka': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'w-ayaka-amenoma'
        }
      };

      const trackedWeapons = [{
        id: 'w-ayaka-amenoma',
        weapon_id: 'amenomakageuchi',
        weaponName: 'Amenoma Kageuchi',
        level: 80,
        ascension: 5,
        currentRefinement: 1,
        assignedTo: 'Kamisato Ayaka'
      }];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.status).toBe('weapon-update');
      expect(ayaka.characterDiff).toBe(false);
      expect(ayaka.weaponDiff).toBe(true);
      expect(ayaka.weaponResolution).toBe('update-existing');
      expect(ayaka.weaponReconciliation.status).toBe('matched-instance');
      expect(ayaka.weaponReconciliation.hasWeaponUpdate).toBe(true);
      expect(ayaka.weaponReconciliation.changes.level.direction).toBe('remote-ahead');
      expect(ayaka.weaponReconciliation.changes.level.local).toBe(80);
      expect(ayaka.weaponReconciliation.changes.level.remote).toBe(90);

      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(1);
      expect(res.summary.unchangedCharacters).toBe(0);
    });

    it('same weapon refinement-only change classifies as WEAPON-UPDATE', () => {
      const syncArray = [{
        id: 10000002,
        level: 90,
        ascension: 6,
        weapon: { id: 11414, level: 90, ascension: 6, refinement: 5 } // R5
      }];

      const roster = {
        'Kamisato Ayaka': {
          level: 90,
          ascension: 6,
          equippedWeaponId: 'w-ayaka-amenoma'
        }
      };

      const trackedWeapons = [{
        id: 'w-ayaka-amenoma',
        weapon_id: 'amenomakageuchi',
        weaponName: 'Amenoma Kageuchi',
        level: 90,
        ascension: 6,
        currentRefinement: 3, // R3
        assignedTo: 'Kamisato Ayaka'
      }];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.status).toBe('weapon-update');
      expect(ayaka.characterDiff).toBe(false);
      expect(ayaka.weaponDiff).toBe(true);
      expect(ayaka.weaponReconciliation.changes.refinement.direction).toBe('remote-ahead');
      expect(ayaka.weaponReconciliation.changes.refinement.local).toBe(3);
      expect(ayaka.weaponReconciliation.changes.refinement.remote).toBe(5);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(1);
    });

    it('combined character and weapon change is single UPDATE row without double-counting', () => {
      const syncArray = [{
        id: 10000046, // Hu Tao
        level: 90,
        ascension: 6,
        weapon: { id: 13501, level: 90, ascension: 6, refinement: 1 }
      }];

      const roster = {
        'Hu Tao': {
          level: 80,
          ascension: 5,
          equippedWeaponId: 'w-homa'
        }
      };

      const trackedWeapons = [{
        id: 'w-homa',
        weapon_id: 'staffofhoma',
        weaponName: 'Staff of Homa',
        level: 80,
        ascension: 5,
        currentRefinement: 1,
        assignedTo: 'Hu Tao'
      }];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const huTao = res.characters[0];

      expect(huTao.status).toBe('update');
      expect(huTao.characterDiff).toBe(true);
      expect(huTao.weaponDiff).toBe(true);
      expect(res.summary.charactersWithUpdates).toBe(1);
      expect(res.summary.unchangedCharacters).toBe(0);
    });

    it('true unchanged character + weapon remains UNCHANGED', () => {
      const syncArray = [{
        id: 10000046,
        level: 90,
        ascension: 6,
        weapon: { id: 13501, level: 90, ascension: 6, refinement: 1 }
      }];

      const roster = {
        'Hu Tao': {
          level: 90,
          ascension: 6,
          equippedWeaponId: 'w-homa'
        }
      };

      const trackedWeapons = [{
        id: 'w-homa',
        weapon_id: 'staffofhoma',
        weaponName: 'Staff of Homa',
        level: 90,
        ascension: 6,
        currentRefinement: 1,
        assignedTo: 'Hu Tao'
      }];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const huTao = res.characters[0];

      expect(huTao.status).toBe('unchanged');
      expect(huTao.characterDiff).toBe(false);
      expect(huTao.weaponDiff).toBe(false);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.unchangedCharacters).toBe(1);
    });

    it('duplicate copies: explicitly assigned instance #2 is targeted and isolated', () => {
      const syncArray = [{
        id: 10000002, // Ayaka
        level: 90,
        ascension: 6,
        weapon: { id: 11414, level: 90, ascension: 6, refinement: 1 }
      }];

      const roster = {
        'Kamisato Ayaka': {
          level: 90,
          ascension: 6,
          equippedWeaponId: 'w-copy-2'
        }
      };

      const trackedWeapons = [
        { id: 'w-copy-1', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 50, ascension: 2, currentRefinement: 1, assignedTo: null },
        { id: 'w-copy-2', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, ascension: 5, currentRefinement: 1, assignedTo: 'Kamisato Ayaka' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.weaponReconciliation.equippedInstanceId).toBe('w-copy-2');
      expect(ayaka.weaponReconciliation.changes.level.local).toBe(80);
      expect(ayaka.weaponReconciliation.changes.level.remote).toBe(90);
    });

    it('synthetic dataset invariant: 2 new, 1 char update, 1 weapon-only update, 1 unchanged = 5 syncable', () => {
      // Test that reconcileCharacters correctly separates charactersWithUpdates from weapon changes
      const mockSync = [
        { id: 10000030, level: 80, ascension: 5 }, // new 1
        { id: 10000031, level: 80, ascension: 5 }, // new 2
        // char update only
        { id: 10000046, level: 90, ascension: 6 }, // Hu Tao local 80 -> char update
        // weapon update only
        { id: 10000002, level: 90, ascension: 6, weapon: { id: 11414, level: 90 } }, // Ayaka local char 90, weapon 80 -> weapon update
        // unchanged
        { id: 10000003, level: 80, ascension: 5, weapon: { id: 11501, level: 80 } }  // Jean local char 80, weapon 80 -> unchanged
      ];

      const mockRoster = {
        'Hu Tao': { level: 80, ascension: 5 },
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-ayaka' },
        'Jean': { level: 80, ascension: 5, equippedWeaponId: 'w-jean' }
      };

      const mockWeapons = [
        { id: 'w-ayaka', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, ascension: 5, assignedTo: 'Kamisato Ayaka' },
        { id: 'w-jean', weapon_id: 'aquilafavonia', weaponName: 'Aquila Favonia', level: 80, ascension: 5, assignedTo: 'Jean' }
      ];

      const res = reconcileCharacters(mockSync, mockRoster, mockWeapons);
      expect(res.summary.newCharacters).toBe(2);
      expect(res.summary.charactersWithUpdates).toBe(1); // Hu Tao (char)
      expect(res.summary.charactersWithWeaponChanges).toBe(1); // Ayaka (weapon)
      expect(res.summary.weaponOnlyUpdates).toBe(1); // Ayaka (weapon-only)
      expect(res.summary.unchangedCharacters).toBe(1); // Jean
      expect(res.summary.syncRelevant).toBe(5);
      expect(res.summary.newCharacters + res.summary.charactersWithUpdates + res.summary.weaponOnlyUpdates + res.summary.unchangedCharacters).toBe(5);
    });
  });

  describe('STAGE C1.1: EXISTING-WEAPON REASSIGNMENT RECONCILIATION', () => {
    it('1. unique unassigned existing remote weapon is detected as existing-tracked-match', () => {
      const syncArray = [{
        id: 10000002, // Ayaka
        level: 90,
        ascension: 6,
        weapon: { id: 11414, level: 90, refinement: 5 } // Amenoma Kageuchi
      }];
      const roster = {
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-mistsplitter' }
      };
      const trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', weaponName: 'Mistsplitter Reforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, currentRefinement: 1, assignedTo: null }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.status).toBe('weapon-update');
      expect(ayaka.characterDiff).toBe(false);
      expect(ayaka.weaponDiff).toBe(true);
      expect(ayaka.weaponReconciliation.status).toBe('existing-tracked-match');
      expect(ayaka.weaponReconciliation.candidateInstanceId).toBe('w-amenoma');
      expect(ayaka.weaponReconciliation.candidateAssignedTo).toBeNull();
      expect(ayaka.needsAttention).toBe(false); // Unassigned candidate does not need attention
      expect(ayaka.weaponReconciliation.changes.level.direction).toBe('remote-ahead');
      expect(ayaka.weaponReconciliation.changes.refinement.direction).toBe('remote-ahead');
    });

    it('2. unique existing remote weapon assigned elsewhere is detected as existing-tracked-match', () => {
      const syncArray = [{
        id: 10000002, // Ayaka
        level: 90,
        ascension: 6,
        weapon: { id: 11414, level: 90, refinement: 5 } // Amenoma Kageuchi
      }];
      const roster = {
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-mistsplitter' },
        'Skirk': { level: 90, ascension: 6, equippedWeaponId: 'w-amenoma' }
      };
      const trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', weaponName: 'Mistsplitter Reforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, currentRefinement: 1, assignedTo: 'Skirk' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.weaponReconciliation.status).toBe('existing-tracked-match');
      expect(ayaka.weaponReconciliation.candidateInstanceId).toBe('w-amenoma');
      expect(ayaka.weaponReconciliation.candidateAssignedTo).toBe('Skirk');
      // Assigned to Skirk without Skirk forming a cycle => needsAttention is true!
      expect(ayaka.needsAttention).toBe(true);
    });

    it('3. two-way swap (Ayaka <-> Jean) resolves safe cycle and sets needsAttention false for both', () => {
      const syncArray = [
        {
          id: 10000002, // Ayaka
          level: 90,
          weapon: { id: 11414, level: 90, refinement: 5 } // Amenoma
        },
        {
          id: 10000003, // Jean (canonicalId Jean)
          level: 90,
          weapon: { id: 11509, level: 90, refinement: 1 } // Mistsplitter
        }
      ];
      const roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-mistsplitter' },
        'Jean': { level: 90, equippedWeaponId: 'w-amenoma' }
      };
      const trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', weaponName: 'Mistsplitter Reforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', assignedTo: 'Jean' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters.find(c => c.canonicalId === 'KamisatoAyaka');
      const jean = res.characters.find(c => c.canonicalId === 'Jean');

      expect(ayaka.weaponReconciliation.status).toBe('existing-tracked-match');
      expect(ayaka.weaponReconciliation.candidateAssignedTo).toBe('Jean');

      expect(jean.weaponReconciliation.status).toBe('existing-tracked-match');
      expect(jean.weaponReconciliation.candidateAssignedTo).toBe('Kamisato Ayaka');

      // Both form a closed cycle, so neither needs attention on assignment grounds
      expect(ayaka.needsAttention).toBe(false);
      expect(jean.needsAttention).toBe(false);
    });

    it('4. multiple matching copies classify as ambiguous-existing-match and needsAttention', () => {
      const syncArray = [{
        id: 10000002, // Ayaka
        level: 90,
        weapon: { id: 11414, level: 90, refinement: 1 } // Amenoma
      }];
      const roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-mistsplitter' }
      };
      const trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'w-amenoma-1', weapon_id: 'amenomakageuchi', level: 90, currentRefinement: 5, assignedTo: 'Skirk' },
        { id: 'w-amenoma-2', weapon_id: 'amenomakageuchi', level: 80, currentRefinement: 1, assignedTo: null }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.weaponReconciliation.status).toBe('ambiguous-existing-match');
      expect(ayaka.weaponReconciliation.candidates.length).toBe(2);
      expect(ayaka.needsAttention).toBe(true);
    });

    it('5. same-instance Stage C1 regression: assigned same weapon is matched-instance', () => {
      const syncArray = [{
        id: 10000002, // Ayaka
        level: 90,
        weapon: { id: 11414, level: 90, refinement: 5 } // Amenoma
      }];
      const roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-amenoma' }
      };
      const trackedWeapons = [
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, currentRefinement: 1, assignedTo: 'Kamisato Ayaka' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.weaponReconciliation.status).toBe('matched-instance');
      expect(ayaka.weaponResolution).toBe('update-existing');
      expect(ayaka.weaponReconciliation.hasWeaponUpdate).toBe(true);
    });

    it('6. no existing remote weapon in armory classifies as equipment-mismatch', () => {
      const syncArray = [{
        id: 10000002, // Ayaka
        level: 90,
        weapon: { id: 11414, level: 90 } // Amenoma
      }];
      const roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-mistsplitter' }
      };
      const trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', assignedTo: 'Kamisato Ayaka' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const ayaka = res.characters[0];

      expect(ayaka.weaponReconciliation.status).toBe('equipment-mismatch');
      expect(ayaka.needsAttention).toBe(true);
    });
  });

  describe('Classification and Regression Requirements (Section 12)', () => {
    const baseHuTaoLocal = {
      level: 80,
      ascension: 5,
      talents: { normal: 8, skill: 8, burst: 8 },
      equippedWeaponId: 'w-homa'
    };
    const baseHomaTracked = {
      id: 'w-homa',
      weapon_id: 'staffofhoma',
      weaponName: 'Staff of Homa',
      level: 80,
      ascension: 5,
      currentRefinement: 1,
      assignedTo: 'Hu Tao'
    };

    it('1. Character level-only difference -> Updates', () => {
      const syncArray = [{
        id: 10000046,
        level: 90,
        ascension: 6,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 1 }
      }];
      const localHuTao = { ...baseHuTaoLocal, level: 80, ascension: 6 };
      const res = reconcileCharacters(syncArray, { 'Hu Tao': localHuTao }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('update');
      expect(char.characterDiff).toBe(true);
      expect(char.weaponDiff).toBe(false);
      expect(res.summary.charactersWithUpdates).toBe(1);
      expect(res.summary.charactersWithWeaponChanges).toBe(0);
      expect(res.summary.weaponOnlyUpdates).toBe(0);
    });

    it('2. Character ascension-only difference -> Updates', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 6,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('update');
      expect(char.characterDiff).toBe(true);
      expect(char.weaponDiff).toBe(false);
      expect(res.summary.charactersWithUpdates).toBe(1);
    });

    it('3. Normal Attack talent difference -> Updates', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 10, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('update');
      expect(char.characterDiff).toBe(true);
      expect(char.weaponDiff).toBe(false);
      expect(res.summary.charactersWithUpdates).toBe(1);
    });

    it('4. Elemental Skill talent difference -> Updates', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 10, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('update');
      expect(char.characterDiff).toBe(true);
      expect(char.weaponDiff).toBe(false);
      expect(res.summary.charactersWithUpdates).toBe(1);
    });

    it('5. Elemental Burst talent difference -> Updates', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 10 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('update');
      expect(char.characterDiff).toBe(true);
      expect(char.weaponDiff).toBe(false);
      expect(res.summary.charactersWithUpdates).toBe(1);
    });

    it('6. Weapon level-only difference -> weapon-update, not update', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 90, ascension: 5, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(1);
    });

    it('7. Weapon ascension-only difference -> weapon-update, not update', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 6, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(1);
    });

    it('8. Weapon refinement-only difference -> weapon-update, not update', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 3 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(1);
    });

    it('9. Weapon mismatch -> weapon-update with equipment-mismatch status', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 11414, level: 80 } // Amenoma (sword)
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(char.weaponReconciliation.status).toBe('equipment-mismatch');
      expect(char.needsAttention).toBe(true);
    });

    it('10. Reassignment to another tracked weapon -> weapon-update with existing-tracked-match', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 90, refinement: 2 } // Staff of Homa
      }];
      const roster = {
        'Hu Tao': { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: 'w-dragonsbane' },
        'Zhongli': { level: 90, equippedWeaponId: 'w-homa-assigned' }
      };
      const trackedWeapons = [
        { id: 'w-dragonsbane', weapon_id: 'dragonsbane', assignedTo: 'Hu Tao' },
        { id: 'w-homa-assigned', weapon_id: 'staffofhoma', level: 90, currentRefinement: 2, assignedTo: 'Zhongli' }
      ];
      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(char.weaponReconciliation.status).toBe('existing-tracked-match');
      expect(char.needsAttention).toBe(true);
    });

    it('11. Ambiguous weapon instance -> weapon-update with ambiguous status', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 90 }
      }];
      const roster = {
        'Hu Tao': { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: 'w-dragonsbane' }
      };
      const trackedWeapons = [
        { id: 'w-dragonsbane', weapon_id: 'dragonsbane', assignedTo: 'Hu Tao' },
        { id: 'w-homa-1', weapon_id: 'staffofhoma', assignedTo: null },
        { id: 'w-homa-2', weapon_id: 'staffofhoma', assignedTo: null }
      ];
      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(char.weaponReconciliation.status).toBe('ambiguous-existing-match');
      expect(char.needsAttention).toBe(true);
    });

    it('12. Weapon creation required for an existing character -> weapon-update with would-create', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 90 }
      }];
      const roster = {
        'Hu Tao': { level: 80, ascension: 5, talents: { normal: 8, skill: 8, burst: 8 }, equippedWeaponId: null }
      };
      const res = reconcileCharacters(syncArray, roster, []);
      const char = res.characters[0];
      expect(char.status).toBe('weapon-update');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(true);
      expect(char.weaponReconciliation.status).toBe('would-create');
    });

    it('13. Character and weapon changes together -> update status, charDiff and weaponDiff true', () => {
      const syncArray = [{
        id: 10000046,
        level: 90,
        ascension: 6,
        talents: { normal: 10, skill: 10, burst: 10 },
        weapon: { id: 13501, level: 90, ascension: 6, refinement: 2 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('update');
      expect(char.characterDiff).toBe(true);
      expect(char.weaponDiff).toBe(true);
      expect(res.summary.charactersWithUpdates).toBe(1);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(0);
    });

    it('14. Fully matched character and weapon -> unchanged status, charDiff and weaponDiff false', () => {
      const syncArray = [{
        id: 10000046,
        level: 80,
        ascension: 5,
        talents: { normal: 8, skill: 8, burst: 8 },
        weapon: { id: 13501, level: 80, ascension: 5, refinement: 1 }
      }];
      const res = reconcileCharacters(syncArray, { 'Hu Tao': { ...baseHuTaoLocal } }, [{ ...baseHomaTracked }]);
      const char = res.characters[0];
      expect(char.status).toBe('unchanged');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(false);
      expect(res.summary.unchangedCharacters).toBe(1);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(0);
    });

    it('15. New character with equipment -> new status, weaponDiff is false', () => {
      const syncArray = [{
        id: 10000030, // Zhongli
        level: 90,
        ascension: 6,
        weapon: { id: 13501, level: 90 }
      }];
      const res = reconcileCharacters(syncArray, {}, []);
      const char = res.characters[0];
      expect(char.status).toBe('new');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(false);
      expect(char.weaponReconciliation.status).toBe('would-create');
      expect(res.summary.newCharacters).toBe(1);
      expect(res.summary.charactersWithWeaponChanges).toBe(0);
      expect(res.summary.weaponOnlyUpdates).toBe(0);
    });

    it('26. Active Traveler weapon-only change classifies as weapon-update', () => {
      const syncArray = [{
        id: 10000007,
        element: 'Anemo',
        level: 90,
        ascension: 6,
        talents: { normal: 10, skill: 10, burst: 10 },
        weapon: { id: 11401, level: 90 } // Favonius Sword
      }];
      const roster = {
        'Traveler Anemo': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'w-dull-blade'
        }
      };
      const trackedWeapons = [
        { id: 'w-dull-blade', weapon_id: 'dullblade', weaponName: 'Dull Blade', level: 20, assignedTo: 'Traveler Anemo' }
      ];
      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const traveler = res.characters[0];
      expect(traveler.status).toBe('weapon-update');
      expect(traveler.characterDiff).toBe(false);
      expect(traveler.weaponDiff).toBe(true);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(1);
      expect(res.summary.weaponOnlyUpdates).toBe(1);
    });

    it('28. Summary statistics remain consistent across mixed dataset', () => {
      const syncArray = [
        { id: 10000030, level: 90, weapon: { id: 13501, level: 90 } }, // New Zhongli
        { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90 } }, // Hu Tao: char + weapon update
        { id: 10000002, level: 90, ascension: 6, weapon: { id: 11414, level: 90 } }, // Ayaka: weapon-only update
        { id: 10000022, level: 90, ascension: 6, weapon: { id: 11501, level: 80 } }, // Venti: char-only update
        { id: 10000003, level: 80, ascension: 5, weapon: { id: 11501, level: 80 } }  // Jean: unchanged
      ];
      const roster = {
        'Hu Tao': { level: 80, ascension: 5, equippedWeaponId: 'w-homa' },
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-amenoma' },
        'Venti': { level: 80, ascension: 5, equippedWeaponId: 'w-fav' },
        'Jean': { level: 80, ascension: 5, equippedWeaponId: 'w-fav' }
      };
      const trackedWeapons = [
        { id: 'w-homa', weapon_id: 'staffofhoma', level: 80, assignedTo: 'Hu Tao' },
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', level: 80, assignedTo: 'Kamisato Ayaka' },
        { id: 'w-fav', weapon_id: 'aquilafavonia', level: 80, assignedTo: 'Jean' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      expect(res.summary.totalRemote).toBe(5);
      expect(res.summary.newCharacters).toBe(1); // Zhongli
      expect(res.summary.charactersWithUpdates).toBe(2); // Hu Tao + Venti
      expect(res.summary.charactersWithWeaponChanges).toBe(2); // Hu Tao + Ayaka
      expect(res.summary.weaponOnlyUpdates).toBe(1); // Ayaka only
      expect(res.summary.unchangedCharacters).toBe(1); // Jean
      // Total sum invariant
      expect(
        res.summary.newCharacters +
        res.summary.charactersWithUpdates +
        res.summary.weaponOnlyUpdates +
        res.summary.unchangedCharacters
      ).toBe(5);
    });

    it('29. Existing character matching progression but with unmapped remote weapon is classified as conflict, visible in needsAttention, not unchanged', () => {
      const syncArray = [
        {
          id: 10000002, // Ayaka
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          weapon: { id: 99999999, level: 90 } // Unmapped weapon ID
        }
      ];
      const roster = {
        'Kamisato Ayaka': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'w-amenoma'
        }
      };
      const trackedWeapons = [
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', level: 90, assignedTo: 'Kamisato Ayaka' }
      ];

      const res = reconcileCharacters(syncArray, roster, trackedWeapons);
      const char = res.characters[0];

      expect(char.status).toBe('conflict');
      expect(char.characterDiff).toBe(false);
      expect(char.weaponDiff).toBe(false);
      expect(char.weaponReconciliation.status).toBe('unmapped');
      expect(char.needsAttention).toBe(true);

      // Summary counts
      expect(res.summary.charactersWithConflicts).toBe(1);
      expect(res.summary.unchangedCharacters).toBe(0);
      expect(res.summary.charactersWithUpdates).toBe(0);
      expect(res.summary.weaponOnlyUpdates).toBe(0);
      expect(res.summary.charactersWithWeaponChanges).toBe(0);
    });
  });
});
