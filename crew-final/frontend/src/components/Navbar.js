import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Users, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    setMobileOpen(false);
    await signOut();
  };

  const navLinks = [
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/find-a-partner', label: 'Find a Partner' },
    { to: '/events', label: 'Events' },
    { to: '/about', label: 'About Us' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav
        data-testid="main-navbar"
        className="sticky top-0 z-50 h-16 flex items-center justify-between px-6 md:px-12"
        style={{ background: '#1C0A30', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Logo */}
        <Link to="/" className="no-underline flex flex-col leading-none gap-0.5" data-testid="nav-logo" onClick={() => setMobileOpen(false)}>
          <span className="font-inter font-[800] text-2xl tracking-tight" style={{ color: '#FFFFFF', letterSpacing: '-1px' }}>CREW</span>
          <a href="https://www.grapelabs.in" target="_blank" rel="noopener noreferrer"
            className="font-inter font-normal text-[11px] no-underline" style={{ color: '#6B5FA0' }}
            onClick={e => e.stopPropagation()}>
            by GrapeLabs <span style={{ color: '#D4880A' }}>AI</span>
          </a>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to}
              className="font-inter font-medium text-sm transition-colors duration-200"
              style={{ color: isActive(link.to) ? '#D4880A' : 'rgba(255,255,255,0.75)' }}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Right */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/my-connections" className="p-2 rounded-full" style={{ color: isActive('/my-connections') ? '#D4880A' : 'rgba(255,255,255,0.6)' }}>
                <Users size={18} />
              </Link>
              <Link to="/profile/edit"
                className="font-inter font-medium text-sm px-5 py-2 rounded-pill"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                {profile?.name || 'Profile'}
              </Link>
              <button onClick={handleSignOut} className="p-2 rounded-full" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link to="/get-started"
              className="font-inter font-bold text-sm px-6 py-2.5 rounded-pill transition-all hover:scale-[1.02]"
              style={{ background: '#D4880A', color: '#FFFFFF' }}>
              Get Started
            </Link>
          )}
        </div>

        {/* Mobile right side — connections icon + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Link to="/my-connections" onClick={() => setMobileOpen(false)}
              className="p-2 rounded-full"
              style={{ color: isActive('/my-connections') ? '#D4880A' : 'rgba(255,255,255,0.7)' }}>
              <Users size={22} />
            </Link>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 z-50 relative" style={{ color: '#fff' }}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6"
          style={{ background: '#1C0A30', top: '64px' }}>
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
              className="font-inter font-semibold text-2xl"
              style={{ color: isActive(link.to) ? '#D4880A' : '#fff' }}>
              {link.label}
            </Link>
          ))}
          <div className="border-t w-32 my-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          {user ? (
            <>
              <Link to="/my-connections" onClick={() => setMobileOpen(false)}
                className="font-inter font-medium text-xl" style={{ color: '#fff' }}>
                My Connections
              </Link>
              <Link to="/profile/edit" onClick={() => setMobileOpen(false)}
                className="font-inter font-medium text-xl" style={{ color: '#fff' }}>
                Edit Profile
              </Link>
              <button onClick={handleSignOut} className="font-inter font-bold text-xl" style={{ color: '#D4880A' }}>
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/get-started" onClick={() => setMobileOpen(false)}
              className="font-inter font-bold text-sm px-8 py-3 rounded-pill"
              style={{ background: '#D4880A', color: '#FFFFFF' }}>
              Get Started
            </Link>
          )}
        </div>
      )}
    </>
  );
}
