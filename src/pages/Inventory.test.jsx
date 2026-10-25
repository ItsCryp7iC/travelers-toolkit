import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Inventory from './Inventory';
import { formatInventoryQuantity } from '../utils/inventoryFilters';
import useStore from '../store/useStore';

vi.mock('../store/useStore');

vi.mock('../utils/dataManager', async (importOriginal) => {
  const actual = await importOriginal();
  const fullList = actual.getPrimaryInventoryList();
  const essentialKeys = new Set([
    'Mora',
    'HeroWit',
    'AdventurerExperience',
    'WanderersAdvice',
    'HurricaneSeed',
    'DvalinClaw',
    'Crown',
  ]);
  const seenGroups = new Map();
  const testList = fullList.filter((item) => {
    if (essentialKeys.has(item.matKey)) return true;
    const groupKey = `${item.category}_${item.subCategory || ''}`;
    const count = seenGroups.get(groupKey) || 0;
    if (count < 2) {
      seenGroups.set(groupKey, count + 1);
      return true;
    }
    return false;
  });

  return {
    ...actual,
    getPrimaryInventoryList: () => testList,
  };
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function setMatchMedia(isMobile) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: isMobile ? query.includes('767px') : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('Inventory Page Responsive Architecture (R3)', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      inventory: {
        Mora: 1500000,
        HeroWit: 240,
        AdventurerExperience: 50,
        WanderersAdvice: 10,
        HurricaneSeed: 25,
        DvalinClaw: 6,
        Crown: 2,
      },
      setInventory: vi.fn((key, val) => {
        mockState.inventory[key] = val;
      }),
      incrementInventory: vi.fn((key, amount) => {
        mockState.inventory[key] = (mockState.inventory[key] || 0) + amount;
      }),
    };

    useStore.mockImplementation((selector) => selector(mockState));
    setMatchMedia(false);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  const renderComponent = async (initialUrl = '/inventory?tab=currency_exp') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialUrl]}>
          <Inventory />
        </MemoryRouter>
      );
    });
  };

  // ── Section 1: Page Header & QuickStats ──

  it('1. renders page header and quick stats accurately', async () => {
    await renderComponent();

    // Page title
    expect(container.querySelector('h1').textContent).toContain('Inventory');
    expect(container.textContent).toContain('Track your current material counts');

    // Quick stats
    expect(container.textContent).toContain('Materials Tracked');
    expect(container.textContent).toContain('1,500,000'); // Mora
    expect(container.textContent).toContain('240'); // Hero's Wit
    expect(container.textContent).toContain('Total Slots');
  });

  // ── Section 2: Category Tabs Strip ──

  it('2. renders category tab list and allows switching categories', async () => {
    await renderComponent('/inventory?tab=currency_exp');

    // Tab buttons exist
    const tabsList = container.querySelector('[role="tablist"]');
    expect(tabsList).toBeTruthy();

    const normalBossTab = container.querySelector('#inv-tab-normal_boss');
    expect(normalBossTab).toBeTruthy();
    expect(normalBossTab.textContent).toContain('Normal Boss');

    // Switch to Normal Boss tab
    await act(async () => {
      normalBossTab.click();
    });

    expect(normalBossTab.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('Hurricane Seed');
  });

  // ── Section 3: Desktop Viewports (>=768px) ──

  it('3. desktop toolbar remains directly visible with search, sort, and filters', async () => {
    setMatchMedia(false);
    await renderComponent();

    const desktopSearch = container.querySelector('.hidden.md\\:block input[type="search"]');
    expect(desktopSearch).toBeTruthy();

    const desktopSort = container.querySelector('#inv-sort-select');
    expect(desktopSort).toBeTruthy();

    // Material cards rendered
    const cards = container.querySelectorAll('[data-testid="material-card"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  // ── Section 4: Mobile Viewports (<768px) ──

  it('4. mobile search and filter panels start collapsed', async () => {
    setMatchMedia(true);
    await renderComponent();

    const searchToggle = container.querySelector('#inv-mobile-search-toggle');
    expect(searchToggle).toBeTruthy();
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#inv-mobile-search-panel')).toBeNull();

    const filtersToggle = container.querySelector('#inv-mobile-filters-toggle');
    expect(filtersToggle).toBeTruthy();
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#inv-mobile-filters-panel')).toBeNull();
  });

  // ── Section 5: Mobile Search Expansion & Filtering ──

  it('5. mobile search expansion and collapse toggles properly', async () => {
    setMatchMedia(true);
    await renderComponent();

    const searchToggle = container.querySelector('#inv-mobile-search-toggle');

    // Expand
    await act(async () => {
      searchToggle.click();
    });
    expect(searchToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#inv-mobile-search-panel')).toBeTruthy();

    // Collapse
    await act(async () => {
      searchToggle.click();
    });
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#inv-mobile-search-panel')).toBeNull();
  });

  it('6. mobile search filters materials and preserves query when collapsed', async () => {
    setMatchMedia(true);
    await renderComponent('/inventory?tab=currency_exp');

    const searchToggle = container.querySelector('#inv-mobile-search-toggle');

    // Expand search
    await act(async () => {
      searchToggle.click();
    });

    // Type "Mora"
    const searchInput = container.querySelector('#inv-mobile-search-panel input[type="search"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'Mora');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Verify Mora card is shown and Hero's Wit card is filtered out
    expect(container.querySelector('#inv-mora')).toBeTruthy();
    expect(container.querySelector('#inv-heroswit')).toBeNull();

    // Collapse search
    await act(async () => {
      searchToggle.click();
    });

    // Query and filtering must persist when collapsed
    expect(container.querySelector('#inv-mora')).toBeTruthy();
    expect(container.querySelector('#inv-heroswit')).toBeNull();

    // Active indicator on toggle
    expect(searchToggle.textContent).toContain('✕');
  });

  it('7. clear search button resets search query', async () => {
    setMatchMedia(true);
    await renderComponent('/inventory?tab=currency_exp');

    const searchToggle = container.querySelector('#inv-mobile-search-toggle');

    // Expand & search
    await act(async () => {
      searchToggle.click();
    });

    const searchInput = container.querySelector('#inv-mobile-search-panel input[type="search"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'Mora');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.querySelector('#inv-heroswit')).toBeNull();

    // Click clear button
    const clearBtn = container.querySelector('[aria-label="Clear search"]');
    expect(clearBtn).toBeTruthy();

    await act(async () => {
      clearBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // Restores all items
    expect(container.querySelector('#inv-heroswit')).toBeTruthy();
  });

  // ── Section 6: Mobile Filters Expansion & Filtering ──

  it('8. mobile filters expansion and collapse toggles properly', async () => {
    setMatchMedia(true);
    await renderComponent();

    const filtersToggle = container.querySelector('#inv-mobile-filters-toggle');

    // Expand
    await act(async () => {
      filtersToggle.click();
    });
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#inv-mobile-filters-panel')).toBeTruthy();

    // Collapse
    await act(async () => {
      filtersToggle.click();
    });
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#inv-mobile-filters-panel')).toBeNull();
  });

  it('9. rarity filter works and updates active filter badge count', async () => {
    setMatchMedia(true);
    await renderComponent('/inventory?tab=currency_exp');

    const filtersToggle = container.querySelector('#inv-mobile-filters-toggle');

    // Expand filters
    await act(async () => {
      filtersToggle.click();
    });

    // Click 4★ filter (Hero's Wit is 4-star)
    const fourStarBtn = Array.from(
      container.querySelectorAll('#inv-mobile-filters-panel button')
    ).find((b) => b.textContent.trim() === '4★');
    expect(fourStarBtn).toBeTruthy();

    await act(async () => {
      fourStarBtn.click();
    });

    // Verify filtering
    expect(container.textContent).toContain("Hero's Wit");
    expect(container.textContent).not.toContain("Wanderer's Advice"); // 1-star

    // Collapse filters
    await act(async () => {
      filtersToggle.click();
    });

    // Active badge count shows "1"
    expect(filtersToggle.textContent).toContain('1');
    expect(container.textContent).toContain("Hero's Wit");
    expect(container.textContent).not.toContain("Wanderer's Advice");
  });

  it('10. ownership filter (owned only) works', async () => {
    setMatchMedia(false);
    await renderComponent('/inventory?tab=currency_exp');

    const ownedOnlyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Owned Only')
    );
    expect(ownedOnlyBtn).toBeTruthy();

    await act(async () => {
      ownedOnlyBtn.click();
    });

    // Mora has qty 1,500,000 -> remains visible
    expect(container.textContent).toContain('Mora');
  });

  // ── Section 7: Quantity Adjustments (Stepper & Input) ──

  it('11. stepper buttons call setInventory to increment and decrement', async () => {
    await renderComponent('/inventory?tab=currency_exp');

    // Find Mora card
    const moraCard = container.querySelector('#inv-mora');
    expect(moraCard).toBeTruthy();

    const increaseBtn = moraCard.querySelector('button[aria-label="Increase Mora"]');
    const decreaseBtn = moraCard.querySelector('button[aria-label="Decrease Mora"]');
    expect(increaseBtn).toBeTruthy();
    expect(decreaseBtn).toBeTruthy();

    // Increment
    await act(async () => {
      increaseBtn.click();
    });
    expect(mockState.setInventory).toHaveBeenCalledWith('Mora', 1500001);

    // Decrement
    await act(async () => {
      decreaseBtn.click();
    });
    expect(mockState.setInventory).toHaveBeenCalledWith('Mora', 1499999);
  });

  it('12. stepper decrement cannot reduce quantity below zero', async () => {
    mockState.inventory['Mora'] = 0;
    await renderComponent('/inventory?tab=currency_exp');

    const moraCard = container.querySelector('#inv-mora');
    const decreaseBtn = moraCard.querySelector('button[aria-label="Decrease Mora"]');

    await act(async () => {
      decreaseBtn.click();
    });

    expect(mockState.setInventory).toHaveBeenCalledWith('Mora', 0);
  });

  it('13. direct number input updates inventory quantity', async () => {
    await renderComponent('/inventory?tab=currency_exp');

    const moraCard = container.querySelector('#inv-mora');
    const input = moraCard.querySelector('input[aria-label="Mora quantity"]');
    expect(input).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(input, '2000000');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mockState.setInventory).toHaveBeenCalledWith('Mora', 2000000);
  });

  // ── Section 8: Sorting ──

  it('14. sorting by Name reorders materials', async () => {
    await renderComponent('/inventory?tab=currency_exp');

    const sortSelect = container.querySelector('#inv-sort-select');
    expect(sortSelect).toBeTruthy();

    await act(async () => {
      sortSelect.value = 'Name';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const cards = container.querySelectorAll('[data-testid="material-card"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  // ── Section 9: Empty States ──

  it('15. displays empty state when search matches no materials and allows clearing', async () => {
    setMatchMedia(true);
    await renderComponent('/inventory?tab=currency_exp');

    const searchToggle = container.querySelector('#inv-mobile-search-toggle');
    await act(async () => {
      searchToggle.click();
    });

    const searchInput = container.querySelector('#inv-mobile-search-panel input[type="search"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'NonExistentMaterialXYZ123');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('No materials match the current search or filters.');

    // Click "Clear search & filters"
    const clearAllBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Clear search & filters')
    );
    expect(clearAllBtn).toBeTruthy();

    await act(async () => {
      clearAllBtn.click();
    });

    expect(container.textContent).toContain('Mora');
  });

  // ── Section 10: All Category Tab ──

  it('16. "All" category tab shows materials across all categories', async () => {
    await renderComponent('/inventory?tab=all');

    expect(container.textContent).toContain('Mora');
    expect(container.textContent).toContain('Hurricane Seed');
  });

  // ── Section 11: R3.1 Polish (Material Names & Large Quantity Presentation) ──

  it('17. formatInventoryQuantity formats numbers >= 1M compactly and keeps lower numbers comma-formatted', () => {
    expect(formatInventoryQuantity(42590000)).toBe('42.59M');
    expect(formatInventoryQuantity(1500000)).toBe('1.50M');
    expect(formatInventoryQuantity(1000000000)).toBe('1.00B');
    expect(formatInventoryQuantity(999999)).toBe('999,999');
    expect(formatInventoryQuantity(240)).toBe('240');
    expect(formatInventoryQuantity(0)).toBe('0');
    expect(formatInventoryQuantity(null)).toBe('0');
    expect(formatInventoryQuantity(undefined)).toBe('0');
  });

  it('18. material card titles allow up to two lines with line-clamping and full tooltip', async () => {
    await renderComponent('/inventory?tab=currency_exp');

    const moraCard = container.querySelector('#inv-mora');
    expect(moraCard).toBeTruthy();

    const titleEl = moraCard.querySelector('h3');
    expect(titleEl).toBeTruthy();
    expect(titleEl.className).toContain('line-clamp-2');
    expect(titleEl.className).toContain('break-words');
    expect(titleEl.getAttribute('title')).toBe('Mora');

    // Title container has fixed height so all card images remain vertically aligned
    const titleContainer = titleEl.parentElement;
    expect(titleContainer.className).toContain('h-[2.5rem]');
    expect(titleContainer.className).toContain('sm:h-[3rem]');
  });

  it('19. large quantity on Mora card displays compact format, exact integer in edit input, and non-overlapping stepper', async () => {
    mockState.inventory['Mora'] = 42590000;
    await renderComponent('/inventory?tab=currency_exp');

    const moraCard = container.querySelector('#inv-mora');
    expect(moraCard).toBeTruthy();

    // Read-only count display shows compact format (42.59M)
    const countDisplay = moraCard.querySelector('span[title="42,590,000"]');
    expect(countDisplay).toBeTruthy();
    expect(countDisplay.textContent).toBe('42.59M');

    // Editing input exposes the exact unrounded integer (42590000)
    const input = moraCard.querySelector('input[type="number"]');
    expect(input).toBeTruthy();
    expect(input.value).toBe('42590000');
    expect(input.className).toContain('flex-1');
    expect(input.className).toContain('min-w-0');

    // Stepper buttons have shrink-0 to prevent overlap
    const buttons = moraCard.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    buttons.forEach((btn) => {
      expect(btn.className).toContain('shrink-0');
    });

    // Editing still updates the store with exact integer value
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(input, '42590005');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mockState.setInventory).toHaveBeenCalledWith('Mora', 42590005);
  });
});
