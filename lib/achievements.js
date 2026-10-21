'use strict';
// Trophy/achievement helpers: tier scoring and importing a game's achievement list from its public Steam page.

const TIER_POINTS = { bronze: 15, silver: 30, gold: 90, platinum: 300 };
const TIERS = Object.keys(TIER_POINTS);

// Rarer achievements are worth more, like trophy grades.
function tierFor(percent) {
  if (percent == null || Number.isNaN(percent)) return 'bronze';
  if (percent >= 30) return 'bronze';
  if (percent >= 10) return 'silver';
  return 'gold';
}

const decode = (s) => String(s)
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();

// Reads the achievement rows of steamcommunity.com/stats/<appid>/achievements.
function parseSteamAchievements(html) {
  const out = [];
  const rows = String(html).split(/<div class="achieveRow\b/).slice(1);
  for (const row of rows) {
    const name = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(row)?.[1];
    if (!name) continue;
    const desc = /<h5[^>]*>([\s\S]*?)<\/h5>/.exec(row)?.[1] || '';
    const icon = /<img[^>]+src="([^"]+)"/.exec(row)?.[1] || null;
    const pct = /achievePercent[^>]*>\s*([\d.,]+)\s*%/.exec(row)?.[1];
    const percent = pct ? Number(pct.replace(',', '.')) : null;
    out.push({ title: decode(name), description: decode(desc), icon, percent, tier: tierFor(percent) });
  }
  return out;
}

async function fetchSteamAchievements(appid, headers = {}) {
  const res = await fetch(`https://steamcommunity.com/stats/${appid}/achievements/?l=english`, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Steam returned ${res.status}`);
  const list = parseSteamAchievements(await res.text());
  if (!list.length) throw new Error('Steam lists no achievements for this game');
  return list;
}

function summarize(achievements) {
  const counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  const unlocked = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  let points = 0;
  for (const a of achievements) {
    counts[a.tier] = (counts[a.tier] || 0) + 1;
    if (a.unlockedAt) { unlocked[a.tier] = (unlocked[a.tier] || 0) + 1; points += TIER_POINTS[a.tier] || 0; }
  }
  const total = achievements.length;
  const done = achievements.filter((a) => a.unlockedAt).length;
  // Completing every trophy of a game with enough of them earns the platinum, as on the console.
  const platinumPossible = total >= 3;
  const platinum = platinumPossible && done === total;
  if (platinum) points += TIER_POINTS.platinum;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0, counts, unlocked, points, platinum, platinumPossible };
}

module.exports = { TIER_POINTS, TIERS, tierFor, parseSteamAchievements, fetchSteamAchievements, summarize };
