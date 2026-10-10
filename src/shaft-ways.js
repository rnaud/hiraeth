import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// The City-Shaft's ways down and up (level design audit v1.15: the drop from Nima to Ossa and the climb from Ossa to
// the palace were 474 m and 564 m with nothing on them, and the walk back from the palace to Nima the way nobody marks).
// No rng: the city round them stays as it was.
//
//   the lamplighters' drops  before the cabs, the lamplighters went down the shaft terrace by terrace; each landing they
//                            dropped to is still marked on the edge of its terrace with a red lamp-post and a cream
//                            ring painted on the promenade, a spiral from Nima's corner of the high terrace down to the
//                            bottom terrace by the Upward Shrine: the way down on the jets. Halfway, on the middle
//                            levels, Perrine keeps her tea stall where they land (src/story/halfway.js HALFWAY).
//   the lamplighters' pad    a floating pad with a lamp a quarter of the way up from the bottom terrace toward the
//                            spire: the first rest on the climb to the palace
//   the relay lamp           on the spire's ring at the 92 m level, the side that faces the bottom: an old lamp of the
//                            Three Who Look Up, dark until the splinter passes it (src/story/incal.js)
//   Tobin's view pad         a floating pad halfway down from the palace to the high terrace, a coin telescope on it
//                            pointed up at the Lodestar ("looking up remains free")
//
//   dropLandings(terraces, places) → [{ y, a, at, edge, terrace }]   (pure: the tests and the audit use it)
//   buildShaftWays(scene, { terraces, places, R }) → { landings, lights, line, pad, relay, view, clear }

/** The drops' landings: the angle round the shaft on each level (rad), from Nima's corner down to by the shrine. */
export const DROPS = { 150: 1.06, 92: 1.28, 36: 1.55, [-24]: 1.84, [-86]: 2.14, [-150]: 2.44, [-218]: 2.76, [-290]: 2.98 };
/** How far in from the terrace's inner edge a landing's ring is painted (m), and its radius. */
export const DROP_RING = { inset: 5, r: 2.2 };
/** The climb's floating pad and the relay lamp, and the view pad: where on the straight line between their stops. */
export const CLIMB = { pad: 0.26, relay: { y: 92, r: 44, a: Math.PI } };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
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
  return {
    landings, lights, locker,
    /** The drops as a line, [x, y, z] from Nima's corner down to the shrine (the level design audit follows it). */
    line: [...landings.map((L) => [L.at.x, L.y, L.at.z]), ...(places.shrine ? [[places.shrine.x, places.shrine.y, places.shrine.z]] : [])],
    pad: { at: padAt.clone(), stand: padAt.clone().add(V(1.5, 0, 0)) },
    relay: { at: relayAt.clone(), glass: relayGlass, light: relayLight, look: relayAt.clone().add(V(0, 2.4, 0)) },
    view: { at: viewAt.clone(), stand: viewAt.clone().add(V(0.4, 0, 0.6)), scope: scope.position.clone().add(V(0, 1.6, 0)) },
    /** No house or tree on a landing (the ring and the post), the level's clearing (houses still drawn, not kept). */
    clear: landings.map((L) => ({ x: L.at.x, y: L.y, z: L.at.z, r: 6 })),
  };
}
