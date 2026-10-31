import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, rod, tube, pivot, pair, lerp, ease, eyeColor, finish, V, merged, lowestIn } from './kit.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { tripoBody, boneBoxes, subset, surfaceNormal } from './tripo-body.js';
import { toadLegacyModel } from './hopper-legacy.js';

// The bellows toad (issue #800): the game's `toad`, everywhere it is fielded (Lorn, the City-Shaft, the Waterfall, the
// Arena's Home skin, the gallery). Its body is Tripo's (task 6183568d-…, from the approved image,
// references/enemy-redesign-2026-10-30/bellows-toad/c5a76758-…-0.png), made into the game's asset by the family A trial's
// prepare-toad.mjs (references/enemy-redesign-2026-10-30/trials/familyA-tripo/: the game's frame at the legacy toad's
// 2.2 m, 12k triangles, its parts cut by geometry: the belly's edge a smooth curve round the body, the webbed feet under
// a plane; the painted eyes painted out) and shipped by scripts/tripo/ship-body.mjs as public/enemies/bellows-toad/body.glb
// (its triangles grouped by part, COLOR_0, the landmarks in its extras; no picture: each part one flat colour).
//
// Its rig, the many-legged family's (a custom skin on the game's legs, the shellback's route): the motion kit's hopper plan,
// four legs fitted to the mesh's own (the landmarks: each arm's and hind leg's hip, knee, ankle and foot), their thigh,
// shin and foot bones framed in each leg's bend plane (src/characters/creature-legs.js SkinLegs). Every vertex weighted
// to its nearest part (a capsule round each leg segment, the webbed feet to their foot), blended over a few centimetres;
// the rest is the trunk, the head (it turns to you: its top eased onto it) and the bellows: the belly on its own bone,
// eased out to its edge, that breathes as it sits and swells as it winds up a lob. Three skinned meshes on one skeleton,
// one a part (the sage skin, the belly, the toes), each its part's flat colour and painted surface
// (src/enemies/surfaces.js: the home skin's soft mottle, the other worlds' spots).
//
// Its look at you (the author's rule, #800): Tripo's eye bumps ride the head, which turns to the traveller; the painted
// eyes are out, and two heavy-lidded eyes of their own (an iris and a slot of a pupil) sit on the bumps' fronts, sliding
// the rest of the way (they go orange as it winds up, and the lids shut as it chokes).
//
// It moves hop by hop, as the legacy toad did (plans/hopper-legacy.js): its drawn body stays on its planted feet while the
// mind's position runs ahead, then crouches, launches, tucks its legs in the air and lands squashed on the next spot.
// Its attacks read from the body alone (src/telegraph.js):
//   lob     the bellows swells, glowing, a see-through bubble of throat with the glob inside it, it rears back; the glob
//           arcs out of its mouth onto its landing mark (the one exception: a thrown thing)
//   volley  the same, fuller, three globs (the City-Shaft and the Waterfall)
//   flop    a deep crouch, its legs shaking; then the leap, belly first, and a ring of shock as it lands
// Its dress per world: the City-Shaft's brass valve and gauge with its pipe, the Waterfall's jet, Home's flower, set on the
// mesh's measured back and head. Where the body is not loaded (a page that built a toad before loadToadBody finished, an
// old player's files) the legacy toad stands in.

/** The shipped body, under public/. */
export const TOAD_BODY = 'enemies/bellows-toad/body.glb';
const LOADER = tripoBody(TOAD_BODY, 'bellows toad', (host, fs) => (host ? host.readFile(TOAD_BODY) : fs?.readFileSync(new URL(`../../../public/${TOAD_BODY}`, import.meta.url))));
/** The loaded body (null until loaded; the engines and Node read it on first use). */
export const toadSource = LOADER.source;
/** The body, loaded once; the game awaits it before it builds its foes (src/main.js). */
export const loadToadBody = (base) => LOADER.load(base);
/** Stand a source in (the trial page's, a test's), or null to forget it. */
export const setToadSource = LOADER.set;

/** The toad's builder (src/enemies/plans/index.js): the Tripo body, or the legacy toad where it is not loaded. */
export function toadModel(skin) {
  const src = toadSource();
  return src ? tripoToadModel(skin, src) : toadLegacyModel(skin);
}

/** The reference's flat colours (prepare-toad.mjs PALETTE): the home skin's (skins.js SKINS.toad.perdide). */
export const TOAD_ROLES = { skin: '#9bbb85', belly: '#f0bd72', toe: '#f2c27e', eye: '#e9a85a' };
/** The head that turns to you (m, the game's frame): where it turns about, from what height its vertices go to it, how far. */
const HEAD = { pivot: [0, 1.72, 0.45], from: 1.6, to: 1.86, yaw: 0.32, up: 0.12, down: 0.16 };
/** The bellows (m): the belly's bone, the ellipsoid its weight eases out over, the front it is on. */
const BELLOWS = { pivot: [0, 1.0, 0.3], at: [0, 1.02, 0.62], radii: [0.86, 0.98, 0.72], front: [0.25, 0.7] };
const BLEND = 0.05;   // m over which a vertex is shared by its two nearest parts
/**
 * The hopper's plan, its feet kept nearer home: a fused mesh's haunch follows its thigh, and a foot left 0.3–0.6 m off
 * its home as it turned on the spot (the plan's drift and reach) folded the knee down into the ground (tests/foe-slope).
 */
const PLAN = { ...PLANS.hopper, gait: { ...PLANS.hopper.gait, drift: 0.14, reach: 0.26 } };
/** The lowest a knee may fold to, a share of its rest height (and a haunch round it kept off the ground). */
const KNEE_MIN = 0.62;
const BELLY_CLEAR = 0.04;   // (m: its belly's lowest point over the ground as it lands)

const _v = new THREE.Vector3(), _a = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);
/** Distance from p to the segment a–b. */
const segDist = (p, a, b) => { _a.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_a) / Math.max(1e-9, _a.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_a, t).distanceTo(p); };
const smooth = THREE.MathUtils.smoothstep;

const CACHE = new WeakMap();
/** The weights of one source geometry (worked out once: every toad shares them). bones: { trunk, head, belly, leg: [{ thigh, shin, foot }] }. */
function weigh(src, bones) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count;
  const segs = [];
  L.legs.forEach((l, k) => {
    segs.push({ b: bones.leg[k].thigh, a: vec(l.hip), z: vec(l.knee), r: l.r, leg: k });
    segs.push({ b: bones.leg[k].shin, a: vec(l.knee), z: vec(l.ankle), r: l.rShin ?? l.r, leg: k });
  });
  const eyes = L.eyes.map((e) => vec(e.at));
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3(), w = new Map();
  const ba = BELLOWS.at, br = BELLOWS.radii;
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i); w.clear();
    const put = (b, x) => { if (x > 1e-4) w.set(b, (w.get(b) ?? 0) + x); };
    if (p.y < L.footTop + 0.06) {
      // the webbed feet: their own foot's (the nearest along the ground), eased onto its shin over the ankle
      let k = 0, d = Infinity; L.legs.forEach((l, j) => { const e = Math.hypot(p.x - (l.ankle[0] + l.foot[0]) / 2, p.z - (l.ankle[2] + l.foot[2]) / 2); if (e < d) { d = e; k = j; } });
      const f = 1 - smooth(p.y, L.footTop - 0.02, L.footTop + 0.06);
      put(bones.leg[k].foot, f); put(bones.leg[k].shin, 1 - f);
    } else {
      // a leg's segment, the nearest two parts blended; the torso (score 0: a vertex outside every capsule)
      let best = { s: 0, b: -1 }, second = { s: Infinity, b: -1 };
      for (const s of segs) {
        const d = segDist(p, s.a, s.z) - s.r;
        if (d < best.s) { second = best; best = { s: d, b: s.b }; } else if (d < second.s && s.b !== best.b) second = { s: d, b: s.b };
      }
      const x = best.b === second.b ? 1 : THREE.MathUtils.clamp(0.5 + (second.s - best.s) / (2 * BLEND), 0.5, 1);
      const torso = best.b < 0 ? x : second.b < 0 ? 1 - x : 0;
      if (best.b >= 0) put(best.b, x); if (second.b >= 0 && second.b !== best.b) put(second.b, 1 - x);
      if (torso > 0) {
        // the torso: the head over its line (the eye bumps all its), the bellows on the belly's front, the trunk the rest
        const h = Math.max(smooth(p.y, HEAD.from, HEAD.to), eyes.some((e) => e.distanceTo(p) < 0.2) ? 1 : 0);
        const e = Math.hypot((p.x - ba[0]) / br[0], (p.y - ba[1]) / br[1], (p.z - ba[2]) / br[2]);
        const b = (1 - smooth(e, 0.55, 1)) * smooth(p.z, BELLOWS.front[0], BELLOWS.front[1]) * (1 - h);
        put(bones.head, torso * h); put(bones.belly, torso * b); put(bones.trunk, torso * (1 - h - b));
      }
    }
    const top = [...w].sort((u, v) => v[1] - u[1]).slice(0, 4), sum = top.reduce((s, [, x]) => s + x, 0) || 1;
    if (!top.length) top.push([bones.trunk, 1]);
    top.forEach(([b, x], j) => { SI[i * 4 + j] = b; SW[i * 4 + j] = x / sum; });
  }
  // the lowest of the torso's own points (kept off the ground as it lands, issue #332): the belly's and the haunches'
  const low = [];
  for (let i = 0; i < n; i++) if (P.getY(i) < 0.62 && SI[i * 4] === bones.trunk && SW[i * 4] > 0.9) low.push(new THREE.Vector3().fromBufferAttribute(P, i));
  low.sort((a, b) => a.y - b.y);
  const out = { SI, SW, low: low.filter((_, j) => j % 7 === 0).slice(0, 24) };
  CACHE.set(src.geometry, out);
  return out;
}

/** The toad's body (the model contract of plans/index.js), from the loaded source (toadSource). */
export function tripoToadModel(skin, src) {
  const L = src.landmarks;
  const P = skin.palette, props = new Set(skin.props);   // (the home skin's palette is the reference's: TOAD_ROLES, src/enemies/skins.js)
  const M = materials('toad', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · bellows toad`;
  const body = pivot(g, 0, 0, 0, 'body');
  const trunk = pivot(body, 0, 0, 0, 'trunk');
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), off = knee.clone().sub(hip);
    const pole = off.addScaledVector(along, -off.dot(along) / along.lengthSq());
    // (the arms nearly straight: their elbows out and back; the hind knees where the mesh folds them, so the solve keeps them there)
    if (l.arm) pole.set(l.side * 0.6, 0.1, -0.5);
    pole.normalize();
    // (the kit plants the ankle's spot: the webbed toes reach on ahead of it, on the foot bone)
    const leg = planLeg(PLAN, { group: g, body, hipParent: trunk, hip: { x: l.hip[0], y: l.hip[1], z: l.hip[2] }, foot: { x: l.ankle[0], z: l.ankle[2] }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.02, mats: { joint: hide }, name: `toad ${l.arm ? 'arm' : 'leg'} ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: PLAN, group: g, body, legs });
  // ---------------------------------------------------------------- the bones: the trunk, the head, the bellows, the legs (group children, bend-plane framed)
  const list = [trunk], index = (o) => { list.push(o); return list.length - 1; };
  const headRoot = pivot(trunk, ...HEAD.pivot, 'head');
  const headGaze = gazePart(g, headRoot, { mode: 'turn', yaw: HEAD.yaw, up: HEAD.up, down: HEAD.down });
  const headBone = index(headGaze.node);
  const bellows = pivot(trunk, ...BELLOWS.pivot, 'bellows');
  const bellyBone = index(bellows);
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    const thigh = mk('thigh', hip, knee.clone().sub(hip)), shin = mk('shin', knee, ankle.clone().sub(knee)), foot = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    return { thigh: index(thigh), shin: index(shin), foot: index(foot), objs: { [`leg${k}_thigh`]: thigh, [`leg${k}_shin`]: shin, [`leg${k}_foot`]: foot } };
  });
  legs.forEach((leg, k) => { const foot = legBones[k].objs[`leg${k}_foot`]; leg.root.lowest = (out) => foot.getWorldPosition(out); });
  // the rest pose (the bind's): the kit's segments at the landmarks, so SkinLegs measures its offsets there
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...legBones.map((x) => x.objs)), group: g, body: trunk });
  // ---------------------------------------------------------------- the meshes: one a part, on one skeleton
  const prep = weigh(src, { trunk: 0, head: headBone, belly: bellyBone, leg: legBones });
  const geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  // (the belly its own toad's: it glows as the bellows swells)
  const PARTS = { skin: M.mat('skin', P.skin), belly: M.own('belly', P.belly, { flat: false, hatch: 0.45, patches: 0, glow: 0 }), toe: M.mat('toe', P.toe) };
  const meshes = Object.entries(L.parts).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), PARTS[part]);
    sm.name = `toad ${part}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  const bellyM = PARTS.belly;
  // the eyes on the bumps' fronts (prepare-toad.mjs measured the painted ones): an iris each, heavy-lidded, a slot of a
  // pupil across it, a little proud of the bump along its normal there, on the head; the gaze slides them the rest of the way
  const eyeM = M.own('eye', P.eye, { glow: 0.45 }), darkM = M.mat('dark', P.dark ?? '#3f4a32', { flat: true });
  const H0 = vec(HEAD.pivot), irisGeo = [], pupilGeo = [];
  for (const e of L.eyes) {
    const at = vec(e.at), nrm = surfaceNormal(geo, at, 0.08, new THREE.Vector3(0, 0.3, 1)).lerp(new THREE.Vector3(0, 0, 1), 0.35).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm), c = at.clone().addScaledVector(nrm, 0.02).sub(H0);
    irisGeo.push(new THREE.SphereGeometry(0.06, 14, 10).scale(1.3, 0.7, 0.4).applyQuaternion(q).translate(c.x, c.y, c.z));
    pupilGeo.push(new THREE.CapsuleGeometry(0.016, 0.1, 3, 6).rotateZ(Math.PI / 2).scale(1, 1, 0.5).translate(0, 0.012, 0).applyQuaternion(q).translate(...c.clone().addScaledVector(nrm, 0.022).toArray()));   // (the heavy lid's line across its top)
  }
  const eyesNode = pivot(headGaze.node, 0, 0, 0, 'eyes');
  const iris = merged(irisGeo); iris.computeBoundingBox(); const mid = iris.boundingBox.getCenter(new THREE.Vector3());
  iris.translate(-mid.x, -mid.y, -mid.z); const pupils = merged(pupilGeo); pupils.translate(-mid.x, -mid.y, -mid.z);
  eyesNode.position.copy(mid);
  const irisMesh = add(eyesNode, iris, eyeM); irisMesh.name = 'eyes';
  add(eyesNode, pupils, darkM).name = 'pupils';
  const gaze = [headGaze, gazePart(g, irisMesh, { mode: 'slide', slide: 0.02 })];
  // the throat's bubble: it swells see-through out of the bellows' top with the glob inside (the legacy toad's sac, its veil)
  const sacM = M.own('sac', P.sac, { glow: 0.05, veil: 1 }); sacM.uniforms.uVeil.value = 0;
  const throat = pivot(bellows, 0, 0.62, 0.68, 'throat');
  const bag = add(throat, new THREE.SphereGeometry(1, 20, 16), sacM); bag.visible = false; bag.scale.setScalar(0.1);
  const glob = add(throat, new THREE.IcosahedronGeometry(0.4, 2), M.mat('glob', P.glob), 0, 0, 0.1); glob.visible = false;
  const mouthTip = pivot(headGaze.node, 0, 1.92 - HEAD.pivot[1], L.front - HEAD.pivot[2] + 0.05);   // (where the glob leaves, and its glow gathers)
  // the dress: the City-Shaft's brass valve and gauge with its pipe, the Waterfall's jet, Home's flower (on the measured back and head)
  const back = backAt(geo), dress = [];
  let steam = null, gauge = null;
  const brassM = () => M.mat('brass', P.brass ?? '#c49a52');
  if (props.has('valve')) {
    const v = pivot(headGaze.node, 0.05, back(0, -0.1).y - HEAD.pivot[1] - 0.04, -0.1 - HEAD.pivot[2], 'valve'), bm = brassM();
    rod(v, [0, -0.05, 0], [0, 0.22, 0], 0.05, bm); add(v, new THREE.TorusGeometry(0.1, 0.022, 6, 12).rotateX(Math.PI / 2), bm, 0, 0.24, 0);
    rod(v, [-0.12, 0.24, 0], [0.12, 0.24, 0], 0.016, bm); dress.push(v); steam = v;
  }
  if (props.has('gauge')) {
    const at = back(0.32, -0.62), bm = brassM();
    gauge = pivot(trunk, 0.32, at.y + 0.04, -0.62 + at.z, 'gauge'); gauge.rotation.set(-0.6, 0.5, 0);
    add(gauge, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 18).rotateX(Math.PI / 2), bm);
    add(gauge, new THREE.CircleGeometry(0.14, 18), M.mat('dial', '#f4ecd6'), 0, 0, -0.037).rotation.y = Math.PI;
    rod(gauge, [0, 0, -0.04], [0.06, 0.08, -0.045], 0.008, darkM);
    const pts = [[0.12, -0.15], [0.3, -0.4], [0.45, -0.62]].map(([x, z]) => { const b = back(x, z); return [x, b.y + 0.04, z]; });
    tube(trunk, pts, 0.03, bm); dress.push(gauge);
  }
  if (props.has('jet')) { const at = back(0, -0.75), bm = brassM(); const j = pivot(trunk, 0, at.y - 0.05, -0.75 + at.z, 'jet'); j.rotation.x = -0.9; add(j, new THREE.CylinderGeometry(0.08, 0.14, 0.32, 10), bm); add(j, new THREE.TorusGeometry(0.09, 0.025, 6, 12).rotateX(Math.PI / 2), bm, 0, 0.17, 0); dress.push(j); steam = j; }
  if (props.has('flower')) { const fl = pivot(headGaze.node, -0.22, back(-0.22, 0.4).y - HEAD.pivot[1] - 0.03, 0.4 - HEAD.pivot[2], 'flower'); rod(fl, [0, 0, 0], [0.02, 0.24, 0.02], 0.014, M.mat('stem', '#5a8a3c')); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; add(fl, new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.4, 1.6), M.mat('flower', P.flower), Math.sin(a) * 0.07, 0.26, Math.cos(a) * 0.07).rotation.y = a; } add(fl, new THREE.SphereGeometry(0.04, 8, 6), M.mat('heart', '#f2d36b'), 0, 0.27, 0); dress.push(fl); }
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, list, prep.SI, RENDER_FRAME); }
  const parts = [...meshes, ...dress, ...legs.map((l) => l.root)];
  // the hop: where its drawn body is (it lags the mind's position by up to a hop, then leaps ahead of it)
  const HOP = PLANS.hopper.hop;
  const drawn = V(), from = V(), to = V(), prev = V(), vel = V();
  const r = (toads++ * 0.618034) % 1, own = 0.8 + r * 0.45;   // (its own rhythm, by the golden ratio: two toads never hop together)
  let squared = false, hop = null, ground = r * 0.7, squash = 0, crouch = 0, swell = 0, flip = 0, rear = 0, started = false, tumble = 0, blink = 0;
  const _w = V();
  return {
    group: g, gaze, body: trunk, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.toe], spore: P.glob,
    toad: 'tripo',
    tell: (id) => (id === 'flop' ? legs[2].foot : mouthTip),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      if (!started) { drawn.copy(f.pos); prev.copy(f.pos); started = true; }
      if (dt > 0) { _w.subVectors(f.pos, prev).divideScalar(dt); vel.lerp(_w.setY(0), 1 - Math.exp(-6 * dt)); }
      prev.copy(f.pos);
      const leaping = id === 'flop' && strike && f.alt > 0.001;
      const still = wind || f.stunned > 0 || f.flipped > 0 || leaping || f.state === 'recover';
      // the hop: it lags, crouches, leaps ahead of the mind and lands; in a wind-up it hops once onto its true spot
      if (leaping) { hop = null; drawn.copy(f.pos); }
      else if (!hop) {
        ground += dt;
        const off = Math.hypot(f.pos.x - drawn.x, f.pos.z - drawn.z);
        if (off > 3) drawn.copy(f.pos);   // (a teleport, a respawn: no hop across the world)
        else if (ground > (HOP.gap + HOP.squash) * own && off > (still || vel.length() < 0.3 ? 0.15 : HOP.catchUp * own)) {
          from.copy(drawn);
          const ahead = still ? 0 : HOP.crouch + HOP.air;
          to.set(f.pos.x + vel.x * ahead, f.pos.y, f.pos.z + vel.z * ahead);
          const D = Math.hypot(to.x - from.x, to.z - from.z), most = HOP.length * 2;
          if (D > most) to.set(from.x + (to.x - from.x) * most / D, to.y, from.z + (to.z - from.z) * most / D);
          hop = { t: -HOP.crouch / HOP.air, h: HOP.height * Math.min(1.2, 0.6 + D / HOP.length * 0.5) };
        }
      }
      let up = 0, air = 0;
      if (hop) {
        hop.t += dt / HOP.air;
        if (hop.t < 0) crouch = ease(crouch, 1, 18, dt);
        else {
          const u = Math.min(1, hop.t);
          drawn.lerpVectors(from, to, u);
          up = Math.sin(Math.PI * u) * hop.h; air = 1.6;
          crouch = ease(crouch, 0, 20, dt);
          if (hop.t >= 1) { drawn.copy(to); hop = null; ground = 0; squash = 1; c.dust(drawn, P.belly, 6, 0.8); }
        }
      }
      if (leaping) { up = f.alt; air = 1.4; }
      squash = Math.max(0, squash - dt / HOP.squash);
      // (its height: the ground at the mind's spot, and on a slope the plane's rise to the drawn one, src/enemies/slope.js)
      const SL = f.slope;
      drawn.y = f.pos.y + (SL ? SL.sx * (drawn.x - f.pos.x) + SL.sz * (drawn.z - f.pos.z) : 0);
      g.position.x = drawn.x; g.position.z = drawn.z; g.position.y = drawn.y + f.over + up;
      // the wind-ups: the lob's swelling bellows and rearing back; the flop's deep crouch, legs shaking
      const lob = id === 'lob' || id === 'volley';
      const flop = id === 'flop' && wind ? c.wind : 0;
      swell = ease(swell, lob && wind ? c.wind * (id === 'volley' ? 1.15 : 1) : lob && strike ? 0.4 : (f.state === 'idle' ? 0.1 + Math.max(0, Math.sin(c.now / 700 + f.home.x)) * 0.18 : 0), wind ? 10 : 5, dt);
      rear = ease(rear, lob && wind ? c.wind : 0, 9, dt);
      flip = ease(flip, f.flipped > 0 ? 1 : 0, 8, dt);
      tumble = leaping ? Math.min(1, f.k * 2) : ease(tumble, 0, 10, dt);
      const o = rig.update({ pos: drawn, heading: f.heading, state: f.state, k: f.k, atk: f.atk, stunned: f.stunned }, dt,
        { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: air || (flip > 0.3 ? 1.4 : 0), landHome: true });
      // (it sits square: the kit's first stance staggers the feet over a stride, which would stretch the mesh's legs)
      if (!squared && rig.planner?.ready) { squared = true; for (const ft of rig.planner.feet) { rig.planner.homeOf(ft, drawn, f.heading, ft.pos); ft.planted = true; } }
      const shake = flop ? Math.sin(c.now / 22) * 0.025 * flop : 0;
      trunk.position.set(o.x + shake, o.y - crouch * 0.14 - squash * 0.12 + shake * 0.5, o.z);
      trunk.scale.set(1 + squash * 0.1 + crouch * 0.05, 1 - squash * 0.12 - crouch * 0.06 + (up > 0 ? 0.06 : 0), 1 + squash * 0.1);
      trunk.rotation.set(o.pitch + tumble * 0.7 * Math.sin(Math.PI * Math.min(1, f.k)) - flip * 1.35, o.yaw, o.roll + shake * 2);
      if (flip < 0.05) { const need = BELLY_CLEAR - lowestIn(g, trunk, prep.low); if (need > 0) trunk.position.y += need; }
      // the bellows: breathing as it sits, swelling and glowing as it winds up (its own bone, eased out to its edge)
      const sw = Math.max(swell, f.stunned > 0 && !f.flipped ? 0.3 : 0);
      bellows.scale.set(1 + sw * 0.14, 1 + sw * 0.08, 1 + sw * 0.3);
      bellyM.uniforms.uGlow.value = Math.max(0, sw - 0.25) * 0.5;
      // the throat's bubble: out of its top, see-through, the glob floating inside
      const ball = THREE.MathUtils.smoothstep(sw, 0.3, 0.6);
      bag.visible = ball > 0.02; bag.scale.set(lerp(0.12, 0.5, ball), lerp(0.1, 0.44, ball), lerp(0.1, 0.42, ball));
      sacM.uniforms.uGlow.value = 0.05 + sw * 0.55;
      sacM.uniforms.uVeil.value = ball > 0.05 ? lerp(0.98, 0.7, ball) : 0;
      glob.visible = lob && wind && f.k < 0.66; glob.scale.setScalar((0.35 + sw * 0.25) * ball);
      headGaze.node.parent.rotation.x = -rear * 0.25 + (strike && lob ? 0.2 : 0);
      // eyes: wide open fighting, heavy-lidded sitting; shut as it chokes
      blink = ease(blink, f.provoked ? (f.stunned > 0 ? 0.15 : 1) : 0.55 + Math.max(0, Math.sin(c.now / 2300 + f.home.z)) * -0.4, 10, dt);
      eyesNode.scale.set(1, Math.max(0.12, blink), 1);
      // the glob out of its mouth over the wind-up's last part, onto its mark (each of a volley's a little behind)
      const pts = f.attackPts ?? [f.attackAt], u = lob && wind ? (f.k - 0.66) / 0.34 : -1;
      mouthTip.getWorldPosition(_w);
      if ((lob && wind) || f.globs) for (let i = 0; i < pts.length || i < (f.globs?.length ?? 0); i++) c.lob(f, i < pts.length ? u - i * 0.08 : -1, P.glob, i, pts[i] ?? f.attackAt, _w);
      if (gauge) gauge.children[2].rotation.z = -swell * 2.4;
      if (steam && (swell > 0.4 || (f.state === 'idle' && Math.random() < 0.02)) && Math.random() < 0.3) c.spray(steam.getWorldPosition(V()), ['#ffffff', '#e8eef2'], 1, 0.8, -1.5);
      if (f.stunned > 0 && !f.flipped && Math.random() < 0.2) c.spray(mouthTip.getWorldPosition(V()), [P.glob, P.sac], 1, 1.2, 2);
      rig.write();
      // (a knee kept off the ground: folded hard as a foot steps in under it, a fused haunch would follow its knee into
      // the floor; its own rest height's half at least, on its back the legs are free)
      if (flip < 0.3) legs.forEach((l, k) => { const y = l.root.position.y + l.shin.position.y, min = KNEE_MIN * L.legs[k].knee[1]; if (y < min) l.shin.position.y += min - y; });
      skinLegs.write(f.heading, { air: air > 0.5 || flip > 0.3 ? 1 : 0 });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose() { M.dispose(); hide.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}
let toads = 0;

/** The body's back and head top: at(x, z) → the highest point of the mesh near that column (y, and z offset 0), for its dress. */
function backAt(geo) {
  const P = geo.attributes.position, n = P.count;
  return (x, z) => {
    let y = 0;
    for (let i = 0; i < n; i++) if (Math.abs(P.getX(i) - x) < 0.08 && Math.abs(P.getZ(i) - z) < 0.08) y = Math.max(y, P.getY(i));
    return { y, z: 0 };
  };
}
