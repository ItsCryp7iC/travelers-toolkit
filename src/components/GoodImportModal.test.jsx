import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GoodImportModal from './GoodImportModal';

vi.mock('../utils/assetHelper', () => ({
  getCharacterAvatar: () => 'avatar.png',
  getWeaponIcon: () => 'weapon.png',
  getMaterialIcon: () => 'mat.png',
}));

vi.mock('./GenshinImage', () => ({
  default: () => <span data-testid="mock-genshin-img" />,
}));

describe('GoodImportModal Flattened Material Categories & Patch Semantics (C5)', () => {
  let container = null;
  let root = null;

  const sampleParsedData = {
    characters: [
      { name: 'Kamisato Ayaka', level: 90, ascension: 6, talents: { normal: 10, skill: 10, burst: 10 } },
    ],
    weapons: [
      { weaponName: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 5, location: 'Kamisato Ayaka' },
    ],
    materials: {
      'Mora': 500000,
      'HurricaneSeed': 20, // Normal Boss
      'DvalinsPlume': 6,   // Weekly Boss
      'SlimeCondensate': 150, // Common Enemy
      'HeavyHorn': 45, // Elite Enemy
      'TeachingsOfFreedom': 12, // Talent
      'TileOfDecarabiansTower': 15, // Weapon Asc
      'CrystalChunk': 80, // Forging
      'Wolfhook': 30, // Local Specialty
      'BrilliantDiamondSliver': 5, // Character Gem
      'UnknownCustomMat': 1, // Other
    },
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  // Helper to switch main tabs
  const switchMainTab = async (tabName) => {
    const tabBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.trim().toLowerCase() === tabName.toLowerCase()
    );
    if (!tabBtn) throw new Error(`Tab ${tabName} not found`);
    await act(async () => {
      tabBtn.click();
    });
  };

  // Helper to switch material category tab
  const switchMatTab = async (categoryName) => {
    const btn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.trim() === categoryName
    );
    if (!btn) throw new Error(`Material category button ${categoryName} not found`);
    await act(async () => {
      btn.click();
    });
  };

  // 1. flat material tabs render in exact order
  it('renders all 11 flat material tabs in exact required order', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');

    const expectedTabs = [
      'Currency & Exp',
      'Normal Boss Drops',
      'Weekly Boss Drops',
      'Common Enemy Drops',
      'Elite Enemy Drops',
      'Talent Mats',
      'Weapon Asc Mats',
      'Forging Mats',
      'Local Specialties',
      'Character Gems',
      'Other',
    ];

    const categoryButtons = Array.from(
      container.querySelectorAll('#material-category-tabs button')
    ).map(b => b.textContent.trim());

    expect(categoryButtons).toEqual(expectedTabs);
  });

  // 2. "Boss Drops" parent tab does NOT render
  it('"Boss Drops" parent tab does NOT render', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');

    const allButtons = Array.from(container.querySelectorAll('button')).map(b => b.textContent.trim());
    expect(allButtons).not.toContain('Boss Drops');
  });

  // 3. "Enemy Drops" parent tab does NOT render
  it('"Enemy Drops" parent tab does NOT render', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');

    const allButtons = Array.from(container.querySelectorAll('button')).map(b => b.textContent.trim());
    expect(allButtons).not.toContain('Enemy Drops');
  });

  // 4. no Normal/Weekly sub-tab row
  it('does not render a Normal/Weekly sub-tab row when Normal Boss Drops is active', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Normal Boss Drops');

    // Should only have the 11 category buttons plus "Deselect All / Select All" and modal buttons
    const subTabRows = container.querySelectorAll('.ml-4');
    expect(subTabRows.length).toBe(0);
  });

  // 5. no Common/Elite sub-tab row
  it('does not render a Common/Elite sub-tab row when Common Enemy Drops is active', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Common Enemy Drops');

    const subTabRows = container.querySelectorAll('.ml-4');
    expect(subTabRows.length).toBe(0);
  });

  // 6. switching Normal Boss Drops shows only normal boss materials
  it('switching Normal Boss Drops shows only normal boss materials', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Normal Boss Drops');

    const text = container.textContent;
    expect(text).toContain('Hurricane Seed');
    expect(text).not.toContain("Dvalin's Plume");
  });

  // 7. switching Weekly Boss Drops shows only weekly boss materials
  it('switching Weekly Boss Drops shows only weekly boss materials', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Weekly Boss Drops');

    const text = container.textContent;
    expect(text).toContain("Dvalin's Plume");
    expect(text).not.toContain('Hurricane Seed');
  });

  // 8. Common Enemy Drops filters correctly
  it('Common Enemy Drops filters correctly', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Common Enemy Drops');

    const text = container.textContent;
    expect(text).toContain('Slime Condensate');
    expect(text).not.toContain('Heavy Horn');
  });

  // 9. Elite Enemy Drops filters correctly
  it('Elite Enemy Drops filters correctly', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Elite Enemy Drops');

    const text = container.textContent;
    expect(text).toContain('Heavy Horn');
    expect(text).not.toContain('Slime Condensate');
  });

  // 10. selections persist while switching material tabs
  it('selections persist while switching material tabs', async () => {
    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Normal Boss Drops');

    // Deselect Hurricane Seed
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);

    await act(async () => {
      checkbox.click();
    });
    expect(checkbox.checked).toBe(false);

    // Switch to another tab and back
    await switchMatTab('Weekly Boss Drops');
    await switchMatTab('Normal Boss Drops');

    const checkboxAfter = container.querySelector('input[type="checkbox"]');
    expect(checkboxAfter.checked).toBe(false);
  });

  // 11. deselected Weapons produce weapons: []
  it('deselected Weapons produce weapons: []', async () => {
    const onConfirmMock = vi.fn();

    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={onConfirmMock}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('weapons');

    // Click Deselect All on weapons
    const deselectBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Deselect All')
    );
    expect(deselectBtn).toBeDefined();

    await act(async () => {
      deselectBtn.click();
    });

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Confirm Import')
    );

    await act(async () => {
      confirmBtn.click();
    });

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    const finalData = onConfirmMock.mock.calls[0][0];
    expect(finalData.weapons).toEqual([]);
    expect(finalData.characters.length).toBeGreaterThan(0);
  });

  // 12. deselected Characters produce characters: []
  it('deselected Characters produce characters: []', async () => {
    const onConfirmMock = vi.fn();

    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={onConfirmMock}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('characters');

    const deselectBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Deselect All')
    );
    expect(deselectBtn).toBeDefined();

    await act(async () => {
      deselectBtn.click();
    });

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Confirm Import')
    );

    await act(async () => {
      confirmBtn.click();
    });

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    const finalData = onConfirmMock.mock.calls[0][0];
    expect(finalData.characters).toEqual([]);
    expect(finalData.weapons.length).toBeGreaterThan(0);
  });

  // 13. only checked materials included in finalData
  it('only checked materials included in finalData', async () => {
    const onConfirmMock = vi.fn();

    await act(async () => {
      root.render(
        <GoodImportModal
          parsedData={sampleParsedData}
          onConfirm={onConfirmMock}
          onCancel={vi.fn()}
        />
      );
    });

    await switchMainTab('materials');
    await switchMatTab('Currency & Exp');

    // Deselect Mora
    const moraCheckbox = container.querySelector('input[type="checkbox"]');
    expect(moraCheckbox.checked).toBe(true);
    await act(async () => {
      moraCheckbox.click();
    });
    expect(moraCheckbox.checked).toBe(false);

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Confirm Import')
    );

    await act(async () => {
      confirmBtn.click();
    });

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    const finalData = onConfirmMock.mock.calls[0][0];
    expect(finalData.materials['Mora']).toBeUndefined();
    expect(finalData.materials['HurricaneSeed']).toBe(20);
  });

  describe('GoodImportModal Responsive & Accessibility (R6B)', () => {
    it('renders dialog with accessible attributes, role="dialog" and aria-modal', async () => {
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('good-import-title');

      const title = container.querySelector('#good-import-title');
      expect(title).toBeTruthy();
      expect(title.textContent).toContain('Review GOOD Import');

      const closeBtn = container.querySelector('button[aria-label="Close modal"]');
      expect(closeBtn).toBeTruthy();

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeTruthy();

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(3);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    });

    it('dismisses modal on Escape key press', async () => {
      const onCancelMock = vi.fn();
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={onCancelMock}
          />
        );
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('dismisses when clicking backdrop overlay, but not dialog panel', async () => {
      const onCancelMock = vi.fn();
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={onCancelMock}
          />
        );
      });

      const overlay = container.querySelector('.modal-overlay');
      const panel = container.querySelector('#good-import-panel');

      // Click inside panel
      act(() => {
        panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onCancelMock).not.toHaveBeenCalled();

      // Click overlay backdrop
      act(() => {
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('supports mobile full-height viewport styling without modal-panel class override', async () => {
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });

      const panel = container.querySelector('#good-import-panel');
      expect(panel).toBeTruthy();
      expect(panel.className).toContain('h-[100dvh]');
      expect(panel.className).toContain('max-h-[100dvh]');
      expect(panel.className).not.toContain('modal-panel');
    });

    it('provides horizontal scrolling container for flat material tabs with flex-nowrap on mobile', async () => {
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });

      await switchMainTab('materials');

      const matTabsContainer = container.querySelector('#material-category-tabs');
      expect(matTabsContainer).toBeTruthy();
      expect(matTabsContainer.className).toContain('overflow-x-auto');
      expect(matTabsContainer.className).toContain('flex-nowrap');
      expect(matTabsContainer.className).toContain('sm:flex-wrap');
    });

    it('preserves selections across tab switches', async () => {
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });

      // Deselect character
      const charCheckbox = container.querySelector('input[type="checkbox"]');
      expect(charCheckbox.checked).toBe(true);
      await act(async () => {
        charCheckbox.click();
      });
      expect(charCheckbox.checked).toBe(false);

      // Switch to materials tab
      await switchMainTab('materials');
      expect(container.textContent).toContain('Currency & Exp');

      // Switch back to characters tab
      await switchMainTab('characters');
      const restoredCharCheckbox = container.querySelector('input[type="checkbox"]');
      expect(restoredCharCheckbox.checked).toBe(false);
    });

    it('triggers onCancel when Cancel button is clicked', async () => {
      const onCancelMock = vi.fn();
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={onCancelMock}
          />
        );
      });

      const cancelBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent.trim() === 'Cancel'
      );
      expect(cancelBtn).toBeTruthy();

      await act(async () => {
        cancelBtn.click();
      });

      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('manages body scroll lock safely, restoring previous overflow style on unmount', async () => {
      document.body.style.overflow = 'scroll';

      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });

      expect(document.body.style.overflow).toBe('hidden');

      await act(async () => {
        root.unmount();
      });

      expect(document.body.style.overflow).toBe('scroll');
      document.body.style.overflow = '';
    });

    it('cleans up keydown event listener on unmount so Escape does not trigger after unmount', async () => {
      const onCancelMock = vi.fn();
      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={vi.fn()}
            onCancel={onCancelMock}
          />
        );
      });

      await act(async () => {
        root.unmount();
      });

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onCancelMock).not.toHaveBeenCalled();
    });

    it('ensures dismissal via Close button, Escape, backdrop, or Cancel never invokes onConfirm', async () => {
      const onConfirmMock = vi.fn();
      const onCancelMock = vi.fn();

      await act(async () => {
        root.render(
          <GoodImportModal
            parsedData={sampleParsedData}
            onConfirm={onConfirmMock}
            onCancel={onCancelMock}
          />
        );
      });

      // 1. Close button
      const closeBtn = container.querySelector('button[aria-label="Close modal"]');
      await act(async () => {
        closeBtn.click();
      });
      expect(onCancelMock).toHaveBeenCalledTimes(1);
      expect(onConfirmMock).not.toHaveBeenCalled();

      // 2. Escape key
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onCancelMock).toHaveBeenCalledTimes(2);
      expect(onConfirmMock).not.toHaveBeenCalled();

      // 3. Backdrop click
      const overlay = container.querySelector('.modal-overlay');
      act(() => {
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onCancelMock).toHaveBeenCalledTimes(3);
      expect(onConfirmMock).not.toHaveBeenCalled();

      // 4. Cancel button in footer
      const cancelBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent.trim() === 'Cancel'
      );
      await act(async () => {
        cancelBtn.click();
      });
      expect(onCancelMock).toHaveBeenCalledTimes(4);
      expect(onConfirmMock).not.toHaveBeenCalled();
    });
  });
});
