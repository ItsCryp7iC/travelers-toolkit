import { describe, it, expect } from 'vitest';
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
