import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notify, subscribeNotifications, clearNotifications } from './notify';

describe('notify utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearNotifications();
  });

  afterEach(() => {
    clearNotifications();
    vi.useRealTimers();
  });

  it('adds success, error, warning, and info notifications', () => {
    notify.success('Save succeeded');
    notify.error('Network failed');
    notify.warning('Check inputs');
    notify.info('New version available');

    const items = notify.getNotifications();
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ type: 'success', message: 'Save succeeded' });
    expect(items[1]).toMatchObject({ type: 'error', message: 'Network failed' });
    expect(items[2]).toMatchObject({ type: 'warning', message: 'Check inputs' });
    expect(items[3]).toMatchObject({ type: 'info', message: 'New version available' });
  });

  it('deduplicates identical active notifications of the same type', () => {
    notify.error('Connection lost');
    notify.error('Connection lost');
    notify.error('Connection lost');

    const items = notify.getNotifications();
    expect(items).toHaveLength(1);
  });

  it('allows same message with different types', () => {
    notify.info('Sync completed');
    notify.success('Sync completed');

    const items = notify.getNotifications();
    expect(items).toHaveLength(2);
  });

  it('supports manual dismissal', () => {
    const id = notify.info('Dismiss me');
    expect(notify.getNotifications()).toHaveLength(1);

    notify.dismiss(id);
    expect(notify.getNotifications()).toHaveLength(0);
  });

  it('auto-dismisses after duration', () => {
    notify.success('Auto dismiss', { duration: 3000 });
    expect(notify.getNotifications()).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(notify.getNotifications()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(notify.getNotifications()).toHaveLength(0);
  });

  it('notifies subscribers on change', () => {
    const listener = vi.fn();
    const unsub = subscribeNotifications(listener);

    expect(listener).toHaveBeenCalledWith([]);

    notify.warning('Caution');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ message: 'Caution' })])
    );

    unsub();
    notify.info('After unsub');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
