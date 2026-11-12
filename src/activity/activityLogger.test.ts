import { describe, it, expect, beforeEach } from 'vitest';
import {
  createActivityEvent,
  recordActivity,
  hasFieldDifferences,
  calculateFieldDiffs,
} from './activityLogger';
import { clearActivityHistory, getActivityEvents } from './activityStore';

describe('Activity History — Logger API and No-Op Diff Engine', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearActivityHistory();
  });

  it('creates a validated event with injected UUID generator and clock', () => {
    const fixedId = '11111111-1111-4111-8111-111111111111';
    const fixedClock = '2026-11-12T15:30:00.000Z';

    const result = createActivityEvent(
      {
        category: 'inventory',
        action: 'inventory_updated',
        source: 'inventory_page',
        summary: 'Slime Condensate updated.',
        changes: [{ field: 'quantity', before: 5, after: 15, delta: '+10' }],
      },
      {
        idGenerator: () => fixedId,
        clock: () => fixedClock,
      }
    );

    expect(result.error).toBeUndefined();
    expect(result.event).toBeDefined();
    expect(result.event?.id).toBe(fixedId);
    expect(result.event?.timestamp).toBe(fixedClock);
    expect(result.event?.schemaVersion).toBe(1);
    expect(result.event?.summary).toBe('Slime Condensate updated.');
  });

  it('recordActivity dispatches to persistent store and returns typed result', () => {
    const fixedId = '22222222-2222-4222-8222-222222222222';
    const res = recordActivity(
      {
        category: 'characters',
        action: 'character_added',
        source: 'character_modal',
        entityType: 'character',
        entityId: 'Razor',
        entityName: 'Razor',
        summary: 'Added Razor to roster.',
      },
      { idGenerator: () => fixedId }
    );

    expect(res.success).toBe(true);
    expect(res.status).toBe('recorded');
    expect(res.eventId).toBe(fixedId);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].entityName).toBe('Razor');
  });

  it('recordActivity rejects invalid event without throwing', () => {
    // Missing summary
    const res = recordActivity({
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      summary: '',
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('invalid_rejected');
    expect(res.message).toBeDefined();
    expect(getActivityEvents()).toHaveLength(0);
  });

  describe('hasFieldDifferences (No-Op Detection)', () => {
    it('accurately identifies identical primitives and objects as no-ops', () => {
      expect(hasFieldDifferences(100, 100)).toBe(false);
      expect(hasFieldDifferences('abc', 'abc')).toBe(false);
      expect(hasFieldDifferences(true, true)).toBe(false);
      expect(hasFieldDifferences(null, null)).toBe(false);
      expect(hasFieldDifferences(undefined, undefined)).toBe(false);

      expect(hasFieldDifferences({ a: 1, b: 'two' }, { a: 1, b: 'two' })).toBe(
        false
      );
      expect(hasFieldDifferences([1, 2, 3], [1, 2, 3])).toBe(false);
      expect(
        hasFieldDifferences(
          { talents: { normal: 10 } },
          { talents: { normal: 10 } }
        )
      ).toBe(false);
    });

    it('accurately identifies genuine differences', () => {
      expect(hasFieldDifferences(100, 101)).toBe(true);
      expect(hasFieldDifferences('abc', 'def')).toBe(true);
      expect(hasFieldDifferences(true, false)).toBe(true);
      expect(hasFieldDifferences(0, false)).toBe(true);
      expect(hasFieldDifferences(null, undefined)).toBe(true);

      expect(hasFieldDifferences({ level: 80 }, { level: 90 })).toBe(true);
      expect(hasFieldDifferences([1, 2], [1, 2, 3])).toBe(true);
      expect(hasFieldDifferences({ a: 1 }, { b: 1 })).toBe(true);
    });
  });

  describe('calculateFieldDiffs', () => {
    it('returns empty array when two records are identical', () => {
      const before = { level: 90, ascension: 6, targetLevel: 90 };
      const after = { level: 90, ascension: 6, targetLevel: 90 };

      const diffs = calculateFieldDiffs(before, after);
      expect(diffs).toEqual([]);
    });

    it('calculates structured diffs with deltas and human labels', () => {
      const before = { level: 80, ascension: 5, targetLevel: 90 };
      const after = { level: 90, ascension: 6, targetLevel: 90 };
      const labels = { level: 'Current Level', ascension: 'Ascension Phase' };

      const diffs = calculateFieldDiffs(before, after, labels);
      expect(diffs).toHaveLength(2);

      const levelDiff = diffs.find((d) => d.field === 'level');
      expect(levelDiff).toEqual({
        field: 'level',
        label: 'Current Level',
        before: 80,
        after: 90,
        delta: '+10',
      });

      const ascDiff = diffs.find((d) => d.field === 'ascension');
      expect(ascDiff).toEqual({
        field: 'ascension',
        label: 'Ascension Phase',
        before: 5,
        after: 6,
        delta: '+1',
      });
    });
  });
});
