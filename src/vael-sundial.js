import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { jitter } from './world.js';
import { glyphGeometry } from './story/sign-text.js';
import { inRoad } from './vael-canyon.js';

// The plain is a sundial (issue #187, the author's pick "sundial-plain": references/levels/Vael/environment/explorations/):
// the needles round the lone tower were not scattered, the riders set them, in three rings, and the tower is the
// gnomon. On the outer ring each needle is an hour, an hour stone at its foot, a niche in the needle with a lamp that
// lights while the tower's shadow lies on it. The riders kept time by the tower: Vael's sun stands where the riders'
// hour puts it (riderHour), so the tower's long shadow lies across the plain as the way on. Once the wings are yours,
// to the white house, the way you came; once the bird has answered, out to the riders' gate at the plain's edge;
// once the bell has rung, home toward the landing. When the hour turns the sun swings round in half a minute and the
// shadow sweeps the plain (sun.dir; the level's lightAt bends the light to it, src/levels/arzach.js).
//
//   RINGS, HOUR_EL, SWING, riderHour(flag) → 'morning' | 'aerie' | 'gate' | 'home'
//   buildSundial(scene, terrain, { x, z, targets, keep, senn }) → { hours: [{ az, at, look, stand, name, lamp, light }],
//        named: { aerie, gate, home }, lights, sun, shadowAz(), lit(hour), update(dt, t, flag), needles }

/** The three rings round the tower: radius (m), needles, their height and foot (m), the first needle's bearing (rad). */
export const RINGS = [
  { R: 64, n: 12, h: [9, 13], r: [1.3, 1.8], a0: 0.12 },
  { R: 110, n: 16, h: [18, 26], r: [2.2, 3.0], a0: 0.3 },
  { R: 165, n: 16, h: [32, 46], r: [3.2, 4.4], a0: -0.66 },
];
/** How high the riders' sun stands (deg): low, so the tower's shadow reaches far over the plain. */
export const HOUR_EL = 27;
/** How long the sun takes to swing round to the next hour (s). */
export const SWING = 30;

/** The riders' hour, from where the story stands. */
export function riderHour(flag) {
  if (flag('arzach2.bell.rung')) return 'home';
  if (flag('arzach.bird.promise') || flag('bird.promise')) return 'gate';
  if (flag('item.glider')) return 'aerie';
  return 'morning';
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** A bearing (rad, from +z toward +x) from (ax, az) to (bx, bz). */
export const bearing = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
/** The direction to a sun that throws a shadow along bearing `az` (rad), `el` (deg) high. */
export const sunFor = (az, el, out = V()) => { const e = THREE.MathUtils.degToRad(el); return out.set(-Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)); };
/** The bearing and height (deg) of the shadow a sun in direction d throws. */
const shadowOf = (d) => ({ az: Math.atan2(-d.x, -d.z), el: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))) });

/**
 * targets: { aerie, gate, home } as [x, z] (the Aerie's door, the riders' gate, the landing); keep(x, z, r): may a
 * needle stand there (the fallen giant, the colossus's legs); senn: [x, z, r] of Senn's spire, the home hour's needle.
 */
export function buildSundial(scene, terrain, { x: X, z: Z, targets, keep = () => true, senn = null, plain = -Infinity }) {
  const H = (x, z) => terrain.heightAt(x, z);
  // (where one of the plain's old ravines crosses a ring, the ring is broken: the ravines are older than the riders)
  const sunk = (x, z, r) => terrain.baseAt(x, z, r + 1) < plain - 7;
  const BONE = [['#f4efe2', '#e6dcc6', '#d6c7a8'], ['#efe4cf', '#e2cfae', '#f7f1e4'], ['#ece6da', '#d9cfc0', '#c9b8a0']];
  const boneMats = BONE.map((p) => makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, strataSize: 3, flat: true }));
  const stoneMat = makeMaterial({ color: '#f1e9d8', color2: '#e2d4b8', color3: '#d8c7a6', mode: MODE_STRATA, strataSize: 0.8, flat: true });
  const ink = makeMaterial({ color: '#8a6e52', flat: true });
  const dark = makeMaterial({ color: '#2a2128', flat: true });
  const lampMat = makeMaterial({ color: '#ffd9a0', flat: true, glow: 1.0 });
  const needles = BONE.map(() => []), stones = [], grooves = [], hollows = [], hours = [], lights = [], needleAt = [];
  const azOf = (q) => bearing(X, Z, q[0], q[1]);
  const named = { aerie: azOf(targets.aerie), gate: azOf(targets.gate), home: azOf(targets.home) };

  // an hour stone: a low round stone carved with a rider's mark, a groove across it toward the tower; behind it, in the
  // foot of its needle (nd: { x, z, r }), a dark niche facing the tower and a little lamp in it
  const hourStone = (sx, sz, nd, name) => {
    const az = bearing(X, Z, sx, sz), y = H(sx, sz), yaw = az + Math.PI;   // (its face, and the groove, toward the tower)
    const F = new THREE.Matrix4().compose(V(sx, y, sz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
    stones.push(flat0(new THREE.CylinderGeometry(2.1, 2.3, 1.3, 18).translate(0, 0.25, 0)).applyMatrix4(F));
    grooves.push(flat0(new THREE.BoxGeometry(0.22, 0.05, 3.2).translate(0, 0.91, 0)).applyMatrix4(F));
    grooves.push(flat0(glyphGeometry(0.9).rotateX(-Math.PI / 2).translate(0.9, 0.92, -0.6)).applyMatrix4(F));
    const toward = V(X - nd.x, 0, Z - nd.z).normalize(), nyaw = Math.atan2(toward.x, toward.z);
    const skin = V(nd.x, 0, nd.z).addScaledVector(toward, nd.r * 0.86);   // (the needle's skin at its foot, on the tower's side)
    skin.y = H(skin.x, skin.z);
    const arch = new THREE.Shape(); arch.moveTo(-0.55, 0); arch.lineTo(0.55, 0); arch.lineTo(0.55, 0.9); arch.absarc(0, 0.9, 0.55, 0, Math.PI, false); arch.lineTo(-0.55, 0);
    hollows.push(flat0(new THREE.ShapeGeometry(arch, 8).translate(0, 0.2, 0.06)).applyMatrix4(new THREE.Matrix4().compose(skin, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), nyaw), V(1, 1, 1))));
    const lampAt = skin.clone().add(V(0, 0.75, 0)).addScaledVector(toward, 0.3);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lampMat);
    lamp.position.copy(lampAt); lamp.visible = false; lamp.userData.noCollide = true; lamp.name = 'An hour stone’s lamp';
    scene.add(lamp);
    const light = new THREE.Vector4(lampAt.x, lampAt.y, lampAt.z, 0);
    lights.push(light);
    const stand = V(sx, 0, sz).addScaledVector(toward, 3.6); stand.y = H(stand.x, stand.z);
    hours.push({ az, at: V(sx, y, sz), look: V(sx, y + 1, sz), stand, name, lamp, light, lampAt });
  };
  const needle = (x, z, r, h, seed, mat) => {
    const g = new THREE.CylinderGeometry(r * 0.16, r, h, 9, 8).translate(0, h / 2, 0);
    jitter(g, 0.16, 0.03, seed);
    const y = terrain.baseAt(x, z, r) - 0.8;
    needles[mat].push(flat0(g).translate(x, y, z));
    return y + h;   // (its tip)
  };

  // ---- the rings
  RINGS.forEach((ring, k) => {
    for (let i = 0; i < ring.n; i++) {
      const a = ring.a0 + (i / ring.n) * Math.PI * 2, x = X + Math.sin(a) * ring.R, z = Z + Math.cos(a) * ring.R;
      const t = (Math.sin(i * 2.3 + k * 1.7) + 1) / 2, h = ring.h[0] + (ring.h[1] - ring.h[0]) * t, r = ring.r[0] + (ring.r[1] - ring.r[0]) * (1 - t);
      // (the outer ring's hour toward Senn's spire is that spire: it stood there before the riders set the rest)
      if (k === 2 && senn && Math.hypot(x - senn[0], z - senn[1]) < 26) continue;
      if (!keep(x, z, r + (k === 2 ? 6 : 1.5)) || inRoad(x, z, r + (k === 2 ? 5 : 0)) || sunk(x, z, r)) continue;
      const tip = needle(x, z, r, h, 40 + k * 20 + i, (i + k) % 3);
      needleAt.push({ x, z, r, k, a, h, tip });
      if (k === 2) hourStone(X + Math.sin(a) * (ring.R - r - 3.4), Z + Math.cos(a) * (ring.R - r - 3.4), { x, z, r }, null);
    }
  });
  // the three hours the story keeps, each a stone where the shadow will lie: a needle of the outer ring's if one stands
  // on that bearing, else a needle of their own on the ring's line (out past the road if it runs there); the home
  // hour's needle is Senn's spire
  for (const [key, az] of Object.entries(named)) {
    const near = hours.find((h) => Math.abs(wrapA(h.az - az)) < 0.05);
    if (near) { near.name = key; continue; }
    if (key === 'home' && senn) {
      const d = Math.hypot(senn[0] - X, senn[1] - Z), sr = senn[2] ?? 8;
      hourStone(X + Math.sin(az) * (d - sr - 3.4), Z + Math.cos(az) * (d - sr - 3.4), { x: senn[0], z: senn[1], r: sr }, key);
      continue;
    }
    let R = RINGS[2].R;
    const r = 3.3, at = () => [X + Math.sin(az) * R, Z + Math.cos(az) * R];
    for (let k = 0; k < 12 && (inRoad(...at(), r + 6) || !keep(...at(), r + 6)); k++) R += 8;
    const [nx, nz] = at();
    const tip = needle(nx, nz, r, 31, key.length * 13, 0);
    needleAt.push({ x: nx, z: nz, r, k: 2, a: az, named: key, h: 31, tip });
    hourStone(X + Math.sin(az) * (R - r - 3.4), Z + Math.cos(az) * (R - r - 3.4), { x: nx, z: nz, r }, key);
  }
  needles.forEach((list, i) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), boneMats[i]); m.name = 'The sundial’s needles'; scene.add(m); });
  const stoneMesh = new THREE.Mesh(mergeGeometries(stones), stoneMat);
  stoneMesh.name = 'The hour stones';
  const groove = new THREE.Mesh(mergeGeometries(grooves), ink);
  groove.userData.noCollide = true;
  const hollow = new THREE.Mesh(mergeGeometries(hollows), dark);
  hollow.userData.noCollide = true;
  scene.add(stoneMesh, groove, hollow);

  // ---- the dotted rings: a little marker stone every 4.5 m along each ring (walked through: drawn only)
  {
    const dots = [], d = new THREE.Object3D();
    for (const ring of RINGS) for (let s = 0; s < Math.PI * 2 * ring.R; s += 4.5) {
      const a = s / ring.R, x = X + Math.sin(a) * ring.R, z = Z + Math.cos(a) * ring.R;
      if (inRoad(x, z, 0.5) || !keep(x, z, 0.5) || sunk(x, z, 0.5) || needleAt.some((n) => Math.hypot(n.x - x, n.z - z) < n.r + 1.2) || hours.some((h) => Math.hypot(h.at.x - x, h.at.z - z) < 3)) continue;
      const sc = 0.5 + 0.25 * Math.sin(s * 1.9);
      d.position.set(x, H(x, z) - 0.1, z); d.rotation.set(0, a * 3.1, 0); d.scale.set(sc, sc * 1.4, sc); d.updateMatrix();
      dots.push(d.matrix.clone());
    }
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.42, 0.9, 6).translate(0, 0.3, 0), stoneMat, dots.length);
    dots.forEach((m, i) => im.setMatrixAt(i, m));
    im.userData.noCollide = true; im.frustumCulled = false; im.name = 'The sundial’s marker stones';
    scene.add(im);
  }

  // ---- the riders' sun: where the hour puts it, swung round from where it stood when the hour turns. sun.clock is the
  // clock's own sun (the level's lightAt keeps it): the morning's, before the riders' hours
  const sun = { hour: null, to: null, from: null, k: 1, clock: null };
  sun.set = (hour, { swing = true } = {}) => {
    if (hour === sun.hour) return false;
    const now = sun.dir(V());
    sun.from = swing && now ? shadowOf(now) : null;
    sun.hour = hour;
    sun.to = named[hour] == null ? null : { az: named[hour], el: HOUR_EL };
    sun.k = sun.from ? 0 : 1;
    return true;
  };
  /** The direction to the sun now, or null (the clock's own, untouched). */
  sun.dir = (out) => {
    const to = sun.to ?? (sun.clock ? shadowOf(sun.clock) : null);
    if (!to) return null;
    if (!sun.from || sun.k >= 1) return sun.to ? sunFor(to.az, to.el, out) : null;
    const e = sun.k * sun.k * (3 - 2 * sun.k);
    return sunFor(sun.from.az + wrapA(to.az - sun.from.az) * e, sun.from.el + (to.el - sun.from.el) * e, out);
  };
  /** The bearing the tower's shadow lies along now (rad), or null (the clock's sun). */
  const shadowAz = () => { const d = sun.dir(V()) ?? sun.clock; return d ? Math.atan2(-d.x, -d.z) : null; };
  const lit = (h) => { const a = shadowAz(); return a != null && sun.k >= 1 && Math.abs(wrapA(h.az - a)) < 0.075; };
  const update = (dt, t, flag) => {
    if (flag) sun.set(riderHour(flag), { swing: sun.hour != null });
    if (sun.k < 1) sun.k = Math.min(1, sun.k + dt / SWING);
    for (const h of hours) { const on = lit(h); h.lamp.visible = on; h.light.w = on ? 2.2 + 0.25 * Math.sin(t * 5 + h.az * 7) : 0; }
  };
  const namedHours = Object.fromEntries(Object.keys(named).map((k) => [k, hours.find((h) => h.name === k)]));
  return { hours, named: namedHours, lights, sun, shadowAz, lit, update, needles: needleAt, center: V(X, 0, Z), bearings: named };
}
