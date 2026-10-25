import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharacterModal from './CharacterModal';
import AddWeaponModal from './AddWeaponModal';
import AddCharacterModal from './AddCharacterModal';
import BatchAddWeaponModal from './BatchAddWeaponModal';
import BulkEditCharacterModal from './BulkEditCharacterModal';
import BulkEditWeaponModal from './BulkEditWeaponModal';
import CustomSelect from './CustomSelect';
import useStore from '../store/useStore';

vi.mock('../data/weapons.json', () => ({
  default: [
    { name: 'Aquila Favonia', type: 'Sword', rarity: '5' },
    { name: 'Mistsplitter Reforged', type: 'Sword', rarity: '5' },
    { name: 'Favonius Sword', type: 'Sword', rarity: '4' },
    { name: 'Wolf\'s Gravestone', type: 'Claymore', rarity: '5' },
    { name: 'The Catch', type: 'Polearm', rarity: '4' },
    { name: 'Prototype Amber', type: 'Catalyst', rarity: '4' },
    { name: 'Rust', type: 'Bow', rarity: '4' }
  ]
}));
vi.mock('../utils/characters', () => ({
  default: [
    { name: 'Jean', rarity: 5, element: 'Anemo', weapon_type: 'Sword' },
    { name: 'Ayaka', rarity: 5, element: 'Cryo', weapon_type: 'Sword' },
    { name: 'Kaeya', rarity: 4, element: 'Cryo', weapon_type: 'Sword' },
    { name: 'Kazuha', rarity: 5, element: 'Anemo', weapon_type: 'Sword' },
    { name: 'Diluc', rarity: 5, element: 'Pyro', weapon_type: 'Claymore' }
  ]
}));
vi.mock('../store/useStore');
vi.mock('../utils/assetHelper', () => ({
  getElementIcon: () => 'icon',
  getCharacterAvatar: () => 'avatar',
  getWeaponTypeIcon: () => 'w_icon',
  getWeaponIcon: () => 'weapon_icon'
}));
vi.mock('./GenshinImage', () => ({
  default: ({ src, alt }) => <img src={src} alt={alt} />
}));

describe('Stage R6A Modals Responsive & Accessibility Suite', () => {
  let container = null;
  let root = null;
  let mockState;

  const mockJean = {
    name: 'Jean',
    rarity: 5,
    element: 'Anemo',
    weapon_type: 'Sword',
    materials: {}
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState = {
      roster: {
        'Jean': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: 'w1' },
        'Ayaka': { level: 90, ascension: 6, targetLevel: 90, targetAscension: 6, equippedWeaponId: 'w3' }
      },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Aquila Favonia', assignedTo: 'Jean', level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, currentRefinement: 1 },
        { id: 'w2', weaponName: 'Mistsplitter Reforged', assignedTo: null, level: 1, ascension: 0, targetLevel: 90, targetAscension: 6, currentRefinement: 1 },
        { id: 'w3', weaponName: 'Aquila Favonia', assignedTo: 'Ayaka', level: 90, ascension: 6, targetLevel: 90, targetAscension: 6, currentRefinement: 2 }
      ],
      forgingData: {},
      saveCharacterDraft: vi.fn(),
      removeCharacter: vi.fn(),
      batchAddCharacters: vi.fn(),
      bulkUpdateCharacters: vi.fn(),
      addTrackedWeapon: vi.fn().mockReturnValue('w-new-uuid'),
      updateTrackedWeapon: vi.fn(),
      unassignWeapon: vi.fn()
    };

    useStore.mockImplementation((selector) => selector(mockState));
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
  });

  describe('CharacterModal Mobile Navigation & Accessibility', () => {
    it('renders dialog with aria-modal and title, and triggers prev/next on mobile chevrons', () => {
      const onPrev = vi.fn();
      const onNext = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <CharacterModal
            character={mockJean}
            onClose={onClose}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={true}
            hasNext={true}
          />
        );
      });

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      // Mobile prev button in header
      const prevBtn = document.querySelector('button[aria-label="Previous character"]');
      const nextBtn = document.querySelector('button[aria-label="Next character"]');
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();

      act(() => {
        prevBtn.click();
      });
      expect(onPrev).toHaveBeenCalledTimes(1);

      act(() => {
        nextBtn.click();
      });
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('dismisses cleanly via Escape key when clean', () => {
      const onClose = vi.fn();
      act(() => {
        root.render(
          <CharacterModal
            character={mockJean}
            onClose={onClose}
          />
        );
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('verifies delete control accessibility, focus styling, and full-height panel structure', () => {
      const onClose = vi.fn();
      act(() => {
        root.render(
          <CharacterModal
            character={mockJean}
            onClose={onClose}
          />
        );
      });

      // Panel should use 100dvh on mobile and avoid modal-panel's 92vh cap
      const panel = document.querySelector('#char-modal-panel');
      expect(panel).toBeTruthy();
      expect(panel.classList.contains('modal-panel')).toBe(false);
      expect(panel.className).toContain('h-[100dvh]');
      expect(panel.className).toContain('max-h-[100dvh]');

      // Delete button accessibility & focus target
      const removeBtn = document.querySelector('#modal-remove-btn');
      expect(removeBtn).toBeTruthy();
      expect(removeBtn.getAttribute('aria-label')).toBe('Remove Jean from roster');
      expect(removeBtn.getAttribute('title')).toBe('Remove Jean from roster');
      expect(removeBtn.className).toContain('focus-visible:ring-2');

      act(() => {
        removeBtn.click();
      });
      expect(mockState.removeCharacter).toHaveBeenCalledWith('Jean');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('AddWeaponModal Identity & Progression', () => {
    it('supports step 1 selection and transition to step 2 configuration', () => {
      const onClose = vi.fn();
      act(() => {
        root.render(<AddWeaponModal onClose={onClose} />);
      });

      // Step 1: Search input exists
      const search = document.querySelector('input[type="search"]');
      expect(search).toBeTruthy();

      // Find weapon cards inside the scrollable grid
      const grid = document.querySelector('.grid');
      const weaponCardBtns = Array.from(grid.querySelectorAll('button'));
      expect(weaponCardBtns.length).toBeGreaterThan(0);

      act(() => {
        weaponCardBtns[0].click();
      });

      // In step 2, back button and Add to Armory button appear
      const backBtn = document.querySelector('button[aria-label="Back to weapon selection"]');
      expect(backBtn).toBeTruthy();

      const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add to Armory'));
      expect(addBtn).toBeTruthy();

      act(() => {
        addBtn.click();
      });
      expect(mockState.addTrackedWeapon).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('preserves exact weapon editing mode when existingWeapon is provided', () => {
      const onClose = vi.fn();
      const existing = {
        ...mockState.trackedWeapons[0],
        data: { name: 'Aquila Favonia', type: 'Sword', rarity: '5' }
      };

      act(() => {
        root.render(
          <AddWeaponModal
            existingWeapon={existing}
            onClose={onClose}
          />
        );
      });

      // Should render Step 2 directly with existing weapon info
      const heading = document.querySelector('h2');
      expect(heading.textContent).toContain('Aquila Favonia');
      expect(document.body.textContent).toContain('In Armory');
    });

    it('calls onPrev and onNext in edit mode', () => {
      const onPrev = vi.fn();
      const onNext = vi.fn();
      const existing = {
        ...mockState.trackedWeapons[0],
        data: { name: 'Aquila Favonia', type: 'Sword', rarity: '5' }
      };

      act(() => {
        root.render(
          <AddWeaponModal
            existingWeapon={existing}
            onClose={vi.fn()}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={true}
            hasNext={true}
          />
        );
      });

      const prevBtn = document.querySelector('button[aria-label="Previous weapon"]');
      const nextBtn = document.querySelector('button[aria-label="Next weapon"]');
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();

      act(() => { prevBtn.click(); });
      expect(onPrev).toHaveBeenCalledTimes(1);

      act(() => { nextBtn.click(); });
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('renders non-overlapping header layout and preserves navigation controls for long weapon names', () => {
      const existing = {
        id: 'w-long',
        weaponName: 'Harbinger of Dawn',
        assignedTo: null,
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        currentRefinement: 5,
        data: { name: 'Harbinger of Dawn', type: 'Sword', rarity: '3' }
      };

      act(() => {
        root.render(
          <AddWeaponModal
            existingWeapon={existing}
            onClose={vi.fn()}
            onPrev={vi.fn()}
            onNext={vi.fn()}
            hasPrev={true}
            hasNext={true}
          />
        );
      });

      const heading = document.querySelector('h2');
      expect(heading.textContent).toBe('Harbinger of Dawn');
      expect(heading.className).toContain('break-words');
      expect(heading.getAttribute('title')).toBe('Harbinger of Dawn');

      // Verify all navigation and dismiss controls are in the DOM and accessible
      expect(document.querySelector('button[aria-label="Previous weapon"]')).toBeTruthy();
      expect(document.querySelector('button[aria-label="Next weapon"]')).toBeTruthy();
      expect(document.querySelector('button[aria-label="Back to weapon selection"]')).toBeTruthy();
      expect(document.querySelector('button[aria-label="Close modal"]')).toBeTruthy();

      // Badges
      expect(document.body.textContent).toContain('Sword');
      expect(document.body.textContent).toContain('In Armory');
    });
  });

  describe('AddCharacterModal Batch Selection & Global Baseline', () => {
    it('allows searching, multi-selection, and configuring baseline', () => {
      const onClose = vi.fn();
      act(() => {
        root.render(<AddCharacterModal onClose={onClose} />);
      });

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();

      const searchInput = document.querySelector('input[type="search"]');
      expect(searchInput).toBeTruthy();

      // Filter characters
      act(() => {
        searchInput.value = 'Ka';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const grid = document.querySelector('.grid');
      const charCards = Array.from(grid.querySelectorAll('button'));
      expect(charCards.length).toBeGreaterThan(0);

      act(() => {
        charCards[0].click();
      });

      // Next button
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next: Configure'));
      expect(nextBtn).toBeTruthy();
      expect(nextBtn.disabled).toBe(false);

      act(() => {
        nextBtn.click();
      });

      // In Step 2, global baseline configuration is present
      expect(document.body.textContent).toContain('Global Baseline Configuration');

      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm & Add'));
      expect(confirmBtn).toBeTruthy();

      act(() => {
        confirmBtn.click();
      });

      expect(mockState.batchAddCharacters).toHaveBeenCalled();
      expect(mockState.bulkUpdateCharacters).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('BatchAddWeaponModal Batch Selection & Counter Stepper', () => {
    it('manages weapon quantities and applies global level configuration', () => {
      const onClose = vi.fn();
      act(() => {
        root.render(<BatchAddWeaponModal isOpen={true} onClose={onClose} />);
      });

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();

      // Click a weapon card to select 1
      const grid = document.querySelector('.grid');
      const weaponCards = Array.from(grid.querySelectorAll('[role="button"]'));
      expect(weaponCards.length).toBeGreaterThan(0);

      act(() => {
        weaponCards[0].click();
      });

      // Stepper button '+' should be available
      const plusBtn = document.querySelector('button[aria-label*="Increase"]');
      expect(plusBtn).toBeTruthy();

      act(() => {
        plusBtn.click();
      });

      // Next button
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next: Configure'));
      expect(nextBtn).toBeTruthy();
      expect(nextBtn.disabled).toBe(false);

      act(() => {
        nextBtn.click();
      });

      expect(document.body.textContent).toContain('Global Baseline Configuration');

      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add to Armory'));
      expect(confirmBtn).toBeTruthy();

      act(() => {
        confirmBtn.click();
      });

      expect(mockState.addTrackedWeapon).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('BulkEdit Modals Accessibility & Responsiveness', () => {
    it('BulkEditCharacterModal renders accessible dialog and applies overrides', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();
      act(() => {
        root.render(
          <BulkEditCharacterModal
            isOpen={true}
            onClose={onClose}
            selectedIds={['Jean', 'Ayaka']}
            onSave={onSave}
          />
        );
      });

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      // Toggle current level override checkbox
      const currentCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      expect(currentCheckboxes.length).toBeGreaterThan(0);

      act(() => {
        currentCheckboxes[0].click();
      });

      const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Apply Overrides'));
      expect(applyBtn).toBeTruthy();

      act(() => {
        applyBtn.click();
      });

      expect(onSave).toHaveBeenCalled();
    });

    it('BulkEditWeaponModal renders accessible dialog and applies overrides', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();
      act(() => {
        root.render(
          <BulkEditWeaponModal
            isOpen={true}
            onClose={onClose}
            selectedIds={['w1', 'w2']}
            onSave={onSave}
          />
        );
      });

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();

      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      expect(checkboxes.length).toBeGreaterThan(0);

      act(() => {
        checkboxes[0].click();
      });

      const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Apply Overrides'));
      expect(applyBtn).toBeTruthy();

      act(() => {
        applyBtn.click();
      });

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('CustomSelect Combobox & Keyboard Accessibility', () => {
    it('renders accessible combobox and triggers onChange', () => {
      const onChange = vi.fn();
      const options = [
        { id: '', name: '— Unassigned —' },
        { id: 'Jean', name: 'Jean', rarity: 5 },
        { id: 'Ayaka', name: 'Ayaka', rarity: 5 }
      ];

      act(() => {
        root.render(
          <CustomSelect
            options={options}
            value="Jean"
            onChange={onChange}
            placeholder="Select..."
          />
        );
      });

      const trigger = document.querySelector('button[role="combobox"]');
      expect(trigger).toBeTruthy();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      // Click to open
      act(() => {
        trigger.click();
      });

      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox).toBeTruthy();

      const optionElements = Array.from(document.querySelectorAll('[role="option"]'));
      expect(optionElements.length).toBe(3);

      act(() => {
        optionElements[2].click();
      });

      expect(onChange).toHaveBeenCalledWith('Ayaka');
    });
  });
});
