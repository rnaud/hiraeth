// Nothing drawn on a temple's climb that the climber passes through (issue #740: "after I get the map I have to climb a
// wall but it has some planks on the wall so I go through them as I'm climbing. We shouldn't put things on the walls
// that I clip through as I'm climbing"). Every house is built with its kit watched (src/temples/kit.js add / solid):
// a drawn piece standing out 0.12 to 1 m from the face of one of the climbs (K.climbable), over the climb's height, and
// in no solid of its own, is in the climber's way. A lip of a few centimetres (the handholds sunk into the face) is not.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TempleKit } from '../src/temples/kit.js';
import { TEMPLES, TEMPLE_HOME } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';

/** How far out (m) a drawn piece may stand from a climb's face before the climber's body goes through it. */
export const CLIMB_FACE = { lip: 0.12, reach: 1.0 };

const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

/** The house `id` built, every drawn piece, solid and climb the kit made, as world boxes. */
function watched(id) {
  const rec = { climbs: [], solids: [], drawn: [] };
  const { add, solid } = TempleKit.prototype;
  TempleKit.prototype.add = function (mat, geo) {
    const before = new Map([...this.batches].map(([k, a]) => [k, a.length]));
    const r = add.call(this, mat, geo);
    for (const [k, a] of this.batches) if (a.length > (before.get(k) ?? 0)) { const g = a.at(-1); g.computeBoundingBox(); rec.drawn.push(g.boundingBox.clone()); }
    return r;
  };
  TempleKit.prototype.solid = function (geo) {
    const r = solid.call(this, geo), g = (this._climb ? this.climbs : this.proxies).at(-1);
    g.computeBoundingBox(); (this._climb ? rec.climbs : rec.solids).push(g.boundingBox.clone());
    return r;
  };
  try {
    const scene = new THREE.Scene(), level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
    quiet(() => level.init?.(new Physics(scene, level.ground?.heightAt ? level.ground : null)));
  } finally { Object.assign(TempleKit.prototype, { add, solid }); }
  return rec;
}

/** The drawn pieces in the climber's way on house `id`'s climbs: [{ out, at }]. */
export function climbFaults(id) {
  const { climbs, solids, drawn } = watched(id), all = [...solids, ...climbs], out = [];
  for (const C of climbs) for (const D of drawn) {
    if (Math.min(C.max.y, D.max.y) - Math.max(C.min.y, D.min.y) < 0.1) continue;
    const xo = Math.min(C.max.x, D.max.x) - Math.max(C.min.x, D.min.x), zo = Math.min(C.max.z, D.max.z) - Math.max(C.min.z, D.min.z);
    // (out of an x face, alongside it in z; or out of a z face, alongside it in x)
    const ox = zo > 0.05 && xo > -0.3 ? Math.max(C.min.x - D.min.x, D.max.x - C.max.x) : 0;
    const oz = xo > 0.05 && zo > -0.3 ? Math.max(C.min.z - D.min.z, D.max.z - C.max.z) : 0;
    const o = Math.max(ox, oz);
    if (o < CLIMB_FACE.lip || o > CLIMB_FACE.reach) continue;
    if (all.some((S) => S !== C && S.containsBox(D.clone().expandByScalar(-0.05)))) continue;
    out.push({ out: +o.toFixed(2), at: D.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)) });
  }
  return out;
}

test('no temple draws anything on a climb that the climber passes through (issue #740)', () => {
  const faults = [];
  for (const id of Object.keys(TEMPLES)) for (const f of climbFaults(id)) faults.push(`${id}: ${f.out} m out of its climb at ${f.at.join(', ')}`);
  assert.deepEqual(faults, []);
});
