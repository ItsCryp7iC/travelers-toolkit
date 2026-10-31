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
      hoyolabAccount: null,
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

  describe('Settings Responsive Architecture & Controls (R5C)', () => {
    it('renders all Settings cards with responsive grid classes', async () => {
      await act(async () => {
        root.render(<Settings />);
      });

      // Section titles
      expect(container.textContent).toContain('Cloud Backup');
      expect(container.textContent).toContain('Local Data Management');
      expect(container.textContent).toContain('Inventory Kamera Sync');
      expect(container.textContent).toContain('Achievement Data');
      expect(container.textContent).toContain('Regional Preferences');
      expect(container.textContent).toContain('Developer Tools');
      expect(container.textContent).toContain('Connect HoYoLAB');

      // Grid container has responsive grid-cols-1 md:grid-cols-2
      const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
      expect(grid).not.toBeNull();
    });

    it('isolates Factory Reset in a distinct danger zone separated from safe import/export', async () => {
      await act(async () => {
        root.render(<Settings />);
      });

      // Safe buttons
      const exportBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent.includes('Export Backup')
      );
      const importBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent.includes('Import Backup')
      );
      expect(exportBtn).not.toBeNull();
      expect(importBtn).not.toBeNull();

      // Factory Reset is inside a Danger Zone section
      const dangerZoneHeading = Array.from(container.querySelectorAll('span')).find(
        (s) => s.textContent.includes('Danger Zone')
      );
      expect(dangerZoneHeading).not.toBeNull();

      const factoryResetBtn = container.querySelector('#factory-reset-btn');
      expect(factoryResetBtn).not.toBeNull();
      expect(factoryResetBtn.textContent).toContain('Factory Reset');
    });

    it('handles long backup filenames gracefully with truncation and tooltip', async () => {
      const longName = '2026-10-25_travelers-toolkit-extended-backup-autosave-with-extra-long-name-exceeding-normal-widths.json';
      driveSync.listBackupsFromDrive.mockResolvedValueOnce([
        {
          id: 'b-long-1',
          name: longName,
          createdTime: '2026-10-25T12:00:00.000Z',
        },
      ]);

      await act(async () => {
        root.render(<Settings />);
      });

      const backupFilename = container.querySelector(`span[title="${longName}"]`);
      expect(backupFilename).not.toBeNull();
      expect(backupFilename.classList.contains('truncate')).toBe(true);

      const restoreBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Restore'
      );
      expect(restoreBtn).not.toBeNull();
      expect(restoreBtn.getAttribute('aria-label')).toContain('Restore backup from');
    });

    it('renders accessible regional preferences and timezone dropdowns', async () => {
      await act(async () => {
        root.render(<Settings />);
      });

      const regionSelect = container.querySelector('#server-region-select');
      expect(regionSelect).not.toBeNull();
      expect(regionSelect.getAttribute('aria-label')).toBe('Select server region');

      act(() => {
        regionSelect.value = 'NA';
        regionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(storeState.setServerRegion).toHaveBeenCalledWith('NA');

      const timezoneSelect = container.querySelector('#display-timezone-select');
      expect(timezoneSelect).not.toBeNull();
      expect(timezoneSelect.getAttribute('aria-label')).toBe('Select display time zone');

      const targetOptionValue = timezoneSelect.options[1].value;
      act(() => {
        timezoneSelect.value = targetOptionValue;
        timezoneSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(storeState.setDisplayTimeZone).toHaveBeenCalledWith(targetOptionValue);
    });

    it('renders developer tools toggle with accessible label and responds to changes', async () => {
      await act(async () => {
        root.render(<Settings />);
      });

      const dbToggle = container.querySelector('input[aria-label="Toggle database builder in sidebar"]');
      expect(dbToggle).not.toBeNull();

      act(() => {
        dbToggle.click();
      });
      expect(storeState.setShowDbBuilder).toHaveBeenCalledWith(true);
    });

    it('renders connected HoYoLAB account with wrapped uid info', async () => {
      storeState.hoyolabConnected = true;
      storeState.hoyolabAccount = { nickname: 'AetherLover', uid: '700123456' };

      await act(async () => {
        root.render(<Settings />);
      });

      expect(container.textContent).toContain('Connected');
      expect(container.textContent).toContain('AetherLover');
      expect(container.textContent).toContain('700123456');

      const disconnectBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Disconnect'
      );
      expect(disconnectBtn).not.toBeNull();
    });

    it('renders Inventory Kamera links and GOOD import button', async () => {
      await act(async () => {
        root.render(<Settings />);
      });

      const getKameraLink = container.querySelector('a[href*="Inventory_Kamera/releases"]');
      expect(getKameraLink).not.toBeNull();

      const goodImportBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent.includes('Import GOOD Format JSON')
      );
      expect(goodImportBtn).not.toBeNull();
    });

    it('handles invalid backup file gracefully without altering store', async () => {
      const notifySpy = vi.spyOn(notify, 'error');

      await act(async () => {
        root.render(<Settings />);
      });

      const fileInput = container.querySelector('input[aria-label="Upload backup JSON file"]');
      expect(fileInput).not.toBeNull();

      const invalidFile = new File(['invalid json content'], 'backup.json', { type: 'application/json' });
      Object.defineProperty(fileInput, 'files', { value: [invalidFile] });

      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        // FileReader is async
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(notifySpy).toHaveBeenCalled();
      expect(storeState.importData).not.toHaveBeenCalled();
    });

    it('renders cloud backup list items with accessible labels and triggers restore', async () => {
      const notifySpy = vi.spyOn(notify, 'success');
      driveSync.listBackupsFromDrive.mockResolvedValueOnce([
        { id: 'cloud-backup-1', name: 'travelers-toolkit-backup-2026.json', createdTime: '2026-10-25T12:00:00.000Z' }
      ]);
      driveSync.downloadBackupFromDrive.mockResolvedValueOnce({
        app: 'travelers-toolkit',
        schemaVersion: 1,
        createdAt: '2026-10-25T12:00:00.000Z',
        data: {
          roster: {},
          trackedWeapons: [],
          inventory: {},
        },
      });

      await act(async () => {
        root.render(<Settings />);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const backupItem = container.querySelector('span[aria-label="Backup file: travelers-toolkit-backup-2026.json"]');
      expect(backupItem).not.toBeNull();

      const restoreBtn = container.querySelector('button[aria-label^="Restore backup from"]');
      expect(restoreBtn).not.toBeNull();

      await act(async () => {
        restoreBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(driveSync.downloadBackupFromDrive).toHaveBeenCalledWith('cloud-backup-1');
      expect(storeState.importData).toHaveBeenCalled();
      expect(notifySpy).toHaveBeenCalledWith('Cloud restore successful!');
    });
  });
});
