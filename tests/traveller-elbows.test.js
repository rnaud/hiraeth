// The v2 traveller's elbows and knees bend the right way (#548; the author: "in the outfits you are showing me why
// are the arms bent backwards?"). The cause was the previews' lowered pose (scripts/blender/traveller/poses.py,
// LOWERED, and its copy in previews.py): the forearms' turns about the armature's z had their signs the wrong way
// round for a rig facing -y, so in every posed picture the elbows bent backwards, the hands out behind, palms
// forward. Measured here: that pose read from poses.py on the v2 skeleton's rest (bent forward now, the knee back);
// and the game's own clips (idle, walk, run) on B3 with the v2 skin bound to its skeleton by bone name, as the
// outfits page binds it (src/characters/outfit-page.js): its forearms bend as B3's skeleton does, forward.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { readFileSync } from 'node:fs';
const DIR = 'data/characters/traveller-v2/';
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));

/** The lowered pose as poses.py writes it: { bone: [[axis, degrees], ...] } (a Python dict of tuples, read as JS). */
function lowered() {
  const src = readFileSync('scripts/blender/traveller/poses.py', 'utf8');
  const consts = Object.fromEntries([...src.matchAll(/^([A-Z_]+) = (-?[\d.]+)\b/gm)].map((m) => [m[1], Number(m[2])]));
  const text = /^LOWERED = (\{[\s\S]*?\})\n/m.exec(src)[1].replace(/\(/g, '[').replace(/\)/g, ']');
  const raw = new Function(...Object.keys(consts), `return ${text};`)(...Object.values(consts));
  // one turn [axis, deg] or a list of them
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v[1] === 'number' ? [v] : v]));
}
// Blender's frame (z up, facing -y) from the manifest's (the game's: y up, facing +z)
const blender = ([x, y, z]) => new T.Vector3(x, -z, y);
const head = (n) => blender(manifest.skeleton[n].head);
/** A bone's turns as one rotation in the armature's frame, made in order (poses.turn). */
const turned = (turns = []) => turns.reduce((q, [axis, deg]) => new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis).normalize(), deg * Math.PI / 180).multiply(q), new T.Quaternion());
/** (degrees between the two bones, the lower one's lean toward the upper one's front) for a chain a → b → c. */
function bendOf(u, f, front) {
  const perp = f.clone().addScaledVector(u, -f.dot(u));
  return { deg: u.angleTo(f) * 180 / Math.PI, lean: perp.dot(front) };
}

test('the previews\' lowered pose bends the elbows forward and the knee back (poses.py)', () => {
  const P = lowered();
  for (const s of ['l', 'r']) {
    const qu = turned(P[`upperarm_${s}`]), qf = qu.clone().multiply(turned(P[`lowerarm_${s}`]));
    const u = head(`lowerarm_${s}`).sub(head(`upperarm_${s}`)).normalize().applyQuaternion(qu);
    const f = head(`hand_${s}`).sub(head(`lowerarm_${s}`)).normalize().applyQuaternion(qf);
    const b = bendOf(u, f, new T.Vector3(0, -1, 0).applyQuaternion(qu));
    assert.ok(b.deg > 20 && b.lean > 0.3, `elbow ${s}: bent ${b.deg.toFixed(0)}°, toward his front ${b.lean.toFixed(2)} (below 0: backwards)`);
  }
  const qt = turned(P.thigh_l), qc = qt.clone().multiply(turned(P.calf_l));
  const u = head('calf_l').sub(head('thigh_l')).normalize().applyQuaternion(qt);
  const f = head('foot_l').sub(head('calf_l')).normalize().applyQuaternion(qc);
  const b = bendOf(u, f, new T.Vector3(0, -1, 0).applyQuaternion(qt));
  assert.ok(b.deg > 20 && b.lean < -0.3, `knee l: bent ${b.deg.toFixed(0)}°, toward his front ${b.lean.toFixed(2)} (a knee bends back)`);
  // and the previews' own copy is that pose (previews.py once had its own, the same wrong signs)
  assert.match(readFileSync('scripts/blender/traveller/previews.py', 'utf8'), /\*\*PZ\.LOWERED/);
});
