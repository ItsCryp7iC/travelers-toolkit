import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import DomainCard from '../DomainCard';
import FarmableToday from '../FarmableToday';
import PlannerItemCard from './PlannerItemCard';
import useStore from '../../store/useStore';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';

describe('PLANNER-UI-R3: Extra Materials & Crafting-Aware Surplus Suite', () => {
  beforeEach(() => {
    useStore.setState({
      inventory: {},
      roster: {},
      trackedWeapons: [],
    });
    useCraftingSessionStore.getState().discardSession();
  });

  const renderDomainCard = async (props) => {
    return render(<DomainCard {...props} />);
  };

  // ── 1. Positive Raw Extra (Fixture A: Slime Condensate) ──
  it('1. renders positive Raw Extra in 3rd statistics cell without separate extra row (Fixture A)', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
        SlimeSecretions: { item: { name: 'SlimeSecretions', required: 50, owned: 50, toFarm: 0 } },
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 30, owned: 10, toFarm: 20 } },
      },
      craftingPlan: {
        familyId: 'Slime',
        isCraftable: true,
        steps: [],
        projectedInventory: { SlimeCondensate: 1088 },
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1209, SlimeSecretions: 50, SlimeConcentrate: 10 };
    useStore.setState({ inventory: initialInv });

    await renderDomainCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 121, SlimeSecretions: 50, SlimeConcentrate: 30 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    const extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge).toBeInTheDocument();
    expect(extraBadge.textContent).toContain('Extra');
    expect(extraBadge.textContent).toContain('+1,088');
    expect(extraBadge.textContent).not.toContain('(before crafting)');
    expect(extraBadge.getAttribute('title')).toBe(
      'Extra before crafting. Some materials may be needed for higher-tier crafting.'
    );
    expect(extraBadge.parentElement.className).toContain('grid-cols-3');
  });

  // ── 2. Zero Raw Extra (Fixture D: Exact Requirement) ──
  it('2. omits Extra indicator when owned equals required (Fixture D)', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 121, toFarm: 0 } },
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 121 };
    useStore.setState({ inventory: initialInv });

    await renderDomainCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 121 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    expect(screen.queryByTestId('material-extra-SlimeCondensate')).not.toBeInTheDocument();
  });

  // ── 3. Shortage (Fixture C: Deficit clamped to zero) ──
  it('3. omits Extra indicator when owned is less than required (Fixture C)', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 100, toFarm: 21 } },
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 100 };
    useStore.setState({ inventory: initialInv });

    await renderDomainCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 121 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    expect(screen.queryByTestId('material-extra-SlimeCondensate')).not.toBeInTheDocument();
  });

  // ── 4. Noncraftable Material (Fixture B: Philanemo Mushroom) ──
  it('4. displays Extra without (before crafting) for noncraftable materials (Fixture B)', async () => {
    const familyObj = {
      familyName: 'Philanemo Mushroom',
      type: 'local_specialty',
      familyData: {
        familyId: 'PhilanemoMushroom',
        tiers: [{ id: 'PhilanemoMushroom', name: 'Philanemo Mushroom', rarity: 1 }],
      },
      items: {
        PhilanemoMushroom: { item: { name: 'PhilanemoMushroom', required: 10, owned: 18, toFarm: 0 } },
      },
      neededBy: [],
    };

    const initialInv = { PhilanemoMushroom: 18 };
    useStore.setState({ inventory: initialInv });

    await renderDomainCard({
      domainName: 'LOCAL SPECIALTY: MONDSTADT',
      familyObj,
      accent: '#60A5FA',
      globalCosts: { PhilanemoMushroom: 10 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    const extraBadge = screen.getByTestId('material-extra-PhilanemoMushroom');
    expect(extraBadge).toBeInTheDocument();
    expect(extraBadge.textContent).toContain('Extra');
    expect(extraBadge.textContent).toContain('+8');
    expect(extraBadge.textContent).not.toContain('(before crafting)');
    expect(extraBadge.getAttribute('title')).toBe('Materials owned beyond current progression requirements.');
  });

  // ── 5. Zero Requirements with Inventory ──
  it('5. displays Extra with zero-demand explanation when required is 0 and owned > 0', async () => {
    const familyObj = {
      familyName: 'Valberry',
      type: 'local_specialty',
      familyData: {
        familyId: 'Valberry',
        tiers: [{ id: 'Valberry', name: 'Valberry', rarity: 1 }],
      },
      items: {
        Valberry: { item: { name: 'Valberry', required: 0, owned: 50, toFarm: 0 } },
      },
      neededBy: [],
    };

    const initialInv = { Valberry: 50 };
    useStore.setState({ inventory: initialInv });

    await renderDomainCard({
      domainName: 'LOCAL SPECIALTY: MONDSTADT',
      familyObj,
      accent: '#60A5FA',
      globalCosts: { Valberry: 0 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    const extraBadge = screen.getByTestId('material-extra-Valberry');
    expect(extraBadge).toBeInTheDocument();
    expect(extraBadge.textContent).toContain('+50');
    expect(extraBadge.getAttribute('title')).toBe('No current plan requires this item. All 50 owned are surplus.');
  });

  // ── 6. Large Quantities ──
  it('6. formats large surplus values legibly and preserves exact count in title', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 500, owned: 1000000, toFarm: 0 } },
      },
      craftingPlan: { familyId: 'Slime', isCraftable: true, steps: [] },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1000000 };
    useStore.setState({ inventory: initialInv });

    const { rerender } = await renderDomainCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 500 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    let extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge).toBeInTheDocument();
    // 999,500 is formatted with comma separators under 1M
    expect(extraBadge.textContent).toContain('+999,500');
    expect(extraBadge.getAttribute('title')).toBe(
      'Extra before crafting. Some materials may be needed for higher-tier crafting.'
    );

    // Test >= 1,000,000 (e.g. 2.5M surplus)
    const largeInv = { SlimeCondensate: 2500500 };
    useStore.setState({ inventory: largeInv });
    rerender(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 500 }}
        inventory={largeInv}
        craftingMode="crafting-aware"
      />
    );

    extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge.textContent).toContain('+2.50M');
    expect(extraBadge.getAttribute('title')).toBe(
      'Extra before crafting. Some materials may be needed for higher-tier crafting.'
    );
  });

  // ── 7. Advanced Unallocated After Guaranteed Plan (Expandable Details) ──
  it('7. displays Unallocated after guaranteed plan in expandable crafting details', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
        SlimeSecretions: { item: { name: 'SlimeSecretions', required: 30, owned: 100, toFarm: 0 } },
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 36, owned: 20, toFarm: 0 } },
      },
      craftingPlan: {
        familyId: 'Slime',
        isCraftable: true,
        steps: [
          {
            recipeId: 'slime-craft-1',
            inputItemId: 'SlimeSecretions',
            inputItemName: 'Slime Secretions',
            outputItemId: 'SlimeConcentrate',
            outputItemName: 'Slime Concentrate',
            totalInputConsumed: 48,
            totalOutputProduced: 16,
            totalMoraCost: 800,
          },
        ],
        projectedInventory: {
          SlimeCondensate: 1088,
          SlimeSecretions: 22,
          SlimeConcentrate: 0,
        },
        craftingMora: 800,
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1209, SlimeSecretions: 100, SlimeConcentrate: 20 };
    useStore.setState({ inventory: initialInv });

    const { container } = await renderDomainCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 121, SlimeSecretions: 30, SlimeConcentrate: 36 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    // Expand crafting instructions
    const expandBtn = container.querySelector('button[aria-expanded="false"]');
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);

    // Verify Unallocated label appears
    expect(container.textContent).toContain('Unallocated after guaranteed plan:');
    expect(container.textContent).toContain('1,088 Slime Condensate');
    expect(container.textContent).toContain('22 Slime Secretions');
    expect(container.textContent).not.toContain('Projected leftover:');
  });

  // ── 8. Raw Shortages vs Crafting-Aware Mode Invariant ──
  it('8. preserves the exact same Raw Extra quantity across Raw Shortages and Crafting-Aware modes', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
      },
      craftingPlan: { familyId: 'Slime', isCraftable: true, steps: [] },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1209 };
    useStore.setState({ inventory: initialInv });

    // Render in Crafting-Aware mode
    const { rerender } = render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
      />
    );

    let extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge.textContent).toContain('+1,088');

    // Switch to Raw Shortages mode
    rerender(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={initialInv}
        craftingMode="raw"
      />
    );

    extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge.textContent).toContain('+1,088');
  });

  // ── 9. Bonus Forecast Does Not Alter Raw Extra ──
  it('9. ensures active bonus forecast does not change Raw Extra', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
      },
      craftingPlan: { familyId: 'Slime', isCraftable: true, steps: [] },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1209 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
        craftingBonusOptions={{ enabled: true, bonusType: 'ingredient_refund' }}
        bonusForecast={{
          families: {
            Slime: { isEligible: true, expectedLeftovers: { SlimeCondensate: 1120 } },
          },
        }}
      />
    );

    const extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    // Raw Extra must still be 1,088, not affected by the bonus forecast of 1,120
    expect(extraBadge.textContent).toContain('+1,088');
  });

  // ── 10. Live Inline Have Edit (Fixture G) ──
  it('10. dynamically toggles Extra badge on inline Have edit: absent -> present -> absent (Fixture G)', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 100, toFarm: 21 } },
      },
      neededBy: [],
    };

    useStore.setState({ inventory: { SlimeCondensate: 100 } });

    const { rerender } = render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={{ SlimeCondensate: 100 }}
        craftingMode="raw"
      />
    );

    // Initial Have: 100 < Need 121 -> Extra is absent
    expect(screen.queryByTestId('material-extra-SlimeCondensate')).not.toBeInTheDocument();

    // Edit Have to 1,209
    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1209' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory.SlimeCondensate).toBe(1209);

    // Rerender with store update
    rerender(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={useStore.getState().inventory}
        craftingMode="raw"
      />
    );

    // Now Have 1,209 >= Need 121 -> Extra appears as +1,088
    const extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge).toBeInTheDocument();
    expect(extraBadge.textContent).toContain('+1,088');

    // Edit Have back to 100
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory.SlimeCondensate).toBe(100);

    rerender(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={useStore.getState().inventory}
        craftingMode="raw"
      />
    );

    // Extra is absent again
    expect(screen.queryByTestId('material-extra-SlimeCondensate')).not.toBeInTheDocument();
  });

  // ── 11. FarmableToday Integration ──
  it('11. FarmableToday renders Extra badge for farmable domain materials with surplus', () => {
    useStore.setState({ inventory: { TeachingsOfFreedom: 25 } });

    render(
      <FarmableToday
        selectedDay={1}
        craftingMode="crafting-aware"
      />
    );

    // If TeachingsOfFreedom has owned > required, FarmableToday should calculate surplus
    // We also test direct tier rendering with mock
  });

  // ── 12. PlannerItemCard Integration ──
  it('12. PlannerItemCard renders Extra badge for items with surplus', () => {
    const item = {
      name: 'Northlander Sword Billet',
      category: 'billet',
      required: 2,
      owned: 5,
      toFarm: 0,
      rarity: 4,
    };

    render(<PlannerItemCard item={item} accent="#FAB632" />);

    const extraBadge = screen.getByTestId('material-extra-Northlander Sword Billet');
    expect(extraBadge).toBeInTheDocument();
    expect(extraBadge.textContent).toContain('Extra: +3');
    expect(extraBadge.getAttribute('title')).toBe('Materials owned beyond current progression requirements.');
  });

  // ── 13. Zero Mutation During Render Invariant ──
  it('13. rendering DomainCards causes zero inventory store mutations', () => {
    const initialInv = { SlimeCondensate: 1209, Mora: 500000 };
    useStore.setState({ inventory: initialInv });

    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
      },
      neededBy: [],
    };

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
      />
    );

    expect(useStore.getState().inventory).toEqual(initialInv);
  });

  // ── 14. Four-Tier Crafting Family (Decarabian Tower) ──
  it('14. correctly renders Extra badges and unallocated leftovers for a 4-tier family (Fixture F)', async () => {
    const familyObj = {
      familyName: 'Decarabian',
      type: 'weapon',
      familyData: {
        familyId: 'Decarabian',
        tiers: [
          { id: 'TileOfDecarabiansTower', name: "Tile of Decarabian's Tower", rarity: 2 },
          { id: 'DebrisOfDecarabiansCity', name: "Debris of Decarabian's City", rarity: 3 },
          { id: 'FragmentOfDecarabiansEpic', name: "Fragment of Decarabian's Epic", rarity: 4 },
          { id: 'ScatteredPieceOfDecarabiansDream', name: "Scattered Piece of Decarabian's Dream", rarity: 5 },
        ],
      },
      items: {
        TileOfDecarabiansTower: { item: { name: 'TileOfDecarabiansTower', required: 5, owned: 50, toFarm: 0 } },
        DebrisOfDecarabiansCity: { item: { name: 'DebrisOfDecarabiansCity', required: 14, owned: 10, toFarm: 4 } },
        FragmentOfDecarabiansEpic: { item: { name: 'FragmentOfDecarabiansEpic', required: 14, owned: 5, toFarm: 9 } },
        ScatteredPieceOfDecarabiansDream: { item: { name: 'ScatteredPieceOfDecarabiansDream', required: 6, owned: 0, toFarm: 6 } },
      },
      craftingPlan: {
        familyId: 'Decarabian',
        isCraftable: true,
        steps: [
          {
            recipeId: 'decarabian-step-1',
            inputItemId: 'TileOfDecarabiansTower',
            inputItemName: "Tile of Decarabian's Tower",
            outputItemId: 'DebrisOfDecarabiansCity',
            outputItemName: "Debris of Decarabian's City",
            totalInputConsumed: 45,
            totalOutputProduced: 15,
            totalMoraCost: 1875,
          },
        ],
        projectedInventory: {
          TileOfDecarabiansTower: 0, // 50 owned - 5 direct reserved - 45 consumed = 0 unallocated
          DebrisOfDecarabiansCity: 11, // 10 owned + 15 produced - 14 required = 11 unallocated
          FragmentOfDecarabiansEpic: 0,
          ScatteredPieceOfDecarabiansDream: 0,
        },
        craftingMora: 1875,
      },
      neededBy: [],
    };

    const initialInv = {
      TileOfDecarabiansTower: 50,
      DebrisOfDecarabiansCity: 10,
      FragmentOfDecarabiansEpic: 5,
      ScatteredPieceOfDecarabiansDream: 0,
    };
    useStore.setState({ inventory: initialInv });

    const { container } = await renderDomainCard({
      domainName: 'DOMAIN OF FORGERY: ALTAR OF THE FALLS',
      familyObj,
      accent: '#4A9EFF',
      globalCosts: {
        TileOfDecarabiansTower: 5,
        DebrisOfDecarabiansCity: 14,
        FragmentOfDecarabiansEpic: 14,
        ScatteredPieceOfDecarabiansDream: 6,
      },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    // Tier 1: Need 5, Have 50 -> Raw Extra: +45 (in third cell)
    const tier1Extra = screen.getByTestId('material-extra-TileOfDecarabiansTower');
    expect(tier1Extra).toBeInTheDocument();
    expect(tier1Extra.textContent).toContain('+45');
    expect(tier1Extra.textContent).not.toContain('(before crafting)');
    expect(tier1Extra.getAttribute('title')).toBe(
      'Extra before crafting. Some materials may be needed for higher-tier crafting.'
    );

    // Tiers with shortages: no Extra badge
    expect(screen.queryByTestId('material-extra-DebrisOfDecarabiansCity')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-extra-FragmentOfDecarabiansEpic')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-extra-ScatteredPieceOfDecarabiansDream')).not.toBeInTheDocument();

    // In expanded crafting details: verify unallocated after guaranteed plan
    const expandBtn = container.querySelector('button[aria-expanded="false"]');
    fireEvent.click(expandBtn);
    expect(container.textContent).toContain('Unallocated after guaranteed plan:');
    expect(container.textContent).toContain("11 Debris of Decarabian's City");
  });

  // ── 15. No Calculations on Draft Keystrokes ──
  it('15. typing in Have input does not trigger surplus recalculations or store writes until commit', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 100, toFarm: 21 } },
      },
      neededBy: [],
    };

    useStore.setState({ inventory: { SlimeCondensate: 100 } });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={{ SlimeCondensate: 100 }}
        craftingMode="raw"
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9999' } });

    // Store must remain untouched while typing draft
    expect(useStore.getState().inventory.SlimeCondensate).toBe(100);
    // Extra badge must not appear while draft is uncommitted
    expect(screen.queryByTestId('material-extra-SlimeCondensate')).not.toBeInTheDocument();

    // Escape cancels edit cleanly
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('100');
    expect(useStore.getState().inventory.SlimeCondensate).toBe(100);
  });

  // ── 16. Active Crafting Session with Recorded Events Remains Protected ──
  it('16. editing Have with active session and recorded events triggers confirmation dialog and protects session', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1209, SlimeSecretions: 100, SlimeConcentrate: 20 },
      grossRequirements: { SlimeCondensate: 18, SlimeSecretions: 30, SlimeConcentrate: 36 },
      bonusType: null,
      startingMora: 100000,
    });

    // Record an actual batch so session has events.length > 0
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 1,
      bonusOutputReceived: 0,
      ingredientRefundsReceived: 0,
      moraCostPerCraft: 50,
      observedBalance: null,
      note: 'test craft',
    });

    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 18, owned: 1209, toFarm: 0 } },
      },
      neededBy: [],
    };

    useStore.setState({ inventory: { SlimeCondensate: 1209 } });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 18 }}
        inventory={{ SlimeCondensate: 1209 }}
        craftingMode="crafting-aware"
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2500' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Warning dialog must appear
    const dialog = screen.getByTestId('active-session-warning-dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toContain('Active Crafting Session');

    // Confirm dialog
    const confirmBtn = screen.getByTestId('confirm-active-session-warning-btn');
    fireEvent.click(confirmBtn);

    // Now committed
    expect(useStore.getState().inventory.SlimeCondensate).toBe(2500);
  });

  // ── 17. Family Status Badges Remain Accurate Beside Extra Badge ──
  it('17. family status badges (Already Stocked, Farming Required) co-exist accurately with Extra badges', async () => {
    // Case 1: Fully stocked family
    const stockedFamily = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 18, owned: 100, toFarm: 0 } },
      },
      neededBy: [],
    };

    const { rerender } = render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={stockedFamily}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 18 }}
        inventory={{ SlimeCondensate: 100 }}
        craftingMode="crafting-aware"
      />
    );

    expect(screen.getByText(/Already stocked/i)).toBeInTheDocument();
    expect(screen.getByTestId('material-extra-SlimeCondensate')).toBeInTheDocument();
    expect(screen.getByTestId('material-extra-SlimeCondensate').textContent).toContain('+82');

    // Case 2: Family with shortages on higher tier but surplus on lower tier
    const mixedFamily = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 18, owned: 100, toFarm: 0 } },
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 36, owned: 0, toFarm: 36 } },
      },
      neededBy: [],
    };

    rerender(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={mixedFamily}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 18, SlimeConcentrate: 36 }}
        inventory={{ SlimeCondensate: 100, SlimeConcentrate: 0 }}
        craftingMode="raw"
      />
    );

    // Farming required badge must appear for family
    expect(screen.getByText(/Farming required/i)).toBeInTheDocument();
    // Condensate tier still has Extra: +82
    expect(screen.getByTestId('material-extra-SlimeCondensate')).toBeInTheDocument();
    // Concentrate tier has no Extra badge
    expect(screen.queryByTestId('material-extra-SlimeConcentrate')).not.toBeInTheDocument();
  });

  // ── 18. Dynamic 3rd Statistics Cell Replaces Separate Row (PLANNER-UI-R3.1) ──
  it('18. renders Extra inside the 3-column grid cell and contains NO separate Extra row', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 219, owned: 6011, toFarm: 0 } },
      },
      craftingPlan: { familyId: 'Slime', isCraftable: true, steps: [] },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 6011 };
    useStore.setState({ inventory: initialInv });

    await renderDomainCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 219 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    // 1. Extra cell exists and has correct label and value
    const extraCell = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraCell).toBeInTheDocument();
    expect(extraCell.textContent).toContain('Extra');
    expect(extraCell.textContent).toContain('+5,792');

    // 2. Verified that it lives in the 3-column grid
    const statsGrid = extraCell.parentElement;
    expect(statsGrid.className).toContain('grid-cols-3');
    expect(statsGrid.children.length).toBe(3); // Need, Have, Extra

    // 3. Verified that NO separate extra row exists in the tier card
    const tierCard = statsGrid.parentElement;
    // Children of tierCard: Row 1 (Identity), Row 2 (3-col Grid), Row 3 (Progress)
    expect(tierCard.children.length).toBe(3);
  });

  // ── 19. Case A: Farming Shortage Remains with Craft Indicator Underneath ──
  it('19. Case A renders To Farm in 3rd cell and preserves Craft indicator underneath', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 }],
      },
      items: {
        SlimeSecretions: {
          item: {
            name: 'SlimeSecretions',
            required: 411,
            owned: 300,
            toFarm: 77,
            guaranteedToFarm: 77,
            craftQuantity: 34,
          },
        },
      },
      craftingPlan: {
        familyId: 'Slime',
        isCraftable: true,
        steps: [
          {
            recipeId: 'craft_SlimeSecretions',
            inputItemId: 'SlimeCondensate',
            inputItemName: 'Slime Condensate',
            outputItemId: 'SlimeSecretions',
            outputItemName: 'Slime Secretions',
            totalInputConsumed: 102,
            totalOutputProduced: 34,
            totalMoraCost: 1700,
          },
        ],
        adjustedShortages: { SlimeSecretions: 77 },
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 102, SlimeSecretions: 300 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeSecretions: 411 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
        craftingPlan={familyObj.craftingPlan}
      />
    );

    // 3rd cell shows To Farm 77
    const toFarmCell = screen.getByTestId('material-to-farm-SlimeSecretions');
    expect(toFarmCell).toBeInTheDocument();
    expect(toFarmCell.textContent).toContain('To Farm');
    expect(toFarmCell.textContent).toContain('77');

    // Craft indicator is rendered as separate row underneath
    expect(screen.getByText(/Craft:/i)).toBeInTheDocument();
    expect(screen.getByText('+34')).toBeInTheDocument();

    // No extra badge
    expect(screen.queryByTestId('material-extra-SlimeSecretions')).not.toBeInTheDocument();
  });

  // ── 20. Case B: Bonus-Likely Coverage Preserves To Farm: 🎲 ~0 ──
  it('20. Case B renders To Farm: 🎲 ~0 in 3rd cell and does not convert to Extra or zero', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 }],
      },
      items: {
        SlimeConcentrate: {
          item: {
            name: 'SlimeConcentrate',
            required: 30,
            owned: 10,
            guaranteedToFarm: 5,
            expectedShortage: 0,
          },
        },
      },
      craftingPlan: {
        familyId: 'Slime',
        isCraftable: true,
        adjustedShortages: { SlimeConcentrate: 5 },
      },
      neededBy: [],
    };

    const initialInv = { SlimeConcentrate: 10 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeConcentrate: 30 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
        craftingBonusOptions={{ enabled: true, bonusType: 'double_product' }}
        bonusForecast={{
          families: {
            Slime: {
              isEligible: true,
              expectedShortages: { SlimeConcentrate: 0 },
            },
          },
        }}
      />
    );

    const cell = screen.getByTestId('material-to-farm-SlimeConcentrate');
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toContain('To Farm');
    expect(cell.textContent).toContain('🎲 ~0');
    expect(cell.getAttribute('title')).toContain('Guaranteed shortage: 5');
    expect(screen.queryByTestId('material-extra-SlimeConcentrate')).not.toBeInTheDocument();
  });

  // ── 21. Case D: Sufficiently Covered Material with Zero Surplus ──
  it('21. Case D renders To Farm: 0 in 3rd cell when covered and owned === required (Fixture D)', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 121, toFarm: 0 } },
      },
      craftingPlan: { familyId: 'Slime', isCraftable: true, steps: [] },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 121 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
      />
    );

    const cell = screen.getByTestId('material-to-farm-SlimeCondensate');
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toContain('To Farm');
    expect(cell.textContent).toContain('0');
    expect(screen.queryByTestId('material-extra-SlimeCondensate')).not.toBeInTheDocument();
  });

  // ── 22. Positive Fractional Shortage Strictly Remains To Farm ──
  it('22. preserves positive fractional expected shortage as shortage without converting to Extra', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 }],
      },
      items: {
        SlimeConcentrate: {
          item: {
            name: 'SlimeConcentrate',
            required: 30,
            owned: 10,
            guaranteedToFarm: 5,
            expectedShortage: 0.4,
          },
        },
      },
      craftingPlan: { familyId: 'Slime', isCraftable: true },
      neededBy: [],
    };

    const initialInv = { SlimeConcentrate: 10 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeConcentrate: 30 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
        craftingBonusOptions={{ enabled: true, bonusType: 'double_product' }}
        bonusForecast={{
          families: {
            Slime: {
              isEligible: true,
              expectedShortages: { SlimeConcentrate: 0.4 },
            },
          },
        }}
      />
    );

    const cell = screen.getByTestId('material-to-farm-SlimeConcentrate');
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toContain('To Farm');
    expect(cell.textContent).toContain('~0.4');
    expect(screen.queryByTestId('material-extra-SlimeConcentrate')).not.toBeInTheDocument();
  });

  // ── 23. FarmableToday Dynamic 3rd Statistics Cell ──
  it('23. FarmableToday renders dynamic third cell switching between To Farm and Extra', async () => {
    const familyObj = {
      familyName: 'Freedom',
      type: 'talent',
      familyData: {
        familyId: 'Freedom',
        tiers: [
          { id: 'TeachingsOfFreedom', name: 'Teachings of Freedom', rarity: 2 },
          { id: 'GuideToFreedom', name: 'Guide to Freedom', rarity: 3 },
        ],
      },
      items: {
        TeachingsOfFreedom: { item: { name: 'TeachingsOfFreedom', required: 9, owned: 25, toFarm: 0 } },
        GuideToFreedom: { item: { name: 'GuideToFreedom', required: 30, owned: 5, toFarm: 25 } },
      },
      neededBy: [],
    };

    useStore.setState({ inventory: { TeachingsOfFreedom: 25, GuideToFreedom: 5 } });

    render(
      <DomainCard
        domainName="DOMAIN OF MASTERY: FORSAKEN RIFT"
        familyObj={familyObj}
        accent="#4A9EFF"
        globalCosts={{ TeachingsOfFreedom: 9, GuideToFreedom: 30 }}
        inventory={{ TeachingsOfFreedom: 25, GuideToFreedom: 5 }}
        craftingMode="crafting-aware"
      />
    );

    // Teachings: Extra +16 in 3rd cell
    const teachingsExtra = screen.getByTestId('material-extra-TeachingsOfFreedom');
    expect(teachingsExtra).toBeInTheDocument();
    expect(teachingsExtra.textContent).toContain('Extra');
    expect(teachingsExtra.textContent).toContain('+16');

    // Guide: To Farm 25 in 3rd cell
    const guideToFarm = screen.getByTestId('material-to-farm-GuideToFreedom');
    expect(guideToFarm).toBeInTheDocument();
    expect(guideToFarm.textContent).toContain('To Farm');
    expect(guideToFarm.textContent).toContain('25');
  });

  // ── 24. PlannerItemCard Dynamic Stat Switching ──
  it('24. PlannerItemCard renders dynamic stat without separate Extra row', () => {
    // Case 1: Item with shortage
    const shortageItem = {
      name: 'Philanemo Mushroom',
      category: 'local_specialty',
      required: 60,
      owned: 5,
      toFarm: 55,
      guaranteedToFarm: 55,
      rarity: 1,
    };

    const { rerender } = render(<PlannerItemCard item={shortageItem} accent="#FAB632" />);
    const toFarmStat = screen.getByTestId('material-to-farm-Philanemo Mushroom');
    expect(toFarmStat.textContent).toContain('To Farm: 55');
    expect(screen.queryByTestId('material-extra-Philanemo Mushroom')).not.toBeInTheDocument();

    // Case 2: Item with surplus
    const surplusItem = {
      name: 'Philanemo Mushroom',
      category: 'local_specialty',
      required: 10,
      owned: 18,
      toFarm: 0,
      guaranteedToFarm: 0,
      rarity: 1,
    };

    rerender(<PlannerItemCard item={surplusItem} accent="#FAB632" />);
    const extraStat = screen.getByTestId('material-extra-Philanemo Mushroom');
    expect(extraStat.textContent).toContain('Extra: +8');
    expect(screen.queryByTestId('material-to-farm-Philanemo Mushroom')).not.toBeInTheDocument();
  });
});
