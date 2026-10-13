import React, { useState } from 'react';

export default function HoyoEmailLoginStep({
  account,
  password,
  onChangeAccount,
  onChangePassword,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!account.trim() || !password) return;
    onSubmit({ account: account.trim(), password });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-[var(--elevated)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2.5">
        <span className="text-base leading-none select-none" aria-hidden="true">
          🛡️
        </span>
        <p className="leading-relaxed">
          Your HoYoverse credentials are sent securely to Traveler&apos;s Toolkit&apos;s backend only
          to authenticate with HoYoverse. Your password is not stored permanently.
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
          htmlFor="hoyolab-login-account"
          className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block"
        >
          HoYoverse Email or Username
        </label>
        <input
          id="hoyolab-login-account"
          type="text"
          autoComplete="username"
          className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary transition-colors disabled:opacity-50"
          value={account}
          onChange={(e) => onChangeAccount(e.target.value)}
          placeholder="Enter email or username"
          disabled={isSubmitting}
          autoFocus
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label
            htmlFor="hoyolab-login-password"
            className="text-xs font-semibold text-[var(--color-text-main)] block"
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-primary transition-colors select-none"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id="hoyolab-login-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary transition-colors disabled:opacity-50"
          value={password}
          onChange={(e) => onChangePassword(e.target.value)}
          placeholder="Enter password"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex justify-end gap-3 mt-2">
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
          disabled={isSubmitting || !account.trim() || !password}
          className="genshin-btn px-6 py-2 min-w-[120px] flex justify-center items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="inline-block animate-spin" aria-hidden="true">
                ⏳
              </span>
              <span>Signing in...</span>
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </div>
    </form>
  );
}
