import React, { useState } from 'react';
import {
  MAX_ACTIVITY_EVENT_COUNT,
  MAX_ACTIVITY_SERIALIZED_BYTES,
} from '../../activity/activityTypes';
import { formatActivityTimestamp } from './activityUiUtils';

export default function ActivityStorageDiagnostics({
  status,
  timeZone = 'auto',
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const eventCount = status?.eventCount ?? 0;
  const serializedBytes = status?.serializedBytes ?? 0;
  const persistenceErrorCount = status?.persistenceErrorCount ?? 0;
  const lastPruneTimestamp = status?.lastPruneTimestamp;

  const countPercentage = Math.min(
    100,
    Math.round((eventCount / MAX_ACTIVITY_EVENT_COUNT) * 100)
  );
  const bytesPercentage = Math.min(
    100,
    Math.round((serializedBytes / MAX_ACTIVITY_SERIALIZED_BYTES) * 100)
  );

  const formattedBytes = (serializedBytes / 1024).toFixed(1);
  const maxBytesKb = (MAX_ACTIVITY_SERIALIZED_BYTES / 1024).toFixed(0);

  return (
    <section
      data-testid="activity-storage-diagnostics"
      className="bg-[#0b1329]/80 border border-white/10 rounded-xl p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span>💾</span> Local Activity Storage Budget
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Activity History is stored locally in this browser and is not
            included in regular Google Drive backups.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTechnicalDetails((p) => !p)}
          className="text-xs text-slate-400 hover:text-white underline underline-offset-4 self-start sm:self-auto cursor-pointer"
        >
          {showTechnicalDetails ? 'Hide Diagnostics' : 'View Diagnostics'}
        </button>
      </div>

      {/* Usage Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Event Count Budget */}
        <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Retained Events</span>
            <span className="font-mono text-slate-200">
              <strong className="text-white">{eventCount}</strong> /{' '}
              {MAX_ACTIVITY_EVENT_COUNT} ({countPercentage}%)
            </span>
          </div>
          <div
            className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"
            role="progressbar"
            aria-valuenow={countPercentage}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Retained events capacity"
          >
            <div
              className={`h-full transition-all duration-300 ${
                countPercentage > 90
                  ? 'bg-rose-500'
                  : countPercentage > 75
                  ? 'bg-amber-400'
                  : 'bg-[#C8A96E]'
              }`}
              style={{ width: `${countPercentage}%` }}
            />
          </div>
        </div>

        {/* Serialized Byte Budget */}
        <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Storage Volume</span>
            <span className="font-mono text-slate-200">
              <strong className="text-white">{formattedBytes} KiB</strong> /{' '}
              {maxBytesKb} KiB ({bytesPercentage}%)
            </span>
          </div>
          <div
            className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"
            role="progressbar"
            aria-valuenow={bytesPercentage}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Storage volume capacity"
          >
            <div
              className={`h-full transition-all duration-300 ${
                bytesPercentage > 90
                  ? 'bg-rose-500'
                  : bytesPercentage > 75
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${bytesPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Technical Details */}
      {showTechnicalDetails && (
        <div className="pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400 font-mono animate-fadeIn">
          <div>
            <span className="block text-[11px] text-slate-300 uppercase">
              Last Prune
            </span>
            <span className="text-slate-200">
              {lastPruneTimestamp
                ? formatActivityTimestamp(lastPruneTimestamp, timeZone)
                : 'Never'}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-300 uppercase">
              Persistence Errors
            </span>
            <span
              className={
                persistenceErrorCount > 0 ? 'text-rose-400' : 'text-slate-200'
              }
            >
              {persistenceErrorCount}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-300 uppercase">
              Schema Version
            </span>
            <span className="text-slate-200">
              {status?.schemaVersion ?? 1}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-300 uppercase">
              Storage Key
            </span>
            <span className="text-slate-200 break-all text-[10px]">
              travelers-toolkit-activity-log
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

