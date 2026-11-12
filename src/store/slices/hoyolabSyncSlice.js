import { applyHoyolabPlanToState, validateHoyolabApplyPlan } from '../../utils/hoyolabSyncApply';
import { recordActivity, VALID_SOURCES } from '../../activity';

function resolveSyncSource(contextArg) {
  if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
    return contextArg;
  }
  if (typeof contextArg === 'object' && contextArg !== null) {
    if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
      return contextArg.source;
    }
  }
  return 'hoyolab_character_sync';
}

export const createHoyolabSyncSlice = (set, _get) => ({
  lastHoyolabCharacterSyncAt: null,
  applyHoyolabSync: (plan, contextArg = 'hoyolab_character_sync') => {
    let finalResult = null;
    let errorToThrow = null;

    set((state) => {
      // Validates precisely against the state inside the transactional set() lock
      const validation = validateHoyolabApplyPlan(plan, state);
      if (!validation.valid) {
        errorToThrow = new Error(validation.reason || 'Apply plan validation failed.');
        return state; // No-op, aborts transaction cleanly
      }

      const { roster, trackedWeapons, result } = applyHoyolabPlanToState({
        roster: state.roster,
        trackedWeapons: state.trackedWeapons,
        plan,
        uuidFactory: () => crypto.randomUUID()
      });

      finalResult = result;
      return { roster, trackedWeapons, lastHoyolabCharacterSyncAt: Date.now() };
    });

    if (errorToThrow) throw errorToThrow;

    // Log outside set()
    if (finalResult) {
      const totalChanges =
        (finalResult.charactersAdded || 0) +
        (finalResult.charactersUpdated || 0) +
        (finalResult.weaponsCreated || 0) +
        (finalResult.weaponsUpdatedOrReassigned || 0) +
        (finalResult.travelerVariantsAdded || 0);

      if (totalChanges > 0) {
        try {
          const validSource = resolveSyncSource(contextArg);
          const totalChars = (finalResult.charactersAdded || 0) + (finalResult.charactersUpdated || 0);
          const totalWeapons = (finalResult.weaponsCreated || 0) + (finalResult.weaponsUpdatedOrReassigned || 0);

          recordActivity({
            category: 'import_sync',
            action: 'hoyolab_character_sync_applied',
            source: validSource,
            entityType: 'sync_session',
            entityId: 'hoyolab_sync',
            summary: `Synced with HoYoLAB: ${totalChars} character(s) and ${totalWeapons} weapon(s) updated.`,
            changes: [],
            metadata: {
              charactersAdded: finalResult.charactersAdded || 0,
              charactersUpdated: finalResult.charactersUpdated || 0,
              characterFieldsUpdated: finalResult.characterFieldsUpdated || 0,
              weaponsCreated: finalResult.weaponsCreated || 0,
              weaponsUpdated: finalResult.weaponsUpdatedOrReassigned || 0,
              travelerVariantsAdded: finalResult.travelerVariantsAdded || 0,
              skipped: finalResult.skipped || 0,
            },
          });
        } catch (err) {
          console.error('[HoYoLAB Sync] Failed to record activity:', err);
        }
      }
    }

    return finalResult;
  }
});
