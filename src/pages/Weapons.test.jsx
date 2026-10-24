import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Weapons from './Weapons';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../components/AddWeaponModal', () => ({
  default: ({ existingWeapon, onClose }) => (
    <div data-testid="add-weapon-modal">
      Weapon Modal for {existingWeapon?.weaponName || existingWeapon?.name} (id: {existingWeapon?.id})
      <button onClick={onClose}>Close</button>
    </div>
  )
}));
vi.mock('../components/BatchAddWeaponModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="batch-weapon-modal">
      Batch Modal <button onClick={onClose}>Close</button>
    </div>
  )
}));
vi.mock('../components/BulkEditWeaponModal', () => ({
  default: ({ isOpen }) => (isOpen ? <div data-testid="bulk-weapon-modal">Bulk Modal</div> : null)
}));
vi.mock('../components/ForgingQueuePanel', () => ({
  default: () => <div data-testid="forging-queue">Forging Queue Panel</div>
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

describe('Weapons Page Responsive Architecture (R2.1)', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      trackedWeapons: [
        {
          id: 'w1-uuid',
          weapon_id: 'DullBlade',
          weaponName: 'Dull Blade',
          level: 70,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 1,
          assignedTo: 'Kamisato Ayaka',
          priority: 3,
          createdAt: 1000
        },
        {
          id: 'w2-uuid',
          weapon_id: 'DullBlade', // Duplicate same-name weapon instance
          weaponName: 'Dull Blade',
          level: 20,
          targetLevel: 40,
          ascension: 1,
          targetAscension: 2,
          refinement: 2,
          assignedTo: 'Bennett',
          priority: 1,
          createdAt: 2000
        },
        {
          id: 'w3-uuid',
          weapon_id: 'BeginnersProtector',
          weaponName: "Beginner's Protector",
          level: 70,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 5,
          assignedTo: 'Xiangling',
          priority: 2,
          createdAt: 3000
        },
        {
          id: 'w4-uuid',
          weapon_id: 'HuntersBow',
          weaponName: "Hunter's Bow",
          level: 70,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 3,
          assignedTo: null,
          priority: 1,
          createdAt: 4000
        }
      ],
      inventory: {},
      removeTrackedWeapon: vi.fn(),
      batchRemoveWeapons: vi.fn(),
      updateTrackedWeapon: vi.fn(),
      bulkUpdateWeapons: vi.fn()
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
      root.render(<Weapons />);
    });
  };

  // ── Section 1: Default View Mode ──

  it('1. desktop defaults to table view', async () => {
    setMatchMedia(false);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('[data-testid="weapon-card"]')).toBeNull();
    expect(container.textContent).toContain('Dull Blade');
    expect(container.textContent).toContain("Beginner's Protector");
  });

  it('2. mobile defaults to table view (R2.1: reversed from card)', async () => {
    setMatchMedia(true);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('[data-testid="weapon-card"]')).toBeNull();
  });

  // ── Section 2: View Toggle ──

  it('3. cards toggle remains functional', async () => {
    setMatchMedia(false);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();
    const cardsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cards')
    );
    expect(cardsBtn).toBeTruthy();

    await act(async () => {
      cardsBtn.click();
    });

    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('[data-testid="weapon-card"]').length).toBe(4);
  });

  it('4. user can switch mobile table -> cards and back', async () => {
    setMatchMedia(true);
    await renderComponent();

    expect(container.querySelector('table')).toBeTruthy();

    const cardsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cards')
    );
    await act(async () => {
      cardsBtn.click();
    });
    expect(container.querySelectorAll('[data-testid="weapon-card"]').length).toBe(4);

    const tableBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Table')
    );
    await act(async () => {
      tableBtn.click();
    });
    expect(container.querySelector('table')).toBeTruthy();
  });

  // ── Section 3: Duplicate UUID Handling ──

  it('5. duplicate same-name weapon instances both render in table', async () => {
    setMatchMedia(false);
    await renderComponent();

    // Both instances should be visible in table
    const rows = container.querySelectorAll('tbody tr');
    // rows[0] is totals row; rows 1-4 are data rows
    expect(rows.length).toBeGreaterThanOrEqual(5);
    // Both Dull Blade instances should appear
    const textContent = container.textContent;
    // Count occurrences of "Dull Blade" — should appear at least twice (for each instance)
    const dullBladeMatches = textContent.match(/Dull Blade/g);
    expect(dullBladeMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('6. card actions preserve UUID identity', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Switch to cards
    const cardsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cards')
    );
    await act(async () => {
      cardsBtn.click();
    });

    const secondInstanceCard = container.querySelector('#weapon-card-w2-uuid');
    expect(secondInstanceCard).toBeTruthy();

    await act(async () => {
      secondInstanceCard.click();
    });

    const modal = container.querySelector('[data-testid="add-weapon-modal"]');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('id: w2-uuid');
  });

  // ── Section 4: Mobile Collapsible Search ──

  it('7. mobile search is collapsed by default', async () => {
    setMatchMedia(true);
    await renderComponent();

    const searchToggle = container.querySelector('#wpn-mobile-search-toggle');
    expect(searchToggle).toBeTruthy();
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#wpn-mobile-search-panel')).toBeNull();
  });

  it('8. mobile search expansion/collapse works', async () => {
    setMatchMedia(true);
    await renderComponent();

    const searchToggle = container.querySelector('#wpn-mobile-search-toggle');

    // Expand
    await act(async () => {
      searchToggle.click();
    });
    expect(searchToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#wpn-mobile-search-panel')).toBeTruthy();

    // Collapse
    await act(async () => {
      searchToggle.click();
    });
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#wpn-mobile-search-panel')).toBeNull();
  });

  it('9. hidden search preserves query and filtering', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand search
    const searchToggle = container.querySelector('#wpn-mobile-search-toggle');
    await act(async () => {
      searchToggle.click();
    });

    // Type a search query
    const searchInput = container.querySelector('#wpn-mobile-search-panel input[type="search"]');
    expect(searchInput).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'Hunter');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Verify filtering
    expect(container.textContent).toContain("Hunter's Bow");
    expect(container.textContent).not.toContain('Dull Blade');

    // Collapse
    await act(async () => {
      searchToggle.click();
    });

    // Filtering still active
    expect(container.textContent).toContain("Hunter's Bow");
    expect(container.textContent).not.toContain('Dull Blade');
  });

  // ── Section 5: Mobile Collapsible Filters ──

  it('10. mobile filters are collapsed by default', async () => {
    setMatchMedia(true);
    await renderComponent();

    const filtersToggle = container.querySelector('#wpn-mobile-filters-toggle');
    expect(filtersToggle).toBeTruthy();
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#wpn-mobile-filters-panel')).toBeNull();
  });

  it('11. mobile filter expansion/collapse works', async () => {
    setMatchMedia(true);
    await renderComponent();

    const filtersToggle = container.querySelector('#wpn-mobile-filters-toggle');

    // Expand
    await act(async () => {
      filtersToggle.click();
    });
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#wpn-mobile-filters-panel')).toBeTruthy();

    // Collapse
    await act(async () => {
      filtersToggle.click();
    });
    expect(filtersToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#wpn-mobile-filters-panel')).toBeNull();
  });

  it('12. hidden filters preserve selected state', async () => {
    setMatchMedia(true);
    await renderComponent();

    // Expand filters
    const filtersToggle = container.querySelector('#wpn-mobile-filters-toggle');
    await act(async () => {
      filtersToggle.click();
    });

    // Click Polearm filter
    const polearmBtn = Array.from(container.querySelectorAll('#wpn-mobile-filters-panel button')).find(
      (btn) => btn.textContent.trim() === 'Polearm'
    );
    expect(polearmBtn).toBeTruthy();
    await act(async () => {
      polearmBtn.click();
    });

    // Verify filter applied
    expect(container.textContent).toContain("Beginner's Protector");
    expect(container.textContent).not.toContain('Dull Blade');

    // Collapse
    await act(async () => {
      filtersToggle.click();
    });

    // Filter still active
    expect(container.textContent).toContain("Beginner's Protector");
    expect(container.textContent).not.toContain('Dull Blade');
  });

  it('13. active filter count indication is accurate', async () => {
    setMatchMedia(true);
    await renderComponent();

    const filtersToggle = container.querySelector('#wpn-mobile-filters-toggle');
    await act(async () => {
      filtersToggle.click();
    });

    const polearmBtn = Array.from(container.querySelectorAll('#wpn-mobile-filters-panel button')).find(
      (btn) => btn.textContent.trim() === 'Polearm'
    );
    await act(async () => {
      polearmBtn.click();
    });

    await act(async () => {
      filtersToggle.click();
    });

    // Should show count badge
    expect(filtersToggle.textContent).toContain('1');
  });

  // ── Section 6: Desktop Search/Filters ──

  it('14. desktop search and filters remain visible', async () => {
    setMatchMedia(false);
    await renderComponent();

    const desktopSearch = container.querySelector('input[type="search"]');
    expect(desktopSearch).toBeTruthy();

    const sortSelect = container.querySelector('#sort-select');
    expect(sortSelect).toBeTruthy();
  });

  it('15. desktop search works', async () => {
    setMatchMedia(false);
    await renderComponent();

    const searchInput = container.querySelector('input[type="search"]');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'Hunter');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain("Hunter's Bow");
    expect(container.textContent).not.toContain('Dull Blade');
    expect(container.textContent).not.toContain("Beginner's Protector");
  });

  // ── Section 7: Sticky Columns ──

  it('16. only first three columns are sticky (checkbox, sl, weapon)', async () => {
    setMatchMedia(false);
    await renderComponent();

    const table = container.querySelector('table');
    expect(table).toBeTruthy();

    const headerRows = table.querySelectorAll('thead tr');
    const leafRow = headerRows[headerRows.length - 1];
    const headerCells = leafRow.querySelectorAll('th');

    let stickyCount = 0;
    headerCells.forEach((th) => {
      if (th.className.includes('sticky')) stickyCount++;
    });

    // Only 3 columns should be sticky: select, sl, weapon_name
    expect(stickyCount).toBe(3);
  });

  // ── Section 8: Sorting ──

  it('17. sorting works on desktop', async () => {
    setMatchMedia(false);
    await renderComponent();

    const sortSelect = container.querySelector('#sort-select');
    expect(sortSelect).toBeTruthy();

    await act(async () => {
      sortSelect.value = 'Name';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Dull Blade');
    expect(container.textContent).toContain("Beginner's Protector");
    expect(container.textContent).toContain("Hunter's Bow");
  });

  // ── Section 9: Core Regression Tests ──

  it('18. Add Weapon button works', async () => {
    await renderComponent();

    const addBtn = container.querySelector('#add-weapon-btn');
    expect(addBtn).toBeTruthy();
    expect(addBtn.textContent).toContain('Batch Add Weapons');
  });

  it('19. Batch Add opens modal', async () => {
    await renderComponent();

    const addBtn = container.querySelector('#add-weapon-btn');
    await act(async () => {
      addBtn.click();
    });

    expect(container.querySelector('[data-testid="batch-weapon-modal"]')).toBeTruthy();
  });

  it('20. table row click opens weapon modal', async () => {
    setMatchMedia(false);
    await renderComponent();

    // Data rows start at index 1 (index 0 is totals row)
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(1);
    const dataRow = rows[1];

    await act(async () => {
      dataRow.click();
    });

    expect(container.querySelector('[data-testid="add-weapon-modal"]')).toBeTruthy();
  });

  it('21. Armory/To Forge tab behavior preserved', async () => {
    await renderComponent();

    const forgeTabBtn = container.querySelector('#weapons-tab-forge');
    expect(forgeTabBtn).toBeTruthy();

    await act(async () => {
      forgeTabBtn.click();
    });

    expect(container.querySelector('[data-testid="forging-queue"]')).toBeTruthy();

    const armoryTabBtn = container.querySelector('#weapons-tab-armory');
    await act(async () => {
      armoryTabBtn.click();
    });

    expect(container.querySelector('[data-testid="forging-queue"]')).toBeNull();
    expect(container.textContent).toContain('Dull Blade');
  });

  it('22. empty state preserved', async () => {
    mockState.trackedWeapons = [];
    await renderComponent();

    expect(container.textContent).toContain('Your armory is empty');
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('+ Batch Add Weapons')
    );
    expect(addBtn).toBeTruthy();

    await act(async () => {
      addBtn.click();
    });

    expect(container.querySelector('[data-testid="batch-weapon-modal"]')).toBeTruthy();
  });

  // ── Section 10: Bulk Selection ──

  it('23. bulk selection works from table view', async () => {
    setMatchMedia(false);
    await renderComponent();

    const headerCheckbox = container.querySelector('thead input[type="checkbox"]');
    expect(headerCheckbox).toBeTruthy();
  });

  // ── Section 11: Weapon UUID Identity Preservation ──

  it('24. no regressions to weapon UUID handling (duplicate weapons preserve separate UUID identity)', async () => {
    setMatchMedia(false);
    await renderComponent();

    // Data rows (index 0 is totals row)
    const rows = container.querySelectorAll('tbody tr');
    // 1 totals row + 4 data rows = 5 rows
    expect(rows.length).toBe(5);

    // Two distinct rows contain 'Dull Blade' with unique UUIDs
    const dullBladeRows = Array.from(rows).filter((r) => r.textContent.includes('Dull Blade'));
    expect(dullBladeRows.length).toBe(2);

    // Clicking a row opens modal with the specific weapon instance
    await act(async () => {
      dullBladeRows[1].click();
    });

    const modal = container.querySelector('[data-testid="add-weapon-modal"]');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Dull Blade');
  });
});
