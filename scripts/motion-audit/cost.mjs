// What the locomotion kit costs a frame (docs/systems/procedural-animation.md, "Cost" and "Phase 7, LOD and style"), in
// node on this machine: the rig's planning and drawing (Rig.update + Rig.write) timed round every foe's look, and a
// guardian's whole animate(), after a warm-up.
//
//   node scripts/motion-audit/cost.mjs     each plan alone (10 of a kind, near), then mixed scenes: 10 near (≤ 25 m) and
//                                          30 far (> 60 m); the same with the camera looking one way (the foes behind it out
//                                          of view: src/motion-kit/view.js); a pack of 8 near with a guardian (the Keeper)
//   --scenes                               the mixed scenes only;  --json  the rows as JSON
// Each row is the least of five runs (the machine is shared: a run is only ever slower than the kit).
import * as THREE from 'three';
import { foeSystem, DT } from './walk.mjs';
import { keeperModel } from '../../src/temples/guardians.js';

const view = await import('../../src/motion-kit/view.js').catch(() => null);   // (absent before kit phase 7: everything in view)
const KINDS = ['crab', 'hound', 'lizard', 'tripod', 'skitter', 'brute', 'bell', 'heron', 'shade', 'machine'];

/** A camera at the origin looking along +z (the game's fov, 16:9): what it sees is in view. */
function camera() {
  const c = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000);
  c.position.set(0, 3, -4); c.lookAt(0, 1, 10); c.updateMatrixWorld(true);
  return c;
}

function scene(list, { frames = 600, warm = 180, look = false, guardian = false } = {}) {
  const sys = foeSystem();
  sys.player.pos.set(0, 0, 0);
  if (view) { if (look) view.setView(camera()); else view.clearView(); }
  const foes = list.map(({ kind, r, a }) => { const f = sys.add(kind, new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)); f.ring = { r, a }; return f; });
  let kit = 0, legs = 0, guard = 0;
  for (const f of foes) {
    const R = f.model.rig, u = R.update.bind(R), w = R.write.bind(R);
    legs += R.legs.length;
    R.update = (...x) => { const t = performance.now(); const o = u(...x); if (f.timing) kit += performance.now() - t; return o; };
    R.write = () => { const t = performance.now(); w(); if (f.timing) kit += performance.now() - t; };
  }
  const G = guardian ? keeperModel() : null;
  if (G) { G.pos.set(0, 0, 14); legs += G.kit.legs.length; }
  for (let i = 0; i < warm + frames; i++) {
    for (const f of foes) {
      f.timing = i >= warm;
      // round and round its ring, so it walks and turns all the time
      f.ring.a += (2 / f.ring.r) * DT;
      f.pos.set(Math.sin(f.ring.a) * f.ring.r, 0, Math.cos(f.ring.a) * f.ring.r);
      f.heading = f.ring.a + Math.PI / 2; f.state = 'chase'; f.dist = 2;
      sys.look(f, DT);
    }
    if (G) {
      const a = i * DT * 0.3;
      G.pos.set(Math.sin(a) * 4, 0, 14 + Math.cos(a) * 4); G.heading = a + Math.PI / 2;
      G.group.position.copy(G.pos); G.group.rotation.y = G.heading;
      const t = performance.now();
      G.animate(DT, i * DT, { state: 'fight', speed: 1.2, meter: 0.3, phase: 0, kit: { eye: sys.player.pos, ground: () => 0 } });
      if (i >= warm) guard += performance.now() - t;
    }
  }
  sys.dispose();
  view?.clearView();
  const perFrame = ((kit + guard) / frames) * 1000;   // µs
  return { foes: foes.length + (G ? 1 : 0), legs, perFrameUs: perFrame, perFoeUs: perFrame / (foes.length + (G ? 1 : 0)), perLegUs: perFrame / legs, guardianUs: G ? (guard / frames) * 1000 : null };
}

// (the least of five runs: the machine is shared, and a run only ever measures slower than the kit is)
const best = (list, o) => { let b = null; for (let k = 0; k < 5; k++) { const r = scene(list, o); if (!b || r.perFrameUs < b.perFrameUs) b = r; } return b; };
const rows = [];
const near = (n) => Array.from({ length: n }, (_, i) => ({ kind: KINDS[i % KINDS.length], r: 6 + i, a: i * 0.7 }));
const far = (n) => Array.from({ length: n }, (_, i) => ({ kind: KINDS[i % KINDS.length], r: 80 + i, a: i * 0.9 }));
if (!process.argv.includes('--scenes')) for (const kind of KINDS) rows.push([kind, best(Array.from({ length: 10 }, (_, i) => ({ kind, r: 6 + i, a: i })))]);
rows.push(['mixed: 10 near + 30 far', best([...near(10), ...far(30)])]);
rows.push(['mixed, seen one way (the rest out of view)', best([...near(10), ...far(30)], { look: true })]);
rows.push(['a pack of 8 near + the Keeper', best(near(8), { guardian: true })]);
rows.push(['the pack + the Keeper, seen one way', best(near(8), { guardian: true, look: true })]);
if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(rows), null, 1));
else {
  console.log('scene                                          foes  legs   µs/frame  µs/foe  µs/leg');
  for (const [name, r] of rows) console.log(`${name.padEnd(46)} ${String(r.foes).padStart(4)} ${String(r.legs).padStart(5)} ${r.perFrameUs.toFixed(1).padStart(10)} ${r.perFoeUs.toFixed(2).padStart(7)} ${r.perLegUs.toFixed(2).padStart(7)}`);
}
