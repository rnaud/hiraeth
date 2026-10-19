// The wings out in the world on still air (issue #523: "the wings should let me glide a bit further out even when there
// is no wind"): from 20 m up over flat ground, the stick let go, they carry the traveller about a quarter further than
// before (150 m); pulled back, as much further (171 m); a running jump, the double jump and the wings, a fifth further on
// the level (47 m). Under a makers' roof the wings keep the sinks they had (GLIDE_SINK.house) and the heavy glide of
// #436 (tests/wings-reach.js, tests/engine-wings.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { Player, GLIDE_SINK, HOUSE_GLIDE } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { items } from '../src/items.js';

const DT = 1 / 60;
function world(house = false) {
  for (const id of ['backpack', 'glider', 'doublejump']) items.grant(id);
  const P = new Player(new Physics(new THREE.Scene(), { heightAt: () => 0 }), { health: false });
  if (house) P.houses = [{ inside: () => true }];
  return P;
}
/** From `up` m over flat ground, the wings held open with the stick `keys`: { metres, heavy }. */
function glide(P, keys = {}, up = 20) {
  P.respawn(new THREE.Vector3(0, up, 0)); P.heading = 0; P.vel.set(0, 0, 0); P.onGround = false;
  let heavy = false;
  for (let i = 0; i < 60 * 60; i++) { P.update(DT, { Space: true, ...keys }, Math.PI); heavy ||= !!P.glideHeavy; if (i > 5 && P.onGround) break; }
  return { metres: Math.hypot(P.pos.x, P.pos.z), heavy };
}

test('out in the world on still air the wings glide a fifth to a third further than before', () => {
  const P = world();
  const calm = glide(P), flare = glide(P, { KeyS: true });
  assert.ok(!calm.heavy, 'the open world\'s glide');
  assert.ok(calm.metres > 150 * 1.2 && calm.metres < 150 * 1.35, `the stick let go: ${calm.metres.toFixed(0)} m from 20 m up (150 before)`);
  assert.ok(flare.metres > 171 * 1.15 && flare.metres < 171 * 1.35, `pulled back: ${flare.metres.toFixed(0)} m (171 before)`);
  assert.ok(GLIDE_SINK.calm < GLIDE_SINK.house.calm && GLIDE_SINK.flare < GLIDE_SINK.house.flare);
});

test('under a makers\' roof the wings glide as heavy as #436 made them, and in its moving air as before', () => {
  const P = world(true);
  const g = glide(P, {}, 8);
  assert.ok(g.heavy, 'the heavier glide');
  assert.ok(g.metres < 8 * 2 && g.metres < glide(world(), {}, 8).metres / 2, `steep: ${g.metres.toFixed(1)} m from 8 m up (15.3 before #523 too)`);
  assert.equal(HOUSE_GLIDE.ratio, 1);
  assert.deepEqual(GLIDE_SINK.house, { calm: 2.4, flare: 1.3 }, 'its breath, gusts and columns: the old sinks');
});
