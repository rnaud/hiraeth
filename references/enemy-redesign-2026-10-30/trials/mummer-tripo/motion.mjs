// #800 phase 2: the dune mummer's walk audit in each variant (node, no GPU, the clip library loaded): the humanoid foes'
// own foot-slide measure (scripts/motion-audit/foe-slide.mjs, #749: the ball of each sole, the body walked, run,
// strafed, turned on the spot and knocked back through the game's own Foes.look), plus the walk's cadence and stride
// (steps a second, the feet's longest gap along the way, as a share of the leg) and the feet's lift.
//   node references/enemy-redesign-2026-10-30/trials/motion-audit.mjs mummer@desert [--json]
import * as THREE from 'three';
import { TRIAL_BUILDERS } from '../../../../src/enemies/plans/index.js';
import { duneMummerModel } from '../../../../src/enemies/plans/dune-mummer.js';
import { tripoMummerModel } from '../../../../src/enemies/plans/dune-mummer-tripo.js';
import { tripoMummerSource } from './node-source.mjs';
import { loadClips, slideArena, measure, SCENARIOS, footRoots } from '../../../../scripts/motion-audit/foe-slide.mjs';
import { footBall } from '../../../../src/enemies/humanoid-rig.js';

/** Cadence, stride and lift of a straight walk (`pace` of the foe's speed) over `frames` after settling. */
function gait(foes, kind, pace, frames = 240) {
  const f = foes.add(kind, new THREE.Vector3()); f.provoked = true; f.state = 'chase'; f.heading = 0; f.cool = 99;
  const M = f.model, roots = footRoots(M), DT = 1 / 60, p = new THREE.Vector3(), tr = roots.map(() => []);
  let balls = null;
  for (let i = 0; i < 40 + frames; i++) {
    if (i === 39) { M.group.updateMatrixWorld(true); balls = roots.map((r) => footBall(r)); }
    if (i > 20) f.pos.z += f.def.speed * pace * DT;
    foes.player.pos.set(f.pos.x + 5, 0, f.pos.z + 3); f.dist = 5.8;
    foes.look(f, DT); M.group.updateMatrixWorld(true);
    if (i >= 40) roots.forEach((r, k) => tr[k].push((balls?.[k] ? r.localToWorld(p.copy(balls[k])) : r.getWorldPosition(p)).toArray()));
  }
  const s = M.group.getWorldScale(p).y, leg = (M.joints.D.thigh + M.joints.D.shin) * s;
  // (a step: a foot's lift from the ground, counted on the way up through a quarter of its highest)
  let steps = 0, lift = 0, gap = 0;
  for (const t of tr) { const lo = Math.min(...t.map((q) => q[1])), hi = Math.max(...t.map((q) => q[1])); lift = Math.max(lift, hi - lo); let up = false; for (const q of t) { const a = q[1] - lo > (hi - lo) * 0.25; if (a && !up) steps++; up = a; } }
  for (let i = 0; i < tr[0].length; i++) gap = Math.max(gap, Math.abs(tr[0][i][2] - tr[1][i][2]));
  foes.remove(f);
  return { cadence: +(steps / (frames / 60)).toFixed(2), stride: +(gap / leg).toFixed(3), lift: +(lift / leg).toFixed(3), leg: +leg.toFixed(3) };
}

export async function run(id = 'mummer@desert', json = false) {
  await loadClips();
  const src = tripoMummerSource(), kind = id.split('@')[0];
  const VARIANTS = { current: null, direct: duneMummerModel, tripo: (skin) => tripoMummerModel(skin, src) };
  const out = {};
  for (const [v, fn] of Object.entries(VARIANTS)) {
    if (fn) TRIAL_BUILDERS[kind] = fn; else delete TRIAL_BUILDERS[kind];
    const { foes, done } = slideArena();
    const r = {};
    for (const s of SCENARIOS) { const m = measure(foes, id, s); r[s] = m && { slidePerM: +m.slidePerM.toFixed(4), worst: +m.worst.toFixed(3) }; }
    r.gait = { full: gait(foes, id, 1), half: gait(foes, id, 0.5) };
    done();
    out[v] = r;
  }
  delete TRIAL_BUILDERS[kind];
  if (json) console.log(JSON.stringify(out, null, 1));
  else for (const [v, r] of Object.entries(out)) console.log(v.padEnd(8), SCENARIOS.map((s) => `${s} ${r[s] ? `${r[s].slidePerM}/${r[s].worst}` : '—'}`).join(' · '), '· gait', JSON.stringify(r.gait));
  return out;
}
