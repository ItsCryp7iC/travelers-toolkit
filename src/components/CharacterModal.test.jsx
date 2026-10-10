import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharacterModal from './CharacterModal';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../data/weapons.json', () => ({
  default: [
    { name: 'Sword A', type: 'Sword', rarity: '5' },
    { name: 'Sword B', type: 'Sword', rarity: '4' }
  ]
}));
vi.mock('../utils/assetHelper', () => ({
  getElementIcon: () => 'icon',
  getCharacterAvatar: () => 'avatar',
  getWeaponTypeIcon: () => 'w_icon',
  getWeaponIcon: () => 'weapon_icon'
}));
vi.mock('../utils/travelerHelper', () => ({
  getTravelerAwareWeaponId: (name, entry) => entry?.equippedWeaponId || null
}));
vi.mock('./GenshinImage', () => ({
  default: () => <div>GenshinImage</div>
}));
vi.mock('./CustomSelect', () => ({
  default: ({ value, onChange, options }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}));

describe('CharacterModal Cancel Semantics', () => {
  let mockSaveCharacterDraft;
  let mockRemoveCharacter;
  let container = null;
  let root = null;
  let mockOnClose;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockSaveCharacterDraft = vi.fn();
    mockRemoveCharacter = vi.fn();
    mockOnClose = vi.fn();

    useStore.mockImplementation((selector) => {
      const state = {
        roster: {
          'Jean': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: 'w1' }
        },
        trackedWeapons: [
          { id: 'w1', weaponName: 'Sword A', assignedTo: 'Jean', level: 80, ascension: 5, targetLevel: 90, targetAscension: 6 }
        ],
        saveCharacterDraft: mockSaveCharacterDraft,
        removeCharacter: mockRemoveCharacter,
        addCharacter: vi.fn(),
        updateCharacter: vi.fn(),
        addTrackedWeapon: vi.fn(),
        updateTrackedWeapon: vi.fn(),
        unassignWeapon: vi.fn()
      };
      return selector(state);
    });
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

  it('TEST 1 - weapon selection cancel', () => {
    renderModal();
    console.log(container.innerHTML);
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'Sword B';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
    const closeBtn = document.body.querySelector('#modal-close-btn');
    act(() => { closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });

  it('TEST 2 - weapon progression cancel', () => {
    renderModal();
    const sliders = document.body.querySelectorAll('input[type="range"]');
    const weaponLevelSlider = sliders[1]; // second slider is weapon current level
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

  it('TEST 3 & 4 - Save weapon replacement and progression', () => {
    renderModal();
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'Sword B';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const sliders = document.body.querySelectorAll('input[type="range"]');
    const weaponLevelSlider = sliders[1];
    act(() => {
      weaponLevelSlider.value = 50;
      weaponLevelSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const saveBtn = document.body.querySelector('#modal-save-btn');
    act(() => { saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockSaveCharacterDraft).toHaveBeenCalledWith('Jean', expect.objectContaining({
      weaponName: 'Sword B'
    }));
  });

  it('TEST 5 & 6 - character progression cancel and save', () => {
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

  it('TEST 7 & 8 - Escape and overlay cancel', () => {
    renderModal();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(mockOnClose).toHaveBeenCalled();
    mockOnClose.mockClear();
    const overlay = document.body.querySelector('#char-modal-overlay');
    act(() => { overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });

  it('TEST 9 - navigation discard', () => {
    let mockOnNext = vi.fn();
    renderModal({ hasNext: true, onNext: mockOnNext });
    const select = document.body.querySelector('select');
    act(() => {
      select.value = 'Sword B';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); });
    expect(mockOnNext).toHaveBeenCalled();
    expect(mockSaveCharacterDraft).not.toHaveBeenCalled();
  });
});
