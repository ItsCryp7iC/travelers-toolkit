import { isValidAchievementId } from './achievementProgress';

export function parseAchievementImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Import data must be a valid JSON object.');
  }

  if (!('achievements' in data)) {
    return { present: false };
  }

  const achievements = data.achievements;
  if (!Array.isArray(achievements)) {
    throw new Error('The "achievements" field must be an array.');
  }

  const validIds = new Set();
  const unknownIds = new Set();
  const duplicateIds = new Set();

  for (const item of achievements) {
    if (item === null || item === undefined || typeof item === 'object' || typeof item === 'boolean') {
      throw new Error('Malformed entry in achievements array.');
    }

    const strItem = String(item);
    
    // ensure strict integer representation
    if (!/^\d+$/.test(strItem)) {
      throw new Error('Achievement IDs must be numeric.');
    }

    if (validIds.has(strItem) || unknownIds.has(strItem)) {
      duplicateIds.add(strItem);
      continue;
    }

    if (isValidAchievementId(strItem)) {
      validIds.add(strItem);
    } else {
      unknownIds.add(strItem);
    }
  }

  const progress = Object.create(null);
  for (const id of validIds) {
    progress[id] = { completed: true, completedAt: null };
  }

  return {
    present: true,
    validIds: Array.from(validIds),
    unknownIds: Array.from(unknownIds),
    duplicateIds: Array.from(duplicateIds),
    progress
  };
}
