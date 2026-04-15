import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeft, ArrowRight, MapPin, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const SPORTS = [
  { id: 'hyrox', label: 'HYROX', desc: 'Fitness racing · 8 stations + 8km running' },
  { id: 'marathon', label: 'MARATHON', desc: 'Road running · 5K to Ultra' },
];

const HYROX_STATIONS = ['SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jump', 'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls'];
const CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Goa', 'Chennai', 'Kolkata', 'Other'];

function RadioCard({ label, desc, selected, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left p-4 rounded-[16px] border-2 transition-all"
      style={{
        borderColor: selected ? '#D4880A' : 'rgba(74,61,143,0.30)',
        background: selected ? 'rgba(212,136,10,0.08)' : 'rgba(42,26,69,0.40)',
        boxShadow: selected ? '0 0 20px rgba(212,136,10,0.15)' : 'none',
      }}>
      <p className="font-inter font-semibold text-sm text-white">{label}</p>
      {desc && <p className="font-inter text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>}
    </button>
  );
}

function ChipSelect({ options, selected, onToggle, multi = true, maxSelect = null }) {
  const sel = multi ? (Array.isArray(selected) ? selected : []) : [selected];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const isSelected = sel.includes(o);
        const atMax = multi && maxSelect && sel.length >= maxSelect && !isSelected;
        return (
          <button key={o} onClick={() => !atMax && onToggle(o)}
            className="px-3.5 py-2 rounded-full font-inter text-xs font-medium transition-all"
            style={{
              border: isSelected ? '2px solid #D4880A' : '2px solid rgba(74,61,143,0.30)',
              background: isSelected ? 'rgba(212,136,10,0.12)' : 'transparent',
              color: isSelected ? '#F0A830' : atMax ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
              cursor: atMax ? 'not-allowed' : 'pointer',
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function NavButtons({ onBack, onNext, disabled, nextLabel = 'Next', showBack = true }) {
  return (
    <div className="flex gap-3 mt-8">
      {showBack && (
        <button onClick={onBack} className="px-6 py-3 rounded-full font-inter font-semibold text-sm"
          style={{ border: '2px solid rgba(74,61,143,0.30)', color: '#fff' }}>
          <ArrowLeft size={16} />
        </button>
      )}
      <button onClick={() => onNext()} disabled={disabled}
        className="flex-1 py-3 rounded-full font-inter font-bold text-sm disabled:opacity-30 transition-all"
        style={{ background: '#D4880A', color: '#fff' }}>
        {nextLabel} {!disabled && <ArrowRight size={16} className="inline ml-1" />}
      </button>
    </div>
  );
}

export default function GetStarted() {
  const { user, session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('loading');
  const [answers, setAnswers] = useState({});
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);

  // Multi-sport fix: takes the sports array as argument instead of reading stale state
  const getStepSequence = useCallback((sports) => {
    const seq = ['sport-select'];
    if (sports.includes('hyrox')) seq.push('hyrox-race', 'hyrox-fitness', 'hyrox-stations');
    if (sports.includes('marathon')) seq.push('marathon-race', 'marathon-training', 'marathon-partner');
    seq.push('profile-details', 'location', 'done');
    return seq;
  }, []);

  const getCurrentSports = useCallback(() => {
    const rawSport = answers.sport;
    if (Array.isArray(rawSport)) return rawSport;
    if (typeof rawSport === 'string') {
      try { return JSON.parse(rawSport); } catch { return rawSport ? [rawSport] : []; }
    }
    return [];
  }, [answers.sport]);

  const currentSequence = getStepSequence(getCurrentSports());
  const currentIdx = currentSequence.indexOf(step);
  const totalSteps = currentSequence.length;
  const progress = step === 'auth' || step === 'loading' ? 0 : Math.round(((currentIdx + 1) / totalSteps) * 100);

  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: evts } = await supabase.from('events').select('*')
        .gte('event_date', today).eq('is_active', true).order('event_date');
      setEvents(evts || []);

      if (user) {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).single();
        if (prof?.name?.trim()) { navigate('/find-a-partner'); return; }
        const saved = localStorage.getItem('crew-onboarding-progress');
        if (saved) {
          try {
            const { step: s, answers: a } = JSON.parse(saved);
            if (s && s !== 'auth' && s !== 'loading') setStep(s);
            else setStep('sport-select');
            if (a) setAnswers(a);
          } catch { setStep('sport-select'); }
        } else {
          setStep('sport-select');
        }
      } else {
        setStep('auth');
      }
    };
    if (step === 'loading') init();
  }, [user, navigate, step]);

  const getUserId = useCallback(() => session?.user?.id || user?.id || null, [session, user]);

  const upsertProfile = async (data) => {
    const uid = getUserId();
    if (!uid) { toast.error('Session expired. Please sign in again.'); return false; }

    // Only send fields that are actually set — prevents HYROX data from being
    // overwritten with null when the user proceeds through marathon steps
    const serialized = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;
      if (Array.isArray(val) && val.length === 0) return;
      if (key === 'sport' || key === 'hyrox_strong' || key === 'hyrox_weak') {
        serialized[key] = Array.isArray(val) ? JSON.stringify(val) : val;
      } else {
        serialized[key] = val;
      }
    });

    const { error: upsertError } = await supabase.from('profiles')
      .upsert({ id: uid, ...serialized, last_active: new Date().toISOString() }, { onConflict: 'id' });
    if (upsertError) {
      console.error('[GetStarted] upsertProfile error:', upsertError.message);
      toast.error('Could not save your progress. ' + upsertError.message);
      return false;
    }
    return true;
  };

  const saveProgress = (nextStep, newAnswers) => {
    localStorage.setItem('crew-onboarding-progress', JSON.stringify({ step: nextStep, answers: newAnswers }));
  };

  const goNext = async (stepData = {}) => {
    if (submitting) return;
    setSubmitting(true);
    const merged = { ...answers, ...stepData };
    setAnswers(merged);

    if (user || session) {
      const ok = await upsertProfile(merged);
      if (!ok) { setSubmitting(false); return; }
    }

    // Use updated sports from merged to compute correct sequence
    const updatedSports = Array.isArray(merged.sport) ? merged.sport :
      (typeof merged.sport === 'string' ? (() => { try { return JSON.parse(merged.sport); } catch { return [merged.sport]; } })() : []);
    const seq = getStepSequence(updatedSports);
    const idx = seq.indexOf(step);
    const next = idx < seq.length - 1 ? seq[idx + 1] : 'done';
    saveProgress(next, merged);
    setStep(next);
    setSubmitting(false);
  };

  const goBack = () => {
    const seq = getStepSequence(getCurrentSports());
    const idx = seq.indexOf(step);
    if (idx > 0) setStep(seq[idx - 1]);
  };

  const handleSendMagicLink = async () => {
    if (!email) { setError('Email is required'); return; }
    setLoading(true); setError('');
    try {
      const { error: authErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authErr) throw authErr;
      setAnswers(prev => ({ ...prev, phone: `${countryCode}${phone}` }));
      setEmailSent(true);
    } catch (e) {
      setError(e.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSave = async () => {
    const uid = getUserId();
    if (!uid) return false;

    const cityValue = answers.city === 'Other' ? (answers.city_custom || 'Other') : answers.city;

    const finalData = {
      id: uid,
      name: answers.name,
      age: answers.age ? parseInt(answers.age) : null,
      gender: answers.gender,
      city: cityValue,
      area: answers.area || null,
      lat: answers.lat || null,
      lng: answers.lng || null,
      sport: Array.isArray(answers.sport) ? JSON.stringify(answers.sport) : answers.sport,
      level: answers.level || null,
      race_goal: answers.race_goal || null,
      bio: answers.bio || null,
      photo_url: answers.photo_url || null,
      target_race: answers.target_race || null,
      hyrox_category: answers.hyrox_category || null,
      hyrox_strong: Array.isArray(answers.hyrox_strong) ? JSON.stringify(answers.hyrox_strong) : (answers.hyrox_strong || '[]'),
      hyrox_weak: Array.isArray(answers.hyrox_weak) ? JSON.stringify(answers.hyrox_weak) : (answers.hyrox_weak || '[]'),
      hyrox_5k_time: answers.hyrox_5k_time || null,
      marathon_distance: answers.marathon_distance || null,
      marathon_pace: answers.marathon_pace || null,
      marathon_weekly_km: answers.marathon_weekly_km || null,
      marathon_goal: answers.marathon_goal || null,
      training_days: answers.training_days || null,
      partner_goal: answers.partner_goal || null,
      partner_level_pref: answers.partner_level_pref || null,
      partner_gender_pref: answers.partner_gender_pref || null,
      phone: answers.phone || (phone ? `${countryCode}${phone}` : null),
      instagram: answers.instagram || null,
      flagged: false,
      last_active: new Date().toISOString(),
    };

    const { error: saveErr } = await supabase.from('profiles').upsert(finalData, { onConflict: 'id' });
    if (saveErr) {
      console.error('[GetStarted] Final save error:', saveErr.message);
      toast.error('Could not save your profile. ' + saveErr.message);
      return false;
    }
    localStorage.removeItem('crew-onboarding-progress');
    await refreshProfile();
    return true;
  };

  const update = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));
  const toggleArray = (key, val, maxSelect = null) => {
    const arr = Array.isArray(answers[key]) ? answers[key] : [];
    if (arr.includes(val)) {
      update(key, arr.filter(v => v !== val));
    } else {
      if (maxSelect && arr.length >= maxSelect) {
        toast.error(`You can select up to ${maxSelect} options`);
        return;
      }
      update(key, [...arr, val]);
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  if (step === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1C0A30' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #D4880A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {

      // ── AUTH ──────────────────────────────────────────────────────────────
      case 'auth':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="font-inter font-[800] text-3xl text-white mb-2">Let's get you set up.</h2>
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Create your profile and find your training partners.
            </p>
            {!emailSent ? (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="font-inter text-xs font-medium text-white block mb-1.5">Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMagicLink()}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                      style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
                    <p className="font-inter text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>We'll send you a sign-in link.</p>
                  </div>
                  <div>
                    <label className="font-inter text-xs font-medium text-white block mb-1.5">Phone number</label>
                    <div className="flex gap-2">
                      <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                        className="px-3 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                        style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }}>
                        {['+91', '+971', '+66', '+1', '+44', '+65'].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210"
                        className="flex-1 px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                        style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
                    </div>
                    <p className="font-inter text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Used to open WhatsApp when you connect with someone.</p>
                  </div>
                </div>
                {error && <p className="font-inter text-xs mb-4" style={{ color: '#ef4444' }}>{error}</p>}
                <button onClick={handleSendMagicLink} disabled={loading}
                  className="w-full py-3 rounded-full font-inter font-bold text-sm transition-all disabled:opacity-50"
                  style={{ background: '#D4880A', color: '#fff' }}>
                  {loading ? 'Sending...' : 'Continue'}
                </button>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212,136,10,0.15)' }}>
                  <Check size={32} style={{ color: '#D4880A' }} />
                </div>
                <h3 className="font-inter font-bold text-xl text-white mb-2">Check your inbox.</h3>
                <p className="font-inter text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>We've sent a sign-in link to</p>
                <p className="font-inter font-semibold text-white mb-4">{email}</p>
                <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Click the link in the email. It brings you straight back here to finish your profile.
                </p>
              </div>
            )}
          </div>
        );

      // ── SPORT SELECT ──────────────────────────────────────────────────────
      case 'sport-select':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="font-inter font-[800] text-3xl text-white mb-2">Choose your sport</h2>
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>Select all that apply.</p>
            <div className="space-y-3 mb-8">
              {SPORTS.map(s => {
                const sports = Array.isArray(answers.sport) ? answers.sport : [];
                return (
                  <RadioCard key={s.id} label={s.label} desc={s.desc}
                    selected={sports.includes(s.id)}
                    onClick={() => {
                      const cur = Array.isArray(answers.sport) ? answers.sport : [];
                      update('sport', cur.includes(s.id) ? cur.filter(x => x !== s.id) : [...cur, s.id]);
                    }} />
                );
              })}
            </div>
            <button
              onClick={() => {
                const sports = Array.isArray(answers.sport) ? answers.sport : [];
                goNext({ sport: sports });
              }}
              disabled={!Array.isArray(answers.sport) || answers.sport.length === 0 || submitting}
              className="w-full py-3 rounded-full font-inter font-bold text-sm transition-all disabled:opacity-30"
              style={{ background: '#D4880A', color: '#fff' }}>
              {submitting ? 'Saving...' : 'Next →'}
            </button>
          </div>
        );

      // ── HYROX 1 of 3 ──────────────────────────────────────────────────────
      case 'hyrox-race':
        return (
          <div className="max-w-md mx-auto">
            <p className="font-inter text-xs mb-2" style={{ color: '#D4880A' }}>HYROX — 1 of 3</p>
            <h2 className="font-inter font-[800] text-3xl text-white mb-6">Your race.</h2>
            <div className="space-y-6">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Which race are you targeting?</label>
                <select value={answers.target_race || ''} onChange={e => update('target_race', e.target.value)}
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }}>
                  <option value="">Not sure yet</option>
                  {events.filter(e => e.sport === 'hyrox').map(e => (
                    <option key={e.slug} value={e.name}>{e.name} — {new Date(e.event_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</option>
                  ))}
                  <option value="other">Another event</option>
                </select>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Choose your category</label>
                <div className="space-y-2">
                  {[
                    { val: 'open', label: 'Open', desc: 'Standard solo — most popular' },
                    { val: 'pro', label: 'Pro', desc: 'Competitive solo, targeting a fast time' },
                    { val: 'doubles', label: 'Doubles', desc: 'Two people sharing all stations and running' },
                    { val: 'mixed_doubles', label: 'Mixed Doubles', desc: 'One male and one female' },
                  ].map(c => (
                    <RadioCard key={c.val} label={c.label} desc={c.desc}
                      selected={answers.hyrox_category === c.val}
                      onClick={() => update('hyrox_category', c.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">How many HYROX races have you done before?</label>
                <ChipSelect
                  options={['0 — this is my first', '1–2', '3–5', '5+']}
                  selected={answers._hyrox_exp} multi={false}
                  onToggle={v => {
                    update('_hyrox_exp', v);
                    const map = { '0 — this is my first': 'rookie', '1–2': 'intermediate', '3–5': 'advanced', '5+': 'elite' };
                    update('level', map[v]);
                  }} />
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} disabled={submitting} nextLabel={submitting ? 'Saving...' : 'Next'} />
          </div>
        );

      // ── HYROX 2 of 3 ──────────────────────────────────────────────────────
      case 'hyrox-fitness':
        return (
          <div className="max-w-md mx-auto">
            <p className="font-inter text-xs mb-2" style={{ color: '#D4880A' }}>HYROX — 2 of 3</p>
            <h2 className="font-inter font-[800] text-3xl text-white mb-6">Your fitness.</h2>
            <div className="space-y-6">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Select your current fitness level</label>
                <div className="space-y-2">
                  {[
                    { val: 'beginner', label: 'Beginner', desc: 'Building base fitness' },
                    { val: 'intermediate', label: 'Intermediate', desc: 'Consistent training, not racing for a time' },
                    { val: 'advanced', label: 'Advanced', desc: 'Regular competitor, targeting a specific time' },
                    { val: 'pro', label: 'Pro', desc: 'Podium ambitions' },
                  ].map(l => (
                    <RadioCard key={l.val} label={l.label} desc={l.desc}
                      selected={answers.level === l.val}
                      onClick={() => update('level', l.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">What do you want out of the race?</label>
                <div className="space-y-2">
                  {[
                    { val: 'Participating for fun', label: 'Participating for fun', desc: 'Just here to enjoy it' },
                    { val: 'Competing for time', label: 'Competing for time', desc: 'Working towards a specific finish time' },
                    { val: 'Podium level', label: 'Podium level', desc: 'Top finisher, age group or overall' },
                  ].map(g => (
                    <RadioCard key={g.val} label={g.label} desc={g.desc}
                      selected={answers.race_goal === g.val}
                      onClick={() => update('race_goal', g.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  5km run time <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input type="text" value={answers.hyrox_5k_time || ''} onChange={e => update('hyrox_5k_time', e.target.value)}
                  placeholder="e.g. 26:30"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Training days per week</label>
                <ChipSelect options={['1–2 days', '3–4 days', '5–6 days', 'Every day']}
                  selected={answers.training_days} multi={false}
                  onToggle={v => update('training_days', v)} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  Where do you train? <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input type="text" value={answers.area || ''} onChange={e => update('area', e.target.value)}
                  placeholder="e.g. Gold's Gym, South Delhi"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} disabled={submitting} nextLabel={submitting ? 'Saving...' : 'Next'} />
          </div>
        );

      // ── HYROX 3 of 3 ──────────────────────────────────────────────────────
      case 'hyrox-stations':
        return (
          <div className="max-w-md mx-auto">
            <p className="font-inter text-xs mb-2" style={{ color: '#D4880A' }}>HYROX — 3 of 3</p>
            <h2 className="font-inter font-[800] text-3xl text-white mb-2">Your partner.</h2>
            <p className="font-inter text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Helps us find someone who challenges where you're strong and supports where you're not.</p>
            <div className="space-y-6">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  What are your strengths? <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>Select up to 3</span>
                </label>
                <ChipSelect options={HYROX_STATIONS} selected={answers.hyrox_strong || []}
                  onToggle={v => toggleArray('hyrox_strong', v, 3)} maxSelect={3} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  Where do you want to improve? <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>Select up to 3</span>
                </label>
                <ChipSelect options={HYROX_STATIONS} selected={answers.hyrox_weak || []}
                  onToggle={v => toggleArray('hyrox_weak', v, 3)} maxSelect={3} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Choose your ideal training partner</label>
                <div className="space-y-2">
                  {[
                    { val: 'Train regularly', label: 'Train together regularly', desc: 'Same programme, consistent sessions' },
                    { val: 'Occasional sessions', label: 'Occasional sessions', desc: 'When schedules align' },
                    { val: 'Race day only', label: 'Race day only', desc: 'No training commitment' },
                    { val: 'Just connect', label: 'Just connect', desc: 'No specific plan' },
                  ].map(g => (
                    <RadioCard key={g.val} label={g.label} desc={g.desc}
                      selected={answers.partner_goal === g.val}
                      onClick={() => update('partner_goal', g.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Choose your preferred partner level</label>
                <ChipSelect
                  options={['Same as me', 'Better - Challenge me', 'Happy to guide someone', 'No preference']}
                  selected={answers.partner_level_pref} multi={false}
                  onToggle={v => update('partner_level_pref', v)} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Do you have a gender preference?</label>
                <ChipSelect options={['No preference', 'Men only', 'Women only', 'Other']}
                  selected={answers.partner_gender_pref} multi={false}
                  onToggle={v => update('partner_gender_pref', v)} />
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} disabled={submitting} nextLabel={submitting ? 'Saving...' : 'Next'} />
          </div>
        );

      // ── MARATHON 1 of 3 ───────────────────────────────────────────────────
      case 'marathon-race':
        return (
          <div className="max-w-md mx-auto">
            <p className="font-inter text-xs mb-2" style={{ color: '#D4880A' }}>Marathon — 1 of 3</p>
            <h2 className="font-inter font-[800] text-3xl text-white mb-6">Your race.</h2>
            <div className="space-y-6">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Distance you're training for</label>
                <div className="grid grid-cols-2 gap-2">
                  {['5K', '10K', 'Half Marathon', 'Full Marathon', 'Ultra'].map(d => (
                    <RadioCard key={d} label={d} selected={answers.marathon_distance === d}
                      onClick={() => update('marathon_distance', d)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  Target race <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <select value={answers.target_race || ''} onChange={e => update('target_race', e.target.value)}
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }}>
                  <option value="">Not targeting one yet</option>
                  {events.filter(e => e.sport === 'marathon').map(e => (
                    <option key={e.slug} value={e.name}>{e.name} — {new Date(e.event_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</option>
                  ))}
                  <option value="other">Another race</option>
                </select>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Races completed at this distance</label>
                <ChipSelect
                  options={['0 — first time', '1–3', '4–10', '10+']}
                  selected={answers._marathon_exp} multi={false}
                  onToggle={v => {
                    update('_marathon_exp', v);
                    const map = { '0 — first time': 'rookie', '1–3': 'intermediate', '4–10': 'advanced', '10+': 'elite' };
                    update('level', map[v]);
                  }} />
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} disabled={submitting} nextLabel={submitting ? 'Saving...' : 'Next'} />
          </div>
        );

      // ── MARATHON 2 of 3 ───────────────────────────────────────────────────
      case 'marathon-training':
        return (
          <div className="max-w-md mx-auto">
            <p className="font-inter text-xs mb-2" style={{ color: '#D4880A' }}>Marathon — 2 of 3</p>
            <h2 className="font-inter font-[800] text-3xl text-white mb-6">Your training.</h2>
            <div className="space-y-6">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Select your current fitness level</label>
                <div className="space-y-2">
                  {[
                    { val: 'beginner', label: 'Beginner', desc: 'Building base fitness' },
                    { val: 'intermediate', label: 'Intermediate', desc: 'Consistent training' },
                    { val: 'advanced', label: 'Advanced', desc: 'Regular competitor, targeting a time' },
                    { val: 'pro', label: 'Pro', desc: 'Competitive, podium ambitions' },
                  ].map(l => (
                    <RadioCard key={l.val} label={l.label} desc={l.desc}
                      selected={answers.level === l.val}
                      onClick={() => update('level', l.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  What's your comfortable long run pace? <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input type="text" value={answers.marathon_pace || ''} onChange={e => update('marathon_pace', e.target.value)}
                  placeholder="e.g. 5:45 per km"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
                <p className="font-inter text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Your easy pace, not race pace.</p>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">What's your avg weekly distance?</label>
                <ChipSelect options={['Under 20km', '20–40km', '40–60km', '60–80km', '80km+']}
                  selected={answers.marathon_weekly_km} multi={false}
                  onToggle={v => update('marathon_weekly_km', v)} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Training days per week</label>
                <ChipSelect options={['2–3 days', '4–5 days', '6–7 days']}
                  selected={answers.training_days} multi={false}
                  onToggle={v => update('training_days', v)} />
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} disabled={submitting} nextLabel={submitting ? 'Saving...' : 'Next'} />
          </div>
        );

      // ── MARATHON 3 of 3 ───────────────────────────────────────────────────
      case 'marathon-partner':
        return (
          <div className="max-w-md mx-auto">
            <p className="font-inter text-xs mb-2" style={{ color: '#D4880A' }}>Marathon — 3 of 3</p>
            <h2 className="font-inter font-[800] text-3xl text-white mb-6">Your goal and partner.</h2>
            <div className="space-y-6">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">What do you want out of the race?</label>
                <div className="space-y-2">
                  {[
                    { val: 'Participating for fun', label: 'Participating for fun', desc: 'First time, getting to the line is the goal' },
                    { val: 'Beat my PB', label: 'Beat my PB', desc: 'I have a time, I want to beat it' },
                    { val: 'Hit a target time', label: 'Hit a target time', desc: 'Working towards a specific finish' },
                    { val: 'Compete and place', label: 'Compete and place', desc: 'Age group or overall placing' },
                  ].map(g => (
                    <RadioCard key={g.val} label={g.label} desc={g.desc}
                      selected={answers.marathon_goal === g.val}
                      onClick={() => update('marathon_goal', g.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Choose your ideal training partner</label>
                <div className="space-y-2">
                  {[
                    { val: 'Long run partner', label: 'Long run partner', desc: 'Weekend distance together' },
                    { val: 'Tempo partner', label: 'Tempo / speed session', desc: 'Structured fast sessions' },
                    { val: 'Race day pacer', label: 'Race day pacer', desc: 'Run together on race day only' },
                    { val: 'Full training partner', label: 'Full training partner', desc: 'Build a programme together' },
                    { val: 'Just connect', label: 'Just connect', desc: 'No specific plan' },
                  ].map(g => (
                    <RadioCard key={g.val} label={g.label} desc={g.desc}
                      selected={answers.partner_goal === g.val}
                      onClick={() => update('partner_goal', g.val)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Choose your preferred partner level</label>
                <ChipSelect
                  options={['Same as me', 'Better - Challenge me', 'Happy to guide someone', 'No preference']}
                  selected={answers.partner_level_pref} multi={false}
                  onToggle={v => update('partner_level_pref', v)} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">Do you have a gender preference?</label>
                <ChipSelect options={['No preference', 'Men only', 'Women only', 'Other']}
                  selected={answers.partner_gender_pref} multi={false}
                  onToggle={v => update('partner_gender_pref', v)} />
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} disabled={submitting} nextLabel={submitting ? 'Saving...' : 'Next'} />
          </div>
        );

      // ── PROFILE DETAILS ───────────────────────────────────────────────────
      case 'profile-details':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="font-inter font-[800] text-3xl text-white mb-2">Almost there.</h2>
            <p className="font-inter text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>Tell us a bit about you.</p>
            <div className="space-y-5">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">
                  First name <span style={{ color: '#D4880A' }}>*</span>
                </label>
                <input type="text" value={answers.name || ''} onChange={e => update('name', e.target.value)}
                  placeholder="e.g. Arjun"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">
                  Age <span style={{ color: '#D4880A' }}>*</span>
                </label>
                <input type="number" min={16} max={80} value={answers.age || ''} onChange={e => update('age', e.target.value)}
                  placeholder="28"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-2">
                  Gender <span style={{ color: '#D4880A' }}>*</span>
                </label>
                <ChipSelect options={['Male', 'Female', 'Other', 'Prefer not to say']}
                  selected={answers.gender} multi={false}
                  onToggle={v => update('gender', v)} />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">
                  Bio <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea value={answers.bio || ''} onChange={e => update('bio', e.target.value.slice(0, 200))}
                  placeholder="e.g. Engineer by day, Hyrox-obsessed by night. Looking for someone who won't quit at station 5."
                  maxLength={200} rows={3}
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none resize-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
                <p className="font-inter text-[11px] text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>{(answers.bio || '').length}/200</p>
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">
                  Instagram <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-3 rounded-l-[12px] font-inter text-sm"
                    style={{ background: 'rgba(42,26,69,0.80)', border: '1px solid rgba(74,61,143,0.30)', borderRight: 'none', color: 'rgba(255,255,255,0.4)' }}>@</span>
                  <input type="text" value={answers.instagram || ''} onChange={e => update('instagram', e.target.value)}
                    placeholder="username"
                    className="flex-1 px-4 py-3 rounded-r-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                    style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={goBack} className="px-6 py-3 rounded-full font-inter font-semibold text-sm"
                style={{ border: '2px solid rgba(74,61,143,0.30)', color: '#fff' }}>
                <ArrowLeft size={16} />
              </button>
              <button onClick={() => goNext()}
                disabled={!answers.name?.trim() || !answers.age || !answers.gender || submitting}
                className="flex-1 py-3 rounded-full font-inter font-bold text-sm disabled:opacity-30"
                style={{ background: '#D4880A', color: '#fff' }}>
                {submitting ? 'Saving...' : 'Next →'}
              </button>
            </div>
          </div>
        );

      // ── LOCATION ──────────────────────────────────────────────────────────
      case 'location':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="font-inter font-[800] text-3xl text-white mb-2">Where are you based?</h2>
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Your city is the biggest factor in finding partners you can actually train with.
            </p>
            <div className="space-y-5">
              <button
                onClick={() => {
                  navigator.geolocation?.getCurrentPosition(
                    pos => { update('lat', pos.coords.latitude); update('lng', pos.coords.longitude); toast.success('Location detected!'); },
                    () => toast.error('Could not get location. Please select manually.')
                  );
                }}
                className="w-full py-3 rounded-full font-inter font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                <MapPin size={16} /> Use my current location
              </button>
              {answers.lat && (
                <p className="font-inter text-xs text-center" style={{ color: '#4ade80' }}>
                  Location detected. Select your city below to confirm.
                </p>
              )}
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">
                  City <span style={{ color: '#D4880A' }}>*</span>
                </label>
                <select value={answers.city || ''} onChange={e => update('city', e.target.value)}
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }}>
                  <option value="">Select your city</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Show text input when Other is selected */}
              {answers.city === 'Other' && (
                <div>
                  <label className="font-inter text-xs font-medium text-white block mb-1.5">
                    Enter your city <span style={{ color: '#D4880A' }}>*</span>
                  </label>
                  <input type="text" value={answers.city_custom || ''} onChange={e => update('city_custom', e.target.value)}
                    placeholder="e.g. Chandigarh"
                    className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                    style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
                </div>
              )}
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">
                  Neighbourhood / area <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input type="text" value={answers.area || ''} onChange={e => update('area', e.target.value)}
                  placeholder="e.g. South Delhi, Bandra, Koramangala"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={goBack} className="px-6 py-3 rounded-full font-inter font-semibold text-sm"
                style={{ border: '2px solid rgba(74,61,143,0.30)', color: '#fff' }}>
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={async () => {
                  if (submitting) return;
                  const needsCustomCity = answers.city === 'Other' && !answers.city_custom?.trim();
                  if (needsCustomCity) { toast.error('Please enter your city name'); return; }
                  setSubmitting(true);
                  const ok = await handleFinalSave();
                  setSubmitting(false);
                  if (ok) setStep('done');
                }}
                disabled={!answers.city || submitting}
                className="flex-1 py-3 rounded-full font-inter font-bold text-sm disabled:opacity-30"
                style={{ background: '#D4880A', color: '#fff' }}>
                {submitting ? 'Saving your profile...' : 'Finish →'}
              </button>
            </div>
          </div>
        );

      // ── DONE ──────────────────────────────────────────────────────────────
      case 'done':
        return (
          <div className="max-w-md mx-auto text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(212,136,10,0.15)' }}>
                <Check size={40} style={{ color: '#D4880A' }} />
              </div>
            </motion.div>
            <h2 className="font-inter font-[800] text-3xl text-white mb-2">You're on CREW.</h2>
            <p className="font-inter text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Your profile is live. Time to find your training partner.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/find-a-partner')}
                className="w-full py-3 rounded-full font-inter font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#D4880A', color: '#fff' }}>
                See My Matches <ArrowRight size={16} className="inline ml-1" />
              </button>
              <button
                onClick={() => {
                  const uid = getUserId();
                  if (!uid) return;
                  navigator.clipboard.writeText(`${window.location.origin}/athlete/${uid}`)
                    .then(() => toast.success('Profile link copied!'));
                }}
                className="w-full py-3 rounded-full font-inter font-semibold text-sm transition-all"
                style={{ border: '2px solid #6B5FA0', color: '#fff' }}>
                Share My Profile
              </button>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1C0A30' }}>
      {step !== 'auth' && step !== 'done' && step !== 'loading' && (
        <div className="px-6 pt-6">
          <div className="max-w-md mx-auto">
            <div className="w-full h-1.5 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: '#D4880A' }} />
            </div>
            <p className="font-inter text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Step {currentIdx + 1} of {totalSteps}
            </p>
          </div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center py-12 px-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25 }} className="w-full">
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
