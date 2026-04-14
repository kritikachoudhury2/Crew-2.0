import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let resolved = false;

    // With implicit flow, Supabase puts tokens in the URL hash like:
    // /auth/callback#access_token=...&token_type=bearer
    // It also puts errors there like:
    // /auth/callback#error=...&error_description=...
    // We must check for actual error parameters, NOT mistake token params for errors

    const hash = window.location.hash;

    // Only treat as error if hash explicitly contains error= param
    if (hash.includes('error=') && !hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const errDesc = params.get('error_description') || 'Sign-in link is invalid or has expired.';
      setError(errDesc.replace(/\+/g, ' '));
      return;
    }

    // Listen for SIGNED_IN event — Supabase JS client auto-processes the hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        resolved = true;
        subscription.unsubscribe();

        supabase.from('profiles').select('name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.name?.trim()) {
              navigate('/find-a-partner', { replace: true });
            } else {
              navigate('/get-started', { replace: true });
            }
          });
      }
    });

    // Fallback: if onAuthStateChange doesn't fire, try getSession directly
    const fallbackTimer = setTimeout(async () => {
      if (resolved) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        resolved = true;
        subscription.unsubscribe();
        const { data } = await supabase.from('profiles').select('name').eq('id', session.user.id).single();
        if (data?.name?.trim()) navigate('/find-a-partner', { replace: true });
        else navigate('/get-started', { replace: true });
      }
    }, 2000);

    // Timeout after 12s
    const timeout = setTimeout(() => {
      if (!resolved) {
        setError('Sign-in timed out. Please try again.');
        subscription.unsubscribe();
      }
    }, 12000);

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1C0A30', gap: 16, padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#ef4444' }}>✕</div>
        <p style={{ color: '#ef4444', fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          {error}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', fontSize: 13, textAlign: 'center' }}>
          Magic links expire after 1 hour. Request a new one to sign in.
        </p>
        <button
          onClick={() => window.location.href = '/get-started'}
          style={{ padding: '12px 28px', background: '#D4880A', color: '#fff', border: 'none', borderRadius: 999, fontFamily: 'Inter, sans-serif', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1C0A30', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #D4880A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Signing you in...</p>
    </div>
  );
}
