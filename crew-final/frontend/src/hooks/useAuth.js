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
    // Fire-and-forget last_active update — don't await, don't block render
    supabase.from('profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', uid)
      .then(() => {});
    return existing;
  }
  // No profile row yet — create one
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
  const initialLoadDone = useRef(false);
  const profileFetchedForUid = useRef(null); // track which UID we last fetched profile for

  // ─── refreshProfile ───────────────────────────────────────────────────────
  // Always fetches fresh data from DB. Called externally (EditProfile, etc.)
  const refreshProfile = useCallback(async (uid) => {
    const targetUid = uid || profileFetchedForUid.current;
    if (!targetUid) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', targetUid).single();
    if (data) {
      setProfile(data);
      profileFetchedForUid.current = targetUid;
    }
  }, []);

  // ─── signOut ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    profileFetchedForUid.current = null;
    window.location.href = '/';
  }, []);

  // ─── Tab visibility handler ───────────────────────────────────────────────
  // When user returns to tab, silently refresh the profile if we have a session.
  // This fixes the "profile disappears after tab switch" bug without triggering
  // a loading state or re-mounting children.
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!profileFetchedForUid.current) return;

      // Silently re-fetch profile to ensure data is fresh
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileFetchedForUid.current)
        .single();
      if (data) setProfile(data);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ─── Main auth effect ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Step 1: Immediately hydrate from existing session (uses localStorage, fast)
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;

      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);

        // Only fetch profile if we haven't already for this UID
        if (profileFetchedForUid.current !== existingSession.user.id) {
          const p = await ensureProfile(existingSession.user.id, existingSession.user.email);
          if (mounted) {
            setProfile(p);
            profileFetchedForUid.current = existingSession.user.id;
          }
        }
      }

      if (mounted) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }).catch((err) => {
      console.warn('[useAuth] getSession error (lock conflict?):', err?.message);
      // Don't crash — let onAuthStateChange handle it
      if (mounted) {
        setTimeout(() => {
          if (mounted) {
            setLoading(false);
            initialLoadDone.current = true;
          }
        }, 500);
      }
    });

    // Step 2: Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        console.log('[useAuth] auth event:', event);

        if (event === 'TOKEN_REFRESHED') {
          // Session token rotated — update session reference but do NOT
          // re-fetch profile or change loading. Profile data is unchanged.
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          // Supabase fires this on startup. If initialLoadDone is already true
          // (getSession succeeded), ignore to avoid double work.
          if (initialLoadDone.current) return;

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user && profileFetchedForUid.current !== newSession.user.id) {
            const p = await ensureProfile(newSession.user.id, newSession.user.email);
            if (mounted) {
              setProfile(p);
              profileFetchedForUid.current = newSession.user.id;
            }
          }

          if (mounted) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        if (event === 'SIGNED_IN') {
          // Real sign-in (magic link click). Always fetch fresh profile.
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            const p = await ensureProfile(newSession.user.id, newSession.user.email);
            if (mounted) {
              setProfile(p);
              profileFetchedForUid.current = newSession.user.id;
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
          profileFetchedForUid.current = null;
          if (mounted && !initialLoadDone.current) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        // Any other event — update session, don't touch profile
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (mounted && !initialLoadDone.current) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    );

    // Safety net: 4s hard stop on loading spinner no matter what
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialLoadDone.current) {
        console.warn('[useAuth] safety timer fired — forcing loading=false');
        setLoading(false);
        initialLoadDone.current = true;
      }
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
