import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, attackOf } from '../src/foes.js';
import { REACT } from '../src/foe-react.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { setHintLevel } from '../src/hint-level.js';

// A guarded blow throws the attacker back (issue #672, the Breath of the Wild study, docs/design/combat-botw-study.md):
// its body reels off the shield on the hit-reaction springs (src/foe-react.js), a perfect parry a held stagger, a plain
// block a flinch with no flash (it took no harm). Before, a guarded archetype only slid back: its body never moved.

setHintLevel('full');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (o = {}) => ({ pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {}, ...o });
const world = (P) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });

function guarded(result) {
  clearTargets();
  const foes = world(player({ guard: () => result }));
  const f = foes.add('blot', v(0, 0, 2)); f.heading = Math.PI;   // (facing the traveller at the origin)
  const hp = f.hp;
  foes.strike(f, attackOf('blot', 'lunge'));
  const R = f.react, kind = R.kind, flash = R.flashT, lean = R.leanT;
  let tip = 0;
  for (let i = 0; i < 30; i++) { R.update(1 / 60); tip = Math.max(tip, Math.abs(R.tip.y)); }
  foes.dispose(); clearTargets();
  return { kind, flash, lean, tip, hurt: hp - f.hp, state: f.state };
}

test('a perfect parry staggers the foe\'s body: a held reel and a flash, no harm', () => {
  const r = guarded('perfect');
  assert.equal(r.kind, 'stagger');
  assert.ok(r.flash > 0, 'its ink flashes at the clang');
  assert.ok(r.lean > 0.35, `the lean held while it is open (${r.lean.toFixed(2)} s)`);
  assert.ok(r.tip > REACT.flinch.tip * 0.5, `it tips back visibly (${r.tip.toFixed(3)} rad)`);
  assert.equal(r.hurt, 0, 'the parry itself costs it nothing');
  assert.equal(r.state, 'recover');
});

test('a plain block makes it flinch back, without the hurt flash', () => {
  const r = guarded(true);
  assert.equal(r.kind, 'flinch');
  assert.equal(r.flash, 0, 'no flash: it was not hurt');
  assert.equal(r.lean, 0);
  assert.ok(r.tip > 0.05, `it still tips back off the shield (${r.tip.toFixed(3)} rad)`);
});

test('a perfect parry reels further than a plain block', () => {
  assert.ok(guarded('perfect').tip > guarded(true).tip * 1.3);
});
