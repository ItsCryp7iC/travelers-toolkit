import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ResinTracker from './ResinTracker';

// Mock Zustand store lightweight
vi.mock('../store/useStore', () => {
  const store = {
    resinCount: 28,
    resinTimestamp: Date.now() - 100000,
    displayTimeZone: 'auto',
    setResin: vi.fn(),
  };
  return {
    default: (selector) => selector(store),
  };
});

describe('ResinTracker Component', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  const mockSyncData = {
    current: 28,
    max: 200,
    targetFullTime: Date.now() + 100000,
  };

  it('renders default variant without crashing and shows Full at time', async () => {
    await act(async () => {
      root.render(<ResinTracker syncData={mockSyncData} variant="default" />);
    });
    expect(container).toBeDefined();
    expect(container.textContent).toMatch(/Full at/);
  });

  it('renders compact variant without crashing and shows Full at time inside tooltip', async () => {
    await act(async () => {
      root.render(<ResinTracker syncData={mockSyncData} variant="compact" />);
    });
    expect(container).toBeDefined();
    expect(container.textContent).toMatch(/Full at/);
  });
});
