import * as THREE from 'three';
import { TempleKit, templeMaterials, box, annulus, T as tf } from '../temples/kit.js';
import { Gust, Swing, Bank, Updraft } from '../temples/pieces.js';
import { PALETTE as DESERT } from '../temples/desert.js';
import { PALETTE as LORN } from '../temples/perdide.js';
import { PALETTE as VAEL } from '../temples/arzach.js';
import { PALETTE as BURIED } from '../temples/buried.js';

// The makers' runs in the open (docs/systems/challenges.md, src/trials/kit-data.js): the temples' own kit
// (src/temples/kit.js: halls, slabs, stairs, columns) and moving pieces (src/temples/pieces.js: Gust, Swing,
// Bank, Updraft) stood out in a world, in that world's temple palette. They stay there for good, run or no run: the
// wind-hall gusts and the crystals swing whether you are timing yourself or only passing (and the pieces are
// workings, so a foe feels them too). The pieces want a temple runtime; here a small stand-in (`openRuntime`)
// gives them the frame, the materials, the traveller and a logic that only says yes while a run asks it to.
//
//   const course = buildKitCourse(T, { scene, physics, player, notice, sound })
//   course.gates, course.start, course.heading, course.markerAt (world)
//   course.bank      (the wind-hall's eyes: a Bank) · course.swings · course.gusts · course.updrafts
//   course.listen(fn) the bank's eyes may wake (fn() → true) · course.reset() for a new run
//   course.update(dt, t) · course.dispose()

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PALETTES = { desert: DESERT, perdide: LORN, arzach: VAEL, buried: BURIED };

/** What a temple piece asks of its temple (src/temples/runtime.js), for a piece stood in the open. */
export function openRuntime({ scene, kit, M, P, player = null, notice = () => {}, sound = null }) {
  const root = new THREE.Group();
  root.name = `${kit.group.name} (pieces)`;
  scene?.add(root);
  const told = new Set();
  let listening = () => false;
  return {
    kit, M, P, root, player, sound,
    logic: {
      isLit: () => false, isOpen: () => false, has: () => true, check: () => true,
      /** A bank woke whole: lit only while a run is listening (else it goes dark again). */
      light: () => !!listening(),
    },
    listen(fn) { listening = fn ?? (() => false); },
    notice(text, key = null) {
      if (!text) return;
      if (key) { if (told.has(key)) return; told.add(key); }
      notice(text);
    },
    rumble() {}, onLit() {},
  };
}

// ---------------------------------------------------------------------------------------- the courses
/**
 * Each course builds itself in its frame with the kit (K) and the pieces (rt.add) and says where its gates are
 * (local [x, y, z, r]), its bank, its swings and gusts.
 */
export const COURSES = {
  /**
   * The wind hall (the desert): a roofless hall 7 m wide and 46 long on a plinth in the dunes, its door at the
   * south end, a porch roofed over its north end. Gusts blow down it from the porch to the door; four stone
   * screens stand out from the walls, turn and turn about, and behind each is calm. Three eyes over the porch,
   * a bank: all three in one breath, once the hall is walked.
   */
  windhall(K, rt) {
    const W = 7, L = 46, H = 5.2, t = 1.2;
    // the plinth, deep into the dune, and the steps down to the sand
    K.slab(-W / 2 - t - 0.6, -t - 0.6, W / 2 + t + 0.6, L + t + 0.6, -0.02, 3.4, K.M.stoneMat);
    K.stairs([0, -2.6, -7.6], [0, 0, -1.8], 4.4);
    K.hall({ x: 0, z: L / 2, w: W, d: L, y: 0, h: H, doors: [{ side: 's', at: 0, w: 3.2, h: 3.9 }], roof: false, t });
    // the screens: out from the west wall, then the east, leaving a way past each at the other side
    const screens = [9, 18, 27, 36].map((z, i) => ({ z, side: i % 2 ? 1 : -1 }));
    const shelters = [];
    for (const { z, side } of screens) {
      const len = 4.1, x0 = side * (W / 2), x1 = side * (W / 2 - len), cx = (x0 + x1) / 2;
      K.both(K.M.wall, box(len, 3.6, 0.9, cx, 1.8, z));
      K.both(K.M.trim, box(len + 0.2, 0.3, 1.1, cx, 3.6, z));
      K.glyph([cx, 2.1, z - 0.47], 0.9, Math.PI);
      // calm in its lee (on the door's side: the wind comes from the porch)
      shelters.push([[Math.min(x0, x1) - 0.1, -1, z - 2.9], [Math.max(x0, x1) + 0.1, 3.7, z - 0.4]]);
    }
    // the porch: a roof over the last four metres on two columns, calm under it
    const pz = L - 4.2;
    K.both(K.M.wall, box(W + 2 * t, 0.7, L - pz + t, 0, H + 0.35, (pz + L + t) / 2));
    K.both(K.M.trim, box(W + 2 * t + 0.2, 0.3, 0.4, 0, H - 0.1, pz));
    K.column(-W / 2 + 0.9, pz + 0.4, 0, H, 0.45);
    K.column(W / 2 - 0.9, pz + 0.4, 0, H, 0.45);
    shelters.push([[-W / 2, -1, pz - 0.2], [W / 2, H, L + 0.5]]);
    const gust = rt.add(Gust, {
      min: [-W / 2 - 0.2, -1.5, 1.2], max: [W / 2 + 0.2, H + 3, L + 0.5], dir: [0, 0, -1],
      shelters, calm: 2.8, blow: 2.2, warn: 0.8, push: 7.5,
      notice: 'The gust shoves you back down the hall. Wait for it behind a screen.',
    });
    const bank = rt.add(Bank, {
      id: 'eyes', window: 4,
      eyes: [[-2.3, 2.4], [0, 3.6], [2.3, 2.4]].map(([x, y]) => ({ at: [x, y, L - 0.02], yaw: Math.PI })),
      full: 'The three eyes wake, and sleep again. They answer someone who has walked the hall: start at the sign by its steps.',
    });
    return {
      // the gates: through the open stretch between each pair of screens, and into the porch
      gates: [[0, 2.2, 5, 3.6], [0, 2.2, 13.5, 3.6], [0, 2.2, 22.5, 3.6], [0, 2.2, 31.5, 3.6], [0, 2.2, pz + 1.6, 3.6]],
      bank, gusts: [gust], swings: [],
      bounds: [[-W / 2 - t - 1, -4, -9], [W / 2 + t + 1, H + 6, L + t + 1]],
      clear: [[-W / 2 - t - 1, -9], [W / 2 + t + 1, L + t + 1]],
    };
  },

  /**
   * The Hush walk (Lorn): a causeway 3.6 m wide from the south shore 42 m out over the deep lake to a round
   * stone, piers down into the water, and three arches over it, each with a crystal of the Hush swinging
   * across (Lorn's temple's pendulums, out in the open: they knock you off into the lake; a stilling burst
   * stops one a while). Out to the stone and back.
   */
  hushwalk(K, rt) {
    const w = 3.6, L = 42, R = 4.2;
    K.slab(-w / 2, -3, w / 2, L, 0, 0.9);
    for (const s of [-1, 1]) K.both(K.M.trim, box(0.3, 0.12, L + 3, s * (w / 2 - 0.15), -0.05, (L - 3) / 2));   // (a kerb of trim, flush: nothing to catch a knock)
    // piers under it, down to the lake's floor
    for (let z = 4; z < L; z += 7) K.column(0, z, -7, 6.1, 0.8, { mat: K.M.stoneMat });
    // the round stone at its end
    const D = new THREE.CylinderGeometry(R, R * 0.92, 1.0, 28);
    K.both(K.M.floor, tf(D, [0, -0.5, L + R - 0.6]));
    K.both(K.M.trim, tf(new THREE.TorusGeometry(R - 0.15, 0.12, 5, 40), [0, 0.02, L + R - 0.6], [Math.PI / 2, 0, 0]));
    K.column(0, L + R - 0.6, -7, 6.0, 1.6, { mat: K.M.stoneMat });
    K.glyph([0, 0.03, L + R - 0.6], 2.2, 0);
    // the arches and their crystals: three, each its own pace
    const swings = [];
    [[12, 2.6, 0.0], [22, 3.0, 0.35], [32, 2.8, 0.7]].forEach(([z, period, phase]) => {
      for (const s of [-1, 1]) K.column(s * 7.6, z, -7, 18.3, 0.6, { mat: K.M.trim });   // (wide apart: the crystal sweeps 5 m either way)
      K.both(K.M.wall, box(16.6, 0.9, 1.3, 0, 11.75, z));
      K.glyph([0, 11.75, z - 0.67], 0.8, Math.PI);
      swings.push(rt.add(Swing, { at: [0, 11.2, z], len: 9.2, amp: 0.6, period, phase, stillFor: 6, yaw: 0,
        rings: 'The crystal rings under the splash and swings on. A stilling burst would stop it.' }));
    });
    return {
      gates: [[0, 1.4, L + R - 0.6, 3.6], [0, 1.4, -0.4, 2.6]],
      bank: null, gusts: [], swings,
      bounds: [[-9, -8, -6], [9, 14, L + 2 * R + 1]],
      clear: [[-9, -6], [9, L + 2 * R]],
    };
  },
  /**
   * The feather leap (Vael): the Aerie's three winds stood out on the plain north-west of the landing. A plinth runs
   * from its steps to a column of rising wind at the foot of a makers' tower; open your wings in it and it
   * lifts you over the tower's back parapet onto its terrace, 12 m up (and no higher than its screens: no
   * gliding over them). Gusts blow down the terrace from the gulf's side (three screens, turn and turn about,
   * calm behind each, the parapet behind you), and from its
   * open front you glide a gulf 27.5 m across to a lower ledge, 6 m up, and the line. Down on the plain past
   * the first gate ends the run (src/trials/kit-data.js `fall`).
   */
  featherleap(K, rt) {
    const W = 8, U = 21.5;                         // the plinth, and the column at its end
    const T0 = 25, T1 = 47.5, TH = 12, TW = 7;     // the tower's terrace: from, to, height, width
    const L0 = 75, L1 = 88, LH = 6, LW = 9;        // the ledge over the gulf
    // the plinth and its steps up from the plain, the column's stone ring at its end
    K.slab(-W / 2, -1, W / 2, T0, 0, 4, K.M.floor);
    K.stairs([0, -2.9, -9.2], [0, 0, -1], 4.4);
    const up = rt.add(Updraft, { at: [0, 0, U], r: 4, h: 16, lift: 7,
      hint: 'The wind rushes up beside the tower. Jump, and hold jump to open your wings in it.' });
    // the tower: a block of the makers' stone, its terrace a lip of floor on top, parapets at its back and sides
    K.slab(-TW / 2, T0, TW / 2, T1, TH - 0.5, TH + 7, K.M.wall);
    K.slab(-TW / 2 - 0.3, T0 - 0.3, TW / 2 + 0.3, T1 + 0.3, TH, 0.5, K.M.floor);
    K.both(K.M.trim, box(TW + 0.6, 1.1, 0.5, 0, TH + 0.55, T0 - 0.05));
    for (const s of [-1, 1]) K.both(K.M.trim, box(0.5, 1.1, T1 - T0 + 0.6, s * (TW / 2 + 0.05), TH + 0.55, (T0 + T1) / 2));
    K.glyph([0, TH * 0.55, T0 - 0.32], 2.4, Math.PI);
    K.glyph([0, TH * 0.55, T1 + 0.32], 2.4, 0);
    // the screens: out from the west parapet, then the east, then the west, a way past each at the other side
    const inner = TW / 2 - 0.2, shelters = [];
    [31.5, 37.5, 43.5].forEach((z, i) => {
      const side = i % 2 ? 1 : -1, len = 3.6, x0 = side * inner, x1 = side * (inner - len), cx = (x0 + x1) / 2;
      K.both(K.M.wall, box(len, 4.2, 0.8, cx, TH + 2.1, z));
      K.both(K.M.trim, box(len + 0.2, 0.3, 1.0, cx, TH + 4.2, z));
      K.glyph([cx, TH + 1.7, z - 0.42], 0.8, Math.PI);
      shelters.push([[Math.min(x0, x1) - 0.1, TH - 1, z - 2.9], [Math.max(x0, x1) + 0.1, TH + 4.3, z - 0.4]]);
    });
    const gust = rt.add(Gust, {
      min: [-TW / 2 - 0.2, TH - 1.5, T0 + 0.3], max: [TW / 2 + 0.2, TH + 5, T1 + 0.3], dir: [0, 0, -1],
      shelters, calm: 3.0, blow: 2.0, warn: 0.8, push: 7.5,
      notice: 'The gust shoves you back along the terrace. Wait for it behind a screen.',
    });
    // the ledge over the gulf: a lower block, a gateway of two columns at its back, steps down to the plain
    K.slab(-LW / 2, L0, LW / 2, L1, LH - 0.5, LH + 7, K.M.wall);
    K.slab(-LW / 2 - 0.3, L0 - 0.3, LW / 2 + 0.3, L1 + 0.3, LH, 0.5, K.M.floor);
    K.add(K.M.trim, tf(annulus(2.6, 3.0, 0.06, 36), [0, LH + 0.03, L0 + 5]));
    K.glyph([0, LH * 0.5, L0 - 0.32], 2.0, Math.PI);
    for (const s of [-1, 1]) K.column(s * 3.2, L1 - 1.4, LH, 4.6, 0.45);
    K.both(K.M.wall, box(7.8, 0.7, 1.1, 0, LH + 4.95, L1 - 1.4));
    K.stairs([0, LH, L1 + 0.3], [0, -3, L1 + 12.6], 4);
    return {
      // the gates: on the terrace (up the wind), at its open front (past the screens), on the ledge (the gulf glided)
      gates: [[0, TH + 1.8, T0 + 3.2, 3.0], [0, TH + 1.8, T1 - 1.4, 3.0], [0, LH + 1.8, L0 + 5, 3.6]],
      bank: null, gusts: [gust], swings: [], updrafts: [up],
      bounds: [[-7, -5, -6], [7, TH + 8, L1 + 13]],
      clear: [[-7, -6], [7, L1 + 13]],
      // (the tests' measures: the gulf and the drop over it)
      gulf: { from: T1, to: L0, drop: TH - LH },
    };
  },
  /**
   * The furnace steps (the Buried Machine): the Engine-House's iron and its banks of four, stood out on the
   * sand east of the landing. A platform up a stair, then eight iron pillars across a furnace (a glowing grate
   * four metres down: on it, the run is over), each a jump from the last, up and down, zigzag; at the far end
   * a landing before a sealed door ringed by four eyes that wake only together, inside one breath (the tank
   * holds three: it wants the fourth chamber, as the Engine-House's door does).
   */
  furnacesteps(K, rt) {
    const W = 6, G = -4, E0 = 37.5, E1 = 46, EH = 2, EW = 8;
    // the start: a platform up a stair from the sand
    K.slab(-W / 2, -1, W / 2, 6, 0, 8, K.M.floor);
    K.stairs([0, -6.6, -13.4], [0, 0, -1], 3.6);
    // the furnace: an iron rim round a glowing grate, the pillars standing up out of it
    K.slab(-7, 6, 7, E0, G, 4, K.M.stoneMat);
    for (let z = 8; z < E0 - 1; z += 2.2) K.add(K.M.glyph, box(13.6, 0.08, 0.5, 0, G + 0.04, z));   // (the furnace's glow between the bars)
    for (const s of [-1, 1]) K.both(K.M.wall, box(0.8, 5.0, E0 - 6 + 0.8, s * 7.4, G + 1.5, (6 + E0) / 2));
    const pillars = [[0, 9.5, 0.0], [2.2, 13.2, 0.6], [-0.6, 16.8, 1.2], [-2.8, 20.4, 0.4], [-0.2, 24.0, 1.0], [2.4, 27.4, 1.8], [0.4, 31.0, 1.0], [-1.8, 34.4, 1.6]];
    const PR = 1.2;
    for (const [x, z, y] of pillars) {
      K.both(K.M.wall, new THREE.CylinderGeometry(PR, PR * 1.08, y - G + 0.5, 16).translate(x, (y + G - 0.5) / 2, z));
      K.add(K.M.trim, tf(annulus(PR - 0.25, PR + 0.06, 0.08, 20), [x, y + 0.04, z]));
    }
    // the landing and the sealed door with its four eyes
    K.slab(-EW / 2, E0, EW / 2, E1, EH, EH + 10, K.M.floor);
    K.both(K.M.wall, box(EW + 1, 7, 1.2, 0, EH + 3.5, E1 + 0.6));
    K.both(K.M.dark, box(2.6, 3.6, 0.3, 0, EH + 1.8, E1 - 0.1));
    K.both(K.M.trim, box(3.4, 0.4, 0.5, 0, EH + 3.8, E1 - 0.1));
    K.glyph([0, EH + 5.4, E1 - 0.05], 1.2, Math.PI);
    const bank = rt.add(Bank, {
      id: 'eyes', window: 2.6,
      eyes: [[-2.6, 1.4], [2.6, 1.4], [-2.6, 4.2], [2.6, 4.2]].map(([x, y]) => ({ at: [x, EH + y, E1 - 0.02], yaw: Math.PI })),
      full: 'The four eyes wake, and sleep again. They answer someone who has crossed the furnace: start at the sign by the stair.',
    });
    return {
      // the gates: over the third pillar, the sixth, and onto the landing
      gates: [[pillars[2][0], pillars[2][2] + 1.6, pillars[2][1], 2.4], [pillars[5][0], pillars[5][2] + 1.6, pillars[5][1], 2.4], [0, EH + 1.6, E0 + 1.6, 3.4]],
      bank, gusts: [], swings: [], updrafts: [], pillars: pillars.map(([x, z, y]) => ({ x, y, z, r: PR })),
      bounds: [[-8, -8, -14], [8, EH + 8, E1 + 2]],
      clear: [[-8, -14], [8, E1 + 2]],
      gulf: { from: 6, to: E0, floor: G },
    };
  },
};

/** Build a makers' run in its world (see the top of this file). */
export function buildKitCourse(T, { scene, physics, player = null, notice = () => {}, sound = null }) {
  const P = PALETTES[T.world] ?? DESERT;
  const M = templeMaterials(P);
  const [ox, oy, oz] = T.origin;
  const parent = new THREE.Group();
  parent.name = `Makers’ run: ${T.name}`;
  scene?.add(parent);
  const kit = new TempleKit(parent, T.name, V(ox, oy, oz), T.yaw ?? 0, M);
  const rt = openRuntime({ scene: parent, kit, M, P, player, notice, sound });
  const pieces = [];
  rt.add = (Piece, o) => { const p = new Piece(rt, o); pieces.push(p); return p; };
  const build = COURSES[T.course];
  if (!build) throw new Error(`no makers’ course "${T.course}"`);
  const C = build(kit, rt);
  kit.flush();
  const collider = physics?.addCollider?.(kit.group) ?? null;
  for (const p of pieces) p.init?.(physics);
  const at = (x, y, z) => kit.world(x, y, z);
  const gates = C.gates.map(([x, y, z, r]) => { const p = at(x, y, z); return { x: p.x, y: p.y, z: p.z, r }; });
  const [sx, sz] = T.start;
  const start = at(sx, 0, sz);
  const [mx, mz] = T.marker;
  const m = at(mx, 0, mz);
  const markerAt = V(m.x, physics ? physics.groundAt(m.x, m.y + 6, m.z, 30) : m.y, m.z);
  if (!Number.isFinite(markerAt.y)) markerAt.y = m.y;
  const box3 = new THREE.Box3(V(...C.bounds[0]), V(...C.bounds[1]));
  return {
    trial: T, kit, rt, gates, start, heading: kit.heading(T.heading ?? 0), markerAt,
    bank: C.bank, swings: C.swings, gusts: C.gusts, updrafts: C.updrafts ?? [], gulf: C.gulf ?? null, pillars: (C.pillars ?? []).map((p) => ({ ...p, at: at(p.x, p.y, p.z) })), pieces,
    /** The ground the world's own props should leave clear (world x, z corners). */
    clear: C.clear.map(([x, z]) => at(x, 0, z)),
    /** Is p in or on the course (its frame's box)? */
    contains: (p) => box3.containsPoint(kit.local(p)),
    listen: (fn) => rt.listen(fn),
    /** A new run: the bank dark, the crystals swinging from their start. */
    reset() {
      const b = C.bank;
      if (b) { b.done = false; for (const e of b.eyes) e.at = -1e9; }
      for (const s of C.swings) s.still = 0;
    },
    update(dt, t) {
      rt.player = player;
      for (const p of pieces) p.update?.(dt, t);
    },
    dispose() {
      for (const p of pieces) p.dispose?.();
      if (collider) physics.removeCollider?.(collider);
      parent.removeFromParent();
    },
  };
}
