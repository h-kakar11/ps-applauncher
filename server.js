'use strict';
// PS5-style game library: zero-dependency local server (Node 18.15+).
// Serves the UI, stores the library, launches games, tracks playtime and fetches artwork.
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const PORT = Number(process.env.PS5LIB_PORT) || 4545;
const HOST = '127.0.0.1';
const OPEN_WINDOW = process.argv.includes('--open');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');
const DB_FILE = path.join(DATA_DIR, 'library.json');
const IDLE_EXIT_MS = 5 * 60 * 1000;
const DAY_MS = 86400000;
const MAX_UPLOAD = 25 * 1024 * 1024;

fs.mkdirSync(IMG_DIR, { recursive: true });

/* ---------------- Library database ---------------- */

const DEFAULT_SETTINGS = { gamesRoot: 'A:\\games', clock24: true, profileName: '', sounds: true, autoArtwork: true };
const IMAGE_KINDS = ['cover', 'background', 'logo'];
const firstRun = !fs.existsSync(DB_FILE);
const db = loadDb();

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { settings: { ...DEFAULT_SETTINGS, ...raw.settings }, games: Array.isArray(raw.games) ? raw.games : [] };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, games: [] };
  }
}

// A session left open by a crash or forced kill is closed at its last-seen time.
for (const g of db.games) {
  g.sessions ||= [];
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

function makeGame({ name, exe, folder, args }) {
  return {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    exe: path.resolve(exe),
    folder: path.resolve(folder || inferFolder(exe)),
    args: args ? String(args) : '',
    cover: null,
    background: null,
    logo: null,
    steamAppId: null,
    artworkChecked: false,
    addedAt: Date.now(),
    sizeBytes: null,
    sizeScannedAt: null,
    launches: 0,
    sessions: [],
  };
}

/* ---------------- Game detection ---------------- */

const CONTAINER_DIR = /^(games|repacks|installed|library|steamapps|common)$/i;
const JUNK_DIR = /^(_?redist|_?commonredist|directx|vcredist|support|_bypass.*|easyanticheat|battleye|__installer|installers?|_manifest|prereq.*)$/i;
const JUNK_EXE = /^(unins\d*|uninstall.*|dxwebsetup|dxsetup|quicksfv|vc_?redist.*|vcredist.*|ue[345]?prereqsetup.*|.*crashhandler.*|crashreport.*|crs-.*|setup.*|install.*|dotnet.*|oalinst|physx.*|unitycrashhandler.*|cefprocess|.*cefsubprocess.*)\.exe$/i;

async function findExes(dir, depth = 5, out = []) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !JUNK_DIR.test(e.name)) await findExes(p, depth - 1, out);
    } else if (/\.exe$/i.test(e.name) && !JUNK_EXE.test(e.name)) {
      try { out.push({ path: p, size: (await fsp.stat(p)).size }); } catch {}
    }
  }
  return out;
}

async function detectExe(folder) {
  const exes = await findExes(folder);
  if (!exes.length) return null;
  // Anti-cheat protected games must start through their bootstrapper.
  const protectedStart = exes.find((e) => /^start_protected_game\.exe$/i.test(path.basename(e.path)));
  if (protectedStart) return protectedStart.path;
  exes.sort((a, b) => b.size - a.size);
  return exes[0].path;
}

function cleanName(folderName) {
  return folderName.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferFolder(exe) {
  const root = path.resolve(db.settings.gamesRoot);
  const rel = path.relative(root, path.resolve(exe));
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    const parts = rel.split(path.sep);
    const depth = parts.length > 2 && CONTAINER_DIR.test(parts[0]) ? 2 : 1;
    if (parts.length > depth) return path.join(root, ...parts.slice(0, depth));
  }
  return path.dirname(path.resolve(exe));
}

async function scanRoot() {
  const added = [];
  const known = new Set(db.games.map((g) => path.resolve(g.folder).toLowerCase()));
  async function visit(dir, level) {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (level === 0 && CONTAINER_DIR.test(e.name)) { await visit(p, 1); continue; }
      if (known.has(p.toLowerCase())) continue;
      const exe = await detectExe(p);
      if (!exe) continue;
      const g = makeGame({ name: cleanName(e.name), exe, folder: p });
      db.games.push(g);
      known.add(p.toLowerCase());
      added.push(g.name);
      queueSize(g);
      if (db.settings.autoArtwork) queueArtwork(g);
    }
  }
  await visit(path.resolve(db.settings.gamesRoot), 0);
  if (added.length) save();
  return added;
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
      if (g && fs.existsSync(g.folder)) {
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
  const roots = new Set([db.settings.gamesRoot, ...db.games.map((g) => g.folder)].map((p) => path.parse(path.resolve(p)).root.toUpperCase()));
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

const running = new Map(); // id -> { start, lastSeen }
const pending = new Map(); // id -> launchedAt (waiting for the process to appear)
const watchNames = new Map(); // id -> { key, names:Set }
let trackerTimer = null;
let lastPersist = 0;

async function namesFor(g) {
  const key = g.exe + '|' + g.folder;
  const cached = watchNames.get(g.id);
  if (cached && cached.key === key) return cached.names;
  const names = new Set([path.basename(g.exe).toLowerCase()]);
  for (const e of await findExes(g.folder, 6)) {
    if (e.size >= 8 * 1024 * 1024) names.add(path.basename(e.path).toLowerCase());
  }
  watchNames.set(g.id, { key, names });
  return names;
}

function processList() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 16 << 20 }, (err, out) => {
      if (err) return resolve(null);
      const set = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = /^"([^"]+)"/.exec(line);
        if (m) set.add(m[1].toLowerCase());
      }
      resolve(set);
    });
  });
}

function endSession(g, r, now) {
  if (now - r.start > 5000) g.sessions.push({ start: r.start, end: now });
  delete g.activeSession;
  running.delete(g.id);
  save();
}

async function trackerTick() {
  const procs = await processList();
  if (!procs) return;
  const now = Date.now();
  let changed = false;
  for (const g of db.games) {
    const names = await namesFor(g);
    let alive = false;
    for (const n of names) if (procs.has(n)) { alive = true; break; }
    const r = running.get(g.id);
    if (alive) {
      if (!r) {
        running.set(g.id, { start: pending.get(g.id) ?? now, lastSeen: now });
        pending.delete(g.id);
        changed = true;
      } else {
        r.lastSeen = now;
      }
    } else if (r) {
      endSession(g, r, now);
    } else if (pending.has(g.id) && now - pending.get(g.id) > 120000) {
      pending.delete(g.id);
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

const psQuote = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function launch(g) {
  // Start-Process goes through ShellExecute, so games that need admin get a UAC prompt.
  let cmd = `Start-Process -FilePath ${psQuote(g.exe)} -WorkingDirectory ${psQuote(path.dirname(g.exe))}`;
  if (g.args && g.args.trim()) cmd += ` -ArgumentList ${psQuote(g.args.trim())}`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true }, (err, _out, stderr) => {
      resolve(err ? (String(stderr).trim().split(/\r?\n/)[0] || err.message) : null);
    });
  });
}

/* ---------------- Public game shape ---------------- */

function dailyPlay(sessions, days = 14) {
  const out = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = today.getTime() - (days - 1) * DAY_MS;
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
  let playMs = 0, longestMs = 0, firstPlayed = null, lastPlayed = null;
  for (const s of sessions) {
    const d = s.end - s.start;
    playMs += d;
    if (d > longestMs) longestMs = d;
    if (firstPlayed === null || s.start < firstPlayed) firstPlayed = s.start;
    if (lastPlayed === null || s.end > lastPlayed) lastPlayed = s.end;
  }
  return {
    id: g.id, name: g.name, exe: g.exe, folder: g.folder, args: g.args,
    cover: g.cover, background: g.background, logo: g.logo || null, steamAppId: g.steamAppId || null, addedAt: g.addedAt,
    sizeBytes: g.sizeBytes, sizeScannedAt: g.sizeScannedAt, sizing: sizing.has(g.id),
    exeExists: fs.existsSync(g.exe), launches: g.launches || 0,
    playMs, longestMs, sessions: sessions.length, firstPlayed, lastPlayed,
    daily: dailyPlay(sessions),
    status: r ? 'running' : pending.has(g.id) ? 'starting' : 'idle',
    runningSince: r ? r.start : null,
    drive: path.parse(path.resolve(g.folder)).root.toUpperCase(),
  };
}

/* ---------------- Images ---------------- */

const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/bmp': 'bmp' };
const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

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

async function imageFromUrl(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Image URL must start with http:// or https://');
  const res = await fetch(url, { headers: WEB_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_UPLOAD) throw new Error('Image is larger than 25 MB');
  const ext = IMG_TYPES[type] || (IMG_EXT_RE.exec(new URL(url).pathname)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
  return { buf, ext };
}

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
function queueArtwork(game, force = false) {
  if (artworkQueue.has(game.id)) return;
  artworkQueue.add(game.id);
  artworkChain = artworkChain.then(async () => {
    try {
      const g = byId(game.id);
      if (!g) return;
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

/* ---------------- File browser ---------------- */

async function browse(p, filter) {
  if (!p) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((l) => fs.existsSync(l + ':\\'));
    return { path: '', parent: null, entries: letters.map((l) => ({ name: l + ':\\', path: l + ':\\', dir: true })) };
  }
  const dir = path.resolve(p);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const dirs = [], files = [];
  for (const e of entries) {
    if (e.name.startsWith('$')) continue;
    if (e.isDirectory()) dirs.push({ name: e.name, path: path.join(dir, e.name), dir: true });
    else if (filter === 'exe' ? /\.(exe|bat|cmd|lnk|url)$/i.test(e.name) : filter === 'image' ? IMG_EXT_RE.test(e.name) : false) {
      files.push({ name: e.name, path: path.join(dir, e.name), dir: false });
    }
  }
  const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const parent = path.dirname(dir) === dir ? '' : path.dirname(dir);
  return { path: dir, parent, entries: [...dirs.sort(cmp), ...files.sort(cmp)].slice(0, 800) };
}

/* ---------------- HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.json': 'application/json',
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
      if (size > limit) { reject(new Error('Upload is larger than 25 MB')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, 1 << 20);
  return buf.length ? JSON.parse(buf.toString('utf8')) : {};
}

async function sendFile(res, file, cache) {
  try {
    const data = await fsp.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function validateGameInput(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    if (!String(body.name || '').trim()) throw new Error('Give the game a name');
    out.name = String(body.name).trim();
  }
  if (!partial || body.exe !== undefined) {
    if (!body.exe || !fs.existsSync(body.exe)) throw new Error('Executable not found at that path');
    out.exe = path.resolve(body.exe);
  }
  if (body.folder !== undefined && body.folder !== '') {
    if (!fs.existsSync(body.folder)) throw new Error('Install folder not found');
    out.folder = path.resolve(body.folder);
  }
  if (body.args !== undefined) out.args = String(body.args);
  return out;
}

async function handle(req, res) {
  if (!ALLOWED_HOSTS.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, ''))) { res.writeHead(403); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const m = p.match(/^\/api\/games\/([\w-]+)(?:\/([\w-]+))?$/);

  if (p.startsWith('/api/')) lastContact = Date.now();

  if (p === '/api/ping') return sendJson(res, 200, { ok: true });

  if (p === '/api/state' && req.method === 'GET') {
    const now = Date.now();
    return sendJson(res, 200, {
      now,
      settings: { ...db.settings, profileName: db.settings.profileName || defaultProfileName() },
      drives: await drives(),
      busy: { artwork: artworkQueue.size, sizing: sizing.size },
      games: db.games.map((g) => publicGame(g, now)),
    });
  }

  if (p === '/api/games' && req.method === 'POST') {
    const body = await readJson(req);
    const input = validateGameInput(body, false);
    const g = makeGame(input);
    db.games.push(g);
    save();
    queueSize(g);
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

    if (!action && req.method === 'PATCH') {
      const input = validateGameInput(await readJson(req), true);
      const folderChanged = input.folder && input.folder !== g.folder;
      Object.assign(g, input);
      if (input.exe && !input.folder && !g.folder) g.folder = inferFolder(input.exe);
      save();
      if (folderChanged) queueSize(g);
      return sendJson(res, 200, publicGame(g, Date.now()));
    }
    if (!action && req.method === 'DELETE') {
      for (const kind of IMAGE_KINDS) removeImage(g[kind]);
      db.games.splice(db.games.indexOf(g), 1);
      running.delete(g.id);
      pending.delete(g.id);
      save();
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'launch' && req.method === 'POST') {
      if (!fs.existsSync(g.exe)) return sendJson(res, 400, { error: 'Executable not found. Edit the game to fix its path.' });
      if (running.has(g.id)) return sendJson(res, 409, { error: `${g.name} is already running` });
      const err = await launch(g);
      if (err) return sendJson(res, 500, { error: err });
      g.launches = (g.launches || 0) + 1;
      pending.set(g.id, Date.now());
      save();
      scheduleTracker(2500);
      return sendJson(res, 200, { ok: true });
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
      spawn('explorer.exe', [g.folder], { detached: true, stdio: 'ignore' }).unref();
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'rescan-size' && req.method === 'POST') {
      queueSize(g);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'reset-stats' && req.method === 'POST') {
      g.sessions = [];
      g.launches = 0;
      delete g.activeSession;
      if (running.has(g.id)) running.get(g.id).start = Date.now();
      save();
      return sendJson(res, 200, publicGame(g, Date.now()));
    }
    return sendJson(res, 404, { error: 'Unknown action' });
  }

  if (p === '/api/settings' && req.method === 'POST') {
    const body = await readJson(req);
    if (body.gamesRoot !== undefined) {
      if (!fs.existsSync(body.gamesRoot)) return sendJson(res, 400, { error: 'Folder not found' });
      db.settings.gamesRoot = path.resolve(body.gamesRoot);
    }
    if (body.clock24 !== undefined) db.settings.clock24 = !!body.clock24;
    if (body.sounds !== undefined) db.settings.sounds = !!body.sounds;
    if (body.autoArtwork !== undefined) db.settings.autoArtwork = !!body.autoArtwork;
    if (body.profileName !== undefined) db.settings.profileName = String(body.profileName).trim().slice(0, 40);
    save();
    driveCache.at = 0;
    return sendJson(res, 200, { ...db.settings, profileName: db.settings.profileName || defaultProfileName() });
  }

  if (p === '/api/scan' && req.method === 'POST') {
    return sendJson(res, 200, { added: await scanRoot() });
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
    if (!IMG_EXT_RE.test(file)) { res.writeHead(400); return res.end(); }
    return sendFile(res, file, 'no-store');
  }

  if (p === '/api/quit' && req.method === 'POST') {
    sendJson(res, 200, { ok: true });
    setTimeout(shutdown, 100);
    return;
  }

  if (p.startsWith('/img/')) return sendFile(res, path.join(IMG_DIR, path.basename(p)), 'public, max-age=31536000, immutable');

  if (req.method === 'GET' && !p.startsWith('/api/')) {
    const file = path.normalize(path.join(PUBLIC_DIR, p === '/' ? 'index.html' : decodeURIComponent(p)));
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    return sendFile(res, file, 'no-cache');
  }

  sendJson(res, 404, { error: 'Not found' });
}

/* ---------------- Window + lifecycle ---------------- */

function openWindow() {
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
    const added = await scanRoot();
    console.log(`First run: added ${added.length} game(s) from ${db.settings.gamesRoot}`);
    saveNow();
  }
  for (const g of db.games) {
    if (g.sizeBytes == null || Date.now() - (g.sizeScannedAt || 0) > DAY_MS) queueSize(g);
    if (db.settings.autoArtwork && !g.artworkChecked && (!g.cover || !g.background)) queueArtwork(g);
  }
  scheduleTracker(1000);
  if (OPEN_WINDOW) {
    openWindow();
    // Exit once the window has been closed for a while and no game is being tracked.
    setInterval(() => {
      if (Date.now() - lastContact > IDLE_EXIT_MS && !running.size && !pending.size) shutdown();
    }, 60000);
  }
});
