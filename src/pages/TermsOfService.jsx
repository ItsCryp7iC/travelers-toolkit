import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  useEffect(() => {
    document.title = "Traveler's Toolkit — Terms of Service";
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
          Terms of Service
        </h1>
        <p className="text-xs text-[var(--muted,#8B8BA0)]">
          Last updated: October 11, 2026
        </p>
      </div>

      <div className="space-y-8 text-[var(--text,#E8E3D5)] leading-relaxed text-sm md:text-base">
        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">1. Agreement to Terms</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            By accessing or using Traveler&apos;s Toolkit, you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please discontinue use of the application.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">2. Description of Utility</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            Traveler&apos;s Toolkit is an independent, non-commercial productivity and companion tool designed to help Genshin Impact players calculate progression costs, plan weapon and character ascensions, track materials, and monitor achievement completion.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">3. Non-Affiliation & Intellectual Property</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            Traveler&apos;s Toolkit is an independent fan-made tool and is not affiliated with, endorsed by, or sponsored by HoYoverse or Cognosphere PTE. LTD.
          </p>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            Genshin Impact, game assets, character designs, logos, images, and audio are trademarks or registered trademarks of Cognosphere PTE. LTD. and miHoYo Co., Ltd. All in-game content and materials are used under community fair-use standards for informational and reference purposes.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">4. User Responsibilities & Account Security</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            You are responsible for your use of the application and the security of any credentials you choose to provide:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--muted,#8B8BA0)]">
            <li>You agree to comply with all applicable terms of service of third-party platforms, including Google and miHoYo/HoYoverse.</li>
            <li>You understand that optional cookie synchronization features involve reading game telemetry data from official public endpoints on your behalf.</li>
            <li>You are responsible for maintaining backups of your local data if desired.</li>
          </ul>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">5. Disclaimer of Warranties</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed mb-3">
            Traveler&apos;s Toolkit is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.
          </p>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            While we strive for high precision in material calculations and game data accuracy across version updates, we do not guarantee that all calculations or data representations will be error-free or uninterrupted.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">6. Limitation of Liability</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            To the maximum extent permitted by applicable law, the creators and contributors of Traveler&apos;s Toolkit shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your access to or use of the application.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-[#0b101b]/80 border border-[var(--border,#2b3245)] backdrop-blur-md">
          <h2 className="text-lg font-bold text-primary mb-3">7. Modifications & Termination</h2>
          <p className="text-[var(--muted,#8B8BA0)] leading-relaxed">
            We reserve the right to modify these Terms of Service at any time. Your continued use of the application following the posting of revised terms signifies your acceptance. You may stop using the application at any time by closing the site and deleting locally stored data.
          </p>
        </section>
      </div>
    </div>
  );
}
