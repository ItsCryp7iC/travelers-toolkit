import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOverallReconciliation, getCategoryReconciliation } from './achievementReconciliation';

// Mock achievementStats purely
vi.mock('./achievementStats', () => ({
  getOverallStats: vi.fn(),
  getCategoryStats: vi.fn(),
}));

import { getOverallStats, getCategoryStats } from './achievementStats';

describe('Achievement Reconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles null hoyolabData safely', () => {
    expect(getOverallReconciliation({}, null)).toBeNull();
    expect(getCategoryReconciliation('0', {}, null)).toBeNull();
  });

  it('handles missing totalCompleted safely', () => {
    expect(getOverallReconciliation({}, { categories: [] })).toBeNull();
  });

  it('computes exact match overall', () => {
    getOverallStats.mockReturnValue({ completedCount: 10 });
    const result = getOverallReconciliation({}, { totalCompleted: 10 });
    expect(result).toEqual({
      localCompleted: 10,
      hoyolabCompleted: 10,
      difference: 0,
      status: 'matched'
    });
  });

  it('computes hoyolab ahead overall', () => {
    getOverallStats.mockReturnValue({ completedCount: 10 });
    const result = getOverallReconciliation({}, { totalCompleted: 15 });
    expect(result).toEqual({
      localCompleted: 10,
      hoyolabCompleted: 15,
      difference: 5,
      status: 'hoyolabAhead'
    });
  });

  it('computes toolkit ahead overall', () => {
    getOverallStats.mockReturnValue({ completedCount: 10 });
    const result = getOverallReconciliation({}, { totalCompleted: 8 });
    expect(result).toEqual({
      localCompleted: 10,
      hoyolabCompleted: 8,
      difference: -2,
      status: 'toolkitAhead'
    });
  });

  it('handles missing category in hoyolabData', () => {
    getCategoryStats.mockReturnValue({ completedCount: 5 });
    const hoyolabData = { categories: [{ hoyolabId: '1', completed: 5 }] };
    expect(getCategoryReconciliation('0', {}, hoyolabData)).toBeNull();
  });

  it('handles malformed category in hoyolabData', () => {
    getCategoryStats.mockReturnValue({ completedCount: 5 });
    const hoyolabData = { categories: [{ hoyolabId: '0' }] }; // missing completed
    expect(getCategoryReconciliation('0', {}, hoyolabData)).toBeNull();
  });

  it('computes category reconciliation correctly', () => {
    getCategoryStats.mockReturnValue({ completedCount: 5 });
    const hoyolabData = { categories: [{ hoyolabId: '0', completed: 8 }] };
    
    const result = getCategoryReconciliation('0', {}, hoyolabData);
    expect(result).toEqual({
      localCompleted: 5,
      hoyolabCompleted: 8,
      difference: 3,
      status: 'hoyolabAhead'
    });
  });

  it('matches category ID safely even if passed as number', () => {
    getCategoryStats.mockReturnValue({ completedCount: 5 });
    const hoyolabData = { categories: [{ hoyolabId: '0', completed: 5 }] };
    
    // Passing 0 as number instead of string
    const result = getCategoryReconciliation(0, {}, hoyolabData);
    expect(result.status).toBe('matched');
  });
});
