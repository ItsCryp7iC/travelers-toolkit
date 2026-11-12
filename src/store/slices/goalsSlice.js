import { recordActivity, VALID_SOURCES } from '../../activity';

function isDeepEqualGoal(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolveGoalSource(contextArg) {
  if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
    return contextArg;
  }
  if (typeof contextArg === 'object' && contextArg !== null) {
    if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
      return contextArg.source;
    }
  }
  return 'system';
}

export const createGoalsSlice = (set, get) => ({
  goals: [],

  addGoal: (goal, contextArg = 'system') => {
    if (!goal || !goal.charName || typeof goal.charName !== 'string') return;

    const existing = (get().goals || []).find((g) => g.charName === goal.charName);
    if (existing && isDeepEqualGoal(existing, goal)) {
      return; // No-op suppression
    }

    set((state) => ({
      goals: [...(state.goals || []).filter((g) => g.charName !== goal.charName), goal],
    }));

    try {
      const validSource = resolveGoalSource(contextArg);
      const isUpdate = Boolean(existing);
      const action = isUpdate ? 'goal_updated' : 'goal_added';
      const summary = isUpdate
        ? `Updated progression goal for ${goal.charName}.`
        : `Added progression goal for ${goal.charName}.`;

      recordActivity({
        category: 'goals',
        action,
        source: validSource,
        entityType: 'goal',
        entityId: String(goal.charName),
        entityName: String(goal.charName),
        summary,
        changes: [],
        metadata: {
          charName: goal.charName,
          isUpdate,
        },
      });
    } catch (err) {
      console.error('[Goals] Failed to record activity:', err);
    }
  },

  removeGoal: (charName, contextArg = 'system') => {
    if (!charName || typeof charName !== 'string') return;

    const existing = (get().goals || []).find((g) => g.charName === charName);
    if (!existing) {
      return; // Suppress no-op
    }

    set((state) => ({
      goals: (state.goals || []).filter((g) => g.charName !== charName),
    }));

    try {
      const validSource = resolveGoalSource(contextArg);
      recordActivity({
        category: 'goals',
        action: 'goal_removed',
        source: validSource,
        entityType: 'goal',
        entityId: String(charName),
        entityName: String(charName),
        summary: `Removed progression goal for ${charName}.`,
        changes: [],
        metadata: {
          charName,
        },
      });
    } catch (err) {
      console.error('[Goals] Failed to record activity:', err);
    }
  },
});
