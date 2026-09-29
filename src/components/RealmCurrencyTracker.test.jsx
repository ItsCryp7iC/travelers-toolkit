import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RealmCurrencyTracker from './RealmCurrencyTracker';

// Mock Zustand store lightweight
vi.mock('../store/useStore', () => {
  const store = {
    displayTimeZone: 'auto',
  };
  return {
    default: (selector) => selector(store),
  };
});

describe('RealmCurrencyTracker Component', () => {
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
    current: 1200,
    max: 2400,
    targetFullTime: Date.now() + 100000,
  };

  it('renders default variant without crashing and shows Full at time', async () => {
    await act(async () => {
      root.render(<RealmCurrencyTracker syncData={mockSyncData} variant="default" />);
    });
    expect(container).toBeDefined();
    expect(container.textContent).toMatch(/Full at/);
  });

  it('renders compact variant without crashing and shows Full at time inside tooltip', async () => {
    await act(async () => {
      root.render(<RealmCurrencyTracker syncData={mockSyncData} variant="compact" />);
    });
    expect(container).toBeDefined();
    expect(container.textContent).toMatch(/Full at/);
  });
});
