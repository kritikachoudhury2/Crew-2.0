import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

function GradientAvatar({ name, size = 48 }) {
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#4A3D8F', '#D4880A', '#6B5FA0', '#0F6E56', '#8B5CF6'];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className="rounded-full flex items-center justify-center font-inter font-bold text-white shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${colors[idx]}, ${colors[(idx + 1) % colors.length]})` }}>
      {initials}
    </div>
  );
}

function HeroProfileCard({ name, city, sport, matchPct, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay }}
      className="rounded-[20px] p-4 backdrop-blur-xl border"
      style={{ background: 'rgba(42,26,69,0.80)', borderColor: 'rgba(74,61,143,0.30)' }}>
      <div className="flex items-center gap-3 mb-3 min-w-0">
        <GradientAvatar name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-inter font-semibold text-sm text-white truncate">{name}</p>
          <p className="font-inter text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{city} · {sport}</p>
        </div>
      </div>
      <div className="w-full h-1 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full" style={{ width: `${matchPct}%`, background: '#4A3D8F' }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-inter font-bold text-sm" style={{ color: '#F0A500' }}>{matchPct}% match</span>
        <span className="font-inter text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Same city · Similar level</span>
      </div>
    </motion.div>
  );
}

function Marquee() {
  const items = [
    'HYROX Delhi Jul 2026', 'TCS World 10K Apr 2026', 'HYROX Mumbai TBA',
    'Tata Mumbai Marathon Jan 2027', 'Vedanta Delhi Half Marathon Nov 2026', 'HYROX Bengaluru Apr 2026',
  ];
  return (
    <div className="overflow-hidden py-6" style={{ borderTop: '1px solid rgba(74,61,143,0.15)', borderBottom: '1px solid rgba(74,61,143,0.15)' }}>
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center mx-4 px-4 py-2 rounded-pill font-inter font-medium text-xs"
            style={{ background: 'rgba(212,136,10,0.12)', color: '#F0A830', border: '1px solid rgba(212,136,10,0.25)' }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SportCard({ badge, badgeColor, desc, tags, sport, to }) {
  return (
    <div className="rounded-[24px] p-8 flex flex-col h-full backdrop-blur-xl border transition-all duration-200 hover:-translate-y-1"
      style={{ background: 'rgba(42,26,69,0.60)', borderColor: 'rgba(74,61,143,0.30)' }}>
      <span className="inline-block self-start px-3 py-1 rounded-pill font-inter font-bold text-xs text-white mb-4"
        style={{ background: badgeColor }}>{badge}</span>
      <p className="font-inter text-sm mb-5 flex-1" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>{desc}</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {tags.map(t => (
          <span key={t} className="px-2.5 py-1 rounded-pill font-inter text-[11px]"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>{t}</span>
        ))}
      </div>
      <Link to={to} className="w-full text-center py-3 rounded-pill font-inter font-semibold text-sm transition-colors hover:opacity-90"
        style={{ background: badgeColor, color: '#fff' }} data-testid={`sport-card-${sport}-cta`}>
        Find {badge} Partners
      </Link>
    </div>
  );
}

export default function Home() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: evts } = await supabase.from('events').select('*')
        .gte('event_date', today).eq('is_active', true)
        .order('event_date', { ascending: true }).limit(3);
      if (evts?.length) setEvents(evts);
    };
    fetchData();
  }, []);

  const daysUntil = (d) => Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000));
  const sportBadge = (s) => {
    const map = { hyrox: { bg: '#4A3D8F', label: 'HYROX' }, marathon: { bg: '#D4880A', label: 'MARATHON' } };
    return map[s] || { bg: '#4A3D8F', label: s?.toUpperCase() };
  };
  const parseSport = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return [s]; } };

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="py-14 md:py-24 px-6 md:px-12 relative overflow-hidden" style={{ background: '#1C0A30' }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #7c6fd4 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 relative z-10">
          <div className="flex flex-col justify-center">
            <span className="inline-flex items-center self-start gap-2 px-3.5 py-1.5 rounded-pill font-inter font-medium text-[11px] uppercase tracking-wider mb-6"
              style={{ color: '#F0A500', background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#D4880A' }} /> ENDURANCE ATHLETE MATCHING
            </span>
            <h1 className="font-inter font-[800] text-4xl sm:text-5xl lg:text-[60px] text-white leading-[1.05] mb-6"
              style={{ letterSpacing: '-2px' }}>
              Find your people.<br />Race your best.
            </h1>
            <p className="font-inter text-base md:text-lg mb-8 max-w-[480px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Connect with HYROX and Marathon athletes who train at your level, chase the same race, and show up like you do.
            </p>

            {/* Buttons — full width on mobile, auto on sm+ */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link to="/get-started"
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#D4880A', color: '#fff' }}>
                Find My Partner <ArrowRight size={16} />
              </Link>
              <Link to="/how-it-works"
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3 rounded-pill font-inter font-semibold text-sm"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                See How It Works
              </Link>
            </div>

            {/* Stats — always centered on all screen sizes */}
            <div className="flex items-center justify-center gap-0">
              <div className="flex flex-col items-center">
                <span className="font-inter font-bold text-2xl text-white leading-tight">500+</span>
                <span className="font-inter text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Athletes matched</span>
              </div>
              <div className="mx-5 self-stretch" style={{ width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div className="flex flex-col items-center">
                <span className="font-inter font-bold text-2xl text-white leading-tight">2</span>
                <span className="font-inter text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Sports</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:pt-8">
            {/* WHAT TO EXPECT — yellow line only, no trailing text */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-inter font-semibold text-[10px] tracking-[0.18em] uppercase shrink-0" style={{ color: '#D4880A' }}>
                WHAT TO EXPECT
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(212,136,10,0.25)' }} />
            </div>
            <HeroProfileCard name="Arjun M." city="Delhi" sport="HYROX" matchPct={87} delay={0.1} />
            <HeroProfileCard name="Ayesha N." city="Bangalore" sport="Marathon" matchPct={74} delay={0.25} />
            <HeroProfileCard name="Vikram T." city="Mumbai" sport="HYROX + Marathon" matchPct={68} delay={0.4} />

            {/* GrapeLabs badge */}
            <div className="flex justify-center mt-2">
              <a
                href="https://www.grapelabs.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter font-medium uppercase tracking-wider"
                style={{
                  fontSize: '10px',
                  color: '#7C6FD4',
                  background: 'rgba(124,111,212,0.10)',
                  border: '1px solid rgba(124,111,212,0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                BUILT USING AI-POWERED SYSTEMS BY&nbsp;
                <span style={{ textTransform: 'none', color: '#7C6FD4' }}>GrapeLabs</span>&nbsp;
                <span style={{ textTransform: 'none', color: '#D4880A' }}>AI</span>
                <ExternalLink size={10} style={{ flexShrink: 0 }} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <Marquee />

      {/* HOW IT WORKS */}
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#2A1A45' }}>
        <div className="max-w-7xl mx-auto">
          <span className="block font-inter font-semibold text-xs tracking-[0.2em] uppercase mb-3" style={{ color: '#D4880A' }}>SIMPLE BY DESIGN</span>
          <h2 className="font-inter font-bold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-12">
            From sign-up to training partner in 3 minutes.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            {[
              { n: '1', title: 'Build your profile', desc: 'Sport, level, target race, goals. 2 minutes.' },
              { n: '2', title: 'Browse your matches', desc: 'Scored by proximity, level, sport, and timing.' },
              { n: '3', title: 'Connect safely', desc: 'Request, accept, WhatsApp. Always private.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-inter font-bold text-sm text-white" style={{ background: '#4A3D8F' }}>{s.n}</div>
                <div>
                  <p className="font-inter font-semibold text-white mb-1">{s.title}</p>
                  <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link to="/get-started" className="inline-flex items-center gap-2 px-7 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#D4880A', color: '#fff' }}>
            Create Your Profile <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* SPORT CARDS */}
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-7xl mx-auto">
          <span className="block font-inter font-semibold text-xs tracking-[0.2em] uppercase mb-3" style={{ color: '#D4880A' }}>BUILT FOR EVERY ENDURANCE ATHLETE</span>
          <h2 className="font-inter font-bold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-12">Pick your sport. Find your people.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <SportCard badge="HYROX" badgeColor="#4A3D8F" sport="hyrox"
              desc="Matched by category (Open/Pro/Doubles), your strongest and weakest stations, target race, and whether you need a doubles partner or a regular training crew."
              tags={['SkiErg', 'Sled Push', 'Wall Balls', 'Open · Pro · Doubles']}
              to="/find-a-partner?sport=hyrox" />
            <SportCard badge="MARATHON" badgeColor="#D4880A" sport="marathon"
              desc="Matched by pace, weekly mileage, target race, and what you are looking for — a long-run partner, tempo buddy, or someone to race alongside on the day."
              tags={['5K to Ultra', 'Pace matched', 'Goal-based', 'All levels']}
              to="/find-a-partner?sport=marathon" />
          </div>
        </div>
      </section>

      {/* ATHLETES ON CREW */}
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#2A1A45' }}>
        <div className="max-w-7xl mx-auto">
          <span className="block font-inter font-semibold text-xs tracking-[0.2em] uppercase mb-3" style={{ color: '#D4880A' }}>ATHLETES ON CREW</span>
          <h2 className="font-inter font-bold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-2">Already training with us.</h2>
          <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>Real profiles. Real races. Log in to connect.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                id: 'showcase-1',
                name: 'Aryan',
                city: 'Delhi',
                area: 'South Delhi',
                sport: '["hyrox"]',
                level: 'intermediate',
                bio: "Software engineer who found HYROX two years ago and has not looked back. Training five days a week, targeting sub-90 Open. Looking for someone who takes sessions seriously but keeps it fun.",
              },
              {
                id: 'showcase-2',
                name: 'Priya',
                city: 'Mumbai',
                area: 'Bandra',
                sport: '["marathon"]',
                level: 'advanced',
                bio: "Ran my first full marathon in 4:10, targeting 3:45 at Tata Mumbai 2027. Running 70 km weeks. Looking for a long-run partner who will not cancel on Sunday mornings.",
              },
              {
                id: 'showcase-3',
                name: 'Kabir',
                city: 'Bangalore',
                area: 'Koramangala',
                sport: '["hyrox","marathon"]',
                level: 'advanced',
                bio: "Founder by day, HYROX Doubles racer on weekends. Also running TCS World 10K every year. Looking for someone who trains across both disciplines and understands the grind.",
              },
            ].map((p) => (
              <div key={p.id} className="rounded-[20px] p-5 border flex flex-col transition-all hover:-translate-y-1"
                style={{ background: 'rgba(42,26,69,0.80)', borderColor: 'rgba(74,61,143,0.30)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <GradientAvatar name={p.name} size={44} />
                  <div className="min-w-0">
                    <p className="font-inter font-semibold text-sm text-white">{p.name}</p>
                    <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {p.city} · {p.area}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {parseSport(p.sport).filter(s => s !== 'ironman').map(s => {
                    const b = sportBadge(s);
                    return (
                      <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white"
                        style={{ background: b.bg }}>{b.label}</span>
                    );
                  })}
                  {p.level && (
                    <span className="px-2 py-0.5 rounded-pill text-[10px] font-inter capitalize"
                      style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
                      {p.level}
                    </span>
                  )}
                </div>
                <p className="font-inter text-xs mb-3 flex-1"
                  style={{ color: 'rgba(255,255,255,0.6)', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.bio}
                </p>
                <Link to="/get-started"
                  className="mt-auto font-inter font-semibold text-xs flex items-center gap-1"
                  style={{ color: '#D4880A' }}>
                  View Profile <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="font-inter font-bold text-2xl sm:text-3xl text-white tracking-tight mb-10">Races worth training for.</h2>
          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {events.map(ev => {
                const b = sportBadge(ev.sport);
                const days = daysUntil(ev.event_date);
                return (
                  <div key={ev.id} className="rounded-[20px] p-6 border transition-all hover:-translate-y-1"
                    style={{ background: 'rgba(28,10,48,0.80)', borderColor: 'rgba(74,61,143,0.30)' }}>
                    <span className="inline-block px-2.5 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white mb-3" style={{ background: b.bg }}>{b.label}</span>
                    <h3 className="font-inter font-bold text-base text-white mb-1">{ev.name}</h3>
                    <p className="font-inter text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="font-inter text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{ev.city}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-[11px] font-inter font-medium mb-4"
                      style={{ background: 'rgba(212,136,10,0.15)', color: '#F0A830' }}>
                      {days === 0 ? 'Today!' : `${days} days away`}
                    </span>
                    <Link to={`/find-a-partner?event=${ev.slug}`} className="block w-full text-center py-2 rounded-pill font-inter font-semibold text-xs"
                      style={{ background: '#D4880A', color: '#fff' }}>
                      Find Partners
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading upcoming events...</p>
          )}
          <Link to="/events" className="inline-flex items-center gap-2 font-inter font-semibold text-sm"
            style={{ color: '#D4880A' }}>
            See All Events <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* GRAPELABS CTA */}
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#2A1A45', borderTop: '1px solid rgba(74,61,143,0.20)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-pill font-inter font-medium text-[11px] uppercase tracking-wider mb-6"
            style={{ color: '#F0A500', background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#D4880A' }} /> POWERED BY&nbsp;
            <span style={{ textTransform: 'none' }}>GrapeLabs</span>&nbsp;
            <span style={{ color: '#D4880A' }}>AI</span>
          </span>
          <h2 className="font-inter font-bold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-4">
            We build the systems that run your business.
          </h2>
          <p className="font-inter text-base mb-8 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
            GrapeLabs AI automates the day-to-day workflows slowing your team down — orders, leads, follow-ups, payments, and more. CREW is what we build for fun.
          </p>
          <a href="https://www.grapelabs.in" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#D4880A', color: '#fff' }}>
            See What We Automate <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </div>
  );
}
