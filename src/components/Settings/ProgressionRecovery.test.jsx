import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProgressionDataHealth from './ProgressionDataHealth';
import ProgressionRepairModal from './ProgressionRepairModal';
import useStore from '../../store/useStore';
import {
  createPreRepairBackup,
  validateBackupCompatibility,
  getProgressionRepairOptions,
  validateRepairProposal,
  validateRepairBatch,
  executeRepairTransaction,
} from '../../utils/progressionRecovery';
import { normalizeBackupForImport } from '../../utils/backupUtils';
import {
  diagnoseProgressionState,
  validateLevelAscension,
} from '../../utils/progressionContracts';
import { calculateProgressionCost, calculateWeaponCost } from '../../utils/calculator';
import { STORE_NAME } from '../../store/persistence';
import { aggregateRosterCosts } from '../../utils/aggregator';

describe('Phase C2B.2B.2 — Controlled Legacy Progression Recovery', () => {
  beforeEach(() => {
    useStore.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
      serverRegion: 'NA',
      showDbBuilder: false,
      displayTimeZone: 'auto',
      achievementProgress: {},
    });
  });

  // 1. Backup creation and validation
  it('Scenario 1: Creates complete pre-repair backup and verifies restore compatibility', () => {
    const testState = {
      roster: {
        'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
      },
      trackedWeapons: [
        { id: 'w-1', weaponName: 'Favonius Sword', level: 20, ascension: 3, targetLevel: 90, targetAscension: 6 },
      ],
      inventory: { Mora: 50000 },
      serverRegion: 'NA',
      showDbBuilder: true,
      displayTimeZone: 'America/New_York',
      achievementProgress: {},
    };

    const backup = createPreRepairBackup(testState);
    expect(backup.isValid).toBe(true);
    expect(backup.schemaVersion).toBe(1);
    expect(backup.appId).toBe('travelers-toolkit');
    expect(typeof backup.jsonString).toBe('string');

    // Compatibility validation
    const compat = validateBackupCompatibility(backup.payload);
    expect(compat.isValid).toBe(true);
    expect(compat.error).toBeNull();
  });

  // 2. Backup failure blocking repairs
  it('Scenario 2: Blocks repair execution if pre-repair backup has not been validated and confirmed', () => {
    const invalidRepair = {
      id: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };

    const result = executeRepairTransaction({
      repairs: [invalidRepair],
      getState: () => ({
        roster: { 'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 } },
        trackedWeapons: [],
      }),
      setState: vi.fn(),
      backupValidated: false, // NOT validated!
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/backup.*mandatory|validated/i);
    expect(result.rollbackApplied).toBe(false);
  });

  // 3. Cancellation without mutation
  it('Scenario 3: Canceling repair modal closes preview without modifying any stored data', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    const onCloseSpy = vi.fn();
    render(
      <ProgressionRepairModal
        isOpen={true}
        selectedRepairs={[
          {
            id: 'Kuki Shinobu',
            name: 'Kuki Shinobu',
            type: 'character',
            proposedLevel: 1,
            proposedAscension: 0,
            proposedTargetLevel: 90,
            proposedTargetAscension: 6,
            originalRecord: initialRoster['Kuki Shinobu'],
          },
        ]}
        onClose={onCloseSpy}
      />
    );

    // Cancel on backup step
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onCloseSpy).toHaveBeenCalled();

    // Verify store was not touched
    const stored = useStore.getState().roster['Kuki Shinobu'];
    expect(stored.level).toBe(1);
    expect(stored.ascension).toBe(6);
  });

  // 4. Invalid proposal rejection
  it('Scenario 4: Rejects invalid progression proposals before touching store', () => {
    const invalidProposal = {
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 6, // Incompatible!
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
    };

    const val = validateRepairProposal(invalidProposal);
    expect(val.isValid).toBe(false);
    expect(val.error).toMatch(/invalid for level 1/i);

    const batchVal = validateRepairBatch(
      [
        {
          id: 'TestChar',
          type: 'character',
          ...invalidProposal,
          originalRecord: { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
        },
      ],
      {
        roster: { TestChar: { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 } },
        trackedWeapons: [],
      }
    );
    expect(batchVal.isValid).toBe(false);
    expect(batchVal.isInvalidProposal).toBe(true);
  });

  // 5. Ambiguous repair requiring a user choice
  it('Scenario 5: Ambiguous milestone records require an explicit user choice before enabling repair', () => {
    const ambiguousRecord = {
      id: 'Sayu',
      name: 'Sayu',
      type: 'character',
      currentLevel: 20,
      currentAscension: 3,
      targetLevel: 90,
      targetAscension: 6,
      entry: { level: 20, ascension: 3, targetLevel: 90, targetAscension: 6 },
      isAmbiguous: true,
      issues: [{ reason: 'Ascension 3 is invalid for level 20' }],
    };

    const options = getProgressionRepairOptions(ambiguousRecord);
    expect(options.length).toBeGreaterThan(1);
    expect(options.some((o) => o.isAmbiguous)).toBe(true);

    // Check that candidates include both milestone ascensions 0 and 1
    expect(options.some((o) => o.proposedAscension === 0)).toBe(true);
    expect(options.some((o) => o.proposedAscension === 1)).toBe(true);
  });

  // 6. Valid milestone choice preservation
  it('Scenario 6: Preserves user-selected milestone choice (e.g., Level 20 Ascension 1)', () => {
    const sayuRecord = { level: 20, ascension: 3, targetLevel: 90, targetAscension: 6 };
    useStore.setState({
      roster: { Sayu: sayuRecord },
      trackedWeapons: [],
    });

    const chosenOption = {
      id: 'Sayu',
      name: 'Sayu',
      type: 'character',
      proposedLevel: 20,
      proposedAscension: 1, // User explicitly selected Ascension 1 (Ascended at 20)
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: sayuRecord,
    };

    const result = executeRepairTransaction({
      repairs: [chosenOption],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(true);
    const updated = useStore.getState().roster.Sayu;
    expect(updated.level).toBe(20);
    expect(updated.ascension).toBe(1); // Exactly preserved
  });

  // 7. Character correction
  it('Scenario 7: Corrects character progression, recalculates costs, and clears invalid diagnostic issue', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    const repair = {
      id: 'Kuki Shinobu',
      name: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: initialRoster['Kuki Shinobu'],
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(true);
    const updated = useStore.getState().roster['Kuki Shinobu'];
    expect(updated.level).toBe(1);
    expect(updated.ascension).toBe(0);
    expect(updated.calculatedCosts).toBeDefined();

    // Re-scan
    const diag = diagnoseProgressionState({ roster: useStore.getState().roster, trackedWeapons: [] });
    expect(diag.isValid).toBe(true);
    expect(diag.issuesCount).toBe(0);
  });

  // 8. Weapon correction
  it('Scenario 8: Corrects weapon progression, recalculates costs, and preserves UUID and assignment', () => {
    const initialWeapons = [
      {
        id: 'w-fav-uuid-999',
        weaponName: 'Favonius Sword',
        level: 20,
        ascension: 3,
        targetLevel: 90,
        targetAscension: 6,
        assignedTo: 'Jean',
        currentRefinement: 3,
        targetRefinement: 5,
        rarity: 4,
      },
    ];
    useStore.setState({ roster: {}, trackedWeapons: initialWeapons });

    const repair = {
      id: 'w-fav-uuid-999',
      name: 'Favonius Sword',
      type: 'weapon',
      proposedLevel: 20,
      proposedAscension: 1,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: initialWeapons[0],
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(true);
    const updated = useStore.getState().trackedWeapons[0];
    expect(updated.level).toBe(20);
    expect(updated.ascension).toBe(1);
    expect(updated.id).toBe('w-fav-uuid-999'); // UUID preserved
    expect(updated.assignedTo).toBe('Jean'); // AssignedTo preserved
    expect(updated.currentRefinement).toBe(3); // Refinement preserved
    expect(updated.calculatedCosts).toBeDefined();

    const diag = diagnoseProgressionState({ roster: {}, trackedWeapons: useStore.getState().trackedWeapons });
    expect(diag.isValid).toBe(true);
  });

  // 9. Multiple selected corrections
  it('Scenario 9: Applies multiple selected corrections atomically in a single batch', () => {
    useStore.setState({
      roster: {
        'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
      },
      trackedWeapons: [
        { id: 'w-1', weaponName: 'Favonius Sword', level: 20, ascension: 3, targetLevel: 90, targetAscension: 6, rarity: 4 },
      ],
    });

    const repairs = [
      {
        id: 'Kuki Shinobu',
        name: 'Kuki Shinobu',
        type: 'character',
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
        originalRecord: useStore.getState().roster['Kuki Shinobu'],
      },
      {
        id: 'w-1',
        name: 'Favonius Sword',
        type: 'weapon',
        proposedLevel: 20,
        proposedAscension: 1,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
        originalRecord: useStore.getState().trackedWeapons[0],
      },
    ];

    const result = executeRepairTransaction({
      repairs,
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(true);
    expect(result.repairedCount).toBe(2);

    const state = useStore.getState();
    expect(state.roster['Kuki Shinobu'].ascension).toBe(0);
    expect(state.trackedWeapons[0].ascension).toBe(1);
  });

  // 10. Stale preview detection
  it('Scenario 10: Detects stale preview and aborts transaction if records changed since preview generation', () => {
    const originalRecord = { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 };
    useStore.setState({
      roster: { 'Kuki Shinobu': originalRecord },
      trackedWeapons: [],
    });

    // Simulate an external change in the store after preview was created
    useStore.setState({
      roster: {
        'Kuki Shinobu': { level: 20, ascension: 1, targetLevel: 90, targetAscension: 6 },
      },
    });

    const staleRepair = {
      id: 'Kuki Shinobu',
      name: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord, // Old snapshot
    };

    const result = executeRepairTransaction({
      repairs: [staleRepair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.error).toMatch(/modified (since the preview was generated|by another browser tab)/i);

    // Stored record should not be modified
    expect(useStore.getState().roster['Kuki Shinobu'].level).toBe(20);
  });

  // 11. Duplicate weapon UUID repair rejection
  it('Scenario 11: Blocks repair when duplicate weapon UUIDs are detected to prevent ambiguous identity mutations', () => {
    const duplicateWeapons = [
      { id: 'dup-uuid-1', weaponName: 'Favonius Lance', level: 20, ascension: 3, targetLevel: 90, targetAscension: 6 },
      { id: 'dup-uuid-1', weaponName: 'The Catch', level: 90, ascension: 6, targetLevel: 90, targetAscension: 6 },
    ];
    useStore.setState({ roster: {}, trackedWeapons: duplicateWeapons });

    const repair = {
      id: 'dup-uuid-1',
      name: 'Favonius Lance',
      type: 'weapon',
      proposedLevel: 20,
      proposedAscension: 1,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: duplicateWeapons[0],
    };

    const batchVal = validateRepairBatch([repair], useStore.getState());
    expect(batchVal.isValid).toBe(false);
    expect(batchVal.isAmbiguousIdentity).toBe(true);
    expect(batchVal.error).toMatch(/duplicate identifier/i);

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(false);
    expect(result.isAmbiguousIdentity).toBe(true);
    expect(result.error).toMatch(/duplicate identifier/i);

    // Both duplicate instances must remain completely untouched
    const weapons = useStore.getState().trackedWeapons;
    expect(weapons[0].ascension).toBe(3);
    expect(weapons[1].ascension).toBe(6);
  });

  // 12. No modification to unselected records
  it('Scenario 12: Leaves unselected records completely untouched', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
      Raiden: { level: 90, ascension: 6, targetLevel: 90, targetAscension: 6, notes: 'untouched' },
    };
    const initialWeapons = [
      { id: 'w-clean', weaponName: 'Engulfing Lightning', level: 90, ascension: 6, targetLevel: 90, targetAscension: 6 },
    ];

    useStore.setState({ roster: initialRoster, trackedWeapons: initialWeapons });

    const repair = {
      id: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: initialRoster['Kuki Shinobu'],
    };

    executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    const state = useStore.getState();
    expect(state.roster.Raiden).toEqual(initialRoster.Raiden);
    expect(state.trackedWeapons[0]).toEqual(initialWeapons[0]);
  });

  // 13. Failed batch rollback
  it('Scenario 13: Rolls back entire batch if any record in transaction fails post-application validation', () => {
    const initialRoster = {
      Char1: { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
      Char2: { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    // Intentionally crafting a repair that will fail post-validation
    const batch = [
      {
        id: 'Char1',
        type: 'character',
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
        originalRecord: initialRoster.Char1,
      },
      {
        id: 'Char2',
        type: 'character',
        proposedLevel: 1,
        proposedAscension: 99, // Fails post-validation
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
        originalRecord: initialRoster.Char2,
      },
    ];

    const result = executeRepairTransaction({
      repairs: batch,
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(false);
    expect(result.rollbackApplied).toBe(false); // Rejected in pre-validation or post-validation

    // Char1 must NOT have been partially updated
    expect(useStore.getState().roster.Char1.ascension).toBe(6);
    expect(useStore.getState().roster.Char2.ascension).toBe(6);
  });

  // 14. Persistence failure behavior
  it('Scenario 14: Rolls back state and reports error if persistence fails', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    const repair = {
      id: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: initialRoster['Kuki Shinobu'],
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
      simulatePersistenceFailure: true, // Trigger persistence failure simulation
    });

    expect(result.success).toBe(false);
    expect(result.rollbackApplied).toBe(true);
    expect(result.error).toMatch(/storage quota exceeded or persistence failure/i);

    // Verify rollback restored original state
    expect(useStore.getState().roster['Kuki Shinobu'].ascension).toBe(6);
  });

  // 15. Correct post-repair diagnostics
  it('Scenario 15: Correctly updates diagnostic metrics and unresolved issue lists after partial repair', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
      Sayu: { level: 20, ascension: 3, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    // Initial state has 2 issues
    const before = diagnoseProgressionState({ roster: useStore.getState().roster, trackedWeapons: [] });
    expect(before.invalidRecordsCount).toBe(2);

    // Repair only Kuki
    executeRepairTransaction({
      repairs: [
        {
          id: 'Kuki Shinobu',
          type: 'character',
          proposedLevel: 1,
          proposedAscension: 0,
          proposedTargetLevel: 90,
          proposedTargetAscension: 6,
          originalRecord: initialRoster['Kuki Shinobu'],
        },
      ],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    const after = diagnoseProgressionState({ roster: useStore.getState().roster, trackedWeapons: [] });
    expect(after.invalidRecordsCount).toBe(1);
    expect(after.characterIssues.some((i) => i.entityIdentifier === 'Sayu')).toBe(true);
    expect(after.characterIssues.some((i) => i.entityIdentifier === 'Kuki Shinobu')).toBe(false);
  });

  // 16. Planner total recalculation
  it('Scenario 16: Automatically resolves partial planner totals when all invalid plans are repaired', () => {
    useStore.setState({
      roster: {
        'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6, tracked: true },
      },
      trackedWeapons: [],
    });

    // Before repair: invalid plan triggers partial calculations
    const aggBefore = aggregateRosterCosts(
      useStore.getState().roster,
      useStore.getState().trackedWeapons
    );
    expect(aggBefore.isPartial).toBe(true);
    expect(aggBefore.invalidCount).toBe(1);

    // Repair
    executeRepairTransaction({
      repairs: [
        {
          id: 'Kuki Shinobu',
          type: 'character',
          proposedLevel: 1,
          proposedAscension: 0,
          proposedTargetLevel: 90,
          proposedTargetAscension: 6,
          originalRecord: useStore.getState().roster['Kuki Shinobu'],
        },
      ],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    // After repair: valid plan yields complete calculations
    const aggAfter = aggregateRosterCosts(
      useStore.getState().roster,
      useStore.getState().trackedWeapons
    );
    expect(aggAfter.isPartial).toBe(false);
    expect(aggAfter.invalidCount).toBe(0);
    expect(aggAfter.invalidPlans).toEqual([]);
  });

  // 17. No repair on hydration or scan
  it('Scenario 17: Never executes repair mutations on store initialization, hydration, or diagnostic scanning', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    const updateCharacterSpy = vi.fn();
    useStore.setState({ updateCharacter: updateCharacterSpy });

    render(<ProgressionDataHealth />);

    // Scan
    const scanBtn = screen.getByRole('button', { name: /Scan Progression Data/i });
    fireEvent.click(scanBtn);

    // Assert zero store mutations occurred
    expect(updateCharacterSpy).not.toHaveBeenCalled();
    expect(useStore.getState().roster['Kuki Shinobu'].ascension).toBe(6);
  });

  // 18. Successful restore from pre-repair backup
  it('Scenario 18: Restores exact pre-repair state from generated backup snapshot', () => {
    const originalState = {
      roster: {
        'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
      },
      trackedWeapons: [
        { id: 'w-orig', weaponName: 'Favonius Sword', level: 20, ascension: 3, targetLevel: 90, targetAscension: 6 },
      ],
      inventory: { Mora: 12345 },
      serverRegion: 'NA',
      showDbBuilder: false,
      displayTimeZone: 'auto',
      achievementProgress: {},
    };

    useStore.setState(originalState);

    // 1. Create backup
    const backup = createPreRepairBackup(useStore.getState());
    expect(backup.isValid).toBe(true);

    // 2. Perform repair
    executeRepairTransaction({
      repairs: [
        {
          id: 'Kuki Shinobu',
          type: 'character',
          proposedLevel: 1,
          proposedAscension: 0,
          proposedTargetLevel: 90,
          proposedTargetAscension: 6,
          originalRecord: originalState.roster['Kuki Shinobu'],
        },
      ],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(useStore.getState().roster['Kuki Shinobu'].ascension).toBe(0);

    // 3. Restore using normalizer and store importData
    const normalized = normalizeBackupForImport(backup.payload);
    useStore.getState().importData(normalized);

    // 4. Assert restored to original state
    const restored = useStore.getState();
    expect(restored.roster['Kuki Shinobu'].level).toBe(1);
    expect(restored.roster['Kuki Shinobu'].ascension).toBe(6);
    expect(restored.trackedWeapons[0].id).toBe('w-orig');
    expect(restored.inventory.Mora).toBe(12345);
  });

  // 19. Strict numeric validation: fractional character level
  it('Scenario 19: Rejects fractional character level without silent rounding', () => {
    const val = validateLevelAscension(20.5, 1, 'character');
    expect(val.isValid).toBe(false);
    expect(val.reason).toMatch(/must be an integer/i);

    const calc = calculateProgressionCost({ name: 'Jean' }, 20.5, 90, 1, 6);
    expect(calc.isInvalid).toBe(true);
    expect(calc.invalidReason).toMatch(/integer/i);
  });

  // 20. Strict numeric validation: fractional character ascension
  it('Scenario 20: Rejects fractional character ascension without silent rounding', () => {
    const val = validateLevelAscension(20, 1.5, 'character');
    expect(val.isValid).toBe(false);
    expect(val.reason).toMatch(/must be an integer/i);
  });

  // 21. Strict numeric validation: fractional weapon level
  it('Scenario 21: Rejects fractional weapon level without silent rounding', () => {
    const val = validateLevelAscension(40.2, 1, 'weapon', 5);
    expect(val.isValid).toBe(false);
    expect(val.reason).toMatch(/must be an integer/i);

    const calc = calculateWeaponCost({ rarity: 5 }, 40.2, 90, 1, 6);
    expect(calc.isInvalid).toBe(true);
    expect(calc.invalidReason).toMatch(/integer/i);
  });

  // 22. Strict numeric validation: fractional weapon ascension
  it('Scenario 22: Rejects fractional weapon ascension without silent rounding', () => {
    const val = validateLevelAscension(40, 1.8, 'weapon', 5);
    expect(val.isValid).toBe(false);
    expect(val.reason).toMatch(/must be an integer/i);
  });

  // 23. Strict numeric validation: NaN, Infinity, -Infinity
  it('Scenario 23: Explicitly rejects NaN and infinite values', () => {
    expect(validateLevelAscension(NaN, 1, 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, NaN, 'character').isValid).toBe(false);
    expect(validateLevelAscension(Infinity, 1, 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, Infinity, 'character').isValid).toBe(false);
    expect(validateLevelAscension(-Infinity, 1, 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, -Infinity, 'character').isValid).toBe(false);
  });

  // 24. Strict numeric validation: empty and whitespace-only strings
  it('Scenario 24: Rejects empty strings and whitespace-only strings', () => {
    expect(validateLevelAscension('', 1, 'character').isValid).toBe(false);
    expect(validateLevelAscension('   ', 1, 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, '', 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, '   ', 'character').isValid).toBe(false);
  });

  // 25. Strict numeric validation: boolean values
  it('Scenario 25: Rejects boolean values instead of coercing to 0 or 1', () => {
    expect(validateLevelAscension(true, 1, 'character').isValid).toBe(false);
    expect(validateLevelAscension(false, 0, 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, true, 'character').isValid).toBe(false);
    expect(validateLevelAscension(20, false, 'character').isValid).toBe(false);
  });

  // 26. Compatible numeric strings
  it('Scenario 26: Accepts valid integer numeric strings with exact parity to numbers', () => {
    const val = validateLevelAscension('20', '1', 'character');
    expect(val.isValid).toBe(true);
    expect(val.numericLevel).toBe(20);
    expect(val.numericAscension).toBe(1);

    const valMax = validateLevelAscension('90', '6', 'character');
    expect(valMax.isValid).toBe(true);
    expect(valMax.numericLevel).toBe(90);
    expect(valMax.numericAscension).toBe(6);
  });

  // 27. Cross-tab concurrency: Tab B changes selected character in storage
  it('Scenario 27: Aborts transaction if another tab modifies a selected character in storage', () => {
    const originalRecord = { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 };
    useStore.setState({
      roster: { 'Kuki Shinobu': originalRecord },
      trackedWeapons: [],
    });

    const mockStorage = {
      getItem: vi.fn((key) => {
        if (key === STORE_NAME) {
          return JSON.stringify({
            state: {
              roster: {
                // Tab B updated Kuki Shinobu to level 50 A3
                'Kuki Shinobu': { level: 50, ascension: 3, targetLevel: 90, targetAscension: 6 },
              },
              trackedWeapons: [],
            },
          });
        }
        return null;
      }),
    };

    const repair = {
      id: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord,
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
      persistenceStorage: mockStorage,
    });

    expect(result.success).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.error).toMatch(/modified by another browser tab/i);
  });

  // 28. Cross-tab concurrency: Tab B changes selected weapon in storage
  it('Scenario 28: Aborts transaction if another tab modifies a selected weapon in storage', () => {
    const originalWeapon = { id: 'w-fav-1', weaponName: 'Favonius Sword', level: 20, ascension: 3, targetLevel: 90, targetAscension: 6, rarity: 4 };
    useStore.setState({
      roster: {},
      trackedWeapons: [originalWeapon],
    });

    const mockStorage = {
      getItem: vi.fn((key) => {
        if (key === STORE_NAME) {
          return JSON.stringify({
            state: {
              roster: {},
              trackedWeapons: [
                // Tab B leveled weapon to 40 A1
                { ...originalWeapon, level: 40, ascension: 1 },
              ],
            },
          });
        }
        return null;
      }),
    };

    const repair = {
      id: 'w-fav-1',
      name: 'Favonius Sword',
      type: 'weapon',
      proposedLevel: 20,
      proposedAscension: 1,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: originalWeapon,
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
      persistenceStorage: mockStorage,
    });

    expect(result.success).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.error).toMatch(/modified by another browser tab/i);
  });

  // 29. Cross-tab concurrency: Tab B removes selected weapon in storage
  it('Scenario 29: Aborts transaction if another tab deleted a selected weapon in storage', () => {
    const originalWeapon = { id: 'w-fav-del', weaponName: 'Favonius Sword', level: 20, ascension: 3, targetLevel: 90, targetAscension: 6, rarity: 4 };
    useStore.setState({
      roster: {},
      trackedWeapons: [originalWeapon],
    });

    const mockStorage = {
      getItem: vi.fn((key) => {
        if (key === STORE_NAME) {
          return JSON.stringify({
            state: {
              roster: {},
              trackedWeapons: [], // Tab B deleted weapon
            },
          });
        }
        return null;
      }),
    };

    const repair = {
      id: 'w-fav-del',
      name: 'Favonius Sword',
      type: 'weapon',
      proposedLevel: 20,
      proposedAscension: 1,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: originalWeapon,
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
      persistenceStorage: mockStorage,
    });

    expect(result.success).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.error).toMatch(/deleted in another browser tab|no longer exists/i);
  });

  // 30. Cross-tab concurrency: Tab B modifies unselected character in storage
  it('Scenario 30: Aborts transaction to prevent clobbering unselected records modified by another tab', () => {
    const kuki = { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 };
    const raiden = { level: 70, ascension: 4, targetLevel: 90, targetAscension: 6 };
    useStore.setState({
      roster: { 'Kuki Shinobu': kuki, Raiden: raiden },
      trackedWeapons: [],
    });

    const mockStorage = {
      getItem: vi.fn((key) => {
        if (key === STORE_NAME) {
          return JSON.stringify({
            state: {
              roster: {
                'Kuki Shinobu': kuki,
                // Tab B elevated Raiden to level 80 A5
                Raiden: { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6 },
              },
              trackedWeapons: [],
            },
          });
        }
        return null;
      }),
    };

    const repair = {
      id: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: kuki,
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
      persistenceStorage: mockStorage,
    });

    expect(result.success).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.error).toMatch(/Raiden.*modified in another browser tab/i);
  });

  // 31. Rollback failure and truthful error reporting
  it('Scenario 31: Truthfully reports both transaction error and rollback error if rollback throws', () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    let callCount = 0;
    const flakySetState = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call: apply state -> simulate failure
        throw new Error('Initial state write failure');
      }
      if (callCount === 2) {
        // Second call: rollback -> simulate rollback failure
        throw new Error('Disk unmounted during rollback');
      }
    });

    const repair = {
      id: 'Kuki Shinobu',
      type: 'character',
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
      originalRecord: initialRoster['Kuki Shinobu'],
    };

    const result = executeRepairTransaction({
      repairs: [repair],
      getState: () => useStore.getState(),
      setState: flakySetState,
      backupValidated: true,
    });

    expect(result.success).toBe(false);
    expect(result.rollbackApplied).toBe(false);
    expect(result.rollbackFailed).toBe(true);
    expect(result.error).toMatch(/Disk unmounted during rollback/i);
  });

  // 32. Modal double-click Apply protection and storage stale banner
  it('Scenario 32: Disables Apply button and shows banner when cross-tab storage event fires', async () => {
    const initialRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    useStore.setState({ roster: initialRoster, trackedWeapons: [] });

    render(
      <ProgressionRepairModal
        isOpen={true}
        selectedRepairs={[
          {
            id: 'Kuki Shinobu',
            name: 'Kuki Shinobu',
            type: 'character',
            proposedLevel: 1,
            proposedAscension: 0,
            proposedTargetLevel: 90,
            proposedTargetAscension: 6,
            originalRecord: initialRoster['Kuki Shinobu'],
          },
        ]}
        onClose={vi.fn()}
      />
    );

    // Step 1: Download backup and confirm
    const downloadBtn = screen.getByRole('button', { name: /Download Pre-Repair Backup/i });
    fireEvent.click(downloadBtn);

    const checkbox = screen.getByRole('checkbox', { name: /Confirm backup saved/i });
    fireEvent.click(checkbox);

    const proceedBtn = screen.getByRole('button', { name: /Proceed to Preview/i });
    fireEvent.click(proceedBtn);

    // Step 2: In Preview, simulate cross-tab storage event
    const applyBtn = screen.getByRole('button', { name: /Confirm & Apply Selected Repairs/i });
    expect(applyBtn).not.toBeDisabled();

    // Fire storage event
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: STORE_NAME,
        newValue: '{"state":{}}',
      })
    );

    // Verify warning is displayed and Apply button becomes disabled
    await waitFor(() => {
      expect(screen.getByText(/External Storage Modification/i)).toBeInTheDocument();
      expect(applyBtn).toBeDisabled();
    });
  });
});
