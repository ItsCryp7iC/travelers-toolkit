import React, { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../../store/useStore';
import notify from '../../utils/notify';
import HoyoEmailLoginStep from './HoyoEmailLoginStep';
import HoyoGeetestStep from './HoyoGeetestStep';
import HoyoEmailVerifyStep from './HoyoEmailVerifyStep';
import HoyoAccountSelectStep from './HoyoAccountSelectStep';
import { mapHoyolabAuthError } from './hoyolabAuthErrors';

export default function HoyoLoginModal({ isOpen, onClose, onSuccess }) {
  const setHoyolabConnected = useStore((s) => s.setHoyolabConnected);
  const setHoyolabAccount = useStore((s) => s.setHoyolabAccount);
  const handleSyncNotes = useStore((s) => s.handleSyncNotes);

  const [step, setStep] = useState('credentials'); // 'credentials' | 'geetest' | 'emailVerify' | 'accounts'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // In-memory credentials ONLY — never persisted
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  // Challenge and accounts payload state
  const [geetestData, setGeetestData] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const isFlowActiveRef = useRef(false);

  // Wipe password and sensitive state from memory
  const clearSensitiveData = useCallback(() => {
    setPassword('');
  }, []);

  const resetAllState = useCallback(() => {
    clearSensitiveData();
    setAccount('');
    setStep('credentials');
    setIsSubmitting(false);
    setError(null);
    setGeetestData(null);
    setAccounts([]);
    isFlowActiveRef.current = false;
  }, [clearSensitiveData]);

  // Cancel flow with backend (guaranteed one-shot)
  const cancelBackendFlow = useCallback(async () => {
    if (isFlowActiveRef.current) {
      isFlowActiveRef.current = false;
      try {
        await fetch('/api/hoyolab/auth/flow', {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (_) {
        // Silent catch for network cancellation
      }
    }
  }, []);

  const handleClose = useCallback(async () => {
    await cancelBackendFlow();
    resetAllState();
    onClose?.();
  }, [cancelBackendFlow, resetAllState, onClose]);

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Clean up on unmount or when modal closes
  useEffect(() => {
    return () => {
      clearSensitiveData();
      if (isFlowActiveRef.current) {
        cancelBackendFlow();
      }
    };
  }, [clearSensitiveData, cancelBackendFlow]);

  if (!isOpen) return null;

  // Process nextStep directives from backend
  const handleNextStep = async (data) => {
    if (!data) return;

    if (data.nextStep === 'geetest') {
      setGeetestData({
        gtVersion: data.gtVersion,
        apiServer: data.apiServer,
        mmt: data.mmt,
      });
      setStep('geetest');
      setError(null);
    } else if (data.nextStep === 'emailVerify') {
      setStep('emailVerify');
      setError(null);
    } else if (data.nextStep === 'complete') {
      // Reached authenticated stage: immediately clear password from memory
      clearSensitiveData();
      await fetchDiscoveredAccounts();
    }
  };

  // Safe response handler
  const handleApiResponse = async (res, currentStage) => {
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: true, data };
    }

    const errData = await res.json().catch(() => ({}));
    const detail = errData?.detail;

    // Handle 401 flow expiry: reset to credentials step
    if (res.status === 401 && (detail?.toLowerCase().includes('expired') || detail?.toLowerCase().includes('no active'))) {
      clearSensitiveData();
      setError('Your sign-in session expired. Please start again.');
      setStep('credentials');
      isFlowActiveRef.current = false;
      return { success: false, expired: true };
    }

    const friendlyError = mapHoyolabAuthError(res.status, detail, currentStage);
    setError(friendlyError);
    return { success: false, error: friendlyError };
  };

  // Step 1: Initial Login with Email/Password
  const handleCredentialsSubmit = async ({ account: accVal, password: pwdVal }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/hoyolab/auth/email-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account: accVal, password: pwdVal }),
      });

      const outcome = await handleApiResponse(res, 'credentials');
      if (outcome.success) {
        isFlowActiveRef.current = true;
        // Password is held safely in backend encrypted flow cookie for any challenges;
        // wipe from frontend memory immediately upon successful initial dispatch.
        clearSensitiveData();
        await handleNextStep(outcome.data);
      }
    } catch (_) {
      setError('Network connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Geetest Callback Submission
  const handleGeetestSuccess = async (validatePayload) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/hoyolab/auth/geetest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validatePayload),
      });

      const outcome = await handleApiResponse(res, 'geetest');
      if (outcome.success) {
        await handleNextStep(outcome.data);
      }
    } catch (_) {
      setError('Failed to submit security challenge response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Email OTP Verification
  const handleEmailVerifySubmit = async (code) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/hoyolab/auth/email-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const outcome = await handleApiResponse(res, 'emailVerify');
      if (outcome.success) {
        await handleNextStep(outcome.data);
      }
    } catch (_) {
      setError('Failed to submit verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 4: Account Discovery
  const fetchDiscoveredAccounts = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/hoyolab/auth/accounts', {
        method: 'GET',
        credentials: 'include',
      });

      const outcome = await handleApiResponse(res, 'accounts');
      if (outcome.success) {
        const foundAccounts = outcome.data?.accounts || [];
        setAccounts(foundAccounts);
        setStep('accounts');
      }
    } catch (_) {
      setError('Failed to load Genshin Impact accounts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5: Final Account Selection & Session Finalization
  const handleAccountComplete = async (selectedUid) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/hoyolab/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uid: Number(selectedUid) }),
      });

      const outcome = await handleApiResponse(res, 'accounts');
      if (outcome.success) {
        isFlowActiveRef.current = false;
        clearSensitiveData();

        const accountData = outcome.data?.account;
        setHoyolabConnected?.(true);
        if (typeof setHoyolabAccount === 'function') {
          setHoyolabAccount(accountData || null);
        }

        notify.success('HoYoLAB account connected successfully!');

        // Trigger notes sync refresh in background if available
        if (typeof handleSyncNotes === 'function') {
          handleSyncNotes(false).catch(() => {});
        }

        onSuccess?.(accountData);
        resetAllState();
        onClose?.();
      }
    } catch (_) {
      setError('Failed to finalize HoYoLAB account connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoyolab-login-modal-title"
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-slide-up"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl" aria-hidden="true">
            🌟
          </span>
          <h2 id="hoyolab-login-modal-title" className="text-xl font-bold text-primary">
            Sign in with HoYoLAB
          </h2>
        </div>

        {step === 'credentials' && (
          <HoyoEmailLoginStep
            account={account}
            password={password}
            onChangeAccount={setAccount}
            onChangePassword={setPassword}
            onSubmit={handleCredentialsSubmit}
            onCancel={handleClose}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}

        {step === 'geetest' && (
          <HoyoGeetestStep
            geetestData={geetestData}
            onSuccess={handleGeetestSuccess}
            onCancel={handleClose}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}

        {step === 'emailVerify' && (
          <HoyoEmailVerifyStep
            onSubmit={handleEmailVerifySubmit}
            onCancel={handleClose}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}

        {step === 'accounts' && (
          <HoyoAccountSelectStep
            accounts={accounts}
            onSelectAccount={handleAccountComplete}
            onCancel={handleClose}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
