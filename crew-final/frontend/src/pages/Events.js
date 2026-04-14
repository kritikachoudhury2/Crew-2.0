import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowRight, Share2 } from 'lucide-react';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', today)
        .lte('event_date', '2026-12-31')
        .eq('is_active', true)
        .order('event_date', { ascending: true });
      if (error) console.error('Events fetch error:', error.message);
      setEvents(data || []);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const filtered = filter === 'all' ? events : events.filter(e => e.sport === filter);
  const daysUntil = (d) => Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000));

  const sportBadge = (s) => {
    const map = { hyrox: { bg: '#4A3D8F', label: 'HYROX' }, marathon: { bg: '#D4880A', label: 'MARATHON' } };
    return map[s] || { bg: '#4A3D8F', label: s?.toUpperCase() };
  };

  const shareEvent = (slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/events/${slug}`);
  };

  return (
    <div data-testid="events-page">
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="font-inter font-[800] text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.05] mb-4" style={{ letterSpacing: '-2px' }}>
            Races worth training for.
          </h1>
          <p className="font-inter text-base md:text-lg mb-10" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Find athletes targeting the same race. Train together. Show up ready.
          </p>

          <div className="flex flex-wrap gap-2 mb-10">
            {['all', 'hyrox', 'marathon'].map(f => (
              <button key={f} onClick={() => setFilter(f)} data-testid={`event-filter-${f}`}
                className="px-4 py-2 rounded-pill font-inter font-medium text-sm transition-all"
                style={{
                  background: filter === f ? '#D4880A' : 'transparent',
                  color: filter === f ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: filter === f ? '2px solid #D4880A' : '2px solid rgba(74,61,143,0.30)',
                }}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-[20px] h-48 animate-pulse" style={{ background: 'rgba(42,26,69,0.40)' }} />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filtered.map(ev => {
                const b = sportBadge(ev.sport);
                const days = daysUntil(ev.event_date);
                return (
                  <div key={ev.id} className="rounded-[20px] p-6 border transition-all hover:-translate-y-1"
                    style={{ background: 'rgba(28,10,48,0.80)', borderColor: 'rgba(74,61,143,0.30)' }}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white" style={{ background: b.bg }}>{b.label}</span>
                      <button onClick={() => shareEvent(ev.slug)} className="p-1.5 rounded-full transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <Share2 size={14} />
                      </button>
                    </div>
                    <h3 className="font-inter font-bold text-lg text-white mb-1">{ev.name}</h3>
                    <p className="font-inter text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {ev.end_date && ` - ${new Date(ev.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </p>
                    <p className="font-inter text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{ev.city}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-[11px] font-inter font-medium mb-4"
                      style={{ background: days <= 30 ? 'rgba(212,136,10,0.20)' : 'rgba(212,136,10,0.10)', color: '#F0A830' }}>
                      {days === 0 ? 'Today!' : `${days} days away`}
                    </span>
                    <div className="flex gap-2">
                      <Link to={`/find-a-partner?event=${ev.slug}`}
                        className="flex-1 text-center py-2 rounded-pill font-inter font-semibold text-xs"
                        style={{ background: '#D4880A', color: '#fff' }} data-testid={`event-cta-${ev.slug}`}>
                        Find Partners
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="font-inter text-lg font-semibold text-white mb-2">No upcoming events found.</p>
              <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {filter !== 'all' ? 'Try selecting a different sport filter.' : 'Check back soon for upcoming events.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
