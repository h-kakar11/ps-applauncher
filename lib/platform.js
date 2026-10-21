'use strict';
// OS integration: process list, starting and stopping programs, window focus, registry and startup entries.
// Windows is the target. The non-Windows branches exist so the app can be developed and tested elsewhere.
const path = require('path');
const { spawn, execFile } = require('child_process');

const IS_WIN = process.platform === 'win32';

const psQuote = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function runPowerShell(script, { timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve({ ok: false, stdout: '', stderr: 'PowerShell is only available on Windows' });
    // -EncodedCommand (UTF-16LE base64) sidesteps every quoting and code page problem with paths and here-strings.
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout, maxBuffer: 8 << 20 }, (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || '').trim() || (err ? err.message : '') });
      });
  });
}

/* ---------------- Processes ---------------- */

// Lower-case image names of every running process, or null when the list can't be read.
function processList() {
  return new Promise((resolve) => {
    const done = (err, out, parse) => {
      if (err) return resolve(null);
      const set = new Set();
      for (const line of String(out).split(/\r?\n/)) {
        const name = parse(line);
        if (name) set.add(name.toLowerCase());
      }
      resolve(set);
    };
    if (IS_WIN) {
      execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 16 << 20 }, (err, out) =>
        done(err, out, (line) => /^"([^"]+)"/.exec(line)?.[1]));
    } else {
      execFile('ps', ['-A', '-o', 'comm='], { maxBuffer: 16 << 20 }, (err, out) =>
        done(err, out, (line) => path.basename(line.trim())));
    }
  });
}

// Starts a program, document or URI the way Explorer would. Resolves with an error message, or null on success.
function startTarget({ target, args = '', cwd, admin = false }) {
  if (IS_WIN) {
    let cmd = `Start-Process -FilePath ${psQuote(target)}`;
    if (cwd) cmd += ` -WorkingDirectory ${psQuote(cwd)}`;
    if (args && args.trim()) cmd += ` -ArgumentList ${psQuote(args.trim())}`;
    if (admin) cmd += ' -Verb RunAs';
    return runPowerShell(cmd).then((r) => (r.ok ? null : r.stderr.split(/\r?\n/)[0] || 'Could not start the game'));
  }
  return new Promise((resolve) => {
    try {
      const child = spawn(target, args.trim() ? args.trim().split(/\s+/) : [], { cwd, detached: true, stdio: 'ignore' });
      child.once('error', (e) => resolve(e.message));
      child.once('spawn', () => { child.unref(); resolve(null); });
    } catch (e) {
      resolve(e.message);
    }
  });
}

function openFolder(dir) {
  if (IS_WIN) spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

// Brings the first visible window of any of these processes (names without ".exe") to the front.
async function focusProcess(names) {
  if (!IS_WIN) return false;
  const list = names.map((n) => psQuote(n.replace(/\.exe$/i, ''))).join(',');
  const script = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public class PsLibWin { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h); }
"@
$done = $false
foreach ($n in @(${list})) {
  $p = Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) {
    (New-Object -ComObject WScript.Shell).SendKeys('%')
    if ([PsLibWin]::IsIconic($p.MainWindowHandle)) { [void][PsLibWin]::ShowWindowAsync($p.MainWindowHandle, 9) }
    [void][PsLibWin]::SetForegroundWindow($p.MainWindowHandle)
    $done = $true; break
  }
}
if ($done) { 'ok' }`;
  const r = await runPowerShell(script);
  return r.ok && /ok/.test(r.stdout);
}

// Force-closes every process with one of these image names (and its children).
function killProcesses(names) {
  return Promise.all(names.map((n) => new Promise((resolve) => {
    const file = IS_WIN ? 'taskkill' : 'pkill';
    const args = IS_WIN ? ['/F', '/T', '/IM', n] : ['-x', n.slice(0, 15)];
    execFile(file, args, { windowsHide: true }, (err) => resolve(!err));
  }))).then((r) => r.filter(Boolean).length);
}

/* ---------------- Registry (Windows) ---------------- */

function regQuery(key, view = '64') {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve(null);
    execFile('reg', ['query', key, `/reg:${view}`], { windowsHide: true, maxBuffer: 8 << 20 }, (err, out) => {
      if (err) return resolve(null);
      const values = {}, subkeys = [];
      let first = true; // the first key line is the queried key itself, spelled out in full (HKEY_LOCAL_MACHINE…)
      for (const line of String(out).split(/\r?\n/)) {
        const v = /^\s{4}(.+?)\s{4}(REG_\w+)\s{0,4}(.*)$/.exec(line);
        if (v) values[v[1]] = v[3];
        else if (/^HK/i.test(line)) {
          if (first) first = false;
          else subkeys.push(line.trim());
        }
      }
      resolve({ values, subkeys });
    });
  });
}

/* ---------------- Start with Windows ---------------- */

const STARTUP_LINK = 'Game Library.lnk';

async function startupEnabled() {
  if (!IS_WIN) return false;
  const r = await runPowerShell(`Test-Path (Join-Path ([Environment]::GetFolderPath('Startup')) ${psQuote(STARTUP_LINK)})`);
  return r.ok && /true/i.test(r.stdout);
}

async function setStartup(enabled, appDir) {
  if (!IS_WIN) throw new Error('Start with Windows is only available on Windows');
  const link = `(Join-Path ([Environment]::GetFolderPath('Startup')) ${psQuote(STARTUP_LINK)})`;
  const script = enabled
    ? `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${link}); $s.TargetPath = 'wscript.exe'; $s.Arguments = ${psQuote('"' + path.join(appDir, 'Game Library.vbs') + '"')}; $s.WorkingDirectory = ${psQuote(appDir)}; $s.Description = 'PS5-style game library'; $s.Save()`
    : `Remove-Item -LiteralPath ${link} -ErrorAction SilentlyContinue`;
  const r = await runPowerShell(script);
  if (!r.ok) throw new Error(r.stderr || 'Could not change the startup entry');
}

module.exports = { IS_WIN, psQuote, runPowerShell, processList, startTarget, openFolder, focusProcess, killProcesses, regQuery, startupEnabled, setStartup };
