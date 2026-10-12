import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { changelogEntries } from '../data/changelog';
import Changelog from './Changelog';

describe('Changelog Data', () => {
  it('has at least one entry', () => {
    expect(changelogEntries.length).toBeGreaterThan(0);
  });

  it('entries are in newest-first order', () => {
    if (changelogEntries.length <= 1) return;

    for (let i = 0; i < changelogEntries.length - 1; i++) {
      const current = new Date(changelogEntries[i].timestamp).getTime();
      const next = new Date(changelogEntries[i + 1].timestamp).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('entries have the required fields and correct formats', () => {
    const shas = new Set();

    changelogEntries.forEach((entry) => {
      expect(entry).toHaveProperty('sha');
      expect(entry).toHaveProperty('shortSha');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('url');

      expect(entry.shortSha).toBe(entry.sha.substring(0, 7));
      expect(entry.url).toBe(
        `https://github.com/ItsCryp7iC/travelers-toolkit/commit/${entry.sha}`
      );
      expect([
        'added',
        'changed',
        'fixed',
        'security',
        'test',
        'maintenance',
        'docs',
      ]).toContain(entry.type);
      expect(shas.has(entry.sha)).toBe(false);
      shas.add(entry.sha);
    });
  });
});

describe('Changelog Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders static history initially and updates on fetch', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              sha: 'new12345',
              commit: {
                committer: { date: '2026-09-30T10:00:00Z' },
                message: 'feat: dynamic fetch',
              },
              html_url: 'url',
            },
          ]),
      })
    );

    render(<Changelog />);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/ItsCryp7iC/travelers-toolkit/commits?sha=main&per_page=100'
    );

    expect(await screen.findByText('feat: dynamic fetch')).toBeInTheDocument();
  });

  it('falls back to static history on fetch failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch.mockImplementationOnce(() =>
      Promise.reject(new Error('Network Error'))
    );

    render(<Changelog />);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to fetch recent GitHub commits:',
        expect.any(Error)
      );
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Changelog');
    expect(screen.getByText(/commits/i)).toBeInTheDocument();
    warnSpy.mockRestore();
  });
});
