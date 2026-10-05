import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Teo's drum and the mask in the sand, hands-on (src/story/desert-errands.js): the drum jammed
// against a rib by a knuckle of bone, the mask's eyes drifted shut with sand.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game, GameState } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { Quests } = await import('../src/story/quests.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { setupDrum, setupMask, FREE_TIME, EYE_WINDOW, DRUM } = await import('../src/story/desert-errands.js');
const { bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');

game.reset?.();
const scene = new THREE.Scene();
const level = createDesert(scene);
const terrain = level.ground;
const physics = new Physics(scene, terrain);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), wind: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests, dialogue } = rt;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, i * dt, { camera }); } };
const talk = (person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
    const pick = r.choices().find((x) => x.text.startsWith(c));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const toasted = (re) => toasts.some((t) => re.test(t));
const D = rt.world.drum, M = rt.world.mask;
const ground = (p) => terrain.heightAt(p.x, p.z);

test('the drum stands jammed in the crook of a rib, the knuckle of bone against it, on the sand', () => {
  // the rib's inner face is just behind the drum's rim (the ribcage collides)
  const o = D.drum.position.clone();
  const toRib = physics.rayDistance(o, D.into, 5);
  assert.ok(toRib > DRUM.r - 0.1 && toRib < DRUM.r + 0.4, `the rib is right behind the drum (${toRib.toFixed(2)} m from its centre)`);
  assert.ok(Math.abs(D.drum.position.y - (ground(o) + DRUM.r)) < 0.01, 'on its rim, like a wheel');
  assert.ok(D.knuckle.position.distanceTo(D.drum.position) < DRUM.r + DRUM.knuckleR + 0.2, 'the knuckle is against it');
  assert.ok(D.knuckle.position.clone().sub(D.drum.position).dot(D.into) < 0, 'on the belly side, away from the rib');
});

test('Teo’s drum: shoved toward the rib it jams; from the side it rolls out like a wheel, and Teo has it back', () => {
  talk(PEOPLE.teo, ['I’ll look']);
  assert.equal(quests.stage('desert.drum'), 'find');
  at(D.pinnedAt.clone().addScaledVector(D.into, -6).setY(ground(D.pinnedAt))); step(1);
  assert.equal(quests.stage('desert.drum'), 'free', 'there: it is stuck');
  // E on the drum: it won't come (a look, nothing in your hands)
  at(D.drum.position.clone().addScaledVector(D.along, 0.6).setY(ground(D.pinnedAt)));
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'drum');
  assert.match(String(typeof e.entry.prompt === 'function' ? e.entry.prompt() : e.entry.prompt), /pull/);
  e.entry.use(player);
  assert.ok(dialogue.open, 'a look at the stuck drum');
  dialogue.close();
  assert.ok(!quests.has('drum'));
  // a shot only thumps it; a push at the drum alone says why it won't shift
  D.targets.drum.onHit('shoot');
  assert.ok(toasted(/Dum/));
  D.state.hintT = -1e9;
  D.targets.drum.onHit('push', D.drum.position, D.along);
  step(1);
  assert.ok(toasted(/won’t shift/), 'the push at the drum alone: it is held');
  // the knuckle pushed straight at the rib: it jams tighter, nothing moves
  D.state.hintT = -1e9;
  assert.equal(D.targets.knuckle.onHit('push', D.knuckle.position, D.into.clone()), false);
  assert.ok(!D.freed() && toasted(/jams tighter/));
  // a slanting push that is still mostly into the rib: the same
  assert.equal(D.targets.knuckle.onHit('push', D.knuckle.position, D.into.clone().addScaledVector(D.along, 0.4).normalize()), false);
  // a shot rocks it
  D.targets.knuckle.onHit('shoot');
  assert.ok(!D.freed());
  // from the side: it rolls off, the drum rolls out
  assert.equal(D.targets.knuckle.onHit('push', D.knuckle.position, D.along.clone().negate()), true);
  assert.ok(D.freed() && toasted(/like a wheel/));
  assert.equal(game.flag('desert.drum.freed'), -1, 'the knuckle went the way it was shoved');
  step(5);
  at(D.drum.position.clone().setY(ground(D.drum.position)));
  assert.notEqual(bestInteractable(player)?.entry.id, 'drum', 'not while it is still rolling');
  step(Math.ceil(FREE_TIME * 30) + 5);
  // it ends lying flat on the sand, out of the crook, away from the rib
  const rest = D.drum.position.clone(), out = rest.clone().sub(D.pinnedAt);
  assert.ok(out.dot(D.into) < -2.5, `rolled away from the rib (${(-out.dot(D.into)).toFixed(2)} m)`);
  assert.ok(Math.abs(rest.y - (ground(rest) + DRUM.half + 0.02)) < 0.02, 'flat on the sand');
  const up = V(0, 1, 0).applyQuaternion(D.drum.quaternion);
  assert.ok(up.y > 0.9, 'skin up');
  assert.ok(D.knuckle.position.distanceTo(D.pinnedAt) > 2, 'the knuckle lies aside');
  // pick it up, take it home
  at(rest.clone());
  const pick = bestInteractable(player);
  assert.equal(pick?.entry.id, 'drum');
  pick.entry.use(player);
  assert.ok(quests.has('drum'));
  assert.equal(quests.stage('desert.drum'), 'return');
  assert.equal(D.drum.visible, false);
  talk(PEOPLE.teo, []);
  assert.equal(quests.isDone('desert.drum'), true);
});

test('the drum by hand, before the backpack: heaved from the belly side it jams, from the side it comes free', async () => {
  const g = new GameState((() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })());
  const q = new Quests({ game: g });
  for (const d of (await import('../src/story/desert-data.js')).QUESTS) q.define(d);
  const notes = [];
  const pl = { pos: V(0, 0, 0) };
  const d2 = setupDrum({ level, player: pl, quests: q, dialogue: { start: () => true }, game: g, sound, scene: new THREE.Scene(), toast: (t) => notes.push(t) });
  // from the belly, straight at the rib
  pl.pos.copy(d2.knuckle.position).addScaledVector(d2.into, -1.6);
  assert.equal(d2.shove(d2.knuckle.position.clone().sub(pl.pos), 'heave'), false);
  assert.ok(notes.some((t) => /from the side/.test(t)));
  // from the side
  pl.pos.copy(d2.knuckle.position).addScaledVector(d2.along, -1.6);
  assert.equal(d2.shove(d2.knuckle.position.clone().sub(pl.pos), 'heave'), true);
  assert.equal(g.flag('desert.drum.freed'), 1);
  // found before Teo asked: picking it up starts the errand at 'return'
  for (let i = 0; i < 100; i++) d2.update(1 / 30);
  assert.equal(q.isStarted('desert.drum'), false);
});

test('older saves: a drum already in hand (or returned) leaves the knuckle lying aside and nothing to free', async () => {
  for (const stage of ['return', 'done']) {
    const g = new GameState((() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })());
    const q = new Quests({ game: g });
    for (const d of (await import('../src/story/desert-data.js')).QUESTS) q.define(d);
    g.set('quest.desert.drum', stage);
    if (stage === 'return') g.set('item.drum', 1);
    const d2 = setupDrum({ level, player: { pos: D.pinnedAt.clone() }, quests: q, dialogue: { start: () => true }, game: g, sound, scene: new THREE.Scene(), toast() {} });
    assert.equal(d2.drum.visible, false, `${stage}: no drum in the sand`);
    assert.equal(d2.targets.knuckle.enabled(), false, `${stage}: the knuckle is not in the way`);
    assert.ok(d2.knuckle.position.distanceTo(d2.knuckleAt) > 2, `${stage}: the knuckle lies aside`);
    assert.equal(d2.shove(d2.along, 'push'), false);
  }
  // a save at the old 'find' stage (it was "pick it up"): arriving now finds it stuck
  const g = new GameState((() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })());
  const q = new Quests({ game: g });
  for (const d of (await import('../src/story/desert-data.js')).QUESTS) q.define(d);
  g.set('quest.desert.drum', 'find');
  const pl = { pos: V(0, 0, 0) };
  const d2 = setupDrum({ level, player: pl, quests: q, dialogue: { start: () => true }, game: g, sound, scene: new THREE.Scene(), toast() {} });
  pl.pos.copy(d2.pinnedAt);
  q.update(pl);
  assert.equal(q.stage('desert.drum'), 'free');
});

test('the mask’s sand lids sit on the world’s eyes', () => {
  // the eyes drawn in src/world.js (sleepingMask): 11 × 2.6 × 6 boxes
  const drawn = [];
  scene.traverse((o) => { const p = o.geometry?.parameters; if (o.isMesh && p?.width === 11 && p.height === 2.6 && p.depth === 6) drawn.push(o.getWorldPosition(V(0, 0, 0))); });
  assert.equal(drawn.length, 2);
  for (const e of M.eyes) {
    const w = e.eye.getWorldPosition(V(0, 0, 0));
    assert.ok(drawn.some((d) => d.distanceTo(w) < 0.01), `a lid on an eye (${w.toArray().map((v) => v.toFixed(1))})`);
    assert.ok(e.lid.visible && e.k === 1, 'drifted shut');
  }
  // high on the face, but in a glob's reach from the sand in front of it
  const door = V(-20 + Math.sin(0.75) * 40, 0, -400 + Math.cos(0.75) * 40); door.y = ground(door) + 1.4;
  for (const e of M.eyes) assert.ok(e.aim.distanceTo(door) < 40 && e.aim.y - door.y > 15, `eye ${e.s} up the face, ${e.aim.distanceTo(door).toFixed(1)} m away`);
});

test('the mask in the sand: one eye at a time the wind fills it again; both at once, and it looks at you', () => {
  quests.start('desert.mask');
  at(V(-20, terrain.heightAt(-20, -372), -372)); step(2);
  assert.equal(quests.stage('desert.mask'), 'eyes');
  const [a, b] = M.targets;
  // one eye: it clears, and after a while the sand sifts back
  assert.equal(a.onHit('shoot'), true);
  step(30);
  assert.ok(M.eyes[0].k < 0.05 && !M.eyes[0].lid.visible, 'the sand poured off');
  assert.equal(a.enabled(), false, 'an open eye is not a target');
  step(Math.ceil(EYE_WINDOW * 30));
  assert.equal(M.eyes[0].open, false, 'the wind filled it again');
  assert.ok(toasted(/Both eyes at once/));
  step(30 * 3);
  assert.ok(M.eyes[0].k > 0.95, 'drifted shut again');
  assert.equal(quests.stage('desert.mask'), 'eyes');
  // both, quickly (a push works as well as a shot)
  a.onHit('shoot');
  step(30 * 3);
  b.onHit('push');
  assert.equal(game.flag('desert.mask.eyes'), true);
  step(1);
  assert.equal(quests.isDone('desert.mask'), true);
  step(30 * 2);
  assert.ok(dialogue.open && dialogue.person.id === 'maskEyes', 'it looks at you');
  dialogue.close();
  for (const e of M.eyes) assert.ok(e.glint.visible && !e.lid.visible, 'open, a glint in each');
  // it stays open: the wind doesn't fill them any more
  step(Math.ceil(EYE_WINDOW * 30) + 30);
  for (const e of M.eyes) assert.ok(e.k < 0.01);
  assert.equal(M.targets.some((t) => t.enabled()), false);
});

test('a save with the mask’s eyes already open draws them open', async () => {
  const g = new GameState((() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })());
  g.set('desert.mask.eyes', true);
  const q = new Quests({ game: g });
  const m2 = setupMask({ level, player: { pos: V(0, 0, -370) }, quests: q, dialogue: null, game: g, sound, scene: new THREE.Scene(), toast() {} });
  for (const e of m2.eyes) assert.ok(!e.lid.visible && e.glint.visible);
  assert.equal(m2.targets.some((t) => t.enabled()), false);
  void allTargets;
});
