// Reading the crowd from the fight temples' iso camera (issue #534; src/fight-temples/view.js): the framing keeps him and
// the nearest telegraph in view (and marks one still off it at the screen's edge); the traveller hidden or hemmed in by
// his foes gets his ring; the floor's sigil is no longer a pair of rings, and faint against the floor in every temple;
// R3 / Tab, with no lock in here, is answered by the aim's ring and the lock's tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ISO, isoOffset } from '../src/fight-temples/rules.js';
import { FRAME, isoProject, frameIso, telegraphs, nearestTelegraph, SELF, hiddenShare, crowdAround, lostInCrowd, LOCK_ANSWER, answerScale } from '../src/fight-temples/view.js';
import { SelfMark, easeSelf } from '../src/fight-temples/self-mark.js';
import { HAZARD, lanePoint } from '../src/fight-temples/hazards.js';
import { SIGIL, sigilColor, sigilModel, buildHall } from '../src/fight-temples/rooms.js';
import { startFightTemple } from '../src/fight-temples/session.js';
import { screen } from '../src/platform.js';
import { runSteps } from '../src/load-steps.js';
import { Foes } from '../src/foes.js';
import { DESERT_FIGHT as D } from '../src/fight-temples/desert.js';
import { ARZACH_FIGHT } from '../src/fight-temples/arzach.js';
import { PERDIDE_FIGHT } from '../src/fight-temples/perdide.js';
import { MOONFOUNDRY_FIGHT } from '../src/fight-temples/moonfoundry.js';
import { EDENA_FIGHT } from '../src/fight-temples/edena.js';
import { INCAL_FIGHT } from '../src/fight-temples/incal.js';
import { BURIED_FIGHT } from '../src/fight-temples/buried.js';
import { BAZAAR_FIGHT } from '../src/fight-temples/bazaar.js';
import { UNDERWATER_FIGHT } from '../src/fight-temples/underwater.js';
import { GLASSDUNES_FIGHT } from '../src/fight-temples/glassdunes.js';
import { SPHERES_FIGHT } from '../src/fight-temples/spheres.js';
import { SPACECITY_FIGHT } from '../src/fight-temples/spacecity.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TEMPLES = [D, ARZACH_FIGHT, PERDIDE_FIGHT, MOONFOUNDRY_FIGHT, EDENA_FIGHT, INCAL_FIGHT, BURIED_FIGHT, BAZAAR_FIGHT, UNDERWATER_FIGHT, GLASSDUNES_FIGHT, SPHERES_FIGHT, SPACECITY_FIGHT];

test('the iso projection is the camera’s own (the framing measures what the screen shows)', () => {
  const look = V(3, 0.9, -4), zoom = 1.2;
  const cam = new THREE.PerspectiveCamera(ISO.fov, 16 / 9, 0.1, 500);
  cam.position.copy(look).addScaledVector(isoOffset(ISO, V()), zoom); cam.lookAt(look); cam.updateMatrixWorld();
  for (const p of [V(3, 0, -4), V(-6, 0, -12), V(11, 0, 2), V(0, 2, 0)]) {
    const a = p.clone().project(cam), b = isoProject(p, look, zoom, 16 / 9);
    assert.ok(Math.abs(a.x - b[0]) < 1e-6 && Math.abs(a.y - b[1]) < 1e-6, `${p.toArray()}`);
  }
});

test('the framing keeps him and the nearest telegraph in view: any way round him up to 12 m, on a wide screen and a 4:3 one', () => {
  const at = V(2, 0, -3);
  for (const aspect of [16 / 9, 4 / 3]) for (const d of [3, 6, 9, 12]) for (let a = 0; a < 360; a += 10) {
    const to = V(at.x + Math.cos(a * Math.PI / 180) * d, 0, at.z + Math.sin(a * Math.PI / 180) * d);
    const f = frameIso(at, to, aspect), look = V(at.x + f.dx, at.y + ISO.look, at.z + f.dz);
    const t = isoProject(to, look, f.zoom, aspect), p = isoProject(at, look, f.zoom, aspect);
    assert.ok(Math.max(Math.abs(t[0]), Math.abs(t[1])) <= FRAME.margin + 0.1, `the telegraph ${d} m at ${a}° in view (${t.map((v) => v.toFixed(2))})`);
    assert.ok(Math.max(Math.abs(p[0]), Math.abs(p[1])) <= FRAME.keep + 0.02, `he stays near the middle (${p.map((v) => v.toFixed(2))})`);
    assert.ok(f.zoom >= 1 && f.zoom <= FRAME.zoom + 1e-9, 'pulled back a little at most');
  }
  // nothing to frame: the view as it was; one already well in it moves nothing; one too far is left to the edge's marker
  assert.deepEqual(frameIso(at, null), { dx: 0, dz: 0, zoom: 1 });
  assert.deepEqual(frameIso(at, V(at.x - 1, 0, at.z - 1)), { dx: 0, dz: 0, zoom: 1 });
  assert.deepEqual(frameIso(at, V(at.x - 20, 0, at.z - 20)), { dx: 0, dz: 0, zoom: 1 });
  // and before it: a pool 6.5 m down the screen was at its bottom edge, its own width past it
  const was = isoProject(V(at.x + 4.6, 0, at.z + 4.6), V(at.x, ISO.look, at.z), 1);
  assert.ok(was[1] < -FRAME.margin, `it was at the edge (${was[1].toFixed(2)})`);
});

test('the telegraphs: a spot where it is, a sign on its wall, a cart’s lane at its head, a gust’s lane where it crosses him; none once it strikes', () => {
  const room = { x: [-12, 12], z: [-12, 12] };
  const lane = { along: 'x', at: 3, w: 2, dir: 1 };
  const list = [
    { kind: 'spill', ri: 0, lane: { spot: [4, 5] }, t: 0.2 },
    { kind: 'toll', ri: 0, lane: { sign: [-12, 2] }, t: 0.5 },
    { kind: 'cart', ri: 0, lane, t: 0.1 },
    { kind: 'gust', ri: 0, lane, t: 0.3 },
    { kind: 'stone', ri: 0, lane, t: HAZARD.stone.warn + 0.1 },   // (rolling: its body says it all)
    { kind: 'dark', ri: 0, lane: { room: true }, t: 0.1 },        // (the whole room's)
  ];
  const at = V(5, 0, 3);
  const T = telegraphs(list, [room], at, [{ at: V(1, 0, 1), t: 0.4 }, { at: V(9, 0, 9), t: 2 }]);
  assert.deepEqual(T.map((p) => p.kind), ['spill', 'toll', 'cart', 'gust', 'geyser']);
  assert.deepEqual([T[0].x, T[0].z], [4, 5]);
  assert.deepEqual([T[1].x, T[1].z], [-12, 2]);
  assert.deepEqual([T[2].x, T[2].z], lanePoint(room, lane, 0), 'the cart comes from the lane’s head');
  assert.deepEqual([T[3].x, T[3].z], [5, 3], 'the gust where its lane crosses him');
  assert.ok(T.every((p) => p.k >= 0 && p.k < 1 && p.y === 0));
  assert.equal(nearestTelegraph(T, at).kind, 'gust');
  assert.equal(nearestTelegraph([], at), null);
});

test('the traveller lost in his crowd: hidden behind a foe’s body or hemmed in by three, his ring; clear, none', () => {
  const at = V(0, 0, 0), cam = V(0, ISO.look, 0).add(isoOffset(ISO, V()));
  // a body standing over him toward the camera hides him; beside him, or behind him, it doesn't
  const big = (x, z) => ({ pos: V(x, 0, z), radius: 0.9, height: 1.8 });
  assert.ok(hiddenShare(cam, at, [big(0.9, 0.9)]) >= SELF.share, 'a tall foe between the camera and him');
  assert.equal(hiddenShare(cam, at, [big(-1.2, -1.2)]), 0, 'one behind him hides nothing');
  assert.equal(hiddenShare(cam, at, [big(2.5, -2.5)]), 0, 'one beside him hides nothing');
  // hemmed in: three bodies' edges within SELF.crowd of him
  const ring3 = [0, 2.1, 4.2].map((a) => ({ pos: V(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4), radius: 0.5, height: 1 }));
  assert.equal(crowdAround(at, ring3), 3);
  assert.ok(lostInCrowd(0, crowdAround(at, ring3)));
  assert.ok(!lostInCrowd(0, crowdAround(at, ring3.slice(0, 2))), 'two near him: he still reads');
  assert.ok(!lostInCrowd(0.25, 0), 'only his feet hidden: he still reads');
  // the ring comes quickly and goes a little slower
  assert.equal(easeSelf(0, true, SELF.in), 1);
  assert.ok(easeSelf(1, false, SELF.in) > 0);
  // the screen's part, for the engines' HUD: his feet and head, its fade; gone once he is clear
  const camera = new THREE.PerspectiveCamera(ISO.fov, 16 / 9, 0.1, 500); camera.position.copy(cam); camera.lookAt(0, ISO.look, 0); camera.updateMatrixWorld();
  const mark = new SelfMark(camera), player = { pos: at, dead: false };
  mark.update(0.2, player, ring3);
  assert.deepEqual(screen.state.self.at, [0, 0, 0]);
  assert.ok(screen.state.self.head[1] > 1.5 && screen.state.self.k === 1 && screen.state.self.size === SELF.size);
  for (let i = 0; i < 30; i++) mark.update(1 / 30, player, []);
  assert.equal(screen.state.self, null);
  mark.update(0.2, player, ring3, true);
  assert.equal(screen.state.self, null, 'nothing over a card or once the run is over');
  mark.dispose();
});

/** The relative luminance (WCAG) of a #hex colour, and the contrast of two. */
const lum = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('the floor’s sigil: the makers’ mark in a square frame, not rings, and fainter than the old ink in every temple', () => {
  for (const T of TEMPLES) {
    const P = T.palette, s = sigilColor(P), was = contrast(P.inkLite, P.floor), now = contrast(s, P.floor);
    assert.ok(now < was * 0.75, `${T.id}: fainter (${was.toFixed(2)} → ${now.toFixed(2)})`);
    assert.ok(now <= 2.2, `${T.id}: no louder than a faint mark on the floor (${now.toFixed(2)})`);
    assert.ok(now >= 1.12, `${T.id}: still there to see (${now.toFixed(2)})`);
  }
  const m = sigilModel(8, new THREE.MeshBasicMaterial());
  const geos = []; m.traverse((o) => { if (o.isMesh) geos.push(o.geometry); });
  assert.ok(geos.length >= 5, 'a frame of four and the mark');
  assert.ok(geos.every((g) => g.type !== 'RingGeometry' && g.type !== 'CircleGeometry' && g.type !== 'TorusGeometry'), 'no ring among them');
  // flat on the floor, the frame as wide as SIGIL.size of the room's shorter side
  const box = new THREE.Box3().setFromObject(m);
  assert.ok(box.max.y - box.min.y < 0.05 && Math.abs(box.max.x - box.min.x - 8 - SIGIL.line) < 0.01);
  // and the hall built: no ring of the old sizes left in a room's middle
  const scene = new THREE.Scene();
  runSteps(buildHall(scene, D));
  const r = D.rooms[0], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
  const rings = []; scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'RingGeometry' && Math.hypot(o.position.x - cx, o.position.z - cz) < 0.01) rings.push(o); });
  assert.equal(rings.length, 0, 'the two rings under the fight are gone');
});

/** A run in node, the desert's hall (as tests/fight-temples.test.js simulate), its sounds counted. */
function simulate() {
  const scene = new THREE.Scene();
  const level = runSteps(buildHall(scene, D));
  const pos = new THREE.Vector3(...D.spawn);
  const player = {
    pos, vel: new THREE.Vector3(), heading: 0, hearts: 3, maxHearts: 3, dead: false, opts: {},
    frame: { dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (v) => Math.atan2(v.x, v.z) },
    respawn: (p) => pos.copy(p), restore(h) { this.hearts = Math.min(this.maxHearts, this.hearts + h); }, restart() {},
  };
  const foes = new Foes({ scene, level, levelId: 'arena', physics: null, player, settings: { enemies: 'normal' }, rng: seeded() });
  const flags = {}, state = { data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; return v; }, emit() {}, on: () => () => {} };
  const out = { flashes: [], ticks: [] };
  const sound = { lockOn: (on) => out.ticks.push(on) };
  const camera = new THREE.PerspectiveCamera(ISO.fov, 16 / 9, 0.1, 800);
  const ctx = {
    player, camera, level, sfx: new Proxy({}, { get: () => () => {} }), sound, tool: null, foes, rig: { target: new THREE.Vector3(), yaw: 0 }, physics: null, state,
    setFov() {}, add: (o) => { scene.add(o); return o; }, flash: (t) => out.flashes.push(t), status() {}, finish() {}, drop() {},
  };
  const S = startFightTemple(ctx);
  const tick = (live = true) => S.update(1 / 30, {}, { live, raw: {} });
  return { S, out, player, foes, camera, tick };
}

test('in a run: a pool started at the frame’s edge is drawn into it; one past it gets a marker at the edge', () => {
  const { S, player, foes, camera, tick } = simulate();
  const r = D.rooms[0];
  player.pos.set((r.x[0] + r.x[1]) / 2 - 2, 0, (r.z[0] + r.z[1]) / 2 - 2);
  for (let i = 0; i < 30; i++) tick();
  assert.equal(S.run.phase, 'fight');
  r.hazard = { kind: 'spill', every: 999, n: 1 };   // (the desert's first room lent a pool of oil)
  const spot = [player.pos.x + 4.6, player.pos.z + 4.6];
  const before = V(spot[0], 0, spot[1]).project(camera);
  assert.ok(before.y < -FRAME.margin, `at the bottom edge first (${before.y.toFixed(2)})`);
  S.hazards.start(0, { spot });
  for (let i = 0; i < 30; i++) tick();   // (a second of its 1.4 s warning)
  const after = V(spot[0], 0, spot[1]).project(camera), him = player.pos.clone().project(camera);
  assert.ok(Math.abs(after.y) <= FRAME.margin + 0.1 && Math.abs(after.x) <= FRAME.margin + 0.1, `drawn into the frame (${after.y.toFixed(2)})`);
  assert.ok(Math.abs(him.y) <= FRAME.keep + 0.1, `he stays near the middle (${him.y.toFixed(2)})`);
  assert.ok(S.framed.tells >= 1);
  // the edge's markers: a telegraph out of the frame is handed to the foes' warnings
  const far = foes.extraWarn();
  assert.ok(far.length >= 1 && far.every((w) => w.pos.isVector3 && w.k >= 0 && w.k <= 1 && typeof w.tone === 'string'));
  for (let i = 0; i < 60; i++) tick();   // (struck and burnt out: the view comes back)
  delete r.hazard;
  S.end();
  assert.equal(foes.extraWarn, undefined, 'gone with the run');
});

test('Reduce motion: no pull toward a hazard, he stays in the middle and the edge marks it (issue #563)', async () => {
  const { setMotion } = await import('../src/feel.js');
  setMotion({ reduce: true });
  try {
    const { S, player, foes, camera, tick } = simulate();
    const r = D.rooms[0];
    player.pos.set((r.x[0] + r.x[1]) / 2 - 2, 0, (r.z[0] + r.z[1]) / 2 - 2);
    for (let i = 0; i < 30; i++) tick();
    r.hazard = { kind: 'spill', every: 999, n: 1 };
    const spot = [player.pos.x + 4.6, player.pos.z + 4.6];
    const was = player.pos.clone().project(camera);
    S.hazards.start(0, { spot });
    for (let i = 0; i < 30; i++) tick();
    const him = player.pos.clone().project(camera);
    assert.ok(Math.abs(him.x - was.x) < 0.02 && Math.abs(him.y - was.y) < 0.02, `the camera still (${him.x.toFixed(2)}, ${him.y.toFixed(2)})`);
    assert.ok(foes.extraWarn().length >= 1, 'the edge\'s marker shows it instead');
    delete r.hazard;
    S.end();
  } finally { setMotion({ reduce: false }); }
});

test('the lock’s press: the aim’s ring flashes with the lock’s tick (falling with none in the cone), the way to aim said once; never a lock', () => {
  const { S, out, player, foes, tick } = simulate();
  const r = D.rooms[0];
  player.pos.set((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2);
  tick();
  // none in the cone yet: answered all the same
  assert.ok(foes.cycleLock() === true, 'answered (no scout’s ping)');
  assert.deepEqual(out.ticks, [false]);
  assert.ok(!foes.lock);
  assert.deepEqual(out.flashes.filter((f) => f === LOCK_ANSWER.line).length, 1);
  // a foe ahead of him in the cone: the lock's tick rises, the flash grows the ring and settles it back
  const f = foes.add('blot', V(player.pos.x + Math.sin(player.heading) * 2, 0, player.pos.z + Math.cos(player.heading) * 2));
  f.state = 'stun'; f.stunned = 9;
  tick(); tick();   // (the run counts it as the wave's, then the aim takes it)
  assert.ok(foes.cycleLock() === f, 'the foe the aim takes');
  assert.deepEqual(out.ticks, [false, true]);
  assert.equal(out.flashes.filter((x) => x === LOCK_ANSWER.line).length, 1, 'said once a run');
  tick();
  assert.ok(!foes.lock, 'the view never turns off the iso line');
  assert.ok(answerScale(0) === LOCK_ANSWER.grow && answerScale(LOCK_ANSWER.secs) === 1 && answerScale(LOCK_ANSWER.secs / 2) > 1);
  S.end();
  assert.equal(foes.lockAnswer, undefined);
  assert.ok(foes.cycleLock() === null, 'outside the temples the lock is its own again (none left to take)');
});
