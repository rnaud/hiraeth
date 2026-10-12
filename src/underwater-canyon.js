import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise.js';
import { put } from './levels/lab-kit.js';
import { tower, podRing, pod, cafeDome, lampPost, rock, kelp, UW_PAL, TAU } from './levels/underwater-kit.js';

// ---------------------------------------------------------------------------
// The canyon street (the Underwater City, issue #192; docs/systems/worlds.md "The Underwater City's explorations"): the
// city does not stop at the drop, it goes down it. East of the Plaza the sea floor opens into a canyon (CANYON: its floor
// 64 m down, its far wall 70 m off), and from the end of the air bells' walk a street of terraces steps down its west
// side, between the plain's wall and the deep, to the Whale Gallery perched on its shelf at the bottom (GALLERY_SHELF):
//
//   the terraces    TERRACES: five decks a storey apart (0 to -16 m), each a little neighbourhood (lamps getting fewer
//                   as it goes down, planters of glow-kelp, crates, pods lit in the bank behind), a stair between each
//                   and the next, turning back and forth; a glass rail over the deep at their east ends
//   the cafés       two café domes, at the street's head and at its foot (air inside: you breathe there)
//   the bridge      a white arched bridge from the middle terrace across the canyon to the far wall's café terrace
//   the pods        towers of pods rising out of the deep along both walls, lit amber, storey on storey
//   the cable car   a cabin on a cable across the canyon to the north, going back and forth (drawn only)
//   the cage        the divers' cage on its cable from the bottom terrace down to the canyon's floor and back (a doorway,
//                   as the lift is), the floor's bells and the whale bones there
//   the lock        the Gallery's lock off the bottom terrace (src/underwater-seabed.js lock: two doorways)
//
// The bed is shaped before the terrain is made (canyonBed, from src/levels/underwater.js seabed): the plain kept level
// beside the street so its bank rises as the street goes down, the street's own ramp under the terraces, the canyon, and
// the Gallery's shelf. Its own dice (mulberry32(71192)): what the city drew before keeps its draws.
// ---------------------------------------------------------------------------

/** The canyon: its floor's height, the far wall (x where it starts up, where it is up), the head and the tail (z). */
export const CANYON = { floor: -64, wall: 14, east: [176, 192], head: [-30, -46], tail: [-170, -280] };
/** Where the canyon's west wall starts down (x), along z: beside the street, then behind the Gallery's shelf. */
export const westEdge = (z) => (z > -96 ? 124 : z < -122 ? 118 : 124 + ((z + 96) / 26) * 6);
/** The Whale Gallery's shelf: a level of rock round its foot, perched over the canyon. */
export const GALLERY_SHELF = { x: 104, z: -108, y: -17.4, r: 26.5, fall: 7 };
/** The street's ramp under its terraces: from the plain at its head (z) down to under the bottom one; its bank (x). */
export const STREET = { bank: [93, 99], z: [-24, -70], y: -18.4, north: [-128, -140] };

/** The bed with the street's ramp, the canyon and the Gallery's shelf cut into it (h: the bed as it was). */
export function canyonBed(x, z, h) {
  // the street's ramp, east of the plain's bank (the plain itself kept level: its bank rises as the street goes down)
  const ramp = smoothstep(STREET.bank[0], STREET.bank[1], x) * smoothstep(-20, -26, z) * smoothstep(STREET.north[1], STREET.north[0], z);
  if (ramp > 0) h = THREE.MathUtils.lerp(h, STREET.y * smoothstep(STREET.z[0], STREET.z[1], z), ramp);
  // the canyon
  const W = westEdge(z);
  const kx = smoothstep(W, W + CANYON.wall, x) * (1 - smoothstep(CANYON.east[0], CANYON.east[1], x));
  const kz = smoothstep(CANYON.head[0], CANYON.head[1], z) * smoothstep(CANYON.tail[1], CANYON.tail[0], z);
  if (kx * kz > 0) h = THREE.MathUtils.lerp(h, CANYON.floor, kx * kz);
  // the Gallery's shelf
  const S = GALLERY_SHELF, s = 1 - smoothstep(S.r, S.r + S.fall, Math.hypot(x - S.x, z - S.z));
  if (s > 0) h = THREE.MathUtils.lerp(h, S.y, s);
  return h;
}

/** The terraces: their deck's height, middle (z), ends (x) and depth; the stair down from each leaves at its `down` end. */
export const TERRACES = [
  { y: 0, z: -30, x: [99, 121], d: 5, down: 'east', lamps: 4 },
  { y: -3.6, z: -40.5, x: [99, 121], d: 5, down: 'west', lamps: 3 },
  { y: -7.2, z: -50.5, x: [99, 122], d: 5, down: 'east', lamps: 2 },
  { y: -10.8, z: -60.5, x: [99, 121], d: 5, down: 'west', lamps: 1 },
  { y: -16, z: -73, x: [100, 122], d: 8, down: null, lamps: 1 },
];
/** The bridge: from the middle terrace's east end across to the far wall's terrace. */
export const BRIDGE = { y: -7.2, z: -50.5, x: [122, 177], w: 3.2 };
export const FAR_TERRACE = { y: -7.2, z: -50.5, x: [176, 188], d: 11 };
/** The divers' cage: its top on the bottom terrace, its foot on the canyon's floor. */
export const CAGE = { top: [119.5, -16, -73], foot: [141, -66] };
/** Each terrace's dressing: [x, z] of its planter of glow-kelp, its crates, its bench. */
const DRESS = [
  { planter: [112, -31.7], crates: [106, -28.5] }, { planter: [113, -42.2], bench: [110, -38.8] }, { planter: [110, -52.2], crates: [106, -48.6] },
  { planter: [112, -62.2], bench: [110, -58.8] }, {},
];

const NS = { solid: false, shadow: false }, SOLID = { solid: true, shadow: true };

/**
 * The canyon street (kit: the city's kit, M its materials, H the ground). Returns { terraces, cafes (their air),
 * stairs: [{ top, foot }], bridge, far, cage: { top, foot }, sights, line (the street's points, head to foot), update(t) }.
 */
export function buildCanyonStreet(kit, M, H) {
  const rng = mulberry32(71192);
  const white = kit.mat({ color: '#ece4d4', flat: true, weathered: 0.2 });
  const railGlass = kit.mat({ color: UW_PAL.domeGlass, glass: true, glassCenter: new THREE.Vector3(150, -10, -60), line: 0.5, lineTint: 0.7, side: THREE.DoubleSide });
  const brass = kit.mat({ color: '#c9974a', flat: true, metal: 'brass' });
  const out = { terraces: [], cafes: [], stairs: [], sights: [], line: [], movers: [] };

  // ---- the terraces: a deck, piers down to the ramp under it, lamps, a rail over the deep at the east end
  const deck = (x0, x1, z0, z1, y, mat = M.street) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    kit.add(mat, new THREE.BoxGeometry(w, 0.6, d).translate(cx, y - 0.3, cz), SOLID);
    kit.add(M.rim, new THREE.BoxGeometry(w + 0.2, 0.12, 0.2).translate(cx, y - 0.62, z1), NS);   // (its lip, drawn)
    for (let x = x0 + 1.2; x <= x1 - 1.1; x += Math.max(4, (w - 2.4) / Math.ceil((w - 2.4) / 6))) for (const z of [z0 + 0.8, z1 - 0.8]) {
      const g = H(x, z), h = y - 0.6 - g;
      if (h > 0.3) kit.add(M.pier, new THREE.CylinderGeometry(0.35, 0.5, h + 0.6, 8).translate(x, g - 0.3 + (h + 0.6) / 2, z), SOLID);
    }
  };
  const rail = (ax, az, bx, bz, y) => {
    const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    kit.add(railGlass, put(new THREE.BoxGeometry(0.06, 1.0, L), cx, y + 0.5, cz, yaw), { solid: true, shadow: false });
    kit.add(brass, put(new THREE.BoxGeometry(0.12, 0.1, L + 0.1), cx, y + 1.05, cz, yaw), NS);
    for (let s = 0; s <= L; s += 2.5) kit.add(brass, new THREE.CylinderGeometry(0.04, 0.04, 1.05, 5).translate(ax + ((bx - ax) * s) / L, y + 0.52, az + ((bz - az) * s) / L), NS);
  };
  for (const [i, T] of TERRACES.entries()) {
    const z0 = T.z - T.d / 2, z1 = T.z + T.d / 2;
    deck(T.x[0], T.x[1], z0, z1, T.y, i % 2 ? M.streetPale : M.street);
    // the rail over the deep, but where the bridge leaves
    if (i === 2) { rail(T.x[1], z0, T.x[1], BRIDGE.z - BRIDGE.w / 2, T.y); rail(T.x[1], BRIDGE.z + BRIDGE.w / 2, T.x[1], z1, T.y); }
    else rail(T.x[1], z0, T.x[1], z1, T.y);
    // lamps, fewer as the street goes down
    for (let k = 0; k < T.lamps; k++) lampPost(kit, M, T.x[0] + 3 + ((T.x[1] - T.x[0] - 6) * (k + 0.5)) / T.lamps, T.y, z1 - 0.6, { h: 3.2, r: 7 });
    // a planter of glow-kelp, crates, a bench: each a little neighbourhood
    const D = DRESS[i];
    if (D.planter) {
      const [px, pz] = D.planter;
      kit.add(M.pier, new THREE.BoxGeometry(2.2, 0.7, 1.0).translate(px, T.y + 0.35, pz), SOLID);
      kit.add(M.column, new THREE.BoxGeometry(2.0, 0.05, 0.8).translate(px, T.y + 0.72, pz), NS);
      kelp(kit, M, rng, [px, T.y + 0.7, pz], { n: 4, h: 2 + rng() * 1.5, spread: 1.2 });
    }
    if (D.crates) for (const [dx, s] of [[0, 0.9], [1.1, 0.7]]) kit.add(M.rim, new THREE.BoxGeometry(s * 1.2, s, s).translate(D.crates[0] + dx, T.y + s / 2, D.crates[1]), SOLID);
    if (D.bench) kit.add(M.rim, new THREE.BoxGeometry(2.4, 0.45, 0.6).translate(D.bench[0], T.y + 0.22, D.bench[1]), SOLID);
    out.terraces.push({ ...T, z0, z1 });
  }
  // the bottom terrace runs on north to the Gallery's lock
  {
    const T = TERRACES.at(-1);
    deck(103, 112, T.z - T.d / 2 - 4.3, T.z - T.d / 2 + 0.1, T.y, M.street);
    rail(112, T.z - T.d / 2 - 4.3, 112, T.z - T.d / 2, T.y);
  }
  // the stairs: down from each terrace's `down` end to the next one's
  for (let i = 0; i + 1 < TERRACES.length; i++) {
    const A = TERRACES[i], B = TERRACES[i + 1], x = A.down === 'east' ? A.x[1] - 3 : A.x[0] + 3;
    const top = A.z - A.d / 2, foot = B.z + B.d / 2, n = Math.max(1, Math.round((A.y - B.y) / 0.3)), run = (top - foot) / n, dr = (A.y - B.y) / n;
    for (let k = 0; k < n; k++) {
      const z = top - (k + 0.5) * run, y = A.y - (k + 1) * dr;
      kit.add(M.pier, new THREE.BoxGeometry(3, y - B.y + 0.6, run + 0.02).translate(x, (y + B.y - 0.6) / 2, z), SOLID);
    }
    for (const e of [-1, 1]) {
      const pts = [new THREE.Vector3(x + e * 1.6, A.y + 1.0, top), new THREE.Vector3(x + e * 1.6, B.y + 1.0, foot)];
      kit.add(brass, new THREE.TubeGeometry(new THREE.LineCurve3(...pts), 4, 0.05, 4), NS);
    }
    out.stairs.push({ top: [x, A.y, top], foot: [x, B.y, foot] });
  }

  // ---- the cafés at the head and the foot (their air: you breathe in them), people at their tables
  const cafes = [
    cafeDome(kit, M, rng, { x: 92, y: H(92, -31) + 0.05, z: -31, r: 5.2, sy: 0.85, shell: 'pink', doorYaw: Math.PI / 2, windows: [{ yaw: Math.PI / 2 + 0.9, w: 3.5, y0: 0.6, y1: 3.4 }, { yaw: Math.PI * 0.05, w: 3.5, y0: 0.6, y1: 3.4 }], tables: 4, people: 3 }),
    cafeDome(kit, M, rng, { x: 111, y: TERRACES.at(-1).y, z: -73.5, r: 3.4, sy: 0.9, shell: 'glass', doorYaw: Math.PI, tables: 2, people: 2 }),
  ];
  out.cafes = cafes;

  // ---- the bank behind the street: pods lit in it, storey on storey, and rock
  for (const [i, T] of TERRACES.entries()) {
    if (i === 0) continue;
    const y = T.y + 0.6, z = T.z + (rng() - 0.5) * 2;
    pod(kit, M, rng, { x: 94.5, y, z, R: 3.2, H: 3.0, kind: 'dome', lit: true, plants: 0 });
    rock(kit, M, 95.5, T.y - 1.5, T.z + 5.5, 2.4, 300 + i);
  }

  // ---- the bridge: a white arch from the middle terrace across the deep to the far wall
  {
    const B = BRIDGE, x0 = B.x[0], x1 = B.x[1], L = x1 - x0;
    kit.add(white, new THREE.BoxGeometry(L, 0.6, B.w).translate((x0 + x1) / 2, B.y - 0.3, B.z), SOLID);
    for (const e of [-1, 1]) {
      kit.add(white, new THREE.BoxGeometry(L, 0.9, 0.25).translate((x0 + x1) / 2, B.y + 0.45, B.z + e * (B.w / 2 - 0.12)), SOLID);   // (its parapets)
      // the arch under it, springing from either wall
      const spring = -30, pts = [];
      for (let k = 0; k <= 24; k++) { const t = k / 24, x = x0 + 2 + (L - 4) * t; pts.push(new THREE.Vector3(x, spring + (B.y - 1.4 - spring) * Math.sin(Math.PI * t) ** 0.55, B.z + e * 1.1)); }
      kit.add(white, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.55, 6), SOLID);
    }
    // the spandrels: posts from the arch up to the deck
    for (let k = 1; k < 12; k++) {
      const t = k / 12, x = x0 + 2 + (L - 4) * t, ya = -30 + (B.y - 1.4 + 30) * Math.sin(Math.PI * t) ** 0.55;
      if (B.y - 0.6 - ya > 0.4) kit.add(white, new THREE.BoxGeometry(0.4, B.y - 0.6 - ya, B.w - 0.6).translate(x, (ya + B.y - 0.6) / 2, B.z), SOLID);
    }
    for (let x = x0 + 6; x < x1 - 2; x += 12) lampPost(kit, M, x, B.y + 0.9, B.z + B.w / 2 - 0.12, { h: 1.6, r: 6 });
    out.bridge = { a: [x0, B.y, B.z], b: [x1, B.y, B.z] };
  }
  // the far wall's terrace: its café and a bell (src/underwater-seabed.js places the bell at out.far.bell)
  {
    const F = FAR_TERRACE, z0 = F.z - F.d / 2, z1 = F.z + F.d / 2;
    deck(F.x[0], F.x[1], z0, z1, F.y, M.streetPale);
    rail(F.x[0], z0, F.x[0], BRIDGE.z - BRIDGE.w / 2, F.y); rail(F.x[0], BRIDGE.z + BRIDGE.w / 2, F.x[0], z1, F.y);
    cafes.push(cafeDome(kit, M, rng, { x: 183.4, y: F.y, z: F.z - 1.5, r: 3.3, sy: 0.9, shell: 'teal', doorYaw: -Math.PI / 2, windows: [{ yaw: -Math.PI / 2 + 1.0, w: 2.6, y0: 0.6, y1: 2.8 }], tables: 2, people: 2 }));
    lampPost(kit, M, 179, F.y, z1 - 0.8, { h: 3.2, r: 7 });
    out.far = { at: [181, F.y, F.z], bell: [179.5, F.y, z1 - 2.4] };
  }

  // ---- the pods down the drop: towers rising out of the deep along both walls
  // (against the walls, their pods out over the deep: the middle of the canyon clear for the whales; their tops under the
  // street's and the far terrace's level, so they rise toward you from below)
  const towers = [
    { x: 178, z: -55, h: 54, r: 4.4 }, { x: 130, z: -62, h: 48, r: 4.8 }, { x: 127, z: -150, h: 50, r: 5 }, { x: 127, z: -186, h: 44, r: 4.4 },
    { x: 178, z: -34, h: 60, r: 5.4 }, { x: 178, z: -76, h: 62, r: 5.8 }, { x: 178, z: -104, h: 56, r: 5 }, { x: 178, z: -132, h: 64, r: 6 }, { x: 178, z: -166, h: 58, r: 5.4 },
  ];
  for (const [i, t] of towers.entries()) {
    const y0 = H(t.x, t.z) - 0.4;
    t.h = Math.max(20, Math.min(t.h, (t.x < 150 ? -10 : -4) - y0));
    const pods = podRing(rng, { h: t.h, y0, n: Math.round(t.h / 9), rr: t.r * 0.8, from: 6, a0: t.x < 150 ? Math.PI * 0.1 : Math.PI * 1.1, spread: 1.4 });
    // (turned to the canyon's middle; a tower's pods stand out over the deep, not into its wall)
    for (const p of pods) p.a = (t.x < 150 ? 0 : Math.PI) + (rng() - 0.5) * 2.4;
    tower(kit, M, rng, { x: t.x, z: t.z, y0, h: t.h, r: t.r, top: ['dome', 'spire', 'flat'][i % 3], pods, lit: 0.5, windows: 0.7 });
  }
  out.towers = towers;

  // ---- the cable car: a cabin on a cable across the canyon to the north, back and forth (drawn only)
  {
    const A = new THREE.Vector3(122, 2, -140), B = new THREE.Vector3(190, 4, -112);
    for (const P of [A, B]) {
      kit.add(M.frame, new THREE.CylinderGeometry(0.25, 0.35, 8, 6).translate(P.x, P.y - 4 + 4, P.z), NS);
      kit.add(M.frame, new THREE.BoxGeometry(1.6, 0.3, 0.3).translate(P.x, P.y + 4, P.z), NS);
    }
    const a = A.clone().setY(A.y + 4), b = B.clone().setY(B.y + 4), sag = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).setY(Math.min(a.y, b.y) - 6), b);
    kit.add(M.post, new THREE.TubeGeometry(sag, 30, 0.05, 4), NS);
    const cab = new THREE.Group();
    cab.name = 'The cable car';
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10).scale(1, 0.85, 1), M.shell.pink);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.7, 14, 1, true), M.glass);
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 4).translate(0, 2.0, 0), M.post);
    cab.add(body, band, hang);
    cab.traverse((o) => { o.userData.noCollide = true; o.userData.floats = true; });
    kit.group.add(cab);
    kit.noShadow.push(body, band, hang);
    kit.mover((t) => { const u = 0.5 - 0.5 * Math.cos(t * 0.05); const p = sag.getPoint(0.08 + u * 0.84); cab.position.set(p.x, p.y - 2.8, p.z); });
    out.cable = { a: [a.x, a.y, a.z], b: [b.x, b.y, b.z] };
  }

  // ---- the divers' cage: its crane on the bottom terrace, its cable down to the floor, a cage at each end (drawn)
  {
    const [tx, ty, tz] = CAGE.top, [fx, fz] = CAGE.foot, fy = H(fx, fz);
    kit.add(M.frame, new THREE.BoxGeometry(0.4, 5, 0.4).translate(tx + 1.2, ty + 2.5, tz + 2.2), SOLID);
    kit.add(M.frame, new THREE.BoxGeometry(0.3, 0.3, 0.3).translate(tx + 1.2, ty + 5, tz + 2.2), NS);
    kit.add(M.post, new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(tx + 1.2, ty + 5, tz + 2.2), new THREE.Vector3(fx, fy + 4.2, fz)), 8, 0.04, 4), NS);
    for (const [x, y, z] of [[tx, ty, tz], [fx, fy, fz]]) {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; kit.add(brass, new THREE.CylinderGeometry(0.04, 0.04, 2.6, 4).translate(x + Math.sin(a) * 1.0, y + 1.3, z + Math.cos(a) * 1.0), NS); }
      for (const yy of [0.05, 2.6]) kit.add(brass, new THREE.TorusGeometry(1.0, 0.06, 4, 16).rotateX(Math.PI / 2).translate(x, y + yy, z), NS);
      kit.light(x, y + 2.2, z, 5);
    }
    out.cage = { top: [tx, ty, tz], foot: [fx, fy, fz] };
  }
  // the whale bones on the canyon's floor, beside the cage's foot: a spine and its ribs, white in the dark
  {
    const [fx, fz] = CAGE.foot, bx = fx + 9, bz = fz - 14;
    const spine = [];
    for (let k = 0; k <= 16; k++) { const s = k / 16; spine.push(new THREE.Vector3(bx + Math.sin(s * 2) * 2, H(bx, bz - 22 + s * 44) + 0.4, bz - 22 + s * 44)); }
    kit.add(white, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spine), 40, 0.35, 6), SOLID);
    for (let k = 2; k < 12; k++) {
      const p = spine[k], h = 3.2 - Math.abs(k - 6) * 0.2;
      for (const e of [-1, 1]) {
        const rib = new THREE.QuadraticBezierCurve3(p.clone(), p.clone().add(new THREE.Vector3(e * 2.4, h, 0)), p.clone().add(new THREE.Vector3(e * 3.4, -0.4, 0.6)));
        kit.add(white, new THREE.TubeGeometry(rib, 10, 0.16, 5), NS);
      }
    }
    out.bones = [bx, H(bx, bz), bz];
  }
  // a little kelp and rock down the walls
  for (let i = 0; i < 18; i++) {
    const z = -40 - rng() * 150, west = rng() < 0.5, x = west ? westEdge(z) + 4 + rng() * 8 : CANYON.east[0] + 2 + rng() * 10, g = H(x, z);
    if (i % 2) kelp(kit, M, rng, [x, g, z], { n: 4, h: 6 + rng() * 6 });
    else rock(kit, M, x, g, z, 2 + rng() * 3, 400 + i);
  }

  // what the audit stops for, and the street's line from its head to the Gallery's lock
  const T = TERRACES;
  out.sights.push(
    { name: 'the bridge over the canyon', at: [150, BRIDGE.y, BRIDGE.z] },
    { name: 'the far wall’s café', at: out.far.at },
    { name: 'the whale bones on the canyon’s floor', at: out.bones },
  );
  for (let i = 0; i < T.length; i++) {
    const A = T[i], s = out.stairs[i];
    const enter = i === 0 ? [A.x[0] + 2, A.y, A.z] : [out.stairs[i - 1].foot[0], A.y, A.z];
    out.line.push(enter);
    if (s) out.line.push([s.top[0], A.y, A.z], s.top, s.foot);
  }
  out.line.push([105.5, T.at(-1).y, -78], [107.3, T.at(-1).y, -80.6]);
  out.head = [104, 0, T[0].z];   // (where the bells' walk comes out: the main quest's step, src/story/underwater-ways.js)
  return out;
}
