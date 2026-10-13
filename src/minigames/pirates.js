// Pirates between worlds (docs/systems/minigames.md, "Pirates between worlds"): a rail shooter in space. The
// family ship (the angular hull, src/ship/model.js, small) flies forward through the dark between worlds; chime-
// pirates come at it in waves, a hauler lays mines, and their captain's gunship waits at the end. Steer within the
// screen, shoot, roll away from their fire, hold to charge a shot that locks on and bursts.
//
// The rules are pure (src/minigames/pirates-rules.js, tests/pirates.test.js); this file draws them: the sky is the
// space look the City Floating in Space already compiles (post.js INK_SPACE), and everything that flies is a few
// instanced meshes of the game's one material (makeMaterial, coloured per instance as the puffs and the dots are),
// so the minigame adds no shader program (docs/systems/performance.md).
//
// It plays from the Debug menu's Games (?game=pirates) and, the first time the ship flies to a world never visited,
// between the take-off and the landing (?game=pirates&to=<world>: src/ambush.js, main.js).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { arenaLevel } from './kit/world.js';
import { WorldLabels } from './kit/labels.js';
import { buildShipModel } from '../ship/model.js';
import { FACE } from '../typefaces.js';
import { Puffs } from '../ship/fx.js';
import { PLANETS } from '../ship/planets.js';
import { SPACE_LOOK, SPACE_DAY } from '../levels/space-city-kit.js';
import { stripTone } from '../story/tone.js';
import { shakeScale } from '../feel.js';
import { optionKey } from './kit/flow.js';
import { AMBUSH_LINES, SPEAKERS, ambushCount } from '../ambush.js';
import { FLY, BOSS, CHECKPOINTS, CHIME_RATE, chimesFor, newRun, runStep, pirateInput, railPoint, railX, railY, seedOf, courseRocks, partAt, botInput, aimAt, aimTarget } from './pirates-rules.js';

const INK = '#2b211f';
/** The height every ground query answers (no ground in space; finite, so what the host places on the ground has a place). */
const FLOOR = -600;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nc = (m) => { m.userData.noCollide = true; m.userData.dynamic = true; return m; };

/** The ship's scale here (its hull is 22 m long at home: 5.5 m in the shooter). */
export const SHIP_SCALE = 0.25;
/**
 * The camera: behind and over the ship, how much of the ship's offset it follows (less than all of it, so the ship
 * moves about the screen, as in Star Fox: 0.8 until v1.45, when it sat nearly still in the middle), how quickly
 * (`rate`, 1/s), how far ahead it looks and how much it leads the ship's sideways speed there (`lead`, s), its lens.
 */
export const CAM = { back: 14, up: 4.4, follow: 0.55, rate: 3.5, look: 40, lead: 0.35, roll: 0.3, fov: 50 };

// ------------------------------------------------------------------ the shapes
/** Merge primitives into one geometry: non-indexed, position / normal / uv only (as src/ship/geo.js Batch). */
function merge(geos) {
  const out = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  const m = mergeGeometries(out);
  m.computeVertexNormals();
  return m;
}
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
/** A cone pointing along -z (forward), its base at z0. */
const nose = (r, len, seg = 5, z0 = 0) => new THREE.ConeGeometry(r, len, seg).rotateX(-Math.PI / 2).translate(0, 0, z0 - len / 2);
/** A fin swept back: a thin wedge from the root (x0) out to the tip (x1). */
function fin(x0, x1, z0, z1, sweep, thick = 0.12, y = 0) {
  const g = new THREE.BufferGeometry();
  const p = [x0, y, z0, x1, y, z0 + sweep, x1, y, z0 + sweep + 0.5, x0, y, z1];
  const t = thick / 2;
  const v = [];
  const quad = (a, b, c, d) => v.push(...a, ...b, ...c, ...a, ...c, ...d);
  const P = (i, dy) => [p[i * 3], p[i * 3 + 1] + dy, p[i * 3 + 2]];
  quad(P(0, t), P(3, t), P(2, t), P(1, t)); quad(P(0, -t), P(1, -t), P(2, -t), P(3, -t));
  quad(P(0, -t), P(0, t), P(1, t), P(1, -t)); quad(P(1, -t), P(1, t), P(2, t), P(2, -t)); quad(P(2, -t), P(2, t), P(3, t), P(3, -t));
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}
const mirror = (g) => g.clone().scale(-1, 1, 1);
/** Two-sided: a mirrored copy's faces turned back the right way round. */
function both(g) {
  const m = mirror(g), p = m.attributes.position.array;   // (fin() is non-indexed already)
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const a = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = a; }
  return [g, m];
}

/** The pirates, each a few parts in flat colours (the post's ink draws their lines), built along -z (the nose). */
export function pirateShapes() {
  return {
    // the skiff: a rust dart with mustard fins swept back, a teal eye
    skiff: [
      { color: '#b4523e', geo: merge([nose(0.95, 3.4, 5, 1.2), new THREE.CylinderGeometry(0.95, 0.7, 1.6, 5).rotateX(Math.PI / 2).translate(0, 0, 2.0)]) },
      { color: '#e0a84a', geo: merge([...both(fin(0.5, 3.1, 0.6, 2.6, 1.6)), box(0.12, 1.3, 1.1, 0, 0.8, 2.2)]) },
      { color: '#8ff2e6', glow: true, geo: merge([new THREE.SphereGeometry(0.42, 8, 6).scale(1, 0.7, 1.3).translate(0, 0.45, -0.3), box(0.9, 0.35, 0.2, 0, 0, 2.85)]) },
    ],
    // the raider: a teal hammerhead on two rust outrigger pods, a red-orange glow under the brow
    raider: [
      { color: '#3f6f78', geo: merge([box(1.5, 1.0, 4.6, 0, 0, 0.6), box(5.2, 0.5, 1.2, 0, 0.3, -1.6), nose(0.8, 1.8, 4, -1.6)]) },
      { color: '#b4523e', geo: merge([...[-2.6, 2.6].map((x) => new THREE.CylinderGeometry(0.55, 0.55, 3.6, 6).rotateX(Math.PI / 2).translate(x, -0.2, 0.4)), ...both(fin(0.7, 2.2, 1.6, 3.0, 0.8, 0.12, 0.2))]) },
      { color: '#ff7a4a', glow: true, geo: merge([box(3.6, 0.22, 0.2, 0, 0.1, -2.25), ...[-2.6, 2.6].map((x) => new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6).rotateX(Math.PI / 2).translate(x, -0.2, 2.25))]) },
    ],
    // the hauler: an aubergine barrel bound in brass, a grab claw in front for the chimes it means to take, lanterns
    hauler: [
      { color: '#6a557e', geo: merge([new THREE.CylinderGeometry(2.4, 2.4, 7, 8).rotateX(Math.PI / 2), new THREE.CylinderGeometry(2.4, 1.2, 1.6, 8).rotateX(Math.PI / 2).translate(0, 0, 4.3)]) },
      { color: '#c99d48', geo: merge([...[-2.4, 0, 2.4].map((z) => new THREE.TorusGeometry(2.45, 0.22, 4, 8).translate(0, 0, z)), ...[-1, 1].map((s) => box(0.35, 0.35, 3.6, s * 1.5, -1.6, -4.6))]) },
      { color: '#3a3340', geo: merge([...[-1, 1].map((s) => box(0.4, 2.6, 0.4, s * 1.5, -1.4, -6.4).rotateZ(s * 0.25)), box(3.6, 0.4, 0.4, 0, -2.4, -6.5)]) },
      { color: '#f2c54b', glow: true, geo: merge([...[[-1.8, 1.8], [1.8, 1.8], [0, 2.5]].map(([x, y]) => new THREE.SphereGeometry(0.32, 6, 4).translate(x, y, -2.8))]) },
    ],
    // a mine: a rust ball of spikes round a red eye that blinks
    mine: [
      { color: '#9a4a3c', geo: merge([new THREE.IcosahedronGeometry(1.0, 0), ...[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([x, y, z]) => new THREE.ConeGeometry(0.25, 0.9, 4).translate(0, 1.2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(x, y, z))))]) },
      { color: '#ff5a3c', glow: true, geo: new THREE.SphereGeometry(0.55, 8, 6) },
    ],
  };
}

/** A rock: a lumpy ball (its points pushed in and out by where they are, so the faces still meet), faceted. */
function rockShape(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.78 + 0.32 * (0.5 + 0.5 * Math.sin(x * 5.1 + seed * 1.7) * Math.cos(y * 4.3 - seed) * Math.sin(z * 3.7 + seed * 2.3));
    p.setXYZ(i, x * k * (seed === 1 ? 1.3 : 1), y * k * (seed === 2 ? 0.75 : 1), z * k);
  }
  g.computeVertexNormals();
  return g;
}
const ROCK_TONES = ['#c9a27a', '#b98d6e', '#d8b48c', '#9c8fb0', '#e0c3a0'];

// ------------------------------------------------------------------ the instanced views
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _w = new THREE.Color('#ffffff');
const BODY = () => makeMaterial({ color: '#ffffff', key: 'pirates-body' });
const GLOW = () => makeMaterial({ color: '#ffffff', glow: 1, key: 'pirates-glow' });

/** One kind of thing drawn many times: an instanced mesh per part, a pool of `max`; begin(), put(…) each, end(). */
class Many {
  constructor(scene, parts, max, noShadow) {
    this.parts = parts.map((p) => {
      const mesh = nc(new THREE.InstancedMesh(p.geo, p.glow ? GLOW() : BODY(), max));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < max; i++) mesh.setColorAt(i, _c.set(p.color));   // (always coloured per instance: one program for all of them)
      mesh.count = 0; mesh.frustumCulled = false;
      scene.add(mesh); noShadow?.push(mesh);
      return { mesh, color: new THREE.Color(p.color), glow: !!p.glow };
    });
    this.max = max; this.n = 0;
  }
  begin() { this.n = 0; }
  /** One more: at pos, turned q, scaled s; flash 0..1 whitens it (a hit); color: the body's own colour (the rocks' tones). */
  put(pos, q, s, flash = 0, color = null, glowK = 1) {
    if (this.n >= this.max) return;
    _m.compose(pos, q, _s.setScalar(s));
    for (const p of this.parts) {
      p.mesh.setMatrixAt(this.n, _m);
      _c.copy(color && !p.glow ? color : p.color);
      if (p.glow && glowK !== 1) _c.multiplyScalar(glowK);
      if (flash > 0) _c.lerp(_w, flash);
      p.mesh.setColorAt(this.n, _c);
    }
    this.n++;
  }
  end() {
    for (const p of this.parts) {
      p.mesh.count = this.n;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
}

/** The bolts, the pirates' shots, the sparks and the dust: one instanced mesh of stretched, glowing drops. */
class Drops {
  constructor(scene, max, noShadow) {
    this.mesh = nc(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), GLOW(), max));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, _c.set('#ffffff'));
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    scene.add(this.mesh); noShadow?.push(this.mesh);
    this.max = max; this.n = 0;
  }
  begin() { this.n = 0; }
  /** A drop at pos, stretched `len` along dir (a unit vector), `r` thick. */
  put(pos, dir, r, len, color) {
    if (this.n >= this.max) return;
    _q.setFromUnitVectors(_zAxis, dir);
    _m.compose(pos, _q, _s.set(r, r, len));
    this.mesh.setMatrixAt(this.n, _m);
    this.mesh.setColorAt(this.n, _c.set(color));
    this.n++;
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
}
const _zAxis = V(0, 0, 1);

// ------------------------------------------------------------------ the arena
const SPACE_SCRIPT = { day: SPACE_DAY, dusk: SPACE_DAY, night: SPACE_DAY };   // (space black at every hour: the City Floating in Space's light)
/** The look: the City Floating in Space's (the same compiled parts of the ink pass), its nebula stronger and violet. */
export const PIRATE_LOOK = { ...SPACE_LOOK, uSpace: [1, 0.24, 0.4, 0.8], uSpaceTone: [0.17, 0.1, 0.24, 1], uSpaceNight: [0.2, 0.17, 0.2, 1], uFogDensity: 0.0006, uFogStart: 220 };

function* buildPirates(scene) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const to = q.get('to');
  const seed = seedOf(to ?? 'arcade');
  const noShadow = [];
  // where the traveller waits, out of sight under the start (an invisible ledge: the physics wants something)
  const spawn = V(0, -80, 60);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6), makeMaterial({ color: INK, flat: true }));
  ledge.position.set(spawn.x, spawn.y - 0.5, spawn.z);
  ledge.visible = false;
  scene.add(ledge);
  yield;
  // the family ship, small; its rooms hidden, its hatch shut
  const model = buildShipModel({ space: true, legs: 'up' });
  for (const o of [...model.indoor, model.screen]) o.visible = false;
  model.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  model.mats.thrust.uniforms.uGlow.value = 1;
  const ship = new THREE.Group();
  model.group.scale.setScalar(SHIP_SCALE);
  model.group.position.set(0, -1.1 * SHIP_SCALE, -1.1 * SHIP_SCALE);
  // two engine flames at the stern (the hull's bells point down: these push it forward)
  const flames = nc(new THREE.Mesh(merge([-0.5, 0.5].map((x) => new THREE.ConeGeometry(0.16, 1.1, 6).rotateX(Math.PI / 2).translate(x, 0.15, 3.95))), makeMaterial({ color: '#ffd27a', glow: 0.8, key: 'pirates-flame' })));
  ship.add(model.group, flames);
  scene.add(ship);
  noShadow.push(flames);
  yield;
  const S = pirateShapes();
  const kinds = {
    skiff: new Many(scene, S.skiff, 16, noShadow), raider: new Many(scene, S.raider, 6, noShadow),
    hauler: new Many(scene, S.hauler, 2, noShadow), mine: new Many(scene, S.mine, 16, noShadow),
  };
  const rocks = [0, 1, 2].map((k) => new Many(scene, [{ color: ROCK_TONES[0], geo: rockShape(k) }], 90, noShadow));
  const drops = new Drops(scene, 360, noShadow);
  yield;
  // far bodies hung along the way, for the eye: pale moons and planetoids a long way off either side
  const far = nc(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), BODY(), 16));
  {
    const R = Math.random;
    const tones = ['#f4b49a', '#c3bbec', '#9fe0d6', '#f6d792', '#e9998a', '#cfe5ea'];
    for (let i = 0; i < 16; i++) {
      const s = 300 + i * 420 + R() * 200, side = i % 2 ? 1 : -1, r = 30 + R() * 90;
      const p = railPoint(s, side * (700 + R() * 700), (R() * 2 - 1) * 320, V());
      _m.compose(p, _q.identity(), _s.setScalar(r));
      far.setMatrixAt(i, _m);
      far.setColorAt(i, _c.set(tones[i % tones.length]));
    }
    far.frustumCulled = false;
    scene.add(far); noShadow.push(far);
  }
  // the repair rings: a teal hoop with a cream cross, two of them reused
  const ringGeo = merge([new THREE.TorusGeometry(3.4, 0.28, 6, 28), box(1.6, 0.36, 0.2), box(0.36, 1.6, 0.2)]);
  const rings = [0, 1].map(() => { const m = nc(new THREE.Mesh(ringGeo, makeMaterial({ color: '#71d7cf', glow: 0.8, key: 'pirates-ring' }))); m.visible = false; scene.add(m); noShadow.push(m); return m; });
  const boss = buildGunship(scene, noShadow);
  yield;
  const look = PLANETS[to] ?? { body: '#f4b49a' };
  return arenaLevel({
    ground: { heightAt: () => FLOOR },   // (nothing to stand on out here; the host's things placed on the ground land far below, out of sight)
    spawn, name: 'Between worlds', hour: 8.5,
    look: PIRATE_LOOK,
    // the destination ahead, low, in its colour from the galactic map
    sky: { script: SPACE_SCRIPT, planets: [{ az: 180, el: 7, size: 14, color: look.body, craters: false }] },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.5, name: 'Between worlds' }),
    noShadow,
    pirates: { to, seed, ship, model, flames, kinds, rocks, drops, rings, boss },
  });
}

/** The gunship's size over its drawing (the parts' places in BOSS are in metres: divided by this to draw them). */
export const GUNSHIP_SCALE = 1.35;
/** How far behind its parts (m along the flight) the gunship's middle hangs: the turrets are drawn level with where they are hit. */
export const GUNSHIP_BACK = 6 * GUNSHIP_SCALE;
/** How far its nose is tipped down toward the ship (rad), so its back and its bridge are seen as well as its front. */
export const GUNSHIP_TILT = 0.16;
/** Its colours: the hull, the armour, the dark iron, the engines' glow, the markings (cream, coral), the turrets, the bridge. */
export const GUNSHIP_COLORS = { hull: '#5e4a72', armour: '#9a3f35', iron: '#3a3340', engine: '#ff9a4a', bone: '#f3ead8', stripe: '#ef9479', turret: '#c99d48', lens: '#8ff2e6' };

/**
 * The captain's gunship (issue #206: "the boss should be a space ship, not a floating pirate ship"; a galleon under
 * solar sails until v1.59), drawn to be read from in front, where it is fought: a deep hexagonal aubergine hull with a
 * grappling jaw under its prow and a cream skull and crossbones on its face; gull wings rising to a brass turret on each
 * tip (the parts gunL / gunR: BOSS.parts' u, v), a fin under each; two engine nacelles under the wings, their intakes
 * glowing at the front, a third engine astern; oxblood armour on the spine, the wings' leading edges and the bridge's
 * tower, gun ports down the flanks, coral chevrons, a pennant on the dorsal fin. On the tower the bridge: a teal lens
 * behind two armour shutters that open once both turrets are down. Facing +z (toward the ship it waits for). A material
 * a part, so a hit whitens only it: 13 meshes, 13 draw calls (the galleon had 12).
 */
export function buildGunship(scene, noShadow = []) {
  const g = new THREE.Group(), G = GUNSHIP_SCALE, C = GUNSHIP_COLORS;
  const mat = (color, key, glow = 0) => makeMaterial({ color, glow, key: `pirates-${key}` });
  const add = (geo, m, name) => { const mesh = nc(new THREE.Mesh(geo, m)); mesh.name = name; g.add(mesh); noShadow.push(mesh); return mesh; };
  const cyl = (rt, rb, len, seg = 8) => new THREE.CylinderGeometry(rt, rb, len, seg).rotateX(Math.PI / 2);   // (along z, its top toward +z)
  const T = BOSS.parts.filter((q) => q.id !== 'core').map((p) => ({ id: p.id, x: p.u / G, y: p.v / G }));
  const tipX = Math.abs(T[0].x), tipY = T[0].y, zT = GUNSHIP_BACK / G;
  const core = BOSS.parts.find((q) => q.id === 'core'), cy = core.v / G;
  const bodyY = -1.4, bodyR = 3.0, front = 9;   // (the hull's middle, its hexagon's size, its face)
  const rootX = bodyR * 0.85, rootY = bodyY + 0.3;
  const wingA = Math.atan2(tipY - rootY, tipX - rootX), wingL = Math.hypot(tipX - rootX, tipY - rootY);
  const wing = (sx, w, h, d, z, dy = 0) => box(wingL + w, h, d).translate(0, dy, 0).rotateZ(sx * wingA).translate(sx * (rootX + tipX) / 2, (rootY + tipY) / 2, z);
  const nac = [-1, 1].map((sx) => [sx * 4.6, bodyY - 1.6]);
  // the hull: the hexagonal body, the jaw's lower beak, the gull wings, the fins under the turrets, the dorsal fin
  add(merge([
    cyl(bodyR * 0.88, bodyR, 22, 6).translate(0, bodyY, front - 11),
    new THREE.ConeGeometry(1.5, 4, 6).rotateX(Math.PI / 2).scale(1.3, 0.6, 1).translate(0, bodyY - 1.9, front + 2),
    ...[-1, 1].map((sx) => wing(sx, 0, 0.7, 6, zT - 1.5)),
    ...[-1, 1].map((sx) => box(0.5, 3.6, 4.5).rotateX(0.25).translate(sx * tipX, tipY - 2.4, zT - 2)),
    box(0.45, 3.4, 6.5, 0, bodyY + 4.2, -7).rotateX(-0.12),
  ]), mat(C.hull, 'hull'), 'hull');
  // the armour: the spine's plates, the wings' leading edges, the turrets' collars, the bridge's tower, the jaw's two mandibles
  add(merge([
    box(2.6, 0.7, 15, 0, bodyY + bodyR * 0.86, -2),
    ...[-1, 1].map((sx) => wing(sx, -0.6, 0.9, 1.0, zT + 1.9)),
    ...T.map((t) => cyl(1.55, 1.55, 1.6, 8).translate(t.x, t.y - 0.3, zT)),
    box(3.8, 2.4, 3.6, 0, cy - 0.1, front - 2.3),
    ...[-1, 1].map((sx) => box(0.8, 0.9, 4.2).rotateY(-sx * 0.22).translate(sx * 1.7, bodyY - 2.2, front + 1.6)),
  ]), mat(C.armour, 'armour'), 'armour');
  // the dark iron: the engine nacelles and the stern's engine, gun ports down the flanks, an antenna, the skull's eyes
  const ports = [];
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) ports.push(box(0.3, 0.5, 1.0, sx * bodyR * 0.95, bodyY + 0.2, front - 2.5 - k * 3));
  add(merge([
    ...nac.map(([x, y]) => cyl(1.25, 1.4, 11, 8).translate(x, y, zT - 6.5)),
    cyl(1.6, 1.9, 4, 8).translate(0, bodyY, -14),
    ...ports,
    box(0.14, 3.2, 0.14, 1.1, bodyY + bodyR + 2.2, -1),
    ...[-0.42, 0.42].map((dx) => box(0.42, 0.42, 0.14, dx, bodyY + 0.75, front + 0.32)),
    box(0.22, 0.3, 0.14, 0, bodyY + 0.3, front + 0.32),
  ]), mat(C.iron, 'iron'), 'iron');
  // the engines' glow: the nacelles' intakes facing the ship and their nozzles astern, the stern's nozzle
  add(merge([
    ...nac.flatMap(([x, y]) => [new THREE.TorusGeometry(1.05, 0.24, 4, 12).translate(x, y, zT - 1), cyl(1.0, 1.0, 0.3, 8).translate(x, y, zT - 12.1), cyl(0.7, 0.7, 0.2, 8).translate(x, y, zT - 1.05)]),
    cyl(1.4, 1.4, 0.3, 8).translate(0, bodyY, -16.1),
  ]), mat(C.engine, 'engine', 0.9), 'engines');
  // the markings: a cream skull and crossbones on the hull's face
  add(merge([
    new THREE.CylinderGeometry(1.0, 1.0, 0.16, 12).rotateX(Math.PI / 2).translate(0, bodyY + 0.75, front + 0.2),
    box(1.05, 0.55, 0.16, 0, bodyY + 0.1, front + 0.2),
    ...[-0.72, 0.72].map((a) => box(3.4, 0.34, 0.12).rotateZ(a).translate(0, bodyY + 0.45, front + 0.1)),
  ]), mat(C.bone, 'bone'), 'markings');
  // coral: chevrons on the wings, a stripe down each fin, the pennant, a band round the tower
  add(merge([
    ...[-1, 1].flatMap((sx) => [0.3, 0.62].map((k) => box(0.6, 0.12, 3.6).rotateY(sx * 0.5).translate(0, 0.42, 0).rotateZ(sx * wingA).translate(sx * (rootX + (tipX - rootX) * k), rootY + (tipY - rootY) * k, zT - 1.2))),
    ...[-1, 1].map((sx) => box(0.56, 0.7, 4.6).rotateX(0.25).translate(sx * tipX, tipY - 3.4, zT - 2)),
    box(0.1, 1.4, 2.6, 0, bodyY + bodyR + 3.0, -9.6),
    box(3.9, 0.45, 3.7, 0, cy - 1.0, front - 2.3),
  ]), mat(C.stripe, 'stripe'), 'stripes');
  // the turrets (parts gunL / gunR): a brass dome on each wingtip, two dark barrels toward the ship
  const guns = {};
  for (const t of T) {
    const pod = new THREE.Group();
    pod.position.set(t.x, t.y, zT);
    const m = mat(C.turret, t.id);
    const housing = nc(new THREE.Mesh(merge([new THREE.SphereGeometry(1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cyl(1.8, 1.8, 0.6, 10).rotateX(-Math.PI / 2).translate(0, -0.3, 0), box(1.6, 0.9, 1.4, 0, 0.5, 1.2)]), m));
    const barrels = nc(new THREE.Mesh(merge([-0.5, 0.5].map((x) => cyl(0.26, 0.3, 3.4, 6).translate(x, 0.55, 3.0))), mat(INK, `${t.id}-barrels`)));
    housing.name = t.id; barrels.name = `${t.id}-barrels`;
    pod.add(housing, barrels);
    g.add(pod); noShadow.push(housing, barrels);
    guns[t.id] = { pod, mat: m, base: new THREE.Color(C.turret) };
  }
  // the bridge on the tower's face: the lens, and two shutters over it that slide apart
  const cz = front - 0.4;
  const lensMat = mat(C.lens, 'core', 0.9);
  const lens = add(new THREE.SphereGeometry(1.45, 12, 8).scale(1, 0.62, 0.6).translate(core.u / G, cy, cz), lensMat, 'core');
  const shutterMat = mat(C.iron, 'shutter');
  const shutters = [-1, 1].map((sx) => { const m = add(box(1.6, 1.3, 0.3, sx * 0.8, cy, cz + 0.85), shutterMat, 'shutter'); m.userData.side = sx; return m; });
  g.scale.setScalar(G);
  g.visible = false;
  scene.add(g);
  return { group: g, guns, lens, lensMat, shutters, core: { mat: lensMat, base: new THREE.Color(C.lens) } };
}

// ------------------------------------------------------------------ the sounds
function shooterSounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && sound.fx;
  const now = () => sound.ctx.currentTime;
  let lastShot = 0;
  return {
    shot() { if (!on()) return; const t = now(); if (t - lastShot < 0.05) return; lastShot = t; sound.sweep(t, 1400, 520, 0.07, 0.022, 'square'); },
    enemy() { if (on()) sound.sweep(now(), 520, 260, 0.12, 0.018, 'sawtooth'); },
    boom(k = 1) { if (!on()) return; const t = now(); sound.burst(t, { dur: 0.35 + 0.4 * k, type: 'lowpass', freq: 300 + 300 * k, q: 0.7, vol: 0.12 + 0.14 * k, rate: 0.6 }); sound.burst(t + 0.02, { dur: 0.2, type: 'bandpass', freq: 1500, q: 0.8, vol: 0.05 * k }); },
    charge() { if (on()) sound.sweep(now(), 180, 1500, 0.4, 0.05, 'triangle'); },
    lock() { if (!on()) return; const t = now(); sound.pluck(1318, t, 0.05, 'sine', sound.fx); sound.pluck(1760, t + 0.07, 0.05, 'sine', sound.fx); },
    deflect() { if (on()) sound.pluck(2093, now(), 0.06, 'triangle', sound.fx); },
    clank() { if (!on()) return; sound.pluck(330, now(), 0.06, 'square', sound.fx); sound.burst(now(), { dur: 0.08, type: 'highpass', freq: 2500, q: 1, vol: 0.05 }); },
    comms() { if (!on()) return; const t = now(); sound.pluck(880, t, 0.04, 'sine', sound.fx); sound.pluck(1175, t + 0.08, 0.04, 'sine', sound.fx); },
    /** A pip of hull lost (issue #206): a crunch and a low thud under the runner's hurt, so it is heard over the bolts. */
    hull() { if (!on()) return; const t = now(); sound.burst(t, { dur: 0.28, type: 'bandpass', freq: 900, q: 0.6, vol: 0.16, rate: 0.8 }); sound.sweep(t, 160, 48, 0.32, 0.12, 'triangle'); sound.pluck(196, t + 0.05, 0.08, 'square', sound.fx); },
    /** A bolt that tells (the reticle's hit mark): a dry tick. */
    hit() { if (on()) sound.pluck(1568, now(), 0.025, 'triangle', sound.fx); },
    /** A missile loosed (issue #224): a hiss down and a rising whine as its motor lights. */
    missile() { if (!on()) return; const t = now(); sound.burst(t, { dur: 0.35, type: 'highpass', freq: 1800, q: 0.6, vol: 0.07, rate: 1.2 }); sound.sweep(t + 0.05, 260, 900, 0.45, 0.03, 'sawtooth'); },
    /** None left: a dry click. */
    dry() { if (on()) sound.pluck(220, now(), 0.04, 'square', sound.fx); },
    /** The tally: a chime as the points become chimes. */
    tally(k = 0) { if (on()) sound.pluck(1047 * Math.pow(1.122, k % 6), now(), 0.06, 'sine', sound.fx); },
  };
}

// ------------------------------------------------------------------ the HUD: the aim, the lock, the captain's bar, the comms
const HUD_CSS = `
#minigame canvas.pirates-hud { position: absolute; inset: 0; width: 100%; height: 100%; }
#minigame .pirates-comms { position: absolute; left: 18px; bottom: 22px; max-width: min(420px, 70vw); padding: 7px 12px 8px; background: #2b211f; color: #f7ecd2; border: 2px solid #2b211f;
  box-shadow: 4px 4px 0 rgba(0,0,0,.35); font: calc(var(--type-s) * 1.05)/1.35 var(--face); transform: none; transition: opacity .3s, transform .3s; }
#minigame .pirates-comms b { display: block; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #9ff2e6; }
#minigame .pirates-comms.captain b { color: #ef9479; }
#minigame .pirates-comms.off { opacity: 0; transform: translateY(8px); }
body.touch #minigame .pirates-comms { bottom: auto; top: 64px; }
#minigame .mg-lives i.lost { animation: pirates-lost .8s ease-out; }
@keyframes pirates-lost { 0% { transform: scale(1.9); background: #fff1c8; opacity: 1; } 35% { transform: scale(1.5); background: #d9643a; opacity: 1; } 100% { transform: scale(1); } }
#minigame .pirates-tally { margin: 6px auto 4px; display: grid; grid-template-columns: auto auto auto; gap: 4px 14px; align-items: baseline; justify-content: center; font: 700 1.1em/1.2 var(--face); font-variant-numeric: tabular-nums; }
#minigame .pirates-tally b { font-size: 1.6em; }
#minigame .pirates-tally .ch { color: #3f8f88; }
#minigame .pirates-tally i { font-style: normal; opacity: .6; }
#minigame .pirates-tally small { grid-column: 1 / -1; font-weight: 400; opacity: .7; }
#minigame .mg-hints .pirates-missiles i { display: inline-block; width: 7px; height: 14px; margin-left: 3px; border: 2px solid #2b211f; border-radius: 4px 4px 1px 1px; background: #ef9479; vertical-align: -2px; }
#minigame .mg-hints .pirates-missiles i.gone { background: transparent; opacity: .45; }
`;

function makeHud(root) {
  const style = document.createElement('style');
  style.textContent = HUD_CSS;
  document.head.appendChild(style);
  const cv = document.createElement('canvas');
  cv.className = 'pirates-hud';
  const comms = document.createElement('div');
  comms.className = 'pirates-comms off';
  root.prepend(cv);
  root.appendChild(comms);
  let hideT = 0;
  return {
    cv, comms,
    say(line) {
      comms.className = `pirates-comms ${line.who === 'captain' ? 'captain' : ''}`;
      comms.innerHTML = `<b>${SPEAKERS[line.who] ?? line.who}</b>${stripTone(line).replace(/[<>&]/g, '')}`;
      hideT = Math.min(6, 1.6 + stripTone(line).length * 0.055);
    },
    update(dt) { if (hideT > 0 && (hideT -= dt) <= 0) comms.classList.add('off'); },
    dispose() { cv.remove(); comms.remove(); style.remove(); },
  };
}

// ------------------------------------------------------------------ the game
const _p = V(), _p2 = V(), _d = V(), _look = V(), _up = V(), _e = new THREE.Euler(), _qa = new THREE.Quaternion(), _proj = V();

function start(ctx) {
  const { camera, level, player, sfx } = ctx;
  const L = level.pirates, snd = shooterSounds(ctx.sound);
  const flags = ctx.state?.data?.flags ?? {};
  const heat = Math.max(0, ambushCount(flags) - (L.to ? 1 : 0));   // (the ambushes before this one: this one is marked as its page opens)
  // a lost run starts again from its last checkpoint, the chimes won up to it kept, the pirates a little kinder each time
  // (L lives as long as the page: the arena is built once; a Retry after a win, or a new page, starts from the start)
  const again = L.resume ?? null;
  L.resume = null;
  const S = newRun({ seed: L.seed, heat, gentle: ctx.settings?.enemies === 'gentle', from: again?.from ?? 0, fails: again?.fails ?? 0, score: again?.score ?? 0 });
  // (the stick's pitch: the game's own jets setting until the pirates are beaten, then the card's choice, issue #230)
  const climb = piratePitch(ctx) === 'climb';
  pitchShown = climb ? 'climb' : 'dive';
  const transit = !!L.to;   // (on the way to a world: the chimes are won; the Arcade's game only scores)
  const root = typeof document !== 'undefined' ? document.getElementById('minigame') ?? document.body : null;   // (none in the tests)
  const hud = typeof document !== 'undefined' ? makeHud(root) : null;
  const words = new WorldLabels(camera);
  const fire = new Puffs(ctx.scene, { count: 140, glow: 0.85, tag: 'pirates-fire', detail: 1 });
  const smoke = new Puffs(ctx.scene, { count: 70, glow: 0.05, tag: 'pirates-smoke', detail: 1 });
  fire.drag = 0.25; smoke.drag = 0.35;
  level.noShadow?.push(fire.mesh, smoke.mesh);
  const sparks = [];
  const dust = Array.from({ length: 110 }, (_, i) => ({ s: Math.random() * 260, u: (Math.random() * 2 - 1) * 46, v: (Math.random() * 2 - 1) * 28, teal: i % 3 === 0 }));
  // (redT: the hit's flash at the screen's edge; shake: the camera's; pipT: the hull's pips shown under the ship, lostI
  // the pip that went; aimK: the reticle's tightening on a target, hitT its hit mark)
  const run = { said: new Set(), lastHull: S.ship.hull, sinkT: 0, outT: 0, lowSaid: false, blinkT: 0, bossShown: false, redT: 0, shake: 0, pipT: 0, lostI: -1, lostT: 0, aimK: 0, hitT: 0, hitBig: false, hurtN: 0 };
  // reset what the last run left
  L.boss.group.visible = false;
  for (const p of Object.values(L.boss.guns)) p.pod.visible = true;
  L.boss.lens.visible = true;
  L.ship.visible = true;
  ctx.setLives(S.ship.hull, S.ship.hull0);
  ctx.setScore(S.score);
  ctx.setFov(CAM.fov);
  player.object.visible = false;

  const world = (ds, u, v, out = _p) => railPoint(S.s + ds, u, v, out);
  const say = (id) => { const line = AMBUSH_LINES[id]; if (!line || !hud) return; hud.say(line); snd.comms(); };

  function boom(at, k = 1, rel = true) {
    const p = rel ? world(at.ds, at.u, at.v, V()) : at;
    const n = Math.round(5 + 7 * k);
    for (let i = 0; i < n; i++) {
      _d.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(4 + 8 * k * Math.random());
      _d.z -= FLY.speed * 0.7;   // (carried along with the flight a while)
      fire.emit(p, _d, (0.9 + Math.random() * 1.4) * k, 0.5 + Math.random() * 0.5, ['#fff1c8', '#f2c54b', '#ef9479', '#ffd27a'][i % 4]);
    }
    for (let i = 0; i < Math.round(2 + 3 * k); i++) {
      _d.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(5 * k);
      _d.z -= FLY.speed * 0.6;
      smoke.emit(p, _d, (1.2 + Math.random()) * k, 0.9 + Math.random() * 0.6, ['#5e4a72', '#3a3340', '#8a7a9a'][i % 3]);
    }
    spark(p, Math.round(6 * k), '#fff1c8');
    snd.boom(Math.min(1.5, k));
  }
  function spark(p, n, color) {
    for (let i = 0; i < n; i++) {
      const vel = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 18);
      vel.z -= FLY.speed * 0.8;
      sparks.push({ pos: p.clone(), vel, life: 0.35 + Math.random() * 0.3, age: 0, color });
    }
    if (sparks.length > 120) sparks.splice(0, sparks.length - 120);
  }

  function handle(ev) {
    for (const e of ev) {
      switch (e.kind) {
        case 'shot': snd.shot(); break;
        case 'enemyShot': snd.enemy(); break;
        case 'kill': boom(e.at, e.foe === 'hauler' ? 1.6 : e.foe === 'raider' ? 1.2 : e.foe === 'mine' ? 0.6 : 0.8); if (e.pts) words.pop(world(e.at.ds, e.at.u, e.at.v, V()), `+${e.pts}`, e.foe === 'hauler' ? 'gold' : ''); if (e.by !== 'ram') hitMark(true); break;
        case 'hit': if (e.by === 'bolt') hitMark(false); break;
        case 'checkpoint': ctx.flash('Checkpoint', 'good', 1.2); break;
        case 'rock': boom(e.at, 0.5); words.pop(world(e.at.ds, e.at.u, e.at.v, V()), `+${e.pts}`); break;
        case 'spark': spark(world(e.at.ds, e.at.u, e.at.v, V()), 2, '#e0c3a0'); break;
        case 'clank': spark(world(e.at.ds, e.at.u, e.at.v, V()), 4, '#c99d48'); snd.clank(); break;
        case 'deflect': spark(world(e.at.ds, e.at.u, e.at.v, V()), 5, '#9ff2e6'); snd.deflect(); break;
        case 'blast': boom(e.at, 1.4); if (e.bonus) { ctx.flash(`${e.n} at once! +${e.bonus}`, 'good'); } break;
        case 'hurt': {
          // (issue #206: "when I lose a health point it's not very visible": the edge flashes, the view shakes, the ship
          // sparks and blinks, the pips show under it with the lost one bursting, the corner's pip pops; a crunch)
          sfx.hurt(); snd.hull(); ctx.kick(0.8);
          // (no shake and no flare under Reduce motion or with Camera shake at 0, issue #230: the pips still tell)
          if (shakeScale() > 0) { run.redT = HURT.flash; run.shake = HURT.shake; }
          run.pipT = HURT.pips; run.lostI = e.hull; run.lostT = HURT.lost;
          run.hurtN++;
          const at = world(0, S.ship.u, S.ship.v, V());
          spark(at, 10, '#ff8a5c'); spark(at, 6, '#fff1c8');
          smoke.emit(at, V(0, 2, -FLY.speed * 0.5), 1.4, 1.0, '#3a3340');
          popPip(e.hull);
          if (e.hull <= 2 && e.hull > 0 && !run.lowSaid) { run.lowSaid = true; say('low'); }
          break;
        }
        case 'repair': sfx.checkpoint(); run.pipT = HURT.pips; run.lostI = -1; ctx.flash(e.pts ? `Hull full · +${e.pts}` : 'Hull patched', 'good'); break;
        case 'part': boom(e.at, 2.2); hitMark(true); ctx.flash(e.id === 'core' ? 'The bridge is hit!' : 'A turret is down!', 'good'); words.pop(world(e.at.ds, e.at.u, e.at.v, V()), `+${e.pts}`, 'gold'); if (L.boss.guns[e.id]) L.boss.guns[e.id].pod.visible = false; if (e.id === 'core') L.boss.lens.visible = false; break;
        case 'sunk': run.sinkT = 1.6; break;
        case 'roll': sfx.whoosh(); break;
        case 'lock': snd.lock(); break;
        case 'charged': snd.charge(); break;
        // the missiles (issue #224): loosed with a hiss and a flare under the ship, burst where they hit, a click when none is left
        case 'missile': {
          snd.missile(); ctx.kick(0.25);
          const at = world(1.5, S.ship.u, S.ship.v - 0.6, V());
          spark(at, 6, '#ffd27a'); smoke.emit(at, V(0, -3, -FLY.speed * 0.4), 1.1, 0.8, '#8a7a9a');
          if (!e.locked) ctx.flash('Missile: no lock', '', 0.8);
          break;
        }
        case 'missileHit': boom(e.at, e.n ? 1.5 : 0.9); if (e.n) hitMark(true); break;
        case 'dry': snd.dry(); ctx.flash('No missiles left', 'bad', 0.9); break;
        case 'rearm': ctx.flash('Missile +1', 'good', 1.1); break;
        case 'say': say(e.id); break;
        case 'win': {
          say(e.sunk ? 'won' : 'fled');
          ctx.setScore(S.score);
          ctx.state?.set?.(BEATEN, true);   // (from now on the start card offers the stick's pitch)
          // on the way to a world the points become chimes, tallied on the results (CHIME_RATE points a chime)
          ctx.finish({ score: S.score, title: e.sunk ? 'Pirates beaten!' : 'They broke off!', lines: resultLines(e), chimes: transit ? e.chimes : 0, html: transit ? tallyHtml(S.score) : null });
          break;
        }
        case 'dead': {
          say('lost'); boom({ ds: 0, u: S.ship.u, v: S.ship.v }, 1.8);
          ctx.setScore(S.score);
          // Retry picks up from the last checkpoint passed, the chimes won before it kept (no skip: the fight is the way there)
          L.resume = { from: S.checkpoint, fails: (again?.fails ?? 0) + 1, score: S.scoreAt };   // (the points won before it kept)
          const cp = CHECKPOINTS.indexOf(S.checkpoint);
          ctx.finish({ score: S.score, failed: true, title: 'Hull breached', lines: [`Pirates downed: ${S.kills}`, cp > 0 ? `Retry from checkpoint ${cp}, the hull patched` : 'Retry from the start, the hull patched'] });
          break;
        }
      }
    }
  }
  function resultLines(e) {
    return [
      `Pirates downed: ${S.kills}`,
      `Hits taken: ${S.hits} · hull left ${e.hull} of ${S.ship.hull0} (+${e.hull * 50})`,
      e.sunk ? 'The captain’s gunship: downed' : 'The captain’s gunship: got away',
    ];
  }
  /** The reticle's hit mark: a bolt told (a kill: bigger, gold). */
  function hitMark(big) { run.hitBig = big || (run.hitBig && run.hitT > 0); run.hitT = HIT_MARK; if (!big) snd.hit(); }
  /** The corner's pip that went pops (the runner draws them: .mg-lives). */
  function popPip(i) {
    ctx.setLives(S.ship.hull, S.ship.hull0); run.lastHull = S.ship.hull;
    const pip = root?.querySelector?.(`.mg-lives i:nth-child(${i + 1})`);
    if (pip) { pip.classList.remove('lost'); void pip.offsetWidth; pip.classList.add('lost'); }
  }

  // ---------------------------------------------------------------- drawing
  function drawShip(dt, phase) {
    const P = S.ship;
    world(0, P.u, P.v, L.ship.position);
    if (S.done === 'won' && (phase === 'finishing' || phase === 'results')) {
      // away ahead, faster and faster, as the course resumes
      run.outT += dt;
      L.ship.position.z -= 30 * run.outT * run.outT;
    }
    // the roll: one whole turn, quick at the start and settling (an ease out), so it reads as a snap
    const rk = P.roll > 0 ? 1 - P.roll / FLY.roll.dur : 0, roll = P.roll > 0 ? P.rollDir * -Math.PI * 2 * (1 - Math.pow(1 - rk, 2.2)) : 0;
    // the nose where the bolts go (the rules' aim, drawn twice over so it reads), and the hard bank
    _e.set(Math.atan(P.aimV) * 2.2 + (S.done === 'dead' ? -0.4 : 0), -Math.atan(P.aimU) * 2.2, P.bank + roll + (S.done === 'dead' ? run.outT * 3 : 0), 'YXZ');
    L.ship.quaternion.setFromEuler(_e);
    // (blinks while it cannot be hit again)
    L.ship.visible = !(P.iframe > 0 && Math.floor(P.iframe * (P.iframe > FLY.iframe - 0.35 ? 22 : 12)) % 2 === 0);   // (quicker at first: the hit)
    L.flames.scale.set(1, 1, 0.8 + 0.4 * Math.random() + (run.outT > 0 ? 2 : 0));
    if (S.done === 'dead') { run.outT += dt; if (Math.random() < 0.5) smoke.emit(L.ship.position, V(0, 1, -FLY.speed * 0.3), 1, 1, '#3a3340'); }
  }

  function drawCamera(dt, snap = false) {
    const P = S.ship, F = CAM;
    // part of the ship's offset, a little late: the ship moves about the screen and the view swings after it
    const cu = P.u * F.follow, cv = P.v * F.follow;
    if (!run.cam) run.cam = { u: cu, v: cv, roll: 0, lu: 0, lv: 0 };
    const k = snap ? 1 : 1 - Math.exp(-F.rate * dt);
    run.cam.u += (cu - run.cam.u) * k; run.cam.v += (cv - run.cam.v) * k;
    run.cam.roll += (P.bank * F.roll - run.cam.roll) * k;
    // it looks a little ahead of where the ship is going (its sideways speed, led)
    const kl = snap ? 1 : 1 - Math.exp(-F.rate * 1.5 * dt);
    run.cam.lu += (P.vu * F.lead - run.cam.lu) * kl; run.cam.lv += (P.vv * F.lead - run.cam.lv) * kl;
    railPoint(S.s - F.back, run.cam.u, run.cam.v + F.up, camera.position);
    if (run.shake > 0) { const k = run.shake * run.shake * HURT.amp * shakeScale(); camera.position.x += (Math.random() * 2 - 1) * k; camera.position.y += (Math.random() * 2 - 1) * k; }
    railPoint(S.s + F.look, run.cam.u + (P.u - run.cam.u) * 0.6 + run.cam.lu, run.cam.v + (P.v - run.cam.v) * 0.6 + 0.4 + run.cam.lv, _look);
    _d.subVectors(_look, camera.position).normalize();
    camera.up.set(0, 1, 0).applyAxisAngle(_d, run.cam.roll);
    camera.lookAt(_look);
    camera.updateMatrixWorld();
  }

  /** The way a thing faces: toward the ship ('ship'), along the flight ('away') or across ('side'). */
  function facing(e, pos) {
    if (e.face === 'away') _d.set(railX(S.s + e.ds + 1) - railX(S.s + e.ds), railY(S.s + e.ds + 1) - railY(S.s + e.ds), -1);
    else if (e.face === 'side') _d.set(-Math.sign(e.side || 1), 0, 0.15);
    else _d.subVectors(L.ship.position, pos);
    _d.normalize();
    return _qa.setFromUnitVectors(_fwd, _d);
  }

  function drawFoes() {
    for (const k of Object.values(L.kinds)) k.begin();
    for (const e of S.foes) {
      if (e.dead || e.hidden) continue;
      const pos = world(e.ds, e.u, e.v, _p);
      const q = facing(e, pos);
      if (e.kind === 'mine') { _q.setFromAxisAngle(_spin, e.age * 1.4); q.multiply(_q); }
      else { _q.setFromAxisAngle(_fwd, Math.sin(e.age * 2 + e.id) * 0.25); q.multiply(_q); }
      const blink = e.kind === 'mine' ? 0.4 + 0.6 * (Math.sin(e.age * 9) > 0 ? 1 : 0) : 1;
      L.kinds[e.kind].put(pos, q, LOOK_SIZE[e.kind] ?? 1, e.flash > 0 ? 0.8 : 0, null, blink);
    }
    for (const k of Object.values(L.kinds)) k.end();
  }

  function drawRocks(dt) {
    for (const r of L.rocks) r.begin();
    for (let i = Math.max(0, S.rockI - 4); i < S.rocks.length; i++) {
      const r = S.rocks[i], ds = r.s - S.s;
      if (ds > 900) break;
      if (r.gone || ds < -20) continue;
      railPoint(r.s, r.u, r.v, _p);
      _e.set(r.spin * S.t, r.spin * 0.7 * S.t + i, 0);
      L.rocks[r.kind].put(_p, _q.setFromEuler(_e), r.r, 0, _c2.set(ROCK_TONES[r.tone]));
    }
    for (const r of L.rocks) r.end();
  }

  function drawDrops(dt) {
    const D = L.drops;
    D.begin();
    const fw = _d2.set(0, 0, -1);
    for (const b of S.bolts) {
      world(b.ds, b.u, b.v, _p);
      _p2.set(b.vu, b.vv, -b.vds).normalize();
      if (b.charged) D.put(_p, _p2, 0.75 + 0.15 * Math.sin(S.t * 30), 1.4, '#f2c54b');
      else D.put(_p, _p2, 0.13, 2.2, '#c8fff4');
    }
    for (const b of S.shots) { world(b.ds, b.u, b.v, _p); _p2.set(b.vu, b.vv, -b.vds).normalize(); D.put(_p, _p2, b.big ? 0.75 : 0.5, b.big ? 0.9 : 1.1, b.big ? '#ff5a3c' : '#ff8a5c'); }
    // the missiles: a pale body with a coral head, a flame at its tail and a trail of smoke behind (issue #224)
    for (const m of S.missiles) {
      world(m.ds, m.u, m.v, _p);
      _p2.set(m.vu, m.vv, -m.vds).normalize();
      D.put(_p, _p2, 0.3, 2.6, '#efe6d2');
      _p3.copy(_p).addScaledVector(_p2, 0.9); D.put(_p3, _p2, 0.34, 0.8, '#ef9479');
      _p3.copy(_p).addScaledVector(_p2, -1.1); D.put(_p3, _p2, 0.26 + 0.12 * Math.random(), 1.2, '#ffd27a');
      if ((m.trailT = (m.trailT ?? 0) - dt) <= 0) { m.trailT = 0.03; smoke.emit(_p3, _d.set(0, 0, -FLY.speed * 0.6), 0.55, 0.7, '#cfc6d8'); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt; if (s.age >= s.life) { sparks.splice(i, 1); continue; }
      s.pos.addScaledVector(s.vel, dt);
      _p2.copy(s.vel).normalize();
      D.put(s.pos, _p2, 0.09 * (1 - s.age / s.life) + 0.03, 0.8, s.color);
    }
    // the dust that streams past: the speed made visible
    for (const m of dust) {
      const ds = (((m.s - S.s) % 260) + 260) % 260 - 30;
      world(ds, m.u, m.v, _p);
      D.put(_p, fw, 0.05, 1.6 + (run.outT > 0 ? 6 : 0), m.teal ? '#9ff2e6' : '#fff1c8');
    }
    D.end();
  }

  function drawRings() {
    let i = 0;
    for (const g of S.rings) {
      if (g.taken || i >= L.rings.length) continue;
      const m = L.rings[i++];
      railPoint(g.s, g.u, g.v, m.position);
      m.rotation.z = S.t * 1.5;
      m.visible = true;
    }
    for (; i < L.rings.length; i++) L.rings[i].visible = false;
  }

  function drawBoss(dt) {
    const B = S.boss, G = L.boss;
    G.group.visible = !!B && !(B.dying > 1.6);
    if (!B) return;
    world(B.ds + GUNSHIP_BACK, B.u, B.v, G.group.position);
    _d.subVectors(L.ship.position, G.group.position).setY(0).normalize();
    G.group.quaternion.setFromUnitVectors(_zAxis, _d.lengthSq() > 0 ? _d : _zAxis);
    // (its nose tipped down a little toward the ship, raised so its turrets stay where they are hit)
    G.group.rotateX(GUNSHIP_TILT); G.group.position.y += GUNSHIP_BACK * Math.sin(GUNSHIP_TILT);
    if (B.dying) { G.group.rotateZ(B.dying * 0.25); G.group.rotateX(B.dying * 0.1); }
    for (const p of B.parts) {
      const g = p.id === 'core' ? G.core : G.guns[p.id];
      g.mat.uniforms.uColor.value.copy(g.base).lerp(_w, p.flash > 0 ? 0.85 : 0);
    }
    // the shutters slide apart once the guns are down
    const open = B.open ? Math.min(1, (run.openK = (run.openK ?? 0) + dt * 1.2)) : 0;
    for (const s of G.shutters) s.position.x = s.userData.side * open * 1.8;
    if (run.sinkT > 0) {
      run.sinkT -= dt;
      if (Math.random() < 0.35) { const p = BOSS.parts[Math.floor(Math.random() * 3)]; const at = partAt(B, p); boom({ ds: at.ds + (Math.random() - 0.5) * 16, u: at.u + (Math.random() - 0.5) * 12, v: at.v + (Math.random() - 0.5) * 8 }, 1.4); }
    }
  }

  function project(p) {
    _proj.copy(p).project(camera);
    return { x: (_proj.x * 0.5 + 0.5), y: (-_proj.y * 0.5 + 0.5), front: _proj.z < 1 };
  }
  function drawHud(phase) {
    if (!hud) return;
    const cv = hud.cv, W = Math.round(innerWidth / 2), H = Math.round(innerHeight / 2);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (phase !== 'play') return;
    const P = S.ship;
    g.lineJoin = 'round';
    // the aim (issue #206: "the two boxes are confusing"): one line of fire, a ring near and a diamond far down it,
    // where the bolts will be (aimAt: they swing ahead as it turns). On a target (aimTarget) the ring tightens and
    // goes coral, its ticks closing in; a bolt that tells strikes a mark across it; the charge fills an arc round it.
    const ring = project(world(RETICLE.near, aimAt(P, RETICLE.near).u, aimAt(P, RETICLE.near).v, _p));
    const dot = project(world(RETICLE.far, aimAt(P, RETICLE.far).u, aimAt(P, RETICLE.far).v, _p));
    const on = run.aimK, hot = P.charge >= 1 ? '#f2c54b' : mix('#f7ecd2', '#ef9479', on);
    const inked = (draw, lw) => { g.strokeStyle = INK; g.lineWidth = lw + 2.2; draw(); g.strokeStyle = hot; g.lineWidth = lw; draw(); };
    if (dot.front) {
      const x = dot.x * W, y = dot.y * H, d = 3.6 - on;
      inked(() => { g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath(); g.stroke(); }, 1.5);
    }
    if (ring.front) {
      const x = ring.x * W, y = ring.y * H, R = RETICLE.r - (RETICLE.r - RETICLE.tight) * on;
      // the ring, broken at its four points, with ticks in toward the middle (longer on a target)
      inked(() => {
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x, y, R, k * Math.PI / 2 + 0.32, (k + 1) * Math.PI / 2 - 0.32); g.stroke(); }
        const t1 = R - 3.5 - 3 * on;
        g.beginPath();
        for (const [cx, cy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { g.moveTo(x + cx * (R + 1.5), y + cy * (R + 1.5)); g.lineTo(x + cx * t1, y + cy * t1); }
        g.stroke();
      }, 1.6);
      if (P.charge > 0) {
        g.beginPath(); g.arc(x, y, R + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * P.charge);
        g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
        g.strokeStyle = '#f2c54b'; g.lineWidth = 2.5; g.stroke();
      }
      if (run.hitT > 0) {
        const k = run.hitT / HIT_MARK, a = R + 2.5 + (1 - k) * 2, b = a + (run.hitBig ? 7 : 4.5);
        g.globalAlpha = Math.min(1, k * 1.6);
        for (const [lw, c] of [[3.6, INK], [1.6, run.hitBig ? '#f2c54b' : '#fff1c8']]) {
          g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
          for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { g.moveTo(x + sx * a * 0.707, y + sy * a * 0.707); g.lineTo(x + sx * b * 0.707, y + sy * b * 0.707); }
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    }
    // the lock: corner brackets round the target, coral, a word under them
    if (P.lock) {
      const at = P.lock.part ? (S.boss ? partAt(S.boss, P.lock.part) : null) : P.lock.foe;
      if (at) {
        const p = project(world(at.ds, at.u, at.v, _p));
        if (p.front) {
          const x = p.x * W, y = p.y * H, r = Math.max(10, 900 / Math.max(10, at.ds + CAM.back)) * (at.r ?? 2.5) / 2;
          const b = (sx, sy) => { g.beginPath(); g.moveTo(x + sx * r, y + sy * (r - 6)); g.lineTo(x + sx * r, y + sy * r); g.lineTo(x + sx * (r - 6), y + sy * r); g.stroke(); };
          for (const [lw, c] of [[5, INK], [2.4, '#ef9479']]) { g.lineWidth = lw; g.strokeStyle = c; b(-1, -1); b(1, -1); b(-1, 1); b(1, 1); }
          g.font = `700 10px ${FACE}`; g.textAlign = 'center';
          g.lineWidth = 3; g.strokeStyle = INK; g.strokeText('LOCK', x, y + r + 12); g.fillStyle = '#ef9479'; g.fillText('LOCK', x, y + r + 12);
        }
      }
    }
    // the missile's mark (issue #224): what a missile would lock now, a teal diamond round it, only while there is
    // one to loose (and not where the charge's LOCK already is)
    if (P.aim && P.missiles > 0 && !(P.lock && P.aim.foe === P.lock.foe && P.aim.part === P.lock.part)) {
      const at = P.aim.part ? (S.boss ? partAt(S.boss, P.aim.part) : null) : P.aim.foe;
      if (at) {
        const p = project(world(at.ds, at.u, at.v, _p));
        if (p.front) {
          const x = p.x * W, y = p.y * H, r = Math.max(9, 900 / Math.max(10, at.ds + CAM.back)) * (at.r ?? 2.5) / 2 + 4;
          for (const [lw, c] of [[4.5, INK], [2, '#9ff2e6']]) { g.lineWidth = lw; g.strokeStyle = c; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.stroke(); }
        }
      }
    }
    // the captain's bar: the two guns and the bridge
    const B = S.boss;
    if (B && B.age > 1 && !B.dying && !B.fled) {
      const w = Math.min(260, W * 0.6), x0 = (W - w) / 2, y0 = 44;
      g.font = `700 10px ${FACE}`; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = INK; g.strokeText('THE CAPTAIN’S GUNSHIP', W / 2, y0 - 4); g.fillStyle = '#f7ecd2'; g.fillText('THE CAPTAIN’S GUNSHIP', W / 2, y0 - 4);
      const order = ['gunL', 'core', 'gunR'], seg = (w - 8) / 3;
      order.forEach((id, i) => {
        const p = B.parts.find((q) => q.id === id), x = x0 + i * (seg + 4);
        g.fillStyle = INK; g.fillRect(x - 1.5, y0 - 1.5, seg + 3, 10);
        g.fillStyle = p.armoured && !B.open ? '#6b5a4e' : id === 'core' ? '#9ff2e6' : '#c99d48';
        g.fillRect(x, y0, seg * Math.max(0, p.hp) / p.hp0, 7);
      });
    }
    // the hull's pips under the ship a while after a hit or a patch (and always, faintly, when two or fewer are left):
    // where the eye is, the lost one bursting out of its place
    const low = P.hull <= 2;
    if (run.pipT > 0 || low) {
      const sp = project(world(0, P.u, P.v, _p));
      if (sp.front) {
        const n = P.hull0, gap = 11, x0 = sp.x * W - (n - 1) * gap / 2, y = sp.y * H + 24;
        g.globalAlpha = Math.max(low ? 0.6 : 0, Math.min(1, run.pipT / 0.4));
        for (let i = 0; i < n; i++) {
          const x = x0 + i * gap, full = i < P.hull;
          g.beginPath(); g.arc(x, y, 3.8, 0, Math.PI * 2);
          if (full) { g.fillStyle = low ? '#ff5a3c' : '#d9643a'; g.fill(); }
          g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
          if (i === run.lostI && run.lostT > 0) {
            const k = 1 - run.lostT / HURT.lost;
            g.save(); g.globalAlpha = 1 - k;
            g.beginPath(); g.arc(x, y, 3.8 * (1 - k * 0.6), 0, Math.PI * 2); g.fillStyle = '#fff1c8'; g.fill();
            g.beginPath(); g.arc(x, y, 4 + 11 * k, 0, Math.PI * 2); g.strokeStyle = '#ff5a3c'; g.lineWidth = 2.4 * (1 - k) + 0.6; g.stroke();
            g.restore();
          }
        }
        g.globalAlpha = 1;
      }
    }
    // hit: the screen's edges flare coral and red a moment, an ink band round them (and the view shakes: drawCamera)
    if (run.redT > 0) {
      const k = Math.pow(run.redT / HURT.flash, 0.7), m = Math.max(W, H);
      const v = g.createRadialGradient(W / 2, H / 2, m * 0.32, W / 2, H / 2, m * 0.72);
      v.addColorStop(0, 'rgba(217, 70, 40, 0)'); v.addColorStop(1, `rgba(217, 70, 40, ${0.78 * k})`);
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      g.strokeStyle = `rgba(43, 33, 31, ${0.85 * k})`; g.lineWidth = 9; g.strokeRect(0, 0, W, H);
      g.strokeStyle = `rgba(255, 90, 60, ${k})`; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12);
    }
  }
  /** Two colours mixed (k 0..1), as a CSS colour. */
  function mix(a, b, k) { return '#' + _c.set(a).lerp(_c2.set(b), Math.max(0, Math.min(1, k))).getHexString(); }

  const tick = (dt, phase) => {
    drawShip(dt, phase);
    drawCamera(dt);
    drawFoes(); drawRocks(dt); drawRings(); drawBoss(dt); drawDrops(dt);
    fire.update(dt); smoke.update(dt);
    words.update(dt);
    hud?.update(dt);
    run.redT = Math.max(0, run.redT - dt); run.shake = Math.max(0, run.shake - dt);
    run.pipT = Math.max(0, run.pipT - dt); run.lostT = Math.max(0, run.lostT - dt); run.hitT = Math.max(0, run.hitT - dt);
    run.onTarget = phase === 'play' && !!aimTarget(S);   // (the reticle tightens on what the line of fire runs through)
    // the missiles left, under the hints at the bottom right (issue #224)
    const mk = `${S.ship.missiles}/${FLY.missile.count}`;
    if (mk !== run.missileNote) { run.missileNote = mk; ctx.hintNote?.(`<span class="pirates-missiles">MISSILES${Array.from({ length: FLY.missile.count }, (_, i) => `<i class="${i < S.ship.missiles ? '' : 'gone'}"></i>`).join('')}</span>`); }
    run.aimK += ((run.onTarget ? 1 : 0) - run.aimK) * Math.min(1, dt * 14);
    drawHud(phase);
    if (phase === 'results') tally(dt);
  };
  drawShip(0, 'intro'); drawCamera(0, true); drawRocks(0); drawDrops(0);

  /** The results' tally (on the way to a world): the points' chimes counted up, a chime heard for each tenth. */
  function tally(dt) {
    const el = root?.querySelector?.('.pirates-tally');
    if (!el) return;
    const T = (run.tally ??= { t: -0.35, last: 0 }), pts = +el.dataset.points, ch = chimesFor(pts);
    T.t += dt;
    const k = Math.max(0, Math.min(1, T.t / TALLY.secs)), e = 1 - Math.pow(1 - k, 2);
    const shown = Math.round(ch * e);
    el.querySelector('.chn').textContent = String(shown);
    const step = Math.floor(e * 10);
    if (step > T.last) { T.last = step; snd.tally(step); }
  }

  return {
    /** (for the tests and the screenshots: the run's state) */
    get state() { return S; },
    /** (the tests: what is being shown: the hit's flash, the shake, the pips, the reticle's tightening and mark) */
    get feedback() { return run; },
    /** (the screenshots: the run flown ahead by the pilot to `t` s, quietly) */
    forward(t) {
      while (!S.done && S.t < t) handle(runStep(S, botInput(S), 1 / 60).filter((e) => ['win', 'dead', 'part', 'sunk'].includes(e.kind)));
      ctx.setLives(S.ship.hull, S.ship.hull0);
    },
    update(dt, inp, { live, phase, raw }) {
      dt = Math.min(dt, 0.05);
      if (live) {
        if (!run.goSaid) { run.goSaid = true; if (S.from > 0) ctx.flash('From the checkpoint', 'good', 1.6); }
        const input = globalThis.__piratesBot ? botInput(S) : pirateInput(inp, raw, { climb });
        handle(runStep(S, input, dt));
        if (S.ship.hull !== run.lastHull) { run.lastHull = S.ship.hull; ctx.setLives(S.ship.hull, S.ship.hull0); }
        ctx.setScore(S.score);
        ctx.speed(S.ship.roll > 0 ? 0.5 : 0.12);
      } else if (phase === 'intro' || phase === 'count') {
        // cruising before GO: the dust streams by, nothing else moves on
        for (const m of dust) m.s -= FLY.speed * dt;
      } else if (phase === 'finishing' || phase === 'results') {
        S.s += FLY.speed * dt;
        for (const b of S.shots) b.life = 0;
        S.shots.length = 0;
        ctx.speed(run.outT > 0 ? Math.min(1, run.outT) : 0);
      }
      tick(dt, phase);
    },
    end() {
      hud?.dispose();
      words.dispose();
      fire.dispose(); smoke.dispose();
      for (const m of [fire.mesh, smoke.mesh]) { const i = level.noShadow?.indexOf(m) ?? -1; if (i >= 0) level.noShadow.splice(i, 1); }
      for (const k of [...Object.values(L.kinds), ...L.rocks]) { k.begin(); k.end(); }
      L.drops.begin(); L.drops.end();
      for (const r of L.rings) r.visible = false;
      L.boss.group.visible = false;
      player.object.visible = true;
      ctx.speed(0);
    },
  };
}
/** The pirates drawn larger than their shapes were made (their hit sizes in the rules match). */
export const LOOK_SIZE = { skiff: 1.7, raider: 1.5, hauler: 1.5, mine: 1.3 };
const _fwd = V(0, 0, -1), _spin = V(0.3, 1, 0.2).normalize(), _d2 = V(), _p3 = V(), _c2 = new THREE.Color();

/** A pip of hull lost (issue #206): the edge's flash (s), the camera's shake (s, and its size at the start, m), the pips shown under the ship (s), the lost one's burst (s). */
export const HURT = { flash: 0.7, shake: 0.45, amp: 2.4, pips: 2.2, lost: 0.8 };
/** The reticle's hit mark (s). */
export const HIT_MARK = 0.16;
/** The reticle: the ring's distance down the line of fire and the diamond's (m), the ring's size and tightened on a target (px at half size). */
export const RETICLE = { near: 26, far: 80, r: 11, tight: 7.5 };
/** The results' tally: how long the points take to count into chimes (s). */
export const TALLY = { secs: 1.6 };
/** The save's flag once the pirates have been beaten anywhere: from then on the start card offers the stick's pitch. */
export const BEATEN = 'minigame.pirates.beaten';
let pitchShown = 'dive';

/**
 * The stick's pitch for this run (issue #230): until the pirates are beaten the card offers no choice, and the game's
 * own jets setting decides (Settings' invertFlight: on, forward climbs); once offered, the card's choice, and until
 * one is made, the jets setting again.
 */
export function piratePitch(ctx) {
  const own = ctx.settings?.invertFlight ? 'climb' : 'dive';
  if (!ctx.state?.flag?.(BEATEN)) return own;
  // (no start card since issue #224: Settings → Game, "Chime pirates: push up to", shown once beaten)
  const set = ctx.settings?.piratePitch;
  if (set === 'climb' || set === 'dive') return set;
  const kept = ctx.state.flag(optionKey('pirates', 'pitch'));   // (chosen on the start card, before v1.64)
  return kept === 'climb' || kept === 'dive' ? kept : own;
}

/** The results' tally block (on the way to a world): the points, the rate, the chimes they make (counted up by tally()). */
export function tallyHtml(score) {
  const n = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `<div class="pirates-tally" data-points="${score}" data-chimes="${chimesFor(score)}"><b class="pts">${n(score)}</b><i>points  →</i><b class="ch"><span class="chn">0</span> chimes</b><small>${CHIME_RATE} points make a chime</small></div>`;
}

/** The controls, as the start card lists them: the stick's pitch said plainly, as it is now (push up to dive by default). */
export function pirateControls(pitch = 'dive') {
  const up = pitch === 'climb' ? 'climb' : 'dive', down = up === 'dive' ? 'climb' : 'dive';
  return {
    pad: [['Left stick', `steer and aim: push up to ${up}, pull back to ${down}`], ['A / ×', 'fire; hold to charge, let go to loose it'], ['RT / R2, held', 'a steady stream of fire'], ['LT / L2', `a missile: it locks the pirate nearest the aim (${FLY.missile.count} a run)`], ['B / ○ or LB / L1', 'barrel roll'], ['Menu', 'pause']],
    keys: [['W A S D  or  arrows', `steer and aim: W or ↑ to ${up}, S or ↓ to ${down}`], ['Space', 'fire; hold to charge, let go to loose it'], ['F', `a missile: it locks the pirate nearest the aim (${FLY.missile.count} a run)`], ['Shift  or  E', 'barrel roll'], ['Esc', 'pause']],
    touch: [['Stick', `steer and aim: push up to ${up}`], ['✺', 'fire; hold to charge, let go to loose it'], ['◇', 'a missile'], ['↶', 'barrel roll']],
  };
}
/** The same, short: the hints at the bottom right while it runs (no start card since issue #224). */
export function pirateHints(pitch = 'dive') {
  const up = pitch === 'climb' ? 'climb' : 'dive';
  return {
    pad: [['Left stick', `steer · up to ${up}`], ['A / ×', 'fire · hold to charge'], ['RT / R2', 'stream fire'], ['LT / L2', 'missile'], ['B / ○', 'roll'], ['Menu', 'pause']],
    keys: [['W A S D', `steer · W to ${up}`], ['Space', 'fire · hold to charge'], ['F', 'missile'], ['Shift', 'roll'], ['Esc', 'pause']],
    touch: [['✺', 'fire'], ['◇', 'missile'], ['↶', 'roll']],
  };
}

export default {
  id: 'pirates', order: 11,
  name: 'Chime pirates',
  blurb: 'Between worlds, pirates come after the family ship. Fly through the dark and fight them off; their wrecks are worth chimes.',
  rules: 'Shoot the pirates down; your shots go where the nose points, so steer to aim. Roll to turn their fire aside; hold fire to charge a shot that locks on and bursts, or loose one of your four missiles at the pirate nearest the aim. Rocks and shots cost hull, teal rings patch it and give a missile back. Beat their captain’s gunship at the end. On the way to a world, your points become chimes.',
  get controls() { return pirateControls(pitchShown); },
  // (no start card, issue #224: the run counts in after the take-off, the controls as small hints at the bottom right;
  // the stick's pitch, push up to dive by default, is chosen in Settings → Game once the pirates have been beaten:
  // issue #206, "don't let me switch controls at first"; piratePitch)
  direct: true,
  get hints() { return pirateHints(pitchShown); },
  touchButtons: ['fire', 'evade', 'guard'], touchShow: ['guard'],   // (the missile on the guard's ◇, guard or not)
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: true, score: true },
  color: '#ef9479',
  build: buildPirates,
  start,
};

/** (the tests: the rocks the arena draws are the rules' own, for a destination) */
export const rocksFor = (to) => courseRocks(seedOf(to ?? 'arcade'));
