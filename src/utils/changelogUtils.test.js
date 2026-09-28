import { describe, it, expect } from 'vitest';
import { classifyCommitTitle, normalizeGitHubCommit, mergeChangelogEntries } from './changelogUtils';

describe('changelogUtils', () => {
  describe('classifyCommitTitle', () => {
    it('classifies security commits correctly', () => {
      expect(classifyCommitTitle('fix: harden oauth security')).toBe('security');
    });

    it('classifies feats as added', () => {
      expect(classifyCommitTitle('feat: add new button')).toBe('added');
      expect(classifyCommitTitle('feat(ui): add new button')).toBe('added');
    });

    it('classifies fixes as fixed', () => {
      expect(classifyCommitTitle('fix: resolve crash')).toBe('fixed');
    });

    it('classifies refactor/perf/style as changed', () => {
      expect(classifyCommitTitle('refactor: simplify')).toBe('changed');
      expect(classifyCommitTitle('perf: faster load')).toBe('changed');
      expect(classifyCommitTitle('style: format')).toBe('changed');
    });

    it('classifies test as test', () => {
      expect(classifyCommitTitle('test: add more assertions')).toBe('test');
    });

    it('classifies chore/build/ci as maintenance', () => {
      expect(classifyCommitTitle('chore: bump deps')).toBe('maintenance');
      expect(classifyCommitTitle('build: update script')).toBe('maintenance');
      expect(classifyCommitTitle('ci: add workflow')).toBe('maintenance');
    });

    it('defaults to changed for unknown types', () => {
      expect(classifyCommitTitle('Update README')).toBe('changed');
    });
  });

  describe('normalizeGitHubCommit', () => {
    it('normalizes a valid GitHub API commit object', () => {
      const apiCommit = {
        sha: 'b3a4c3f2c83f40ab91acc6e2f66efd08',
        commit: {
          author: { date: '2026-09-29T10:00:00Z' },
          message: 'feat(core): add feature X\n\nThis adds feature X.'
        },
        html_url: 'https://github.com/example/commit/b3a4c3f2'
      };

      const normalized = normalizeGitHubCommit(apiCommit);
      expect(normalized).toEqual({
        sha: 'b3a4c3f2c83f40ab91acc6e2f66efd08',
        shortSha: 'b3a4c3f',
        timestamp: '2026-09-29T10:00:00Z',
        title: 'feat(core): add feature X',
        body: 'This adds feature X.',
        type: 'added',
        url: 'https://github.com/example/commit/b3a4c3f2'
      });
    });

    it('handles missing body safely', () => {
      const apiCommit = {
        sha: '1234567890abcdef',
        commit: {
          committer: { date: '2026-09-29T11:00:00Z' },
          message: 'fix: resolve typo'
        }
      };

      const normalized = normalizeGitHubCommit(apiCommit);
      expect(normalized.title).toBe('fix: resolve typo');
      expect(normalized.body).toBe('');
      expect(normalized.type).toBe('fixed');
    });

    it('returns null for malformed commit', () => {
      expect(normalizeGitHubCommit(null)).toBeNull();
      expect(normalizeGitHubCommit({})).toBeNull();
    });
  });

  describe('mergeChangelogEntries', () => {
    const staticEntries = [
      { sha: '222', timestamp: '2026-09-28T00:00:00Z', title: 'Static 2' },
      { sha: '111', timestamp: '2026-09-27T00:00:00Z', title: 'Static 1' }
    ];

    it('returns static entries if remote is empty', () => {
      expect(mergeChangelogEntries(staticEntries, [])).toEqual(staticEntries);
      expect(mergeChangelogEntries(staticEntries, null)).toEqual(staticEntries);
    });

    it('merges new remote entries and sorts by newest first', () => {
      const remoteEntries = [
        { sha: '333', timestamp: '2026-09-29T00:00:00Z', title: 'Remote 3' }
      ];

      const merged = mergeChangelogEntries(staticEntries, remoteEntries);
      expect(merged).toHaveLength(3);
      expect(merged[0].sha).toBe('333');
      expect(merged[1].sha).toBe('222');
      expect(merged[2].sha).toBe('111');
    });

    it('deduplicates overlapping commits keeping remote entry (sorted properly)', () => {
      const remoteEntries = [
        { sha: '333', timestamp: '2026-09-29T00:00:00Z', title: 'Remote 3' },
        { sha: '222', timestamp: '2026-09-28T00:00:00Z', title: 'Static 2 updated' }
      ];

      const merged = mergeChangelogEntries(staticEntries, remoteEntries);
      expect(merged).toHaveLength(3);
      expect(merged[0].sha).toBe('333');
      expect(merged[1].title).toBe('Static 2 updated'); // Keeps remote version
      expect(merged[2].sha).toBe('111');
    });
  });
});
