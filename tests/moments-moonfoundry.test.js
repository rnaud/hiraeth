// The Moon Foundry's climax, filmed (src/story/moonfoundry-moments.js): out of the Casting-House after its keeper is stopped, the hung moons turn on their hooks toward it; the world
// is done, its keepsake given.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createMoonFoundry } = await import('../src/levels/moon-foundry.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { MOON, MOMENTS } = await import('../src/story/moonfoundry-moments.js');
const { FILM_NEAR } = await import('../src/story/moonfoundry.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');
const { KEEPSAKE } = await import('../src/story/moonfoundry-people.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const quiet = (f) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return f(); } finally { console.warn = w; console.info = i; } };
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

const scene = new THREE.Scene();
const level = quiet(() => createMoonFoundry(scene));
const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
const rt0 = level.temples?.find((t) => t.id === 'moonfoundry') ?? null;

/** The Moon Foundry's story on a fresh save, with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; }, ctx: { currentTime: 0 } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  let done = false;
  const rt = quiet(() => createStory({ levelId: 'moonfoundry', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() { done = true; } },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship }));
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  return { rt, player, sound, toasts, step, ship, isDone: () => done };
}

test('the registry and show, don’t tell: the Moon Foundry’s moment is the one in film.js', async () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.moonfoundry.map(({ id, flag }) => ({ id, flag })));
  const len = MOON.A + MOON.B + MOON.C;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/moonfoundry-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line:/.test(src), 'no lines in it');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1 && looks.every((l) => !/'(surprised|happy|shout|scared|playful)'/.test(l)), 'no big face');
});

test('out of the Casting-House once its keeper is stopped: the world is done, its keepsake given, the moment filmed once', () => {
  const ship = fakeShip();
  const w = world({ ship });
  assert.ok(rt0?.outside?.door, 'the Casting-House stands in the world, its door outside');
  w.step(2);
  assert.equal(ship.shots.length, 0, 'nothing before the guardian');
  game.set('temple.moonfoundry.done', true);
  w.step(1);
  assert.equal(game.flag('world.moonfoundry.done'), true, 'the world done on the route');
  assert.ok(game.keepsakes().some((k) => k.id === KEEPSAKE.id), 'its keepsake kept');
  // far from the door: not yet
  w.player.pos.copy(level.spawn);
  w.step(2);
  assert.equal(ship.shots.length, 0, 'not from the ship');
  // out by the door
  const D = rt0.outside.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading));
  w.player.pos.copy(D.at).addScaledVector(out, 6);
  assert.ok(w.player.pos.distanceTo(D.at) < FILM_NEAR);
  w.step(2);
  assert.ok(ship.shots.length > 0, 'filmed');
  assert.equal(game.flag('moonfoundry.moment.moon'), true, 'once per save');
  for (let i = 0; i < 30 * 10; i++) w.step(1);
  assert.ok(w.sound.swells.includes('father'), 'the father’s theme under it');
  assert.ok(w.toasts.some((t) => /hung moons turn/.test(t)), 'said at its end');
  const n = ship.shots.length;
  w.step(30);
  assert.equal(ship.shots.length, n, 'not again');
});

test('without the ship’s camera nothing is lost: done, kept, and no film', () => {
  const w = world({ ship: null });
  game.set('temple.moonfoundry.done', true);
  const D = rt0.outside.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading));
  w.player.pos.copy(D.at).addScaledVector(out, 4);
  w.step(4);
  assert.equal(game.flag('world.moonfoundry.done'), true);
  assert.equal(game.flag('moonfoundry.moment.moon'), undefined, 'it waits for a stage to play on');
});

test('four panels in 8–10 s, the face last (QC v1.66, issue #295): the last moon rises onto its hook, then every hung moon turns', async () => {
  const { MOON, liftShot } = await import('../src/story/moonfoundry-moments.js');
  const { CHANGE } = await import('../src/temples/moonfoundry.js');
  const len = MOON.A + MOON.B + MOON.C + MOON.D;
  assert.ok(len >= 8 && len <= 10, `the moments' 8–10 s (${len}; 7.4 s in three panels before)`);
  const ship = fakeShip();
  const w = world({ ship });
  const ch = rt0.change, moon = ch.moon, hung = ch.hung;
  ch.set(false);   // (the world as before its keeper: the tests before left it changed)
  game.set('temple.moonfoundry.done', true);
  w.step(30 * 3);   // (out of the house a while: the change is on, the whole moon waits at the door's foot for the film)
  assert.ok(moon && hung.length >= 2, 'the change has its moon, and the hung moons to turn');
  const foot0 = moon.getWorldPosition(V()).y, yaw0 = hung.map((h) => h.group.rotation.y);
  assert.ok(Math.abs(foot0 - (rt0.outside.foot.y + 1.8)) < 0.05, 'not lifted before the film');
  const D = rt0.outside.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading));
  w.player.pos.copy(D.at).addScaledVector(out, 6);
  const rec = [];
  for (let i = 0; i < 30 * 11; i++) {
    const n = ship.shots.length;
    w.step(1);
    if (ship.shots.length > n) rec.push({ t: (rec.length + 1) / 30, shot: ship.shots.at(-1), moon: moon.getWorldPosition(V()), yaw: hung.map((h) => h.group.rotation.y) });
  }
  assert.ok(rec.length > 30 * 8, `filmed for ${(rec.length / 30).toFixed(1)} s`);
  const inFrame = (s, p) => {
    const cam = new THREE.PerspectiveCamera(s.fov, 16 / 9, 0.1, 2000);
    cam.position.copy(s.pos); cam.lookAt(s.look); cam.updateMatrixWorld();
    const q = p.clone().project(cam);
    return q.z < 1 && Math.abs(q.x) < 0.85 && Math.abs(q.y) < 0.72;
  };
  const at = (t) => rec.reduce((b, r) => (Math.abs(r.t - t) < Math.abs(b.t - t) ? r : b));
  // B: under the jib, the moon in frame, rising onto the hook
  const B0 = MOON.A, C0 = B0 + MOON.B, D0 = C0 + MOON.C;
  for (const t of [B0 + 0.2, B0 + 1.2, C0 - 0.2]) assert.ok(inFrame(at(t).shot, at(t).moon), `B at ${t.toFixed(1)} s: the last moon in frame`);
  assert.ok(at(C0 - 0.1).moon.y > at(B0 + 0.1).moon.y + 2, 'it rises through B');
  assert.ok(at(C0 - 0.1).moon.distanceTo(rt0.outside.hook) < 3, 'and reaches the hook as B ends');
  const eye = liftShot(rt0.outside, null).eye(0);
  assert.ok(eye.y > level.ground.heightAt(eye.x, eye.z) + 0.5, 'B\'s lens over the floor');
  // C: the hung moon in frame, turning
  const hungAt = V(level.hung.x, level.hung.y, level.hung.z);
  for (const t of [C0 + 0.2, D0 - 0.2]) assert.ok(inFrame(at(t).shot, hungAt), `C at ${t.toFixed(1)} s: the hung moon in frame`);
  assert.ok(Math.abs(at(D0 - 0.1).yaw[0] - at(C0 + 0.1).yaw[0]) > 0.25, `it turns through C (${(at(D0 - 0.1).yaw[0] - at(C0 + 0.1).yaw[0]).toFixed(2)} rad)`);
  assert.ok(hung.every((h, i) => Math.abs(at(D0 - 0.1).yaw[i] - yaw0[i]) > 0.25), 'every hung moon');
  // nothing solid between any lens and what it films, in the house as it stands now, its ports and jib (the QC of
  // v1.85, #491: the jib over the door caught A's pull-in, the lens sat in it for 2.6 s, a navy face with orange bars)
  const { sightClear } = await import('../src/story/film.js');
  const sight = { physics, roots: [rt0.root, scene] };
  // (C films a hung moon from 50 m: its own body, a collider, is no wall)
  const moonR = Math.max(...hung.map((h) => new THREE.Box3().setFromObject(h.group).getSize(V(0, 0, 0)).y / 2));
  /** What stands in the way (for the message). */
  const what = (pos, p, near) => {
    const d = pos.distanceTo(p) - near, dir = p.clone().sub(pos).normalize(), ray = new THREE.Raycaster(pos, dir, 0, d);
    const h = ray.intersectObject(scene, true).find((x) => x.object.isMesh && !x.object.material?.transparent && x.object.material?.visible !== false);
    const ph = physics.rayDistance(pos, dir, d);
    return `${h ? `${h.object.name || h.object.parent?.name} at ${h.distance.toFixed(1)} m` : 'no drawn surface'}; ${ph < d ? `a collider at ${ph.toFixed(1)} m` : 'no collider'}`;
  };
  for (const r of rec.filter((x) => x.t < D0 - 0.1 && [B0, C0].every((b) => Math.abs(x.t - b) > 0.1))) {
    const s = r.shot, i = r.t < B0 ? 0 : r.t < C0 ? 1 : 2;
    assert.ok(!physics.embedded(s.pos), `${'ABC'[i]} at ${r.t.toFixed(1)} s: the lens in the open, not inside a solid`);
    const subject = [s.look, r.moon, hungAt][i];
    const near = [MOON.NEAR, 2, moonR + 2][i], skip = [ch.moon, ...hung.map((h) => h.group)];
    assert.ok(sightClear(s.pos, subject, { ...sight, near, skip }), `${'ABC'[i]} at ${r.t.toFixed(1)} s: nothing between the lens and what it films (${what(s.pos, subject, near)})`);
  }
  for (const t of [0.1, B0 - 0.1]) assert.ok(at(t).shot.pos.distanceTo(at(t).shot.look) > 20, `A at ${t} s: wide, from out on the floor (${at(t).shot.pos.distanceTo(at(t).shot.look).toFixed(1)} m; it was 2 m, in the jib)`);
  // D: his face, last
  const last = rec.at(-1).shot, face = w.player.pos.clone().add(V(0, 1.62, 0));
  assert.ok(last.look.distanceTo(face) < 0.4 && last.pos.distanceTo(face) < 2, 'the last panel on his face');
  // they come round to face the house again, in CHANGE.turn s
  w.step(30 * CHANGE.turn);
  for (const [i, h] of hung.entries()) assert.ok(Math.abs(Math.cos(h.group.rotation.y - yaw0[i]) - 1) < 1e-3, 'round once, back facing the house');
});
