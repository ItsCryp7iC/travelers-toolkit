import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import ScrollManager from './ScrollManager';
import {
  clearScrollMemory,
  getSavedScrollPosition,
  saveScrollPosition,
  getScrollMemorySnapshot,
} from '../utils/scrollMemory';
import { PLANNER_TABS, getPlannerTabId } from '../utils/plannerTabs';
import { getInventoryTabId } from '../utils/inventoryFilters';
import { acquireBodyScrollLock, resetBodyScrollLockForTesting } from '../utils/scrollLock';

function NavigationBar() {
  const navigate = useNavigate();
  return (
    <nav data-testid="nav-controls">
      <button onClick={() => navigate('/characters')}>To Characters</button>
      <button onClick={() => navigate('/weapons')}>To Weapons</button>

      {/* Planner Controls */}
      <button onClick={() => navigate('/planner')}>To Planner Default</button>
      <button onClick={() => navigate('/planner?tab=daily_action')}>To Planner Daily Action</button>
      <button onClick={() => navigate('/planner?tab=normal_boss')}>To Planner Normal Boss</button>
      <button onClick={() => navigate('/planner?tab=weekly_boss')}>To Planner Weekly Boss</button>
      <button onClick={() => navigate('/planner?tab=talent')}>To Planner Talent</button>
      <button onClick={() => navigate('/planner?search=ruin&tab=normal_boss')}>To Planner Normal Boss Search</button>
      <button onClick={() => navigate('/planner?tab=nonexistent_tab')}>To Planner Invalid Tab</button>

      {/* Inventory Controls */}
      <button onClick={() => navigate('/inventory')}>To Inventory Default</button>
      <button onClick={() => navigate('/inventory?tab=currency_exp')}>To Inventory Currency</button>
      <button onClick={() => navigate('/inventory?tab=normal_boss')}>To Inventory Normal Boss</button>
      <button onClick={() => navigate('/inventory?tab=weekly_boss')}>To Inventory Weekly Boss</button>
      <button onClick={() => navigate('/inventory?tab=talent_mats')}>To Inventory Talent Mats</button>
      <button onClick={() => navigate('/inventory?tab=boss_drops')}>To Inventory Boss Drops Alias</button>
      <button onClick={() => navigate('/inventory?tab=invalid_inv_tab')}>To Inventory Invalid Tab</button>

      <button onClick={() => navigate('/')}>To Dashboard</button>
      <button onClick={() => navigate('/achievements')}>To Achievements</button>
      <button onClick={() => navigate(-1)}>History Back</button>
      <button onClick={() => navigate(1)}>History Forward</button>
    </nav>
  );
}

function MockCharactersPage() {
  const [viewMode, setViewMode] = useState('table');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div data-testid="characters-page" style={{ minHeight: '2000px' }}>
      <h1>My Roster</h1>
      <button onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}>
        Toggle View Mode ({viewMode})
      </button>
      <button onClick={() => setModalOpen(true)}>Open Modal</button>
      {modalOpen && (
        <div role="dialog" aria-modal="true" data-testid="character-modal">
          <div data-testid="modal-content" style={{ overflowY: 'auto', maxHeight: '300px' }}>
            <p>Modal body content</p>
          </div>
          <button onClick={() => setModalOpen(false)}>Close Modal</button>
        </div>
      )}
    </div>
  );
}

function MockWeaponsPage({ initialHeight = 2500 }) {
  const [height, setHeight] = useState(initialHeight);
  return (
    <div data-testid="weapons-page" style={{ minHeight: `${height}px` }}>
      <h1>My Armory</h1>
      <button onClick={() => setHeight(3000)}>Expand Armory</button>
      <button onClick={() => setHeight(500)}>Shrink Armory</button>
    </div>
  );
}

function MockPlannerPage() {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = getPlannerTabId(rawTab);
  const [modalOpen, setModalOpen] = useState(false);

  // Different heights based on tab
  const tabHeight = activeTab === 'weekly_boss' ? 2800 : activeTab === 'normal_boss' ? 2200 : 1600;

  return (
    <div data-testid={`planner-page-${activeTab}`} style={{ minHeight: `${tabHeight}px` }}>
      <h1>Resource Planner — {activeTab}</h1>
      <button onClick={() => setModalOpen(true)}>Open Planner Modal</button>
      {modalOpen && (
        <div role="dialog" aria-modal="true" data-testid="planner-modal">
          <button onClick={() => setModalOpen(false)}>Close Planner Modal</button>
        </div>
      )}
    </div>
  );
}

function MockInventoryPage() {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = getInventoryTabId(rawTab);

  const tabHeight = activeTab === 'weekly_boss' ? 2600 : activeTab === 'normal_boss' ? 2100 : 1500;

  return (
    <div data-testid={`inventory-page-${activeTab}`} style={{ minHeight: `${tabHeight}px` }}>
      <h1>Inventory — {activeTab}</h1>
    </div>
  );
}

function MockDashboardPage() {
  return (
    <div data-testid="dashboard-page" style={{ minHeight: '1200px' }}>
      <h1>Dashboard</h1>
    </div>
  );
}

function TestHarness({ initialEntries = ['/characters'] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ScrollManager />
      <NavigationBar />
      <main id="page-content">
        <Routes>
          <Route path="/" element={<MockDashboardPage />} />
          <Route path="/characters" element={<MockCharactersPage />} />
          <Route path="/weapons" element={<MockWeaponsPage />} />
          <Route path="/planner" element={<MockPlannerPage />} />
          <Route path="/inventory" element={<MockInventoryPage />} />
          <Route path="/achievements" element={<div data-testid="achievements-page" style={{ minHeight: '1500px' }}>Achievements</div>} />
        </Routes>
      </main>
    </MemoryRouter>
  );
}

describe('ScrollManager Navigation UX & Tab-Aware Scroll Memory (R2)', () => {
  let originalScrollTo;
  let scrollToSpy;

  beforeEach(() => {
    clearScrollMemory();
    resetBodyScrollLockForTesting();

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 3000,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollX', {
      value: 0,
      writable: true,
      configurable: true,
    });

    originalScrollTo = window.scrollTo;
    scrollToSpy = vi.fn((opts) => {
      const top = typeof opts === 'object' && opts !== null ? opts.top : opts;
      window.scrollY = typeof top === 'number' ? top : 0;
    });
    window.scrollTo = scrollToSpy;
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
    clearScrollMemory();
    resetBodyScrollLockForTesting();
    vi.restoreAllMocks();
  });

  function simulateScroll(y, x = 0) {
    act(() => {
      window.scrollY = y;
      window.scrollX = x;
      window.dispatchEvent(new Event('scroll'));
    });
  }

  // 1. Planner: Normal Boss middle → Weekly Boss first visit → top
  it('1. Scrolling Planner Normal Boss to middle and opening Weekly Boss for the first time opens at 0', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    expect(await screen.findByTestId('planner-page-normal_boss')).toBeInTheDocument();

    simulateScroll(600);
    expect(getSavedScrollPosition('/planner?tab=normal_boss')).toEqual({ x: 0, y: 600 });

    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    expect(await screen.findByTestId('planner-page-weekly_boss')).toBeInTheDocument();

    expect(window.scrollY).toBe(0);
    expect(getSavedScrollPosition('/planner?tab=weekly_boss')).toEqual({ x: 0, y: 0 });
  });

  // 2. Planner: Weekly Boss bottom → Normal Boss → middle
  it('2. Scrolling Weekly Boss to bottom and switching back to Normal Boss restores middle position', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);

    simulateScroll(600);
    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    expect(await screen.findByTestId('planner-page-weekly_boss')).toBeInTheDocument();

    simulateScroll(1500);
    expect(getSavedScrollPosition('/planner?tab=weekly_boss')).toEqual({ x: 0, y: 1500 });

    fireEvent.click(screen.getByText('To Planner Normal Boss'));
    expect(await screen.findByTestId('planner-page-normal_boss')).toBeInTheDocument();

    expect(window.scrollY).toBe(600);
  });

  // 3. Planner: Return to Weekly Boss → bottom
  it('3. Returning to Weekly Boss restores its previously saved bottom position', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);

    simulateScroll(600);
    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    simulateScroll(1500);

    fireEvent.click(screen.getByText('To Planner Normal Boss'));
    expect(window.scrollY).toBe(600);

    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    expect(await screen.findByTestId('planner-page-weekly_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(1500);
  });

  // 4. All 13 Planner categories have distinct keys
  it('4. All 13 Planner categories maintain distinct scroll positions without collision', () => {
    expect(PLANNER_TABS).toHaveLength(13);
    PLANNER_TABS.forEach((tab, index) => {
      saveScrollPosition(`/planner?tab=${tab.id}`, { x: 0, y: (index + 1) * 100 });
    });

    const snapshot = getScrollMemorySnapshot();
    PLANNER_TABS.forEach((tab, index) => {
      expect(snapshot[`/planner?tab=${tab.id}`]).toEqual({ x: 0, y: (index + 1) * 100 });
    });
  });

  // 5. Inventory categories have distinct keys
  it('5. Inventory categories maintain distinct scroll positions across internal tabs', async () => {
    render(<TestHarness initialEntries={['/inventory?tab=currency_exp']} />);
    expect(await screen.findByTestId('inventory-page-currency_exp')).toBeInTheDocument();

    simulateScroll(350);
    expect(getSavedScrollPosition('/inventory?tab=currency_exp')).toEqual({ x: 0, y: 350 });

    fireEvent.click(screen.getByText('To Inventory Normal Boss'));
    expect(await screen.findByTestId('inventory-page-normal_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(0);

    simulateScroll(800);
    fireEvent.click(screen.getByText('To Inventory Weekly Boss'));
    expect(await screen.findByTestId('inventory-page-weekly_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(0);

    simulateScroll(1200);

    // Return to Currency
    fireEvent.click(screen.getByText('To Inventory Currency'));
    expect(window.scrollY).toBe(350);

    // Return to Normal Boss
    fireEvent.click(screen.getByText('To Inventory Normal Boss'));
    expect(window.scrollY).toBe(800);

    // Return to Weekly Boss
    fireEvent.click(screen.getByText('To Inventory Weekly Boss'));
    expect(window.scrollY).toBe(1200);
  });

  // 6. Default tab and explicit default tab share one key
  it('6. Default tab and explicit default tab share identical scroll memory', async () => {
    render(<TestHarness initialEntries={['/planner']} />);
    expect(await screen.findByTestId('planner-page-daily_action')).toBeInTheDocument();

    simulateScroll(450);

    // Navigate to explicit /planner?tab=daily_action
    fireEvent.click(screen.getByText('To Planner Daily Action'));
    expect(window.scrollY).toBe(450);
    expect(getSavedScrollPosition('/planner?tab=daily_action')).toEqual({ x: 0, y: 450 });

    // Inventory default sharing
    fireEvent.click(screen.getByText('To Inventory Default'));
    expect(await screen.findByTestId('inventory-page-currency_exp')).toBeInTheDocument();
    simulateScroll(520);

    fireEvent.click(screen.getByText('To Inventory Currency'));
    expect(window.scrollY).toBe(520);
    expect(getSavedScrollPosition('/inventory?tab=currency_exp')).toEqual({ x: 0, y: 520 });
  });

  // 7. Invalid tab values use the documented fallback
  it('7. Invalid tab values cleanly fallback to documented canonical default tabs', async () => {
    render(<TestHarness initialEntries={['/planner?tab=daily_action']} />);
    simulateScroll(400);

    // Invalid planner tab -> daily_action
    fireEvent.click(screen.getByText('To Planner Invalid Tab'));
    expect(await screen.findByTestId('planner-page-daily_action')).toBeInTheDocument();
    expect(window.scrollY).toBe(400);

    // Legacy inventory alias -> normal_boss
    saveScrollPosition('/inventory?tab=normal_boss', { x: 0, y: 770 });
    fireEvent.click(screen.getByText('To Inventory Boss Drops Alias'));
    expect(await screen.findByTestId('inventory-page-normal_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(770);
  });

  // 8. Query parameter ordering does not change identity
  it('8. Query parameter ordering does not alter tab scroll identity', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    simulateScroll(650);

    // Navigate to reordered params (/planner?search=ruin&tab=normal_boss)
    fireEvent.click(screen.getByText('To Planner Normal Boss Search'));
    expect(window.scrollY).toBe(650);
    expect(getSavedScrollPosition('/planner?tab=normal_boss')).toEqual({ x: 0, y: 650 });
  });

  // 9. Search/filter changes preserve the current tab's scroll
  it('9. Filter and search updates within the active tab preserve its scroll position', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    simulateScroll(580);

    fireEvent.click(screen.getByText('To Planner Normal Boss Search'));
    expect(window.scrollY).toBe(580);
  });

  // 10. Planner tabs switched rapidly
  it('10. Handles rapid Planner tab switching without race conditions or memory corruption', async () => {
    render(<TestHarness initialEntries={['/planner?tab=daily_action']} />);
    simulateScroll(300);

    fireEvent.click(screen.getByText('To Planner Normal Boss'));
    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    fireEvent.click(screen.getByText('To Planner Talent'));

    expect(await screen.findByTestId('planner-page-talent')).toBeInTheDocument();
    expect(window.scrollY).toBe(0);

    expect(getSavedScrollPosition('/planner?tab=daily_action')).toEqual({ x: 0, y: 300 });
  });

  // 11. Inventory tabs switched rapidly
  it('11. Handles rapid Inventory tab switching without memory contamination', async () => {
    render(<TestHarness initialEntries={['/inventory?tab=currency_exp']} />);
    simulateScroll(250);

    fireEvent.click(screen.getByText('To Inventory Normal Boss'));
    fireEvent.click(screen.getByText('To Inventory Weekly Boss'));
    fireEvent.click(screen.getByText('To Inventory Talent Mats'));

    expect(await screen.findByTestId('inventory-page-talent_mats')).toBeInTheDocument();
    expect(window.scrollY).toBe(0);

    expect(getSavedScrollPosition('/inventory?tab=currency_exp')).toEqual({ x: 0, y: 250 });
  });

  // 12. Browser Back/Forward between internal tabs
  it('12. Browser Back and Forward accurately traverses internal Planner and Inventory tabs', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    simulateScroll(500);

    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    simulateScroll(1100);

    fireEvent.click(screen.getByText('To Planner Talent'));
    simulateScroll(400);

    // History Back -> Weekly Boss
    fireEvent.click(screen.getByText('History Back'));
    expect(await screen.findByTestId('planner-page-weekly_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(1100);

    // History Back -> Normal Boss
    fireEvent.click(screen.getByText('History Back'));
    expect(await screen.findByTestId('planner-page-normal_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(500);

    // History Forward -> Weekly Boss
    fireEvent.click(screen.getByText('History Forward'));
    expect(await screen.findByTestId('planner-page-weekly_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(1100);
  });

  // 13. Direct tab URL navigation
  it('13. Starting directly on an internal tab URL begins cleanly at the top', async () => {
    render(<TestHarness initialEntries={['/planner?tab=weekly_boss']} />);
    expect(await screen.findByTestId('planner-page-weekly_boss')).toBeInTheDocument();
    expect(window.scrollY).toBe(0);
    expect(getSavedScrollPosition('/planner?tab=weekly_boss')).toEqual({ x: 0, y: 0 });
  });

  // 14. Dynamic content-height changes
  it('14. Automatically restores target position when dynamic content expands on tab switch', async () => {
    vi.useFakeTimers();
    render(<TestHarness initialEntries={['/planner?tab=weekly_boss']} />);
    saveScrollPosition('/planner?tab=weekly_boss', { x: 0, y: 1200 });

    fireEvent.click(screen.getByText('To Characters'));

    let dynamicHeight = 700;
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => dynamicHeight,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    });

    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    expect(window.scrollY).toBe(0);

    // Expand
    dynamicHeight = 2800;
    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(window.scrollY).toBe(1200);
    vi.useRealTimers();
  });

  // 15. Short and tall tabs
  it('15. Switching to a short tab does not corrupt or clamp the remembered position of a tall tab', async () => {
    render(<TestHarness initialEntries={['/planner?tab=weekly_boss']} />);
    // Tall tab scrolled to 1800
    simulateScroll(1800);
    expect(getSavedScrollPosition('/planner?tab=weekly_boss')).toEqual({ x: 0, y: 1800 });

    // Switch to short tab
    fireEvent.click(screen.getByText('To Planner Daily Action'));
    expect(await screen.findByTestId('planner-page-daily_action')).toBeInTheDocument();
    simulateScroll(100);

    // Tall tab's saved position must remain 1800
    expect(getSavedScrollPosition('/planner?tab=weekly_boss')).toEqual({ x: 0, y: 1800 });
  });

  // 16. No scroll-memory leakage to top-level routes
  it('16. Tab-level scroll memory is strictly isolated from top-level routes', async () => {
    render(<TestHarness initialEntries={['/characters']} />);
    simulateScroll(450);

    fireEvent.click(screen.getByText('To Planner Normal Boss'));
    simulateScroll(950);

    fireEvent.click(screen.getByText('To Inventory Currency'));
    simulateScroll(700);

    const snapshot = getScrollMemorySnapshot();
    expect(snapshot['/characters']).toEqual({ x: 0, y: 450 });
    expect(snapshot['/planner?tab=normal_boss']).toEqual({ x: 0, y: 950 });
    expect(snapshot['/inventory?tab=currency_exp']).toEqual({ x: 0, y: 700 });
  });

  // 17. Mobile layout and navigation
  it('17. Operates accurately under mobile viewport constraints', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, configurable: true });

    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    simulateScroll(520);
    expect(getSavedScrollPosition('/planner?tab=normal_boss')).toEqual({ x: 0, y: 520 });

    fireEvent.click(screen.getByText('To Planner Weekly Boss'));
    expect(window.scrollY).toBe(0);

    fireEvent.click(screen.getByText('To Planner Normal Boss'));
    expect(window.scrollY).toBe(520);
  });

  // 18. Modal opening/closing
  it('18. Opening and closing modals within tabs preserves tab scroll memory', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    simulateScroll(640);

    fireEvent.click(screen.getByText('Open Planner Modal'));
    expect(await screen.findByTestId('planner-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Planner Modal'));
    expect(screen.queryByTestId('planner-modal')).not.toBeInTheDocument();

    expect(window.scrollY).toBe(640);
    expect(getSavedScrollPosition('/planner?tab=normal_boss')).toEqual({ x: 0, y: 640 });
  });

  // 19. Existing Responsive R7 scroll-lock behavior
  it('19. Scroll events are ignored while body scroll lock is active', async () => {
    render(<TestHarness initialEntries={['/planner?tab=normal_boss']} />);
    simulateScroll(500);

    const releaseLock = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe('hidden');

    window.scrollY = 0;
    window.dispatchEvent(new Event('scroll'));

    expect(getSavedScrollPosition('/planner?tab=normal_boss')).toEqual({ x: 0, y: 500 });

    releaseLock();
    expect(document.body.style.overflow).toBe('');
  });

  // 20. Existing top-level scroll-memory regression suite
  it('20. Preserves top-level scroll memory flow across Characters, Weapons, and Dashboard', async () => {
    render(<TestHarness initialEntries={['/characters']} />);

    simulateScroll(550);
    fireEvent.click(screen.getByText('To Weapons'));
    expect(window.scrollY).toBe(0);

    simulateScroll(1400);
    fireEvent.click(screen.getByText('To Characters'));
    expect(window.scrollY).toBe(550);

    fireEvent.click(screen.getByText('To Weapons'));
    expect(window.scrollY).toBe(1400);

    fireEvent.click(screen.getByText('To Dashboard'));
    expect(window.scrollY).toBe(0);
  });
});
