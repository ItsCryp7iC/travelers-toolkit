import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import useStore from '../store/useStore';
import useCraftingSessionStore from '../store/useCraftingSessionStore';
import { recordActivity } from './activityLogger';
import { clearActivityHistory, getActivityEvents } from './activityStore';
import { ACTIVITY_STORAGE_KEY } from './activityTypes';

const getDomainState = () => useStore.getState() as any;

describe('Activity History — Critical Isolation Invariant Tests', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearActivityHistory();
    getDomainState().resetStore();
    useCraftingSessionStore.getState().discardSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recording an activity event does NOT touch travelers-toolkit-store on disk', () => {
    // 1. Set some domain state in useStore
    getDomainState().setInventory('SlimeCondensate', 500);

    // Initial localStorage has travelers-toolkit-store
    const domainRawBefore = window.localStorage.getItem(
      'travelers-toolkit-store'
    );

    // 2. Record an activity event
    const recordRes = recordActivity({
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      entityType: 'material',
      entityId: 'SlimeCondensate',
      summary: 'Slime Condensate updated to 500.',
    });

    expect(recordRes.success).toBe(true);

    // 3. Verify activity was written to its dedicated key
    const activityRaw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    expect(activityRaw).not.toBeNull();
    expect(activityRaw).toContain('Slime Condensate updated to 500.');

    // 4. Invariant: travelers-toolkit-store was NOT touched or corrupted by activity logging!
    const domainRawAfter = window.localStorage.getItem(
      'travelers-toolkit-store'
    );
    expect(domainRawAfter).toBe(domainRawBefore);
  });

  it('recording an activity event does NOT mutate domain state or active crafting session', () => {
    // 1. Setup roster, weapon, and crafting session
    getDomainState().addCharacter('Amber');
    getDomainState().addTrackedWeapon('Favonius Bow', 'Amber');
    getDomainState().setInventory('Mora', 100000);

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100 },
      startingMora: 100000,
    });

    const rosterBefore = JSON.stringify(getDomainState().roster);
    const weaponsBefore = JSON.stringify(getDomainState().trackedWeapons);
    const inventoryBefore = JSON.stringify(getDomainState().inventory);
    const sessionBefore = JSON.stringify(
      useCraftingSessionStore.getState().session
    );

    // 2. Record 10 activity events across various categories
    for (let i = 1; i <= 10; i++) {
      recordActivity({
        category: 'achievements',
        action: 'achievement_completed',
        source: 'achievements_page',
        entityId: `ach_${i}`,
        summary: `Achievement ${i} completed.`,
      });
    }

    expect(getActivityEvents()).toHaveLength(10);

    // 3. Invariant: All domain state remains 100% byte-for-byte identical!
    expect(JSON.stringify(getDomainState().roster)).toBe(rosterBefore);
    expect(JSON.stringify(getDomainState().trackedWeapons)).toBe(weaponsBefore);
    expect(JSON.stringify(getDomainState().inventory)).toBe(inventoryBefore);
    expect(JSON.stringify(useCraftingSessionStore.getState().session)).toBe(
      sessionBefore
    );
  });

  it('a failure in activity storage does NOT roll back or cause domain mutation to fail', () => {
    // Mock Storage.prototype.setItem so ACTIVITY_STORAGE_KEY throws, but other keys succeed
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      val: string
    ) {
      if (key === ACTIVITY_STORAGE_KEY) {
        throw new DOMException('Simulated disk failure', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, val);
    });

    // 1. Perform domain mutation
    getDomainState().setInventory('Mora', 999999);
    expect(getDomainState().inventory['Mora']).toBe(999999);

    // 2. Attempt to log the activity event
    const logResult = recordActivity({
      category: 'inventory',
      action: 'inventory_updated',
      source: 'inventory_page',
      summary: 'Mora updated to 999,999.',
    });

    // Logging failed as expected due to mocked storage failure
    expect(logResult.success).toBe(false);
    expect(logResult.status).toBe('quota_exceeded');

    // 3. CRITICAL INVARIANT: The domain inventory mutation remains 100% successful and intact!
    expect(useStore.getState().inventory['Mora']).toBe(999999);
  });
});
