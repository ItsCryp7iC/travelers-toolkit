import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Weapons from './Weapons';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../components/AddWeaponModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="add-weapon-modal">Add Modal</div> : null
}));
vi.mock('../components/BatchAddWeaponModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="batch-weapon-modal">Batch Modal</div> : null
}));
vi.mock('../components/BulkEditWeaponModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="bulk-weapon-modal">Bulk Modal</div> : null
}));
vi.mock('../components/ForgingQueuePanel', () => ({
  default: () => <div data-testid="forging-queue">Forging Queue Panel</div>
}));

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Weapons Page Component Architecture', () => {
  let container = null;
  let root = null;
  let mockState = {};

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      trackedWeapons: [
        {
          id: 'w1',
          weapon_id: 'DullBlade',
          weaponName: 'Dull Blade',
          level: 70,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 1,
          assignedTo: 'Kamisato Ayaka',
          priority: 3
        },
        {
          id: 'w2',
          weapon_id: 'BeginnersProtector',
          weaponName: "Beginner's Protector",
          level: 70,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 5,
          assignedTo: 'Xiangling',
          priority: 2
        },
        {
          id: 'w3',
          weapon_id: 'HuntersBow',
          weaponName: "Hunter's Bow",
          level: 70,
          targetLevel: 70,
          ascension: 4,
          targetAscension: 4,
          refinement: 3,
          assignedTo: null,
          priority: 1
        }
      ],
      removeTrackedWeapon: vi.fn(),
      batchRemoveWeapons: vi.fn(),
      updateTrackedWeapon: vi.fn(),
      bulkUpdateWeapons: vi.fn()
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
      root.render(<Weapons />);
    });
  };

  it('renders tracked weapons in table view by default', async () => {
    await renderComponent();

    expect(container.textContent).toContain('Dull Blade');
    expect(container.textContent).toContain("Beginner's Protector");
    expect(container.textContent).toContain("Hunter's Bow");
  });

  it('filters by weapon type correctly', async () => {
    await renderComponent();

    const polearmBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.trim() === 'Polearm'
    );
    expect(polearmBtn).toBeTruthy();

    await act(async () => {
      polearmBtn.click();
    });

    expect(container.textContent).toContain("Beginner's Protector");
    expect(container.textContent).not.toContain('Dull Blade');
    expect(container.textContent).not.toContain("Hunter's Bow");
  });

  it('filters by search input correctly', async () => {
    await renderComponent();

    const searchInput = container.querySelector('input[type="search"]');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(searchInput, 'Dull');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('Dull Blade');
    expect(container.textContent).not.toContain("Beginner's Protector");
    expect(container.textContent).not.toContain("Hunter's Bow");
  });

  it('updates sort order dropdown without breaking table', async () => {
    await renderComponent();

    const sortSelect = container.querySelector('#sort-select');
    expect(sortSelect).toBeTruthy();

    await act(async () => {
      sortSelect.value = 'Name';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Dull Blade');
    expect(container.textContent).toContain("Beginner's Protector");
    expect(container.textContent).toContain("Hunter's Bow");
  });

  it('switches to forge tab correctly', async () => {
    await renderComponent();

    const forgeTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent.includes('To Forge')
    );
    expect(forgeTabBtn).toBeTruthy();

    await act(async () => {
      forgeTabBtn.click();
    });

    expect(container.querySelector('[data-testid="forging-queue"]')).toBeTruthy();
  });
});
