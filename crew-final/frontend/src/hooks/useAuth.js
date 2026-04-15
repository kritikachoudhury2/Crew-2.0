import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null, user: null, profile: null, loading: true,
  refreshProfile: async () => {}, signOut: async () => {},
});

// ─── isLockError ──────────────────────────────────────────────────────────────
function isLockError(err) {
  return err?.message?.includes('lock') || err?.message?.includes('Lock');
}

// ─── fetchProfile ─────────────────────────────────────────────────────────────
// Read-only. Retries once on lock error. Never creates or modifies data.
async function fetchProfile(uid) {
  if (!uid) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 300));
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null; // no row found
        if (isLockError(error) && attempt === 0) continue; // retry
        console.error('[useAuth] fetchProfile error:', error.message);
        return null;
      }
      return data || null;
    } catch (err) {
      if (isLockError(err) && attempt === 0) continue;
      console.error('[useAuth] fetchProfile exception:', err?.message);
      return null;
    }
  }
  return null;
}

// ─── ensureProfile ────────────────────────────────────────────────────────────
// Only called on first SIGNED_IN. Creates stub row if none exists.
async function ensureProfile(uid, email) {
  if (!uid) return null;

  const existing = await fetchProfile(uid);
  if (existing) return existing;

  // Small delay before insert to let any lock contention settle
  await new Promise(r => setTimeout(r, 200));

  try {
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .upsert(
        { id: uid, email: email || null, flagged: false, last_active: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') return await fetchProfile(uid);
      console.error('[useAuth] ensureProfile insert error:', insertErr.message);
      // Don't return null — try one more fetchProfile in case row exists
      return await fetchProfile(uid);
    }
    return created || null;
  } catch (err) {
    console.error('[useAuth] ensureProfile exception:', err?.message);
    return await fetchProfile(uid);
  }
}

// ─── getSessionSafe ───────────────────────────────────────────────────────────
// getSession() with a 3s timeout. If the Web Locks API steals the lock,
// this won't hang the app forever.
async function getSessionSafe() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn('[useAuth] getSession timed out');
      resolve(null);
    }, 3000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timer);
        resolve(session);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn('[useAuth] getSession error:', err?.message);
        resolve(null);
      });
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const currentUid = useRef(null);
  const profileLoadedRef = useRef(false);

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
    profileLoadedRef.current = false;
    window.location.href = '/';
  }, []);

  // Re-fetch profile silently on tab focus
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

    // ── Register onAuthStateChange FIRST so we never miss an event ────────
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
          if (initialLoadDone.current) return;

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user && !profileLoadedRef.current) {
            const uid = newSession.user.id;
            currentUid.current = uid;
            const p = await fetchProfile(uid);
            if (mounted) {
              setProfile(p);
              profileLoadedRef.current = true;
            }
          }

          if (mounted) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        if (event === 'SIGNED_IN') {
          // Guard against duplicate SIGNED_IN fires (Supabase JS library quirk)
          if (initialLoadDone.current && currentUid.current === newSession?.user?.id && profileLoadedRef.current) {
            setSession(newSession);
            return;
          }

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            const uid = newSession.user.id;
            currentUid.current = uid;
            const p = await ensureProfile(uid, newSession.user.email);
            if (mounted) {
              setProfile(p);
              profileLoadedRef.current = true;
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
          profileLoadedRef.current = false;
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

    // ── getSession as fast path — runs in parallel with onAuthStateChange ─
    getSessionSafe().then(async (existingSession) => {
      if (!mounted) return;
      if (initialLoadDone.current) return;

      if (existingSession?.user) {
        const uid = existingSession.user.id;
        setSession(existingSession);
        setUser(existingSession.user);
        currentUid.current = uid;

        // fetchProfile only — read-only, never overwrites data
        const p = await fetchProfile(uid);
        if (mounted) {
          setProfile(p);
          profileLoadedRef.current = true;
        }
      }

      if (mounted && !initialLoadDone.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
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
