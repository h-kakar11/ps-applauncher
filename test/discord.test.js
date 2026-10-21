'use strict';
const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { DiscordIpc, Presence, encode, OP } = require('../lib/discord');

// A stand-in for the Discord client: answers the handshake with READY and acknowledges SET_ACTIVITY.
function fakeDiscord(dir) {
  const received = [];
  const sock = path.join(dir, 'discord-ipc-0');
  const server = net.createServer((c) => {
    let buf = Buffer.alloc(0);
    c.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8) {
        const op = buf.readUInt32LE(0), len = buf.readUInt32LE(4);
        if (buf.length < 8 + len) return;
        const msg = JSON.parse(buf.subarray(8, 8 + len).toString());
        buf = buf.subarray(8 + len);
        received.push({ op, msg });
        if (op === OP.HANDSHAKE) c.write(encode(OP.FRAME, { cmd: 'DISPATCH', evt: 'READY', data: { user: { id: '1', username: 'tester' } } }));
        else if (msg.cmd === 'SET_ACTIVITY') c.write(encode(OP.FRAME, { cmd: 'SET_ACTIVITY', evt: null, data: msg.args.activity, nonce: msg.nonce }));
      }
    });
  });
  return new Promise((resolve) => server.listen(sock, () => resolve({ server, received, sock })));
}

test('handshake, READY and SET_ACTIVITY round trip', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps5lib-'));
  const { server, received, sock } = await fakeDiscord(dir);
  const client = new DiscordIpc('123456789012345678');
  await client.connect([sock]);
  assert.strictEqual(client.user.username, 'tester');
  assert.deepStrictEqual(received[0].msg, { v: 1, client_id: '123456789012345678' });
  await client.setActivity({ details: 'Hades' });
  assert.strictEqual(received[1].msg.args.activity.details, 'Hades');
  client.close();
  server.close();
});

test('presence connects, sets and clears an activity', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps5lib-'));
  const { server, received, sock } = await fakeDiscord(dir);
  const p = new Presence();
  p.paths = [sock];
  await p.set({ details: 'Hades', state: 'Playing', startTimestamp: 1700000000000, largeImage: 'https://example.com/a.jpg', largeText: 'Hades' });
  p.configure({ enabled: true, clientId: '123456789012345678' });
  for (let i = 0; i < 50 && p.status !== 'connected'; i++) await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(p.status, 'connected');
  await new Promise((r) => setTimeout(r, 50));
  const act = received.find((r) => r.msg.cmd === 'SET_ACTIVITY').msg.args.activity;
  assert.strictEqual(act.details, 'Hades');
  assert.strictEqual(act.timestamps.start, 1700000000);
  assert.strictEqual(act.assets.large_image, 'https://example.com/a.jpg');
  await p.set(null);
  assert.strictEqual(received.filter((r) => r.msg.cmd === 'SET_ACTIVITY').pop().msg.args.activity, null);
  p.stop();
  server.close();
});

test('presence reports a missing application id and an unreachable Discord', async () => {
  const p = new Presence();
  p.configure({ enabled: true, clientId: '' });
  assert.strictEqual(p.status, 'no-app-id');
  p.paths = ['/nonexistent/discord-ipc-0'];
  p.configure({ enabled: true, clientId: '123456789012345678' });
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(p.status, 'waiting');
  assert.match(p.error, /not running/);
  p.stop();
});
