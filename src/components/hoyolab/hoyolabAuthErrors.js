/**
 * Safe error message mapper for HoYoLAB authentication state machine.
 *
 * Invariants:
 * - Maps status codes and safe details into clear, friendly error messages
 * - Never leaks internal exception names, cookies, or raw tracebacks
 */

export function mapHoyolabAuthError(status, detail, stage = 'credentials') {
  const detailStr = typeof detail === 'string' ? detail.toLowerCase() : '';

  // Invariant: Never disclose raw response bodies, tokens, tickets, cookies, or stack traces
  const isSuspicious =
    detailStr.includes('traceback') ||
    detailStr.includes('trace') ||
    detailStr.includes('stack') ||
    detailStr.includes('cookie') ||
    detailStr.includes('token') ||
    detailStr.includes('ticket') ||
    detailStr.includes('geetest') ||
    detailStr.includes('validate') ||
    detailStr.includes('challenge') ||
    detailStr.includes('stoken') ||
    detailStr.includes('ltoken') ||
    detailStr.includes('ltuid') ||
    detailStr.includes('{') ||
    detailStr.includes('}') ||
    detailStr.includes('<') ||
    detailStr.includes('>') ||
    detailStr.length > 100;

  if (status === 401) {
    if (detailStr.includes('expired') || detailStr.includes('no active') || detailStr.includes('session')) {
      return 'Your sign-in session expired. Please start again.';
    }
    return 'Invalid credentials. Please check your username and password.';
  }

  if (status === 400) {
    if (
      detailStr.includes('security verification') ||
      detailStr.includes('expired or was rejected') ||
      detailStr.includes('geetest')
    ) {
      return 'Security verification expired or was rejected. Please start sign-in again.';
    }
    if (stage === 'emailVerify' || detailStr.includes('code') || detailStr.includes('otp')) {
      return 'Invalid or expired verification code. Please check and try again.';
    }
    if (stage === 'accounts' || detailStr.includes('uid')) {
      return 'Selected game account could not be verified. Please try another account.';
    }
    if (!isSuspicious && typeof detail === 'string' && detail.trim().length > 0) {
      return detail.trim();
    }
    return 'Invalid request. Please check your input and try again.';
  }

  if (status === 429) {
    if (
      detailStr.includes('sign-in') ||
      detailStr.includes('sign in') ||
      detailStr.includes('attempt')
    ) {
      return 'Too many sign-in attempts. Please wait before trying again.';
    }
    if (
      detailStr.includes('verification') ||
      detailStr.includes('limit') ||
      stage === 'emailVerify'
    ) {
      return 'HoYoverse is temporarily limiting verification-code requests. Please wait before trying again.';
    }
    return 'Too many sign-in attempts. Please wait before trying again.';
  }

  if (status === 502) {
    return 'HoYoLAB authentication service is temporarily unavailable. Please try again.';
  }

  if (status === 503) {
    return 'Authentication service is temporarily unavailable. Please try again shortly.';
  }

  if (status === 504) {
    return 'Connection to HoYoLAB timed out. Please check your network and try again.';
  }

  if (status === 500) {
    return 'An unexpected server error occurred. Please try again.';
  }

  return 'Failed to complete HoYoLAB sign-in. Please try again.';
}
