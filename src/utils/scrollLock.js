/**
 * Reference-counted body scroll lock utility.
 * Prevents overlapping or nested modals from prematurely unlocking
 * or permanently locking document.body.style.overflow.
 */

let lockCount = 0;
let originalOverflow = '';

/**
 * Acquire a lock on body scrolling.
 * Sets document.body.style.overflow to 'hidden' on the first acquisition,
 * recording the pre-existing overflow style.
 * Returns a release callback that decrements the lock count and restores
 * the original overflow style only when all acquired locks are released.
 *
 * @returns {() => void} Release callback
 */
export function acquireBodyScrollLock() {
  if (typeof document === 'undefined') {
    return () => {};
  }

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow;
      originalOverflow = '';
    }
  };
}

/**
 * Reset scroll lock state. Intended for test environments.
 */
export function resetBodyScrollLockForTesting() {
  lockCount = 0;
  originalOverflow = '';
}

