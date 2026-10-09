// No invisible enemies (playtest 2026-10-08): every foe shows itself in every state, a buried ray swims at you
// before it bursts up, a foe winding up behind a wall gets a marker, and no foe comes in inside the world.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, SWIM, warnSpot, attackOf } from '../src/foes.js';
import { presenceOf, presenceProblems, lightMaterial, PRESENCE } from '../src/foe-presence.js';
import { makeMaterial } from '../src/materials.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(at = v()) { return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} }; }
const world = (P, physics = flat) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });

test('presenceOf measures what is drawn over the ground, and what of it is light', () => {
  const g = new THREE.Group();
  const ink = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), makeMaterial({ color: '#15121c', flat: true, key: 't-ink' }));
  ink.position.y = 0.5; g.add(ink);
  let p = presenceOf(g, 0);
  assert.ok(Math.abs(p.height - 1) < 1e-6 && Math.abs(p.width - 1) < 1e-6 && p.light === 0);
  assert.deepEqual(presenceProblems(p), ['no light part (0.00 m)'], 'black on black: nothing light');
  ink.material = makeMaterial({ color: '#15121c', flat: true, lineWhite: true, key: 't-ink-white' });
  assert.ok(lightMaterial(ink.material), 'a white contour reads on dark ground');
  assert.equal(presenceProblems(presenceOf(g, 0)).length, 0);
  ink.position.y = -0.6;   // (under the ground)
  assert.equal(presenceOf(g, 0).height, 0);
  ink.position.y = 0.5; ink.visible = false;
  assert.equal(presenceOf(g, 0).height, 0, 'hidden meshes do not count');
});

test('every kind shows itself in every state: tall enough, wide enough, with a light part (bug: the phased hound was a flat pool)', () => {
  const states = {};
  for (const kind of Object.keys(FOES)) {
    clearTargets();
    const P = player(v(0, 0, 0)), foes = world(P);
    foes.waveRest = 1e9;
    const f = foes.add(kind, v(0, 0, 8));
    for (let i = 0; i < 30 / DT; i++) {
      foes.update(DT); P.health = 1; P.down = null;
      if (i % 300 === 0) P.pos.set(Math.sin(i) * 4, 0, Math.cos(i) * 4);
      if (!f.alive) break;
      const tag = `${kind}:${f.state}${f.state === 'wind' || f.state === 'strike' ? ':' + f.atk.id : ''}${f.buried ? ':buried' : ''}${f.phased ? ':phased' : ''}`;
      states[tag] = true;
      const probs = presenceProblems(presenceOf(f.model.group, f.pos.y));
      assert.deepEqual(probs, [], `${tag} at ${i}`);
    }
    foes.dispose();
  }
  // the states that used to hide are among those checked
  assert.ok(Object.keys(states).some((t) => t.startsWith('hound:chase') && t.endsWith(':phased')), 'a running hound');
  assert.ok(Object.keys(states).some((t) => t.startsWith('ray:') && t.includes(':buried')), 'a buried ray');
  assert.ok(states['ray:wind:erupt:buried'], 'a ray winding up under the sand');
  clearTargets();
});

test('a buried dune ray swims at you as it winds up its burst, its fin up the whole way (bug: it sank its fin and burst up from nowhere)', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.waveRest = 1e9;
  const f = foes.add('ray', v(0, 0, 8));
  const erupt = attackOf('ray', 'erupt');
  f.def = { ...f.def, attacks: [erupt] };   // (only its burst)
  let wound = false, start = null, minFin = Infinity;
  for (let i = 0; i < 12 / DT && !wound; i++) {
    foes.update(DT); P.health = 1;
    if (f.state === 'wind' && f.atk.id === 'erupt') {
      start ??= f.pos.distanceTo(f.attackAt);
      minFin = Math.min(minFin, presenceOf(f.model.group, f.pos.y).height);
      if (f.k > SWIM.arrive + 0.02) {
        assert.ok(f.buried, 'still under the sand');
        assert.ok(f.pos.distanceTo(f.attackAt) < 1, `under its ring by then (${f.pos.distanceTo(f.attackAt).toFixed(2)} m, from ${start.toFixed(2)})`);
        wound = true;
      }
    }
  }
  assert.ok(wound && start > 2, 'it wound up from a distance');
  assert.ok(minFin >= 0.7, `its fin stands ${minFin.toFixed(2)} m over the sand`);
  foes.dispose(); clearTargets();
});

test('the warning marker: none for a foe in sight, one over a foe hidden behind the world, one at the edge for a foe off the screen', () => {
  assert.equal(warnSpot(0.2, 0.1, true, false), null, 'in sight: its body is the tell');
  assert.deepEqual(warnSpot(0.2, 0.1, true, true), { x: 0.2, y: 0.1, edge: false }, 'behind a wall: marked where it is (bug: no tell)');
  const side = warnSpot(2, 0, true);
  assert.ok(side.edge && Math.abs(side.x - 0.9) < 1e-9, 'off to the right: at the right edge');
  assert.ok(Math.abs(warnSpot(0.05, 0.05, false).y + 0.82) < 1e-9, 'straight behind: at the bottom');
});

test('hiddenFromCamera asks the world for a clear line from the camera', () => {
  clearTargets();
  const P = player(), wall = { ...flat, rayDistance: () => 3 }, foes = world(P, wall);
  foes.camera = { position: v(0, 2, -5) };
  const f = foes.add('blot', v(0, 0, 10));
  assert.equal(foes.hiddenFromCamera(f), true, 'a wall 3 m off the camera');
  foes.physics = flat;
  assert.equal(foes.hiddenFromCamera(f), false);
  foes.dispose(); clearTargets();
});

test('no foe comes in inside the world: spots inside a solid are passed over (bug: guards and waves fell back to a guessed height)', () => {
  clearTargets();
  const P = player();
  // a rock fills x > 0: a capsule there is pushed out
  const rock = { ...flat, pushCapsule: (pos, r, b, t, out) => (pos.x > 0 ? out.set(-1, 0, 0) : null), groundAt: (x) => (x > 50 ? NaN : 0) };
  const foes = world(P, rock);
  assert.equal(foes.roomAt('blot', v(5, 0, 0)), false);
  assert.equal(foes.roomAt('blot', v(-5, 0, 0)), true);
  for (let k = 0; k < 12; k++) {
    const at = foes.openSpot('blot', v(0, 0, 0), (k / 12) * Math.PI * 2, 9, 20, 40);
    assert.ok(at.x <= 0 && Number.isFinite(at.y), `bearing ${k}: ${at.x.toFixed(2)}`);
  }
  // spawnKind ahead of you, into the rock: it comes in beside it instead
  P.heading = Math.PI / 2;   // (facing +x)
  const [f] = foes.spawnKind('blot');
  assert.ok(f.pos.x <= 0, `spawned clear of the rock (${f.pos.x.toFixed(2)})`);
  assert.ok(PRESENCE.height > 0);
  foes.dispose(); clearTargets();
});
