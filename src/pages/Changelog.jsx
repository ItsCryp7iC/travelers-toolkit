import React, { useMemo, useState, useEffect } from 'react';
import { changelogEntries } from '../data/changelog';
import { normalizeGitHubCommit, mergeChangelogEntries } from '../utils/changelogUtils';

const typeStyles = {
  added: 'bg-green-500/20 text-green-400 border-green-500/30',
  changed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  fixed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  test: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  maintenance: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  docs: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export default function Changelog() {
  const [mergedEntries, setMergedEntries] = useState(changelogEntries);

  useEffect(() => {
    let isMounted = true;

    fetch('https://api.github.com/repos/ItsCryp7iC/travelers-toolkit/commits?sha=main&per_page=100')
      .then(res => {
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!isMounted || !Array.isArray(data)) return;

        const remoteEntries = data
          .map(normalizeGitHubCommit)
          .filter(Boolean);

        const newlyMerged = mergeChangelogEntries(changelogEntries, remoteEntries);
        setMergedEntries(newlyMerged);
      })
      .catch(err => {
        console.warn('Failed to fetch recent GitHub commits:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });

  const groupedEntries = useMemo(() => {
    const groups = {};
    mergedEntries.forEach(entry => {
      const dateObj = new Date(entry.timestamp);
      const dateKey = dateFormatter.format(dateObj);
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          dateObj,
          entries: []
        };
      }
      groups[dateKey].entries.push(entry);
    });
    return Object.values(groups).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [mergedEntries]);

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--text)] tracking-tight mb-2">Changelog</h1>
        <p className="text-[var(--muted)] text-lg mb-1">
          Complete development history of Traveler's Toolkit.
        </p>
        <p className="text-sm text-[var(--muted)]/70">
          {mergedEntries.length} commits
        </p>
      </header>

      <div className="space-y-12">
        {groupedEntries.map((group, groupIdx) => (
          <div key={groupIdx} className="relative">
            <h2 className="text-xl font-bold text-[var(--text)] mb-6 sticky top-0 bg-[#030712]/90 backdrop-blur py-2 z-10 border-b border-[var(--border)]">
              {group.dateKey}
            </h2>
            <div className="space-y-6">
              {group.entries.map((entry, idx) => {
                const timeStr = timeFormatter.format(new Date(entry.timestamp));
                return (
                  <div key={idx} className="flex flex-col md:flex-row gap-4 relative">
                    {/* Left sidebar / Metadata */}
                    <div className="md:w-32 shrink-0 flex flex-col items-start gap-1 pt-1">
                      <time dateTime={entry.timestamp} className="text-sm font-semibold text-[var(--muted)]">
                        {timeStr}
                      </time>
                      <span className={`px-2 py-0.5 mt-1 rounded text-xs font-bold uppercase tracking-wider border ${typeStyles[entry.type] || typeStyles.changed}`}>
                        {entry.type}
                      </span>
                    </div>
                    {/* Main Content */}
                    <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--elevated)]/60 backdrop-blur-md p-4 shadow-sm flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-base font-bold text-[var(--text)] leading-snug">{entry.title}</h3>
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline whitespace-nowrap shrink-0" title="View commit on GitHub">
                          {entry.shortSha} ↗
                        </a>
                      </div>
                      {entry.body && (
                        <details className="text-sm text-gray-300 mt-1 cursor-pointer group">
                          <summary className="text-[var(--muted)] select-none hover:text-[var(--text)] transition-colors inline-flex items-center gap-1">
                            <span className="text-[10px] opacity-70 group-open:rotate-90 transition-transform">▶</span>
                            Show details
                          </summary>
                          <div className="mt-3 pl-3 border-l-2 border-[var(--border)] whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {entry.body}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
