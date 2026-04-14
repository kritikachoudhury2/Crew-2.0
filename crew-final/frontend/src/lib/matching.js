export function parseSports(sport) {
  if (!sport) return [];
  const s = String(sport).trim();
  if (s.startsWith('[')) {
    try { return JSON.parse(s).map(x => String(x).toLowerCase().trim()); } catch {}
  }
  if (s.includes(',')) return s.split(',').map(x => x.toLowerCase().trim());
  return [s.toLowerCase().trim()];
}

function parseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  const s = String(val).trim();
  if (s.startsWith('[')) { try { return JSON.parse(s); } catch {} }
  return s.split(',').map(x => x.trim());
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

export function calcMatchScore(viewer, candidate) {
  if (!viewer || !candidate) return 0;
  if (viewer.id && candidate.id && viewer.id === candidate.id) return -1;

  const vSports = parseSports(viewer.sport);
  const cSports = parseSports(candidate.sport);

  // Base — everyone sees at least 15 so no one gets 0
  let score = 15;

  // Sport match — highest weight
  const sharedSports = vSports.filter(s => cSports.includes(s));
  if (sharedSports.length > 0) score += 30;
  else if (vSports.length === 0 || cSports.length === 0) score += 8;

  // Location
  if (viewer.lat && viewer.lng && candidate.lat && candidate.lng) {
    const dist = haversineKm(viewer.lat, viewer.lng, candidate.lat, candidate.lng);
    if (dist < 5) score += 25;
    else if (dist < 15) score += 20;
    else if (dist < 50) score += 12;
    else score += 5;
  } else if (viewer.city && candidate.city) {
    if (viewer.city.toLowerCase().trim() === candidate.city.toLowerCase().trim()) score += 20;
    else score += 5;
  }

  // Target race
  if (viewer.target_race && candidate.target_race &&
    viewer.target_race.toLowerCase() === candidate.target_race.toLowerCase()) score += 15;

  // Level
  if (viewer.level && candidate.level) {
    const vl = LEVEL_MAP[viewer.level.toLowerCase()] ?? 1;
    const cl = LEVEL_MAP[candidate.level.toLowerCase()] ?? 1;
    const diff = Math.abs(vl - cl);
    if (diff === 0) score += 12;
    else if (diff === 1) score += 8;
    else score += 3;
  }

  // Partner goal
  if (viewer.partner_goal && candidate.partner_goal)
    score += viewer.partner_goal === candidate.partner_goal ? 8 : 3;

  // Hyrox category bonus
  if (sharedSports.includes('hyrox') && viewer.hyrox_category &&
    candidate.hyrox_category && viewer.hyrox_category === candidate.hyrox_category) score += 5;

  // Marathon pace bonus — within 30s/km
  if (sharedSports.includes('marathon') && viewer.marathon_pace && candidate.marathon_pace) {
    try {
      const toSec = p => { const [m, s] = p.split(':').map(Number); return m * 60 + (s || 0); };
      const diff = Math.abs(toSec(viewer.marathon_pace) - toSec(candidate.marathon_pace));
      if (diff <= 30) score += 5;
      else if (diff <= 60) score += 2;
    } catch {}
  }

  return Math.min(score, 100);
}

export function getMatchLabel(score) {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Possible match';
  return 'Nearby athlete';
}

export function getMatchCaveat(viewer, candidate) {
  const vSports = parseSports(viewer.sport);
  const cSports = parseSports(candidate.sport);
  const sharedSports = vSports.filter(s => cSports.includes(s));
  if (vSports.length === 0) return 'Complete your profile to see accurate matches';
  if (sharedSports.length === 0 && vSports.length > 0 && cSports.length > 0) {
    const names = cSports.map(s => s.charAt(0).toUpperCase() + s.slice(1));
    return `Trains for ${names.join(' & ')} — different sport but nearby`;
  }
  return null;
}

export function whyMatched(viewer, candidate) {
  if (!viewer || !candidate) return 'Athlete near you';
  const reasons = [];
  if (viewer.lat && viewer.lng && candidate.lat && candidate.lng) {
    const dist = haversineKm(viewer.lat, viewer.lng, candidate.lat, candidate.lng);
    if (dist < 5) reasons.push('Very close to you');
    else if (dist < 15) reasons.push('Same area');
    else if (viewer.city && candidate.city && viewer.city.toLowerCase() === candidate.city.toLowerCase())
      reasons.push('Same city');
  } else if (viewer.city && candidate.city && viewer.city.toLowerCase() === candidate.city.toLowerCase()) {
    reasons.push('Same city');
  }
  const shared = parseSports(viewer.sport).filter(s => parseSports(candidate.sport).includes(s));
  if (shared.length > 0) reasons.push(`Both do ${shared.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ')}`);
  if (viewer.target_race && candidate.target_race &&
    viewer.target_race.toLowerCase() === candidate.target_race.toLowerCase())
    reasons.push('Same target race');
  if (viewer.level && candidate.level) {
    const vl = LEVEL_MAP[viewer.level.toLowerCase()] ?? 1;
    const cl = LEVEL_MAP[candidate.level.toLowerCase()] ?? 1;
    if (Math.abs(vl - cl) === 0) reasons.push('Same level');
    else if (Math.abs(vl - cl) === 1) reasons.push('Similar level');
  }
  if (viewer.hyrox_category && candidate.hyrox_category && viewer.hyrox_category === candidate.hyrox_category)
    reasons.push(`Both racing ${viewer.hyrox_category}`);
  return reasons.length === 0 ? 'Athlete near you' : reasons.slice(0, 3).join(' · ');
}
