import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { DESERT_WORLD_LOOK } from '../desert-sites.js';
import { GAMES } from '../minigames/index.js';   // (none in node's tests: there is no glob there)
import { placeGameMarker } from '../minigames/kit/marker.js';
import { arcadeSigns, returnSpot, ARCADE_RING } from '../minigames/kit/arcade.js';
import { bestScore, formatScore } from '../minigames/kit/scores.js';
import { scoreDef } from '../minigames/kit/flow.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { game } from '../game-state.js';
import { ArcadeBoard } from './arcade-board.js';

// ---------------------------------------------------------------------------
// The Arcade: a developer's plaza for trying the minigames (docs/systems/minigames.md, "The Arcade"),
// reached only from the worlds list (?level=arcade). A round paved court inside a ring of squat
// mushroom-capped pillars, a basin and a tall hooped spire in the middle; round it, on a ring, one arcade
// sign per game of the registry (kit/arcade.js arcadeSigns: a new game gets its sign by itself), its name and
// best on a plate. The interact button at a sign plays it (?game=<id>&from=arcade); Quit comes back here,
// in front of that sign (?level=arcade&back=<id>). The games board by the way in (and Tab, D-pad ↓, the
// "games" button) lists them all, to jump straight into one.
// ---------------------------------------------------------------------------

const PLAZA = { radius: 21, wall: 23.5 };

/** A game's best as the signs and the board print it ('' for none). */
export function bestText(g, state = game) {
  const v = bestScore(state, scoreDef(g, state));
  return v === null ? '' : formatScore(g, v);
}

/** The games board's model: two posts, a wide panel with every game's name in ink, a lamp each side. */
function boardModel(games) {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: '#c9b08a', color2: '#b59a74', color3: '#a08662', mode: MODE_STRATA, strataSize: 0.9 });
  const ink = makeMaterial({ color: '#3b2f2a', flat: true });
  const glow = makeMaterial({ color: '#f2c54b', glow: 1, flat: true });
  for (const x of [-1.55, 1.55]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), stone);
    post.position.set(x, 1.6, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), glow);
    lamp.position.set(x, 3.32, 0);
    g.add(post, lamp);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 0.12), stone);
  back.position.set(0, 2.0, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 0.5), ink);
  roof.position.set(0, 3.05, 0.05);
  g.add(back, roof);
  // the panel: the games' names on paper (a canvas; plain ink where there is none)
  let face = null;
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 560;
    const x = c.getContext('2d');
    if (x) {
      x.fillStyle = '#f7ecd2'; x.fillRect(0, 0, c.width, c.height);
      x.strokeStyle = '#2b211f'; x.lineWidth = 12; x.strokeRect(6, 6, c.width - 12, c.height - 12);
      x.fillStyle = '#2b211f'; x.textBaseline = 'middle';
      x.font = '900 64px ui-monospace, Menlo, monospace'; x.textAlign = 'center';
      x.fillText('THE GAMES', c.width / 2, 70);
      x.fillRect(60, 116, c.width - 120, 5);
      const half = Math.ceil(games.length / 2), rowH = Math.min(70, 380 / Math.max(1, half));
      x.textAlign = 'left';
      x.font = `700 ${Math.round(rowH * 0.56)}px ui-monospace, Menlo, monospace`;
      games.forEach((q, i) => {
        const col = i < half ? 0 : 1, row = i % half, px = 70 + col * 470, py = 160 + row * rowH + rowH / 2;
        x.fillStyle = q.color ?? '#71d7cf'; x.beginPath(); x.arc(px, py, 13, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#2b211f'; x.lineWidth = 4; x.stroke();
        x.fillStyle = '#2b211f'; x.fillText(q.name, px + 28, py);
      });
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      face = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.7), makeMaterial({ color: '#ffffff', map: tex, flat: true, glow: 0.35 }));
    }
  }
  face ??= new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.7), ink);
  face.position.set(0, 2.0, 0.07);
  face.userData.noCollide = true;
  g.add(face);
  return g;
}

export function* buildArcade(scene, { games = GAMES, state = game, search = globalThis.location?.search ?? '' } = {}) {
  const terrain = yield* Terrain.make({
    size: 400, seg: 80,
    // flat inside the pillars and out to the south where the ship stands, rising into low dunes beyond
    height: (x, z) => {
      const r = Math.hypot(x, z), apron = Math.max(Math.abs(x) - 22, z < 0 ? 99 : z - 78, 0);
      return Math.max(0, Math.min(r - PLAZA.wall - 6, apron) * 0.2);
    },
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const lights = [];
  const stone = makeMaterial({ color: '#d9c6a2', color2: '#cbb48d', color3: '#b39b74', mode: MODE_STRATA, strataSize: 1.1 });
  const rose = makeMaterial({ color: '#d98a6a', color2: '#c97a5c', color3: '#b8694e', mode: MODE_STRATA, strataSize: 0.8 });
  const teal = makeMaterial({ color: '#71b7ad', color2: '#5fa79e', color3: '#4f978f', mode: MODE_STRATA, strataSize: 0.7 });
  const ink = makeMaterial({ color: '#3b2f2a', flat: true });
  // the court: pale paving, a ring of darker stone where the signs stand, a rim of ink round its edge
  {
    const pave = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.radius, 72).rotateX(-Math.PI / 2), makeMaterial({ color: '#eadbb9', color2: '#e2cfa8', color3: '#d6c095', plates: 3 }));
    pave.position.y = 0.02; pave.userData.noCollide = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARCADE_RING.radius - 1.4, ARCADE_RING.radius + 1.4, 96).rotateX(-Math.PI / 2), makeMaterial({ color: '#c9a77e', color2: '#bf9b70', color3: '#b38f66', plates: 2 }));
    ring.position.y = 0.03; ring.userData.noCollide = true;
    const rim = new THREE.Mesh(new THREE.RingGeometry(PLAZA.radius - 0.25, PLAZA.radius, 96).rotateX(-Math.PI / 2), ink);
    rim.position.y = 0.035; rim.userData.noCollide = true;
    const inner = new THREE.Mesh(new THREE.RingGeometry(ARCADE_RING.radius - 1.5, ARCADE_RING.radius - 1.4, 96).rotateX(-Math.PI / 2), ink);
    inner.position.y = 0.04; inner.userData.noCollide = true;
    scene.add(pave, ring, rim, inner);
  }
  yield;
  // the pillars round the court: squat drums with mushroom caps, a gap to the south where you come in
  {
    const drums = [], caps = [], bands = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.3) continue;   // (the way in)
      const x = Math.sin(a) * PLAZA.wall, z = -Math.cos(a) * PLAZA.wall, h = 2.4 + (i % 3) * 0.7;
      drums.push(new THREE.CylinderGeometry(0.9, 1.15, h, 10).translate(x, h / 2, z).toNonIndexed());
      caps.push(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(x, h, z).toNonIndexed());
      bands.push(new THREE.CylinderGeometry(1.0, 1.0, 0.22, 10).translate(x, h * 0.62, z).toNonIndexed());
    }
    scene.add(new THREE.Mesh(mergeGeometries(drums), stone), new THREE.Mesh(mergeGeometries(caps), rose), new THREE.Mesh(mergeGeometries(bands), ink));
    // two tall pylons framing the way in, a ball on each
    for (const x of [-4.2, 4.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 7, 8), teal);
      p.position.set(x, 3.5, PLAZA.wall);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 10), rose);
      ball.position.set(x, 7.6, PLAZA.wall);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 28), ink);
      hoop.position.set(x, 7.6, PLAZA.wall); hoop.rotation.x = Math.PI / 2;
      scene.add(p, ball, hoop);
    }
  }
  yield;
  // the middle: a round basin of glowing water and a tall spire with a hoop and a lamp
  {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.7, 32, 1, true), stone);
    basin.position.y = 0.35;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.22, 6, 48).rotateX(Math.PI / 2), rose);
    lip.position.y = 0.72;
    const water = new THREE.Mesh(new THREE.CircleGeometry(4.1, 48).rotateX(-Math.PI / 2), makeMaterial({ color: '#8fd3c8', glow: 0.35, flat: true }));
    water.position.y = 0.5; water.userData.noCollide = true;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.7, 9, 10), teal);
    spire.position.y = 4.5;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 12), rose);
    knob.position.y = 9.4;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.12, 8, 40), ink);
    hoop.position.y = 6.6; hoop.rotation.x = Math.PI / 2;
    const hoop2 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.09, 8, 36), makeMaterial({ color: '#f2c54b', glow: 1, flat: true }));
    hoop2.position.y = 7.6; hoop2.rotation.x = Math.PI / 2;
    scene.add(basin, lip, water, spire, knob, hoop, hoop2);
    lights.push(new THREE.Vector4(0, 7.6, 0, 9));
  }
  yield;
  // a sign per game, on the ring, facing the middle; its plate says its name and its best
  const signs = arcadeSigns(games);
  for (const s of signs) {
    try {
      const m = placeGameMarker({ scene, levelId: 'arcade', lights }, s.id, s.pos, { heading: s.heading, games, plate: bestText(games.find((g) => g.id === s.id), state) || 'no best yet' });
      m.object.scale.setScalar(1.2);   // (a little bigger than a world's: the plaza is wide)
    } catch (e) { console.warn('arcade', s.id, e); }
  }
  // the games board by the way in, facing whoever comes in from the south
  const board = new ArcadeBoard({ games, best: (g) => bestText(g, state) });
  const boardAt = new THREE.Vector3(-3.2, 0, 15.5);
  {
    const m = boardModel(games);
    m.position.copy(boardAt);
    m.rotation.y = 0.25;
    scene.add(m);
    lights.push(new THREE.Vector4(boardAt.x, 3.3, boardAt.z, 5));
    registerInteractable({
      id: 'arcade.board', priority: PRIORITY.use, range: 3.6,
      at: () => boardAt.clone().add(new THREE.Vector3(0, 3.6, 0)),
      prompt: 'open the games board',
      distance: (p) => p.pos.distanceTo(boardAt),
      use: () => board.toggle(true),
    });
  }
  // coming back from a game (?back=<id>): standing in front of its sign, facing it
  const back = returnSpot(signs, new URLSearchParams(search).get('back'));
  const spawn = back ? new THREE.Vector3(...back.pos) : new THREE.Vector3(0, 0, 19);
  const spawnHeading = back ? back.heading : Math.PI;

  return {
    id: 'arcade',
    ground: terrain,
    spawn,
    spawnHeading,
    camYaw: spawnHeading + Math.PI,
    keepSpawn: !!back,   // (main.js: not the place saved as you left, the sign's)
    signs,
    limit: 160,
    lights,
    foes: { wild: false },
    peaceful: true,
    shipSite: { x: 0, z: 62, heading: Math.PI },   // (out past the way in)
    features: { mount: false, wind: false, jetpack: false, climb: false },
    defaults: { hour: 16.5, preset: 'Moebius print', cloudShadows: 0, look: DESERT_WORLD_LOOK },
    killY: -Infinity,
    reactions: false,
    quickMenu: board,   // (main.js: one of its menus; D-pad ↓ opens it, the potion's button: the menu takes it here)
    sky: {
      script: {
        day: ['#9fbcc6', '#dfe3d6', '#9fb0cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 1.0, name: 'The Arcade' }),
    update() {},
  };
}
export const createArcade = stepped(buildArcade);
