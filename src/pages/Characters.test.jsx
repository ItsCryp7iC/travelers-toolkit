import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Characters from './Characters';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../components/CharacterModal', () => ({
  default: ({ isOpen, character, onClose }) => isOpen ? <div data-testid="character-modal">Modal for {character?.name} <button onClick={onClose}>Close</button></div> : null
}));
vi.mock('../components/AddCharacterModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="add-character-modal">Add Modal</div> : null
}));
vi.mock('../components/BulkEditCharacterModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="bulk-modal">Bulk Modal</div> : null
}));
vi.mock('../components/HoyolabSyncPreviewModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="sync-modal">Sync Modal</div> : null
}));

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Characters Page Component Architecture', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      roster: {
        'Kamisato Ayaka': {
          currentLevel: 80,
          targetLevel: 90,
          currentAscension: 5,
          targetAscension: 6,
          currentTalents: { normal: 8, skill: 8, burst: 8 },
          targetTalents: { normal: 9, skill: 9, burst: 10 },
          priority: 3,
          equippedWeaponId: null
        },
        'Bennett': {
          currentLevel: 70,
          targetLevel: 80,
          currentAscension: 4,
          targetAscension: 5,
          currentTalents: { normal: 1, skill: 6, burst: 8 },
          targetTalents: { normal: 1, skill: 8, burst: 10 },
          priority: 2,
          equippedWeaponId: null
        },
        'Xiangling': {
          currentLevel: 70,
          targetLevel: 80,
          currentAscension: 4,
          targetAscension: 5,
          currentTalents: { normal: 1, skill: 6, burst: 8 },
          targetTalents: { normal: 1, skill: 8, burst: 10 },
          priority: 1,
          equippedWeaponId: null
        }
      },
      trackedWeapons: [],
      updateCharacter: vi.fn(),
      removeCharacter: vi.fn(),
      batchRemoveCharacters: vi.fn(),
      bulkUpdateCharacters: vi.fn(),
      hoyolabConnected: false,
      lastHoyolabCharacterSyncAt: null
    };

    useStore.mockImplementation((selector) => selector(mockState));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  const renderComponent = async () => {
    await act(async () => {
      root.render(<Characters />);
    });
  };

  it('renders rostered characters in table view by default', async () => {
    await renderComponent();

    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).toContain('Xiangling');
  });

  it('filters by element correctly', async () => {
    await renderComponent();

    // Find the Pyro element button
    const pyroButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.trim() === 'Pyro'
    );
    expect(pyroButton).toBeTruthy();

    await act(async () => {
      pyroButton.click();
    });

    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).toContain('Xiangling');
    expect(container.textContent).not.toContain('Kamisato Ayaka');
  });

  it('filters by weapon type correctly', async () => {
    await renderComponent();

    // Find Polearm button
    const polearmBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.trim() === 'Polearm'
    );
    expect(polearmBtn).toBeTruthy();

    await act(async () => {
      polearmBtn.click();
    });

    expect(container.textContent).toContain('Xiangling');
    expect(container.textContent).not.toContain('Bennett');
    expect(container.textContent).not.toContain('Kamisato Ayaka');
  });

  it('filters by search input correctly', async () => {
    await renderComponent();

    const searchInput = container.querySelector('input[type="search"]');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      // Simulate input search
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(searchInput, 'Ayaka');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).not.toContain('Bennett');
    expect(container.textContent).not.toContain('Xiangling');
  });

  it('updates sort order and direction without breaking table', async () => {
    await renderComponent();

    const sortSelect = container.querySelector('#sort-select');
    expect(sortSelect).toBeTruthy();

    await act(async () => {
      sortSelect.value = 'Name';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Content still contains all 3 characters
    expect(container.textContent).toContain('Bennett');
    expect(container.textContent).toContain('Kamisato Ayaka');
    expect(container.textContent).toContain('Xiangling');
  });
});
