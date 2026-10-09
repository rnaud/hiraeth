import * as THREE from 'three';
import { TempleKit, templeMaterials, box, annulus, lathe, paint, T as tf } from '../temples/kit.js';
import { Gust, Swing, Bank, Updraft, Ball, Plate, EchoStone, EchoEar } from '../temples/pieces.js';
import { TempleLogic, memoryStore } from '../temples/logic.js';
import { PALETTE as DESERT } from '../temples/desert.js';
import { PALETTE as LORN } from '../temples/perdide.js';
import { PALETTE as VAEL } from '../temples/arzach.js';
import { PALETTE as BURIED } from '../temples/buried.js';
import { PALETTE as SPHERES } from '../temples/spheres.js';
import { PALETTE as SHAFT } from '../temples/incal.js';
import { PALETTE as MARKET } from '../temples/bazaar.js';

// The makers' runs in the open (docs/systems/challenges.md, src/trials/kit-data.js): the temples' own kit
// (src/temples/kit.js: halls, slabs, stairs, columns) and moving pieces (src/temples/pieces.js: Gust, Swing,
// Bank, Updraft, a Ball rolled onto its Plate, the singing EchoStone and the listening EchoEar) stood out in a world, in that world's temple palette. They stay there for good, run or no run: the
// wind-hall gusts and the crystals swing whether you are timing yourself or only passing (and the pieces are
// workings, so a foe feels them too). The pieces want a temple runtime; here a small stand-in (`openRuntime`)
// gives them the frame, the materials, the traveller and a logic that only says yes while a run asks it to (and
// keeps, as a temple's own logic does, where each ball has rolled and which plate it holds: `rt.roller`).
//
//   const course = buildKitCourse(T, { scene, physics, player, notice, sound, game })
//   course.gates, course.start, course.heading, course.markerAt (world)
//   course.bank      (the wind-hall's eyes: a Bank) · course.swings · course.gusts · course.updrafts
//   course.rollers   the balls in their grooves, each with its plate ({ ball, plate, home(), reset() })
//   course.stones · course.ears   the singing stones and the horns that listen for their notes ({ ear, note, lit(), reset() })
//   course.task      what the run asks once its gates are behind you: { kind: 'eyes' | 'roll' | 'ears', n, count(), goal }
//   course.solids()  the moving floors (the balls, the plates) for the traveller (src/player.js opts.dynamic)
//   course.listen(fn) the bank's eyes may wake (fn() → true) · course.reset() for a new run
//   course.update(dt, t) · course.dispose()

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PALETTES = { desert: DESERT, perdide: LORN, arzach: VAEL, buried: BURIED, spheres: SPHERES, incal: SHAFT, bazaar: MARKET };

/**
 * What a temple piece asks of its temple (src/temples/runtime.js), for a piece stood in the open. Its logic is
 * a temple's own (src/temples/logic.js TempleLogic, kept in memory, not in the save): the balls' places along
 * their grooves and the weights on the plates, for the pieces that roll and press (`roller`); nothing is ever
 * lit for good or opened, and a bank (or a horn) wakes only while a run is listening. game: the game's events
 * (the singing stones' 'note', the echo shell's 'echo': src/echo-shell.js).
 */
export function openRuntime({ scene, kit, M, P, player = null, notice = () => {}, sound = null, game = null }) {
  const root = new THREE.Group();
  root.name = `${kit.group.name} (pieces)`;
  scene?.add(root);
  const told = new Set();
  let listening = () => false;
  const logic = new TempleLogic({ id: 'open', rooms: {}, links: [], elements: {} }, { store: memoryStore(), has: () => true });
  logic.isLit = () => false; logic.isOpen = () => false; logic.check = () => true;
  const rt = {
    kit, M, P, root, player, sound, game, logic,
    /** What a piece that only answers a run says when it is woken with no run on (by element id). */
    deaf: {},
    listen(fn) { listening = fn ?? (() => false); },
    notice(text, key = null) {
      if (!text) return;
      if (key) { if (told.has(key)) return; told.add(key); }
      notice(text);
    },
    rumble() {}, onLit() {},
  };
  /** A bank woke whole, a horn heard its note: lit only while a run is listening (else it goes dark again). */
  logic.light = (id) => {
    if (listening()) return true;
    if (rt.deaf[id]) rt.notice(rt.deaf[id], 'deaf');
    return false;
  };
  return rt;
}

/**
 * A ball rolled onto a plate, stood in the open (the temples' Ball and Plate, src/temples/pieces.js, with their
 * logic: a drum and its plate). The ball lies in a straight groove from `a` to `b` (local, where it touches the
 * floor); the fluid's push rolls it along (a splash only nudges it), it settles into the plate's dip at `b`
 * and holds the plate down there. rt.add must be set (buildKitCourse does). o: { id, a, b, r, plateR }
 * → { id, ball, plate, home() (at rest on its plate), reset() (back to `a`, at rest) }
 */
export function addRoller(rt, { id, a, b, r = 1, plateR = r + 0.25 }) {
  const L = rt.logic, plateId = `${id}.plate`;
  L.def.elements[plateId] = { type: 'plate', room: 'open' };
  L.def.elements[id] = { type: 'drum', room: 'open', plate: plateId, plateAt: 1, start: 0, tolerance: 0.6 / Math.hypot(b[0] - a[0], b[2] - a[2]) };
  const plate = rt.add(Plate, { id: plateId, at: [b[0], b[1] - 0.04, b[2]], r: plateR });
  const ball = rt.add(Ball, { id, a, b, r });
  return {
    id, ball, plate,
    home: () => ball.rest && L.drumOn(id, plateId),
    reset() {
      L.store.set(`drum.${id}`, 0);
      ball.t = 0; ball.v = 0; ball.rest = true; ball.wobble = 0;
      ball.spin.rotation.set(0, 0, 0);
      ball.place();
    },
  };
}

/**
 * A horn that listens for one note, stood in the open (the temples' EchoEar, src/temples/pieces.js, a 'switch' of
 * the logic's): the note played back from the echo shell within `reach` wakes it, while a run listens; a new run
 * puts it to sleep again. A post you cannot walk through. o: { id, note, at, yaw, reach }
 * → { id, note, ear, lit(), reset() }
 */
export function addEar(rt, { id, note, at, yaw = 0, reach = 7 }) {
  rt.logic.def.elements[id] = { type: 'switch', room: 'open', needs: ['echo'] };
  rt.deaf[id] = 'The horn hears its note, and stays still. It answers someone running the relay: start at the sign.';
  const ear = rt.add(EchoEar, { id, note, at, yaw, reach });
  rt.kit.solid(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 8).translate(at[0], at[1] + 1.3, at[2]));
  return {
    id, note, ear,
    lit: () => ear.lit,
    reset() { ear.lit = false; ear.shrug = 0; },
  };
}

/** A singing stone stood in the open (the temples' EchoStone): splash it and it sings its note. Solid, on a ring. */
export function addStone(rt, { note, at, yaw = 0, h = 3.2 }) {
  const stone = rt.add(EchoStone, { note, at, yaw, h });
  const K = rt.kit, [x, y, z] = at;
  K.solid(new THREE.CylinderGeometry(0.62, 0.95, h, 10).translate(x, y + h / 2, z));
  K.add(K.M.trim, tf(annulus(1.0, 1.4, 0.06, 28), [x, y + 0.03, z]));
  return stone;
}

/** An old receiving dish of the market's (drawn only), facing `yaw` (0: +z), as the Undertower hangs them. */
function dish(K, x, y, z, r, yaw, tilt = 0) {
  const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * r; prof.push([Math.max(0.01, q), (q * q) / (4 * r * 0.7)]); }
  K.add(paint('#f5dfab', { smooth: true, side: THREE.DoubleSide }), tf(lathe(prof, 20).rotateX(-Math.PI / 2), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
  K.add(paint('#c99758'), tf(new THREE.TorusGeometry(r, 0.1, 4, 28).translate(0, 0, r / 2.8), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
  K.add(K.M.dark, tf(new THREE.ConeGeometry(0.22, 0.9, 8).rotateX(Math.PI / 2).translate(0, 0, r * 0.6), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
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
  /**
   * The sphere court (the Garden of Spheres): the Footprint's Hall of Spheres stood out on the meadow south of
   * the mirror lake, white as the garden's own. A plinth 12 m wide and 46 long; down its first half a slalom
   * past four great stone spheres, then a round dais between two grooves, a plate in each at the dais. One
   * white sphere lies at the near end of the west groove, one at the far end of the east, so each is rolled the
   * other way (the fluid's push: a splash only nudges one). Through the slalom to the far arch, then both
   * spheres home.
   */
  spherecourt(K, rt) {
    const W = 12, L = 46, D = 28, gx = 3.2, R = 1.1;
    K.slab(-W / 2, -1, W / 2, L, 0, 1.8, K.M.floor);
    K.slab(-2.6, -2.2, 2.6, -1, -0.25, 1.2, K.M.floor);   // (a step up onto it)
    for (const s of [-1, 1]) K.add(K.M.trim, box(0.35, 0.06, L + 1, s * (W / 2 - 0.18), 0.03, (L - 1) / 2));
    // the slalom: great stone spheres on rings, out from the west edge, then the east, turn and turn about
    const slalom = [5, 9.5, 14, 18.5].map((z, i) => ({ x: (i % 2 ? 1 : -1) * 2.6, z }));
    for (const { x, z } of slalom) {
      K.add(K.M.trim, tf(annulus(1.0, 1.5, 0.12, 28), [x, 0.06, z]));
      K.both(K.M.stoneMat, new THREE.SphereGeometry(1.25, 20, 14).translate(x, 1.2, z));
    }
    // the dais between the grooves, the grooves (a dark channel each), and the two white spheres to roll
    K.add(K.M.trim, tf(new THREE.CylinderGeometry(2.0, 2.0, 0.05, 32), [0, 0.025, D]));
    K.glyph([0, 0.06, D], 1.6, 0);
    const grooves = [{ id: 'west', a: 20, x: -gx }, { id: 'east', a: 40, x: gx }];
    for (const g of grooves) {
      const z0 = Math.min(g.a, D) - 1.2, z1 = Math.max(g.a, D) + 1.2;
      K.add(K.M.dark, box(0.7, 0.03, z1 - z0, g.x, 0.015, (z0 + z1) / 2));
      K.add(K.M.trim, box(1.4, 0.35, 0.3, g.x, 0.17, g.a < D ? D + R + 0.9 : D - R - 0.9));   // (the stop past its plate)
    }
    const rollers = grooves.map((g) => rt.roller({ id: g.id, a: [g.x, 0.04, g.a], b: [g.x, 0.04, D], r: R, plateR: 1.35 }));
    // the far arch, and a half-sunk sphere of the garden's beside the plinth
    for (const s of [-1, 1]) K.column(s * 2.8, L - 1.6, 0, 4.4, 0.4);
    K.both(K.M.wall, box(6.6, 0.6, 1.0, 0, 4.7, L - 1.6));
    K.glyph([0, 4.7, L - 2.12], 0.9, Math.PI);
    K.both(K.M.stoneMat, new THREE.SphereGeometry(2.6, 22, 14).translate(W / 2 + 2.6, -0.6, 8));
    return {
      // the gates: round the slalom's spheres (on the side away from each), then under the far arch
      gates: [...slalom.map(({ x, z }) => [-Math.sign(x) * 2.4, 1.6, z, 2.0]), [0, 1.6, L - 3, 2.6]],
      bank: null, gusts: [], swings: [], updrafts: [], rollers,
      rollGoal: 'roll the spheres home', rollFlash: 'Now the spheres: roll both onto their plates',
      bounds: [[-W / 2 - 1, -3, -3], [W / 2 + 6, 8, L + 1]],
      clear: [[-W / 2 - 1, -3], [W / 2 + 6, L + 1]],
    };
  },
  /**
   * The long look (the City-Shaft): the Warden's Well's stone ball stood on a makers' balcony that reaches out
   * from the rim over the shaft. A plinth on the rim, then three stones out over the drop with a gap between
   * each (a jump; the ball crosses on an iron rail), and at the end a frame of two columns round the view. The
   * ball lies on the rim at the head of its groove; roll it with the push the whole way out to the plate at the
   * end, walking out behind it. No parapet: down the shaft, and the run is over.
   */
  longlook(K, rt) {
    const w = 4.4, E = 13, R = 0.9, end = 37, plateZ = 35;   // (E: where the rim ends under it)
    const stones = [[E, 21], [22.8, 29], [30.8, end]];
    K.slab(-5, -3, 5, E + 0.4, 0, 1.4, K.M.floor);
    K.slab(-2.4, -4.2, 2.4, -3, -0.2, 0.8, K.M.floor);   // (a step up onto it)
    for (const [z0, z1] of stones) {
      K.slab(-w / 2, z0, w / 2, z1, 0, 0.9, K.M.floor);
      for (const s of [-1, 1]) K.add(K.M.trim, box(0.3, 0.06, z1 - z0, s * (w / 2 - 0.15), 0.03, (z0 + z1) / 2));
    }
    // the ball's rail across each gap, and its groove (a dark channel) from the rim to the plate
    for (let i = 1; i < stones.length; i++) { const a = stones[i - 1][1], b = stones[i][0]; K.both(K.M.dark, box(0.6, 0.5, b - a + 0.4, 0, -0.25, (a + b) / 2)); }
    K.add(K.M.dark, box(0.6, 0.03, plateZ - 4, 0, 0.015, (plateZ + 4) / 2));
    // struts under the first stone, down to the shaft's wall (drawn only)
    for (const s of [-1, 1]) {
      const a = [s * 1.6, -0.9, E + 6.5], b = [s * 1.6, -9, E - 0.3], dy = a[1] - b[1], dz = a[2] - b[2];
      K.add(K.M.trim, tf(new THREE.BoxGeometry(0.45, 0.45, Math.hypot(dy, dz)), [a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [-Math.atan2(dy, dz), 0, 0]));
    }
    // the frame round the view at the end, and a stop behind the plate
    for (const s of [-1, 1]) K.column(s * 1.75, end - 0.6, 0, 4.2, 0.32);
    K.both(K.M.wall, box(4.4, 0.5, 0.8, 0, 4.45, end - 0.6));
    K.glyph([0, 4.45, end - 1.02], 0.8, Math.PI);
    K.add(K.M.trim, box(1.2, 0.3, 0.3, 0, 0.15, plateZ + R + 0.8));
    const rollers = [rt.roller({ id: 'ball', a: [0, 0.04, 4], b: [0, 0.04, plateZ], r: R, plateR: 1.15 })];
    return {
      // the gates: on each stone out over the shaft (the ball in the middle: past it on either side)
      gates: [[0, 1.6, 17, 2.4], [0, 1.6, 26, 2.4], [0, 1.6, 33, 2.4]],
      bank: null, gusts: [], swings: [], updrafts: [], rollers,
      rollGoal: 'roll the ball home', rollFlash: 'Now the ball: roll it onto its plate',
      bounds: [[-5.5, -5, -5], [5.5, 7, end + 1]],
      clear: [[-5.5, -5], [5.5, end + 1]],
      // (the tests' measures: the first gap over the shaft, and every gap)
      gulf: { from: stones[0][1], to: stones[1][0] }, gaps: stones.slice(1).map(([z0], i) => [stones[i][1], z0]),
    };
  },
  /**
   * The echo relay (the Signal Market): the Undertower's singing stones and listening horns stood out on a makers'
   * plinth down the first side street west of the avenue. At the near end two stones (low, middle) and the high
   * note's horn; at the far end, under an arch, the high stone and the horns of the low and middle notes; between
   * them three listening walls hung with old dishes, out from each side in turn. Each horn wants its own stone's
   * note played back close by (the echo shell catches a note sung within 18 m and holds one at a time), and every
   * stone stands over 30 m from its horn: the notes are carried. Through the walls to the arch, then the relay.
   */
  echorelay(K, rt) {
    const W = 10, L = 46, sl = 6;
    K.slab(-W / 2, -1, W / 2, L, 0, 1.2, K.M.floor);
    K.slab(-2.6, -2.2, 2.6, -1, -0.17, 0.9, K.M.floor);   // (a step up onto it)
    for (const s of [-1, 1]) K.add(K.M.trim, box(0.35, 0.06, L + 1, s * (W / 2 - 0.18), 0.03, (L - 1) / 2));
    // the listening walls: out from the west edge, then the east, then the west, a way 4 m wide past each
    const walls = [16, 22.5, 29];
    walls.forEach((z, i) => {
      const side = i % 2 ? 1 : -1, x0 = side * W / 2, x1 = side * (W / 2 - sl), cx = (x0 + x1) / 2;
      K.both(K.M.wall, box(sl, 3.4, 0.8, cx, 1.7, z));
      K.both(K.M.trim, box(sl + 0.2, 0.3, 1.0, cx, 3.45, z));
      dish(K, cx, 1.9, z - 0.42, 1.1, Math.PI);
      dish(K, cx, 1.9, z + 0.42, 1.1, 0);
    });
    // a cable along the floor from the near stones to the far arch (drawn only, flat: nothing to trip on)
    K.add(K.M.dark, box(0.3, 0.04, L - 6, W / 2 - 0.7, 0.02, L / 2));
    // the near end: the low and middle stones (and, further on, the high note's horn)
    const stones = [addStone(rt, { note: 'low', at: [-3.4, 0, 4.2] }), addStone(rt, { note: 'mid', at: [3.4, 0, 4.2] })];
    // the far end: an arch, the high stone under it, the horns of the low and middle notes before it
    for (const s of [-1, 1]) K.column(s * 2.6, L - 1.4, 0, 4.6, 0.4);
    K.both(K.M.wall, box(6.2, 0.6, 1.0, 0, 4.9, L - 1.4));
    K.glyph([0, 4.9, L - 1.92], 0.9, Math.PI);
    dish(K, 0, 6.6, L - 1.4, 1.4, Math.PI, -0.5);
    stones.push(addStone(rt, { note: 'high', at: [0, 0, L - 2.6], yaw: Math.PI }));
    const ears = [
      rt.ear({ id: 'low', note: 'low', at: [-3.4, 0, 41], yaw: Math.PI }),
      rt.ear({ id: 'high', note: 'high', at: [4, 0, 10.5], yaw: 0 }),
      rt.ear({ id: 'mid', note: 'mid', at: [3.4, 0, 41], yaw: Math.PI }),
    ];
    return {
      // the gates: through the way past each wall, then before the arch at the far end
      gates: [[3, 1.6, walls[0], 2.0], [-3, 1.6, walls[1], 2.0], [3, 1.6, walls[2], 2.0], [0, 1.6, 37, 2.6]],
      bank: null, gusts: [], swings: [], updrafts: [], stones, ears,
      earGoal: 'wake the horns', earFlash: 'Now the horns: give each its own note back',
      bounds: [[-W / 2 - 1, -3, -3], [W / 2 + 1, 8, L + 1]],
      clear: [[-W / 2 - 1, -3], [W / 2 + 1, L + 1]],
    };
  },
};

/** Build a makers' run in its world (see the top of this file). */
export function buildKitCourse(T, { scene, physics, player = null, notice = () => {}, sound = null, game = null }) {
  const P = PALETTES[T.world] ?? DESERT;
  const M = templeMaterials(P);
  const [ox, oy, oz] = T.origin;
  const parent = new THREE.Group();
  parent.name = `Makers’ run: ${T.name}`;
  scene?.add(parent);
  const kit = new TempleKit(parent, T.name, V(ox, oy, oz), T.yaw ?? 0, M);
  const rt = openRuntime({ scene: parent, kit, M, P, player, notice, sound, game });
  const pieces = [];
  rt.add = (Piece, o) => { const p = new Piece(rt, o); pieces.push(p); return p; };
  rt.roller = (o) => addRoller(rt, o);
  rt.ear = (o) => addEar(rt, o);
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
  const rollers = C.rollers ?? [], ears = C.ears ?? [];
  const task = C.bank ? { kind: 'eyes', n: C.bank.eyes.length, count: () => C.bank.awake(), goal: 'wake the eyes' }
    : rollers.length ? { kind: 'roll', n: rollers.length, count: () => rollers.filter((r) => r.home()).length, goal: C.rollGoal ?? 'roll the balls home', flash: C.rollFlash ?? 'Now roll them onto their plates' }
    : ears.length ? { kind: 'ears', n: ears.length, count: () => ears.filter((e) => e.lit()).length, goal: C.earGoal ?? 'wake the horns', flash: C.earFlash ?? 'Now the horns: give each its note back' }
    : null;
  const solids = pieces.filter((p) => p.solid);
  return {
    trial: T, kit, rt, gates, start, heading: kit.heading(T.heading ?? 0), markerAt,
    bank: C.bank, swings: C.swings, gusts: C.gusts, updrafts: C.updrafts ?? [], gulf: C.gulf ?? null, pillars: (C.pillars ?? []).map((p) => ({ ...p, at: at(p.x, p.y, p.z) })), pieces,
    rollers, stones: C.stones ?? [], ears, task, gaps: C.gaps ?? [],
    solids: () => solids,
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
      for (const r of rollers) r.reset();
      for (const e of ears) e.reset();
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
