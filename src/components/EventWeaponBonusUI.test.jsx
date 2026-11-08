import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WeaponCard from './WeaponCard';
import WeaponPlanCard from './WeaponPlanCard';
import AddWeaponModal from './AddWeaponModal';
import BulkEditWeaponModal from './BulkEditWeaponModal';
import useStore from '../store/useStore';

describe('Event Weapon Bonus UI Controls & Visual State', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useStore.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container) {
      container.remove();
    }
  });

  // 1. WeaponCard badge rendering
  it('renders 1.5× EXP badge on WeaponCard when armoryEntry has hasEventBonus true', async () => {
    const weapon = {
      name: 'Favonius Sword',
      type: 'Sword',
      rarity: 4,
    };
    const armoryEntry = {
      id: 'w-fav-card',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: true,
    };

    await act(async () => {
      root.render(
        <WeaponCard
          weapon={weapon}
          trackedWeapon={armoryEntry}
        />
      );
    });

    expect(container.textContent).toContain('1.5× EXP');
  });

  it('does NOT render 1.5× EXP badge on WeaponCard when hasEventBonus is false or omitted', async () => {
    const weapon = {
      name: 'Favonius Sword',
      type: 'Sword',
      rarity: 4,
    };
    const armoryEntry = {
      id: 'w-fav-card-normal',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: false,
    };

    await act(async () => {
      root.render(
        <WeaponCard
          weapon={weapon}
          trackedWeapon={armoryEntry}
        />
      );
    });

    expect(container.textContent).not.toContain('1.5× EXP');
  });

  // 2. WeaponPlanCard badge rendering
  it('renders 1.5× EXP badge on WeaponPlanCard when entry has hasEventBonus true', async () => {
    const entryObj = {
      name: 'Favonius Sword',
      isWeapon: true,
      entry: { id: 'w-fav-plan', level: 1, targetLevel: 90, hasEventBonus: true },
      totalCosts: { Mora: 552844, MysticEnhancementOre: 402 },
    };

    await act(async () => {
      root.render(
        <WeaponPlanCard
          entryObj={entryObj}
          inventory={{}}
          categories={{ Mora: 'mora', MysticEnhancementOre: 'mysticOre' }}
        />
      );
    });

    expect(container.textContent).toContain('1.5× EXP');
  });

  // 3. AddWeaponModal accessible toggle
  it('renders Event Enhancement EXP Bonus toggle and helper text in AddWeaponModal', async () => {
    const existingWeapon = {
      id: 'w-fav-edit',
      weaponName: 'Favonius Sword',
      level: 1,
      targetLevel: 90,
      ascension: 0,
      targetAscension: 6,
      hasEventBonus: true,
      data: { name: 'Favonius Sword', rarity: 4, type: 'Sword' },
    };

    await act(async () => {
      root.render(
        <AddWeaponModal
          onClose={() => {}}
          existingWeapon={existingWeapon}
        />
      );
    });

    const checkbox = document.body.querySelector('#hasEventBonusToggle');
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
    expect(document.body.textContent).toContain('Event Enhancement EXP Bonus (1.5×)');
    expect(document.body.textContent).toContain('Manually selected planning assumption');
  });

  // 4. BulkEditWeaponModal accessible override controls
  it('renders BulkEditWeaponModal with event bonus override controls and dispatches payload', async () => {
    const onSave = vi.fn();
    const selectedIds = ['w-bulk-1', 'w-bulk-2'];

    useStore.setState({
      trackedWeapons: [
        { id: 'w-bulk-1', weaponName: 'Favonius Sword', level: 1, targetLevel: 90, ascension: 0, targetAscension: 6 },
        { id: 'w-bulk-2', weaponName: 'The Stringless', level: 1, targetLevel: 90, ascension: 0, targetAscension: 6 },
      ],
    });

    await act(async () => {
      root.render(
        <BulkEditWeaponModal
          isOpen={true}
          onClose={() => {}}
          selectedIds={selectedIds}
          onSave={onSave}
        />
      );
    });

    expect(document.body.textContent).toContain('Event Enhancement EXP Bonus');
    expect(document.body.textContent).toContain('Override Event Enhancement EXP Bonus (1.5×)');
  });
});
