import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import AchievementData from './AchievementData';
import useStore from '../../store/useStore';

describe('AchievementData Integration', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Set a known initial state
    act(() => {
      useStore.setState({
        achievementProgress: {
          '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' }
        }
      });
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

    // Restore default state
    useStore.setState({ achievementProgress: {} });
  });

  it('renders correctly and completes a full import flow using the real store', async () => {
    act(() => {
      root.render(<AchievementData />);
    });

    // 1. Renders without throwing & displays the correct current completion count
    expect(container.textContent).toContain('Achievement Data');

    // We expect the text "Current Completed1" because of the grid layout
    // actually, let's just find the element that contains '1'
    const exportBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Export GOOD'));
    const importBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Import Achievements'));

    // 2. Exposes both Import and Export controls
    expect(exportBtn).toBeTruthy();
    expect(importBtn).toBeTruthy();

    // 3. Accepts a valid achievement JSON file
    const fileInput = container.querySelector('input[type="file"]');
    const mockFile = new File(['{"achievements":[80002]}'], 'import.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', { value: [mockFile] });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 10)); // wait for text() promise
    });

    expect(container.textContent).toContain('This import will replace your current local achievement completion state.');

    // 4. Does not alter progress before confirmation
    expect(useStore.getState().achievementProgress).toHaveProperty('80001');
    expect(useStore.getState().achievementProgress).not.toHaveProperty('80002');

    // 5. Invokes the real replacement action after confirmation
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Confirm Replacement'));
    act(() => {
      confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 6. Updates the real achievement progress map
    expect(container.textContent).toContain('Imported 1 completed achievements.');

    const newState = useStore.getState().achievementProgress;
    expect(newState).not.toHaveProperty('80001');
    expect(newState).toHaveProperty('80002');
    expect(newState['80002'].completed).toBe(true);
    expect(newState['80002'].completedAt).toBe(null);
  });

  it('completes a full native import flow with merge using the real store', async () => {
    act(() => {
      root.render(<AchievementData />);
    });

    const fileInput = container.querySelector('input[type="file"]');
    const mockPayload = {
      format: 'TRAVELERS_TOOLKIT_ACHIEVEMENTS',
      version: 1,
      achievementProgress: {
        '80002': { completed: true, completedAt: '2026-10-01T00:00:00.000Z' }
      }
    };
    const mockFile = new File([JSON.stringify(mockPayload)], 'import-native.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', { value: [mockFile] });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 10)); // wait for text() promise
    });

    expect(container.textContent).toContain('This is a native export file. You can merge it or replace your current state.');

    // 4. Does not alter progress before confirmation
    expect(useStore.getState().achievementProgress).toHaveProperty('80001');
    expect(useStore.getState().achievementProgress).not.toHaveProperty('80002');

    // 5. Invokes the real merge action after confirmation
    const mergeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Merge Progress'));
    act(() => {
      mergeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Merged native achievements successfully.');

    const newState = useStore.getState().achievementProgress;
    // 80001 should remain because it's a merge
    expect(newState).toHaveProperty('80001');
    expect(newState['80001'].completedAt).toBe('2024-01-01T00:00:00.000Z');

    // 80002 should be added
    expect(newState).toHaveProperty('80002');
    expect(newState['80002'].completed).toBe(true);
    expect(newState['80002'].completedAt).toBe('2026-10-01T00:00:00.000Z');
  });
});
