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
    it('Ayaka Lv80 -> Lv90 weapon-only update is classified as Weapon Update, safe default, and shows diff in Needs Attention', async () => {
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

      // Summary shows Updates 0 with 1 weapon change subtext, Up to Date 0
      expect(container.textContent).toContain('0Updates');
      expect(container.textContent).toContain('1 weapon change');
      expect(container.textContent).toContain('0Up to date');

      // Card shows badge and weapon diff
      expect(container.textContent).toContain('Weapon Update');
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

      // Tab filtering: Updates tab excludes Ayaka, Needs Attention includes Ayaka, Unchanged excludes Ayaka
      const updatesTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Updates'));
      const needsAttentionTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Needs Attention'));
      const unchangedTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Unchanged'));

      act(() => { updatesTab.click(); });
      expect(container.textContent).not.toContain('Kamisato Ayaka');
      expect(container.textContent).toContain('No characters match this filter.');

      act(() => { needsAttentionTab.click(); });
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

  describe('Filtering and Selection Regression Requirements (Section 12)', () => {
    it('Wanderer, Nahida weapon-only changes appear in Needs Attention and not Updates; Venti mixed appears in both', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            // Wanderer: char unchanged, weapon changed
            {
              id: 10000075,
              level: 90,
              ascension: 6,
              talents: { normal: 10, skill: 10, burst: 10 },
              weapon: { id: 14415, level: 90, refinement: 1 } // Fruit of Fulfillment
            },
            // Nahida: char unchanged, weapon refinement differs (R5 vs R1)
            {
              id: 10000073,
              level: 90,
              ascension: 6,
              talents: { normal: 10, skill: 10, burst: 10 },
              weapon: { id: 14403, level: 90, refinement: 5 } // Sacrificial Fragments R5
            },
            // Venti: char level differs (80 -> 90) AND weapon level differs (80 -> 90)
            {
              id: 10000022,
              level: 90,
              ascension: 6,
              talents: { normal: 8, skill: 8, burst: 8 },
              weapon: { id: 15403, level: 90, refinement: 1 } // Favonius Warbow Lv 90
            }
          ]
        })
      });

      mockState.roster = {
        'Wanderer': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'w-widsith'
        },
        'Nahida': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'w-sac-frag'
        },
        'Venti': {
          level: 80,
          ascension: 5,
          talents: { normal: 8, skill: 8, burst: 8 },
          equippedWeaponId: 'w-fav-bow'
        }
      };

      mockState.trackedWeapons = [
        { id: 'w-widsith', weapon_id: 'thewidsith', weaponName: 'The Widsith', level: 90, assignedTo: 'Wanderer' },
        { id: 'w-sac-frag', weapon_id: 'sacrificialfragments', weaponName: 'Sacrificial Fragments', level: 90, currentRefinement: 1, assignedTo: 'Nahida' },
        { id: 'w-fav-bow', weapon_id: 'favoniuswarbow', weaponName: 'Favonius Warbow', level: 80, currentRefinement: 1, assignedTo: 'Venti' }
      ];

      await renderAndFetch();

      const updatesTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Updates'));
      const needsAttentionTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Needs Attention'));
      const unchangedTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Unchanged'));

      // Check Updates Tab
      act(() => { updatesTab.click(); });
      expect(container.textContent).toContain('Venti');
      expect(container.textContent).not.toContain('Wanderer');
      expect(container.textContent).not.toContain('Nahida');

      // Check Needs Attention Tab
      act(() => { needsAttentionTab.click(); });
      expect(container.textContent).toContain('Wanderer');
      expect(container.textContent).toContain('Nahida');
      expect(container.textContent).toContain('Venti');

      // Check Unchanged Tab
      act(() => { unchangedTab.click(); });
      expect(container.textContent).not.toContain('Wanderer');
      expect(container.textContent).not.toContain('Nahida');
      expect(container.textContent).not.toContain('Venti');
    });

    it('Hu Tao mixed character and weapon change retains single selection across tab switches', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000046,
              level: 90,
              ascension: 6,
              talents: { normal: 10, skill: 10, burst: 10 },
              weapon: { id: 13501, level: 90, refinement: 1 }
            }
          ]
        })
      });

      mockState.roster = {
        'Hu Tao': {
          level: 80,
          ascension: 5,
          talents: { normal: 8, skill: 8, burst: 8 },
          equippedWeaponId: 'w-homa'
        }
      };
      mockState.trackedWeapons = [
        { id: 'w-homa', weapon_id: 'staffofhoma', weaponName: 'Staff of Homa', level: 80, currentRefinement: 1, assignedTo: 'Hu Tao' }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      const updatesTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Updates'));
      const needsAttentionTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Needs Attention'));
      const allTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('All'));

      // Default selected (1)
      expect(getApplyBtn().textContent).toContain('(1)');

      // In Updates tab, uncheck Hu Tao
      act(() => { updatesTab.click(); });
      expect(container.textContent).toContain('Hu Tao');
      const checkbox1 = container.querySelector('input[type="checkbox"]');
      expect(checkbox1.checked).toBe(true);
      act(() => { checkbox1.click(); });
      expect(getApplyBtn().textContent).toContain('(0)');

      // Switch to Needs Attention tab: still unchecked, still (0)
      act(() => { needsAttentionTab.click(); });
      expect(container.textContent).toContain('Hu Tao');
      const checkbox2 = container.querySelector('input[type="checkbox"]');
      expect(checkbox2.checked).toBe(false);

      // Re-check in Needs Attention tab
      act(() => { checkbox2.click(); });
      expect(getApplyBtn().textContent).toContain('(1)');

      // Switch to All tab: still checked, still (1)
      act(() => { allTab.click(); });
      expect(container.textContent).toContain('Hu Tao');
      const checkbox3 = container.querySelector('input[type="checkbox"]');
      expect(checkbox3.checked).toBe(true);
      expect(getApplyBtn().textContent).toContain('(1)');
    });

    it('Active Traveler weapon-only change: hidden under Updates, visible under Needs Attention, selectable', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000007,
              element: 'Anemo',
              level: 90,
              ascension: 6,
              talents: { normal: 10, skill: 10, burst: 10 },
              weapon: { id: 11401, level: 90, refinement: 1 } // Favonius Sword Lv 90
            }
          ]
        })
      });

      mockState.roster = {
        'Traveler Anemo': {
          level: 90,
          ascension: 6,
          talents: { normal: 10, skill: 10, burst: 10 },
          equippedWeaponId: 'w-fav'
        }
      };
      mockState.trackedWeapons = [
        { id: 'w-fav', weapon_id: 'favoniussword', weaponName: 'Favonius Sword', level: 80, assignedTo: 'Traveler Anemo' }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      const updatesTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Updates'));
      const needsAttentionTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Needs Attention'));
      const unchangedTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Unchanged'));

      // In All tab, Traveler is actionable (status: weapon-update) and default selected (1)
      expect(getApplyBtn().textContent).toContain('(1)');
      expect(container.textContent).toContain('Traveler');
      expect(container.textContent).toContain('Weapon Update');

      // Updates tab: active Traveler weapon-only is NOT visible
      act(() => { updatesTab.click(); });
      expect(container.textContent).not.toContain('Traveler');

      // Needs Attention tab: active Traveler weapon-only IS visible
      act(() => { needsAttentionTab.click(); });
      expect(container.textContent).toContain('Traveler');
      expect(container.textContent).toContain('Weapon Update');

      // Unchanged tab: active Traveler is NOT visible
      act(() => { unchangedTab.click(); });
      expect(container.textContent).not.toContain('Traveler');
    });

    it('Select All Safe selects safe weapon-only update rows and ignores unresolved mismatches', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            // Ayaka: safe weapon-only update
            { id: 10000002, level: 90, weapon: { id: 11414, level: 90 } },
            // Hu Tao: char update only
            { id: 10000046, level: 90, weapon: { id: 13501, level: 80 } },
            // Odette: equipment mismatch (unresolved)
            { id: 10000150, level: 90, weapon: { id: 11518, level: 90 } }
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, equippedWeaponId: 'w-ayaka' },
        'Hu Tao': { level: 80, equippedWeaponId: 'w-homa' },
        'Odette': { level: 90, equippedWeaponId: 'w-finale' }
      };
      mockState.trackedWeapons = [
        { id: 'w-ayaka', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, assignedTo: 'Kamisato Ayaka' },
        { id: 'w-homa', weapon_id: 'staffofhoma', weaponName: 'Staff of Homa', level: 80, assignedTo: 'Hu Tao' },
        { id: 'w-finale', weapon_id: 'finaleofthedeep', weaponName: 'Finale of the Deep', level: 80, assignedTo: 'Odette' }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear All');
      const selectSafeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Select All Safe');

      // Default safe: Ayaka (weapon-update) + Hu Tao (update) = (2). Odette is excluded.
      expect(getApplyBtn().textContent).toContain('(2)');

      // Clear all
      act(() => { clearBtn.click(); });
      expect(getApplyBtn().textContent).toContain('(0)');

      // Select all safe: re-selects Ayaka and Hu Tao, excludes Odette
      act(() => { selectSafeBtn.click(); });
      expect(getApplyBtn().textContent).toContain('(2)');
      expect(getApplyBtn().disabled).toBe(false);
    });

    it('Existing character matching progression with unmapped weapon is classified as conflict, visible in Needs Attention only, and blocks apply if manually selected', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000002, // Ayaka
              level: 90,
              ascension: 6,
              weapon: { id: 99999999, level: 90 } // Unmapped weapon
            }
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-ayaka' }
      };
      mockState.trackedWeapons = [
        { id: 'w-ayaka', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 90, assignedTo: 'Kamisato Ayaka' }
      ];

      await renderAndFetch();

      const updatesTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Updates'));
      const needsAttentionTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Needs Attention'));
      const unchangedTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.startsWith('Unchanged'));

      // 1. Updates tab: Ayaka is NOT visible (no char progression update)
      act(() => { updatesTab.click(); });
      expect(container.textContent).not.toContain('Kamisato Ayaka');

      // 2. Unchanged tab: Ayaka is NOT visible (unmapped weapon requires attention)
      act(() => { unchangedTab.click(); });
      expect(container.textContent).not.toContain('Kamisato Ayaka');

      // 3. Needs Attention tab: Ayaka IS visible with Conflict badge and Unmapped weapon info
      act(() => { needsAttentionTab.click(); });
      expect(container.textContent).toContain('Kamisato Ayaka');
      expect(container.textContent).toContain('Conflict');
      expect(container.textContent).toContain('Unmapped (99999999)');

      // 4. Ayaka is NOT auto-selected
      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      expect(getApplyBtn().textContent).toContain('(0)');
      expect(getApplyBtn().disabled).toBe(true);

      // 5. If user manually selects Ayaka, apply is blocked by conflict validation
      const checkbox = container.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeNull();
      act(() => { checkbox.click(); });
      expect(getApplyBtn().textContent).toContain('(1)');
      expect(getApplyBtn().disabled).toBe(true);
      expect(container.textContent).toContain('Conflict in: Kamisato Ayaka');
    });

    it('prepareApply correctly separates weapon-only updates from character progression updates', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            // Ayaka: weapon-only update (char lv 90 same, weapon lv 80 -> 90)
            { id: 10000002, level: 90, ascension: 6, weapon: { id: 11414, level: 90 } },
            // Hu Tao: mixed update (char lv 80 -> 90, weapon lv 80 -> 90)
            { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90 } }
          ]
        })
      });

      mockState.roster = {
        'Kamisato Ayaka': { level: 90, ascension: 6, equippedWeaponId: 'w-ayaka' },
        'Hu Tao': { level: 80, ascension: 5, equippedWeaponId: 'w-homa' }
      };
      mockState.trackedWeapons = [
        { id: 'w-ayaka', weapon_id: 'amenomakageuchi', weaponName: 'Amenoma Kageuchi', level: 80, assignedTo: 'Kamisato Ayaka' },
        { id: 'w-homa', weapon_id: 'staffofhoma', weaponName: 'Staff of Homa', level: 80, assignedTo: 'Hu Tao' }
      ];

      await renderAndFetch();

      const getApplyBtn = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      // Both are safe to apply, so auto-selected
      expect(getApplyBtn().textContent).toContain('(2)');
      expect(getApplyBtn().disabled).toBe(false);

      // Click Apply Selected to trigger prepareApply and open confirmation dialog
      act(() => { getApplyBtn().click(); });

      // Confirmation dialog should be open
      expect(container.textContent).toContain('Apply HoYoLAB Sync?');

      // Verify counts in confirmation modal:
      // Characters to Update: 1 (Hu Tao only, Ayaka weapon-only update does not increment updateCount)
      const confirmDialog = container.querySelector('[aria-labelledby="sync-confirm-title"]');
      expect(confirmDialog).not.toBeNull();
      expect(confirmDialog.textContent).toContain('Characters to Add0');
      expect(confirmDialog.textContent).toContain('Characters to Update1');
      expect(confirmDialog.textContent).toContain('Existing Weapons to Reassign/Update2');
    });
  });
});
