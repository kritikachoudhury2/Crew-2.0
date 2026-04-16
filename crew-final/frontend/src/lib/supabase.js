import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[CREW] Missing Supabase env vars.');
}

// ─── No-op lock implementation ────────────────────────────────────────────────
// Supabase JS v2 uses the Web Locks API (navigator.locks) to serialize
// auth token refreshes across tabs. In our app this causes "lock stolen"
// errors because PostHog and other scripts compete for the same lock.
//
// This no-op implementation lets each acquire call succeed immediately —
// there is no cross-tab serialization, but for a single-tab SPA this is
// fine. Token refreshes are handled by autoRefreshToken internally anyway.
const noopLock = async (name, acquireOptions, fn) => {
  // Just call fn immediately without acquiring any lock
  return await fn(null);
};

// ─── TRUE SINGLETON ───────────────────────────────────────────────────────────
// Stored on window so React hot-reloads and StrictMode double-invocations
// never create a second client instance.
if (!window.__CREW_SUPABASE__) {
  window.__CREW_SUPABASE__ = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'implicit',
      storageKey: 'crew-auth',
      // Bypass Web Locks entirely — no lock contention possible
      lock: noopLock,
    },
  });
}

export const supabase = window.__CREW_SUPABASE__;
export default supabase;
