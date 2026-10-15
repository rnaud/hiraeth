// The benches (issue #363, src/benches.js, src/benches-data.js; docs/systems/worlds.md "Benches"): every world has one
// to three, each a model of its world's kind that you stand on and bump into; walking up offers "sit" on the interact
// button in the prompts' Xbox / PlayStation form; sitting puts the traveller on the seat facing the view, eases the
// camera round behind and above him (him low and small in the frame) and fades the HUD; a move, a jump, B or E stands
// him up and it all comes back; and while he sits the world's music swells over the player's own music volume
// (Sound.seated, SEATED_SWELL), the wind stepping back, then eases back as he stands.
// (Where each bench stands in its world, on solid flat dry ground, off the route: tests/benches-worlds.test.js and
// tests/route-worlds.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installAudio } from '../engine/webaudio.js';

const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
delete G.AudioContext; installAudio(G, { sampleRate: 48000 });
// (a page's body for the HUD's class: platform.js page.bodyClass)
const classes = new Set();
G.document ??= { body: { classList: { toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)), contains: (n) => classes.has(n), add: (n) => classes.add(n), remove: (n) => classes.delete(n) } } };

const { Sound, SEATED_SWELL } = await import('../src/audio.js');
const { Player, CAPSULE } = await import('../src/player.js');
const { Physics } = await import('../src/physics.js');
const { createBenches, BENCH, benchGeometry, benchFraming } = await import('../src/benches.js');
const { BENCHES, BENCH_STYLES } = await import('../src/benches-data.js');
const { ORDER, SIDE } = await import('../src/levels/names.js');
const { bestInteractable, updateInteract, clearInteractables } = await import('../src/interact.js');
const { PAD } = await import('../src/bindings.js');
const { badgeLine } = await import('../src/prompt-keys.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };
/** A flat floor (its top at y 0) and its collision. */
function floor() {
  const scene = new THREE.Scene();
  const m = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400)); m.position.set(0, -0.5, 0); scene.add(m);
  return { scene, physics: new Physics(scene) };
}
const FACE = 0.6;
/** A bench of `kind` on the floor at the origin facing FACE, a traveller in front of it, a camera where a rig would have it. */
function setup(kind = 'plank') {
  clearInteractables(); classes.clear();
  const { scene, physics } = floor();
  const player = quiet(() => new Player(physics, { health: false }));
  scene.add(player.object);
  const front = V(Math.sin(FACE), 0, Math.cos(FACE));
  player.teleport?.(V(front.x * 1.4, 0.05, front.z * 1.4), V(0, 1, 0), V(0, 0, 1));
  player.pos.set(front.x * 1.4, 0, front.z * 1.4); player.heading = FACE + Math.PI;
  for (let i = 0; i < 20; i++) quiet(() => player.update(1 / 60, {}, 0));   // (on his feet)
  const rig = { yaw: 0 };
  const B = createBenches({ levelId: 'test', scene, physics, player, rig, defs: [{ at: [0, 0, 0], face: FACE, kind, name: 'a test view' }] });
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000);
  return { scene, physics, player, rig, B, camera, front, b: B.list[0] };
}
/** One frame as main.js runs it: the bench's update, the traveller (no input while he sits), the rig's camera, the bench's framing. */
function frame(S, dt, input = {}, e = false, rigAt = V(8, 3, 8)) {
  S.B.update(dt, input, e);
  quiet(() => S.player.update(dt, S.B.inputFor(input), 0));
  S.camera.position.copy(rigAt); S.camera.lookAt(S.player.pos); S.camera.updateMatrixWorld();
  S.B.frameCamera(S.camera);
}
const run = (S, secs, input, e) => { for (let t = 0; t < secs; t += 1 / 60) frame(S, 1 / 60, input, e); };

test('every world on the route and off it has one to three benches, each with a view, a way it faces and its world’s style', () => {
  for (const id of [...ORDER, ...SIDE]) {
    const list = BENCHES[id];
    assert.ok(list?.length >= 1 && list.length <= 3, `${id}: ${list?.length ?? 0} benches`);
    for (const b of list) {
      assert.equal(b.at.length, 3, `${id}: [x, y, z]`);
      assert.ok(b.at.every(Number.isFinite) && Number.isFinite(b.face), `${id}: where and which way`);
      assert.ok(b.name?.length > 6, `${id}: what the view is of`);
    }
    const st = { ...BENCH_STYLES.default, ...BENCH_STYLES[id] };
    assert.ok(BENCH_STYLES[id], `${id}: a style of its own`);
    assert.ok(['slab', 'plank', 'machined'].includes(st.kind), `${id}: ${st.kind}`);
  }
});

test('each kind of bench: its seat at the seat’s height, stood on; a back you bump into from behind', () => {
  for (const kind of ['slab', 'plank', 'machined']) {
    const { parts, back } = benchGeometry(kind);
    const box = new THREE.Box3();
    for (const g of Object.values(parts).flat()) { g.computeBoundingBox(); box.union(g.boundingBox); }
    assert.ok(box.min.y >= -0.01 && Math.abs(box.max.y - Math.max(BENCH.seat, back)) < 0.05, `${kind}: from the ground to ${box.max.y.toFixed(2)} m`);
    assert.ok(box.max.x - box.min.x <= BENCH.length + 0.05 && box.max.z - box.min.z <= BENCH.depth + 0.12, `${kind}: ${(box.max.x - box.min.x).toFixed(2)} × ${(box.max.z - box.min.z).toFixed(2)} m`);
    const S = setup(kind);
    // stood on: the seat's top under its middle, from above
    assert.ok(Math.abs(S.physics.groundAt(0, 3, 0, 5) - BENCH.seat) < 0.03, `${kind}: the seat at ${S.physics.groundAt(0, 3, 0, 5)}`);
    assert.ok(BENCH.seat < CAPSULE.step, 'low enough to step onto, as a kerb');
    if (back) {
      // from behind: the backrest stops a body walking into it at its height (the capsule's foot lifted to it)
      const p = V(-S.front.x * 0.45, back - CAPSULE.step - 0.25, -S.front.z * 0.45), push = S.physics.pushCapsule(p, CAPSULE.radius, CAPSULE.step, CAPSULE.height, V());
      assert.ok(push && push.length() > 0.05, `${kind}: its back is solid`);
    }
    S.B.dispose();
  }
});

test('walking up offers “sit” on the interact button, in the prompts’ Xbox / PlayStation form', () => {
  const S = setup();
  const best = bestInteractable(S.player);
  assert.ok(best, 'in front of the bench something is offered');
  assert.equal(best.entry.prompt, 'sit');
  assert.match(best.entry.id, /^bench\./);
  // the floating prompt is the interact button and the verb (src/story/index.js placePrompt): "X / □ sit" on a pad,
  // a button name native-pad.js renames to the handheld's own; "E sit" on the keys
  const pad = `${PAD.interact} ${best.entry.prompt}`;
  assert.equal(pad, 'X / □ sit');
  assert.match(pad, /^[ABXY] \/ [×○□△] /, 'the Xbox / PlayStation form');
  assert.match(badgeLine(pad), /<b class="key">X \/ □<\/b> sit/, 'the button drawn as its badge');
  // too far or behind something else: not offered
  S.player.pos.set(S.front.x * 6, 0, S.front.z * 6);
  assert.equal(bestInteractable(S.player)?.entry.id.startsWith('bench.') ? 'offered' : null, null, '6 m away: no prompt');
  S.B.dispose();
});

test('sitting: on the seat facing the view, the camera behind and above him looking out, him low in the frame, the HUD faded', () => {
  const S = setup();
  const r = updateInteract(S.player, true);
  assert.ok(r.handled && S.B.sitting === S.b, 'E sits him down');
  assert.ok(S.B.holds(), 'the traveller takes no input while he sits');
  run(S, 0.2, {}, false);
  assert.ok(!classes.has('seated'), 'the HUD stays a moment');
  run(S, 2.4, {}, false);
  const P = S.player, b = S.b;
  assert.ok(Math.hypot(P.pos.x - b.pos.x, P.pos.z - b.pos.z) < 0.05, 'on the seat');
  assert.ok(Math.abs(P.pos.y - b.pos.y) < 0.06, `on its top (${P.pos.y.toFixed(2)})`);
  assert.ok(Math.abs(Math.atan2(Math.sin(P.heading - FACE), Math.cos(P.heading - FACE))) < 0.01, 'facing the way the bench looks');
  assert.ok(typeof P.overlay === 'function' && P.char.body.position.y < -0.8, 'sat down: the hips down to the seat');
  assert.ok(classes.has('seated'), 'the HUD faded (body.seated)');
  assert.equal(S.B.k, 1, 'the camera all the way round');
  // the camera: behind the bench and above it, looking out the way it faces, where the framing put it (a slow sway)
  const shot = benchFraming(b, S.physics), c = S.camera.position, to = c.clone().sub(b.pos);
  assert.ok(c.distanceTo(shot.eye) < BENCH.cam.sway + 0.01, 'at the seated shot');
  assert.ok(to.dot(S.front) < -BENCH.cam.back + 0.5 && to.y > BENCH.cam.up - 0.3, `behind (${(-to.dot(S.front)).toFixed(1)} m) and above (${to.y.toFixed(1)} m)`);
  const look = S.camera.getWorldDirection(V());
  assert.ok(look.dot(S.front) > 0.95, 'looking out the way the bench faces');
  // him small at the foot of the frame: his head under the middle, his seat well above the bottom edge, near the middle across
  const head = b.pos.clone().add(V(0, 0.85, 0)).project(S.camera), seat = b.pos.clone().project(S.camera);
  assert.ok(head.y < -0.1 && head.y > -0.75 && seat.y > -0.95 && Math.abs(head.x) < 0.1, `in the lower part: head at ${head.y.toFixed(2)}, seat at ${seat.y.toFixed(2)}`);
  assert.ok(head.y - seat.y < 0.4, 'small in the frame');
  S.B.dispose();
});

test('a push of the stick stands him up (not the one that walked him there), and the camera and the HUD come back', () => {
  const S = setup();
  updateInteract(S.player, true);
  run(S, 0.5, { stick: { x: 0, y: 1 } }, false);
  assert.ok(S.B.sitting && !S.B.standing, 'held stick in the first moment: still sitting');
  run(S, 2, {}, false);
  frame(S, 1 / 60, { stick: { x: 0, y: 0.8 } }, false);
  assert.ok(S.B.standing, 'the stick stands him up');
  assert.equal(S.rig.yaw, FACE + Math.PI, 'the follow camera turned behind him under the seated shot, so the way back is short');
  assert.ok(!classes.has('seated'), 'the HUD back at once');
  assert.ok(S.B.holds(), 'the push that stood him up does nothing else');
  run(S, 0.4, {}, false);
  assert.ok(!S.B.holds(), 'then his feet are his again');
  run(S, 1.2, {}, false);
  assert.equal(S.B.sitting, null);
  assert.equal(S.B.k, 0, 'the camera all the way back');
  const off = S.player.pos.clone().sub(S.b.pos);
  assert.ok(off.dot(S.front) > 0.4 && S.player.pos.y < 0.1, `stepped off onto the ground before it (${off.dot(S.front).toFixed(2)} m out, ${S.player.pos.y.toFixed(2)} m up)`);
  assert.equal(S.player.overlay, null, 'the pose gone');
  // the camera is the rig's again: the bench leaves it where the rig put it
  const rigAt = V(8, 3, 8);
  frame(S, 1 / 60, {}, false, rigAt);
  assert.ok(S.camera.position.distanceTo(rigAt) < 1e-6, 'the follow camera untouched');
  // and he can sit again
  S.player.pos.set(S.front.x * 1.4, 0.5, S.front.z * 1.4);
  run(S, 0.5, {}, false);
  assert.ok(bestInteractable(S.player)?.entry.prompt === 'sit', 'offered again');
  S.B.dispose();
});

test('the camera eases both ways: no jump from one frame to the next, in or out', () => {
  const S = setup();
  updateInteract(S.player, true);
  // (the follow camera behind him as he walked up to it, facing the seat: the far side of it from the seated shot)
  const rigAt = S.front.clone().multiplyScalar(7.4).add(V(0, 2.5, 0)), head = S.b.pos.clone().add(V(0, 0.85, 0));
  let last = null, step = 0, turn = 0, near = Infinity;
  const q = new THREE.Quaternion();
  const watch = (secs, input = {}) => { for (let t = 0; t < secs; t += 1 / 60) {
    frame(S, 1 / 60, input, false, rigAt);
    near = Math.min(near, S.camera.position.distanceTo(head));
    if (last) { step = Math.max(step, S.camera.position.distanceTo(last.p)); turn = Math.max(turn, S.camera.quaternion.angleTo(last.q)); }
    last = { p: S.camera.position.clone(), q: q.copy(S.camera.quaternion).clone() };
  } };
  watch(2.2);
  watch(1 / 60, { KeyW: true });
  watch(1.6);
  assert.equal(S.B.sitting, null, 'up and back');
  assert.ok(step < 0.4, `the camera moved at most ${step.toFixed(2)} m in a frame (round half a turn)`);
  assert.ok(turn < 0.09, `and turned at most ${(turn * 180 / Math.PI).toFixed(1)}° in a frame`);
  assert.ok(near > 4, `round him, never through him (${near.toFixed(1)} m from his head at the nearest)`);
  S.B.dispose();
});

test('B / ○, a jump, the keys or E again stand him up; E swallowed so it does not whistle the mount', () => {
  for (const [what, input, e] of [['B', { PadEvade: true }, false], ['jump', { Space: true }, false], ['W', { KeyW: true }, false], ['E', { KeyE: true }, true]]) {
    const S = setup();
    updateInteract(S.player, true);
    run(S, 1.2, {}, false);
    assert.ok(!S.B.standing, `${what}: sat`);
    frame(S, 1 / 60, input, e);
    assert.ok(S.B.standing, `${what} stands him up`);
    if (e) assert.equal(S.player._eHeld, true, 'the E press used up');
    S.B.dispose();
  }
  const S = setup();
  assert.equal(S.B.wantsUp({ stick: { x: 0.2, y: 0.1 } }), false, 'a stick resting off-centre is not a push');
  assert.equal(S.B.wantsUp({}), false);
  S.B.dispose();
});

test('knocked down, put somewhere else or riding off, he is off the bench at once', () => {
  for (const [what, upset] of [['knocked down', (P) => { P.down = { t: 0 }; }], ['moved away', (P) => { P.pos.x += 6; }], ['riding', (P) => { P.ride = { kind: 'bike' }; }]]) {
    const S = setup();
    updateInteract(S.player, true);
    run(S, 1.5, {}, false);
    upset(S.player);
    S.B.update(1 / 60, {}, false);
    assert.ok(S.B.standing && !S.B.holds(), `${what}: up, and his own again`);
    assert.ok(!classes.has('seated'), `${what}: the HUD back`);
    S.player.down = null; S.player.ride = null;
    S.B.dispose();
  }
});

// ---- the music
const sounds = [];
function fresh(music = 0.8) {
  const s = new Sound('desert', { score: false });
  s.start(); clearInterval(s.scheduler); clearTimeout(s._preload);
  s.setVolumes(music, 1);
  sounds.push(s);
  return s;
}
test.after(() => { for (const s of sounds) { clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); } });
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };
/** `secs` of the game: the frame's listen and update, the audio rendered a tenth of a second at a time. */
function play(s, secs) {
  for (let t = 0; t < secs; t += 0.1) { s.listen({ x: 0, y: 0, z: 0 }, 0); s.update(CALM); s.ctx.render(4800); }
  return s.music.gain.value;
}

test('sitting, the world’s music swells over a few seconds (+6 dB over the player’s own volume), the wind steps back; standing, it eases back', () => {
  const s = fresh(0.8);
  const before = play(s, 2), wind0 = s.layers.wind.g.gain.value;
  assert.ok(Math.abs(before - 0.62 * 0.8) < 0.01, `the music at its level (${before.toFixed(3)})`);
  s.seated(true);
  const soon = play(s, 0.6);
  assert.ok(soon > before * 1.05 && soon < before * 1.7, `it eases in, not at once (${(soon / before).toFixed(2)}×)`);
  const sat = play(s, 6);
  assert.ok(sat > before * 1.85, `swollen: ${(20 * Math.log10(sat / before)).toFixed(1)} dB`);
  assert.ok(sat <= 0.62 * 0.8 * SEATED_SWELL.lift + 1e-3, 'no more than the lift over the player’s own volume');
  assert.ok(s.layers.wind.g.gain.value < wind0 * 0.8, 'the wind steps back');
  assert.ok(s.moments.playing(s.ctx.currentTime), 'the theme is cued in, as a moment');
  s.seated(false);
  const after = play(s, 7);
  assert.ok(Math.abs(after - before) < before * 0.03, `back to its level (${after.toFixed(3)} against ${before.toFixed(3)})`);
  assert.ok(Math.abs(s.layers.wind.g.gain.value - wind0) < wind0 * 0.05, 'the wind back');
});

test('the swell follows the player’s music volume: none at 0, and a menu still takes the music out', () => {
  const s = fresh(0);
  s.seated(true);
  assert.ok(play(s, 5) < 0.002, 'music at 0: silent, sitting or not');
  const h = fresh(0.4);
  const base = play(h, 5);
  h.seated(true);
  const up = play(h, 6);
  assert.ok(up > base * 1.85 && up <= 0.62 * 0.4 * SEATED_SWELL.lift + 1e-3, `half the volume: half the swell (${base.toFixed(3)} → ${up.toFixed(3)})`);
  h.menuMusic(true);
  assert.ok(play(h, 5) < 0.01, 'a menu up: the world’s music out');
});
