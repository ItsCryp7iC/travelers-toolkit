import { describe, it, expect, vi } from 'vitest';
import { parseAchievementImport } from './achievementImport';
import * as achievementProgress from './achievementProgress';

vi.mock('./achievementProgress', () => ({
  isValidAchievementId: vi.fn((id) => id === '80001' || id === '80002'),
  isValidCompletedAt: vi.fn((ts) => ts === null || typeof ts === 'string')
}));

describe('achievementImport', () => {
  it('returns present: false when achievements field is absent', () => {
    const result = parseAchievementImport({ format: 'GOOD', version: 3 });
    expect(result).toEqual({ present: false });
  });

  it('rejects if achievements field is not an array', () => {
    expect(() => parseAchievementImport({ achievements: {} })).toThrow(/must be an array/);
    expect(() => parseAchievementImport({ achievements: "80001" })).toThrow(/must be an array/);
  });

  it('processes empty achievements array', () => {
    const result = parseAchievementImport({ achievements: [] });
    expect(result).toEqual({
      present: true,
      format: 'GOOD',
      validIds: [],
      unknownIds: [],
      duplicateIds: [],
      progress: {}
    });
  });

  it('processes numeric IDs', () => {
    const result = parseAchievementImport({ achievements: [80001, 80002] });
    expect(result.validIds).toEqual(['80001', '80002']);
    expect(result.progress).toEqual({
      '80001': { completed: true, completedAt: null },
      '80002': { completed: true, completedAt: null }
    });
  });

  it('processes numeric string IDs', () => {
    const result = parseAchievementImport({ achievements: ["80001", "80002"] });
    expect(result.validIds).toEqual(['80001', '80002']);
    expect(result.progress).toEqual({
      '80001': { completed: true, completedAt: null },
      '80002': { completed: true, completedAt: null }
    });
  });

  it('handles duplicate IDs', () => {
    const result = parseAchievementImport({ achievements: [80001, 80001, "80001"] });
    expect(result.validIds).toEqual(['80001']);
    expect(result.duplicateIds).toEqual(['80001']);
    expect(result.progress).toEqual({
      '80001': { completed: true, completedAt: null }
    });
  });

  it('skips and reports unknown IDs', () => {
    const result = parseAchievementImport({ achievements: [80001, 999999] });
    expect(result.validIds).toEqual(['80001']);
    expect(result.unknownIds).toEqual(['999999']);
    expect(result.progress).toEqual({
      '80001': { completed: true, completedAt: null }
    });
  });

  it('rejects malformed entries', () => {
    expect(() => parseAchievementImport({ achievements: [null] })).toThrow(/Malformed entry/);
    expect(() => parseAchievementImport({ achievements: [true] })).toThrow(/Malformed entry/);
    expect(() => parseAchievementImport({ achievements: [{}] })).toThrow(/Malformed entry/);
    expect(() => parseAchievementImport({ achievements: [[]] })).toThrow(/Malformed entry/);
  });

  it('rejects decimal numbers', () => {
    expect(() => parseAchievementImport({ achievements: [80001.5] })).toThrow(/must be numeric/);
  });

  it('rejects name strings', () => {
    expect(() => parseAchievementImport({ achievements: ["Test Achievement"] })).toThrow(/must be numeric/);
    expect(() => parseAchievementImport({ achievements: ["80001a"] })).toThrow(/must be numeric/);
  });

  it('ignores unrelated fields in a generic GOOD object', () => {
    const result = parseAchievementImport({
      format: 'GOOD',
      version: 3,
      characters: [{ key: 'Amber' }],
      achievements: [80001]
    });
    expect(result.present).toBe(true);
    expect(result.validIds).toEqual(['80001']);
  });

  it('produces deterministic output without undefined fields on progress', () => {
    const result = parseAchievementImport({ achievements: [80001] });
    expect(Object.keys(result.progress['80001'])).toEqual(['completed', 'completedAt']);
    expect(result.progress['80001'].completedAt).toBe(null);
  });
});

import { mergeNativeAchievementProgress } from './achievementImport';

describe('parseNativeAchievementImport', () => {
  it('rejects unsupported versions', () => {
    expect(() => parseAchievementImport({ format: 'TRAVELERS_TOOLKIT_ACHIEVEMENTS', version: 2 })).toThrow(/Unsupported achievement format version/);
  });

  it('rejects malformed progress object', () => {
    expect(() => parseAchievementImport({ format: 'TRAVELERS_TOOLKIT_ACHIEVEMENTS', version: 1, achievementProgress: [] })).toThrow(/Malformed achievement progress data/);
  });

  it('parses valid native payload and preserves timestamps', () => {
    const payload = {
      format: 'TRAVELERS_TOOLKIT_ACHIEVEMENTS',
      version: 1,
      achievementProgress: {
        '80001': { completed: true, completedAt: '2026-09-30T00:00:00.000Z' },
        '80002': { completed: true, completedAt: null },
        '99999': { completed: true, completedAt: null } // unknown
      }
    };

    const result = parseAchievementImport(payload);
    expect(result.format).toBe('NATIVE');
    expect(result.validIds).toEqual(['80001', '80002']);
    expect(result.unknownIds).toEqual(['99999']);
    expect(result.progress['80001'].completedAt).toBe('2026-09-30T00:00:00.000Z');
    expect(result.progress['80002'].completedAt).toBe(null);
  });
});

describe('mergeNativeAchievementProgress', () => {
  it('merges completely new entries', () => {
    const current = { '80001': { completed: true, completedAt: null } };
    const imported = { '80002': { completed: true, completedAt: '2026-10-01T00:00:00.000Z' } };
    const merged = mergeNativeAchievementProgress(current, imported);
    expect(merged['80001']).toBeDefined();
    expect(merged['80002']).toBeDefined();
    expect(merged['80002'].completedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('imported known timestamp fills existing null timestamp', () => {
    const current = { '80001': { completed: true, completedAt: null } };
    const imported = { '80001': { completed: true, completedAt: '2026-10-01T00:00:00.000Z' } };
    const merged = mergeNativeAchievementProgress(current, imported);
    expect(merged['80001'].completedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('existing known timestamp wins over imported conflicting timestamp', () => {
    const current = { '80001': { completed: true, completedAt: '2025-01-01T00:00:00.000Z' } };
    const imported = { '80001': { completed: true, completedAt: '2026-10-01T00:00:00.000Z' } };
    const merged = mergeNativeAchievementProgress(current, imported);
    expect(merged['80001'].completedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('both null timestamps remain null', () => {
    const current = { '80001': { completed: true, completedAt: null } };
    const imported = { '80001': { completed: true, completedAt: null } };
    const merged = mergeNativeAchievementProgress(current, imported);
    expect(merged['80001'].completedAt).toBe(null);
  });

  it('existing entries remain even if not in import', () => {
    const current = { '80001': { completed: true, completedAt: null } };
    const imported = {};
    const merged = mergeNativeAchievementProgress(current, imported);
    expect(merged['80001']).toBeDefined();
  });
});
