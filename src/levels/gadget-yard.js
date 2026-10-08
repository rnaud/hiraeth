import * as THREE from 'three';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { DESERT_WORLD_LOOK } from '../desert-sites.js';
import { GADGETS } from '../gadgets/registry.js';
import { YardKit } from '../gadgets/yard-kit.js';

// ---------------------------------------------------------------------------
// The Gadget Yard: a developer's world for trying the gadgets (docs/systems/gadgets.md, "The Gadget Yard"),
// reached only from the worlds list (?level=gadgetyard; it grants every gadget). A round yard of packed sand
// inside a low wall; each gadget has a bay round its edge (YARD.bays slots, in the registry's order) where its
// module's `yard(kit)` puts what it wants to be tried on; the middle has what any of them can play with:
// a floor plate that opens a gate while something heavy sits on it, crates, targets on posts, a cracked
// wall, and a block with ledges to climb. Everything is inside WILD.spawn of the spawn: no wild packs.
// ---------------------------------------------------------------------------

/** The yard's size and its bays: `bays` slots round a ring `ring` m out, the first two north-west and north-east. */
export const YARD = { radius: 50, ring: 30, bays: 10, ship: { x: 0, z: 72 } };

/** Where bay i stands (on the ring) and its yaw (its local -z facing out of the yard). */
export function bayFrame(i, { ring = YARD.ring, bays = YARD.bays } = {}) {
  const a = ((i - 0.5) / bays) * Math.PI * 2;
  return { origin: new THREE.Vector3(Math.sin(a) * ring, 0, -Math.cos(a) * ring), yaw: -a, angle: a };
}

export function* buildGadgetYard(scene) {
  const terrain = yield* Terrain.make({
    size: 400, seg: 80,
    // flat inside the wall and on the apron south of it where the ship stands (YARD.ship), rising gently beyond
    height: (x, z) => {
      const r = Math.hypot(x, z), apron = Math.max(Math.abs(x) - 24, z < 0 ? 99 : z - (YARD.ship.z + 22), 0);
      return Math.max(0, Math.min(r - YARD.radius - 2, apron) * 0.22);
    },
    material: { color: '#e8d4a8', color2: '#efdfba', color3: '#d6b98a', mode: MODE_TERRAIN, ripples: false, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const yard = new YardKit(scene);
  // the low wall round the yard, broken by a gap to the south
  {
    const wall = makeMaterial({ color: '#d9c6a2', color2: '#cbb48d', color3: '#b39b74', mode: MODE_STRATA, strataSize: 1.1 });
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.16) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.6, 0.9), wall);
      m.position.set(Math.sin(a) * YARD.radius, 0.8, -Math.cos(a) * YARD.radius);
      m.rotation.y = -a;
      scene.add(m);
    }
  }
  yield;
  // the middle: what any gadget can play with
  const mid = yard.bay(new THREE.Vector3(0, 0, 0), 0);
  // a plate and the gate it opens: a little walled garden north of the spawn, a lamp inside
  mid.block([0.6, 2.2, 6], [-6, 1.1, -9]); mid.block([0.6, 2.2, 6], [-1, 1.1, -9]); mid.block([5.6, 2.2, 0.6], [-3.5, 1.1, -12]);
  mid.block([1.4, 2.2, 0.6], [-5.3, 1.1, -6.2]); mid.block([1.4, 2.2, 0.6], [-1.7, 1.1, -6.2]);
  mid.gate([2.3, 2.2, 0.25], [-3.5, 1.1, -6.2], { plates: [mid.plate([-3.5, 0, -3])] });
  mid.lamp([-3.5, 0, -9.5]);
  mid.crate([-0.5, 0.45, -2.5]);
  mid.crate([1.5, 0.5, -4], { metal: true });
  // targets on posts
  mid.target([5, 0, -6]); mid.target([7.5, 0, -9]); mid.target([3, 0, -11]);
  // a cracked wall in the open, and a block with ledges up its side
  mid.cracked([3, 2.6, 0.6], [8, 1.3, 2]);
  mid.block([4, 5, 4], [-10, 2.5, 4]);
  mid.block([1.2, 0.35, 4], [-7.4, 2, 4], { mat: 'pale' });
  mid.block([1.2, 0.35, 4], [-7.4, 3.6, 4], { mat: 'pale' });
  yield;
  // each gadget's own bay
  GADGETS.forEach((def, i) => {
    if (!def.yard || i >= YARD.bays) return;
    const f = bayFrame(i);
    const kit = yard.bay(f.origin, f.yaw);
    kit.gadget = def.id;
    try { def.yard(kit); } catch (e) { console.warn('gadget yard', def.id, e); }
  });
  yield;
  const { gadgetYard, targets } = yard.out();

  return {
    id: 'gadgetyard',
    ground: terrain,
    spawn: new THREE.Vector3(0, 0, 3),
    limit: 180,
    foes: { wild: false },   // (no wild packs: only the bomb bay's pen, src/gadgets/index.js updatePen)
    shipSite: { x: YARD.ship.x, z: YARD.ship.z, heading: Math.PI },   // (outside the south gap, the ramp toward the yard)
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 10, preset: 'Moebius print', cloudShadows: 0, look: DESERT_WORLD_LOOK },
    killY: -Infinity,
    gadgetYard,
    targets,
    reactions: false,   // (no reactive flowers: the bays are busy enough)
    gadgets: 'all',   // (main.js: every gadget is granted here)
    sky: {
      script: {
        day: ['#9fbcc6', '#dfe3d6', '#9fb0cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 1.0, name: 'The Gadget Yard' }),
    update() {},
  };
}
export const createGadgetYard = stepped(buildGadgetYard);
