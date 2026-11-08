import React, { useState, useEffect, useRef } from 'react';

/**
 * CompactFilterToolbar
 *
 * A compact toolbar that appears once the original search/filter region has scrolled
 * past the viewport. Reuses existing page state for search, filters, and active counts.
 */
export default function CompactFilterToolbar({
  isVisible,
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  activeFilterCount = 0,
  onClearFilters,
  totalCount,
  filteredCount,
  children,
  popoverContent,
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
  const toolbarRef = useRef(null);
  const filterBtnRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePopoverPosition = () => {
    if (!filterBtnRef.current || typeof window === 'undefined') return;
    const btnRect = filterBtnRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const popoverWidth = Math.min(460, viewportWidth - 24);

    // Horizontally align with the left edge of the trigger button where space permits
    let left = btnRect.left || 12;
    // Right collision handling: if left + popoverWidth > viewport - 12, shift left
    if (left + popoverWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - popoverWidth - 12);
    }
    if (left < 12) left = 12;

    // Vertical placement: default below trigger button
    const spaceBelow = viewportHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;
    let top = btnRect.bottom + 6;
    let bottom = 'auto';
    let maxHeight = Math.min(520, spaceBelow - 16);

    // Flip above trigger if space below is limited (< 280px) and space above is larger
    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      top = 'auto';
      bottom = `${viewportHeight - btnRect.top + 6}px`;
      maxHeight = Math.min(520, spaceAbove - 16);
    }

    setPopoverStyle({
      position: 'fixed',
      left: `${left}px`,
      top: top === 'auto' ? 'auto' : `${top}px`,
      bottom: bottom === 'auto' ? 'auto' : bottom,
      width: `${popoverWidth}px`,
      maxHeight: `${Math.max(200, maxHeight)}px`,
      zIndex: 60,
    });
  };

  useEffect(() => {
    if (!isPopoverOpen) return;
    updatePopoverPosition();

    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isPopoverOpen]);

  // Synchronize the CSS variable --compact-toolbar-h for sticky table headers
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isVisible) {
      document.documentElement.style.setProperty('--compact-toolbar-h', '44px');
    } else {
      document.documentElement.style.setProperty('--compact-toolbar-h', '0px');
      setIsPopoverOpen(false);
    }

    return () => {
      document.documentElement.style.setProperty('--compact-toolbar-h', '0px');
    };
  }, [isVisible]);

  // Handle popover outside click and Escape key dismissal
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPopoverOpen(false);
        filterBtnRef.current?.focus();
      }
    };

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target)
      ) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  const hasActiveFilters = activeFilterCount > 0 || (search && search.trim() !== '');

  return (
    <div
      ref={toolbarRef}
      id="compact-filter-toolbar"
      data-testid="compact-filter-toolbar"
      className={`fixed top-[var(--topbar-h,64px)] left-0 md:left-[var(--sidebar-w,260px)] right-0 z-40 bg-[#00041e]/95 backdrop-blur-xl border-b border-[var(--border)] shadow-md transition-opacity duration-200 h-[44px] flex items-center ${
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isVisible}
    >
      <div className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 max-w-full">
        {/* Left: Search input, Filters button, Clear button */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-[200px] sm:max-w-xs min-w-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none select-none">
              🔍
            </span>
            <input
              type="search"
              data-testid="compact-search-input"
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-7 sm:h-8 pl-7 pr-6 rounded-lg bg-[var(--elevated)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
              aria-label="Compact search"
            />
            {search && (
              <button
                type="button"
                data-testid="compact-search-clear-btn"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white text-xs cursor-pointer p-0.5"
                aria-label="Clear search query"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Button */}
          {popoverContent && (
            <button
              type="button"
              ref={filterBtnRef}
              id="compact-filters-toggle"
              data-testid="compact-filters-btn"
              aria-expanded={isPopoverOpen}
              aria-controls="compact-filter-popover"
              onClick={() => setIsPopoverOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer h-7 sm:h-8 shrink-0 ${
                activeFilterCount > 0
                  ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/15 shadow-sm'
                  : 'border-[var(--border)] text-[var(--muted)] bg-[var(--surface)] hover:text-white hover:border-[var(--border-light)]'
              }`}
            >
              <span>⚙ Filters</span>
              {activeFilterCount > 0 && (
                <span
                  data-testid="compact-active-filter-badge"
                  className="ml-0.5 text-[10px] bg-[var(--gold)] text-[var(--bg)] rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0"
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Clear Filters (Desktop) */}
          {hasActiveFilters && onClearFilters && (
            <button
              type="button"
              data-testid="compact-clear-filters-btn"
              onClick={onClearFilters}
              className="hidden lg:inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-red-400 transition-colors cursor-pointer px-1.5 py-1 shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Center / Right: Children (e.g. mode toggle) and Count badge */}
        <div className="flex items-center gap-2 shrink-0">
          {children}

          {totalCount !== undefined && (
            <span
              data-testid="compact-count-badge"
              className="text-[10px] sm:text-xs text-[var(--muted)] whitespace-nowrap shrink-0 hidden xs:inline-block"
            >
              {filteredCount !== undefined ? `${filteredCount}/${totalCount}` : totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Filter Popover */}
      {isPopoverOpen && popoverContent && (
        <div
          ref={popoverRef}
          id="compact-filter-popover"
          data-testid="compact-filter-popover"
          role="region"
          aria-label="Filter Options"
          style={popoverStyle}
          className="overflow-y-auto custom-scrollbar bg-[#00041e] border border-[var(--border)] rounded-2xl p-4 shadow-2xl backdrop-blur-2xl animate-fade-in"
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[var(--text)]">Filters</span>
              {activeFilterCount > 0 && (
                <span className="text-[10px] bg-[var(--gold)] text-[var(--bg)] rounded-full px-1.5 py-0.2 font-bold">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {hasActiveFilters && onClearFilters && (
                <button
                  type="button"
                  data-testid="popover-clear-all-btn"
                  onClick={onClearFilters}
                  className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                data-testid="popover-close-btn"
                onClick={() => setIsPopoverOpen(false)}
                className="text-[var(--muted)] hover:text-white p-1 rounded-md text-sm cursor-pointer"
                aria-label="Close filters popover"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-3">{popoverContent}</div>
        </div>
      )}
    </div>
  );
}

