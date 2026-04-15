import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  // Track whether we've loaded the initial session — prevents resetting on TOKEN_REFRESHED
  const initialLoadDone = useRef(false);

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

    // Immediately hydrate from existing session — this is synchronous with localStorage
    // and does NOT acquire a Supabase lock, so it won't conflict with PostHog/rrweb
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);
        const p = await ensureProfile(existingSession.user.id, existingSession.user.email);
        if (mounted) setProfile(p);
      }
      if (mounted) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }).catch(() => {
      // Lock conflict on getSession — fall back, let onAuthStateChange handle it
      if (mounted) {
        setTimeout(() => {
          if (mounted) { setLoading(false); initialLoadDone.current = true; }
        }, 500);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // After first load, these events must NEVER reset loading or re-fetch profile
        // TOKEN_REFRESHED and INITIAL_SESSION both fire repeatedly and steal the lock
        if (initialLoadDone.current && (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          // Silently update session reference only — no profile fetch, no loading change
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        // SIGNED_IN fires when user clicks magic link — this is a real new session
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const p = await ensureProfile(newSession.user.id, newSession.user.email);
          if (mounted) setProfile(p);
        } else {
          if (event === 'SIGNED_OUT') {
            if (mounted) setProfile(null);
          }
        }

        if (mounted && !initialLoadDone.current) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    );

    // Safety net: stop spinner after 3s no matter what
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }, 3000);

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
