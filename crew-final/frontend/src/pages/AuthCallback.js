import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let resolved = false;

    // Check for error in URL hash (expired/invalid link)
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const errDesc = params.get('error_description') || 'Sign-in link is invalid or has expired.';
      setError(errDesc.replace(/\+/g, ' '));
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        resolved = true;
        subscription.unsubscribe();
        supabase.from('profiles').select('name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.name?.trim()) navigate('/find-a-partner', { replace: true });
            else navigate('/get-started', { replace: true });
          });
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        setError('Sign-in link has expired. Please request a new one.');
        subscription.unsubscribe();
      }
    }, 10000);

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1C0A30', gap: 16, padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✕</div>
        <p style={{ color: '#ef4444', fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          {error}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', fontSize: 13, textAlign: 'center' }}>
          Magic links expire after 1 hour. Request a new one to sign in.
        </p>
        <button
          onClick={() => window.location.href = '/get-started'}
          style={{ padding: '12px 28px', background: '#D4880A', color: '#fff', border: 'none', borderRadius: 999, fontFamily: 'Inter, sans-serif', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
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
