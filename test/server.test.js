'use strict';
// Starts the real server against a throwaway data folder and exercises the HTTP API.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 4600 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps5lib-'));
const games = path.join(tmp, 'games');
const steam = path.join(tmp, 'steam');
const data = path.join(tmp, 'data');
let server;

const touch = (p, content = '') => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
const api = async (url, { method = 'GET', json, body, headers } = {}) => {
  const res = await fetch(BASE + url, { method, body: json !== undefined ? JSON.stringify(json) : body, headers: json !== undefined ? { 'content-type': 'application/json' } : headers });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch {}
  return { status: res.status, body: parsed };
};
const state = async () => (await api('/api/state')).body;
const byName = async (name) => (await state()).games.find((g) => g.name === name);

test.before(async () => {
  touch(path.join(games, 'Cool.Game', 'coolgame.exe'));
  touch(path.join(games, 'Cool.Game', 'UnityCrashHandler64.exe'));
  touch(path.join(games, 'repacks', 'Repack Title', 'rt.exe'));
  touch(path.join(steam, 'steamapps', 'common', 'Hades', 'Hades.exe'));
  touch(path.join(steam, 'steamapps', 'common', 'Proton 9.0', 'proton.exe'));
  const manifest = (id, name, dir) => `"AppState"\n{\n"appid" "${id}"\n"name" "${name}"\n"installdir" "${dir}"\n"StateFlags" "4"\n"SizeOnDisk" "1000"\n}`;
  touch(path.join(steam, 'steamapps', 'appmanifest_1145360.acf'), manifest(1145360, 'Hades', 'Hades'));
  touch(path.join(steam, 'steamapps', 'appmanifest_2348590.acf'), manifest(2348590, 'Proton 9.0', 'Proton 9.0'));
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'library.json'), JSON.stringify({ settings: { gameFolders: [games], autoArtwork: false, autoScan: 'off' }, games: [] }));
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PS5LIB_PORT: String(PORT), PS5LIB_DATA: data, PS5LIB_STEAM_PATH: steam }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/ping')).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
test.after(() => { server?.kill(); });

test('scan finds folder and Steam games, skips tools and junk executables, and is repeatable', async () => {
  const first = (await api('/api/scan', { method: 'POST' })).body;
  assert.deepStrictEqual(first.added.sort(), ['Cool Game', 'Hades', 'Repack Title']);
  const hades = await byName('Hades');
  assert.deepStrictEqual(hades.launch, { type: 'steam', id: '1145360' });
  assert.strictEqual(hades.steamAppId, 1145360);
  assert.strictEqual(path.basename((await byName('Cool Game')).exe), 'coolgame.exe');
  assert.deepStrictEqual((await api('/api/scan', { method: 'POST' })).body.added, []);
});

test('a removed game stays removed until restored', async () => {
  const g = await byName('Repack Title');
  assert.strictEqual((await api(`/api/games/${g.id}`, { method: 'DELETE' })).status, 200);
  assert.deepStrictEqual((await api('/api/scan', { method: 'POST' })).body.added, []);
  assert.strictEqual((await api('/api/restore-removed', { method: 'POST' })).body.restored, 1);
  assert.deepStrictEqual((await api('/api/scan', { method: 'POST' })).body.added, ['Repack Title']);
});

test('settings are validated and persisted', async () => {
  assert.strictEqual((await api('/api/settings', { method: 'POST', json: { uiScale: 77 } })).status, 400);
  assert.strictEqual((await api('/api/settings', { method: 'POST', json: { gameFolders: ['/definitely/not/here'] } })).status, 400);
  const r = await api('/api/settings', { method: 'POST', json: { uiScale: 115, confirmButton: 'circle', weeklyGoalHours: 10, discordAppId: ' 123 ' } });
  assert.strictEqual(r.body.uiScale, 115);
  assert.strictEqual(r.body.discordAppId, '123');
  assert.strictEqual((await state()).settings.confirmButton, 'circle');
  await api('/api/settings', { method: 'POST', json: { confirmButton: 'cross' } });
});

test('game fields: favorite, status, rating, previous playtime, launch methods', async () => {
  const g = await byName('Cool Game');
  const r = await api(`/api/games/${g.id}`, { method: 'PATCH', json: { favorite: true, progress: 'playing', rating: 9, previousHours: 2.5 } });
  assert.deepStrictEqual([r.body.favorite, r.body.progress, r.body.rating, r.body.importedMs], [true, 'playing', 5, 9000000]);
  assert.strictEqual((await api(`/api/games/${g.id}`, { method: 'PATCH', json: { progress: 'nonsense' } })).status, 400);
  assert.strictEqual((await api(`/api/games/${g.id}`, { method: 'PATCH', json: { launchType: 'uri', launchUri: 'https://evil.example' } })).status, 400);
  const uri = await api(`/api/games/${g.id}`, { method: 'PATCH', json: { launchType: 'uri', launchUri: 'com.epicgames.launcher://apps/x?action=launch' } });
  assert.strictEqual(uri.body.launch.type, 'uri');
  await api(`/api/games/${g.id}`, { method: 'PATCH', json: { launchType: 'exe', exe: g.exe } });
  const stats = (await api(`/api/games/${g.id}/stats`)).body;
  assert.strictEqual(stats.allTimeMs, 9000000);
});

test('notes: create, pin, edit, delete', async () => {
  const g = await byName('Cool Game');
  const n = (await api(`/api/games/${g.id}/notes`, { method: 'POST', json: { text: 'Boss weak to ice' } })).body;
  assert.strictEqual((await api(`/api/games/${g.id}/notes`, { method: 'POST', json: { text: '   ' } })).status, 400);
  await api(`/api/games/${g.id}/notes/${n.id}`, { method: 'PATCH', json: { pinned: true, text: 'Boss weak to fire' } });
  assert.strictEqual((await byName('Cool Game')).notePreview, 'Boss weak to fire');
  assert.strictEqual((await api(`/api/games/${g.id}/notes/${n.id}`, { method: 'DELETE' })).status, 200);
  assert.strictEqual((await byName('Cool Game')).notes, 0);
});

test('trophies: add, unlock, platinum, reset', async () => {
  const g = await byName('Cool Game');
  for (const [title, tier] of [['One', 'bronze'], ['Two', 'silver'], ['Three', 'gold']]) await api(`/api/games/${g.id}/achievements`, { method: 'POST', json: { title, tier } });
  const list = (await api(`/api/games/${g.id}/achievements`)).body.list;
  assert.strictEqual(list.length, 3);
  let last;
  for (const a of list) last = (await api(`/api/games/${g.id}/achievements/${a.id}`, { method: 'PATCH', json: { unlocked: true } })).body;
  assert.strictEqual(last.unlockedNow, true);
  assert.strictEqual(last.platinumNow, true);
  const t = (await state()).trophies;
  assert.strictEqual(t.points, 15 + 30 + 90 + 300);
  assert.strictEqual(t.platinums, 1);
  assert.strictEqual((await api(`/api/games/${g.id}/achievements/reset`, { method: 'POST' })).body.summary.done, 0);
});

test('backup export and import restores notes and trophies on a fresh match', async () => {
  const g = await byName('Cool Game');
  await api(`/api/games/${g.id}/notes`, { method: 'POST', json: { text: 'Remember me' } });
  const backup = (await api('/api/export')).body;
  assert.strictEqual(backup.app, 'ps5-game-library');
  await api(`/api/games/${g.id}/notes/${(await api(`/api/games/${g.id}/notes`)).body[0].id}`, { method: 'DELETE' });
  const r = (await api('/api/import', { method: 'POST', json: backup })).body;
  assert.ok(r.matched >= 1);
  assert.strictEqual((await byName('Cool Game')).notes, 1);
  assert.strictEqual((await api('/api/import', { method: 'POST', json: { nope: true } })).status, 400);
});

test('wallpapers: upload a GIF, serve it with ranges, remove it', async () => {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64');
  const up = await api('/api/wallpapers', { method: 'POST', body: gif, headers: { 'content-type': 'image/gif', 'x-name': 'Test%20GIF' } });
  assert.strictEqual(up.status, 200);
  assert.strictEqual(up.body.name, 'Test GIF');
  const full = await fetch(BASE + up.body.url);
  assert.strictEqual(full.headers.get('content-type'), 'image/gif');
  const part = await fetch(BASE + up.body.url, { headers: { range: 'bytes=0-5' } });
  assert.strictEqual(part.status, 206);
  assert.strictEqual((await part.arrayBuffer()).byteLength, 6);
  assert.strictEqual((await state()).wallpapers.length, 1);
  assert.strictEqual((await api(`/api/wallpapers/${up.body.id}`, { method: 'DELETE' })).status, 200);
  assert.strictEqual((await state()).wallpapers.length, 0);
  assert.strictEqual((await api('/api/wallpapers', { method: 'POST', body: Buffer.from('x'), headers: { 'content-type': 'text/plain' } })).status, 400);
});

test('requests with a foreign Host header are refused', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/api/state', headers: { host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.strictEqual(status, 403);
});

test('launching a program is tracked as a session', { skip: process.platform === 'win32' }, async () => {
  const sleepBin = ['/bin/sleep', '/usr/bin/sleep'].find((p) => fs.existsSync(p));
  const exe = path.join(games, 'Cool.Game', 'coolgame.exe');
  fs.copyFileSync(sleepBin, exe);
  fs.chmodSync(exe, 0o755);
  const g = await byName('Cool Game');
  await api(`/api/games/${g.id}`, { method: 'PATCH', json: { launchType: 'exe', exe, args: '30', progress: 'playing' } });
  assert.strictEqual((await api(`/api/games/${g.id}/launch`, { method: 'POST' })).status, 200);
  let running = false;
  for (let i = 0; i < 60 && !running; i++) { await new Promise((r) => setTimeout(r, 500)); running = (await byName('Cool Game')).status === 'running'; }
  assert.ok(running, 'game should be detected as running');
  assert.strictEqual((await api(`/api/games/${g.id}/launch`, { method: 'POST' })).body.resumed, true);
  await new Promise((r) => setTimeout(r, 5500)); // sessions under 5 seconds are not recorded
  assert.strictEqual((await api(`/api/games/${g.id}/close`, { method: 'POST' })).status, 200);
  let ended = false;
  for (let i = 0; i < 60 && !ended; i++) { await new Promise((r) => setTimeout(r, 500)); ended = (await byName('Cool Game')).status === 'idle'; }
  assert.ok(ended, 'session should end after the game closes');
  const s = (await api('/api/stats')).body;
  assert.ok(s.sessions >= 1);
  assert.ok((await state()).events.some((e) => e.type === 'game-ended'));
});
