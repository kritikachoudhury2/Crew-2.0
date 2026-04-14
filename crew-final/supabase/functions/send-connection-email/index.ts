import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'onboarding@resend.dev';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record) return new Response('No record', { status: 400 });

    const { from_user_id, to_user_id } = record;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [{ data: fromProfile }, { data: toProfile }] = await Promise.all([
      supabase.from('profiles').select('name, city, sport, level').eq('id', from_user_id).single(),
      supabase.from('profiles').select('name, email').eq('id', to_user_id).single(),
    ]);

    if (!toProfile?.email) {
      return new Response('Recipient has no email', { status: 200 });
    }

    const senderName = fromProfile?.name || 'Someone';
    const senderCity = fromProfile?.city || '';
    const senderSport = fromProfile?.sport
      ? JSON.parse(fromProfile.sport).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ')
      : '';

    const emailBody = {
      from: `CREW <${FROM_EMAIL}>`,
      to: [toProfile.email],
      subject: `${senderName} wants to train with you on CREW`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #1C0A30; color: #fff; padding: 32px; border-radius: 16px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -1px;">CREW</span>
            <span style="font-size: 12px; color: #6B5FA0; margin-left: 8px;">by GrapeLabs <span style="color: #D4880A;">AI</span></span>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">You have a new connection request!</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 15px; margin-bottom: 24px;">
            <strong style="color: #fff;">${senderName}</strong>${senderCity ? ` from ${senderCity}` : ''}${senderSport ? ` (${senderSport})` : ''} wants to train with you.
          </p>
          <a href="https://crew-seven.vercel.app/my-connections"
            style="display: inline-block; background: #D4880A; color: #fff; padding: 12px 28px; border-radius: 999px; font-weight: 700; font-size: 14px; text-decoration: none;">
            View Request
          </a>
          <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 32px;">
            You are receiving this because you have a CREW account. Go to My Connections to accept or decline.
          </p>
        </div>
      `,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    const data = await res.json();
    console.log('[send-connection-email] Resend response:', data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-connection-email] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
