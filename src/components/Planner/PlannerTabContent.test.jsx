import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PlannerTabContent from './PlannerTabContent';

// Mock child components to isolate PlannerTabContent testing
vi.mock('../WeaponPlanCard', () => ({
  default: ({ entryObj }) => <div data-testid="weapon-plan-card">{entryObj.name} - {entryObj.entry.id}</div>
}));
vi.mock('../CharacterPlanCard', () => ({
  default: () => <div>Character</div>
}));
vi.mock('../DomainCard', () => ({
  default: () => <div>Domain</div>
}));
vi.mock('../FarmableToday', () => ({
  default: () => <div>FarmableToday</div>
}));
vi.mock('./PlannerCategorySection', () => ({
  default: () => <div>CategorySection</div>
}));

describe('PlannerTabContent', () => {
  let container;
  let root;
  let consoleErrorSpy;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    consoleErrorSpy.mockRestore();
  });

  it('renders multiple duplicate-name tracked weapons without duplicate key warnings', async () => {
    const mockTotals = {
      totalCosts: {},
      categories: {},
      breakdown: [
        {
          name: 'Favonius Warbow',
          character: false,
          isWeapon: true,
          entry: { id: 'weapon-copy-1', weaponName: 'Favonius Warbow' },
          totalCosts: { Mora: 1000 },
        },
        {
          name: 'Favonius Warbow',
          character: false,
          isWeapon: true,
          entry: { id: 'weapon-copy-2', weaponName: 'Favonius Warbow' },
          totalCosts: { Mora: 2000 },
        },
      ],
    };

    await act(async () => {
      root.render(
        <PlannerTabContent
          activeTab="per_weapon"
          toFarm={{}}
          totals={mockTotals}
          inventory={{}}
          groupedBooksData={{}}
          groupedWeaponMatsData={{}}
          groupedGemstonesData={{}}
          groupedWeeklyBosses={{}}
          groupedNormalBosses={{}}
          groupedLocalSpecialties={{}}
          groupedEliteEnemies={{}}
          groupedCommonEnemies={{}}
        />
      );
    });

    // Verify both tracked instances render completely independently
    expect(container.textContent).toContain('weapon-copy-1');
    expect(container.textContent).toContain('weapon-copy-2');

    // Filter calls to check strictly for the React duplicate key warning
    const duplicateKeyCalls = consoleErrorSpy.mock.calls.filter(args =>
      args.some(arg =>
        String(arg).includes('Encountered two children with the same key')
      )
    );
    
    expect(duplicateKeyCalls).toHaveLength(0);
  });
});
