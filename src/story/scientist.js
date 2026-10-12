import * as THREE from 'three';
import { NPC, registerNPCTargets } from '../npc.js';
import { makeMaterial } from '../materials.js';
import { items as sharedItems, ITEMS } from '../items.js';
import { fragmentCounts } from '../fragments-data.js';
import { THRUM, thrumPerson } from './scientist-data.js';

// The scientist (src/story/scientist-data.js: Anselm Thrum; docs/systems/fragments.md). src/story/index.js sets him
// up in every world:
//
//   setupScientist({ levelId, scene, physics, level, ship, npcs, lib, humans, game, items, talkable, dialogue, player, toast })
//     → { def, aboard, field, meet(), update(dt), jar }
//
// Once met (`frag.met`) he lives aboard the ship, in the hold by the crates (ABOARD, ship-local), and talks there:
// his count, and an upgrade whenever a milestone is reached. Before that he is nowhere; the first fragment you pick
// up (game 'fragment', src/fragments.js) brings him: he comes up beside you (meetSpot) and the talk opens at once.
// That one stays where he met you until you are far off or aboard, then is gone (he is in the hold by then).
// On the crate beside him, a jar of what you have brought him, a splinter for each (up to JAR_MAX), glowing.

const UP = new THREE.Vector3(0, 1, 0);
/** His place aboard (ship-local, src/ship/interior.js: the hold, in front of the starboard crate, facing the doorway). */
export const ABOARD = { at: [1.55, 0, 9.45], heading: -2.4, jar: [1.2, 0.71, 10.22] };   // (the hold moved aft and grew: issue #195)
/** At most this many splinters in his jar. */
export const JAR_MAX = 24;
/** How far off the one who met you goes. */
const FIELD_GONE = 40;

/** Where he comes up beside you for the first meeting: a few steps off, on ground near yours, with room and nothing between. */
export function meetSpot({ physics, level, at, heading = 0 }) {
  if (!physics || !at) return null;
  const eye = at.clone().addScaledVector(UP, 1.2);
  for (const r of [4.5, 3.5, 6]) {
    for (let k = 0; k < 12; k++) {
      const a = heading + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6) + 0.6;
      const p = at.clone().add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
      const g = physics.groundAt(p.x, at.y + 2, p.z, 5);
      if (!Number.isFinite(g) || Math.abs(g - at.y) > 1.2) continue;
      p.y = g;
      if (level?.unsafe?.(p)) continue;
      if (physics.rayDistance(p.clone().addScaledVector(UP, 0.3), UP, 2) < 1.9) continue;
      const to = p.clone().addScaledVector(UP, 1.2).sub(eye), d = to.length();
      if (physics.rayDistance(eye, to.normalize(), d) < d - 0.3) continue;
      return { at: p, heading: Math.atan2(at.x - p.x, at.z - p.z) };
    }
  }
  return null;
}

/** His jar on the crate: glass, and a splinter for each fragment brought (up to JAR_MAX). */
function buildJar() {
  const g = new THREE.Group();
  g.name = 'thrum.jar';
  g.userData.noCollide = true;
  // (a brass-bound jar with no glass drawn: its foot, its lid and four ribs, so the splinters inside show)
  const brass = makeMaterial({ color: '#c58d4a', flat: true });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14).translate(0, 0.015, 0), brass));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 14).translate(0, 0.32, 0), brass));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; g.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.012).translate(Math.cos(a) * 0.125, 0.165, Math.sin(a) * 0.125), brass)); }
  const geo = new THREE.OctahedronGeometry(0.042, 0).scale(0.75, 1.9, 0.75), mat = makeMaterial({ color: '#dff7ff', glow: 1, flat: true });
  const bits = [];
  for (let i = 0; i < JAR_MAX; i++) {
    const a = i * 2.4, r = 0.03 + 0.06 * ((i * 37) % 10) / 10;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * r, 0.04 + Math.floor(i / 6) * 0.05, Math.sin(a) * r);
    m.rotation.set(i * 0.7, i, i * 0.3);
    m.visible = false;
    g.add(m); bits.push(m);
  }
  return { group: g, show(n) { bits.forEach((b, i) => { b.visible = i < n; }); } };
}

export function setupScientist({ levelId, scene, physics, level, ship = null, npcs = [], lib = null, humans = null, game, items = sharedItems, talkable, dialogue = null, player = null, toast = () => {}, onFit = null }) {
  if (!game) return null;
  const flags = () => game.data?.flags ?? {};
  const fitted = (id) => {
    toast(`${ITEMS[id]?.name ?? id}: fitted`);
    onFit?.(id);
  };
  const def = thrumPerson({ flags, has: (id) => items.has(id), here: levelId, items, onFit: fitted });
  const make = (at, heading) => {
    const npc = new NPC(scene, physics, {
      route: [at.clone()], palette: def.palette, lines: def.lines, lib, human: humans ? humans[0] : null, kind: def.kind,
      scale: def.scale, head: def.head, cape: def.cape, look: def.look, world: def.world, def, speed: 0.6, facing: heading,
    });
    npc.heading = heading;
    npcs.push(npc);
    registerNPCTargets([npc]);
    npc.untalk = talkable?.(npc, def);
    return npc;
  };
  const drop = (npc) => {
    npc.untalk?.();
    const k = npcs.indexOf(npc);
    if (k >= 0) npcs.splice(k, 1);
    npc.show?.(false);
    npc.object.visible = false;
  };
  const rt = { def, aboard: null, field: null, jar: null, pending: false };

  // aboard, by the crates (with the ship parked here)
  const board = () => {
    if (rt.aboard || !ship?.parked || !scene || !physics) return;
    const m = ship.parked;
    const at = ship.world(m, new THREE.Vector3(...ABOARD.at));
    rt.aboard = make(at, ship.worldHeading(m, ABOARD.heading));
    const jar = buildJar();
    jar.group.position.set(...ABOARD.jar);
    m.group.add(jar.group);
    rt.jar = jar;
    jar.show(Math.min(JAR_MAX, fragmentCounts(flags()).found));
  };
  if (game.flag('frag.met')) board();
  const offFrag = game.on?.('fragment', (e) => {
    rt.jar?.show(Math.min(JAR_MAX, e.found));
    if (!game.flag('frag.met')) rt.pending = true;
  });

  /** The first meeting: he comes up beside you, and the talk opens (now, or as soon as nothing else has the screen). */
  rt.meet = () => {
    if (game.flag('frag.met') || rt.field || !player || !scene || !physics) return false;
    const spot = meetSpot({ physics, level, at: player.pos, heading: player.heading ?? 0 })
      ?? { at: player.pos.clone().add(new THREE.Vector3(-Math.sin(player.heading ?? 0) * 2.5, 0, -Math.cos(player.heading ?? 0) * 2.5)), heading: player.heading ?? 0 };
    rt.field = make(spot.at, spot.heading);
    rt.pending = false;
    dialogue?.start(def, rt.field);
    return true;
  };

  rt.update = () => {
    if (rt.pending && !dialogue?.open && !ship?.playing) rt.meet();
    if (rt.field) {
      if (game.flag('frag.met')) board();
      const far = player && rt.field.pos.distanceTo(player.pos) > FIELD_GONE;
      const aboardNow = ship?.parked && player && ship.isInside(ship.parked, player.pos);
      if (!dialogue?.open && game.flag('frag.met') && (far || aboardNow)) { drop(rt.field); rt.field = null; }
    }
  };
  rt.dispose = () => { offFrag?.(); rt.jar?.group.removeFromParent(); };
  return rt;
}

export { THRUM };
