import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { put } from './levels/lab-kit.js';
import { lampPost, kelp, rock, UW_PAL, TAU } from './levels/underwater-kit.js';

// ---------------------------------------------------------------------------
// The walk on the seabed (the Underwater City, issue #192; docs/systems/worlds.md "The Underwater City's explorations").
// The divers go outside, and so can you: a brass helmet off the divers' rack in the Dock, out by the divers' lock, and
// the seabed between the domes is a place. Out there the helmet's air runs down (HELMET.air s: src/swim.js, the sea's
// `helmet`) and an air bell on its post gives it back (a pocket of air under its hood: the sea's `air`); the bells are
// the way, a line of brass lantern bollards on a chain between them, past the roots of a tower of pods and its door, a
// cart sunk in the sand, out to the lip of the canyon where the street goes down (src/underwater-canyon.js), and a whale
// passes overhead (src/levels/underwater.js: its loop over the lip). Nobody swims: in the helmet you walk the bed in
// heavy boots, and a fall sinks you slowly to it (swim.js).
//
//   lock(…)     a lock in a hall's glass: a brass drum out through it, a round door at each end, two doorways
//               (level.portals, the paper hand-over the lift has): in at the inner door, out at the outer, and back
//   bells       BELLS: brass posts with a glass hood of air over your head, bubbles rising out of the top, a lamp
//   bollards    lantern bollards every few metres along the way, a chain slung between them
// Its own dice (mulberry32(71193)).
// ---------------------------------------------------------------------------

/** The helmet: s of air outside, and how fast (m/s) you sink at most in it. */
export const HELMET = { air: 20, sink: 5 };
/** The divers' lock in the Dock's north-east glass (its yaw from the Dock's middle), and the Gallery's off the canyon street. */
export const LOCKS = { dock: { yaw: 2.2 }, gallery: { yaw: 0.12 } };
/** The air bells on the seabed walk, the canyon's floor and the far wall's terrace ([x, z]; their ground under them). */
export const BELLS = [[30, 66], [58, 40], [86, 10], [143, -72], [152, -112]];
/** The seabed walk, from the Dock's lock to the head of the canyon street ([x, z]: the bollards run beside it). */
export const SEABED_WAY = [[32.5, 103.5], [30, 70], [33, 58], [56, 44], [62, 36], [84, 14], [92, 0], [97, -22], [101, -30]];
/** The tower of pods whose door the walk passes (src/levels/underwater.js TOWERS[1]), and the sunken cart. */
export const POD_DOOR = { tower: [44, 80], r: 5.5, yaw: -Math.PI / 2 };
export const CART = { at: [46, 52], yaw: 0.7 };
/** The bell's air: round its post, from its foot to over your head. */
export const BELL_AIR = { r: 1.35, up: 2.7 };

const NS = { solid: false, shadow: false }, SOLID = { solid: true, shadow: true };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * A lock through hall `d`'s glass (d: { x, y, z, r }), toward yaw: a brass drum from inside the glass out `len` m, a
 * round door at each end, a lamp over each. `floorOut`: the floor's height outside at the outer door (a deck, the bed).
 * Returns { inner, outer: [x, y, z] (the doors' feet), yaw, portals: [in, out], air(x, y, z) (the drum's inside) }.
 */
export function lock(kit, M, brass, d, { yaw, len = 5.4, floorOut = d.y, label }) {
  const sx = Math.sin(yaw), sz = Math.cos(yaw), at = (r, y) => [d.x + sx * r, y, d.z + sz * r];
  const R = 2.3, mid = d.r + len / 2 - 0.6, [cx, , cz] = at(mid, 0), cy = Math.max(d.y, floorOut) + R;
  // the drum: brass bands round a shell of the hall's teal, along the yaw, standing on a plinth
  const drum = new THREE.CylinderGeometry(R, R, len, 20, 1, true).rotateX(Math.PI / 2);
  kit.add(M.frame, put(drum, cx, cy, cz, yaw), SOLID);
  for (const f of [-0.45, 0, 0.45]) kit.add(brass, put(new THREE.TorusGeometry(R + 0.06, 0.12, 5, 24), cx + sx * f * len, cy, cz + sz * f * len, yaw), NS);
  for (const k of [-1, 1]) kit.add(brass, put(new THREE.BoxGeometry(0.5, 0.4, len), cx + Math.cos(yaw) * k * 1.4, cy - R - 0.15, cz - Math.sin(yaw) * k * 1.4, yaw), NS);
  kit.add(M.pier, put(new THREE.BoxGeometry(R * 1.6, Math.max(0.4, cy - R - Math.min(d.y, floorOut) + 1.2), len - 0.6), cx, (cy - R + Math.min(d.y, floorOut) - 1.2) / 2, cz, yaw), SOLID);
  // the doors: a brass ring and a round door in it, the inner just inside the glass, the outer at the drum's end
  const doors = [at(d.r - 0.35, d.y), at(d.r + len - 0.55, floorOut)];
  for (const [i, [x, y, z]] of doors.entries()) {
    const face = i ? yaw : yaw + Math.PI, fx = Math.sin(face) * 0.08, fz = Math.cos(face) * 0.08;
    kit.add(brass, put(new THREE.TorusGeometry(1.3, 0.16, 6, 28), x + fx, y + 1.55, z + fz, face), NS);
    kit.add(M.frame, put(new THREE.CircleGeometry(1.18, 24), x + fx * 0.5, y + 1.55, z + fz * 0.5, face), NS);
    kit.add(M.windowLit, put(new THREE.CircleGeometry(0.34, 14), x + fx * 1.4, y + 1.95, z + fz * 1.4, face), NS);   // (its porthole, lit)
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; kit.add(brass, put(new THREE.SphereGeometry(0.07, 5, 4), x + fx * 1.5 + Math.cos(a) * Math.cos(face) * 1.0, y + 1.55 + Math.sin(a) * 1.0, z + fz * 1.5 - Math.cos(a) * Math.sin(face) * 1.0), NS); }
    kit.add(M.lamp, new THREE.SphereGeometry(0.2, 8, 6).translate(x + fx * 4, y + 3.3, z + fz * 4), NS);
    kit.light(x + fx * 8, y + 2.6, z + fz * 8, 6);
  }
  const inner = doors[0], outer = doors[1];
  const inAt = V(d.x + sx * (d.r - 1.3), d.y + 0.6, d.z + sz * (d.r - 1.3)), outAt = V(outer[0] + sx * 0.9, floorOut + 0.6, outer[2] + sz * 0.9);
  const inTo = V(outer[0] + sx * 3.4, floorOut + 0.1, outer[2] + sz * 3.4), outTo = V(d.x + sx * (d.r - 4.2), d.y + 0.1, d.z + sz * (d.r - 4.2));
  const portals = [
    { at: inAt, r: 1.25, to: inTo, heading: yaw, label: `${label}: out to the sea` },
    { at: outAt, r: 1.25, to: outTo, heading: yaw + Math.PI, label: `${label}: in from the sea` },
  ];
  // (the drum's inside is dry: its two doors are shut either side of it)
  const ax = d.x + sx * d.r, az = d.z + sz * d.r;
  const air = (x, y, z) => { const s = (x - ax) * sx + (z - az) * sz, side = (x - ax) * sz - (z - az) * sx; return s > -0.2 && s < len - 0.4 && Math.abs(side) < R && Math.abs(y - cy) < R; };
  return { inner, outer, yaw, portals, air, mid: [cx, cy, cz] };
}

/**
 * The seabed walk (kit: the city's kit, M its materials, H the ground; halls: the city's halls, for the locks;
 * gallery: the canyon street's bottom terrace's height). Returns { locks: { dock, gallery }, bells: [{ at, air }],
 * air(x, y, z) (the bells' and the drums' air), rack: { at, helmet (its mesh) }, sights, line, update(t) }.
 */
export function buildSeabedWalk(kit, M, H, { halls, galleryFloor, rack }) {
  const rng = mulberry32(71193);
  const brass = kit.mat({ color: '#c9974a', flat: true, metal: 'brass' });
  const hood = kit.mat({ color: UW_PAL.domeGlass, glass: true, glassCenter: V(60, 2, 40), line: 0.5, lineTint: 0.7, side: THREE.DoubleSide });
  const out = { sights: [], line: [], bells: [] };

  // ---- the locks: the Dock's, out of the north-east glass, and the Gallery's, off the canyon street's bottom terrace
  const dock = lock(kit, M, brass, halls.dock, { ...LOCKS.dock, floorOut: H(...outerXZ(halls.dock, LOCKS.dock.yaw, 5.4)) , label: 'the divers’ lock' });
  const gallery = lock(kit, M, brass, halls.gallery, { ...LOCKS.gallery, floorOut: galleryFloor, label: 'the Gallery’s lock' });
  out.locks = { dock, gallery };

  // ---- a helmet on the divers' rack's peg, the one you take (its mesh hidden once you have it)
  {
    const [x, z] = rack;
    const g = new THREE.Group();
    g.name = 'The divers’ helmet';
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), brass);
    const visor = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14).translate(0, 0, 0.271), M.bubble);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 14).translate(0, -0.27, 0), brass);
    g.add(shell, visor, collar);
    g.position.set(x - 2.6, 1.45, z + 0.35);
    g.traverse((o) => { o.userData.noCollide = true; o.userData.noBatch = true; });   // (hidden once taken, and copied onto his head: drawn by itself)
    kit.group.add(g);
    kit.add(M.frame, new THREE.BoxGeometry(0.1, 0.5, 0.1).translate(x - 2.6, 1.0, z + 0.3), NS);   // (its peg)
    out.rack = { at: [x - 2.6, 0, z + 1.2], helmet: g };
  }

  // ---- the air bells: a brass post, a glass hood of air at head height, bubbles out of its top, a lamp on the post
  const bubbles = [];
  const bell = (x, z, y = H(x, z)) => {
    kit.add(brass, new THREE.CylinderGeometry(0.5, 0.65, 0.25, 12).translate(x, y + 0.12, z), SOLID);
    kit.add(brass, new THREE.CylinderGeometry(0.11, 0.14, 2.9, 8).translate(x, y + 1.45, z), SOLID);
    // the hood: a glass bell open below, over where your head goes, a brass ring at its rim and a cap
    const hx = x + 0.75, hz = z;
    kit.add(hood, new THREE.SphereGeometry(0.62, 16, 8, 0, TAU, 0, Math.PI * 0.62).scale(1, 1.15, 1).translate(hx, y + 1.62, hz), NS);
    kit.add(brass, new THREE.TorusGeometry(0.58, 0.05, 4, 18).rotateX(Math.PI / 2).translate(hx, y + 1.33, hz), NS);
    kit.add(brass, new THREE.CylinderGeometry(0.1, 0.16, 0.18, 8).translate(hx, y + 2.38, hz), NS);
    kit.add(brass, new THREE.BoxGeometry(0.7, 0.08, 0.08).translate(x + 0.36, y + 2.42, z), NS);
    kit.add(M.lamp, new THREE.SphereGeometry(0.16, 8, 6).translate(x - 0.24, y + 2.0, z), NS);
    kit.add(brass, new THREE.CylinderGeometry(0.06, 0.2, 0.12, 8).translate(x - 0.24, y + 2.2, z), NS);
    kit.light(x, y + 2.2, z, 7);
    for (let k = 0; k < 7; k++) bubbles.push({ x: hx, y: y + 2.45, z: hz, ph: rng(), s: 0.05 + rng() * 0.07, w: rng() * TAU });
    const air = (px, py, pz) => (px - hx) ** 2 + (pz - hz) ** 2 < BELL_AIR.r ** 2 && py > y - 0.5 && py < y + BELL_AIR.up;   // (round the hood: where your head goes)
    out.bells.push({ at: [x, y, z], hood: [hx, y + 1.6, hz], air });
  };
  for (const [x, z] of BELLS) bell(x, z);
  out.bell = bell;

  // ---- the bollards: a lantern every few metres along the way, a chain slung from each to the next
  {
    const pts = SEABED_WAY.map(([x, z]) => V(x, 0, z)), curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength(), n = Math.floor(L / 8.5), posts = [];
    for (let k = 1; k < n; k++) {
      const t = k / n, p = curve.getPointAt(t), d = curve.getTangentAt(t), sx = d.z, sz = -d.x, m = Math.hypot(sx, sz) || 1;
      const x = p.x + (sx / m) * 2.3, z = p.z + (sz / m) * 2.3, y = H(x, z);
      if (out.bells.some((b) => Math.hypot(b.at[0] - x, b.at[2] - z) < 3)) continue;
      kit.add(brass, new THREE.CylinderGeometry(0.13, 0.17, 1.15, 8).translate(x, y + 0.57, z), SOLID);
      kit.add(M.lamp, new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8).translate(x, y + 1.3, z), NS);
      kit.add(brass, new THREE.CylinderGeometry(0.04, 0.2, 0.14, 8).translate(x, y + 1.5, z), NS);
      if (k % 2) kit.light(x, y + 1.4, z, 5);
      posts.push(V(x, y + 1.0, z));
    }
    for (let k = 1; k < posts.length; k++) {
      const a = posts[k - 1], b = posts[k];
      if (a.distanceTo(b) > 14) continue;
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.45;
      kit.add(brass, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 8, 0.03, 4), NS);
    }
    out.posts = posts.length;
  }

  // ---- the tower of pods' roots and its door at its foot, turned to the walk
  {
    const [tx, tz] = POD_DOOR.tower, r = POD_DOOR.r, a = POD_DOOR.yaw, sx = Math.sin(a), sz = Math.cos(a);
    const x = tx + sx * (r + 0.02), z = tz + sz * (r + 0.02), y = H(x, z);
    kit.add(brass, put(new THREE.TorusGeometry(1.05, 0.14, 6, 24), x, y + 1.25 + 0.45, z, a), NS);
    kit.add(M.shell.teal, put(new THREE.CircleGeometry(0.95, 22), x + sx * 0.03, y + 1.7, z + sz * 0.03, a), NS);
    kit.add(M.windowLit, put(new THREE.CircleGeometry(0.28, 12), x + sx * 0.05, y + 2.0, z + sz * 0.05, a), NS);
    for (let k = 0; k < 3; k++) kit.add(M.pier, put(new THREE.BoxGeometry(2.0, 0.25 * (k + 1), 0.5), x + sx * (1.4 - k * 0.45), y + 0.125 * (k + 1) - 0.1, z + sz * (1.4 - k * 0.45), a), SOLID);
    kit.light(x + sx * 1.5, y + 2.6, z + sz * 1.5, 6);
    lampPost(kit, M, x + sx * 1.6 + Math.cos(a) * 1.5, y, z + sz * 1.6 - Math.sin(a) * 1.5, { h: 2.6, r: 6 });
    // its roots: buttresses of the tower's stone spreading over the sand
    for (let k = 0; k < 7; k++) {
      const b = (k / 7) * TAU + 0.3;
      if (Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) < 0.5) continue;
      const ex = tx + Math.sin(b) * (r + 3.2), ez = tz + Math.cos(b) * (r + 3.2);
      kit.add(M.tower[k % M.tower.length], new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(tx + Math.sin(b) * (r - 0.4), H(tx, tz) + 3.4, tz + Math.cos(b) * (r - 0.4)), V(tx + Math.sin(b) * (r + 1.8), H(ex, ez) + 1.2, tz + Math.cos(b) * (r + 1.8)), V(ex, H(ex, ez) - 0.3, ez)), 8, 0.7, 6), SOLID);
    }
    out.sights.push({ name: 'the pod tower’s door', at: [x + sx * 1.6, y, z + sz * 1.6] });
  }

  // ---- the cart sunk in the sand: a market cart on its side, a wheel up, its load spilled
  {
    const [x, z] = CART.at, y = H(x, z), a = CART.yaw;
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, a, 1.15)).setPosition(x, y + 0.55, z);
    kit.add(M.rim, new THREE.BoxGeometry(2.6, 0.9, 1.6).applyMatrix4(tilt), SOLID);
    kit.add(M.frame, new THREE.BoxGeometry(2.7, 0.12, 1.7).translate(0, 0.5, 0).applyMatrix4(tilt), NS);
    for (const e of [-1, 1]) kit.add(M.post, new THREE.TorusGeometry(0.62, 0.08, 5, 18).translate(0.6, -0.1, e * 0.9).applyMatrix4(tilt), NS);
    kit.add(M.post, new THREE.BoxGeometry(0.08, 0.08, 2.2).rotateY(0.4).translate(x + 1.9, y + 0.12, z + 0.6), NS);
    for (let k = 0; k < 5; k++) kit.add(k % 2 ? M.shell.pink : M.tank, new THREE.SphereGeometry(0.2 + rng() * 0.15, 8, 6).translate(x - 1.6 + rng() * 1.5, y + 0.12, z + 1.0 + rng() * 1.4), NS);
    kelp(kit, M, rng, [x + 1.6, y, z - 1.8], { n: 5, h: 5 + rng() * 3, spread: 1.6 });
    out.sights.push({ name: 'the sunken cart', at: [x, y, z] });
  }
  // a little kelp and rock along the way, clear of it
  for (let i = 0; i < 12; i++) {
    const k = 1 + Math.floor(rng() * (SEABED_WAY.length - 2)), [ax, az] = SEABED_WAY[k], [bx, bz] = SEABED_WAY[k + 1], t = rng();
    const dx = bx - ax, dz = bz - az, m = Math.hypot(dx, dz) || 1, e = rng() < 0.5 ? -1 : 1, off = 6 + rng() * 8;
    const x = ax + dx * t + (dz / m) * e * off, z = az + dz * t - (dx / m) * e * off, y = H(x, z);
    if (i % 3) kelp(kit, M, rng, [x, y, z], { n: 4 + Math.floor(rng() * 3), h: 7 + rng() * 7, spread: 2 });
    else rock(kit, M, x, y, z, 1.4 + rng() * 1.6, 500 + i);
  }

  // the bells' bubbles, rising out of their tops (one mesh of small discs, moved by one mover)
  {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, bubbles.length);
    mesh.name = 'The air bells’ bubbles'; mesh.userData.noCollide = true; mesh.userData.floats = true; mesh.frustumCulled = false;
    kit.group.add(mesh); kit.noShadow.push(mesh);
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
    out.update = (t) => {
      for (const [k, b] of bubbles.entries()) {
        const u = (b.ph + t * 0.16) % 1;
        _p.set(b.x + Math.sin(t * 2 + b.w) * 0.12 * u, b.y + u * 7, b.z + Math.cos(t * 1.7 + b.w) * 0.12 * u);
        mesh.setMatrixAt(k, _m.compose(_p, _q, _s.setScalar(b.s * (1 + u))));
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    out.update(0);
  }

  out.air = (x, y, z) => out.bells.some((b) => b.air(x, y, z)) || dock.air(x, y, z) || gallery.air(x, y, z);
  out.line = [dock.portals[0].at.toArray(), dock.portals[0].to.toArray(), ...SEABED_WAY.slice(1).map(([x, z]) => [x, H(x, z), z])];
  return out;
}

/** The ground point (x, z) just past a lock's outer door. */
function outerXZ(d, yaw, len) { return [d.x + Math.sin(yaw) * (d.r + len + 1), d.z + Math.cos(yaw) * (d.r + len + 1)]; }
