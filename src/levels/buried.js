import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';

// ---------------------------------------------------------------------------
// The Buried Machine (after Moebius): pale cream dunes under a sage sky, with
// domed huts and pipe elbows breaking the surface. A sand ramp slides down
// into a trench whose walls are the machine itself: blue-grey pipe strata at
// the top, rust-red cylinders, pillars and hatches below. Two cross-walls with
// great oval openings lead to the oculus, a teal drum open to the sky, where a
// peach porthole glows above a balcony. Overhead, far up, a whole city hangs
// upside down; on the horizon a colossal ring of arches carries a tiny town.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const nA = createNoise2D(1983);
const nB = createNoise2D(4417);

// ---------------------------------------------------------- layout
const FLOOR = -34;                   // canyon floor
const W = 22;                        // half-width of the walkable canyon floor
const CZ0 = -40, CZ1 = -150;         // the sand ramp from the dunes down into the canyon
const OZ = -480, OR = 34;            // the oculus drum (inner radius)
const OTOP = 40;                     // rim of the drum, well above the dunes
const BALCONY = FLOOR + 30;          // the ring balcony inside the oculus
const CITY_Y = 520;                  // underside of the hanging city
const CITY_C = new THREE.Vector3(-70, 0, -170);
const RING_C = new THREE.Vector3(0, 0, -250), RING_R = 1350;

export const canyonX = (z) => 28 * Math.sin((z - CZ0) / 95);   // canyon centreline (x as a function of z)
const cx = canyonX;
const OX = cx(OZ);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const rampT = (z) => { const t = clamp01((CZ0 - z) / (CZ0 - CZ1)); return t * t * (3 - 2 * t); };
const floorAt = (z) => 4 + (FLOOR - 4) * rampT(z);

function dunes(x, z) {
  const soft = 6 + fbm(nA, x * 0.0035, z * 0.0035, 4) * 5 + Math.sin(x * 0.03 + nB(x * 0.01, z * 0.01) * 2) * 1.6;
  let h = 6 + fbm(nA, x * 0.0035, z * 0.0035, 4) * 10;
  const ridge = 1 - Math.abs(nB(x * 0.006 + 3, z * 0.004));
  h += ridge * ridge * 7 + fbm(nB, x * 0.02, z * 0.02, 2) * 0.8;
  h = soft + (h - soft) * smoothstep(40, 150, Math.hypot(x, z - 60));      // a calm hollow round the start
  const r = Math.hypot(x - RING_C.x, z - RING_C.z);
  h += smoothstep(950, 1500, r) * (90 + fbm(nA, x * 0.003, z * 0.003, 3) * 60);   // horizon swells
  return h;
}
function canyonMask(x, z) {
  const d = Math.abs(x - cx(z));
  const along = smoothstep(CZ0 + 25, CZ0, z) * smoothstep(OZ, OZ + 10, z);
  return (1 - smoothstep(W + 5, W + 15, d)) * along;
}
function height(x, z) {
  const hc = dunes(x, z) + (floorAt(z) - dunes(x, z)) * canyonMask(x, z);
  const mo = 1 - smoothstep(OR + 4, OR + 10, Math.hypot(x - OX, z - OZ));
  return hc + (FLOOR - hc) * mo;
}
// canyon walls: a leaning surface from the floor (d = W + 3) up to the dune rim (d = W + 13)
const rimY = (z, s) => Math.max(dunes(cx(z) + s * (W + 16), z), floorAt(z) + 0.5);
const wallD = (y, z, s) => W + 3 + 10 * clamp01((y - floorAt(z)) / Math.max(rimY(z, s) - floorAt(z), 1));

// ---------------------------------------------------------- hero spots (also used by the content)
const HERO_DOME = [-30, -6];
const HERO_PIPE = { x0: 14, x1: 46, z: 8 };
const TOWER = [66, -16];
const LEDGE_Z = -200, LEDGE_Y = FLOOR + 16;
const LEDGE_X = cx(LEDGE_Z) - (wallD(LEDGE_Y, LEDGE_Z, -1) - 3);
const WALLS = [-262, -352];          // cross-walls with oval openings
export const OCULUS = { x: OX, z: OZ, r: OR, balcony: BALCONY, top: OTOP };

export const BURIED_CONTENT = {
  weather: [],
  story: {
    title: 'THE BURIED MACHINE',
    intro: 'Under the dunes, something still turns. Follow the pipes down into the rust canyon, find the oculus, and climb to the window that glows.',
    outro: 'The porthole is warm. Far below the sand, a great wheel shifts by one tooth, and the hanging city sways.',
    label: 'the oculus window', goal: [OX, 'top', OZ - 31], radius: 5, verticalRadius: 5,
  },
  relics: {
    spots: [HERO_DOME, [(HERO_PIPE.x0 + HERO_PIPE.x1) / 2, HERO_PIPE.z], TOWER, [LEDGE_X, LEDGE_Z], [cx(WALLS[1]), WALLS[1]]],
    names: ['Dome-keeper’s key', 'Pressure gauge', 'Derrick beacon', 'Rust gear tooth', 'Oval-window shard'],
  },
  gate: { at: [22, 86], heading: Math.PI },
  npcs: [
    { at: [14, 40], radius: 5, palette: { cloak: '#e9c9a8', lining: '#2b211f', cloth: '#5f7488', legs: '#3a3a3a' },
      lines: ['The domes are only the chimneys. The machine is all underneath.', 'Follow the sand slope down. The canyon walls are pipes, not stone.'] },
    { at: [cx(-200), -200], radius: 7, palette: { cloak: '#7f93a3', lining: '#2b211f', cloth: '#c8643f', legs: '#2b2f45' },
      lines: ['Listen. The walls are still warm.', 'Past the oval doors there is a room with no ceiling.'] },
    { at: [OX, OZ + 60], radius: 4, palette: { cloak: '#c9d4b8', lining: '#2b211f', cloth: '#2f5a5e', legs: '#4a3a2a' },
      lines: ['Inside, look up. The lit window is on the balcony.', 'The city up there? It has always hung like that.'], shy: true },
  ],
};

// annular sector slab, top face at y = 0, thickness t (world angle = atan2(z, x))
function sectorGeometry(r0, r1, a0, a1, t, seg) {
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
  shape.absarc(0, 0, r1, a0, a1, false);
  shape.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  shape.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: seg ?? Math.max(8, Math.ceil((a1 - a0) * 18)) });
  g.rotateX(Math.PI / 2);
  return g;
}

const Y = new THREE.Vector3(0, 1, 0);
/** A cylinder from a to b (radius r0 at a, r1 at b). */
function cylBetween(a, b, r0, r1 = r0, seg = 10, open = false) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
/** A quarter-torus elbow with world basis (bx, by, bz) around centre c. */
function elbow(c, R, r, bx, by, seg = 8) {
  const g = new THREE.TorusGeometry(R, r, seg, 6, Math.PI / 2);
  const bz = new THREE.Vector3().crossVectors(bx, by);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(bx, by, bz));
  return g.translate(c.x, c.y, c.z);
}

export function createBuried(scene) {
  const rng = mulberry32(1983);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const range = (a, b) => a + rng() * (b - a);
  const movers = [];
  const noShadow = [];
  const lights = [];

  const terrain = new Terrain({
    size: 4000, seg: 600, height,
    material: { color: '#f3ead2', color2: '#ece0c2', color3: '#dccba6', mode: MODE_TERRAIN, ripples: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);

  // ---------------------------------------------------------- materials
  const strata = (c1, c2, c3, size, extra = {}) => makeMaterial({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: size, ...extra });
  const M = {
    rust: strata('#c8643f', '#b35a3a', '#d9825a', 4.5, { flat: true }),
    rustGrid: strata('#c8643f', '#d9825a', '#b35a3a', 3, { grid: 3.5 }),
    rustDark: makeMaterial({ color: '#9a4a30', flat: true }),
    rustWall: strata('#c0603e', '#b35a3a', '#cf7450', 6, { pattern: 'cracks' }),
    rustFloor: makeMaterial({ color: '#d9825a', color2: '#cf7650', color3: '#b35a3a', mode: MODE_TERRAIN }),
    steel: strata('#7f93a3', '#5f7488', '#94a6b3', 2.2),
    steelFlat: makeMaterial({ color: '#7f93a3', flat: true }),
    pipe: makeMaterial({ color: '#d8dcc8' }),
    pipe2: makeMaterial({ color: '#bfcabd' }),
    flange: makeMaterial({ color: '#a9b4a8', flat: true }),
    ink: makeMaterial({ color: '#34405e', flat: true }),
    hatch: makeMaterial({ color: '#3d4a52', flat: true }),
    teal: strata('#5e9094', '#4f8086', '#6fa0a2', 3.5, { grid: 4 }),
    tealFlat: makeMaterial({ color: '#2f5a5e', flat: true }),
    tealMid: makeMaterial({ color: '#3d6a6c', flat: true }),
    tealFloor: makeMaterial({ color: '#4a6e6c', color2: '#557a76', color3: '#3d6366', mode: MODE_TERRAIN }),
    peach: makeMaterial({ color: '#f3a57c', glow: 0.85, flat: true }),
    skyPane: makeMaterial({ color: '#cfe6ea', glow: 0.6, flat: true }),
    city: [makeMaterial({ color: '#4f6a78' }), makeMaterial({ color: '#3d5866' }), strata('#5d7a86', '#4f6a78', '#3d5866', 9, { grid: 6 })],
    ring: strata('#7f93a3', '#6a8090', '#9aaab4', 10, { grid: 8 }),
    white: makeMaterial({ color: '#ffffff', flat: true }),
  };

  // ---------------------------------------------------------- merged buckets: one mesh per material and role
  const buckets = new Map();
  const put = (mat, geo, { solid = true, tag = '' } = {}) => {
    const k = `${mat.uuid}|${solid}|${tag}`;
    if (!buckets.has(k)) buckets.set(k, { mat, solid, tag, geos: [] });
    buckets.get(k).geos.push(geo);
    return geo;
  };

  // ======================================================== spawn dunes: domed huts and pods
  const avoid = (x, z, r) => (z < CZ0 + 30 && Math.abs(x - cx(z)) < W + 18 + r) || Math.hypot(x - OX, z - OZ) < OR + 20 + r
    || Math.hypot(x, z - 60) < 14 + r || Math.hypot(x - 22, z - 86) < 10 + r
    || Math.hypot(x - HERO_DOME[0], z - HERO_DOME[1]) < 8 + r || Math.hypot(x - TOWER[0], z - TOWER[1]) < 18 + r
    || (Math.abs(z - HERO_PIPE.z) < 6 + r && x > HERO_PIPE.x0 - 6 - r && x < HERO_PIPE.x1 + 6 + r);
  {
    const body = new THREE.CylinderGeometry(4, 4.15, 5.4, 14, 1).translate(0, 0.5, 0).toNonIndexed();
    const band = new THREE.CylinderGeometry(4.35, 4.35, 0.5, 14, 1).translate(0, 3.25, 0).toNonIndexed();
    const dome = new THREE.SphereGeometry(4.05, 14, 6, 0, TAU, 0, Math.PI / 2).translate(0, 3.2, 0).toNonIndexed();
    const hutGeo = mergeGeometries([body, band, dome].map((g) => { g.deleteAttribute('uv'); return g; }));
    const winParts = [];
    for (const a of [0.3, 2.4, 4.3]) winParts.push(new THREE.BoxGeometry(1.1, 0.8, 0.4).translate(0, 1.7, 4.05).rotateY(a).toNonIndexed());
    winParts.push(new THREE.BoxGeometry(1.4, 2.2, 0.4).translate(0, 0.6, 4.05).rotateY(1.3).toNonIndexed());
    winParts.push(new THREE.BoxGeometry(0.9, 0.6, 0.3).translate(0, 5.6, 2.6).rotateX(-0.6).rotateY(0.3).toNonIndexed());  // skylight
    const winGeo = mergeGeometries(winParts.map((g) => { g.deleteAttribute('uv'); return g; }));
    const antGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.08, 0.12, 5, 5).translate(1.8, 8.6, 0.6),
      new THREE.BoxGeometry(1.3, 0.7, 0.05).translate(2.45, 10.6, 0.6),
      new THREE.BoxGeometry(1.6, 0.08, 0.08).translate(1.8, 9.4, 0.6),
    ].map((g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; }));
    // observatory pods: half-buried spheres with a slot window
    const podGeo = new THREE.SphereGeometry(5, 14, 8).toNonIndexed(); podGeo.deleteAttribute('uv');
    const podWin = mergeGeometries([0, 0.5, 1.0, 1.5].map((a) => { const g = new THREE.BoxGeometry(1.2, 0.7, 0.6).translate(0, 1.6, 4.75).rotateY(a).toNonIndexed(); g.deleteAttribute('uv'); return g; }));

    const huts = [{ x: HERO_DOME[0], z: HERO_DOME[1], s: 1.15, ant: true }];
    // little settlements on the crests in view of the start
    for (const [x, z, s, ant] of [[-44, -14, 0.8, false], [-17, -22, 0.7, true], [-62, 2, 0.95, true], [52, -6, 1.0, true], [70, 8, 0.75, false],
      [88, -30, 1.2, false], [-90, -40, 1.1, true], [-110, 30, 0.85, false], [40, 30, 0.7, false], [-76, 60, 0.9, true]]) huts.push({ x, z, s, ant });
    const pods = [];
    let tries = 0;
    while (huts.length + pods.length < 46 && tries++ < 2000) {
      const a = rng() * TAU, r = 40 + Math.pow(rng(), 0.8) * 520;
      const x = Math.cos(a) * r, z = 60 + Math.sin(a) * r * 1.1 - 120;
      const s = 0.7 + rng() * 0.6;
      if (avoid(x, z, 6 * s) || [...huts, ...pods].some((h) => Math.hypot(h.x - x, h.z - z) < 14)) continue;
      // in little clusters along dune crests, like the plates
      (rng() < 0.72 ? huts : pods).push({ x, z, s, ant: rng() < 0.45 });
    }
    const COLORS = ['#efe3c8', '#e9c9a8', '#e3d8bc', '#e8b896', '#d9d3b8'];
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    const inst = (geo, mat, list, place, colorize) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((h, i) => { place(h, dummy); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (colorize) m.setColorAt(i, col.set(colorize(h, i))); });
      m.computeBoundingSphere();
      m.userData.tiled = true;
      scene.add(m);
      return m;
    };
    for (const h of huts) { h.y = terrain.baseAt(h.x, h.z, 4 * h.s) - (h === huts[0] ? 0.4 : 0.4 + rng() * 1.6); h.rot = rng() * TAU; h.c = pick(COLORS); }
    for (const p of pods) { p.y = terrain.baseAt(p.x, p.z, 4 * p.s) - 1.5 - rng() * 1.5; p.rot = rng() * TAU; p.c = pick(COLORS); }
    const placeHut = (h, d) => { d.position.set(h.x, h.y, h.z); d.rotation.set(0, h.rot, 0); d.scale.setScalar(h.s); };
    inst(hutGeo, M.white, huts, placeHut, (h) => h.c);
    inst(winGeo, M.hatch, huts, placeHut).userData.noCollide = true;
    const ant = inst(antGeo, M.ink, huts.filter((h) => h.ant), placeHut);
    ant.userData.noCollide = true;
    inst(podGeo, M.white, pods, (p, d) => { d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.rot, 0); d.scale.set(p.s, p.s * 0.8, p.s); }, (p) => p.c);
    const pw = inst(podWin, M.hatch, pods, (p, d) => { d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.rot, 0); d.scale.set(p.s, p.s * 0.8, p.s); });
    pw.userData.noCollide = true;
  }

  // ======================================================== pipes breaking the sand
  /** An arched pipe: rises from the sand, runs level, dives back in. */
  function archPipe(x0, z0, x1, z1, r, lift, mat = M.pipe) {
    const h = new THREE.Vector3(x1 - x0, 0, z1 - z0); const len = h.length(); h.normalize();
    let g = -Infinity;
    for (let k = 0; k <= 8; k++) g = Math.max(g, H(x0 + (x1 - x0) * k / 8, z0 + (z1 - z0) * k / 8));
    const top = g + lift, R = r * 2.2;
    const gA = H(x0, z0), gB = H(x1, z1);
    const a0 = new THREE.Vector3(x0, gA - 3, z0), a1 = new THREE.Vector3(x0, top - R, z0);
    const b1 = new THREE.Vector3(x1, top - R, z1), b0 = new THREE.Vector3(x1, gB - 3, z1);
    const s0 = a1.clone().addScaledVector(h, R).setY(top), s1 = b1.clone().addScaledVector(h, -R).setY(top);
    put(mat, cylBetween(a0, a1, r, r, 12, true));
    put(mat, elbow(a1.clone().addScaledVector(h, R), R, r, h.clone().negate(), Y, 12));
    if (len > 2 * R + 0.5) put(mat, cylBetween(s0, s1, r, r, 12, true));
    put(mat, elbow(b1.clone().addScaledVector(h, -R), R, r, Y, h, 12));
    put(mat, cylBetween(b1, b0, r, r, 12, true));
    // flanged joints
    for (const [p, q] of [[a1, a0], [b1, b0]]) {
      const m = p.clone().lerp(q, 0.12);
      put(M.flange, cylBetween(m.clone().addScaledVector(Y, 0.3), m.clone().addScaledVector(Y, -0.3), r * 1.3, r * 1.3, 12), { solid: false });
    }
    if (len > 2 * R + 6) {
      const m = s0.clone().lerp(s1, 0.5);
      put(M.flange, cylBetween(m.clone().addScaledVector(h, 0.35), m.clone().addScaledVector(h, -0.35), r * 1.3, r * 1.3, 12), { solid: false });
    }
    return top + r;
  }
  /** A pipe stub climbing out of a dune at an angle, ending in an open elbow mouth. */
  function stubPipe(x, z, r, dir) {
    const g = H(x, z), h = new THREE.Vector3(Math.cos(dir), 0, Math.sin(dir));
    const a0 = new THREE.Vector3(x, g - 4, z).addScaledVector(h, -3), a1 = new THREE.Vector3(x, g + 1.6 + r, z);
    put(M.pipe2, cylBetween(a0, a1, r, r, 12, true));
    const R = r * 2;
    put(M.pipe2, elbow(a1.clone().addScaledVector(h, R), R, r, h.clone().negate(), Y, 12));
    const mouth = a1.clone().addScaledVector(h, R).addScaledVector(Y, R);
    put(M.flange, cylBetween(mouth, mouth.clone().addScaledVector(h, 0.7), r * 1.35, r * 1.35, 12), { solid: false });
    put(M.hatch, cylBetween(mouth.clone().addScaledVector(h, 0.4), mouth.clone().addScaledVector(h, 0.75), r * 0.85, r * 0.85, 12), { solid: false });
  }
  {
    archPipe(HERO_PIPE.x0, HERO_PIPE.z, HERO_PIPE.x1, HERO_PIPE.z, 1.5, 5.5, M.pipe);
    let n = 0;
    for (let i = 0; i < 400 && n < 22; i++) {
      const a = rng() * TAU, r = 50 + rng() * 420, x = Math.cos(a) * r, z = Math.sin(a) * r - 80;
      const dir = rng() * TAU, len = 14 + rng() * 34, x1 = x + Math.cos(dir) * len, z1 = z + Math.sin(dir) * len;
      if (avoid(x, z, 8) || avoid(x1, z1, 8) || avoid((x + x1) / 2, (z + z1) / 2, 8)) continue;
      if (rng() < 0.65) archPipe(x, z, x1, z1, 0.8 + rng() * 0.9, 2 + rng() * 5, rng() < 0.5 ? M.pipe : M.pipe2);
      else stubPipe(x, z, 0.9 + rng() * 0.8, dir);
      n++;
    }
    // a few stubs near the start, so the first view has the motif
    stubPipe(-14, 26, 1.3, 0.4); stubPipe(28, 52, 1.0, 2.6); stubPipe(-44, 40, 1.6, -0.6);
    archPipe(-56, 8, -60, -26, 1.1, 3);

    // parallel pipe bundles running along both canyon rims (half sunk in the sand)
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const r = 1.1 + k * 0.25, pts = [];
        for (let z = -70; z >= -420; z -= 10) {
          const x = cx(z) + s * (W + 17 + k * 3.2);
          pts.push(new THREE.Vector3(x, H(x, z) + r * 0.35, z));
        }
        put(k % 2 ? M.pipe2 : M.pipe, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, r, 8), { solid: k === 0 });
        for (let q = 1; q < pts.length - 1; q += 4) put(M.flange, cylBetween(pts[q].clone().setZ(pts[q].z + 0.4), pts[q].clone().setZ(pts[q].z - 0.4), r * 1.3, r * 1.3, 10), { solid: false });
      }
    }
  }

  // ======================================================== the canyon: floor, leaning walls, machine strata
  const zEnd = OZ + 26;   // where the canyon walls meet the drum
  {
    // rust floor strip (laid over the heightfield where the floor is flat)
    const rows = [], cols = 6;
    for (let z = CZ1 + 6; z >= zEnd - 6; z -= 4) rows.push(z);
    const pos = [], idx = [];
    rows.forEach((z, i) => {
      for (let c = 0; c <= cols; c++) {
        const d = -(W + 4) + (c / cols) * 2 * (W + 4);
        pos.push(cx(z) + d, floorAt(z) + 0.06, z);
        if (i && c) { const a = (i - 1) * (cols + 1) + c - 1, b = a + 1, e = i * (cols + 1) + c - 1, f = e + 1; idx.push(a, b, e, b, f, e); }
      }
    });
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setIndex(idx); fg.computeVertexNormals();
    put(M.rustFloor, fg);

    // leaning walls: from the floor up to the dune rim, in rust
    for (const s of [-1, 1]) {
      const wp = [], wi = [], K = 6;
      const zs = [];
      for (let z = -52; z >= zEnd; z -= 4) zs.push(z);
      zs.forEach((z, i) => {
        const f = floorAt(z) - 1.5, top = rimY(z, s) + 0.6;
        for (let k = 0; k <= K; k++) {
          const t = k / K, bump = (k > 0 && k < K) ? -Math.abs(nB(z * 0.08, k * 1.7 + s)) * 1.6 : 0;   // only ever toward the canyon
          wp.push(cx(z) + s * (W + 3 + 10 * t + bump), f + (top - f) * t, z);
          if (i && k) {
            const a = (i - 1) * (K + 1) + k - 1, b = a + 1, c = i * (K + 1) + k - 1, d = c + 1;
            if (s > 0) wi.push(a, b, c, b, d, c); else wi.push(a, c, b, b, c, d);
          }
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      g.setIndex(wi); g.computeVertexNormals();
      put(M.rustWall, g);
    }

    // the machine against the walls: pillars, stacked cylinders, hatches; blue-grey strata near the top
    const pillarH = [];
    // the blue-grey pipe stratum: long parallel pipes packed in the top band of each wall (the "trench edge")
    for (const s of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const r = 0.7 + ((k * 7) % 5) * 0.14, pts = [];
        for (let z = -48; z >= zEnd; z -= 8) {
          const f = floorAt(z), top = rimY(z, s);
          let y = top - 1.2 - k * 1.55;
          if (s < 0 && Math.abs(z - LEDGE_Z) < 10 && y > LEDGE_Y - 2) y = top + 0.4 - k * 0.2;   // keep the ledge clear
          if (y < f + 0.4) y = f - 2;
          pts.push(new THREE.Vector3(cx(z) + s * (wallD(y, z, s) + r * 0.1), y, z));
        }
        put(k % 3 === 1 ? M.steelFlat : M.steel, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, r, 8), { solid: false });
      }
    }
    for (const s of [-1, 1]) {
      for (let z = -60; z >= zEnd + 4; z -= range(6, 9)) {
        const f = floorAt(z), top = rimY(z, s), wallH = top - f;
        if (wallH < 3) continue;
        const nearLedge = s < 0 && Math.abs(z - LEDGE_Z) < 9;
        const nearWall = WALLS.some((wz) => Math.abs(z - wz) < 6);
        const at = (y, inset = 0) => cx(z) + s * (wallD(y, z, s) + inset);
        const shallow = wallH < 16 || z > CZ1;                 // the ramp: all blue-grey strata
        const band0 = shallow ? f + 0.5 : top - 11;
        if (rng() < 0.5) {   // vertical conduits in the strata
          const y0 = band0, y1 = top - 0.5, r = range(0.7, 1.5), zz = z + range(-2, 2);
          put(M.steel, cylBetween(new THREE.Vector3(at(y0, r * 0.6), y0, zz), new THREE.Vector3(at(y1, r * 0.6), y1, zz), r, r, 8));
          put(M.flange, cylBetween(new THREE.Vector3(at(y1 - 1, r * 0.6), y1 - 1, zz), new THREE.Vector3(at(y1 - 1.5, r * 0.6), y1 - 1.5, zz), r * 1.3, r * 1.3, 8), { solid: false });
        }
        if (shallow || nearWall || nearLedge) continue;
        // rust machinery below the strata
        const kind = rng();
        if (kind < 0.45) {   // a colossal pillar standing against the wall
          const r = range(2.4, 4.2), h = wallH * range(0.55, 0.85), x = cx(z) + s * (W + 3 + r * 0.4);
          put(M.rustGrid, new THREE.CylinderGeometry(r, r * 1.08, h, 12, 1).translate(x, f + h / 2 - 1, z));
          put(M.rustDark, new THREE.CylinderGeometry(r * 1.2, r * 1.2, 1.2, 12, 1).translate(x, f + h - 1, z));
          put(M.rust, new THREE.CylinderGeometry(r * 1.25, r * 1.3, 2, 12, 1).translate(x, f, z));
          pillarH.push({ x, z, r, y: f + h * range(0.3, 0.6), s });
        } else if (kind < 0.8) {   // stacked horizontal cylinders (tanks laid along the wall)
          for (let y = f + range(2, 4); y < top - 13; y += range(5, 8)) {
            if (nearLedge && y > LEDGE_Y - 4) break;
            const r = range(1.8, 3.2), l = range(6, 10), za = z + l / 2, zb = z - l / 2;
            const xa = cx(za) + s * (wallD(y, za, s) + r * 0.25), xb = cx(zb) + s * (wallD(y, zb, s) + r * 0.25);
            put(M.rust, cylBetween(new THREE.Vector3(xa, y, za), new THREE.Vector3(xb, y, zb), r, r, 12));
            put(M.rustDark, cylBetween(new THREE.Vector3(xa, y, za + 0.3), new THREE.Vector3(xa, y, za - 0.2), r * 1.12, r * 1.12, 12), { solid: false });
          }
        } else {   // a ribbed duct climbing the wall
          const r = range(1.6, 2.4), y0 = f - 1, y1 = Math.min(top - 12, f + wallH * 0.75);
          const a = new THREE.Vector3(at(y0, r), y0, z), b = new THREE.Vector3(at(y1, r), y1, z);
          put(M.rustGrid, cylBetween(a, b, r, r, 10));
          for (let k = 1; k < 7; k++) { const p = a.clone().lerp(b, k / 7); put(M.rustDark, cylBetween(p.clone().addScaledVector(Y, 0.35), p.clone().addScaledVector(Y, -0.35), r * 1.18, r * 1.18, 10), { solid: false }); }
        }
      }
    }
    // round hatches and glowing portholes on the pillars, facing the canyon
    for (const p of pillarH) {
      const lit = rng() < 0.35, face = new THREE.Vector3(-p.s, 0, 0);
      const c = new THREE.Vector3(p.x, p.y, p.z).addScaledVector(face, p.r * 0.92);
      put(M.rustDark, new THREE.TorusGeometry(p.r * 0.55, 0.22, 6, 18).rotateY(Math.PI / 2).translate(c.x, c.y, c.z), { solid: false });
      put(lit ? M.peach : M.hatch, new THREE.CircleGeometry(p.r * 0.52, 18).rotateY(-p.s * Math.PI / 2).translate(c.x - p.s * 0.08, c.y, c.z), { solid: false });
    }

    // the ledge (a relic spot), a jutting machine slab on the left wall
    {
      const s = -1, z = LEDGE_Z, dIn = wallD(LEDGE_Y, z, s), x0 = cx(z) + s * (dIn - 7), x1 = cx(z) + s * (dIn + 1.5);
      const cxL = (x0 + x1) / 2, wx = Math.abs(x1 - x0);
      put(M.rustGrid, new THREE.BoxGeometry(wx, 1.6, 9).translate(cxL, LEDGE_Y - 0.8, z));
      put(M.rustDark, new THREE.BoxGeometry(wx + 0.6, 0.5, 9.6).translate(cxL, LEDGE_Y - 1.8, z));
      put(M.rust, new THREE.CylinderGeometry(1.4, 1.8, LEDGE_Y - FLOOR, 10).translate(x0 + s * 1.6, (LEDGE_Y + FLOOR) / 2 - 1, z - 3));
      put(M.rust, new THREE.CylinderGeometry(1.4, 1.8, LEDGE_Y - FLOOR, 10).translate(x0 + s * 1.6, (LEDGE_Y + FLOOR) / 2 - 1, z + 3));
      // stepping tanks below it, for the climb
      put(M.rust, cylBetween(new THREE.Vector3(cx(z) + s * (W + 1), FLOOR + 2.5, z + 9), new THREE.Vector3(cx(z) + s * (W + 1), FLOOR + 2.5, z + 16), 2.6, 2.6, 12));
      put(M.rust, new THREE.BoxGeometry(5, 9, 5).translate(cx(z) + s * (W + 2), FLOOR + 4.5, z + 7));
    }

    // cross-walls with great oval openings (and lit oval windows)
    for (const [wi, wz] of WALLS.entries()) {
      const top = Math.max(rimY(wz, -1), rimY(wz, 1)) + 8, half = W + 15, bot = FLOOR - 6;
      const shape = new THREE.Shape();
      shape.moveTo(-half, bot); shape.lineTo(half, bot); shape.lineTo(half, top); shape.lineTo(-half, top); shape.lineTo(-half, bot);
      const hole = new THREE.Path();
      const rx = wi ? 12 : 14, ry = wi ? 22 : 19, cy = FLOOR + (wi ? 19 : 15);
      hole.absellipse(0, cy, rx, ry, 0, TAU, true);
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 7, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, -3.5);
      const tan = Math.atan(28 / 95 * Math.cos((wz - CZ0) / 95));   // dx/dz of the centreline
      g.rotateY(tan).translate(cx(wz), 0, wz);
      put(M.rustWall, g);
      // a heavy rim round the opening, on both faces
      for (const side of [-1, 1]) {
        const curve = new THREE.EllipseCurve(0, cy, rx + 0.6, ry + 0.6, 0, TAU);
        const pts = curve.getPoints(40).slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, side * 3.7));
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.9, 6, true);
        tube.rotateY(tan).translate(cx(wz), 0, wz);
        put(M.rustDark, tube, { solid: false });
        // lit oval panes either side of the opening
        for (const ox of [-1, 1]) {
          if ((ox + side + wi) % 2 === 0) continue;
          const pane = new THREE.CircleGeometry(1, 24).scale(3.2, 6.5, 1);
          if (side < 0) pane.rotateY(Math.PI);
          pane.translate(ox * (rx + 9), cy + 3, side * 3.62);
          pane.rotateY(tan).translate(cx(wz), 0, wz);
          put(M.peach, pane, { solid: false });
          const ring = new THREE.TorusGeometry(1, 0.12, 5, 24).scale(3.4, 6.7, 1).translate(ox * (rx + 9), cy + 3, side * 3.66);
          ring.rotateY(tan).translate(cx(wz), 0, wz);
          put(M.rustDark, ring, { solid: false });
        }
      }
    }
  }

  // ======================================================== the oculus: a teal drum open to the sky
  {
    const g = Math.asin(10 / OR);                 // half-angle of the doorway (faces +z, back up the canyon)
    const h = OTOP - (FLOOR - 2);
    const outer = new THREE.CylinderGeometry(OR + 2.5, OR + 3, h, 72, 1, true, g, TAU - 2 * g).translate(OX, (OTOP + FLOOR - 2) / 2, OZ);
    put(M.rustGrid, outer);
    const inner = new THREE.CylinderGeometry(OR, OR, h, 72, 1, true, g, TAU - 2 * g).translate(OX, (OTOP + FLOOR - 2) / 2, OZ);
    { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    inner.computeVertexNormals();   // faces the inside
    put(M.teal, inner);
    put(M.rustDark, new THREE.RingGeometry(OR - 0.2, OR + 3.4, 72).rotateX(-Math.PI / 2).translate(OX, OTOP, OZ));
    put(M.rust, new THREE.TorusGeometry(OR + 3, 0.9, 6, 72).rotateX(Math.PI / 2).translate(OX, OTOP - 0.6, OZ), { solid: false });
    // the doorway panel: an arched opening through the drum wall
    for (const [t, mat, r] of [[2.6, M.rustGrid, OR + 1.4], [0.6, M.teal, OR - 0.2]]) {
      const sh = new THREE.Shape();
      const hw = 12, b = FLOOR - 2;
      sh.moveTo(-hw, b); sh.lineTo(hw, b); sh.lineTo(hw, OTOP); sh.lineTo(-hw, OTOP); sh.lineTo(-hw, b);
      const hole = new THREE.Path();
      hole.moveTo(-8, FLOOR - 1); hole.lineTo(8, FLOOR - 1); hole.lineTo(8, FLOOR + 16); hole.absarc(0, FLOOR + 16, 8, 0, Math.PI, false); hole.lineTo(-8, FLOOR - 1);
      sh.holes.push(hole);
      const pg = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 16 }).translate(OX, 0, OZ + r * Math.cos(g) - t / 2);
      put(mat, pg);
    }
    // floor, balcony, windows, machinery
    put(M.tealFloor, new THREE.CircleGeometry(OR + 0.5, 48).rotateX(-Math.PI / 2).translate(OX, FLOOR + 0.06, OZ));
    const balc = sectorGeometry(OR - 6, OR + 0.1, 0, TAU, 1.4, 72).translate(OX, BALCONY, OZ);
    put(M.steel, balc);
    put(M.tealFlat, sectorGeometry(OR - 6.3, OR - 5.7, 0, TAU, 1.0, 72).translate(OX, BALCONY + 1.0, OZ), { solid: false });  // a low rail
    // brackets under the balcony
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU, dx = Math.sin(a), dz = Math.cos(a);
      if (Math.abs(Math.atan2(dx, dz)) < g + 0.1) continue;
      const p0 = new THREE.Vector3(OX + dx * (OR - 0.4), BALCONY - 7, OZ + dz * (OR - 0.4));
      const p1 = new THREE.Vector3(OX + dx * (OR - 5.5), BALCONY - 0.5, OZ + dz * (OR - 5.5));
      put(M.tealFlat, cylBetween(p0, p1, 0.5, 0.5, 6), { solid: false });
    }
    // tall narrow arched windows round the inside, two tiers
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU + 0.17, dx = Math.sin(a), dz = Math.cos(a);
      if (Math.abs(Math.atan2(dx, dz)) < g + 0.2) continue;
      for (const [y0, hh] of [[FLOOR + 5, 16], [BALCONY + 18, 14]]) {
        const win = mergeGeometries([
          new THREE.PlaneGeometry(2.4, hh).translate(0, y0 + hh / 2, 0),
          new THREE.CircleGeometry(1.2, 10, 0, Math.PI).translate(0, y0 + hh, 0),
        ].map((q) => q.toNonIndexed()));
        win.rotateY(a + Math.PI).translate(OX + dx * (OR - 0.15), 0, OZ + dz * (OR - 0.15));
        put(k % 5 === 2 ? M.peach : M.skyPane, win, { solid: false });
      }
    }
    // the goal: a great porthole glowing above the far side of the balcony
    {
      const c = new THREE.Vector3(OX, BALCONY + 9.5, OZ - OR + 0.5);
      put(M.steel, new THREE.TorusGeometry(7, 1.2, 8, 40).translate(c.x, c.y, c.z));
      put(M.peach, new THREE.CircleGeometry(6.6, 36).translate(c.x, c.y, c.z + 0.1), { solid: false });
      for (let k = 0; k < 8; k++) {   // bolts / ribs
        const a = (k / 8) * TAU;
        put(M.tealFlat, new THREE.BoxGeometry(0.5, 2.2, 1).translate(Math.cos(a) * 8.4, Math.sin(a) * 8.4, 0).rotateZ(0).translate(c.x, c.y, c.z + 0.3), { solid: false });
      }
      lights.push(new THREE.Vector4(c.x, c.y, c.z + 4, 16));
    }
    // vertical pipes up the inner wall, tanks on the floor
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + 0.05, dx = Math.sin(a), dz = Math.cos(a);
      if (Math.abs(Math.atan2(dx, dz)) < g + 0.15) continue;
      const r = range(0.5, 1.1), rr = OR - r - 0.2;
      put(M.tealFlat, new THREE.CylinderGeometry(r, r, OTOP - FLOOR, 8, 1, true).translate(OX + dx * rr, (OTOP + FLOOR) / 2, OZ + dz * rr), { solid: false });
    }
    for (let k = 0; k < 9; k++) {
      const a = rng() * TAU, rr = range(18, 27), dx = Math.sin(a), dz = Math.cos(a);
      if (Math.abs(Math.atan2(dx, dz)) < 0.6) continue;   // keep the doorway and the centre clear
      const r = range(1.6, 3.4), hh = range(3, 9);
      put(M.teal, new THREE.CylinderGeometry(r, r, hh, 12).translate(OX + dx * rr, FLOOR + hh / 2, OZ + dz * rr));
      put(M.tealFlat, new THREE.SphereGeometry(r, 12, 5, 0, TAU, 0, Math.PI / 2).translate(OX + dx * rr, FLOOR + hh, OZ + dz * rr));
    }
  }

  // ======================================================== floating machine towers and chimney stacks
  /** A derrick-like rust machine, local origin at the hull's waist; its platform top is at y = 11 * s. */
  function derrick(add, s) {
    const T = (g) => g.scale(s, s, s);
    add(M.rustGrid, T(new THREE.CylinderGeometry(4, 5, 10, 12).translate(0, 5, 0)));
    add(M.rust, T(new THREE.ConeGeometry(5, 12, 12).rotateX(Math.PI).translate(0, -6, 0)));
    add(M.rustDark, T(new THREE.CylinderGeometry(8, 7.5, 1, 16).translate(0, 10.5, 0)));
    add(M.rust, T(new THREE.BoxGeometry(4, 4, 4).translate(-4.5, 13, -2)));
    add(M.hatch, T(new THREE.BoxGeometry(1.2, 1, 0.3).translate(-4.5, 13.6, 0.05)));
    add(M.steel, T(new THREE.SphereGeometry(2.6, 12, 8).translate(4.8, 3, 1)));
    add(M.ink, T(new THREE.CylinderGeometry(0.18, 0.3, 16, 5).translate(4, 19, 3)));
    add(M.ink, T(new THREE.BoxGeometry(4, 0.2, 0.2).translate(4, 24, 3)));
    add(M.ink, T(new THREE.BoxGeometry(2.6, 0.2, 0.2).translate(4, 21, 3)));
    add(M.rustDark, T(cylBetween(new THREE.Vector3(-3, 12, 3), new THREE.Vector3(-15, 18, 6), 0.45, 0.3, 6)));   // crane arm
    add(M.ink, T(cylBetween(new THREE.Vector3(-15, 18, 6), new THREE.Vector3(-15, 9, 6), 0.06, 0.06, 4)));
    add(M.rustDark, T(new THREE.BoxGeometry(1.4, 1, 1.4).translate(-15, 8.6, 6)));
    for (const [a, l] of [[0.3, 10], [2.2, 16], [4.1, 7]]) add(M.steelFlat, T(cylBetween(new THREE.Vector3(Math.cos(a) * 2.5, -4, Math.sin(a) * 2.5), new THREE.Vector3(Math.cos(a) * 3, -4 - l, Math.sin(a) * 3), 0.35, 0.35, 6)));
    add(M.steelFlat, T(new THREE.TorusGeometry(5.6, 0.5, 6, 20).rotateX(Math.PI / 2).translate(0, 4, 0)));
  }
  // the reachable one (static, collidable): hovers low over the dunes by the start
  {
    const [x, z] = TOWER, y = H(x, z) + 30;
    derrick((mat, g) => {
      const solid = mat === M.rustGrid || mat === M.rustDark || mat === M.rust;
      put(mat, g.translate(x, y, z), { solid });
    }, 1);
  }
  // the others drift slowly, far off
  for (const [x, y, z, s, sp] of [[230, 120, -170, 1.6, 0.11], [-280, 160, -400, 2.2, -0.07], [320, 190, -640, 2.6, 0.05], [-210, 95, 170, 1.3, 0.09], [-90, 140, -700, 1.9, -0.06]]) {
    const grp = new THREE.Group();
    const local = new Map();
    derrick((mat, g) => { if (!local.has(mat)) local.set(mat, []); local.get(mat).push(g); }, s);
    for (const [mat, list] of local) grp.add(new THREE.Mesh(mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; })), mat));
    const base = H(x, z) + y;
    grp.position.set(x, base, z);
    grp.userData.noCollide = true;
    scene.add(grp);
    noShadow.push(grp);
    const ph = rng() * 10;
    movers.push((t) => { grp.position.y = base + Math.sin(t * 0.25 + ph) * 3; grp.rotation.y = t * sp; });
  }
  // tall chimney stacks with platforms on the dunes
  for (const [x, z, hh] of [[-150, -90, 64], [140, -260, 80], [-190, -420, 70], [110, 140, 52]]) {
    const b = terrain.baseAt(x, z, 4) - 2;
    put(M.steel, new THREE.CylinderGeometry(2.4, 3.2, hh, 12).translate(x, b + hh / 2, z));
    put(M.rustDark, new THREE.CylinderGeometry(3, 2.6, 3, 12).translate(x, b + hh + 1.5, z));
    for (const f of [0.45, 0.78]) {
      put(M.rust, new THREE.CylinderGeometry(6, 6, 0.8, 16).translate(x, b + hh * f, z));
      put(M.ink, new THREE.TorusGeometry(6, 0.08, 4, 24).rotateX(Math.PI / 2).translate(x, b + hh * f + 1.1, z), { solid: false });
    }
    put(M.pipe2, cylBetween(new THREE.Vector3(x + 4, b, z), new THREE.Vector3(x + 4, b + hh * 0.7, z), 0.8, 0.8, 8));
    put(M.pipe2, elbow(new THREE.Vector3(x + 2.6, b + hh * 0.7, z), 1.4, 0.8, new THREE.Vector3(1, 0, 0), Y, 8));
    put(M.ink, new THREE.CylinderGeometry(0.15, 0.2, 14, 5).translate(x + 1.5, b + hh + 9, z + 1), { solid: false });
  }

  // ======================================================== overhead: the inverted city
  {
    const tag = 'city';
    const add = (i, g) => put(M.city[i], g, { solid: false, tag });
    const cY = CITY_Y;
    add(2, new THREE.CylinderGeometry(330, 300, 36, 40, 1).translate(CITY_C.x, cY + 18, CITY_C.z));
    add(0, new THREE.SphereGeometry(330, 40, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.18, 1).translate(CITY_C.x, cY + 36, CITY_C.z));
    // a dense underside of blocks, tanks and inverted towers tapering to spires;
    // the centre hangs deepest, like an upside-down cathedral
    const towers = [];
    for (let i = 0; i < 420 && towers.length < 150; i++) {
      const a = rng() * TAU, r = Math.pow(rng(), 0.65) * 285;
      const x = CITY_C.x + Math.cos(a) * r, z = CITY_C.z + Math.sin(a) * r;
      const k = 1 - Math.pow(r / 300, 1.6);
      const rr0 = range(9, 22) * (0.6 + 0.6 * k);
      if (towers.some((t) => Math.hypot(t.x - x, t.z - z) < (t.r + rr0) * 0.75)) continue;
      towers.push({ x, z, r: rr0, k });
    }
    for (let i = 0; i < 220; i++) {   // squat blocks packed under the slab
      const a = rng() * TAU, r = Math.sqrt(rng()) * 300;
      const x = CITY_C.x + Math.cos(a) * r, z = CITY_C.z + Math.sin(a) * r;
      const w = range(12, 34), d = range(12, 34), hh = range(10, 40) * (1.2 - r / 330);
      add(i % 3 === 2 ? 2 : i % 2, new THREE.BoxGeometry(w, hh, d).rotateY(rng() * 3).translate(x, cY - hh / 2 + 2, z));
    }
    for (const { x, z, r: r0, k } of towers) {
      let y = cY + 2, rr = r0;
      const total = (50 + rng() * 120) * (0.35 + 1.3 * k * k);
      const mat = Math.floor(rng() * 3), sides = rng() < 0.4 ? 6 : 10;
      const tiers = 2 + Math.floor(rng() * 3);
      for (let t = 0; t < tiers; t++) {
        const th = total / tiers * range(0.7, 1.3);
        add(mat, new THREE.CylinderGeometry(rr, rr * range(0.82, 1), th, sides, 1).translate(x, y - th / 2, z));
        if (rng() < 0.5) {   // side pods and boxes on the shaft
          const sa = rng() * TAU, sr = rr * range(0.35, 0.6);
          add((mat + 1) % 3, new THREE.CylinderGeometry(sr, sr, th * 0.6, 8).translate(x + Math.cos(sa) * rr, y - th * 0.45, z + Math.sin(sa) * rr));
        }
        y -= th;
        const roll = rng();
        if (roll < 0.3) { add(1, new THREE.SphereGeometry(rr * 1.2, 12, 8).scale(1, 0.75, 1).translate(x, y - rr * 0.5, z)); y -= rr * 1.0; }
        else if (roll < 0.65) add(0, new THREE.CylinderGeometry(rr * 1.35, rr * 1.2, 3.5, sides).translate(x, y, z));
        rr *= range(0.6, 0.8);
      }
      const spire = range(1.4, 3.2) * rr;
      add(mat, new THREE.ConeGeometry(rr, spire, sides).rotateX(Math.PI).translate(x, y - spire / 2, z));
      if (rng() < 0.18) {   // a dangling cable or aerial
        const l = range(15, 50);
        add(1, new THREE.CylinderGeometry(0.35, 0.35, l, 4).translate(x + rr * 0.4, y - spire * 0.4 - l / 2, z));
      }
    }
    // pipes slung between the towers
    for (let i = 0; i < 14; i++) {
      const a = rng() * TAU, b = a + range(0.3, 0.9), r0 = range(40, 240), r1 = range(40, 240);
      const p0 = new THREE.Vector3(CITY_C.x + Math.cos(a) * r0, cY - range(10, 60), CITY_C.z + Math.sin(a) * r0);
      const p1 = new THREE.Vector3(CITY_C.x + Math.cos(b) * r1, cY - range(10, 60), CITY_C.z + Math.sin(b) * r1);
      const mid = p0.clone().lerp(p1, 0.5); mid.y -= range(20, 60);
      add(1, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 16, range(0.8, 2), 5));
    }
    // single pods hanging on long cables, swaying
    for (let i = 0; i < 6; i++) {
      const a = rng() * TAU, r = range(60, 260), l = range(120, 220);
      const grp = new THREE.Group();
      grp.position.set(CITY_C.x + Math.cos(a) * r, cY, CITY_C.z + Math.sin(a) * r);
      const parts = [
        new THREE.CylinderGeometry(0.5, 0.5, l, 4).translate(0, -l / 2, 0),
        new THREE.CylinderGeometry(6, 6, 12, 12).translate(0, -l - 6, 0),
        new THREE.SphereGeometry(6, 12, 6, 0, TAU, 0, Math.PI / 2).translate(0, -l, 0),
        new THREE.ConeGeometry(6, 8, 12).rotateX(Math.PI).translate(0, -l - 16, 0),
        new THREE.CylinderGeometry(0.3, 0.3, 14, 4).translate(2, -l - 24, 0),
      ].map((g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; });
      grp.add(new THREE.Mesh(mergeGeometries(parts), M.city[i % 3]));
      const win = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.4).translate(0, -l - 5, 6), M.peach);
      grp.add(win);
      grp.userData.noCollide = true;
      scene.add(grp);
      noShadow.push(grp);
      const ph = rng() * 10;
      movers.push((t) => { grp.rotation.z = Math.sin(t * 0.21 + ph) * 0.025; grp.rotation.x = Math.cos(t * 0.17 + ph) * 0.02; });
    }
  }

  // ======================================================== the horizon: a colossal ring of arches with a town on its rim
  {
    const tag = 'ring', N = 22, PHI = 1.2, deckY = 330, deckT = 70;
    const dirAt = (phi) => new THREE.Vector3(Math.sin(phi), 0, -Math.cos(phi));
    put(M.ring, sectorGeometry(RING_R - 24, RING_R + 30, -PHI - Math.PI / 2, PHI - Math.PI / 2, deckT, 160).translate(RING_C.x, deckY, RING_C.z), { solid: false, tag });
    put(M.city[1], sectorGeometry(RING_R - 27, RING_R - 23, -PHI - Math.PI / 2, PHI - Math.PI / 2, 6, 160).translate(RING_C.x, deckY - deckT + 4, RING_C.z), { solid: false, tag });
    const span = RING_R * (2 * PHI / N) / 2;
    for (let i = 0; i <= N; i++) {
      const phi = -PHI + (i / N) * 2 * PHI, d = dirAt(phi), p = RING_C.clone().addScaledVector(d, RING_R);
      const ph = deckY - deckT + 80;
      put(M.ring, new THREE.BoxGeometry(span * 0.55, ph, 54).rotateY(-phi).translate(p.x, (deckY - deckT - 80) / 2, p.z), { solid: false, tag });
      if (i < N) {
        const ph2 = phi + PHI / N, q = RING_C.clone().addScaledVector(dirAt(ph2), RING_R);
        const ra = span * 0.72;
        // the arch soffit, and solid spandrels filling up to the deck
        put(M.ring, new THREE.TorusGeometry(ra, 7, 6, 20, Math.PI).scale(1, 1.15, 3.6).rotateY(-ph2).translate(q.x, deckY - deckT - ra * 1.15 + 4, q.z), { solid: false, tag });
        // round portholes along the face of the deck
        for (let w = 0; w < 2; w++) {
          const pp = RING_C.clone().addScaledVector(dirAt(phi + (w + 0.5) * (2 * PHI / N) / 2), RING_R - 25);
          const disc = new THREE.CircleGeometry(9, 18).rotateY(-(phi + (w + 0.5) * (2 * PHI / N) / 2)).translate(pp.x, deckY - deckT * 0.5, pp.z);
          put((i + w) % 3 ? M.city[1] : M.peach, disc, { solid: false, tag });
        }
      }
    }
    // the town on the rim: thousands of cream and peach blocks
    const n = 1800, box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const town = new THREE.InstancedMesh(box, M.white, n), dummy = new THREE.Object3D(), col = new THREE.Color();
    const TOWN = ['#f1e6cf', '#e9c09a', '#f3d9b8', '#dcb48e', '#efe2c8', '#d9a07a'];
    for (let i = 0; i < n; i++) {
      const phi = -PHI + rng() * 2 * PHI, r = RING_R - 20 + rng() * 44, d = dirAt(phi);
      const tall = rng() < 0.06;
      dummy.position.copy(RING_C).addScaledVector(d, r).setY(deckY);
      dummy.rotation.set(0, -phi + (rng() - 0.5) * 0.2, 0);
      dummy.scale.set(range(3, 12), tall ? range(30, 70) : range(4, 22), range(3, 12));
      dummy.updateMatrix();
      town.setMatrixAt(i, dummy.matrix);
      town.setColorAt(i, col.set(pick(TOWN)));
    }
    town.userData.noCollide = true;
    town.userData.tiled = true;
    town.computeBoundingSphere();
    scene.add(town);
    noShadow.push(town);
  }

  // ---------------------------------------------------------- merge the buckets
  for (const { mat, solid, tag, geos } of buckets.values()) {
    const list = geos.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n.attributes.uv) n.deleteAttribute('uv');
      if (!n.attributes.normal) n.computeVertexNormals();
      return n;
    });
    const g = mergeGeometries(list);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    if (!solid) m.userData.noCollide = true;
    if (tag) { m.userData.tiled = true; noShadow.push(m); }
    scene.add(m);
  }

  // ---------------------------------------------------------- level description
  const spawn = new THREE.Vector3(0, H(0, 60), 60);
  const inOculus = (x, z) => Math.hypot(x - OX, z - OZ) < OR + 1;
  const inCanyon = (x, z, y) => y < floorAt(z) + 30 && canyonMask(x, z) > 0.5 && z < CZ0 - 30;
  return {
    id: 'buried',
    ground: terrain,
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 1000,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 10.5, preset: 'Moebius print', cloudShadows: 0.35 },
    life: {
      flocks: [{ count: 6, color: '#f3ead2', size: 2.2, radius: 120, height: [40, 90], speed: 0.05, seed: 11 }],
      motes: { count: 140, color: '#e9dcc0', size: 0.05, rise: 0.05, wind: [0.6, 0.2] },
      footprints: '#d6c8a6',
    },
    sky: {
      script: {
        day: ['#b3c4ab', '#f1e8cf', '#8e9fb2', '#fffaf0', '#fff6dc'],     // sage over cream, blue-grey shadows
        dusk: ['#a8ab92', '#f3c39a', '#8a7c9e', '#ffe0c0', '#ffe2b8'],
        night: ['#1e2c34', '#3f5660', '#33485a', '#93aab2', '#f2f0e6'],
      },
      planets: [{ az: 160, el: 20, size: 3.5, color: '#efe8dc' }],
    },
    killY: -Infinity,
    noShadow,
    lights,
    // down in the canyon and the drum, the sun comes in steeper so the floor is lit
    lightAt(p, dir) {
      if ((inCanyon(p.x, p.z, p.y) || (inOculus(p.x, p.z) && p.y < OTOP)) && dir.y > 0.05) { dir.y += 0.8; dir.normalize(); }
    },
    atmo(x, z, y = 0) {
      if (inOculus(x, z) && y < OTOP) return { tint: [0.9, 1.0, 1.02], fog: 0.9, name: 'The oculus' };
      if (inCanyon(x, z, y)) return { tint: [1.05, 0.96, 0.9], fog: 0.85, name: 'The rust canyon' };
      return { tint: [1.0, 1.0, 0.97], fog: 0.7, name: 'The pale dunes' };
    },
    update(dt, t) {
      for (const m of movers) m(t);
    },
  };
}
