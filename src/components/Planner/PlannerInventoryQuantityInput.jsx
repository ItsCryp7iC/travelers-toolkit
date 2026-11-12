import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../store/useStore';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import { formatPlannerQuantity } from '../../utils/plannerTabs';
import { acquireBodyScrollLock } from '../../utils/scrollLock';

/**
 * Strict validator for material inventory quantities.
 * Accepts only whole numbers >= 0 and <= Number.MAX_SAFE_INTEGER.
 * Rejects empty input, negative values, decimals, scientific notation,
 * NaN, Infinity, non-numeric text, and unsafe integers.
 */
export function validateQuantityInput(rawDraft) {
  if (typeof rawDraft !== 'string') {
    return { isValid: false, error: 'Invalid input' };
  }
  const trimmed = rawDraft.trim();
  if (trimmed === '') {
    return { isValid: false, error: 'Quantity cannot be empty' };
  }
  if (trimmed.startsWith('-')) {
    return { isValid: false, error: 'Quantity cannot be negative' };
  }
  if (/e/i.test(trimmed)) {
    return { isValid: false, error: 'Scientific notation is not supported' };
  }
  if (trimmed.includes('.')) {
    return { isValid: false, error: 'Decimals are not allowed' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid whole number' };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || isNaN(num)) {
    return { isValid: false, error: 'Please enter a valid number' };
  }
  if (!Number.isSafeInteger(num)) {
    return { isValid: false, error: 'Quantity exceeds maximum safe limit' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Quantity cannot be negative' };
  }
  return { isValid: true, value: num };
}

export default function PlannerInventoryQuantityInput({
  materialId,
  materialName,
  currentQuantity = 0,
  onSave = null,
  className = '',
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [pendingWarning, setPendingWarning] = useState(null);

  const isEditingRef = useRef(false);
  const initialValueRef = useRef(null);
  const inputRef = useRef(null);

  const handleCancelWarning = useCallback(() => {
    isEditingRef.current = false;
    setPendingWarning(null);
    setDraft(String(currentQuantity ?? 0));
    initialValueRef.current = currentQuantity ?? 0;
    setError(null);
    setIsEditing(false);
  }, [currentQuantity]);

  // Manage body scroll lock and Escape key when active crafting warning modal is open
  useEffect(() => {
    if (!pendingWarning) return;
    const releaseLock = acquireBodyScrollLock();
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        handleCancelWarning();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      releaseLock();
      window.removeEventListener('keydown', handleKey);
    };
  }, [pendingWarning, handleCancelWarning]);

  const saveQuantity = (id, qty) => {
    if (typeof onSave === 'function') {
      onSave(id, qty);
    } else {
      useStore.getState().setInventory(id, qty, 'planner_inline');
    }
  };

  const handleFocus = (e) => {
    isEditingRef.current = true;
    setIsEditing(true);
    const plain = String(currentQuantity ?? 0);
    setDraft(plain);
    initialValueRef.current = currentQuantity ?? 0;
    setError(null);
    e.target?.select?.();
  };

  const handleChange = (e) => {
    setDraft(e.target.value);
    if (error) setError(null);
  };

  const commitEdit = (rawVal) => {
    const valueToValidate = rawVal !== undefined ? rawVal : draft;
    const trimmed = String(valueToValidate).trim();

    // 1. Strict validation
    const validation = validateQuantityInput(trimmed);
    if (!validation.isValid) {
      setError(validation.error);
      return false;
    }

    const newQty = validation.value;
    const liveStoredQty = useStore.getState().inventory?.[materialId] ?? 0;

    // 2. Idempotence & Synchronized Check:
    // If the entered value equals the live store value, no write needed.
    // End edit cleanly without external conflict warnings.
    if (newQty === liveStoredQty) {
      initialValueRef.current = newQty;
      isEditingRef.current = false;
      setIsEditing(false);
      setError(null);
      setDraft(String(newQty));
      return true;
    }

    // 3. External store update detection (Genuine Conflict)
    // If live store changed from when editing started AND differs from user's intended value:
    if (initialValueRef.current !== null && liveStoredQty !== initialValueRef.current) {
      setError(`Inventory changed externally (now ${liveStoredQty.toLocaleString()}). Review before saving.`);
      return false;
    }

    // 4. Active Crafting Session Protection (Section 9 & R2.1)
    // Only prompt with confirmation modal if active session has recorded crafting events (> 0)
    const session = useCraftingSessionStore.getState().session;
    const isMaterialInActiveSession = Boolean(
      session &&
        session.events &&
        session.events.length > 0 &&
        session.snapshot &&
        (
          session.snapshot.materialIds?.includes(materialId) ||
          session.snapshot.materials?.some(
            (m) => m.id === materialId || m.name === materialId || m.name === materialName
          )
        )
    );

    if (isMaterialInActiveSession) {
      setPendingWarning({
        materialId,
        materialName,
        newQty,
        familyName: session.snapshot.familyName || 'active',
      });
      return false;
    }

    // 5. Commit write to store
    saveQuantity(materialId, newQty);
    initialValueRef.current = newQty;
    isEditingRef.current = false;
    setIsEditing(false);
    setError(null);
    setDraft(String(newQty));
    return true;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const success = commitEdit();
      if (success) {
        e.target?.blur?.();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isEditingRef.current = false;
      setError(null);
      setIsEditing(false);
      setDraft(String(currentQuantity ?? 0));
      initialValueRef.current = currentQuantity ?? 0;
      e.target?.blur?.();
    }
  };

  const handleBlur = () => {
    if (pendingWarning || !isEditingRef.current) return;
    const trimmed = draft.trim();
    if (trimmed === String(currentQuantity ?? 0)) {
      initialValueRef.current = currentQuantity ?? 0;
      isEditingRef.current = false;
      setError(null);
      setIsEditing(false);
      return;
    }
    commitEdit();
  };

  const handleConfirmWarning = () => {
    if (!pendingWarning) return;
    const { materialId: targetId, newQty } = pendingWarning;
    saveQuantity(targetId, newQty);
    initialValueRef.current = newQty;
    isEditingRef.current = false;
    setPendingWarning(null);
    setError(null);
    setIsEditing(false);
    setDraft(String(newQty));
  };

  const displayQuantity = isEditing ? draft : formatPlannerQuantity(currentQuantity);

  return (
    <div
      className={`flex flex-col items-center justify-center py-1 px-1.5 rounded bg-black/25 border min-w-0 relative group/have transition-colors focus-within:border-amber-400/40 focus-within:bg-black/40 ${
        error
          ? 'border-red-500/80 bg-red-950/20'
          : isEditing
          ? 'border-amber-400/50 bg-black/40'
          : 'border-white/5 hover:border-white/10'
      } ${className}`}
      title={`Have: ${(currentQuantity || 0).toLocaleString()}`}
      onClick={(e) => {
        // If clicking on cell padding outside input, focus the input
        if (e.target !== inputRef.current && !pendingWarning) {
          inputRef.current?.focus();
        }
      }}
    >
      <span className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider truncate w-full flex items-center justify-center gap-1 select-none pointer-events-none after:content-['✎'] after:text-[9px] after:opacity-40 group-hover/have:after:opacity-90 group-focus-within/have:after:opacity-90 after:transition-opacity">
        Have<span className="sr-only">: </span>
      </span>

      <span className="sr-only">{formatPlannerQuantity(currentQuantity)}</span>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`Have quantity for ${materialName}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `have-error-${materialId}` : undefined}
        value={displayQuantity}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`font-bold text-xs sm:text-sm text-center w-full bg-transparent outline-none rounded py-0 px-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          error
            ? 'text-red-400'
            : isEditing
            ? 'text-white'
            : 'text-[var(--text)] hover:text-white cursor-text'
        }`}
      />

      {error && (
        <div
          id={`have-error-${materialId}`}
          role="alert"
          className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-30 bg-red-950 text-red-200 border border-red-500/60 text-[10px] font-medium px-2 py-0.5 rounded shadow-xl whitespace-nowrap pointer-events-none animate-fade-in"
        >
          {error}
        </div>
      )}

      {/* Active Crafting Session Warning Modal */}
      {pendingWarning &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in text-[var(--text)]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="active-session-warning-title"
            data-testid="active-session-warning-dialog"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCancelWarning();
            }}
          >
            <div className="w-full max-w-md bg-[var(--elevated)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  ⚠️
                </span>
                <div>
                  <h4 id="active-session-warning-title" className="text-base font-bold text-amber-400">
                    Active Crafting Session
                  </h4>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Modifying saved inventory may invalidate in-progress crafting.
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                <b className="text-white">{materialName}</b> belongs to your current{' '}
                <b className="text-white">{pendingWarning.familyName}</b> crafting session. Updating its saved quantity may prevent recorded crafting results from being applied automatically.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  id="cancel-active-session-warning-btn"
                  data-testid="cancel-active-session-warning-btn"
                  onClick={handleCancelWarning}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-active-session-warning-btn"
                  data-testid="confirm-active-session-warning-btn"
                  onClick={handleConfirmWarning}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg cursor-pointer transition-colors"
                >
                  Update Anyway
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
