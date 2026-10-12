import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise.js';
import { makeMaterial, MODE_WATER } from './materials.js';
import { jitter } from './world.js';
import { buildRoom, portalPair } from './interiors.js';

// Viridel's fallen things (issue #189, after references/levels/Viridel/environment/explorations/fallen-things): Odile and
// Talo's ship is not the only thing the garden has kept. Between it and the Greenhouse's water, everything that ever fell
// here lies grown over: an old round ship under a hill of flowers, a tree out of its top and its hatch ajar under the
// roots, a lit cabin behind it; a great dish turned pond; a meteor split open with a garden in it; and a builders' machine
// on its side, its flank grown as terraces you climb. (The valley itself is the oldest fall: its walls are a crater's rim,
// src/levels/edena.js.) All of it collides as drawn but its flowers, the dish's water and the hatch's dark. No rng but
// its own: what stands round it stays where it was.
//
//   buildWrecks(scene, terrain, { blocked }) → { portals, room, sights, lights, hatch, avoid(x, z, r), pieces, crowded }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const prep = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; };

/** Where each lies: the round ship's hill (r m, `h` high, its hatch facing `face`), the dish, the meteor, the machine. */
export const WRECKS = {
  round: { x: 142, z: -70, r: 17, h: 10.5, face: -Math.PI / 2 - 0.15 },
  dish: { x: 130, z: -150, r: 12, depth: 2.6, tilt: 0.24 },
  meteor: { x: -12, z: 44, r: 7.5, gap: 4.5 },
  machine: { x: 8, z: -130, len: 26, w: 9, yaw: 0.5, tiers: 5, rise: 1.95 },
};
/** The round ship's cabin, far overhead (the portal takes you in). */
export const ROUND_ROOM = { pos: [40, 1500, 0], w: 5, d: 6, h: 3 };

export function buildWrecks(scene, terrain, { blocked = () => false } = {}) {
  const H = (x, z) => terrain.heightAt(x, z), rng = mulberry32(189);
  const grass = makeMaterial({ color: '#a9d48e', color2: '#c4e2a2', flat: true });
  const cream = makeMaterial({ color: '#f3ead8', flat: true, grid: 1.5, metal: 'painted' });
  const tealM = makeMaterial({ color: '#62c3c9', flat: true, metal: 'painted' });
  const dark = makeMaterial({ color: '#2b211f' });
  const water = makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER });
  const flowers = [];   // { at, c, s }: one instanced pool over everything, drawn only
  const sights = [], pieces = {};
  const add = (geo, mat, name, o = {}) => { const m = new THREE.Mesh(geo, mat); m.name = name; Object.assign(m.userData, o); scene.add(m); return m; };
  const FL = ['#f2a7b5', '#9fd6c9', '#f6c7a0', '#b5a7e6', '#f2c54b', '#ffffff'];
  // (what of the meadow's scatter stands where one of them lies: none, checked by the tests)
  const crowded = Object.entries(WRECKS).filter(([, w]) => blocked(w.x, w.z, (w.r ?? w.len / 2) + (w.gap ?? 0))).map(([id]) => id);

  // ---- the round ship under its hill of flowers, a tree out of its top, its hatch ajar on the west flank
  const R = WRECKS.round;
  {
    const gy = H(R.x, R.z) - 0.5;   // (its middle a little sunk; the dome's skirt runs on down under the meadow round it)
    // the hill: a squashed dome down into the meadow (the ship's round hull under the turf)
    const hill = new THREE.SphereGeometry(R.r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.7).scale(1, R.h / R.r, 1).translate(R.x, gy - 0.4, R.z);
    jitter(hill, 0.02, 0.05, 11);
    add(prep(hill), grass, 'The round ship’s hill');
    // the hull's rim showing through on the west flank: a cream ring, a teal band, the round hatch in it
    const fx = Math.sin(R.face), fz = Math.cos(R.face);
    // the hatch's middle on the hill's surface, 1.6 m over the ground at its foot
    const foot = V(R.x + fx * (R.r - 1.2), 0, R.z + fz * (R.r - 1.2));
    foot.y = H(foot.x, foot.z);
    const c = V(foot.x, foot.y + 1.6, foot.z);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(fx, 0.12, fz).normalize());
    const ring = new THREE.Group();
    ring.position.copy(c); ring.quaternion.copy(q);
    ring.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.2, 28, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.6), cream));
    ring.add(new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.32, 6, 28).translate(0, 0, 0.45), tealM));
    ring.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.18, 6, 24).translate(0, 0, 0.42), cream));
    const back = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28).translate(0, 0, -1.7), cream);
    ring.add(back);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20).translate(0, 0, 0.3), dark);
    hole.userData.noCollide = true;
    ring.add(hole);
    // the door, swung out on its hinge, a little light from inside on it
    const door = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.16, 20).rotateX(Math.PI / 2).translate(1.42, 0, 0.08), makeMaterial({ color: '#e6875f', flat: true, metal: 'painted' }));
    door.position.set(1.45, 0, 0.42); door.rotation.y = 1.9;
    ring.add(door);
    ring.add(Object.assign(new THREE.Mesh(new THREE.CircleGeometry(0.9, 16).translate(0, 0, 0.36), makeMaterial({ color: '#f6d98a', glow: 0.6 })), { userData: { noCollide: true } }));
    ring.children.at(-1).scale.set(0.6, 0.6, 1);
    ring.name = 'The round ship’s hatch';
    scene.add(ring);
    // a porthole further round, peeping out of the grass
    const pa = R.face + 0.9, pp = V(R.x + Math.sin(pa) * (R.r - 0.9), 0, R.z + Math.cos(pa) * (R.r - 0.9));
    pp.y = H(pp.x, pp.z) + 1.4;
    const port = new THREE.Group();
    port.position.copy(pp); port.quaternion.setFromUnitVectors(V(0, 0, 1), V(Math.sin(pa), 0.3, Math.cos(pa)).normalize());
    port.add(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.22, 6, 20), cream));
    port.add(Object.assign(new THREE.Mesh(new THREE.CircleGeometry(0.85, 18), makeMaterial({ color: '#5a77a8', glow: 0.15 })), { userData: { noCollide: true } }));
    scene.add(port);
    // the tree out of the top: its roots over the hull, a broad canopy
    const top = V(R.x + 1.5, gy - 0.4 + R.h - 0.6, R.z - 1);
    const trunk = new THREE.CylinderGeometry(1.4, 2.6, 22, 9, 6).translate(0, 11, 0);
    jitter(trunk, 0.08, 0.05, 7);
    const roots = [];
    for (let i = 0; i < 7; i++) {
      const ra = (i / 7) * Math.PI * 2 + 0.3, len = 6 + rng() * 5;
      const p0 = V(0, 0.8, 0), p2 = V(Math.cos(ra) * len, -R.h * 0.35 * (len / R.r) - 0.4, Math.sin(ra) * len), p1 = V(Math.cos(ra) * len * 0.5, 0.6, Math.sin(ra) * len * 0.5);
      roots.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 8, 0.32, 5).toNonIndexed());
    }
    add(prep(trunk.translate(top.x, top.y - 0.5, top.z)), makeMaterial({ color: '#c98a76', flat: true, detail: 'organic' }), 'The round ship’s tree');
    add(mergeGeometries(roots.map((g) => prep(g.translate(top.x, top.y, top.z)))), makeMaterial({ color: '#b98a6c', flat: true }), 'The round ship’s tree’s roots', { noCollide: true, flora: true });
    const canopy = new THREE.CylinderGeometry(15, 13.5, 3.2, 22).translate(top.x + 1, top.y + 21.5, top.z);
    jitter(canopy, 0.06, 0.2, 5);
    add(prep(canopy), makeMaterial({ color: '#7fcfa8', color2: '#f2a7b5', flat: true }), 'The round ship’s tree’s crown');
    // flowers over the hill (pink, mint, peach, lavender), thick round the hatch
    for (let i = 0; i < 260; i++) {
      const fa = rng() * Math.PI * 2, fr = Math.sqrt(rng()) * (R.r - 0.6), px = R.x + Math.cos(fa) * fr, pz = R.z + Math.sin(fa) * fr;
      const hy = gy - 0.4 + R.h * Math.sqrt(Math.max(0, 1 - (fr / R.r) ** 2));
      if (Math.hypot(px - c.x, pz - c.z) < 2.9) continue;
      flowers.push({ at: V(px, Math.max(hy, H(px, pz)) + 0.05, pz), c: FL[i % 4], s: 0.9 + rng() * 0.8 });
    }
    // the cabin inside: round-walled, the lamp still lit, two cups, a drawing pinned by the bunk (the thing to look at)
    const room = buildRoom(scene, {
      pos: V(...ROUND_ROOM.pos), w: ROUND_ROOM.w, d: ROUND_ROOM.d, h: ROUND_ROOM.h,
      wall: { color: '#f3ead8', color2: '#62c3c9', grid: 0.5 }, floor: '#62c3c9', ceiling: '#e9e3d4',
      windows: [{ side: 'left', x: 3, y: 1.2, w: 0.8, h: 0.8 }],
      furniture: [['bunk', -1.4, -1.2, 0, '#8a5a3c', '#f2a7b5'], ['table', 1.0, -1.5, 0, '#e9e3d4'], ['seat', 1.2, -0.3, Math.PI, '#d9643a'], ['pot', -1.6, 1.6]],
      lamp: '#f6d98a',
    });
    room.group.updateMatrixWorld(true);
    const heading = Math.atan2(fx, fz);
    const threshold = V(c.x + fx * 1.2, foot.y, c.z + fz * 1.2);
    threshold.y = H(threshold.x, threshold.z);
    const portals = portalPair({ at: threshold, heading, room });
    for (const p of portals) p.label = 'the round ship’s hatch';
    pieces.round = { hill: V(R.x, gy, R.z), top: V(top.x, top.y, top.z), hatch: threshold, ring, room, portals, drawing: room.group.localToWorld(V(-1.4, 1.4, -2.6)) };
    // (the tree's foot, on the hill's crown among its roots: a look out over the fallen things)
    sights.push({ name: 'the round ship’s tree', at: V(top.x - 3, gy - 0.4 + R.h * Math.sqrt(1 - (Math.hypot(top.x - 3 - R.x, top.z - R.z) / R.r) ** 2), top.z) });
  }

  // ---- the great dish, fallen face up and full of rain: a pond, its feed horn still up on three struts
  const Dd = WRECKS.dish;
  {
    const prof = [];
    for (let i = 0; i <= 12; i++) { const r = (i / 12) * Dd.r; prof.push(new THREE.Vector2(r, Dd.depth * (r / Dd.r) ** 2)); }
    for (let i = 12; i >= 0; i--) { const r = (i / 12) * Dd.r; prof.push(new THREE.Vector2(r + (i === 12 ? 0.4 : 0), Dd.depth * (r / Dd.r) ** 2 - 0.35)); }
    const shell = new THREE.LatheGeometry(prof, 36);
    const tilt = new THREE.Matrix4().makeRotationAxis(V(1, 0, 0.4).normalize(), Dd.tilt);
    // (set down so its underside clears the meadow everywhere: the low rim just over the grass, the high one up on its mount)
    const at0 = new THREE.Matrix4().makeTranslation(Dd.x, 0, Dd.z).multiply(tilt);
    let lift = -Infinity;
    for (const fr of [0, 0.33, 0.66, 1]) for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = fr * Dd.r, p = V(Math.cos(a) * r, Dd.depth * fr * fr - 0.35, Math.sin(a) * r).applyMatrix4(at0); lift = Math.max(lift, H(p.x, p.z) + 0.1 - p.y); }
    const base = new THREE.Matrix4().makeTranslation(0, lift, 0).multiply(at0);
    add(prep(shell.applyMatrix4(base)), makeMaterial({ color: '#f2efe6', flat: true, grid: 2, side: THREE.DoubleSide }), 'The dish pond');
    const bottom = V(0, -0.35, 0).applyMatrix4(base);
    add(prep(new THREE.CylinderGeometry(1.1, 1.6, bottom.y - H(bottom.x, bottom.z) + 1, 10).translate(bottom.x, (bottom.y + H(bottom.x, bottom.z) - 1) / 2, bottom.z)), cream, 'The dish pond’s mount');
    // the water: level, a little under the low rim (you wade into the bowl), out to where the level meets the bowl
    const surf = (r, a) => V(Math.cos(a) * r, Dd.depth * (r / Dd.r) ** 2, Math.sin(a) * r).applyMatrix4(base);
    const rimLow = Math.min(...Array.from({ length: 36 }, (_, i) => surf(Dd.r, (i / 36) * Math.PI * 2).y));
    const wy = rimLow - 0.3, ring = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      let lo = 0, hi = Dd.r;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (surf(mid, a).y < wy) lo = mid; else hi = mid; }
      ring.push(surf(lo, a).setY(wy));
    }
    const mid = ring.reduce((s, p) => s.add(p), V()).multiplyScalar(1 / ring.length);
    const wpos = [];
    for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; wpos.push(mid.x, wy, mid.z, q.x, wy, q.z, p.x, wy, p.z); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wg.computeVertexNormals();
    add(wg, water, 'The dish pond’s water', { noCollide: true, water: true });
    // the feed horn on three struts
    const hub = V(0, Dd.depth + 7, 0).applyMatrix4(base);
    const struts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4, p = V(Math.cos(a) * Dd.r * 0.82, Dd.depth * 0.82 * 0.82, Math.sin(a) * Dd.r * 0.82).applyMatrix4(base);
      const d = hub.clone().sub(p), len = d.length();
      struts.push(new THREE.CylinderGeometry(0.16, 0.2, len, 6).translate(0, len / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())).translate(p.x, p.y, p.z));
    }
    struts.push(new THREE.CylinderGeometry(0.5, 0.9, 1.6, 10).translate(hub.x, hub.y, hub.z));
    add(mergeGeometries(struts.map(prep)), cream, 'The dish pond’s feed horn');
    for (let i = 0; i < 60; i++) { const a = rng() * Math.PI * 2, r = Dd.r + 0.6 + rng() * 2.5, px = Dd.x + Math.cos(a) * r, pz = Dd.z + Math.sin(a) * r; flowers.push({ at: V(px, H(px, pz) + 0.05, pz), c: FL[(i + 1) % 5], s: 0.9 + rng() * 0.6 }); }
    pieces.dish = { at: V(Dd.x, wy, Dd.z), water: wy };
    sights.push({ name: 'the dish pond', at: V(Dd.x, wy, Dd.z) });
  }

  // ---- the split meteor: two halves fallen open, violet inside, a garden grown between them
  const Mt = WRECKS.meteor;
  {
    const rock = makeMaterial({ color: '#b8aa9e', color2: '#9a8c84', flat: true, detail: 'rock' });
    const inner = makeMaterial({ color: '#8f7cc0', color2: '#b5a7e6', flat: true, side: THREE.BackSide });
    for (const s of [-1, 1]) {
      const g = new THREE.SphereGeometry(Mt.r, 16, 12, 0, Math.PI);   // (half a sphere, split by the plane x = 0)
      jitter(g, 0.05, 0.08, 23 + s);
      const cx = Mt.x + s * Mt.gap / 2, gy = H(cx, Mt.z);
      // (the half z >= 0 turned to face the split: the east one opens west; each leans out a little)
      const m = new THREE.Matrix4().makeTranslation(cx, gy + Mt.r * 0.45, Mt.z).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.28)).multiply(new THREE.Matrix4().makeRotationY(s > 0 ? Math.PI / 2 : -Math.PI / 2));
      const geo = prep(g.applyMatrix4(m));
      add(geo, rock, `The split meteor (${s > 0 ? 'east' : 'west'} half)`);
      add(geo.clone(), inner, `The split meteor’s inside (${s > 0 ? 'east' : 'west'} half)`, { noCollide: true });
    }
    // the garden in the split: flowers thick, a little umbrella tree
    for (let i = 0; i < 70; i++) { const px = Mt.x + (rng() - 0.5) * Mt.gap * 1.2, pz = Mt.z + (rng() - 0.5) * Mt.r * 1.5; flowers.push({ at: V(px, H(px, pz) + 0.05, pz), c: FL[i % 6], s: 1 + rng() * 0.7 }); }
    const ty = H(Mt.x, Mt.z);
    add(prep(new THREE.CylinderGeometry(0.3, 0.45, 5, 7).translate(Mt.x, ty + 2.5, Mt.z + 1)), makeMaterial({ color: '#c98a76', flat: true }), 'The split meteor’s tree', { noCollide: true, flora: true });
    add(prep(new THREE.CylinderGeometry(3.2, 2.9, 0.7, 14).translate(Mt.x, ty + 5.2, Mt.z + 1)), makeMaterial({ color: '#f2a7b5', color2: '#f6c7a0', flat: true }), 'The split meteor’s tree’s crown', { noCollide: true, flora: true });
    pieces.meteor = { at: V(Mt.x, ty, Mt.z) };
    sights.push({ name: 'the split meteor', at: V(Mt.x, ty, Mt.z - Mt.r - 1) });
  }

  // ---- the builders' machine on its side: a long white body sunk in the meadow, its flank grown as terraces
  const Mc = WRECKS.machine;
  {
    const fx = Math.sin(Mc.yaw), fz = Math.cos(Mc.yaw), sx = fz, sz = -fx;   // (along it; across it)
    const gLow = Math.min(...[-1, 0, 1].flatMap((a) => [-1, 1].map((b) => H(Mc.x + fx * a * Mc.len / 2 + sx * b * Mc.w / 2, Mc.z + fz * a * Mc.len / 2 + sz * b * Mc.w / 2))));
    const F = new THREE.Matrix4().makeRotationY(Mc.yaw).setPosition(Mc.x, gLow - 0.8, Mc.z);
    const body = [], ribs = [], beds = [];
    // the terraces: one tier a stride over the last, from the meadow up across its flank (local x across, z along)
    const tw = Mc.w / Mc.tiers;
    for (let i = 0; i < Mc.tiers; i++) {
      const top = 0.8 + (i + 1) * Mc.rise, x0 = -Mc.w / 2 + i * tw;
      body.push(new THREE.BoxGeometry(tw, top, Mc.len).translate(x0 + tw / 2, top / 2, 0));
      beds.push(new THREE.BoxGeometry(tw - 0.6, 0.25, Mc.len - 1.2).translate(x0 + tw / 2, top + 0.125, 0));
    }
    const topY = 0.8 + Mc.tiers * Mc.rise;
    // fins down its high side (the machine's underside, turned to the meadow), from the ground to its top
    for (let k = -2; k <= 2; k++) ribs.push(new THREE.BoxGeometry(0.4, topY, 0.7).translate(Mc.w / 2 + 0.2, topY / 2, k * 5.6));
    // the round port at its end
    const port = new THREE.TorusGeometry(2.2, 0.35, 6, 22).translate(Mc.w * 0.25, topY * 0.5, Mc.len / 2 + 0.2);
    add(mergeGeometries(body.map((g) => prep(g.applyMatrix4(F)))), makeMaterial({ color: '#f7f4ec', flat: true, grid: 3, glyphs: true }), 'The builders’ machine');
    add(mergeGeometries(ribs.map((g) => prep(g.applyMatrix4(F)))), makeMaterial({ color: '#f7f4ec', flat: true, grid: 3 }), 'The builders’ machine’s fins');
    // its broken arm, lying in the grass off the far end
    {
      const ax = Mc.x - fx * (Mc.len / 2 + 6) + sx * 2, az = Mc.z - fz * (Mc.len / 2 + 6) + sz * 2, ay = Math.min(H(ax - fx * 4, az - fz * 4), H(ax + fx * 4, az + fz * 4), H(ax, az));
      add(prep(new THREE.BoxGeometry(1.3, 1.3, 9).translate(0, 0.45, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(Mc.yaw + 0.5).setPosition(ax, ay, az))), cream, 'The builders’ machine’s arm');
    }
    add(prep(port.applyMatrix4(F)), tealM, 'The builders’ machine’s port');
    add(mergeGeometries(beds.map((g) => prep(g.applyMatrix4(F)))), makeMaterial({ color: '#8a6a48', flat: true }), 'The builders’ machine’s beds');
    for (let i = 0; i < Mc.tiers; i++) for (let j = 0; j < 14; j++) {
      const lx = -Mc.w / 2 + (i + 0.5) * tw + (rng() - 0.5) * (tw - 1), lz = (rng() - 0.5) * (Mc.len - 2.5), ly = 0.8 + (i + 1) * Mc.rise + 0.26;
      flowers.push({ at: V(lx, ly, lz).applyMatrix4(F), c: FL[(i + j) % 5], s: 1 + rng() * 0.5 });
    }
    const crown = V(Mc.w / 2 - tw / 2, topY + 0.25, 0).applyMatrix4(F);
    pieces.machine = { top: crown, foot: V(-Mc.w / 2 - 1.5, 0, 0).applyMatrix4(F) };
    pieces.machine.foot.y = H(pieces.machine.foot.x, pieces.machine.foot.z);
    sights.push({ name: 'the builders’ machine', at: crown });
    pieces.machine.box = { F, w: Mc.w, len: Mc.len };
  }

  // ---- the flowers over all of it: one instanced pool, drawn only
  const FLOWER = mergeGeometries([0, 1, 2, 3, 4].map((i) => new THREE.OctahedronGeometry(0.22, 0).scale(1, 0.4, 0.6).rotateY((i / 5) * Math.PI * 2).translate(Math.sin((i / 5) * Math.PI * 2) * 0.22, 0, Math.cos((i / 5) * Math.PI * 2) * 0.22)).concat([new THREE.OctahedronGeometry(0.12, 0).translate(0, 0.05, 0)]).map(prep));
  const fm = new THREE.InstancedMesh(FLOWER, makeMaterial({ color: '#ffffff', flat: true, key: 'viridel.wrecks.flowers' }), flowers.length);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), col = new THREE.Color();
  flowers.forEach((f, i) => { fm.setMatrixAt(i, _m.compose(f.at, _q.setFromAxisAngle(V(0, 1, 0), i * 1.7), _s.setScalar(f.s))); fm.setColorAt(i, col.set(f.c)); });
  fm.name = 'The fallen things’ flowers';
  fm.userData.noCollide = true; fm.userData.flora = true;
  scene.add(fm);

  const P = pieces.round;
  return {
    pieces, sights, flowers: flowers.length, crowded,
    portals: P.portals, room: P.room, hatch: P.hatch, lights: P.room.lights ?? [],
    /** (x, z) within r of a wreck (the flora and the other scatter keep off them) */
    avoid: (x, z, r = 0) => Math.hypot(x - R.x, z - R.z) < R.r + 1 + r || Math.hypot(x - Dd.x, z - Dd.z) < Dd.r + 1 + r
      || Math.hypot(x - Mt.x, z - Mt.z) < Mt.r + Mt.gap + r || Math.hypot(x - Mc.x, z - Mc.z) < Mc.len / 2 + 3 + r,
  };
}
