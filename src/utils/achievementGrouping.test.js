import { describe, it, expect } from 'vitest';
import { groupAchievements } from './achievementGrouping.js';

describe('groupAchievements', () => {
  it('1. standalone achievements remain standalone', () => {
    const input = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' }
    ];
    const result = groupAchievements(input);
    expect(result).toHaveLength(2);
    expect(result[0].isGroup).toBe(false);
    expect(result[0].achievement.id).toBe('1');
    expect(result[1].isGroup).toBe(false);
    expect(result[1].achievement.id).toBe('2');
  });

  it('2. 3 stages with one stageGroupId become one group', () => {
    const input = [
      { id: '1', name: 'A', stageGroupId: '1', stageIndex: 1, stageCount: 3 },
      { id: '2', name: 'A', stageGroupId: '1', stageIndex: 2, stageCount: 3 },
      { id: '3', name: 'A', stageGroupId: '1', stageIndex: 3, stageCount: 3 }
    ];
    const result = groupAchievements(input);
    expect(result).toHaveLength(1);
    expect(result[0].isGroup).toBe(true);
    expect(result[0].stages).toHaveLength(3);
    expect(result[0].commonName).toBe('A');
  });

  it('3. child order uses stageIndex', () => {
    const input = [
      { id: '3', name: 'A', stageGroupId: '1', stageIndex: 3 },
      { id: '1', name: 'A', stageGroupId: '1', stageIndex: 1 },
      { id: '2', name: 'A', stageGroupId: '1', stageIndex: 2 }
    ];
    const result = groupAchievements(input);
    expect(result[0].stages[0].id).toBe('1');
    expect(result[0].stages[1].id).toBe('2');
    expect(result[0].stages[2].id).toBe('3');
  });

  it('4. group position follows first canonical stage in filtered list', () => {
    const input = [
      { id: '0', name: 'Z' }, // Single
      { id: '2', name: 'A', stageGroupId: '1', stageIndex: 2 }, // Group starts here
      { id: '3', name: 'A', stageGroupId: '1', stageIndex: 3 },
      { id: '4', name: 'Y' } // Single
    ];
    const result = groupAchievements(input);
    expect(result).toHaveLength(3);
    expect(result[0].isGroup).toBe(false);
    expect(result[1].isGroup).toBe(true);
    expect(result[1].stageGroupId).toBe('1');
    expect(result[1].stages).toHaveLength(2);
    expect(result[2].isGroup).toBe(false);
  });

  it('5. separate groups do not mix', () => {
    const input = [
      { id: '1', name: 'A', stageGroupId: '1', stageIndex: 1 },
      { id: '2', name: 'B', stageGroupId: '2', stageIndex: 1 },
      { id: '3', name: 'A', stageGroupId: '1', stageIndex: 2 },
      { id: '4', name: 'B', stageGroupId: '2', stageIndex: 2 }
    ];
    const result = groupAchievements(input);
    expect(result).toHaveLength(2);
    expect(result[0].stageGroupId).toBe('1');
    expect(result[0].stages).toHaveLength(2);
    expect(result[1].stageGroupId).toBe('2');
    expect(result[1].stages).toHaveLength(2);
  });

  it('6. string canonical IDs remain intact', () => {
    const input = [
      { id: '80001', name: 'A', stageGroupId: '80001', stageIndex: 1 }
    ];
    const result = groupAchievements(input);
    expect(result[0].stages[0].id).toBe('80001');
    expect(result[0].stageGroupId).toBe('80001');
  });

  it('7. category ID 0 is unaffected (no crashes on zero-like values)', () => {
    const input = [
      { id: '1', categoryId: '0', name: 'A', stageGroupId: '1', stageIndex: 1 }
    ];
    const result = groupAchievements(input);
    expect(result[0].stages[0].categoryId).toBe('0');
  });

  it('8. partial filtered group renders only supplied stages', () => {
    const input = [
      { id: '2', name: 'A', stageGroupId: '1', stageIndex: 2, stageCount: 3 }
    ];
    const result = groupAchievements(input);
    expect(result[0].stages).toHaveLength(1);
    expect(result[0].stages[0].id).toBe('2');
  });

  it('9. original achievement objects are not mutated', () => {
    const original = { id: '1', name: 'A', stageGroupId: '1', stageIndex: 1 };
    const input = [{ ...original }];
    groupAchievements(input);
    expect(input[0]).toEqual(original);
  });

  it('10. deterministic output', () => {
    const input = [
      { id: '1', name: 'A', stageGroupId: '1', stageIndex: 1 },
      { id: '2', name: 'A', stageGroupId: '1', stageIndex: 2 }
    ];
    const res1 = groupAchievements(input);
    const res2 = groupAchievements(input);
    expect(res1).toEqual(res2);
  });

  it('does not set commonName if names differ', () => {
    const input = [
      { id: '1', name: 'A1', stageGroupId: '1', stageIndex: 1 },
      { id: '2', name: 'A2', stageGroupId: '1', stageIndex: 2 }
    ];
    const result = groupAchievements(input);
    expect(result[0].commonName).toBeNull();
  });
});
