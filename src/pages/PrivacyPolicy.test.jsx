import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicy from './PrivacyPolicy';

describe('PrivacyPolicy Page Content & Disclosures', () => {
  it('renders required HoYoLAB automated sign-in and security disclosures accurately', () => {
    const { container } = render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>
    );

    const text = container.textContent;

    // 1. Mentions automated HoYoLAB sign-in and manual cookie entry
    expect(text).toContain('Sign in with HoYoLAB (Automated)');
    expect(text).toContain('Manual Cookie Entry (Advanced / Fallback)');

    // 2. Mentions backend credential transit
    expect(text).toContain('transmitted over encrypted HTTPS to the Traveler');
    expect(text).toContain('backend solely to authenticate with HoYoverse');

    // 3. Mentions no persistent password storage
    expect(text).toContain('never stored in a persistent database');
    expect(text).toContain('localStorage');
    expect(text).toContain('sessionStorage');

    // 4. Mentions temporary encrypted HttpOnly flow cookie with 10-minute TTL
    expect(text).toContain('tt_hoyolab_flow_state');
    expect(text).toContain('HttpOnly');
    expect(text).toContain('SameSite=Lax');
    expect(text).toContain('10 minutes');

    // 5. Mentions persistent read-only session cookie
    expect(text).toContain('tt_hoyolab_session');
    expect(text).toContain('ltuid_v2');
    expect(text).toContain('ltoken_v2');

    // 6. Mentions GeeTest as third-party verification provider
    expect(text).toContain('Third-Party Security Verification (GeeTest)');
    expect(text).toContain('static.geetest.com');
    expect(text).toContain('gcaptcha4.captchami.com');

    // 7. No unsupported third-party privacy claims regarding GeeTest
    expect(text).not.toContain('zero tracking');
    expect(text).not.toContain('does not use GeeTest for user tracking');
    expect(text).not.toContain('GeeTest does not track');
  });
});
