import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { cabModel } from './taxi.js';

// The City-Shaft's ways down and up (level design audit v1.15: the drop from Nima to Ossa and the climb from Ossa to
// the palace were 474 m and 564 m with nothing on them, and the walk back from the palace to Nima the way nobody marks).
// No rng: the city round them stays as it was.
//
//   the lamplighters' drops  before the cabs, the lamplighters went down the shaft terrace by terrace; each landing they
//                            dropped to is still marked on the edge of its terrace with a red lamp-post and a cream
//                            ring painted on the promenade, a spiral from Nima's corner of the high terrace down to the
//                            bottom terrace by the Upward Shrine: the way down on the wings. Halfway, on the middle
//                            levels, Perrine keeps her tea stall where they land (src/story/halfway.js HALFWAY).
//   the lamplighters' pad    a floating pad with a lamp a quarter of the way up from the bottom terrace toward the
//                            spire: the first rest on the climb to the palace; and the upper pad three quarters of the way,
//                            past the relay lamp (level design audit v1.15: the relay stood 206 m from anything)
//   the relay lamp           on the spire's ring at the 92 m level, the side that faces the bottom: an old lamp of the
//                            Three Who Look Up, dark until the splinter passes it (src/story/incal.js)
//   Tobin's view pad         a floating pad halfway down from the palace to the high terrace, a coin telescope on it
//                            pointed up at the Lodestar ("looking up remains free")
//   Lio's dispatch mast      behind Lio on the outer rim, a tall mast in his teal, banded in cream, his dispatch booth at
//                            the top with the call-lamp on its roof and two cabs docked at its arms: where the cabs are sent
//                            from (issue #201: the glide down from the palace's crown to Lio was blind; the mast stands
//                            over the crown's rim, seen from all of it)
//   the rim posts            the lamplighters' round began on the rim: the same red posts from the Warden's Well's door
//                            along the rim's edge to the red stair's gate, down which Nima's corner lies (level design
//                            audit v1.15: the walk from the Well to Nima was blind, the stair's gate 200 m round the rim)
//
//   dropLandings(terraces, places) → [{ y, a, at, edge, terrace }]   (pure: the tests and the audit use it)
//   rimPosts(R) → [{ at, out }]                   (pure: the posts on the rim, from the Well's door to the red stair)
//   buildShaftWays(scene, { terraces, places, R }) → { landings, lights, line, rim, pad, upper, relay, view, clear }

/** The drops' landings: the angle round the shaft on each level (rad), from Nima's corner down to by the shrine. */
export const DROPS = { 150: 1.06, 92: 1.28, 36: 1.55, [-24]: 1.84, [-86]: 2.14, [-150]: 2.44, [-218]: 2.76, [-290]: 2.98 };
/** How far in from the terrace's inner edge a landing's ring is painted (m), and its radius. */
export const DROP_RING = { inset: 5, r: 2.2 };
/** The climb's floating pad and the relay lamp, and the view pad: where on the straight line between their stops. */
export const CLIMB = { pad: 0.26, relay: { y: 92, r: 44, a: Math.PI }, upper: { y: 170, r: 55, a: Math.PI } };
/**
 * The rim posts: [angle (rad), radius (m)] round the shaft, from beside the Warden's Well's door (−0.19 rad) out to the
 * edge, then along it to the red stair's gate (src/levels/incal.js STAIR.top, 0.51 rad). None on the rim's cab stop
 * (0 rad, where the cabs set you down) nor on the makers' trial by it.
 */
/** Tobin's telescopes on the outer rim between him and Lio ([x, z]; the rim's top: RIM_TOP). */
export const TOBIN_SCOPES = [[344, 108], [353, 93], [358, 74]];
/**
 * The cab rank (v1.50, issue #132: the walk home from Tobin was the 119 m of rim you had just crossed): a floating pad
 * off the rim by the ship, a yellow lamp and a board on it, where the cabs wait for fares between rides. Once Tobin has
 * handed you Lio's pass you ride home: a cab hailed on the rim goes out over the shaft past it, round, and sets you down
 * by your ship (src/levels/incal.js shaftRoutes: out to the ring of open air, round it, in). Angle round the shaft (rad),
 * radius (m), height.
 */
export const CAB_RANK = { a: 0.18, r: 162, y: 205 };
/** Where Tobin sends you to wave one down: the rim's edge at the parapet, a little way round from him toward your ship (angle, radius: the shaft's lip is at 260 m; nearer him the red stair's top is under a cab's way out). */
export const CAB_HAIL = { a: 0.3, r: 261.5 };
export const RIM_TOP = 200;
/**
 * Lio's dispatch mast (issue #201): angle round the shaft (rad), radius (m) and height over the rim (m), behind where he
 * stands (src/levels/content.js: [330, 40]). Tall enough to stand over the crown's floor from its middle, by the needle:
 * from there the crown hides the rim up to ~265 m this far out (the level design audit's eye).
 */
export const DISPATCH = { a: 0.1, r: 360, h: 86 };
export const RIM_POSTS = [[-0.19, 298], [-0.175, 280], [-0.15, 264], [-0.095, 264], [0.05, 264], [0.11, 264], [0.17, 264], [0.23, 264], [0.29, 264], [0.35, 264], [0.41, 264], [0.47, 264]];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The rim posts on the rim at height `top`: each { at (its foot), out (toward the shaft's middle) }. */
export function rimPosts(top = 200) {
  return RIM_POSTS.map(([a, r]) => ({ at: V(Math.cos(a) * r, top, Math.sin(a) * r), out: V(-Math.cos(a), 0, -Math.sin(a)) }));
}
const TAU = Math.PI * 2;
const inSector = (t, a) => { const d = ((a - t.a0) % TAU + TAU) % TAU; return d <= t.a1 - t.a0; };
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

/** The landings, top to bottom: on each level the terrace sector holding its angle. */
export function dropLandings(terraces) {
  return Object.entries(DROPS).map(([y, a]) => [+y, a]).sort((p, q) => q[0] - p[0]).map(([y, a]) => {
    const t = terraces.find((s) => s.y === y && inSector(s, a));
    if (!t) return null;
    const r = t.r0 + DROP_RING.inset;
    return { y, a, terrace: t, at: V(Math.cos(a) * r, y, Math.sin(a) * r), edge: V(Math.cos(a) * (t.r0 + 2.4), y, Math.sin(a) * (t.r0 + 2.4)) };
  }).filter(Boolean);
}
/** The middle levels' landing (Perrine's stall stands beside it). */
export const halfwayLanding = (terraces) => dropLandings(terraces).find((l) => l.y === -24) ?? null;

export function buildShaftWays(scene, { terraces, places }) {
  const red = makeMaterial({ color: '#d0694a', flat: true, key: 'incal.stair' });
  const cream = makeMaterial({ color: '#f3ead8', flat: true });
  const lampMat = makeMaterial({ color: '#ffe3a6', flat: true, glow: 0.9, key: 'incal.drops.lamp' });
  const landings = dropLandings(terraces), lights = [], posts = [], rings = [], heads = [];
  landings.forEach((L, i) => {
    const out = V(-Math.cos(L.a), 0, -Math.sin(L.a));   // toward the void
    const along = V(-Math.sin(L.a), 0, Math.cos(L.a));   // round the shaft, the way the drops go down
    // the ring painted on the promenade, and a red chevron in it pointing on to the next landing down
    rings.push(new THREE.RingGeometry(DROP_RING.r - 0.35, DROP_RING.r, 28).rotateX(-Math.PI / 2).translate(L.at.x, L.y + 0.03, L.at.z));
    if (i < landings.length - 1) {
      const c = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.55, -0.4), new THREE.Vector2(0, 0.5), new THREE.Vector2(0.55, -0.4), new THREE.Vector2(0, -0.05)]));
      const yaw = Math.atan2(along.x, along.z) + Math.PI;   // (the shape's tip, laid flat, points to -z)
      posts.push(c.rotateX(-Math.PI / 2).rotateY(yaw).translate(L.at.x, L.y + 0.035, L.at.z));
    }
    // the lamp-post at the edge, an arm out over the void and the lamp hanging from it
    const p = L.edge;
    posts.push(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 6).translate(p.x, L.y + 1.8, p.z));
    posts.push(new THREE.BoxGeometry(0.08, 0.08, 1.2).lookAt(out).translate(p.x + out.x * 0.55, L.y + 3.5, p.z + out.z * 0.55));
    heads.push(new THREE.SphereGeometry(0.26, 10, 8).scale(1, 1.25, 1).translate(p.x + out.x * 1.1, L.y + 3.1, p.z + out.z * 1.1));
    lights.push(new THREE.Vector4(p.x + out.x * 1.1, L.y + 3.0, p.z + out.z * 1.1, 11));
  });
  // on the landing below the smog line (−150), the lamplighters' locker: a red cabinet by the post, its door ajar
  const low = landings.find((L) => L.y === -150);
  let locker = null;
  if (low) {
    const out = V(-Math.cos(low.a), 0, -Math.sin(low.a)), along = V(-Math.sin(low.a), 0, Math.cos(low.a));
    const c = low.edge.clone().addScaledVector(out, -1.2).addScaledVector(along, -1.6), yaw = Math.atan2(out.x, out.z);
    posts.push(new THREE.BoxGeometry(1.1, 1.7, 0.6).translate(0, 0.85, 0).rotateY(yaw).translate(c.x, low.y, c.z));
    posts.push(new THREE.BoxGeometry(0.06, 1.6, 0.55).translate(0.62, 0.85, 0.35).rotateY(yaw).translate(c.x, low.y, c.z));   // (the door, ajar)
    locker = { at: c.clone(), stand: c.clone().addScaledVector(out, 1.3), look: c.clone().setY(low.y + 1.3) };
  }
  // the rim posts: the same post, arm and lamp, from the Well's door along the edge to the red stair
  const rim = rimPosts(200);   // (the rim: src/levels/incal.js TOP)
  for (const { at: p, out } of rim) {
    posts.push(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 6).translate(p.x, p.y + 1.8, p.z));
    posts.push(new THREE.BoxGeometry(0.08, 0.08, 1.2).lookAt(out).translate(p.x + out.x * 0.55, p.y + 3.5, p.z + out.z * 0.55));
    heads.push(new THREE.SphereGeometry(0.26, 10, 8).scale(1, 1.25, 1).translate(p.x + out.x * 1.1, p.y + 3.1, p.z + out.z * 1.1));
  }
  const ringMesh = new THREE.Mesh(mergeGeometries(rings.map(flat0)), cream); ringMesh.userData.noCollide = true;
  const postMesh = new THREE.Mesh(mergeGeometries(posts.map(flat0)), red); postMesh.name = 'The lamplighters’ drops';
  const headMesh = new THREE.Mesh(mergeGeometries(heads.map(flat0)), lampMat); headMesh.userData.noCollide = true;
  scene.add(ringMesh, postMesh, headMesh);

  // a floating pad: a round deck on an inverted cone, a rail of posts, a lamp on a pole
  const pastel = makeMaterial({ color: '#9fc8c4', flat: true, grid: 2 });
  const rail = makeMaterial({ color: '#c9d2dc', metal: 'chrome' });
  const floatPad = (at, r, name, { lamp = true } = {}) => {
    const deck = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(r, r * 0.85, 1.6, 16).translate(0, -0.8, 0), new THREE.ConeGeometry(r * 0.6, r * 1.2, 12).rotateX(Math.PI).translate(0, -1.6 - r * 0.6, 0)].map(flat0)), pastel);
    deck.position.copy(at); deck.name = name; deck.userData.floats = true;   // (the clipping audit: meant to hang in the air)
    scene.add(deck);
    const bits = [];
    for (let k = 0; k < 10; k++) { if (k === 0) continue; const b = k / 10 * TAU; bits.push(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5).translate(Math.cos(b) * (r - 0.4), 0.5, Math.sin(b) * (r - 0.4))); }
    const railMesh = new THREE.Mesh(mergeGeometries(bits.map(flat0)), rail); railMesh.position.copy(at); scene.add(railMesh);
    if (lamp) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6).translate(0, 1.7, 0), red); pole.position.copy(at).add(V(-r * 0.5, 0, 0)); scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8).translate(0, 3.6, 0), lampMat); head.position.copy(pole.position); head.userData.noCollide = true; scene.add(head);
      lights.push(new THREE.Vector4(pole.position.x, at.y + 3.6, pole.position.z, 12));
    }
    return deck;
  };
  // the climb's pad: on the straight way from the shrine up to the palace gate, a quarter of the way
  const from = places.ossa, gate = places.palace.dov;
  const padAt = from.clone().lerp(gate, CLIMB.pad);
  floatPad(padAt, 6, 'The lamplighters’ pad');
  // and the upper pad, past the relay lamp, hanging just off the high ring's edge on the same side (the straight way runs
  // into the spire's top here): the last rest before the palace's landing ring, seen from the relay past the ring's rim
  const U = CLIMB.upper, upperAt = V(Math.cos(U.a) * U.r, U.y, Math.sin(U.a) * U.r);
  floatPad(upperAt, 5, 'The lamplighters’ upper pad');
  // the relay lamp on the spire's ring, on the side the bottom terrace sees
  const R = CLIMB.relay, relayAt = V(Math.cos(R.a) * R.r, R.y, Math.sin(R.a) * R.r);
  const brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' });
  const relayBody = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.5, 0.7, 0.4, 10).translate(0, 0.2, 0), new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6).translate(0, 1.5, 0), new THREE.CylinderGeometry(0.75, 0.35, 0.5, 12, 1, true).translate(0, 3.0, 0)].map(flat0)), brass);
  relayBody.position.copy(relayAt); relayBody.name = 'The relay lamp'; scene.add(relayBody);
  const relayGlass = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), makeMaterial({ color: '#fff3c8', flat: true, glow: 0.05, key: 'incal.relay.glass' }));
  relayGlass.position.copy(relayAt).add(V(0, 3.2, 0)); relayGlass.userData.noCollide = true; scene.add(relayGlass);
  const relayLight = new THREE.Vector4(relayAt.x, relayAt.y + 3.4, relayAt.z, 0);
  lights.push(relayLight);
  // Tobin's view pad: halfway down from the palace's crown to Nima on the high terrace, a coin telescope pointed up
  const viewAt = places.palace.crown.clone().lerp(places.nima, 0.5);
  floatPad(viewAt, 5, 'Tobin’s view pad', { lamp: false });
  const scope = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6).translate(0, 0.6, 0), new THREE.CylinderGeometry(0.14, 0.2, 1.3, 8).rotateX(-0.9).translate(0, 1.45, 0.3), new THREE.BoxGeometry(0.4, 0.3, 0.3).translate(0, 1.0, 0)].map(flat0)), brass);
  scope.position.copy(viewAt).add(V(1.2, 0, 0)); scope.rotation.y = Math.atan2(-viewAt.x, -viewAt.z); scope.name = 'Tobin’s telescope';
  scene.add(scope);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.06).translate(0, 1.3, 0), makeMaterial({ color: '#f2c54b', flat: true }));
  sign.position.copy(viewAt).add(V(-1.6, 0, 1.4)); sign.rotation.y = scope.rotation.y; scene.add(sign);
  // the cab rank: a pad over the shaft off the rim by the ship, its lamp and a yellow board, where the cabs wait
  const rankAt = V(Math.cos(CAB_RANK.a) * CAB_RANK.r, CAB_RANK.y, Math.sin(CAB_RANK.a) * CAB_RANK.r);
  floatPad(rankAt, 5, 'The cab rank');
  {
    const board = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.2, 0.9, 0.08).translate(0, 2.3, 0), new THREE.CylinderGeometry(0.06, 0.06, 1.9, 5).translate(-0.9, 0.95, 0), new THREE.CylinderGeometry(0.06, 0.06, 1.9, 5).translate(0.9, 0.95, 0)].map(flat0)), makeMaterial({ color: '#f2c54b', flat: true }));
    board.position.copy(rankAt).add(V(1.6, 0, 1.2)); board.rotation.y = Math.atan2(rankAt.x, rankAt.z); board.name = 'The cab rank’s board';
    scene.add(board);
  }
  // Tobin's telescopes (level design audit, fifth round: the hop from Tobin back to Lio was the 83 m you had just walked):
  // three more of his coin telescopes round the outer rim between them, each on its post turned to the shaft and the
  // palace over it, with a little yellow price board: the way he sends you back with his coin
  const scopeGeo = mergeGeometries([new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6).translate(0, 0.6, 0), new THREE.CylinderGeometry(0.14, 0.2, 1.3, 8).rotateX(-0.35).translate(0, 1.45, 0.3), new THREE.BoxGeometry(0.4, 0.3, 0.3).translate(0, 1.0, 0)].map(flat0));
  const boardGeo = new THREE.BoxGeometry(0.9, 0.5, 0.05).translate(0.7, 1.0, -0.2);
  const yellow = makeMaterial({ color: '#f2c54b', flat: true });
  const scopes = TOBIN_SCOPES.map(([x, z]) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(scopeGeo, brass), new THREE.Mesh(boardGeo, yellow));
    g.position.set(x, RIM_TOP, z); g.rotation.y = Math.atan2(-x, -z); g.name = 'Tobin’s telescope';
    scene.add(g);
    return g.position.clone();
  });
  const mast = dispatchMast(scene, lights);
  return {
    landings, lights, locker, mast,
    /** The rim posts, [x, y, z] from the Well's door to the red stair's gate (the level's line goes on down the stair to Nima). */
    rim: rim.map(({ at: p }) => [p.x, p.y, p.z]),
    /** The drops as a line, [x, y, z] from Nima's corner down to the shrine (the level design audit follows it). */
    line: [...landings.map((L) => [L.at.x, L.y, L.at.z]), ...(places.shrine ? [[places.shrine.x, places.shrine.y, places.shrine.z]] : [])],
    pad: { at: padAt.clone(), stand: padAt.clone().add(V(1.5, 0, 0)) },
    upper: { at: upperAt.clone(), stand: upperAt.clone().add(V(1.5, 0, 0)) },
    relay: { at: relayAt.clone(), glass: relayGlass, light: relayLight, look: relayAt.clone().add(V(0, 2.4, 0)) },
    view: { at: viewAt.clone(), stand: viewAt.clone().add(V(0.4, 0, 0.6)), scope: scope.position.clone().add(V(0, 1.6, 0)) },
    /** The cab rank over the shaft by the ship, and the ride home from Tobin past it, [x, y, z] (out to the ring, round, in). */
    rank: { at: rankAt.clone(), ride: [[301, RIM_TOP, 116], [Math.cos(CAB_HAIL.a) * CAB_HAIL.r, RIM_TOP, Math.sin(CAB_HAIL.a) * CAB_HAIL.r], [Math.cos(CAB_HAIL.a) * 150, RIM_TOP + 2.4, Math.sin(CAB_HAIL.a) * 150], [Math.cos(CAB_RANK.a) * 150, RIM_TOP + 2.4, Math.sin(CAB_RANK.a) * 150], [150, RIM_TOP + 2.4, 0], [251, RIM_TOP + 2.4, 0], [263, RIM_TOP, 0]] },
    /** Tobin's telescopes on the outer rim, and the way back past them from Tobin to Lio, [x, y, z]. */
    scopes: { at: scopes[1].clone().add(V(0, 1, 0)), line: [[304, RIM_TOP, 114], ...scopes.map((p) => [p.x, RIM_TOP, p.z]), [340, RIM_TOP, 45]] },
    /** No house or tree on a landing (the ring and the post), the level's clearing (houses still drawn, not kept). */
    clear: [...landings.map((L) => ({ x: L.at.x, y: L.y, z: L.at.z, r: 6 })), ...rim.map(({ at: p }) => ({ x: p.x, y: p.y, z: p.z, r: 2.5 })), ...scopes.map((p) => ({ x: p.x, y: p.y, z: p.z, r: 2.5 })), { x: mast.at.x, y: mast.at.y, z: mast.at.z, r: 6 }],
  };
}

/**
 * Lio's dispatch mast (issue #201): two steps and a plinth, a tapered mast in his teal banded in cream, a gallery round
 * its top, his booth on it (cream, a band of lit windows, a terracotta cap), a teal ring turning round the booth as the
 * palace's turn round its needle (the palace licenses the cabs), and the call-lamp on a short pole over the cap. Two
 * docking arms out from under the gallery toward the shaft, a cab parked under each. The steps, plinth, mast, gallery,
 * booth, cap and arms collide as drawn (you can climb it and stand on the gallery); the windows, the rail, the ring, the
 * lamp and the cabs don't. → { at (its foot), top (the lamp), height, gallery (y of its floor), lamp, ring, cabs }
 */
export function dispatchMast(scene, lights = []) {
  const { a, r, h } = DISPATCH, at = V(Math.cos(a) * r, RIM_TOP, Math.sin(a) * r);
  const cream = makeMaterial({ color: '#f3ead8', flat: true, grid: 3, key: 'incal.mast' });
  const teal = makeMaterial({ color: '#4fb3bb', flat: true, grid: 3, key: 'incal.mast.teal' });
  const roof = makeMaterial({ color: '#d0694a', flat: true, pattern: 'tiles', key: 'incal.mast.roof' });
  const gy = h - 11;   // the gallery's floor
  const B = 5;         // the booth's radius
  const creamG = [
    new THREE.CylinderGeometry(5.6, 5.8, 0.45, 8).translate(0, 0.225, 0),   // the steps
    new THREE.CylinderGeometry(4.4, 4.6, 0.9, 8).translate(0, 0.9, 0),       // the plinth (top 1.35)
    new THREE.CylinderGeometry(7.2, 5.8, 0.6, 16).translate(0, gy - 0.3, 0),   // the gallery
    new THREE.CylinderGeometry(B, B, 4.6, 14).translate(0, gy + 2.3, 0),       // the booth
    new THREE.CylinderGeometry(0.14, 0.2, 2.2, 6).translate(0, gy + 8.6, 0),   // the lamp's pole
  ];
  // the mast, and the cream bands up it (a hand's breadth proud of it)
  const tealG = [new THREE.CylinderGeometry(1.7, 2.8, gy - 1.35, 10).translate(0, 1.35 + (gy - 1.35) / 2, 0)];
  for (let k = 1; k <= 6; k++) { const y = 1.35 + (gy - 1.35) * (k / 7), rr = 2.8 - 1.1 * (k / 7) + 0.06; creamG.push(new THREE.CylinderGeometry(rr, rr + 0.03, 2.4, 10).translate(0, y, 0)); }
  const roofG = new THREE.ConeGeometry(B + 1.2, 3.4, 14).translate(0, gy + 4.6 + 1.7, 0);
  // the docking arms: out from under the gallery toward the shaft, either side
  const ARMS = [Math.PI - 0.6, Math.PI + 0.6];   // (local: -x is toward the shaft once the mast is turned)
  for (const yaw of ARMS) {
    tealG.push(new THREE.BoxGeometry(8.4, 0.7, 0.7).translate(7 + 4.2, gy - 0.95, 0).rotateY(yaw));
    tealG.push(new THREE.BoxGeometry(0.6, 1.8, 0.6).translate(15.2, gy - 2.0, 0).rotateY(yaw));   // (the clamp)
  }
  const body = new THREE.Mesh(mergeGeometries(creamG.map(flat0)), cream); body.name = 'Lio’s dispatch booth';
  const mastM = new THREE.Mesh(mergeGeometries(tealG.map(flat0)), teal); mastM.name = 'Lio’s dispatch mast';
  const cap = new THREE.Mesh(flat0(roofG), roof); cap.name = 'Lio’s dispatch booth’s roof';
  const windows = new THREE.Mesh(new THREE.CylinderGeometry(B + 0.05, B + 0.05, 1.3, 14, 1, true).translate(0, gy + 2.6, 0), makeMaterial({ color: '#fff3c8', flat: true, glow: 0.55, key: 'incal.mast.windows' }));
  const rail = new THREE.Mesh(new THREE.TorusGeometry(7.0, 0.07, 4, 40).rotateX(Math.PI / 2).translate(0, gy + 1.0, 0), makeMaterial({ color: '#c9d2dc', metal: 'chrome' }));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10).translate(0, h - 0.6, 0), makeMaterial({ color: '#8fe6ea', flat: true, glow: 1, key: 'incal.mast.lamp' }));
  lamp.name = 'Lio’s call-lamp';
  // the ring round the booth, turning (src/levels/incal.js turns it, as the palace's rings)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.55, 6, 48), makeMaterial({ color: '#62c3c9', key: 'incal.mast.ring' }));
  ring.position.y = gy + 2.6; ring.rotation.x = Math.PI / 2 + 0.25;
  const g = new THREE.Group();
  g.add(body, mastM, cap, windows, rail, lamp, ring);
  for (const m of [windows, rail, lamp, ring]) m.userData.noCollide = true;
  // (turned so the arms reach toward the shaft: local -x points at the shaft's middle)
  g.position.copy(at); g.rotation.y = -a;
  g.name = 'Lio’s dispatch mast';
  scene.add(g);
  // a cab docked under each arm's clamp (one group: the level hides it from deep in the shaft)
  const cabs = new THREE.Group(); cabs.name = 'Lio’s docked cabs'; g.add(cabs);
  ARMS.forEach((yaw, i) => {
    const cab = cabModel(i ? '#f2c54b' : '#62c3c9', 2.2);
    cab.position.set(Math.cos(yaw) * 15.2, gy - 4.7, -Math.sin(yaw) * 15.2);
    cab.rotation.y = yaw - Math.PI / 2;
    cab.traverse((o) => { o.userData.noCollide = true; });
    cabs.add(cab);
  });
  lights.push(new THREE.Vector4(at.x, RIM_TOP + h, at.z, 26));
  return { at: at.clone(), top: V(at.x, RIM_TOP + h + 1.0, at.z), height: h, gallery: RIM_TOP + gy, lamp, ring, cabs };
}
