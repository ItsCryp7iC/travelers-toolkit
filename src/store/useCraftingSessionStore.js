import { create } from 'zustand';
import {
  createCraftingSession,
  recordCraftingResult,
  undoLastCraftingResult,
  validateCraftingResultInput,
  computeSessionFingerprint,
} from '../utils/craftingSession';
import { getCraftingFamily } from '../data/craftingRecipes';

/**
 * Isolated in-memory store for active crafting sessions.
 *
 * Requirements:
 * - Strictly ephemeral (NO localStorage or IndexedDB persistence).
 * - Only one active material family session at any time.
 * - Does NOT modify or mutate the global saved inventory store.
 * - Survives Planner tab switches and component remounts.
 * - Resets on full browser reload.
 */
const useCraftingSessionStore = create((set, get) => ({
  session: null,
  isDrawerOpen: false,
  pendingReplacement: null, // { familyId, inventory, grossRequirements, bonusType, startingMora }

  /**
   * Starts a crafting session for the given family.
   * If a session already exists for the same family, opens the drawer.
   * If a session exists for a different family and has recorded events, returns requiresConfirmation.
   */
  startSession: ({ familyId, inventory = {}, grossRequirements = {}, bonusType = null, startingMora = 0 }) => {
    const current = get().session;

    if (current && current.snapshot.familyId === familyId) {
      set({ isDrawerOpen: true });
      return { success: true, action: 'resumed' };
    }

    if (current && current.snapshot.familyId !== familyId && current.events.length > 0) {
      set({
        pendingReplacement: {
          familyId,
          inventory,
          grossRequirements,
          bonusType,
          startingMora,
        },
      });
      return {
        success: false,
        requiresConfirmation: true,
        activeFamilyName: current.snapshot.familyName,
        targetFamilyId: familyId,
      };
    }

    const session = createCraftingSession({
      familyId,
      inventory: { ...inventory, Mora: startingMora },
      grossRequirements,
      bonusType,
    });

    set({ session, isDrawerOpen: true, pendingReplacement: null });
    return { success: true, action: 'created' };
  },

  /**
   * Confirms replacing an active session with a new family session.
   */
  confirmReplacement: () => {
    const pending = get().pendingReplacement;
    if (!pending) return { success: false };

    const session = createCraftingSession({
      familyId: pending.familyId,
      inventory: { ...pending.inventory, Mora: pending.startingMora },
      grossRequirements: pending.grossRequirements,
      bonusType: pending.bonusType,
    });

    set({ session, isDrawerOpen: true, pendingReplacement: null });
    return { success: true };
  },

  /**
   * Cancels pending replacement of an active session.
   */
  cancelReplacement: () => {
    set({ pendingReplacement: null });
  },

  /**
   * Opens the drawer without modifying session state.
   */
  openDrawer: () => set({ isDrawerOpen: true }),

  /**
   * Closes the drawer while keeping the session and recorded events intact.
   */
  closeDrawer: () => set({ isDrawerOpen: false }),

  /**
   * Validates a proposed crafting result without recording it.
   */
  validateResult: (input) => {
    const session = get().session;
    if (!session) {
      return { isValid: false, errors: [{ field: 'session', code: 'NO_SESSION', message: 'No active crafting session.' }] };
    }
    return validateCraftingResultInput(session, input);
  },

  /**
   * Records a confirmed crafting result event.
   * Purely delegates to domain engine, replaying the ledger and recalculating plans.
   */
  recordResult: (input) => {
    const session = get().session;
    if (!session) {
      return { success: false, error: 'No active crafting session.' };
    }

    try {
      const nextSession = recordCraftingResult(session, input);
      set({ session: nextSession });
      return { success: true, session: nextSession };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Undoes the most recently recorded crafting batch.
   */
  undoLastBatch: () => {
    const session = get().session;
    if (!session || session.events.length === 0) return;
    const nextSession = undoLastCraftingResult(session);
    set({ session: nextSession });
  },

  /**
   * Destroys the active session and closes the drawer after explicit confirmation.
   */
  discardSession: () => {
    set({ session: null, isDrawerOpen: false, pendingReplacement: null });
  },

  /**
   * Checks if live inventory/demands have diverged from the session's starting snapshot.
   */
  checkIsStale: (liveInventory = {}, liveGrossRequirements = {}, liveMora = 0) => {
    const session = get().session;
    if (!session) return false;
    const family = getCraftingFamily(session.snapshot.familyId);
    if (!family) return false;

    const currentFp = computeSessionFingerprint(
      family,
      liveInventory,
      liveGrossRequirements,
      session.snapshot.bonusType,
      liveMora
    );
    return currentFp !== session.snapshot.fingerprint;
  },
}));

export default useCraftingSessionStore;

