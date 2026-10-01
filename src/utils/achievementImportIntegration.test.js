import { describe, it, expect, beforeEach } from 'vitest';
import useStore from '../store/useStore';
import { parseAchievementImport } from './achievementImport';

describe('Achievement Import Integration', () => {
  beforeEach(() => {
    useStore.getState().resetStore();
  });

  it('replaces progress accurately from a parsed import payload', () => {
    const store = useStore.getState();
    
    // 1. Initialize store with two completed achievements (one with non-null timestamp)
    store.setAchievementProgress({
      '80091': { completed: true, completedAt: '2025-01-01T00:00:00.000Z' },
      '80127': { completed: true, completedAt: null }
    }, { mode: 'replace' });

    // Sanity check
    expect(useStore.getState().achievementProgress['80091'].completedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(useStore.getState().achievementProgress['80127'].completed).toBe(true);

    // 2. Parse an import containing one previously completed ID (80091) and one new ID (80128)
    const importData = {
      achievements: [80091, 80128, 999999]
    };
    const parsed = parseAchievementImport(importData);

    // 3. Apply the parsed progress using { mode: 'replace' }
    useStore.getState().setAchievementProgress(parsed.progress, { mode: 'replace' });

    // 4. Read the actual Zustand state
    const state = useStore.getState().achievementProgress;

    // 5. Verify the omitted old achievement is gone
    expect(state['80127']).toBeUndefined();

    // 6. Verify both imported achievements exist
    expect(state['80091']).toBeDefined();
    expect(state['80128']).toBeDefined();

    // 7. Verify both imported completedAt values are null
    expect(state['80091'].completedAt).toBe(null);
    expect(state['80128'].completedAt).toBe(null);

    // 8. Verify no unknown IDs entered the state
    expect(state['999999']).toBeUndefined();
    
    expect(Object.keys(state).length).toBe(2);
  });
});
