import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import useStore from '../../store/useStore';
import {
  prepareCraftingInventoryTransaction,
  validateCraftingInventoryTransaction,
} from '../../utils/craftingInventoryTransaction';
import { calculateAuthoritativeGrossRequirements } from '../../utils/aggregator';
import { acquireBodyScrollLock } from '../../utils/scrollLock';
import { formatItemName } from '../../utils/calculator';
import { formatPlannerQuantity } from '../../utils/plannerTabs';
import { getMaterialIcon } from '../../utils/assetHelper';
import GenshinImage from '../GenshinImage';

/**
 * Maps transaction error codes to clear, user-facing explanations.
 */
function getRejectionDisplay(code, rawMessage) {
  switch (code) {
    case 'SOURCE_CONFLICT':
      return {
        title: 'Inventory has changed',
        description:
          'Your saved material quantities no longer match this session. Nothing was applied.',
      };
    case 'STORAGE_SOURCE_MISMATCH':
      return {
        title: 'Saved data changed in another window',
        description:
          'Your saved data changed in another window or tab. Nothing was applied. Refresh your data before continuing.',
      };
    case 'STORAGE_READ_ERROR':
      return {
        title: 'Persistent storage unavailable',
        description:
          'Persistent storage could not be accessed in this browser. Nothing was applied.',
      };
    case 'DELTA_MISMATCH':
    case 'DELTA_KEYS_MISMATCH':
    case 'DELTA_VALUE_MISMATCH':
    case 'STARTING_BALANCES_MISMATCH':
    case 'ENDING_BALANCES_MISMATCH':
    case 'TRANSACTION_ID_MISMATCH':
    case 'SESSION_ID_MISMATCH':
    case 'FAMILY_ID_MISMATCH':
    case 'LEDGER_FINGERPRINT_MISMATCH':
    case 'EVENT_IDS_MISMATCH':
    case 'OPERATIONS_MISMATCH':
    case 'BATCHES_MISMATCH':
    case 'MORA_SPENT_MISMATCH':
      return {
        title: 'Transaction data mismatch',
        description:
          'The submitted transaction details do not match the canonical crafting ledger. Nothing was applied.',
      };
    case 'DUPLICATE_TRANSACTION':
      return {
        title: 'Transaction already applied',
        description: 'These crafting results have already been processed.',
      };
    case 'INSUFFICIENT_MORA':
      return {
        title: 'Not enough Mora',
        description: 'Your current Mora balance cannot cover the recorded crafting fees.',
      };
    case 'INSUFFICIENT_INGREDIENTS':
      return {
        title: 'Not enough ingredients',
        description:
          'Your current saved inventory does not have enough materials to apply this change.',
      };
    case 'CONTINUED_SOURCE_CONFLICT':
    case 'UNREVIEWED_SOURCE_CONFLICT':
      return {
        title: 'Stale session snapshot',
        description:
          'These results cannot be applied automatically because your saved inventory changed during this session.',
      };
    case 'STALE_PREVIEW':
      return {
        title: 'Preview is outdated',
        description:
          'Saved inventory or requirements changed since this preview was generated. Nothing was applied.',
      };
    default:
      return {
        title: 'Could Not Apply Crafting Results',
        description: rawMessage || 'The transaction could not be applied to your inventory.',
      };
  }
}

/**
 * ApplyCraftingResultsModal
 *
 * Portal-based modal dialog for reviewing and confirming the application
 * of confirmed crafting assistant events to persistent inventory.
 */
export default function ApplyCraftingResultsModal({ isOpen, onClose }) {
  const session = useCraftingSessionStore((s) => s.session);
  const discardSession = useCraftingSessionStore((s) => s.discardSession);
  const closeDrawer = useCraftingSessionStore((s) => s.closeDrawer);

  const liveInventory = useStore((s) => s.inventory || {});
  const liveRoster = useStore((s) => s.roster || {});
  const liveTrackedWeapons = useStore((s) => s.trackedWeapons || []);
  const liveGoals = useStore((s) => s.goals);
  const liveMora = useStore((s) => s.inventory?.['Mora'] ?? 0);
  const applyCraftingTransaction = useStore((s) => s.applyCraftingTransaction);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [showAllMaterials, setShowAllMaterials] = useState(false);

  const modalRef = useRef(null);
  const lastSessionRef = useRef(session);
  if (session) {
    lastSessionRef.current = session;
  }
  const activeSession = session || (outcome ? lastSessionRef.current : null);

  const liveGrossRequirements = useMemo(
    () =>
      calculateAuthoritativeGrossRequirements({
        roster: liveRoster,
        trackedWeapons: liveTrackedWeapons,
        goals: liveGoals,
      }),
    [liveRoster, liveTrackedWeapons, liveGoals]
  );

  // Authoritative live source
  const liveSource = useMemo(
    () => ({
      inventory: liveInventory,
      grossRequirements: liveGrossRequirements,
      mora: liveMora,
    }),
    [liveInventory, liveGrossRequirements, liveMora]
  );

  // Pure transaction preparation & preview
  const prepResult = useMemo(() => {
    const s = activeSession;
    if (!s || !s.events || s.events.length === 0) return null;
    return prepareCraftingInventoryTransaction(s, liveSource);
  }, [activeSession, liveSource]);

  const handleClose = useCallback(() => {
    if (outcome?.status === 'applied') {
      discardSession();
    }
    onClose();
  }, [outcome?.status, discardSession, onClose]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      setOutcome(null);
      setIsSubmitting(false);
      setShowAllMaterials(false);
      return;
    }

    const releaseScrollLock = acquireBodyScrollLock();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!isSubmitting) {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen || (!activeSession && !outcome)) return null;

  const preview = prepResult?.preview;
  const isStaleSession =
    prepResult?.errors?.some(
      (e) =>
        e.code === 'CONTINUED_SOURCE_CONFLICT' ||
        e.code === 'UNREVIEWED_SOURCE_CONFLICT' ||
        e.code === 'SOURCE_CONFLICT'
    ) ?? false;

  const canConfirm =
    !isSubmitting &&
    prepResult?.isPrepared &&
    prepResult?.transaction &&
    preview?.canApply &&
    !isStaleSession &&
    outcome === null;

  // Confirm and apply action
  const handleConfirm = () => {
    if (isSubmitting || !canConfirm) return;

    // 1. Authoritative reads at execution time
    const currentSession = useCraftingSessionStore.getState().session;
    if (!currentSession || !currentSession.events || currentSession.events.length === 0) {
      setOutcome({
        status: 'rejected',
        code: 'NO_SESSION',
        message: 'No active crafting session with recorded events.',
      });
      return;
    }

    const currentStore = useStore.getState();
    const authoritativeSource = {
      inventory: currentStore.inventory || {},
      grossRequirements: calculateAuthoritativeGrossRequirements(currentStore),
      mora: currentStore.inventory?.['Mora'] ?? 0,
    };

    // 2. Re-prepare authoritatively
    const freshPrep = prepareCraftingInventoryTransaction(currentSession, authoritativeSource);
    if (!freshPrep.isPrepared || !freshPrep.transaction) {
      setOutcome({
        status: 'rejected',
        code: freshPrep.errors[0]?.code || 'PREPARATION_FAILED',
        message: freshPrep.errors[0]?.message || 'Cannot prepare transaction from current state.',
      });
      return;
    }

    // 3. Re-validate preview freshness against current state
    const validation = validateCraftingInventoryTransaction(freshPrep.transaction, authoritativeSource);
    if (!validation.isValid) {
      setOutcome({
        status: 'rejected',
        code: validation.errors[0]?.code || 'STALE_PREVIEW',
        message: validation.errors[0]?.message || 'Preview is stale. Inventory has changed.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 4. Execute atomic store action
      const applyResult = applyCraftingTransaction(freshPrep.transaction, currentSession);

      if (applyResult.status === 'applied') {
        setOutcome({
          status: 'applied',
          transactionId: applyResult.transactionId,
          batchesCount: freshPrep.transaction.totalBatches,
          totalOperations: freshPrep.transaction.totalOperations,
          appliedChanges: freshPrep.preview?.materialChanges || [],
          appliedMora: freshPrep.preview?.moraChange,
          familyName: freshPrep.preview?.familyName,
        });
      } else if (applyResult.status === 'rejected') {
        setOutcome({
          status: 'rejected',
          code: applyResult.code,
          message: applyResult.message,
        });
      } else if (applyResult.status === 'uncertain') {
        setOutcome({
          status: 'uncertain',
          code: applyResult.code,
          message: applyResult.message,
          transactionId: applyResult.transactionId,
        });
      }
    } catch (err) {
      setOutcome({
        status: 'uncertain',
        code: 'PERSISTENCE_FAILURE',
        message: err?.message || 'Storage operation failed unexpectedly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    discardSession();
    onClose();
    closeDrawer();
  };

  const displayedMaterials = showAllMaterials
    ? preview?.allMaterialChanges || []
    : preview?.materialChanges || [];

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in text-[var(--text)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-modal-title"
      data-testid="apply-crafting-results-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg md:max-w-xl bg-[var(--elevated)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* ── Scenario 1: Success Receipt ── */}
        {outcome?.status === 'applied' && (
          <div className="p-6 space-y-5 text-center" data-testid="apply-success-view">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl flex items-center justify-center mx-auto border border-emerald-500/30">
              ✓
            </div>
            <div>
              <h3 id="apply-modal-title" className="text-lg sm:text-xl font-bold text-white">
                Crafting results saved!
              </h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                Your inventory has been updated with{' '}
                <b className="text-white">
                  {outcome.batchesCount} recorded {outcome.batchesCount === 1 ? 'batch' : 'batches'}
                </b>{' '}
                ({outcome.totalOperations.toLocaleString()} operations) for {outcome.familyName}.
              </p>
            </div>

            {/* Applied Summary Cards */}
            <div className="p-4 rounded-xl bg-black/30 border border-white/5 text-left space-y-2.5 max-h-56 overflow-y-auto">
              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block">
                Applied Changes
              </span>
              {outcome.appliedChanges.map((change) => (
                <div
                  key={change.itemId}
                  className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0"
                >
                  <span className="text-gray-200 font-medium truncate">
                    {formatItemName(change.itemName)}
                  </span>
                  <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                    <span
                      className={`font-bold ${
                        change.change > 0 ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {change.change > 0
                        ? `▲ +${change.change.toLocaleString()}`
                        : `▼ ${change.change.toLocaleString()}`}
                    </span>
                    <span className="text-[var(--muted)] text-[11px]">
                      → {change.after.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              {outcome.appliedMora && outcome.appliedMora.change !== 0 && (
                <div className="flex items-center justify-between text-xs py-1 border-t border-white/10 pt-2 font-mono">
                  <span className="text-amber-200 font-medium">Mora Spent</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-amber-300 font-bold">
                      ▼ -{Math.abs(outcome.appliedMora.change).toLocaleString()}
                    </span>
                    <span className="text-[var(--muted)] text-[11px]">
                      → {outcome.appliedMora.after.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                id="done-apply-results-btn"
                data-testid="done-apply-results-btn"
                onClick={handleDone}
                className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── Scenario 2: Rejection View ── */}
        {outcome?.status === 'rejected' && (
          <div className="p-6 space-y-4" data-testid="apply-rejection-view">
            <div className="flex items-start gap-3.5">
              <span className="text-3xl shrink-0">⚠️</span>
              <div>
                <h3 id="apply-modal-title" className="text-base sm:text-lg font-bold text-red-400">
                  {getRejectionDisplay(outcome.code, outcome.message).title}
                </h3>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  {getRejectionDisplay(outcome.code, outcome.message).description}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-1">
              <p className="font-semibold">Your temporary session is still intact.</p>
              <p className="text-[11px] text-gray-400">
                You can review your recorded history, undo the last batch, or restart with your current
                inventory.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="close-rejection-btn"
                data-testid="close-rejection-btn"
                onClick={() => setOutcome(null)}
                className="genshin-btn px-6 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Scenario 3: Uncertain Persistence View ── */}
        {outcome?.status === 'uncertain' && (
          <div className="p-6 space-y-4" data-testid="apply-uncertain-view">
            <div className="flex items-start gap-3.5">
              <span className="text-3xl shrink-0">❓</span>
              <div>
                <h3 id="apply-modal-title" className="text-base sm:text-lg font-bold text-amber-400">
                  Inventory save could not be confirmed
                </h3>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Your inventory may have changed, but the save could not be verified. Check your
                  inventory before attempting anything else.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 space-y-1 font-mono">
              <p className="text-[11px]">
                Diagnostic details: {outcome.message}
              </p>
              {outcome.transactionId && (
                <p className="text-[10px] text-gray-400">ID: {outcome.transactionId}</p>
              )}
            </div>

            <p className="text-[11px] text-gray-400 italic">
              Your crafting session has not been cleared to allow manual verification.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="close-uncertain-btn"
                data-testid="close-uncertain-btn"
                onClick={() => setOutcome(null)}
                className="genshin-btn-ghost px-6 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Scenario 4: Standard Review & Confirmation Form ── */}
        {outcome === null && (
          <>
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] bg-gradient-to-r from-amber-500/10 via-[var(--surface)] to-[var(--elevated)] shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="apply-modal-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>🔨</span> Apply Crafting Results
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Review the materials and Mora that will change in your saved inventory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-gray-400 hover:text-white p-1 rounded-lg text-sm cursor-pointer"
                  title="Close review"
                >
                  ✕
                </button>
              </div>

              {/* Summary Strip */}
              {preview && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                      Family
                    </span>
                    <span className="font-bold text-gray-200 truncate block">
                      {preview.familyName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                      Batches
                    </span>
                    <span className="font-bold text-gray-200">{preview.totalBatches}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                      Operations
                    </span>
                    <span className="font-bold text-gray-200">
                      {preview.totalOperations.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                      Total Fee
                    </span>
                    <span className="font-bold text-amber-300">
                      {formatPlannerQuantity(preview.totalMoraSpent)} Mora
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body: Diff Table */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {isStaleSession && (
                <div
                  className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1"
                  data-testid="apply-stale-warning"
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Cannot Apply Outdated Results
                  </p>
                  <p className="text-gray-300">
                    These results cannot be applied automatically because your saved inventory changed
                    during this session.
                  </p>
                </div>
              )}

              {preview?.blockingReasons && preview.blockingReasons.length > 0 && !isStaleSession && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 space-y-1">
                  <p className="font-bold">Cannot Apply Transaction:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {preview.blockingReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-black/20">
                <table className="w-full text-xs" data-testid="apply-diff-table">
                  <thead>
                    <tr className="border-b border-white/10 text-[var(--muted)] text-[11px] bg-black/30">
                      <th className="text-left py-2.5 px-3 font-semibold">Material</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Saved Now</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Change</th>
                      <th className="text-right py-2.5 px-3 font-semibold">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayedMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-[var(--muted)] text-xs">
                          No material quantity changes recorded.
                        </td>
                      </tr>
                    ) : (
                      displayedMaterials.map((item) => (
                        <tr
                          key={item.itemId}
                          className="hover:bg-white/[0.02] transition-colors"
                          data-testid={`apply-row-${item.itemId}`}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded bg-black/40 border border-white/5 flex items-center justify-center p-0.5 shrink-0">
                                <GenshinImage
                                  src={getMaterialIcon(item.itemName, activeSession?.snapshot?.category)}
                                  alt={formatItemName(item.itemName)}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <span className="font-semibold text-gray-200 truncate">
                                {formatItemName(item.itemName)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-300">
                            {item.savedNow.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {item.change > 0 ? (
                              <span className="text-emerald-400">
                                ▲ +{item.change.toLocaleString()}
                              </span>
                            ) : item.change < 0 ? (
                              <span className="text-amber-300">
                                ▼ {item.change.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-500">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                            {item.after.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Mora Change Row */}
                    {preview?.moraChange && (preview.moraChange.change !== 0 || preview.totalMoraSpent > 0) && (
                      <tr
                        className="bg-black/30 font-semibold border-t border-white/10"
                        data-testid="apply-row-mora"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🪙</span>
                            <span className="text-amber-200">Mora</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                          {preview.moraChange.savedNow.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300">
                          ▼ {preview.moraChange.change.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {preview.moraChange.after.toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Toggle to show unchanged items */}
              {preview?.allMaterialChanges &&
                preview.allMaterialChanges.length > preview.materialChanges.length && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAllMaterials((prev) => !prev)}
                      className="text-[11px] text-[var(--muted)] hover:text-white underline cursor-pointer"
                    >
                      {showAllMaterials
                        ? 'Hide unchanged materials'
                        : `Show all ${preview.familyName} materials (${preview.allMaterialChanges.length})`}
                    </button>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                id="cancel-apply-results-btn"
                data-testid="cancel-apply-results-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto genshin-btn-ghost px-5 py-2.5 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-apply-results-btn"
                data-testid="confirm-apply-results-btn"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  canConfirm
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-gray-700/50 text-gray-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                <span>{isSubmitting ? 'Saving to Inventory...' : 'Confirm Inventory Update'}</span>
                {!isSubmitting && canConfirm && <span>✓</span>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
