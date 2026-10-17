// The Givers' watcher (issue #245): its bolt taken on the guard flies back and breaks it, which opens its door; a bolt
// not blocked hurts; old saves past it find it broken.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Sentry, SENTRY } from '../src/temples/pieces.js';
import { TempleLogic, memoryStore, solve } from '../src/temples/logic.js';
import { makeMaterial } from '../src/materials.js';
import { TEMPLES } from '../src/temples/index.js';
import { migrateTempleLayouts, LAYOUTS } from '../src/temples/migrate.js';
import { GameState } from '../src/game-state.js';

const def = { id: 't', entry: 'a', rooms: { a: {}, b: {} }, links: [{ a: 'a', b: 'b', door: 'dw' }],
  elements: { sentry: { type: 'switch', room: 'a', needs: ['shield'] }, dw: { type: 'door', opens: { lit: 'sentry' }, latch: true } } };

function rig({ shield = true } = {}) {
  const I = new THREE.Matrix4();
  const kit = { yaw: 0, world: (x, y, z) => new THREE.Vector3(x, y, z), local: (p) => p.clone(), heading: (h) => h, frame: I, inv: I };
  const notes = [];
  const logic = new TempleLogic(def, { store: memoryStore(), has: (i) => i === 'shield' && shield });
  const rt = { kit, root: new THREE.Group(), M: { trimMat: makeMaterial({ color: '#c47b6b', flat: true }) }, P: {}, logic, notice: (s) => notes.push(s), lit: [] };
  rt.onLit = (id) => rt.lit.push(id);
  const P = { pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(), hearts: 3, dead: false, guarding: false,
    hurt(q) { this.hearts -= q; }, guard() { return this.guarding; } };
  rt.player = P;
  const s = new Sentry(rt, { id: 'sentry', at: [0, 0, 0], zone: { min: [-30, -1, -30], max: [30, 10, 30] }, woke: 'woke', reflected: 'back', broken: 'broken', hit: 'hit', shrug: 'shrug' });
  let t = 0;
  const run = (secs, until = () => false) => { for (let i = 0; i < secs * 60 && !until(); i++) { t += 1 / 60; s.update(1 / 60, t); logic.update(); } };
  return { rt, P, s, logic, notes, run };
}

test('asleep without the guard; awake, it aims a beam, fires, and the bolt hurts you bare-handed', () => {
  const off = rig({ shield: false });
  off.run(5);
  assert.equal(off.s.state, 'sleep');
  assert.equal(off.P.hearts, 3);
  const { P, s, run, notes } = rig();
  let aimed = false;
  run(SENTRY.rest + SENTRY.aim + 2, () => { aimed ||= s.beam.visible; return P.hearts < 3; });
  assert.ok(notes.includes('woke') && aimed, 'it wakes and its beam holds on you first');
  assert.ok(P.hearts < 3 && notes.includes('hit'), 'not blocked, the bolt burns');
  assert.equal(s.broken, false);
});

test('taken on the guard, the bolt flies back into its eye: it breaks and its door opens, for good', () => {
  const { P, s, run, notes, logic, rt } = rig();
  P.guarding = true;
  assert.equal(logic.isOpen('dw'), false);
  run(10, () => s.broken);
  assert.equal(P.hearts, 3, 'no hurt');
  assert.ok(s.broken && logic.isLit('sentry') && rt.lit.includes('sentry'));
  assert.ok(notes.includes('back') && notes.includes('broken'));
  assert.equal(logic.isOpen('dw'), true, 'the door opens');
  P.guarding = false;
  run(6);
  assert.equal(P.hearts, 3, 'broken, it fires no more');
});

test('a bolt you step away from passes you by', () => {
  const { P, s, run } = rig();
  run(SENTRY.rest + SENTRY.aim * 0.95);
  P.pos.x += 3;   // (a sidestep once the beam has locked)
  run(3);
  assert.equal(P.hearts, 3);
  assert.equal(s.broken, false);
});

test('the Rose House: the watcher stands before the cistern’s door, in the Great Hall; the door wants it broken and the Hall of Channels’ bowl lit (issue #406)', () => {
  const L = TEMPLES.desert.def.logic;
  const r = solve(L, { items: ['backpack', 'doublejump'] });
  assert.ok(r.done);
  const at = (s) => r.log.indexOf(s);
  assert.ok(at('find guard (shield)') < at('switch sentry') && at('switch sentry') < at('resolve keeper'), r.log.join(' / '));
  assert.equal(L.elements.sentry.room, 'hall');
  assert.deepEqual(L.elements.d3.opens, { all: [{ lit: 'sentry' }, { lit: 'b4' }] });
  assert.ok(!L.links.some((l) => (l.needs ?? []).includes('shield')), 'no wind to lean into: the doorway is a door');
});

test('old saves past the wind find the watcher broken and its door open; a save that only has the guard meets it', () => {
  const past = new GameState(null);
  past.set('temple.desert.checkpoint', 'wing');
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.desert.lit.sentry'), true);
  assert.equal(past.flag('temple.desert.open.dw'), true);
  for (const f of ['lit.e10', 'open.d3', 'drum.ball4']) {
    const g = new GameState(null);
    g.set(`temple.desert.${f}`, f.startsWith('drum') ? 0.4 : true);
    migrateTempleLayouts(g);
    assert.equal(g.flag('temple.desert.lit.sentry'), true, f);
  }
  const fresh = new GameState(null);
  fresh.set('temple.desert.checkpoint', 'fires');
  fresh.set('temple.desert.found.guard', true);
  migrateTempleLayouts(fresh);
  assert.equal(fresh.flag('temple.desert.lit.sentry'), undefined);
  assert.equal(fresh.flag('temple.desert.layout'), LAYOUTS.desert.v, 'brought up to date once');
});

test('awake, the guard turns to it from across the landing (a lock target with its own reach); a cut only rings it', async () => {
  const { lockTarget, BLADE } = await import('../src/fluid-blade.js');
  const { allTargets, clearTargets } = await import('../src/targets.js');
  clearTargets();
  const { P, s, run, notes } = rig();
  P.pos.set(0, 0, 20);
  assert.equal(lockTarget(P.pos), null, 'asleep: nothing to turn to');
  P.pos.set(0, 0, 8);
  run(0.2);
  P.pos.set(0, 0, 20);
  assert.ok(20 > BLADE.lock, 'farther than a foe is turned to');
  assert.equal(lockTarget(P.pos, BLADE.lock, allTargets())?.kind, 'sentry', 'the guard turns to it');
  const t = allTargets().find((x) => x.kind === 'sentry');
  t.onHit('blade');
  assert.ok(notes.length > 0 && !s.broken, 'a cut rings it, no more');
  s.breakNow();
  assert.equal(lockTarget(P.pos), null, 'broken: nothing to turn to');
  clearTargets();
});
