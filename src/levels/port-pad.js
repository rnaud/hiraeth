import * as THREE from 'three';
import { cabModel } from '../taxi.js';

// ---------------------------------------------------------------------------
// A city's space port, the stand-in (issue #397; docs/design/space-ports.md): until the author picks a port design
// from the Midjourney sheets, a city's landing is marked as a port from kit pieces it already has, data-driven:
//
//   pad      a ring of painted dashes and four chevrons round the ship's site, its lamps glowing at the quarters
//   docks    an iron arm out from the landing's rim, a post with a jib over it, a small craft moored in its cradle
//   traffic  small craft on slow loops over the city, bobbing and banking (moved each frame by update(dt))
//
// The ship lands where it always did (the level's shipSite is the pad's middle): nothing here is solid, nothing is
// walked on, so the landing, its sight lines and the quests' first steps stay as they were. The craft are the
// City-Shaft's cabs (taxi.js cabModel) in the city's colours: the parked ones baked into the kit's meshes (no draw
// call of their own), the flying ones a cab each.
//
//   buildPortPad(kit, M, port) → { craft: [Object3D], update(dt), sights: [{ name, at }] }
//     kit   a RoomKit (lab-kit.js) in world coordinates
//     M     { paint, trim, iron, lamp, cable }: the city's materials
//     port  { pad: { x, y, z, r, dashes, gap: [x, z, halfWidth] }, docks: [{ x, y, z, yaw, len, craft }], traffic: [{ centre, rx, rz, h, speed, phase, color, scale }] }
// ---------------------------------------------------------------------------

const NC = { solid: false, shadow: false };
const NS = { solid: false, shadow: true };
/** The pad's paint stands this far over the deck and as far into it (no face in the paving's plane: tests/zfight.test.js). */
export const PAD_LIFT = 0.05;

/** Every mesh of an object, its world transform applied, added to the kit (merged with the kit's own: no draw call of its own). */
function bake(kit, obj) {
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    kit.add(o.material, o.geometry.clone().applyMatrix4(o.matrixWorld), NS);
  });
}

/** The pad: dashes on a ring round the site (open where `gap` says: the bridge's mouth), chevrons pointing in, lamps. */
function pad(kit, M, P) {
  const { x, y, z, r, dashes = 20 } = P;
  const open = (px, pz) => (P.gaps ?? []).some(([gx, gz, gr]) => Math.hypot(px - gx, pz - gz) < gr);
  for (let i = 0; i < dashes; i++) {
    const a = (i / dashes) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    if (open(px, pz)) continue;
    const len = (Math.PI * 2 * r / dashes) * 0.62;
    kit.add(M.paint, new THREE.BoxGeometry(len, 2 * PAD_LIFT, 1.1).rotateY(a + Math.PI / 2).translate(px, y, pz), NC);
  }
  // four chevrons on the quarters, pointing to the middle, a lamp at each
  for (let q = 0; q < 4; q++) {
    const a = q * Math.PI / 2 + Math.PI / 4, cx = x + Math.sin(a) * (r - 2.2), cz = z + Math.cos(a) * (r - 2.2);
    if (open(cx, cz)) continue;
    for (const s of [-1, 1]) kit.add(M.trim, new THREE.BoxGeometry(2.4, 2 * PAD_LIFT, 0.6).translate(0.95, 0, 0).rotateY(s * 0.6).rotateY(a + Math.PI / 2).translate(cx, y, cz), NC);
    const lx = x + Math.sin(a) * (r + 0.9), lz = z + Math.cos(a) * (r + 0.9);
    kit.add(M.iron, new THREE.CylinderGeometry(0.22, 0.28, 0.35, 8).translate(lx, y + 0.17, lz), NC);
    kit.add(M.lamp, new THREE.SphereGeometry(0.2, 10, 6).scale(1, 0.6, 1).translate(lx, y + 0.4, lz), NC);
    kit.light(lx - kit.centre.x, y + 0.6 - kit.centre.y, lz - kit.centre.z, 5);
  }
}

/** A dock: an arm out over the edge from (x, y, z) along yaw, a post and jib at its root, a craft moored at its end. */
function dock(kit, M, D) {
  const { x, y, z, yaw, len = 10 } = D, s = Math.sin(yaw), c = Math.cos(yaw);
  const at = (d, side = 0) => [x + s * d + c * side, z + c * d - s * side];
  // the arm: two girders under deck level, cross-ties between them, a grating on top
  for (const side of [-1.3, 1.3]) {
    const [mx, mz] = at(len / 2, side);
    kit.add(M.iron, new THREE.BoxGeometry(0.35, 0.7, len).rotateY(yaw).translate(mx, y - 0.6, mz), NS);
  }
  for (let d = 1; d < len; d += 2) { const [mx, mz] = at(d); kit.add(M.iron, new THREE.BoxGeometry(2.9, 0.16, 0.2).rotateY(yaw).translate(mx, y - 0.3, mz), NS); }
  // the cradle at its end: two curved arms up round the craft's belly
  const [ex, ez] = at(len - 1.6);
  for (const side of [-1, 1]) {
    const arc = new THREE.TorusGeometry(1.7, 0.12, 5, 10, Math.PI / 2).rotateZ(side > 0 ? -Math.PI / 2 : Math.PI);
    kit.add(M.paint, arc.rotateY(yaw + Math.PI / 2).translate(ex + c * 0, y + 1.2, ez), NS);
  }
  // the post at the root, its jib out over the craft, a cable down to it; a lamp on the jib's end
  const [px, pz] = at(-0.6, 2.2), H = 7.5;
  kit.add(M.iron, new THREE.CylinderGeometry(0.22, 0.3, H, 8).translate(px, y + H / 2, pz), NS);
  kit.add(M.paint, new THREE.CylinderGeometry(0.34, 0.34, 0.6, 8).translate(px, y + H - 1.2, pz), NS);
  const jib = len - 1.6 + 0.6, [jx, jz] = at(len / 2 - 0.5, 2.2);
  kit.add(M.iron, new THREE.BoxGeometry(0.25, 0.3, jib).rotateY(yaw).translate(jx, y + H - 0.4, jz), NS);
  const [tx, tz] = at(len - 1.6, 2.2);
  kit.add(M.cable, new THREE.CylinderGeometry(0.03, 0.03, H - 2.8, 4).translate(tx, y + H - 0.4 - (H - 2.8) / 2, tz), NC);
  kit.add(M.lamp, new THREE.SphereGeometry(0.22, 10, 6).translate(tx, y + H - 0.1, tz), NC);
  kit.light(tx - kit.centre.x, y + H - kit.centre.y, tz - kit.centre.z, 7);
  // the craft, moored in its cradle, nose out
  if (D.craft) {
    const cab = cabModel(D.craft, D.scale ?? 2, { fares: false });
    cab.position.set(ex, y + 1.15, ez);
    cab.rotation.y = yaw;
    bake(kit, cab);
  }
}

/** A craft on a loop: an ellipse round `centre` at height h, its nose along the way, bobbing and banking. */
class Flyer {
  constructor(T, i) {
    this.T = T; this.t = T.phase ?? i * 1.7;
    this.root = cabModel(T.color, T.scale ?? 2, { fares: false });
    this.root.name = `port traffic ${i}`;
    this.root.traverse((o) => { o.castShadow = false; });
    this.place(0);
  }
  place(dt) {
    const T = this.T, w = (T.speed ?? 12) / Math.max(T.rx, T.rz) * (T.dir ?? 1);
    this.t += dt * w;
    const [cx, cy, cz] = T.centre, x = cx + Math.sin(this.t) * T.rx, z = cz + Math.cos(this.t) * T.rz;
    const dx = Math.cos(this.t) * T.rx * w, dz = -Math.sin(this.t) * T.rz * w;
    this.root.position.set(x, cy + T.h + Math.sin(this.t * 5.3) * 0.6, z);
    this.root.rotation.set(0, Math.atan2(dx, dz), 0);
    this.root.rotateZ(-0.18 * Math.sign(w));
  }
}

/** The port: its pad, its docks and its traffic, from the city's data (see the head of the file). */
export function buildPortPad(kit, M, port) {
  if (port.pad) pad(kit, M, port.pad);
  for (const D of port.docks ?? []) dock(kit, M, D);
  const flyers = (port.traffic ?? []).map((T, i) => new Flyer(T, i));
  return {
    craft: flyers.map((f) => f.root),
    update(dt) { for (const f of flyers) f.place(dt); },
    sights: port.sight ? [port.sight] : [],
  };
}
