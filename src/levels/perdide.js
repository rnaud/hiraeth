import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { Terrain, jitter } from '../world.js';
import { Hoverbike, buildSocket } from '../bike.js';
import { Paint, painted, paintMaterial, spindle } from '../vehicle-kit.js';
import { LANDING } from '../story/perdide-data.js';

// ---------------------------------------------------------------------------
// Lorn:
// a swamp planet of humming crystal forests, carnivorous plants and glowing
// eggs, lit at twilight. Cross the deep water on a hover-skiff; wading too
// deep puts you back on the last dry ground. A crystal cave glows from within.
// ---------------------------------------------------------------------------

const WATER = 0;
const DEEP = -1.6;              // deeper than this is unsafe on foot
export const CAVE = { x: -170, z: 140, len: 130, r: 12, rot: 0.6, y: 1.6 };
// the story's places (src/story/perdide.js): the Great Crystal on its island east over the
// ford, the snapping bed on the landing's north shore, the fireflies' isle in the channel
// between the landing and the cave island
export const GREAT = { x: 120, z: -150 };
export const BED = { x: -6, z: 16, r: 4.5 };
export const ISLE = { x: -50, z: 112, r: 15 };
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
  // the fireflies' isle: a low hummock in the channel, only reached by skiff
  const di = Math.hypot(x - ISLE.x, z - ISLE.z);
  h = Math.max(h, THREE.MathUtils.lerp(-6, 1.3 + noise(x * 0.05, z * 0.05) * 0.3, smoothstep(ISLE.r + 12, ISLE.r - 3, di)));
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1200, 1900, edge) * (150 + fbm(noise, x * 0.004, z * 0.004, 3) * 120);
  return h;
}

/**
 * The hover-skiff: a long low hull in orange with a cream gunwale, its prow
 * drawn up into a curl with a lantern swinging from it, a teal float on
 * outrigger arms, a navy saddle, and a striped lateen sail that fills and
 * flutters as you go. Underneath, a hover plate glows with the backpack's
 * fluid (the tank sits in its cradle behind the seat). Painted parts share
 * two draw calls (src/vehicle-kit.js).
 */
export function buildSkiff() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const C = { orange: '#d9643a', cream: '#f3ead8', teal: '#5fb7ad', navy: '#34405e', yellow: '#f2c54b', coral: '#e6875f', glow: '#d6ff9a' };
  const smooth = new Paint(), flat = new Paint();
  // the hull: an open boat, long and low, wide at the stern, drawn to a point at the bow
  const HULL = [[0.001, -2.1], [0.55, -1.95], [0.72, -1.4], [0.76, -0.3], [0.7, 0.8], [0.5, 1.6], [0.2, 2.15], [0.001, 2.35]];
  const half = (pts, phi, sy) => {
    // the lower part of a lathe along +z (phi: half-angle round the keel)
    const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), 14, -phi, phi * 2);
    return g.rotateX(Math.PI / 2).scale(1, sy, 1);
  };
  smooth.add(half(HULL, Math.PI / 2, 0.55), C.orange);
  // a navy keel along its bottom
  smooth.add(half(HULL.map(([r, z]) => [r * 1.015, z * 0.995]), 0.55, 0.56), C.navy);
  // the gunwale: a cream rail round the rim, and the deck inside it
  const rim = new THREE.CatmullRomCurve3([...HULL.slice(1, -1).map(([r, z]) => new THREE.Vector3(r, 0, z)), new THREE.Vector3(0, 0, 2.33), ...HULL.slice(1, -1).reverse().map(([r, z]) => new THREE.Vector3(-r, 0, z)), new THREE.Vector3(0, 0, -2.08)], true);
  smooth.add(new THREE.TubeGeometry(rim, 40, 0.05, 4, true), C.cream);
  const deck = new THREE.Shape(rim.getSpacedPoints(30).map((p) => new THREE.Vector2(p.x * 0.96, -p.z * 0.98)));
  flat.add(new THREE.ShapeGeometry(deck).rotateX(-Math.PI / 2), '#c99a6a', { at: [0, -0.12, 0] });
  // the prow's curl, rising from the bow and rolling back on itself
  const curl = new THREE.CatmullRomCurve3([[0, 0.05, 2.1], [0, 0.45, 2.45], [0, 1.05, 2.55], [0, 1.4, 2.3], [0, 1.35, 2.02], [0, 1.15, 2.05]].map((p) => new THREE.Vector3(...p)));
  smooth.add(new THREE.TubeGeometry(curl, 16, 0.07, 6), C.cream);
  // the float on its arms, off the right side
  smooth.add(spindle([[0.03, -1.5], [0.17, -1.2], [0.2, 0], [0.16, 1.1], [0.02, 1.55]], { seg: 8 }), C.teal, { at: [1.55, -0.15, 0.1] });
  for (const z of [-0.6, 0.8]) {
    const arm = new THREE.CatmullRomCurve3([[0.4, 0.15, z], [1.0, 0.32, z], [1.55, -0.02, z]].map((p) => new THREE.Vector3(...p)));
    flat.add(new THREE.TubeGeometry(arm, 6, 0.05, 4), C.navy);
  }
  // the saddle, the mast and a boom
  smooth.add(new THREE.CapsuleGeometry(0.2, 0.55, 3, 8).rotateX(Math.PI / 2), C.navy, { at: [0, 0.22, -0.4], scale: [1.3, 0.55, 1] });
  flat.add(new THREE.BoxGeometry(0.4, 0.26, 0.7), C.navy, { at: [0, 0, -0.4] });
  flat.add(new THREE.BoxGeometry(0.5, 0.12, 0.5), C.navy, { at: [0, -0.07, -1.25] });   // the tank's pedestal
  flat.add(new THREE.CylinderGeometry(0.045, 0.065, 3.5, 5), C.navy, { at: [0, 1.85, 0.6] });
  flat.add(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 4), C.navy, { at: [0, 0.75, -0.45], rot: [Math.PI / 2 - 0.12, 0, 0] });
  const sm = smooth.mesh({ smooth: true }), fl = flat.mesh();
  body.add(sm, fl);

  // the sail: a lateen triangle in yellow and coral stripes, set on the mast; it fills with speed
  const sailRig = new THREE.Group();
  sailRig.position.set(0, 0.35, 0.6);
  const sail = new Paint();
  const top = new THREE.Vector3(0, 3.25, 0), foot = new THREE.Vector3(0, 0.15, 0), clew = new THREE.Vector3(0, 0.45, -2.1);
  const STRIPES = 5;
  for (let i = 0; i < STRIPES; i++) {
    // bands across the sail, from the luff (the mast) to the leech
    const a0 = i / STRIPES, a1 = (i + 1) / STRIPES;
    const p = (a, up) => (up ? top.clone().lerp(clew, a) : foot.clone().lerp(clew, a));
    const g = new THREE.BufferGeometry().setFromPoints([p(a0, false), p(a0, true), p(a1, true), p(a0, false), p(a1, true), p(a1, false)]);
    g.computeVertexNormals();
    sail.add(g, i % 2 ? C.coral : C.yellow);
  }
  const sailMesh = sail.mesh({ side: THREE.DoubleSide });
  sailRig.add(sailMesh);
  body.add(sailRig);
  // a pennant at the masthead
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, -0.1, -0.5)]);
  flagGeo.computeVertexNormals();
  const flag = new THREE.Mesh(painted(flagGeo, C.coral), paintMaterial({ side: THREE.DoubleSide }));
  flag.position.set(0, 3.6, 0.6);
  body.add(flag);
  // the lantern, hanging from the curl on a short cord: it swings
  const lantern = new THREE.Group();
  lantern.position.set(0, 1.15, 2.05);
  const cage = new Paint();
  cage.add(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 3), C.navy, { at: [0, -0.12, 0] });
  cage.add(new THREE.ConeGeometry(0.13, 0.1, 6), C.navy, { at: [0, -0.27, 0] });
  cage.add(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 6), C.navy, { at: [0, -0.5, 0] });
  lantern.add(cage.mesh());
  const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.4, 1).translate(0, -0.4, 0), makeMaterial({ color: '#fff3c4', glow: 1, flat: true }));
  lantern.add(flame);
  body.add(lantern);

  // what the fluid lights: the hover plate under the hull
  const under = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(Math.PI / 2).scale(0.55, 1, 1.6).translate(0, -0.22, 0), makeMaterial({ color: C.glow }));
  body.add(under);
  const seatAnchor = new THREE.Group();
  seatAnchor.position.set(0, -0.6, -0.6);
  body.add(seatAnchor);
  const { socket, port } = buildSocket(body, { at: [0, 0.03, -1.25], port: [0.28, 0.0, -0.9] });
  const jets = [new THREE.Vector3(0.45, -0.15, -1.95), new THREE.Vector3(-0.45, -0.15, -1.95)];
  const animate = (dt, b) => {
    const flow = Math.min(1, Math.abs(b.speed) / 30);
    // the sail fills (bellies out to the lee of the turn) and flutters when slack
    sailRig.rotation.y = THREE.MathUtils.clamp(b.yawRate * 0.25, -0.35, 0.35) + Math.sin(b.time * 7) * 0.03 * (1 - flow);
    sailMesh.scale.x = 1 + flow * 0.5;
    sailRig.scale.z = 1 - flow * 0.08;
    flag.rotation.y = Math.sin(b.time * (4 + flow * 8)) * (0.5 - flow * 0.3);
    // the lantern swings against the boat's moves
    const s = lantern.userData;
    s.a ??= 0; s.v ??= 0; s.sp ??= b.speed;
    const kick = dt > 0 ? (b.speed - s.sp) / dt : 0;
    s.sp = b.speed;
    s.v += (-s.a * 18 - s.v * 1.5 + kick * 0.06) * dt;
    s.a += s.v * dt;
    lantern.rotation.set(THREE.MathUtils.clamp(s.a + Math.sin(b.time * 1.6) * 0.06, -0.7, 0.7), 0, -b.bank * 0.6);
  };
  return { root, body, seatAnchor, socket, port, lights: [under], jets, animate };
}

export const CRYSTAL = ['#a99be0', '#62c3c9', '#c7a6f2', '#7fe0d0'];

// the level's content (levels/content.js): the story is a quest (src/story/perdide-data.js),
// so the page opens on the first visit and closes when the splinter sings in the cave
export const PERDIDE_CONTENT = {
  weather: ['rain', 'fog'],
  story: {
    title: 'THE GREAT CRYSTAL',
    intro: 'Somewhere east of the landing, something hums. The swamp people will know what.',
    outro: 'The crystal sang the song of the light that struck your ship. A splinter of it hums with your tank.',
    label: 'the Great Crystal', goal: [GREAT.x, 'ground', GREAT.z], radius: 30, manual: true,
  },
  relics: {
    spots: [{ at: [CAVE.x, 3.6, CAVE.z], snap: true }, [-13, -25], [40, -70], [BED.x, BED.z], [ISLE.x + 4, ISLE.z - 4]],
    names: ['Cave lantern', 'Egg shell', 'Grove shard', 'Plant tooth', 'Skiff charm'],
  },
  // Wendel, Sedge and Ivo, with their conversations (the errands count on this order)
  npcs: LANDING,
};

/**
 * One jaw of a carnivorous plant: a half shell, open side down (-y), with an
 * inside. The outer skin, a pale lip round the rim and a darker throat facing
 * in (its own faces, so the ink and the light read it as the inside of a
 * mouth, and you can't see through it to the swamp). Coloured per vertex, so
 * it is still one mesh with one material.
 */
export const JAW = { r: 2.2, wall: 0.14, skin: '#d9506a', lip: '#ee93a2', throat: '#93304a' };
export function jawShell({ r, wall, skin, lip, throat } = JAW) {
  const paint = (g, hex) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const outer = new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  // the inside: the same half shell a wall's thickness in, turned inside out (faces and normals point in)
  const inner = new THREE.SphereGeometry(r - wall, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const idx = inner.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const nrm = inner.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  // the lip joining them round the rim, facing down out of the mouth
  const rim = new THREE.RingGeometry(r - wall, r, 12, 1).rotateX(Math.PI / 2);
  return mergeGeometries([paint(outer, skin), paint(inner, throat), paint(rim, lip)]);
}

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
  const stalkMat = makeMaterial({ color: '#6f9a5a' }), jawMat = makeMaterial({ color: '#ffffff', vertexColors: true }), teethMat = makeMaterial({ color: '#f3ead8', flat: true });
  // a jaw is its shell and its ring of teeth: two meshes (shared geometry), not eight
  const jawGeo = {}, teethGeo = {}, stalks = [];
  for (const side of [-1, 1]) {
    jawGeo[side] = jawShell().rotateX(side > 0 ? 0 : Math.PI);
    teethGeo[side] = mergeGeometries(Array.from({ length: 7 }, (_, t) => {
      const a = (t / 7) * Math.PI * 2;
      return new THREE.ConeGeometry(0.2, 0.8, 4).rotateX(side > 0 ? Math.PI : 0).translate(Math.cos(a) * 1.8, side * -0.3, Math.sin(a) * 1.8).toNonIndexed();
    }));
  }
  function plant(x, z, { bed = false, h: hh = null, r = rng } = {}) {
    const base = terrain.heightAt(x, z);
    const h = hh ?? 6 + r() * 8;
    const p0 = new THREE.Vector3(0, 0, 0), p1 = new THREE.Vector3((r() - 0.5) * 3, h * 0.6, (r() - 0.5) * 3), p2 = new THREE.Vector3(0, h, 0);
    // the stalks don't move: one mesh for all of them (below)
    stalks.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 12, 0.45, 6).translate(x, base, z).toNonIndexed());
    const grp = new THREE.Group();
    grp.position.set(x, base, z);
    const head = new THREE.Group();
    head.position.copy(p2);
    head.userData.noCollide = true;
    const jaws = [];
    for (const side of [-1, 1]) {
      const jaw = new THREE.Group();
      jaw.add(new THREE.Mesh(jawGeo[side], jawMat), new THREE.Mesh(teethGeo[side], teethMat));
      head.add(jaw);
      jaws.push({ jaw, side });
    }
    head.rotation.z = Math.PI / 2;
    grp.add(head);
    scene.add(grp);
    plants.push({ jaws, pos: new THREE.Vector3(x, base + h, z), base: new THREE.Vector3(x, base, z), open: 1, bed, fed: 0 });
  }
  for (let i = 0; i < 40; i++) {
    const x = (rng() * 2 - 1) * 900, z = (rng() * 2 - 1) * 900;
    if (terrain.heightAt(x, z) > 0.3 && Math.hypot(x, z) > 25) plant(x, z);
  }
  plant(22, 18);
  // the snapping bed by the landing: a ring of low jaws round a patch of bare mud
  // (its own random stream, so the rest of the swamp is laid out as before)
  const bedRng = mulberry32(516);
  for (let k = 0; k < 5; k++) {
    const a = 0.5 + (k / 5) * Math.PI * 2;
    plant(BED.x + Math.sin(a) * BED.r, BED.z + Math.cos(a) * BED.r, { bed: true, h: 3.4 + (k % 3) * 0.5, r: bedRng });
  }
  scene.add(new THREE.Mesh(mergeGeometries(stalks), stalkMat));

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
  let crystal = null;
  {
    const gx = GREAT.x, gz = GREAT.z, base = terrain.heightAt(gx, gz);
    const parts = [], spires = [];
    for (let i = 0; i < 9; i++) {
      const h = 35 + rng() * 60, r = 5 + rng() * 7;
      const g = new THREE.CylinderGeometry(0, r, h, 6).translate(0, h / 2, 0);
      const rx = (rng() - 0.5) * 0.6, rz = (rng() - 0.5) * 0.6;
      g.rotateX(rx).rotateZ(rz);
      const tx = (rng() - 0.5) * 16, tz = (rng() - 0.5) * 16;
      g.translate(tx, -2, tz);
      parts.push(g.toNonIndexed());
      // where the fluid can splash it: a few points up its axis, each as wide as the spire there
      const R = new THREE.Matrix4().makeRotationZ(rz).multiply(new THREE.Matrix4().makeRotationX(rx));
      for (const k of [0.12, 0.3, 0.5]) spires.push({ pos: new THREE.Vector3(0, k * h, 0).applyMatrix4(R).add(new THREE.Vector3(gx + tx, base - 2, gz + tz)), r: r * (1 - k) + 1.2 });
    }
    // its own material: the story brightens it while it sings
    const crMat = makeMaterial({ color: '#c7a6f2', flat: true, glow: 0.8, greatCrystal: true });
    const cr = new THREE.Mesh(mergeGeometries(parts), crMat);
    cr.position.set(gx, base, gz);
    scene.add(cr);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 8, 48), makeMaterial({ color: '#8a7f8f', color2: '#6f6a80', color3: '#a99bb0', mode: 2, strataSize: 1.5, flat: true }));
    ring.position.set(gx, base + 26, gz);
    ring.rotation.set(1.2, 0.3, 0.2);
    scene.add(ring);
    const light = new THREE.Vector4(gx, base + 20, gz, 60);
    lights.push(light);
    crystal = { mesh: cr, mat: crMat, ring, light, pos: new THREE.Vector3(gx, base, gz), center: new THREE.Vector3(gx, base + 18, gz), spires };
  }

  // ---------------------------------------------------------- the crystal cave
  // A thick rock arch corridor: dark inside, lit by its own crystals.
  let caveMat = null;
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
    caveMat = makeMaterial({ color: '#7fe0d0', flat: true, glow: 1, caveCrystals: true });   // its own: they answer the splinter
    grp.add(new THREE.Mesh(mergeGeometries(inside), caveMat));
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

  // ---------------------------------------------------------- the fireflies' isle
  // a clutch of eggs under one broad cap: where the fireflies go at dusk (and come from)
  const nest = new THREE.Vector3(ISLE.x + 2, 0, ISLE.z - 1);
  nest.y = terrain.heightAt(nest.x, nest.z);
  eggs(nest.x, nest.z);
  {
    const prof = [[0, 0], [2.6, 0], [3.8, 0.07], [3.2, 0.2], [1.5, 0.45], [1.25, 0.7], [1.9, 0.79], [8.5, 0.83], [9.5, 0.88], [7.0, 0.96], [0, 1]];
    const x = ISLE.x - 4, z = ISLE.z + 3, g0 = terrain.heightAt(x, z), s = 1.4, H = 19;
    const geo = new THREE.LatheGeometry(prof.map(([pr, py]) => new THREE.Vector2(pr * s, py * H)), 14);
    jitter(geo, 0.12, 0.03, 77);
    geo.rotateZ(0.08).translate(x, g0 - 0.6, z);
    const pos = geo.attributes.position, cut = g0 - 0.6 + H * 0.8, idx = geo.index.array, st = [], cp = [];
    for (let t = 0; t < idx.length; t += 3) (Math.max(pos.getY(idx[t]), pos.getY(idx[t + 1]), pos.getY(idx[t + 2])) > cut ? cp : st).push(idx[t], idx[t + 1], idx[t + 2]);
    const part = (list) => { const g = geo.clone(); g.setIndex(list); return g; };
    scene.add(new THREE.Mesh(part(st), makeMaterial({ color: '#8a6fb8', flat: true })));
    scene.add(new THREE.Mesh(part(cp), makeMaterial({ color: '#7fe0d0', flat: true, glow: 0.3 })));
    lights.push(new THREE.Vector4(x, g0 + H * 0.75, z, 16));
  }

  return {
    id: 'perdide',
    // the flora (src/flora.js) leaves the Great Crystal, the snapping bed and the fireflies' isle their own
    floraAvoid: (x, z, r) => Math.hypot(x - GREAT.x, z - GREAT.z) < 22 + r || Math.hypot(x - BED.x, z - BED.z) < BED.r + 5 + r
      || Math.hypot(x - ISLE.x, z - ISLE.z) < ISLE.r * 0.6 + r,
    // for the story (src/story/perdide.js): the Great Crystal, the cave's crystals, the plants
    // (`fed` counts the globs each has swallowed), the fireflies' nest; silence 0..1 shuts every
    // jaw (the crystal is singing), tame stops them snapping at you, calm only the bed's
    crystal, caveMat, plants, nest, silence: 0, tame: false, calm: false,
    // a glob of the traveller's fluid makes a plant snap shut from afar (the push just rattles it)
    // an ember glob makes one recoil: it clamps shut and shudders (it doesn't feed it)
    targets: plants.map((p) => ({ kind: 'plant', radius: 2.2, accepts: ['fire'], position: () => p.pos, onHit: (mode) => { p.snap = mode === 'shoot' || mode === 'fire' ? 2.5 : 0.8; if (mode === 'shoot') p.fed++; if (mode === 'fire') p.recoil = 1; return true; } })),
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
    atmo: () => ({ tint: [0.92, 1.0, 1.0], fog: 1.5, name: 'Lorn' }),
    update(dt, t, ctx) {
      for (const m of movers) m(t);
      // carnivorous plants snap shut when the player comes close
      // while the crystal sings they all shut, slowly, and hold still; tamed, they let you by
      const pp = ctx?.player?.pos, quiet = this.silence ?? 0;
      for (const p of plants) {
        p.snap = Math.max(0, (p.snap ?? 0) - dt);
        const near = (!this.tame && !(p.bed && this.calm) && pp && pp.distanceTo(p.pos) < 7) || p.snap > 0;
        const want = near ? 0.05 : 1 - 0.92 * quiet;
        p.open += (want - p.open) * (1 - Math.exp(-(near ? 14 : 2 - quiet * 1.4) * dt));
        const breathe = Math.sin(t * 1.5 + p.pos.x) * 0.06 * (1 - quiet);
        p.recoil = Math.max(0, (p.recoil ?? 0) - dt * 0.6);
        const shudder = p.recoil ? Math.sin(t * 38 + p.pos.z) * 0.12 * p.recoil : 0;
        for (const j of p.jaws) j.jaw.rotation.z = j.side * (p.open * 0.75 + breathe) + shudder;
      }
    },
  };
}
