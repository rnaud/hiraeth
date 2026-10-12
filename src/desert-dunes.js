import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { driftMaterial } from './sand-drifts.js';
import { rough } from './desert-hearth.js';
import { smoothstep } from './noise.js';
import { RUINS, DUNE_VISITS, DUNE_WALK, SANDFALLS, LOOKOUT } from './desert-sites.js';
import { WASH, SAND_RUN } from './desert-landmarks.js';

// The walking dunes (issue #167; references/levels/The Desert/environment/explorations/walking-dunes/): the desert is
// not still (src/desert-sites.js SAND_RIVER, RUINS, SANDFALLS).
//
//   the sand rivers  running sand in two shallow channels (src/desert-ground.js): one out of Marrow's hollow along the
//                    south side of the ride to the salt-carrier's shade, one down the dry wash's bed from the giant's
//                    jaw home past the spine, under the arm and past the hand. A ribbon of paler sand on the bed;
//                    the bike rides it fast (`lane`: src/bike.js, a higher top speed with the flow
//                    and a current carrying it), a fast lane out and one home.
//   the ruins        four old things out on the dunes (a doorway and its stair down, a windcatcher's tower, a caravan's
//                    carts, an arcade's three arches), each under a dune or with its dune walked off it downwind. Which
//                    two stand clear changes from visit to visit, the same for the same visit (`visit`: the game's
//                    desert.dunes.visit, counted by src/story/desert-dunes.js; DUNE_VISITS). Covered, the tower's tip
//                    still shows.
//   the sandfalls    sand pouring off two mesas' lips in a slow curtain (the waterfalls' own shader: materials.js
//                    `fall`, waterfall-shader.js, in sand's tones), a cone of sand at the foot; found by raycasting the
//                    mesa where src/world.js put it.
//
//   the lookout      a ledge cut round the second sandfall's mesa, up from the sand to a platform beside its lip, 38 m
//                    over the ride (issue #181, LOOKOUT): walked or ridden up, a view over the ride and the giants' road.
//
//   const d = buildWalkingDunes(scene, terrain, { visit })  →  { group, lane(x, z), rivers, ruins, falls, lookout, sights, clear, avoid }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// (the bike in a sand river: src/bike.js LANE, its top speed with the flow and the current carrying it)
export { LANE } from './bike.js';
/** The ruins that stand clear on visit n. */
export const clearOn = (visit) => DUNE_VISITS[((visit % DUNE_VISITS.length) + DUNE_VISITS.length) % DUNE_VISITS.length];

const flatGeo = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

export function buildWalkingDunes(scene, terrain, { visit = 0 } = {}) {
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group(); group.name = 'The walking dunes';
  const clear = [];
  const parts = { river: [], stone: [], stone2: [], kerb: [], dark: [], wood: [], cloth: [], dune: [] };
  const mats = {
    // (the running sand paler than the dunes: its ripples are the ground's own ink; no streaks of their own, a draw saved)
    river: (() => { const m = makeMaterial({ color: '#f7e0b2', flat: true }); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; })(),
    stone: makeMaterial({ color: '#cdb38f', color2: '#bfa27c', flat: true }),
    stone2: makeMaterial({ color: '#d9c3a0', flat: true }),
    kerb: makeMaterial({ color: '#d9c3a0', flat: true }),
    dark: makeMaterial({ color: '#3b3340', flat: true }),
    wood: makeMaterial({ color: '#8a6a4a', flat: true }),
    cloth: makeMaterial({ color: '#f3ead8', flat: true, side: THREE.DoubleSide }),
    dune: driftMaterial(makeMaterial, terrain.materialOptions),
  };

  // ---------------------------------------------------------------- the sand rivers: a ribbon of paler sand on the bed
  const rivers = [{ name: 'the sand river out of the hollow', ch: SAND_RUN, flow: 1 }, { name: 'the sand river down the dry wash', ch: WASH, flow: 1 }];
  for (const R of rivers) {
    const P = R.ch.points, half = R.ch.opt.bed - 0.4, across = 6;   // (on the level bed only, a hair over it: you walk on it)
    const pos = [], idx = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      const nx = -dz / L, nz = dx / L, along = i / (P.length - 1) * R.ch.length, w = half * Math.min(1, R.ch.fadeAt(along) * 1.6);
      for (let j = 0; j <= across; j++) {
        const s = (j / across * 2 - 1) * Math.max(0.5, w), x = P[i][0] + nx * s, z = P[i][1] + nz * s;
        pos.push(x, H(x, z) + 0.02, z);
      }
    }
    for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < across; j++) { const p = i * (across + 1) + j, q = p + across + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    parts.river.push(g);
    for (let i = 0; i < P.length; i += 3) clear.push({ x: P[i][0], z: P[i][1], r: R.ch.opt.bed + 1 });
  }
  /** The bike in a sand river: { k: how far in (0..1), fx, fz: the way it runs } or null. */
  const lane = (x, z) => {
    for (const R of rivers) {
      const { s, a, i } = R.ch.nearest(x, z), bed = R.ch.opt.bed;
      if (s > bed + 2) continue;
      const k = (1 - smoothstep(bed - 2, bed + 2, s)) * R.ch.fadeAt(a);
      if (k < 0.02) continue;
      const P = R.ch.points, dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], L = Math.hypot(dx, dz);
      return { k, fx: dx / L * R.flow, fz: dz / L * R.flow, river: R.name };
    }
    return null;
  };

  // ---------------------------------------------------------------- the ruins, and the dunes that walk over and off them
  const open = new Set(clearOn(visit));
  /** A dune: a round heap of sand of the ground's own stuff, `h` m high, its foot sunk into the sand (collided as drawn). */
  const dune = (cx, cz, h, sigma) => {
    const rings = 9, segs = 22, R = sigma * 2.7, pos = [], idx = [];
    pos.push(cx, H(cx, cz) + h, cz);
    for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) {
      const a = s / segs * Math.PI * 2, d = R * r / rings, x = cx + Math.cos(a) * d * (1 + 0.12 * Math.sin(a * 3 + cx)), z = cz + Math.sin(a) * d;
      // (a crescent: steeper on its downwind face, the slip face)
      const lee = Math.max(0, Math.cos(a) * DUNE_WALK.dx + Math.sin(a) * DUNE_WALK.dz) / Math.hypot(DUNE_WALK.dx, DUNE_WALK.dz);
      const k = Math.exp(-((d / sigma) ** 2) * (0.5 + 0.35 * lee));
      pos.push(x, H(x, z) + h * k - (r === rings ? 0.45 : 0), z);
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = a + segs, d = b + segs;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    parts.dune.push(g.toNonIndexed());
    clear.push({ x: cx, z: cz, r: R * 0.8 });
  };
  const ruins = [];
  RUINS.forEach((def, n) => {
    const isOpen = open.has(n), c = Math.cos(def.yaw), s = Math.sin(def.yaw);
    const g0 = Math.min(...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => H(def.x + Math.cos(i * 0.785) * 5, def.z + Math.sin(i * 0.785) * 5)));
    const W = (lx, ly, lz) => V(def.x + lx * c + lz * s, g0 + ly, def.z - lx * s + lz * c);
    const box = (k, w, h, d, lx, ly, lz, rot = 0) => { const p = W(lx, ly, lz); parts[k].push(new THREE.BoxGeometry(w, h, d).rotateY(def.yaw + rot).translate(p.x, p.y, p.z)); };
    let height = 6, look = W(0, 1.5, 3), stand = W(0, 0, 6);
    if (def.id === 'stair') {
      // a doorway on a low plinth, its carved lintel, the stair going down into the dark between its jambs
      box('stone', 7, 1.6, 6, 0, 0.3, -1);
      box('stone', 1.2, 4.2, 1.6, -2.4, 2.4, 1.2); box('stone', 1.2, 4.2, 1.6, 2.4, 2.4, 1.2);
      box('stone', 6.6, 1.1, 2.0, 0, 5.0, 1.2);
      for (let k = 0; k < 5; k++) box('stone2', 0.7, 0.18, 0.12, -2.2 + k * 1.1, 5.0, 2.22);   // (the lintel's carving)
      box('dark', 3.6, 3.4, 0.2, 0, 2.2, 0.4);
      for (let k = 0; k < 5; k++) box('stone2', 3.4, 0.3, 1.0, 0, 1.2 - k * 0.32, 2.6 - k * 0.55);   // (the steps down)
      for (const [lx, lz, r] of [[-4.4, 2.6, 0.9], [4.1, 3.4, 0.7], [3.4, -3.6, 0.8]]) { const p = W(lx, 0.2, lz); parts.stone.push(rough(new THREE.IcosahedronGeometry(r, 0), 0.08, 2, n * 7 + lx).translate(p.x, p.y, p.z)); }
      height = 5.6; look = W(0, 2.6, 2.4); stand = W(0, 0, 6.4);
    } else if (def.id === 'tower') {
      // a windcatcher's square tower, its slots high up, a little dome on top
      box('stone', 4.2, 10, 4.2, 0, 4, 0);
      for (const [lx, lz, r] of [[0, 2.12, 0], [0, -2.12, 0], [2.12, 0, Math.PI / 2], [-2.12, 0, Math.PI / 2]]) for (const o of [-1.1, 0, 1.1]) box('dark', 0.5, 2.4, 0.08, lx + (r ? 0 : o), 7.0, lz + (r ? o : 0), r);
      box('stone2', 4.8, 0.4, 4.8, 0, 9.2, 0);
      { const p = W(0, 9.4, 0); parts.stone2.push(new THREE.SphereGeometry(1.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(p.x, p.y, p.z)); }
      height = 11.2; look = W(0, 3, 2.2); stand = W(0, 0, 5.5);
    } else if (def.id === 'caravan') {
      // three carts, tipped and half sunk, their hoops and canvas, a wheel standing loose
      [[-8, 0, 0.1, 0.12], [0.5, 2, -0.25, -0.08], [9, -1, 0.5, 0.2]].forEach(([lx, lz, turn, tip], k) => {
        const p = W(lx, 1.0, lz), rot = def.yaw + turn;
        parts.wood.push(new THREE.BoxGeometry(3.4, 1.5, 6.4).rotateZ(tip).rotateY(rot).translate(p.x, p.y, p.z));
        // its canvas over hoops (a half cylinder along the cart)
        const canvas = new THREE.CylinderGeometry(1.9, 1.9, 5.6, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateZ(tip).rotateY(rot);
        { const q = W(lx, 1.8, lz); parts.cloth.push(canvas.translate(q.x, q.y, q.z)); }
        for (const sz of [-2.2, 2.2]) for (const sx of [-1, 1]) { const q = W(lx + Math.cos(turn) * 1.8 * sx + Math.sin(turn) * sz, 0.75, lz - Math.sin(turn) * 1.8 * sx + Math.cos(turn) * sz); parts.wood.push(new THREE.CylinderGeometry(1.1, 1.1, 0.24, 10).rotateZ(Math.PI / 2).rotateY(rot).translate(q.x, q.y, q.z)); }
        if (k === 1) { const q = W(lx - 3.8, 1.0, lz + 2.0); parts.wood.push(new THREE.CylinderGeometry(1.1, 1.1, 0.24, 10).rotateX(0.2).rotateZ(Math.PI / 2 - 0.3).rotateY(rot).translate(q.x, q.y, q.z)); }
      });
      height = 4; look = W(0.5, 1.2, 1.5); stand = W(0.5, 0, 5.2);
    } else {
      // three arches of an old wall, the middle one the tallest
      const pillars = [-7.5, -2.5, 2.5, 7.5];
      for (const lx of pillars) box('stone', 1.6, 6.2, 1.8, lx, 2.6, 0);
      [[-5, 2.5], [0, 3.0], [5, 2.5]].forEach(([lx, r]) => {
        const p = W(lx, 5.7 - (3.0 - r), 0), arc = new THREE.TorusGeometry(r - 0.2, 0.7, 6, 12, Math.PI).scale(1, 1, 1.25).rotateY(def.yaw);
        parts.stone.push(arc.translate(p.x, p.y, p.z));
      });
      box('stone2', 17, 0.9, 2.0, 0, 9.0, 0);
      height = 9.5; look = W(0, 2.5, 1.5); stand = W(0, 0, 6);
    }
    if (isOpen) dune(def.x + DUNE_WALK.dx, def.z + DUNE_WALK.dz, 7.5, 11);
    else dune(def.x, def.z, def.id === 'tower' ? height - 1.2 : height + 1.4, def.id === 'arcade' ? 13 : 10.5);
    clear.push({ x: def.x, z: def.z, r: def.id === 'arcade' ? 11 : def.id === 'caravan' ? 11 : 6 });
    ruins.push({ id: def.id, n, open: isOpen, at: W(0, 0, 0), look, stand, top: W(0, height, 0) });
  });

  // ---------------------------------------------------------------- the sandfalls off the mesas' lips
  const falls = [];
  const ray = new THREE.Raycaster();
  const solids = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.noCollide && o !== terrain.mesh) solids.push(o); });
  for (const F of SANDFALLS) {
    const [mx, mz] = F.mesa, near = solids.filter((o) => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld); return Math.hypot(c.x - mx, c.z - mz) < 120; });
    const f = V(F.toward[0] - mx, 0, F.toward[1] - mz).normalize(), side = V(f.z, 0, -f.x);
    const hit = (o, d, far = 400) => { ray.set(o, d); ray.far = far; return ray.intersectObjects(near, false)[0] ?? null; };
    const topHit = hit(V(mx, 600, mz), V(0, -1, 0), 800);
    if (!topHit) continue;
    const top = topHit.point.y, out = V(mx, 0, mz).addScaledVector(f, 200);
    const foot = H(mx + f.x * 60, mz + f.z * 60);
    // the mesa's face along f, every 3 m up: how far out from its middle it stands
    const rows = [];
    for (let y = top - 0.6; y > foot - 6; y -= 3) {
      const h = hit(V(out.x, y, out.z), f.clone().negate(), 260);
      rows.push({ y, d: h ? Math.hypot(h.point.x - mx, h.point.z - mz) : null });
    }
    let reach = 0;
    for (const r of rows) { if (r.d != null) reach = Math.max(reach, r.d); r.e = reach + 1.4; }   // (the curtain falls clear of every ledge above it)
    const base = rows.findLast((r) => r.d != null) ?? rows[rows.length - 1];
    const footY = H(mx + f.x * (base.e + 2), mz + f.z * (base.e + 2)) - 0.5, h = top + 0.3 - footY;
    const cols = Math.max(2, Math.ceil(F.w / 3)), pos = [], uv = [], idx = [];
    const list = [{ y: top + 0.3, e: rows[0].e - 2.5 }, ...rows.filter((r) => r.y > footY), { y: footY, e: base.e + 0.8 }];
    list.forEach((r, i) => {
      for (let k = 0; k <= cols; k++) {
        const u = (k / cols - 0.5) * F.w * (1 - 0.18 * (r.y - footY) / h), p = V(mx, r.y, mz).addScaledVector(f, r.e + Math.sin(k * 1.7 + F.seed) * 0.3).addScaledVector(side, u);
        pos.push(p.x, p.y, p.z); uv.push(u + F.w / 2, r.y - footY);
      }
      if (i) for (let k = 0; k < cols; k++) { const a = (i - 1) * (cols + 1) + k, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mat = makeMaterial({ color: '#efc485', color2: '#f8e2b8', color3: '#d99a5c', fall: { speed: 3.2, column: 1.8, gaps: 0.14, mist: 4, ink: 0.7, lip: 2.0, height: h, seed: F.seed }, glow: 0.35, spot: 0, line: 0.5, lineTint: 0.6, side: THREE.DoubleSide });
    const sheet = new THREE.Mesh(g, mat);
    // (a curtain hanging in the air: walked through, not stood on or climbed: the contact and clipping audits)
    sheet.name = 'Sandfall'; sheet.userData.noCollide = true; sheet.userData.noBatch = true; sheet.userData.floats = true;
    group.add(sheet);
    // the cone of sand it has piled at the foot
    const fx = mx + f.x * (base.e + 3), fz = mz + f.z * (base.e + 3);
    dune(fx, fz, 4.2, 5.5);
    falls.push({ at: V(fx, H(fx, fz), fz), top: V(mx + f.x * rows[0].e, top, mz + f.z * rows[0].e), height: h, sheet });
  }

  // ---------------------------------------------------------------- the lookout up the sandfall mesa over the ride
  // (issue #181: every place in the desert stood on the sand) A ledge the pilgrims cut round the mesa's west face, from the
  // sand up to a stone platform beside the fall's lip, LOOKOUT.rise m over the sand: walked or ridden up, not climbed.
  const lookout = (() => {
    const F = SANDFALLS[LOOKOUT.fall];
    if (!F) return null;
    const [mx, mz] = F.mesa;
    // the mesa itself: the big solid standing on that spot
    let mesa = null, best = Infinity;
    for (const o of solids) {
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld), d = Math.hypot(c.x - mx, c.z - mz);
      if (o.geometry.boundingSphere.radius > 25 && d < 25 && d < best) { best = d; mesa = o; }
    }
    if (!mesa) return null;
    const dir = (a) => V(Math.cos(a), 0, Math.sin(a));
    /** How far out from the middle the face stands at angle a, over the 3 m above y (where a ledge at y meets it). */
    const wallAt = (a, y) => {
      let r = null;
      for (const dy of [0.3, 1.2, 2.2, 3.2]) {
        ray.set(V(mx, y + dy, mz).addScaledVector(dir(a), 200), dir(a).negate()); ray.far = 260;
        const h = ray.intersectObject(mesa, false)[0];
        if (h) r = Math.max(r ?? 0, Math.hypot(h.point.x - mx, h.point.z - mz));
      }
      return r;
    };
    const { a0, a1, rise, w, deck } = LOOKOUT;
    const r0 = wallAt(a0, H(mx + Math.cos(a0) * 70, mz + Math.sin(a0) * 70) + 1) ?? 55;
    const y0 = H(mx + Math.cos(a0) * (r0 + w / 2), mz + Math.sin(a0) * (r0 + w / 2)) + 0.1, y1 = y0 + rise;
    const n = Math.ceil(Math.abs(a1 - a0) * 52 / 2.4);
    const st = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u, y = y0 + (y1 - y0) * Math.min(1, u / 0.9);   // (level for its last few metres, onto the platform)
      st.push({ a, y, r: wallAt(a, y) ?? st.at(-1)?.r ?? r0 });
    }
    // (the face is terraced and rough: the ledge runs into it, never out from it, and keeps its width outside it)
    st.forEach((s, i) => {
      const near = st.slice(Math.max(0, i - 2), i + 3).map((q) => q.r);
      s.rin = Math.min(...near) - 1.4; s.rout = Math.max(...near) + w;
    });
    const P = (a, r, y) => V(mx + Math.cos(a) * r, y, mz + Math.sin(a) * r);
    const pos = [], idx = [];
    st.forEach((s) => {
      for (const [r, y] of [[s.rin, s.y], [s.rout, s.y], [s.rout - 0.5, s.y - 1.3], [s.rin, s.y - 2.4]]) { const p = P(s.a, r, y); pos.push(p.x, p.y, p.z); }
    });
    for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4;
      idx.push(...(a1 < a0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));   // (faces outward whichever way it winds)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    parts.stone.push(g.toNonIndexed());
    // a kerb of worn stones along its outer lip (walked over, not into), every few metres
    st.forEach((s, i) => {
      if (i % 2 || i < 3) return;
      const p = P(s.a, s.rout - 0.35, s.y + 0.12);
      parts.kerb.push(rough(new THREE.IcosahedronGeometry(0.3 + 0.12 * ((i * 7) % 3), 0), 0.06, 2, i).scale(1.3, 0.6, 1).translate(p.x, p.y, p.z));
    });
    // the platform at the top: half in the face, half out over the ride, a cairn and a pole of cloths on it
    const end = st.at(-1), c = P(end.a, end.r + 1, y1);
    parts.stone.push(new THREE.CylinderGeometry(deck, deck * 0.8, 3, 14).translate(c.x, y1 - 1.5, c.z));
    const out = dir(end.a), side = V(-out.z, 0, out.x);
    const at = (lx, lz, y = y1) => c.clone().addScaledVector(out, lz).addScaledVector(side, lx).setY(y);
    [[0.62, 0.4], [0.46, 0.3], [0.32, 0.22]].reduce((y, [r, h], k) => {
      const p = at(-3.2, 2.2, y1 + y + h); parts.stone2.push(rough(new THREE.IcosahedronGeometry(r, 0), 0.07, 1.5, 60 + k).scale(1, h / r * 1.6, 1).translate(p.x, p.y, p.z));
      return y + h * 1.9;
    }, 0);
    { const p = at(3.4, 1.4); parts.wood.push(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 5).translate(p.x, y1 + 2.1, p.z));
      // (its cloths tied on near the top, narrow strips hanging loose: the giants' shrines' own)
      for (let k = 0; k < 4; k++) { const L = 1.2 - k * 0.15, a = end.a + k * 1.5; parts.cloth.push(new THREE.PlaneGeometry(0.2, L).translate(0, -L / 2, 0).rotateX(0.35 + 0.1 * k).translate(0, 0, 0.09).rotateY(a).translate(p.x, y1 + 4.05 - k * 0.12, p.z)); } }
    for (const s of st) { const p = P(s.a, (s.rin + s.rout) / 2, 0); clear.push({ x: p.x, z: p.z, r: 5 }); }
    clear.push({ x: c.x, z: c.z, r: deck + 2 });
    const look = at(0, deck - 0.6, y1 + 1.2), stand = at(0, deck - 2.2);
    return { at: stand, stand, look, top: y1, foot: y0, path: st.map((s) => P(s.a, (s.rin + s.rout) / 2, s.y)) };
  })();

  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeGeometries(list.map(flatGeo)), mats[k]);
    m.name = `The walking dunes (${k})`;
    if (k === 'river' || k === 'cloth' || k === 'dark' || k === 'kerb') m.userData.noCollide = true;
    m.receiveShadow = true;
    group.add(m);
  }
  scene.add(group);
  const NAMES = { stair: 'a doorway the dune let go of', tower: 'the windcatcher out of the sand', caravan: 'a caravan the dune let go of', arcade: 'old arches out of the sand' };
  const sights = ruins.filter((r) => r.open).map((r) => ({ name: NAMES[r.id], at: r.stand }));
  if (lookout) sights.push({ name: 'the lookout on the sandfall mesa', at: lookout.stand });
  return { group, lane, rivers, ruins, falls, lookout, sights, clear, visit, avoid: (x, z, r = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) };
}
