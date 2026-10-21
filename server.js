'use strict';
// PS5-style game library: zero-dependency local server (Node 18.15+).
// Serves the UI, stores the library, finds and launches games, tracks playtime, trophies and notes,
// fetches artwork, drives Discord Rich Presence and reports controller batteries.
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const platform = require('./lib/platform');
const { findExes, detectExe, cleanName, norm } = require('./lib/exe');
const { detectLaunchers, detectShortcuts, SOURCE_LABEL } = require('./lib/launchers');
const stats = require('./lib/stats');
const { Presence, DetectableGames } = require('./lib/discord');
const { xinputBatteries } = require('./lib/controllers');
const trophies = require('./lib/achievements');

const PORT = Number(process.env.PS5LIB_PORT) || 4545;
const HOST = '127.0.0.1';
const OPEN_WINDOW = process.argv.includes('--open');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.PS5LIB_DATA ? path.resolve(process.env.PS5LIB_DATA) : path.join(__dirname, 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');
const WALL_DIR = path.join(DATA_DIR, 'wallpapers');
const DB_FILE = path.join(DATA_DIR, 'library.json');
const DAY_MS = 86400000;
const MAX_UPLOAD = 25 * 1024 * 1024;
const MAX_WALLPAPER = 150 * 1024 * 1024;

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(WALL_DIR, { recursive: true });

/* ---------------- Settings ---------------- */

const SETTINGS = {
  // profile
  profileName: { type: 'str', max: 40, def: '' },
  avatarColor: { type: 'enum', values: ['blue', 'cyan', 'teal', 'green', 'orange', 'pink', 'purple', 'gray'], def: 'blue' },
  // library
  scanSteam: { type: 'bool', def: true },
  scanEpic: { type: 'bool', def: true },
  scanGog: { type: 'bool', def: true },
  scanUbisoft: { type: 'bool', def: true },
  scanEa: { type: 'bool', def: true },
  scanXbox: { type: 'bool', def: true },
  steamPath: { type: 'str', max: 260, def: '' },
  autoScan: { type: 'enum', values: ['off', 'startup', '30', '120'], def: 'startup' },
  autoArtwork: { type: 'bool', def: true },
  // launcher
  confirmClose: { type: 'bool', def: true },
  idleExitMin: { type: 'enum', values: [1, 5, 15, 60, 0], def: 5 },
  // appearance
  clock24: { type: 'bool', def: true },
  showSeconds: { type: 'bool', def: true },
  uiScale: { type: 'enum', values: [90, 100, 115, 130], def: 100 },
  animations: { type: 'enum', values: ['full', 'reduced'], def: 'full' },
  sounds: { type: 'bool', def: true },
  soundVolume: { type: 'enum', values: [35, 70, 100], def: 70 },
  backgroundDim: { type: 'enum', values: [0, 20, 40, 60], def: 0 },
  homeOrder: { type: 'enum', values: ['recent', 'favorites', 'name', 'played'], def: 'recent' },
  startOn: { type: 'enum', values: ['game', 'explore'], def: 'game' },
  // discover wallpaper
  wallpaperMode: { type: 'enum', values: ['scene', 'single', 'shuffle'], def: 'scene' },
  wallpaperId: { type: 'str', max: 80, def: '' },
  wallpaperInterval: { type: 'enum', values: [1, 5, 15, 60], def: 5 },
  wallpaperSymbols: { type: 'bool', def: false },
  // controller
  confirmButton: { type: 'enum', values: ['cross', 'circle'], def: 'cross' },
  stickDeadzone: { type: 'enum', values: ['low', 'normal', 'high'], def: 'normal' },
  rumble: { type: 'bool', def: true },
  lowBatteryWarn: { type: 'enum', values: [0, 10, 20, 30], def: 20 },
  // playtime
  weeklyGoalHours: { type: 'enum', values: [0, 5, 10, 20, 40], def: 0 },
  weekStartsOn: { type: 'enum', values: ['mon', 'sun'], def: 'mon' },
  minSessionSec: { type: 'enum', values: [5, 60, 300], def: 5 },
  // trophies
  trophyPopups: { type: 'bool', def: true },
  // discord
  discordEnabled: { type: 'bool', def: false },
  discordAppId: { type: 'str', max: 24, def: '' },
  discordSkipDetected: { type: 'bool', def: true },
  discordShowCover: { type: 'bool', def: true },
  discordShowTime: { type: 'bool', def: true },
  discordShowTrophies: { type: 'bool', def: true },
  discordIdle: { type: 'bool', def: false },
};

const defaultSettings = () => {
  const s = { gameFolders: fs.existsSync('A:\\games') ? ['A:\\games'] : [] };
  for (const [k, v] of Object.entries(SETTINGS)) s[k] = v.def;
  return s;
};

function coerceSetting(spec, value) {
  if (spec.type === 'bool') return !!value;
  if (spec.type === 'str') return String(value ?? '').trim().slice(0, spec.max);
  const v = typeof spec.values[0] === 'number' ? Number(value) : String(value);
  if (!spec.values.includes(v)) throw new Error('That option isn’t available');
  return v;
}

function normalizeSettings(raw = {}) {
  const s = defaultSettings();
  for (const [k, spec] of Object.entries(SETTINGS)) {
    if (raw[k] === undefined) continue;
    try { s[k] = coerceSetting(spec, raw[k]); } catch {}
  }
  if (Array.isArray(raw.gameFolders)) s.gameFolders = [...new Set(raw.gameFolders.map(String).filter(Boolean))];
  else if (raw.gamesRoot) s.gameFolders = [String(raw.gamesRoot)]; // single-folder libraries from older versions
  return s;
}

/* ---------------- Library database ---------------- */

const DEFAULT_SETTINGS = { gamesRoot: 'A:\\games', clock24: true, profileName: '', sounds: true, autoArtwork: true, spotifyClientId: '' };
const IMAGE_KINDS = ['cover', 'background', 'logo'];
const STATUSES = ['', 'backlog', 'playing', 'completed', 'dropped', 'hold'];
const firstRun = !fs.existsSync(DB_FILE);
const db = loadDb();

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { settings: { ...DEFAULT_SETTINGS, ...raw.settings }, games: Array.isArray(raw.games) ? raw.games : [], spotify: raw.spotify || null };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, games: [], spotify: null };
    return {
      settings: normalizeSettings(raw.settings),
      games: Array.isArray(raw.games) ? raw.games : [],
      ignored: Array.isArray(raw.ignored) ? raw.ignored : [],
      wallpapers: Array.isArray(raw.wallpapers) ? raw.wallpapers : [],
    };
  } catch {
    return { settings: defaultSettings(), games: [], ignored: [], wallpapers: [] };
  }
}

// Fills in fields added by newer versions, and closes a session left open by a crash or forced kill.
for (const g of db.games) {
  g.sessions ||= [];
  g.launch ||= { type: 'exe' };
  g.source ||= 'folder';
  g.sourceKey ??= null;
  g.workDir ||= '';
  g.admin = !!g.admin;
  g.favorite = !!g.favorite;
  g.status = STATUSES.includes(g.status) ? g.status : '';
  g.rating = Number(g.rating) || 0;
  g.discord = ['auto', 'always', 'never'].includes(g.discord) ? g.discord : 'auto';
  g.bonusMs = Number(g.bonusMs) || 0;
  g.notes ||= [];
  g.achievements ||= [];
  g.exe ||= '';
  g.folder ||= '';
  if (g.activeSession) {
    const { start, lastSeen } = g.activeSession;
    if (lastSeen - start > 5000) g.sessions.push({ start, end: lastSeen });
    delete g.activeSession;
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const byId = (id) => db.games.find((g) => g.id === id);
const lc = (p) => path.resolve(p).toLowerCase();

/* ---------------- Events (toasts for things that happen in the background) ---------------- */

const events = [];
let eventSeq = 0;
function emit(type, data = {}) {
  events.push({ id: ++eventSeq, at: Date.now(), type, ...data });
  if (events.length > 60) events.shift();
}

function makeGame({ name, exe, folder, args, launch, source, sourceKey, steamAppId }) {
  const exePath = exe ? path.resolve(exe) : '';
  return {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    exe: exePath,
    folder: folder ? path.resolve(folder) : exePath ? inferFolder(exePath) : '',
    args: args ? String(args) : '',
    workDir: '',
    admin: false,
    launch: launch || { type: 'exe' },
    source: source || 'manual',
    sourceKey: sourceKey || null,
    cover: null,
    background: null,
    logo: null,
    steamAppId: steamAppId || null,
    artworkChecked: false,
    addedAt: Date.now(),
    sizeBytes: null,
    sizeScannedAt: null,
    launches: 0,
    sessions: [],
    bonusMs: 0,
    favorite: false,
    status: '',
    rating: 0,
    discord: 'auto',
    notes: [],
    achievements: [],
  };
}

/* ---------------- Game detection ---------------- */

const CONTAINER_DIR = /^(games|repacks|installed|library|steamapps|common)$/i;

function inferFolder(exe) {
  const resolved = path.resolve(exe);
  for (const rootPath of db.settings.gameFolders) {
    const root = path.resolve(rootPath);
    const rel = path.relative(root, resolved);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      const parts = rel.split(path.sep);
      const depth = parts.length > 2 && CONTAINER_DIR.test(parts[0]) ? 2 : 1;
      if (parts.length > depth) return path.join(root, ...parts.slice(0, depth));
    }
  }
  return path.dirname(resolved);
}

let scanning = null;

// Looks for new games in every games folder and every enabled launcher. Never removes anything.
function scanLibrary({ auto = false } = {}) {
  if (scanning) return scanning;
  scanning = doScan(auto).finally(() => { scanning = null; });
  return scanning;
}

async function doScan(auto) {
  const s = db.settings;
  const ignored = new Set(db.ignored);
  const added = [];
  const bySourceKey = new Map(db.games.filter((g) => g.sourceKey).map((g) => [g.sourceKey, g]));
  const byFolder = new Map(db.games.filter((g) => g.folder).map((g) => [lc(g.folder), g]));
  const perSource = {};
  const bump = (src, field) => { (perSource[src] ||= { found: 0, added: 0 })[field]++; };

  async function addCandidate(c) {
    const folder = c.folder ? path.resolve(c.folder) : '';
    const existing = bySourceKey.get(c.key) || (folder && byFolder.get(lc(folder)));
    bump(c.source, 'found');
    if (existing) { upgradeGame(existing, c); return; }
    if (ignored.has(c.key) || (folder && ignored.has('dir:' + lc(folder)))) return;
    const exe = c.exe || (folder ? await detectExe(folder, c.name) : null) || '';
    if (!exe && c.launch.type === 'exe') return; // nothing to start
    const g = makeGame({ name: c.name, exe, folder, args: c.args, launch: c.launch, source: c.source, sourceKey: c.key, steamAppId: c.steamAppId });
    if (c.sizeBytes) { g.sizeBytes = c.sizeBytes; g.sizeScannedAt = Date.now(); }
    db.games.push(g);
    bySourceKey.set(c.key, g);
    if (folder) byFolder.set(lc(folder), g);
    added.push({ id: g.id, name: g.name, source: c.source });
    bump(c.source, 'added');
    if (!g.sizeBytes) queueSize(g);
    if (db.settings.autoArtwork) queueArtwork(g);
  }

  // Launcher libraries first: their names and ids are exact.
  const enabled = { steam: s.scanSteam, epic: s.scanEpic, gog: s.scanGog, ubisoft: s.scanUbisoft, ea: s.scanEa, xbox: s.scanXbox };
  for (const c of await detectLaunchers(enabled, { steamPath: s.steamPath })) await addCandidate(c);

  // Shortcuts and plain game folders.
  const roots = s.gameFolders.filter((r) => fs.existsSync(r));
  for (const c of await detectShortcuts(roots)) await addCandidate(c);
  async function visit(dir, level) {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (level === 0 && CONTAINER_DIR.test(e.name)) { await visit(p, 1); continue; }
      if (e.name.startsWith('$') || /^(redist|_?commonredist)$/i.test(e.name)) continue;
      if (byFolder.has(lc(p)) || ignored.has('dir:' + lc(p))) continue;
      const exe = await detectExe(p, cleanName(e.name));
      if (!exe) continue;
      const g = makeGame({ name: cleanName(e.name), exe, folder: p, source: 'folder' });
      db.games.push(g);
      byFolder.set(lc(p), g);
      added.push({ id: g.id, name: g.name, source: 'folder' });
      bump('folder', 'added');
      queueSize(g);
      if (db.settings.autoArtwork) queueArtwork(g);
    }
  }
  for (const r of roots) await visit(path.resolve(r), 0);

  if (added.length) {
    save();
    emit('scan', { added: added.map((a) => a.name), auto });
  }
  lastScan = { at: Date.now(), added: added.length };
  return { added, sources: perSource };
}

let lastScan = { at: 0, added: 0 };

// Gives a game found again by a launcher the ids it was missing, without overriding the player's choices.
function upgradeGame(g, c) {
  let changed = false;
  if (!g.sourceKey) { g.sourceKey = c.key; changed = true; }
  if (c.steamAppId && !g.steamAppId) { g.steamAppId = c.steamAppId; g.artworkChecked = false; changed = true; }
  if (g.source === 'folder' && g.launch.type === 'exe' && c.launch.type !== 'exe' && !g.args) {
    g.launch = c.launch;
    g.source = c.source;
    changed = true;
  }
  if (changed) save();
}

let scanTimer = null;
function scheduleAutoScan() {
  clearInterval(scanTimer);
  scanTimer = null;
  const every = Number(db.settings.autoScan);
  if (every > 0) scanTimer = setInterval(() => scanLibrary({ auto: true }).catch((e) => console.error('scan', e.message)), every * 60000);
}

/* ---------------- Disk usage ---------------- */

const sizing = new Set();
let sizeChain = Promise.resolve();

async function dirSize(root) {
  let total = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
    const files = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) files.push(p);
    }
    for (let i = 0; i < files.length; i += 64) {
      const sizes = await Promise.all(files.slice(i, i + 64).map((f) => fsp.stat(f).then((s) => s.size, () => 0)));
      for (const s of sizes) total += s;
    }
  }
  return total;
}

function queueSize(game) {
  if (sizing.has(game.id)) return;
  sizing.add(game.id);
  sizeChain = sizeChain.then(async () => {
    try {
      const g = byId(game.id);
      if (g && g.folder && fs.existsSync(g.folder)) {
        g.sizeBytes = await dirSize(g.folder);
        g.sizeScannedAt = Date.now();
        save();
      }
    } catch (e) {
      console.error('size scan failed', e.message);
    } finally {
      sizing.delete(game.id);
    }
  });
}

let driveCache = { at: 0, data: {} };
async function drives() {
  if (Date.now() - driveCache.at < 10000) return driveCache.data;
  const roots = new Set([...db.settings.gameFolders, ...db.games.map((g) => g.folder)].filter(Boolean).map((p) => path.parse(path.resolve(p)).root.toUpperCase()));
  const data = {};
  for (const root of roots) {
    try {
      const s = await fsp.statfs(root);
      data[root] = { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
    } catch {}
  }
  driveCache = { at: Date.now(), data };
  return data;
}

/* ---------------- Playtime tracking ---------------- */
// Polls the process list and matches it against each game's executables, so
// time is counted even when a launcher stub exits and spawns the real game.

const running = new Map(); // id -> { start, lastSeen, alive:Set }
const pending = new Map(); // id -> launchedAt (waiting for the process to appear)
const watchNames = new Map(); // id -> { key, names:Set }
let trackerTimer = null;
let lastPersist = 0;

async function namesFor(g) {
  const key = g.exe + '|' + g.folder;
  const cached = watchNames.get(g.id);
  if (cached && cached.key === key) return cached.names;
  const names = new Set();
  if (g.exe) names.add(path.basename(g.exe).toLowerCase());
  if (g.folder) for (const e of await findExes(g.folder, 6)) {
    if (e.size >= 8 * 1024 * 1024) names.add(path.basename(e.path).toLowerCase());
  }
  watchNames.set(g.id, { key, names });
  return names;
}

// Steam and store launchers take a while (updates, logins) before the game appears.
const pendingTimeout = (g) => (g.launch.type === 'exe' ? 120000 : 360000);

function endSession(g, r, now) {
  const ms = now - r.start;
  if (ms >= db.settings.minSessionSec * 1000) {
    g.sessions.push({ start: r.start, end: now });
    emit('game-ended', { gameId: g.id, name: g.name, ms });
  }
  delete g.activeSession;
  running.delete(g.id);
  save();
  refreshPresence();
}

async function trackerTick() {
  const procs = await platform.processList();
  if (!procs) return;
  const now = Date.now();
  let changed = false;
  for (const g of db.games) {
    const names = await namesFor(g);
    const alive = new Set();
    for (const n of names) if (procs.has(n)) alive.add(n);
    const r = running.get(g.id);
    if (alive.size) {
      if (!r) {
        running.set(g.id, { start: pending.get(g.id) ?? now, lastSeen: now, alive });
        pending.delete(g.id);
        changed = true;
        emit('game-started', { gameId: g.id, name: g.name });
        refreshPresence();
      } else {
        r.lastSeen = now;
        r.alive = alive;
      }
    } else if (r) {
      endSession(g, r, now);
    } else if (pending.has(g.id) && now - pending.get(g.id) > pendingTimeout(g)) {
      pending.delete(g.id);
      emit('launch-failed', { gameId: g.id, name: g.name, message: `${g.name} didn’t seem to start. If it opened, add its real executable in Edit details so playtime can be tracked.` });
    }
  }
  if (running.size && (changed || now - lastPersist > 30000)) {
    for (const [id, r] of running) {
      const g = byId(id);
      if (g) g.activeSession = { start: r.start, lastSeen: r.lastSeen };
    }
    lastPersist = now;
    save();
  }
}

function scheduleTracker(delay) {
  clearTimeout(trackerTimer);
  trackerTimer = setTimeout(async () => {
    try { await trackerTick(); } catch (e) { console.error('tracker', e.message); }
    scheduleTracker(running.size || pending.size ? 5000 : 15000);
  }, delay);
}

/* ---------------- Launching ---------------- */

function launchTarget(g) {
  if (g.launch.type === 'steam') return { target: `steam://rungameid/${g.launch.id}` };
  if (g.launch.type === 'uri') return { target: g.launch.uri };
  return { target: g.exe, args: g.args, cwd: g.workDir || path.dirname(g.exe), admin: g.admin };
}

function launchable(g) {
  if (g.launch.type === 'exe') return !!g.exe && fs.existsSync(g.exe);
  return g.folder ? fs.existsSync(g.folder) : true;
}

/* ---------------- Discord Rich Presence ---------------- */

const presence = new Presence();
const detectable = new DetectableGames(path.join(DATA_DIR, 'discord-detectable.json'));
let presenceNote = ''; // why nothing is shown, for the settings screen

function applyDiscordSettings() {
  const s = db.settings;
  if (process.env.PS5LIB_DISCORD_IPC) presence.paths = [process.env.PS5LIB_DISCORD_IPC];
  presence.configure({ enabled: s.discordEnabled, clientId: s.discordAppId });
  if (s.discordEnabled && s.discordSkipDetected) detectable.load().then(() => refreshPresence());
  refreshPresence();
}

function steamImage(g) {
  return g.steamAppId ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.steamAppId}/header.jpg` : undefined;
}

async function refreshPresence() {
  const s = db.settings;
  presenceNote = '';
  if (!s.discordEnabled) return presence.set(null);
  let current = null;
  for (const [id, r] of running) if (!current || r.start > current.r.start) current = { id, r };
  if (!current) {
    if (!s.discordIdle) return presence.set(null);
    const n = db.games.length;
    return presence.set({ details: 'Browsing the library', state: `${n} ${n === 1 ? 'game' : 'games'}`, largeText: 'PS5 Game Library' });
  }
  const g = byId(current.id);
  if (!g || g.discord === 'never') { presenceNote = g ? `Hidden for ${g.name} (game setting)` : ''; return presence.set(null); }
  if (g.discord !== 'always' && s.discordSkipDetected) {
    if (!detectable.exes) detectable.load().then((ok) => ok && refreshPresence());
    if (detectable.isDetected(await namesFor(g))) {
      presenceNote = `Discord already shows ${g.name} on its own`;
      return presence.set(null);
    }
  }
  const sum = trophies.summarize(g.achievements);
  presence.set({
    details: g.name,
    state: s.discordShowTrophies && sum.total ? `${sum.done}/${sum.total} trophies` : 'Playing on PC',
    startTimestamp: s.discordShowTime ? current.r.start : undefined,
    largeImage: s.discordShowCover ? steamImage(g) : undefined,
    largeText: g.name,
  });
}

/* ---------------- Public game shape ---------------- */

function dailyPlay(sessions, days = 14) {
  const out = new Array(days).fill(0);
  const rangeStart = stats.addDays(stats.dayStart(Date.now()), -(days - 1));
  for (const s of sessions) {
    let a = Math.max(s.start, rangeStart);
    while (a < s.end) {
      const idx = Math.floor((a - rangeStart) / DAY_MS);
      if (idx < 0 || idx >= days) break;
      const seg = Math.min(s.end, rangeStart + (idx + 1) * DAY_MS) - a;
      out[idx] += seg;
      a += seg;
    }
  }
  return out;
}

function publicGame(g, now) {
  const r = running.get(g.id);
  const sessions = r ? [...g.sessions, { start: r.start, end: now }] : g.sessions;
  let playMs = g.bonusMs || 0, longestMs = 0, firstPlayed = null, lastPlayed = null;
  for (const s of sessions) {
    const d = s.end - s.start;
    playMs += d;
    if (d > longestMs) longestMs = d;
    if (firstPlayed === null || s.start < firstPlayed) firstPlayed = s.start;
    if (lastPlayed === null || s.end > lastPlayed) lastPlayed = s.end;
  }
  const sum = trophies.summarize(g.achievements);
  const pinned = [...g.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)[0];
  return {
    id: g.id, name: g.name, exe: g.exe, folder: g.folder, args: g.args, workDir: g.workDir, admin: g.admin,
    launch: g.launch, source: g.source, sourceLabel: SOURCE_LABEL[g.source] || null,
    cover: g.cover, background: g.background, logo: g.logo || null, steamAppId: g.steamAppId || null, addedAt: g.addedAt,
    sizeBytes: g.sizeBytes, sizeScannedAt: g.sizeScannedAt, sizing: sizing.has(g.id),
    exeExists: launchable(g), launches: g.launches || 0,
    playMs, importedMs: g.bonusMs || 0, longestMs, sessions: sessions.length, firstPlayed, lastPlayed,
    daily: dailyPlay(sessions),
    status: r ? 'running' : pending.has(g.id) ? 'starting' : 'idle',
    runningSince: r ? r.start : null,
    drive: g.folder ? path.parse(path.resolve(g.folder)).root.toUpperCase() : null,
    favorite: g.favorite, progress: g.status, rating: g.rating, discord: g.discord,
    notes: g.notes.length, notePreview: pinned ? pinned.text.slice(0, 160) : '',
    trophies: { total: sum.total, done: sum.done, percent: sum.percent, platinum: sum.platinum },
  };
}

function trophyTotals() {
  const unlocked = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  const total = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  let points = 0, platinums = 0, withTrophies = 0;
  const recent = [];
  for (const g of db.games) {
    const sum = trophies.summarize(g.achievements);
    if (!sum.total) continue;
    withTrophies++;
    for (const t of trophies.TIERS) { unlocked[t] += sum.unlocked[t] || 0; total[t] += sum.counts[t] || 0; }
    points += sum.points;
    if (sum.platinumPossible) total.platinum++;
    if (sum.platinum) { platinums++; unlocked.platinum++; }
    for (const a of g.achievements) if (a.unlockedAt) recent.push({ gameId: g.id, game: g.name, title: a.title, tier: a.tier, at: a.unlockedAt });
  }
  recent.sort((a, b) => b.at - a.at);
  // Each level asks for a little more than the last.
  const level = 1 + Math.floor(Math.sqrt(points / 25));
  const floor = 25 * (level - 1) ** 2, ceil = 25 * level ** 2;
  return { unlocked, total, points, platinums, games: withTrophies, level, levelPercent: Math.round(((points - floor) / (ceil - floor)) * 100), recent: recent.slice(0, 6) };
}

/* ---------------- Images ---------------- */

const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/bmp': 'bmp' };
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/x-m4v': 'm4v' };
const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const MEDIA_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp|mp4|webm|ogv|m4v)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|ogv|m4v)$/i;

function removeImage(url) {
  if (url && url.startsWith('/img/')) fsp.unlink(path.join(IMG_DIR, path.basename(url))).catch(() => {});
}

async function storeImage(g, kind, buf, ext) {
  if (!buf.length) throw new Error('Image is empty');
  const name = `${g.id}-${kind}-${Date.now()}.${ext}`;
  await fsp.writeFile(path.join(IMG_DIR, name), buf);
  removeImage(g[kind]);
  g[kind] = '/img/' + name;
  save();
}

async function mediaFromUrl(url, { limit = MAX_UPLOAD, video = false } = {}) {
  if (!/^https?:\/\//i.test(url)) throw new Error('The link must start with http:// or https://');
  const res = await fetch(url, { headers: WEB_HEADERS, signal: AbortSignal.timeout(video ? 120000 : 20000) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const declared = Number(res.headers.get('content-length')) || 0;
  if (declared > limit) throw new Error(`The file is larger than ${Math.round(limit / 1048576)} MB`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > limit) throw new Error(`The file is larger than ${Math.round(limit / 1048576)} MB`);
  const extMatch = (video ? MEDIA_EXT_RE : IMG_EXT_RE).exec(new URL(url).pathname)?.[1];
  const ext = IMG_TYPES[type] || (video && VIDEO_TYPES[type]) || (extMatch || 'jpg').toLowerCase().replace('jpeg', 'jpg');
  return { buf, ext };
}
const imageFromUrl = (url) => mediaFromUrl(url);

/* ---------------- Artwork (public Steam store data) ---------------- */
// Cover = Steam library capsule, background = library hero, logo = transparent library logo.

const STEAM_CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/';
const WEB_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PS5GameLibrary/1.0', 'Accept-Language': 'en-US,en;q=0.8' };
const EXTRA_CONTENT = /\b(soundtrack|ost|dlc|pack|upgrade|bundle|demo|artbook|season pass|skin|outfit|expansion|playtest|benchmark|dedicated server|editor|sdk|wallpaper)\b/;
const artworkQueue = new Set();
let artworkChain = Promise.resolve();

async function getJson(url) {
  const res = await fetch(url, { headers: WEB_HEADERS, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Steam request failed (${res.status})`);
  return res.json();
}

const normTitle = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function searchTerm(name) {
  return String(name)
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\b(v\d[\w.]*|repack|goty|build \d+|x64)\b/gi, ' ')
    .replace(/\s-\s|[_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(term, name) {
  const a = normTitle(term), b = normTitle(name);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  let score = shared / Math.max(ta.size, tb.size);
  if (EXTRA_CONTENT.test(b) && !EXTRA_CONTENT.test(a)) score -= 0.3;
  return score;
}

async function steamSearch(query) {
  const j = await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`);
  return (j.items || [])
    .filter((i) => !i.type || i.type === 'app')
    .slice(0, 10)
    .map((i) => ({ appid: i.id, name: i.name, image: i.tiny_image || null }));
}

async function steamAssetCandidates(appid) {
  const input = { ids: [{ appid }], context: { language: 'english', country_code: 'US' }, data_request: { include_assets: true } };
  let assets = {}, name = null;
  try {
    const j = await getJson(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    const item = j?.response?.store_items?.[0];
    assets = item?.assets || {};
    name = item?.name || null;
  } catch {}
  const format = assets.asset_url_format || `steam/apps/${appid}/\${FILENAME}`;
  const asset = (file) => (file ? STEAM_CDN + format.replace('${FILENAME}', file) : null);
  const classic = (file) => `${STEAM_CDN}steam/apps/${appid}/${file}`;
  const unique = (list) => [...new Set(list.filter(Boolean))];
  return {
    name,
    cover: unique([asset(assets.library_capsule), asset(assets.library_capsule_2x), classic('library_600x900.jpg'), classic('library_600x900_2x.jpg')]),
    background: unique([asset(assets.library_hero_2x), asset(assets.library_hero), asset(assets.raw_page_background), classic('library_hero.jpg')]),
    logo: unique([classic('logo_2x.png'), classic('logo.png')]),
  };
}

async function firstReachable(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: 'HEAD', headers: WEB_HEADERS, signal: AbortSignal.timeout(8000) });
      if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) return u;
    } catch {}
  }
  return null;
}

async function applySteamArtwork(g, appid, force) {
  const candidates = await steamAssetCandidates(appid);
  for (const kind of IMAGE_KINDS) {
    if (!force && g[kind]) continue;
    for (const u of candidates[kind]) {
      try {
        const { buf, ext } = await imageFromUrl(u);
        await storeImage(g, kind, buf, ext);
        break;
      } catch {}
    }
  }
  g.steamAppId = appid;
  save();
}

// Finds the best Steam match for a game and fills in missing artwork (all artwork when forced).
// A game whose Steam id is already known skips the search.
function queueArtwork(game, force = false) {
  if (artworkQueue.has(game.id)) return;
  artworkQueue.add(game.id);
  artworkChain = artworkChain.then(async () => {
    try {
      const g = byId(game.id);
      if (!g) return;
      if (g.steamAppId) {
        try { await applySteamArtwork(g, g.steamAppId, force); } catch { return; }
        g.artworkChecked = true;
        save();
        return;
      }
      const term = searchTerm(g.name);
      let results;
      try { results = await steamSearch(term); } catch { return; } // offline: retry on next start
      let best = null, bestScore = 0.59;
      for (const r of results) {
        const s = matchScore(term, r.name);
        if (s > bestScore) { best = r; bestScore = s; }
      }
      if (best) await applySteamArtwork(g, best.appid, force);
      g.artworkChecked = true;
      save();
    } catch (e) {
      console.error('artwork', e.message);
    } finally {
      artworkQueue.delete(game.id);
    }
  });
}

function defaultProfileName() {
  try {
    const u = os.userInfo().username || '';
    return u.charAt(0).toUpperCase() + u.slice(1);
  } catch {
    return '';
  }
}

const publicSettings = () => ({
  ...db.settings,
  gamesRoot: db.settings.gameFolders[0] || '',
  profileName: db.settings.profileName || defaultProfileName(),
});

/* ---------------- Wallpapers (Discover page) ---------------- */

const publicWallpaper = (w) => ({ id: w.id, name: w.name, type: w.type, ext: w.ext, url: `/wp/${w.file}`, addedAt: w.addedAt });

async function storeWallpaper(buf, ext, name) {
  if (!buf.length) throw new Error('The file is empty');
  const id = crypto.randomUUID();
  const file = `${id}.${ext}`;
  await fsp.writeFile(path.join(WALL_DIR, file), buf);
  const w = { id, file, name: String(name || 'Wallpaper').slice(0, 80), type: VIDEO_EXT_RE.test(file) ? 'video' : 'image', ext, addedAt: Date.now() };
  db.wallpapers.push(w);
  save();
  return w;
}

/* ---------------- File browser ---------------- */

async function browse(p, filter) {
  if (!p) {
    if (!platform.IS_WIN) return { path: '', parent: null, entries: [{ name: '/', path: '/', dir: true }, { name: os.homedir(), path: os.homedir(), dir: true }] };
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((l) => fs.existsSync(l + ':\\'));
    return { path: '', parent: null, entries: letters.map((l) => ({ name: l + ':\\', path: l + ':\\', dir: true })) };
  }
  const dir = path.resolve(p);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const dirs = [], files = [];
  const fileOk = filter === 'exe' ? (n) => /\.(exe|bat|cmd|lnk|url)$/i.test(n)
    : filter === 'image' ? (n) => IMG_EXT_RE.test(n)
      : filter === 'wallpaper' ? (n) => MEDIA_EXT_RE.test(n)
        : () => false;
  for (const e of entries) {
    if (e.name.startsWith('$')) continue;
    if (e.isDirectory()) dirs.push({ name: e.name, path: path.join(dir, e.name), dir: true });
    else if (fileOk(e.name)) files.push({ name: e.name, path: path.join(dir, e.name), dir: false });
  }
  const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const parent = path.dirname(dir) === dir ? '' : path.dirname(dir);
  return { path: dir, parent, entries: [...dirs.sort(cmp), ...files.sort(cmp)].slice(0, 800) };
}

/* ---------------- Backup ---------------- */

function exportData() {
  return {
    app: 'ps5-game-library',
    version: 2,
    exportedAt: Date.now(),
    settings: db.settings,
    ignored: db.ignored,
    games: db.games.map((g) => {
      const { activeSession, cover, background, logo, ...rest } = g;
      return rest;
    }),
  };
}

function importData(data) {
  if (!data || data.app !== 'ps5-game-library' || !Array.isArray(data.games)) throw new Error('That file isn’t a game library backup');
  const stats = { matched: 0, added: 0, sessions: 0 };
  for (const ig of data.games) {
    if (!ig || typeof ig !== 'object' || !ig.name) continue;
    let g = byId(ig.id)
      || (ig.sourceKey && db.games.find((x) => x.sourceKey === ig.sourceKey))
      || (ig.folder && db.games.find((x) => x.folder && lc(x.folder) === lc(ig.folder)))
      || db.games.find((x) => norm(x.name) === norm(ig.name));
    if (!g) {
      g = makeGame({ name: ig.name, exe: ig.exe, folder: ig.folder, args: ig.args, launch: ig.launch, source: ig.source, sourceKey: ig.sourceKey, steamAppId: ig.steamAppId });
      g.id = byId(ig.id) ? g.id : ig.id || g.id;
      db.games.push(g);
      stats.added++;
      if (g.folder) queueSize(g);
      if (db.settings.autoArtwork) queueArtwork(g);
    } else stats.matched++;
    const seen = new Set(g.sessions.map((s) => s.start));
    for (const s of Array.isArray(ig.sessions) ? ig.sessions : []) {
      if (Number.isFinite(s?.start) && Number.isFinite(s?.end) && s.end > s.start && !seen.has(s.start)) { g.sessions.push({ start: s.start, end: s.end }); stats.sessions++; }
    }
    g.sessions.sort((a, b) => a.start - b.start);
    g.launches = Math.max(g.launches || 0, Number(ig.launches) || 0);
    g.bonusMs = Math.max(g.bonusMs || 0, Number(ig.bonusMs) || 0);
    g.favorite = g.favorite || !!ig.favorite;
    if (!g.status && STATUSES.includes(ig.status)) g.status = ig.status;
    if (!g.rating) g.rating = Math.min(5, Math.max(0, Number(ig.rating) || 0));
    if (['auto', 'always', 'never'].includes(ig.discord)) g.discord = ig.discord;
    const noteIds = new Set(g.notes.map((n) => n.id));
    for (const n of Array.isArray(ig.notes) ? ig.notes : []) {
      if (n && typeof n.text === 'string' && !noteIds.has(n.id)) g.notes.push({ id: n.id || crypto.randomUUID(), text: n.text.slice(0, 20000), pinned: !!n.pinned, createdAt: Number(n.createdAt) || Date.now(), updatedAt: Number(n.updatedAt) || Date.now() });
    }
    for (const a of Array.isArray(ig.achievements) ? ig.achievements : []) {
      if (!a || typeof a.title !== 'string') continue;
      const mine = g.achievements.find((x) => norm(x.title) === norm(a.title));
      if (mine) { if (a.unlockedAt && (!mine.unlockedAt || a.unlockedAt < mine.unlockedAt)) mine.unlockedAt = a.unlockedAt; } else g.achievements.push(cleanAchievement(a));
    }
  }
  for (const key of Array.isArray(data.ignored) ? data.ignored : []) if (typeof key === 'string' && !db.ignored.includes(key)) db.ignored.push(key);
  if (data.settings && typeof data.settings === 'object') {
    for (const [k, spec] of Object.entries(SETTINGS)) {
      if (data.settings[k] === undefined || k === 'discordEnabled') continue;
      try { db.settings[k] = coerceSetting(spec, data.settings[k]); } catch {}
    }
    if (Array.isArray(data.settings.gameFolders)) {
      for (const f of data.settings.gameFolders) if (typeof f === 'string' && fs.existsSync(f) && !db.settings.gameFolders.includes(f)) db.settings.gameFolders.push(f);
    }
  }
  save();
  return stats;
}

/* ---------------- Trophies and notes ---------------- */

function cleanAchievement(a) {
  return {
    id: crypto.randomUUID(),
    title: String(a.title).trim().slice(0, 120),
    description: String(a.description || '').trim().slice(0, 400),
    icon: typeof a.icon === 'string' && /^https?:\/\//i.test(a.icon) ? a.icon : null,
    tier: trophies.TIERS.includes(a.tier) && a.tier !== 'platinum' ? a.tier : 'bronze',
    percent: Number.isFinite(a.percent) ? a.percent : null,
    source: a.source === 'steam' ? 'steam' : 'manual',
    unlockedAt: Number(a.unlockedAt) || null,
  };
}

const achievementPayload = (g) => ({ list: g.achievements, summary: trophies.summarize(g.achievements), name: g.name });

/* ---------------- HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.json': 'application/json',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
};
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
let lastContact = Date.now();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = MAX_UPLOAD) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error(`Upload is larger than ${Math.round(limit / 1048576)} MB`)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 1 << 20) {
  const buf = await readBody(req, limit);
  return buf.length ? JSON.parse(buf.toString('utf8')) : {};
}

// Streams a file, with byte ranges so videos can loop and seek.
async function sendFile(req, res, file, cache) {
  let st;
  try { st = await fsp.stat(file); if (!st.isFile()) throw new Error('not a file'); } catch {
    res.writeHead(404);
    return res.end('Not found');
  }
  const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache, 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function validateGameInput(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    if (!String(body.name || '').trim()) throw new Error('Give the game a name');
    out.name = String(body.name).trim().slice(0, 200);
  }
  const type = body.launchType;
  if (type !== undefined && !['exe', 'steam', 'uri'].includes(type)) throw new Error('Unknown launch method');
  if (type === 'steam') {
    const id = String(body.launchId ?? '').trim();
    if (!/^\d+$/.test(id)) throw new Error('Enter the Steam App ID (numbers only)');
    out.launch = { type: 'steam', id };
  } else if (type === 'uri') {
    const uri = String(body.launchUri ?? '').trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(uri) || /^(https?|file):/i.test(uri)) throw new Error('Enter a launcher link such as com.epicgames.launcher://…');
    out.launch = { type: 'uri', uri };
  } else if (type === 'exe' || !partial) out.launch = { type: 'exe' };
  const needsExe = (out.launch || {}).type === 'exe';
  if (needsExe && (!partial || body.exe !== undefined)) {
    if (!body.exe || !fs.existsSync(body.exe)) throw new Error('Executable not found at that path');
    out.exe = path.resolve(body.exe);
  } else if (body.exe) {
    if (!fs.existsSync(body.exe)) throw new Error('Executable not found at that path');
    out.exe = path.resolve(body.exe);
  }
  if (body.folder !== undefined && body.folder !== '') {
    if (!fs.existsSync(body.folder)) throw new Error('Install folder not found');
    out.folder = path.resolve(body.folder);
  }
  if (body.args !== undefined) out.args = String(body.args);
  if (body.workDir !== undefined) {
    if (body.workDir && !fs.existsSync(body.workDir)) throw new Error('Working folder not found');
    out.workDir = body.workDir ? path.resolve(body.workDir) : '';
  }
  if (body.admin !== undefined) out.admin = !!body.admin;
  if (body.favorite !== undefined) out.favorite = !!body.favorite;
  if (body.progress !== undefined) {
    if (!STATUSES.includes(body.progress)) throw new Error('Unknown status');
    out.status = body.progress;
  }
  if (body.rating !== undefined) out.rating = Math.min(5, Math.max(0, Math.round(Number(body.rating) || 0)));
  if (body.discord !== undefined) {
    if (!['auto', 'always', 'never'].includes(body.discord)) throw new Error('Unknown Discord option');
    out.discord = body.discord;
  }
  if (body.steamAppId !== undefined) {
    const id = body.steamAppId === '' || body.steamAppId === null ? null : Number(body.steamAppId);
    if (id !== null && (!Number.isInteger(id) || id <= 0)) throw new Error('Steam App ID must be a number');
    out.steamAppId = id;
  }
  if (body.previousHours !== undefined) {
    const h = Number(body.previousHours);
    if (!Number.isFinite(h) || h < 0 || h > 100000) throw new Error('Previous playtime must be 0 or more hours');
    out.bonusMs = Math.round(h * 3600000);
  }
  return out;
}

/* ---------------- Spotify (now playing + playback control) ---------------- */
// Uses the Spotify Web API with the PKCE login flow, so no client secret is needed.
// It controls whatever Spotify device is active (usually the Spotify app on this PC).

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_REDIRECT = `http://127.0.0.1:${PORT}/spotify/callback`;
const SPOTIFY_SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
let spotifyAuth = null; // pending login: { verifier, state, at }
let spotifyCache = { at: 0, data: null };
let spotifyBackoff = 0;
let spotifyRefreshing = null;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const htmlEsc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function spotifyError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function spotifyAuthUrl() {
  const clientId = db.settings.spotifyClientId;
  if (!clientId) throw new Error('Paste your Spotify Client ID in Settings first');
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  spotifyAuth = { verifier, state, at: Date.now() };
  return 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: SPOTIFY_REDIRECT,
    code_challenge_method: 'S256', code_challenge: challenge, state, scope: SPOTIFY_SCOPES,
  });
}

async function spotifyToken(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: db.settings.spotifyClientId, ...params }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error_description || data.error || `Spotify sign-in failed (${res.status})`);
    e.status = res.status;
    throw e;
  }
  db.spotify = {
    access: data.access_token,
    refresh: data.refresh_token || db.spotify?.refresh,
    expires: Date.now() + Math.max(60, (data.expires_in || 3600) - 60) * 1000,
  };
  save();
}

async function spotifyAccessToken() {
  if (!db.spotify) return null;
  if (Date.now() >= db.spotify.expires) {
    // Share one refresh between concurrent requests (refresh tokens can rotate).
    spotifyRefreshing ||= spotifyToken({ grant_type: 'refresh_token', refresh_token: db.spotify.refresh })
      .finally(() => { spotifyRefreshing = null; });
    try {
      await spotifyRefreshing;
    } catch (e) {
      if (e.status === 400 || e.status === 401) { db.spotify = null; save(); return null; }
      throw spotifyError(0, 'Couldn’t reach Spotify');
    }
  }
  return db.spotify?.access || null;
}

async function spotifyApi(method, apiPath, body, retry = true) {
  const token = await spotifyAccessToken();
  if (!token) throw spotifyError(401, 'Spotify isn’t connected');
  let res;
  try {
    res = await fetch(SPOTIFY_API + apiPath, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw spotifyError(0, 'Couldn’t reach Spotify');
  }
  if (res.status === 401 && retry && db.spotify) { db.spotify.expires = 0; return spotifyApi(method, apiPath, body, false); }
  if (res.status === 429) {
    spotifyBackoff = Date.now() + (Number(res.headers.get('retry-after')) || 5) * 1000;
    throw spotifyError(429, 'Spotify is rate limiting requests. Try again in a moment.');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (res.status >= 400) {
    const reason = data?.error?.reason;
    const msg = reason === 'PREMIUM_REQUIRED' ? 'Controlling playback needs Spotify Premium'
      : data?.error?.message || `Spotify error (${res.status})`;
    const e = spotifyError(res.status, msg);
    e.reason = reason;
    throw e;
  }
  return { status: res.status, data };
}

async function spotifyNow() {
  const base = { configured: !!db.settings.spotifyClientId, connected: !!db.spotify };
  if (!base.configured || !base.connected) return { ...base, active: false, isPlaying: false, track: null };
  const now = Date.now();
  if (spotifyCache.data && (now - spotifyCache.at < 800 || now < spotifyBackoff)) return spotifyCache.data;
  let out;
  try {
    const r = await spotifyApi('GET', '/me/player?additional_types=episode');
    const d = r.data;
    const it = d?.item;
    if (!it) {
      out = { ...base, active: !!d?.device, isPlaying: false, track: null, device: d?.device?.name || null };
    } else {
      const episode = it.type === 'episode';
      const images = (episode ? it.images : it.album?.images) || [];
      out = {
        ...base,
        active: true,
        isPlaying: !!d.is_playing,
        progressMs: d.progress_ms || 0,
        device: d.device?.name || null,
        track: {
          id: it.id,
          name: it.name,
          artists: episode ? it.show?.name || '' : (it.artists || []).map((a) => a.name).join(', '),
          album: episode ? '' : it.album?.name || '',
          art: images[0]?.url || null,
          durationMs: it.duration_ms || 0,
        },
      };
    }
  } catch (e) {
    return { configured: base.configured, connected: !!db.spotify, active: false, isPlaying: false, track: null, error: e.message };
  }
  spotifyCache = { at: Date.now(), data: out };
  return out;
}

async function spotifyControl({ action, positionMs }) {
  const req = {
    play: ['PUT', '/me/player/play'],
    pause: ['PUT', '/me/player/pause'],
    next: ['POST', '/me/player/next'],
    previous: ['POST', '/me/player/previous'],
    seek: ['PUT', `/me/player/seek?position_ms=${Math.max(0, Math.round(Number(positionMs) || 0))}`],
  }[action];
  if (!req) throw new Error('Unknown action');
  spotifyCache.at = 0;
  try {
    await spotifyApi(...req);
  } catch (e) {
    if (/Restriction violated/i.test(e.message) && (action === 'play' || action === 'pause')) return; // already in that state
    if (e.status !== 404) throw e;
    // No active device: wake the one Spotify knows about (e.g. the app on this PC).
    const devices = (await spotifyApi('GET', '/me/player/devices')).data?.devices || [];
    const device = devices.find((d) => d.is_active) || devices[0];
    if (!device) throw new Error('Open Spotify on this PC and start a song first');
    await spotifyApi('PUT', '/me/player', { device_ids: [device.id], play: action === 'play' });
    if (action !== 'play') {
      await new Promise((r) => setTimeout(r, 700));
      await spotifyApi(...req);
    }
  }
}

function openExternal(url) {
  const child = spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
}

function spotifyPage(title, message) {
  return `<!doctype html><meta charset="utf-8"><title>${htmlEsc(title)}</title>
<body style="margin:0;display:grid;place-items:center;height:100vh;background:#000;color:#fff;font-family:'Segoe UI',Arial,sans-serif;text-align:center">
<div><h1 style="font-weight:300;font-size:2.5rem;margin:0 0 .75rem">${htmlEsc(title)}</h1><p style="color:#ccc;font-size:1.1rem;margin:0">${htmlEsc(message)}</p></div></body>`;
}

async function spotifyCallback(url, res) {
  const page = (status, title, msg) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(spotifyPage(title, msg)); };
  const auth = spotifyAuth;
  spotifyAuth = null;
  const err = url.searchParams.get('error');
  if (err) return page(400, 'Spotify wasn’t connected', err === 'access_denied' ? 'You declined access. You can try again from the library.' : err);
  if (!auth || Date.now() - auth.at > 10 * 60 * 1000 || url.searchParams.get('state') !== auth.state) {
    return page(400, 'Sign-in expired', 'Go back to the library and choose Connect Spotify again.');
  }
  try {
    await spotifyToken({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: SPOTIFY_REDIRECT, code_verifier: auth.verifier });
    spotifyCache = { at: 0, data: null };
    return page(200, 'Spotify connected', 'You can close this tab and return to the Game Library.');
  } catch (e) {
    return page(400, 'Spotify wasn’t connected', e.message);
  }
}

async function handle(req, res) {
  if (!ALLOWED_HOSTS.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, ''))) { res.writeHead(403); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const m = p.match(/^\/api\/games\/([\w-]+)(?:\/([\w-]+))?(?:\/([\w-]+))?$/);

  if (p.startsWith('/api/')) lastContact = Date.now();

  if (p === '/api/ping') return sendJson(res, 200, { ok: true });

  if (p === '/api/state' && req.method === 'GET') {
    const now = Date.now();
    const since = Number(url.searchParams.get('since')) || 0;
    return sendJson(res, 200, {
      now,
      settings: publicSettings(),
      drives: await drives(),
      busy: { artwork: artworkQueue.size, sizing: sizing.size },
      spotify: { configured: !!db.settings.spotifyClientId, connected: !!db.spotify },
      busy: { artwork: artworkQueue.size, sizing: sizing.size, scanning: !!scanning },
      games: db.games.map((g) => publicGame(g, now)),
      wallpapers: db.wallpapers.map(publicWallpaper),
      trophies: trophyTotals(),
      discord: { ...presence.info(), note: presenceNote },
      events: events.filter((e) => e.id > since),
      eventSeq,
      ignored: db.ignored.length,
    });
  }

  if (p === '/api/stats' && req.method === 'GET') {
    const now = Date.now();
    const opts = { weekStartsOn: db.settings.weekStartsOn };
    const games = db.games.map((g) => {
      const r = running.get(g.id);
      return { id: g.id, name: g.name, bonusMs: g.bonusMs, sessions: r ? [...g.sessions, { start: r.start, end: now }] : g.sessions };
    });
    return sendJson(res, 200, { now, goalHours: db.settings.weeklyGoalHours, ...stats.libraryStats(games, now, opts) });
  }

  if (p === '/api/games' && req.method === 'POST') {
    const body = await readJson(req);
    const input = validateGameInput(body, false);
    const g = makeGame({ name: input.name, exe: input.exe, folder: input.folder, args: input.args, launch: input.launch, source: 'manual', steamAppId: input.steamAppId });
    for (const k of ['workDir', 'admin', 'favorite', 'status', 'rating', 'discord', 'bonusMs']) if (input[k] !== undefined) g[k] = input[k];
    if (g.folder) db.ignored = db.ignored.filter((k) => k !== 'dir:' + lc(g.folder));
    db.games.push(g);
    save();
    if (g.folder) queueSize(g);
    if (db.settings.autoArtwork && body.autoArtwork !== false) queueArtwork(g);
    return sendJson(res, 200, publicGame(g, Date.now()));
  }

  if (p === '/api/artwork/search' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return sendJson(res, 200, []);
    try {
      return sendJson(res, 200, await steamSearch(searchTerm(q) || q));
    } catch {
      return sendJson(res, 502, { error: 'Couldn’t reach Steam. Check your internet connection.' });
    }
  }

  if (p === '/api/artwork/assets' && req.method === 'GET') {
    const appid = Number(url.searchParams.get('appid'));
    if (!Number.isInteger(appid) || appid <= 0) return sendJson(res, 400, { error: 'Invalid app id' });
    const c = await steamAssetCandidates(appid);
    const [cover, background, logo] = await Promise.all(IMAGE_KINDS.map((k) => firstReachable(c[k])));
    return sendJson(res, 200, { appid, name: c.name, cover, background, logo });
  }

  if (p === '/api/artwork/auto' && req.method === 'POST') {
    const body = await readJson(req);
    const targets = db.games.filter((g) => body.force || !g.cover || !g.background || !g.logo);
    for (const g of targets) queueArtwork(g, !!body.force);
    return sendJson(res, 200, { queued: targets.length });
  }

  if (p === '/api/suggest' && req.method === 'GET') {
    const exe = url.searchParams.get('exe') || '';
    const folder = inferFolder(exe);
    return sendJson(res, 200, { folder, name: cleanName(path.basename(folder)) });
  }

  if (m) {
    const g = byId(m[1]);
    if (!g) return sendJson(res, 404, { error: 'Game not found' });
    const action = m[2];
    const sub = m[3];

    if (!action && req.method === 'PATCH') {
      const body = await readJson(req);
      const input = validateGameInput(body, true);
      const folderChanged = input.folder && input.folder !== g.folder;
      const exeChanged = input.exe && input.exe !== g.exe;
      if (input.steamAppId && input.steamAppId !== g.steamAppId) g.artworkChecked = false;
      Object.assign(g, input);
      if (input.exe && !input.folder && !g.folder) g.folder = inferFolder(input.exe);
      watchNames.delete(g.id);
      save();
      if (folderChanged || (exeChanged && !g.sizeBytes)) queueSize(g);
      if (running.has(g.id)) refreshPresence();
      return sendJson(res, 200, publicGame(g, Date.now()));
    }
    if (!action && req.method === 'DELETE') {
      for (const kind of IMAGE_KINDS) removeImage(g[kind]);
      // Remember what was removed so a later scan doesn't bring it straight back.
      const key = g.sourceKey || (g.folder ? 'dir:' + lc(g.folder) : null);
      if (key && !db.ignored.includes(key)) db.ignored.push(key);
      db.games.splice(db.games.indexOf(g), 1);
      running.delete(g.id);
      pending.delete(g.id);
      save();
      refreshPresence();
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'launch' && req.method === 'POST') {
      if (running.has(g.id)) {
        const names = [...(running.get(g.id).alive || [])];
        const focused = await platform.focusProcess(names);
        return sendJson(res, 200, { ok: true, resumed: true, focused });
      }
      if (!launchable(g)) return sendJson(res, 400, { error: g.launch.type === 'exe' ? 'Executable not found. Edit the game to fix its path.' : 'The game’s folder is missing. It may have been uninstalled.' });
      const err = await platform.startTarget(launchTarget(g));
      if (err) {
        emit('launch-failed', { gameId: g.id, name: g.name, message: err });
        return sendJson(res, 500, { error: err });
      }
      g.launches = (g.launches || 0) + 1;
      pending.set(g.id, Date.now());
      save();
      scheduleTracker(2500);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'close' && req.method === 'POST') {
      const r = running.get(g.id);
      if (!r) return sendJson(res, 409, { error: `${g.name} isn’t running` });
      const n = await platform.killProcesses([...r.alive]);
      scheduleTracker(1500);
      return sendJson(res, 200, { ok: true, closed: n });
    }
    if (action === 'image' && (req.method === 'POST' || req.method === 'DELETE')) {
      const kind = url.searchParams.get('kind');
      if (!IMAGE_KINDS.includes(kind)) return sendJson(res, 400, { error: 'Unknown image kind' });
      if (req.method === 'DELETE') {
        removeImage(g[kind]);
        g[kind] = null;
        save();
        return sendJson(res, 200, publicGame(g, Date.now()));
      }
      const type = (req.headers['content-type'] || '').split(';')[0].trim();
      if (IMG_TYPES[type]) {
        await storeImage(g, kind, await readBody(req), IMG_TYPES[type]);
      } else {
        const body = await readJson(req);
        if (body.url) {
          const { buf, ext } = await imageFromUrl(body.url);
          await storeImage(g, kind, buf, ext);
        } else if (body.path && IMG_EXT_RE.test(body.path)) {
          const ext = IMG_EXT_RE.exec(body.path)[1].toLowerCase().replace('jpeg', 'jpg');
          await storeImage(g, kind, await fsp.readFile(body.path), ext);
        } else {
          return sendJson(res, 400, { error: 'Send an image file, URL or path' });
        }
      }
      return sendJson(res, 200, publicGame(g, Date.now()));
    }
    if (action === 'open-folder' && req.method === 'POST') {
      if (!g.folder) return sendJson(res, 400, { error: 'This game has no install folder set' });
      platform.openFolder(g.folder);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'rescan-size' && req.method === 'POST') {
      queueSize(g);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'reset-stats' && req.method === 'POST') {
      g.sessions = [];
      g.launches = 0;
      g.bonusMs = 0;
      delete g.activeSession;
      if (running.has(g.id)) running.get(g.id).start = Date.now();
      save();
      return sendJson(res, 200, publicGame(g, Date.now()));
    }
    if (action === 'stats' && req.method === 'GET') {
      const now = Date.now();
      const r = running.get(g.id);
      const asStat = (x) => ({ id: x.id, name: x.name, bonusMs: x.bonusMs, sessions: x.id === g.id && r ? [...x.sessions, { start: r.start, end: now }] : x.sessions });
      const all = db.games.map(asStat);
      const total = all.reduce((a, x) => a + x.bonusMs + x.sessions.reduce((b, s) => b + (s.end - s.start), 0), 0);
      return sendJson(res, 200, { now, ...stats.gameStats(asStat(g), total, now, { weekStartsOn: db.settings.weekStartsOn }), launches: g.launches || 0 });
    }

    /* ----- notes ----- */
    if (action === 'notes') {
      if (!sub && req.method === 'GET') return sendJson(res, 200, [...g.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt));
      if (!sub && req.method === 'POST') {
        const text = String((await readJson(req)).text || '').trim();
        if (!text) return sendJson(res, 400, { error: 'Write something first' });
        const now = Date.now();
        const note = { id: crypto.randomUUID(), text: text.slice(0, 20000), pinned: false, createdAt: now, updatedAt: now };
        g.notes.push(note);
        save();
        return sendJson(res, 200, note);
      }
      const note = g.notes.find((n) => n.id === sub);
      if (!note) return sendJson(res, 404, { error: 'Note not found' });
      if (req.method === 'PATCH') {
        const body = await readJson(req);
        if (body.text !== undefined) {
          const text = String(body.text).trim();
          if (!text) return sendJson(res, 400, { error: 'A note can’t be empty. Delete it instead.' });
          note.text = text.slice(0, 20000);
          note.updatedAt = Date.now();
        }
        if (body.pinned !== undefined) note.pinned = !!body.pinned;
        save();
        return sendJson(res, 200, note);
      }
      if (req.method === 'DELETE') {
        g.notes.splice(g.notes.indexOf(note), 1);
        save();
        return sendJson(res, 200, { ok: true });
      }
    }

    /* ----- trophies ----- */
    if (action === 'achievements') {
      if (!sub && req.method === 'GET') return sendJson(res, 200, achievementPayload(g));
      if (!sub && req.method === 'POST') {
        const body = await readJson(req);
        if (!String(body.title || '').trim()) return sendJson(res, 400, { error: 'Give the trophy a name' });
        g.achievements.push(cleanAchievement({ ...body, unlockedAt: null, source: 'manual' }));
        save();
        return sendJson(res, 200, achievementPayload(g));
      }
      if (sub === 'import-steam' && req.method === 'POST') {
        const body = await readJson(req);
        const appid = Number(body.appid) || g.steamAppId;
        if (!appid) return sendJson(res, 400, { error: 'This game has no Steam App ID yet. Find artwork online or enter one in Edit details.' });
        let list;
        try { list = await trophies.fetchSteamAchievements(appid, WEB_HEADERS); } catch (e) { return sendJson(res, 502, { error: `Couldn’t import from Steam: ${e.message}` }); }
        let added = 0;
        for (const a of list) {
          const mine = g.achievements.find((x) => norm(x.title) === norm(a.title));
          if (mine) { Object.assign(mine, { description: a.description || mine.description, icon: a.icon || mine.icon, percent: a.percent, tier: mine.source === 'steam' ? a.tier : mine.tier }); continue; }
          g.achievements.push(cleanAchievement({ ...a, source: 'steam' }));
          added++;
        }
        if (!g.steamAppId) g.steamAppId = appid;
        save();
        return sendJson(res, 200, { ...achievementPayload(g), added });
      }
      if (sub === 'reset' && req.method === 'POST') {
        for (const a of g.achievements) a.unlockedAt = null;
        save();
        return sendJson(res, 200, achievementPayload(g));
      }
      if (sub === 'clear' && req.method === 'POST') {
        g.achievements = [];
        save();
        return sendJson(res, 200, achievementPayload(g));
      }
      const ach = g.achievements.find((a) => a.id === sub);
      if (!ach) return sendJson(res, 404, { error: 'Trophy not found' });
      if (req.method === 'PATCH') {
        const body = await readJson(req);
        const before = trophies.summarize(g.achievements).platinum;
        if (body.title !== undefined && String(body.title).trim()) ach.title = String(body.title).trim().slice(0, 120);
        if (body.description !== undefined) ach.description = String(body.description).trim().slice(0, 400);
        if (body.tier !== undefined && trophies.TIERS.includes(body.tier) && body.tier !== 'platinum') ach.tier = body.tier;
        let unlockedNow = false;
        if (body.unlocked !== undefined) {
          const was = !!ach.unlockedAt;
          ach.unlockedAt = body.unlocked ? (was ? ach.unlockedAt : Date.now()) : null;
          unlockedNow = !was && !!ach.unlockedAt;
        }
        save();
        if (running.has(g.id)) refreshPresence();
        const after = trophies.summarize(g.achievements).platinum;
        return sendJson(res, 200, { ...achievementPayload(g), achievement: ach, unlockedNow, platinumNow: !before && after });
      }
      if (req.method === 'DELETE') {
        g.achievements.splice(g.achievements.indexOf(ach), 1);
        save();
        return sendJson(res, 200, achievementPayload(g));
      }
    }
    return sendJson(res, 404, { error: 'Unknown action' });
  }

  /* ----- settings ----- */
  if (p === '/api/settings' && req.method === 'POST') {
    const body = await readJson(req);
    const s = db.settings;
    if (body.gameFolders !== undefined) {
      if (!Array.isArray(body.gameFolders)) return sendJson(res, 400, { error: 'Folders must be a list' });
      const bad = body.gameFolders.find((f) => !fs.existsSync(f));
      if (bad) return sendJson(res, 400, { error: `Folder not found: ${bad}` });
      s.gameFolders = [...new Set(body.gameFolders.map((f) => path.resolve(f)))];
    }
    if (body.gamesRoot !== undefined) {
      if (!fs.existsSync(body.gamesRoot)) return sendJson(res, 400, { error: 'Folder not found' });
      s.gameFolders = [...new Set([path.resolve(body.gamesRoot), ...s.gameFolders.slice(1)])];
    }
    if (body.clock24 !== undefined) db.settings.clock24 = !!body.clock24;
    if (body.sounds !== undefined) db.settings.sounds = !!body.sounds;
    if (body.autoArtwork !== undefined) db.settings.autoArtwork = !!body.autoArtwork;
    if (body.spotifyClientId !== undefined) {
      const id = String(body.spotifyClientId).trim();
      if (id && !/^[0-9a-f]{32}$/i.test(id)) return sendJson(res, 400, { error: 'That doesn’t look like a Spotify Client ID (32 letters and numbers)' });
      if (id !== db.settings.spotifyClientId) { db.settings.spotifyClientId = id; db.spotify = null; spotifyCache = { at: 0, data: null }; }
    }
    if (body.profileName !== undefined) db.settings.profileName = String(body.profileName).trim().slice(0, 40);
    if (body.steamPath && !fs.existsSync(body.steamPath)) return sendJson(res, 400, { error: 'Steam folder not found' });
    for (const [k, spec] of Object.entries(SETTINGS)) {
      if (body[k] === undefined) continue;
      try { s[k] = coerceSetting(spec, body[k]); } catch (e) { return sendJson(res, 400, { error: `${k}: ${e.message}` }); }
    }
    if (s.wallpaperId && !db.wallpapers.some((w) => w.id === s.wallpaperId)) s.wallpaperId = '';
    save();
    driveCache.at = 0;
    applyDiscordSettings();
    scheduleAutoScan();
    return sendJson(res, 200, publicSettings());
  }

  if (p === '/api/startup' && req.method === 'GET') return sendJson(res, 200, { available: platform.IS_WIN, enabled: await platform.startupEnabled() });
  if (p === '/api/startup' && req.method === 'POST') {
    const body = await readJson(req);
    try { await platform.setStartup(!!body.enabled, __dirname); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    return sendJson(res, 200, { available: true, enabled: !!body.enabled });
  }

  if (p === '/api/scan' && req.method === 'POST') {
    const r = await scanLibrary();
    return sendJson(res, 200, { added: r.added.map((a) => a.name), details: r.added, sources: r.sources });
  }

  if (p === '/api/restore-removed' && req.method === 'POST') {
    const n = db.ignored.length;
    db.ignored = [];
    save();
    return sendJson(res, 200, { restored: n });
  }

  if (p === '/api/cleanup-missing' && req.method === 'POST') {
    const gone = db.games.filter((g) => !launchable(g) && !running.has(g.id));
    for (const g of gone) {
      for (const kind of IMAGE_KINDS) removeImage(g[kind]);
      db.games.splice(db.games.indexOf(g), 1);
    }
    if (gone.length) save();
    return sendJson(res, 200, { removed: gone.map((g) => g.name) });
  }

  /* ----- wallpapers ----- */
  if (p === '/api/wallpapers' && req.method === 'POST') {
    const type = (req.headers['content-type'] || '').split(';')[0].trim();
    let w;
    if (IMG_TYPES[type] || VIDEO_TYPES[type]) {
      w = await storeWallpaper(await readBody(req, MAX_WALLPAPER), IMG_TYPES[type] || VIDEO_TYPES[type], decodeURIComponent(req.headers['x-name'] || 'Wallpaper'));
    } else {
      const body = await readJson(req);
      if (body.url) {
        const { buf, ext } = await mediaFromUrl(body.url, { limit: MAX_WALLPAPER, video: true });
        w = await storeWallpaper(buf, ext, decodeURIComponent(new URL(body.url).pathname.split('/').pop() || 'Wallpaper').replace(/\.\w+$/, ''));
      } else if (body.path && MEDIA_EXT_RE.test(body.path)) {
        const st = await fsp.stat(body.path);
        if (st.size > MAX_WALLPAPER) return sendJson(res, 400, { error: 'That file is larger than 150 MB' });
        w = await storeWallpaper(await fsp.readFile(body.path), MEDIA_EXT_RE.exec(body.path)[1].toLowerCase().replace('jpeg', 'jpg'), path.basename(body.path, path.extname(body.path)));
      } else {
        return sendJson(res, 400, { error: 'Send an image, GIF or video file, link or path' });
      }
    }
    return sendJson(res, 200, publicWallpaper(w));
  }
  const wp = p.match(/^\/api\/wallpapers\/([\w-]+)$/);
  if (wp && req.method === 'DELETE') {
    const w = db.wallpapers.find((x) => x.id === wp[1]);
    if (!w) return sendJson(res, 404, { error: 'Wallpaper not found' });
    db.wallpapers.splice(db.wallpapers.indexOf(w), 1);
    fsp.unlink(path.join(WALL_DIR, w.file)).catch(() => {});
    if (db.settings.wallpaperId === w.id) db.settings.wallpaperId = '';
    save();
    return sendJson(res, 200, { ok: true });
  }

  /* ----- controllers ----- */
  if (p === '/api/controllers' && req.method === 'GET') return sendJson(res, 200, { xinput: await xinputBatteries() });

  /* ----- backup ----- */
  if (p === '/api/export' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="game-library-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify(exportData(), null, 2));
  }
  if (p === '/api/import' && req.method === 'POST') {
    const r = importData(await readJson(req, 64 << 20));
    applyDiscordSettings();
    scheduleAutoScan();
    return sendJson(res, 200, r);
  }
  if (p === '/api/open-data' && req.method === 'POST') {
    platform.openFolder(DATA_DIR);
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/browse' && req.method === 'GET') {
    try {
      return sendJson(res, 200, await browse(url.searchParams.get('path') || '', url.searchParams.get('filter') || ''));
    } catch (e) {
      return sendJson(res, 400, { error: `Can't open that folder (${e.code || e.message})` });
    }
  }

  if (p === '/api/preview' && req.method === 'GET') {
    const file = url.searchParams.get('path') || '';
    if (!MEDIA_EXT_RE.test(file)) { res.writeHead(400); return res.end(); }
    return sendFile(req, res, file, 'no-store');
  }

  if (p === '/spotify/callback' && req.method === 'GET') return spotifyCallback(url, res);

  if (p === '/api/spotify/now' && req.method === 'GET') return sendJson(res, 200, await spotifyNow());

  if (p === '/api/spotify/connect' && req.method === 'POST') {
    let authUrl;
    try { authUrl = spotifyAuthUrl(); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    openExternal(authUrl);
    return sendJson(res, 200, { ok: true, url: authUrl });
  }

  if (p === '/api/spotify/disconnect' && req.method === 'POST') {
    db.spotify = null;
    spotifyCache = { at: 0, data: null };
    save();
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/spotify/control' && req.method === 'POST') {
    try {
      await spotifyControl(await readJson(req));
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, e.status === 401 ? 401 : 502, { error: e.message });
    }
  }

  if (p === '/api/quit' && req.method === 'POST') {
    sendJson(res, 200, { ok: true });
    setTimeout(shutdown, 100);
    return;
  }

  if (p.startsWith('/img/')) return sendFile(req, res, path.join(IMG_DIR, path.basename(p)), 'public, max-age=31536000, immutable');
  if (p.startsWith('/wp/')) return sendFile(req, res, path.join(WALL_DIR, path.basename(p)), 'public, max-age=31536000, immutable');

  if ((req.method === 'GET' || req.method === 'HEAD') && !p.startsWith('/api/')) {
    const file = path.normalize(path.join(PUBLIC_DIR, p === '/' ? 'index.html' : decodeURIComponent(p)));
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    return sendFile(req, res, file, 'no-cache');
  }

  sendJson(res, 404, { error: 'Not found' });
}

/* ---------------- Window + lifecycle ---------------- */

function openWindow() {
  const { spawn } = require('child_process');
  const url = `http://127.0.0.1:${PORT}/`;
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const local = process.env.LOCALAPPDATA || '';
  const browsers = [
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    path.join(local, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
  ];
  const exe = browsers.find((b) => fs.existsSync(b));
  if (!exe) {
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return;
  }
  const profile = path.join(local || DATA_DIR, 'PS5GameLibrary', 'browser-profile');
  spawn(exe, [
    `--app=${url}`, `--user-data-dir=${profile}`, '--start-fullscreen', '--no-first-run',
    '--no-default-browser-check', '--disable-features=Translate', '--autoplay-policy=no-user-gesture-required',
  ], { detached: true, stdio: 'ignore' }).unref();
}

function shutdown() {
  const now = Date.now();
  for (const [id, r] of running) {
    const g = byId(id);
    if (g) endSession(g, r, now);
  }
  try { presence.stop(); } catch {}
  try { saveNow(); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (!res.headersSent) sendJson(res, 400, { error: e.message });
    else res.end();
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // Already running: just bring up another window.
    if (OPEN_WINDOW) openWindow();
    setTimeout(() => process.exit(0), 500);
    return;
  }
  throw e;
});

server.listen(PORT, HOST, async () => {
  console.log(`Game library running at http://127.0.0.1:${PORT}/`);
  if (firstRun) {
    const r = await scanLibrary();
    console.log(`First run: added ${r.added.length} game(s)`);
    saveNow();
  } else if (db.settings.autoScan !== 'off') {
    scanLibrary({ auto: true }).catch((e) => console.error('scan', e.message));
  }
  for (const g of db.games) {
    if (g.folder && (g.sizeBytes == null || Date.now() - (g.sizeScannedAt || 0) > DAY_MS)) queueSize(g);
    if (db.settings.autoArtwork && !g.artworkChecked && (!g.cover || !g.background)) queueArtwork(g);
  }
  scheduleAutoScan();
  applyDiscordSettings();
  scheduleTracker(1000);
  if (OPEN_WINDOW) {
    openWindow();
    // Exit once the window has been closed for a while and no game is being tracked.
    setInterval(() => {
      const idle = db.settings.idleExitMin * 60000;
      if (idle && Date.now() - lastContact > idle && !running.size && !pending.size) shutdown();
    }, 30000);
  }
});
