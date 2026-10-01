import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain, jitter } from '../world.js';
import { Bird } from '../bird.js';

// ---------------------------------------------------------------------------
// Arzach (Moebius, 1975): a silent, bone-white world of needle spires,
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

const BONE = [
  ['#f4efe2', '#e6dcc6', '#d6c7a8'],
  ['#efe4cf', '#e2cfae', '#f7f1e4'],
  ['#ece6da', '#d9cfc0', '#c9b8a0'],
];

export function createArzach(scene) {
  const rng = mulberry32(1975);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const terrain = new Terrain({
    size: 4000, seg: 420, height,
    material: { color: '#efe6d2', color2: '#f7f0e2', color3: '#d9c7a6', mode: MODE_TERRAIN, ripples: true },
  });
  scene.add(terrain.mesh);
  const bone = (size = 5) => { const p = pick(BONE); return makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, strataSize: size, flat: true }); };
  const movers = [];
  const spires = [];

  // ---------------------------------------------------------- needle spires
  for (let i = 0; i < 90; i++) {
    const x = (rng() * 2 - 1) * 1300, z = (rng() * 2 - 1) * 1300;
    if (Math.hypot(x, z) < 140) continue; // keep the start clear
    const r = 6 + rng() * 16, h = 60 + rng() * rng() * 260;
    const g = new THREE.CylinderGeometry(r * (0.15 + rng() * 0.25), r, h, 9, 12);
    g.translate(0, h / 2, 0);
    jitter(g, 0.22, 0.03, rng() * 100);
    const parts = [g];
    if (rng() < 0.4) { // a flat cap you can land on
      const cr = r * (0.6 + rng() * 0.6);
      parts.push(new THREE.CylinderGeometry(cr, cr * 0.7, 3, 10).translate(0, h, 0));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), bone(3 + rng() * 6));
    const base = terrain.baseAt(x, z, r);
    m.position.set(x, base - 2, z);
    m.rotation.set((rng() - 0.5) * 0.1, rng() * 6, (rng() - 0.5) * 0.1);
    scene.add(m);
    spires.push({ x, z, top: base + h * 0.75, r });
  }

  // ---------------------------------------------------------- stone arches between neighbouring spires
  const archMat = bone(2.5);
  let arches = 0;
  for (let i = 0; i < spires.length && arches < 16; i++) {
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
  for (let i = 0; i < 22; i++) {
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
    // a single dark window
    const win = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 1), makeMaterial({ color: '#34405e', flat: true }));
    win.position.set(x, base + H + 7, z + 15.5);
    scene.add(win);
  }

  // ---------------------------------------------------------- menhirs and pebbles
  for (let i = 0; i < 60; i++) {
    const x = (rng() * 2 - 1) * 1300, z = (rng() * 2 - 1) * 1300;
    const h = 6 + rng() * 14;
    const g = new THREE.BoxGeometry(2 + rng() * 2, h, 1.5 + rng());
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, makeMaterial({ color: '#f1e9d8', flat: true, grid: 2.2 }));
    m.position.set(x, terrain.baseAt(x, z, 2) - 1, z);
    m.rotation.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
    scene.add(m);
  }
  {
    const N = 2500, dummy = new THREE.Object3D(), color = new THREE.Color();
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), makeMaterial({ color: '#ffffff', flat: true }), N);
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

  return {
    id: 'arzach',
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => new Bird(physics),
    mountName: 'bird',
    defaults: { hour: 15.5, preset: 'Arzach' },
    killY: -Infinity,
    atmo: () => ({ tint: [1.02, 0.99, 0.94], fog: 0.75, name: 'Arzach' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}
