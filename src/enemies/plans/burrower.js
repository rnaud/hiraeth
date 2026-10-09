import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { PathTrail, Wave } from '../../motion-kit/chain.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, tube, pivot, pair, lerp, ease, eyeColor, finish } from './kit.js';

// Plan 15, the burrower (docs/systems/procedural-animation.md §4): the mound worm (docs/design/enemy-roster.md,
// archetype 12), the ambusher. Under the ground, a moving mound with a dorsal fin and a wake of smaller mounds
// behind it; up, a fat grub standing out of its hole like a stack of rings, a thick bulb of a head with a round
// toothed mouth, tapering down into the sand.
//
// On the kit (phase 4, src/motion-kit/chain.js): under, the mounds sit at fixed distances back along the head's own
// path (PathTrail): the wake follows where the fin went, nothing slides. Up, the rings are a spine bent by the pose
// (a lean toward you, a rear back), with a slow wave running up it; it rises on a spring that dips first (r < 0) and
// slumps back slowly through its recovery.
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   erupt   under: the mound stops and trembles and the fin sinks as it swims to where you stand (Foe.swimTo)
//   spit    up: it rears back and swells, its rings bunching, then coughs a spray of grit
//   dive    up: it leans over toward you and the teeth round its mouth spin, then down it goes
// Skins (src/enemies/skins.js): a sand-gold dune worm with a tall fin, a slate-violet drill grub with a steel drill on
// its crown, a glass worm with a crystal crest. Drawn to its picked sheet: references/enemy-archetypes/worm/sheet-1.jpg.

const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4();

export function wormModel(skin) {
  const PL = PLANS.burrower, P = skin.palette, props = new Set(skin.props), M = materials('worm', skin.id);
  const g = new THREE.Group(); g.name = skin.name;
  const bodyM = M.mat('body', P.body, { color2: P.body2 }), ringM = M.mat('ring', P.ring), sandM = M.mat('sand', P.sand);
  const mouthM = M.mat('mouth', P.mouth, { flat: true }), teethM = M.mat('teeth', P.teeth, { flat: true });
  const finM = M.mat('fin', P.fin, { flat: true, lineWhite: true, side: THREE.DoubleSide }), eyeM = M.own('eye', P.eye, { glow: 0.8 });
  // ---- up: a stack of rings out of the hole, the head on top
  const R = PL.spine.rings;
  const column = pivot(g, 0, 0, 0, 'column');
  const rings = [];
  for (let i = 0; i < R; i++) {
    const u = i / (R - 1), r = lerp(0.46, 0.56, Math.pow(u, 2.2));   // (about a metre thick, a little bulbous at the head)
    const p = pivot(column, 0, 0, 0, `ring ${i}`);
    // a fat ring (a donut lying flat: a sausage in silhouette), the bands every other one in ochre (the sheet's)
    add(p, new THREE.TorusGeometry(r * 0.58, r * 0.42, 8, 20).rotateX(Math.PI / 2), i % 2 ? ringM : bodyM);
    add(p, new THREE.CylinderGeometry(r * 0.6, r * 0.6, r * 0.5, 14), bodyM);
    rings.push({ p, r });
  }
  // the head: the top ring's bulb, a round mouth on its face ringed with teeth, small eyes over it
  const headP = rings[R - 1].p;
  const crown = add(headP, new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), bodyM, 0, 0.1, 0);
  const face = pivot(headP, 0, 0.16, 0.44, 'mouth');
  add(face, new THREE.CircleGeometry(0.32, 20), mouthM, 0, 0, 0.06);   // (turquoise inside, a dark throat)
  add(face, new THREE.CircleGeometry(0.14, 14), M.mat('throat', '#14100c', { flat: true }), 0, 0, 0.065);
  add(face, new THREE.TorusGeometry(0.34, 0.06, 6, 20), ringM, 0, 0, 0.05);
  const teeth = pivot(face, 0, 0, 0.07, 'teeth');
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const t = add(teeth, new THREE.ConeGeometry(0.045, 0.14, 4), teethM, Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0); t.rotation.z = -a + Math.PI; }
  const eyes = pair((s) => add(headP, new THREE.SphereGeometry(0.045, 8, 6), eyeM, s * 0.42, 0.3, 0.3));   // (tiny, beside the mouth)
  // the tall thin fin along its back (the sheet's ivory sail), from mid-back up past the head
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-0.3, -1.9); sailShape.quadraticCurveTo(-0.5, -0.6, -0.4, 0.25); sailShape.quadraticCurveTo(-0.5, 0.9, -0.75, 1.35);
  sailShape.quadraticCurveTo(-1.3, 0.4, -1.25, -0.4); sailShape.quadraticCurveTo(-1.05, -1.3, -0.75, -2.0); sailShape.lineTo(-0.3, -1.9);
  const sail = add(headP, new THREE.ShapeGeometry(sailShape, 8).rotateY(-Math.PI / 2), M.mat('sail', P.fin, { side: THREE.DoubleSide, color2: P.ring }), 0, 0.2, -0.05);
  if (props.has('drill')) { const d = add(headP, new THREE.ConeGeometry(0.22, 0.6, 8), M.mat('drill', P.teeth, { metal: 'iron' }), 0, 0.72, 0); d.userData.spin = true; }
  if (props.has('crest')) for (let k = 0; k < 5; k++) add(headP, new THREE.OctahedronGeometry(0.11, 0).scale(0.7, 2.2, 0.7), teethM, 0, 0.55 + Math.sin(k) * 0.03, -0.3 + k * 0.15).rotation.x = -0.3 + k * 0.12;
  const hole = add(g, new THREE.TorusGeometry(0.62, 0.14, 6, 20).rotateX(Math.PI / 2), sandM, 0, 0.04, 0);
  // ---- under: the mounds on the head's path, a fin on the first, a ripple round it
  const holder = pivot(g, 0, 0, 0, 'mounds (path space)');
  holder.matrixAutoUpdate = false;
  // (humps of turned sand, apart: a wake of separate mounds, not one streak)
  const mounds = Array.from({ length: PL.spine.mounds }, (_, i) => { const s = lerp(1, 0.4, i / (PL.spine.mounds - 1)); return add(holder, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.6 * s, 0.42 * s, 0.42 * s), sandM); });
  const finH = props.has('fin') ? 1.2 : 0.95;
  const fin = add(g, new THREE.ConeGeometry(0.4, finH, 4).scale(0.35, 1, 1), finM, 0, finH * 0.45, 0);
  const ripple = add(g, new THREE.RingGeometry(0.84, 1, 28).rotateX(-Math.PI / 2), M.mat('ripple', P.fin, { flat: true, side: THREE.DoubleSide }), 0, 0.05, 0);
  finish(g);
  const trail = new PathTrail({ spacing: 0.08, length: PL.spine.mounds * PL.spine.spacing + 1 });
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const rise = new SecondOrder(PL.body.rise.f, PL.body.rise.z, PL.body.rise.r, 0);
  const lean = new SecondOrder(PL.body.spring.f, PL.body.spring.z, PL.body.spring.r, 0);
  const wave = new Wave(Math.random());
  let shiver = 0, swell = 0, spin = 0, up = 0;
  return {
    group: g, body: column, parts: [...rings.map((r) => r.p), fin, sail, ...mounds], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.body, P.sand, P.ring],
    trail, mounds,
    tell: (id) => (id === 'erupt' ? fin : face),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // up or under: it rises on a spring that dips first (the sand heaves, then it stands up); it slumps back slowly
      const upMove = f.atk?.up && (wind || strike);   // (its moves from up out of the sand: it is up for them)
      const want = upMove ? 1 : f.buried ? 0 : f.state === 'recover' && f.atk?.dives ? 0 : 1;
      up = Math.max(0, Math.min(1.25, rise.update(dt, want)));
      const shown = Math.min(1, up);
      // the column: each ring stacked on the last, bent forward by the lean (toward you) and back by a rear, a slow
      // wave running up it; the rings bunch as it swells to spit
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      swell = ease(swell, id === 'spit' && wind ? c.wind : 0, 8, dt);
      spin = ease(spin, id === 'dive' && wind ? c.wind : 0, 10, dt);
      const slump = f.state === 'recover' ? 0.3 * (1 - (c.recovery ?? 0)) : f.state === 'idle' && !f.provoked ? 0.15 : 0;
      const bend = lean.update(dt, P0.pitch + slump + (f.stunned > 0 ? 0.5 : 0));
      wave.update(dt, 0.5 + (wind ? 1.2 : 0));
      let y = -0.25 - (1 - shown) * 2.4, z = 0, a = 0;
      const gap = 0.36 * (1 - swell * 0.3);
      for (let i = 0; i < R; i++) {
        const u = i / (R - 1);
        a = bend * Math.pow(u, 1.3) + wave.angle(i, 0.05, 0.7);
        rings[i].p.position.set(0, y, z + P0.z * u);
        rings[i].p.rotation.x = a;
        rings[i].p.scale.setScalar(1 + swell * 0.18 * Math.sin(Math.PI * u));
        rings[i].p.visible = y > -0.35;   // (what is under the sand isn't drawn)
        y += Math.cos(a) * gap; z += Math.sin(a) * gap;
      }
      teeth.rotation.z += dt * (2 + spin * 22);
      headP.children.forEach((x) => { if (x.userData.spin) x.rotation.y += dt * (3 + spin * 25); });
      face.scale.setScalar(1 + swell * 0.25);
      column.visible = shown > 0.03;
      hole.visible = shown > 0.03; hole.scale.setScalar(0.6 + shown * 0.4);
      // under: the mounds on its path (in the foes' space), the fin standing taller and trembling as it winds up
      trail.update(f.pos);
      g.updateMatrix(); _inv.copy(g.matrix).invert(); holder.matrix.copy(_inv); holder.matrixWorldNeedsUpdate = true;
      const under = 1 - shown;
      const winding = wind && f.atk?.surface;
      shiver = winding ? Math.sin(c.now / 30) * 0.08 * c.wind : 0;
      mounds.forEach((m, i) => {
        trail.at(0.1 + i * PL.spine.spacing, _a, _d);
        m.position.set(_a.x + (i === 0 ? shiver : 0), _a.y - 0.02, _a.z);
        m.rotation.y = Math.atan2(_d.x, _d.z);
        m.visible = under > 0.1;
        m.scale.setScalar(under * (1 + (i === 0 && winding ? 0.15 * c.wind : 0)));
      });
      // (the fin: tall while it swims, sinking through the erupt's wind-up: the mound trembles where it stops)
      fin.visible = ripple.visible = under > 0.08;
      fin.position.set(shiver, finH * 0.45 * under - (winding ? 0.35 * c.wind : 0), 0);
      fin.rotation.z = Math.sin(c.now / 160) * 0.12;
      ripple.scale.setScalar((1.1 + 0.18 * Math.sin(c.now / 180)) * under);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      if (f.buried && (c.moving || winding) && Math.random() < 0.5) c.dust(f.pos, P.sand, 2, 0.9);
      if (winding && Math.random() < 0.3 + c.wind) c.dust(f.pos, P.sand, 1 + c.wind * 3, 0.5 + c.wind * 0.6);
      if (strike && id === 'spit' && Math.random() < 0.8) c.spray(_a.set(f.pos.x + Math.sin(f.heading) * 0.6, f.pos.y + 2, f.pos.z + Math.cos(f.heading) * 0.6), [P.sand, P.ring], 3, 6, 9);
      if (shown > 0.05 && shown < 0.9 && Math.random() < 0.6) c.dust(f.pos, P.sand, 2, 0.8);
    },
    dispose: M.dispose,
  };
}
