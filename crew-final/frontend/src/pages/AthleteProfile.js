import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { calcMatchScore, whyMatched as getWhyMatched } from '../lib/matching';
import { SEED_PROFILES } from '../lib/seedProfiles';
import { ArrowRight, Heart, MoreHorizontal, Eye, CheckCircle, MessageCircle, Flag, Ban, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

function GradientAvatar({ name, size = 80 }) {
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#4A3D8F', '#D4880A', '#6B5FA0', '#0F6E56', '#8B5CF6'];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className="rounded-full flex items-center justify-center font-inter font-bold text-white text-2xl"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${colors[idx]}, ${colors[(idx + 1) % colors.length]})` }}>
      {initials}
    </div>
  );
}

const parseSport = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return [s]; } };
const parseArr = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return []; } };
const sportBadge = (s) => {
  const map = { hyrox: { bg: '#4A3D8F', label: 'HYROX' }, marathon: { bg: '#D4880A', label: 'MARATHON' } };
  return map[s] || { bg: '#4A3D8F', label: s?.toUpperCase() };
};

export default function AthleteProfile() {
  const { id } = useParams();
  const { user, profile: myProfile } = useAuth();
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchAthlete = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (data) setAthlete(data);
      else setAthlete(SEED_PROFILES.find(p => p.id === id) || null);
      setLoading(false);

      if (data && user) {
        try { await supabase.rpc('increment_profile_views', { profile_id: id }); } catch {}
      }

      if (user) {
        // Check saved
        const { data: savedRow } = await supabase.from('saved_profiles')
          .select('id').eq('user_id', user.id).eq('saved_user_id', id).single();
        if (savedRow) setIsSaved(true);

        // Check connection state
        const { data: sent } = await supabase.from('connect_requests').select('*')
          .eq('from_user_id', user.id).eq('to_user_id', id).eq('status', 'pending').limit(1);
        if (sent?.length) { setConnectionState('sent'); return; }

        const { data: recv } = await supabase.from('connect_requests').select('*')
          .eq('from_user_id', id).eq('to_user_id', user.id).eq('status', 'pending').limit(1);
        if (recv?.length) { setConnectionState('received'); return; }

        const { data: match } = await supabase.from('matches').select('*')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .or(`user1_id.eq.${id},user2_id.eq.${id}`).limit(1);
        if (match?.length) setConnectionState('matched');
      }
    };
    fetchAthlete();
  }, [id, user]);

  const handleConnect = async () => {
    if (!user) return;

    // Check daily limit with clear feedback
    const { count } = await supabase.from('connect_requests')
      .select('*', { count: 'exact', head: true })
      .eq('from_user_id', user.id)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString());

    if (count >= 10) {
      toast.error("You've reached your daily limit of 10 connection requests. Come back in 24 hours.", { duration: 5000 });
      return;
    }

    const remaining = 10 - count;
    const { error } = await supabase.from('connect_requests').insert({
      from_user_id: user.id, to_user_id: id, status: 'pending'
    });
    if (error) {
      toast.error('Could not send request. Please try again.');
      return;
    }
    setConnectionState('sent');
    toast.success(`Connection request sent! ${remaining - 1} requests remaining today.`);
  };

  const handleToggleSave = async () => {
    if (!user) { toast.error('Sign in to save profiles'); return; }
    if (isSaved) {
      await supabase.from('saved_profiles').delete().eq('user_id', user.id).eq('saved_user_id', id);
      setIsSaved(false);
      toast.success('Removed from saved');
    } else {
      const { error } = await supabase.from('saved_profiles').insert({ user_id: user.id, saved_user_id: id });
      if (error) { toast.error('Could not save profile'); return; }
      setIsSaved(true);
      toast.success('Profile saved');
    }
  };

  const handleReport = async (reason) => {
    if (!user) return;
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, reported_id: id, reason });
    if (error) { toast.error('Could not submit report. Please try again.'); return; }
    setReportSent(true);
    setShowMenu(false);
    toast.success('Thanks for reporting. We will review this.');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1C0A30' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #D4880A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!athlete) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1C0A30' }}>
      <p className="font-inter text-white">Profile not found.</p>
    </div>
  );

  const sports = parseSport(athlete.sport).filter(s => s !== 'ironman');
  const matchScore = myProfile ? calcMatchScore(myProfile, athlete) : 0;
  const matchReason = myProfile ? getWhyMatched(myProfile, athlete) : '';

  return (
    <div data-testid="athlete-profile-page" style={{ background: '#1C0A30' }}>
      <div className="h-40 relative" style={{ background: 'linear-gradient(135deg, #4A3D8F, #1C0A30)' }}>
        <div className="absolute -bottom-10 left-6 md:left-12">
          {athlete.photo_url ? (
            <img src={athlete.photo_url} alt={athlete.name} className="w-20 h-20 rounded-full object-cover border-4" style={{ borderColor: '#1C0A30' }} />
          ) : (
            <GradientAvatar name={athlete.name} size={80} />
          )}
        </div>
        <div className="absolute top-4 right-4">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.3)' }} data-testid="profile-menu-btn">
            <MoreHorizontal size={18} className="text-white" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-[12px] overflow-hidden shadow-lg z-10" style={{ background: '#2A1A45', border: '1px solid rgba(74,61,143,0.30)' }}>
              <button onClick={() => handleReport('Fake profile')} className="w-full text-left px-4 py-3 font-inter text-sm hover:bg-white/5 flex items-center gap-2"
                style={{ color: 'rgba(255,255,255,0.7)' }} data-testid="report-btn">
                <Flag size={14} /> Report this profile
              </button>
              <button className="w-full text-left px-4 py-3 font-inter text-sm hover:bg-white/5 flex items-center gap-2"
                style={{ color: 'rgba(255,255,255,0.7)' }} data-testid="block-btn">
                <Ban size={14} /> Block
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="pt-14 pb-24 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-inter font-bold text-2xl text-white">{athlete.name}</h1>
                {athlete.email_verified && <CheckCircle size={16} className="text-green-400" />}
              </div>
              <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {athlete.city}{athlete.area ? ` · ${athlete.area}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {sports.map(s => {
                  const b = sportBadge(s);
                  return <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white" style={{ background: b.bg }}>{b.label}</span>;
                })}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="font-inter text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Eye size={12} /> {athlete.profile_views || 0} views
                </span>
                {athlete.instagram && (
                  <a href={`https://instagram.com/${athlete.instagram}`} target="_blank" rel="noopener noreferrer"
                    className="font-inter text-xs flex items-center gap-1 hover:text-amber-brand" style={{ color: '#6B5FA0' }}>
                    @{athlete.instagram} <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {athlete.bio && (
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{athlete.bio}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Sport', val: sports.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') },
              { label: 'Level', val: athlete.level },
              { label: 'Training Days', val: athlete.training_days },
              { label: 'Partner Goal', val: athlete.partner_goal },
              { label: 'City', val: athlete.city },
            ].filter(s => s.val).map(s => (
              <div key={s.label} className="rounded-[12px] p-3 border" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)' }}>
                <p className="font-inter text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
                <p className="font-inter text-sm font-medium text-white capitalize">{s.val}</p>
              </div>
            ))}
          </div>

          {sports.includes('hyrox') && (
            <div className="rounded-[20px] p-6 border mb-6" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)' }}>
              <h3 className="font-inter font-bold text-sm text-white mb-4">HYROX Details</h3>
              {athlete.hyrox_category && <span className="inline-block px-2 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white mb-3" style={{ background: '#4A3D8F' }}>{athlete.hyrox_category.toUpperCase()}</span>}
              {athlete.hyrox_5k_time && <p className="font-inter text-xs mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>5K time: {athlete.hyrox_5k_time}</p>}
              {parseArr(athlete.hyrox_strong).length > 0 && (
                <div className="mb-2">
                  <p className="font-inter text-[10px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseArr(athlete.hyrox_strong).map(s => <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter text-green-400" style={{ border: '1px solid rgba(34,197,94,0.30)' }}>{s}</span>)}
                  </div>
                </div>
              )}
              {parseArr(athlete.hyrox_weak).length > 0 && (
                <div>
                  <p className="font-inter text-[10px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Working on</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseArr(athlete.hyrox_weak).map(s => <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter" style={{ border: '1px solid rgba(212,136,10,0.30)', color: '#F0A830' }}>{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {sports.includes('marathon') && (
            <div className="rounded-[20px] p-6 border mb-6" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)' }}>
              <h3 className="font-inter font-bold text-sm text-white mb-4">Marathon Details</h3>
              <div className="grid grid-cols-2 gap-3">
                {athlete.marathon_pace && <div><p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Pace</p><p className="font-inter text-sm text-white">{athlete.marathon_pace}/km</p></div>}
                {athlete.marathon_distance && <div><p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Distance</p><p className="font-inter text-sm text-white">{athlete.marathon_distance}</p></div>}
                {athlete.marathon_weekly_km && <div><p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Weekly</p><p className="font-inter text-sm text-white">{athlete.marathon_weekly_km}</p></div>}
                {athlete.marathon_goal && <div><p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Goal</p><p className="font-inter text-sm text-white">{athlete.marathon_goal}</p></div>}
              </div>
            </div>
          )}

          {matchReason && (
            <div className="rounded-[20px] p-6 border mb-8" style={{ background: 'rgba(74,61,143,0.15)', borderColor: 'rgba(74,61,143,0.30)' }}>
              <h3 className="font-inter font-semibold text-sm text-white mb-2">Why you'd match</h3>
              <p className="font-inter text-sm" style={{ color: '#A89CC8' }}>{matchReason}</p>
              <div className="mt-2">
                <span className="font-inter font-bold text-lg" style={{ color: '#F0A500' }}>{matchScore}% match</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {connectionState === 'matched' ? (
              <a href={`https://wa.me/${athlete.phone ? athlete.phone.replace(/\D/g, '') : ''}?text=Hey!+We+matched+on+CREW+%E2%80%94+want+to+train%3F`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center py-3 rounded-pill font-inter font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: '#25D366', color: '#fff' }} data-testid="open-whatsapp">
                <MessageCircle size={16} /> Open WhatsApp
              </a>
            ) : connectionState === 'sent' ? (
              <button disabled className="flex-1 py-3 rounded-pill font-inter font-semibold text-sm opacity-60"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }} data-testid="request-sent">
                Request Sent
              </button>
            ) : (
              <button onClick={handleConnect}
                className="flex-1 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#D4880A', color: '#fff' }} data-testid="send-connect-request">
                Send Connection Request <ArrowRight size={16} className="inline ml-1" />
              </button>
            )}
            <button onClick={handleToggleSave}
              className="px-5 py-3 rounded-pill transition-colors"
              style={{
                border: '2px solid rgba(74,61,143,0.30)',
                color: isSaved ? '#D4880A' : 'rgba(255,255,255,0.5)',
                background: isSaved ? 'rgba(212,136,10,0.10)' : 'transparent',
              }}
              data-testid="save-profile"
              title={isSaved ? 'Remove from saved' : 'Save profile'}>
              <Heart size={16} fill={isSaved ? '#D4880A' : 'none'} />
            </button>
          </div>

          {reportSent && (
            <p className="font-inter text-xs mt-4" style={{ color: '#D4880A' }}>Thanks for reporting. We will review this.</p>
          )}
        </div>
      </section>
    </div>
  );
}
