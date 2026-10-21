'use strict';
// Playtime statistics. Pure functions over { id, name, sessions: [{ start, end }], bonusMs?, launches? }.
// Days and hours are local time, so a session is split at local midnights and hour boundaries.

const DAY_MS = 86400000;
const HEAT_DAYS = 371; // 53 weeks, enough for a full-year calendar heat map

const dayStart = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Calls fn(segmentStart, segmentMs) for each part of [start, end) that falls on one local day.
function eachDay(start, end, fn) {
  let cur = start;
  while (cur < end) {
    const next = addDays(dayStart(cur), 1);
    const stop = Math.min(end, next);
    fn(cur, stop - cur);
    cur = stop;
  }
}

function eachHour(start, end, fn) {
  let cur = start;
  while (cur < end) {
    const d = new Date(cur);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const stop = Math.min(end, Math.max(next, cur + 1));
    fn(d.getHours(), stop - cur);
    cur = stop;
  }
}

function streaks(daySet, today) {
  const days = [...daySet].sort((a, b) => a - b);
  let longest = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  // The streak is still alive if the player has played today or yesterday.
  let current = 0;
  let d = daySet.has(today) ? today : addDays(today, -1);
  while (daySet.has(d)) { current++; d = addDays(d, -1); }
  return { current, longest };
}

function weekStartOf(ts, weekStartsOn) {
  const d = new Date(dayStart(ts));
  const diff = weekStartsOn === 'sun' ? d.getDay() : (d.getDay() + 6) % 7;
  return addDays(d.getTime(), -diff);
}

// Rolls a list of { gameId, start, end } entries up into the numbers the Stats screen needs.
function aggregate(entries, now, { weekStartsOn = 'mon' } = {}) {
  const today = dayStart(now);
  const heatStart = addDays(today, -(HEAT_DAYS - 1));
  const daily = new Array(HEAT_DAYS).fill(0);
  const dayTotals = new Map();
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const months = new Map();
  let total = 0, longest = null, first = null, last = null;

  for (const e of entries) {
    const ms = e.end - e.start;
    if (ms <= 0) continue;
    total += ms;
    if (!longest || ms > longest.ms) longest = { ms, gameId: e.gameId, start: e.start };
    if (first === null || e.start < first) first = e.start;
    if (last === null || e.end > last) last = e.end;
    eachDay(e.start, e.end, (at, seg) => {
      const ds = dayStart(at);
      dayTotals.set(ds, (dayTotals.get(ds) || 0) + seg);
      weekdays[new Date(at).getDay()] += seg;
      const mk = dayKey(ds).slice(0, 7);
      months.set(mk, (months.get(mk) || 0) + seg);
      if (ds >= heatStart) daily[Math.round((ds - heatStart) / DAY_MS)] += seg;
    });
    eachHour(e.start, e.end, (h, seg) => { hours[h] += seg; });
  }

  const sumDays = (from, to) => { let s = 0; for (const [d, ms] of dayTotals) if (d >= from && d <= to) s += ms; return s; };
  const thisWeek = weekStartOf(now, weekStartsOn);
  const thisMonthKey = dayKey(today).slice(0, 7);
  const lastMonth = new Date(today); lastMonth.setDate(1); lastMonth.setMonth(lastMonth.getMonth() - 1);
  let busiest = null;
  for (const [d, ms] of dayTotals) if (!busiest || ms > busiest.ms) busiest = { ms, date: dayKey(d) };

  const monthSeries = [];
  const m = new Date(today); m.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(m.getFullYear(), m.getMonth() - i, 1);
    const k = dayKey(d.getTime()).slice(0, 7);
    monthSeries.push({ month: k, ms: months.get(k) || 0 });
  }
  const activeDays = dayTotals.size;

  return {
    totalMs: total,
    sessions: entries.length,
    avgSessionMs: entries.length ? total / entries.length : 0,
    longest,
    firstPlayed: first,
    lastPlayed: last,
    activeDays,
    avgActiveDayMs: activeDays ? total / activeDays : 0,
    busiestDay: busiest,
    heatStart,
    daily,
    hours,
    weekdays,
    months: monthSeries,
    streak: streaks(new Set(dayTotals.keys()), today),
    periods: {
      today: sumDays(today, today),
      last7: sumDays(addDays(today, -6), today),
      prev7: sumDays(addDays(today, -13), addDays(today, -7)),
      last30: sumDays(addDays(today, -29), today),
      prev30: sumDays(addDays(today, -59), addDays(today, -30)),
      last365: sumDays(addDays(today, -364), today),
      thisWeek: sumDays(thisWeek, today),
      lastWeek: sumDays(addDays(thisWeek, -7), addDays(thisWeek, -1)),
      thisMonth: [...months].filter(([k]) => k === thisMonthKey).reduce((a, [, v]) => a + v, 0),
      lastMonth: months.get(dayKey(lastMonth.getTime()).slice(0, 7)) || 0,
    },
  };
}

function entriesOf(games, onlyIds) {
  const out = [];
  for (const g of games) {
    if (onlyIds && !onlyIds.has(g.id)) continue;
    for (const s of g.sessions) out.push({ gameId: g.id, start: s.start, end: s.end });
  }
  return out;
}

// Per-game play totals inside the last `days` days (all time when days is null).
function perGame(games, now, days) {
  const from = days ? addDays(dayStart(now), -(days - 1)) : -Infinity;
  const rows = [];
  for (const g of games) {
    let ms = 0, sessions = 0, lastPlayed = null;
    for (const s of g.sessions) {
      if (s.end <= from) continue;
      ms += Math.min(s.end, Infinity) - Math.max(s.start, from);
      sessions++;
      if (lastPlayed === null || s.end > lastPlayed) lastPlayed = s.end;
    }
    const bonus = days ? 0 : g.bonusMs || 0;
    if (ms + bonus > 0) rows.push({ id: g.id, name: g.name, ms: ms + bonus, sessions, lastPlayed });
  }
  rows.sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((a, r) => a + r.ms, 0);
  return rows.map((r) => ({ ...r, share: total ? r.ms / total : 0 }));
}

function libraryStats(games, now, opts = {}) {
  const agg = aggregate(entriesOf(games), now, opts);
  const importedMs = games.reduce((a, g) => a + (g.bonusMs || 0), 0);
  const recent = [];
  for (const g of games) for (const s of g.sessions.slice(-12)) recent.push({ gameId: g.id, name: g.name, start: s.start, end: s.end });
  recent.sort((a, b) => b.end - a.end);
  const names = new Map(games.map((g) => [g.id, g.name]));
  return {
    ...agg,
    importedMs,
    allTimeMs: agg.totalMs + importedMs,
    longest: agg.longest && { ...agg.longest, name: names.get(agg.longest.gameId) || null },
    topAll: perGame(games, now, null).slice(0, 12),
    top7: perGame(games, now, 7).slice(0, 8),
    top30: perGame(games, now, 30).slice(0, 8),
    top365: perGame(games, now, 365).slice(0, 8),
    recent: recent.slice(0, 15),
    gamesPlayed: games.filter((g) => g.sessions.length || g.bonusMs).length,
    gamesTotal: games.length,
  };
}

function gameStats(game, libraryTotalMs, now, opts = {}) {
  const agg = aggregate(entriesOf([game]), now, opts);
  const recent = game.sessions.slice(-40).reverse().map((s) => ({ start: s.start, end: s.end }));
  const bonus = game.bonusMs || 0;
  return {
    ...agg,
    id: game.id,
    importedMs: bonus,
    allTimeMs: agg.totalMs + bonus,
    shareOfLibrary: libraryTotalMs ? (agg.totalMs + bonus) / libraryTotalMs : 0,
    launches: game.launches || 0,
    recent,
  };
}

module.exports = { aggregate, libraryStats, gameStats, perGame, dayStart, addDays, dayKey, HEAT_DAYS };
