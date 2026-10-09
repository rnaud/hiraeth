// What the locomotion kit costs a frame (docs/systems/procedural-animation.md, "Cost"), in node on this machine:
// the rig's planning and drawing (Rig.update + Rig.write) timed round every foe's look, after a warm-up.
//
//   node scripts/motion-audit/cost.mjs            each plan alone (10 of a kind, near), then a mixed scene:
//                                                 10 near (≤ 25 m) and 30 far (> 60 m: the canned cycle)
import * as THREE from 'three';
import { foeSystem, DT } from './walk.mjs';

const KINDS = ['crab', 'desert/dune-skitter', 'hound', 'bazaar/coin-lizard', 'machine', 'incal/possessed-inspection-tripod'];

function scene(list, frames = 600, warm = 180) {
  const sys = foeSystem();
  sys.player.pos.set(0, 0, 0);
  const foes = list.map(({ kind, r, a }) => { const f = sys.add(kind, new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)); f.ring = { r, a }; return f; });
  let kit = 0, legs = 0;
  for (const f of foes) {
    const R = f.model.rig, u = R.update.bind(R), w = R.write.bind(R);
    legs += R.legs.length;
    R.update = (...x) => { const t = performance.now(); const o = u(...x); if (f.timing) kit += performance.now() - t; return o; };
    R.write = () => { const t = performance.now(); w(); if (f.timing) kit += performance.now() - t; };
  }
  for (let i = 0; i < warm + frames; i++) {
    for (const f of foes) {
      f.timing = i >= warm;
      // round and round its ring, so it walks and turns all the time
      f.ring.a += (2 / f.ring.r) * DT;
      f.pos.set(Math.sin(f.ring.a) * f.ring.r, 0, Math.cos(f.ring.a) * f.ring.r);
      f.heading = f.ring.a + Math.PI / 2; f.state = 'chase'; f.dist = 2;
      sys.look(f, DT);
    }
  }
  sys.dispose();
  const perFrame = (kit / frames) * 1000;   // µs
  return { foes: foes.length, legs, perFrameUs: perFrame, perFoeUs: perFrame / foes.length, perLegUs: perFrame / legs };
}

const rows = [];
for (const kind of KINDS) rows.push([kind, scene(Array.from({ length: 10 }, (_, i) => ({ kind, r: 6 + i, a: i })))]);
const mixed = [...Array.from({ length: 10 }, (_, i) => ({ kind: KINDS[i % KINDS.length], r: 6 + i, a: i })), ...Array.from({ length: 30 }, (_, i) => ({ kind: KINDS[i % KINDS.length], r: 80 + i, a: i }))];
rows.push(['mixed: 10 near + 30 far', scene(mixed)]);
console.log('scene                                    foes  legs   µs/frame  µs/foe  µs/leg');
for (const [name, r] of rows) console.log(`${name.padEnd(40)} ${String(r.foes).padStart(4)} ${String(r.legs).padStart(5)} ${r.perFrameUs.toFixed(1).padStart(10)} ${r.perFoeUs.toFixed(2).padStart(7)} ${r.perLegUs.toFixed(2).padStart(7)}`);
