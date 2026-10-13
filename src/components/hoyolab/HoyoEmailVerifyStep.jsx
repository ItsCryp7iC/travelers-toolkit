import React, { useState } from 'react';

export default function HoyoEmailVerifyStep({
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}) {
  const [code, setCode] = useState('');

  const handleChange = (e) => {
    // Only allow digits up to 6 characters
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    onSubmit(code);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center py-1">
        <span className="text-3xl" aria-hidden="true">
          📧
        </span>
        <h3 className="text-base font-bold text-[var(--color-text-main)]">
          Email Verification Required
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm leading-relaxed">
          A 6-digit verification code was sent to your HoYoverse account email address. Please enter
          it below to verify your sign-in.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-xs flex items-center gap-2"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="hoyolab-verify-code"
          className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block text-center"
        >
          6-Digit Security Code
        </label>
        <input
          id="hoyolab-verify-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          pattern="[0-9]*"
          autoComplete="one-time-code"
          className="w-full text-center text-xl tracking-[0.5em] font-mono bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2.5 text-[var(--color-text-main)] outline-none focus:border-primary transition-colors disabled:opacity-50"
          value={code}
          onChange={handleChange}
          placeholder="••••••"
          disabled={isSubmitting}
          autoFocus
        />
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--elevated)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || code.length !== 6}
          className="genshin-btn px-6 py-2 min-w-[120px] flex justify-center items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="inline-block animate-spin" aria-hidden="true">
                ⏳
              </span>
              <span>Verifying...</span>
            </>
          ) : (
            'Verify Code'
          )}
        </button>
      </div>
    </form>
  );
}
