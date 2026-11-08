import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getRouteKey,
  getSavedScrollPosition,
  saveScrollPosition,
  getCurrentScroll,
  performInstantScroll,
  startRestoration,
} from '../utils/scrollMemory';

// In React, useLayoutEffect generates an SSR warning if rendered in an environment without DOM.
// Client-side execution uses useLayoutEffect to coordinate before browser paint.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * ScrollManager — Route-Aware Central Scroll Restoration Component
 *
 * Placed within the router boundary (<BrowserRouter>), this component tracks
 * the user's scroll position per logical page route and restores it upon
 * navigation or browser back/forward history transitions.
 */
export default function ScrollManager() {
  const location = useLocation();
  const currentKey = getRouteKey(location.pathname, location.search);

  const currentKeyRef = useRef(currentKey);
  const isRestoringRef = useRef(false);
  const cancelRestorationRef = useRef(null);

  // Synchronously flag restoration during render if route has changed,
  // preventing layout clamping scroll events from polluting either page's memory.
  if (currentKey !== currentKeyRef.current) {
    isRestoringRef.current = true;
  }

  // Manage browser native history.scrollRestoration (manual mode)
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) {
      return;
    }

    const previousSetting = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      // Ignore if browser security blocks modification
    }

    return () => {
      try {
        if (previousSetting) {
          window.history.scrollRestoration = previousSetting;
        }
      } catch {
        // Ignore
      }
    };
  }, []);

  // Continuous passive scroll listener to track active page scroll coordinates
  useEffect(() => {
    const handleScroll = (event) => {
      // Ignore if restoration is active or body scroll is locked (e.g. modal or drawer open)
      if (isRestoringRef.current) return;
      if (typeof document !== 'undefined' && document.body?.style?.overflow === 'hidden') {
        return;
      }

      // Ignore internal scrolling inside nested elements (e.g. modals, flyouts, dropdowns)
      const target = event.target;
      if (
        target &&
        target.nodeType === 1 &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        return;
      }

      const { x, y } = getCurrentScroll();
      saveScrollPosition(currentKeyRef.current, { x, y });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Initial mount behavior: ensure first-time visit starts cleanly at (0, 0)
  useEffect(() => {
    const initialKey = currentKeyRef.current;
    if (getSavedScrollPosition(initialKey) === undefined) {
      saveScrollPosition(initialKey, { x: 0, y: 0 });
      performInstantScroll(0, 0);
    }
  }, []);

  // Route transition effect: handle outgoing save and incoming restoration
  useIsomorphicLayoutEffect(() => {
    const prevKey = currentKeyRef.current;
    const isNewRoute = prevKey !== currentKey;

    // In-page navigation (e.g. query parameter change within the same pathname)
    if (!isNewRoute) {
      return;
    }

    // Cancel any in-flight restoration from previous route
    if (cancelRestorationRef.current) {
      cancelRestorationRef.current();
      cancelRestorationRef.current = null;
    }

    // Finalize outgoing route position if not already restoring
    if (!isRestoringRef.current) {
      const { x, y } = getCurrentScroll();
      saveScrollPosition(prevKey, { x, y });
    }

    // Update active route key
    currentKeyRef.current = currentKey;
    isRestoringRef.current = true;

    // Lookup destination coordinates (0 if unvisited)
    const saved = getSavedScrollPosition(currentKey);
    const targetX = saved?.x ?? 0;
    const targetY = saved?.y ?? 0;

    // Seed unvisited routes
    if (!saved) {
      saveScrollPosition(currentKey, { x: 0, y: 0 });
    }

    // Execute bounded restoration
    cancelRestorationRef.current = startRestoration({
      targetX,
      targetY,
      onComplete: () => {
        isRestoringRef.current = false;
      },
    });

    return () => {
      if (cancelRestorationRef.current) {
        cancelRestorationRef.current();
        cancelRestorationRef.current = null;
      }
    };
  }, [currentKey]);

  return null;
}
