import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JumpShadow, JUMP_SHADOW, RIM, jumpShadowRadius, rimReach, wantsJumpShadow } from '../src/jump-shadow.js';
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
  const slope = { ...flat, heightAbove: (q) => q.y - (2 + q.x * 0.5), groundAt: (x) => 2 + x * 0.5, groundNormal: (x, y, z, out = V()) => out.set(-0.5, 1, 0).normalize() };
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
  assert.match(m.fragmentShader, /gAlbedoLight = vec4\(vec3\(mix\(uDark, uInk, ring\)\), 0\.0\)/, 'light term 0: shade (hatched by the post pass); darkened inside, inked in its ring');
  assert.ok(m.uniforms.uInk.value < m.uniforms.uDark.value && m.uniforms.uDark.value < 1, 'its ring darker than its inside, its inside darker than the ground');
  assert.ok(m.uniforms.uRing.value > 0 && m.uniforms.uRing.value < 0.25, 'a thin ring');
  assert.match(m.fragmentShader, /gNormalDepth = vec4\(1\.0\)/);
  assert.match(m.fragmentShader, /gHatch = vec4\(1\.0\)/);
  assert.equal(m.blendSrc, THREE.DstColorFactor, 'multiplied into what is there');
  assert.equal(m.blendSrcAlpha, THREE.DstAlphaFactor);
  assert.equal(m.depthWrite, false);
  assert.equal(S.mesh.userData.castShadow, false);
});

// Issue #666: precise platforming. The patch lies on what is really under the feet and stops at its edge.

/** The patch's rim points (world), from its mesh: each one's distance from the centre, as a share of its radius. */
const rimShares = (S) => {
  const p = S.mesh.geometry.attributes.position.array, out = [];
  for (let k = 1; k < p.length / 3; k++) out.push(Math.hypot(p[3 * k], p[3 * k + 2]));
  return out;
};

test('rimReach: whole on a floor, cut back toward the centre over a drop, a step or a rail; the rays it costs', () => {
  const c = V(0, 3, 0), n = V(0, 1, 0), out = new Float32Array(RIM.probes);
  let rays = 0;
  const floor = (x, fromY, z, drop) => { rays++; assert.ok(drop > 0 && drop < 2, `a short ray (${drop})`); return 3; };
  rimReach(floor, c, n, 0.4, 4, out);
  assert.ok(out.every((f) => f === 1), 'a floor all round: whole');
  assert.equal(rays, RIM.probes, 'one ray a probe');
  // a ledge's edge 0.2 m east of the centre (+x), the drop 3 m beyond it
  rays = 0;
  const ledge = (x) => { rays++; return x < 0.2 ? 3 : 0; };
  rimReach(ledge, c, n, 0.4, 4, out);
  assert.ok(Math.abs(out[0] - RIM.tries.find((f) => f * 0.4 < 0.2)) < 1e-6, `east, over the drop: pulled in to the first try inside the edge (${out[0]})`);
  assert.equal(out[RIM.probes / 2], 1, 'west, on the floor: whole');
  assert.equal(out[RIM.probes / 4], 1, 'north along the edge: whole');
  for (let k = 0; k < RIM.probes; k++) { const a = (k / RIM.probes) * Math.PI * 2; assert.ok(Math.cos(a) * out[k] * 0.4 < 0.2 + 1e-6, `probe ${k} never past the edge`); }
  assert.ok(rays <= RIM.probes * RIM.tries.length, `${rays} rays at most`);
  // a step up or down, or a rail over the floor, is off the plane too
  rimReach((x) => (x > 0.1 ? 3.18 : 3), c, n, 0.4, 4, out);
  assert.ok(out[0] < 1 && out[RIM.probes / 2] === 1, 'a step: cut at it');
  rimReach(() => 3.06, c, n, 0.4, 4, out);
  assert.ok(out.every((f) => f === 1), 'a few centimetres off (a seam, a tile): still whole');
  // on a slope the plane is the slope's
  const s = V(-0.5, 1, 0).normalize();
  rimReach((x) => 3 + 0.5 * x, c, s, 0.4, 4, out);
  assert.ok(out.every((f) => f === 1), 'a slope: whole');
  // nothing under it at all
  rimReach(() => -Infinity, c, n, 0.4, 4, out);
  assert.ok(out.every((f) => f === 0), 'a gap: nothing');
});

test('the jump\'s shadow at a ledge: cut along the edge, not hanging over the drop; rewritten only when its rim moves', () => {
  const S = new JumpShadow(new THREE.Scene());
  const ledge = { ...flat, heightAbove: (q) => q.y - (q.x < 0 ? 3 : 0), groundAt: (x) => (x < 0 ? 3 : 0), groundNormal: (x, y, z, out = V()) => out.set(0, 1, 0) };
  const p = new Player(ledge, { health: false });
  p.onGround = false;
  p.pos.set(-1, 4.5, 0);
  S.update(p, ledge);
  assert.ok(S.mesh.visible && rimShares(S).every((f) => Math.abs(f - 1) < 1e-6), 'well in from the edge: whole');
  const v0 = S.mesh.geometry.attributes.position.version;
  p.pos.set(-1.1, 4.5, 0.2);
  S.update(p, ledge);
  assert.equal(S.mesh.geometry.attributes.position.version, v0, 'moved, still whole: the mesh not rewritten');
  p.pos.set(-0.15, 4.5, 0);
  S.update(p, ledge);
  assert.ok(S.mesh.visible && Math.abs(S.mesh.position.y - (3 + JUMP_SHADOW.lift)) < 1e-6, 'on the ledge');
  const r = S.mesh.scale.x, shares = rimShares(S);
  assert.ok(S.mesh.geometry.attributes.position.version > v0, 'its rim rewritten');
  shares.forEach((f, k) => {
    const a = (k / shares.length) * Math.PI * 2, x = S.mesh.position.x + Math.cos(a) * f * r;
    assert.ok(x < 1e-6 || f === 0, `rim point ${k} on the ledge (x ${x.toFixed(3)})`);
  });
  assert.equal(shares[shares.length / 2], 1, 'whole away from the edge');
  assert.ok(shares[0] < 1, 'cut toward the drop');
  // out over the drop: its centre on the floor below, the ledge's lip over its west side
  p.pos.set(0.1, 4.5, 0);
  S.update(p, ledge);
  assert.ok(S.mesh.visible && Math.abs(S.mesh.position.y - JUMP_SHADOW.lift) < 1e-6, 'past the edge: on the floor below');
  S.dispose();
});

test('the jump\'s shadow lies on a moving floor under you (a lift, a cab\'s roof), not on the ground beneath it', () => {
  const S = new JumpShadow(new THREE.Scene());
  const lift = { solid: { pos: V(0, 2.2, 0), r: 1.5, top: 2.4, bottom: 2, vel: V() } };
  const p = new Player(flat, { health: false, dynamic: () => [lift] });
  p.onGround = false;
  p.pos.set(0.3, 4, 0);
  S.update(p, flat);
  assert.ok(S.mesh.visible && Math.abs(S.mesh.position.y - (2.4 + JUMP_SHADOW.lift)) < 1e-6, `on the lift's top (${S.mesh.position.y})`);
  assert.ok(Math.abs(S.mesh.scale.x - jumpShadowRadius(1.6)) < 1e-9, 'sized by the height over it');
  lift.solid.top = 3; lift.solid.pos.y = 2.8;   // (it rose)
  S.update(p, flat);
  assert.ok(Math.abs(S.mesh.position.y - (3 + JUMP_SHADOW.lift)) < 1e-6, 'with it as it rises');
  // at its rim: cut at its edge, the rest not hanging over the floor below
  p.pos.set(1.35, 4, 0);
  S.update(p, flat);
  const r = S.mesh.scale.x, shares = rimShares(S);
  assert.ok(shares[0] < 1 && shares[shares.length / 2] === 1, 'cut at the lift\'s edge');
  shares.forEach((f, k) => { const a = (k / shares.length) * Math.PI * 2; assert.ok(1.35 + Math.cos(a) * f * r <= 1.5 + 1e-6, `rim point ${k} on the lift`); });
  // ridden, it is no floor of yours (and no patch at all)
  p.ride = lift;
  S.update(p, flat);
  assert.equal(S.mesh.visible, false);
  S.dispose();
});

test('the jump\'s shadow leaves the physics\' last ground query as the player\'s step found it', () => {
  const S = new JumpShadow(new THREE.Scene());
  const phys = { ...flat, groundMover: 'wheel', groundKind: 'built', groundBase: false,
    heightAbove(q) { this.groundMover = null; this.groundKind = 'ground'; return q.y; },
    groundAt() { this.groundMover = null; this.groundKind = 'ground'; this.groundBase = true; return 0; } };
  const p = new Player(phys, { health: false });
  p.onGround = false; p.pos.set(0, 2, 0);
  Object.assign(phys, { groundMover: 'wheel', groundKind: 'built', groundBase: false });   // (as his own step left them)
  S.update(p, phys);
  assert.ok(S.mesh.visible);
  assert.deepEqual([phys.groundMover, phys.groundKind, phys.groundBase], ['wheel', 'built', false]);
  S.dispose();
});
