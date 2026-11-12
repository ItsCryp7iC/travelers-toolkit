import React, { useState } from 'react';
import {
  formatActivityTimestamp,
  formatRelativeTime,
  formatDiffValue,
  getActionDisplayLabel,
  getSourceDisplayLabel,
  getCategoryMetadata,
} from './activityUiUtils';

export default function ActivityEventCard({ event, timeZone = 'auto' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryMeta = getCategoryMetadata(event.category);
  const actionLabel = getActionDisplayLabel(event.action);
  const sourceLabel = getSourceDisplayLabel(event.source);
  const formattedTime = formatActivityTimestamp(event.timestamp, timeZone);
  const relativeTime = formatRelativeTime(event.timestamp);
  const isUncertainCraft = event.action === 'crafting_transaction_uncertain';

  const detailsId = `activity-detail-${event.id}`;

  return (
    <article
      data-testid="activity-event-card"
      data-event-id={event.id}
      data-category={event.category}
      data-action={event.action}
      className={`rounded-lg border transition-all duration-150 overflow-hidden ${
        isExpanded
          ? 'bg-[#0f172a]/95 border-[#C8A96E]/50 shadow-lg shadow-black/40'
          : 'bg-[#0b1329]/80 border-white/10 hover:border-white/20 hover:bg-[#0f172a]/80'
      }`}
    >
      {/* Clickable Header Button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        className="w-full text-left p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Category Icon */}
          <span
            className="text-xl sm:text-2xl shrink-0 p-1 rounded-md bg-white/5 border border-white/5 flex items-center justify-center select-none"
            aria-hidden="true"
          >
            {categoryMeta.icon}
          </span>

          {/* Event Summary & Title */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              {/* Category Badge */}
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${categoryMeta.badgeClass}`}
              >
                {categoryMeta.label}
              </span>

              {/* Action Title */}
              <span className="text-xs sm:text-sm font-semibold text-white/90">
                {actionLabel}
              </span>

              {/* Uncertain Craft Warning Badge */}
              {isUncertainCraft && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⚠️ Outcome Uncertain
                </span>
              )}
            </div>

            {/* Human Summary */}
            <p className="text-sm text-slate-200 font-normal leading-relaxed break-words">
              {event.summary}
            </p>

            {/* Entity Name / ID Tag if present */}
            {event.entityName && (
              <p className="text-xs text-[var(--color-text-muted,#94a3b8)] mt-0.5 font-medium">
                Target:{' '}
                <span className="text-white/80">{event.entityName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Time, Source & Caret */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
          <div className="flex sm:flex-col items-baseline sm:items-end gap-1.5 sm:gap-0.5">
            <time
              dateTime={event.timestamp}
              title={formattedTime}
              className="text-xs font-medium text-slate-300"
            >
              {formattedTime}
            </time>
            {relativeTime && (
              <span className="text-[11px] text-slate-400">
                ({relativeTime})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 font-mono">
              {sourceLabel}
            </span>

            {/* Caret icon */}
            <span
              className={`text-slate-400 text-xs transition-transform duration-200 select-none ${
                isExpanded ? 'rotate-180 text-[#C8A96E]' : ''
              }`}
              aria-hidden="true"
            >
              ▼
            </span>
          </div>
        </div>
      </button>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div
          id={detailsId}
          data-testid="activity-event-details"
          className="border-t border-white/10 bg-[#060c1d]/90 p-4 sm:p-5 space-y-4 text-xs sm:text-sm animate-fadeIn"
        >
          {/* Diagnostic warning for uncertain crafting */}
          {isUncertainCraft && (
            <div
              role="alert"
              className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed"
            >
              <strong className="font-semibold block mb-0.5">
                Uncertain Crafting Transaction:
              </strong>
              The outcome of this crafting batch could not be conclusively
              confirmed by the system. Please verify your current inventory
              quantities in game.
            </div>
          )}

          {/* Truncation notice */}
          {event.truncated && (
            <div className="p-2.5 rounded-md bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 text-xs">
              Some details were omitted to stay within Activity History storage
              limits.
            </div>
          )}

          {/* Standard Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white/[0.03] p-3 rounded-md border border-white/5">
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Category
              </span>
              <span className="font-medium text-slate-200">
                {categoryMeta.label}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Action
              </span>
              <span className="font-medium text-slate-200">{actionLabel}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Source
              </span>
              <span className="font-medium text-slate-200">{sourceLabel}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Timestamp
              </span>
              <span className="font-mono text-[11px] text-slate-300">
                {event.timestamp}
              </span>
            </div>
            {event.entityType && (
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Entity Type
                </span>
                <span className="font-medium text-slate-200 capitalize">
                  {event.entityType.replace('_', ' ')}
                </span>
              </div>
            )}
            {event.entityId && (
              <div className="col-span-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Entity ID
                </span>
                <span className="font-mono text-xs text-slate-300 break-all">
                  {event.entityId}
                </span>
              </div>
            )}
            {event.transactionId && (
              <div className="col-span-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Transaction ID
                </span>
                <span className="font-mono text-xs text-[#C8A96E] break-all">
                  {event.transactionId}
                </span>
              </div>
            )}
          </div>

          {/* Field Changes Table */}
          {Array.isArray(event.changes) && event.changes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Field-Level Differences</span>
                <span className="text-[11px] text-slate-400 lowercase font-normal">
                  {event.changes.length} change(s)
                </span>
              </h4>
              <div className="overflow-x-auto rounded border border-white/10">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-slate-300 font-semibold">
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Before</th>
                      <th className="py-2 px-3">After</th>
                      <th className="py-2 px-3">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {event.changes.map((change, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-medium text-slate-200">
                          {change.label || change.field}
                        </td>
                        <td className="py-2 px-3 text-slate-400 font-mono break-all">
                          {formatDiffValue(change.before)}
                        </td>
                        <td className="py-2 px-3 text-slate-100 font-mono font-medium break-all">
                          {formatDiffValue(change.after)}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {change.delta !== undefined ? (
                            <span
                              className={
                                String(change.delta).startsWith('+')
                                  ? 'text-emerald-400'
                                  : String(change.delta).startsWith('-')
                                  ? 'text-rose-400'
                                  : 'text-slate-300'
                              }
                            >
                              {String(change.delta)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Structured Domain Metadata Display */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Operation Metadata
              </h4>
              <div className="bg-black/30 p-3 rounded border border-white/5 space-y-1.5 font-mono text-xs">
                {Object.entries(event.metadata).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-white/[0.03] last:border-0"
                  >
                    <span className="text-slate-400 shrink-0 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                    </span>
                    <span className="text-slate-200 break-all text-right font-medium">
                      {formatDiffValue(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
