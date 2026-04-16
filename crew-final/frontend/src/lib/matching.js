  export function parseSports(sport) {
  if (!sport) return [];
  const s = String(sport).trim();
  if (s.startsWith('[')) {
    try { return JSON.parse(s).map(x => String(x).toLowerCase().trim()); } catch {}
  }
  if (s.includes(',')) return s.split(',').map(x => x.toLowerCase().trim());
  return [s.toLowerCase().trim()];
}

const LEVEL_MAP = { rookie: 0, beginner: 0, intermediate: 1, advanced: 2, elite: 3, pro: 3 };

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Score breakdown (total possible = 100) ───────────────────────────────────
//
// TIER 1 — Must-haves (city + sport = 65 pts max)
//   Sport match:       30 pts   ← same sport is essential
//   Location:          35 pts   ← same city is the top factor
//     <5km:   35
//     <15km:  28
//     <50km:  18
//     same city (no GPS): 25
//     diff city: 0
//
// TIER 2 — Quality signals (35 pts max)
//   Same target race:  15 pts
//   Level proximity:   12 pts
//   Partner goal:       5 pts
//   Gender preference:  3 pts (soft — preferred gender scores higher)
//   HYROX category:     3 pts
//   Marathon pace:      2 pts
//
// Minimum to appear: 50 pts (enforced in FindAPartner filter)

export function calcMatchScore(viewer, candidate) {
  if (!viewer || !candidate) return 0;
  if (viewer.id && candidate.id && viewer.id === candidate.id) return -1;

  const vSports = parseSports(viewer.sport);
  const cSports = parseSports(candidate.sport);
  const sharedSports = vSports.filter(s => cSports.includes(s));

  let score = 0;

  // ── TIER 1: Sport (30 pts) ────────────────────────────────────────────────
  if (sharedSports.length > 0) {
    score += 30;
  } else {
    // No shared sport — hard cap. These profiles will be filtered at 50% threshold
    // but we still score them so the UI can show them if filters are relaxed.
    score += 0;
  }

  // ── TIER 1: Location (35 pts) ─────────────────────────────────────────────
  if (viewer.lat && viewer.lng && candidate.lat && candidate.lng) {
    const dist = haversineKm(viewer.lat, viewer.lng, candidate.lat, candidate.lng);
    if (dist < 5)        score += 35;
    else if (dist < 15)  score += 28;
    else if (dist < 50)  score += 18;
    else if (dist < 150) score += 8;
    else                 score += 0;
  } else if (viewer.city && candidate.city) {
    if (viewer.city.toLowerCase().trim() === candidate.city.toLowerCase().trim()) {
      score += 25; // same city, no GPS
    } else {
      score += 0; // different city — no location points
    }
  }

  // ── TIER 2: Target race (15 pts) ─────────────────────────────────────────
  if (viewer.target_race && candidate.target_race &&
    viewer.target_race.toLowerCase() === candidate.target_race.toLowerCase()) {
    score += 15;
  }
  // Sport-specific target race fields
  if (sharedSports.includes('hyrox')) {
    const vRace = viewer.hyrox_target_race || viewer.target_race;
    const cRace = candidate.hyrox_target_race || candidate.target_race;
    if (vRace && cRace && vRace.toLowerCase() === cRace.toLowerCase() && score < 100) {
      // Already counted above if target_race matched; only add if different field
      if (!(viewer.target_race && candidate.target_race &&
        viewer.target_race.toLowerCase() === candidate.target_race.toLowerCase())) {
        score += 15;
      }
    }
  }
  if (sharedSports.includes('marathon')) {
    const vRace = viewer.marathon_target_race || viewer.target_race;
    const cRace = candidate.marathon_target_race || candidate.target_race;
    if (vRace && cRace && vRace.toLowerCase() === cRace.toLowerCase() && score < 100) {
      if (!(viewer.target_race && candidate.target_race &&
        viewer.target_race.toLowerCase() === candidate.target_race.toLowerCase())) {
        score += 15;
      }
    }
  }

  // ── TIER 2: Level proximity (12 pts) ────────────────────────────────────
  if (viewer.level && candidate.level) {
    const vl = LEVEL_MAP[viewer.level.toLowerCase()] ?? 1;
    const cl = LEVEL_MAP[candidate.level.toLowerCase()] ?? 1;
    const diff = Math.abs(vl - cl);
    if (diff === 0)      score += 12;
    else if (diff === 1) score += 7;
    else                 score += 2;
  }

  // ── TIER 2: Partner goal (5 pts) ────────────────────────────────────────
  if (viewer.partner_goal && candidate.partner_goal) {
    score += viewer.partner_goal === candidate.partner_goal ? 5 : 1;
  }

  // ── TIER 2: Gender preference — SOFT score (3 pts) ──────────────────────
  // Only adds points if viewer's preference matches candidate's gender.
  // Does NOT remove profiles — just ranks preferred gender higher.
  if (viewer.partner_gender_pref && viewer.partner_gender_pref !== 'No preference') {
    const prefMap = { 'Men only': 'Male', 'Women only': 'Female' };
    const preferred = prefMap[viewer.partner_gender_pref];
    if (preferred && candidate.gender === preferred) {
      score += 3;
    }
    // No penalty for non-preferred gender — soft score only
  }

  // ── TIER 2: HYROX category match (3 pts) ─────────────────────────────────
  if (sharedSports.includes('hyrox') &&
    viewer.hyrox_category && candidate.hyrox_category &&
    viewer.hyrox_category === candidate.hyrox_category) {
    score += 3;
  }

  // ── TIER 2: Marathon pace match (2 pts) ──────────────────────────────────
  if (sharedSports.includes('marathon') && viewer.marathon_pace && candidate.marathon_pace) {
    try {
      const toSec = p => { const [m, s] = p.split(':').map(Number); return m * 60 + (s || 0); };
      const diff = Math.abs(toSec(viewer.marathon_pace) - toSec(candidate.marathon_pace));
      if (diff <= 30)      score += 2;
      else if (diff <= 60) score += 1;
    } catch {}
  }

  return Math.min(Math.round(score), 100);
}

export function getMatchLabel(score) {
  if (score >= 80) return 'Excellent match';
  if (score >= 65) return 'Strong match';
  if (score >= 50) return 'Good match';
  return 'Possible match';
}

export function getMatchCaveat(viewer, candidate) {
  const vSports = parseSports(viewer.sport);
  const cSports = parseSports(candidate.sport);
  const sharedSports = vSports.filter(s => cSports.includes(s));
  if (vSports.length === 0) return 'Complete your profile to see accurate matches';
  if (sharedSports.length === 0 && vSports.length > 0 && cSports.length > 0) {
    const names = cSports.map(s => s.charAt(0).toUpperCase() + s.slice(1));
    return `Trains for ${names.join(' & ')} — different sport`;
  }
  return null;
}

export function whyMatched(viewer, candidate) {
  if (!viewer || !candidate) return 'Athlete near you';
  const reasons = [];

  // Location
  if (viewer.lat && viewer.lng && candidate.lat && candidate.lng) {
    const dist = haversineKm(viewer.lat, viewer.lng, candidate.lat, candidate.lng);
    if (dist < 5) reasons.push('Very close to you');
    else if (dist < 15) reasons.push('Same area');
    else if (viewer.city && candidate.city &&
      viewer.city.toLowerCase() === candidate.city.toLowerCase()) reasons.push('Same city');
  } else if (viewer.city && candidate.city &&
    viewer.city.toLowerCase() === candidate.city.toLowerCase()) {
    reasons.push('Same city');
  }

  // Sport
  const shared = parseSports(viewer.sport).filter(s => parseSports(candidate.sport).includes(s));
  if (shared.length > 0) {
    reasons.push(`Both do ${shared.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ')}`);
  }

  // Race
  const vRace = viewer.hyrox_target_race || viewer.marathon_target_race || viewer.target_race;
  const cRace = candidate.hyrox_target_race || candidate.marathon_target_race || candidate.target_race;
  if (vRace && cRace && vRace.toLowerCase() === cRace.toLowerCase()) {
    reasons.push('Same target race');
  }

  // Level
  if (viewer.level && candidate.level) {
    const vl = LEVEL_MAP[viewer.level.toLowerCase()] ?? 1;
    const cl = LEVEL_MAP[candidate.level.toLowerCase()] ?? 1;
    if (Math.abs(vl - cl) === 0) reasons.push('Same level');
    else if (Math.abs(vl - cl) === 1) reasons.push('Similar level');
  }

  // HYROX category
  if (viewer.hyrox_category && candidate.hyrox_category &&
    viewer.hyrox_category === candidate.hyrox_category) {
    reasons.push(`Both racing ${viewer.hyrox_category}`);
  }

  return reasons.length === 0 ? 'Athlete near you' : reasons.slice(0, 3).join(' · ');
}
