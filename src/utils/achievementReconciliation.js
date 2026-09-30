import { getOverallStats, getCategoryStats } from './achievementStats';

export function getOverallReconciliation(localProgress, hoyolabData) {
  if (!hoyolabData || typeof hoyolabData.totalCompleted !== 'number') return null;

  const localStats = getOverallStats(localProgress);
  const localCompleted = localStats.completedCount;
  const hoyolabCompleted = hoyolabData.totalCompleted;
  const difference = hoyolabCompleted - localCompleted;

  let status = 'matched';
  if (difference > 0) status = 'hoyolabAhead';
  if (difference < 0) status = 'toolkitAhead';

  return {
    localCompleted,
    hoyolabCompleted,
    difference,
    status
  };
}

export function getCategoryReconciliation(categoryId, localProgress, hoyolabData) {
  if (!hoyolabData || !Array.isArray(hoyolabData.categories)) return null;

  // Use String() to ensure safe matching
  const hoyolabCategory = hoyolabData.categories.find(c => c.hoyolabId === String(categoryId));
  if (!hoyolabCategory || typeof hoyolabCategory.completed !== 'number') return null;

  const localStats = getCategoryStats(categoryId, localProgress);
  const localCompleted = localStats.completedCount;
  const hoyolabCompleted = hoyolabCategory.completed;
  const difference = hoyolabCompleted - localCompleted;

  let status = 'matched';
  if (difference > 0) status = 'hoyolabAhead';
  if (difference < 0) status = 'toolkitAhead';

  return {
    localCompleted,
    hoyolabCompleted,
    difference,
    status
  };
}
