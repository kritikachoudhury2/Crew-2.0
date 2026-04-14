import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'onboarding@resend.dev';
const APP_URL = 'https://crew-seven.vercel.app';

function parseSports(sport) {
  if (!sport) return [];
  try { return JSON.parse(sport); } catch { return [sport]; }
}

function calcSimpleScore(a, b) {
  let score = 10;
  const aSports = parseSports(a.sport);
  const bSports = parseSports(b.sport);
  if (aSports.some(s => bSports.includes(s))) score += 30;
  if (a.city && a.city === b.city) score += 25;
  if (a.target_race && a.target_race === b.target_race) score += 15;
  if (a.level && a.level === b.level) score += 12;
  return Math.min(score, 100);
}

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data: activeProfiles, error } = await supabase
      .from('profiles')
      .select('*')
      .not('name', 'is', null)
      .not('email', 'is', null)
      .neq('flagged', true)
      .gte('last_active', sevenDaysAgo);

    if (error) throw error;
    if (!activeProfiles?.length) return new Response('No active profiles', { status: 200 });

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const profile of activeProfiles) {
      try {
        const { data: others } = await supabase
          .from('profiles')
          .select('id, name, city, sport, level, target_race, bio, hyrox_category, marathon_pace')
          .neq('id', profile.id)
          .neq('flagged', true)
          .not('name', 'is', null)
          .limit(50);

        if (!others?.length) continue;

        const scored = others
          .map(o => ({ ...o, score: calcSimpleScore(profile, o) }))
          .filter(o => o.score >= 40)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (!scored.length) continue;

        const matchCards = scored.map(m => {
          const sports = parseSports(m.sport).map(s => s.toUpperCase()).join(' & ');
          return `
            <div style="background: rgba(42,26,69,0.60); border: 1px solid rgba(74,61,143,0.30); border-radius: 16px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <strong style="color: #fff; font-size: 15px;">${m.name}</strong>
                <span style="color: #D4880A; font-weight: 700; font-size: 14px;">${m.score}% match</span>
              </div>
              <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0 0 4px;">
                ${m.city || ''}${sports ? ' · ' + sports : ''}${m.level ? ' · ' + m.level : ''}
              </p>
              ${m.bio ? `<p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 4px 0 12px;">${String(m.bio).slice(0, 80)}${String(m.bio).length > 80 ? '...' : ''}</p>` : ''}
              <a href="${APP_URL}/athlete/${m.id}"
                style="display: inline-block; background: #D4880A; color: #fff; padding: 8px 20px; border-radius: 999px; font-weight: 600; font-size: 12px; text-decoration: none;">
                View Profile
              </a>
            </div>
          `;
        }).join('');

        const emailBody = {
          from: `CREW <${FROM_EMAIL}>`,
          to: [profile.email],
          subject: `Your top matches this week on CREW`,
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #1C0A30; color: #fff; padding: 32px; border-radius: 16px;">
              <div style="margin-bottom: 24px;">
                <span style="font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -1px;">CREW</span>
                <span style="font-size: 12px; color: #6B5FA0; margin-left: 8px;">by GrapeLabs <span style="color: #D4880A;">AI</span></span>
              </div>
              <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">Your top matches this week</h2>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 24px;">
                Hey ${profile.name || 'there'}, here are your best matches based on your sport, city, and race goals.
              </p>
              ${matchCards}
              <a href="${APP_URL}/find-a-partner"
                style="display: inline-block; background: #4A3D8F; color: #fff; padding: 12px 28px; border-radius: 999px; font-weight: 700; font-size: 14px; text-decoration: none; margin-top: 8px;">
                See All Matches
              </a>
              <p style="color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 32px;">
                You are receiving this weekly digest from CREW.
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

        if (res.ok) emailsSent++;
        else emailsFailed++;

        await new Promise(r => setTimeout(r, 200));

      } catch (userErr) {
        console.error(`[weekly-matches-email] Error for ${profile.id}:`, userErr);
        emailsFailed++;
      }
    }

    console.log(`[weekly-matches-email] Sent: ${emailsSent}, Failed: ${emailsFailed}`);
    return new Response(JSON.stringify({ sent: emailsSent, failed: emailsFailed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[weekly-matches-email] Fatal error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
