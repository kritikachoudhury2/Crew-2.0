import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { calcMatchScore, whyMatched as getWhyMatched } from '../lib/matching';
import { SEED_PROFILES } from '../lib/seedProfiles';
import { ArrowRight, Heart, MoreHorizontal, Eye, CheckCircle, MessageCircle, Flag, Ban, ExternalLink, MapPin, Users } from 'lucide-react';
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

function StatCard({ label, val }) {
  if (!val) return null;
  return (
    <div className="rounded-[12px] p-3 border" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)', flex: '1 1 140px' }}>
      <p className="font-inter text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="font-inter text-sm font-medium text-white capitalize">{val}</p>
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
        const { data: savedRow } = await supabase.from('saved_profiles')
          .select('id').eq('user_id', user.id).eq('saved_user_id', id).maybeSingle();
        if (savedRow) setIsSaved(true);

        const { data: sent } = await supabase.from('connect_requests').select('id')
          .eq('from_user_id', user.id).eq('to_user_id', id).eq('status', 'pending').limit(1);
        if (sent?.length) { setConnectionState('sent'); return; }

        const { data: recv } = await supabase.from('connect_requests').select('id')
          .eq('from_user_id', id).eq('to_user_id', user.id).eq('status', 'pending').limit(1);
        if (recv?.length) { setConnectionState('received'); return; }

        const { data: match } = await supabase.from('matches').select('id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .or(`user1_id.eq.${id},user2_id.eq.${id}`).limit(1);
        if (match?.length) setConnectionState('matched');
      }
    };
    fetchAthlete();
  }, [id, user]);

  const handleConnect = async () => {
    if (!user) return;
    const { count } = await supabase.from('connect_requests')
      .select('*', { count: 'exact', head: true })
      .eq('from_user_id', user.id)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString());
    if (count >= 10) {
      toast.error("You've reached your daily limit of 10 connection requests. Resets in 24 hours.", { duration: 5000 });
      return;
    }
    const { error } = await supabase.from('connect_requests').insert({
      from_user_id: user.id, to_user_id: id, status: 'pending'
    });
    if (error) { toast.error('Could not send request. Please try again.'); return; }
    setConnectionState('sent');
    toast.success(`Connection request sent! ${Math.max(0, 9 - count)} requests remaining today.`);
  };

  const handleToggleSave = async () => {
    if (!user) { toast.error('Sign in to save profiles'); return; }
    if (isSaved) {
      await supabase.from('saved_profiles').delete().eq('user_id', user.id).eq('saved_user_id', id);
      setIsSaved(false); toast.success('Removed from saved');
    } else {
      const { error } = await supabase.from('saved_profiles').insert({ user_id: user.id, saved_user_id: id });
      if (error) { toast.error('Could not save profile'); return; }
      setIsSaved(true); toast.success('Profile saved');
    }
  };

  const handleReport = async (reason) => {
    if (!user) return;
    await supabase.from('reports').insert({ reporter_id: user.id, reported_id: id, reason });
    setReportSent(true); setShowMenu(false);
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

  // Helper: get sport-specific value, falling back to shared field
  const hyroxVal = (sportField, sharedField) => athlete[sportField] || athlete[sharedField] || null;
  const marathonVal = (sportField, sharedField) => athlete[sportField] || (sports.includes('hyrox') ? null : athlete[sharedField]) || null;

  // Check if grid sections have any data to show (avoids rendering empty containers)
  const hasHyroxStats = !!(athlete.hyrox_category || athlete.hyrox_5k_time ||
    hyroxVal('hyrox_target_race', 'target_race') || hyroxVal('hyrox_race_goal', 'race_goal') ||
    hyroxVal('hyrox_training_days', 'training_days') || hyroxVal('hyrox_level', 'level'));
  const hasHyroxPartner = !!(hyroxVal('hyrox_partner_goal', 'partner_goal') ||
    hyroxVal('hyrox_partner_level_pref', 'partner_level_pref') ||
    hyroxVal('hyrox_partner_gender_pref', 'partner_gender_pref'));
  const hasMarathonStats = !!(athlete.marathon_distance || athlete.marathon_pace ||
    athlete.marathon_weekly_km || marathonVal('marathon_target_race', 'target_race') ||
    athlete.marathon_goal || marathonVal('marathon_training_days', 'training_days') ||
    marathonVal('marathon_level', 'level'));
  const hasMarathonPartner = !!(marathonVal('marathon_partner_goal', 'partner_goal') ||
    marathonVal('marathon_partner_level_pref', 'partner_level_pref') ||
    marathonVal('marathon_partner_gender_pref', 'partner_gender_pref'));

  return (
    <div data-testid="athlete-profile-page" style={{ background: '#1C0A30' }}>
      <div className="h-40 relative" style={{ background: 'linear-gradient(135deg, #4A3D8F, #1C0A30)' }}>
        <div className="absolute -bottom-10 left-6 md:left-12">
          {athlete.photo_url
            ? <img src={athlete.photo_url} alt={athlete.name} className="w-20 h-20 rounded-full object-cover border-4" style={{ borderColor: '#1C0A30' }} />
            : <GradientAvatar name={athlete.name} size={80} />}
        </div>
        <div className="absolute top-4 right-4">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <MoreHorizontal size={18} className="text-white" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-[12px] overflow-hidden shadow-lg z-10" style={{ background: '#2A1A45', border: '1px solid rgba(74,61,143,0.30)' }}>
              <button onClick={() => handleReport('Fake profile')} className="w-full text-left px-4 py-3 font-inter text-sm hover:bg-white/5 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Flag size={14} /> Report this profile
              </button>
              <button className="w-full text-left px-4 py-3 font-inter text-sm hover:bg-white/5 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Ban size={14} /> Block
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="pt-14 pb-24 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-inter font-bold text-2xl text-white">{athlete.name}</h1>
              {athlete.email_verified && <CheckCircle size={16} className="text-green-400" />}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {athlete.gender && <span className="font-inter text-sm capitalize">{athlete.gender}</span>}
              {athlete.age && <span className="font-inter text-sm">{athlete.age} yrs</span>}
              {(athlete.city || athlete.area) && (
                <span className="font-inter text-sm flex items-center gap-1">
                  <MapPin size={13} />
                  {athlete.city}{athlete.area ? ` · ${athlete.area}` : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {sports.map(s => {
                const b = sportBadge(s);
                return <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white" style={{ background: b.bg }}>{b.label}</span>;
              })}
              {athlete.level && (
                <span className="px-2 py-0.5 rounded-pill text-[11px] font-inter font-medium capitalize" style={{ border: '1px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.7)' }}>
                  {athlete.level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="font-inter text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <Eye size={12} /> {athlete.profile_views || 0} views
              </span>
              {athlete.instagram && (
                <a href={`https://instagram.com/${athlete.instagram}`} target="_blank" rel="noopener noreferrer"
                  className="font-inter text-xs flex items-center gap-1" style={{ color: '#6B5FA0' }}>
                  @{athlete.instagram} <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          {athlete.bio && (
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{athlete.bio}</p>
          )}

          {/* HYROX section */}
          {sports.includes('hyrox') && (
            <div className="rounded-[20px] p-6 border mb-6" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)' }}>
              <h3 className="font-inter font-bold text-sm text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#4A3D8F', display: 'inline-block' }} /> HYROX Details
              </h3>
              {hasHyroxStats && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {athlete.hyrox_category && (
                    <div className="rounded-[12px] p-3 border" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)', flex: '1 1 140px' }}>
                      <p className="font-inter text-[10px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Category</p>
                      <span className="px-2 py-0.5 rounded-pill text-[10px] font-inter font-bold text-white" style={{ background: '#4A3D8F' }}>{athlete.hyrox_category.toUpperCase()}</span>
                    </div>
                  )}
                  {athlete.hyrox_5k_time && (
                    <div className="rounded-[12px] p-3 border" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)', flex: '1 1 140px' }}>
                      <p className="font-inter text-[10px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>5K Time</p>
                      <p className="font-inter text-sm text-white">{athlete.hyrox_5k_time}</p>
                    </div>
                  )}
                  <StatCard label="Target Race" val={hyroxVal('hyrox_target_race', 'target_race')} />
                  <StatCard label="Race Goal" val={hyroxVal('hyrox_race_goal', 'race_goal')} />
                  <StatCard label="Training Days" val={hyroxVal('hyrox_training_days', 'training_days')} />
                  <StatCard label="Level" val={hyroxVal('hyrox_level', 'level')} />
                </div>
              )}
              {hasHyroxPartner && (
                <div className="flex flex-wrap gap-3 mb-4">
                  <StatCard label="Partner Looking For" val={hyroxVal('hyrox_partner_goal', 'partner_goal')} />
                  <StatCard label="Preferred Partner Level" val={hyroxVal('hyrox_partner_level_pref', 'partner_level_pref')} />
                  <StatCard label="Gender Preference" val={hyroxVal('hyrox_partner_gender_pref', 'partner_gender_pref')} />
                </div>
              )}
              {parseArr(athlete.hyrox_strong).length > 0 && (
                <div className="mb-3">
                  <p className="font-inter text-[10px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseArr(athlete.hyrox_strong).map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter text-green-400" style={{ border: '1px solid rgba(34,197,94,0.30)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {parseArr(athlete.hyrox_weak).length > 0 && (
                <div>
                  <p className="font-inter text-[10px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Working on</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseArr(athlete.hyrox_weak).map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-pill text-[10px] font-inter" style={{ border: '1px solid rgba(212,136,10,0.30)', color: '#F0A830' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Marathon section */}
          {sports.includes('marathon') && (
            <div className="rounded-[20px] p-6 border mb-6" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)' }}>
              <h3 className="font-inter font-bold text-sm text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#D4880A', display: 'inline-block' }} /> Marathon Details
              </h3>
              {hasMarathonStats && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {athlete.marathon_distance && <StatCard label="Distance" val={athlete.marathon_distance} />}
                  {athlete.marathon_pace && <StatCard label="Easy Pace" val={`${athlete.marathon_pace}/km`} />}
                  {athlete.marathon_weekly_km && <StatCard label="Weekly KM" val={athlete.marathon_weekly_km} />}
                  <StatCard label="Target Race" val={marathonVal('marathon_target_race', 'target_race')} />
                  <StatCard label="Race Goal" val={athlete.marathon_goal || marathonVal('marathon_race_goal', 'race_goal')} />
                  <StatCard label="Training Days" val={marathonVal('marathon_training_days', 'training_days')} />
                  <StatCard label="Level" val={marathonVal('marathon_level', 'level')} />
                </div>
              )}
              {hasMarathonPartner && (
                <div className="flex flex-wrap gap-3">
                  <StatCard label="Partner Looking For" val={marathonVal('marathon_partner_goal', 'partner_goal')} />
                  <StatCard label="Preferred Partner Level" val={marathonVal('marathon_partner_level_pref', 'partner_level_pref')} />
                  <StatCard label="Gender Preference" val={marathonVal('marathon_partner_gender_pref', 'partner_gender_pref')} />
                </div>
              )}
            </div>
          )}

          {/* Why match */}
          {matchReason && myProfile?.id !== athlete.id && (
            <div className="rounded-[20px] p-6 border mb-8" style={{ background: 'rgba(74,61,143,0.15)', borderColor: 'rgba(74,61,143,0.30)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} style={{ color: '#A89CC8' }} />
                <h3 className="font-inter font-semibold text-sm text-white">Why you'd match</h3>
              </div>
              <p className="font-inter text-sm mb-2" style={{ color: '#A89CC8' }}>{matchReason}</p>
              <span className="font-inter font-bold text-lg" style={{ color: '#F0A500' }}>{matchScore}% match</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {connectionState === 'matched' ? (
              <a href={`https://wa.me/${(athlete.phone || '').replace(/\D/g, '')}?text=Hey!+We+matched+on+CREW+%E2%80%94+want+to+train%3F`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center py-3 rounded-pill font-inter font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: '#25D366', color: '#fff' }}>
                <MessageCircle size={16} /> Open WhatsApp
              </a>
            ) : connectionState === 'sent' ? (
              <button disabled className="flex-1 py-3 rounded-pill font-inter font-semibold text-sm opacity-60"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                Request Sent
              </button>
            ) : (
              <button onClick={handleConnect}
                className="flex-1 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#D4880A', color: '#fff' }}>
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
              title={isSaved ? 'Remove from saved' : 'Save profile'}>
              <Heart size={16} fill={isSaved ? '#D4880A' : 'none'} />
            </button>
          </div>

          {reportSent && (
            <p className="font-inter text-xs mt-4" style={{ color: '#D4880A' }}>Report submitted. We will review this profile.</p>
          )}
        </div>
      </section>
    </div>
  );
}
