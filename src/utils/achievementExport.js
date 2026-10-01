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
