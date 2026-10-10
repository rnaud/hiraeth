// Rumble: the controller shakes in your hands (v1.6).
//
// A few named patterns, each a short list of pulses { at (ms from now), dur (ms), strong, weak }
// (the heavy motor, the light one, 0..1), scaled by the Settings' intensity and played on whatever
// can shake:
//  - the Gamepad API's vibrationActuator, playEffect('dual-rumble', …): Chrome and Edge on a computer,
//    the Steam Deck's app (Electron), the Xbox app (WebView2); hapticActuators[0].pulse() where only
//    that exists (older Firefox);
//  - the Android app's bridge (AppShell 'rumble', NATIVE_API 8: GamepadBridge's pad, its own motor, or
//    the handheld's), whose pads are not the Gamepad API's (src/native-pad.js).
// With nothing that can shake it does nothing (supported() is false; the Settings say so). Nothing in
// the game depends on it: every cue that rumbles has its picture and its sound too.
//
// The patterns (and where they fire):
//   hurt      a hit taken, by the hearts it cost (main.js onHurt)
//   slam      a heavy foe's ground slam, by how near (src/foes.js addWave)
//   land      landing hard: the tumble (main.js onKnockdown, why 'fall')
//   knockdown knocked over by a blow, or out (main.js onKnockdown)
//   potion    the potion drunk: two soft swallows (main.js onDrink)
//   charged   the blade's charged cut let go, harder when full (src/fluid-blade.js release)
//   chime     a chime picked up: the lightest tick (main.js ChimeField onTake)
//   takeoff   the ship lifting off: a long swell (src/ship/cinematics.js TakeoffDirector)
//   search    the signature search's beat: three pulses, by how near (src/ship/starmap.js)
//   found     the search resolving a planet
//
// Settings: `rumble` (on / off, default on) and `rumbleLevel` ('low' | 'medium' | 'high', default
// medium). Pure apart from play(): tests/rumble.test.js.

/** The intensity levels: × every pulse's magnitude. */
export const LEVELS = { low: 0.45, medium: 0.75, high: 1 };

const clamp = (v) => Math.min(1, Math.max(0, +v || 0));
const pulse = (at, dur, strong, weak = strong) => ({ at, dur, strong: clamp(strong), weak: clamp(weak) });

/** The patterns: (options) → pulses. */
export const PATTERNS = {
  /** h: hearts lost (a quarter is a tap, one and a half and more the heaviest). */
  hurt: ({ h = 1 } = {}) => { const k = clamp(h / 1.5); return [pulse(0, 110 + 190 * k, 0.3 + 0.6 * k, 0.55 + 0.4 * k)]; },
  /** dist: metres from the slam (felt out to 14 m). */
  slam: ({ dist = 0 } = {}) => {
    const k = clamp(1 - dist / 14);
    return k <= 0.02 ? [] : [pulse(0, 260, 0.95 * k, 0.4 * k), pulse(300, 180, 0.4 * k, 0.15 * k)];
  },
  /** speed: m/s into the ground (FALL.tumble 32 .. FALL.lethal 48). */
  land: ({ speed = 32 } = {}) => { const k = clamp((speed - 24) / 24); return [pulse(0, 160 + 140 * k, 0.6 + 0.4 * k, 0.5 + 0.3 * k)]; },
  knockdown: ({ dead = false } = {}) => (dead ? [pulse(0, 420, 1, 0.8), pulse(500, 260, 0.5, 0.3)] : [pulse(0, 260, 0.75, 0.5)]),
  potion: () => [pulse(0, 70, 0.08, 0.3), pulse(200, 70, 0.08, 0.3)],
  /** full: the charge was full. */
  charged: ({ full = false } = {}) => (full ? [pulse(0, 200, 0.85, 0.7)] : [pulse(0, 140, 0.5, 0.45)]),
  chime: () => [pulse(0, 35, 0, 0.14)],
  /** A perfect dodge: a tap, then a long soft hum as the world slows (src/flurry.js). */
  flurry: () => [pulse(0, 80, 0.5, 0.3), pulse(130, 480, 0.1, 0.2)],
  /** The ship lifting off its feet: a kick, then the engines' roar fading as it climbs away (~2.4 s). */
  takeoff: () => [pulse(0, 420, 0.95, 0.7), ...[0, 1, 2, 3, 4, 5].map((i) => pulse(450 + i * 330, 330, 0.7 - i * 0.11, 0.5 - i * 0.07))],
  /** s: the search's cue strength (0..1): the signature's three pulses, stronger and closer together nearer. */
  search: ({ s = 0 } = {}) => {
    const k = clamp(s);
    if (k < 0.12) return [];
    const gap = 150 - 60 * k, dur = 45 + 35 * k, m = 0.08 + 0.5 * k;
    return [0, 1, 2].map((i) => pulse(i * gap, dur, m * 0.6, m));
  },
  found: () => [pulse(0, 120, 0.4, 0.6), pulse(170, 120, 0.4, 0.6), pulse(340, 320, 0.8, 0.9)],
};

/** The pulses of a pattern at the settings' intensity (none when off or the name is unknown). */
export function patternPulses(name, opts = {}, { on = true, level = 'medium' } = {}) {
  const P = PATTERNS[name];
  if (!on || !P) return [];
  const m = LEVELS[level] ?? LEVELS.medium;
  return P(opts).map((p) => ({ ...p, strong: clamp(p.strong * m), weak: clamp(p.weak * m) })).filter((p) => p.dur > 0 && (p.strong > 0 || p.weak > 0));
}

/** A pad's way to shake: 'dual' (vibrationActuator.playEffect), 'haptic' (hapticActuators[0].pulse) or null. */
export function padActuator(pad) {
  const v = pad?.vibrationActuator;
  if (v && typeof v.playEffect === 'function') {
    const fx = v.effects ? [...v.effects] : null;
    if (fx ? fx.includes('dual-rumble') : !v.type || v.type === 'dual-rumble') return 'dual';
  }
  if (typeof pad?.hapticActuators?.[0]?.pulse === 'function') return 'haptic';
  return null;
}

/** Play one pulse on a pad (now). */
export function padPulse(pad, p) {
  const kind = padActuator(pad);
  try {
    if (kind === 'dual') pad.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: p.dur, strongMagnitude: p.strong, weakMagnitude: p.weak })?.catch?.(() => {});
    else if (kind === 'haptic') pad.hapticActuators[0].pulse(Math.max(p.strong, p.weak), p.dur)?.catch?.(() => {});
    else return false;
  } catch { return false; }
  return true;
}

/**
 * The rumble player. `env`: { pads() (the connected pads), native (the Android bridge: { ok(), pulse(p) }),
 * schedule(fn, ms), settings() → { on, level } }: the game's own by default; the tests give their own.
 */
export class Rumble {
  constructor(env = {}) {
    this.env = env;
    this.timers = new Set();
    this.lastPlayed = null;
  }
  pads() {
    const list = this.env.pads ? this.env.pads() : (globalThis.navigator?.getGamepads?.() ?? []);
    return [...list].filter((p) => p && p.connected !== false && padActuator(p));
  }
  /** Is there anything that can shake (a pad with an actuator, or the Android app's bridge)? */
  supported() { return this.pads().length > 0 || !!this.env.native?.ok?.(); }
  settings() { return this.env.settings?.() ?? { on: true, level: 'medium' }; }
  /** Is it on and able to shake? */
  active() { const s = this.settings(); return !!s.on && this.supported(); }
  /** Play a pattern by name. Returns the pulses played (none: off, unsupported, unknown). */
  play(name, opts = {}) {
    if (!this.supported()) return [];
    const pulses = patternPulses(name, opts, this.settings());
    if (!pulses.length) return [];
    this.lastPlayed = { name, pulses };
    const schedule = this.env.schedule ?? ((fn, ms) => (ms > 0 ? setTimeout(fn, ms) : (fn(), null)));
    for (const p of pulses) {
      let id = null, fired = false;
      id = schedule(() => { fired = true; if (id != null) this.timers.delete(id); this.pulse(p); }, p.at);
      if (id != null && !fired) this.timers.add(id);
    }
    return pulses;
  }
  /** One pulse now, on every pad that can shake (and the Android bridge). */
  pulse(p) {
    let any = false;
    for (const pad of this.pads()) any = padPulse(pad, p) || any;
    if (!any && this.env.native?.ok?.()) { this.env.native.pulse(p); any = true; }
    return any;
  }
  /** Stop: the scheduled pulses dropped, the motors stopped (leaving a screen, pausing). */
  stop() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    for (const pad of this.pads()) { try { pad.vibrationActuator?.reset?.()?.catch?.(() => {}); } catch { /* */ } }
  }
}

// ---- the game's own: the Settings, the pads, the Android app

let settingsRef = null;
const nativeState = { ok: false, asked: false };

/** The Android app's bridge (AppShell 'rumble', NATIVE_API 8): asks info once (and again when a pad connects). */
function nativeBridge(win = globalThis.window) {
  const cap = win?.Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.nativePromise) return null;
  const ask = () => {
    nativeState.asked = true;
    cap.nativePromise('AppShell', 'info').then((i) => { nativeState.ok = (i?.native ?? 0) >= 8 && !!i?.rumble; }).catch(() => { nativeState.ok = false; });
  };
  return {
    ok() { if (!nativeState.asked) ask(); return nativeState.ok; },
    pulse(p) { cap.nativePromise('AppShell', 'rumble', { ms: Math.round(p.dur), strong: p.strong, weak: p.weak }).catch(() => {}); },
    ask,
  };
}

const native = nativeBridge();
globalThis.window?.addEventListener?.('nativepadconnected', () => native?.ask());

/** The game's rumble (src/main.js wires the Settings with setRumbleSettings). */
export const rumble = new Rumble({
  native,
  settings: () => ({ on: settingsRef ? settingsRef.rumble !== false : true, level: settingsRef?.rumbleLevel ?? 'medium' }),
});

/** Hand the Settings over (src/ui.js Settings: rumble, rumbleLevel). */
export function setRumbleSettings(s) { settingsRef = s; }

/** Play a pattern on the game's rumble (a no-op without a pad that can shake, or with rumble off). */
export const rumblePlay = (name, opts) => rumble.play(name, opts);
/** Is there a pad (or the Android app's bridge) that can shake? */
export const rumbleSupported = () => rumble.supported();
