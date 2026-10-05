// The benchmark's viewpoints and paths over the desert, defined once for the web game and the Unity
// port (scripts/bench/README: docs/benchmark-web-vs-unity.md). Builds the desert headlessly as the
// Unity export does and writes scripts/bench/viewpoints.json:
//   node scripts/bench/viewpoints.mjs
// Everything is in the web game's coordinates (three.js, right-handed); Unity mirrors x (Bench.cs).
// Each view: where the traveller stands (`player`, his heading `heading` in radians, three.js yaw),
// the camera's eye, target and vertical fov. Each path: points every metre along the ground with the
// eye and target over each, walked at `speed` m/s for `secs` seconds. The hour and the weather are
// fixed for both sides.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDesertWorld } from '../unity-export/build-world.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const log = console.log;
console.log = console.info = console.warn = () => {};
const W = await buildDesertWorld();
const { level, physics, ship, THREE } = W;
const Q = level.qanat;
const r3 = (v) => v.map((x) => +x.toFixed(3));
/** the ground (or roof, rock, terrace) under x, z */
const ground = (x, z, from = 400) => {
  const y = physics.groundAt(x, from, z, from + 200);
  return Number.isFinite(y) ? y : level.ground.heightAt(x, z);
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const yawOf = (dx, dz) => Math.atan2(dx, dz);

/** a third-person frame: the traveller at p facing dir, the camera behind and above as the rig holds it */
function behind(p, dir, { back = 9.5, up = 3.9, look = 1.8, ahead = 2 } = {}) {
  const d = dir.clone().setY(0).normalize();
  const eye = p.clone().addScaledVector(d, -back); eye.y = p.y + up;
  const target = p.clone().addScaledVector(d, ahead); target.y = p.y + look;
  return { eye, target };
}

const views = [];
const view = (name, note, player, heading, eye, target, fov = 55) =>
  views.push({ name, note, player: r3(player.toArray()), heading: +heading.toFixed(4), eye: r3(eye.toArray()), target: r3(target.toArray()), fov });

// 1. spawn: out of the ship at the foot of its ramp, facing out (Play.cs / main.js)
{
  const ramp = ship.rampFoot.clone(), site = V(ship.site.x, ramp.y, ship.site.z);
  const out = ramp.clone().sub(site).setY(0).normalize();
  const p = ramp.clone().addScaledVector(out, 1.5); p.y = ground(p.x, p.z, ramp.y + 5);
  const { eye, target } = behind(p, out);
  view('spawn', 'the foot of the ship\'s ramp, looking out over the dunes', p, yawOf(out.x, out.z), eye, target);
}
// 2. Qanat by the burning tree: on the plinth's stair, looking up at its crown (views.mjs "tree")
{
  const s = Q.city.plinthStair, tree = Q.city.treeBase;
  const d = V(tree.x - s.x, 0, tree.z - s.z).normalize();
  const p = V(s.x, s.y, s.z).addScaledVector(d, 2); p.y = ground(p.x, p.z, s.y + 4);
  view('qanat-tree', 'Qanat: the plinth\'s stair under the burning tree', p, yawOf(d.x, d.z), V(s.x, s.y + 2, s.z).addScaledVector(d, -3), V(tree.x, tree.y + 14, tree.z), 60);
}
// 3. the camps and their people round the fires (views.mjs "camps", the traveller between)
{
  const f = Q.camps.fires[0];
  const e = V(f.x - 14, ground(f.x - 14, f.z - 16) + 3, f.z - 16);
  const d = V(f.x - e.x, 0, f.z - e.z).normalize();
  const p = e.clone().addScaledVector(d, 6); p.y = ground(p.x, p.z);
  view('camps', 'the camps: the fires and the crowd round them', p, yawOf(d.x, d.z), e, V(f.x, f.y + 1.2, f.z));
}
// 4. the wide dune vista, 18 m over a dune crest (views.mjs "dunes")
{
  const e = V(-200, ground(-200, 300) + 18, 300), t = V(-420, ground(-420, 520), 520);
  const d = t.clone().sub(e).setY(0).normalize();
  const p = V(-200, 0, 300).addScaledVector(d, 8); p.y = ground(p.x, p.z);
  view('dunes', 'the open dunes from a crest: the widest view', p, yawOf(d.x, d.z), e, t);
}
// 5. the cave under the skull: inside, looking towards the pool (a room off the map)
{
  const c = Q.cave, i = c.inside, pool = c.poolCenter;
  const d = V(pool.x - i.x, 0, pool.z - i.z).normalize();
  const p = V(i.x, i.y, i.z).addScaledVector(d, 3); p.y = ground(p.x, p.z, i.y + 3);
  const e = V(i.x, i.y + 2.2, i.z).addScaledVector(d, -1.5);
  view('cave', 'the cave under the skull, towards the pool', p, yawOf(d.x, d.z), e, V(pool.x, pool.y + 1.5, pool.z), 60);
}

/** points every metre along a polyline of [x, z], on the ground, each with its third-person frame */
function path(name, note, xz, { speed, secs, back, up }) {
  const pts = [];
  for (let k = 0; k + 1 < xz.length; k++) {
    const [ax, az] = xz[k], [bx, bz] = xz[k + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
    for (let j = 0; j < n; j++) { const u = j / n; pts.push([ax + (bx - ax) * u, az + (bz - az) * u]); }
  }
  pts.push(xz[xz.length - 1]);
  // (each point's ground looked for a few metres over the last one's, so a path under an arch stays
  // on the road and doesn't climb onto the arch: the city gate)
  let last = ground(pts[0][0], pts[0][1]);
  const ps = pts.map(([x, z]) => { last = ground(x, z, last + 3); return V(x, last, z); });
  // the ground smoothed a little (a ridden bike doesn't follow every step of a stair)
  const ys = ps.map((p, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(ps.length - 1, i + 2); j++) { s += ps[j].y; n++; } return s / n; });
  const out = ps.map((p, i) => {
    const a = ps[Math.max(0, i - 6)], b = ps[Math.min(ps.length - 1, i + 6)];
    const d = b.clone().sub(a).setY(0).normalize();
    const q = V(p.x, ys[i], p.z);
    const { eye, target } = behind(q, d, { back, up });
    return { p: r3(q.toArray()), h: +yawOf(d.x, d.z).toFixed(4), eye: r3(eye.toArray()), target: r3(target.toArray()) };
  });
  const length = pts.length - 1;
  if (length < speed * secs) throw new Error(`${name}: ${length} m is shorter than ${speed * secs} m`);
  return { name, note, speed, secs, step: 1, fov: 55, points: out };
}
const C = Q.camps.center, G = Q.city.gate, S = Q.city.plinthStair, B = W.bike.pos;
const paths = [
  // riding the hoverbike from where it waits, past the camps, through the gate into Qanat, round the tree
  path('ride-city', 'riding from the hoverbike\'s hollow past the camps, through the gate into Qanat', [
    [B.x, B.z], [148, 228], [158, 268], [182, 318], [G.x, G.z], [S.x, S.z], [222, 385], [238, 392], [248, 410], [240, 428], [222, 440],
  ], { speed: 12, secs: 20, back: 7, up: 3.2 }),
  // walking round the camps, through the crowd
  path('walk-camps', 'walking round the camps, among the people', Array.from({ length: 41 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2 * 1.1; return [C.x + Math.cos(a) * 15, C.z + Math.sin(a) * 15];
  }), { speed: 3.8, secs: 20, back: 9.5, up: 3.9 }),
];

const out = {
  about: 'Memento benchmark viewpoints over the desert (scripts/bench/viewpoints.mjs). three.js coordinates; Unity mirrors x.',
  hour: 10,
  weather: 'clear',
  warmup: 3,
  secs: 10,
  resolutions: [[1280, 720], [1280, 960]],
  presets: ['high', 'handheld'],
  views,
  paths,
};
writeFileSync(resolve(here, 'viewpoints.json'), JSON.stringify(out, null, 1) + '\n');
log(`wrote ${views.length} views, ${paths.length} paths (${paths.map((p) => `${p.name} ${p.points.length - 1} m`).join(', ')})`);
process.exit(0);
