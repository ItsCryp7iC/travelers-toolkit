import React, { useEffect, useRef } from 'react';

/**
 * StickyHeaderTabShell
 *
 * Unified sticky page title and horizontal category-tab header.
 * Stays pinned beneath the global application topbar while scrolling.
 */
export default function StickyHeaderTabShell({
  icon,
  title,
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  tabIdPrefix = 'tab',
  tablistAriaLabel = 'Categories',
  rightContent = null,
  containerRef = null,
}) {
  const localRef = useRef(null);
  const tabsContainerRef = containerRef || localRef;

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const activeBtn = container.querySelector(`[id="${tabIdPrefix}-${activeTab}"]`);
    if (!activeBtn) return;

    const scrollActiveIntoView = () => {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeBtn.getBoundingClientRect();

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      if (containerRect.width > 0 && activeRect.width > 0) {
        const isComfortablyVisible =
          activeRect.left >= containerRect.left + 16 &&
          activeRect.right <= containerRect.right - 16;

        if (!isComfortablyVisible) {
          const offset = activeRect.left - containerRect.left + container.scrollLeft;
          const targetScrollLeft = offset - container.clientWidth / 2 + activeRect.width / 2;

          if (typeof container.scrollTo === 'function') {
            container.scrollTo({
              left: Math.max(0, targetScrollLeft),
              behavior: prefersReducedMotion ? 'auto' : 'smooth',
            });
          } else {
            container.scrollLeft = Math.max(0, targetScrollLeft);
          }
        }
      } else if (typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    };

    scrollActiveIntoView();
    const rafId = requestAnimationFrame(scrollActiveIntoView);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab, tabIdPrefix, tabsContainerRef]);

  return (
    <div className="sticky top-[var(--topbar-h,64px)] z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-2 sm:pb-3 pt-1 mb-4 sm:mb-6 border-b border-[var(--border)] shadow-sm">
      {/* ── Title & Subtitle Row ── */}
      <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {icon && (
            <img
              src={icon}
              alt=""
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-xl sm:text-2xl md:text-3xl text-[var(--text)] truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[var(--muted)] text-xs sm:text-sm truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {rightContent && <div className="shrink-0">{rightContent}</div>}
      </div>

      {/* ── Category Tabs Strip ── */}
      <div
        ref={tabsContainerRef}
        role="tablist"
        aria-label={tablistAriaLabel}
        className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tabIdPrefix}-${tab.id}`}
              aria-selected={isActive}
              onClick={() => onTabChange?.(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--primary)] text-white shadow-md shadow-amber-900/20 ring-1 ring-amber-400/30'
                  : 'bg-[var(--surface)] text-[var(--muted)] hover:text-white hover:bg-gray-800/80 border border-[var(--border)]'
              }`}
            >
              {typeof tab.icon === 'string' && tab.icon.startsWith('/') ? (
                <img
                  src={tab.icon}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  aria-hidden="true"
                />
              ) : tab.icon ? (
                <span className="text-sm" aria-hidden="true">
                  {tab.icon}
                </span>
              ) : null}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

