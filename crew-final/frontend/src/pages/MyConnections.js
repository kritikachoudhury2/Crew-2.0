import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { MessageCircle, Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function GradientAvatar({ name, size = 44 }) {
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

const parseSport = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return [s]; } };
const sportBadge = (s) => ({ hyrox: { bg: '#4A3D8F', l: 'HYROX' }, marathon: { bg: '#D4880A', l: 'MARATHON' } }[s] || { bg: '#4A3D8F', l: s?.toUpperCase() });

export default function MyConnections() {
  const { user } = useAuth();
  const [tab, setTab] = useState('matches');
  const [matches, setMatches] = useState([]);
  const [sentReqs, setSentReqs] = useState([]);
  const [recvReqs, setRecvReqs] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyCount, setDailyCount] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // FIXED: matches query — PostgREST requires or() with proper column filter syntax
    // The old query used two separate .or() calls which AND together, not OR.
    // Correct approach: single or() with all four conditions
    const matchesQuery = supabase
      .from('matches')
      .select('*, user1:profiles!user1_id(*), user2:profiles!user2_id(*)')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const [mRes, sRes, rvRes, svRes, countRes] = await Promise.all([
      matchesQuery,
      supabase.from('connect_requests')
        .select('*, to_profile:profiles!to_user_id(*)')
        .eq('from_user_id', user.id)
        .eq('status', 'pending'),
      supabase.from('connect_requests')
        .select('*, from_profile:profiles!from_user_id(*)')
        .eq('to_user_id', user.id)
        .eq('status', 'pending'),
      supabase.from('saved_profiles')
        .select('*, saved:profiles!saved_user_id(*)')
        .eq('user_id', user.id),
      supabase.from('connect_requests')
        .select('*', { count: 'exact', head: true })
        .eq('from_user_id', user.id)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    if (mRes.error) console.error('[MyConnections] matches error:', mRes.error.message);
    if (sRes.error) console.error('[MyConnections] sent error:', sRes.error.message);
    if (rvRes.error) console.error('[MyConnections] received error:', rvRes.error.message);

    setMatches((mRes.data || []).map(r => ({
      ...r,
      partner: r.user1_id === user.id ? r.user2 : r.user1,
    })));
    setSentReqs(sRes.data || []);
    setRecvReqs(rvRes.data || []);
    setSaved(svRes.data || []);
    setDailyCount(countRes.count || 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const connectSub = supabase
      .channel('connect_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connect_requests' }, fetchAll)
      .subscribe();
    const matchSub = supabase
      .channel('matches_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(connectSub);
      supabase.removeChannel(matchSub);
    };
  }, [user, fetchAll]);

  const handleAccept = async (req) => {
    // Update request status
    const { error: updateErr } = await supabase
      .from('connect_requests')
      .update({ status: 'accepted' })
      .eq('id', req.id);
    if (updateErr) { toast.error('Could not accept request.'); return; }

    // Create match row — check it doesn't already exist first
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .or(`and(user1_id.eq.${req.from_user_id},user2_id.eq.${req.to_user_id}),and(user1_id.eq.${req.to_user_id},user2_id.eq.${req.from_user_id})`)
      .maybeSingle();

    if (!existing) {
      const { error: matchErr } = await supabase
        .from('matches')
        .insert({ user1_id: req.from_user_id, user2_id: req.to_user_id });
      if (matchErr) { toast.error('Could not create match.'); return; }
    }

    toast.success('Connection accepted!');
    fetchAll();
  };

  const handleDecline = async (req) => {
    await supabase.from('connect_requests').update({ status: 'declined' }).eq('id', req.id);
    toast.success('Request declined.');
    fetchAll();
  };

  const handleWithdraw = async (req) => {
    await supabase.from('connect_requests').delete().eq('id', req.id);
    toast.success('Request withdrawn.');
    fetchAll();
  };

  const handleUnsave = async (savedUserId) => {
    await supabase.from('saved_profiles').delete()
      .eq('user_id', user.id).eq('saved_user_id', savedUserId);
    toast.success('Removed from saved.');
    fetchAll();
  };

  const tabs = [
    { id: 'matches', label: 'Matches', count: matches.length },
    { id: 'received', label: 'Received', count: recvReqs.length },
    { id: 'sent', label: 'Sent', count: sentReqs.length },
    { id: 'saved', label: 'Saved', count: saved.length },
  ];

  const dailyRemaining = Math.max(0, 10 - dailyCount);

  const ProfileCard = ({ p, actions }) => (
    <div className="rounded-[16px] p-4 border flex items-center gap-3 transition-all hover:-translate-y-0.5"
      style={{ background: 'rgba(42,26,69,0.60)', borderColor: 'rgba(74,61,143,0.30)' }}>
      {p?.photo_url
        ? <img src={p.photo_url} alt={p.name} className="w-11 h-11 rounded-full object-cover" />
        : <GradientAvatar name={p?.name} />}
      <div className="flex-1 min-w-0">
        <Link to={`/athlete/${p?.id}`}
          className="font-inter font-semibold text-sm text-white hover:text-amber-brand truncate block">
          {p?.name || 'Unknown'}
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5">
          {parseSport(p?.sport).filter(s => s !== 'ironman').map(s => {
            const b = sportBadge(s);
            return (
              <span key={s} className="px-1.5 py-0.5 rounded-pill text-[9px] font-inter font-bold text-white"
                style={{ background: b.bg }}>{b.l}</span>
            );
          })}
          <span className="font-inter text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{p?.city}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </div>
  );

  return (
    <div data-testid="my-connections-page">
      <section className="py-14 md:py-24 px-6 md:px-12 min-h-screen" style={{ background: '#1C0A30' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="font-inter font-[800] text-4xl text-white mb-2" style={{ letterSpacing: '-2px' }}>
            My Connections
          </h1>
          <div className="flex items-center gap-3 mb-8">
            <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {dailyCount} of 10 daily requests used
            </p>
            {dailyRemaining <= 3 && dailyRemaining > 0 && (
              <span className="px-2 py-0.5 rounded-pill font-inter text-[10px] font-medium"
                style={{ background: 'rgba(212,136,10,0.15)', color: '#F0A830' }}>
                {dailyRemaining} requests remaining today
              </span>
            )}
            {dailyRemaining === 0 && (
              <span className="px-2 py-0.5 rounded-pill font-inter text-[10px] font-medium"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                Daily limit reached. Resets in 24 hours.
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-pill font-inter font-medium text-sm whitespace-nowrap transition-all"
                style={{
                  background: tab === t.id ? '#D4880A' : 'transparent',
                  color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: tab === t.id ? '2px solid #D4880A' : '2px solid rgba(74,61,143,0.30)',
                }}
                data-testid={`tab-${t.id}`}>
                {t.label} {t.count > 0 && <span className="ml-1.5 text-[10px]">({t.count})</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-[16px] animate-pulse"
                  style={{ background: 'rgba(42,26,69,0.40)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tab === 'matches' && (
                matches.length > 0 ? matches.map(m => (
                  <ProfileCard key={m.id} p={m.partner} actions={
                    <a href={`https://wa.me/${(m.partner?.phone || '').replace(/\D/g, '')}?text=Hey!+We+matched+on+CREW+%E2%80%94+want+to+train%3F`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 rounded-pill font-inter font-semibold text-xs flex items-center gap-1.5"
                      style={{ background: '#25D366', color: '#fff' }}
                      data-testid={`whatsapp-${m.partner?.id}`}>
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  } />
                )) : (
                  <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    No matches yet. Start connecting!
                  </p>
                )
              )}

              {tab === 'received' && (
                recvReqs.length > 0 ? recvReqs.map(r => (
                  <ProfileCard key={r.id} p={r.from_profile} actions={
                    <>
                      <button onClick={() => handleAccept(r)}
                        className="px-3 py-1.5 rounded-pill font-inter font-semibold text-xs"
                        style={{ background: '#D4880A', color: '#fff' }}
                        data-testid={`accept-${r.id}`}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleDecline(r)}
                        className="px-3 py-1.5 rounded-pill font-inter text-xs"
                        style={{ border: '2px solid rgba(74,61,143,0.30)', color: 'rgba(255,255,255,0.5)' }}
                        data-testid={`decline-${r.id}`}>
                        <X size={14} />
                      </button>
                    </>
                  } />
                )) : (
                  <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    No pending requests.
                  </p>
                )
              )}

              {tab === 'sent' && (
                sentReqs.length > 0 ? sentReqs.map(r => (
                  <ProfileCard key={r.id} p={r.to_profile} actions={
                    <button onClick={() => handleWithdraw(r)}
                      className="font-inter text-xs hover:text-amber-brand flex items-center gap-1"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                      data-testid={`withdraw-${r.id}`}>
                      <Trash2 size={12} /> Withdraw
                    </button>
                  } />
                )) : (
                  <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    No sent requests.
                  </p>
                )
              )}

              {tab === 'saved' && (
                saved.length > 0 ? saved.map(s => (
                  <ProfileCard key={s.id} p={s.saved} actions={
                    <div className="flex gap-2">
                      <Link to={`/athlete/${s.saved?.id}`}
                        className="px-3 py-1.5 rounded-pill font-inter font-semibold text-xs"
                        style={{ background: '#D4880A', color: '#fff' }}>
                        View
                      </Link>
                      <button onClick={() => handleUnsave(s.saved?.id)}
                        className="px-3 py-1.5 rounded-pill font-inter text-xs"
                        style={{ border: '2px solid rgba(74,61,143,0.30)', color: 'rgba(255,255,255,0.5)' }}>
                        <X size={12} />
                      </button>
                    </div>
                  } />
                )) : (
                  <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    No saved profiles.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
