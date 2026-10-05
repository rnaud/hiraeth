import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Viridel's tea terraces: the quest you try, and fail (src/story/terraces.js). It runs to its
// failed end, the world stays changed (and stays changed on the next visit), the journal files it
// as failed, the father's charge keeps it quietly, and a recording afterwards says so.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const warn = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('toNonIndexed')) warn(...a); };

const { createEdena, TERRACES } = await import('../src/levels/edena.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE } = await import('../src/story/edena-data.js');
const { clearInteractables } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');
const { chargeState, chargeJournalHtml } = await import('../src/story/charge.js');
const { callLines } = await import('../src/story/calls.js');
const { terraceLayout } = await import('../src/story/terraces.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = 'edena.terraces';

/** A fresh Viridel on the current save (a visit). */
function visit(journal = { sections: [], el: { addEventListener() {} } }) {
  clearInteractables(); clearTargets();
  const scene = new THREE.Scene();
  const level = createEdena(scene);
  const physics = new Physics(scene, level.ground);
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const toasts = [];
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, rumble() {}, fail() {} };
  const npcs = spawnNPCs(scene, physics, CONTENT.edena.npcs);
  const rt = createStory({ levelId: 'edena', scene, physics, level, player, npcs, crowd: null, sound, journal, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
  const camera = new THREE.PerspectiveCamera();
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  const at = (p) => { player.pos.copy(p); return player; };
  return { scene, level, physics, player, rt, quests: rt.quests, step, at, toasts, T: rt.world.terraces };
}
const talk = (quests, person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  while (r.advance());
  for (const c of choices) {
    const pick = r.choices().find((x) => (typeof c === 'number' ? x.index === c : x.text.startsWith(c)));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const targets = (kind) => allTargets().filter((t) => t.kind === kind);

game.reset();
let W = visit();

test('the terraces step down the slope into the hollow, on the ground, and Esk stands on the bottom one', () => {
  const H = (x, z) => W.level.ground.heightAt(x, z), L = terraceLayout(H);
  assert.equal(L.steps.length, TERRACES.steps);
  for (const z of [TERRACES.z0 + 2, -100, TERRACES.z1 - 2]) {
    for (let k = 0; k + 1 < L.steps.length; k++) assert.ok(L.topAt(k, z) > L.topAt(k + 1, z) + 1, `step ${k} stands over step ${k + 1} at z ${z}`);
    for (const s of L.steps) for (let x = s.xl + 0.5; x < s.xu; x += 2) assert.ok(L.topAt(s.k, z) >= H(x, z), 'every step is above the ground under it');
  }
  // you can stand on them (they collide) and walk up the ramps at the north end
  const s1 = L.steps[1], mid = V((s1.xl + s1.xu) / 2, 0, -84);
  const g = W.physics.groundAt(mid.x, 40, mid.z, 80);
  assert.ok(Math.abs(g - (L.topAt(1, mid.z) - 0.12)) < 0.4, `the second step is solid underfoot (${g.toFixed(2)})`);
  const esk = W.rt.world.people.esk;
  assert.ok(esk, 'Esk is in the garden');
  for (const p of esk.route) assert.ok(Math.abs(W.physics.groundAt(p.x, p.y + 3, p.z, 8) - p.y) < 0.5 && p.z > TERRACES.lane.z1, 'Esk stands on the bottom step, out of the lane');
});

test('the quest: the runnels top first, the gate at Esk’s asking, the flood; it fails, and the hill stays down', () => {
  const { quests, step, at, T, physics } = W;
  // Sol starts it: where does the tea come from?
  talk(quests, PEOPLE.sol, ['Are they coming back?', 'Where does the tea come from?']);
  assert.equal(quests.stage(Q), 'esk');
  at(T.esk.pos); step(2);
  talk(quests, PEOPLE.esk, ['Why are they thirsty?', 'I’ll clear them.']);
  assert.equal(quests.stage(Q), 'runnels');
  const clods = targets('clod').sort((a, b) => b.position().x - a.position().x);   // top (uphill, +x) first
  assert.equal(clods.length, 3);
  at(clods[0].position());
  // the order matters: a lower clod shoved first slumps back
  clods[2].onHit('push');
  assert.equal(game.flag('edena.runnels') ?? 0, 0, 'the bottom clod slumps back');
  clods[0].onHit('shoot');
  assert.equal(game.flag('edena.runnels') ?? 0, 0, 'a splash only soaks the silt');
  for (const c of clods) c.onHit('push');
  assert.equal(game.flag('edena.runnels'), 3);
  step(30);
  assert.equal(quests.stage(Q), 'ask');
  // either answer, she asks you to open it: a little
  talk(quests, PEOPLE.esk, ['Then we leave it shut.', 'One turn.']);
  assert.equal(quests.stage(Q), 'roots');
  const [gate] = targets('gate');
  at(T.gateStand); step(2);
  gate.onHit('push');
  assert.ok(!game.flag('edena.gate.turned'), 'the roots hold the wheel');
  gate.onHit('shoot');
  step(2);
  assert.equal(quests.stage(Q), 'gate');
  // the lane still stands, and you can stand on it
  const laneMid = V((T.layout.steps[2].xl + T.layout.steps[2].xu) / 2, 0, -100);
  const before = physics.groundAt(laneMid.x, 40, laneMid.z, 80);
  assert.ok(before > W.level.ground.heightAt(laneMid.x, laneMid.z) + 0.2, 'the lane’s step is solid before');
  gate.onHit('push');   // one notch
  assert.equal(game.flag('edena.gate.turned'), true);
  step(2);
  assert.equal(quests.stage(Q), 'flood');
  // nothing stops it: another shove does nothing, the wheel is gone a moment later
  step(Math.ceil(11 * 30));
  assert.equal(game.flag('edena.terraces.flooded'), true);
  step(2);
  assert.equal(quests.stage(Q), 'sorry');
  const shown = T.shown();
  assert.ok(shown.after && !shown.gate && !shown.lane, 'the mud is there, the gate and the middle of the terraces are gone');
  const g = physics.groundAt(laneMid.x, 40, laneMid.z, 80);
  assert.ok(Math.abs(g - W.level.ground.heightAt(laneMid.x, laneMid.z)) < 0.4, `the lane is bare slope now (${g.toFixed(2)})`);
  assert.ok(W.toasts.some((t) => /gate tears loose/.test(t)));
  // Esk: blame, sorry, all right
  const r = talk(quests, PEOPLE.esk, ['I only turned it once.', 'I’m sorry, Esk.']);
  assert.ok(r.pages.some((p) => /belongs to the ground now/.test(p)) || r.ended);
  assert.equal(quests.isFailed(Q), true);
  assert.equal(quests.isActive(Q), false);
  assert.equal(quests.isDone(Q), false);
  assert.equal(game.flag(`failed.${Q}`), 'Water for the Tea Terraces');
  assert.ok(W.toasts.includes('Failed: Water for the Tea Terraces'));
  // the sketchbook files it under Failed, with its own stamp and how it went
  const html = quests.journalHtml();
  assert.match(html, /qgroup failed">Failed/);
  assert.match(html, /class="quest finished failed" data-quest="edena.terraces"/);
  assert.match(html, /✗ Failed/);
  assert.match(html, /the hill came down with the water/);
  // it can't be retried
  assert.equal(quests.set(Q, 'runnels'), false);
  assert.equal(quests.isFailed(Q), true);
  // afterwards she is quiet about it, and the gardeners each say a word
  assert.match(talk(quests, PEOPLE.esk, []).pages.join(' '), /greening at the edges/);
  assert.match(talk(quests, PEOPLE.sol, []).pages.join(' '), /Tea keeps/);
  assert.match(talk(quests, PEOPLE.vey, []).pages.join(' '), /world had to deal with it/);
  assert.match(talk(quests, PEOPLE.mira, []).pages.join(' '), /letting a hill go/);
  assert.ok(!/letting a hill go/.test(talk(quests, PEOPLE.mira, []).pages.join(' ')), 'once');
});

test('the main quest is untouched by it, and the next visit finds the hill as it fell', () => {
  W = visit();
  const { quests, T, physics } = W;
  assert.equal(quests.isFailed(Q), true);
  const shown = T.shown();
  assert.ok(shown.after && !shown.gate && !shown.lane, 'the terraces stay changed');
  const laneMid = V((T.layout.steps[1].xl + T.layout.steps[1].xu) / 2, 0, -100);
  assert.ok(Math.abs(physics.groundAt(laneMid.x, 40, laneMid.z, 80) - W.level.ground.heightAt(laneMid.x, laneMid.z)) < 0.4, 'no invisible steps left in the lane');
  assert.ok(!targets('clod').some((t) => t.enabled()) && !targets('gate').some((t) => t.enabled()), 'nothing to push any more');
  assert.equal(quests.stage('edena.garden'), 'mira', 'the world’s own story still waits');
});

test('the father’s charge keeps it quietly; a recording afterwards lands differently', () => {
  game.set('charge.given', true);   // (the father has said it: the prologue)
  const failed = Object.entries(game.data.flags).filter(([k, v]) => k.startsWith('failed.') && v).map(([, v]) => v);
  const html = chargeJournalHtml(chargeState({ flag: (f) => game.flag(f), keepsakes: [], completed: 1, failed }));
  assert.match(html, /What you could not mend/);
  assert.match(html, /Water for the Tea Terraces/);
  const lines = callLines(3, { flag: (f) => game.flag(f), keepsakes: [], completed: ['desert', 'incal', 'edena'], lastWorld: 'edena' });
  const text = lines.map((l) => l.text).join(' | ');
  assert.match(text, /you say sorry, and you mean it/);
  assert.match(text, /I opened their gate/);
});

test('an old save stopped mid-flood comes back flooded', () => {
  game.reset();
  game.set('quest.edena.terraces', 'flood');
  game.set('edena.gate.turned', true);
  W = visit();
  W.step(3);
  assert.equal(game.flag('edena.terraces.flooded'), true);
  assert.equal(W.quests.stage(Q), 'sorry');
  assert.ok(W.T.shown().after);
});

test('the Hangar’s gear ends at Mira’s water clock: fit it, then three quick splashes', () => {
  game.reset();
  let delivered = false;
  W = visit({ sections: [], el: { addEventListener() {} }, errand: (id) => (id === 'gear' && delivered ? { done: true } : undefined) });
  const { quests, step, at } = W, C = 'edena.clock';
  step(2);
  assert.equal(quests.isStarted(C), false, 'nothing before the gear comes');
  delivered = true; step(2);
  assert.equal(quests.stage(C), 'fit');
  const bowl = targets('clockBowl')[0];
  at(W.rt.world.clock.at); step(2);
  bowl.onHit('shoot');
  assert.equal(quests.stage(C), 'fit', 'no gear, no clock');
  game.set('edena.clock.fitted', true); step(2);
  assert.equal(quests.stage(C), 'fill');
  // one splash at a time only drips away
  W.rt.world.clock.state.lv = 0;
  bowl.onHit('shoot'); step(150);
  bowl.onHit('shoot'); step(150);
  bowl.onHit('shoot');
  assert.ok(!game.flag('edena.clock.rung'), 'slow splashes drain away');
  step(150);
  W.rt.world.clock.state.lv = 0;
  bowl.onHit('shoot'); bowl.onHit('shoot'); bowl.onHit('shoot');
  assert.equal(game.flag('edena.clock.rung'), true);
  step(2);
  assert.equal(quests.isDone(C), true);
});
