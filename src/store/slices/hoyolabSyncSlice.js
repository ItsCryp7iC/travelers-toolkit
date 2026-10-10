import { applyHoyolabPlanToState, validateHoyolabApplyPlan } from '../../utils/hoyolabSyncApply';

export const createHoyolabSyncSlice = (set, get) => ({
  lastHoyolabCharacterSyncAt: null,
  applyHoyolabSync: (plan) => {
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
    return finalResult;
  }
});
