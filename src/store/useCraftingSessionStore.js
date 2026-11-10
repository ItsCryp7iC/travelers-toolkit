import { create } from 'zustand';
import {
  createCraftingSession,
  recordCraftingResult,
  undoLastCraftingResult,
  validateCraftingResultInput,
  compareCraftingSessionSource,
} from '../utils/craftingSession';

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
  validateResult: (input, liveSource) => {
    const session = get().session;
    if (!session) {
      return { isValid: false, errors: [{ field: 'session', code: 'NO_SESSION', message: 'No active crafting session.' }] };
    }
    return validateCraftingResultInput(session, input, liveSource);
  },

  /**
   * Records a confirmed crafting result event.
   * Purely delegates to domain engine, replaying the ledger and recalculating plans.
   * Action-time check rejects recording when an unreviewed source conflict exists.
   */
  recordResult: (input, liveSource) => {
    const session = get().session;
    if (!session) {
      return { success: false, error: 'No active crafting session.' };
    }

    if (liveSource) {
      const comparison = compareCraftingSessionSource(
        session.snapshot,
        liveSource,
        session.acknowledgedFingerprint
      );
      if (comparison.status === 'conflict_unreviewed') {
        return {
          success: false,
          error:
            'Cannot record result: live inventory or requirements have changed. Please review the conflict before recording.',
          code: 'UNREVIEWED_SOURCE_CONFLICT',
        };
      }
    }

    try {
      const nextSession = recordCraftingResult(session, input, liveSource);
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
   * Acknowledges a source conflict, allowing the user to continue using the original snapshot.
   */
  acknowledgeConflict: (currentFingerprint) => {
    const session = get().session;
    if (!session) return;
    set({
      session: {
        ...session,
        acknowledgedFingerprint: currentFingerprint,
      },
    });
  },

  /**
   * Restarts the session for the same family and bonus type using fresh live inventory, requirements, and Mora.
   * Clears the event ledger and conflict acknowledgment state.
   */
  restartSession: ({ inventory = {}, grossRequirements = {}, mora = 0 }) => {
    const current = get().session;
    if (!current) return { success: false, error: 'No active session to restart.' };

    const familyId = current.snapshot.familyId;
    const bonusType = current.snapshot.bonusType;

    const session = createCraftingSession({
      familyId,
      inventory: { ...inventory, Mora: mora },
      grossRequirements,
      bonusType,
    });

    set({ session, isDrawerOpen: true, pendingReplacement: null });
    return { success: true, session };
  },

  /**
   * Compares the active session against live sources and returns a structured comparison.
   */
  compareSource: (liveSource) => {
    const session = get().session;
    if (!session) return null;
    return compareCraftingSessionSource(
      session.snapshot,
      liveSource,
      session.acknowledgedFingerprint
    );
  },

  /**
   * Destroys the active session and closes the drawer after explicit confirmation.
   */
  discardSession: () => {
    set({ session: null, isDrawerOpen: false, pendingReplacement: null });
  },

  /**
   * Checks if live inventory/demands have diverged from the session's starting snapshot.
   * Retained for backward compatibility.
   */
  checkIsStale: (liveInventory = {}, liveGrossRequirements = {}, liveMora = 0) => {
    const session = get().session;
    if (!session) return false;
    const comparison = compareCraftingSessionSource(
      session.snapshot,
      { inventory: liveInventory, grossRequirements: liveGrossRequirements, mora: liveMora },
      session.acknowledgedFingerprint
    );
    return comparison.hasConflict;
  },
}));

export default useCraftingSessionStore;

