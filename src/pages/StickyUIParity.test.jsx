import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Characters from './Characters';
import Weapons from './Weapons';
import Dashboard from './Dashboard';
import Inventory from './Inventory';
import Planner from './Planner';
import useStore from '../store/useStore';
import { INVENTORY_TABS } from '../utils/inventoryFilters';
import { PLANNER_TABS } from '../utils/plannerTabs';
import { getRouteKey, saveScrollPosition, getSavedScrollPosition, clearScrollMemory } from '../utils/scrollMemory';

vi.mock('../store/useStore');
vi.mock('../components/CharacterModal', () => ({
  default: () => <div data-testid="character-modal">Modal</div>,
}));
vi.mock('../components/AddCharacterModal', () => ({
  default: () => <div data-testid="add-character-modal">Add Modal</div>,
}));
vi.mock('../components/BulkEditCharacterModal', () => ({
  default: () => null,
}));
vi.mock('../components/BatchAddWeaponModal', () => ({
  default: () => null,
}));
vi.mock('../components/BulkEditWeaponModal', () => ({
  default: () => null,
}));

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Sticky UI R1 Regression Suite', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    clearScrollMemory();

    mockState = {
      roster: {
        'Kamisato Ayaka': {
          currentLevel: 80,
          targetLevel: 90,
          currentAscension: 5,
          targetAscension: 6,
          currentTalents: { normal: 8, skill: 8, burst: 8 },
          targetTalents: { normal: 9, skill: 9, burst: 10 },
          priority: 3,
          equippedWeaponId: 'fav-sword-1',
        },
        'Bennett': {
          currentLevel: 70,
          targetLevel: 80,
          currentAscension: 4,
          targetAscension: 5,
          currentTalents: { normal: 1, skill: 6, burst: 8 },
          targetTalents: { normal: 1, skill: 8, burst: 10 },
          priority: 2,
          equippedWeaponId: null,
        },
      },
      trackedWeapons: [
        {
          id: 'fav-sword-1',
          weaponName: 'Favonius Sword',
          level: 80,
          targetLevel: 90,
          ascension: 5,
          targetAscension: 6,
          currentRefinement: 3,
          targetRefinement: 5,
          assignedTo: 'Kamisato Ayaka',
        },
      ],
      inventory: {
        Mora: 2500000,
        HeroWit: 150,
      },
      updateCharacter: vi.fn(),
      removeCharacter: vi.fn(),
      batchRemoveCharacters: vi.fn(),
      bulkUpdateCharacters: vi.fn(),
      updateTrackedWeapon: vi.fn(),
      removeTrackedWeapon: vi.fn(),
      batchRemoveWeapons: vi.fn(),
      bulkUpdateWeapons: vi.fn(),
      hoyolabConnected: false,
      lastHoyolabCharacterSyncAt: null,
      handleSyncNotes: vi.fn(),
    };

    useStore.mockImplementation((selector) => selector(mockState));
    useStore.getState = () => mockState;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  // ── Roster Sticky Headers & Frozen Columns ──

  it('1. Roster table headers have sticky group headings, column headings, and frozen columns', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/characters']}>
          <Characters />
        </MemoryRouter>
      );
    });

    const table = container.querySelector('table');
    expect(table).toBeTruthy();

    const theadRows = table.querySelectorAll('thead tr');
    expect(theadRows.length).toBe(2);

    // Group 0: Group headings
    const groupRow = theadRows[0];
    expect(groupRow.textContent).toContain('Identity');
    const identityTh = Array.from(groupRow.querySelectorAll('th')).find((th) =>
      th.textContent.includes('Identity')
    );
    expect(identityTh).toBeTruthy();

    // Group 1: Individual column headings
    const colRow = theadRows[1];
    const thElements = Array.from(colRow.querySelectorAll('th'));
    const selectTh = thElements.find((th) => th.querySelector('input[type="checkbox"]'));
    expect(selectTh.className).toContain('sticky');
    expect(selectTh.className).toContain('left-0');

    // Frozen sl column
    const slTh = thElements.find((th) => th.textContent.includes('Sl'));
    expect(slTh.className).toContain('sticky');
    expect(slTh.className).toContain('left-[40px]');

    // Frozen character column
    const charTh = thElements.find((th) => th.textContent.includes('Character'));
    expect(charTh.className).toContain('sticky');
    expect(charTh.className).toContain('left-[72px]');

    // Totals row is first row of tbody with table-totals-row class
    const tbodyRows = table.querySelectorAll('tbody tr');
    const totalsRow = tbodyRows[0];
    expect(totalsRow.textContent).toContain('TOTALS');
    expect(totalsRow.className).toContain('table-totals-row');

    // Totals row frozen columns
    const totalsCells = Array.from(totalsRow.querySelectorAll('td'));
    const selectTd = totalsCells[0];
    expect(selectTd.className).toContain('sticky');
    expect(selectTd.className).toContain('left-0');

    const slTd = totalsCells[1];
    expect(slTd.className).toContain('sticky');
    expect(slTd.className).toContain('left-[40px]');

    const charTd = totalsCells[2];
    expect(charTd.className).toContain('sticky');
    expect(charTd.className).toContain('left-[72px]');
  });

  // ── Armory Sticky Headers & Frozen Columns ──

  it('2. Armory table headers have sticky group headings, column headings, and frozen columns', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/weapons']}>
          <Weapons />
        </MemoryRouter>
      );
    });

    const table = container.querySelector('table');
    expect(table).toBeTruthy();

    const theadRows = table.querySelectorAll('thead tr');
    expect(theadRows.length).toBe(2);

    // Leaf row frozen columns
    const leafRow = theadRows[1];
    const thElements = Array.from(leafRow.querySelectorAll('th'));

    const selectTh = thElements.find((th) => th.querySelector('input[type="checkbox"]'));
    expect(selectTh.className).toContain('sticky');
    expect(selectTh.className).toContain('left-0');

    const slTh = thElements.find((th) => th.textContent.includes('Sl'));
    expect(slTh.className).toContain('sticky');
    expect(slTh.className).toContain('left-[40px]');

    const wpnTh = thElements.find((th) => th.textContent.includes('Weapon'));
    expect(wpnTh.className).toContain('sticky');
    expect(wpnTh.className).toContain('left-[72px]');

    // Totals row in tbody has table-totals-row class and frozen columns
    const tbodyRows = table.querySelectorAll('tbody tr');
    const totalsRow = tbodyRows[0];
    expect(totalsRow.textContent).toContain('TOTALS');
    expect(totalsRow.className).toContain('table-totals-row');

    const totalsCells = Array.from(totalsRow.querySelectorAll('td'));
    const selectTd = totalsCells[0];
    expect(selectTd.className).toContain('sticky');
    expect(selectTd.className).toContain('left-0');

    const slTd = totalsCells[1];
    expect(slTd.className).toContain('sticky');
    expect(slTd.className).toContain('left-[40px]');

    const wpnTd = totalsCells[2];
    expect(wpnTd.className).toContain('sticky');
    expect(wpnTd.className).toContain('left-[72px]');
  });

  // ── Compact Toolbar & State Synchronization ──

  it('3. Roster compact toolbar synchronizes search, element filter, and clear filters', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/characters']}>
          <Characters />
        </MemoryRouter>
      );
    });

    const compactToolbar = container.querySelector('[data-testid="compact-filter-toolbar"]');
    expect(compactToolbar).toBeTruthy();

    // Type in compact search
    const compactSearch = container.querySelector('[data-testid="compact-search-input"]');
    await act(async () => {
      fireEvent.change(compactSearch, { target: { value: 'Ayaka' } });
    });

    // Original desktop search reflects Ayaka
    const originalSearch = container.querySelector('input[aria-label="Search roster"]');
    expect(originalSearch.value).toBe('Ayaka');

    // Open compact filter popover
    const filterBtn = container.querySelector('[data-testid="compact-filters-btn"]');
    await act(async () => {
      filterBtn.click();
    });

    const popover = container.querySelector('[data-testid="compact-filter-popover"]');
    expect(popover).toBeTruthy();

    // Select Pyro in compact popover
    const pyroBtn = Array.from(popover.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Pyro')
    );
    expect(pyroBtn).toBeTruthy();
    await act(async () => {
      pyroBtn.click();
    });

    // Clear filters in compact toolbar
    const popoverClear = container.querySelector('[data-testid="popover-clear-all-btn"]');
    await act(async () => {
      popoverClear.click();
    });

    expect(originalSearch.value).toBe('');
  });

  it('4. Dashboard compact toolbar supports mode switching between Characters and Weapons', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <Dashboard />
        </MemoryRouter>
      );
    });

    const charsBtn = container.querySelector('[data-testid="compact-dashboard-chars-tab"]');
    const weaponsBtn = container.querySelector('[data-testid="compact-dashboard-weapons-tab"]');
    expect(charsBtn).toBeTruthy();
    expect(weaponsBtn).toBeTruthy();

    // Switch to Weapons via compact toolbar
    await act(async () => {
      weaponsBtn.click();
    });

    expect(weaponsBtn.className).toContain('bg-primary');
    expect(container.textContent).toContain('Total Weapons');

    // Switch back to Characters
    await act(async () => {
      charsBtn.click();
    });

    expect(charsBtn.className).toContain('bg-primary');
    expect(container.textContent).toContain('Total Characters');
  });

  // ── Inventory Sticky Header & Category Unification ──

  it('5. Inventory header is sticky with all 12 categories, highlighting active tab and preserving URL params', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/inventory?tab=weekly_boss']}>
          <Inventory />
        </MemoryRouter>
      );
    });

    // Sticky header container
    const stickyHeader = container.querySelector('.sticky');
    expect(stickyHeader).toBeTruthy();
    expect(stickyHeader.className).toContain('top-[var(--topbar-h,64px)]');

    // Title and subtitle
    expect(stickyHeader.querySelector('h1').textContent).toContain('Inventory');
    expect(stickyHeader.textContent).toContain('Track your current material counts');

    // All 12 category tabs
    const tablist = stickyHeader.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    expect(tablist.getAttribute('aria-label')).toBe('Inventory categories');

    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(12);
    expect(INVENTORY_TABS).toHaveLength(12);

    // Active tab weekly_boss is highlighted
    const weeklyBossTab = stickyHeader.querySelector('#inv-tab-weekly_boss');
    expect(weeklyBossTab).toBeTruthy();
    expect(weeklyBossTab.getAttribute('aria-selected')).toBe('true');
    expect(weeklyBossTab.className).toContain('bg-[var(--primary)]');

    // Quick stats renders below sticky header
    expect(container.textContent).toContain('Materials Tracked');

    // Switch tab to normal_boss
    const normalBossTab = stickyHeader.querySelector('#inv-tab-normal_boss');
    await act(async () => {
      normalBossTab.click();
    });

    expect(normalBossTab.getAttribute('aria-selected')).toBe('true');
  });

  it('6. Planner sticky header remains fully functional with all 13 categories', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/planner?tab=daily_action']}>
          <Planner />
        </MemoryRouter>
      );
    });

    const stickyHeader = container.querySelector('.sticky');
    expect(stickyHeader).toBeTruthy();
    expect(stickyHeader.className).toContain('top-[var(--topbar-h,64px)]');

    const tablist = stickyHeader.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(13);
    expect(PLANNER_TABS).toHaveLength(13);

    const dailyActionTab = stickyHeader.querySelector('#planner-tab-daily_action');
    expect(dailyActionTab.getAttribute('aria-selected')).toBe('true');
  });

  // ── Per-Tab Scroll Memory Isolation ──

  it('7. Inventory independent per-tab scroll coordinates remain preserved and isolated', () => {
    // Save position on weekly_boss
    const weeklyKey = getRouteKey('/inventory', '?tab=weekly_boss');
    saveScrollPosition(weeklyKey, { x: 0, y: 750 });

    // Normal boss first visit starts at 0, 0
    const normalKey = getRouteKey('/inventory', '?tab=normal_boss');
    expect(getSavedScrollPosition(normalKey)).toBeUndefined();

    saveScrollPosition(normalKey, { x: 0, y: 320 });

    // Both remain independently stored
    expect(getSavedScrollPosition(weeklyKey)).toEqual({ x: 0, y: 750 });
    expect(getSavedScrollPosition(normalKey)).toEqual({ x: 0, y: 320 });
  });
});
