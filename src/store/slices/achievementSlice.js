import { isValidAchievementId, normalizeAchievementProgress } from '../../utils/achievementProgress';

export const createAchievementSlice = (set, get) => ({
  achievementProgress: {},

  setAchievementCompleted: (id, completed) => {
    if (!isValidAchievementId(id)) return;

    set((state) => {
      const newProgress = { ...state.achievementProgress };

      if (completed) {
        // "If marking an already completed achievement complete again: Do NOT overwrite its existing completedAt by default."
        const existing = newProgress[id];
        if (existing && existing.completed) {
          return { achievementProgress: newProgress };
        }

        newProgress[id] = {
          completed: true,
          completedAt: new Date().toISOString(),
        };
      } else {
        delete newProgress[id];
      }

      return { achievementProgress: newProgress };
    });
  },

  toggleAchievement: (id) => {
    if (!isValidAchievementId(id)) return;
    const isCompleted = get().achievementProgress[id]?.completed === true;
    get().setAchievementCompleted(id, !isCompleted);
  },

  setAchievementProgress: (entries, options = { mode: 'replace' }) => {
    try {
      const normalized = normalizeAchievementProgress(entries);
      
      set((state) => {
        if (options.mode === 'merge') {
          return {
            achievementProgress: {
              ...state.achievementProgress,
              ...normalized,
            }
          };
        }
        
        // replace
        return { achievementProgress: normalized };
      });
    } catch (err) {
      console.error('Failed to set achievement progress:', err);
    }
  },

  clearAchievementProgress: () => set({ achievementProgress: {} }),
});
