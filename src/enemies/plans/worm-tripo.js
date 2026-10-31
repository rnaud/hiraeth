import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { PathTrail, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, pivot, merged, lerp, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { wormLegacyModel } from './burrower-legacy.js';

// The dune worm (issue #800): the game's `worm`, the mound worm, the ambusher, everywhere it is fielded (the Desert, the
// Glass Dunes, the Buried Machine, the Arena, the gallery). Its body is Tripo's (task 4cea24a8-…, from the approved image,
// references/enemy-redesign-2026-10-30/dune-worm/ca727e90-…-3.png: a fat segmented grub, ochre above and cream along the
// inside of its curl, a round turquoise mouth on the front of its head, a cream crown on top, two small black eyes), made into
// the game's asset by the family F trial's prepare-worm.mjs (references/enemy-redesign-2026-10-30/trials/familyF-tripo/: the
// game's frame, a metre thick, 3.7 m along its measured spine, 13k triangles, its four parts cut by geometry, the reference's
// flat colours, the painted eyes painted out) and shipped by scripts/tripo/ship-body.mjs as public/enemies/worm/body.glb.
//
// Its rig, the long body's (as the centipede's, family A): a chain of bones along the measured spine, each vertex shared by
// the two round its place on it; the head its own bone at the spine's end, turned to the traveller (the author's rule,
// #800), its eyes and the ring of teeth inside its mouth on it. Up, the chain stands out of its hole as the legacy's stack of
// rings did, tail down in the sand (what is under the sand bunched up close under it), bent by the pose (a lean toward you,
// a rear back) with a slow wave running up it, risen on a spring that dips first and slumping back slowly; under, it is
// gone and the legacy's mounds of turned sand follow the head's path (PathTrail) with the fin on the first.
//
// Its wind-ups (src/telegraph.js), from the body alone, as the legacy's:
//   erupt   under: the mound stops and trembles and the fin sinks as it swims to where you stand (Foe.swimTo)
//   spit    up: it rears back and swells, its segments bunching, the mouth widening; then coughs a spray of grit
//   dive    up: it leans over toward you and the teeth round its mouth spin, then down it goes
// Skins (src/enemies/skins.js): the Desert's dune worm (the reference's colours) with its tall fin, the Buried Machine's
// slate-violet drill grub with a steel drill on its crown, the Glass Dunes' glass worm with a crystal crest.
// Where the body is not loaded, the legacy worm (plans/burrower-legacy.js) stands in.

/** The shipped body, under public/. */
export const WORM_BODY = 'enemies/worm/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function wormSource() { const S = foeSource('worm'); return S ? (S.worm ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The worm's builder (src/enemies/plans/index.js): the Tripo body, or the legacy worm where it is not loaded. */
export function wormModel(skin) {
  const src = wormSource();
  return src ? tripoWormModel(skin, src) : wormLegacyModel(skin);
}

/** The reference's flat colours (prepare-worm.mjs PALETTE): the home skin's (skins.js SKINS.worm.desert). */
export const WORM_ROLES = { body: '#e5bb68', belly: '#f1ebba', mouth: '#33927f', throat: '#0f1a12' };
export const WORM = {
  bones: 2,       // the spine's points a bone (every 0.24 m)
  head: 2.45,     // m: the head's middle over the hole, standing straight up
  bend: 2.6,      // m of it under the head that the pose bends (the rest stands straight, down in the sand)
  sunk: 2.8,      // m it goes down as it dives (its head under the sand)
  sand: -0.35,    // m: under this, what is in the sand is bunched up close under it (never far down through a floor)
  headTurn: { yaw: 0.45, up: 0.25, down: 0.3 },
  blend: [0.55, 0.12],   // m back from the spine's end over which a vertex goes over to the head
};

const CACHE = new WeakMap();
/** The spine's bones and the weights of one source geometry (worked out once). */
function weigh(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const L = src.landmarks, sp = L.spine, keep = sp.filter((_, i) => i % WORM.bones === 0 || i === sp.length - 1);
  // (the last two a step apart only: the one before the head's middle dropped, or the last bone carries nothing)
  if (keep.length > 2 && keep[keep.length - 1] === sp[sp.length - 1] && (sp.length - 1) % WORM.bones) keep.splice(keep.length - 2, 1);
  const len = [0]; for (let i = 1; i < keep.length; i++) len.push(len[i - 1] + Math.hypot(keep[i][0] - keep[i - 1][0], keep[i][1] - keep[i - 1][1], keep[i][2] - keep[i - 1][2]));
  const end = len[len.length - 1], n = keep.length;
  // each bone's rest heading in the y-z plane (rad above level, toward +z), from its neighbours
  const rest = keep.map((_, i) => { const a = keep[Math.max(0, i - 1)], b = keep[Math.min(n - 1, i + 1)]; return Math.atan2(b[1] - a[1], b[2] - a[2]); });
  const P = src.geometry.attributes.position, nv = P.count, SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), s = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const p = [P.getX(v), P.getY(v), P.getZ(v)];
    let best = { d: Infinity, s: 0 };
    for (let i = 1; i < n; i++) {
      const a = keep[i - 1], b = keep[i], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2));
      const d = Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t);
      if (d < best.d) best = { d, s: len[i - 1] + t * Math.sqrt(L2) };
    }
    s[v] = best.s;
    let k = 0; while (k < n - 2 && len[k + 1] < best.s) k++;
    const t = THREE.MathUtils.clamp((best.s - len[k]) / (len[k + 1] - len[k]), 0, 1);
    const h = THREE.MathUtils.smoothstep(best.s, end - WORM.blend[0], end - WORM.blend[1]);
    const w = [[k, (1 - t) * (1 - h)], [k + 1, t * (1 - h)], [n, h]].filter(([, x]) => x > 1e-4);
    const sum = w.reduce((q, [, x]) => q + x, 0);
    w.forEach(([b, x], j) => { SI[v * 4 + j] = b; SW[v * 4 + j] = x / sum; });
  }
  const out = { keep, len, end, rest, SI, SW, s };
  CACHE.set(src.geometry, out);
  return out;
}

/** The worm's body (the model contract of plans/index.js), from the loaded source (wormSource). */
export function tripoWormModel(skin, src) {
  const PL = PLANS.burrower, L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('worm', skin);
  const prep = weigh(src), n = prep.keep.length;
  const g = new THREE.Group(); g.name = `${skin.name} · dune worm`;
  // ---------------------------------------------------------------- the bones: the spine's chain, the head on its end
  const column = pivot(g, 0, 0, 0, 'column');   // (what a blow pushes and tips: src/foe-react.js, the whole chain)
  const bones = prep.keep.map((p, i) => pivot(column, p[0], p[1], p[2], `spine ${i}`));
  const H = L.head, top = bones[n - 1];
  const headRoot = pivot(top, H[0] - prep.keep[n - 1][0], H[1] - prep.keep[n - 1][1], H[2] - prep.keep[n - 1][2], 'head');
  const headGaze = gazePart(g, headRoot, { mode: 'turn', ...WORM.headTurn });
  const head = headGaze.node;
  const toHead = (x, y, z) => [x - H[0], y - H[1], z - H[2]];   // (rest points into the head's frame)
  // ---------------------------------------------------------------- the meshes: one a part, on one skeleton
  const geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  const PARTS = { body: M.mat('body', P.body, { color2: P.body2 }), belly: M.mat('belly', P.belly ?? P.fin), mouth: M.mat('mouth', P.mouth, { flat: true }), throat: M.mat('throat', P.throat ?? '#14100c', { flat: true }) };
  const meshes = Object.entries(L.parts).filter(([, [, count]]) => count > 0).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), PARTS[part]);
    sm.name = `worm ${part}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- on the head: the eyes, the teeth in the mouth, the skin's crown
  const eyeM = M.own('eye', P.eye, { glow: 0.8 });
  const eyes = add(head, merged(L.eyes.map((e) => new THREE.SphereGeometry(0.05, 10, 8).scale(0.6, 1, 0.6).translate(...toHead(e.at[0] + Math.sign(e.at[0]) * 0.012, e.at[1], e.at[2])))), eyeM);
  eyes.name = 'eyes';
  const Mo = L.mouth, face = pivot(head, ...toHead(Mo.at[0], Mo.at[1], Mo.at[2]), 'mouth');
  const teeth = pivot(face, 0, 0, Math.max(-0.08, (Mo.deep ?? Mo.at[2] - 0.08) - Mo.at[2]) + 0.03, 'teeth');
  const teethM = M.mat('teeth', P.teeth, { flat: true });
  add(teeth, merged(Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return new THREE.ConeGeometry(0.04, 0.12, 4).rotateZ(-a + Math.PI).translate(Math.sin(a) * Mo.r * 0.78, Math.cos(a) * Mo.r * 0.78, 0); })), teethM).name = 'teeth';
  const crownY = L.top - H[1];
  let drill = null;
  if (props.has('drill')) { drill = add(head, new THREE.ConeGeometry(0.22, 0.6, 8), M.mat('drill', P.teeth, { metal: 'iron' }), 0, crownY + 0.22, -0.05); drill.name = 'drill'; }
  if (props.has('crest')) add(head, merged(Array.from({ length: 5 }, (_, k) => new THREE.OctahedronGeometry(0.11, 0).scale(0.7, 2.2, 0.7).rotateX(-0.3 + k * 0.12).translate(0, crownY - 0.02 + Math.sin(k) * 0.03, -0.45 + k * 0.15))), teethM).name = 'crest';
  // ---------------------------------------------------------------- the sand: the hole it stands in; under, the mounds on its path and the fin
  const sandM = M.mat('sand', P.sand);
  const hole = add(g, new THREE.TorusGeometry(0.62, 0.14, 6, 20).rotateX(Math.PI / 2), sandM, 0, 0.04, 0);
  const holder = pivot(g, 0, 0, 0, 'mounds (path space)');
  holder.matrixAutoUpdate = false;
  const mounds = Array.from({ length: PL.spine.mounds }, (_, i) => { const k = lerp(1, 0.4, i / (PL.spine.mounds - 1)); return add(holder, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.6 * k, 0.42 * k, 0.42 * k), sandM); });
  const finM = M.mat('fin', P.fin, { flat: true, lineWhite: true, side: THREE.DoubleSide });
  const finH = props.has('fin') ? 1.2 : 0.95;
  const fin = add(g, new THREE.ConeGeometry(0.4, finH, 4).scale(0.35, 1, 1), finM, 0, finH * 0.45, 0);
  const ripple = add(g, new THREE.RingGeometry(0.84, 1, 28).rotateX(-Math.PI / 2), M.mat('ripple', P.fin, { flat: true, side: THREE.DoubleSide }), 0, 0.05, 0);
  const gaze = [headGaze];
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([...bones, head]);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, [...bones, head], prep.SI, RENDER_FRAME); }
  // ---------------------------------------------------------------- motion
  const trail = new PathTrail({ spacing: 0.08, length: PL.spine.mounds * PL.spine.spacing + 1 });
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const rise = new SecondOrder(PL.body.rise.f, PL.body.rise.z, PL.body.rise.r, 0);
  const lean = new SecondOrder(PL.body.spring.f, PL.body.spring.z, PL.body.spring.r, 0);
  const wave = new Wave(Math.random());
  const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4();
  const end = prep.end, bend0 = end - WORM.bend;
  let shiver = 0, swell = 0, spin = 0, up = 0;
  const parts = [...meshes, eyes, fin, ...mounds];
  return {
    group: g, gaze, body: column, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.body, P.sand, P.ring],
    trail, mounds, tripo: 'tripo',
    tell: (id) => (id === 'erupt' ? fin : face),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // up or under: it rises on a spring that dips first (the sand heaves, then it stands up); it slumps back slowly
      const upMove = f.atk?.up && (wind || strike);
      const want = upMove ? 1 : f.buried ? 0 : f.state === 'recover' && f.atk?.dives ? 0 : 1;
      up = Math.max(0, Math.min(1.25, rise.update(dt, want)));
      const shown = Math.min(1, up);
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      swell = ease(swell, id === 'spit' && wind ? c.wind : 0, 8, dt);
      spin = ease(spin, id === 'dive' && wind ? c.wind : 0, 10, dt);
      const slump = f.state === 'recover' ? 0.3 * (1 - (c.recovery ?? 0)) : f.state === 'idle' && !f.provoked ? 0.15 : 0;
      const bend = lean.update(dt, P0.pitch + slump + (f.stunned > 0 ? 0.5 : 0));
      wave.update(dt, 0.5 + (wind ? 1.2 : 0));
      // the chain up out of the hole: from its tail (straight down in the sand) to its head, each bone at its own length
      // along the column, the column bent over its top part by the lean and the wave, its segments bunched as it swells
      const squeeze = 1 - swell * 0.25;
      let y = WORM.head - end + (end - bend0) * (1 - squeeze) - (1 - shown) * WORM.sunk, z = 0, s0 = 0, a = 0;
      for (let i = 0; i < n; i++) {
        const s = prep.len[i], u = THREE.MathUtils.clamp((s - bend0) / WORM.bend, 0, 1), ds = (s - s0) * (s > bend0 ? squeeze : 1);
        const a1 = bend * Math.pow(u, 1.3) + wave.angle(i, 0.04, 0.6) * u;
        y += Math.cos((a + a1) / 2) * ds; z += Math.sin((a + a1) / 2) * ds; a = a1; s0 = s;
        const b = bones[i], under = y < WORM.sand;
        b.position.set(0, under ? WORM.sand + (y - WORM.sand) * 0.08 : y, z + P0.z * u);
        b.rotation.set(prep.rest[i] - (Math.PI / 2 - a), 0, 0);
        b.scale.setScalar((under ? 0.55 : 1) * (1 + swell * 0.16 * Math.sin(Math.PI * u)));
      }
      teeth.rotation.z += dt * (2 + spin * 22);
      if (drill) drill.rotation.y += dt * (3 + spin * 25);
      face.scale.setScalar(1 + swell * 0.25);
      for (const sm of meshes) sm.visible = shown > 0.03;
      eyes.visible = teeth.visible = shown > 0.03;
      hole.visible = shown > 0.03; hole.scale.setScalar(0.6 + shown * 0.4);
      // under: the mounds on its path (in the foes' space), the fin standing taller and trembling as it winds up
      trail.update(f.pos);
      g.updateMatrix(); _inv.copy(g.matrix).invert(); holder.matrix.copy(_inv); holder.matrixWorldNeedsUpdate = true;
      const under = 1 - shown, winding = wind && f.atk?.surface;
      shiver = winding ? Math.sin(c.now / 30) * 0.08 * c.wind : 0;
      mounds.forEach((m, i) => {
        trail.at(0.1 + i * PL.spine.spacing, _a, _d);
        m.position.set(_a.x + (i === 0 ? shiver : 0), _a.y - 0.02, _a.z);
        m.rotation.y = Math.atan2(_d.x, _d.z);
        m.visible = under > 0.1;
        m.scale.setScalar(under * (1 + (i === 0 && winding ? 0.15 * c.wind : 0)));
      });
      fin.visible = ripple.visible = under > 0.08;
      fin.position.set(shiver, finH * 0.45 * under - (winding ? 0.35 * c.wind : 0), 0);
      fin.rotation.z = Math.sin(c.now / 160) * 0.12;
      ripple.scale.setScalar((1.1 + 0.18 * Math.sin(c.now / 180)) * under);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (f.buried && (c.moving || winding) && Math.random() < 0.5) c.dust(f.pos, P.sand, 2, 0.9);
      if (winding && Math.random() < 0.3 + c.wind) c.dust(f.pos, P.sand, 1 + c.wind * 3, 0.5 + c.wind * 0.6);
      if (strike && id === 'spit' && Math.random() < 0.8) c.spray(face.getWorldPosition(_a), [P.sand, P.ring], 3, 6, 9);
      if (shown > 0.05 && shown < 0.9 && Math.random() < 0.6) c.dust(f.pos, P.sand, 2, 0.8);
    },
    dispose() { M.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}
