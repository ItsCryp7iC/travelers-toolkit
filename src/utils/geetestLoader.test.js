import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadGeetestScript, resetGeetestLoaderForTesting } from './geetestLoader';

describe('geetestLoader', () => {
  beforeEach(() => {
    resetGeetestLoaderForTesting();
    delete window.initGeetest4;
    delete window.initGeetest;
  });

  afterEach(() => {
    resetGeetestLoaderForTesting();
    delete window.initGeetest4;
    delete window.initGeetest;
    vi.restoreAllMocks();
  });

  it('rejects on unsupported version', async () => {
    await expect(loadGeetestScript(5)).rejects.toThrow('Unsupported Geetest version: 5');
  });

  it('resolves immediately if window.initGeetest4 is already present', async () => {
    window.initGeetest4 = vi.fn();
    const result = await loadGeetestScript(4);
    expect(result).toBe(true);
    expect(document.querySelector('script[data-geetest-version="4"]')).toBeNull();
  });

  it('resolves immediately if window.initGeetest is already present for v3', async () => {
    window.initGeetest = vi.fn();
    const result = await loadGeetestScript(3);
    expect(result).toBe(true);
    expect(document.querySelector('script[data-geetest-version="3"]')).toBeNull();
  });

  it('appends script with referrerPolicy="no-referrer" for v4 and resolves on onload when global exists', async () => {
    const promise = loadGeetestScript(4);
    const script = document.querySelector('script[data-geetest-version="4"]');

    expect(script).not.toBeNull();
    expect(script.src).toBe('https://static.geetest.com/v4/gt4.js');
    expect(script.referrerPolicy).toBe('no-referrer');
    expect(script.async).toBe(true);

    // Simulate script load with global ready
    window.initGeetest4 = vi.fn();
    script.onload();

    const result = await promise;
    expect(result).toBe(true);
  });

  it('rejects on onload if window.initGeetest4 global is missing after load', async () => {
    const promise = loadGeetestScript(4);
    const script = document.querySelector('script[data-geetest-version="4"]');

    expect(script).not.toBeNull();
    // Do NOT set window.initGeetest4
    script.onload();

    await expect(promise).rejects.toThrow(
      'Geetest v4 script loaded but window.initGeetest4 is not available'
    );
    expect(document.querySelector('script[data-geetest-version="4"]')).toBeNull();
  });

  it('appends script for v3 and resolves on onload when global exists', async () => {
    const promise = loadGeetestScript(3);
    const script = document.querySelector('script[data-geetest-version="3"]');

    expect(script).not.toBeNull();
    expect(script.src).toBe('https://static.geetest.com/static/js/gt.0.5.0.js');
    expect(script.referrerPolicy).toBe('no-referrer');

    window.initGeetest = vi.fn();
    script.onload();

    const result = await promise;
    expect(result).toBe(true);
  });

  it('rejects on onload if window.initGeetest global is missing for v3', async () => {
    const promise = loadGeetestScript(3);
    const script = document.querySelector('script[data-geetest-version="3"]');

    expect(script).not.toBeNull();
    // Do NOT set window.initGeetest
    script.onload();

    await expect(promise).rejects.toThrow(
      'Geetest v3 script loaded but window.initGeetest is not available'
    );
    expect(document.querySelector('script[data-geetest-version="3"]')).toBeNull();
  });

  it('reuses existing in-flight promise and does not append duplicate script tags', async () => {
    const p1 = loadGeetestScript(4);
    const p2 = loadGeetestScript(4);

    expect(p1).toBe(p2);
    const scripts = document.querySelectorAll('script[data-geetest-version="4"]');
    expect(scripts.length).toBe(1);

    window.initGeetest4 = vi.fn();
    scripts[0].onload();
    await p1;
  });

  it('rejects and removes script element on onerror', async () => {
    const promise = loadGeetestScript(4);
    const script = document.querySelector('script[data-geetest-version="4"]');
    expect(script).not.toBeNull();

    script.onerror();

    await expect(promise).rejects.toThrow('Failed to load Geetest v4 script from upstream CDN');
    expect(document.querySelector('script[data-geetest-version="4"]')).toBeNull();
  });
});
