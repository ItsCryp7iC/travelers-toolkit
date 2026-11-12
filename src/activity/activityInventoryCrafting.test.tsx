import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import useStore from '../store/useStore';
import useCraftingSessionStore from '../store/useCraftingSessionStore';

const domainStore = useStore as any;
const craftingStore = useCraftingSessionStore as any;
import {
  getActivityEvents,
  clearActivityHistory,
  getActivityEventById,
  getActivityStorageStatus,
} from './activityStore';
import * as activityLogger from './activityLogger';
import Inventory from '../pages/Inventory';
import PlannerInventoryQuantityInput, {
  validateQuantityInput,
} from '../components/Planner/PlannerInventoryQuantityInput';
import {
  createCraftingSession,
  recordCraftingResult,
} from '../utils/craftingSession';
import { prepareCraftingInventoryTransaction } from '../utils/craftingInventoryTransaction';

// Polyfills for jsdom environment
if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Mock dataManager to expose a compact material list for rapid rendering
vi.mock('../utils/dataManager', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const fullList = actual.getPrimaryInventoryList();
  const targetKeys = new Set([
    'Mora',
    'HeroWit',
    'SlimeCondensate',
    'SlimeSecretions',
    'SlimeConcentrate',
  ]);
  const testList = fullList.filter((item: any) => targetKeys.has(item.matKey));
  return {
    ...actual,
    getPrimaryInventoryList: () =>
      testList.length > 0 ? testList : fullList.slice(0, 10),
  };
});

describe('ACTIVITY-HISTORY-A3: Inventory & Confirmed Crafting Instrumentation Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearActivityHistory();
    domainStore.getState().resetStore();
    domainStore.setState({
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 10,
        SlimeConcentrate: 0,
        Mora: 1000000,
      },
      goals: [],
      appliedCraftingTransactions: [],
    });
    craftingStore.setState({
      session: null,
      isDrawerOpen: false,
      pendingReplacement: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Section 1: Inventory Store Actions (1–10)
  // =========================================================================

  it('1. Quantity increase: records single event with positive delta', () => {
    domainStore.setState({ inventory: { SlimeCondensate: 120 } });
    expect(getActivityEvents()).toHaveLength(0);

    domainStore
      .getState()
      .setInventory('SlimeCondensate', 150, 'inventory_page');

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(150);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('inventory');
    expect(events[0].action).toBe('inventory_updated');
    expect(events[0].source).toBe('inventory_page');
    expect(events[0].entityId).toBe('SlimeCondensate');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 120, after: 150, delta: '+30' },
    ]);
  });

  it('2. Quantity decrease: records single event with negative delta', () => {
    domainStore.setState({ inventory: { SlimeCondensate: 150 } });
    expect(getActivityEvents()).toHaveLength(0);

    domainStore
      .getState()
      .setInventory('SlimeCondensate', 120, 'inventory_page');

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(120);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 150, after: 120, delta: '-30' },
    ]);
  });

  it('3. Same-value no-op: suppresses event when quantity is unchanged', () => {
    domainStore.setState({ inventory: { SlimeCondensate: 120 } });

    domainStore
      .getState()
      .setInventory('SlimeCondensate', 120, 'inventory_page');

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(120);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('4. Missing key versus zero: treats missing key as 0 and logs correct delta', () => {
    domainStore.setState({ inventory: {} });

    // Setting missing key to 0 is a no-op (0 -> 0)
    domainStore.getState().setInventory('SlimeCondensate', 0, 'inventory_page');
    expect(getActivityEvents()).toHaveLength(0);

    // Setting missing key to 5 records delta from 0 to 5
    domainStore.getState().setInventory('SlimeCondensate', 5, 'inventory_page');
    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(5);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 0, after: 5, delta: '+5' },
    ]);
  });

  it('5. Zero-floor decrement: clamps negative quantity to 0 and suppresses repeated 0 no-ops', () => {
    domainStore.setState({ inventory: { SlimeCondensate: 2 } });

    // Decrementing by 5 clamps to 0
    domainStore
      .getState()
      .incrementInventory('SlimeCondensate', -5, 'inventory_stepper');
    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(0);

    let events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 2, after: 0, delta: '-2' },
    ]);

    // Further decrementing from 0 remains 0 and produces NO second event
    domainStore
      .getState()
      .incrementInventory('SlimeCondensate', -1, 'inventory_stepper');
    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(0);
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('6. Inventory-page source attribution: attributes manual page edits properly', () => {
    domainStore
      .getState()
      .setInventory('SlimeCondensate', 88, 'inventory_page');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('inventory_page');
  });

  it('7. Planner source attribution: attributes planner inline edits properly', () => {
    domainStore
      .getState()
      .setInventory('SlimeCondensate', 99, 'planner_inline');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('planner_inline');
  });

  it('8. Direct store-action fallback source: defaults to neutral system when source is omitted', () => {
    // Calling setInventory without source
    domainStore.getState().setInventory('SlimeCondensate', 45);
    let events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('system');

    // Calling incrementInventory without source
    domainStore.getState().incrementInventory('SlimeCondensate', 5);
    events = getActivityEvents();
    expect(events).toHaveLength(2);
    expect(events[1].source).toBe('system');
  });

  it('8b. Invalid source fallback: falls back to neutral system when an invalid source is passed', () => {
    domainStore
      .getState()
      .setInventory('SlimeCondensate', 70, 'unknown_source');
    let events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('system');

    domainStore
      .getState()
      .incrementInventory('SlimeCondensate', 5, 'bad_source');
    events = getActivityEvents();
    expect(events).toHaveLength(2);
    expect(events[1].source).toBe('system');
  });

  it('9. Invalid input suppression: rejects NaN, Infinity, and non-numeric inputs without mutating or logging', () => {
    domainStore.setState({ inventory: { SlimeCondensate: 50 } });

    domainStore.getState().setInventory('SlimeCondensate', NaN);
    domainStore.getState().setInventory('SlimeCondensate', Infinity);
    domainStore.getState().setInventory('SlimeCondensate', 'invalid' as any);
    domainStore.getState().setInventory('', 100);
    domainStore.getState().setInventory('   ', 100);

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(50);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('10. Logger storage failure does not abort inventory mutation: domain update completes successfully', () => {
    domainStore.setState({ inventory: { SlimeCondensate: 10 } });

    // Mock recordActivity to throw an unexpected error
    vi.spyOn(activityLogger, 'recordActivity').mockImplementationOnce(() => {
      throw new Error('Disk quota exceeded simulated');
    });

    // setInventory should complete without throwing to caller
    expect(() => {
      domainStore
        .getState()
        .setInventory('SlimeCondensate', 42, 'inventory_page');
    }).not.toThrow();

    // Domain store must reflect the committed mutation
    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(42);
  });

  // =========================================================================
  // Section 2: Inventory Page Input Interactions (11–18)
  // =========================================================================

  it('11. Multi-digit input creates one event after commit (ordinary blur commits once)', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 1000 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;
    expect(input).toBeTruthy();

    await user.click(input);
    await user.clear(input);
    await user.type(input, '5500');

    // Before blur: draft is uncommitted, zero events
    expect(getActivityEvents()).toHaveLength(0);

    // Commit via blur (moving focus elsewhere)
    await user.tab();

    expect(domainStore.getState().inventory['Mora']).toBe(5500);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('inventory_page');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 1000, after: 5500, delta: '+4,500' },
    ]);
  });

  it('12. No events on individual keystrokes: suppresses logging during typing', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 100 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;
    await user.click(input);
    await user.clear(input);

    await user.type(input, '1');
    expect(getActivityEvents()).toHaveLength(0);

    await user.type(input, '2');
    expect(getActivityEvents()).toHaveLength(0);

    await user.type(input, '3');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('13. Enter and subsequent blur do not duplicate: commits exactly once', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 200 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;

    await user.click(input);
    await user.clear(input);
    await user.type(input, '350{Enter}');

    expect(getActivityEvents()).toHaveLength(1);
    expect(domainStore.getState().inventory['Mora']).toBe(350);

    // Follow-up blur must NOT trigger a second commit
    await user.tab();

    expect(getActivityEvents()).toHaveLength(1);
    expect(domainStore.getState().inventory['Mora']).toBe(350);
  });

  it('14. Escape cancels: reverts draft without mutating store or logging', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 500 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;

    await user.click(input);
    await user.clear(input);
    await user.type(input, '999{Escape}');

    expect(domainStore.getState().inventory['Mora']).toBe(500);
    expect(getActivityEvents()).toHaveLength(0);
    expect(input.value).toBe('500');
  });

  it('15. External-update conflict handling: suppresses blind overwrite, displays accessible warning, and subsequent edit works', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 100 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;

    await user.click(input);
    await user.clear(input);
    await user.type(input, '300');

    // Simulate external store update while user was typing
    act(() => {
      domainStore.setState({ inventory: { Mora: 250 } });
    });

    // User blurs to commit draft
    await user.tab();

    // 1. Stale draft cancelled: store must remain 250, not overwritten to 300
    expect(domainStore.getState().inventory['Mora']).toBe(250);
    expect(getActivityEvents()).toHaveLength(0);

    // 2. Accessible error status warning is visible
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain(
      "Inventory changed elsewhere. Your edit wasn't saved."
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');

    // 3. Resuming editing clears conflict warning and allows valid edit
    await user.click(input);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'false');

    await user.clear(input);
    await user.type(input, '450{Enter}');

    expect(domainStore.getState().inventory['Mora']).toBe(450);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('inventory_page');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 250, after: 450, delta: '+200' },
    ]);
  });

  it('16. Stepper and blur ordering: typing draft and clicking + cancels draft and produces only one committed change', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 100 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;
    const increaseBtn = screen.getByLabelText('Increase Mora');

    await user.click(input);
    await user.clear(input);
    await user.type(input, '888');

    // User clicks stepper + while input is focused with draft "888"
    await user.click(increaseBtn);

    // Draft "888" is cancelled; stepper increments from saved value 100 -> 101
    expect(domainStore.getState().inventory['Mora']).toBe(101);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('inventory_stepper');
    expect(events[0].action).toBe('inventory_incremented');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 100, after: 101, delta: '+1' },
    ]);
    expect(input.value).toBe('101');
  });

  it('17. Stepper and blur ordering: typing draft and clicking − cancels draft and produces only one committed change', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 100 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;
    const decreaseBtn = screen.getByLabelText('Decrease Mora');

    await user.click(input);
    await user.clear(input);
    await user.type(input, '888');

    // User clicks stepper - while input is focused with draft "888"
    await user.click(decreaseBtn);

    // Draft "888" is cancelled; stepper decrements from saved value 100 -> 99
    expect(domainStore.getState().inventory['Mora']).toBe(99);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('inventory_stepper');
    expect(events[0].action).toBe('inventory_decremented');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 100, after: 99, delta: '-1' },
    ]);
    expect(input.value).toBe('99');
  });

  it('18. Stepper applies delta to saved store value, not unfinished draft', async () => {
    const user = userEvent.setup();
    domainStore.setState({ inventory: { Mora: 50 } });
    render(
      <MemoryRouter initialEntries={['/inventory?tab=currency_exp']}>
        <Inventory />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Mora quantity') as HTMLInputElement;
    const increaseBtn = screen.getByLabelText('Increase Mora');

    await user.click(input);
    await user.clear(input);
    await user.type(input, '1000');

    // Stepper click should increment from saved value (50 -> 51), NOT from draft (1000 -> 1001)
    await user.click(increaseBtn);

    expect(domainStore.getState().inventory['Mora']).toBe(51);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].changes?.[0].before).toBe(50);
    expect(events[0].changes?.[0].after).toBe(51);
  });

  it('18b. Validation preserves safe integer quantities: rejects invalid formats and allows safe integers', () => {
    expect(validateQuantityInput('100')).toEqual({ isValid: true, value: 100 });
    expect(validateQuantityInput('0')).toEqual({ isValid: true, value: 0 });
    expect(validateQuantityInput('42590000')).toEqual({
      isValid: true,
      value: 42590000,
    });
    expect(validateQuantityInput(String(Number.MAX_SAFE_INTEGER))).toEqual({
      isValid: true,
      value: Number.MAX_SAFE_INTEGER,
    });

    // Rejections
    expect(validateQuantityInput('-5').isValid).toBe(false);
    expect(validateQuantityInput('12.34').isValid).toBe(false);
    expect(validateQuantityInput('1e5').isValid).toBe(false);
    expect(validateQuantityInput('abc').isValid).toBe(false);
    expect(validateQuantityInput('').isValid).toBe(false);
    expect(validateQuantityInput('9007199254740992').isValid).toBe(false); // > MAX_SAFE_INTEGER
  });

  // =========================================================================
  // Section 3: Planner Inline Editor Interactions (19–24)
  // =========================================================================

  it('19. Successful Save produces one event: attributes planner_inline correctly', async () => {
    domainStore.setState({ inventory: { SlimeCondensate: 100 } });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', {
      name: /Have quantity for Slime Condensate/i,
    });

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '160' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(160);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('planner_inline');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 100, after: 160, delta: '+60' },
    ]);
  });

  it('20. Invalid edits produce zero events: displays validation error and protects store', async () => {
    domainStore.setState({ inventory: { SlimeCondensate: 100 } });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', {
      name: /Have quantity for Slime Condensate/i,
    });

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '-20' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(100);
    expect(getActivityEvents()).toHaveLength(0);
    expect(screen.getByText(/cannot be negative/i)).toBeTruthy();
  });

  it('21. Cancelled warning produces zero events: dismissing session modal cancels write', async () => {
    domainStore.setState({ inventory: { SlimeCondensate: 100 } });
    craftingStore.setState({
      session: {
        sessionId: 'session_test_active',
        events: [
          { recipeId: 'craft_SlimeSecretions', operationsPerformed: 1 } as any,
        ],
        snapshot: {
          materialIds: ['SlimeCondensate', 'SlimeSecretions'],
        } as any,
      } as any,
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', {
      name: /Have quantity for Slime Condensate/i,
    });

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '250' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    // Warning dialog should be visible
    expect(screen.getByText(/Active Crafting Session/i)).toBeTruthy();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(100);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('22. Confirmed crafting-session warning permits one event: confirming modal commits mutation', async () => {
    domainStore.setState({ inventory: { SlimeCondensate: 100 } });
    craftingStore.setState({
      session: {
        sessionId: 'session_test_active_2',
        events: [
          { recipeId: 'craft_SlimeSecretions', operationsPerformed: 1 } as any,
        ],
        snapshot: {
          materialIds: ['SlimeCondensate', 'SlimeSecretions'],
        } as any,
      } as any,
    });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', {
      name: /Have quantity for Slime Condensate/i,
    });

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '250' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    const confirmBtn = screen.getByRole('button', {
      name: /Update Anyway/i,
    });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(250);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('planner_inline');
    expect(events[0].changes).toEqual([
      { field: 'quantity', before: 100, after: 250, delta: '+150' },
    ]);
  });

  it('23. External conflict produces zero events: detects store change and rejects save', async () => {
    domainStore.setState({ inventory: { SlimeCondensate: 100 } });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', {
      name: /Have quantity for Slime Condensate/i,
    });

    await act(async () => {
      fireEvent.focus(input);
    });

    // Store updated externally while editor was open
    act(() => {
      domainStore.setState({ inventory: { SlimeCondensate: 140 } });
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: '180' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(140);
    expect(getActivityEvents()).toHaveLength(0);
    expect(screen.getByText(/Inventory changed externally/i)).toBeTruthy();
  });

  it('24. Unchanged quantity produces zero events: idempotently closes editor', async () => {
    domainStore.setState({ inventory: { SlimeCondensate: 100 } });

    render(
      <PlannerInventoryQuantityInput
        materialId="SlimeCondensate"
        materialName="Slime Condensate"
        currentQuantity={100}
      />
    );

    const input = screen.getByRole('textbox', {
      name: /Have quantity for Slime Condensate/i,
    });

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(domainStore.getState().inventory['SlimeCondensate']).toBe(100);
    expect(getActivityEvents()).toHaveLength(0);
  });

  // =========================================================================
  // Section 4: Confirmed Crafting Transactions & Outcomes (25–36)
  // =========================================================================

  it('25. Successful apply produces one grouped event: logs transaction atomically', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    };

    const prep = prepareCraftingInventoryTransaction(
      recordedSession,
      liveSource
    );
    expect(prep.isPrepared).toBe(true);

    const result = domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, recordedSession);

    expect(result.success).toBe(true);
    expect(result.status).toBe('applied');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('crafting');
    expect(events[0].action).toBe('crafting_transaction_applied');
    expect(events[0].source).toBe('crafting_results_modal');
  });

  it('26. Correct transaction ID is recorded: matches canonical transaction identity', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 5,
      totalOutputReceived: 5,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(recordedSession, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, recordedSession);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].transactionId).toBe(prep.transaction!.transactionId);
    expect(events[0].entityId).toBe(prep.transaction!.transactionId);
  });

  it('27. Material deltas match authoritative transaction results', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(recordedSession, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, recordedSession);

    const event = getActivityEvents()[0];
    const condensateChange = event.changes?.find(
      (c) => c.field === 'SlimeCondensate'
    );
    const secretionsChange = event.changes?.find(
      (c) => c.field === 'SlimeSecretions'
    );

    expect(condensateChange).toEqual({
      field: 'SlimeCondensate',
      before: 100,
      after: 70,
      delta: '-30',
    });
    expect(secretionsChange).toEqual({
      field: 'SlimeSecretions',
      before: 0,
      after: 10,
      delta: '+10',
    });
  });

  it('28. Mora before/after and fee are correct in event changes and metadata', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(recordedSession, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, recordedSession);

    const event = getActivityEvents()[0];
    const moraChange = event.changes?.find((c) => c.field === 'Mora');

    expect(moraChange).toEqual({
      field: 'Mora',
      before: 5000,
      after: 4750,
      delta: '-250',
    });
    expect(event.metadata?.totalMoraSpent).toBe(250);
  });

  it('29. Multiple crafting batches produce one grouped event: batches aggregated properly', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 10,
      SlimeConcentrate: 0,
      Mora: 10000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    // Batch 1: craft 10 Secretions (uses 30 Condensate)
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    // Batch 2: craft 3 Concentrate (uses 9 Secretions)
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 3,
      totalOutputReceived: 3,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s2, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    domainStore.getState().applyCraftingTransaction(prep.transaction!, s2);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].metadata?.totalBatches).toBe(2);
    expect(events[0].metadata?.totalOperations).toBe(13);
  });

  it('30. Bonus type is recorded accurately: double_output, ingredient_refund, or null', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 10000,
    };

    // Test with double_output
    domainStore.setState({ inventory: { ...startingInventory }, goals: [] });
    const sessionDouble = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: 'double_output',
    });
    const sDouble = recordCraftingResult(sessionDouble, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 2,
      bonusOutputReceived: 1,
      refundsReceived: 0,
    });
    const prepDouble = prepareCraftingInventoryTransaction(sDouble, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });
    domainStore
      .getState()
      .applyCraftingTransaction(prepDouble.transaction, sDouble);

    let events = getActivityEvents();
    expect(events[0].metadata?.bonusType).toBe('double_output');

    clearActivityHistory();

    // Test with ingredient_refund
    domainStore.setState({
      inventory: { ...startingInventory },
      goals: [],
      appliedCraftingTransactions: [],
    });
    const sessionRefund = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: 'ingredient_refund',
    });
    const sRefund = recordCraftingResult(sessionRefund, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1,
      totalOutputReceived: 1,
      bonusOutputReceived: 0,
      refundsReceived: 1,
    });
    const prepRefund = prepareCraftingInventoryTransaction(sRefund, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });
    domainStore
      .getState()
      .applyCraftingTransaction(prepRefund.transaction, sRefund);

    events = getActivityEvents();
    expect(events[0].metadata?.bonusType).toBe('ingredient_refund');
  });

  it('31. Duplicate apply produces no second successful event: protects against replay', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 5,
      totalOutputReceived: 5,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    // First apply succeeds
    const firstRes = domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, s1);
    expect(firstRes.success).toBe(true);
    expect(getActivityEvents()).toHaveLength(1);

    // Second apply with same transaction ID is rejected
    const secondRes = domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, s1);
    expect(secondRes.success).toBe(false);
    expect(secondRes.status).toBe('rejected');
    expect(secondRes.code).toBe('DUPLICATE_TRANSACTION');

    // No second event must be recorded
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('32. Rejected transaction produces zero successful events: rejected validation emits zero events', () => {
    const startingInventory = {
      SlimeCondensate: 10,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 100,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    // Malformed transaction
    const res = domainStore
      .getState()
      .applyCraftingTransaction(null as any, session);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('33. Uncertain persistence cannot be mistaken for confirmed apply: logs diagnostic uncertain event', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 5,
      totalOutputReceived: 5,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    // Mock storage setItem to throw when writing to domain store ('travelers-toolkit-store')
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === 'travelers-toolkit-store') {
        throw new Error('Simulated QuotaExceededError in domain store');
      }
      return originalSetItem.call(this, key, value);
    });

    const res = domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('uncertain');
    expect(res.code).toBe('PERSISTENCE_FAILURE');

    // Diagnostic event logged, NOT a successful apply event
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('crafting_transaction_uncertain');
    expect(events[0].category).toBe('crafting');
    expect(events[0].transactionId).toBe(prep.transaction!.transactionId);

    // Confirm no crafting_transaction_applied event exists
    const appliedEvents = events.filter(
      (e) => e.action === 'crafting_transaction_applied'
    );
    expect(appliedEvents).toHaveLength(0);
  });

  it('34. Logging failure does not modify the crafting result: apply remains successful', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 5,
      totalOutputReceived: 5,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: domainStore.getState().inventory,
      grossRequirements: domainStore.getState().goals,
      mora: domainStore.getState().inventory['Mora'],
    });

    // Mock recordActivity to throw error
    vi.spyOn(activityLogger, 'recordActivity').mockImplementationOnce(() => {
      throw new Error('Simulated activity logger disk crash');
    });

    const res = domainStore
      .getState()
      .applyCraftingTransaction(prep.transaction!, s1);

    // Domain result must remain fully successful
    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');
    expect(res.transactionId).toBe(prep.transaction!.transactionId);
    expect(domainStore.getState().inventory['SlimeSecretions']).toBe(5);
  });

  it('35. No events from temporary session draft or batch recording: session interactions remain ephemeral', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000,
    };
    domainStore.setState({ inventory: startingInventory, goals: [] });

    // Creating session
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: 'double_output',
    });
    expect(getActivityEvents()).toHaveLength(0);

    // Recording batch
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 2,
      totalOutputReceived: 2,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });
    expect(getActivityEvents()).toHaveLength(0);

    // Updating ephemeral store
    craftingStore.setState({ session: s1, isDrawerOpen: true });
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('36. No inventory changes triggered by reading activity history: query operations are strictly side-effect free', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 10,
      SlimeConcentrate: 0,
      Mora: 1000000,
    };
    domainStore.setState({ inventory: { ...startingInventory }, goals: [] });

    // Perform queries on activity storage
    const allEvents = getActivityEvents();
    expect(allEvents).toBeDefined();

    const byCat = getActivityEvents().filter((e) => e.category === 'inventory');
    expect(byCat).toBeDefined();

    const byId = getActivityEventById('non-existent-uuid');
    expect(byId).toBeUndefined();

    const storageStatus = getActivityStorageStatus();
    expect(storageStatus).toBeDefined();

    // Inventory must remain entirely unaltered
    expect(domainStore.getState().inventory).toEqual(startingInventory);
  });
});
