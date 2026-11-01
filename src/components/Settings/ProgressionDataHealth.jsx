import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import defaultWeaponsData from '../../data/weapons.json';
import { diagnoseProgressionState } from '../../utils/progressionContracts';

export default function ProgressionDataHealth({
  roster: propRoster,
  trackedWeapons: propTrackedWeapons,
  weaponsData: propWeaponsData,
  autoScan = true,
}) {
  const storeRoster = useStore((s) => s.roster);
  const storeTrackedWeapons = useStore((s) => s.trackedWeapons);

  // Allow props to override store for isolated tests
  const roster = propRoster !== undefined ? propRoster : storeRoster;
  const trackedWeapons = propTrackedWeapons !== undefined ? propTrackedWeapons : storeTrackedWeapons;
  const weaponsData = propWeaponsData !== undefined ? propWeaponsData : defaultWeaponsData;

  const [hasScanned, setHasScanned] = useState(autoScan);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState(() => (autoScan ? new Date().toLocaleTimeString() : null));
  const [scanKey, setScanKey] = useState(0);

  // Filter state: 'all' | 'characters' | 'weapons'
  const [filter, setFilter] = useState('all');

  // Expanded card state: set of record keys
  const [expandedRecordIds, setExpandedRecordIds] = useState(() => new Set());
  const [showRepairFlow, setShowRepairFlow] = useState(false);

  // Pure diagnostic calculation
  const report = useMemo(() => {
    if (!hasScanned) return null;
    return diagnoseProgressionState({ roster, trackedWeapons, weaponsData });
  }, [hasScanned, roster, trackedWeapons, weaponsData, scanKey]);

  const handleScan = () => {
    setIsScanning(true);
    // Pure in-memory calculation; state update triggers re-scan
    setScanKey((k) => k + 1);
    setHasScanned(true);
    setLastScannedAt(new Date().toLocaleTimeString());
    setIsScanning(false);
  };

  const toggleExpand = (id) => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (!report || report.invalidRecords.length === 0) return;
    if (expandedRecordIds.size === report.invalidRecords.length) {
      setExpandedRecordIds(new Set());
    } else {
      setExpandedRecordIds(new Set(report.invalidRecords.map((r) => r.id)));
    }
  };

  // Filtered invalid records
  const filteredRecords = useMemo(() => {
    if (!report) return [];
    if (filter === 'characters') return report.invalidCharacters;
    if (filter === 'weapons') return report.invalidWeapons;
    return report.invalidRecords;
  }, [report, filter]);

  return (
    <section
      className="genshin-card p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 col-span-1 md:col-span-2"
      aria-labelledby="progression-data-health-title"
    >
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-2 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl sm:text-2xl" aria-hidden="true">🩺</span>
          <h2 id="progression-data-health-title" className="text-lg font-bold text-primary truncate">
            Progression Data Health
          </h2>
        </div>

        {report && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
              report.isValid
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            {report.isValid ? '✓ Healthy' : `⚠️ ${report.issuesCount} Issue${report.issuesCount === 1 ? '' : 's'}`}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
        Audit your saved character roster and tracked weapons for impossible level and ascension combinations.
        This diagnostic tool is strictly read-only and never modifies your saved data or localStorage.
      </p>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          className="genshin-btn flex items-center justify-center gap-2 min-h-[40px] px-4 text-xs sm:text-sm font-semibold"
          onClick={handleScan}
          disabled={isScanning}
          aria-label="Scan Progression Data"
        >
          <span aria-hidden="true">{isScanning ? '⏳' : '🔍'}</span>
          <span>{isScanning ? 'Scanning...' : 'Scan Progression Data'}</span>
        </button>

        {lastScannedAt && (
          <span className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
            Last scanned: {lastScannedAt}
          </span>
        )}
      </div>

      {/* Status & Results */}
      {report && (
        <div className="flex flex-col gap-4 mt-2">
          {/* Summary Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-[var(--elevated)] p-3 rounded-lg border border-[var(--border)] flex flex-col min-w-0">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">Scanned</span>
              <span className="text-lg sm:text-xl font-bold text-[var(--color-text-main)] mt-0.5">
                {report.totalScanned}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                {report.totalCharacters} chars • {report.totalWeapons} weapons
              </span>
            </div>

            <div className="bg-[var(--elevated)] p-3 rounded-lg border border-[var(--border)] flex flex-col min-w-0">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">Valid Records</span>
              <span className="text-lg sm:text-xl font-bold text-green-400 mt-0.5">
                {report.validRecordsCount}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                {report.totalScanned > 0
                  ? `${Math.round((report.validRecordsCount / report.totalScanned) * 100)}% passing`
                  : 'No records'}
              </span>
            </div>

            <div className="bg-[var(--elevated)] p-3 rounded-lg border border-[var(--border)] flex flex-col min-w-0">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">Invalid Records</span>
              <span
                className={`text-lg sm:text-xl font-bold mt-0.5 ${
                  report.invalidRecordsCount > 0 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {report.invalidRecordsCount}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                {report.invalidCharactersCount} char • {report.invalidWeaponsCount} weapon
              </span>
            </div>

            <div className="bg-[var(--elevated)] p-3 rounded-lg border border-[var(--border)] flex flex-col min-w-0">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">Total Issues</span>
              <span
                className={`text-lg sm:text-xl font-bold mt-0.5 ${
                  report.issuesCount > 0 ? 'text-amber-400' : 'text-green-400'
                }`}
              >
                {report.issuesCount}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                {report.characterIssuesCount} char • {report.weaponIssuesCount} weapon
              </span>
            </div>
          </div>

          {/* Clean State Banner */}
          {report.isValid ? (
            <div
              className="p-3.5 sm:p-4 rounded-lg bg-green-950/20 border border-green-500/30 text-green-300 flex items-start gap-3"
              role="status"
            >
              <span className="text-xl shrink-0" aria-hidden="true">✅</span>
              <div className="flex flex-col min-w-0">
                <h3 className="text-sm font-bold text-green-400">All progression data is healthy</h3>
                <p className="text-xs text-green-300/90 mt-0.5 leading-relaxed">
                  No invalid level or ascension states detected across {report.totalCharacters} character
                  {report.totalCharacters === 1 ? '' : 's'} and {report.totalWeapons} tracked weapon
                  {report.totalWeapons === 1 ? '' : 's'}. All saved values strictly satisfy domain progression contracts.
                </p>
              </div>
            </div>
          ) : (
            /* Issues Display Section */
            <div className="flex flex-col gap-3 mt-1">
              {/* Filter and Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Issue category filter">
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded text-xs font-semibold min-h-[36px] transition-colors ${
                      filter === 'all'
                        ? 'bg-primary text-[#0d0f1a]'
                        : 'bg-[var(--elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--border)]'
                    }`}
                    onClick={() => setFilter('all')}
                    aria-selected={filter === 'all'}
                    role="tab"
                  >
                    All ({report.invalidRecordsCount})
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded text-xs font-semibold min-h-[36px] transition-colors ${
                      filter === 'characters'
                        ? 'bg-primary text-[#0d0f1a]'
                        : 'bg-[var(--elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--border)]'
                    }`}
                    onClick={() => setFilter('characters')}
                    aria-selected={filter === 'characters'}
                    role="tab"
                  >
                    Characters ({report.invalidCharactersCount})
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded text-xs font-semibold min-h-[36px] transition-colors ${
                      filter === 'weapons'
                        ? 'bg-primary text-[#0d0f1a]'
                        : 'bg-[var(--elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--border)]'
                    }`}
                    onClick={() => setFilter('weapons')}
                    aria-selected={filter === 'weapons'}
                    role="tab"
                  >
                    Weapons ({report.invalidWeaponsCount})
                  </button>
                </div>

                <button
                  type="button"
                  className="genshin-btn-ghost px-3 py-1.5 text-xs font-semibold min-h-[36px] flex items-center gap-1"
                  onClick={toggleExpandAll}
                  aria-label={
                    expandedRecordIds.size === report.invalidRecords.length ? 'Collapse all issues' : 'Expand all issues'
                  }
                >
                  <span>{expandedRecordIds.size === report.invalidRecords.length ? '▲' : '▼'}</span>
                  <span>
                    {expandedRecordIds.size === report.invalidRecords.length ? 'Collapse All' : 'Expand All'}
                  </span>
                </button>
              </div>

              {/* Records List */}
              <div className="flex flex-col gap-3">
                {filteredRecords.map((record) => {
                  const isExpanded = expandedRecordIds.has(record.id);
                  const detailsId = `issue-details-${String(record.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                  return (
                    <div
                      key={record.id}
                      className="p-3.5 sm:p-4 rounded-lg bg-[var(--elevated)] border border-red-500/30 flex flex-col gap-3 min-w-0"
                    >
                      {/* Record Header & Disclosure Toggle */}
                      <button
                        type="button"
                        className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary rounded"
                        onClick={() => toggleExpand(record.id)}
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                              record.type === 'character'
                                ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/30'
                                : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {record.type === 'character' ? '👤 Character' : '🗡️ Weapon'}
                          </span>
                          <span className="font-bold text-sm sm:text-base text-[var(--color-text-main)] truncate">
                            {record.name}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] font-mono truncate hidden sm:inline">
                            ({record.id})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          {record.isAmbiguous ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              ⚠️ Review Required
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                              💡 Suggestion Available
                            </span>
                          )}

                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            {record.issues.length} {record.issues.length === 1 ? 'issue' : 'issues'}
                          </span>

                          <span className="text-xs text-[var(--color-text-muted)] ml-1" aria-hidden="true">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {/* Progression State Summary */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] border-t border-[var(--border)] pt-2">
                        <span className="truncate">
                          <strong className="text-[var(--color-text-main)]">Current:</strong> Level{' '}
                          {record.currentLevel != null ? record.currentLevel : '—'} / Ascension{' '}
                          {record.currentAscension != null ? record.currentAscension : '—'}
                        </span>
                        <span className="text-[var(--border)]">|</span>
                        <span className="truncate">
                          <strong className="text-[var(--color-text-main)]">Target:</strong> Level{' '}
                          {record.targetLevel != null ? record.targetLevel : '—'} / Ascension{' '}
                          {record.targetAscension != null ? record.targetAscension : '—'}
                        </span>
                        <span className="text-[var(--border)]">|</span>
                        <span className="font-mono text-[11px] text-[var(--color-text-muted)] break-all">
                          ID: {record.id}
                        </span>
                      </div>

                      {/* Collapsible Issue Details */}
                      {isExpanded && (
                        <div id={detailsId} className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border)]">
                          {record.issues.map((issue, issueIdx) => {
                            const isAmbiguous = issue.requiresHumanInput || !issue.isUnambiguous;
                            const allowedAscs = issue.validAllowedRanges?.allowedAscensions || [];
                            const levelRange = issue.validAllowedRanges?.levelRange;

                            return (
                              <div
                                key={issueIdx}
                                className="bg-[var(--background)] p-3 rounded-md border border-[var(--border)] flex flex-col gap-2 text-xs"
                              >
                                {/* Issue Header */}
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <span className="font-bold text-red-400 capitalize">
                                    Scope: {issue.scope} Progression
                                  </span>
                                  <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)]">
                                    {isAmbiguous ? 'Status: Ambiguous' : 'Status: Unambiguous'}
                                  </span>
                                </div>

                                {/* Violated Rule */}
                                <div className="text-[var(--color-text-main)] leading-relaxed">
                                  <strong className="text-red-300">Rule Violated:</strong> {issue.reason}
                                </div>

                                {/* Boundaries */}
                                <div className="text-[var(--color-text-muted)] leading-relaxed flex flex-col gap-0.5">
                                  <span>
                                    <strong>Allowed ascensions for Level {issue.level ?? record.currentLevel}:</strong>{' '}
                                    {allowedAscs.length > 0 ? `[${allowedAscs.join(', ')}]` : 'None'}
                                  </span>
                                  {levelRange && (
                                    <span>
                                      <strong>
                                        Valid level range for Ascension {issue.ascension ?? record.currentAscension}:
                                      </strong>{' '}
                                      {levelRange.min}–{levelRange.max}
                                    </span>
                                  )}
                                </div>

                                {/* Suggestion or Ambiguity Notice */}
                                {isAmbiguous ? (
                                  <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                                    <p className="font-semibold flex items-center gap-1">
                                      <span>⚠️</span>
                                      <span>Ambiguous Intent — User Review Required</span>
                                    </p>
                                    <p className="mt-1 text-amber-300/90">
                                      Multiple valid states exist or intent cannot be assumed. Both the level and the
                                      ascension must be manually reviewed before applying corrections.
                                    </p>
                                  </div>
                                ) : issue.suggestedCorrection ? (
                                  <div className="p-2.5 rounded bg-blue-950/20 border border-blue-500/30 text-blue-200 text-xs leading-relaxed">
                                    <p className="font-semibold flex items-center gap-1">
                                      <span>💡</span>
                                      <span>Diagnostic Suggestion (Not Applied)</span>
                                    </p>
                                    <p className="mt-1 text-blue-300/90">
                                      Suggested baseline:{' '}
                                      <strong>
                                        Level {issue.suggestedCorrection.level ?? issue.suggestedCorrection.targetLevel ?? issue.level} / Ascension{' '}
                                        {issue.suggestedCorrection.ascension ?? issue.suggestedCorrection.targetAscension}
                                      </strong>
                                    </p>
                                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)] font-normal">
                                      Note: This is an unapplied heuristic suggestion based on level. It is also
                                      possible that the ascension was intentional and the level was entered incorrectly.
                                      User review is required.
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommended Future Repair Flow Documentation */}
      <div className="mt-2 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center justify-between text-left cursor-pointer focus:outline-none"
          onClick={() => setShowRepairFlow((prev) => !prev)}
          aria-expanded={showRepairFlow}
          aria-controls="future-repair-workflow-info"
        >
          <span className="text-xs font-bold text-[var(--color-text-main)] flex items-center gap-1.5">
            <span>ℹ️</span> Future Repair Workflow (Phase C2B.2B.2)
          </span>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {showRepairFlow ? 'Hide details ▲' : 'Show details ▼'}
          </span>
        </button>

        {showRepairFlow && (
          <div
            id="future-repair-workflow-info"
            className="p-3.5 rounded-lg bg-[var(--elevated)] border border-[var(--border)] text-xs text-[var(--color-text-muted)] flex flex-col gap-2 leading-relaxed"
          >
            <p className="font-semibold text-[var(--color-text-main)]">
              Repairs are intentionally disabled in this phase.
            </p>
            <p>
              To ensure complete user safety and prevent data loss, the forthcoming repair implementation (Phase
              C2B.2B.2) will enforce this strict 9-step atomic workflow:
            </p>
            <ol className="list-decimal list-inside flex flex-col gap-1 text-[var(--color-text-main)] pl-1">
              <li><strong>Scan:</strong> Identify and catalog all progression contract violations.</li>
              <li><strong>Review:</strong> Display detailed issue cards with clear ambiguity classifications.</li>
              <li><strong>Export Backup:</strong> Require a complete local JSON backup before mutating state.</li>
              <li><strong>Select:</strong> Allow users to individually select records for repair.</li>
              <li><strong>Preview:</strong> Display exact before and after field values for each record.</li>
              <li><strong>Approve:</strong> Require explicit user confirmation of the selected resolutions.</li>
              <li><strong>Apply Atomically:</strong> Update store records in a single transactional batch.</li>
              <li><strong>Revalidate:</strong> Immediately re-scan state to ensure no new violations were introduced.</li>
              <li><strong>Report:</strong> Provide comprehensive outcome reporting with error handling.</li>
            </ol>
            <p className="text-[11px] text-[var(--color-text-muted)] italic mt-1">
              No automatic repairs, hydration migrations, or silent record modifications will ever be performed without
              explicit user authorization.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

