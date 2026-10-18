import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NotificationContainer from './NotificationContainer';
import * as notifyModule from '../utils/notify';

describe('NotificationContainer Safe Area & Toast Presentation', () => {
  let container = null;
  let root = null;
  let subscriberCallback = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(notifyModule, 'subscribeNotifications').mockImplementation((cb) => {
      subscriberCallback = cb;
      return () => {
        subscriberCallback = null;
      };
    });
    vi.spyOn(notifyModule, 'dismissNotification').mockImplementation(vi.fn());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders null when there are no active notifications', () => {
    act(() => {
      root.render(<NotificationContainer />);
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders notification region with safe-area inset bottom styling when active', () => {
    act(() => {
      root.render(<NotificationContainer />);
    });

    act(() => {
      subscriberCallback([
        { id: '1', message: 'Sync complete', type: 'success' },
      ]);
    });

    const region = container.querySelector('[role="region"][aria-label="Notifications"]');
    expect(region).not.toBeNull();
    expect(region.style.bottom).toBe('max(1rem, env(safe-area-inset-bottom, 1rem))');
    expect(region.textContent).toContain('Sync complete');
  });

  it('allows dismissing notifications via close button', () => {
    act(() => {
      root.render(<NotificationContainer />);
    });

    act(() => {
      subscriberCallback([
        { id: 'msg-42', message: 'Warning notice', type: 'warning' },
      ]);
    });

    const dismissBtn = container.querySelector('button[aria-label="Dismiss notification"]');
    expect(dismissBtn).not.toBeNull();

    act(() => {
      dismissBtn.click();
    });

    expect(notifyModule.dismissNotification).toHaveBeenCalledWith('msg-42');
  });
});
