'use strict';

/* ======================= Helpers ======================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const sum = (list) => list.reduce((a, b) => a + b, 0);
const DAY_MS = 86400000;
const EXPLORE_ID = '__explore';
const LIBRARY_ID = '__library';
const ADD_ID = '__add';
const IMAGE_KINDS = ['cover', 'background', 'logo'];
const KIND_LABEL = { cover: 'Cover', background: 'Background', logo: 'Logo' };

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.8a7 7 0 0 1 0 2l2 1.8-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6a7 7 0 0 1-1.7-.9l-2.5.9-1.7-2.9 2-1.8a7 7 0 0 1 0-2l-2-1.8 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" transform="translate(0 1)"/></svg>',
  explore: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.3 37.5A22 22 0 1 1 24.7 49.9"/><path d="M43 21 34.2 41.6 31.7 32.3 22.4 29.8Z"/><path d="M26.5 38.5 15.5 49.5M21 35.5 11.5 45"/></svg>',
  library: '<svg viewBox="0 0 26 24" fill="currentColor"><rect x="1" y="2" width="5.5" height="5.5" rx="1.2"/><rect x="8.5" y="2" width="5.5" height="5.5" rx="1.2"/><rect x="16" y="2" width="5.5" height="5.5" rx="1.2"/><rect x="1" y="9.5" width="5.5" height="5.5" rx="1.2"/><path d="M12.6 11h8.8a2.6 2.6 0 0 1 2.5 1.9l1 3.8c.5 2-1.8 3.4-3.3 2.1L19.8 17h-5.6l-1.8 1.8c-1.5 1.3-3.8-.1-3.3-2.1l1-3.8a2.6 2.6 0 0 1 2.5-1.9z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  stopwatch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.8h4M18.5 6.5l1.3-1.3"/></svg>',
  storage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M11 14h6"/></svg>',
  pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20v-8M10 20V5M15 20v-6M20 20V9"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.2l6.1-.8z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6.5h8c2 0 3.4 1.2 3.9 3.2l1.3 5.4c.5 2.1-1.9 3.6-3.5 2.2l-1.8-1.7H8.1l-1.8 1.7c-1.6 1.4-4-.1-3.5-2.2l1.3-5.4C4.6 7.7 6 6.5 8 6.5z"/><path d="M8.5 9.6v3M7 11.1h3"/><path d="M15.6 10.1h.01M17.4 11.9h.01" stroke-width="2.4"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M9.8 10h.01M13.1 10h.01M16.4 10h.01M6.5 13.6h.01M17.5 13.6h.01" stroke-width="2.2"/><path d="M9.5 14h5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.2l6.1-.8z"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M5 3.5h10l4 4V20.5H5z"/><path d="M15 3.5v4h4M8.5 12h7M8.5 15.5h7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 1.2.8 2 1.700 2.200C10.200 8 11 5.500 12 3z"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.500h16M7 16v-5M12 16V6M17 16v-8"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  window: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.500h18"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.500c5 0 6 10 11 10H21M3 17h3.500c1.700 0 2.900-1 3.900-2.300M14 8.300C14.900 7.500 16 7 17.500 7H21M18.500 4.500 21 7l-2.500 2.500M18.500 14.500 21 17l-2.500 2.500"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 5 13.500h5.500L9.500 22 19 10h-6z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.600 5.400A16.500 16.500 0 0 0 15.500 4l-.5 1a15 15 0 0 0-6 0l-.5-1a16.500 16.500 0 0 0-4.100 1.400C1.800 9.400 1.100 13.300 1.400 17.100a16.600 16.600 0 0 0 5 2.500l1.100-1.800c-.6-.2-1.200-.5-1.700-.9l.4-.3a11.900 11.900 0 0 0 11.600 0l.4.300c-.5.400-1.100.7-1.700.9l1.100 1.800a16.500 16.500 0 0 0 5-2.500c.4-4.400-.7-8.300-3-11.700zM8.700 14.800c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2zm6.600 0c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2z"/></svg>',
  wallpaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 14l5-4 5 4 3-2 5 4M8 21h8"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10v6a5 5 0 0 1-3.500 4.800V16H16v2H8v-2h2.500v-2.200A5 5 0 0 1 7 9z"/><path d="M7 5H3.500v1.500A3.500 3.500 0 0 0 7 10zM17 5h3.500v1.500A3.500 3.500 0 0 1 17 10zM8 19.500h8V21H8z"/></svg>',
};

const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };
const STATUS_LABEL = { '': 'No status', backlog: 'Backlog', playing: 'Playing', completed: 'Completed', dropped: 'Dropped', hold: 'On hold' };
const tierIcon = (tier, cls = '') => `<span class="tier tier--${tier} ${cls}" title="${TIER_LABEL[tier] || ''}">${ICON.cup}</span>`;

function fmtBytes(b) {
  if (b == null || !isFinite(b)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 || b >= 100 ? 0 : 1)} ${u[i]}`;
}
function splitDuration(ms) {
  const min = ms / 60000;
  if (min < 60) { const m = Math.round(min); return { value: String(m), unit: m === 1 ? 'minute' : 'minutes' }; }
  const h = ms / 3600000;
  return { value: h >= 100 ? Math.round(h).toLocaleString() : h.toFixed(1), unit: 'hours' };
}
const fmtDuration = (ms) => { const d = splitDuration(ms); return `${d.value} ${d.unit.startsWith('minute') ? 'min' : 'hrs'}`; };
const fmtShort = (ms) => (ms < 3600000 ? `${Math.round(ms / 60000)}m` : `${(ms / 3600000).toFixed(ms >= 360000000 ? 0 : 1)}h`);
const fmtElapsed = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
function fmtRelative(ts) {
  if (!ts) return 'Never';
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (ts >= start.getTime()) return 'Today';
  const days = Math.ceil((start - ts) / DAY_MS);
  if (days <= 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(ts);
}

const fmtTime = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDay = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
// "2h 05m" style, for places that need minutes as well as hours.
function fmtHM(ms) {
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}
const stars = (n) => [1, 2, 3, 4, 5].map((i) => `<i class="star${i <= n ? ' is-on' : ''}">${ICON.star}</i>`).join('');

async function api(url, { method = 'GET', json, body, headers } = {}) {
  const opts = { method, headers: headers || {} };
  if (json !== undefined) { opts.body = JSON.stringify(json); opts.headers['Content-Type'] = 'application/json'; }
  else if (body !== undefined) opts.body = body;
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer;
function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), ms);
}

/* ======================= State ======================= */
const state = {
  games: [], drives: {}, busy: {}, wallpapers: [], trophies: null, discord: null,
  settings: { clock24: true, showSeconds: true, gamesRoot: '', gameFolders: [], sounds: true, soundVolume: 70, autoArtwork: true, profileName: '', avatarColor: 'blue', confirmButton: 'cross', stickDeadzone: 'normal', rumble: true, lowBatteryWarn: 20, uiScale: 100, animations: 'full', backgroundDim: 0, homeOrder: 'recent', startOn: 'game', wallpaperMode: 'scene', wallpaperId: '', wallpaperInterval: 5, wallpaperSymbols: false, confirmClose: true, trophyPopups: true, weeklyGoalHours: 0 },
  view: 'home', prevView: 'home', selectedId: null, libSelectedId: null, items: [],
  sort: 'recent', filter: 'all', query: '', device: 'pad', offline: false,
  eventSeq: null,
};
const byId = (id) => state.games.find((g) => g.id === id);

function setDevice(device) {
  state.device = device;
  const mode = device === 'mouse' ? 'mouse' : 'nav';
  if (document.documentElement.dataset.input !== mode) document.documentElement.dataset.input = mode;
}

function sortedGames(mode) {
  const list = [...state.games];
  const recentKey = (g) => g.lastPlayed || g.addedAt || 0;
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  switch (mode) {
    case 'name': return list.sort(byName);
    case 'played': return list.sort((a, b) => b.playMs - a.playMs || byName(a, b));
    case 'rating': return list.sort((a, b) => b.rating - a.rating || byName(a, b));
    case 'size': return list.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0) || byName(a, b));
    default: return list.sort((a, b) => recentKey(b) - recentKey(a) || byName(a, b));
  }
}

// The games on the home carousel, in the order chosen in Settings.
function homeGames() {
  const recent = sortedGames('recent');
  switch (state.settings.homeOrder) {
    case 'favorites': return [...recent.filter((g) => g.favorite), ...recent.filter((g) => !g.favorite)];
    case 'name': return sortedGames('name');
    case 'played': return sortedGames('played');
    default: return recent;
  }
}

async function refresh() {
  try {
    const s = await api(`/api/state${state.eventSeq === null ? '' : `?since=${state.eventSeq}`}`);
    const firstLoad = state.eventSeq === null;
    state.games = s.games;
    state.settings = s.settings;
    state.drives = s.drives;
    state.busy = s.busy || {};
    state.wallpapers = s.wallpapers || [];
    state.trophies = s.trophies;
    state.discord = s.discord;
    state.ignored = s.ignored;
    state.eventSeq = s.eventSeq;
    if (state.offline) { state.offline = false; toast('Reconnected'); }
    applyPreferences();
    renderAll();
    if (!firstLoad) handleEvents(s.events || []);
    afterRefresh();
  } catch {
    if (!state.offline) { state.offline = true; toast('The library service stopped. Reopen the app to reconnect.', 8000); }
  }
}

const refreshHooks = [];
function afterRefresh() {
  for (const fn of refreshHooks) { try { fn(); } catch (e) { console.error(e); } }
}

// Applies the look-and-feel settings that live on the page itself.
function applyPreferences() {
  const s = state.settings, root = document.documentElement;
  root.style.setProperty('--ui-scale', String(s.uiScale / 100));
  root.style.setProperty('--dim', String(s.backgroundDim / 100));
  root.dataset.motion = s.animations;
  const circle = s.confirmButton === 'circle';
  $$('[data-glyph]').forEach((g) => { g.textContent = (g.dataset.glyph === 'confirm') === !circle ? '✕' : '○'; });
}

/* ======================= Sound ======================= */
// Soft synthesized UI cues, in the spirit of the console's navigation sounds.
const sfx = (() => {
  let ctx = null;
  function play(notes) {
    if (!state.settings.sounds) return;
    try {
      ctx ||= new AudioContext();
      // Skip rather than queue while audio is still locked, so cues never pile up.
      if (ctx.state !== 'running') { ctx.resume(); return; }
      const t0 = ctx.currentTime + 0.01;
      const volume = (state.settings.soundVolume || 70) / 70;
      for (const [freq, at, dur, rawGain, glideTo] of notes) {
        const gain = rawGain * volume;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t0 + at);
        if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + at + dur);
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + at);
        o.stop(t0 + at + dur + 0.03);
      }
    } catch {}
  }
  return {
    move: () => play([[1568, 0, 0.07, 0.022], [3136, 0, 0.035, 0.006]]),
    select: () => play([[1318.5, 0, 0.11, 0.03], [1975.5, 0.05, 0.16, 0.022]]),
    back: () => play([[1174.7, 0, 0.12, 0.026, 830.6]]),
    bump: () => play([[392, 0, 0.07, 0.02]]),
    launch: () => play([[659.3, 0, 0.6, 0.026], [987.8, 0.09, 0.6, 0.022], [1318.5, 0.18, 0.8, 0.018], [1975.5, 0.27, 0.9, 0.01]]),
    trophy: () => play([[1318.5, 0, 0.5, 0.03], [1760, 0.12, 0.6, 0.026], [2637, 0.26, 0.9, 0.022], [3520, 0.4, 1.1, 0.012]]),
    platinum: () => play([[784, 0, 0.7, 0.03], [1046.5, 0.12, 0.7, 0.028], [1318.5, 0.24, 0.8, 0.026], [1568, 0.36, 0.9, 0.024], [2093, 0.5, 1.4, 0.02], [3136, 0.62, 1.6, 0.012]]),
    alert: () => play([[880, 0, 0.14, 0.03], [660, 0.16, 0.2, 0.03]]),
  };
})();

/* ======================= Backdrop ======================= */
let bgFront = $('#bg-a'), bgBack = $('#bg-b'), bgTimer;
const bgVideo = $('#bg-video');
const backdrop = { key: null };

function hideVideo() {
  if (!bgVideo.classList.contains('is-visible')) return;
  bgVideo.classList.remove('is-visible');
  setTimeout(() => {
    if (bgVideo.classList.contains('is-visible')) return;
    bgVideo.pause();
    bgVideo.removeAttribute('src');
    bgVideo.load();
  }, 800);
}

function showScene(mode) {
  const key = `scene:${mode}`;
  if (backdrop.key === key) return;
  backdrop.key = key;
  clearTimeout(bgTimer);
  hideVideo();
  const scene = $('#scene');
  scene.classList.toggle('scene--quiet', mode === 'quiet');
  scene.classList.remove('scene--overlay');
  scene.classList.add('is-visible');
  bgFront.classList.remove('is-visible');
  bgBack.classList.remove('is-visible');
  $('#scrim').classList.remove('is-visible');
}

// Loads an image into the hidden layer, then cross-fades to it. Animated GIFs just work as CSS backgrounds.
function crossfade(url, key, { ambient = false, symbols = false } = {}) {
  clearTimeout(bgTimer);
  bgTimer = setTimeout(() => {
    const img = new Image();
    img.onload = () => {
      if (backdrop.key !== key) return;
      bgBack.style.backgroundImage = `url("${url}")`;
      bgBack.classList.toggle('is-ambient', ambient);
      bgBack.classList.remove('is-visible');
      void bgBack.offsetWidth; // restart the settle animation
      bgBack.classList.add('is-visible');
      bgFront.classList.remove('is-visible');
      [bgFront, bgBack] = [bgBack, bgFront];
      $('#scene').classList.toggle('is-visible', symbols);
      $('#scrim').classList.add('is-visible');
    };
    img.src = url;
  }, 90);
}

function showImage(url, ambient) {
  const key = `${ambient ? 'ambient' : 'photo'}:${url}`;
  if (backdrop.key === key) return;
  backdrop.key = key;
  hideVideo();
  $('#scene').classList.remove('scene--overlay');
  crossfade(url, key, { ambient });
}

// A user wallpaper (image, GIF or video), optionally with the floating symbols drifting over it.
function showWallpaper(w, { symbols = false } = {}) {
  const key = `wall:${w.id}:${symbols ? 1 : 0}`;
  if (backdrop.key === key) return;
  backdrop.key = key;
  clearTimeout(bgTimer);
  const scene = $('#scene');
  scene.classList.remove('scene--quiet');
  scene.classList.toggle('scene--overlay', symbols);
  $('#scrim').classList.add('is-visible');
  const calm = state.settings.animations === 'reduced';
  if (w.type === 'video') {
    bgFront.classList.remove('is-visible');
    bgBack.classList.remove('is-visible');
    scene.classList.toggle('is-visible', symbols);
    if (bgVideo.getAttribute('src') !== w.url) bgVideo.src = w.url;
    bgVideo.onloadeddata = () => { if (state.settings.animations === 'reduced') bgVideo.pause(); };
    bgVideo.play().then(() => { if (calm) bgVideo.pause(); }).catch(() => {});
    bgVideo.classList.add('is-visible');
    return;
  }
  hideVideo();
  // With reduced animations an animated GIF is shown as a still frame.
  if (calm && w.ext === 'gif') {
    stillFrame(w.url).then((still) => { if (backdrop.key === key) crossfade(still, key, { symbols }); });
    return;
  }
  crossfade(w.url, key, { symbols });
}

function backdropFor(g) {
  if (g?.background) showImage(g.background, false);
  else if (g?.cover) showImage(g.cover, true);
  else showScene('quiet');
}

function updateBackdrop() {
  if (state.view === 'library') return backdropFor(byId(state.libSelectedId));
  if (state.view === 'stats') return showScene('quiet');
  if (state.view === 'settings') return previewingWallpaper() ? showWallpaper(state.wallpaperPreview) : showScene('quiet');
  if (state.selectedId === EXPLORE_ID) {
    const w = activeWallpaper();
    return w ? showWallpaper(w, { symbols: state.settings.wallpaperSymbols }) : showScene('full');
  }
  backdropFor(byId(state.selectedId));
}

/* ----- Explore scene: 2.5D PlayStation symbols ----- */
function symbolSvg(kind, tone, uid, blur) {
  const face = tone === 'white' ? ['#ffffff', '#e8f1fc', '#b4cdee'] : ['#5aacff', '#1a82e0', '#0058a8'];
  const side = tone === 'white' ? ['#9dbbe0', '#41679b'] : ['#0a4a8f', '#02264f'];
  const geo = {
    circle: '<circle cx="60" cy="60" r="34"/>',
    cross: '<path d="M33 33 87 87M87 33 33 87"/>',
    triangle: '<path d="M60 25 93 83H27Z"/>',
    square: '<rect x="30" y="30" width="60" height="60" rx="5"/>',
  }[kind];
  const depth = [1, 2, 3, 4, 5, 6].map((d) => `<g transform="translate(${d * 0.9} ${d * 1.25})">${geo}</g>`).join('');
  const filter = blur ? `filter="url(#bl${uid})"` : `filter="url(#sh${uid})"`;
  return `<svg viewBox="0 0 120 120" fill="none" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">
    <defs>
      <linearGradient id="fa${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${face[0]}"/><stop offset=".45" stop-color="${face[1]}"/><stop offset="1" stop-color="${face[2]}"/></linearGradient>
      <linearGradient id="si${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${side[0]}"/><stop offset="1" stop-color="${side[1]}"/></linearGradient>
      <filter id="sh${uid}" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#000814" flood-opacity=".45"/></filter>
      <filter id="bl${uid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${blur}"/></filter>
    </defs>
    <g ${filter}>
      <g stroke="url(#si${uid})">${depth}</g>
      <g stroke="url(#fa${uid})">${geo}</g>
      <g stroke="rgba(255,255,255,.55)" stroke-width="2" transform="translate(-1.6 -2.2)" opacity=".7">${geo}</g>
    </g>
  </svg>`;
}

function buildScene() {
  // [kind, tone, left %, top %, size vw, rotate, drift x vw, drift y vw, drift rotate, seconds, blur]
  // Sharp shapes sit in the foreground; blurred ones are far away and stay visible in the quiet scene.
  const shapes = [
    ['circle', 'white', 71, 11, 23, -14, 1, 2, 9, 19, 0],
    ['cross', 'blue', 54, 35, 10.5, 16, -1.4, 1.6, -11, 15, 0],
    ['triangle', 'white', 45, 13, 8.5, 8, 1.1, 1.4, 12, 17, 0],
    ['square', 'blue', 60, 6, 5, -21, 0.9, 1.2, 13, 21, 2.6],
    ['cross', 'white', 23, 38, 5, 28, 0.9, -1.3, -15, 13, 3.2],
    ['circle', 'blue', 40, 45, 6, 0, -0.9, -1.4, 0, 16, 4],
    ['triangle', 'blue', 4, 40, 6.5, -18, 1.2, -1, 11, 18, 4.5],
    ['square', 'white', 94, 34, 4.5, 26, -0.8, 1.2, -13, 14, 3],
  ];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dust = Array.from({ length: 22 }, () =>
    `<span class="dust" style="--x:${(rand() * 100).toFixed(1)}%;--y:${(30 + rand() * 70).toFixed(1)}%;--s:${(2 + rand() * 3).toFixed(1)}px;--d:${(9 + rand() * 10).toFixed(1)}s;--delay:-${(rand() * 18).toFixed(1)}s"></span>`).join('');
  $('#scene').innerHTML = shapes.map(([kind, tone, x, y, s, r, dx, dy, dr, d, blur], i) =>
    `<div class="shape ${blur ? 'shape--far' : 'shape--near'}" style="--x:${x}%;--y:${y}%;--s:${s}vw;--r:${r}deg;--dx:${dx}vw;--dy:${dy}vw;--dr:${dr}deg;--d:${d}s;--delay:-${(i * 2.3).toFixed(1)}s">${symbolSvg(kind, tone, i, blur)}</div>`).join('') + dust;
}

/* ======================= Carousel ======================= */
function carouselItems() {
  const games = homeGames();
  return [
    { id: EXPLORE_ID, kind: 'explore', name: 'Explore' },
    ...games.map((g) => ({ id: g.id, kind: 'game', name: g.name, g })),
    ...(games.length ? [] : [{ id: ADD_ID, kind: 'add', name: 'Add game' }]),
    { id: LIBRARY_ID, kind: 'library', name: 'Game library' },
  ];
}

function artHtml(g, cls = 'tile-art') {
  return g.cover
    ? `<img class="${cls}" src="${esc(g.cover)}" alt="">`
    : `<span class="tile-text">${esc(g.name)}</span>`;
}

function tileHtml(item) {
  if (item.kind === 'game') {
    const g = item.g;
    return `<button class="tile${g.exeExists ? '' : ' is-missing'}" data-nav data-id="${g.id}" aria-label="${esc(g.name)}">
      ${artHtml(g)}${g.favorite ? `<span class="tile-fav" title="Favorite">${ICON.star}</span>` : ''}${g.status === 'running' ? '<span class="tile-dot" title="Playing"></span>' : ''}
      <span class="tile-label">${esc(g.name)}</span></button>`;
  }
  const icon = { explore: ICON.explore, library: ICON.library, add: ICON.plus }[item.kind];
  return `<button class="tile tile--utility" data-nav data-id="${item.id}" aria-label="${esc(item.name)}">
    <span class="tile-icon">${icon}</span><span class="tile-label">${esc(item.name)}</span></button>`;
}

function renderCarousel() {
  const items = carouselItems();
  state.items = items;
  if (!items.some((i) => i.id === state.selectedId)) {
    state.selectedId = items.find((i) => i.kind === 'game')?.id ?? EXPLORE_ID;
  }
  const track = $('#track');
  const sig = JSON.stringify(items.map((i) => [i.id, i.name, i.g?.cover, i.g?.status, i.g?.exeExists, i.g?.favorite]));
  if (track.dataset.sig !== sig) {
    const hadFocus = track.contains(document.activeElement);
    track.dataset.sig = sig;
    track.innerHTML = items.map(tileHtml).join('');
    if (hadFocus) $(`#track [data-id="${state.selectedId}"]`)?.focus({ preventScroll: true });
  }
  positionCarousel();
}

function positionCarousel() {
  const idx = state.items.findIndex((i) => i.id === state.selectedId);
  // The selected tile parks in the second slot and the row slides around it.
  $('#track').style.setProperty('--shift', Math.max(0, idx - 1));
  $$('#track .tile').forEach((t) => t.classList.toggle('is-selected', t.dataset.id === state.selectedId));
}

function select(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  positionCarousel();
  renderStage();
}

function stepCarousel(delta, wrap) {
  const items = state.items;
  let idx = items.findIndex((i) => i.id === state.selectedId) + delta;
  if (idx < 0 || idx >= items.length) {
    if (!wrap) return sfx.bump();
    idx = (idx + items.length) % items.length;
  }
  select(items[idx].id);
  $(`#track [data-id="${items[idx].id}"]`)?.focus({ preventScroll: true });
  sfx.move();
}

function focusSelectedTile() {
  $(`#track [data-id="${state.selectedId}"]`)?.focus({ preventScroll: true });
}

function activateItem(id) {
  if (id === LIBRARY_ID) return setView('library');
  if (id === ADD_ID) return openGameEditor(null);
  if (id === EXPLORE_ID) return focusEl($('#stage [data-nav]'));
  const g = byId(id);
  if (g?.status === 'running') return resumeGame(id);
  launchGame(id);
}

/* ======================= Stage: game hero / Explore ======================= */
let stageHtml = '';

function renderStage() {
  const stage = $('#stage');
  const id = state.selectedId;
  const g = byId(id);
  const key = id === EXPLORE_ID ? 'explore' : g ? `game:${g.id}` : id === LIBRARY_ID ? 'library' : 'add';
  const html = key === 'explore' ? exploreHtml() : g ? gameHeroHtml(g) : key === 'library' ? libraryHeroHtml() : addHeroHtml();
  const isNew = stage.dataset.key !== key;
  if (isNew || html !== stageHtml) {
    const focusKey = stage.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const scroll = $('#widgets')?.scrollLeft || 0;
    stageHtml = html;
    stage.dataset.key = key;
    stage.className = `stage stage--${key.split(':')[0]}`;
    stage.innerHTML = html;
    if (isNew) { void stage.offsetWidth; stage.classList.add('is-entering'); }
    else if ($('#widgets')) $('#widgets').scrollLeft = scroll;
    if (focusKey) stage.querySelector(`[data-key="${focusKey}"]`)?.focus({ preventScroll: true });
    updateElapsed();
  }
  if (state.view === 'home') updateBackdrop();
}

function gameHeroHtml(g) {
  const running = g.status === 'running';
  const starting = g.status === 'starting';
  const meta = [];
  if (running) meta.push(`<span class="meta-item meta-live">Playing <span data-elapsed-since="${g.runningSince}"></span></span>`);
  else if (starting) meta.push('<span class="meta-item meta-live">Starting…</span>');
  if (!g.exeExists) meta.push(`<span class="meta-item meta-warn">${g.launch.type === 'exe' ? 'Executable not found' : 'Game folder not found'}</span>`);
  if (g.playMs >= 60000) meta.push(`<span class="meta-item">${ICON.clock}${fmtDuration(g.playMs)} played</span>`);
  else if (!running) meta.push(`<span class="meta-item">${ICON.clock}Not played yet</span>`);
  if (g.sizeBytes != null || g.sizing) meta.push(`<span class="meta-item">${ICON.drive}${g.sizeBytes != null ? fmtBytes(g.sizeBytes) : 'Calculating…'}</span>`);
  if (g.progress) meta.push(`<span class="meta-item meta-status meta-status--${g.progress}">${STATUS_LABEL[g.progress]}</span>`);
  if (g.rating) meta.push(`<span class="meta-item meta-stars" title="${g.rating} of 5">${stars(g.rating)}</span>`);
  if (g.trophies.total) meta.push(`<span class="meta-item meta-trophy${g.trophies.platinum ? ' is-platinum' : ''}">${ICON.cup}${g.trophies.done}/${g.trophies.total}${g.trophies.platinum ? ' · Platinum' : ` · ${g.trophies.percent}%`}</span>`);
  const circle = (key, action, label, icon, badge) => `<button class="btn btn-circle has-label" data-nav data-key="${key}" data-action="${action}" data-label="${label}" aria-label="${label}">${icon}${badge ? `<b class="badge">${badge}</b>` : ''}</button>`;
  return `
    <div class="hero">
      ${g.logo ? `<img class="hero-logo" src="${esc(g.logo)}" alt="${esc(g.name)}">` : `<h1 class="hero-title">${esc(g.name)}</h1>`}
      <p class="hero-meta">${meta.join('<span class="meta-sep"></span>')}</p>
      ${g.notePreview ? `<p class="hero-note">${ICON.note}<span>${esc(g.notePreview)}</span></p>` : ''}
      <div class="hero-actions">
        ${g.exeExists
          ? `<button class="btn btn-primary btn-play" data-nav data-key="play" data-action="play">${running ? 'Resume' : starting ? 'Starting…' : 'Play'}</button>`
          : `<button class="btn btn-primary btn-play" data-nav data-key="edit" data-action="edit">Fix path</button>`}
        ${circle('fav', 'favorite', g.favorite ? 'Remove favorite' : 'Favorite', g.favorite ? ICON.star : ICON.starOutline)}
        ${circle('trophies', 'trophies', 'Trophies', ICON.cup, g.trophies.total ? `${g.trophies.done}` : '')}
        ${circle('notes', 'notes', 'Notes', ICON.note, g.notes ? g.notes : '')}
        ${circle('stats', 'game-stats', 'Playtime', ICON.stats)}
        ${circle('more', 'menu', 'Options', ICON.more)}
      </div>
    </div>`;
}

function libraryHeroHtml() {
  const t = totals();
  return `
    <div class="hero">
      <h1 class="hero-title">Game library</h1>
      <p class="hero-meta">
        <span class="meta-item">${ICON.library}${t.count} ${t.count === 1 ? 'game' : 'games'}</span><span class="meta-sep"></span>
        <span class="meta-item">${ICON.drive}${fmtBytes(t.size)}</span><span class="meta-sep"></span>
        <span class="meta-item">${ICON.clock}${fmtDuration(t.play)} played</span>
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-play" data-nav data-key="open" data-action="open-library">Open library</button>
        <button class="btn btn-secondary" data-nav data-key="add" data-action="add">Add game</button>
      </div>
    </div>`;
}

function addHeroHtml() {
  return `
    <div class="hero">
      <h1 class="hero-title">Add your first game</h1>
      <p class="hero-meta"><span class="meta-item">Pick a game’s executable, or scan ${esc(state.settings.gamesRoot)} for installed games.</span></p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-play" data-nav data-key="add" data-action="add">Add game</button>
        <button class="btn btn-secondary" data-nav data-key="scan" data-action="scan">Scan folder</button>
      </div>
    </div>`;
}

function totals() {
  const games = state.games;
  const daily = new Array(14).fill(0);
  games.forEach((g) => g.daily.forEach((ms, i) => { daily[i] += ms; }));
  return {
    games,
    count: games.length,
    size: sum(games.map((g) => g.sizeBytes || 0)),
    play: sum(games.map((g) => g.playMs)),
    sessions: sum(games.map((g) => g.sessions)),
    longest: Math.max(0, ...games.map((g) => g.longestMs)),
    daily,
  };
}

/* ----- Explore widgets ----- */
function gaugeHtml(segments, total, value, label) {
  const r = 40, C = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const len = total > 0 ? Math.max(0, (s.value / total) * C) : 0;
    const arc = len > 0.3 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${s.color}" stroke-width="9" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"/>` : '';
    offset += len;
    return arc;
  }).join('');
  return `<div class="gauge"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(204,204,204,.16)" stroke-width="9"/><g transform="rotate(-90 50 50)">${arcs}</g></svg>
    <div class="gauge-center"><strong>${value}</strong><span>${label}</span></div></div>`;
}

function barsHtml(daily) {
  const max = Math.max(...daily, 1);
  const labels = daily.map((_, i) => new Date(Date.now() - (daily.length - 1 - i) * DAY_MS).toLocaleDateString(undefined, { weekday: 'narrow' }));
  return `<div class="bars">${daily.map((ms, i) => `<div class="bar${ms ? '' : ' is-zero'}${i === daily.length - 1 ? ' is-today' : ''}" style="height:${ms ? Math.max(6, (ms / max) * 100) : 0}%" title="${fmtDuration(ms)}"></div>`).join('')}
      ${sum(daily) ? '' : '<p class="bars-empty">Play a game to see your activity</p>'}</div>
    <div class="bar-labels">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
}

function rootDrive() {
  const root = (state.settings.gamesRoot || '').slice(0, 3).toUpperCase();
  return state.drives[root] ? root : Object.keys(state.drives)[0];
}

function mediaWidget(g, { key, kicker, icon, line, i }) {
  if (!g) return `<article tabindex="0" class="widget w-media" data-nav data-key="${key}" style="--i:${i}"><p class="w-empty">Add games to see them here</p></article>`;
  const art = g.background || g.cover;
  return `<article tabindex="0" class="widget w-media" data-nav data-key="${key}" data-go="${g.id}" style="--i:${i}">
    ${art ? `<img class="w-media-bg" src="${esc(art)}" alt="" decoding="async">` : ''}
    ${g.cover && g.background ? `<img class="w-media-thumb" src="${esc(g.cover)}" alt="">` : ''}
    <div class="w-caption"><span class="w-kicker">${icon}${kicker}</span><b>${esc(g.name)}</b><small>${line}</small></div>
  </article>`;
}

function trophyWidgetHtml(i) {
  const t = state.trophies;
  if (!t || !t.games) {
    return `<article tabindex="0" class="widget w-trophies" data-nav data-key="w-trophies" style="--i:${i}">
      <h3 class="w-title">${ICON.cup}Trophies</h3>
      <p class="w-empty">Open a game and tick off trophies to build your trophy level</p></article>`;
  }
  const tiers = ['platinum', 'gold', 'silver', 'bronze'];
  return `<article tabindex="0" class="widget w-trophies" data-nav data-key="w-trophies" style="--i:${i}">
    <h3 class="w-title">${ICON.cup}Trophies<span class="w-aside">${t.points.toLocaleString()} points</span></h3>
    <div class="w-tiers">${tiers.map((k) => `<div>${tierIcon(k)}<b>${t.unlocked[k]}</b></div>`).join('')}</div>
    <div class="w-level"><span class="w-level-name">${ICON.star}Level ${t.level}</span><span class="w-level-pct">Next level ${t.levelPercent}%</span></div>
    <div class="w-progress"><span style="width:${t.levelPercent}%"></span></div>
    <ul class="w-recent">${t.recent.slice(0, 3).map((r) => `<li>${tierIcon(r.tier)}<span><b>${esc(r.title)}</b><small>${esc(r.game)}</small></span></li>`).join('')}</ul>
  </article>`;
}

function exploreHtml() {
  const t = totals();
  const hours = t.play / 3600000;
  const level = Math.floor(hours / 10) + 1;
  const pct = Math.floor((hours % 10) * 10);
  const played = t.games.filter((g) => g.playMs > 0);
  const recent = [...played].sort((a, b) => b.lastPlayed - a.lastPlayed)[0] || sortedGames('recent')[0] || null;
  const top = [...played].sort((a, b) => b.playMs - a.playMs)[0] || null;
  const feature = top && top.id !== recent?.id ? top : sortedGames('size').find((g) => g.id !== recent?.id) || top;
  const isTop = !!top && feature === top;
  const newest = [...t.games].sort((a, b) => b.addedAt - a.addedAt)[0] || null;
  const devices = deviceCards();
  const driveRoot = rootDrive();
  const drive = state.drives[driveRoot];
  const onDrive = sum(t.games.filter((g) => g.drive === driveRoot).map((g) => g.sizeBytes || 0));
  const sized = t.games.filter((g) => g.sizeBytes).sort((a, b) => b.sizeBytes - a.sizeBytes);
  const mosaic = sortedGames('recent').slice(0, 4);
  const stat = (icon, value, label) => `<div class="w-stat">${icon}<b>${value}</b><small>${label}</small></div>`;
  const avg = t.sessions ? t.play / t.sessions : 0;
  const name = state.settings.profileName;

  return `
    <p class="welcome">Welcome back${name ? `, ${esc(name)}` : ''}</p>
    <div class="widgets" id="widgets">
      <div class="w-col w-col--wide">
        <article tabindex="0" class="widget w-summary" data-nav data-key="w-summary" style="--i:0">
          <div class="w-stats">
            ${stat(ICON.clock, hours === 0 ? '0' : hours < 100 ? hours.toFixed(1) : Math.round(hours).toLocaleString(), 'Hours')}
            ${stat(ICON.gamepad, t.count, t.count === 1 ? 'Game' : 'Games')}
            ${stat(ICON.play, t.sessions.toLocaleString(), 'Sessions')}
            ${stat(ICON.stopwatch, t.longest ? fmtShort(t.longest) : '0m', 'Longest')}
          </div>
          <div class="w-level"><span class="w-level-name">${ICON.star}Level ${level}</span><span class="w-level-pct">Next level ${pct}%</span></div>
          <div class="w-progress"><span style="width:${pct}%"></span></div>
        </article>
        <article tabindex="0" class="widget w-devices" data-nav data-key="w-devices" style="--i:1">
          ${devices.map((d) => `<div class="w-device"><span class="w-device-ring${d.on ? ' is-on' : ''}${d.low ? ' is-low' : ''}">${d.icon}</span><span class="w-device-text"><b>${esc(d.name)}</b><small>${d.sub}</small></span></div>`).join('')}
        </article>
        <article tabindex="0" class="widget w-storage" data-nav data-key="w-storage" style="--i:2">
          <div class="w-storage-text">
            <h3 class="w-title">${ICON.storage}Storage</h3>
            <ul class="w-legend">
              <li><i style="background:#53b1ff"></i>Games</li>
              <li><i style="background:#0070cc"></i>Other data</li>
              <li><i class="is-free"></i>Free space</li>
            </ul>
          </div>
          ${drive ? gaugeHtml([{ value: onDrive, color: '#53b1ff' }, { value: Math.max(0, drive.total - drive.free - onDrive), color: '#0070cc' }], drive.total, fmtBytes(drive.free), 'Free') : ''}
        </article>
      </div>
      <div class="w-col w-col--square">
        ${mediaWidget(recent, { key: 'w-recent', i: 3, icon: ICON.play, kicker: recent?.playMs ? 'Continue playing' : 'Ready to play', line: recent ? (recent.status === 'running' ? 'Playing now' : recent.lastPlayed ? fmtRelative(recent.lastPlayed) : 'Not played yet') : '' })}
      </div>
      <div class="w-col w-col--split">
        ${mediaWidget(feature, { key: 'w-feature', i: 4, icon: isTop ? ICON.trophy : ICON.drive, kicker: isTop ? 'Most played' : 'In your library', line: feature ? (isTop ? `${fmtDuration(feature.playMs)} played` : fmtBytes(feature.sizeBytes)) : '' })}
        <article tabindex="0" class="widget w-row" data-nav data-key="w-added" ${newest ? `data-go="${newest.id}"` : ''} style="--i:5">
          <div class="w-row-text">
            <h3 class="w-title">${ICON.calendar}Recently added</h3>
            <p class="w-line">${newest ? esc(newest.name) : 'Nothing yet'}</p>
            <small>${newest ? fmtDate(newest.addedAt) : ''}</small>
          </div>
          ${newest?.cover ? `<img class="w-thumb" src="${esc(newest.cover)}" alt="">` : ''}
        </article>
      </div>
      <div class="w-col w-col--split">
        <article tabindex="0" class="widget w-activity" data-nav data-key="w-activity" style="--i:6">
          <h3 class="w-title">${ICON.chart}Activity<span class="w-aside">Last 14 days</span></h3>
          ${barsHtml(t.daily)}
          <div class="w-split">
            <div><small>This week</small><b>${fmtDuration(sum(t.daily.slice(7)))}</b></div>
            <div><small>Last week</small><b>${fmtDuration(sum(t.daily.slice(0, 7)))}</b></div>
          </div>
        </article>
        <article tabindex="0" class="widget w-sessions" data-nav data-key="w-sessions" style="--i:7">
          <h3 class="w-title">${ICON.stopwatch}Sessions</h3>
          <div class="w-split w-split-3">
            <div><small>Total</small><b>${t.sessions}</b></div>
            <div><small>Average</small><b>${t.sessions ? fmtShort(avg) : '—'}</b></div>
            <div><small>Longest</small><b>${t.longest ? fmtShort(t.longest) : '—'}</b></div>
          </div>
        </article>
      </div>
      <div class="w-col">${trophyWidgetHtml(9)}</div>
      <div class="w-col w-col--narrow">
        <article tabindex="0" class="widget w-library" data-nav data-key="w-library" data-open="library" style="--i:10">
          <h3 class="w-title">${ICON.library}Game library</h3>
          <div class="w-mosaic">${[0, 1, 2, 3].map((n) => {
            const g = mosaic[n];
            if (!g) return `<span class="w-mosaic-empty">${ICON.plus}</span>`;
            return g.cover ? `<img src="${esc(g.cover)}" alt="">` : `<span class="w-mosaic-text">${esc(g.name)}</span>`;
          }).join('')}</div>
          <p class="w-foot">${t.count} ${t.count === 1 ? 'game' : 'games'} · ${fmtBytes(t.size)}</p>
        </article>
      </div>
      <div class="w-col">
        <article tabindex="0" class="widget w-alloc" data-nav data-key="w-alloc" style="--i:11">
          <h3 class="w-title">${ICON.pie}Allocation<span class="w-aside">${fmtBytes(t.size)}</span></h3>
          ${sized.length ? `<ul class="alloc">${sized.slice(0, 6).map((g) => `
            <li><div class="alloc-row"><span>${esc(g.name)}</span><span>${fmtBytes(g.sizeBytes)}</span></div>
            <div class="alloc-track"><div class="alloc-fill" style="width:${(g.sizeBytes / sized[0].sizeBytes) * 100}%"></div></div></li>`).join('')}</ul>`
            : '<p class="muted">Calculating game sizes…</p>'}
        </article>
      </div>
    </div>`;
}

/* ======================= Library view ======================= */
const FILTERS = [
  ['all', 'All'], ['favorites', 'Favorites'], ['playing', 'Playing'], ['backlog', 'Backlog'], ['completed', 'Completed'],
  ['hold', 'On hold'], ['dropped', 'Dropped'], ['unplayed', 'Not played'], ['attention', 'Needs attention'],
];
const filterMatch = {
  all: () => true,
  favorites: (g) => g.favorite,
  playing: (g) => g.progress === 'playing' || g.status === 'running',
  backlog: (g) => g.progress === 'backlog',
  completed: (g) => g.progress === 'completed',
  hold: (g) => g.progress === 'hold',
  dropped: (g) => g.progress === 'dropped',
  unplayed: (g) => g.playMs < 60000,
  attention: (g) => !g.exeExists,
};

function libBadges(g) {
  const bits = [];
  if (g.favorite) bits.push(`<span class="lib-badge lib-badge--fav">${ICON.star}</span>`);
  if (g.trophies.total) bits.push(`<span class="lib-badge${g.trophies.platinum ? ' is-platinum' : ''}">${ICON.cup}${g.trophies.done}/${g.trophies.total}</span>`);
  if (!g.exeExists) bits.push('<span class="lib-badge lib-badge--warn">Missing</span>');
  return bits.length ? `<span class="lib-badges">${bits.join('')}</span>` : '';
}

function renderLibrary() {
  $$('#sort-chips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.sort === state.sort));
  const t = totals();
  $('#library-summary').textContent = `${t.count} ${t.count === 1 ? 'game' : 'games'} · ${fmtBytes(t.size)} · ${fmtDuration(t.play)} played`;

  // Only offer filters that have something in them.
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, state.games.filter(filterMatch[k]).length]));
  if (state.filter !== 'all' && !counts[state.filter]) state.filter = 'all';
  const chips = $('#filter-chips');
  const chipSig = JSON.stringify([state.filter, FILTERS.map(([k]) => counts[k] > 0 || k === 'all')]);
  if (chips.dataset.sig !== chipSig) {
    const focused = chips.contains(document.activeElement) ? document.activeElement.dataset.filter : null;
    chips.dataset.sig = chipSig;
    chips.innerHTML = FILTERS.filter(([k]) => k === 'all' || counts[k] > 0)
      .map(([k, label]) => `<button class="chip${state.filter === k ? ' is-active' : ''}" data-nav data-filter="${k}">${label}${k === 'all' ? '' : ` <span class="chip-count">${counts[k]}</span>`}</button>`).join('');
    if (focused) chips.querySelector(`[data-filter="${focused}"]`)?.focus({ preventScroll: true });
  }

  const q = state.query.trim().toLowerCase();
  const games = sortedGames(state.sort).filter((g) => filterMatch[state.filter](g) && (!q || g.name.toLowerCase().includes(q)));
  const grid = $('#library-grid');
  const sig = JSON.stringify([q, state.sort, state.filter, games.map((g) => [g.id, g.name, g.cover, g.status, Math.floor(g.playMs / 360000), g.sizeBytes, g.favorite, g.trophies.done, g.trophies.total, g.exeExists])]);
  if (grid.dataset.sig === sig) return;
  const focusedId = grid.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  grid.dataset.sig = sig;
  grid.innerHTML = games.length
    ? games.map((g) => `
      <button class="lib-card${g.status === 'running' ? ' is-running' : ''}" data-nav data-id="${g.id}">
        <span class="lib-art">${artHtml(g)}${libBadges(g)}</span>
        <span class="lib-name">${esc(g.name)}</span>
        <span class="lib-meta">${g.status === 'running' ? 'Playing now' : `${g.playMs >= 60000 ? fmtDuration(g.playMs) : 'Not played'} · ${g.sizeBytes != null ? fmtBytes(g.sizeBytes) : '…'}`}</span>
      </button>`).join('')
    : `<div class="empty">${q
        ? `<h2>No games match “${esc(state.query)}”</h2><p class="muted">Try a different name.</p>`
        : state.filter !== 'all'
          ? `<h2>Nothing here yet</h2><p class="muted">No games match this filter.</p>`
          : `<h2>No games yet</h2><p class="muted">Add a game or scan for games from Settings.</p>`}</div>`;
  if (focusedId) grid.querySelector(`[data-id="${focusedId}"]`)?.focus({ preventScroll: true });
}

function renderAll() {
  renderCarousel();
  renderStage();
  renderLibrary();
}

const VIEWS = ['home', 'library', 'stats', 'settings'];
const TAB_ORDER = ['home', 'library', 'stats'];

function setView(view, { focus = true } = {}) {
  if (view === 'settings' && state.view !== 'settings') state.prevView = state.view;
  state.view = view;
  for (const v of VIEWS) $(`#view-${v}`).hidden = v !== view;
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === view));
  if (view === 'stats') renderStatsView();
  if (view === 'settings') renderSettingsView();
  updateBackdrop();
  if (focus) focusView();
}

function focusView() {
  const v = state.view;
  if (v === 'home') return focusSelectedTile();
  if (v === 'library') return focusEl((state.libSelectedId && $(`#library-grid [data-id="${state.libSelectedId}"]`)) || $('#library-grid [data-nav]') || $('#search'));
  if (v === 'stats') return focusEl($('#view-stats [data-nav]') || $('.tab.is-active'));
  focusEl($('#view-settings .rail-item.is-active') || $('#view-settings [data-nav]'));
}

/* ======================= Navigation helpers ======================= */
function goToGame(id) {
  if (!byId(id)) return;
  if (state.view !== 'home') setView('home', { focus: false });
  select(id);
  requestAnimationFrame(() => focusEl($('#stage [data-key="play"]') || $('#stage [data-nav]')));
}

function openSearch() {
  setView('library', { focus: false });
  const input = $('#search');
  focusEl(input);
  if (state.device === 'pad') openKeyboard(input);
}

function toggleFavorite(id) {
  const g = byId(id);
  if (!g) return;
  api(`/api/games/${id}`, { method: 'PATCH', json: { favorite: !g.favorite } })
    .then(() => { toast(g.favorite ? `${g.name} removed from favorites` : `${g.name} added to favorites`); return refresh(); })
    .catch((e) => toast(e.message));
}

/* ======================= Layers (modals) ======================= */
function openLayer(html, { className = '', onClose, actions } = {}) {
  const layer = document.createElement('div');
  layer.className = `layer ${className}`;
  layer.innerHTML = html;
  layer._returnFocus = document.activeElement;
  layer._onClose = onClose;
  layer._actions = actions || {};
  layer.addEventListener('mousedown', (e) => { if (e.target === layer) closeLayer(layer); });
  $('#layers').appendChild(layer);
  requestAnimationFrame(() => focusEl(layer.querySelector('[autofocus]') || layer.querySelector('[data-nav]')));
  return layer;
}

function closeLayer(layer = topLayer(), result) {
  if (!layer) return;
  layer.remove();
  layer._onClose?.(result);
  const back = layer._returnFocus;
  if (back && document.contains(back)) back.focus({ preventScroll: true });
  else if (!topLayer()) focusView();
}

const topLayer = () => $('#layers').lastElementChild;

function confirmDialog(title, text, confirmLabel) {
  return new Promise((resolve) => {
    const layer = openLayer(`
      <div class="modal" role="dialog" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-nav data-r="0" autofocus>Cancel</button>
          <button class="btn btn-primary" data-nav data-r="1">${esc(confirmLabel)}</button>
        </div>
      </div>`, { onClose: (r) => resolve(!!r) });
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) closeLayer(layer, b.dataset.r === '1');
    });
  });
}

function promptDialog(title, label, value = '', placeholder = '') {
  return new Promise((resolve) => {
    const layer = openLayer(`
      <div class="modal" role="dialog" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        <label class="field"><span>${esc(label)}</span><input class="input" data-nav autofocus value="${esc(value)}" placeholder="${esc(placeholder)}"></label>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-nav data-r="0">Cancel</button>
          <button class="btn btn-primary" data-nav data-r="1">OK</button>
        </div>
      </div>`, { onClose: (r) => resolve(r ?? null) });
    const input = layer.querySelector('input');
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) closeLayer(layer, b.dataset.r === '1' ? input.value.trim() : null);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); closeLayer(layer, input.value.trim()); } });
  });
}

/* ----- File browser (controller friendly) ----- */
function browseDialog({ title, filter, start }) {
  return new Promise((resolve) => {
    const layer = openLayer(`
      <div class="modal menu" style="width:min(44rem,100%)" role="dialog" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        <div class="browser-path" data-path></div>
        <div class="menu-list" data-list></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-nav data-cancel>Cancel</button>
          ${filter === 'dir' ? '<button class="btn btn-primary" data-nav data-use>Use this folder</button>' : ''}
        </div>
      </div>`, { onClose: (r) => resolve(r ?? null) });
    let current = '';
    async function load(p) {
      try {
        const data = await api(`/api/browse?filter=${filter}&path=${encodeURIComponent(p)}`);
        current = data.path;
        layer.querySelector('[data-path]').textContent = data.path || 'This PC';
        const rows = [];
        if (data.parent !== null) rows.push(`<button class="menu-item" data-nav data-go-path="${esc(data.parent)}">${ICON.up}Up one level</button>`);
        for (const e of data.entries) {
          rows.push(e.dir
            ? `<button class="menu-item" data-nav data-go-path="${esc(e.path)}">${ICON.folder}${esc(e.name)}</button>`
            : `<button class="menu-item" data-nav data-pick="${esc(e.path)}">${filter === 'image' || filter === 'wallpaper' ? ICON.image : ICON.file}${esc(e.name)}</button>`);
        }
        if (!data.entries.length) rows.push('<p class="muted" style="padding:1rem">Nothing to show here.</p>');
        const list = layer.querySelector('[data-list]');
        list.innerHTML = rows.join('');
        list.scrollTop = 0;
        focusEl(list.querySelector('[data-nav]') || layer.querySelector('[data-cancel]'));
      } catch (e) {
        toast(e.message);
      }
    }
    layer.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go-path]');
      if (go) return load(go.dataset.goPath);
      const pick = e.target.closest('[data-pick]');
      if (pick) return closeLayer(layer, pick.dataset.pick);
      if (e.target.closest('[data-use]') && current) return closeLayer(layer, current);
      if (e.target.closest('[data-cancel]')) closeLayer(layer);
    });
    load(start || state.settings.gamesRoot || '');
  });
}

/* ----- Steam artwork search ----- */
function artworkSearchDialog(query) {
  return new Promise((resolve) => {
    let results = [];
    const layer = openLayer(`
      <div class="modal menu art-search" role="dialog" aria-label="Find artwork">
        <h2>Find artwork</h2>
        <div class="input-row">
          <input class="input" data-nav data-q value="${esc(query)}" placeholder="Game name">
          <button class="btn btn-primary btn-sm" data-nav data-search>Search</button>
        </div>
        <div class="menu-list" data-results></div>
        <p class="muted art-credit">Artwork comes from the game’s Steam store page.</p>
      </div>`, { onClose: (r) => resolve(r ?? null) });
    const input = layer.querySelector('[data-q]');
    const list = layer.querySelector('[data-results]');
    async function run() {
      const q = input.value.trim();
      if (!q) return focusEl(input);
      list.innerHTML = '<p class="muted" style="padding:1rem">Searching…</p>';
      try {
        results = await api(`/api/artwork/search?q=${encodeURIComponent(q)}`);
        list.innerHTML = results.length
          ? results.map((r, i) => `<button class="menu-item art-result" data-nav data-i="${i}">${r.image ? `<img src="${esc(r.image)}" alt="">` : ''}<span>${esc(r.name)}</span></button>`).join('')
          : '<p class="muted" style="padding:1rem">No matches. Try a shorter name.</p>';
        focusEl(list.querySelector('[data-nav]') || input);
      } catch (e) {
        list.innerHTML = `<p class="muted" style="padding:1rem">${esc(e.message)}</p>`;
      }
    }
    layer.addEventListener('click', (e) => {
      if (e.target.closest('[data-search]')) return run();
      const r = e.target.closest('[data-i]');
      if (r) closeLayer(layer, results[Number(r.dataset.i)]);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); run(); } });
    if (query) run();
  });
}

/* ----- Game options menu ----- */
function openGameMenu(id) {
  const g = byId(id);
  if (!g) return;
  const running = g.status === 'running';
  const item = (m, icon, label, sub = '') => `<button class="menu-item" data-nav data-m="${m}">${icon}${label}${sub ? `<span class="sub">${sub}</span>` : ''}</button>`;
  const layer = openLayer(`
    <div class="modal menu" role="dialog" aria-label="${esc(g.name)} options">
      <h2>${esc(g.name)}</h2>
      ${item('play', ICON.play, running ? 'Resume game' : 'Play')}
      ${running ? item('close', ICON.stop, 'Close game') : ''}
      ${item('stats', ICON.stats, 'Playtime statistics', fmtDuration(g.playMs))}
      ${item('trophies', ICON.cup, 'Trophies', g.trophies.total ? `${g.trophies.done}/${g.trophies.total}` : 'None yet')}
      ${item('notes', ICON.note, 'Notes', g.notes ? String(g.notes) : '')}
      ${item('favorite', g.favorite ? ICON.star : ICON.starOutline, g.favorite ? 'Remove from favorites' : 'Add to favorites')}
      ${item('progress', ICON.check, 'Status and rating', g.progress ? STATUS_LABEL[g.progress] : '')}
      ${item('edit', ICON.edit, 'Edit details and launch options')}
      ${item('art', ICON.image, 'Find artwork online')}
      ${item('folder', ICON.folder, 'Open install folder')}
      ${item('size', ICON.refresh, 'Recalculate size', fmtBytes(g.sizeBytes))}
      ${item('reset', ICON.reset, 'Reset play statistics')}
      ${item('remove', ICON.trash, 'Remove from library')}
    </div>`);
  layer.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    closeLayer(layer);
    if (m === 'play') launchGame(id);
    if (m === 'close') closeGame(id);
    if (m === 'stats') openGameStats(id);
    if (m === 'trophies') openTrophies(id);
    if (m === 'notes') openNotes(id);
    if (m === 'favorite') toggleFavorite(id);
    if (m === 'progress') openProgressDialog(id);
    if (m === 'edit') openGameEditor(g);
    if (m === 'art') openGameEditor(g, { findArt: true });
    if (m === 'folder') api(`/api/games/${id}/open-folder`, { method: 'POST' }).catch((err) => toast(err.message));
    if (m === 'size') { await api(`/api/games/${id}/rescan-size`, { method: 'POST' }); toast('Recalculating size…'); setTimeout(refresh, 1500); }
    if (m === 'reset' && await confirmDialog('Reset play statistics?', `All recorded sessions and previous playtime for ${g.name} will be cleared. This can't be undone.`, 'Reset')) {
      await api(`/api/games/${id}/reset-stats`, { method: 'POST' });
      await refresh();
      toast('Play statistics reset');
    }
    if (m === 'remove' && await confirmDialog('Remove from library?', `${g.name} will be removed from this library and won’t be added again by scans. Game files on disk are not touched.`, 'Remove')) {
      await api(`/api/games/${id}`, { method: 'DELETE' });
      if (state.selectedId === id) state.selectedId = null;
      await refresh();
      toast(`${g.name} removed`);
      focusView();
    }
  });
}

/* ----- Status and rating ----- */
function openProgressDialog(id) {
  const g = byId(id);
  if (!g) return;
  const layer = openLayer(`
    <div class="modal menu" role="dialog" aria-label="Status and rating">
      <h2>${esc(g.name)}</h2>
      <div class="field-title">Status</div>
      <div class="chips chips-wrap" data-status>
        ${Object.entries(STATUS_LABEL).map(([k, label]) => `<button class="chip${g.progress === k ? ' is-active' : ''}" data-nav data-progress="${k}">${label}</button>`).join('')}
      </div>
      <div class="field-title">Your rating</div>
      <div class="rating-row" data-rating>
        ${[1, 2, 3, 4, 5].map((n) => `<button class="rate-btn${n <= g.rating ? ' is-on' : ''}" data-nav data-rate="${n}" aria-label="${n} stars">${ICON.star}</button>`).join('')}
        <button class="btn btn-ghost btn-xs" data-nav data-rate="0">Clear</button>
      </div>
      <div class="modal-actions"><button class="btn btn-primary" data-nav data-done autofocus>Done</button></div>
    </div>`);
  const save = async (patch) => { await api(`/api/games/${id}`, { method: 'PATCH', json: patch }); await refresh(); };
  layer.addEventListener('click', async (e) => {
    const st = e.target.closest('[data-progress]');
    const rt = e.target.closest('[data-rate]');
    try {
      if (st) {
        await save({ progress: st.dataset.progress });
        $$('[data-progress]', layer).forEach((c) => c.classList.toggle('is-active', c === st));
      } else if (rt) {
        const n = Number(rt.dataset.rate);
        await save({ rating: n });
        $$('.rate-btn', layer).forEach((b) => b.classList.toggle('is-on', Number(b.dataset.rate) <= n));
      } else if (e.target.closest('[data-done]')) closeLayer(layer);
    } catch (err) { toast(err.message); }
  });
}

/* ----- Add / edit game ----- */
function openGameEditor(game, { findArt = false } = {}) {
  const isNew = !game;
  const pendingImg = { cover: null, background: null, logo: null }; // { blob } | { url } | { path } | { remove: true }
  let lastSlot = 'cover';
  let launchType = game?.launch?.type || 'exe';
  let admin = !!game?.admin;
  let discord = game?.discord || 'auto';

  const slot = (kind, shape) => `
    <div class="slot" data-slot="${kind}">
      <button class="slot-preview ${shape}" data-nav data-choose="${kind}" aria-label="Choose ${KIND_LABEL[kind].toLowerCase()}"></button>
      <div class="slot-side">
        <span class="slot-label">${KIND_LABEL[kind]}${kind === 'logo' ? ' <span class="muted">(optional)</span>' : ''}</span>
        <div class="slot-actions">
          <button class="btn btn-ghost btn-xs" data-nav data-browse-img="${kind}">Browse PC</button>
          <button class="btn btn-ghost btn-xs" data-nav data-url="${kind}">URL</button>
          <button class="btn btn-ghost btn-xs" data-nav data-clear="${kind}">Remove</button>
        </div>
      </div>
    </div>`;
  const chipGroup = (name, options, current) => `<div class="chips" data-group="${name}">${options.map(([k, label]) => `<button class="chip${current === k ? ' is-active' : ''}" data-nav data-opt="${k}">${label}</button>`).join('')}</div>`;

  const layer = openLayer(`
    <div class="modal modal-wide" role="dialog" aria-label="${isNew ? 'Add game' : 'Edit game'}">
      <h2>${isNew ? 'Add game' : 'Edit game'}</h2>
      <p>${isNew ? 'Pick the game’s executable. The name, install folder and artwork fill in automatically.' : esc(game.name)}</p>
      <div class="editor">
        <div>
          <div class="field"><span>Launch with</span>
            ${chipGroup('launch', [['exe', 'Program file'], ['steam', 'Steam'], ['uri', 'Launcher link']], launchType)}</div>
          <label class="field" data-for="exe"><span>Executable</span>
            <span class="input-row"><input class="input" data-nav data-f="exe" placeholder="A:\\games\\My Game\\game.exe" value="${esc(game?.exe)}">
            <button class="btn btn-secondary btn-sm" data-nav data-browse="exe">Browse</button></span></label>
          <label class="field" data-for="uri"><span>Launcher link</span>
            <input class="input" data-nav data-f="launchUri" placeholder="com.epicgames.launcher://apps/…" value="${esc(game?.launch?.uri)}"></label>
          <label class="field"><span data-steam-label>Steam App ID</span>
            <input class="input" data-nav data-f="steamAppId" inputmode="numeric" placeholder="e.g. 1145360 (also used for artwork and trophies)" value="${esc(game?.steamAppId)}"></label>
          <label class="field"><span>Name</span><input class="input" data-nav data-f="name" value="${esc(game?.name)}" placeholder="Game name"></label>
          <label class="field"><span>Install folder (used for size and playtime tracking)</span>
            <span class="input-row"><input class="input" data-nav data-f="folder" value="${esc(game?.folder)}" placeholder="Detected from the executable">
            <button class="btn btn-secondary btn-sm" data-nav data-browse="dir">Browse</button></span></label>
          <label class="field"><span>Launch options (optional)</span><input class="input" data-nav data-f="args" value="${esc(game?.args)}" placeholder="-fullscreen -dx12"></label>
          <label class="field" data-for="exe"><span>Start in folder (optional)</span>
            <span class="input-row"><input class="input" data-nav data-f="workDir" value="${esc(game?.workDir)}" placeholder="Defaults to the executable’s folder">
            <button class="btn btn-secondary btn-sm" data-nav data-browse="work">Browse</button></span></label>
          <div class="field-row">
            <div class="field" data-for="exe"><span>Run as administrator</span>${chipGroup('admin', [['1', 'Yes'], ['0', 'No']], admin ? '1' : '0')}</div>
            <div class="field"><span>Discord status</span>${chipGroup('discord', [['auto', 'Automatic'], ['always', 'Always'], ['never', 'Never']], discord)}</div>
          </div>
          <label class="field"><span>Playtime before using the library (hours)</span>
            <input class="input" data-nav data-f="previousHours" type="number" min="0" step="0.5" value="${game?.importedMs ? Math.round(game.importedMs / 360000) / 10 : ''}" placeholder="0"></label>
          <p class="form-error" data-error></p>
        </div>
        <div>
          <div class="art-head"><span>Artwork</span><button class="btn btn-primary btn-sm" data-nav data-find>${ICON.search}Find artwork online</button></div>
          ${slot('cover', 'square')}
          ${slot('background', 'wide')}
          ${slot('logo', 'logo')}
          <div class="slot-hint">Tip: select an image box and press Ctrl+V to paste a copied image, or drop a file on it.</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-nav data-cancel>Cancel</button>
        <button class="btn btn-primary" data-nav data-save>${isNew ? 'Add to library' : 'Save'}</button>
      </div>
      <input type="file" accept="image/*" hidden data-file>
    </div>`);

  const f = (k) => layer.querySelector(`[data-f="${k}"]`);
  const objectUrls = [];
  function syncLaunch() {
    $$('[data-for]', layer).forEach((el) => { el.hidden = el.dataset.for !== launchType && !(el.dataset.for === 'exe' && launchType === 'exe'); });
    layer.querySelector('[data-steam-label]').textContent = launchType === 'steam' ? 'Steam App ID (required)' : 'Steam App ID (optional: artwork and trophies)';
    $$('[data-group="launch"] .chip', layer).forEach((c) => c.classList.toggle('is-active', c.dataset.opt === launchType));
  }
  syncLaunch();
  function paintSlot(kind) {
    const btn = layer.querySelector(`[data-choose="${kind}"]`);
    const p = pendingImg[kind];
    let src = null;
    if (p?.blob) { src = URL.createObjectURL(p.blob); objectUrls.push(src); }
    else if (p?.url) src = p.url;
    else if (p?.path) src = `/api/preview?path=${encodeURIComponent(p.path)}`;
    else if (!p?.remove) src = game?.[kind] || null;
    btn.innerHTML = src ? `<img src="${esc(src)}" alt="">` : 'Choose image';
  }
  IMAGE_KINDS.forEach(paintSlot);

  const setImg = (kind, value) => { pendingImg[kind] = value; paintSlot(kind); };
  const fileInput = layer.querySelector('[data-file]');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) setImg(fileInput.dataset.kind, { blob: file });
    fileInput.value = '';
  });

  async function onExeChosen(exe) {
    f('exe').value = exe;
    try {
      const s = await api(`/api/suggest?exe=${encodeURIComponent(exe)}`);
      if (!f('name').value.trim()) f('name').value = s.name;
      if (!f('folder').value.trim() || isNew) f('folder').value = s.folder;
    } catch {}
  }
  f('exe').addEventListener('change', () => f('exe').value.trim() && onExeChosen(f('exe').value.trim()));

  async function findArtwork() {
    const pick = await artworkSearchDialog(f('name').value.trim() || game?.name || '');
    if (!pick) return;
    toast(`Loading artwork for ${pick.name}…`);
    try {
      const a = await api(`/api/artwork/assets?appid=${pick.appid}`);
      const found = IMAGE_KINDS.filter((k) => a[k]);
      found.forEach((k) => setImg(k, { url: a[k] }));
      if (!f('name').value.trim()) f('name').value = pick.name;
      if (!f('steamAppId').value.trim()) f('steamAppId').value = String(pick.appid);
      toast(found.length ? `Found ${found.map((k) => KIND_LABEL[k].toLowerCase()).join(', ')} for ${pick.name}` : 'No artwork found for that game');
    } catch (e) {
      toast(e.message);
    }
  }

  layer.addEventListener('focusin', (e) => { const s = e.target.closest('[data-slot]'); if (s) lastSlot = s.dataset.slot; });
  layer.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); setImg(lastSlot, { blob: item.getAsFile() }); toast(`Pasted ${KIND_LABEL[lastSlot].toLowerCase()}`); return; }
    const text = e.clipboardData?.getData('text') || '';
    if (/^https?:\/\/\S+$/i.test(text.trim()) && e.target.closest('[data-slot]')) { e.preventDefault(); setImg(lastSlot, { url: text.trim() }); }
  });
  $$('.slot-preview', layer).forEach((el) => {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('is-drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('is-drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('is-drop');
      const file = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
      if (file) return setImg(el.dataset.choose, { blob: file });
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text');
      if (/^https?:\/\//i.test(url)) setImg(el.dataset.choose, { url: url.trim() });
    });
  });

  layer.addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-opt]');
    if (opt) {
      const group = opt.closest('[data-group]').dataset.group;
      if (group === 'launch') { launchType = opt.dataset.opt; syncLaunch(); return; }
      if (group === 'admin') admin = opt.dataset.opt === '1';
      if (group === 'discord') discord = opt.dataset.opt;
      $$('.chip', opt.parentElement).forEach((c) => c.classList.toggle('is-active', c === opt));
      return;
    }
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.choose) { fileInput.dataset.kind = t.dataset.choose; fileInput.click(); }
    else if (t.hasAttribute('data-find')) findArtwork();
    else if (t.dataset.browseImg) {
      const p = await browseDialog({ title: 'Choose an image', filter: 'image', start: f('folder').value || state.settings.gamesRoot });
      if (p) setImg(t.dataset.browseImg, { path: p });
    } else if (t.dataset.url) {
      const u = await promptDialog('Image URL', 'Paste a link to a JPG, PNG or WebP image', '', 'https://…');
      if (u) setImg(t.dataset.url, { url: u });
    } else if (t.dataset.clear) setImg(t.dataset.clear, { remove: true });
    else if (t.dataset.browse === 'exe') {
      const p = await browseDialog({ title: 'Choose the game executable', filter: 'exe', start: f('folder').value || state.settings.gamesRoot });
      if (p) onExeChosen(p);
    } else if (t.dataset.browse === 'dir') {
      const p = await browseDialog({ title: 'Choose the install folder', filter: 'dir', start: f('folder').value || state.settings.gamesRoot });
      if (p) f('folder').value = p;
    } else if (t.dataset.browse === 'work') {
      const p = await browseDialog({ title: 'Choose the start-in folder', filter: 'dir', start: f('workDir').value || f('folder').value || state.settings.gamesRoot });
      if (p) f('workDir').value = p;
    } else if (t.hasAttribute('data-cancel')) closeLayer(layer);
    else if (t.hasAttribute('data-save')) save(t);
  });

  async function save(btn) {
    const err = layer.querySelector('[data-error]');
    err.textContent = '';
    const steamAppId = f('steamAppId').value.trim();
    const body = {
      name: f('name').value.trim(), launchType, exe: f('exe').value.trim(), folder: f('folder').value.trim(), args: f('args').value.trim(),
      workDir: f('workDir').value.trim(), admin, discord, steamAppId, launchId: steamAppId, launchUri: f('launchUri').value.trim(),
      previousHours: f('previousHours').value.trim() || 0,
    };
    if (launchType === 'exe' && !body.exe) { err.textContent = 'Choose the game’s executable.'; return focusEl(f('exe')); }
    if (launchType === 'steam' && !steamAppId) { err.textContent = 'Enter the Steam App ID.'; return focusEl(f('steamAppId')); }
    if (launchType === 'uri' && !body.launchUri) { err.textContent = 'Enter the launcher link.'; return focusEl(f('launchUri')); }
    if (!body.name) { err.textContent = 'Give the game a name.'; return focusEl(f('name')); }
    btn.disabled = true;
    try {
      const saved = isNew
        ? await api('/api/games', { method: 'POST', json: { ...body, autoArtwork: !Object.values(pendingImg).some(Boolean) } })
        : await api(`/api/games/${game.id}`, { method: 'PATCH', json: body });
      for (const kind of IMAGE_KINDS) {
        const p = pendingImg[kind];
        if (!p) continue;
        const url = `/api/games/${saved.id}/image?kind=${kind}`;
        try {
          if (p.remove) await api(url, { method: 'DELETE' });
          else if (p.blob) await api(url, { method: 'POST', body: p.blob, headers: { 'Content-Type': p.blob.type || 'image/png' } });
          else await api(url, { method: 'POST', json: p.url ? { url: p.url } : { path: p.path } });
        } catch (imgErr) {
          toast(`${KIND_LABEL[kind]}: ${imgErr.message}`, 5000);
        }
      }
      objectUrls.forEach(URL.revokeObjectURL);
      closeLayer(layer);
      await refresh();
      if (isNew) {
        setView('home', { focus: false });
        select(saved.id);
        focusSelectedTile();
        if (state.settings.autoArtwork) watchArtwork();
      }
      toast(isNew ? `${saved.name} added to your library` : 'Changes saved');
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  }

  if (findArt) findArtwork();
}

// Poll faster while artwork downloads so new art appears promptly.
let artworkWatch = null;
function watchArtwork() {
  if (artworkWatch) return;
  let idle = 0;
  artworkWatch = setInterval(async () => {
    await refresh();
    idle = state.busy.artwork ? 0 : idle + 1;
    if (idle >= 2) { clearInterval(artworkWatch); artworkWatch = null; }
  }, 1500);
}

/* ----- On-screen keyboard ----- */
const KB_PAGES = {
  abc: ['1234567890', 'qwertyuiop', "asdfghjkl'", 'zxcvbnm-:.'],
  sym: ['!@#$%^&*()', '-_=+[]{}\\|', '/<>?"\';:~`', ',.@#%&*!?_'],
};

function openKeyboard(input) {
  const multiline = input.tagName === 'TEXTAREA';
  let page = 'abc';
  const layer = openLayer(`
    <div class="keyboard" role="dialog" aria-label="Keyboard">
      <div class="kb-preview${multiline ? ' kb-preview--multi' : ''}" data-preview></div>
      <div data-rows></div>
      <div class="kb-row">
        <button class="key key-mid" data-nav data-k="shift">Shift</button>
        <button class="key key-mid" data-nav data-k="page" data-page>#+=</button>
        <button class="key key-mid key-space" data-nav data-k=" ">Space</button>
        ${multiline ? '<button class="key key-mid" data-nav data-k="enter">Enter</button>' : ''}
        <button class="key key-mid" data-nav data-k="back">Delete</button>
        <button class="key key-mid key-done" data-nav data-k="done">Done</button>
      </div>
    </div>`, {
    className: 'layer-keyboard',
    onClose: () => input.dispatchEvent(new Event('change', { bubbles: true })),
    actions: { options: () => type('back'), search: () => type(' ') },
  });
  let shift = false;
  const paintRows = () => {
    const focusedKey = layer.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    layer.querySelector('[data-rows]').innerHTML = KB_PAGES[page].map((r) => `<div class="kb-row">${[...r].map((c) => `<button class="key" data-nav data-k="${esc(c)}">${esc(c)}</button>`).join('')}</div>`).join('');
    layer.querySelector('[data-page]').textContent = page === 'abc' ? '#+=' : 'abc';
    if (focusedKey && !['page', 'shift'].includes(focusedKey)) layer.querySelector(`[data-rows] [data-k="${CSS.escape(focusedKey)}"]`)?.focus({ preventScroll: true });
  };
  const paint = () => {
    const v = input.value;
    layer.querySelector('[data-preview]').innerHTML = v ? `${esc(v)}<span class="caret"></span>` : `<span class="caret"></span><span class="placeholder">${esc(input.placeholder)}</span>`;
    $$('[data-rows] [data-k]', layer).forEach((k) => { if (/^[a-z]$/.test(k.dataset.k)) k.textContent = shift ? k.dataset.k.toUpperCase() : k.dataset.k; });
    layer.querySelector('[data-k="shift"]').classList.toggle('is-active', shift);
  };
  function type(k) {
    if (k === 'done') return closeLayer(layer);
    if (k === 'shift') { shift = !shift; return paint(); }
    if (k === 'page') { page = page === 'abc' ? 'sym' : 'abc'; paintRows(); return paint(); }
    const max = Number(input.maxLength) > 0 ? Number(input.maxLength) : Infinity;
    if (k === 'back') input.value = input.value.slice(0, -1);
    else if (input.value.length < max) input.value += k === 'enter' ? '\n' : shift ? k.toUpperCase() : k;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    paint();
  }
  layer.addEventListener('click', (e) => { const k = e.target.closest('[data-k]'); if (k) type(k.dataset.k); });
  paintRows();
  paint();
}

/* ======================= Spatial navigation ======================= */
const isVisible = (el) => el.getClientRects().length > 0;

function focusables(scope) {
  return $$('[data-nav]', scope).filter((el) => !el.disabled && isVisible(el) && (scope !== document.body || !el.closest('#layers')));
}

function focusEl(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  if (!el.closest('#track')) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function nearest(cur, items, dir) {
  const r = cur.getBoundingClientRect();
  const horizontal = dir === 'left' || dir === 'right';
  let best = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    let gap, cross, centerDelta;
    if (horizontal) {
      const d = (b.left + b.right) / 2 - (r.left + r.right) / 2;
      if (dir === 'right' ? d <= 1 : d >= -1) continue;
      gap = dir === 'right' ? b.left - r.right : r.left - b.right;
      cross = Math.max(0, Math.max(r.top, b.top) - Math.min(r.bottom, b.bottom));
      if (cross > 0) continue; // stay on the same row
      centerDelta = Math.abs((b.top + b.bottom) / 2 - (r.top + r.bottom) / 2);
    } else {
      // Must genuinely sit above/below (tolerance covers the focus scale-up).
      const tol = Math.max(6, Math.min(r.width, r.height) * 0.12);
      if (dir === 'down' ? b.top < r.bottom - tol : b.bottom > r.top + tol) continue;
      gap = dir === 'down' ? b.top - r.bottom : r.top - b.bottom;
      cross = Math.max(0, Math.max(r.left, b.left) - Math.min(r.right, b.right));
      centerDelta = Math.abs((b.left + b.right) / 2 - (r.left + r.right) / 2);
    }
    const score = Math.max(0, gap) + cross * 2 + centerDelta * 0.1;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

// Views and dialogs can claim a direction before the generic spatial search runs: (dir, cur, layer, helpers) => handled.
const navHooks = [];

function move(dir, { repeat = false } = {}) {
  const layer = topLayer();
  const cur = document.activeElement;
  const go = (el) => { if (el) { focusEl(el); sfx.move(); } else if (!repeat) sfx.bump(); };
  for (const hook of navHooks) if (hook(dir, cur, layer, { go, repeat })) return;

  if (!layer && state.view === 'home') {
    const tile = $(`#track [data-id="${state.selectedId}"]`);
    if (cur?.closest('#track')) {
      if (dir === 'left' || dir === 'right') return stepCarousel(dir === 'right' ? 1 : -1, !repeat);
      if (dir === 'down') return go($('#stage [data-nav]'));
      return go($('.tab.is-active'));
    }
    if (cur?.closest('#stage')) {
      const best = nearest(cur, focusables($('#stage')), dir);
      if (best) return go(best);
      return go(dir === 'up' ? tile : null);
    }
    if (cur?.closest('.topbar') && dir === 'down') return go(tile);
  }
  if (!layer && state.view === 'library' && cur?.closest('.topbar') && dir === 'down') return go($('#search'));
  if (!layer && (state.view === 'stats' || state.view === 'settings') && cur?.closest('.topbar') && dir === 'down') {
    return go($(state.view === 'stats' ? '#view-stats [data-nav]' : '#view-settings .rail-item.is-active'));
  }

  const items = focusables(layer || document.body);
  if (!items.length) return;
  if (!items.includes(cur)) {
    if (!layer && state.view === 'home') return focusSelectedTile();
    return focusEl(items[0]);
  }
  const target = nearest(cur, items, dir);
  // Reaching past the first or last row of a scrolling view should still scroll it into place.
  if (!target && !layer && (dir === 'up' || dir === 'down')) {
    const scroller = cur.closest('.view, .settings-panel');
    if (scroller && scroller.scrollHeight > scroller.clientHeight) {
      const before = scroller.scrollTop;
      scroller.scrollBy({ top: dir === 'down' ? scroller.clientHeight * 0.6 : -scroller.clientHeight * 0.6, behavior: 'smooth' });
      return scroller.scrollTop === before && dir === 'up' ? go($('.tab.is-active')) : undefined;
    }
  }
  go(target);
}

/* ======================= Input: actions ======================= */
function confirmAction() {
  const el = document.activeElement;
  if (!el || el === document.body) return move('down');
  if (el.matches('input:not([type=file]), textarea')) return openKeyboard(el);
  el.click();
}

function back() {
  const layer = topLayer();
  sfx.back();
  if (hideLaunchSplash()) return;
  if (layer) return closeLayer(layer);
  if (state.view === 'settings') return setView(state.prevView || 'home');
  if (state.view !== 'home') return setView('home');
  focusSelectedTile();
}

function optionsAction() {
  const layer = topLayer();
  if (layer) return layer._actions.options?.();
  const el = document.activeElement;
  if (state.view === 'home' && state.selectedId === EXPLORE_ID) { sfx.select(); return openWallpaperMenu(); }
  const id = el?.closest('[data-id]')?.dataset.id || el?.closest('[data-go]')?.dataset.go || (el?.closest('#stage') ? state.selectedId : null);
  if (byId(id)) { sfx.select(); openGameMenu(id); }
}

function searchAction() {
  const layer = topLayer();
  if (layer) return layer._actions.search?.();
  sfx.select();
  openSearch();
}

function settingsAction() {
  if (topLayer()) return;
  sfx.select();
  if (state.view === 'settings') back();
  else setView('settings');
}

function switchTab(delta = 1) {
  if (topLayer()) return;
  sfx.move();
  const here = TAB_ORDER.indexOf(state.view === 'settings' ? state.prevView : state.view);
  setView(TAB_ORDER[(Math.max(0, here) + delta + TAB_ORDER.length) % TAB_ORDER.length]);
}

/* ----- Keyboard ----- */
document.addEventListener('keydown', (e) => {
  if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) setDevice('key');
  const t = e.target;
  const typing = t.matches?.('input:not([type=file]), textarea');
  const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (dirs[e.key]) {
    if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const atEdge = e.key === 'ArrowLeft' ? t.selectionStart === 0 && t.selectionEnd === 0 : t.selectionEnd === t.value.length;
      if (!atEdge) return;
    }
    if (t.tagName === 'TEXTAREA' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const atEdge = e.key === 'ArrowUp' ? t.selectionStart === 0 : t.selectionEnd === t.value.length;
      if (!atEdge) return;
    }
    e.preventDefault();
    return move(dirs[e.key], { repeat: e.repeat });
  }
  if (e.key === 'Escape') { e.preventDefault(); return back(); }
  if (typing) {
    if (e.key === 'Enter' && t.tagName !== 'TEXTAREA') { e.preventDefault(); t.dispatchEvent(new Event('change', { bubbles: true })); move('down'); }
    return;
  }
  if (e.key === 'Backspace') { e.preventDefault(); return back(); }
  if (e.key === '/') { e.preventDefault(); return searchAction(); }
  if (e.key === 'q' || e.key === 'e') return switchTab(e.key === 'e' ? 1 : -1);
  if (e.key === 'o') return optionsAction();
});

document.addEventListener('mousemove', (e) => { if (e.movementX || e.movementY) setDevice('mouse'); }, { passive: true });
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-nav]');
  if (el && !el.closest('#track')) sfx.select();
}, true);

/* ----- Gamepad ----- */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const padPrev = {};
const padRepeat = {};
let padLoopRunning = false;
let padCount = 0;
const DEADZONE = { low: 0.4, normal: 0.55, high: 0.7 };

const connectedPads = () => [...(navigator.getGamepads?.() || [])].filter(Boolean);

function padLoop() {
  const pads = connectedPads();
  if (pads.length !== padCount) { padCount = pads.length; onPadsChanged(); }
  if (!pads.length) { padLoopRunning = false; return; }
  if (document.hasFocus() && !document.hidden) {
    const pressed = (i) => pads.some((p) => p.buttons[i]?.pressed);
    const axis = (i) => pads.reduce((v, p) => (Math.abs(p.axes[i] || 0) > Math.abs(v) ? p.axes[i] : v), 0);
    const lx = axis(0), ly = axis(1);
    const now = performance.now();
    const dz = DEADZONE[state.settings.stickDeadzone] || 0.55;
    const dirs = {
      up: pressed(PAD.UP) || ly < -dz,
      down: pressed(PAD.DOWN) || ly > dz,
      left: pressed(PAD.LEFT) || lx < -dz,
      right: pressed(PAD.RIGHT) || lx > dz,
    };
    // The right stick scrolls whatever is on screen.
    const ry = axis(3);
    if (Math.abs(ry) > 0.35) {
      const layer = topLayer();
      const box = layer ? layer.querySelector('.menu-list, .modal, .keyboard') : $('.view:not([hidden])');
      box?.scrollBy({ top: ry * 22 });
    }
    for (const [dir, on] of Object.entries(dirs)) {
      if (on && !padPrev[dir]) { padRepeat[dir] = now + 380; setDevice('pad'); move(dir); }
      else if (on && now >= padRepeat[dir]) { padRepeat[dir] = now + 120; move(dir, { repeat: true }); }
      padPrev[dir] = on;
    }
    // In some regions ○ confirms and ✕ goes back.
    const swap = state.settings.confirmButton === 'circle';
    const buttons = {
      A: swap ? back : confirmAction, B: swap ? confirmAction : back, X: optionsAction, Y: searchAction,
      START: settingsAction, SELECT: settingsAction, LB: () => switchTab(-1), RB: () => switchTab(1),
    };
    for (const [name, fn] of Object.entries(buttons)) {
      const on = pressed(PAD[name]);
      if (on && !padPrev[name]) { setDevice('pad'); fn(); }
      padPrev[name] = on;
    }
  } else {
    // Ignore input while a game has focus, and don't replay held buttons on return.
    for (const k of Object.keys(padPrev)) padPrev[k] = true;
  }
  requestAnimationFrame(padLoop);
}

function startPadLoop() {
  if (padLoopRunning) return;
  padLoopRunning = true;
  requestAnimationFrame(padLoop);
}
window.addEventListener('gamepadconnected', () => {
  setDevice('pad');
  startPadLoop();
  if (!document.activeElement || document.activeElement === document.body) focusSelectedTile();
});
window.addEventListener('gamepaddisconnected', () => onPadsChanged());
window.addEventListener('focus', () => { if (connectedPads().length) startPadLoop(); });

/* ======================= Event wiring ======================= */
$('#btn-search').innerHTML = ICON.search;
$('#btn-settings').innerHTML = ICON.gear;
$('#search-icon').innerHTML = ICON.search;

$$('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
$('#btn-search').addEventListener('click', openSearch);
$('#btn-settings').addEventListener('click', () => setView(state.view === 'settings' ? state.prevView : 'settings'));
$('#btn-avatar').addEventListener('click', () => { setView('settings', { focus: false }); openSettingsCategory('profile'); });
$('#btn-add').addEventListener('click', () => openGameEditor(null));
$('#btn-scan').addEventListener('click', () => scanFolder());
$('#btn-random').addEventListener('click', () => pickRandomGame());

const carousel = $('#carousel');
const track = $('#track');
carousel.addEventListener('scroll', () => { carousel.scrollLeft = 0; carousel.scrollTop = 0; });
track.addEventListener('focusin', (e) => { const t = e.target.closest('.tile'); if (t) select(t.dataset.id); });
track.addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (!t) return;
  if (t.dataset.id !== state.selectedId) { select(t.dataset.id); t.focus({ preventScroll: true }); sfx.move(); return; }
  if (t.dataset.id !== EXPLORE_ID) sfx.select();
  activateItem(t.dataset.id);
});
let wheelAt = 0;
carousel.addEventListener('wheel', (e) => {
  e.preventDefault();
  const now = performance.now();
  if (now - wheelAt < 140) return;
  wheelAt = now;
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (delta) stepCarousel(delta > 0 ? 1 : -1, false);
}, { passive: false });

const stage = $('#stage');
stage.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'play') return launchGame(state.selectedId);
  if (a === 'menu') return openGameMenu(state.selectedId);
  if (a === 'favorite') return toggleFavorite(state.selectedId);
  if (a === 'trophies') return openTrophies(state.selectedId);
  if (a === 'notes') return openNotes(state.selectedId);
  if (a === 'game-stats') return openGameStats(state.selectedId);
  if (a === 'edit') return openGameEditor(byId(state.selectedId));
  if (a === 'add') return openGameEditor(null);
  if (a === 'scan') return scanFolder();
  if (a === 'wallpaper') return openWallpaperMenu();
  if (a === 'open-library') return setView('library');
  const w = e.target.closest('.widget');
  if (w?.dataset.go) return goToGame(w.dataset.go);
  if (w?.dataset.open === 'library') return setView('library');
});
stage.addEventListener('wheel', (e) => {
  const widgets = e.target.closest('#widgets');
  if (widgets && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { widgets.scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive: false });

const grid = $('#library-grid');
grid.addEventListener('focusin', (e) => {
  const c = e.target.closest('.lib-card');
  if (!c) return;
  state.libSelectedId = c.dataset.id;
  if (state.view === 'library') updateBackdrop();
});
grid.addEventListener('mouseover', (e) => {
  const c = e.target.closest('.lib-card');
  if (c && state.device === 'mouse' && document.activeElement !== c && !topLayer()) c.focus({ preventScroll: true });
});
grid.addEventListener('click', (e) => { const c = e.target.closest('.lib-card'); if (c) goToGame(c.dataset.id); });

$('#search').addEventListener('input', (e) => { state.query = e.target.value; renderLibrary(); });
$('#sort-chips').addEventListener('click', (e) => { const c = e.target.closest('[data-sort]'); if (c) { state.sort = c.dataset.sort; renderLibrary(); } });
$('#filter-chips').addEventListener('click', (e) => { const c = e.target.closest('[data-filter]'); if (c) { state.filter = c.dataset.filter; renderLibrary(); } });

/* ======================= Clock + polling ======================= */
function tickClock() {
  const d = new Date();
  let h = d.getHours();
  let suffix = '';
  if (!state.settings.clock24) { suffix = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; }
  const secs = state.settings.showSeconds ? `:${pad(d.getSeconds())}` : '';
  $('#clock').textContent = `${state.settings.clock24 ? pad(h) : h}:${pad(d.getMinutes())}${secs}${suffix}`;
  updateElapsed();
}
function updateElapsed() {
  $$('[data-elapsed-since]').forEach((el) => { el.textContent = fmtElapsed(Date.now() - Number(el.dataset.elapsedSince)); });
}
(function clockLoop() { tickClock(); setTimeout(clockLoop, 1000 - (Date.now() % 1000) + 5); })();

setInterval(() => {
  if (document.hidden) fetch('/api/ping').catch(() => {}); // keep the service alive while minimised
  else refresh();
}, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
// Freeze the Explore animation while a game (or anything else) has focus.
const syncIdle = () => document.documentElement.classList.toggle('is-idle', !document.hasFocus());
window.addEventListener('blur', syncIdle);
window.addEventListener('focus', syncIdle);
