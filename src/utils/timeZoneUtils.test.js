import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveDisplayTimeZone,
  getTimeZoneOffsetLabel,
  getTimeZoneDisplayLabel,
  formatDuration,
  formatRelativeFillTime
} from './timeZoneUtils';

describe('timeZoneUtils', () => {
  describe('resolveDisplayTimeZone', () => {
    test('resolves auto to a valid IANA string', () => {
      const tz = resolveDisplayTimeZone('auto');
      expect(typeof tz).toBe('string');
      expect(tz).not.toBe('auto');
    });

    test('resolves explicit valid string', () => {
      expect(resolveDisplayTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
    });

    test('falls back safely for invalid string', () => {
      const tz = resolveDisplayTimeZone('Invalid/Zone');
      expect(tz).not.toBe('Invalid/Zone');
    });
  });

  describe('formatDuration', () => {
    test('0 seconds', () => {
      expect(formatDuration(0)).toBe('00m 00s');
    });
    test('59 seconds', () => {
      expect(formatDuration(59)).toBe('00m 59s');
    });
    test('60 seconds', () => {
      expect(formatDuration(60)).toBe('01m 00s');
    });
    test('3661 seconds', () => {
      expect(formatDuration(3661)).toBe('1h 01m');
    });
  });

  describe('getTimeZoneOffsetLabel and getTimeZoneDisplayLabel', () => {
    test('formats label for Dhaka', () => {
      const date = new Date('2026-09-30T12:00:00Z');
      expect(getTimeZoneOffsetLabel('Asia/Dhaka', date)).toBe('GMT+06:00');
      expect(getTimeZoneDisplayLabel('Asia/Dhaka')).toMatch(/GMT\+06:00 — Dhaka/);
    });

    test('DST sensitive zone - America/New_York', () => {
      const summerDate = new Date('2026-07-01T12:00:00Z');
      expect(getTimeZoneOffsetLabel('America/New_York', summerDate)).toBe('GMT-04:00');

      const winterDate = new Date('2026-01-01T12:00:00Z');
      expect(getTimeZoneOffsetLabel('America/New_York', winterDate)).toBe('GMT-05:00');
    });
  });

  describe('formatRelativeFillTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set system time to Sep 30, 2026, 8:00 PM UTC
      vi.setSystemTime(new Date('2026-09-30T20:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('same day relative to selected timezone', () => {
      // Target: Sep 30, 2026, 9:00 PM UTC
      const timestamp = new Date('2026-09-30T21:00:00Z').getTime();

      // In America/New_York (UTC-4):
      // Now: Sep 30, 4:00 PM
      // Target: Sep 30, 5:00 PM
      // Result: "5:00 PM"
      expect(formatRelativeFillTime(timestamp, 'America/New_York')).toBe('5:00 PM');
    });

    test('tomorrow relative to selected timezone', () => {
      // Target: Oct 1, 1:00 PM UTC -> NY Oct 1, 9:00 AM
      const timestampNYTomorrow = new Date('2026-10-01T13:00:00Z').getTime();
      expect(formatRelativeFillTime(timestampNYTomorrow, 'America/New_York')).toBe('9:00 AM tomorrow');
    });

    test('different calendar date logic due to timezones (tomorrow vs same day)', () => {
      // Target: Sep 30, 2026, 23:00:00Z
      const timestamp = new Date('2026-09-30T23:00:00Z').getTime();

      // Now is Sep 30, 2026, 20:00:00Z

      // In NY (UTC-4):
      // Now: Sep 30, 4:00 PM
      // Target: Sep 30, 7:00 PM
      // Same day => "7:00 PM"
      expect(formatRelativeFillTime(timestamp, 'America/New_York')).toBe('7:00 PM');

      // In Tokyo (UTC+9):
      // Now: Oct 1, 5:00 AM
      // Target: Oct 1, 8:00 AM
      // Same day => "8:00 AM"
      expect(formatRelativeFillTime(timestamp, 'Asia/Tokyo')).toBe('8:00 AM');

      // In London (BST -> UTC+1):
      // Now: Sep 30, 9:00 PM
      // Target: Oct 1, 12:00 AM (midnight)
      // Tomorrow => "12:00 AM tomorrow"
      expect(formatRelativeFillTime(timestamp, 'Europe/London')).toBe('12:00 AM tomorrow');
    });

    test('later date', () => {
      // Target: Oct 3, 2026, 20:00:00Z
      const timestamp = new Date('2026-10-03T20:00:00Z').getTime();

      // NY: Oct 3, 4:00 PM
      expect(formatRelativeFillTime(timestamp, 'America/New_York')).toBe('Oct 3, 2026, 4:00 PM');
    });
  });
});
