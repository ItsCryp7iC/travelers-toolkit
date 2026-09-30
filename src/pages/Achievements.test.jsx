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
    { id: '80003', categoryId: '1', name: 'Test Achievement 3', description: 'Desc 3', primogems: 5, hidden: false, version: '1.2', order: 1 }
  ]
}));

describe('Achievements Page UI', () => {
  let mockSetAchievementCompleted;
  let container = null;
  let root = null;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    
    mockSetAchievementCompleted = vi.fn();
    useStore.mockImplementation((selector) => {
      const state = {
        achievementProgress: {
          '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' }
        },
        setAchievementCompleted: mockSetAchievementCompleted,
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
    // 1 completed out of 3 total achievements
    expect(container.textContent).toContain('1 / 3');
    // 5 primogems earned out of 20 total
    expect(container.textContent).toContain('5 / 20');
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

    expect(container.textContent).toContain('Test Achievement 3');
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
    expect(mockSetAchievementCompleted).toHaveBeenCalledWith('80002', true);

    act(() => {
      checkboxes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mockSetAchievementCompleted).toHaveBeenCalledWith('80001', false);
  });

  it('renders hidden indicators and version badges', () => {
    act(() => {
      root.render(<Achievements />);
    });
    expect(container.textContent).toContain('Secret');
    expect(container.textContent).toContain('v1.0');
    expect(container.textContent).toContain('v1.1');
  });

  it('filters by search and completion status', () => {
    act(() => {
      root.render(<Achievements />);
    });

    const searchInput = container.querySelector('input[type="text"]');
    const filterSelect = container.querySelector('select');

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
      filterSelect.value = 'Completed';
      filterSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Test Achievement 1');
    expect(container.textContent).not.toContain('Test Achievement 2');
  });

  it('shows disconnected message when HoYoLAB is not connected', () => {
    act(() => {
      root.render(<Achievements />);
    });
    expect(container.textContent).toContain('Connect HoYoLAB to compare your achievement totals');
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

    expect(container.textContent).toContain('HoYoLAB has 1 more completed');
    expect(container.textContent).toContain('+1 HoYoLAB');

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);

    global.fetch.mockRestore();
  });
});
