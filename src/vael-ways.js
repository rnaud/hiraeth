import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { glyphGeometry } from './story/sign-text.js';

// Vael's ways home (level design audit v1.15: both walks back were the way you came). No rng: the world round them
// stays as it was.
//
//   the bird's tracks    her great three-toed prints, pressed in the sand long ago, from the Aerie's door down the
//                        plateau's north side to the stone where Oïa watches, beside where the bird used to wait for
//                        her rider: the way from the white house back to Oïa that is not the standing stones' way up.
//                        Halfway, on the plateau's lip, the rider's mounting stone (a block with steps, a ring, a
//                        saddle-cloth), looking out over the landing to the tower.
//   the rider's roost    a stone floating halfway between the lone tower and the landing, on the line the bird flies
//                        home: a lean-to, a bedroll, a cup, a long white streamer. Where the rider and the bird rested.
//   the riders' mast     (level design audit, third round: onboarding) a tall bone-white mast with the riders' long
//                        white streamer, on the slope just under the plateau's crest past the last standing stone: from
//                        the landing, where the hollow shows nothing to the west, it shows over the slope where Oïa
//                        points, and from its foot the white house with the stone wings comes into view.
//
//   buildBirdTracks(scene, terrain)  → { points: [[x, y, z]], mount: { at, look, stand } }
//   buildRidersRoost(scene, terrain) → { top, look, stand, streamer }
//   buildRidersMast(scene, terrain)  → { at, top, look, wave }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

/** The tracks' line, [x, z]: from the Aerie's door (it looks east), north-east over the plateau, down to Oïa's stone. */
export const TRACKS = [[-188, 4], [-170, 30], [-145, 52], [-112, 64], [-80, 60], [-50, 48], [-24, 30], [-2, 12]];
/** The rider's mounting stone on the plateau's lip, by the tracks ([x, z]; it faces the tower). */
export const MOUNT = { x: -116, z: 55 };
/** The rider's roost: the floating stone's top, on the line from the tower's window to the landing (about 45 % of the way). */
export const ROOST = { x: 143, y: 142, z: -222 };
const TOWER = { x: 260, z: -420 };
/** The riders' mast: on the slope under the crest past the last standing stone ([x, z]), and how tall (m). */
export const MAST = { x: -100, z: -6, h: 16 };

export function buildBirdTracks(scene, terrain) {
  const H = (x, z) => terrain.heightAt(x, z);
  const curve = new THREE.CatmullRomCurve3(TRACKS.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const len = curve.getLength(), stride = 3.4, prints = [];
  for (let s = 2, i = 0; s < len - 2; s += stride, i++) {
    const t = s / len, p = curve.getPointAt(t), d = curve.getTangentAt(t);
    const side = i % 2 ? 1 : -1, yaw = Math.atan2(d.x, d.z) + side * 0.12;
    const x = p.x - d.z * side * 0.8, z = p.z + d.x * side * 0.8, y = H(x, z) + 0.035;
    // three long toes fanned forward and a round heel, sunk a little: the bird's track, as Oïa draws it
    for (const a of [-0.42, 0, 0.42]) prints.push(new THREE.BoxGeometry(0.24, 0.05, 1.35).translate(0, 0, 0.75).rotateY(a).translate(0, 0, 0.1));
    prints.push(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 8));
    for (let k = prints.length - 4; k < prints.length; k++) prints[k] = flat0(prints[k]).rotateY(yaw).translate(x, y, z);
  }
  const ink = makeMaterial({ color: '#c9ad8a', flat: true });
  const tracks = new THREE.Mesh(mergeGeometries(prints), ink);
  tracks.name = 'The bird’s tracks'; tracks.userData.noCollide = true; tracks.receiveShadow = true;
  scene.add(tracks);

  // the mounting stone: a block with three steps up its side, an iron ring on a post, a white saddle-cloth over it
  const my = H(MOUNT.x, MOUNT.z), face = Math.atan2(TOWER.x - MOUNT.x, TOWER.z - MOUNT.z);
  const frame = new THREE.Matrix4().compose(V(MOUNT.x, my - 0.3, MOUNT.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), face), V(1, 1, 1));
  const at = (x, y, z) => V(x, y, z).applyMatrix4(frame);
  const stoneMat = makeMaterial({ color: '#efe4cf', color2: '#e2cfae', color3: '#f7f1e4', mode: MODE_STRATA, strataSize: 1.2, flat: true });
  const blocks = [new THREE.BoxGeometry(3.2, 2.2, 2.0).translate(0, 1.1, 0), ...[0, 1, 2].map((k) => new THREE.BoxGeometry(0.9, 0.55 * (k + 1), 2.0).translate(-2.05 - (2 - k) * 0.9, 0.275 * (k + 1), 0))];
  const solid = new THREE.Mesh(mergeGeometries(blocks.map((g) => flat0(g).applyMatrix4(frame))), stoneMat);
  solid.name = 'The rider’s mounting stone';
  scene.add(solid);
  const iron = makeMaterial({ color: '#5a4a3e', flat: true, metal: 'iron' });
  const ring = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6).translate(2.2, 0.8, 0.6), new THREE.TorusGeometry(0.26, 0.05, 5, 12).translate(2.2, 1.45, 0.6)].map((g) => flat0(g).applyMatrix4(frame))), iron);
  ring.userData.noCollide = true; scene.add(ring);
  const cloth = makeMaterial({ color: '#f4efe2', flat: true, side: THREE.DoubleSide });
  const drape = new THREE.PlaneGeometry(1.6, 2.6, 1, 3).rotateX(-Math.PI / 2);
  { const p = drape.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); if (Math.abs(zz) > 0.95) p.setY(i, -(Math.abs(zz) - 0.95) * 1.1); p.setZ(i, Math.sign(zz) * Math.min(Math.abs(zz), 1.02)); } }
  const saddle = new THREE.Mesh(flat0(drape.translate(0.5, 2.23, 0)).applyMatrix4(frame), cloth);
  saddle.userData.noCollide = true; scene.add(saddle);
  const mark = new THREE.Mesh(glyphGeometry(0.42).rotateX(-Math.PI / 2).translate(0.5, 2.25, 0).applyMatrix4(frame), makeMaterial({ color: '#8a6e52', flat: true }));
  mark.userData.noCollide = true; scene.add(mark);
  const points = TRACKS.map(([x, z]) => [x, H(x, z), z]);
  return { points, mesh: tracks, mount: { at: at(0, 0.3, 1.6), look: at(0.5, 2.6, 0), stand: at(0.4, 0.3, 1.9), heading: face } };
}

export function buildRidersRoost(scene) {
  const { x, y, z } = ROOST, R = 8;
  const stone = makeMaterial({ color: '#f2d6c4', color2: '#e8c0aa', color3: '#f8ecdf', mode: MODE_STRATA, strataSize: 2.2, flat: true });
  // the floating stone: a flat top over a long point of rock below, a few loose stones on its rim
  const rock = [new THREE.CylinderGeometry(R, R * 0.92, 2.4, 14).translate(0, -1.2, 0), new THREE.ConeGeometry(R * 0.92, 15, 12, 3).rotateX(Math.PI).translate(0, -2.4 - 7.5, 0)];
  const m = new THREE.Mesh(mergeGeometries(rock.map(flat0)), stone);
  m.position.set(x, y, z); m.name = 'The rider’s roost'; m.userData.floats = true;   // (the clipping audit: meant to hang in the air)
  scene.add(m);
  const yaw = Math.atan2(TOWER.x - x, TOWER.z - z);
  const frame = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  const at = (lx, ly, lz) => V(lx, ly, lz).applyMatrix4(frame);
  // a lean-to of two bone-white poles and a cloth, open toward the tower; a bedroll, a cup, a ladder of rope over the edge
  const wood = makeMaterial({ color: '#d6c7a8', flat: true });
  const cloth = makeMaterial({ color: '#f4efe2', flat: true, side: THREE.DoubleSide });
  const ink = makeMaterial({ color: '#8a6e52', flat: true });
  const poles = [-1.6, 1.6].map((px) => new THREE.CylinderGeometry(0.07, 0.08, 2.6, 5).translate(0, 1.3, 0).rotateX(0.35).translate(px, 0, 0.6));
  const ridge = new THREE.CylinderGeometry(0.06, 0.06, 3.6, 5).rotateZ(Math.PI / 2).translate(0, 2.42, 1.45);
  const mast = new THREE.CylinderGeometry(0.06, 0.08, 7, 5).translate(-4.2, 3.5, -2.2);
  const woodMesh = new THREE.Mesh(mergeGeometries([...poles, ridge, mast].map((g) => flat0(g).applyMatrix4(frame))), wood);
  scene.add(woodMesh);
  const sheet = new THREE.PlaneGeometry(3.6, 3.0).rotateX(-Math.PI / 2 + 0.95).translate(0, 1.25, 0.2);
  const roll = new THREE.CylinderGeometry(0.28, 0.28, 1.9, 8).rotateZ(Math.PI / 2).translate(0, 0.28, -0.4);
  const clothMesh = new THREE.Mesh(mergeGeometries([sheet, roll].map((g) => flat0(g).applyMatrix4(frame))), cloth);
  clothMesh.userData.noCollide = true; scene.add(clothMesh);
  const cup = new THREE.Mesh(flat0(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 8).translate(1.2, 0.08, -0.9)).applyMatrix4(frame), ink);
  cup.userData.noCollide = true; scene.add(cup);
  // the streamer: a long white tail off the mast, streaming downwind (it shows from the tower and the landing)
  const tail = new THREE.PlaneGeometry(9, 0.8, 18, 1).translate(4.5, 0, 0);
  { const p = tail.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / 9; p.setY(i, p.getY(i) * (1 - 0.8 * u)); p.setZ(i, Math.sin(u * 7) * 0.45 * u); } tail.computeVertexNormals(); }   // (tapering, in waves)
  const streamer = new THREE.Mesh(tail, cloth);
  streamer.position.copy(at(-4.2, 6.7, -2.2)); streamer.rotation.y = yaw + 2.2; streamer.userData.noCollide = true;
  scene.add(streamer);
  // the rope ladder over the edge, toward the landing
  const rope = [];
  for (const sx of [-0.35, 0.35]) rope.push(new THREE.CylinderGeometry(0.03, 0.03, 5, 4).translate(sx, -2.5, 0));
  for (let k = 0; k < 6; k++) rope.push(new THREE.BoxGeometry(0.75, 0.04, 0.06).translate(0, -0.6 - k * 0.75, 0));
  const ladder = new THREE.Mesh(mergeGeometries(rope.map((g) => flat0(g).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -R + 0.1)).applyMatrix4(frame))), wood);
  ladder.userData.noCollide = true; scene.add(ladder);
  const base = streamer.rotation.y;
  return { top: V(x, y, z), look: at(0, 0.9, 0.6), stand: at(0, 0, 2.6), streamer, wave: (t) => { streamer.rotation.y = base + Math.sin(t * 0.7) * 0.14; streamer.rotation.x = Math.sin(t * 1.3) * 0.2; } };
}

export function buildRidersMast(scene, terrain) {
  const { x, z, h } = MAST, y = terrain.heightAt(x, z);
  const wood = makeMaterial({ color: '#d6c7a8', flat: true });
  const cloth = makeMaterial({ color: '#f4efe2', flat: true, side: THREE.DoubleSide });
  const rust = makeMaterial({ color: '#c8673f', flat: true, side: THREE.DoubleSide });
  const stone = makeMaterial({ color: '#f2d6c4', color2: '#e8c0aa', color3: '#f8ecdf', mode: MODE_STRATA, strataSize: 2.2, flat: true });
  // the mast, a crosspiece near its top, and three stones round its foot holding it
  const mast = [new THREE.CylinderGeometry(0.2, 0.32, h + 1, 7).translate(0, (h + 1) / 2 - 1, 0), new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5).rotateZ(Math.PI / 2).translate(0, h - 1.4, 0)];
  const m = new THREE.Mesh(mergeGeometries(mast.map(flat0)), wood);
  m.position.set(x, y, z); m.name = 'The riders’ mast';
  scene.add(m);
  const foot = [0, 2.1, 4.2].map((a, i) => new THREE.IcosahedronGeometry(0.6 + i * 0.08, 0).scale(1.2, 0.7, 1).translate(Math.cos(a) * 0.9, 0.15, Math.sin(a) * 0.9));
  const st = new THREE.Mesh(mergeGeometries(foot.map(flat0)), stone);
  st.position.set(x, y - 0.1, z); scene.add(st);
  // the streamer: the roost's long white tail, longer and wider, off the top, broadside to the landing (it shows over
  // the slope from there), and the riders' rust-red pennon over it
  const L = 18, tail = new THREE.PlaneGeometry(L, 2, 28, 1).translate(L / 2, 0, 0);
  { const p = tail.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) * (1 - 0.75 * u)); p.setZ(i, Math.sin(u * 8) * 0.7 * u); } tail.computeVertexNormals(); }   // (tapering, in waves)
  const streamer = new THREE.Mesh(tail, cloth);
  streamer.position.set(x, y + h - 1.2, z); streamer.rotation.y = Math.PI / 2 + 0.25; streamer.userData.noCollide = true;
  scene.add(streamer);
  const pennon = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([V(0, 0.7, 0), V(0, -0.7, 0), V(3.2, 0, 0)]).rotateY(Math.PI / 2 + 0.25), rust);
  pennon.geometry.computeVertexNormals();
  pennon.position.set(x, y + h + 0.2, z); pennon.userData.noCollide = true;
  scene.add(pennon);
  const base = streamer.rotation.y;
  return { at: V(x, y, z), top: V(x, y + h, z), look: V(x + 1.6, y + 1.6, z + 0.6), wave: (t) => { streamer.rotation.y = base + Math.sin(t * 0.6) * 0.12; streamer.rotation.x = Math.sin(t * 1.1) * 0.16; } };
}
