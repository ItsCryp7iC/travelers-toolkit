import React, { useState, useMemo, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import {
  useActivityStore,
  attachStorageListener,
  createActivityExportPayload,
  validateActivityImportPayload,
  recordActivity,
} from '../activity';
import {
  CATEGORY_OPTIONS,
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
  PAGE_SIZE,
} from '../components/ActivityHistory/activityUiConstants';
import {
  isWithinDateRange,
  matchesSearchQuery,
  sortActivityEvents,
} from '../components/ActivityHistory/activityUiUtils';
import ActivityEventCard from '../components/ActivityHistory/ActivityEventCard';
import ActivityStorageDiagnostics from '../components/ActivityHistory/ActivityStorageDiagnostics';
import ActivityImportModal from '../components/ActivityHistory/ActivityImportModal';
import ActivityClearModal from '../components/ActivityHistory/ActivityClearModal';
import { notify } from '../utils/notify';

export default function ActivityHistory() {
  const events = useActivityStore((s) => s.events);
  const storageStatus = useActivityStore((s) => s.storageStatus);
  const setEventsFromImport = useActivityStore((s) => s.setEventsFromImport);
  const clearHistoryStore = useActivityStore((s) => s.clearHistory);

  const displayTimeZone = useStore((s) => s.displayTimeZone) || 'auto';

  // Filters & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Modals state
  const [pendingImport, setPendingImport] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fileInputRef = useRef(null);

  // Cross-tab storage synchronization listener
  useEffect(() => {
    attachStorageListener();
  }, []);

  // Reset pagination window when search or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory, selectedDateRange, selectedSort]);

  // Filtered and sorted events
  const processedEvents = useMemo(() => {
    let result = events;

    // 1. Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter((e) => e.category === selectedCategory);
    }

    // 2. Date Range Filter
    if (selectedDateRange !== 'all') {
      result = result.filter((e) =>
        isWithinDateRange(e.timestamp, selectedDateRange, displayTimeZone)
      );
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      result = result.filter((e) => matchesSearchQuery(e, searchQuery));
    }

    // 4. Stable Chronological Sorting
    return sortActivityEvents(result, selectedSort);
  }, [events, selectedCategory, selectedDateRange, searchQuery, selectedSort, displayTimeZone]);

  const visibleEvents = useMemo(() => {
    return processedEvents.slice(0, visibleCount);
  }, [processedEvents, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedDateRange('all');
    setSelectedSort('newest');
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Export History
  // ───────────────────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const payload = createActivityExportPayload(events);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `travelers-toolkit-activity-history-${dateStr}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.success(
        `Exported ${events.length} activity event(s) to ${filename}`
      );
    } catch (err) {
      console.error('[ActivityHistory] Export failed:', err);
      notify.error('Failed to export activity history.');
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Import History
  // ───────────────────────────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        notify.error('Invalid JSON file format.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const validation = validateActivityImportPayload(parsed);
      if (!validation.valid) {
        const errorMsg =
          validation.errors.join(' ') || 'Invalid Activity History file.';
        notify.error(errorMsg);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Compute duplicate count against existing events
      const existingIds = new Set(events.map((ev) => ev.id));
      let duplicateCount = 0;
      let newCount = 0;

      for (const validEv of validation.events) {
        if (existingIds.has(validEv.id)) {
          duplicateCount++;
        } else {
          newCount++;
        }
      }

      setPendingImport({
        fileName: file.name,
        declaredCount:
          typeof parsed.eventCount === 'number'
            ? parsed.eventCount
            : (parsed.events || []).length,
        validCount: validation.events.length,
        invalidCount: validation.skippedCount,
        duplicateCount,
        newCount,
        validEvents: validation.events,
      });
    } catch (err) {
      console.error('[ActivityHistory] Failed to read import file:', err);
      notify.error('Failed to read import file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport || !pendingImport.validEvents) return;

    setIsImporting(true);
    try {
      const result = setEventsFromImport(pendingImport.validEvents);

      if (!result.success) {
        notify.error('Failed to persist imported activity history to storage.');
        return;
      }

      // Record informational activity event
      try {
        recordActivity({
          category: 'import_sync',
          action: 'activity_history_imported',
          source: 'activity_history_import',
          entityType: 'backup',
          entityId: 'activity_history_import',
          summary: `Imported Activity History: ${result.imported} event(s) added (${result.deduplicatedCount || 0} deduplicated, ${result.invalidCount || 0} skipped).`,
          changes: [],
          metadata: {
            importedCount: result.imported,
            deduplicatedCount: result.deduplicatedCount || 0,
            invalidCount: result.invalidCount || 0,
            prunedCount: result.prunedCount || 0,
            fileName: pendingImport.fileName,
          },
        });
      } catch (logErr) {
        console.error(
          '[ActivityHistory] Failed to record import activity event:',
          logErr
        );
      }

      let msg = `Import complete: ${result.imported} new event(s) added.`;
      if (result.deduplicatedCount > 0) {
        msg += ` (${result.deduplicatedCount} duplicate(s) preserved)`;
      }
      if (result.prunedCount > 0) {
        msg += ` ${result.prunedCount} oldest event(s) pruned for storage retention.`;
      }
      notify.success(msg);
      setPendingImport(null);
    } catch (err) {
      console.error('[ActivityHistory] Import confirmation error:', err);
      notify.error('Failed to complete activity import.');
    } finally {
      setIsImporting(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Clear History
  // ───────────────────────────────────────────────────────────────────────────
  const handleConfirmClear = () => {
    setIsClearing(true);
    try {
      const success = clearHistoryStore();
      if (success) {
        notify.success('Activity History cleared.');
        setIsClearModalOpen(false);
      } else {
        notify.error('Failed to clear activity history from browser storage.');
      }
    } catch (err) {
      console.error('[ActivityHistory] Failed to clear history:', err);
      notify.error('An unexpected error occurred while clearing history.');
    } finally {
      setIsClearing(false);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedDateRange !== 'all' ||
    selectedSort !== 'newest';

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6 animate-fadeIn">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileSelect}
      />

      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl select-none" aria-hidden="true">
              ⏱️
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Activity History
            </h1>
          </div>
          <p className="text-sm sm:text-base text-slate-300 mt-1 max-w-2xl">
            Track changes to your inventory, characters, weapons, achievements,
            and saved data.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span aria-hidden="true">📥</span>
            <span>Import History</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={events.length === 0}
            className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <span aria-hidden="true">📤</span>
            <span>Export History</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearModalOpen(true)}
            disabled={events.length === 0}
            className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <span aria-hidden="true">🗑️</span>
            <span>Clear History</span>
          </button>
        </div>
      </header>

      {/* Storage Diagnostics */}
      <ActivityStorageDiagnostics
        status={storageStatus}
        timeZone={displayTimeZone}
      />

      {/* Search & Filters Sticky Toolbar */}
      <div className="bg-[#0b1329]/90 backdrop-blur-md border border-white/10 rounded-xl p-3.5 sm:p-4 space-y-3.5 sticky top-[var(--topbar-h,64px)] z-20 shadow-xl">
        {/* Row 1: Search & Date/Sort Selectors */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none"
              aria-hidden="true"
            >
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by summary, entity, action, or source..."
              aria-label="Search activities"
              className="w-full pl-9 pr-9 py-2 bg-black/40 border border-white/15 rounded-lg text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Range & Sort Dropdowns */}
          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="activity-date-range" className="text-slate-400 sr-only">
                Date Range
              </label>
              <select
                id="activity-date-range"
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="bg-black/40 border border-white/15 text-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#C8A96E] cursor-pointer"
              >
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="activity-sort-order" className="text-slate-400 sr-only">
                Sort Order
              </label>
              <select
                id="activity-sort-order"
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className="bg-black/40 border border-white/15 text-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#C8A96E] cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Category Filter Tabs */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
          <div
            role="tablist"
            aria-label="Filter activities by category"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin"
          >
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-[#C8A96E] text-black border-[#C8A96E] shadow-sm font-semibold'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Reset Filters button if active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-[#C8A96E] hover:underline whitespace-nowrap shrink-0 cursor-pointer px-1.5"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Activity Stream Section */}
      <section aria-labelledby="activity-stream-heading" className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <h2 id="activity-stream-heading" className="font-semibold text-slate-300">
            Recorded Activities
          </h2>
          <span aria-live="polite">
            Showing {visibleEvents.length} of {processedEvents.length} activities
            {events.length !== processedEvents.length && ` (${events.length} total)`}
          </span>
        </div>

        {/* Empty States */}
        {events.length === 0 ? (
          <div
            data-testid="activity-empty-state"
            className="text-center py-16 px-4 bg-[#0b1329]/60 border border-white/10 rounded-xl space-y-3"
          >
            <span className="text-4xl block select-none" aria-hidden="true">
              📜
            </span>
            <h3 className="text-lg font-semibold text-white">
              No activity recorded yet.
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Changes to your inventory, characters, weapons, achievements, and
              other saved data will appear here.
            </p>
          </div>
        ) : processedEvents.length === 0 ? (
          <div
            data-testid="activity-no-matches"
            className="text-center py-14 px-4 bg-[#0b1329]/60 border border-white/10 rounded-xl space-y-3"
          >
            <span className="text-3xl block select-none" aria-hidden="true">
              🔎
            </span>
            <h3 className="text-base font-semibold text-white">
              No matching activities.
            </h3>
            <p className="text-xs text-slate-400">
              Try adjusting your search terms, category, or date range filters.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-2 px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-[#C8A96E] hover:bg-[#d8b97e] transition-colors cursor-pointer shadow"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleEvents.map((evt) => (
              <ActivityEventCard
                key={evt.id}
                event={evt}
                timeZone={displayTimeZone}
              />
            ))}
          </div>
        )}

        {/* Load More Pagination */}
        {visibleCount < processedEvents.length && (
          <div className="text-center pt-4">
            <button
              type="button"
              onClick={handleLoadMore}
              className="px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 hover:border-[#C8A96E]/50 transition-colors cursor-pointer shadow-md"
            >
              Load More (50 more)
            </button>
          </div>
        )}
      </section>

      {/* Import Preview Modal */}
      {pendingImport && (
        <ActivityImportModal
          importData={pendingImport}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
          isImporting={isImporting}
        />
      )}

      {/* Clear History Confirmation Modal */}
      {isClearModalOpen && (
        <ActivityClearModal
          onConfirm={handleConfirmClear}
          onCancel={() => setIsClearModalOpen(false)}
          isClearing={isClearing}
        />
      )}
    </div>
  );
}

