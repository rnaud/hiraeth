// The Mother Snapper outwitted, never fought (issue #409: G3a of docs/design/temple-best-practices.md, "the house with
// no fight at all"). In the Hush-House's own hall with a real Player at 60 and 30 frames a second: she is blind and
// strikes at sounds (src/temples/perdide.js hush: src/temples/boss.js `listen`), the pendulums' jangle and a running,
// rolling or landing traveller, never a walking one; frosted with the stilling mode, the three fall silent (her first
// phase); then the lullaby, the Choir's lesson: the four notes splashed low to high, the first at her root, which her
// head covers till a sound elsewhere turns it away (a crystal rung flat before the first note: the decoy); a note out
// of turn fades the rest. Globs on her take nothing. Sung through she is weary: a hand on her head. A traveller who
// only walks is never struck. (Before v1.83 she was fought: tests/guardian-completable.test.js spars her in the Arena.)
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { updateHazards } from '../src/hazards.js';
import { createPerdide } from '../src/levels/perdide.js';
import { templeOf } from '../src/temples/attachment.js';
import { setHintLevel } from '../src/hint-level.js';
import { hitTarget } from '../src/targets.js';
import { Glob, FLUID } from '../src/fluid-tool.js';
import { bestInteractable } from '../src/interact.js';
import { guardianBar } from '../src/temples/boss.js';
import { HEAR, CALM, MOTHER } from '../src/temples/perdide.js';

setHintLevel('full');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

/** Her hall, a traveller at its door, her temple's notices heard. */
function hall(fps = 60) {
  game.reset();
  for (const k of Object.keys(ITEMS)) if (['backpack', 'gun', 'stun'].includes(k)) items.grant(k); else items.revoke(k);
  const scene = new THREE.Scene();
  const level = quiet(() => createPerdide(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'perdide') ?? level.temple, G = rt.guardian, A = G.arena;
  // (west of her middle: the door's side, inside her hall)
  const P = new Player(physics, { spawn: A.center.clone().add(V(-A.r + 3, 0.2, 0)), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  game.emit('box:opened', { id: rt.def.gadgetBox });
  const dt = 1 / fps;
  let t = 0, struck = 0;
  const hurt = P.hurt.bind(P);
  P.hurt = (n, why) => { if (why === 'guardian' || why === 'hit') struck++; return hurt(n, why); };
  const frame = (input = {}, yaw = 0) => { t += dt; physics.syncMovers?.(dt); rt.update(dt, t); P.update(dt, input, yaw); updateHazards(dt, P); level.update(dt, t, {}); };
  const wait = (s) => { for (let i = 0; i < s / dt; i++) frame(); };
  const until = (fn, s = 30, input = {}, yaw = 0) => { for (let i = 0; i < s / dt; i++) { frame(input, yaw); if (fn()) return true; } return false; };
  const said = (re) => notes.some((n) => re.test(n));
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  /** Walk (or run) to a spot (world), true when there. */
  const go = (to, { run = false, max = 20, tol = 0.6 } = {}) => {
    for (let i = 0; i < max / dt; i++) { if (Math.hypot(P.pos.x - to.x, P.pos.z - to.z) < tol) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  /** A real glob from his chest at `to` (stun or plain), flown against the targets and the walls: what it hit. */
  const shoot = (to, mode = 'shoot') => {
    const from = P.pos.clone().add(V(0, 1.45, 0)), g = new Glob(from, to.clone().sub(from).normalize().multiplyScalar(FLUID.shoot.speed));
    for (let i = 0; i < 3 / dt && g.state === 'fly'; i++) {
      const e = g.step(dt, { physics, up: V(0, 1, 0) });
      if (e?.type === 'target') { hitTarget(e.hit, mode, e.dir, {}); return e.hit; }
      if (e) return e;
      frame();
    }
    return null;
  };
  return { level, physics, rt, G, P, A, notes, frame, wait, until, said, go, shoot, struck: () => struck, done: () => { rt.dispose?.(); game.reset(); } };
}

for (const fps of [60, 30]) {
  test(`the Mother Snapper outwitted at ${fps} frames a second: she strikes at the jangling pendulums and a running traveller, never a walking one; frosted, they fall silent; the lullaby sung low to high, her head turned off her root by a flat note first; weary, a hand on her head (issue #409)`, () => {
    const H = hall(fps);
    const { rt, G, P, A, until, wait, said, go, shoot } = H, C = rt.motherCrystals, m = G.model;
    try {
      assert.equal(MOTHER.outwit, true);
      assert.deepEqual(Object.keys(MOTHER.attacks), ['lunge'], 'one move: a lunge at a sound');
      assert.ok(MOTHER.phases.every((p) => !p.attacks?.length), 'no moves of her own: she strikes only at what she hears');
      assert.equal(C.swings.length, 3, 'three pendulums over her');
      assert.equal(C.notes.length, 4, 'four notes: her root and the three');
      assert.deepEqual(C.notes.map((n) => n.rank), [0, 1, 2, 3]);
      assert.ok(C.swings.every((s) => s.center.y - A.y > 5), 'they hang well over your head');
      wait(0.5);
      assert.notEqual(G.state, 'sleep', 'she wakes');
      assert.equal(until(() => G.state === 'fight', 8), true);
      // ---- the jangle: she strikes at the pendulums' notes, her head where the sound was
      assert.equal(until(() => G.attack && G.heardWhy === 'jangle', 12), true, 'she strikes at a jangling crystal');
      const near = C.swings.some((s) => Math.hypot(s.center.x - G.listen.x, s.center.z - G.listen.z) < 5);
      assert.ok(near, 'at the floor under the jangling crystal');
      assert.ok(said(/jangles out of tune/), 'and it says so');
      // ---- you: walk up to her, and she does not hear you; run, and she does
      wait(5);
      let heardYou = false;
      const watch = () => { if (G.attack && G.heardWhy === 'you') heardYou = true; };
      const side = A.center.clone().add(V(-6, 0, 9));   // (within her hearing, off the pendulums' floor)
      for (let i = 0; i < 20 * fps && Math.hypot(P.pos.x - side.x, P.pos.z - side.z) > 0.8; i++) { H.frame({ KeyW: true }, Math.atan2(-(side.x - P.pos.x), -(side.z - P.pos.z))); watch(); }
      assert.ok(Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z) < HEAR.r, 'walked within her hearing');
      for (let i = 0; i < 6 * fps; i++) { H.frame(); watch(); }
      assert.equal(heardYou, false, 'a walk she cannot hear');
      const back = A.center.clone().add(V(-6, 0, -9));
      for (let i = 0; i < 8 * fps && !heardYou; i++) { H.frame({ KeyW: true, ShiftLeft: true }, Math.atan2(-(back.x - P.pos.x), -(back.z - P.pos.z))); watch(); }
      assert.equal(heardYou, true, 'a run she hears, and strikes at');
      assert.ok(said(/cannot hear a walk/), 'and it says to walk');
      // ---- back to the door, walking; a glob on her takes nothing
      assert.equal(go(A.center.clone().add(V(-A.r + 3, 0, 0)), { max: 30 }), true, 'back to the door');
      wait(3);
      const m0 = G.meter, info = {};
      G.landed('mouth', 'stun', null, info);
      assert.equal(G.meter, m0, 'the cold on her takes nothing');
      assert.equal(info.dull, true, 'and sounds dull');
      // ---- the hush: frost the three with the stilling mode (real globs, from the door)
      for (const s of C.swings) {
        let hit = null;
        for (let k = 0; k < 12 && !s.frost; k++) { hit = shoot(s.center, 'stun'); wait(0.3); }
        assert.ok(s.frost, `a pendulum frosted (${hit?.target?.kind ?? hit?.type})`);
      }
      assert.equal(until(() => G.phaseIndex === 1 && G.state === 'fight', 10), true, 'hushed: her second phase');
      assert.ok(Math.abs(G.meter - CALM.hush * 3) < 1e-6, `hushed, calmer (${G.meter.toFixed(2)})`);
      assert.ok(guardianBar(G.def, G.meter).fill < 0.6, 'the bar shows it');
      assert.ok(said(/falls silent/), 'the hall falls silent');
      // a frosted pendulum jangles no more: she strikes at nothing now
      let jangled = false;
      for (let i = 0; i < 8 * fps; i++) { H.frame(); if (G.attack && G.heardWhy === 'jangle') jangled = true; }
      assert.equal(jangled, false, 'silence');
      // ---- the lullaby: her head lies over her root's crystal; a splash there only wets her jaws
      assert.ok(Math.hypot(m.mouth.x - C.root.center.x, m.mouth.z - C.root.center.z) < C.cover, 'her head over the smallest crystal');
      C.root.hit('shoot');
      assert.equal(C.root.taken, false, 'covered: it does not ring');
      assert.ok(said(/somewhere else/), 'and it says to make a sound elsewhere');
      // the decoy: a hanging crystal rung before the first note rings flat, costs nothing, and she strikes at it
      const before = G.meter, decoy = C.notes[3];
      const hitDecoy = shoot(decoy.center);
      assert.equal(hitDecoy?.target?.kind, 'swing', 'a splash on the hanging crystal');
      assert.equal(G.meter, before, 'flat, before the first note: nothing lost');
      assert.equal(G.heardWhy, 'flat', 'she strikes at the flat note');
      assert.equal(until(() => !G.attack && Math.hypot(m.mouth.x - C.root.center.x, m.mouth.z - C.root.center.z) > C.cover, 8), true, 'her head lies off her root');
      // the first note, a real splash from the door
      const hitRoot = shoot(C.root.center);
      assert.ok(hitRoot?.target && C.root.taken, `the first note rings true (${hitRoot?.target?.kind ?? hitRoot?.type})`);
      assert.ok(G.meter > before, 'and calms her');
      // out of turn: the third before the second: flat, and the notes fade with their calm
      C.notes[3].hit('shoot');
      assert.ok(C.notes.every((n) => !n.taken), 'out of turn: the notes fade');
      assert.ok(Math.abs(G.meter - before) < 1e-6, 'and their calm with them');
      assert.ok(said(/Smallest crystal first/), 'smallest first, it says');
      // sung through: the root again (her head is off it: she struck at the flat note), then the three in turn
      until(() => !G.attack && Math.hypot(m.mouth.x - C.root.center.x, m.mouth.z - C.root.center.z) > C.cover, 8);
      C.root.hit('shoot');
      assert.equal(C.root.taken, true, 'the first note again');
      for (const n of C.notes.slice(1)) { n.hit('shoot'); }
      assert.equal(until(() => G.state === 'weary', 4), true, `weary (${G.meter.toFixed(2)})`);
      assert.equal(H.struck(), 0, 'never struck: he only walked when near her');
      // ---- a hand on her head
      wait(3);
      const head = m.mouth.clone().setY(A.y);
      const out = head.clone().sub(m.pos).setY(0).normalize();
      P.teleport(head.clone().addScaledVector(out, 2.4).add(V(0, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
      wait(0.3);
      const hand = bestInteractable(P);
      assert.equal(hand?.entry.id, 'temple.perdide.touch', 'a hand on her head');
      hand.entry.use(P);
      assert.equal(game.flag('temple.perdide.done'), true, 'she sleeps');
    } finally { H.done(); }
  });
}

test('the Mother Snapper knocked you out before her hall was hushed: the frost falls off the pendulums and they jangle again; after, only the lullaby’s notes fade (issue #409)', () => {
  const H = hall(60);
  const { rt, G, until } = H, C = rt.motherCrystals;
  try {
    assert.equal(until(() => G.state === 'fight', 10), true);
    C.swings[0].hit('stun'); C.swings[1].hit('stun');
    until(() => G.meter > 0.29, 2);
    assert.ok(Math.abs(G.meter - CALM.hush * 2) < 1e-6, 'two frosted: two shares');
    G.reset();
    assert.ok(C.swings.every((s) => !s.frost && s.still === 0), 'knocked out in her first phase: they jangle again');
    assert.equal(G.meter, 0);
    // hushed, then a note, then knocked out: the hush holds, the note fades
    H.P.teleport(G.arena.center.clone().add(V(-G.arena.r + 3, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    assert.equal(until(() => G.state === 'fight', 10), true, 'she wakes again');
    for (const s of C.swings) s.hit('stun');
    assert.equal(until(() => G.phaseIndex === 1 && G.state === 'fight', 10), true);
    G.listen = C.notes[3].center.clone(); until(() => Math.hypot(G.model.mouth.x - C.root.center.x, G.model.mouth.z - C.root.center.z) > C.cover, 6);
    C.root.hit('shoot');
    assert.equal(C.root.taken, true);
    G.reset();
    assert.ok(C.swings.every((s) => s.frost), 'the hush holds');
    assert.ok(C.notes.every((n) => !n.taken), 'the note fades');
    assert.ok(Math.abs(G.meter - CALM.hush * 3) < 1e-6, 'her meter where her phase began');
  } finally { H.done(); }
});
