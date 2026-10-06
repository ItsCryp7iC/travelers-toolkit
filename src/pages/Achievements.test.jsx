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

    const checkboxes = container.querySelectorAll('input[aria-label^="Mark"]');
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
    expect(container.textContent).toContain('Hidden');
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
    const checkboxes = listContainer.querySelectorAll('input[aria-label^="Mark"]');
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

    expect(container.textContent).toContain('+1 vs Toolkit');

    const checkboxes = container.querySelectorAll('input[aria-label^="Mark"]');
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);

    global.fetch.mockRestore();
  });

  describe('Phase M - HoYoLAB Totals', () => {
    it('handles matched state', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true, json: async () => ({ connected: true, totalCompleted: 1, categories: [{ hoyolabId: '0', completed: 1 }] })
      });
      useStore.mockImplementation(selector => selector({
        achievementProgress: { '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' } },
        hoyolabConnected: true
      }));
      await act(async () => { root.render(<Achievements />); await new Promise(r => setTimeout(r, 50)); });
      expect(container.textContent).toContain('Matched with Toolkit');
      expect(container.textContent).toContain('Synced');
      global.fetch.mockRestore();
    });
    it('handles Toolkit-ahead state', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true, json: async () => ({ connected: true, totalCompleted: 0, categories: [{ hoyolabId: '0', completed: 0 }] })
      });
      useStore.mockImplementation(selector => selector({
        achievementProgress: { '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' } },
        hoyolabConnected: true
      }));
      await act(async () => { root.render(<Achievements />); await new Promise(r => setTimeout(r, 50)); });
      expect(container.textContent).toContain('Toolkit +1');
      global.fetch.mockRestore();
    });
  });

  describe('Phase M - Global Search', () => {
    it('finds achievement in another category by name and ID', () => {
      act(() => { root.render(<Achievements />); });
      const searchInput = container.querySelector('input[type="text"]');
      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(searchInput, '80003');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(container.textContent).toContain('Search Results');
      expect(container.textContent).toContain('1 match');
      expect(container.textContent).toContain('Mortal Travails: Series I');
      expect(container.textContent).toContain('Zoo Tycoon');
      
      const activeCategory = container.querySelector('button.bg-gradient-to-r');
      expect(activeCategory.textContent).toContain('Wonders of the World');
      
      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(searchInput, '');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(container.textContent).not.toContain('Search Results');
    });
    it('handles zero results state', () => {
      act(() => { root.render(<Achievements />); });
      const searchInput = container.querySelector('input[type="text"]');
      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(searchInput, 'XYZ_NONEXISTENT');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(container.textContent).toContain('0 matches');
      expect(container.textContent).toContain('No achievements found for "XYZ_NONEXISTENT"');
    });
  });

  describe('Phase M - Version Filter', () => {
    it('filters correctly using numeric ordering', () => {
      act(() => { root.render(<Achievements />); });
      const selects = container.querySelectorAll('select');
      const versionSelect = Array.from(selects).find(s => s.getAttribute('aria-label') === 'Filter by version');
      
      const options = Array.from(versionSelect.options).map(o => o.value);
      expect(options).toEqual(['All', '1.2', '1.1', '1.0']);
      
      act(() => {
        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSelectValueSetter.call(versionSelect, '1.1');
        versionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      expect(container.textContent).toContain('Test Achievement 2');
      expect(container.textContent).not.toContain('Test Achievement 1');
    });
  });

  describe('Phase M - Hidden Terminology', () => {
    it('uses HIDDEN instead of SECRET for hidden=true', () => {
      act(() => { root.render(<Achievements />); });
      expect(container.textContent).toContain('Hidden');
      expect(container.textContent).not.toContain('Secret');
    });
  });

  describe('Phase M - Hide Completed Categories', () => {
    it('hides completed categories from rail', () => {
      useStore.mockImplementation(selector => selector({
        achievementProgress: {
          '80003': { completed: true },
          '80004': { completed: true },
          '80005': { completed: true }
        },
        setAchievementProgress: vi.fn(),
        hoyolabConnected: false
      }));
      act(() => { root.render(<Achievements />); });
      
      const hideCheckboxes = container.querySelectorAll('input[type="checkbox"]');
      const hideToggle = Array.from(hideCheckboxes).find(cb => cb.closest('label')?.textContent.includes('Hide completed categories'));
      
      expect(container.textContent).toContain('Mortal Travails: Series I');
      
      act(() => {
        hideToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      
      const buttons = container.querySelectorAll('button');
      const mortalButton = Array.from(buttons).find(b => b.textContent.includes('Mortal Travails: Series I'));
      expect(mortalButton).toBeUndefined();
    });
  });

  describe('Phase M - Filtered Category Navigation', () => {
    beforeEach(() => {
      useStore.mockImplementation(selector => selector({
        achievementProgress: { '80001': { completed: true } },
        setAchievementProgress: vi.fn(),
        hoyolabConnected: false
      }));
    });

    const setVersion = (val) => {
      const selects = container.querySelectorAll('select');
      const versionSelect = Array.from(selects).find(s => s.getAttribute('aria-label') === 'Filter by version');
      act(() => {
        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSelectValueSetter.call(versionSelect, val);
        versionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    const setStatus = (val) => {
      const buttons = Array.from(container.querySelectorAll('button'));
      const statusBtn = buttons.find(b => b.textContent === val);
      act(() => { statusBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    };

    it('Version filter hides category with zero matching achievements and retains valid ones', () => {
      act(() => { root.render(<Achievements />); });
      expect(container.textContent).toContain('Wonders of the World');
      expect(container.textContent).toContain('Mortal Travails: Series I');
      
      setVersion('1.2');
      expect(container.textContent).not.toContain('Wonders of the World');
      expect(container.textContent).toContain('Mortal Travails: Series I');
    });

    it('Completed filter hides category with zero completed achievements', () => {
      act(() => { root.render(<Achievements />); });
      setStatus('Completed');
      expect(container.textContent).toContain('Wonders of the World');
      const cat1Button = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Mortal Travails: Series I'));
      expect(cat1Button).toBeUndefined();
    });

    it('Incomplete filter hides fully completed category', () => {
      useStore.mockImplementation(selector => selector({
        achievementProgress: { 
          '80003': { completed: true }, '80004': { completed: true }, '80005': { completed: true } 
        },
        hoyolabConnected: false
      }));
      act(() => { root.render(<Achievements />); });
      setStatus('Incomplete');
      const buttons = container.querySelectorAll('button');
      const cat1Button = Array.from(buttons).find(b => b.textContent.includes('Mortal Travails: Series I'));
      expect(cat1Button).toBeUndefined();
    });

    it('Version + Completed intersection works', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.0');
      setStatus('Completed');
      expect(container.textContent).toContain('Wonders of the World');
      
      setVersion('1.1');
      expect(container.textContent).toContain('No achievements match the current filters.');
    });

    it('Version + Incomplete intersection works', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.1');
      setStatus('Incomplete');
      expect(container.textContent).toContain('Wonders of the World');
      
      setVersion('1.0');
      expect(container.textContent).toContain('No achievements match the current filters.');
    });

    it('All Versions + All restores normal category list', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.2');
      expect(container.textContent).not.toContain('Wonders of the World');
      
      setVersion('All');
      setStatus('All');
      expect(container.textContent).toContain('Wonders of the World');
      expect(container.textContent).toContain('Mortal Travails: Series I');
    });

    it('selected zero-result category automatically switches to first valid category and updates URL', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.2');
      expect(container.textContent).toContain('Zoo Tycoon');
      expect(container.textContent).not.toContain('Test Achievement');
      expect(window.location.search).toContain('category=1');
    });

    it('zero matches across all categories renders global filter empty state', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.0');
      setStatus('Incomplete'); 
      expect(container.textContent).toContain('No achievements match the current filters.');
      expect(container.querySelector('select')).not.toBeNull();
      const buttons = Array.from(container.querySelectorAll('button'));
      expect(buttons.some(b => b.textContent === 'All')).toBe(true);
    });

    it('mobile selector uses the same filtered category set', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.2'); 
      const selects = container.querySelectorAll('select');
      const mobileSelect = Array.from(selects).find(s => s.getAttribute('aria-label') === 'Select category');
      
      const options = Array.from(mobileSelect.options).map(o => o.textContent);
      expect(options.some(t => t.includes('Wonders of the World'))).toBe(false);
      expect(options.some(t => t.includes('Mortal Travails: Series I'))).toBe(true);
    });

    it('global search behavior remains unchanged and does not trigger fallback', () => {
      act(() => { root.render(<Achievements />); });
      const searchInput = container.querySelector('input[type="text"]');
      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(searchInput, 'Zoo'); 
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      setVersion('1.0');
      expect(container.textContent).toContain('No achievements found for "Zoo"');
      expect(window.location.search).toContain('category=0');
    });

    it('category ID "0" remains valid', () => {
      act(() => { root.render(<Achievements />); });
      setVersion('1.0');
      expect(container.textContent).toContain('Test Achievement 1');
      expect(window.location.search).toContain('category=0');
    });

    it('Hide Completed toggle combines correctly with Version/Status filters', () => {
      useStore.mockImplementation(selector => selector({
        achievementProgress: { 
          '80003': { completed: true }, '80004': { completed: true }, '80005': { completed: true } 
        },
        hoyolabConnected: false
      }));
      act(() => { root.render(<Achievements />); });
      
      const hideCheckboxes = container.querySelectorAll('input[type="checkbox"]');
      const hideToggle = Array.from(hideCheckboxes).find(cb => cb.closest('label')?.textContent.includes('Hide completed'));
      act(() => { hideToggle.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      
      setVersion('1.2');
      expect(window.location.search).toContain('category=1');
    });
  });
});

