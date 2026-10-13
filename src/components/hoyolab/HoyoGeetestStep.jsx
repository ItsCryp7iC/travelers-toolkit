import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loadGeetestScript } from '../../utils/geetestLoader';

export default function HoyoGeetestStep({
  geetestData,
  onSuccess,
  onCancel,
  isSubmitting,
  error,
}) {
  const [isLoadingScript, setIsLoadingScript] = useState(true);
  const [initError, setInitError] = useState(null);
  const [hasClosed, setHasClosed] = useState(false);
  const captchaInstanceRef = useRef(null);
  const isMountedRef = useRef(true);
  const hasSubmittedRef = useRef(false);

  const { gtVersion = 4, apiServer, mmt = {} } = geetestData || {};

  const initializeCaptcha = useCallback(async () => {
    setIsLoadingScript(true);
    setInitError(null);
    setHasClosed(false);
    hasSubmittedRef.current = false;

    try {
      await loadGeetestScript(gtVersion);
      if (!isMountedRef.current) return;

      if (gtVersion === 4) {
        if (typeof window.initGeetest4 !== 'function') {
          throw new Error('GeeTest v4 SDK not available on window');
        }

        const params = {
          captchaId: mmt.captchaId,
          product: 'bind',
          riskType: mmt.riskType || undefined,
          language: 'en',
          apiServers: [apiServer ?? 'gcaptcha4.captchami.com'],
        };

        const sessionId = mmt.sessionId || mmt.session_id;
        if (sessionId) {
          params.userInfo = JSON.stringify({ session_id: sessionId });
        }

        window.initGeetest4(params, (captcha) => {
          if (!isMountedRef.current) return;
          captchaInstanceRef.current = captcha;

          captcha.onReady(() => {
            if (!isMountedRef.current) return;
            setIsLoadingScript(false);
            try {
              captcha.showCaptcha();
            } catch (err) {
              console.error('Failed to show GeeTest v4 captcha', err);
            }
          });

          captcha.onSuccess(() => {
            if (!isMountedRef.current) return;
            if (hasSubmittedRef.current) return;
            try {
              const validate = captcha.getValidate();
              if (validate) {
                hasSubmittedRef.current = true;
                onSuccess({
                  gt_version: 4,
                  captcha_id: validate.captcha_id || mmt.captchaId,
                  lot_number: validate.lot_number,
                  pass_token: validate.pass_token,
                  gen_time: validate.gen_time,
                  captcha_output: validate.captcha_output,
                });
              } else {
                hasSubmittedRef.current = false;
                setInitError('Captcha validation failed. Please try again.');
              }
            } catch (err) {
              hasSubmittedRef.current = false;
              setInitError('Error reading captcha validation payload.');
            }
          });

          captcha.onClose(() => {
            if (!isMountedRef.current) return;
            setHasClosed(true);
          });

          captcha.onError((err) => {
            if (!isMountedRef.current) return;
            hasSubmittedRef.current = false;
            setInitError('Verification error. Please retry.');
          });
        });
      } else if (gtVersion === 3) {
        if (typeof window.initGeetest !== 'function') {
          throw new Error('GeeTest v3 SDK not available on window');
        }

        const params = {
          gt: mmt.gt,
          challenge: mmt.challenge,
          offline: !mmt.success,
          new_captcha: mmt.new_captcha,
          api_server: apiServer ?? 'api-na.geetest.com',
          product: 'bind',
          lang: 'en',
        };

        window.initGeetest(params, (captchaObj) => {
          if (!isMountedRef.current) return;
          captchaInstanceRef.current = captchaObj;

          captchaObj.onReady(() => {
            if (!isMountedRef.current) return;
            setIsLoadingScript(false);
            try {
              captchaObj.verify();
            } catch (err) {
              console.error('Failed to trigger GeeTest v3 verify', err);
            }
          });

          captchaObj.onSuccess(() => {
            if (!isMountedRef.current) return;
            if (hasSubmittedRef.current) return;
            try {
              const validate = captchaObj.getValidate();
              if (validate) {
                hasSubmittedRef.current = true;
                onSuccess({
                  gt_version: 3,
                  geetest_challenge: validate.geetest_challenge,
                  geetest_validate: validate.geetest_validate,
                  geetest_seccode: validate.geetest_seccode,
                });
              } else {
                hasSubmittedRef.current = false;
                setInitError('Captcha validation failed. Please try again.');
              }
            } catch (err) {
              hasSubmittedRef.current = false;
              setInitError('Error reading captcha validation payload.');
            }
          });

          captchaObj.onClose(() => {
            if (!isMountedRef.current) return;
            setHasClosed(true);
          });

          captchaObj.onError((err) => {
            if (!isMountedRef.current) return;
            hasSubmittedRef.current = false;
            setInitError('Verification error. Please retry.');
          });
        });
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setIsLoadingScript(false);
      setInitError(err.message || 'Failed to initialize security verification.');
    }
  }, [gtVersion, apiServer, mmt, onSuccess]);

  useEffect(() => {
    isMountedRef.current = true;
    initializeCaptcha();

    return () => {
      isMountedRef.current = false;
      if (captchaInstanceRef.current?.destroy) {
        try {
          captchaInstanceRef.current.destroy();
        } catch (_err) {
          // Ignore cleanup error
        }
      }
    };
  }, [initializeCaptcha]);

  const handleRetry = () => {
    hasSubmittedRef.current = false;
    if (captchaInstanceRef.current) {
      try {
        if (gtVersion === 4 && typeof captchaInstanceRef.current.showCaptcha === 'function') {
          setHasClosed(false);
          setInitError(null);
          captchaInstanceRef.current.showCaptcha();
          return;
        }
        if (gtVersion === 3 && typeof captchaInstanceRef.current.verify === 'function') {
          setHasClosed(false);
          setInitError(null);
          captchaInstanceRef.current.verify();
          return;
        }
      } catch (_err) {
        // Ignore retry invocation error
      }
    }
    initializeCaptcha();
  };

  const displayedError = error || initError;

  return (
    <div className="flex flex-col gap-4 text-center py-2">
      <div className="flex flex-col items-center gap-2">
        <span className="text-3xl" aria-hidden="true">
          🧩
        </span>
        <h3 className="text-base font-bold text-[var(--color-text-main)]">
          Security Verification Required
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm leading-relaxed">
          HoYoverse requires a puzzle verification challenge to complete authentication.
        </p>
      </div>

      {displayedError && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-xs flex items-center justify-center gap-2"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{displayedError}</span>
        </div>
      )}

      {isLoadingScript && !displayedError && (
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--color-text-muted)]">Loading verification challenge...</p>
        </div>
      )}

      {hasClosed && !isSubmitting && (
        <div className="bg-[var(--elevated)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--color-text-muted)]">
          Verification was dismissed. Click below to reopen the challenge.
        </div>
      )}

      {isSubmitting && (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--color-text-muted)]">Submitting verification result...</p>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--elevated)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        {(hasClosed || displayedError) && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isSubmitting}
            className="genshin-btn px-6 py-2"
          >
            Retry Verification
          </button>
        )}
      </div>
    </div>
  );
}
