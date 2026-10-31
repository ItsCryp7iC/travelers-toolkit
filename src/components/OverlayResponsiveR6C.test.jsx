import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HoyoLoginModal from './hoyolab/HoyoLoginModal';
import HoyolabSyncPreviewModal from './HoyolabSyncPreviewModal';
import CookiePromptModal from './CookiePromptModal';
import { StagingModal } from './DevBuilder/StagingModal';
import { resetBodyScrollLockForTesting } from '../utils/scrollLock';
import useStore from '../store/useStore';
import * as geetestLoader from '../utils/geetestLoader';

vi.mock('../store/useStore');
vi.mock('../utils/assetHelper', () => ({
  getElementIcon: (el) => `icon-${el}`,
  getCharacterAvatar: (name) => `avatar-${name}`,
  getWeaponIcon: (name) => `weapon-${name}`,
  getWeaponTypeIcon: (type) => `type-${type}`
}));

describe('Stage R6C Overlay Responsive & Accessibility Suite', () => {
  let container = null;
  let root = null;
  let mockStoreState = null;
  let mockFetch = null;

  beforeEach(() => {
    resetBodyScrollLockForTesting();
    document.body.style.overflow = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockStoreState = {
      hoyolabConnected: false,
      hoyolabAccount: null,
      lastHoyolabCharacterSyncAt: null,
      roster: {},
      trackedWeapons: [],
      setHoyolabConnected: vi.fn((val) => {
        mockStoreState.hoyolabConnected = val;
      }),
      setHoyolabAccount: vi.fn((acc) => {
        mockStoreState.hoyolabAccount = acc;
      }),
      handleSyncNotes: vi.fn().mockResolvedValue({ success: true }),
      applyHoyolabSync: vi.fn().mockReturnValue({
        success: true,
        charactersAdded: 1,
        charactersUpdated: 1,
        weaponsCreated: 1,
        weaponsUpdatedOrReassigned: 0,
        travelerVariantsAdded: 0
      }),
      connectHoyolabSession: vi.fn().mockResolvedValue({ success: true })
    };

    useStore.mockImplementation((selector) => selector(mockStoreState));
    useStore.getState = () => mockStoreState;

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    vi.spyOn(geetestLoader, 'loadGeetestScript').mockResolvedValue(true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
    resetBodyScrollLockForTesting();
    document.body.style.overflow = '';
  });

  // ---------------------------------------------------------------------------
  // 1. HoyoLoginModal: Mobile Dialog Container Structure & Accessibility
  // ---------------------------------------------------------------------------
  describe('HoyoLoginModal Mobile Structure & Accessibility', () => {
    it('1. renders with role="dialog", aria-modal="true", aria-labelledby, and bounded max-height', async () => {
      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('hoyolab-login-modal-title');

      const title = container.querySelector('#hoyolab-login-modal-title');
      expect(title).not.toBeNull();
      expect(title.textContent).toContain('Sign in with HoYoLAB');

      // Check max-height and overflow classes for mobile safety
      expect(dialog.className).toContain('max-h-');
      expect(dialog.className).toContain('overflow-y-auto');

      // Check close button with accessible name
      const closeBtn = container.querySelector('button[aria-label="Close modal"]');
      expect(closeBtn).not.toBeNull();
    });

    it('2. locks body scroll on open and restores previous overflow state on close', async () => {
      document.body.style.overflow = 'visible';

      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('hidden');

      await act(async () => {
        root.render(<HoyoLoginModal isOpen={false} onClose={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('visible');
    });

    it('3. closes modal and triggers backend flow cancellation on backdrop click', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nextStep: 'geetest', gtVersion: 4, apiServer: 'test', mmt: {} })
      });

      const onClose = vi.fn();
      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
      });

      // Submit credentials to make flow active
      const accountInput = container.querySelector('#hoyolab-login-account');
      const passwordInput = container.querySelector('#hoyolab-login-password');
      const form = container.querySelector('form');

      await act(async () => {
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valSetter.call(accountInput, 'test@example.com');
        accountInput.dispatchEvent(new Event('input', { bubbles: true }));
        valSetter.call(passwordInput, 'secret123');
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      // Flow is active; backdrop click should trigger handleClose and DELETE flow
      const backdrop = container.querySelector('[role="presentation"]');
      expect(backdrop).not.toBeNull();

      await act(async () => {
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onClose).toHaveBeenCalled();
      const deleteCalls = mockFetch.mock.calls.filter(
        ([url, opts]) => url === '/api/hoyolab/auth/flow' && opts?.method === 'DELETE'
      );
      expect(deleteCalls.length).toBe(1);
    });

    it('4. wraps error presentation cleanly without blocking interactive controls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid credentials provided for this game account' })
      });

      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
      });

      const accountInput = container.querySelector('#hoyolab-login-account');
      const passwordInput = container.querySelector('#hoyolab-login-password');
      const form = container.querySelector('form');

      await act(async () => {
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valSetter.call(accountInput, 'user');
        accountInput.dispatchEvent(new Event('input', { bubbles: true }));
        valSetter.call(passwordInput, 'pwd');
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert.className).toContain('break-words');
      expect(alert.textContent).toContain('Invalid credentials provided for this game account');

      // Buttons remain available and interactive
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.disabled).toBe(false);
    });

    it('5. presents multiple account selection cards with wrapping and selectable UID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nextStep: 'complete' })
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accounts: [
            { uid: 700123456, nickname: 'Lumine Traveler Prime', level: 60, server: 'os_euro', serverName: 'Europe Server' },
            { uid: 800987654, nickname: 'Aether Alternate Account', level: 55, server: 'os_asia', serverName: 'Asia Server' }
          ]
        })
      });

      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
      });

      const accountInput = container.querySelector('#hoyolab-login-account');
      const passwordInput = container.querySelector('#hoyolab-login-password');
      const form = container.querySelector('form');

      await act(async () => {
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valSetter.call(accountInput, 'user');
        accountInput.dispatchEvent(new Event('input', { bubbles: true }));
        valSetter.call(passwordInput, 'pwd');
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(container.textContent).toContain('Select Genshin Impact Account');
      expect(container.textContent).toContain('UID: 700123456');
      expect(container.textContent).toContain('UID: 800987654');
      expect(container.textContent).toContain('Europe Server');
      expect(container.textContent).toContain('Asia Server');

      // Select second account
      const cards = container.querySelectorAll('form > div:nth-of-type(2) > div');
      expect(cards.length).toBe(2);

      await act(async () => {
        cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          account: { uid: 800987654, nickname: 'Aether Alternate Account', level: 55, server: 'os_asia' }
        })
      });

      const selectForm = container.querySelector('form');
      await act(async () => {
        selectForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      const completeCalls = mockFetch.mock.calls.filter(([url]) => url === '/api/hoyolab/auth/complete');
      expect(completeCalls.length).toBe(1);
      const parsedBody = JSON.parse(completeCalls[0][1].body);
      expect(parsedBody.uid).toBe(800987654);

      // Successfully connected without erroneous flow delete
      const deleteCalls = mockFetch.mock.calls.filter(
        ([url, opts]) => url === '/api/hoyolab/auth/flow' && opts?.method === 'DELETE'
      );
      expect(deleteCalls.length).toBe(0);
    });

    it('5b. clicking inside modal dialog does NOT trigger dismissal or flow cleanup', async () => {
      const onClose = vi.fn();
      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      await act(async () => {
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('5c. pressing Escape dismisses modal and triggers backend flow cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nextStep: 'geetest', gtVersion: 4, apiServer: 'test', mmt: {} })
      });

      const onClose = vi.fn();
      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={onClose} />);
      });

      // Submit credentials to make flow active
      const accountInput = container.querySelector('#hoyolab-login-account');
      const passwordInput = container.querySelector('#hoyolab-login-password');
      const form = container.querySelector('form');

      await act(async () => {
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valSetter.call(accountInput, 'test@example.com');
        accountInput.dispatchEvent(new Event('input', { bubbles: true }));
        valSetter.call(passwordInput, 'secret123');
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      // Press Escape
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(onClose).toHaveBeenCalled();
      const deleteCalls = mockFetch.mock.calls.filter(
        ([url, opts]) => url === '/api/hoyolab/auth/flow' && opts?.method === 'DELETE'
      );
      expect(deleteCalls.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. HoyolabSyncPreviewModal: Mobile Structure, Accessibility, & Apply Semantics
  // ---------------------------------------------------------------------------
  describe('HoyolabSyncPreviewModal Mobile Structure & Actions', () => {
    const setupSyncMock = () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            { id: 10000046, level: 90, ascension: 6, weapon: { id: 13501, level: 90, refinement: 1 } }, // Hu Tao (New)
            { id: 10000002, level: 80, ascension: 5, talents: { normal: 1, skill: 1, burst: 1 }, weapon: { id: 11414, level: 80, refinement: 1 } }, // Ayaka (Update)
          ]
        })
      });

      mockStoreState.roster = {
        'Kamisato Ayaka': { level: 70, ascension: 4, talents: { normal: 10, skill: 10, burst: 10 } }
      };
    };

    it('6. renders with role="dialog", aria-modal="true", and accessible header', async () => {
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('hoyolab-sync-modal-title');

      const title = container.querySelector('#hoyolab-sync-modal-title');
      expect(title).not.toBeNull();
      expect(title.textContent).toContain('Sync Characters from HoYoLAB');

      const closeBtn = container.querySelector('button[aria-label="Close modal"]');
      expect(closeBtn).not.toBeNull();
    });

    it('7. locks body scroll when open and restores prior overflow state on close', async () => {
      document.body.style.overflow = 'auto';
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('hidden');

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={false} onClose={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('auto');
    });

    it('8. renders responsive summary tiles and distinct two-row toolbar', async () => {
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      // Summary grid
      expect(container.textContent).toContain('Found');
      expect(container.textContent).toContain('New');
      expect(container.textContent).toContain('Updates');

      // Toolbar search input with aria-label
      const searchInput = container.querySelector('input[placeholder="Search characters or weapons..."]');
      expect(searchInput).not.toBeNull();
      expect(searchInput.getAttribute('aria-label')).toBe('Search characters or weapons');

      // Row 1 buttons: Select All Safe & Clear All
      const selectAllSafeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Select All Safe'));
      const clearAllBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Clear All'));
      expect(selectAllSafeBtn).not.toBeNull();
      expect(clearAllBtn).not.toBeNull();

      // Row 2 filter chips
      const chips = ['All', 'New', 'Updates', 'Unchanged', 'Needs Attention'];
      chips.forEach(chip => {
        const chipBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === chip);
        expect(chipBtn).not.toBeNull();
      });
    });

    it('9. provides mobile-safe action footer with clear Apply vs Cancel layout', async () => {
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      expect(applyBtn).not.toBeNull();
      expect(applyBtn.disabled).toBe(false);

      const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      expect(cancelBtn).not.toBeNull();

      // Footer has responsive flex classes
      const footer = applyBtn.closest('.border-t');
      expect(footer).not.toBeNull();
      expect(footer.className).toContain('flex-col');
      expect(footer.className).toContain('sm:flex-row');
    });

    it('10. opens confirmation modal with role="dialog", aria-modal="true", and does NOT mutate store before Apply', async () => {
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      // Store is unmutated
      expect(mockStoreState.applyHoyolabSync).not.toHaveBeenCalled();

      // Click Apply Selected
      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      await act(async () => {
        applyBtn.click();
      });

      // Confirmation modal is open
      const dialogs = container.querySelectorAll('[role="dialog"]');
      expect(dialogs.length).toBe(2); // Main dialog + confirmation dialog

      const confirmDialog = dialogs[1];
      expect(confirmDialog.getAttribute('aria-modal')).toBe('true');
      expect(confirmDialog.getAttribute('aria-labelledby')).toBe('sync-confirm-title');

      const confirmTitle = container.querySelector('#sync-confirm-title');
      expect(confirmTitle).not.toBeNull();
      expect(confirmTitle.textContent).toContain('Apply HoYoLAB Sync?');

      // Still no store mutation before confirmation
      expect(mockStoreState.applyHoyolabSync).not.toHaveBeenCalled();

      // Click Cancel in confirmation modal returns to preview without mutation
      const confirmCancelBtn = Array.from(confirmDialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      await act(async () => {
        confirmCancelBtn.click();
      });

      expect(mockStoreState.applyHoyolabSync).not.toHaveBeenCalled();
      expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);

      // Open confirmation again and confirm
      await act(async () => {
        applyBtn.click();
      });

      const applySyncBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Apply Sync');
      await act(async () => {
        applySyncBtn.click();
      });

      // Store mutation happens exactly once on confirm
      expect(mockStoreState.applyHoyolabSync).toHaveBeenCalledTimes(1);

      // Shows Sync Complete view
      expect(container.textContent).toContain('Sync Complete');
      expect(container.textContent).toContain('Review Updated State');
    });

    it('11. closes confirmation on Escape, then closes main modal on second Escape', async () => {
      setupSyncMock();
      const onClose = vi.fn();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={onClose} />);
      });

      // Open confirmation
      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      await act(async () => {
        applyBtn.click();
      });
      expect(container.querySelectorAll('[role="dialog"]').length).toBe(2);

      // First Escape closes confirmation
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);
      expect(onClose).not.toHaveBeenCalled();

      // Second Escape closes modal
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('12. closes modal on backdrop click when not loading or applying', async () => {
      setupSyncMock();
      const onClose = vi.fn();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={onClose} />);
      });

      const backdrop = container.querySelector('[role="presentation"]');
      expect(backdrop).not.toBeNull();

      await act(async () => {
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('12b. confirmation modal backdrop click dismisses confirmation without applying sync', async () => {
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      await act(async () => {
        applyBtn.click();
      });

      const dialogs = container.querySelectorAll('[role="dialog"]');
      expect(dialogs.length).toBe(2);

      const presentations = container.querySelectorAll('[role="presentation"]');
      expect(presentations.length).toBe(2);
      const confirmBackdrop = presentations[1];

      await act(async () => {
        confirmBackdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockStoreState.applyHoyolabSync).not.toHaveBeenCalled();
      expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);
    });

    it('12c. prevents duplicate apply calls on rapid repeated clicks', async () => {
      setupSyncMock();

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      await act(async () => {
        applyBtn.click();
      });

      const applySyncBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Apply Sync');
      expect(applySyncBtn).not.toBeNull();

      // Rapid clicks
      await act(async () => {
        applySyncBtn.click();
        applySyncBtn.click();
      });

      expect(mockStoreState.applyHoyolabSync).toHaveBeenCalledTimes(1);
    });

    it('12d. unresolved weapon conflict disables Apply Selected button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              id: 10000046, // Hu Tao
              level: 90,
              ascension: 6,
              weapon: { id: 13501, level: 90, refinement: 1 } // Staff of Homa
            }
          ]
        })
      });

      mockStoreState.roster = {
        'Hu Tao': { level: 90, ascension: 6 }
      };
      // Tracked weapon conflict: two existing unequipped Homas in inventory
      mockStoreState.trackedWeapons = [
        { id: 'w1', weapon_id: 'staffofhoma', level: 90, currentRefinement: 1, assignedTo: null },
        { id: 'w2', weapon_id: 'staffofhoma', level: 80, currentRefinement: 1, assignedTo: null }
      ];

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });

      // Character with ambiguous weapon is not auto-selected by default (not safe)
      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      expect(applyBtn.disabled).toBe(true);

      // Select the character manually
      const charCheckbox = container.querySelector('input[type="checkbox"]');
      expect(charCheckbox).not.toBeNull();
      await act(async () => {
        charCheckbox.click();
      });

      // Still disabled because weapon ambiguity is unresolved
      expect(applyBtn.disabled).toBe(true);
      expect(container.textContent).toContain('resolve weapon');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CookiePromptModal: Accessibility, Sizing, Body Scroll Locking
  // ---------------------------------------------------------------------------
  describe('CookiePromptModal Responsive & Accessibility', () => {
    it('13. renders role="dialog", aria-modal="true", locks body scroll, and handles Escape', async () => {
      document.body.style.overflow = 'visible';
      const onClose = vi.fn();

      await act(async () => {
        root.render(<CookiePromptModal onClose={onClose} onSaveAndSync={vi.fn()} />);
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('cookie-modal-title');
      expect(document.body.style.overflow).toBe('hidden');

      // Escape key closes modal
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('14. closes on backdrop click and has mobile-safe action layout', async () => {
      const onClose = vi.fn();

      await act(async () => {
        root.render(<CookiePromptModal onClose={onClose} onSaveAndSync={vi.fn()} />);
      });

      const backdrop = container.querySelector('[role="presentation"]');
      await act(async () => {
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(cancelBtn).not.toBeNull();
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.textContent).toContain('Connect & Sync');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Overlapping Modal Body Scroll Locks & Nesting
  // ---------------------------------------------------------------------------
  describe('Overlapping Modal Body Scroll Locks', () => {
    let secondContainer = null;
    let secondRoot = null;

    beforeEach(() => {
      secondContainer = document.createElement('div');
      document.body.appendChild(secondContainer);
      secondRoot = createRoot(secondContainer);
    });

    afterEach(() => {
      act(() => {
        secondRoot?.unmount();
      });
      secondContainer?.remove();
      secondContainer = null;
    });

    it('15. maintains body scroll lock when second modal opens and first closes out-of-order', async () => {
      document.body.style.overflow = 'visible';

      // Open Modal 1 (HoyoLoginModal)
      await act(async () => {
        root.render(<HoyoLoginModal isOpen={true} onClose={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('hidden');

      // Open Modal 2 (CookiePromptModal) concurrently
      await act(async () => {
        secondRoot.render(<CookiePromptModal onClose={vi.fn()} onSaveAndSync={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('hidden');

      // Unmount/close Modal 1 first
      await act(async () => {
        root.render(<HoyoLoginModal isOpen={false} onClose={vi.fn()} />);
      });
      // Modal 2 is still active -> body MUST remain locked!
      expect(document.body.style.overflow).toBe('hidden');

      // Close Modal 2
      await act(async () => {
        secondRoot.unmount();
      });
      // All modals closed -> original overflow is restored!
      expect(document.body.style.overflow).toBe('visible');
    });

    it('16. closing nested confirmation does not unlock page while parent preview remains active', async () => {
      document.body.style.overflow = 'auto';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [{ id: 10000046, level: 90, ascension: 6 }]
        })
      });

      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={true} onClose={vi.fn()} />);
      });
      expect(document.body.style.overflow).toBe('hidden');

      // Open nested confirmation modal
      const applyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Apply Selected'));
      await act(async () => {
        applyBtn.click();
      });
      const dialogs = container.querySelectorAll('[role="dialog"]');
      expect(dialogs.length).toBe(2);
      expect(document.body.style.overflow).toBe('hidden');

      // Close nested confirmation modal
      const confirmDialog = dialogs[1];
      const cancelConfirmBtn = Array.from(confirmDialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      await act(async () => {
        cancelConfirmBtn.click();
      });
      expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);

      // Parent preview is still open -> body MUST remain locked!
      expect(document.body.style.overflow).toBe('hidden');

      // Close parent preview modal
      await act(async () => {
        root.render(<HoyolabSyncPreviewModal isOpen={false} onClose={vi.fn()} />);
      });
      // Now body restores original overflow
      expect(document.body.style.overflow).toBe('auto');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. DevBuilder StagingModal: Accessibility, Sizing, Body Scroll Locking
  // ---------------------------------------------------------------------------
  describe('DevBuilder StagingModal Responsive & Accessibility', () => {
    it('17. renders role="dialog", aria-modal="true", locks body scroll, and handles Escape', async () => {
      document.body.style.overflow = 'visible';
      const onClose = vi.fn();
      const stagedUpdates = { 'char.json': [{ id: 'lumine', name: 'Lumine' }] };

      await act(async () => {
        root.render(
          <StagingModal
            isOpen={true}
            onClose={onClose}
            stagedUpdates={stagedUpdates}
            setStagedUpdates={vi.fn()}
          />
        );
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('staging-modal-title');
      expect(document.body.style.overflow).toBe('hidden');

      // Escape key closes modal
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      // Close restores scroll
      await act(async () => {
        root.render(
          <StagingModal
            isOpen={false}
            onClose={onClose}
            stagedUpdates={stagedUpdates}
            setStagedUpdates={vi.fn()}
          />
        );
      });
      expect(document.body.style.overflow).toBe('visible');
    });
  });
});
