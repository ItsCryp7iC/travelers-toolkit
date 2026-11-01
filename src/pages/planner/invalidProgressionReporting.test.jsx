import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Planner from '../Planner';
import Characters from '../Characters';
import Weapons from '../Weapons';
import useStore from '../../store/useStore';

vi.mock('../../store/useStore');

// Mock modals to prevent rendering complexity in table/planner tests
vi.mock('../../components/CharacterModal', () => ({
  default: () => null,
}));
vi.mock('../../components/AddCharacterModal', () => ({
  default: () => null,
}));
vi.mock('../../components/BulkEditCharacterModal', () => ({
  default: () => null,
}));
vi.mock('../../components/HoyolabSyncPreviewModal', () => ({
  default: () => null,
}));
vi.mock('../../components/WeaponModal', () => ({
  default: () => null,
}));
vi.mock('../../components/AddWeaponModal', () => ({
  default: () => null,
}));
vi.mock('../../components/BulkEditWeaponModal', () => ({
  default: () => null,
}));
vi.mock('../../components/BatchAddWeaponModal', () => ({
  default: () => null,
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

describe('Phase C2B.2A.2 — Partial Calculation Visibility & Invalid Progression Reporting', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    setMatchMedia(false); // Default to desktop view
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

  const renderPlanner = async (initialUrl = '/planner?tab=daily_action') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialUrl]}>
          <Planner />
        </MemoryRouter>
      );
    });
  };

  const renderCharacters = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/characters']}>
          <Characters />
        </MemoryRouter>
      );
    });
  };

  const renderWeapons = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/weapons']}>
          <Weapons />
        </MemoryRouter>
      );
    });
  };

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: ALL-VALID PLANNER SHOWING NO WARNING
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 1: All-valid Planner showing no warning', async () => {
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
          element: 'Pyro',
        },
      },
      trackedWeapons: [
        {
          id: 'w-fav-1',
          weapon_id: 'FavoniusWarbow',
          weaponName: 'Favonius Warbow',
          level: 1,
          targetLevel: 80,
          ascension: 0,
          targetAscension: 5,
        },
      ],
      inventory: { Mora: 500000 },
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain('Some progression records are invalid');
    expect(container.textContent).not.toContain('View Affected Records');
    expect(container.textContent).toContain('Resources across 1 character plan and 1 weapon plan — inventory subtracted');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: ONE INVALID CHARACTER AMONG VALID CHARACTERS
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 2: One invalid character among valid characters (renders warning, lists name, lists reason)', async () => {
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
          element: 'Pyro',
        },
        'Kuki Shinobu': {
          name: 'Kuki Shinobu',
          level: 1,
          targetLevel: 80,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
          element: 'Electro',
        },
      },
      trackedWeapons: [],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Some progression records are invalid. Resource totals are incomplete.');
    expect(alert.textContent).toContain('1 record has invalid level or ascension combinations and was excluded from calculations.');

    // Expandable toggle button
    const toggleBtn = container.querySelector('button[aria-controls="planner-invalid-records-list"]');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.textContent).toContain('View Affected Records ▼');

    // Click to expand
    await act(async () => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.textContent).toContain('Hide Affected Records ▲');

    const detailsList = container.querySelector('#planner-invalid-records-list');
    expect(detailsList).not.toBeNull();
    expect(detailsList.textContent).toContain('Kuki Shinobu');
    expect(detailsList.textContent).toContain('Ascension 6 is invalid for level 1');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: ONE INVALID WEAPON AMONG VALID WEAPONS
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 3: One invalid weapon among valid weapons (renders warning, lists name, lists reason)', async () => {
    mockState = {
      roster: {
        Amber: {
          name: 'Amber',
          level: 90,
          targetLevel: 90,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          targetTalents: { normal: 10, skill: 10, burst: 10 },
          element: 'Pyro',
        },
      },
      trackedWeapons: [
        {
          id: 'w-fav-1',
          weapon_id: 'FavoniusWarbow',
          weaponName: 'Favonius Warbow',
          level: 1,
          targetLevel: 80,
          ascension: 0,
          targetAscension: 5,
        },
        {
          id: 'w-dull-1',
          weapon_id: 'DullBlade',
          weaponName: 'Dull Blade',
          level: 1,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
        },
      ],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Some progression records are invalid. Resource totals are incomplete.');
    expect(alert.textContent).toContain('1 record has invalid level or ascension combinations');

    const toggleBtn = container.querySelector('button[aria-controls="planner-invalid-records-list"]');
    await act(async () => {
      toggleBtn.click();
    });

    const detailsList = container.querySelector('#planner-invalid-records-list');
    expect(detailsList).not.toBeNull();
    expect(detailsList.textContent).toContain('Dull Blade');
    expect(detailsList.textContent).toContain('Ascension 4 is invalid for level 1');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: MULTIPLE INVALID RECORDS WITH CORRECT COUNTS & EXPANDABLE TOGGLE
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 4: Multiple invalid records with correct counts and toggle expand/collapse', async () => {
    mockState = {
      roster: {
        'Kuki Shinobu': {
          name: 'Kuki Shinobu',
          level: 1,
          targetLevel: 80,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
          element: 'Electro',
        },
        Sayu: {
          name: 'Sayu',
          level: 20,
          targetLevel: 20,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
          element: 'Anemo',
        },
      },
      trackedWeapons: [
        {
          id: 'w-dull-1',
          weapon_id: 'DullBlade',
          weaponName: 'Dull Blade',
          level: 1,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
        },
      ],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('3 records have invalid level or ascension combinations and were excluded from calculations.');

    const toggleBtn = container.querySelector('button[aria-controls="planner-invalid-records-list"]');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    // Expand
    await act(async () => {
      toggleBtn.click();
    });
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#planner-invalid-records-list')).not.toBeNull();
    expect(container.textContent).toContain('Affected Characters & Weapons (3):');
    expect(container.textContent).toContain('Kuki Shinobu');
    expect(container.textContent).toContain('Sayu');
    expect(container.textContent).toContain('Dull Blade');

    // Collapse
    await act(async () => {
      toggleBtn.click();
    });
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#planner-invalid-records-list')).toBeNull();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: MIXED VALID/INVALID DEMAND PRESERVING VALID TOTALS
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 5: Mixed valid/invalid demand preserving valid totals exactly', async () => {
    // Phase 1: Pure valid Amber
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
          element: 'Pyro',
        },
      },
      trackedWeapons: [],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();
    const validOnlyContent = container.textContent;
    expect(validOnlyContent).toContain('Active Character Plans');
    expect(container.querySelector('[role="alert"]')).toBeNull();

    // Phase 2: Add invalid Kuki Shinobu and invalid Dull Blade
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
          element: 'Pyro',
        },
        'Kuki Shinobu': {
          name: 'Kuki Shinobu',
          level: 1,
          targetLevel: 80,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
          element: 'Electro',
        },
      },
      trackedWeapons: [
        {
          id: 'w-dull-1',
          weapon_id: 'DullBlade',
          weaponName: 'Dull Blade',
          level: 1,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
        },
      ],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    // The alert banner must show 2 invalid records
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('2 records have invalid level or ascension combinations');

    // The active character plans must still be 1 (only Amber is valid active plan)
    expect(container.textContent).toContain('Active Character Plans');
    expect(container.textContent).toContain('Resources across 1 character plan — inventory subtracted');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: ZERO VALID ACTIVE PLANS PLUS INVALID RECORDS
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 6: Zero valid active plans plus invalid records does not say "No outstanding upgrade plans"', async () => {
    mockState = {
      roster: {
        Sayu: {
          name: 'Sayu',
          level: 20,
          targetLevel: 20,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
          element: 'Anemo',
        },
      },
      trackedWeapons: [],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    // Must NOT say "No outstanding upgrade plans"
    expect(container.textContent).not.toContain('No outstanding upgrade plans');
    // Must clearly indicate the excluded invalid record
    expect(container.textContent).toContain('1 invalid progression record excluded from planning');
    // Alert banner must be rendered
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: ROSTER ROW WITH INVALID PROGRESSION
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 7: Roster row with invalid progression renders warning badge and unavailable cells', async () => {
    mockState = {
      roster: {
        'Kuki Shinobu': {
          level: 1,
          targetLevel: 80,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
          priority: 3,
          equippedWeaponId: null,
        },
      },
      trackedWeapons: [],
      inventory: {},
      updateCharacter: vi.fn(),
      removeCharacter: vi.fn(),
      batchRemoveCharacters: vi.fn(),
      bulkUpdateCharacters: vi.fn(),
      hoyolabConnected: false,
      lastHoyolabCharacterSyncAt: null,
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderCharacters();

    // Check table rendered
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    // Warning badge next to character name
    const charWarningBadge = container.querySelector('span[aria-label^="Invalid progression:"]');
    expect(charWarningBadge).not.toBeNull();
    expect(charWarningBadge.textContent).toContain('⚠️');
    expect(charWarningBadge.getAttribute('title')).toContain('Ascension 6 is invalid for level 1');

    // MatQuantity cells render warning indicator ⚠️ — for ascension materials
    const unavailableCells = container.querySelectorAll('div[aria-label^="Unavailable:"]');
    expect(unavailableCells.length).toBeGreaterThan(0);
    const firstCell = unavailableCells[0];
    expect(firstCell.textContent).toContain('⚠️');
    expect(firstCell.textContent).toContain('—');
    expect(firstCell.getAttribute('title')).toContain('Current state invalid: Ascension 6 is invalid for level 1');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: ARMORY ROW WITH INVALID PROGRESSION
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 8: Armory row with invalid progression renders warning badge and unavailable cells', async () => {
    mockState = {
      trackedWeapons: [
        {
          id: 'w-dull-1',
          weapon_id: 'DullBlade',
          weaponName: 'Dull Blade',
          level: 1,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 1,
          assignedTo: null,
          priority: 1,
          createdAt: 1000,
        },
      ],
      inventory: {},
      removeTrackedWeapon: vi.fn(),
      batchRemoveWeapons: vi.fn(),
      updateTrackedWeapon: vi.fn(),
      bulkUpdateWeapons: vi.fn(),
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderWeapons();

    // Check table rendered
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    // Warning badge next to weapon name
    const weaponWarningBadge = container.querySelector('span[aria-label^="Invalid progression:"]');
    expect(weaponWarningBadge).not.toBeNull();
    expect(weaponWarningBadge.textContent).toContain('⚠️');
    expect(weaponWarningBadge.getAttribute('title')).toContain('Ascension 4 is invalid for level 1');

    // MatQuantity cells render warning indicator ⚠️ — for enhancement/ascension materials
    const unavailableCells = container.querySelectorAll('div[aria-label^="Unavailable:"]');
    expect(unavailableCells.length).toBeGreaterThan(0);
    const firstCell = unavailableCells[0];
    expect(firstCell.textContent).toContain('⚠️');
    expect(firstCell.textContent).toContain('—');
    expect(firstCell.getAttribute('title')).toContain('Current weapon state invalid: Ascension 4 is invalid for level 1');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 9: VALID ZERO-COST COMPLETED PROGRESSION
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 9: Valid zero-cost completed progression displays normal completed empty state', async () => {
    mockState = {
      roster: {
        Jean: {
          name: 'Jean',
          level: 90,
          targetLevel: 90,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          targetTalents: { normal: 10, skill: 10, burst: 10 },
          element: 'Anemo',
        },
      },
      trackedWeapons: [
        {
          id: 'w-aquila-1',
          weapon_id: 'AquilaFavonia',
          weaponName: 'Aquila Favonia',
          level: 90,
          targetLevel: 90,
          ascension: 6,
          targetAscension: 6,
        },
      ],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    await renderPlanner();

    // Subtitle must render "No outstanding upgrade plans"
    expect(container.textContent).toContain('No outstanding upgrade plans');
    // No alert banner
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain('Some progression records are invalid');
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 10: MISSING OR MALFORMED PROGRESSION FIELDS
  // ═════════════════════════════════════════════════════════════════════════
  it('Scenario 10: Missing or malformed progression fields handled safely without exceptions or NaN', async () => {
    mockState = {
      roster: {
        Amber: {
          name: 'Amber',
          level: 'malformed_level',
          targetLevel: 80,
          ascension: null,
          targetAscension: 5,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 6, skill: 6, burst: 6 },
          element: 'Pyro',
        },
      },
      trackedWeapons: [
        {
          id: 'w-invalid-1',
          weapon_id: 'FavoniusWarbow',
          weaponName: 'Favonius Warbow',
          level: 105, // Exceeds weapon max level
          targetLevel: 80,
          ascension: 8, // Exceeds weapon max ascension
          targetAscension: 5,
        },
      ],
      inventory: {},
    };
    useStore.mockImplementation((selector) => selector(mockState));

    // Render should not throw
    await expect(renderPlanner()).resolves.not.toThrow();

    // Alert banner must capture both malformed records
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('2 records have invalid level or ascension combinations and were excluded from calculations.');

    // View Affected Records toggle
    const toggleBtn = container.querySelector('button[aria-controls="planner-invalid-records-list"]');
    await act(async () => {
      toggleBtn.click();
    });

    const detailsList = container.querySelector('#planner-invalid-records-list');
    expect(detailsList.textContent).toContain('Amber');
    expect(detailsList.textContent).toContain('Favonius Warbow');
  });
});
