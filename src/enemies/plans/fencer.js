import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, many, skinBy, pivot, pair, lerp, ease, smooth, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';

// The makers' fencer (issue #665; docs/design/combat-botw-study.md ranked changes 5-8; docs/systems/foes.md "The makers'
// fencer"): a sword-and-shield duelist that fights the way the traveller does. No design sheet was picked for it: it is
// built from the roster's parts (the humanoid's biped on the kit, the makers' plates and seams of their temples), kept
// simple so it reads at play distance: a little taller than you, ivory ceramic plates over a dark frame, a narrow helm
// with one round lens, a fin on top; a tall kite shield on its left forearm with a glowing seam down it, a straight
// blade with a glowing edge in its right hand. Futuristic ancient high tech, inked like the rest (no organic parts).
//
// On the kit's `fencer` plan (src/motion-kit/plans.js): a biped on the gait planner, knees forward, planted, the body on
// stiff springs. Draws: every part of a material one skinned mesh on the kit's joints (kit.js skinBy), about eight.
//
// What the body says (src/telegraph.js; nothing on the ground):
//   guard     (f.guardK) the shield brought up square before it, the sword drawn back over its shoulder: blows from the
//             front ring off; a charged cut throws the shield wide (f.reel 'guardbroken'): arms flung out, open
//   overhead  the sword raised high over its head in its fist, the shield lowered: answer it with the side hop
//   sweep     wound round to its right, the sword low behind its hip: answer it with the back flip
//   bash      its shield shoulder drawn back: a plain guard won't hold it (parry it, or hop away)
//   leap      crouched deep behind its shield, the sword back; then it leaps high and hangs (f.alt), the sword over
//             its head, and comes down on where you stood: a side hop, a parry, or an air cut to meet it in the air
//   disarmed  (f.disarmed) its sword flies out of its hand and lies where it fell; it fights with the shield alone and
//             runs for it, bends to pick it up (f.reel 'pickup': the long opening)

const HIP_Y = 0.92, SH = { x: 0.27, y: 1.5 }, NECK = 1.58, UPPER = 0.3, FORE = 0.3;
const BLADE = 0.95;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

/** A lathe from (r, y) pairs (bottom to top), squashed front to back by `depth`. */
function lathe(profile, seg = 20, depth = 1) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (depth !== 1) geo.scale(1, 1, depth);
  geo.computeVertexNormals();
  return geo;
}
/** The kite shield's face: a tall plate rounded at the top, coming to a point below, a little curved; its long axis y, its face +z. */
export function shieldGeometry(w = 0.5, h = 0.86, t = 0.05) {
  const s = new THREE.Shape(), top = h * 0.5, low = -h * 0.5;
  s.moveTo(-w / 2, top * 0.55);
  s.quadraticCurveTo(-w / 2, top, 0, top);
  s.quadraticCurveTo(w / 2, top, w / 2, top * 0.55);
  s.lineTo(w / 2 * 0.86, low * 0.35);
  s.quadraticCurveTo(w / 2 * 0.5, low * 0.85, 0, low);
  s.quadraticCurveTo(-w / 2 * 0.5, low * 0.85, -w / 2 * 0.86, low * 0.35);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 8 });
  geo.translate(0, 0, -t / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - (x * x) * 0.55); }   // (curved round the arm)
  geo.computeVertexNormals();
  return geo;
}
/** The sword along +y from the grip: pommel, grip, cross-guard, a straight blade to a point (its edge line apart). */
function swordParts(L = BLADE) {
  const blade = new THREE.CylinderGeometry(0.012, 0.035, L, 4, 1).scale(1, 1, 0.28).rotateY(Math.PI / 4).translate(0, 0.08 + L / 2, 0);
  const tip = new THREE.ConeGeometry(0.035, 0.12, 4).scale(1, 1, 0.28).rotateY(Math.PI / 4).translate(0, 0.08 + L + 0.06, 0);
  const hilt = [new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8).translate(0, -0.03, 0), new THREE.SphereGeometry(0.035, 8, 6).translate(0, -0.13, 0),
    new THREE.BoxGeometry(0.2, 0.035, 0.05).translate(0, 0.07, 0)];
  const edge = [new THREE.BoxGeometry(0.012, L * 0.92, 0.035).translate(0, 0.1 + L * 0.46, 0)];
  return { steel: [blade, tip], hilt, edge };
}

export function fencerModel(skin) {
  const PL = PLANS.fencer, P = skin.palette, props = new Set(skin.props), M = materials('fencer', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const hull = pivot(body, 0, 0, 0, 'hull');
  // built in these; drawn as one skinned mesh a material on the moving parts' own joints (kit.js skinBy)
  const plateB = M.mat('plateBuild', P.plate), frameB = M.mat('frameBuild', P.frame), trimB = M.mat('trimBuild', P.trim);
  const steelB = M.mat('steelBuild', P.steel), seamB = M.mat('seamBuild', P.seam), shieldB = M.mat('shieldBuild', P.shield);
  const plateM = M.mat('plate', P.plate, { vertexColors: true }), frameM = M.mat('frame', P.frame, { vertexColors: true });
  const trimM = M.mat('trim', P.trim, { vertexColors: true }), shieldM = M.mat('shield', P.shield, { vertexColors: true });
  const steelM = M.own('steel', P.steel, { vertexColors: true, flat: false });
  const seamM = M.own('seam', P.seam, { vertexColors: true, glow: 0.6, hatch: 0 });
  const eyeM = M.own('eye', P.eye, { glow: 0.95 });
  // the torso: a dark frame (the waist, the spine) under ivory plates (the chest, the back, a skirt of tassets)
  add(hull, lathe([[0.12, 0.86], [0.17, 0.95], [0.15, 1.08], [0.14, 1.16], [0.17, 1.24], [0.001, 1.25]], 16, 0.8), frameB);
  add(hull, lathe([[0.001, 1.14], [0.19, 1.16], [0.25, 1.3], [0.27, 1.46], [0.22, 1.56], [0.1, 1.6], [0.001, 1.6]], 20, 0.72), plateB);
  many(hull, [new THREE.TorusGeometry(0.2, 0.02, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.78).translate(0, 1.16, 0)], trimB);
  // the chest's seam: a line of light down its middle and round under the collar (the makers' glyph-lines, not the mark)
  many(hull, [new THREE.BoxGeometry(0.025, 0.3, 0.02).translate(0, 1.33, 0.195), new THREE.TorusGeometry(0.14, 0.012, 4, 16, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI).scale(1, 1, 0.75).translate(0, 1.5, 0.04)], seamB);
  const skirt = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    skirt.push(new THREE.BoxGeometry(0.15, 0.22, 0.03).translate(0, -0.11, 0).rotateX(0.18).translate(0, 0, 0.17).rotateY(a).translate(0, 0.98, 0));
  }
  many(hull, skirt, plateB);
  // the head: a narrow helm, one round lens in a dark visor band, a fin on top
  const head = pivot(hull, 0, NECK, 0, 'head');
  add(head, new THREE.CylinderGeometry(0.06, 0.08, 0.1, 10), frameB, 0, 0.02, 0);
  add(head, lathe([[0.001, 0.04], [0.11, 0.06], [0.135, 0.16], [0.13, 0.27], [0.09, 0.34], [0.001, 0.36]], 18, 0.92), plateB);
  add(head, new THREE.CylinderGeometry(0.128, 0.13, 0.07, 18, 1, true, -1.1, 2.2).scale(1, 1, 0.95).translate(0, 0.19, 0), frameB);
  many(head, [new THREE.BoxGeometry(0.02, 0.12, 0.26).translate(0, 0.38, -0.03), new THREE.BoxGeometry(0.02, 0.06, 0.14).translate(0, 0.42, -0.1)], trimB);
  const eyes = new THREE.Group(); head.add(eyes); eyes.name = 'eyes';
  add(eyes, new THREE.SphereGeometry(0.034, 12, 8).scale(1, 1, 0.5), eyeM, 0, 0.19, 0.125);
  // the arms: a ball shoulder under a pauldron, an upper arm, an elbow, a plated forearm, a fist
  const arms = pair((s) => {
    const sh = pivot(hull, s * SH.x, SH.y, 0, 'shoulder');
    add(sh, new THREE.SphereGeometry(0.075, 10, 8), frameB);
    add(sh, new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.05, 0.9, 1).translate(s * 0.02, 0.02, 0), plateB);
    add(sh, new THREE.CylinderGeometry(0.06, 0.055, UPPER, 8).translate(0, -UPPER / 2, 0), frameB);
    const el = pivot(sh, 0, -UPPER, 0, 'elbow');
    add(el, new THREE.SphereGeometry(0.06, 8, 6), frameB);
    add(el, new THREE.CylinderGeometry(0.075, 0.06, FORE * 0.85, 10).translate(0, -FORE * 0.45, 0), plateB);
    many(el, [new THREE.TorusGeometry(0.07, 0.012, 4, 12).rotateX(Math.PI / 2).translate(0, -FORE * 0.82, 0)], trimB);
    const hand = pivot(el, 0, -FORE, 0, 'hand');
    add(hand, new THREE.SphereGeometry(0.055, 8, 6).scale(1, 1.1, 0.9), frameB);
    return { sh, el, hand, s };
  });
  const [R, Lf] = arms;   // (R: its sword arm (x < 0); Lf: its shield arm)
  // the sword in its right fist (along the grip's +y), and the one it drops (the same, its own node: f.disarmed)
  const grip = pivot(R.hand, 0, -0.02, 0, 'grip');
  const sw = swordParts(props.has('long') ? BLADE * 1.12 : BLADE);
  many(grip, sw.steel, steelB); many(grip, sw.hilt, trimB); many(grip, sw.edge, seamB);
  const dropped = pivot(g, 0, 0, 0, 'dropped sword');
  { const d = swordParts(props.has('long') ? BLADE * 1.12 : BLADE); many(dropped, [...d.steel, ...d.hilt], steelB); }
  // the shield on its left forearm, held upright before it (its own pivot keeps it upright: kept against the arm's turn)
  const strap = pivot(Lf.hand, 0, 0.12, 0.06, 'shield');
  const sh = shieldGeometry(props.has('round') ? 0.6 : 0.52, props.has('round') ? 0.66 : 0.88);
  add(strap, sh, shieldB, 0, 0, 0.11);
  // (its face: a lit seam down the middle from a brass ring at the top, two shorter ones either side of it)
  many(strap, [new THREE.BoxGeometry(0.022, 0.46, 0.02).translate(0, -0.08, 0.15), ...[-1, 1].map((s) => new THREE.BoxGeometry(0.018, 0.26, 0.02).translate(s * 0.1, -0.02, 0.14))], seamB);
  many(strap, [new THREE.TorusGeometry(0.07, 0.018, 5, 16).translate(0, 0.2, 0.15), new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1, 0.5).translate(0, 0.2, 0.15)], trimB);
  // (the Signal Market's banner: a pennant down the back; the Space City's antenna fin)
  if (props.has('pennant')) many(hull, [new THREE.BoxGeometry(0.22, 0.55, 0.01).translate(0, 1.18, -0.21)], trimB);
  // the legs on the kit: dark thighs, ivory shin plates, flat plated feet
  const legs = pair((s) => planLeg(PL, { group: g, body, hipParent: hull, hip: { x: s * 0.12, y: HIP_Y, z: 0 }, foot: { x: s * 0.16, z: 0.02 },
    radius: 0.06, balls: 0.8, taper: 0.25, pad: 'pad', ankle: 0.06, mats: { joint: frameB, thigh: frameB, shin: frameB, foot: frameB }, name: `fencer leg ${s > 0 ? 'left' : 'right'}` }));
  for (const L of legs) {
    many(L.thigh, [new THREE.CylinderGeometry(0.07, 0.085, L.lenA * 0.6, 10).translate(0, L.lenA * 0.45, 0.01)], plateB);
    many(L.shin, [new THREE.CylinderGeometry(0.075, 0.06, L.lenB * 0.75, 10).translate(0, L.lenB * 0.5, 0.012), new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.8, 1.1).translate(0, L.lenB * 0.93, 0.03)], plateB);
    many(L.foot, [new THREE.BoxGeometry(0.11, 0.06, 0.24).translate(0, 0.04, 0.06), new THREE.BoxGeometry(0.1, 0.03, 0.08).translate(0, 0.075, 0.13)], plateB);
  }
  const rig = new Rig({ plan: PL, group: g, body, legs });
  const gaze = [gazePart(g, head, { mode: 'turn' })];
  const sets = skinBy(g, [
    { from: [plateB], into: plateM }, { from: [frameB], into: frameM }, { from: [trimB], into: trimM },
    { from: [shieldB], into: shieldM }, { from: [steelB], into: steelM }, { from: [seamB], into: seamM },
  ]);
  finish(g);
  for (const o of [eyes]) o.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [hull, head, ...arms.flatMap((a) => [a.sh, a.el, a.hand]), strap, grip, ...legs.map((l) => l.root)];
  const lagS = new SecondOrder(3.2, 0.5, 0.2);   // (the shield's servo: a little overshoot as it comes up)
  let guard = 0, broke = 0, glow = 0, pick = 0;
  const local = new THREE.Vector3();
  return {
    group: g, gaze, body: hull, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.plate, P.seam, P.frame],
    tell: (id) => (id === 'bash' || id === 'shove' ? strap : grip),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const W = wind ? c.wind : 0, rel = strike ? c.release : 0, k = f.k ?? 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0, touch: c.touch });
      // the guard: the shield up square before it (a servo with a little overshoot); thrown wide when it is broken
      guard = lagS.update(dt, f.guardK ?? 0);
      broke = ease(broke, f.reel === 'guardbroken' && (f.stunned > 0 || f.state === 'recover') ? 1 : 0, f.reel === 'guardbroken' ? 14 : 4, dt);
      pick = ease(pick, f.reel === 'pickup' && f.state === 'recover' ? 1 : 0, 8, dt);
      hull.position.set(o.x, o.y - pick * 0.32, o.z);
      hull.rotation.set(o.pitch + pick * 0.7 - broke * 0.18, o.yaw, o.roll);
      g.position.y += f.alt;   // (the leap: up in the air over you, Foe.update's arc)
      // the sword arm (R): carried low and forward; the shield arm (L): the shield at its side, a little forward
      const walk = Math.sin(rig.walked * 3) * Math.min(1, Math.hypot(rig.vel.x, rig.vel.z) / 2) * 0.25;
      let rx = -0.35 + walk, rz = 0.12, re = -0.9, rh = 1.2;            // (sword: forward and up, a fencer's carry)
      let lx = -0.25 - walk, lz = -0.25, le = -0.75, ly = 0.75;           // (shield: at its side, turned a little out)
      // guard: the shield square before its chest, the sword drawn back over its shoulder
      rx = lerp(rx, -2.2, guard); rz = lerp(rz, 0.35, guard); re = lerp(re, -1.3, guard); rh = lerp(rh, 1.5, guard);
      lx = lerp(lx, -1.1, guard); lz = lerp(lz, 0.55, guard); le = lerp(le, -1.2, guard); ly = lerp(ly, 0.2, guard);
      if (id === 'overhead' && (wind || strike)) {
        // the overhead: the sword high over its head (held from 75 %), then down through it
        rx = lerp(rx, -3.0, W); rz = lerp(rz, 0.1, W); re = lerp(re, -0.5, W); rh = lerp(rh, 1.4, W);
        lx = lerp(lx, -0.3, W); le = lerp(le, -0.7, W); ly = lerp(ly, 0.1, W);
        if (strike) { rx = lerp(-3.0, -0.9, rel); re = lerp(-0.5, -0.1, rel); rh = lerp(1.4, 1.9, rel); lx = -0.3; le = -0.7; ly = 0.1; }
      } else if (id === 'sweep' && (wind || strike)) {
        // the sweep: wound round, the sword low behind its right hip; then across its front at your knees
        rx = lerp(rx, 0.7, W); rz = lerp(rz, 1.0, W); re = lerp(re, -0.4, W); rh = lerp(rh, 1.6, W);
        lx = lerp(lx, -1.0, W); le = lerp(le, -1.2, W); ly = lerp(ly, 0.5, W);
        if (strike) { rx = lerp(0.7, -1.2, rel); rz = lerp(1.0, -0.9, rel); re = lerp(-0.4, -0.15, rel); rh = lerp(1.6, 1.7, rel); }
      } else if ((id === 'bash' || id === 'shove') && (wind || strike)) {
        // the bash: its shield shoulder drawn back, the shield turned at you; then punched out
        lx = lerp(lx, -0.6, W); lz = lerp(lz, 0.25, W); le = lerp(le, -1.7, W); ly = lerp(ly, 1.2, W);
        rx = lerp(rx, -0.2, W); re = lerp(re, -1.0, W);
        if (strike) { lx = lerp(-0.6, -1.55, rel); le = lerp(-1.7, -0.25, rel); lz = lerp(0.25, -0.2, rel); ly = lerp(1.2, 0.2, rel); }
      } else if (id === 'leap' && (wind || strike)) {
        // the leap: crouched behind its shield, the sword back; in the air the sword over its head; down on landing
        rx = lerp(rx, 0.5, W); re = lerp(re, -0.6, W); rh = lerp(rh, 0.9, W);
        lx = lerp(lx, -1.1, W); le = lerp(le, -1.3, W); ly = lerp(ly, 0.8, W);
        if (strike) {
          const up = smooth(k, 0, 0.25) * (1 - smooth(k, 0.8, 0.97)), down = smooth(k, 0.8, 0.97);
          rx = lerp(lerp(0.5, -3.0, up), -0.9, down); re = lerp(-0.5, -0.1, down); rh = lerp(1.3, 1.9, down);
        }
      }
      // its guard broken: both arms flung wide, the shield out to its side, the lens dim
      rx = lerp(rx, -0.5, broke); rz = lerp(rz, 1.25, broke); re = lerp(re, -0.2, broke);
      lx = lerp(lx, -0.6, broke); lz = lerp(lz, -1.3, broke); le = lerp(le, -0.2, broke); ly = lerp(ly, -0.4, broke);
      // bending for its sword: the sword arm reaching down to the ground
      rx = lerp(rx, -1.2, pick); re = lerp(re, -0.15, pick); rz = lerp(rz, 0.05, pick);
      R.sh.rotation.set(rx, 0, -rz); R.el.rotation.x = re; R.hand.rotation.x = rh;
      Lf.sh.rotation.set(lx, ly * 0.3, -lz); Lf.el.rotation.set(le, 0, 0); Lf.hand.rotation.set(0, 0, 0);
      // the shield kept upright (its pivot turned against the arm's own rise) and facing out of its guard, a little across
      strap.rotation.set(-(lx + le), ly - 0.2, 0);
      // the sword: in the hand, or flown out of it (f.disarmed): an arc to where it lands, turning, then lying flat
      const S = f.disarmed;
      // (skinned on the joints: a part is hidden by its joint shrunk to nothing, as the shade's sword)
      grip.scale.setScalar(S ? 1e-3 : 1);
      dropped.scale.setScalar(1e-3);
      if (S) {
        g.updateMatrixWorld(true);
        const fly = f.def.disarm?.fly ?? 0.6, u = Math.min(1, S.t / fly);
        local.lerpVectors(S.from, S.at, u); local.y += Math.sin(Math.PI * u) * 1.6 + (u >= 1 ? 0.03 : 0);
        g.worldToLocal(dropped.position.copy(local));
        // (its turn in the world: spinning end over end in the air, then lying on the ground pointing away)
        _e.set(u < 1 ? S.t * 14 : Math.PI / 2, Math.atan2(S.at.x - S.from.x, S.at.z - S.from.z), 0, 'YXZ');
        _q.setFromEuler(_e);
        dropped.quaternion.copy(g.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(_q));
        dropped.scale.setScalar(1 / (skin.scale ?? 1));
      }
      // the lens and the seams: brighter as it winds up, dim when broken open
      glow = ease(glow, wind ? 0.5 + 0.5 * W : 0, 6, dt);
      eyeM.uniforms.uColor.value.set(broke > 0.5 || f.stunned > 0 ? '#bfe9ff' : eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.7 + glow * 0.3 - broke * 0.3;
      seamM.uniforms.uGlow.value = 0.45 + glow * 0.45 + guard * 0.15 - broke * 0.3;
      rig.write();
    },
    dispose: M.dispose,
  };
}
