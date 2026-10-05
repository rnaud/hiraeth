import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { Batch, shell, polar, sector } from './geo.js';
import { buildHull, doorGeometry, rampGeometry, R, RI, DECK, HATCH, HATCH_A, HINGE_R, WINDOW } from './hull.js';
import { buildInterior, BLOCK_H } from './interior.js';
import { CallScreen } from './portrait.js';

// Assembles one ship (hull + interior + moving parts) in ship-local space.

let SERIAL = 0;
/** The invisible skirting's height (m): over a step, under the camera's line of sight. */
export const SKIRT = BLOCK_H;

export function shipMaterials(tag, { space = false } = {}) {
  const o = {
    hull: { color: '#f1e8d4', grid: 2.6, metal: 'painted' },
    wallIn: { color: '#efe2c4', grid: 1.25 },
    trim: { color: '#d9c7a6', flat: true, metal: 'painted' },
    teal: { color: '#5fb7ad', flat: true, metal: 'painted' },
    dark: { color: '#34405e', flat: true, metal: 'painted' },
    band: { color: '#d9643a', metal: 'painted' },
    seam: { color: '#c9b8a0' },
    glowRed: { color: '#e6503a', glow: 1 },
    glowTeal: { color: '#9fe0d6', glow: 1, tag: `${tag}-glowTeal` },
    thrust: { color: '#ffd27a', glow: 0, tag: `${tag}-thrust` },
    portGlass: { color: space ? '#1d2a52' : '#3d5a78', flat: true, glow: 0.25 },
    portIn: { color: space ? '#26335e' : '#bfe0ec', glow: 1, tag: `${tag}-portIn` },
    scorch: { color: '#9a7458', flat: true },
    soot: { color: '#54433b', flat: true },
    ink: { color: '#2b211f', flat: true },
    floor: { color: '#c9a27a', grid: 0.9, flat: true },
    floorDark: { color: '#7f6250', flat: true, grid: 0.6 },
    ceiling: { color: '#e9dcc0', flat: true, grid: 1.6 },
    wall: { color: '#efe2c4', flat: true, grid: 1.2 },
    core: { color: '#4a6a78', glow: 0.15, tag: `${tag}-core` },
    wood: { color: '#a8754f', flat: true },
    cream: { color: '#f3ead8', flat: true },
    blanket: { color: '#4f8fa8', flat: true },
    pillow: { color: '#f2c54b', flat: true },
    cushion: { color: '#c8483a', flat: true },
    toy: { color: '#e9998a', flat: true },
    crate: { color: '#c9a27a', flat: true, grid: 0.35 },
    rug: { color: '#c8483a', flat: true },
    rugInner: { color: '#f2c54b', flat: true },
    fruitA: { color: '#e6875f' },
    fruitB: { color: '#7fa86a' },
    panel: { color: '#5a7a8a', flat: true, grid: 0.5, metal: 'painted' },
    locker: { color: '#6f9aa6', flat: true, metal: 'painted' },
    metal: { color: '#b9b4a6', flat: true, metal: 'steel', brushed: true },
    btnA: { color: '#f2c54b', glow: 1, tag: `${tag}-btnA` },
    btnB: { color: '#5fd0c6', glow: 1, tag: `${tag}-btnB` },
    btnC: { color: '#e6503a', glow: 1, tag: `${tag}-btnC` },
    pot: { color: '#c8673f', flat: true },
    leaf: { color: '#4f6b34', flat: true },
    lamp: { color: '#fff1c8', glow: 1, tag: `${tag}-lamp` },
    collider: { color: '#ffffff' },
  };
  // the rooms are always in the hull's shadow: a little self-light keeps them from going to hatching
  for (const k of INTERIOR) o[k] = { ...o[k], glow: Math.max(o[k].glow ?? 0, 0.18) };
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, makeMaterial(v)]));
}

const INTERIOR = ['wallIn', 'floor', 'floorDark', 'ceiling', 'wall', 'wood', 'cream', 'blanket', 'pillow', 'cushion', 'toy', 'crate', 'rug', 'rugInner', 'fruitA', 'fruitB', 'panel', 'locker', 'metal', 'pot', 'leaf'];

// thin, small or decorative: drawn, not collided with
const NO_COLLIDE = ['seam', 'glowRed', 'glowTeal', 'thrust', 'portGlass', 'portIn', 'scorch', 'soot', 'ink', 'teal', 'rug', 'rugInner', 'fruitA', 'fruitB', 'btnA', 'btnB', 'btnC', 'lamp', 'toy', 'leaf'];

/**
 * @param o { space: in orbit (portholes dark, hatch shut), legs: 'down' | 'up' | 'broken',
 *            footY(a): ship-local height of each foot, ramp: { dir: local unit vector, length } | null }
 */
export function buildShipModel(o = {}) {
  const tag = `ship${SERIAL++}`;
  const mats = shipMaterials(tag, o);
  const group = new THREE.Group();
  group.name = 'ship';
  const batch = new Batch(mats);
  const hull = buildHull(batch, { legs: o.legs ?? 'down', footY: o.footY });
  const interior = buildInterior(batch, group, { tag });
  // glass you can't walk through: an invisible skin over the cockpit window
  batch.add('collider', shell({ r: RI + 0.12, patch: { a0: WINDOW.a0, a1: WINDOW.a1, y0: WINDOW.y0 - 0.1, y1: WINDOW.y1 + 0.1 }, tSeg: 60 }));
  // and an invisible skirting round the floor's edge, where the inner hull curves up like a bowl: without it
  // the step-up walked you up the curve of the wall (open at the hatch)
  {
    const r1 = Math.sqrt(RI * RI - DECK * DECK), gap = 0.03;
    batch.add('collider', sector({ r0: r1 - 0.25, r1: r1 + 0.1, a0: HATCH.a1 + gap, a1: HATCH.a0 - gap + Math.PI * 2, y0: DECK - 0.05, y1: DECK + SKIRT, seg: 72 }));
  }
  const flags = Object.fromEntries(NO_COLLIDE.map((k) => [k, { noCollide: true }]));
  flags.collider = { visible: false };
  const meshes = batch.build(group, flags);

  // the hatch door: slides up the hull (a rotation about the ship's z axis)
  const door = new THREE.Group();
  {
    const { out, inn } = doorGeometry();
    door.add(new THREE.Mesh(out, mats.hull), new THREE.Mesh(inn, mats.wallIn));
    const hp = polar(R + 0.12, HATCH_A, HATCH.y0 + 1.3);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12).translate(hp.x, hp.y, hp.z - 0.55), mats.dark);
    door.add(handle);
    // a teal stripe across the door, so it reads as a door from outside
    const stripe = shell({ r: R + 0.08, patch: { a0: HATCH.a0 + 0.004, a1: HATCH.a1 - 0.004, y0: HATCH.y0 + 1.8, y1: HATCH.y0 + 2.05 }, tSeg: 120 });
    door.add(new THREE.Mesh(stripe, mats.teal));
  }
  door.userData.noCollide = !o.space;   // shut in orbit (part of the walls), open when parked
  door.userData.dynamic = true;
  group.add(door);

  // the telescoping ramp, hinged at the outer edge of the threshold: nested sections, each a little
  // narrower and lower than the one before, that slide out of one another (see poseRamp)
  let ramp = null;
  if (o.ramp) {
    const L = o.ramp.length, n = rampSections(L), step = L / n;
    ramp = new THREE.Group();
    ramp.position.copy(polar(HINGE_R, HATCH_A, DECK));
    const sections = [];
    for (let i = 0; i < n; i++) {
      const len = i < n - 1 ? step + RAMP_OVERLAP : step;
      const r = rampGeometry(len, 1.9 - 0.1 * i);
      const sec = new THREE.Group();
      sec.position.y = -0.035 * i;
      const plank = new THREE.Mesh(r.plank, mats.trim);
      const rails = new THREE.Mesh(mergeAll(r.rails), mats.dark);
      const stripes = new THREE.Mesh(mergeAll(r.stripes), mats.fruitA);
      rails.userData.noCollide = true;
      stripes.userData.noCollide = true;
      sec.add(plank, rails, stripes);
      sec.userData.reach = i * step;     // where it starts once out
      ramp.add(sec);
      sections.push(sec);
    }
    // local +x of the ramp rotated onto its direction; the plank is in the
    // hatch's plane (the ship's x-y plane), so the minimal rotation has no roll
    ramp.userData.deployed = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(Math.sin(HATCH_A), 0, Math.cos(HATCH_A)), o.ramp.dir.clone().normalize());
    ramp.userData.length = L;
    ramp.userData.sections = sections;
    ramp.userData.stow = step + RAMP_OVERLAP;   // the nested stack's length
    ramp.userData.hinge = ramp.position.clone();
    ramp.userData.dynamic = true;
    poseRamp(ramp, 1);   // (the colliders are taken as it stands now: deployed)
    group.add(ramp);
  }

  // the call screen
  const callScreen = new CallScreen();
  const sc = interior.screen;
  const screenMat = callScreen.texture ? makeMaterial({ color: '#ffffff', map: callScreen.texture, glow: 1 }) : makeMaterial({ color: '#18222e', glow: 1, tag: `${tag}-screen` });
  const screen = new THREE.Mesh(new THREE.CircleGeometry(sc.radius, 40), screenMat);
  {
    const z = sc.normal.clone().normalize(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    screen.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    screen.position.copy(sc.centre).addScaledVector(z, 0.05);
  }
  screen.userData.noCollide = true;
  group.add(screen);

  // what only shows from inside (hidden when the camera is far away: fewer draw calls)
  const indoor = [interior.deco, interior.props, screen, ...['core', 'lamp', 'btnA', 'btnB', 'btnC', 'portIn', ...INTERIOR].map((k) => meshes[k]).filter(Boolean)];
  return { tag, group, meshes, mats, door, ramp, interior, hull, screen, callScreen, indoor };
}

function mergeAll(geos) {
  const out = [];
  for (const g of geos) out.push(g.index ? g.toNonIndexed() : g);
  const pos = [];
  for (const g of out) pos.push(...g.attributes.position.array);
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.computeVertexNormals();
  return m;
}

const RAMP_OVERLAP = 0.4;   // m: how far each section stays inside the one before when out
/** How many sections a ramp of length L telescopes in (each about 3 m). */
export const rampSections = (L) => Math.max(2, Math.min(5, Math.round(L / 3)));

const ease = (t) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
const span = (k, a, b) => Math.min(Math.max((k - a) / (b - a), 0), 1);

/**
 * The ramp's motion, k 0 (stowed) .. 1 (down on the ground), as a machine would do it:
 *   0    .. 0.3   the nested stack slides out of the doorway, level, over the sill
 *   0.3  .. 0.55  it tips down on its hinge to the ground's slope
 *   0.55 .. 1     the sections telescope out one after another, the last one onto the ground
 * Each phase eases in and out. Returns { slide, tilt, ext: [per section 0..1] }.
 */
export function rampPhases(k, n) {
  const slide = ease(span(k, 0, 0.3)), tilt = ease(span(k, 0.3, 0.55));
  const ext = [];
  for (let i = 1; i < n; i++) {
    // each one starts a little after the one before, and they overlap (a chain of pistons)
    const a = 0.55 + ((i - 1) / (n - 1)) * 0.3, b = a + 0.45 / (n - 1) + 0.15 / n;
    ext.push(ease(span(k, a, Math.min(1, b))));
  }
  return { slide, tilt, ext };
}

/** Lay the ramp's sections out for k (see rampPhases). */
export function poseRamp(ramp, k) {
  const U = ramp.userData, secs = U.sections, n = secs.length;
  const { slide, tilt, ext } = rampPhases(k, n);
  ramp.visible = k > 0.001;
  ramp.quaternion.identity().slerp(U.deployed, tilt);
  // slid in, the stack lies inside the doorway, over the threshold
  _out.set(Math.sin(HATCH_A), 0, Math.cos(HATCH_A)).applyQuaternion(ramp.quaternion);
  ramp.position.copy(U.hinge).addScaledVector(_out, -U.stow * (1 - slide));
  // each section rides out of the one before it (so the last moves the furthest)
  let x = 0;
  for (let i = 1; i < n; i++) {
    x += (secs[i].userData.reach - secs[i - 1].userData.reach) * ext[i - 1];
    secs[i].position.x = x;
  }
  ramp.updateMatrix();
}
const _out = new THREE.Vector3();

/** Deep space around the ship in the prologue: a dark dome of stars, the desert planet below, a small moon. */
export function buildSpace({ radius = 900 } = {}) {
  const g = new THREE.Group();
  g.userData.noCollide = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), makeMaterial({ color: '#141a33', glow: 1, side: THREE.BackSide }));
  g.add(dome);
  const N = 420;
  const stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), makeMaterial({ color: '#fff6dc', glow: 1 }), N);
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(radius * 0.92);
    const s = 1.2 + Math.pow(rnd(), 6) * 6;
    m.makeScale(s, s, s).setPosition(v);
    stars.setMatrixAt(i, m);
  }
  g.add(stars);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(330, 48, 32),
    makeMaterial({ color: '#efd29b', color2: '#dca57a', color3: '#f5e1b6', mode: MODE_STRATA, strataSize: 36, strataObject: true }));
  planet.position.set(0, -310, -560);
  g.add(planet);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), makeMaterial({ color: '#ece4d2', flat: true }));
  moon.position.set(-420, 160, -520);
  g.add(moon);
  g.userData.planet = planet;
  return g;
}

export { R, DECK };
