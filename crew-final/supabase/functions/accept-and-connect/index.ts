import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_SECRET = Deno.env.get('ACCEPT_TOKEN_SECRET')!;
const APP_URL = 'https://www.crewbygrapelabs.in';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const WHATSAPP_MSG = encodeURIComponent(
  "Hey! I just accepted your connection request on CREW. Looks like we're training for similar goals — want to plan something?"
);

function htmlPage(title: string, message: string, subMessage: string, actionUrl?: string, actionLabel?: string): Response {
  const actionHtml = actionUrl ? `
    <a href="${actionUrl}"
      style="display:inline-block;background:#D4880A;color:#fff;padding:13px 28px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px;">
      ${actionLabel}
    </a>` : '';

  return new Response(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — CREW</title>
  <style>
    body { margin:0; background:#1C0A30; font-family:Inter,Arial,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; box-sizing:border-box; }
    .card { background:#2A1A45; border-radius:20px; padding:40px 32px; max-width:420px; width:100%; text-align:center; border:1px solid rgba(74,61,143,0.30); }
    .logo { font-size:28px; font-weight:800; color:#fff; letter-spacing:-1px; margin-bottom:4px; }
    .logo span { color:#D4880A; }
    .sub { font-size:11px; color:#6B5FA0; margin-bottom:28px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">CREW <span style="color:#6B5FA0;font-size:13px;font-weight:400;">by GrapeLabs</span> <span>AI</span></div>
    <div class="sub">Find your training partner</div>
    <p style="font-size:20px;font-weight:700;color:#fff;margin:0 0 12px;">${title}</p>
    <p style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;margin:0;">${message}</p>
    ${subMessage ? `<p style="font-size:12px;color:rgba(255,255,255,0.35);margin:12px 0 0;line-height:1.5;">${subMessage}</p>` : ''}
    ${actionHtml}
  </div>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function verifyToken(token: string): {
  valid: boolean;
  expired?: boolean;
  requestId?: string;
  fromUserId?: string;
  toUserId?: string;
} {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    // Format: requestId:fromUserId:toUserId:expiresAt:sig
    if (parts.length !== 5) return { valid: false };

    const [requestId, fromUserId, toUserId, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Verify signature
    const payload = `${requestId}:${fromUserId}:${toUserId}:${expiresAtStr}`;
    const expectedSig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) return { valid: false };

    // Check expiry
    if (Date.now() > expiresAt) return { valid: false, expired: true, requestId, fromUserId, toUserId };

    return { valid: true, requestId, fromUserId, toUserId };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return htmlPage(
      'Invalid Link',
      'This link is missing required information.',
      `Please accept from <a href="${APP_URL}/my-connections?tab=received" style="color:#D4880A;">My Connections</a> in the app.`
    );
  }

  const parsed = verifyToken(token);

  if (!parsed.valid && parsed.expired) {
    return htmlPage(
      'Link Expired',
      'This accept link has expired (links are valid for 7 days).',
      `The connection request is still waiting in your app — you can accept it there.`,
      `${APP_URL}/my-connections?tab=received`,
      'Accept in App →'
    );
  }

  if (!parsed.valid) {
    return htmlPage(
      'Invalid Link',
      'This link is invalid or has been tampered with.',
      `Please accept from <a href="${APP_URL}/my-connections?tab=received" style="color:#D4880A;">My Connections</a> in the app.`
    );
  }

  const { requestId, fromUserId, toUserId } = parsed;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Check the request still exists and is pending
  const { data: existingRequest, error: reqErr } = await supabase
    .from('connect_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId)
    .maybeSingle();

  if (reqErr || !existingRequest) {
    return htmlPage(
      'Request Not Found',
      'This connection request no longer exists — it may have been withdrawn.',
      `You can still find this athlete in <a href="${APP_URL}/find-a-partner" style="color:#D4880A;">Find a Partner</a>.`
    );
  }

  // 2. Already accepted — skip DB work, just open WhatsApp
  if (existingRequest.status === 'accepted') {
    const { data: fromProfile } = await supabase
      .from('profiles')
      .select('phone, name')
      .eq('id', fromUserId!)
      .single();

    const phone = (fromProfile?.phone || '').replace(/\D/g, '');
    if (phone) {
      return new Response(null, {
        status: 302,
        headers: { Location: `https://wa.me/${phone}?text=${WHATSAPP_MSG}` },
      });
    }
    return htmlPage(
      'Already Connected! 🎉',
      `You're already connected. Check My Connections to find their WhatsApp.`,
      '',
      `${APP_URL}/my-connections`,
      'Open My Connections →'
    );
  }

  // 3. Accept the request
  const { error: updateErr } = await supabase
    .from('connect_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  if (updateErr) {
    console.error('[accept-and-connect] update error:', updateErr.message);
    return htmlPage(
      'Something went wrong',
      'We could not accept this request. Please try from the app.',
      '',
      `${APP_URL}/my-connections?tab=received`,
      'Open My Connections →'
    );
  }

  // 4. Create match row (idempotent — ignore unique constraint violations)
  const { error: matchErr } = await supabase
    .from('matches')
    .insert({ user1_id: fromUserId, user2_id: toUserId });

  if (matchErr && matchErr.code !== '23505') {
    console.error('[accept-and-connect] match insert error:', matchErr.message);
    // Non-fatal — continue to WhatsApp anyway
  }

  // 5. Fetch requester's phone number
  const { data: fromProfile } = await supabase
    .from('profiles')
    .select('phone, name')
    .eq('id', fromUserId!)
    .single();

  const phone = (fromProfile?.phone || '').replace(/\D/g, '');
  const senderName = fromProfile?.name || 'your new training partner';

  if (phone) {
    // Redirect directly to WhatsApp — this is the main happy path
    return new Response(null, {
      status: 302,
      headers: { Location: `https://wa.me/${phone}?text=${WHATSAPP_MSG}` },
    });
  }

  // No phone number — show success with app link
  return htmlPage(
    'Connected! 🎉',
    `You're now connected with ${senderName}. They haven't added their phone number yet, so head to My Connections to follow up.`,
    '',
    `${APP_URL}/my-connections`,
    'Open My Connections →'
  );
});
