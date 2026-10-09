import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, rod, many, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 5, the hopper (docs/systems/procedural-animation.md §4): the bellows toad (docs/design/enemy-roster.md,
// archetype 4), drawn to its sheets (references/enemy-archetypes/toad/: sheet-1 Lorn's spore toad, sheet-2 the
// City-Shaft's pressure toad). A squat pear sitting upright like a fat old man, 2.2 m to the top of its head: a broad
// flat head with heavy-lidded eyes on top and a wide downturned mouth, a cream belly, a throat sac hanging in folds
// from the chin to the belly; short thick arms with elbows out and broad three-toed hands planted in front; great
// hind legs folded at its sides, the knee forward and the ankle back, long webbed feet flat on the ground. From afar a
// black lump with a bowed back (the sheet's silhouette).
//
// It moves hop by hop: its drawn body stays on its planted feet while the mind's position runs ahead, then crouches,
// launches, tucks its legs in the air and lands squashed on the next spot with a puff of dust (PLANS.hopper.hop), so
// its feet never slide; between hops the kit only settles them (turning on the spot steps them round).
//
// Its attacks read from the body alone (src/telegraph.js):
//   lob     the throat swells to twice its size and glows see-through with the glob inside, it rears back; the
//           glob arcs out of its mouth onto its landing mark (the one exception: a thrown thing)
//   volley  the same, fuller, three globs (the City-Shaft and the Waterfall)
//   flop    a deep crouch, its legs shaking; then the leap, belly first, and a ring of shock as it lands
// The air cut in its leap brings it down on its back; a shot in its swollen throat makes it choke on its own glob.

const H = 2.2;   // (its height sitting: the sheets draw it over the traveller's head)
/** The pear: a lathe profile of the body and head in one, a broad bottom, a bowed back and a flat-topped head. */
const PEAR = [[0.001, 0.16], [0.5, 0.2], [0.78, 0.36], [0.9, 0.62], [0.9, 0.9], [0.84, 1.18], [0.74, 1.42], [0.66, 1.62], [0.62, 1.8], [0.56, 1.96], [0.44, 2.08], [0.22, 2.16], [0.001, 2.18]]
  .map(([r, y]) => new THREE.Vector2(r, y));

let toads = 0;

export function toadModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('toad', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const skinM = M.mat('skin', P.skin, { color2: P.skin2 }), bellyM = M.mat('belly', P.belly), toeM = M.mat('toe', P.toe), darkM = M.mat('dark', P.dark, { flat: true });
  const lidM = M.mat('lid', P.lid), globM = M.mat('glob', P.glob);
  const sacM = M.own('sac', P.sac, { glow: 0.05 }), eyeM = M.own('eye', P.eye, { glow: 0.45 });
  // the body: the pear, bowed back, leaning back a little as it sits
  const trunk = pivot(body, 0, 0, 0, 'trunk');
  const pear = add(trunk, new THREE.LatheGeometry(PEAR, 24), skinM);
  pear.scale.set(1, 1, 0.86); pear.rotation.x = -0.06;
  // the cream belly: a full front, wider low, with its folds (painted)
  const belly = add(trunk, new THREE.SphereGeometry(1, 20, 14).scale(0.74, 0.7, 0.5), bellyM, 0, 0.78, 0.36);
  // the head's front: a broad brow over the mouth, the mouth a wide dark line turning down at its corners
  const head = pivot(trunk, 0, 1.72, 0.16, 'head');
  add(head, new THREE.SphereGeometry(1, 18, 12).scale(0.6, 0.34, 0.52), skinM, 0, 0.08, 0.06);
  const mouth = tube(head, [[-0.56, -0.06, 0.22], [-0.42, 0.0, 0.42], [0, 0.03, 0.56], [0.42, 0.0, 0.42], [0.56, -0.06, 0.22]], 0.02, darkM);
  // heavy-lidded eyes on top of the head: a bulging ball each side, its lid down over half of it
  const eyes = pair((s) => {
    const e = pivot(head, s * 0.34, 0.33, 0.22, 'eye');
    add(e, new THREE.SphereGeometry(0.15, 14, 10), skinM);
    add(e, new THREE.SphereGeometry(0.105, 12, 10), eyeM, s * 0.03, 0.0, 0.07);
    add(e, new THREE.SphereGeometry(0.04, 8, 6).scale(1.5, 0.45, 1), darkM, s * 0.04, 0.005, 0.165);   // (the pupil, a slot)
    const lid = pivot(e, 0, 0.0, 0.0, 'lid');
    add(lid, new THREE.SphereGeometry(0.158, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), lidM);
    lid.rotation.x = 0.55;   // (heavy: half shut)
    return { e, lid };
  });
  // the throat sac: hanging in folds from the chin down onto the belly; it swells into a great translucent ball
  const sac = pivot(trunk, 0, 1.6, 0.5, 'sac');
  // (hanging: a long tongue of folds, widest under the chin, to a point on the belly; swollen: a ball before its chest)
  const TONGUE = [[0.001, -1], [0.22, -0.88], [0.52, -0.55], [0.78, -0.12], [0.92, 0.3], [0.86, 0.66], [0.55, 0.92], [0.001, 1]].map(([r, y]) => new THREE.Vector2(r, y));
  const tongue = add(sac, new THREE.LatheGeometry(TONGUE, 18), sacM, 0, -0.5, 0.32); tongue.rotation.x = -0.24;   // (lying on the belly)
  const bag = add(sac, new THREE.SphereGeometry(1, 20, 16), sacM);
  const glob = add(sac, new THREE.IcosahedronGeometry(0.4, 2), globM, 0, -0.5, 0.45); glob.visible = false;
  // short thick arms: elbows out and back, broad three-toed hands planted in front of the belly
  const legs = [];
  for (const s of [-1, 1]) legs.push(planLeg(PLANS.hopper, { group: g, body, hipParent: trunk, hip: { x: s * 0.58, y: 1.2, z: 0.36 }, foot: { x: s * 0.66, z: 0.8 }, pole: { x: s * 1, y: 0.1, z: -0.5 },
    radius: 0.17, pad: 'pad', mats: { joint: skinM, thigh: skinM, shin: skinM, foot: skinM }, name: `toad arm ${legs.length}` }));
  // the great hind legs folded at its sides: the knee forward beside the belly, the ankle back under the hip
  for (const s of [-1, 1]) legs.push(planLeg(PLANS.hopper, { group: g, body, hipParent: trunk, hip: { x: s * 0.6, y: 0.62, z: -0.2 }, foot: { x: s * 0.8, z: -0.34 }, pole: { x: s * 0.55, y: 0.35, z: 1 },
    radius: 0.24, pad: 'pad', mats: { joint: skinM, thigh: skinM, shin: skinM, foot: skinM }, name: `toad leg ${legs.length}` }));
  // the haunches: the folded thighs' great rounded masses at its lower sides (the sheet's lump)
  const haunches = pair((s) => add(trunk, new THREE.SphereGeometry(1, 16, 12).scale(0.4, 0.42, 0.6), skinM, s * 0.66, 0.5, -0.12));
  // the hands: three fat fingers each, splayed forward; the feet: long, webbed, flat, reaching forward past the knee
  const fingers = (leg, s) => {   // (three fingers in one mesh, their tips in another: two draws a hand)
    const a = [0, 1, 2].map((k) => (k - 1) * 0.42 + s * 0.15);
    many(leg.foot, a.map((x) => new THREE.CapsuleGeometry(0.045, 0.2, 3, 6).rotateX(Math.PI / 2).translate(0, 0.03, 0.15).rotateY(x)), skinM);
    many(leg.foot, a.map((x) => new THREE.SphereGeometry(0.05, 6, 4).translate(Math.sin(x) * 0.27, 0.03, Math.cos(x) * 0.27)), toeM);
  };
  legs.slice(0, 2).forEach((l, i) => fingers(l, i ? 1 : -1));
  const web = new THREE.Shape(); web.moveTo(0, 0); web.lineTo(-0.3, 0.55); web.quadraticCurveTo(-0.16, 0.5, -0.1, 0.62); web.quadraticCurveTo(0, 0.55, 0.1, 0.66); web.quadraticCurveTo(0.2, 0.55, 0.34, 0.58); web.lineTo(0, 0);
  legs.slice(2).forEach((l, i) => {
    const s = i ? 1 : -1, foot = pivot(l.foot, 0, 0.02, 0, 'web'); foot.rotation.y = s * 0.25;
    add(foot, new THREE.ShapeGeometry(web).rotateX(-Math.PI / 2), M.mat('web', P.toe, { side: THREE.DoubleSide }), 0, 0.01, 0);
    const toes = [[-0.3, 0.55], [-0.1, 0.62], [0.1, 0.66], [0.34, 0.58]];
    many(foot, toes.map(([x, z]) => { const d = Math.hypot(x, z); return new THREE.CylinderGeometry(0.02, 0.035, d, 6).translate(0, d / 2, 0).rotateX(Math.PI / 2).rotateY(Math.atan2(x, z)).translate(0, 0.03, 0); }), skinM);
    many(foot, toes.map(([x, z]) => new THREE.SphereGeometry(0.045, 6, 4).translate(x, 0.03, z)), toeM);
  });
  // the dress: the City-Shaft's brass valve on its head and a pressure gauge on its back with its pipe; the Waterfall's
  // jet; Home's flower
  const dress = [];
  let steam = null, gauge = null;
  if (props.has('valve')) {
    const brassM = M.mat('brass', P.brass);
    const v = pivot(trunk, 0.05, 2.15, -0.1, 'valve');
    rod(v, [0, -0.05, 0], [0, 0.22, 0], 0.05, brassM); add(v, new THREE.TorusGeometry(0.1, 0.022, 6, 12).rotateX(Math.PI / 2), brassM, 0, 0.24, 0);
    rod(v, [-0.12, 0.24, 0], [0.12, 0.24, 0], 0.016, brassM); dress.push(v);
    steam = v;
  }
  if (props.has('gauge')) {
    const brassM = M.mat('brass', P.brass);
    gauge = pivot(trunk, 0.32, 1.62, -0.55, 'gauge'); gauge.rotation.set(-0.5, 0.5, 0);
    add(gauge, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 18).rotateX(Math.PI / 2), brassM);
    add(gauge, new THREE.CircleGeometry(0.14, 18), M.mat('dial', '#f4ecd6'), 0, 0, -0.037).rotation.y = Math.PI;
    rod(gauge, [0, 0, -0.04], [0.06, 0.08, -0.045], 0.008, darkM);
    tube(trunk, [[0.12, 2.2, -0.12], [0.3, 2.0, -0.38], [0.5, 1.75, -0.55], [0.55, 1.4, -0.62]], 0.03, brassM);
    dress.push(gauge);
  }
  if (props.has('jet')) { const brassM = M.mat('brass', P.brass); const j = pivot(trunk, 0, 1.75, -0.6, 'jet'); j.rotation.x = -0.9; add(j, new THREE.CylinderGeometry(0.08, 0.14, 0.32, 10), brassM); add(j, new THREE.TorusGeometry(0.09, 0.025, 6, 12).rotateX(Math.PI / 2), brassM, 0, 0.17, 0); dress.push(j); steam = j; }
  if (props.has('flower')) { const fl = pivot(head, -0.12, 0.42, 0.0, 'flower'); rod(fl, [0, 0, 0], [0.02, 0.24, 0.02], 0.014, M.mat('stem', '#5a8a3c')); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; add(fl, new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.4, 1.6), M.mat('flower', P.flower), Math.sin(a) * 0.07, 0.26, Math.cos(a) * 0.07).rotation.y = a; } add(fl, new THREE.SphereGeometry(0.04, 8, 6), M.mat('heart', '#f2d36b'), 0, 0.27, 0); dress.push(fl); }
  const rig = new Rig({ plan: PLANS.hopper, group: g, body, legs });
  const mouthTip = pivot(head, 0, 0.0, 0.6);   // (where the glob leaves, and its glow gathers)
  finish(g);
  const parts = [pear, belly, head, sac, ...haunches, ...dress, ...legs.map((l) => l.root)];
  // the hop: where its drawn body is (it lags the mind's position by up to a hop, then leaps ahead of it)
  const HOP = PLANS.hopper.hop;
  const drawn = V(), from = V(), to = V(), prev = V(), vel = V();
  const r = (toads++ * 0.618034) % 1, own = 0.8 + r * 0.45;   // (its own rhythm, by the golden ratio: two toads never hop together)
  let hop = null, ground = r * 0.7, squash = 0, crouch = 0, swell = 0, flip = 0, rear = 0, started = false, tumble = 0;
  const _w = V();
  return {
    group: g, body: trunk, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.sac], spore: P.glob,
    tell: (id) => (id === 'flop' ? legs[2].foot : mouthTip),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      if (!started) { drawn.copy(f.pos); prev.copy(f.pos); started = true; }
      if (dt > 0) { _w.subVectors(f.pos, prev).divideScalar(dt); vel.lerp(_w.setY(0), 1 - Math.exp(-6 * dt)); }
      prev.copy(f.pos);
      const leaping = id === 'flop' && strike && f.alt > 0.001;
      const still = wind || f.stunned > 0 || f.flipped > 0 || leaping || f.state === 'recover';
      // the hop: it lags, crouches, leaps ahead of the mind and lands; in a wind-up it hops once onto its true spot
      if (leaping) { hop = null; drawn.copy(f.pos); }
      else if (!hop) {
        ground += dt;
        const off = Math.hypot(f.pos.x - drawn.x, f.pos.z - drawn.z);
        if (off > 3) drawn.copy(f.pos);   // (a teleport, a respawn: no hop across the world)
        else if (ground > (HOP.gap + HOP.squash) * own && off > (still || vel.length() < 0.3 ? 0.15 : HOP.catchUp * own)) {
          from.copy(drawn);
          // (it lands where the mind will be by then: the crouch and the flight ahead)
          const ahead = still ? 0 : HOP.crouch + HOP.air;
          to.set(f.pos.x + vel.x * ahead, f.pos.y, f.pos.z + vel.z * ahead);
          const L = Math.hypot(to.x - from.x, to.z - from.z), most = HOP.length * 2;
          if (L > most) to.set(from.x + (to.x - from.x) * most / L, to.y, from.z + (to.z - from.z) * most / L);
          hop = { t: -HOP.crouch / HOP.air, h: HOP.height * Math.min(1.2, 0.6 + L / HOP.length * 0.5) };
        }
      }
      let up = 0, air = 0;
      if (hop) {
        hop.t += dt / HOP.air;
        if (hop.t < 0) crouch = ease(crouch, 1, 18, dt);   // (the crouch before it launches)
        else {
          const u = Math.min(1, hop.t);
          drawn.lerpVectors(from, to, u);
          up = Math.sin(Math.PI * u) * hop.h; air = 1.6;   // (in the air: the legs tuck)
          crouch = ease(crouch, 0, 20, dt);
          if (hop.t >= 1) { drawn.copy(to); hop = null; ground = 0; squash = 1; c.dust(drawn, P.belly, 6, 0.8); }
        }
      }
      if (leaping) { up = f.alt; air = 1.4; }
      squash = Math.max(0, squash - dt / HOP.squash);
      // the toad's spot: its drawn root (not the mind's): the group and the rig both go by it
      g.position.x = drawn.x; g.position.z = drawn.z; g.position.y = f.pos.y + f.over + up;
      // the wind-ups: the lob's swollen throat and rearing back; the flop's deep crouch, legs shaking
      const lob = id === 'lob' || id === 'volley';
      const flop = id === 'flop' && wind ? c.wind : 0;
      swell = ease(swell, lob && wind ? c.wind * (id === 'volley' ? 1.15 : 1) : lob && strike ? 0.4 : (f.state === 'idle' ? 0.1 + Math.max(0, Math.sin(c.now / 700 + f.home.x)) * 0.18 : 0), wind ? 10 : 5, dt);
      rear = ease(rear, lob && wind ? c.wind : 0, 9, dt);
      flip = ease(flip, f.flipped > 0 ? 1 : 0, 8, dt);
      tumble = leaping ? Math.min(1, f.k * 2) : ease(tumble, 0, 10, dt);
      const o = rig.update({ pos: drawn, heading: f.heading, state: f.state, k: f.k, atk: f.atk, stunned: f.stunned }, dt,
        { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: air || (flip > 0.3 ? 1.4 : 0), landHome: true });
      const shake = flop ? Math.sin(c.now / 22) * 0.025 * flop : 0;
      trunk.position.set(o.x + shake, o.y - crouch * 0.14 - squash * 0.12 + shake * 0.5, o.z);
      trunk.scale.set(1 + squash * 0.1 + crouch * 0.05, 1 - squash * 0.12 - crouch * 0.06 + (up > 0 ? 0.06 : 0), 1 + squash * 0.1);
      // (belly first through the leap; on its back once the air cut brings it down)
      trunk.rotation.set(o.pitch + tumble * 0.7 * Math.sin(Math.PI * Math.min(1, f.k)) - flip * 1.35, o.yaw, o.roll + shake * 2);
      // the sac: folds hanging down to the belly at rest; swelling to a great ball in front of it, glowing through
      const sw = Math.max(swell, f.stunned > 0 && !f.flipped ? 0.3 : 0);
      const ball = THREE.MathUtils.smoothstep(sw, 0.3, 0.55);
      tongue.scale.set(0.44 * (1 + sw * 0.3), 0.62 * (1 - ball * 0.4), 0.16 + sw * 0.2); tongue.visible = ball < 0.95;
      bag.visible = ball > 0.02; bag.scale.set(lerp(0.3, 0.82, sw), lerp(0.3, 0.84, sw), lerp(0.2, 0.76, sw));
      bag.position.set(0, lerp(-0.4, -0.52, sw), lerp(0.1, 0.5, sw));
      sacM.uniforms.uGlow.value = 0.05 + sw * 0.55;
      glob.visible = lob && wind && f.k < 0.66;
      glob.position.set(0, -0.5, lerp(0.3, 0.98, sw)); glob.scale.setScalar(0.7 + sw * 0.45);   // (pressed to the front of the sac: seen through it)
      head.rotation.x = -rear * 0.25 + (strike && lob ? 0.2 : 0);
      // eyes: wide open fighting, heavy-lidded sitting; the lids close as it chokes
      eyes.forEach((e) => { e.lid.rotation.x = f.provoked ? (f.stunned > 0 ? 1.25 : -0.35) : 0.55 + Math.max(0, Math.sin(c.now / 2300 + f.home.z)) * 0.4; });
      // the glob out of its mouth over the wind-up's last part, onto its mark (each of a volley's a little behind)
      const pts = f.attackPts ?? [f.attackAt], u = lob && wind ? (f.k - 0.66) / 0.34 : -1;   // (in its throat, then out over the last third)
      mouthTip.getWorldPosition(_w);
      if ((lob && wind) || f.globs) for (let i = 0; i < pts.length || i < (f.globs?.length ?? 0); i++) c.lob(f, i < pts.length ? u - i * 0.08 : -1, P.glob, i, pts[i] ?? f.attackAt, _w);
      if (gauge) gauge.children[2].rotation.z = -swell * 2.4;
      if (steam && (swell > 0.4 || (f.state === 'idle' && Math.random() < 0.02)) && Math.random() < 0.3) c.spray(steam.getWorldPosition(V()), ['#ffffff', '#e8eef2'], 1, 0.8, -1.5);
      if (f.stunned > 0 && !f.flipped && Math.random() < 0.2) c.spray(mouthTip.getWorldPosition(V()), [P.glob, P.sac], 1, 1.2, 2);   // (choking on its own spores)
      rig.write();
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}
