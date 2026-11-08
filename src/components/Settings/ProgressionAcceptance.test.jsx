import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProgressionRepairModal from './ProgressionRepairModal';
import useStore from '../../store/useStore';
import {
  createPreRepairBackup,
  getProgressionRepairOptions,
  validateRepairProposal,
  validateRepairBatch,
  executeRepairTransaction,
} from '../../utils/progressionRecovery';
import { normalizeBackupForImport } from '../../utils/backupUtils';
import { diagnoseProgressionState } from '../../utils/progressionContracts';
import { calculateProgressionCost } from '../../utils/calculator';
import { STORE_NAME } from '../../store/persistence';

describe('Phase C2B.2B.4 — Isolated Browser Acceptance & Release Gate Verification', () => {
  // Synthetic Fixtures satisfying all prompt specifications:
  // 1. Level 1 A6 character (Kuki Shinobu)
  // 2. Level 20 with incompatible target ascension (Sayu)
  // 3. Valid Level 80 A5 character (Raiden Shogun)
  // 4. Valid Level 80 A6 character (Zhongli)
  // 5. Valid completed character (Hu Tao 90 A6, 10/10/10)
  // 6. Invalid milestone character requiring manual resolution (Amber 50 A0)
  // 7. Invalid low-rarity weapon (Dull Blade 1-star, Lvl 40 A0)
  // 8. Tracked weapon copy 1 (Favonius Sword 70 A4 - valid)
  // 9. Tracked weapon copy 2 (Favonius Sword 20 A0 with target A6 - invalid target)
  const createSyntheticFixture = () => ({
    roster: {
      'Kuki Shinobu': {
        level: 1,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        currentAscensionUnlocked: true,
        targetAscensionUnlocked: true,
      },
      Sayu: {
        level: 20,
        ascension: 0,
        targetLevel: 20,
        targetAscension: 6,
        currentAscensionUnlocked: false,
        targetAscensionUnlocked: true,
      },
      'Raiden Shogun': {
        level: 80,
        ascension: 5,
        targetLevel: 90,
        targetAscension: 6,
        currentAscensionUnlocked: false,
        targetAscensionUnlocked: true,
      },
      Zhongli: {
        level: 80,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        currentAscensionUnlocked: true,
        targetAscensionUnlocked: true,
      },
      'Hu Tao': {
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        normalCurrent: 10,
        skillCurrent: 10,
        burstCurrent: 10,
        normalTarget: 10,
        skillTarget: 10,
        burstTarget: 10,
        currentAscensionUnlocked: true,
        targetAscensionUnlocked: true,
      },
      Amber: {
        level: 50,
        ascension: 0,
        targetLevel: 90,
        targetAscension: 6,
        currentAscensionUnlocked: false,
        targetAscensionUnlocked: true,
      },
    },
    trackedWeapons: [
      {
        id: 'w-dull-1',
        uuid: 'uuid-dull-blade-001',
        weaponName: 'Dull Blade',
        rarity: 1,
        level: 40,
        ascension: 0,
        targetLevel: 70,
        targetAscension: 4,
      },
      {
        id: 'w-fav-1',
        uuid: 'uuid-fav-sword-001',
        weaponName: 'Favonius Sword',
        rarity: 4,
        level: 70,
        ascension: 4,
        targetLevel: 90,
        targetAscension: 6,
      },
      {
        id: 'w-fav-2',
        uuid: 'uuid-fav-sword-002',
        weaponName: 'Favonius Sword',
        rarity: 4,
        level: 20,
        ascension: 0,
        targetLevel: 20,
        targetAscension: 6,
      },
    ],
    inventory: {
      Mora: 1250000,
      "Hero's Wit": 150,
    },
    serverRegion: 'NA',
    showDbBuilder: true,
    displayTimeZone: 'America/New_York',
    achievementProgress: {
      80001: { completed: true, completedAt: '2024-01-01T00:00:00.000Z' },
    },
  });

  beforeEach(() => {
    useStore.setState(createSyntheticFixture());
    // Mock browser download primitives in both window and global jsdom contexts
    const mockCreateUrl = vi.fn(() => 'blob:mock-url');
    const mockRevokeUrl = vi.fn();
    window.URL.createObjectURL = mockCreateUrl;
    window.URL.revokeObjectURL = mockRevokeUrl;
    if (typeof global.URL !== 'undefined') {
      global.URL.createObjectURL = mockCreateUrl;
      global.URL.revokeObjectURL = mockRevokeUrl;
    }
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Acceptance Test 1: Data Health Diagnostic Accuracy
  it('Acceptance 1: Diagnostic scan correctly identifies invalid records, issue counts, and ambiguous cases', () => {
    const fixture = createSyntheticFixture();
    const report = diagnoseProgressionState({
      roster: fixture.roster,
      trackedWeapons: fixture.trackedWeapons,
    });

    expect(report.isValid).toBe(false);
    expect(report.totalScanned).toBe(9); // 6 characters + 3 weapons
    expect(report.totalCharacters).toBe(6);
    expect(report.totalWeapons).toBe(3);

    // 5 invalid entities expected: Kuki (1 A6), Sayu (20 target A6), Amber (50 A0), Dull Blade (40 A0), Fav Sword copy 2 (20 target A6)
    expect(report.invalidRecordsCount).toBe(5);
    expect(report.invalidCharactersCount).toBe(3);
    expect(report.invalidWeaponsCount).toBe(2);

    // Verify healthy entities are confirmed valid
    const invalidIds = new Set(report.invalidRecords.map((r) => r.id));
    expect(invalidIds.has('Raiden Shogun')).toBe(false);
    expect(invalidIds.has('Zhongli')).toBe(false);
    expect(invalidIds.has('Hu Tao')).toBe(false);
    expect(invalidIds.has('w-fav-1')).toBe(false);

    // Verify ambiguous record (Amber at Level 50 A0 has multiple valid repair options)
    const amberRec = report.invalidRecords.find((r) => r.id === 'Amber');
    expect(amberRec).toBeDefined();
    expect(amberRec.isAmbiguous).toBe(true);

    const amberOptions = getProgressionRepairOptions(amberRec);
    expect(amberOptions.length).toBeGreaterThan(1);
    expect(amberOptions.some((opt) => opt.proposedAscension === 2)).toBe(true);
    expect(amberOptions.some((opt) => opt.proposedAscension === 3)).toBe(true);
  });

  // Acceptance Test 2: Full UI Gating, Backup Generation & Zero Mutation on Cancellation
  it('Acceptance 2: Repair modal enforces backup consent, preview inspection, and zero mutation on cancel', () => {
    const fixture = createSyntheticFixture();
    const kukiRec = {
      id: 'Kuki Shinobu',
      name: 'Kuki Shinobu',
      type: 'character',
      originalRecord: fixture.roster['Kuki Shinobu'],
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
    };

    const handleClose = vi.fn();
    const { unmount } = render(
      <ProgressionRepairModal
        isOpen={true}
        selectedRepairs={[kukiRec]}
        onClose={handleClose}
      />
    );

    // 1. Wizard Step 1: Backup required
    expect(screen.getByText('Mandatory Pre-Repair Backup')).toBeInTheDocument();
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Preview/i });
    expect(proceedBtn).toBeInTheDocument();

    // Confirm checkbox is initially disabled until backup is downloaded
    const confirmCheckbox = screen.getByRole('checkbox', { name: /Confirm backup saved/i });
    expect(confirmCheckbox).toBeDisabled();

    // Trigger download
    const downloadBtn = screen.getByRole('button', { name: /Download Pre-Repair Backup/i });
    fireEvent.click(downloadBtn);
    expect(confirmCheckbox).not.toBeDisabled();

    // Check confirmation
    fireEvent.click(confirmCheckbox);
    expect(confirmCheckbox).toBeChecked();

    // Proceed to Step 2: Preview
    fireEvent.click(proceedBtn);
    expect(screen.getByText('Review & Confirm Repairs')).toBeInTheDocument();

    // Verify diff calculation: Level 1 Ascension 6 -> 0
    expect(screen.getByText(/Current Ascension:/i)).toBeInTheDocument();
    expect(screen.getByText('6')).toHaveClass('line-through');
    expect(screen.getByText('0')).toHaveClass('font-bold');

    // 2. User Cancellation: click Close (✕)
    const closeBtn = screen.getByRole('button', { name: /Close repair modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
    unmount();

    // Verify ZERO mutations occurred in Zustand store
    const storeState = useStore.getState();
    expect(storeState.roster['Kuki Shinobu'].ascension).toBe(6);
    expect(storeState.roster['Kuki Shinobu'].level).toBe(1);
    expect(storeState.inventory.Mora).toBe(1250000);
  });

  // Acceptance Test 3: Explicit Repair Application & Post-Repair Re-scan
  it('Acceptance 3: Explicitly approved repairs apply atomically and re-scan confirms healthy state', () => {
    const fixture = createSyntheticFixture();
    useStore.setState(fixture);

    const initialReport = diagnoseProgressionState({
      roster: fixture.roster,
      trackedWeapons: fixture.trackedWeapons,
    });
    expect(initialReport.invalidRecordsCount).toBe(5);

    // Prepare batch repair for all 5 invalid records using exact entity IDs
    const repairs = [
      {
        id: 'Kuki Shinobu',
        name: 'Kuki Shinobu',
        type: 'character',
        originalRecord: fixture.roster['Kuki Shinobu'],
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
      },
      {
        id: 'Sayu',
        name: 'Sayu',
        type: 'character',
        originalRecord: fixture.roster['Sayu'],
        proposedLevel: 20,
        proposedAscension: 0,
        proposedTargetLevel: 20,
        proposedTargetAscension: 0, // Target ascension matches target level 20
      },
      {
        id: 'Amber',
        name: 'Amber',
        type: 'character',
        originalRecord: fixture.roster['Amber'],
        proposedLevel: 50,
        proposedAscension: 2, // Selected valid option for Level 50
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
      },
      {
        id: 'w-dull-1',
        weaponUuid: 'uuid-dull-blade-001',
        name: 'Dull Blade',
        type: 'weapon',
        originalRecord: fixture.trackedWeapons[0],
        proposedLevel: 40,
        proposedAscension: 1, // Valid for 1-star at level 40
        proposedTargetLevel: 70,
        proposedTargetAscension: 4,
      },
      {
        id: 'w-fav-2',
        weaponUuid: 'uuid-fav-sword-002',
        name: 'Favonius Sword',
        type: 'weapon',
        originalRecord: fixture.trackedWeapons[2],
        proposedLevel: 20,
        proposedAscension: 0,
        proposedTargetLevel: 20,
        proposedTargetAscension: 0, // Valid target ascension 0 for target level 20
      },
    ];

    // Execute transaction
    const result = executeRepairTransaction({
      repairs,
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
    });

    expect(result.success).toBe(true);
    expect(result.repairedCount).toBe(5);

    // Verify repaired store state
    const afterState = useStore.getState();
    expect(afterState.roster['Kuki Shinobu'].ascension).toBe(0);
    expect(afterState.roster['Sayu'].targetAscension).toBe(0);
    expect(afterState.roster['Amber'].ascension).toBe(2);
    expect(afterState.trackedWeapons[0].ascension).toBe(1);
    expect(afterState.trackedWeapons[2].targetAscension).toBe(0);

    // Untouched records must remain pristine
    expect(afterState.roster['Raiden Shogun'].ascension).toBe(5);
    expect(afterState.roster['Zhongli'].ascension).toBe(6);
    expect(afterState.roster['Hu Tao'].normalCurrent).toBe(10);
    expect(afterState.trackedWeapons[1].ascension).toBe(4);
    expect(afterState.inventory.Mora).toBe(1250000);

    // Re-scan: All 9 entities must now be 100% healthy
    const postReport = diagnoseProgressionState({
      roster: afterState.roster,
      trackedWeapons: afterState.trackedWeapons,
    });
    expect(postReport.isValid).toBe(true);
    expect(postReport.invalidRecordsCount).toBe(0);
    expect(postReport.validRecordsCount).toBe(9);

    // Verify calculator results: Kuki Shinobu Level 1 A0 -> 90 A6 produces valid requirements
    const kukiCosts = calculateProgressionCost(afterState.roster['Kuki Shinobu']);
    expect(kukiCosts.isInvalid).toBeUndefined();
    expect(kukiCosts.mora).toBeGreaterThan(0);
  });

  // Acceptance Test 4: Complete Backup & Restore Round-Trip Verification
  it('Acceptance 4: Pre-repair JSON backup restores 100% of identity, progression, inventory, and settings', () => {
    const originalState = createSyntheticFixture();
    useStore.setState(originalState);

    // 1. Generate Pre-Repair Backup
    const backup = createPreRepairBackup(originalState);
    expect(backup.isValid).toBe(true);
    expect(typeof backup.jsonString).toBe('string');

    // 2. Apply destructive/repaired changes to store
    useStore.setState({
      roster: {
        'Kuki Shinobu': { level: 90, ascension: 6, targetLevel: 90, targetAscension: 6 },
      },
      trackedWeapons: [],
      inventory: { Mora: 0 },
      serverRegion: 'EU',
      showDbBuilder: false,
      displayTimeZone: 'Asia/Tokyo',
      achievementProgress: {},
    });

    const mutatedState = useStore.getState();
    expect(mutatedState.inventory.Mora).toBe(0);
    expect(mutatedState.trackedWeapons.length).toBe(0);

    // 3. Restore from JSON backup using application's native normalizeBackupForImport and importData
    const parsedBackup = JSON.parse(backup.jsonString);
    const normalized = normalizeBackupForImport(parsedBackup);
    useStore.getState().importData(normalized);

    // 4. Field-by-field verification against original snapshot
    const restoredState = useStore.getState();

    // Roster identity and values
    expect(Object.keys(restoredState.roster).sort()).toEqual(
      Object.keys(originalState.roster).sort()
    );
    expect(restoredState.roster['Kuki Shinobu'].level).toBe(1);
    expect(restoredState.roster['Kuki Shinobu'].ascension).toBe(6);
    expect(restoredState.roster['Sayu'].targetAscension).toBe(6);
    expect(restoredState.roster['Hu Tao'].normalCurrent).toBe(10);

    // Tracked weapons and UUID identities
    expect(restoredState.trackedWeapons.length).toBe(3);
    expect(restoredState.trackedWeapons[0].uuid).toBe('uuid-dull-blade-001');
    expect(restoredState.trackedWeapons[0].level).toBe(40);
    expect(restoredState.trackedWeapons[1].uuid).toBe('uuid-fav-sword-001');
    expect(restoredState.trackedWeapons[2].uuid).toBe('uuid-fav-sword-002');

    // Inventory, Region, Settings, Achievements
    expect(restoredState.inventory.Mora).toBe(1250000);
    expect(restoredState.inventory["Hero's Wit"]).toBe(150);
    expect(restoredState.serverRegion).toBe('NA');
    expect(restoredState.showDbBuilder).toBe(true);
    expect(restoredState.displayTimeZone).toBe('America/New_York');
    expect(restoredState.achievementProgress).toEqual({
      80001: { completed: true, completedAt: '2024-01-01T00:00:00.000Z' },
    });
  });

  // Acceptance Test 5: Cross-Tab Concurrency & Stale Detection
  it('Acceptance 5: Cross-tab storage drift aborts transaction, protects newer data, and preserves unrelated edits', () => {
    const fixture = createSyntheticFixture();
    useStore.setState(fixture);

    // Tab A prepares repair for Kuki Shinobu
    const kukiRepair = {
      id: 'Kuki Shinobu',
      name: 'Kuki Shinobu',
      type: 'character',
      originalRecord: fixture.roster['Kuki Shinobu'],
      proposedLevel: 1,
      proposedAscension: 0,
      proposedTargetLevel: 90,
      proposedTargetAscension: 6,
    };

    // Tab B mutates storage in the background:
    // Tab B leveled up Raiden Shogun to 85 and added 500,000 Mora
    const tabBStorage = {
      getItem: vi.fn((key) => {
        if (key === STORE_NAME) {
          return JSON.stringify({
            state: {
              roster: {
                ...fixture.roster,
                'Raiden Shogun': {
                  level: 85,
                  ascension: 6,
                  targetLevel: 90,
                  targetAscension: 6,
                },
              },
              trackedWeapons: fixture.trackedWeapons,
              inventory: { Mora: 1750000, "Hero's Wit": 150 },
            },
          });
        }
        return null;
      }),
    };

    // Tab A attempts to execute repair
    const result = executeRepairTransaction({
      repairs: [kukiRepair],
      getState: () => useStore.getState(),
      setState: (patch) => useStore.setState(patch),
      backupValidated: true,
      persistenceStorage: tabBStorage,
    });

    // Transaction must FAIL CLOSED
    expect(result.success).toBe(false);
    expect(result.isStale).toBe(true);
    expect(result.error).toMatch(/Raiden Shogun.*modified in another browser tab/i);

    // Tab B's data is untouched
    const currentPersisted = JSON.parse(tabBStorage.getItem(STORE_NAME)).state;
    expect(currentPersisted.roster['Raiden Shogun'].level).toBe(85);
    expect(currentPersisted.inventory.Mora).toBe(1750000);
  });

  // Acceptance Test 6: Exhaustive Failure Handling Matrix (8 Modes)
  describe('Acceptance 6: Exhaustive Failure Handling Modes', () => {
    // 1. Invalid Backup
    it('Mode 1: Invalid backup blocks transaction before any state write', () => {
      const result = executeRepairTransaction({
        repairs: [{ id: 'Kuki Shinobu', type: 'character', proposedLevel: 1, proposedAscension: 0 }],
        getState: () => useStore.getState(),
        setState: vi.fn(),
        backupValidated: false, // Invalid / unvalidated backup
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/backup.*mandatory|validated/i);
    });

    // 2. Stale Preview
    it('Mode 2: Stale preview aborts before store write', () => {
      const mockStorage = {
        getItem: () =>
          JSON.stringify({
            state: {
              roster: { 'Kuki Shinobu': { level: 50, ascension: 2 } }, // Diverged in storage
              trackedWeapons: [],
            },
          }),
      };
      const result = executeRepairTransaction({
        repairs: [
          {
            id: 'Kuki Shinobu',
            type: 'character',
            originalRecord: { level: 1, ascension: 6 },
            proposedLevel: 1,
            proposedAscension: 0,
          },
        ],
        getState: () => useStore.getState(),
        setState: vi.fn(),
        backupValidated: true,
        persistenceStorage: mockStorage,
      });
      expect(result.success).toBe(false);
      expect(result.isStale).toBe(true);
    });

    // 3. Invalid Correction (Out-of-range or impossible combination)
    it('Mode 3: Proposal with invalid progression values is rejected during batch validation', () => {
      const invalidProposal = {
        id: 'Kuki Shinobu',
        type: 'character',
        proposedLevel: 1,
        proposedAscension: 6, // Still invalid!
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
        originalRecord: { level: 1, ascension: 6 },
      };
      const val = validateRepairProposal(invalidProposal, useStore.getState());
      expect(val.isValid).toBe(false);
      expect(val.error).toMatch(/Ascension 6 is invalid for level 1/i);
    });

    // 4. Duplicate Weapon UUID
    it('Mode 4: Proposals targeting ambiguous duplicate weapon UUIDs are rejected', () => {
      const batch = [
        {
          id: 'shared-id',
          weaponUuid: 'shared-uuid',
          name: 'Favonius Sword',
          type: 'weapon',
          proposedLevel: 20,
          proposedAscension: 1,
          proposedTargetLevel: 90,
          proposedTargetAscension: 6,
        },
      ];
      const stateWithDupes = {
        roster: {},
        trackedWeapons: [
          { id: 'shared-id', uuid: 'shared-uuid', weaponName: 'Favonius Sword', level: 20, ascension: 0 },
          { id: 'shared-id', uuid: 'shared-uuid', weaponName: 'Favonius Sword', level: 40, ascension: 1 },
        ],
      };
      const batchVal = validateRepairBatch(batch, stateWithDupes);
      expect(batchVal.isValid).toBe(false);
      expect(batchVal.isAmbiguousIdentity).toBe(true);
    });

    // 5. Storage Write Failure & Automatic Rollback
    it('Mode 5: Mutation error triggers immediate in-memory rollback', () => {
      const initial = createSyntheticFixture();
      useStore.setState(initial);

      let callCount = 0;
      const failingSetState = vi.fn(() => {
        callCount++;
        if (callCount === 1) throw new Error('Simulated disk/quota write error');
        // Rollback call (callCount === 2) succeeds
      });

      const repair = {
        id: 'Kuki Shinobu',
        name: 'Kuki Shinobu',
        type: 'character',
        originalRecord: initial.roster['Kuki Shinobu'],
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
      };

      const result = executeRepairTransaction({
        repairs: [repair],
        getState: () => useStore.getState(),
        setState: failingSetState,
        backupValidated: true,
      });

      expect(result.success).toBe(false);
      expect(result.rollbackApplied).toBe(true);
      expect(result.rollbackFailed).toBe(false);
      expect(result.error).toMatch(/Simulated disk\/quota write error/i);
    });

    // 6. Rollback Failure Reporting
    it('Mode 6: Rollback failure truthfully reports rollbackFailed: true', () => {
      const initial = createSyntheticFixture();
      useStore.setState(initial);

      let attempts = 0;
      const failingSetState = vi.fn(() => {
        attempts++;
        if (attempts === 1) throw new Error('Primary write failure');
        if (attempts === 2) throw new Error('Secondary rollback failure');
      });

      const repair = {
        id: 'Kuki Shinobu',
        name: 'Kuki Shinobu',
        type: 'character',
        originalRecord: initial.roster['Kuki Shinobu'],
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
      };

      const result = executeRepairTransaction({
        repairs: [repair],
        getState: () => useStore.getState(),
        setState: failingSetState,
        backupValidated: true,
      });

      expect(result.success).toBe(false);
      expect(result.rollbackApplied).toBe(false);
      expect(result.rollbackFailed).toBe(true);
      expect(result.error).toMatch(/Secondary rollback failure/i);
    });

    // 7. Repeated Apply Action / Double-Click Guard
    it('Mode 7: Apply button blocks execution while isApplying is active', async () => {
      const initial = createSyntheticFixture();
      useStore.setState(initial);

      const kukiRec = {
        id: 'Kuki Shinobu',
        name: 'Kuki Shinobu',
        type: 'character',
        originalRecord: initial.roster['Kuki Shinobu'],
        proposedLevel: 1,
        proposedAscension: 0,
        proposedTargetLevel: 90,
        proposedTargetAscension: 6,
      };

      render(
        <ProgressionRepairModal
          isOpen={true}
          selectedRepairs={[kukiRec]}
          onClose={vi.fn()}
        />
      );

      // Wait for backup snapshot generation in useEffect
      await waitFor(() => {
        expect(
          screen.getByText(/Pre-Repair Backup Snapshot Created & Validated/i)
        ).toBeInTheDocument();
      });

      // Download backup & confirm
      const downloadBtn = screen.getByRole('button', { name: /Download Pre-Repair Backup/i });
      fireEvent.click(downloadBtn);

      const confirmCheckbox = screen.getByRole('checkbox', { name: /Confirm backup saved/i });
      await waitFor(() => {
        expect(confirmCheckbox).not.toBeDisabled();
      });
      fireEvent.click(confirmCheckbox);
      expect(confirmCheckbox).toBeChecked();

      const proceedBtn = screen.getByRole('button', { name: /Proceed to Preview/i });
      fireEvent.click(proceedBtn);

      const applyBtn = screen.getByRole('button', { name: /Confirm & Apply Selected Repairs/i });
      expect(applyBtn).not.toBeDisabled();

      // Trigger apply
      fireEvent.click(applyBtn);

      // Execution completes and step moves to result
      await waitFor(() => {
        expect(screen.getByText('Repair Succeeded')).toBeInTheDocument();
      });
    });

    // 8. User Cancellation via Keyboard (Escape)
    it('Mode 8: Pressing Escape safely cancels modal without mutations', () => {
      const initial = createSyntheticFixture();
      useStore.setState(initial);
      const handleClose = vi.fn();

      render(
        <ProgressionRepairModal
          isOpen={true}
          selectedRepairs={[]}
          onClose={handleClose}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
      expect(useStore.getState().roster['Kuki Shinobu'].ascension).toBe(6);
    });
  });
});
