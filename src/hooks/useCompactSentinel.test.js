import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCompactSentinel } from './useCompactSentinel';

describe('useCompactSentinel Hook', () => {
  let sentinelEl = null;

  beforeEach(() => {
    sentinelEl = document.createElement('div');
    vi.spyOn(sentinelEl, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      top: 150,
      left: 0,
      right: 100,
      width: 100,
      height: 50,
    });
    document.body.appendChild(sentinelEl);
  });

  afterEach(() => {
    if (sentinelEl) sentinelEl.remove();
    sentinelEl = null;
    vi.restoreAllMocks();
  });

  it('1. returns false when sentinel is visible in viewport via IntersectionObserver', () => {
    let observerCallback = null;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    class MockIntersectionObserver {
      constructor(cb) {
        observerCallback = cb;
        this.observe = observeMock;
        this.disconnect = disconnectMock;
      }
    }
    window.IntersectionObserver = MockIntersectionObserver;

    const ref = { current: sentinelEl };
    const { result } = renderHook(() => useCompactSentinel(ref));

    expect(result.current).toBe(false);
    expect(observeMock).toHaveBeenCalledWith(sentinelEl);

    // Simulate intersecting (visible at top of page)
    act(() => {
      observerCallback([
        { isIntersecting: true, boundingClientRect: { bottom: 200 } },
      ]);
    });
    expect(result.current).toBe(false);

    // Simulate scrolled past topbar (bottom < 64)
    act(() => {
      observerCallback([
        { isIntersecting: false, boundingClientRect: { bottom: 20 } },
      ]);
    });
    expect(result.current).toBe(true);

    // Simulate scrolled back up into view
    act(() => {
      observerCallback([
        { isIntersecting: true, boundingClientRect: { bottom: 150 } },
      ]);
    });
    expect(result.current).toBe(false);
  });

  it('2. disconnects IntersectionObserver on unmount', () => {
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    class MockIntersectionObserver {
      constructor() {
        this.observe = observeMock;
        this.disconnect = disconnectMock;
      }
    }
    window.IntersectionObserver = MockIntersectionObserver;

    const ref = { current: sentinelEl };
    const { unmount } = renderHook(() => useCompactSentinel(ref));

    expect(observeMock).toHaveBeenCalled();
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('3. uses scroll/resize fallback when IntersectionObserver is unavailable', () => {
    const origIO = window.IntersectionObserver;
    delete window.IntersectionObserver;

    vi.spyOn(sentinelEl, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      top: 150,
    });

    const ref = { current: sentinelEl };
    const { result, unmount } = renderHook(() => useCompactSentinel(ref));

    // Initially below topbar -> false
    expect(result.current).toBe(false);

    // Scrolled past topbar -> true
    vi.spyOn(sentinelEl, 'getBoundingClientRect').mockReturnValue({
      bottom: 30,
      top: 10,
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);

    unmount();
    window.IntersectionObserver = origIO;
  });
});
