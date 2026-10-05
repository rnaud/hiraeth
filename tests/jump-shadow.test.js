import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JumpShadow, JUMP_SHADOW, jumpShadowRadius, wantsJumpShadow } from '../src/jump-shadow.js';
import { Player } from '../src/player.js';

// The jump's shadow (src/jump-shadow.js): a patch of shade straight under the traveller while off the ground.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: (x, y, z, out = V()) => out.set(0, 1, 0) };

test('the jump\'s shadow: none standing, it grows in just off the ground, shrinks with the height, gone far up', () => {
  assert.equal(jumpShadowRadius(0), 0, 'standing: the real shadow does it');
  assert.equal(jumpShadowRadius(0.1), 0, 'nor a step');
  assert.ok(jumpShadowRadius(0.4) > 0 && jumpShadowRadius(0.4) < jumpShadowRadius(1), 'growing in');
  let last = Infinity;
  for (const h of [1, 2, 4, 8, 16, 25]) { const r = jumpShadowRadius(h); assert.ok(r > 0.1 && r < last, `${h} m: ${r.toFixed(2)} m`); last = r; }
  assert.ok(jumpShadowRadius(1) <= JUMP_SHADOW.radius && jumpShadowRadius(1) > JUMP_SHADOW.radius * 0.8, 'about the body\'s width off a jump');
  assert.equal(jumpShadowRadius(JUMP_SHADOW.far), 0, 'gone far up');
  assert.equal(jumpShadowRadius(Infinity), 0, 'nothing under you: none');
});

test('the jump\'s shadow lies on the surface under a jump, a glide, the jets; not standing, riding, swimming, climbing or knocked down', () => {
  const scene = new THREE.Scene();
  const S = new JumpShadow(scene);
  assert.ok(scene.children.includes(S.mesh));
  const p = new Player(flat, { health: false });
  p.pos.set(3, 4, -2); p.onGround = false;
  S.update(p, flat);
  assert.ok(S.mesh.visible, 'jumping: shown');
  assert.ok(S.mesh.position.distanceTo(V(3, JUMP_SHADOW.lift, -2)) < 1e-6, 'straight under, on the ground');
  assert.ok(Math.abs(S.mesh.scale.x - jumpShadowRadius(4)) < 1e-9, 'sized by the height');
  for (const [why, set] of [['standing', (q) => { q.onGround = true; }], ['riding', (q) => { q.ride = {}; }], ['swimming', (q) => { q.swim = {}; }],
    ['climbing', (q) => { q.climbing = true; }], ['knocked down', (q) => { q.down = {}; }]]) {
    const q = new Player(flat, { health: false }); q.pos.set(0, 4, 0); q.onGround = false; set(q);
    assert.equal(wantsJumpShadow(q), false, why);
    S.update(q, flat);
    assert.equal(S.mesh.visible, false, `${why}: none`);
  }
  for (const [why, set] of [['gliding', (q) => { q.gliding = true; }], ['on the jets', (q) => { q.thrusting = true; }]]) {
    const q = new Player(flat, { health: false }); q.pos.set(0, 6, 0); q.onGround = false; set(q);
    S.update(q, flat);
    assert.ok(S.mesh.visible, `${why}: shown`);
  }
  // on a ledge below, the first surface under you (one ray), tipped to its slope
  const slope = { ...flat, heightAbove: (q) => q.y - (2 + q.x * 0.5), groundNormal: (x, y, z, out = V()) => out.set(-0.5, 1, 0).normalize() };
  p.pos.set(2, 10, 0);
  S.update(p, slope);
  assert.ok(Math.abs(S.mesh.position.y - (3 + JUMP_SHADOW.lift * 0.894)) < 0.01, `on the slope (${S.mesh.position.y.toFixed(3)})`);
  const n = V(0, 1, 0).applyQuaternion(S.mesh.quaternion);
  assert.ok(n.distanceTo(V(-0.5, 1, 0).normalize()) < 1e-6, 'lying along it');
  // turned gravity (the Hangar): along the player's up
  const side = { ...flat, heightAbove: (q, up) => (up.x > 0.99 ? q.x : q.y) };
  const r = new Player(side, { health: false, spawnUp: V(1, 0, 0) });
  r.frame.set(V(1, 0, 0)); r.pos.set(5, 1, 1); r.onGround = false;
  S.update(r, side);
  assert.ok(S.mesh.visible && S.mesh.position.distanceTo(V(JUMP_SHADOW.lift, 1, 1)) < 1e-6, 'on the floor under you, wherever down is');
  S.dispose();
  assert.ok(!scene.children.includes(S.mesh));
});

test('the jump\'s shadow is drawn as shade in the G-buffer: the light taken away, the colour darkened, nothing else touched', () => {
  const S = new JumpShadow(new THREE.Scene());
  const m = S.mesh.material;
  assert.match(m.fragmentShader, /gAlbedoLight = vec4\(vec3\(uDark\), 0\.0\)/, 'light term 0: shade (hatched and inked by the post pass)');
  assert.match(m.fragmentShader, /gNormalDepth = vec4\(1\.0\)/);
  assert.match(m.fragmentShader, /gHatch = vec4\(1\.0\)/);
  assert.equal(m.blendSrc, THREE.DstColorFactor, 'multiplied into what is there');
  assert.equal(m.blendSrcAlpha, THREE.DstAlphaFactor);
  assert.equal(m.depthWrite, false);
  assert.equal(S.mesh.userData.castShadow, false);
});
