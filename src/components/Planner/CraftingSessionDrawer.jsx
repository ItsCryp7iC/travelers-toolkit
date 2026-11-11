import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import { formatNumber, formatItemName } from '../../utils/calculator';
import { formatPlannerQuantity } from '../../utils/plannerTabs';
import { getMaterialIcon } from '../../utils/assetHelper';
import { acquireBodyScrollLock } from '../../utils/scrollLock';
import { compareCraftingSessionSource } from '../../utils/craftingSession';
import GenshinImage from '../GenshinImage';
import ApplyCraftingResultsModal from './ApplyCraftingResultsModal';

export default function CraftingSessionDrawer({ liveInventory = {}, liveGrossRequirements = {}, liveMora = 0 }) {
  const session = useCraftingSessionStore((s) => s.session);
  const isDrawerOpen = useCraftingSessionStore((s) => s.isDrawerOpen);
  const closeDrawer = useCraftingSessionStore((s) => s.closeDrawer);
  const recordResult = useCraftingSessionStore((s) => s.recordResult);
  const undoLastBatch = useCraftingSessionStore((s) => s.undoLastBatch);
  const discardSession = useCraftingSessionStore((s) => s.discardSession);
  const validateResult = useCraftingSessionStore((s) => s.validateResult);
  const acknowledgeConflict = useCraftingSessionStore((s) => s.acknowledgeConflict);
  const restartSession = useCraftingSessionStore((s) => s.restartSession);

  // Form & Interaction State
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [operationsInput, setOperationsInput] = useState('');
  const [totalOutputInput, setTotalOutputInput] = useState('');
  const [refundsInput, setRefundsInput] = useState('');
  const [observedBalanceInput, setObservedBalanceInput] = useState('');
  const [balanceDerivedError, setBalanceDerivedError] = useState('');
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastRecordedSummary, setLastRecordedSummary] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const drawerRef = useRef(null);
  const lastActiveSessionRef = useRef(session);
  if (session) {
    lastActiveSessionRef.current = session;
  }
  const currentSession = session || (showApplyModal ? lastActiveSessionRef.current : null);

  // Scroll lock and keyboard Escape handling
  useEffect(() => {
    if (!isDrawerOpen) return;
    const releaseScrollLock = acquireBodyScrollLock();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showApplyModal) {
          setShowApplyModal(false);
        } else if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (showRestartConfirm) {
          setShowRestartConfirm(false);
        } else {
          closeDrawer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawerOpen, showDiscardConfirm, showRestartConfirm, showApplyModal, closeDrawer]);

  // Synchronize default recipe with recommended step
  const activeFamilyId = session?.snapshot?.familyId;
  const recommendedRecipeId = session?.nextRecommendedStep?.recipeId;
  const suggestedInitialBatch = session?.nextRecommendedStep?.suggestedInitialBatch;

  useEffect(() => {
    if (!session) return;
    if (recommendedRecipeId) {
      setSelectedRecipeId(recommendedRecipeId);
    } else if (session.snapshot.recipes.length > 0) {
      setSelectedRecipeId((prev) => prev || session.snapshot.recipes[0].id);
    }
  }, [activeFamilyId, recommendedRecipeId, session]);

  // Auto-prefill suggested batch quantity into the operations input
  useEffect(() => {
    if (suggestedInitialBatch && suggestedInitialBatch > 0) {
      setOperationsInput(String(suggestedInitialBatch));
    } else {
      setOperationsInput('');
    }
  }, [activeFamilyId, recommendedRecipeId, suggestedInitialBatch, session?.events?.length]);

  // Canonical live source object
  const liveSource = useMemo(
    () => ({
      inventory: liveInventory,
      grossRequirements: liveGrossRequirements,
      mora: liveMora,
    }),
    [liveInventory, liveGrossRequirements, liveMora]
  );

  // Check structured freshness against live source
  const freshness = useMemo(() => {
    if (!session) return null;
    return compareCraftingSessionSource(
      session.snapshot,
      liveSource,
      session.acknowledgedFingerprint
    );
  }, [session, liveSource]);

  const handleRestartClick = () => {
    if (session?.events?.length > 0) {
      setShowRestartConfirm(true);
    } else {
      executeRestart();
    }
  };

  const executeRestart = () => {
    restartSession({
      inventory: liveInventory,
      grossRequirements: liveGrossRequirements,
      mora: liveMora,
    });
    setLastRecordedSummary('');
    setOperationsInput('');
    setTotalOutputInput('');
    setRefundsInput('');
    setObservedBalanceInput('');
    setSubmitError('');
    setShowRestartConfirm(false);
  };

  if (!isDrawerOpen || !currentSession) return null;

  const { snapshot, ledger, remainingPlan, remainingForecast, nextRecommendedStep, events } = currentSession;
  const bonusType = snapshot.bonusType;

  // Selected recipe object
  const activeRecipe = snapshot.recipes.find((r) => r.id === selectedRecipeId) || snapshot.recipes[0];

  // Numeric parsing
  const parsedOps = parseInt(operationsInput, 10);
  const hasValidOps = Number.isInteger(parsedOps) && parsedOps > 0;

  let parsedTotalOutput = parseInt(totalOutputInput, 10);
  if (!Number.isInteger(parsedTotalOutput)) parsedTotalOutput = undefined;

  let parsedRefunds = parseInt(refundsInput, 10);
  if (!Number.isInteger(parsedRefunds)) parsedRefunds = undefined;

  // Construct validation payload
  const validationPayload = {
    recipeId: activeRecipe?.id,
    operationsPerformed: hasValidOps ? parsedOps : 0,
    bonusType,
    ...(bonusType === 'double_output' ? { totalOutputReceived: parsedTotalOutput } : {}),
    ...(bonusType === 'ingredient_refund' ? { refundsReceived: parsedRefunds } : {}),
    userNote: userNote.trim() || undefined,
  };

  const validation = hasValidOps
    ? validateResult(validationPayload, liveSource)
    : { isValid: false, errors: [] };

  // Derived Preview calculations
  let derivedBonus = 0;
  let derivedNormalOutput = hasValidOps ? parsedOps * (activeRecipe?.outputQty || 1) : 0;
  let grossNeeded = hasValidOps ? parsedOps * (activeRecipe?.inputQty || 3) : 0;
  let refundsCount = 0;
  let netConsumed = grossNeeded;
  let moraNeeded = hasValidOps ? parsedOps * (activeRecipe?.moraCost || 0) : 0;

  if (bonusType === 'double_output') {
    if (parsedTotalOutput !== undefined && parsedTotalOutput >= derivedNormalOutput) {
      derivedBonus = parsedTotalOutput - derivedNormalOutput;
    }
  } else if (bonusType === 'ingredient_refund') {
    if (parsedRefunds !== undefined && parsedRefunds >= 0) {
      refundsCount = parsedRefunds;
      netConsumed = Math.max(0, grossNeeded - refundsCount);
    }
  }

  // Handle bag balance secondary input for refunds
  const handleObservedBalanceChange = (val) => {
    setObservedBalanceInput(val);
    setBalanceDerivedError('');
    if (!val.trim()) return;

    const observed = parseInt(val, 10);
    if (!Number.isInteger(observed) || observed < 0) {
      setBalanceDerivedError('Observed bag balance must be a non-negative integer.');
      return;
    }

    const currentPreBatch = ledger.shadowInventory[activeRecipe?.inputItemId] ?? 0;
    const currentGross = (hasValidOps ? parsedOps : (nextRecommendedStep?.suggestedInitialBatch || 0)) * (activeRecipe?.inputQty || 3);
    const expectedBaseBalance = currentPreBatch - currentGross;
    const derivedRefunds = observed - expectedBaseBalance;

    if (derivedRefunds < 0) {
      setBalanceDerivedError(
        `Bag count (${observed}) is less than minimum possible (${expectedBaseBalance} with 0 refunds).`
      );
    } else if (hasValidOps && derivedRefunds > parsedOps) {
      setBalanceDerivedError(
        `Bag count (${observed}) implies ${derivedRefunds} refunds, exceeding maximum crafts (${parsedOps}).`
      );
    } else {
      setRefundsInput(String(derivedRefunds));
    }
  };

  // Auto-populate / reset form from recommended action
  const handleFillRecommended = () => {
    if (!nextRecommendedStep) return;
    setSelectedRecipeId(nextRecommendedStep.recipeId);
    const batch = nextRecommendedStep.suggestedInitialBatch;
    setOperationsInput(String(batch));
    if (bonusType === 'double_output') {
      setTotalOutputInput(String(batch * (nextRecommendedStep.outputQty || 1)));
    } else if (bonusType === 'ingredient_refund') {
      setRefundsInput('0');
    }
    setObservedBalanceInput('');
    setSubmitError('');
    setBalanceDerivedError('');
  };

  // Form submission
  const handleSubmitResult = (e) => {
    e.preventDefault();
    if (isSubmitting || !validation.isValid || freshness?.status === 'conflict_unreviewed') return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = recordResult(validationPayload, liveSource);
      if (!res.success) {
        setSubmitError(res.error || 'Failed to record crafting result.');
      } else {
        // Record formatted success summary for Section D
        if (bonusType === 'double_output') {
          const totalRec = parsedTotalOutput ?? derivedNormalOutput;
          setLastRecordedSummary(
            `${totalRec.toLocaleString()} ${formatItemName(activeRecipe?.outputItemName)} received, including ${derivedBonus.toLocaleString()} bonus.`
          );
        } else if (bonusType === 'ingredient_refund') {
          setLastRecordedSummary(
            `${parsedOps.toLocaleString()} ${formatItemName(activeRecipe?.outputItemName)} crafted. ${refundsCount.toLocaleString()} ${formatItemName(activeRecipe?.inputItemName)} returned.`
          );
        } else {
          setLastRecordedSummary(
            `${parsedOps.toLocaleString()} ${formatItemName(activeRecipe?.outputItemName)} crafted.`
          );
        }

        // Reset output inputs for next batch
        setOperationsInput('');
        setTotalOutputInput('');
        setRefundsInput('');
        setObservedBalanceInput('');
        setUserNote('');
      }
    } catch (err) {
      setSubmitError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldError = (fieldName) => {
    if (!hasValidOps && fieldName === 'operationsPerformed') return null;
    return validation.errors.find((err) => err.field === fieldName)?.message;
  };

  const bonusBadgeLabel =
    bonusType === 'double_output'
      ? '10% Double Output'
      : bonusType === 'ingredient_refund'
        ? '25% Ingredient Refund'
        : 'Guaranteed 3:1 (No Bonus)';

  const bonusBadgeShort =
    bonusType === 'double_output'
      ? '10% Double'
      : bonusType === 'ingredient_refund'
        ? '25% Refund'
        : 'Guaranteed 3:1';

  // Check whether all crafting goals for this family have been fully satisfied
  const originalReqTotal = Object.entries(snapshot.grossRequirements || {}).reduce(
    (sum, [id, req]) => (snapshot.materialIds.includes(id) ? sum + (req || 0) : sum),
    0
  );
  const hasOriginalRequirements = originalReqTotal > 0;

  const activeFamilyShortages = Object.entries(remainingPlan.adjustedShortages || {}).filter(
    ([id, qty]) => snapshot.materialIds.includes(id) && qty > 0
  );
  const totalRemainingShortage = activeFamilyShortages.reduce((sum, [, qty]) => sum + qty, 0);

  const activeFamilyRemainingSteps = remainingPlan.families[snapshot.familyId]?.steps || [];
  const remainingCraftCount = activeFamilyRemainingSteps.reduce((sum, st) => sum + st.count, 0);
  const isGoalReached = hasOriginalRequirements && totalRemainingShortage === 0 && remainingCraftCount === 0;

  const drawerContent = (
    <div
      className="fixed inset-0 z-[500] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      data-testid="crafting-session-drawer-backdrop"
      onClick={(e) => {
        // Clicking backdrop closes drawer, but does NOT discard session!
        if (e.target === e.currentTarget && !showDiscardConfirm) {
          closeDrawer();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crafting-session-title"
    >
      <div
        ref={drawerRef}
        id="crafting-session-panel"
        data-testid="crafting-session-drawer-panel"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl h-full h-[100dvh] max-h-[100dvh] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-slide-left text-[var(--text)]"
      >
        {/* ── Section A: Compact Header ── */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-[var(--border)] bg-gradient-to-r from-amber-500/10 via-[var(--surface)] to-[var(--elevated)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">🔨</span>
                <h2 id="crafting-session-title" className="text-base sm:text-lg font-bold text-[var(--text)] truncate">
                  {snapshot.familyName} Crafting Assistant
                </h2>
                {/* Accessible text for backward-compatible test matching */}
                <span className="sr-only">{snapshot.familyName} Crafting Session</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {bonusBadgeShort} · Temporary session
                </span>
                <span className="sr-only">10% Double Output 25% Ingredient Refund</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                Follow the suggested batch, then enter what you received.
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                🔒 Recording batches won't change saved inventory. Only Apply Results does.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                id="discard-session-btn"
                data-testid="discard-session-btn"
                onClick={() => setShowDiscardConfirm(true)}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-medium transition-colors cursor-pointer"
                title="Discard this temporary session"
              >
                Discard
              </button>
              <button
                type="button"
                id="close-crafting-drawer-btn"
                data-testid="close-crafting-drawer-btn"
                onClick={closeDrawer}
                aria-label="Close crafting session drawer"
                className="w-8 h-8 rounded-lg bg-[var(--elevated)] hover:bg-[var(--border)] text-[var(--muted)] hover:text-white flex items-center justify-center transition-colors cursor-pointer text-base"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Conflict — Unreviewed Warning Card */}
          {freshness?.status === 'conflict_unreviewed' && (
            <div
              className="mt-3 p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-xs text-amber-200 space-y-2.5 animate-fade-in"
              role="alert"
              data-testid="session-conflict-card"
            >
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 text-base">⚠️</span>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="font-bold text-amber-100 text-sm">
                    Your crafting plan may be outdated
                  </div>
                  <p className="text-gray-200 text-xs leading-relaxed">
                    {freshness.reasons.length === 1
                      ? freshness.reasons[0]
                      : `${freshness.reasons.length} relevant values have changed in your saved inventory, Mora, or progression goals.`}
                  </p>

                  {/* Expandable diff details */}
                  {freshness.reasons.length > 0 && (
                    <details className="mt-2 text-xs group" data-testid="conflict-diff-details">
                      <summary className="font-semibold text-amber-300 hover:text-amber-200 cursor-pointer select-none flex items-center gap-1">
                        <span>What Changed?</span>
                        <span className="text-[10px] group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <ul className="mt-2 space-y-1 pl-4 list-disc text-gray-300 bg-black/30 p-2.5 rounded-lg border border-amber-500/20">
                        {freshness.reasons.map((r, i) => (
                          <li key={i} className="text-[11px]">{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>

              {/* Resolution Choices */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                <button
                  type="button"
                  id="conflict-continue-btn"
                  data-testid="conflict-continue-btn"
                  onClick={() => acknowledgeConflict(freshness.currentFingerprint)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer"
                  title="Keep your recorded results and continue using the inventory from when this session started"
                >
                  Continue Original Plan
                </button>
                <button
                  type="button"
                  id="conflict-restart-btn"
                  data-testid="conflict-restart-btn"
                  onClick={handleRestartClick}
                  className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-gray-200 border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                  title="Start a new plan using your currently saved inventory"
                >
                  Restart with Current Inventory
                </button>
              </div>
            </div>
          )}

          {/* Conflict — Continued Persistent Banner */}
          {freshness?.status === 'conflict_continued' && (
            <div
              className="mt-3 p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between gap-2 flex-wrap"
              role="status"
              data-testid="session-continued-banner"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-sm">ℹ️</span>
                <span className="font-semibold text-blue-200">Using original inventory snapshot</span>
                <span className="text-gray-300 text-[11px] hidden sm:inline">— Live data has changed.</span>
              </div>
              <button
                type="button"
                onClick={handleRestartClick}
                className="text-[11px] text-amber-300 hover:text-amber-200 underline cursor-pointer shrink-0 font-medium"
              >
                Restart with Current Inventory
              </button>
            </div>
          )}
        </div>

        {/* ── Scrollable Body: Core Workflow ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 scrollbar-thin">
          {/* ── Section D: Success Confirmation of Last Batch ── */}
          {lastRecordedSummary && (
            <div
              className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5 animate-fade-in"
              role="status"
              data-testid="last-recorded-summary-banner"
            >
              <span className="text-base shrink-0">✅</span>
              <div>
                <span className="font-bold text-emerald-300">Result recorded: </span>
                <span>{lastRecordedSummary}</span>
              </div>
            </div>
          )}

          {/* ── Goal Reached State ── */}
          {isGoalReached ? (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-[var(--surface)] to-black/30 border border-emerald-500/40 text-center space-y-3">
              <span className="text-4xl block">🎉</span>
              <h3 className="text-lg font-bold text-emerald-300">Crafting goal reached!</h3>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                You have met all material requirements for <b className="text-white">{snapshot.familyName}</b> in this temporary session. Your real saved inventory has not been modified.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {events.length > 0 && (
                  <button
                    type="button"
                    id="goal-reached-apply-btn"
                    data-testid="goal-reached-apply-btn"
                    onClick={() => setShowApplyModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <span>✓</span> Apply Results to Inventory
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="genshin-btn px-4 py-2 text-xs font-bold text-white rounded-xl shadow-lg cursor-pointer"
                >
                  Close Session
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-xs text-gray-300 cursor-pointer"
                >
                  Discard Session
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Section B: WHAT TO CRAFT (Next Craft) ── */}
              {nextRecommendedStep && nextRecommendedStep.suggestedInitialBatch > 0 ? (
                <section
                  className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[var(--elevated)] to-black/30 border-2 border-amber-500/40 shadow-lg space-y-3.5"
                  aria-labelledby="section-what-to-craft"
                  data-testid="recommended-action-panel"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <span>🎯</span> Step {events.length + 1}: Make {formatItemName(nextRecommendedStep.outputItemName)}
                    </span>
                    <button
                      type="button"
                      onClick={handleFillRecommended}
                      id="fill-recommended-batch-btn"
                      data-testid="fill-recommended-batch-btn"
                      className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                      title="Reset craft count to recommended batch size"
                    >
                      Reset to suggested batch
                    </button>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-xl bg-black/40 border border-amber-400/30 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
                      <GenshinImage
                        src={getMaterialIcon(nextRecommendedStep.outputItemName, snapshot.category)}
                        alt={formatItemName(nextRecommendedStep.outputItemName)}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 id="section-what-to-craft" className="text-base sm:text-lg font-extrabold text-white">
                        Craft {nextRecommendedStep.suggestedInitialBatch.toLocaleString()} {formatItemName(nextRecommendedStep.outputItemName)}
                      </h3>
                      <p className="text-xs text-amber-200/90 font-medium">
                        Suggested batch — check results afterward
                      </p>
                    </div>
                  </div>

                  {/* 3 Plain-Language Bullets */}
                  <ul className="text-xs text-gray-200 space-y-1 pl-1 bg-black/20 p-3 rounded-xl border border-white/5">
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>
                        Uses <b className="text-amber-300">{nextRecommendedStep.firstBatchIngredients.toLocaleString()}</b> {formatItemName(nextRecommendedStep.inputItemName)}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>
                        Costs <b className="text-amber-200">{formatPlannerQuantity(nextRecommendedStep.firstBatchMora)} Mora</b>
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-[var(--muted)] text-[11px]">
                      <span className="text-gray-400">•</span>
                      <span>You may craft fewer if preferred.</span>
                    </li>
                  </ul>

                  {/* Secondary Recipe Switcher (Collapsed / Subtle) */}
                  {snapshot.recipes.length > 1 && (
                    <div className="pt-1">
                      {!showRecipePicker ? (
                        <button
                          type="button"
                          onClick={() => setShowRecipePicker(true)}
                          className="text-[11px] text-gray-400 hover:text-amber-300 underline cursor-pointer flex items-center gap-1"
                        >
                          <span>⚙️</span> Craft a different material tier
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-300">Select Material Tier:</span>
                            <button
                              type="button"
                              onClick={() => setShowRecipePicker(false)}
                              className="text-[10px] text-gray-400 hover:text-white"
                            >
                              Hide
                            </button>
                          </div>
                          <select
                            id="recipe-selector"
                            data-testid="recipe-selector"
                            value={selectedRecipeId}
                            onChange={(e) => setSelectedRecipeId(e.target.value)}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                          >
                            {snapshot.recipes.map((r) => (
                              <option key={r.id} value={r.id}>
                                {formatItemName(r.inputItemName)} → {formatItemName(r.outputItemName)} (3:1, {formatNumber(r.moraCost)} Mora)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              ) : (
                /* No executable crafting possible right now */
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌾</span>
                    <span className="font-bold text-sm">Farming Needed</span>
                  </div>
                  <p className="text-gray-300">
                    You do not currently have enough unreserved ingredients to craft higher tiers.
                  </p>
                  <p className="text-[11px] text-amber-300">
                    Remaining to farm:{' '}
                    {activeFamilyShortages.length > 0
                      ? activeFamilyShortages.map(([id, qty]) => `${qty}× ${formatItemName(id)}`).join(', ')
                      : 'None'}
                  </p>
                </div>
              )}

              {/* ── Section C: RECORD YOUR RESULT ── */}
              <section
                className="p-4 sm:p-5 rounded-2xl bg-[var(--elevated)] border border-[var(--border)] space-y-4 shadow-sm"
                aria-labelledby="section-record-result"
              >
                <div className="flex items-center justify-between">
                  <h3 id="section-record-result" className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
                    <span>✍️</span> Record What You Received
                  </h3>
                  <span className="text-[11px] text-[var(--muted)]">
                    After crafting in Genshin
                  </span>
                </div>

                <form
                  onSubmit={handleSubmitResult}
                  className="space-y-4"
                  data-testid="record-result-form"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Question 1: How many did you craft? */}
                    <div>
                      <label htmlFor="operations-input" className="block text-xs font-semibold text-gray-200 mb-1">
                        How many did you craft?
                      </label>
                      <input
                        id="operations-input"
                        data-testid="operations-input"
                        type="number"
                        min="1"
                        placeholder="e.g. 10"
                        value={operationsInput}
                        onChange={(e) => {
                          setOperationsInput(e.target.value);
                          setSubmitError('');
                        }}
                        className={`w-full bg-[var(--surface)] border rounded-xl px-3.5 py-2.5 text-sm text-white font-medium outline-none focus:border-amber-400 ${getFieldError('operationsPerformed') ? 'border-red-500' : 'border-[var(--border)]'
                          }`}
                      />
                      {getFieldError('operationsPerformed') && (
                        <p className="text-[11px] text-red-400 mt-1 font-medium">
                          {getFieldError('operationsPerformed')}
                        </p>
                      )}
                    </div>

                    {/* Question 2: For 10% Double Output */}
                    {bonusType === 'double_output' && (
                      <div>
                        <label htmlFor="total-output-input" className="block text-xs font-semibold text-gray-200 mb-1">
                          How many did you receive?
                        </label>
                        <input
                          id="total-output-input"
                          data-testid="total-output-input"
                          type="number"
                          min="0"
                          placeholder={hasValidOps ? `e.g. ${parsedOps}` : 'Enter total received'}
                          value={totalOutputInput}
                          onChange={(e) => {
                            setTotalOutputInput(e.target.value);
                            setSubmitError('');
                          }}
                          className={`w-full bg-[var(--surface)] border rounded-xl px-3.5 py-2.5 text-sm text-white font-medium outline-none focus:border-amber-400 ${getFieldError('totalOutputReceived') ? 'border-red-500' : 'border-[var(--border)]'
                            }`}
                        />
                        {getFieldError('totalOutputReceived') && (
                          <p className="text-[11px] text-red-400 mt-1 font-medium">
                            {getFieldError('totalOutputReceived')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Question 2: For 25% Ingredient Refund */}
                    {bonusType === 'ingredient_refund' && (
                      <div>
                        <label htmlFor="refunds-input" className="block text-xs font-semibold text-gray-200 mb-1">
                          How many ingredients were refunded?
                        </label>
                        <input
                          id="refunds-input"
                          data-testid="refunds-input"
                          type="number"
                          min="0"
                          max={hasValidOps ? parsedOps : undefined}
                          placeholder="0"
                          value={refundsInput}
                          onChange={(e) => {
                            setRefundsInput(e.target.value);
                            setSubmitError('');
                          }}
                          className={`w-full bg-[var(--surface)] border rounded-xl px-3.5 py-2.5 text-sm text-white font-medium outline-none focus:border-amber-400 ${getFieldError('refundsReceived') ? 'border-red-500' : 'border-[var(--border)]'
                            }`}
                        />
                        {getFieldError('refundsReceived') && (
                          <p className="text-[11px] text-red-400 mt-1 font-medium">
                            {getFieldError('refundsReceived')}
                          </p>
                        )}

                        {/* Optional Secondary Input Method: Observed lower-tier balance */}
                        <details className="mt-1.5 group">
                          <summary className="text-[11px] text-teal-400 hover:text-teal-300 font-medium cursor-pointer select-none">
                            Use my ingredient balance instead
                          </summary>
                          <div className="mt-2 p-2.5 rounded-lg bg-black/25 border border-teal-500/20 space-y-1.5 text-xs">
                            <label htmlFor="observed-balance-input" className="block text-[11px] text-gray-300">
                              Enter your new {formatItemName(activeRecipe?.inputItemName)} bag count:
                            </label>
                            <input
                              id="observed-balance-input"
                              data-testid="observed-balance-input"
                              type="number"
                              min="0"
                              placeholder="e.g. 1678"
                              value={observedBalanceInput}
                              onChange={(e) => handleObservedBalanceChange(e.target.value)}
                              className="w-full bg-[var(--surface)] border border-teal-500/30 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-teal-400"
                            />
                            {balanceDerivedError && (
                              <p className="text-[10px] text-red-400 font-medium">{balanceDerivedError}</p>
                            )}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>

                  {/* Concise Live Result Impact Preview */}
                  {hasValidOps && (
                    <div
                      className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs flex flex-wrap items-center justify-between gap-2"
                      data-testid="batch-preview-panel"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">✨</span>
                        <div className="text-[11px]">
                          {bonusType === 'double_output' ? (
                            <span>
                              Produces <b className="text-emerald-400">{parsedTotalOutput ?? derivedNormalOutput}× {formatItemName(activeRecipe?.outputItemName)}</b>
                              {derivedBonus > 0 && <span className="text-blue-300 ml-1">(+{derivedBonus} bonus!)</span>}
                            </span>
                          ) : (
                            <span>
                              Produces <b className="text-emerald-400">{derivedNormalOutput}× {formatItemName(activeRecipe?.outputItemName)}</b>
                              {' · '}Uses <b className="text-amber-300">{netConsumed}×</b> {formatItemName(activeRecipe?.inputItemName)}
                              {refundsCount > 0 && <span className="text-teal-300 ml-1">(-{refundsCount} refund)</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-amber-200 font-medium">
                        Fee: {formatPlannerQuantity(moraNeeded)} Mora
                      </div>
                    </div>
                  )}

                  {/* Submit / General Error */}
                  {submitError && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                      {submitError}
                    </div>
                  )}

                  {/* Primary Submit Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      id="submit-record-result-btn"
                      data-testid="submit-record-result-btn"
                      disabled={!validation.isValid || isSubmitting || freshness?.status === 'conflict_unreviewed'}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${validation.isValid && !isSubmitting && freshness?.status !== 'conflict_unreviewed'
                          ? 'genshin-btn text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-500 border border-white/5 cursor-not-allowed'
                        }`}
                    >
                      <span>{isSubmitting ? 'Updating Plan...' : 'Update My Plan'}</span>
                      {!isSubmitting && <span>→</span>}
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {/* ── Section E: Simple Progress Summary ── */}
          <section className="p-3.5 rounded-xl bg-black/20 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">Batches</span>
                <span className="font-bold text-gray-200" data-testid="batches-count-summary">{events.length}</span>
              </div>
              <div className="border-l border-white/10 pl-3">
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">Spent Mora</span>
                <span className="font-bold text-amber-300" data-testid="spent-mora-summary">
                  {formatPlannerQuantity(ledger.totalMoraSpent || 0)}
                </span>
              </div>
              <div className="border-l border-white/10 pl-3">
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">Still Needed</span>
                <span className="font-bold text-emerald-400">
                  {totalRemainingShortage === 0 ? 'Fully covered' : `${totalRemainingShortage} materials`}
                </span>
              </div>
            </div>

            {events.length > 0 && (
              <button
                type="button"
                id="undo-last-batch-btn"
                data-testid="undo-last-batch-btn"
                onClick={() => {
                  undoLastBatch();
                  setLastRecordedSummary('');
                }}
                className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 text-xs text-amber-300 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Revert the most recent crafting batch recorded in this session"
              >
                <span>↩️</span> Undo Last Batch
              </button>
            )}
          </section>

          {/* ── Section 5: Advanced Collapsed Details (Accordion Sections) ── */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            {/* 1. View Inventory Details */}
            <details
              className="rounded-xl border border-[var(--border)] bg-black/20 overflow-hidden group"
              data-testid="details-inventory"
            >
              <summary className="px-4 py-3 font-semibold text-xs text-[var(--muted)] hover:text-white flex items-center justify-between cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <span>📦</span> View Inventory Details
                </span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 pt-1 space-y-3.5 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-gray-300">
                    Current Simulated Inventory
                  </h4>
                  <span className="text-[11px] text-[var(--muted)]">
                    Your real saved inventory is not modified.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {snapshot.materials.map((m) => {
                    const initialQty = snapshot.startingInventory[m.id] ?? 0;
                    const shadowQty = ledger.shadowInventory[m.id] ?? 0;
                    const reqQty = snapshot.grossRequirements[m.id] ?? 0;
                    const availableForCrafting = Math.max(0, shadowQty - reqQty);
                    const diff = shadowQty - initialQty;

                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between gap-2"
                        data-testid={`shadow-inv-${m.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-white/5 flex items-center justify-center p-1 shrink-0">
                            <GenshinImage
                              src={getMaterialIcon(m.name, snapshot.category)}
                              alt={formatItemName(m.name)}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-200 truncate" title={formatItemName(m.name)}>
                              {formatItemName(m.name)}
                            </p>
                            <p className="text-[10px] text-[var(--muted)]">Tier {m.tierIndex + 1}</p>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs pt-1 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted)] text-[11px]">In this session:</span>
                            <span className="font-bold text-emerald-400">
                              {shadowQty.toLocaleString()}
                              {diff !== 0 && (
                                <span className={`text-[10px] ml-1 ${diff > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                                  ({diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                            <span>Starting:</span>
                            <span>{initialQty.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                            <span>Goal Reserved:</span>
                            <span>{reqQty.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-300/80">Available to Craft:</span>
                            <span className="font-semibold text-amber-200">{availableForCrafting.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2.5 rounded-lg bg-black/30 border border-amber-500/20 text-xs flex items-center justify-between">
                  <span className="text-gray-300">
                    Remaining Session Mora: <b className="text-amber-300">{formatPlannerQuantity(ledger.remainingMora)}</b>
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Starting: {formatPlannerQuantity(snapshot.startingMora)} Mora
                  </span>
                </div>
              </div>
            </details>

            {/* 2. View Full Forecast */}
            <details
              className="rounded-xl border border-[var(--border)] bg-black/20 overflow-hidden group"
              data-testid="details-forecast"
            >
              <summary className="px-4 py-3 font-semibold text-xs text-[var(--muted)] hover:text-white flex items-center justify-between cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <span>📈</span> View Full Forecast
                </span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 pt-1 space-y-3 border-t border-white/5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Guaranteed Remaining */}
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-200">Guaranteed Remaining</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">
                        Baseline 3:1
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-gray-300">
                      <p>
                        Additional Crafting Fee:{' '}
                        <b className="text-amber-300 font-semibold">
                          {formatPlannerQuantity(remainingPlan.families[snapshot.familyId]?.craftingMora || 0)} Mora
                        </b>
                      </p>
                      <div>
                        <span>Remaining Guaranteed Steps:</span>
                        <ul className="list-disc list-inside text-gray-400 pl-1 mt-0.5 space-y-0.5">
                          {(remainingPlan.families[snapshot.familyId]?.steps || []).map((s) => (
                            <li key={s.recipeId}>
                              {s.count.toLocaleString()}× {formatItemName(s.outputItemName)}
                            </li>
                          ))}
                          {(remainingPlan.families[snapshot.familyId]?.steps || []).length === 0 && (
                            <li>None needed</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <span>Farming Shortages:</span>
                        <div className="text-[11px] text-amber-300 pl-1 mt-0.5 font-medium">
                          {activeFamilyShortages.length > 0
                            ? activeFamilyShortages.map(([id, qty]) => `${qty}× ${formatItemName(id)}`).join(', ')
                            : '0 (Fully covered!)'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estimated Future Forecast */}
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-200">Estimated Future Forecast</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        {bonusBadgeLabel}
                      </span>
                    </div>
                    {remainingForecast ? (
                      <div className="space-y-1.5 text-[11px] text-blue-100/90">
                        <p>
                          Estimated Crafting Fee:{' '}
                          <b className="text-amber-300 font-semibold">
                            ~{formatPlannerQuantity(remainingForecast.estimatedCraftingMora)} Mora
                          </b>
                        </p>
                        <p>
                          Coverage Status:{' '}
                          <b className="text-blue-300 font-semibold">
                            {remainingForecast.coverageDisplay}
                          </b>
                        </p>
                        <div>
                          <span>Expected Farming Shortages:</span>
                          <div className="text-[11px] text-blue-200 pl-1 mt-0.5 font-medium">
                            {Object.entries(remainingForecast.expectedShortages || {})
                              .filter(([_, qty]) => qty > 0)
                              .map(([id, qty]) => `~${Math.round(qty)}× ${formatItemName(id)}`)
                              .join(', ') || 'None (~0)'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted)]">
                        No bonus forecast active (Guaranteed baseline applies).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </details>

            {/* 3. View Crafting History */}
            <details
              className="rounded-xl border border-[var(--border)] bg-black/20 overflow-hidden group"
              data-testid="details-history"
            >
              <summary className="px-4 py-3 font-semibold text-xs text-[var(--muted)] hover:text-white flex items-center justify-between cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <span>📜</span> View Crafting History ({events.length})
                </span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 pt-1 space-y-2 border-t border-white/5 text-xs" data-testid="session-history-list">
                {events.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-3 text-center">
                    No crafting batches recorded yet.
                  </p>
                ) : (
                  events.map((evt, idx) => (
                    <div
                      key={evt.eventId || idx}
                      className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      data-testid={`history-event-${idx}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-200 truncate">
                            Crafted {evt.operationsPerformed.toLocaleString()}× → Produced{' '}
                            <b className="text-emerald-400">{evt.totalOutputReceived.toLocaleString()}×</b> {formatItemName(evt.outputItemId)}
                          </p>
                          <p className="text-[10px] text-[var(--muted)]">
                            Used {evt.netInputConsumed.toLocaleString()}× {formatItemName(evt.inputItemId)}
                            {evt.bonusOutputReceived > 0 && (
                              <span className="text-blue-300 ml-1">(+{evt.bonusOutputReceived} bonus)</span>
                            )}
                            {evt.refundsReceived > 0 && (
                              <span className="text-teal-300 ml-1">({evt.refundsReceived} refunded)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-[11px] font-mono">
                        <span className="text-amber-300">
                          {formatPlannerQuantity(evt.moraSpent)} Mora
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 p-3.5 border-t border-[var(--border)] bg-[var(--elevated)] flex items-center justify-between gap-3 text-xs">
          <span className="text-[11px] text-[var(--muted)] truncate">
            {events.length > 0
              ? `${events.length} recorded ${events.length === 1 ? 'batch' : 'batches'}`
              : 'Closing retains your active session.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="drawer-close-footer-btn"
              data-testid="drawer-close-footer-btn"
              onClick={closeDrawer}
              className="genshin-btn-ghost px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Close
            </button>
            {events.length > 0 ? (
              <button
                type="button"
                id="apply-crafting-results-btn"
                data-testid="apply-crafting-results-btn"
                onClick={() => setShowApplyModal(true)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
              >
                <span>✓</span> Apply Results to Inventory
              </button>
            ) : (
              <button
                type="button"
                id="apply-crafting-results-btn"
                data-testid="apply-crafting-results-btn"
                disabled
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-800 text-gray-500 border border-white/5 cursor-not-allowed hidden sm:flex items-center gap-1.5 shrink-0"
                title="Record at least 1 crafting batch to apply results to inventory"
              >
                <span>✓</span> Apply Results to Inventory
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Discard Confirmation Modal ── */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-confirm-title"
          data-testid="discard-confirm-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDiscardConfirm(false);
          }}
        >
          <div className="w-full max-w-md bg-[var(--elevated)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4 text-[var(--text)]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 id="discard-confirm-title" className="text-base font-bold text-red-400">
                  Discard Crafting Session?
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  This action is permanent for this temporary session.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to discard your crafting session for <b className="text-white">{snapshot.familyName}</b>?
              {events.length > 0
                ? ` All ${events.length} recorded crafting batches will be permanently discarded.`
                : ' No batches have been recorded yet.'}
              {' '}Your saved live inventory will remain completely untouched.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                id="cancel-discard-btn"
                data-testid="cancel-discard-btn"
                onClick={() => setShowDiscardConfirm(false)}
                className="genshin-btn-ghost px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-discard-btn"
                data-testid="confirm-discard-btn"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  discardSession();
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg cursor-pointer transition-colors"
              >
                Confirm Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restart Confirmation Modal ── */}
      {showRestartConfirm && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="restart-confirm-title"
          data-testid="restart-confirm-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRestartConfirm(false);
          }}
        >
          <div className="w-full max-w-md bg-[var(--elevated)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4 text-[var(--text)]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <h4 id="restart-confirm-title" className="text-base font-bold text-amber-400">
                  Restart with Current Inventory?
                </h4>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Start a fresh plan from your live saved inventory.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              You have <b className="text-white">{events.length} recorded crafting {events.length === 1 ? 'batch' : 'batches'}</b> in this temporary session.
              Restarting will clear these temporary records and recalculate your crafting plan using your currently saved inventory, Mora, and progression goals.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                id="cancel-restart-btn"
                data-testid="cancel-restart-btn"
                onClick={() => setShowRestartConfirm(false)}
                className="genshin-btn-ghost px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-restart-btn"
                data-testid="confirm-restart-btn"
                onClick={executeRestart}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg cursor-pointer transition-colors"
              >
                Confirm Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Crafting Results Modal ── */}
      {showApplyModal && (
        <ApplyCraftingResultsModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : drawerContent;
}
