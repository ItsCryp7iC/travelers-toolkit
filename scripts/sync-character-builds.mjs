#!/usr/bin/env node

/**
 * Character Builds Synchronization Controller (CB2B)
 *
 * Safe, read-only upstream synchronization system for Traveler's Toolkit.
 * Coordinates lightweight remote commit checks, sparse source retrieval,
 * local mapping cache invalidation, and atomic catalog generation.
 *
 * Operational & Security Guarantees:
 * - 100% read-only upstream access (zero writes, PRs, issues, or remote triggers)
 * - Zero execution of upstream scripts
 * - Minimal network impact: exits immediately when SHA and fingerprint match
 * - Concurrency locking: prevents simultaneous sync executions
 * - Rate-limit compliance: inspects and respects GitHub API headers
 * - Atomic publishing: never mutates or truncates destination on failure
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  runImporter,
  computeCatalogFingerprint,
  verifySourceIntegrity,
  getSourceCommitSha,
  readJsonFile,
  NORMALIZER_VERSION,
  SCHEMA_VERSION,
  DEFAULT_GUIDE_BASE_URL,
  DEFAULT_SOURCE_REPO_URL,
} from './import-character-builds.mjs';

export const DEFAULT_UPSTREAM_REPO =
  'Genshin-Impact-Helper-Team/genshin-builds';
export const DEFAULT_UPSTREAM_BRANCH = 'main';
export const DEFAULT_CACHE_DIR = '.cache/genshin-builds';
export const DEFAULT_OUTPUT_FILE = 'src/data/builds.json';

/**
 * Acquires a process-exclusive filesystem concurrency lock.
 */
export function acquireSyncLock(lockFilePath) {
  const lockDir = path.dirname(path.resolve(lockFilePath));
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  // Check for existing lock
  if (fs.existsSync(lockFilePath)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      const isPidRunning = (pid) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };

      const lockAgeMs = Date.now() - new Date(lockData.startedAt).getTime();
      const isStale = lockAgeMs > 60 * 60 * 1000; // 1 hour stale threshold

      if (lockData.pid && isPidRunning(lockData.pid) && !isStale) {
        throw new Error(
          `Synchronization process (PID: ${lockData.pid}) started at ${lockData.startedAt} is currently running. Exiting to prevent concurrent collision.`,
        );
      } else {
        console.warn(
          `[WARN] Breaking stale synchronization lock from PID ${lockData.pid} (Age: ${Math.round(lockAgeMs / 1000)}s).`,
        );
        fs.unlinkSync(lockFilePath);
      }
    } catch (err) {
      if (err.message && err.message.includes('currently running')) {
        throw err;
      }
      // If lock file was corrupted or unparseable, clean it up
      try {
        fs.unlinkSync(lockFilePath);
      } catch {
        // Ignored
      }
    }
  }

  const payload = JSON.stringify(
    {
      pid: process.pid,
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  fs.writeFileSync(lockFilePath, payload, { flag: 'wx' });

  // Return release function
  return () => {
    try {
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
    } catch {
      // Ignored during shutdown
    }
  };
}

/**
 * Performs a lightweight check of the upstream Git revision via GitHub REST API.
 * Respects rate-limits and returns HEAD commit SHA and rate-limit metadata.
 */
export async function fetchRemoteHeadSha({
  upstreamRepo = DEFAULT_UPSTREAM_REPO,
  branch = DEFAULT_UPSTREAM_BRANCH,
  githubToken = null,
  fetchFn = globalThis.fetch,
  preferGit = true,
} = {}) {
  // 1. Zero-rate-limit fast path: query Git wire protocol directly via git ls-remote
  if (preferGit && fetchFn === globalThis.fetch && !githubToken) {
    try {
      const repoUrl = `https://github.com/${upstreamRepo}.git`;
      const refName = `refs/heads/${branch}`;
      const stdout = execFileSync('git', ['ls-remote', repoUrl, refName], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10000,
      }).trim();

      if (stdout) {
        const [sha] = stdout.split(/\s+/);
        if (/^[0-9a-f]{40}$/i.test(sha)) {
          return {
            sha,
            rateLimitRemaining: null,
            rateLimitReset: null,
            source: 'git-ls-remote',
          };
        }
      }
    } catch {
      // Fall through to REST API
    }
  }

  // 2. GitHub REST API fallback (used when git binary is unavailable or in unit tests)
  const url = `https://api.github.com/repos/${upstreamRepo}/commits/${encodeURIComponent(branch)}`;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'TravelersToolkit-SyncBot/1.0 (+https://github.com/travelers-toolkit)',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken.trim()}`;
  }

  let response;
  try {
    response = await fetchFn(url, { method: 'GET', headers });
  } catch (netErr) {
    throw new Error(
      `Network error querying upstream repository ${upstreamRepo}: ${netErr.message}. Aborting synchronization safely.`,
      { cause: netErr },
    );
  }

  const rateLimitRemaining = response.headers?.get('x-ratelimit-remaining');
  const rateLimitReset = response.headers?.get('x-ratelimit-reset');

  if (response.status === 403 || response.status === 429) {
    const resetTime = rateLimitReset
      ? new Date(parseInt(rateLimitReset, 10) * 1000).toISOString()
      : 'unknown';
    throw new Error(
      `GitHub API rate limit exceeded (HTTP ${response.status}). Rate limit resets at ${resetTime}. Aborting synchronization safely without modifying catalog.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to query upstream commit on ${upstreamRepo} (${branch}): HTTP ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  if (!data || !data.sha || !/^[0-9a-f]{40}$/i.test(data.sha)) {
    throw new Error(
      `Invalid commit response from GitHub API for ${upstreamRepo}: missing 40-character SHA.`,
    );
  }

  return {
    sha: data.sha,
    rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null,
    rateLimitReset: rateLimitReset ? parseInt(rateLimitReset, 10) : null,
  };
}

/**
 * Retrieves required source directories at a pinned commit into local cache.
 * Uses shallow sparse-checkout to avoid binary assets, full histories, and scripts.
 */
export function retrieveSourceAtCommit({
  cacheDir = DEFAULT_CACHE_DIR,
  upstreamRepo = DEFAULT_UPSTREAM_REPO,
  commitSha,
  allowExisting = true,
}) {
  if (!commitSha || !/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error(`Invalid commit SHA for source retrieval: "${commitSha}"`);
  }

  const targetDir = path.resolve(path.join(cacheDir, commitSha));

  // If already cached and valid, reuse immediately
  if (allowExisting && fs.existsSync(targetDir)) {
    try {
      verifySourceIntegrity(targetDir);
      console.log(`Reusing verified local cached source at ${targetDir}`);
      return { targetDir, isCached: true };
    } catch {
      console.warn(`[WARN] Cached source at ${targetDir} is incomplete or corrupted. Re-fetching.`);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const tempExtractDir = path.resolve(
    path.join(cacheDir, `.tmp-${commitSha}-${Date.now()}`),
  );

  console.log(`Retrieving upstream source at commit ${commitSha.slice(0, 8)}...`);

  try {
    fs.mkdirSync(tempExtractDir, { recursive: true });

    // Method: Git shallow sparse-checkout (lowest network payload, no binary media, no deep history)
    const repoUrl = `https://github.com/${upstreamRepo}.git`;

    execFileSync(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--filter=blob:none',
        '--no-checkout',
        repoUrl,
        tempExtractDir,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    execFileSync(
      'git',
      ['-C', tempExtractDir, 'sparse-checkout', 'set', 'src/content', 'src/data', 'src/i18n'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    try {
      execFileSync(
        'git',
        ['-C', tempExtractDir, 'checkout', commitSha],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch {
      // If commitSha was not the shallow HEAD, explicitly fetch the exact commit
      execFileSync(
        'git',
        ['-C', tempExtractDir, 'fetch', '--depth', '1', 'origin', commitSha],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      execFileSync(
        'git',
        ['-C', tempExtractDir, 'checkout', commitSha],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    }

    // Verify integrity of retrieved source
    verifySourceIntegrity(tempExtractDir);

    // Atomic move into final cache location
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.renameSync(tempExtractDir, targetDir);

    return { targetDir, isCached: false };
  } catch (err) {
    // Cleanup temporary directory
    if (fs.existsSync(tempExtractDir)) {
      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
    throw new Error(
      `Failed to retrieve source directories from ${upstreamRepo} at commit ${commitSha}: ${err.message}`,
      { cause: err },
    );
  }
}

/**
 * Main Synchronization Controller.
 * Orchestrates lightweight check, conditional source retrieval, and catalog generation.
 */
export async function syncCharacterBuilds({
  cacheDir = DEFAULT_CACHE_DIR,
  outputFile = DEFAULT_OUTPUT_FILE,
  mappingsDir = 'src/data/mappings',
  charactersFile = 'src/data/characters.json',
  travelerFile = 'src/data/traveler.json',
  weaponsFile = 'src/data/weapons.json',
  artifactsFile = 'src/data/artifacts.json',
  upstreamRepo = DEFAULT_UPSTREAM_REPO,
  upstreamBranch = DEFAULT_UPSTREAM_BRANCH,
  sourceDir = null, // Direct source directory override (offline / local development / testing)
  force = false,
  dryRun = false,
  githubToken = process.env.GITHUB_TOKEN || null,
  summaryFile = null,
  fetchFn = globalThis.fetch,
  guideBaseUrl = DEFAULT_GUIDE_BASE_URL,
  sourceRepoUrl = DEFAULT_SOURCE_REPO_URL,
} = {}) {
  const startTime = Date.now();
  console.log('=== Character Builds Synchronization Controller (CB2B) ===');

  const lockFilePath = path.join(path.dirname(path.resolve(outputFile)), '.sync.lock');
  const releaseLock = acquireSyncLock(lockFilePath);

  try {
    // 1. Inspect existing published catalog
    let existingCatalog = null;
    let existingSha = null;
    let existingFingerprint = null;

    if (fs.existsSync(outputFile)) {
      try {
        existingCatalog = readJsonFile(outputFile);
        existingSha = existingCatalog.sourceCommitSha || null;
        existingFingerprint = existingCatalog.mappingFingerprint || null;
        console.log(`Current published SHA:       ${existingSha || '(none)'}`);
        console.log(`Current mapping fingerprint: ${existingFingerprint || '(none)'}`);
      } catch {
        console.warn(`[WARN] Existing ${outputFile} is missing or invalid. Full sync required.`);
      }
    } else {
      console.log(`No existing catalog found at ${outputFile}. Full initial synchronization required.`);
    }

    // 2. Compute current local mapping fingerprint
    const currentFingerprint = computeCatalogFingerprint({
      mappingsDir,
      charactersFile,
      travelerFile,
      weaponsFile,
      artifactsFile,
      normalizerVersion: NORMALIZER_VERSION,
      schemaVersion: SCHEMA_VERSION,
    });
    console.log(`Local mapping fingerprint:   ${currentFingerprint}`);

    // 3. Resolve target upstream commit SHA
    let targetSha = null;
    let rateLimitRemaining = null;

    if (sourceDir) {
      console.log(`Using explicit local source directory: ${sourceDir}`);
      targetSha = getSourceCommitSha(sourceDir);
    } else {
      console.log(`Checking upstream ${upstreamRepo} branch "${upstreamBranch}"...`);
      const remoteInfo = await fetchRemoteHeadSha({
        upstreamRepo,
        branch: upstreamBranch,
        githubToken,
        fetchFn,
      });
      targetSha = remoteInfo.sha;
      rateLimitRemaining = remoteInfo.rateLimitRemaining;
      console.log(`Upstream remote HEAD SHA:    ${targetSha}`);
      if (rateLimitRemaining !== null) {
        console.log(`GitHub API calls remaining:  ${rateLimitRemaining}`);
      }
    }

    // 4. Decision: Check if already up to date
    const shaUnchanged = existingSha && existingSha.toLowerCase() === targetSha.toLowerCase();
    const fingerprintUnchanged = existingFingerprint === currentFingerprint;

    if (!force && shaUnchanged && fingerprintUnchanged) {
      console.log('\n--- Synchronization Skipped ---');
      console.log(`Upstream commit (${targetSha.slice(0, 8)}) and local mapping fingerprint match.`);
      console.log('Published catalog is completely up to date. Zero content downloaded.\n');

      const result = {
        status: 'UP_TO_DATE',
        sourceCommitSha: targetSha,
        mappingFingerprint: currentFingerprint,
        downloaded: false,
        published: false,
        durationMs: Date.now() - startTime,
        charactersCount: existingCatalog?.characters?.length || 0,
        rolesCount: existingCatalog?.characters?.reduce((a, c) => a + c.roles.length, 0) || 0,
      };

      if (summaryFile) {
        writeSyncSummaryFile(summaryFile, result);
      }

      return result;
    }

    // 5. Determine source directory and retrieve if necessary
    let verifiedSourceDir = sourceDir;
    let wasDownloaded = false;

    if (!verifiedSourceDir) {
      const cachedSourcePath = path.resolve(path.join(cacheDir, targetSha));

      // If upstream SHA is unchanged, prefer reusing existing local source cache
      if (shaUnchanged && fs.existsSync(cachedSourcePath)) {
        try {
          verifySourceIntegrity(cachedSourcePath);
          console.log(`Reusing existing verified local cache for ${targetSha.slice(0, 8)}...`);
          verifiedSourceDir = cachedSourcePath;
        } catch {
          // Fall through to retrieve
        }
      }

      if (!verifiedSourceDir) {
        const retrieval = retrieveSourceAtCommit({
          cacheDir,
          upstreamRepo,
          commitSha: targetSha,
          allowExisting: true,
        });
        verifiedSourceDir = retrieval.targetDir;
        wasDownloaded = !retrieval.isCached;
      }
    }

    // 6. Execute importer with verified source data
    console.log(`\nExecuting normalization engine on source commit ${targetSha.slice(0, 8)}...`);

    const importResult = await runImporter({
      sourceDir: verifiedSourceDir,
      outputFile,
      mappingsDir,
      charactersFile,
      travelerFile,
      weaponsFile,
      artifactsFile,
      sourceCommit: targetSha,
      force: true,
      validateOnly: Boolean(dryRun),
      allowDirty: false, // Never permit dirty source in production synchronization
      previousCatalog: existingCatalog,
      guideBaseUrl,
      sourceRepoUrl,
    });

    const totalCharacters = importResult.catalog.characters.length;
    const totalRoles = importResult.catalog.characters.reduce(
      (a, c) => a + c.roles.length,
      0,
    );
    const durationMs = Date.now() - startTime;

    console.log('\n--- Synchronization Successful ---');
    console.log(`Status:              ${dryRun ? 'DRY_RUN (Validated)' : 'SYNCED (Published)'}`);
    console.log(`Target Commit:       ${targetSha}`);
    console.log(`Downloaded Content:  ${wasDownloaded ? 'Yes' : 'No (Reused Cache)'}`);
    console.log(`Total Characters:    ${totalCharacters}`);
    console.log(`Total Role Builds:   ${totalRoles}`);
    console.log(`Duration:            ${durationMs}ms\n`);

    const result = {
      status: dryRun ? 'DRY_RUN' : 'SYNCED',
      sourceCommitSha: targetSha,
      mappingFingerprint: currentFingerprint,
      downloaded: wasDownloaded,
      published: !dryRun,
      durationMs,
      charactersCount: totalCharacters,
      rolesCount: totalRoles,
      catalog: importResult.catalog,
    };

    if (summaryFile) {
      writeSyncSummaryFile(summaryFile, result);
    }

    return result;
  } finally {
    releaseLock();
  }
}

/**
 * Writes markdown summary for GitHub Actions step summary or inspection report.
 */
export function writeSyncSummaryFile(summaryFilePath, result) {
  const md = `## Character Builds Synchronization Report

| Metric | Result |
| :--- | :--- |
| **Status** | \`${result.status}\` |
| **Source Commit SHA** | \`${result.sourceCommitSha}\` |
| **Mapping Fingerprint** | \`${result.mappingFingerprint.slice(0, 16)}...\` |
| **New Content Downloaded** | ${result.downloaded ? '✅ Yes' : '⚡ No (Reused / Up to date)'} |
| **Published to Catalog** | ${result.published ? '✅ Yes' : '⏸️ No (Dry Run / Up to date)'} |
| **Total Characters** | ${result.charactersCount} |
| **Total Role Builds** | ${result.rolesCount} |
| **Execution Duration** | ${result.durationMs}ms |

*Generated at: ${new Date().toISOString()}*
`;

  try {
    const dir = path.dirname(path.resolve(summaryFilePath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(summaryFilePath, md, 'utf8');
  } catch (err) {
    console.warn(`[WARN] Failed to write summary file at ${summaryFilePath}: ${err.message}`);
  }
}

// CLI Entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let cacheDir = DEFAULT_CACHE_DIR;
  let outputFile = DEFAULT_OUTPUT_FILE;
  let mappingsDir = 'src/data/mappings';
  let charactersFile = 'src/data/characters.json';
  let travelerFile = 'src/data/traveler.json';
  let weaponsFile = 'src/data/weapons.json';
  let artifactsFile = 'src/data/artifacts.json';
  let upstreamRepo = DEFAULT_UPSTREAM_REPO;
  let upstreamBranch = DEFAULT_UPSTREAM_BRANCH;
  let sourceDir = null;
  let force = false;
  let dryRun = false;
  let summaryFile = null;
  let githubToken = process.env.GITHUB_TOKEN || null;
  let guideBaseUrl = DEFAULT_GUIDE_BASE_URL;
  let sourceRepoUrl = DEFAULT_SOURCE_REPO_URL;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--cache-dir' && i + 1 < args.length) {
      cacheDir = args[++i];
    } else if (arg === '--output-file' && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (arg === '--mappings-dir' && i + 1 < args.length) {
      mappingsDir = args[++i];
    } else if (arg === '--characters-file' && i + 1 < args.length) {
      charactersFile = args[++i];
    } else if (arg === '--traveler-file' && i + 1 < args.length) {
      travelerFile = args[++i];
    } else if (arg === '--weapons-file' && i + 1 < args.length) {
      weaponsFile = args[++i];
    } else if (arg === '--artifacts-file' && i + 1 < args.length) {
      artifactsFile = args[++i];
    } else if (arg === '--upstream-repo' && i + 1 < args.length) {
      upstreamRepo = args[++i];
    } else if (arg === '--upstream-branch' && i + 1 < args.length) {
      upstreamBranch = args[++i];
    } else if (arg === '--source-dir' && i + 1 < args.length) {
      sourceDir = args[++i];
    } else if (arg === '--summary-file' && i + 1 < args.length) {
      summaryFile = args[++i];
    } else if (arg === '--github-token' && i + 1 < args.length) {
      githubToken = args[++i];
    } else if (arg === '--guide-base-url' && i + 1 < args.length) {
      guideBaseUrl = args[++i];
    } else if (arg === '--source-repo-url' && i + 1 < args.length) {
      sourceRepoUrl = args[++i];
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  syncCharacterBuilds({
    cacheDir,
    outputFile,
    mappingsDir,
    charactersFile,
    travelerFile,
    weaponsFile,
    artifactsFile,
    upstreamRepo,
    upstreamBranch,
    sourceDir,
    force,
    dryRun,
    githubToken,
    summaryFile,
    guideBaseUrl,
    sourceRepoUrl,
  }).catch((err) => {
    console.error('\nSync Controller Error:', err.message);
    process.exit(1);
  });
}
