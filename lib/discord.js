'use strict';
// Discord Rich Presence over the local IPC pipe, with no dependencies.
// Frames: 4-byte opcode (LE) + 4-byte length (LE) + JSON. Opcodes: 0 handshake, 1 frame, 2 close, 3 ping, 4 pong.
const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function pipePaths() {
  if (process.platform === 'win32') return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  const dirs = [base, path.join(base, 'app', 'com.discordapp.Discord'), path.join(base, 'snap.discord'), os.tmpdir()];
  return dirs.flatMap((d) => Array.from({ length: 10 }, (_, i) => path.join(d, `discord-ipc-${i}`)));
}

function encode(op, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const head = Buffer.alloc(8);
  head.writeUInt32LE(op, 0);
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

function connectFirst(paths) {
  return new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= paths.length) return reject(new Error('Discord is not running'));
      const sock = net.connect(paths[i++]);
      sock.once('connect', () => { sock.removeAllListeners('error'); resolve(sock); });
      sock.once('error', () => { sock.destroy(); next(); });
    };
    next();
  });
}

class DiscordIpc extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.user = null;
    this.ready = false;
  }

  async connect(paths = pipePaths()) {
    this.sock = await connectFirst(paths);
    this.sock.on('data', (d) => this.onData(d));
    this.sock.on('close', () => this.onClose());
    this.sock.on('error', () => {});
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Discord did not answer')), 8000);
      this.once('ready', (u) => { clearTimeout(timer); resolve(u); });
      this.once('closed', () => { clearTimeout(timer); reject(new Error('Discord closed the connection')); });
    });
    this.sock.write(encode(OP.HANDSHAKE, { v: 1, client_id: this.clientId }));
    await ready;
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 8) {
      const op = this.buf.readUInt32LE(0);
      const len = this.buf.readUInt32LE(4);
      if (this.buf.length < 8 + len) return;
      const raw = this.buf.subarray(8, 8 + len).toString('utf8');
      this.buf = this.buf.subarray(8 + len);
      let msg = {};
      try { msg = JSON.parse(raw); } catch {}
      if (op === OP.PING) this.sock.write(encode(OP.PONG, msg));
      else if (op === OP.CLOSE) { this.emit('error-close', msg); this.sock.destroy(); }
      else if (op === OP.FRAME) this.onFrame(msg);
    }
  }

  onFrame(msg) {
    if (msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
      this.user = msg.data?.user || null;
      this.ready = true;
      this.emit('ready', this.user);
    } else if (msg.nonce && this.pending.has(msg.nonce)) {
      const { resolve, reject, timer } = this.pending.get(msg.nonce);
      clearTimeout(timer);
      this.pending.delete(msg.nonce);
      if (msg.evt === 'ERROR') reject(new Error(msg.data?.message || 'Discord rejected the request'));
      else resolve(msg.data);
    }
  }

  onClose() {
    const wasReady = this.ready;
    this.ready = false;
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error('Discord closed the connection')); }
    this.pending.clear();
    this.emit('closed', wasReady);
  }

  request(cmd, args) {
    return new Promise((resolve, reject) => {
      if (!this.ready) return reject(new Error('Not connected to Discord'));
      const nonce = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(nonce); reject(new Error('Discord did not answer')); }, 8000);
      this.pending.set(nonce, { resolve, reject, timer });
      this.sock.write(encode(OP.FRAME, { cmd, args, nonce }));
    });
  }

  setActivity(activity) {
    return this.request('SET_ACTIVITY', { pid: process.pid, activity: activity || null });
  }

  close() {
    this.ready = false;
    try { this.sock?.destroy(); } catch {}
  }
}

/* ---------------- Detectable games (the ones Discord already recognises) ---------------- */

const DETECTABLE_URL = 'https://discord.com/api/v9/applications/detectable';
const DETECTABLE_TTL = 7 * 86400000;

// Lower-case executable names Discord's own game detection knows about, loaded lazily and cached on disk.
class DetectableGames {
  constructor(cacheFile, fetchFn = fetch) {
    this.cacheFile = cacheFile;
    this.fetch = fetchFn;
    this.exes = null;
    this.names = null;
    this.loading = null;
  }

  async load() {
    if (this.exes) return true;
    this.loading ||= this.doLoad().finally(() => { this.loading = null; });
    return this.loading;
  }

  async doLoad() {
    const fs = require('fs');
    let list = null;
    try {
      const cached = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      if (Date.now() - cached.at < DETECTABLE_TTL) list = cached.list;
    } catch {}
    if (!list) {
      try {
        const res = await this.fetch(DETECTABLE_URL, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(String(res.status));
        const apps = await res.json();
        list = apps.map((a) => ({ name: a.name, exes: (a.executables || []).filter((e) => e.os === 'win32').map((e) => path.basename(e.name).toLowerCase()) }));
        fs.writeFileSync(this.cacheFile, JSON.stringify({ at: Date.now(), list }));
      } catch {
        try { list = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')).list; } catch {}
      }
    }
    if (!list) return false;
    this.exes = new Set();
    this.names = new Set();
    for (const a of list) {
      this.names.add(String(a.name).toLowerCase());
      for (const e of a.exes) this.exes.add(e);
    }
    return true;
  }

  // True when Discord will already show this game by itself.
  isDetected(exeNames) {
    if (!this.exes) return false;
    for (const n of exeNames) if (this.exes.has(String(n).toLowerCase())) return true;
    return false;
  }
}

/* ---------------- Presence manager ---------------- */

const fmtImageKey = (s) => (s && s.length <= 128 ? s : undefined);

class Presence {
  constructor({ log = () => {} } = {}) {
    this.log = log;
    this.clientId = '';
    this.client = null;
    this.activity = null; // what we want shown
    this.status = 'off'; // off | no-app-id | connecting | waiting | connected
    this.error = '';
    this.user = null;
    this.timer = null;
    this.retryMs = 5000;
    this.enabled = false;
  }

  info() {
    return { status: this.status, error: this.error, user: this.user ? { username: this.user.username, globalName: this.user.global_name || null, id: this.user.id } : null };
  }

  configure({ enabled, clientId }) {
    const id = String(clientId || '').trim();
    const changed = id !== this.clientId || enabled !== this.enabled;
    this.enabled = !!enabled;
    this.clientId = id;
    if (!changed) return;
    this.teardown();
    if (!this.enabled) { this.status = 'off'; this.error = ''; return; }
    if (!/^\d{17,20}$/.test(id)) { this.status = 'no-app-id'; this.error = id ? 'That Application ID doesn’t look right (it is 17 to 20 digits).' : ''; return; }
    this.retryMs = 5000;
    this.connect();
  }

  teardown() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.client) { this.client.removeAllListeners(); this.client.close(); }
    this.client = null;
    this.user = null;
  }

  async connect() {
    clearTimeout(this.timer);
    if (!this.enabled || !/^\d{17,20}$/.test(this.clientId)) return;
    this.status = 'connecting';
    const client = new DiscordIpc(this.clientId);
    this.client = client;
    client.on('closed', () => {
      if (this.client !== client) return;
      this.client = null;
      this.user = null;
      this.status = 'waiting';
      this.scheduleRetry();
    });
    try {
      await client.connect(this.paths);
      this.user = client.user;
      this.status = 'connected';
      this.error = '';
      this.retryMs = 5000;
      await this.push();
    } catch (e) {
      if (this.client === client) {
        client.removeAllListeners();
        client.close();
        this.client = null;
        this.status = 'waiting';
        this.error = e.message;
        this.scheduleRetry();
      }
    }
  }

  scheduleRetry() {
    clearTimeout(this.timer);
    if (!this.enabled) return;
    this.timer = setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 60000);
  }

  // activity: { details, state, startTimestamp, largeImage, largeText, smallImage, smallText } or null to clear.
  async set(activity) {
    this.activity = activity;
    await this.push();
  }

  async push() {
    if (!this.client?.ready) return;
    const a = this.activity;
    try {
      if (!a) return void (await this.client.setActivity(null));
      const assets = {};
      if (fmtImageKey(a.largeImage)) assets.large_image = a.largeImage;
      if (a.largeText) assets.large_text = a.largeText.slice(0, 128);
      if (fmtImageKey(a.smallImage)) assets.small_image = a.smallImage;
      if (a.smallText) assets.small_text = a.smallText.slice(0, 128);
      const payload = { type: 0, details: a.details?.slice(0, 128), state: a.state?.slice(0, 128), status_display_type: 2 };
      if (a.startTimestamp) payload.timestamps = { start: Math.floor(a.startTimestamp / 1000) };
      if (Object.keys(assets).length) payload.assets = assets;
      await this.client.setActivity(payload);
      this.error = '';
    } catch (e) {
      this.error = e.message;
    }
  }

  stop() {
    this.enabled = false;
    this.teardown();
    this.status = 'off';
  }
}

module.exports = { DiscordIpc, DetectableGames, Presence, encode, pipePaths, OP };
