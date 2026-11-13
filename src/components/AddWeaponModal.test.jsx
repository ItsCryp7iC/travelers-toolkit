import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import AddWeaponModal from './AddWeaponModal';
import CharacterModal from './CharacterModal';
import useStore from '../store/useStore';
import { clearActivityHistory, getActivityEvents } from '../activity/activityStore';
import weaponsData from '../data/weapons.json';
import charactersData from '../utils/characters';

describe('AddWeaponModal UX Bug Fix Suite', () => {
  let container = null;
  let root = null;

  const hodData = weaponsData.find((w) => w.name === 'Harbinger of Dawn') || {
    name: 'Harbinger of Dawn',
    type: 'Sword',
    rarity: 3,
  };

  const favSwordData = weaponsData.find((w) => w.name === 'Favonius Sword') || {
    name: 'Favonius Sword',
    type: 'Sword',
    rarity: 4,
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    clearActivityHistory();

    // Reset store state
    useStore.setState({
      roster: {
        Kaeya: {
          level: 70,
          ascension: 4,
          targetLevel: 80,
          targetAscension: 5,
          equippedWeaponId: 'hod-uuid-1',
          talents: { normal: 6, skill: 6, burst: 6 },
          targetTalents: { normal: 8, skill: 8, burst: 8 },
        },
        Jean: {
          level: 80,
          ascension: 5,
          targetLevel: 90,
          targetAscension: 6,
          equippedWeaponId: 'fav-uuid-1',
          talents: { normal: 6, skill: 6, burst: 6 },
          targetTalents: { normal: 8, skill: 8, burst: 8 },
        },
      },
      trackedWeapons: [
        {
          id: 'hod-uuid-1',
          weapon_id: 'harbingerofdawn',
          weaponName: 'Harbinger of Dawn',
          assignedTo: 'Kaeya',
          level: 70,
          ascension: 4,
          targetLevel: 80,
          targetAscension: 5,
          currentRefinement: 5,
          targetRefinement: 5,
          hasEventBonus: false,
          createdAt: 1000,
        },
        {
          id: 'fav-uuid-1',
          weapon_id: 'favoniussword',
          weaponName: 'Favonius Sword',
          assignedTo: 'Jean',
          level: 80,
          ascension: 5,
          targetLevel: 90,
          targetAscension: 6,
          currentRefinement: 3,
          targetRefinement: 5,
          hasEventBonus: false,
          createdAt: 2000,
        },
      ],
      achievementProgress: {},
      inventory: {},
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    // Clean up any portal-created elements
    document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
    document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  // 1. Opening an existing weapon displays "Save Progress"
  it('1. Opening an existing weapon displays "Save Progress"', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const saveBtn = buttons.find((b) => b.textContent.trim() === 'Save Progress');
    expect(saveBtn).toBeTruthy();

    const addBtn = buttons.find((b) => b.textContent.trim() === 'Add to Armory');
    expect(addBtn).toBeFalsy();
  });

  // 2. Opening a new weapon displays "Add to Armory"
  it('2. Opening a new weapon displays "Add to Armory"', () => {
    act(() => {
      root.render(<AddWeaponModal onClose={vi.fn()} />);
    });

    // In step 1, pick a weapon card
    const firstWeaponBtn = document.querySelector('.grid button');
    expect(firstWeaponBtn).toBeTruthy();

    act(() => {
      firstWeaponBtn.click();
    });

    // Step 2 configure
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find((b) => b.textContent.trim() === 'Add to Armory');
    expect(addBtn).toBeTruthy();

    const saveBtn = buttons.find((b) => b.textContent.trim() === 'Save Progress');
    expect(saveBtn).toBeFalsy();
  });

  // 3. Preselecting a new weapon using initialWeapon still uses add mode
  it('3. Preselecting a new weapon using initialWeapon still uses add mode', () => {
    act(() => {
      root.render(<AddWeaponModal initialWeapon={hodData} onClose={vi.fn()} />);
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find((b) => b.textContent.trim() === 'Add to Armory');
    expect(addBtn).toBeTruthy();

    const saveBtn = buttons.find((b) => b.textContent.trim() === 'Save Progress');
    expect(saveBtn).toBeFalsy();

    // Verify "In Armory" badge is not shown in add mode
    expect(document.body.textContent).not.toContain('✓ In Armory');
  });

  // 4. Editing an assigned weapon displays "Equipped By (optional)"
  it('4. Editing an assigned weapon displays "Equipped By (optional)"', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const headings = Array.from(document.querySelectorAll('h3'));
    const heading = headings.find((h) => h.textContent.includes('Equipped By'));
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Equipped By (optional)');
  });

  // 5. Adding a weapon displays "Assign to Character (optional)"
  it('5. Adding a weapon displays "Assign to Character (optional)"', () => {
    act(() => {
      root.render(<AddWeaponModal initialWeapon={hodData} onClose={vi.fn()} />);
    });

    const headings = Array.from(document.querySelectorAll('h3'));
    const heading = headings.find((h) => h.textContent.includes('Assign to Character'));
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Assign to Character (optional)');
  });

  // 6. Editing Harbinger of Dawn assigned to Kaeya shows "Currently Equipped"
  it('6. Editing Harbinger of Dawn assigned to Kaeya shows "Currently Equipped"', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    // The combobox displays the current value
    const combobox = document.querySelector('[role="combobox"]');
    expect(combobox).toBeTruthy();
    expect(combobox.textContent).toContain('Kaeya');
    expect(combobox.textContent).toContain('Currently Equipped');
  });

  // 7. The current owner does not display a false warning about the same weapon
  it('7. The current owner does not display a false warning about the same weapon', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const combobox = document.querySelector('[role="combobox"]');
    expect(combobox.textContent).not.toContain('⚠️');
    expect(combobox.textContent).not.toContain('(has Harbinger of Dawn)');

    // Open dropdown
    act(() => {
      combobox.click();
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const kaeyaOption = options.find((opt) => opt.textContent.includes('Kaeya'));
    expect(kaeyaOption).toBeTruthy();
    expect(kaeyaOption.textContent).toContain('Currently Equipped');
    expect(kaeyaOption.textContent).not.toContain('⚠️');
  });

  // 8. Saving an unchanged assignment does not trigger a replacement prompt
  it('8. Saving an unchanged assignment does not trigger a replacement prompt', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );

    act(() => {
      saveBtn.click();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // 9. Editing an existing weapon preserves its UUID
  it('9. Editing an existing weapon preserves its UUID', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );

    act(() => {
      saveBtn.click();
    });

    const weapons = useStore.getState().trackedWeapons;
    expect(weapons[0].id).toBe('hod-uuid-1');
  });

  // 10. Editing an existing weapon does not increase the armory count
  it('10. Editing an existing weapon does not increase the armory count', () => {
    const initialCount = useStore.getState().trackedWeapons.length;
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );

    act(() => {
      saveBtn.click();
    });

    expect(useStore.getState().trackedWeapons.length).toBe(initialCount);
  });

  // 11. Editing progression updates the correct tracked weapon
  it('11. Editing progression updates the correct tracked weapon', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    // Click ascension button 6 for target ascension
    const a6Buttons = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === '6');
    // The target ascension selector has the last '6' button
    const targetA6 = a6Buttons[a6Buttons.length - 1];
    act(() => {
      targetA6.click();
    });

    // Also change target level slider to 90
    const levelSliders = document.querySelectorAll('input.level-slider');
    // Index 0: Current Level, Index 1: Current Refinement, Index 2: Target Level, Index 3: Target Refinement
    const targetLevelSlider = levelSliders[2];
    act(() => {
      fireEvent.change(targetLevelSlider, { target: { value: '90' } });
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );

    act(() => {
      saveBtn.click();
    });

    const weapon = useStore.getState().trackedWeapons.find((w) => w.id === 'hod-uuid-1');
    expect(weapon.targetAscension).toBe(6);
    expect(weapon.targetLevel).toBe(90);
  });

  // 12. Saving without changes does not create an Activity History event
  it('12. Saving without changes does not create an Activity History event', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );

    act(() => {
      saveBtn.click();
    });

    const events = getActivityEvents();
    expect(events.filter((e) => e.entityId === 'hod-uuid-1')).toHaveLength(0);
  });

  // 13. Saving a progression change records the existing weapon update event
  it('13. Saving a progression change records the existing weapon update event', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    // Change target ascension to 6
    const a6Buttons = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === '6');
    const targetA6 = a6Buttons[a6Buttons.length - 1];
    act(() => {
      targetA6.click();
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );

    act(() => {
      saveBtn.click();
    });

    const events = getActivityEvents();
    const updateEvent = events.find((e) => e.entityId === 'hod-uuid-1' && e.action === 'weapon_updated');
    expect(updateEvent).toBeTruthy();
    expect(updateEvent.summary).toContain('Harbinger of Dawn progression updated');

    // Ensure NO weapon_added event was produced
    const addEvent = events.find((e) => e.action === 'weapon_added');
    expect(addEvent).toBeFalsy();
  });

  // 14. Two Harbinger of Dawn instances with different UUIDs are treated as distinct
  it('14. Two Harbinger of Dawn instances with different UUIDs are treated as distinct', () => {
    // Add a second unassigned Harbinger of Dawn with a different UUID
    useStore.setState({
      trackedWeapons: [
        ...useStore.getState().trackedWeapons,
        {
          id: 'hod-uuid-2',
          weapon_id: 'harbingerofdawn',
          weaponName: 'Harbinger of Dawn',
          assignedTo: null,
          level: 1,
          ascension: 0,
          targetLevel: 90,
          targetAscension: 6,
          currentRefinement: 1,
          targetRefinement: 1,
          hasEventBonus: false,
          createdAt: 3000,
        },
      ],
    });

    const secondHod = {
      ...useStore.getState().trackedWeapons[2],
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={secondHod} onClose={vi.fn()} />);
    });

    // Open character assignment dropdown
    const combobox = document.querySelector('[role="combobox"]');
    act(() => {
      combobox.click();
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const kaeyaOption = options.find((opt) => opt.textContent.includes('Kaeya'));
    expect(kaeyaOption).toBeTruthy();
    // For hod-uuid-2, Kaeya has hod-uuid-1 equipped, so it is a conflict (State C)
    expect(kaeyaOption.textContent).toContain('⚠️ Equipped: Harbinger of Dawn');
    expect(kaeyaOption.textContent).not.toContain('Currently Equipped');
  });

  // 15. A genuine conflicting assignment still displays a warning
  it('15. A genuine conflicting assignment still displays a warning', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0], // hod-uuid-1 assigned to Kaeya
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    // Open dropdown to see Jean (who has Favonius Sword)
    const combobox = document.querySelector('[role="combobox"]');
    act(() => {
      combobox.click();
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const jeanOption = options.find((opt) => opt.textContent.includes('Jean'));
    expect(jeanOption).toBeTruthy();
    expect(jeanOption.textContent).toContain('⚠️ Equipped: Favonius Sword');
  });

  // 16. Canceling a replacement confirmation preserves the original state
  it('16. Canceling a replacement confirmation preserves the original state', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const existing = {
      ...useStore.getState().trackedWeapons[0], // hod-uuid-1 assigned to Kaeya
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    // Open dropdown and select Jean (who already has Favonius Sword)
    const combobox = document.querySelector('[role="combobox"]');
    act(() => {
      combobox.click();
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const jeanOption = options.find((opt) => opt.textContent.includes('Jean'));
    act(() => {
      jeanOption.click();
    });

    // Click Save Progress
    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );
    act(() => {
      saveBtn.click();
    });

    // Replacement prompt was triggered
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Jean already has "Favonius Sword" equipped. Replace it with "Harbinger of Dawn"?')
    );

    // Because confirm was cancelled, state remains untouched
    const weapons = useStore.getState().trackedWeapons;
    const hod = weapons.find((w) => w.id === 'hod-uuid-1');
    expect(hod.assignedTo).toBe('Kaeya');
  });

  // 17. Selecting Unassigned removes the assignment correctly
  it('17. Selecting Unassigned removes the assignment correctly', () => {
    const existing = {
      ...useStore.getState().trackedWeapons[0], // hod-uuid-1 assigned to Kaeya
      data: hodData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={existing} onClose={vi.fn()} />);
    });

    // Open dropdown and select Unassigned
    const combobox = document.querySelector('[role="combobox"]');
    act(() => {
      combobox.click();
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const unassignedOption = options.find((opt) => opt.textContent.includes('Unassigned'));
    expect(unassignedOption).toBeTruthy();
    act(() => {
      unassignedOption.click();
    });

    // Save
    const saveBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Save Progress'
    );
    act(() => {
      saveBtn.click();
    });

    const weapons = useStore.getState().trackedWeapons;
    const hod = weapons.find((w) => w.id === 'hod-uuid-1');
    expect(hod.assignedTo).toBeNull();

    // Kaeya's equippedWeaponId should also be null
    const roster = useStore.getState().roster;
    expect(roster.Kaeya.equippedWeaponId).toBeNull();
  });

  // 18. Previous/next navigation refreshes the edit-mode values and current owner
  it('18. Previous/next navigation refreshes the edit-mode values and current owner', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const weapon1 = {
      ...useStore.getState().trackedWeapons[0], // Kaeya's Harbinger of Dawn Lv70
      data: hodData,
    };
    const weapon2 = {
      ...useStore.getState().trackedWeapons[1], // Jean's Favonius Sword Lv80
      data: favSwordData,
    };

    // Render weapon1
    act(() => {
      root.render(
        <AddWeaponModal
          existingWeapon={weapon1}
          currentIndex={0}
          hasNext={true}
          hasPrev={false}
          onNext={onNext}
          onPrev={onPrev}
          onClose={vi.fn()}
        />
      );
    });

    expect(document.querySelector('h2').textContent).toBe('Harbinger of Dawn');
    expect(document.querySelector('[role="combobox"]').textContent).toContain('Kaeya');
    expect(document.querySelector('[role="combobox"]').textContent).toContain('Currently Equipped');

    // Click next
    const nextBtn = document.querySelector('button[aria-label="Next weapon"]');
    expect(nextBtn).toBeTruthy();
    act(() => {
      nextBtn.click();
    });
    expect(onNext).toHaveBeenCalledTimes(1);

    // Re-render with weapon2 (simulating parent state change)
    act(() => {
      root.render(
        <AddWeaponModal
          existingWeapon={weapon2}
          currentIndex={1}
          hasNext={false}
          hasPrev={true}
          onNext={onNext}
          onPrev={onPrev}
          onClose={vi.fn()}
        />
      );
    });

    expect(document.querySelector('h2').textContent).toBe('Favonius Sword');
    expect(document.querySelector('[role="combobox"]').textContent).toContain('Jean');
    expect(document.querySelector('[role="combobox"]').textContent).toContain('Currently Equipped');
  });

  // 19. Traveler weapon assignments continue to behave correctly
  it('19. Traveler weapon assignments continue to behave correctly', () => {
    // Set up Traveler Anemo and Geo in roster
    useStore.setState({
      roster: {
        ...useStore.getState().roster,
        'Traveler Anemo': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: null },
        'Traveler Geo': { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6, equippedWeaponId: null },
      },
      trackedWeapons: [
        ...useStore.getState().trackedWeapons,
        {
          id: 'traveler-sword-id',
          weapon_id: 'mistsplitterreforged',
          weaponName: 'Mistsplitter Reforged',
          assignedTo: 'Traveler Anemo',
          level: 90,
          ascension: 6,
          targetLevel: 90,
          targetAscension: 6,
          currentRefinement: 1,
          targetRefinement: 1,
          hasEventBonus: false,
          createdAt: 4000,
        },
      ],
    });

    const mistData = weaponsData.find((w) => w.name === 'Mistsplitter Reforged') || {
      name: 'Mistsplitter Reforged',
      type: 'Sword',
      rarity: 5,
    };

    const travelerWeapon = {
      ...useStore.getState().trackedWeapons[2],
      data: mistData,
    };

    act(() => {
      root.render(<AddWeaponModal existingWeapon={travelerWeapon} onClose={vi.fn()} />);
    });

    // Open dropdown
    const combobox = document.querySelector('[role="combobox"]');
    act(() => {
      combobox.click();
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const anemoOption = options.find((opt) => opt.textContent.includes('Traveler Anemo'));
    const geoOption = options.find((opt) => opt.textContent.includes('Traveler Geo'));

    expect(anemoOption).toBeTruthy();
    expect(geoOption).toBeTruthy();

    // Both Traveler variants share the sword, so both show Currently Equipped
    expect(anemoOption.textContent).toContain('Currently Equipped');
    expect(geoOption.textContent).toContain('Currently Equipped');

    // Neither has a conflict warning
    expect(anemoOption.textContent).not.toContain('⚠️');
    expect(geoOption.textContent).not.toContain('⚠️');
  });

  // 20. The existing Character configuration modal remains unaffected
  it('20. The existing Character configuration modal remains unaffected', () => {
    const kaeyaChar = charactersData.find((c) => c.name === 'Kaeya');

    act(() => {
      root.render(<CharacterModal character={kaeyaChar} onClose={vi.fn()} />);
    });

    // Character modal save button should show "💾 Save Progress"
    const saveBtn = document.querySelector('#modal-save-btn');
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.textContent).toContain('Save Progress');

    // Character modal should have delete button since Kaeya is in roster
    const removeBtn = document.querySelector('#modal-remove-btn');
    expect(removeBtn).toBeTruthy();
  });
});
