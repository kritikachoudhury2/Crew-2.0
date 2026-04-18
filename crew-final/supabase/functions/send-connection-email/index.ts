import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_SECRET = Deno.env.get('ACCEPT_TOKEN_SECRET')!;
const FROM_EMAIL = 'crew@crewbygrapelabs.in';
const APP_URL = 'https://www.crewbygrapelabs.in';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/accept-and-connect`;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(requestId: string, fromUserId: string, toUserId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${requestId}:${fromUserId}:${toUserId}:${expiresAt}`;
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return btoa(`${payload}:${sig}`);
}

function parseSports(sport: string | null): string {
  if (!sport) return '';
  try {
    const arr = JSON.parse(sport) as string[];
    return arr.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ');
  } catch { return sport; }
}

function sportBadgeHtml(sport: string): string {
  const map: Record<string, { bg: string; label: string }> = {
    hyrox: { bg: '#4A3D8F', label: 'HYROX' },
    marathon: { bg: '#D4880A', label: 'MARATHON' },
  };
  const b = map[sport.toLowerCase()] || { bg: '#4A3D8F', label: sport.toUpperCase() };
  return `<span style="display:inline-block;background:${b.bg};color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;margin-right:4px;">${b.label}</span>`;
}

function statRowHtml(label: string, value: string | null): string {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:11px;color:rgba(255,255,255,0.45);white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-size:12px;color:#fff;font-weight:500;">${value}</td>
    </tr>`;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record) return new Response('No record', { status: 400 });

    const { id: requestId, from_user_id, to_user_id } = record;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [{ data: fromProfile }, { data: toProfile }] = await Promise.all([
      supabase.from('profiles').select(
        'name, city, area, sport, level, bio, target_race, hyrox_category, hyrox_5k_time, hyrox_10k_time, hyrox_target_race, hyrox_race_goal, hyrox_training_days, marathon_distance, marathon_pace, marathon_5k_time, marathon_10k_time, marathon_target_race, marathon_goal, marathon_training_days, partner_goal, profile_views'
      ).eq('id', from_user_id).single(),
      supabase.from('profiles').select('name, email').eq('id', to_user_id).single(),
    ]);

    let recipientEmail = toProfile?.email;
    if (!recipientEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(to_user_id);
      recipientEmail = authUser?.user?.email;
    }
    if (!recipientEmail) return new Response('Recipient has no email', { status: 200 });

    const senderName = fromProfile?.name || 'Someone';
    const senderCity = fromProfile?.city || '';
    const senderArea = fromProfile?.area || '';
    const senderLocation = senderArea ? `${senderArea}, ${senderCity}` : senderCity;
    const senderSport = parseSports(fromProfile?.sport);

    const token = generateToken(requestId, from_user_id, to_user_id);
    const acceptUrl = `${EDGE_URL}?token=${encodeURIComponent(token)}`;

    let sportBadges = '';
    try {
      const sports = JSON.parse(fromProfile?.sport || '[]') as string[];
      sportBadges = sports.map(sportBadgeHtml).join('');
    } catch { sportBadges = senderSport ? sportBadgeHtml(senderSport) : ''; }

    let statsRows = '';
    const sports = (() => { try { return JSON.parse(fromProfile?.sport || '[]') as string[]; } catch { return [] as string[]; } })();

    if (sports.includes('hyrox')) {
      statsRows += statRowHtml('Category', fromProfile?.hyrox_category ? fromProfile.hyrox_category.replace('_', ' ').toUpperCase() : null);
      // a) Times shown as-is, no "mins" suffix
      statsRows += statRowHtml('5K Time', fromProfile?.hyrox_5k_time || null);
      statsRows += statRowHtml('10K Time', fromProfile?.hyrox_10k_time || null);
      statsRows += statRowHtml('Target Race', fromProfile?.hyrox_target_race || fromProfile?.target_race || null);
      statsRows += statRowHtml('Race Goal', fromProfile?.hyrox_race_goal || null);
      statsRows += statRowHtml('Training', fromProfile?.hyrox_training_days || fromProfile?.training_days || null);
    }
    if (sports.includes('marathon')) {
      statsRows += statRowHtml('Distance', fromProfile?.marathon_distance || null);
      statsRows += statRowHtml('Pace', fromProfile?.marathon_pace ? `${fromProfile.marathon_pace}/km` : null);
      // a) Times shown as-is, no "mins" suffix
      statsRows += statRowHtml('5K Time', fromProfile?.marathon_5k_time || null);
      statsRows += statRowHtml('10K Time', fromProfile?.marathon_10k_time || null);
      statsRows += statRowHtml('Target Race', fromProfile?.marathon_target_race || fromProfile?.target_race || null);
      statsRows += statRowHtml('Race Goal', fromProfile?.marathon_goal || null);
      statsRows += statRowHtml('Training', fromProfile?.marathon_training_days || fromProfile?.training_days || null);
    }
    if (!statsRows) statsRows += statRowHtml('Looking for', fromProfile?.partner_goal || null);

    const bioHtml = fromProfile?.bio
      ? `<p style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.6;margin:12px 0 0;font-style:italic;">"${fromProfile.bio}"</p>`
      : '';
    const levelBadge = fromProfile?.level
      ? `<span style="display:inline-block;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);font-size:10px;font-weight:500;padding:2px 8px;border-radius:999px;margin-left:4px;text-transform:capitalize;">${fromProfile.level}</span>`
      : '';

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;padding:16px;">
    <div style="background:#1C0A30;border-radius:20px;overflow:hidden;">
      <div style="padding:28px 32px 20px;">
        <div style="margin-bottom:20px;">
          <span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-1px;">CREW</span>
          <span style="font-size:11px;color:#6B5FA0;margin-left:8px;">by GrapeLabs <span style="color:#D4880A;">AI</span></span>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 4px;">You have a new connection request!</h2>
        <p style="font-size:13px;color:rgba(255,255,255,0.55);margin:0;">${senderName} wants to train with you on CREW.</p>
      </div>
      <div style="height:1px;background:rgba(74,61,143,0.25);margin:0 32px;"></div>
      <div style="padding:20px 32px 24px;">
        <div style="margin-bottom:8px;">
          <span style="font-size:18px;font-weight:700;color:#fff;">${senderName}</span>${levelBadge}
        </div>
        <div style="margin-bottom:6px;">${sportBadges}</div>
        ${senderLocation ? `<p style="font-size:12px;color:rgba(255,255,255,0.45);margin:0 0 12px;">📍 ${senderLocation}</p>` : ''}
        ${statsRows ? `<div style="background:rgba(74,61,143,0.15);border-radius:12px;padding:12px 16px;margin-bottom:12px;"><table style="border-collapse:collapse;width:100%;">${statsRows}</table></div>` : ''}
        ${bioHtml}
      </div>
      <div style="height:1px;background:rgba(74,61,143,0.25);margin:0 32px;"></div>
      <div style="padding:24px 32px 28px;">
        <p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 16px;">Accept to connect — WhatsApp will open immediately so you can start planning.</p>
        <div>
          <a href="${acceptUrl}" style="display:inline-block;background:#25D366;color:#fff;padding:13px 24px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;margin-right:8px;margin-bottom:8px;">Accept &amp; Connect Now</a>
          <a href="${APP_URL}/my-connections?tab=received" style="display:inline-block;background:transparent;color:#fff;padding:12px 24px;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;border:2px solid rgba(107,95,160,0.6);margin-bottom:8px;">View Full Profile on CREW</a>
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:12px 0 0;line-height:1.5;">The Accept link works for 7 days. After that, accept from My Connections in the app.<br>You are receiving this because you have a CREW account.</p>
      </div>
    </div>
  </div>
</body></html>`;

    const emailBody = {
      from: `CREW <${FROM_EMAIL}>`,
      to: [recipientEmail],
      subject: `${senderName} wants to train with you on CREW`,
      html: emailHtml,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody),
    });
    const data = await res.json();
    console.log('[send-connection-email] Resend response:', data);
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[send-connection-email] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
