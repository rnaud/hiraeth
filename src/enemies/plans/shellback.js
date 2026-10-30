import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tubeGeometry, merged, skinBy, pivot, pair, ease, eyeColor, finish, V, plate, shellPlate, shade } from './kit.js';
import { surfaceColor } from '../surfaces.js';
import { gazePart } from '../gaze.js';

// The shellback, built direct (issue #800 phase 2a: a trial body, not in the game's roster until the author picks it;
// the game's crab is plans/walker.js crabModel). Drawn to the approved reference
// (references/enemy-redesign-2026-10-30/shellback/e8102be7-…-2.png): a tall ochre dome with a thin lip over a pale
// face of two slit eyes and a short mouth, a fat green collar rolled under the face, six thick cream legs with round
// knees coming out from under the lip onto broad red feet, and two big red pincers hanging in front, one either side
// of the face. Broad masses and few flat colours (the Scavengers Reign brief); from afar an ochre dome on red feet.
//
// It is the crab in everything but its body: the same archetype id, kind, skins, def (attacks, reach, windows, guard,
// shell, hp), sounds (FOE_MOVES 'walker', FOE_CALLS 'shell'), death recipe and lying body; on the same rig family
// (the motion kit's walker plan, an alternating tripod). The snap: the near pincer rears up and forward, its finger
// opening, then chops down shut; the spin: claws folded over the face, legs drawn under, the dome tilted up and rocking;
// the burrow: it sinks to its eyes. Guarded it clamps down, claws over its face.
//
// Draws: every limb, the face and the collar one skinned mesh on the kit's joints (kit.js skinBy, its own colours as
// vertex tints), the dome one mesh, its two armour scutes their own (they fall: Foes.dropPlate), the eyes one: 5, where
// the crab is 67 meshes. A skin's dress (antennae, barnacles, a rope, coral, facets, an awning) is merged a material.

/** Its numbers (m, at scale 1): the crown over the ground; the dome's radius (its depth ahead × DEEP); the body's pivot. */
export const SHELLBACK = { height: 1.55, dome: 0.88, deep: 1.06, bodyY: 0.64, legR: 0.12 };
const R = SHELLBACK.dome, DEEP = SHELLBACK.deep;
const RIM = 0.24, CROWN = SHELLBACK.height - SHELLBACK.bodyY;   // (the lip's top and the crown over the body's pivot)
/** The dome's profile, rim to crown: steep shoulders, a broad rounded top (the reference's half egg). */
const DOME = Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * Math.PI / 2; return new THREE.Vector2(Math.max(0.001, R * Math.pow(Math.cos(t), 0.8)), RIM + (CROWN - RIM) * Math.sin(t)); });
/** The lip: a short skirt turned out under the rim (its own darker band: vertex colour). */
const LIP = [[R * 0.86, RIM - 0.07], [R * 1.0, RIM - 0.06], [R * 1.035, RIM - 0.02], [R * 1.02, RIM + 0.015]];

/** The reference's own colours, on its home skin (the cliff crab's world, Vael II); the other skins keep their world's. */
const OWN = {
  arzach2: { shell: '#df9f45', shell2: '#e9b45f', under: '#f1e2ae', leg: '#f1e2ae', joint: '#e7d39a', claw: '#c75f3a', tip: '#c75f3a', collar: '#6f9d72', dark: '#3a2c22', eye: '#1e1d24', accent: '#f4e7bf' },
};
/** Each part's surface (src/foe-surface.js): broad and quiet, a soft mottle on the dome, fine specks on the legs. */
const PAINT = {
  dome: { mottle: { color: 'shell2', scale: 0.22, amount: 0.3, soft: 0.14, detail: 0.4, strength: 0.45 } },
  limb: { spots2: { color: 'dark', scale: 0.05, share: 0.25, size: 0.4, amount: 0.25 } },
};
const paint = (name, P) => Object.fromEntries(Object.entries(PAINT[name]).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x === 'string' ? surfaceColor(x, P) : x]))]));

/**
 * A pincer's finger: a smooth teardrop `len` long hanging down from its root (−y), `w` wide and `d` deep at its widest,
 * bowed forward by `bow` and sideways by `lean` at its middle, to a point.
 */
function blade(len, w, d, bow, lean) {
  // (tip first, root last: y rising, so the lathe's faces look out)
  const prof = Array.from({ length: 11 }, (_, i) => { const t = 1 - i / 10; return new THREE.Vector2(Math.max(0.004, Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.95)) ** 0.8 * (1 - t * 0.85)), -t * len); });
  const g = new THREE.LatheGeometry(prof, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = -p.getY(i) / len, k = Math.sin(Math.PI * t); p.setXYZ(i, p.getX(i) * w + lean * k, p.getY(i), p.getZ(i) * d + bow * k); }
  g.computeVertexNormals();
  return g;
}

export function shellbackModel(skin) {
  const P = { ...skin.palette, ...(OWN[skin.id] ?? {}) }, props = new Set(skin.props), M = materials('crab', skin);
  P.collar ??= P.joint; P.foot ??= P.tip ?? P.claw;
  const g = new THREE.Group(), body = pivot(g, 0, SHELLBACK.bodyY, 0, 'shell'); g.name = `${skin.name} · shellback (direct)`;
  // the materials it is built in; the skinned mesh wears `limbM`, each part's own colour a vertex tint over it
  const creamB = M.mat('sbCream', P.leg), kneeB = M.mat('sbKnee', P.joint), redB = M.mat('sbRed', P.claw), footB = M.mat('sbFoot', P.foot), collarB = M.mat('sbCollar', P.collar), inkB = M.mat('sbInk', P.dark, { flat: true });
  const limbM = M.mat('sbLimb', P.leg, { vertexColors: true, foeSurface: paint('limb', P) });
  const domeM = M.mat('sbDome', P.shell, { vertexColors: true, foeSurface: paint('dome', P) });
  const eyeM = M.own('eye', P.eye, { glow: 0.35 });
  // ---------------------------------------------------------------- the dome and its lip (one mesh: the lip's band a vertex colour)
  const dome = new THREE.LatheGeometry(DOME, 30), lip = new THREE.LatheGeometry(LIP.map(([r, y]) => new THREE.Vector2(r, y)), 30);
  // (a vertex tint: the part's colour over the material's, as kit.js skinned does)
  const base = new THREE.Color(P.shell);
  const tint = (geo, hex) => { const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r / Math.max(base.r, 1e-3); a[i * 3 + 1] = c.g / Math.max(base.g, 1e-3); a[i * 3 + 2] = c.b / Math.max(base.b, 1e-3); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return geo; };
  const domeGeo = mergeGeometries([tint(dome, P.shell), tint(lip, shade(P.shell, 0.78))], false);
  dome.dispose(); lip.dispose();
  domeGeo.scale(1, 1, DEEP);
  const shell = add(body, domeGeo, domeM); shell.name = 'dome';
  // a point on the dome (x, z in the body's frame) and where the dress sits on it
  const domeAt = (x, z) => { const rho = Math.min(1, Math.hypot(x / R, z / (R * DEEP))); const t = Math.acos(Math.min(1, Math.pow(rho, 1 / 0.8))); return RIM + (CROWN - RIM) * Math.sin(t); };
  const sit = (geo, x, z, lift = 0) => { const y = domeAt(x, z) + lift, n = V(x / R, Math.max(0.35, (y - RIM) / (CROWN - RIM)) * 1.2, z / (R * DEEP)).normalize(); return geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n)).translate(x, y, z); };
  // its armour (issue #722, src/enemies/fight.js ARMOUR): two scutes over the front of the dome, darker than it
  // (the dome's own paint, a shade darker: not the riveted plate surface of the crab's, which the reference has none of)
  const plateM = M.mat('sbPlate', P.plate ?? shade(P.shell, 0.9), { side: THREE.DoubleSide, foeSurface: paint('dome', P) });
  const scute = DOME.slice(1, 9).map((v) => [v.x, v.y + 0.012]);
  const plates = [1, -1].map((s) => plate(body, shellPlate(scute, s > 0 ? 0.12 : -1.6, 1.48, { out: 0.008, thick: 0.035, segs: 10, depth: DEEP }), plateM, 0, 0, 0, `scute ${s > 0 ? 'left' : 'right'}`));
  // what is under the dome (a bomb cracks it off: the soft back shows)
  const meat = add(body, new THREE.SphereGeometry(0.66, 12, 6).scale(1, 0.34, 0.8), M.mat('meat', '#e08a70'), 0, 0.12, 0); meat.visible = false;
  // ---------------------------------------------------------------- the body under the dome: belly, face, collar
  add(body, new THREE.SphereGeometry(1, 16, 10).scale(R * 0.8, 0.3, R * 0.86), creamB, 0, 0.05, 0);
  // (forward of the lip and a little under it, as drawn: the face peers out from under the dome)
  const face = pivot(body, 0, 0.03, R * DEEP * 0.84, 'face');
  add(face, new THREE.SphereGeometry(1, 18, 12).scale(0.36, 0.2, 0.22), creamB, 0, 0, 0);
  // the eyes: two upright slits on the face's front (its own material: they go orange as it winds up); the mouth a dash
  const eyes = add(face, merged(pair((s) => new THREE.CapsuleGeometry(0.022, 0.06, 3, 8).scale(1, 1, 0.4).translate(s * 0.105, 0.04, 0.205))), eyeM);
  add(face, new THREE.CapsuleGeometry(0.008, 0.045, 2, 6).rotateZ(Math.PI / 2).translate(0, -0.02, 0.215), inkB);
  // the collar: a fat green roll under the face, round the front between the claws
  const collar = Array.from({ length: 9 }, (_, i) => { const a = (-1 + i / 4) * 1.05; return [Math.sin(a) * R * 0.68, -0.13 + Math.abs(Math.sin(a)) * 0.03, Math.cos(a) * R * 0.8 * DEEP]; });
  add(body, tubeGeometry(collar, 0.1, 0.1), collarB);
  // ---------------------------------------------------------------- the claws: hanging in front, one either side of the face
  const claws = pair((s) => {
    // (out from under the lip, up to its edge and forward of the face: the pincers stand clear in front, as drawn)
    const shoulder = pivot(body, s * 0.38, 0.0, R * DEEP * 0.6, 'shoulder');
    add(shoulder, new THREE.SphereGeometry(0.09, 10, 8), kneeB);
    add(shoulder, tubeGeometry([[0, 0, 0], [s * 0.07, 0.14, 0.26], [s * 0.12, 0.24, 0.5]], 0.08, 0.075), creamB);
    const hand = pivot(shoulder, s * 0.12, 0.24, 0.5, 'claw');
    add(hand, new THREE.SphereGeometry(0.1, 10, 8), kneeB);
    // the fixed finger: a broad red blade curving down and forward to a point; the moving one hinged behind it
    add(hand, blade(0.68, 0.15, 0.1, 0.12, s * 0.03), redB);
    const finger = pivot(hand, 0, -0.05, -0.07, 'finger');
    add(finger, blade(0.44, 0.085, 0.06, -0.06, -s * 0.02), redB);
    const tip = pivot(hand, 0, -0.64, 0.02);
    return { shoulder, hand, finger, tip };
  });
  // ---------------------------------------------------------------- six thick legs on the kit, onto broad red feet
  const legs = [];
  for (const s of [-1, 1]) for (const [k, z] of [0.34, 0.0, -0.34].entries()) {
    const fz = z * 1.9 + (k === 0 ? 0.1 : 0.02), fx = s * (k === 0 ? 1.18 : 1.3);
    const leg = planLeg(PLANS.walker, { group: g, body, hip: { x: s * 0.5, y: -0.06, z: z * DEEP }, foot: { x: fx, z: fz }, pole: { x: s * 1.5, y: 1.0, z: z * 0.7 }, radius: SHELLBACK.legR, taper: 0.45, ankle: 0.1,
      mats: { joint: kneeB, thigh: creamB, shin: creamB, foot: footB }, name: `shellback leg ${legs.length}` });
    // (the broad foot: a red slipper pointing out from the body, its sole flat on the ground)
    for (const c of leg.foot.children.slice()) { c.removeFromParent(); c.geometry.dispose(); }
    const shoe = new THREE.SphereGeometry(1, 14, 8).scale(0.25, 0.09, 0.15);
    const p = shoe.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.02) p.setY(i, -0.02 + (p.getY(i) + 0.02) * 0.15);
    shoe.translate(0.07, 0.07, 0).rotateY(Math.atan2(-fz, fx));
    add(leg.foot, shoe, footB);
    legs.push(leg);
  }
  // ---------------------------------------------------------------- a skin's dress (merged a material; hidden when the dome cracks)
  const dress = pivot(body, 0, 0, 0, 'dress');
  const kit = new Map(), put = (mat, geo) => { if (!kit.has(mat)) kit.set(mat, []); kit.get(mat).push(geo); };
  const accentM = M.mat('sbAccent', P.accent, { flat: true }), dressInk = M.mat('sbDressInk', P.dark, { flat: true });
  if (props.has('antennae')) for (const s of [-1, 1]) put(dressInk, tubeGeometry([[s * 0.1, 0.05, R * DEEP * 0.9], [s * 0.3, 0.4, 1.2], [s * 0.55, 0.62, 1.42], [s * 0.75, 0.6, 1.58]], 0.016));
  if (props.has('patina')) for (let i = 0; i < 7; i++) { const a = i * 2.1, r = 0.25 + (i % 3) * 0.16; put(accentM, sit(new THREE.SphereGeometry(0.12, 7, 4).scale(1, 1, 0.25), Math.sin(a) * r, Math.cos(a) * r * 0.9)); }
  if (props.has('barnacles')) for (let i = 0; i < 5; i++) { const a = i * 2.4 + 0.3, r = R * (0.2 + i * 0.13);
    for (let k = 0; k < 6; k++) { const b = a + (k % 3) * 0.13, rr = r + (k > 2 ? 0.08 : 0); put(accentM, sit(new THREE.CylinderGeometry(0.03, 0.055, 0.05, 7).rotateX(Math.PI / 2).translate(0, 0, 0.02).scale(...Array(3).fill(0.8 + ((i + k) % 3) * 0.25)), Math.sin(b) * rr, Math.cos(b) * rr * DEEP)); } }
  if (props.has('rope')) {
    const ropeM = M.mat('sbRope', P.rope ?? P.dark), ironM = M.mat('sbIron', P.iron ?? P.dark);
    put(ropeM, tubeGeometry([[-0.3, domeAt(-0.3, 0.55), 0.55], [0.05, domeAt(0.05, 0.3) + 0.02, 0.3], [0.35, domeAt(0.35, 0.05) + 0.03, 0.05], [0.66, domeAt(0.66, -0.2) + 0.02, -0.2], [0.86, RIM - 0.02, -0.3]], 0.028));
    put(ropeM, new THREE.TorusKnotGeometry(0.15, 0.026, 56, 6, 2, 5).rotateX(-1.2).rotateZ(0.5).translate(0.4, domeAt(0.4, -0.05) + 0.06, -0.05));
    const at = new THREE.Matrix4().compose(V(0.92, RIM - 0.05, -0.34), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.4, -0.35)), V(1, 1, 1));
    for (const a of [new THREE.TorusGeometry(0.035, 0.012, 5, 10).translate(0, 0.02, 0), new THREE.CylinderGeometry(0.018, 0.018, 0.35, 6).translate(0, -0.185, 0), new THREE.CylinderGeometry(0.014, 0.014, 0.16, 5).rotateZ(Math.PI / 2).translate(0, -0.07, 0), new THREE.TorusGeometry(0.11, 0.016, 5, 12, Math.PI).rotateZ(Math.PI).translate(0, -0.26, 0)]) put(ironM, a.applyMatrix4(at));
  }
  if (props.has('coral')) for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.26, z = i % 2 ? -0.15 : 0.12, y = domeAt(x, z) - 0.02;
    put(accentM, tubeGeometry([[x, y, z], [x * 1.1, y + 0.26, z], [x * 1.25 + 0.05, y + 0.43, z - 0.04]], 0.035, 0.018)); put(accentM, tubeGeometry([[x * 1.05, y + 0.18, z], [x * 1.05 + 0.13, y + 0.32, z + 0.05]], 0.022, 0.012)); }
  if (props.has('facets')) for (let i = 0; i < 5; i++) { const a = i * 1.26, x = Math.sin(a) * 0.36, z = Math.cos(a) * 0.3; put(accentM, new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.8, 1).translate(x, domeAt(x, z) - 0.02, z)); }
  let awning = null;
  if (props.has('awning')) {
    awning = pivot(dress, 0, CROWN - 0.12, -0.05, 'awning');
    const clothA = M.mat('sbCloth', P.cloth ?? P.accent, { side: THREE.DoubleSide }), clothB = M.mat('sbCloth2', P.cloth2 ?? P.claw, { side: THREE.DoubleSide });
    const poles = [], A = [], B = [];
    for (const [x, z] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.55], [0.6, -0.55]]) poles.push(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 6).translate(x, 0.0, z));
    for (let i = 0; i < 4; i++) (i % 2 ? A : B).push(new THREE.PlaneGeometry(0.36, 1.3).rotateX(-Math.PI / 2).translate(-0.48 + i * 0.32, 0.32 + Math.sin(i * 1.3) * 0.03, -0.02));
    for (const s of [-1, 1]) (s > 0 ? B : A).push(new THREE.PlaneGeometry(1.32, 0.2).rotateX(s * 0.25).translate(0, 0.22, s * 0.66));
    add(awning, merged(poles), dressInk); add(awning, merged(A), clothA); add(awning, merged(B), clothB);
  }
  for (const [mat, geos] of kit) add(dress, merged(geos), mat);
  // ---------------------------------------------------------------- its look at you, the rig, one skinned mesh
  const gaze = [gazePart(g, face, { mode: 'turn', yaw: 0.45, up: 0.2, down: 0.25 })];
  const rig = new Rig({ plan: PLANS.walker, group: g, body, legs });
  const shellTop = pivot(body, 0, CROWN + 0.05, 0);   // (the spin's glow rides on the dome)
  skinBy(g, [{ from: [creamB, kneeB, redB, footB, collarB, inkB], into: limbM }]);
  finish(g);
  const parts = [shell, ...plates, face, ...claws.map((c) => c.shoulder), dress, ...legs.map((l) => l.root)];
  let side = 0, sink = 0, spin = 0, flip = 0, clampK = 0;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.leg, P.claw], gaze, plates,
    trial: 'direct',
    tell: (id) => (id === 'snap' ? claws[1].tip : id === 'burrow' ? eyes : shellTop),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // (going down, issue #767: on its belly; one already on its back stays there)
      const flipped = f.dying ? (f.dying.onBack ??= flip > Math.PI / 2) : f.flipped > 0;
      // (its guard, issue #661: clamped down in its dome, legs drawn under, the pincers folded over its face)
      clampK = ease(clampK, f.guardK ?? 0, 12, dt);
      const tuck = Math.max(id === 'spin' ? (wind ? c.wind : strike ? 1 : 0) : 0, clampK);
      // sideways: it scuttles side-on in bursts, turns to face you to strike
      const scuttle = c.moving && f.state === 'chase' && f.dist > 3 ? 1 : 0;
      side = ease(side, scuttle * (f.home.x > 0 ? 1 : -1) * Math.PI / 2, 7, dt);
      g.rotation.y = f.heading + side;
      const buried = id === 'burrow' && wind ? c.wind : 0;
      sink = ease(sink, buried, buried > sink ? 6 : 10, dt);
      const o = rig.update({ pos: f.pos, heading: f.heading + side, state: f.state, k: f.k, atk: f.atk, stunned: f.stunned }, dt,
        { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: flipped ? 1 : tuck > 0.02 ? 1 + tuck : sink > 0.05 ? 1 + sink * 0.6 : 0 });
      legs.forEach((l, k) => { l.air.set(0, flipped ? Math.sin(c.now / 60 + k) * 0.2 : 0, flipped ? Math.cos(c.now / 75 + k) * 0.14 : 0); });
      // the snap: the near (right) pincer rears up and forward, its finger opening wide; then it chops down, shut
      const snap = id === 'snap' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      const chop = strike && id === 'snap' ? Math.sin(Math.min(1, c.release) * Math.PI) : 0;
      const limp = f.dying ? THREE.MathUtils.smoothstep(f.dying.u, 0.05, 0.45) : 0;
      claws.forEach((cl, i) => {
        const near = i === 1 ? snap : snap * 0.25, s = i ? 1 : -1;
        // (tucked: the claws folded in and up over the face; going down, laid forward on the ground)
        cl.shoulder.rotation.set(-near * 1.25 + chop * 0.4 - tuck * 0.35 + limp * 0.5, -s * tuck * 0.5, s * tuck * 0.25);
        cl.hand.rotation.set(-near * 0.45 + chop * 0.5 + tuck * 0.9 - limp * 0.4, 0, -s * tuck * 0.3);
        const open = near * 0.9 * (1 - chop) + (f.state === 'idle' ? Math.max(0, Math.sin(c.now / 420 + i * 2)) * 0.18 : 0);
        cl.finger.rotation.x = open;
      });
      // the spin: tucked, rocking, then turning as a top
      const rock = id === 'spin' && wind ? Math.sin(c.now / 70) * 0.08 * c.wind : 0;
      spin += dt * (strike && id === 'spin' ? 26 : tuck > 0 ? tuck * 4 : 0);
      flip = ease(flip, flipped ? Math.PI : 0, 12, dt);
      body.position.set(o.x, SHELLBACK.bodyY - tuck * 0.24 - clampK * 0.12 - sink * 0.55 + o.y, o.z);
      body.rotation.set(o.pitch - (id === 'spin' && wind ? 0.3 * c.wind : 0) + rock, tuck > 0.5 && strike ? spin : o.yaw, flip + o.roll);
      if (awning) awning.rotation.z = Math.sin(c.now / 260) * 0.03 * (c.moving ? 1 : 0.3);
      rig.write();
      // cracked: the dress and the dome come off, the soft back shows
      dress.visible = f.shelled; shell.visible = f.shelled; meat.visible = !f.shelled;
      for (const x of plates) if (!f.shelled) x.visible = false;
      if ((tuck > 0.5 && strike) || (buried > 0.3 && Math.random() < 0.5)) c.dust(f.pos, P.under, 2);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}
