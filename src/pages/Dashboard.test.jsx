import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Dashboard from './Dashboard';
import useStore from '../store/useStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../store/useStore');
vi.mock('../components/AddWeaponModal', () => ({
  default: ({ onClose }) => <div data-testid="add-weapon-modal">Add Weapon Modal <button onClick={onClose}>Close</button></div>
}));
vi.mock('../components/BatchAddWeaponModal', () => ({
  default: ({ onClose }) => <div data-testid="batch-weapon-modal">Batch Weapon Modal <button onClick={onClose}>Close</button></div>
}));
vi.mock('../components/CookiePromptModal', () => ({
  default: ({ onClose }) => <div data-testid="cookie-prompt-modal">Cookie Prompt Modal <button onClick={onClose}>Close</button></div>
}));

describe('Dashboard Responsive Architecture & Controls', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      hoyolabConnected: false,
      roster: { 'Kamisato Ayaka': { level: 90 }, 'Diluc': { level: 80 } },
      trackedWeapons: [{ id: 'w1', name: 'Mistsplitter Reforged' }],
      batchAddCharacters: vi.fn(),
      syncPayload: null,
      isSyncing: false,
      handleSyncNotes: vi.fn().mockResolvedValue({}),
    };

    useStore.mockImplementation((selector) => selector(mockState));
    useStore.getState = () => mockState;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('1. renders Dashboard header, tabs, stat cards, and desktop controls', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    expect(container.querySelector('h1').textContent).toBe('Dashboard');
    expect(container.querySelector('#character-search')).not.toBeNull();
    expect(container.querySelector('#sort-select')).not.toBeNull();
    expect(container.querySelector('#dashboard-grid')).not.toBeNull();

    // Check stats
    const statCards = container.querySelectorAll('.stat-card');
    expect(statCards.length).toBe(4);
    expect(statCards[3].textContent).toContain('In My Roster');
    expect(statCards[3].textContent).toContain('2');
  });

  it('2. renders mobile search and filter toggle buttons with accessible attributes', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    const searchToggle = container.querySelector('#dashboard-mobile-search-toggle');
    const filterToggle = container.querySelector('#dashboard-mobile-filters-toggle');

    expect(searchToggle).not.toBeNull();
    expect(filterToggle).not.toBeNull();
    expect(searchToggle.getAttribute('aria-expanded')).toBe('false');
    expect(filterToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('3. mobile search panel expands, filters characters, and collapses', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    const searchToggle = container.querySelector('#dashboard-mobile-search-toggle');

    // Initially collapsed
    expect(container.querySelector('#dashboard-mobile-search-panel')).toBeNull();

    // Open search panel
    await act(async () => {
      searchToggle.click();
    });

    expect(searchToggle.getAttribute('aria-expanded')).toBe('true');
    const mobileSearchInput = container.querySelector('#dashboard-search-mobile');
    expect(mobileSearchInput).not.toBeNull();

    // Type query
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      valueSetter.call(mobileSearchInput, 'Ayaka');
      mobileSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
      mobileSearchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Check search button highlights and clear button appears
    expect(searchToggle.className).toContain('border-[var(--gold)]');
    expect(searchToggle.querySelector('[aria-label="Clear search"]')).not.toBeNull();

    // Check filtered cards
    const characterCards = container.querySelectorAll('#dashboard-grid > *');
    expect(characterCards.length).toBe(1);

    // Close panel
    await act(async () => {
      searchToggle.click();
    });

    expect(container.querySelector('#dashboard-mobile-search-panel')).toBeNull();
    // Query is preserved even when closed
    expect(searchToggle.className).toContain('border-[var(--gold)]');
  });

  it('4. mobile filters panel expands, displays filters, and updates active count badge', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    const filterToggle = container.querySelector('#dashboard-mobile-filters-toggle');

    // Initially collapsed
    expect(container.querySelector('#dashboard-mobile-filters-panel')).toBeNull();

    // Open filters panel
    await act(async () => {
      filterToggle.click();
    });

    expect(filterToggle.getAttribute('aria-expanded')).toBe('true');
    const filtersPanel = container.querySelector('#dashboard-mobile-filters-panel');
    expect(filtersPanel).not.toBeNull();

    // Select Cryo element filter on mobile
    const cryoBtn = container.querySelector('#filter-element-mobile-cryo');
    expect(cryoBtn).not.toBeNull();

    await act(async () => {
      cryoBtn.click();
    });

    // Active filter badge appears on mobile toggle
    expect(filterToggle.textContent).toContain('1');

    // Select 5-star rarity filter
    const fiveStarBtn = container.querySelector('#filter-rarity-mobile-5');
    expect(fiveStarBtn).not.toBeNull();

    await act(async () => {
      fiveStarBtn.click();
    });

    expect(filterToggle.textContent).toContain('2');

    // Clear filters via mobile panel clear button
    const clearBtn = Array.from(filtersPanel.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Clear'
    );
    expect(clearBtn).not.toBeNull();

    await act(async () => {
      clearBtn.click();
    });

    // Count badge resets
    expect(container.querySelector('#dashboard-mobile-filters-toggle').textContent).not.toContain('2');
  });

  it('5. switching tabs updates to Weapons view and preserves responsive controls', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    const weaponsTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Weapons'
    );
    expect(weaponsTabBtn).not.toBeNull();

    await act(async () => {
      weaponsTabBtn.click();
    });

    // Check stats update
    const statCards = container.querySelectorAll('.stat-card');
    expect(statCards[0].textContent).toContain('Total Weapons');
    expect(statCards[3].textContent).toContain('Tracked Weapons');

    // Open mobile filter panel in Weapons view
    const filterToggle = container.querySelector('#dashboard-mobile-filters-toggle');
    await act(async () => {
      filterToggle.click();
    });

    // Elements filter should not be shown in Weapons tab
    expect(container.querySelector('#filter-element-mobile-pyro')).toBeNull();
    // Weapon type filter should be shown
    expect(container.querySelector('#filter-weapon-mobile-sword')).not.toBeNull();
  });

  it('6. empty search state renders clear all filters button which resets query', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    const searchInput = container.querySelector('#character-search');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      valueSetter.call(searchInput, 'XYZNonExistentCharacterQuery999');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('No characters found');
    const clearBtn = container.querySelector('#clear-filters-btn');
    expect(clearBtn).not.toBeNull();

    await act(async () => {
      clearBtn.click();
    });

    expect(container.textContent).not.toContain('No characters found');
  });

  it('7. header action buttons maintain minimum touch target height and responsive structure', async () => {
    await act(async () => {
      root.render(<Dashboard />);
    });

    const syncBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Sync Resin & Realm Currency')
    );
    const addAllBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Add All Available Characters')
    );

    expect(syncBtn).not.toBeNull();
    expect(addAllBtn).not.toBeNull();
    expect(syncBtn.className).toContain('min-h-[40px]');
    expect(addAllBtn.className).toContain('min-h-[40px]');
  });
});
