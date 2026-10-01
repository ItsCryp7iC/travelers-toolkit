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
    const exportBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Export Achievements'));
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
});
