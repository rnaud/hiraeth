// Non-standard gamepads, read as Standard Gamepads (docs/systems/controls.md, "Pads without the standard
// mapping"). The game reads every pad by the W3C Standard Gamepad layout (src/controller.js): 0 bottom,
// 1 right, 2 left, 3 top, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 L3, 11 R3, 12–15 the D-pad ↑ ↓ ← →,
// 16 Home; axes 0 / 1 the left stick, 2 / 3 the right one. A browser only gives that layout to pads it
// knows (`mapping: 'standard'`); the others come raw (`mapping: ''`), with their buttons in the order of
// their HID report. On a Mac an 8BitDo SN30 Pro in its D-input mode (B + Start) is one of those, in
// Chrome, Firefox and Safari alike: its bottom button is raw 1, LB 6, View 10, the sticks' clicks 13 / 14,
// the right stick on axes 2 / 5, and the D-pad a hat switch on axis 9. Read as standard, half of it did
// the wrong thing or nothing.
//
// installPadMaps() wraps navigator.getGamepads() so that every pad without the standard mapping comes out
// as a standard one (pads with it, and the Android app's own pad, come out untouched, the very objects).
// So controller.js and every raw reader (padIndex in native-pad.js) see one layout.
//
//   parsePadId(id)            → { vendor, product, name, flavor }  (Chrome "… (Vendor: 2dc8 Product: 6101)",
//                               Firefox "2dc8-6101-…", Safari the product name alone)
//   pickProfile(pad)          → a PROFILES entry (STANDARD for a standard-mapped pad)
//   hatDirection(v)           → { up, right, down, left } | null (neutral)
//   remapPad(raw, state)      → a standard pad, with .remap = { profile, raw, sources }
//   rawGamepads()             → the browser's own list (the input display, src/input-display.js)
//
// Where the axes are. Chrome on macOS puts each HID axis at (usage − 0x30): X 0, Y 1, Z 2, Rx 3, Ry 4,
// Rz 5, the hat 9, and the simulation page's Accelerator / Brake (analog triggers) in the first free
// slots; Firefox with no remapper of its own lists them in the report's order (compact); Safari's HID pads
// too. A profile lists its axes by usage, in report order, and `axisMap` places them for the browser. A hat
// is learned as well: any axis that reads beyond ±1 (a hat's neutral, 1.29 or 3.29) is a hat, wherever it is.
//
// Face buttons by POSITION. Nintendo-lettered pads (SN30 Pro: A right, B bottom, X top, Y left) report
// them by letter (raw 0 A, 1 B, 3 X, 4 Y): the profile takes the bottom one as standard 0, so the game's
// "A / ×" is the bottom button on every pad. Prompts stay in Xbox / PlayStation form (the positions are
// what matter); the setting "Controller buttons: A on the right" prints Nintendo letters instead.

/** The standard buttons' names (by position, Xbox / PlayStation form, as src/bindings.js PAD writes them). */
export const STANDARD_NAMES = ['A / ×', 'B / ○', 'X / □', 'Y / △', 'LB / L1', 'RB / R1', 'LT / L2', 'RT / R2',
  'View', 'Menu', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'];
/** The same buttons as src/bindings.js BINDINGS keys them. */
export const BINDING_KEYS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];

/** A pad's id → vendor / product (hex, 4 digits, lower case; null in Safari) and how its browser lays out axes. */
export function parsePadId(id = '') {
  let m = /Vendor:\s*([0-9a-f]{1,4})\s+Product:\s*([0-9a-f]{1,4})/i.exec(id);
  if (m) return { vendor: hex(m[1]), product: hex(m[2]), name: id.replace(/\s*\((?:STANDARD GAMEPAD\s*)?Vendor:.*\)\s*$/i, '').trim(), flavor: 'chrome' };
  m = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.*)$/i.exec(id);
  if (m) return { vendor: hex(m[1]), product: hex(m[2]), name: m[3].trim(), flavor: 'firefox' };
  return { vendor: null, product: null, name: id.trim(), flavor: 'name' };
}
const hex = (s) => s.toLowerCase().padStart(4, '0');

// --- the profiles -------------------------------------------------------------------------------------------
// buttons: standard index → raw button index (or a list: any of them). Standard 6 / 7 (the triggers) take the
// max of their button and their analog axis (`lt` / `rt`: a usage, read 0..1 from its rest at −1).
// axes: the usages in report order; lx ly rx ry the sticks' usages. dpad 'hat' (from the hat axis) or 'stick'
// (a pad with no sticks whose D-pad is the X / Y axes: it walks, as the stick; its D-pad slots are not reachable).
// SDL's game controller database (Mac OS X rows) and the browsers' own remappers are the sources (see the doc).
const POS_NINTENDO = { 0: 1, 1: 0, 2: 4, 3: 3 };   // 8BitDo D-input, Nintendo letters: bottom B (raw 1), right A (0), left Y (4), top X (3)
const POS_XBOX = { 0: 0, 1: 1, 2: 3, 3: 4 };       // 8BitDo D-input, Xbox letters (Ultimate, the adapters): bottom A (0), right B (1), left X (3), top Y (4)
const EIGHTBITDO_REST = { 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 13, 11: 14, 16: [12, 2] };   // (Home is raw 12 or 2, by model)

export const PROFILES = {
  standard: { key: 'standard', name: 'standard mapping (untouched)' },
  '8bitdo': {
    key: '8bitdo', name: '8BitDo D-input, Nintendo letters (SN30 Pro…)', faces: 'nintendo',
    buttons: { ...POS_NINTENDO, ...EIGHTBITDO_REST }, axes: ['X', 'Y', 'Z', 'Rz', 'accel', 'brake', 'hat'],
    lx: 'X', ly: 'Y', rx: 'Z', ry: 'Rz', lt: 'brake', rt: 'accel', dpad: 'hat',
  },
  '8bitdo-xbox': {
    key: '8bitdo-xbox', name: '8BitDo D-input, Xbox letters (Ultimate…)', faces: 'xbox',
    buttons: { ...POS_XBOX, ...EIGHTBITDO_REST }, axes: ['X', 'Y', 'Z', 'Rz', 'accel', 'brake', 'hat'],
    lx: 'X', ly: 'Y', rx: 'Z', ry: 'Rz', lt: 'brake', rt: 'accel', dpad: 'hat',
  },
  '8bitdo-dpad': {
    key: '8bitdo-dpad', name: '8BitDo without sticks (SN30, Zero 2…)', faces: 'nintendo',
    buttons: { ...POS_NINTENDO, ...EIGHTBITDO_REST }, axes: ['X', 'Y', 'accel', 'brake'],
    lx: 'X', ly: 'Y', lt: 'brake', rt: 'accel', dpad: 'stick',
  },
  dualshock4: {
    key: 'dualshock4', name: 'DualShock 4, raw (Firefox / Safari)', faces: 'xbox',
    buttons: { 0: 1, 1: 2, 2: 0, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 16: 12 },
    axes: ['X', 'Y', 'Z', 'Rz', 'hat', 'Rx', 'Ry'], lx: 'X', ly: 'Y', rx: 'Z', ry: 'Rz', lt: 'Rx', rt: 'Ry', dpad: 'hat',
  },
  dualsense: {
    key: 'dualsense', name: 'DualSense, raw (Firefox / Safari)', faces: 'xbox',
    buttons: { 0: 1, 1: 2, 2: 0, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 16: 12 },
    axes: ['X', 'Y', 'Z', 'Rz', 'Rx', 'Ry', 'hat'], lx: 'X', ly: 'Y', rx: 'Z', ry: 'Rz', lt: 'Rx', rt: 'Ry', dpad: 'hat',
  },
  switchpro: {
    key: 'switchpro', name: 'Switch Pro Controller, raw (or a pad in Switch mode)', faces: 'nintendo',
    // its HID buttons are already by position: 0 B bottom, 1 A right, 2 Y left, 3 X top
    buttons: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 16: 12 },
    axes: ['hat', 'X', 'Y', 'Rx', 'Ry'], lx: 'X', ly: 'Y', rx: 'Rx', ry: 'Ry', dpad: 'hat',
  },
  snes: {
    key: 'snes', name: 'USB SNES-style pad (D-pad on X / Y)', faces: 'nintendo',
    // raw 0 X (top), 1 A (right), 2 B (bottom), 3 Y (left), 4 L, 5 R, 8 Select, 9 Start (Chrome's own Mapper2Axes8Keys)
    buttons: { 0: 2, 1: 1, 2: 3, 3: 0, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 }, axes: ['X', 'Y'], lx: 'X', ly: 'Y', dpad: 'stick',
  },
  generic: {
    key: 'generic', name: 'unknown pad: as standard, a hat as the D-pad',
    buttons: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i, i])),
    axes: ['X', 'Y', 'Z', 'Rz', 'hat'], lx: 'X', ly: 'Y', rx: 'Z', ry: 'Rz', dpad: 'hat', generic: true,
  },
};

// 8BitDo products (vendor 2dc8) by what they are; the rest of the family is guessed from the name, then Nintendo letters.
// (SDL's GUIDs hold the product little-endian: "…c82d0000 0160…" is 2dc8:6001.) Nintendo letters, the default: SN30 Pro
// 6001 / 6101, SN30 Pro+ 6002 / 6102, Pro 2 6006, Pro 3 6009, Lite 2 5112, Lite SE 5111, NES30 Pro 9001, FC30 Pro 9000,
// N30 Pro 2 9015, Micro 9020, the receivers 3101–3104.
const EIGHTBITDO_XBOX = new Set(['3011', '3012', '3013', '3015', '3016', '3017', '3019', '301b', '301d', '3100', '3105', '5101', '5006', '6728', '5107', '5108', '9025', '9026', '2869']);
const EIGHTBITDO_DPAD = new Set(['5103', '9012', '2840', 'ab12', '2820', '2830', '9018', '3230', '0651']);
// pads Chrome / Firefox / Safari give raw on a Mac (where the browser has no remapper of its own)
const BY_ID = {
  '054c:05c4': 'dualshock4', '054c:09cc': 'dualshock4', '054c:0ba0': 'dualshock4',
  '054c:0ce6': 'dualsense', '054c:0df2': 'dualsense',
  '057e:2009': 'switchpro', '057e:200e': 'switchpro',
  '0810:e501': 'snes', '081f:e401': 'snes', '0079:0011': 'snes', '12bd:d015': 'snes', '0583:2060': 'snes',
};

/** An 8BitDo pad's printed letters from its id: 'nintendo' (the default: SN30 Pro…), 'xbox' (Ultimate…), null if not one. */
export function eightBitDoLetters(id = '') {
  const { vendor, product, name } = parsePadId(id);
  if (vendor !== '2dc8' && !/8bitdo|8bit do/i.test(name ?? '') && !/8bitdo/i.test(id)) return null;
  if (product && EIGHTBITDO_XBOX.has(product)) return 'xbox';
  if (/ultimate|adapter|\bm30\b|\b64\b|neogeo|\bp30\b|\bs30\b/i.test(name ?? '')) return 'xbox';
  return 'nintendo';
}

/** Which profile reads this pad. */
export function pickProfile(pad) {
  if (!pad || pad.mapping === 'standard') return PROFILES.standard;
  const { vendor, product, name } = parsePadId(pad.id ?? '');
  if (vendor === '2dc8' || /8bitdo|8bit do/i.test(name)) {
    if (product && EIGHTBITDO_XBOX.has(product)) return PROFILES['8bitdo-xbox'];
    if (product && EIGHTBITDO_DPAD.has(product)) return PROFILES['8bitdo-dpad'];
    if (/ultimate|adapter|\bm30\b|\b64\b|neogeo|\bp30\b|\bs30\b/i.test(name)) return PROFILES['8bitdo-xbox'];
    if (/sn30|sf30|nes30|zero|\bn30\b/i.test(name) && !/pro|\+|plus/i.test(name)) return PROFILES['8bitdo-dpad'];
    return PROFILES['8bitdo'];
  }
  const key = vendor && BY_ID[`${vendor}:${product}`];
  if (key) return PROFILES[key];
  if (/dualsense/i.test(name)) return PROFILES.dualsense;
  if (/dualshock|wireless controller/i.test(name) && !/xbox/i.test(name)) return PROFILES.dualshock4;
  if (/pro controller/i.test(name)) return PROFILES.switchpro;
  if (/snes|super famicom|retrolink/i.test(name)) return PROFILES.snes;
  return PROFILES.generic;
}

// HID usages Chrome places at a fixed index (usage − 0x30); the rest take the first free slots
const FIXED = { X: 0, Y: 1, Z: 2, Rx: 3, Ry: 4, Rz: 5, slider: 6, dial: 7, wheel: 8, hat: 9 };
/** usage → axis index, for this browser's layout. */
export function axisMap(usages, flavor) {
  const out = {};
  if (flavor === 'chrome') {
    const taken = new Set();
    for (const u of usages) if (u in FIXED) { out[u] = FIXED[u]; taken.add(FIXED[u]); }
    let free = 0;
    for (const u of usages) if (!(u in FIXED)) { while (taken.has(free)) free++; out[u] = free; taken.add(free); }
  } else usages.forEach((u, i) => { out[u] = i; });
  return out;
}

/** A hat switch's axis value → the D-pad (−1 up, then clockwise in steps of 2/7; beyond ±1: neutral). */
export function hatDirection(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1.05) return null;
  const k = (v + 1) * 3.5, r = Math.round(k);
  if (Math.abs(k - r) > 0.2 || r < 0 || r > 7) return null;   // (0.0, before the first report, is between two steps: neutral)
  return { up: r === 7 || r <= 1, right: r >= 1 && r <= 3, down: r >= 3 && r <= 5, left: r >= 5 };
}

/** Per-pad memory: which axes have shown themselves a hat, which analog triggers have been seen at rest. */
export const padState = () => ({ hats: new Set(), rested: new Set() });

const btn = (pressed, value = pressed ? 1 : 0) => ({ pressed, touched: pressed || value > 0.05, value });
const rawValue = (b) => (b ? (typeof b === 'number' ? b : b.value > 0 ? b.value : b.pressed ? 1 : 0) : 0);
const rawPressed = (b) => (b ? (typeof b === 'number' ? b > 0.5 : !!b.pressed || b.value > 0.5) : false);

/** Where each standard button comes from (raw), in words: 'button 6', 'axis 9 (hat)', 'axis 3'. */
export function describeSources(profile, flavor, hatAxis) {
  if (profile.key === 'standard') return STANDARD_NAMES.map((_, i) => [`button ${i}`]);
  const map = axisMap(profile.axes, flavor);
  return STANDARD_NAMES.map((_, i) => {
    const out = [];
    const b = profile.buttons[i];
    if (b != null && !(profile.generic && i >= 12 && i <= 15 && hatAxis != null)) for (const r of [].concat(b)) out.push(`button ${r}`);
    if (i === 6 && profile.lt) out.push(`axis ${map[profile.lt]}`);
    if (i === 7 && profile.rt) out.push(`axis ${map[profile.rt]}`);
    if (i >= 12 && i <= 15 && profile.dpad === 'stick') out.push(`axis ${i < 14 ? map.Y : map.X} (D-pad: walks)`);
    if (i >= 12 && i <= 15 && hatAxis != null) out.push(`axis ${hatAxis} (hat)`);
    return out;
  });
}

function sourcesFor(state, profile, flavor, hat) {
  const key = `${profile.key}|${flavor}|${hat}`;
  if (state.sourcesKey !== key) { state.sourcesKey = key; state.sources = describeSources(profile, flavor, hat); }
  return state.sources;
}

/**
 * A raw pad → a Standard Gamepad (buttons 0..16, axes 0..3). Standard-mapped pads come back as they are.
 * `state` (padState()) remembers hats and trigger rests between frames; each pad needs its own.
 */
export function remapPad(raw, state = padState(), profile = pickProfile(raw)) {
  if (!raw || profile.key === 'standard') return raw;
  const { flavor } = parsePadId(raw.id ?? '');
  const axes = Array.from(raw.axes ?? []), buttons = Array.from(raw.buttons ?? []);
  axes.forEach((v, i) => { if (Math.abs(v) > 1.05) state.hats.add(i); });
  const map = axisMap(profile.axes, flavor);
  // the hat: one that has shown itself (beyond ±1: its neutral), else where the profile puts it (Chrome: 9;
  // an unknown pad's only there, never a guessed compact index, which might be a stick)
  let hat = null;
  if (state.hats.size) hat = [...state.hats][0];
  else if (profile.dpad === 'hat') {
    if (map.hat < axes.length && (flavor === 'chrome' || !profile.generic)) hat = map.hat;
    else if (!profile.generic && flavor !== 'chrome' && axes.length > 4) hat = axes.length - 1;   // (a shorter report than listed: the hat comes last)
  }
  const at = (u) => { const i = map[u]; return u && i != null && i < axes.length && i !== hat && !state.hats.has(i) ? i : null; };
  let rx = at(profile.rx), ry = at(profile.ry);
  // a short compact list (Firefox, Safari): the right stick is the next two axes that are not the hat
  if (profile.rx && flavor !== 'chrome' && (rx == null || ry == null)) {
    const free = axes.map((_, i) => i).filter((i) => i !== hat && !state.hats.has(i) && i !== at(profile.lx) && i !== at(profile.ly));
    [rx, ry] = [free[0] ?? null, free[1] ?? null];
  }
  const ax = (i) => (i == null ? 0 : +axes[i] || 0);
  const out = Array.from({ length: 17 }, () => btn(false));
  for (const [s, r] of Object.entries(profile.buttons)) {
    const si = +s;
    if (profile.generic && si >= 12 && si <= 15 && hat != null) continue;   // (a pad with a hat: its D-pad is the hat, not raw 12–15)
    const list = [].concat(r).filter((i) => i < buttons.length);
    if (!list.length) continue;
    const value = Math.max(...list.map((i) => rawValue(buttons[i])));
    out[si] = btn(list.some((i) => rawPressed(buttons[i])) || value > 0.5, value);
  }
  // analog triggers: 0..1 from their rest at −1, once that rest has been seen (an axis not reported yet reads 0)
  for (const [si, u] of [[6, profile.lt], [7, profile.rt]]) {
    const i = at(u);
    if (i == null || i === rx || i === ry) continue;
    if (axes[i] <= -0.9) state.rested.add(i);
    if (!state.rested.has(i)) continue;
    const v = Math.max(0, Math.min(1, (axes[i] + 1) / 2));
    if (v > out[si].value) out[si] = btn(v > 0.5 || out[si].pressed, v);
  }
  let lx = ax(at(profile.lx)), ly = ax(at(profile.ly));
  if (profile.dpad === 'hat' && hat != null) {
    const d = hatDirection(axes[hat]);
    if (d) [[12, d.up], [13, d.down], [14, d.left], [15, d.right]].forEach(([i, on]) => { if (on) out[i] = btn(true); });
  } else if (profile.dpad === 'stick') {
    // no sticks: the D-pad (X / Y, ±1) walks as the left stick does; a model of the kind with a hat after all
    // (the SN30 5103): the hat is its D-pad
    lx = Math.abs(lx) > 0.5 ? Math.sign(lx) : 0; ly = Math.abs(ly) > 0.5 ? Math.sign(ly) : 0;
    const d = hat != null ? hatDirection(axes[hat]) : null;
    if (d) [[12, d.up], [13, d.down], [14, d.left], [15, d.right]].forEach(([i, on]) => { if (on) out[i] = btn(true); });
  }
  return {
    id: raw.id, index: raw.index, connected: raw.connected !== false, mapping: 'standard', timestamp: raw.timestamp,
    axes: [lx, ly, ax(rx), ax(ry)], buttons: out, vibrationActuator: raw.vibrationActuator ?? null,
    remap: { profile, raw, flavor, hat, left: [at(profile.lx), at(profile.ly)], right: [rx, ry], sources: sourcesFor(state, profile, flavor, hat) },
  };
}

// --- the browser hook ---------------------------------------------------------------------------------------
let rawList = null;
/** The browser's own pads (before remapping), for the input display. */
export const rawGamepads = () => (rawList ? Array.from(rawList() ?? []) : Array.from(globalThis.navigator?.getGamepads?.() ?? []));

/** Wrap navigator.getGamepads() so non-standard pads come out standard (once; a no-op without the Gamepad API). */
export function installPadMaps(win = globalThis.window) {
  const nav = win?.navigator;
  if (!nav?.getGamepads || nav.__padMaps) return;
  const original = nav.getGamepads.bind(nav);
  const states = new Map(), cache = new Map();   // per index + id: the pad's memory; its last remap, by timestamp
  rawList = original;
  nav.getGamepads = () => {
    const list = original() ?? [];
    let odd = false;
    for (const p of list) if (p && p.mapping !== 'standard') { odd = true; break; }
    if (!odd) return list;   // (the common case: the browser's own list, nothing allocated)
    return Array.from(list, (p) => {
      if (!p || p.mapping === 'standard') return p;
      const key = `${p.index}|${p.id}`;
      const hit = cache.get(key);
      if (hit && p.timestamp != null && hit.timestamp === p.timestamp) return hit.pad;   // (asked several times a frame)
      let state = states.get(key);
      if (!state) states.set(key, (state = padState()));
      const pad = remapPad(p, state);
      cache.set(key, { timestamp: p.timestamp, pad });
      return pad;
    });
  };
  nav.__padMaps = true;
}
