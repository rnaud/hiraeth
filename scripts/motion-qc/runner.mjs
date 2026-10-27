// Importable motion harness: command-line tuning and output stay in run.mjs.
import * as THREE from 'three';
import { course, traveller } from '../../tests/gait-sim.js';
import { CAM_PLUS_Z } from '../../src/gait-course.js';
import { analyse } from './lib.mjs';
import { sample, metaOf, stickOf, timeAnimator } from './sample.mjs';

// (every way stops from a run as the game does, carried over two strides (src/loco-moves.js STOP_FEEL, the default since
// issue #702); snap: the default way with the old crisp stop, ?stop=snap; every way sprints
// Kevin Iglesias's sprint, the game's since issue #709 (src/animator.js SPRINTS); ual: the default way with the library's
// old sprint, ?sprint=ual)
export const WAYS = { loops: { matching: false, moves: false }, moves: { matching: false, moves: true }, mm: { matching: true, moves: false }, snap: { matching: false, moves: true, stop: 'snap' }, ual: { matching: false, moves: true, sprint: 'ual' } };

/**
 * One scenario one way: { samples, meta, r (lib.analyse) }. o.frames(k): frame k's dt (the game's uneven frames; default
 * 1 / fps); o.sprint: his sprint over the way's (src/animator.js SPRINTS).
 */
export async function runScenario(sc, way, { body = 'b3', fps = 60, onFrame = null, frames = null, sprint = null } = {}) {
  const p = await traveller(course(), new THREE.Vector3(...sc.at), { ...WAYS[way], body, ...(sprint ? { sprint } : {}) });
  p.stopFeel = WAYS[way].stop ?? 'carry';
  timeAnimator(p.animator);
  const S = [], st = {};
  let t = 0, k = 0;
  for (const [secs, input, tag] of sc.script) {
    // (uneven frames: a phase lasts its seconds, however many frames that takes)
    const n = frames ? Infinity : Math.round(secs * fps);
    for (let i = 0, u = 0; i < n && (!frames || u < secs - 1e-9); i++) {
      const dt = frames ? frames(k) : 1 / fps;
      k++; u += dt;
      p.update(dt, input, CAM_PLUS_Z);
      p.object.updateMatrixWorld(true);
      S.push(sample(p, st, { t, dt, tag, stick: stickOf(input), run: !!input.ShiftLeft }));
      onFrame?.(p, S.length - 1, S[S.length - 1]);
      t += dt;
    }
  }
  const meta = { ...metaOf(p), fps };
  return { samples: S, meta, r: analyse(S, meta) };
}

