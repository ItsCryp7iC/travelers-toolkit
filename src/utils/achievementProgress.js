import achievementDefinitions from '../data/achievements/achievements.json';
import { normalizeStageProgress } from './achievementStageProgress';

const canonicalIds = new Set(achievementDefinitions.map((a) => a.id));

export function isValidAchievementId(id) {
  return canonicalIds.has(id);
}

export function isValidCompletedAt(timestamp) {
  if (timestamp === null) return true;
  if (typeof timestamp !== 'string') return false;
  
  // Enforce strict ISO 8601 format (e.g. 2026-10-01T00:00:00.000Z)
  // Date.parse accepts too many loose formats (e.g. "yesterday", "2026-10-01")
  const parsed = Date.parse(timestamp);
  if (isNaN(parsed)) return false;
  
  try {
    return new Date(timestamp).toISOString() === timestamp;
  } catch {
    return false;
  }
}

export function normalizeAchievementProgress(rawProgress) {
  if (!rawProgress || typeof rawProgress !== 'object' || Array.isArray(rawProgress)) {
    throw new Error('Malformed achievement progress data.');
  }

  const normalized = Object.create(null);

  // Use Object.keys to avoid prototype pollution
  for (const id of Object.keys(rawProgress)) {
    // Ignore dangerous prototype keys implicitly by iterating own properties only,
    // but we can be strictly explicit:
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
      continue;
    }

    if (!isValidAchievementId(id)) {
      // "unknown ID rejected/ignored safely"
      continue;
    }

    const entry = rawProgress[id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Malformed achievement progress entry.');
    }

    // "retain only completed achievements"
    if (entry.completed !== true) {
      continue;
    }

    if (!isValidCompletedAt(entry.completedAt)) {
      throw new Error('Malformed completedAt timestamp in achievement progress.');
    }

    normalized[id] = {
      completed: true,
      completedAt: entry.completedAt === null ? null : new Date(entry.completedAt).toISOString(),
    };
  }

  const stageNormalized = normalizeStageProgress(normalized, achievementDefinitions);

  return stageNormalized;
}
