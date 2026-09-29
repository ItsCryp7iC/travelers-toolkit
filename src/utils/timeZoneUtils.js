/**
 * Fallback list of time zones for browsers that do not support Intl.supportedValuesOf('timeZone')
 */
const FALLBACK_TIMEZONES = [
  'UTC',
  'Pacific/Honolulu',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/**
 * Resolves 'auto' or an invalid timezone to a valid IANA string.
 */
export function resolveDisplayTimeZone(selectedZone) {
  let tz = selectedZone;
  if (!tz || tz === 'auto') {
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      tz = 'UTC';
    }
  }

  // Validate the timezone string
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch (e) {
    // If it's invalid (e.g. removed from IANA), fallback safely
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    } catch (fallbackError) {
      return 'UTC';
    }
  }
}

/**
 * Gets the current GMT offset string (e.g. GMT+06:00) for a given timezone.
 */
export function getTimeZoneOffsetLabel(zone, date = new Date()) {
  const resolvedZone = resolveDisplayTimeZone(zone);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedZone,
      timeZoneName: 'longOffset',
    });
    // Extract something like "GMT+06:00" from the parts
    const parts = formatter.formatToParts(date);
    const tzNamePart = parts.find(p => p.type === 'timeZoneName');
    return tzNamePart ? tzNamePart.value : 'GMT';
  } catch (e) {
    return 'GMT';
  }
}

/**
 * Formats a timezone into a displayable label: "GMT+06:00 — Dhaka"
 */
export function getTimeZoneDisplayLabel(zone) {
  const resolvedZone = resolveDisplayTimeZone(zone);
  const offsetLabel = getTimeZoneOffsetLabel(resolvedZone);
  const city = resolvedZone.split('/').pop().replace(/_/g, ' ');
  return `${offsetLabel} — ${city}`;
}

/**
 * Builds a list of available time zone options with their display labels.
 */
export function buildTimeZoneOptions() {
  let zones;
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch (e) {
    zones = FALLBACK_TIMEZONES;
  }

  return zones.map(zone => {
    return {
      value: zone,
      label: getTimeZoneDisplayLabel(zone),
      // we'll compute offset value for sorting purposes, though somewhat heavy
      offsetMinutes: getOffsetMinutes(zone)
    };
  }).sort((a, b) => {
    if (a.offsetMinutes === b.offsetMinutes) {
      return a.label.localeCompare(b.label);
    }
    return a.offsetMinutes - b.offsetMinutes;
  });
}

function getOffsetMinutes(zone) {
  try {
    const resolvedZone = resolveDisplayTimeZone(zone);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedZone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(new Date());
    const tzNamePart = parts.find(p => p.type === 'timeZoneName')?.value;
    if (!tzNamePart) return 0;

    // Parse GMT+06:00 or GMT-04:00
    const match = tzNamePart.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;

    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const mins = parseInt(match[3], 10);
    return sign * (hours * 60 + mins);
  } catch (e) {
    return 0;
  }
}

/**
 * Formats a duration in seconds to "Xh Ym" or "Xm Ys"
 */
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds) || typeof seconds !== 'number') return '—';
  if (seconds < 0) return '00m 00s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Formats an epoch timestamp to a relative readable local time string (e.g. "4:59 AM", "4:59 AM tomorrow", "Oct 2, 2026, 4:59 AM").
 */
export function formatRelativeFillTime(timestampMs, selectedZone) {
  if (timestampMs == null || Number.isNaN(timestampMs) || typeof timestampMs !== 'number') return '—';
  const resolvedZone = resolveDisplayTimeZone(selectedZone);
  const targetDate = new Date(timestampMs);
  const now = new Date();

  // Compare calendar dates in the selected timezone
  const getLocalDateParts = (d) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedZone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    return parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  };

  const nowParts = getLocalDateParts(now);
  const targetParts = getLocalDateParts(targetDate);

  const localNowStr = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  const localTargetStr = `${targetParts.year}-${targetParts.month}-${targetParts.day}`;

  const targetTime = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(targetDate);

  if (localNowStr === localTargetStr) {
    return targetTime;
  }

  // Calculate "tomorrow" by advancing the calendar day mathematically
  const tomorrowUTC = new Date(Date.UTC(
    parseInt(nowParts.year, 10),
    parseInt(nowParts.month, 10) - 1,
    parseInt(nowParts.day, 10) + 1
  ));
  const localTomorrowStr = tomorrowUTC.toISOString().split('T')[0];

  if (localTargetStr === localTomorrowStr) {
    return `${targetTime} tomorrow`;
  }

  // Fallback for farther dates
  const targetMonthDayYear = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(targetDate);

  return `${targetMonthDayYear}, ${targetTime}`;
}
