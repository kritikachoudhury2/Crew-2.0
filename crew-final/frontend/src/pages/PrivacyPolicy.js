import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  const sections = [
    { title: '1. Introduction', body: 'CREW ("we", "us", "our") is a service built and operated by Grape Labs AI. This Privacy Policy explains how we collect, use, and protect your personal information when you use our athlete partner-matching platform.' },
    { title: '2. Information We Collect', body: 'We collect: name, email address, phone number, age, gender, city and neighbourhood, GPS coordinates (with explicit permission), profile photo, sport and fitness data you provide, Instagram handle (if provided), Strava URL (if provided), connection request activity, and usage data.' },
    { title: '3. How We Use Your Information', body: 'We use your information to: create and manage your profile, match you with compatible athletes, send account verification and notification emails, generate WhatsApp deep links after mutual connections, and improve the platform. We do not sell your data to any third party.' },
    { title: '4. Phone Number Privacy', body: 'Your phone number is stored encrypted in our database. It is never displayed on your public profile, in search results, or anywhere visible to other users. It is used solely to generate a WhatsApp link after both athletes have accepted a connection request. We do not send SMS messages.' },
    { title: '5. Location Data', body: 'GPS coordinates are used only for proximity-based matching. They are stored encrypted and are never shared with other users. We show city and neighbourhood names — not coordinates — on public profiles.' },
    { title: '6. Data Sharing', body: 'We use Supabase for data storage, authentication, and email delivery. We may share data with these services as necessary to operate the platform. We do not share data with advertisers, data brokers, or any other third parties.' },
    { title: '7. Your Rights', body: 'You may request access to your data, correction of inaccurate data, deletion of your account and all associated data, and opt-out of marketing emails at any time by visiting /profile/edit or emailing us at privacy@grapelabs.in.' },
    { title: '8. Data Retention', body: 'Profile data is retained until you delete your account. Connection and match history is retained for 12 months after account deletion for fraud prevention, then permanently deleted.' },
    { title: '9. Cookies', body: 'We use localStorage to store your theme preference and onboarding progress. We do not use advertising or tracking cookies.' },
    { title: '10. Children', body: 'CREW is not intended for users under 16 years of age. By signing up, you confirm that you are 16 or older.' },
    { title: '11. Changes to This Policy', body: 'We may update this policy. We will notify you by email if changes are material. Continued use of CREW after changes constitutes acceptance.' },
    { title: '12. Contact', body: 'For privacy enquiries: privacy@grapelabs.in · Grape Labs AI, New Delhi, India.' },
  ];

  return (
    <div data-testid="privacy-policy-page">
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-[720px] mx-auto">
          <div className="flex items-center gap-2 mb-8 font-inter text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link to="/" className="hover:text-amber-brand transition-colors">Home</Link>
            <span>›</span>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>Privacy Policy</span>
          </div>
          <h1 className="font-inter font-[800] text-4xl sm:text-5xl text-white mb-3" style={{ letterSpacing: '-2px' }}>Privacy Policy</h1>
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
