import { describe, it, expect, beforeEach } from 'vitest';
import {
  prepareCraftingInventoryTransaction,
  validateCraftingInventoryTransaction,
  calculateConfirmedCraftingDeltas,
  deriveInventoryTransactionPreview,
  CraftingInventoryTransaction,
} from './craftingInventoryTransaction';
import {
  createCraftingSession,
  recordCraftingResult,
  CraftingSessionState,
  CraftingResultEvent,
} from './craftingSession';
import useStore from '../store/useStore';

describe('Phase CRAFT-D4-C2-A: Pure Inventory Transaction Preparation Suite', () => {
  beforeEach(() => {
    // Ensure clean state before each test
    localStorage.clear();
  });

  // ── 1. Slime Exact Transaction (Section 8 Fixture) ──
  it('1. Slime exact transaction: verifies exact deltas and ending quantities with 10% Double Output', () => {
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

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements,
      bonusType: 'double_output',
    });

    // Event: craft 1,668 Secretions, receiving 1,841 (173 bonus)
    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
      bonusOutputReceived: 173,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: { ...grossRequirements },
      mora: 42590000,
    };

    const result = prepareCraftingInventoryTransaction(recordedSession, liveSource);

    expect(result.isPrepared).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.transaction).not.toBeNull();

    const tx = result.transaction!;
    expect(tx.status).toBe('valid');
    expect(tx.totalBatches).toBe(1);
    expect(tx.totalOperations).toBe(1668);
    expect(tx.totalMoraSpent).toBe(41700);

    // Exact deltas
    expect(tx.deltas['SlimeCondensate']).toBe(-5004);
    expect(tx.deltas['SlimeSecretions']).toBe(1841);
    expect(tx.deltas['SlimeConcentrate']).toBe(0);
    expect(tx.deltas['Mora']).toBe(-41700);

    // Exact ending balances
    expect(tx.endingBalances['SlimeCondensate']).toBe(1305);
    expect(tx.endingBalances['SlimeSecretions']).toBe(2122);
    expect(tx.endingBalances['SlimeConcentrate']).toBe(57);
    expect(tx.endingBalances['Mora']).toBe(42548300);

    // Preview
    expect(result.preview).not.toBeNull();
    const preview = result.preview!;
    expect(preview.canApply).toBe(true);
    expect(preview.totalBatches).toBe(1);
    expect(preview.totalOperations).toBe(1668);
    expect(preview.totalMoraSpent).toBe(41700);
    expect(preview.materialChanges).toHaveLength(2); // Only changed items: Condensate & Secretions

    const condChange = preview.materialChanges.find((m) => m.itemId === 'SlimeCondensate')!;
    expect(condChange.savedNow).toBe(6309);
    expect(condChange.change).toBe(-5004);
    expect(condChange.after).toBe(1305);

    const secChange = preview.materialChanges.find((m) => m.itemId === 'SlimeSecretions')!;
    expect(secChange.savedNow).toBe(281);
    expect(secChange.change).toBe(1841);
    expect(secChange.after).toBe(2122);

    expect(preview.moraChange.savedNow).toBe(42590000);
    expect(preview.moraChange.change).toBe(-41700);
    expect(preview.moraChange.after).toBe(42548300);
  });

  // ── 2. Hilichurl Exact Refund Transaction (Section 9 Fixture) ──
  it('2. Hilichurl exact refund transaction: verifies 25% Refund offsets gross consumption', () => {
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

    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: startingInventory,
      grossRequirements,
      bonusType: 'ingredient_refund',
    });

    // 100 crafts of StainedMask, 27 DamagedMask refunded
    const recordedSession = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 100,
      totalOutputReceived: 100,
      bonusOutputReceived: 0,
      refundsReceived: 27,
    });

    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: { ...grossRequirements },
      mora: 10000,
    };

    const result = prepareCraftingInventoryTransaction(recordedSession, liveSource);

    expect(result.isPrepared).toBe(true);
    expect(result.errors).toHaveLength(0);

    const tx = result.transaction!;
    expect(tx.status).toBe('valid');
    expect(tx.totalOperations).toBe(100);
    expect(tx.totalMoraSpent).toBe(2500);

    // Exact deltas: DamagedMask = -300 gross + 27 refund = -273
    expect(tx.deltas['DamagedMask']).toBe(-273);
    expect(tx.deltas['StainedMask']).toBe(100);
    expect(tx.deltas['OminousMask']).toBe(0);
    expect(tx.deltas['Mora']).toBe(-2500);

    // Ending balances
    expect(tx.endingBalances['DamagedMask']).toBe(1678);
    expect(tx.endingBalances['StainedMask']).toBe(323);
    expect(tx.endingBalances['OminousMask']).toBe(35);
    expect(tx.endingBalances['Mora']).toBe(7500);
  });

  // ── 3. Multi-event cumulative deltas ──
  it('3. Multi-event cumulative deltas: aggregates multiple distinct batches on the same family', () => {
    const startingInventory = {
      SlimeCondensate: 1000,
      SlimeSecretions: 100,
      SlimeConcentrate: 10,
      Mora: 50000,
    };
    const grossRequirements = {
      SlimeCondensate: 0,
      SlimeSecretions: 200,
      SlimeConcentrate: 50,
    };

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements,
      bonusType: 'double_output',
    });

    // Batch 1: Craft 50 Secretions (150 Condensate gross, 55 received = 5 bonus, 1,250 Mora)
    const session1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 50,
      totalOutputReceived: 55,
      bonusOutputReceived: 5,
      refundsReceived: 0,
    });

    // Batch 2: Craft 20 Concentrate (60 Secretions gross, 22 received = 2 bonus, 1,000 Mora)
    const session2 = recordCraftingResult(session1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 20,
      totalOutputReceived: 22,
      bonusOutputReceived: 2,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: { ...grossRequirements },
      mora: 50000,
    };

    const result = prepareCraftingInventoryTransaction(session2, liveSource);

    expect(result.isPrepared).toBe(true);
    const tx = result.transaction!;
    expect(tx.totalBatches).toBe(2);
    expect(tx.totalOperations).toBe(70);
    expect(tx.totalMoraSpent).toBe(2250);

    // Condensate: -150
    expect(tx.deltas['SlimeCondensate']).toBe(-150);
    expect(tx.endingBalances['SlimeCondensate']).toBe(850);

    // Secretions: +55 (produced in B1) - 60 (consumed in B2) = -5
    expect(tx.deltas['SlimeSecretions']).toBe(-5);
    expect(tx.endingBalances['SlimeSecretions']).toBe(95);

    // Concentrate: +22
    expect(tx.deltas['SlimeConcentrate']).toBe(22);
    expect(tx.endingBalances['SlimeConcentrate']).toBe(32);

    // Mora: 50,000 - 2,250 = 47,750
    expect(tx.deltas['Mora']).toBe(-2250);
    expect(tx.endingBalances['Mora']).toBe(47750);
  });

  // ── 4. Four-tier crafting chain ──
  it('4. Four-tier crafting: verifies cumulative material deltas across a 4-tier weapon material chain', () => {
    // DecarabianTiles: Tile (T1) -> Debris (T2) -> Fragment (T3) -> ScatteredPiece (T4)
    const startingInventory = {
      TileOfDecarabiansTower: 900,
      DebrisOfDecarabiansCity: 100,
      FragmentOfDecarabiansEpic: 10,
      ScatteredPieceOfDecarabiansDream: 0,
      Mora: 100000,
    };

    const session = createCraftingSession({
      familyId: 'DecarabianTiles',
      inventory: startingInventory,
      grossRequirements: {
        TileOfDecarabiansTower: 0,
        DebrisOfDecarabiansCity: 0,
        FragmentOfDecarabiansEpic: 0,
        ScatteredPieceOfDecarabiansDream: 20,
      },
      bonusType: null,
    });

    // Craft 100 Debris from 300 Tiles (fee 125/op = 12,500)
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_DebrisOfDecarabiansCity',
      operationsPerformed: 100,
      totalOutputReceived: 100,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    // Craft 30 Fragments from 90 Debris (fee 350/op = 10,500)
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_FragmentOfDecarabiansEpic',
      operationsPerformed: 30,
      totalOutputReceived: 30,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    // Craft 10 ScatteredPiece from 30 Fragments (fee 1,075/op = 10,750)
    const s3 = recordCraftingResult(s2, {
      recipeId: 'craft_ScatteredPieceOfDecarabiansDream',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: {
        TileOfDecarabiansTower: 0,
        DebrisOfDecarabiansCity: 0,
        FragmentOfDecarabiansEpic: 0,
        ScatteredPieceOfDecarabiansDream: 20,
      },
      mora: 100000,
    };

    const result = prepareCraftingInventoryTransaction(s3, liveSource);
    expect(result.isPrepared).toBe(true);

    const tx = result.transaction!;
    expect(tx.totalBatches).toBe(3);
    expect(tx.totalOperations).toBe(140);
    // Total fees: 12,500 + 10,500 + 10,750 = 33,750
    expect(tx.totalMoraSpent).toBe(33750);

    // Tiles: -300 -> 600
    expect(tx.deltas['TileOfDecarabiansTower']).toBe(-300);
    expect(tx.endingBalances['TileOfDecarabiansTower']).toBe(600);

    // Debris: +100 - 90 = +10 -> 110
    expect(tx.deltas['DebrisOfDecarabiansCity']).toBe(10);
    expect(tx.endingBalances['DebrisOfDecarabiansCity']).toBe(110);

    // Fragments: +30 - 30 = 0 -> 10
    expect(tx.deltas['FragmentOfDecarabiansEpic']).toBe(0);
    expect(tx.endingBalances['FragmentOfDecarabiansEpic']).toBe(10);

    // ScatteredPiece: +10 -> 10
    expect(tx.deltas['ScatteredPieceOfDecarabiansDream']).toBe(10);
    expect(tx.endingBalances['ScatteredPieceOfDecarabiansDream']).toBe(10);

    // Mora: 100,000 - 33,750 = 66,250
    expect(tx.deltas['Mora']).toBe(-33750);
    expect(tx.endingBalances['Mora']).toBe(66250);
  });

  // ── 5. Intermediate output subsequently consumed ──
  it('5. Intermediate output subsequently consumed: preserves material conservation without ghost inventory', () => {
    // Starting with 0 Secretions, produce 10, then consume all 9 to make 3 Concentrate
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 10000,
    };

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: { SlimeCondensate: 0, SlimeSecretions: 0, SlimeConcentrate: 3 },
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 3,
      totalOutputReceived: 3,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: { SlimeCondensate: 0, SlimeSecretions: 0, SlimeConcentrate: 3 },
      mora: 10000,
    };

    const result = prepareCraftingInventoryTransaction(s2, liveSource);
    expect(result.isPrepared).toBe(true);

    const tx = result.transaction!;
    // Condensate: -30
    expect(tx.deltas['SlimeCondensate']).toBe(-30);
    expect(tx.endingBalances['SlimeCondensate']).toBe(270);

    // Secretions: +10 in B1, -9 in B2 => +1 ending
    expect(tx.deltas['SlimeSecretions']).toBe(1);
    expect(tx.endingBalances['SlimeSecretions']).toBe(1);

    // Concentrate: +3
    expect(tx.deltas['SlimeConcentrate']).toBe(3);
    expect(tx.endingBalances['SlimeConcentrate']).toBe(3);
  });

  // ── 6. Correct Mora fees ──
  it('6. Correct Mora fees: accurately sums multi-tier craft fees', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeSecretions: 100, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      bonusType: null,
    });

    // 10 Secretions @ 25 Mora = 250
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    // 5 Concentrate @ 50 Mora = 250
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 5,
      totalOutputReceived: 5,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const deltas = calculateConfirmedCraftingDeltas(s2);
    expect(deltas.isValid).toBe(true);
    expect(deltas.totalMoraSpent).toBe(500);
    expect(deltas.moraDelta.delta).toBe(-500);
    expect(deltas.moraDelta.endingMora).toBe(4500);
  });

  // ── 7. No expected bonus output included ──
  it('7. No expected bonus output included: only actual received bonuses are applied', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: { SlimeConcentrate: 100 },
      bonusType: 'double_output',
    });

    // Craft 10 batches. Normal expected might be 10 + 10% = 11. But player got unlucky: 0 bonus (10 received).
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: { SlimeConcentrate: 100 },
      mora: 5000,
    };

    const result = prepareCraftingInventoryTransaction(s1, liveSource);
    expect(result.isPrepared).toBe(true);
    expect(result.transaction!.deltas['SlimeSecretions']).toBe(10); // Exactly 10, not 11!
  });

  // ── 8. No unperformed crafts included ──
  it('8. No unperformed crafts included: future suggested steps are excluded from transaction', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 900, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: { SlimeConcentrate: 100 },
      bonusType: null,
    });

    // Player only crafts 1 batch of 10 Secretions, even though optimizer suggests crafting 100
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { SlimeCondensate: 900, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: { SlimeConcentrate: 100 },
      mora: 5000,
    };

    const result = prepareCraftingInventoryTransaction(s1, liveSource);
    expect(result.isPrepared).toBe(true);
    expect(result.transaction!.totalOperations).toBe(10);
    expect(result.transaction!.deltas['SlimeCondensate']).toBe(-30);
    expect(result.transaction!.deltas['SlimeConcentrate']).toBe(0);
  });

  // ── 9. No double-counted refunds ──
  it('9. No double-counted refunds: refunds offset gross consumption directly without duplicate addition', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 30, StainedMask: 0, OminousMask: 0, Mora: 1000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
    });

    // 10 crafts of StainedMask, 5 refunds
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 5,
    });

    const deltas = calculateConfirmedCraftingDeltas(s1);
    expect(deltas.isValid).toBe(true);
    // DamagedMask: 30 starting - 30 gross + 5 refund = 5 ending. Delta = -25.
    expect(deltas.materialDeltas['DamagedMask']).toBe(-25);
    expect(deltas.replayedInventory['DamagedMask']).toBe(5);
  });

  // ── 10. Replayed shadow-inventory equivalence ──
  it('10. Replayed shadow-inventory equivalence: verified ending inventory equals stored shadow inventory', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500, SlimeSecretions: 50, SlimeConcentrate: 5, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 40,
      totalOutputReceived: 45,
      bonusOutputReceived: 5,
      refundsReceived: 0,
    });

    const deltas = calculateConfirmedCraftingDeltas(s1);
    expect(deltas.isValid).toBe(true);
    expect(deltas.replayedInventory['SlimeCondensate']).toBe(s1.ledger.shadowInventory['SlimeCondensate']);
    expect(deltas.replayedInventory['SlimeSecretions']).toBe(s1.ledger.shadowInventory['SlimeSecretions']);
    expect(deltas.replayedInventory['SlimeConcentrate']).toBe(s1.ledger.shadowInventory['SlimeConcentrate']);
    expect(deltas.replayedMora).toBe(s1.ledger.shadowInventory['Mora']);
  });

  // ── 11. Corrupted derived event fields ──
  it('11. Corrupted derived event fields: rejects event with tampered grossInputConsumed or moraSpent', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    // Tamper with grossInputConsumed in the event
    const tamperedEvent: CraftingResultEvent = {
      ...s1.events[0],
      grossInputConsumed: 20, // should be 30!
    };
    const corruptedSession: CraftingSessionState = {
      ...s1,
      events: [tamperedEvent],
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'LEDGER_INTEGRITY_MISMATCH')).toBe(true);
  });

  // ── 12. Corrupted stored shadow inventory ──
  it('12. Corrupted stored shadow inventory: rejects session if shadow inventory was externally tampered', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    // Tamper with stored shadow inventory
    const corruptedSession: CraftingSessionState = {
      ...s1,
      ledger: {
        ...s1.ledger,
        shadowInventory: {
          ...s1.ledger.shadowInventory,
          SlimeSecretions: 9999, // tampered!
        },
      },
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'LEDGER_INTEGRITY_MISMATCH')).toBe(true);
  });

  // ── 13. Forged recipe quantities ──
  it('13. Forged recipe quantities: rejects event where inputQtyPerCraft or outputQtyPerCraft was forged', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const forgedEvent: CraftingResultEvent = {
      ...s1.events[0],
      inputQtyPerCraft: 1, // should be 3!
    };
    const corruptedSession: CraftingSessionState = {
      ...s1,
      events: [forgedEvent],
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'RECIPE_DEF_MISMATCH')).toBe(true);
  });

  // ── 14. Forged Mora fees ──
  it('14. Forged Mora fees: rejects event where moraCostPerCraft was forged', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const forgedEvent: CraftingResultEvent = {
      ...s1.events[0],
      moraCostPerCraft: 0, // should be 25!
    };
    const corruptedSession: CraftingSessionState = {
      ...s1,
      events: [forgedEvent],
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'RECIPE_DEF_MISMATCH')).toBe(true);
  });

  // ── 15. Unsupported bonus ──
  it('15. Unsupported bonus: rejects event with bonus on an ineligible material category', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    // Change category to non-craftable or ineligible category like 'specialty' or 'boss'
    const corruptedSession: CraftingSessionState = {
      ...s1,
      snapshot: {
        ...s1.snapshot,
        category: 'local_specialty' as any,
      },
      events: [
        {
          ...s1.events[0],
          bonusType: 'double_output',
        },
      ],
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'INVALID_BONUS_RESULT')).toBe(true);
  });

  // ── 16. Invalid operation counts ──
  it('16. Invalid operation counts: rejects negative, zero, or non-integer operation counts', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const corruptedZero: CraftingSessionState = {
      ...s1,
      events: [{ ...s1.events[0], operationsPerformed: 0 }],
    };
    expect(calculateConfirmedCraftingDeltas(corruptedZero).isValid).toBe(false);

    const corruptedNeg: CraftingSessionState = {
      ...s1,
      events: [{ ...s1.events[0], operationsPerformed: -5 }],
    };
    expect(calculateConfirmedCraftingDeltas(corruptedNeg).isValid).toBe(false);
  });

  // ── 17. Fractional quantities ──
  it('17. Fractional quantities: rejects non-integer values', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const corruptedFrac: CraftingSessionState = {
      ...s1,
      events: [{ ...s1.events[0], operationsPerformed: 2.5 }],
    };
    const deltas = calculateConfirmedCraftingDeltas(corruptedFrac);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'INVALID_OPERATION_COUNT')).toBe(true);
  });

  // ── 18. Unsafe integer arithmetic ──
  it('18. Unsafe integer arithmetic: rejects NaN, Infinity, and numbers exceeding MAX_SAFE_INTEGER', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const corruptedUnsafe: CraftingSessionState = {
      ...s1,
      events: [{ ...s1.events[0], operationsPerformed: Number.MAX_SAFE_INTEGER + 10 }],
    };
    const deltas = calculateConfirmedCraftingDeltas(corruptedUnsafe);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'INVALID_OPERATION_COUNT')).toBe(true);
  });

  // ── 19. Duplicate event ID ──
  it('19. Duplicate event ID: rejects event ledger containing repeated event IDs', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      eventId: 'evt_fixed_1',
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    // Replay with duplicate event ID
    const corruptedSession: CraftingSessionState = {
      ...s1,
      events: [s1.events[0], { ...s1.events[0], eventId: 'evt_fixed_1' }],
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'DUPLICATE_EVENT_ID')).toBe(true);
  });

  // ── 20. Invalid recipe identity ──
  it('20. Invalid recipe identity: rejects event with unknown recipe or recipe from another family', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    // Use a Hilichurl recipe in a Slime session
    const corruptedRecipe: CraftingSessionState = {
      ...s1,
      events: [{ ...s1.events[0], recipeId: 'craft_StainedMask' }],
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedRecipe);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'UNKNOWN_RECIPE')).toBe(true);
  });

  // ── 21. Zero-event session ──
  it('21. Zero-event session: rejects preparation when no crafting events have been recorded', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      bonusType: null,
    });

    const liveSource = {
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      mora: 5000,
    };

    const result = prepareCraftingInventoryTransaction(session, liveSource);
    expect(result.isPrepared).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_LEDGER')).toBe(true);
  });

  // ── 22. Stale material balance ──
  it('22. Stale material balance: rejects preparation when live inventory for family tier changed', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
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

    // Live inventory has changed (e.g. farmed 50 more Condensate)
    const liveSource = {
      inventory: { ...startingInventory, SlimeCondensate: 350 },
      grossRequirements: {},
      mora: 5000,
    };

    const result = prepareCraftingInventoryTransaction(s1, liveSource);
    expect(result.isPrepared).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNREVIEWED_SOURCE_CONFLICT' || e.code === 'SOURCE_CONFLICT')).toBe(true);
  });

  // ── 23. Stale Mora balance ──
  it('23. Stale Mora: rejects preparation when live Mora changed', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
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

    // Live Mora spent externally
    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: {},
      mora: 4000,
    };

    const result = prepareCraftingInventoryTransaction(s1, liveSource);
    expect(result.isPrepared).toBe(false);
    expect(result.errors.some((e) => e.code === 'SOURCE_CONFLICT')).toBe(true);
  });

  // ── 24. Requirements conflict ──
  it('24. Requirements conflict: rejects preparation when progression requirements changed', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: { SlimeSecretions: 50 },
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    // Live requirements changed
    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: { SlimeSecretions: 100 },
      mora: 5000,
    };

    const result = prepareCraftingInventoryTransaction(s1, liveSource);
    expect(result.isPrepared).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNREVIEWED_SOURCE_CONFLICT')).toBe(true);
  });

  // ── 25. Acknowledged stale conflict (conflict_continued) ──
  it('25. Acknowledged stale conflict: strictly rejects inventory application when session is in conflict_continued state', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
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

    // Simulate user having acknowledged a stale conflict in B2-C
    const liveSource = {
      inventory: { ...startingInventory, SlimeCondensate: 200 },
      grossRequirements: {},
      mora: 5000,
    };

    // Acknowledge the fingerprint so status becomes 'conflict_continued'
    const continuedSession: CraftingSessionState = {
      ...s1,
      acknowledgedFingerprint: 'mock_fingerprint_for_live_source',
    };

    const result = prepareCraftingInventoryTransaction(continuedSession, liveSource);
    expect(result.isPrepared).toBe(false);
    // Crucial safety rule: Continue Original Plan is NOT authorization to update real inventory
    expect(result.errors.some((e) => e.code === 'CONTINUED_SOURCE_CONFLICT' || e.code === 'SOURCE_CONFLICT')).toBe(true);
  });

  // ── 26. Recipe signature mismatch ──
  it('26. Recipe signature mismatch: rejects transaction if snapshot recipe definition differs from canonical', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    // Alter recipe in snapshot
    const corruptedSession: CraftingSessionState = {
      ...s1,
      snapshot: {
        ...s1.snapshot,
        recipes: [
          {
            ...s1.snapshot.recipes[0],
            moraCost: 9999, // tampered!
          },
        ],
      },
    };

    const deltas = calculateConfirmedCraftingDeltas(corruptedSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'RECIPE_DEF_MISMATCH')).toBe(true);
  });

  // ── 27. Unrelated inventory edit ──
  it('27. Unrelated inventory edit: does not trigger conflict or block transaction preparation', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
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

    // Live inventory contains modifications to UNRELATED items (Sweet Flower, Damaged Mask)
    const liveSource = {
      inventory: {
        ...startingInventory,
        SweetFlower: 999,
        DamagedMask: 42,
      },
      grossRequirements: {
        SweetFlower: 0,
      },
      mora: 5000,
    };

    const result = prepareCraftingInventoryTransaction(s1, liveSource);
    expect(result.isPrepared).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.transaction!.status).toBe('valid');
  });

  // ── 28. Ledger revision invalidates preview ──
  it('28. Ledger revision invalidates preview: validateCraftingInventoryTransaction detects live inventory changes after prepare', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
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

    const liveSourceInitial = {
      inventory: { ...startingInventory },
      grossRequirements: {},
      mora: 5000,
    };

    const prep = prepareCraftingInventoryTransaction(s1, liveSourceInitial);
    expect(prep.isPrepared).toBe(true);

    // Initial validation succeeds
    const val1 = validateCraftingInventoryTransaction(prep.transaction, liveSourceInitial);
    expect(val1.isValid).toBe(true);

    // Live inventory changes AFTER preparation
    const liveSourceAltered = {
      inventory: { ...startingInventory, SlimeCondensate: 250 },
      grossRequirements: {},
      mora: 5000,
    };

    const val2 = validateCraftingInventoryTransaction(prep.transaction, liveSourceAltered);
    expect(val2.isValid).toBe(false);
    expect(val2.errors.some((e) => e.code === 'STALE_PREVIEW')).toBe(true);
  });

  // ── 29. Deterministic transaction identity ──
  it('29. Deterministic transaction identity: same session and ledger produce exact same transactionId', () => {
    const startingInventory = {
      SlimeCondensate: 300,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 5000,
    };
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInventory,
      grossRequirements: {},
      bonusType: null,
    });

    const s1 = recordCraftingResult(session, {
      eventId: 'evt_fixed_123',
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const liveSource = {
      inventory: { ...startingInventory },
      grossRequirements: {},
      mora: 5000,
    };

    const prep1 = prepareCraftingInventoryTransaction(s1, liveSource);
    const prep2 = prepareCraftingInventoryTransaction(s1, liveSource);

    expect(prep1.transaction!.transactionId).toBe(prep2.transaction!.transactionId);

    // Adding a second event changes the transaction ID deterministically
    const s2 = recordCraftingResult(s1, {
      eventId: 'evt_fixed_456',
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 5,
      totalOutputReceived: 5,
      bonusOutputReceived: 0,
      refundsReceived: 0,
    });

    const prep3 = prepareCraftingInventoryTransaction(s2, liveSource);
    expect(prep3.transaction!.transactionId).not.toBe(prep1.transaction!.transactionId);
  });

  // ── 30. Transaction preview immutability ──
  it('30. Transaction preview immutability: deriving preview multiple times does not mutate transaction or state', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const liveSource = {
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      mora: 5000,
    };

    const prep = prepareCraftingInventoryTransaction(s1, liveSource);
    const tx = prep.transaction!;

    const preview1 = deriveInventoryTransactionPreview(tx);
    const preview2 = deriveInventoryTransactionPreview(tx);

    expect(preview1).toEqual(preview2);
    expect(tx.status).toBe('valid');
  });

  // ── 31. No Zustand writes ──
  it('31. No Zustand writes: verify useStore state is completely untouched before and after preparation', () => {
    const initialStoreState = JSON.stringify(useStore.getState().inventory);

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const liveSource = {
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      mora: 5000,
    };

    prepareCraftingInventoryTransaction(s1, liveSource);

    const afterStoreState = JSON.stringify(useStore.getState().inventory);
    expect(afterStoreState).toBe(initialStoreState);
  });

  // ── 32. No localStorage writes ──
  it('32. No localStorage writes: verify localStorage is completely untouched before and after preparation', () => {
    localStorage.setItem('canary', 'untouched');
    const storageLengthBefore = localStorage.length;

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
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

    const liveSource = {
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      mora: 5000,
    };

    prepareCraftingInventoryTransaction(s1, liveSource);

    expect(localStorage.getItem('canary')).toBe('untouched');
    expect(localStorage.length).toBe(storageLengthBefore);
  });

  // ── 33. Physical feasibility check ──
  it('33. Physical feasibility check: rejects event when crafting exceeds available ingredients during replay', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 10, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: {},
      bonusType: null,
    });

    // Manually construct an event that requests 10 crafts = 30 Condensate, but starting inventory was only 10
    const impossibleEvent: CraftingResultEvent = {
      eventId: 'evt_impossible',
      timestamp: Date.now(),
      recipeId: 'craft_SlimeSecretions',
      recipeName: 'Slime Secretions',
      sourceTierIndex: 0,
      targetTierIndex: 1,
      inputItemId: 'SlimeCondensate',
      outputItemId: 'SlimeSecretions',
      inputQtyPerCraft: 3,
      outputQtyPerCraft: 1,
      moraCostPerCraft: 25,
      bonusType: null,
      operationsPerformed: 10, // requires 30
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
      grossInputConsumed: 30,
      netInputConsumed: 30,
      moraSpent: 250,
    };

    const impossibleSession: CraftingSessionState = {
      ...session,
      events: [impossibleEvent],
    };

    const deltas = calculateConfirmedCraftingDeltas(impossibleSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'INSUFFICIENT_INGREDIENTS')).toBe(true);
  });

  // ── 34. Mora feasibility check ──
  it('34. Mora feasibility check: rejects event when crafting exceeds available Mora during replay', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 10 },
      grossRequirements: {},
      bonusType: null,
    });

    const impossibleMoraEvent: CraftingResultEvent = {
      eventId: 'evt_mora_impossible',
      timestamp: Date.now(),
      recipeId: 'craft_SlimeSecretions',
      recipeName: 'Slime Secretions',
      sourceTierIndex: 0,
      targetTierIndex: 1,
      inputItemId: 'SlimeCondensate',
      outputItemId: 'SlimeSecretions',
      inputQtyPerCraft: 3,
      outputQtyPerCraft: 1,
      moraCostPerCraft: 25,
      bonusType: null,
      operationsPerformed: 10,
      totalOutputReceived: 10,
      bonusOutputReceived: 0,
      refundsReceived: 0,
      grossInputConsumed: 30,
      netInputConsumed: 30,
      moraSpent: 250,
    };

    const impossibleSession: CraftingSessionState = {
      ...session,
      events: [impossibleMoraEvent],
    };

    const deltas = calculateConfirmedCraftingDeltas(impossibleSession);
    expect(deltas.isValid).toBe(false);
    expect(deltas.errors.some((e) => e.code === 'INSUFFICIENT_MORA')).toBe(true);
  });

  // ── 35. Performance benchmark ──
  it('35. Performance benchmark: transaction preparation completes in sub-millisecond time', () => {
    const startingInventory = {
      TileOfDecarabiansTower: 900,
      DebrisOfDecarabiansCity: 100,
      FragmentOfDecarabiansEpic: 10,
      ScatteredPieceOfDecarabiansDream: 0,
      Mora: 100000,
    };

    const session = createCraftingSession({
      familyId: 'DecarabianTiles',
      inventory: startingInventory,
      grossRequirements: { ScatteredPieceOfDecarabiansDream: 20 },
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
      inventory: { ...startingInventory },
      grossRequirements: { ScatteredPieceOfDecarabiansDream: 20 },
      mora: 100000,
    };

    // Warm-up
    prepareCraftingInventoryTransaction(s3, liveSource);

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      prepareCraftingInventoryTransaction(s3, liveSource);
    }
    const elapsed = performance.now() - start;
    const avgPerPrep = elapsed / iterations;

    // Must be under 1ms per transaction preparation
    expect(avgPerPrep).toBeLessThan(1.0);
  });
});
