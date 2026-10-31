import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, pivot, lerp, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { tripoBody, piece, pick, rolesOf, roleColours, boneBoxes, normalNear } from './flyer-body.js';
import { mothModel as signalMothModel } from './signal-moth-legacy.js';

// The lamp moth (issue #800, family B): the game's `moth`, everywhere it is fielded (its worlds, the Arena, the
// creatures gallery). Its body is Tripo's (task 3c2ccaf8-…, from the approved image,
// references/enemy-redesign-2026-10-30/lamp-moth/5b88e9ea-…-1.png), made into the game's asset by the trial's prepare.mjs
// (references/enemy-redesign-2026-10-30/trials/moth-tripo/: the game's frame and size, 12k triangles, cut by geometry into
// its body, head, wings and eye-spots, six flat colours) and shipped by scripts/tripo/ship-flyer.mjs as
// public/enemies/lamp-moth/body.glb. The signal moth it replaces (the ribbed paper lantern on kite wings and six thread
// legs) is kept as plans/signal-moth-legacy.js: it stands in where the body is not loaded, and can come back as a foe of
// its own.
//
// A flyer has no legs: its rig is its own, rigid parts on the plan's own motion (the skill's table's nearest family,
// the machine's, the wings blended at their roots). The body (the orange egg, its feet and shoulder nubs) is one mesh on
// the frame; each wing (upper and lower lobe) hangs on a hinge at the back of the shoulder, an inner joint there and an
// outer one half way out, beating about the upright on the plan's travelling wave (the outer lags the inner) and swept
// back as it flies, its root's few centimetres held on the frame so the joint stays closed; the eye-spots are cut out of
// the wings exactly round their cream (their own mesh on the wings' joints: they blaze for the flash); the head turns on
// its neck (the gaze's), its antennae on joints of their own that trail its motion.
//
// Its look at you (the author's rule, #800): the painted eyes are painted out of the texture, and two dark eyes of their
// size stand in their place on the head; the head turns to the traveller (the gaze, src/enemies/gaze.js; yaw only, about
// the neck's own axis, so the cut at the neck stays shut) and the eyes go red as it winds up.
//
// Its wind-ups (src/telegraph.js), from the body alone, as the signal moth's:
//   flash   it snaps both wings open flat toward you and holds them, still, the eye-spots burning white
//   dart    its wings fold back tight behind the body and it tips forward, nose down; then it dives
//   dust    (the lamp moth, the Antennas' moth) it hangs right over you fanning fast, dust sifting off its wings
// Three come together (the archetype's group), light and flinchy as before.
//
// Skins (src/enemies/skins.js): the home skin (the lamp moth, Lorn II) wears the reference's colours from the texture;
// every other skin recolours the mesh's roles from its palette (vertex colours) and keeps its dress: the glass wasp's
// slimmer body and no eye-spots, the sign moth's neon-inked wings with their painted letters, the signal moth's dish
// antennae, the space moth's colours. The engines (Unity) decode no picture: there the home skin is drawn by its vertex
// colours too.

/** The shipped body, under public/. */
export const LAMP_MOTH_BODY = 'enemies/lamp-moth/body.glb';
const body0 = tripoBody(LAMP_MOTH_BODY, 'lamp moth', () => {
  // (the engines' host reads public/; Node, its files; a browser fetches it in load)
  const host = globalThis.__HIRAETH_HOST__;
  if (host?.readFile) return host.readFile(LAMP_MOTH_BODY);
  const fs = globalThis.process?.getBuiltinModule?.('node:fs');
  return fs ? fs.readFileSync(new URL(`../../../public/${LAMP_MOTH_BODY}`, import.meta.url)) : null;
});
/** The loaded body (null until loaded; the engines and Node read it on first use). */
export const lampMothSource = body0.source;
/** The body, loaded once: the game awaits it before it builds its foes (src/main.js); a failed load leaves the signal moth. */
export const loadLampMothBody = body0.load;
/** Stand a source in (a test's, a trial's), or null to forget it. */
export const setLampMothSource = body0.set;

/** The moth's builder (src/enemies/plans/index.js): the Tripo body, or the signal moth where it is not loaded. */
export function lampMoth(skin) {
  const src = lampMothSource();
  return src ? tripoMothModel(skin, src) : signalMothModel(skin);
}

/** The flat texture's colours by role (prepare.mjs PALETTE: the approved image's). */
const ROLES = { wing: '#b3a7c3', spot: '#f5e8c3', body: '#e7aa6e', head: '#f3ead0', nub: '#a4574a', dark: '#2b2620' };
/** Where the body's middle stands over the model's origin (m): the signal moth's lantern's, so it fights at its height. */
const BODY_Y = 0.78;
const ROOT_HOLD = 0.07;   // m of a wing's root held on the frame (the hinge's blend)

const vec = (a) => new THREE.Vector3(...a);
const smooth = THREE.MathUtils.smoothstep;

/** The egg's half-width at height y (its fitted ellipsoid), and the wings' hinge, at the body's side at the hinge's height. */
const halfWidth = (L, y) => { const B = L.body, t = (y - B.centre[1]) / B.radii[1]; return B.radii[0] * Math.sqrt(Math.max(0.04, 1 - t * t)); };
const hingeX = (L) => halfWidth(L, L.wings[1].hinge[1]) * 0.92;

// ---------------------------------------------------------------------------------------------- the weights
const CACHE = new WeakMap();
/**
 * The wings' and the head's weights, once a source. Wing bones: 0 the frame, 1–2 the left wing's inner and outer, 3–4
 * the right's. Head bones: 0 the head, 1–2 the antennae. A wing's root is the frame's for ROOT_HOLD out from its hinge,
 * then the inner joint's, passing to the outer from 45 % to 70 % of the way to its tip; an antenna's from its root up.
 */
function prepare(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, n = geo.attributes.position.count, P = geo.attributes.position;
  const WI = new Uint16Array(n * 4), WW = new Float32Array(n * 4), HI = new Uint16Array(n * 4), HW = new Float32Array(n * 4);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    // a wing's
    // (held from the body's own side at that height, the egg's half-width: what lies behind the body stays with it)
    const w = L.wings[p.x < 0 ? 0 : 1], s = w.side, d = s * p.x - halfWidth(L, p.y), u = (s * p.x - hingeX(L)) / (s * w.tip[0] - hingeX(L));
    const root = 1 - smooth(d, 0, ROOT_HOLD), outer = (1 - root) * smooth(u, 0.45, 0.7), inner = 1 - root - outer, b = p.x < 0 ? 1 : 3;
    const ws = [[0, root], [b, inner], [b + 1, outer]].sort((x, y) => y[1] - x[1]);
    ws.forEach(([j, x], k) => { WI[i * 4 + k] = j; WW[i * 4 + k] = x; });
    // the head's
    const a = L.antennae[p.x < 0 ? 0 : 1];
    const t = a ? smooth(p.y, a.root[1] - 0.02, a.root[1] + 0.06) * (Math.abs(p.x - L.head.centre[0]) > 0.015 ? 1 : 0) : 0, ab = p.x < 0 ? 1 : 2;
    if (t >= 0.5) { HI[i * 4] = ab; HW[i * 4] = t; HI[i * 4 + 1] = 0; HW[i * 4 + 1] = 1 - t; } else { HI[i * 4] = 0; HW[i * 4] = 1 - t; HI[i * 4 + 1] = ab; HW[i * 4 + 1] = t; }
  }
  const roles = rolesOf(geo, ROLES);
  const pieces = Object.fromEntries(['body', 'head', 'wings', 'spots'].map((k) => [k, piece(geo, [L.parts[k]], new THREE.Vector3(), ['position', 'normal', 'uv', 'color'])]));
  for (const k of ['wings', 'spots']) { pieces[k].geometry.setAttribute('skinIndex', pick(new THREE.BufferAttribute(WI, 4), pieces[k].from)); pieces[k].geometry.setAttribute('skinWeight', pick(new THREE.BufferAttribute(WW, 4), pieces[k].from)); }
  pieces.head.geometry.setAttribute('skinIndex', pick(new THREE.BufferAttribute(HI, 4), pieces.head.from)); pieces.head.geometry.setAttribute('skinWeight', pick(new THREE.BufferAttribute(HW, 4), pieces.head.from));
  // (skin indices as integers: pick wrote floats)
  for (const k of ['wings', 'spots', 'head']) { const a = pieces[k].geometry.attributes.skinIndex; pieces[k].geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(a.array, Math.round), 4)); }
  const out = { roles, pieces, skins: new Map() };
  CACHE.set(src.geometry, out);
  return out;
}

/** A part's geometry in a skin's colours (null: its own COLOR_0, the texture's), with the skin's dress merged in, cached. */
function partGeometry(prep, part, key, colours, dress = []) {
  const k = `${part}.${key}`, hit = prep.skins.get(k); if (hit) return hit;
  const P = prep.pieces[part];
  let g = P.geometry;
  if (colours || dress.length) {
    g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(P.geometry.attributes)) g.setAttribute(name, a);
    if (colours) g.setAttribute('color', pick(colours, P.from));
    g.setIndex(P.geometry.index);
    if (dress.length) g = mergeDress(g, dress);
  }
  prep.skins.set(k, g);
  return g;
}
/** A skinned part and its dress (each piece: { geometry, bone, colour }) merged, non-indexed. */
function mergeDress(base, dress) {
  const flat = base.toNonIndexed(), parts = [flat];
  for (const d of dress) {
    const g = d.geometry.index ? d.geometry.toNonIndexed() : d.geometry, n = g.attributes.position.count, c = new THREE.Color(d.colour);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
    if (flat.attributes.skinIndex) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: n }, () => [d.bone, 0, 0, 0]).flat(), 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [1, 0, 0, 0]).flat(), 4)); }
    parts.push(g);
  }
  const out = new THREE.BufferGeometry();
  for (const k of Object.keys(flat.attributes)) {
    const list = parts.map((g) => g.attributes[k]), size = list[0].itemSize, A = list[0].array.constructor, arr = new A(list.reduce((t, a) => t + a.count * size, 0));
    let o = 0; for (const a of list) for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) arr[o++] = a.getComponent(i, c);
    out.setAttribute(k, new THREE.BufferAttribute(arr, size, list[0].normalized));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- the body
/** The moth's body (the model contract of plans/index.js), from the loaded source (lampMothSource). */
export function tripoMothModel(skin, src) {
  const PL = PLANS.flyer, L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('moth', skin);
  const home = skin.id === 'perdide2', textured = home && !!src.map, wasp = props.has('wasp'), neon = props.has('neon');
  const prep = prepare(src);
  const colours = textured ? null : (prep.colours ??= new Map()).get(skin.id) ?? prep.colours.set(skin.id, roleColours(prep.roles, { wing: P.wing, spot: P.glow, body: P.body, head: P.wing2, nub: P.spot, dark: P.antenna }, ROLES)).get(skin.id);
  const key = textured ? 't' : skin.id;
  const g = new THREE.Group(); g.name = `${skin.name} · lamp moth`;
  const body = pivot(g, 0, BODY_Y, 0, 'body');
  const frame = pivot(body, 0, 0, 0, 'frame');   // (tilted with its acceleration; tipped forward to dart)
  const at = pivot(frame, 0, -L.body.centre[1], 0, 'asset');   // (the asset's own frame: its feet on its y 0)
  const look = () => (textured ? { map: src.map } : { vertexColors: true });
  // ---------------------------------------------------------------- the body: one mesh on the frame
  const lanternM = M.own('lantern', '#ffffff', { glow: props.has('lit') ? 0.4 : 0.25, ...look() });
  const bodyMesh = add(at, partGeometry(prep, 'body', key, colours), lanternM); bodyMesh.name = 'lantern';
  if (wasp) bodyMesh.scale.set(0.82, 1.06, 0.95);   // (the glass wasp's slimmer body)
  // ---------------------------------------------------------------- the wings: hinged at the shoulder, an inner and an outer joint
  const wingBones = L.wings.map((w) => {
    // (its hinge at the body's side, behind it: the root turns about where it leaves the body)
    const inner = new THREE.Bone(); inner.name = `wing ${w.side < 0 ? 'right' : 'left'}`; inner.position.set(w.side * hingeX(L), w.hinge[1], w.hinge[2]); at.add(inner);
    const outer = new THREE.Bone(); outer.name = `${inner.name} outer`; outer.position.set((w.tip[0] - w.side * hingeX(L)) * 0.55, 0, 0); inner.add(outer);
    return { inner, outer, side: w.side };
  });
  // (the frame's own bone: what the wings' roots are held on)
  const hold = new THREE.Bone(); hold.name = 'shoulders'; at.add(hold);
  const wingSkeleton = [hold, wingBones[0].inner, wingBones[0].outer, wingBones[1].inner, wingBones[1].outer];
  // the sign moth's painted letters on the inner wing, in its spot colour
  const letters = props.has('letters') ? L.wings.flatMap((w, i) => [0, 1, 2].map((j) => ({ geometry: new THREE.PlaneGeometry(0.035, 0.11).translate(w.hinge[0] + w.side * (0.12 + j * 0.07), w.hinge[1] - 0.08, w.z + 0.012), bone: 1 + i * 2, colour: P.spot }))) : [];
  const wingM = M.mat('wing', '#ffffff', { side: THREE.DoubleSide, lineWhite: neon, ...look() });
  const wingMesh = new THREE.SkinnedMesh(partGeometry(prep, 'wings', key, colours, letters), wingM); wingMesh.name = 'wings'; wingMesh.frustumCulled = false; at.add(wingMesh);
  const spotM = M.own('spot', P.glow, { glow: 0.5, side: THREE.DoubleSide });
  const spotMesh = new THREE.SkinnedMesh(prep.pieces.spots.geometry, spotM); spotMesh.name = 'eye-spots'; spotMesh.frustumCulled = false; at.add(spotMesh);
  // (the glass wasp has none: its spots' place painted as its wings, unlit)
  if (wasp) { spotM.uniforms.uColor.value.set(P.wing); spotM.uniforms.uGlow.value = 0; }
  const spotTell = pivot(wingBones[1].inner, ...vec(L.spots[1].mid).sub(wingBones[1].inner.position).toArray(), 'eye-spot');
  // ---------------------------------------------------------------- the head: on its neck, the gaze's; its antennae
  const headPivot = pivot(at, L.head.centre[0], L.neck, L.head.centre[2], 'head');
  const ants = L.antennae.map((a, i) => { const b = new THREE.Bone(); b.name = `antenna ${i ? 'left' : 'right'}`; b.position.copy(vec(a.root)).sub(headPivot.position); headPivot.add(b); return b; });
  // the eyes where the painted ones were (prepare.mjs painted those out): dark, round, a little proud of the head
  const eyeM = M.own('eye', P.eye, { glow: 0.3 });
  const eyeGeos = L.eyes.filter(Boolean).map((e) => {
    const p = vec(e.at), nrm = normalNear(prep.pieces.head.geometry, p, 0.03, new THREE.Vector3(0, 0, 1)), r = Math.max(0.018, Math.max(...e.size) * 0.6);
    return new THREE.SphereGeometry(r, 10, 8).scale(1, 1.15, 0.5).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm)).translate(...p.addScaledVector(nrm, 0.006).sub(headPivot.position).toArray());
  });
  const eyes = add(headPivot, mergedPlain(eyeGeos), eyeM); eyes.name = 'eyes';
  // (the head's mesh in the head's own frame: moved to the neck)
  const hoodM = M.mat('hood', '#ffffff', { lineWhite: neon, ...look() });
  const dishes = props.has('dish') ? L.antennae.map((a, i) => ({ geometry: new THREE.CylinderGeometry(0.06, 0.015, 0.025, 12).translate(a.tip[0], a.tip[1] + 0.02, a.tip[2]), bone: 1 + i, colour: P.antenna })) : [];
  const headMesh = new THREE.SkinnedMesh(partGeometry(prep, 'head', key, colours, dishes), hoodM); headMesh.name = 'head'; headMesh.frustumCulled = false; at.add(headMesh);
  const gaze = [gazePart(g, headPivot, { mode: 'turn', yaw: 0.7, up: 0.06, down: 0.06 })];
  finish(g);
  g.updateMatrixWorld(true);
  const headBones = [gaze[0].node, ...ants];
  wingMesh.bind(new THREE.Skeleton(wingSkeleton)); spotMesh.bind(wingMesh.skeleton);
  headMesh.bind(new THREE.Skeleton(headBones));
  for (const sm of [wingMesh, spotMesh, headMesh]) boneBoxes(sm, sm.skeleton.bones);
  // ---------------------------------------------------------------- its motion
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const tilt = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0);
  const antSway = ants.map(() => [new SecondOrder(2.2, 0.35, 0), new SecondOrder(2.2, 0.35, 0)]);
  const prev = { x: null, z: 0, speed: 0 };
  let open = 0, fold = 0, flutter = 0, gone = 0;
  const glowBase = props.has('lit') ? 0.4 : 0.25;
  return {
    group: g, gaze, body, wave, wings: [wingMesh], parts: [bodyMesh, headPivot, ...wingBones.map((w) => w.inner)], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.wing, P.body, P.spot],
    tripo: 'lamp moth', wingBones, skinned: [wingMesh, spotMesh, headMesh],
    tell: (id) => (id === 'flash' ? spotTell : headPivot),
    /** Going down (src/enemies/defeat.js): its wings stop beating and fold back over its body as it spirals down. */
    defeat(f, c, u) {
      const k = smooth(u, 0.1, 0.6); gone = k;
      wingBones.forEach((w) => { const s = w.side; w.inner.rotation.y = lerp(w.inner.rotation.y, s * 1.6, k); w.inner.rotation.z = lerp(0, -s * 0.4, k); w.outer.rotation.y = lerp(w.outer.rotation.y, s * 0.2, k); });
      lanternM.uniforms.uGlow.value *= 1 - k * 0.8;
    },
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      const speed = Math.min(10, Math.hypot(vx, vz)), acc = (speed - prev.speed) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z; prev.speed = speed;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      open = ease(open, id === 'flash' && wind ? c.wind : 0, 16, dt);       // (snapped open flat toward you)
      fold = ease(fold, id === 'dart' && (wind || strike) ? 1 : 0, 12, dt); // (folded back tight behind the body)
      flutter = ease(flutter, id === 'dust' && wind ? 1 : 0, 8, dt);
      const B = PL.body, bob = Math.sin(c.now / 300 + f.home.z) * B.bob;
      g.position.y += f.alt - 0.5 + bob;   // (its feet just over its footing when it comes down)
      // upright, leaning a little into its flight and its braking; tipped forward to dart
      const lean = tilt.update(dt, THREE.MathUtils.clamp(acc * B.pitch + speed * 0.03, -B.pitchMax, B.pitchMax));
      frame.rotation.set(lean + P0.pitch * 0.5 + fold * 0.9, 0, P0.roll);
      body.position.set(0, BODY_Y + P0.y, P0.z);
      // the beat: about the upright, by speed, quicker in a flutter; the wings half swept back as it flies, wide open
      // toward you for the flash (still), folded back behind it for the dart
      const W = PL.wing;
      wave.update(dt, lerp(W.rate[0], W.rate[1], Math.min(1, speed / 4)) * (1 + flutter * 0.8) * (1 - open) * (1 - fold * 0.9));
      if (!f.dying) {
        const rest = lerp(0.85, 0.08, open) + fold * 0.75;   // (rad swept back from facing you)
        wingBones.forEach((w) => {
          const s = w.side, amp = W.amp * 0.55 * (1 - open) * (1 - fold);
          w.inner.rotation.set(0, s * (rest + wave.angle(0, amp, 0)), 0);
          w.outer.rotation.set(0, s * (wave.angle(1, amp * 0.45, W.lag) + fold * 0.3), 0);
        });
      }
      // the antennae trail its motion, lagging, and quiver as it fans
      ants.forEach((a, i) => {
        const q = Math.sin(c.now / 90 + i) * 0.06 * (flutter + open * 0.5);
        a.rotation.set(antSway[i][0].update(dt, THREE.MathUtils.clamp(-acc * 0.03 - speed * 0.04, -0.5, 0.4) + q), 0, antSway[i][1].update(dt, (i ? -1 : 1) * (0.05 + Math.sin(wave.phase * Math.PI * 2) * 0.04)));
      });
      // the eye-spots burn white through the flash's wind-up
      if (!wasp) { spotM.uniforms.uGlow.value = 0.5 + open * 0.5; spotM.uniforms.uColor.value.set(open > 0.6 ? '#ffffff' : P.glow); }
      lanternM.uniforms.uGlow.value = (glowBase + open * 0.3 + flutter * 0.2) * (1 - gone * 0.8);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#f05a3c'));
      if (flutter > 0.3 && Math.random() < 0.5) c.dust(f.chest, P.wing2, 1, 0.5);
    },
    dispose() { M.dispose(); eyes.geometry.dispose(); },
  };
}

/** Plain geometries (position, normal) merged: the eyes. */
function mergedPlain(geos) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) { const arr = new Float32Array(flat.reduce((t, g) => t + g.attributes[k].array.length, 0)); let o = 0; for (const g of flat) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, 3)); }
  out.computeBoundingBox();
  return out;
}
