import { glyphGeometry } from '../story/sign-text.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { gadgetById } from '../gadgets/registry.js';
import { YardKit } from '../gadgets/yard-kit.js';
import { shiftAt, offsetOf } from '../levels/names.js';
import { ghostPath, ghostBridge } from '../gadgets/hidden.js';

// The makers' courts (docs/systems/gadgets.md, "In the worlds"): one in each route world after the desert,
// a paved square of the makers' pale stone where a box holds a gadget, and round it the very things that
// gadget is for: the same pieces as its bay in the Gadget Yard (its module's `yard(kit)`), so the tool is
// useful the moment it is found, and the court's pots of ink and its gate are the reward for using it.
// One gadget a court, in the route's order (src/levels/names.js ORDER; a merged world keeps its parts' two):
// in Vael the hook, and the spring boots on its sky stones' plateau; in Lorn the gust fan (its pinwheels; the
// skiff's sail), and the boomerang in its Deep Wood; the bubble wand in Viridel, the ink bridge pen on the
// City-Shaft's rim, the magnet glove in the Glass Dunes (the Sealed Hangar's, before it left the route), the
// seeing lens in the Buried Machine (whose canyon hides a bridge of glass), the ink bombs in the Garden of
// Spheres and the recall hourglass in the Signal Market (whose cabs it sends back).
// The three worlds of v1.40 got theirs in v1.48 (issue #101), each with a gadget found two or more worlds before it and a
// bay of its own (`bay`: BAYS below, not the gadget's Yard bay): the divers' court in a dome of its own off the
// Underwater City's Plaza (the bubble wand: a crate floated over a wall into a pit), the founders' yard on the Moon
// Foundry's apron (the magnet glove: an iron crate lifted out of its cage and carried to the pit), the moorers' yard on
// an island of its own west of the floating city's Gate (the hook: a crate dragged down off a pillar and pushed onto
// the plate). Their gadget is already yours, so their box is no gadget's: it waits behind the gate the puzzle opens
// (`boxAt`, in the court's own frame), with a charm for that gadget in it.
//
// attachCourt(levelId, scene, level) is called by src/temples/index.js attachTemple, at level build, before
// the collision is baked: the pavement and the bay's blocks are solid like the rest of the world; what moves
// or breaks (crates, cracked walls, gates, ropes, pots) joins `level.gadgetWorld` (src/gadgets/world.js), what
// is hit `level.targets`, the lanterns `level.flammables`. The box stands at the court's front, facing the
// way you come (src/boxes/placements.js, `site: courtBox`).
//
// v1.86 (issue #518, the author: "Little chests should always be a rewards for puzzles completion. And I should have all
// the tools available at that moment in the game to open them"): #375 had left most courts' boxes at their front edge,
// ungated, beside a bay for a gadget earned worlds later, and four bays with no box. Now every court is a puzzle of a
// tool you have when you reach its world (`needs`: an item; the route's order checks it, tests/boxes.test.js), and its
// box waits behind what that puzzle opens (`boxAt`): Vael's two pull-rings for the hook and its sky stones' glide for the
// wings, Lorn's jaws for the stilling and its Deep Wood's poles for the bubble wand, Viridel's ledge plate, the
// City-Shaft's span for the bridge pen, the Glass Dunes' three eyes in one throw of the boomerang, the Buried Machine's
// cracked wall for the bombs and the Garden's glass path for the seeing lens (the two swapped bays), the Signal Market's
// ledge for the recall hourglass.
//
// Each court: { needs, gadget, at: [x, z], y: the ground's top there (the pavement sits on it), toward: [x, z] (the
// court's front faces it; default the spawn), bay (BAYS: a bay of its own), boxAt (the box, in the court's frame) },
// in its part's own coordinates (a merged world moves a part's:
// courtOf, src/levels/names.js PART_OFFSET); keyed by the part (the old world) it was made for, the Sealed
// Hangar's by the Glass Dunes, where it went with the First Garage. The box's hint and note are its
// placement's (placements.js).

/** The box in the alcove behind a bay's gate (alcove below), in the court's frame. */
const ALCOVE = [-5, 0, -7.4];
export const COURTS = {
  // (v1.86, issue #518: two pull-rings high on sheer posts, tugged with the hook (Vael's Founders' Belfry))
  arzach: { needs: 'hook', gadget: 'hook', at: [-124, -16], y: 23.1, bay: 'ringers', boxAt: ALCOVE },
  // (the spring boots' bay until v1.86, the boots four worlds on; the wings', Vael's Aerie's, now: a glide to a sheer pillar)
  arzach2: { needs: 'glider', at: [-22, -60], y: 40.8, toward: [0, 22], bay: 'riders', boxAt: ALCOVE },   // (facing the plateau's old landing: the ship comes down on Vael's plain now)
  // (the gust fan's until v1.86, the fan four worlds on; the stilling's, the Hush-House's, now: jaws across the alcove)
  perdide: { needs: 'stun', at: [80, 8], y: 2.3, bay: 'hush', boxAt: ALCOVE },
  // (the boomerang's until v1.86, three worlds on; the bubble wand's, the Lamp-House's, now: two lamps on sheer poles)
  perdide2: { needs: 'bubble', gadget: 'bubble', at: [86, -136], y: 0.6, toward: [0, 0], bay: 'lamps', boxAt: ALCOVE },   // (facing the Deep Wood's way in, its island)
  // (the bubble wand's own Yard bay: its box in the bay's alcove, behind the gate the ledge's plate opens)
  edena: { needs: 'bubble', gadget: 'bubble', at: [-70, -64], y: 0, boxAt: [2.5, 0, -8.1] },
  incal: { needs: 'bridge', gadget: 'bridge', at: [362, 10], y: 200, bay: 'span', boxAt: ALCOVE },
  // (the Sealed Hangar's, at [-86, 120] on its plain until October 2026: it went to the Glass Dunes with the First Garage;
  // the magnet glove's until v1.86, the glove two worlds on; the boomerang's, the Clock-House's, now)
  glassdunes: { needs: 'boomerang', gadget: 'boomerang', at: [60, -140], y: null, toward: [10, -60], bay: 'clock', boxAt: ALCOVE },
  // (the seeing lens's until v1.86, the lens two worlds on: swapped with the Garden's; the ink bombs' Yard bay now, the
  // Engine-House's, its box in the alcove behind the cracked wall)
  buried: { needs: 'bomb', gadget: 'bomb', at: [-200, 12], y: 3, boxAt: [-2.6, 0, -7.9] },
  // (the bombs' until v1.86; the seeing lens's now, the Footprint's: its box on the far tower, over the glass path)
  spheres: { needs: 'monocle', gadget: 'monocle', at: [-58, -70], y: 1.1, bay: 'glass', boxAt: [6.5, 6, -6] },
  // (a box at last, v1.86: a crate on a sheer ledge, knocked down and sent back up with the recall hourglass)
  bazaar: { needs: 'recall', gadget: 'recall', at: [86, 66], y: 0, bay: 'sand', boxAt: ALCOVE },
  // (v1.48, issue #101: the three of v1.40, a gadget you have by then, a bay of their own and the box behind its gate)
  underwater: { needs: 'bubble', gadget: 'bubble', at: [-90, -108], y: 0, toward: [-60, -108], bay: 'divers', boxAt: ALCOVE },   // (its own dome west of the Plaza, the tube's door east)
  moonfoundry: { needs: 'magnet', gadget: 'magnet', at: [-56, 86], y: null, toward: [0, 94], bay: 'founders', boxAt: ALCOVE },   // (on the apron west of the way in)
  spacecity: { needs: 'hook', gadget: 'hook', at: [-77, 30], y: 0, toward: [-40, 30], bay: 'moorers', boxAt: ALCOVE },   // (the Yard, its island west of the Gate)
};

/**
 * The bays of the courts whose gadget you already have (`bay`): the same pieces as a Yard bay (src/gadgets/yard-kit.js),
 * another puzzle, and an alcove at the back whose gate the puzzle holds open, the box inside it (`boxAt`).
 */
function alcove(kit, plates, gate = {}) {
  // walls either side, a roof, a back wall; its gate across the front, open while any of `plates` is pressed (or as
  // `gate` says: every plate, `all`; something else, `when()`; for good once open, `latch`: src/gadgets/yard-kit.js)
  kit.block([0.6, 2.8, 3.6], [-7.3, 1.4, -7.4]); kit.block([0.6, 2.8, 3.6], [-2.7, 1.4, -7.4]); kit.block([5.2, 0.4, 3.6], [-5, 3, -7.4]);
  kit.block([5.2, 2.8, 0.6], [-5, 1.4, -9.5]);
  kit.lamp([-3.4, 3.2, -6]);
  kit.gate([4, 2.6, 0.25], [-5, 1.3, -5.45], { plates, ...gate });
}
/** A block nobody can climb (src/physics.js: baked noClimb): the courts' sheer pillars. */
const sheer = (kit, size, c, o = {}) => { const m = kit.block(size, c, { mat: 'pale', ...o }); m.userData.noClimb = true; return m; };
/** A plate up a climb that stays down once pressed (src/gadgets/world.js `latch`). */
const latchPlate = (kit, at, o = {}) => { const i = kit.plate(at, o); kit.spec.plates[i].latch = true; return i; };
export const BAYS = {
  /**
   * The ringers' court (Vael, the grappling hook, v1.86): two pull-rings on the caps of sheer posts, 6 m up; tug each with
   * the hook (they stay rung) and the gate opens for good.
   */
  ringers(kit) {
    const rings = [[1.5, -7.5], [6.5, -2]].map(([x, z]) => {
      sheer(kit, [0.9, 6, 0.9], [x, 3, z]);
      return kit.seal([x, 6, z], { height: 0.25, test: (mode, info) => info?.mode === 'hook' });
    });
    alcove(kit, [], { when: () => rings.every((r) => r.isLit()), latch: true });
    // a ring on a tall pole in the open, an ink pot on its cap: swing up to it
    kit.pole([-1, 0, 3.5], 8);
    kit.anchor([-1, 7.8, 4.66], { normal: [0, 0, 1] });
    kit.pickup([-1, 8, 3.5], { amount: 2 });
  },
  /**
   * The riders' court (Vael's sky stones, the wings, v1.86): a tower to climb, 10.5 m, and 15 m off a sheer pillar, 6.5 m,
   * a plate on its cap: glide across from the tower's top and land on it, and the gate opens for good.
   */
  riders(kit) {
    kit.block([3, 10.5, 3], [8, 5.25, -7.5]);
    kit.lamp([8, 10.5, -7.5]);
    sheer(kit, [2.2, 6.5, 2.2], [-3.5, 3.25, 3]);
    const plate = latchPlate(kit, [-3.5, 6.5, 3], { radius: 0.85 });
    alcove(kit, [plate], { latch: true });
  },
  /**
   * The hush court (Lorn, the stilling mode, v1.86): jaws of teeth hang over the alcove's gate, their eye on the lintel;
   * a stilling glob holds them open for good.
   */
  hush(kit) {
    const jaws = kit.seal([-5, 3.2, -5.1], { accepts: ['stun'], test: (mode) => mode === 'stun', height: 0.05, post: false });
    alcove(kit, [], { when: () => jaws.isLit(), latch: true });
    // the jaws' teeth along the lintel (ink, hanging)
    for (let k = 0; k < 7; k++) kit.block([0.18, 0.5, 0.18], [-6.6 + k * 0.53, 2.55, -5.25], { mat: 'ink' });
    kit.crate([3, 0.45, -3]); kit.crate([4.2, 0.45, -2.2]);
    kit.lamp([6, 0, -8]);
  },
  /**
   * The lamp court (Lorn's Deep Wood, the bubble wand, v1.86): two sheer poles, 6.2 m (over a double jump's 4.8), a plate
   * on each cap: float up to each in a bubble and stand on it; both pressed (they stay down), the gate opens for good.
   */
  lamps(kit) {
    const plates = [[2, -6.5], [7, -1.5]].map(([x, z]) => {
      sheer(kit, [1.3, 6.2, 1.3], [x, 3.1, z]);
      kit.lamp([x + 0.45, 6.2, z - 0.45]);
      return latchPlate(kit, [x - 0.15, 6.2, z + 0.15], { radius: 0.55 });
    });
    alcove(kit, plates, { all: true, latch: true });
    kit.crate([-1, 0.45, 2.5]);
  },
  /**
   * The span court (the City-Shaft, the bridge pen, v1.86): a tower to climb, 6 m, and 11 m off a sheer one as tall with a
   * plate on its cap: draw a bridge across and step on it, and the gate opens for good.
   */
  span(kit) {
    kit.block([3, 6, 3], [7.5, 3, -7.5]);
    kit.lamp([8.4, 6, -8.4]);
    sheer(kit, [2.6, 6, 2.6], [-1, 3, 3.5]);
    const plate = latchPlate(kit, [-1, 6, 3.5], { radius: 0.85 });
    alcove(kit, [plate], { latch: true });
  },
  /**
   * The clock court (the Glass Dunes, the boomerang, v1.86): three eyes on posts in an arc, each shut again 3 s after it
   * is struck: wake all three in one throw (lock on to each), and the gate opens for good.
   */
  clock(kit) {
    const eyes = [[1, -8.5], [5, -6.5], [7.5, -2]].map(([x, z]) => kit.seal([x, 0, z], { test: (mode, info) => info?.source === 'boomerang', hold: 3 }));
    alcove(kit, [], { when: () => eyes.every((e) => e.isLit()), latch: true });
    kit.crate([-1, 0.45, 3]);
  },
  /**
   * The glass court (the Garden of Spheres, the seeing lens, v1.86): two towers 6 m tall, 13 m apart; a plank bridge
   * straight across is a lie (it is not there under the glass), the true way a path of glass winding behind it, held up
   * only while the lens is. The box waits on the far tower, which can't be climbed.
   */
  glass(kit) {
    const H = 6;
    kit.block([2.6, H, 2.8], [-6.5, H / 2, -6]);
    kit.steps([-6.5, 0, 2.6], H, { width: 1.8, rise: 0.5, run: 0.72 });
    sheer(kit, [2.8, H, 3], [6.5, H / 2, -6], { mat: 'stone' });
    ghostBridge(kit.group, [-5.2, H, -5.6], [5.1, H, -5.6], { illusion: true, material: kit.mats.wood, sag: 0.25, posts: false, width: 1.3 });
    ghostPath(kit.group, [[-5.2, H, -7.0], [-3.2, H + 0.15, -8.4], [-0.8, H + 0.3, -9.1], [1.8, H + 0.3, -8.9], [3.8, H + 0.15, -8.0], [5.1, H, -7.0]], { width: 1.5, depth: 1.6, id: 'court.spheres.path' });
  },
  /**
   * The sand court (the Signal Market, the recall hourglass, v1.86): a ledge 6.5 m up, sheer, a crate at its lip and a plate
   * at its back: knock the crate down, stand on it and send it back up along its own fall, step on the plate, and the gate
   * opens for good.
   */
  sand(kit) {
    sheer(kit, [5, 6.5, 3.6], [5.5, 3.25, -8]);
    kit.crate([5.5, 6.95, -6.65]);
    const plate = latchPlate(kit, [6.5, 6.5, -8.9], { radius: 0.7 });
    kit.lamp([3.6, 6.5, -9.2]);
    alcove(kit, [plate], { latch: true });
  },
  /** The divers' court (the bubble wand): a pit walled round 3.2 m high; float a crate up over its wall and pop the bubble. */
  divers(kit) {
    const pit = [3.5, -6.5], h = 3.2;
    kit.block([4.4, h, 0.5], [pit[0], h / 2, pit[1] - 2]); kit.block([4.4, h, 0.5], [pit[0], h / 2, pit[1] + 2]);
    kit.block([0.5, h, 3.5], [pit[0] - 2, h / 2, pit[1]]); kit.block([0.5, h, 3.5], [pit[0] + 2, h / 2, pit[1]]);
    const plate = kit.plate([pit[0], 0, pit[1]], { radius: 1.2, things: true });   // (a crate presses it; you can't get in)
    alcove(kit, [plate]);
    kit.crate([3.2, 0.45, -1.2]); kit.crate([6.4, 0.45, -2.4]);
    // a pole with a lamp past what can be climbed: float yourself up beside it
    kit.pole([7.5, 0, 2.5], 6.4);
    kit.lamp([7.5, 6.4, 2.5]);
    kit.pickup([7.5, 6.6, 2.5], { amount: 2 });
  },
  /** The founders' yard (the magnet glove): an iron crate in a cage too high to climb into; lift it out and carry it to the pit. */
  founders(kit) {
    const cage = [5.5, 1.5], h = 3.4;
    kit.block([3.6, h, 0.4], [cage[0], h / 2, cage[1] - 1.6]); kit.block([3.6, h, 0.4], [cage[0], h / 2, cage[1] + 1.6]);
    kit.block([0.4, h, 2.8], [cage[0] - 1.6, h / 2, cage[1]]); kit.block([0.4, h, 2.8], [cage[0] + 1.6, h / 2, cage[1]]);
    kit.crate([cage[0], 0.5, cage[1]], { metal: true });
    const pit = [3, -6.8], ph = 3;
    kit.block([4.4, ph, 0.5], [pit[0], ph / 2, pit[1] - 2]); kit.block([4.4, ph, 0.5], [pit[0], ph / 2, pit[1] + 2]);
    kit.block([0.5, ph, 3.5], [pit[0] - 2, ph / 2, pit[1]]); kit.block([0.5, ph, 3.5], [pit[0] + 2, ph / 2, pit[1]]);
    const plate = kit.plate([pit[0], 0, pit[1]], { mass: 3, things: true });   // (only iron presses it)
    alcove(kit, [plate]);
    // an iron block on a pillar over the court: pull yourself up to it, an ink pot on its cap
    kit.block([1.2, 6.4, 1.2], [8.4, 3.2, -4]);
    kit.ironBlock([1.6, 1.6, 1.6], [8.4, 7.2, -4]);
    kit.pickup([8.4, 8, -4], { amount: 2 });
  },
  /** One optional load puzzle: hook/carry the high crate, or push/carry the ground spare. */
  moorers(kit) {
    sheer(kit, [2.4, 6, 2.4], [5.5, 3, -6]);
    const high = kit.crate([5.5, 6.45, -6]);
    const spare = kit.crate([2.2, 0.45, 3]);
    // These two props alone return after being genuinely lost. Normal manipulation
    // across the court, all held modes, and approaching a lost crate remain valid.
    for (const object of [high, spare]) {
      kit.spec.props.find(p => p.object === object).recovery = {
        center: kit.at([0, 0, 0]), radius: 24, minY: kit.at([0, -5, 0]).y, delay: 2, clearance: 3,
      };
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.34), kit.mats.teal);
      mark.position.y = 0.485; mark.userData.noCollide = true; object.add(mark);
    }
    const plate = kit.plate([2.2, 0, -1.5], { radius: 1.1, things: true });
    // Save the actual solve before the reward, and honor already-collected rewards
    // from older saves. Reloading inside must not close the return doorway.
    alcove(kit, [plate], { latch: true, latchFlag: 'court.spacecity.solved', legacyOpenFlag: 'box.spacecity.court' });
    // Low guides leave a 2.6 m walking/carry lane; both ends remain open.
    for (const x of [0.7, 3.7]) kit.block([0.3, 0.22, 4.8], [x, 0.11, 1], { mat: 'pale' });
    // The same teal load mark leads from the plate toward the gate. Raised inlay
    // is deliberately non-colliding and slightly above the paving, not coplanar.
    for (const [size, at] of [ [[5.5, 0.025, 0.1], [-0.55, 0.025, -3.1]], [[0.1, 0.025, 2], [-3.25, 0.025, -4.1]] ]) {
      kit.block(size, at, { mat: 'teal' }).userData.noCollide = true;
    }
    // Existing optional traversal prize is unchanged.
    kit.pole([7.8, 0, 3], 10.5);
    kit.anchor([7.8, 5.2, 3.3], { normal: [0, 0, 1] });
    kit.anchor([7.8, 10.3, 3.86], { normal: [0, 0, 1] });
    kit.pickup([7.8, 10.6, 3], { amount: 2 });
  },
};

/** The court's pavement in its own frame: x across ±w/2, z from -back (away) to +front (toward you); the box `box` m out. */
export const COURT = { w: 21, back: 14, front: 10.5, thick: 0.35, skirt: 2.4, box: 8.2, clear: 18 };

/** Where a court stands: its origin (the pavement's top, its middle) and its yaw (local +z toward `toward`). */
export function courtFrame(c, level) {
  const [x, z] = c.at;
  const to = c.toward ?? [level?.spawn?.x ?? 0, level?.spawn?.z ?? 0];
  const yaw = Math.atan2(to[0] - x, to[1] - z);
  // (y null: on the ground there, its lowest under the pavement)
  const y = c.y ?? level?.ground?.baseAt?.(x, z, COURT.w / 2) ?? 0;
  return { origin: new THREE.Vector3(x, y + COURT.thick, z), yaw };
}

/** A court's box behind its gate (`boxAt`, in the court's frame): { at, face } facing out of the alcove. */
export function courtBoxAt(frame, [x, y, z]) {
  const p = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), frame.yaw).add(frame.origin);
  return { at: [p.x, p.y, p.z], face: frame.yaw };
}
/** The box's spot on a court: { at: [x, y, z], face } (src/boxes/placements.js reads it from level.finds). */
export function courtBoxSite(frame) {
  const f = new THREE.Vector3(Math.sin(frame.yaw), 0, Math.cos(frame.yaw));
  const p = frame.origin.clone().addScaledVector(f, COURT.box);
  return { at: [p.x, p.y, p.z], face: frame.yaw };
}

/** A court where it stands in its world (its part's offset added), or null. */
export function courtOf(id, courts = COURTS) {
  const c = courts[id];
  if (!c) return null;
  const o = offsetOf(id);
  if (!o[0] && !o[1] && !o[2]) return c;
  return { ...c, at: shiftAt(id, c.at), y: c.y + o[1], ...(c.toward ? { toward: shiftAt(id, c.toward) } : {}) };
}
/** The box placement's site (placements.js `site`): the court built into this level, else nothing. */
export const courtBox = (level) => level?.finds?.court?.box ?? null;
/** The same for a world with more than one court (a merged world): the court made for `id`. */
export const courtBoxOf = (id) => (level) => level?.finds?.courts?.[id]?.box ?? (level?.finds?.court?.id === id ? level.finds.court.box : null);

let mats = null;
const courtMats = () => (mats ??= {
  pave: makeMaterial({ color: '#e9dcc0', color2: '#ddcda9', color3: '#cdb98f' }),
  skirt: makeMaterial({ color: '#cbb894', color2: '#b9a37c', color3: '#a58f68' }),
  blue: makeMaterial({ color: '#3d6fa8', flat: true }),
  glow: makeMaterial({ color: '#bfe9ff', flat: true, glow: 0.8 }),
});

/** The pavement: a slab of pale stone, a band of the makers' blue round its top, a skirt down into the ground, the glyph by the box. */
function pavement(group) {
  const M = courtMats(), { w, back, front, thick, skirt } = COURT, d = back + front, cz = (front - back) / 2;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); group.add(m); return m; };
  add(new THREE.BoxGeometry(w, thick, d), M.pave, 0, -thick / 2, cz);
  add(new THREE.BoxGeometry(w - 0.3, skirt, d - 0.3), M.skirt, 0, -thick - skirt / 2 + 0.01, cz);
  // the band (flush with the top, a hair over it so it reads as inlaid), and the glyph: an open corner beside a shorter upright
  for (const [bw, bd, x, z] of [[w, 0.35, 0, front - 0.18], [w, 0.35, 0, -back + 0.18], [0.35, d, w / 2 - 0.18, cz], [0.35, d, -w / 2 + 0.18, cz]]) add(new THREE.BoxGeometry(bw, 0.03, bd), M.blue, x, 0.005, z).userData.noCollide = true;
  const gz = COURT.box - 2.4;
  add(glyphGeometry(1.7, 0.025).rotateX(-Math.PI / 2), M.blue, 0, 0.025, gz + 0.35).userData.noCollide = true;
}

/**
 * Build this world's court into the level (if it has one and its gadget is registered): the pavement, the
 * gadget's bay, its loose things for src/gadgets/world.js. Returns the court ({ gadget, frame, box }) or null.
 * `clear(scene, circles)` scales away the world's own trees and rocks standing where the court is.
 */
export function attachCourt(levelId, scene, level, { clear = null, courts = COURTS } = {}) {
  const c = courtOf(levelId, courts), def = c?.gadget ? gadgetById(c.gadget) : null;
  // (a bay of its own needs no gadget's: the wings' and the stilling's courts, issue #518)
  const build = c?.bay ? BAYS[c.bay] : def?.yard;
  if (!c || !build || !level || (c.gadget && !def)) return null;
  const frame = courtFrame(c, level);
  const yard = new YardKit(scene);
  const kit = yard.bay(frame.origin, frame.yaw);
  const tool = def?.id ?? c.needs;
  kit.gadget = tool;
  kit.flag = () => {};   // (the Yard's banner and statue: not out in a world, where the box is the sign)
  kit.group.name = `Makers’ court (${tool})`;
  pavement(kit.group);
  try { build.call(def, kit); } catch (e) { console.warn('makers’ court', tool, e); }
  kit.group.updateMatrixWorld(true);
  const { gadgetYard: spec, targets, flammables } = yard.out();
  spec.pen = null;   // (the Yard's pen of blots: out here the wilds have their own)
  const into = (level.gadgetWorld ??= {});
  // (gates name their plates, ropes their crates, by index into these lists: shifted past what a level had already)
  const plateBase = into.plates?.length ?? 0, propBase = into.props?.length ?? 0;
  for (const g of spec.gates ?? []) if (g.plates) g.plates = g.plates.map((i) => i + plateBase);
  for (const r of spec.ropes ?? []) if (typeof r.prop === 'number') r.prop += propBase;
  for (const [k, v] of Object.entries(spec)) if (Array.isArray(v)) (into[k] ??= []).push(...v);
  (level.targets ??= []).push(...targets);
  (level.flammables ??= []).push(...flammables);
  const box = c.boxAt ? courtBoxAt(frame, c.boxAt) : courtBoxSite(frame);
  const court = { id: levelId, gadget: tool, needs: c.needs ?? tool, frame, box, group: kit.group };
  (level.finds ??= {}).court = court;
  (level.finds.courts ??= {})[levelId] = court;
  const circle = { x: frame.origin.x - Math.sin(frame.yaw) * (COURT.back - COURT.front) / 2, z: frame.origin.z - Math.cos(frame.yaw) * (COURT.back - COURT.front) / 2, r: COURT.clear };
  clear?.(scene, [circle], kit.group);
  const avoid = level.floraAvoid;
  level.floraAvoid = (x, z, r = 0) => Math.hypot(x - circle.x, z - circle.z) < circle.r + r || !!avoid?.(x, z, r);
  return court;
}
