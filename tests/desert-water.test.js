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
