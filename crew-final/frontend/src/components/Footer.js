import { Link } from 'react-router-dom';
import { MessageCircle, Mail, MapPin } from 'lucide-react';

function CrewLogo() {
  return (
    <a href="https://www.grapelabs.in" target="_blank" rel="noopener noreferrer" className="inline-flex flex-col leading-none gap-1">
      <span className="font-inter font-[800] text-3xl tracking-tight text-white" style={{ letterSpacing: '-1.5px' }}>CREW</span>
      <span className="font-inter font-normal text-sm" style={{ color: '#6B5FA0' }}>
        by GrapeLabs{' '}<span style={{ color: '#D4880A' }}>AI</span>
      </span>
    </a>
  );
}

export default function Footer() {
  return (
    <footer
      data-testid="main-footer"
      className="py-16 px-6 md:px-12"
      style={{ background: '#1C0A30', borderTop: '1px solid rgba(74,61,143,0.20)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <CrewLogo />
            <p className="mt-4 font-inter text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Find your people. Race your best.
            </p>
          </div>

          <div>
            <h4 className="font-inter font-semibold text-sm mb-4" style={{ color: '#fff' }}>Product</h4>
            <div className="flex flex-col gap-3">
              {[
                { to: '/how-it-works', label: 'How It Works' },
                { to: '/find-a-partner', label: 'Find a Partner' },
                { to: '/events', label: 'Events' },
                { to: '/about', label: 'About Us' },
              ].map(l => (
                <Link key={l.to} to={l.to} className="font-inter text-sm transition-colors hover:text-amber-brand"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-inter font-semibold text-sm mb-4" style={{ color: '#fff' }}>Contact Us</h4>
            <div className="flex flex-col gap-3">
              <a href="https://wa.me/918388892300" target="_blank" rel="noopener noreferrer"
                className="font-inter text-sm flex items-center gap-2 transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                <MessageCircle size={13} style={{ color: '#25D366', flexShrink: 0 }} />
                +91 83888 92300
              </a>
              <a href="mailto:mycrew.find@gmail.com"
                className="font-inter text-sm flex items-center gap-2 transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                <Mail size={13} style={{ color: '#D4880A', flexShrink: 0 }} />
                mycrew.find@gmail.com
              </a>
              <p className="font-inter text-sm flex items-start gap-2"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                <MapPin size={13} style={{ color: '#6B5FA0', flexShrink: 0, marginTop: 2 }} />
                Green Park Extension, New Delhi 110016
              </p>
              <div className="pt-1 border-t" style={{ borderColor: 'rgba(74,61,143,0.20)' }}>
                <Link to="/privacy-policy" className="font-inter text-sm block mb-2 transition-colors hover:text-amber-brand"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Privacy Policy
                </Link>
                <Link to="/terms" className="font-inter text-sm block transition-colors hover:text-amber-brand"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Terms &amp; Conditions
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-8" style={{ borderColor: 'rgba(74,61,143,0.20)' }}>
          <p className="font-inter text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            &copy; 2026 GrapeLabs{' '}<span style={{ color: '#D4880A' }}>AI</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
