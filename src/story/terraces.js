import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Puffs } from './puffs.js';
import { TERRACES } from '../levels/edena.js';
import { PEOPLE } from './edena-data.js';

// Viridel's tea terraces: the quest you try, and fail (edena-data.js has the words;
// LORE.md, "The quest that fails", says why here).
//
// Four terraces on the white builders' old steps run down a slope into a dry
// hollow; Esk's tea bushes grow on them in rows. Above, on the rise, the
// builders' cistern, shut behind a gate whose wheel roots have grown through.
//
//   the runnels  three clods of silt choke the runnels at the foot of each step
//                (the top three terraces). Shove them out (push), top first: a
//                lower one shoved early slumps back ("the water has to have
//                somewhere to go"). Water then trickles down. Not enough.
//   the gate     at Esk's asking: water the roots so they let go (shoot), then one
//                shove of the wheel (push). One notch, and the gate, shut for a
//                thousand years, tears loose. Nothing the player does changes it.
//   the flood    the water comes down the middle of the terraces (the lane): the
//                walls go, the bushes go, a sheet of water and then of mud runs
//                into the hollow. ~10 s. After it: a raw mud slope down the middle
//                with a stream in it, a muddy pond in the hollow, the gate lying in
//                the mud, uprooted bushes, the cistern nearly empty. For good:
//                edena.terraces.flooded rebuilds it like that on every visit.
//
// Flags: edena.runnel.<0-2>, edena.runnels, edena.gate.roots, edena.gate.turned,
// edena.terraces.flooded (src/story/edena-data.js lists them all).

const Q = 'edena.terraces';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = (t) => t * t * (3 - 2 * t);
const FLOOD_S = 10;   // how long the water takes, gate to quiet

/** The terraces' layout from the ground: each step's x range and its flat top along z. Pure (tests use it). */
export function terraceLayout(H, T = TERRACES) {
  const D = (T.x1 - T.x0) / T.steps;
  const zs = [];
  for (let z = T.z0; z <= T.z1 + 1e-6; z += 2) zs.push(z);
  const steps = [];
  for (let k = T.steps - 1; k >= 0; k--) {   // from the bottom up: each top at least 1.2 m over the one below
    const xl = T.x1 - D * (k + 1), xu = T.x1 - D * k, below = steps[0];
    const top = zs.map((z, j) => {
      let m = -Infinity;
      for (let x = xl; x <= xu + 1e-6; x += 1.5) m = Math.max(m, H(x, z));
      return Math.max(m + 0.4, below ? below.top[j] + 1.2 : -Infinity);
    });
    steps.unshift({ k, xl, xu, top });
  }
  const topAt = (k, z) => {
    const s = steps[k], t = THREE.MathUtils.clamp((z - T.z0) / 2, 0, zs.length - 1), j = Math.floor(t), f = t - j;
    return s.top[j] + ((s.top[Math.min(j + 1, zs.length - 1)] ?? s.top[j]) - s.top[j]) * f;
  };
  return { D, zs, steps, topAt };
}

/** One step's earth (top) and stone (front face and end caps) between za and zb. */
function stepGeometry(L, H, k, za, zb) {
  const s = L.steps[k], earth = [], stone = [];
  const zs = L.zs.filter((z) => z >= za - 1e-6 && z <= zb + 1e-6);
  if (zs[0] > za) zs.unshift(za);
  if (zs[zs.length - 1] < zb) zs.push(zb);
  const quad = (out, a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i + 1 < zs.length; i++) {
    const z0 = zs[i], z1 = zs[i + 1], t0 = L.topAt(k, z0), t1 = L.topAt(k, z1);
    // the earth on top, a hand lower than the stone lip at the front
    quad(earth, [s.xl + 0.35, t0 - 0.12, z0], [s.xl + 0.35, t1 - 0.12, z1], [s.xu, t1 - 0.12, z1], [s.xu, t0 - 0.12, z0]);
    // the builders' wall at the front: a lip, and the face down into the ground below it
    const b0 = H(s.xl, z0) - 0.8, b1 = H(s.xl, z1) - 0.8;
    quad(stone, [s.xl, b0, z0], [s.xl, b1, z1], [s.xl, t1, z1], [s.xl, t0, z0]);
    quad(stone, [s.xl, t0, z0], [s.xl, t1, z1], [s.xl + 0.35, t1, z1], [s.xl + 0.35, t0, z0]);
  }
  // the end caps
  for (const [z, sgn] of [[za, -1], [zb, 1]]) {
    const t = L.topAt(k, z), n = 6;
    for (let i = 0; i < n; i++) {
      const xa = s.xl + ((s.xu - s.xl) * i) / n, xb = s.xl + ((s.xu - s.xl) * (i + 1)) / n;
      const a = [xa, H(xa, z) - 0.8, z], b = [xb, H(xb, z) - 0.8, z], c = [xb, t, z], d = [xa, t, z];
      if (sgn < 0) quad(stone, a, b, c, d); else quad(stone, b, a, d, c);
    }
  }
  const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  return { earth: geo(earth), stone: geo(stone) };
}

/** A strip over the ground along a path (points [x, z] downhill), `w` wide, `lift` over it; vertices in order, for drawRange. */
function stripGeometry(H, path, w, lift, wobble = 0) {
  const pos = [], idx = [];
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i], [nx, nz] = path[Math.min(i + 1, path.length - 1)], [px, pz] = path[Math.max(i - 1, 0)];
    let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const sx = dz, sz = -dx, half = (w / 2) * (1 + wobble * Math.sin(i * 1.7));   // (this side keeps the faces up)
    for (const s of [-1, -0.5, 0, 0.5, 1]) { const X = x + sx * s * half, Z = z + sz * s * half; pos.push(X, H(X, Z) + lift, Z); }
    if (i) for (let c = 0; c < 4; c++) { const a = (i - 1) * 5 + c, b = a + 1, d = a + 5, e = d + 1; idx.push(a, d, b, b, d, e); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A blob of ground (a disc draped over it), radius r, a little ragged. */
function discGeometry(H, cx, cz, r, lift, seed = 1) {
  const pos = [], idx = [], rings = 6, segs = 28;
  pos.push(cx, H(cx, cz) + lift, cz);
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const a = (j / segs) * Math.PI * 2, rr = (r * i) / rings * (i === rings ? 0.82 + 0.18 * Math.sin(a * 3 + seed) * Math.cos(a * 5 - seed) : 1);
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    pos.push(x, H(x, z) + lift, z);
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + ((j + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function setupTerraces(ctx) {
  const { level, physics, player, quests, game, sound, spawn, scene, toast, dialogue } = ctx;
  const T = TERRACES;
  const H = (x, z) => level.ground.heightAt(x, z);
  const L = terraceLayout(H, T);
  const inLane = (z, pad = 0) => z > T.lane.z0 - pad && z < T.lane.z1 + pad;
  const flooded = () => !!game.flag('edena.terraces.flooded');

  const root = new THREE.Group(); root.name = 'terraces';
  scene.add(root);
  const earthMat = makeMaterial({ color: '#9a7d52', flat: true, side: THREE.DoubleSide });
  const stoneMat = makeMaterial({ color: '#f7f4ec', flat: true, grid: 3, glyphs: true, side: THREE.DoubleSide });
  const foamMat = makeMaterial({ color: '#cfeef0', color2: '#9ad3d9', flat: true, glow: 0.15 });
  const accent = makeMaterial({ color: '#62c3c9', flat: true, grid: 3 });
  const mudMat = makeMaterial({ color: '#7d5c3c', color2: '#8f6c46', color3: '#6f8a4f', mode: MODE_TERRAIN, ticks: true });
  const waterMat = makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER });
  const muddyMat = makeMaterial({ color: '#a88c64', color2: '#c2a983', mode: MODE_WATER });
  const bushMat = makeMaterial({ color: '#5f8f4f', color2: '#86a35a', flat: true });
  const deadMat = makeMaterial({ color: '#8a7a4a', color2: '#6f5a3a', flat: true });
  const rootMat = makeMaterial({ color: '#6f9a5a', flat: true });

  // ---------------------------------------------------------------- the steps: sides stay, the lane goes
  const sides = new THREE.Group(), lane = [];
  for (const s of L.steps) {
    for (const [za, zb] of [[T.z0, T.lane.z0], [T.lane.z1, T.z1]]) {
      const g = stepGeometry(L, H, s.k, za, zb);
      sides.add(new THREE.Mesh(g.earth, earthMat), new THREE.Mesh(g.stone, stoneMat));
    }
    const g = stepGeometry(L, H, s.k, T.lane.z0, T.lane.z1), grp = new THREE.Group();
    grp.add(new THREE.Mesh(g.earth, earthMat), new THREE.Mesh(g.stone, stoneMat));
    grp.userData.k = s.k;
    lane.push(grp);
  }
  // ramps up the north end, one per wall, so the terraces can be walked (they can be climbed too)
  for (let k = 0; k + 1 < L.steps.length; k++) {
    const s = L.steps[k], z = T.z1 - 2.2, lo = L.topAt(k + 1, z) - 0.1, hi = L.topAt(k, z), run = 6.5;
    const len = Math.hypot(run, hi - lo), r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 3), stoneMat);
    r.position.set(s.xl - run / 2 + 0.3, (lo + hi) / 2 - 0.2, z);
    r.rotation.z = Math.atan2(hi - lo, run);
    sides.add(r);
  }
  root.add(sides, ...lane);

  // ---------------------------------------------------------------- the tea bushes, in rows
  const bushGeo = new THREE.IcosahedronGeometry(0.8, 1).scale(1, 0.72, 1);
  const spots = { sides: [], lane: [] };
  for (const s of L.steps) for (const dx of [3, 6, 9]) for (let z = T.z0 + 1.6; z < T.z1 - 3.5; z += 2.4) {
    if (Math.abs(z - T.lane.z0) < 0.9 || Math.abs(z - T.lane.z1) < 0.9) continue;
    const x = s.xl + dx + Math.sin(z * 1.3 + s.k) * 0.25, y = L.topAt(s.k, z) - 0.1;
    (inLane(z) ? spots.lane : spots.sides).push({ x, y, z, k: s.k, s: 0.85 + 0.3 * Math.abs(Math.sin(x * 3.1 + z)) });
  }
  const dummy = new THREE.Object3D();
  const bushes = (list, mat) => {
    const m = new THREE.InstancedMesh(bushGeo, mat, Math.max(1, list.length));
    list.forEach((b, i) => { dummy.position.set(b.x, b.y + 0.35 * b.s, b.z); dummy.rotation.set(0, b.x + b.z, 0); dummy.scale.setScalar(b.s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.count = list.length;
    m.userData.noCollide = true;
    root.add(m);
    return m;
  };
  bushes(spots.sides, bushMat);
  const laneBushes = bushes(spots.lane, bushMat);
  laneBushes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ---------------------------------------------------------------- the runnels and their clods
  const runnels = [0, 1, 2].map((k) => {
    const s = L.steps[k], x = s.xu - 1.1, top = (xx, zz) => L.topAt(k, zz) - 0.12;
    // the runnel's water in three lengths: the middle one goes with the lane
    const strip = new THREE.Group(), lanePart = new THREE.Mesh(stripGeometry(top, [[x, T.lane.z0], [x, T.lane.z1]], 0.7, 0.03), waterMat);
    strip.add(new THREE.Mesh(stripGeometry(top, [[x, T.z0 + 1], [x, T.lane.z0]], 0.7, 0.03), waterMat), lanePart,
      new THREE.Mesh(stripGeometry(top, [[x, T.lane.z1], [x, T.z1 - 3]], 0.7, 0.03), waterMat));
    strip.traverse((o) => { o.userData.noCollide = true; });
    strip.visible = !!game.flag(`edena.runnel.${k}`) || flooded();
    strip.userData.lanePart = lanePart;
    root.add(strip);
    const at = V(x, L.topAt(k, -100) + 0.35, -100);
    const clod = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0).scale(1.2, 0.7, 1), deadMat);
    clod.position.copy(at); clod.userData.noCollide = true;
    clod.visible = !game.flag(`edena.runnel.${k}`) && !flooded();
    root.add(clod);
    return { k, at, strip, clod, shiver: 0, out: 0 };
  });
  const cleared = () => game.flag('edena.runnels') ?? 0;
  const nextClod = () => runnels.find((r) => !game.flag(`edena.runnel.${r.k}`)) ?? runnels[2];

  // ---------------------------------------------------------------- the builders' cistern and its gate
  const C = T.cistern, cz = (C.z0 + C.z1) / 2;
  let cBase = -Infinity;
  for (let x = C.x0; x <= C.x1; x += 1.5) for (let z = C.z0; z <= C.z1; z += 2) cBase = Math.max(cBase, H(x, z));
  const cTop = cBase + 3.2, wallT = 0.8, gap = 1.6;
  const cistern = new THREE.Group(), gateGroup = new THREE.Group();
  const box = (w, h, d, x, y, z, mat = stoneMat, parent = cistern) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const wallH = cTop - cBase + 1.5, wallY = cBase - 1.5 + wallH / 2;
  box(C.x1 - C.x0, wallH, wallT, (C.x0 + C.x1) / 2, wallY, C.z0 + wallT / 2);
  box(C.x1 - C.x0, wallH, wallT, (C.x0 + C.x1) / 2, wallY, C.z1 - wallT / 2);
  box(wallT, wallH, C.z1 - C.z0, C.x1 - wallT / 2, wallY, cz);
  // the west wall, toward the terraces, with the gate in its middle
  box(wallT, wallH, cz - gap - C.z0, C.x0 + wallT / 2, wallY, (C.z0 + cz - gap) / 2);
  box(wallT, wallH, C.z1 - cz - gap, C.x0 + wallT / 2, wallY, (C.z1 + cz + gap) / 2);
  box(1.1, wallH + 1.6, 1.1, C.x0 + 0.2, wallY + 0.8, cz - gap - 0.35, accent);
  const postS = box(1.1, wallH + 1.6, 1.1, C.x0 + 0.2, wallY + 0.8, cz + gap + 0.35, accent);
  const slab = box(0.6, wallH - 0.2, gap * 2, C.x0 + 0.1, wallY - 0.1, cz, stoneMat, gateGroup);
  const lintel = box(1.3, 0.7, gap * 2 + 2.4, C.x0 + 0.2, cTop + 1.3, cz, accent, gateGroup);
  // the wheel, standing on the lintel's face toward the terraces
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 6, 24).rotateY(Math.PI / 2), accent));
  for (let i = 0; i < 4; i++) wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.16).rotateX((i * Math.PI) / 4), accent));
  wheel.position.set(C.x0 - 0.75, cTop + 1.3, cz);
  gateGroup.add(wheel);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(C.x1 - C.x0 - wallT * 2, C.z1 - C.z0 - wallT * 2).rotateX(-Math.PI / 2), waterMat);
  water.position.set((C.x0 + C.x1) / 2, cTop - 0.6, cz);
  water.userData.noCollide = true;
  cistern.add(water);
  root.add(cistern, gateGroup);
  const wheelAt = wheel.position.clone();
  const gateStand = V(C.x0 - 4, H(C.x0 - 4, cz), cz);
  // the roots grown through the wheel: watered, they let go
  const roots = new THREE.Group();
  {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, r0 = 1.4 + (i % 3) * 0.2;
      const pts = [V(0, -wallH * 0.55, (i - 2.5) * 0.7), V(-0.3, -0.6, Math.cos(a) * r0), V(-0.15, Math.sin(a) * 1.1, Math.cos(a + 1.4) * 1.1), V(0.1, Math.sin(a + 2) * 0.9 + 0.4, Math.cos(a + 2.6) * 0.8)];
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.09 + (i % 2) * 0.04, 5).toNonIndexed());
    }
    const m = new THREE.Mesh(mergeGeometries(parts), rootMat);
    m.userData.noCollide = true;
    roots.add(m);
    roots.position.copy(wheelAt).add(V(-0.25, 0, 0));
    root.add(roots);
  }
  roots.visible = !game.flag('edena.gate.roots') && !flooded();

  // ---------------------------------------------------------------- what the flood leaves (built now, shown after)
  const after = new THREE.Group();
  const path = [];
  for (let x = C.x0 - 0.5; x > T.hollow.x + 4; x -= 1.5) path.push([x, cz + Math.sin(x * 0.11) * 1.2]);
  const mudLane = new THREE.Mesh(stripGeometry(H, path, T.lane.z1 - T.lane.z0 + 2.5, 0.12, 0.08), mudMat);
  const stream = new THREE.Mesh(stripGeometry(H, path, 2.8, 0.26, 0.3), makeMaterial({ color: '#9fcfcf', color2: '#c9b48a', flat: true, glow: 0.1 }));
  const fan = new THREE.Mesh(discGeometry(H, T.hollow.x, T.hollow.z, T.hollow.r * 0.85, 0.1, 3), mudMat);
  const pond = new THREE.Mesh(discGeometry(H, T.hollow.x - 4, T.hollow.z + 2, 9, 0.24, 7), muddyMat);
  for (const m of [mudLane, stream, fan, pond]) { m.userData.noCollide = true; after.add(m); }
  // the gate's slab and its wheel, carried down into the mud; broken wall blocks; uprooted bushes
  const debris = new THREE.Group();
  {
    let s = 4242;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const lay = (m, x, z, lift = 0) => { m.position.set(x, H(x, z) + lift, z); m.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); debris.add(m); return m; };
    lay(new THREE.Mesh(new THREE.BoxGeometry(0.6, wallH - 0.2, gap * 2), stoneMat), T.hollow.x + 10, T.hollow.z - 3, 0.2).rotation.set(0, 0.4, Math.PI / 2 - 0.08);
    const w2 = wheel.clone(); lay(w2, T.hollow.x + 2, T.hollow.z + 7, 0.25); w2.rotation.set(0.1, 0.3, Math.PI / 2 - 0.1);
    for (let i = 0; i < 14; i++) lay(new THREE.Mesh(new THREE.BoxGeometry(1.2 + rnd() * 1.6, 0.6 + rnd() * 0.6, 0.8 + rnd() * 0.8), stoneMat), T.x0 - 6 - rnd() * 22, cz + (rnd() - 0.5) * 24, 0.2);
    const dead = new THREE.InstancedMesh(bushGeo, deadMat, 18);
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, r = 4 + rnd() * T.hollow.r * 0.7, x = T.hollow.x + Math.cos(a) * r, z = T.hollow.z + Math.sin(a) * r;
      dummy.position.set(x, H(x, z) + 0.3, z); dummy.rotation.set(1.2 + rnd(), rnd() * 6, 0.3); dummy.scale.setScalar(0.7 + rnd() * 0.4); dummy.updateMatrix(); dead.setMatrixAt(i, dummy.matrix);
    }
    dead.userData.noCollide = true;
    debris.add(dead);
  }
  after.add(debris);
  root.add(after);

  // ---------------------------------------------------------------- collision: the sides, the lane, the gate
  let laneHandle = null, gateHandle = null;
  if (physics?.addCollider) {
    physics.addCollider(sides);
    physics.addCollider(cistern);
    if (!flooded()) { laneHandle = physics.addCollider(new THREE.Group().add(...lane.map((g) => g.clone()))); gateHandle = physics.addCollider(gateGroup); }
    else physics.addCollider(debris);
  }

  const showAfter = () => {
    for (const g of lane) g.visible = false;
    laneBushes.visible = false;
    gateGroup.visible = false;
    roots.visible = false;
    after.visible = true;
    water.position.y = cBase + 0.2;
    postS.scale.y = 0.55; postS.position.y = wallY + 0.8 - (wallH + 1.6) * 0.225;
    for (const r of runnels) { r.clod.visible = false; r.strip.visible = true; r.strip.userData.lanePart.visible = false; }
  };
  after.visible = false;
  if (flooded()) showAfter();
  // an older save stopped mid-flood: the flood happened
  else if (game.flag('edena.gate.turned')) { game.set('edena.terraces.flooded', true); showAfter(); }

  // ---------------------------------------------------------------- Esk, on the bottom terrace, out of the lane
  const eskAt = (x, z) => V(x, (physics?.groundAt?.(x, L.topAt(3, z) + 3, z, 8) ?? L.topAt(3, z)), z);
  const k3 = L.steps[3];
  const esk = spawn(PEOPLE.esk, { route: [eskAt(k3.xl + 4, -84.5), eskAt(k3.xl + 7.5, -86)], speed: 0.4 });
  const quiet = () => { if (esk) { esk.lines = PEOPLE.esk.linesAfter; esk.lineIdx = 0; } };
  if (flooded()) quiet();
  quests.locate('esk', () => esk.pos);
  quests.locate('clod', () => nextClod().at);
  quests.locate('gate', () => wheelAt);

  // ---------------------------------------------------------------- the runnels: push the clods out, top first
  const mud = new Puffs(scene, { color: '#7d5c3c', max: 90, glow: 0, detail: 0 });
  const spray = new Puffs(scene, { color: '#d9f0f2', max: 90, glow: 0.4, detail: 0 });
  const dust = new Puffs(scene, { color: '#efe6d6', max: 60, glow: 0, detail: 0 });
  const st = { flood: flooded() ? FLOOD_S : -1, notch: 0, roots: roots.visible ? 1 : 0, rootsTo: roots.visible ? 1 : 0, beats: new Set() };
  for (const r of runnels) {
    registerTarget({
      kind: 'clod', radius: 1.0, position: () => r.at, enabled: () => r.clod.visible && flat(player.pos, r.at) < 60,
      onHit: (mode) => {
        if (!quests.isActive(Q) || !quests.reached(Q, 'runnels')) { r.shiver = 1; toast('A clod of silt chokes the runnel. Esk keeps these terraces: ask her first.'); return true; }
        if (mode !== 'push') { r.shiver = 0.6; toast('The silt drinks it up and stays put. Shove it out instead (push).'); return true; }
        if (r.k !== cleared()) {
          r.shiver = 1;
          mud.burst(r.at, { n: 4, rise: 0.8, size: 0.35, spread: 0.6, life: 1.4, gravity: 3 });
          toast('The clod shifts, and slumps back: the runnel above is still choked, so there is nothing to carry the silt away. Top terrace first.');
          return true;
        }
        game.set(`edena.runnel.${r.k}`, true);
        game.set('edena.runnels', cleared() + 1);
        r.out = 0.001;
        mud.burst(r.at, { n: 10, rise: 1.6, size: 0.45, spread: 1.4, life: 1.8, gravity: 4 });
        spray.burst(r.at, { n: 6, rise: 1.2, size: 0.25, spread: 0.8, life: 1.2, gravity: 3 });
        toast(r.k < 2 ? 'The clod slides out of the runnel, and a thread of water runs along it and over the edge to the terrace below.' : 'The last clod goes. Water trickles along all three runnels, thin as string.');
        sound.chime?.();
        return true;
      },
    });
  }

  // ---------------------------------------------------------------- the gate: the roots, then one turn
  const may = (stage) => quests.isActive(Q) && quests.reached(Q, stage);
  registerTarget({
    kind: 'gate', radius: 1.6, position: () => wheelAt, enabled: () => gateGroup.visible && st.flood < 0 && flat(player.pos, wheelAt) < 70,
    onHit: (mode) => {
      if (!may('roots')) { toast(mode === 'push' ? 'The wheel doesn’t move: roots have grown through its spokes. The gate is shut, and not yours to open.' : 'The roots on the wheel drink, and hold on. The gate is shut, and not yours to open.'); return true; }
      if (roots.visible && !game.flag('edena.gate.roots')) {
        if (mode === 'push') { toast('The wheel won’t move: roots have grown through its spokes. Water them first (shoot): they let go if you ask.'); return true; }
        game.set('edena.gate.roots', true);
        st.rootsTo = 0;
        spray.burst(wheelAt, { n: 10, rise: 1, size: 0.3, spread: 1.2, life: 1.6, gravity: 2 });
        toast('The roots drink, and loosen, and draw slowly back out of the spokes, the way the vines did on the ship.');
        sound.chime?.();
        return true;
      }
      if (mode !== 'push') { spray.burst(wheelAt, { n: 4, rise: 0.8, size: 0.25, spread: 0.6, life: 1 }); toast('The wheel is free. One turn: shove it (push).'); return true; }
      if (game.flag('edena.gate.turned')) return true;
      game.set('edena.gate.turned', true);
      st.flood = 0;
      // filmed, the first time (src/story/edena-moments.js): the flood runs on its own clock under it, and its
      // toasts that only say what the panels show wait out (st.filmed); without it, all as before
      st.filmed = !!api.onFlood?.();
      return true;
    },
  });
  registerInteractable({ id: 'terraces.gate', priority: PRIORITY.use, range: 3.5, prompt: 'put your ear to the builders’ wall', at: () => gateStand.clone().add(V(0, 1.6, 0)),
    enabled: () => gateGroup.visible && st.flood < 0 && !may('roots'), distance: (p) => (Math.abs(p.pos.y - gateStand.y) < 4 ? flat(p.pos, gateStand) : Infinity),
    use: () => toast('Behind the white stone, a long way down, water moves: a slow, full sound, like breathing in a big room.') });

  // ---------------------------------------------------------------- the flood
  const beat = (t, id, f) => { if (st.flood >= t && !st.beats.has(id)) { st.beats.add(id); f(); } };
  const laneDrop = lane.map(() => ({ k: 0 }));
  const front = () => C.x0 - Math.max(0, (st.flood - 1.6) / 5.2) * (C.x0 - T.hollow.x);   // the water's leading edge (x), going downhill
  const sheet = new THREE.Mesh(stripGeometry(H, path, T.lane.z1 - T.lane.z0, 0.45, 0.12), foamMat);
  sheet.userData.noCollide = true; sheet.visible = false;
  root.add(sheet);
  const sheetQuads = sheet.geometry.index.count / (path.length - 1);
  const swept = spots.lane.map((b, i) => ({ ...b, i, d: 0, v: 0, spin: (i % 5) - 2 }));
  const shout = (text) => { if (esk) esk.shout = { text, until: esk.time + 3 }; };
  const told = (text) => { if (!st.filmed) toast(text); };   // (filmed, the panels show it)
  function floodStep(dt) {
    st.flood += dt;
    const t = st.flood;
    beat(0, 'notch', () => {
      told('The wheel gives one notch. Water spurts from under the gate, bright, and runs down onto the top terrace.');
      shout('~happy~ That’s it! That’s enough!');
      sound.chime?.();
    });
    beat(1.1, 'crack', () => { told('Something in the builders’ wall cracks, deep, like a bone.'); shout('~scared~ What was that?'); sound.rumble?.(FLOOD_S - 1, 0.5); dust.burst(wheelAt.clone().add(V(0, -2, 0)), { n: 8, rise: 1.5, size: 0.8, spread: 1.4, life: 2.5 }); });
    beat(1.6, 'burst', () => {
      told('The gate tears loose. The cistern comes out all at once.');
      shout('~scared~ Shut it! Shut it!');
      if (gateHandle) { physics.removeCollider(gateHandle); gateHandle = null; }
      gateGroup.visible = false;
      sheet.visible = true;
      for (let i = 0; i < 16; i++) spray.burst(V(C.x0 - 1, cTop - 1, cz + (Math.random() - 0.5) * 3), { n: 2, rise: 3, size: 0.6, spread: 2.5, life: 1.6, gravity: 6, dir: V(-4, 0, 0) });
    });
    beat(5, 'walls', () => { told('The water takes the terraces: the white walls, the rows of tea, one after another.'); shout('~scared~ Get off the slope!'); });
    // the leading edge: the sheet reveals itself downhill; each step of the lane goes as it passes
    const fx = front();
    if (sheet.visible) {
      const n = Math.max(0, Math.min(path.length - 1, Math.round((C.x0 - fx) / 1.5)));
      sheet.geometry.setDrawRange(0, Math.floor(n * sheetQuads));
    }
    lane.forEach((g, j) => {
      const s = L.steps[g.userData.k], D = laneDrop[j];
      if (fx < s.xu && g.visible) {
        if (!D.k) { if (laneHandle && j === 0) { physics.removeCollider(laneHandle); laneHandle = null; } for (let i = 0; i < 6; i++) mud.burst(V(s.xl + Math.random() * 12, L.topAt(s.k, cz) + 0.5, cz + (Math.random() - 0.5) * 14), { n: 2, rise: 2.4, size: 0.8, spread: 2, life: 2, gravity: 5, dir: V(-3, 0, 0) }); }
        D.k = Math.min(1, D.k + dt / 0.9);
        g.position.set(-D.k * 2.5, -D.k * 3.2, 0);
        g.rotation.z = D.k * 0.12;
        if (D.k >= 1) g.visible = false;
      }
    });
    // the bushes in the lane: swept down with it, rolling, sinking
    let moved = false;
    for (const b of swept) {
      if (fx < b.x + 1 && b.d < 1) { b.v = Math.min(9, b.v + dt * 14); b.d = Math.min(1, b.d + (b.v * dt) / Math.max(4, b.x - T.hollow.x)); moved = true; }
      if (!b.d) continue;
      const x = THREE.MathUtils.lerp(b.x, T.hollow.x + 6 + (b.i % 7) * 2 - 6, b.d), z = b.z + Math.sin(b.i * 2.3) * 4 * b.d;
      dummy.position.set(x, H(x, z) + 0.6 * (1 - b.d) - b.d * 0.5, z);
      dummy.rotation.set(b.d * 6 * b.spin, b.i, b.d * 2);
      dummy.scale.setScalar(b.s * (1 - 0.5 * b.d));
      dummy.updateMatrix();
      laneBushes.setMatrixAt(b.i, dummy.matrix);
    }
    if (moved) laneBushes.instanceMatrix.needsUpdate = true;
    if (t > 5.5 && Math.random() < dt * 6) mud.burst(V(T.hollow.x + (Math.random() - 0.5) * 30, H(T.hollow.x, T.hollow.z) + 0.4, T.hollow.z + (Math.random() - 0.5) * 30), { n: 2, rise: 1.4, size: 0.9, spread: 1.6, life: 2 });
    // the mud comes in behind the water and stays
    if (t > 6 && !after.visible) { after.visible = true; debris.visible = false; fan.scale.setScalar(0.001); }
    if (after.visible && t < FLOOD_S) { const k = ease(THREE.MathUtils.clamp((t - 6) / 3.5, 0, 1)); fan.scale.set(k, 1, k); fan.position.set(T.hollow.x * (1 - k), 0, T.hollow.z * (1 - k)); pond.visible = k > 0.6; }
    water.position.y = THREE.MathUtils.lerp(cTop - 0.6, cBase + 0.2, ease(THREE.MathUtils.clamp((t - 1.6) / 6, 0, 1)));
    beat(FLOOD_S, 'quiet', () => {
      sheet.visible = false;
      fan.scale.set(1, 1, 1); fan.position.set(0, 0, 0);
      showAfter();
      debris.visible = true;
      if (physics?.addCollider) physics.addCollider(debris);
      game.set('edena.terraces.flooded', true);
      quiet();
      toast('The water goes quiet. Down the middle of the terraces, where the tea was, there is a long raw slope of mud.');
      shout('~sad~ …');
    });
  }

  // ---------------------------------------------------------------- per frame
  function update(dt) {
    for (const r of runnels) {
      if (r.shiver > 0) { r.shiver = Math.max(0, r.shiver - dt * 2.5); r.clod.position.copy(r.at).add(V(Math.sin(performance.now() * 0.04) * 0.08 * r.shiver, 0, 0)); }
      if (r.out > 0 && r.clod.visible) { r.out += dt; r.clod.position.copy(r.at).add(V(-r.out * 2.2, -r.out * r.out * 3, 0)); r.clod.rotation.z = r.out * 4; if (r.out > 0.6) { r.clod.visible = false; r.strip.visible = true; } }
    }
    if (st.roots !== st.rootsTo) { st.roots = Math.max(st.rootsTo, st.roots - dt / 2); roots.scale.setScalar(Math.max(0.001, st.roots)); if (st.roots <= 0.001) roots.visible = false; }
    if (st.flood >= 0 && !st.beats.has('quiet')) {
      floodStep(dt);
      st.notch = Math.min(1, st.notch + dt * 2);   // the wheel turns its one notch
      wheel.rotation.x = st.notch * 0.6;
    }
    mud.update(dt); spray.update(dt); dust.update(dt);
  }
  // a save loaded already flooded never runs the flood (st.flood is FLOOD_S with the 'quiet' beat taken)
  if (flooded()) st.beats.add('quiet');

  // ---------------------------------------------------------------- coming back: Esk's small job (edena.cutting)
  // A later visit (the quest had already failed when this visit began: edena.esk.back), Esk has decided
  // there is a small job: one tea cutting from the bushes that held, pressed into the mud where the
  // stream runs slow. It stays there on every visit after (edena.cutting.planted).
  if (quests.isFailed?.(Q)) game.set('edena.esk.back', true);
  const cuttingAt = (() => { const [x, z] = path[Math.floor(path.length * 0.55)] ?? [T.hollow.x + 8, cz]; return V(x, H(x, z + 2.4), z + 2.4); })();   // (beside the stream, on the mud)
  cuttingAt.y = H(cuttingAt.x, cuttingAt.z);
  const cutting = new THREE.Group();
  cutting.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 6).translate(0, 0.21, 0), makeMaterial({ color: '#6f5a3a', flat: true })));
  for (const [y, a] of [[0.34, 0.4], [0.27, 2.5], [0.4, 4.4]]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4).scale(1, 0.35, 0.55), bushMat);
    leaf.position.set(Math.cos(a) * 0.06, y, Math.sin(a) * 0.06); leaf.rotation.y = -a;
    cutting.add(leaf);
  }
  cutting.traverse((o) => { o.userData.noCollide = true; });
  cutting.position.copy(cuttingAt);
  cutting.visible = !!game.flag('edena.cutting.planted');
  root.add(cutting);
  quests.locate('cutting', () => cuttingAt);
  registerInteractable({ id: 'edena.cutting', priority: PRIORITY.use, range: 2.6, prompt: 'press the tea cutting into the mud', at: () => cuttingAt.clone().add(V(0, 0.9, 0)),
    enabled: () => quests.stage?.('edena.cutting') === 'plant' && !game.flag('edena.cutting.planted'),
    distance: (p) => (Math.abs(p.pos.y - cuttingAt.y) < 3 ? flat(p.pos, cuttingAt) : Infinity),
    use: () => {
      game.set('edena.cutting.planted', true);
      cutting.visible = true;
      mud.burst?.(cuttingAt.clone().add(V(0, 0.1, 0)), { n: 6, rise: 0.4, size: 0.2, spread: 0.4, life: 1.2, gravity: 2 });
      sound.chime?.();
      toast('You press the mud round the cutting with both thumbs. The stream goes slowly past it.');
    } });

  const api = { update, layout: L, runnels, wheelAt, gateStand, esk, cutting, cuttingAt, state: st, shown: () => ({ after: after.visible, gate: gateGroup.visible, lane: lane.some((g) => g.visible) }),
    // the flood's moment (src/story/edena-moments.js): onFlood() is asked as the gate goes (true: it is filmed)
    onFlood: null, FLOOD_S, flood: { front, cz, cTop, cBase, path, hollow: T.hollow, cistern: C } };
  return api;
}
