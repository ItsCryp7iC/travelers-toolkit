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

    // Attempt apply without resolving (it should alert)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    act(() => { applyBtn.click(); });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('resolve ambiguities'));

    // Resolve it
    const resolveRadio = Array.from(container.querySelectorAll('input[type="radio"]')).find(r => r.nextSibling.textContent.includes('Use existing: Lv 90'));
    act(() => { resolveRadio.click(); });

    act(() => { applyBtn.click(); });
    expect(container.textContent).toContain('Apply HoYoLAB Sync?'); // Moved to confirmation
    alertSpy.mockRestore();
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
});