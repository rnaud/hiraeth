import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The author's playthrough of the Desert, October 2026 (issues #149–#162): what each fix keeps true.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { addEventListener() {} };

const { createDesert, QANAT_CLEAR } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { Wildlife } = await import('../src/wildlife.js');
const { CONTENT } = await import('../src/levels/content.js');
const { STORY } = await import('../src/desert-sites.js');
const { createStory } = await import('../src/story/index.js');
const INTERACT = await import('../src/interact.js');

const scene = new THREE.Scene();
const level = createDesert(scene);
const terrain = level.ground;
const physics = new Physics(scene, terrain);
level.init?.(physics);
const Q = level.qanat;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Y = V(0, 1, 0);

const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), wind: V(), heading: 0, riding: false, onGround: true, vehicles: [], frame: { up: Y.clone(), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, psst() {} };
const toasts = [];
const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
void rt;

test('#153: no wild creature is put in Qanat or wanders into its streets and square', () => {
  const C = V(STORY.city.x, 0, STORY.city.z);
  assert.ok(level.keepClear(C.clone().setY(1)), 'the square is kept clear');
  assert.ok(level.keepClear(Q.city.backGate.clone().lerp(C, 0.1)), 'and the streets by the back gate');
  assert.ok(!level.keepClear(Q.camps.center), 'the camps outside the gate are not');
  const w = new Wildlife(scene, level, physics, { content: CONTENT.desert });
  assert.ok(w.list.length >= 8, `the desert still has its creatures (${w.list.length})`);
  for (const c of w.list) assert.ok(flat(c.pos, C) >= QANAT_CLEAR, `${c.herd.def.id} put ${flat(c.pos, C).toFixed(1)} m from the square`);
  // a while among them, standing at the city's main gate where the camps' creatures could wander in
  const p = { ...player, pos: Q.city.gate.clone() };
  const cam = new THREE.PerspectiveCamera(); cam.position.copy(p.pos).add(V(0, 2, 6)); cam.lookAt(p.pos); cam.updateMatrixWorld();
  let t = 0, nearest = Infinity;
  for (let i = 0; i < 60 * 90; i++) { t += 1 / 60; w.update(1 / 60, t, p, cam); if (i % 30 === 0) for (const c of w.list) nearest = Math.min(nearest, flat(c.pos, C)); }
  assert.ok(nearest >= QANAT_CLEAR - 1, `none came in over a minute and a half (nearest ${nearest.toFixed(1)} m)`);
});

test('#155: nothing to press in front of the skull: no prompt at its mouth', () => {
  const near = INTERACT.allInteractables().filter((e) => {
    const at = typeof e.at === 'function' ? e.at() : e.at;
    return at && at.isVector3 && flat(at, Q.giant.door) < 9 && Math.abs(at.y - Q.giant.door.y) < 20;
  });
  assert.deepEqual(near.map((e) => e.id), [], 'no interactable within 9 m of the skull\'s mouth');
});

test('#154: the skull faces the back gate: you come out of the city to its face and its mouth, in plain sight', () => {
  const G = Q.giant, gate = Q.city.backGate;
  const fwd = V(Math.sin(G.yaw), 0, Math.cos(G.yaw)), toGate = gate.clone().sub(G.door).setY(0).normalize();
  assert.ok(fwd.dot(toGate) > 0.95, `its face turned to the gate (${fwd.dot(toGate).toFixed(3)})`);
  assert.ok(flat(G.door, gate) < flat(G.skull, gate), 'the mouth nearer the gate than the crown');
  // from just outside the gate, at eye height, nothing between you and the mouth
  const eye = gate.clone().addScaledVector(toGate, -4); eye.y = terrain.heightAt(eye.x, eye.z) + 1.6;
  const mouth = G.door.clone().add(V(0, 1.6, 0)), dir = mouth.clone().sub(eye), d = dir.length();
  assert.ok(physics.rayDistance(eye, dir.normalize(), d) > d - 2.5, 'the mouth in sight from the gate');
  // the way down and back up still meet at the mouth; you come up facing the city
  const down = level.portals.find((p) => p.label === 'giant’s mouth'), up = level.portals.find((p) => p.label === 'passage up');
  assert.ok(down.at.distanceTo(G.door) < 2 && up.to.distanceTo(G.door) < 5);
  const out = V(Math.sin(up.heading), 0, Math.cos(up.heading));
  assert.ok(out.dot(toGate) > 0.9, 'out of the passage facing the gate');
});

test('#157: what clogs the channel is a heap of debris, not one long bone: no part of it far longer than it is wide', () => {
  const pile = Q.cave.bone, rot = pile.rotation.clone();
  pile.rotation.set(0, 0, 0); pile.updateMatrixWorld(true);   // (measured in its own frame: across the channel, along it)
  const box = new THREE.Box3().setFromObject(pile), size = box.getSize(V(0, 0, 0));
  pile.rotation.copy(rot); pile.updateMatrixWorld(true);
  const flatSize = [size.x, size.z].sort((a, b) => a - b);
  assert.ok(flatSize[1] < 4, `the heap is under 4 m across (${flatSize[1].toFixed(2)})`);
  assert.ok(flatSize[1] / flatSize[0] < 2.2, `and about as long as it is wide (${(flatSize[1] / flatSize[0]).toFixed(2)})`);
  assert.ok(pile.children.filter((m) => m.isMesh).length >= 3, 'a broken rib piece, rocks and packed sand');
  // it sits on the trough, across it
  const ch = Q.cave.streamAt(0.34);
  assert.ok(flat(box.getCenter(V(0, 0, 0)), ch) < 1.2, 'over the channel');
});

test('#158: no lever, no pole, no carved post: the drain asks whether to remove what clogs it', async () => {
  const { THINGS } = await import('../src/story/desert-data.js');
  assert.ok(!INTERACT.allInteractables().some((e) => /^keepers\./.test(e.id)), 'no pole or post to use');
  const look = INTERACT.allInteractables().find((e) => e.id === 'bone');
  assert.equal(typeof look.prompt === 'function' ? look.prompt() : look.prompt, 'look at the drain');
  const node = THINGS.bone.talk.nodes.look;
  assert.deepEqual(node.say.map((x) => x.replace(/^~\w+~ /, '')), ['Something is clogging the drain. Remove it?']);
  assert.deepEqual(node.choices.map((c) => c.text.replace(/^~\w+~ /, '')), ['Yes.', 'No.']);
  assert.deepEqual(node.choices[0].do, { emit: ['desert:drain'] }, 'Yes clears it');
  assert.equal(node.choices[1].do, undefined, 'No leaves it');
});

test('#156, #730: the lift valve\'s chest is in the makers\' shrine, out of sight and reach behind a door that opens once the cave\'s monsters are down', async () => {
  const { game } = await import('../src/game-state.js');
  const { items } = await import('../src/items.js');
  const cave = Q.cave, S = cave.shrine, chest = cave.chest.at;
  assert.ok(S, 'the shrine is built');
  const eye = (p) => p.clone().add(V(0, 1.6, 0));
  const blocked = (from) => { const d = chest.clone().sub(from), L = d.length(); return physics.rayDistance(from, d.normalize(), L) < L - 0.6; };
  // shut: from the kerb all round the pool, and from in front of the door, the chest can't be seen or reached
  game.set('desert.door.open', undefined);
  const around = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) around.push(cave.local(Math.cos(a) * 14, 0, Math.sin(a) * 14));
  for (const p of [...around, S.front]) assert.ok(blocked(eye(p)), `the chest hidden from ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  // the door: a full tank no longer opens it (issue #730); its lens says how many of the Givers' lamps are still dark
  const door = INTERACT.allInteractables().find((e) => e.id === 'shrine.door');
  const prompt = () => (typeof door.prompt === 'function' ? door.prompt() : door.prompt);
  items.grant('backpack'); game.set('tool.empty', false); game.set('desert.pool.tinted', true); game.set('desert.channel.open', true);
  assert.equal(prompt(), 'look at the makers’ door', 'a full tank: it only looks');
  door.use();
  assert.ok(!game.flag('desert.door.open') && /lamps round the pool are still unlit/.test(toasts.at(-1)), 'and says the lamps are dark');
  // the cave's monsters down (the hall's encounter site cleared: tests/skull-hall.test.js): it opens by itself
  game.set('site.desert.skull-hall', true);
  assert.equal(game.flag('desert.door.open'), true, 'the hall cleared opens it');
  assert.ok(cave.hall.lamps.every((l) => l.on), 'every lamp lit');
  for (let i = 0; i < 80; i++) rt.update(1 / 30, i / 30, { camera: new THREE.PerspectiveCamera() });
  assert.equal(S.group.visible, false, 'sunk into the floor');
  assert.ok(!blocked(eye(S.front)), 'open: the chest in sight and reach from the doorway');
  // the shrine's walls are out of a jump's reach, so it is no way out of the cave before the double jump (issue #68)
  const top = physics.groundAt(S.box.at.x, S.box.at.y + 9, S.box.at.z, 12) - cave.origin.y;
  assert.ok(top > 4.6, `the wall over the door stands ${top.toFixed(2)} m`);
  game.reset();
});
