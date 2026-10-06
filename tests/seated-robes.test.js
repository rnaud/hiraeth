import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// "Robes, outfits should not clip through things like benches when characters are sitting." A robe's
// lower part followed the thighs at three quarters of their swing: seated, the thighs forward, it stood
// out from the lap as a ring round the knees, through the bench under and in front of them. Seated
// people now wear it shaped and weighted for sitting (Humanoid.sitRobe, robeGeometry): snug over the lap,
// close under the thighs, falling from the knees in front of the shins. The crowd's figures do the same
// in their shader, whose robe also no longer turns with the right arm (it went up over a sitter's head,
// and swung out like a flag on a walker).

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { Humanoid } = await import('../src/humanoid.js');
const { parseBody } = await import('../src/makehuman/body.js');
const { personTemplate } = await import('../src/makehuman/people.js');
const { buildCharacter } = await import('../src/player.js');
const { CROWD_GLSL, ROBE_SEAT } = await import('../src/crowd-shader.js');

const V = () => new THREE.Vector3();
const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const at = (b) => b.getWorldPosition(V());

/** A villager in a robe, seated as NPC.posture's pose 4 (the thighs up 1.8 rad, the shins down). */
function sitter(robe, flare = 0.36) {
  const h = new Humanoid(personTemplate(data, { kind: 'm', world: 'desert' }), buildCharacter(), 'm');
  h.dress({ head: 'none', mask: 'none', body: 'none', prop: 'none', robe, flare, kind: 'm' });
  const c = h.char;
  for (let i = 0; i < 2; i++) { c.legs[i].rotation.set(-1.8, 0, 0); c.knees[i].rotation.set(1.8, 0, 0); }
  h.update(); c.root.updateMatrixWorld(true);
  return h;
}
/** The robe's vertices as drawn now (the ones the seated geometry moves or weighs otherwise), and its hem's. */
function robe(h) {
  const m = h._costume[0], { stand, seat } = m.userData.poses, n = stand.attributes.position.count;
  const ids = [];
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let k = 0; k < 4; k++) d += Math.abs(stand.attributes.skinWeight.getComponent(i, k) - seat.attributes.skinWeight.getComponent(i, k)) + Math.abs(stand.attributes.skinIndex.getComponent(i, k) - seat.attributes.skinIndex.getComponent(i, k));
    for (let k = 0; k < 3; k++) d += Math.abs(stand.attributes.position.getComponent(i, k) - seat.attributes.position.getComponent(i, k));
    if (d > 1e-5) ids.push(i);
  }
  m.skeleton.update(); m.updateMatrixWorld(true);
  const pts = ids.map((i) => m.localToWorld(m.getVertexPosition(i, V())));
  const low = Math.min(...ids.map((i) => stand.attributes.position.getY(i)));
  const hem = ids.flatMap((i, k) => (stand.attributes.position.getY(i) < low + 0.01 ? [pts[k]] : []));
  return { pts, hem };
}
const mean = (pts, k) => pts.reduce((s, p) => s + p[k], 0) / pts.length;

test('seated, a long robe falls from the knees in front of the shins (it stood out round them, through the bench)', () => {
  const h = sitter(0.12);
  const knee = at(h.b.calf_l).add(at(h.b.calf_r)).multiplyScalar(0.5), hip = at(h.b.thigh_l).add(at(h.b.thigh_r)).multiplyScalar(0.5);
  // the bench: its top under the thighs, its front edge 0.12 m before the hips (NPC: "a little behind the edge")
  const top = hip.y - 0.1, edge = hip.z + 0.12;
  const inBench = (pts) => pts.filter((p) => p.y < top && p.z < edge).length;
  const before = robe(h);
  assert.ok(mean(before.hem, 'y') > knee.y - 0.2, `standing weights: the hem round the knees (${mean(before.hem, 'y').toFixed(2)} m, the knees at ${knee.y.toFixed(2)})`);
  h.sitRobe(true); h.char.root.updateMatrixWorld(true);
  assert.equal(h._costume[0].geometry, h._costume[0].userData.poses.seat);
  const after = robe(h);
  assert.ok(mean(after.hem, 'y') < knee.y - 0.3, `seated: the hem down by the feet (${mean(after.hem, 'y').toFixed(2)} m)`);
  assert.ok(Math.max(...after.hem.map((p) => p.z)) < knee.z + 0.4, 'not jutting out ahead of the knees');
  assert.ok(inBench(before.pts) > 3, `standing weights: the robe in the bench (${inBench(before.pts)} points)`);
  assert.equal(inBench(after.pts), 0, 'seated: none of it in the bench');
  // over the lap: the robe's top over the thighs stays close to them (no funnel round the knees)
  const lap = after.pts.filter((p) => p.z > hip.z + 0.1 && p.z < knee.z - 0.05);
  assert.ok(Math.max(...lap.map((p) => p.y)) < Math.max(hip.y, knee.y) + 0.25, 'snug over the lap');
  // standing again: the robe as it was
  h.sitRobe(false);
  assert.equal(h._costume[0].geometry, h._costume[0].userData.poses.stand);
});

test('seated, a short robe lies over the lap, its hem not a brim round it', () => {
  const h = sitter(0.4, 0.4);
  h.sitRobe(true); h.char.root.updateMatrixWorld(true);
  const knee = at(h.b.calf_l).add(at(h.b.calf_r)).multiplyScalar(0.5), hip = at(h.b.thigh_l).add(at(h.b.thigh_r)).multiplyScalar(0.5);
  const { hem } = robe(h);
  const wide = Math.max(...hem.map((p) => Math.abs(p.x)));
  assert.ok(wide < 0.3, `its hem ${wide.toFixed(2)} m out to the side (a flared brim was 0.4)`);
  assert.ok(Math.min(...hem.map((p) => p.y)) > Math.min(hip.y, knee.y) - 0.35, 'not hanging into the seat');
});

test('the crowd\'s seated figures wear the robe the same way, and it no longer turns with an arm', () => {
  assert.match(CROWD_GLSL, /if \(seated\) \{/);
  assert.ok(CROWD_GLSL.includes(`smoothstep(${ROBE_SEAT.knee[0].toFixed(3)}, ${ROBE_SEAT.knee[1].toFixed(3)}, KNEE - p.y)`), 'past the knees with the shins');
  // the arms' turn is for the arms alone (parts 6..9): the robe (11) went through it
  assert.match(CROWD_GLSL, /\} else if \(part >= 6 && part <= 9\) \{\s+\/\/ the arms/);
  assert.doesNotMatch(CROWD_GLSL, /part != 0 && part != 10 && part != 1\)/);
});
