import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tubeGeometry, merged, skinBy, pivot, pair, lerp, ease, eyeColor, finish, V, shade } from './kit.js';
import { surfaceFor, surfaceColor } from '../surfaces.js';
import { gazePart } from '../gaze.js';

// The broad-pawed hound, built direct (issue #800 phase 2b: a trial body, not in the game's roster until the author
// picks it; the game's hound is plans/quadruped.js houndModel). Drawn to the approved reference
// (references/enemy-redesign-2026-10-30/hound/5d7b275f-…-1.png): a long, deep-chested hound in one dark teal-black,
// a mauve saddle on its withers, four thick legs on big round paws (three toes showing), a long tail sweeping back and
// curling up, the head held high on a strong neck: pointed ears, a blunt cream muzzle, two pale slit eyes and two cream
// ram's horns curled round beside the head. No mane, no stick legs (the brief rejects both). Broad masses, few flat
// colours; from afar a dark hound on big paws with two pale crescents at its head.
//
// It is the hound in everything but its body: the same archetype id, kind, skins, def (pounce, step behind, bite,
// rake; reach, windows, `phase`), sounds (FOE_MOVES 'quadruped', FOE_CALLS 'smoke'), death recipe and lying body; on the
// same rig family (the motion kit's quadruped plan, a trot on diagonal pairs). Its shadow form is kept: lying in wait,
// stepping behind you and phased, it is a ragged pool with its head and horns rising out of it.
// The pounce: a crouch, the head down, the horns dipped forward, then the coil (rump up, tail stiff and quivering, the
// jaw open in a snarl, a shiver) and the leap. The rake: head low and to one side, the horns lowered like a plough.
//
// Draws: the body, legs, paws, neck, head and tail one skinned mesh in the dark (its parts' own shades as vertex
// tints), the horns, muzzle, jaw and saddle one in the light, the eyes their own: 3 while it stands (the pool's
// pieces only while it is a shadow), where today's hound is 54 meshes.

/** Its numbers (m, at scale 1): the torso's pivot over the ground, its legs, and the top of its horns (the Tripo body is scaled to it). */
export const HOUND = { hipY: 0.92, legR: 0.085, height: 1.62 };

/** The reference's own colours, on its home skin (the Eclipse's night hound); the other skins keep their world's. */
const OWN = {
  eclipse: { ink: '#1f2d31', rim: '#2b3a3e', antler: '#efe2bf', muzzle: '#efe2bf', patch: '#8e7d90', eye: '#f2e8c8' },
};
/** Each part's surface (src/foe-surface.js) on the home skin: a soft mottle on the coat, a fine grain on the horns. */
const PAINT = {
  coat: { mottle: { color: 'rim', scale: 0.22, amount: 0.35, soft: 0.18, detail: 0.4, strength: 0.5 } },
  horn: { grain: { color: 'antler*0.86', spacing: 0.03, ink: 0.25, warp: 0.6, amount: 0.35 } },
};
const paint = (name, P) => Object.fromEntries(Object.entries(PAINT[name]).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x === 'string' ? surfaceColor(x, P) : x]))]));
/** A world's own surface for a part (the current hound's, surfaces.js), as foeSurface (its makeMaterial extras dropped). */
const worldPaint = (skin, name) => { const s = surfaceFor('hound', skin, name); if (!s) return null; const { mat, ...fs } = s; return Object.keys(fs).length ? fs : null; };

/**
 * A body lofted through cross-sections along z: each [z, half-width, top y, bottom y] a squared-off ellipse (the
 * reference's side view gives the top and bottom lines), closed at both ends; one geometry.
 */
function loft(sections, radial = 16, square = 0.82) {
  const pos = [], idx = [], n = sections.length;
  for (const [z, w, top, bot] of sections) {
    const cy = (top + bot) / 2, ry = (top - bot) / 2;
    for (let k = 0; k < radial; k++) { const a = (k / radial) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a); pos.push(Math.sign(s) * Math.abs(s) ** square * w, cy + Math.sign(c) * Math.abs(c) ** square * ry, z); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) { const a = i * radial + k, b = i * radial + ((k + 1) % radial), c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
  for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const [z, , top, bot] = sections[i], ci = pos.length / 3;
    pos.push(0, (top + bot) / 2, z);
    for (let k = 0; k < radial; k++) { const a = i * radial + k, b = i * radial + ((k + 1) % radial); idx.push(...(flip ? [ci, a, b] : [ci, b, a])); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
/** The triangles of `geo` whose centre `inside(x, y, z)` takes, pushed out along their normals by `out` (a patch lying on it). */
function patchOf(geo, inside, out = 0.012) {
  const g = geo.toNonIndexed(); g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, pos = [];
  for (let t = 0; t < P.count; t += 3) {
    const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, cy = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, cz = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3;
    if (!inside(cx, cy, cz)) continue;
    for (let k = 0; k < 3; k++) pos.push(P.getX(t + k) + N.getX(t + k) * out, P.getY(t + k) + N.getY(t + k) * out, P.getZ(t + k) + N.getZ(t + k) * out);
  }
  g.dispose();
  const p = new THREE.BufferGeometry(); p.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); p.computeVertexNormals();
  return p;
}

/** A ram's horn on side s: from the top of the skull back, round and down beside the ear, its tip turning forward. */
function hornPoints(s, k = 1) {
  return [[s * 0.08, 0.1, -0.01], [s * 0.15, 0.2, -0.06], [s * 0.21, 0.23, -0.15], [s * 0.25, 0.15, -0.22], [s * 0.26, 0.02, -0.19], [s * 0.24, -0.06, -0.1], [s * 0.21, -0.04, -0.02]].map(([x, y, z]) => [x * k, y * k, z * k]);
}
/** The horns as geometries in the head's frame (a skin's props: bleached thicker, wire a tangle of strands). */
export function hornGeometries(props, k = 1) {
  const out = [];
  for (const s of [-1, 1]) {
    const pts = hornPoints(s, k);
    if (props.has('wire')) { for (let i = 0; i < 3; i++) out.push(tubeGeometry(pts.map(([x, y, z], j) => [x + s * i * 0.012, y + Math.sin(j * 1.7 + i) * 0.015, z + i * 0.01]), 0.014 * k)); continue; }
    const r = (props.has('bleached') ? 0.06 : 0.052) * k;
    out.push(tubeGeometry(pts, r, r * 0.3));
    out.push(new THREE.SphereGeometry(r * 1.05, 10, 8).translate(...pts[0]));   // (its root, a boss on the skull)
  }
  return out;
}

/** A paw: a broad rounded pad, flat under, three toes showing in front (the reference's big paws). */
function pawGeometry(len = 0.3, wide = 0.25) {
  const pad = new THREE.SphereGeometry(1, 16, 10).scale(wide / 2, 0.1, len / 2);
  const p = pad.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.02) p.setY(i, -0.02 + (p.getY(i) + 0.02) * 0.2);
  pad.translate(0, 0.08, len * 0.12);
  const toes = [-1, 0, 1].map((t) => { const g = new THREE.SphereGeometry(1, 10, 8).scale(wide * 0.2, 0.08, wide * 0.24); const q = g.attributes.position; for (let i = 0; i < q.count; i++) if (q.getY(i) < -0.01) q.setY(i, -0.01 + (q.getY(i) + 0.01) * 0.2); return g.translate(t * wide * 0.31, 0.058, len * 0.42 - Math.abs(t) * 0.025); });
  return merged([pad, ...toes]);
}

export function broadHoundModel(skin) {
  const home = !!OWN[skin.id];
  const P = { ...skin.palette, ...(OWN[skin.id] ?? {}) }, props = new Set(skin.props), M = materials('hound', skin);
  P.muzzle ??= P.antler; P.patch ??= P.smoke2 ?? P.smoke;
  const g = new THREE.Group(); g.name = `${skin.name} · broad hound (direct)`;
  // its ink is drawn with a white contour on every world but the Garden of Spheres', as today's hound's: black on the
  // Eclipse's dark streets it would be only a hole (playtest 2026-10-08, no invisible foes: src/foe-presence.js)
  const white = !props.has('glints');
  // the materials it is built in; the skinned meshes wear `coatM` and `lightM`, each part's own colour a vertex tint
  const inkB = M.mat('bhInk', P.ink), padB = M.mat('bhPad', shade(P.ink, 0.75)), hornB = M.mat('bhHorn', P.antler), muzzleB = M.mat('bhMuzzle', P.muzzle), patchB = M.mat('bhPatch', P.patch);
  const coatM = M.mat('bhCoat', P.ink, { vertexColors: true, lineWhite: white, foeSurface: home ? paint('coat', P) : worldPaint(skin, 'ink') ?? paint('coat', P) });
  const lightM = M.mat('bhLight', P.antler, { vertexColors: true, lineWhite: white, foeSurface: home ? paint('horn', P) : worldPaint(skin, 'antler') ?? undefined });
  const eyeM = M.own('eye', P.eye, { glow: 0.85 });
  // ---------------------------------------------------------------- four thick legs on the kit, onto big paws
  const body = pivot(g, 0, 0, 0, 'body');
  const torso = pivot(body, 0, HOUND.hipY, 0, 'torso');
  const plan = { ...PLANS.quadruped, knee: { ...PLANS.quadruped.knee, lenA: 0.56, lenB: 0.55 } };
  const legs = [];
  for (const z of [0.4, -0.46]) for (const s of [-1, 1]) {
    const front = z > 0;
    const leg = planLeg(plan, { group: g, body, hipParent: torso, hip: { x: s * 0.15, y: -0.06, z }, foot: { x: s * 0.2, z: front ? 0.46 : -0.52 }, radius: HOUND.legR, taper: 0.35, ankle: 0.1,
      mats: { joint: inkB, thigh: inkB, shin: inkB, foot: padB }, name: `broad hound leg ${legs.length}` });
    // (the kit's cylinders and knee balls for one long smooth mass a segment: the shoulder and forearm in front, the
    //  great hams behind, the shins still thick; fewer overlaps, so the ink draws a leg, not a stack of plates)
    for (const seg of [leg.thigh, leg.shin]) for (const c of seg.children.slice()) { c.removeFromParent(); c.geometry.dispose(); }
    add(leg.thigh, new THREE.CapsuleGeometry(1, 1, 6, 16).scale(front ? 0.115 : 0.13, leg.lenA * 0.36, front ? 0.13 : 0.17), inkB, 0, leg.lenA * 0.45, front ? 0.0 : -0.03);
    add(leg.shin, new THREE.CapsuleGeometry(0.09, leg.lenB * 0.9, 6, 14).scale(1, 1, 1.08), inkB, 0, leg.lenB * 0.5, 0);
    // (the big paw for the kit's small pad)
    for (const c of leg.foot.children.slice()) { c.removeFromParent(); c.geometry.dispose(); }
    add(leg.foot, pawGeometry(front ? 0.4 : 0.37, front ? 0.33 : 0.3), inkB, 0, -0.1, 0);
    add(leg.foot, new THREE.SphereGeometry(1, 12, 8).scale(0.1, 0.12, 0.11), inkB, 0, 0.02, -0.01);   // (the wrist into the paw)
    legs.push(leg);
  }
  const rig = new Rig({ plan, group: g, body, legs });
  // ---------------------------------------------------------------- the body: deep chest, tucked waist, broad haunches
  // (the reference's side view: the withers high over the front legs, the back dipping a little, the haunch rising
  //  again over the hind legs; broad enough from the front to sit on four thick legs)
  const chest = pivot(torso, 0, 0, 0.42, 'chest');
  const trunkGeo = loft([
    [0.78, 0.05, 0.08, -0.04], [0.72, 0.15, 0.2, -0.2], [0.58, 0.21, 0.27, -0.3], [0.4, 0.23, 0.28, -0.33], [0.2, 0.22, 0.25, -0.3],
    [0.0, 0.19, 0.2, -0.22], [-0.2, 0.18, 0.17, -0.16], [-0.38, 0.2, 0.17, -0.19], [-0.54, 0.21, 0.16, -0.21], [-0.68, 0.16, 0.1, -0.15], [-0.77, 0.06, 0.04, -0.05],
  ]);
  // the mauve saddle on its withers, lying on the coat
  const saddle = patchOf(trunkGeo, (x, y, z) => ((z - 0.3) / 0.27) ** 2 + ((y - 0.24) / 0.24) ** 2 < 1 && y > -0.02, 0.012);
  add(torso, trunkGeo, inkB);
  add(torso, saddle, patchB);
  // ---------------------------------------------------------------- neck and head: held high, pointed ears, cream muzzle, ram's horns
  const neck = pivot(chest, 0, 0.14, 0.18, 'neck');
  // (lofted along its length and tilted up: one smooth mass, deep at the withers)
  add(neck, loft([[-0.2, 0.17, 0.2, -0.2], [0.0, 0.155, 0.17, -0.17], [0.2, 0.135, 0.135, -0.14], [0.38, 0.115, 0.11, -0.115], [0.46, 0.05, 0.05, -0.05]], 14, 1).rotateX(-1.0), inkB);
  const head = pivot(neck, 0, 0.36, 0.22, 'head');
  add(head, new THREE.SphereGeometry(1, 16, 12).scale(0.13, 0.13, 0.17), inkB, 0, 0.02, 0);
  add(head, new THREE.SphereGeometry(1, 12, 8).scale(0.11, 0.05, 0.1), inkB, 0, 0.08, 0.08);   // (the brow, heavy over the eyes)
  // the muzzle: blunt and broad, the upper lip over the jaw (the jaw hinged: it opens to bite and to snarl)
  add(head, new THREE.CapsuleGeometry(0.075, 0.12, 6, 14).rotateX(Math.PI / 2).scale(1.25, 1, 1).translate(0, -0.04, 0.19), muzzleB);
  const jaw = pivot(head, 0, -0.09, 0.08, 'jaw');
  add(jaw, new THREE.CapsuleGeometry(0.045, 0.12, 4, 12).rotateX(Math.PI / 2).scale(1.5, 0.75, 1).translate(0, -0.01, 0.1), muzzleB);
  pair((s) => { const ear = add(head, new THREE.ConeGeometry(0.045, 0.17, 6), inkB, s * 0.07, 0.15, -0.05); ear.rotation.set(-0.25, 0, -s * 0.22); });
  const eyes = add(head, merged(pair((s) => new THREE.CapsuleGeometry(0.014, 0.034, 3, 8).rotateZ(Math.PI / 2 - s * 0.35).scale(1, 1, 0.5).translate(s * 0.075, 0.035, 0.145))), eyeM);
  add(head, merged(hornGeometries(props)), hornB);
  const hornTip = pivot(head, 0, 0.23, -0.15);   // (the rake's glow on the horns' crown)
  const glintM = props.has('glints') ? M.own('glint', P.glow, { glow: 0.9 }) : null;
  if (glintM) add(head, merged(pair((s) => hornPoints(s).slice(1, 6).map(([x, y, z]) => new THREE.SphereGeometry(0.012, 5, 4).translate(x + s * 0.04, y, z))).flat()), glintM);
  if (props.has('halo')) {
    const h = pivot(head, 0, 0.36, -0.08, 'halo'); h.rotation.set(-0.12, 0, 0.06);
    add(h, new THREE.TorusGeometry(0.42, 0.011, 5, 48).rotateX(Math.PI / 2), M.own('halo', P.glow, { glow: 0.8 }));
  }
  // dripping like wet ink (the Mangrove): drops hanging off its chin, neck, chest and belly
  if (props.has('drips')) for (const [p, x, y, z, l] of [[jaw, 0, -0.06, 0.18, 0.12], [neck, 0.08, 0.0, 0.05, 0.16], [neck, -0.08, 0.1, 0.12, 0.12], [chest, 0.12, -0.32, 0.0, 0.2], [chest, -0.1, -0.33, -0.12, 0.16], [torso, 0.1, -0.22, 0.0, 0.18], [torso, -0.09, -0.15, -0.25, 0.14], [torso, 0.08, -0.2, -0.5, 0.12]])
    add(p, new THREE.ConeGeometry(0.02, l, 5).rotateX(Math.PI).translate(0, -l / 2, 0), inkB, x, y, z);
  // ---------------------------------------------------------------- the tail: long, sweeping back and curling up, four joints
  const tail = [];
  let at = pivot(torso, 0, 0.04, -0.72, 'tail 0');
  for (const [i, [len, r0, r1, rest]] of [[0.26, 0.075, 0.062, 0.2], [0.26, 0.062, 0.05, 0.18], [0.24, 0.05, 0.034, 0.5], [0.22, 0.034, 0.006, 0.75]].entries()) {
    add(at, tubeGeometry([[0, 0, 0.02], [0, 0, -len / 2], [0, 0, -len - 0.01]], r0, r1), inkB);
    at.userData.rest = rest; tail.push(at);
    if (i < 3) at = pivot(at, 0, 0, -len, `tail ${i + 1}`);
  }
  // ---------------------------------------------------------------- its shadow form: a ragged pool, its head and horns rising out of it
  const poolShape = new THREE.Shape(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = 0.55 * (1 + (i % 2 ? 0.18 : -0.05) + Math.sin(i * 2.3) * 0.08); poolShape[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); }
  const poolM = M.mat('bhPool', P.ink, { flat: true, lineWhite: white });
  const pool = add(g, new THREE.ShapeGeometry(poolShape).scale(0.95, 1.7, 1).rotateX(-Math.PI / 2), poolM, 0, 0.03, 0);
  const glowRim = add(g, new THREE.RingGeometry(0.62, 0.72, 24).scale(0.95, 1.7, 1).rotateX(-Math.PI / 2), M.own('glow', P.glow, { glow: 0.8, side: THREE.DoubleSide }), 0, 0.04, 0);
  const rising = pivot(g, 0, 0, 0.4, 'rising');
  add(rising, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.15, 0.16, 0.22), poolM);
  add(rising, merged([...hornGeometries(props, 0.85).map((x) => x.translate(0, props.has('wire') ? 0.11 : 0.06, -0.02)), new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.1, 0.07, 0.11).translate(0, 0, 0.17)]), M.mat('bhRiseLight', P.antler, { flat: true, lineWhite: white }));
  add(rising, merged(pair((s) => new THREE.SphereGeometry(0.04, 8, 6).scale(1, 0.55, 1).translate(s * 0.08, 0.08, 0.15))), eyeM);
  // ---------------------------------------------------------------- its look at you, one skinned mesh in the dark and one in the light
  // (its eyes on you once it has noticed you, on its way before: src/enemies/gaze.js, issue #508)
  const gaze = [gazePart(g, head, { mode: 'turn', yaw: 0.55, up: 0.3, down: 0.35 }), gazePart(g, rising, { mode: 'turn', yaw: 0.5, up: 0.3, down: 0.3 })];
  // (they hang on the root: hidden with the body while it is a shadow)
  const skins = skinBy(g, [{ from: [inkB, padB], into: coatM }, { from: [hornB, muzzleB, patchB], into: lightM }]).filter(Boolean);
  finish(g);
  let solid = 1, crouch = 0, rake = 0, coil = 0, bite = 0, sway = 0;
  return {
    group: g, gaze, body, rig, parts: [], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, shadowy: true, tones: [P.ink, P.antler, P.patch],
    trial: 'direct',
    tell: (id) => (id === 'rake' ? hornTip : head),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // stepping through the shadow (its 'step'): it sinks into its own pool as it winds up, nothing drawn behind you
      const sinking = wind && f.atk?.blink;
      // lying in wait (calm, unprovoked): only its shadow under a tree, until it stands up to watch you
      const lying = f.state === 'idle' && !f.provoked && !f.watcher;
      const gone = f.phased || sinking || lying;
      solid = ease(solid, gone ? 0 : 1, gone ? 6 : 14, dt);
      body.visible = solid > 0.08; body.scale.set(1, Math.max(0.05, solid), 1);
      for (const m of skins) m.visible = body.visible;
      pool.visible = solid < 0.9; pool.scale.setScalar(1.2 - solid * 0.5);
      glowRim.visible = rising.visible = solid < 0.6;
      rising.position.y = -0.12 + (1 - solid) * 0.12 + Math.sin(c.now / 140) * 0.015;
      glowRim.scale.setScalar(1 + Math.sin(c.now / 200) * 0.06);
      // the pounce: crouched low, the head down, the horns dipped forward, the shoulders bunched
      crouch = ease(crouch, id === 'pounce' && wind ? c.wind : 0, 10, dt);
      // then the coil (the wind-up's last 45 %, v1.63 #260): the rump up, the tail stiff and quivering, a snarl, a shiver
      coil = ease(coil, id === 'pounce' && wind ? THREE.MathUtils.smoothstep(f.k, 0.5, 0.8) : 0, 14, dt);
      rake = ease(rake, id === 'rake' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 12, dt);
      bite = ease(bite, (strike && id === 'bite' ? Math.sin(Math.PI * f.k) : 0) + (wind && id === 'bite' ? c.wind * 0.6 : 0) + coil * 0.55, 20, dt);
      const leap = strike && f.atk?.lunge ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.4)) * 3) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: leap });
      const shiver = coil * Math.sin(c.now / 22) * 0.018;
      body.position.set(o.x + shiver, -(1 - solid) * 0.3 + o.y - crouch * 0.2 + coil * 0.06, o.z);
      body.rotation.set(o.pitch + crouch * 0.12 + coil * 0.14, o.yaw + rake * (strike ? -0.5 : 0.25), o.roll + shiver);
      chest.scale.set(1 + crouch * 0.1, 1 - crouch * 0.05, 1);
      neck.rotation.x = crouch * 0.9 + rake * 0.7 - o.pitch * 0.6;
      neck.rotation.z = rake * 0.45;
      head.rotation.x = crouch * 0.3 + rake * 0.3 + (strike && id === 'bite' ? -0.3 * Math.sin(Math.PI * f.k) : 0);
      jaw.rotation.x = bite * 0.55;
      g.position.y += leap ? Math.sin(Math.PI * f.k) * 0.5 : 0;
      rig.visible = body.visible;
      // the tail: swaying as it trots, streaming back in the leap, stiff and up and quivering in the coil
      const run = c.moving ? Math.min(1, (f.def.speed ?? 5) / 5) : 0;
      sway = Math.sin(c.now / (c.moving ? 170 : 520)) * (c.moving ? 0.22 : 0.1) * (1 - coil);
      tail.forEach((t, i) => { t.rotation.set(t.userData.rest * (1 - run * 0.35 - leap * 0.5) + coil * (i ? 0.1 : 0.55) + Math.sin(c.now / 30 + i) * coil * 0.03 - crouch * 0.15 * (1 - coil), sway * (0.6 + i * 0.3), 0); });
      rig.write();
      eyeM.uniforms.uColor.value.set(eyeColor(f, f.lit > 0 ? '#ffe2a8' : P.eye, '#ff6a8a'));
      if (solid > 0.5 && Math.random() < (props.has('drips') ? 0.25 : 0.12)) c.drip(f, P.ink);   // (its shadow dripping off it, as today's)
    },
    dispose: M.dispose,
  };
}
