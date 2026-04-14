import { Link } from 'react-router-dom';

export default function Terms() {
  const sections = [
    { title: '1. Acceptance of Terms', body: 'By creating an account on CREW, you agree to these Terms and Conditions. If you do not agree, do not use the platform.' },
    { title: '2. Eligibility', body: 'You must be at least 16 years old to use CREW. By registering, you confirm you meet this requirement.' },
    { title: '3. Your Account', body: 'You are responsible for maintaining the security of your account and for all activity that occurs under your account. You must provide accurate information during registration and keep it up to date.' },
    { title: '4. Acceptable Use', body: 'You agree not to: create fake or misleading profiles, harass, abuse, or harm other users, use CREW for commercial solicitation without permission, attempt to reverse-engineer or exploit the platform, or violate any applicable law.' },
    { title: '5. User Content', body: 'You are solely responsible for the content you post on CREW, including your profile information, bio, and photos. By posting content, you grant Grape Labs AI a non-exclusive licence to display that content on the platform.' },
    { title: '6. Connections and WhatsApp', body: 'CREW facilitates introductions between athletes. Once a connection is accepted and you exchange contact via WhatsApp, any further interaction is between you and the other athlete. Grape Labs AI is not responsible for interactions that occur outside the platform.' },
    { title: '7. Privacy', body: 'Our collection and use of personal data is described in our Privacy Policy, which is incorporated into these Terms by reference.' },
    { title: '8. Intellectual Property', body: 'All CREW branding, design, and code is owned by Grape Labs AI. The Grape Labs AI name, logo, and visual identity may not be used without permission.' },
    { title: '9. Disclaimers', body: 'CREW is provided "as is". We make no guarantees about the availability, accuracy, or suitability of matches. We are not responsible for the conduct of any user.' },
    { title: '10. Limitation of Liability', body: 'To the maximum extent permitted by law, Grape Labs AI shall not be liable for any indirect, incidental, or consequential damages arising from your use of CREW.' },
    { title: '11. Termination', body: 'We reserve the right to suspend or terminate accounts that violate these Terms.' },
    { title: '12. Governing Law', body: 'These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of the courts of New Delhi, India.' },
    { title: '13. Contact', body: 'For legal enquiries: legal@grapelabs.in · Grape Labs AI, New Delhi, India.' },
  ];

  return (
    <div data-testid="terms-page">
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-[720px] mx-auto">
          <div className="flex items-center gap-2 mb-8 font-inter text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link to="/" className="hover:text-amber-brand transition-colors">Home</Link>
            <span>›</span>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>Terms & Conditions</span>
          </div>
          <h1 className="font-inter font-[800] text-4xl sm:text-5xl text-white mb-3" style={{ letterSpacing: '-2px' }}>Terms & Conditions</h1>
          <p className="font-inter text-sm mb-12" style={{ color: 'rgba(255,255,255,0.5)' }}>Last updated: April 2025</p>
          <div className="space-y-8">
            {sections.map((s, i) => (
              <div key={i}>
                <h2 className="font-inter font-bold text-lg text-white mb-3">{s.title}</h2>
                <p className="font-inter text-base" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
