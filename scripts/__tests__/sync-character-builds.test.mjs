// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  acquireSyncLock,
  fetchRemoteHeadSha,
  syncCharacterBuilds,
  writeSyncSummaryFile,
} from '../sync-character-builds.mjs';

const MOCK_SHA_1 = 'be542cba19de28f31e4a352f8711ffaff9d2c838';
const MOCK_SHA_2 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const SOURCE_DIR =
  process.env.GENSHIN_BUILDS_SOURCE_DIR ||
  path.resolve(
    os.homedir(),
    '.gemini/antigravity/brain/83029ac3-ae6f-49dd-bc83-f3de1dee8eb1/scratch/genshin-builds',
  );

describe(
  'Character Builds Synchronization Controller (CB2B)',
  { timeout: 60_000 },
  () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-sync-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('1. Concurrency Lock Safeguards', () => {
    it('acquires and releases a concurrency lock cleanly', () => {
      const lockPath = path.join(tempDir, '.sync.lock');
      expect(fs.existsSync(lockPath)).toBe(false);

      const release = acquireSyncLock(lockPath);
      expect(fs.existsSync(lockPath)).toBe(true);

      const lockContent = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      expect(lockContent.pid).toBe(process.pid);
      expect(lockContent.startedAt).toBeDefined();

      release();
      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('rejects concurrent synchronization attempts when active lock exists', () => {
      const lockPath = path.join(tempDir, '.sync.lock');
      const release1 = acquireSyncLock(lockPath);

      expect(() => acquireSyncLock(lockPath)).toThrow(
        /is currently running\. Exiting to prevent concurrent collision/,
      );

      release1();
    });

    it('recovers safely from a stale lock left by a dead process', () => {
      const lockPath = path.join(tempDir, '.sync.lock');
      // Use an impossibly high PID unlikely to exist
      const deadPid = 9999999;
      fs.writeFileSync(
        lockPath,
        JSON.stringify({
          pid: deadPid,
          startedAt: new Date(Date.now() - 10000).toISOString(),
        }),
        'utf8',
      );

      const release = acquireSyncLock(lockPath);
      expect(fs.existsSync(lockPath)).toBe(true);
      const newLockContent = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      expect(newLockContent.pid).toBe(process.pid);

      release();
    });
  });

  describe('2. Lightweight Remote Commit Inspection (fetchRemoteHeadSha)', () => {
    it('queries GitHub commit API and extracts 40-character SHA with rate-limit headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-remaining': '59',
          'x-ratelimit-reset': '1731670000',
        }),
        json: async () => ({ sha: MOCK_SHA_1 }),
      });

      const result = await fetchRemoteHeadSha({
        upstreamRepo: 'Genshin-Impact-Helper-Team/genshin-builds',
        branch: 'main',
        fetchFn: mockFetch,
      });

      expect(result.sha).toBe(MOCK_SHA_1);
      expect(result.rateLimitRemaining).toBe(59);
      expect(result.rateLimitReset).toBe(1731670000);
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toContain(
        'https://api.github.com/repos/Genshin-Impact-Helper-Team/genshin-builds/commits/main',
      );
    });

    it('handles GitHub rate limit (403/429) safely and aborts without writes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1731680000',
        }),
        json: async () => ({ message: 'API rate limit exceeded' }),
      });

      await expect(
        fetchRemoteHeadSha({
          upstreamRepo: 'Genshin-Impact-Helper-Team/genshin-builds',
          branch: 'main',
          fetchFn: mockFetch,
        }),
      ).rejects.toThrow(/GitHub API rate limit exceeded/);
    });

    it('fails safely on network error', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error('Connection refused'));

      await expect(
        fetchRemoteHeadSha({
          fetchFn: mockFetch,
        }),
      ).rejects.toThrow(/Network error querying upstream repository/);
    });
  });

  describe('3. Decision Matrix & Synchronization Orchestration', () => {
    it(
      'skips synchronization when upstream SHA and local fingerprint are unchanged',
      async () => {
        const outputFile = path.join(tempDir, 'builds.json');

        // 1. Initial sync with local sourceDir
        const initial = await syncCharacterBuilds({
          sourceDir: SOURCE_DIR,
          outputFile,
          cacheDir: tempDir,
        });
        expect(initial.status).toBe('SYNCED');
        expect(initial.published).toBe(true);

        const existingFingerprint = initial.mappingFingerprint;
        const existingSha = initial.sourceCommitSha;

        // 2. Second sync check with unchanged remote SHA
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'x-ratelimit-remaining': '60' }),
          json: async () => ({ sha: existingSha }),
        });

        const second = await syncCharacterBuilds({
          outputFile,
          cacheDir: tempDir,
          fetchFn: mockFetch,
        });

        expect(second.status).toBe('UP_TO_DATE');
        expect(second.downloaded).toBe(false);
        expect(second.published).toBe(false);
        expect(second.mappingFingerprint).toBe(existingFingerprint);
      },
      30_000,
    );

    it(
      'prefers reusing verified local cached source when local mappings change but upstream SHA is identical',
      async () => {
        const outputFile = path.join(tempDir, 'builds.json');
        const cacheDir = path.join(tempDir, 'cache');

        // Populate fake cached source directory
        const cachedSourceDir = path.join(cacheDir, MOCK_SHA_1);
        fs.mkdirSync(cacheDir, { recursive: true });
        try {
          fs.symlinkSync(SOURCE_DIR, cachedSourceDir, 'junction');
        } catch {
          fs.cpSync(SOURCE_DIR, cachedSourceDir, { recursive: true });
        }

        // Write an existing catalog with older fingerprint
        const oldCatalog = {
          schemaVersion: 1,
          sourceCommitSha: MOCK_SHA_1,
          mappingFingerprint:
            '0000000000000000000000000000000000000000000000000000000000000000',
          normalizerVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          characters: [],
        };
        fs.writeFileSync(
          outputFile,
          JSON.stringify(oldCatalog, null, 2),
          'utf8',
        );

        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'x-ratelimit-remaining': '60' }),
          json: async () => ({ sha: MOCK_SHA_1 }),
        });

        const result = await syncCharacterBuilds({
          outputFile,
          cacheDir,
          fetchFn: mockFetch,
        });

        // Should reuse the cached source without calling download
        expect(result.status).toBe('SYNCED');
        expect(result.downloaded).toBe(false);
        expect(result.published).toBe(true);
        expect(result.sourceCommitSha).toBe(MOCK_SHA_1);
      },
      30_000,
    );

    it(
      'respects --dry-run without publishing catalog to disk',
      async () => {
        const outputFile = path.join(tempDir, 'builds.json');
        const originalContent = '{"existing": true}';
        fs.writeFileSync(outputFile, originalContent, 'utf8');

        const result = await syncCharacterBuilds({
          sourceDir: SOURCE_DIR,
          outputFile,
          cacheDir: tempDir,
          dryRun: true,
        });

        expect(result.status).toBe('DRY_RUN');
        expect(result.published).toBe(false);
        // Destination preserved byte-for-byte
        expect(fs.readFileSync(outputFile, 'utf8')).toBe(originalContent);
      },
      30_000,
    );

    it('preserves existing catalog byte-for-byte when synchronization fails midway', async () => {
      const outputFile = path.join(tempDir, 'builds.json');
      const originalContent = '{"immutable": true, "version": 1}\n';
      fs.writeFileSync(outputFile, originalContent, 'utf8');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sha: MOCK_SHA_2 }),
      });

      // Pass non-existent directory to force failure
      await expect(
        syncCharacterBuilds({
          sourceDir: path.join(tempDir, 'invalid-source'),
          outputFile,
          cacheDir: tempDir,
          fetchFn: mockFetch,
          force: true,
        }),
      ).rejects.toThrow();

      // Confirm existing catalog preserved byte-for-byte
      expect(fs.readFileSync(outputFile, 'utf8')).toBe(originalContent);
    });
  });

  describe('4. Markdown Sync Summary Report', () => {
    it('generates a valid markdown summary file', () => {
      const summaryPath = path.join(tempDir, 'sync-summary.md');
      const mockResult = {
        status: 'SYNCED',
        sourceCommitSha: MOCK_SHA_1,
        mappingFingerprint:
          'd2f9e87a88446ae9d25be967fc64eaaca077cdb9f599b012c29f3715e9972ddd',
        downloaded: false,
        published: true,
        charactersCount: 129,
        rolesCount: 184,
        durationMs: 1420,
      };

      writeSyncSummaryFile(summaryPath, mockResult);
      expect(fs.existsSync(summaryPath)).toBe(true);

      const content = fs.readFileSync(summaryPath, 'utf8');
      expect(content).toContain('Character Builds Synchronization Report');
      expect(content).toContain('`SYNCED`');
      expect(content).toContain(MOCK_SHA_1);
      expect(content).toContain('129');
      expect(content).toContain('184');
      expect(content).toContain('1420ms');
    });
  });
});
