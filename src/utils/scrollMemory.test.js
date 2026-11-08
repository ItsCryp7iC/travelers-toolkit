import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRouteKey,
  saveScrollPosition,
  getSavedScrollPosition,
  clearScrollMemory,
  getScrollMemorySnapshot,
  getCurrentScroll,
  getMaxScroll,
  performInstantScroll,
  startRestoration,
} from './scrollMemory';
import { PLANNER_TABS } from './plannerTabs';
import { INVENTORY_TABS } from './inventoryFilters';

describe('scrollMemory utilities', () => {
  beforeEach(() => {
    clearScrollMemory();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearScrollMemory();
  });

  describe('getRouteKey', () => {
    it('normalizes root and empty paths to "/"', () => {
      expect(getRouteKey('')).toBe('/');
      expect(getRouteKey('/')).toBe('/');
      expect(getRouteKey(null)).toBe('/');
      expect(getRouteKey(undefined)).toBe('/');
    });

    it('trims trailing slashes from pathnames', () => {
      expect(getRouteKey('/characters/')).toBe('/characters');
      expect(getRouteKey('/weapons///')).toBe('/weapons');
      expect(getRouteKey('/settings/')).toBe('/settings');
    });

    it('preserves nested paths correctly', () => {
      expect(getRouteKey('/settings/account')).toBe('/settings/account');
      expect(getRouteKey('/settings/account/')).toBe('/settings/account');
    });

    it('ignores non-tab query parameters on top-level routes', () => {
      expect(getRouteKey('/characters', '?search=Jean')).toBe('/characters');
      expect(getRouteKey('/weapons', '?rarity=5')).toBe('/weapons');
      expect(getRouteKey('/achievements', '?category=1')).toBe('/achievements');
    });

    describe('Planner tab-aware route keys', () => {
      it('maps default tab and explicit default tab to the same canonical key', () => {
        expect(getRouteKey('/planner')).toBe('/planner?tab=daily_action');
        expect(getRouteKey('/planner', '')).toBe('/planner?tab=daily_action');
        expect(getRouteKey('/planner', '?tab=daily_action')).toBe('/planner?tab=daily_action');
      });

      it('generates distinct keys for all 13 supported Planner categories', () => {
        const keys = new Set();
        for (const tab of PLANNER_TABS) {
          const key = getRouteKey('/planner', `?tab=${tab.id}`);
          expect(key).toBe(`/planner?tab=${tab.id}`);
          keys.add(key);
        }
        expect(keys.size).toBe(13);
        expect(PLANNER_TABS).toHaveLength(13);
      });

      it('falls back to daily_action for unknown or invalid Planner tabs', () => {
        expect(getRouteKey('/planner', '?tab=unknown_category')).toBe('/planner?tab=daily_action');
        expect(getRouteKey('/planner', '?tab=12345')).toBe('/planner?tab=daily_action');
        expect(getRouteKey('/planner', '?tab=')).toBe('/planner?tab=daily_action');
      });

      it('extracts canonical tab regardless of query parameter ordering or extra filters', () => {
        expect(getRouteKey('/planner', '?search=boss&tab=normal_boss&sort=asc')).toBe(
          '/planner?tab=normal_boss'
        );
        expect(getRouteKey('/planner', '?tab=normal_boss&search=boss')).toBe(
          '/planner?tab=normal_boss'
        );
      });
    });

    describe('Inventory tab-aware route keys', () => {
      it('maps default tab and explicit default tab to the same canonical key', () => {
        expect(getRouteKey('/inventory')).toBe('/inventory?tab=currency_exp');
        expect(getRouteKey('/inventory', '')).toBe('/inventory?tab=currency_exp');
        expect(getRouteKey('/inventory', '?tab=currency_exp')).toBe('/inventory?tab=currency_exp');
      });

      it('generates distinct keys for all Inventory categories', () => {
        const keys = new Set();
        for (const tab of INVENTORY_TABS) {
          const key = getRouteKey('/inventory', `?tab=${tab.id}`);
          expect(key).toBe(`/inventory?tab=${tab.id}`);
          keys.add(key);
        }
        expect(keys.size).toBe(INVENTORY_TABS.length);
      });

      it('correctly maps legacy Inventory tab aliases to their canonical equivalents', () => {
        expect(getRouteKey('/inventory', '?tab=boss_drops')).toBe('/inventory?tab=normal_boss');
        expect(getRouteKey('/inventory', '?tab=enemy_drops')).toBe('/inventory?tab=common_mats');
        expect(getRouteKey('/inventory', '?tab=forging_mats')).toBe('/inventory?tab=billet');
      });

      it('falls back to currency_exp for unknown or invalid Inventory tabs', () => {
        expect(getRouteKey('/inventory', '?tab=not_a_real_tab')).toBe('/inventory?tab=currency_exp');
        expect(getRouteKey('/inventory', '?tab=')).toBe('/inventory?tab=currency_exp');
      });

      it('extracts canonical tab regardless of query parameter ordering', () => {
        expect(getRouteKey('/inventory', '?filter=owned&tab=weekly_boss')).toBe(
          '/inventory?tab=weekly_boss'
        );
        expect(getRouteKey('/inventory', '?tab=weekly_boss&filter=owned')).toBe(
          '/inventory?tab=weekly_boss'
        );
      });
    });
  });

  describe('saveScrollPosition & getSavedScrollPosition', () => {
    it('returns undefined for unvisited routes', () => {
      expect(getSavedScrollPosition('/characters')).toBeUndefined();
    });

    it('stores and retrieves normalized coordinates', () => {
      saveScrollPosition('/characters', { x: 0, y: 450 });
      expect(getSavedScrollPosition('/characters')).toEqual({ x: 0, y: 450 });
    });

    it('handles negative or invalid numbers by clamping to 0', () => {
      saveScrollPosition('/weapons', { x: -50, y: NaN });
      expect(getSavedScrollPosition('/weapons')).toEqual({ x: 0, y: 0 });
    });

    it('clears all memory when clearScrollMemory is called', () => {
      saveScrollPosition('/characters', { x: 0, y: 400 });
      saveScrollPosition('/weapons', { x: 0, y: 800 });
      expect(Object.keys(getScrollMemorySnapshot())).toHaveLength(2);
      clearScrollMemory();
      expect(Object.keys(getScrollMemorySnapshot())).toHaveLength(0);
      expect(getSavedScrollPosition('/characters')).toBeUndefined();
    });
  });

  describe('getCurrentScroll & getMaxScroll', () => {
    it('reads current scroll position from window / documentElement', () => {
      Object.defineProperty(window, 'scrollY', { value: 320, writable: true, configurable: true });
      Object.defineProperty(window, 'scrollX', { value: 15, writable: true, configurable: true });
      const current = getCurrentScroll();
      expect(current.y).toBe(320);
      expect(current.x).toBe(15);
    });

    it('computes maximum scrollable bounds based on scrollHeight and clientHeight', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: 1500,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 600,
        writable: true,
        configurable: true,
      });
      const bounds = getMaxScroll();
      expect(bounds.maxY).toBe(900); // 1500 - 600
    });
  });

  describe('performInstantScroll', () => {
    it('temporarily resets root scroll-behavior and calls scrollTo', () => {
      const scrollToMock = vi.fn();
      window.scrollTo = scrollToMock;
      document.documentElement.style.scrollBehavior = 'smooth';

      performInstantScroll(0, 500);

      expect(scrollToMock).toHaveBeenCalledWith({ top: 500, left: 0, behavior: 'instant' });
      // Restores smooth behavior after instant call
      expect(document.documentElement.style.scrollBehavior).toBe('smooth');
    });

    it('updates scrollTop directly if window.scrollTo is unavailable or throws', () => {
      window.scrollTo = () => {
        throw new Error('Not implemented');
      };
      performInstantScroll(0, 350);
      expect(document.documentElement.scrollTop).toBe(350);
    });
  });

  describe('startRestoration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.scrollTo = vi.fn();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('immediately finishes if targetY is 0', () => {
      const onComplete = vi.fn();
      const cancel = startRestoration({ targetX: 0, targetY: 0, onComplete });
      expect(onComplete).toHaveBeenCalled();
      cancel();
    });

    it('immediately finishes if destination container is already tall enough', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: 2000,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 800,
        writable: true,
        configurable: true,
      });

      const onComplete = vi.fn();
      const cancel = startRestoration({ targetX: 0, targetY: 600, onComplete });
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 600, left: 0, behavior: 'instant' });
      expect(onComplete).toHaveBeenCalled();
      cancel();
    });

    it('waits for content expansion and completes when height becomes sufficient', () => {
      let currentHeight = 500;
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        get: () => currentHeight,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 500,
        configurable: true,
      });

      const onComplete = vi.fn();
      const cancel = startRestoration({ targetX: 0, targetY: 700, onComplete });

      // Initially max scroll is 0 (< 700), so it does not complete yet
      expect(onComplete).not.toHaveBeenCalled();

      // Content expands (e.g. data renders)
      currentHeight = 2000;
      // Advance timers/frames
      vi.advanceTimersByTime(50);

      // Now satisfied
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 700, left: 0, behavior: 'instant' });
      cancel();
    });

    it('clamps to maximum available height after 500ms timeout if page is shorter', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: 1000,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 600,
        writable: true,
        configurable: true,
      });

      const onComplete = vi.fn();
      startRestoration({ targetX: 0, targetY: 900, onComplete });

      // Before timeout
      expect(onComplete).not.toHaveBeenCalled();

      // Advance timeout to 500ms
      vi.advanceTimersByTime(550);

      // Clamped to max available height (1000 - 600 = 400)
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 400, left: 0, behavior: 'instant' });
      expect(onComplete).toHaveBeenCalled();
    });

    it('aborts restoration immediately if user scrolls with wheel or touch', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: 500,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 500,
        configurable: true,
      });

      const onComplete = vi.fn();
      startRestoration({ targetX: 0, targetY: 800, onComplete });

      // User scrolls mouse wheel
      window.dispatchEvent(new Event('wheel'));

      expect(onComplete).toHaveBeenCalled();
    });
  });
});
