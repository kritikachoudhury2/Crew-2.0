import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[CREW] Missing Supabase env vars. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel settings.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'implicit',
    // Explicit storage key prevents lock conflicts when multiple Supabase
    // instances (e.g. PostHog, other scripts) share the same localStorage namespace
    storageKey: 'crew-supabase-auth',
  },
});

export default supabase;

