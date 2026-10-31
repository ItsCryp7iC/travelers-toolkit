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
    localStorage.clear();
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
    localStorage.clear();
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

  describe('Sidebar Navigation Grouping (Stage C4)', () => {
    it('renders section group headings (Progression, Records, System) in expanded mode', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const progTitle = container.querySelector('#nav-group-title-progression');
      const recTitle = container.querySelector('#nav-group-title-records');
      const sysTitle = container.querySelector('#nav-group-title-system');

      expect(progTitle).not.toBeNull();
      expect(recTitle).not.toBeNull();
      expect(sysTitle).not.toBeNull();

      expect(progTitle.textContent.trim()).toBe('Progression');
      expect(recTitle.textContent.trim()).toBe('Records');
      expect(sysTitle.textContent.trim()).toBe('System');
    });

    it('places the correct navigation items in each section group', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Progression group
      const progGroup = container.querySelector('#nav-section-progression');
      expect(progGroup).not.toBeNull();
      expect(progGroup.querySelector('a[href="/"]')).not.toBeNull();
      expect(progGroup.querySelector('a[href="/characters"]')).not.toBeNull();
      expect(progGroup.querySelector('a[href="/weapons"]')).not.toBeNull();
      expect(progGroup.textContent).toContain('Planner');
      expect(progGroup.textContent).toContain('Inventory');
      expect(progGroup.querySelector('a[href="/achievements"]')).toBeNull();
      expect(progGroup.querySelector('a[href="/changelog"]')).toBeNull();
      expect(progGroup.querySelector('a[href="/settings"]')).toBeNull();

      // Records group
      const recGroup = container.querySelector('#nav-section-records');
      expect(recGroup).not.toBeNull();
      expect(recGroup.querySelector('a[href="/achievements"]')).not.toBeNull();
      expect(recGroup.querySelector('a[href="/"]')).toBeNull();
      expect(recGroup.querySelector('a[href="/characters"]')).toBeNull();
      expect(recGroup.querySelector('a[href="/settings"]')).toBeNull();

      // System group
      const sysGroup = container.querySelector('#nav-section-system');
      expect(sysGroup).not.toBeNull();
      expect(sysGroup.querySelector('a[href="/changelog"]')).not.toBeNull();
      expect(sysGroup.querySelector('a[href="/settings"]')).not.toBeNull();
      expect(sysGroup.querySelector('a[href="/achievements"]')).toBeNull();
      expect(sysGroup.querySelector('a[href="/weapons"]')).toBeNull();
    });

    it('keeps Dev Tools separate from System when enabled', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: true,
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

      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const devNav = container.querySelector('.sidebar-dev-nav');
      expect(devNav).not.toBeNull();
      expect(devNav.textContent).toContain('Dev Tools');
      expect(devNav.querySelector('a[href="/builder"]')).not.toBeNull();

      // Ensure DB Builder is NOT in the System group
      const sysGroup = container.querySelector('#nav-section-system');
      expect(sysGroup.querySelector('a[href="/builder"]')).toBeNull();
    });

    it('keeps Legal Links separate from System navigation', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const legalNav = container.querySelector('.sidebar-legal-nav');
      expect(legalNav).not.toBeNull();
      expect(legalNav.querySelector('#sidebar-privacy-link')).not.toBeNull();
      expect(legalNav.querySelector('#sidebar-terms-link')).not.toBeNull();

      const sysGroup = container.querySelector('#nav-section-system');
      expect(sysGroup.querySelector('#sidebar-privacy-link')).toBeNull();
      expect(sysGroup.querySelector('#sidebar-terms-link')).toBeNull();
    });

    it('maintains group structure and separators when desktop sidebar is collapsed', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Toggle collapsed mode
      const toggle = container.querySelector('.nav-toggle-btn');
      act(() => {
        toggle.click();
      });

      const layoutRoot = container.querySelector('.desktop-collapsed');
      expect(layoutRoot).not.toBeNull();

      // Sections and separators remain rendered
      expect(container.querySelector('#nav-section-progression')).not.toBeNull();
      expect(container.querySelector('#nav-section-records')).not.toBeNull();
      expect(container.querySelector('#nav-section-system')).not.toBeNull();

      const dividers = container.querySelectorAll('.nav-group-divider');
      expect(dividers.length).toBeGreaterThanOrEqual(2);

      // Section labels have nav-group-label class
      const labels = container.querySelectorAll('.nav-group-label');
      expect(labels.length).toBe(3);
    });

    it('retains expandable submenu behavior for Planner in expanded sidebar', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Planner tabs should initially be closed on non-planner route
      expect(container.querySelector('a[href="/planner?tab=daily_action"]')).toBeNull();

      // Find Planner toggle
      const progGroup = container.querySelector('#nav-section-progression');
      const plannerToggle = Array.from(progGroup.querySelectorAll('.sidebar-nav-link')).find(
        (el) => el.textContent.includes('Planner')
      );
      expect(plannerToggle).not.toBeNull();

      // Click to expand
      act(() => {
        plannerToggle.click();
      });

      expect(container.querySelector('a[href="/planner?tab=daily_action"]')).not.toBeNull();

      // Click again to collapse
      act(() => {
        plannerToggle.click();
      });

      expect(container.querySelector('a[href="/planner?tab=daily_action"]')).toBeNull();
    });

    it('retains collapsed desktop flyout behavior for Planner', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Collapse sidebar
      act(() => {
        container.querySelector('.nav-toggle-btn').click();
      });

      const progGroup = container.querySelector('#nav-section-progression');
      const plannerContainer = Array.from(progGroup.querySelectorAll('.flyout-container')).find(
        (fc) => fc.querySelector('.sidebar-nav-link')?.getAttribute('title') === 'Planner'
      );
      expect(plannerContainer).not.toBeNull();
      const plannerLink = plannerContainer.querySelector('.sidebar-nav-link');

      // Flyout not open initially
      expect(container.querySelector('a[href="/planner?tab=daily_action"]')).toBeNull();

      // Click to open flyout
      act(() => {
        plannerLink.click();
      });

      expect(container.querySelector('a[href="/planner?tab=daily_action"]')).not.toBeNull();
    });

    it('retains expandable submenu behavior for Inventory in expanded sidebar', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      expect(container.querySelector('a[href="/inventory?tab=currency_exp"]')).toBeNull();

      const progGroup = container.querySelector('#nav-section-progression');
      const inventoryToggle = Array.from(progGroup.querySelectorAll('.sidebar-nav-link')).find(
        (el) => el.textContent.includes('Inventory')
      );
      expect(inventoryToggle).not.toBeNull();

      // Click to expand
      act(() => {
        inventoryToggle.click();
      });

      expect(container.querySelector('a[href="/inventory?tab=currency_exp"]')).not.toBeNull();

      // Click again to collapse
      act(() => {
        inventoryToggle.click();
      });

      expect(container.querySelector('a[href="/inventory?tab=currency_exp"]')).toBeNull();
    });

    it('retains collapsed desktop flyout behavior for Inventory', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Collapse sidebar
      act(() => {
        container.querySelector('.nav-toggle-btn').click();
      });

      const progGroup = container.querySelector('#nav-section-progression');
      const flyoutContainers = progGroup.querySelectorAll('.flyout-container');
      const inventoryContainer = Array.from(flyoutContainers).find(
        (fc) => fc.querySelector('.sidebar-nav-link')?.getAttribute('title') === 'Inventory'
      );
      expect(inventoryContainer).not.toBeNull();

      const inventoryLink = inventoryContainer.querySelector('.sidebar-nav-link');

      // Click to open flyout
      act(() => {
        inventoryLink.click();
      });

      expect(container.querySelector('a[href="/inventory?tab=currency_exp"]')).not.toBeNull();
    });

    it('preserves route active styling across all section groups', () => {
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/achievements']}>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const achievementsLink = container.querySelector('a[href="/achievements"]');
      expect(achievementsLink.classList.contains('active')).toBe(true);

      const dashboardLink = container.querySelector('a[href="/"]');
      expect(dashboardLink.classList.contains('active')).toBe(false);

      const charactersLink = container.querySelector('a[href="/characters"]');
      expect(charactersLink.classList.contains('active')).toBe(false);
    });
  });
  describe('Responsive Foundation & Mobile Shell (Stage R1)', () => {
    it('1. mobile navigation toggle remains available below 768 and has minimum ~44x44 touch target', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const toggle = container.querySelector('#sidebar-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle.getAttribute('aria-controls')).toBe('app-sidebar');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.className).toContain('md:hidden');
      expect(toggle.className).toContain('w-11');
      expect(toggle.className).toContain('h-11');

      // Toggling opens the sidebar drawer and locks body scroll
      act(() => {
        toggle.click();
      });
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector('#app-sidebar').classList.contains('open')).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');

      // Toggling again closes the sidebar drawer and restores body scroll
      act(() => {
        toggle.click();
      });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(container.querySelector('#app-sidebar').classList.contains('open')).toBe(false);
      expect(document.body.style.overflow).toBe('');
    });

    it('2. 768px breakpoint does not logically hide all navigation controls', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Sidebar is persistent element in DOM
      const sidebar = container.querySelector('#app-sidebar');
      expect(sidebar).not.toBeNull();

      // Desktop toggle button is available for md/tablet devices
      const desktopToggle = container.querySelector('.nav-toggle-btn');
      expect(desktopToggle).not.toBeNull();
      expect(desktopToggle.className).toContain('hidden');
      expect(desktopToggle.className).toContain('md:flex');

      // Mobile toggle button has md:hidden so below 768px it is displayed
      const mobileToggle = container.querySelector('#sidebar-toggle');
      expect(mobileToggle).not.toBeNull();
      expect(mobileToggle.className).toContain('md:hidden');
    });

    it('3-7. mobile telemetry strip renders with Resin, Realm Currency, Armory and Roster when connected', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: { char1: {}, char2: {} },
          trackedWeapons: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }],
          hoyolabConnected: true,
          hasCookie: true,
          lastHoyolabCharacterSyncAt: Date.now(),
          syncPayload: {
            resin: { current: 160, max: 200, targetFullTime: Date.now() + 3600000 },
            realm_currency: { current: 2400, max: 2400, targetFullTime: null },
          },
          resinCount: 160,
          resinTimestamp: Date.now(),
          displayTimeZone: 'UTC',
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

      const telemetryStrip = container.querySelector('#mobile-telemetry-strip');
      expect(telemetryStrip).not.toBeNull();
      expect(telemetryStrip.getAttribute('aria-label')).toBe('Mobile resource telemetry');

      // 4. Resin visible in mobile telemetry state
      const resinTrackers = container.querySelectorAll('[aria-label="Resin Tracker"]');
      expect(resinTrackers.length).toBeGreaterThanOrEqual(1);

      // 5. Realm Currency visible in mobile telemetry state
      const realmTrackers = container.querySelectorAll('[aria-label="Realm Currency Tracker"]');
      expect(realmTrackers.length).toBeGreaterThanOrEqual(1);

      // 6. Armory count visible in mobile telemetry state
      const armoryTracker = container.querySelector('[data-testid="mobile-armory-tracker"]');
      expect(armoryTracker).not.toBeNull();
      expect(armoryTracker.textContent).toContain('3');

      // 7. Roster count visible in mobile telemetry state
      const rosterTracker = container.querySelector('[data-testid="mobile-roster-tracker"]');
      expect(rosterTracker).not.toBeNull();
      expect(rosterTracker.textContent).toContain('2');
    });

    it('8. disconnected state still renders mobile telemetry strip with local Armory and Roster counters', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: { c1: {}, c2: {}, c3: {} },
          trackedWeapons: [{ id: 'w1' }, { id: 'w2' }],
          hoyolabConnected: false,
          hasCookie: false,
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

      // Mobile telemetry strip STILL renders for local counters
      expect(container.querySelector('#mobile-telemetry-strip')).not.toBeNull();
      // Live trackers do not render
      expect(container.querySelector('[aria-label="Resin Tracker"]')).toBeNull();
      expect(container.querySelector('[aria-label="Realm Currency Tracker"]')).toBeNull();
      // Local Armory and Roster render
      const armoryTracker = container.querySelector('[data-testid="mobile-armory-tracker"]');
      const rosterTracker = container.querySelector('[data-testid="mobile-roster-tracker"]');
      expect(armoryTracker).not.toBeNull();
      expect(armoryTracker.textContent).toContain('2');
      expect(rosterTracker).not.toBeNull();
      expect(rosterTracker.textContent).toContain('3');
    });

    it('8b. connected but syncPayload unavailable renders local counters without invalid live trackers', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: { c1: {} },
          trackedWeapons: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }, { id: 'w4' }],
          hoyolabConnected: true,
          hasCookie: true,
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

      // Mobile telemetry strip still renders
      expect(container.querySelector('#mobile-telemetry-strip')).not.toBeNull();
      // Live trackers do not render
      expect(container.querySelector('[aria-label="Resin Tracker"]')).toBeNull();
      expect(container.querySelector('[aria-label="Realm Currency Tracker"]')).toBeNull();
      // Local counters render
      expect(container.querySelector('[data-testid="mobile-armory-tracker"]').textContent).toContain('4');
      expect(container.querySelector('[data-testid="mobile-roster-tracker"]').textContent).toContain('1');
    });

    it('8c. desktop behavior unchanged when disconnected: shows Armory and Roster in header row, no live trackers', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: { c1: {} },
          trackedWeapons: [{ id: 'w1' }],
          hoyolabConnected: false,
          hasCookie: false,
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

      // Resin and Realm hidden on desktop
      expect(container.querySelector('[aria-label="Resin Tracker"]')).toBeNull();
      expect(container.querySelector('[aria-label="Realm Currency Tracker"]')).toBeNull();
      // HoYoLAB sync button hidden
      expect(container.querySelector('#global-hoyolab-sync-btn')).toBeNull();
      // Desktop Armory & Roster visible
      expect(container.querySelector('div[title="My Armory"]')).not.toBeNull();
      expect(container.querySelector('div[title="Roster"]')).not.toBeNull();
      // Profile control visible
      expect(container.querySelector('#user-avatar-logged-out')).not.toBeNull();
    });

    it('9. HoYoLAB sync remains accessible in topbar', () => {
      useStore.mockImplementation((selector) => {
        const state = {
          showDbBuilder: false,
          roster: {},
          trackedWeapons: [],
          hoyolabConnected: true,
          lastHoyolabCharacterSyncAt: null,
          hasCookie: true,
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
    });

    it('10. profile/login control remains accessible and account dropdown closes with Escape', () => {
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

      const profileBtn = container.querySelector('#user-avatar-logged-in');
      expect(profileBtn).not.toBeNull();

      // Open dropdown
      act(() => {
        profileBtn.click();
      });
      expect(container.textContent).toContain('Sign Out / Disconnect');

      // Escape closes dropdown
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(container.textContent).not.toContain('Sign Out / Disconnect');
    });

    it('11. grouped sidebar remains intact with Progression, Records, and System', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      expect(container.querySelector('#nav-section-progression')).not.toBeNull();
      expect(container.querySelector('#nav-section-records')).not.toBeNull();
      expect(container.querySelector('#nav-section-system')).not.toBeNull();
    });

    it('12. Planner mobile submenu still works with minimum 40px touch targets', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const progGroup = container.querySelector('#nav-section-progression');
      const plannerToggle = Array.from(progGroup.querySelectorAll('.sidebar-nav-link')).find(
        (el) => el.textContent.includes('Planner')
      );
      expect(plannerToggle).not.toBeNull();

      // Open Planner submenu
      act(() => {
        plannerToggle.click();
      });

      const plannerTab = container.querySelector('a[href="/planner?tab=daily_action"]');
      expect(plannerTab).not.toBeNull();
      expect(plannerTab.className).toContain('py-2.5');
      expect(plannerTab.className).toContain('min-h-[40px]');

      // Clicking child link closes mobile sidebar
      act(() => {
        container.querySelector('#sidebar-toggle').click();
      });
      expect(container.querySelector('#app-sidebar').classList.contains('open')).toBe(true);

      act(() => {
        plannerTab.click();
      });
      expect(container.querySelector('#app-sidebar').classList.contains('open')).toBe(false);
    });

    it('13. Inventory mobile submenu still works with minimum 40px touch targets', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const progGroup = container.querySelector('#nav-section-progression');
      const inventoryToggle = Array.from(progGroup.querySelectorAll('.sidebar-nav-link')).find(
        (el) => el.textContent.includes('Inventory')
      );
      expect(inventoryToggle).not.toBeNull();

      // Open Inventory submenu
      act(() => {
        inventoryToggle.click();
      });

      const invTab = container.querySelector('a[href="/inventory?tab=currency_exp"]');
      expect(invTab).not.toBeNull();
      expect(invTab.className).toContain('py-2.5');
      expect(invTab.className).toContain('min-h-[40px]');
    });

    it('14. desktop collapsed sidebar behavior still works', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const rootDiv = container.firstChild;
      expect(rootDiv.classList.contains('desktop-collapsed')).toBe(false);

      act(() => {
        container.querySelector('.nav-toggle-btn').click();
      });
      expect(rootDiv.classList.contains('desktop-collapsed')).toBe(true);
    });

    it('15. legal links unchanged and maintain accessible ~40px touch targets', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      const privacyLink = container.querySelector('#sidebar-privacy-link');
      const termsLink = container.querySelector('#sidebar-terms-link');
      expect(privacyLink).not.toBeNull();
      expect(termsLink).not.toBeNull();
      expect(privacyLink.className).toContain('min-h-[40px]');
      expect(termsLink.className).toContain('min-h-[40px]');
    });

    it('16. notification safe-area change does not break rendering', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        );
      });

      // Notification container renders without errors in the tree
      // When empty it renders null, AppLayout remains fully mounted
      expect(container.querySelector('#app-topbar')).not.toBeNull();
    });
  });
});
