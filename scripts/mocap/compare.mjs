#!/usr/bin/env node
// The traveller's locomotion three ways, measured by the gait harness (tests/gait-sim.js) on the
// runs the "Locomotion" table uses (docs/systems/animation.md), plus a few the captured motion is
// for: the loops alone, the loops with the starts, stops and turns from motion capture
// (src/loco-moves.js: the game's default), and motion matching (src/motion-match.js, ?mm=1).
//   node scripts/mocap/compare.mjs [run name ...]
//   BODY=v1 node scripts/mocap/compare.mjs     the game's coral-shirt traveller (else the plain body)
//   WAYS=loops,moves node scripts/mocap/compare.mjs
// Besides the harness's measures: how fast the pose answers the stick (first step: from pushing
// the stick while standing until a foot is off the ground; settled: from letting go until both feet
// are held and stay so for 0.3 s), and the controller's own turn (face: s to face the new way).
import * as THREE from 'three';
import { course, traveller, drive, timeToFace } from '../../tests/gait-sim.js';
import { RUNS, byTag } from '../../src/gait-course.js';

// (the runs and byTag live in src/gait-course.js: the Motion page, motion.html, plays the same runs)
export { RUNS, byTag };

export const WAYS = { loops: { matching: false, moves: false }, moves: { matching: false, moves: true }, mm: { matching: true, moves: false } };

const fmt = (r) => `slide ${r.maxSlide.toFixed(2)} / ${r.meanSlide.toFixed(3)}  held ${r.heldSlide.toFixed(3)}  sink ${r.sink.toFixed(3)}  jerk ${r.jitterHead.toFixed(2)}  bone ${r.maxTurn.toFixed(2)}`;
const steer = (input) => !!(input && (input.KeyW || input.KeyS || input.KeyA || input.KeyD || (input.stick && Math.hypot(input.stick.x, input.stick.y) > 0.1)));

/**
 * The pose's answer to the stick over a run: for each start from standing, the s until a foot is
 * 3 cm off the ground; for each release, the s until both feet are held (and stay so 0.3 s).
 */
export function responses(frames, script, fps = 60) {
  const starts = [], stops = [];
  let k = 0, on = false;
  const ballRest = 0.04;
  for (const [secs, input] of script) {
    const n = Math.round(secs * fps), now = steer(input);
    if (now && !on && k > 0) {
      for (let i = k; i < Math.min(frames.length, k + fps * 2); i++) {
        const f = frames[i];
        if (['l', 'r'].some((s) => f.feet[s].ball.y - f.feet[s].gBall - ballRest > 0.03)) { starts.push((i - k) / fps); break; }
      }
    }
    if (!now && on) {
      let held = 0;
      for (let i = k; i < Math.min(frames.length, k + fps * 4); i++) {
        const f = frames[i], both = ['l', 'r'].every((s) => f.feet[s].locked && f.feet[s].w > 0.95) && f.vel.length() < 0.05;
        held = both ? held + 1 : 0;
        if (held >= fps * 0.3) { stops.push((i - k - held + 1) / fps); break; }
      }
    }
    on = now; k += n;
  }
  return { starts, stops };
}

export async function compare(names = Object.keys(RUNS), ways = Object.keys(WAYS), body = 'plain') {
  const out = {};
  for (const name of names) {
    const run = RUNS[name];
    out[name] = {};
    for (const way of ways) {
      const p = await traveller(course(), new THREE.Vector3(...run.at), { ...WAYS[way], body });
      const r = drive(p, run.script);
      r.face = run.face ? timeToFace(r.frames, run.face[0], run.face[1]) : null;
      r.mmShare = r.frames.filter((f) => f.t > 0.3).reduce((a, f) => a + (f.mmW ?? 0), 0) / Math.max(1, r.frames.filter((f) => f.t > 0.3).length);
      r.jumps = p.animator.mm?.jumps ?? 0;
      r.moves = p.moves?.count ?? null;
      r.resp = responses(r.frames, run.script);
      out[name][way] = r;
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // (MM='{"keep":0.3}' node scripts/mocap/compare.mjs: try the matcher's settings, src/motion-match.js MATCH)
  if (process.env.MM) Object.assign((await import('../../src/motion-match.js')).MATCH, JSON.parse(process.env.MM));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RUNS);
  const ways = (process.env.WAYS ?? Object.keys(WAYS).join(',')).split(',');
  const res = await compare(names, ways, process.env.BODY ?? 'plain');
  const s = (a) => (a.length ? a.map((x) => x.toFixed(2)).join(' ') : '-');
  for (const [name, r] of Object.entries(res)) {
    console.log(name);
    for (const k of ways) {
      const x = r[k];
      const extra = k === 'mm' ? `  (matching ${(x.mmShare * 100).toFixed(0)} % of the time, ${x.jumps} jumps)` : k === 'moves' && x.moves ? `  (${Object.entries(x.moves).filter(([, v]) => v).map(([a, v]) => `${v} ${a}`).join(', ') || 'none'})` : '';
      console.log(`  ${k.padEnd(5)} ${fmt(x)}${x.face !== null ? `  face ${x.face.toFixed(2)} s` : ''}  step ${s(x.resp.starts)}  settled ${s(x.resp.stops)}${extra}`);
    }
    if (process.env.TAGS) {
      const t = Object.fromEntries(ways.map((k) => [k, byTag(r[k])]));
      for (const tag of Object.keys(Object.assign({}, ...Object.values(t)))) console.log(`    ${tag.padEnd(8)} ${ways.map((k) => `${k} ${t[k][tag] ? `${t[k][tag].max.toFixed(2)} / ${t[k][tag].mean.toFixed(3)}` : '-'}`).join('   ')}`);
    }
  }
}
