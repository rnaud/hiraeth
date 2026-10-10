import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { gadgetById } from '../gadgets/registry.js';
import { YardKit } from '../gadgets/yard-kit.js';
import { shiftAt, offsetOf } from '../levels/names.js';

// The makers' courts (docs/systems/gadgets.md, "In the worlds"): one in each route world after the desert,
// a paved square of the makers' pale stone where a box holds a gadget, and round it the very things that
// gadget is for: the same pieces as its bay in the Gadget Yard (its module's `yard(kit)`), so the tool is
// useful the moment it is found, and the court's pots of ink and its gate are the reward for using it.
// One gadget a world, in the route's order (src/levels/names.js ORDER): the hook in Vael, the spring boots
// on the Sky Stones' plateau, the gust fan in Lorn (its pinwheels; the skiff's sail), the boomerang in the
// Deep Wood, the bubble wand in Viridel, the ink bridge pen on the City-Shaft's rim, the magnet glove in the
// Hangar, the seeing lens in the Buried Machine (whose canyon hides a bridge of glass), the ink bombs in the
// Garden of Spheres and the recall hourglass in the Signal Market (whose cabs it sends back).
//
// attachCourt(levelId, scene, level) is called by src/temples/index.js attachTemple, at level build, before
// the collision is baked: the pavement and the bay's blocks are solid like the rest of the world; what moves
// or breaks (crates, cracked walls, gates, ropes, pots) joins `level.gadgetWorld` (src/gadgets/world.js), what
// is hit `level.targets`, the lanterns `level.flammables`. The box stands at the court's front, facing the
// way you come (src/boxes/placements.js, `site: courtBox`).
//
// Each court: { gadget, at: [x, z], y: the ground's top there (the pavement sits on it), toward: [x, z] (the
// court's front faces it; default the spawn) }, in its part's own coordinates (a merged world moves a part's:
// courtOf, src/levels/names.js PART_OFFSET); keyed by the part (the old world) it was made for, the Sealed
// Hangar's by the Glass Dunes, where it went with the First Garage. The box's hint and note are its
// placement's (placements.js).

export const COURTS = {
  arzach: { gadget: 'hook', at: [-124, -16], y: 23.1 },
  arzach2: { gadget: 'springs', at: [-22, -60], y: 40.8, toward: [0, 22] },   // (facing the plateau's old landing: the ship comes down on Vael's plain now)
  perdide: { gadget: 'fan', at: [80, 8], y: 2.3 },
  perdide2: { gadget: 'boomerang', at: [86, -136], y: 0.6, toward: [0, 0] },   // (facing the Deep Wood's way in, its island)
  edena: { gadget: 'bubble', at: [-70, -64], y: 0 },
  incal: { gadget: 'bridge', at: [362, 10], y: 200 },
  // (the Sealed Hangar's, at [-86, 120] on its plain until October 2026: it went to the Glass Dunes with the First Garage)
  glassdunes: { gadget: 'magnet', at: [60, -140], y: null, toward: [10, -60] },
  buried: { gadget: 'monocle', at: [-88, 38], y: 6.4 },
  spheres: { gadget: 'bomb', at: [-58, -70], y: 1.1 },
  bazaar: { gadget: 'recall', at: [86, 66], y: 0 },
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
  // the band (flush with the top, a hair over it so it reads as inlaid), and the glyph: three dots over an arch
  for (const [bw, bd, x, z] of [[w, 0.35, 0, front - 0.18], [w, 0.35, 0, -back + 0.18], [0.35, d, w / 2 - 0.18, cz], [0.35, d, -w / 2 + 0.18, cz]]) add(new THREE.BoxGeometry(bw, 0.03, bd), M.blue, x, 0.005, z).userData.noCollide = true;
  const gz = COURT.box - 2.4;
  for (const x of [-0.7, 0, 0.7]) add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), M.glow, x, 0.006, gz - (x ? 0 : 0.25)).userData.noCollide = true;
  const arch = add(new THREE.TorusGeometry(0.95, 0.07, 4, 24, Math.PI).rotateX(-Math.PI / 2), M.blue, 0, 0.006, gz + 0.9);
  arch.userData.noCollide = true;
}

/**
 * Build this world's court into the level (if it has one and its gadget is registered): the pavement, the
 * gadget's bay, its loose things for src/gadgets/world.js. Returns the court ({ gadget, frame, box }) or null.
 * `clear(scene, circles)` scales away the world's own trees and rocks standing where the court is.
 */
export function attachCourt(levelId, scene, level, { clear = null, courts = COURTS } = {}) {
  const c = courtOf(levelId, courts), def = c && gadgetById(c.gadget);
  if (!c || !def?.yard || !level) return null;
  const frame = courtFrame(c, level);
  const yard = new YardKit(scene);
  const kit = yard.bay(frame.origin, frame.yaw);
  kit.gadget = def.id;
  kit.flag = () => {};   // (the Yard's banner and statue: not out in a world, where the box is the sign)
  kit.group.name = `Makers’ court (${def.id})`;
  pavement(kit.group);
  try { def.yard(kit); } catch (e) { console.warn('makers’ court', def.id, e); }
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
  const box = courtBoxSite(frame);
  const court = { id: levelId, gadget: def.id, frame, box, group: kit.group };
  (level.finds ??= {}).court = court;
  (level.finds.courts ??= {})[levelId] = court;
  const circle = { x: frame.origin.x - Math.sin(frame.yaw) * (COURT.back - COURT.front) / 2, z: frame.origin.z - Math.cos(frame.yaw) * (COURT.back - COURT.front) / 2, r: COURT.clear };
  clear?.(scene, [circle], kit.group);
  const avoid = level.floraAvoid;
  level.floraAvoid = (x, z, r = 0) => Math.hypot(x - circle.x, z - circle.z) < circle.r + r || !!avoid?.(x, z, r);
  return court;
}
