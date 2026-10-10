// The guardians on the screen and in the drone's hints: the bar is what is left of them (a machine's
// health, a living guardian's unrest), the warden's vents keep opening phase after phase (its crown
// once its sides are shut, and you can see it from the floor), and a ping in a fight is a hint
// written for that guardian, plainer each time.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { guardianBar } from '../src/temples/boss.js';
import { guardianHint, BOSS_HINTS } from '../src/temples/hints.js';
import { TEMPLES } from '../src/temples/index.js';
import { LEVELS } from '../src/levels/index.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { allTargets, hitTarget } from '../src/targets.js';
import { readFileSync } from 'node:fs';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test('a guardian\'s bar is what is left of it: full at the start, going down; health for a machine, unrest for a living one', () => {
  const robot = { kind: 'robot', name: 'the warden' }, living = { kind: 'organic', name: 'the Keeper of the cistern' };
  assert.equal(guardianBar(robot, 0).fill, 1, 'full at the start');
  assert.equal(guardianBar(robot, 0.25).fill, 0.75, 'down a quarter after a quarter of the fight');
  assert.equal(guardianBar(robot, 1).fill, 0, 'empty when it is broken');
  assert.equal(guardianBar(robot, 0).label, 'the warden · health');
  assert.doesNotMatch(guardianBar(robot, 0).label, /damage/);
  assert.equal(guardianBar(living, 0.4).label, 'the Keeper of the cistern · unrest', 'a living guardian is calmed, never hurt');
  assert.ok(Math.abs(guardianBar(living, 0.4).fill - 0.6) < 1e-9);
  // the screen's bar is drawn from it
  const rt = readFileSync(new URL('../src/temples/runtime.js', import.meta.url), 'utf8');
  assert.match(rt, /guardianBar\(G\.def, G\.meter\)\.fill/);
  assert.doesNotMatch(rt, /'damage' : 'calm'/);
});

test('every guardian has the drone\'s hints, three lines a phase (plainer each time), and somewhere to point', () => {
  for (const id of Object.keys(TEMPLES)) {
    const H = BOSS_HINTS[id];
    assert.ok(H, `${id}: hints`);
    for (const [i, lines] of H.phases.entries()) {
      assert.equal(lines.length, 3, `${id} phase ${i}: a nudge, plainer, plainest`);
      for (const l of lines) { assert.ok(l.length > 10 && l.length < 120, `${id}: a short line for the cue (“${l}”)`); assert.doesNotMatch(l, /~\w+~/, 'plain text, no tone marks'); }
      assert.ok(lines[2].length >= lines[0].length, `${id} phase ${i}: the plainest says more than the nudge`);
    }
  }
});

test('guardianHint: only in a fight, inside; its phase\'s lines; the weary guardian asks for your hand; the lens on its weak point', () => {
  const pos = V(1, 2, 3);
  const g = { state: 'sleep', phaseIndex: 0, def: { touch: 'lay a hand on its brow', phases: [{ to: 0.4 }, { to: 0.8 }, { to: 1, weary: true }] }, model: { mouth: pos, pos: V() }, get awake() { return this.state !== 'sleep' && this.state !== 'resolved'; } };
  const rt = { id: 'perdide', guardian: g, player: { pos: V() }, inside: () => true };
  g.rt = rt;
  assert.equal(guardianHint(rt), null, 'asleep: no hint (the ping finds the objective)');
  g.state = 'fight';
  const h = guardianHint(rt);
  assert.equal(h.id, 'perdide.0'); assert.deepEqual(h.lines, BOSS_HINTS.perdide.phases[0]);
  assert.ok(h.at().equals(pos), 'the lens on its weak point');
  g.phaseIndex = 1; assert.equal(guardianHint(rt).id, 'perdide.1', 'a new phase: its own lines');
  g.state = 'weary'; assert.match(guardianHint(rt).lines[0], /lay a hand on its brow/);
  g.state = 'fight'; rt.inside = () => false; assert.equal(guardianHint(rt), null, 'outside the temple: none');
  rt.inside = () => true; rt.player.dead = true; assert.equal(guardianHint(rt), null, 'knocked out: none');
  rt.player.dead = false; g.state = 'resolved'; assert.equal(guardianHint(rt), null, 'resolved: none');
});

// ------------------------------------------------------------------ the warden's vents, in its tower
test('the warden\'s vents keep opening, fight after fight: its sides in the first phase, then its crown, which you can see open from the floor', () => {
  game.reset();
  for (const id of Object.keys(ITEMS)) items.grant(id);
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === 'incal').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = level.temple;
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, killY: level.killY });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  const G = rt.guardian;
  let t = 0;
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); };
  for (let i = 0; i < 30; i++) frame();
  P.teleport(G.arena.center.clone().add(V(0, 0.5, -G.arena.r * 0.55)), V(0, 1, 0), V(0, 0, 1));
  P.opts.health = false;
  /** Wait for it to open (at most `secs`); then let the opening play out for `hold` s. */
  const opening = (secs = 40, hold = 1.2) => {
    for (let i = 0; i < secs / DT; i++) { frame(); if (G.state === 'open') { for (let k = 0; k < hold / DT && G.state === 'open'; k++) frame(); return true; } }
    return false;
  };
  // its hint in the fight: the drone's, for its phase
  for (let i = 0; i < 4 / DT && G.state !== 'fight'; i++) frame();
  assert.equal(guardianHint(rt)?.id, 'incal.0');
  // ---- the first phase: its side vents open again and again, and a shot into a side one counts
  let opens = 0;
  for (let n = 0; n < 6; n++) if (opening()) opens++;
  assert.equal(opens, 6, 'its side vents open after every beam, as long as you like');
  const side = () => allTargets().filter((x) => x.kind === 'sentinel' && x.enabled() && x.position().distanceTo(G.model.mouth) > 2);
  while (G.phaseIndex === 0) {
    assert.ok(opening(40, 0.3), 'it opens');
    const s = side();
    assert.ok(s.length >= 2, `its vents round its sides are targets while open (${s.length})`);
    hitTarget({ target: s[0], point: s[0].position() }, 'shoot', V(0, 0, 1));
  }
  assert.equal(G.meter, 0.5, 'four side vents: the first phase done');
  // ---- the second phase: its sides stay shut, the crown opens, every time, and it shows
  const said = notes.length;
  let crowns = 0;
  for (let n = 0; n < 6; n++) {
    assert.ok(opening(40, 0.9), `it opens again in the second phase (${n})`);
    assert.ok(G.model.crown > 0.5, `its crown is open (${G.model.crown.toFixed(2)})`);
    assert.ok(G.model.plume.visible && G.model.plume.scale.y > 2, 'a column of its glow rises out of it, seen from the floor');
    assert.ok(G.model.hatch.rotation.z > 1, 'the hatch swings up');
    assert.ok(G.model.shutters.every((s) => s.position.y < 0.5), 'its sides stay shut');
    crowns++;
  }
  assert.equal(crowns, 6, 'the crown keeps opening, as long as you like');
  assert.ok(notes.slice(said).some((s) => /crown/i.test(s) && /hatch/i.test(s)), 'and it says so: the crown’s hatch, not its vents');
  assert.equal(guardianHint(rt)?.id, 'incal.1', 'the drone’s hint for its second phase');
  assert.match(guardianHint(rt).lines.join(' '), /crown/);
  // from above, into the crown (in its last phase, over the vane it backs onto, held there on the jets): broken
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    assert.ok(opening(40, 0.2));
    if (G.phaseIndex >= 2) {
      for (let k = 0; k < 2.6 / DT; k++) frame();
      const v = rt.hallVanes.slice().sort((a, b) => a.center.distanceTo(G.model.pos) - b.center.distanceTo(G.model.pos))[0];
      P.teleport(v.center.clone().add(V(0, Math.max(6.5, G.model.mouth.y - v.center.y + 1.2), 0)), V(0, 1, 0), V(0, 0, 1));
      for (let i = 0; i < 3; i++) frame({ Space: true, PadJump: true });
      for (let i = 0; i < 0.5 / DT; i++) frame({ PadAim: true });
    } else P.teleport(G.model.mouth.clone().add(V(4, 1.5, 0)), V(0, 1, 0), V(0, 0, 1));
    G.hit('mouth', 'shoot');
    P.endJets();
    P.teleport(G.arena.center.clone().add(V(0, 0.5, -G.arena.r * 0.55)), V(0, 1, 0), V(0, 0, 1));
  }
  assert.equal(G.state, 'resolved');
  assert.equal(guardianHint(rt), null, 'resolved: the ping finds the objective again');
  game.reset();
});
