import { isValidAchievementId, normalizeAchievementProgress } from '../../utils/achievementProgress';
import { getAchievementById } from '../../utils/achievementCatalog';
import { recordActivity, VALID_SOURCES } from '../../activity';

export const createAchievementSlice = (set, get) => ({
  achievementProgress: {},

  setAchievementCompleted: (id, completed, contextArg = 'system') => {
    if (!isValidAchievementId(id)) return;

    const currentProgress = get().achievementProgress || {};
    const existing = currentProgress[id];

    if (completed) {
      if (existing && existing.completed) {
        return; // Already completed, no-op
      }
    } else {
      if (!existing || !existing.completed) {
        return; // Already incomplete, no-op
      }
    }

    const now = new Date().toISOString();

    set((state) => {
      const newProgress = { ...state.achievementProgress };

      if (completed) {
        newProgress[id] = {
          completed: true,
          completedAt: existing?.completedAt || now,
        };
      } else {
        delete newProgress[id];
      }

      return { achievementProgress: newProgress };
    });

    try {
      let validSource = 'system';
      if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
        validSource = contextArg;
      } else if (typeof contextArg === 'object' && contextArg !== null) {
        if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
          validSource = contextArg.source;
        }
      }
      const def = getAchievementById(id);
      const achName = def?.name || `Achievement ${id}`;

      if (completed) {
        recordActivity({
          category: 'achievements',
          action: 'achievement_completed',
          source: validSource,
          entityType: 'achievement',
          entityId: String(id),
          entityName: achName,
          summary: `Completed achievement: ${achName}.`,
          changes: [
            { field: 'completed', before: false, after: true, label: 'Completed' },
          ],
          metadata: {
            completedAt: existing?.completedAt || now,
            primogems: def?.primogems ?? null,
          },
        });
      } else {
        recordActivity({
          category: 'achievements',
          action: 'achievement_uncompleted',
          source: validSource,
          entityType: 'achievement',
          entityId: String(id),
          entityName: achName,
          summary: `Marked ${achName} as incomplete.`,
          changes: [
            { field: 'completed', before: true, after: false, label: 'Completed' },
          ],
          metadata: {
            primogems: def?.primogems ?? null,
          },
        });
      }
    } catch (err) {
      console.error('[Achievements] Failed to log activity event:', err);
    }
  },

  toggleAchievement: (id, contextArg = 'system') => {
    if (!isValidAchievementId(id)) return;
    const isCompleted = get().achievementProgress[id]?.completed === true;
    get().setAchievementCompleted(id, !isCompleted, contextArg);
  },

  setAchievementProgress: (entries, options = { mode: 'replace' }) => {
    const prevProgress = get().achievementProgress || {};

    try {
      const normalized = normalizeAchievementProgress(entries);

      set((state) => {
        if (options.mode === 'merge') {
          return {
            achievementProgress: {
              ...state.achievementProgress,
              ...normalized,
            },
          };
        }

        // replace
        return { achievementProgress: normalized };
      });

      // Activity logging ONLY when explicitly triggered as an interactive user action
      if (options && options.trigger) {
        try {
          const { targetId, checked } = options.trigger;
          const validSource =
            typeof options.source === 'string' && VALID_SOURCES.has(options.source)
              ? options.source
              : 'achievements_page';

          const nextProgress = normalized;
          const def = getAchievementById(targetId);
          const achName = def?.name || `Achievement ${targetId}`;

          if (checked) {
            const newlyCompletedIds = Object.keys(nextProgress).filter(
              (k) => nextProgress[k]?.completed && !prevProgress[k]?.completed
            );

            if (newlyCompletedIds.length === 0) {
              return; // No-op
            }

            if (newlyCompletedIds.length === 1) {
              const singleId = newlyCompletedIds[0];
              const singleDef = getAchievementById(singleId) || def;
              const singleName = singleDef?.name || achName;
              recordActivity({
                category: 'achievements',
                action: 'achievement_completed',
                source: validSource,
                entityType: 'achievement',
                entityId: String(singleId),
                entityName: singleName,
                summary: `Completed achievement: ${singleName}.`,
                changes: [
                  { field: 'completed', before: false, after: true, label: 'Completed' },
                ],
                metadata: {
                  completedAt: nextProgress[singleId]?.completedAt || null,
                  primogems: singleDef?.primogems ?? null,
                },
              });
            } else {
              recordActivity({
                category: 'achievements',
                action: 'achievements_stage_cascade',
                source: validSource,
                entityType: 'achievement',
                entityId: String(targetId),
                entityName: achName,
                summary: `Updated achievement series: ${newlyCompletedIds.length} stages completed.`,
                changes: newlyCompletedIds.map((sid) => {
                  const sDef = getAchievementById(sid);
                  return {
                    field: `achievement.${sid}.completed`,
                    label: sDef?.name || `Stage ${sid}`,
                    before: false,
                    after: true,
                  };
                }),
                metadata: {
                  initiatorId: String(targetId),
                  initiatorName: achName,
                  changedIds: newlyCompletedIds,
                  changedCount: newlyCompletedIds.length,
                  targetCompleted: true,
                },
              });
            }
          } else {
            const uncompletedIds = Object.keys(prevProgress).filter(
              (k) => prevProgress[k]?.completed && !nextProgress[k]?.completed
            );

            if (uncompletedIds.length === 0) {
              return; // No-op
            }

            if (uncompletedIds.length === 1) {
              const singleId = uncompletedIds[0];
              const singleDef = getAchievementById(singleId) || def;
              const singleName = singleDef?.name || achName;
              recordActivity({
                category: 'achievements',
                action: 'achievement_uncompleted',
                source: validSource,
                entityType: 'achievement',
                entityId: String(singleId),
                entityName: singleName,
                summary: `Marked ${singleName} as incomplete.`,
                changes: [
                  { field: 'completed', before: true, after: false, label: 'Completed' },
                ],
                metadata: {
                  primogems: singleDef?.primogems ?? null,
                },
              });
            } else {
              recordActivity({
                category: 'achievements',
                action: 'achievements_stage_cascade',
                source: validSource,
                entityType: 'achievement',
                entityId: String(targetId),
                entityName: achName,
                summary: `Updated achievement series: ${uncompletedIds.length} stages marked incomplete.`,
                changes: uncompletedIds.map((sid) => {
                  const sDef = getAchievementById(sid);
                  return {
                    field: `achievement.${sid}.completed`,
                    label: sDef?.name || `Stage ${sid}`,
                    before: true,
                    after: false,
                  };
                }),
                metadata: {
                  initiatorId: String(targetId),
                  initiatorName: achName,
                  changedIds: uncompletedIds,
                  changedCount: uncompletedIds.length,
                  targetCompleted: false,
                },
              });
            }
          }
        } catch (logErr) {
          console.error('[Achievements] Failed to log activity event:', logErr);
        }
      }
    } catch (err) {
      console.error('Failed to set achievement progress:', err);
    }
  },

  clearAchievementProgress: () => set({ achievementProgress: {} }),
});
