/**
 * Applies a completion cascade to an achievement and its staged group.
 *
 * @param {Object} currentProgress - The current achievement progress map.
 * @param {Array} canonicalAchievements - The full list of canonical achievements.
 * @param {string} targetId - The ID of the achievement being checked/unchecked.
 * @param {boolean} completed - The target completion state.
 * @param {string|null} now - The ISO timestamp to apply to the directly selected completion.
 * @returns {Object} A new progress map with the cascaded changes applied.
 */
export function applyStageCompletionChange(
  currentProgress,
  canonicalAchievements,
  targetId,
  completed,
  now = null
) {
  // Find the target canonical achievement
  const targetAch = canonicalAchievements.find(a => a.id === targetId);
  if (!targetAch) {
    return { ...currentProgress }; // Should not happen in normal flow
  }

  const nextProgress = { ...currentProgress };

  // If not part of a stage group, behave as standalone
  if (!targetAch.stageGroupId) {
    if (completed) {
      nextProgress[targetId] = {
        completed: true,
        completedAt: now
      };
    } else {
      delete nextProgress[targetId];
    }
    return nextProgress;
  }

  // Find all achievements in the same stage group
  const groupStages = canonicalAchievements
    .filter(a => a.stageGroupId === targetAch.stageGroupId)
    .sort((a, b) => a.stageIndex - b.stageIndex);

  if (completed) {
    // Check target and all earlier stages
    for (const stage of groupStages) {
      if (stage.stageIndex <= targetAch.stageIndex) {
        if (stage.id === targetId) {
          // Direct target
          nextProgress[stage.id] = {
            completed: true,
            completedAt: currentProgress[stage.id]?.completedAt || now
          };
        } else {
          // Earlier stage inferred
          if (!currentProgress[stage.id]?.completed) {
            nextProgress[stage.id] = {
              completed: true,
              completedAt: null
            };
          }
        }
      }
    }
  } else {
    // Uncheck target and all later stages
    for (const stage of groupStages) {
      if (stage.stageIndex >= targetAch.stageIndex) {
        delete nextProgress[stage.id];
      }
    }
  }

  return nextProgress;
}

/**
 * Normalizes a progress map to ensure sequential stage invariants are met.
 * If a later stage is complete, all earlier stages must also be complete.
 *
 * @param {Object} progress - The parsed progress map.
 * @param {Array} canonicalAchievements - The full list of canonical achievements.
 * @returns {Object} A new progress map with missing earlier stages inferred.
 */
export function normalizeStageProgress(progress, canonicalAchievements) {
  const normalized = Object.assign(Object.create(null), progress);
  const highestStageIndexByGroup = {};

  for (const [id, entry] of Object.entries(normalized)) {
    if (!entry || !entry.completed) continue;

    const ach = canonicalAchievements.find(a => a.id === id);
    if (ach && ach.stageGroupId) {
      if (!highestStageIndexByGroup[ach.stageGroupId] || ach.stageIndex > highestStageIndexByGroup[ach.stageGroupId]) {
        highestStageIndexByGroup[ach.stageGroupId] = ach.stageIndex;
      }
    }
  }

  for (const [groupId, highestIndex] of Object.entries(highestStageIndexByGroup)) {
    const groupStages = canonicalAchievements
      .filter(a => a.stageGroupId === groupId)
      .sort((a, b) => a.stageIndex - b.stageIndex);

    for (const stage of groupStages) {
      if (stage.stageIndex <= highestIndex) {
        if (!normalized[stage.id] || !normalized[stage.id].completed) {
          normalized[stage.id] = {
            completed: true,
            completedAt: null
          };
        }
      }
    }
  }

  return normalized;
}
