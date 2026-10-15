// A fight temple's rooms, built from its table (docs/design/fight-temples.md): the sand the hall is sunk in (flat in
// the rooms and their doorways, banked up behind the walls to their tops, dunes beyond), the walls (one mesh each, its
// own materials, so the one in the camera's way is seen through: rules.js SEE), the pillars, the ink springs the foes
// come up from, a gate in every doorway (a mover: it sinks into the floor when the room before it is cleared), the
// cistern's basin, the sanctum's altar and the reliquary that rises on it with the reward.

import * as THREE from 'three';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from '../minigames/kit/world.js';
import { WALL, ISO, wallBoxes, doorGap, inRoom } from './rules.js';

/** How far (x, z) is outside the nearest room or doorway (0 inside one), and the way out from it: { d, nx, nz }. */
export function outside(def, x, z) {
  let d = Infinity, nx = 0, nz = 0;
  const rects = [...def.rooms, ...def.doors.map((door) => doorGap(def.rooms, door))];
  for (const r of rects) {
    const dx = x < r.x[0] ? x - r.x[0] : x > r.x[1] ? x - r.x[1] : 0, dz = z < r.z[0] ? z - r.z[0] : z > r.z[1] ? z - r.z[1] : 0;
    const e = Math.hypot(dx, dz);
    if (e < d) { d = e; nx = e > 1e-9 ? dx / e : 0; nz = e > 1e-9 ? dz / e : 0; }
  }
  return { d, nx, nz };
}

/**
 * The sand's height: the floor (0) in the rooms, banked up to the walls' tops behind them, low dunes beyond. On the
 * camera's sides (the way out from the rooms toward it: ISO.yaw) the bank stands back past a trench (`trench` m), so a
 * wall cut down there opens the view to him instead of showing the sand behind it.
 */
export const BANK = { trench: 3.5, ramp: 3, facing: [-0.35, 0.55] };
const smooth = (e0, e1, v) => { const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
export function hallHeight(def, x, z, H = WALL.h, B = BANK) {
  const { d, nx, nz } = outside(def, x, z);
  if (d <= 0) return 0.03 * Math.sin(x * 0.9) * Math.sin(z * 0.7);
  // (how much the way out faces the camera: 0 away from it, 1 toward it, eased round the corners)
  const w = smooth(B.facing[0], B.facing[1], nx * Math.sin(ISO.yaw) + nz * Math.cos(ISO.yaw));
  const dune = (from) => (d > from ? (1.2 + Math.sin(x * 0.11 + z * 0.05) * 0.9 + Math.sin(z * 0.17 - x * 0.04) * 0.6) * Math.min(1, (d - from) / 10) : 0);
  const far = (H - 0.15) * Math.min(1, d / (WALL.t / 2)) + dune(2);
  const near = (H - 0.15) * smooth(B.trench, B.trench + B.ramp, d) + dune(B.trench + B.ramp);
  return far + (near - far) * w;
}

/** The box of a mesh standing on its foot (full height), in the world. */
const footBox = (x0, x1, z0, z1, h) => new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, h, z1));

/** A gate: five bars and a beam across a doorway (the gap's middle line), in the ink's dark. */
function gateModel(gap, side, P) {
  const g = new THREE.Group();
  const iron = makeMaterial({ color: P.ink, flat: true });
  const glow = makeMaterial({ color: P.glyph, flat: true, glow: 0.8 });
  const alongX = side === 'n' || side === 's';
  const w = alongX ? gap.x[1] - gap.x[0] : gap.z[1] - gap.z[0];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const s = -w / 2 + (w / (n - 1)) * i * 0.92 + w * 0.04;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, WALL.h - 0.2, 0.16), iron);
    bar.position.set(alongX ? s : 0, (WALL.h - 0.2) / 2, alongX ? 0 : s);
    g.add(bar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w : 0.3, 0.3, alongX ? 0.3 : w), iron);
  beam.position.y = WALL.h - 0.35;
  const mark = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w * 0.6 : 0.34, 0.08, alongX ? 0.34 : w * 0.6), glow);
  mark.position.y = WALL.h * 0.55;
  g.add(beam, mark);
  g.position.set((gap.x[0] + gap.x[1]) / 2, 0, (gap.z[0] + gap.z[1]) / 2);
  g.traverse((o) => { o.userData.noCollide = true; });   // (out of the level's bake: the session adds it as a mover)
  g.userData.mark = mark;
  return g;
}

/** The reliquary that rises on the altar with the reward: a small stone box, its lid of the palette's ember glass. */
export function reliquaryModel(P, glowColor) {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 0.5 });
  const glow = makeMaterial({ color: glowColor, flat: true, glow: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), stone); body.position.y = 0.35;
  const lid = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glow); lid.position.y = 1.2; lid.scale.set(1, 1.3, 1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 28), glow); ring.position.y = 1.2; ring.rotation.x = Math.PI / 2;
  const pad = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.45, 36).rotateX(-Math.PI / 2), glow); pad.position.y = 0.04;
  g.add(body, lid, ring, pad);
  g.traverse((o) => { o.userData.noCollide = true; });
  return Object.assign(g, { lid, ring });
}

/**
 * The temple's level (a minigame's build: yield between the big steps). `level.fight`: { def, cuttables: [{ mesh, box }],
 * gates: [{ door, group, gap }], springs: [[x, z]] by room, altar, rooms }.
 */
export function* buildHall(scene, def) {
  const P = def.palette;
  const terrain = yield* Terrain.make({
    size: 170, seg: 170, height: (x, z) => hallHeight(def, x, z),
    material: { color: P.floor, color2: P.floor2, color3: P.floor3, mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const STONE = { color: P.wall, color2: P.wall2, color3: P.wall3, mode: MODE_STRATA, strataSize: 1.1 };
  const CAP = { color: P.cap, color2: P.wall3, color3: P.wall3, mode: MODE_STRATA, strataSize: 0.6 };
  const GLYPH = { color: P.glyph, flat: true, glow: 0.6 };
  const stone = makeMaterial(STONE);
  const ink = makeMaterial({ color: P.ink, flat: true }), inkLite = makeMaterial({ color: P.inkLite, flat: true, glow: 0.25 });
  const group = new THREE.Group(); group.name = def.name;
  const cuttables = [];
  // (each wall and pillar its own materials, seen through on their own: materials.js SEE_HOLE, session.js; `see` their shares)
  const own = (o, id) => makeMaterial({ ...o, seeThrough: `${def.id}:${id}` });
  const seeOf = (...mats) => mats.map((m) => m.uniforms.uSeeK);
  // the walls: one mesh each (seen through where it stands in the way: SEE), a cap course along its top
  for (const [wi, w] of wallBoxes(def.rooms, def.doors).entries()) {
    const sx = w.x[1] - w.x[0], sz = w.z[1] - w.z[0], h = WALL.h;
    const geo = new THREE.BoxGeometry(sx, h, sz).translate(0, h / 2, 0);
    const wallMat = own(STONE, `w${wi}`), capMat = own(CAP, `w${wi}c`), glyphMat = own(GLYPH, `w${wi}g`);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set((w.x[0] + w.x[1]) / 2, 0, (w.z[0] + w.z[1]) / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.12, 0.22, sz + 0.12).translate(0, h + 0.11, 0), capMat);
    top.userData.noCollide = true;
    m.add(top);
    // an ember glyph band on the face toward its room, at shoulder height (the makers' mark, burnt in)
    const into = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[w.side];
    const len = (w.side === 'n' || w.side === 's' ? sx : sz) - 0.6;
    if (len > 2) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w.side === 'n' || w.side === 's' ? len : 0.04, 0.12, w.side === 'n' || w.side === 's' ? 0.04 : len), glyphMat);
      band.position.set(into[0] * (sx / 2 + 0.03), 2.2, into[1] * (sz / 2 + 0.03));
      band.userData.noCollide = true;
      m.add(band);
    }
    group.add(m);
    cuttables.push({ mesh: m, box: footBox(w.x[0], w.x[1], w.z[0], w.z[1], h + 0.3), k: 0, kind: 'wall', see: seeOf(wallMat, capMat, glyphMat) });
  }
  yield;
  // the pillars (solid, and seen through too when they stand in the way)
  const springs = [];
  let pi = 0;
  def.rooms.forEach((r, i) => {
    for (const [x, z] of r.pillars ?? []) {
      const h = WALL.h + 0.6, pillarMat = own(STONE, `p${pi}`), capMat = own(CAP, `p${pi++}c`);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, h, 10).translate(0, h / 2, 0), pillarMat);
      m.position.set(x, 0, z);
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 1.9).translate(0, h + 0.15, 0), capMat); c.userData.noCollide = true; m.add(c);
      group.add(m);
      cuttables.push({ mesh: m, box: footBox(x - 0.95, x + 0.95, z - 0.95, z + 0.95, h + 0.4), k: 0, kind: 'pillar', see: seeOf(pillarMat, capMat) });
    }
    // the ink springs: a dark pool ringed with stones, a pale ring on the ink
    springs[i] = (r.springs ?? []).map(([x, z]) => {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.2, 22).rotateX(-Math.PI / 2), ink); pool.position.set(x, 0.05, z);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.16, 5, 18).rotateX(Math.PI / 2), stone); lip.position.set(x, 0.07, z);
      const sheen = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 24).rotateX(-Math.PI / 2), inkLite); sheen.position.set(x, 0.07, z);
      for (const o of [pool, lip, sheen]) { o.userData.noCollide = true; group.add(o); }
      return new THREE.Vector3(x, 0, z);
    });
    // the cistern's basin: a low ring of stone round a pool of ink (walked over: no collision)
    if (r.basin) {
      const [x, z, rr] = r.basin;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(rr, 36).rotateX(-Math.PI / 2), ink); pool.position.set(x, 0.04, z);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.15, 0.22, 5, 36).rotateX(Math.PI / 2), stone); lip.position.set(x, 0.1, z);
      for (const o of [pool, lip]) { o.userData.noCollide = true; group.add(o); }
    }
    // a sigil drawn in ink on each room's floor: two rings and a cross
    const cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2, R = Math.min(r.x[1] - r.x[0], r.z[1] - r.z[0]) * 0.3;
    if (!r.basin) for (const [r0, r1] of [[R, R + 0.14], [R * 0.55, R * 0.55 + 0.1]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2), inkLite); m.position.set(cx, 0.045, cz); m.userData.noCollide = true; group.add(m); }
  });
  // the altar in the sanctum: a low stepped plinth (walked onto), the reliquary rises on it
  let altar = null;
  const last = def.rooms[def.rooms.length - 1];
  if (last.altar) {
    const [x, z] = last.altar;
    for (const [w, y] of [[4.2, 0.12], [3.2, 0.3]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, w).translate(0, y - 0.09, 0), stone); m.position.set(x, 0, z); m.userData.noCollide = true; group.add(m); }
    altar = new THREE.Vector3(x, 0.3, z);
  }
  // the gates in the doorways (movers: session.js)
  const gates = def.doors.map((door) => {
    const gap = doorGap(def.rooms, door);
    const g = gateModel(gap, door.side, P);
    group.add(g);
    return { door, gap, group: g };
  });
  scene.add(group);
  yield;
  const spawn = new THREE.Vector3(...def.spawn);
  return arenaLevel({
    ground: terrain, name: def.name, hour: def.hour, spawn,
    features: { mount: false, wind: false, jetpack: false, climb: false },
    // (src/foes.js: the game's own, on whatever the setting; no ink for the blade's growth, no chimes of their own (the
    // session drops its loot); the world's own foes: their desert skins and stage, partAt)
    foes: { own: true, wild: false, noInk: true, chimes: false, partAt: () => def.world },
    fight: { def, cuttables, gates, springs, altar, rooms: def.rooms, inRoom },
  });
}
