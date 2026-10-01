import { isValidAchievementId, isValidCompletedAt } from './achievementProgress';

export function parseAchievementImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Import data must be a valid JSON object.');
  }

  // Handle native format
  if (data.format === 'TRAVELERS_TOOLKIT_ACHIEVEMENTS') {
    return parseNativeAchievementImport(data);
  }

  // Handle GOOD format
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
    format: 'GOOD',
    validIds: Array.from(validIds),
    unknownIds: Array.from(unknownIds),
    duplicateIds: Array.from(duplicateIds),
    progress
  };
}

function parseNativeAchievementImport(data) {
  if (data.version !== 1) {
    throw new Error('Unsupported achievement format version.');
  }

  if (!data.achievementProgress || typeof data.achievementProgress !== 'object' || Array.isArray(data.achievementProgress)) {
    throw new Error('Malformed achievement progress data.');
  }

  const validIds = new Set();
  const unknownIds = new Set();
  const duplicateIds = new Set(); // Native maps shouldn't have dupes, but for consistency

  const progress = Object.create(null);

  for (const [id, entry] of Object.entries(data.achievementProgress)) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
      continue;
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Malformed achievement progress entry.');
    }

    if (entry.completed !== true) {
      continue;
    }

    if (!isValidCompletedAt(entry.completedAt)) {
      throw new Error('Malformed completedAt timestamp in achievement progress.');
    }

    if (isValidAchievementId(id)) {
      validIds.add(id);
      progress[id] = {
        completed: true,
        completedAt: entry.completedAt === null ? null : new Date(entry.completedAt).toISOString()
      };
    } else {
      unknownIds.add(id);
    }
  }

  return {
    present: true,
    format: 'NATIVE',
    validIds: Array.from(validIds),
    unknownIds: Array.from(unknownIds),
    duplicateIds: Array.from(duplicateIds),
    progress
  };
}

export function mergeNativeAchievementProgress(currentState, importedState) {
  const merged = Object.create(null);

  // Copy current state
  for (const [id, entry] of Object.entries(currentState || {})) {
    if (entry.completed) {
      merged[id] = { ...entry };
    }
  }

  // Merge imported state
  for (const [id, importedEntry] of Object.entries(importedState || {})) {
    if (!importedEntry.completed) continue;

    if (!merged[id]) {
      // Not in current state, add it
      merged[id] = { ...importedEntry };
    } else {
      // In both states, resolve timestamp
      const currentTs = merged[id].completedAt;
      const importedTs = importedEntry.completedAt;

      if (currentTs === null && importedTs !== null) {
        merged[id].completedAt = importedTs;
      }
      // Otherwise, preserve current timestamp (even if both are null, or both have values, or current has value and imported is null)
    }
  }

  return merged;
}
