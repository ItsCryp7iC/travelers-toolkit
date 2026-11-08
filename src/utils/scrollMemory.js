/**
 * Traveler's Toolkit — Route Scroll Memory Utility
 *
 * Provides session-scoped in-memory storage and layout-aware scroll
 * restoration for client-side route navigation.
 */

import { getPlannerTabId } from './plannerTabs';
import { getInventoryTabId } from './inventoryFilters';

const sessionScrollStore = new Map();

/**
 * Normalizes a URL pathname and search query into a canonical route/view key.
 * For Planner and Inventory, incorporates canonical tab identifiers to provide
 * independent scroll memory per tab.
 * For top-level routes, strips trailing slashes and ignores irrelevant query params.
 *
 * @param {string} pathname
 * @param {string} [search]
 * @returns {string}
 */
export function getRouteKey(pathname, search = '') {
  if (!pathname || typeof pathname !== 'string' || pathname === '/') {
    return '/';
  }
  const trimmed = pathname.replace(/\/+$/, '');
  const base = trimmed || '/';

  if (base === '/planner') {
    const params = new URLSearchParams(search);
    const rawTab = params.get('tab');
    const canonicalTab = getPlannerTabId(rawTab);
    return `/planner?tab=${canonicalTab}`;
  }

  if (base === '/inventory') {
    const params = new URLSearchParams(search);
    const rawTab = params.get('tab');
    const canonicalTab = getInventoryTabId(rawTab);
    return `/inventory?tab=${canonicalTab}`;
  }

  return base;
}

/**
 * Returns the saved scroll position for a route key, or undefined if unvisited.
 *
 * @param {string} routeKey
 * @returns {{ x: number, y: number } | undefined}
 */
export function getSavedScrollPosition(routeKey) {
  return sessionScrollStore.get(routeKey);
}

/**
 * Saves a scroll position for a route key.
 *
 * @param {string} routeKey
 * @param {{ x: number, y: number }} position
 */
export function saveScrollPosition(routeKey, position) {
  if (!routeKey) return;
  const x = typeof position?.x === 'number' && !Number.isNaN(position.x) ? position.x : 0;
  const y = typeof position?.y === 'number' && !Number.isNaN(position.y) ? position.y : 0;
  sessionScrollStore.set(routeKey, { x: Math.max(0, x), y: Math.max(0, y) });
}

/**
 * Clears the session scroll memory. Used on resets or in test suites.
 */
export function clearScrollMemory() {
  sessionScrollStore.clear();
}

/**
 * Returns a shallow snapshot copy of current scroll memory map for testing.
 *
 * @returns {Record<string, { x: number, y: number }>}
 */
export function getScrollMemorySnapshot() {
  const snapshot = {};
  for (const [key, value] of sessionScrollStore.entries()) {
    snapshot[key] = { ...value };
  }
  return snapshot;
}

/**
 * Reads the current document scroll coordinates.
 *
 * @returns {{ x: number, y: number }}
 */
export function getCurrentScroll() {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  const doc = document.documentElement;
  const body = document.body;
  const y = window.scrollY ?? doc?.scrollTop ?? body?.scrollTop ?? 0;
  const x = window.scrollX ?? doc?.scrollLeft ?? body?.scrollLeft ?? 0;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

/**
 * Reads the maximum scrollable bounds of the document.
 *
 * @returns {{ maxX: number, maxY: number }}
 */
export function getMaxScroll() {
  if (typeof document === 'undefined') return { maxX: 0, maxY: 0 };
  const doc = document.documentElement;
  const body = document.body;
  const scrollHeight = Math.max(doc?.scrollHeight ?? 0, body?.scrollHeight ?? 0);
  const scrollWidth = Math.max(doc?.scrollWidth ?? 0, body?.scrollWidth ?? 0);
  const clientHeight = window.innerHeight || doc?.clientHeight || 0;
  const clientWidth = window.innerWidth || doc?.clientWidth || 0;
  return {
    maxX: Math.max(0, scrollWidth - clientWidth),
    maxY: Math.max(0, scrollHeight - clientHeight),
  };
}

/**
 * Performs an immediate (non-animated) scroll to the given coordinates.
 * Temporarily disables CSS scroll-behavior: smooth on the document element
 * to guarantee instant jumping without animation or visual jitter.
 *
 * @param {number} x
 * @param {number} y
 */
export function performInstantScroll(x, y) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const prevBehavior = root ? root.style.scrollBehavior : '';
  if (root) {
    root.style.scrollBehavior = 'auto';
  }

  try {
    if (typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: y, left: x, behavior: 'instant' });
      } catch {
        window.scrollTo(x, y);
      }
    }
  } catch {
    // Ignore environments where window.scrollTo is not implemented or throws
  }

  if (root) {
    root.scrollTop = y;
    root.scrollLeft = x;
  }
  if (document.body) {
    document.body.scrollTop = y;
    document.body.scrollLeft = x;
  }

  if (root) {
    root.style.scrollBehavior = prevBehavior;
  }
}

/**
 * Initiates a bounded, layout-aware restoration to (targetX, targetY).
 *
 * - If targetY === 0, immediately scrolls to (0, 0) and completes.
 * - If targetY > 0 and the document is already tall enough, immediately scrolls to target.
 * - If targetY > 0 and the document is not yet tall enough (e.g. data loading or lazy components),
 *   observes DOM resizing and RAF ticks until content expands enough to satisfy target.
 * - If content does not reach target within 500ms, clamps to final maximum scroll.
 * - If the user initiates manual interaction (wheel, touch, keydown), cancels restoration immediately.
 *
 * @param {Object} options
 * @param {number} options.targetX
 * @param {number} options.targetY
 * @param {() => void} [options.onComplete]
 * @returns {() => void} Abort/cleanup function
 */
export function startRestoration({ targetX, targetY, onComplete }) {
  let isDone = false;
  let observer = null;
  let timeoutId = null;
  let rafId = null;

  const finish = (finalY) => {
    if (isDone) return;
    isDone = true;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    removeUserInteractionListeners();
    if (typeof finalY === 'number') {
      performInstantScroll(targetX, finalY);
    }
    onComplete?.();
  };

  const attemptScroll = () => {
    if (isDone) return;
    const { maxY } = getMaxScroll();
    if (maxY >= targetY) {
      finish(targetY);
    } else {
      performInstantScroll(targetX, Math.min(targetY, maxY));
    }
  };

  const onUserInteraction = () => {
    // Intentional user scrolling or input cancels pending programmatic restoration
    finish();
  };

  const removeUserInteractionListeners = () => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('wheel', onUserInteraction);
    window.removeEventListener('touchstart', onUserInteraction);
    window.removeEventListener('pointerdown', onUserInteraction);
    window.removeEventListener('keydown', onUserInteraction);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('wheel', onUserInteraction, { passive: true });
    window.addEventListener('touchstart', onUserInteraction, { passive: true });
    window.addEventListener('pointerdown', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction, { passive: true });
  }

  // Immediate attempt on execution
  attemptScroll();

  if (isDone) {
    return () => {};
  }

  // Observe resize if available
  if (typeof ResizeObserver !== 'undefined' && typeof document !== 'undefined') {
    observer = new ResizeObserver(() => {
      attemptScroll();
    });
    if (document.body) {
      observer.observe(document.body);
    }
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      observer.observe(pageContent);
    }
  }

  // Tick for up to 10 animation frames
  let frameCount = 0;
  const checkFrame = () => {
    if (isDone) return;
    attemptScroll();
    if (!isDone && frameCount < 10) {
      frameCount++;
      rafId = requestAnimationFrame(checkFrame);
    }
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    rafId = requestAnimationFrame(checkFrame);
  }

  // Hard upper bound: 500ms
  if (typeof setTimeout !== 'undefined') {
    timeoutId = setTimeout(() => {
      if (!isDone) {
        const { maxY } = getMaxScroll();
        finish(Math.min(targetY, maxY));
      }
    }, 500);
  }

  return () => {
    finish();
  };
}

