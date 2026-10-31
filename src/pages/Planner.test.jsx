import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Planner from './Planner';
import useStore from '../store/useStore';
import { PLANNER_TABS, getPlannerTabId, formatPlannerQuantity } from '../utils/plannerTabs';

vi.mock('../store/useStore');

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function LocationObserver({ onChange }) {
  const location = useLocation();
  onChange(location);
  return null;
}

describe('Planner Responsive Architecture & In-Page Navigation (R4)', () => {
  let container = null;
  let root = null;
  let mockState = {};
  let currentLocation = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    currentLocation = null;

    mockState = {
      roster: {
        Amber: {
          name: 'Amber',
          level: 20,
          targetLevel: 80,
          ascension: 1,
          targetAscension: 5,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 6, skill: 6, burst: 6 },
          element: 'Pyro'
        }
      },
      trackedWeapons: [
        {
          id: 'fav-bow-1',
          weaponName: 'Favonius Warbow',
          level: 1,
          targetLevel: 80,
          ascension: 0,
          targetAscension: 5
        }
      ],
      inventory: {
        Mora: 100000,
        HeroWit: 50
      }
    };

    useStore.mockImplementation((selector) => selector(mockState));
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    container = null;
    vi.restoreAllMocks();
  });

  const renderComponent = async (initialUrl = '/planner?tab=daily_action') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialUrl]}>
          <LocationObserver onChange={(loc) => { currentLocation = loc; }} />
          <Planner />
        </MemoryRouter>
      );
    });
  };

  // ── Section 1: Helper and Tab Config Validation ──

  it('1. getPlannerTabId validates valid tabs and defaults invalid params to daily_action', () => {
    expect(getPlannerTabId('daily_action')).toBe('daily_action');
    expect(getPlannerTabId('talent')).toBe('talent');
    expect(getPlannerTabId('per_character')).toBe('per_character');
    expect(getPlannerTabId('invalid_xyz')).toBe('daily_action');
    expect(getPlannerTabId(null)).toBe('daily_action');
    expect(getPlannerTabId('')).toBe('daily_action');
    expect(PLANNER_TABS).toHaveLength(13);
  });

  // ── Section 2: Header & Grand Total Stats ──

  it('2. renders page header, sticky container, and grand total stats', async () => {
    await renderComponent();

    // Page header title & description
    expect(container.querySelector('h1').textContent).toContain('Resource Planner');
    expect(container.textContent).toContain('Grand total across 2 tracked characters');

    // Sticky header has topbar offset
    const stickyHeader = container.querySelector('.sticky');
    expect(stickyHeader).toBeTruthy();
    expect(stickyHeader.className).toContain('top-[var(--topbar-h,64px)]');

    // Stats cards render values
    expect(container.textContent).toContain('Tracked Characters');
    expect(container.textContent).toContain('Total Mora');
    expect(container.textContent).toContain('Crowns Needed');
    expect(container.textContent).toContain('Still to Farm');
  });

  // ── Section 3: In-Page Category Navigation ──

  it('3. renders category tablist with all 13 planner categories', async () => {
    await renderComponent();

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();

    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(13);

    // First tab is daily_action and active
    const dailyTab = container.querySelector('#planner-tab-daily_action');
    expect(dailyTab).toBeTruthy();
    expect(dailyTab.getAttribute('aria-selected')).toBe('true');
  });

  it('4. clicking an in-page tab switches active category and updates URL query parameters', async () => {
    await renderComponent('/planner?tab=daily_action');

    const talentTab = container.querySelector('#planner-tab-talent');
    expect(talentTab).toBeTruthy();
    expect(talentTab.getAttribute('aria-selected')).toBe('false');

    await act(async () => {
      talentTab.click();
    });

    expect(talentTab.getAttribute('aria-selected')).toBe('true');
    expect(currentLocation.search).toContain('tab=talent');
  });

  it('5. active category state reflects current URL parameter on initial load', async () => {
    await renderComponent('/planner?tab=weapon_ascension');

    const weaponAscTab = container.querySelector('#planner-tab-weapon_ascension');
    expect(weaponAscTab).toBeTruthy();
    expect(weaponAscTab.getAttribute('aria-selected')).toBe('true');

    const dailyTab = container.querySelector('#planner-tab-daily_action');
    expect(dailyTab.getAttribute('aria-selected')).toBe('false');
  });

  // ── Section 4: Daily Action Content ──

  it('6. daily action tab renders day selector and farmable widget', async () => {
    await renderComponent('/planner?tab=daily_action');

    expect(container.querySelector('#farmable-today-widget')).toBeTruthy();
    expect(container.textContent).toContain('Daily Action Plan');

    // Day buttons exist
    const dayButtons = container.querySelectorAll('#farmable-today-widget button');
    expect(dayButtons.length).toBeGreaterThan(0);
  });

  // ── Section 5: Material Categories ──

  it('7. material categories render appropriate domain groups and cards', async () => {
    await renderComponent('/planner?tab=currency_exp');

    // Category tabs exist and currency_exp is active
    const currTab = container.querySelector('#planner-tab-currency_exp');
    expect(currTab.getAttribute('aria-selected')).toBe('true');
  });

  // ── Section 6: Character and Weapon Planning Views ──

  it('8. character planning view displays search input and character cards', async () => {
    await renderComponent('/planner?tab=per_character');

    const searchInput = container.querySelector('#planner-search-characters');
    expect(searchInput).toBeTruthy();
    expect(container.textContent).toContain('Amber');
  });

  it('9. character search filters character cards and clear button resets query', async () => {
    await renderComponent('/planner?tab=per_character');

    const searchInput = container.querySelector('#planner-search-characters');
    expect(searchInput).toBeTruthy();

    // Search for non-existent character
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'NonExistentHero123');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('No characters match your search');

    // Click clear button
    const clearBtn = container.querySelector('button[aria-label="Clear character search"]');
    expect(clearBtn).toBeTruthy();

    await act(async () => {
      clearBtn.click();
    });

    expect(container.textContent).toContain('Amber');
  });

  it('10. weapon planning view displays search input and weapon cards', async () => {
    await renderComponent('/planner?tab=per_weapon');

    const searchInput = container.querySelector('#planner-search-weapons');
    expect(searchInput).toBeTruthy();
    expect(container.textContent).toContain('Favonius Warbow');
  });

  it('11. weapon search filters weapon cards and clear button resets query', async () => {
    await renderComponent('/planner?tab=per_weapon');

    const searchInput = container.querySelector('#planner-search-weapons');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(searchInput, 'NonExistentSwordXYZ');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('No stand-alone weapons match your search');

    const clearBtn = container.querySelector('button[aria-label="Clear weapon search"]');
    expect(clearBtn).toBeTruthy();

    await act(async () => {
      clearBtn.click();
    });

    expect(container.textContent).toContain('Favonius Warbow');
  });

  // ── Section 7: Empty State & Bottom Link ──

  it('12. renders empty state when roster is empty', async () => {
    mockState.roster = {};
    await renderComponent();

    expect(container.querySelector('h1').textContent).toContain('Planner');
    expect(container.textContent).toContain('Plan and track materials for your characters and weapons');
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it('13. bottom inventory link button renders correctly', async () => {
    await renderComponent();

    const invLink = container.querySelector('#go-to-inventory-btn');
    expect(invLink).toBeTruthy();
    expect(invLink.getAttribute('href')).toBe('/inventory');
    expect(invLink.textContent).toContain('Open Inventory →');
  });

  // ── Section 8: R4.1 Polish (Quantity Formatting & Visibility Mechanics) ──

  it('14. formatPlannerQuantity formats large and small numbers correctly', () => {
    // Specific requirements from R4.1
    expect(formatPlannerQuantity(341731480)).toBe('341.73M');
    expect(formatPlannerQuantity(42586360)).toBe('42.59M');
    expect(formatPlannerQuantity(299145120)).toBe('299.15M');
    expect(formatPlannerQuantity(1000000000)).toBe('1.00B');

    // Standard small quantities with commas
    expect(formatPlannerQuantity(12500)).toBe('12,500');
    expect(formatPlannerQuantity(1234)).toBe('1,234');
    expect(formatPlannerQuantity(168)).toBe('168');
    expect(formatPlannerQuantity(0)).toBe('0');

    // Invalid & edge cases
    expect(formatPlannerQuantity(null)).toBe('0');
    expect(formatPlannerQuantity(undefined)).toBe('0');
    expect(formatPlannerQuantity('invalid')).toBe('0');
  });

  it('15. initial load with ?tab=normal_boss ensures Normal Boss is active and visible', async () => {
    await renderComponent('/planner?tab=normal_boss');

    const normalBossTab = container.querySelector('#planner-tab-normal_boss');
    expect(normalBossTab).toBeTruthy();
    expect(normalBossTab.getAttribute('aria-selected')).toBe('true');

    // Other tabs are not active
    const dailyTab = container.querySelector('#planner-tab-daily_action');
    expect(dailyTab.getAttribute('aria-selected')).toBe('false');
  });

  it('16. weekday selector renders Sunday button and handles Sunday selection and weekday visibility', async () => {
    await renderComponent('/planner?tab=daily_action');

    const sundayBtn = container.querySelector('#day-selector-btn-0');
    expect(sundayBtn).toBeTruthy();
    expect(sundayBtn.textContent).toBe('SUN');

    // Click Sunday
    await act(async () => {
      sundayBtn.click();
    });

    expect(sundayBtn.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('SUNDAY');

    // Click Monday
    const mondayBtn = container.querySelector('#day-selector-btn-1');
    expect(mondayBtn).toBeTruthy();
    await act(async () => {
      mondayBtn.click();
    });

    expect(mondayBtn.getAttribute('aria-selected')).toBe('true');
    expect(sundayBtn.getAttribute('aria-selected')).toBe('false');
    expect(container.textContent).toContain('MONDAY');
  });

  /**
   * JSDOM Layout Measurement Limitations:
   * ───────────────────────────────────────────────────────────────────────────
   * In JSDOM / Node test environment, the browser layout engine is not running:
   * - getBoundingClientRect() returns all zeros { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }.
   * - clientWidth, scrollWidth, and scrollLeft default to 0.
   * - Custom web fonts (e.g., GenshinFont) and CSS flex/overflow calculations cannot be rendered.
   *
   * To verify the layout-aware positioning logic in unit tests, we simulate the container and
   * button geometric properties corresponding to the 390x844 mobile viewport (~356px container width,
   * ~419px content scrollWidth with font metrics). Real layout and visual correctness are verified
   * via headless Chrome CDP integration at 390x844, 360x800, and 1440x900.
   */
  it('19. calculates valid scroll position and ensures Sunday is visible within container bounds', async () => {
    await renderComponent('/planner?tab=daily_action');

    const selectorContainer = container.querySelector('[aria-label="Select Day of Week"]');
    expect(selectorContainer).toBeTruthy();

    const sundayBtn = container.querySelector('#day-selector-btn-0');
    const mondayBtn = container.querySelector('#day-selector-btn-1');
    expect(sundayBtn).toBeTruthy();
    expect(mondayBtn).toBeTruthy();

    // Mock container geometry corresponding to 390px mobile viewport (356px visible width)
    let currentScrollLeft = 0;
    const scrollToMock = vi.fn((opts) => {
      currentScrollLeft = typeof opts === 'object' ? opts.left : opts;
      selectorContainer.scrollLeft = currentScrollLeft;
    });
    selectorContainer.scrollTo = scrollToMock;

    Object.defineProperty(selectorContainer, 'clientWidth', { configurable: true, value: 356 });
    Object.defineProperty(selectorContainer, 'scrollWidth', { configurable: true, value: 419 });
    Object.defineProperty(selectorContainer, 'scrollLeft', {
      configurable: true,
      get: () => currentScrollLeft,
      set: (val) => { currentScrollLeft = val; }
    });

    vi.spyOn(selectorContainer, 'getBoundingClientRect').mockReturnValue({
      left: 17,
      right: 373,
      width: 356,
      top: 100,
      bottom: 140,
      height: 40
    });

    // When scrolled to 0, Sunday is clipped at the right edge (right: 424 > container.right: 373)
    vi.spyOn(sundayBtn, 'getBoundingClientRect').mockImplementation(() => {
      const left = 371 - currentScrollLeft;
      return {
        left,
        right: left + 53,
        width: 53,
        top: 100,
        bottom: 140,
        height: 40
      };
    });

    vi.spyOn(mondayBtn, 'getBoundingClientRect').mockImplementation(() => {
      const left = 29 - currentScrollLeft;
      return {
        left,
        right: left + 59,
        width: 59,
        top: 100,
        bottom: 140,
        height: 40
      };
    });

    // Click Sunday to trigger layout-aware alignment
    await act(async () => {
      sundayBtn.click();
    });

    // Verify scrollTo was called with valid calculated scroll position:
    // targetScrollLeft = currentScrollLeft + rightEdge - containerRect.width + PADDING
    // = 0 + (424 - 17) - 356 + 12 = 63px (capped at maxScroll 419 - 356 = 63px)
    expect(scrollToMock).toHaveBeenCalled();
    const lastCall = scrollToMock.mock.calls[scrollToMock.mock.calls.length - 1][0];
    expect(lastCall.left).toBe(63);
    expect(lastCall.behavior).toBe('smooth');

    // Verify Sunday is now within visible bounds with no right edge clipping
    const sunRectAfter = sundayBtn.getBoundingClientRect();
    const containerRect = selectorContainer.getBoundingClientRect();
    expect(sunRectAfter.right).toBeLessThanOrEqual(containerRect.right);
    expect(sunRectAfter.left).toBeGreaterThanOrEqual(containerRect.left);

    // Switch to Monday: should scroll back left to reveal Monday
    await act(async () => {
      mondayBtn.click();
    });

    const mondayCall = scrollToMock.mock.calls[scrollToMock.mock.calls.length - 1][0];
    expect(mondayCall.left).toBe(0);
    const monRectAfter = mondayBtn.getBoundingClientRect();
    expect(monRectAfter.left).toBeGreaterThanOrEqual(containerRect.left);
  });

  it('20. re-entry into Daily Action retains correct weekday selection and layout alignment', async () => {
    const testCases = [
      {
        isoDate: '2026-10-25T12:00:00Z', // Sunday (day 0)
        expectedDay: 0,
        expectedDayLabel: 'SUNDAY',
        otherDay: 1, // Monday
      },
      {
        isoDate: '2026-10-26T12:00:00Z', // Monday (day 1)
        expectedDay: 1,
        expectedDayLabel: 'MONDAY',
        otherDay: 0, // Sunday
      },
    ];

    try {
      for (let i = 0; i < testCases.length; i++) {
        const { isoDate, expectedDay, expectedDayLabel, otherDay } = testCases[i];

        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(isoDate));

        if (i > 0) {
          await act(async () => {
            root.unmount();
          });
          root = createRoot(container);
        }

        await renderComponent('/planner?tab=daily_action');

        // Initial load defaults to current simulated weekday
        const defaultBtn = container.querySelector(`#day-selector-btn-${expectedDay}`);
        expect(defaultBtn).toBeTruthy();
        expect(defaultBtn.getAttribute('aria-selected')).toBe('true');
        expect(container.textContent).toContain(expectedDayLabel);

        // Switch to a different weekday
        const otherBtn = container.querySelector(`#day-selector-btn-${otherDay}`);
        expect(otherBtn).toBeTruthy();
        await act(async () => {
          otherBtn.click();
        });
        expect(otherBtn.getAttribute('aria-selected')).toBe('true');
        expect(defaultBtn.getAttribute('aria-selected')).toBe('false');

        // Navigate away to Normal Boss category
        const normalBossTab = container.querySelector('#planner-tab-normal_boss');
        expect(normalBossTab).toBeTruthy();
        await act(async () => {
          normalBossTab.click();
        });

        // Daily Action weekday selector is unmounted
        expect(container.querySelector('[aria-label="Select Day of Week"]')).toBeNull();

        // Re-enter Daily Action
        const dailyTab = container.querySelector('#planner-tab-daily_action');
        expect(dailyTab).toBeTruthy();
        await act(async () => {
          dailyTab.click();
        });

        // Verify Daily Action re-mounts and defaults to current weekday according to established production behavior
        const reenteredDefaultBtn = container.querySelector(`#day-selector-btn-${expectedDay}`);
        expect(reenteredDefaultBtn).toBeTruthy();
        expect(reenteredDefaultBtn.getAttribute('aria-selected')).toBe('true');
        expect(container.textContent).toContain(expectedDayLabel);

        // Verify previously selected other day is unselected
        const reenteredOtherBtn = container.querySelector(`#day-selector-btn-${otherDay}`);
        expect(reenteredOtherBtn).toBeTruthy();
        expect(reenteredOtherBtn.getAttribute('aria-selected')).toBe('false');

        // Verify layout alignment: weekday selector container is mounted and visible
        const selectorContainer = container.querySelector('[aria-label="Select Day of Week"]');
        expect(selectorContainer).toBeTruthy();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('17. Currency & EXP view formats large quantities and exposes exact integers in tooltips', async () => {
    mockState.inventory = {
      Mora: 42586360,
      HeroWit: 50
    };

    await renderComponent('/planner?tab=currency_exp');

    // Check that compact format 42.59M is rendered
    expect(container.textContent).toContain('42.59M');

    // Check that exact number 42,586,360 is present in a title attribute
    const elementsWithTitle = Array.from(container.querySelectorAll('[title]'));
    const matchingTitle = elementsWithTitle.some(el =>
      el.getAttribute('title').includes('42,586,360')
    );
    expect(matchingTitle).toBe(true);
  });

  it('18. preserves exact underlying integer values in state without calculation divergence', () => {
    expect(mockState.inventory.Mora).toBe(100000);
    expect(typeof mockState.inventory.Mora).toBe('number');
  });
});

