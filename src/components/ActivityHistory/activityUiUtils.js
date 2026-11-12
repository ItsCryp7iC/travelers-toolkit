/**
 * Traveler's Toolkit — Activity History UI Formatting & Filtering Utilities
 * Authoritative specification: docs/activity-history-architecture.md
 */

import { resolveDisplayTimeZone } from '../../utils/timeZoneUtils';
import {
  ACTION_LABELS,
  SOURCE_LABELS,
  CATEGORY_METADATA,
} from './activityUiConstants';

/**
 * Formats an ISO-8601 timestamp using the resolved user display timezone.
 */
export function formatActivityTimestamp(isoString, selectedZone = 'auto') {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const timeZone = resolveDisplayTimeZone(selectedZone);
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Returns a concise relative time string (e.g. "just now", "12m ago", "2h ago").
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Formats a single value from a FieldChange into readable text.
 * Never outputs "[object Object]".
 */
export function formatDiffValue(val) {
  if (val === null || val === undefined) {
    return '—';
  }
  if (typeof val === 'boolean') {
    return val ? 'Enabled' : 'Disabled';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val.toLocaleString('en-US') : String(val);
  }
  if (typeof val === 'string') {
    return val.trim() || '—';
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return val
      .map((item) =>
        typeof item === 'object' && item !== null
          ? JSON.stringify(item)
          : String(item)
      )
      .join(', ');
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 1);
    } catch {
      return '{ ... }';
    }
  }
  return String(val);
}

/**
 * Resolves a human-readable action label.
 */
export function getActionDisplayLabel(action) {
  if (!action) return 'Activity';
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // Fallback: title case from snake_case
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves a human-readable source label.
 */
export function getSourceDisplayLabel(source) {
  if (!source) return 'System';
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  return source
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves category display metadata (label, icon, badge color).
 */
export function getCategoryMetadata(category) {
  return (
    CATEGORY_METADATA[category] || {
      label: category || 'General',
      icon: '📝',
      badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    }
  );
}

/**
 * Checks whether an event timestamp falls within the requested date range.
 */
export function isWithinDateRange(isoString, range, selectedZone = 'auto') {
  if (range === 'all') return true;
  if (!isoString) return false;

  const eventTime = new Date(isoString).getTime();
  if (isNaN(eventTime)) return false;

  const now = new Date();
  const timeZone = resolveDisplayTimeZone(selectedZone);

  if (range === 'today') {
    try {
      const getDayStr = (d) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
      return getDayStr(new Date(eventTime)) === getDayStr(now);
    } catch {
      const oneDayMs = 24 * 60 * 60 * 1000;
      return now.getTime() - eventTime <= oneDayMs && eventTime <= now.getTime();
    }
  }

  if (range === '7days') {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return now.getTime() - eventTime <= sevenDaysMs && eventTime <= now.getTime();
  }

  if (range === '30days') {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return now.getTime() - eventTime <= thirtyDaysMs && eventTime <= now.getTime();
  }

  return true;
}

/**
 * Tests whether an event matches a free-text search query.
 */
export function matchesSearchQuery(event, query) {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  const summary = (event.summary || '').toLowerCase();
  if (summary.includes(q)) return true;

  const entityName = (event.entityName || '').toLowerCase();
  if (entityName.includes(q)) return true;

  const entityId = (event.entityId || '').toLowerCase();
  if (entityId.includes(q)) return true;

  const action = (event.action || '').toLowerCase();
  const actionLabel = getActionDisplayLabel(event.action).toLowerCase();
  if (action.includes(q) || actionLabel.includes(q)) return true;

  const source = (event.source || '').toLowerCase();
  const sourceLabel = getSourceDisplayLabel(event.source).toLowerCase();
  if (source.includes(q) || sourceLabel.includes(q)) return true;

  const category = (event.category || '').toLowerCase();
  if (category.includes(q)) return true;

  const txId = (event.transactionId || '').toLowerCase();
  if (txId.includes(q)) return true;

  return false;
}

/**
 * Sorts activity events stably without mutating the original collection.
 */
export function sortActivityEvents(events, sortOrder = 'newest') {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();

    // Safely treat invalid timestamps as 0
    const valA = isNaN(timeA) ? 0 : timeA;
    const valB = isNaN(timeB) ? 0 : timeB;

    if (valA !== valB) {
      return sortOrder === 'oldest' ? valA - valB : valB - valA;
    }
    // Stable tie-breaking by UUID
    return a.id.localeCompare(b.id);
  });
}

