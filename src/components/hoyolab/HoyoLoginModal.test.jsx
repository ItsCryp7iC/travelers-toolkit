import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HoyoLoginModal from './HoyoLoginModal';
import useStore from '../../store/useStore';
import * as geetestLoader from '../../utils/geetestLoader';

vi.mock('../../store/useStore');

describe('HoyoLoginModal Component & State Machine', () => {
  let container = null;
  let root = null;
  let storeState = null;
  let mockFetch = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    storeState = {
      hoyolabConnected: false,
      hoyolabAccount: null,
      setHoyolabConnected: vi.fn((val) => {
        storeState.hoyolabConnected = val;
      }),
      setHoyolabAccount: vi.fn((acc) => {
        storeState.hoyolabAccount = acc;
      }),
      handleSyncNotes: vi.fn().mockResolvedValue({ success: true }),
    };

    useStore.mockImplementation((selector) => selector(storeState));
    useStore.getState = () => storeState;

    // Reset storage
    window.localStorage.clear();
    window.sessionStorage.clear();

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Spy on geetest loader to avoid network requests
    vi.spyOn(geetestLoader, 'loadGeetestScript').mockResolvedValue(true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    delete window.initGeetest4;
    delete window.initGeetest;
  });

  // -------------------------------------------------------------------------
  // 1. Initial Render & Disclosure Text
  // -------------------------------------------------------------------------
  it('renders email/password step with disclosure text and autocomplete attributes', async () => {
    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const disclosure = container.textContent;

    expect(accountInput).not.toBeNull();
    expect(accountInput.getAttribute('autocomplete')).toBe('username');
    expect(passwordInput).not.toBeNull();
    expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');

    expect(disclosure).toContain(
      "Your HoYoverse credentials are sent securely to Traveler's Toolkit's backend only to authenticate with HoYoverse."
    );
    expect(disclosure).toContain('Your password is not stored permanently.');
  });

  // -------------------------------------------------------------------------
  // 2. Section 21: Password Non-Retention & Security Invariants
  // -------------------------------------------------------------------------
  it('strictly isolates password in component memory: never in localStorage, sessionStorage, or store', async () => {
    const testSecret = 'SUPER_SECRET_USER_PASSWORD_XYZ123';

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const passwordInput = container.querySelector('#hoyolab-login-password');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(passwordInput, testSecret);
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Check localStorage & sessionStorage
    expect(window.localStorage.getItem('password')).toBeNull();
    expect(window.sessionStorage.getItem('password')).toBeNull();
    for (let i = 0; i < window.localStorage.length; i++) {
      const val = window.localStorage.getItem(window.localStorage.key(i));
      expect(val).not.toContain(testSecret);
    }
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const val = window.sessionStorage.getItem(window.sessionStorage.key(i));
      expect(val).not.toContain(testSecret);
    }

    // Check Zustand store
    expect(storeState.password).toBeUndefined();
    expect(storeState.credentials).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. Section 22: Token Non-Exposure Invariants
  // -------------------------------------------------------------------------
  it('never expects or stores ltuid, ltoken, stoken, or action tickets in frontend state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [
          {
            uid: 700123456,
            nickname: 'TravelerTest',
            server: 'os_euro',
            serverName: 'Europe',
            level: 60,
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        account: {
          uid: 700123456,
          nickname: 'TravelerTest',
          server: 'os_euro',
          serverName: 'Europe',
          level: 60,
        },
      }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    // Accounts step should be rendered
    expect(container.textContent).toContain('Select Genshin Impact Account');
    expect(container.textContent).toContain('TravelerTest');
    expect(container.textContent).toContain('UID: 700123456');

    // Tokens must never exist in store
    expect(storeState.ltuid).toBeUndefined();
    expect(storeState.ltoken).toBeUndefined();
    expect(storeState.stoken).toBeUndefined();
    expect(storeState.action_ticket).toBeUndefined();

    // Confirm connection
    const connectBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      connectBtn.click();
    });

    expect(storeState.setHoyolabConnected).toHaveBeenCalledWith(true);
    expect(storeState.setHoyolabAccount).toHaveBeenCalledWith({
      uid: 700123456,
      nickname: 'TravelerTest',
      server: 'os_euro',
      serverName: 'Europe',
      level: 60,
    });
  });

  // -------------------------------------------------------------------------
  // 4. Section 23: Geetest v4 Flow (Ready, Success, Close, Error)
  // -------------------------------------------------------------------------
  it('handles Geetest v4 challenge lifecycle: init, callback, and success transition', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'geetest',
        gtVersion: 4,
        apiServer: 'gcaptcha4.captchami.com',
        mmt: {
          captchaId: 'test_gt4_id',
          riskType: 'ai',
          sessionId: 'session_123',
        },
      }),
    });

    let mockCaptchaInstance = null;
    window.initGeetest4 = vi.fn((params, callback) => {
      mockCaptchaInstance = {
        showCaptcha: vi.fn(),
        getValidate: vi.fn(() => ({
          captcha_id: 'test_gt4_id',
          lot_number: 'lot_abc',
          pass_token: 'token_def',
          gen_time: '123456',
          captcha_output: 'output_ghi',
        })),
        onReady: vi.fn((cb) => cb()),
        onSuccess: vi.fn((cb) => {
          mockCaptchaInstance._triggerSuccess = cb;
        }),
        onClose: vi.fn((cb) => {
          mockCaptchaInstance._triggerClose = cb;
        }),
        onError: vi.fn((cb) => {
          mockCaptchaInstance._triggerError = cb;
        }),
        destroy: vi.fn(),
      };
      callback(mockCaptchaInstance);
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    // Verification step should be active
    expect(container.textContent).toContain('Security Verification Required');
    expect(window.initGeetest4).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaId: 'test_gt4_id',
        product: 'bind',
        userInfo: JSON.stringify({ session_id: 'session_123' }),
        apiServers: ['gcaptcha4.captchami.com'],
      }),
      expect.any(Function)
    );
    expect(mockCaptchaInstance.showCaptcha).toHaveBeenCalled();

    // Mock callback from backend for geetest submission
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [
          {
            uid: 700123456,
            nickname: 'TravelerTest',
            server: 'os_euro',
            serverName: 'Europe',
            level: 60,
          },
        ],
      }),
    });

    // Trigger Geetest success
    await act(async () => {
      mockCaptchaInstance._triggerSuccess();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/hoyolab/auth/geetest',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          gt_version: 4,
          captcha_id: 'test_gt4_id',
          lot_number: 'lot_abc',
          pass_token: 'token_def',
          gen_time: '123456',
          captcha_output: 'output_ghi',
        }),
      })
    );

    // Should transition to accounts
    expect(container.textContent).toContain('Select Genshin Impact Account');
  });

  it('handles Geetest v4 close and allows retry without resetting credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'geetest',
        gtVersion: 4,
        apiServer: 'gcaptcha4.captchami.com',
        mmt: {
          captchaId: 'test_gt4_id',
        },
      }),
    });

    let mockCaptchaInstance = null;
    window.initGeetest4 = vi.fn((params, callback) => {
      mockCaptchaInstance = {
        showCaptcha: vi.fn(),
        getValidate: vi.fn(),
        onReady: vi.fn((cb) => cb()),
        onSuccess: vi.fn(),
        onClose: vi.fn((cb) => {
          mockCaptchaInstance._triggerClose = cb;
        }),
        onError: vi.fn(),
        destroy: vi.fn(),
      };
      callback(mockCaptchaInstance);
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    // Simulate user closing captcha
    await act(async () => {
      mockCaptchaInstance._triggerClose();
    });

    expect(container.textContent).toContain('Verification was dismissed.');
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Retry Verification')
    );
    expect(retryBtn).not.toBeNull();

    await act(async () => {
      retryBtn.click();
    });

    expect(mockCaptchaInstance.showCaptcha).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 5. Section 23: Geetest v3 Compatibility
  // -------------------------------------------------------------------------
  it('supports Geetest v3 challenge and submits v3 payload fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'geetest',
        gtVersion: 3,
        mmt: {
          gt: 'test_gt3',
          challenge: 'test_challenge',
          new_captcha: 1,
          success: 1,
        },
      }),
    });

    let mockCaptchaV3 = null;
    window.initGeetest = vi.fn((params, callback) => {
      mockCaptchaV3 = {
        verify: vi.fn(),
        getValidate: vi.fn(() => ({
          geetest_challenge: 'ch_123',
          geetest_validate: 'val_456',
          geetest_seccode: 'sec_789',
        })),
        onReady: vi.fn((cb) => cb()),
        onSuccess: vi.fn((cb) => {
          mockCaptchaV3._triggerSuccess = cb;
        }),
        onClose: vi.fn(),
        onError: vi.fn(),
        destroy: vi.fn(),
      };
      callback(mockCaptchaV3);
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    expect(window.initGeetest).toHaveBeenCalledWith(
      expect.objectContaining({
        gt: 'test_gt3',
        challenge: 'test_challenge',
        api_server: 'api-na.geetest.com',
        product: 'bind',
      }),
      expect.any(Function)
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    await act(async () => {
      mockCaptchaV3._triggerSuccess();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/hoyolab/auth/geetest',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          gt_version: 3,
          geetest_challenge: 'ch_123',
          geetest_validate: 'val_456',
          geetest_seccode: 'sec_789',
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 6. Section 13: Email Verification Step (6 Digits)
  // -------------------------------------------------------------------------
  it('handles email verification 2FA step', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'emailVerify',
      }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    expect(container.textContent).toContain('Email Verification Required');
    const codeInput = container.querySelector('#hoyolab-verify-code');
    expect(codeInput).not.toBeNull();
    expect(codeInput.getAttribute('inputmode')).toBe('numeric');
    expect(codeInput.getAttribute('maxlength')).toBe('6');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(codeInput, '123456');
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const verifyBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      verifyBtn.click();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/hoyolab/auth/email-verify',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ code: '123456' }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 7. Section 18 & 19: Cancel & Session Expiry Cleanup
  // -------------------------------------------------------------------------
  it('calls DELETE /api/hoyolab/auth/flow and resets state on cancel', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'emailVerify',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: false }),
    });

    const onClose = vi.fn();
    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cancel')
    );

    await act(async () => {
      cancelBtn.click();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/hoyolab/auth/flow',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('resets to credentials on 401 flow expiry error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'emailVerify',
      }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    expect(container.textContent).toContain('Email Verification Required');

    // Simulate expired session on verification attempt
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({
        detail: 'Authentication session expired or invalid.',
      }),
    });

    const codeInput = container.querySelector('#hoyolab-verify-code');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(codeInput, '123456');
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const verifyBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      verifyBtn.click();
    });

    // Should return to credentials step and display friendly expiry error
    expect(container.querySelector('#hoyolab-login-account')).not.toBeNull();
    expect(container.textContent).toContain('Your sign-in session expired. Please start again.');
  });

  // -------------------------------------------------------------------------
  // 8. Section 25: Multiple Accounts Discovery & Selection
  // -------------------------------------------------------------------------
  it('renders multiple account cards and allows selecting a specific UID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [
          {
            uid: 700111111,
            nickname: 'EuroMain',
            server: 'os_euro',
            serverName: 'Europe',
            level: 58,
          },
          {
            uid: 600222222,
            nickname: 'AmericaAlt',
            server: 'os_usa',
            serverName: 'America',
            level: 60,
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        account: {
          uid: 600222222,
          nickname: 'AmericaAlt',
          server: 'os_usa',
          serverName: 'America',
          level: 60,
        },
      }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    expect(container.textContent).toContain('Select Genshin Impact Account');
    expect(container.textContent).toContain('EuroMain');
    expect(container.textContent).toContain('AmericaAlt');

    // Click second account card (AmericaAlt)
    const secondCard = Array.from(container.querySelectorAll('.cursor-pointer')).find((el) =>
      el.textContent.includes('AmericaAlt')
    );
    expect(secondCard).not.toBeNull();

    await act(async () => {
      secondCard.click();
    });

    const connectBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      connectBtn.click();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/hoyolab/auth/complete',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ uid: 600222222 }),
      })
    );

    expect(storeState.setHoyolabAccount).toHaveBeenCalledWith({
      uid: 600222222,
      nickname: 'AmericaAlt',
      server: 'os_usa',
      serverName: 'America',
      level: 60,
    });
  });

  // -------------------------------------------------------------------------
  // 9. Section 25: Zero Accounts Discovered
  // -------------------------------------------------------------------------
  it('renders clean message when zero Genshin accounts are found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [],
      }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    expect(container.textContent).toContain('No Genshin Impact Accounts Found');
  });

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 10. Escape Key Closes Modal and Cancels Flow
  // -------------------------------------------------------------------------
  it('closes modal and triggers cancel flow on Escape key', async () => {
    const onClose = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: false }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 11. Section 6: Double-Submit Guard on Geetest onSuccess Callback
  // -------------------------------------------------------------------------
  it('prevents duplicate POST /api/hoyolab/auth/geetest when onSuccess is triggered multiple times', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'geetest',
        gtVersion: 4,
        apiServer: 'gcaptcha4.captchami.com',
        mmt: {
          captchaId: 'test_gt4_id',
          riskType: 'ai',
          sessionId: 'session_123',
        },
      }),
    });

    let mockCaptchaInstance = null;
    window.initGeetest4 = vi.fn((params, callback) => {
      mockCaptchaInstance = {
        showCaptcha: vi.fn(),
        getValidate: vi.fn(() => ({
          captcha_id: 'test_gt4_id',
          lot_number: 'lot_abc',
          pass_token: 'token_def',
          gen_time: '123456',
          captcha_output: 'output_ghi',
        })),
        onReady: vi.fn((cb) => cb()),
        onSuccess: vi.fn((cb) => {
          mockCaptchaInstance._triggerSuccess = cb;
        }),
        onClose: vi.fn(),
        onError: vi.fn(),
        destroy: vi.fn(),
      };
      callback(mockCaptchaInstance);
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        nextStep: 'complete',
      }),
    });

    // Rapidly trigger onSuccess twice
    await act(async () => {
      mockCaptchaInstance._triggerSuccess();
      mockCaptchaInstance._triggerSuccess();
    });

    const geetestCalls = mockFetch.mock.calls.filter(
      ([url]) => url === '/api/hoyolab/auth/geetest'
    );
    expect(geetestCalls.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 12. Section 7: Modal Close / Unmount Cleanup Never Double-Deletes
  // -------------------------------------------------------------------------
  it('calls DELETE /api/hoyolab/auth/flow exactly once on close, and unmount does not double-delete', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'geetest',
        gtVersion: 4,
        mmt: { captchaId: 'test_id' },
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: false }),
    });

    window.initGeetest4 = vi.fn((params, callback) => {
      callback({
        showCaptcha: vi.fn(),
        onReady: vi.fn(),
        onSuccess: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
        destroy: vi.fn(),
      });
    });

    const onClose = vi.fn();
    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    // Close modal via close button
    const closeBtn = container.querySelector('button[aria-label="Close modal"]');
    await act(async () => {
      closeBtn.click();
    });

    const deleteCallsBeforeUnmount = mockFetch.mock.calls.filter(
      ([url, opts]) => url === '/api/hoyolab/auth/flow' && opts?.method === 'DELETE'
    );
    expect(deleteCallsBeforeUnmount.length).toBe(1);

    // Now unmount the component
    await act(async () => {
      root.unmount();
      root = createRoot(container);
    });

    const deleteCallsAfterUnmount = mockFetch.mock.calls.filter(
      ([url, opts]) => url === '/api/hoyolab/auth/flow' && opts?.method === 'DELETE'
    );
    expect(deleteCallsAfterUnmount.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 13. Section 8: Complete Success Ordering (No DELETE /flow after success)
  // -------------------------------------------------------------------------
  it('does NOT call DELETE /api/hoyolab/auth/flow when modal closes after successful completion', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nextStep: 'complete' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [{ uid: 700123456, nickname: 'TravelerTest', server: 'os_euro' }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        account: { uid: 700123456, nickname: 'TravelerTest', server: 'os_euro' },
      }),
    });

    const onClose = vi.fn();
    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    // Connect account
    const connectBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      connectBtn.click();
    });

    expect(onClose).toHaveBeenCalled();

    // Verify DELETE /flow was NEVER called
    const deleteCalls = mockFetch.mock.calls.filter(
      ([url, opts]) => url === '/api/hoyolab/auth/flow' && opts?.method === 'DELETE'
    );
    expect(deleteCalls.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 14. Section 11: Password Cleared Immediately on First Successful Submit
  // -------------------------------------------------------------------------
  it('wipes password immediately from memory upon first successful submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nextStep: 'geetest',
        gtVersion: 4,
        mmt: { captchaId: 'test_gt4' },
      }),
    });

    window.initGeetest4 = vi.fn((params, callback) => {
      callback({
        showCaptcha: vi.fn(),
        onReady: vi.fn(),
        onSuccess: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
        destroy: vi.fn(),
      });
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'mysecretpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(passwordInput.value).toBe('mysecretpassword');

    await act(async () => {
      submitBtn.click();
    });

    // Password input is no longer even in the DOM, and modal state password has been wiped
    expect(container.querySelector('#hoyolab-login-password')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 15. Section 12: Error Disclosure Sanitization
  // -------------------------------------------------------------------------
  it('sanitizes user-facing errors: never discloses raw bodies, tokens, tickets, or tracebacks', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({
        detail: 'ActionTicket token=xyz123 stoken=abc cookie expired Traceback: file foo.py',
      }),
    });

    await act(async () => {
      root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
    });

    const accountInput = container.querySelector('#hoyolab-login-account');
    const passwordInput = container.querySelector('#hoyolab-login-password');
    const submitBtn = container.querySelector('button[type="submit"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(accountInput, 'testuser@example.com');
      accountInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(passwordInput, 'testpassword');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitBtn.click();
    });

    const displayedText = container.textContent;
    expect(displayedText).not.toContain('ActionTicket');
    expect(displayedText).not.toContain('token=xyz123');
    expect(displayedText).not.toContain('stoken=abc');
    expect(displayedText).not.toContain('Traceback');
    expect(displayedText).toContain('Invalid request. Please check your input and try again.');
  });
});
