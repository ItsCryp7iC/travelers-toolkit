import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import useStore from '../../store/useStore';
import CraftingSessionDrawer from './CraftingSessionDrawer';
import CraftingSessionReplacementModal from './CraftingSessionReplacementModal';
import PlannerCraftingChecklist from './PlannerCraftingChecklist';
import { resetBodyScrollLockForTesting } from '../../utils/scrollLock';
import { computeCraftingPlan } from '../../utils/craftingEngine';
import { forecastCraftingPlan } from '../../utils/craftingBonusForecast';

describe('Phase CRAFT-D4-B2-B: Interactive Crafting Session Drawer Suite', () => {
  beforeEach(() => {
    resetBodyScrollLockForTesting();
    useCraftingSessionStore.getState().discardSession();
    // Reset global inventory in useStore to a known baseline
    useStore.setState({
      inventory: {
        SlimeCondensate: 6309,
        SlimeSecretions: 281,
        SlimeConcentrate: 57,
        DamagedMask: 1951,
        StainedMask: 223,
        OminousMask: 35,
        Mora: 1000000,
      },
    });
  });

  afterEach(() => {
    resetBodyScrollLockForTesting();
    useCraftingSessionStore.getState().discardSession();
  });

  // ── 1. Start a Slime session ──
  it('1. Start a Slime session: opens drawer, captures starting inventory and requirements snapshot', () => {
    const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57, Mora: 1000000 };
    const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={1000000} />);

    expect(screen.getByTestId('crafting-session-drawer-panel')).toBeInTheDocument();
    expect(screen.getByText(/Slime Crafting Session/i)).toBeInTheDocument();
    expect(screen.getAllByText(/10% Double Output/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId('shadow-inv-SlimeCondensate')).toHaveTextContent('6,309');
    expect(screen.getByTestId('shadow-inv-SlimeSecretions')).toHaveTextContent('281');
    expect(screen.getByTestId('shadow-inv-SlimeConcentrate')).toHaveTextContent('57');
  });

  // ── 2. Start a Hilichurl session ──
  it('2. Start a Hilichurl session: opens drawer with Hilichurl metadata and recipes', () => {
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35, Mora: 500000 };
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'ingredient_refund',
      startingMora: 500000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={500000} />);

    expect(screen.getByText(/Hilichurl Crafting Session/i)).toBeInTheDocument();
    expect(screen.getAllByText(/25% Ingredient Refund/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId('shadow-inv-DamagedMask')).toHaveTextContent('1,951');
    expect(screen.getByTestId('shadow-inv-StainedMask')).toHaveTextContent('223');
    expect(screen.getByTestId('shadow-inv-OminousMask')).toHaveTextContent('35');
  });

  // ── 3. Reject multiple simultaneous sessions ──
  it('3. Reject multiple simultaneous sessions: requires explicit confirmation before replacing session with events', () => {
    const inv = { SlimeCondensate: 500, DamagedMask: 500, Mora: 100000 };

    // Start Slime session and record 1 craft
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 100000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    // Attempt to start Hilichurl session
    const res = useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: inv,
      grossRequirements: {},
      bonusType: 'ingredient_refund',
      startingMora: 100000,
    });

    expect(res.success).toBe(false);
    expect(res.requiresConfirmation).toBe(true);

    // Active session remains Slime
    expect(useCraftingSessionStore.getState().session.snapshot.familyId).toBe('Slime');
  });

  // ── 4. Close and reopen ──
  it('4. Close and reopen: closing drawer preserves session state; reopening restores exact state', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1000, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 20,
      totalOutputReceived: 22,
    });

    // Close drawer
    useCraftingSessionStore.getState().closeDrawer();
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(false);
    expect(useCraftingSessionStore.getState().session).not.toBeNull();
    expect(useCraftingSessionStore.getState().session.events).toHaveLength(1);

    // Reopen drawer
    useCraftingSessionStore.getState().openDrawer();
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(true);
    expect(useCraftingSessionStore.getState().session.events).toHaveLength(1);
    expect(useCraftingSessionStore.getState().session.ledger.shadowInventory.SlimeSecretions).toBe(22);
  });

  // ── 5. Temporary session lifetime ──
  it('5. Temporary session lifetime: session is isolated in in-memory store and not in localStorage / persisted store', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    // Check localStorage does not have crafting session
    expect(localStorage.getItem('travelers-toolkit-crafting-session')).toBeNull();
    expect(useStore.getState().craftingSession).toBeUndefined();
  });

  // ── 6. Correct starting inventory ──
  it('6. Correct starting inventory: captures exact owned amounts and starting Mora', () => {
    const inv = { SlimeCondensate: 4321, SlimeSecretions: 654, Mora: 987654 };
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 987654,
    });

    const s = useCraftingSessionStore.getState().session;
    expect(s.snapshot.startingInventory.SlimeCondensate).toBe(4321);
    expect(s.snapshot.startingInventory.SlimeSecretions).toBe(654);
    expect(s.snapshot.startingMora).toBe(987654);
    expect(s.ledger.remainingMora).toBe(987654);
  });

  // ── 7. Correct aggregated requirements ──
  it('7. Correct aggregated requirements: captures exact gross demand without deducting it from inventory', () => {
    const inv = { SlimeCondensate: 5000 };
    const reqs = { SlimeCondensate: 200, SlimeSecretions: 400 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
    });

    const s = useCraftingSessionStore.getState().session;
    expect(s.snapshot.grossRequirements.SlimeCondensate).toBe(200);
    expect(s.snapshot.grossRequirements.SlimeSecretions).toBe(400);
    // Direct requirements are reserved, not deducted from physical inventory!
    expect(s.ledger.shadowInventory.SlimeCondensate).toBe(5000);
  });

  // ── 8. Double-output result entry ──
  it('8. Double-output result entry: input fields, validation, and submission for 10% Double', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: { SlimeSecretions: 10 },
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    const opsInput = screen.getByTestId('operations-input');
    const totalOutputInput = screen.getByTestId('total-output-input');
    const submitBtn = screen.getByTestId('submit-record-result-btn');

    fireEvent.change(opsInput, { target: { value: '10' } });
    fireEvent.change(totalOutputInput, { target: { value: '12' } });

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    const session = useCraftingSessionStore.getState().session;
    expect(session.events).toHaveLength(1);
    expect(session.events[0].operationsPerformed).toBe(10);
    expect(session.events[0].totalOutputReceived).toBe(12);
    expect(session.events[0].bonusOutputReceived).toBe(2);
    expect(session.ledger.shadowInventory.SlimeCondensate).toBe(270);
    expect(session.ledger.shadowInventory.SlimeSecretions).toBe(12);
  });

  // ── 9. Refund result entry ──
  it('9. Refund result entry: input fields, validation, and submission for 25% Refund', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 300, Mora: 10000 },
      grossRequirements: { StainedMask: 10 },
      bonusType: 'ingredient_refund',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    const opsInput = screen.getByTestId('operations-input');
    const refundsInput = screen.getByTestId('refunds-input');
    const submitBtn = screen.getByTestId('submit-record-result-btn');

    fireEvent.change(opsInput, { target: { value: '10' } });
    fireEvent.change(refundsInput, { target: { value: '3' } });

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    const session = useCraftingSessionStore.getState().session;
    expect(session.events).toHaveLength(1);
    expect(session.events[0].operationsPerformed).toBe(10);
    expect(session.events[0].refundsReceived).toBe(3);
    expect(session.events[0].netInputConsumed).toBe(27); // 30 - 3
    expect(session.ledger.shadowInventory.DamagedMask).toBe(273); // 300 - 27
    expect(session.ledger.shadowInventory.StainedMask).toBe(10);
  });

  // ── 10. Derived bonus quantity ──
  it('10. Derived bonus quantity: derived bonus = totalReceived - operations (e.g. 1841 - 1668 = 173)', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 6309, Mora: 1000000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={1000000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '1668' } });
    fireEvent.change(screen.getByTestId('total-output-input'), { target: { value: '1841' } });

    const preview = screen.getByTestId('batch-preview-panel');
    expect(preview).toHaveTextContent('+173 bonus');
  });

  // ── 11. Derived net ingredient consumption ──
  it('11. Derived net ingredient consumption: net = gross - refunds (e.g. 300 - 27 = 273)', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 1000, Mora: 100000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
      startingMora: 100000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={100000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('refunds-input'), { target: { value: '27' } });

    const preview = screen.getByTestId('batch-preview-panel');
    expect(preview).toHaveTextContent('273×');
    expect(preview).toHaveTextContent('-27 refund');
  });

  // ── 12. Exact crafting Mora ──
  it('12. Exact crafting Mora: fee = ops * moraCost; refunds do not refund Mora', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 500, Mora: 5000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
      startingMora: 5000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={5000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('refunds-input'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('submit-record-result-btn'));

    const s = useCraftingSessionStore.getState().session;
    // 10 crafts of StainedMask costs 10 * 25 = 250 Mora
    expect(s.events[0].moraSpent).toBe(250);
    expect(s.ledger.totalMoraSpent).toBe(250);
    expect(s.ledger.remainingMora).toBe(4750);
  });

  // ── 13. Invalid numeric inputs ──
  it('13. Invalid numeric inputs: rejects negative, zero, fractional, NaN inputs', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    const opsInput = screen.getByTestId('operations-input');
    const submitBtn = screen.getByTestId('submit-record-result-btn');

    fireEvent.change(opsInput, { target: { value: '0' } });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(opsInput, { target: { value: '-5' } });
    expect(submitBtn).toBeDisabled();
  });

  // ── 14. Excess output ──
  it('14. Excess output: rejects totalReceived > 2 * ops for 10% Double', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('total-output-input'), { target: { value: '25' } }); // Max is 20!

    expect(screen.getByText(/Total output received.*cannot exceed twice the base crafted output/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-record-result-btn')).toBeDisabled();
  });

  // ── 15. Excess refunds ──
  it('15. Excess refunds: rejects refunds > ops for 25% Refund', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('refunds-input'), { target: { value: '15' } }); // Max is 10!

    expect(screen.getByText(/Refund count.*cannot exceed operations performed/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-record-result-btn')).toBeDisabled();
  });

  // ── 16. Insufficient materials ──
  it('16. Insufficient materials: rejects batch requiring more gross ingredients than available in shadow inventory with advisory message', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 50, Mora: 10000 }, // Only 50
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '20' } }); // Needs 60 Condensate

    expect(screen.getByText(/requires 60 gross ingredients, but only 50 are currently available/i)).toBeInTheDocument();
    expect(screen.getByText(/Please record smaller sequential sub-batches/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-record-result-btn')).toBeDisabled();
  });

  // ── 17. Insufficient Mora ──
  it('17. Insufficient Mora: rejects batch when fee exceeds remaining shadow Mora', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 50 }, // Only 50 Mora
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 50,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={50} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '10' } }); // Needs 250 Mora

    expect(screen.getByText(/requires 250 Mora, but only 50 Mora is available/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-record-result-btn')).toBeDisabled();
  });

  // ── 18. Duplicate-submit prevention ──
  it('18. Duplicate-submit prevention: button disabled while submitting, prevents double submission', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('total-output-input'), { target: { value: '10' } });

    const submitBtn = screen.getByTestId('submit-record-result-btn');
    fireEvent.click(submitBtn);

    // Form was submitted and reset; opsInput is now empty so button is disabled
    expect(screen.getByTestId('operations-input').value).toBe('');
    expect(submitBtn).toBeDisabled();
    expect(useCraftingSessionStore.getState().session.events).toHaveLength(1);
  });

  // ── 19. Event history ──
  it('19. Event history: renders recorded events in history list with metrics', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 12,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    const historyList = screen.getByTestId('session-history-list');
    expect(historyList).toHaveTextContent(/Crafted 10× → Produced 12×/i);
    expect(historyList).toHaveTextContent(/\+2 bonus/i);
    expect(historyList).toHaveTextContent(/250 Mora/i);
  });

  // ── 20. Undo last batch ──
  it('20. Undo last batch: restores previous shadow inventory and recalculates previous plan', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 12,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    expect(screen.getByTestId('undo-last-batch-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('undo-last-batch-btn'));

    const s = useCraftingSessionStore.getState().session;
    expect(s.events).toHaveLength(0);
    expect(s.ledger.shadowInventory.SlimeCondensate).toBe(300);
    expect(s.ledger.shadowInventory.SlimeSecretions).toBe(0);
  });

  // ── 21. Multiple batches ──
  it('21. Multiple batches: unrolls multiple events cleanly', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 900, Mora: 50000 },
      grossRequirements: { OminousMask: 50 },
      bonusType: 'ingredient_refund',
      startingMora: 50000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_StainedMask',
      operationsPerformed: 30,
      refundsReceived: 5,
    });
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_StainedMask',
      operationsPerformed: 30,
      refundsReceived: 6,
    });

    expect(useCraftingSessionStore.getState().session.events).toHaveLength(2);

    useCraftingSessionStore.getState().undoLastBatch();
    expect(useCraftingSessionStore.getState().session.events).toHaveLength(1);

    useCraftingSessionStore.getState().undoLastBatch();
    expect(useCraftingSessionStore.getState().session.events).toHaveLength(0);
    expect(useCraftingSessionStore.getState().session.ledger.shadowInventory.DamagedMask).toBe(900);
  });

  // ── 22. Multi-tier crafting ──
  it('22. Multi-tier crafting: lower tier craft provides output that enables higher tier craft', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 90, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 10000 },
      grossRequirements: { SlimeConcentrate: 10 },
      bonusType: 'double_output',
      startingMora: 10000,
    });

    // Tier 1 -> Tier 2 is initially impossible (0 Secretions)
    const valInitial = useCraftingSessionStore.getState().validateResult({
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 3,
      totalOutputReceived: 3,
    });
    expect(valInitial.isValid).toBe(false);

    // Craft Tier 0 -> Tier 1 (30 Condensate -> 10 Secretions)
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    // Now Tier 1 -> Tier 2 is possible! (requires 9 Secretions <= 10)
    const valPost = useCraftingSessionStore.getState().validateResult({
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 3,
      totalOutputReceived: 3,
    });
    expect(valPost.isValid).toBe(true);
  });

  // ── 23. Correct next action ──
  it('23. Correct next action: nextRecommendedStep displayed with suggested batch and fill form action', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: { SlimeSecretions: 50 },
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    expect(screen.getByTestId('recommended-action-panel')).toBeInTheDocument();
    expect(screen.getByTestId('fill-recommended-batch-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('fill-recommended-batch-btn'));

    // Form inputs are populated
    expect(screen.getByTestId('operations-input').value).not.toBe('');
  });

  // ── 24. No repeated completed operations ──
  it('24. No repeated completed operations: completed batch is not recommended again', () => {
    const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57, Mora: 1000000 };
    const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
    });

    const s = useCraftingSessionStore.getState().session;
    // Next recommended step advanced to Concentrate (564 crafts), NOT repeating the 1668 Secretions crafts!
    expect(s.nextRecommendedStep.recipeId).toBe('craft_SlimeConcentrate');
    expect(s.nextRecommendedStep.suggestedInitialBatch).toBe(564);
  });

  // ── 25. Guaranteed versus expected quantities ──
  it('25. Guaranteed versus expected quantities: clearly labels and distinguishes guaranteed remaining plan from estimated bonus forecast', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1000, Mora: 50000 },
      grossRequirements: { SlimeSecretions: 100 },
      bonusType: 'double_output',
      startingMora: 50000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={50000} />);

    expect(screen.getByText('Guaranteed Remaining')).toBeInTheDocument();
    expect(screen.getByText('Baseline 3:1')).toBeInTheDocument();
    expect(screen.getByText('Estimated Future Forecast')).toBeInTheDocument();
    expect(screen.getAllByText(/10% Double Output/i)[0]).toBeInTheDocument();
  });

  // ── 26. Session inventory display ──
  it('26. Session inventory display: displays shadow inventory, goal reserved, and available to craft without claiming it is saved inventory', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500, SlimeSecretions: 50 },
      grossRequirements: { SlimeCondensate: 100 },
      bonusType: 'double_output',
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);

    expect(screen.getByText(/Current Simulated Inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/Your real saved inventory is/i)).toBeInTheDocument();
  });

  // ── 27. Actual inventory unchanged ──
  it('27. Actual inventory unchanged: real saved inventory in useStore is strictly untouched throughout session lifecycle', () => {
    const preInv = { ...useStore.getState().inventory };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: preInv,
      grossRequirements: { SlimeSecretions: 100 },
      bonusType: 'double_output',
      startingMora: preInv.Mora,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 100,
      totalOutputReceived: 110,
    });

    // useStore inventory has not changed at all!
    expect(useStore.getState().inventory).toEqual(preInv);
  });

  // ── 28. Discard confirmation ──
  it('28. Discard confirmation: clicking Discard shows confirmation dialog; confirming destroys session; canceling preserves session', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);

    fireEvent.click(screen.getByTestId('discard-session-btn'));
    expect(screen.getByTestId('discard-confirm-dialog')).toBeInTheDocument();

    // Cancel preserves session
    fireEvent.click(screen.getByTestId('cancel-discard-btn'));
    expect(screen.queryByTestId('discard-confirm-dialog')).not.toBeInTheDocument();
    expect(useCraftingSessionStore.getState().session).not.toBeNull();

    // Confirm discard destroys session
    fireEvent.click(screen.getByTestId('discard-session-btn'));
    fireEvent.click(screen.getByTestId('confirm-discard-btn'));
    expect(useCraftingSessionStore.getState().session).toBeNull();
  });

  // ── 29. Active-session replacement warning ──
  it('29. Active-session replacement warning: starting a new family session when another family has recorded events opens replacement modal', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1000, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    // Attempt start Hilichurl session
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 500, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
      startingMora: 10000,
    });

    render(<CraftingSessionReplacementModal />);

    expect(screen.getByTestId('session-replacement-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Active Crafting Session in Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/You currently have an active crafting session for/i)).toBeInTheDocument();

    // Clicking cancel keeps Slime
    fireEvent.click(screen.getByTestId('cancel-replacement-btn'));
    expect(useCraftingSessionStore.getState().session.snapshot.familyId).toBe('Slime');
    expect(useCraftingSessionStore.getState().pendingReplacement).toBeNull();
  });

  // ── 30. Switching Planner tabs ──
  it('30. Switching Planner tabs: session remains active and open/reopenable across tab switches', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    // Simulate switching tabs (closing drawer and reopening)
    useCraftingSessionStore.getState().closeDrawer();
    useCraftingSessionStore.getState().openDrawer();

    expect(useCraftingSessionStore.getState().session.events).toHaveLength(1);
    expect(useCraftingSessionStore.getState().session.ledger.shadowInventory.SlimeSecretions).toBe(10);
  });

  // ── 31. Drawer reopen after remount ──
  it('31. Drawer reopen after remount: unmounting and remounting drawer preserves all recorded state', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const { unmount } = render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);
    unmount();

    // Remount
    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);
    expect(screen.getByTestId('crafting-session-drawer-panel')).toBeInTheDocument();
  });

  // ── 32. Browser reload policy ──
  it('32. Browser reload policy: in-memory store resets cleanly to null without persistent trace', () => {
    expect(useCraftingSessionStore.getState().session).toBeNull();
  });

  // ── 33. Scroll-lock compatibility ──
  it('33. Scroll-lock compatibility: acquires body scroll lock when drawer is open', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const { unmount } = render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  // ── 34. Stacking hierarchy: drawer overlay renders above topbar (z-[500]) and portals to body ──
  it('34. Stacking hierarchy: drawer overlay renders above topbar with z-[500] and portals to body', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);
    const backdrop = screen.getByTestId('crafting-session-drawer-backdrop');
    expect(backdrop).toHaveClass('z-[500]');
    expect(document.body).toContainElement(backdrop);

    // Header structure: non-scrolling header with title, badge, safety note, close button
    const panel = screen.getByTestId('crafting-session-drawer-panel');
    expect(panel).toHaveClass('flex-col');
    expect(panel).toHaveClass('overflow-hidden');
    expect(panel).toHaveClass('max-h-[100dvh]');

    const closeBtn = screen.getByTestId('close-crafting-drawer-btn');
    expect(closeBtn).toBeVisible();
    expect(screen.getByText(/Your saved inventory won't change/i)).toBeVisible();

    // Verify non-scrolling header and scrolling body layout
    const header = panel.firstElementChild;
    expect(header).toHaveClass('shrink-0');

    // Click close button
    fireEvent.click(closeBtn);
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(false);
  });

  // ── 35. Keyboard accessibility ──
  it('35. Keyboard accessibility: Escape key closes drawer', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(false);
  });

  // ── 36. Mobile rendering ──
  it('36. Mobile rendering: drawer renders responsive container with mobile-friendly classes', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={0} />);
    const panel = screen.getByTestId('crafting-session-drawer-panel');
    expect(panel).toHaveClass('w-full');
    expect(panel).toHaveClass('sm:max-w-xl');
  });

  // ── 37. Existing CRAFT-B/C/D3/D4-A regression suites ──
  it('37. Planner checklist integration: renders Start/Continue Session buttons per active family', () => {
    const inv = {
      SlimeCondensate: 6309,
      SlimeSecretions: 281,
      SlimeConcentrate: 57,
      Mora: 1000000,
    };
    const reqs = {
      SlimeCondensate: 219,
      SlimeSecretions: 411,
      SlimeConcentrate: 689,
    };

    const plan = computeCraftingPlan(reqs, inv);
    const forecast = forecastCraftingPlan(plan, reqs, inv, { enabled: true, bonusType: 'double_output' });

    render(
      <PlannerCraftingChecklist
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={1000000}
        progressionMora={50000}
        craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
        bonusForecast={forecast}
        inventory={inv}
        grossRequirements={reqs}
      />
    );

    // Expand checklist
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    const startBtn = screen.getByTestId('crafting-session-btn-Slime');
    expect(startBtn).toHaveTextContent('Start Session');

    fireEvent.click(startBtn);

    // Now active session is Slime and button says Continue Session
    expect(useCraftingSessionStore.getState().session.snapshot.familyId).toBe('Slime');
    expect(screen.getByTestId('crafting-session-btn-Slime')).toHaveTextContent('Continue Session');
  });

  // ── 38. Slime Acceptance Fixture Complete Flow ──
  it('38. Slime acceptance workflow: 1668 Secretions -> 1841 received -> 185 Secretions & 632 Concentrate remaining', () => {
    const inv = {
      SlimeCondensate: 6309,
      SlimeSecretions: 281,
      SlimeConcentrate: 57,
      Mora: 1000000,
    };
    const reqs = {
      SlimeCondensate: 219,
      SlimeSecretions: 411,
      SlimeConcentrate: 689,
    };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={1000000} />);

    // Record the 1668 craft yielding 1841 output
    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '1668' } });
    fireEvent.change(screen.getByTestId('total-output-input'), { target: { value: '1841' } });
    fireEvent.click(screen.getByTestId('submit-record-result-btn'));

    const s = useCraftingSessionStore.getState().session;
    // Expected shadow inventory
    expect(s.ledger.shadowInventory.SlimeCondensate).toBe(1305);
    expect(s.ledger.shadowInventory.SlimeSecretions).toBe(2122);
    expect(s.ledger.shadowInventory.SlimeConcentrate).toBe(57);
    expect(s.ledger.remainingMora).toBe(958300);

    // Confirmed metrics
    expect(s.events[0].operationsPerformed).toBe(1668);
    expect(s.events[0].bonusOutputReceived).toBe(173);
    expect(s.events[0].moraSpent).toBe(41700);

    // Remaining guaranteed plan
    const slimePlan = s.remainingPlan.families['Slime'];
    expect(slimePlan.steps.find((st) => st.recipeId === 'craft_SlimeSecretions').count).toBe(185);
    expect(slimePlan.steps.find((st) => st.recipeId === 'craft_SlimeConcentrate').count).toBe(632);
    expect(slimePlan.craftingMora).toBe(36225);
    expect(s.remainingPlan.adjustedShortages['SlimeCondensate']).toBe(0);
    expect(s.remainingPlan.adjustedShortages['SlimeSecretions']).toBe(0);
    expect(s.remainingPlan.adjustedShortages['SlimeConcentrate']).toBe(0);
  });

  // ── 39. Hilichurl Acceptance Fixture Complete Flow ──
  it('39. Hilichurl acceptance workflow: 100 Stained crafts with 27 refunds -> 531 Stained, 232 Ominous remaining', () => {
    const inv = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      Mora: 100000,
    };
    const reqs = {
      DamagedMask: 81,
      StainedMask: 158,
      OminousMask: 274,
    };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'ingredient_refund',
      startingMora: 100000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={100000} />);

    // Record 100 crafts of Stained Mask with 27 refunds
    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('refunds-input'), { target: { value: '27' } });
    fireEvent.click(screen.getByTestId('submit-record-result-btn'));

    const s = useCraftingSessionStore.getState().session;
    // Expected shadow inventory
    expect(s.ledger.shadowInventory.DamagedMask).toBe(1678);
    expect(s.ledger.shadowInventory.StainedMask).toBe(323);
    expect(s.ledger.shadowInventory.OminousMask).toBe(35);
    expect(s.ledger.remainingMora).toBe(97500); // 100,000 - 2,500

    // Confirmed metrics
    expect(s.events[0].operationsPerformed).toBe(100);
    expect(s.events[0].refundsReceived).toBe(27);
    expect(s.events[0].moraSpent).toBe(2500);

    // Remaining guaranteed plan
    const hilichurlPlan = s.remainingPlan.families['Hilichurl'];
    expect(hilichurlPlan.steps.find((st) => st.recipeId === 'craft_StainedMask').count).toBe(531);
    expect(hilichurlPlan.steps.find((st) => st.recipeId === 'craft_OminousMask').count).toBe(232);
    expect(hilichurlPlan.craftingMora).toBe(24875);
    expect(s.remainingPlan.adjustedShortages['OminousMask']).toBe(7);

    // Verify UI displays guaranteed plan and estimated forecast sections
    expect(screen.getByText('Guaranteed Remaining')).toBeInTheDocument();
    expect(screen.getByText('Estimated Future Forecast')).toBeInTheDocument();
  });

  // ── 40. B2-B.2 UX: Prefilled craft count and empty actual output ──
  it('40. B2-B.2 UX: Suggested craft count is prefilled, output is empty, button labeled "Update My Plan"', () => {
    const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57, Mora: 1000000 };
    const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={1000000} />);

    // Suggested quantity is prefilled into operationsInput
    const opsInput = screen.getByTestId('operations-input');
    expect(opsInput).toHaveValue(1668);

    // Total output received remains empty until user provides it
    const outputInput = screen.getByTestId('total-output-input');
    expect(outputInput.value).toBe('');

    // Primary button is labeled "Update My Plan"
    const submitBtn = screen.getByTestId('submit-record-result-btn');
    expect(submitBtn).toHaveTextContent('Update My Plan');
  });

  // ── 41. B2-B.2 UX: Advanced accordions collapsed by default ──
  it('41. B2-B.2 UX: View Inventory Details, View Full Forecast, View Crafting History are collapsed by default', () => {
    const inv = { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57, Mora: 1000000 };
    const reqs = { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
      startingMora: 1000000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={1000000} />);

    const invDetails = screen.getByTestId('details-inventory');
    const forecastDetails = screen.getByTestId('details-forecast');
    const historyDetails = screen.getByTestId('details-history');

    expect(invDetails).not.toHaveAttribute('open');
    expect(forecastDetails).not.toHaveAttribute('open');
    expect(historyDetails).not.toHaveAttribute('open');
  });

  // ── 42. B2-B.2 UX: 25% Refund secondary observed balance input derives refunds accurately ──
  it('42. B2-B.2 UX: Optional observed ingredient balance derives refund count accurately', () => {
    const inv = { DamagedMask: 1000, StainedMask: 0, OminousMask: 0, Mora: 50000 };
    const reqs = { DamagedMask: 0, StainedMask: 100, OminousMask: 0 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'ingredient_refund',
      startingMora: 50000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={50000} />);

    // User crafted 100 Stained Masks.
    // Starting Damaged: 1,000. Gross ingredients needed: 100 * 3 = 300.
    // Expected before refunds: 1,000 - 300 = 700.
    // User observes their Damaged Mask bag balance is now 727.
    // Derived refunds = 727 - 700 = 27!
    fireEvent.change(screen.getByTestId('operations-input'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('observed-balance-input'), { target: { value: '727' } });

    // refunds-input is automatically updated to 27
    expect(screen.getByTestId('refunds-input')).toHaveValue(27);
  });

  // ── 43. B2-B.2 UX: Celebratory completion card appears when all requirements are met ──
  it('43. B2-B.2 UX: Celebratory "Crafting goal reached!" card appears when material requirements are met', () => {
    // Inventory already exceeds requirements
    const inv = { SlimeCondensate: 1000, SlimeSecretions: 500, SlimeConcentrate: 100, Mora: 100000 };
    const reqs = { SlimeCondensate: 100, SlimeSecretions: 50, SlimeConcentrate: 10 };

    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: inv,
      grossRequirements: reqs,
      bonusType: 'double_output',
      startingMora: 100000,
    });

    render(<CraftingSessionDrawer liveInventory={inv} liveGrossRequirements={reqs} liveMora={100000} />);

    expect(screen.getByText(/Crafting goal reached!/i)).toBeInTheDocument();
    expect(screen.getByText(/You have met all material requirements/i)).toBeInTheDocument();
  });

  // ── 44. B2-B.3: Modal layering above drawer (z-[1000]) ──
  it('44. B2-B.3: Discard and Replacement modals render above drawer with z-[1000] and portals to body', () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
      startingMora: 10000,
    });

    render(<CraftingSessionDrawer liveInventory={{}} liveGrossRequirements={{}} liveMora={10000} />);

    // Trigger Discard modal
    fireEvent.click(screen.getByTestId('discard-session-btn'));
    const discardDialog = screen.getByTestId('discard-confirm-dialog');
    expect(discardDialog).toHaveClass('z-[1000]');
    expect(document.body).toContainElement(discardDialog);

    // Cancel discard
    fireEvent.click(screen.getByTestId('cancel-discard-btn'));

    // Trigger Replacement modal
    useCraftingSessionStore.getState().recordResult({
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 5,
      totalOutputReceived: 5,
    });
    useCraftingSessionStore.getState().startSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 500, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
      startingMora: 10000,
    });

    render(<CraftingSessionReplacementModal />);
    const replaceDialog = screen.getByTestId('session-replacement-dialog');
    expect(replaceDialog).toHaveClass('z-[1000]');
    expect(document.body).toContainElement(replaceDialog);
  });
});

