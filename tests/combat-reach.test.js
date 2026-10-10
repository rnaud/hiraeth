// The blade's reach on every archetype (docs/systems/foes.md, "The body the blade meets", v1.35): the drawn body is what
// the swept blade meets (src/foe-body.js), the soft aim tilts the swing toward a low or a high body (src/fluid-blade.js
// AIM), the cut's pull arrives before the blade comes through; and the miss table's first row: every archetype is hit by
// a plain first swing from in front at 1.5 m (scripts/combat-reach.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIM, MAGNET, aimTilt, closeInTime, closeInSpeed, bodyHits } from '../src/fluid-blade.js';
import { segmentBox, bodyParts, bodyTouch, bodySpan, bodyReach, NON_BODY } from '../src/foe-body.js';
import { Foes } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { reachRig, swingAt } from '../scripts/combat-reach.mjs';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const BUILT = Object.entries(ARCHETYPES).filter(([, A]) => A.status === 'built');

test('a segment against a box: through it, past it, along an edge, from inside', () => {
  const lo = v(-1, -1, -1), hi = v(1, 1, 1);
  assert.ok(Math.abs(segmentBox(v(-3, 0, 0), v(3, 0, 0), lo, hi) - 1 / 3) < 1e-9, 'enters a third of the way');
  assert.equal(segmentBox(v(-3, 2, 0), v(3, 2, 0), lo, hi), -1, 'passes over it');
  assert.equal(segmentBox(v(-3, 0, 0), v(-2, 0, 0), lo, hi), -1, 'stops short');
  assert.equal(segmentBox(v(0, 0, 0), v(0.2, 0, 0), lo, hi), 0, 'starts inside');
});

test('the body the blade meets: each archetype\'s drawn parts, not its smoke, threads or ripples; hidden parts left out', () => {
  clearTargets();
  const P = { pos: v(0, 0, 40), vel: v(), heading: 0, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  for (const k of ['smoke', 'thread', 'mist', 'halo', 'ripple', 'line']) assert.ok(NON_BODY.test(k), k);
  for (const k of ['shell', 'leg', 'wing', 'bell', 'cloak']) assert.ok(!NON_BODY.test(k), k);
  for (const [id, A] of BUILT) {
    const f = foes.add(A.kind, v(0, 0, 0));
    for (let i = 0; i < 10; i++) foes.look(f, 1 / 60);
    f.model.group.updateMatrixWorld(true);
    const parts = bodyParts(f.model), S = bodySpan(f.model);
    assert.ok(parts.length >= 3, `${id}: ${parts.length} parts`);
    for (const p of parts) assert.ok(!/smoke|"key":"arch\.[a-z]+\.[^."]+\.thread"/.test(p.mesh.material?.userData?.cacheKey ?? ''), `${id}: no smoke or thread in its body`);
    assert.ok(S.hi > S.lo && S.radius > 0.1, `${id}: a body ${S.lo.toFixed(2)}..${S.hi.toFixed(2)} m`);
    assert.ok(bodyReach(f.model) >= 0, `${id}: its front`);
    const T = allTargets().find((t) => t.foe === f);
    assert.equal(T.body(), f.model, `${id}: its target says its body`);
    assert.ok(T.reach <= T.radius + 1e-9, `${id}: the pull never stands you further off than before`);
    // a blade swept straight through its middle meets it; one swept a metre over its top doesn't
    const c = S.centre, y = THREE.MathUtils.lerp(S.lo, S.hi, 0.5);
    const across = (yy) => [{ a: v(c.x - 3, yy, c.z), b: v(c.x - 2.2, yy, c.z) }, { a: v(c.x + 2.2, yy, c.z), b: v(c.x + 3, yy, c.z) }];
    assert.ok(bodyTouch(f.model, ...across(y)), `${id}: through its middle`);
    assert.equal(bodyTouch(f.model, ...across(S.hi + 1)), null, `${id}: a metre over it`);
    foes.remove(f);
  }
  // a cracked crab's dome (hidden) is not hit where only it was
  foes.dispose(); clearTargets();
});

test('the soft aim: a low body gets a lower arc, a high one a raised one, within limits; one in the arc\'s way none', () => {
  const sh = 1.25;
  assert.equal(aimTilt(0, 2.2, 1.3, sh, 0), 0, 'a tall body the arc crosses: no tilt');
  const low = aimTilt(0, 0.56, 1.3, sh, 0), lower = aimTilt(0, 0.3, 1.3, sh, 0);
  assert.ok(low > 0.2 && low <= AIM.down, `a skitter: down ${low.toFixed(2)} rad`);
  assert.ok(lower >= low, 'lower still: as much or more');
  assert.equal(aimTilt(0, 0.05, 1.3, sh, 0), AIM.down, 'never past the limit');
  const high = aimTilt(1.8, 3.2, 1.3, sh, 0);
  assert.ok(high < 0 && high >= -AIM.up, `a flyer over the arc: up ${(-high).toFixed(2)} rad`);
  assert.equal(aimTilt(5, 6, 1.3, sh, 0), -AIM.up);
  assert.equal(aimTilt(1, 1, 1.3, sh, 0), 0, 'no body: nothing');
});

test('the cut\'s pull arrives as the cut begins, not as it ends', () => {
  const S = { wind: 0.22, active: 0.16 };
  assert.ok(Math.abs(closeInTime(S) - (0.22 + 0.16 * MAGNET.arrive)) < 1e-12);
  assert.ok(closeInTime(S) < S.wind + S.active);
  const d = 3.35, r = 0.82, gap = d - r - MAGNET.ideal;
  assert.ok(Math.abs(closeInSpeed(d, r, closeInTime(S)) * closeInTime(S) - gap) < 1e-9, 'the whole gap by then');
});

test('bodyHits: a blade swept through a foe\'s drawn body hits it there; through the air beside it, nothing', () => {
  clearTargets();
  const P = { pos: v(0, 0, 40), vel: v(), heading: 0, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  const f = foes.add('skitter', v(0, 0, 1.6));
  for (let i = 0; i < 10; i++) foes.look(f, 1 / 60);
  f.model.group.updateMatrixWorld(true);
  const S = bodySpan(f.model), y = (S.lo + S.hi) / 2;
  const hit = bodyHits(v(0, 1.1, 0), 3, null, { a: v(-1.2, y, 1.6), b: v(-0.4, y, 1.6) }, { a: v(0.4, y, 1.6), b: v(1.2, y, 1.6) });
  assert.equal(hit.length, 1); assert.ok(hit[0].body && hit[0].point.distanceTo(S.centre) < 0.6, 'at its body');
  assert.equal(bodyHits(v(0, 1.1, 0), 3, null, { a: v(-1.2, 1.1, 1.6), b: v(-0.4, 1.1, 1.6) }, { a: v(0.4, 1.1, 1.6), b: v(1.2, 1.1, 1.6) }).length, 0, 'the old level arc over it: nothing');
  foes.dispose(); clearTargets();
});

test('the miss table\'s first row: every archetype is hit by a plain first swing from in front at 1.5 m, by the drawn blade on its drawn body', async () => {
  clearTargets();
  const rig = await reachRig();
  const misses = [];
  for (const [id, A] of BUILT) {
    const r = await swingAt(rig, A.kind, { gap: 1.5, angle: 0, swing: 0 });
    if (!r.hit) misses.push(`${id} (blade's lowest over it ${r.low?.toFixed(2) ?? 'never over it'}, its body ${r.span.lo.toFixed(2)}–${r.span.hi.toFixed(2)})`);
  }
  assert.deepEqual(misses, [], `missed: ${misses.join(', ')}`);
  // and the low ones need the soft aim: without it the first swing goes over a skitter
  const legacy = await swingAt(rig, 'skitter', { gap: 1.5, angle: 0, swing: 0, legacy: true });
  assert.ok(!legacy.hit && legacy.over > 0, 'before v1.35 it passed over a skitter');
  rig.tool.dispose(); clearTargets();
});
