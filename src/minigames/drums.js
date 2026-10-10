// The drum circle (docs/systems/minigames.md): a night in the dunes round a fire, the desert's villagers on
// their benches with their drums, a few dancing, and the traveller with a drum of his own. The circle plays
// the desert's song (src/score.js's D hijaz, its oud, ney and drone, src/score-voices.js); the traveller's
// part comes in as ink glyphs rolling along four spokes to the drum's ring, one spoke for each face button
// (A / × at the bottom, B / ○ right, X / □ left, Y / △ top), and is played on the beat: perfect, good or
// missed. A run of hits is a combo, worth more, and the circle dances harder the longer it holds.
//
// The rules are pure (src/minigames/rhythm.js: the chart at each difficulty, the windows, the score). Here:
// the camp, the people's poses, the backing scheduled on the audio clock a little ahead (as src/audio.js
// schedules the score), the presses timed from their events (the keys', the pointer's, the pad's own
// timestamp) and set against what was heard (the context's output timestamp), less the Timing offset.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { Flames } from '../story/flames.js';
import { NPC } from '../npc.js';
import { playVoice, hit as playHit } from '../score-voices.js';
import { scoreFor, scoreFreq } from '../score.js';
import { inputKind } from '../prompt-keys.js';
import { promptText } from '../native-pad.js';
import { arenaLevel } from './kit/world.js';
import {
  LANES, LEVELS, SONG, JUDGE, drumSong, eventsBetween, heardSongTime, newRun, judgePress, sweepMisses, runDone,
  accuracy, rank, timingAdvice, fervour, multiplier, FRAME_PATTERN,
} from './rhythm.js';

const INK = '#2b211f', PAPER = '#f7ecd2';
const BENCH_R = 4.3, SEAT_H = 0.32;
/** The circle: seven places round the fire (the traveller's the first, nearest the camera), and the dancers. */
export const SEATS = Array.from({ length: 7 }, (_, i) => {
  const a = Math.PI * 0.12 + (i / 7) * Math.PI * 2;
  return { x: Math.sin(a) * BENCH_R, z: Math.cos(a) * BENCH_R, heading: Math.atan2(-Math.sin(a), -Math.cos(a)), a };
});
// the dancers: two inside the circle either side of the fire (as the traveller sees it), two beyond the far benches
// ([how far past the fire from the traveller, how far to the side]: they stand clear of the drum's ring on the screen)
export const DANCERS = [[1.2, -3.0], [1.6, 3.1], [6.6, -4.4], [6.9, 4.8]].map(([d, l], i) => {
  const s = SEATS[0], fx = -s.x / BENCH_R, fz = -s.z / BENCH_R, x = fx * d - fz * l, z = fz * d + fx * l;
  return { x, z, i, heading: Math.atan2(-x, -z) + (i % 2 ? -0.4 : 0.4) };
});

// ------------------------------------------------------------------ the camp
function* buildCamp(scene) {
  const terrain = yield* Terrain.make({
    size: 900, seg: 120,
    // a hollow in the dunes: flat round the fire, banks rising beyond the tents, dunes out to the dark
    height: (x, z) => {
      const r = Math.hypot(x, z), bank = r < 16 ? 0 : (r - 16) ** 1.35 * 0.06;
      return bank + (r > 30 ? 3.5 * Math.sin(x / 23 + z / 31) * Math.sin(z / 17) * Math.min(1, (r - 30) / 40) : 0);
    },
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const M = {
    stone: makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66', mode: MODE_STRATA, strataSize: 0.4 }),
    wood: makeMaterial({ color: '#a8683f', color2: '#8c5533' }),
    char: makeMaterial({ color: '#4a3b33', flat: true }),
    rug: [makeMaterial({ color: '#c8483a', side: THREE.DoubleSide }), makeMaterial({ color: '#2f6f73', side: THREE.DoubleSide }), makeMaterial({ color: '#e0a84a', side: THREE.DoubleSide })],
    cloth: [makeMaterial({ color: '#e9dcc0', side: THREE.DoubleSide }), makeMaterial({ color: '#d9643a', side: THREE.DoubleSide }), makeMaterial({ color: '#7f9aa2', side: THREE.DoubleSide }), makeMaterial({ color: '#c99d48', side: THREE.DoubleSide })],
    skin: makeMaterial({ color: '#efe0c2', color2: '#e4cfa9' }),
    rim: makeMaterial({ color: '#7a4a2c', color2: '#653b22' }),
    glow: makeMaterial({ color: '#ffd27a', glow: 1, flat: true }),
    ink: makeMaterial({ color: INK, flat: true }),
  };
  const add = (geo, mat, noCollide = true) => { const m = new THREE.Mesh(geo, mat); if (noCollide) m.userData.noCollide = true; scene.add(m); return m; };
  // the hearth: a ring of stones, logs crossed in it, ash
  const stones = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2, r = 1.05 + 0.05 * Math.sin(i * 2.3);
    stones.push(new THREE.DodecahedronGeometry(0.24 + 0.05 * ((i * 7) % 3), 0).scale(1.2, 0.75, 1).rotateY(i).translate(Math.sin(a) * r, 0.12, Math.cos(a) * r).toNonIndexed());
  }
  add(mergeGeometries(stones), M.stone);
  const logs = [];
  for (let i = 0; i < 4; i++) logs.push(new THREE.CylinderGeometry(0.11, 0.13, 1.5, 6).rotateZ(Math.PI / 2 - 0.25).rotateY(i * Math.PI / 4 + 0.3).translate(0, 0.22, 0).toNonIndexed());
  add(mergeGeometries(logs), M.wood);
  add(new THREE.CircleGeometry(0.95, 18).rotateX(-Math.PI / 2).translate(0, 0.02, 0), M.char);
  const flames = new Flames(scene, [
    { at: new THREE.Vector3(0, 0.25, 0), h: 2.4, r: 0.72 }, { at: new THREE.Vector3(0.32, 0.25, -0.18), h: 1.6, r: 0.48, phase: 2 },
    { at: new THREE.Vector3(-0.3, 0.25, 0.22), h: 1.8, r: 0.52, phase: 4 }, { at: new THREE.Vector3(0.05, 0.3, 0.3), h: 1.25, r: 0.4, phase: 5 },
    { at: new THREE.Vector3(0, 0.3, 0), h: 1.2, r: 0.38, core: 1, phase: 1 },
  ], { seed: 23 });
  yield;
  // the benches: a log for each place, and a rug before it
  const benches = [], rugs = [[], [], []];
  SEATS.forEach((s, i) => {
    // (a log on its side, its top at the seat's height, along the place)
    benches.push(new THREE.CylinderGeometry(SEAT_H / 2, SEAT_H / 2 + 0.02, 1.55, 8).rotateZ(Math.PI / 2).rotateY(s.heading).translate(s.x, SEAT_H / 2, s.z).toNonIndexed());
    const fx = s.x * 0.78, fz = s.z * 0.78;
    rugs[i % 3].push(new THREE.PlaneGeometry(1.5, 1.0).rotateX(-Math.PI / 2).rotateY(s.heading).translate(fx, 0.025, fz).toNonIndexed());
  });
  add(mergeGeometries(benches), M.wood, false);
  rugs.forEach((r, i) => add(mergeGeometries(r), M.rug[i]));
  // the drums: a goblet drum (darbuka) by each place, set where the knees will hold it
  const drumGeo = new THREE.LatheGeometry([[0.0, 0], [0.09, 0], [0.1, 0.04], [0.07, 0.18], [0.07, 0.24], [0.16, 0.38], [0.19, 0.47], [0.19, 0.5], [0.0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const headGeo = new THREE.CircleGeometry(0.185, 16).rotateX(-Math.PI / 2).translate(0, 0.505, 0);
  const drums = SEATS.map((s, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(drumGeo, M.rim), new THREE.Mesh(headGeo, M.skin));
    g.traverse((o) => { o.userData.noCollide = true; });
    g.position.set(s.x + Math.sin(s.heading) * 0.5, 0, s.z + Math.cos(s.heading) * 0.5);
    g.rotation.set(0.38, s.heading, 0, 'YXZ');   // (tipped toward the fire, the head under the hands)
    scene.add(g);
    return g;
  });
  yield;
  // the tents round the hollow, their doors to the fire; poles, pennants, a lantern on a pole at two
  const tents = [], dark = [], poles = [], pennants = [[], [], [], []];
  const TENTS = [[-11, -6], [9, -10], [-14, 7], [14, 4], [2, -15], [-5, 14]];
  TENTS.forEach(([x, z], i) => {
    const face = Math.atan2(-x, -z);
    tents.push(new THREE.ConeGeometry(3.2, 4.4, 6, 1, true).rotateY(i).translate(x, 2.2, z).toNonIndexed());
    dark.push(new THREE.BoxGeometry(1.1, 1.7, 0.2).rotateY(face).translate(x + Math.sin(face) * 2.45, 0.85, z + Math.cos(face) * 2.45).toNonIndexed());
    poles.push(new THREE.CylinderGeometry(0.06, 0.06, 6.2, 4).translate(x, 3.1, z).toNonIndexed());
    pennants[i % 4].push(new THREE.PlaneGeometry(1.3, 0.6).translate(0.65, 0, 0).rotateY(face + 1.1).translate(x, 5.9, z).toNonIndexed());
  });
  tents.forEach((g, i) => add(g, M.cloth[i % 4], false));
  add(mergeGeometries(dark), M.ink);
  add(mergeGeometries(poles), M.wood);
  pennants.forEach((p, i) => p.length && add(mergeGeometries(p), M.cloth[(i + 1) % 4]));
  const lanterns = [[-7.5, 2.5], [6.8, -5.5]].map(([x, z]) => {
    add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5).translate(x, 1.3, z), M.wood);
    add(new THREE.SphereGeometry(0.2, 10, 8).translate(x, 2.7, z), M.glow);
    return new THREE.Vector4(x, 2.7, z, 7);
  });
  // jars and a crate or two, between the tents
  const jars = [];
  for (const [x, z, s] of [[-9, -2, 1], [-8.4, -1.2, 0.7], [11, -2, 0.9], [4, 9, 1.1], [4.8, 9.6, 0.7], [-3, -11, 0.9]]) jars.push(new THREE.LatheGeometry([[0, 0], [0.22, 0.05], [0.3, 0.3], [0.2, 0.62], [0.13, 0.7], [0.15, 0.78], [0, 0.78]].map(([a, b]) => new THREE.Vector2(a * s, b * s)), 10).translate(x, 0, z).toNonIndexed());
  add(mergeGeometries(jars), M.rim);
  yield;
  return arenaLevel({
    ground: terrain, name: 'The Drum Circle', hour: 19.7,
    spawn: new THREE.Vector3(SEATS[0].x, 0, SEATS[0].z),
    lights: [new THREE.Vector4(0, 1.6, 0, 15), ...lanterns],
    drums: { flames, drums, M },
    sky: {
      script: {
        day: ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'],
        dusk: ['#5f6aa8', '#e9a986', '#6c64a0', '#ffd2ae', '#ffd9a8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
      planets: [{ el: 18, az: 140, size: 7, color: '#e9d7c0', ring: 0.5 }],
    },
  });
}

// ------------------------------------------------------------------ the people's poses
const ease = (x) => x * x * (3 - 2 * x);
/** A struck hand: 1 at the hit, falling away; lifted again just before the next (s: s since the hit, gap: s to the next). */
const strikeCurve = (since, until) => {
  const after = Math.exp(-since * 16);           // (down on the head, then off it)
  const before = until < 0.12 ? ease(1 - until / 0.12) : 0;   // (the hand lifts into the next stroke)
  return { down: after, lift: Math.max(0, 1 - after) * (0.35 + 0.65 * before) };
};

/** Seated on the bench, the drum between the knees: the hands' strokes (0..1 down) and how hard the body moves. */
export function poseSeated(c, { l = 0, r = 0, liftL = 0, liftR = 0, bob = 0, k = 0, t = 0, look = 0 }) {
  for (let i = 0; i < 2; i++) {
    const side = i ? -1 : 1;
    c.legs[i].rotation.set(-1.62, 0, side * 0.32);   // (thighs out along the bench's front, knees apart round the drum)
    c.knees[i].rotation.x = 1.72;
    c.feet[i].rotation.set(-0.1, 0, 0);
  }
  c.body.position.set(0, SEAT_H + 0.06 - 0.96 - 0.03 * bob, 0);
  c.body.rotation.set(0, 0, Math.sin(t * 1.3) * 0.03 * k);
  c.torso.rotation.set(0.32 + 0.1 * bob + 0.06 * k, Math.sin(t * 2.1) * 0.12 * k, 0);
  // the arms: forward over the drum, each hand down on it (d) or lifted (lf)
  const arm = (i, d, lf) => {
    const side = i ? -1 : 1;
    c.arms[i].rotation.set(-0.42 - 0.5 * lf + 0.18 * d, 0, side * (-0.28 - 0.1 * lf));
    c.elbows[i].rotation.x = -1.05 - 0.7 * lf + 0.35 * d;
  };
  arm(0, r, liftR); arm(1, l, liftL);
  c.head.rotation.set(0.2 - 0.12 * bob - 0.15 * k * Math.max(0, Math.sin(t * 4.2)), look, 0);
  c.hatTip.rotation.x = -0.2 + 0.15 * bob;
  for (const f of c.flames ?? []) f.visible = false;
}

/** A dancer: stepping on the beat, swaying, the arms rising with the circle's fervour k (0..1), turning at its height. */
export function poseDancer(c, { beat = 0, k = 0, i = 0 }) {
  const ph = beat * Math.PI, step = Math.sin(ph), bounce = Math.abs(Math.sin(ph));
  const amp = 0.25 + 0.75 * k;
  for (let j = 0; j < 2; j++) {
    const side = j ? -1 : 1, lift = Math.max(0, side * step) * amp;
    c.legs[j].rotation.set(-0.55 * lift - 0.05, 0, side * 0.06);
    c.knees[j].rotation.x = 1.1 * lift + 0.08;
    c.feet[j].rotation.set(0.3 * lift, 0, 0);
  }
  c.body.position.set(0, -0.05 * bounce * amp - 0.04, 0);
  c.body.rotation.set(0, 0, Math.sin(ph) * 0.09 * amp);
  c.torso.rotation.set(0.08 * bounce * amp, Math.sin(ph * 0.5 + i) * 0.35 * amp, -Math.sin(ph) * 0.06);
  // the arms: low and swinging when the circle is quiet, up over the head clapping when it burns
  const up = ease(Math.min(1, k * 1.25)), clap = Math.abs(Math.sin(ph * 2));
  for (let j = 0; j < 2; j++) {
    const side = j ? -1 : 1;
    const swing = Math.sin(ph + j * Math.PI) * 0.5 * (1 - up);
    c.arms[j].rotation.set(-0.25 + swing - 0.4 * up, 0, side * (-0.25 - 2.45 * up + 0.25 * up * clap));
    c.elbows[j].rotation.x = -0.5 - 0.6 * up * (1 - clap * 0.6);
  }
  c.head.rotation.set(-0.1 * up + 0.1 * bounce, Math.sin(ph * 0.5) * 0.3, 0);
  c.hatTip.rotation.x = -0.3 * bounce * amp;
  for (const f of c.flames ?? []) f.visible = false;
}

// ------------------------------------------------------------------ the overlay: the ring, the spokes and the glyphs
/** Where the ring and its spokes are on a screen w × h (CSS px): the centre, the ring's radius, the spokes' length. */
export function ringLayout(w, h) {
  const m = Math.min(w, h), R = m * 0.135, cx = w / 2, cy = h * 0.55;
  const room = Math.min(cy - R - 78, h - 24 - cy - R, w / 2 - R - 20);
  return { cx, cy, R, L: Math.max(80, Math.min(m * 0.32, room)), r: Math.max(12, m * 0.028) };
}
const DIRS = { bottom: [0, 1], right: [1, 0], left: [-1, 0], top: [0, -1] };

/** The glyph inside a note: the PlayStation shape of its button, in ink. */
function glyphPath(g, at, s) {
  g.beginPath();
  if (at === 'bottom') { g.moveTo(-s, -s); g.lineTo(s, s); g.moveTo(s, -s); g.lineTo(-s, s); }
  else if (at === 'right') g.arc(0, 0, s * 1.05, 0, Math.PI * 2);
  else if (at === 'left') g.rect(-s * 0.95, -s * 0.95, s * 1.9, s * 1.9);
  else { g.moveTo(0, -s * 1.15); g.lineTo(s * 1.1, s * 0.8); g.lineTo(-s * 1.1, s * 0.8); g.closePath(); }
}

class Overlay {
  constructor(lanes) {
    this.lanes = lanes;
    this.el = document.createElement('div');
    this.el.className = 'drums-overlay';
    this.el.style.cssText = 'position:fixed;inset:0;z-index:79;pointer-events:none;';
    this.cv = document.createElement('canvas');
    this.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.el.appendChild(this.cv);
    // the buttons' names beside their sockets (DOM text: the handhelds' names are written over it, native-pad.js)
    this.labels = LANES.slice(0, lanes).map((L) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;transform:translate(-50%,-50%);font:700 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:${INK};background:${PAPER};border:2px solid ${INK};box-shadow:2px 2px 0 ${INK};padding:3px 6px;white-space:nowrap;`;
      this.el.appendChild(d);
      return d;
    });
    document.body.appendChild(this.el);
    this.fx = [];   // the flashes: { lane, kind, t0 }
    this.labelKind = null;
  }
  remove() { this.el.remove(); }
  /** The sockets' labels for what is held: the pad's buttons, the keys' arrows, nothing on a touch screen. */
  setLabels(kind, lay) {
    for (const [i, d] of this.labels.entries()) {
      const L = LANES[i], [dx, dy] = DIRS[L.at];
      const text = kind === 'pad' ? promptText(L.pad, { remap: false }) : kind === 'touch' ? '' : `${L.keyLabel} ${L.keys[1].slice(3)}`;
      if (d.textContent !== text) d.textContent = text;
      d.style.display = text ? '' : 'none';
      // (beside its socket, a turn of the ring clockwise from it: clear of the spokes)
      const a = Math.atan2(dy, dx) + Math.PI / 4.2, rr = lay.R + lay.r * 1.9;
      d.style.left = `${lay.cx + Math.cos(a) * rr}px`;
      d.style.top = `${lay.cy + Math.sin(a) * rr}px`;
    }
  }
  flash(lane, kind, now) { this.fx.push({ lane, kind, t0: now }); if (this.fx.length > 16) this.fx.shift(); }

  /** Draw the frame: song time t (s), the notes, the run (for what is judged), the beat's phase, the combo. */
  draw({ t, song, run, combo, mult, beat, held, progress, now, countdown }) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (this.cv.width !== cw || this.cv.height !== ch) { this.cv.width = cw; this.cv.height = ch; }
    const g = this.cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const lay = this.lay = ringLayout(W, H), { cx, cy, R, L, r } = lay;
    const pulse = Math.max(0, 1 - (beat % 1) * 4) * (countdown ? 0.3 : 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // the spokes: dashed ink lines from each socket out
    for (let i = 0; i < this.lanes; i++) {
      const [dx, dy] = DIRS[LANES[i].at];
      g.strokeStyle = 'rgba(43,33,31,0.55)'; g.lineWidth = 2; g.setLineDash([3, 7]);
      g.beginPath(); g.moveTo(cx + dx * (R + r * 1.4), cy + dy * (R + r * 1.4)); g.lineTo(cx + dx * (R + L), cy + dy * (R + L)); g.stroke();
      g.setLineDash([]);
    }
    // the ring: the drum's head seen from above, a paper band with the ink's offset shadow
    g.fillStyle = INK; g.globalAlpha = 0.55;
    g.beginPath(); g.arc(cx + 4, cy + 4, R + 3, 0, Math.PI * 2); g.arc(cx + 4, cy + 4, R - 7, 0, Math.PI * 2, true); g.fill('evenodd');
    g.globalAlpha = 1;
    g.fillStyle = PAPER;
    g.beginPath(); g.arc(cx, cy, R + 3 + pulse * 2, 0, Math.PI * 2); g.arc(cx, cy, R - 7, 0, Math.PI * 2, true); g.fill('evenodd');
    g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, R + 3 + pulse * 2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, R - 7, 0, Math.PI * 2); g.stroke();
    // its lacing: little ticks round the band
    g.lineWidth = 1.2;
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2 + 0.06; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5)); g.lineTo(cx + Math.cos(a + 0.09) * (R + 1), cy + Math.sin(a + 0.09) * (R + 1)); g.stroke(); }
    // the sockets: where a glyph is played, the lane's colour, brighter while its button is held
    for (let i = 0; i < this.lanes; i++) {
      const Ln = LANES[i], [dx, dy] = DIRS[Ln.at], sx = cx + dx * R, sy = cy + dy * R;
      const last = this.fx.filter((f) => f.lane === i).at(-1), age = last ? now - last.t0 : 9;
      const pop = last && last.kind !== 'miss' ? Math.max(0, 1 - age * 5) : 0;
      const rr = r * (1.3 + 0.25 * pop + (held[i] ? 0.08 : 0));
      g.fillStyle = INK; g.beginPath(); g.arc(sx + 3, sy + 3, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = held[i] ? Ln.color : PAPER; g.beginPath(); g.arc(sx, sy, rr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
      g.save(); g.translate(sx, sy);
      g.strokeStyle = held[i] ? INK : Ln.color; g.lineWidth = 3; glyphPath(g, Ln.at, r * 0.5); g.stroke();
      g.restore();
      // a hit: ink thrown out of the socket (a perfect's longer), and the word
      if (last && age < 0.5) {
        const k = age / 0.5;
        if (last.kind !== 'miss') {
          g.strokeStyle = INK; g.lineWidth = last.kind === 'perfect' ? 2.4 : 1.6;
          const n = last.kind === 'perfect' ? 10 : 6, len = r * (last.kind === 'perfect' ? 1.4 : 0.9);
          for (let q = 0; q < n; q++) {
            const a = (q / n) * Math.PI * 2 + i, r0 = rr + 4 + k * r * 1.2;
            g.globalAlpha = 1 - k;
            g.beginPath(); g.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0); g.lineTo(sx + Math.cos(a) * (r0 + len * (1 - k)), sy + Math.sin(a) * (r0 + len * (1 - k))); g.stroke();
          }
          g.globalAlpha = 1;
        } else {
          g.strokeStyle = '#d9643a'; g.lineWidth = 3; g.globalAlpha = 1 - k;
          g.beginPath(); g.moveTo(sx - rr * 0.8, sy - rr * 0.8); g.lineTo(sx + rr * 0.8, sy + rr * 0.8); g.moveTo(sx + rr * 0.8, sy - rr * 0.8); g.lineTo(sx - rr * 0.8, sy + rr * 0.8); g.stroke();
          g.globalAlpha = 1;
        }
        const word = last.kind === 'perfect' ? 'PERFECT' : last.kind === 'good' ? 'GOOD' : last.kind === 'miss' ? 'MISS' : '';
        if (word) {
          const wx = sx + dx * (r * 3.4) + (dy ? r * 3.6 : 0), wy = sy + dy * (r * 2.6) - (dx ? r * 2.2 : 0) - k * 10;
          g.font = `900 ${Math.round(r * 0.95)}px ui-monospace, Menlo, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.globalAlpha = 1 - k * k; g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(word, wx, wy);
          g.fillStyle = last.kind === 'miss' ? '#d9643a' : last.kind === 'perfect' ? '#f2c54b' : '#fbf4e2'; g.fillText(word, wx, wy);
          g.globalAlpha = 1;
        }
      }
    }
    // the glyphs: rolling in along their spokes, turning as they roll; those played are gone
    const ap = song.approach;
    for (let i = run.next; i < song.notes.length; i++) {
      const n = song.notes[i];
      const ahead = n.t - t;
      if (ahead > ap) break;
      if (run.judged[i] && run.judged[i] !== 'miss') continue;
      if (ahead < -JUDGE.late - 0.25) continue;
      const Ln = LANES[n.lane], [dx, dy] = DIRS[Ln.at];
      const d = R + L * (ahead / ap);   // (past the socket a missed glyph rolls on into the ring, fading)
      const x = cx + dx * d, y = cy + dy * d, rot = -(L * (ahead / ap)) / r * (dx || dy);
      const fade = ahead < 0 ? Math.max(0, 1 + ahead / 0.4) : Math.min(1, (ap - ahead) / (ap * 0.15));
      g.globalAlpha = fade * (run.judged[i] === 'miss' ? 0.45 : 1);
      g.fillStyle = INK; g.beginPath(); g.arc(x + 2.5, y + 2.5, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = Ln.color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
      g.save(); g.translate(x, y); g.rotate(rot);
      g.lineWidth = 2.6; glyphPath(g, Ln.at, r * 0.45); g.stroke();
      // a tick on the rim: you see it roll
      g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 0.78); g.lineTo(0, -r); g.stroke();
      g.restore();
      g.globalAlpha = 1;
    }
    // the combo in the ring's middle, over the fire
    if (combo >= 3) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${Math.round(R * 0.42)}px ui-monospace, Menlo, monospace`;
      g.lineWidth = 5; g.strokeStyle = INK; g.strokeText(String(combo), cx, cy - R * 0.08);
      g.fillStyle = mult >= 4 ? '#f2c54b' : PAPER; g.fillText(String(combo), cx, cy - R * 0.08);
      g.font = `700 ${Math.round(R * 0.13)}px ui-monospace, Menlo, monospace`;
      const sub = `COMBO${mult > 1 ? ` ×${mult}` : ''}`;
      g.lineWidth = 3; g.strokeText(sub, cx, cy + R * 0.26); g.fillStyle = PAPER; g.fillText(sub, cx, cy + R * 0.26);
    }
    // the song's progress: an ink line along the bottom
    g.strokeStyle = 'rgba(43,33,31,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W * 0.3, H - 14); g.lineTo(W * 0.7, H - 14); g.stroke();
    g.strokeStyle = INK; g.beginPath(); g.moveTo(W * 0.3, H - 14); g.lineTo(W * (0.3 + 0.4 * Math.max(0, Math.min(1, progress))), H - 14); g.stroke();
    this.fx = this.fx.filter((f) => now - f.t0 < 0.6);
  }
}

// ------------------------------------------------------------------ the music on the audio clock
const S_DESERT = scoreFor('desert');
const freqOf = (degree, octave) => scoreFreq(S_DESERT, degree, octave);

/** The circle's song played into its own bus, a little ahead of the clock (rhythm.js eventsBetween says what). */
class Band {
  constructor(sound) {
    this.sound = sound;
    this.bus = null;
  }
  get ctx() { return this.sound?.ctx ?? null; }
  /** The bus (made once the context is there): straight into the world's sound, with a share of its room. */
  open() {
    const S = this.sound, ctx = this.ctx;
    if (!ctx || this.bus) return !!this.bus;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.62 * (S.musicVol ?? 0.8) * 1.25;
    this.bus.connect(S.world ?? S.master ?? ctx.destination);
    if (S.reverb) { this.send = ctx.createGain(); this.send.gain.value = 0.32; this.bus.connect(this.send).connect(S.reverb); }
    this.V = { ctx, noise: S.noiseBuf };
    // (the world's own score hushed while the circle plays: the music bus down, put back at the end)
    if (S.music) S.music.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    return true;
  }
  /** A new bus (after a pause: what was scheduled before it is left to sound into the old one, cut). */
  fresh() { this.close(0.03); this.bus = null; this.open(); }
  close(fade = 0.4) {
    const ctx = this.ctx, b = this.bus, s = this.send;
    if (!ctx || !b) return;
    b.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    setTimeout(() => { try { b.disconnect(); s?.disconnect(); } catch { /* gone */ } }, fade * 1000 + 600);
  }
  restoreWorld() {
    const S = this.sound, ctx = this.ctx;
    if (ctx && S.music) S.music.gain.setTargetAtTime(0.62 * (S.musicVol ?? 0.8), ctx.currentTime, 0.6);
  }
  /** One backing event at context time t. */
  play(e, t, spb) {
    if (!this.bus) return;
    const V = this.V, out = this.bus, dur = (e.beats ?? 0.25) * spb;
    if (e.kind === 'hit') playHit(V, e.voice, t, e.vol, out);
    else if (e.kind === 'held') playVoice(V, e.voice, freqOf(e.degree, e.octave), t, dur, e.vol, out, true);
    else if (['oud', 'ney', 'kalimba', 'marimba', 'celesta', 'flute'].includes(e.voice)) this.sound.instrument(e.voice, freqOf(e.degree, e.octave), t, dur, e.vol, out);
    else playVoice(V, e.voice, freqOf(e.degree, e.octave), t, dur, e.vol, out);
  }
  /** The traveller's own drum, at once (a press). */
  drum(lane, vol = 0.24) {
    if (!this.bus) return;
    playHit(this.V, LANES[lane].hit, this.ctx.currentTime, vol, this.bus);
  }
  /** A missed glyph: a dull, damped knock. */
  dud() { if (this.bus) playHit(this.V, 'knock', this.ctx.currentTime, 0.05, this.bus); }
}

// ------------------------------------------------------------------ the game
const _v = new THREE.Vector3();

function start(ctx) {
  const { player, camera, level, sound } = ctx;
  const D = level.drums;
  const levelId = ctx.option('level') ?? 'normal';
  const offsetMs = ctx.option('offset') ?? 0;
  const song = drumSong(levelId), run = newRun(song), spb = song.spb;
  const band = new Band(sound);
  const overlay = new Overlay(song.lanes);
  const held = [false, false, false, false];
  const clock = { t0: null, perf0: null, audio: false, paused: false, scheduled: -SONG.leadIn, ended: false, last: -Infinity };
  let heat = 0, beatHeard = -SONG.leadIn;

  // ---- the people: made once (a body each is a while to build) and kept on the level for the retries
  if (!D.people) {
    D.people = [];
    const P = ctx.people;
    const palettes = [{ cloak: '#c8483a' }, { cloak: '#2f6f73' }, { cloak: '#e0a84a' }, { cloak: '#7f9aa2' }, { cloak: '#9a5a8a' }, { cloak: '#d9643a' }, { cloak: '#5f7f4a' }, { cloak: '#b9a9c5' }, { cloak: '#c99d48' }, { cloak: '#e9dcc0' }];
    const make = (x, z, heading, k, extra = {}) => {
      try {
        const kind = k % 2 ? 'f' : 'm';
        const n = new NPC(ctx.scene, ctx.physics, { route: [new THREE.Vector3(x, 0, z)], palette: palettes[k % palettes.length], lines: ['…'], lib: null,
          human: P?.humans ? P.humans[kind === 'm' ? 0 : 1] : null, kind, world: 'desert', facing: heading, ...extra });
        n.balloon?.remove();
        n.object.position.set(x, 0, z);
        n.object.quaternion.setFromAxisAngle(_v.set(0, 1, 0), heading);
        return n;
      } catch (err) { console.warn('drums: a villager could not be made', err); return null; }
    };
    SEATS.forEach((s, i) => { if (i > 0) D.people.push({ npc: make(s.x, s.z, s.heading, i), seat: s, i, role: 'drum' }); });
    DANCERS.forEach((d) => D.people.push({ npc: make(d.x, d.z, d.heading, d.i + 7), at: d, i: d.i, role: 'dance' }));
    D.people = D.people.filter((p) => p.npc);
  }
  for (const p of D.people) { p.spin = 0; p.heading = p.at?.heading ?? p.seat.heading; }

  // ---- the traveller, on the near bench with his drum
  const me = SEATS[0];
  const hands = { l: -9, r: -9, next: 0 };   // (the last strokes: song time)
  const placeMe = () => {
    player.pos.set(me.x, 0, me.z);
    player.vel.set(0, 0, 0);
    player.heading = me.heading;
    player.onGround = true;
    player.object.position.set(me.x, 0, me.z);
    player.object.quaternion.setFromAxisAngle(_v.set(0, 1, 0), me.heading);
  };
  placeMe();

  // ---- the camera: behind the traveller's shoulder, a little up, on the fire and the far side of the circle
  const side = new THREE.Vector3(Math.cos(me.heading), 0, -Math.sin(me.heading));   // (across the traveller's back: he sits low on the left)
  const camPos = new THREE.Vector3(me.x * 1.7, 3.1, me.z * 1.7).addScaledVector(side, -2.3), camLook = new THREE.Vector3(0, 1.0, 0).addScaledVector(side, -0.6);
  const placeCamera = (t, k) => {
    const sway = Math.sin(t * 0.21) * 0.25;
    camera.position.set(camPos.x + sway, camPos.y + Math.sin(t * 0.17) * 0.08, camPos.z - sway * 0.4);
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);
    ctx.setFov(50 - 2 * k);
  };

  // ---- the clock: the song's time as heard (s from beat 0)
  const songAt = (perfMs) => {
    if (clock.t0 === null) return -SONG.leadIn * spb;
    if (!clock.audio) return (perfMs - clock.perf0) / 1000;
    const A = band.ctx;
    return heardSongTime(perfMs, { t0: clock.t0, stamp: A.getOutputTimestamp?.() ?? null, currentTime: A.currentTime, latency: (A.outputLatency || 0) + (A.baseLatency || 0), perfNow: performance.now() });
  };
  const begin = () => {
    // beat 0 a lead-in after GO: on the audio clock when there is one running, else the page's own
    clock.audio = band.open() && band.ctx.state === 'running';
    const lead = SONG.leadIn * spb;
    if (clock.audio) clock.t0 = band.ctx.currentTime + lead;
    clock.perf0 = performance.now() + lead * 1000;
    if (!clock.audio) clock.t0 = 0;
    clock.scheduled = -SONG.leadIn;
  };
  const schedule = () => {
    if (!clock.audio || clock.paused || clock.ended || clock.t0 === null) return;
    const A = band.ctx, horizon = (A.currentTime + 0.35 - clock.t0) / spb;
    if (horizon <= clock.scheduled) return;
    const from = Math.max(clock.scheduled, 0);
    for (const e of eventsBetween(from, horizon, song.bars)) band.play(e, clock.t0 + e.beat * spb, spb);
    clock.scheduled = horizon;
  };
  const timer = setInterval(schedule, 40);   // (as the score's: frames may be slow, the music is not)

  // ---- the presses
  const press = (lane, perfMs) => {
    if (lane >= song.lanes || clock.t0 === null || clock.paused || clock.ended) return;
    const t = songAt(perfMs) - offsetMs / 1000;
    const r = judgePress(run, lane, t);
    band.drum(lane, r.kind === 'stray' ? 0.14 : 0.24);
    if (r.kind !== 'stray') overlay.flash(lane, r.kind, performance.now() / 1000);
    // the traveller's hands: A and X the left, B and Y the right
    if (lane === 0 || lane === 2) hands.l = songAt(performance.now()); else hands.r = songAt(performance.now());
    ctx.setScore(run.score);
    if (r.kind !== 'stray' && run.combo > 0 && run.combo % 25 === 0) { ctx.flash(`${run.combo} in a row!`, 'good', 1.1); ctx.sfx.checkpoint(); }
  };
  const live = () => ctx.phase === 'play' || ctx.phase === 'count';
  const onKey = (e) => {
    if (e.repeat || !live() || clock.t0 === null) return;
    const lane = LANES.findIndex((L) => L.keys.includes(e.code));
    if (lane < 0) return;
    e.preventDefault();
    held[lane] = true;
    press(lane, e.timeStamp || performance.now());
  };
  const onKeyUp = (e) => { const lane = LANES.findIndex((L) => L.keys.includes(e.code)); if (lane >= 0) held[lane] = false; };
  // a touch screen: tap the sockets themselves
  const onPointer = (e) => {
    if (!live() || clock.t0 === null || !overlay.lay || e.target.closest?.('#minigame .mg-card, #minigame button')) return;
    const { cx, cy, R, r } = overlay.lay;
    let best = -1, bd = r * 3.2;
    for (let i = 0; i < song.lanes; i++) { const [dx, dy] = DIRS[LANES[i].at], d = Math.hypot(e.clientX - (cx + dx * R), e.clientY - (cy + dy * R)); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { held[best] = true; setTimeout(() => { held[best] = false; }, 90); press(best, e.timeStamp || performance.now()); }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointer);
  // the pad: its face buttons by position (controller.js: A PadJump, B PadE, X PadEvade, Y PadWhistle), the press
  // timed by the pad's own timestamp when it is this frame's
  const PAD = ['PadJump', 'PadE', 'PadEvade', 'PadWhistle'];
  const padWas = [false, false, false, false];
  const padStamp = (dt) => {
    const now = performance.now();
    let ts = 0;
    try { for (const p of navigator.getGamepads?.() ?? []) if (p?.connected && p.timestamp > ts) ts = p.timestamp; } catch { /* none */ }
    return ts && ts <= now && now - ts < dt * 1000 + 8 ? ts : now - dt * 500;
  };

  // ---- the people moving to the music
  const poseAll = (dt, t, beat) => {
    const k = heat;
    const step = Math.floor(beat * 4), sub = beat * 4 - step;
    for (const p of D.people) {
      const c = p.npc.char;
      if (p.role === 'drum') {
        // the villagers' frame drum (rhythm.js FRAME_PATTERN): the last stroke and the next, alternate hands
        const pat = FRAME_PATTERN, i0 = ((step % 16) + 16) % 16;
        let back = 0; while (back < 16 && pat[(i0 - back + 16) % 16] === '.') back++;
        let fwd = 1; while (fwd < 16 && pat[(i0 + fwd) % 16] === '.') fwd++;
        const since = (back + sub) * spb / 4, until = (fwd - sub) * spb / 4;
        const playing = beat >= 0 && beat < song.beats && t > -0.2;
        const right = ((i0 - back) + p.i) % 2 === 0;
        const s = playing ? strikeCurve(since, until) : { down: 0, lift: 0 };
        poseSeated(c, { r: right ? s.down : 0, l: right ? 0 : s.down, liftR: right ? s.lift : 0.2, liftL: right ? 0.2 : s.lift, bob: Math.max(0, Math.cos(beat * Math.PI * 2)) * (0.4 + k), k, t: t + p.i, look: Math.sin(t * 0.3 + p.i) * 0.3 });
        placeSeated(p.npc.object, p.seat);
      } else {
        poseDancer(c, { beat: beat + p.i * 0.13, k, i: p.i });
        // at the circle's height they turn round on the spot, and back
        p.spin += dt * (k > 0.7 ? (k - 0.7) * 6 : 0);
        p.heading = p.at.heading + Math.sin(p.spin) * Math.PI * 0.9 + Math.sin(t * 0.4 + p.i) * 0.2;
        p.npc.object.position.set(p.at.x, 0, p.at.z);
        p.npc.object.quaternion.setFromAxisAngle(_v.set(0, 1, 0), p.heading);
      }
      p.npc.humanoid?.update();
    }
    // the traveller: his strokes are the player's
    const sL = strikeCurve(Math.max(0, t - hands.l), 1), sR = strikeCurve(Math.max(0, t - hands.r), 1);
    poseSeated(player.char, { l: sL.down, r: sR.down, liftL: 0.25 + 0.5 * sL.lift, liftR: 0.25 + 0.5 * sR.lift, bob: Math.max(0, Math.cos(beat * Math.PI * 2)) * 0.5, k: k * 0.6, t, look: 0 });
    placeSeated(player.object, me);
    player.humanoid?.update();
    player.humanoid?.resetFeet?.();
    player.humanoid?.updateEyes?.(dt, null);
    player.updateCloth?.(dt);
    player._gait = null;
  };
  // (the drums by the places, but the traveller's: they sway with their player's strokes)
  const placeSeated = (o, s) => {
    o.position.set(s.x - Math.sin(s.heading) * 0.06, 0, s.z - Math.cos(s.heading) * 0.06);
    o.quaternion.setFromAxisAngle(_v.set(0, 1, 0), s.heading);
  };

  placeCamera(0, 0);
  poseAll(1 / 60, -SONG.leadIn * spb, -SONG.leadIn);
  ctx.status(`0 pts · ${LEVELS[levelId].label}`);
  overlay.setLabels(inputKind(), ringLayout(innerWidth, innerHeight));

  return {
    update(dt, inp, { phase, raw }) {
      const now = performance.now();
      if (phase === 'play' && clock.t0 === null) begin();
      const t = songAt(now), beat = t / spb;
      if (clock.t0 !== null && !clock.paused) {
        schedule();
        // the pad's presses (the keys' and the touch screen's come in their own events)
        const c = raw ?? {};
        for (let i = 0; i < 4; i++) {
          const on = !!c[PAD[i]] && !(i === 2 && c.PadAim);
          if (on && !padWas[i]) press(i, padStamp(dt));
          if (on !== padWas[i]) held[i] = on;
          padWas[i] = on;
        }
        for (const n of sweepMisses(run, t - offsetMs / 1000)) { overlay.flash(n.lane, 'miss', now / 1000); band.dud(); }
        if (!clock.ended && runDone(run) && t > song.length + 0.6) {
          clock.ended = true;
          const acc = accuracy(run), adv = timingAdvice(run, offsetMs), c2 = run.counts;
          const lines = [
            `${LEVELS[levelId].label} · rank ${rank(acc)} · ${Math.round(acc * 100)} % of the beats`,
            `Perfect ${c2.perfect} · good ${c2.good} · missed ${c2.miss}`,
            `Longest combo ${run.best} of ${song.notes.length}`,
          ];
          if (adv) lines.push(Math.abs(adv.ms) < 15 ? `Your timing sits on the beat (${adv.ms >= 0 ? '+' : ''}${adv.ms} ms)` : `Your hits were ${Math.abs(adv.ms)} ms ${adv.ms > 0 ? 'late' : 'early'}: try Timing ${adv.suggest > 0 ? '+' : ''}${adv.suggest} ms`);
          band.close(2.5);
          ctx.finish({ score: run.score, title: rank(acc) === 'D' ? 'The circle carried on' : 'The circle cheers', lines });
        }
      }
      if (beat > beatHeard) beatHeard = beat;
      // the circle's fervour follows the combo (up quickly, down slowly), and the fire with it
      const want = fervour(run.combo);
      heat += (want - heat) * (1 - Math.exp(-(want > heat ? 2.5 : 0.8) * dt));
      const pulse = Math.max(0, 1 - ((beat % 1) + 1) % 1 * 3);
      D.flames.intensity = 0.85 + 0.45 * heat + 0.12 * pulse * (t > 0 ? 1 : 0);
      D.flames.update(dt, now / 1000);
      level.lights[0].w = 13 + 5 * heat + 1.5 * pulse;
      poseAll(dt, t, beat);
      placeCamera(now / 1000, heat);
      if (inputKind() !== overlay.labelKind || overlay.lay?.cx !== innerWidth / 2) { overlay.labelKind = inputKind(); overlay.setLabels(overlay.labelKind, ringLayout(innerWidth, innerHeight)); }
      // (drawn as heard: the Timing offset moves the judging, for a press's own lag, not the glyphs)
      const shown = phase !== 'intro' && phase !== 'results';
      if (overlay.shown !== shown) { overlay.el.style.display = shown ? '' : 'none'; overlay.shown = shown; }
      if (shown) overlay.draw({ t, song, run, combo: run.combo, mult: multiplier(run.combo), beat, held, progress: t / song.length, now: now / 1000, countdown: phase !== 'play' });
      ctx.status(`${run.score} pts${run.combo >= 10 ? ` · ×${multiplier(run.combo)}` : ''}`);
    },
    pause(on) {
      if (clock.t0 === null || clock.ended) return;
      if (on) { clock.pausedAt = songAt(performance.now()); clock.paused = true; band.close(0.05); return; }
      // back from the pause: the song picks up a bar and a half before where it stopped
      const back = Math.max(-SONG.leadIn * spb, clock.pausedAt - 1.5 * SONG.meter * spb);
      clock.paused = false;
      if (clock.audio) { band.bus = null; band.open(); clock.t0 = band.ctx.currentTime + 0.25 - back; }
      clock.perf0 = performance.now() + 250 - back * 1000;
      clock.scheduled = back / spb;
      // (the glyphs not played yet come round again; those played stay played)
    },
    run, song, clock, songAt, press, band,   // (for the tests' and the screenshots' bot)
    end() {
      clearInterval(timer);
      band.close(0.3);
      band.restoreWorld();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointer);
      overlay.remove();
    },
  };
}

export default {
  id: 'drums', order: 9,
  name: 'Drum circle',
  blurb: 'A night round the fire with the desert’s villagers: drum the song with them, on the beat, while they dance.',
  rules: 'Play each glyph as it rolls into the ring: on the beat is perfect, near it good. Hits in a row build a combo worth up to four times as much, and the circle dances harder the longer it lasts.',
  controls: {
    pad: [['A / ×', 'the bottom glyph (the deep dum)'], ['B / ○', 'the right glyph (tek)'], ['X / □', 'the left glyph (ka)'], ['Y / △', 'the top glyph (a clap; not on Easy)'], ['Menu', 'pause']],
    keys: [['↓  or  S', 'the bottom glyph (the deep dum)'], ['→  or  D', 'the right glyph (tek)'], ['←  or  A', 'the left glyph (ka)'], ['↑  or  W', 'the top glyph (a clap; not on Easy)'], ['Esc', 'pause']],
    touch: [['Tap a socket', 'play its glyph'], ['❚❚', 'pause']],
  },
  touchButtons: [],   // (the sockets are tapped: none of the usual buttons)
  options: [
    { id: 'level', label: 'Difficulty', choices: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], default: 'normal' },
    { id: 'offset', label: 'Timing', min: -200, max: 200, step: 10, default: 0, unit: 'ms', hint: 'More if your hits land late, less if early: the results suggest one.' },
  ],
  bestBy: 'level',
  // (its arcade sign in the desert: by the pilgrims' small fire south of the big one, facing it, a few steps back
  // from the child sitting by the fire, whose "talk" would win the button standing at the sign)
  markers: [{ level: 'desert', at: [185.8, null, 269.2], heading: Math.atan2(178.3 - 185.8, 275.7 - 269.2) }],
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: false, score: true },
  color: '#f0a04b',
  build: buildCamp,
  start,
};
