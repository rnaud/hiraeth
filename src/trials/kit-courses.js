import * as THREE from 'three';
import { TempleKit, templeMaterials, box, T as tf } from '../temples/kit.js';
import { Gust, Swing, Bank } from '../temples/pieces.js';
import { PALETTE as DESERT } from '../temples/desert.js';
import { PALETTE as LORN } from '../temples/perdide.js';

// The makers' runs in the open (docs/systems/challenges.md, src/trials/kit-data.js): the temples' own kit
// (src/temples/kit.js: halls, slabs, stairs, columns) and moving pieces (src/temples/pieces.js: Gust, Swing,
// Bank) stood out in a world, in that world's temple palette. They stay there for good, run or no run: the
// wind-hall gusts and the crystals swing whether you are timing yourself or only passing (and the pieces are
// workings, so a foe feels them too). The pieces want a temple runtime; here a small stand-in (`openRuntime`)
// gives them the frame, the materials, the traveller and a logic that only says yes while a run asks it to.
//
//   const course = buildKitCourse(T, { scene, physics, player, notice, sound })
//   course.gates, course.start, course.heading, course.markerAt (world)
//   course.bank      (the wind-hall's eyes: a Bank) · course.swings · course.gusts
//   course.listen(fn) the bank's eyes may wake (fn() → true) · course.reset() for a new run
//   course.update(dt, t) · course.dispose()

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PALETTES = { desert: DESERT, perdide: LORN };

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
    bank: C.bank, swings: C.swings, gusts: C.gusts, pieces,
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
