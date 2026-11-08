import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CompactFilterToolbar from './CompactFilterToolbar';

describe('CompactFilterToolbar Component', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it('1. renders hidden when isVisible is false and sets --compact-toolbar-h to 0px', async () => {
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={false}
          search=""
          onSearchChange={vi.fn()}
        />
      );
    });

    const toolbar = container.querySelector('[data-testid="compact-filter-toolbar"]');
    expect(toolbar).toBeTruthy();
    expect(toolbar.getAttribute('aria-hidden')).toBe('true');
    expect(toolbar.className).toContain('opacity-0');
    expect(toolbar.className).toContain('pointer-events-none');
    expect(document.documentElement.style.getPropertyValue('--compact-toolbar-h')).toBe('0px');
  });

  it('2. renders visible when isVisible is true and sets --compact-toolbar-h to 44px', async () => {
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search="Ayaka"
          onSearchChange={vi.fn()}
          activeFilterCount={2}
          totalCount={50}
          filteredCount={1}
        />
      );
    });

    const toolbar = container.querySelector('[data-testid="compact-filter-toolbar"]');
    expect(toolbar).toBeTruthy();
    expect(toolbar.getAttribute('aria-hidden')).toBe('false');
    expect(toolbar.className).toContain('opacity-100');
    expect(document.documentElement.style.getPropertyValue('--compact-toolbar-h')).toBe('44px');

    // Counts badge
    const countBadge = container.querySelector('[data-testid="compact-count-badge"]');
    expect(countBadge).toBeTruthy();
    expect(countBadge.textContent).toBe('1/50');
  });

  it('3. synchronizes search input changes and clear button', async () => {
    const handleSearch = vi.fn();
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search="Kazuha"
          onSearchChange={handleSearch}
        />
      );
    });

    const searchInput = container.querySelector('[data-testid="compact-search-input"]');
    expect(searchInput.value).toBe('Kazuha');

    // Clear search
    const clearBtn = container.querySelector('[data-testid="compact-search-clear-btn"]');
    expect(clearBtn).toBeTruthy();

    await act(async () => {
      clearBtn.click();
    });

    expect(handleSearch).toHaveBeenCalledWith('');
  });

  it('4. displays active filter badge accurately', async () => {
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
          activeFilterCount={3}
          popoverContent={<div>Popover content</div>}
        />
      );
    });

    const badge = container.querySelector('[data-testid="compact-active-filter-badge"]');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('3');
  });

  it('5. triggers onClearFilters when clear button is clicked', async () => {
    const handleClear = vi.fn();
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search="Bennett"
          activeFilterCount={1}
          onClearFilters={handleClear}
          popoverContent={<div>Popover content</div>}
        />
      );
    });

    const clearBtn = container.querySelector('[data-testid="compact-clear-filters-btn"]');
    expect(clearBtn).toBeTruthy();

    await act(async () => {
      clearBtn.click();
    });

    expect(handleClear).toHaveBeenCalled();
  });

  it('6. opens accessible filter popover and handles Escape key and outside click', async () => {
    const handleClear = vi.fn();
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
          activeFilterCount={1}
          onClearFilters={handleClear}
          popoverContent={<div data-testid="test-popover-body">Custom Filter Body</div>}
        />
      );
    });

    const filterBtn = container.querySelector('[data-testid="compact-filters-btn"]');
    expect(filterBtn.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="compact-filter-popover"]')).toBeNull();

    // Click to open
    await act(async () => {
      filterBtn.click();
    });

    expect(filterBtn.getAttribute('aria-expanded')).toBe('true');
    const popover = container.querySelector('[data-testid="compact-filter-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.getAttribute('role')).toBe('region');
    expect(container.querySelector('[data-testid="test-popover-body"]')).toBeTruthy();

    // Popover Clear All button
    const popoverClear = container.querySelector('[data-testid="popover-clear-all-btn"]');
    expect(popoverClear).toBeTruthy();
    await act(async () => {
      popoverClear.click();
    });
    expect(handleClear).toHaveBeenCalled();

    // Press Escape to close
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.querySelector('[data-testid="compact-filter-popover"]')).toBeNull();
    expect(filterBtn.getAttribute('aria-expanded')).toBe('false');

    // Open again and click outside to close
    await act(async () => {
      filterBtn.click();
    });
    expect(container.querySelector('[data-testid="compact-filter-popover"]')).toBeTruthy();

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="compact-filter-popover"]')).toBeNull();
  });

  it('7. resets --compact-toolbar-h to 0px on unmount', async () => {
    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
        />
      );
    });
    expect(document.documentElement.style.getPropertyValue('--compact-toolbar-h')).toBe('44px');

    await act(async () => {
      root.unmount();
    });
    expect(document.documentElement.style.getPropertyValue('--compact-toolbar-h')).toBe('0px');
  });

  it('8. positions popover trigger-relative to Filters button left edge', async () => {
    window.innerWidth = 1200;
    window.innerHeight = 800;

    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
          popoverContent={<div>Popover content</div>}
        />
      );
    });

    const filterBtn = container.querySelector('[data-testid="compact-filters-btn"]');
    vi.spyOn(filterBtn, 'getBoundingClientRect').mockReturnValue({
      left: 320,
      right: 400,
      top: 64,
      bottom: 108,
      width: 80,
      height: 44,
    });

    await act(async () => {
      filterBtn.click();
    });

    const popover = container.querySelector('[data-testid="compact-filter-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.style.left).toBe('320px');
    expect(popover.style.top).toBe('114px'); // 108 + 6
    expect(popover.style.width).toBe('460px');
  });

  it('9. handles right-edge collision by shifting left within viewport margins', async () => {
    window.innerWidth = 1000;
    window.innerHeight = 800;

    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
          popoverContent={<div>Popover content</div>}
        />
      );
    });

    const filterBtn = container.querySelector('[data-testid="compact-filters-btn"]');
    // Button near the right edge: left is 700px. 700 + 460 = 1160 > 1000 - 12
    vi.spyOn(filterBtn, 'getBoundingClientRect').mockReturnValue({
      left: 700,
      right: 780,
      top: 64,
      bottom: 108,
      width: 80,
      height: 44,
    });

    await act(async () => {
      filterBtn.click();
    });

    const popover = container.querySelector('[data-testid="compact-filter-popover"]');
    expect(popover).toBeTruthy();
    // Shifted left: viewportWidth - popoverWidth - 12 = 1000 - 460 - 12 = 528px
    expect(popover.style.left).toBe('528px');
  });

  it('10. flips upward when space below is constrained and space above is greater', async () => {
    window.innerWidth = 1200;
    window.innerHeight = 400; // Small height

    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
          popoverContent={<div>Popover content</div>}
        />
      );
    });

    const filterBtn = container.querySelector('[data-testid="compact-filters-btn"]');
    // Button near bottom: top: 320, bottom: 360 -> space below is 40px (< 280), space above is 320px
    vi.spyOn(filterBtn, 'getBoundingClientRect').mockReturnValue({
      left: 200,
      right: 280,
      top: 320,
      bottom: 360,
      width: 80,
      height: 40,
    });

    await act(async () => {
      filterBtn.click();
    });

    const popover = container.querySelector('[data-testid="compact-filter-popover"]');
    expect(popover).toBeTruthy();
    expect(popover.style.top).toBe('auto');
    expect(popover.style.bottom).toBe('86px'); // 400 - 320 + 6
  });

  it('11. scales width appropriately on mobile screens (375px)', async () => {
    window.innerWidth = 375;
    window.innerHeight = 667;

    await act(async () => {
      root.render(
        <CompactFilterToolbar
          isVisible={true}
          search=""
          popoverContent={<div>Popover content</div>}
        />
      );
    });

    const filterBtn = container.querySelector('[data-testid="compact-filters-btn"]');
    vi.spyOn(filterBtn, 'getBoundingClientRect').mockReturnValue({
      left: 180,
      right: 250,
      top: 64,
      bottom: 108,
      width: 70,
      height: 44,
    });

    await act(async () => {
      filterBtn.click();
    });

    const popover = container.querySelector('[data-testid="compact-filter-popover"]');
    expect(popover).toBeTruthy();
    // On 375px: width is Math.min(460, 375 - 24) = 351px
    expect(popover.style.width).toBe('351px');
    // Left edge clamped: 375 - 351 - 12 = 12px
    expect(popover.style.left).toBe('12px');
  });
});

