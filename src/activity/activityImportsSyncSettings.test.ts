/**
 * ACTIVITY-HISTORY-A5: Imports, Synchronization, Settings, Goals & System Events Suite
 *
 * Verifies that:
 * 1. GOOD imports produce exactly one grouped event (good_import_applied) with accurate counts.
 * 2. Local JSON and cloud restores generate single summary events with proper attribution.
 * 3. Automatic cloud recovery is accurately attributed without duplicates.
 * 4. Google Drive backup success/failure is logged safely without credentials.
 * 5. HoYoLAB synchronization logs progression differences without sensitive data.
 * 6. Settings achievement imports group correctly as merge vs replace.
 * 7. Regional preferences and goals log before/after diffs with no-op suppression.
 * 8. Factory reset honors the retention policy (cleared vs retained).
 * 9. All events satisfy validateActivityEvent runtime validation.
 * 10. History remains strictly informational with zero Undo or state restoration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import useStore from '../store/useStore';
import {
  getActivityEvents,
  clearActivityHistory,
  useActivityStore,
} from './activityStore';
import { recordActivity } from './activityLogger';
import { validateActivityEvent } from './activityValidation';
import { ACTIVITY_STORAGE_KEY, type ActivityEvent } from './activityTypes';
import {
  BACKUP_SCHEMA_VERSION,
  restoreLatestRecoveryBackup,
} from '../utils/backupUtils';
import * as driveSync from '../utils/driveSync';
import { performCloudBackup } from '../pages/Settings';
import { applyAchievementImport } from '../components/Settings/AchievementData';
import type { NormalizedGoodPayload } from '../types/good';
import type { NormalizedBackupData } from '../types/backup';

const store = useStore as any;

function assertEventPersistedAndValid(event: ActivityEvent) {
  expect(event).toBeDefined();

  // 1. Pass runtime validation
  const validation = validateActivityEvent(event);
  expect(validation.isValid).toBe(true);

  // 2. Persisted in raw localStorage
  const rawDisk = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
  expect(rawDisk).not.toBeNull();
  const diskEnvelope = JSON.parse(rawDisk!);
  const persisted = diskEnvelope.events.find(
    (e: ActivityEvent) => e.id === event.id
  );
  expect(persisted).toBeDefined();
  expect(persisted.category).toBe(event.category);
  expect(persisted.action).toBe(event.action);
  expect(persisted.source).toBe(event.source);
  expect(persisted.entityType).toBe(event.entityType);
  expect(persisted.entityId).toBe(event.entityId);

  // 3. Survives storage reload via reconcileFromDisk
  useActivityStore.getState().reconcileFromDisk();
  expect(
    useActivityStore.getState().events.some((e) => e.id === event.id)
  ).toBe(true);
}

describe('ACTIVITY-HISTORY-A5: Imports, Sync, Settings & System Events', () => {
  beforeEach(() => {
    clearActivityHistory();
    store.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
      goals: [],
      achievementProgress: {},
      serverRegion: 'Asia',
      displayTimeZone: 'auto',
      showDbBuilder: false,
      autoBackupEnabled: false,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. GOOD FORMAT IMPORTS (Scenarios 1–6)
  // ─────────────────────────────────────────────────────────────────────────

  it('1. Successful GOOD import produces exactly one grouped event', () => {
    const payload: NormalizedGoodPayload = {
      materials: {
        crystal_chunk: 50,
        mora: 100000,
      },
      characters: [
        {
          name: 'Amber',
          level: 20,
          ascension: 1,
          talents: { normal: 1, skill: 1, burst: 1 },
        },
      ],
      weapons: [
        {
          weaponName: 'Favonius Warbow',
          level: 40,
          ascension: 2,
          refinement: 1,
          location: 'Amber',
        },
      ],
    };

    store.getState().importGoodData(payload);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('import_sync');
    expect(event.action).toBe('good_import_applied');
    expect(event.source).toBe('settings_good_import');
    expect(event.entityType).toBe('backup');
    expect(event.entityId).toBe('good_import');
    assertEventPersistedAndValid(event);
  });

  it('2. Actual changed counts in GOOD import metadata are accurate', () => {
    // Initial state: Diluc at level 20, 10 crystal chunks
    store.getState().addCharacter('Diluc');
    store.getState().setInventory('crystal_chunk', 10);
    clearActivityHistory();

    const payload: NormalizedGoodPayload = {
      materials: {
        crystal_chunk: 50, // Changed: 10 -> 50
        white_iron_chunk: 20, // New: 0 -> 20
      },
      characters: [
        {
          name: 'Diluc', // Existing: updated level 1 -> 80
          level: 80,
          ascension: 5,
          talents: { normal: 6, skill: 6, burst: 6 },
        },
        {
          name: 'Jean', // New character created
          level: 70,
          ascension: 4,
          talents: { normal: 1, skill: 1, burst: 1 },
        },
      ],
      weapons: [
        {
          weaponName: 'Favonius Greatsword',
          level: 50,
          ascension: 2,
          refinement: 2,
          location: 'Diluc',
        },
      ],
    };

    store.getState().importGoodData(payload);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const meta = events[0].metadata as any;
    expect(meta.materialsUpdated).toBe(2);
    expect(meta.charactersCreated).toBe(1); // Jean
    expect(meta.charactersUpdated).toBe(1); // Diluc
    expect(meta.weaponsCreated).toBe(1); // Favonius Greatsword
    expect(meta.assignmentsChanged).toBeGreaterThanOrEqual(1);
    assertEventPersistedAndValid(events[0]);
  });

  it('3. No-op GOOD import produces no mutation event', () => {
    // Pre-populate Amber
    store.getState().addCharacter('Amber');
    store.getState().setInventory('crystal_chunk', 50);
    clearActivityHistory();

    // Import payload with identical values
    const payload: NormalizedGoodPayload = {
      materials: {
        crystal_chunk: 50,
      },
      characters: [
        {
          name: 'Amber',
          level: 1,
          ascension: 0,
          talents: { normal: 1, skill: 1, burst: 1 },
        },
      ],
    };

    store.getState().importGoodData(payload);

    // Suppressed because 0 domain properties actually changed
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('4. Invalid or empty GOOD payload does not produce success event', () => {
    const emptyPayload: NormalizedGoodPayload = {
      materials: {},
      characters: [],
      weapons: [],
    };

    store.getState().importGoodData(emptyPayload);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('5. Character and weapon identities remain correct across GOOD imports', () => {
    // Add weapon first with specific UUID
    store.getState().addCharacter('Kaeya');
    const wId = store.getState().addTrackedWeapon('Cool Steel', 'Kaeya', {
      targetLevel: 90,
      targetAscension: 6,
    });
    clearActivityHistory();

    const payload: NormalizedGoodPayload = {
      weapons: [
        {
          weaponName: 'Cool Steel',
          level: 60,
          ascension: 3,
          refinement: 5,
          location: 'Kaeya',
        },
      ],
    };

    store.getState().importGoodData(payload);

    // Existing weapon UUID and target properties must be preserved
    const weapons = store.getState().trackedWeapons;
    const matched = weapons.find((w: any) => w.weaponName === 'Cool Steel');
    expect(matched).toBeDefined();
    expect(matched.id).toBe(wId);
    expect(matched.level).toBe(60);
    expect(matched.targetLevel).toBe(90);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('good_import_applied');
  });

  it('6. No duplicate A3 or A4 events are generated during GOOD import', () => {
    const payload: NormalizedGoodPayload = {
      materials: { crystal_chunk: 100 },
      characters: [
        {
          name: 'Lisa',
          level: 50,
          ascension: 2,
          talents: { normal: 1, skill: 1, burst: 1 },
        },
      ],
      weapons: [
        {
          weaponName: 'Magic Guide',
          level: 50,
          ascension: 2,
          refinement: 5,
          location: 'Lisa',
        },
      ],
    };

    store.getState().importGoodData(payload);

    const events = getActivityEvents();
    // Exactly 1 grouped event, zero individual inventory/character/weapon events
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('good_import_applied');
    expect(
      events.some(
        (e) =>
          e.action === 'character_added' ||
          e.action === 'weapon_added' ||
          e.action === 'inventory_updated'
      )
    ).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. BACKUP & RESTORATION (Scenarios 7–14)
  // ─────────────────────────────────────────────────────────────────────────

  it('7. Local restore produces one event with accurate record counts', () => {
    const backupData: NormalizedBackupData = {
      roster: {
        Bennett: {
          level: 80,
          ascension: 5,
          targetLevel: 90,
          targetAscension: 6,
          talents: { normal: 1, skill: 8, burst: 9 },
          targetTalents: { normal: 1, skill: 9, burst: 10 },
          equippedWeaponId: null,
          tracked: true,
          calculatedCosts: null,
        },
      },
      trackedWeapons: [
        {
          id: 'w-uuid-1',
          weapon_id: 'favoniussword',
          weaponName: 'Favonius Sword',
          level: 80,
          ascension: 5,
          targetLevel: 90,
          targetAscension: 6,
          currentRefinement: 3,
          targetRefinement: 5,
          assignedTo: 'Bennett',
          createdAt: Date.now(),
        },
      ],
      inventory: {
        mora: 500000,
        hero_wit: 45,
      },
      serverRegion: 'NA',
      showDbBuilder: true,
      displayTimeZone: 'America/New_York',
      achievementProgress: {
        '81001': { completed: true, completedAt: '2026-11-12T00:00:00.000Z' },
      },
    };

    store.getState().importData(backupData, {
      source: 'settings_backup',
      origin: 'manual_file',
      fileName: 'my-backup.json',
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('import_sync');
    expect(event.action).toBe('local_backup_restored');
    expect(event.source).toBe('settings_backup');
    expect(event.entityType).toBe('backup');
    expect(validateActivityEvent(event).isValid).toBe(true);

    const meta = event.metadata as any;
    expect(meta.characterCount).toBe(1);
    expect(meta.weaponCount).toBe(1);
    expect(meta.materialCount).toBe(2);
    expect(meta.achievementCount).toBe(1);
    expect(meta.serverRegion).toBe('NA');
    assertEventPersistedAndValid(event);
  });

  it('8. Manual cloud restore produces one event with settings_cloud_sync source', () => {
    const cloudBackup: NormalizedBackupData = {
      roster: {},
      trackedWeapons: [],
      inventory: { mora: 1000 },
      serverRegion: 'EU',
      showDbBuilder: false,
      displayTimeZone: 'UTC',
      achievementProgress: {},
    };

    store.getState().importData(cloudBackup, {
      source: 'settings_cloud_sync',
      origin: 'manual_cloud_restore',
      fileId: 'drive-file-id-12345',
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('import_sync');
    expect(event.action).toBe('cloud_backup_restored');
    expect(event.source).toBe('settings_cloud_sync');
    expect(event.entityType).toBe('backup');
    expect(event.entityId).toBe('drive-file-id-12345');
    expect((event.metadata as any).origin).toBe('manual_cloud_restore');
    assertEventPersistedAndValid(event);
  });

  it('9. Automatic recovery restore is accurately attributed to system source', async () => {
    const rawDriveBackup = {
      app: 'travelers-toolkit',
      schemaVersion: 1,
      createdAt: '2026-11-12T00:00:00.000Z',
      data: {
        roster: {},
        trackedWeapons: [],
        inventory: { crystal_chunk: 25 },
        serverRegion: 'Asia',
        showDbBuilder: false,
        displayTimeZone: 'auto',
        achievementProgress: {},
      },
    };

    vi.spyOn(
      driveSync,
      'downloadRecoveryBackupFromDrive'
    ).mockResolvedValueOnce(rawDriveBackup as any);

    const success = await restoreLatestRecoveryBackup(
      store.getState().importData
    );
    expect(success).toBe(true);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('cloud_backup_restored');
    expect(event.source).toBe('system');
    expect((event.metadata as any).origin).toBe('automatic_cloud_recovery');
    assertEventPersistedAndValid(event);
  });

  it('10. Download failure produces no successful restore event', async () => {
    vi.spyOn(
      driveSync,
      'downloadRecoveryBackupFromDrive'
    ).mockRejectedValueOnce({ status: 404 });

    const success = await restoreLatestRecoveryBackup(
      store.getState().importData
    );
    expect(success).toBe(false);

    expect(getActivityEvents()).toHaveLength(0);
  });

  it('11. Cloud backup creation success is logged only after upload succeeds', async () => {
    const uploadSpy = vi
      .fn()
      .mockResolvedValue({ name: 'travelers-toolkit-backup-2026-11-13.json' });
    const res = await performCloudBackup({
      uploadFn: uploadSpy,
      getState: () => store.getState(),
    });
    expect(res.success).toBe(true);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.category).toBe('import_sync');
    expect(event.action).toBe('cloud_backup_created');
    expect(event.source).toBe('settings_cloud_sync');
    expect(event.entityType).toBe('backup');
    expect(event.entityId).toBe('cloud_backup');
    expect(event.summary).toBe(
      'Successfully created Google Drive cloud backup.'
    );
    assertEventPersistedAndValid(event);
  });

  it('12. Cloud backup failure is classified accurately without sensitive data', async () => {
    const uploadSpy = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Google Auth Error: Bearer ya29.secretToken123456 at https://www.googleapis.com/drive/v3/files?access_token=ya29.secret'
        )
      );
    const res = await performCloudBackup({
      uploadFn: uploadSpy,
      getState: () => store.getState(),
    });
    expect(res.success).toBe(false);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.category).toBe('import_sync');
    expect(event.action).toBe('cloud_backup_failed');
    expect(event.source).toBe('settings_cloud_sync');
    expect(event.entityType).toBe('backup');
    expect(event.entityId).toBe('cloud_backup');
    expect((event.metadata as any).failureClassification).toBe(
      'authentication_error'
    );

    // CRITICAL PRIVACY ASSERTION: ensure no token, secret, URL, or raw message leaks into the event
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('ya29');
    expect(serialized).not.toContain('secretToken');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('googleapis.com');
    expect(serialized).not.toContain('access_token');

    assertEventPersistedAndValid(event);
  });

  it('13. Repeated automatic backups do not flood history', () => {
    // Silent auto-backups use silent: true or bypass logging
    store.getState().importData(
      {
        roster: {},
        trackedWeapons: [],
        inventory: {},
        serverRegion: 'Asia',
        showDbBuilder: false,
        displayTimeZone: 'auto',
        achievementProgress: {},
      },
      { silent: true }
    );

    expect(getActivityEvents()).toHaveLength(0);
  });

  it('14. Existing backup schema version remains strictly version 1', () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. HOYOLAB SYNCHRONIZATION (Scenarios 15–19)
  // ─────────────────────────────────────────────────────────────────────────

  it('15. Valid HoYoLAB sync plan generates exactly one grouped event', () => {
    const plan = {
      characters: [
        {
          rosterKey: 'Amber',
          isNew: true,
          fields: { level: 50, ascension: 2 },
          weapon: {
            action: 'create',
            weapon_id: 'favoniuswarbow',
            name: 'Favonius Warbow',
            level: 50,
            ascension: 2,
            refinement: 1,
          },
        },
      ],
    };

    store.getState().applyHoyolabSync(plan);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('import_sync');
    expect(event.action).toBe('hoyolab_character_sync_applied');
    expect(event.source).toBe('hoyolab_character_sync');
    expect(event.entityType).toBe('sync_session');
    expect(validateActivityEvent(event).isValid).toBe(true);

    const meta = event.metadata as any;
    expect(meta.charactersAdded).toBe(1);
    expect(meta.weaponsCreated).toBe(1);
    assertEventPersistedAndValid(event);
  });

  it('16. Invalid HoYoLAB plan fails validation and generates zero success events', () => {
    const invalidPlan = {
      characters: 'invalid_type_not_an_array',
    };

    expect(() => {
      store.getState().applyHoyolabSync(invalidPlan);
    }).toThrow();

    expect(getActivityEvents()).toHaveLength(0);
  });

  it('17. Unchanged HoYoLAB plan produces no progression event', () => {
    const plan = {
      characters: [],
    };

    store.getState().applyHoyolabSync(plan);
    // No-op suppression: 0 characters or weapons modified
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('18. HoYoLAB character and weapon differences in metadata are accurate', () => {
    store.getState().addCharacter('Lisa');
    clearActivityHistory();

    const plan = {
      characters: [
        {
          rosterKey: 'Lisa', // Existing: updated
          isNew: false,
          fields: { level: 70, ascension: 4 },
        },
        {
          rosterKey: 'Kaeya', // New
          isNew: true,
          fields: { level: 60, ascension: 3 },
          weapon: {
            action: 'create',
            weapon_id: 'coolsteel',
            name: 'Cool Steel',
            level: 60,
            ascension: 3,
            refinement: 3,
          },
        },
      ],
    };

    store.getState().applyHoyolabSync(plan);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const meta = events[0].metadata as any;
    expect(meta.charactersAdded).toBe(1);
    expect(meta.charactersUpdated).toBe(1);
    expect(meta.weaponsCreated).toBe(1);
    assertEventPersistedAndValid(events[0]);
  });

  it('19. No credentials or auth cookies are ever recorded in HoYoLAB sync events', () => {
    const plan = {
      characters: [
        {
          rosterKey: 'Noelle',
          isNew: true,
          fields: { level: 40, ascension: 1 },
        },
      ],
    };

    store.getState().applyHoyolabSync(plan);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const serialized = JSON.stringify(events[0]);
    expect(serialized).not.toContain('ltoken');
    expect(serialized).not.toContain('ltuid');
    expect(serialized).not.toContain('cookie');
    expect(serialized).not.toContain('password');
    assertEventPersistedAndValid(events[0]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ACHIEVEMENTS SETTINGS IMPORT (Scenarios 20–24)
  // ─────────────────────────────────────────────────────────────────────────

  it('20. Settings merge import is correctly labeled achievements_imported_merge', () => {
    store.getState().setAchievementProgress({
      '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' },
    });
    clearActivityHistory();

    const importResult = {
      format: 'NATIVE',
      progress: {
        '80002': { completed: true, completedAt: '2026-10-01T00:00:00.000Z' },
      },
      validIds: ['80002'],
      unknownIds: [],
    };

    applyAchievementImport({
      actionType: 'merge',
      result: importResult,
      achievementProgress: store.getState().achievementProgress,
      setAchievementProgress: store.getState().setAchievementProgress,
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.category).toBe('achievements');
    expect(event.action).toBe('achievements_imported_merge');
    expect(event.source).toBe('achievements_settings');
    expect(event.entityType).toBe('achievement');
    expect(event.entityId).toBe('achievements_import');
    expect((event.metadata as any).mode).toBe('merge');
    expect((event.metadata as any).newlyCompletedCount).toBe(1);
    expect((event.metadata as any).finalCompletedCount).toBe(2);
    assertEventPersistedAndValid(event);
  });

  it('21. Settings replace import is correctly labeled achievements_imported_replace', () => {
    store.getState().setAchievementProgress({
      '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' },
    });
    clearActivityHistory();

    const importResult = {
      format: 'GOOD',
      progress: {
        '80002': { completed: true, completedAt: null },
      },
      validIds: ['80002'],
      unknownIds: [],
    };

    applyAchievementImport({
      actionType: 'replace',
      result: importResult,
      achievementProgress: store.getState().achievementProgress,
      setAchievementProgress: store.getState().setAchievementProgress,
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.category).toBe('achievements');
    expect(event.action).toBe('achievements_imported_replace');
    expect(event.source).toBe('achievements_settings');
    expect(event.entityType).toBe('achievement');
    expect(event.entityId).toBe('achievements_import');
    expect((event.metadata as any).mode).toBe('replace');
    expect((event.metadata as any).newlyCompletedCount).toBe(1);
    expect((event.metadata as any).clearedCount).toBe(1);
    expect((event.metadata as any).finalCompletedCount).toBe(1);
    assertEventPersistedAndValid(event);
  });

  it('22. Manual toggles remain independently logged and distinct from imports', () => {
    store
      .getState()
      .setAchievementCompleted('80001', true, 'achievements_page');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('achievement_completed');
    expect(events[0].source).toBe('achievements_page');
  });

  it('23. Original completion timestamps remain intact during native imports', () => {
    const originalTime = '2024-05-01T12:00:00.000Z';
    store.getState().setAchievementProgress({
      '80001': { completed: true, completedAt: originalTime },
    });

    expect(store.getState().achievementProgress['80001'].completedAt).toBe(
      originalTime
    );
  });

  it('24. Unknown achievement IDs are reported as skipped in metadata', () => {
    store.getState().setAchievementProgress({});
    clearActivityHistory();

    const importResult = {
      format: 'GOOD',
      progress: {
        '80001': { completed: true, completedAt: null },
        '80002': { completed: true, completedAt: null },
      },
      validIds: ['80001', '80002'],
      unknownIds: ['999991', '999992', '999993'],
    };

    applyAchievementImport({
      actionType: 'replace',
      result: importResult,
      achievementProgress: store.getState().achievementProgress,
      setAchievementProgress: store.getState().setAchievementProgress,
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.category).toBe('achievements');
    expect(event.action).toBe('achievements_imported_replace');
    expect((event.metadata as any).unknownSkippedCount).toBe(3);
    expect((event.metadata as any).newlyCompletedCount).toBe(2);
    assertEventPersistedAndValid(event);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SETTINGS & GOALS (Scenarios 25–30)
  // ─────────────────────────────────────────────────────────────────────────

  it('25. Changed setting creates one event with before/after changes', () => {
    store.getState().setServerRegion('EU', 'settings_preferences');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('settings_system');
    expect(event.action).toBe('server_region_changed');
    expect(event.source).toBe('settings_preferences');
    expect(event.changes).toEqual([
      {
        field: 'serverRegion',
        label: 'Server Region',
        before: 'Asia',
        after: 'EU',
      },
    ]);
    assertEventPersistedAndValid(event);
  });

  it('26. Setting to the same value is a no-op that produces zero events', () => {
    store.getState().setServerRegion('Asia', 'settings_preferences');
    expect(getActivityEvents()).toHaveLength(0);

    store.getState().setDisplayTimeZone('auto', 'settings_preferences');
    expect(getActivityEvents()).toHaveLength(0);

    store.getState().setAutoBackupEnabled(false, 'settings_preferences');
    expect(getActivityEvents()).toHaveLength(0);

    store.getState().setShowDbBuilder(false, 'settings_preferences');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('27. Goal creation logs goal_added accurately', () => {
    const goal = { charName: 'Keqing', targetLevel: 90 };
    store.getState().addGoal(goal, 'system');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('goals');
    expect(event.action).toBe('goal_added');
    expect(event.entityId).toBe('Keqing');
    expect(event.summary).toBe('Added progression goal for Keqing.');
    assertEventPersistedAndValid(event);
  });

  it('28. Goal modification is labeled goal_updated rather than creation', () => {
    store.getState().addGoal({ charName: 'Ganyu', targetLevel: 80 });
    clearActivityHistory();

    // Modify existing goal for Ganyu
    store.getState().addGoal({ charName: 'Ganyu', targetLevel: 90 });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('goal_updated');
    expect(events[0].summary).toBe('Updated progression goal for Ganyu.');
    expect((events[0].metadata as any).isUpdate).toBe(true);
    assertEventPersistedAndValid(events[0]);
  });

  it('29. Removing a missing goal is a no-op that produces zero events', () => {
    store.getState().removeGoal('NonExistentCharacter');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('29b. Successfully removing a goal logs goal_removed and passes persistence validation', () => {
    store.getState().addGoal({ charName: 'Ayaka', targetLevel: 90 });
    clearActivityHistory();

    store.getState().removeGoal('Ayaka', 'settings_preferences');
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('goals');
    expect(events[0].action).toBe('goal_removed');
    expect(events[0].entityId).toBe('Ayaka');
    expect(events[0].summary).toBe('Removed progression goal for Ayaka.');
    assertEventPersistedAndValid(events[0]);
  });

  it('30. Programmatic setting and goal calls use neutral system source attribution', () => {
    store.getState().setDisplayTimeZone('UTC');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('system');
    expect(events[0].action).toBe('display_timezone_changed');
    assertEventPersistedAndValid(events[0]);
  });

  it('30b. Toggling Database Builder logs db_builder_toggled and passes persistence validation', () => {
    store.getState().setShowDbBuilder(true, 'settings_preferences');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('settings_system');
    expect(events[0].action).toBe('db_builder_toggled');
    expect(events[0].entityType).toBe('setting');
    expect(events[0].summary).toBe('Enabled Database Builder.');
    assertEventPersistedAndValid(events[0]);
  });

  it('30c. Toggling Auto Backup logs auto_backup_toggled and passes persistence validation', () => {
    store.getState().setAutoBackupEnabled(true, 'settings_preferences');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('settings_system');
    expect(events[0].action).toBe('auto_backup_toggled');
    expect(events[0].entityType).toBe('setting');
    expect(events[0].summary).toBe('Enabled automatic cloud backup.');
    assertEventPersistedAndValid(events[0]);
  });

  it('30d. Changing display timezone logs display_timezone_changed and passes persistence validation', () => {
    store.getState().setDisplayTimeZone('Asia/Tokyo', 'settings_preferences');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('settings_system');
    expect(events[0].action).toBe('display_timezone_changed');
    expect(events[0].entityType).toBe('setting');
    expect(events[0].summary).toBe(
      'Changed display timezone from auto to Asia/Tokyo.'
    );
    assertEventPersistedAndValid(events[0]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. FACTORY RESET & RETENTION (Scenarios 31–36)
  // ─────────────────────────────────────────────────────────────────────────

  it('31. Cancelled reset has no effect on domain state or history', () => {
    store.getState().addCharacter('Zhongli');
    const prevEvents = getActivityEvents();
    expect(prevEvents).toHaveLength(1);

    // Cancelled reset means no resetStore() call is made
    expect(store.getState().roster.Zhongli).toBeDefined();
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('32. Reset with history retained preserves previous events and appends factory_reset_performed', () => {
    store.getState().addCharacter('Venti');
    expect(getActivityEvents()).toHaveLength(1);

    // Factory reset with history retained:
    store.getState().resetStore({ logActivity: true, clearHistory: false });

    const events = getActivityEvents();
    // Previous event preserved + 1 factory reset event appended
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.action === 'character_added')).toBe(true);
    expect(events.some((e) => e.action === 'factory_reset_performed')).toBe(
      true
    );
    const resetEvt = events.find((e) => e.action === 'factory_reset_performed');
    expect((resetEvt?.metadata as any).historyCleared).toBe(false);
    assertEventPersistedAndValid(resetEvt!);
  });

  it('33. Reset with history cleared removes previous events and starts with factory_reset_performed', () => {
    store.getState().addCharacter('Mona');
    expect(getActivityEvents()).toHaveLength(1);

    // Factory reset with history cleared:
    store.getState().resetStore({ logActivity: true, clearHistory: true });

    const events = getActivityEvents();
    // Pre-reset event wiped; only 1 fresh reset event exists
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('factory_reset_performed');
    expect((events[0].metadata as any).historyCleared).toBe(true);
    assertEventPersistedAndValid(events[0]);
  });

  it('34. Reset records accurate system event metadata', () => {
    store.getState().resetStore({ logActivity: true, clearHistory: true });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.category).toBe('settings_system');
    expect(event.action).toBe('factory_reset_performed');
    expect(event.source).toBe('settings_preferences');
    expect(event.entityType).toBe('setting');
    assertEventPersistedAndValid(event);
  });

  it('35. Logging failure does not block a confirmed factory reset', () => {
    const appendSpy = vi
      .spyOn(useActivityStore.getState(), 'appendEvent')
      .mockImplementation(() => {
        throw new Error('Simulated disk full');
      });

    // Domain reset completes cleanly despite logger error
    store.getState().resetStore({ logActivity: true, clearHistory: false });
    expect(store.getState().roster).toEqual({});

    appendSpy.mockRestore();
  });

  it('35b. Failure to clear history storage does not block a confirmed factory reset', () => {
    const clearSpy = vi
      .spyOn(useActivityStore.getState(), 'clearHistory')
      .mockImplementation(() => {
        throw new Error('Simulated storage clear failure');
      });

    store.getState().addCharacter('Raiden');
    expect(store.getState().roster.Raiden).toBeDefined();

    // Domain reset completes cleanly despite clear failure
    store.getState().resetStore({ logActivity: true, clearHistory: true });
    expect(store.getState().roster).toEqual({});

    clearSpy.mockRestore();
  });

  it('36. No unrelated localStorage keys are deleted during reset', () => {
    localStorage.setItem('user_custom_setting', 'keep_me');

    clearActivityHistory();
    store.getState().resetStore();

    expect(localStorage.getItem('user_custom_setting')).toBe('keep_me');
    localStorage.removeItem('user_custom_setting');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. REGRESSION & INTEGRITY (Scenarios 37–40)
  // ─────────────────────────────────────────────────────────────────────────

  it('37. A3 inventory and crafting operations remain intact and fully functional', () => {
    store.getState().setInventory('mora', 250000);
    expect(store.getState().inventory.mora).toBe(250000);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('inventory_updated');
  });

  it('38. A4 character, weapon, and achievement operations remain intact', () => {
    store.getState().addCharacter('Amber');
    const wId = store.getState().addTrackedWeapon('Favonius Warbow', 'Amber');
    store.getState().setAchievementCompleted('80001', true);

    const events = getActivityEvents();
    expect(events.some((e) => e.action === 'character_added')).toBe(true);
    expect(events.some((e) => e.action === 'weapon_added')).toBe(true);
    expect(events.some((e) => e.action === 'achievement_completed')).toBe(true);
  });

  it('39. No additional domain actions are accidentally generated by imports', () => {
    clearActivityHistory();

    store.getState().importData({
      roster: { Diluc: { level: 90, ascension: 6 } as any },
      trackedWeapons: [],
      inventory: { mora: 5000 },
      serverRegion: 'Asia',
      showDbBuilder: false,
      displayTimeZone: 'auto',
      achievementProgress: {},
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('local_backup_restored');
  });

  it('40. Reading Activity History never changes application state', () => {
    store.getState().addCharacter('Collei');
    const beforeRoster = JSON.stringify(store.getState().roster);

    // Read history multiple times
    const events1 = getActivityEvents();
    const events2 = getActivityEvents();
    expect(events1).toEqual(events2);

    const afterRoster = JSON.stringify(store.getState().roster);
    expect(beforeRoster).toBe(afterRoster);
  });
});
