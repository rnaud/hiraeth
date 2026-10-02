import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';

// ---------------------------------------------------------------------------
// The Atelier: the hidden seventh place, unlocked once every world's story
// and relics are found. A blank paper world; sketches of every landmark you
// visited stand around a giant pen nib, and the artist sits at his table.
// ---------------------------------------------------------------------------

const PAPER = '#f4ecd8';

export function createAtelier(scene) {
  const terrain = new Terrain({
    size: 3000, seg: 120,
    height: (x, z) => Math.max(0, Math.hypot(x, z) - 900) * 0.12,   // the page curls up at the edges
    material: { color: PAPER, color2: '#efe5cf', color3: '#e4d8bd', mode: MODE_TERRAIN },
  });
  scene.add(terrain.mesh);
  const ink = makeMaterial({ color: '#2b211f' });
  const sketch = (c = PAPER) => makeMaterial({ color: c, flat: true });
  const movers = [];
  const lights = [];

  // the pen nib monument at the centre (the story goal)
  {
    const nib = mergeGeometries([
      new THREE.ConeGeometry(9, 46, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI).translate(0, 23, 0).toNonIndexed(),   // tip on the page
      new THREE.CylinderGeometry(7.6, 7.6, 22, 16).translate(0, 57, 0).toNonIndexed(),
    ]);
    const m = new THREE.Mesh(nib, makeMaterial({ color: '#2b211f', color2: '#3a2f2a', color3: '#d8a24a', mode: MODE_STRATA, strataSize: 8, flat: true }));
    scene.add(m);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 22, 0.6), makeMaterial({ color: '#f2c54b', glow: 1 }));
    slit.position.set(0, 11, 0);
    scene.add(slit);
    // an ink pool spreading where it touches
    const pool = new THREE.Mesh(new THREE.CircleGeometry(14, 40).rotateX(-Math.PI / 2), ink);
    pool.position.y = 0.05;
    pool.userData.noCollide = true;
    scene.add(pool);
    lights.push(new THREE.Vector4(0, 8, 0, 40));
  }

  // pencil sketches of the six worlds' landmarks, in a ring
  const ring = (i, n = 6, r = 120) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r];
  const place = (mesh, i, y = 0, s = 1) => { const [x, z] = ring(i); mesh.position.set(x, y, z); mesh.scale.setScalar(s); mesh.lookAt(0, y, 0); scene.add(mesh); };
  // the masked head
  place(new THREE.Mesh(new THREE.SphereGeometry(18, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 0.9), sketch()), 0);
  // the city-shaft spire with its rings
  {
    const g = mergeGeometries([new THREE.CylinderGeometry(4, 6, 60, 12).translate(0, 30, 0).toNonIndexed(),
      ...[15, 30, 45].map((y) => new THREE.TorusGeometry(10, 0.8, 6, 24).rotateX(Math.PI / 2).translate(0, y, 0).toNonIndexed())]);
    place(new THREE.Mesh(g, sketch('#f0e4cc')), 1);
  }
  // the lone tower
  {
    const g = mergeGeometries([new THREE.CylinderGeometry(2.5, 5, 70, 10).translate(0, 35, 0).toNonIndexed(),
      new THREE.SphereGeometry(7, 12, 8).scale(1, 0.75, 1).translate(0, 74, 0).toNonIndexed()]);
    place(new THREE.Mesh(g, sketch()), 2);
  }
  // the great machine's gears, turning
  {
    const gear = new THREE.Mesh(new THREE.TorusGeometry(14, 1.6, 6, 28), sketch('#ece0c8'));
    place(gear, 3, 18);
    movers.push((t) => { gear.rotation.z = t * 0.2; });
  }
  // the crashed ship
  {
    const g = new THREE.CapsuleGeometry(6, 26, 6, 14).rotateZ(Math.PI / 2 - 0.3);
    place(new THREE.Mesh(g, sketch()), 4, 6);
  }
  // the great crystal
  {
    const parts = [];
    for (let k = 0; k < 6; k++) parts.push(new THREE.ConeGeometry(4, 30 + k * 6, 6).translate(Math.cos(k) * 4, 15 + k * 3, Math.sin(k) * 4).rotateZ((k - 3) * 0.08).toNonIndexed());
    place(new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: '#efe6f7', flat: true, glow: 0.3 })), 5);
  }

  // the artist's drawing table with a page on it, and loose sheets drifting
  {
    const table = mergeGeometries([
      new THREE.BoxGeometry(7, 0.4, 4.5).rotateX(-0.25).translate(0, 3.1, 0).toNonIndexed(),
      ...[[-3, -1.8], [3, -1.8], [-3, 1.8], [3, 1.8]].map(([x, z]) => new THREE.BoxGeometry(0.3, 3, 0.3).translate(x, 1.5, z).toNonIndexed()),
    ]);
    const tm = new THREE.Mesh(table, makeMaterial({ color: '#8a5a3c', flat: true }));
    tm.position.set(18, 0, 22);
    tm.rotation.y = -0.7;
    scene.add(tm);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), makeMaterial({ color: '#fffaf0', grid: 0.6, glyphs: true, side: THREE.DoubleSide }));
    sheet.rotation.set(-Math.PI / 2 + 0.25, 0, 0);
    sheet.position.set(0, 3.35, 0);
    tm.add(sheet);
  }
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), makeMaterial({ color: '#fffaf0', grid: 0.5, side: THREE.DoubleSide }));
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 200, h = 10 + Math.random() * 60, ph = Math.random() * 10;
    s.userData.noCollide = true;
    scene.add(s);
    movers.push((t) => {
      s.position.set(Math.cos(a + t * 0.02) * r, h + Math.sin(t * 0.3 + ph) * 3, Math.sin(a + t * 0.02) * r);
      s.rotation.set(Math.sin(t * 0.4 + ph) * 0.6, t * 0.1 + ph, Math.cos(t * 0.3 + ph) * 0.4);
    });
  }

  return {
    id: 'atelier',
    ground: terrain,
    spawn: new THREE.Vector3(0, 0, 70),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 11, preset: 'Edena', cloudShadows: 0 },
    killY: -Infinity,
    lights,
    sky: {
      script: {
        day: ['#f2ead8', '#fbf6ea', '#c9c2b4', '#ffffff', '#fff6dc'],
        dusk: ['#eadfc8', '#f6e6cc', '#b8a990', '#fff0d6', '#ffe6c0'],
        night: ['#3a342e', '#5a5048', '#3a342e', '#c8bfae', '#f2f0e6'],
      },
      planets: [{ az: 200, el: 30, size: 8, color: '#2b211f' }],
    },
    life: { motes: { count: 120, color: '#2b211f', size: 0.035, rise: -0.05, wind: [0.2, 0.1] } },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.5, name: 'The Atelier' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}
