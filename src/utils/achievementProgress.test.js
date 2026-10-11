import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidAchievementId,
  isValidCompletedAt,
  normalizeAchievementProgress,
  sanitizeAchievementProgress
} from './achievementProgress';
import useStore from '../store/useStore';

describe('achievementProgress Canonical Validation', () => {
  beforeEach(() => {
    useStore.getState().resetStore();
  });

  describe('isValidAchievementId', () => {
    it('A. returns true for known canonical achievement IDs', () => {
      expect(isValidAchievementId('80001')).toBe(true);
      expect(isValidAchievementId('80008')).toBe(true);
      expect(isValidAchievementId('80129')).toBe(true);
      expect(isValidAchievementId('84001')).toBe(true);
    });

    it('B. returns false for unknown but structurally plausible IDs', () => {
      expect(isValidAchievementId('999999')).toBe(false);
      expect(isValidAchievementId('809999')).toBe(false);
      expect(isValidAchievementId('123456789')).toBe(false);
      expect(isValidAchievementId('00000')).toBe(false);
    });

    it('C. returns false for malformed and non-string IDs', () => {
      expect(isValidAchievementId('')).toBe(false);
      expect(isValidAchievementId('   ')).toBe(false);
      expect(isValidAchievementId(null)).toBe(false);
      expect(isValidAchievementId(undefined)).toBe(false);
      expect(isValidAchievementId(80001)).toBe(false); // numeric type rejected
      expect(isValidAchievementId('abc')).toBe(false);
      expect(isValidAchievementId('__proto__')).toBe(false);
      expect(isValidAchievementId('constructor')).toBe(false);
      expect(isValidAchievementId('prototype')).toBe(false);
    });
  });

  describe('Store Action Integration', () => {
    it('D. setAchievementCompleted(unknownId, true) does NOT add it to achievementProgress', () => {
      const store = useStore.getState();
      store.setAchievementCompleted('999999', true);
      store.setAchievementCompleted('809999', true);

      const state = useStore.getState();
      expect(state.achievementProgress['999999']).toBeUndefined();
      expect(state.achievementProgress['809999']).toBeUndefined();
      expect(Object.keys(state.achievementProgress)).toHaveLength(0);
    });

    it('E. toggleAchievement(unknownId) does NOT add it to achievementProgress', () => {
      const store = useStore.getState();
      store.toggleAchievement('999999');
      store.toggleAchievement('809999');

      const state = useStore.getState();
      expect(state.achievementProgress['999999']).toBeUndefined();
      expect(state.achievementProgress['809999']).toBeUndefined();
      expect(Object.keys(state.achievementProgress)).toHaveLength(0);
    });

    it('F. normalizeAchievementProgress drops unknown IDs exactly as pre-Phase-3 behavior did', () => {
      const raw = {
        '80001': { completed: true, completedAt: '2026-01-01T00:00:00.000Z' },
        '999999': { completed: true, completedAt: '2026-01-01T00:00:00.000Z' },
        '809999': { completed: true, completedAt: null },
        'malformed-key': { completed: true, completedAt: null },
        '__proto__': { completed: true, completedAt: null }
      };

      const normalized = normalizeAchievementProgress(raw);
      expect(normalized['80001']).toEqual({
        completed: true,
        completedAt: '2026-01-01T00:00:00.000Z'
      });
      expect(normalized['999999']).toBeUndefined();
      expect(normalized['809999']).toBeUndefined();
      expect(normalized['malformed-key']).toBeUndefined();
      expect(normalized['__proto__']).toBeUndefined();
      expect(Object.keys(normalized)).toEqual(['80001']);
    });
  });
});
