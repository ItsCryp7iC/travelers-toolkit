import { describe, it, expect, beforeEach, vi } from 'vitest';
import useStore from '../useStore';
import * as achievementProgressUtils from '../../utils/achievementProgress';

// Mock the validation logic
vi.mock('../../utils/achievementProgress', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isValidAchievementId: vi.fn((id) => id === '80001' || id === '80212'),
  };
});

describe('achievementSlice', () => {
  beforeEach(() => {
    useStore.getState().resetStore();
    vi.clearAllMocks();
  });

  it('default empty progress', () => {
    const state = useStore.getState();
    expect(state.achievementProgress).toEqual({});
  });

  it('valid mark-complete', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('80001', true);
    
    const state = useStore.getState();
    expect(state.achievementProgress['80001']).toBeDefined();
    expect(state.achievementProgress['80001'].completed).toBe(true);
    expect(typeof state.achievementProgress['80001'].completedAt).toBe('string');
  });

  it('valid mark-incomplete', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('80001', true);
    store.setAchievementCompleted('80001', false);
    
    const state = useStore.getState();
    expect(state.achievementProgress['80001']).toBeUndefined();
  });

  it('completedAt created for manual completion', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('80212', true);
    
    const state = useStore.getState();
    expect(state.achievementProgress['80212'].completedAt).toBeDefined();
  });

  it('existing completedAt preserved on repeated complete', () => {
    const store = useStore.getState();
    store.setAchievementProgress({ '80001': { completed: true, completedAt: '2026-01-01T00:00:00.000Z' }});
    
    let state = useStore.getState();
    expect(state.achievementProgress['80001'].completedAt).toBe('2026-01-01T00:00:00.000Z');

    store.setAchievementCompleted('80001', true);
    state = useStore.getState();
    expect(state.achievementProgress['80001'].completedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('unknown ID ignored/rejected', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('999999', true); // mocked to return false
    
    const state = useStore.getState();
    expect(state.achievementProgress['999999']).toBeUndefined();
  });

  it('clear all', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('80001', true);
    store.clearAchievementProgress();
    
    const state = useStore.getState();
    expect(state.achievementProgress).toEqual({});
  });

  it('bulk replace', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('80001', true);

    const newEntries = {
      '80212': { completed: true, completedAt: null }
    };
    
    store.setAchievementProgress(newEntries, { mode: 'replace' });
    
    const state = useStore.getState();
    expect(state.achievementProgress['80001']).toBeUndefined();
    expect(state.achievementProgress['80212']).toBeDefined();
    expect(state.achievementProgress['80212'].completedAt).toBeNull();
  });

  it('null timestamp allowed via bulk import', () => {
    const store = useStore.getState();
    store.setAchievementProgress({ '80001': { completed: true, completedAt: null }});
    
    const state = useStore.getState();
    expect(state.achievementProgress['80001'].completedAt).toBeNull();
  });

  it('invalid timestamps rejected', () => {
    const store = useStore.getState();
    const badTimestamps = [
      'not-a-date',
      '',
      'yesterday',
      '2026-10-01', // no time
      1710000000000 // number
    ];

    badTimestamps.forEach((ts) => {
      const newEntries = {
        '80212': { completed: true, completedAt: ts }
      };
      // Error is caught internally by setAchievementProgress
      store.setAchievementProgress(newEntries);
      const state = useStore.getState();
      expect(state.achievementProgress['80212']).toBeUndefined();
    });
  });

  it('dangerous prototype keys ignored', () => {
    const store = useStore.getState();
    const newEntries = JSON.parse(`{
      "__proto__": { "completed": true, "completedAt": null },
      "constructor": { "completed": true, "completedAt": null },
      "80001": { "completed": true, "completedAt": null }
    }`);

    store.setAchievementProgress(newEntries);
    const state = useStore.getState();
    expect(state.achievementProgress['__proto__']).toBeUndefined();
    expect(state.achievementProgress['constructor']).toBeUndefined();
    expect(state.achievementProgress['80001']).toBeDefined();
  });

  it('HoYoLAB/session changes do not clear progress', () => {
    const store = useStore.getState();
    store.setAchievementCompleted('80001', true);
    
    // Simulate some hoyolab disconnections
    store.setHoyolabConnected(false);
    
    const state = useStore.getState();
    expect(state.achievementProgress['80001']).toBeDefined();
  });
});
