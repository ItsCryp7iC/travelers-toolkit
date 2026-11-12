import { describe, it, expect } from 'vitest';
import {
  getSerializedByteSize,
  isValidUUID,
  isValidISOTimestamp,
  isSensitiveKey,
  sanitizeMetadata,
  validateFieldChange,
  validateActivityEvent,
  truncateEventPayload,
  compareEventsChronologically,
} from './activityValidation';
import { ActivityEvent, TARGET_MAX_EVENT_BYTES } from './activityTypes';

describe('Activity History — Validation & Normalization Engine', () => {
  it('accurately calculates UTF-8 byte consumption including multi-byte characters and emoji', () => {
    expect(getSerializedByteSize('')).toBe(0);
    expect(getSerializedByteSize('abc')).toBe(3);
    expect(getSerializedByteSize({})).toBe(2); // '{}'
    expect(getSerializedByteSize({ key: 'val' })).toBe(13); // '{"key":"val"}'

    // 'Slime' ASCII vs multi-byte characters & emojis
    const asciiStr = 'Slime Condensate';
    const nonAsciiStr = '史莱姆原浆 🌟';
    expect(getSerializedByteSize(asciiStr)).toBe(asciiStr.length);
    // UTF-8 bytes for Chinese chars (3 bytes each) + space (1 byte) + emoji (4 bytes)
    const utf8Bytes = new TextEncoder().encode(nonAsciiStr).length;
    expect(getSerializedByteSize(nonAsciiStr)).toBe(utf8Bytes);
  });

  it('validates UUID v4 identifiers enforcing version 4 and RFC variant bits', () => {
    // Valid UUID v4 identifiers (variant bits 8, 9, a, b, case-insensitive)
    expect(isValidUUID('c9bf9e57-1685-4c89-bafb-ff5af830be8a')).toBe(true);
    expect(isValidUUID('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isValidUUID('ffffffff-ffff-4fff-9fff-ffffffffffff')).toBe(true);
    expect(isValidUUID('12345678-1234-4234-a234-123456789abc')).toBe(true);
    expect(isValidUUID('12345678-1234-4234-B234-123456789ABC')).toBe(true);

    // Rejects UUIDs with invalid versions (not version 4)
    expect(isValidUUID('c9bf9e57-1685-1c89-bafb-ff5af830be8a')).toBe(false); // v1
    expect(isValidUUID('c9bf9e57-1685-2c89-bafb-ff5af830be8a')).toBe(false); // v2
    expect(isValidUUID('c9bf9e57-1685-3c89-bafb-ff5af830be8a')).toBe(false); // v3
    expect(isValidUUID('c9bf9e57-1685-5c89-bafb-ff5af830be8a')).toBe(false); // v5

    // Rejects UUIDs with invalid RFC 4122 variants (variant must start with 8, 9, a, or b)
    expect(isValidUUID('c9bf9e57-1685-4c89-0afb-ff5af830be8a')).toBe(false); // variant 0
    expect(isValidUUID('c9bf9e57-1685-4c89-7afb-ff5af830be8a')).toBe(false); // variant 7
    expect(isValidUUID('c9bf9e57-1685-4c89-cafb-ff5af830be8a')).toBe(false); // variant c
    expect(isValidUUID('c9bf9e57-1685-4c89-fafb-ff5af830be8a')).toBe(false); // variant f

    // Rejects malformed and invalid types
    expect(isValidUUID('invalid-uuid')).toBe(false);
    expect(isValidUUID('c9bf9e57-1685-4c89-bafb-ff5af830be8')).toBe(false); // too short
    expect(isValidUUID('c9bf9e57-1685-4c89-bafb-ff5af830be8aa')).toBe(false); // too long
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(12345)).toBe(false);
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
  });

  it('validates ISO-8601 UTC timestamps', () => {
    expect(isValidISOTimestamp('2026-11-12T12:00:00.000Z')).toBe(true);
    expect(isValidISOTimestamp('2026-11-12T12:00:00Z')).toBe(true);
    expect(isValidISOTimestamp('2026-11-12')).toBe(false);
    expect(isValidISOTimestamp('not-a-date')).toBe(false);
    expect(isValidISOTimestamp(Date.now())).toBe(false);
  });

  it('detects sensitive credential keys in metadata', () => {
    expect(isSensitiveKey('ltoken')).toBe(true);
    expect(isSensitiveKey('ltuid')).toBe(true);
    expect(isSensitiveKey('googleAccessToken')).toBe(true);
    expect(isSensitiveKey('authorization')).toBe(true);
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('secretKey')).toBe(true);
    expect(isSensitiveKey('cookie')).toBe(true);
    expect(isSensitiveKey('materialKey')).toBe(false);
    expect(isSensitiveKey('characterName')).toBe(false);
  });

  it('sanitizes metadata recursively by removing sensitive keys and unsupported types', () => {
    const raw = {
      materialKey: 'SlimeCondensate',
      amount: 10,
      ltoken: 'secret_token_123',
      authCookie: 'cookie_val',
      nested: {
        safeField: 'ok',
        password: 'pass',
      },
      func: () => {},
      undef: undefined,
    };

    const sanitized = sanitizeMetadata(raw);
    expect(sanitized).toBeDefined();
    expect(sanitized?.materialKey).toBe('SlimeCondensate');
    expect(sanitized?.amount).toBe(10);
    expect(sanitized?.ltoken).toBeUndefined();
    expect(sanitized?.authCookie).toBeUndefined();
    expect((sanitized?.nested as Record<string, unknown>)?.safeField).toBe(
      'ok'
    );
    expect(
      (sanitized?.nested as Record<string, unknown>)?.password
    ).toBeUndefined();
    expect(sanitized?.func).toBeUndefined();
  });

  it('validates structured field changes and preserves numeric zero', () => {
    // Valid field change with numeric zero
    const changeWithZero = validateFieldChange({
      field: 'quantity',
      before: 10,
      after: 0,
      delta: -10,
    });
    expect(changeWithZero).toEqual({
      field: 'quantity',
      before: 10,
      after: 0,
      delta: -10,
    });

    // Suppresses no-op field changes where before === after
    const noOpChange = validateFieldChange({
      field: 'level',
      before: 90,
      after: 90,
    });
    expect(noOpChange).toBeNull();

    // Rejects missing or empty field name
    expect(validateFieldChange({ field: '', before: 1, after: 2 })).toBeNull();
    expect(validateFieldChange(null)).toBeNull();
  });

  it('validates a well-formed ActivityEvent', () => {
    const validEvent: ActivityEvent = {
      id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
      schemaVersion: 1,
      timestamp: '2026-11-12T12:00:00.000Z',
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      entityType: 'material',
      entityId: 'SlimeCondensate',
      entityName: 'Slime Condensate',
      summary: 'Slime Condensate changed from 120 to 1,209.',
      changes: [
        { field: 'quantity', before: 120, after: 1209, delta: '+1089' },
      ],
      metadata: { matKey: 'SlimeCondensate' },
    };

    const result = validateActivityEvent(validEvent);
    expect(result.isValid).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event?.summary).toBe(validEvent.summary);
  });

  it('rejects an event with missing mandatory fields', () => {
    expect(validateActivityEvent(null).isValid).toBe(false);
    expect(validateActivityEvent({}).isValid).toBe(false);

    // Missing UUID
    expect(
      validateActivityEvent({
        id: 'not-a-uuid',
        schemaVersion: 1,
        timestamp: '2026-11-12T12:00:00.000Z',
        category: 'inventory',
        action: 'inventory_updated',
        source: 'inventory_page',
        summary: 'test',
      }).isValid
    ).toBe(false);

    // Unsupported schema version
    expect(
      validateActivityEvent({
        id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
        schemaVersion: 2,
        timestamp: '2026-11-12T12:00:00.000Z',
        category: 'inventory',
        action: 'inventory_updated',
        source: 'inventory_page',
        summary: 'test',
      }).isValid
    ).toBe(false);

    // Invalid category
    expect(
      validateActivityEvent({
        id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
        schemaVersion: 1,
        timestamp: '2026-11-12T12:00:00.000Z',
        category: 'invalid_category',
        action: 'inventory_updated',
        source: 'inventory_page',
        summary: 'test',
      }).isValid
    ).toBe(false);

    // Empty summary
    expect(
      validateActivityEvent({
        id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
        schemaVersion: 1,
        timestamp: '2026-11-12T12:00:00.000Z',
        category: 'inventory',
        action: 'inventory_updated',
        source: 'inventory_page',
        summary: '   ',
      }).isValid
    ).toBe(false);
  });

  it('truncates oversized event payloads while strictly preserving mandatory envelope', () => {
    // Construct an event with 150 field changes exceeding 4 KiB
    const largeChanges = Array.from({ length: 150 }, (_, i) => ({
      field: `field_${i}`,
      before: `previous_value_long_string_description_${i}`,
      after: `updated_value_long_string_description_${i}`,
      delta: `+${i}`,
    }));

    const bigEvent: ActivityEvent = {
      id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
      schemaVersion: 1,
      timestamp: '2026-11-12T12:00:00.000Z',
      category: 'import_sync',
      action: 'good_import_applied',
      source: 'settings_good_import',
      summary: 'GOOD import: 150 materials updated.',
      changes: largeChanges,
      metadata: { importSource: 'Inventory Kamera' },
    };

    expect(getSerializedByteSize(bigEvent)).toBeGreaterThan(
      TARGET_MAX_EVENT_BYTES
    );

    const truncated = truncateEventPayload(bigEvent);
    expect(getSerializedByteSize(truncated)).toBeLessThanOrEqual(
      TARGET_MAX_EVENT_BYTES
    );
    expect(truncated.truncated).toBe(true);

    // Assert mandatory fields are strictly preserved!
    expect(truncated.id).toBe(bigEvent.id);
    expect(truncated.schemaVersion).toBe(bigEvent.schemaVersion);
    expect(truncated.timestamp).toBe(bigEvent.timestamp);
    expect(truncated.category).toBe(bigEvent.category);
    expect(truncated.action).toBe(bigEvent.action);
    expect(truncated.source).toBe(bigEvent.source);
    expect(truncated.summary).toBe(bigEvent.summary);

    // Assert total count metadata was added
    expect(truncated.metadata?.totalChangesCount).toBe(150);
  });

  it('sorts events deterministically by timestamp ascending with id tie-breaking', () => {
    const e1: ActivityEvent = {
      id: 'b-uuid',
      schemaVersion: 1,
      timestamp: '2026-11-12T10:00:00.000Z',
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      summary: 'First',
    };
    const e2: ActivityEvent = {
      id: 'a-uuid',
      schemaVersion: 1,
      timestamp: '2026-11-12T10:00:00.000Z', // identical timestamp
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      summary: 'Second',
    };
    const e3: ActivityEvent = {
      id: 'c-uuid',
      schemaVersion: 1,
      timestamp: '2026-11-12T11:00:00.000Z',
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      summary: 'Third',
    };

    const sorted = [e3, e1, e2].sort(compareEventsChronologically);
    // e1 and e2 have same timestamp, so 'a-uuid' comes before 'b-uuid'
    expect(sorted[0].id).toBe('a-uuid');
    expect(sorted[1].id).toBe('b-uuid');
    expect(sorted[2].id).toBe('c-uuid');
  });
});
