import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { jitter, soften } from '../world.js';

// ---------------------------------------------------------------------------
// Le Garage hermétique (Moebius, 1976-79): Major Grubert's pocket universe.
// Three zones linked by portals, each with its own gravity and ink style:
//   A  Grubert's plateau   normal gravity, a floating island      (Moebius)
//   B  The upside-down     gravity pulls you *up* under a slab   (Animated ink)
//   C  The ring            a cylinder habitat lit through a slit,
//                          gravity points outward from the axis    (Sable)
// ---------------------------------------------------------------------------

const B_POS = new THREE.Vector3(0, 900, 3000);   // the upside-down slab's walking surface
const C_POS = new THREE.Vector3(3000, 0, 0);     // the ring's centre (axis along x)
const RING_R = 150;
const RING_L = 420;
const SLIT = 0.35;                                // half-angle of the roof slit

const PALETTE = ['#e88fa6', '#62c3c9', '#f2c54b', '#a99be0', '#f3ead8', '#e6875f', '#8fcf9a', '#d9643a'];
const Y = new THREE.Vector3(0, 1, 0);

/** Radial frame of the ring at an angle phi around the x axis (phi = 0 -> +z, pi/2 -> +y). */
const ringDir = (phi) => new THREE.Vector3(0, Math.sin(phi), Math.cos(phi));

export function createGarage(scene) {
  const rng = mulberry32(1976);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const movers = [];
  const portals = [];
  const noShadow = [];
  const stone = (size = 3) => makeMaterial({ color: pick(PALETTE), color2: pick(PALETTE), color3: '#f3ead8', mode: MODE_STRATA, strataSize: size, flat: true });

  // A little building kit, authored in local space (y up, base at y = 0).
  function house(parts = []) {
    const w = 6 + rng() * 8, d = 6 + rng() * 8, h = 6 + rng() * 14;
    parts.push(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).toNonIndexed());
    const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 4 + rng() * 6, 4).rotateY(Math.PI / 4).translate(0, h + 2.5, 0);
    parts.push(roof.toNonIndexed());
    return parts;
  }
  function tower(parts = []) {
    const r = 3 + rng() * 4, h = 20 + rng() * 40;
    parts.push(soften(new THREE.CylinderGeometry(r * 0.9, r, h, 10, 5), 0.1).translate(0, h / 2, 0).toNonIndexed());
    if (rng() < 0.5) parts.push(new THREE.ConeGeometry(r * 1.3, r * 2.5, 10).translate(0, h + r * 1.2, 0).toNonIndexed());
    else parts.push(new THREE.SphereGeometry(r * 1.4, 12, 8).scale(1, 0.8, 1).translate(0, h + r, 0).toNonIndexed());
    return parts;
  }
  function machine(parts = []) {
    // pipes and a gear: Moebius' melting machinery
    const r = 4 + rng() * 6;
    parts.push(new THREE.TorusGeometry(r, 0.9, 6, 18).rotateY(rng() * 3).translate(0, r, 0).toNonIndexed());
    const p0 = new THREE.Vector3(-r * 2, 0.8, 0), p3 = new THREE.Vector3(r * 2, 0.8, rng() * 8 - 4);
    const curve = new THREE.CubicBezierCurve3(p0, new THREE.Vector3(-r, r * 2.5, 2), new THREE.Vector3(r, -1, -2), p3);
    parts.push(new THREE.TubeGeometry(curve, 24, 0.8 + rng() * 0.8, 7).toNonIndexed());
    return parts;
  }
  const kit = [house, house, tower, machine];
  /** Place a random building at `pos`, with its up along `up`. */
  function build(pos, up, group = scene) {
    const g = mergeGeometries(pick(kit)());
    const m = new THREE.Mesh(g, stone(2 + rng() * 3));
    m.quaternion.setFromUnitVectors(Y, up).multiply(new THREE.Quaternion().setFromAxisAngle(Y, rng() * 6));
    m.position.copy(pos);
    group.add(m);
    return m;
  }

  function portal(pos, up, facing, to, toUp, toFwd, label) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 8, 32), makeMaterial({ color: '#f2c54b', glow: 1 }));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(4.3, 32), makeMaterial({ color: '#62c3c9', glow: 0.8, side: THREE.DoubleSide }));
    const grp = new THREE.Group();
    grp.add(ring, inner);
    // torus lies in its local xy-plane: point its normal (z) along `facing`, keep `up` as y
    const z = facing.clone().normalize(), x = new THREE.Vector3().crossVectors(up, z).normalize();
    grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up.clone().normalize(), z));
    grp.position.copy(pos).addScaledVector(up, 5.5);
    grp.userData.noCollide = true;
    scene.add(grp);
    portals.push({ pos: grp.position.clone(), to, toUp, toFwd, label });
    movers.push((t) => { inner.rotation.z = t * 0.6; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.03); });
  }

  // ======================================================== A: Grubert's plateau
  {
    const g = new THREE.CylinderGeometry(210, 120, 70, 30, 6);
    g.translate(0, -35, 0);
    jitter(g, 0.12, 0.01, 4);
    scene.add(new THREE.Mesh(g, makeMaterial({ color: '#cfe0a8', color2: '#b5a37f', color3: '#e9d7b0', mode: MODE_STRATA, strataSize: 7, flat: true })));
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
    movers.push((t) => { blades.rotation.z = t * 0.5; });
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

  // ---------------------------------------------------------- hero: the great machine
  // A cathedral of gears turning round a column, pistons pumping at its base.
  {
    const mx = 90, mz = -60;
    const col = new THREE.Mesh(soften(new THREE.CylinderGeometry(6, 9, 80, 14, 8), 0.12).translate(0, 40, 0), stone(5));
    col.position.set(mx, 0, mz);
    scene.add(col);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 10).scale(1, 0.7, 1), makeMaterial({ color: '#f2c54b', grid: 3 }));
    crown.position.set(mx, 82, mz);
    scene.add(crown);
    const gearMat = makeMaterial({ color: '#d9643a', flat: true, grid: 2 });
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
        gear.add(new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.8, 0.8).rotateY((k / 3) * Math.PI), makeMaterial({ color: '#34405e', flat: true })));
      gear.userData.noCollide = true;
      scene.add(gear);
      const sp = (i % 2 ? -1 : 1) * (0.15 + rng() * 0.15);
      movers.push((t) => { gear.rotation.y = t * sp; });
    }
    for (let k = 0; k < 6; k++) { // pistons
      const a = (k / 6) * Math.PI * 2, px = mx + Math.cos(a) * 20, pz = mz + Math.sin(a) * 20;
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 8, 8).translate(0, 4, 0), stone(2));
      housing.position.set(px, 0, pz);
      scene.add(housing);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 10, 8), makeMaterial({ color: '#f3ead8', flat: true }));
      rod.userData.noCollide = true;
      scene.add(rod);
      movers.push((t) => rod.position.set(px, 9 + Math.max(0, Math.sin(t * 1.6 + k)) * 6, pz));
    }
  }

  // ======================================================== B: the upside-down quarter
  // Built upright in a group, then flipped: its floor faces down, gravity pulls up.
  {
    const grp = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(190, 170, 10, 32).translate(0, -5, 0),
      makeMaterial({ color: '#a99be0', color2: '#e88fa6', color3: '#f3ead8', mode: MODE_STRATA, strataSize: 2.5, flat: true, grid: 6 }));
    grp.add(slab);
    noShadow.push(slab); // otherwise the slab would shade the whole quarter
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, r = 25 + rng() * 150;
      build(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), Y, grp);
    }
    // lamp posts hanging "up" into the sky
    for (let i = 0; i < 20; i++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * 160;
      const post = new THREE.Mesh(mergeGeometries([
        new THREE.CylinderGeometry(0.4, 0.5, 9, 6).translate(0, 4.5, 0),
        new THREE.SphereGeometry(1.2, 8, 6).translate(0, 9.5, 0),
      ]), makeMaterial({ color: '#f2c54b', glow: 0.6 }));
      post.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      grp.add(post);
    }
    grp.rotation.x = Math.PI;
    grp.position.copy(B_POS);
    scene.add(grp);
  }

  // ======================================================== C: the ring
  {
    // shell with a slit in the roof (centred on +y) so the sun can shine in
    const shell = new THREE.CylinderGeometry(RING_R, RING_R, RING_L, 112, 1, true, Math.PI / 2 + SLIT, Math.PI * 2 - SLIT * 2);
    shell.rotateZ(Math.PI / 2);
    const sm = new THREE.Mesh(shell, makeMaterial({ color: '#e9cdb8', color2: '#cfe0a8', color3: '#c7c0dd', mode: MODE_STRATA, strataSize: 18, grid: 8, side: THREE.DoubleSide }));
    sm.position.copy(C_POS);
    scene.add(sm);
    // end rims
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 4, 8, 96).rotateY(Math.PI / 2), makeMaterial({ color: '#34405e' }));
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
      build(pos, d.clone().negate());
    }
  }

  // ======================================================== portals A -> B -> C -> A
  const aSpawn = new THREE.Vector3(0, 0, 120);
  const bSpawn = B_POS.clone().add(new THREE.Vector3(0, 0, 60));          // on the slab, near the edge
  const cPhi = -Math.PI / 2;                                                // ring bottom: up is +y there
  const cSpawn = C_POS.clone().add(new THREE.Vector3(-150, 0, 0)).addScaledVector(ringDir(cPhi), RING_R);
  const down = new THREE.Vector3(0, -1, 0);
  portal(new THREE.Vector3(0, 0, 170), Y, new THREE.Vector3(0, 0, 1), bSpawn, down, new THREE.Vector3(0, 0, 1), 'B');
  portal(B_POS.clone().add(new THREE.Vector3(0, 0, -150)), down, new THREE.Vector3(0, 0, 1), cSpawn, Y, new THREE.Vector3(1, 0, 0), 'C');
  {
    const phi = Math.PI;                                                   // a quarter-turn round the ring
    const d = ringDir(phi);
    const p = C_POS.clone().add(new THREE.Vector3(60, 0, 0)).addScaledVector(d, RING_R);
    portal(p, d.clone().negate(), new THREE.Vector3(1, 0, 0), aSpawn, Y, new THREE.Vector3(0, 0, -1), 'A');
  }

  // ======================================================== gravity, zones, falls
  const inRing = (p) => Math.abs(p.x - C_POS.x) < RING_L / 2 + 80 && Math.hypot(p.y - C_POS.y, p.z - C_POS.z) < RING_R + 80;
  const inB = (p) => p.z > 2200;
  const gravityAt = (p) => {
    if (inRing(p)) return new THREE.Vector3(0, C_POS.y - p.y, C_POS.z - p.z).normalize();
    if (inB(p)) return down;
    return Y;
  };
  const ZONES = {
    A: { name: "Grubert's plateau", preset: 'Moebius print', tint: [1, 1, 1], fog: 0.9 },
    B: { name: 'The upside-down quarter', preset: 'Animated ink', tint: [0.95, 0.92, 1.02], fog: 1.2 },
    C: { name: 'The ring', preset: 'Moebius', tint: [1.0, 0.96, 0.9], fog: 0.8 },
  };
  const zoneId = (p) => (inRing(p) ? 'C' : inB(p) ? 'B' : 'A');
  let cooldown = 0;

  return {
    id: 'garage',
    ground: { heightAt: () => -Infinity },
    spawn: aSpawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: Infinity,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 10.5, preset: 'Moebius print' },
    sky: { planets: [{ az: 40, el: 30, size: 7, color: '#62c3c9', ring: 0.4 }] },
    killY: -Infinity,
    noShadow,
    lights: portals.map((p) => new THREE.Vector4(p.pos.x, p.pos.y, p.pos.z, 16)),
    life: {
      flocks: [{ count: 9, color: '#e6875f', size: 1.3, radius: 60, height: [10, 30], seed: 5 }],
      motes: { count: 140, color: '#f2c54b', size: 0.05, glow: 0.7, rise: 0.15, wind: [0.2, 0.1] },
    },
    gravityAt,
    // the hanging city faces down: mirror the sun so it's lit, not cross-hatched
    lightAt: (p, dir) => { if (inB(p)) dir.y = -dir.y; },
    zoneAt: (p) => ZONES[zoneId(p)],
    atmo: (x, z, y) => {
      const zn = ZONES[zoneId({ x, y, z })];
      return { tint: zn.tint, fog: zn.fog, name: zn.name };
    },
    update(dt, t, ctx) {
      for (const m of movers) m(t);
      const player = ctx?.player;
      if (!player) return;
      cooldown = Math.max(cooldown - dt, 0);
      const p = player.pos;
      if (cooldown === 0 && !player.riding) {
        for (const po of portals) {
          if (p.distanceTo(po.pos) < 5.5) {
            player.teleport(po.to, po.toUp, po.toFwd);
            if (ctx.rig) { ctx.rig.yaw = Math.PI; ctx.rig.pitch = 0.2; }
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
  };
}
