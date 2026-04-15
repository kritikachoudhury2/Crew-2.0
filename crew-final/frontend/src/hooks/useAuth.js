import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null, user: null, profile: null, loading: true,
  refreshProfile: async () => {}, signOut: async () => {},
});

// ─── fetchProfile ─────────────────────────────────────────────────────────────
// Simple read-only. Returns the full profile row if it exists.
// Safe to call any time — never creates or modifies data.
async function fetchProfile(uid) {
  if (!uid) return null;
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
}

// ─── ensureProfile ────────────────────────────────────────────────────────────
// Creates a stub profile row only if one doesn't exist yet.
// Only called on SIGNED_IN (first magic link click), not on refresh.
async function ensureProfile(uid, email) {
  if (!uid) return null;

  const existing = await fetchProfile(uid);
  if (existing) {
    // Update last_active fire-and-forget — don't block render
    supabase.from('profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', uid)
      .then(() => {});
    return existing;
  }

  // No row yet — create stub for brand new user
  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .upsert(
      { id: uid, email: email || null, flagged: false, last_active: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Race condition — row appeared between select and insert
      return await fetchProfile(uid);
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
  const currentUid = useRef(null);

  // ─── refreshProfile ──────────────────────────────────────────────────────────
  // Public — re-reads profile from DB. Called by EditProfile after saving.
  const refreshProfile = useCallback(async () => {
    const uid = currentUid.current;
    if (!uid) return;
    const data = await fetchProfile(uid);
    if (data) setProfile(data);
  }, []);

  // ─── signOut ──────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    currentUid.current = null;
    window.location.href = '/';
  }, []);

  // ─── Tab visibility — re-fetch profile when user returns to tab ───────────────
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

  // ─── Main auth effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Step 1: Immediate hydration from localStorage session (no network).
    // This is the PRIMARY path on every page refresh.
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;

      if (existingSession?.user) {
        const uid = existingSession.user.id;
        setSession(existingSession);
        setUser(existingSession.user);
        currentUid.current = uid;

        // KEY FIX: use fetchProfile (read-only) on refresh.
        // The profile row already has full data — we just need to read it.
        // Do NOT use ensureProfile here because it could return a stub row
        // before the full onboarding data has been written, and we'd cache
        // that stub in state.
        const p = await fetchProfile(uid);
        if (mounted) setProfile(p);
      }

      if (mounted) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }).catch((err) => {
      console.warn('[useAuth] getSession error:', err?.message);
      if (mounted) {
        setTimeout(() => {
          if (mounted) {
            setLoading(false);
            initialLoadDone.current = true;
          }
        }, 500);
      }
    });

    // Step 2: Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        console.log('[useAuth] event:', event);

        if (event === 'TOKEN_REFRESHED') {
          // Token silently rotated. Update session ref only.
          // Profile data is unchanged — do not re-fetch.
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          // Skip if getSession() already handled startup
          if (initialLoadDone.current) return;

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            const uid = newSession.user.id;
            currentUid.current = uid;
            const p = await fetchProfile(uid);
            if (mounted) setProfile(p);
          }

          if (mounted) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        if (event === 'SIGNED_IN') {
          // Real sign-in via magic link click.
          // Use ensureProfile because this may be a brand new user
          // with no profile row yet.
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            const uid = newSession.user.id;
            currentUid.current = uid;
            const p = await ensureProfile(uid, newSession.user.email);
            if (mounted) setProfile(p);
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
          if (mounted && !initialLoadDone.current) {
            setLoading(false);
            initialLoadDone.current = true;
          }
          return;
        }

        // Any other event
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (mounted && !initialLoadDone.current) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    );

    // Safety net: 4s hard stop on spinner
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialLoadDone.current) {
        console.warn('[useAuth] safety timer fired');
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
