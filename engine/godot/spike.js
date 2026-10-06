// The spike, Godot side: the desert built in GodotJS's V8 by the game's own modules, mirrored to
// Godot nodes, drawn through the ink shaders, the frame saved as a PNG.
//   godot --path godot -- --entry=spike --level=desert --shot=/abs/out.png
import './host.js';
import godot from 'godot';   // (the default import: GodotJS's module is a lazy proxy, a namespace copy of it would be empty)
import { buildSpike } from '../spike.js';
import { GodotBackend } from './backend.js';
import { makeStage, aimSun, savePng, userArgs, batchExit } from './stage.js';
import { godotParams } from './look.js';

let S = null;

export function start(owner) {
  const args = userArgs();
  const t0 = Date.now();
  const stage = makeStage(owner);
  const backend = new GodotBackend(stage.root, { shaders: stage.shaders, materialParams: godotParams });
  backend.cam = stage.cam;
  backend.sun = (s) => aimSun(stage.sun, s.dir);
  const r = buildSpike({ levelId: args.level ?? 'desert', backend });
  console.log(`[spike] ${args.level ?? 'desert'}: built in ${r.ms.build.toFixed(0)} ms, mirrored in ${r.ms.mirror.toFixed(0)} ms (Godot side ${JSON.stringify(backend.stats.ms)}), total ${Date.now() - t0} ms`);
  console.log(`[spike] mirror ${JSON.stringify(r.stats)}`);
  console.log(`[spike] godot ${JSON.stringify({ meshes: backend.stats.meshes, surfaces: backend.stats.surfaces, nodes: backend.stats.nodes, vertices: backend.stats.vertices, triangles: backend.stats.triangles })}`);
  S = { args, stage, backend, r, frames: 0 };
}

export function frame(owner, dt) {
  if (!S) return;
  S.frames++;
  if (S.args.shot && S.frames === Number(S.args.frames ?? 8)) {
    const err = savePng(owner, S.args.shot);
    console.log(`[spike] saved ${S.args.shot} (${err === 0 ? 'ok' : 'error ' + err})`);
    batchExit(owner);
  }
}
