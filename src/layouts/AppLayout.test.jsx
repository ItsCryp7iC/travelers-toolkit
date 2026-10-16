import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../utils/googleAuthHelper', () => ({
  triggerGoogleAuth: vi.fn(),
}));
vi.mock('../utils/driveSync', () => ({
  upsertAutoBackupToDrive: vi.fn(),
  downloadBackupFromDrive: vi.fn(),
}));
vi.mock('../components/HoyolabSyncPreviewModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="global-sync-modal">
        Global Sync Modal
        <button onClick={onClose} data-testid="close-sync-modal">Close</button>
      </div>
    ) : null,
}));

describe('AppLayout Accessibility & Polish', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useStore.mockImplementation((selector) => {
      const state = {
        showDbBuilder: false,
        roster: {},
        trackedWeapons: [],
        googleConnected: false,
        googleUser: null,
        googleError: null,
        autoBackupEnabled: false,
        checkGoogleSession: vi.fn(),
        disconnectGoogleSession: vi.fn(),
        importData: vi.fn(),
        handleSyncNotes: vi.fn(),
      };
      return selector(state);
    });
    useStore.getState = () => ({
      showDbBuilder: false,
      roster: {},
      trackedWeapons: [],
      googleConnected: false,
      googleUser: null,
      googleError: null,
      autoBackupEnabled: false,
    });
    useStore.subscribe = vi.fn().mockReturnValue(vi.fn());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders skip link targeting #page-content', () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );
    });

    const skipLink = container.querySelector('a[href="#page-content"]');
    expect(skipLink).not.toBeNull();
    expect(skipLink.textContent).toContain('Skip to main content');
  });

  it('renders signed-out Google control as an accessible button', () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );
    });

    const googleBtn = container.querySelector('button[aria-label="Sign in with Google"]');
    expect(googleBtn).not.toBeNull();
    expect(googleBtn.getAttribute('type')).toBe('button');
  });

  it('renders signed-in Google account menu with ARIA disclosure semantics', () => {
    useStore.mockImplementation((selector) => {
      const state = {
        showDbBuilder: false,
        roster: {},
        trackedWeapons: [],
        googleConnected: true,
        googleUser: { name: 'Traveler', email: 'traveler@teyvat.org', picture: '' },
        googleError: null,
        autoBackupEnabled: false,
        checkGoogleSession: vi.fn(),
        disconnectGoogleSession: vi.fn(),
        handleSyncNotes: vi.fn(),
      };
      return selector(state);
    });

    act(() => {
      root.render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );
    });

    const profileBtn = container.querySelector('button[aria-haspopup="true"]');
    expect(profileBtn).not.toBeNull();
    expect(profileBtn.getAttribute('aria-expanded')).toBe('false');
    expect(profileBtn.getAttribute('aria-label')).toContain('Google account menu');
  });

  it('renders mobile sidebar toggle with aria-expanded and aria-controls', () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );
    });

    const toggle = container.querySelector('button[aria-controls="app-sidebar"]');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders semantic footer with Privacy Policy and Terms of Service links', () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );
    });

    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();

    const privacyLink = footer.querySelector('a[href="/privacy"]');
    const termsLink = footer.querySelector('a[href="/terms"]');
    expect(privacyLink).not.toBeNull();
    expect(termsLink).not.toBeNull();
    expect(privacyLink.textContent).toContain('Privacy Policy');
    expect(termsLink.textContent).toContain('Terms of Service');
  });

  it('renders permanent Privacy Policy and Terms of Service links in sidebar with accessibility names and keeps them rendered when collapsed', () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );
    });

    const sidebar = container.querySelector('#app-sidebar');
    expect(sidebar).not.toBeNull();

    const privacyLink = sidebar.querySelector('#sidebar-privacy-link');
    const termsLink = sidebar.querySelector('#sidebar-terms-link');

    expect(privacyLink).not.toBeNull();
    expect(termsLink).not.toBeNull();

    expect(privacyLink.tagName.toLowerCase()).toBe('a');
    expect(termsLink.tagName.toLowerCase()).toBe('a');

    expect(privacyLink.getAttribute('href')).toBe('/privacy');
    expect(termsLink.getAttribute('href')).toBe('/terms');

    expect(privacyLink.getAttribute('aria-label')).toBe('Privacy Policy');
    expect(termsLink.getAttribute('aria-label')).toBe('Terms of Service');

    expect(privacyLink.getAttribute('title')).toBe('Privacy Policy');
    expect(termsLink.getAttribute('title')).toBe('Terms of Service');

    expect(privacyLink.querySelector('.legal-link-icon').textContent).toBe('📜');
    expect(termsLink.querySelector('.legal-link-icon').textContent).toBe('⚖️');

    expect(privacyLink.querySelector('.legal-link-label').textContent).toBe('Privacy Policy');
    expect(termsLink.querySelector('.legal-link-label').textContent).toBe('Terms of Service');

    // Toggle desktop collapsed mode
    const collapseToggle = container.querySelector('.nav-toggle-btn');
    expect(collapseToggle).not.toBeNull();

    act(() => {
      collapseToggle.click();
    });

    // Verify root has desktop-collapsed class
    const layoutRoot = container.querySelector('.desktop-collapsed');
    expect(layoutRoot).not.toBeNull();

    // Verify both links remain rendered in sidebar with accessible names and icons
    const collapsedPrivacyLink = sidebar.querySelector('#sidebar-privacy-link');
    const collapsedTermsLink = sidebar.querySelector('#sidebar-terms-link');

    expect(collapsedPrivacyLink).not.toBeNull();
    expect(collapsedTermsLink).not.toBeNull();

    expect(collapsedPrivacyLink.getAttribute('aria-label')).toBe('Privacy Policy');
    expect(collapsedTermsLink.getAttribute('aria-label')).toBe('Terms of Service');

    expect(collapsedPrivacyLink.getAttribute('title')).toBe('Privacy Policy');
    expect(collapsedTermsLink.getAttribute('title')).toBe('Terms of Service');

    expect(collapsedPrivacyLink.querySelector('.legal-link-icon').textContent).toBe('📜');
    expect(collapsedTermsLink.querySelector('.legal-link-icon').textContent).toBe('⚖️');

    expect(collapsedPrivacyLink.getAttribute('href')).toBe('/privacy');
    expect(collapsedTermsLink.getAttribute('href')).toBe('/terms');
  });

  describe('Global HoYoLAB Character Sync Button & Modal Integration', () => {
    it('hides global sync button when hoyolab is disconnected', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: false,
          syncPayload: null,
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const syncBtn = container.querySelector('#global-hoyolab-sync-btn');
      expect(syncBtn).toBeNull();
      expect(container.querySelector('[data-testid="global-sync-modal"]')).toBeNull();
    });

    it('shows global sync button with accessible name when hoyolab is connected', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: null,
          syncPayload: null,
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const syncBtn = container.querySelector('#global-hoyolab-sync-btn');
      expect(syncBtn).not.toBeNull();
      expect(syncBtn.getAttribute('aria-label')).toBe('Sync characters with HoYoLAB');
      expect(syncBtn.getAttribute('title')).toBe('Sync characters with HoYoLAB');
      expect(syncBtn.textContent).toContain('Sync with HoYoLAB');

      const desktopLabel = syncBtn.querySelector('[data-testid="hoyolab-sync-desktop-label"]');
      expect(desktopLabel).not.toBeNull();
      expect(desktopLabel.textContent).toBe('Sync with HoYoLAB');

      const mediumLabel = syncBtn.querySelector('[data-testid="hoyolab-sync-medium-label"]');
      expect(mediumLabel).not.toBeNull();
      expect(mediumLabel.textContent).toBe('HoYoLAB Sync');
    });

    it('formats last-sync time in button title when timestamp is present', () => {
      const threeMinsAgo = Date.now() - 3 * 60 * 1000;
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: threeMinsAgo,
          syncPayload: null,
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const syncBtn = container.querySelector('#global-hoyolab-sync-btn');
      expect(syncBtn).not.toBeNull();
      expect(syncBtn.getAttribute('title')).toContain('Sync characters with HoYoLAB • Last synced 3 min ago');
    });

    it('opens HoyolabSyncPreviewModal when global sync button is clicked and closes on onClose', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: null,
          syncPayload: null,
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      expect(container.querySelector('[data-testid="global-sync-modal"]')).toBeNull();

      const syncBtn = container.querySelector('#global-hoyolab-sync-btn');
      act(() => {
        syncBtn.click();
      });

      expect(container.querySelector('[data-testid="global-sync-modal"]')).not.toBeNull();

      const closeBtn = container.querySelector('[data-testid="close-sync-modal"]');
      act(() => {
        closeBtn.click();
      });

      expect(container.querySelector('[data-testid="global-sync-modal"]')).toBeNull();
    });

    it('renders only ONE sync button trigger globally in the header', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: null,
          syncPayload: null,
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const syncButtons = container.querySelectorAll('#global-hoyolab-sync-btn');
      expect(syncButtons.length).toBe(1);
    });

    it('preserves compact Resin and Realm Currency trackers next to the global sync button', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: { 'Kamisato Ayaka': {} },
          trackedWeapons: [{ id: 'w1', name: 'Amenoma Kageuchi' }],
          resinCount: 160,
          resinTimestamp: Date.now(),
          displayTimeZone: 'UTC',
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: null,
          syncPayload: {
            resin: { targetFullTime: Date.now() + 3600000, max: 200 },
            realm_currency: { current: 1200, max: 2400 }
          },
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const header = container.querySelector('#app-topbar');
      const resin = container.querySelector('[aria-label="Resin Tracker"]');
      const syncBtn = container.querySelector('#global-hoyolab-sync-btn');
      const armory = container.querySelector('div[title="My Armory"]');

      expect(resin).not.toBeNull();
      expect(syncBtn).not.toBeNull();
      expect(armory).not.toBeNull();
      expect(container.querySelector('div[title="Roster"]')).not.toBeNull();

      // Verify DOM sequence: Resin Tracker precedes sync button, which precedes Armory
      expect(resin.compareDocumentPosition(syncBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(syncBtn.compareDocumentPosition(armory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('opens sync modal route-independently on non-character routes like /weapons and /planner', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: null,
          syncPayload: null,
          googleConnected: false,
          googleUser: null,
          googleError: null,
          autoBackupEnabled: false,
          checkGoogleSession: vi.fn(),
          disconnectGoogleSession: vi.fn(),
          importData: vi.fn(),
          handleSyncNotes: vi.fn(),
        };
        return selector(state);
      });

      // Render on /weapons
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/weapons']}>
            <AppLayout />
          </MemoryRouter>
        );
      });

      expect(container.querySelector('[data-testid="global-sync-modal"]')).toBeNull();
      const weaponsSyncBtn = container.querySelector('#global-hoyolab-sync-btn');
      expect(weaponsSyncBtn).not.toBeNull();

      act(() => {
        weaponsSyncBtn.click();
      });
      expect(container.querySelector('[data-testid="global-sync-modal"]')).not.toBeNull();

      // Close modal
      act(() => {
        container.querySelector('[data-testid="close-sync-modal"]').click();
      });
      expect(container.querySelector('[data-testid="global-sync-modal"]')).toBeNull();

      // Render on /planner
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/planner']}>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const plannerSyncBtn = container.querySelector('#global-hoyolab-sync-btn');
      expect(plannerSyncBtn).not.toBeNull();
      act(() => {
        plannerSyncBtn.click();
      });
      expect(container.querySelector('[data-testid="global-sync-modal"]')).not.toBeNull();
    });
  });
});
