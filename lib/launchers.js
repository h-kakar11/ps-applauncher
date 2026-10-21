'use strict';
// Finds games installed through Steam, Epic, GOG, Ubisoft Connect, the EA app and Xbox.
// Every detector returns candidates: { source, key, name, folder, exe?, launch, steamAppId? }
//   launch: { type: 'steam', id } | { type: 'uri', uri } | { type: 'exe' }
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { parseVdf } = require('./vdf');
const { IS_WIN, regQuery, runPowerShell, psQuote } = require('./platform');

const NOT_GAME_APPIDS = new Set(['228980', '231350', '250820', '1493710', '2180100', '1070560', '1391110', '1628350', '1113280', '1826330', '4']);
const NOT_GAME_NAME = /^(steamworks common redistributables|steam linux runtime.*|proton .*|steamvr.*|source sdk base.*|steam controller configs|wallpaper engine)$|\b(dedicated server|sdk|authoring tools)\b/i;

const exists = (p) => fsp.access(p).then(() => true, () => false);
const readJson = (p) => fsp.readFile(p, 'utf8').then((t) => JSON.parse(t.replace(/^\uFEFF/, '')));

/* ---------------- Steam ---------------- */

async function steamRoots(customPath) {
  const roots = [];
  if (customPath) roots.push(customPath);
  if (process.env.PS5LIB_STEAM_PATH) roots.push(process.env.PS5LIB_STEAM_PATH);
  if (IS_WIN) {
    const cu = await regQuery('HKCU\\Software\\Valve\\Steam', '64');
    if (cu?.values.SteamPath) roots.push(cu.values.SteamPath);
    for (const key of ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'HKLM\\SOFTWARE\\Valve\\Steam']) {
      const lm = await regQuery(key, '64');
      if (lm?.values.InstallPath) roots.push(lm.values.InstallPath);
    }
    roots.push(path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'));
  } else {
    roots.push(path.join(os.homedir(), '.steam', 'steam'), path.join(os.homedir(), '.local', 'share', 'Steam'));
  }
  const seen = new Set(), found = [];
  for (const r of roots) {
    const p = path.resolve(r);
    if (seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    if (await exists(path.join(p, 'steamapps'))) found.push(p);
  }
  return found;
}

async function steamLibraries(steamRoot) {
  const libs = [steamRoot];
  try {
    const vdf = parseVdf(await fsp.readFile(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8'));
    const folders = vdf.libraryfolders || vdf.LibraryFolders || {};
    for (const [k, v] of Object.entries(folders)) {
      if (!/^\d+$/.test(k)) continue;
      const p = typeof v === 'string' ? v : v?.path;
      if (p) libs.push(p);
    }
  } catch {}
  const seen = new Set();
  return libs.map((p) => path.resolve(p)).filter((p) => !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
}

async function detectSteam(customPath) {
  const out = [];
  const seenApps = new Set();
  for (const root of await steamRoots(customPath)) {
    for (const lib of await steamLibraries(root)) {
      const apps = path.join(lib, 'steamapps');
      let files;
      try { files = await fsp.readdir(apps); } catch { continue; }
      for (const f of files) {
        if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
        try {
          const st = parseVdf(await fsp.readFile(path.join(apps, f), 'utf8')).AppState;
          if (!st || !st.appid || !st.name || !st.installdir) continue;
          if (seenApps.has(st.appid) || NOT_GAME_APPIDS.has(st.appid) || NOT_GAME_NAME.test(st.name)) continue;
          if (!(Number(st.StateFlags) & 4)) continue; // not fully installed
          const folder = path.join(apps, 'common', st.installdir);
          if (!(await exists(folder))) continue;
          seenApps.add(st.appid);
          out.push({
            source: 'steam', key: `steam:${st.appid}`, name: st.name, folder,
            launch: { type: 'steam', id: st.appid }, steamAppId: Number(st.appid),
            sizeBytes: Number(st.SizeOnDisk) || null,
            lastPlayed: Number(st.LastPlayed) ? Number(st.LastPlayed) * 1000 : null,
          });
        } catch {}
      }
    }
  }
  return out;
}

/* ---------------- Epic Games ---------------- */

async function detectEpic() {
  const dir = process.env.PS5LIB_EPIC_MANIFESTS || path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files;
  try { files = await fsp.readdir(dir); } catch { return []; }
  const out = [];
  for (const f of files) {
    if (!/\.item$/i.test(f)) continue;
    try {
      const m = await readJson(path.join(dir, f));
      if (!m.DisplayName || !m.InstallLocation || !m.AppName) continue;
      if (m.MainGameAppName && m.MainGameAppName !== m.AppName) continue; // DLC
      if (Array.isArray(m.AppCategories) && m.AppCategories.length && !m.AppCategories.includes('games')) continue;
      if (m.bIsIncompleteInstall) continue;
      if (!(await exists(m.InstallLocation))) continue;
      const exe = m.LaunchExecutable ? path.join(m.InstallLocation, m.LaunchExecutable) : null;
      out.push({
        source: 'epic', key: `epic:${m.AppName}`, name: m.DisplayName, folder: path.resolve(m.InstallLocation),
        exe: exe && (await exists(exe)) ? exe : null,
        launch: m.CatalogNamespace && m.CatalogItemId
          ? { type: 'uri', uri: `com.epicgames.launcher://apps/${m.CatalogNamespace}%3A${m.CatalogItemId}%3A${m.AppName}?action=launch&silent=true` }
          : { type: 'exe' },
        sizeBytes: Number(m.InstallSize) || null,
      });
    } catch {}
  }
  return out;
}

/* ---------------- GOG, Ubisoft Connect, EA app (registry) ---------------- */

async function detectGog() {
  const root = await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games');
  if (!root) return [];
  const out = [];
  for (const key of root.subkeys) {
    const k = await regQuery(key);
    const v = k?.values || {};
    if (!v.gameName || !v.path || !(await exists(v.path))) continue;
    const exe = v.exe && (await exists(v.exe)) ? v.exe : null;
    out.push({ source: 'gog', key: `gog:${v.gameID || path.basename(key)}`, name: v.gameName, folder: path.resolve(v.path), exe, launch: { type: 'exe' }, args: v.launchParam || '' });
  }
  return out;
}

async function detectUbisoft() {
  const root = await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs');
  if (!root) return [];
  const out = [];
  for (const key of root.subkeys) {
    const k = await regQuery(key);
    const dir = k?.values.InstallDir;
    if (!dir || !(await exists(dir))) continue;
    const id = path.basename(key);
    out.push({ source: 'ubisoft', key: `ubisoft:${id}`, name: path.basename(path.resolve(dir)), folder: path.resolve(dir), launch: { type: 'uri', uri: `uplay://launch/${id}/0` } });
  }
  return out;
}

async function detectEa() {
  const root = await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\EA Games');
  if (!root) return [];
  const out = [];
  for (const key of root.subkeys) {
    const k = await regQuery(key);
    const dir = k?.values['Install Dir'];
    if (!dir || !(await exists(dir))) continue;
    out.push({ source: 'ea', key: `ea:${path.basename(key)}`, name: k.values.DisplayName || path.basename(key), folder: path.resolve(dir), launch: { type: 'exe' } });
  }
  return out;
}

/* ---------------- Xbox / Microsoft Store ---------------- */

async function detectXbox() {
  const out = [];
  const roots = IS_WIN ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\XboxGames`) : [];
  if (process.env.PS5LIB_XBOX_DIR) roots.push(process.env.PS5LIB_XBOX_DIR);
  for (const root of roots) {
    let entries;
    try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || /^(gaming services|gamingservices)$/i.test(e.name)) continue;
      const folder = path.join(root, e.name);
      const content = path.join(folder, 'Content');
      out.push({ source: 'xbox', key: `xbox:${e.name.toLowerCase()}`, name: e.name, folder: (await exists(content)) ? content : folder, launch: { type: 'exe' } });
    }
  }
  return out;
}

/* ---------------- Shortcuts (.url, .lnk) sitting in a games folder ---------------- */

function parseUrlFile(text) {
  const m = /^\s*URL\s*=\s*(.+?)\s*$/im.exec(text);
  return m ? m[1] : null;
}

async function detectShortcuts(roots) {
  const out = [];
  const lnks = [];
  for (const root of roots) {
    let entries;
    try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const file = path.join(root, e.name);
      const name = path.basename(e.name, path.extname(e.name));
      if (/\.url$/i.test(e.name)) {
        try {
          const url = parseUrlFile(await fsp.readFile(file, 'utf8'));
          const steam = url && /^steam:\/\/(?:rungameid|run)\/(\d+)/i.exec(url);
          if (steam) out.push({ source: 'shortcut', key: `steam:${steam[1]}`, name, folder: null, launch: { type: 'steam', id: steam[1] }, steamAppId: Number(steam[1]) });
          else if (url && /^(com\.epicgames\.launcher|uplay|goggalaxy|origin2?|ea|battlenet):\/\//i.test(url)) {
            out.push({ source: 'shortcut', key: `uri:${url.toLowerCase()}`, name, folder: null, launch: { type: 'uri', uri: url } });
          }
        } catch {}
      } else if (/\.lnk$/i.test(e.name)) lnks.push({ file, name });
    }
  }
  if (lnks.length && IS_WIN) {
    const list = lnks.map((l) => psQuote(l.file)).join(',');
    const r = await runPowerShell(`$sh = New-Object -ComObject WScript.Shell; foreach ($f in @(${list})) { $l = $sh.CreateShortcut($f); "$f|$($l.TargetPath)|$($l.Arguments)|$($l.WorkingDirectory)" }`);
    for (const line of r.stdout.split(/\r?\n/)) {
      const [file, target, args, cwd] = line.split('|');
      const lnk = lnks.find((l) => l.file === file);
      if (!lnk || !target || !/\.exe$/i.test(target) || !(await exists(target))) continue;
      out.push({ source: 'shortcut', key: `exe:${path.resolve(target).toLowerCase()}`, name: lnk.name, folder: cwd && (await exists(cwd)) ? path.resolve(cwd) : path.dirname(target), exe: path.resolve(target), launch: { type: 'exe' }, args: args || '' });
    }
  }
  return out;
}

const DETECTORS = {
  steam: (opts) => detectSteam(opts.steamPath),
  epic: () => detectEpic(),
  gog: () => detectGog(),
  ubisoft: () => detectUbisoft(),
  ea: () => detectEa(),
  xbox: () => detectXbox(),
};
const SOURCE_LABEL = { steam: 'Steam', epic: 'Epic Games', gog: 'GOG', ubisoft: 'Ubisoft Connect', ea: 'EA app', xbox: 'Xbox', shortcut: 'Shortcut', folder: 'Games folder' };

// Runs every enabled detector; one failing launcher never blocks the others.
async function detectLaunchers(enabled, opts = {}) {
  const lists = await Promise.all(Object.keys(DETECTORS).filter((s) => enabled[s]).map((s) => DETECTORS[s](opts).catch((e) => { console.error(`detect ${s}:`, e.message); return []; })));
  return lists.flat();
}

module.exports = { detectLaunchers, detectShortcuts, detectSteam, parseUrlFile, SOURCE_LABEL, steamRoots, steamLibraries };
