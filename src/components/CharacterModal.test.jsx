import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharacterModal from './CharacterModal';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../data/weapons.json', () => ({
  default: [
    { name: 'Sword A', type: 'Sword', rarity: '5' },
    { name: 'Sword B', type: 'Sword', rarity: '4' },
    { name: 'Unowned Sword', type: 'Sword', rarity: '5' },
    { name: 'Claymore A', type: 'Claymore', rarity: '4' },
  ]
}));
vi.mock('../utils/assetHelper', () => ({
  getElementIcon: () => 'icon',
  getCharacterAvatar: () => 'avatar',
  getWeaponTypeIcon: () => 'w_icon',
  getWeaponIcon: () => 'weapon_icon'
}));
vi.mock('../utils/travelerHelper', () => ({
  getTravelerAwareWeaponId: (name, entry, tracked = []) => {
    if (name?.startsWith('Traveler ')) {
      const w = tracked?.find(item => item.assignedTo?.startsWith('Traveler '));
      return w ? w.id : null;
    }
    return entry?.equippedWeaponId || null;
  }
}));
vi.mock('./GenshinImage', () => ({
  default: () => <div>GenshinImage</div>
}));
vi.mock('./CustomSelect', () => ({
  default: ({ value, onChange, options }) => (
    <div data-testid="custom-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => (
          <option key={o.id} value={o.id} data-subtitle={o.subtitle || ''}>
            {o.name} {o.subtitle ? `(${o.subtitle})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}));

describe('CharacterModal Weapon Selection & Draft Semantics', () => {
  let mockSaveCharacterDraft;
  let mockRemoveCharacter;
  let container = null;
  let root = null;
  let mockOnClose;
  let mockState;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockSaveCharacterDraft = vi.fn();
    mockRemoveCharacter = vi.fn();
    mockOnClose = vi.fn();

    mockState = {
      roster: {
        'Jean': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: 'w1' },
        'Ayaka': { level: 90, ascension: 6, targetLevel: 90, targetAscension: 6, equippedWeaponId: 'w3' },
        'Traveler Anemo': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: null },
        'Traveler Geo': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: null },
      },
      trackedWeapons: [
        { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 80, ascension: 6, targetLevel: 90, targetAscension: 6, currentRefinement: 1 },
        { id: 'w2', weaponName: 'Sword B', assignedTo: null, level: 40, ascension: 2, targetLevel: 70, targetAscension: 4, currentRefinement: 2 },
        { id: 'w3', weaponName: 'Sword A', assignedTo: 'Ayaka', level: 90, ascension: 6, targetLevel: 90, targetAscension: 6, currentRefinement: 5 },
        { id: 'w-claymore', weaponName: 'Claymore A', assignedTo: null, level: 50, ascension: 2, targetLevel: 90, targetAscension: 6, currentRefinement: 1 },
        { id: 'w-unmapped', weaponName: 'UnknownWeapon999', assignedTo: null, level: 1, ascension: 0, targetLevel: 90, targetAscension: 6, currentRefinement: 1 },
        { id: 'w-traveler', weaponName: 'Sword A', assignedTo: 'Traveler Anemo', level: 70, ascension: 4, targetLevel: 90, targetAscension: 6, currentRefinement: 3 }
      ],
      saveCharacterDraft: mockSaveCharacterDraft,
      removeCharacter: mockRemoveCharacter,
      addCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      addTrackedWeapon: vi.fn(),
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

  const renderModal = (props = {}) => {
    act(() => {
      root.render(
        <CharacterModal
          character={{ name: 'Jean', rarity: 5, element: 'Anemo', weapon_type: 'Sword' }}
          onClose={mockOnClose}
          {...props}
        />
      );
    });
  };

  it('1. dropdown lists ONLY tracked weapons and excludes unowned static weapons', () => {
    renderModal();
    const options = Array.from(document.body.querySelectorAll('select option'));
    const optionValues = options.map(o => o.value);
    const optionTexts = options.map(o => o.textContent);

    // Static unowned weapon should NOT appear
    expect(optionValues).not.toContain('Unowned Sword');
    expect(optionTexts.some(t => t.includes('Unowned Sword'))).toBe(false);
  });

  it('2. static unowned weapons do not appear', () => {
    renderModal();
    const optionTexts = Array.from(document.body.querySelectorAll('select option')).map(o => o.textContent);
    expect(optionTexts.some(t => t.includes('Unowned Sword'))).toBe(false);
  });

  it('3. incompatible weapon types do not appear', () => {
    renderModal();
    const optionValues = Array.from(document.body.querySelectorAll('select option')).map(o => o.value);
    expect(optionValues).not.toContain('w-claymore');
  });

  it('4. compatible owned weapons appear', () => {
    renderModal();
    const optionValues = Array.from(document.body.querySelectorAll('select option')).map(o => o.value);
    expect(optionValues).toContain('w1');
    expect(optionValues).toContain('w2');
  });

  it('5. duplicate copies appear separately with distinct IDs', () => {
    renderModal();
    const options = Array.from(document.body.querySelectorAll('select option'));
    const optionValues = options.map(o => o.value);
    // Both w1 and w3 are "Sword A", both must appear
    expect(optionValues).toContain('w1');
    expect(optionValues).toContain('w3');

    const w1Opt = options.find(o => o.value === 'w1');
    const w3Opt = options.find(o => o.value === 'w3');
    expect(w1Opt).toBeDefined();
    expect(w3Opt).toBeDefined();
    expect(w1Opt.getAttribute('data-subtitle')).toContain('Assigned to: Jean');
    expect(w3Opt.getAttribute('data-subtitle')).toContain('Assigned to: Ayaka');
  });

  it('6. options use tracked UUIDs rather than weapon names', () => {
    renderModal();
    const optionValues = Array.from(document.body.querySelectorAll('select option')).map(o => o.value);
    expect(optionValues).toContain('');
    expect(optionValues).toContain('w1');
    expect(optionValues).toContain('w2');
    expect(optionValues).not.toContain('Sword A');
    expect(optionValues).not.toContain('Sword B');
  });

  it('7. current exact instance is selected by UUID', () => {
    renderModal();
    const select = document.body.querySelector('select');
    expect(select.value).toBe('w1');
  });

  it('8. choosing existing unassigned weapon reuses UUID', () => {
    renderModal();
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'w2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Jean', expect.objectContaining({
      weaponId: 'w2'
    }));
  });

  it('9. choosing weapon assigned to another roster character reuses UUID and moves assignment', () => {
    renderModal();
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'w3'; // assigned to Ayaka
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Jean', expect.objectContaining({
      weaponId: 'w3'
    }));
  });

  it('11. No Weapon Equipped unassigns without deleting', () => {
    renderModal();
    const select = document.body.querySelector('select');
    act(() => {
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Jean', expect.objectContaining({
      weaponId: null,
      weaponProgression: null
    }));
  });

  it('12. selecting another weapon loads its stored progression immediately', () => {
    renderModal();
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'w2'; // level: 40, ascension: 2, targetLevel: 70, targetAscension: 4
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const sliders = document.body.querySelectorAll('input[type="range"]');
    // sliders[2] is weapon current level, sliders[3] is weapon target level
    expect(sliders[2].value).toBe('40');
    expect(sliders[3].value).toBe('70');
  });

  it('13. save updates selected exact instance progression', () => {
    renderModal();
    const sliders = document.body.querySelectorAll('input[type="range"]');
    const weaponCurrentSlider = sliders[2];
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(weaponCurrentSlider, 85);
      weaponCurrentSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Jean', expect.objectContaining({
      weaponId: 'w1',
      weaponProgression: expect.objectContaining({
        level: 85
      })
    }));
  });

  it('14. next/previous navigation resets selected instance properly', () => {
    let currentCharacter = { name: 'Jean', rarity: 5, element: 'Anemo', weapon_type: 'Sword' };
    const { rerender } = {
      rerender: (char) => {
        act(() => {
          root.render(
            <CharacterModal
              character={char}
              onClose={mockOnClose}
            />
          );
        });
      }
    };
    renderModal();
    let select = document.body.querySelector('select');
    expect(select.value).toBe('w1');

    // Switch to Ayaka who has w3
    rerender({ name: 'Ayaka', rarity: 5, element: 'Cryo', weapon_type: 'Sword' });
    select = document.body.querySelector('select');
    expect(select.value).toBe('w3');
  });

  it('15. unmapped tracked weapon handled safely without crashing', () => {
    renderModal();
    const optionValues = Array.from(document.body.querySelectorAll('select option')).map(o => o.value);
    expect(optionValues).not.toContain('w-unmapped');
  });

  it('16. Traveler regression - resolves shared weapon and preserves semantics', () => {
    act(() => {
      root.render(
        <CharacterModal
          character={{ name: 'Traveler Geo', rarity: 5, element: 'Geo', weapon_type: 'Sword' }}
          onClose={mockOnClose}
        />
      );
    });

    const select = document.body.querySelector('select');
    // Traveler Geo should resolve w-traveler assigned to Traveler Anemo
    expect(select.value).toBe('w-traveler');

    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Traveler Geo', expect.objectContaining({
      weaponId: 'w-traveler'
    }));
  });

  it('CANCEL TEST - weapon selection cancel', () => {
    renderModal();
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'w2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
    const closeBtn = document.body.querySelector('#modal-close-btn');
    act(() => { closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });

  it('CANCEL TEST - weapon progression cancel', () => {
    renderModal();
    const sliders = document.body.querySelectorAll('input[type="range"]');
    const weaponLevelSlider = sliders[2];
    act(() => {
      weaponLevelSlider.value = 50;
      weaponLevelSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
    const closeBtn = document.body.querySelector('#modal-close-btn');
    act(() => { closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });

  it('CANCEL TEST - character progression cancel and save', () => {
    renderModal();
    const sliders = document.body.querySelectorAll('input[type="range"]');
    const charLevelSlider = sliders[0];
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(charLevelSlider, 85);
      charLevelSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Jean', expect.any(Object));
  });

  it('CANCEL TEST - Escape and overlay cancel', () => {
    renderModal();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(mockOnClose).toHaveBeenCalled();
    mockOnClose.mockClear();
    const overlay = document.body.querySelector('#char-modal-overlay');
    act(() => { overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });

  it('CANCEL TEST - navigation discard', () => {
    let mockOnNext = vi.fn();
    renderModal({ hasNext: true, onNext: mockOnNext });
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'w2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); });
    expect(mockOnNext).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });
});
