// The City Floating in Space's climax, filmed (src/story/spacecity-moments.js): out of the Mooring-House after its keeper is resolved, the cables draw taut and lamps run along them; the world
// is done, its keepsake given.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createSpaceCity } = await import('../src/levels/space-city.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { CABLES, MOMENTS } = await import('../src/story/spacecity-moments.js');
const { FILM_NEAR } = await import('../src/story/spacecity.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');
const { KEEPSAKE } = await import('../src/story/spacecity-people.js');

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
const level = quiet(() => createSpaceCity(scene));
const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
const rt0 = level.temples?.find((t) => t.id === 'spacecity') ?? null;

/** The City Floating in Space's story on a fresh save, with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; }, ctx: { currentTime: 0 } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  let done = false;
  const rt = quiet(() => createStory({ levelId: 'spacecity', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() { done = true; } },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship }));
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  return { rt, player, sound, toasts, step, ship, isDone: () => done };
}

test('the registry and show, don’t tell: the floating city’s moment is the one in film.js', async () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.spacecity.map(({ id, flag }) => ({ id, flag })));
  const len = CABLES.A + CABLES.B + CABLES.C;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/spacecity-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line:/.test(src), 'no lines in it');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1 && looks.every((l) => !/'(surprised|happy|shout|scared|playful)'/.test(l)), 'no big face');
});

test('out of the Mooring-House once its keeper is resolved: the world is done, its keepsake given, the moment filmed once', () => {
  const ship = fakeShip();
  const w = world({ ship });
  assert.ok(rt0?.outside?.door, 'the Mooring-House stands in the world, its door outside');
  w.step(2);
  assert.equal(ship.shots.length, 0, 'nothing before the guardian');
  game.set('temple.spacecity.done', true);
  w.step(1);
  assert.equal(game.flag('world.spacecity.done'), true, 'the world done on the route');
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
  assert.equal(game.flag('spacecity.moment.cables'), true, 'once per save');
  for (let i = 0; i < 30 * 10; i++) w.step(1);
  assert.ok(w.sound.swells.includes('father'), 'the father’s theme under it');
  assert.ok(w.toasts.some((t) => /cables draw taut/.test(t)), 'said at its end');
  const n = ship.shots.length;
  w.step(30);
  assert.equal(ship.shots.length, n, 'not again');
});

test('without the ship’s camera nothing is lost: done, kept, and no film', () => {
  const w = world({ ship: null });
  game.set('temple.spacecity.done', true);
  const D = rt0.outside.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading));
  w.player.pos.copy(D.at).addScaledVector(out, 4);
  w.step(4);
  assert.equal(game.flag('world.spacecity.done'), true);
  assert.equal(game.flag('spacecity.moment.cables'), undefined, 'it waits for a stage to play on');
});

test('four panels in 8–10 s, the face last (QC v1.66, issue #295): over the capstan every cable runs out taut, its lamps lighting out along them', async () => {
  const { CABLES: C, capstanShot } = await import('../src/story/spacecity-moments.js');
  const { CABLES: ENDS, LAMP_RUN } = await import('../src/temples/spacecity.js');
  const len = C.A + C.B + C.C + C.D;
  assert.ok(len >= 8 && len <= 10, `the moments' 8–10 s (${len}; 7.4 s in three panels before)`);
  const ship = fakeShip();
  const w = world({ ship });
  const ch = rt0.change;
  ch.set(false);   // (the world as before its keeper: the tests before left it on)
  game.set('temple.spacecity.done', true);
  w.step(30 * 4);
  assert.equal(ch.lit, 0, 'the lamps wait for the film');
  const D = rt0.outside.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading));
  w.player.pos.copy(D.at).addScaledVector(out, 6);
  const rec = [];
  for (let i = 0; i < 30 * 11; i++) {
    const n = ship.shots.length;
    w.step(1);
    if (ship.shots.length > n) rec.push({ t: (rec.length + 1) / 30, shot: ship.shots.at(-1), lit: ch.lit });
  }
  const ndc = (s, p) => { const cam = new THREE.PerspectiveCamera(s.fov, 16 / 9, 0.1, 2000); cam.position.copy(s.pos); cam.lookAt(s.look); cam.updateMatrixWorld(); return p.clone().project(cam); };
  const at = (t) => rec.reduce((b, r) => (Math.abs(r.t - t) < Math.abs(b.t - t) ? r : b));
  const B0 = C.A, C0 = B0 + C.B;
  const top = rt0.outside.top;
  for (const t of [B0 + 0.2, C0 - 0.2]) {
    const s = at(t).shot, q = ndc(s, rt0.outside.capstan.position);
    assert.ok(q.z < 1 && Math.abs(q.x) < 0.6 && Math.abs(q.y) < 0.6, `B at ${t.toFixed(1)} s: the capstan in frame`);
    // every cable leaves the capstan across the frame: a point 12 m along each is in it
    const seen = ENDS.filter((e) => { const p = top.clone().lerp(V(...e), 12 / top.distanceTo(V(...e))); const r = ndc(s, p); return r.z < 1 && Math.abs(r.x) < 1 && Math.abs(r.y) < 0.78; });
    assert.ok(seen.length >= 2, `B: ${seen.length} of the ${ENDS.length} cables run out across the frame`);
    assert.ok(s.pos.y > top.y + 4, 'from over the roof');
  }
  assert.ok(at(B0 + 0.2).lit < 0.2 && at(C0 + C.C - 0.2).lit > 0.6, `the lamps light out along them through B and C (${at(B0 + 0.2).lit.toFixed(2)} → ${at(C0 + C.C - 0.2).lit.toFixed(2)})`);
  assert.ok(rec.at(-1).lit > 0.99 || LAMP_RUN.end > len, 'all lit by the end');
  const shot = capstanShot(top, ENDS, rt0.outside.kit.yaw);
  assert.ok(shot.from.pos.distanceTo(top) > 10, 'B far enough back to see them leave');
  // nothing solid or drawn between any lens and what it films, with the house as it stands now (its tripod, the
  // spindle's flare) and the landing's port (the QC of v1.85, #491: B was a teal wall, A filmed the façade from 1 m)
  const { sightClear } = await import('../src/story/film.js');
  const sight = { physics, roots: [rt0.root, scene] };
  /** What stands in the way (for the message). */
  const what = (pos, p, near) => {
    const d = pos.distanceTo(p) - near, dir = p.clone().sub(pos).normalize(), ray = new THREE.Raycaster(pos, dir, 0, d);
    const h = ray.intersectObject(scene, true).find((x) => x.object.isMesh && !x.object.material?.transparent && x.object.material?.visible !== false);
    const ph = physics.rayDistance(pos, dir, d);
    return `${h ? `${h.object.name || h.object.parent?.name} at ${h.distance.toFixed(1)} m` : 'no drawn surface'}; ${ph < d ? `a collider at ${ph.toFixed(1)} m` : 'no collider'}`;
  };
  const D0 = C0 + C.C, door = rt0.outside.door.at.clone().add(V(0, 12, 0));
  for (const r of rec.filter((x) => x.t < D0 - 0.1 && [B0, C0].every((b) => Math.abs(x.t - b) > 0.1))) {
    const s = r.shot, i = r.t < B0 ? 0 : r.t < C0 ? 1 : 2;
    assert.ok(!physics.embedded(s.pos), `${'ABC'[i]} at ${r.t.toFixed(1)} s: the lens in the open`);
    const subject = [s.look, top, s.look][i];
    const near = [C.NEAR, 2, 4][i], skip = [];
    assert.ok(sightClear(s.pos, subject, { ...sight, near, skip }), `${'ABC'[i]} at ${r.t.toFixed(1)} s: nothing between the lens and what it films (${what(s.pos, subject, near)})`);
  }
  for (const t of [0.1, B0 - 0.1]) assert.ok(at(t).shot.pos.distanceTo(door) > 20, `A at ${t} s: wide, from out over the void (${at(t).shot.pos.distanceTo(door).toFixed(1)} m; it was 1.3 m)`);
  const last = rec.at(-1).shot, face = w.player.pos.clone().add(V(0, 1.62, 0));
  assert.ok(last.look.distanceTo(face) < 0.4 && last.pos.distanceTo(face) < 2, 'the last panel on his face');
});
