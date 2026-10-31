import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder, SecondOrderAngle } from '../../motion-kit/spring.js';
import { materials, add, pivot, lerp, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { foeSource } from '../foe-assets.js';
import { piece, pick, rolesOf, roleColours, boneBoxes, normalNear } from './flyer-body.js';
import { rayModel as skyRayModel } from './sky-ray-legacy.js';

// The storm ray (issue #800, family B): the game's `ray`, everywhere it is fielded (its worlds, the Arena, the creatures
// gallery). Its body is Tripo's (task e9077ebe-…, from the approved image,
// references/enemy-redesign-2026-10-30/storm-ray/4fc2da68-…-0.png), made into the game's asset by the trial's prepare.mjs
// (references/enemy-redesign-2026-10-30/trials/ray-tripo/: the drawn shadow dropped, the game's frame and size, 12k
// triangles, the tail cut off across its root, four flat colours) and shipped by scripts/tripo/ship-flyer.mjs as
// public/enemies/storm-ray/body.glb. The sky ray it replaces (the flat diamond of strips with its whip tail) is kept as
// plans/sky-ray-legacy.js: it stands in where the body is not loaded, and can come back as a foe of its own.
//
// A glider has no legs: its rig is its own, on the plan's own motion (the skill's table's nearest family, the machine's,
// its joints blended): the thick body on the frame; each wing on a joint where it leaves the body's back and another
// half way out, weighted by geometry from the body over its root (so it bends there, the body's lens untouched), let
// down from the reference's raised V to a shallow one as it glides and beating on the plan's travelling wave (the tip
// lags the root); the tail on two joints of its own (its own mesh, its own bands), trailing the turns on a spring.
// Raised wings are the reference's own pose: the downdraft's wind-up lifts them back to it and past it.
//
// Its look at you (the author's rule, #800): the painted eyes are painted out of the texture, and dark eyes of their size
// stand in their place on the head's sides; the gaze (src/enemies/gaze.js) slides them toward the traveller (they go
// orange as it winds up), and its heading and bank turn it onto him.
//
// Its wind-ups (src/telegraph.js), from the body alone, as the sky ray's:
//   skim    it climbs, banks round onto its line at you and sweeps its wings back, the beat stilled; then the run in low
//   lash    the tail lifts high behind it, then cracks down
//   draft   (Vael, Vael II) it stalls over you, its wings raised high, and beats them down hard (breaks your glide)
// Parried in a skim, it ploughs into the ground and lies there, wings flat, open (onParry 'ground').
//
// Skins (src/enemies/skins.js): the home skin (the storm ray, Vael) wears the reference's colours from the texture;
// every other skin recolours the roles (back, belly, tips, the dark lines) from its palette (vertex colours) and keeps its
// dress: the cloud ray's mist off its tail, the scrap ray's patches and its wire, the glass manta's facets, the porcelain
// ray's ribbons and glaze, the abyss ray's long tail and white ink. The engines (Unity) decode no picture: there the home
// skin is drawn by its vertex colours too.

/** The shipped body, under public/ (loaded by src/enemies/foe-assets.js, its landmarks.json beside it). */
export const STORM_RAY_BODY = 'enemies/storm-ray/body.glb';
const ADAPT = new WeakMap();
let forced;
/** The loaded body as this builder reads it ({ geometry, landmarks, map: null }), or null (not loaded: the sky ray stands in). */
export function stormRaySource() {
  if (forced !== undefined) return forced;
  const src = foeSource('ray');
  if (!src) return null;
  if (!ADAPT.has(src)) ADAPT.set(src, { geometry: src.geometry, landmarks: src.rig, map: null });
  return ADAPT.get(src);
}
/** Stand a source in (a test's), null for none (the sky ray), or undefined to go back to the loaded one. */
export function setStormRaySource(src) { forced = src; }

/** The ray's builder (src/enemies/plans/index.js): the Tripo body, or the sky ray where it is not loaded. */
export function stormRay(skin) {
  const src = stormRaySource();
  return src ? tripoRayModel(skin, src) : skyRayModel(skin);
}

/** The flat texture's colours by role (prepare.mjs PALETTE: the approved image's). */
const ROLES = { top: '#5f8578', under: '#e6d6aa', tip: '#a5523c', dark: '#1f2a26' };
/** How far the wings are let down from the reference's raised V as it glides (rad): a shallow V left. */
export const WING_DOWN = 0.72;

const vec = (a) => new THREE.Vector3(...a);
const smooth = THREE.MathUtils.smoothstep;

// ---------------------------------------------------------------------------------------------- the weights
const CACHE = new WeakMap();
/**
 * The weights, once a source. Body bones: 0 the frame, 1–2 the left wing's inner and outer, 3–4 the right's; the tail's:
 * 0 the frame, 5 its root, 6 its end. A wing's share rises over its root (out past the body's side and up off its back),
 * passing to the outer joint from 45 % to 75 % of the way to its tip; the tail's from its root back.
 */
function prepare(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, n = geo.attributes.position.count, Pos = geo.attributes.position;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3(), a = new THREE.Vector3(), d = new THREE.Vector3();
  const yLo = L.body.mid[1] + (L.body.top - L.body.mid[1]) * 0.45, yHi = L.body.mid[1] + (L.body.top - L.body.mid[1]) * 0.9;
  const tail = { root: vec(L.tail.root), end: vec(L.tail.end) };
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(Pos, i);
    const set = (ws) => { ws.sort((x, y) => y[1] - x[1]); for (let k = 0; k < 4; k++) { SI[i * 4 + k] = ws[k]?.[0] ?? 0; SW[i * 4 + k] = ws[k]?.[1] ?? 0; } };
    if (p.z < tail.root.z + 0.06 && Math.abs(p.x) < L.body.half) {
      // the tail: from the body at its root to its end
      const t = (tail.root.z + 0.06 - p.z) / (tail.root.z + 0.06 - tail.end.z), on = smooth(t, 0, 0.18), end = on * smooth(t, 0.4, 0.8);
      set([[0, 1 - on], [5, on - end], [6, end]]);
      continue;
    }
    const w = L.wings[p.x < 0 ? 0 : 1], s = w.side, rx = s * w.root[0];
    const share = smooth(s * p.x, rx - 0.12, rx + 0.14) * smooth(p.y, yLo, yHi);
    a.copy(vec(w.tip)).sub(vec(w.root)); const u = d.copy(p).sub(vec(w.root)).dot(a) / a.lengthSq();
    const outer = share * smooth(u, 0.45, 0.75), b = p.x < 0 ? 1 : 3;
    set([[0, 1 - share], [b, share - outer], [b + 1, outer]]);
  }
  const roles = rolesOf(geo, ROLES);
  const pieces = Object.fromEntries(['body', 'tail'].map((k) => [k, piece(geo, [L.parts[k]], new THREE.Vector3(), ['position', 'normal', 'uv', 'color'])]));
  for (const k of ['body', 'tail']) {
    pieces[k].geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(pick(new THREE.BufferAttribute(SI, 4), pieces[k].from).array, Math.round), 4));
    pieces[k].geometry.setAttribute('skinWeight', pick(new THREE.BufferAttribute(SW, 4), pieces[k].from));
  }
  const out = { roles, pieces, skins: new Map(), colours: new Map() };
  CACHE.set(src.geometry, out);
  return out;
}

/** A part's geometry in a skin's colours (null: its own COLOR_0) with the skin's dress (pieces { geometry, bone, colour }), cached. */
function partGeometry(prep, part, key, colours, dress = []) {
  const k = `${part}.${key}`, hit = prep.skins.get(k); if (hit) return hit;
  const P = prep.pieces[part];
  let g = P.geometry;
  if (colours || dress.length) {
    g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(P.geometry.attributes)) g.setAttribute(name, a);
    if (colours) g.setAttribute('color', pick(colours, P.from));
    g.setIndex(P.geometry.index);
    if (dress.length) {
      const flat = g.toNonIndexed(), list = [flat];
      for (const d of dress) {
        const x = d.geometry.index ? d.geometry.toNonIndexed() : d.geometry, n = x.attributes.position.count, c = new THREE.Color(d.colour);
        if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
        x.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
        x.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: n }, () => [d.bone, 0, 0, 0]).flat(), 4));
        x.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [1, 0, 0, 0]).flat(), 4));
        list.push(x);
      }
      g = new THREE.BufferGeometry();
      for (const name of Object.keys(flat.attributes)) {
        const parts = list.map((x) => x.attributes[name]), size = parts[0].itemSize, A = parts[0].array.constructor, arr = new A(parts.reduce((t, a) => t + a.count * size, 0));
        let o = 0; for (const a of parts) for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) arr[o++] = a.getComponent(i, c);
        g.setAttribute(name, new THREE.BufferAttribute(arr, size, parts[0].normalized));
      }
    }
  }
  prep.skins.set(k, g);
  return g;
}

// ---------------------------------------------------------------------------------------------- the body
/** The ray's body (the model contract of plans/index.js), from the loaded source (stormRaySource). */
export function tripoRayModel(skin, src) {
  const PL = PLANS.glider, L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('ray', skin);
  const home = skin.id === 'arzach', textured = home && !!src.map, dark = props.has('dark');
  const prep = prepare(src);
  // (the home skin's own colours: the source's COLOR_0, the flat texture's own; the others' over the roles)
  if (!home && !prep.colours.has(skin.id)) prep.colours.set(skin.id, roleColours(prep.roles, { top: P.top, under: P.under, tip: P.edge ?? P.spots, dark: P.spots }, ROLES));
  const colours = home ? null : prep.colours.get(skin.id), key = home ? 't' : skin.id;
  const look = () => (textured ? { map: src.map } : { vertexColors: true });
  const g = new THREE.Group(); g.name = `${skin.name} · storm ray`;
  const body = pivot(g, 0, 0, 0, 'body');
  const frame = pivot(body, 0, 0, 0, 'frame');   // (banked and pitched)
  const at = pivot(frame, 0, -L.body.mid[1], -L.body.mid[2] * 0.5, 'asset');   // (its middle on the model's origin)
  // ---------------------------------------------------------------- the joints
  const root = new THREE.Bone(); root.name = 'ray body'; at.add(root);
  const wings = L.wings.map((w) => {
    // (each joint turned at its bind to lie along its wing, raised in the reference's V: the boxes of what it carries are
    // then the wing's own, not a box round the V's diagonal, so the lock-on frames the ray tightly)
    const d = vec(w.tip).sub(vec(w.root)), bind = w.side * Math.atan2(d.y, Math.abs(d.x));
    const inner = new THREE.Bone(); inner.name = `wing ${w.side < 0 ? 'right' : 'left'}`; inner.position.copy(vec(w.root)); inner.rotation.z = bind; at.add(inner);
    const outer = new THREE.Bone(); outer.name = `${inner.name} outer`; outer.position.copy(vec(w.mid)).sub(vec(w.root)).applyAxisAngle(new THREE.Vector3(0, 0, 1), -bind); inner.add(outer);
    return { inner, outer, side: w.side, bind };
  });
  const tail1 = new THREE.Bone(); tail1.name = 'tail'; tail1.position.copy(vec(L.tail.root)); at.add(tail1);
  const tail2 = new THREE.Bone(); tail2.name = 'tail end'; tail2.position.copy(vec(L.tail.mid)).sub(vec(L.tail.root)); tail1.add(tail2);
  const bones = [root, wings[0].inner, wings[0].outer, wings[1].inner, wings[1].outer, tail1, tail2];
  // ---------------------------------------------------------------- the dress, on the wings' joints
  const dress = [], wingAt = (w, u, out = 0) => vec(w.root).lerp(vec(w.tip), u).add(new THREE.Vector3(0, out, 0));
  L.wings.forEach((w, i) => {
    const b = 1 + i * 2;
    if (props.has('patches')) for (const u of [0.3, 0.62]) { const q = wingAt(w, u, 0.04); dress.push({ geometry: new THREE.BoxGeometry(0.22, 0.02, 0.2).rotateZ(w.side * 0.9).translate(q.x, q.y, q.z + 0.05), bone: u > 0.5 ? b + 1 : b, colour: P.spots }); }
    if (props.has('wire')) dress.push({ geometry: tube(vec(w.root).add(new THREE.Vector3(0, 0.05, 0.12)), wingAt(w, 0.5, 0.05).add(new THREE.Vector3(0, 0, 0.1)), 0.012), bone: b, colour: P.tail });
    if (props.has('facets')) for (const u of [0.35, 0.55, 0.75]) { const q = wingAt(w, u, 0.06); dress.push({ geometry: new THREE.OctahedronGeometry(0.07, 0).translate(q.x, q.y, q.z), bone: u > 0.5 ? b + 1 : b, colour: P.spots }); }
    if (props.has('ribbons')) { const q = vec(w.tip); dress.push({ geometry: new THREE.PlaneGeometry(0.08, 0.9).rotateX(-Math.PI / 2).translate(q.x, q.y - 0.05, q.z - 0.45), bone: b + 1, colour: P.spots }); }
  });
  const topM = M.mat('top', '#ffffff', { side: THREE.DoubleSide, lineWhite: dark, ...look() });
  const sm = new THREE.SkinnedMesh(partGeometry(prep, 'body', key, colours, dress), topM); sm.name = 'storm ray'; sm.frustumCulled = false; at.add(sm);
  const tailM = M.mat('tail', '#ffffff', { side: THREE.DoubleSide, lineWhite: dark, ...look() });
  const tailMesh = new THREE.SkinnedMesh(partGeometry(prep, 'tail', key, colours), tailM); tailMesh.name = 'tail'; tailMesh.frustumCulled = false; at.add(tailMesh);
  // the eyes where the painted ones were (prepare.mjs painted those out): dark, a little proud of the head's sides, on
  // the body's joint; the gaze slides them on toward him
  const eyeM = M.own('eye', P.eye, { glow: 0.6 });
  const eyeGeos = L.eyes.filter(Boolean).map((e) => {
    const p = vec(e.at), nrm = normalNear(prep.pieces.body.geometry, p, 0.05, new THREE.Vector3(e.side, 0, 0)), r = Math.max(0.025, e.size[1] * 0.55);
    return new THREE.SphereGeometry(r, 10, 8).scale(0.7, 1, 0.45).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm)).translate(...p.addScaledVector(nrm, 0.008).toArray());
  });
  const eyesGeo = mergedPlain(eyeGeos), mid = eyesGeo.boundingBox.getCenter(new THREE.Vector3()); eyesGeo.translate(-mid.x, -mid.y, -mid.z);
  const eyes = add(root, eyesGeo, eyeM, mid.x, mid.y, mid.z); eyes.name = 'eyes';
  const gaze = [gazePart(g, eyes, { mode: 'slide', slide: 0.03 })];
  const nose = pivot(root, 0, L.body.mid[1], L.body.nose, 'nose');
  const barb = pivot(tail2, ...vec(L.tail.end).sub(vec(L.tail.mid)).toArray(), 'tail tip');
  const mist = props.has('mist') ? Array.from({ length: 4 }, (_, i) => add(g, new THREE.SphereGeometry(0.2 - i * 0.03, 8, 6), M.mat('mist', '#ffffff', { flat: true }))) : [];
  for (const m of mist) m.userData.noGround = true;
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones)); tailMesh.bind(sm.skeleton);
  boneBoxes(sm, bones); boneBoxes(tailMesh, bones);
  const long = props.has('long') ? 1.55 : 1;
  if (long > 1) tail1.scale.set(1, 1, long);   // (the abyss ray's long tail)
  // (built gliding, its wings let down from the bind's raised V: a body seen before its first frame, the lock-on's framing,
  // a gallery's, is the ray as it flies)
  for (const w of wings) w.inner.rotation.z = w.bind - w.side * WING_DOWN;
  g.updateMatrixWorld(true);
  // ---------------------------------------------------------------- its motion
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const bank = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0), pitch = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0), yaw = new SecondOrderAngle(1.5, 0.8, 0);
  const tailYaw = new SecondOrder(2.4, 0.5, 0), tailLift = new SecondOrder(3, 0.55, 0);
  const prev = { x: null, z: 0, speed: 0, heading: 0 };
  let sweepK = 0, raise = 0, lashK = 0, grounded = 0;
  const _w = new THREE.Vector3(), _m = new THREE.Matrix4();
  return {
    group: g, gaze, body, wave, wings: [sm], parts: [sm, tailMesh, ...wings.map((w) => w.inner), tail1], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.top, P.under, P.spots],
    tripo: 'storm ray', wingBones: wings, skinned: [sm, tailMesh],
    tell: (id) => (id === 'lash' ? barb : id === 'draft' ? wings[1].outer : nose),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      g.position.y += f.alt;
      // its motion: speed, turn rate, acceleration (in the foes' space)
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      const speed = Math.min(12, Math.hypot(vx, vz)), acc = (speed - prev.speed) / dt;
      const hd = yaw.update(dt, f.heading), turn = Math.atan2(Math.sin(f.heading - prev.heading), Math.cos(f.heading - prev.heading)) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z; prev.speed = speed; prev.heading = f.heading;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      // the skim: wings swept back, the beat stilled, banking round onto its line; the draft: wings raised high
      sweepK = ease(sweepK, id === 'skim' && (wind || strike) ? (wind ? c.wind : 1) : 0, 8, dt);
      raise = ease(raise, id === 'draft' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 7, dt);
      lashK = ease(lashK, id === 'lash' ? (wind ? c.wind : strike ? -1 : 0) : 0, strike ? 20 : 9, dt);
      // (on the ground stunned, or coming down to it defeated: no banking into the defeat's spin, wings flat; issue #304)
      grounded = ease(grounded, (f.stunned > 0 || f.dying) && f.alt < 0.6 ? 1 : 0, 6, dt);
      const B = PL.body, flying = 1 - grounded;
      const b = bank.update(dt, THREE.MathUtils.clamp(-turn * Math.max(speed, 2) * B.bank, -B.bankMax, B.bankMax) * flying + (id === 'skim' && wind ? Math.sin(c.wind * Math.PI) * 0.5 : 0));
      const pt = pitch.update(dt, THREE.MathUtils.clamp(acc * B.pitch, -0.3, 0.3) * flying);
      frame.rotation.set(pt + P0.pitch * flying, hd - f.heading, b + P0.roll, 'YXZ');
      body.position.set(0, P0.y * flying - grounded * Math.max(0, f.alt - 0.25), P0.z * flying);
      // the wave across the span: faster with speed and through the draft's beats, stilled in the skim's sweep and on the
      // ground; the wings let down from the reference's V as it glides, raised back to it and past it for the draft,
      // flat on the ground
      const W = PL.wing, rate = lerp(W.rate[0], W.rate[1], Math.min(1, speed / 6)) * (1 + raise * 0.8);
      wave.update(dt, rate * (1 - sweepK * 0.85) * flying);
      const down = lerp(WING_DOWN, -0.25, raise) * flying + (WING_DOWN + 0.35) * grounded;
      wings.forEach((w) => {
        const s = w.side, amp = W.amp * 2.2 * (1 - sweepK * 0.8) * flying + raise * 0.25;
        w.inner.rotation.set(0, s * sweepK * 0.5, w.bind - s * (down - wave.angle(0, amp, 0)));
        w.outer.rotation.set(0, 0, -s * (-wave.angle(1, amp * 0.8, W.lag * 1.6) + grounded * 0.15));
      });
      // the tail: trailing its turns, lifted high for the lash and cracking down
      tail1.rotation.set(tailLift.update(dt, lashK > 0 ? -lashK * 1.1 : -lashK * 0.6 + 0.04 * Math.sin(c.now / 400)) * (1 - grounded * 0.7), tailYaw.update(dt, THREE.MathUtils.clamp(-turn * 0.25, -0.5, 0.5)), 0);
      tail2.rotation.set(lashK > 0 ? -lashK * 0.5 : -lashK * 0.4, Math.sin(c.now / 260) * 0.08 * flying, 0);
      if (mist.length) { g.updateMatrixWorld(true); const back = _m.copy(g.matrixWorld).invert(); mist.forEach((m, i) => { barb.getWorldPosition(_w).applyMatrix4(back); m.position.copy(_w).add(new THREE.Vector3(0, 0, -0.25 * i)); m.scale.setScalar(1 + Math.sin(c.now / 300 + i) * 0.2); }); }
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (grounded > 0.5 && Math.random() < 0.15) c.dust(f.pos, '#cdb89a', 1, 1);
    },
    dispose() { M.dispose(); eyesGeo.dispose(); for (const m of mist) m.geometry.dispose(); },
  };
}

/** A tube from a to b (the scrap ray's wire). */
function tube(a, b, r) {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 5);
  return g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
}
/** Plain geometries (position, normal) merged: the eyes. */
function mergedPlain(geos) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) { const arr = new Float32Array(flat.reduce((t, g) => t + g.attributes[k].array.length, 0)); let o = 0; for (const g of flat) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, 3)); }
  out.computeBoundingBox();
  return out;
}
