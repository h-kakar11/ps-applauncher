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
const MUSIC_ID = '__music';
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
};

Object.assign(ICON, {
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5.6v12.8a.8.8 0 0 1-1.25.66L9.6 12.66a.8.8 0 0 1 0-1.32l9.15-6.4A.8.8 0 0 1 20 5.6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5.6v12.8a.8.8 0 0 0 1.25.66l9.15-6.4a.8.8 0 0 0 0-1.32L5.25 4.94A.8.8 0 0 0 4 5.6z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
});

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
  games: [], drives: {}, busy: {},
  settings: { clock24: true, gamesRoot: '', sounds: true, autoArtwork: true, profileName: '' },
  view: 'home', selectedId: null, libSelectedId: null, items: [],
  sort: 'recent', query: '', device: 'pad', offline: false,
  spotify: { configured: false, connected: false, active: false, isPlaying: false, track: null, progressMs: 0, at: 0, error: null },
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
    case 'size': return list.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0) || byName(a, b));
    default: return list.sort((a, b) => recentKey(b) - recentKey(a) || byName(a, b));
  }
}

async function refresh() {
  try {
    const s = await api('/api/state');
    state.games = s.games;
    state.settings = s.settings;
    state.drives = s.drives;
    state.busy = s.busy || {};
    if (s.spotify) { state.spotify.configured = s.spotify.configured; state.spotify.connected = s.spotify.connected; }
    if (state.offline) { state.offline = false; toast('Reconnected'); }
    renderAll();
  } catch {
    if (!state.offline) { state.offline = true; toast('The library service stopped. Reopen the app to reconnect.', 8000); }
  }
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
      for (const [freq, at, dur, gain, glideTo] of notes) {
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
  };
})();

/* ======================= Backdrop ======================= */
let bgFront = $('#bg-a'), bgBack = $('#bg-b'), bgTimer;
const backdrop = { key: null };

function showScene(mode) {
  const key = `scene:${mode}`;
  if (backdrop.key === key) return;
  backdrop.key = key;
  clearTimeout(bgTimer);
  const scene = $('#scene');
  scene.classList.toggle('scene--quiet', mode === 'quiet');
  scene.classList.add('is-visible');
  bgFront.classList.remove('is-visible');
  bgBack.classList.remove('is-visible');
  $('#scrim').classList.remove('is-visible');
}

function showImage(url, ambient) {
  const key = `${ambient ? 'ambient' : 'photo'}:${url}`;
  if (backdrop.key === key) return;
  backdrop.key = key;
  clearTimeout(bgTimer);
  bgTimer = setTimeout(() => {
    const img = new Image();
    img.onload = () => {
      if (backdrop.key !== key) return;
      bgBack.style.backgroundImage = `url("${url}")`;
      bgBack.classList.toggle('is-ambient', !!ambient);
      bgBack.classList.remove('is-visible');
      void bgBack.offsetWidth; // restart the settle animation
      bgBack.classList.add('is-visible');
      bgFront.classList.remove('is-visible');
      [bgFront, bgBack] = [bgBack, bgFront];
      $('#scene').classList.remove('is-visible');
      $('#scrim').classList.add('is-visible');
    };
    img.src = url;
  }, 90);
}

function backdropFor(g) {
  if (g?.background) showImage(g.background, false);
  else if (g?.cover) showImage(g.cover, true);
  else showScene('quiet');
}

function updateBackdrop() {
  if (state.view === 'library') return backdropFor(byId(state.libSelectedId));
  if (state.selectedId === EXPLORE_ID) return showScene('full');
  if (state.selectedId === MUSIC_ID) return state.spotify.track?.art ? showImage(state.spotify.track.art, true) : showScene('quiet');
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
  const games = sortedGames('recent');
  return [
    { id: EXPLORE_ID, kind: 'explore', name: 'Explore' },
    { id: MUSIC_ID, kind: 'music', name: 'Music' },
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
      ${artHtml(g)}${g.status === 'running' ? '<span class="tile-dot" title="Playing"></span>' : ''}
      <span class="tile-label">${esc(g.name)}</span></button>`;
  }
  const icon = { explore: ICON.explore, music: ICON.music, library: ICON.library, add: ICON.plus }[item.kind];
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
  const sig = JSON.stringify(items.map((i) => [i.id, i.name, i.g?.cover, i.g?.status, i.g?.exeExists]));
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
  if (id === MUSIC_ID) pollSpotify();
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
  if (id === EXPLORE_ID || id === MUSIC_ID) return focusEl($('#stage [data-nav]'));
  launchGame(id);
}

/* ======================= Stage: game hero / Explore ======================= */
let stageHtml = '';

function renderStage() {
  const stage = $('#stage');
  const id = state.selectedId;
  const g = byId(id);
  const key = id === EXPLORE_ID ? 'explore' : id === MUSIC_ID ? 'music' : g ? `game:${g.id}` : id === LIBRARY_ID ? 'library' : 'add';
  const html = key === 'explore' ? exploreHtml() : key === 'music' ? musicHtml() : g ? gameHeroHtml(g) : key === 'library' ? libraryHeroHtml() : addHeroHtml();
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
    updateMusicProgress();
  }
  if (state.view === 'home') updateBackdrop();
}

function gameHeroHtml(g) {
  const running = g.status === 'running';
  const meta = [];
  if (running) meta.push(`<span class="meta-item meta-live">Playing <span data-elapsed-since="${g.runningSince}"></span></span>`);
  else if (g.status === 'starting') meta.push('<span class="meta-item meta-live">Starting…</span>');
  if (!g.exeExists) meta.push('<span class="meta-item meta-warn">Executable not found</span>');
  if (g.playMs >= 60000) meta.push(`<span class="meta-item">${ICON.clock}${fmtDuration(g.playMs)} played</span>`);
  else if (!running) meta.push(`<span class="meta-item">${ICON.clock}Not played yet</span>`);
  if (g.sizeBytes != null || g.sizing) meta.push(`<span class="meta-item">${ICON.drive}${g.sizeBytes != null ? fmtBytes(g.sizeBytes) : 'Calculating…'}</span>`);
  return `
    <div class="hero">
      ${g.logo ? `<img class="hero-logo" src="${esc(g.logo)}" alt="${esc(g.name)}">` : `<h1 class="hero-title">${esc(g.name)}</h1>`}
      <p class="hero-meta">${meta.join('<span class="meta-sep"></span>')}</p>
      <div class="hero-actions">
        ${g.exeExists
          ? `<button class="btn btn-primary btn-play" data-nav data-key="play" data-action="play">${running ? 'Running' : 'Play'}</button>`
          : `<button class="btn btn-primary btn-play" data-nav data-key="edit" data-action="edit">Fix path</button>`}
        <button class="btn btn-circle" data-nav data-key="more" data-action="menu" aria-label="Options">${ICON.more}</button>
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

function controllerNames() {
  return [...(navigator.getGamepads?.() || [])].filter(Boolean).map((p) => {
    const s = p.id.toLowerCase();
    if (s.includes('dualsense') || (s.includes('054c') && /0ce6|0df2/.test(s))) return s.includes('0df2') || s.includes('edge') ? 'DualSense Edge' : 'DualSense';
    if (s.includes('054c') || s.includes('dualshock')) return 'DualShock 4';
    if (/xinput|xbox|045e/.test(s)) return 'Xbox Controller';
    if (s.includes('057e') || s.includes('pro controller')) return 'Pro Controller';
    return p.id.split('(')[0].trim().slice(0, 22) || 'Controller';
  });
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
  const pads = controllerNames();
  const devices = [
    pads[0] ? { icon: ICON.gamepad, name: pads[0], sub: 'Connected', on: true } : { icon: ICON.gamepad, name: 'Controller', sub: 'Press a button', on: false },
    pads[1] ? { icon: ICON.gamepad, name: pads[1], sub: 'Connected', on: true } : { icon: ICON.keyboard, name: 'Keyboard', sub: 'Ready', on: true },
  ];
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
          ${devices.map((d) => `<div class="w-device"><span class="w-device-ring${d.on ? ' is-on' : ''}">${d.icon}</span><span class="w-device-text"><b>${esc(d.name)}</b><small>${d.sub}</small></span></div>`).join('')}
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
      <div class="w-col w-col--narrow">
        <article tabindex="0" class="widget w-library" data-nav data-key="w-library" data-open="library" style="--i:8">
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
        <article tabindex="0" class="widget w-alloc" data-nav data-key="w-alloc" style="--i:9">
          <h3 class="w-title">${ICON.pie}Allocation<span class="w-aside">${fmtBytes(t.size)}</span></h3>
          ${sized.length ? `<ul class="alloc">${sized.slice(0, 6).map((g) => `
            <li><div class="alloc-row"><span>${esc(g.name)}</span><span>${fmtBytes(g.sizeBytes)}</span></div>
            <div class="alloc-track"><div class="alloc-fill" style="width:${(g.sizeBytes / sized[0].sizeBytes) * 100}%"></div></div></li>`).join('')}</ul>`
            : '<p class="muted">Calculating game sizes…</p>'}
        </article>
      </div>
    </div>`;
}

/* ======================= Music (Spotify) ======================= */
const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

function currentProgress() {
  const sp = state.spotify;
  if (!sp.track) return 0;
  const p = sp.progressMs + (sp.isPlaying ? Date.now() - sp.at : 0);
  return Math.max(0, Math.min(p, sp.track.durationMs || p));
}

function musicHero(title, text, buttons) {
  return `
    <div class="hero">
      <h1 class="hero-title">${title}</h1>
      <p class="hero-meta"><span class="meta-item">${text}</span></p>
      <div class="hero-actions">${buttons}</div>
    </div>`;
}

// Progress is deliberately left out of this markup (it is updated in place) so the stage doesn't re-render every second.
function musicHtml() {
  const sp = state.spotify;
  if (!state.settings.spotifyClientId) {
    return musicHero('Spotify', 'Show what’s playing and control it from the library. It takes a minute to set up.',
      '<button class="btn btn-primary btn-play" data-nav data-key="setup" data-action="spotify-setup">Set up Spotify</button>');
  }
  if (!sp.connected) {
    return musicHero('Connect Spotify', 'Sign in once in your browser. Playback controls need Spotify Premium.',
      `<button class="btn btn-primary btn-play" data-nav data-key="connect" data-action="spotify-connect">Connect Spotify</button>
       <button class="btn btn-secondary" data-nav data-key="settings" data-action="spotify-setup">Settings</button>`);
  }
  const t = sp.track;
  const title = t ? t.name : 'Nothing playing';
  const sub = t ? [t.artists, t.album].filter(Boolean).join(' · ') : sp.error || 'Press play to resume on your Spotify device';
  return `
    <div class="player">
      <div class="player-art">${t?.art ? `<img src="${esc(t.art)}" alt="">` : `<span class="player-art-empty">${ICON.music}</span>`}</div>
      <div class="player-info">
        <b class="player-title">${esc(title)}</b>
        <span class="player-sub">${esc(sub)}</span>
      </div>
      <div class="player-progress" tabindex="0" data-nav data-key="seek" role="slider" aria-label="Seek" aria-valuemin="0">
        <span class="player-time" id="mp-cur">0:00</span>
        <span class="player-bar" id="mp-bar"><i id="mp-fill"></i></span>
        <span class="player-time" id="mp-dur">0:00</span>
      </div>
      <div class="player-controls">
        <button class="btn btn-circle" data-nav data-key="prev" data-action="mp-prev" aria-label="Previous">${ICON.prev}</button>
        <button class="btn btn-circle btn-circle--lg" data-nav data-key="toggle" data-action="mp-toggle" aria-label="${sp.isPlaying ? 'Pause' : 'Play'}">${sp.isPlaying ? ICON.pause : ICON.play}</button>
        <button class="btn btn-circle" data-nav data-key="next" data-action="mp-next" aria-label="Next">${ICON.next}</button>
      </div>
    </div>`;
}

function updateMusicProgress() {
  const fill = $('#mp-fill');
  if (!fill) return;
  const dur = state.spotify.track?.durationMs || 0;
  const pos = currentProgress();
  fill.style.transform = `scaleX(${dur ? Math.min(1, pos / dur) : 0})`;
  $('#mp-cur').textContent = fmtClock(pos);
  $('#mp-dur').textContent = fmtClock(dur);
  const bar = $('.player-progress');
  bar.setAttribute('aria-valuemax', Math.round(dur / 1000));
  bar.setAttribute('aria-valuenow', Math.round(pos / 1000));
}

let spotifyBusy = false;
async function pollSpotify() {
  if (spotifyBusy) return;
  spotifyBusy = true;
  try {
    const d = await api('/api/spotify/now');
    const was = state.spotify;
    state.spotify = {
      configured: d.configured, connected: d.connected, active: !!d.active, isPlaying: !!d.isPlaying,
      track: d.track || null, progressMs: d.progressMs || 0, at: Date.now(), error: d.error || null,
    };
    const b = $('[data-spotify-btn]');
    if (b) b.textContent = d.connected ? 'Disconnect Spotify' : 'Connect Spotify';
    if (state.selectedId === MUSIC_ID && state.view === 'home') {
      renderStage();
      if (was.track?.art !== state.spotify.track?.art) updateBackdrop();
    }
  } catch {
    /* the 5s state poll reports a stopped service */
  } finally {
    spotifyBusy = false;
  }
}

async function musicControl(action, extra) {
  const sp = state.spotify;
  if (action === 'play') { sp.isPlaying = true; sp.at = Date.now(); }
  if (action === 'pause') { sp.progressMs = currentProgress(); sp.isPlaying = false; sp.at = Date.now(); }
  if (action === 'next' || action === 'previous') sp.progressMs = 0, sp.at = Date.now();
  renderStage();
  try {
    await api('/api/spotify/control', { method: 'POST', json: { action, ...extra } });
  } catch (e) {
    toast(e.message);
  }
  setTimeout(pollSpotify, action === 'next' || action === 'previous' ? 600 : 300);
}

let seekTimer;
function seekTo(ms) {
  const sp = state.spotify;
  if (!sp.track) return;
  sp.progressMs = Math.max(0, Math.min(ms, sp.track.durationMs));
  sp.at = Date.now();
  updateMusicProgress();
  clearTimeout(seekTimer);
  seekTimer = setTimeout(() => musicControl('seek', { positionMs: Math.round(sp.progressMs) }), 350);
}

async function connectSpotify() {
  try {
    await api('/api/spotify/connect', { method: 'POST' });
  } catch (e) {
    return toast(e.message);
  }
  toast('Finish signing in to Spotify in your browser', 8000);
  let tries = 0;
  const timer = setInterval(async () => {
    await pollSpotify();
    if (state.spotify.connected) { clearInterval(timer); toast('Spotify connected'); renderStage(); }
    else if (++tries > 90) clearInterval(timer);
  }, 2000);
}

async function disconnectSpotify() {
  await api('/api/spotify/disconnect', { method: 'POST' }).catch(() => {});
  state.spotify = { ...state.spotify, connected: false, active: false, isPlaying: false, track: null };
  renderStage();
  updateBackdrop();
  const b = $('[data-spotify-btn]');
  if (b) b.textContent = 'Connect Spotify';
  toast('Spotify disconnected');
}

setInterval(() => {
  if (state.selectedId === MUSIC_ID && state.view === 'home' && !document.hidden && state.spotify.connected) pollSpotify();
}, 3000);
setInterval(() => {
  if (state.selectedId !== MUSIC_ID) return;
  updateMusicProgress();
  const t = state.spotify.track;
  if (t && state.spotify.isPlaying && currentProgress() >= t.durationMs && t.durationMs) pollSpotify(); // the next song has probably started
}, 250);

/* ======================= Library view ======================= */
function renderLibrary() {
  $$('#sort-chips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.sort === state.sort));
  const t = totals();
  $('#library-summary').textContent = `${t.count} ${t.count === 1 ? 'game' : 'games'} · ${fmtBytes(t.size)} · ${fmtDuration(t.play)} played`;

  const q = state.query.trim().toLowerCase();
  const games = sortedGames(state.sort).filter((g) => !q || g.name.toLowerCase().includes(q));
  const grid = $('#library-grid');
  const sig = JSON.stringify([q, state.sort, games.map((g) => [g.id, g.name, g.cover, g.status, Math.floor(g.playMs / 360000), g.sizeBytes])]);
  if (grid.dataset.sig === sig) return;
  const focusedId = grid.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  grid.dataset.sig = sig;
  grid.innerHTML = games.length
    ? games.map((g) => `
      <button class="lib-card${g.status === 'running' ? ' is-running' : ''}" data-nav data-id="${g.id}">
        <span class="lib-art">${artHtml(g)}</span>
        <span class="lib-name">${esc(g.name)}</span>
        <span class="lib-meta">${g.status === 'running' ? 'Playing now' : `${g.playMs >= 60000 ? fmtDuration(g.playMs) : 'Not played'} · ${g.sizeBytes != null ? fmtBytes(g.sizeBytes) : '…'}`}</span>
      </button>`).join('')
    : `<div class="empty">${q
        ? `<h2>No games match “${esc(state.query)}”</h2><p class="muted">Try a different name.</p>`
        : `<h2>No games yet</h2><p class="muted">Add a game or scan ${esc(state.settings.gamesRoot)}.</p>`}</div>`;
  if (focusedId) grid.querySelector(`[data-id="${focusedId}"]`)?.focus({ preventScroll: true });
}

function renderAll() {
  renderCarousel();
  renderStage();
  renderLibrary();
}

function setView(view, { focus = true } = {}) {
  state.view = view;
  $('#view-home').hidden = view !== 'home';
  $('#view-library').hidden = view !== 'library';
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === view));
  updateBackdrop();
  if (!focus) return;
  if (view === 'home') focusSelectedTile();
  else focusEl((state.libSelectedId && $(`#library-grid [data-id="${state.libSelectedId}"]`)) || $('#library-grid [data-nav]') || $('#search'));
}

/* ======================= Actions ======================= */
async function launchGame(id) {
  const g = byId(id);
  if (!g) return;
  if (g.status === 'running') return toast(`${g.name} is already running`);
  if (!g.exeExists) return toast('Executable not found. Edit the game to fix its path.');
  try {
    sfx.launch();
    toast(`Starting ${g.name}…`);
    await api(`/api/games/${id}/launch`, { method: 'POST' });
    g.status = 'starting';
    renderStage();
    setTimeout(refresh, 3000);
  } catch (e) {
    toast(e.message, 5000);
  }
}

async function scanFolder() {
  try {
    toast(`Scanning ${state.settings.gamesRoot}…`);
    const { added } = await api('/api/scan', { method: 'POST' });
    await refresh();
    toast(added.length ? `Added ${added.length} ${added.length === 1 ? 'game' : 'games'}: ${added.join(', ')}` : 'No new games found', 5000);
    if (added.length && state.settings.autoArtwork) watchArtwork();
  } catch (e) {
    toast(e.message, 5000);
  }
}

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
  else if (!topLayer()) (state.view === 'home' ? focusSelectedTile() : setView('library'));
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
            : `<button class="menu-item" data-nav data-pick="${esc(e.path)}">${filter === 'image' ? ICON.image : ICON.file}${esc(e.name)}</button>`);
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
  const layer = openLayer(`
    <div class="modal menu" role="dialog" aria-label="${esc(g.name)} options">
      <h2>${esc(g.name)}</h2>
      <button class="menu-item" data-nav data-m="play">${ICON.play}Play</button>
      <button class="menu-item" data-nav data-m="edit">${ICON.edit}Edit details and artwork</button>
      <button class="menu-item" data-nav data-m="art">${ICON.image}Find artwork online</button>
      <button class="menu-item" data-nav data-m="folder">${ICON.folder}Open install folder</button>
      <button class="menu-item" data-nav data-m="size">${ICON.refresh}Recalculate size<span class="sub">${fmtBytes(g.sizeBytes)}</span></button>
      <button class="menu-item" data-nav data-m="reset">${ICON.reset}Reset play statistics</button>
      <button class="menu-item" data-nav data-m="remove">${ICON.trash}Remove from library</button>
    </div>`);
  layer.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    closeLayer(layer);
    if (m === 'play') launchGame(id);
    if (m === 'edit') openGameEditor(g);
    if (m === 'art') openGameEditor(g, { findArt: true });
    if (m === 'folder') api(`/api/games/${id}/open-folder`, { method: 'POST' }).catch((err) => toast(err.message));
    if (m === 'size') { await api(`/api/games/${id}/rescan-size`, { method: 'POST' }); toast('Recalculating size…'); setTimeout(refresh, 1500); }
    if (m === 'reset' && await confirmDialog('Reset play statistics?', `All recorded sessions for ${g.name} will be cleared. This can't be undone.`, 'Reset')) {
      await api(`/api/games/${id}/reset-stats`, { method: 'POST' });
      await refresh();
      toast('Play statistics reset');
    }
    if (m === 'remove' && await confirmDialog('Remove from library?', `${g.name} will be removed from this library. Game files on disk are not touched.`, 'Remove')) {
      await api(`/api/games/${id}`, { method: 'DELETE' });
      if (state.selectedId === id) state.selectedId = null;
      await refresh();
      toast(`${g.name} removed`);
      state.view === 'home' ? focusSelectedTile() : setView('library');
    }
  });
}

/* ----- Add / edit game ----- */
function openGameEditor(game, { findArt = false } = {}) {
  const isNew = !game;
  const pendingImg = { cover: null, background: null, logo: null }; // { blob } | { url } | { path } | { remove: true }
  let lastSlot = 'cover';

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

  const layer = openLayer(`
    <div class="modal modal-wide" role="dialog" aria-label="${isNew ? 'Add game' : 'Edit game'}">
      <h2>${isNew ? 'Add game' : 'Edit game'}</h2>
      <p>${isNew ? 'Pick the game’s executable. The name, install folder and artwork fill in automatically.' : esc(game.name)}</p>
      <div class="editor">
        <div>
          <label class="field"><span>Executable</span>
            <span class="input-row"><input class="input" data-nav data-f="exe" placeholder="A:\\games\\My Game\\game.exe" value="${esc(game?.exe)}">
            <button class="btn btn-secondary btn-sm" data-nav data-browse="exe">Browse</button></span></label>
          <label class="field"><span>Name</span><input class="input" data-nav data-f="name" value="${esc(game?.name)}" placeholder="Game name"></label>
          <label class="field"><span>Install folder (used for size)</span>
            <span class="input-row"><input class="input" data-nav data-f="folder" value="${esc(game?.folder)}" placeholder="Detected from the executable">
            <button class="btn btn-secondary btn-sm" data-nav data-browse="dir">Browse</button></span></label>
          <label class="field"><span>Launch options (optional)</span><input class="input" data-nav data-f="args" value="${esc(game?.args)}" placeholder="-fullscreen -dx12"></label>
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
    } else if (t.hasAttribute('data-cancel')) closeLayer(layer);
    else if (t.hasAttribute('data-save')) save(t);
  });

  async function save(btn) {
    const err = layer.querySelector('[data-error]');
    err.textContent = '';
    const body = { name: f('name').value.trim(), exe: f('exe').value.trim(), folder: f('folder').value.trim(), args: f('args').value.trim() };
    if (!body.exe) { err.textContent = 'Choose the game’s executable.'; return focusEl(f('exe')); }
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

/* ----- Settings ----- */
function openSettings() {
  const s = state.settings;
  const toggle = (setting, on, labels = ['On', 'Off']) => `
    <div class="chips">
      <button class="chip${on ? ' is-active' : ''}" data-nav data-set="${setting}" data-val="1">${labels[0]}</button>
      <button class="chip${on ? '' : ' is-active'}" data-nav data-set="${setting}" data-val="0">${labels[1]}</button>
    </div>`;
  const layer = openLayer(`
    <div class="modal" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <section class="settings-section">
        <h3>Profile</h3>
        <input class="input" data-nav data-profile value="${esc(s.profileName)}" placeholder="Your name" maxlength="40">
      </section>
      <section class="settings-section">
        <h3>Games folder</h3>
        <div class="input-row">
          <input class="input" data-nav data-root value="${esc(s.gamesRoot)}">
          <button class="btn btn-secondary btn-sm" data-nav data-s="browse">Browse</button>
        </div>
        <div class="input-row" style="margin-top:1.25rem;padding:.25rem">
          <button class="btn btn-primary btn-sm" data-nav data-s="scan">Scan for new games</button>
          <button class="btn btn-ghost btn-sm" data-nav data-s="add">Add game manually</button>
        </div>
      </section>
      <section class="settings-section">
        <h3>Artwork</h3>
        <div class="settings-grid">
          <div><h4>Download artwork for new games</h4>${toggle('autoArtwork', s.autoArtwork)}</div>
          <div><h4>Missing artwork</h4><button class="btn btn-ghost btn-sm" data-nav data-s="art-all">Find artwork for all games</button></div>
        </div>
      </section>
      <section class="settings-section">
        <h3>Spotify</h3>
        <input class="input" data-nav data-spotify-id value="${esc(s.spotifyClientId || '')}" placeholder="Spotify Client ID" maxlength="32" spellcheck="false">
        <p class="settings-note">Create an app at <b>developer.spotify.com/dashboard</b>, add this Redirect URI, then paste the app’s Client ID above: <code>http://127.0.0.1:${esc(location.port || '4545')}/spotify/callback</code></p>
        <div class="input-row" style="padding:.25rem">
          <button class="btn btn-secondary btn-sm" data-nav data-s="spotify" data-spotify-btn>${state.spotify.connected ? 'Disconnect Spotify' : 'Connect Spotify'}</button>
        </div>
      </section>
      <section class="settings-section">
        <h3>Preferences</h3>
        <div class="settings-grid">
          <div><h4>Clock</h4>${toggle('clock24', s.clock24, ['24-hour', '12-hour'])}</div>
          <div><h4>Navigation sounds</h4>${toggle('sounds', s.sounds)}</div>
        </div>
      </section>
      <section class="settings-section">
        <h3>Controls</h3>
        <dl class="controls">
          <dt>✕ / A · Enter</dt><dd>Select, launch game</dd>
          <dt>○ / B · Esc</dt><dd>Back</dd>
          <dt>□ / X · O</dt><dd>Game options</dd>
          <dt>△ / Y · /</dt><dd>Search</dd>
          <dt>L1 / R1 · Q / E</dt><dd>Switch between Games and Library</dd>
          <dt>Options / Start</dt><dd>Settings</dd>
          <dt>← → on the music progress bar</dt><dd>Skip 10 seconds</dd>
          <dt>F11</dt><dd>Toggle full screen</dd>
        </dl>
      </section>
      <div class="modal-actions">
        <button class="btn btn-secondary spacer" data-nav data-s="quit">Quit game library</button>
        <button class="btn btn-primary" data-nav data-s="close">Done</button>
      </div>
    </div>`);
  const rootInput = layer.querySelector('[data-root]');
  const profileInput = layer.querySelector('[data-profile]');
  async function saveSettings(patch) {
    try {
      state.settings = await api('/api/settings', { method: 'POST', json: patch });
      renderStage();
      tickClock();
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
  }
  rootInput.addEventListener('change', async () => {
    if (await saveSettings({ gamesRoot: rootInput.value.trim() })) toast('Games folder updated');
    rootInput.value = state.settings.gamesRoot;
  });
  profileInput.addEventListener('change', () => saveSettings({ profileName: profileInput.value }));
  const spotifyInput = layer.querySelector('[data-spotify-id]');
  spotifyInput.addEventListener('change', async () => {
    if (await saveSettings({ spotifyClientId: spotifyInput.value.trim() })) { await pollSpotify(); renderStage(); }
    else spotifyInput.value = state.settings.spotifyClientId || '';
  });
  layer.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.set) {
      if (await saveSettings({ [b.dataset.set]: b.dataset.val === '1' })) {
        $$(`[data-set="${b.dataset.set}"]`, layer).forEach((c) => c.classList.toggle('is-active', c === b));
      }
      return;
    }
    const action = b.dataset.s;
    if (action === 'browse') {
      const p = await browseDialog({ title: 'Choose your games folder', filter: 'dir', start: rootInput.value });
      if (p && await saveSettings({ gamesRoot: p })) { rootInput.value = state.settings.gamesRoot; toast('Games folder updated'); }
    }
    if (action === 'spotify') {
      if (state.spotify.connected) return disconnectSpotify();
      if (spotifyInput.value.trim() !== (state.settings.spotifyClientId || '') && !(await saveSettings({ spotifyClientId: spotifyInput.value.trim() }))) return;
      return connectSpotify();
    }
    if (action === 'scan') scanFolder();
    if (action === 'add') { closeLayer(layer); openGameEditor(null); }
    if (action === 'art-all') {
      const { queued } = await api('/api/artwork/auto', { method: 'POST', json: {} });
      toast(queued ? `Finding artwork for ${queued} ${queued === 1 ? 'game' : 'games'}…` : 'Every game already has artwork');
      if (queued) watchArtwork();
    }
    if (action === 'close') closeLayer(layer);
    if (action === 'quit' && await confirmDialog('Quit game library?', 'Playtime is only tracked while the library is running.', 'Quit')) {
      await api('/api/quit', { method: 'POST' }).catch(() => {});
      window.close();
      document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font-weight:300;font-size:1.75rem">You can close this window.</div>';
    }
  });
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
function openKeyboard(input) {
  const rows = ['1234567890', 'qwertyuiop', "asdfghjkl'", 'zxcvbnm-:.'];
  const layer = openLayer(`
    <div class="keyboard" role="dialog" aria-label="Keyboard">
      <div class="kb-preview" data-preview></div>
      ${rows.map((r) => `<div class="kb-row">${[...r].map((c) => `<button class="key" data-nav data-k="${esc(c)}">${esc(c)}</button>`).join('')}</div>`).join('')}
      <div class="kb-row">
        <button class="key key-wide" data-nav data-k="shift">Shift</button>
        <button class="key key-wide key-space" data-nav data-k=" ">Space</button>
        <button class="key key-wide" data-nav data-k="back">Delete</button>
        <button class="key key-wide key-done" data-nav data-k="done">Done</button>
      </div>
    </div>`, {
    className: 'layer-keyboard',
    onClose: () => input.dispatchEvent(new Event('change', { bubbles: true })),
    actions: { options: () => type('back'), search: () => type(' ') },
  });
  let shift = false;
  const paint = () => {
    const v = input.value;
    layer.querySelector('[data-preview]').innerHTML = v ? `${esc(v)}<span class="caret"></span>` : `<span class="caret"></span><span class="placeholder">${esc(input.placeholder)}</span>`;
    $$('[data-k]', layer).forEach((k) => { if (k.dataset.k.length === 1 && /[a-z]/.test(k.dataset.k)) k.textContent = shift ? k.dataset.k.toUpperCase() : k.dataset.k; });
  };
  function type(k) {
    if (k === 'done') return closeLayer(layer);
    if (k === 'shift') { shift = !shift; return paint(); }
    input.value = k === 'back' ? input.value.slice(0, -1) : input.value + (shift ? k.toUpperCase() : k);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    paint();
  }
  layer.addEventListener('click', (e) => { const k = e.target.closest('[data-k]'); if (k) type(k.dataset.k); });
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

function move(dir, { repeat = false } = {}) {
  const layer = topLayer();
  const cur = document.activeElement;
  const go = (el) => { if (el) { focusEl(el); sfx.move(); } else if (!repeat) sfx.bump(); };

  if (!layer && cur?.matches?.('.player-progress') && (dir === 'left' || dir === 'right')) {
    seekTo(currentProgress() + (dir === 'right' ? 10000 : -10000));
    return sfx.move();
  }
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

  const items = focusables(layer || document.body);
  if (!items.length) return;
  if (!items.includes(cur)) {
    if (!layer && state.view === 'home') return focusSelectedTile();
    return focusEl(items[0]);
  }
  go(nearest(cur, items, dir));
}

/* ======================= Input: actions ======================= */
function confirmAction() {
  const el = document.activeElement;
  if (!el || el === document.body) return move('down');
  if (el.matches('input:not([type=file])')) return openKeyboard(el);
  el.click();
}

function back() {
  const layer = topLayer();
  sfx.back();
  if (layer) return closeLayer(layer);
  if (state.view === 'library') return setView('home');
  focusSelectedTile();
}

function optionsAction() {
  const layer = topLayer();
  if (layer) return layer._actions.options?.();
  const el = document.activeElement;
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
  openSettings();
}

function switchTab() {
  if (topLayer()) return;
  sfx.move();
  setView(state.view === 'home' ? 'library' : 'home');
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
    e.preventDefault();
    return move(dirs[e.key], { repeat: e.repeat });
  }
  if (e.key === 'Escape') { e.preventDefault(); return back(); }
  if (typing) {
    if (e.key === 'Enter') { e.preventDefault(); t.dispatchEvent(new Event('change', { bubbles: true })); move('down'); }
    return;
  }
  if (e.key === 'Backspace') { e.preventDefault(); return back(); }
  if (e.key === '/') { e.preventDefault(); return searchAction(); }
  if (e.key === 'q' || e.key === 'e') return switchTab();
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

function padLoop() {
  const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
  if (pads.length !== padCount) { padCount = pads.length; if (state.selectedId === EXPLORE_ID) renderStage(); }
  if (!pads.length) { padLoopRunning = false; return; }
  if (document.hasFocus() && !document.hidden) {
    const pressed = (i) => pads.some((p) => p.buttons[i]?.pressed);
    const axis = (i) => pads.reduce((v, p) => (Math.abs(p.axes[i] || 0) > Math.abs(v) ? p.axes[i] : v), 0);
    const lx = axis(0), ly = axis(1);
    const now = performance.now();
    const dirs = {
      up: pressed(PAD.UP) || ly < -0.55,
      down: pressed(PAD.DOWN) || ly > 0.55,
      left: pressed(PAD.LEFT) || lx < -0.55,
      right: pressed(PAD.RIGHT) || lx > 0.55,
    };
    for (const [dir, on] of Object.entries(dirs)) {
      if (on && !padPrev[dir]) { padRepeat[dir] = now + 380; setDevice('pad'); move(dir); }
      else if (on && now >= padRepeat[dir]) { padRepeat[dir] = now + 120; move(dir, { repeat: true }); }
      padPrev[dir] = on;
    }
    const buttons = {
      A: confirmAction, B: back, X: optionsAction, Y: searchAction,
      START: settingsAction, SELECT: settingsAction, LB: switchTab, RB: switchTab,
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
window.addEventListener('gamepaddisconnected', () => { if (state.selectedId === EXPLORE_ID) renderStage(); });
window.addEventListener('focus', () => { if ([...(navigator.getGamepads?.() || [])].some(Boolean)) startPadLoop(); });

/* ======================= Event wiring ======================= */
$('#btn-search').innerHTML = ICON.search;
$('#btn-settings').innerHTML = ICON.gear;
$('#search-icon').innerHTML = ICON.search;

$$('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
$('#btn-search').addEventListener('click', openSearch);
$('#btn-settings').addEventListener('click', openSettings);
$('#btn-add').addEventListener('click', () => openGameEditor(null));
$('#btn-scan').addEventListener('click', scanFolder);

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
  if (a === 'edit') return openGameEditor(byId(state.selectedId));
  if (a === 'add') return openGameEditor(null);
  if (a === 'scan') return scanFolder();
  if (a === 'open-library') return setView('library');
  if (a === 'mp-toggle') return musicControl(state.spotify.isPlaying ? 'pause' : 'play');
  if (a === 'mp-prev') return musicControl('previous');
  if (a === 'mp-next') return musicControl('next');
  if (a === 'spotify-connect') return connectSpotify();
  if (a === 'spotify-setup') return openSettings();
  const row = e.target.closest('.player-progress');
  if (row && e.detail > 0 && state.spotify.track) { // detail 0 = Enter / controller press, which has no position to seek to
    const r = $('.player-bar', row).getBoundingClientRect();
    return seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * state.spotify.track.durationMs);
  }
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

/* ======================= Clock + polling ======================= */
function tickClock() {
  const d = new Date();
  let h = d.getHours();
  let suffix = '';
  if (!state.settings.clock24) { suffix = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; }
  $('#clock').textContent = `${state.settings.clock24 ? pad(h) : h}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${suffix}`;
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

buildScene();
refresh().then(() => {
  const hash = location.hash;
  if (hash === '#explore') select(EXPLORE_ID);
  else if (hash.startsWith('#item=')) { const it = state.items[Number(hash.slice(6))]; if (it) select(it.id); }
  if (hash === '#library') setView('library');
  else focusSelectedTile();
  if (hash === '#settings') openSettings();
  if (hash.startsWith('#edit=')) { const it = state.items[Number(hash.slice(6))]; if (it?.g) openGameEditor(it.g); }
  if (state.busy.artwork) watchArtwork();
});
