export const ACHIEVEMENT_CATEGORY_ICONS_BASE_URL = 'https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/achievements/categories/';

export function getAchievementCategoryIconUrl(categoryId) {
  if (categoryId === undefined || categoryId === null) {
    return '';
  }
  return `${ACHIEVEMENT_CATEGORY_ICONS_BASE_URL}${categoryId}.png`;
}
