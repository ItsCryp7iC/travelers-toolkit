/**
 * Traveler's Toolkit — Activity History Phase A4 Comprehensive Test Suite
 * Characters, Weapons & Achievements Mutation Activity Logging
 * Authoritative specification: docs/activity-history-architecture.md
 */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import useStore from '../store/useStore';
import AddCharacterModal from '../components/AddCharacterModal';
import BatchAddWeaponModal from '../components/BatchAddWeaponModal';
import {
  getActivityEvents,
  clearActivityHistory,
  useActivityStore,
} from './activityStore';
import * as activityStoreModule from './activityStore';
import { isValidUUID, validateActivityEvent } from './activityValidation';
import { recordActivity } from './activityLogger';
import allAchievementsData from '../data/achievements/achievements.json';
import { applyStageCompletionChange } from '../utils/achievementStageProgress';
import { STORE_VERSION } from '../store/persistence';

const store = useStore as any;

describe('Activity History Phase A4: Characters, Weapons & Achievements', () => {
  beforeEach(() => {
    clearActivityHistory();
    store.setState({
      roster: {},
      trackedWeapons: [],
      achievementProgress: {},
      inventory: {},
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. CHARACTERS
  // ─────────────────────────────────────────────────────────────────────────

  it('1. Add character creates one event', () => {
    store.getState().addCharacter('Razor', 'characters_table');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('characters');
    expect(event.action).toBe('character_added');
    expect(event.source).toBe('characters_table');
    expect(event.entityType).toBe('character');
    expect(event.entityId).toBe('Razor');
    expect(event.entityName).toBe('Razor');
    expect(event.summary).toBe('Added Razor to the character roster.');
    expect((event.metadata as any)?.initialLevel).toBe(1);
    expect((event.metadata as any)?.targetLevel).toBe(90);
    expect(event.changes).toBeDefined();
    expect(
      event.changes?.some((c) => c.field === 'level' && c.after === 1)
    ).toBe(true);
    expect(
      event.changes?.some((c) => c.field === 'targetLevel' && c.after === 90)
    ).toBe(true);
  });

  it('2. Duplicate add creates no event', () => {
    store.getState().addCharacter('Razor');
    expect(getActivityEvents()).toHaveLength(1);

    // Duplicate add should be a silent no-op
    store.getState().addCharacter('Razor');
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('3. Remove character creates one event', () => {
    store.getState().addCharacter('Razor');
    const wId = store
      .getState()
      .addTrackedWeapon('Favonius Greatsword', 'Razor');
    clearActivityHistory();

    store.getState().removeCharacter('Razor', 'character_modal');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('characters');
    expect(event.action).toBe('character_removed');
    expect(event.source).toBe('character_modal');
    expect(event.entityId).toBe('Razor');
    expect(event.summary).toBe('Removed Razor from the character roster.');
    expect((event.metadata as any)?.unassignedWeaponIds).toContain(wId);
    expect(event.changes?.some((c) => c.field === 'equippedWeapon')).toBe(true);

    // Verify weapon was also unassigned in store
    const weapon = store
      .getState()
      .trackedWeapons.find((w: any) => w.id === wId);
    expect(weapon?.assignedTo).toBeNull();
  });

  it('4. Removing absent character creates no event', () => {
    store.getState().removeCharacter('Diluc');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('5. Level and ascension changes are accurate', () => {
    store.getState().addCharacter('Razor');
    clearActivityHistory();

    store.getState().updateCharacter('Razor', { level: 90, ascension: 6 });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('characters');
    expect(event.action).toBe('character_updated');
    expect(event.entityId).toBe('Razor');
    expect(event.summary).toBe("Razor's progression updated.");

    const levelChange = event.changes?.find((c) => c.field === 'level');
    expect(levelChange).toBeDefined();
    expect(levelChange?.before).toBe(1);
    expect(levelChange?.after).toBe(90);
    expect(levelChange?.delta).toBe('+89');

    const ascChange = event.changes?.find((c) => c.field === 'ascension');
    expect(ascChange).toBeDefined();
    expect(ascChange?.before).toBe(0);
    expect(ascChange?.after).toBe(6);
    expect(ascChange?.delta).toBe('+6');
  });

  it('6. Talent changes are accurately recorded', () => {
    store.getState().addCharacter('Razor');
    clearActivityHistory();

    store.getState().updateCharacter('Razor', {
      talents: { normal: 9, skill: 10, burst: 10 },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(
      event.changes?.some(
        (c) => c.field === 'talents.normal' && c.before === 1 && c.after === 9
      )
    ).toBe(true);
    expect(
      event.changes?.some(
        (c) => c.field === 'talents.skill' && c.before === 1 && c.after === 10
      )
    ).toBe(true);
    expect(
      event.changes?.some(
        (c) => c.field === 'talents.burst' && c.before === 1 && c.after === 10
      )
    ).toBe(true);
  });

  it('7. Unchanged Save creates no event', () => {
    store.getState().addCharacter('Razor');
    clearActivityHistory();

    // Save with the exact same values currently stored
    store.getState().saveCharacterDraft('Razor', {
      level: 1,
      ascension: 0,
      targetLevel: 90,
      targetAscension: 6,
      talents: { normal: 1, skill: 1, burst: 1 },
      targetTalents: { normal: 10, skill: 10, burst: 10 },
      weaponId: null,
    });

    expect(getActivityEvents()).toHaveLength(0);
  });

  it('8. Batch add creates one grouped event', () => {
    store.getState().addCharacter('Razor'); // Already present
    clearActivityHistory();

    store
      .getState()
      .batchAddCharacters(['Razor', 'Bennett', 'Jean'], 'dashboard_quick_add');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('characters');
    expect(event.action).toBe('characters_batch_added');
    expect(event.source).toBe('dashboard_quick_add');
    expect(event.summary).toBe('Added 2 characters to the roster.');
    expect((event.metadata as any)?.addedCount).toBe(2);
    expect((event.metadata as any)?.characterNames).toEqual([
      'Bennett',
      'Jean',
    ]);
  });

  it('9. Batch remove creates one grouped event', () => {
    store.getState().batchAddCharacters(['Bennett', 'Jean', 'Razor']);
    clearActivityHistory();

    store.getState().batchRemoveCharacters(['Bennett', 'Jean', 'Skirk']);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('characters_batch_removed');
    expect(event.summary).toBe('Removed 2 characters from the roster.');
    expect((event.metadata as any)?.removedCount).toBe(2);
    expect((event.metadata as any)?.characterNames).toEqual([
      'Bennett',
      'Jean',
    ]);
  });

  it('10. Bulk progression update creates one grouped event', () => {
    store.getState().batchAddCharacters(['Bennett', 'Jean']);
    clearActivityHistory();

    store
      .getState()
      .bulkUpdateCharacters(
        ['Bennett', 'Jean'],
        { targetLevel: 80, targetAscension: 5 },
        'character_bulk_edit'
      );

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('characters_bulk_updated');
    expect(event.source).toBe('character_bulk_edit');
    expect(event.summary).toBe('Updated progression for 2 characters.');
    expect((event.metadata as any)?.count).toBe(2);
    expect((event.metadata as any)?.characterNames).toEqual([
      'Bennett',
      'Jean',
    ]);
  });

  it('11. Character modal weapon change is grouped', () => {
    store.getState().addCharacter('Jean');
    const w1 = store.getState().addTrackedWeapon('Favonius Sword', null);
    const w2 = store.getState().addTrackedWeapon('Aquila Favonia', null);
    clearActivityHistory();

    // Equipping w1 and updating level in one saveCharacterDraft
    store.getState().saveCharacterDraft(
      'Jean',
      {
        level: 80,
        ascension: 5,
        targetLevel: 90,
        targetAscension: 6,
        weaponId: w1,
      },
      'character_modal'
    );

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('characters');
    expect(event.action).toBe('character_updated');
    expect(event.source).toBe('character_modal');
    expect(event.entityId).toBe('Jean');
    expect(
      event.changes?.some((c) => c.field === 'level' && c.after === 80)
    ).toBe(true);
    expect(event.changes?.some((c) => c.field === 'equippedWeapon')).toBe(true);

    // Re-saving with w2 weapon swap should also produce exactly one event
    clearActivityHistory();
    store.getState().saveCharacterDraft(
      'Jean',
      {
        level: 80,
        ascension: 5,
        targetLevel: 90,
        targetAscension: 6,
        weaponId: w2,
      },
      'character_modal'
    );

    const events2 = getActivityEvents();
    expect(events2).toHaveLength(1);
    expect(events2[0].changes?.some((c) => c.field === 'equippedWeapon')).toBe(
      true
    );
  });

  it('12. Traveler shared progression is handled correctly', () => {
    store.getState().batchAddCharacters(['Traveler Anemo', 'Traveler Geo']);
    clearActivityHistory();

    store
      .getState()
      .updateCharacter('Traveler Anemo', { level: 90, ascension: 6 });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.entityId).toBe('Traveler Anemo');
    expect(
      event.changes?.some((c) => c.field === 'level' && c.after === 90)
    ).toBe(true);

    // Verify Traveler Geo synchronized in domain store
    expect(store.getState().roster['Traveler Geo']?.level).toBe(90);
    expect(store.getState().roster['Traveler Geo']?.ascension).toBe(6);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. WEAPONS
  // ─────────────────────────────────────────────────────────────────────────

  it('13. Weapon creation uses instance UUID', () => {
    const wId = store
      .getState()
      .addTrackedWeapon('Favonius Sword', null, {}, 'armory_modal');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('weapons');
    expect(event.action).toBe('weapon_added');
    expect(event.source).toBe('armory_modal');
    expect(event.entityId).toBe(wId);
    expect(isValidUUID(event.entityId)).toBe(true);
    expect(event.entityName).toBe('Favonius Sword');
    expect(event.summary).toBe('Added Favonius Sword to the armory.');
  });

  it('14. Two copies of one weapon are distinguishable', () => {
    const w1 = store.getState().addTrackedWeapon('Favonius Sword');
    const w2 = store.getState().addTrackedWeapon('Favonius Sword');

    expect(w1).not.toBe(w2);
    const events = getActivityEvents();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.entityId)).toEqual(
      expect.arrayContaining([w1, w2])
    );
  });

  it('15. Weapon deletion produces one event', () => {
    const wId = store.getState().addTrackedWeapon('Favonius Sword');
    clearActivityHistory();

    store.getState().removeTrackedWeapon(wId, 'weapons_table');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_removed');
    expect(event.source).toBe('weapons_table');
    expect(event.entityId).toBe(wId);
    expect(event.summary).toBe('Removed Favonius Sword from the armory.');
  });

  it('16. Missing weapon ID produces no event', () => {
    store.getState().removeTrackedWeapon('non-existent-uuid');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('17. Weapon progression records correct fields', () => {
    const wId = store.getState().addTrackedWeapon('Favonius Sword');
    clearActivityHistory();

    store
      .getState()
      .updateTrackedWeapon(
        wId,
        { level: 80, ascension: 5, targetLevel: 90, targetAscension: 6 },
        'weapons_table'
      );

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_updated');
    expect(event.source).toBe('weapons_table');
    expect(event.summary).toBe('Favonius Sword progression updated.');

    expect(
      event.changes?.some(
        (c) => c.field === 'level' && c.before === 1 && c.after === 80
      )
    ).toBe(true);
    expect(
      event.changes?.some(
        (c) => c.field === 'ascension' && c.before === 0 && c.after === 5
      )
    ).toBe(true);
  });

  it('18. Refinement changes are recorded', () => {
    const wId = store.getState().addTrackedWeapon('Favonius Sword');
    clearActivityHistory();

    store.getState().updateTrackedWeapon(wId, { currentRefinement: 3 });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_updated');
    expect(
      event.changes?.some(
        (c) =>
          c.field === 'currentRefinement' && c.before === 1 && c.after === 3
      )
    ).toBe(true);
  });

  it('19. Assigning a weapon creates one event', () => {
    store.getState().addCharacter('Bennett');
    const wId = store.getState().addTrackedWeapon('Favonius Sword');
    clearActivityHistory();

    store.getState().assignWeaponToCharacter(wId, 'Bennett');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_assigned');
    expect(event.entityId).toBe(wId);
    expect(event.summary).toBe('Assigned Favonius Sword to Bennett.');
    expect((event.metadata as any)?.newOwner).toBe('Bennett');
    expect((event.metadata as any)?.previousOwner).toBeNull();
  });

  it('20. Reassigning between characters creates one grouped event', () => {
    store.getState().addCharacter('Bennett');
    store.getState().addCharacter('Jean');
    const wId = store.getState().addTrackedWeapon('Favonius Sword', 'Bennett');
    clearActivityHistory();

    store.getState().assignWeaponToCharacter(wId, 'Jean');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_assigned');
    expect(event.summary).toBe('Assigned Favonius Sword to Jean.');
    expect((event.metadata as any)?.previousOwner).toBe('Bennett');
    expect((event.metadata as any)?.newOwner).toBe('Jean');

    // Confirm store linkages updated
    expect(store.getState().roster['Bennett']?.equippedWeaponId).toBeNull();
    expect(store.getState().roster['Jean']?.equippedWeaponId).toBe(wId);
  });

  it('21. Assigning an already-assigned weapon to the same owner is a no-op', () => {
    store.getState().addCharacter('Bennett');
    const wId = store.getState().addTrackedWeapon('Favonius Sword', 'Bennett');
    clearActivityHistory();

    store.getState().assignWeaponToCharacter(wId, 'Bennett');
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('22. Unassigning a weapon produces one event', () => {
    store.getState().addCharacter('Bennett');
    const wId = store.getState().addTrackedWeapon('Favonius Sword', 'Bennett');
    clearActivityHistory();

    store.getState().unassignWeapon(wId);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_unassigned');
    expect(event.summary).toBe('Unassigned Favonius Sword from Bennett.');
    expect((event.metadata as any)?.unassignedFrom).toBe('Bennett');
  });

  it('23. Bulk weapon updates generate one event', () => {
    const w1 = store.getState().addTrackedWeapon('Favonius Sword');
    const w2 = store.getState().addTrackedWeapon('Aquila Favonia');
    clearActivityHistory();

    store
      .getState()
      .bulkUpdateWeapons(
        [w1, w2],
        { targetLevel: 80, targetAscension: 5 },
        'weapons_bulk_edit'
      );

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapons_bulk_updated');
    expect(event.source).toBe('weapons_bulk_edit');
    expect(event.summary).toBe('Updated progression for 2 weapons.');
    expect((event.metadata as any)?.updatedCount).toBe(2);
  });

  it('24. Derived cost recalculations do not create phantom events', () => {
    const wId = store.getState().addTrackedWeapon('Favonius Sword');
    clearActivityHistory();

    // Calling update with identical progression properties
    store.getState().updateTrackedWeapon(wId, { level: 1, ascension: 0 });
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('25. Traveler assignment rules are preserved', () => {
    store.getState().batchAddCharacters(['Traveler Anemo', 'Traveler Geo']);
    const wId = store
      .getState()
      .addTrackedWeapon('Favonius Sword', 'Traveler Anemo');
    clearActivityHistory();

    // Assigning to Traveler Geo should unassign from Traveler Anemo and keep equippedWeaponId null on roster
    store.getState().assignWeaponToCharacter(wId, 'Traveler Geo');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('weapon_assigned');

    const state = store.getState();
    expect(state.roster['Traveler Anemo']?.equippedWeaponId).toBeNull();
    expect(state.roster['Traveler Geo']?.equippedWeaponId).toBeNull();
    const wp = state.trackedWeapons.find((w: any) => w.id === wId);
    expect(wp?.assignedTo).toBe('Traveler Geo');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. ACHIEVEMENTS
  // ─────────────────────────────────────────────────────────────────────────

  it('26. Complete achievement', () => {
    // 80091: 'Tales of Monstrous Madness' (5 primogems)
    store
      .getState()
      .setAchievementCompleted('80091', true, 'achievements_page');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('achievements');
    expect(event.action).toBe('achievement_completed');
    expect(event.source).toBe('achievements_page');
    expect(event.entityType).toBe('achievement');
    expect(event.entityId).toBe('80091');
    expect(event.entityName).toBe('Tales of Monstrous Madness');
    expect(event.summary).toBe(
      'Completed achievement: Tales of Monstrous Madness.'
    );
    expect((event.metadata as any)?.primogems).toBe(5);
    expect((event.metadata as any)?.completedAt).toBeDefined();
    expect(
      event.changes?.some((c) => c.field === 'completed' && c.after === true)
    ).toBe(true);
  });

  it('27. Uncomplete achievement', () => {
    store.getState().setAchievementCompleted('80091', true);
    clearActivityHistory();

    store
      .getState()
      .setAchievementCompleted('80091', false, 'achievements_page');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('achievement_uncompleted');
    expect(event.entityId).toBe('80091');
    expect(event.summary).toBe(
      'Marked Tales of Monstrous Madness as incomplete.'
    );
    expect(
      event.changes?.some((c) => c.field === 'completed' && c.after === false)
    ).toBe(true);
  });

  it('28. Repeated completion is a no-op', () => {
    store.getState().setAchievementCompleted('80091', true);
    expect(getActivityEvents()).toHaveLength(1);

    store.getState().setAchievementCompleted('80091', true);
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('29. Repeated uncompletion is a no-op', () => {
    store.getState().setAchievementCompleted('80091', false);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('30. Existing completion timestamps are preserved', () => {
    const initialIso = '2026-01-01T12:00:00.000Z';
    store.setState({
      achievementProgress: {
        '80091': { completed: true, completedAt: initialIso },
      },
    });
    clearActivityHistory();

    // Calling setAchievementCompleted on already completed item
    store.getState().setAchievementCompleted('80091', true);

    expect(store.getState().achievementProgress['80091']?.completedAt).toBe(
      initialIso
    );
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('31. Multi-stage completion produces one grouped event', () => {
    // Zoo Tycoon series: 80127 (Stage 1), 80128 (Stage 2), 80129 (Stage 3)
    const prevProgress = store.getState().achievementProgress;
    const nextProgress = applyStageCompletionChange(
      prevProgress,
      allAchievementsData,
      '80129', // Checking Stage 3 directly
      true,
      '2026-11-12T12:00:00.000Z'
    );

    store.getState().setAchievementProgress(nextProgress, {
      mode: 'replace',
      source: 'achievements_page',
      trigger: { targetId: '80129', checked: true },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.category).toBe('achievements');
    expect(event.action).toBe('achievements_stage_cascade');
    expect(event.source).toBe('achievements_page');
    expect(event.summary).toBe(
      'Updated achievement series: 3 stages completed.'
    );
    expect((event.metadata as any)?.initiatorId).toBe('80129');
    expect((event.metadata as any)?.changedCount).toBe(3);
    expect((event.metadata as any)?.changedIds).toEqual(
      expect.arrayContaining(['80127', '80128', '80129'])
    );
  });

  it('32. Multi-stage uncompletion preserves canonical rules', () => {
    // Start with all 3 stages of Zoo Tycoon completed
    const initialProgress = {
      '80127': { completed: true, completedAt: null },
      '80128': { completed: true, completedAt: null },
      '80129': { completed: true, completedAt: null },
    };
    store.setState({ achievementProgress: initialProgress });
    clearActivityHistory();

    // Unchecking Stage 2 should uncheck Stage 2 and Stage 3 (2 stages uncompleted)
    const nextProgress = applyStageCompletionChange(
      initialProgress,
      allAchievementsData,
      '80128',
      false
    );

    store.getState().setAchievementProgress(nextProgress, {
      mode: 'replace',
      source: 'achievements_page',
      trigger: { targetId: '80128', checked: false },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('achievements_stage_cascade');
    expect(event.summary).toBe(
      'Updated achievement series: 2 stages marked incomplete.'
    );
    expect((event.metadata as any)?.initiatorId).toBe('80128');
    expect((event.metadata as any)?.changedCount).toBe(2);
    expect((event.metadata as any)?.changedIds).toEqual(
      expect.arrayContaining(['80128', '80129'])
    );

    // Store state has Stage 1 still completed, Stage 2 and 3 removed
    const finalProg = store.getState().achievementProgress;
    expect(finalProg['80127']?.completed).toBe(true);
    expect(finalProg['80128']).toBeUndefined();
    expect(finalProg['80129']).toBeUndefined();
  });

  it('33. Settings imports are not misclassified as manual toggles', () => {
    // Settings import calls setAchievementProgress without options.trigger
    store.getState().setAchievementProgress(
      {
        '80091': { completed: true, completedAt: null },
        '80127': { completed: true, completedAt: null },
      },
      { mode: 'replace' }
    );

    // In A4, programmatic imports emit 0 events (deferred to A5)
    expect(getActivityEvents()).toHaveLength(0);

    // Store state was updated cleanly
    expect(store.getState().achievementProgress['80091']?.completed).toBe(true);
  });

  it('34. Invalid achievement ID produces no event', () => {
    store.getState().setAchievementCompleted('fake-id-999999', true);
    expect(getActivityEvents()).toHaveLength(0);
    expect(
      store.getState().achievementProgress['fake-id-999999']
    ).toBeUndefined();
  });

  it('35. Achievement metadata cannot leak sensitive information', () => {
    store.getState().setAchievementCompleted('80091', true);
    const event = getActivityEvents()[0];

    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(
      /token|auth|cookie|password|secret|credential|session_id|ltoken|ltuid/i
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. SYSTEM INTEGRITY
  // ─────────────────────────────────────────────────────────────────────────

  it('36. Logger failure does not abort a character update', () => {
    const appendSpy = vi
      .spyOn(useActivityStore.getState(), 'appendEvent')
      .mockImplementationOnce(() => {
        throw new Error('Simulated storage crash');
      });

    // Domain update should not throw and should succeed in store
    expect(() => {
      store.getState().addCharacter('Razor');
    }).not.toThrow();

    expect(store.getState().roster['Razor']).toBeDefined();
    appendSpy.mockRestore();
  });

  it('37. Logger failure does not abort a weapon update', () => {
    const appendSpy = vi
      .spyOn(useActivityStore.getState(), 'appendEvent')
      .mockImplementationOnce(() => {
        throw new Error('Simulated storage crash');
      });

    let wId: string | undefined;
    expect(() => {
      wId = store.getState().addTrackedWeapon('Favonius Sword');
    }).not.toThrow();

    expect(wId).toBeDefined();
    expect(store.getState().trackedWeapons.some((w: any) => w.id === wId)).toBe(
      true
    );
    appendSpy.mockRestore();
  });

  it('38. Logger failure does not abort achievement changes', () => {
    const appendSpy = vi
      .spyOn(useActivityStore.getState(), 'appendEvent')
      .mockImplementationOnce(() => {
        throw new Error('Simulated storage crash');
      });

    expect(() => {
      store.getState().setAchievementCompleted('80091', true);
    }).not.toThrow();

    expect(store.getState().achievementProgress['80091']?.completed).toBe(true);
    appendSpy.mockRestore();
  });

  it('39. Rejected or unchanged operations produce zero records', () => {
    // 1. Unchanged character update
    store.getState().addCharacter('Razor');
    clearActivityHistory();
    store.getState().updateCharacter('Razor', {});
    expect(getActivityEvents()).toHaveLength(0);

    // 2. Unassigning an unassigned weapon
    const wId = store.getState().addTrackedWeapon('Favonius Sword');
    clearActivityHistory();
    store.getState().unassignWeapon(wId);
    expect(getActivityEvents()).toHaveLength(0);

    // 3. Uncompleting an incomplete achievement
    store.getState().setAchievementCompleted('80091', false);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('40. Existing inventory/crafting Activity History tests still pass', () => {
    // Verify inventory logging from A3 remains intact
    store.getState().setInventory('Mora', 5000, 'inventory_page');
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('inventory');
    expect(events[0].action).toBe('inventory_updated');
  });

  it('41. Domain persistence schema remains version 8', () => {
    expect(STORE_VERSION).toBe(8);
  });

  it('42. No domain state is modified by reading history', () => {
    store.getState().addCharacter('Razor');
    store.getState().addTrackedWeapon('Favonius Sword', 'Razor');
    store.getState().setAchievementCompleted('80091', true);

    const snapshotBefore = JSON.stringify({
      roster: store.getState().roster,
      trackedWeapons: store.getState().trackedWeapons,
      achievementProgress: store.getState().achievementProgress,
    });

    // Read history multiple times
    getActivityEvents();
    getActivityEvents();

    const snapshotAfter = JSON.stringify({
      roster: store.getState().roster,
      trackedWeapons: store.getState().trackedWeapons,
      achievementProgress: store.getState().achievementProgress,
    });

    expect(snapshotBefore).toBe(snapshotAfter);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PHASE A4.1 AUDIT REGRESSION SUITE (Gaps 1-11)
  // ─────────────────────────────────────────────────────────────────────────

  it('43. Actual character event passes validateActivityEvent runtime validation', () => {
    store.getState().addCharacter('Bennett', 'characters_table');
    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const validation = validateActivityEvent(events[0]);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeUndefined();
    expect(events[0].action).toBe('character_added');
    expect(typeof events[0].entityId).toBe('string');
    expect(isValidUUID(events[0].id)).toBe(true);
  });

  it('44. Actual weapon event passes validateActivityEvent runtime validation', () => {
    const wId = store.getState().addTrackedWeapon(
      'Favonius Sword',
      'Jean',
      {
        currentLevel: 80,
        currentAscension: 5,
        currentRefinement: 3,
      },
      'armory_modal'
    );

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const validation = validateActivityEvent(events[0]);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeUndefined();
    expect(events[0].action).toBe('weapon_added');
    expect(events[0].entityId).toBe(wId);
    expect(events[0].source).toBe('armory_modal');
  });

  it('45. Actual achievement event passes validateActivityEvent runtime validation', () => {
    store
      .getState()
      .setAchievementCompleted('80091', true, 'achievements_page');
    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const validation = validateActivityEvent(events[0]);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeUndefined();
    expect(events[0].action).toBe('achievement_completed');
    expect(typeof events[0].entityId).toBe('string');
    expect(events[0].entityId).toBe('80091');
    expect(events[0].source).toBe('achievements_page');
  });

  it('46. Actual cascade event passes validateActivityEvent runtime validation', () => {
    // Stage 3 of Zoo Tycoon: '80129' (cascades stages 1, 2, 3)
    const cascaded = applyStageCompletionChange(
      {},
      allAchievementsData,
      '80129',
      true,
      '2026-11-12T00:00:00.000Z'
    );

    store.getState().setAchievementProgress(cascaded, {
      mode: 'replace',
      source: 'achievements_page',
      trigger: { targetId: '80129', checked: true },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const validation = validateActivityEvent(events[0]);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeUndefined();
    expect(events[0].action).toBe('achievements_stage_cascade');
    expect(typeof events[0].entityId).toBe('string');
    expect((events[0].metadata as any)?.initiatorId).toBe('80129');
  });

  it('47. AddWeaponModal-style three-argument creation preserves configuration', () => {
    // Calling with (weaponName, assignedTo, config) - standard 3-arg signature
    const wId = store.getState().addTrackedWeapon('Amenoma Kageuchi', 'Ayaka', {
      currentLevel: 70,
      currentAscension: 4,
      targetLevel: 90,
      targetAscension: 6,
      currentRefinement: 2,
      targetRefinement: 5,
    });

    expect(typeof wId).toBe('string');
    const weapon = store
      .getState()
      .trackedWeapons.find((w: any) => w.id === wId);
    expect(weapon).toBeDefined();
    expect(weapon.level).toBe(70);
    expect(weapon.ascension).toBe(4);
    expect(weapon.targetLevel).toBe(90);
    expect(weapon.targetAscension).toBe(6);
    expect(weapon.currentRefinement).toBe(2);
    expect(weapon.targetRefinement).toBe(5);
    expect(weapon.assignedTo).toBe('Ayaka');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('weapon_added');
    expect(events[0].source).toBe('system'); // default when omitted
  });

  it('48. Bulk weapon identifier-plus-patch invocation remains compatible', () => {
    const w1 = store.getState().addTrackedWeapon('Favonius Sword');
    const w2 = store.getState().addTrackedWeapon('Sacrificial Sword');
    clearActivityHistory();

    // Standard 3-arg invocation: (ids, patch, source)
    store
      .getState()
      .bulkUpdateWeapons(
        [w1, w2],
        { level: 80, ascension: 5 },
        'weapons_bulk_edit'
      );

    const armory = store.getState().trackedWeapons;
    expect(armory.find((w: any) => w.id === w1).level).toBe(80);
    expect(armory.find((w: any) => w.id === w2).level).toBe(80);

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('weapons_bulk_updated');
    expect(events[0].source).toBe('weapons_bulk_edit');
    expect((events[0].metadata as any).updatedCount).toBe(2);

    // Also test array payload invocation: (payloads, source)
    clearActivityHistory();
    store
      .getState()
      .bulkUpdateWeapons(
        [{ id: w1, level: 90, ascension: 6 }],
        'weapons_bulk_edit'
      );
    expect(
      store.getState().trackedWeapons.find((w: any) => w.id === w1).level
    ).toBe(90);
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('49. AddCharacterModal Confirm does not generate misleading intermediate activity', () => {
    // AddCharacterModal selects characters and applies initial baseline level + weapon assignment
    const names = ['Jean', 'Amber'];
    const progressionConfig = {
      level: 80,
      ascension: 6,
      targetLevel: 90,
      targetAscension: 6,
      talents: { normal: 6, skill: 6, burst: 6 },
      targetTalents: { normal: 10, skill: 10, burst: 10 },
      source: 'character_modal',
    };

    // Modal calls batchAddCharacters with progressionConfig and batchGroup: true
    store.getState().batchAddCharacters(names, progressionConfig, {
      source: 'character_modal',
      batchGroup: true,
    });

    // Modal then calls bulkUpdateCharacters with batchGroup: true
    store.getState().bulkUpdateCharacters(
      names,
      {
        level: 80,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        talents: { normal: 6, skill: 6, burst: 6 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
      { source: 'character_modal', batchGroup: true }
    );

    // Modal calls addTrackedWeapon with batchGroup: true for assigned weapon
    const wId = store
      .getState()
      .addTrackedWeapon(
        'Aquila Favonia',
        'Jean',
        {},
        { source: 'character_modal', batchGroup: true }
      );

    // Modal records exactly ONE grouped event summarizing the entire operation
    recordActivity({
      category: 'characters',
      action: 'characters_batch_added',
      source: 'character_modal',
      entityType: 'character',
      entityId: 'batch_characters',
      summary: 'Added 2 characters and assigned 1 weapon.',
      changes: [],
      metadata: {
        charactersAdded: 2,
        weaponsCreated: 1,
        characterNames: names,
        weaponAssignments: [
          {
            weaponId: wId,
            weaponName: 'Aquila Favonia',
            assignedTo: 'Jean',
          },
        ],
        initialLevel: 80,
        initialAscension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    });

    // Exactly 1 grouped activity event recorded!
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('characters_batch_added');
    expect(events[0].source).toBe('character_modal');
    expect((events[0].metadata as any).charactersAdded).toBe(2);
    expect((events[0].metadata as any).weaponsCreated).toBe(1);
    expect((events[0].metadata as any).weaponAssignments[0].weaponId).toBe(wId);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);

    // Authoritative final state
    expect(store.getState().roster.Jean.level).toBe(80);
    expect(store.getState().roster.Jean.ascension).toBe(6);
    expect(store.getState().roster.Jean.equippedWeaponId).toBe(wId);
  });

  it('50. BatchAddWeaponModal Confirm produces appropriately grouped activity via batchAddWeapons', () => {
    // First-class batchAddWeapons method adds 2 weapons with config and assignments
    const newIds = store.getState().batchAddWeapons(
      [
        {
          weaponName: 'Favonius Sword',
          config: { currentLevel: 50, currentAscension: 3 },
        },
        {
          weaponName: 'Sacrificial Sword',
          config: { currentLevel: 60, currentAscension: 4 },
        },
      ],
      'armory_modal'
    );

    expect(newIds).toHaveLength(2);
    const batchEvents = getActivityEvents();
    expect(batchEvents).toHaveLength(1);
    expect(batchEvents[0].action).toBe('weapons_batch_added');
    expect(batchEvents[0].source).toBe('armory_modal');
    expect((batchEvents[0].metadata as any).addedCount).toBe(2);
    expect((batchEvents[0].metadata as any).weaponsCreated).toBe(2);
    expect((batchEvents[0].metadata as any).weaponIds).toEqual(newIds);
    expect(validateActivityEvent(batchEvents[0]).isValid).toBe(true);

    // Verify both weapons have distinct instance UUIDs and levels in armory
    const armory = store.getState().trackedWeapons;
    expect(armory.find((w: any) => w.id === newIds[0])?.level).toBe(50);
    expect(armory.find((w: any) => w.id === newIds[1])?.level).toBe(60);
  });

  it('51. Cross-entity assignment consequences are accurately described', () => {
    // Add characters to roster first
    store.getState().addCharacter('Bennett');
    store.getState().addCharacter('Xingqiu');
    // Bennett holds Favonius Sword
    const favId = store
      .getState()
      .addTrackedWeapon('Favonius Sword', 'Bennett');
    // Xingqiu holds Sacrificial Sword
    const sacId = store
      .getState()
      .addTrackedWeapon('Sacrificial Sword', 'Xingqiu');
    clearActivityHistory();

    // Steal Favonius Sword from Bennett and assign it to Xingqiu
    store.getState().assignWeaponToCharacter(favId, 'Xingqiu', 'weapons_table');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.action).toBe('weapon_assigned');
    expect(event.entityId).toBe(favId);
    expect((event.metadata as any).previousOwner).toBe('Bennett');
    expect((event.metadata as any).newOwner).toBe('Xingqiu');
    expect((event.metadata as any).replacedWeaponId).toBe(sacId);

    // Authoritative store state
    const roster = store.getState().roster;
    expect(roster.Bennett.equippedWeaponId).toBeNull();
    expect(roster.Xingqiu.equippedWeaponId).toBe(favId);

    const armory = store.getState().trackedWeapons;
    expect(armory.find((w: any) => w.id === favId).assignedTo).toBe('Xingqiu');
    expect(armory.find((w: any) => w.id === sacId).assignedTo).toBeNull();
  });

  it('52. No-op and rejected operations remain silent', () => {
    store.getState().addCharacter('Razor');
    const wId = store.getState().addTrackedWeapon('Favonius Sword', 'Razor');
    store.getState().setAchievementCompleted('80091', true);
    clearActivityHistory();

    // 1. Character draft identical to store
    store.getState().saveCharacterDraft('Razor', {
      level: 1,
      ascension: 0,
      targetLevel: 90,
      targetAscension: 6,
      talents: { normal: 1, skill: 1, burst: 1 },
      targetTalents: { normal: 10, skill: 10, burst: 10 },
      weaponId: wId,
    });
    expect(getActivityEvents()).toHaveLength(0);

    // 2. Weapon update identical to store
    store.getState().updateTrackedWeapon(wId, { level: 1, ascension: 0 });
    expect(getActivityEvents()).toHaveLength(0);

    // 3. Assigning weapon to current owner
    store.getState().assignWeaponToCharacter(wId, 'Razor');
    expect(getActivityEvents()).toHaveLength(0);

    // 4. Marking already completed achievement complete
    store.getState().setAchievementCompleted('80091', true);
    expect(getActivityEvents()).toHaveLength(0);

    // 5. Settings progress import with no trigger
    store.getState().setAchievementProgress({
      '80091': { completed: true, completedAt: '2026-11-12T00:00:00.000Z' },
    });
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('53. Logging failure does not change domain outcomes', () => {
    // Spy on appendEvent and force it to throw
    const appendSpy = vi
      .spyOn(useActivityStore.getState(), 'appendEvent')
      .mockImplementation(() => {
        throw new Error('Fatal storage failure');
      });

    // 1. Character add succeeds
    store.getState().addCharacter('Collei');
    expect(store.getState().roster.Collei).toBeDefined();

    // 2. Weapon add succeeds
    const wId = store.getState().addTrackedWeapon('The Stringless', 'Collei');
    expect(wId).toBeDefined();
    expect(store.getState().trackedWeapons.some((w: any) => w.id === wId)).toBe(
      true
    );
    expect(store.getState().roster.Collei.equippedWeaponId).toBe(wId);

    // 3. Achievement complete succeeds
    store.getState().setAchievementCompleted('80091', true);
    expect(store.getState().achievementProgress['80091']?.completed).toBe(true);

    appendSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PHASE A4.2 FINAL WORKFLOW GROUPING & INTEGRITY (Tests 54–67)
  // ─────────────────────────────────────────────────────────────────────────

  it('54. AddCharacterModal with one character and no weapon produces exactly one event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(React.createElement(AddCharacterModal, { onClose }));
    });

    const searchInput = document.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;
    act(() => {
      searchInput.value = 'Razor';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const grid = document.querySelector('.grid') as HTMLElement;
    const razorBtn = Array.from(grid.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Razor')
    );
    act(() => {
      razorBtn?.click();
    });

    const nextBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next: Configure')
    );
    act(() => {
      nextBtn?.click();
    });

    const confirmBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Confirm & Add')
    );
    act(() => {
      confirmBtn?.click();
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('character_added');
    expect(events[0].entityId).toBe('Razor');
    expect(events[0].source).toBe('character_modal');
    expect((events[0].metadata as any).charactersAdded).toBe(1);
    expect((events[0].metadata as any).weaponsCreated).toBe(0);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);

    expect(store.getState().roster.Razor).toBeDefined();
    expect(store.getState().roster.Razor.level).toBe(1);
    expect((events[0].metadata as any).talents).toEqual(
      store.getState().roster.Razor.talents
    );
    expect((events[0].metadata as any).targetTalents).toEqual(
      store.getState().roster.Razor.targetTalents
    );
    expect((events[0].metadata as any).talents).toEqual({
      normal: 1,
      skill: 1,
      burst: 1,
    });
    expect((events[0].metadata as any).targetTalents).toEqual({
      normal: 10,
      skill: 10,
      burst: 10,
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('55. AddCharacterModal with one character and one weapon produces one grouped event', () => {
    // 1 character with 1 assigned weapon
    const names = ['Jean'];
    const prevRoster = store.getState().roster;

    // Direct modal confirm workflow
    store.getState().batchAddCharacters(
      names,
      {
        level: 80,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
      { source: 'character_modal', batchGroup: true }
    );

    const wId = store
      .getState()
      .addTrackedWeapon(
        'Aquila Favonia',
        'Jean',
        {},
        { source: 'character_modal', batchGroup: true }
      );

    // Suppressed intermediate events check
    expect(getActivityEvents()).toHaveLength(0);

    // Modal records single grouped event
    recordActivity({
      category: 'characters',
      action: 'characters_batch_added',
      source: 'character_modal',
      entityType: 'character',
      entityId: 'Jean',
      summary: 'Added Jean and assigned Aquila Favonia.',
      changes: [],
      metadata: {
        charactersAdded: 1,
        weaponsCreated: 1,
        characterNames: names,
        weaponAssignments: [
          {
            weaponId: wId,
            weaponName: 'Aquila Favonia',
            assignedTo: 'Jean',
          },
        ],
        initialLevel: 80,
        initialAscension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('characters_batch_added');
    expect(events[0].summary).toBe('Added Jean and assigned Aquila Favonia.');
    expect((events[0].metadata as any).charactersAdded).toBe(1);
    expect((events[0].metadata as any).weaponsCreated).toBe(1);
    expect((events[0].metadata as any).weaponAssignments[0].weaponId).toBe(wId);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('56. AddCharacterModal with three characters and three weapons produces one grouped event', () => {
    const names = ['Amber', 'Kaeya', 'Lisa'];

    store.getState().batchAddCharacters(
      names,
      {
        level: 70,
        ascension: 4,
        targetLevel: 90,
        targetAscension: 6,
        talents: { normal: 6, skill: 6, burst: 6 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
      { source: 'character_modal', batchGroup: true }
    );

    const w1 = store
      .getState()
      .addTrackedWeapon(
        'Favonius Warbow',
        'Amber',
        {},
        { source: 'character_modal', batchGroup: true }
      );
    const w2 = store
      .getState()
      .addTrackedWeapon(
        'Cool Steel',
        'Kaeya',
        {},
        { source: 'character_modal', batchGroup: true }
      );
    const w3 = store
      .getState()
      .addTrackedWeapon(
        'Magic Guide',
        'Lisa',
        {},
        { source: 'character_modal', batchGroup: true }
      );

    // Intermediate calls are silent
    expect(getActivityEvents()).toHaveLength(0);

    // Modal records single grouped event
    recordActivity({
      category: 'characters',
      action: 'characters_batch_added',
      source: 'character_modal',
      entityType: 'character',
      entityId: 'batch_characters',
      summary: 'Added 3 characters and assigned 3 weapons.',
      changes: [],
      metadata: {
        charactersAdded: 3,
        weaponsCreated: 3,
        characterNames: names,
        weaponAssignments: [
          { weaponId: w1, weaponName: 'Favonius Warbow', assignedTo: 'Amber' },
          { weaponId: w2, weaponName: 'Cool Steel', assignedTo: 'Kaeya' },
          { weaponId: w3, weaponName: 'Magic Guide', assignedTo: 'Lisa' },
        ],
        initialLevel: 70,
        initialAscension: 4,
        targetLevel: 90,
        targetAscension: 6,
      },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('characters_batch_added');
    expect(events[0].summary).toBe(
      'Added 3 characters and assigned 3 weapons.'
    );
    expect((events[0].metadata as any).charactersAdded).toBe(3);
    expect((events[0].metadata as any).weaponsCreated).toBe(3);
    expect((events[0].metadata as any).weaponAssignments).toHaveLength(3);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('57. Saved character progression matches submitted values', () => {
    store.getState().batchAddCharacters(
      ['Amber'],
      {
        level: 70,
        ascension: 4,
        targetLevel: 90,
        targetAscension: 6,
        talents: { normal: 6, skill: 6, burst: 6 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
      { source: 'character_modal', batchGroup: true }
    );
    const roster = store.getState().roster;
    expect(roster.Amber.level).toBe(70);
    expect(roster.Amber.ascension).toBe(4);
    expect(roster.Amber.targetLevel).toBe(90);
    expect(roster.Amber.targetAscension).toBe(6);
    expect(roster.Amber.talents).toEqual({ normal: 6, skill: 6, burst: 6 });
    expect(roster.Amber.targetTalents).toEqual({
      normal: 10,
      skill: 10,
      burst: 10,
    });

    recordActivity({
      category: 'characters',
      action: 'character_added',
      source: 'character_modal',
      entityId: 'Amber',
      summary: 'Added Amber to the character roster.',
      changes: [],
      metadata: {
        charactersAdded: 1,
        weaponsCreated: 0,
        characterNames: ['Amber'],
        weaponAssignments: [],
        initialLevel: 70,
        initialAscension: 4,
        targetLevel: 90,
        targetAscension: 6,
        talents: roster.Amber.talents,
        targetTalents: roster.Amber.targetTalents,
      },
    });
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect((events[0].metadata as any).talents).toEqual(roster.Amber.talents);
    expect((events[0].metadata as any).targetTalents).toEqual(
      roster.Amber.targetTalents
    );
    expect((events[0].metadata as any).talents).toEqual({
      normal: 6,
      skill: 6,
      burst: 6,
    });
    expect((events[0].metadata as any).targetTalents).toEqual({
      normal: 10,
      skill: 10,
      burst: 10,
    });
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('58. Generated weapon UUIDs and assignments are correct', () => {
    store.getState().addCharacter('Amber');
    const wId = store.getState().addTrackedWeapon('Favonius Warbow', 'Amber');
    const roster = store.getState().roster;
    const armory = store.getState().trackedWeapons;

    const amberWeaponId = roster.Amber.equippedWeaponId;
    expect(isValidUUID(amberWeaponId)).toBe(true);
    expect(amberWeaponId).toBe(wId);

    const amberWeapon = armory.find((w: any) => w.id === amberWeaponId);
    expect(amberWeapon).toBeDefined();
    expect(amberWeapon.weaponName).toBe('Favonius Warbow');
    expect(amberWeapon.assignedTo).toBe('Amber');
  });

  it('59. No intermediate character or weapon events appear in modal workflows', () => {
    clearActivityHistory();

    // Re-run batch add with batchGroup: true
    store
      .getState()
      .batchAddCharacters(
        ['Sucrose', 'Bennett'],
        { level: 60, ascension: 3 },
        { source: 'character_modal', batchGroup: true }
      );
    store
      .getState()
      .addTrackedWeapon(
        'Sacrificial Fragments',
        'Sucrose',
        {},
        { source: 'character_modal', batchGroup: true }
      );

    // Zero intermediate events
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('60. Existing standalone addTrackedWeapon still records its own event', () => {
    clearActivityHistory();
    const wId = store
      .getState()
      .addTrackedWeapon('Favonius Sword', null, {}, 'weapons_table');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('weapon_added');
    expect(events[0].source).toBe('weapons_table');
    expect(events[0].entityId).toBe(wId);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('61. Existing standalone batchAddCharacters still records its own event', () => {
    clearActivityHistory();
    store
      .getState()
      .batchAddCharacters(['Noelle', 'Barbara'], 'characters_table');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('characters_batch_added');
    expect(events[0].source).toBe('characters_table');
    expect((events[0].metadata as any).addedCount).toBe(2);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('62. BatchAddWeaponModal with multiple weapons produces one grouped event via batchAddWeapons', () => {
    clearActivityHistory();
    const ids = store.getState().batchAddWeapons(
      [
        {
          weaponName: 'Rust',
          config: { currentLevel: 40, currentAscension: 2 },
        },
        {
          weaponName: 'The Stringless',
          config: { currentLevel: 50, currentAscension: 3 },
        },
      ],
      'armory_modal'
    );

    expect(ids).toHaveLength(2);
    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('weapons_batch_added');
    expect(events[0].source).toBe('armory_modal');
    expect((events[0].metadata as any).weaponsCreated).toBe(2);
    expect((events[0].metadata as any).weaponIds).toEqual(ids);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('63. Grouped metadata reflects actual final state without claiming skipped or failed operations succeeded', () => {
    clearActivityHistory();
    // Pre-populate Amber into roster so Amber is skipped and Diona is added
    store.getState().addCharacter('Amber');
    clearActivityHistory();

    const names = ['Amber', 'Diona'];
    const prevRoster = store.getState().roster;

    store
      .getState()
      .batchAddCharacters(
        names,
        { level: 50 },
        { source: 'character_modal', batchGroup: true }
      );

    const currentRoster = store.getState().roster;
    const added = names.filter(
      (n) => !prevRoster[n] && Boolean(currentRoster[n])
    );
    const skipped = names.filter((n) => !added.includes(n));

    expect(added).toEqual(['Diona']);
    expect(skipped).toEqual(['Amber']);

    recordActivity({
      category: 'characters',
      action: 'characters_batch_added',
      source: 'character_modal',
      entityType: 'character',
      entityId: 'batch_characters',
      summary: 'Added 1 character to the roster.',
      changes: [],
      metadata: {
        charactersAdded: added.length,
        weaponsCreated: 0,
        characterNames: added,
        skippedCharacters: skipped,
      },
    });

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    expect((events[0].metadata as any).charactersAdded).toBe(1);
    expect((events[0].metadata as any).characterNames).toEqual(['Diona']);
    expect((events[0].metadata as any).skippedCharacters).toEqual(['Amber']);
    expect(validateActivityEvent(events[0]).isValid).toBe(true);
  });

  it('64. Complete event records pass runtime validation (validateActivityEvent)', () => {
    store.getState().addCharacter('Jean', 'characters_table');
    store
      .getState()
      .addTrackedWeapon('Aquila Favonia', 'Jean', {}, 'weapons_table');
    const events = getActivityEvents();
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      const result = validateActivityEvent(ev);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.event).toBeDefined();
      expect(isValidUUID(result.event?.id)).toBe(true);
      expect(result.event?.schemaVersion).toBe(1);
      expect(result.event?.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    }
  });

  it('65. UUID v4 validation rejects invalid event IDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('12345')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    // Version 3 UUID (must have '4' at position 14)
    expect(isValidUUID('e4f8d21b-60a3-3927-b952-19e34a6c0111')).toBe(false);
    // Invalid variant character (must be [89ab] at position 19)
    expect(isValidUUID('e4f8d21b-60a3-4927-c952-19e34a6c0111')).toBe(false);

    // validateActivityEvent rejects invalid UUID
    const badEvent = {
      id: 'bad-id',
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      category: 'characters',
      action: 'character_added',
      source: 'character_modal',
      summary: 'Test',
    };
    const res = validateActivityEvent(badEvent);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Invalid or missing event ID');
  });

  it('66. No fake unchanged-field differences appear in changes array', () => {
    // Unassigned weapon creation has no changes claiming assignedTo: null -> null
    clearActivityHistory();
    store
      .getState()
      .addTrackedWeapon('Favonius Sword', null, {}, 'weapons_table');

    const events = getActivityEvents();
    expect(events).toHaveLength(1);
    const changes = events[0].changes || [];
    const fakeChange = changes.find(
      (c) => c.field === 'assignedTo' && c.before === null && c.after === null
    );
    expect(fakeChange).toBeUndefined();

    // Direct validateActivityEvent suppresses no-op identical fields
    const testEventWithNoopChange = {
      id: crypto.randomUUID(),
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      category: 'weapons',
      action: 'weapon_updated',
      source: 'weapons_table',
      summary: 'Updated weapon',
      changes: [
        { field: 'level', before: 50, after: 50 },
        { field: 'refinement', before: 1, after: 2 },
      ],
    };
    const validated = validateActivityEvent(testEventWithNoopChange);
    expect(validated.isValid).toBe(true);
    // level: 50 -> 50 was suppressed by validateFieldChange!
    expect(validated.event?.changes).toHaveLength(1);
    expect(validated.event?.changes?.[0].field).toBe('refinement');
  });

  it('67. Logging failure does not interfere with domain mutations', () => {
    const appendSpy = vi
      .spyOn(useActivityStore.getState(), 'appendEvent')
      .mockImplementation(() => {
        throw new Error('Disk quota full');
      });

    // Domain store additions still succeed completely
    store.getState().addCharacter('Klee');
    expect(store.getState().roster.Klee).toBeDefined();

    const wId = store.getState().addTrackedWeapon('Dodoco Tales', 'Klee');
    expect(wId).toBeDefined();
    expect(store.getState().roster.Klee.equippedWeaponId).toBe(wId);

    appendSpy.mockRestore();
  });
});
