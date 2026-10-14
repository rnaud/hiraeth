// The Elder's cycles measured (issue #237): every review motion (tools/elder-drive.js) stepped at 60 Hz in node on the
// shipped skin, its skinned vertices sampled every frame. Per motion and per part (body, neck, head, each wing, tail,
// each leg):
//   snap     the largest change of a vertex's velocity in one frame (m/s): a pose's target that jumps, eased
//            exponentially, starts at full speed in a frame (a snap); a smooth move's is small (a wingbeat ~0.4)
//   pop      snap over the part's top speed: over POP, half its speed gained or lost in a frame (a pop, '!'); a
//            strike that ramps up over several frames stays under it
//   jerky    frames a second whose change is over SNAP (choppy motion)
//   moves    how far the part's vertices travel in the body's frame over the motion (m, median vertex): ~0 is frozen
//   floor    the lowest vertex under the floor (m; feet and tips through it)
// and the tearing: the most any sampled edge stretches or shrinks against the bind pose (ratio, and cm: tear, with the
// edges a frame off by more than 8 cm, torn).
//
//   node scripts/tripo/elder-cycles.mjs [--json out.json] [motion…]
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createElderCreature } from '../../src/characters/elder-v3-creature.js';
import * as fit from '../../src/characters/elder-v3-fit.js';
import { Guardian } from '../../src/temples/boss.js';
import { ELDER } from '../../src/temples/arzach.js';
import { driveElder } from '../../tools/elder-drive.js';

globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
export const SNAP = 1.5, POP = 0.5;
export const DURATION = { idle: 6, walk: 4, turn: 8, hover: 4, flightCycle: 12, wingsFolded: 3, wingsSpread: 3, sleep: 6, wake: 6, open: 6, weary: 6, resolved: 6, peck: 6, stamp: 6, buffet: 6, gale: 6, dive: 6, feathers: 6, encounter: 30 };
const PART = (name) => name === 'body' ? 'body' : name.startsWith('neck') ? 'neck' : name === 'head' || name === 'jaw' ? 'head' : name.startsWith('wing0') ? 'wingR' : name.startsWith('wing1') ? 'wingL' : name.startsWith('tail') ? 'tail' : name.startsWith('leg0') ? 'legR' : 'legL';

export async function loadElderGltf() {
  const bytes = fs.readFileSync(new URL('../../public/guardians/elder-v3/model.glb', import.meta.url));
  const len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
  for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  delete json.materials; delete json.textures; delete json.images;
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

/** Measure one motion: { motion, phase, parts: { name: { snap, at, jerky, moves, floor } }, stretch: [min, max] }. */
export function measure(gltf, motion, { phase = motion === 'hover' || motion === 'dive' ? 1 : 0, secs = DURATION[motion] ?? 6, every = 6 } = {}) {
  const model = createElderCreature(gltf, { fit }), mesh = model.meshes[0], g = mesh.geometry, A = g.attributes;
  const runtime = { def: { id: 'elder-cycles' }, root: new T.Group(), logic: { resolved: false }, notice() {}, player: { pos: new T.Vector3(0, 0, 9), dead: false }, physics: { groundAt: () => 0 } };
  const guard = new Guardian(runtime, { def: ELDER, model, arena: { center: new T.Vector3(), r: 20, y: 0 } });
  if (motion === 'encounter') { guard.state = 'sleep'; }
  const names = mesh.skeleton.bones.map((b) => b.name), idx = [], part = [];
  for (let i = 0; i < A.position.count; i += every) {
    let best = 0, w = 0; for (let k = 0; k < 4; k++) { const x = A.skinWeight.getComponent(i, k); if (x > w) { w = x; best = A.skinIndex.getComponent(i, k); } }
    idx.push(i); part.push(PART(names[best]));
  }
  // edges of the sampled triangles (every 40th) for the stretch
  const edges = [], I = g.index;
  for (let f = 0; f < I.count / 3; f += 40) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) edges.push([I.getX(f * 3 + a), I.getX(f * 3 + b)]);
  const edgePart = edges.map(([a]) => { let best = 0, w = 0; for (let k = 0; k < 4; k++) { const x = A.skinWeight.getComponent(a, k); if (x > w) { w = x; best = A.skinIndex.getComponent(a, k); } } return PART(names[best]); });
  const rest = edges.map(([a, b]) => new T.Vector3().fromBufferAttribute(A.position, a).distanceTo(new T.Vector3().fromBufferAttribute(A.position, b)));
  const n = idx.length, P = [new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3)], local = new Float32Array(n * 3), first = new Float32Array(n * 3), travel = new Float32Array(n);
  const parts = {}, v = new T.Vector3(), u = new T.Vector3(), inv = new T.Matrix4();
  for (const p of new Set(part)) parts[p] = { snap: 0, at: 0, jerky: 0, moves: 0, floor: 0, speed: 0 };
  let stretch = [1, 1], t = 0, tear = 0, torn = 0;
  const dt = 1 / 60, frames = Math.round(secs / dt);
  for (let f = 0; f < frames; f++) {
    t += dt;
    const shown = driveElder({ model, guard, t, dt, motion, phase });
    model.group.updateMatrixWorld(true);
    inv.copy(model.group.matrixWorld).invert();
    const cur = P[f % 3], p1 = P[(f + 2) % 3], p2 = P[(f + 1) % 3];
    const worst = {};
    for (let j = 0; j < n; j++) {
      mesh.getVertexPosition(idx[j], v); v.applyMatrix4(mesh.matrixWorld);
      cur[j * 3] = v.x; cur[j * 3 + 1] = v.y; cur[j * 3 + 2] = v.z;
      const q = parts[part[j]];
      q.floor = Math.min(q.floor, v.y - model.pos.y * (shown > 0 ? 1 : 0));
      u.copy(v).applyMatrix4(inv);
      if (f > 30) {
        if (f === 31) { first[j * 3] = u.x; first[j * 3 + 1] = u.y; first[j * 3 + 2] = u.z; }
        else travel[j] += Math.hypot(u.x - local[j * 3], u.y - local[j * 3 + 1], u.z - local[j * 3 + 2]);
      }
      local[j * 3] = u.x; local[j * 3 + 1] = u.y; local[j * 3 + 2] = u.z;
      if (f >= 2) {
        const dv = Math.hypot(cur[j * 3] - 2 * p1[j * 3] + p2[j * 3], cur[j * 3 + 1] - 2 * p1[j * 3 + 1] + p2[j * 3 + 1], cur[j * 3 + 2] - 2 * p1[j * 3 + 2] + p2[j * 3 + 2]) / dt;
        if (dv > (worst[part[j]] ?? 0)) worst[part[j]] = dv;
        const sp = Math.hypot(cur[j * 3] - p1[j * 3], cur[j * 3 + 1] - p1[j * 3 + 1], cur[j * 3 + 2] - p1[j * 3 + 2]) / dt;
        if (f > 30 && sp > parts[part[j]].speed) parts[part[j]].speed = sp;
      }
    }
    if (f >= 2 && f > 30) for (const [k, dv] of Object.entries(worst)) { const q = parts[k]; if (dv > q.snap) { q.snap = dv; q.at = +t.toFixed(2); } if (dv > SNAP) q.jerky++; }
    if (f % 10 === 0) for (let e = 0; e < edges.length; e++) {
      const [a, b] = edges[e]; mesh.getVertexPosition(a, v); mesh.getVertexPosition(b, u);
      const r = v.distanceTo(u) / Math.max(1e-6, rest[e]), cm = Math.abs(v.distanceTo(u) - rest[e]) * 100;
      if (cm > tear) tear = cm; if (cm > 8) torn++;
      if (rest[e] > 0.02) { const q = parts[edgePart[e]]; if (q) { q.squash = Math.min(q.squash ?? 1, r); q.stretch = Math.max(q.stretch ?? 1, r); } stretch[0] = Math.min(stretch[0], r); stretch[1] = Math.max(stretch[1], r); }
    }
  }
  const secsMeasured = (frames - 31) / 60;
  for (const k in parts) {
    const list = []; for (let j = 0; j < n; j++) if (part[j] === k) list.push(travel[j]);
    list.sort((a, b) => a - b);
    const q = parts[k]; q.moves = +list[Math.floor(list.length / 2)].toFixed(3); q.pop = +(q.snap / Math.max(q.speed, 1e-6)).toFixed(2); q.snap = +q.snap.toFixed(2); q.speed = +q.speed.toFixed(1); q.jerky = +(q.jerky / secsMeasured).toFixed(1); q.floor = +q.floor.toFixed(3); q.squash = +(q.squash ?? 1).toFixed(2); q.stretch = +(q.stretch ?? 1).toFixed(2);
  }
  model.dispose();
  return { motion, phase, parts, stretch: stretch.map((x) => +x.toFixed(2)), tear: +tear.toFixed(1), torn: +(torn / Math.ceil(frames / 10)).toFixed(1) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), json = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
  const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
  const gltf = await loadElderGltf(), out = [];
  for (const m of ids.length ? ids : Object.keys(DURATION)) {
    const [motion, ph] = m.split('@'), r = measure(gltf, motion, ph ? { phase: Number(ph) } : {});
    out.push(r);
    const cells = Object.entries(r.parts).map(([k, q]) => `${k} ${q.snap}/${q.speed}${q.snap > SNAP && q.pop > POP ? '!' : ''}@${q.at} mv${q.moves} e${q.squash}-${q.stretch}${q.floor < -0.05 ? ` fl${q.floor}` : ''}`).join(' | ');
    console.log(`${m.padEnd(12)} tear ${r.tear} cm, ${r.torn} edges >8 cm | stretch ${r.stretch.join('-')} | ${cells}`);
  }
  if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
}
