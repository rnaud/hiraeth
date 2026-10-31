// Roster v4's monsters, their shape pass (issue #726; docs/systems/foes.md, "Roster v4's monsters" and "The prowler and
// the warlord"): the bodies drawn closer to their picked sheets, measured where a silhouette can be. The warlord's ram
// horns stand out as big curls from the front and the side (not hidden in its mane); the prowler's head a long lizard's
// wedge (not a ball on a stick); the hulk's head thrust out before its chest; the hulk's club banded only. Posed with the
// clips: the grunt's club tilted back over its shoulder in the overhead's wind-up, the hulk standing tall on its other leg
// as it raises its stomp, the kilts hanging from the hips, the warlord's glaive on the sheet's diagonal winding up its
// sweep. The limbs lofted (muscle masses, not cylinders), the draws as they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Foes } from '../src/foes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { loftLimb, loftAlong, keyed } from '../src/enemies/plans/monster.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { HOLD_AT, setFoeClips } from '../src/enemies/humanoid-rig.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** A model's skinned meshes of one material (its bind pose: the body as built, standing). */
const part = (m, name) => { const out = []; m.group.updateMatrixWorld(true); m.group.traverse((o) => { if (o.isSkinnedMesh && (o.material.userData.cacheKey ?? '').includes(`.${name}"`)) out.push(o); }); return out; };
const verts = (meshes) => meshes.flatMap((o) => { const p = o.geometry.attributes.position; return Array.from({ length: p.count }, (_, i) => v().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); });
/**
 * How much of group `want` shows (m²) looking along +axis' opposite (from the front: 'z'; from its left side: 'x'):
 * every group's triangles rasterised on a 1 cm grid, the nearest kept.
 */
function shown(groups, want, axis = 'z', cell = 0.01) {
  const buf = new Map(), P = [v(), v(), v()];
  const u = (p) => (axis === 'z' ? p.x : -p.z), w = (p) => p.y, d = (p) => (axis === 'z' ? p.z : p.x);
  groups.forEach((meshes, gi) => { for (const o of meshes) {
    const pa = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pa.count;
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) P[k].fromBufferAttribute(pa, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld);
      const [a, b, c] = P, den = (w(b) - w(c)) * (u(a) - u(c)) + (u(c) - u(b)) * (w(a) - w(c));
      if (Math.abs(den) < 1e-12) continue;
      const x0 = Math.floor(Math.min(u(a), u(b), u(c)) / cell), x1 = Math.ceil(Math.max(u(a), u(b), u(c)) / cell);
      const y0 = Math.floor(Math.min(w(a), w(b), w(c)) / cell), y1 = Math.ceil(Math.max(w(a), w(b), w(c)) / cell);
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
        const X = (i + 0.5) * cell, Y = (j + 0.5) * cell;
        const l1 = ((w(b) - w(c)) * (X - u(c)) + (u(c) - u(b)) * (Y - w(c))) / den, l2 = ((w(c) - w(a)) * (X - u(c)) + (u(a) - u(c)) * (Y - w(c))) / den, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const z = l1 * d(a) + l2 * d(b) + l3 * d(c), key = i * 100000 + j, cur = buf.get(key);
        if (!cur || z > cur[0]) buf.set(key, [z, gi]);
      }
    }
  } });
  let n = 0; for (const [, [, gi]] of buf) if (gi === want) n++;
  return n * cell * cell;
}

test('the lofts: a limb ring by ring (its masses where the profile puts them, capped), a curve\'s tube; keys eased between', () => {
  const g = loftLimb(0.5, [[0, 0.05, 0.05], [0.4, 0.1, 0.08, 0.02], [1, 0.03, 0.03]], 1, 8, 2);
  g.computeBoundingBox();
  const b = g.boundingBox;
  assert.ok(Math.abs(b.min.y + 0.5) < 1e-6 && Math.abs(b.max.y) < 1e-6, 'down its joint, its length');
  assert.ok(b.max.x > 0.095 && b.max.z > 0.095 && b.min.z > -0.065, `the mass across it and moved forward (${b.max.x.toFixed(3)}, ${b.min.z.toFixed(3)}…${b.max.z.toFixed(3)})`);
  assert.ok(g.index && g.attributes.uv && g.attributes.normal, 'indexed, with uvs and normals (it merges with the kit\'s primitives)');
  const t = loftAlong([[0, 0, 0], [0, 0.5, 0.2], [0, 1, 0]], () => 0.05, () => 0.02, 6, 10, [0, 0, 1]);
  t.computeBoundingBox();
  assert.ok(t.boundingBox.max.y > 1 - 1e-6 && t.boundingBox.max.x < 0.051 && t.boundingBox.max.x > 0.04, 'along its curve, its section across it');
  assert.equal(keyed(0.5, [[0, 1], [1, 3]]), 2); assert.equal(keyed(-1, [[0, 1], [1, 3]]), 1); assert.equal(keyed(2, [[0, 1], [1, 3]]), 3);
});

test('the silhouettes: the warlord\'s ram horns show as big curls from the front and the side; the prowler\'s head a long wedge; the hulk\'s head thrust out; its club banded only', () => {
  const w = archetypeModel('warlord', 'desert', 0);
  const G = [part(w, 'horn'), part(w, 'mane'), part(w, 'skin')];
  // (before the pass: 0.104 m² from the front, 0.067 m² from the side; the horns hidden in its mane)
  const front = shown(G, 0, 'z'), side = shown(G, 0, 'x');
  assert.ok(front > 0.125, `the horns from the front: ${front.toFixed(3)} m²`);
  assert.ok(side > 0.09, `the horns from the side: ${side.toFixed(3)} m²`);
  const hv = verts(part(w, 'horn')).filter((p) => p.x > 0), ys = hv.map((p) => p.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.4, 'each horn a curl down past its ear');
  assert.ok(hv.filter((p) => p.x > 0.22).length / hv.length > 0.6, 'out past its skull');
  w.dispose();
  // the prowler's head: from its nape to its snout, deep all along (before: 0.62 m long, the snout 0.06 m deep)
  const p = archetypeModel('prowler', 'desert', 0);
  const head = verts([...part(p, 'skin'), ...part(p, 'belly')]).filter((q) => q.y > 1.56), zs = head.map((q) => q.z), zmax = Math.max(...zs);
  const snout = head.filter((q) => q.z > zmax - 0.16 && q.z < zmax - 0.1).map((q) => q.y);
  assert.ok(zmax - Math.min(...zs) > 0.6, `a long head: ${(zmax - Math.min(...zs)).toFixed(2)} m`);
  assert.ok(Math.max(...snout) - Math.min(...snout) > 0.1, `its snout deep, a wedge, not a stick: ${(Math.max(...snout) - Math.min(...snout)).toFixed(3)} m`);
  p.dispose();
  // the hulk's head before its chest (before: 3 cm), its club's iron its bands alone (before: 660 vertices with its studs)
  const h = archetypeModel('hulk', 'desert', 0), hs = verts(part(h, 'skin'));
  const face = Math.max(...hs.filter((q) => q.y > 2.1 && Math.abs(q.x) < 0.25).map((q) => q.z)), chest = Math.max(...hs.filter((q) => q.y > 1.7 && q.y < 2.05 && Math.abs(q.x) < 0.3).map((q) => q.z));
  assert.ok(face - chest > 0.07, `its head thrust out before its chest: ${(face - chest).toFixed(3)} m`);
  assert.ok(verts(part(h, 'iron')).length < 600, 'its club banded, no studs');
  h.dispose();
});

const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
test('with the clips: the grunt\'s club tilted back over its shoulder, the hulk tall on its other leg as it stomps, the kilts from the hips, the warlord\'s glaive on the diagonal', async () => {
  const [u, m, g] = await Promise.all([parse('ual.glb'), parse('moves.glb'), parse('gestures.glb')]);
  const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g);
  setFoeClips(lib);
  clearTargets();
  const P = { pos: v(0, 0, -6), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, stagger() {}, flinch() {}, guarding() { return false; }, guard() { return false; } };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded() });
  foes.setPractice('');
  const DT = 1 / 60, run = (f, n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } };
  const atk = (f, id) => f.def.attacks.find((a) => a.id === id);
  const wind = (f, id, k = HOLD_AT) => run(f, 16, () => { f.state = 'wind'; f.atk = atk(f, id); f.k = k; });
  const up = (node, frame) => { node.updateMatrixWorld(true); frame.updateMatrixWorld(true); return v(0, 1, 0).transformDirection(node.matrixWorld).applyQuaternion(frame.getWorldQuaternion(new THREE.Quaternion()).invert()); };
  const kilt = (f) => { const hem = f.model.group.getObjectByName('hem'); return up(hem, f.model.joints.body).angleTo(v(0, 1, 0)); };
  // the grunt: winding up the overhead, its club leans back over its right shoulder (the sheet's), not straight up
  {
    const f = foes.add('grunt', v()); f.provoked = true; f.heading = 0; f.state = 'chase'; f.weapon = 'club';
    run(f, 40);
    assert.ok(kilt(f) < 0.25, `its loincloth hangs from its hips (${kilt(f).toFixed(2)} rad)`);
    wind(f, 'club');
    const c = up(f.model.tell('club'), f.model.joints.torso);
    assert.ok(c.x < -0.45 && c.y > 0.2, `the club over its right shoulder, tilted (${c.toArray().map((x) => x.toFixed(2))})`);
    foes.remove(f);
  }
  // the hulk: its kilt from its hips walking; raising its stomp it stands up tall on its other leg, that foot still planted
  {
    const f = foes.add('hulk', v()); f.provoked = true; f.heading = 0; f.state = 'chase';
    const J = f.model.joints, W = (j) => { f.model.group.updateMatrixWorld(true); return j.getWorldPosition(v()); };
    for (let i = 0; i < 40; i++) { f.pos.z += 0.03; foes.look(f, DT); }
    assert.ok(kilt(f) < 0.25, `its kilt hangs from its hips, not its hunch (${kilt(f).toFixed(2)} rad)`);
    f.state = 'idle'; run(f, 30);
    wind(f, 'stomp', 0.02);
    const low = W(J.torso).y, foot0 = W(J.feet[1]);
    wind(f, 'stomp');
    const high = W(J.torso).y, foot1 = W(J.feet[1]);
    assert.ok(high > low + 0.1, `raised up over its standing leg (${(high - low).toFixed(2)} m)`);
    assert.ok(foot1.distanceTo(foot0) < 0.06, `its standing foot planted (${foot1.distanceTo(foot0).toFixed(3)} m)`);
    foes.remove(f);
  }
  // the warlord: winding up its sweep, the glaive over its shoulder at a slant (the sheet's), not upright
  {
    const f = foes.add('warlord', v()); f.provoked = true; f.heading = 0; f.state = 'chase';
    run(f, 40);
    wind(f, 'sweep');
    const d = up(f.model.tell('sweep'), f.model.joints.body), lean = Math.asin(Math.min(1, Math.abs(d.y)));
    assert.ok(lean > 0.3 && lean < 1.0, `the glaive at ${(lean * 180 / Math.PI).toFixed(0)}° over the level`);
    foes.remove(f);
  }
  foes.dispose(); clearTargets();
});
