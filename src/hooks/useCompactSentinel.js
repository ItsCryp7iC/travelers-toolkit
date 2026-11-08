import { useState, useEffect } from 'react';

/**
 * useCompactSentinel
 *
 * Observes a sentinel element at the bottom of the original search/filter panel.
 * When the sentinel scrolls past the global application topbar, the compact toolbar
 * becomes visible. When scrolling back into the original panel, it hides.
 *
 * @param {React.RefObject<HTMLElement | null>} sentinelRef
 * @returns {boolean} isVisible
 */
export function useCompactSentinel(sentinelRef) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef?.current;
    if (!sentinel || typeof window === 'undefined') return;

    const getTopbarHeight = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(
        '--topbar-h'
      );
      const parsed = parseInt(val, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 64;
    };

    // Fallback when IntersectionObserver is unavailable (e.g. standard JSDOM in tests)
    if (typeof window.IntersectionObserver === 'undefined') {
      const handleScroll = () => {
        if (!sentinelRef.current) return;
        const rect = sentinelRef.current.getBoundingClientRect();
        const topbarH = getTopbarHeight();
        setIsVisible(rect.bottom < topbarH);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true });
      handleScroll();

      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }

    const checkVisibility = () => {
      if (!sentinelRef.current) return;
      const rect = sentinelRef.current.getBoundingClientRect();
      const topbarH = getTopbarHeight();
      setIsVisible(rect.bottom < topbarH);
    };

    const topbarH = getTopbarHeight();
    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const currentTopbarH = getTopbarHeight();
        // Visible when sentinel has scrolled above the topbar
        const isAboveTopbar =
          !entry.isIntersecting &&
          entry.boundingClientRect.bottom < currentTopbarH;
        setIsVisible(isAboveTopbar);
      },
      {
        root: null,
        rootMargin: `-${topbarH}px 0px 0px 0px`,
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    // Initial check (handles restored scroll positions)
    checkVisibility();

    return () => {
      observer.disconnect();
    };
  }, [sentinelRef]);

  return isVisible;
}

export default useCompactSentinel;
