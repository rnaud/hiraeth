import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { SandDrifts, driftMaterial } from '../sand-drifts.js';
import { Terrain, jitter } from '../world.js';
import { Bird } from '../bird.js';
import { attachTemple } from '../temples/index.js';
import { stepped } from '../load-steps.js';
import { placeShop } from '../shop-world.js';
import { SHOPS } from '../shop.js';
import { buildBirdTracks, buildRidersRoost, buildRidersMast } from '../vael-ways.js';
import { buildSkyStones, skyStonesHeight, SKY_STONES, SKY_STONES_GROUND } from './arzach2.js';
import { offsetOf } from './names.js';
import { FLORA_WORLDS } from '../flora.js';

// ---------------------------------------------------------------------------
// Vael: a silent, bone-white world of needle spires,
// floating stone ruins and a lone tower. You explore it on a long-beaked bird.
// High-key palette, heavy ink shadows, very few lines.
//
// Since October 2026 Vael and Vael II are one world (docs/systems/worlds.md, "Merged and dismissed worlds"):
// the ship comes down on Vael's plain, the lone tower ahead; north of the landing the plain ends at a cliff
// over a sea of cloud, and out of it rise the sky stones (src/levels/arzach2.js buildSkyStones: the monastery
// on the rose cliff, the needle plateau, the great table, the floating island), reached on the bird, or on
// foot up the long aqueduct from the plain's edge. The sky stones keep their coordinates; Vael's plain, built
// here, is laid out round its landing at VAEL (names.js PART_OFFSET.arzach), its lone tower where theirs stood
// (their plinth with the sleeping face is at its foot now), 38 m up on their plain.
// ---------------------------------------------------------------------------

const noise = createNoise2D(31);
const noiseB = createNoise2D(97);
/** Where Vael's own coordinates sit in the world ([dx, dy, dz]: names.js PART_OFFSET). */
export const VAEL = offsetOf('arzach');
const [OX, OY, OZ] = VAEL;

/** Vael's own ground, in its own coordinates (round its landing at 0, 0): dry canyons in a pale plain. */
export function vaelGround(x, z) {
  let h = fbm(noise, x * 0.0012, z * 0.0012, 4) * 35;
  // dry canyons carved into the plain
  const c = 1 - Math.abs(noiseB(x * 0.003, z * 0.003));
  h -= Math.pow(c, 7) * 45;
  h += fbm(noiseB, x * 0.015, z * 0.015, 2) * 1.5;
  // an open plain around the start
  h = THREE.MathUtils.lerp(fbm(noise, x * 0.0012, z * 0.0012, 4) * 35, h, smoothstep(60, 220, Math.hypot(x, z)));
  return h;
}
/** How much of Vael's ground lies over the sky stones' plain at a distance r from its landing (all of it within 600 m). */
const vaelWeight = (r) => smoothstep(820, 600, r);
/** The world's ground: the sky stones' (the cloud's floor, their plain), Vael's round its landing. */
export const height = skyStonesHeight((x, z) => {
  const lx = x - OX, lz = z - OZ, w = vaelWeight(Math.hypot(lx, lz));
  return w > 0 ? { h: vaelGround(lx, lz) + OY, w } : null;
});
/** Over the cloud (or its cliff), where Vael's plain has nothing of its own: (x, z) in the world. */
const overCloud = (x, z) => z > SKY_STONES.plainEdge(x) - 45 || Math.hypot(x - SKY_STONES.AQ2.b[0], z - SKY_STONES.AQ2.b[1]) < 45;

/** The standing stones up the slope from the landing toward the Aerie: [x, z, height]. */
const STANDING_STONES = [[-24, 5, 4.2], [-42, 3, 5.4], [-60, 1, 4.6], [-78, -1, 6.0]];

export const BONE = [
  ['#f4efe2', '#e6dcc6', '#d6c7a8'],
  ['#f2d6c4', '#e8c0aa', '#f8ecdf'],   // the book's rose-tinted stone
  ['#efe4cf', '#e2cfae', '#f7f1e4'],
  ['#ece6da', '#d9cfc0', '#c9b8a0'],
];

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildArzach(scene) {
  // the ground: the sky stones' (5.2 km, the cloud's floor and their plain) with Vael's laid over it round its landing
  const terrain = yield* Terrain.make({ size: 5200, seg: 480, height, material: SKY_STONES_GROUND });
  scene.add(terrain.mesh);
  // the sky stones first (their own rng and coordinates), then Vael's plain in a group of its own (its sand drifts)
  const stones = yield* buildSkyStones(scene, terrain, { merged: true });
  const plain = new THREE.Group();
  plain.name = 'Vael: the plain';
  scene.add(plain);
  const vael = yield* buildVaelPlain(plain, terrain);
  return finishVael(scene, terrain, stones, vael);
}

/**
 * Vael's plain, built into `scene` (a group) on the world's ground: in its own coordinates, each place moved to
 * where it stands now (+ VAEL). What would stand over the cloud is left out, its draws from the rng kept, so
 * everything else stands where it always stood (the two spires with the shed feathers, the hush-cloth's cap).
 */
function* buildVaelPlain(scene, terrain) {
  const rng = mulberry32(1975);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const bone = (size = 5) => { const p = pick(BONE); return makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, strataSize: size, flat: true }); };
  const movers = [];
  const spires = [];

  // ---------------------------------------------------------- needle spires
  yield;
  const allSpires = [];   // (every spire drawn from the rng, kept or not: the arches below draw over them as they always did)
  for (let i = 0; i < 90; i++) {
    yield;
    const lx = (rng() * 2 - 1) * 1300, lz = (rng() * 2 - 1) * 1300;
    if (Math.hypot(lx, lz) < 140) continue; // keep the start clear
    const x = lx + OX, z = lz + OZ, keep = !overCloud(x, z);
    const r = 6 + rng() * 16, h = 60 + rng() * rng() * 260;
    const g = new THREE.CylinderGeometry(r * (0.15 + rng() * 0.25), r, h, 9, 12);
    g.translate(0, h / 2, 0);
    jitter(g, 0.22, 0.03, rng() * 100);
    const parts = [g];
    let cap = null;
    if (rng() < 0.4) { // a flat cap you can land on
      const cr = r * (0.6 + rng() * 0.6);
      parts.push(new THREE.CylinderGeometry(cr, cr * 0.7, 3, 10).translate(0, h, 0));
      cap = cr;
    }
    const m = new THREE.Mesh(mergeGeometries(parts), bone(3 + rng() * 6));
    const base = terrain.baseAt(x, z, r);
    m.position.set(x, base - 2, z);
    m.rotation.set((rng() - 0.5) * 0.1, rng() * 6, (rng() - 0.5) * 0.1);
    const spire = { x, z, top: base + h * 0.75, r, cap, capY: cap ? base - 2 + h + 1.5 : null };
    allSpires.push({ ...spire, keep });
    if (!keep) { m.geometry.dispose(); continue; }
    scene.add(m);
    spires.push(spire);
  }

  // ---------------------------------------------------------- stone arches between neighbouring spires
  yield;
  const archMat = bone(2.5);
  let arches = 0;
  yield;
  for (let i = 0; i < allSpires.length && arches < 16; i++) {
    yield;
    for (let j = i + 1; j < allSpires.length; j++) {
      const a = allSpires[i], b = allSpires[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 40 || d > 140 || rng() < 0.6) continue;
      // (their heights over Vael's own ground, as they were drawn: the arch's height comes from them)
      const y = (Math.min(a.top, b.top) - OY) * (0.6 + rng() * 0.3) + OY;
      const p0 = new THREE.Vector3(a.x, y, a.z), p1 = new THREE.Vector3(b.x, y, b.z);
      const mid = p0.clone().lerp(p1, 0.5);
      mid.y += d * 0.25;
      const g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 24, 2.5 + rng() * 2, 6);
      if (a.keep && b.keep) scene.add(new THREE.Mesh(g, archMat));
      arches++;
      break;
    }
  }

  // ---------------------------------------------------------- floating ruins
  yield;
  for (let i = 0; i < 22; i++) {
    yield;
    const x = (rng() * 2 - 1) * 1200 + OX, z = (rng() * 2 - 1) * 1200 + OZ;
    const r = 10 + rng() * 22;
    const g = new THREE.ConeGeometry(r, r * (1.5 + rng()), 9, 4);
    g.rotateX(Math.PI);
    g.translate(0, -r * 0.9, 0);
    jitter(g, 0.25, 0.05, rng() * 100);
    const parts = [g];
    const cols = 3 + Math.floor(rng() * 5);
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.3) continue; // broken colonnade
      const a = (c / cols) * Math.PI * 2, cr = r * 0.6;
      const ch = 6 + rng() * 10;
      parts.push(new THREE.CylinderGeometry(1, 1.2, ch, 8).translate(Math.cos(a) * cr, ch / 2, Math.sin(a) * cr));
    }
    if (rng() < 0.5) parts.push(new THREE.BoxGeometry(r * 1.2, 1.6, 3).translate(0, 14, r * 0.6));
    const m = new THREE.Mesh(mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p)), bone(2 + rng() * 3));
    m.position.set(x, terrain.heightAt(x, z) + 90 + rng() * 180, z);
    m.rotation.y = rng() * 6;
    if (!overCloud(x, z)) scene.add(m);
  }

  // ---------------------------------------------------------- the lone tower
  yield;
  const towerInfo = {};
  yield;
  {
    const x = 260 + OX, z = -420 + OZ, base = terrain.baseAt(x, z, 14);
    const H = 240;
    const shaft = new THREE.CylinderGeometry(6, 13, H, 12, 16);
    shaft.translate(0, H / 2, 0);
    jitter(shaft, 0.06, 0.05, 3);
    const room = new THREE.SphereGeometry(16, 16, 12);
    room.scale(1, 0.75, 1);
    room.translate(0, H + 8, 0);
    const balcony = new THREE.CylinderGeometry(20, 20, 1.5, 24).translate(0, H - 3, 0);
    const spike = new THREE.ConeGeometry(2, 30, 6).translate(0, H + 34, 0);
    const tower = new THREE.Mesh(mergeGeometries([shaft, room, balcony, spike].map((p) => p.index ? p.toNonIndexed() : p)),
      makeMaterial({ color: '#f6f0e2', color2: '#e9d9bd', color3: '#d8a24a', mode: MODE_STRATA, strataSize: 12, flat: true }));
    tower.position.set(x, base - 2, z);
    scene.add(tower);
    // a single window: an arched opening in a deep stone frame (jambs, an arch, a keystone), the room's
    // shadowed back wall set in behind it, so it reads as a way in and not as a flat dark panel
    const win = new THREE.Group();
    win.position.set(x, base + H + 7, z + 15.5);
    {
      const frameMat = makeMaterial({ color: '#efe6d2', color2: '#e0d2b8', color3: '#d8a24a', mode: MODE_STRATA, strataSize: 3, flat: true });
      const W2 = 1.6, low = -3.3, spring = 0.9;   // half the opening's width; its foot and where the arch springs (from the window's centre)
      const frame = [
        new THREE.BoxGeometry(0.7, spring - low, 1.5).translate(-W2 - 0.35, (spring + low) / 2, 0.3),
        new THREE.BoxGeometry(0.7, spring - low, 1.5).translate(W2 + 0.35, (spring + low) / 2, 0.3),
        new THREE.TorusGeometry(W2 + 0.35, 0.35, 6, 14, Math.PI).scale(1, 1, 2.1).translate(0, spring, 0.3),
        new THREE.BoxGeometry(0.55, 0.7, 1.7).translate(0, spring + W2 + 0.45, 0.35),   // the keystone
      ].map((g) => (g.index ? g.toNonIndexed() : g));
      win.add(new THREE.Mesh(mergeGeometries(frame), frameMat));
      // the opening: the room's back wall in shadow, a step behind the frame, warm where the light falls in
      const back = new THREE.Shape();
      back.moveTo(-W2, low); back.lineTo(W2, low); back.lineTo(W2, spring); back.absarc(0, spring, W2, 0, Math.PI, false); back.lineTo(-W2, low);
      const hole = new THREE.Mesh(new THREE.ShapeGeometry(back, 10), makeMaterial({ color: '#2a2128', color2: '#241c22', flat: true }));
      hole.position.z = -0.25;
      win.add(hole);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 1.4, 1.1), makeMaterial({ color: '#6e5040', flat: true, glow: 0.18 }));
      glow.position.set(0.15, low + 0.75, -0.2);
      win.add(glow);
    }
    win.traverse((o) => { if (o.isMesh) o.userData.noCollide = true; });
    scene.add(win);
    // a stone sill under the window, and three corbels climbing to it round the
    // room from the balcony: each a jump (or a boost) above the last
    const floor = base - 2 + H - 2.25;                 // the balcony's walking surface
    const sillY = floor + 7.6;
    const stoneMat = makeMaterial({ color: '#efe6d2', color2: '#e0d2b8', color3: '#d8a24a', mode: MODE_STRATA, strataSize: 3, flat: true });
    const steps = [[0.95, floor + 2.5, 17.2], [0.5, floor + 5.0, 17.4]].map(([a, y, r]) => new THREE.Vector3(x + Math.sin(a) * r, y, z + Math.cos(a) * r));
    const stepGeo = steps.map((p, i) => new THREE.BoxGeometry(3.4, 0.9, 3.4).rotateY(i ? 0.5 : 0.95).translate(p.x, p.y - 0.45, p.z));
    stepGeo.push(new THREE.BoxGeometry(6.5, 1.1, 5.2).translate(x, sillY - 0.55, z + 17.4));
    scene.add(new THREE.Mesh(mergeGeometries(stepGeo), stoneMat));
    Object.assign(towerInfo, { x, z, base, H, floor, balcony: new THREE.Vector3(x, floor, z + 13), sill: new THREE.Vector3(x, sillY, z + 17), window: win.position.clone(), windowMesh: win, steps });
  }

  // ---------------------------------------------------------- hero: the fallen colossus and the hand
  yield;
  const handInfo = {}, colossus = {};
  yield;
  {
    const stoneMat = makeMaterial({ color: '#efe6d2', color2: '#e0d2b8', color3: '#cdbb9c', mode: MODE_STRATA, strataSize: 4, flat: true });
    const grp = new THREE.Group();
    const cap = (r, len, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), stoneMat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      grp.add(m);
    };
    cap(17, 46, 0, 8, 0, 0, 0, Math.PI / 2);                 // torso lying along x
    cap(6, 40, -10, 4, 26, 0, 0.35, Math.PI / 2);            // arm flung out
    cap(8, 34, 46, 18, -8, 0, 0, 1.0);                       // raised thigh
    cap(7, 34, 62, 18, -8, 0, 0, -1.0);                      // shin back down
    cap(8, 40, 52, 6, 12, 0, -0.1, Math.PI / 2);             // the other leg
    const head = new THREE.Mesh(new THREE.SphereGeometry(15, 18, 14).scale(1, 1.1, 1), stoneMat);
    head.position.set(-46, 12, 0);
    const face = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12).scale(0.5, 1.05, 0.9), makeMaterial({ color: '#f7f1e4', flat: true }));
    face.position.set(-50, 14, 7);
    face.rotation.y = -0.6;
    grp.add(head, face);
    const x = 170 + OX, z = -260 + OZ;
    grp.position.set(x, terrain.baseAt(x, z, 40) - 6, z);
    grp.rotation.y = 0.7;
    scene.add(grp);
    grp.updateMatrixWorld(true);

    // a giant hand reaching out of the plain: wide open palm, fingers splayed
    // in a fan with a knuckle bend each, thumb out to the side, wrist rising
    // from the sand at an angle so it reads as a hand from far away
    const hand = new THREE.Group();
    const seg = (r, len, from, dir) => {
      const d = dir.clone().normalize();
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), stoneMat);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      m.position.copy(from).addScaledVector(d, len / 2);
      hand.add(m);
      return from.clone().addScaledVector(d, len);
    };
    const palm = new THREE.Mesh(new THREE.BoxGeometry(26, 26, 9), stoneMat);
    palm.geometry.translate(0, 13, 0);
    hand.add(palm);
    seg(9, 26, new THREE.Vector3(0, -24, -2), new THREE.Vector3(0, 1, -0.12));   // forearm
    // (index, middle, ring, little; [x, spread, first joint, rest]: clearly graded, little to middle, so the
    // knuckles' riddle, smallest to tallest, can be read by looking: src/story/knuckle-riddle.js)
    const fingers = [[-9.5, -0.32, 14, 11], [-3.2, -0.1, 20, 15], [3.2, 0.1, 17, 13], [9.5, 0.3, 8, 6]];
    const knuckles = [];
    for (const [fx, spread, l1, l2] of fingers) {
      const base = new THREE.Vector3(fx, 25, 0);
      const knuckle = seg(3, l1, base, new THREE.Vector3(Math.sin(spread), Math.cos(spread), 0));
      seg(2.6, l2, knuckle, new THREE.Vector3(Math.sin(spread) * 1.2, Math.cos(spread), 0.45));  // curls slightly forward
      knuckles.push({ local: knuckle.clone(), length: l1 + l2 });
    }
    const tk = seg(3.6, 13, new THREE.Vector3(-12, 6, 1), new THREE.Vector3(-1, 0.55, 0.15)); // thumb
    seg(3, 10, tk, new THREE.Vector3(-0.45, 1, 0.3));
    const hx = -150 + OX, hz = -210 + OZ;
    hand.position.set(hx, terrain.baseAt(hx, hz, 12) + 2, hz);
    // palm faces the landing, leaning back a little
    hand.rotation.set(-0.15, Math.atan2(OX - hx, OZ - hz), 0.08, 'YXZ');
    scene.add(hand);
    hand.updateMatrixWorld(true);
    // index, middle, ring, little (from the thumb side); the palm's face, a little out from the stone
    handInfo.group = hand;
    handInfo.knuckles = knuckles.map((k) => ({ pos: hand.localToWorld(k.local.clone()), length: k.length }));
    handInfo.palm = hand.localToWorld(new THREE.Vector3(0, 16, 6.5));
    handInfo.normal = new THREE.Vector3(0, 0, 1).applyQuaternion(hand.quaternion);
    colossus.head = grp.localToWorld(new THREE.Vector3(-46, 12, 0));
    colossus.face = grp.localToWorld(new THREE.Vector3(-50, 14, 7));
  }

  // ---------------------------------------------------------- menhirs and pebbles
  yield;
  const menhirs = [];
  yield;
  for (let i = 0; i < 60; i++) {
    yield;
    const x = (rng() * 2 - 1) * 1300 + OX, z = (rng() * 2 - 1) * 1300 + OZ;
    const h = 6 + rng() * 14;
    const g = new THREE.BoxGeometry(2 + rng() * 2, h, 1.5 + rng());
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, makeMaterial({ color: '#f1e9d8', flat: true, grid: 2.2 }));
    m.position.set(x, terrain.baseAt(x, z, 2) - 1, z);
    m.rotation.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
    if (overCloud(x, z)) continue;
    scene.add(m);
    menhirs.push({ x, z, y: m.position.y, h });
  }
  yield;
  {
    const N = 2500, dummy = new THREE.Object3D(), color = new THREE.Color(), kept = [];
    for (let i = 0; i < N; i++) {
      const x = (rng() * 2 - 1) * 1400 + OX, z = (rng() * 2 - 1) * 1400 + OZ;
      const s = 0.4 + Math.pow(rng(), 3) * 5;
      dummy.position.set(x, terrain.heightAt(x, z) + s * 0.25, z);
      dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      const c = pick(['#efe4cf', '#e2d4b8', '#d8c7a6']);
      if (!overCloud(x, z)) kept.push([dummy.matrix.clone(), c]);
    }
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), makeMaterial({ color: '#ffffff', flat: true, pattern: 'cracks' }), kept.length);
    kept.forEach(([mx, c], i) => { rocks.setMatrixAt(i, mx); rocks.setColorAt(i, color.set(c)); });
    rocks.frustumCulled = false;
    scene.add(rocks);
  }

  // ---------------------------------------------------------- mushroom rocks and balanced stones
  // The book's eroded hoodoos: a thin weathered stalk under a wide flat cap,
  // in warm ochre and rose against the pale sand. Their caps are landing spots.
  yield;
  {
    const WARM = [['#e9b8a0', '#f2d2b8', '#d99a86'], ['#e6c08a', '#f0d6a8', '#d0a070'], ['#f0d8c0', '#e2bfa0', '#c98f7a']];
    const prof = [[0, 0], [5.5, 0], [4.2, 0.08], [3.0, 0.25], [2.1, 0.5], [2.0, 0.68], [2.8, 0.78], [7.5, 0.82], [8.2, 0.88], [7.0, 0.96], [0, 1]];
    for (let i = 0; i < 48; i++) {
      const a = rng() * Math.PI * 2, r = 150 + Math.pow(rng(), 0.7) * 1050;
      const x = Math.cos(a) * r + OX, z = Math.sin(a) * r + OZ;
      const s = 0.7 + rng() * 1.5, h = (16 + rng() * 26) * s, lean = (rng() - 0.5) * 0.25;
      const g = new THREE.LatheGeometry(prof.map(([pr, py]) => new THREE.Vector2(pr * s * (0.8 + rng() * 0.4), py * h)), 11);
      jitter(g, 0.18, 0.04, rng() * 50);
      const p = pick(WARM);
      const m = new THREE.Mesh(g, makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, strataSize: 2 + rng() * 2.5, flat: true }));
      m.position.set(x, terrain.baseAt(x, z, 5 * s) - 1.5, z);
      m.rotation.set(lean, rng() * 6, lean * 0.5);
      if (!overCloud(x, z)) scene.add(m);
    }
    for (let i = 0; i < 12; i++) {   // a boulder balanced on a needle
      const a = rng() * Math.PI * 2, r = 180 + rng() * 800;
      const x = Math.cos(a) * r + OX, z = Math.sin(a) * r + OZ, s = 0.8 + rng();
      const ped = new THREE.CylinderGeometry(1.2 * s, 3.4 * s, 12 * s, 7, 4).translate(0, 6 * s, 0);
      const stone = new THREE.IcosahedronGeometry(5.5 * s, 1).scale(1.2, 0.8, 1).translate(0.8 * s, 12 * s + 3.6 * s, 0);
      jitter(ped, 0.15, 0.04, i); jitter(stone, 0.2, 0.05, i + 9);
      const m = new THREE.Mesh(mergeGeometries([ped, stone].map((g) => (g.index ? g.toNonIndexed() : g))), bone(3));
      m.position.set(x, terrain.baseAt(x, z, 4 * s) - 1, z);
      m.rotation.y = rng() * 6;
      if (!overCloud(x, z)) scene.add(m);
    }
  }

  // a line of standing stones up the slope from the landing toward the Aerie: the landing sits in a hollow and
  // shows nothing to the west, so the stones lead the eye up to the plateau's edge, where the white house comes
  // into view (level design audit v1.9: the first leg was blind). No rng: the world round them stays as it was.
  {
    const mat = makeMaterial({ color: BONE[0][0], color2: BONE[0][1], color3: BONE[0][2], mode: MODE_STRATA, strataSize: 2, flat: true }), geos = [];
    STANDING_STONES.forEach(([lx, lz, h], i) => {
      const x = lx + OX, z = lz + OZ;
      const g = new THREE.CylinderGeometry(0.7, 1.15, h, 5, 2).translate(0, h / 2, 0).rotateZ((i % 2 ? 1 : -1) * 0.05).rotateY(i * 1.3);
      jitter(g, 0.12, 0.05, 70 + i);
      geos.push(g.translate(x, terrain.baseAt(x, z, 1.2) - 0.5, z));
    });
    scene.add(new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat));
  }

  // sand banked against what stands on the sand: every collided mesh of Vael's plain (sand-drifts.js)
  yield;
  const sand = new SandDrifts({ heightAt: (x, z) => terrain.heightAt(x, z), seed: 5 }).addScene(scene);
  const drifts = sand.build(driftMaterial(makeMaterial, terrain.materialOptions));
  if (drifts) scene.add(drifts);
  sand.raise(terrain);   // (from here on the ground's height is the sand's, drifts and all)
  // the ways home (src/vael-ways.js, level design audit v1.15): the bird's old tracks from the Aerie down to Oïa's stone,
  // past the rider's mounting stone; the rider's roost, a floating stone on the bird's line from the tower to the landing
  const tracks = buildBirdTracks(scene, terrain), roost = buildRidersRoost(scene);
  // Brin's Wind-Shelf (src/shop-world.js, src/shop-fronts.js 'hoodoo'): carved into a hoodoo's foot on the long walk
  // from the landing to the lone tower (its emptiest stretch, docs/audits/level-design-v1.9.md), 11 m off the
  // straight line, its door turned to the walkers coming from the landing
  const shop = placeShop(scene, { def: SHOPS.windshelf, at: new THREE.Vector3(52 + OX, terrain.heightAt(52 + OX, -104 + OZ), -104 + OZ), heading: 0.55 });
  return { towerInfo, handInfo, colossus, spires, menhirs, tracks, roost, shop, movers };
}

/** The sky stones and Vael's plain made one level: the two temples (the Aerie on the plain, the Founders' Belfry over the cloud). */
function finishVael(scene, terrain, S, V) {
  const { towerInfo, handInfo, colossus, spires, menhirs, tracks, roost, shop, movers } = V;
  // the riders' mast under the crest past the last standing stone: from the landing it shows where Oïa points (src/vael-ways.js;
  // added to the scene last, after the temples, so the contact audit's samples of what stood before stay where they were)
  const mastGroup = new THREE.Group(), mast = buildRidersMast(mastGroup, terrain);
  const spawn = new THREE.Vector3(OX, terrain.heightAt(OX, OZ), OZ);
  const avoidS = S.floraAvoid, avoidV = shop.avoid();
  const level = {
    ...S,
    id: 'arzach',
    portals: [...shop.portals, ...S.portals],
    lights: [...shop.lights, ...S.lights],
    shops: [shop, ...S.shops],   // (src/story/shops.js: the keepers behind their counters; main.js: the shop panel)
    floraAvoid: (x, z, r = 0) => !!avoidV?.(x, z, r) || !!avoidS?.(x, z, r),
    ground: terrain,
    spawn,
    partSpawns: { arzach2: S.spawn },   // (where the sky stones' own landing was, on their first plateau: their creatures live round it)
    // the flora of both (src/flora.js level.flora): Vael's over its plain round the landing, up to the cliff over the
    // cloud; the sky stones' on their plateaus and the plain's far edge, as it always grew
    flora: [
      { ...FLORA_WORLDS.arzach, world: 'arzach', regions: [{ x: OX, z: OZ, r0: 30, r: 360, w: 1.5 }, { x0: OX - 1250, x1: OX + 1250, z0: OZ - 1250, z1: -980, w: 3 }] },
      { ...FLORA_WORLDS.arzach2, world: 'arzach2' },
    ],
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    // the story's places (src/story/arzach.js): the tower's balcony, steps and window, the hand's knuckles
    arzach: { tower: towerInfo, hand: handInfo, colossus, spires, menhirs, tracks, roost, mast },
    // (the sky stones' own: S.arzach2, src/story/arzach2.js)
    // the lone tower is the weenie, but the audit's height grid ranks it out behind the floating ruins
    // (scripts/level-design/audit.mjs: a level's beacons are aimed at as landmarks): its spire's tip
    // (and the riders' mast over the slope west of the landing, toward the Aerie: thin, so the grid never sees it)
    beacons: [{ name: 'the lone tower', top: [towerInfo.x, towerInfo.base - 2 + towerInfo.H + 49, towerInfo.z], height: 60 }, { name: 'the riders’ mast', top: [mast.top.x, mast.top.y, mast.top.z], height: 16 }, ...S.beacons],
    // what the eye follows on the ground (the audit counts a line that leads to where a goal comes into view as guiding)
    // (the bird's tracks are the way back from the Aerie, not the way up: Oïa's stage names them)
    lines: [{ name: 'the standing stones', points: STANDING_STONES.map(([x, z]) => [x + OX, z + OZ]) }, { name: 'the bird’s tracks', points: tracks.points, auto: false }, ...S.lines],
    // things to stop for that are neither people nor quests (the audit counts them as places)
    sights: [{ name: 'the rider’s mounting stone', at: tracks.mount.at }, { name: 'the rider’s roost', at: roost.top }, { name: 'the riders’ mast', at: mast.at }, ...S.sights],
    mount: (physics) => new Bird(physics),
    mountName: 'bird',
    life: {
      flocks: [{ count: 5, color: '#f4efe2', size: 3.2, radius: 160, height: [60, 140], speed: 0.06, seed: 2 },
               { count: 4, color: '#e6dcc6', size: 2.6, radius: 90, height: [40, 90], speed: -0.08, seed: 7 }],
      motes: { count: 120, color: '#f1e9d8', size: 0.05, wind: [0.8, 0.3] },
      footprints: '#d9c9a8',
    },
    // (the sky: the sky stones' sheets, aqua over a peach horizon, the shadow one grey-blue; S.sky, S.defaults)
    killY: -Infinity,
    // the foes of the part you stand in: the plain's (Vael's), the sky stones' over the cloud (src/foes.js worldHere)
    foes: { partAt: (x, z) => (z > SKY_STONES.plainEdge(x) - 40 ? 'arzach2' : 'arzach') },
    // where you are: the plain round the landing, the plain's far side, the sky stones over the cloud (the region's caption)
    atmo: (x, z) => ({ tint: [1.02, 0.99, 0.95], fog: 0.7, name: z > SKY_STONES.plainEdge(x) - 40 ? 'Vael · the sky stones' : 'Vael' }),
    update(dt, t) { for (const m of movers) m(t); for (const m of S.movers) m(t); roost.wave(t); mast.wave(t); },
  };
  // the Founders' Belfry out of the cloud west of the sky stones' first plateau, and the Aerie on the plain west of the
  // landing; their rooms far overhead (src/temples/arzach2.js, src/temples/arzach.js)
  attachTemple('arzach2', scene, level);
  attachTemple('arzach', scene, level);
  scene.add(mastGroup);
  return level;
}
export const createArzach = stepped(buildArzach);
