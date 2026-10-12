import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  const mockSyncData = {
    current: 28,
    max: 200,
    targetFullTime: Date.now() + 100000,
  };

  it('renders default variant without crashing and shows Full at time', () => {
    render(<ResinTracker syncData={mockSyncData} variant="default" />);
    expect(screen.getByText(/Full at/i)).toBeInTheDocument();
  });

  it('renders compact variant without crashing and shows Full at time inside tooltip', () => {
    render(<ResinTracker syncData={mockSyncData} variant="compact" />);
    expect(screen.getByText(/Full at/i)).toBeInTheDocument();
  });
});
