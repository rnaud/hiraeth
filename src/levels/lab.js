import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA, MODE_WATER } from '../materials.js';
import { Terrain, jitter, soften } from '../world.js';
import { textGeometry } from '../story/sign-text.js';

// ---------------------------------------------------------------------------
// The Lab: a developer's world for looking at the game's surfaces and faces,
// away from any story (?level=lab; it is in no menu). A pale grey floor under
// a plain sky, two galleries:
//
//   the materials row  pedestals along -z, each with a sphere, a cube and a knot
//                      in one surface (LAB_MATERIALS), its name cut in the plinth;
//                      a water pool and a cloud at the end of the row
//   the faces row      giant villagers (4x) in a ring along +z, standing still,
//                      so the faces' ink can be studied close up (content.js)
//
// Add a surface to LAB_MATERIALS to see it beside the others in every light
// (the time of day still runs: the sun and the shadows move over the row).
// ---------------------------------------------------------------------------

const FLOOR = '#d9d6cf';

/** The surfaces on show: a name and makeMaterial options. */
export const LAB_MATERIALS = [
  { name: 'flat', o: { color: '#e6875f', flat: true } },
  { name: 'smooth', o: { color: '#e6875f' } },
  { name: 'rock strata', o: { color: '#c98f64', color2: '#b0714e', color3: '#8f5a3e', mode: MODE_STRATA, strataSize: 0.8 } },
  { name: 'cracked', o: { color: '#25386c', flat: true, pattern: 'cracks' } },
  { name: 'facade', o: { color: '#f3ead8', color2: '#d8cfbd', flat: true, pattern: 'facade' } },
  { name: 'tiles', o: { color: '#c8673f', flat: true, pattern: 'tiles' } },
  { name: 'leaves', o: { color: '#5e7a3a', flat: true, pattern: 'leaves' } },
  { name: 'brush', o: { color: '#8a6fb8', scrub: true } },
  { name: 'grid', o: { color: '#f4f0e6', grid: 1 } },
  { name: 'glyphs', o: { color: '#9fbfdc', flat: true, glyphs: true } },
  { name: 'glow', o: { color: '#70e7df', flat: true, glow: 1 } },
  { name: 'metal', o: { color: '#9aa6b2', color2: '#5d6b78', flat: true } },
  { name: 'dissolve', o: { color: '#25386c', flat: true, dissolve: '#fff4d6' } },
];

const SPACING = 9;

export function createLab(scene) {
  const terrain = new Terrain({
    size: 1200, seg: 60,
    height: (x, z) => Math.max(0, Math.hypot(x, z) - 160) * 0.08,   // a shallow bowl beyond the galleries
    material: { color: FLOOR, color2: '#cfccc4', color3: '#c4c0b6', mode: MODE_TERRAIN },
  });
  scene.add(terrain.mesh);
  const ink = makeMaterial({ color: '#2b211f', flat: true });
  const stone = makeMaterial({ color: '#efece6', flat: true });
  const movers = [];

  // ---- the materials row: a pedestal, a sphere, a cube and a knot each, the name on the plinth
  const shapes = [
    new THREE.SphereGeometry(1, 32, 20).translate(0, 1, 0),
    new THREE.BoxGeometry(1.5, 1.5, 1.5).translate(0, 0.75, 0),
    new THREE.TorusKnotGeometry(0.62, 0.22, 96, 12).translate(0, 1.1, 0),
  ];
  const dissolving = [];
  LAB_MATERIALS.forEach((m, i) => {
    const x = (i - (LAB_MATERIALS.length - 1) / 2) * SPACING, z = -24;
    const mat = makeMaterial({ ...m.o, key: `lab.${m.name}` });
    if (mat.uniforms.uDissolve) dissolving.push(mat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 3.2).translate(0, 0.3, 0), stone);
    base.position.set(x, 0, z);
    scene.add(base);
    shapes.forEach((g, k) => {
      const s = new THREE.Mesh(g, mat);
      s.position.set(x + (k - 1) * 2.4, 0.6, z);
      scene.add(s);
      if (k === 2) movers.push((t) => { s.rotation.y = t * 0.3 + i; });
    });
    const label = new THREE.Mesh(textGeometry(m.name, { width: Math.min(6.4, m.name.length * 0.62), depth: 0.03 }), ink);
    label.position.set(x, 0.3, z + 1.62);
    scene.add(label);
  });
  // the dissolve sample comes apart and back, over and over
  movers.push((t) => { for (const m of dissolving) m.uniforms.uDissolve.value.set(0.5 + 0.5 * Math.sin(t * 0.7), 0.09, 0.6, 2.6); });

  // ---- water: a pool at the end of the row
  {
    const endX = ((LAB_MATERIALS.length + 1) / 2) * SPACING + 4;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.6, 0.5, 40).translate(0, 0.25, 0), stone);
    rim.position.set(endX, 0, -24);
    const water = new THREE.Mesh(new THREE.CircleGeometry(6, 40).rotateX(-Math.PI / 2), makeMaterial({ color: '#4c8fb0', color2: '#8fc7d9', mode: MODE_WATER, key: 'lab.water' }));
    water.position.set(endX, 0.42, -24);
    water.userData.noCollide = true;
    scene.add(rim, water);
    const label = new THREE.Mesh(textGeometry('water', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(endX, 0.3, -24 + 6.7);
    scene.add(label);
  }
  // ---- a cloud: lobes in flat white, floating over the start of the row
  {
    const lobes = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.39996, r = 1.2 + (k % 3) * 1.1;
      lobes.push(new THREE.IcosahedronGeometry(1.6 + (k % 2) * 0.9, 1).translate(Math.cos(a) * r * 1.6, (k % 3) * 0.5, Math.sin(a) * r * 0.7).toNonIndexed());
    }
    const g = soften(jitter(mergeGeometries(lobes), 0.12, 1.3, 4), 0.06);
    g.computeVertexNormals();
    const cloud = new THREE.Mesh(g, makeMaterial({ color: '#ffffff', color2: '#e3e8ee', key: 'lab.cloud' }));
    const startX = -((LAB_MATERIALS.length + 1) / 2) * SPACING - 4;
    cloud.position.set(startX, 7, -24);
    cloud.userData.noCollide = true;
    scene.add(cloud);
    movers.push((t) => { cloud.position.y = 7 + Math.sin(t * 0.4) * 0.4; });
    const label = new THREE.Mesh(textGeometry('cloud', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(startX, 0.05, -21);
    label.rotation.x = -Math.PI / 2;
    scene.add(label);
  }
  // ---- the faces row: plinths where the giant villagers stand (content.js puts them on them)
  for (const [x, z] of LAB_FACES) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.4, 24).translate(0, 0.2, 0), stone);
    p.position.set(x, 0, z);
    scene.add(p);
  }

  return {
    id: 'lab',
    ground: terrain,
    spawn: new THREE.Vector3(0, 0, 4),
    spawnHeading: Math.PI,   // facing the materials
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 11, preset: 'Edena', cloudShadows: 0 },
    killY: -Infinity,
    lights: [],
    sky: {
      script: {
        day: ['#e9edf0', '#f6f7f8', '#c9ccd0', '#ffffff', '#fff6dc'],
        dusk: ['#e6dccb', '#f2e6d2', '#b8ab96', '#fff0d6', '#ffe6c0'],
        night: ['#2e3238', '#4a5058', '#2e3238', '#c8c4bc', '#f2f0e6'],
      },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.35, name: 'The Lab' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}

/** Where the giant faces stand: a gentle arc behind the spawn. */
export const LAB_FACES = [-27, -9, 9, 27].map((x) => [x, 26 + Math.abs(x) * 0.12]);
