import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Settings from './Settings';
import useStore from '../store/useStore';
import * as driveSync from '../utils/driveSync';
import notify from '../utils/notify';

vi.mock('../store/useStore');
vi.mock('../utils/driveSync', () => ({
  uploadBackupToDrive: vi.fn(),
  downloadBackupFromDrive: vi.fn(),
  listBackupsFromDrive: vi.fn().mockResolvedValue([]),
  getAutoBackupStatus: vi.fn().mockResolvedValue(null),
}));
vi.mock('../utils/googleAuthHelper', () => ({
  triggerGoogleAuth: vi.fn(),
}));

describe('Settings Actions & Alert Replacement', () => {
  let container = null;
  let root = null;
  let storeState = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    storeState = {
      serverRegion: 'Asia',
      setServerRegion: vi.fn(),
      showDbBuilder: false,
      setShowDbBuilder: vi.fn(),
      autoBackupEnabled: false,
      setAutoBackupEnabled: vi.fn(),
      displayTimeZone: 'auto',
      setDisplayTimeZone: vi.fn(),
      importData: vi.fn(),
      importGoodData: vi.fn(),
      resetStore: vi.fn(),
      googleConnected: true,
      disconnectGoogleSession: vi.fn(),
      hoyolabConnected: false,
      connectHoyolabSession: vi.fn().mockResolvedValue({ success: true }),
      disconnectHoyolabSession: vi.fn().mockResolvedValue(undefined),
      roster: {},
      trackedWeapons: [],
      inventory: {},
    };

    useStore.mockImplementation((selector) => selector(storeState));
    useStore.getState = () => storeState;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('connects HoYoLAB and notifies success', async () => {
    const notifySpy = vi.spyOn(notify, 'success');

    await act(async () => {
      root.render(<Settings />);
    });

    const ltuidInput = container.querySelector('#hoyolab-ltuid');
    const ltokenInput = container.querySelector('#hoyolab-ltoken');
    const connectBtn = container.querySelector('button[type="button"].genshin-btn.w-full.mt-2');

    expect(ltuidInput).not.toBeNull();
    expect(ltokenInput).not.toBeNull();
    expect(connectBtn).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      valueSetter.call(ltuidInput, '123456');
      ltuidInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter.call(ltokenInput, 'tokenABC');
      ltokenInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      connectBtn.click();
    });

    expect(storeState.connectHoyolabSession).toHaveBeenCalledWith('123456', 'tokenABC');
    expect(notifySpy).toHaveBeenCalledWith('HoYoLAB connected successfully!');
  });

  it('triggers Google Drive manual backup and notifies success', async () => {
    const notifySpy = vi.spyOn(notify, 'success');
    driveSync.uploadBackupToDrive.mockResolvedValueOnce({ id: 'backup-123' });

    await act(async () => {
      root.render(<Settings />);
    });

    const syncBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Sync to Google Drive')
    );
    expect(syncBtn).not.toBeNull();

    await act(async () => {
      syncBtn.click();
    });

    expect(driveSync.uploadBackupToDrive).toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalledWith('Cloud sync successful!');
  });

  it('preserves factory reset confirmation safety before clearing store', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const notifySpy = vi.spyOn(notify, 'success');

    confirmSpy.mockReturnValueOnce(false);

    await act(async () => {
      root.render(<Settings />);
    });

    const resetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Factory Reset')
    );
    expect(resetBtn).not.toBeNull();

    await act(async () => {
      resetBtn.click();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(storeState.resetStore).not.toHaveBeenCalled();

    // Confirm true
    confirmSpy.mockReturnValueOnce(true);
    await act(async () => {
      resetBtn.click();
    });

    expect(storeState.resetStore).toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalledWith('Data reset successfully.');
  });
});
