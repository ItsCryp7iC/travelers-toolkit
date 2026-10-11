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
});
