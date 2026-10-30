import * as THREE from 'three';
import { materials, add, many, pivot, lerp, ease, eyeColor, finish, skinBy, merged } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver } from '../humanoid-rig.js';
import { Fist, fingerPivots, Wielder } from '../wield.js';
import { MUMMER_MOVES, MUMMER_HOLD, clubParts, spearParts, bowParts, bowCord, drawCord, drawOf } from './mummer.js';
import { surfaceColor } from '../surfaces.js';
import { RENDER_FRAME } from '../../render-frame.js';

// The dune mummer, built direct (issue #800 phase 2: a trial body, not in the game's roster until the author picks it;
// the game's mummer is plans/mummer.js mummerModel). Drawn to the approved reference
// (references/enemy-redesign-2026-10-30/keep-mummer/ad94a6b0-…-1.png) and measured off the author's T-pose picks
// (keep-mummer/tpose/sheet-1.jpg front and back, sheet-2.jpg the side): one sage-green gourd that is head and body at
// once, no neck, widest low; a smooth cream oval mask high on its front with two short black slits; a salmon patch on
// the chest under it; short sage sleeves; big rust gauntlets with a dark band at the wrist and broad mittens (the
// approved image's, broader than the T-pose's); short sturdy legs in rust boots with sand toe caps. 1.2 m at size 1,
// 1.8 m in the game (the archetype's ×1.5, #741).
//
// It is the mummer in everything but its body: the same archetype id, kind, skins, def (whack, jab, bow volley, rock
// lob, the windows, the mask, the disarm), sounds (FOE_MOVES 'mummer', FOE_CALLS 'junk'), ragdoll and lying body; on
// the same humanoid clip rig (#724: humanoidSkeleton, HumanoidDriver, the traveller's clips) with the same moves
// (MUMMER_MOVES) and holds (MUMMER_HOLD: the club, spear and bow in its fists). The mask knocked off shows the blank
// wet black face under it, its eyes small and pale there. The head looks at the traveller (gaze on the head joint):
// the gourd's top turns with it, weighted between the body and the head, so the mask turns on its face.
//
// Draws: the gourd one skinned mesh (body and head weights blended over its upper half); every other part (sleeves,
// gauntlets, mittens, boots, mask, patch, face, the weapons, the dropped weapons and the flown mask) one rigidly
// skinned mesh on the rig's joints (kit.js skinBy, each part's colour a vertex tint); the eyes one: 3.

/** Its proportions (m, at size 1): humanoidSkeleton's D (the joints where Tripo's rig put them on the same body). */
export const DUNE_BODY = { hip: 0.41, hipX: 0.15, thigh: 0.165, shin: 0.175, chest: 0.39, shoulder: 0.24, upper: 0.18, fore: 0.165, neck: 0.06 };
/** The gourd, bottom to top: [y, half width, half depth, its centre's z] (m, size 1), measured off the T-pose sheets. */
export const GOURD = [
  [0.262, 0.02, 0.015, 0], [0.275, 0.16, 0.08, 0], [0.30, 0.228, 0.125, 0], [0.33, 0.255, 0.158, 0], [0.37, 0.272, 0.186, 0], [0.42, 0.286, 0.208, 0],
  [0.48, 0.29, 0.222, 0], [0.54, 0.286, 0.226, 0], [0.60, 0.276, 0.218, 0], [0.66, 0.262, 0.208, 0.002], [0.72, 0.25, 0.196, 0.004], [0.78, 0.238, 0.182, 0.006],
  [0.84, 0.222, 0.168, 0.009], [0.90, 0.206, 0.155, 0.012], [0.96, 0.195, 0.142, 0.014], [1.02, 0.184, 0.132, 0.015], [1.08, 0.165, 0.12, 0.016],
  [1.13, 0.138, 0.104, 0.016], [1.165, 0.103, 0.084, 0.016], [1.19, 0.058, 0.05, 0.016], [1.2, 0.001, 0.001, 0.016],
];
/** Where the gourd goes over from the body's weight to the head's (m, size 1). */
export const NAPE = { from: 0.76, to: 0.86 };
/** The mask: its centre's height, half width and height, thickness, how far it stands off the gourd, its tilt back. */
export const MASK = { y: 1.0, w: 0.094, h: 0.152, t: 0.034, off: 0.012, tilt: 0.16 };
const DUNE_SPEEDS = { walk: 0.55, jog: 1.6, sprint: 3.3 };
/**
 * The gourd kept upright as it walks and stands: the share of the clip's lean of the spine taken off in its loops (the
 * traveller's walk bows a short-legged gourd forward like a bow; its attacks keep theirs).
 */
export const GOURD_UP = 0.55;
export const UPRIGHT = new THREE.Quaternion();

/** The reference's own colours, on its home skin (the Desert's); the bleached twin keeps its own palette's. */
const OWN = {
  desert: { body: '#879d88', body2: '#6f866f', mask: '#f3e4ad', patch: '#c9806a', glove: '#c46c3c', glove2: '#d98f55', boot: '#bd6438', toe: '#dfb47c', band: '#2a2420', ink: '#17131f', eye: '#1b1a1f', bare: '#fbf6e8' },
};
/** A skin without its own colours: the roles from its palette (the bleached mummer: cream sack, sky patch, saffron gloves). */
const roles = (P) => ({ body: P.sack, body2: surfaceColor('sack*0.86', P), mask: P.wood, patch: P.patch, glove: P.patch2, glove2: surfaceColor('patch2+0.15', P), boot: P.rope, toe: P.rag, band: P.ink, ink: P.ink, eye: P.ink, bare: P.eye ?? '#fbf6e8' });
/** The gourd's surface (src/foe-surface.js): a broad, soft mottle; quiet, the reference is flat. */
const gourdPaint = (P) => ({ mottle: { color: P.body2, scale: 0.3, amount: 0.22, soft: 0.16, detail: 0.3, strength: 0.4 } });

/** A smooth surface through rings (bottom to top): GOURD's rows, each an ellipse, Catmull-Rom between them. */
export function gourdGeometry(rows = GOURD, seg = 32, sub = 3) {
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const R = [];
  for (let i = 0; i < rows.length - 1; i++) for (let s = 0; s < (i === rows.length - 2 ? sub + 1 : sub); s++) {
    const t = s / sub, a = rows[Math.max(0, i - 1)], b = rows[i], c = rows[i + 1], d = rows[Math.min(rows.length - 1, i + 2)];
    R.push([0, 1, 2, 3].map((k) => cr(a[k], b[k], c[k], d[k], t)));
  }
  const pos = [], idx = [];
  for (const [y, rx, rz, zc] of R) for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; pos.push(Math.sin(a) * Math.max(0.001, rx), y, zc + Math.cos(a) * Math.max(0.001, rz)); }
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** The gourd's front surface at height y (m, size 1): its z, by the rows. */
export function gourdFront(y, rows = GOURD) {
  for (let i = 0; i < rows.length - 1; i++) if (y <= rows[i + 1][0]) { const t = (y - rows[i][0]) / (rows[i + 1][0] - rows[i][0]); return lerp(rows[i][3] + rows[i][2], rows[i + 1][3] + rows[i + 1][2], t); }
  return 0;
}

/**
 * geo (in owner's frame, with skinIndex and skinWeight over `bones`) as one skinned mesh on those bones, its bounds and
 * each bone's box of the vertices it carries most (userData.boneBoxes: the body the blade meets, src/foe-body.js), as
 * kit.js skinned keeps them. Returns the mesh.
 */
export function skinWith(owner, geo, mat, bones) {
  owner.updateMatrixWorld(true);
  const sm = new THREE.SkinnedMesh(geo, mat);
  sm.name = 'skinned'; sm.frustumCulled = false;
  owner.add(sm); sm.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  const local = bones.map(() => new THREE.Box3()), pos = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let k = 0; for (let q = 1; q < 4; q++) if (SW.getComponent(i, q) > SW.getComponent(i, k)) k = q;
    const b = SI.getComponent(i, k);
    local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b]));
  }
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => {
    sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const L = local[i]; if (L.isEmpty()) return; b.updateWorldMatrix(true, false);
      for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? L.max.x : L.min.x, k & 2 ? L.max.y : L.min.y, k & 4 ? L.max.z : L.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box;
  };
  sm.userData.boneBoxes = { bones, local };
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  let sphereAt = -1;
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => {
    if (RENDER_FRAME.on && sphereAt === RENDER_FRAME.n) return sphere;
    sphereAt = RENDER_FRAME.on ? RENDER_FRAME.n : -1;
    return bounds().getBoundingSphere(sphere);
  }, set() {} });
  return sm;
}

/**
 * A broad mitten on its hand joint, hanging down it (as plans/mummer.js handParts lays a hand: the fingers across x,
 * curling forward in y–z): a padded palm, the four fingers one broad block in two segments on the fist's pivots
 * (src/enemies/wield.js Fist, #744: it closes round what it holds), a thumb. Returns the Fist.
 */
function mittenParts(hand, s, mat) {
  const r = 0.03, K0 = [0, -r * 2.4, r * 0.3], M0 = [0, K0[1] - r * 1.5, K0[2] + r * 0.25], E0 = [0, M0[1] - r * 1.1, M0[2] + r * 0.4];
  const { knuckles, tips } = fingerPivots(hand, K0, M0);
  const seg = (a, b, rr, wide) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
    return new THREE.CapsuleGeometry(rr, Math.max(0.001, l - rr), 3, 8).scale(wide, 1, 1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(...A.add(B).multiplyScalar(0.5).toArray()); };
  many(hand, [new THREE.SphereGeometry(r * 1.85, 10, 8).scale(1.05, 1.15, 0.8).translate(0, -r * 1.3, 0),
    new THREE.CapsuleGeometry(r * 0.62, r * 1.5, 3, 6).rotateZ(s * 0.75).translate(s * r * 1.75, -r * 1.7, r * 0.85)], mat);
  many(knuckles, [seg([0, 0, 0], [0, M0[1] - K0[1], M0[2] - K0[2]], r * 0.72, 2.5)], mat);
  many(tips, [seg([0, 0, 0], [0, E0[1] - M0[1], E0[2] - M0[2]], r * 0.66, 2.4)], mat);
  return new Fist(knuckles, tips, { K: [K0[1], K0[2]], M: [M0[1], M0[2]], E: [E0[1], E0[2]], finger: r * 0.7, haft: (rh) => [0, K0[1] - r * 0.3, r * 1.1 + rh * 0.92] });
}

/**
 * The mummer's life on a body (shared by the direct and the Tripo trial bodies, as plans/mummer.js mummerModel's anim):
 * the clips (driver), the weapon in hand and the one it dropped, the mask on or knocked flying, the rock it lobs, its
 * eyes' colour. o: { J, driver, wield, fists, gripAt (the right fist's haft point, its hand's frame: the bow's cord
 * drawn to it), held, lying, mask, flown, eyes, eyeM, P (eye, bare, flare, rock), skin, g }.
 */
export function mummerLife(o) {
  const { J, driver, wield, held, lying, mask, flown, eyes, eyeM, P, skin, g, cord } = o;
  const _w = new THREE.Vector3(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const maskFly = { t: -1, from: new THREE.Vector3(), at: new THREE.Vector3() };
  let draw = 0, dim = 0;
  return function anim(f, c) {
    const dt = Math.max(c.dt, 0), unmasked = !!f.unmasked;
    const want = driver.update(f, c, { pose: unmasked && f.state !== 'wind' && f.state !== 'strike' && (f.fleeT > 0 || f.stunned > 0) ? 'clutch' : null });
    const W = f.disarmed || unmasked ? null : f.weapon ?? 'club';
    for (const [k, node] of Object.entries(held)) node.scale.setScalar(k === W ? 1 : 1e-3);
    wield.update(f, want, c, held[W] ? W : null, { pinch: [W === 'bow' && draw > 0.05, false] });
    draw = drawOf(f, want, dt, 'volley', draw);
    drawCord(cord, W === 'bow' && draw > 0.001 ? J.hands[0].localToWorld(_w.copy(o.gripAt())) : null, draw);
    for (const node of Object.values(lying)) node.scale.setScalar(1e-3);
    const S = f.disarmed, lie = S ? lying[f.droppedWeapon ?? f.weapon ?? 'club'] : null;
    if (lie) {
      g.updateMatrixWorld(true);
      const fly = f.def.disarm?.fly ?? 0.5, u = Math.min(1, S.t / fly);
      _w.lerpVectors(S.from, S.at, u); _w.y += Math.sin(Math.PI * u) * 1.1 + (u >= 1 ? 0.03 : 0);
      g.worldToLocal(lie.position.copy(_w));
      _e.set(u < 1 ? S.t * 12 : Math.PI / 2, Math.atan2(S.at.x - S.from.x, S.at.z - S.from.z), 0, 'YXZ');
      lie.quaternion.copy(g.getWorldQuaternion(_q).invert().multiply(_q2.setFromEuler(_e)));
      lie.scale.setScalar(1 / (skin.scale ?? 1));
    }
    // the mask: on, or knocked flying (an arc, spinning, then lying face up on the sand); the black face under it
    mask.scale.setScalar(unmasked ? 1e-3 : 1);
    flown.scale.setScalar(1e-3);
    if (unmasked) {
      if (maskFly.t < 0) { maskFly.t = 0; mask.getWorldPosition(maskFly.from); maskFly.at.set(maskFly.from.x - Math.sin(f.heading) * 1.6 + 0.6, f.pos.y + 0.05, maskFly.from.z - Math.cos(f.heading) * 1.6); }
      maskFly.t += dt;
      const u = Math.min(1, maskFly.t / 0.7);
      _w.lerpVectors(maskFly.from, maskFly.at, u); _w.y += Math.sin(Math.PI * u) * 0.9;
      g.updateMatrixWorld(true);
      g.worldToLocal(flown.position.copy(_w));
      _e.set(u < 1 ? maskFly.t * 11 : -Math.PI / 2, f.heading, u < 1 ? maskFly.t * 5 : 0.4, 'YXZ');
      flown.quaternion.copy(g.getWorldQuaternion(_q).invert().multiply(_q2.setFromEuler(_e)));
      flown.scale.setScalar(1 / (skin.scale ?? 1));
    } else maskFly.t = -1;
    if (f.atk?.id === 'rock' && f.state === 'wind' && f.k > 0.78) c.lob(f, (f.k - 0.78) / 0.22, P.rock); else c.lob(f, -1, P.rock);
    // its eyes: the mask's black slits (the wind-up's colour in them); unmasked small pale eyes on its black face
    dim = ease(dim, unmasked ? 1 : 0, 6, dt || 1);
    eyes.scale.setScalar(1 - 0.4 * dim); eyes.position.z = -o.eyeBack * dim;
    eyeM.uniforms.uColor.value.set(eyeColor(f, unmasked ? P.bare : P.eye, P.flare ?? '#ffcf6a'));
    eyeM.uniforms.uGlow.value = 0.9 - 0.4 * dim;
    return want;
  };
}

/** The weapons on their grips and on the ground, the flown mask (pivots), built into `mat` (part tints: `tint`). */
export function mummerProps(g, grip, gripL, P, tint, mat) {
  const build = (node, parts) => { for (const [k, geos] of Object.entries(parts)) if (geos.length) many(node, geos, tint(mat, { wood: P.wood, rope: P.rope, iron: P.iron, rag: P.patch }[k])); };
  const club = pivot(grip, 0, 0, 0, 'club'), spear = pivot(grip, 0, 0, 0, 'spear'), bow = pivot(gripL, 0, 0, 0, 'bow');
  build(club, clubParts()); build(spear, spearParts()); build(bow, bowParts(0.36, false));
  const cord = bowCord(bow, 0.36, tint(mat, P.rope));
  const dropped = pivot(g, 0, 0, 0, 'dropped weapon');
  const dClub = pivot(dropped, 0, 0, 0, 'dropped club'), dSpear = pivot(dropped, 0, 0, 0, 'dropped spear'), dBow = pivot(dropped, 0, 0, 0, 'dropped bow');
  build(dClub, clubParts()); build(dSpear, spearParts()); build(dBow, bowParts());
  return { held: { club, spear, bow }, lying: { club: dClub, spear: dSpear, bow: dBow }, cord };
}
/** The mask's oval (its front +z, at the origin): a smooth cream plate, rounded at its rim, the top leaning back. */
export const maskGeometry = (m = MASK) => new THREE.SphereGeometry(1, 20, 12).scale(m.w, m.h, m.t).rotateX(-m.tilt);

export function duneMummerModel(skin) {
  const P = { ...skin.palette, ...roles(skin.palette), ...(OWN[skin.id] ?? {}) }, M = materials('mummer', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · dune mummer (direct)`;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, DUNE_BODY), D = DUNE_BODY;
  // (every part but the gourd and the eyes in one material, each its own colour as a vertex tint: build materials by colour)
  const limbM = M.mat('dmLimb', '#ffffff', { vertexColors: true });
  const builds = new Map(), tint = (_, hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`dmB${hex}`, hex)); return builds.get(hex); };
  const bodyM = M.mat('dmGourd', P.body, { foeSurface: gourdPaint(P) });
  const eyeM = M.own('eye', P.eye, { glow: 0.9 });
  const T = J.torso, H = J.head;
  const hipY = D.hip, headY = D.hip + D.chest + D.neck;
  // the salmon patch on the chest, under the mask: a thin plate laid on the gourd's front (on the torso)
  {
    const pw = 0.118, ph = 0.064, py = 0.72, geo = new THREE.PlaneGeometry(pw * 2, ph * 2, 8, 4), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + py, rx = 0.25, zf = gourdFront(y); p.setXYZ(i, x, y - hipY, Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * zf + 0.004); }
    geo.computeVertexNormals();
    add(T, geo, tint(0, P.patch));
  }
  // the mask high on the front (on the head: it turns with the look), the black face under it, the slits on it
  const zf = gourdFront(MASK.y);
  const face = pivot(H, 0, MASK.y - headY, zf, 'face');
  add(face, new THREE.SphereGeometry(1, 16, 10).scale(MASK.w * 0.92, MASK.h * 0.92, 0.012).rotateX(-MASK.tilt), tint(0, P.ink), 0, 0, -0.004);
  const mask = pivot(face, 0, 0, MASK.off + MASK.t * 0.5, 'mask');
  add(mask, maskGeometry(), tint(0, P.mask));
  // (the slits on the mask's front: its face at their height, tipped back with it, a hair proud of it)
  const ey = 0.022, ez = MASK.off + MASK.t * 0.5 + MASK.t * Math.sqrt(Math.max(0, 1 - (ey / MASK.h) ** 2)) / Math.cos(MASK.tilt) - Math.tan(MASK.tilt) * ey;
  const eyes = pivot(face, 0, 0, 0, 'eyes');   // (its own place is the life's: eased back onto the black face unmasked)
  add(eyes, merged([-1, 1].map((s) => new THREE.CapsuleGeometry(0.0095, 0.04, 3, 8).rotateZ(Math.PI / 2).scale(1, 1, 0.45).rotateX(-MASK.tilt).translate(s * 0.046, ey, ez + 0.002))), eyeM);
  const flown = pivot(g, 0, 0, 0, 'dropped mask');
  add(flown, maskGeometry(), tint(0, P.mask));
  // the arms: a short sage sleeve, a big padded rust gauntlet with a dark band at the wrist, a broad mitten
  const fists = [null, null];
  J.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    many(arm, [new THREE.SphereGeometry(0.078, 10, 8), new THREE.CylinderGeometry(0.068, 0.078, D.upper, 10, 1).translate(0, -D.upper / 2, 0)], tint(0, P.body));
    many(J.elbows[i], [new THREE.CylinderGeometry(0.084, 0.07, 0.05, 12, 1).translate(0, 0.0, 0), new THREE.SphereGeometry(1, 12, 10).scale(0.088, D.fore * 0.6, 0.086).translate(0, -D.fore * 0.5, 0),
      new THREE.CylinderGeometry(0.08, 0.088, D.fore * 0.55, 12, 1).translate(0, -D.fore * 0.45, 0)], tint(0, P.glove));
    many(J.elbows[i], [new THREE.TorusGeometry(0.073, 0.012, 5, 16).rotateX(Math.PI / 2).translate(0, -D.fore + 0.012, 0)], tint(0, P.band));
    fists[i] = mittenParts(J.hands[i], s, tint(0, P.glove2));
  });
  // the legs: sage under the gourd, tall rust boots over the knee (a fold round them), a broad foot with a sand toe cap
  J.legs.forEach((leg, i) => {
    many(leg, [new THREE.CylinderGeometry(0.07, 0.074, D.thigh, 10, 1).translate(0, -D.thigh / 2, 0)], tint(0, P.body));
    many(leg, [new THREE.CylinderGeometry(0.082, 0.08, 0.06, 12, 1).translate(0, -D.thigh + 0.01, 0)], tint(0, P.boot));
    many(J.knees[i], [new THREE.CylinderGeometry(0.08, 0.078, D.shin, 12, 1).translate(0, -D.shin / 2, 0), new THREE.TorusGeometry(0.079, 0.011, 5, 16).rotateX(Math.PI / 2).translate(0, -D.shin * 0.62, 0)], tint(0, P.boot));
    many(J.knees[i], [new THREE.TorusGeometry(0.08, 0.006, 4, 16).rotateX(Math.PI / 2).translate(0, -D.shin * 0.62 - 0.012, 0)], tint(0, P.band));
    const ankle = D.hip - D.thigh - D.shin;
    const shoe = new THREE.SphereGeometry(1, 14, 8).scale(0.078, 0.06, 0.13), p = shoe.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < 0) p.setY(k, p.getY(k) * 0.25);
    many(J.feet[i], [shoe.translate(0, -ankle + 0.035, 0.035), new THREE.CylinderGeometry(0.076, 0.08, ankle, 12, 1).translate(0, -ankle / 2 + 0.01, -0.005)], tint(0, P.boot));
    many(J.feet[i], [new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.07, 0.05, 0.06).translate(0, -ankle + 0.02, 0.105)], tint(0, P.toe));
  });
  // the weapons: a grip in the right mitten (club, spear), the bow in the left; the dropped ones on the root
  const grip = pivot(J.hands[0], 0, -0.045, 0.01, 'grip'), gripL = pivot(J.hands[1], 0, -0.045, 0.01, 'grip l');
  const { held, lying, cord } = mummerProps(g, grip, gripL, P, tint, limbM);
  // (its stance over the clip's: the arms held off the wide gourd, the feet a little apart)
  const style = (_, want) => { if (want?.loop) J.torso.quaternion.slerp(UPRIGHT, GOURD_UP); J.arms[0].rotateZ(-0.42); J.arms[1].rotateZ(0.42); J.elbows[0].rotateZ(0.12); J.elbows[1].rotateZ(-0.12); J.legs[0].rotateZ(-0.05); J.legs[1].rotateZ(0.05); };
  const driver = new HumanoidDriver(J, rig, { moves: MUMMER_MOVES, speeds: DUNE_SPEEDS, style, seat: 0.2 });
  const wield = new Wielder(J, driver, { fists, grips: [grip, gripL], weapons: MUMMER_HOLD });
  // the look: the head turns to the traveller (the mask and the gourd's top with it)
  const gaze = [gazePart(g, H, { mode: 'turn', yaw: 0.7, up: 0.35, down: 0.4 })], look = gaze[0].node ?? H.children.find((x) => x.name === 'gaze') ?? H;
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  // the gourd: one skinned mesh, the body's below NAPE.from, the head's (its look) over NAPE.to, blended between
  const geo = gourdGeometry(), gp = geo.attributes.position, n = gp.count, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const w = THREE.MathUtils.smoothstep(gp.getY(i), NAPE.from, NAPE.to); SI[i * 4] = 0; SI[i * 4 + 1] = 1; SW[i * 4] = 1 - w; SW[i * 4 + 1] = w; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  const gourd = skinWith(g, geo, bodyM, [T, look]); gourd.name = 'gourd';
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [T, H, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  const anim = mummerLife({ J, driver, wield, fists, held, lying, mask, flown, eyes, eyeM, P, skin, g, cord, eyeBack: MASK.off + MASK.t * 1.4, gripAt: () => fists[0].fit(0.006).at });
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.body, P.mask, P.glove],
    driver, joints: J, wield, fists, trial: 'direct',
    tell: (id) => (id === 'volley' ? gripL : id === 'rock' ? J.hands[0] : grip),
    anim,
    dispose: M.dispose,
  };
}
