import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { buildRoom, portalPair } from './interiors.js';
import { textGeometry } from './story/sign-text.js';
import { crystalGeometry } from './chimes.js';

// The interior kit (docs/systems/interiors.md): a building you walk into and play inside. One call gives a
// door in the world (a shopfront: a plastered house with its door, an awning, a name board over the door and
// a hanging sign), the room it opens on, and the two ways between them. It is the doorway mechanism the
// desert's masked head, the giant's chest and the Hearth already use, made reusable:
//
//  - the room is real geometry (src/interiors.js buildRoom: walls with door and window openings, floor,
//    ceiling, a lamp), built far over the map at the interior's slot (INTERIOR.y), so a building of any size
//    can open on a room of any size, and the outside is never drawn while you are in it (perf.js
//    InteriorCuller) nor the room while you are out (RoomCuller): main.js finds both from the portals;
//  - the ways through are two portals (portalPair) in the level's `portals`, so the passage carries you
//    across as at every other door (src/passage.js: the room drawn ahead, unseen, by WarmDraw at load and as
//    you come near; the paper sweep; you land still walking), the camera frames the room tight
//    (src/player.js, inTightRoom), no rain falls in it, no mount or taxi is called into it, and the scout
//    routes its finds out through the door (src/scout.js viaPortal: "Through the shop door");
//  - inside, `interiorAt(p)` says which interior a point is in: the HUD names it as you step in (the cue's
//    place name, main.js), the world's light and sound are the door's (not the slot's, far overhead), and a
//    save made inside loads inside (the slot is fixed: the same room is built in the same place every load).
//
//   const shop = buildInterior(scene, {
//     id: 'qanat.shop', label: 'Haddu’s Chimes & Cures' (the cue's place name inside), doorLabel: 'shop door', slot: 0,
//     door: { at: Vector3 (the threshold, on the ground), heading (out of the door) },
//     front: { w, d, h, wall, trim, dome, awning: [c1, c2], sign: 'CHIMES AND CURES', emblem: 'chime' },
//     room: { w, d, h, windows, wall, floor, ... }   (src/interiors.js buildRoom's options)
//   });
//   level.portals.push(...shop.portals); level.lights.push(...shop.lights);
//   shop.local(x, y, z) → a world point in the room's frame (floor y 0, the door in its +z wall)

/** Where the interiors' rooms are built: high over every temple's rooms (their origins reach 2400 m). */
export const INTERIOR = { y: 3000, x0: -900, z0: 900, step: 90, row: 20 };

/** The world point an interior's room is built at, by its slot (fixed per world, so a save inside loads inside). */
export function interiorSlot(i) {
  const k = Math.max(0, Math.floor(i));
  return new THREE.Vector3(INTERIOR.x0 + (k % INTERIOR.row) * INTERIOR.step, INTERIOR.y, INTERIOR.z0 + Math.floor(k / INTERIOR.row) * INTERIOR.step);
}

const INTERIORS = [];
const _lp = new THREE.Vector3();

/** The interior a world point is in (its room, a little margin round the walls), or null. */
export function interiorAt(p, margin = 0.4) {
  if (!p) return null;
  for (let i = INTERIORS.length - 1; i >= 0; i--) {
    const it = INTERIORS[i];
    if (!it.room.group.parent) { INTERIORS.splice(i, 1); continue; }   // (gone with its level)
    _lp.copy(p).applyMatrix4(it.inv);
    const r = it.size;
    if (Math.abs(_lp.x) < r.w / 2 + margin && _lp.z > -r.d / 2 - margin && _lp.z < r.d / 2 + 1.6 && _lp.y > -1.5 && _lp.y < r.h + 0.5) return it;
  }
  return null;
}
/** Every interior standing now. */
export const interiors = () => INTERIORS.filter((it) => it.room.group.parent);

// ------------------------------------------------------------------ the shopfront

// (the plaster as Qanat's own walls: broad strata, weathered, no grid of blocks)
const strata = (color, color2 = color, color3 = '#f6e6d6', o = {}) => makeMaterial({ color, color2, color3, mode: MODE_STRATA, strataSize: 2.4, flat: true, weathered: true, ...o });

/**
 * The name board's face, painted: ink letters on cream with a ruled line (a canvas texture, the game's own
 * monospace face), or null where there is no canvas (node's tests: the board gets block letters instead).
 */
function boardTexture(text, sub, w, h) {
  const doc = globalThis.document;
  const c = doc?.createElement?.('canvas');
  const g = c?.getContext?.('2d');
  if (!g) return null;
  c.width = 1024; c.height = Math.round(1024 * h / w);
  const W = c.width, H = c.height;
  g.fillStyle = '#f7ecd2'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2b211f'; g.lineWidth = 14; g.strokeRect(7, 7, W - 14, H - 14);
  g.fillStyle = '#2b211f'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = Math.round(H * (sub ? 0.5 : 0.62));
  const name = String(text).toUpperCase();
  do { g.font = `900 ${size}px ui-monospace, Menlo, monospace`; size -= 2; } while (g.measureText(name).width > W - 80 && size > 16);
  g.fillText(name, W / 2, H * (sub ? 0.4 : 0.52));
  if (sub) { g.font = `italic 700 ${Math.round(H * 0.24)}px ui-monospace, Menlo, monospace`; g.fillStyle = '#8a4a2c'; g.fillText(sub, W / 2, H * 0.76); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Boxes of a wall (length L, height H, thickness T) round rectangular holes { x0, x1, y0, y1 } (x along it from its left end). */
export function wallBoxes(L, H, T, holes) {
  const xs = [0, L, ...holes.flatMap((h) => [h.x0, h.x1])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (b - a < 1e-3) continue;
    const mid = (a + b) / 2;
    const cut = holes.filter((h) => h.x0 <= mid && h.x1 >= mid).sort((p, q) => p.y0 - q.y0);
    let y = 0;
    for (const h of [...cut, { y0: H, y1: H }]) {
      if (h.y0 - y > 1e-3) out.push(new THREE.BoxGeometry(b - a, h.y0 - y, T).translate(mid - L / 2, (y + h.y0) / 2, 0));
      y = Math.max(y, h.y1);
    }
  }
  return out;
}

/** The chimes' own sign: a big cyan crystal (src/chimes.js crystalGeometry) in a brass ring, flat to the street, facing ±x. */
function chimeEmblem(r = 0.5) {
  return {
    rim: new THREE.TorusGeometry(r * 0.86, 0.04, 5, 24).rotateY(Math.PI / 2),
    crystal: crystalGeometry(r * 1.45, 5).rotateZ(-0.42).scale(1, 1, 0.5).rotateY(Math.PI / 2),
  };
}

/**
 * A shopfront: a plastered house with its door (a lit recess you walk into), a striped awning over it, a name
 * board above (block letters) and a hanging sign on a bracket. Local frame: the threshold at the origin on the
 * ground, +z out of the door. Returns { group, lights, door (the threshold, world), heading, lantern }.
 */
export function buildShopfront(scene, {
  at, heading = 0, w = 7, d = 6, h = 4.4, sink = 1.6, door = { w: 1.6, h: 2.6, x: 0 },
  wall = '#efd9bd', wall2 = '#e6c6a2', trim = '#c8673f', dome = '#e88fa6', awning = ['#c8483a', '#f3ead8'],
  sign = 'SHOP', signSub = '', emblem = 'chime', glow = '#ffd9a0', windows = [{ x: -2.3, y: 1.0, w: 1.1, h: 1.3 }, { x: 2.3, y: 1.0, w: 1.1, h: 1.3 }],
} = {}) {
  const grp = new THREE.Group();
  grp.position.copy(at);
  grp.rotation.y = heading;
  const T = 0.6;   // the front wall's thickness: the door and the windows are recesses this deep
  const W = [], P = [], I = [], A0 = [], A1 = [], B = [], G = [];
  // the body behind the front wall (solid: you can climb it and stand on the roof), sunk into the ground
  W.push(new THREE.BoxGeometry(w, h + sink, d - T).translate(0, (h - sink) / 2, -T - (d - T) / 2));
  // the front wall with its door and window holes (x from the wall's left end, seen from the street)
  const holes = [{ x0: w / 2 + door.x - door.w / 2, x1: w / 2 + door.x + door.w / 2, y0: 0, y1: door.h }, ...windows.map((v) => ({ x0: w / 2 + v.x - v.w / 2, x1: w / 2 + v.x + v.w / 2, y0: v.y, y1: v.y + v.h }))];
  for (const g of wallBoxes(w, h, T, holes)) W.push(g.translate(0, 0, -T / 2));
  W.push(new THREE.BoxGeometry(w, sink, T).translate(0, -sink / 2, -T / 2));   // (under the front, down into the sand)
  // a plinth course along the foot, the parapet with a lip, a little dome on the roof
  P.push(new THREE.BoxGeometry(w + 0.24, 0.42, d + 0.24).translate(0, 0.05, -d / 2));
  P.push(new THREE.BoxGeometry(w + 0.3, 0.22, d + 0.3).translate(0, h + 0.11, -d / 2));
  for (const s of [-1, 1]) P.push(new THREE.BoxGeometry(0.3, 0.55, d + 0.3).translate(s * (w / 2), h + 0.45, -d / 2));
  P.push(new THREE.BoxGeometry(w + 0.3, 0.55, 0.3).translate(0, h + 0.45, 0), new THREE.BoxGeometry(w + 0.3, 0.55, 0.3).translate(0, h + 0.45, -d));
  // the door's frame: jambs and a lintel proud of the wall, a step in front
  for (const s of [-1, 1]) P.push(new THREE.BoxGeometry(0.22, door.h + 0.25, 0.16).translate(door.x + s * (door.w / 2 + 0.11), (door.h + 0.25) / 2, 0.06));
  P.push(new THREE.BoxGeometry(door.w + 0.66, 0.26, 0.2).translate(door.x, door.h + 0.25, 0.07));
  P.push(new THREE.BoxGeometry(door.w + 0.9, 0.18, 0.9).translate(door.x, 0.0, 0.45));
  // the windows' frames and lattice (a cross of bars in each)
  for (const v of windows) {
    P.push(new THREE.BoxGeometry(v.w + 0.24, 0.14, 0.24).translate(v.x, v.y - 0.07, 0.04));
    I.push(new THREE.BoxGeometry(0.06, v.h, 0.06).translate(v.x, v.y + v.h / 2, -T * 0.5), new THREE.BoxGeometry(v.w, 0.06, 0.06).translate(v.x, v.y + v.h * 0.55, -T * 0.5));
  }
  // what shows through the door and the windows: the warm lit inside (self-lit, casts no shadow)
  G.push(new THREE.PlaneGeometry(door.w, door.h).translate(door.x, door.h / 2, -T + 0.02));
  for (const v of windows) G.push(new THREE.PlaneGeometry(v.w, v.h).translate(v.x, v.y + v.h / 2, -T + 0.02));
  // the awning: a slanted striped cloth on two thin poles' worth of brackets, over the door and the windows
  const aw = Math.min(w - 0.4, door.w + 3.2), ad = 1.4, ay = door.h + 0.62, n = 9;
  for (let i = 0; i < n; i++) {
    const x0 = -aw / 2 + (i / n) * aw, g = new THREE.BoxGeometry(aw / n, 0.05, ad).rotateX(0.38).translate(door.x + x0 + aw / n / 2, ay - Math.sin(0.38) * ad / 2, ad / 2 * Math.cos(0.38) + 0.02);
    (i % 2 ? A1 : A0).push(g);
  }
  for (let i = 0; i <= n; i++) {   // the scalloped hem: a little drop under each stripe's end
    const x = door.x - aw / 2 + (i + 0.5) / (n + 1) * aw;
    (i % 2 ? A1 : A0).push(new THREE.BoxGeometry(aw / (n + 1) * 0.86, 0.22, 0.04).translate(x, ay - Math.sin(0.38) * ad - 0.1, ad * Math.cos(0.38) + 0.02));
  }
  for (const s of [-1, 1]) I.push(new THREE.BoxGeometry(0.05, 0.05, ad * 1.05).rotateX(0.38).translate(door.x + s * aw / 2, ay - Math.sin(0.38) * ad / 2 - 0.03, ad / 2 * Math.cos(0.38)));
  // the name board over the awning: cream, inked frame, block letters
  const bw = Math.min(w - 0.8, 4.2), bh = 0.62, by = Math.min(h - 0.45, ay + 0.62);
  B.push(new THREE.BoxGeometry(bw, bh, 0.1).translate(0, by, 0.05));
  I.push(new THREE.BoxGeometry(bw + 0.12, 0.07, 0.13).translate(0, by + bh / 2, 0.05), new THREE.BoxGeometry(bw + 0.12, 0.07, 0.13).translate(0, by - bh / 2, 0.05));
  for (const s of [-1, 1]) I.push(new THREE.BoxGeometry(0.07, bh, 0.13).translate(s * (bw / 2 + 0.03), by, 0.05));
  const face = boardTexture(sign, signSub, bw, bh);
  let letters = null;
  if (!face) {
    letters = textGeometry(String(sign).toUpperCase(), { width: bw - 0.5, depth: 0.03 });
    letters.computeBoundingBox();
    const lh = letters.boundingBox.max.y - letters.boundingBox.min.y, ls = lh > bh * 0.62 ? (bh * 0.62) / lh : 1;
    letters.scale(ls, ls, 1).translate(0, by, 0.115);
  }
  // the hanging sign: a bracket out of the wall by the door, two short chains and the emblem, seen along the street
  const sx = door.x + door.w / 2 + 0.9, sy = door.h + 0.35;
  I.push(new THREE.BoxGeometry(0.08, 0.08, 1.35).translate(sx, sy + 0.62, 0.67), new THREE.BoxGeometry(0.06, 0.5, 0.06).rotateX(-0.75).translate(sx, sy + 0.36, 0.2));
  for (const z of [0.6, 1.1]) I.push(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4).translate(sx, sy + 0.5, z));
  const E = chimeEmblem(0.42);
  const em = { rim: E.rim.translate(sx, sy, 0.85), crystal: E.crystal.translate(sx, sy, 0.85) };
  // the materials (the ink look: flat colours, strata on the plaster, the post pass draws the lines)
  const wallM = strata(wall, wall2), plinthM = makeMaterial({ color: trim, flat: true });
  const add = (geos, m, o = {}) => { if (!geos.length) return null; const mesh = new THREE.Mesh(mergeGeometries(geos), m); Object.assign(mesh.userData, o); grp.add(mesh); return mesh; };
  add(W, wallM);
  add(P, plinthM);
  add(I, makeMaterial({ color: '#2b211f', flat: true }));
  add(A0, makeMaterial({ color: awning[0], flat: true }));
  add(A1, makeMaterial({ color: awning[1], flat: true }));
  add(B, makeMaterial({ color: '#f7ecd2', flat: true }));
  if (letters) add([letters], makeMaterial({ color: '#2b211f', flat: true }), { noCollide: true });
  else add([new THREE.PlaneGeometry(bw - 0.02, bh - 0.02).translate(0, by, 0.103)], makeMaterial({ color: '#ffffff', map: face, flat: true, glow: 0.3 }), { noCollide: true });
  add(G, makeMaterial({ color: glow, glow: 0.85, flat: true }), { noCollide: true });
  if (emblem === 'chime') {
    add([em.rim], makeMaterial({ color: '#a8742a', flat: true }), { noCollide: true });
    add([em.crystal], makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.5, key: 'chime-crystal' }), { noCollide: true });
  }
  const domeG = new THREE.SphereGeometry(1.0, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1).translate(w / 2 - 1.5, h + 0.22, -d + 1.5);
  add([domeG], makeMaterial({ color: dome }));   // (smooth: no facets on its shadow line)
  add([new THREE.CylinderGeometry(1.05, 1.05, 0.3, 16).translate(w / 2 - 1.5, h + 0.2, -d + 1.5)], plinthM);
  // a lantern by the door (lit at night: the level's light list)
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), makeMaterial({ color: '#f2c54b', glow: 1 }));
  lantern.position.set(door.x - door.w / 2 - 0.5, door.h + 0.1, 0.25);
  lantern.userData.noCollide = true;
  grp.add(lantern);
  scene.add(grp);
  grp.updateMatrixWorld(true);
  const wp = (x, y, z) => grp.localToWorld(new THREE.Vector3(x, y, z));
  const lp = wp(lantern.position.x, lantern.position.y, lantern.position.z);
  return { group: grp, door: wp(door.x, 0, 0), heading, lights: [new THREE.Vector4(lp.x, lp.y, lp.z, 7)], local: wp, size: { w, d, h } };
}

// ------------------------------------------------------------------ the interior

/**
 * A building to walk into: the shopfront in the world (unless `front: false`, for a door that is part of
 * something else), its room at the interior's slot, and the portals both ways. See the top for the options.
 * Returns { id, label, front, room, portals, lights, door: { at, heading }, inside, local(x, y, z), size }.
 */
export function buildInterior(scene, { id, label = 'the shop', doorLabel = 'door', slot = 0, door, front = {}, room = {} }) {
  const at = door.at.clone(), heading = door.heading ?? 0;
  const shopfront = front ? buildShopfront(scene, { at, heading, ...front }) : null;
  const R = { w: 8, d: 7, h: 4.2, ...room };
  const built = buildRoom(scene, { ...R, pos: interiorSlot(slot), rot: 0 });
  // what you see out of the door from inside: the street's daylight (a self-lit sheet beyond the doorstep,
  // past where the way out takes you), not the sky over the slot
  const veil = new THREE.Mesh(new THREE.PlaneGeometry((R.door?.w ?? 1.6) + 1.2, (R.door?.h ?? 2.6) + 0.8).translate(0, ((R.door?.h ?? 2.6) + 0.8) / 2 - 0.2, 0), makeMaterial({ color: front?.street ?? '#fff1d6', glow: 0.9, flat: true, side: THREE.DoubleSide }));
  veil.position.copy(built.group.localToWorld(new THREE.Vector3(R.door?.x ?? 0, 0, R.d / 2 + 2.3)));
  veil.userData.noCollide = true;
  scene.add(veil);
  const portals = portalPair({ at, heading, room: built });
  portals[0].label = doorLabel;   // (the scout: "Through the shop door" when the way to a find is in through it)
  portals[1].label = 'door';
  const lights = [...built.lights, ...(shopfront?.lights ?? [])];
  const it = {
    id, label, slot, front: shopfront, room: built, portals, lights, veil,
    door: { at, heading }, inside: built.inside.clone(),
    size: { w: R.w, d: R.d, h: R.h },
    inv: built.group.matrixWorld.clone().invert(),
    local: (x, y, z) => built.group.localToWorld(new THREE.Vector3(x, y, z)),
  };
  INTERIORS.push(it);
  return it;
}
