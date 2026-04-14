import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Camera, Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Goa', 'Chennai', 'Kolkata', 'Other'];

const parseArr = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return []; } };

function calcCompleteness(form) {
  const fields = [
    form.name, form.age, form.gender, form.city,
    form.sport?.length, form.level, form.partner_goal,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export default function EditProfile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        ...profile,
        sport: parseSportList(profile.sport),
        hyrox_strong: parseArr(profile.hyrox_strong),
        hyrox_weak: parseArr(profile.hyrox_weak),
      });
    }
  }, [profile]);

  function parseSportList(s) { try { return typeof s === 'string' ? JSON.parse(s) : s || []; } catch { return [s]; } }

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const cityValue = form.city === 'Other' ? (form.city_custom || 'Other') : form.city;

    const data = {
      id: user.id,
      name: form.name,
      age: form.age ? parseInt(form.age) : null,
      gender: form.gender,
      city: cityValue,
      area: form.area,
      bio: form.bio,
      sport: JSON.stringify(Array.isArray(form.sport) ? form.sport.filter(s => s !== 'ironman') : []),
      level: form.level,
      target_race: form.target_race,
      hyrox_category: form.hyrox_category,
      hyrox_strong: JSON.stringify(form.hyrox_strong || []),
      hyrox_weak: JSON.stringify(form.hyrox_weak || []),
      hyrox_5k_time: form.hyrox_5k_time,
      marathon_distance: form.marathon_distance,
      marathon_pace: form.marathon_pace,
      marathon_weekly_km: form.marathon_weekly_km,
      marathon_goal: form.marathon_goal,
      training_days: form.training_days,
      partner_goal: form.partner_goal,
      partner_level_pref: form.partner_level_pref,
      partner_gender_pref: form.partner_gender_pref,
      instagram: form.instagram,
      flagged: false,
      last_active: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(data, { onConflict: 'id' });
    if (error) {
      toast.error('Could not save your profile. Please try again.');
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
    toast.success('Profile saved!');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from('profile-images').upload(path, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from('profile-images').getPublicUrl(path);
    update('photo_url', publicUrl);
    await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', user.id);
    toast.success('Photo updated!');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    await supabase.from('profiles').delete().eq('id', user.id);
    await signOut();
    navigate('/');
  };

  const completeness = calcCompleteness(form);

  return (
    <div data-testid="edit-profile-page">
      <section className="py-14 md:py-24 px-6 md:px-12 min-h-screen" style={{ background: '#1C0A30' }}>
        <div className="max-w-lg mx-auto">
          <h1 className="font-inter font-[800] text-4xl text-white mb-2" style={{ letterSpacing: '-2px' }}>Edit Profile</h1>

          {/* Profile completeness */}
          <div className="rounded-[12px] p-4 mb-8 border" style={{ background: 'rgba(42,26,69,0.40)', borderColor: 'rgba(74,61,143,0.20)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-inter text-xs font-medium text-white">Profile completeness</p>
              <span className="font-inter font-bold text-sm" style={{ color: completeness >= 80 ? '#4ade80' : '#D4880A' }}>{completeness}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${completeness}%`, background: completeness >= 80 ? '#4ade80' : '#D4880A' }} />
            </div>
            {completeness < 80 && (
              <p className="font-inter text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Complete your profile to get better matches.
              </p>
            )}
          </div>

          {/* Photo */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center font-inter font-bold text-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #4A3D8F, #D4880A)' }}>
                  {(form.name || 'U')[0]?.toUpperCase()}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: '#D4880A' }}>
                <Camera size={14} className="text-white" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" data-testid="photo-upload" />
              </label>
            </div>
            <div>
              <p className="font-inter font-semibold text-white">{form.name || 'Your name'}</p>
              <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{user?.email}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="font-inter text-xs font-medium text-white block mb-1.5">Name *</label>
              <input type="text" value={form.name || ''} onChange={e => update('name', e.target.value)}
                className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">Age</label>
                <input type="number" value={form.age || ''} onChange={e => update('age', e.target.value)}
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-age" />
              </div>
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">Gender</label>
                <select value={form.gender || ''} onChange={e => update('gender', e.target.value)}
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-gender">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-inter text-xs font-medium text-white block mb-1.5">City</label>
              <select value={form.city || ''} onChange={e => update('city', e.target.value)}
                className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white outline-none"
                style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-city">
                <option value="">Select city</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.city === 'Other' && (
              <div>
                <label className="font-inter text-xs font-medium text-white block mb-1.5">Enter your city</label>
                <input type="text" value={form.city_custom || ''} onChange={e => update('city_custom', e.target.value)}
                  placeholder="e.g. Chandigarh"
                  className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                  style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} />
              </div>
            )}
            <div>
              <label className="font-inter text-xs font-medium text-white block mb-1.5">Area</label>
              <input type="text" value={form.area || ''} onChange={e => update('area', e.target.value)} placeholder="e.g. South Delhi"
                className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-area" />
            </div>
            <div>
              <label className="font-inter text-xs font-medium text-white block mb-1.5">Bio</label>
              <textarea value={form.bio || ''} onChange={e => update('bio', e.target.value.slice(0, 200))} rows={3} maxLength={200}
                className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none resize-none"
                style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-bio" />
              <p className="font-inter text-[11px] text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>{(form.bio || '').length}/200</p>
            </div>
            <div>
              <label className="font-inter text-xs font-medium text-white block mb-1.5">Instagram</label>
              <input type="text" value={form.instagram || ''} onChange={e => update('instagram', e.target.value)} placeholder="@handle"
                className="w-full px-4 py-3 rounded-[12px] font-inter text-sm text-white placeholder:text-gray-500 outline-none"
                style={{ background: 'rgba(42,26,69,0.60)', border: '1px solid rgba(74,61,143,0.30)' }} data-testid="edit-instagram" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full mt-8 py-3 rounded-pill font-inter font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: '#D4880A', color: '#fff' }} data-testid="save-profile-btn">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <div className="mt-12 pt-8 border-t" style={{ borderColor: 'rgba(74,61,143,0.20)' }}>
            <h3 className="font-inter font-semibold text-sm mb-3" style={{ color: '#ef4444' }}>Danger Zone</h3>
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)}
                className="px-4 py-2 rounded-pill font-inter text-xs font-medium flex items-center gap-2"
                style={{ border: '2px solid #ef4444', color: '#ef4444' }} data-testid="delete-account-btn">
                <Trash2 size={14} /> Delete Account
              </button>
            ) : (
              <div className="rounded-[12px] p-4 border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.30)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                  <p className="font-inter text-sm font-medium" style={{ color: '#ef4444' }}>This cannot be undone.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDeleteAccount}
                    className="px-4 py-2 rounded-pill font-inter text-xs font-bold"
                    style={{ background: '#ef4444', color: '#fff' }} data-testid="confirm-delete">
                    Yes, delete my account
                  </button>
                  <button onClick={() => setShowDelete(false)}
                    className="px-4 py-2 rounded-pill font-inter text-xs"
                    style={{ border: '2px solid rgba(74,61,143,0.30)', color: '#fff' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
