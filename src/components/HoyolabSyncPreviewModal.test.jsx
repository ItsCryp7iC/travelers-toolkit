import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HoyolabSyncPreviewModal from './HoyolabSyncPreviewModal';
import useStore from '../store/useStore';

vi.mock('../store/useStore');

describe('HoyolabSyncPreviewModal UI Apply Flow', () => {
  let container = null;
  let root = null;
  let mockState = {};
  let mockApply = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      roster: {},
      trackedWeapons: [],
      applyHoyolabSync: mockApply
    };

    useStore.mockImplementation((selector) => {
      return selector(mockState);
    });

    global.fetch = vi.fn();
    mockApply.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  const setupMockData = () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90, refinement: 1 } }, // Hu Tao (New)
          { id: 10000002, level: 80, ascension: 5, talents: { normal: 1, skill: 1, burst: 1 }, weapon: { id: 11414, level: 80, refinement: 1 } }, // Ayaka (Update, local ahead on talents)
        ]
      })
    });

    mockState.roster = {
      'Kamisato Ayaka': { level: 70, ascension: 4, talents: { normal: 10, skill: 10, burst: 10 } }
    };
  };

  const renderAndFetch = async () => {
    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });
  };

  it('Phase D: Hook Order Hotfix - renders without crashing when toggling isOpen false -> true -> false', async () => {
    setupMockData();

    // 1. Render closed
    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={false} onClose={vi.fn()} />);
    });
    expect(container.textContent).not.toContain('Sync Characters from HoYoLAB');

    // 2. Render open
    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });
    expect(container.textContent).toContain('Sync Characters from HoYoLAB');

    // 3. Render closed again
    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={false} onClose={vi.fn()} />);
    });
    expect(container.textContent).not.toContain('Sync Characters from HoYoLAB');

    // 4. Render open again
    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });
    expect(container.textContent).toContain('Sync Characters from HoYoLAB');
  });

  it('default selects safe rows and allows clear/select all', async () => {
    setupMockData();
    await renderAndFetch();

    // The Apply Selected button should show (2) default safe
    const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
    expect(getApplyBtn().textContent).toContain('(2)');

    // Clear All
    const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear All');
    act(() => {
      clearBtn.click();
    });
    expect(getApplyBtn().disabled).toBe(true);
    expect(getApplyBtn().textContent).toContain('(0)');

    // Select All Safe
    const selectSafeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Select All Safe');
    act(() => {
      selectSafeBtn.click();
    });
    expect(getApplyBtn().disabled).toBe(false);
    expect(getApplyBtn().textContent).toContain('(2)');
  });

  it('does not select local-ahead for overwrite by default, explicit override works', async () => {
    setupMockData();
    await renderAndFetch();

    const text = container.textContent;
    expect(text).toContain('Toolkit talents ahead.');

    const overrideBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Keep Toolkit' && b.parentElement.textContent.includes('Toolkit talents ahead'));
    expect(overrideBtn).not.toBeNull();

    act(() => {
      overrideBtn.click();
    });

    expect(overrideBtn.textContent).toBe('Using HoYoLAB');
  });

  it('shows confirmation modal before applying', async () => {
    setupMockData();
    await renderAndFetch();

    const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
    act(() => {
      applyBtn.click();
    });

    expect(container.textContent).toContain('Apply HoYoLAB Sync?');
    expect(container.textContent).toContain('Characters to Add1');
    expect(container.textContent).toContain('Characters to Update1');

    // Cancel
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Cancel' && b.closest('.bg-black\\/80'));
    act(() => cancelBtn.click());

    expect(container.textContent).not.toContain('Apply HoYoLAB Sync?');
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('calls applyHoyolabSync on confirm and shows success state', async () => {
    setupMockData();
    await renderAndFetch();

    const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
    act(() => { applyBtn.click(); });

    mockApply.mockReturnValueOnce({ charactersAdded: 1, charactersUpdated: 1, weaponsCreated: 2, weaponsUpdated: 0, weaponsReassigned: 0 });

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Apply Sync');
    act(() => { confirmBtn.click(); });

    expect(mockApply).toHaveBeenCalledTimes(1);

    // Check success summary
    expect(container.textContent).toContain('Sync Complete');
    expect(container.textContent).toContain('Characters Added1');
    expect(container.textContent).toContain('Characters Updated1');
    expect(container.textContent).toContain('Weapons Created2');
  });

  it('weapon ambiguity blocks apply unless resolved', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90, refinement: 1 } }, // Hu Tao
        ]
      })
    });

    mockState.roster = {
      'Hu Tao': { level: 80, ascension: 5 }
    };
    mockState.trackedWeapons = [
      { id: 'w1', weapon_id: 'staffofhoma', level: 90, currentRefinement: 1, assignedTo: null },
      { id: 'w2', weapon_id: 'staffofhoma', level: 80, currentRefinement: 1, assignedTo: null }
    ];

    await renderAndFetch();

    expect(container.textContent).toContain('Ambiguous');

    const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));

    // Attempt apply without resolving (it should alert in old code, now it should be disabled)
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) act(() => { checkbox.click(); });

    expect(applyBtn.disabled).toBe(true);
    expect(applyBtn.title).toContain('resolve');

    // Resolve it
    const resolveRadio = Array.from(container.querySelectorAll('input[type="radio"]')).find(r => r.nextSibling.textContent.includes('Use existing: Lv 90'));
    act(() => { resolveRadio.click(); });

    act(() => { applyBtn.click(); });
    expect(container.textContent).toContain('Apply HoYoLAB Sync?'); // Moved to confirmation
  });

  describe('Traveler Variants Onboarding', () => {
    it('Geo-only selection correctly enables Apply and builds plan without active Traveler', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000007, level: 70, ascension: 5, element: 'Cryo' }, // Traveler Cryo (Unchanged)
          ]
        })
      });

      mockState.roster = {
        'Traveler Cryo': { level: 70, ascension: 5 },
        'Traveler Anemo': { level: 90, ascension: 6 } // Existing
      };

      await renderAndFetch();

      // A. exactly one Traveler section renders
      const headers = Array.from(container.querySelectorAll('h3')).filter(h => h.textContent === 'Traveler');
      expect(headers.length).toBe(1);

      // Clear any auto-selected characters
      const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear All');
      if (clearBtn) {
        act(() => { clearBtn.click(); });
      }

      // Check Actionable Traveler Rule A: unchanged, no weapon work -> no checkbox, card visible
      const travelerCard = Array.from(container.querySelectorAll('.bg-\\[var\\(--surface\\)\\]')).find(el => el.textContent.includes('Traveler Cryo'));
      expect(travelerCard).not.toBeUndefined();
      expect(travelerCard.querySelector('input[type="checkbox"]')).toBeNull();

      // G. active Cryo is marked Active and disabled
      // H. existing Anemo marked Already in Toolkit and disabled
      expect(container.textContent).toContain('Cryo• Active');
      expect(container.textContent).toContain('Anemo• Exists');

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      expect(applyBtn.disabled).toBe(true);

      // Select Geo
      const geoBtn = Array.from(container.querySelectorAll('button')).find(el => el.textContent.startsWith('Geo'));
      act(() => { geoBtn.click(); });

      // B. selecting Geo only enables Apply
      // C. Apply Selected count includes derived variant (and F. active Cryo does not need to be selected)
      expect(applyBtn.disabled).toBe(false);
      expect(applyBtn.textContent).toContain('Apply Selected (1)');

      // E. Geo-only confirmation
      act(() => { applyBtn.click(); });
      expect(container.textContent).toContain('Characters to Add0');
      expect(container.textContent).toContain('Characters to Update0');
      expect(container.textContent).toContain('Traveler Variants to Add1');

      // D. Geo-only builds plan correctly
      // We can inspect mockApply call
      const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Sync'));
      act(() => { confirmBtn.click(); });

      const appliedPlan = mockApply.mock.calls[0][0];
      expect(appliedPlan.characters.length).toBe(0);
      expect(appliedPlan.derivedTravelerVariants.length).toBe(1);
      expect(appliedPlan.derivedTravelerVariants[0].rosterKey).toBe('Traveler Geo');
    });

    it('shows checkbox if Traveler is actionable (Update)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [{ id: 10000007, level: 80, element: 'Cryo' }] // Level 80 vs 70 -> update
        })
      });

      mockState.roster = {
        'Traveler Cryo': { level: 70 }
      };

      await renderAndFetch();

      // Check Actionable Traveler Rule C: update active Traveler -> checkbox visible
      const travelerCard = Array.from(container.querySelectorAll('.bg-\\[var\\(--surface\\)\\]')).find(el => el.textContent.includes('Traveler Cryo'));
      expect(travelerCard.querySelector('input[type="checkbox"]')).not.toBeNull();
    });

    it('shows checkbox if Traveler is actionable (Weapon Would Create)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [{ id: 10000007, level: 70, element: 'Cryo', weapon: { id: 11401, name: 'Black Sword', level: 1 } }] // Unchanged char, new weapon
        })
      });

      mockState.roster = {
        'Traveler Cryo': { level: 70 }
      };
      mockState.weapons = [];

      await renderAndFetch();

      // Check Actionable Traveler Rule E: unchanged Traveler + would-create weapon -> checkbox visible
      const travelerCard = Array.from(container.querySelectorAll('.bg-\\[var\\(--surface\\)\\]')).find(el => el.textContent.includes('Traveler Cryo'));
      expect(travelerCard.querySelector('input[type="checkbox"]')).not.toBeNull();
    });

    it('Select All Missing selects correctly and reopening excludes new existing', async () => {
      global.fetch.mockResolvedValue({ // multiple fetches
        ok: true,
        json: async () => ({
          characters: [{ id: 10000007, level: 70, element: 'Cryo' }] // Unchanged
        })
      });

      mockState.roster = {
        'Traveler Cryo': { level: 70 },
        'Traveler Geo': { level: 70 } // Now Geo exists
      };

      await renderAndFetch();

      // J. reopening after Geo exists does not offer Geo again
      expect(container.textContent).toContain('Geo• Exists');
      const geoBtn = Array.from(container.querySelectorAll('button')).find(el => el.textContent.startsWith('Geo'));
      expect(geoBtn.disabled).toBe(true);

      // Clear any auto-selected characters
      const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear All');
      if (clearBtn) {
        act(() => { clearBtn.click(); });
      }

      // I. Select All Missing excludes active + existing
      const selectAllBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Select All Missing'));
      act(() => { selectAllBtn.click(); });

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      // Cryo (Active), Geo (Exists), so 5 remaining elements should be selected
      expect(applyBtn.textContent).toContain('Apply Selected (5)');
    });
  });

  describe('Phase D: Error UX', () => {
    it('shows 401 message', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await renderAndFetch();
      expect(container.textContent).toContain('Your HoYoLAB session has expired. Reconnect HoYoLAB and try again.');
    });

    it('shows 403 message', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
      await renderAndFetch();
      expect(container.textContent).toContain('Battle Chronicle data is private. Enable character details in HoYoLAB settings.');
    });

    it('shows 429 message', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 429 });
      await renderAndFetch();
      expect(container.textContent).toContain('HoYoLAB is rate-limiting requests. Please try again in a little while.');
    });

    it('shows network/500 message', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await renderAndFetch();
      expect(container.textContent).toContain('Could not load HoYoLAB character data. Your Toolkit data was not changed.');
    });

    it('shows malformed JSON message', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
      await renderAndFetch();
      expect(container.textContent).toContain('Failed to fetch');
    });
  });

  describe('Phase D: Retry Safety', () => {
    it('Retry clears state and fetches fresh data', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await renderAndFetch();

      const retryBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Retry');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ characters: [] })
      });

      await act(async () => {
        retryBtn.click();
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(container.textContent).not.toContain('Could not load');
    });
  });

  describe('Phase D: No-Mutation Guarantee', () => {
    it('does not mutate state during render, select, or close', async () => {
      setupMockData();
      await renderAndFetch();

      const originalRosterStr = JSON.stringify(mockState.roster);
      const originalWeaponsStr = JSON.stringify(mockState.trackedWeapons);

      const closeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '✕');
      act(() => { closeBtn.click(); });

      expect(JSON.stringify(mockState.roster)).toBe(originalRosterStr);
      expect(JSON.stringify(mockState.trackedWeapons)).toBe(originalWeaponsStr);
      expect(mockApply).not.toHaveBeenCalled();
    });
  });

  describe('Phase D: Accessibility / Modal UX', () => {
    it('Escape closes confirmation first, then modal', async () => {
      setupMockData();
      await renderAndFetch();

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      act(() => { applyBtn.click(); });

      expect(container.textContent).toContain('Apply HoYoLAB Sync?');

      // Press Escape
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(container.textContent).not.toContain('Apply HoYoLAB Sync?');
      expect(container.textContent).toContain('Sync Characters from HoYoLAB'); // Still open
    });

    it('disabled apply tells why', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90, refinement: 1 } },
          ]
        })
      });

      mockState.roster = {
        'Hu Tao': { level: 80, ascension: 5 }
      };
      mockState.trackedWeapons = [
        { id: 'w1', weapon_id: 'staffofhoma', level: 90, currentRefinement: 1, assignedTo: null },
        { id: 'w2', weapon_id: 'staffofhoma', level: 80, currentRefinement: 1, assignedTo: null }
      ];

      await renderAndFetch();

      const checkbox = container.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) {
        act(() => { checkbox.click(); });
      }

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      expect(applyBtn.title).toContain('resolve weapon ambiguities'); // If there is a title, or we just test it alerts. We already tested the alert.
    });
  });

  describe('Phase D: First-Run UX', () => {
    it('shows welcome hint on empty roster', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ characters: [{ id: 10000046, level: 90, ascension: 6 }] })
      });
      mockState.roster = {};

      await renderAndFetch();
      expect(container.textContent).toContain("Welcome to Traveler's Toolkit");
    });
  });

  describe('Phase C1: Weapon Reconciliation and Modal UX', () => {
    it('Ayaka Lv80 -> Lv90 weapon-only update is classified as Update, safe default, and shows diff', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000002, // Kamisato Ayaka
              level: 90,
              ascension: 6,
              talents: { normal: 10, skill: 10, burst: 10 },
              weapon: { id: 11414, level: 90, ascension: 6, refinement: 1 } // Amenoma Kageuchi Lv 90
            }
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'amenoma-inst-1'
        }
      };
      mockState.trackedWeapons = [
        {
          id: 'amenoma-inst-1',
          weapon_id: 'AmenomaKageuchi',
          weaponName: 'Amenoma Kageuchi',
          level: 80,
          ascension: 5,
          currentRefinement: 1,
          assignedTo: 'Kamisato Ayaka'
        }
      ];

      await renderAndFetch();

      // Summary shows Updates 1, Up to Date 0
      expect(container.textContent).toContain('1Updates');
      expect(container.textContent).toContain('0Up to date');

      // Card shows weapon diff
      expect(container.textContent).toContain('Amenoma Kageuchi');
      expect(container.textContent).toContain('Lv 80 → Lv 90');

      // Default selected
      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      expect(getApplyBtn().textContent).toContain('(1)');
      expect(getApplyBtn().disabled).toBe(false);

      // Weapon resolver shows Update Existing Weapon
      const updateExistingRadio = Array.from(container.querySelectorAll('input[type="radio"]')).find(r => r.value === 'update-existing');
      expect(updateExistingRadio).toBeDefined();
      expect(updateExistingRadio.checked).toBe(true);

      // Tab filtering: Updates tab includes Ayaka, Unchanged tab excludes Ayaka
      const updatesTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Updates'));
      const unchangedTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Unchanged'));

      act(() => { updatesTab.click(); });
      expect(container.textContent).toContain('Kamisato Ayaka');

      act(() => { unchangedTab.click(); });
      expect(container.textContent).not.toContain('Kamisato Ayaka');
      expect(container.textContent).toContain('No characters match this filter.');
    });

    it('Odette equipment-mismatch disables Apply Selected with visible reason until resolved', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000150, // Odette
              level: 90,
              ascension: 6,
              weapon: { id: 11518, level: 90, ascension: 6, refinement: 1 } // Athame Artis
            }
          ]
        })
      });

      mockState.roster = {
        'Odette': {
          level: 80,
          ascension: 5,
          equippedWeaponId: 'finale-inst-1'
        }
      };
      mockState.trackedWeapons = [
        {
          id: 'finale-inst-1',
          weapon_id: 'FinaleOfTheDeep',
          weaponName: 'Finale of the Deep',
          level: 80,
          ascension: 5,
          assignedTo: 'Odette'
        }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));

      // 1. Select All Safe must NOT select Odette because she has unresolved equipment mismatch
      const selectSafeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Select All Safe');
      act(() => { selectSafeBtn.click(); });
      expect(getApplyBtn().textContent).toContain('(0)');

      // 2. User manually selects Odette
      const checkbox = container.querySelector('input[type="checkbox"]');
      act(() => { checkbox.click(); });

      // Apply button is disabled
      expect(getApplyBtn().textContent).toContain('(1)');
      expect(getApplyBtn().disabled).toBe(true);

      // Visible reasons shown
      expect(container.textContent).toContain('Please resolve weapon assignment for: Odette.');
      expect(container.textContent).toContain('Weapon decision required to apply this character');

      // 3. User resolves by choosing "Leave Weapon Unchanged"
      const leaveRadio = Array.from(container.querySelectorAll('input[type="radio"]')).find(r => r.value === 'ignore');
      expect(leaveRadio).toBeDefined();
      act(() => { leaveRadio.click(); });

      // Apply button enables!
      expect(getApplyBtn().disabled).toBe(false);
      expect(container.textContent).not.toContain('Please resolve weapon assignment for: Odette.');
    });

    it('Search filters by character name, local weapon, and remote weapon, preserving selections', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000002, // Ayaka
              level: 90,
              ascension: 6,
              weapon: { id: 11414, level: 90, refinement: 1 } // Amenoma Kageuchi
            },
            {
              id: 10000046, // Hu Tao
              level: 90,
              ascension: 6,
              weapon: { id: 13501, level: 90, refinement: 1 } // Staff of Homa
            }
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-ayaka' }
      };
      mockState.trackedWeapons = [
        { id: 'w-ayaka', weapon_id: 'AmenomaKageuchi', weaponName: 'Amenoma Kageuchi', level: 80, assignedTo: 'Kamisato Ayaka' }
      ];

      await renderAndFetch();

      const searchInput = container.querySelector('input[placeholder="Search characters or weapons..."]');
      expect(searchInput).not.toBeNull();

      const setSearch = (val) => {
        act(() => {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(searchInput, val);
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      };

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      // Initially both are selected safe (Ayaka weapon update + Hu Tao new)
      expect(getApplyBtn().textContent).toContain('(2)');

      // 1. Search by character name
      setSearch('Ayaka');
      expect(container.textContent).toContain('Kamisato Ayaka');
      expect(container.textContent).not.toContain('Hu Tao');
      // Apply button count is still 2 (preserved selection)
      expect(getApplyBtn().textContent).toContain('(2)');

      // 2. Search by local weapon name
      setSearch('Amenoma');
      expect(container.textContent).toContain('Kamisato Ayaka');
      expect(container.textContent).not.toContain('Hu Tao');

      // 3. Search by remote weapon name
      setSearch('Staff of Homa');
      expect(container.textContent).toContain('Hu Tao');
      expect(container.textContent).not.toContain('Kamisato Ayaka');

      // 4. Empty search state
      setSearch('NonexistentQuery');
      expect(container.textContent).toContain('No matching characters or weapons.');
      expect(getApplyBtn().textContent).toContain('(2)');

      // 5. Clear search restores all rows
      const clearSearchBtn = container.querySelector('button[aria-label="Clear search"]');
      expect(clearSearchBtn).not.toBeNull();
      act(() => { clearSearchBtn.click(); });
      expect(container.textContent).toContain('Kamisato Ayaka');
      expect(container.textContent).toContain('Hu Tao');
      expect(getApplyBtn().textContent).toContain('(2)');
    });

    it('Search filters Traveler variants section appropriately', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000007, level: 80, ascension: 5, element: 'Cryo' },
            { id: 10000046, level: 90, ascension: 6 }
          ]
        })
      });

      mockState.roster = {
        'Traveler Cryo': { level: 80, ascension: 5 }
      };

      await renderAndFetch();

      const searchInput = container.querySelector('input[placeholder="Search characters or weapons..."]');

      const setSearch = (val) => {
        act(() => {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(searchInput, val);
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      };

      // Searching Traveler or Cryo keeps Traveler section visible
      setSearch('Traveler');
      expect(container.textContent).toContain('Variants');

      // Searching Hu Tao hides Traveler section
      setSearch('Hu Tao');
      expect(container.textContent).not.toContain('Variants');
      expect(container.textContent).toContain('Hu Tao');
    });
  });

  describe('Phase C1.1: Existing-Weapon Reassignment & Toolbar Polish', () => {
    it('Toolbar renders two distinct rows: Row 1 search & actions, Row 2 status filter chips', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000002, level: 90, weapon: { id: 11414, level: 90 } }
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-ayaka' }
      };
      mockState.trackedWeapons = [
        { id: 'w-ayaka', weapon_id: 'AmenomaKageuchi', weaponName: 'Amenoma Kageuchi', level: 90, assignedTo: 'Kamisato Ayaka' }
      ];

      await renderAndFetch();

      const searchInput = container.querySelector('input[placeholder="Search characters or weapons..."]');
      expect(searchInput).not.toBeNull();
      expect(searchInput.getAttribute('aria-label')).toBe('Search characters or weapons');

      // Verify search icon SVG exists inside search container
      const searchContainer = searchInput.parentElement;
      const svgIcon = searchContainer.querySelector('svg');
      expect(svgIcon).not.toBeNull();

      // Verify Row 1 contains search and actions
      const row1 = searchContainer.parentElement;
      const selectAllSafeBtn = Array.from(row1.querySelectorAll('button')).find(b => b.textContent.includes('Select All Safe'));
      const clearAllBtn = Array.from(row1.querySelectorAll('button')).find(b => b.textContent.includes('Clear All'));
      expect(selectAllSafeBtn).not.toBeNull();
      expect(clearAllBtn).not.toBeNull();

      // Verify Row 2 contains status filter chips
      const toolbar = row1.parentElement;
      const filterChips = Array.from(toolbar.querySelectorAll('button')).filter(b =>
        ['All', 'New', 'Updates', 'Unchanged', 'Needs Attention'].includes(b.textContent.trim())
      );
      expect(filterChips.length).toBe(5);
    });

    it('Ayaka and Jean two-way swap in Modal: both auto-select safe when in cycle and apply swaps assignments', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000002, level: 90, weapon: { id: 11414, level: 90 } }, // Ayaka remote Amenoma
            { id: 10000003, level: 90, weapon: { id: 11509, level: 90 } }  // Jean remote Mistsplitter
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-mistsplitter' },
        'Jean': { level: 90, equippedWeaponId: 'w-amenoma' }
      };
      mockState.trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', weaponName: 'Mistsplitter Reforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', assignedTo: 'Jean' }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      // Both Ayaka and Jean form a closed cycle, so both are auto-selected safe!
      expect(getApplyBtn().textContent).toContain('(2)');
      expect(getApplyBtn().disabled).toBe(false);

      // Click Apply Selected -> confirmation modal opens
      act(() => { getApplyBtn().click(); });
      expect(container.textContent).toContain('Apply HoYoLAB Sync?');

      // Confirm Apply
      const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Apply Sync');
      mockApply.mockReturnValueOnce({
        charactersAdded: 0,
        charactersUpdated: 2,
        weaponsCreated: 0,
        weaponsUpdatedOrReassigned: 2,
        travelerVariantsAdded: 0
      });
      act(() => { confirmBtn.click(); });

      expect(mockApply).toHaveBeenCalledTimes(1);
      const passedPlan = mockApply.mock.calls[0][0];

      // Plan should assign existing Amenoma to Ayaka and existing Mistsplitter to Jean
      const ayakaInstruction = passedPlan.characters.find(c => c.rosterKey === 'Kamisato Ayaka');
      const jeanInstruction = passedPlan.characters.find(c => c.rosterKey === 'Jean');

      expect(ayakaInstruction.weapon.action).toBe('assign');
      expect(ayakaInstruction.weapon.uuid).toBe('w-amenoma');

      expect(jeanInstruction.weapon.action).toBe('assign');
      expect(jeanInstruction.weapon.uuid).toBe('w-mistsplitter');
    });

    it('Unselected owner conflict: selecting Ayaka when Skirk is unselected blocks Apply with exact message', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000002, level: 90, weapon: { id: 11414, level: 90 } } // Ayaka remote Amenoma
          ]
        })
      });

      // Skirk is NOT in the sync preview, but owns Amenoma locally
      mockState.roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-mistsplitter' },
        'Skirk': { level: 90, equippedWeaponId: 'w-amenoma' }
      };
      mockState.trackedWeapons = [
        { id: 'w-mistsplitter', weapon_id: 'mistsplitterreforged', weaponName: 'Mistsplitter Reforged', assignedTo: 'Kamisato Ayaka' },
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', assignedTo: 'Skirk' }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));

      // Not auto-selected because Amenoma is assigned to unselected Skirk
      expect(getApplyBtn().disabled).toBe(true);
      expect(getApplyBtn().textContent).toContain('(0)');

      // User manually selects Ayaka
      const checkbox = container.querySelector('input[type="checkbox"]');
      act(() => { checkbox.click(); });

      // Apply button should be disabled because weapon decision is required
      expect(getApplyBtn().disabled).toBe(true);
      expect(container.textContent).toContain('Amenoma Kageuchi is currently assigned to Skirk. Resolve the assignment before applying.');

      // Card communicates the assignment warning clearly
      expect(container.textContent).toContain('Amenoma Kageuchi is currently assigned to Skirk. Using it will remove that assignment.');

      // User resolves by explicitly selecting "Use Existing Tracked Weapon"
      const assignRadio = Array.from(container.querySelectorAll('input[type="radio"]')).find(r => r.value === 'assign|w-amenoma');
      expect(assignRadio).not.toBeNull();
      act(() => { assignRadio.click(); });

      // Now Apply is enabled!
      expect(getApplyBtn().disabled).toBe(false);
    });

    it('Duplicate assignment conflict: two selected characters choosing same weapon blocks Apply with exact conflict message', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000002, level: 90, weapon: { id: 11414, level: 90 } }, // Ayaka
            { id: 10000003, level: 90, weapon: { id: 11414, level: 90 } }  // Jean
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: null },
        'Jean': { level: 90, equippedWeaponId: null }
      };
      // Only ONE Amenoma exists unassigned in Armory
      mockState.trackedWeapons = [
        { id: 'w-amenoma', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', assignedTo: null }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));

      // Both try to claim the same unassigned Amenoma
      expect(getApplyBtn().disabled).toBe(true);
      expect(container.textContent).toContain('Weapon assignment conflict: Amenoma Kageuchi is selected for both Kamisato Ayaka and Jean.');

      // Resolve conflict by changing Jean to "Leave Weapon Unchanged"
      const ignoreRadioJean = container.querySelector('input[name="w_10000003"][value="ignore"]');
      expect(ignoreRadioJean).not.toBeNull();
      act(() => { ignoreRadioJean.click(); });

      // Conflict is resolved!
      expect(getApplyBtn().disabled).toBe(false);
    });
  });
});
