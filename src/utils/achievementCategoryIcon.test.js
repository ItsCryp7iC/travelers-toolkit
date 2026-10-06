import { describe, it, expect } from 'vitest';
import { getAchievementCategoryIconUrl, ACHIEVEMENT_CATEGORY_ICONS_BASE_URL } from './achievementCategoryIcon';

describe('achievementCategoryIcon', () => {
  it('generates correct URL for ID "0"', () => {
    expect(getAchievementCategoryIconUrl('0')).toBe(`${ACHIEVEMENT_CATEGORY_ICONS_BASE_URL}0.png`);
  });

  it('generates correct URL for non-sequential string IDs', () => {
    expect(getAchievementCategoryIconUrl('42')).toBe(`${ACHIEVEMENT_CATEGORY_ICONS_BASE_URL}42.png`);
    expect(getAchievementCategoryIconUrl('999')).toBe(`${ACHIEVEMENT_CATEGORY_ICONS_BASE_URL}999.png`);
  });

  it('generates correct URL for numeric IDs', () => {
    expect(getAchievementCategoryIconUrl(1)).toBe(`${ACHIEVEMENT_CATEGORY_ICONS_BASE_URL}1.png`);
    expect(getAchievementCategoryIconUrl(0)).toBe(`${ACHIEVEMENT_CATEGORY_ICONS_BASE_URL}0.png`);
  });

  it('returns empty string for null or undefined', () => {
    expect(getAchievementCategoryIconUrl(null)).toBe('');
    expect(getAchievementCategoryIconUrl(undefined)).toBe('');
  });
});
