import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { put } from './levels/lab-kit.js';
import { TAU } from './levels/underwater-kit.js';

// ---------------------------------------------------------------------------
// The city that sings (the Underwater City, issue #192; docs/systems/worlds.md "The Underwater City's explorations").
// The city was built as an instrument for the whales: great brass horns open from its domes into the sea, organ pipes
// stand on the Plaza's and the Avenue's roofs, and three halls have a great pipe rising through the floor and out through
// the glass (PIPES), its stop wheel at its foot. Since the wrong note the city hums out of tune, and you see it: rings
// drawn in the water out of each pipe's horn, crossed and broken; bubbles rising out of time in the pipe's window; the
// pool beside it standing in a crossed ripple. Turn a pipe's wheel (src/story/underwater-ways.js) and it is in tune: its
// rings go out round and even, its bubbles rise in time, the pool's ripples run out from the middle, and its horn sounds.
// All three in tune, and only the Whale-House still hums the wrong note (the main quest's step: underwater.city.tuned).
// Its own dice (mulberry32(71194)).
// ---------------------------------------------------------------------------

/** The halls' great pipes: where they stand, which way their wheel faces (yaw), and their pool's middle and radius. */
export const PIPES = [
  { id: 'gallery', hall: 'gallery', name: 'the Gallery’s great pipe', at: [98, -117], face: 0.59, pool: [93, -119, 2.1] },
  { id: 'plaza', hall: 'plaza', name: 'the Plaza’s great pipe', at: [8, -134], face: -0.3, pool: [15, -138, 2.2] },
  { id: 'crown', hall: 'crown', name: 'the Crown’s great pipe', at: [0, -115], face: Math.PI / 2, pool: null },
];
/** The decorative horns out of the domes ([hall, yaw, height share of the dome]) and the roofs with organ pipes. */
export const HORNS = [['plaza', 1.0, 0.62], ['plaza', 1.9, 0.55], ['plaza', 4.3, 0.6], ['avenue', 0.9, 0.6], ['avenue', -2.3, 0.62], ['dock', -0.7, 0.62], ['gallery', Math.PI / 2, 0.55]];
export const ORGANS = [{ hall: 'plaza', n: 15, rr: 6.5, h: [4, 15] }, { hall: 'avenue', n: 11, rr: 5.5, h: [3, 10] }];
/** The rings out of a horn: how many, how far they go out (m) and how long that takes (s). */
export const RINGS = { n: 3, R: 18, life: 7, dashes: 26 };

const NS = { solid: false, shadow: false }, SOLID = { solid: true, shadow: true };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

/** The dome's height over hall d's floor at r m from its middle. */
const domeAt = (d, r) => d.y + d.r * d.sy * Math.sqrt(Math.max(0, 1 - (r / d.r) ** 2));

/** A brass horn: a neck out along `dir` from `base`, curving up, then its bell flaring to `mouth` round. Returns its mouth. */
export function horn(kit, mat, base, dir, { len = 4.5, neck = 0.42, mouth = 2.1, flare = 3.4, rise = 0.5 } = {}) {
  const d = dir.clone().setY(0).normalize(), end = base.clone().addScaledVector(d, len).add(V(0, len * rise, 0));
  const ctrl = base.clone().addScaledVector(d, len * 0.6);
  const curve = new THREE.QuadraticBezierCurve3(base, ctrl, end);
  kit.add(mat, new THREE.TubeGeometry(curve, 10, neck, 10), NS);
  const t = curve.getTangent(1).normalize();
  const prof = Array.from({ length: 9 }, (_, k) => { const u = k / 8; return new THREE.Vector2(neck + (mouth - neck) * u ** 3, u * flare); });
  const bell = new THREE.LatheGeometry(prof, 20);
  bell.applyQuaternion(_q.setFromUnitVectors(_up, t)).translate(end.x, end.y, end.z);
  kit.add(mat, bell, NS);
  kit.add(mat, new THREE.TorusGeometry(mouth, 0.09, 4, 24).rotateX(Math.PI / 2).applyQuaternion(_q).translate(end.x + t.x * flare, end.y + t.y * flare, end.z + t.z * flare), NS);
  return end.clone().addScaledVector(t, flare);
}

/** Dashed rings of the water's song round a point, one mesh each, moved by update(t, tuned). */
function ringSet(kit, mat, at, rng) {
  const dash = [];
  for (let k = 0; k < RINGS.dashes; k++) {
    const a = (k / RINGS.dashes) * TAU, len = (TAU / RINGS.dashes) * 0.55;
    dash.push(new THREE.BoxGeometry(len, 0.03, 0.03).rotateY(-a + Math.PI / 2).translate(Math.cos(a), 0, Math.sin(a)));
  }
  const geo = mergeAll(dash), rings = [];
  for (let i = 0; i < RINGS.n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.name = 'The song’s rings'; m.userData.noCollide = true; m.userData.floats = true; m.frustumCulled = false;
    kit.group.add(m); kit.noShadow.push(m);
    rings.push({ m, ph: i / RINGS.n, tilt: (rng() - 0.5) * 0.5, off: rng() * TAU });
  }
  const update = (t, tuned) => {
    for (const r of rings) {
      const u = ((t / RINGS.life + r.ph) % 1), R = 1 + u * RINGS.R;
      if (tuned) { r.m.position.copy(at); r.m.rotation.set(0, t * 0.05, 0); r.m.scale.set(R, 1 + u * 8, R); }
      else {
        // (out of tune: broken, wandering ellipses, crossing one another)
        const w = Math.sin(t * 1.7 + r.off) * 0.35;
        r.m.position.set(at.x + Math.sin(t * 0.9 + r.off) * 2.4, at.y + Math.cos(t * 1.3 + r.off) * 1.2, at.z + Math.cos(t * 0.7 + r.off) * 2.4);
        r.m.rotation.set(r.tilt + w * 0.4, t * 0.3 + r.off, r.tilt * -0.6);
        r.m.scale.set(R * (1 + w), 1 + u * 8, R * (1 - w));
      }
      r.m.visible = u < 0.97;
    }
  };
  return { update };
}

function mergeAll(list) {
  const pos = [];
  for (const g of list) { const p = (g.index ? g.toNonIndexed() : g).attributes.position; for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

/**
 * The singing city (kit: the city's kit, M its materials, halls: the city's halls). Returns { pipes: [{ id, name, hall,
 * at (its foot), stand (where you turn it from), wheel (its mesh), mouth (its horn's) }], tuned (Set of ids),
 * setTuned(id, on, instant), isTuned(), beacons, update(t, dt) }.
 */
export function buildSingingCity(kit, M, halls) {
  const rng = mulberry32(71194);
  const brass = kit.mat({ color: '#c9974a', flat: true, metal: 'brass' });
  const pale = kit.mat({ color: '#e6d6b2', flat: true, metal: 'brass' });
  const out = { pipes: [], tuned: new Set(), beacons: [] };
  const emitters = [], pools = [], rising = [];

  // ---- the great pipes: through the floor and out through the glass, a stop wheel at the foot, a window of bubbles
  for (const P of PIPES) {
    const d = halls[P.hall], [x, z] = P.at, y = d.y, rr = Math.hypot(x - d.x, z - d.z), top = domeAt(d, rr) + (P.hall === 'crown' ? 0.8 : 2.6);   // (the Crown's just under the surface)
    const R = 0.72, fx = Math.sin(P.face), fz = Math.cos(P.face);
    kit.add(brass, new THREE.CylinderGeometry(R, R, top - y, 16).translate(x, (y + top) / 2, z), SOLID);
    for (let b = y + 2.2; b < top - 0.5; b += 3.1) kit.add(pale, new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.22, 16).translate(x, b, z), NS);
    // its housing at the foot, the wheel on its face
    kit.add(brass, put(new THREE.BoxGeometry(1.9, 1.5, 1.9), x, y + 0.75, z, P.face), SOLID);
    kit.add(pale, put(new THREE.BoxGeometry(2.1, 0.16, 2.1), x, y + 1.55, z, P.face), NS);
    const wx = x + fx * 1.02, wz = z + fz * 1.02, wy = y + 1.15;
    const wheelGeo = mergeAll([
      new THREE.TorusGeometry(0.62, 0.06, 5, 22),
      ...Array.from({ length: 6 }, (_, k) => new THREE.BoxGeometry(0.06, 1.2, 0.05).rotateZ((k / 6) * Math.PI)),
      new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateX(Math.PI / 2),
      ...Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * TAU; return new THREE.SphereGeometry(0.07, 5, 4).translate(Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0); }),
    ]);
    const wheel = kit.mesh(wheelGeo, brass, NS);
    wheel.name = `The stop wheel (${P.id})`;
    wheel.position.set(wx, wy, wz); wheel.rotation.set(0, P.face, 0);
    kit.add(brass, put(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6).rotateX(Math.PI / 2), x + fx * 0.9, wy, z + fz * 0.9, P.face), NS);
    // the window up the pipe's face, luminous water behind its glass, bubbles in it
    const winH = Math.min(6, top - y - 3.4);
    kit.add(M.column, put(new THREE.PlaneGeometry(0.42, winH), x + fx * (R + 0.02), y + 2.0 + winH / 2, z + fz * (R + 0.02), P.face), NS);
    kit.add(pale, put(new THREE.BoxGeometry(0.58, winH + 0.2, 0.06), x + fx * (R - 0.01), y + 2.0 + winH / 2, z + fz * (R - 0.01), P.face), NS);
    for (let k = 0; k < 9; k++) rising.push({ id: P.id, x: x + fx * (R + 0.05), z: z + fz * (R + 0.05), y0: y + 2.1, h: winH - 0.2, u: rng(), s: 0.04 + rng() * 0.05, w: rng() * TAU, side: [Math.cos(P.face), -Math.sin(P.face)] });
    // its horn out into the sea: away from the hall's middle (the Crown's straight up, under the surface)
    const away = rr > 0.5 ? V(x - d.x, 0, z - d.z).normalize() : V(fx, 0, fz);
    const mouth = P.hall === 'crown' ? horn(kit, brass, V(x, top, z), away, { len: 1.4, rise: 0.8, mouth: 1.4, flare: 1.4 }) : horn(kit, brass, V(x, top, z), away, { len: 4.2, rise: 0.4, mouth: 2.3 });
    emitters.push({ id: P.id, set: ringSet(kit, M.bubble, mouth, rng) });
    kit.light(x + fx * 2, y + 2.6, z + fz * 2, 6);
    const stand = [x + fx * 2.1, y, z + fz * 2.1];
    out.pipes.push({ id: P.id, name: P.name, hall: P.hall, at: [x, y, z], stand, wheel, mouth: mouth.toArray(), top });
    out.beacons.push({ name: P.name, top: mouth.toArray(), height: 6 });

    // the pool beside it: a basin, its water, the standing ripples (a cross while out of tune, rings either way)
    if (P.pool) {
      const [px, pz, pr] = P.pool;
      kit.add(M.pier, new THREE.CylinderGeometry(pr + 0.35, pr + 0.45, 0.45, 28, 1, true).translate(px, y + 0.22, pz), SOLID);
      kit.add(M.rim, new THREE.TorusGeometry(pr + 0.4, 0.12, 5, 32).rotateX(Math.PI / 2).translate(px, y + 0.45, pz), SOLID);
      kit.add(M.column, new THREE.CircleGeometry(pr + 0.3, 28).rotateX(-Math.PI / 2).translate(px, y + 0.3, pz), SOLID);
      const ripples = [0.35, 0.65, 0.95].map(() => { const m = kit.mesh(new THREE.TorusGeometry(1, 0.025, 3, 36).rotateX(Math.PI / 2), M.bubble, NS); m.position.set(px, y + 0.33, pz); m.userData.floats = true; return m; });
      const cross = kit.mesh(mergeAll([new THREE.BoxGeometry(pr * 1.9, 0.02, 0.05).rotateY(Math.PI / 4), new THREE.BoxGeometry(pr * 1.9, 0.02, 0.05).rotateY(-Math.PI / 4),
        new THREE.BoxGeometry(pr * 1.4, 0.02, 0.04).rotateY(Math.PI / 4).translate(0.4, 0, 0.4), new THREE.BoxGeometry(pr * 1.4, 0.02, 0.04).rotateY(-Math.PI / 4).translate(-0.4, 0, 0.4)]), M.bubble, NS);
      cross.position.set(px, y + 0.33, pz); cross.userData.floats = true;
      pools.push({ id: P.id, r: pr, ripples, cross });
      kit.light(px, y + 1.2, pz, 5);
    }
  }

  // ---- the decorative horns out of the domes, and the organ pipes on the Plaza's and the Avenue's roofs
  for (const [hid, yaw, k] of HORNS) {
    const d = halls[hid], h = d.r * d.sy * k, rr = d.r * Math.sqrt(1 - k * k) + 0.3;
    const base = V(d.x + Math.sin(yaw) * rr, d.y + h, d.z + Math.cos(yaw) * rr);
    horn(kit, brass, base, V(Math.sin(yaw), 0, Math.cos(yaw)), { len: 3.4 + rng() * 1.6, rise: 0.25 + rng() * 0.3, mouth: 1.6 + rng() * 0.8, flare: 2.8 });
    kit.add(brass, new THREE.SphereGeometry(0.7, 10, 8).translate(base.x, base.y, base.z), NS);   // (its collar on the glass)
  }
  for (const O of ORGANS) {
    const d = halls[O.hall];
    for (let k = 0; k < O.n; k++) {
      const a = (k / O.n) * TAU, mid = 1 - Math.abs(k / (O.n - 1) - 0.5) * 2, hh = O.h[0] + (O.h[1] - O.h[0]) * (0.35 + 0.65 * mid) * (0.85 + rng() * 0.3);
      const px = d.x + Math.sin(a) * O.rr, pz = d.z + Math.cos(a) * O.rr, py = domeAt(d, O.rr) - 0.3, r = 0.32 + mid * 0.2;
      kit.add(k % 3 ? pale : brass, new THREE.CylinderGeometry(r, r, hh, 10).translate(px, py + hh / 2, pz), SOLID);
      kit.add(brass, new THREE.CylinderGeometry(r * 1.15, r * 0.9, 0.5, 10).translate(px, py + hh * 0.25, pz), NS);
      kit.add(M.post, new THREE.BoxGeometry(r * 0.9, r * 0.5, 0.04).rotateY(a).translate(px + Math.sin(a) * r * 1.01, py + hh * 0.18, pz + Math.cos(a) * r * 1.01), NS);   // (its mouth)
    }
  }

  // ---- the bubbles in the pipes' windows (one mesh)
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, rising.length);
  bub.name = 'The pipes’ bubbles'; bub.userData.noCollide = true; bub.userData.floats = true; bub.frustumCulled = false;
  kit.group.add(bub); kit.noShadow.push(bub);
  const _m = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const spin = new Map();   // id → { t0, from } while its wheel turns

  out.setTuned = (id, on = true, instant = false) => {
    if (on) out.tuned.add(id); else out.tuned.delete(id);
    const p = out.pipes.find((q) => q.id === id);
    if (p && on && !instant) spin.set(id, { t: 0 });
  };
  out.isTuned = () => out.pipes.every((p) => out.tuned.has(p.id));
  out.update = (t, dt = 1 / 60) => {
    for (const e of emitters) e.set.update(t, out.tuned.has(e.id));
    for (const P of pools) {
      const tuned = out.tuned.has(P.id);
      P.cross.visible = !tuned;
      P.cross.scale.setScalar(1 + Math.sin(t * 9) * 0.04);
      P.ripples.forEach((m, i) => {
        // (out of tune: standing, throbbing where they are; in tune: running out from the middle, one after another)
        const s = tuned ? (((t * 0.45 + i / 3) % 1) * P.r * 1.05 + 0.1) : (0.35 + i * 0.32) * P.r * (1 + Math.sin(t * 7 + i * 2.1) * 0.12);
        m.scale.set(s, 1, s);
      });
    }
    for (const [k, b] of rising.entries()) {
      const tuned = out.tuned.has(b.id);
      b.u = (b.u + dt * (tuned ? 0.22 : 0.08 + 0.5 * Math.abs(Math.sin(t * 3.1 + b.w)))) % 1;
      const j = tuned ? 0 : Math.sin(t * 13 + b.w) * 0.08;
      _p.set(b.x + b.side[0] * j, b.y0 + b.u * b.h, b.z + b.side[1] * j);
      bub.setMatrixAt(k, _m.compose(_p, _qq, _s.setScalar(b.s)));
    }
    bub.instanceMatrix.needsUpdate = true;
    for (const [id, s] of spin) {
      s.t += dt;
      const p = out.pipes.find((q) => q.id === id);
      p.wheel.rotation.z = -(Math.min(1, s.t / 2.4) ** 0.6) * TAU * 2;
      if (s.t > 2.4) spin.delete(id);
    }
  };
  out.update(0);
  return out;
}
