import { isValidAchievementId } from './achievementProgress';

export function exportAchievementData(achievementProgress) {
  if (!achievementProgress) return { achievements: [] };

  const validIds = [];

  for (const [id, data] of Object.entries(achievementProgress)) {
    if (data && data.completed && isValidAchievementId(id)) {
      validIds.push(Number(id));
    }
  }

  // Deduplicate and sort numerically (canonical order is numerical)
  const uniqueSorted = [...new Set(validIds)].sort((a, b) => a - b);

  return { achievements: uniqueSorted };
}

export function exportNativeAchievementData(achievementProgress) {
  if (!achievementProgress) {
    return {
      format: 'TRAVELERS_TOOLKIT_ACHIEVEMENTS',
      version: 1,
      achievementProgress: {}
    };
  }

  const nativeProgress = {};

  const sortedIds = Object.keys(achievementProgress)
    .filter(id => achievementProgress[id]?.completed && isValidAchievementId(id))
    .sort((a, b) => Number(a) - Number(b));

  for (const id of sortedIds) {
    const entry = achievementProgress[id];
    // Strictly preserve nulls or valid timestamps
    nativeProgress[id] = {
      completed: true,
      completedAt: entry.completedAt || null
    };
  }

  return {
    format: 'TRAVELERS_TOOLKIT_ACHIEVEMENTS',
    version: 1,
    achievementProgress: nativeProgress
  };
}
