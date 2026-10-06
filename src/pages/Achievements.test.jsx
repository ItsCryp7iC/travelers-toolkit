import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Achievements from './Achievements';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../data/achievements/categories.json', () => ({
  default: [
    { id: '0', name: 'Wonders of the World', order: 1 },
    { id: '1', name: 'Mortal Travails: Series I', order: 2 }
  ]
}));
vi.mock('../data/achievements/achievements.json', () => ({
  default: [
    { id: '80001', categoryId: '0', name: 'Test Achievement 1', description: 'Desc 1', primogems: 5, hidden: false, version: '1.0', order: 1 },
    { id: '80002', categoryId: '0', name: 'Test Achievement 2', description: 'Desc 2', primogems: 10, hidden: true, version: '1.1', order: 2 },
    { id: '80003', categoryId: '1', name: 'Zoo Tycoon', description: 'Desc 3', primogems: 5, hidden: false, version: '1.2', order: 1, stageGroupId: '80003', stageIndex: 1, stageCount: 3 },
    { id: '80004', categoryId: '1', name: 'Zoo Tycoon', description: 'Desc 4', primogems: 5, hidden: false, version: '1.2', order: 2, stageGroupId: '80003', stageIndex: 2, stageCount: 3 },
    { id: '80005', categoryId: '1', name: 'Zoo Tycoon', description: 'Desc 5', primogems: 10, hidden: false, version: '1.2', order: 3, stageGroupId: '80003', stageIndex: 3, stageCount: 3 }
  ]
}));

describe('Achievements Page UI', () => {
  let mockSetAchievementCompleted;
  let mockSetAchievementProgress;
  let container = null;
  let root = null;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockSetAchievementCompleted = vi.fn();
    mockSetAchievementProgress = vi.fn();
    useStore.mockImplementation((selector) => {
      const state = {
        achievementProgress: {
          '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' }
        },
        setAchievementCompleted: mockSetAchievementCompleted,
        setAchievementProgress: mockSetAchievementProgress,
        hoyolabConnected: false
      };
      return selector(state);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it('renders overall totals correctly', () => {
    act(() => {
      root.render(<Achievements />);
    });
    // 1 completed out of 5 total achievements
    expect(container.textContent).toContain('1 / 5');
    // 5 primogems earned
    const text = container.textContent;
    expect(text).toContain('5');
  });

  it('renders category list and allows selection', () => {
    act(() => {
      root.render(<Achievements />);
    });
    expect(container.textContent).toContain('Wonders of the World');
    expect(container.textContent).toContain('Mortal Travails: Series I');

    // Select category 1
    const buttons = Array.from(container.querySelectorAll('button'));
    const categoryButton = buttons.find(b => b.textContent.includes('Mortal Travails: Series I'));
    act(() => {
      categoryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Zoo Tycoon');
    expect(container.textContent).not.toContain('Test Achievement 1');
  });

  it('renders category ID 0 by default', () => {
    act(() => {
      root.render(<Achievements />);
    });
    expect(container.textContent).toContain('Test Achievement 1');
  });

  it('toggles completion status', () => {
    act(() => {
      root.render(<Achievements />);
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);

    act(() => {
      checkboxes[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Toggle triggers cascade function which calls setAchievementProgress
    expect(mockSetAchievementProgress).toHaveBeenCalled();

    act(() => {
      checkboxes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mockSetAchievementProgress).toHaveBeenCalled();
  });

  it('renders hidden indicators, version badges, and stage badges', () => {
    act(() => {
      root.render(<Achievements />);
    });
    expect(container.textContent).toContain('Secret');
    expect(container.textContent).toContain('v1.0');
    expect(container.textContent).toContain('v1.1');

    // Switch to category 1 to see stage badge
    const buttons = Array.from(container.querySelectorAll('button'));
    const categoryButton = buttons.find(b => b.textContent.includes('Mortal Travails: Series I'));
    act(() => {
      categoryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Stage 1/3');
  });

  it('renders grouped achievements properly', () => {
    act(() => {
      root.render(<Achievements />);
    });

    // Switch to category 1 to see grouped achievements
    const buttons = Array.from(container.querySelectorAll('button'));
    const categoryButton = buttons.find(b => b.textContent.includes('Mortal Travails: Series I'));
    act(() => {
      categoryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // "Zoo Tycoon" is the common name and should appear as a group header exactly once
    const text = container.textContent;
    // Count occurrences of "Zoo Tycoon": should be 1 (group header), the individual stages shouldn't repeat it
    // Note: JS match returns array. The number of 'Zoo Tycoon' occurrences inside the list container:
    const listContainer = container.querySelectorAll('.custom-scrollbar')[1];
    const matches = listContainer.textContent.match(/Zoo Tycoon/g);
    expect(matches).toHaveLength(1);

    expect(listContainer.textContent).toContain('0 / 3 Complete');
    expect(listContainer.textContent).toContain('Stage 1/3');
    expect(listContainer.textContent).toContain('Stage 2/3');
    expect(listContainer.textContent).toContain('Stage 3/3');
    expect(listContainer.textContent).toContain('Desc 3');
    expect(listContainer.textContent).toContain('Desc 4');
    expect(listContainer.textContent).toContain('Desc 5');

    // Toggle Stage 2
    const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3); // 3 stages

    act(() => {
      checkboxes[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Using stage cascade: Checking Stage 2 (80004) should check 80003 and 80004
    expect(mockSetAchievementProgress).toHaveBeenCalled();
    const lastCall = mockSetAchievementProgress.mock.calls[0][0];
    expect(lastCall['80004'].completed).toBe(true);
    expect(lastCall['80003'].completed).toBe(true);
  });

  it('filters by search and completion status', () => {
    act(() => {
      root.render(<Achievements />);
    });

    const searchInput = container.querySelector('input[type="text"]');
    const buttons = Array.from(container.querySelectorAll('button'));
    const filterCompleted = buttons.find(b => b.textContent === 'Completed');

    expect(container.textContent).toContain('Test Achievement 1');
    expect(container.textContent).toContain('Test Achievement 2');

    // Search
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(searchInput, 'Desc 2');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).not.toContain('Test Achievement 1');
    expect(container.textContent).toContain('Test Achievement 2');

    // Clear search
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(searchInput, '');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Filter completed
    act(() => {
      filterCompleted.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Test Achievement 1');
    expect(container.textContent).not.toContain('Test Achievement 2');
  });

  it('filters grouped achievements properly', () => {
    act(() => {
      root.render(<Achievements />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const categoryButton = buttons.find(b => b.textContent.includes('Mortal Travails: Series I'));
    act(() => {
      categoryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const searchInput = container.querySelector('input[type="text"]');

    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(searchInput, 'Desc 4'); // Matches only Stage 2
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // The group header still shows "Zoo Tycoon" because it's a group, but only Stage 2 is rendered
    const listContainer = container.querySelectorAll('.custom-scrollbar')[1];
    expect(listContainer.textContent).toContain('Zoo Tycoon');
    expect(listContainer.textContent).not.toContain('Desc 3');
    expect(listContainer.textContent).toContain('Desc 4');
    expect(listContainer.textContent).not.toContain('Desc 5');
    expect(listContainer.textContent).toContain('Stage 2/3');
  });

  it('shows disconnected message when HoYoLAB is not connected', () => {
    act(() => {
      root.render(<Achievements />);
    });
    expect(container.textContent).toContain('Connect HoYoLAB to sync');
  });

  it('renders reconciliation state correctly when connected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: true,
        totalCompleted: 2,
        categories: [
          { hoyolabId: '0', completed: 2 } // diff +1
        ]
      })
    });

    useStore.mockImplementation((selector) => {
      const state = {
        achievementProgress: {
          '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' }
        },
        hoyolabConnected: true,
        setHoyolabConnected: vi.fn(),
        setAchievementCompleted: vi.fn()
      };
      return selector(state);
    });

    await act(async () => {
      root.render(<Achievements />);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain('+1 HoYoLAB');

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);

    global.fetch.mockRestore();
  });
});
