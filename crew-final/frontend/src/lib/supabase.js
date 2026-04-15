import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[CREW] Missing Supabase env vars.');
}

// ─── TRUE SINGLETON ───────────────────────────────────────────────────────────
// Store the client on window so that even if this module is evaluated
// multiple times (React hot reload, StrictMode double-invoke), only ONE
// Supabase client ever exists. Multiple clients = multiple lock contestants
// = "lock was stolen" errors on every refresh.
if (!window.__CREW_SUPABASE__) {
  window.__CREW_SUPABASE__ = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'implicit',
      // Unique storage key isolates our lock from PostHog and any other
      // libraries that might touch localStorage
      storageKey: 'crew-auth',
    },
  });
}

export const supabase = window.__CREW_SUPABASE__;
export default supabase;
