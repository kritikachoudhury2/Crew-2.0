import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null, user: null, profile: null, loading: true,
  refreshProfile: async () => {}, signOut: async () => {},
});

// ─── fetchProfile ─────────────────────────────────────────────────────────────
// Read-only. Never creates or modifies data.
async function fetchProfile(uid) {
  if (!uid) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('[useAuth] fetchProfile error:', error.message);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('[useAuth] fetchProfile exception:', err?.message);
    return null;
  }
}

// ─── ensureProfile ────────────────────────────────────────────────────────────
// Called only on first SIGNED_IN. Creates stub row if none exists.
async function ensureProfile(uid, email) {
  if (!uid) return null;
  const existing = await fetchProfile(uid);
  if (existing) return existing;

  try {
    const { data: created, error } = await supabase
      .from('profiles')
      .upsert(
        { id: uid, email: email || null, flagged: false, last_active: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return await fetchProfile(uid);
      console.error('[useAuth] ensureProfile error:', error.message);
      return await fetchProfile(uid);
    }
    return created || null;
  } catch (err) {
    console.error('[useAuth] ensureProfile exception:', err?.message);
    return await fetchProfile(uid);
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const currentUid = useRef(null);
  const profileLoadedForUid = useRef(null);

  const refreshProfile = useCallback(async () => {
    if (!currentUid.current) return;
    const data = await fetchProfile(currentUid.current);
    if (data) setProfile(data);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    currentUid.current = null;
    profileLoadedForUid.current = null;
    window.location.href = '/';
  }, []);

  // Silently re-fetch profile when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!currentUid.current) return;
      const data = await fetchProfile(currentUid.current);
      if (data) setProfile(data);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Register listener FIRST, then call getSession.
    // This way we never miss an event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        console.log('[useAuth] event:', event);

        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          // Skip if getSession() already completed first
          if (initialLoadDone.current) return;

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            const uid = newSession.user.id;
            currentUid.current = uid;
            const p = await fetchProfile(uid);
            if (mounted) {
              setProfile(p);
              profileLoadedForUid.current = uid;
            }
          }

          if (mounted) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        if (event === 'SIGNED_IN') {
          const uid = newSession?.user?.id;

          // Deduplicate: Supabase sometimes fires SIGNED_IN twice
          if (uid && uid === profileLoadedForUid.current && initialLoadDone.current) {
            setSession(newSession);
            return;
          }

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (uid) {
            currentUid.current = uid;
            const p = await ensureProfile(uid, newSession.user.email);
            if (mounted) {
              setProfile(p);
              profileLoadedForUid.current = uid;
            }
          }

          if (mounted && !initialLoadDone.current) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          currentUid.current = null;
          profileLoadedForUid.current = null;
          if (mounted && !initialLoadDone.current) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (mounted && !initialLoadDone.current) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    );

    // getSession as fast path — with lock bypassed this will never hang
    supabase.auth.getSession()
      .then(async ({ data: { session: existingSession } }) => {
        if (!mounted || initialLoadDone.current) return;

        if (existingSession?.user) {
          const uid = existingSession.user.id;
          setSession(existingSession);
          setUser(existingSession.user);
          currentUid.current = uid;

          // CRITICAL: fetchProfile only — never ensureProfile on refresh
          // ensureProfile has an upsert that can overwrite full profile with stub
          const p = await fetchProfile(uid);
          if (mounted) {
            setProfile(p);
            profileLoadedForUid.current = uid;
          }
        }

        if (mounted && !initialLoadDone.current) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      })
      .catch((err) => {
        console.warn('[useAuth] getSession error:', err?.message);
        // Don't set loading=false here — let INITIAL_SESSION handle it
      });

    // 5s absolute safety net
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialLoadDone.current) {
        console.warn('[useAuth] 5s safety timer fired');
        setLoading(false);
        initialLoadDone.current = true;
      }
    }, 5000);

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
