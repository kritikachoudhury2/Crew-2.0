import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Users, LogOut, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

// Helper — fires GA4 event safely even if gtag hasn't loaded yet
function gtagEvent(eventName, params) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) { setPendingCount(0); return; }

    const fetchPending = async () => {
      const { count } = await supabase
        .from('connect_requests')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');
      setPendingCount(count || 0);
    };

    fetchPending();

    // Poll every 60s — avoids a persistent Realtime connection for a badge
    const interval = setInterval(fetchPending, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    setMobileOpen(false);
    await signOut();
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/find-a-partner', label: 'Find a Partner' },
    { to: '/events', label: 'Events' },
    { to: '/about', label: 'About Us' },
  ];

  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname === path;

  const ConnectionsBadge = ({ size = 'sm' }) => {
    if (pendingCount === 0) return null;
    return (
      <span
        className="absolute font-inter font-bold flex items-center justify-center rounded-full"
        style={{
          background: '#D4880A', color: '#fff',
          fontSize: size === 'sm' ? '9px' : '10px',
          minWidth: size === 'sm' ? '15px' : '18px',
          height: size === 'sm' ? '15px' : '18px',
          top: size === 'sm' ? '-2px' : '-3px',
          right: size === 'sm' ? '-2px' : '-3px',
          padding: '0 3px',
          lineHeight: 1,
        }}>
        {pendingCount > 9 ? '9+' : pendingCount}
      </span>
    );
  };

  return (
    <>
      <nav
        data-testid="main-navbar"
        className="sticky top-0 z-50 h-16 flex items-center justify-between px-6 md:px-12"
        style={{ background: '#1C0A30', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Logo */}
        <Link to="/" className="no-underline flex flex-col leading-none gap-0.5" onClick={() => setMobileOpen(false)}>
          <span className="font-inter font-[800] text-2xl tracking-tight" style={{ color: '#FFFFFF', letterSpacing: '-1px' }}>CREW</span>
          {/* ── TRACKED: GrapeLabs AI logo link ── */}
          <a href="https://www.grapelabs.in" target="_blank" rel="noopener noreferrer"
            className="font-inter font-normal text-[11px] no-underline" style={{ color: '#6B5FA0' }}
            onClick={e => {
              e.stopPropagation();
              gtagEvent('grapelabs_interest', {
                click_location: 'navbar_logo',
                link_text: 'by GrapeLabs AI',
                destination: 'https://www.grapelabs.in',
              });
            }}>
            by GrapeLabs <span style={{ color: '#D4880A' }}>AI</span>
          </a>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to}
              className="font-inter font-medium text-sm transition-colors duration-200"
              style={{ color: isActive(link.to) ? '#D4880A' : 'rgba(255,255,255,0.75)' }}
              onClick={() => {
                // ── TRACKED: About Us nav click ──
                if (link.to === '/about') {
                  gtagEvent('about_us_click', {
                    click_location: 'navbar_desktop',
                    link_text: 'About Us',
                  });
                }
              }}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              {/* Find a Partner icon */}
              <Link to="/find-a-partner" title="Find a Partner"
                className="relative p-2 rounded-full transition-colors"
                style={{ color: isActive('/find-a-partner') ? '#D4880A' : 'rgba(255,255,255,0.6)' }}>
                <Search size={18} />
              </Link>

              {/* My Connections icon + badge */}
              <Link to="/my-connections" title="My Connections"
                className="relative p-2 rounded-full transition-colors"
                style={{ color: isActive('/my-connections') ? '#D4880A' : 'rgba(255,255,255,0.6)' }}>
                <Users size={18} />
                <ConnectionsBadge size="sm" />
              </Link>

              <Link to="/profile/edit"
                className="font-inter font-medium text-sm px-5 py-2 rounded-pill"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                {profile?.name || 'Profile'}
              </Link>
              <button onClick={handleSignOut} title="Sign out" className="p-2 rounded-full" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/get-started?mode=login"
                className="font-inter font-medium text-sm px-5 py-2 rounded-pill transition-all"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                Log In
              </Link>
              <Link to="/get-started"
                className="font-inter font-bold text-sm px-6 py-2.5 rounded-pill transition-all hover:scale-[1.02]"
                style={{ background: '#D4880A', color: '#FFFFFF' }}>
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile right */}
        <div className="flex md:hidden items-center gap-1">
          {user && (
            <>
              <Link to="/find-a-partner" onClick={() => setMobileOpen(false)}
                className="relative p-2 rounded-full"
                style={{ color: isActive('/find-a-partner') ? '#D4880A' : 'rgba(255,255,255,0.7)' }}>
                <Search size={22} />
              </Link>
              <Link to="/my-connections" onClick={() => setMobileOpen(false)}
                className="relative p-2 rounded-full"
                style={{ color: isActive('/my-connections') ? '#D4880A' : 'rgba(255,255,255,0.7)' }}>
                <Users size={22} />
                <ConnectionsBadge size="sm" />
              </Link>
            </>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2" style={{ color: '#fff' }}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6"
          style={{ background: '#1C0A30', top: '64px' }}>
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => {
              setMobileOpen(false);
              // ── TRACKED: About Us mobile nav click ──
              if (link.to === '/about') {
                gtagEvent('about_us_click', {
                  click_location: 'navbar_mobile',
                  link_text: 'About Us',
                });
              }
            }}
              className="font-inter font-semibold text-2xl"
              style={{ color: isActive(link.to) ? '#D4880A' : '#fff' }}>
              {link.label}
            </Link>
          ))}
          <div className="border-t w-32 my-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          {user ? (
            <>
              <Link to="/my-connections" onClick={() => setMobileOpen(false)}
                className="font-inter font-medium text-xl flex items-center gap-2" style={{ color: '#fff' }}>
                My Connections
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-inter font-bold text-xs"
                    style={{ background: '#D4880A', color: '#fff' }}>
                    {pendingCount}
                  </span>
                )}
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
            <div className="flex flex-col items-center gap-4">
              <Link to="/get-started?mode=login" onClick={() => setMobileOpen(false)}
                className="font-inter font-medium text-xl" style={{ color: '#fff' }}>
                Log In
              </Link>
              <Link to="/get-started" onClick={() => setMobileOpen(false)}
                className="font-inter font-bold text-sm px-8 py-3 rounded-pill"
                style={{ background: '#D4880A', color: '#FFFFFF' }}>
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
