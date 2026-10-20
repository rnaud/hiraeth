// The memory of water (issue #167; src/desert-water.js, src/story/desert-water.js): the dry wash's tide lines and
// stranded boats, the salt pan and the mirage over it, the qanat wells to listen at, and the pan flooding when the tree
// drinks (the roots, issue #161).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadWorld } from './playthrough-agent.js';
import { allInteractables } from '../src/interact.js';
import { game } from '../src/game-state.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { Waters } from '../src/water.js';
import { THINGS } from '../src/story/desert-data.js';
import { STORY, SALT_PAN, processionLoop, GIANTS } from '../src/desert-sites.js';
import { WASH } from '../src/desert-landmarks.js';
import { MIRAGE, FLOOD } from '../src/desert-water.js';
import { FLOOD_CUE } from '../src/story/desert-water.js';
import { MODE_WATER } from '../src/materials.js';
import { channelPath, CHANNEL } from '../src/temples/desert.js';

game.set('desert.well.watched', false);
const W = loadWorld('desert');
const { level, physics, rt } = W;
const Wm = level.water, P = Wm.pan;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lines = () => { const r = new DialogueRunner(THINGS.qanatWell, { game, quests: rt.quests }); const out = [r.text]; while (!r.ended && r.advance()) out.push(r.text); return out.join(' '); };

test('the salt pan: level white ground where the dry wash ends, the procession\'s circuit across it', () => {
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, d = (k % 4) / 4 * (P.r - 6), x = P.at.x + Math.cos(a) * d, z = P.at.z + Math.sin(a) * d;
    assert.ok(Math.abs(level.ground.heightAt(x, z) - P.level) < 0.05, `level at ${x.toFixed(0)}, ${z.toFixed(0)}`);
  }
  const end = WASH.points[WASH.points.length - 1];
  assert.ok(Math.hypot(end[0] - SALT_PAN.x, end[1] - SALT_PAN.z) < SALT_PAN.r + 10, 'the wash runs into it');
  assert.ok(processionLoop(5).some(([x, z]) => Math.hypot(x - P.at.x, z - P.at.z) < P.r - 10), 'the procession walks across it');
  // the crust drawn a hair over the ground (you walk on it)
  const crust = Wm.meshes.salt.geometry.attributes.position;
  for (let i = 0; i < crust.count; i += 7) assert.ok(crust.getY(i) - level.ground.heightAt(crust.getX(i), crust.getZ(i)) < 0.06);
});

test('a mirage of the old lake hangs over the pan from afar, and sinks away as you come near', () => {
  const cam = new THREE.PerspectiveCamera(), at = (d) => { cam.position.set(P.at.x + d, P.level + 2, P.at.z); Wm.update(1 / 30, 1, { camera: cam }); };
  at(MIRAGE.far + 30);
  assert.ok(Wm.mirage.visible && Wm.mirage.scale.y > 0.95, 'far off: there');
  at((MIRAGE.near + MIRAGE.far) / 2);
  assert.ok(Wm.mirage.visible && Wm.mirage.scale.y < 0.8, 'nearer: sinking');
  at(MIRAGE.near - 20);
  assert.equal(Wm.mirage.visible, false, 'close: gone');
  Wm.mirage.traverse((o) => { if (o.isMesh) assert.ok(o.userData.noCollide && o.userData.water === false, 'not water, not ground'); });
});

test('the qanat wells: a line from the giant\'s hand to Qanat, the water nearer at every one you listen at', () => {
  assert.equal(Wm.wells.length, 5);
  const hand = V(GIANTS.hand.x, 0, GIANTS.hand.z), city = V(STORY.city.x, 0, STORY.city.z);
  for (let i = 1; i < 5; i++) assert.ok(flat(Wm.wells[i].at, city) < flat(Wm.wells[i - 1].at, city), 'each nearer the city');
  assert.ok(flat(Wm.wells[0].at, hand) < 40 && flat(Wm.wells[4].at, city) > 70, 'from the hand to outside the walls');
  const listen = allInteractables().filter((e) => /^water\.well/.test(e.id));
  assert.equal(listen.length, 5);
  assert.ok(listen.every((e) => e.prompt === 'listen at the well'));
  assert.ok(level.lines().some((l) => l.name === 'the qanat wells' && l.points.length === 5), 'a leading line for the level design audit');
  const heard = [];
  for (const k of [0, 1, 2]) { listen[k].use(); rt.dialogue.close?.(); heard.push(lines()); }
  assert.match(heard[0], /Far down/);
  assert.match(heard[1], /Nearer than at the last well/);
  assert.match(heard[2], /Close under you/);
  listen[0].use(); rt.dialogue.close?.();
  assert.match(lines(), /Close under you/, 'the same wells again: still as near');
});

test('the dry wash keeps the river\'s marks: two boats stranded on its banks', () => {
  assert.equal(Wm.boats.length, 2);
  for (const b of Wm.boats) {
    const { s } = WASH.nearest(b.at.x, b.at.z);
    assert.ok(s > WASH.opt.bed && s < WASH.opt.bed + WASH.opt.bank, `on a bank (${s.toFixed(1)} m from the line)`);
  }
  assert.ok(Wm.meshes.stain.geometry.attributes.position.count > 100, 'tide lines along the banks');
});

test('when the tree drinks the pan floods: a shallow water rising over half a minute, the wells wet, a line once', () => {
  const waters = new Waters(W.scene, { drops: false });
  assert.equal(Wm.flood.visible, false, 'dry before');
  assert.equal(waters.surfaceAt(P.at.x, P.at.z, P.level + 1), null, 'no water to wade');
  game.set('desert.well.watched', true);   // (the water climbing the roots, watched: src/story/desert.js rise)
  W.step(Math.ceil(FLOOD.secs * 30 / 2));
  assert.ok(Wm.state.k > 0.3 && Wm.state.k < 0.7, `half risen after ${FLOOD.secs / 2} s (${Wm.state.k.toFixed(2)})`);
  W.step(Math.ceil(FLOOD.secs * 30 / 2) + 10);
  assert.equal(Wm.state.k, 1);
  assert.ok(Wm.flood.visible && Math.abs(Wm.flood.position.y - (P.level + FLOOD.depth)) < 0.01, 'full, a shallow mirror');
  for (const b of waters.bodies) waters.refresh(b);
  const s = waters.surfaceAt(P.at.x, P.at.z, P.level + 1);
  assert.ok(s && Math.abs(s.y - (P.level + FLOOD.depth)) < 0.05, 'water you wade');
  assert.ok(Wm.meshes.wet.visible && !Wm.meshes.dark.visible, 'water risen in the wells');
  const cam = new THREE.PerspectiveCamera(); cam.position.set(P.at.x + 400, 10, P.at.z); Wm.update(1 / 30, 1, { camera: cam });
  assert.equal(Wm.mirage.visible, false, 'no mirage over real water');
  assert.equal(W.toasts.filter((t) => t === FLOOD_CUE).length, 1, 'said once');
  assert.match(lines(), /running/);
});

// Issue #553 ("the water in the desert sits above the ground"; "the water coming out of the rose house seems like it's not
// following the stairs"). The flood is full from the test above; the Rose House's water is let run here.
const T = level.temple, O = T.outside;
const bedAt = (x, y, z) => physics.groundAt(x, y + 0.25, z);
/** A mesh's open edges' vertices (welded by position: a disc's seam is no edge), in the world. */
function edgeVerts(mesh) {
  const g = mesh.geometry, p = g.attributes.position, v = new THREE.Vector3();
  const idx = g.index ? g.index.array : Array.from({ length: p.count }, (_, i) => i);
  const key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((n) => Math.round(n * 1000)).join(',');
  const id = new Map(), ids = [];
  for (let i = 0; i < p.count; i++) { const k = key(i); if (!id.has(k)) id.set(k, i); ids.push(id.get(k)); }
  const E = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = ids[idx[t + e]], b = ids[idx[t + (e + 1) % 3]], k = a < b ? `${a}_${b}` : `${b}_${a}`;
    E.set(k, (E.get(k) ?? 0) + 1);
  }
  const out = new Set();
  for (const [k, c] of E) if (c === 1) for (const s of k.split('_')) out.add(+s);
  mesh.updateWorldMatrix(true, false);
  return [...out].map((i) => v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).clone());
}

test('every water in the desert lies in its bed: no edge over the ground by more than a few centimetres (issue #553)', () => {
  T.change.set(true, { instant: true });
  W.scene.updateMatrixWorld(true);
  const waters = [];
  W.scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.position.y > 500) return;   // (not the cave's pool, far overhead in its own frame)
    if (o.material?.uniforms?.uMode?.value === MODE_WATER || o.name === 'The Givers’ channels (water)') waters.push(o);
  });
  const names = waters.map((o) => o.name).join(', ');
  for (const name of ['Salt lagoons', 'Rose gorge', 'The salt pan’s flood', 'The Givers’ channels (water)']) assert.ok(names.includes(name), `${name} among the desert's waters (${names})`);
  for (const o of waters) {
    assert.ok(o.visible, `${o.name} shown`);
    let worst = -Infinity, at = null;
    for (const p of edgeVerts(o)) { const d = p.y - bedAt(p.x, p.y, p.z); if (d > worst) { worst = d; at = p; } }
    assert.ok(worst < 0.06, `${o.name}: an edge ${worst.toFixed(2)} m over the ground at ${at.x.toFixed(0)}, ${at.z.toFixed(0)}`);
  }
  // the wells' water: level inside the shaft, over the sand in it and under the rim
  const wet = Wm.meshes.wet.geometry.attributes.position;
  for (let i = 0; i < wet.count; i++) {
    const x = wet.getX(i), y = wet.getY(i), z = wet.getZ(i), w = Wm.wells.find((q) => Math.hypot(q.at.x - x, q.at.z - z) < 1.2);
    assert.ok(w && y >= level.ground.heightAt(x, z) && y < w.at.y + 0.9, `the water in well ${w?.n} at ${y.toFixed(2)}, the rim ${w?.at.y.toFixed(2)}`);
  }
});

test('the Rose House\'s water runs down its steps, a fall over every riser, then on in the dry channel\'s bed (issue #553)', () => {
  const H = (x, z) => level.ground.heightAt(x, z), S = O.stairs, C = CHANNEL;
  const { steps, sand } = channelPath(O, H);
  assert.ok(steps[0].distanceTo(O.door.at) < 0.2, 'it comes out of the door');
  // tread by tread: lying on each, a few centimetres over it, across its whole width
  const side = new THREE.Vector3(-(sand[1].z - steps[0].z), 0, sand[1].x - steps[0].x).normalize();
  let falls = 0;
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1], b = steps[i], drop = a.y - b.y;
    if (drop > 0.05) { falls++; assert.ok(Math.hypot(b.x - a.x, b.z - a.z) <= C.fall + C.lip + 0.01, 'a fall, not a slope down the steps'); continue; }
    assert.ok(Math.abs(drop) < 1e-3, 'level along a tread');
    for (const t of [0.25, 0.5, 0.75]) for (const s of [-C.half + 0.05, 0, C.half - 0.05]) {
      const p = a.clone().lerp(b, t).addScaledVector(side, s), d = p.y - bedAt(p.x, p.y, p.z);
      assert.ok(d > 0.01 && d < 0.06, `${d.toFixed(3)} m over the step at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    }
  }
  assert.ok(falls >= S.n, `a fall over every riser (${falls}, ${S.n} risers and the terraces' edges)`);
  assert.ok(steps[0].y - steps[steps.length - 1].y > 5, 'down the whole flight');
  // at the foot, the sand: the water in the bed, the bed on the ground, from the foot to the city's edge
  const foot = steps[steps.length - 1];
  assert.ok(Math.hypot(sand[0].x - foot.x, sand[0].z - foot.z) < C.lip + 0.01 && Math.abs(foot.y - (H(foot.x, foot.z) + 0.12 + C.lift)) < 0.05, 'the last step at the sand');
  assert.ok(Math.hypot(sand.at(-1).x - STORY.city.x, sand.at(-1).z - STORY.city.z) < STORY.city.r + 10, 'on to the city');
  const line = level.dryChannel;
  assert.ok(Math.hypot(line[2][0] - sand[0].x, line[2][2] - sand[0].z) < 0.01, 'the dry channel\'s bed starts at the steps\' foot');
});
