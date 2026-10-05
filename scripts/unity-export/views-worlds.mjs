// Fixed viewpoints over every exported world, in the web game's coordinates, for side-by-side
// screenshots of the web game (web-shots.mjs) and the Unity port (unity-batch.sh Shots):
//   node scripts/unity-export/views-worlds.mjs [ids…] > views.json
// From each world's export (world.json, Unity's frame, mirrored back): out of the ship at the
// foot of its ramp, looking out; the first person the world's main quest sends you to; a
// view over the ship's site from up high. Each view carries its world ("world": id).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SA = resolve(here, '../../unity/Memento/Assets/StreamingAssets');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar', 'home'];
const web = (v) => [-v[0], v[1], v[2]];
const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k);
const r2 = (v) => v.map((x) => +x.toFixed(2));
const views = [];
for (const id of ids) {
  const f = resolve(SA, id, 'world.json');
  if (!existsSync(f)) continue;
  const W = JSON.parse(readFileSync(f, 'utf8'));
  const S = JSON.parse(readFileSync(resolve(SA, id, 'story.json'), 'utf8'));
  const P = W.places;
  const ramp = web(P.shipRamp), site = web(P.shipSite);
  const out = [ramp[0] - site[0], 0, ramp[2] - site[2]]; const ol = Math.hypot(out[0], out[2]) || 1; out[0] /= ol; out[2] /= ol;
  const side = [-out[2], 0, out[0]];
  views.push({ world: id, name: `${id}-ramp`, eye: r2(add(add(ramp, out, 3), [0, 2.4, 0])), target: r2(add(add(ramp, out, 40), [0, 2, 0])), fov: 60 });
  views.push({ world: id, name: `${id}-ship`, eye: r2(add(add(add(ramp, out, 34), side, 22), [0, 6, 0])), target: r2(add(site, [0, 4, 0])), fov: 55 });
  // the first person the main quest names (its first stage's talk / at)
  const main = (S.quests ?? []).find((q) => q.main) ?? S.quests?.[0];
  const st = main?.stages?.[0];
  const who = st?.talk ?? st?.at;
  const person = W.people.find((p) => p.id === who);
  if (person) {
    const p = web(person.pos);
    const to = [ramp[0] - p[0], 0, ramp[2] - p[2]]; const tl = Math.hypot(to[0], to[2]) || 1; to[0] /= tl; to[2] /= tl;
    views.push({ world: id, name: `${id}-${who}`, eye: r2(add(add(p, to, 5.5), [0, 2.0, 0])), target: r2(add(p, [0, 1.2, 0])), fov: 50 });
  }
  views.push({ world: id, name: `${id}-high`, eye: r2(add(add(site, out, -60), [0, 70, 0])), target: r2(add(site, out, 120)), fov: 60 });
}
console.log(JSON.stringify(views, null, 1));
