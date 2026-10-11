import achievementDefinitions from '../data/achievements/achievements.json';
import { normalizeStageProgress } from './achievementStageProgress';
import { sanitizeAchievementProgress } from './achievementProgress';

const canonicalIds = new Set(achievementDefinitions.map((a) => String(a.id)));

export function getAchievementDefinitions() {
  return achievementDefinitions;
}

export function isCanonicalAchievementId(id) {
  if (id === null || id === undefined) return false;
  return canonicalIds.has(String(id));
}

// Backward-compatible alias for route/importer use
export const isValidAchievementId = isCanonicalAchievementId;

export function getAchievementById(id) {
  return achievementDefinitions.find((a) => String(a.id) === String(id)) || null;
}

/**
 * Normalizes achievement progress against the full canonical catalog and stage definitions.
 * Filters out non-canonical achievement IDs and infers completed prior stages.
 */
export function normalizeAchievementCatalogProgress(rawProgress) {
  const sanitized = sanitizeAchievementProgress(rawProgress, isCanonicalAchievementId);
  return normalizeStageProgress(sanitized, achievementDefinitions);
}
