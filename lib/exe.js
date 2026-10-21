'use strict';
// Finds and ranks the executables inside a game folder.
const fsp = require('fs').promises;
const path = require('path');

const JUNK_DIR = /^(_?redist|_?commonredist|directx|vcredist|support|_bypass.*|easyanticheat|battleye|__installer|installers?|_manifest|prereq.*|__macosx|\$recycle\.bin|crashpad.*|_commonredist|engine|\.git|node_modules)$/i;
const JUNK_EXE = /^(unins\d*|uninstall.*|dxwebsetup|dxsetup|quicksfv|vc_?redist.*|vcredist.*|ue[345]?prereqsetup.*|.*crashhandler.*|crashreport.*|crs-.*|setup.*|install.*|dotnet.*|oalinst|physx.*|unitycrashhandler.*|cefprocess|.*cefsubprocess.*|.*webhelper.*|notification_helper|crashpad_handler|zsync.*|7z.*|wmplayer.*|.*_setup)\.exe$/i;
const SOFT_JUNK = /(launcher|updater|update|patch|config|settings|crash|report|helper|redist|bootstrap|benchmark|editor|tool|service|diagnos|support)/i;

async function findExes(dir, depth = 5, out = [], level = 0) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !JUNK_DIR.test(e.name)) await findExes(p, depth - 1, out, level + 1);
    } else if (/\.exe$/i.test(e.name) && !JUNK_EXE.test(e.name)) {
      try { out.push({ path: p, size: (await fsp.stat(p)).size, level }); } catch {}
    }
  }
  return out;
}

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const words = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

// Higher is more likely to be the file a player would double-click.
function scoreExe(exe, gameName) {
  const base = path.basename(exe.path, path.extname(exe.path));
  const n = norm(base), g = norm(gameName);
  let score = 0;
  if (n && g) {
    if (n === g) score += 60;
    else if (g.includes(n) && n.length >= 4) score += 38;
    else if (n.includes(g)) score += 34;
    else {
      const a = new Set(words(base)), b = words(gameName);
      const shared = b.filter((w) => a.has(w)).length;
      score += b.length ? (shared / b.length) * 30 : 0;
    }
  }
  score -= exe.level * 8;
  score += Math.min(15, Math.log2(exe.size / 1048576 + 1) * 2);
  if (SOFT_JUNK.test(base)) score -= /launcher/i.test(base) ? 12 : 25;
  if (/server/i.test(base)) score -= 20;
  if (/shipping/i.test(base)) score += 6;
  if (/win64|x64|_64/i.test(base) || /win64/i.test(exe.path)) score += 3;
  if (/(^|[^a-z])(32|x86|win32)([^a-z]|$)/i.test(base)) score -= 4;
  return score;
}

async function detectExe(folder, gameName = path.basename(folder)) {
  const exes = await findExes(folder);
  if (!exes.length) return null;
  // Anti-cheat protected games must start through their bootstrapper.
  const protectedStart = exes.find((e) => /^start_protected_game\.exe$/i.test(path.basename(e.path)));
  if (protectedStart) return protectedStart.path;
  let best = null, bestScore = -Infinity;
  for (const e of exes) {
    const s = scoreExe(e, gameName);
    if (s > bestScore) { best = e; bestScore = s; }
  }
  return best.path;
}

function cleanName(folderName) {
  return folderName.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { findExes, detectExe, scoreExe, cleanName, norm };
