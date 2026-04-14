import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null, user: null, profile: null, loading: true,
  refreshProfile: async () => {}, signOut: async () => {},
});

async function ensureProfile(uid, email) {
  if (!uid) return null;
  const { data: existing, error: fetchErr } = await supabase
    .from('profiles').select('*').eq('id', uid).single();
  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('[useAuth] fetchProfile error:', fetchErr.message);
    return null;
  }
  if (existing) {
    await supabase.from('profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', uid);
    return { ...existing, last_active: new Date().toISOString() };
  }
  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .upsert(
      { id: uid, email: email || null, flagged: false, last_active: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select().single();
  if (insertErr) {
    if (insertErr.code === '23505') {
      const { data: retry } = await supabase.from('profiles').select('*').eq('id', uid).single();
      return retry || null;
    }
    console.error('[useAuth] ensureProfile insert error:', insertErr.message);
    return null;
  }
  return created || null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id || user?.id;
    if (!uid) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) setProfile(data);
  }, [session, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null); setUser(null); setProfile(null);
    window.location.href = '/';
  }, []);

  useEffect(() => {
    let mounted = true;

    // CRITICAL FIX: remove getSession() entirely.
    // onAuthStateChange fires INITIAL_SESSION immediately on mount with
    // the current session — so getSession is redundant AND causes the
    // Web Lock conflict that freezes "Saving..." and drops profiles on navigation.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          const p = await ensureProfile(newSession.user.id, newSession.user.email);
          if (mounted) setProfile(p);
        } else {
          if (mounted) setProfile(null);
        }
        if (mounted) setLoading(false);
      }
    );

    // Safety net: stop spinner after 4s even if event never fires
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
