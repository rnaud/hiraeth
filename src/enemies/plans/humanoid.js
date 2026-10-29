import * as THREE from 'three';
import { SecondOrder } from '../../motion-kit/spring.js';
import { VerletChain } from '../../motion-kit/chain.js';
import { materials, add, tubeGeometry, many, skinBy, pivot, pair, lerp, ease, smooth, finish, V, outerPoints, frameIn } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver } from '../humanoid-rig.js';
import { Wielder, SWORD_WRIST } from '../wield.js';

// Plan 9, the humanoid spirit (docs/systems/procedural-animation.md §4, the kit's `humanoid`): the shade
// (docs/design/enemy-roster.md, archetype 19), drawn to its sheets (references/enemy-archetypes/shade/: sheet-1 Lorn II's
// hollow woodsman, sheet-2 the Eclipse's pilgrim). A cloak worn by nothing, 2.2 m to the hood's point: a long cloak
// from the shoulders to below the knees, open down the front on the dark inside, its hem torn into tatters that break
// into smoke; a capelet and a tall pointed hood (the woodsman's of rough bark, its point swept back; the pilgrim's round
// with a brass crescent on top), no face, only two white eyes in the dark of the hood; wide sleeves bent at the elbow,
// empty at the cuff but for a gauntlet on the sword hand; a brass clasp at the chest; long ribbons trailing from the
// hood; below the hem two empty boots, greaves to the knee ringed in brass, the knees bending.
//
// The manifestation: a cloak of smoke worn by nothing. The cloak hangs empty, its hem breaks into smoke that drops
// away; the sword is poured ink, drawn out of the sleeve as it comes for you and running back in when it calms.
//
// On the humanoid foe rig (issue #724, src/enemies/humanoid-rig.js; it walked on the kit's `humanoid` plan before): the
// traveller's clips walk it and wind up its moves (SHADE_MOVES), its chest kept upright and its body floating a little over
// its boots; the cloak hangs from its shoulders, turned with the chest but hanging, on springs that lag its moves (it
// sways back as it goes and swings round as it turns), its ribbons trail on verlet chains. Draws: every part of a
// material one skinned mesh on the rig's joints (kit.js skinBy), about eleven a shade.
//
// Its attacks read from the body (src/telegraph.js; nothing on the ground):
//   cut    the sword drawn back over its shoulder, the body turning away and the hood turning to keep you in sight;
//          then the cut across its front
//   feint  it starts the cut and stops halfway, the hood tilting; the sword drops to its hip and it sinks; then a
//          thrust, low and straight (a guard raised for the cut comes too early for the parry)
//   step   it sinks into its own shadow: the cloak collapses into a pool and the pool slides round beside you; it pours
//          up out of it there and cuts (recut). Lit (an ember), it is solid and can't step
// Calm (`pace`): it walks a path it walked in life, back and forth, and stops at the end of it as at a doorway, waiting.
// Skins (src/enemies/skins.js): the woodsman's bark hood (Lorn II), the vagrant's ragged coat (the City-Shaft), the
// mechanic's pointed hood and goggles (the Hangar), a halo over the hood (the Garden of Spheres), a glinting veil (the
// Glass Dunes), the pilgrim's crescent and belt lantern (the Eclipse).

const HIP_Y = 0.98, SH = { x: 0.26, y: 1.52 }, NECK = 1.6, UPPER = 0.32, FORE = 0.4;
const DEPTH = 0.74;   // (the cloak's depth to its width: the sheet's side view)
/** The cloak's profile (r, y) from the neck down to the hem: narrow at the shoulders, falling nearly straight past the
 * knees as heavy cloth does, flaring only a little at the hem (the hem torn: jag(); hung in folds: cloakGeometry). */
const CLOAK = [[0.12, 1.62], [0.22, 1.585], [0.28, 1.51], [0.3, 1.36], [0.32, 1.18], [0.345, 1.0], [0.37, 0.84], [0.395, 0.7], [0.42, 0.56], [0.445, 0.44]];
const HEM = 0.44;
const SMOKE_CLEAR = 0.04;   // (the smoke's tongues' tips over the ground, group units)
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _mr = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

/** The torn hem: how far above its line a tatter's tip ends at angle a (rad round the body; 0 ahead), m. */
export const jag = (a, ragged = 1) => (0.17 * Math.abs(Math.sin(a * 5)) + 0.07 * Math.abs(Math.sin(a * 11 + 1))) * ragged - 0.24 * Math.max(0, -Math.cos(a));

/**
 * A lathe from (r, y) pairs, its bottom row torn (jag), its front open by `gap` rad, its depth squashed; hung in soft
 * folds (`folds` m deep at the hem, none at the top: the cloth's vertical folds, gathered at the shoulders).
 */
function cloakGeometry(profile, { gap = 0, ragged = 1, depth = DEPTH, seg = 32, folds = 0 } = {}) {
  // (a lathe's faces look out when its profile runs bottom to top: the hem is its first row)
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const geo = new THREE.LatheGeometry(pts, seg, gap / 2, Math.PI * 2 - gap);
  const pos = geo.attributes.position, n = pts.length;
  for (let i = 0; i < pos.count; i++) {
    const row = i % n, a = Math.atan2(pos.getX(i), pos.getZ(i));
    let x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    if (folds) {
      // (the folds deepen down the cloth, irregular: two waves round the body; the hem's tatters hang from their ridges)
      const t = Math.max(0, Math.min(1, (pts[n - 1].y - y) / Math.max(0.01, pts[n - 1].y - pts[0].y)));
      const f = 1 + (folds / Math.hypot(x, z || 1e-6)) * t * t * (0.7 * Math.sin(a * 9 + 0.6) + 0.3 * Math.sin(a * 17 + 2.1));
      x *= f; z *= f;
    }
    if (row === 0) y += jag(a, ragged);
    if (row <= 1) y -= 0.05 * Math.max(0, -Math.cos(a));   // (it trails a little longer behind)
    pos.setXYZ(i, x, y, z * depth);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * The smoke the hem breaks into, in flame-like curls (the sheets', v1.47): `n` tongues of smoke hanging from inside the
 * hem, each wide at its root (overlapping the next, under the cloth) and narrowing to a point, flat across like a drawn
 * flame, waving down its length and curling over at its tip, each the other way from the last; shorter at the front,
 * where the boots step through. Closed tubes (no double-sided material); one geometry.
 */
export function flameGeometry({ r0 = 0.37, top = 0.13, len = 0.5, n = 16, width = 0.11, curl = 0.38, rows = 12, sides = 8, ragged = 1 } = {}) {
  const pos = [], idx = [], c = new THREE.Vector3(), t = new THREE.Vector3(), o = new THREE.Vector3(), p = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2 + Math.sin(k * 1.9) * 0.08, dir = k % 2 ? 1 : -1;
    const front = 1 - 0.5 * Math.max(0, Math.cos(a0) - 0.5) / 0.5;
    const L = (top + len * (0.55 + 0.45 * Math.abs(Math.sin(k * 2.7 + 0.4)) * Math.min(1.3, ragged))) * front, w = width * (0.8 + 0.3 * Math.abs(Math.sin(k * 1.3)));
    const base = pos.length / 3;
    for (let j = 0; j <= rows; j++) {
      const u = j / rows;
      // (its axis: down its length, waving across (an S), curling over at the tip, leaning out a little)
      const a = a0 + dir * (curl * u * u * u + 0.08 * Math.sin(u * Math.PI * 2 + k)) * (0.8 + 0.4 * Math.sin(k * 0.7));
      const r = r0 + 0.08 * u * u;
      c.set(Math.sin(a) * r, top - u * L + 0.06 * u * u * u * Math.abs(Math.sin(k)), Math.cos(a) * r * DEPTH);
      t.set(Math.cos(a), 0, -Math.sin(a) * DEPTH).normalize();   // (across: round the hem)
      o.set(Math.sin(a), 0, Math.cos(a) * DEPTH).normalize();    // (out)
      const rad = w * Math.max(0, 1 - Math.pow(u, 1.3)) * (0.85 + 0.15 * Math.sin(Math.PI * u));
      for (let i = 0; i < sides; i++) {
        const ph = (i / sides) * Math.PI * 2;
        p.copy(c).addScaledVector(t, Math.cos(ph) * rad).addScaledVector(o, Math.sin(ph) * rad * 0.4);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < sides; i++) {
      const A = base + j * sides + i, B = base + j * sides + ((i + 1) % sides), C = A + sides, D = B + sides;
      idx.push(A, B, C, B, D, C);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();   // (each ring runs from across to out, so the quads face out of the tube)
  return geo;
}

/** The hood: a lathe to a point, its point swept back (sweep m at the tip), or round and tall (the pilgrim's). */
function hoodGeometry(round, sweep) {
  const P = round ? [[0.17, -0.02], [0.185, 0.08], [0.18, 0.2], [0.15, 0.31], [0.1, 0.39], [0.03, 0.43], [0.001, 0.435]]
    : [[0.17, -0.02], [0.18, 0.08], [0.165, 0.2], [0.125, 0.31], [0.08, 0.41], [0.035, 0.5], [0.001, 0.57]];
  const geo = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.max(0, y - 0.18); pos.setZ(i, pos.getZ(i) * 0.95 - k * k * sweep); }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Ribbons as one skinned mesh: each a strip of cloth whose row i of vertices (across its width, along the joint's x) is
 * bound to joint i, so it bends continuously wherever its joints go (a chain's points). width(i): its width at row i.
 */
function ribbonMesh(owner, chains, mat, width) {
  owner.updateMatrixWorld(true);
  const bones = [], inv = new THREE.Matrix4().copy(owner.matrixWorld).invert(), pos = [], nrm = [], si = [], sw = [], idx = [], P = new THREE.Vector3();
  for (const joints of chains) {
    const base = pos.length / 3;
    joints.forEach((j, i) => {
      const b = bones.length; bones.push(j);
      P.setFromMatrixPosition(j.matrixWorld).applyMatrix4(inv);
      for (const s of [-1, 1]) { pos.push(P.x + s * width(i) / 2, P.y, P.z); nrm.push(0, 0, 1); si.push(b, 0, 0, 0); sw.push(1, 0, 0, 0); }
      if (i > 0) { const a = base + (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a + 1, a + 2, a, a + 3, a + 2, a + 1); }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  const sm = new THREE.SkinnedMesh(geo, mat); sm.name = 'ribbons'; sm.frustumCulled = false;
  owner.add(sm); sm.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  return sm;
}

/** The shade's proportions on the humanoid rig (humanoidSkeleton's D, m at size 1): the hips at 0.98, the shoulders at 1.52, the hood's neck at 1.6. */
export const SHADE_BODY = { hip: HIP_Y, hipX: 0.13, thigh: 0.45, shin: 0.45, chest: SH.y - HIP_Y, shoulder: SH.x, upper: UPPER, fore: FORE, neck: NECK - SH.y };
/**
 * Each move's clip (src/enemies/humanoid-rig.js stateClip; issue #724): the clip's anticipation `from` → `load` (held from
 * 75 % of the wind-up), its cut at the attack's contact, its follow-through to `to`.
 *   cut    the sword-and-shield slash (the traveller's first cut): the sword drawn back up over its right shoulder, then
 *          across its front
 *   recut  out of its pool: the backhand (the traveller's second cut), the sword wound back past its left shoulder
 *   feint  the cut's clip run only to `half` (the cut stopped halfway: never loaded), then the sword dropped to its hip in
 *          the guard's crouch (ss_block_idle, the procedural `thrust` arms) and the thrust from there
 *   step   no clip: it sinks into its pool (the squash, the model's own)
 */
export const SHADE_MOVES = {
  cut: { clip: 'ss_slash_1', from: 0.1, load: 0.45, cut: 0.6, to: 0.85 },
  recut: { clip: 'ss_slash_3', from: 0.2, load: 0.55, cut: 0.82, to: 1.05 },
  feint: { clip: 'ss_slash_1', from: 0.1, half: 0.3, load: 0.45, cut: 0.6, to: 0.85, feint: { clip: 'ss_block_idle', at: 0.5, pose: 'thrust' } },
};
/**
 * How it holds its ink sword (src/enemies/wield.js, #744; dirs in the chest's frame: x its left, y up, z ahead): carried
 * low and forward out of the gauntlet; the cut drawn back up over its right shoulder, then across to its left; the recut
 * a backhand from over its left shoulder; the feint's stopped cut, then dropped to its hip point ahead and thrust
 * straight in; its guard up across its body to its left.
 */
export const SHADE_HOLD = {
  sword: { side: 0, r: 0.022, wrist: SWORD_WRIST, edge: [0, 1], edges: 2, reach: [1.12, 0.05], carry: { dir: [0, -0.5, 0.86] },
    moves: {
      cut: { wind: [-0.3, 0.78, -0.55], via: [-0.62, 0.3, 0.72], hit: [0.75, -0.1, 0.65] },
      recut: { wind: [0.5, 0.62, -0.6], via: [0.35, 0.2, 0.9], hit: [-0.8, 0, 0.6] },
      feint: { wind: [-0.3, 0.78, -0.55], thrust: { wind: [0, -0.05, 1], hit: [0, 0, 1] } },
    },
    poses: { swordGuard: { dir: [0.45, 0.85, 0.25] } } },
};
/** Its walk, jog and sprint (m/s): it glides, the library's walk stretched up to most of its chase, the jog only at its fastest. */
const SHADE_SPEEDS = { walk: 1.6, jog: 4.2, sprint: 6.5 };
/** Its boots float: how far its body hangs over them (m), and the slow rise and fall of it; `upright`: the share of the clip's lean of the chest and the head it keeps (it glides upright, the cloak hanging straight). */
export const SHADE_FLOAT = { lift: 0.022, bob: 0.012, rate: 2.3, upright: 0.45 };

let floats = 0;
export function shadeModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('shade', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, SHADE_BODY), D = SHADE_BODY, T = J.torso, head = J.head;
  // built in these; drawn as one skinned mesh a material on the rig's joints (kit.js skinBy)
  const cloakB = M.mat('cloakBuild', P.cloak), liningB = M.mat('liningBuild', P.lining), faceB = M.mat('faceBuild', P.face);
  const hoodB = M.mat('hoodBuild', P.hood), stripB = M.mat('stripBuild', P.strip), brassB = M.mat('brassBuild', P.brass);
  const bootB = M.mat('bootBuild', P.boot), innerB = M.mat('innerBuild', P.inner), swordB = M.mat('swordBuild', P.sword), smokeB = M.mat('smokeBuild', P.smoke);
  const faceM = M.mat('face', P.face, { vertexColors: true, flat: true, hatch: 0 });
  const cloakM = M.mat('cloak', P.cloak, { vertexColors: true });
  const hoodM = M.mat('hood', P.hood, { vertexColors: true, flat: props.has('bark') }), stripM = M.mat('strip', P.strip, { vertexColors: true, line: 0.45, lineTint: 1 });
  const bootM = M.mat('boot', P.boot, { vertexColors: true });
  const swordM = M.own('sword', P.sword, { vertexColors: true, flat: false, glow: 0.05 }), smokeM = M.mat('smoke', P.smoke, { vertexColors: true, lineWhite: true, hatch: 0 });
  // (the smoke its hem breaks into is drawn in negative, white-lined like the old shade: the spirit showing, and what
  // reads of a dark shade on dark ground at night)
  const eyeM = M.own('eye', P.eye, { glow: 0.95 }), poolM = M.own('pool', P.face, { flat: true });
  const ragged = props.has('ragged') ? 1.7 : 1;
  // the cloak: hung from its shoulders (`drape`: it hangs down whatever the clip does with the chest, and lags the body
  // on springs), open down the front on the dark inside
  const drape = pivot(T, 0, D.chest, 0, 'drape');
  const shoulder = (geo) => geo.translate(0, -SH.y, 0);
  add(drape, shoulder(cloakGeometry(CLOAK, { gap: 0.5, ragged, folds: 0.085, seg: 48 })), cloakB);
  add(drape, shoulder(cloakGeometry(CLOAK.slice(2).map(([r, y]) => [r * 0.9, y]), { gap: 0, ragged: ragged * 0.9, folds: 0.07, seg: 40 })), liningB);   // (from the shoulders down: none of it shows under the hood)
  // the brass clasp at the chest, where the cloak closes under the capelet
  many(drape, [new THREE.TorusGeometry(0.055, 0.016, 6, 16).translate(0, 1.43 - SH.y, 0.29 * DEPTH + 0.06), new THREE.CircleGeometry(0.04, 12).translate(0, 1.43 - SH.y, 0.29 * DEPTH + 0.055)], brassB);
  // smoke where the hem breaks up: flame-like tongues curling down from inside the hem and narrowing to nothing
  // (flameGeometry, v1.47), a few small puffs among them (the smoke drifts round and breathes; drops fall off it as it goes)
  const smoke = pivot(drape, 0, HEM - SH.y, 0, 'smoke'), puffs = [flameGeometry({ ragged, len: 0.42 + 0.06 * ragged })];
  for (let i = 0; i < 10; i++) { const a = i * 1.7 + 0.4, r = 0.3 + (i % 2) * 0.09; puffs.push(new THREE.IcosahedronGeometry(0.04 + (i % 3) * 0.013, 1).translate(Math.sin(a) * r, -0.3 - (i % 3) * 0.07, Math.cos(a) * r * DEPTH)); }
  many(smoke, puffs, smokeB);
  const smokePts = outerPoints(smoke);   // (its lowest points however it hangs: kept off the ground)
  // the head: a capelet over the shoulders, the hood (no face: the dark of it, two white eyes), its ribbons' roots
  add(head, cloakGeometry([[0.1, 0.05], [0.21, 0.0], [0.3, -0.08], [0.34, -0.17], [0.355, -0.24]], { gap: 0, ragged: 0.45, depth: 0.82, seg: 24 }), hoodB);
  const round = props.has('crescent');
  add(head, hoodGeometry(round, props.has('bark') || props.has('pointed') ? 1.3 : 0.6), hoodB, 0, 0.0, 0);
  // (the face: the dark of the hood's opening, a black hollow; two white eyes in it)
  many(head, [new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.135, 0.155, 0.03).translate(0, 0.15, 0.172)], faceB);
  const eyes = new THREE.Group(); head.add(eyes); eyes.name = 'eyes';
  many(eyes, pair((s) => new THREE.SphereGeometry(1, 8, 6).scale(0.022, 0.02, 0.012).translate(s * 0.045, 0.17, 0.222)), eyeM);
  // the skins' dress on the hood: the pilgrim's crescent on a knob, the halo shade's ring, the mechanic's goggles, the
  // nomad's glinting veil
  if (round) {
    many(head, [new THREE.TorusGeometry(0.085, 0.026, 6, 18, Math.PI * 1.2).rotateZ(Math.PI + Math.PI * 0.1).translate(0, 0.6, -0.02), new THREE.SphereGeometry(0.035, 8, 6).translate(0, 0.47, -0.02), new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6).translate(0, 0.5, -0.02)], brassB);
  }
  if (props.has('halo')) many(head, [new THREE.TorusGeometry(0.2, 0.018, 6, 28).rotateX(Math.PI / 2 - 0.2).translate(0, 0.78, -0.12)], brassB);
  if (props.has('goggles')) many(head, pair((s) => new THREE.TorusGeometry(0.045, 0.014, 6, 14).translate(s * 0.06, 0.3, 0.17)), brassB);
  if (props.has('veil')) many(head, [new THREE.CylinderGeometry(0.17, 0.19, 0.12, 18, 1, true, -1, 2).translate(0, 0.08, 0.02)], stripB);
  // its ribbons: four long strips from the hood and the shoulders, trailing on verlet chains; each one continuous cloth,
  // its rows of vertices bound to the joints at its chain's points (ribbonMesh: one draw for all four)
  const STRIP = { n: 7, len: 0.14 };
  const strips = [[-0.16, NECK + 0.2, -0.02], [0.16, NECK + 0.2, -0.02], [-0.3, SH.y + 0.02, 0.0], [0.3, SH.y + 0.02, 0.0]].map(([x, y, z], k) => {
    const joints = [];
    for (let i = 0; i <= STRIP.n; i++) joints.push(pivot(g, 0, -i * STRIP.len, 0, `strip ${k}.${i}`));
    return { at: V(x, y, z), joints, wave: [], chain: new VerletChain({ n: STRIP.n, length: STRIP.len, stiffness: 0.06, damping: 0.9, gravity: 3.4 }), seed: k * 1.7 };
  });
  const ribbons = ribbonMesh(g, strips.map((S) => S.joints), stripM, (i) => 0.1 * (1 - i / (STRIP.n + 2)));
  // the sleeves on the rig's arms: a ball of shoulder under the cloak, an upper sleeve bent at the elbow, a wide bell of a
  // forearm sleeve open at the cuff (dark inside); on the sword hand a gauntlet, and the ink sword in it
  J.arms.forEach((sh, i) => {
    const el = J.elbows[i];
    add(sh, new THREE.SphereGeometry(0.1, 10, 8), cloakB);
    add(sh, new THREE.CylinderGeometry(0.085, 0.1, UPPER, 10).translate(0, -UPPER / 2, 0), cloakB);
    add(el, new THREE.SphereGeometry(0.09, 10, 8), cloakB);
    add(el, new THREE.CylinderGeometry(0.085, 0.2, FORE, 14, 1, true).translate(0, -FORE / 2, 0), cloakB);
    add(el, new THREE.CylinderGeometry(0.078, 0.185, FORE * 0.96, 14, 1, true).translate(0, -FORE / 2, 0), liningB);
    add(el, new THREE.CircleGeometry(0.18, 14).rotateX(Math.PI / 2).translate(0, -FORE + 0.05, 0), faceB);   // (the dark in the cuff)
  });
  // (the sword hand: index 0, its right (x < 0)): a gauntlet in the cuff, and the sword poured out of it along its grip's +y
  const RH = J.hands[0];
  many(RH, [new THREE.CapsuleGeometry(0.05, 0.08, 4, 8).translate(0, -0.02, 0), new THREE.TorusGeometry(0.055, 0.012, 5, 12).rotateX(Math.PI / 2).translate(0, 0.04, 0)], bootB);
  const grip = pivot(RH, 0, -0.06, 0.02, 'grip');
  const sword = pivot(grip, 0, 0, 0, 'sword');
  {
    // poured ink: a long flattened blade that waves a little, thinning to a point, drops hanging off its edges
    const L = props.has('ragged') ? 0.95 : 1.1, pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 5) * 0.012, t * L, Math.sin(t * 3 + 1) * 0.015]); }
    const blade = tubeGeometry(pts, 0.05, 0.006).scale(0.32, 1, 1);
    const drops = [blade, new THREE.SphereGeometry(0.045, 8, 6).scale(1.6, 0.7, 1).translate(0, 0.02, 0)];
    for (let i = 0; i < 7; i++) drops.push(new THREE.SphereGeometry(0.012 + (i % 3) * 0.005, 6, 4).translate((i % 2 ? 1 : -1) * 0.02, 0.15 + i * 0.12, 0.004));
    many(sword, drops, swordB);
  }
  // the belt lantern (the pilgrim's: it glows), the mechanic's wrench
  let lamp = null;
  if (props.has('lantern')) {
    lamp = pivot(drape, 0.22, 1.12 - SH.y, 0.24, 'lantern');
    many(lamp, [new THREE.CylinderGeometry(0.03, 0.04, 0.03, 8).translate(0, 0.03, 0), new THREE.CylinderGeometry(0.035, 0.035, 0.015, 8).translate(0, -0.08, 0), new THREE.TorusGeometry(0.02, 0.005, 4, 8).translate(0, 0.06, 0)], brassB);
    add(lamp, new THREE.CylinderGeometry(0.03, 0.03, 0.09, 6).translate(0, -0.03, 0), M.own('flame', P.glow ?? '#ffd27a', { glow: 0.9 }));
  }
  if (props.has('wrench')) many(drape, [new THREE.BoxGeometry(0.03, 0.26, 0.02).translate(-0.24, 1.0 - SH.y, 0.26), new THREE.TorusGeometry(0.035, 0.012, 5, 10, Math.PI * 1.4).translate(-0.24, 1.14 - SH.y, 0.26)], brassB);
  // the empty boots on the rig's legs: thighs of dark cloth (mostly under the cloak), greaves to the knee with a brass
  // ring under the knee and at the ankle, pointed boots
  const ankle = D.hip - D.thigh - D.shin;
  J.legs.forEach((leg, i) => {
    many(leg, [new THREE.SphereGeometry(0.07, 8, 6), new THREE.CylinderGeometry(0.06, 0.068, D.thigh, 10).translate(0, -D.thigh / 2, 0)], innerB);
    const kn = J.knees[i];
    many(kn, [new THREE.CylinderGeometry(0.085, 0.072, D.shin * 0.82, 10).translate(0, -D.shin * 0.5, 0), new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.7, 1.1).translate(0, 0, 0.02)], bootB);
    many(kn, [new THREE.TorusGeometry(0.083, 0.014, 5, 14).rotateX(Math.PI / 2).translate(0, -D.shin + 0.07, 0), new THREE.TorusGeometry(0.075, 0.012, 5, 14).rotateX(Math.PI / 2).translate(0, -D.shin * 0.14, 0)], brassB);
    many(J.feet[i], [new THREE.SphereGeometry(0.065, 8, 6), new THREE.SphereGeometry(1, 10, 6).scale(0.07, 0.06, 0.16).translate(0, 0.06 - ankle, 0.06), new THREE.ConeGeometry(0.045, 0.1, 8).rotateX(Math.PI / 2).translate(0, 0.045 - ankle, 0.22)], bootB);
  });
  // (its boots float a little under it: its own touch over the clip's pose)
  let floatT = (floats++ * 2.37) % 7;   // (each its own phase; no draw on Math.random: the fights' seeded runs)
  const _se = new THREE.Euler();
  const keep = (j) => { _se.setFromQuaternion(j.quaternion, 'YXZ'); _se.x *= SHADE_FLOAT.upright; j.quaternion.setFromEuler(_se); };
  const style = (Jt, want) => {
    J.body.position.y += SHADE_FLOAT.lift + SHADE_FLOAT.bob * Math.sin(floatT * SHADE_FLOAT.rate);
    if (!want.clip) { keep(J.torso); keep(J.head); }   // (walking, standing: upright; its cuts keep the clip's lean)
  };
  const driver = new HumanoidDriver(J, rig, { moves: SHADE_MOVES, speeds: SHADE_SPEEDS, style });
  const wield = new Wielder(J, driver, { grips: [grip, null], at: [[0, -0.06, 0.02], null], weapons: SHADE_HOLD });
  // the pool it sinks into for the step (its own: it slides round beside you)
  const pool = add(g, new THREE.CircleGeometry(0.55, 18).rotateX(-Math.PI / 2), poolM, 0, 0.03, 0); pool.visible = false;
  // its hood turns to keep you in sight once it has noticed you, on its way before (src/enemies/gaze.js, issue #508)
  const gaze = [gazePart(g, head, { mode: 'turn', yaw: 0.9, up: 0.4, down: 0.5 })];
  // (the boots, their brass and the dark cloth over the knees one mesh, each tinted its own colour; the lining and the
  // smoke one: fewer draws, as many looks)
  const [, faceS, , , , swordS, smokeS] = skinBy(g, [
    { from: [cloakB], into: cloakM }, { from: [faceB, liningB], into: faceM }, { from: [hoodB], into: hoodM }, { from: [stripB], into: stripM },
    { from: [bootB, brassB, innerB], into: bootM }, { from: [swordB], into: swordM }, { from: [smokeB], into: smokeM },
  ]);
  finish(g);
  // (nothing casts a shadow that wouldn't show in one: the eyes, the pool, the smoke, the ribbons)
  for (const o of [smokeS, faceS, ribbons, pool]) if (o) o.castShadow = false;
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, head, drape, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  // the cloak's lag: springs
  const lagP = new SecondOrder(1.4, 0.35, 0), lagR = new SecondOrder(1.4, 0.35, 0);
  let drawn = 0, sink = 0, rise = 1, prevX = null, prevZ = 0, prevH = 0, swing = 0, ward = 0;
  const local = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3();
  return {
    group: g, gaze, body: rig, rig: null, upright: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.cloak, P.smoke, P.face],
    driver, joints: J, wield,
    tell: (id) => (id === 'step' ? T : sword),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const k = f.k ?? 0;
      floatT += dt;
      // its guard (issue #661, src/foe-guard.js): crouched behind the ink sword held up across its body, the empty sleeve's
      // cuff against the blade: the sword-and-shield guard's crouch over the walk, the sword arm across it
      ward = ease(ward, f.guardK ?? 0, 12, dt);
      const want = driver.update(f, c, { upper: ward > 0.01 ? { clip: 'ss_block_idle', w: ward } : null, pose: ward > 0.01 && f.state !== 'wind' && f.state !== 'strike' ? 'swordGuard' : null, poseW: ward });   // (not `!f.atk`: a foe keeps its last attack after it, #724)
      // the velocity in its own frame: the cloak sways back as it goes, swings out as it turns
      const vx = prevX == null ? 0 : (f.pos.x - prevX) / dt, vz = prevX == null ? 0 : (f.pos.z - prevZ) / dt;
      const turn = prevX == null ? 0 : Math.atan2(Math.sin(f.heading - prevH), Math.cos(f.heading - prevH)) / dt;
      prevX = f.pos.x; prevZ = f.pos.z; prevH = f.heading;
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const flutter = Math.sin(c.now / 380 + f.home.x) * 0.02;
      // the cloak hangs from its shoulders: it turns with the chest but stays hanging (a third of the chest's lean), lags
      // on its springs, and gathers up as the body crouches (its hem kept off the ground)
      g.updateMatrixWorld(true);
      g.getWorldQuaternion(_qa).invert(); T.getWorldQuaternion(_qb); _qa.multiply(_qb);   // (the chest's turn in the model's frame)
      _e.setFromQuaternion(_qa, 'YXZ');
      const lean = lagP.update(dt, THREE.MathUtils.clamp(-fwd * 0.07, -0.35, 0.2)) + flutter, roll = lagR.update(dt, THREE.MathUtils.clamp(side * 0.06 + turn * 0.04, -0.3, 0.3));
      _qb.setFromEuler(_e.set(0.3 * _e.x + lean, _e.y, 0.3 * _e.z + roll, 'YXZ'));
      drape.quaternion.copy(_qa.invert().multiply(_qb));
      drape.updateWorldMatrix(true, false);
      const top = g.worldToLocal(drape.getWorldPosition(_p)).y;
      drape.scale.set(1, THREE.MathUtils.clamp((top - HEM * 0.92) / (SH.y - HEM * 0.92), 0.7, 1.04), 1);
      smoke.rotation.y += dt * 0.35;
      const breath = 1 + Math.sin(c.now / 300 + f.home.z) * 0.06;
      smoke.scale.set(breath, 1 + Math.sin(c.now / 410) * 0.1, breath);
      // (its tongues hang to the ground and no further: drawn up as the hem comes down, a step, a sway, a hillside's
      // uphill side; they went 16-19 cm through it, issue #332)
      // (it stands upright on a slope, its feet reaching down to it: the ground under each point is the slope's plane,
      // f.slope, in the model's frame)
      const SL = f.slope, hc = Math.cos(f.heading), hs = Math.sin(f.heading);
      const under = (q) => (SL ? SL.sx * (q.x * hc + q.z * hs) + SL.sz * (q.z * hc - q.x * hs) : 0);
      for (let i = 0; i < 2; i++) {
        frameIn(smoke, g, _m);
        const t = _v.setFromMatrixPosition(_m).y;
        let k = 1;
        for (const p of smokePts) { _w.copy(p).applyMatrix4(_m); const floor = under(_w) + SMOKE_CLEAR; if (_w.y < floor) k = Math.min(k, (t - floor) / Math.max(1e-3, t - _w.y)); }
        if (k >= 1) break;
        smoke.scale.y *= Math.max(0.2, k);
      }
      // the sword: poured out of the sleeve as it comes for you, back in as it calms (and gone into the pool)
      const fighting = f.state !== 'idle' && f.state !== 'home';
      drawn = ease(drawn, fighting && !(id === 'step' && wind) ? 1 : 0, fighting ? 5 : 2, dt);
      sword.scale.set(1, Math.max(0.02, drawn), 1);
      if (swordS) swordS.visible = drawn > 0.04;
      // carried low and forward out of the fist; straight out of it along the arm for the thrust; up across its body in
      // its guard; in a cut, as the clip's fist holds the traveller's sword
      wield.update(f, want, c, 'sword');
      // the feint: the hood tilts as the cut stops
      const A = f.atk?.feint ?? 0.45;
      const tilt = id === 'feint' && wind ? smooth(k, A - 0.05, A + 0.08) * (1 - smooth(k, A + 0.3, 0.75)) * 0.4 : 0;
      if (tilt) head.rotateZ(tilt);
      // the step: it sinks into its pool, the pool slides round beside you; it pours up out of it for the recut
      const stepping = id === 'step' && wind;
      sink = ease(sink, stepping ? c.wind : 0, stepping ? 9 : 14, dt);
      rise = id === 'recut' && wind ? Math.min(rise, 0.2) : 1;
      if (id === 'recut' && wind) rise = Math.max(0.22, smooth(k, 0, 0.55));
      const tall = Math.min(1 - sink * 0.85, rise);
      const squash = Math.max(0.22, tall);
      g.scale.set(skin.scale, skin.scale * squash, skin.scale);
      pool.visible = sink > 0.05 || tall < 0.95;
      if (pool.visible) {
        pool.scale.setScalar(0.6 + 0.8 * Math.max(sink, 1 - tall));
        pool.scale.y = 1 / squash;   // (flat on the ground whatever the body's squash)
        // (it slides toward where it will come up: beside you)
        if (stepping) { g.updateMatrixWorld(true); local.copy(f.attackAt); g.worldToLocal(local); const t = smooth(k, 0.35, 1); pool.position.set(local.x * t, 0.03 / squash, local.z * t); }
        else pool.position.set(0, 0.03, 0);
      }
      // the ribbons trail on their chains (world space), each point a joint of the skinned strips
      g.updateMatrixWorld(true); _m.copy(g.matrixWorld).invert(); _mr.extractRotation(_m);
      for (const S of strips) {
        const root = head.localToWorld(_v.copy(S.at).sub(V(0, NECK, 0)));
        // (they hang out to their side and back, fluttering)
        const out = Math.sign(S.at.x) * (0.3 + Math.sin(c.now / 520 + S.seed) * 0.1), bk = 0.45 + Math.sin(c.now / 700 + S.seed * 2) * 0.12;
        const back = _w.set(Math.cos(f.heading) * out - Math.sin(f.heading) * bk, -1, -Math.sin(f.heading) * out - Math.cos(f.heading) * bk);
        const pts = S.chain.update(dt, root, back);
        // (a ripple runs down each ribbon, sideways to its fall, growing toward its end: cloth, not a plank)
        const n = S.joints.length;
        for (let i = 0; i < n; i++) {
          const q = (S.wave[i] ??= new THREE.Vector3()), w = Math.sin(i * 1.3 - c.now / 260 + S.seed) * 0.03 * i;
          q.copy(pts[i]); q.x += Math.cos(f.heading) * w; q.z -= Math.sin(f.heading) * w;
        }
        for (let i = 0; i < n; i++) {
          const a = S.wave[Math.max(0, i - 1)], b = S.wave[Math.min(n - 1, i + 1)], j = S.joints[i];
          j.position.copy(S.wave[i]).applyMatrix4(_m);
          const dir = _w.subVectors(a, b).applyMatrix4(_mr).normalize();
          j.quaternion.setFromUnitVectors(_up, dir);
          j.rotateY(Math.sin(i * 0.7 + c.now / 450 + S.seed) * 0.35 + Math.sign(S.at.x) * 0.5);   // (it twists as it falls, its face turned out)
        }
      }
      // smoke drops off its hem as it goes, more as it is hurt; the eyes flare as it winds up
      swing = ease(swing, wind ? 1 : 0, 6, dt);
      if (Math.random() < 0.03 + 0.08 * (1 - f.hp / f.def.hp) + (fighting ? 0.03 : 0)) c.drip(f, P.smoke);
      if (stepping && Math.random() < 0.4) c.spray(f.pos.clone().setY(f.pos.y + 0.1), [P.face, P.smoke], 1, 1.2, -0.5);
      eyeM.uniforms.uColor.value.set(f.lit > 0 ? (P.lit ?? '#ffb36a') : wind ? (P.flare ?? '#fff6d8') : f.stunned > 0 ? '#bfe9ff' : P.eye);
      eyeM.uniforms.uGlow.value = 0.8 + swing * 0.2;
      // lit (an ember), it burns solid: the smoke thins and the sword glows
      swordM.uniforms.uGlow.value = 0.05 + (f.lit > 0 ? 0.4 : 0) + swing * 0.25;
      if (lamp) lamp.rotation.x = Math.sin(c.now / 260) * 0.25 - fwd * 0.08;
      return want;
    },
    dispose: M.dispose,
  };
}
