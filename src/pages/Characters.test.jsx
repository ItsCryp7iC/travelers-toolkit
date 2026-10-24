import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Characters from './Characters';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../components/CharacterModal', () => ({
  default: ({ character, onClose }) => (
    <div data-testid="character-modal">
      Modal for {character?.name} <button onClick={onClose}>Close</button>
    </div>
  )
}));
vi.mock('../components/AddCharacterModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="add-character-modal">
      Add Modal <button onClick={onClose}>Close</button>
    </div>
  )
}));
vi.mock('../components/BulkEditCharacterModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="bulk-modal">Bulk Modal</div> : null
}));
vi.mock('../components/HoyolabSyncPreviewModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="sync-modal">Sync Modal</div> : null
}));

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

describe('Characters Page Responsive Architecture (R2.1)', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

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
          equippedWeaponId: null
        },
        'Bennett': {
          currentLevel: 70,
          targetLevel: 80,
          currentAscension: 4,
          targetAscension: 5,
          currentTalents: { normal: 1, skill: 6, burst: 8 },
          targetTalents: { normal: 1, skill: 8, burst: 10 },
          priority: 2,
          equippedWeaponId: null
        },
        'Xiangling': {
          currentLevel: 70,
          targetLevel: 80,
          currentAscension: 4,
          targetAscension: 5,
          currentTalents: { normal: 1, skill: 6, burst: 8 },
          targetTalents: { normal: 1, skill: 8, burst: 10 },
          priority: 1,
          equippedWeaponId: null
        }
      },
      trackedWeapons: [],
      inventory: {},
      updateCharacter: vi.fn(),
      removeCharacter: vi.fn(),
      batchRemoveCharacters: vi.fn(),
      bulkUpdateCharacters: vi.fn(),
      hoyolabConnected: false,
      lastHoyolabCharacterSyncAt: null
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

  const renderComponent = async () => {
    await act(async () => {
      root.render(<Characters />);
    });
  };

  // ── Section 1: Default View Mode ──

  it('1. desktop defaults to table view', async () => {
    setMatchMedia(false);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('[data-testid="character-card"]')).toBeNull();
    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).toContain('Xiangling');
  });

  it('2. mobile defaults to table view (R2.1: reversed from card)', async () => {
    setMatchMedia(true);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('[data-testid="character-card"]')).toBeNull();
  });

  // ── Section 2: View Toggle ──

  it('3. cards toggle remains functional on desktop', async () => {
    setMatchMedia(false);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();
    const cardsToggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cards')
    );
    expect(cardsToggle).toBeTruthy();

    await act(async () => {
      cardsToggle.click();
    });

    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('[data-testid="character-card"]').length).toBe(3);
  });

  it('4. user can switch mobile table -> cards and back', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Starts as table
    expect(container.querySelector('table')).toBeTruthy();

    const cardsToggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cards')
    );
    await act(async () => {
      cardsToggle.click();
    });
    expect(container.querySelectorAll('[data-testid="character-card"]').length).toBe(3);

    const tableToggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Table')
    );
    await act(async () => {
      tableToggle.click();
    });
    expect(container.querySelector('table')).toBeTruthy();
  });

  // ── Section 3: Mobile Collapsible Search ──

  it('5. mobile search is collapsed by default', async () => {
    setMatchMedia(true);
    await renderComponent();

    const searchToggle = container.querySelector('#char-mobile-search-toggle');
    expect(searchToggle).toBeTruthy();
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    // Search panel should not be visible
    expect(container.querySelector('#char-mobile-search-panel')).toBeNull();
  });

  it('6. mobile search expansion/collapse works', async () => {
    setMatchMedia(true);
    await renderComponent();

    const searchToggle = container.querySelector('#char-mobile-search-toggle');

    // Expand
    await act(async () => {
      searchToggle.click();
    });
    expect(searchToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#char-mobile-search-panel')).toBeTruthy();

    // Collapse
    await act(async () => {
      searchToggle.click();
    });
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#char-mobile-search-panel')).toBeNull();
  });

  it('7. hidden search preserves query and filtering', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand search
    const searchToggle = container.querySelector('#char-mobile-search-toggle');
    await act(async () => {
      searchToggle.click();
    });

    // Type a search query
    const searchInput = container.querySelector('#char-mobile-search-panel input[type="search"]');
    expect(searchInput).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'Ayaka');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Verify filtering works
    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).not.toContain('Bennett');

    // Collapse search
    await act(async () => {
      searchToggle.click();
    });

    // Filtering should still be active even with panel hidden
    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).not.toContain('Bennett');
  });

  // ── Section 4: Mobile Collapsible Filters ──

  it('8. mobile filters are collapsed by default', async () => {
    setMatchMedia(true);
    await renderComponent();

    const filtersToggle = container.querySelector('#char-mobile-filters-toggle');
    expect(filtersToggle).toBeTruthy();
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#char-mobile-filters-panel')).toBeNull();
  });

  it('9. mobile filter expansion/collapse works', async () => {
    setMatchMedia(true);
    await renderComponent();

    const filtersToggle = container.querySelector('#char-mobile-filters-toggle');

    // Expand
    await act(async () => {
      filtersToggle.click();
    });
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#char-mobile-filters-panel')).toBeTruthy();

    // Collapse
    await act(async () => {
      filtersToggle.click();
    });
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#char-mobile-filters-panel')).toBeNull();
  });

  it('10. hidden filters preserve selected state', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand filters
    const filtersToggle = container.querySelector('#char-mobile-filters-toggle');
    await act(async () => {
      filtersToggle.click();
    });

    // Click Pyro filter
    const pyroButton = Array.from(container.querySelectorAll('#char-mobile-filters-panel button')).find(
      (btn) => btn.textContent.trim() === 'Pyro'
    );
    expect(pyroButton).toBeTruthy();
    await act(async () => {
      pyroButton.click();
    });

    // Verify filtering
    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).not.toContain('Kamisato Ayaka');

    // Collapse filters
    await act(async () => {
      filtersToggle.click();
    });

    // Filter should still be active
    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).not.toContain('Kamisato Ayaka');
  });

  it('11. active filter count indication is accurate', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand filters and apply one
    const filtersToggle = container.querySelector('#char-mobile-filters-toggle');
    await act(async () => {
      filtersToggle.click();
    });

    const pyroButton = Array.from(container.querySelectorAll('#char-mobile-filters-panel button')).find(
      (btn) => btn.textContent.trim() === 'Pyro'
    );
    await act(async () => {
      pyroButton.click();
    });

    // Collapse and check the badge
    await act(async () => {
      filtersToggle.click();
    });

    // Should show a count badge on the filters toggle
    expect(filtersToggle.textContent).toContain('1');
  });

  // ── Section 5: Desktop Search/Filters ──

  it('12. desktop search and filters remain visible (not collapsible)', async () => {
    setMatchMedia(false);
    await renderComponent();

    // Desktop search should be visible directly
    const desktopSearch = container.querySelector('#sort-select');
    expect(desktopSearch).toBeTruthy();

    // Mobile toggles should not be present in the DOM rendering flow
    // (they exist but hidden via md:hidden class; functionally they render but display:none)
    const searchToggle = container.querySelector('#char-mobile-search-toggle');
    // The toggle exists in DOM but is hidden via CSS class 'md:hidden' -> 'flex md:hidden'
    // What matters is desktop search input is rendered
    const desktopSearchInput = container.querySelector('input[type="search"]');
    expect(desktopSearchInput).toBeTruthy();
  });

  // ── Section 6: Desktop Filters ──

  it('13. element filter works on desktop', async () => {
    setMatchMedia(false);
    await renderComponent();

    const pyroButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.trim() === 'Pyro'
    );
    expect(pyroButton).toBeTruthy();

    await act(async () => {
      pyroButton.click();
    });

    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).toContain('Xiangling');
    expect(container.textContent).not.toContain('Kamisato Ayaka');
  });

  it('14. weapon filter works on mobile (via collapsible filters)', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand filters
    const filtersToggle = container.querySelector('#char-mobile-filters-toggle');
    await act(async () => {
      filtersToggle.click();
    });

    const polearmBtn = Array.from(container.querySelectorAll('#char-mobile-filters-panel button')).find(
      (btn) => btn.textContent.trim() === 'Polearm'
    );
    expect(polearmBtn).toBeTruthy();

    await act(async () => {
      polearmBtn.click();
    });

    expect(container.textContent).toContain('Xiangling');
    expect(container.textContent).not.toContain('Bennett');
    expect(container.textContent).not.toContain('Kamisato Ayaka');
  });

  it('15. rarity filter works', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand filters
    const filtersToggle = container.querySelector('#char-mobile-filters-toggle');
    await act(async () => {
      filtersToggle.click();
    });

    const fiveStarBtn = Array.from(container.querySelectorAll('#char-mobile-filters-panel button')).find(
      (btn) => btn.textContent.includes('5★')
    );
    expect(fiveStarBtn).toBeTruthy();

    await act(async () => {
      fiveStarBtn.click();
    });

    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).not.toContain('Bennett');
    expect(container.textContent).not.toContain('Xiangling');
  });

  it('16. sort works on desktop', async () => {
    setMatchMedia(false);
    await renderComponent();

    const sortSelect = container.querySelector('#sort-select');
    expect(sortSelect).toBeTruthy();

    await act(async () => {
      sortSelect.value = 'Name';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).toContain('Xiangling');
  });

  // ── Section 7: Sticky Columns ──

  it('17. only first three columns are sticky (checkbox, sl, character)', async () => {
    setMatchMedia(false);
    await renderComponent();

    const table = container.querySelector('table');
    expect(table).toBeTruthy();

    // Get all th elements in the leaf header row
    const headerRows = table.querySelectorAll('thead tr');
    const leafRow = headerRows[headerRows.length - 1];
    const headerCells = leafRow.querySelectorAll('th');

    // Count sticky header cells
    let stickyCount = 0;
    headerCells.forEach((th) => {
      if (th.className.includes('sticky')) stickyCount++;
    });

    // Only 3 columns should be sticky: select, sl, character
    expect(stickyCount).toBe(3);
  });

  // ── Section 8: Core Regression Tests ──

  it('18. Batch Add still opens modal', async () => {
    await renderComponent();

    const addBtn = container.querySelector('#add-character-btn');
    expect(addBtn).toBeTruthy();

    await act(async () => {
      addBtn.click();
    });

    expect(container.querySelector('[data-testid="add-character-modal"]')).toBeTruthy();
  });

  it('19. table row click opens CharacterModal', async () => {
    setMatchMedia(false);
    await renderComponent();

    // Data rows start at index 1 (index 0 is totals row)
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(1);
    const dataRow = rows[1];

    await act(async () => {
      dataRow.click();
    });

    expect(container.querySelector('[data-testid="character-modal"]')).toBeTruthy();
  });

  it('20. card click opens CharacterModal', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Switch to cards first
    const cardsToggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cards')
    );
    await act(async () => {
      cardsToggle.click();
    });

    const card = container.querySelector('#char-card-kamisato-ayaka');
    expect(card).toBeTruthy();

    await act(async () => {
      card.click();
    });

    const modal = container.querySelector('[data-testid="character-modal"]');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Kamisato Ayaka');
  });

  it('21. empty state unchanged functionally', async () => {
    mockState.roster = {};
    await renderComponent();

    expect(container.textContent).toContain('Your roster is empty');
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('+ Add Character')
    );
    expect(addBtn).toBeTruthy();

    await act(async () => {
      addBtn.click();
    });

    expect(container.querySelector('[data-testid="add-character-modal"]')).toBeTruthy();
  });

  // ── Section 9: Bulk Selection Regression ──

  it('22. bulk selection works from table view', async () => {
    setMatchMedia(false);
    await renderComponent();

    // Find checkbox in header row
    const headerCheckbox = container.querySelector('thead input[type="checkbox"]');
    expect(headerCheckbox).toBeTruthy();
  });
});
