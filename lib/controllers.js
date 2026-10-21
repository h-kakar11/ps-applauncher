'use strict';
// Battery levels for XInput controllers (Xbox pads and anything emulating them), read through xinput1_4.dll.
// Sony controllers report their battery over HID instead; the browser reads that part (public/controller-decode.js).
const { runPowerShell, IS_WIN } = require('./platform');

const SCRIPT = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class PsLibXInput {
  [StructLayout(LayoutKind.Sequential)] public struct BATTERY { public byte Type; public byte Level; }
  [StructLayout(LayoutKind.Sequential)] public struct GAMEPAD { public ushort Buttons; public byte LT; public byte RT; public short LX; public short LY; public short RX; public short RY; }
  [StructLayout(LayoutKind.Sequential)] public struct STATE { public uint Packet; public GAMEPAD Gamepad; }
  [DllImport("xinput1_4.dll")] public static extern uint XInputGetBatteryInformation(uint user, byte devType, out BATTERY info);
  [DllImport("xinput1_4.dll")] public static extern uint XInputGetState(uint user, out STATE s);
}
"@
for ($i = 0; $i -lt 4; $i++) {
  $s = New-Object 'PsLibXInput+STATE'
  if ([PsLibXInput]::XInputGetState($i, [ref]$s) -eq 0) {
    $b = New-Object 'PsLibXInput+BATTERY'
    [void][PsLibXInput]::XInputGetBatteryInformation($i, 0, [ref]$b)
    "$i,$($b.Type),$($b.Level)"
  }
}`;

// Windows only exposes four coarse steps for XInput batteries.
const LEVEL_PERCENT = [5, 25, 60, 100];

function parseXInput(out) {
  const pads = [];
  for (const line of String(out).split(/\r?\n/)) {
    const m = /^(\d),(\d+),(\d+)$/.exec(line.trim());
    if (!m) continue;
    const type = Number(m[2]), level = Number(m[3]);
    const wired = type === 1;
    const known = type === 2 || type === 3;
    pads.push({
      slot: Number(m[1]),
      wired,
      percent: known ? LEVEL_PERCENT[level] ?? null : null,
      approximate: known,
      charging: false,
    });
  }
  return pads;
}

let cache = { at: 0, pads: [] };

async function xinputBatteries() {
  if (!IS_WIN) return [];
  if (Date.now() - cache.at < 15000) return cache.pads;
  const r = await runPowerShell(SCRIPT, { timeout: 15000 });
  cache = { at: Date.now(), pads: r.ok ? parseXInput(r.stdout) : [] };
  return cache.pads;
}

module.exports = { xinputBatteries, parseXInput };
