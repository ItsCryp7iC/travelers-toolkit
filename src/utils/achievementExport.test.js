import { describe, it, expect, beforeEach } from 'vitest';
import useStore from '../store/useStore';
import { parseAchievementImport } from './achievementImport';
import { exportAchievementData, exportNativeAchievementData } from './achievementExport';

describe('Achievement Export & Round-Trip Integration', () => {
  beforeEach(() => {
    useStore.getState().resetStore();
  });

  it('exports completed canonical IDs correctly', () => {
    const store = useStore.getState();
    store.setAchievementProgress({
      '80091': { completed: true, completedAt: '2025-01-01T00:00:00.000Z' },
      '80127': { completed: true, completedAt: null },
      '80128': { completed: false, completedAt: null }, // incomplete
      '999999': { completed: true, completedAt: null } // unknown
    }, { mode: 'replace' });

    const exported = exportAchievementData(useStore.getState().achievementProgress);

    // Should include only completed canonical IDs
    expect(exported.achievements).toEqual([80091, 80127]);
  });

  it('exports empty progress as empty array', () => {
    const exported = exportAchievementData({});
    expect(exported.achievements).toEqual([]);
  });

  it('exports with deterministic numerical ordering', () => {
    const store = useStore.getState();
    store.setAchievementProgress({
      '80128': { completed: true, completedAt: null },
      '80091': { completed: true, completedAt: null },
      '80127': { completed: true, completedAt: null }
    }, { mode: 'replace' });

    const exported = exportAchievementData(useStore.getState().achievementProgress);
    expect(exported.achievements).toEqual([80091, 80127, 80128]);
  });

  it('round-trips exported JSON accurately through the importer', () => {
    const store = useStore.getState();
    store.setAchievementProgress({
      '80091': { completed: true, completedAt: '2025-01-01T00:00:00.000Z' },
      '80127': { completed: true, completedAt: null }
    }, { mode: 'replace' });

    // Export Phase
    const exported = exportAchievementData(useStore.getState().achievementProgress);
    expect(exported.achievements).toEqual([80091, 80127]);

    // Ensure export did not mutate Zustand
    expect(useStore.getState().achievementProgress['80091'].completedAt).toBe('2025-01-01T00:00:00.000Z');

    // Import Phase
    const parsed = parseAchievementImport(exported);
    
    // Applying the imported data restores the exported completion-ID set
    store.setAchievementProgress(parsed.progress, { mode: 'replace' });
    const finalState = useStore.getState().achievementProgress;
    
    expect(finalState['80091']).toBeDefined();
    expect(finalState['80127']).toBeDefined();
    expect(Object.keys(finalState).length).toBe(2);

    // Imported entries have completedAt: null
    expect(finalState['80091'].completedAt).toBe(null);
    expect(finalState['80127'].completedAt).toBe(null);
  });

  it('exports native format correctly with deterministic ordering', () => {
    const store = useStore.getState();
    store.setAchievementProgress({
      '80128': { completed: true, completedAt: null },
      '80091': { completed: true, completedAt: '2026-09-30T00:00:00.000Z' },
      '80127': { completed: true, completedAt: null },
      '80129': { completed: false, completedAt: null }, // incomplete
      '999999': { completed: true, completedAt: null } // unknown
    }, { mode: 'replace' });

    const exported = exportNativeAchievementData(useStore.getState().achievementProgress);

    expect(exported.format).toBe('TRAVELERS_TOOLKIT_ACHIEVEMENTS');
    expect(exported.version).toBe(1);
    
    const keys = Object.keys(exported.achievementProgress);
    expect(keys).toEqual(['80091', '80127', '80128']); // Numerical ordering, unknowns/incompletes excluded
    
    expect(exported.achievementProgress['80091'].completedAt).toBe('2026-09-30T00:00:00.000Z');
    expect(exported.achievementProgress['80128'].completedAt).toBe(null);
  });
  
  it('exports empty native progress correctly', () => {
    const exported = exportNativeAchievementData({});
    expect(exported.format).toBe('TRAVELERS_TOOLKIT_ACHIEVEMENTS');
    expect(exported.achievementProgress).toEqual({});
  });
});
