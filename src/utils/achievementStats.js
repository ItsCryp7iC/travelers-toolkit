import categoriesData from '../data/achievements/categories.json';
import achievementsData from '../data/achievements/achievements.json';

// Memoized derived dataset for faster lookup
let _achievementsByCategory = null;

export function getAchievementsByCategory() {
  if (!_achievementsByCategory) {
    _achievementsByCategory = {};
    for (const cat of categoriesData) {
      _achievementsByCategory[cat.id] = [];
    }
    for (const ach of achievementsData) {
      if (_achievementsByCategory[ach.categoryId]) {
        _achievementsByCategory[ach.categoryId].push(ach);
      } else {
        _achievementsByCategory[ach.categoryId] = [ach];
      }
    }
    // Sort each array by order
    for (const catId of Object.keys(_achievementsByCategory)) {
      _achievementsByCategory[catId].sort((a, b) => a.order - b.order);
    }
  }
  return _achievementsByCategory;
}

export function getOverallStats(progress) {
  let completedCount = 0;
  let earnedPrimogems = 0;
  let totalPrimogems = 0;
  const totalCount = achievementsData.length;

  for (const ach of achievementsData) {
    totalPrimogems += ach.primogems;
    if (progress && progress[ach.id]?.completed) {
      completedCount++;
      earnedPrimogems += ach.primogems;
    }
  }

  return {
    completedCount,
    totalCount,
    percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
    earnedPrimogems,
    totalPrimogems
  };
}

export function getCategoryStats(categoryId, progress) {
  const map = getAchievementsByCategory();
  const achs = map[categoryId] || [];
  
  let completedCount = 0;
  let earnedPrimogems = 0;
  let totalPrimogems = 0;
  const totalCount = achs.length;

  for (const ach of achs) {
    totalPrimogems += ach.primogems;
    if (progress && progress[ach.id]?.completed) {
      completedCount++;
      earnedPrimogems += ach.primogems;
    }
  }

  return {
    completedCount,
    totalCount,
    percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
    earnedPrimogems,
    totalPrimogems
  };
}
