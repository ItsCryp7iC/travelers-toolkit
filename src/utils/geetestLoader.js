/**
 * Safe dynamic script loader for Geetest v4 and v3 SDKs.
 *
 * Invariants:
 * - Only loads when required (lazy loading, never on startup)
 * - Appends at most one script tag per version
 * - Uses referrerPolicy="no-referrer"
 * - No inline scripts, no eval, no persistent storage
 * - Rejects cleanly on script loading failure or timeout
 */

const GEETEST_URLS = {
  4: 'https://static.geetest.com/v4/gt4.js',
  3: 'https://static.geetest.com/static/js/gt.0.5.0.js',
};

// In-memory cache for script load promises (version -> Promise<boolean>)
let loadPromises = {};

/**
 * Loads the appropriate Geetest SDK script dynamically.
 *
 * @param {3 | 4} version
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<boolean>} Resolves to true when the SDK is ready
 */
export function loadGeetestScript(version, timeoutMs = 15000) {
  if (version !== 3 && version !== 4) {
    return Promise.reject(new Error(`Unsupported Geetest version: ${version}`));
  }

  // If already loaded on window, resolve immediately
  if (version === 4 && typeof window !== 'undefined' && typeof window.initGeetest4 === 'function') {
    return Promise.resolve(true);
  }
  if (version === 3 && typeof window !== 'undefined' && typeof window.initGeetest === 'function') {
    return Promise.resolve(true);
  }

  // Return existing in-flight or completed promise if already requested
  if (loadPromises[version]) {
    return loadPromises[version];
  }

  loadPromises[version] = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document is not available'));
      return;
    }

    const scriptUrl = GEETEST_URLS[version];
    const existingScript = document.querySelector(`script[data-geetest-version="${version}"]`);

    if (existingScript) {
      // Script tag exists in DOM, wait for window global to become available
      const checkInterval = setInterval(() => {
        const isReady =
          version === 4
            ? typeof window.initGeetest4 === 'function'
            : typeof window.initGeetest === 'function';
        if (isReady) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Timed out waiting for Geetest v${version} SDK to initialize`));
      }, timeoutMs);
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.dataset.geetestVersion = String(version);

    let timeoutTimer = null;

    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      script.onload = null;
      script.onerror = null;
    };

    script.onload = () => {
      cleanup();
      const isReady =
        version === 4
          ? typeof window !== 'undefined' && typeof window.initGeetest4 === 'function'
          : typeof window !== 'undefined' && typeof window.initGeetest === 'function';

      if (!isReady) {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        delete loadPromises[version];
        reject(
          new Error(
            `Geetest v${version} script loaded but window.initGeetest${version === 4 ? '4' : ''} is not available`
          )
        );
        return;
      }
      resolve(true);
    };

    script.onerror = () => {
      cleanup();
      // Remove failed script tag so retrying can attempt a fresh load
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete loadPromises[version];
      reject(new Error(`Failed to load Geetest v${version} script from upstream CDN`));
    };

    timeoutTimer = setTimeout(() => {
      cleanup();
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete loadPromises[version];
      reject(new Error(`Loading Geetest v${version} script timed out`));
    }, timeoutMs);

    document.head.appendChild(script);
  });

  return loadPromises[version];
}

/**
 * Reset loader cache and remove any inserted script elements.
 * Strictly for unit test isolation.
 */
export function resetGeetestLoaderForTesting() {
  loadPromises = {};
  if (typeof document !== 'undefined') {
    const scripts = document.querySelectorAll('script[data-geetest-version]');
    scripts.forEach((s) => s.parentNode && s.parentNode.removeChild(s));
  }
}
