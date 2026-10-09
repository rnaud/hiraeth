import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { SandDrifts, driftMaterial } from '../sand-drifts.js';
import { Terrain, jitter } from '../world.js';
import { Bird } from '../bird.js';
import { attachTemple } from '../temples/index.js';
import { stepped } from '../load-steps.js';

// ---------------------------------------------------------------------------
// Vael: a silent, bone-white world of needle spires,
// floating stone ruins and a lone tower. You explore it on a long-beaked bird.
// High-key palette, heavy ink shadows, very few lines.
// ---------------------------------------------------------------------------

const noise = createNoise2D(31);
const noiseB = createNoise2D(97);

function height(x, z) {
  let h = fbm(noise, x * 0.0012, z * 0.0012, 4) * 35;
  // dry canyons carved into the plain
  const c = 1 - Math.abs(noiseB(x * 0.003, z * 0.003));
  h -= Math.pow(c, 7) * 45;
  h += fbm(noiseB, x * 0.015, z * 0.015, 2) * 1.5;
  // an open plain around the start
  h = THREE.MathUtils.lerp(fbm(noise, x * 0.0012, z * 0.0012, 4) * 35, h, smoothstep(60, 220, Math.hypot(x, z)));
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1300, 1950, edge) * (220 + fbm(noise, x * 0.004, z * 0.004, 3) * 160);
  return h;
}

export const BONE = [
  ['#f4efe2', '#e6dcc6', '#d6c7a8'],
  ['#f2d6c4', '#e8c0aa', '#f8ecdf'],   // the book's rose-tinted stone
  ['#efe4cf', '#e2cfae', '#f7f1e4'],
  ['#ece6da', '#d9cfc0', '#c9b8a0'],
];

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildArzach(scene) {
  const rng = mulberry32(1975);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const terrain = yield* Terrain.make({
    size: 4000, seg: 420, height,
    material: { color: '#f0dcc0', color2: '#f7ead4', color3: '#e3bf9c', mode: MODE_TERRAIN, ripples: true },   // warm peach sand
  });
  scene.add(terrain.mesh);
  const bone = (size = 5) => { const p = pick(BONE); return makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, strataSize: size, flat: true }); };
  const movers = [];
  const spires = [];

  // ---------------------------------------------------------- needle spires
  yield;
  for (let i = 0; i < 90; i++) {
    yield;
    const x = (rng() * 2 - 1) * 1300, z = (rng() * 2 - 1) * 1300;
    if (Math.hypot(x, z) < 140) continue; // keep the start clear
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
    scene.add(m);
    spires.push({ x, z, top: base + h * 0.75, r, cap, capY: cap ? base - 2 + h + 1.5 : null });
  }

  // ---------------------------------------------------------- stone arches between neighbouring spires
  yield;
  const archMat = bone(2.5);
  let arches = 0;
  yield;
  for (let i = 0; i < spires.length && arches < 16; i++) {
    yield;
    for (let j = i + 1; j < spires.length; j++) {
      const a = spires[i], b = spires[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 40 || d > 140 || rng() < 0.6) continue;
      const y = Math.min(a.top, b.top) * (0.6 + rng() * 0.3);
      const p0 = new THREE.Vector3(a.x, y, a.z), p1 = new THREE.Vector3(b.x, y, b.z);
      const mid = p0.clone().lerp(p1, 0.5);
      mid.y += d * 0.25;
      const g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 24, 2.5 + rng() * 2, 6);
      scene.add(new THREE.Mesh(g, archMat));
      arches++;
      break;
    }
  }

  // ---------------------------------------------------------- floating ruins
  yield;
  for (let i = 0; i < 22; i++) {
    yield;
    const x = (rng() * 2 - 1) * 1200, z = (rng() * 2 - 1) * 1200;
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
    scene.add(m);
  }

  // ---------------------------------------------------------- the lone tower
  yield;
  const towerInfo = {};
  yield;
  {
    const x = 260, z = -420, base = terrain.baseAt(x, z, 14);
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
    const x = 170, z = -260;
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
    const fingers = [[-9.5, -0.32, 14, 11], [-3.2, -0.1, 20, 15], [3.2, 0.1, 17, 13], [9.5, 0.3, 9, 8]];
    const knuckles = [];
    for (const [fx, spread, l1, l2] of fingers) {
      const base = new THREE.Vector3(fx, 25, 0);
      const knuckle = seg(3, l1, base, new THREE.Vector3(Math.sin(spread), Math.cos(spread), 0));
      seg(2.6, l2, knuckle, new THREE.Vector3(Math.sin(spread) * 1.2, Math.cos(spread), 0.45));  // curls slightly forward
      knuckles.push({ local: knuckle.clone(), length: l1 + l2 });
    }
    const tk = seg(3.6, 13, new THREE.Vector3(-12, 6, 1), new THREE.Vector3(-1, 0.55, 0.15)); // thumb
    seg(3, 10, tk, new THREE.Vector3(-0.45, 1, 0.3));
    const hx = -150, hz = -210;
    hand.position.set(hx, terrain.baseAt(hx, hz, 12) + 2, hz);
    // palm faces the start (the origin), leaning back a little
    hand.rotation.set(-0.15, Math.atan2(-hx, -hz), 0.08, 'YXZ');
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
    const x = (rng() * 2 - 1) * 1300, z = (rng() * 2 - 1) * 1300;
    const h = 6 + rng() * 14;
    const g = new THREE.BoxGeometry(2 + rng() * 2, h, 1.5 + rng());
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, makeMaterial({ color: '#f1e9d8', flat: true, grid: 2.2 }));
    m.position.set(x, terrain.baseAt(x, z, 2) - 1, z);
    m.rotation.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
    scene.add(m);
    menhirs.push({ x, z, y: m.position.y, h });
  }
  yield;
  {
    const N = 2500, dummy = new THREE.Object3D(), color = new THREE.Color();
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), makeMaterial({ color: '#ffffff', flat: true, pattern: 'cracks' }), N);
    for (let i = 0; i < N; i++) {
      const x = (rng() * 2 - 1) * 1400, z = (rng() * 2 - 1) * 1400;
      const s = 0.4 + Math.pow(rng(), 3) * 5;
      dummy.position.set(x, terrain.heightAt(x, z) + s * 0.25, z);
      dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      rocks.setColorAt(i, color.set(pick(['#efe4cf', '#e2d4b8', '#d8c7a6'])));
    }
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
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const s = 0.7 + rng() * 1.5, h = (16 + rng() * 26) * s, lean = (rng() - 0.5) * 0.25;
      const g = new THREE.LatheGeometry(prof.map(([pr, py]) => new THREE.Vector2(pr * s * (0.8 + rng() * 0.4), py * h)), 11);
      jitter(g, 0.18, 0.04, rng() * 50);
      const p = pick(WARM);
      const m = new THREE.Mesh(g, makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, strataSize: 2 + rng() * 2.5, flat: true }));
      m.position.set(x, terrain.baseAt(x, z, 5 * s) - 1.5, z);
      m.rotation.set(lean, rng() * 6, lean * 0.5);
      scene.add(m);
    }
    for (let i = 0; i < 12; i++) {   // a boulder balanced on a needle
      const a = rng() * Math.PI * 2, r = 180 + rng() * 800;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.8 + rng();
      const ped = new THREE.CylinderGeometry(1.2 * s, 3.4 * s, 12 * s, 7, 4).translate(0, 6 * s, 0);
      const stone = new THREE.IcosahedronGeometry(5.5 * s, 1).scale(1.2, 0.8, 1).translate(0.8 * s, 12 * s + 3.6 * s, 0);
      jitter(ped, 0.15, 0.04, i); jitter(stone, 0.2, 0.05, i + 9);
      const m = new THREE.Mesh(mergeGeometries([ped, stone].map((g) => (g.index ? g.toNonIndexed() : g))), bone(3));
      m.position.set(x, terrain.baseAt(x, z, 4 * s) - 1, z);
      m.rotation.y = rng() * 6;
      scene.add(m);
    }
  }

  // the Aerie on the plain west of the landing, and its rooms far overhead (src/temples/arzach.js)
  yield;
  // sand banked against what stands on the sand: every collided mesh built so far (sand-drifts.js)
  const sand = new SandDrifts({ heightAt: (x, z) => terrain.heightAt(x, z), seed: 5 }).addScene(scene);
  const drifts = sand.build(driftMaterial(makeMaterial, terrain.materialOptions));
  if (drifts) scene.add(drifts);
  sand.raise(terrain);   // (from here on the ground's height is the sand's, drifts and all)
  return attachTemple('arzach', scene, {
    id: 'arzach',
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    // the story's places (src/story/arzach.js): the tower's balcony, steps and window, the hand's knuckles
    arzach: { tower: towerInfo, hand: handInfo, colossus, spires, menhirs },
    mount: (physics) => new Bird(physics),
    mountName: 'bird',
    // (v0.95: the cast shadows on the open sand lifted halfway, as the sheets leave them pale or out)
    defaults: { hour: 15.5, preset: 'Moebius print', look: { uCast: [0.45, 0.1] } },
    life: {
      flocks: [{ count: 5, color: '#f4efe2', size: 3.2, radius: 160, height: [60, 140], speed: 0.06, seed: 2 },
               { count: 4, color: '#e6dcc6', size: 2.6, radius: 90, height: [40, 90], speed: -0.08, seed: 7 }],
      motes: { count: 120, color: '#f1e9d8', size: 0.05, wind: [0.8, 0.3] },
      footprints: '#d9c9a8',
    },
    sky: {
      // almost monochrome bone, with warm ochre shadows as the one accent
      script: {
        // the book: aqua sky over a peach horizon, rose-mauve shadows (v0.95: a cooler, paler lilac-grey, as the sheets'
        //  shade on the watchers' white robes and the Sky Stones' plain)
        day: ['#7cc1c4', '#f4d4b6', '#aca2b6', '#fff4e6', '#fff0d8'],
        dusk: ['#c9b9a4', '#f2cfa8', '#b0705a', '#ffe0c0', '#fff0d6'],
        night: ['#2a2a38', '#4c4a58', '#3c3448', '#a8a4b8', '#f2f0e6'],
      },
      planets: [{ az: 140, el: 32, size: 6, color: '#efe6d2' }, { az: 120, el: 22, size: 2.4, color: '#d8c7a6' }],
    },
    killY: -Infinity,
    atmo: () => ({ tint: [1.02, 0.99, 0.94], fog: 0.75, name: 'Vael' }),
    update(dt, t) { for (const m of movers) m(t); },
  });
}
export const createArzach = stepped(buildArzach);
