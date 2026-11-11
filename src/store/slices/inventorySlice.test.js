import { describe, it, expect, beforeEach, vi } from 'vitest';
import useStore from '../useStore';
import { prepareCraftingInventoryTransaction } from '../../utils/craftingInventoryTransaction';
import {
  createCraftingSession,
  recordCraftingResult,
} from '../../utils/craftingSession';
import { calculateAuthoritativeGrossRequirements } from '../../utils/aggregator';
import { STORE_NAME } from '../persistence';

describe('Phase CRAFT-D4-C2-B: Persistent Crafting Inventory Transaction Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    useStore.getState().resetStore();
    useStore.setState({ appliedCraftingTransactions: [] });
  });

  // ── 1. Successful Slime Transaction (Exact Fixture) ──
  it('1. Successful Slime transaction: applies exact deltas to persistent store and updates all tiers and Mora', () => {
    const startingInventory = {
      SlimeCondensate: 6309,
      SlimeSecretions: 281,
      SlimeConcentrate: 57,
      Mora: 42590000,
    };
    const grossRequirements = {
      SlimeCondensate: 219,
      SlimeSecretions: 411,
      SlimeConcentrate: 689,
    };

    // Initialize store
    useStore.setState({
      inventory: { ...startingInventory },
      goals: { ...grossRequirements },
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements,
      bonusType: 'double_output',
    });

    // 1,668 crafts -> 1,841 received (173 bonus), 5,004 Condensate, 41,700 Mora
    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
      bonusOutputReceived: 173,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: useStore.getState().inventory,
      grossRequirements: useStore.getState().goals,
      mora: useStore.getState().inventory['Mora'],
    };

    const prep = prepareCraftingInventoryTransaction(recordedSession, liveSource);
    expect(prep.isPrepared).toBe(true);

    const result = useStore.getState().applyCraftingTransaction(prep.transaction, recordedSession);

    expect(result.success).toBe(true);
    expect(result.status).toBe('applied');
    expect(result.transactionId).toBe(prep.transaction.transactionId);

    const state = useStore.getState();
    expect(state.inventory['SlimeCondensate']).toBe(1305);
    expect(state.inventory['SlimeSecretions']).toBe(2122);
    expect(state.inventory['SlimeConcentrate']).toBe(57);
    expect(state.inventory['Mora']).toBe(42548300);

    // Verify localStorage has persisted the update
    const rawStored = window.localStorage.getItem(STORE_NAME);
    expect(rawStored).not.toBeNull();
    const parsed = JSON.parse(rawStored);
    expect(parsed.state.inventory['SlimeCondensate']).toBe(1305);
    expect(parsed.state.inventory['SlimeSecretions']).toBe(2122);
    expect(parsed.state.inventory['Mora']).toBe(42548300);
  });

  // ── 2. Successful Hilichurl Refund Transaction (Exact Fixture) ──
  it('2. Successful Hilichurl refund transaction: applies net consumption accounting for actual refunds', () => {
    const startingInventory = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      Mora: 10000,
    };
    const grossRequirements = {
      DamagedMask: 0,
      StainedMask: 100,
      OminousMask: 0,
    };

    useStore.setState({
      inventory: { ...startingInventory },
      goals: { ...grossRequirements },
    });

    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: startingInventory,
      grossRequirements,
      bonusType: 'ingredient_refund',
    });

    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 100,
      totalOutputReceived: 100,
      bonusOutputReceived: 0,
      refundsReceived: 27,
    });

    const liveSource = {
      inventory: useStore.getState().inventory,
      grossRequirements: useStore.getState().goals,
      mora: useStore.getState().inventory['Mora'],
    };

    const prep = prepareCraftingInventoryTransaction(recordedSession, liveSource);
    expect(prep.isPrepared).toBe(true);

    const result = useStore.getState().applyCraftingTransaction(prep.transaction, recordedSession);

    expect(result.success).toBe(true);
    expect(result.status).toBe('applied');

    const state = useStore.getState();
    expect(state.inventory['DamagedMask']).toBe(1678);
    expect(state.inventory['StainedMask']).toBe(323);
    expect(state.inventory['OminousMask']).toBe(35);
    expect(state.inventory['Mora']).toBe(7500);
  });

  // ── 3. Multiple Chronological Events ──
  it('3. Multiple chronological events: applies cumulative deltas across multiple crafting steps', () => {
    const startingInventory = {
      SlimeCondensate: 1000,
      SlimeSecretions: 100,
      SlimeConcentrate: 10,
      Mora: 50000,
    };

    useStore.setState({
      inventory: { ...startingInventory },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: 'double_output',
    });

    // Step 1: Craft 50 Secretions (150 Condensate, 55 received)
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 50,
      totalOutputReceived: 55,
      bonusOutputReceived: 5,
      refundsReceived: 0,
    });

    // Step 2: Craft 20 Concentrate (60 Secretions, 22 received)
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 20,
      totalOutputReceived: 22,
      bonusOutputReceived: 2,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: useStore.getState().inventory['Mora'],
    };

    const prep = prepareCraftingInventoryTransaction(s2, liveSource);
    const result = useStore.getState().applyCraftingTransaction(prep.transaction, s2);

    expect(result.success).toBe(true);
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(850);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(95); // 100 + 55 - 60
    expect(useStore.getState().inventory['SlimeConcentrate']).toBe(32); // 10 + 22
    expect(useStore.getState().inventory['Mora']).toBe(47750); // 50,000 - 1,250 - 1,000
  });

  // ── 4. Four-Tier Crafting Chains ──
  it('4. Four-tier crafting chains: applies weapon ascension 4-tier chain updates correctly', () => {
    const startingInventory = {
      TileOfDecarabiansTower: 900,
      DebrisOfDecarabiansCity: 100,
      FragmentOfDecarabiansEpic: 10,
      ScatteredPieceOfDecarabiansDream: 0,
      Mora: 100000,
    };

    useStore.setState({
      inventory: { ...startingInventory },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'DecarabianTiles',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_DebrisOfDecarabiansCity',
      operationsPerformed: 100,
      totalOutputReceived: 100,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_FragmentOfDecarabiansEpic',
      operationsPerformed: 30,
      totalOutputReceived: 30,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });
    const s3 = recordCraftingResult(s2, {
      recipeId: 'craft_ScatteredPieceOfDecarabiansDream',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: useStore.getState().inventory['Mora'],
    };

    const prep = prepareCraftingInventoryTransaction(s3, liveSource);
    const result = useStore.getState().applyCraftingTransaction(prep.transaction, s3);

    expect(result.success).toBe(true);
    expect(useStore.getState().inventory['TileOfDecarabiansTower']).toBe(600);
    expect(useStore.getState().inventory['DebrisOfDecarabiansCity']).toBe(110);
    expect(useStore.getState().inventory['FragmentOfDecarabiansEpic']).toBe(10);
    expect(useStore.getState().inventory['ScatteredPieceOfDecarabiansDream']).toBe(10);
    expect(useStore.getState().inventory['Mora']).toBe(66250);
  });

  // ── 5. One Coherent Zustand State Transition ──
  it('5. One coherent Zustand state transition: subscriber observes all material changes in a single notification', () => {
    const startingInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 10,
      SlimeConcentrate: 0,
      Mora: 1000,
    };

    useStore.setState({
      inventory: { ...startingInventory },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: startingInventory,
      grossRequirements: {},
      mora: 1000,
    });

    let notificationCount = 0;
    const statesObserved = [];

    const unsubscribe = useStore.subscribe((state) => {
      notificationCount++;
      statesObserved.push({
        cond: state.inventory['SlimeCondensate'],
        sec: state.inventory['SlimeSecretions'],
        mora: state.inventory['Mora'],
      });
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    unsubscribe();

    expect(notificationCount).toBe(1);
    expect(statesObserved).toHaveLength(1);
    expect(statesObserved[0]).toEqual({
      cond: 70,
      sec: 20,
      mora: 750,
    });
  });

  // ── 6. Unrelated Inventory Entries Unchanged ──
  it('6. Unrelated inventory entries unchanged: leaves unrelated materials completely untouched', () => {
    useStore.setState({
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000,
        SweetFlower: 999,
        WindwheelAster: 42,
      },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000,
      },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(useStore.getState().inventory['SweetFlower']).toBe(999);
    expect(useStore.getState().inventory['WindwheelAster']).toBe(42);
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(70);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(10);
  });

  // ── 7. Mora Deducted Exactly Once ──
  it('7. Mora deducted exactly once: fee matches operation count * recipe fee', () => {
    useStore.setState({
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 5000,
      },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      bonusType: null,
    });

    // 10 crafts @ 25 Mora = 250
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 5000,
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(useStore.getState().inventory['Mora']).toBe(4750);
  });

  // ── 8. Rapid Duplicate Action Calls ──
  it('8. Rapid duplicate action calls: second consecutive call is rejected with DUPLICATE_TRANSACTION', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // First call succeeds
    const res1 = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res1.success).toBe(true);
    expect(res1.status).toBe('applied');

    // Second call is immediately rejected
    const res2 = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe('rejected');
    expect(res2.code).toBe('DUPLICATE_TRANSACTION');

    // Inventory was NOT modified a second time
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(70);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(10);
  });

  // ── 9. Repeat After Success ──
  it('9. Repeat after success: re-submitting transaction fails duplicate check and source match', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    const retryRes = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(retryRes.success).toBe(false);
    expect(retryRes.status).toBe('rejected');
  });

  // ── 10. Stale Material Quantities ──
  it('10. Stale material quantities: rejects transaction if saved inventory changed before apply', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Material quantity changes in store before apply
    useStore.getState().setInventory('SlimeCondensate', 80);

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('SOURCE_CONFLICT');
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(80);
  });

  // ── 11. Stale Mora ──
  it('11. Stale Mora: rejects transaction if saved Mora changed before apply', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Mora changed in store before apply
    useStore.getState().setInventory('Mora', 500);

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('SOURCE_CONFLICT');
    expect(useStore.getState().inventory['Mora']).toBe(500);
  });

  // ── 12. Requirements Changes ──
  it('12. Requirements changes: rejects transaction if progression requirements changed', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: { SlimeSecretions: 20 },
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: { SlimeSecretions: 20 },
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: { SlimeSecretions: 20 },
      mora: 1000,
    });

    // Requirements changed in store before apply
    useStore.setState({ goals: { SlimeSecretions: 50 } });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('UNREVIEWED_SOURCE_CONFLICT');
  });

  // ── 13. Acknowledged Stale Session (conflict_continued) ──
  it('13. Acknowledged stale session: strictly rejects transaction if session was marked conflict_continued', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const continuedSession = {
      ...s1,
      acknowledgedFingerprint: 'acknowledged_fingerprint_stale',
    };

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, continuedSession);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('CONTINUED_SOURCE_CONFLICT');
  });

  // ── 14. Forged Transaction ID ──
  it('14. Forged transaction ID: rejects transaction if ID is malformed or invalid', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    const forgedTx = {
      ...prep.transaction,
      transactionId: '',
    };

    const res = useStore.getState().applyCraftingTransaction(forgedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('INVALID_TRANSACTION_ID');
  });

  // ── 15. Incorrect Event Ledger ──
  it('15. Incorrect event ledger: rejects transaction if session ledger fails canonical revalidation', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Corrupt event ledger in session
    const corruptedSession = {
      ...s1,
      events: [
        {
          ...s1.events[0],
          grossInputConsumed: 999, // tampered!
        },
      ],
    };

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, corruptedSession);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('LEDGER_INTEGRITY_MISMATCH');
  });

  // ── 16. Tampered Delta ──
  it('16. Tampered delta: rejects transaction if deltas do not match canonical recalculation', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    const tamperedTx = {
      ...prep.transaction,
      deltas: {
        ...prep.transaction.deltas,
        SlimeCondensate: 0, // should be -30!
      },
    };

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('DELTA_MISMATCH');
  });

  // ── 17. Tampered Ending Balance ──
  it('17. Tampered ending balance: rejects transaction if ending balance does not match calculated balance', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    const tamperedTx = {
      ...prep.transaction,
      endingBalances: {
        ...prep.transaction.endingBalances,
        SlimeSecretions: 99999, // tampered!
      },
    };

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('ENDING_BALANCE_MISMATCH');
  });

  // ── 18. Insufficient Material Balance ──
  it('18. Insufficient material balance: rejects transaction if resulting balance would be negative', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 20, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 20, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    // Construct a transaction that tries to deduct 30 Condensate from 20
    const mockTx = {
      transactionId: 'tx_mock_neg',
      sessionId: session.sessionId,
      familyId: 'Slime',
      familyName: 'Slime',
      eventIds: ['evt_1'],
      ledgerFingerprint: 'mock',
      sourceFingerprint: session.snapshot.fingerprint,
      startingBalances: { SlimeCondensate: 20, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      deltas: { SlimeCondensate: -30, SlimeSecretions: 10, SlimeConcentrate: 0, Mora: -250 },
      endingBalances: { SlimeCondensate: -10, SlimeSecretions: 10, SlimeConcentrate: 0, Mora: 750 },
      totalOperations: 10,
      totalBatches: 1,
      totalMoraSpent: 250,
      createdAt: Date.now(),
      status: 'valid',
      diagnostics: [],
    };

    const res = useStore.getState().applyCraftingTransaction(mockTx, session);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
  });

  // ── 19. Missing Session Context ──
  it('19. Missing session context: rejects transaction when session context is null', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const mockTx = {
      transactionId: 'tx_mock',
      status: 'valid',
    };

    const res = useStore.getState().applyCraftingTransaction(mockTx, null);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('MISSING_SESSION_CONTEXT');
  });

  // ── 20. Rejected Transaction Leaves Inventory Unchanged ──
  it('20. Rejected transaction leaves inventory unchanged: store state is identical after rejection', () => {
    const originalInventory = {
      SlimeCondensate: 100,
      SlimeSecretions: 50,
      SlimeConcentrate: 10,
      Mora: 10000,
    };

    useStore.setState({
      inventory: { ...originalInventory },
      goals: {},
    });

    const res = useStore.getState().applyCraftingTransaction(null, null);
    expect(res.success).toBe(false);
    expect(useStore.getState().inventory).toEqual(originalInventory);
  });

  // ── 21. Persistence State After Success ──
  it('21. Persistence state after success: verifies localStorage matches updated store inventory', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    const stored = window.localStorage.getItem(STORE_NAME);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed.state.inventory['SlimeCondensate']).toBe(70);
    expect(parsed.state.inventory['SlimeSecretions']).toBe(10);
    expect(parsed.state.inventory['Mora']).toBe(750);
  });

  // ── 22. Persistence Write Failure (Failure Injection) ──
  it('22. Persistence write failure: returns uncertain status when localStorage write fails', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Mock localStorage.setItem to throw QuotaExceededError
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: DomException');
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('uncertain');
    expect(res.code).toBe('PERSISTENCE_FAILURE');
  });

  // ── 23. Uncertain Persistence Outcome ──
  it('23. Uncertain persistence outcome: distinguishes persistence failure from rejected validation', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Ordinary validation failure: returns rejected
    const rejectedRes = useStore.getState().applyCraftingTransaction(null, null);
    expect(rejectedRes.status).toBe('rejected');

    // Storage failure: returns uncertain
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Disk write failed');
    });

    const uncertainRes = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(uncertainRes.status).toBe('uncertain');
  });

  // ── 24. Rehydration After Successful Write ──
  it('24. Rehydration after successful write: fresh store hydration reads newly written balances', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    // Simulate page reload: read from localStorage directly
    const stored = window.localStorage.getItem(STORE_NAME);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);

    expect(parsed.state.inventory['SlimeCondensate']).toBe(70);
    expect(parsed.state.inventory['SlimeSecretions']).toBe(10);
    expect(parsed.state.inventory['Mora']).toBe(750);
  });

  // ── 25. Second-Tab Stale-State Simulation ──
  it('25. Second-tab stale-state simulation: detects when another tab updated localStorage and rejects apply', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Simulate another tab having written different quantities to localStorage
    const foreignDiskState = {
      state: {
        inventory: {
          SlimeCondensate: 50, // Different from memory!
          SlimeSecretions: 0,
          SlimeConcentrate: 0,
          Mora: 1000,
        },
      },
      version: 8,
    };
    window.localStorage.setItem(STORE_NAME, JSON.stringify(foreignDiskState));

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('STORAGE_SOURCE_MISMATCH');
  });

  // ── 26. Relevant Import Before Application ──
  it('26. Relevant import before application: rejects transaction when external import modified inventory', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Simulate external GOOD import updating inventory
    useStore.getState().importGoodData({
      format: 'GOOD',
      materials: {
        SlimeCondensate: 500,
        Mora: 20000,
      },
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('SOURCE_CONFLICT');
  });

  // ── 27. Unrelated Inventory Change ──
  it('27. Unrelated inventory change: allows apply when unrelated materials change, preserving both', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: {},
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      grossRequirements: {},
      mora: 1000,
    });

    // Unrelated material added
    useStore.getState().setInventory('SweetFlower', 50);

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');

    expect(useStore.getState().inventory['SweetFlower']).toBe(50);
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(70);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(10);
  });
});


describe('Phase CRAFT-D4-C2-B.1: Final Persistence Integrity & Cross-Tab Data Preservation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    useStore.getState().resetStore();
    useStore.setState({ appliedCraftingTransactions: [] });
  });

  // 1. Critical Cross-Tab Scenario: Unrelated inventory updated by Tab B (Sweet Flower 100 -> 150)
  it('1. Critical Cross-Tab: Tab B changes Sweet Flower to 150, Tab A fails closed and does NOT clobber storage', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 6309,
        SlimeSecretions: 281,
        SlimeConcentrate: 0,
        Mora: 42590000,
        SweetFlower: 100,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 42590000,
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 42590000,
    });

    // Tab B modifies SweetFlower to 150 in persistent storage
    const currentDisk = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    window.localStorage.setItem(
      STORE_NAME,
      JSON.stringify({
        ...currentDisk,
        state: {
          ...currentDisk.state,
          inventory: {
            ...currentDisk.state.inventory,
            SweetFlower: 150,
          },
        },
      })
    );

    // Tab A attempts to apply the transaction
    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    // Assertions:
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('STORAGE_SOURCE_MISMATCH');

    // In-memory state in Tab A is NOT mutated
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(6309);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(281);

    // Persistent storage in localStorage survived untouched by Tab A
    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.inventory['SweetFlower']).toBe(150);
    expect(diskAfter.state.inventory['SlimeCondensate']).toBe(6309);
    expect(diskAfter.state.inventory['SlimeSecretions']).toBe(281);
    expect(diskAfter.state.inventory['Mora']).toBe(42590000);
  });

  // 2. Critical Cross-Tab Scenario: Roster updated by Tab B
  it('2. Critical Cross-Tab: Tab B adds/modifies character in roster, Tab A fails closed and preserves roster', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 10000,
      },
      roster: {
        Amber: { level: 20, ascension: 1 },
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
    });

    // Tab B updates roster in persistent storage (e.g. added Kaeya Level 40)
    const currentDisk = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    window.localStorage.setItem(
      STORE_NAME,
      JSON.stringify({
        ...currentDisk,
        state: {
          ...currentDisk.state,
          roster: {
            ...currentDisk.state.roster,
            Kaeya: { level: 40, ascension: 2 },
          },
        },
      })
    );

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('STORAGE_SOURCE_MISMATCH');
    expect(res.message).toContain('roster');

    // Tab B's roster update is intact
    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.roster['Kaeya']).toEqual({ level: 40, ascension: 2 });
    expect(diskAfter.state.inventory['SlimeCondensate']).toBe(100);
  });

  // 3. Critical Cross-Tab Scenario: Tracked weapons updated by Tab B
  it('3. Critical Cross-Tab: Tab B adds weapon to trackedWeapons, Tab A fails closed and preserves weapons', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 10000,
      },
      trackedWeapons: [{ id: 'w1', weaponName: 'Favonius Sword', level: 80 }],
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
    });

    // Tab B adds a new tracked weapon in persistent storage
    const currentDisk = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    window.localStorage.setItem(
      STORE_NAME,
      JSON.stringify({
        ...currentDisk,
        state: {
          ...currentDisk.state,
          trackedWeapons: [
            ...currentDisk.state.trackedWeapons,
            { id: 'w2', weaponName: 'Staff of Homa', level: 90 },
          ],
        },
      })
    );

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('STORAGE_SOURCE_MISMATCH');
    expect(res.message).toContain('trackedWeapons');

    // Tab B's tracked weapon is preserved in storage
    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.trackedWeapons).toHaveLength(2);
    expect(diskAfter.state.trackedWeapons[1].weaponName).toBe('Staff of Homa');
  });

  // 4. External changes rejected without overwriting storage
  it('4. External changes rejected without overwriting storage: no partial update or receipt', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 200,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 5000,
      },
      goals: { SlimeSecretions: 10 },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: initialState.goals,
      mora: 5000,
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: initialState.inventory,
      grossRequirements: initialState.goals,
      mora: 5000,
    });

    // External modification of goals in storage
    const currentDisk = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    window.localStorage.setItem(
      STORE_NAME,
      JSON.stringify({
        ...currentDisk,
        state: {
          ...currentDisk.state,
          goals: { SlimeSecretions: 25 },
        },
      })
    );

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('STORAGE_SOURCE_MISMATCH');

    // Confirm no receipt added in memory or disk
    expect(useStore.getState().appliedCraftingTransactions).toHaveLength(0);
    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.goals.SlimeSecretions).toBe(25);
    expect(diskAfter.state.inventory.SlimeCondensate).toBe(200);
  });

  // 5. Identical persistent snapshots allow legitimate transaction
  it('5. Identical persistent snapshots allow legitimate transaction: succeeds when storage matches', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 2000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 2000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 2000,
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(85);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(5);
    expect(useStore.getState().inventory['Mora']).toBe(1875);

    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.inventory['SlimeCondensate']).toBe(85);
  });

  // 6. Valid Slime transaction with 10% double bonus
  it('6. Valid Slime transaction with 10% double bonus: updates all tiers accurately and persists', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 300,
        SlimeSecretions: 50,
        SlimeConcentrate: 0,
        Mora: 10000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
      bonusType: 'double_output',
    });

    // 10 crafts -> 30 condensate spent, 10 base + 2 bonus = 12 secretions received
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 12,
      bonusOutputReceived: 2,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(270);
    expect(useStore.getState().inventory['SlimeSecretions']).toBe(62);
    expect(useStore.getState().inventory['Mora']).toBe(9750);

    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.inventory['SlimeCondensate']).toBe(270);
    expect(diskAfter.state.inventory['SlimeSecretions']).toBe(62);
    expect(diskAfter.state.inventory['Mora']).toBe(9750);
  });

  // 7. Valid Hilichurl refund transaction with 25% refund
  it('7. Valid Hilichurl refund transaction with 25% refund: accounts for refunds and persists', () => {
    const initialState = {
      inventory: {
        DamagedMask: 300,
        StainedMask: 10,
        OminousMask: 0,
        Mora: 10000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
      bonusType: 'ingredient_refund',
    });

    // 10 crafts -> 30 gross consumed, 3 refunded -> net 27 consumed, 10 stained produced
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 3,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 10000,
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');
    expect(useStore.getState().inventory['DamagedMask']).toBe(273);
    expect(useStore.getState().inventory['StainedMask']).toBe(20);
    expect(useStore.getState().inventory['Mora']).toBe(9750);

    const diskAfter = JSON.parse(window.localStorage.getItem(STORE_NAME) || '{}');
    expect(diskAfter.state.inventory['DamagedMask']).toBe(273);
    expect(diskAfter.state.inventory['StainedMask']).toBe(20);
  });

  // 8. Storage read failure
  it('8. Storage read failure: fails closed with STORAGE_READ_ERROR when localStorage.getItem throws', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Mock Storage.prototype.getItem throwing SecurityError
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access to localStorage is denied (SecurityError)');
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('STORAGE_READ_ERROR');
    expect(res.message).toContain('SecurityError');

    // Memory was NOT mutated
    expect(useStore.getState().inventory['SlimeCondensate']).toBe(100);
  });

  // 9. Storage write failure
  it('9. Storage write failure: returns status uncertain with PERSISTENCE_FAILURE when localStorage.setItem throws', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Storage read passes, but storage write throws QuotaExceededError
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: storage limit reached');
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('uncertain');
    expect(res.code).toBe('PERSISTENCE_FAILURE');
    expect(res.transactionId).toBe(prep.transaction.transactionId);
  });

  // 10. Uncertain result does not falsely report success
  it('10. Uncertain result does not falsely report success: success is false and status is explicitly uncertain', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Injected storage write failure
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Disk full');
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(res.success).toBe(false);
    expect(res.status).toBe('uncertain');
    expect(res.code).toBe('PERSISTENCE_FAILURE');
    expect(res.updatedInventory).toBeUndefined();
  });

  // 11. Repeated transaction remains blocked
  it('11. Repeated transaction remains blocked: retrying same transaction after application fails duplicate and source gates', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 100,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000,
      },
    };
    useStore.setState(initialState);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
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
      inventory: initialState.inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // First attempt succeeds
    const firstRes = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(firstRes.success).toBe(true);
    expect(firstRes.status).toBe('applied');

    // Immediate second attempt with same transaction is blocked
    const secondRes = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(secondRes.success).toBe(false);
    expect(secondRes.status).toBe('rejected');
    expect(secondRes.code).toBe('DUPLICATE_TRANSACTION');
  });
});

describe('Phase CRAFT-D4-C2-C.1: Authoritative Requirements & Canonical Transaction Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    useStore.getState().resetStore();
    useStore.setState({ appliedCraftingTransactions: [] });
  });

  // ── 1. Real Planner Requirements ──
  it('1. Real Planner requirements: derives gross requirements from roster with goals: [] and applies transaction', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 1000,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 500000,
      },
      goals: [], // Realistic production shape!
      roster: {
        Xiangling: {
          name: 'Xiangling',
          level: 1,
          targetLevel: 90,
          ascension: 0,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 10, skill: 10, burst: 10 },
        },
      },
      trackedWeapons: [],
    };
    useStore.setState(initialState);

    // Derive authoritative gross requirements
    const authoritativeReqs = calculateAuthoritativeGrossRequirements(useStore.getState());
    expect(authoritativeReqs.SlimeCondensate).toBeGreaterThan(0);
    expect(authoritativeReqs.SlimeSecretions).toBeGreaterThan(0);
    expect(authoritativeReqs.SlimeConcentrate).toBeGreaterThan(0);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: authoritativeReqs,
      mora: 500000,
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: authoritativeReqs,
      mora: 500000,
    });
    expect(prep.isPrepared).toBe(true);

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');

    // Assert store inventory updated
    const liveInv = useStore.getState().inventory;
    expect(liveInv.SlimeCondensate).toBe(1000 - 30);
    expect(liveInv.SlimeSecretions).toBe(10);
    expect(liveInv.Mora).toBe(500000 - 10 * 25);
    // Assert goals remained an array
    expect(Array.isArray(useStore.getState().goals)).toBe(true);
  });

  // ── 2. Relevant Demand Change ──
  it('2. Relevant demand change: modifying Xiangling target talents causes UNREVIEWED_SOURCE_CONFLICT or SOURCE_CONFLICT', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 1000,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 500000,
      },
      goals: [],
      roster: {
        Xiangling: {
          name: 'Xiangling',
          level: 1,
          targetLevel: 90,
          ascension: 0,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 10, skill: 10, burst: 10 },
        },
      },
      trackedWeapons: [],
    };
    useStore.setState(initialState);

    const authoritativeReqs = calculateAuthoritativeGrossRequirements(useStore.getState());
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: authoritativeReqs,
      mora: 500000,
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: authoritativeReqs,
      mora: 500000,
    });
    expect(prep.isPrepared).toBe(true);

    // Now user changes Xiangling's target talents in the planner
    useStore.setState({
      roster: {
        Xiangling: {
          name: 'Xiangling',
          level: 1,
          targetLevel: 90,
          ascension: 0,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 8, skill: 8, burst: 8 }, // Lowered demand!
        },
      },
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(['UNREVIEWED_SOURCE_CONFLICT', 'SOURCE_CONFLICT']).toContain(res.code);

    // Inventory remained untouched
    expect(useStore.getState().inventory.SlimeCondensate).toBe(1000);
  });

  // ── 3. Unrelated Plan Change ──
  it('3. Unrelated plan change: adding character requiring Hilichurl masks (Amber) does not cause conflict for Slime transaction', () => {
    const initialState = {
      inventory: {
        SlimeCondensate: 1000,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 500000,
      },
      goals: [],
      roster: {
        Xiangling: {
          name: 'Xiangling',
          level: 1,
          targetLevel: 90,
          ascension: 0,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 10, skill: 10, burst: 10 },
        },
      },
      trackedWeapons: [],
    };
    useStore.setState(initialState);

    const authoritativeReqs = calculateAuthoritativeGrossRequirements(useStore.getState());
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: initialState.inventory,
      startingInventory: initialState.inventory,
      grossRequirements: authoritativeReqs,
      mora: 500000,
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep = prepareCraftingInventoryTransaction(s1, {
      inventory: useStore.getState().inventory,
      grossRequirements: authoritativeReqs,
      mora: 500000,
    });
    expect(prep.isPrepared).toBe(true);

    // Add Amber to roster (Amber needs Hilichurl masks and arrowheads, not Slime)
    useStore.setState({
      roster: {
        ...useStore.getState().roster,
        Amber: {
          name: 'Amber',
          level: 1,
          targetLevel: 80,
          ascension: 0,
          targetAscension: 5,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 6, skill: 6, burst: 6 },
        },
      },
    });

    const res = useStore.getState().applyCraftingTransaction(prep.transaction, s1);
    expect(res.success).toBe(true);
    expect(res.status).toBe('applied');
    expect(useStore.getState().inventory.SlimeCondensate).toBe(970);
    expect(useStore.getState().inventory.SlimeSecretions).toBe(10);
  });

  // ── 4. Forging Requirements ──
  it('4. Forging requirements: derives authoritative requirements from tracked weapon forging (Amenoma Kageuchi)', () => {
    const state = {
      roster: {},
      trackedWeapons: [
        {
          id: 'tw_amenoma_1',
          weaponName: 'Amenoma Kageuchi',
          level: 90,
          targetLevel: 90,
          ascension: 6,
          targetAscension: 6,
          currentRefinement: 1,
          targetRefinement: 5,
        },
      ],
      goals: [],
    };
    useStore.setState(state);

    const authoritativeReqs = calculateAuthoritativeGrossRequirements(useStore.getState());
    // Refinement 1 -> 5 is 4 refinements
    // Amenoma needs 1 Sword Billet, 50 Amethyst Lump, 50 White Iron Chunk, 500 Mora per craft
    expect(authoritativeReqs.northlander_sword_billet).toBe(4);
    expect(authoritativeReqs.amethyst_lump).toBe(200);
    expect(authoritativeReqs.white_iron_chunk).toBe(200);
    expect(authoritativeReqs.Mora).toBe(2000);
  });

  // ── 5. No Artificial Goals Map ──
  it('5. No artificial goals map: goals remains an array throughout store operations and realistic scenarios', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    expect(Array.isArray(useStore.getState().goals)).toBe(true);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    useStore.getState().applyCraftingTransaction(prep.transaction, s1);

    expect(Array.isArray(useStore.getState().goals)).toBe(true);
  });

  // ── 6. Missing Negative Delta ──
  it('6. Missing negative delta: proposed transaction omitting negative ingredient delta is rejected with DELTA_MISMATCH', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: delete tier 1 ingredient delta (SlimeCondensate)
    const tamperedTx = {
      ...prep.transaction,
      deltas: { ...prep.transaction.deltas },
    };
    delete tamperedTx.deltas.SlimeCondensate;

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('DELTA_MISMATCH');
    expect(useStore.getState().inventory.SlimeCondensate).toBe(100);
  });

  // ── 7. Missing Mora Delta ──
  it('7. Missing Mora delta: proposed transaction omitting Mora cost is rejected with DELTA_MISMATCH', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: delete Mora delta
    const tamperedTx = {
      ...prep.transaction,
      deltas: { ...prep.transaction.deltas },
    };
    delete tamperedTx.deltas.Mora;

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('DELTA_MISMATCH');
    expect(useStore.getState().inventory.Mora).toBe(1000);
  });

  // ── 8. Unexpected Additional Delta ──
  it('8. Unexpected additional delta: client proposing transaction with injected SweetFlower is rejected with DELTA_MISMATCH', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000, SweetFlower: 5 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: inject SweetFlower: 100
    const tamperedTx = {
      ...prep.transaction,
      deltas: { ...prep.transaction.deltas, SweetFlower: 100 },
    };

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('DELTA_MISMATCH');
    expect(useStore.getState().inventory.SweetFlower).toBe(5);
  });

  // ── 9. Modified Ending Balance ──
  it('9. Modified ending balance: proposed transaction claiming inflated ending balance is rejected with ENDING_BALANCE_MISMATCH', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: claim ending balance of 9999 for SlimeSecretions
    const tamperedTx = {
      ...prep.transaction,
      endingBalances: { ...prep.transaction.endingBalances, SlimeSecretions: 9999 },
    };

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('ENDING_BALANCE_MISMATCH');
    expect(useStore.getState().inventory.SlimeSecretions).toBe(0);
  });

  // ── 10. Modified Identity ──
  it('10. Modified identity: proposed transaction with tampered transactionId is rejected with TRANSACTION_ID_MISMATCH', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: transactionId
    const tamperedTx = {
      ...prep.transaction,
      transactionId: 'tx-tampered-fake-id',
    };

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(res.code).toBe('TRANSACTION_ID_MISMATCH');
  });

  // ── 11. Modified Starting Balance ──
  it('11. Modified starting balance: proposed transaction with altered starting balance is rejected with STARTING_BALANCES_MISMATCH or SOURCE_CONFLICT', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: alter starting balance
    const tamperedTx = {
      ...prep.transaction,
      startingBalances: { ...prep.transaction.startingBalances, SlimeCondensate: 9999 },
    };

    const res = useStore.getState().applyCraftingTransaction(tamperedTx, s1);
    expect(res.success).toBe(false);
    expect(res.status).toBe('rejected');
    expect(['STARTING_BALANCES_MISMATCH', 'SOURCE_CONFLICT']).toContain(res.code);
  });

  // ── 12. Tampered Session Identity & Metadata ──
  it('12. Tampered session identity & metadata: mismatches in sessionId, familyId, or operations count are rejected', () => {
    useStore.setState({
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
      goals: [],
      roster: {},
      trackedWeapons: [],
    });

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 1000 },
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
      inventory: useStore.getState().inventory,
      grossRequirements: {},
      mora: 1000,
    });

    // Tamper: sessionId
    const resSession = useStore.getState().applyCraftingTransaction(
      { ...prep.transaction, sessionId: 'session-tampered' },
      s1
    );
    expect(resSession.success).toBe(false);
    expect(resSession.code).toBe('SESSION_ID_MISMATCH');

    // Tamper: familyId
    const resFamily = useStore.getState().applyCraftingTransaction(
      { ...prep.transaction, familyId: 'HilichurlMask' },
      s1
    );
    expect(resFamily.success).toBe(false);
    expect(resFamily.code).toBe('FAMILY_ID_MISMATCH');

    // Tamper: totalOperations
    const resOps = useStore.getState().applyCraftingTransaction(
      { ...prep.transaction, totalOperations: 99 },
      s1
    );
    expect(resOps.success).toBe(false);
    expect(resOps.code).toBe('OPERATIONS_MISMATCH');

    // Tamper: totalMoraSpent
    const resMora = useStore.getState().applyCraftingTransaction(
      { ...prep.transaction, totalMoraSpent: 0 },
      s1
    );
    expect(resMora.success).toBe(false);
    expect(resMora.code).toBe('MORA_SPENT_MISMATCH');
  });
});
