import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Traveler's Toolkit — Privacy Policy";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted,#8B8BA0)] hover:text-white transition-colors mb-4"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text,#E8E3D5)] mb-2">
          Privacy Policy
        </h1>
        <p className="text-xs text-[var(--muted,#8B8BA0)]">
          Last updated: October 15, 2026
        </p>
      </div>

      <div className="space-y-8 text-[var(--text,#E8E3D5)] leading-relaxed text-sm md:text-base">
        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">1. Overview</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            Traveler&apos;s Toolkit is an independent, fan-made web companion for players of Genshin Impact.
            It is not affiliated with, endorsed by, or sponsored by HoYoverse or miHoYo.
            We respect your privacy and design our features so that you retain complete control over your gameplay data and credentials.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">2. Data Storage & Local Persistence</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            By default, Traveler&apos;s Toolkit operates as a client-side application. Your progression records—including your roster, weapon tracking, material plans, inventory counts, resin settings, and achievement completion progress—are stored locally in your web browser via <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">localStorage</code>.
          </p>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            We do not operate a central user database. Your game planning data remains on your device unless you explicitly opt in to cloud synchronization features.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">3. Optional Google Account & Drive Integration</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            You may choose to connect a Google account to back up and restore your Traveler&apos;s Toolkit data across devices:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--muted,#8B8BA0)] mb-4">
            <li>
              <strong className="text-[var(--text,#E8E3D5)]">Google Profile Data:</strong> We request basic identity profile information (name, email address, profile picture) solely to display your connected account status in the application header.
            </li>
            <li>
              <strong className="text-[var(--text,#E8E3D5)]">Google Drive appDataFolder:</strong> We request access only to your personal Google Drive Application Data folder (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">drive.appdata</code>). This restricted scope permits Traveler&apos;s Toolkit to read and write only its own backup files (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">travelers-toolkit-backup-*.json</code>). Traveler&apos;s Toolkit cannot see, access, or modify any other files in your Google Drive.
            </li>
            <li>
              <strong className="text-[var(--text,#E8E3D5)]">Token Handling:</strong> OAuth authorization tokens are exchanged securely by our backend companion and stored in encrypted, <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">HttpOnly</code>, <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">SameSite=Lax</code> session cookies. Tokens are never exposed to browser client-side JavaScript.
            </li>
          </ul>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs md:text-sm text-[var(--muted,#8B8BA0)]">
            <strong className="text-[var(--text,#E8E3D5)]">Google API Limited Use Disclosure:</strong>
            <p className="mt-1">
              Traveler&apos;s Toolkit&apos;s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. Google user data is never used for advertising, model training, or unauthorized third-party transfers.
            </p>
          </div>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">4. Optional HoYoLAB Synchronization</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            Traveler&apos;s Toolkit provides two methods to connect your HoYoLAB account for importing Real-Time Notes, character builds, or achievement completion records:
          </p>
          <div className="space-y-4 text-[var(--muted,#8B8BA0)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text,#E8E3D5)] mb-1">
                A. Sign in with HoYoLAB (Automated)
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li>
                  When you sign in using your HoYoverse email or username and password, your credentials are transmitted over encrypted HTTPS to the Traveler&apos;s Toolkit backend solely to authenticate with HoYoverse official authentication endpoints.
                </li>
                <li>
                  Your password is <strong className="text-[var(--text,#E8E3D5)]">never stored</strong> in a persistent database, local storage (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">localStorage</code> / <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">sessionStorage</code>), or server logs.
                </li>
                <li>
                  During a multi-step login challenge (such as solving a security captcha or entering an email verification code), temporary authentication state including credentials may exist inside a Fernet-encrypted (AES-128-CBC + HMAC-SHA256) <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">HttpOnly</code>, <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">SameSite=Lax</code> flow cookie (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">tt_hoyolab_flow_state</code>) in your browser.
                </li>
                <li>
                  This temporary flow cookie automatically expires after approximately 10 minutes. Your password is permanently discarded as soon as authentication succeeds.
                </li>
                <li>
                  Upon successful sign-in, the persistent session cookie (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">tt_hoyolab_session</code>) contains only the community session tokens (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">ltuid_v2</code>, <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">ltoken_v2</code>) required for read-only sync, encrypted server-side in an <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">HttpOnly</code> cookie.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text,#E8E3D5)] mb-1">
                B. Manual Cookie Entry (Advanced / Fallback)
              </h3>
              <p className="leading-relaxed">
                You may alternatively provide your HoYoLAB cookie tokens (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">ltuid</code>, <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">ltoken</code>) directly. Tokens are encrypted server-side using Fernet and stored in an encrypted <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">HttpOnly</code> session cookie.
              </p>
            </div>
          </div>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">5. Third-Party Security Verification (GeeTest)</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            When HoYoverse requires additional security verification during sign-in, Traveler&apos;s Toolkit dynamically loads the GeeTest challenge required for that verification from official GeeTest domains (<code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">static.geetest.com</code> and <code className="text-xs px-1.5 py-0.5 rounded bg-black/40 text-amber-300">gcaptcha4.captchami.com</code>).
          </p>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            As an independent third-party service, GeeTest may process technical information needed to deliver and validate the security verification challenge under its own privacy practices.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">6. Tracking, Advertising & Third Parties</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            Traveler&apos;s Toolkit does not use third-party advertising trackers, analytics SDKs, behavioral profiling, or data brokers. We do not sell or monetize personal information.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">7. Managing and Deleting Your Data</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--muted,#8B8BA0)]">
            <li><strong className="text-[var(--text,#E8E3D5)]">Disconnect Google:</strong> You can disconnect your Google account at any time using the account menu in the top bar or via Settings. Disconnecting clears session cookies immediately.</li>
            <li><strong className="text-[var(--text,#E8E3D5)]">Disconnect HoYoLAB:</strong> You can disconnect HoYoLAB via Settings, purging your session cookie immediately.</li>
            <li><strong className="text-[var(--text,#E8E3D5)]">Factory Reset:</strong> You can wipe all locally stored planner data via the Factory Reset action in Settings, or by clearing your browser site data.</li>
            <li><strong className="text-[var(--text,#E8E3D5)]">Drive Backups:</strong> You can delete backups directly within Settings or via Google Drive account management.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">8. Contact & Updates</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            If you have questions regarding this Privacy Policy or data security in Traveler&apos;s Toolkit, please open an issue or inquiry on our open source repository or contact the project maintainers.
          </p>
        </section>
      </div>
    </div>
  );
}
