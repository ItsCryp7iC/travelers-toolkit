import React, { useRef, useEffect, useState, useCallback } from 'react';

export const FloatingHorizontalScrollbar = ({ scrollContainerRef }) => {
  const [geometry, setGeometry] = useState({
    scrollWidth: 0,
    left: 0,
    width: 0,
    show: false
  });
  const stickyRef = useRef(null);

  const updateGeometry = useCallback(() => {
    const tableContainer = scrollContainerRef.current;
    if (!tableContainer) return;

    // We can use the closest table card wrapper, or just the container itself.
    // The container is the overflow-x-auto div.
    const rect = tableContainer.getBoundingClientRect();
    const sWidth = tableContainer.scrollWidth;
    const cWidth = tableContainer.clientWidth;
    const hasHorizontalOverflow = sWidth > cWidth + 1; // small threshold

    const viewportBottom = window.innerHeight;

    // Check if table is visible vertically.
    // Is the top of the table above the viewport bottom, and bottom of the table below the viewport top?
    const tableIsVisible = rect.bottom > 0 && rect.top < viewportBottom;

    const shouldShow = hasHorizontalOverflow && tableIsVisible;

    setGeometry(prev => {
      // Only update if changed to avoid unnecessary renders
      if (
        prev.scrollWidth === sWidth &&
        prev.left === rect.left &&
        prev.width === rect.width &&
        prev.show === shouldShow
      ) {
        return prev;
      }
      return {
        scrollWidth: sWidth,
        left: rect.left,
        width: rect.width,
        show: shouldShow
      };
    });
  }, [scrollContainerRef]);

  useEffect(() => {
    const tableContainer = scrollContainerRef.current;
    if (!tableContainer) return;

    updateGeometry();

    const onScrollOrResize = () => {
      requestAnimationFrame(updateGeometry);
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      onScrollOrResize();
    });

    resizeObserver.observe(tableContainer);
    if (tableContainer.children[0]) {
      resizeObserver.observe(tableContainer.children[0]);
    }

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      resizeObserver.disconnect();
    };
  }, [updateGeometry, scrollContainerRef]);

  useEffect(() => {
    const tableContainer = scrollContainerRef.current;
    const stickyContainer = stickyRef.current;

    if (!tableContainer || !stickyContainer || !geometry.show) return;

    let isSyncingTable = false;
    let isSyncingSticky = false;

    const onTableScroll = () => {
      if (isSyncingSticky) {
        isSyncingSticky = false;
        return;
      }
      isSyncingTable = true;
      stickyContainer.scrollLeft = tableContainer.scrollLeft;
    };

    const onStickyScroll = () => {
      if (isSyncingTable) {
        isSyncingTable = false;
        return;
      }
      isSyncingSticky = true;
      tableContainer.scrollLeft = stickyContainer.scrollLeft;
    };

    tableContainer.addEventListener('scroll', onTableScroll, { passive: true });
    stickyContainer.addEventListener('scroll', onStickyScroll, { passive: true });

    // Initial sync
    stickyContainer.scrollLeft = tableContainer.scrollLeft;

    return () => {
      tableContainer.removeEventListener('scroll', onTableScroll);
      stickyContainer.removeEventListener('scroll', onStickyScroll);
    };
  }, [geometry.show, scrollContainerRef]);

  if (!geometry.show) return null;

  return (
    <div
      ref={stickyRef}
      className="fixed bottom-0 z-30 overflow-x-auto custom-scrollbar bg-[var(--surface)] border-t border-[var(--border)]"
      style={{ left: geometry.left, width: geometry.width }}
    >
      <div style={{ height: '1px', width: `${geometry.scrollWidth}px` }} />
    </div>
  );
};
