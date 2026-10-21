'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseVdf } = require('../lib/vdf');
const stats = require('../lib/stats');
const trophies = require('../lib/achievements');
const { parseXInput } = require('../lib/controllers');
const { scoreExe, detectExe } = require('../lib/exe');
const { detectSteam, parseUrlFile } = require('../lib/launchers');
const decode = require('../public/controller-decode');

test('vdf parses nested objects, quotes and comments', () => {
  const v = parseVdf('"libraryfolders"\n{\n // c\n "0" { "path" "C:\\\\Games" "apps" { "10" "5" } }\n "1" "D:\\\\Lib"\n}');
  assert.strictEqual(v.libraryfolders['0'].path, 'C:\\Games');
  assert.strictEqual(v.libraryfolders['0'].apps['10'], '5');
  assert.strictEqual(v.libraryfolders['1'], 'D:\\Lib');
});

test('steam detection reads libraries and skips tools and unfinished installs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steam-'));
  const apps = path.join(dir, 'steamapps');
  fs.mkdirSync(path.join(apps, 'common', 'Hades'), { recursive: true });
  fs.mkdirSync(path.join(apps, 'common', 'Half'), { recursive: true });
  fs.mkdirSync(path.join(apps, 'common', 'Proton 9.0'), { recursive: true });
  const manifest = (id, name, dirName, flags) => `"AppState"\n{\n"appid" "${id}"\n"name" "${name}"\n"installdir" "${dirName}"\n"StateFlags" "${flags}"\n}`;
  fs.writeFileSync(path.join(apps, 'appmanifest_1.acf'), manifest(1, 'Hades', 'Hades', 4));
  fs.writeFileSync(path.join(apps, 'appmanifest_2.acf'), manifest(2, 'Half Installed', 'Half', 1026));
  fs.writeFileSync(path.join(apps, 'appmanifest_3.acf'), manifest(3, 'Proton 9.0', 'Proton 9.0', 4));
  const found = await detectSteam(dir);
  assert.deepStrictEqual(found.map((g) => g.name), ['Hades']);
  assert.deepStrictEqual(found[0].launch, { type: 'steam', id: '1' });
  assert.strictEqual(found[0].steamAppId, 1);
});

test('url shortcuts expose their target', () => {
  assert.strictEqual(parseUrlFile('[InternetShortcut]\r\nURL=steam://rungameid/42\r\n'), 'steam://rungameid/42');
});

test('exe scoring prefers the game executable over helpers and launchers', () => {
  const mk = (p, size, level) => ({ path: p, size, level });
  const game = scoreExe(mk('/g/Cool Game/CoolGame.exe', 2e6, 0), 'Cool Game');
  const launcher = scoreExe(mk('/g/Cool Game/Launcher.exe', 9e7, 0), 'Cool Game');
  const shipping = scoreExe(mk('/g/Cool Game/Cool/Binaries/Win64/Cool-Win64-Shipping.exe', 9e7, 3), 'Cool Game');
  const config = scoreExe(mk('/g/Cool Game/Config.exe', 1e6, 0), 'Cool Game');
  assert.ok(game > launcher && game > shipping && game > config, `${game} ${launcher} ${shipping} ${config}`);
});

test('detectExe picks the protected-start bootstrapper when present', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-'));
  fs.writeFileSync(path.join(dir, 'start_protected_game.exe'), '');
  fs.writeFileSync(path.join(dir, 'Game.exe'), Buffer.alloc(1000));
  assert.strictEqual(path.basename(await detectExe(dir, 'Game')), 'start_protected_game.exe');
});

test('stats split sessions at midnight and count streaks', () => {
  const H = 3600000;
  const now = new Date(2026, 9, 21, 15, 0).getTime();
  const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
  const g = { id: 'a', name: 'A', bonusMs: H, sessions: [
    { start: at(19, 20), end: at(19, 22) },
    { start: at(20, 23), end: at(21, 1, 30) },
    { start: at(21, 10), end: at(21, 11) },
  ] };
  const s = stats.libraryStats([g], now);
  assert.strictEqual(s.totalMs, 5.5 * H);
  assert.strictEqual(s.allTimeMs, 6.5 * H);
  assert.strictEqual(s.periods.today, 2.5 * H);
  assert.strictEqual(s.hours[23], 1 * H);
  assert.strictEqual(s.hours[0], 1 * H);
  assert.deepStrictEqual(s.streak, { current: 3, longest: 3 });
  assert.strictEqual(s.sessions, 3);
  assert.strictEqual(s.longest.ms, 2.5 * H);
  assert.strictEqual(s.topAll[0].ms, 6.5 * H);
});

test('stats streak is broken by a missed day', () => {
  const now = new Date(2026, 9, 21, 15, 0).getTime();
  const day = (d) => ({ start: new Date(2026, 9, d, 10).getTime(), end: new Date(2026, 9, d, 11).getTime() });
  const s = stats.libraryStats([{ id: 'a', name: 'A', sessions: [day(15), day(16), day(17), day(19), day(20)] }], now);
  assert.deepStrictEqual(s.streak, { current: 2, longest: 3 });
});

test('trophies: tiers by rarity, platinum when everything is unlocked', () => {
  assert.strictEqual(trophies.tierFor(60), 'bronze');
  assert.strictEqual(trophies.tierFor(12), 'silver');
  assert.strictEqual(trophies.tierFor(1.5), 'gold');
  const list = [{ tier: 'bronze', unlockedAt: 1 }, { tier: 'silver', unlockedAt: 2 }, { tier: 'gold', unlockedAt: null }];
  let sum = trophies.summarize(list);
  assert.strictEqual(sum.done, 2);
  assert.strictEqual(sum.points, 45);
  assert.strictEqual(sum.platinum, false);
  list[2].unlockedAt = 3;
  sum = trophies.summarize(list);
  assert.strictEqual(sum.platinum, true);
  assert.strictEqual(sum.points, 15 + 30 + 90 + 300);
  assert.strictEqual(trophies.summarize([{ tier: 'bronze', unlockedAt: 1 }]).platinum, false);
});

test('steam achievement page parsing', () => {
  const html = '<div class="achieveRow "><div class="achieveImgHolder"><img src="https://cdn/x.jpg"></div><div class="achieveTxt"><h3>Hit &amp; Run</h3><h5>Win once</h5></div><div class="achievePercent">4.5%</div></div>'
    + '<div class="achieveRow "><div class="achieveTxt"><h3>Second</h3><h5></h5></div></div>';
  const list = trophies.parseSteamAchievements(html);
  assert.strictEqual(list.length, 2);
  assert.deepStrictEqual([list[0].title, list[0].tier, list[0].icon], ['Hit & Run', 'gold', 'https://cdn/x.jpg']);
  assert.strictEqual(list[1].percent, null);
});

test('xinput output parsing', () => {
  const pads = parseXInput('0,2,3\r\n1,1,3\r\nnoise\r\n2,3,1');
  assert.strictEqual(pads.length, 3);
  assert.deepStrictEqual([pads[0].percent, pads[0].wired], [100, false]);
  assert.deepStrictEqual([pads[1].percent, pads[1].wired], [null, true]);
  assert.strictEqual(pads[2].percent, 25);
});

test('controller ids are recognised', () => {
  assert.strictEqual(decode.describePad('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)').kind, 'dualsense');
  assert.strictEqual(decode.describePad('054c-09cc-Wireless Controller').kind, 'dualshock');
  assert.strictEqual(decode.describePad('Xbox 360 Controller (XInput STANDARD GAMEPAD)').kind, 'xbox');
  assert.strictEqual(decode.describePad('Some Pad (Vendor: 1234 Product: abcd)').name, 'Some Pad');
});

const view = (len, set) => { const b = new Uint8Array(len); for (const [i, v] of Object.entries(set)) b[i] = v; return new DataView(b.buffer); };

test('DualSense battery: USB, Bluetooth, charging, full', () => {
  assert.deepStrictEqual(decode.decodeDualSense(0x01, view(63, { 52: 0x05 })), { percent: 55, charging: false, full: false });
  assert.deepStrictEqual(decode.decodeDualSense(0x01, view(63, { 52: 0x18 })), { percent: 85, charging: true, full: false });
  assert.deepStrictEqual(decode.decodeDualSense(0x01, view(63, { 52: 0x2a })), { percent: 100, charging: false, full: true });
  assert.deepStrictEqual(decode.decodeDualSense(0x31, view(77, { 53: 0x02 })), { percent: 25, charging: false, full: false });
  assert.strictEqual(decode.decodeDualSense(0x01, view(9, {})), null); // short Bluetooth report
  assert.strictEqual(decode.decodeDualSense(0x01, view(63, { 52: 0xb5 })), null);
  assert.strictEqual(decode.decodeDualSense(0x01, view(63, { 52: 0x0a })).percent, 100); // clamped
});

test('DualShock 4 battery: cable, no cable, USB and Bluetooth', () => {
  assert.deepStrictEqual(decode.decodeDualShock4(0x01, view(63, { 29: 0x05 })), { percent: 55, charging: false, full: false });
  assert.deepStrictEqual(decode.decodeDualShock4(0x01, view(63, { 29: 0x14 })), { percent: 45, charging: true, full: false });
  assert.deepStrictEqual(decode.decodeDualShock4(0x01, view(63, { 29: 0x1a })), { percent: 100, charging: false, full: true });
  assert.deepStrictEqual(decode.decodeDualShock4(0x11, view(77, { 31: 0x03 })), { percent: 35, charging: false, full: false });
  assert.strictEqual(decode.decodeDualShock4(0x05, view(77, {})), null);
});
