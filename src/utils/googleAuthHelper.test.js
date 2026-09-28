import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerGoogleAuth } from './googleAuthHelper';
import useStore from '../store/useStore';

// Mock the zustand store
vi.mock('../store/useStore', () => ({
  default: {
    getState: vi.fn(),
  },
}));

describe('googleAuthHelper', () => {
  let mockPopup;

  beforeEach(() => {
    vi.useFakeTimers();

    mockPopup = {
      close: vi.fn(),
    };

    // Mock window.open
    vi.stubGlobal('open', vi.fn(() => mockPopup));

    // Mock window.dispatchEvent
    vi.spyOn(window, 'dispatchEvent');

    // Default store mock
    useStore.getState.mockReturnValue({
      checkGoogleSession: vi.fn().mockResolvedValue(true),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('resolves false if popup is blocked', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    const result = await triggerGoogleAuth();
    expect(result).toBe(false);
  });

  it('resolves true on valid success message and successful session check', async () => {
    const promise = triggerGoogleAuth();

    // Simulate postMessage from popup
    const messageEvent = new MessageEvent('message', {
      origin: window.location.origin,
      source: mockPopup,
      data: { type: 'google_auth', success: true },
    });
    window.dispatchEvent(messageEvent);

    const result = await promise;
    expect(result).toBe(true);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(Event));
    expect(window.dispatchEvent.mock.calls.some(call => call[0].type === 'google_interactive_login')).toBe(true);
  });

  it('resolves false on valid success message but failed session check', async () => {
    useStore.getState.mockReturnValue({
      checkGoogleSession: vi.fn().mockResolvedValue(false),
    });
    const promise = triggerGoogleAuth();

    const messageEvent = new MessageEvent('message', {
      origin: window.location.origin,
      source: mockPopup,
      data: { type: 'google_auth', success: true },
    });
    window.dispatchEvent(messageEvent);

    const result = await promise;
    expect(result).toBe(false);
    expect(window.dispatchEvent.mock.calls.some(call => call[0].type === 'google_interactive_login')).toBe(false);
  });

  it('resolves false on failure message', async () => {
    const promise = triggerGoogleAuth();

    const messageEvent = new MessageEvent('message', {
      origin: window.location.origin,
      source: mockPopup,
      data: { type: 'google_auth', success: false },
    });
    window.dispatchEvent(messageEvent);

    const result = await promise;
    expect(result).toBe(false);
  });

  it('resolves false on timeout', async () => {
    const promise = triggerGoogleAuth();

    // Fast forward past the 2 minute timeout
    vi.advanceTimersByTime(2 * 60 * 1000);

    const result = await promise;
    expect(result).toBe(false);
  });

  it('ignores messages from wrong origin or source', () => {
    // We cannot await the promise here directly without resolving it,
    // but we can verify it doesn't resolve by advancing timers a bit
    // and verifying no store checks happened.
    triggerGoogleAuth();

    // Wrong origin
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.com',
      source: mockPopup,
      data: { type: 'google_auth', success: true },
    }));

    // Wrong source
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: {}, // not mockPopup
      data: { type: 'google_auth', success: true },
    }));

    // Wrong type
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: mockPopup,
      data: { type: 'other', success: true },
    }));

    expect(useStore.getState().checkGoogleSession).not.toHaveBeenCalled();
  });
});
