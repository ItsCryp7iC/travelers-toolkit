export function classifyCommitTitle(title) {
  if (!title) return 'changed';
  const lowerTitle = title.toLowerCase();
  if (
    lowerTitle.includes('security') ||
    lowerTitle.includes('secure') ||
    lowerTitle.includes('harden') ||
    lowerTitle.includes('oauth security') ||
    lowerTitle.includes('cors security')
  ) {
    return 'security';
  }

  const prefixMatch = title.match(/^([a-zA-Z]+)(?:\([^)]+\))?:/);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toLowerCase();
    switch (prefix) {
      case 'feat':
        return 'added';
      case 'fix':
        return 'fixed';
      case 'refactor':
      case 'perf':
      case 'style':
        return 'changed';
      case 'test':
        return 'test';
      case 'chore':
      case 'build':
      case 'ci':
        return 'maintenance';
      case 'docs':
        return 'docs';
    }
  }
  return 'changed';
}

export function normalizeGitHubCommit(apiCommit) {
  if (!apiCommit || !apiCommit.sha || !apiCommit.commit) {
    return null;
  }

  const sha = apiCommit.sha;
  const shortSha = sha.substring(0, 7);

  // Use committer date or author date
  const timestamp = apiCommit.commit.committer?.date || apiCommit.commit.author?.date;

  const fullMessage = apiCommit.commit.message || '';
  const lines = fullMessage.split('\n');
  const title = lines[0] || '';
  const body = lines.slice(1).join('\n').trim();

  const type = classifyCommitTitle(title);

  return {
    sha,
    shortSha,
    timestamp,
    title,
    body,
    type,
    url: apiCommit.html_url || `https://github.com/ItsCryp7iC/travelers-toolkit/commit/${sha}`
  };
}

export function mergeChangelogEntries(staticEntries, remoteEntries) {
  if (!remoteEntries || remoteEntries.length === 0) {
    return staticEntries;
  }

  const merged = [...remoteEntries];
  const remoteShas = new Set(remoteEntries.map(e => e.sha));

  for (const staticEntry of staticEntries) {
    if (!remoteShas.has(staticEntry.sha)) {
      merged.push(staticEntry);
    }
  }

  // Sort newest first by timestamp
  merged.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return merged;
}
