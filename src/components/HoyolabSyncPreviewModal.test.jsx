import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HoyolabSyncPreviewModal from './HoyolabSyncPreviewModal';
import useStore from '../store/useStore';

vi.mock('../store/useStore');

describe('HoyolabSyncPreviewModal UI', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      roster: {},
      trackedWeapons: []
    };

    useStore.mockImplementation((selector) => {
      return selector(mockState);
    });

    global.fetch = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it('renders nothing when not open', () => {
    act(() => {
      root.render(<HoyolabSyncPreviewModal isOpen={false} onClose={vi.fn()} />);
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders loading state initially', async () => {
    global.fetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    act(() => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('Fetching and mapping characters...');
  });

  it('renders successful preview and correctly filters', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90 } }, // Hu Tao (New)
          { id: 10000002, level: 80, ascension: 5, weapon: { id: 11414, level: 80 } }, // Ayaka (Unchanged)
          { id: 10000005, element: 'Cryo', level: 90, ascension: 6 }, // TravelerCryo (Update)
          { id: 99999999, level: 50 }, // Unmapped Char
        ]
      })
    });

    mockState.roster = {
      'Kamisato Ayaka': { level: 80, ascension: 5, equippedWeaponId: 'w1' },
      'Traveler Cryo': { level: 80, ascension: 6 }
    };
    mockState.trackedWeapons = [
      { id: 'w1', weapon_id: 'amenomakageuchi', level: 80, ascension: 5, assignedTo: 'Kamisato Ayaka' }
    ];

    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });

    const text = container.textContent;
    // Check summary counters
    expect(text).toContain('4Found');
    expect(text).toContain('1New');
    expect(text).toContain('1Updates');
    expect(text).toContain('1Up to date');

    // Check tags
    expect(text).toContain('New');
    expect(text).toContain('Unchanged');
    expect(text).toContain('Update');
    expect(text).toContain('Unmapped');

    // Check specific characters
    expect(text).toContain('Hu Tao');
    expect(text).toContain('Kamisato Ayaka');
    expect(text).toContain('Traveler Cryo');
    expect(text).toContain('Not yet supported by Toolkit data (ID: 99999999)'); // unmapped character safely handled

    // Check weapon
    expect(text).toContain('Staff of Homa'); // Hu Tao's new weapon
    expect(text).toContain('Amenoma Kageuchi'); // Ayaka's weapon
  });

  it('local-ahead appears as warning, not generic error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: 10000046, level: 80, ascension: 5, weapon: { id: 13501, level: 90 } }, // Hu Tao remote is 80
        ]
      })
    });
    mockState.roster = {
      'Hu Tao': { level: 90, ascension: 6 } // Local is 90
    };

    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const needsAttentionBtn = buttons.find(b => b.textContent === 'Needs Attention');

    await act(async () => {
      needsAttentionBtn.click();
    });

    // It should show up in Needs Attention because local is ahead
    expect(container.textContent).toContain('Hu Tao');
  });

  it('weapon mismatch appears safely in Needs Attention', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90 } }, // Remote: Homa
        ]
      })
    });
    mockState.roster = {
      'Hu Tao': { level: 90, ascension: 6, equippedWeaponId: 'w_bane' }
    };
    mockState.trackedWeapons = [
      { id: 'w_bane', weapon_id: 'dragonsbane', weaponName: "Dragon's Bane", assignedTo: 'Hu Tao' }
    ];

    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const needsAttentionBtn = buttons.find(b => b.textContent === 'Needs Attention');

    await act(async () => {
      needsAttentionBtn.click();
    });

    expect(container.textContent).toContain('Dragon\'s Bane');
    expect(container.textContent).toContain('Staff of Homa');
  });

  it('closing preview does not mutate roster or trackedWeapons (deep snapshot)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90 } },
        ]
      })
    });

    const initialRoster = { 'Hu Tao': { level: 80 } };
    const initialWeapons = [{ id: 'w1' }];
    mockState.roster = JSON.parse(JSON.stringify(initialRoster));
    mockState.trackedWeapons = JSON.parse(JSON.stringify(initialWeapons));

    const mockOnClose = vi.fn();

    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={mockOnClose} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const closeBtn = buttons.find(b => b.textContent === 'Close');

    await act(async () => {
      closeBtn.click();
    });

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockState.roster).toEqual(initialRoster);
    expect(mockState.trackedWeapons).toEqual(initialWeapons);
  });

  it('renders generic server failure safely without mutation', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Rate limit exceeded' })
    });

    await act(async () => {
      root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('Rate limit exceeded');
    expect(container.textContent).toContain('Retry');
  });

});
