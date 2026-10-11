import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { buildLanternStones } from './sky-stones-ways.js';

// Vael's crossings (the merged worlds' follow-ups, October 2026). Vael's plain and the sky stones are one world since
// v1.39, but nothing told of the cloud between them: the bird crossed 1.5 km of it from the lone tower to Sister Aube with
// nothing on the way, the walk home from the monastery to the ship (now on the plain, 840 m north) passed nothing, and the
// clapper lay 760 m east of Calix over open cloud. Three things the riders and the monks left, flown past on the bird. No
// rng: the worlds round them stay as they were. Built after both temples (src/levels/arzach.js finishVael), so the
// audits' samples of what stood before stay where they were.
//
//   the riders' gate      two leaning pillars of the plain's rose stone and a lintel at the plain's edge, 27 m tall, a long
//                         white streamer and the riders' rust pennon off the lintel and a riders' lantern hung under it: where
//                         the bird riders of the plain set off over the cloud to the stones that fell up. The crossing's
//                         weenie: seen from the landing, from the tower's window and over the cloud from the rose cliff.
//   the riders' lanterns  nine lantern stones like the monks' (src/sky-stones-ways.js) from the rose cliff's north lip over
//                         the cloud to the gate, the fifth a wide stone with a bench and a hand-bell where riders waited
//                         out a fog: the monks lit them for riders flying home to the plain. Dark until the bell rings,
//                         with the gate's lantern; Calix sends you home by them.
//   the old rope way      the rope the monks strung from the monastery's east lip to the floating island's church before
//                         the cloud rose: a post at each end, its frayed rope hanging from them, and three knots of it, a
//                         plank or two still caught, snagged on small floating stones between. The clapper's way out
//                         (the tiles are its way home).
//
//   buildRidersGate(scene, terrain, at)  → { at, top, look, lit(on), wave(t) }
//   buildRidersLanterns(scene)           → { points, sight, halfway, stones, lit(on), update(t) }
//   buildRopeWay(scene, topAt)           → { points, knots, posts, update(t) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.computeVertexNormals(); return g; };

/** The riders' gate: on the plain, 30 m in from its edge over the cloud, between the tower's window and the great table. */
export const GATE = { x: -40, in: 30, span: 9, h: 27 };
/** The riders' lanterns, [x, y, z]: from the rose cliff's north lip, over the cloud, to before the gate (the fifth: the halfway stone). */
export const RIDERS_LANTERNS = [[-236, 86, -300], [-222, 82, -366], [-205, 77, -432], [-186, 72, -498], [-166, 66, -566], [-145, 60, -633], [-123, 54, -700], [-101, 48, -765], [-80, 42, -828]];
export const HALFWAY = 4;
/** The old rope way: its posts on the monastery's east lip and before the island church's porch, and its three snagged knots between. */
export const ROPE_WAY = { a: [-184, -249], b: [221, -508], knots: [[-80, 92, -316], [18, 104, -380], [116, 116, -442]] };

export function buildRidersGate(scene, terrain, at) {
  const { span, h } = GATE;
  const x = at.x, z = at.z, y = terrain.heightAt(x, z);
  // (the riders' mast's own materials, src/vael-ways.js: no new look)
  const stone = makeMaterial({ color: '#f2d6c4', color2: '#e8c0aa', color3: '#f8ecdf', mode: MODE_STRATA, strataSize: 2.2, flat: true });
  const cloth = makeMaterial({ color: '#f4efe2', flat: true, side: THREE.DoubleSide });
  const rust = makeMaterial({ color: '#c8673f', flat: true, side: THREE.DoubleSide });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const dark = makeMaterial({ color: '#8a7a62', flat: true });
  const lamp = makeMaterial({ color: '#ffd9a0', glow: 1 });
  // the pillars along x (the gate looks south, over the cloud), leaning in a little; the lintel across their tops
  const parts = [];
  for (const k of [-1, 1]) {
    const p = new THREE.CylinderGeometry(1.25, 2.1, h, 5, 3).translate(0, h / 2, 0).rotateZ(k * 0.035).translate(k * span / 2, -1, 0);
    parts.push(flat0(p));
    for (let i = 0; i < 3; i++) parts.push(flat0(new THREE.IcosahedronGeometry(1 + i * 0.2, 0).scale(1.3, 0.7, 1.1).translate(k * (span / 2 + 1.6 + i * 0.5), 0.1, (i - 1) * 1.8)));
  }
  parts.push(flat0(new THREE.BoxGeometry(span + 6, 2.2, 2.6).translate(0, h - 1.2, 0)));
  parts.push(flat0(new THREE.BoxGeometry(span + 3, 0.9, 2).translate(0, h + 0.35, 0)));
  const g = new THREE.Group();
  g.name = 'The riders’ gate';
  const body = new THREE.Mesh(mergeGeometries(parts), stone);
  body.userData.castShadow = true;
  // the lantern hung from the lintel's middle on a chain (drawn only: it is out of reach)
  const ly = h - 5.2;
  const chain = [flat0(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 4).translate(0, h - 3.6, 0)), flat0(new THREE.ConeGeometry(0.9, 0.8, 6).translate(0, ly + 1.4, 0)),
    flat0(new THREE.BoxGeometry(1.3, 0.14, 1.3).translate(0, ly - 0.9, 0))];
  const glassGeo = flat0(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 6).translate(0, ly + 0.25, 0));
  const chains = new THREE.Mesh(mergeGeometries(chain), iron);
  const unlit = new THREE.Mesh(glassGeo, dark), litGlass = new THREE.Mesh(glassGeo, lamp);
  litGlass.visible = false;
  // the streamer off the lintel's east end, streaming out over the cloud, and the pennon over it
  const L = 22, tail = new THREE.PlaneGeometry(L, 2.4, 30, 1).translate(L / 2, 0, 0);
  { const p = tail.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) * (1 - 0.75 * u)); p.setZ(i, Math.sin(u * 8) * 0.8 * u); } tail.computeVertexNormals(); }   // (tapering, in waves)
  const streamer = new THREE.Mesh(tail, cloth);
  streamer.position.set(span / 2 + 3, h - 1.4, 0); streamer.rotation.y = -1.25;
  const pennon = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([V(0, 0.9, 0), V(0, -0.9, 0), V(4, 0, 0)]), rust);
  pennon.geometry.computeVertexNormals();
  pennon.position.set(-span / 2 - 3, h + 0.6, 0); pennon.rotation.y = -1.1;
  for (const m of [chains, unlit, litGlass, streamer, pennon]) m.userData.noCollide = true;
  g.add(body, chains, unlit, litGlass, streamer, pennon);
  g.position.set(x, y, z);
  scene.add(g);
  const lit = (on) => { litGlass.visible = !!on; unlit.visible = !on; };
  const base = streamer.rotation.y;
  return {
    at: V(x, y, z + 3), top: V(x, y + h + 1, z), look: V(x, y + 1.6, z + 6), lit, isLit: () => litGlass.visible,
    wave: (t) => { streamer.rotation.y = base + Math.sin(t * 0.55) * 0.12; streamer.rotation.x = Math.sin(t * 1.05) * 0.18; pennon.rotation.y = -1.1 + Math.sin(t * 0.9 + 1) * 0.1; },
  };
}

export function buildRidersLanterns(scene) {
  const L = buildLanternStones(scene, { stones: RIDERS_LANTERNS, name: 'The riders’ lanterns', wide: { [HALFWAY]: 6.5 } });
  // the halfway stone: a stone bench and a hand-bell on a post, where riders waited out a fog (drawn only, it floats)
  const [x, y, z] = RIDERS_LANTERNS[HALFWAY];
  const wood = makeMaterial({ color: '#d6c7a8', flat: true });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const bench = [flat0(new THREE.BoxGeometry(2.6, 0.25, 0.8).translate(x - 2.4, y + 0.55, z + 1.6)), flat0(new THREE.BoxGeometry(0.4, 0.45, 0.6).translate(x - 3.4, y + 0.22, z + 1.6)), flat0(new THREE.BoxGeometry(0.4, 0.45, 0.6).translate(x - 1.4, y + 0.22, z + 1.6))];
  const post = [flat0(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 5).translate(x + 2.6, y + 1.2, z - 1.4)), flat0(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 4).rotateZ(Math.PI / 2).translate(x + 2.95, y + 2.3, z - 1.4))];
  const bell = flat0(new THREE.ConeGeometry(0.28, 0.42, 8, 1, true).translate(x + 3.3, y + 1.95, z - 1.4));
  const m1 = new THREE.Mesh(mergeGeometries(bench), wood), m2 = new THREE.Mesh(mergeGeometries([...post, bell]), iron);
  for (const m of [m1, m2]) { m.userData.floats = true; L.group.add(m); }
  return { ...L, halfway: V(x, y + 0.6, z), sight: V(x, y + 0.6, z) };
}

export function buildRopeWay(scene, topAt) {
  const { a, b, knots } = ROPE_WAY;
  const wood = makeMaterial({ color: '#d6c7a8', flat: true });
  const ropeMat = makeMaterial({ color: '#8a6e52', flat: true });
  const stone = makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', flat: true });
  const ya = topAt(a[0], a[1]), yb = topAt(b[0], b[1], 160);
  const A = V(a[0], ya, a[1]), B = V(b[0], yb, b[1]);
  const posts = [], ropes = [], endRopes = [], rocks = [], planks = [];
  const tube = (pts, r = 0.07) => flat0(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(6, pts.length * 4), r, 4, false));
  // a post at each end, a crossbar near its top; its rope hangs from it toward the other end, frayed off 18 m out
  for (const [P, Q] of [[A, B], [B, A]]) {
    posts.push(flat0(new THREE.CylinderGeometry(0.22, 0.3, 6, 6).translate(P.x, P.y + 2.6, P.z)));
    const d = Q.clone().sub(P).setY(0).normalize();
    posts.push(flat0(new THREE.BoxGeometry(1.8, 0.22, 0.22).rotateY(Math.atan2(-d.z, d.x) + Math.PI / 2).translate(P.x, P.y + 5.1, P.z)));
    const top = V(P.x, P.y + 5.2, P.z);
    endRopes.push(tube([top, top.clone().addScaledVector(d, 6).add(V(0, -2.4, 0)), top.clone().addScaledVector(d, 12).add(V(0, -5.5, 0)), top.clone().addScaledVector(d, 17).add(V(0, -10, 0))]));
  }
  // the knots: a floating stone, a stub of post on it, the rope round the post and both ends dangling, a plank or two
  const knotAt = [];
  knots.forEach(([x, y, z], i) => {
    const r = 2.4 + (i % 2) * 0.6;
    rocks.push(flat0(new THREE.CylinderGeometry(r, r * 0.85, 1.1, 8).translate(x, y - 0.55, z)), flat0(new THREE.ConeGeometry(r * 0.85, r * 2.1, 7).rotateX(Math.PI).translate(x, y - 1.1 - r * 1.05, z)));
    posts.push(flat0(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 6).translate(x + 0.6, y + 0.8, z)));
    const dir = B.clone().sub(A).setY(0).normalize();
    const c = V(x + 0.6, y + 1.2, z);
    for (const s of [-1, 1]) ropes.push(tube([c, c.clone().addScaledVector(dir, s * 3).add(V(0, -1.6, 0)), c.clone().addScaledVector(dir, s * 5.5).add(V(0.4 * s, -4.5 - i, 0)), c.clone().addScaledVector(dir, s * 7).add(V(0.6 * s, -8 - i, 0.3))], 0.06));
    for (let k = 0; k <= i % 2; k++) planks.push(flat0(new THREE.BoxGeometry(0.45, 0.08, 1.9).rotateY(Math.atan2(dir.x, dir.z)).rotateZ(0.5 + k * 0.6).translate(x + dir.x * (3 + k * 1.6), y - 2.2 - k * 1.3, z + dir.z * (3 + k * 1.6))));
    knotAt.push(V(x, y + 0.6, z));
  });
  const g = new THREE.Group();
  g.name = 'The old rope way';
  const postMesh = new THREE.Mesh(mergeGeometries(posts.slice(0, 4)), wood);   // (the two end posts stand on the rock: they collide)
  const hanging = new THREE.Mesh(mergeGeometries(endRopes), ropeMat);
  hanging.userData.noCollide = true;
  const floating = [new THREE.Mesh(mergeGeometries([...posts.slice(4), ...planks]), wood), new THREE.Mesh(mergeGeometries(ropes), ropeMat), new THREE.Mesh(mergeGeometries(rocks), stone)];
  // (the clipping and contact audits: the knots hang in the air on purpose, the ropes hang off the posts; flown past, not stood on)
  for (const m of floating) { m.userData.noCollide = true; m.userData.floats = true; }
  g.add(postMesh, hanging, ...floating);
  scene.add(g);
  const knotG = floating;
  const update = (t) => { for (const m of knotG) m.position.y = Math.sin(t * 0.32 + 0.6) * 0.7; };
  const points = [[A.x, A.y + 4, A.z], ...knots.map(([x, y, z]) => [x, y + 2, z]), [B.x, B.y + 4, B.z]];
  return { points, knots: knotAt, posts: [V(A.x, A.y, A.z), V(B.x, B.y, B.z)], update };
}
