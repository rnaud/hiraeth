import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { Terrain, jitter } from '../world.js';
import { Hoverbike } from '../bike.js';

// ---------------------------------------------------------------------------
// Perdide, from Les Maîtres du temps (René Laloux, 1982, designed by Moebius):
// a swamp planet of humming crystal forests, carnivorous plants and glowing
// eggs, lit at twilight. Cross the deep water on a hover-skiff; wading too
// deep puts you back on the last dry ground. A crystal cave glows from within.
// ---------------------------------------------------------------------------

const WATER = 0;
const DEEP = -1.6;              // deeper than this is unsafe on foot
const CAVE = { x: -170, z: 140, len: 130, r: 12, rot: 0.6 };
const noise = createNoise2D(1982);
const noiseB = createNoise2D(44);

function height(x, z) {
  let h = fbm(noise, x * 0.0022, z * 0.0022, 4) * 14 - 2.5;
  // channels of open water
  const ch = 1 - Math.abs(noiseB(x * 0.0035, z * 0.0035));
  h -= Math.pow(ch, 5) * 9;
  h += fbm(noiseB, x * 0.02, z * 0.02, 2) * 0.8;
  // dry islands: around the start and under the cave
  h = Math.max(h, THREE.MathUtils.lerp(-10, 2.2, smoothstep(70, 15, Math.hypot(x, z))));
  const cd = Math.hypot(x - CAVE.x, z - CAVE.z);
  h = THREE.MathUtils.lerp(h, 1.6, smoothstep(110, 70, cd));
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1200, 1900, edge) * (150 + fbm(noise, x * 0.004, z * 0.004, 3) * 120);
  return h;
}

function buildSkiff() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hull = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(1.4, 0.5, 3.6),
    new THREE.ConeGeometry(0.7, 1.6, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).translate(0, 0, 2.6),
  ]), makeMaterial({ color: '#d9643a', flat: true }));
  const outrigger = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6).rotateX(Math.PI / 2), makeMaterial({ color: '#f3ead8' }));
  outrigger.position.set(1.6, -0.15, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.2), makeMaterial({ color: '#34405e' }));
  arm.position.set(0.8, 0.05, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), makeMaterial({ color: '#34405e' }));
  mast.position.set(0, 1.8, 0.6);
  const sailGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.3, 0.6), new THREE.Vector3(0, 3.4, 0.6), new THREE.Vector3(0, 0.6, -1.6),
  ]);
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, makeMaterial({ color: '#f2c54b', side: THREE.DoubleSide }));
  sail.position.y = 0.2;
  const seatAnchor = new THREE.Group();
  seatAnchor.position.set(0, -0.6, -0.6);
  body.add(hull, outrigger, arm, mast, sail, seatAnchor);
  return { root, body, seatAnchor };
}

const CRYSTAL = ['#a99be0', '#62c3c9', '#c7a6f2', '#7fe0d0'];

export function createPerdide(scene) {
  const rng = mulberry32(1982);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const terrain = new Terrain({
    size: 4000, seg: 480, height,
    material: { color: '#6f8a62', color2: '#86a070', color3: '#7a6a86', mode: MODE_TERRAIN, ticks: true },   // olive moss with violet mud
  });
  scene.add(terrain.mesh);
  const movers = [];
  const lights = [];   // crystal groves, egg clutches: they light the swamp around them

  // ---------------------------------------------------------- water
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(-Math.PI / 2),
      makeMaterial({ color: '#3f8f95', color2: '#4fa3a3', mode: MODE_WATER }));
    water.position.y = WATER;
    water.userData.noCollide = true;
    scene.add(water);
  }

  // ---------------------------------------------------------- crystal forests
  function crystals(cx, cz, count, spread, scale = 1) {
    lights.push(new THREE.Vector4(cx, terrain.heightAt(cx, cz) + 4, cz, spread * 0.5 + 14));
    const parts = { };
    for (let i = 0; i < count; i++) {
      const x = cx + (rng() - 0.5) * spread, z = cz + (rng() - 0.5) * spread;
      const h = (6 + rng() * rng() * 40) * scale, r = (0.8 + rng() * 2.5) * scale;
      const g = new THREE.CylinderGeometry(0, r, h, 5, 1);
      g.translate(0, h / 2, 0);
      g.rotateX((rng() - 0.5) * 0.5).rotateZ((rng() - 0.5) * 0.5);
      g.translate(x, terrain.heightAt(x, z) - 0.5, z);
      const c = pick(CRYSTAL);
      (parts[c] ??= []).push(g.toNonIndexed());
    }
    for (const [c, list] of Object.entries(parts))
      scene.add(new THREE.Mesh(mergeGeometries(list), makeMaterial({ color: c, flat: true, glow: 0.55 })));
  }
  crystals(40, -70, 60, 50);
  for (let i = 0; i < 24; i++) crystals((rng() * 2 - 1) * 1100, (rng() * 2 - 1) * 1100, 30 + Math.floor(rng() * 50), 40 + rng() * 60);

  // ---------------------------------------------------------- carnivorous plants (they snap when you come close)
  const plants = [];
  function plant(x, z) {
    const base = terrain.heightAt(x, z);
    const h = 6 + rng() * 8;
    const p0 = new THREE.Vector3(0, 0, 0), p1 = new THREE.Vector3((rng() - 0.5) * 3, h * 0.6, (rng() - 0.5) * 3), p2 = new THREE.Vector3(0, h, 0);
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 12, 0.45, 6), makeMaterial({ color: '#6f9a5a' }));
    const grp = new THREE.Group();
    grp.position.set(x, base, z);
    grp.add(stalk);
    const head = new THREE.Group();
    head.position.copy(p2);
    head.userData.noCollide = true;
    const jawMat = makeMaterial({ color: '#d9506a' });
    const teethMat = makeMaterial({ color: '#f3ead8', flat: true });
    const jaws = [];
    for (const side of [-1, 1]) {
      const jaw = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), jawMat);
      shell.rotation.x = side > 0 ? 0 : Math.PI;
      jaw.add(shell);
      for (let t = 0; t < 7; t++) {
        const a = (t / 7) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4), teethMat);
        tooth.position.set(Math.cos(a) * 1.8, side * -0.3, Math.sin(a) * 1.8);
        tooth.rotation.x = side > 0 ? Math.PI : 0;
        jaw.add(tooth);
      }
      head.add(jaw);
      jaws.push({ jaw, side });
    }
    head.rotation.z = Math.PI / 2;
    grp.add(head);
    scene.add(grp);
    plants.push({ jaws, pos: new THREE.Vector3(x, base + h, z), open: 1 });
  }
  for (let i = 0; i < 40; i++) {
    const x = (rng() * 2 - 1) * 900, z = (rng() * 2 - 1) * 900;
    if (terrain.heightAt(x, z) > 0.3 && Math.hypot(x, z) > 25) plant(x, z);
  }
  plant(22, 18);

  // ---------------------------------------------------------- glowing egg clutches
  function eggs(cx, cz) {
    lights.push(new THREE.Vector4(cx, terrain.heightAt(cx, cz) + 1.5, cz, 11));
    const list = [];
    for (let i = 0; i < 5 + Math.floor(rng() * 8); i++) {
      const x = cx + (rng() - 0.5) * 8, z = cz + (rng() - 0.5) * 8, s = 0.7 + rng() * 0.9;
      list.push(new THREE.SphereGeometry(1, 10, 8).scale(s, s * 1.4, s).translate(x, terrain.heightAt(x, z) + s, z).toNonIndexed());
    }
    scene.add(new THREE.Mesh(mergeGeometries(list), makeMaterial({ color: pick(['#f6c7a0', '#f2a7b5', '#f2e38f']), glow: 1 })));
  }
  eggs(-14, -22);
  for (let i = 0; i < 30; i++) {
    const x = (rng() * 2 - 1) * 1000, z = (rng() * 2 - 1) * 1000;
    if (terrain.heightAt(x, z) > 0.3) eggs(x, z);
  }

  // ---------------------------------------------------------- hero: the Great Crystal
  {
    const gx = 120, gz = -150, base = terrain.heightAt(gx, gz);
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const h = 35 + rng() * 60, r = 5 + rng() * 7;
      const g = new THREE.CylinderGeometry(0, r, h, 6).translate(0, h / 2, 0);
      g.rotateX((rng() - 0.5) * 0.6).rotateZ((rng() - 0.5) * 0.6);
      g.translate((rng() - 0.5) * 16, -2, (rng() - 0.5) * 16);
      parts.push(g.toNonIndexed());
    }
    const cr = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: '#c7a6f2', flat: true, glow: 0.8 }));
    cr.position.set(gx, base, gz);
    scene.add(cr);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 8, 48), makeMaterial({ color: '#8a7f8f', color2: '#6f6a80', color3: '#a99bb0', mode: 2, strataSize: 1.5, flat: true }));
    ring.position.set(gx, base + 26, gz);
    ring.rotation.set(1.2, 0.3, 0.2);
    scene.add(ring);
    lights.push(new THREE.Vector4(gx, base + 20, gz, 60));
  }

  // ---------------------------------------------------------- the crystal cave
  // A thick rock arch corridor: dark inside, lit by its own crystals.
  {
    const grp = new THREE.Group();
    grp.position.set(CAVE.x, 1.6, CAVE.z);
    grp.rotation.y = CAVE.rot;
    const T = 7; // wall thickness
    // half-cylinders around the z axis, arching over +y
    const halfTube = (r, segs = 24) => new THREE.CylinderGeometry(r, r, CAVE.len, segs, 6, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    const rock = makeMaterial({ color: '#8a7f8f', color2: '#6f6a80', color3: '#a99bb0', mode: 2, strataSize: 2.2, flat: true, side: THREE.DoubleSide });
    const outer = halfTube(CAVE.r + T, 20);
    grp.add(new THREE.Mesh(halfTube(CAVE.r), rock), new THREE.Mesh(outer, rock));
    for (const sz of [-1, 1]) {   // half-annulus end faces framing the openings
      const face = new THREE.RingGeometry(CAVE.r, CAVE.r + T, 24, 1, 0, Math.PI);
      if (sz < 0) face.rotateY(Math.PI);
      face.translate(0, 0, sz * CAVE.len / 2);
      grp.add(new THREE.Mesh(face, rock));
    }
    // boulders along the ridge so it reads as a rocky hill
    for (let i = 0; i < 14; i++) {
      const s2 = 4 + rng() * 7;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s2, 0), rock);
      b.position.set((rng() - 0.5) * 20, CAVE.r + T - 2 + rng() * 3, (rng() - 0.5) * CAVE.len * 0.9);
      b.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      grp.add(b);
    }
    // crystals growing inward from the vault
    const inside = [];
    for (let i = 0; i < 46; i++) {
      const zz = (rng() - 0.5) * CAVE.len * 0.9, a = 0.15 + rng() * (Math.PI - 0.3);
      const h = 2 + rng() * 5;
      const g = new THREE.CylinderGeometry(0, 0.4 + rng() * 0.8, h, 5).translate(0, h / 2, 0);
      const nx = Math.cos(a), ny = Math.sin(a);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-nx, -ny, 0)));
      g.translate(nx * CAVE.r * 0.97, ny * CAVE.r * 0.97, zz);
      inside.push(g.toNonIndexed());
    }
    grp.add(new THREE.Mesh(mergeGeometries(inside), makeMaterial({ color: '#7fe0d0', flat: true, glow: 1 })));
    scene.add(grp);
  }

  const unsafe = (p) => terrain.heightAt(p.x, p.z) < DEEP && p.y < WATER + 0.5;

  // ---------------------------------------------------------- giant fungus trees and reeds
  // The film's swamp flora: swollen violet stalks under broad, softly glowing
  // caps, and dark reeds crowding every waterline.
  {
    const prof = [[0, 0], [2.6, 0], [3.8, 0.07], [3.2, 0.2], [1.5, 0.45], [1.25, 0.7], [1.9, 0.79], [8.5, 0.83], [9.5, 0.88], [7.0, 0.96], [0, 1]];
    const STALK = ['#8a6fb8', '#7a5fa0', '#9a7fc4'], CAP = ['#d6ff9a', '#f2a7b5', '#7fe0d0', '#f2c54b'];
    const stalks = {}, caps = {};
    for (let i = 0; i < 70; i++) {
      const x = (rng() * 2 - 1) * 1200, z = (rng() * 2 - 1) * 1200;
      if (Math.hypot(x, z) < 45) continue;
      const g0 = terrain.heightAt(x, z);
      if (g0 < DEEP - 2) continue;
      const s = 0.6 + rng() * 1.8, H = (14 + rng() * 22) * s;
      const geo = new THREE.LatheGeometry(prof.map(([pr, py]) => new THREE.Vector2(pr * s, py * H)), 12);
      jitter(geo, 0.12, 0.03, i);
      geo.rotateZ((rng() - 0.5) * 0.18).rotateY(rng() * 6).translate(x, g0 - 0.6, z);
      // split the lathe into stalk (below the cap) and cap, by height
      const pos = geo.attributes.position, cut = g0 - 0.6 + H * 0.8;
      const idx = geo.index.array, st = [], cp = [];
      for (let t = 0; t < idx.length; t += 3) (Math.max(pos.getY(idx[t]), pos.getY(idx[t + 1]), pos.getY(idx[t + 2])) > cut ? cp : st).push(idx[t], idx[t + 1], idx[t + 2]);
      const part = (list) => { const g = geo.clone(); g.setIndex(list); return g.toNonIndexed(); };
      (stalks[pick(STALK)] ??= []).push(part(st));
      (caps[pick(CAP)] ??= []).push(part(cp));
      if (s > 1.4) lights.push(new THREE.Vector4(x, g0 + H * 0.75, z, 10 * s));
    }
    for (const [c, l] of Object.entries(stalks)) scene.add(new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true })));
    for (const [c, l] of Object.entries(caps)) scene.add(new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true, glow: 0.3 })));
    // reeds
    const N = 3200, dummy = new THREE.Object3D(), col = new THREE.Color();
    const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 1, 4).translate(0, 0.5, 0), makeMaterial({ color: '#ffffff' }), N);
    let n = 0;
    for (let tries = 0; tries < N * 6 && n < N; tries++) {
      const cx = (rng() * 2 - 1) * 1100, cz = (rng() * 2 - 1) * 1100, h0 = terrain.heightAt(cx, cz);
      if (h0 < -1.2 || h0 > 0.9) continue;   // only along the waterline
      for (let k = 0; k < 12 && n < N; k++) {
        const x = cx + (rng() - 0.5) * 4, z = cz + (rng() - 0.5) * 4;
        dummy.position.set(x, terrain.heightAt(x, z) - 0.2, z);
        dummy.rotation.set((rng() - 0.5) * 0.35, 0, (rng() - 0.5) * 0.35);
        dummy.scale.set(1, 1.6 + rng() * 2.8, 1);
        dummy.updateMatrix();
        reeds.setMatrixAt(n, dummy.matrix);
        reeds.setColorAt(n++, col.set(pick(['#3f5a3a', '#4f6b34', '#5a4a6a'])));
      }
    }
    reeds.count = n;
    reeds.userData.noCollide = true;
    scene.add(reeds);
  }

  return {
    id: 'perdide',
    // the traveller's foam darts make a plant snap shut from afar
    targets: plants.map((p) => ({ kind: 'plant', radius: 2.2, position: () => p.pos, onHit: (mode) => { p.snap = mode === 'dart' ? 2.5 : 0.8; return true; } })),
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: false, jetpack: false, climb: true },
    mount: (physics) => new Hoverbike(physics, { build: buildSkiff, floor: WATER + 0.15, kind: 'skiff' }),
    mountName: 'skiff',
    defaults: { hour: 18.4, preset: 'Moebius print', cloudShadows: 0 },
    sky: {
      // violet shadows, teal light
      script: {
        day: ['#6aa0c8', '#e9d6bf', '#8a86c4', '#effff8', '#fff6dc'],
        dusk: ['#5a7cc0', '#f0b48e', '#7f78bc', '#c8f2e4', '#ffe0c0'],   // print: twilight blue over coral
        night: ['#141a3a', '#3a3f78', '#3d3478', '#7fd6c8', '#f2f0e6'],
      },
      planets: [{ az: 70, el: 22, size: 16, color: '#c7a6f2', ring: 0.35 }],
    },
    killY: -Infinity,
    unsafe,
    lights,
    life: {
      flocks: [{ count: 10, color: '#2b211f', size: 1.3, radius: 50, height: [8, 25], speed: 0.25, seed: 11 }],
      motes: { count: 170, color: '#d6ff9a', size: 0.07, glow: 1, rise: 0.05, wind: [0.15, 0.1] },
      footprints: '#5f7a4f',
    },
    atmo: () => ({ tint: [0.92, 1.0, 1.0], fog: 1.5, name: 'Perdide' }),
    update(dt, t, ctx) {
      for (const m of movers) m(t);
      // carnivorous plants snap shut when the player comes close
      const pp = ctx?.player?.pos;
      for (const p of plants) {
        p.snap = Math.max(0, (p.snap ?? 0) - dt);
        const near = (pp && pp.distanceTo(p.pos) < 7) || p.snap > 0;
        p.open += ((near ? 0.05 : 1) - p.open) * (1 - Math.exp(-(near ? 14 : 2) * dt));
        const breathe = Math.sin(t * 1.5 + p.pos.x) * 0.06;
        for (const j of p.jaws) j.jaw.rotation.z = j.side * (p.open * 0.75 + breathe);
      }
    },
  };
}
