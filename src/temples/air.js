import * as THREE from 'three';
import { Motes } from '../life.js';

// The air inside the makers' houses in their futuristic skins (issue #372, docs/design/temple-ambience.md,
// docs/systems/temples.md "The houses' air"): what hangs in each house's air, how its own lights breathe, and the bed of
// sound under it, while the traveller is inside. Three cheap shared pieces, configured per house in HOUSE_AIR:
//   - the air: one or two layers of life.js's Motes (one draw each, points round the camera, tested against the
//     G-buffer's depth; on the Unity side the bridge's camera-facing quads on Hiraeth/Mote), embers rising in the fire
//     houses, sand streaming in the wind's, bubbles in the sea's, drips, dust, glints. Built the first time you go in,
//     drawn only while you are inside; the world's own motes are hidden in there (the desert's sand stops at the door).
//     Handheld and low presets (lowDetail) get AIR_LOW of them.
//   - the light: the house's own lights (rt.ownLights, the layout's) eased by lightPulse(): a fire's flicker, a slow
//     breath, a signal's blink, a clock's tick. Their reach changes, so both renderers' local lights carry it.
//   - the sound: `sound` goes to Sound.update as `house`, selecting one shared recorded temple ambience.
//     The legacy per-house sound fields remain metadata; gameplay does not layer those old beds.
// Look and sound only: no collision, no logic, no timings (tests/temple-air.test.js).

/** The share of a layer's motes drawn on a low-detail preset (the handheld, Low, the Deck). */
export const AIR_LOW = 0.5;

/**
 * Each skinned house's air. theme: what the house is about; layers: Motes options (count before AIR_LOW; box: the cube
 * round the camera they wrap in, m; tall: its height as a share of box; rise m/s, negative falls; wind m/s along x, z;
 * sway: the wobble's share; glow: no rim, a halo, blinking); light: its lights' pulse (lightPulse);
 * sound: legacy metadata and the presence signal for the shared recorded temple bed.
 */
export const HOUSE_AIR = {
  // the Rose House (the desert): the Givers' blade, braziers and ember light in violet slate: embers and rose sand
  desert: { theme: 'fire and sand', layers: [
    { count: 100, color: '#ff8a30', size: 0.04, glow: 0.85, rise: 0.8, wind: [0.15, 0.05], sway: 0.55, box: 15, tall: 0.6 },
    { count: 50, color: '#e4b494', size: 0.035, rise: 0.02, wind: [0.35, 0.12], box: 14 }],
    light: { kind: 'flicker', depth: 0.12, rate: 7 }, sound: { bed: 'fire', roar: 0.35, roarF: 260, howl: 0.15 } },
  // the Aerie (Vael's plain): a shaft open to the sky, the turbine driving the wind: ochre sand streaming past
  arzach: { theme: 'wind', layers: [
    { count: 130, color: '#e0b878', size: 0.045, rise: 0.5, wind: [3.4, 1.1], sway: 1.2, box: 16 },
    { count: 20, color: '#fff1dc', size: 0.05, glow: 0.4, rise: 1.2, wind: [1.2, 0.5], sway: 1.6, box: 16 }],
    light: { kind: 'breathe', depth: 0.06, rate: 0.5 }, sound: { bed: 'gusts', howl: 1, hum: 0.3, humF: 55 } },
  // the Founders' Belfry: bells in cobalt and bronze: bronze dust hanging in the light, glinting
  arzach2: { theme: 'bells', layers: [
    { count: 80, color: '#efcf96', size: 0.04, glow: 0.45, rise: 0.03, wind: [0.08, 0.04], sway: 0.7, box: 16 }],
    light: { kind: 'breathe', depth: 0.1, rate: 0.9 }, sound: { bed: 'bells', hum: 0.35, humF: 73.4, howl: 0.25 } },
  // the Hush-House (Lorn): sound-damping slate over a black pool, crystal resonators: slow violet motes, drips
  perdide: { theme: 'hush and still water', layers: [
    { count: 55, color: '#cbbcff', size: 0.04, glow: 0.8, rise: 0.02, wind: [0.04, 0.02], sway: 0.5, box: 15 },
    { count: 16, color: '#bcd4ff', size: 0.028, rise: -5, wind: [0, 0], sway: 0.05, box: 12, tall: 0.8 }],
    light: { kind: 'breathe', depth: 0.08, rate: 0.35 }, sound: { bed: 'drips', hum: 0.25, humF: 49 } },
  // the Lamp-House (Lorn's deep wood): near-black, where light wakes things: a few warm sparks, fine dust
  // (issue #521: the sparks read as lamps, not fireflies: fewer, smaller, a softer halo (glow 0.75: a 1.6× point, not
  // 1.8×; the colour’s lift 1.19), and a quarter see-through; they were 40, 0.035, glow 1, solid)
  perdide2: { theme: 'dark and lamplight', layers: [
    { count: 26, color: '#ffd68c', size: 0.028, glow: 0.75, alpha: 0.75, rise: 0.08, wind: [0.05, 0.03], sway: 0.8, box: 14 },
    { count: 50, color: '#8f8a9c', size: 0.03, rise: 0.01, wind: [0.1, 0.05], box: 12 }],
    light: { kind: 'breathe', depth: 0.12, rate: 0.6 }, sound: { bed: 'filament', hum: 0.4, humF: 61.7 } },
  // the Whale-House (under the sea): sage slate behind the great windows: bubbles rising, drips off the brass
  underwater: { theme: 'the sea', layers: [
    { count: 60, color: '#c6f4ec', size: 0.045, glow: 0.35, rise: 0.65, wind: [0.06, 0.03], sway: 1.6, box: 14, tall: 0.7 },
    { count: 12, color: '#a8e6dc', size: 0.028, rise: -5, wind: [0, 0], sway: 0.05, box: 12, tall: 0.8 }],
    light: { kind: 'breathe', depth: 0.1, rate: 0.4 }, sound: { bed: 'deep', roar: 0.5, roarF: 180, hum: 0.2, humF: 41.2 } },
  // the Warden's Well (the City-Shaft): a tower of turning vanes and bellows: lavender dust carried up the shaft
  incal: { theme: 'updraft', layers: [
    { count: 120, color: '#a297cf', size: 0.042, rise: 1.5, wind: [0.2, 0.1], sway: 0.6, box: 15, tall: 0.8 }],
    light: { kind: 'breathe', depth: 0.07, rate: 0.7 }, sound: { bed: 'vanes', howl: 0.7, hum: 0.3, humF: 65.4 } },
  // the Clock-House (the Glass Dunes): stopped sand in brass rings round a chasm: grains falling slow as in a glass
  garage: { theme: 'time and sand', layers: [
    { count: 90, color: '#ecc98d', size: 0.04, glow: 0.2, rise: -0.4, wind: [0.03, 0.01], sway: 0.3, box: 14, tall: 0.8 }],
    light: { kind: 'tick', depth: 0.08, rate: 1 }, sound: { bed: 'ticks', hum: 0.25, humF: 55 } },
  // the Engine-House (the Buried Machine): amber circuits and glowing pits under navy slate: embers and ash
  buried: { theme: 'fire and machine', layers: [
    { count: 110, color: '#ff7f24', size: 0.04, glow: 0.85, rise: 1, wind: [0.1, 0.05], sway: 0.6, box: 15, tall: 0.6 },
    { count: 40, color: '#a89488', size: 0.03, rise: 0.15, wind: [0.2, 0.08], box: 14 }],
    light: { kind: 'flicker', depth: 0.14, rate: 6 }, sound: { bed: 'furnace', roar: 0.45, roarF: 200, hum: 0.35, humF: 46.2 } },
  // the Casting-House (the Moon Foundry): pilot flames and the cracked moon over the pouring floor: sparks, heat dust
  moonfoundry: { theme: 'the foundry', layers: [
    { count: 110, color: '#ffa040', size: 0.036, glow: 0.85, rise: 1.25, wind: [0.15, 0.05], sway: 0.75, box: 15, tall: 0.6 },
    { count: 40, color: '#c9a888', size: 0.03, rise: 0.3, wind: [0.15, 0.05], box: 14 }],
    light: { kind: 'flicker', depth: 0.15, rate: 5 }, sound: { bed: 'forge', roar: 0.5, roarF: 240, hum: 0.2, humF: 41.2 } },
  // the Footprint (the Garden of Spheres): a white sphere of cream panels: pale blue-white motes, slow and bright
  spheres: { theme: 'light and calm', layers: [
    { count: 80, color: '#eef6ff', size: 0.04, glow: 0.55, rise: 0.06, wind: [0.06, 0.03], sway: 0.8, box: 15 }],
    light: { kind: 'breathe', depth: 0.06, rate: 0.3 }, sound: { bed: 'glass', hum: 0.2, humF: 82.4 } },
  // the Mooring-House (the Moorings): the stopped winch under the planet: teal glints hanging like far stars
  spacecity: { theme: 'space and cables', layers: [
    { count: 70, color: '#a6fff0', size: 0.04, glow: 1, rise: 0.01, wind: [0.02, 0.01], sway: 0.3, box: 16 }],
    light: { kind: 'breathe', depth: 0.08, rate: 0.25 }, sound: { bed: 'cables', hum: 0.4, humF: 36.7 } },
  // the Undertower (the Signal Market): dishes facing over a cable pit: coral dust, the lights blinking like a signal
  bazaar: { theme: 'signals', layers: [
    { count: 60, color: '#ffc2a6', size: 0.035, glow: 0.3, rise: 0.04, wind: [0.12, 0.05], box: 14 }],
    light: { kind: 'blink', depth: 0.12, rate: 1.4 }, sound: { bed: 'signals', hum: 0.35, humF: 98 } },
};

/**
 * A house's light, as a factor of its reach at time t (seed: the light's own, so they don't move as one).
 * flicker: a fire's, quick and uneven; breathe: a slow swell; blink: a signal's short pulses, twice, then a rest;
 * tick: a clock's, a little lift each second, left and right in turn.
 */
export function lightPulse({ kind = 'breathe', depth = 0.1, rate = 1 } = {}, t, seed = 0) {
  const s = seed * 7.13;
  if (kind === 'flicker') return 1 + depth * (0.55 * Math.sin(t * rate + s) + 0.3 * Math.sin(t * rate * 2.37 + s * 1.7) + 0.15 * Math.sin(t * rate * 5.11 + s * 0.6));
  if (kind === 'blink') { const p = ((t * rate + seed * 0.37) % 3 + 3) % 3; return 1 + depth * (p < 0.25 || (p > 0.5 && p < 0.75) ? 1 : -0.3); }
  if (kind === 'tick') { const p = ((t * rate) % 1 + 1) % 1, side = Math.floor(t * rate + seed) % 2 ? 1 : 0.6; return 1 + depth * (side * Math.exp(-p * 7) - 0.3); }
  return 1 + depth * Math.sin(t * rate + s);
}

/** A house's layers, as built: its counts on this preset. */
export function airLayers(id, { lowDetail = false } = {}) {
  const A = HOUSE_AIR[id];
  if (!A) return [];
  return A.layers.map((l) => ({ ...l, count: Math.max(4, Math.round(l.count * (lowDetail ? AIR_LOW : 1))) }));
}

const _p = new THREE.Vector3();

/**
 * The houses' air for a level (its skinned temples: level.temples, each rt with rt.skin and a HOUSE_AIR entry).
 *   new HouseAir(level, { lowDetail, host, worldMotes })   lowDetail: a flag or a function asked when a house's air is built;
 *                                              host: a scene to put the motes in (the engines: the bridge mirrors it);
 *                                              without one each layer keeps its own scene for the page to draw over the ink
 *   update(dt, t, camera, pos) → the house you are in (its rt) or null; hides the world's motes there (worldMotes)
 *   scenes()                                   the layers' scenes to draw this frame (the page)
 *   sound                                      the bed of the house you are in (Sound.update's `house`), or null
 *   setTarget(tNormal, w, h, pr)               the G-buffer and size the page draws them against
 */
export class HouseAir {
  constructor(level, { lowDetail = false, host = null, worldMotes = null } = {}) {
    this.level = level; this.lowDetail = lowDetail; this.host = host; this.worldMotes = worldMotes;
    this.built = new Map();   // rt → [Motes]
    this.at = null; this.sound = null;
    this.target = null;
    this.still = false;   // (the lights held at their reach as built: a fixed view's picture, the checks' web and engines alike)
  }
  /** The skinned houses with an air (none with ?noair=1: the house as it was, for a before and after). */
  houses() {
    if (this.off ??= typeof location !== 'undefined' && /[?&]noair=1/.test(location.search)) return [];
    return (this.level?.temples ?? []).filter((rt) => rt.skin && HOUSE_AIR[rt.id]);
  }
  setTarget(tNormal, w, h, pr) {
    this.target = { tNormal, w, h, pr };
    for (const layers of this.built.values()) for (const m of layers) this.aim(m);
  }
  aim(m) {
    const T = this.target;
    if (!T) return;
    if (T.tNormal) m.uniforms.tNormal.value = T.tNormal;
    m.uniforms.uRes.value.set(T.w, T.h); m.uniforms.uPR.value = T.pr;
  }
  build(rt) {
    const low = typeof this.lowDetail === 'function' ? this.lowDetail() : this.lowDetail;
    const layers = airLayers(rt.id, { lowDetail: !!low }).map((o) => {
      const m = new Motes(null, o);
      m.points = m.scene.children[0];
      m.points.name = `${rt.def?.name ?? rt.id}: the air`;
      if (this.host) this.host.add(m.points);
      this.aim(m);
      return m;
    });
    this.built.set(rt, layers);
    return layers;
  }
  update(dt, t, camera, pos) {
    let at = null;
    for (const rt of this.houses()) if (rt.inside(_p.copy(pos))) { at = rt; break; }
    if (at !== this.at) {
      if (this.at) this.rest(this.at);
      this.at = at;
      if (at && !this.built.has(at)) this.build(at);
      for (const [rt, layers] of this.built) for (const m of layers) m.points.visible = rt === at;
      if (this.worldMotes) for (const c of this.worldMotes.scene?.children ?? []) c.visible = !at;
      if (this.worldMotes?.points) this.worldMotes.points.visible = !at;
      this.sound = at ? HOUSE_AIR[at.id].sound : null;
    }
    if (!at) return null;
    for (const m of this.built.get(at)) m.update(dt, t, camera.position);
    this.pulse(at, t);
    return at;
  }
  /** The house's own lights eased by its pulse (their reach as built kept in rt._airBase). */
  pulse(rt, t) {
    const L = rt.ownLights ?? [], P = HOUSE_AIR[rt.id].light;
    if (!L.length || !P) return;
    const base = (rt._airBase ??= L.map((l) => l.w));
    for (let i = 0; i < L.length; i++) L[i].w = base[i] * (this.still ? 1 : lightPulse(P, t, i));
  }
  /** Back as built, on the way out. */
  rest(rt) {
    const base = rt._airBase;
    if (base) for (let i = 0; i < base.length; i++) rt.ownLights[i].w = base[i];
  }
  scenes() { return this.at ? this.built.get(this.at).map((m) => m.scene) : []; }
  dispose() {
    for (const layers of this.built.values()) for (const m of layers) { m.points.removeFromParent(); m.geo.dispose(); m.points.material.dispose(); }
    this.built.clear();
  }
}
