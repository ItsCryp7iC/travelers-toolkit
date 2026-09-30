import { describe, it, expect } from 'vitest';
import { normalizeCategories, normalizeAchievements, validateDataset } from '../update-achievements.mjs';

describe('Achievement Generator Logic', () => {
  it('accepts ID 0 category', () => {
    const rawGroups = {
      data: {
        English: {
          wondersoftheworld: { id: 0, name: 'Wonders', sortOrder: 1 }
        }
      }
    };
    const cats = normalizeCategories(rawGroups);
    expect(cats[0].id).toBe("0");
  });

  it('stage unrolling produces separate IDs and preserves flags', () => {
    const rawAch = {
      data: {
        English: {
          someach: {
            id: [1001, 1002],
            name: 'Test',
            achievementGroupId: 0,
            sortOrder: 10,
            stages: 2,
            isHidden: true,
            stage1: { title: 'Test 1', description: 'desc 1', progress: 1, reward: { id: 201, count: 5 } },
            stage2: { title: 'Test 2', description: 'desc 2', progress: 2, reward: { id: 201, count: 10 } }
          }
        }
      }
    };
    const versionDict = { someach: '1.5' };
    const stats = {};
    const achs = normalizeAchievements(rawAch, versionDict, stats);
    expect(achs).toHaveLength(2);
    expect(achs[0].id).toBe("1001");
    expect(achs[0].name).toBe("Test 1");
    expect(achs[0].primogems).toBe(5);
    expect(achs[0].hidden).toBe(true);
    expect(achs[0].version).toBe("1.5");
    
    expect(achs[1].id).toBe("1002");
    expect(achs[1].primogems).toBe(10);
    expect(achs[1].version).toBe("1.5");
    expect(achs[1].hidden).toBe(true);
    
    expect(stats.sourceObjects).toBe(1);
    expect(stats.multiStageSourceObjects).toBe(1);
    expect(stats.scalarSourceObjects).toBe(0);
    expect(stats.multiStageCanonicalRecords).toBe(2);
    expect(stats.canonicalRecords).toBe(2);
  });
  
  it('follows null policy if version mapping is missing', () => {
    const rawAch = {
      data: {
        English: {
          someach: {
            id: [1001], name: 'Test', achievementGroupId: 0, sortOrder: 10, stages: 1,
            stage1: { title: 'Test 1', reward: { id: 201, count: 5 } }
          }
        }
      }
    };
    // no version dict entry for someach
    const achs = normalizeAchievements(rawAch, {}, {});
    expect(achs[0].version).toBeNull();
  });
  
  it('rejects version dict with duplicate canonical IDs', () => {
    const rawAch = {
      data: {
        English: {
          ach1: { id: [1001], name: 'T1', achievementGroupId: 0, sortOrder: 1, stages: 1, stage1: { reward: { id: 201, count: 5 } } },
          ach2: { id: [1001], name: 'T2', achievementGroupId: 0, sortOrder: 2, stages: 1, stage1: { reward: { id: 201, count: 5 } } }
        }
      }
    };
    const versionDict = { ach1: '1.0', ach2: '1.1' };
    expect(() => normalizeAchievements(rawAch, versionDict, {})).toThrow(/Duplicate canonical ID/);
  });
  
  it('rejects version dict with unknown string key', () => {
    const rawAch = {
      data: {
        English: {
          ach1: { id: [1001], name: 'T1', achievementGroupId: 0, sortOrder: 1, stages: 1, stage1: { reward: { id: 201, count: 5 } } }
        }
      }
    };
    const versionDict = { ach1: '1.0', unknownKey: '1.2' };
    expect(() => normalizeAchievements(rawAch, versionDict, {})).toThrow(/unknown string key/);
  });



  it('rejects duplicate category ID', () => {
    const cats = [
      { id: "1", name: "A", order: 1 },
      { id: "1", name: "B", order: 2 }
    ];
    // Need 73 categories and ID 0 to pass previous validation steps
    // Instead of full array, we just test that the validation throws on duplicate IDs
    const mockCats = Array.from({length: 73}, (_, i) => ({ id: String(i), name: "A", order: i }));
    mockCats[1].id = "0"; // duplicate ID 0
    expect(() => validateDataset(mockCats, [])).toThrow(/Duplicate category IDs/);
  });

  it('rejects missing category reference', () => {
    const mockCats = Array.from({length: 73}, (_, i) => ({ id: String(i), name: "A", order: i }));
    const achs = [{ id: "100", categoryId: "999", name: "X", primogems: 5, hidden: false, version: null, order: 1 }];
    expect(() => validateDataset(mockCats, achs)).toThrow(/Invalid category ID/);
  });

  it('rejects invalid reward in normalization', () => {
    const rawAch = {
      data: {
        English: {
          someach: {
            id: [1001], name: 'Test', achievementGroupId: 0, sortOrder: 10, stages: 1,
            stage1: { title: 'Test 1', reward: { id: 999, count: 5 } } // wrong item
          }
        }
      }
    };
    expect(() => normalizeAchievements(rawAch, {}, {})).toThrow(/Unexpected reward item/);
  });

  it('stage-array mismatch fails', () => {
    const rawAch = {
      data: {
        English: {
          someach: {
            id: [1001, 1002], name: 'Test', achievementGroupId: 0, sortOrder: 10, stages: 1, // claims 1 stage, has 2 ids
            stage1: { title: 'Test 1', reward: { id: 201, count: 5 } }
          }
        }
      }
    };
    expect(() => normalizeAchievements(rawAch, {}, {})).toThrow(/Stage count mismatch/);
  });
  
  it('deterministic sorting for categories', () => {
    const rawGroups = {
      data: {
        English: {
          b: { id: 2, name: 'B', sortOrder: 2 },
          a: { id: 1, name: 'A', sortOrder: 1 }
        }
      }
    };
    const cats = normalizeCategories(rawGroups);
    expect(cats[0].id).toBe("1");
    expect(cats[1].id).toBe("2");
  });
});
