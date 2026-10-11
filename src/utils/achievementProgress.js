import { ACHIEVEMENT_IDS } from './achievementCanonicalIds';
import { normalizeStageProgress } from './achievementStageProgress';

const canonicalIds = new Set(ACHIEVEMENT_IDS);

/**
 * Validates that an ID is a member of the canonical achievements dataset.
 * Preserves pre-Phase-3 canonical membership semantics using lightweight generated IDs.
 */
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

/**
 * Pure structural sanitizer for user achievement progress.
 * Validates entry structure, ensures completed: true, checks ISO timestamp validity,
 * and guards against prototype pollution.
 */
export function sanitizeAchievementProgress(rawProgress, idValidator = null) {
  if (!rawProgress || typeof rawProgress !== 'object' || Array.isArray(rawProgress)) {
    throw new Error('Malformed achievement progress data.');
  }

  const normalized = Object.create(null);

  // Use Object.keys to avoid prototype pollution
  for (const id of Object.keys(rawProgress)) {
    // Ignore dangerous prototype keys
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
      continue;
    }

    if (idValidator) {
      if (!idValidator(id)) continue;
    } else if (!isValidAchievementId(id)) {
      continue;
    }

    const entry = rawProgress[id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Malformed achievement progress entry.');
    }

    // Retain only completed achievements
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

  return normalized;
}

/**
 * Normalizes user progress with stage cascading.
 * If canonicalAchievements is omitted, uses the compact STAGE_PREREQUISITES map.
 */
export function normalizeAchievementProgress(rawProgress, canonicalAchievements = null) {
  const sanitized = sanitizeAchievementProgress(rawProgress);
  return normalizeStageProgress(sanitized, canonicalAchievements);
}
