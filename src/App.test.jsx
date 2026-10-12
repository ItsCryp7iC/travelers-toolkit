import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import useStore from './store/useStore';

vi.mock('./pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Mock</div>,
}));
vi.mock('./store/useStore');

describe('App Routing', () => {
  beforeEach(() => {
    useStore.mockImplementation((selector) => {
      const state = {
        showDbBuilder: false,
        roster: {},
        checkHoyolabSession: vi.fn().mockResolvedValue(false),
        handleSyncNotes: vi.fn(),
        checkGoogleSession: vi.fn(),
      };
      return selector(state);
    });
    useStore.subscribe = vi.fn().mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and resolves initial route with Suspense', async () => {
    render(<App />);
    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
  });
});
