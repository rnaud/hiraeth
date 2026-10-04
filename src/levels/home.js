import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain, jitter } from '../world.js';

// ---------------------------------------------------------------------------
// Home: where the route begins (src/story/ending.js). Hidden, like the
// Atelier: it opens on the galactic map once enough worlds are done.
//
// A small round house on a small round hill at dusk: a cream dome with a
// lamp in its round window and the antenna the calls come through, a tall
// umbrella tree, a washing line, a stone path from the landing ring to the
// door, and two moons over a valley of peach grass and lilac mesas. The
// parents wait at the door (HOME_CONTENT.npcs: the father first, the mother
// second; spawnNPCs dresses even indices as men). The homecoming itself
// (src/ship/homecoming.js) frames them with HOME_SPOTS.
// ---------------------------------------------------------------------------

/** Where things are, for the homecoming's cameras. */
export const HOME_SPOTS = {
  house: new THREE.Vector3(0, 0, 34),     // the dome's centre on the ground
  door: new THREE.Vector3(0, 0, 25.6),    // the threshold, facing -z (the landing ring)
  father: [-1.5, 15.5],
  mother: [1.6, 16],
  meet: new THREE.Vector3(0, 0, 11.5),    // where the traveller stops, facing the door
  ship: { x: 0, z: -22, heading: 0 },     // the landing ring: the hatch faces the house
};

const noise = createNoise2D(77);

function height(x, z) {
  const r = Math.hypot(x, z);
  // the hilltop is flat (the house, the yard, the landing ring); the hill falls to a meadow valley,
  // and far hills rise all round (nobody walks off the edge of home)
  const meadow = fbm(noise, x * 0.006, z * 0.006, 3) * 7 + Math.sin(x * 0.013) * Math.cos(z * 0.011) * 3;
  let h = -16 * smoothstep(75, 240, r) + meadow * smoothstep(80, 200, r);
  h += smoothstep(420, 760, r) * (70 + fbm(noise, x * 0.003 + 9, z * 0.003, 3) * 40);
  return h;
}

export const HOME_CONTENT = {
  weather: [],
  story: {
    title: 'HOME',
    intro: 'A small round house on a small round hill. The lamp is lit.',
    outro: 'You came home.',
    label: 'the door', goal: [0, 'ground', 26], radius: 5, manual: true,
  },
  relics: { spots: [], names: [] },
  gate: { at: [-64, 46], heading: Math.PI / 2 },
  npcs: [
    {
      at: HOME_SPOTS.father, radius: 0.5, speed: 0.35, head: 'wrap', cape: 0,
      palette: { cloak: '#f3ead8', lining: '#7a3a35', cloth: '#7a3a35', legs: '#2b2f45', hat: '#3a2f2a', hair: '#b8b0a4' },
      lines: ['The ship looks well.', 'Your mother kept your room.', 'Hm.'],
      id: 'father', name: 'Your father', title: 'at home', color: '#7a3a35', voice: 0.7,
      talk: {
        entry: [{ if: { flag: 'ending.done' }, node: 'after' }, { node: 'before' }],
        nodes: {
          before: { say: ['(He is looking up, past you, at the sky.)', 'You came the long way round. Come in by the ship, son. The proper way.'], choices: [{ text: 'All right.', end: true }] },
          after: {
            say: [
              { if: { flag: 'ending.kind', is: 'thing' }, text: 'I keep it on the shelf by the round window. I look at it more than I thought I would.' },
              { if: { flag: 'ending.kind', is: 'song' }, text: '(He hums two notes of it, and stops, embarrassed.)' },
              { if: { flag: 'ending.kind', is: 'word' }, text: 'I wrote it down. The words. I keep it in my coat.' },
              { if: { flag: 'ending.kind', is: 'person' }, text: 'Tell whoever is waiting for you out there that we said thank you.' },
              { if: { flag: 'ending.kind', is: 'knowing' }, text: 'I still don’t understand it. Explain it again.' },
              { if: { flag: 'ending.kind', is: 'nothing' }, text: 'Your hands were empty. I keep thinking about that. It was the right answer.' },
              'The ship is fuelled. I checked it twice. Go wherever you like, and call.',
            ],
            choices: [
              { text: 'Tell me about Ilen.', if: { flag: 'calls.ilen.told' }, goto: 'ilen' },
              { text: 'I will.', end: true },
            ],
          },
          ilen: {
            say: ['(He is quiet for a long time.)', 'She laughed like your mother. She hated being told anything. She would have liked you.', 'If you ever hear that singing out there, don’t follow it. Call me. I will listen. Every night, I will.'],
            choices: [{ text: '(stay with him a while)', end: true }],
          },
        },
      },
    },
    {
      at: HOME_SPOTS.mother, radius: 0.5, speed: 0.35, head: 'hair', cape: 0.55,
      palette: { cloak: '#277e86', lining: '#f2c49a', cloth: '#f2c49a', legs: '#34405e', hat: '#277e86', hair: '#5a4038' },
      lines: ['Eat something warm.', 'Come here, let me look at you.', 'You stand differently now.'],
      id: 'mother', name: 'Your mother', title: 'at home', color: '#277e86', voice: 1.0,
      talk: {
        entry: [{ node: 'hello' }],
        nodes: {
          hello: {
            say: ['There you are. Have you eaten?', 'Tell me one person you met out there. Just one. Slowly, so I can see them.'],
            choices: [{ text: '(tell her)', goto: 'listen' }, { text: 'Later. I promise.', end: true }],
          },
          listen: { say: ['(She listens to all of it, and asks their names twice.)', 'Then go and see them again. Home will still be here. We always are.'], choices: [{ text: 'Thank you.', end: true }] },
        },
      },
    },
  ],
};

export function createHome(scene) {
  const terrain = new Terrain({
    size: 1800, seg: 225, height,
    material: { color: '#eebd8e', color2: '#e3a97c', color3: '#c99a7c', mode: MODE_TERRAIN, ticks: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const lights = [];
  const movers = [];
  const smallProps = [];
  const mat = (color, o = {}) => makeMaterial({ color, ...o });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); scene.add(mesh); return mesh; };
  const cream = mat('#f3ead8'), ink = mat('#2b211f'), stone = mat('#dccab0', { flat: true }), terracotta = mat('#c8483a', { flat: true });
  const teal = mat('#5fb7ad'), tealDark = mat('#3f8f8a'), lilac = mat('#b9a3c9', { flat: true });

  // ---------------------------------------------------------- the house
  {
    const { x, z } = HOME_SPOTS.house;
    add(new THREE.CylinderGeometry(10, 10.6, 0.9, 40), stone, x, 0.45, z);
    const dome = add(new THREE.SphereGeometry(8.4, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.86, 1), cream, x, 0.9, z);
    void dome;
    add(new THREE.TorusGeometry(8.42, 0.28, 8, 48).rotateX(Math.PI / 2), mat('#5fb7ad', { flat: true }), x, 1.6, z);   // the painted band
    // the door (facing the landing ring, -z): an arch of ink in a frame of terracotta
    const door = mergeGeometries([new THREE.BoxGeometry(2.0, 2.6, 0.6).translate(0, 1.3, 0).toNonIndexed(),
      new THREE.CylinderGeometry(1.0, 1.0, 0.6, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 2.6, 0).toNonIndexed()]);
    add(door, ink, x, 0.9, HOME_SPOTS.door.z - 0.15);
    const frame = mergeGeometries([new THREE.BoxGeometry(2.7, 3.0, 0.4).translate(0, 1.5, 0).toNonIndexed(),
      new THREE.CylinderGeometry(1.35, 1.35, 0.4, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 3.0, 0).toNonIndexed()]);
    add(frame, terracotta, x, 0.9, HOME_SPOTS.door.z + 0.12);
    // the round window, with the lamp lit behind it (the call screen shows this room)
    const az = 0.55, el = 0.42;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el) * 0.86, -Math.cos(az) * Math.cos(el));
    const at = new THREE.Vector3(x, 0.9, z).add(new THREE.Vector3(dir.x * 8.47, dir.y * 8.47, dir.z * 8.47));
    const win = add(new THREE.CircleGeometry(1.5, 32), mat('#ffd27a', { glow: 0.85 }), at.x, at.y, at.z);
    win.lookAt(at.clone().add(new THREE.Vector3(dir.x, dir.y / 0.74, dir.z)));
    win.userData.noCollide = true;
    const ring = add(new THREE.TorusGeometry(1.55, 0.18, 8, 32), ink, 0, 0, 0);
    ring.position.copy(win.position); ring.quaternion.copy(win.quaternion);
    lights.push(new THREE.Vector4(win.position.x, win.position.y, win.position.z - 1.5, 9));
    // the lamp by the door
    add(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), ink, x + 2.2, 0.9 + 1.3, HOME_SPOTS.door.z - 0.6);
    add(new THREE.SphereGeometry(0.3, 12, 8), mat('#ffe6b0', { glow: 1 }), x + 2.2, 0.9 + 2.75, HOME_SPOTS.door.z - 0.6);
    lights.push(new THREE.Vector4(x + 2.2, 3.4, HOME_SPOTS.door.z - 1.2, 8));
    // the antenna on top: a mast and a little dish turned to the sky, the way the calls come in
    add(new THREE.CylinderGeometry(0.12, 0.18, 6, 8), ink, x - 1.5, 7.2 + 3, z + 1);
    const dish = add(new THREE.ConeGeometry(1.4, 0.7, 20, 1, true), mat('#f3ead8', { side: THREE.DoubleSide }), x - 1.5, 13.4, z + 1);
    dish.rotation.set(Math.PI + 0.6, 0, 0.3);
    const blink = add(new THREE.SphereGeometry(0.16, 8, 6), mat('#e6503a', { glow: 1 }), x - 1.5, 13.3 + 0.1, z + 1);
    movers.push((t) => { blink.visible = Math.sin(t * 2.2) > -0.2; });
    // the annex: a small dome for the store
    add(new THREE.SphereGeometry(3.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1), mat('#efe0c4'), x + 10.5, 0, z + 3);
    add(new THREE.TorusGeometry(3.62, 0.18, 6, 32).rotateX(Math.PI / 2), terracotta, x + 10.5, 0.7, z + 3);
    // a bench by the door, where somebody sits to watch the sky
    add(new THREE.BoxGeometry(3, 0.25, 0.9), mat('#8a5a3c', { flat: true }), x - 5.2, 0.9 + 0.75, HOME_SPOTS.door.z + 0.9).rotation.y = 0.35;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.25, 0.75, 0.8), mat('#8a5a3c', { flat: true }), x - 5.2 + s * 1.3 * Math.cos(0.35), 0.9 + 0.37, HOME_SPOTS.door.z + 0.9 - s * 1.3 * Math.sin(0.35));
  }

  // ---------------------------------------------------------- the yard
  // the landing ring, where the ship stands
  {
    const { x, z } = HOME_SPOTS.ship;
    add(new THREE.CylinderGeometry(17, 17.4, 0.3, 48), mat('#efe2c4', { flat: true }), x, 0.0, z);
    const mark = add(new THREE.RingGeometry(14.2, 15, 64).rotateX(-Math.PI / 2), terracotta, x, 0.17, z);
    mark.userData.noCollide = true;
    // the glyph, painted on the ring by someone at home: three dots over an arc
    for (const [dx, dz] of [[-2.2, 12.2], [0, 12.8], [2.2, 12.2]]) {
      const d = add(new THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2), ink, x + dx, 0.18, z + dz);
      d.userData.noCollide = true;
    }
  }
  // the stone path, from the ring to the door
  for (let i = 0; i < 9; i++) {
    const k = i / 8, z = -4 + k * 27.5, x = Math.sin(k * 3) * 0.8;
    const s = add(new THREE.CylinderGeometry(0.9 + (i % 3) * 0.12, 1, 0.16, 10), stone, x + (i % 2 ? 0.5 : -0.5), 0.05, z);
    s.rotation.y = i;
    smallProps.push(s);
  }
  // a low curved wall round the yard, open towards the ring
  {
    const parts = [];
    const r = 26, c = HOME_SPOTS.house;
    for (let a = 0.5; a <= Math.PI * 2 - 0.5; a += 0.105) {   // a: from the front (-z) round; the front stays open
      parts.push(new THREE.BoxGeometry(2.8, 1.1, 0.9).rotateY(-a).translate(c.x + Math.sin(a) * r, 0.55, c.z - Math.cos(a) * r).toNonIndexed());
    }
    add(mergeGeometries(parts), stone);
  }
  // the washing line: three cloths in the colours of the backpack's first fluid
  {
    const p0 = new THREE.Vector3(-12, 0, 18), p1 = new THREE.Vector3(-20, 0, 30);
    for (const p of [p0, p1]) add(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), mat('#8a5a3c', { flat: true }), p.x, 1.7, p.z);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, p0.distanceTo(p1), 4), ink);
    line.position.copy(p0).lerp(p1, 0.5).setY(3.3);
    line.lookAt(p1.x, 3.3, p1.z); line.rotateX(Math.PI / 2);
    line.userData.noCollide = true;
    scene.add(line);
    ['#5fd0c6', '#8a6fb8', '#f2c54b'].forEach((c, i) => {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9).translate(0, -0.95, 0), mat(c, { side: THREE.DoubleSide, flat: true }));
      cloth.position.copy(p0).lerp(p1, 0.25 + i * 0.25).setY(3.28);
      cloth.lookAt(cloth.position.clone().add(new THREE.Vector3(p1.z - p0.z, 0, -(p1.x - p0.x))));
      cloth.userData.noCollide = true;
      scene.add(cloth);
      const base = cloth.rotation.x;
      movers.push((t) => { cloth.rotation.x = base + Math.sin(t * 1.3 + i) * 0.12; });
    });
  }
  // shrubs, round as the house
  for (const [x, z, r, c] of [[-8, 22, 1.4, teal], [7, 21, 1.1, tealDark], [14, 26, 1.6, teal], [-15, 40, 1.8, tealDark], [16, 42, 1.3, lilac], [-4, 45, 2.0, teal], [22, 10, 1.2, lilac], [-22, 8, 1.5, teal]]) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    jitter(g, 0.12 * r, 1.4, x * 7 + z);
    smallProps.push(add(g, c, x, H(x, z) + r * 0.7, z));
  }

  // ---------------------------------------------------------- the umbrella tree
  {
    const x = -13, z = 36, y = H(x, z);
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 7, 0.2), new THREE.Vector3(-0.4, 14, -0.3), new THREE.Vector3(0.8, 21, 0)]);
    add(new THREE.TubeGeometry(trunk, 16, 0.45, 8, false), mat('#8a5a3c'), x, y, z);
    const canopy = mergeGeometries([new THREE.CylinderGeometry(7.5, 8.5, 1.1, 28).translate(0.8, 21.4, 0).toNonIndexed(),
      new THREE.CylinderGeometry(4.2, 5, 0.9, 22).translate(-0.6, 15.5, 1).toNonIndexed()]);
    add(canopy, mat('#3f9f98', { color2: '#5fb7ad' }), x, y, z);
    add(new THREE.CylinderGeometry(8.6, 8.6, 0.25, 28), mat('#f2c49a', { flat: true }), x + 0.8, y + 20.75, z);   // the canopy's pale underside
  }

  // ---------------------------------------------------------- far away: mesas, lilac with distance
  {
    const parts = [];
    for (let i = 0; i < 11; i++) {
      const a = i * 0.83 + 0.4, r = 520 + (i % 3) * 70;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, w = 30 + (i % 4) * 14, h = 60 + (i % 5) * 26;
      parts.push(new THREE.CylinderGeometry(w * 0.82, w, h, 9, 1).translate(x, H(x, z) + h / 2 - 6, z).toNonIndexed());
    }
    const mesas = add(mergeGeometries(parts), mat('#b9a3c9', { color2: '#d8b7c4', color3: '#9a8fb8', mode: MODE_STRATA, strataSize: 9 }));
    mesas.userData.noCollide = true;
  }

  return {
    id: 'home',
    ground: terrain,
    spawn: new THREE.Vector3(9, H(9, -1), -1),
    spawnHeading: Math.PI,
    camYaw: 0,
    shipSite: { ...HOME_SPOTS.ship },
    features: { mount: false, wind: true, jetpack: false, climb: true, sky: true },
    limit: Infinity,
    killY: -Infinity,
    lights,
    smallProps,
    defaults: {
      hour: 17.6, preset: 'Moebius print', cloudShadows: 0,
      look: { uLineWidth: 1.1, uLineVary: 0.2, uWobble: 0.15, uHatch: 0.55, uDots: 0, uSkyDots: 0.25 },
    },
    sky: {
      script: {
        day: ['#a9b4d8', '#f6c4ae', '#9b9cc8', '#fff6dc', '#fff0d6'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a86b8', '#ffe6c0', '#ffd8a8'],     // the call screen's window: dusk blue over a peach band
        night: ['#25305a', '#4a5a8a', '#34405e', '#c8bfd8', '#f2f0e6'],
      },
      planets: [{ az: 170, el: 24, size: 9, color: '#f6efd0', craters: false }, { az: 188, el: 34, size: 4, color: '#f2c54b', craters: false }],
    },
    life: {
      flocks: [{ count: 9, color: '#2b211f', size: 0.9, radius: 70, height: [22, 46], seed: 5 }],
      motes: { count: 140, color: '#fff3d0', size: 0.04, rise: 0.08, wind: [0.3, 0.1] },
      footprints: '#c98f6a',
    },
    atmo: () => ({ tint: [1.0, 0.98, 0.98], fog: 0.5, name: 'Home' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}
