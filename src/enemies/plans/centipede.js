import * as THREE from 'three';
import { jointedLeg } from '../../motion-kit/rig.js';
import { PLANS, poleFor } from '../../motion-kit/plans.js';
import { PathTrail, FollowChain } from '../../motion-kit/chain.js';
import { WaveLegs } from '../../motion-kit/wave-legs.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { twoBone, aim } from '../../motion-kit/ik.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 3, the centipede (docs/systems/procedural-animation.md §4): the ring centipede (docs/design/enemy-roster.md,
// archetype 3), the trapper. A long segmented body, about 5 m, with a heavy crab-like head and two pincers; coiled at
// rest, a crescent; running round you, a ring (a shape nothing else in the game makes).
//
// On the kit (phase 4, src/motion-kit/chain.js): the head is the foe; its path is kept (PathTrail) and every segment
// sits at a fixed distance back along it, so the body follows the head's path exactly and nothing slides sideways.
// Each segment carries a pair of jointed legs (two-bone IK, knees out and up) stepping in a metachronal wave that
// runs down the body on the distance travelled (src/motion-kit/wave-legs.js): the feet stay where they land.
// Its antennae lag on follow-the-leader chains; the plates rock a little over the stepping legs.
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   ring    the head lifts and turns inward, its legs ripple faster (the wave quickens), the spiral closes
//   lunge   the head rears and the front segments bunch up like a spring, then it shoots forward
// Cut from behind under two thirds of its health, its last two segments break off and run (the segment shed).
// Skins (src/enemies/skins.js): rust bands and a drill-bit head, pearl plates, teal plates with a gold head, a
// violet crescent with glowing seams, slick dark plates, copper wire wound round each segment.
// Drawn to its picked sheet: references/enemy-archetypes/centipede/sheet-1.jpg (the drill-head skin).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _knee = new THREE.Vector3(), _end = new THREE.Vector3();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _e = new THREE.Euler(), _pole = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function centipedeModel(skin) {
  const PL = PLANS.centipede, P = skin.palette, props = new Set(skin.props), M = materials('centipede', skin.id);
  const N = PL.spine.segments, SP = PL.spine.spacing, RIDE = 0.6;   // (the body's centre: a tube about a metre thick, as tall as the traveller's chest)
  const g = new THREE.Group(); g.name = skin.name;
  const plateM = M.mat('plate', P.plate, { color2: P.plate2 }), underM = M.mat('under', P.under), legM = M.mat('leg', P.leg), darkM = M.mat('dark', P.dark, { flat: true, lineWhite: P.dark && props.has('glow') });
  const headM = M.mat('head', P.head, { color2: P.plate2, metal: props.has('gold') ? 'brass' : undefined }), accentM = M.own('accent', P.accent, { glow: props.has('glow') ? 0.7 : 0.1 });
  const eyeM = M.own('eye', P.eye, { glow: 0.85 }), rimM = M.mat('rim', P.plate2);
  // the body lives in the foes' space (its segments on the path), so its parts hang from a holder the anim keeps at
  // the group's inverse: the group itself is placed at the head by Foes.look
  const holder = pivot(g, 0, 0, 0, 'body (path space)');
  // the head: a heavy wedge with a crab's brow, two curved pincers, eyes, antennae on chains
  const head = pivot(holder, 0, RIDE, 0, 'head');
  // (the sheet's: a domed helmet of plates, a collar band, round eyes at its sides, and two great crab claws as
  // jaws, the upper and the lower, opening up and down round a drill)
  const skull = add(head, new THREE.SphereGeometry(1, 16, 12).scale(0.5, 0.46, 0.5), headM, 0, 0.02, 0.02);
  add(head, new THREE.TorusGeometry(0.47, 0.06, 6, 20), accentM, 0, 0, -0.2);   // (the collar)
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.075, 8, 6), eyeM, s * 0.4, 0.12, 0.26));
  const jaw = (up) => {
    const p = pivot(head, 0, up * 0.16, 0.36, up > 0 ? 'upper claw' : 'lower claw');
    const c = tube(p, [[0, 0, 0], [0, up * 0.2, 0.3], [0, up * 0.14, 0.62], [0, -up * 0.06, 0.8]], up > 0 ? 0.13 : 0.11, headM, 0.03);
    for (let k = 0; k < 3; k++) add(p, new THREE.ConeGeometry(0.035, 0.12, 4), darkM, 0, up * (0.08 - k * 0.02) - up * 0.06, 0.32 + k * 0.14).rotation.x = up > 0 ? Math.PI : 0;   // (teeth on the inner edge)
    return p;
  };
  const pincers = [jaw(1), jaw(-1)];
  if (props.has('drill')) { const d = add(head, new THREE.ConeGeometry(0.14, 0.5, 8).rotateX(Math.PI / 2), M.mat('drill', '#a8b0b4', { metal: 'iron' }), 0, 0, 0.62); d.userData.drill = true; }
  const tip = pivot(head, 0, 0, 0.95);   // (where the lunge's glow gathers, between the pincer tips)
  const antRoots = pair((s) => pivot(head, s * 0.18, 0.4, 0.15, 'antenna root'));
  const antennae = pair(() => new FollowChain({ n: 4, length: 0.16, maxBend: 0.5, straighten: 3 }));
  const antRods = pair(() => Array.from({ length: 4 }, () => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 1, 5).translate(0, 0.5, 0), darkM); holder.add(r); return r; }));
  // the segments: a domed plate each, a pale underside, a dark band; a pair of legs each
  const segs = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), w = i < N - 3 ? lerp(1, 0.86, u) : lerp(0.8, 0.45, (i - (N - 3)) / 2);   // (tapering at the tail)
    const seg = pivot(holder, 0, RIDE, 0, `segment ${i}`);
    // a rounded tube of plate (the sheet's), a rim at each end, a broad coloured band round every other one
    const plate = add(seg, new THREE.SphereGeometry(1, 16, 10).scale(0.46 * w, 0.44 * w, 0.22), plateM, 0, 0, 0);
    add(seg, new THREE.CylinderGeometry(0.43 * w, 0.43 * w, 0.26, 16).rotateX(Math.PI / 2), plateM, 0, 0, 0);
    add(seg, new THREE.SphereGeometry(1, 10, 6).scale(0.36 * w, 0.18 * w, 0.18), underM, 0, -0.3 * w, 0);
    const band = add(seg, new THREE.CylinderGeometry(0.455 * w, 0.455 * w, 0.12, 16).rotateX(Math.PI / 2), (i % 2 === 0) && (props.has('bands') || props.has('glow') || props.has('gold')) ? accentM : rimM, 0, 0, 0.04);
    if (props.has('wire')) for (let k = 0; k < 3; k++) add(seg, new THREE.TorusGeometry(0.3 * w, 0.014, 4, 16), accentM, 0, 0.02, -0.12 + k * 0.08).scale.set(1, 0.72, 1);
    if (props.has('pearl')) add(seg, new THREE.SphereGeometry(0.06 * w, 8, 6), accentM, 0, 0.21 * w, 0);
    if (props.has('slick') && i % 2 === 0) add(seg, new THREE.SphereGeometry(0.04, 6, 4).scale(1, 1.6, 1), accentM, 0.2 * w, 0.1, 0.05);
    segs.push({ seg, plate, w });
  }
  // the tail's two cerci, on the last segment
  const cerci = [add(segs[N - 1].seg, new THREE.ConeGeometry(0.2, 0.6, 10).rotateX(-Math.PI / 2), plateM, 0, 0, -0.38)];   // (the pointed tail)
  // the legs: a pair per segment, hip at the plate's side, foot out on the ground; jointedLeg chains hung from the
  // group (their segments aimed in write()), stepping on WaveLegs
  const legs = [];
  for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
    const w = segs[i].w, hip = { x: s * 0.26 * w, y: -0.3 * w, z: 0.02 }, foot = { x: s * (0.26 * w + 0.32), z: 0.06 };
    const d = Math.hypot(foot.x - hip.x, RIDE + hip.y - 0.03);
    const L = jointedLeg({ group: g, body: segs[i].seg, hip, foot, lenA: d * PL.legs.lenA, lenB: d * PL.legs.lenB, pole: poleFor('out-up', foot), radius: 0.032, pad: 'point', mats: { joint: legM, thigh: legM, shin: darkM, foot: darkM }, name: `centipede leg ${legs.length}` });
    L.seg = i; L.side = s; L.restLocal = new THREE.Vector3(foot.x, 0, foot.z);
    legs.push(L);
  }
  const legLen = legs[0].lenA + legs[0].lenB;
  const wave = new WaveLegs({ n: legs.length, stride: PL.legs.stride, duty: PL.legs.duty, height: PL.legs.height * legLen, lag: PL.legs.lag, seed: (serial++ * 0.618034) % 1 });   // (two side by side out of step)
  const trail = new PathTrail({ spacing: 0.06, length: 0.6 + N * SP + 1 });
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const roll = new SecondOrder(PL.body.spring.f, PL.body.spring.z, PL.body.spring.r);
  finish(g);
  const segPos = Array.from({ length: N }, () => new THREE.Vector3()), segDir = Array.from({ length: N }, () => new THREE.Vector3(0, 0, 1));
  const spine = Array.from({ length: N + 1 }, () => new THREE.Vector3());   // (head and segments in the foes' space: Foes.corral's wall)
  let seeded = false, lastWalked = 0, arc = 0, bunch = 0, lift = 0, turn = 0, shed = 0, pinch = 0;
  // the rig the motion audit reads (scripts/motion-audit/walk.mjs): its legs and their length; update/write are timed by --cost
  const rig = { legs, length: legLen, update: () => {}, write: () => {}, wave, trail };
  /** The seed shape: a crescent behind the head, curling round (coiled at rest). */
  const coil = (head0, heading) => (s) => {
    const R = 1.15, a = s / R;   // (a circle of radius R behind the head, turning left)
    const bx = -Math.sin(heading), bz = -Math.cos(heading), lx = Math.cos(heading), lz = -Math.sin(heading);
    return { x: head0.x + (Math.sin(a) * bx + (1 - Math.cos(a)) * lx) * R, z: head0.z + (Math.sin(a) * bz + (1 - Math.cos(a)) * lz) * R };
  };
  return {
    group: g, body: head, rig, parts: [skull, ...pincers, ...segs.map((s) => s.seg), ...legs.map((l) => l.root)], eyeMat: eyeM, base: P.eye, size: 1, skin: skin.id, tones: [P.plate, P.under, P.head],
    spine,
    tell: (id) => (id === 'ring' ? eyes[0] : tip),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      if (!seeded) { trail.seed(f.pos, f.wilds && !f.provoked ? coil(f.pos, f.heading) : (s) => ({ x: f.pos.x - Math.sin(f.heading) * s, z: f.pos.z - Math.cos(f.heading) * s })); seeded = true; }
      trail.update(f.pos);
      // the group is placed at the head by Foes.look; the holder undoes it, so the parts are laid out in the foes' space
      g.updateMatrix(); _inv.copy(g.matrix).invert();
      holder.matrixAutoUpdate = false; holder.matrix.copy(_inv); holder.matrixWorldNeedsUpdate = true;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      // the lunge: the front segments bunch up behind the rearing head (they crowd forward along the path), then spring
      bunch = ease(bunch, id === 'lunge' ? (wind ? c.wind : 0) : 0, 10, dt);
      lift = ease(lift, id === 'ring' && wind ? 1 : id === 'lunge' && wind ? c.wind : 0, 6, dt);
      // the ring: the head turns inward, toward where you stood
      let inward = 0;
      if (id === 'ring' && wind) { const a = Math.atan2(f.attackAt.x - f.pos.x, f.attackAt.z - f.pos.z); inward = Math.atan2(Math.sin(a - f.heading), Math.cos(a - f.heading)) * Math.min(1, c.wind * 1.5) * 0.7; }
      turn = ease(turn, inward, 8, dt);
      pinch = ease(pinch, wind ? c.wind : strike ? 1 - c.release : 0, 14, dt);
      // shed segments (cut off behind: f.shed)
      shed = f.shed ?? 0;
      // the segments along the path
      for (let i = 0; i < N; i++) {
        const back = 0.55 + i * SP * (1 - (i < 4 ? bunch * 0.35 * (1 - i / 4) : 0));
        trail.at(back, segPos[i], segDir[i]);
      }
      // the head, on its own spot on the path, lifted and turned by the pose
      head.position.set(f.pos.x, f.pos.y + RIDE + P0.y + lift * 0.18, f.pos.z);
      trail.at(0, _a, _d);
      const hy = (Math.hypot(_d.x, _d.z) > 1e-6 ? Math.atan2(_d.x, _d.z) : f.heading) + turn + P0.yaw;
      head.rotation.set(P0.pitch - lift * 0.35, hy, 0, 'YXZ');
      // a lunge carries the head out along its heading (the strike pose's z); the body catches up on the path
      head.position.x += Math.sin(hy) * P0.z; head.position.z += Math.cos(hy) * P0.z;
      spine[0].copy(head.position);
      const stepRate = id === 'ring' && wind ? 1.6 : 1;
      const walked = trail.travelled;
      arc += (walked - lastWalked) * stepRate;   // (the legs' clock: the distance, quickened through the ring's wind-up)
      for (let i = 0; i < N; i++) {
        const S = segs[i], p = segPos[i], dir = segDir[i];
        const ground = c.ground?.(p.x, p.y + 1, p.z);
        const y = Number.isFinite(ground) ? ground : p.y;
        // the plates rock a little over their legs (a sideways roll that runs down the body with the wave)
        const r = Math.sin((walked / PL.legs.stride) * Math.PI * 2 - i * PL.legs.lag) * 0.06 * Math.min(1, (walked - lastWalked) / Math.max(dt, 1e-3) / 2);
        S.seg.position.set(p.x, y + RIDE - (i < 3 ? (1 - i / 3) * lift * -0.08 : 0), p.z);
        S.seg.rotation.set(0, Math.atan2(dir.x, dir.z), r, 'YXZ');
        S.seg.visible = i < N - shed;
        spine[i + 1].copy(S.seg.position);
      }
      roll.update(dt, 0);
      lastWalked = walked;
      // the pincers: open through a wind-up, snapping shut in the strike
      pincers.forEach((p, i) => { p.rotation.x = (i ? 1 : -1) * (pinch * 0.5 - (strike ? 0.45 * c.release : 0)); });   // (the claws gape up and down, then snap)
      if (props.has('drill')) head.children.forEach((x) => { if (x.userData.drill) x.rotation.z += dt * (wind ? 30 : 6); });
      cerci.forEach((x) => { x.visible = shed === 0; });
      // the legs: each stepping on its segment's own distance along the path (the wave runs down the body)
      g.updateMatrixWorld(true);
      wave.touches.length = 0;
      for (let k = 0; k < legs.length; k++) {
        const L = legs[k], S = segs[L.seg];
        L.root.visible = S.seg.visible;
        if (!S.seg.visible) continue;
        // its rest foot (in the foes' space) and the segment's heading
        _b.copy(L.restLocal).applyEuler(_e.set(0, S.seg.rotation.y, 0)).add(S.seg.position); _b.y = S.seg.position.y - RIDE;
        _d.set(Math.sin(S.seg.rotation.y), 0, Math.cos(S.seg.rotation.y));
        const sArc = arc - (0.55 + L.seg * SP);
        const foot = wave.update(k, sArc, _b, _d, c.ground);
        // two-bone IK from the hip (in the group's frame) to the planted foot (foes' space → group frame)
        matrixToGroup(L.hip, g, _m); _a.setFromMatrixPosition(_m);
        _end.copy(foot).applyMatrix4(_inv); _end.y += L.ankle;
        _pole.copy(L.pole).applyAxisAngle(UP, S.seg.rotation.y - f.heading);
        twoBone(_a, _end, L.lenA, L.lenB, _pole, _knee, _end);
        L.root.position.copy(_a);
        _knee.sub(_a); _end.sub(_a);
        aim(L.thigh, ZERO, _knee); aim(L.shin, _knee, _end);
        L.foot.position.copy(_end); L.foot.position.y -= L.ankle;
      }
      if (c.touch) for (const t of wave.touches) if (Math.random() < 0.08) c.touch(t.at, legLen, t.leg);
      // the antennae lag behind the head on their chains
      antRoots.forEach((r, i) => {
        _a.setFromMatrixPosition(matrixToGroup(r, holder, _m));   // (in the holder: the foes' space)
        _d.set(Math.sin(hy + (i ? -0.5 : 0.5)), 0.5, Math.cos(hy + (i ? -0.5 : 0.5)));
        const pts = antennae[i].update(_a, _d, dt);
        antRods[i].forEach((m, j) => { _b.copy(pts[j]); _end.copy(pts[j + 1]); m.position.copy(_b); m.scale.set(1, _b.distanceTo(_end), 1); _end.sub(_b).normalize(); m.quaternion.setFromUnitVectors(UP, _end); });
      });
      accentM.uniforms.uGlow.value = (props.has('glow') ? 0.7 : 0.1) + (id === 'ring' && wind ? c.wind * 0.6 : 0);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}
const ZERO = new THREE.Vector3();
let serial = 0;
/** obj's matrix in the group's frame (its local matrices up to the group). */
function matrixToGroup(obj, group, out) {
  out.identity();
  for (let o = obj; o && o !== group; o = o.parent) { if (o.matrixAutoUpdate) o.updateMatrix(); out.premultiply(o.matrix); }
  return out;
}
