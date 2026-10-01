import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import AchievementData from './AchievementData';
import useStore from '../../store/useStore';

vi.mock('../../store/useStore');
vi.mock('../../utils/achievementProgress', () => ({
  isValidAchievementId: vi.fn((id) => ['80001', '80002'].includes(id))
}));

describe('AchievementData Settings Component', () => {
  let container;
  let root;
  let mockSetAchievementProgress;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockSetAchievementProgress = vi.fn();
    useStore.mockImplementation((selector) => {
      const state = {
        achievementProgress: {
          '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' }
        },
        setAchievementProgress: mockSetAchievementProgress,
        getOverallStats: () => ({ completedCount: 1, totalCount: 100 })
      };
      return selector(state);
    });

    global.fetch = vi.fn();
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    global.fetch.mockRestore();
  });

  describe('Export functionality', () => {
    it('creates a blob and triggers download on export click', () => {
      act(() => {
        root.render(<AchievementData />);
      });

      const exportBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Export Achievements'));
      
      const createElementSpy = vi.spyOn(document, 'createElement');
      
      act(() => {
        exportBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
      expect(createElementSpy).toHaveBeenCalledWith('a');
      
      createElementSpy.mockRestore();
    });

    it('generates a formatted timestamped filename', () => {
      const mockDate = new Date(2023, 0, 5, 4, 30, 9); // Jan 5, 2023, 04:30:09
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      act(() => {
        root.render(<AchievementData />);
      });

      const exportBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Export Achievements'));
      
      const mockAnchor = { click: vi.fn() };
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') return mockAnchor;
        return document.createElement(tag);
      });
      
      act(() => {
        exportBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockAnchor.download).toBe('2023-01-05_04-30-09_travelers-toolkit-achievements.json');
      
      createElementSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('Import functionality', () => {
    it('handles valid JSON import workflow', async () => {
      act(() => {
        root.render(<AchievementData />);
      });

      const fileInput = container.querySelector('input[type="file"]');
      const mockFile = new File(['{"achievements":[80002]}'], 'import.json', { type: 'application/json' });

      Object.defineProperty(fileInput, 'files', { value: [mockFile] });

      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 10));
      });

      expect(container.textContent).toContain('This import will replace your current local achievement completion state.');
      expect(container.textContent).toContain('Imported Known');

      expect(mockSetAchievementProgress).not.toHaveBeenCalled();

      const buttons = Array.from(container.querySelectorAll('button'));
      const confirmBtn = buttons.find(b => b.textContent.includes('Confirm Replacement'));

      act(() => {
        confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockSetAchievementProgress).toHaveBeenCalledWith(
        { '80002': { completed: true, completedAt: null } },
        { mode: 'replace' }
      );

      expect(container.textContent).toContain('Imported 1 completed achievements.');
    });

    it('handles invalid JSON gracefully', async () => {
      act(() => {
        root.render(<AchievementData />);
      });

      const fileInput = container.querySelector('input[type="file"]');
      const mockFile = new File(['{not json}'], 'import.json', { type: 'application/json' });

      Object.defineProperty(fileInput, 'files', { value: [mockFile] });

      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 10));
      });

      expect(container.textContent).toContain('This file contains invalid JSON.');
      expect(mockSetAchievementProgress).not.toHaveBeenCalled();
    });

    it('handles cancellation gracefully', async () => {
      act(() => {
        root.render(<AchievementData />);
      });

      const fileInput = container.querySelector('input[type="file"]');
      const mockFile = new File(['{"achievements":[80002]}'], 'import.json', { type: 'application/json' });

      Object.defineProperty(fileInput, 'files', { value: [mockFile] });

      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 10));
      });

      expect(container.textContent).toContain('Confirm Replacement');

      const buttons = Array.from(container.querySelectorAll('button'));
      const cancelBtn = buttons.find(b => b.textContent === 'Cancel');

      act(() => {
        cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockSetAchievementProgress).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('Confirm Replacement');
    });
  });
});
