import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { jitter, soften } from '../world.js';
import { attachTemple } from '../temples/index.js';
import { stepped } from '../load-steps.js';
import { tagMetal } from '../gadgets/metal.js';

// ---------------------------------------------------------------------------
// The Sealed Hangar: Major Brask's pocket universe.
// Three zones linked by portals, each with its own gravity and ink style:
//   A  Brask's plateau   normal gravity, a floating island
//   B  The upside-down     gravity pulls you *up* under a slab   (Animated ink)
//   C  The ring            a cylinder habitat lit through a slit,
//                          gravity points outward from the axis    (Sable)
// ---------------------------------------------------------------------------

const B_POS = new THREE.Vector3(0, 900, 3000);   // the upside-down slab's walking surface
const C_POS = new THREE.Vector3(3000, 0, 0);     // the ring's centre (axis along x)
const RING_R = 150;
const RING_L = 420;
const SLIT = 0.35;                                // half-angle of the roof slit

// (October 2026 colour pass: the Hangar's people are drawn in dusty tones on cream, a faded blue, mustard, lilac,
//  coral, olive; the world's paint was a toy-box's pure hues. Each colour kept its place, a step greyer and warmer.)
export const PALETTE = ['#d48e94', '#86b0b2', '#d8aa50', '#a9a0c8', '#f3ead8', '#d27b5e', '#a8b48c', '#c9603e'];
const Y = new THREE.Vector3(0, 1, 0);

/** Radial frame of the ring at an angle phi around the x axis (phi = 0 -> +z, pi/2 -> +y). */
const ringDir = (phi) => new THREE.Vector3(0, Math.sin(phi), Math.cos(phi));

/**
 * The ring's skin turned to face the axis, where you walk. Collision reads a
 * face's front as its open side (physics.embedded): with the cylinder's own
 * outward faces, everywhere inside the ring looked like the inside of a solid,
 * and a ray grazing an end rim was enough to "unstick" a flier through the skin.
 */
export function facingIn(g) {
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return g;
}

// the story's places (src/story/garage.js), kept clear of the random buildings
const BOARD = new THREE.Vector3(-13, 0, 98);          // A: the signal board by the path from the start
const B_RELAY = new THREE.Vector3(9, 0, 14);          // B: slab-local (y down into the quarter): the relay box
const B_DESK = new THREE.Vector3(-140, 0, 72);        // B: slab-local: the Major's old desk, out near the edge
const B_PUMP = new THREE.Vector3(42, 0, -18);         // B: slab-local: the lamp pump
const C_TURBINE = new THREE.Vector3(2905, 0, -22);    // C: on the ring floor near its entrance (x, -, z)

// A little building kit, authored in local space (y up, base at y = 0): geometry parts,
// drawn with the level's rng (createGarage; the Lab's Hangar room builds with it too).
export function hangarHouse(rng, parts = []) {
  const w = 6 + rng() * 8, d = 6 + rng() * 8, h = 6 + rng() * 14;
  parts.push(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).toNonIndexed());
  const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 4 + rng() * 6, 4).rotateY(Math.PI / 4).translate(0, h + 2.5, 0);
  parts.push(roof.toNonIndexed());
  return parts;
}
export function hangarTower(rng, parts = []) {
  const r = 3 + rng() * 4, h = 20 + rng() * 40;
  parts.push(soften(new THREE.CylinderGeometry(r * 0.9, r, h, 10, 5), 0.1).translate(0, h / 2, 0).toNonIndexed());
  if (rng() < 0.5) parts.push(new THREE.ConeGeometry(r * 1.3, r * 2.5, 10).translate(0, h + r * 1.2, 0).toNonIndexed());
  else parts.push(new THREE.SphereGeometry(r * 1.4, 12, 8).scale(1, 0.8, 1).translate(0, h + r, 0).toNonIndexed());
  return parts;
}
export function hangarMachine(rng, parts = []) {
  // pipes and a gear: Moebius' melting machinery
  const r = 4 + rng() * 6;
  parts.push(new THREE.TorusGeometry(r, 0.9, 6, 18).rotateY(rng() * 3).translate(0, r, 0).toNonIndexed());
  const p0 = new THREE.Vector3(-r * 2, 0.8, 0), p3 = new THREE.Vector3(r * 2, 0.8, rng() * 8 - 4);
  const curve = new THREE.CubicBezierCurve3(p0, new THREE.Vector3(-r, r * 2.5, 2), new THREE.Vector3(r, -1, -2), p3);
  parts.push(new THREE.TubeGeometry(curve, 24, 0.8 + rng() * 0.8, 7).toNonIndexed());
  return parts;
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildGarage(scene) {
  const rng = mulberry32(1976);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const movers = [];
  const portals = [];
  const machines = {};   // stopped until the story starts them: { pos, radius, speed, target, spin(angle) }
  const noShadow = [];
  const stone = (size = 3) => makeMaterial({ color: pick(PALETTE), color2: pick(PALETTE), color3: '#f3ead8', mode: MODE_STRATA, strataSize: size, flat: true });

  const house = (parts) => hangarHouse(rng, parts), tower = (parts) => hangarTower(rng, parts), machine = (parts) => hangarMachine(rng, parts);
  const kit = [house, house, tower, machine];
  /** Place a random building at `pos`, with its up along `up`. */
  function build(pos, up, group = scene) {
    const fn = pick(kit), g = mergeGeometries(fn());
    const st = stone(2 + rng() * 3);
    // the machines are painted metal, the houses and towers stone
    const m = new THREE.Mesh(g, fn === machine ? makeMaterial({ color: `#${st.uniforms.uColor.value.getHexString()}`, flat: true, metal: 'painted' }) : st);
    m.quaternion.setFromUnitVectors(Y, up).multiply(new THREE.Quaternion().setFromAxisAngle(Y, rng() * 6));
    m.position.copy(pos);
    group.add(m);
    return m;
  }

  function portal(pos, up, facing, to, toUp, toFwd, zone) {
    const label = { A: 'portal to the plateau', B: 'portal to the upside-down', C: 'portal to the ring' }[zone];   // "Through the …" on the HUD
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 8, 32), makeMaterial({ color: '#d8aa50', glow: 1 }));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(4.3, 32), makeMaterial({ color: '#86b0b2', glow: 0.8, side: THREE.DoubleSide }));
    const grp = new THREE.Group();
    grp.add(ring, inner);
    // torus lies in its local xy-plane: point its normal (z) along `facing`, keep `up` as y
    const z = facing.clone().normalize(), x = new THREE.Vector3().crossVectors(up, z).normalize();
    grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up.clone().normalize(), z));
    grp.position.copy(pos).addScaledVector(up, 5.5);
    grp.userData.noCollide = true;
    scene.add(grp);
    portals.push({ pos: grp.position.clone(), to, toUp, toFwd, label, zone });
    movers.push((t) => { inner.rotation.z = t * 0.6; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.03); });
  }

  // ======================================================== A: Brask's plateau
  yield;
  {
    const g = new THREE.CylinderGeometry(210, 120, 70, 30, 6);
    g.translate(0, -35, 0);
    jitter(g, 0.12, 0.01, 4);
    scene.add(new THREE.Mesh(g, makeMaterial({ color: '#d8d4a8', color2: '#b8a682', color3: '#ead9b2', mode: MODE_STRATA, strataSize: 7, flat: true, pattern: 'cracks' })));
    // a keep with walls and corner towers
    const keep = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, r = 34;
      keep.push(new THREE.CylinderGeometry(6, 7, 34, 10).translate(Math.cos(a) * r, 17, Math.sin(a) * r).toNonIndexed());
      keep.push(new THREE.ConeGeometry(8.5, 12, 10).translate(Math.cos(a) * r, 40, Math.sin(a) * r).toNonIndexed());
      const b = a + Math.PI / 2;
      const mid = new THREE.Vector3((Math.cos(a) + Math.cos(b)) * r / 2, 7, (Math.sin(a) + Math.sin(b)) * r / 2);
      const wall = new THREE.BoxGeometry(r * 1.35, 14, 3).rotateY(-Math.atan2(mid.z, mid.x) + Math.PI / 2).translate(mid.x, mid.y, mid.z);
      if (i !== 1) keep.push(wall.toNonIndexed()); // a gap to walk in
    }
    keep.push(new THREE.CylinderGeometry(12, 14, 46, 12).translate(0, 23, 0).toNonIndexed());
    keep.push(new THREE.SphereGeometry(14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 46, 0).toNonIndexed());
    scene.add(new THREE.Mesh(mergeGeometries(keep), stone(3)));
    for (let i = 0; i < 30; i++) {
      const a = rng() * Math.PI * 2, r = 60 + rng() * 120;
      build(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), Y);
    }
    // a windmill-machine with turning blades
    const mill = new THREE.Group();
    mill.position.set(-90, 0, 60);
    mill.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 30, 8).translate(0, 15, 0), stone(4)));
    const blades = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(36, 2.5, 0.6), new THREE.BoxGeometry(2.5, 36, 0.6),
    ]), makeMaterial({ color: '#f3ead8', flat: true, grid: 2 }));
    blades.position.set(0, 30, 5);
    blades.userData.noCollide = true;
    mill.add(blades);
    scene.add(mill);
    machines.mill = { group: mill, pos: new THREE.Vector3(-90, 30, 65), radius: 17, speed: 0, target: 0, spin: (a) => { blades.rotation.z = a * 0.5; } };
    // stepping-stone islands around the plateau
    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2, r = 230 + rng() * 120;
      const ig = new THREE.ConeGeometry(12 + rng() * 10, 30, 8).rotateX(Math.PI).translate(0, -15, 0);
      jitter(ig, 0.2, 0.05, rng() * 9);
      const isl = new THREE.Mesh(ig, stone(3));
      isl.position.set(Math.cos(a) * r, -20 + rng() * 60, Math.sin(a) * r);
      scene.add(isl);
    }
  }

  // ---------------------------------------------------------- the plateau's clutter
  // Brask's asteroid is a tangle of plumbing: pipes snaking over the ground
  // with valve wheels and pumps, cables slung between the towers, aerials and
  // little cabins everywhere. Kept off the path from the start to the keep.
  yield;
  {
    const clear = (x, z) => Math.abs(x) < 16 && z > 20 && z < 150;
    const pipeMats = ['#d27b5e', '#86b0b2', '#a9a0c8', '#d8aa50'].map((c) => makeMaterial({ color: c, metal: 'painted' }));
    const brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' }), ink = makeMaterial({ color: '#34405e', metal: 'iron' });
    const pipes = new Map(), bits = [], pumps = [];
    for (let i = 0; i < 26; i++) {
      const pts = [];
      let a = rng() * Math.PI * 2, r = 50 + rng() * 140;
      for (let k = 0; k < 6; k++) {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        pts.push(new THREE.Vector3(x, 0.7 + (k % 3 === 1 ? 2 + rng() * 5 : 0), z));
        a += (rng() - 0.5) * 0.4; r = THREE.MathUtils.clamp(r + (rng() - 0.5) * 40, 45, 195);
      }
      if (pts.some((p) => clear(p.x, p.z))) continue;
      const rad = 0.5 + rng() * 0.7, mat = pick(pipeMats);
      if (!pipes.has(mat)) pipes.set(mat, []);
      pipes.get(mat).push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, rad, 8).toNonIndexed());
      for (const p of [pts[1], pts[4]]) {   // a valve wheel and a pump on each run
        bits.push(new THREE.TorusGeometry(rad * 1.8, 0.15, 5, 14).rotateX(Math.PI / 2).translate(p.x, p.y + rad + 0.6, p.z).toNonIndexed());
        bits.push(new THREE.CylinderGeometry(rad * 1.6, rad * 1.8, 2.4, 10).translate(p.x, 1.2, p.z + 0.01).toNonIndexed());
        pumps.push(new THREE.Vector3(p.x, 1.6, p.z));
      }
    }
    for (const [mat, list] of pipes) scene.add(new THREE.Mesh(mergeGeometries(list), mat));
    // (the brass pumps are the makers' metal: the magnet glove pulls you to them, src/gadgets/metal.js)
    scene.add(tagMetal(new THREE.Mesh(mergeGeometries(bits), brass), { points: pumps, radius: 1 }));
    // aerials with dishes, and little cabins
    const huts = [];
    for (let i = 0; i < 24; i++) {
      const a = rng() * Math.PI * 2, r = 50 + rng() * 150, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (clear(x, z)) continue;
      if (i % 2) {
        const h = 10 + rng() * 18;
        huts.push(new THREE.CylinderGeometry(0.2, 0.3, h, 5).translate(x, h / 2, z).toNonIndexed());
        huts.push(new THREE.SphereGeometry(2.2, 12, 6, 0, Math.PI * 2, 0, 1.1).rotateX(-0.9).translate(x, h, z).toNonIndexed());
        huts.push(new THREE.BoxGeometry(3, 0.15, 0.15).translate(x, h * 0.7, z).toNonIndexed());
      } else {
        const w = 3 + rng() * 2, hh = 3 + rng() * 2;
        huts.push(new THREE.BoxGeometry(w, hh, w).rotateY(rng() * 3).translate(x, hh / 2, z).toNonIndexed());
        huts.push(new THREE.SphereGeometry(w * 0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, hh, z).toNonIndexed());
        huts.push(new THREE.CylinderGeometry(0.25, 0.25, 2.5, 6).translate(x + w * 0.3, hh + 1.6, z).toNonIndexed());
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(huts), stone(2)));
    // cables slung from the keep's towers out to the masts
    const cables = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, top = new THREE.Vector3(Math.cos(a) * 34, 44, Math.sin(a) * 34);
      for (let k = 0; k < 3; k++) {
        const b = a + (k - 1) * 0.5, r = 120 + k * 25, end = new THREE.Vector3(Math.cos(b) * r, 22 + k * 4, Math.sin(b) * r);
        const mid = top.clone().lerp(end, 0.5); mid.y -= 10;
        cables.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(top, mid, end), 20, 0.12, 4).toNonIndexed());
        cables.push(new THREE.CylinderGeometry(0.35, 0.5, end.y, 6).translate(end.x, end.y / 2, end.z).toNonIndexed());
      }
    }
    const cm = new THREE.Mesh(mergeGeometries(cables), ink);
    cm.userData.noCollide = true;
    scene.add(cm);
  }

  // ---------------------------------------------------------- the signal board: nine lamps that blink the signal
  yield;
  const board = { lamps: [], pos: BOARD.clone() };
  yield;
  {
    const ink = makeMaterial({ color: '#34405e', flat: true, metal: 'painted' });
    const parts = [new THREE.BoxGeometry(0.3, 5.2, 0.3).translate(-1.6, 2.6, 0), new THREE.BoxGeometry(0.3, 5.2, 0.3).translate(1.6, 2.6, 0),
      new THREE.BoxGeometry(3.8, 3.2, 0.4).translate(0, 4.6, 0), new THREE.CylinderGeometry(0.1, 0.1, 2.2, 5).translate(1.2, 7.3, 0)];
    const g = new THREE.Mesh(mergeGeometries(parts.map((q) => q.toNonIndexed())), ink);
    g.position.copy(BOARD); g.rotation.y = 0.5;
    scene.add(tagMetal(g, { points: [[0, 4.6, 0.2]], radius: 0.6 }));   // (its painted iron face: the magnet pulls you up to it)
    for (let i = 0; i < 9; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), makeMaterial({ color: '#70858c', flat: true }));
      lamp.position.set(((i % 3) - 1) * 1.05, 4.6 + (1 - Math.floor(i / 3)) * 0.95, 0.3);
      lamp.userData.noCollide = true;
      g.add(lamp);
      board.lamps.push(lamp);
    }
    board.face = new THREE.Vector3(Math.sin(0.5), 0, Math.cos(0.5));
  }
  let glyphAt = null;

  // ---------------------------------------------------------- hero: the great machine
  // A cathedral of gears turning round a column, pistons pumping at its base.
  yield;
  {
    const mx = 90, mz = -60;
    const col = new THREE.Mesh(soften(new THREE.CylinderGeometry(6, 9, 80, 14, 8), 0.12).translate(0, 40, 0), stone(5));
    col.position.set(mx, 0, mz);
    scene.add(col);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 10).scale(1, 0.7, 1), makeMaterial({ color: '#d8aa50', grid: 3, metal: 'brass' }));
    crown.position.set(mx, 82, mz);
    scene.add(crown);
    const gearMat = makeMaterial({ color: '#c9603e', flat: true, grid: 2, metal: 'copper' });
    for (let i = 0; i < 5; i++) {
      const r = 12 + i * 3 + rng() * 4;
      const gear = new THREE.Group();
      gear.position.set(mx, 12 + i * 14, mz);
      gear.add(new THREE.Mesh(new THREE.TorusGeometry(r, 1.4, 6, 40).rotateX(Math.PI / 2), gearMat));
      for (let k = 0; k < 14; k++) { // teeth
        const a = (k / 14) * Math.PI * 2;
        gear.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4).translate(Math.cos(a) * (r + 1.8), 0, Math.sin(a) * (r + 1.8)), gearMat));
      }
      for (let k = 0; k < 3; k++) // spokes
        gear.add(new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.8, 0.8).rotateY((k / 3) * Math.PI), makeMaterial({ color: '#34405e', flat: true, metal: 'iron' })));
      gear.userData.noCollide = true;
      scene.add(gear);
      const sp = (i % 2 ? -1 : 1) * (0.15 + rng() * 0.15);
      movers.push((t) => { gear.rotation.y = t * sp; });
    }
    // the Major's mark on the column: three rivets over an arc, on a brass plate
    {
      const plate = [new THREE.CylinderGeometry(2.6, 2.6, 0.4, 20).rotateX(Math.PI / 2)];
      for (const dx of [-1.1, 0, 1.1]) plate.push(new THREE.SphereGeometry(0.34, 8, 6).translate(dx, 0.7 + (dx ? 0 : 0.25), 0.3));
      plate.push(new THREE.TorusGeometry(1.35, 0.16, 5, 14, Math.PI).translate(0, -1.1, 0.25));
      const pm = new THREE.Mesh(mergeGeometries(plate.map((g) => g.toNonIndexed())), makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' }));
      pm.position.set(mx, 22, mz + 8.4);
      scene.add(tagMetal(pm, { points: [[0, 0, 0]], radius: 0.4 }));   // (the brass plate high on the column: pulled up to it, you take hold of the column)
      glyphAt = pm.position.clone().add(new THREE.Vector3(0, -22, 4));
    }
    for (let k = 0; k < 6; k++) { // pistons
      const a = (k / 6) * Math.PI * 2, px = mx + Math.cos(a) * 20, pz = mz + Math.sin(a) * 20;
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 8, 8).translate(0, 4, 0), stone(2));
      housing.position.set(px, 0, pz);
      scene.add(housing);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 10, 8), makeMaterial({ color: '#f3ead8', metal: 'chrome' }));
      rod.userData.noCollide = true;
      scene.add(rod);
      movers.push((t) => rod.position.set(px, 9 + Math.max(0, Math.sin(t * 1.6 + k)) * 6, pz));
    }
  }

  // ======================================================== B: the upside-down quarter
  yield;
  const relay = {}, deskInfo = {};
  // Built upright in a group, then flipped: its floor faces down, gravity pulls up.
  yield;
  {
    const grp = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(190, 170, 10, 32).translate(0, -5, 0),
      makeMaterial({ color: '#a9a0c8', color2: '#d48e94', color3: '#f3ead8', mode: MODE_STRATA, strataSize: 2.5, flat: true, grid: 6 }));
    grp.add(slab);
    noShadow.push(slab); // otherwise the slab would shade the whole quarter
    // (the same random draws as ever; the few that land on the story's spots are taken away again)
    const bClear = (p) => [B_RELAY, B_DESK, B_PUMP].some((c) => Math.hypot(p.x - c.x, p.z - c.z) < 14) || (Math.abs(p.x) < 12 && p.z > -75 && p.z < 160);
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, r = 25 + rng() * 150;
      const m = build(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), Y, grp);
      if (bClear(m.position)) grp.remove(m);
    }
    // the relay box, hanging (to us: standing) by the path to the next portal: a slot, a stamp, a lamp
    {
      const ink = makeMaterial({ color: '#34405e', flat: true }), brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' });
      const box = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.2, 2.6, 1.6).translate(0, 1.3, 0), new THREE.CylinderGeometry(0.5, 0.7, 0.5, 10).translate(0, 2.85, 0)].map((q) => q.toNonIndexed())), stone(2));
      box.position.copy(B_RELAY);
      grp.add(box);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.1), ink);
      slot.position.set(B_RELAY.x, 1.9, B_RELAY.z + 0.82); slot.userData.noCollide = true; grp.add(slot);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), makeMaterial({ color: '#d8aa50', glow: 0.8 }));
      lamp.position.set(B_RELAY.x, 3.3, B_RELAY.z); lamp.userData.noCollide = true; grp.add(lamp);
      relay.lamp = lamp;
      const stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8), brass);
      stamp.position.set(B_RELAY.x + 0.6, 2.95, B_RELAY.z + 0.3); stamp.userData.noCollide = true; grp.add(stamp);
      relay.stamp = stamp;
    }
    // the Major's old desk, at the slab's far edge, where nobody looks: a chair, a lamp, a sheet of paper
    {
      const wood = makeMaterial({ color: '#8a5a3a', flat: true }), paper = makeMaterial({ color: '#fff6dc', flat: true, glow: 0.25 });
      const d = B_DESK;
      const parts = [new THREE.BoxGeometry(2.6, 0.12, 1.3).translate(0, 1.0, 0)];
      for (const [x, z] of [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]]) parts.push(new THREE.BoxGeometry(0.12, 1, 0.12).translate(x, 0.5, z));
      parts.push(new THREE.BoxGeometry(0.7, 0.08, 0.7).translate(0, 0.6, 1.1), new THREE.BoxGeometry(0.7, 0.9, 0.08).translate(0, 1.05, 1.45));
      for (const [x, z] of [[-0.3, 0.8], [0.3, 0.8], [-0.3, 1.4], [0.3, 1.4]]) parts.push(new THREE.BoxGeometry(0.06, 0.6, 0.06).translate(x, 0.3, z));
      const desk = new THREE.Mesh(mergeGeometries(parts.map((q) => q.toNonIndexed())), wood);
      desk.position.copy(d); desk.rotation.y = 0.4; desk.userData.noCollide = true;
      grp.add(desk);
      const lampPost = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.03, 0.05, 0.7, 5).translate(0, 0.35, 0).toNonIndexed(), new THREE.ConeGeometry(0.25, 0.3, 8, 1, true).translate(0, 0.75, 0).toNonIndexed()]), makeMaterial({ color: '#d8aa50', glow: 0.7 }));
      lampPost.position.set(-0.9, 1.06, -0.3); lampPost.userData.noCollide = true; desk.add(lampPost);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.75), paper);
      sheet.position.set(0.2, 1.08, 0); sheet.rotation.y = -0.2; sheet.userData.noCollide = true; desk.add(sheet);
      deskInfo.mesh = desk;
      deskInfo.sheet = sheet;
    }
    // the lamp pump: a squat housing, a flywheel and a piston, all stopped
    {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 4, 10).translate(0, 2, 0), stone(2));
      housing.position.copy(B_PUMP);
      grp.add(housing);
      const wheel = new THREE.Group();
      wheel.position.set(B_PUMP.x + 2.9, 3.4, B_PUMP.z);
      const wm = makeMaterial({ color: '#c9603e', flat: true, grid: 2, metal: 'copper' });
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 6, 20).rotateY(Math.PI / 2), wm));
      wheel.add(new THREE.Mesh(mergeGeometries([0, 1, 2].map((k) => new THREE.BoxGeometry(0.2, 4.8, 0.3).rotateX(k * Math.PI / 3).toNonIndexed())), makeMaterial({ color: '#34405e', flat: true, metal: 'iron' })));
      wheel.userData.noCollide = true;
      grp.add(wheel);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3, 8), makeMaterial({ color: '#f3ead8', metal: 'chrome' }));
      rod.position.set(B_PUMP.x, 5, B_PUMP.z); rod.userData.noCollide = true;
      grp.add(rod);
      machines.pump = { group: housing, local: B_PUMP.clone().add(new THREE.Vector3(1.4, 3, 0)), radius: 4.5, speed: 0, target: 0, spin: (a) => { wheel.rotation.x = a * 1.4; rod.position.y = 5 + Math.max(0, Math.sin(a * 1.4)) * 1.6; } };
    }
    // lamp posts hanging "up" into the sky
    for (let i = 0; i < 20; i++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * 160;
      if (bClear({ x: Math.cos(a) * r, z: Math.sin(a) * r })) continue;
      const post = new THREE.Mesh(mergeGeometries([
        new THREE.CylinderGeometry(0.4, 0.5, 9, 6).translate(0, 4.5, 0),
        new THREE.SphereGeometry(1.2, 8, 6).translate(0, 9.5, 0),
      ]), makeMaterial({ color: '#d8aa50', glow: 0.6 }));
      post.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      grp.add(post);
    }
    grp.rotation.x = Math.PI;
    grp.position.copy(B_POS);
    scene.add(grp);
    grp.updateMatrixWorld(true);
    const toWorld = (v) => grp.localToWorld(v.clone());
    relay.pos = toWorld(B_RELAY.clone().setY(1.9));
    relay.foot = toWorld(B_RELAY.clone().add(new THREE.Vector3(0, 0, 2.2)));
    deskInfo.pos = toWorld(B_DESK.clone().setY(1.08));
    deskInfo.foot = toWorld(B_DESK.clone().add(new THREE.Vector3(0.9, 0, -1.2)));
    machines.pump.pos = toWorld(machines.pump.local);
  }

  // ======================================================== C: the ring
  yield;
  {
    // shell with a slit in the roof (centred on +y) so the sun can shine in
    const shell = facingIn(new THREE.CylinderGeometry(RING_R, RING_R, RING_L, 112, 1, true, Math.PI / 2 + SLIT, Math.PI * 2 - SLIT * 2));
    shell.rotateZ(Math.PI / 2);
    const sm = new THREE.Mesh(shell, makeMaterial({ color: '#e9cdb8', color2: '#cfe0a8', color3: '#c7c0dd', mode: MODE_STRATA, strataSize: 18, grid: 8, side: THREE.DoubleSide }));
    sm.position.copy(C_POS);
    scene.add(sm);
    // end rims
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 4, 8, 96).rotateY(Math.PI / 2), makeMaterial({ color: '#34405e', metal: 'painted' }));
      rim.position.set(C_POS.x + sx * RING_L / 2, C_POS.y, C_POS.z);
      scene.add(rim);
    }
    // buildings all the way round the inside, avoiding the slit
    for (let i = 0; i < 70; i++) {
      const phi = rng() * Math.PI * 2;
      const fromSlit = Math.abs(Math.atan2(Math.sin(phi - Math.PI / 2), Math.cos(phi - Math.PI / 2)));
      if (fromSlit < SLIT + 0.25) continue;
      const xa = (rng() - 0.5) * (RING_L - 60);
      const d = ringDir(phi);
      const pos = C_POS.clone().add(new THREE.Vector3(xa, 0, 0)).addScaledVector(d, RING_R);
      const m = build(pos, d.clone().negate());
      // the entrance, the turbine and the ball's way up the curve to the portal stay clear
      const cx = C_POS.x + xa, fromBottom = Math.atan2(Math.cos(phi), -Math.sin(phi));   // 0 at the bottom, -pi/2 at the -z wall
      if (cx < C_POS.x + 95 && cx > C_POS.x - 190 && fromBottom > -1.8 && fromBottom < 0.35) m.removeFromParent();
    }
    // the ring's turbine: a paddle wheel on the floor near the entrance, turning about the ring's axis
    {
      const fy = C_POS.y - Math.sqrt(RING_R * RING_R - C_TURBINE.z * C_TURBINE.z);
      const frame = new THREE.Mesh(mergeGeometries([
        new THREE.BoxGeometry(0.8, 9, 0.8).translate(-2, 4.5, 0), new THREE.BoxGeometry(0.8, 9, 0.8).translate(2, 4.5, 0),
        new THREE.BoxGeometry(5.5, 1.2, 3).translate(0, 0.6, 0)].map((q) => q.toNonIndexed())), stone(3));
      frame.position.set(C_TURBINE.x, fy, C_TURBINE.z);
      scene.add(frame);
      const wheel = new THREE.Group();
      wheel.position.set(C_TURBINE.x, fy + 8, C_TURBINE.z);
      const pm = makeMaterial({ color: '#86b0b2', flat: true, grid: 2, metal: 'painted' });
      const paddles = [];
      for (let k = 0; k < 8; k++) paddles.push(new THREE.BoxGeometry(2.6, 0.3, 2.4).translate(0, 5.6, 0).rotateX(k * Math.PI / 4).toNonIndexed());
      paddles.push(new THREE.CylinderGeometry(0.6, 0.6, 3.4, 10).rotateZ(Math.PI / 2).toNonIndexed());
      for (let k = 0; k < 4; k++) paddles.push(new THREE.BoxGeometry(0.3, 11, 0.3).rotateX(k * Math.PI / 4).toNonIndexed());
      wheel.add(new THREE.Mesh(mergeGeometries(paddles), pm));
      wheel.userData.noCollide = true;
      scene.add(wheel);
      machines.turbine = { group: frame, pos: wheel.position.clone(), radius: 6.5, speed: 0, target: 0, spin: (a) => { wheel.rotation.x = -a * 0.8; } };
    }
  }

  // ======================================================== portals A -> B -> C -> A
  yield;
  const aSpawn = new THREE.Vector3(0, 0, 120);
  const bSpawn = B_POS.clone().add(new THREE.Vector3(0, 0, 60));          // on the slab, near the edge
  const cPhi = -Math.PI / 2;                                                // ring bottom: up is +y there
  const cSpawn = C_POS.clone().add(new THREE.Vector3(-150, 0, 0)).addScaledVector(ringDir(cPhi), RING_R);
  const down = new THREE.Vector3(0, -1, 0);
  portal(new THREE.Vector3(0, 0, 170), Y, new THREE.Vector3(0, 0, 1), bSpawn, down, new THREE.Vector3(0, 0, 1), 'B');
  portal(B_POS.clone().add(new THREE.Vector3(0, 0, -150)), down, new THREE.Vector3(0, 0, 1), cSpawn, Y, new THREE.Vector3(1, 0, 0), 'C');
  yield;
  {
    const phi = Math.PI;                                                   // a quarter-turn round the ring
    const d = ringDir(phi);
    const p = C_POS.clone().add(new THREE.Vector3(60, 0, 0)).addScaledVector(d, RING_R);
    portal(p, d.clone().negate(), new THREE.Vector3(1, 0, 0), aSpawn, Y, new THREE.Vector3(0, 0, -1), 'A');
  }

  // ======================================================== gravity, zones, falls
  yield;
  const inRing = (p) => Math.abs(p.x - C_POS.x) < RING_L / 2 + 80 && Math.hypot(p.y - C_POS.y, p.z - C_POS.z) < RING_R + 80;
  const inB = (p) => p.z > 2200;
  const gravityAt = (p) => {
    if (inRing(p)) return new THREE.Vector3(0, C_POS.y - p.y, C_POS.z - p.z).normalize();
    if (inB(p)) return down;
    return Y;
  };
  const ZONES = {
    A: { name: "Brask's plateau", preset: 'Moebius print', tint: [1, 1, 1], fog: 0.9 },
    B: { name: 'The upside-down quarter', preset: 'Animated ink', tint: [0.95, 0.92, 1.02], fog: 1.2 },
    C: { name: 'The ring', preset: 'Moebius', tint: [1.0, 0.96, 0.9], fog: 0.8 },
  };
  const zoneId = (p) => (inRing(p) ? 'C' : inB(p) ? 'B' : 'A');
  let cooldown = 0, passing = null;
  const PASS = { in: 0.16, out: 0.4 };   // s: the fade into the portal's light, and out of it

  // (the makers' First Garage on the rim: src/temples/garage.js)
  yield;
  return attachTemple('garage', scene, {
    id: 'garage',
    // the plateau's flora (src/flora.js) keeps off the path from the start to the keep
    floraAvoid: (x, z, r) => Math.abs(x) < 18 + r && z > 14 - r && z < 175 + r,
    ground: { heightAt: () => -Infinity },
    spawn: aSpawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: Infinity,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 10.5, preset: 'Moebius print' },
    sky: {
      script: {
        day: ['#8db1c3', '#efe2c6', '#9c9ccb', '#fffaf0', '#fff6dc'],   // print: a faded cerulean over cream, lavender shade (the sheets' dusty tones)
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
      planets: [{ az: 40, el: 30, size: 7, color: '#86b0b2', ring: 0.4 }],
    },
    killY: -Infinity,
    noShadow,
    lights: portals.map((p) => new THREE.Vector4(p.pos.x, p.pos.y, p.pos.z, 16)),
    life: {
      flocks: [{ count: 9, color: '#d27b5e', size: 1.3, radius: 60, height: [10, 30], seed: 5 }],
      motes: { count: 140, color: '#d8aa50', size: 0.05, glow: 0.7, rise: 0.15, wind: [0.2, 0.1] },
    },
    navigationPortals: portals,
    gravityAt,
    // out through the ring's skin (the slit, or pressed through it): there is nothing to stand on
    // out there, and the jets only push you back against the hull, so you go back where you last stood
    unsafe: (p) => inRing(p) && Math.abs(p.x - C_POS.x) < RING_L / 2 - 2 && Math.hypot(p.y - C_POS.y, p.z - C_POS.z) > RING_R + 0.8,
    // the story's handles (src/story/garage.js)
    garage: {
      B_POS, C_POS, RING_R, RING_L, SLIT, ringDir, zoneId: (p) => zoneId(p), inRing: (p) => inRing(p), inB: (p) => inB(p),
      aSpawn, bSpawn, cSpawn, portals, machines, board, relay, desk: deskInfo, glyph: glyphAt,
      greatMachine: new THREE.Vector3(90, 0, -60),
    },
    // the hanging city faces down: mirror the sun so it's lit, not cross-hatched
    lightAt: (p, dir) => { if (inB(p)) dir.y = -dir.y; },
    zoneAt: (p) => ZONES[zoneId(p)],
    atmo: (x, z, y) => {
      const zn = ZONES[zoneId({ x, y, z })];
      return { tint: zn.tint, fog: zn.fog, name: zn.name };
    },
    update(dt, t, ctx) {
      for (const m of movers) m(t);
      // the stopped machines: they ease up to speed once started (and keep their own angle)
      for (const m of Object.values(machines)) {
        m.speed += (m.target - m.speed) * (1 - Math.exp(-(m.target > m.speed ? 0.9 : 2) * dt));
        m.angle = (m.angle ?? 0) + m.speed * dt;
        m.spin(m.angle);
      }
      const player = ctx?.player;
      if (!player) return;
      cooldown = Math.max(cooldown - dt, 0);
      const p = player.pos;
      // Through a portal: a quick fade into its light, then out the far side at your own pace,
      // the camera already upright and behind you (no snap of the view, no dead stop).
      const P = ctx.passage;
      if (P?.active) {
        // (the hand-over, src/passage.js: the paper sweeps across, you come out of the far portal still
        // going, upright in its gravity, the camera behind you as it was)
      } else if (passing) {
        passing.t += dt;
        if (!passing.done && passing.t >= PASS.in) {
          passing.done = true;
          const po = passing.po;
          player.teleport(po.to, po.toUp, po.toFwd, { speed: passing.speed });
          if (ctx.rig) {
            ctx.rig.yaw = Math.PI; ctx.rig.pitch = 0.2;
            ctx.rig.target?.copy(player.pos);
            ctx.rig.camera?.up.copy(po.toUp);
          }
          ctx.fade?.(0, PASS.out);
        }
        if (passing.t >= PASS.in + PASS.out) passing = null;
      } else if (cooldown === 0 && !player.riding) {
        for (const po of portals) {
          const d = p.distanceTo(po.pos);
          if (d < 18) P?.prepare(po.to);
          if (d < 5.5) {
            const v = player.vel, u = player.frame?.up ?? Y, along = v.dot(u);
            const speed = Math.max(2.5, Math.sqrt(Math.max(0, v.lengthSq() - along * along)));
            cooldown = 1.5;
            if (P) { P.go({ to: po.to, up: po.toUp, fwd: po.toFwd, heading: 0, speed }); break; }
            passing = { po, t: 0, done: false, speed };
            ctx.fade?.(0.9, PASS.in);
            if (!ctx.fade) passing.t = PASS.in;   // (no screen to fade: straight through)
            cooldown = 1.5;
            break;
          }
        }
      }
      // falling out of a zone sends you back to its entrance
      const z = zoneId(p);
      if (z === 'A' && p.y < -260) player.teleport(aSpawn, Y, new THREE.Vector3(0, 0, -1));
      if (z === 'B' && p.y > B_POS.y + 400) player.teleport(bSpawn, down, new THREE.Vector3(0, 0, 1));
      if (z === 'C' && Math.hypot(p.y - C_POS.y, p.z - C_POS.z) > RING_R + 40) player.teleport(cSpawn, Y, new THREE.Vector3(1, 0, 0));
      if (z === 'A' && Math.hypot(p.x, p.z) > 900) player.teleport(aSpawn, Y, new THREE.Vector3(0, 0, -1));
    },
  });
}
export const createGarage = stepped(buildGarage);
