import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { MessageCircle, Check, X, Trash2, ShieldCheck } from 'lucide-react';
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

const WHATSAPP_MSG = encodeURIComponent("Hey! We matched on CREW. Looks like we’re training for similar goals. Want to connect?");

function WhatsAppButton({ phone, name }) {
  const clean = (phone || '').replace(/\D/g, '');
  if (!clean) {
    return (
      <button
        onClick={() => toast.error(`${name || 'Your match'} hasn't added their phone number yet.`)}
        className="px-3 py-2 rounded-pill font-inter font-semibold text-xs flex items-center gap-1.5 shrink-0"
        style={{ background: '#25D366', color: '#fff' }}>
        <MessageCircle size={13} /> WhatsApp
      </button>
    );
  }
  return (
    <a href={`https://wa.me/${clean}?text=${WHATSAPP_MSG}`}
      target="_blank" rel="noopener noreferrer"
      className="px-3 py-2 rounded-pill font-inter font-semibold text-xs flex items-center gap-1.5 shrink-0"
      style={{ background: '#25D366', color: '#fff' }}>
      <MessageCircle size={13} /> WhatsApp
    </a>
  );
}

export default function MyConnections() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
const [tab, setTab] = useState(searchParams.get('tab') || 'matches');
  const [matches, setMatches] = useState([]);
  const [sentReqs, setSentReqs] = useState([]);
  const [recvReqs, setRecvReqs] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyCount, setDailyCount] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: matchRows, error: matchErr } = await supabase
      .from('matches')
      .select('id, created_at, user1_id, user2_id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (matchErr) console.error('[MyConnections] matches error:', matchErr.message);

    const matchesWithPartners = await Promise.all(
      (matchRows || []).map(async (m) => {
        const partnerId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        const { data: partner } = await supabase
          .from('profiles')
          .select('id, name, city, sport, photo_url, phone')
          .eq('id', partnerId)
          .single();
        return { ...m, partner };
      })
    );

    const [sRes, rvRes, svRes, countRes] = await Promise.all([
      supabase.from('connect_requests')
        .select('*, to_profile:profiles!to_user_id(id, name, city, sport, photo_url)')
        .eq('from_user_id', user.id).eq('status', 'pending'),
      supabase.from('connect_requests')
        .select('*, from_profile:profiles!from_user_id(id, name, city, sport, photo_url)')
        .eq('to_user_id', user.id).eq('status', 'pending'),
      supabase.from('saved_profiles')
        .select('*, saved:profiles!saved_user_id(id, name, city, sport, photo_url)')
        .eq('user_id', user.id),
      supabase.from('connect_requests')
        .select('*', { count: 'exact', head: true })
        .eq('from_user_id', user.id)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    setMatches(matchesWithPartners.filter(m => m.partner));
    setSentReqs(sRes.data || []);
    setRecvReqs(rvRes.data || []);
    setSaved(svRes.data || []);
    setDailyCount(countRes.count || 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const connectSub = supabase.channel('cr_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connect_requests' }, fetchAll)
      .subscribe();
    const matchSub = supabase.channel('m_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(connectSub); supabase.removeChannel(matchSub); };
  }, [user, fetchAll]);

  const handleAccept = async (req) => {
    const { error: updateErr } = await supabase.from('connect_requests')
      .update({ status: 'accepted' }).eq('id', req.id);
    if (updateErr) { toast.error('Could not accept request.'); return; }
    const { data: existing } = await supabase.from('matches').select('id')
      .or(`and(user1_id.eq.${req.from_user_id},user2_id.eq.${req.to_user_id}),and(user1_id.eq.${req.to_user_id},user2_id.eq.${req.from_user_id})`)
      .maybeSingle();
    if (!existing) {
      const { error: matchErr } = await supabase.from('matches')
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

  // FIXED: card layout — avatar + info stacked vertically on mobile,
  // action button always on its own row to prevent overlap
  const ProfileCard = ({ p, actions }) => (
    <div className="rounded-[16px] p-4 border"
      style={{ background: 'rgba(42,26,69,0.60)', borderColor: 'rgba(74,61,143,0.30)' }}>
      <div className="flex items-center gap-3">
        {p?.photo_url
          ? <img src={p.photo_url} alt={p.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
          : <GradientAvatar name={p?.name} />}
        <div className="flex-1 min-w-0">
          <Link to={`/athlete/${p?.id}`} className="font-inter font-semibold text-sm text-white block truncate">
            {p?.name || 'Unknown'}
          </Link>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {parseSport(p?.sport).filter(s => s !== 'ironman').map(s => {
              const b = sportBadge(s);
              return <span key={s} className="px-1.5 py-0.5 rounded-pill text-[9px] font-inter font-bold text-white shrink-0" style={{ background: b.bg }}>{b.l}</span>;
            })}
            {/* City on its own line to avoid overlap with action buttons */}
            <span className="font-inter text-[10px] w-full mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{p?.city}</span>
          </div>
        </div>
      </div>
      {/* Actions always on their own row — no overlap possible */}
      <div className="flex items-center gap-2 mt-3 justify-end">{actions}</div>
    </div>
  );

  const dailyRemaining = Math.max(0, 10 - dailyCount);

  return (
    <div data-testid="my-connections-page">
      <section className="py-14 md:py-24 px-6 md:px-12 min-h-screen" style={{ background: '#1C0A30' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="font-inter font-[800] text-4xl text-white mb-2" style={{ letterSpacing: '-2px' }}>My Connections</h1>

          <div className="flex items-center gap-3 mb-4">
            <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{dailyCount} of 10 daily requests used</p>
            {dailyRemaining === 0 && (
              <span className="px-2 py-0.5 rounded-pill font-inter text-[10px] font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                Daily limit reached. Resets in 24 hours.
              </span>
            )}
          </div>

          {/* Privacy banner */}
          <div className="rounded-[12px] p-3 mb-6 flex items-start gap-2"
            style={{ background: 'rgba(74,61,143,0.20)', border: '1px solid rgba(74,61,143,0.30)' }}>
            <ShieldCheck size={15} className="shrink-0 mt-0.5" style={{ color: '#A89CC8' }} />
            <p className="font-inter text-[11px]" style={{ color: '#A89CC8' }}>
              Your phone number is never shared publicly. WhatsApp opens only after both athletes accept each other's request — until then, your contact details remain completely private.
            </p>
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-pill font-inter font-medium text-sm whitespace-nowrap transition-all"
                style={{
                  background: tab === t.id ? '#D4880A' : 'transparent',
                  color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: tab === t.id ? '2px solid #D4880A' : '2px solid rgba(74,61,143,0.30)',
                }}>
                {t.label} {t.count > 0 && <span className="ml-1.5 text-[10px]">({t.count})</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-[16px] animate-pulse" style={{ background: 'rgba(42,26,69,0.40)' }} />)}</div>
          ) : (
            <div className="space-y-3">
              {tab === 'matches' && (matches.length > 0 ? matches.map(m => (
                <ProfileCard key={m.id} p={m.partner} actions={
                  <WhatsAppButton phone={m.partner?.phone} name={m.partner?.name} />
                } />
              )) : <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No matches yet. Start connecting!</p>)}

              {tab === 'received' && (recvReqs.length > 0 ? recvReqs.map(r => (
                <ProfileCard key={r.id} p={r.from_profile} actions={<>
                  <button onClick={() => handleAccept(r)}
                    className="px-4 py-2 rounded-pill font-inter font-semibold text-xs flex items-center gap-1"
                    style={{ background: '#D4880A', color: '#fff' }}>
                    <Check size={13} /> Accept
                  </button>
                  <button onClick={() => handleDecline(r)}
                    className="px-3 py-2 rounded-pill font-inter text-xs"
                    style={{ border: '2px solid rgba(74,61,143,0.30)', color: 'rgba(255,255,255,0.5)' }}>
                    <X size={13} />
                  </button>
                </>} />
              )) : <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No pending requests.</p>)}

              {tab === 'sent' && (sentReqs.length > 0 ? sentReqs.map(r => (
                <ProfileCard key={r.id} p={r.to_profile} actions={
                  <button onClick={() => handleWithdraw(r)}
                    className="font-inter text-xs flex items-center gap-1"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <Trash2 size={12} /> Withdraw
                  </button>
                } />
              )) : <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No sent requests.</p>)}

              {tab === 'saved' && (saved.length > 0 ? saved.map(s => (
                <ProfileCard key={s.id} p={s.saved} actions={
                  <div className="flex gap-2">
                    <Link to={`/athlete/${s.saved?.id}`}
                      className="px-3 py-2 rounded-pill font-inter font-semibold text-xs"
                      style={{ background: '#D4880A', color: '#fff' }}>View</Link>
                    <button onClick={() => handleUnsave(s.saved?.id)}
                      className="px-3 py-2 rounded-pill font-inter text-xs"
                      style={{ border: '2px solid rgba(74,61,143,0.30)', color: 'rgba(255,255,255,0.5)' }}>
                      <X size={12} />
                    </button>
                  </div>
                } />
              )) : <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No saved profiles.</p>)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
