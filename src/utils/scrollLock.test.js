import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  acquireBodyScrollLock,
  resetBodyScrollLockForTesting
} from './scrollLock';

describe('scrollLock utility', () => {
  beforeEach(() => {
    resetBodyScrollLockForTesting();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    resetBodyScrollLockForTesting();
    document.body.style.overflow = '';
  });

  it('locks body scroll when acquired and restores previous overflow on release', () => {
    document.body.style.overflow = 'visible';
    const release = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe('hidden');

    release();
    expect(document.body.style.overflow).toBe('visible');
  });

  it('keeps body locked while any overlapping locks remain active', () => {
    document.body.style.overflow = 'auto';
    const release1 = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe('hidden');

    const release2 = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe('hidden');

    // First lock releases, but second lock is still active
    release1();
    expect(document.body.style.overflow).toBe('hidden');

    // Second lock releases; original overflow is restored
    release2();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('handles out-of-order releases without premature unlocking or permanent lock', () => {
    document.body.style.overflow = '';
    const release1 = acquireBodyScrollLock();
    const release2 = acquireBodyScrollLock();
    const release3 = acquireBodyScrollLock();

    // Release middle lock first
    release2();
    expect(document.body.style.overflow).toBe('hidden');

    // Release latest lock
    release3();
    expect(document.body.style.overflow).toBe('hidden');

    // Release initial lock
    release1();
    expect(document.body.style.overflow).toBe('');
  });

  it('release is idempotent and does not corrupt lock count on repeated calls', () => {
    document.body.style.overflow = 'visible';
    const release1 = acquireBodyScrollLock();
    const release2 = acquireBodyScrollLock();

    release1();
    release1(); // repeated call
    release1(); // repeated call
    expect(document.body.style.overflow).toBe('hidden');

    release2();
    expect(document.body.style.overflow).toBe('visible');

    release2(); // repeated call after 0
    expect(document.body.style.overflow).toBe('visible');
  });
});

