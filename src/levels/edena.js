import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA, MODE_WATER } from '../materials.js';
import { Terrain, jitter, soften } from '../world.js';

// ---------------------------------------------------------------------------
// Le Monde d'Edena (Moebius, 1983-2001): a paradise planet with pale meadows,
// giant trees, pyramids and the clean white ruins of an android civilisation.
// Moebius at his cleanest: flat colours, thin lines, almost no hatching.
// Built for climbing: trees, pyramids and ruins can all be scaled.
// ---------------------------------------------------------------------------

const noise = createNoise2D(83);
const noiseB = createNoise2D(5);

function height(x, z) {
  let h = fbm(noise, x * 0.0016, z * 0.0016, 4) * 40;
  h += fbm(noiseB, x * 0.006, z * 0.006, 2) * 4;
  // a pond basin near the start
  const pd = Math.hypot(x + 120, z + 160);
  h -= smoothstep(90, 0, pd) * 10;
  h *= THREE.MathUtils.lerp(0.3, 1, smoothstep(30, 200, Math.hypot(x, z)));
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1300, 1950, edge) * (160 + fbm(noise, x * 0.004, z * 0.004, 3) * 120);
  return h;
}

const LEAVES = ['#7fcfa8', '#f2a7b5', '#9fd6c9', '#f6c7a0', '#b5a7e6'];
const TRUNK = ['#c98a76', '#d9a5a0', '#b98aa8'];

export function createEdena(scene) {
  const rng = mulberry32(1983);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const terrain = new Terrain({
    size: 4000, seg: 420, height,
    material: { color: '#b4d896', color2: '#c9e4a8', color3: '#e2d3a8', mode: MODE_TERRAIN, ticks: true },
  });
  scene.add(terrain.mesh);
  const movers = [];

  // ---------------------------------------------------------- pond
  {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(95, 48).rotateX(-Math.PI / 2),
      makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER }));
    pond.position.set(-120, terrain.heightAt(-120, -160) + 6, -160);
    pond.userData.noCollide = true;
    scene.add(pond);
  }

  // ---------------------------------------------------------- giant umbrella trees
  // The trunk pierces a stack of flat canopies; climb the trunk and you come
  // out standing on top of a canopy.
  function tree(x, z, s) {
    const base = terrain.baseAt(x, z, 6 * s);
    const h = (55 + rng() * 60) * s;
    const trunk = new THREE.CylinderGeometry(2.8 * s, 5.5 * s, h, 10, 10);
    trunk.translate(0, h / 2, 0);
    jitter(trunk, 0.1, 0.05, rng() * 50);
    soften(trunk, -0.12);   // pinched waist, flaring at root and crown
    const parts = [trunk.toNonIndexed()];
    // a couple of branches
    for (let b = 0; b < 3; b++) {
      const a = rng() * Math.PI * 2, y0 = h * (0.45 + rng() * 0.3), len = (12 + rng() * 14) * s;
      const p0 = new THREE.Vector3(0, y0, 0);
      const p1 = new THREE.Vector3(Math.cos(a) * len, y0 + len * 0.6, Math.sin(a) * len);
      parts.push(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 4, 1.3 * s, 6).toNonIndexed());
    }
    const trunkMesh = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: pick(TRUNK), flat: true }));
    trunkMesh.position.set(x, base - 1, z);
    scene.add(trunkMesh);
    const leaf = pick(LEAVES);
    const layers = 1 + Math.floor(rng() * 3);
    for (let l = 0; l < layers; l++) {
      const r = (18 + rng() * 16) * s * (1 - l * 0.25);
      const g = new THREE.CylinderGeometry(r, r * 0.92, 3.5 * s, 18);
      jitter(g, 0.08, 0.2, rng() * 30);
      const disc = new THREE.Mesh(g, makeMaterial({ color: leaf, color2: pick(LEAVES), flat: true }));
      disc.position.set(x + (rng() - 0.5) * 6, base + h * (0.82 + l * 0.12), z + (rng() - 0.5) * 6);
      scene.add(disc);
    }
  }
  tree(60, -80, 0.6);
  tree(-60, 70, 0.8);
  for (let i = 0; i < 46; i++) {
    const x = (rng() * 2 - 1) * 1300, z = (rng() * 2 - 1) * 1300;
    if (Math.hypot(x, z) < 60 || Math.hypot(x + 120, z + 160) < 110) continue;
    tree(x, z, 0.6 + rng() * 0.9);
  }

  // ---------------------------------------------------------- step pyramids
  function pyramid(x, z, size) {
    const steps = 6 + Math.floor(rng() * 5);
    const parts = [];
    const sh = size * 0.12;
    for (let i = 0; i < steps; i++) {
      const w = size * (1 - i / steps);
      parts.push(new THREE.BoxGeometry(w, sh, w).translate(0, sh * (i + 0.5), 0));
    }
    parts.push(new THREE.BoxGeometry(size * 0.12, sh * 1.6, size * 0.12).translate(0, sh * (steps + 0.8), 0));
    const m = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: '#f3ead8', color2: '#f2c5b0', color3: '#e7d8b6', mode: MODE_STRATA, strataSize: sh, flat: true, grid: sh }));
    m.position.set(x, terrain.baseAt(x, z, size * 0.5) - 1, z);
    m.rotation.y = rng() * Math.PI;
    scene.add(m);
  }
  pyramid(-200, 220, 90);
  for (let i = 0; i < 8; i++) pyramid((rng() * 2 - 1) * 1200, (rng() * 2 - 1) * 1200, 50 + rng() * 90);

  // ---------------------------------------------------------- android ruins (clean white, gridded)
  const ruinMat = makeMaterial({ color: '#f7f4ec', flat: true, grid: 3, glyphs: true });
  const accent = makeMaterial({ color: '#62c3c9', flat: true, grid: 3 });
  function ruins(cx, cz) {
    for (let i = 0; i < 8 + Math.floor(rng() * 8); i++) {
      const x = cx + (rng() - 0.5) * 120, z = cz + (rng() - 0.5) * 120;
      const h = 8 + rng() * rng() * 70, w = 4 + rng() * 12;
      const g = new THREE.BoxGeometry(w, h, 2 + rng() * 6);
      g.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g, rng() < 0.85 ? ruinMat : accent);
      m.position.set(x, terrain.baseAt(x, z, w * 0.6) - 2, z);
      m.rotation.set((rng() - 0.5) * 0.15, rng() * Math.PI, (rng() - 0.5) * 0.15);
      scene.add(m);
    }
    // a fallen ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14 + rng() * 10, 2, 8, 32), ruinMat);
    ring.position.set(cx, terrain.heightAt(cx, cz) + 4, cz);
    ring.rotation.set(Math.PI / 2 - 0.3, 0, rng() * 3);
    scene.add(ring);
  }
  ruins(180, 120);
  for (let i = 0; i < 7; i++) ruins((rng() * 2 - 1) * 1200, (rng() * 2 - 1) * 1200);

  // ---------------------------------------------------------- hero: the crashed ship
  // Stel and Atan's retro spaceship, nose-down in the meadow where the story begins.
  {
    const grp = new THREE.Group();
    const hullMat = makeMaterial({ color: '#f3ead8', color2: '#e6875f', color3: '#f3ead8', mode: MODE_STRATA, strataSize: 3.5, grid: 3 });
    const hull = new THREE.Mesh(soften(new THREE.CapsuleGeometry(9, 54, 8, 20), 0.08), hullMat);
    hull.rotation.z = Math.PI / 2;
    grp.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(8.6, 22, 20).rotateZ(-Math.PI / 2), makeMaterial({ color: '#d9643a', flat: true }));
    nose.position.x = 44;
    grp.add(nose);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 12).translate(0, 0, 9), makeMaterial({ color: '#62c3c9', flat: true }));
      fin.position.x = -30;
      fin.rotation.x = (k / 3) * Math.PI * 2;
      grp.add(fin);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial({ color: '#9fd6c9', glow: 0.25 }));
    dome.position.set(18, 8.5, 0);
    grp.add(dome);
    const x = 40, z = -210;
    grp.position.set(x, terrain.baseAt(x, z, 30) + 4, z);
    grp.rotation.set(0.2, 0.9, -0.28);
    scene.add(grp);
    // debris scattered behind it
    for (let i = 0; i < 18; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(1 + rng() * 4, 0.6 + rng() * 2, 1 + rng() * 3), makeMaterial({ color: pick(['#f3ead8', '#e6875f', '#62c3c9']), flat: true }));
      const dx = x - 30 - rng() * 60, dz = z + (rng() - 0.5) * 40;
      d.position.set(dx, terrain.heightAt(dx, dz) + 0.3, dz);
      d.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      scene.add(d);
    }
  }

  // ---------------------------------------------------------- flowers (walk-through)
  {
    const N = 3500, dummy = new THREE.Object3D(), color = new THREE.Color();
    const g = mergeGeometries([
      new THREE.CylinderGeometry(0.05, 0.06, 1.0, 4).translate(0, 0.5, 0),
      new THREE.CylinderGeometry(0.35, 0.2, 0.12, 7).translate(0, 1.05, 0),
    ]);
    const flowers = new THREE.InstancedMesh(g, makeMaterial({ color: '#ffffff' }), N);
    const data = [];
    for (let i = 0; i < N; i++) {
      // clustered in meadows, denser near the start
      const near = i < N * 0.4;
      const cx = near ? (rng() * 2 - 1) * 260 : (rng() * 2 - 1) * 1400, cz = near ? (rng() * 2 - 1) * 260 : (rng() * 2 - 1) * 1400;
      const d = { x: cx, y: terrain.heightAt(cx, cz), z: cz, yaw: rng() * 6, tilt: (rng() - 0.5) * 0.3, s: 0.7 + rng() * 1.2, ph: rng() * 6 };
      data.push(d);
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(d.tilt, d.yaw, 0);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, color.set(pick(['#f2a7b5', '#f2c54b', '#f3ead8', '#b5a7e6'])));
    }
    flowers.frustumCulled = false;
    flowers.userData.noCollide = true;
    scene.add(flowers);
    // sway in the breeze (only the ones near the player, every other frame)
    let flip = 0;
    movers.push((t, focus) => {
      if (!focus || (flip ^= 1)) return;
      for (let i = 0; i < N; i++) {
        const d = data[i];
        if (Math.abs(d.x - focus.x) > 120 || Math.abs(d.z - focus.z) > 120) continue;
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(d.tilt + Math.sin(t * 1.8 + d.ph + d.x * 0.05) * 0.25, d.yaw, Math.cos(t * 1.3 + d.ph) * 0.12);
        dummy.scale.setScalar(d.s);
        dummy.updateMatrix();
        flowers.setMatrixAt(i, dummy.matrix);
      }
      flowers.instanceMatrix.needsUpdate = true;
    });
  }

  return {
    id: 'edena',
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: false, climb: true },
    defaults: { hour: 10.5, preset: 'Sable', cloudShadows: 0 },
    sky: {
      script: {
        day: ['#7fd0e8', '#f4f6dc', '#8fa8d8', '#ffffff', '#fffbe8'],
        dusk: ['#8f9fd8', '#f6c6a8', '#8a86c8', '#ffe6d0', '#fff0d6'],
        night: ['#18264e', '#3a4c80', '#34407a', '#9ab0d8', '#f2f0e6'],
      },
      planets: [{ az: 230, el: 20, size: 12, color: '#9fd6c9', ring: 0.3 }],
    },
    killY: -Infinity,
    atmo: () => ({ tint: [0.98, 1.0, 1.02], fog: 0.7, name: 'Edena' }),
    life: {
      flocks: [{ count: 16, color: '#f2a7b5', size: 1.4, radius: 70, height: [12, 40], seed: 6 },
               { count: 12, color: '#62c3c9', size: 1.2, radius: 110, height: [20, 60], speed: -0.14, seed: 8 }],
      motes: { count: 200, color: '#fffbe8', size: 0.045, rise: 0.15, wind: [0.5, 0.2] },
    },
    update(dt, t, ctx) { for (const m of movers) m(t, ctx?.player?.pos); },
  };
}
