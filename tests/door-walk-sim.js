// A way through walked as main.js walks it (issue #389, src/door-walk.js), frame by frame on the game's own modules: the
// passage (its light, its paper, the move: src/passage.js) with no screen, the door walk, a real Player and the level's
// collision; the frame's order is main.js's: the passage first (the move happens there), then the input filtered by the
// walk, the traveller, and the ways through. tests/door-walk.test.js and the measuring script use it.
import * as THREE from 'three';
import { Passage, carryAcross, PASSAGE } from '../src/passage.js';
import { THRESHOLD, doorOf } from '../src/thresholds.js';
import { DoorWalk } from '../src/door-walk.js';

const DT = 1 / 60;
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const hspeed = (P) => Math.hypot(P.vel.x, P.vel.z);

/** The side of a portal's door one walks in from, and a spot `back` m out on that side on the ground (or null). */
export function approach(physics, pt, back = 3) {
  const door = doorOf(pt, physics);
  const n = new THREE.Vector3(Math.sin(door.yaw), 0, Math.cos(door.yaw));
  const guess = Math.sign(pt.at.clone().sub(door.at).dot(n)) || 1;
  const out = [];
  for (const sg of [guess, -guess]) {
    const p = door.at.clone().addScaledVector(n, -sg * (pt.r + back));
    const g = physics.groundAt(p.x, door.at.y + 1.5, p.z, 4);
    if (!Number.isFinite(g)) continue;
    p.y = g;
    out.push({ start: p, dir: n.clone().multiplyScalar(sg), door });
  }
  return out;
}

/**
 * Walk the player from `start` along `dir` (keys held: W, and Shift with `run`) into the level's ways through, as main.js
 * does, for `frames` frames or until the controls are back after a move. `hooks.frame(i, ctx)` may change the held keys
 * (return a new ctl) or knock him down. Returns the frames recorded and what happened.
 */
export function walkThrough({ physics, player: P, level }, { start, dir, run = false, frames = 240, hooks = {}, passageOpts = {} }) {
  const rig = { yaw: Math.atan2(dir.x, dir.z) + Math.PI, target: new THREE.Vector3(), _look: new THREE.Vector3(), _lastP: null };
  const camera = new THREE.PerspectiveCamera();
  const walk = new DoorWalk({ player: P, physics, rig });
  const passage = new Passage({ cover: null, warm: null, carry: (c) => carryAcross(P, rig, null, c), ...passageOpts });
  P.respawn(start.clone()); P.vel.set(0, 0, 0); P.onGround = true; P.heading = Math.atan2(dir.x, dir.z);
  P.climbing = false; P._climbCooldown = 0; P.doorWalk = null;
  camera.position.copy(start);
  const rec = [];
  let cool = 0, trig = -1, moved = -1, back = -1, portal = null, refused = 0, timings = null;
  for (let i = 0; i < frames; i++) {
    let ctl = { KeyW: true, ShiftLeft: run };
    ctl = hooks.frame?.(i, { P, walk, passage, trig, moved, rig, ctl }) ?? ctl;
    const ph = passage.update(DT);
    const inp = walk.input(ctl, DT, rig.yaw);
    quiet(() => P.update(DT, inp, rig.yaw));
    const r = { i, phase: passage.cur?.phase ?? null, walk: walk.phase, v: +hspeed(P).toFixed(3), pos: P.pos.clone(), climbing: !!P.climbing, taken: walk.active, heading: P.heading };
    rec.push(r);
    if (ph === 'hold' && moved < 0 && passage.moves) moved = i;
    if (moved >= 0 && back < 0 && !walk.active) back = i;
    // the ways through (main.js)
    cool = Math.max(cool - DT, 0);
    if (!cool && !passage.active && !P.riding && !P.dead) {
      for (const pt of level.portals ?? []) {
        if (!pt.at || !pt.to) continue;
        const d = P.pos.distanceTo(pt.at);
        if (pt.when && !pt.when()) { if (d < pt.r) { if (!pt._refusedSim) refused++; pt._refusedSim = true; } else if (d > pt.r + 3) pt._refusedSim = false; continue; }
        if (d < walk.reach(pt)) {
          timings = walk.enter(pt, { lead: THRESHOLD.lead, cover: PASSAGE.cover });
          if (!passage.go({ to: pt.to, heading: pt.heading, lead: timings.lead, cover: timings.cover, onMove: () => walk.arrive() })) walk.end();
          cool = 1.2 + THRESHOLD.lead + PASSAGE.cover + PASSAGE.reveal;
          trig = i; portal = pt; r.trigger = true;
          break;
        }
      }
    }
    if (back >= 0 && i > back + (hooks.after ?? 6)) break;
  }
  // (the move's frame: the first frame recorded after the passage carried him)
  if (moved < 0) { const k = rec.findIndex((r, j) => j > 0 && r.pos.distanceTo(rec[j - 1].pos) > 20); if (k > 0) moved = k; }
  return { rec, trig, moved, back, portal, refused, timings, walk, passage };
}

/** What a walk-through says: the pace up to the move, the steps in after it, when the controls came back (s). */
export function judge(res, pace) {
  const { rec, trig, moved, back } = res;
  const before = trig >= 0 && moved > trig ? rec.slice(trig + 1, moved) : [];
  const after = moved >= 0 ? rec.slice(moved, back >= 0 ? back + 1 : undefined) : [];
  const minBefore = before.length ? Math.min(...before.map((r) => r.v)) : null;
  const walkedIn = after.length > 1 ? after.at(-1).pos.distanceTo(after[0].pos) : 0;
  return {
    triggered: trig >= 0, moved: moved >= 0, back: back >= 0,
    minBefore, stopped: minBefore != null && minBefore < 0.5 * Math.min(pace, 3.8),
    climbed: rec.slice(trig + 1, moved > 0 ? moved : undefined).some((r) => r.climbing),
    walkedIn: +walkedIn.toFixed(2),
    toMove: moved > trig ? +((moved - trig) * DT).toFixed(3) : null,
    toControls: back > trig ? +((back - trig) * DT).toFixed(3) : null,
    perFrame: rec.slice(Math.max(trig, 0), back >= 0 ? back + 1 : undefined).map((r) => r.v.toFixed(1)).join(' '),
  };
}

export { DT, quiet };
