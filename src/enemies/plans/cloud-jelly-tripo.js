import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { VerletChain, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, pivot, lerp, ease, eyeColor, finish, merged } from './kit.js';
import { gazePart } from '../gaze.js';
import { foeSource } from '../foe-assets.js';
import { subset, piece, pick, rolesOf, roleColours, boneBoxes, normalNear } from './flyer-body.js';
import { jellyModel as lanternJellyModel } from './lantern-jelly-legacy.js';

// The cloud jelly (issue #800, family B): the game's `jelly`, everywhere it is fielded (its worlds, the Arena, the
// creatures gallery). Its body is Tripo's (task b9a1a819-…, from the approved image,
// references/enemy-redesign-2026-10-30/cloud-jelly/0cdfba00-…-1.png), made into the game's asset by the trial's
// prepare.mjs (references/enemy-redesign-2026-10-30/trials/jelly-tripo/: the game's frame and size, 12k triangles, the
// cap cut along its lip and each lantern's bulb across its neck, four flat colours) and shipped by
// scripts/tripo/ship-flyer.mjs as public/enemies/cloud-jelly/body.glb (its 512² flat texture, COLOR_0, the landmarks).
// The lantern jelly it replaces (the paper-lantern bell on its threads) is kept as plans/lantern-jelly-legacy.js: it
// stands in where the body is not loaded, and can come back as a foe of its own.
//
// A floater has no legs: its rig is its own, rigid parts on the plan's own motion (the nearest family of the skill's
// table, the machine's, its joints blended): the cap on the bell's joint (it pulses, clenches, squashes), its skirt and
// stems on the same joint at the top; each curled arm on its own joint at its root under the lip; each lantern on its
// own joint at the stem's root under the cap, swinging as a damped pendulum (trailing its drift, rocked by the pulse),
// the stem weighted from the bell at the top to the lantern at the bulb so it bends; the bulb its own mesh on the
// lantern's joint (its light its own: a ward swells it, a shot pops it). The skirt, stems and arms are one skinned mesh
// (two influences a vertex, normalised), the cap one mesh, each bulb one.
//
// Its look at you (the author's rule, #800): the painted eyes are painted out of the texture, and two dark ovals of
// their size stand in their place a little proud of the cap, their own mesh on the bell; the gaze (src/enemies/gaze.js)
// slides them toward the traveller (they go orange as it winds up), and its heading turns it to face him.
//
// Its wind-ups (src/telegraph.js), from the body alone, as the lantern jelly's:
//   ward     a lantern swells and brightens, the bell pulsing faster; then a thread of light runs to the foe it guards
//   mend     (tier-2 skins) it sinks low over a hurt foe, its lanterns pouring light
//   curtain  the cap clenches, the arms curl in and the lanterns are drawn up under it; then stinging threads drop from
//            its skirt to the ground for two seconds (the threads show only then: the reference draws none)
// A shot or the boomerang pops a lantern (the ward it held ends): Foe.pop; it goes, stem and bulb.
//
// Skins (src/enemies/skins.js): the home skin (the cloud jelly, Vael II) wears the reference's colours from the
// texture; every other skin recolours the mesh's roles from its palette (vertex colours), paints its cap with the skin's
// `bell` surface and its bulbs with its `light` (src/enemies/surfaces.js) and wears its dress: the lamp jelly's brass
// caps on each lantern, the halo jelly's prism lanterns and halo, the porcelain jelly's glass floats in their nets and
// glaze, the sun jelly's glowing core.
//
// Every skin draws its vertex colours (the home skin's are the flat texture's own colours, COLOR_0), in the browser as in
// the engines (their VMs decode no picture), as the other generated bodies of src/enemies/foe-assets.js do.

/** The shipped body, under public/ (loaded by src/enemies/foe-assets.js, its landmarks.json beside it). */
export const CLOUD_JELLY_BODY = 'enemies/cloud-jelly/body.glb';
const ADAPT = new WeakMap();
let forced;
/** The loaded body as this builder reads it ({ geometry, landmarks, map: null }), or null (not loaded: the lantern jelly stands in). */
export function cloudJellySource() {
  if (forced !== undefined) return forced;
  const src = foeSource('jelly');
  if (!src) return null;
  if (!ADAPT.has(src)) ADAPT.set(src, { geometry: src.geometry, landmarks: src.rig, map: null });
  return ADAPT.get(src);
}
/** Stand a source in (a test's), null for none (the lantern jelly), or undefined to go back to the loaded one. */
export function setCloudJellySource(src) { forced = src; }

/** The jelly's builder (src/enemies/plans/index.js): the Tripo body, or the lantern jelly where it is not loaded. */
export function cloudJelly(skin) {
  const src = cloudJellySource();
  return src ? tripoJellyModel(skin, src) : lanternJellyModel(skin);
}

/** The flat texture's colours by role (prepare.mjs PALETTE: the approved image's). */
const ROLES = { cap: '#efdcb4', green: '#8fa984', bulb: '#e3a07e', dark: '#2a2a22' };
/** Where the bell's bottom stands over the model's origin (m): the lantern jelly's, so it fights at the same height. */
const BELL_Y = 0.6;
/** The curtain's stinging threads: how many hang round the skirt, their links (shown only in the curtain). */
const TH = { n: 8, links: 6 };
const BLEND = 0.12;   // m over which an arm's root passes from the bell to the arm

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const vec = (a) => new THREE.Vector3(...a);
const smooth = THREE.MathUtils.smoothstep;

// ---------------------------------------------------------------------------------------------- the weights
const CACHE = new WeakMap();
/**
 * The skin part's weights, once a source (every jelly shares them): bone 0 the bell, 1–2 the arms, 3–5 the lanterns.
 * A stem passes from the bell at its root to its lantern at the neck; an arm from the bell to the arm over BLEND.
 */
function prepare(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3(), major = new Uint8Array(n);
  const lan = L.lanterns.map((l) => ({ root: vec(l.root), neck: vec(l.neck) }));
  const seg = new THREE.Vector3(), rel = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    let b0 = 0, b1 = 0, w = 1;
    const arm = L.arms.findIndex((a) => a.side * p.x > Math.abs(a.root[0]) - 0.05 && p.y < L.lip.y && Math.hypot(p.x - a.mid[0], p.y - a.mid[1], p.z - a.mid[2]) < a.radius * 1.1);
    if (arm >= 0) {
      const t = (L.arms[arm].side * p.x - (Math.abs(L.arms[arm].root[0]) - 0.05)) / BLEND;
      b0 = 1 + arm; b1 = 0; w = smooth(t, 0, 1);
    } else if (p.y < L.lip.y - 0.02) {
      // the nearest stem (its root to its neck), the part along it
      let best = -1, d = Infinity, along = 0;
      lan.forEach((l, k) => { seg.subVectors(l.neck, l.root); const t = THREE.MathUtils.clamp(rel.subVectors(p, l.root).dot(seg) / seg.lengthSq(), 0, 1.5); const e = rel.copy(l.root).addScaledVector(seg, Math.min(1, t)).distanceTo(p); if (e < d) { d = e; best = k; along = t; } });
      if (best >= 0 && d < 0.42) { b0 = 3 + best; b1 = 0; w = smooth(along, 0.05, 0.95); }
    }
    if (w < 0.5) { [b0, b1] = [b1, b0]; w = 1 - w; }
    SI[i * 4] = b0; SW[i * 4] = w; SI[i * 4 + 1] = b1; SW[i * 4 + 1] = 1 - w; major[i] = b0;
  }
  const roles = rolesOf(geo, ROLES);
  // the cap (its origin at the lip) and each bulb (its origin its middle) as geometries of their own
  const cap = piece(geo, [L.parts.cap], new THREE.Vector3(0, -L.lip.y, 0));
  const bulbs = L.lanterns.map((l, k) => ({ ...piece(geo, [L.parts[`bulb${k}`]], vec(l.mid).negate(), ['position', 'normal', 'uv', 'color']), skins: new Map() }));
  const out = { SI, SW, major, roles, skins: new Map(), colours: new Map(), cap, bulbs };
  CACHE.set(src.geometry, out);
  return out;
}

/**
 * The skinned part's geometry in a skin (cached a skin: every jelly of a world shares it): the skirt, stems and arms
 * (their colours: the texture's on the home skin, the skin's over the roles elsewhere) and the skin's dress on the
 * lanterns (brass caps, a float's net), weighted to the lantern it hangs on.
 */
function skinGeometry(src, prep, skin, P, props, textured) {
  const key = `${skin.id}.${textured ? 't' : 'c'}`, hit = prep.skins.get(key); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, [first, count] = L.parts.skin;
  const colour = textured ? null : skinColour(prep, skin, P);
  const base = subset(geo, [[first, count]], { position: geo.attributes.position, normal: geo.attributes.normal, uv: geo.attributes.uv,
    color: colour ?? geo.attributes.color, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) });
  // the dress, in the body's frame, each piece on its lantern (bone 3 + k), its colour
  const dress = [];
  const put = (g, bone, hex) => {
    const n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; si[i * 4] = bone; sw[i * 4] = 1; }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    dress.push(g);
  };
  L.lanterns.forEach((l, k) => {
    const mid = vec(l.mid), r = l.radius, top = vec(l.neck), bot = vec(l.bottom), q = new THREE.Quaternion().setFromUnitVectors(UP, vec(l.axis).negate());
    if (props.has('brass')) {
      // (the lamp jelly: a brass collar at the neck and a brass foot under the bulb)
      put(new THREE.CylinderGeometry(r * 0.55, r * 0.7, 0.07, 14).applyQuaternion(q).translate(top.x, top.y, top.z), 3 + k, P.lantern);
      put(new THREE.CylinderGeometry(r * 0.5, r * 0.32, 0.09, 14).applyQuaternion(q).translate(bot.x, bot.y + 0.05, bot.z), 3 + k, P.lantern);
    }
    if (props.has('float')) {
      // (the porcelain jelly: each glass float in a net, a ring round its middle and two hoops over it)
      put(new THREE.TorusGeometry(r * 1.01, 0.018, 5, 22).rotateX(Math.PI / 2).applyQuaternion(q).translate(mid.x, mid.y, mid.z), 3 + k, P.dark);
      for (const a of [0, Math.PI / 2]) put(new THREE.TorusGeometry(Math.hypot(r, (top.y - bot.y) / 2) * 0.86, 0.012, 4, 22).scale(r / Math.hypot(r, (top.y - bot.y) / 2) / 0.86 * 1.01, (top.y - bot.y) / 2 / Math.hypot(r, (top.y - bot.y) / 2) / 0.86 * 0.98, 1).rotateY(a).applyQuaternion(q).translate(mid.x, mid.y, mid.z), 3 + k, P.dark);
    }
  });
  let g = base;
  if (dress.length) {
    const flat = base.toNonIndexed();
    g = mergeSkinned([flat, ...dress.map((d) => (d.index ? d.toNonIndexed() : d))]);
  }
  prep.skins.set(key, g);
  return g;
}
/** Skinned geometries merged (their colour, skin index and weight kept). */
function mergeSkinned(geos) {
  const keys = ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'], out = new THREE.BufferGeometry();
  for (const k of keys) {
    const parts = geos.map((g) => g.attributes[k]), size = parts[0].itemSize, A = parts[0].array.constructor;
    const arr = new A(parts.reduce((s, a) => s + a.count * size, 0)); let o = 0;
    for (const a of parts) { for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) arr[o++] = a.getComponent(i, c); }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size, parts[0].normalized));
  }
  return out;
}

/** A skin's colours over the roles (cached a skin): the cap's in its bell colour, the green in its thread, the bulbs in its light. */
function skinColour(prep, skin, P) {
  if (!prep.colours.has(skin.id)) prep.colours.set(skin.id, roleColours(prep.roles, { cap: P.bell, green: P.thread, bulb: P.light, dark: P.dark }, ROLES));
  return prep.colours.get(skin.id);
}

/** Bulb k's geometry in a skin's colours (null: the texture's, its own COLOR_0), cached a skin. */
function bulbGeometry(prep, k, colour) {
  const B = prep.bulbs[k];
  if (!colour) return B.geometry;
  if (!B.skins.has(colour)) {
    const g = new THREE.BufferGeometry();
    for (const key of ['position', 'normal', 'uv']) g.setAttribute(key, B.geometry.attributes[key]);
    g.setAttribute('color', pick(colour, B.from)); g.setIndex(B.geometry.index);
    B.skins.set(colour, g);
  }
  return B.skins.get(colour);
}

// ---------------------------------------------------------------------------------------------- the body
/** The jelly's body (the model contract of plans/index.js), from the loaded source (cloudJellySource). */
export function tripoJellyModel(skin, src) {
  const PL = PLANS.floater, L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('jelly', skin);
  const home = skin.id === 'arzach2', textured = home && !!src.map;
  const prep = prepare(src), geo = src.geometry;
  const colours = () => skinColour(prep, skin, P);
  const g = new THREE.Group(); g.name = `${skin.name} · cloud jelly`;
  const body = pivot(g, 0, 0, 0, 'body');
  const frame = pivot(body, 0, BELL_Y - L.lip.y, 0, 'frame');   // (the asset's own frame: the lanterns' tips on its y 0)
  // ---------------------------------------------------------------- the joints
  const bell = new THREE.Bone(); bell.name = 'bell'; bell.position.set(0, L.lip.y, 0); frame.add(bell);
  const arms = L.arms.map((a) => { const b = new THREE.Bone(); b.name = `arm ${a.side > 0 ? 'left' : 'right'}`; b.position.copy(vec(a.root)).sub(bell.position); bell.add(b); return b; });
  const lanterns = L.lanterns.map((l, k) => { const b = new THREE.Bone(); b.name = `lantern ${k}`; b.position.copy(vec(l.root)); frame.add(b); return b; });
  const bones = [bell, ...arms, ...lanterns];
  // ---------------------------------------------------------------- the meshes
  // (the home skin's own colours: the texture's, or where no picture is drawn (the engines) its vertex colours, the same four)
  const skinM = M.mat(textured ? 'cjTripo' : 'cjTripoTint', '#ffffff', { side: THREE.DoubleSide, ...(textured ? { map: src.map } : { vertexColors: true }) });
  // (the home skin's own colours: the source's COLOR_0, the flat texture's own; the others' over the roles)
  const sgeo = skinGeometry(src, prep, skin, P, props, home);
  const sm = new THREE.SkinnedMesh(sgeo, skinM); sm.name = 'cloud jelly skin'; sm.frustumCulled = false; frame.add(sm);
  // the cap: one colour, its skin's bell surface, on the bell's joint (the asset's frame moved to the joint)
  // (its own geometry, its origin at the lip: the skin's bell patterns sit as they did on the lantern jelly's bell)
  const bellM = M.mat('bell', P.bell, { color2: P.bell2, side: THREE.DoubleSide });
  const cap = add(bell, prep.cap.geometry, bellM); cap.name = 'cap';
  // the bulbs: each its own mesh on its lantern's joint, its origin its middle (its ribs round its own axis), its own
  // light (the ward swells one, a shot pops it); the halo jelly's are prisms of their size
  const own = [];
  const bulbs = L.lanterns.map((l, k) => {
    const at = vec(l.mid).sub(vec(l.root));
    let bg, light;
    if (props.has('prism')) {
      const h = l.neck[1] - l.bottom[1];
      bg = new THREE.OctahedronGeometry(1, 0).scale(l.radius * 0.95, h * 0.55, l.radius * 0.95); own.push(bg);
      light = M.own(`light${k}`, P.light, { glow: 0.75 });
    } else {
      bg = bulbGeometry(prep, k, home ? null : colours());
      light = M.own(`light${k}`, '#ffffff', { glow: 0.45, ...(textured ? { map: src.map } : { vertexColors: true }) });
    }
    const m = add(lanterns[k], bg, light, at.x, at.y, at.z);
    m.name = `lantern ${k}`;
    return { mesh: m, light, at };
  });
  // the eyes where the painted ones were (prepare.mjs painted those out): two dark ovals of their height, a little proud
  // of the cap along its normal there, on the bell; the gaze slides them on toward him
  const eyeM = M.own('eye', P.eye, { glow: 0.35 });
  const eyeGeos = L.eyes.filter(Boolean).map((e) => {
    // (its facing: the cap's own normal there, from the cap's surface alone, leaned out level from the cap's middle: the
    // lobe curls under just below the eyes)
    const at = vec(e.at).sub(bell.position), out = new THREE.Vector3(at.x, 0, at.z).normalize();
    const nrm = normalNear(prep.cap.geometry, at, 0.06, out).add(out).normalize(), h = Math.max(0.1, e.size[1] * 1.15);
    return new THREE.SphereGeometry(1, 10, 8).scale(h * 0.27, h * 0.5, 0.03).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm)).translate(...at.addScaledVector(nrm, 0.02).toArray());
  });
  const eyesGeo = merged(eyeGeos); eyesGeo.computeBoundingBox(); const mid = eyesGeo.boundingBox.getCenter(new THREE.Vector3()); eyesGeo.translate(-mid.x, -mid.y, -mid.z);
  const eyes = add(bell, eyesGeo, eyeM, mid.x, mid.y, mid.z); eyes.name = 'eyes';
  const gaze = [gazePart(g, eyes, { mode: 'slide', slide: 0.06 })];
  // the halo jelly's halo; the sun jelly's glowing core under the cap
  const halo = props.has('halo') ? add(bell, new THREE.TorusGeometry(0.9, 0.035, 6, 28).rotateX(Math.PI / 2), M.own('halo', P.light, { glow: 0.8 }), 0, L.crown - L.lip.y + 0.3, 0) : null;
  const core = props.has('core') ? add(bell, new THREE.SphereGeometry(0.36, 12, 8), M.own('core', P.light, { glow: 0.9 }), 0, -0.22, 0.05) : null;
  // the curtain's threads: verlet chains from round the skirt, thin rods in the foes' space, shown only in the curtain
  const threadM = M.mat('thread', P.thread, { flat: true, line: 0.3, lineTint: 0.75 });
  const holder = pivot(g, 0, 0, 0, 'threads (foes space)'); holder.matrixAutoUpdate = false;
  const threadGeo = new THREE.CylinderGeometry(0.02, 0.028, 1, 5).translate(0, 0.5, 0);
  const threads = Array.from({ length: TH.n }, (_, i) => {
    const a = (i / TH.n) * Math.PI * 2 + 0.2, r = 0.55 + (i % 2) * 0.25;
    const ch = new VerletChain({ n: TH.links, length: 0.3, stiffness: 0.6, damping: 0.9, gravity: 4 });
    const rods = Array.from({ length: TH.links }, () => { const m = new THREE.Mesh(threadGeo, threadM); m.visible = false; holder.add(m); return m; });
    return { ch, rods, root: pivot(bell, Math.sin(a) * r, -0.08, Math.cos(a) * r) };
  });
  // the ward's thread of light: a glowing rod from a lantern to the foe it guards (in the foes' space)
  const wardM = M.own('ward', P.light, { glow: 1 });
  const wardRods = bulbs.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).translate(0, 0.5, 0), wardM); m.visible = false; holder.add(m); return m; });
  finish(g);
  // (the threads rest on the ground themselves; the bulbs are the body it lands on)
  holder.traverse((o) => { o.userData.noGround = true; });
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  boneBoxes(sm, bones);
  // ---------------------------------------------------------------- its motion
  const wave = new Wave(Math.random());
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p, y: p.y ?? 0 }])), style: PL.style });
  const tiltX = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0), tiltZ = new SecondOrder(PL.body.spring.f, PL.body.spring.z, 0);
  const swing = lanterns.map(() => [new SecondOrder(1.6, 0.35, 0), new SecondOrder(1.6, 0.35, 0)]);
  const rest = lanterns.map((b) => b.position.clone());
  const prev = { x: null, z: 0 };
  let clench = 0, swell = 0, curtain = 0;
  const inFoes = (o, out) => { _m.identity(); for (let x = o; x && x !== g; x = x.parent) { if (x.matrixAutoUpdate) x.updateMatrix(); _m.premultiply(x.matrix); } return out.setFromMatrixPosition(_m.premultiply(g.matrix)); };
  const place = (rods, pts) => rods.forEach((m, j) => { m.position.copy(pts[j]); _a.subVectors(pts[j + 1], pts[j]); const l = _a.length(); m.scale.set(1, Math.max(1e-3, l), 1); if (l > 1e-6) m.quaternion.setFromUnitVectors(UP, _a.divideScalar(l)); });
  const bulbAt = (i, out) => { lanterns[i].updateMatrix(); return inFoes(lanterns[i], out).add(_d.copy(bulbs[i].at).applyQuaternion(lanterns[i].quaternion)); };
  return {
    group: g, gaze, body, wave, parts: [cap, ...bulbs.map((b) => b.mesh), ...lanterns], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.bell, P.light, P.thread],
    tripo: 'cloud jelly', skinned: sm,
    tell: (id) => (id === 'curtain' ? threads[0].root : bulbs[1].mesh),
    // (where lantern i hangs, in the foes' space: the ward's thread of light runs from it, and is cut half-way: Foes.support)
    lanternAt: (i, out = new THREE.Vector3()) => bulbAt(Math.min(i, bulbs.length - 1), out),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      const B = PL.body, P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      g.position.y += f.alt + Math.sin(c.now / 700 + f.home.x) * B.bob;
      // tilts into its drift (the velocity in its own frame)
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      body.rotation.set(tiltX.update(dt, THREE.MathUtils.clamp(fwd * B.tilt, -B.tiltMax, B.tiltMax)) + P0.pitch, 0, tiltZ.update(dt, THREE.MathUtils.clamp(-side * B.tilt, -B.tiltMax, B.tiltMax)) + P0.roll);
      body.position.y = id === 'mend' ? 0 : P0.y;   // (the mend's sink is the mind's: it comes down out of the air)
      // the pulse: its rate rises through a wind-up (the telegraph); the cap clenches for the curtain
      clench = ease(clench, id === 'curtain' && wind ? c.wind : 0, 10, dt);
      swell = ease(swell, (id === 'ward' || id === 'mend') && wind ? c.wind : 0, 8, dt);
      curtain = ease(curtain, id === 'curtain' && strike ? 1 : 0, strike ? 12 : 3, dt);
      const BL = PL.bell;
      wave.update(dt, lerp(BL.rate[0], BL.rate[1], Math.max(wind ? c.wind : 0, clench)));
      const pulse = Math.sin(wave.phase * Math.PI * 2), sq = BL.squash * 0.7;
      bell.scale.set((1 + pulse * sq) * (1 - clench * 0.18), (1 - pulse * sq * 0.7) * (1 + clench * 0.15), (1 + pulse * sq) * (1 - clench * 0.18));
      bell.position.y = L.lip.y + pulse * 0.04;
      // the arms: curled a little with each pulse, drawn in for the clench, flung out in the curtain
      arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(-0.1 * pulse - clench * 0.35, 0, s * (0.12 * pulse + clench * 0.5 - curtain * 0.35)); });
      if (core) core.scale.setScalar(1 + pulse * 0.1 + swell * 0.3);
      if (halo) halo.rotation.y += dt * 0.6;
      // the lanterns: each a damped pendulum from its root under the bell (the root riding the pulse), trailing its
      // drift and rocked by the pulse; drawn up under the cap in the clench; one popped is gone, stem and bulb
      const left = f.lanterns ?? bulbs.length;
      const lagX = THREE.MathUtils.clamp(fwd * 0.07, -0.45, 0.45), lagZ = THREE.MathUtils.clamp(-side * 0.07, -0.45, 0.45);
      lanterns.forEach((b, i) => {
        const on = i < left;
        bulbs[i].mesh.visible = on;
        b.scale.setScalar(on ? 1 + (i === (f.wards?.length ?? 0) ? swell * 0.25 : 0) + pulse * 0.03 : 1e-3);
        const r = rest[i];
        b.position.set(r.x * bell.scale.x, bell.position.y + (r.y - L.lip.y) * bell.scale.y + clench * 0.3, r.z * bell.scale.z);
        const rock = Math.sin(wave.phase * Math.PI * 2 + i * 2.1) * 0.05;
        b.rotation.set(swing[i][0].update(dt, lagX * (1 - clench) + rock), 0, swing[i][1].update(dt, lagZ * (1 - clench) - rock * 0.6));
        const warding = (f.wards ?? [])[i];
        bulbs[i].light.uniforms.uGlow.value = (props.has('prism') ? 0.75 : 0.45) + (warding ? 0.25 : 0) + (i === (f.wards?.length ?? 0) ? swell * 0.35 : 0) + (id === 'mend' && wind ? 0.3 : 0);
      });
      // the chains, in the foes' space
      g.updateMatrix(); holder.matrix.copy(_m.copy(g.matrix).invert()); holder.matrixWorldNeedsUpdate = true;
      // the curtain's threads: dropped from the skirt to the ground (the links stretched to reach it), stinging
      const show = curtain > 0.02;
      threads.forEach((t, i) => {
        t.rods.forEach((m) => { m.visible = show; });
        inFoes(t.root, _b);
        // (hidden, they wait folded at their roots: no stray box down at the ground)
        if (!show) { t.ch.ready = false; for (const m of t.rods) { m.position.copy(_b); m.scale.setScalar(1e-3); } return; }
        const reach = f.alt + BELL_Y;
        t.ch.length = Math.max(0.3, (reach * curtain) / TH.links);
        _d.set(Math.sin(i) * 0.05 - vx * 0.04, -1, Math.cos(i) * 0.05 - vz * 0.04);
        place(t.rods, t.ch.update(dt, _b, DOWN));
      });
      // the wards' threads of light to the foes they guard
      bulbs.forEach((bl, i) => {
        const warding = (f.wards ?? [])[i], R = wardRods[i];
        R.visible = i < left && !!warding && warding.alive && warding.dead === undefined;
        if (!R.visible) { bulbAt(i, R.position); R.scale.setScalar(1e-3); }   // (parked at its lantern: no stray box at the ground)
        if (R.visible) { bulbAt(i, _b); _d.subVectors(warding.chest, _b); const l = _d.length(); R.position.copy(_b); R.scale.set(1, l, 1); R.quaternion.setFromUnitVectors(UP, _d.divideScalar(l || 1)); }
      });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (id === 'mend' && wind && Math.random() < 0.6 && f.allyTarget) c.spray(f.allyTarget.chest, [P.light, '#ffffff'], 2, 1.5, -2);
    },
    // (the cap, bulbs and skin are the source's, shared by every jelly: only the prisms are its own)
    dispose() { M.dispose(); for (const x of own) x.dispose(); eyesGeo.dispose(); threadGeo.dispose(); for (const r of wardRods) r.geometry.dispose(); },
  };
}
