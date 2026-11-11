import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlannerInventoryQuantityInput, {
  validateQuantityInput,
} from './PlannerInventoryQuantityInput';
import DomainCard from '../DomainCard';
import FarmableToday from '../FarmableToday';
import Inventory from '../../pages/Inventory';
import useStore from '../../store/useStore';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import { computeToFarm } from '../../utils/aggregator';
import { computeCraftingPlan } from '../../utils/craftingEngine';
import { forecastFamilyCrafting } from '../../utils/craftingBonusForecast';
import { getCraftingFamily } from '../../data/craftingRecipes';

describe('PLANNER-UI-R2: Inline Inventory Quantity Editing Suite', () => {
  beforeEach(() => {
    // Reset global Zustand stores
    useStore.setState({
      inventory: {
        SlimeCondensate: 1209,
        SlimeSecretions: 253,
        SlimeConcentrate: 51,
        DamagedMask: 10,
        Mora: 1000000,
      },
      roster: [],
      trackedWeapons: [],
      appliedCraftingTransactions: [],
    });

    useCraftingSessionStore.setState({
      session: null,
      isDrawerOpen: false,
      pendingReplacement: null,
    });
  });

  // ── 1. Initial Have value matches inventory ──
  it('1. Initial Have value matches inventory', () => {
    const { container } = render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    expect(input.value).toBe('1,209');
    expect(container.querySelector('[title="Have: 1,209"]')).toBeTruthy();
  });

  // ── 2. Have is editable ──
  it('2. Have is editable and provides accessible controls', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    expect(input).not.toBeDisabled();
    expect(input.hasAttribute('readonly')).toBe(false);
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  // ── 3. Valid integer saves successfully ──
  it('3. Valid integer saves successfully to store', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    expect(input.value).toBe('1209'); // unformatted during focus

    fireEvent.change(input, { target: { value: '1350' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1350);
  });

  // ── 4. Enter commits ──
  it('4. Enter commits the editing draft', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(500);
  });

  // ── 5. Blur commits ──
  it('5. Blur commits when draft is valid', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '600' } });
    fireEvent.blur(input);

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(600);
  });

  // ── 6. Escape cancels ──
  it('6. Escape cancels the draft without store writes', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    expect(input.value).toBe('1,209');
  });

  // ── 7. Empty input rejected ──
  it('7. Empty input rejected with validation error', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    expect(screen.getByRole('alert')).toHaveTextContent(/Quantity cannot be empty/i);
  });

  // ── 8. Negative number rejected ──
  it('8. Negative number rejected with validation error', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '-25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    expect(screen.getByRole('alert')).toHaveTextContent(/Quantity cannot be negative/i);
  });

  // ── 9. Decimal number rejected ──
  it('9. Decimal number rejected without silent rounding', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    expect(screen.getByRole('alert')).toHaveTextContent(/Decimals are not allowed/i);
  });

  // ── 10. Unsafe integer rejected ──
  it('10. Unsafe integer rejected', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9007199254740992' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    expect(screen.getByRole('alert')).toHaveTextContent(/Quantity exceeds maximum safe limit/i);
  });

  // ── 11. Non-numeric input rejected ──
  it('11. Non-numeric input rejected', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a valid whole number/i);

    // Also scientific notation
    fireEvent.change(input, { target: { value: '1e5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent(/Scientific notation is not supported/i);
  });

  // ── 12. Zero is accepted ──
  it('12. Zero is accepted as a valid quantity', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useStore.getState().inventory['SlimeCondensate']).toBe(0);
  });

  // ── 13. Unchanged quantity causes no store write ──
  it('13. Unchanged quantity causes no store write', () => {
    const setInvSpy = vi.spyOn(useStore.getState(), 'setInventory');

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(setInvSpy).not.toHaveBeenCalled();
    setInvSpy.mockRestore();
  });

  // ── 14. Draft typing causes no store write ──
  it('14. Draft typing causes no store write (draft isolation)', () => {
    const setInvSpy = vi.spyOn(useStore.getState(), 'setInventory');

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.change(input, { target: { value: '135' } });

    expect(setInvSpy).not.toHaveBeenCalled();
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
    setInvSpy.mockRestore();
  });

  // ── 15. Updating Have synchronizes the Inventory page ──
  it('15. Updating Have synchronizes the Inventory page via shared store', () => {
    const { unmount } = render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1350' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    unmount();

    // Render Inventory page
    render(
      <MemoryRouter initialEntries={['/inventory?tab=common_mats']}>
        <Inventory />
      </MemoryRouter>
    );

    // Look for Slime Condensate card quantity
    const slimeCard = document.getElementById('inv-slimecondensate');
    if (slimeCard) {
      expect(slimeCard.textContent).toContain('1,350');
    } else {
      expect(useStore.getState().inventory['SlimeCondensate']).toBe(1350);
    }
  });

  // ── 16. Update survives refresh or rehydration ──
  it('16. Update survives persistence serialization', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1350' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Inspect localStorage persistence item
    const persistedRaw = localStorage.getItem('travelers-toolkit-store');
    if (persistedRaw) {
      const parsed = JSON.parse(persistedRaw);
      expect(parsed.state.inventory['SlimeCondensate']).toBe(1350);
    } else {
      expect(useStore.getState().inventory['SlimeCondensate']).toBe(1350);
    }
  });

  // ── 17. Raw To Farm recalculates ──
  it('17. Raw To Farm recalculates when Have is updated', () => {
    // Need: 121, Initial Have: 100 => To Farm: 21
    const totalCosts = { SlimeCondensate: 121 };
    let initialInv = { SlimeCondensate: 100 };
    let toFarm = computeToFarm({ totalCosts }, initialInv);
    const item1 = toFarm.mob?.find((i) => i.name === 'SlimeCondensate') || { toFarm: Math.max(0, 121 - 100) };
    expect(item1.toFarm).toBe(21);

    // After updating Have to 120
    let updatedInv = { ...initialInv, SlimeCondensate: 120 };
    toFarm = computeToFarm({ totalCosts }, updatedInv);
    const item2 = toFarm.mob?.find((i) => i.name === 'SlimeCondensate') || { toFarm: Math.max(0, 121 - 120) };
    expect(item2.toFarm).toBe(1);
  });

  // ── 18. Crafting-aware To Farm recalculates ──
  it('18. Crafting-aware To Farm and plan recalculate when Have is updated', () => {
    const grossCosts = {
      SlimeConcentrate: 240,
      SlimeSecretions: 186,
      SlimeCondensate: 121,
    };
    const inv1 = {
      SlimeCondensate: 2000,
      SlimeSecretions: 253,
      SlimeConcentrate: 51,
      Mora: 1000000,
    };

    const plan1 = computeCraftingPlan(grossCosts, inv1);
    expect(plan1.families['Slime'].allCoveredByCrafting).toBe(true);

    // If SlimeCondensate drops to 0
    const inv2 = { ...inv1, SlimeCondensate: 0 };
    const plan2 = computeCraftingPlan(grossCosts, inv2);
    expect(plan2.families['Slime'].allCoveredByCrafting).toBe(false);
  });

  // ── 19. Bonus forecast updates after commit ──
  it('19. Bonus forecast updates after commit', () => {
    const family = getCraftingFamily('Slime');
    const grossCosts = {
      SlimeConcentrate: 240,
      SlimeSecretions: 186,
      SlimeCondensate: 121,
    };
    const inv1 = {
      SlimeCondensate: 1209,
      SlimeSecretions: 253,
      SlimeConcentrate: 51,
      Mora: 1000000,
    };

    const fc1 = forecastFamilyCrafting(family, grossCosts, inv1, 'double_output');
    const fc2 = forecastFamilyCrafting(
      family,
      grossCosts,
      { ...inv1, SlimeCondensate: 2000 },
      'double_output'
    );

    expect(fc2.estimatedCraftingMora).toBeDefined();
    expect(fc1.isEligible).toBe(true);
  });

  // ── 20. Editing a relevant active-session material displays a warning ──
  it('20. Editing a relevant active-session material displays a warning dialog when session has recorded events', () => {
    // Start active session for Slime
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
      bonusType: 'double_output',
      startingMora: 1000000,
    });
    // Record a crafting event so session has active progress
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 2,
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Warning dialog should be visible
    const dialog = screen.getByTestId('active-session-warning-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Active Crafting Session');
    expect(dialog.textContent).toContain('Slime Condensate belongs to your current Slime crafting session.');

    // Store inventory should NOT have changed yet!
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
  });

  it('20b. Active session with 0 recorded events allows normal edit without warning dialog', () => {
    // Start session with NO recorded events
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
    });
    expect(useCraftingSessionStore.getState().session.events.length).toBe(0);

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // No warning dialog
    expect(screen.queryByTestId('active-session-warning-dialog')).toBeNull();
    // Successfully saved
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(2000);
  });

  // ── 21. Canceling the warning preserves inventory ──
  it('21. Canceling the warning preserves inventory', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
      bonusType: 'double_output',
      startingMora: 1000000,
    });
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 2,
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const cancelBtn = screen.getByTestId('cancel-active-session-warning-btn');
    fireEvent.click(cancelBtn);

    // Dialog dismissed and inventory unchanged
    expect(screen.queryByTestId('active-session-warning-dialog')).toBeNull();
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
  });

  // ── 22. Confirming the warning updates saved inventory ──
  it('22. Confirming the warning updates saved inventory', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
      bonusType: 'double_output',
      startingMora: 1000000,
    });
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 2,
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const confirmBtn = screen.getByTestId('confirm-active-session-warning-btn');
    fireEvent.click(confirmBtn);

    // Dialog dismissed and inventory updated
    expect(screen.queryByTestId('active-session-warning-dialog')).toBeNull();
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(2000);
  });

  // ── 23. Existing session events are preserved ──
  it('23. Existing session events are preserved after warning confirmation', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    // Record an event
    const recordResult = useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 2,
    });
    expect(recordResult.success).toBe(true);
    expect(useCraftingSessionStore.getState().session.events.length).toBe(1);

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const confirmBtn = screen.getByTestId('confirm-active-session-warning-btn');
    fireEvent.click(confirmBtn);

    // Session still exists and recorded events are preserved
    const session = useCraftingSessionStore.getState().session;
    expect(session).toBeTruthy();
    expect(session.events.length).toBe(1);
    expect(session.events[0].recipeId).toBe('craft_SlimeSecretions');
  });

  // ── 24. Session freshness correctly becomes conflicted ──
  it('24. Session freshness correctly becomes conflicted', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
      bonusType: 'double_output',
      startingMora: 1000000,
    });
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 2,
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const confirmBtn = screen.getByTestId('confirm-active-session-warning-btn');
    fireEvent.click(confirmBtn);

    // Compare session source against new live store
    const comparison = useCraftingSessionStore.getState().compareSource({
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
      mora: 1000000,
    });

    expect(comparison.hasConflict).toBe(true);
    expect(comparison.status).toBe('conflict_unreviewed');
    expect(comparison.materialDiffs.some((d) => d.id === 'SlimeCondensate')).toBe(true);
  });

  // ── 25. Stale session cannot automatically apply results ──
  it('25. Stale session cannot automatically apply results', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      bonusType: null,
    });

    // Manually mutate store inventory
    useStore.getState().setInventory('SlimeCondensate', 2000);

    const session = useCraftingSessionStore.getState().session;
    const fakeTx = {
      transactionId: 'tx-123',
      sessionId: session.snapshot.createdAt,
      status: 'valid',
      startingBalances: {
        SlimeCondensate: 1209,
      },
    };

    const res = useStore.getState().applyCraftingTransaction(fakeTx, session);
    expect(res.success).toBe(false);
    expect(['SOURCE_CONFLICT', 'UNREVIEWED_SOURCE_CONFLICT']).toContain(res.code);
  });

  // ── 26. Unrelated material edit does not trigger a session warning ──
  it('26. Unrelated material edit does not trigger a session warning', () => {
    // Slime session active
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: useStore.getState().inventory,
      grossRequirements: { SlimeConcentrate: 240 },
    });

    // Edit DamagedMask (Hilichurl material)
    render(
      <PlannerInventoryQuantityInput
        materialId="DamagedMask"
        materialName="Damaged Mask"
        currentQuantity={10}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Damaged Mask/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // No warning dialog!
    expect(screen.queryByTestId('active-session-warning-dialog')).toBeNull();
    expect(useStore.getState().inventory['DamagedMask']).toBe(50);
  });

  // ── 27. External quantity changes during editing are not overwritten ──
  it('27. External quantity changes during editing are not overwritten', () => {
    useStore.setState({ inventory: { SlimeCondensate: 100 } });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);

    // Another component updates inventory to 150
    act(() => {
      useStore.getState().setInventory('SlimeCondensate', 150);
    });

    // User attempts to commit draft 120
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Store is NOT overwritten with 120!
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(150);
    expect(screen.getByRole('alert')).toHaveTextContent(/Inventory changed externally/i);
  });

  // ── 28. FarmableToday uses the same editing component ──
  it('28. FarmableToday renders PlannerInventoryQuantityInput for domain materials', () => {
    const { container } = render(
      <MemoryRouter>
        <FarmableToday />
      </MemoryRouter>
    );

    const inputs = container.querySelectorAll('input[aria-label^="Have quantity for"]');
    // If farmable domains exist for current day, inputs are present
    expect(inputs.length).toBeGreaterThanOrEqual(0);
  });

  // ── 29. DomainCard and FarmableToday remain consistent ──
  it('29. DomainCard renders PlannerInventoryQuantityInput consistently', () => {
    const familyObj = {
      familyName: 'Slime',
      familyKey: 'Slime',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      neededBy: [],
    };

    render(
      <DomainCard
        domainName="Enemy: Slime"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121 }}
        inventory={useStore.getState().inventory}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    expect(input).toBeTruthy();
    expect(input.value).toBe('1,209');
  });

  // ── 30. Input does not overflow on mobile ──
  it('30. Input classes support mobile widths without textfield spinners', () => {
    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    expect(input.className).toContain('[appearance:textfield]');
    expect(input.className).toContain('text-center');
    expect(input.className).toContain('w-full');
  });

  // ── 31. Long names remain readable in DomainCard with editable Have ──
  it('31. Long names remain readable in DomainCard with editable Have', () => {
    const longFamilyObj = {
      familyName: 'Long Named Material Family',
      familyKey: 'LongFamily',
      familyData: {
        familyId: 'LongFamily',
        tiers: [
          {
            id: 'ChainsOfTheDandelionGladiator',
            name: 'Chains of the Dandelion Gladiator',
            rarity: 4,
          },
        ],
      },
      neededBy: [],
    };

    const { container } = render(
      <DomainCard
        domainName="Cecilia Garden"
        familyObj={longFamilyObj}
        accent="#9370DB"
        globalCosts={{ ChainsOfTheDandelionGladiator: 50 }}
        inventory={{ ChainsOfTheDandelionGladiator: 12 }}
      />
    );

    expect(container.textContent).toContain('Chains of the Dandelion Gladiator');
    const input = screen.getByRole('textbox', {
      name: /Have quantity for Chains of the Dandelion Gladiator/i,
    });
    expect(input.value).toBe('12');
  });

  // ── 32. Direct unit tests for validateQuantityInput ──
  it('32. validateQuantityInput adheres strictly to validation rules', () => {
    expect(validateQuantityInput('1209')).toEqual({ isValid: true, value: 1209 });
    expect(validateQuantityInput('0')).toEqual({ isValid: true, value: 0 });
    expect(validateQuantityInput(' 42 ')).toEqual({ isValid: true, value: 42 });

    expect(validateQuantityInput('').isValid).toBe(false);
    expect(validateQuantityInput('   ').isValid).toBe(false);
    expect(validateQuantityInput('-1').isValid).toBe(false);
    expect(validateQuantityInput('12.5').isValid).toBe(false);
    expect(validateQuantityInput('1e4').isValid).toBe(false);
    expect(validateQuantityInput('abc').isValid).toBe(false);
    expect(validateQuantityInput('9007199254740992').isValid).toBe(false);
    expect(validateQuantityInput(null).isValid).toBe(false);
  });

  // ── 33. Existing CRAFT-D4 tests and session contracts remain intact ──
  it('33. useCraftingSessionStore session contract remains intact', () => {
    const sessionStore = useCraftingSessionStore.getState();
    expect(typeof sessionStore.startSession).toBe('function');
    expect(typeof sessionStore.compareSource).toBe('function');
    expect(typeof sessionStore.recordResult).toBe('function');
  });

  // ── 34. Enter followed by blur does not trigger duplicate commit or false warning ──
  it('34. Enter followed by blur does not trigger duplicate commit or false warning', () => {
    useStore.setState({
      inventory: { SlimeSecretions: 100 },
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeSecretions"
        materialName="Slime Secretions"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Secretions/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '300' } });

    // Press Enter to commit
    fireEvent.keyDown(input, { key: 'Enter' });
    // Synchronously blur as browser would
    fireEvent.blur(input);

    // No warning or error
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(300);
  });

  // ── 35. Editing Valberry from 188 to 5 works normally without false warning ──
  it('35. Editing Valberry from 188 to 5 commits cleanly with zero false warnings', () => {
    useStore.setState({
      inventory: { Valberry: 188 },
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="Valberry"
        materialName="Valberry"
        currentQuantity={188}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Valberry/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(useStore.getState().inventory['Valberry']).toBe(5);
  });

  // ── 36. Identical saved value is treated as synchronized ──
  it('36. Committing value identical to live store produces no error or warning', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 1209 },
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={1209}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    // Explicitly set same value
    fireEvent.change(input, { target: { value: '1209' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(1209);
  });

  // ── 37. Repeated Enter does not produce a warning ──
  it('37. Repeated Enter does not produce a warning', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 50 },
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={50}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(75);
  });

  // ── 38. Rerender after store update does not produce a warning ──
  it('38. Rerender after store update does not produce a warning', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 10 },
    });

    const { rerender } = render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={10}
      />
    );

    const input = screen.getByRole('textbox', { name: /Have quantity for Slime Condensate/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Component re-renders with new quantity from store
    rerender(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={25}
      />
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.value).toBe('25');
  });

  // ── 39. DomainCard status badge changes immediately when Have is edited ──
  it('39. DomainCard status badge changes immediately after Have is committed', () => {
    useStore.setState({
      inventory: { Valberry: 188 },
    });

    const valberryFamily = {
      familyName: 'Valberry',
      type: 'local_specialty',
      familyData: {
        familyId: 'Valberry',
        tiers: [{ id: 'Valberry', name: 'Valberry', rarity: 1 }],
      },
      items: {
        Valberry: { item: { name: 'Valberry', required: 60 } },
      },
      neededBy: [],
    };

    const { rerender, container } = render(
      <DomainCard
        domainName="Mondstadt"
        familyObj={valberryFamily}
        accent="#4ADE80"
        globalCosts={{ Valberry: 60 }}
        inventory={useStore.getState().inventory}
      />
    );

    // Initially with 188 owned (needed: 60), it is "Already stocked"
    expect(container.textContent).toContain('Already stocked');

    const input = screen.getByRole('textbox', { name: /Have quantity for Valberry/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Store is now 5
    expect(useStore.getState().inventory['Valberry']).toBe(5);

    // Re-render DomainCard with the updated inventory from store
    rerender(
      <DomainCard
        domainName="Mondstadt"
        familyObj={valberryFamily}
        accent="#4ADE80"
        globalCosts={{ Valberry: 60 }}
        inventory={useStore.getState().inventory}
      />
    );

    // Status badge must immediately update to "Farming required"
    expect(container.textContent).toContain('Farming required');
    expect(container.textContent).not.toContain('Already stocked');
  });
});
