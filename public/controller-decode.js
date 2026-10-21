'use strict';
// Controller identification and battery decoding. Pure functions, shared by the page and the tests.
// Layouts follow the Linux hid-playstation driver: DualSense and DualShock 4 put their battery
// state in a status byte of the input report, at different offsets over USB and Bluetooth.
(function (root) {
  const SONY = 0x054c;
  const DUALSENSE = { 0x0ce6: 'DualSense', 0x0df2: 'DualSense Edge' };
  const DUALSHOCK4 = { 0x05c4: 'DualShock 4', 0x09cc: 'DualShock 4', 0x0ba0: 'DualShock 4' };

  // Reads vendor and product ids out of a Gamepad id string (Chromium and Firefox formats).
  function parseIds(id) {
    const s = String(id || '');
    let m = /vendor:\s*([0-9a-f]{4}).*?product:\s*([0-9a-f]{4})/i.exec(s);
    if (!m) m = /^([0-9a-f]{4})-([0-9a-f]{4})-/i.exec(s);
    return m ? { vendor: parseInt(m[1], 16), product: parseInt(m[2], 16) } : { vendor: null, product: null };
  }

  // { kind: 'dualsense' | 'dualshock' | 'xbox' | 'switch' | 'other', name }
  function describePad(id) {
    const s = String(id || '').toLowerCase();
    const { vendor, product } = parseIds(id);
    if (vendor === SONY && DUALSENSE[product]) return { kind: 'dualsense', name: DUALSENSE[product], vendor, product };
    if (vendor === SONY && DUALSHOCK4[product]) return { kind: 'dualshock', name: DUALSHOCK4[product], vendor, product };
    if (s.includes('dualsense')) return { kind: 'dualsense', name: s.includes('edge') ? 'DualSense Edge' : 'DualSense', vendor, product };
    if (vendor === SONY || s.includes('dualshock') || s.includes('wireless controller')) return { kind: 'dualshock', name: 'DualShock 4', vendor, product };
    if (vendor === 0x045e || /xinput|xbox/.test(s)) return { kind: 'xbox', name: 'Xbox Controller', vendor, product };
    if (vendor === 0x057e || s.includes('pro controller')) return { kind: 'switch', name: 'Pro Controller', vendor, product };
    const clean = String(id || '').replace(/\s*\(.*$/, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').trim();
    return { kind: 'other', name: clean.slice(0, 24) || 'Controller', vendor, product };
  }

  const pct = (n) => Math.max(0, Math.min(100, n));

  // DualSense: input report 0x01 over USB, 0x31 over Bluetooth (after the controller has been asked for its
  // calibration feature report). `data` is a DataView without the leading report id, as WebHID delivers it.
  function decodeDualSense(reportId, data) {
    let status;
    if (reportId === 0x01 && data.byteLength >= 53) status = data.getUint8(52);
    else if (reportId === 0x31 && data.byteLength >= 54) status = data.getUint8(53);
    else return null;
    const level = status & 0x0f;
    const state = status >> 4; // 0 discharging, 1 charging, 2 full
    if (state === 2) return { percent: 100, charging: false, full: true };
    if (state === 0 || state === 1) return { percent: pct(level * 10 + 5), charging: state === 1, full: false };
    return null; // not charging / error codes: nothing trustworthy to show
  }

  // DualShock 4: input report 0x01 over USB, 0x11 over Bluetooth.
  function decodeDualShock4(reportId, data) {
    let status;
    if (reportId === 0x01 && data.byteLength >= 30) status = data.getUint8(29);
    else if (reportId === 0x11 && data.byteLength >= 32) status = data.getUint8(31);
    else return null;
    const level = status & 0x0f;
    const cable = !!(status & 0x10);
    if (cable) {
      if (level < 10) return { percent: pct(level * 10 + 5), charging: true, full: false };
      if (level === 10) return { percent: 100, charging: false, full: true };
      return null;
    }
    return { percent: pct(level * 10 + 5), charging: false, full: false };
  }

  function decodeBattery(kind, reportId, data) {
    if (kind === 'dualsense') return decodeDualSense(reportId, data);
    if (kind === 'dualshock') return decodeDualShock4(reportId, data);
    return null;
  }

  // The feature report that makes a Bluetooth controller switch to its full input reports.
  const WAKE_REPORT = { dualsense: 0x05, dualshock: 0x02 };

  const api = { parseIds, describePad, decodeDualSense, decodeDualShock4, decodeBattery, WAKE_REPORT, SONY_VENDOR_ID: SONY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ControllerDecode = api;
})(typeof self !== 'undefined' ? self : this);
