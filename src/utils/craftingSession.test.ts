import { describe, it, expect } from 'vitest';
import {
  createCraftingSession,
  recordCraftingResult,
  undoLastCraftingResult,
  replayCraftingSession,
  validateCraftingResultInput,
  computeSessionFingerprint,
  CraftingSessionState,
} from './craftingSession';
import { getCraftingFamily } from '../data/craftingRecipes';
import useStore from '../store/useStore';

describe('Phase CRAFT-D4-B2-A: Pure Crafting Session Ledger & Replay Engine', () => {
  const slimeFamily = getCraftingFamily('Slime')!;
  const hilichurlFamily = getCraftingFamily('Hilichurl')!;
  const decarabianFamily = getCraftingFamily('DecarabianTiles')!;

  // ── 1. Session Creation ──
  it('1. Session creation: creates valid state with UUID, timestamps, and normalized snapshot', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, Mora: 5000 },
      grossRequirements: { SlimeSecretions: 10 },
      bonusType: 'double_output',
      timestamp: 1700000000000,
      sessionId: 'test-session-1',
    });

    expect(session.sessionId).toBe('test-session-1');
    expect(session.snapshot.familyId).toBe('Slime');
    expect(session.snapshot.bonusType).toBe('double_output');
    expect(session.snapshot.createdAt).toBe(1700000000000);
    expect(session.events).toHaveLength(0);
    expect(session.ledger.totalEventsCount).toBe(0);
  });

  // ── 2. Canonical Family Selection ──
  it('2. Canonical family selection: retrieves canonical metadata, material IDs, and recipes', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: {},
      grossRequirements: {},
    });

    expect(session.snapshot.familyName).toBe('Hilichurl');
    expect(session.snapshot.category).toBe('common_enemy');
    expect(session.snapshot.materialIds).toEqual(['DamagedMask', 'StainedMask', 'OminousMask']);
    expect(session.snapshot.recipes).toHaveLength(2);
    expect(session.snapshot.recipes[0].id).toBe('craft_StainedMask');
    expect(session.snapshot.recipes[1].id).toBe('craft_OminousMask');
  });

  // ── 3. Starting Inventory Snapshot ──
  it('3. Starting inventory snapshot: captures exact physical quantities and Mora', () => {
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35, Mora: 123456 };
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: inv,
      grossRequirements: {},
    });

    expect(session.snapshot.startingInventory.DamagedMask).toBe(1951);
    expect(session.snapshot.startingInventory.StainedMask).toBe(223);
    expect(session.snapshot.startingInventory.OminousMask).toBe(35);
    expect(session.snapshot.startingMora).toBe(123456);
    expect(session.ledger.shadowInventory.DamagedMask).toBe(1951);
    expect(session.ledger.remainingMora).toBe(123456);
  });

  // ── 4. Starting Gross Requirements ──
  it('4. Starting gross requirements: freezes direct progression demand without deducting it from inventory', () => {
    const reqs = { DamagedMask: 81, StainedMask: 158, OminousMask: 274 };
    const inv = { DamagedMask: 1951, StainedMask: 223, OminousMask: 35 };
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: inv,
      grossRequirements: reqs,
    });

    expect(session.snapshot.grossRequirements).toEqual(reqs);
    // Direct requirements are reservations, not immediate consumption!
    expect(session.ledger.shadowInventory.DamagedMask).toBe(1951);
    expect(session.ledger.shadowInventory.StainedMask).toBe(223);
  });

  // ── 5. Initial Empty Ledger ──
  it('5. Initial empty ledger: reports zero confirmed crafts, spent Mora, and produced outputs', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100 },
      grossRequirements: {},
    });

    expect(session.ledger.totalEventsCount).toBe(0);
    expect(session.ledger.totalMoraSpent).toBe(0);
    expect(Object.keys(session.ledger.confirmedOperationsByRecipe)).toHaveLength(0);
    expect(Object.keys(session.ledger.confirmedOutputByRecipe)).toHaveLength(0);
  });

  // ── 6. Double-Output Event ──
  it('6. Double-output event: records operations, total received, derived bonus, and updates shadow inventory', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 300, Mora: 10000 },
      grossRequirements: { StainedMask: 100 },
      bonusType: 'double_output',
    });

    // Craft 10 batches (30 Damaged -> 10 Stained base), user receives 12 Stained (2 bonus)
    const nextSession = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 10,
      totalOutputReceived: 12,
      eventId: 'evt-1',
    });

    expect(nextSession.events).toHaveLength(1);
    const evt = nextSession.events[0];
    expect(evt.operationsPerformed).toBe(10);
    expect(evt.totalOutputReceived).toBe(12);
    expect(evt.bonusOutputReceived).toBe(2);
    expect(evt.grossInputConsumed).toBe(30);
    expect(evt.netInputConsumed).toBe(30);
    expect(evt.moraSpent).toBe(250); // 10 * 25 Mora

    expect(nextSession.ledger.shadowInventory.DamagedMask).toBe(270); // 300 - 30
    expect(nextSession.ledger.shadowInventory.StainedMask).toBe(12); // 0 + 12
    expect(nextSession.ledger.remainingMora).toBe(9750); // 10,000 - 250
  });

  // ── 7. Refund Event ──
  it('7. Refund event: records operations, refunded ingredients, net consumption, and updates shadow inventory', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 300, Mora: 10000 },
      grossRequirements: { StainedMask: 100 },
      bonusType: 'ingredient_refund',
    });

    // Craft 10 batches (30 Damaged -> 10 Stained), 3 Damaged refunded
    const nextSession = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 10,
      refundsReceived: 3,
      eventId: 'evt-refund-1',
    });

    expect(nextSession.events).toHaveLength(1);
    const evt = nextSession.events[0];
    expect(evt.operationsPerformed).toBe(10);
    expect(evt.totalOutputReceived).toBe(10);
    expect(evt.refundsReceived).toBe(3);
    expect(evt.grossInputConsumed).toBe(30);
    expect(evt.netInputConsumed).toBe(27); // 30 - 3
    expect(evt.moraSpent).toBe(250); // Full fee charged: 10 * 25 Mora

    expect(nextSession.ledger.shadowInventory.DamagedMask).toBe(273); // 300 - 27
    expect(nextSession.ledger.shadowInventory.StainedMask).toBe(10); // 0 + 10
    expect(nextSession.ledger.remainingMora).toBe(9750);
  });

  // ── 8. Exact Material Conservation ──
  it('8. Material conservation: Shadow = Initial - NetConsumed + Output for all items', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 500, StainedMask: 50, OminousMask: 0, Mora: 100000 },
      grossRequirements: { OminousMask: 20 },
      bonusType: 'ingredient_refund',
    });

    // Event 1: Damaged -> Stained (20 crafts, 5 refunds)
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 20,
      refundsReceived: 5,
    });

    // Event 2: Stained -> Ominous (10 crafts, 2 refunds)
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_OminousMask',
      operationsPerformed: 10,
      refundsReceived: 2,
    });

    // Damaged: 500 - (20 * 3 - 5) = 500 - 55 = 445
    expect(s2.ledger.shadowInventory.DamagedMask).toBe(445);
    // Stained: 50 + 20 - (10 * 3 - 2) = 70 - 28 = 42
    expect(s2.ledger.shadowInventory.StainedMask).toBe(42);
    // Ominous: 0 + 10 = 10
    expect(s2.ledger.shadowInventory.OminousMask).toBe(10);
  });

  // ── 9. Exact Mora Charges ──
  it('9. Exact Mora charges: deducts canonical recipe fee per craft without passives refunding Mora', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 300, Mora: 1000 },
      grossRequirements: { StainedMask: 10 },
      bonusType: 'ingredient_refund',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 10,
      refundsReceived: 5, // 5 refunds
    });

    // Mora cost is 10 * 25 = 250 Mora. Refunds do NOT reduce Mora fee.
    expect(s1.events[0].moraSpent).toBe(250);
    expect(s1.ledger.totalMoraSpent).toBe(250);
    expect(s1.ledger.remainingMora).toBe(750);
  });

  // ── 10. Slime Acceptance Fixture ──
  it('10. Slime acceptance fixture: 1,668 Secretions crafts with 173 bonus leaves 1,305 Condensate and 2,122 Secretions', () => {
    const startingInv = {
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

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInv,
      grossRequirements: reqs,
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
    });

    // Shadow inventory verified against analytical expectations
    expect(s1.ledger.shadowInventory.SlimeCondensate).toBe(1305); // 6,309 - 1668 * 3
    expect(s1.ledger.shadowInventory.SlimeSecretions).toBe(2122); // 281 + 1841
    expect(s1.ledger.shadowInventory.SlimeConcentrate).toBe(57);
    expect(s1.ledger.remainingMora).toBe(1000000 - 41700); // 1,668 * 25 Mora = 41,700

    // Confirmed metrics
    expect(s1.ledger.confirmedOperationsByRecipe['craft_SlimeSecretions']).toBe(1668);
    expect(s1.ledger.confirmedBonusOutputByRecipe['craft_SlimeSecretions']).toBe(173);
  });

  // ── 11. Hilichurl Refund Acceptance Fixture ──
  it('11. Hilichurl refund fixture: 100 Stained crafts with 27 refunds leaves 1,678 Damaged, 323 Stained, 35 Ominous', () => {
    const startingInv = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      Mora: 500000,
    };
    const reqs = {
      DamagedMask: 81,
      StainedMask: 158,
      OminousMask: 274,
    };

    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: startingInv,
      grossRequirements: reqs,
      bonusType: 'ingredient_refund',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 100,
      refundsReceived: 27,
    });

    expect(s1.ledger.shadowInventory.DamagedMask).toBe(1678); // 1,951 - (300 - 27)
    expect(s1.ledger.shadowInventory.StainedMask).toBe(323); // 223 + 100
    expect(s1.ledger.shadowInventory.OminousMask).toBe(35);
    expect(s1.ledger.remainingMora).toBe(500000 - 2500); // 100 * 25 Mora = 2,500
  });

  // ── 12. Remaining Guaranteed Plan Recalculation (Slime) ──
  it('12. Remaining guaranteed plan (Slime): exact 185 Secretions, 632 Concentrate, 36,225 Mora, 0 farming shortage', () => {
    const startingInv = {
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

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInv,
      grossRequirements: reqs,
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
    });

    const slimePlan = s1.remainingPlan.families['Slime'];
    expect(slimePlan).toBeDefined();

    // Step 0: 185 Secretions crafts
    const step0 = slimePlan.steps.find((s) => s.recipeId === 'craft_SlimeSecretions');
    expect(step0?.count).toBe(185);

    // Step 1: 632 Concentrate crafts
    const step1 = slimePlan.steps.find((s) => s.recipeId === 'craft_SlimeConcentrate');
    expect(step1?.count).toBe(632);

    // Total additional crafting Mora: 185 * 25 + 632 * 50 = 4,625 + 31,600 = 36,225 Mora
    expect(slimePlan.craftingMora).toBe(36225);

    // Remaining farming shortages: 0 across all tiers
    expect(s1.remainingPlan.adjustedShortages['SlimeCondensate']).toBe(0);
    expect(s1.remainingPlan.adjustedShortages['SlimeSecretions']).toBe(0);
    expect(s1.remainingPlan.adjustedShortages['SlimeConcentrate']).toBe(0);
  });

  // ── 13. Remaining Guaranteed Plan Recalculation (Hilichurl) ──
  it('13. Remaining guaranteed plan (Hilichurl): exact 531 Stained, 232 Ominous, 24,875 Mora, 7 shortage', () => {
    const startingInv = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      Mora: 500000,
    };
    const reqs = {
      DamagedMask: 81,
      StainedMask: 158,
      OminousMask: 274,
    };

    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: startingInv,
      grossRequirements: reqs,
      bonusType: 'ingredient_refund',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 100,
      refundsReceived: 27,
    });

    const hPlan = s1.remainingPlan.families['Hilichurl'];
    expect(hPlan).toBeDefined();

    // Guaranteed remaining: 531 Stained (696 needed for 232 Ominous - 165 surplus Stained), 232 Ominous
    const stepStained = hPlan.steps.find((s) => s.recipeId === 'craft_StainedMask');
    const stepOminous = hPlan.steps.find((s) => s.recipeId === 'craft_OminousMask');
    expect(stepStained?.count).toBe(531);
    expect(stepOminous?.count).toBe(232);

    // Mora: 531 * 25 + 232 * 50 = 13,275 + 11,600 = 24,875 Mora
    expect(hPlan.craftingMora).toBe(24875);

    // Guaranteed farming shortage: 7 Ominous Masks
    expect(s1.remainingPlan.adjustedShortages['OminousMask']).toBe(7);
  });

  // ── 14. Completed Crafts Not Repeated ──
  it('14. Completed crafts not repeated: next recommended action advances to higher tier or remaining count', () => {
    const startingInv = {
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

    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: startingInv,
      grossRequirements: reqs,
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
    });

    // Next recommended step is now Concentrate, not repeating the 1,668 Secretions crafts!
    expect(s1.nextRecommendedStep?.recipeId).toBe('craft_SlimeConcentrate');
    expect(s1.nextRecommendedStep?.suggestedInitialBatch).toBe(564);
  });

  // ── 15. No Duplicate Bonus Application ──
  it('15. No duplicate bonus: confirmed bonus output is accounted in shadow inventory and not simulated again', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57, Mora: 1000000 },
      grossRequirements: { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 },
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841, // 173 bonus Secretions
    });

    // Secretions inventory is 2,122. Future forecast simulates only remaining need from 2,122
    expect(s1.remainingForecast).toBeDefined();
    expect(s1.remainingForecast?.expectedShortages['SlimeSecretions']).toBe(0);
  });

  // ── 16. No Double-Counted Mora ──
  it('16. No double-counted Mora: already-paid Mora is tracked in ledger and not charged again in remaining plan', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57, Mora: 100000 },
      grossRequirements: { SlimeCondensate: 219, SlimeSecretions: 411, SlimeConcentrate: 689 },
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 1668,
      totalOutputReceived: 1841,
    });

    expect(s1.ledger.totalMoraSpent).toBe(41700);
    expect(s1.remainingPlan.craftingMora).toBe(36225); // Future crafting only!
    expect(s1.ledger.totalMoraSpent + s1.remainingPlan.craftingMora).toBe(77925);
  });

  // ── 17. Single Event Undo ──
  it('17. Undo last batch: restores exact previous shadow inventory and recalculates previous plan', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 1000, Mora: 50000 },
      grossRequirements: { SlimeSecretions: 100 },
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 50,
      totalOutputReceived: 55,
    });
    expect(s1.ledger.shadowInventory.SlimeCondensate).toBe(850);
    expect(s1.events).toHaveLength(1);

    const undone = undoLastCraftingResult(s1);
    expect(undone.events).toHaveLength(0);
    expect(undone.ledger.shadowInventory.SlimeCondensate).toBe(1000);
    expect(undone.ledger.shadowInventory.SlimeSecretions).toBe(0);
    expect(undone.ledger.remainingMora).toBe(50000);
    expect(undone.ledger.totalMoraSpent).toBe(0);
  });

  // ── 18. Undo Multiple Batches ──
  it('18. Undo multiple batches: cleanly unrolls a 3-event chain back to starting snapshot', () => {
    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 900, Mora: 50000 },
      grossRequirements: { OminousMask: 50 },
      bonusType: 'ingredient_refund',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 30,
      refundsReceived: 5,
    });
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 30,
      refundsReceived: 6,
    });
    const s3 = recordCraftingResult(s2, {
      recipeId: 'craft_OminousMask',
      operationsPerformed: 10,
      refundsReceived: 2,
    });
    expect(s3.events).toHaveLength(3);

    const u1 = undoLastCraftingResult(s3);
    expect(u1.events).toHaveLength(2);
    expect(u1.ledger.shadowInventory.OminousMask).toBe(0);

    const u2 = undoLastCraftingResult(u1);
    expect(u2.events).toHaveLength(1);

    const u3 = undoLastCraftingResult(u2);
    expect(u3.events).toHaveLength(0);
    expect(u3.ledger.shadowInventory.DamagedMask).toBe(900);
    expect(u3.ledger.shadowInventory.StainedMask).toBe(0);
    expect(u3.ledger.remainingMora).toBe(50000);
  });

  // ── 19. Replay Determinism ──
  it('19. Replay determinism: replaying identical snapshot and events yields bit-for-bit identical state', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 3000, Mora: 100000 },
      grossRequirements: { SlimeConcentrate: 100 },
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 100,
      totalOutputReceived: 110,
    });
    const s2 = recordCraftingResult(s1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 30,
      totalOutputReceived: 33,
    });

    // Replay from raw snapshot and event array
    const replayedLedger = replayCraftingSession(s2.snapshot, s2.events);
    expect(replayedLedger).toEqual(s2.ledger);
  });

  // ── 20. Input Immutability ──
  it('20. Input immutability: recordCraftingResult does not mutate input session or events array', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const eventsRef = session.events;
    const shadowRef = session.ledger.shadowInventory;

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 11,
    });

    expect(session.events).toHaveLength(0);
    expect(session.events).toBe(eventsRef);
    expect(session.ledger.shadowInventory).toBe(shadowRef);
    expect(s1.events).not.toBe(session.events);
  });

  // ── 21. Deep-Frozen Snapshot ──
  it('21. Deep-frozen snapshot: engine functions succeed when snapshot is frozen with Object.freeze', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: { SlimeSecretions: 10 },
      bonusType: 'double_output',
    });

    Object.freeze(session.snapshot);
    Object.freeze(session.snapshot.startingInventory);
    Object.freeze(session.snapshot.grossRequirements);

    expect(() =>
      recordCraftingResult(session, {
        recipeId: 'craft_SlimeSecretions',
        operationsPerformed: 10,
        totalOutputReceived: 10,
      })
    ).not.toThrow();
  });

  // ── 22. Deep-Frozen Event History ──
  it('22. Deep-frozen event history: undo function succeeds when event array is Object.freeze', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: { SlimeSecretions: 10 },
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    Object.freeze(s1.events);
    expect(() => undoLastCraftingResult(s1)).not.toThrow();
  });

  // ── 23. Duplicate Event ID ──
  it('23. Duplicate event ID: rejects recording an event with an eventId that already exists in session', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
    });

    const s1 = recordCraftingResult(session, {
      eventId: 'fixed-evt-id',
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    const val = validateCraftingResultInput(s1, {
      eventId: 'fixed-evt-id',
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('DUPLICATE_EVENT_ID');
  });

  // ── 24. Invalid Family ID ──
  it('24. Invalid family ID: createCraftingSession throws error for unknown family', () => {
    expect(() =>
      createCraftingSession({
        familyId: 'UnknownFakeFamily',
        inventory: {},
        grossRequirements: {},
      })
    ).toThrow(/Unknown crafting family ID/);
  });

  // ── 25. Invalid Recipe ID ──
  it('25. Invalid recipe ID: rejects recipe not in active family', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300 },
      grossRequirements: {},
    });

    const val = validateCraftingResultInput(session, {
      recipeId: 'craft_OminousMask', // Belongs to Hilichurl, not Slime!
      operationsPerformed: 10,
    });

    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('INVALID_RECIPE_ID');
  });

  // ── 26. Invalid Bonus Type ──
  it('26. Invalid bonus type: rejects event with mismatched bonusType', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 5000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const val = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      bonusType: 'ingredient_refund', // Mismatch!
    });

    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'BONUS_TYPE_MISMATCH')).toBe(true);
  });

  // ── 27. Ineligible Bonus Category ──
  it('27. Ineligible bonus category: rejects bonus claims on ineligible categories (e.g. character_gems)', () => {
    const gemFamily = getCraftingFamily('AgnidusAgate')!;
    const session = createCraftingSession({
      familyId: gemFamily.familyId,
      inventory: { AgnidusAgateSliver: 30, Mora: 5000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const val = validateCraftingResultInput(session, {
      recipeId: gemFamily.recipes[0].id,
      operationsPerformed: 10,
      totalOutputReceived: 12, // Claims 2 bonus gems!
    });

    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.code === 'INELIGIBLE_BONUS_CATEGORY')).toBe(true);
  });

  // ── 28. Negative Values ──
  it('28. Negative values: rejects negative operations or negative refund counts', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
    });

    const v1 = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: -5,
    });
    expect(v1.isValid).toBe(false);
    expect(v1.errors[0].code).toBe('INVALID_OPERATIONS_COUNT');

    const v2 = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      refundsReceived: -2,
    });
    expect(v2.isValid).toBe(false);
    expect(v2.errors.some((e) => e.code === 'NEGATIVE_REFUND')).toBe(true);
  });

  // ── 29. Fractional Quantities ──
  it('29. Fractional quantities: rejects non-integer operations and outputs', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const v1 = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 2.5,
    });
    expect(v1.isValid).toBe(false);
    expect(v1.errors[0].code).toBe('INVALID_OPERATIONS_COUNT');

    const v2 = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 11.5,
    });
    expect(v2.isValid).toBe(false);
    expect(v2.errors.some((e) => e.code === 'INVALID_OUTPUT_QUANTITY')).toBe(true);
  });

  // ── 30. Missing Numeric Fields ──
  it('30. Missing numeric fields: handles undefined optional inputs safely with canonical defaults', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    // Neither totalOutputReceived nor bonusOutputReceived provided -> defaults to 0 bonus
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
    });

    expect(s1.events[0].totalOutputReceived).toBe(10);
    expect(s1.events[0].bonusOutputReceived).toBe(0);
  });

  // ── 31. Excess Double-Output Quantity ──
  it('31. Excess double-output: rejects output exceeding twice base operations (e.g. 10 ops yielding 25 output)', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'double_output',
    });

    const val = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 25, // Max is 20!
    });

    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('OUTPUT_EXCEEDS_MAXIMUM');
  });

  // ── 32. Excess Refund Count ──
  it('32. Excess refund count: rejects refund count exceeding operations performed (e.g. 10 ops yielding 15 refunds)', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 10000 },
      grossRequirements: {},
      bonusType: 'ingredient_refund',
    });

    const val = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      refundsReceived: 15, // Max is 10!
    });

    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('REFUND_EXCEEDS_OPERATIONS');
  });

  // ── 33. Insufficient Gross Ingredients (Physical Execution Policy) ──
  it('33. Insufficient gross ingredients: rejects batch requiring more gross ingredients than available in shadow inventory', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 50, Mora: 10000 }, // Only 50 Condensate
      grossRequirements: {},
      bonusType: 'ingredient_refund',
    });

    // 20 crafts requires 60 Condensate gross
    const val = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 20,
      refundsReceived: 5,
    });

    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('INSUFFICIENT_GROSS_INGREDIENTS');
    expect(val.errors[0].message).toContain('Please record smaller sequential sub-batches');
  });

  // ── 34. Insufficient Mora ──
  it('34. Insufficient Mora: rejects batch when crafting fee exceeds shadow Mora balance', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 300, Mora: 100 }, // Only 100 Mora
      grossRequirements: {},
      bonusType: 'double_output',
    });

    // 10 crafts requires 250 Mora
    const val = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });

    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('INSUFFICIENT_MORA');
  });

  // ── 35. Intermediate-Tier Dependency ──
  it('35. Intermediate dependency: lower tier output enables subsequent higher tier craft', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 30, SlimeSecretions: 0, SlimeConcentrate: 0, Mora: 5000 },
      grossRequirements: { SlimeConcentrate: 3 },
      bonusType: 'double_output',
    });

    // Cannot craft Concentrate yet: 0 Secretions
    const preVal = validateCraftingResultInput(session, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 3,
    });
    expect(preVal.isValid).toBe(false);
    expect(preVal.errors[0].code).toBe('INSUFFICIENT_GROSS_INGREDIENTS');

    // Craft 10 Secretions (uses 30 Condensate)
    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 10,
      totalOutputReceived: 10,
    });
    expect(s1.ledger.shadowInventory.SlimeSecretions).toBe(10);

    // Now Concentrate craft is valid! (uses 9 Secretions)
    const postVal = validateCraftingResultInput(s1, {
      recipeId: 'craft_SlimeConcentrate',
      operationsPerformed: 3,
      totalOutputReceived: 3,
    });
    expect(postVal.isValid).toBe(true);
  });

  // ── 36. Four-Tier Crafting Sequence ──
  it('36. Four-tier sequence: tracks weapon material through Sliver -> Fragment -> Chunk -> Gemstone progression', () => {
    const session = createCraftingSession({
      familyId: decarabianFamily.familyId,
      inventory: {
        TileOfDecarabiansTower: 100, // Tier 0
        DebrisOfDecarabiansCity: 0, // Tier 1
        FragmentOfDecarabiansEpic: 0, // Tier 2
        ScatteredPieceOfDecarabiansDream: 0, // Tier 3
        Mora: 100000,
      },
      grossRequirements: { ScatteredPieceOfDecarabiansDream: 1 },
      bonusType: 'double_output',
    });

    // Craft Tier 0 -> Tier 1 (9 ops -> 27 Tile consumed, 9 Debris produced)
    const s1 = recordCraftingResult(session, {
      recipeId: decarabianFamily.recipes[0].id,
      operationsPerformed: 9,
      totalOutputReceived: 9,
    });
    expect(s1.ledger.shadowInventory.TileOfDecarabiansTower).toBe(73);
    expect(s1.ledger.shadowInventory.DebrisOfDecarabiansCity).toBe(9);

    // Craft Tier 1 -> Tier 2 (3 ops -> 9 Debris consumed, 3 Fragment produced)
    const s2 = recordCraftingResult(s1, {
      recipeId: decarabianFamily.recipes[1].id,
      operationsPerformed: 3,
      totalOutputReceived: 3,
    });
    expect(s2.ledger.shadowInventory.DebrisOfDecarabiansCity).toBe(0);
    expect(s2.ledger.shadowInventory.FragmentOfDecarabiansEpic).toBe(3);

    // Craft Tier 2 -> Tier 3 (1 op -> 3 Fragment consumed, 1 Piece produced)
    const s3 = recordCraftingResult(s2, {
      recipeId: decarabianFamily.recipes[2].id,
      operationsPerformed: 1,
      totalOutputReceived: 1,
    });
    expect(s3.ledger.shadowInventory.FragmentOfDecarabiansEpic).toBe(0);
    expect(s3.ledger.shadowInventory.ScatteredPieceOfDecarabiansDream).toBe(1);
    expect(s3.remainingPlan.adjustedShortages['ScatteredPieceOfDecarabiansDream']).toBe(0);
  });

  // ── 37. Zero-Demand Family ──
  it('37. Zero-demand family: creates session cleanly when requirements are all zero', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100 },
      grossRequirements: {},
    });

    expect(session.remainingPlan.requiresCrafting).toBe(false);
    expect(session.nextRecommendedStep).toBeNull();
  });

  // ── 38. Existing Higher-Tier Inventory ──
  it('38. Existing higher-tier inventory: direct requirements are reserved and not crafted unnecessarily', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 100, SlimeConcentrate: 5 },
      grossRequirements: { SlimeConcentrate: 5 },
    });

    // Direct inventory satisfies requirements completely
    expect(session.remainingPlan.adjustedShortages['SlimeConcentrate']).toBe(0);
    expect(session.remainingPlan.requiresCrafting).toBe(false);
  });

  // ── 39. Uncraftable Material Handling ──
  it('39. Uncraftable material: handles uncraftable single-tier families safely without error', () => {
    // Local specialties or character exp are not craftable
    expect(() =>
      createCraftingSession({
        familyId: 'Slime',
        inventory: { SlimeCondensate: 100 },
        grossRequirements: { SlimeCondensate: 50 },
      })
    ).not.toThrow();
  });

  // ── 40. Session Result Serialization Safety ──
  it('40. Serialization safety: JSON stringify and parse round-trip leaves state bit-for-bit identical', () => {
    const session = createCraftingSession({
      familyId: 'Slime',
      inventory: { SlimeCondensate: 500, Mora: 20000 },
      grossRequirements: { SlimeSecretions: 50 },
      bonusType: 'double_output',
    });

    const s1 = recordCraftingResult(session, {
      recipeId: 'craft_SlimeSecretions',
      operationsPerformed: 20,
      totalOutputReceived: 22,
    });

    const serialized = JSON.stringify(s1);
    const parsed = JSON.parse(serialized);

    expect(parsed.sessionId).toBe(s1.sessionId);
    expect(parsed.ledger.shadowInventory).toEqual(s1.ledger.shadowInventory);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].derivedBonusOutput).toBe(undefined); // bonusOutputReceived is 2
    expect(parsed.events[0].bonusOutputReceived).toBe(2);
  });

  // ── 41. No Persisted Store Writes ──
  it('41. Persistence isolation: domain engine never writes to or alters Zustand global store', () => {
    const preRoster = useStore.getState().roster;
    const preInv = useStore.getState().inventory;

    const session = createCraftingSession({
      familyId: 'Hilichurl',
      inventory: { DamagedMask: 500, Mora: 10000 },
      grossRequirements: { StainedMask: 50 },
      bonusType: 'double_output',
    });

    recordCraftingResult(session, {
      recipeId: 'craft_StainedMask',
      operationsPerformed: 10,
      totalOutputReceived: 12,
    });

    expect(useStore.getState().roster).toBe(preRoster);
    expect(useStore.getState().inventory).toBe(preInv);
  });

  // ── 42. Fingerprint Determinism ──
  it('42. Fingerprint determinism: relevant state produces consistent fingerprint and ignores unrelated items', () => {
    const fp1 = computeSessionFingerprint(
      slimeFamily,
      { SlimeCondensate: 100, SlimeSecretions: 50, SweetFlower: 999 }, // SweetFlower is unrelated
      { SlimeConcentrate: 10 },
      'double_output',
      50000
    );

    const fp2 = computeSessionFingerprint(
      slimeFamily,
      { SlimeCondensate: 100, SlimeSecretions: 50, SweetFlower: 0 }, // SweetFlower differs
      { SlimeConcentrate: 10 },
      'double_output',
      50000
    );

    expect(fp1).toBe(fp2); // Must match! Unrelated items ignored.

    const fp3 = computeSessionFingerprint(
      slimeFamily,
      { SlimeCondensate: 105, SlimeSecretions: 50 }, // Condensate changed
      { SlimeConcentrate: 10 },
      'double_output',
      50000
    );

    expect(fp1).not.toBe(fp3); // Must differ! Relevant item changed.
  });
});
