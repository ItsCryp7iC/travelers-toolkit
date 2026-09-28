import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { changelogEntries } from '../data/changelog';

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

    changelogEntries.forEach(entry => {
      // Required fields
      expect(entry).toHaveProperty('sha');
      expect(entry).toHaveProperty('shortSha');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('url');

      // Check SHA matching
      expect(entry.shortSha).toBe(entry.sha.substring(0, 7));

      // Check URL format
      expect(entry.url).toBe(`https://github.com/ItsCryp7iC/travelers-toolkit/commit/${entry.sha}`);

      // Valid types
      expect(['added', 'changed', 'fixed', 'security', 'test', 'maintenance', 'docs']).toContain(entry.type);

      // No duplicates
      expect(shas.has(entry.sha)).toBe(false);
      shas.add(entry.sha);
    });
  });
});

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Changelog from './Changelog';
import { vi } from 'vitest';

describe('Changelog Component', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );
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

  it('renders static history initially and updates on fetch', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            sha: 'new12345',
            commit: {
              committer: { date: '2026-09-30T10:00:00Z' },
              message: 'feat: dynamic fetch'
            },
            html_url: 'url'
          }
        ])
      })
    );

    await act(async () => {
      root.render(<Changelog />);
    });

    // Check if fetch was called
    expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/repos/ItsCryp7iC/travelers-toolkit/commits?sha=main&per_page=100');

    // Check if new commit is rendered
    expect(container.textContent).toContain('feat: dynamic fetch');
  });

  it('falls back to static history on fetch failure', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.reject(new Error('Network Error'))
    );

    await act(async () => {
      root.render(<Changelog />);
    });

    // Original static commits should still be visible
    expect(container.textContent).toContain('commits'); // from the header X commits
  });
});
