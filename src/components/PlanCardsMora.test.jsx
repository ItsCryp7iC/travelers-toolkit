import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CharacterPlanCard from './CharacterPlanCard';
import WeaponPlanCard from './WeaponPlanCard';

describe('Plan Cards Mora Display Parity (DEF-C2-07)', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('renders gross Mora in CharacterPlanCard when totalCosts has canonical Mora key', async () => {
    const entryObj = {
      name: 'Jean',
      character: true,
      entry: { level: 80, targetLevel: 90 },
      totalCosts: { Mora: 684625, HerosWit: 172 },
    };

    await act(async () => {
      root.render(<CharacterPlanCard entryObj={entryObj} inventory={{}} categories={{ Mora: 'mora' }} />);
    });

    expect(container.textContent).toContain('Mora: 684,625');
    expect(container.textContent).not.toContain('Mora: 0');
  });

  it('renders gross Mora in WeaponPlanCard when totalCosts has canonical Mora key', async () => {
    const entryObj = {
      name: 'Aquila Favonia',
      isWeapon: true,
      entry: { id: 'w-aquila-card', level: 80, targetLevel: 90 },
      totalCosts: { Mora: 436478, MysticEnhancementOre: 371 },
    };

    await act(async () => {
      root.render(<WeaponPlanCard entryObj={entryObj} inventory={{}} categories={{ Mora: 'mora' }} />);
    });

    expect(container.textContent).toContain('Mora: 436,478');
    expect(container.textContent).not.toContain('Mora: 0');
  });

  it('renders fallback lowercase mora key if legacy object format is passed', async () => {
    const entryObj = {
      name: 'Aquila Favonia',
      isWeapon: true,
      entry: { id: 'w-legacy-card', level: 80, targetLevel: 90 },
      totalCosts: { mora: 403978, MysticEnhancementOre: 371 },
    };

    await act(async () => {
      root.render(<WeaponPlanCard entryObj={entryObj} inventory={{}} categories={{ mora: 'mora' }} />);
    });

    expect(container.textContent).toContain('Mora: 403,978');
  });
});

