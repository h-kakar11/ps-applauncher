'use strict';
/* ======================= Controllers: status icon, battery, tester ======================= */
// The browser's Gamepad API can't see batteries, so two other sources are used:
//  - Sony pads (DualSense, DualShock 4): read over WebHID once the player has allowed it in the browser prompt.
//  - Xbox / XInput pads: queried by the local service through xinput1_4.dll.

const CD = ControllerDecode;
const hid = { supported: typeof navigator !== 'undefined' && !!navigator.hid, recs: new Map(), error: '' };
let xinputPads = [];
let xinputAt = 0;
let knownPads = null; // ids of pads seen so far; null until the first look, so start-up isn't announced
const lowWarned = new Set();

/* ----- Sony pads over WebHID ----- */
async function hidOpen(device) {
  if (device.vendorId !== CD.SONY_VENDOR_ID || hid.recs.has(device)) return;
  const hex = (n) => n.toString(16).padStart(4, '0');
  const kind = CD.describePad(`${hex(device.vendorId)}-${hex(device.productId)}-pad`).kind;
  if (kind !== 'dualsense' && kind !== 'dualshock') return;
  const rec = { device, kind, battery: null, at: 0, name: device.productName || 'Controller' };
  try {
    if (!device.opened) await device.open();
  } catch (e) {
    hid.error = 'Couldn’t read the battery. Another program (Steam Input, DS4Windows) may be using the controller.';
    return;
  }
  hid.error = '';
  hid.recs.set(device, rec);
  device.addEventListener('inputreport', (e) => {
    const b = CD.decodeBattery(kind, e.reportId, e.data);
    if (!b) return;
    const changed = !rec.battery || rec.battery.percent !== b.percent || rec.battery.charging !== b.charging;
    rec.battery = b;
    rec.at = Date.now();
    if (changed) renderControllerButton();
  });
  // Bluetooth pads only send full reports (with the battery) after this feature report has been requested.
  try { await device.receiveFeatureReport(CD.WAKE_REPORT[kind]); } catch {}
}

async function hidInit() {
  if (!hid.supported) return;
  try { for (const d of await navigator.hid.getDevices()) await hidOpen(d); } catch {}
  navigator.hid.addEventListener('connect', (e) => hidOpen(e.device));
  navigator.hid.addEventListener('disconnect', (e) => { hid.recs.delete(e.device); renderControllerButton(); });
}

async function hidRequest() {
  if (!hid.supported) return toast('This browser can’t read controller batteries. Use Edge or Chrome.', 5000);
  try {
    const picked = await navigator.hid.requestDevice({ filters: [{ vendorId: CD.SONY_VENDOR_ID }] });
    for (const d of picked) await hidOpen(d);
    if (!picked.length) toast('No controller was chosen');
    else if (hid.error) toast(hid.error, 7000);
    else toast('Battery reporting is on');
  } catch (e) {
    toast(e.message, 5000);
  }
  renderControllerButton();
}

/* ----- XInput batteries from the service ----- */
async function pollXInput() {
  const wanted = connectedPads().some((p) => CD.describePad(p.id).kind === 'xbox' || /xinput/i.test(p.id));
  if (!wanted || Date.now() - xinputAt < 25000) return;
  xinputAt = Date.now();
  try { xinputPads = (await api('/api/controllers')).xinput; } catch { xinputPads = []; }
  renderControllerButton();
}

/* ----- Putting it together ----- */
// One entry per connected controller: { index, name, kind, battery, source }
function padInfos() {
  const used = new Set();
  const xin = [...xinputPads];
  return connectedPads().map((p) => {
    const d = CD.describePad(p.id);
    let battery = null, source = null;
    if (d.kind === 'dualsense' || d.kind === 'dualshock') {
      const rec = [...hid.recs.values()].find((r) => r.kind === d.kind && !used.has(r) && Date.now() - r.at < 20000 && r.battery);
      if (rec) { used.add(rec); battery = rec.battery; source = 'hid'; }
    } else if (d.kind === 'xbox' || /xinput/i.test(p.id)) {
      const x = xin.shift();
      if (x) {
        battery = x.wired ? { wired: true, percent: null } : x.percent != null ? { percent: x.percent, charging: false, approximate: true } : null;
        source = 'xinput';
      }
    }
    return { index: p.index, pad: p, id: p.id, name: d.name, kind: d.kind, battery, source };
  });
}

function batteryIcon(b) {
  const pct = b.percent ?? 100;
  const fill = Math.max(2, Math.round((pct / 100) * 19));
  return `<svg class="batt-icon" viewBox="0 0 28 14" aria-hidden="true"><rect x="1" y="1" width="23" height="12" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="25" y="4.5" width="2.2" height="5" rx="1" fill="currentColor"/><rect x="3" y="3" width="${fill}" height="8" rx="1.6" fill="currentColor"/></svg>`;
}

function batteryText(b) {
  if (!b) return '';
  if (b.wired) return 'Wired';
  if (b.full) return 'Full';
  const approx = b.approximate ? '~' : '';
  return `${approx}${b.percent}%${b.charging ? ' · Charging' : ''}`;
}

function renderControllerButton() {
  const btn = $('#btn-controller');
  const pads = padInfos();
  const first = pads[0];
  const b = first?.battery;
  const low = !!b && !b.charging && !b.wired && !b.full && b.percent != null && state.settings.lowBatteryWarn > 0 && b.percent <= state.settings.lowBatteryWarn;
  const sig = JSON.stringify([pads.map((p) => [p.name, p.battery]), low]);
  if (btn.dataset.sig !== sig) {
    btn.dataset.sig = sig;
    btn.classList.toggle('is-connected', pads.length > 0);
    btn.classList.toggle('is-low', low);
    btn.classList.toggle('is-charging', !!b?.charging);
    btn.innerHTML = `${ICON.gamepad}${pads.length > 1 ? `<i class="ctrl-count">${pads.length}</i>` : ''}${b && !b.wired ? `<span class="batt">${batteryIcon(b)}<b>${b.full ? '100' : b.percent}%</b>${b.charging ? `<i class="batt-bolt">${ICON.bolt}</i>` : ''}</span>` : b?.wired ? `<span class="batt"><b>USB</b></span>` : ''}`;
    btn.title = pads.length ? pads.map((p) => `${p.name}${p.battery ? ` · ${batteryText(p.battery)}` : ''}`).join('\n') : 'No controller connected';
    btn.setAttribute('aria-label', pads.length ? `Controllers: ${btn.title.replace(/\n/g, ', ')}` : 'No controller connected');
  }
  // Warn once per discharge when the battery gets low.
  for (const p of pads) {
    const pb = p.battery;
    const key = `${p.kind}:${p.index}`;
    if (!pb || pb.percent == null) continue;
    const warnAt = state.settings.lowBatteryWarn;
    if (warnAt > 0 && !pb.charging && !pb.full && pb.percent <= warnAt && !lowWarned.has(key)) {
      lowWarned.add(key);
      sfx.alert();
      toast(`${p.name} battery is low (${batteryText(pb)}). Time to plug it in.`, 7000);
    } else if (pb.charging || pb.percent > warnAt + 5) lowWarned.delete(key);
  }
}

// Called by the gamepad loop and the connect/disconnect events.
function onPadsChanged() {
  const pads = connectedPads();
  const ids = new Set(pads.map((p) => p.id + '#' + p.index));
  if (knownPads) {
    for (const p of pads) if (!knownPads.has(p.id + '#' + p.index)) {
      toast(`${CD.describePad(p.id).name} connected`, 3000);
      sfx.select();
      xinputAt = 0;
      pollXInput();
    }
    for (const id of knownPads) if (!ids.has(id)) { toast('Controller disconnected', 3000); sfx.back(); }
  }
  knownPads = ids;
  renderControllerButton();
  if (state.view === 'home' && state.selectedId === EXPLORE_ID) renderStage();
  if ($('#layers .controllers')) paintControllerPanel?.();
}

// Cards for the Devices widget on the Explore page.
function deviceCards() {
  const pads = padInfos();
  const card = (p) => {
    const b = p.battery;
    const low = b && b.percent != null && !b.charging && b.percent <= state.settings.lowBatteryWarn;
    return { icon: ICON.gamepad, name: p.name, sub: b ? `${b.wired ? 'Wired' : `<span class="w-batt">${batteryIcon(b)}${esc(batteryText(b))}</span>`}` : 'Connected', on: true, low };
  };
  const out = pads.slice(0, 2).map(card);
  if (!out.length) out.push({ icon: ICON.gamepad, name: 'Controller', sub: 'Press a button', on: false });
  if (out.length < 2) out.push({ icon: ICON.keyboard, name: 'Keyboard', sub: 'Ready', on: true });
  return out;
}

function rumble(strong = 0.3, weak = 0.5, ms = 120) {
  if (!state.settings.rumble) return;
  for (const p of connectedPads()) {
    try { p.vibrationActuator?.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }); } catch {}
  }
}

/* ----- The controllers panel ----- */
let paintControllerPanel = null;

function openControllers() {
  const labels = (kind) => (kind === 'dualsense' || kind === 'dualshock'
    ? ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '▲', '▼', '◀', '▶', 'PS']
    : kind === 'xbox'
      ? ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '▲', '▼', '◀', '▶', 'Guide']
      : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '▲', '▼', '◀', '▶', '16']);
  const layer = openLayer(`<div class="modal modal-wide controllers" role="dialog" aria-label="Controllers"><div data-panel></div></div>`, {
    onClose: () => { paintControllerPanel = null; },
  });
  const panel = layer.querySelector('[data-panel]');
  let selected = 0;
  let raf = 0;

  function paint() {
    const pads = padInfos();
    selected = Math.min(selected, Math.max(0, pads.length - 1));
    const p = pads[selected];
    const sony = p && (p.kind === 'dualsense' || p.kind === 'dualshock');
    const needsHid = sony && !hid.recs.size && hid.supported;
    panel.innerHTML = `
      <h2>Controllers</h2>
      ${pads.length ? `
        <div class="chips chips-wrap ctrl-tabs">${pads.map((x, i) => `<button class="chip${i === selected ? ' is-active' : ''}" data-nav data-pad="${i}">${esc(x.name)}${pads.length > 1 ? ` ${i + 1}` : ''}</button>`).join('')}</div>
        <div class="ctrl-body">
          <div class="ctrl-info">
            <div class="ctrl-battery ${p.battery ? '' : 'is-unknown'}">
              ${p.battery && !p.battery.wired ? `${batteryIcon(p.battery)}<b>${esc(batteryText(p.battery))}</b>` : p.battery?.wired ? '<b>Wired connection</b>' : '<b>Battery unavailable</b>'}
            </div>
            <p class="muted">${p.battery
              ? (p.source === 'xinput' ? 'Windows reports Xbox controller batteries in four steps, so this is approximate.' : 'Live from the controller.')
              : sony
                ? (hid.supported ? 'Allow the library to read this controller’s battery. Your browser asks once and remembers.' : 'Battery reading needs Edge or Chrome.')
                : 'This controller type doesn’t report its battery to the browser.'}</p>
            ${hid.error ? `<p class="form-error">${esc(hid.error)}</p>` : ''}
            <div class="ctrl-actions">
              ${needsHid || (sony && !p.battery && hid.supported) ? `<button class="btn btn-primary btn-sm" data-nav data-act="hid">Enable battery reporting</button>` : ''}
              <button class="btn btn-secondary btn-sm" data-nav data-act="rumble">Test vibration</button>
            </div>
            <p class="muted ctrl-id">${esc(p.id)}</p>
          </div>
          <div class="tester" data-tester>
            <div class="tester-row tester-top">
              <span class="t-bar" data-b="6"><i></i><em>${labels(p.kind)[6]}</em></span><span class="t-key" data-b="4">${labels(p.kind)[4]}</span>
              <span class="t-spacer"></span>
              <span class="t-key" data-b="5">${labels(p.kind)[5]}</span><span class="t-bar" data-b="7"><i></i><em>${labels(p.kind)[7]}</em></span>
            </div>
            <div class="tester-row tester-mid">
              <div class="t-cluster t-dpad"><span class="t-key" data-b="12">${labels(p.kind)[12]}</span><span class="t-key" data-b="14">${labels(p.kind)[14]}</span><span class="t-key" data-b="15">${labels(p.kind)[15]}</span><span class="t-key" data-b="13">${labels(p.kind)[13]}</span></div>
              <div class="t-center"><span class="t-key t-small" data-b="8">${labels(p.kind)[8]}</span><span class="t-key t-small" data-b="16">${labels(p.kind)[16]}</span><span class="t-key t-small" data-b="9">${labels(p.kind)[9]}</span></div>
              <div class="t-cluster t-face"><span class="t-key" data-b="3">${labels(p.kind)[3]}</span><span class="t-key" data-b="2">${labels(p.kind)[2]}</span><span class="t-key" data-b="1">${labels(p.kind)[1]}</span><span class="t-key" data-b="0">${labels(p.kind)[0]}</span></div>
            </div>
            <div class="tester-row tester-sticks">
              <div class="t-stick" data-stick="0"><i></i><span class="t-key t-small" data-b="10">${labels(p.kind)[10]}</span></div>
              <p class="muted">Press buttons and move the sticks to check they respond.</p>
              <div class="t-stick" data-stick="2"><i></i><span class="t-key t-small" data-b="11">${labels(p.kind)[11]}</span></div>
            </div>
          </div>
        </div>` : `
        <div class="empty"><h2>No controller detected</h2>
          <p class="muted">Connect a controller with USB or Bluetooth, then press any button on it. It is recognised right away, with no extra setup.</p></div>`}
      <div class="modal-actions"><button class="btn btn-primary" data-nav data-act="done" autofocus>Done</button></div>`;
    if (!raf && pads.length) raf = requestAnimationFrame(tick);
  }

  function tick() {
    raf = 0;
    if (!layer.isConnected) return;
    const p = padInfos()[selected];
    const live = p && navigator.getGamepads?.()[p.index];
    if (live) {
      for (const el of $$('[data-b]', layer)) {
        const btn = live.buttons[Number(el.dataset.b)];
        el.classList.toggle('is-down', !!btn?.pressed);
        const bar = el.querySelector('i');
        if (bar) bar.style.transform = `scaleX(${btn?.value || 0})`;
      }
      for (const el of $$('[data-stick]', layer)) {
        const i = Number(el.dataset.stick);
        const x = live.axes[i] || 0, y = live.axes[i + 1] || 0;
        el.querySelector('i').style.transform = `translate(${x * 1.5}rem, ${y * 1.5}rem)`;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  paintControllerPanel = paint;
  layer.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.pad !== undefined) { selected = Number(t.dataset.pad); paint(); return focusEl(panel.querySelector(`[data-pad="${selected}"]`)); }
    if (t.dataset.act === 'done') closeLayer(layer);
    if (t.dataset.act === 'rumble') { const had = state.settings.rumble; state.settings.rumble = true; rumble(0.6, 0.8, 350); state.settings.rumble = had; }
    if (t.dataset.act === 'hid') hidRequest().then(paint);
  });
  paint();
  // In case the panel is closed and reopened: keep the animation loop tied to this layer only.
  layer._onClose = () => { cancelAnimationFrame(raf); paintControllerPanel = null; };
  setInterval(function again() { if (!layer.isConnected) return clearInterval(this); paint(); }, 4000);
}

$('#btn-controller').addEventListener('click', openControllers);
refreshHooks.push(() => { renderControllerButton(); pollXInput(); });
