import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import useStore from '../../store/useStore';
import CraftingSessionDrawer from './CraftingSessionDrawer';
import ApplyCraftingResultsModal from './ApplyCraftingResultsModal';
import { resetBodyScrollLockForTesting } from '../../utils/scrollLock';
import { STORE_NAME } from '../../store/persistence';

describe('Phase CRAFT-D4-C2-C: Apply Crafting Results Review & Inventory Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetBodyScrollLockForTesting();
    useCraftingSessionStore.getState().discardSession();
    useStore.getState().resetStore();
    useStore.setState({ appliedCraftingTransactions: [] });
  });

  afterEach(() => {
    resetBodyScrollLockForTesting();
    useCraftingSessionStore.getState().discardSession();
  });

  // Helper to start a Slime session
  const setupSlimeSession = (options = {}) => {
    const startingInventory = {
      SlimeCondensate: 6309,
      SlimeSecretions: 281,
      SlimeConcentrate: 57,
      CorLapis: 42, // Unrelated item to verify safety
      Mora: 42590000,
      ...options.inventory,
    };
    const grossRequirements = {
      SlimeCondensate: 219,
      SlimeSecretions: 411,
      SlimeConcentrate: 689,
      ...options.requirements,
    };

    useStore.setState({
      inventory: { ...startingInventory },
      goals: { ...grossRequirements },
      appliedCraftingTransactions: [],
    });

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements,
      bonusType: options.bonusType || 'double_output',
      startingMora: startingInventory.Mora,
    });

    return { startingInventory, grossRequirements };
  };

  // Helper to start a Hilichurl session
  const setupHilichurlSession = (options = {}) => {
    const startingInventory = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      ChaosDevice: 15, // Unrelated item to verify safety
      Mora: 10000,
      ...options.inventory,
    };
    const grossRequirements = {
      DamagedMask: 100,
      StainedMask: 300,
      OminousMask: 50,
      ...options.requirements,
    };

    useStore.setState({
      inventory: { ...startingInventory },
      goals: { ...grossRequirements },
      appliedCraftingTransactions: [],
    });

    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: startingInventory,
      grossRequirements,
      bonusType: options.bonusType || 'ingredient_refund',
      startingMora: startingInventory.Mora,
    });

    return { startingInventory, grossRequirements };
  };

  // ── 1. Apply action hidden or disabled with zero events ──
  it('1. Apply action disabled with zero events: button is disabled with explanatory title', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    const applyBtn = screen.getByTestId('apply-crafting-results-btn');
    expect(applyBtn).toBeInTheDocument();
    expect(applyBtn).toBeDisabled();
    expect(applyBtn).toHaveAttribute(
      'title',
      'Record at least 1 crafting batch to apply results to inventory'
    );
    expect(screen.queryByTestId('goal-reached-apply-btn')).not.toBeInTheDocument();
  });

  // ── 2. Apply action available with confirmed events ──
  it('2. Apply action available with confirmed events: enables button and opens review dialog', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    // Record 1 batch: 10 crafts -> 11 received (1 bonus)
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 11,
        bonusOutputReceived: 1,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    const applyBtn = screen.getByTestId('apply-crafting-results-btn');
    expect(applyBtn).not.toBeDisabled();

    fireEvent.click(applyBtn);

    expect(screen.getByTestId('apply-crafting-results-modal')).toBeInTheDocument();
    expect(screen.getByText(/Apply Crafting Results/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Review the materials and Mora that will change in your saved inventory/i)
    ).toBeInTheDocument();
  });

  // ── 3. Partial crafting session can be applied ──
  it('3. Partial crafting session can be applied: user can apply without completing full goal', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    // Only 1 intermediate batch recorded (goal needs 689 Concentrate, which is not yet crafted)
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    expect(screen.getByTestId('confirm-apply-results-btn')).not.toBeDisabled();
  });

  // ── 4. Preview opens without modifying inventory ──
  it('4. Preview opens without modifying inventory: opening modal does not change persistent store', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 100,
        totalOutputReceived: 110,
        bonusOutputReceived: 10,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    // Persistent store must be 100% unchanged
    const storeInv = useStore.getState().inventory;
    expect(storeInv['SlimeCondensate']).toBe(6309);
    expect(storeInv['SlimeSecretions']).toBe(281);
    expect(storeInv['Mora']).toBe(42590000);
  });

  // ── 5. Preview shows exact Slime quantities ──
  it('5. Preview shows exact Slime quantities: Condensate 6,309 -> 1,305 [-5,004], Secretions 281 -> 2,122 [+1,841], Mora -41,700', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    // 1,668 crafts -> 1,841 received (173 bonus), 5,004 Condensate, 41,700 Mora
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 1668,
        totalOutputReceived: 1841,
        bonusOutputReceived: 173,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    const condensateRow = screen.getByTestId('apply-row-SlimeCondensate');
    expect(within(condensateRow).getByText('6,309')).toBeInTheDocument();
    expect(within(condensateRow).getByText('▼ -5,004')).toBeInTheDocument();
    expect(within(condensateRow).getByText('1,305')).toBeInTheDocument();

    const secretionsRow = screen.getByTestId('apply-row-SlimeSecretions');
    expect(within(secretionsRow).getByText('281')).toBeInTheDocument();
    expect(within(secretionsRow).getByText('▲ +1,841')).toBeInTheDocument();
    expect(within(secretionsRow).getByText('2,122')).toBeInTheDocument();

    const moraRow = screen.getByTestId('apply-row-mora');
    expect(within(moraRow).getByText('42,590,000')).toBeInTheDocument();
    expect(within(moraRow).getByText('▼ -41,700')).toBeInTheDocument();
    expect(within(moraRow).getByText('42,548,300')).toBeInTheDocument();

    // Unchanged Slime Concentrate should be hidden by default
    expect(screen.queryByTestId('apply-row-SlimeConcentrate')).not.toBeInTheDocument();
  });

  // ── 6. Preview shows exact Hilichurl quantities ──
  it('6. Preview shows exact Hilichurl quantities: Damaged Mask 1,951 -> 1,678 [-273], Stained Mask 223 -> 323 [+100], Mora -2,500', () => {
    const { startingInventory, grossRequirements } = setupHilichurlSession();

    // 100 Stained Mask crafts, 27 refunds, 2,500 Mora spent
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_StainedMask',
        operationsPerformed: 100,
        totalOutputReceived: 100,
        bonusOutputReceived: 0,
        refundsReceived: 27,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    const damagedRow = screen.getByTestId('apply-row-DamagedMask');
    expect(within(damagedRow).getByText('1,951')).toBeInTheDocument();
    expect(within(damagedRow).getByText('▼ -273')).toBeInTheDocument();
    expect(within(damagedRow).getByText('1,678')).toBeInTheDocument();

    const stainedRow = screen.getByTestId('apply-row-StainedMask');
    expect(within(stainedRow).getByText('223')).toBeInTheDocument();
    expect(within(stainedRow).getByText('▲ +100')).toBeInTheDocument();
    expect(within(stainedRow).getByText('323')).toBeInTheDocument();

    const moraRow = screen.getByTestId('apply-row-mora');
    expect(within(moraRow).getByText('10,000')).toBeInTheDocument();
    expect(within(moraRow).getByText('▼ -2,500')).toBeInTheDocument();
    expect(within(moraRow).getByText('7,500')).toBeInTheDocument();
  });

  // ── 7. Confirmed-only results ──
  it('7. Confirmed-only results: projected leftovers or future bonus forecasts are not displayed as confirmed', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 11,
        bonusOutputReceived: 1,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    // Check table headers and content within modal: only confirmed actual deltas
    const modal = screen.getByTestId('apply-crafting-results-modal');
    expect(within(modal).getByText('Change')).toBeInTheDocument();
    expect(within(modal).queryByText(/Expected Leftovers/i)).not.toBeInTheDocument();
    expect(within(modal).queryByText(/Forecast/i)).not.toBeInTheDocument();
  });

  // ── 8. Multiple-event aggregation ──
  it('8. Multiple-event aggregation: intermediate-tier materials produced then consumed aggregate accurately', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    // Event 1: Craft 30 Secretions from 90 Condensate (30 output, 0 bonus)
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 30,
        totalOutputReceived: 30,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    // Event 2: Craft 10 Concentrate from 30 Secretions (10 output, 0 bonus)
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeConcentrate',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    // Condensate: -90 (6,309 -> 6,219)
    const condensateRow = screen.getByTestId('apply-row-SlimeCondensate');
    expect(within(condensateRow).getByText('▼ -90')).toBeInTheDocument();
    expect(within(condensateRow).getByText('6,219')).toBeInTheDocument();

    // Secretions: produced 30, consumed 30 -> Net delta is 0! (Hidden in active rows)
    expect(screen.queryByTestId('apply-row-SlimeSecretions')).not.toBeInTheDocument();

    // Concentrate: produced 10 (57 -> 67)
    const concentrateRow = screen.getByTestId('apply-row-SlimeConcentrate');
    expect(within(concentrateRow).getByText('▲ +10')).toBeInTheDocument();
    expect(within(concentrateRow).getByText('67')).toBeInTheDocument();

    // Mora: 30 * 25 + 10 * 50 = 750 + 500 = 1,250 Mora spent
    const moraRow = screen.getByTestId('apply-row-mora');
    expect(within(moraRow).getByText('▼ -1,250')).toBeInTheDocument();
    expect(within(moraRow).getByText('42,588,750')).toBeInTheDocument();
  });

  // ── 9. Correct Mora ──
  it('9. Correct Mora: verifies cumulative crafting fee deduction and display', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    // Craft 40 Secretions -> 1,000 Mora fee
    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 40,
        totalOutputReceived: 44,
        bonusOutputReceived: 4,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    const moraRow = screen.getByTestId('apply-row-mora');
    expect(within(moraRow).getByText('▼ -1,000')).toBeInTheDocument();
    expect(within(moraRow).getByText('42,589,000')).toBeInTheDocument();
  });

  // ── 10. Cancel leaves everything unchanged ──
  it('10. Cancel leaves everything unchanged: closes review modal, preserves inventory and session', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    expect(screen.getByTestId('apply-crafting-results-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-apply-results-btn'));

    expect(screen.queryByTestId('apply-crafting-results-modal')).not.toBeInTheDocument();
    // Inventory intact
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(6309);
    // Session intact
    expect(useCraftingSessionStore.getState().session.events.length).toBe(1);
  });

  // ── 11. Successful application updates Inventory ──
  it('11. Successful application updates persistent store and persists to localStorage', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 1668,
        totalOutputReceived: 1841,
        bonusOutputReceived: 173,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    // Assert actual saved inventory in store
    const storeState = useStore.getState();
    expect(storeState.inventory['SlimeCondensate']).toBe(1305);
    expect(storeState.inventory['SlimeSecretions']).toBe(2122);
    expect(storeState.inventory['SlimeConcentrate']).toBe(57);
    expect(storeState.inventory['Mora']).toBe(42548300);

    // Assert persistence
    const rawStorage = window.localStorage.getItem(STORE_NAME);
    expect(rawStorage).not.toBeNull();
    const parsed = JSON.parse(rawStorage);
    expect(parsed.state.inventory['SlimeCondensate']).toBe(1305);
    expect(parsed.state.inventory['SlimeSecretions']).toBe(2122);
    expect(parsed.state.inventory['Mora']).toBe(42548300);

    // Success view rendered
    expect(screen.getByTestId('apply-success-view')).toBeInTheDocument();
    expect(screen.getByText(/Crafting results saved!/i)).toBeInTheDocument();
  });

  // ── 12. Successful application clears the old session ──
  it('12. Successful application clears the old session: session is null in store', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-success-view')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('done-apply-results-btn'));

    // Old temporary crafting session is cleared
    expect(useCraftingSessionStore.getState().session).toBeNull();
  });

  // ── 13. New session uses updated inventory ──
  it('13. New session uses updated inventory: next session snapshot captures fresh values', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 1668,
        totalOutputReceived: 1841,
        bonusOutputReceived: 173,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    // Dismiss modal
    fireEvent.click(screen.getByTestId('done-apply-results-btn'));

    // Start a new session for Slime
    const freshInv = useStore.getState().inventory;
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: freshInv,
      grossRequirements,
      bonusType: 'double_output',
      startingMora: freshInv.Mora,
    });

    const newSession = useCraftingSessionStore.getState().session;
    expect(newSession.snapshot.startingInventory['SlimeCondensate']).toBe(1305);
    expect(newSession.snapshot.startingInventory['SlimeSecretions']).toBe(2122);
    expect(newSession.snapshot.startingMora).toBe(42548300);
  });

  // ── 14. Repeat confirmation is blocked ──
  it('14. Repeat confirmation is blocked: confirm button is disabled while submitting', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    const confirmBtn = screen.getByTestId('confirm-apply-results-btn');
    expect(confirmBtn).not.toBeDisabled();

    // Click confirm
    fireEvent.click(confirmBtn);

    // After success, confirm button is replaced by success view
    expect(screen.queryByTestId('confirm-apply-results-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('done-apply-results-btn')).toBeInTheDocument();
  });

  // ── 15. Duplicate transaction rejection ──
  it('15. Duplicate transaction rejection: displays clear error if transaction was already processed', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    // Mock store's applyCraftingTransaction to simulate duplicate rejection
    vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'rejected',
      code: 'DUPLICATE_TRANSACTION',
      message: 'Transaction already applied.',
    });

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-rejection-view')).toBeInTheDocument();
    expect(screen.getByText('Transaction already applied')).toBeInTheDocument();
    expect(
      screen.getByText('These crafting results have already been processed.')
    ).toBeInTheDocument();
  });

  // ── 16. Stale preview rejection ──
  it('16. Stale preview rejection: revalidates live inventory at execution time and halts if changed', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));

    // Live inventory changes in the background while modal is open
    useStore.setState({
      inventory: {
        ...startingInventory,
        SlimeCondensate: 5000, // Diverged!
      },
    });

    // Try to confirm
    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-rejection-view')).toBeInTheDocument();
    expect(
      screen.getByText(/Stale session snapshot|Inventory has changed|Preview is outdated/i)
    ).toBeInTheDocument();
  });

  // ── 17. Conflict-unreviewed rejection ──
  it('17. Conflict-unreviewed rejection: disables confirm and warns user when source conflict exists', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    // Inventory diverges in live store
    useStore.setState({
      inventory: {
        ...startingInventory,
        SlimeCondensate: 4000,
      },
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    expect(screen.getByTestId('apply-stale-warning')).toBeInTheDocument();
    expect(
      screen.getByText(
        /These results cannot be applied automatically because your saved inventory changed during this session/i
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('confirm-apply-results-btn')).toBeDisabled();
  });

  // ── 18. Conflict-continued rejection ──
  it('18. Conflict-continued rejection: disables confirm and warns user even after conflict acknowledgment', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    // User acknowledges conflict and continues in sandbox
    useStore.setState({
      inventory: { ...startingInventory, SlimeCondensate: 4000 },
    });
    useCraftingSessionStore.getState().acknowledgeConflict('diverged-fingerprint');

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    expect(screen.getByTestId('apply-stale-warning')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-apply-results-btn')).toBeDisabled();
  });

  // ── 19. Storage source mismatch ──
  it('19. Storage source mismatch: displays cross-tab guidance when STORAGE_SOURCE_MISMATCH occurs', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'rejected',
      code: 'STORAGE_SOURCE_MISMATCH',
      message: 'Persisted storage source snapshot has changed.',
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-rejection-view')).toBeInTheDocument();
    expect(screen.getByText('Saved data changed in another window')).toBeInTheDocument();
    expect(
      screen.getByText(/Your saved data changed in another window or tab/i)
    ).toBeInTheDocument();
  });

  // ── 20. Rejected status preserves session ──
  it('20. Rejected status preserves session: active session and events remain intact', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'rejected',
      code: 'INSUFFICIENT_MORA',
      message: 'Insufficient Mora balance.',
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-rejection-view')).toBeInTheDocument();
    expect(screen.getByText('Not enough Mora')).toBeInTheDocument();

    // Session is NOT discarded
    const session = useCraftingSessionStore.getState().session;
    expect(session).not.toBeNull();
    expect(session.events.length).toBe(1);
  });

  // ── 21. Uncertain status preserves session ──
  it('21. Uncertain status preserves session: active session and history are not discarded', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'uncertain',
      code: 'STORAGE_VERIFICATION_FAILED',
      message: 'Persisted verification readback failed.',
      transactionId: 'tx-12345',
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-uncertain-view')).toBeInTheDocument();

    // Session is preserved
    const session = useCraftingSessionStore.getState().session;
    expect(session).not.toBeNull();
    expect(session.events.length).toBe(1);
  });

  // ── 22. Uncertain status does not report success ──
  it('22. Uncertain status does not report success: warning banner shown without success receipt', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'uncertain',
      code: 'STORAGE_WRITE_FAILURE',
      message: 'Write threw QuotaExceededError.',
      transactionId: 'tx-abc',
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.queryByTestId('apply-success-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('apply-uncertain-view')).toBeInTheDocument();
    expect(screen.getByText('Inventory save could not be confirmed')).toBeInTheDocument();
  });

  // ── 23. No automatic retry after uncertainty ──
  it('23. No automatic retry after uncertainty: provides close button without auto-retry loops', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    const applySpy = vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'uncertain',
      code: 'STORAGE_TIMEOUT',
      message: 'Timed out during write.',
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    // Applied exactly once, no retry loops
    expect(applySpy).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByTestId('close-uncertain-btn');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(applySpy).toHaveBeenCalledTimes(1);
  });

  // ── 24. Transaction error displays understandable feedback ──
  it('24. Transaction error displays understandable feedback without stack traces', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    vi.spyOn(useStore.getState(), 'applyCraftingTransaction').mockReturnValue({
      success: false,
      status: 'rejected',
      code: 'INSUFFICIENT_INGREDIENTS',
      message: 'Resulting balance would be negative.',
    });

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    expect(screen.getByTestId('apply-rejection-view')).toBeInTheDocument();
    expect(screen.getByText('Not enough ingredients')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your current saved inventory does not have enough materials to apply this change.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Error: /)).not.toBeInTheDocument();
  });

  // ── 25. Modal focus management and ARIA attributes ──
  it('25. Modal focus management: has role="dialog", aria-modal="true", and aria-labelledby', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    const modal = screen.getByTestId('apply-crafting-results-modal');
    expect(modal).toHaveAttribute('role', 'dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'apply-modal-title');
  });

  // ── 26. Escape and close behavior ──
  it('26. Escape and close behavior: Escape inside modal closes modal without closing drawer', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    // Open apply modal
    fireEvent.click(screen.getByTestId('apply-crafting-results-btn'));
    expect(screen.getByTestId('apply-crafting-results-modal')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Modal is closed, but drawer remains open
    expect(screen.queryByTestId('apply-crafting-results-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('crafting-session-drawer-panel')).toBeInTheDocument();
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(true);
  });

  // ── 27. Mobile usability ──
  it('27. Mobile usability: applies responsive max-height and scrollable body classes', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    const dialogCard = screen.getByTestId('apply-crafting-results-modal').firstElementChild;
    expect(dialogCard.className).toContain('max-h-[90vh]');

    const diffTable = screen.getByTestId('apply-diff-table');
    expect(diffTable).toBeInTheDocument();
  });

  // ── 28. No regressions to the original crafting workflow ──
  it('28. No regressions to original crafting workflow: record, undo, and recipe switching work properly', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    render(
      <CraftingSessionDrawer
        liveInventory={startingInventory}
        liveGrossRequirements={grossRequirements}
        liveMora={startingInventory.Mora}
      />
    );

    // Record batch via drawer inputs
    const opsInput = screen.getByTestId('operations-input');
    fireEvent.change(opsInput, { target: { value: '10' } });

    const actualInput = screen.getByTestId('total-output-input');
    fireEvent.change(actualInput, { target: { value: '11' } });

    fireEvent.click(screen.getByTestId('submit-record-result-btn'));

    expect(screen.getByTestId('last-recorded-summary-banner')).toBeInTheDocument();
    expect(useCraftingSessionStore.getState().session.events.length).toBe(1);

    // Undo last batch
    fireEvent.click(screen.getByTestId('undo-last-batch-btn'));
    expect(useCraftingSessionStore.getState().session.events.length).toBe(0);
    expect(screen.getByTestId('apply-crafting-results-btn')).toBeDisabled();
  });

  // ── 29. No unexpected changes to saved Inventory ──
  it('29. No unexpected changes to saved Inventory: unrelated items are untouched', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));

    const inventory = useStore.getState().inventory;
    // Slime materials updated
    expect(inventory['SlimeCondensate']).toBe(6279);
    expect(inventory['SlimeSecretions']).toBe(291);
    // Unrelated items completely preserved
    expect(inventory['CorLapis']).toBe(42);
  });

  // ── 30. Full toggle and receipt workflow ──
  it('30. Toggle unchanged items and receipt Done button: reveals all materials and cleanly closes on Done', () => {
    const { startingInventory, grossRequirements } = setupSlimeSession();

    useCraftingSessionStore.getState().recordResult(
      {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
        bonusOutputReceived: 0,
        refundsReceived: 0,
      },
      { inventory: startingInventory, grossRequirements, mora: startingInventory.Mora }
    );

    const onClose = vi.fn();

    render(
      <ApplyCraftingResultsModal isOpen={true} onClose={onClose} />
    );

    // Initially SlimeConcentrate is hidden
    expect(screen.queryByTestId('apply-row-SlimeConcentrate')).not.toBeInTheDocument();

    // Click toggle button
    const toggleBtn = screen.getByText(/Show all Slime materials/i);
    fireEvent.click(toggleBtn);

    // Now SlimeConcentrate is shown
    expect(screen.getByTestId('apply-row-SlimeConcentrate')).toBeInTheDocument();

    // Confirm and complete
    fireEvent.click(screen.getByTestId('confirm-apply-results-btn'));
    expect(screen.getByTestId('apply-success-view')).toBeInTheDocument();

    // Click Done
    fireEvent.click(screen.getByTestId('done-apply-results-btn'));
    expect(onClose).toHaveBeenCalled();
  });
});
