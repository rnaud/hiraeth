import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { STORY } from '../desert-sites.js';
import { Puffs } from './puffs.js';
import { THINGS, ITEMS } from './desert-data.js';
import { quietOr } from '../hint-level.js';

// Two of the desert's errands, hands-on (src/story/desert.js sets them up).
//
// Teo's drum (quest desert.drum): the wind rolled it under the old ribcage
// south of the start (src/world.js, ribcage(150, -210, 1, 0.5)), where it
// stands on its rim, jammed against the inside of a rib's foot by a knuckle of
// spine that rolled down after it. Shoving the knuckle toward the rib only jams
// it tighter; shoved from the side (the fluid's push, or by hand before the
// backpack) it rolls off, and the drum tips out and rolls away like a wheel,
// then falls flat on the sand, where you can pick it up.
//
// The mask in the sand (quest desert.mask): the wind has drifted sand over the
// sleeping mask's eyes like heavy lids (src/world.js, sleepingMask). A glob of
// fluid (or a push, if you climbed up) washes an eye clear, but the wind sifts
// the sand back after a few seconds: clear both at once and the mask's eyes
// open, a glint in each, and it looks at you.
//
// Flags: desert.drum.freed (the side the knuckle rolled to, ±1), desert.mask.eyes.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Y = V(0, 1, 0);
const _q = new THREE.Quaternion(), _a = V(0, 0, 0);

// the drum and the knuckle, ribcage-local: `into` points from the belly into the rib
const RIB_ROT = 0.5;
export const DRUM = { r: 0.42, half: 0.11, knuckleR: 0.72, roll: 3.4, swerve: 0.8, aside: 2.6 };
/** How long the drum takes to come free: the knuckle rolls (0–0.6 s), the drum rolls (0.35–1.9 s), it topples (to 2.4 s). */
export const FREE_TIME = 2.4;
/** The mask: the transform its group has in src/world.js (sleepingMask(-20, -400)); its eyes in that frame. */
export const MASK = { x: -20, z: -400, lift: 14, rot: [-0.05, 0.75, 0.12], eyes: [-1, 1].map((s) => ({ s, at: [s * 10, 9, 33.5], tilt: s * -0.12 })) };
/** Seconds an eye stays clear before the wind sifts the sand back. */
export const EYE_WINDOW = 7;

/** The drum under the ribcage. ctx: the desert's story context; toolHasPush: () => bool. */
export function setupDrum(ctx, { toolHasPush = () => false } = {}) {
  const { level, player, quests, dialogue, game, sound, scene, toast } = ctx;
  const T = level.ground;
  const into = V(Math.sin(RIB_ROT), 0, Math.cos(RIB_ROT)), along = V(Math.cos(RIB_ROT), 0, -Math.sin(RIB_ROT));
  const gy = (p) => T.heightAt(p.x, p.z);
  const pinnedAt = V(STORY.drum.x, 0, STORY.drum.z); pinnedAt.y = gy(pinnedAt) + DRUM.r;
  const knuckleAt = pinnedAt.clone().addScaledVector(into, -(DRUM.r + DRUM.knuckleR)); knuckleAt.y = gy(knuckleAt) + 0.5;
  const taken = () => quests.isDone('desert.drum') || quests.has('drum') || quests.stage('desert.drum') === 'return';
  const side = () => Math.sign(game.flag('desert.drum.freed') === true ? 1 : game.flag('desert.drum.freed') ?? 0);
  const freed = () => !!game.flag('desert.drum.freed');
  const loose = () => freed() || taken();   // (a save that already has the drum: the knuckle lies aside)
  const st = { t: FREE_TIME, wobble: 0, hintT: -1e9, drumPushed: false, knucklePushed: false, clock: 0 };
  if (!freed()) st.t = 0;

  // ------------------------------------------------ the meshes
  const g = new THREE.Group();
  const red = makeMaterial({ color: '#c8483a', flat: true }), skin = makeMaterial({ color: '#f3ead8', flat: true });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(DRUM.r, DRUM.r, DRUM.half * 2, 16), red));
  // the skin and its ring of shells, one mesh
  const parts = [new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16).translate(0, 0.12, 0)];
  for (let i = 0; i < 8; i++) parts.push(new THREE.SphereGeometry(0.05, 6, 4).translate(Math.sin(i * 0.785) * 0.43, 0, Math.cos(i * 0.785) * 0.43));
  g.add(new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), skin));
  // a knuckle of the giant's spine, as big as a sheep: a lumpy round bone, a stub of spine on its back
  const bone = makeMaterial({ color: '#f2ead6', flat: true });
  const kn = new THREE.Mesh(mergeGeometries([
    new THREE.IcosahedronGeometry(DRUM.knuckleR, 1).scale(1, 0.82, 1.12),
    new THREE.ConeGeometry(0.22, 0.6, 6).translate(0, 0.72, -0.1).rotateX(-0.3),
    new THREE.SphereGeometry(0.3, 7, 5).translate(0.55, -0.1, 0.35),
  ].map((x) => (x.index ? x.toNonIndexed() : x))), bone);
  for (const o of [g, kn]) { o.traverse((m) => { m.userData.noCollide = true; }); scene.add(o); }
  const sand = new Puffs(scene, { color: '#e6cf9f', max: 28, glow: 0.4 });

  // where everything is at a moment of the freeing (t: seconds since the shove; s: the knuckle's side)
  const edge = new THREE.Quaternion().setFromUnitVectors(Y, along);   // on its rim, a wheel rolling along -into
  const flatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0.4, -0.08));
  const kRest = V(0, 0, 0), dRest = V(0, 0, 0), _p = V(0, 0, 0), _m = V(0, 0, 0);
  const pose = (t, s) => {
    // the knuckle rolls aside
    kRest.copy(knuckleAt).addScaledVector(along, s * DRUM.aside).addScaledVector(into, -0.5);
    const kk = THREE.MathUtils.smootherstep(t, 0, 0.6);
    kn.position.lerpVectors(knuckleAt, kRest, kk);
    kn.position.y = THREE.MathUtils.lerp(knuckleAt.y, gy(kRest) + 0.5, kk) + Math.sin(Math.PI * kk) * 0.15;
    _a.copy(Y).cross(_m.copy(along).multiplyScalar(s)).normalize();
    kn.quaternion.setFromAxisAngle(_a, kk * DRUM.aside / DRUM.knuckleR).multiply(_q.setFromEuler(new THREE.Euler(0.2, 1.1, 0.15)));
    // the drum rolls out of the crook, away from the rib, curving a little away from the knuckle's side
    dRest.copy(pinnedAt).addScaledVector(into, -DRUM.roll).addScaledVector(along, -s * DRUM.swerve);
    const u = THREE.MathUtils.clamp((t - 0.35) / 1.55, 0, 1), e = 1 - (1 - u) * (1 - u);   // fast off the mark, slowing
    _p.copy(pinnedAt).lerp(dRest, e);
    _p.addScaledVector(along, -s * Math.sin(Math.PI * e) * 0.25);
    const dist = e * pinnedAt.distanceTo(dRest);
    _a.copy(Y).cross(_m.copy(dRest).sub(pinnedAt).setY(0).normalize()).normalize();
    const rolling = new THREE.Quaternion().setFromAxisAngle(_a, dist / DRUM.r).multiply(edge);
    // a wobble as it slows, then it topples flat
    const f = THREE.MathUtils.smootherstep(t, 1.9, FREE_TIME);
    g.quaternion.copy(rolling).slerp(flatQ, f);
    g.position.set(_p.x, THREE.MathUtils.lerp(gy(_p) + DRUM.r, gy(_p) + DRUM.half + 0.02, f), _p.z);
  };
  pose(freed() ? st.t : taken() ? FREE_TIME : 0, side() || 1);
  g.visible = !taken();

  // ------------------------------------------------ freeing it
  const hint = (text, every = 5) => { if (st.clock - st.hintT > every) { st.hintT = st.clock; toast(text); } };
  const free = (s, how) => {
    if (loose()) return false;
    game.set('desert.drum.freed', s);
    st.t = 0.001;
    toast(how === 'push' ? 'The fluid shoves the knuckle of bone aside. The drum tips out of the crook and rolls off across the sand, like a wheel.'
      : 'You heave the knuckle of bone aside. The drum tips out of the crook and rolls off across the sand, like a wheel.');
    sand.burst(knuckleAt.clone().setY(knuckleAt.y - 0.3), { n: 6, rise: 0.8, size: 0.5, spread: 0.9, life: 1.6 });
    sound.whoosh?.();
    sound.chime?.();
    return true;
  };
  /** A shove at the knuckle along `dir` (the push's, or from you to it when you heave by hand). */
  const shove = (dir, how) => {
    if (loose()) return false;
    st.knucklePushed = true;
    const d = _m.set(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-6) return false;
    d.normalize();
    if (d.dot(into) > 0.5) {
      // straight at the rib: it only jams tighter
      st.wobble = 1;
      hint(how === 'push' ? quietOr('The knuckle grinds into the drum, and the drum into the rib. Shoved that way it only jams tighter.', 'The knuckle grinds into the drum, and the drum into the rib. Shoved that way it only jams tighter: try it from the side.')
        : 'You lean on the bone. It grinds into the drum, and the drum into the rib. Not that way: from the side.');
      return false;
    }
    return free(Math.sign(d.dot(along)) || 1, how);
  };
  const knuckleTarget = { kind: 'knuckle', radius: DRUM.knuckleR + 0.15, position: () => kn.position, enabled: () => !loose() && flat(player.pos, kn.position) < 150,
    onHit: (mode, point, dir) => {
      if (mode === 'push') return shove(dir, 'push');
      st.wobble = 1;
      hint(quietOr('The knuckle of bone rocks against the drum, and settles.', 'The knuckle of bone rocks against the drum, and settles. It needs a shove: switch the gun to push with {key:mode}, then aim and shoot.'));
      return true;
    } };
  registerTarget(knuckleTarget);
  const drumTarget = { kind: 'drum', radius: 0.5, position: () => g.position, enabled: () => !taken() && (!freed() || st.t >= FREE_TIME) && flat(player.pos, g.position) < 150,
    onHit: (mode) => {
      if (mode === 'push') { st.drumPushed = true; return true; }
      st.wobble = 0.6;
      hint(freed() ? 'Dum. The note runs out across the sand, and comes back off the ribs.' : 'Dum. A dull note: something presses on the skin. The drum is pinned tight between bone and bone.', 3);
      return true;
    } };
  registerTarget(drumTarget);

  // ------------------------------------------------ E: look at it, heave the bone, pick the drum up
  const pickUp = () => {
    quests.give('drum');
    toast(`Picked up ${ITEMS.drum}`);
    if (!quests.isStarted('desert.drum')) quests.start('desert.drum', 'return');
    else if (quests.isActive('desert.drum')) quests.set('desert.drum', 'return');
    g.visible = false;
    sound.chime?.();
  };
  const near = (pl, p, dy = 3) => (Math.abs(pl.pos.y - p.y) < dy ? flat(pl.pos, p) : Infinity);
  registerInteractable({ id: 'drum', priority: PRIORITY.use, range: 2.6, at: () => g.position, enabled: () => !taken() && (!freed() || st.t >= FREE_TIME),
    prompt: () => (freed() ? 'pick up the drum' : 'pull at the drum'), distance: (pl) => near(pl, g.position),
    use: () => { if (freed()) pickUp(); else dialogue.start(THINGS.drumStuck, null, g.position.clone()); } });
  registerInteractable({ id: 'knuckle', priority: PRIORITY.use, range: 2.4, at: () => kn.position, enabled: () => !loose(),
    prompt: () => (toolHasPush() ? 'look at the knuckle of bone' : 'heave the knuckle of bone'), distance: (pl) => near(pl, kn.position),
    use: (pl = player) => {
      if (toolHasPush()) dialogue.start(THINGS.knuckle, null, kn.position.clone());
      else shove(_p.copy(kn.position).sub(pl.pos), 'heave');
    } });
  quests.locate('drum', () => g.position);

  const update = (dt) => {
    st.clock += dt;
    // a push that met the drum but not the knuckle: say why it won't shift
    if (st.drumPushed && !st.knucklePushed && !freed()) hint('The drum creaks against the rib, but it won’t shift while the knuckle of bone holds it there.');
    st.drumPushed = st.knucklePushed = false;
    if (freed() && st.t < FREE_TIME) {
      const was = st.t;
      st.t = Math.min(FREE_TIME, st.t + dt);
      pose(st.t, side() || 1);
      if (was < 2.0 && st.t >= 2.0) sand.burst(g.position.clone(), { n: 5, rise: 0.6, size: 0.35, spread: 0.7, life: 1.3 });
    } else if (st.wobble > 0) {
      st.wobble = Math.max(0, st.wobble - dt * 2);
      if (!freed()) {
        pose(0, 1);
        const w = Math.sin(st.wobble * 24) * 0.05 * st.wobble;
        kn.rotateY(w); g.rotateZ(w * 0.6);
      }
    }
    if (taken() && g.visible) g.visible = false;
    if (sand.active) sand.update(dt);
  };
  return { update, state: st, drum: g, knuckle: kn, pinnedAt, knuckleAt, into, along, shove, free, freed, targets: { knuckle: knuckleTarget, drum: drumTarget } };
}

/** The sleeping mask's eyes, drifted shut with sand. */
export function setupMask(ctx) {
  const { level, player, quests, dialogue, game, sound, scene, toast } = ctx;
  const T = level.ground;
  const solved = () => !!game.flag('desert.mask.eyes');
  const root = new THREE.Object3D();
  root.position.set(MASK.x, T.baseAt(MASK.x, MASK.z, 30) + MASK.lift, MASK.z);
  root.rotation.set(...MASK.rot);
  scene.add(root);
  const sandM = makeMaterial({ color: '#ecd29c', flat: true, glow: 0.3 });   // (a little light of its own: it reads as sand even in the eye's shadow)
  const glintM = makeMaterial({ color: '#fff6dc', glow: 1, flat: true });
  const sand = new Puffs(scene, { color: '#efdcae', max: 48, glow: 0.5 });
  const st = { clock: 0, hintT: -1e9, solvedT: null, told: false };
  const eyes = MASK.eyes.map(({ s, at, tilt }) => {
    const eye = new THREE.Object3D();
    eye.position.set(...at); eye.rotation.z = tilt;
    root.add(eye);
    // the lid: a bulge of drifted sand filling the eye and swelling out over its front and underside
    // (what you see of it from the sand below), its top edge fixed so it shrinks up into the drift
    // lying on the eye's ledge; and the drift itself
    const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10).scale(6.0, 1.3, 3.2).translate(0, -1.3, 0), sandM);
    lid.position.set(0, 1.15, 1.6);
    const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(6.1, 0.7, 3.3), sandM);
    drift.position.set(0, 1.3, 0.4);
    // what shows when it opens: a glint low in the eye, toward the nose
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6).scale(1.5, 0.75, 0.6), glintM);
    glint.position.set(-s * 1.4, -0.75, 3.0);
    for (const m of [lid, drift, glint]) { m.userData.noCollide = true; eye.add(m); }
    const e = { s, eye, lid, drift, glint, k: solved() ? 0 : 1, want: solved() ? 0 : 1, open: solved(), openAt: -1e9, aim: V(0, 0, 0) };
    return e;
  });
  root.updateMatrixWorld(true);
  for (const e of eyes) e.eye.localToWorld(e.aim.set(0, -0.2, 3.4));
  const mid = eyes[0].aim.clone().lerp(eyes[1].aim, 0.5);
  const centre = root.position.clone();
  const apply = (e) => {
    const k = Math.max(0.001, e.k);
    e.lid.scale.set(1, k, 0.3 + 0.7 * k);
    e.drift.scale.set(1, 0.25 + 0.75 * k, 1);
    e.lid.visible = e.k > 0.01;
    e.glint.visible = solved();
    e.glint.scale.setScalar(solved() ? THREE.MathUtils.clamp((st.clock - (st.solvedT ?? -10)) / 0.8, 0.001, 1) : 0.001);
  };
  for (const e of eyes) apply(e);
  const hint = (text, every = 6) => { if (st.clock - st.hintT > every) { st.hintT = st.clock; toast(text); } };

  const solve = () => {
    if (solved()) return;
    game.set('desert.mask.eyes', true);
    st.solvedT = st.clock;
    sound.chime?.();
    toast('Both eyes stand open. Far down in each, something glints.');
    st.lookAt = st.clock + 1.4;
  };
  const clear = (e, how) => {
    if (solved() || e.open) return false;
    e.open = true; e.want = 0; e.openAt = st.clock;
    // the sand pours out of the eye and down the cheek
    const from = e.aim.clone();
    sand.burst(from, { n: 16, rise: 0.3, size: 0.55, spread: 1.8, life: 2.4, gravity: 4 });
    sound.whoosh?.();
    if (eyes.every((x) => x.open)) solve();
    else if (!st.told) { st.told = true; toast(how === 'push' ? 'The fluid blows the sand out of the mask’s eye. It pours down its cheek.' : 'The fluid washes the sand out of the mask’s eye. It pours down its cheek.'); }
    return true;
  };
  const targets = eyes.map((e) => ({ kind: 'maskEye', radius: 4, position: () => e.aim, enabled: () => !solved() && !e.open && flat(player.pos, centre) < 160,
    onHit: (mode) => clear(e, mode) }));
  for (const t of targets) registerTarget(t);
  quests.locate('maskEyes', () => mid);

  const update = (dt) => {
    st.clock += dt;
    for (const e of eyes) {
      // the wind sifts the sand back into an eye left open alone
      if (!solved() && e.open && st.clock - e.openAt > EYE_WINDOW) {
        e.open = false; e.want = 1;
        hint(quietOr('The wind sifts the sand back over the mask’s eye.', 'The wind sifts the sand back over the mask’s eye. Both eyes at once, then, and quickly.'));
      }
      if (e.k !== e.want) {
        const rate = e.want < e.k ? 1 / 0.7 : 1 / 2.6;   // the sand pours off fast and drifts back slowly
        e.k = e.want < e.k ? Math.max(e.want, e.k - dt * rate) : Math.min(e.want, e.k + dt * rate);
      }
      apply(e);
    }
    // a moment after it opens its eyes: it looks at you
    if (st.lookAt != null && st.clock >= st.lookAt) {
      st.lookAt = null;
      dialogue?.start?.(THINGS.maskEyes, null, mid.clone(), mid.clone());
    }
    if (sand.active) sand.update(dt);
  };
  return { update, state: st, eyes, targets, mid, root, clear, solved };
}
