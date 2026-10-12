import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  const mockSyncData = {
    current: 1200,
    max: 2400,
    targetFullTime: Date.now() + 100000,
  };

  it('renders default variant without crashing and shows Full at time', () => {
    render(<RealmCurrencyTracker syncData={mockSyncData} variant="default" />);
    expect(screen.getByText(/Full at/i)).toBeInTheDocument();
  });

  it('renders compact variant without crashing and shows Full at time inside tooltip', () => {
    render(<RealmCurrencyTracker syncData={mockSyncData} variant="compact" />);
    expect(screen.getByText(/Full at/i)).toBeInTheDocument();
  });
});
