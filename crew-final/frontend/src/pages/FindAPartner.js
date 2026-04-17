import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { calcMatchScore, whyMatched, getMatchLabel, getMatchCaveat, parseSports } from '../lib/matching';
import { SEED_PROFILES } from '../lib/seedProfiles';
import { Filter, X, Heart, Eye, CheckCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

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

const sportBadge = (s) => {
  const map = { hyrox: { bg: '#4A3D8F', label: 'HYROX' }, marathon: { bg: '#D4880A', label: 'MARATHON' } };
  return map[s] || { bg: '#4A3D8F', label: s?.toUpperCase() };
};
const parseArr = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return []; } };

// Append "mins" to a time value if it exists
const withMins = (val) => val ? `${val} mins` : null;

const FILTER_CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Goa', 'Chennai', 'Kolkata', 'Other'];
const FILTER_LEVELS = [
  { val: 'beginner', label: 'Beginner' },
  { val: 'intermediate', label: 'Intermediate' },
  { val: 'advanced', label: 'Advanced' },
  { val: 'pro', label: 'Pro' },
];

export default function FindAPartner() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allProfiles, setAllProfiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('best');
  const [savedIds, setSavedIds] = useState(new Set());
  const [fetchKey, setFetchKey] = useState(0);
  const [connectionStates, setConnectionStates] = useState({});
  const [matchedPhones, setMatchedPhones] = useState({});
  const [filters, setFilters] = useState({
    sport: searchParams.get('sport') ? [searchParams.get('sport')] : [],
    city: [], level: [], gender: [],
  });

  const connectingRef = useRef(new Set());
  const [connectingIds, setConnectingIds] = useState(new Set());

  useEffect(() => {
    const fetchProfiles = async () => {
      let data = null, lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));
        const result = await supabase
          .from('profiles')
          .select('id,name,age,gender,city,area,lat,lng,sport,level,bio,photo_url,phone,target_race,hyrox_category,hyrox_strong,hyrox_weak,hyrox_5k_time,hyrox_10k_time,marathon_pace,marathon_distance,marathon_weekly_km,marathon_goal,marathon_5k_time,marathon_10k_time,race_goal,training_days,partner_goal,partner_level_pref,partner_gender_pref,email_verified,last_active,profile_views,flagged')
          .neq('flagged', true)
          .neq('id', user?.id || '')
          .filter('name', 'not.is', null)
          .filter('name', 'neq', '')
          .order('last_active', { ascending: false })
          .limit(200);
        if (!result.error) { data = result.data; lastError = null; break; }
        lastError = result.error;
      }
      setAllProfiles(lastError ? [] : (data?.length ? data : SEED_PROFILES));
      setLoading(false);
    };

    const fetchSaved = async () => {
      if (!user) return;
      const { data } = await supabase.from('saved_profiles').select('saved_user_id').eq('user_id', user.id);
      if (data) setSavedIds(new Set(data.map(r => r.saved_user_id)));
    };

    const fetchConnectionStates = async () => {
      if (!user) return;
      const states = {};
      const phones = {};
      const [sentRes, recvRes, matchRes] = await Promise.all([
        supabase.from('connect_requests').select('to_user_id').eq('from_user_id', user.id).eq('status', 'pending'),
        supabase.from('connect_requests').select('from_user_id').eq('to_user_id', user.id).eq('status', 'pending'),
        supabase.from('matches').select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
      ]);
      (sentRes.data || []).forEach(r => { states[r.to_user_id] = 'sent'; });
      (recvRes.data || []).forEach(r => { states[r.from_user_id] = 'received'; });
      for (const m of (matchRes.data || [])) {
        const partnerId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        states[partnerId] = 'matched';
        const { data: pData } = await supabase.from('profiles').select('phone').eq('id', partnerId).single();
        if (pData?.phone) phones[partnerId] = pData.phone;
      }
      setConnectionStates(states);
      setMatchedPhones(phones);
    };

    fetchProfiles();
    fetchSaved();
    fetchConnectionStates();
  }, [user, fetchKey]);

  useEffect(() => {
    let filtered = [...allProfiles];
    if (filters.sport.length) filtered = filtered.filter(p => filters.sport.some(f => parseSports(p.sport).includes(f)));
    if (filters.city.length) {
      const std = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Goa', 'Chennai', 'Kolkata'];
      filtered = filtered.filter(p => (filters.city.includes('Other') && !std.includes(p.city)) || filters.city.includes(p.city));
    }
    if (filters.level.length) filtered = filtered.filter(p => filters.level.includes(p.level));
    if (filters.gender.length) filtered = filtered.filter(p => filters.gender.includes(p.gender));

    const viewer = profile || {};
    const scored = filtered.map(p => ({
      ...p,
      matchScore: profile ? calcMatchScore(viewer, p) : 30,
      matchWhy: profile ? whyMatched(viewer, p) : 'Complete your profile for better matches',
      matchLabel: getMatchLabel(profile ? calcMatchScore(viewer, p) : 30),
      matchCaveat: profile ? getMatchCaveat(viewer, p) : null,
    })).filter(x => x.matchScore >= 20);

    if (sort === 'best') scored.sort((a, b) => b.matchScore - a.matchScore);
    else if (sort === 'newest') scored.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'active') scored.sort((a, b) => new Date(b.last_active || 0) - new Date(a.last_active || 0));
    setResults(scored);
  }, [allProfiles, filters, sort, profile]);

  const handleConnect = async (e, profileId) => {
    e.stopPropagation();
    if (!user) { toast.error('Sign in to connect'); return; }
    if (connectingRef.current.has(profileId)) return;
    const currentState = connectionStates[profileId];
    if (currentState === 'sent' || currentState === 'matched') return;

    connectingRef.current.add(profileId);
    setConnectingIds(prev => new Set([...prev, profileId]));

    try {
      const { data: existing } = await supabase
        .from('connect_requests').select('id')
        .eq('from_user_id', user.id).eq('to_user_id', profileId).eq('status', 'pending')
        .maybeSingle();
      if (existing) { setConnectionStates(prev => ({ ...prev, [profileId]: 'sent' })); return; }

      const { count } = await supabase.from('connect_requests')
        .select('*', { count: 'exact', head: true }).eq('from_user_id', user.id)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString());
      if (count >= 10) { toast.error('Daily limit of 10 requests reached. Resets in 24 hours.'); return; }

      const { error } = await supabase.from('connect_requests')
        .insert({ from_user_id: user.id, to_user_id: profileId, status: 'pending' });
      if (error) {
        if (error.code === '23505') { setConnectionStates(prev => ({ ...prev, [profileId]: 'sent' })); return; }
        toast.error('Could not send request. Please try again.');
        return;
      }
      setConnectionStates(prev => ({ ...prev, [profileId]: 'sent' }));
      toast.success(`Connection request sent! ${Math.max(0, 9 - count)} requests remaining today.`);
    } finally {
      connectingRef.current.delete(profileId);
      setConnectingIds(prev => { const n = new Set(prev); n.delete(profileId); return n; });
    }
  };

  const toggleSave = async (e, profileId) => {
    e.stopPropagation();
    if (!user) { toast.error('Sign in to save profiles'); return; }
    const isSaved = savedIds.has(profileId);
    if (isSaved) {
      await supabase.from('saved_profiles').delete().eq('user_id', user.id).eq('saved_user_id', profileId);
      setSavedIds(prev => { const n = new Set(prev); n.delete(profileId); return n; });
      toast.success('Removed from saved');
    } else {
      const { error } = await supabase.from('saved_profiles').insert({ user_id: user.id, saved_user_id: profileId });
      if (error) { toast.error('Could not save profile'); return; }
      setSavedIds(prev => new Set([...prev, profileId]));
      toast.success('Profile saved');
    }
  };

  const toggleFilter = (key, val) => setFilters(prev => ({
    ...prev, [key]: prev[key].includes(val) ? prev[key].filter(v => v !== val) : [...prev[key], val],
  }));
  const clearFilters = () => setFilters({ sport: [], city: [], level: [], gender: [] });
  const activeCount = Object.values(filters).reduce((a, b) => a + b.length, 0);

  // ── DETAIL LINE — shows times with "mins" suffix ──────────────────────────
  const getDetailLine = (p) => {
    const sports = parseSports(p.sport);
    if (sports.includes('hyrox')) {
      const parts = [];
      if (p.hyrox_5k_time) parts.push(`5K: ${withMins(p.hyrox_5k_time)}`);
      if (p.hyrox_10k_time) parts.push(`10K: ${withMins(p.hyrox_10k_time)}`);
      if (parts.length > 0) return parts.join(' · ');
      // Fallback to stations if no times
      const strong = parseArr(p.hyrox_strong).slice(0, 2).join(', ');
      const weak = parseArr(p.hyrox_weak).slice(0, 1).join(', ');
      return `${strong ? `Strong: ${strong}` : ''}${weak ? ` · Working on: ${weak}` : ''}`;
    }
    if (sports.includes('marathon')) {
      const parts = [];
      if (p.marathon_distance) parts.push(p.marathon_distance);
      if (p.marathon_pace) parts.push(`Pace: ${p.marathon_pace}/km`);
      if (p.marathon_5k_time) parts.push(`5K: ${withMins(p.marathon_5k_time)}`);
      if (p.marathon_10k_time) parts.push(`10K: ${withMins(p.marathon_10k_time)}`);
      if (p.marathon_weekly_km) parts.push(p.marathon_weekly_km);
      return parts.join(' · ');
    }
    return '';
  };

  const renderConnectButton = (p) => {
    const state = connectionStates[p.id];
    const isConnecting = connectingIds.has(p.id);
    if (state === 'matched') {
      const phone = (matchedPhones[p.id] || p.phone || '').replace(/\D/g, '');
      return (
        <a href={phone ? `https://wa.me/${phone}?text=Hey!+We+matched+on+CREW+%E2%80%94+want+to+train%3F` : '#'}
          target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="flex-1 text-center py-2 rounded-pill font-inter font-semibold text-xs flex items-center justify-center gap-1.5"
          style={{ background: '#25D366', color: '#fff' }}>
          <MessageCircle size={12} /> Open WhatsApp
        </a>
      );
    }
    if (state === 'sent') return (
      <button disabled onClick={e => e.stopPropagation()}
        className="flex-1 py-2 rounded-pill font-inter font-semibold text-xs opacity-70 cursor-not-allowed"
        style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
        Request Sent ✓
      </button>
    );
    if (state === 'received') return (
      <Link to="/my-connections?tab=received" onClick={e => e.stopPropagation()}
        className="flex-1 text-center py-2 rounded-pill font-inter font-semibold text-xs"
        style={{ background: '#4A3D8F', color: '#fff' }}>
        Respond to Request →
      </Link>
    );
    return (
      <button onClick={e => handleConnect(e, p.id)} disabled={isConnecting}
        className="flex-1 py-2 rounded-pill font-inter font-semibold text-xs transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
        style={{ background: '#D4880A', color: '#fff' }}>
        {isConnecting ? 'Sending...' : <>Connect <ArrowRight size={12} className="inline ml-1" /></>}
      </button>
    );
  };

  const isRecent = (d) => d && (new Date() - new Date(d)) < 7 * 86400000;
  const profileComplete = profile?.name && profile?.city && profile?.sport && profile?.level;

  const FilterPanel = () => (
    <div className="space-y-5">
      <div>
        <p className="font-inter text-xs font-medium text-white mb-2">Sport</p>
        {['hyrox', 'marathon'].map(s => (
          <label key={s} className="flex items-center gap-2 mb-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.sport.includes(s)} onChange={() => toggleFilter('sport', s)} className="accent-amber-brand" />
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          </label>
        ))}
      </div>
      <div>
        <p className="font-inter text-xs font-medium text-white mb-2">City</p>
        {FILTER_CITIES.map(c => (
          <label key={c} className="flex items-center gap-2 mb-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.city.includes(c)} onChange={() => toggleFilter('city', c)} className="accent-amber-brand" />
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{c}</span>
          </label>
        ))}
      </div>
      <div>
        <p className="font-inter text-xs font-medium text-white mb-2">Experience Level</p>
        {FILTER_LEVELS.map(l => (
          <label key={l.val} className="flex items-center gap-2 mb-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.level.includes(l.val)} onChange={() => toggleFilter('level', l.val)} className="accent-amber-brand" />
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{l.label}</span>
          </label>
        ))}
      </div>
      <div>
        <p className="font-inter text-xs font-medium text-white mb-2">Gender</p>
        {['Male', 'Female', 'Other', 'Prefer not to say'].map(g => (
          <label key={g} className="flex items-center gap-2 mb-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.gender.includes(g)} onChange={() => toggleFilter('gender', g)} className="accent-amber-brand" />
            <span className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{g}</span>
          </label>
        ))}
      </div>
      {activeCount > 0 && <button onClick={clearFilters} className="font-inter text-xs" style={{ color: '#6B5FA0' }}>Clear all filters</button>}
    </div>
  );

  return (
    <div data-testid="find-a-partner-page">
      {!profileComplete && profile && (
        <div className="px-6 md:px-12 py-3" style={{ background: 'rgba(212,136,10,0.12)', borderBottom: '1px solid rgba(212,136,10,0.25)' }}>
          <p className="font-inter text-sm text-center" style={{ color: '#F0A830' }}>
            Your profile is incomplete. <Link to="/profile/edit" style={{ color: '#D4880A', fontWeight: 600 }}>Complete it</Link> to get better matches.
          </p>
        </div>
      )}
      <section className="py-14 md:py-24 px-6 md:px-12 min-h-screen" style={{ background: '#1C0A30' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="hidden md:block w-64 shrink-0">
              <div className="sticky top-20 rounded-[20px] p-5 border" style={{ background: 'rgba(42,26,69,0.60)', borderColor: 'rgba(74,61,143,0.30)' }}>
                <h3 className="font-inter font-bold text-sm text-white mb-4">Filter athletes</h3>
                <FilterPanel />
              </div>
            </div>
            <button onClick={() => setShowFilters(true)} className="md:hidden flex items-center gap-2 px-4 py-2 rounded-pill font-inter text-sm self-start" style={{ border: '2px solid rgba(74,61,143,0.30)', color: '#fff' }}>
              <Filter size={14} /> Filters {activeCount > 0 && `(${activeCount})`}
            </button>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Showing {results.length} athletes</p>
                <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-1.5 rounded-[8px] font-inter text-xs outline-none" style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)', color: '#fff' }}>
                  <option value="best">Best Match</option>
                  <option value="active">Most Active</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
              {activeCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(filters).flatMap(([key, vals]) => vals.map(v => (
                    <span key={`${key}-${v}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-pill font-inter text-xs" style={{ background: 'rgba(212,136,10,0.12)', color: '#F0A830', border: '1px solid rgba(212,136,10,0.25)' }}>
                      {v} <button onClick={() => toggleFilter(key, v)}><X size={12} /></button>
                    </span>
                  )))}
                </div>
              )}
              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1,2,3,4].map(i => <div key={i} className="rounded-[20px] h-48 animate-pulse" style={{ background: 'rgba(42,26,69,0.40)' }} />)}
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {results.map(p => (
                    <div key={p.id} onClick={() => navigate(`/athlete/${p.id}`)}
                      className="rounded-[20px] p-5 border transition-all hover:-translate-y-1 cursor-pointer"
                      style={{ background: 'rgba(42,26,69,0.60)', borderColor: 'rgba(74,61,143,0.30)' }}>
                      <div className="flex items-start gap-3 mb-3">
                        {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-full object-cover" /> : <GradientAvatar name={p.name} size={48} />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-inter font-semibold text-sm text-white truncate">{p.name}</p>
                            {isRecent(p.last_active) && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                            {p.email_verified && <CheckCircle size={12} className="text-green-400 shrink-0" />}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parseSports(p.sport).filter(s => s !== 'ironman').map(s => {
                              const b = sportBadge(s);
                              return <span key={s} className="px-1.5 py-0.5 rounded-pill text-[9px] font-inter font-bold text-white" style={{ background: b.bg }}>{b.label}</span>;
                            })}
                            <span className="font-inter text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.city}{p.area ? ` · ${p.area}` : ''}</span>
                          </div>
                        </div>
                      </div>
                      {p.level && <span className="inline-block px-2 py-0.5 rounded-pill text-[10px] font-inter font-medium capitalize mb-2" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>{p.level}</span>}
                      {getDetailLine(p) && <p className="font-inter text-[12px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{getDetailLine(p)}</p>}
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full" style={{ width: `${p.matchScore}%`, background: '#D4880A' }} />
                          </div>
                          <span className="font-inter font-bold text-[13px] min-w-[40px] text-right" style={{ color: '#D4880A' }}>{p.matchScore}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-inter text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.matchLabel}</span>
                          <span className="font-inter text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}><Eye size={10} className="inline mr-1" />{p.profile_views || 0} views</span>
                        </div>
                      </div>
                      <p className="font-inter text-[11px] mb-1" style={{ color: '#A89CC8' }}>{p.matchWhy}</p>
                      {p.matchCaveat && <p className="font-inter text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>{p.matchCaveat}</p>}
                      <div className="flex gap-2">
                        {renderConnectButton(p)}
                        <button onClick={e => toggleSave(e, p.id)}
                          className="px-3 py-2 rounded-pill transition-colors"
                          style={{ border: '2px solid rgba(74,61,143,0.30)', color: savedIds.has(p.id) ? '#D4880A' : 'rgba(255,255,255,0.5)', background: savedIds.has(p.id) ? 'rgba(212,136,10,0.10)' : 'transparent' }}
                          title={savedIds.has(p.id) ? 'Remove from saved' : 'Save profile'}>
                          <Heart size={14} fill={savedIds.has(p.id) ? '#D4880A' : 'none'} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  {allProfiles.length === 0 && !loading ? (
                    <>
                      <p className="font-inter text-lg font-semibold text-white mb-2">No athletes found.</p>
                      <p className="font-inter text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>This might be a temporary connection issue.</p>
                      <button onClick={() => { setLoading(true); setAllProfiles([]); setFetchKey(k => k + 1); }} className="font-inter text-sm font-semibold px-5 py-2 rounded-pill" style={{ background: '#D4880A', color: '#fff' }}>Try Again</button>
                    </>
                  ) : (
                    <>
                      <p className="font-inter text-sm text-white mb-2">No athletes match these filters.</p>
                      <p className="font-inter text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>Try widening your search.</p>
                      <button onClick={clearFilters} className="font-inter text-xs font-semibold" style={{ color: '#D4880A' }}>Clear Filters</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {showFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[24px] p-6 max-h-[85vh] overflow-y-auto" style={{ background: '#1C0A30' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-inter font-bold text-white text-lg">Filters</h3>
              <button onClick={() => setShowFilters(false)}><X size={22} className="text-white" /></button>
            </div>
            <FilterPanel />
            <button onClick={() => setShowFilters(false)} className="w-full mt-8 py-3 rounded-pill font-inter font-bold text-sm" style={{ background: '#D4880A', color: '#fff' }}>Apply Filters</button>
          </div>
        </div>
      )}
    </div>
  );
}
