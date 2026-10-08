// The evade's i-frames (src/fluid-blade.js EVADE, dodge; src/foes.js strike and updateHazards): inside the window
// no foe's blow lands, outside it does; spamming the evade leaves gaps; every kind of blow is checked; a perfect
// dodge; the Gentle setting's longer window; the hitbox overlay's label.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { EVADE, iframeWindow, evadeInvulnerable } from '../src/fluid-blade.js';
import { playerHitboxes, HITBOX_COLORS } from '../src/hitboxes.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { feelState, resetFeel } from '../src/feel.js';
import { tune } from '../src/minigames/kit/onfoot.js';

items.grant('backpack');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };

function player(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
  return { pos: at, vel: v(), heading: 0, frame, vehicles: [], object: { visible: true }, ride: null, onGround: true, aim: null, opts: {}, health: 1, down: null, dead: false,
    hurts: [], knocks: 0, flinch() {},
    hurt(a) { this.health = Math.max(0.5, this.health - a); this.hurts.push(a); },
    knockDown() { this.knocks++; return true; } };
}
function setup(enemies = true) {
  clearTargets();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const P = player();
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics: flat, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'arena', physics: flat, player: P, tool, settings: { enemies }, game: new GameState(null) });
  const B = tool.blade;
  B.gentle = foes.gentle;
  /** Rested (no cooldown, no rest), then an evade `frames` frames old. */
  const evadeFor = (frames) => {
    for (let i = 0; i < 1.5 / DT; i++) tool.update(DT, {});
    P.pos.set(0, 0, 0); P.vel.set(0, 0, 0);
    tool.update(DT, { AltLeft: true });
    for (let i = 0; i < frames; i++) tool.update(DT, {});
    P.pos.set(0, 0, 0);
  };
  return { P, tool, foes, B, evadeFor };
}
const attack = (id) => { for (const [kind, d] of Object.entries(FOES)) { const a = d.attacks?.find((x) => x.id === id); if (a) return { kind, a }; } throw new Error(id); };

test('the window: from 0.03 s to 0.24 s of the 0.28 s evade (Gentle: 0.02 s to its end), never without having been given it', () => {
  assert.deepEqual(iframeWindow(), [0.03, 0.24]);
  assert.ok(iframeWindow(true)[1] > iframeWindow()[1] && iframeWindow(true)[0] <= iframeWindow()[0], 'Gentle: a little longer');
  assert.ok(iframeWindow(true)[1] <= EVADE.duration);
  assert.ok(!evadeInvulnerable(0.01) && evadeInvulnerable(0.05) && evadeInvulnerable(0.2) && !evadeInvulnerable(0.25));
  assert.ok(evadeInvulnerable(0.25, true) && !evadeInvulnerable(0.29, true));
  assert.ok(!evadeInvulnerable(0.1, false, false), 'an evade given none has none');
  // about 13 of 30 frames of a souls-like roll: here 0.21 of 0.28 s, then the cooldown (and the rest) bare
  const [a, b] = iframeWindow();
  assert.ok((b - a) / EVADE.cooldown < 0.4, 'under four tenths of the time even evading back to back');
});

test('a foe\'s strike inside the window misses, outside it lands; the first swallowed is a perfect dodge', () => {
  const { P, foes, B, evadeFor } = setup();
  const { kind, a } = attack('slam');
  const f = foes.add(kind, v(0, 0, 1.5));
  const [w0, w1] = iframeWindow();
  for (let frames = 0; frames <= 18; frames++) {
    evadeFor(frames);
    const age = B.evadeAge, inside = B.evadeT > 0 && age >= w0 && age < w1;
    const before = P.hurts.length;
    resetFeel();
    const landed = foes.strike(f, a);
    assert.equal(landed, !inside, `${(age * 1000).toFixed(0)} ms into the evade: ${inside ? 'swallowed' : 'lands'}`);
    assert.equal(P.hurts.length - before, inside ? 0 : 1);
    if (inside) {
      assert.ok(B.dodged && feelState().stop > 0, 'a perfect dodge: the frame freezes a blink');
      assert.equal(P.dodge(f.pos, 'strike', false), true, 'a second blow in the same evade is swallowed too, with no second reward');
    }
  }
  clearTargets();
});

test('every kind of blow: a lunge, a lob, a volley, a charge, a flash, a harpoon, roots, a shockwave and slag', () => {
  const ids = ['slam', 'lob', 'volley', 'glide', 'flash', 'harpoon', 'grab'];
  for (const id of ids) for (const inside of [true, false]) {
    const { P, foes, B, evadeFor } = setup();
    const { kind, a } = attack(id);
    const f = foes.add(kind, v(0, 0, 2));
    evadeFor(inside ? 6 : 17);   // (0.1 s in, or 0.28 s: over)
    assert.equal(B.iframes(), inside);
    const landed = foes.strike(f, a);
    assert.equal(landed, !inside, `${id}: ${inside ? 'swallowed by the i-frames' : 'lands after them'}`);
    if (a.tether || a.grab) assert.equal(!!foes.hold, !inside, `${id}: ${inside ? 'no line, no grip' : 'pulled in'}`);
    if (a.blind) assert.equal((foes.blinded ?? 0) > 0, !inside, `${id}: ${inside ? 'not blinded' : 'blinded'}`);
    clearTargets();
  }
  // the machine's shockwave: its front passing through the i-frames is swallowed, after them it lands
  for (const inside of [true, false]) {
    const { P, foes, evadeFor } = setup();
    const { kind, a } = attack('quake');
    const f = foes.add(kind, v(0, 0, 4));
    foes.addWave(f, a);
    evadeFor(inside ? 6 : 17);
    foes.shocks[0].r = 4 - a.wave.speed * DT;   // (its front reaches the feet this frame)
    foes.updateHazards(DT);
    assert.equal(P.hurts.length, inside ? 0 : 1, `shockwave ${inside ? 'swallowed' : 'lands'}`);
    assert.equal(foes.shocks[0]?.dodged ?? false, inside);
    clearTargets();
  }
  // slag: no burn while the i-frames carry you over it; standing in it after, it burns
  {
    const { P, foes, tool, evadeFor } = setup();
    foes.addPatch(0, 0, 0, 1.2, 5);
    evadeFor(4);
    foes.updateHazards(DT);
    assert.equal(P.hurts.length, 0, 'over the slag in the i-frames: unburnt');
    for (let i = 0; i < 16; i++) { tool.update(DT, {}); P.pos.set(0, 0, 0); }
    foes.updateHazards(DT);
    assert.equal(P.hurts.length, 1, 'still in it after the window: it burns');
    clearTargets();
  }
});

test('spamming the evade is never unbroken cover: gaps without i-frames between them, and an evade too soon after one gets none', () => {
  const run = () => {
    const { tool, B } = setup();
    const on = [], granted = [];
    for (let i = 0; i < 4 / DT; i++) {
      const press = i % 2 === 0;
      const was = B.evadeT;
      tool.update(DT, press ? { AltLeft: true } : {});
      if (B.evadeT > was) granted.push(B.evadeGranted);
      on.push(B.iframes());
    }
    // the runs with and without
    let longestOff = 0, longestOn = 0, n = 0, cur = 0, val = on[0];
    for (const x of on.concat(!on.at(-1))) { if (x === val) cur++; else { if (val) longestOn = Math.max(longestOn, cur); else if (n++ > 0) longestOff = Math.max(longestOff, cur); val = x; cur = 1; } }
    return { share: on.filter(Boolean).length / on.length, longestOn: longestOn * DT, gaps: longestOff * DT, granted, B };
  };
  const r = run();
  assert.ok(r.share < 0.4, `covered ${(r.share * 100).toFixed(0)}% of the time`);
  assert.ok(r.longestOn <= iframeWindow()[1] - iframeWindow()[0] + DT * 1.5, `never longer than one window (${r.longestOn.toFixed(2)} s)`);
  assert.ok(r.granted.length >= 5 && r.granted.every(Boolean), 'at the usual pace each evade has its i-frames');
  // the Light feet boon (Ink tide: a shorter cooldown) brings evades inside the rest: every other one bare
  const keep = tune(EVADE, { cooldown: 0.4 });
  try {
    const q = run();
    assert.ok(q.granted.includes(false) && q.granted.includes(true), 'some evades given none');
    assert.ok(q.share < 0.4, `covered ${(q.share * 100).toFixed(0)}% of the time`);
  } finally { keep(); clearTargets(); }
});

test('Gentle: a slightly longer window', () => {
  const normal = setup(true), gentle = setup('gentle');
  assert.equal(gentle.foes.gentle, true);
  for (const S of [normal, gentle]) S.evadeFor(15);   // (0.25 s in)
  assert.equal(normal.B.iframes(), false);
  assert.equal(gentle.B.iframes(), true);
  const { kind, a } = attack('slam');
  assert.equal(gentle.foes.strike(gentle.foes.add(kind, v(0, 0, 1.5)), a), false, 'Gentle: still swallowed');
  assert.equal(normal.foes.strike(normal.foes.add(kind, v(0, 0, 1.5)), a), true);
  clearTargets();
});

test('the hitbox overlay shows the window: its label and a colour of its own', () => {
  const { P, tool, foes, evadeFor } = setup();
  evadeFor(6);
  let out = playerHitboxes({ player: P, tool, foes });
  const label = (o) => o.find((s) => s.kind === 'label' && s.tag.includes('evade.label'));
  assert.match(label(out).text, /I-FRAMES/);
  assert.doesNotMatch(label(out).text, /no i-frames/);
  assert.equal(out.find((s) => s.tag === 'evade.iframes').color, HITBOX_COLORS.iframes);
  assert.equal(out.find((s) => s.tag === 'player.hurt.iframes').color, HITBOX_COLORS.iframes);
  assert.notEqual(HITBOX_COLORS.iframes, HITBOX_COLORS.evade);
  for (let i = 0; i < 10; i++) tool.update(DT, {});   // (0.27 s in: past the window, still evading)
  assert.ok(tool.blade.evadeT > 0);
  out = playerHitboxes({ player: P, tool, foes });
  assert.match(label(out).text, /i-frames over/);
  assert.equal(out.find((s) => s.tag === 'evade').color, HITBOX_COLORS.evade);
  clearTargets();
});
