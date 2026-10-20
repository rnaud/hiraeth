// Every temple ends on a cinematic (issue #366: "Temples should end on a cinematic. Cinematic should have the level's
// music playing"; src/temples/finale.js). One shape for all fourteen houses: the keeper at rest, its purse, the house
// from high up with its glyphs lighting, the way out sinking open; its details from each house (its guardian, its arena,
// the door that waits for it). Built here in node with their real rooms: every panel frames what it shows from inside
// the house, the film is 8–15 s, it plays once, the world's theme is cued under it, the way out waits for its panel and
// a skip (or no ship's camera) lands the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { FINALE, FINALES, finaleLength, finaleShots, finaleFlag, playFinale, wayOut, keeperBox, fitFov, washes, FILM_HUSH } from '../src/temples/finale.js';
import { Moment, MomentStage, behindHim } from '../src/story/moment.js';
import { sightClear } from '../src/story/film.js';
import { purseSpot } from '../src/chimes.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { game } from '../src/game-state.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };

const built = new Map();
/** A house in its world, built once: { rt, physics }; the traveller stood in its arena between the keeper and the way out. */
function house(id) {
  if (built.has(id)) return built.get(id);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, id) ?? level.temple;
  scene.updateMatrixWorld(true);
  const out = { rt, physics, scene };
  built.set(id, out);
  return out;
}
function standBy(rt) {
  const G = rt.guardian, way = wayOut(rt);
  const c = G.arena.center, door = way.piece.group.position;
  const dir = V(door.x - G.model.pos.x, 0, door.z - G.model.pos.z).normalize();
  const pos = G.model.pos.clone().addScaledVector(dir, Math.min(6, G.arena.r * 0.5)).setY(G.arena.y);
  rt.player = { pos, vel: V(), heading: Math.atan2(-dir.x, -dir.z), riding: false };
  return rt.player;
}
/** What drawn surface of the house stands between the lens and p (not the keeper, not the way out's own door, nothing see-through), or null. */
function blocker(rt, from, p, skip, near = 0.4) {
  const d = from.distanceTo(p);
  const ray = new THREE.Raycaster(from, p.clone().sub(from).normalize(), 0.05, d - near);
  const shown = (o) => { for (let q = o; q; q = q.parent) { if (!q.visible) return false; if (skip.includes(q)) return false; } return true; };
  for (const h of ray.intersectObject(rt.root, true)) {
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    if (!h.object.isMesh || mat?.transparent || mat?.visible === false || !shown(h.object)) continue;
    return { name: h.object.name || h.object.parent?.name || '?', at: h.distance.toFixed(1) };
  }
  return null;
}
/** Is p in the frame of camera c (inside the letterbox, in front)? */
function inFrame(c, p) {
  const cam = new THREE.PerspectiveCamera(c.fov, 16 / 9, 0.1, 2000);
  cam.position.copy(c.pos); cam.lookAt(c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const v = p.clone().project(cam);
  return v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.78;
}

test('the shape: four panels, 8–15 s, every house listed, a beat each', () => {
  const len = finaleLength();
  assert.ok(len >= 8 && len <= 15, `8–15 s (${len})`);
  assert.deepEqual(Object.keys(FINALES).sort(), Object.keys(TEMPLES).sort(), 'every house has its entry');
  for (const [id, f] of Object.entries(FINALES)) assert.ok(f.beat?.length > 10, `${id}: what it shows`);
  assert.equal(finaleFlag('desert'), 'temple.desert.finale');
});

for (const id of Object.keys(TEMPLES)) {
  test(`${id}: every panel frames what it shows, from inside the house`, () => {
    const { rt, physics } = house(id);
    assert.ok(rt?.guardian, 'a guardian');
    const way = wayOut(rt);
    assert.ok(way?.piece, 'its way out: a door that opens on the guardian');
    assert.deepEqual(rt.logic.el(way.id).opens, { resolved: true });
    standBy(rt);
    const film = finaleShots(rt);
    assert.equal(film.shots.length, 4);
    const names = ['keeper', 'reward', 'house', 'way'];
    // the camera as the moment makes it (pulled in to whatever stands between it and what it looks at)
    const m = new Moment({ shots: film.shots, stage: { physics } });
    let t0 = 0;
    for (const [i, s] of film.shots.entries()) {
      for (const k of [0.05, 0.5, 0.95]) {
        m.t = t0 + s.dur * k;
        const c = m.camera();
        assert.equal(c.i, i);
        const target = typeof film.at[names[i]] === 'function' ? film.at[names[i]](k) : film.at[names[i]].clone();   // (C's subject may move: the stones coming down, issue #562)
        if (names[i] === 'way') target.y += (way.piece.h ?? 6) * 0.45;
        if (names[i] === 'reward') target.y += 0.3;   // (the chimes float over the floor)
        assert.ok(rt.inside(c.pos), `${names[i]} at ${k}: the lens inside the house (${c.pos.toArray().map((v) => v.toFixed(1))})`);
        assert.ok(inFrame(c, target), `${names[i]} at ${k}: in the frame`);
        assert.ok(c.pos.distanceTo(c.look) > (names[i] === 'reward' ? 1.2 : 2.5), `${names[i]} at ${k}: not jammed against a wall (${c.pos.distanceTo(c.look).toFixed(1)} m)`);
        const C = names[i] === 'house' && film.sign;   // (the house's own subject: its own body not in the way of itself, issue #562)
        const b = blocker(rt, c.pos, target, [rt.guardian.model.group, way.piece.group, ...(C ? film.sign.skip : [])], C ? Math.max(0.4, film.sign.near) : 0.4);
        const M = rt.guardian.model, gh = M.height ?? 3, lo = M.floats ? M.pos.y - gh / 2 : M.pos.y;
        assert.ok(!(Math.hypot(c.pos.x - M.pos.x, c.pos.z - M.pos.z) < (M.radius ?? 2.6) && c.pos.y > lo && c.pos.y < lo + gh), `${names[i]} at ${k}: the lens not inside the keeper`);
        if (names[i] === 'way') { const d = c.pos.clone().sub(target), hd = Math.hypot(d.x, d.z), p = target.clone().addScaledVector(d, 0.5); assert.ok(hd < 3 || Math.hypot(p.x - M.pos.x, p.z - M.pos.z) > (M.radius ?? 2.6) * 0.8, `${names[i]} at ${k}: not looking at the door through the keeper`); }
        assert.equal(b, null, `${names[i]} at ${k}: nothing drawn in the way (${JSON.stringify(b)})`);
      }
      t0 += s.dur;
    }
  });
}

// The cinematics QC of v1.85 (#528, #529): B filmed through the keeper's own body in most houses (the lens kept out of
// a column of its radius, its petals, leaves, wings and shell reaching past it), A filled by the Lampless's wings and
// the Listener's shell, the Gardener washed pale by its sun in C. In every finale, panels A–C have a lens out of
// solids and out of the keeper's drawn body that sees its subject: A the keeper (whole, in its lens), B the purse past
// everything (the keeper's body too, and him), C the house.
for (const id of Object.keys(TEMPLES)) {
  test(`${id}: A–C each have a lens out of solids and the keeper's body, that sees its subject`, () => {
    const { rt, physics } = house(id);
    standBy(rt);
    const film = finaleShots(rt), M = rt.guardian.model, way = wayOut(rt);
    const body = keeperBox(M);
    assert.ok(!body.isEmpty(), 'the keeper has a drawn body');
    const m = new Moment({ shots: film.shots, stage: { physics } });
    const subject = (k) => [film.at.keeper(), film.at.reward.clone().setY(film.at.reward.y + 0.3), typeof film.at.house === 'function' ? film.at.house(k) : film.at.house];
    const opts = [
      { skip: [M.group, way.piece.group], near: 1 },
      { skip: [way.piece.group], near: 0.25 },   // (the keeper's own body counts: it must not stand over the purse)
      { skip: [M.group, way.piece.group, ...(film.sign?.skip ?? [])], near: Math.max(1.5, film.sign?.near ?? 0) },   // (C: the house's own subject, past everything but itself)
    ];
    let t0 = 0;
    for (const [i, s] of film.shots.slice(0, 3).entries()) {
      const P = 'ABC'[i];
      for (const k of [0.05, 0.5, 0.95]) {
        m.t = t0 + s.dur * k;
        const c = m.camera(), at = `${P} at ${k} (${c.pos.toArray().map((v) => v.toFixed(1))})`;
        assert.ok(!physics.embedded(c.pos), `${at}: the lens out of solids`);
        assert.ok(!body.clone().expandByScalar(0.3).containsPoint(c.pos), `${at}: the lens out of the keeper's body`);
        assert.ok(sightClear(c.pos, subject(k)[i], { physics, roots: [rt.root], ...opts[i] }), `${at}: it sees its subject`);
        // (the keeper as it stands by then: calmed, it walks on to its rest as A plays, and the lens follows it there;
        // the Mooring-House's Warden walks 5 m since #477, so its first place is no measure of the panel's end)
        if (P === 'A') {
          const now = film.bodyAt(m.t, false), look = now.getCenter(V()).setY(c.look.y), need = fitFov(c.pos, look, now);
          assert.ok(need <= c.fov + 8, `${at}: the keeper whole in a ${c.fov.toFixed(0)}° lens (needs ${need.toFixed(0)}°)`);
        }
      }
      t0 += s.dur;
    }
  });
}

test('the purse lands short of the keeper’s body, and the hand-back swings out of it', () => {
  const you = V(0, 0, 0), keeper = V(0, 0, 8);
  assert.equal(purseSpot(you, keeper).z, 3.4, 'no body: 3.4 m toward it, as before');
  const body = new THREE.Box3(V(-4, 0, 3), V(4, 4, 13));
  assert.ok(Math.abs(purseSpot(you, keeper, body).z - 2.2) < 1e-6, 'short of its body by 0.8 m');
  assert.ok(Math.abs(purseSpot(you, keeper, new THREE.Box3(V(-4, 0, -1), V(4, 4, 13))).z - 0.8) < 1e-6, 'standing in its reach: at his feet');
  // (#562: its body nearer than a step: a step to his side, clear of it, not a step in under the Listener's shell)
  assert.ok(Math.abs(purseSpot(you, keeper, new THREE.Box3(V(-4, 0, 1.2), V(4, 4, 13))).z - 0.8) < 1e-6, 'a step from its body: a step ahead, as before');
  const side = purseSpot(you, keeper, new THREE.Box3(V(-0.1, 0, 0.5), V(4, 4, 13)));
  assert.ok(Math.abs(side.x + 0.8) < 1e-6 && Math.abs(side.z) < 1e-6, `its body nearer than a step: a step to his side, away from it (${side.toArray()})`);
  const back = purseSpot(you, keeper, new THREE.Box3(V(-4, 0, 0.3), V(4, 4, 13)));
  assert.ok(Math.abs(back.z + 0.8) < 1e-6, `before him wall to wall: a step behind him (${back.toArray()})`);
  // the follow camera: behind him, unless that puts the arm in the keeper's body
  const rig = { yaw: 0, pitch: 0.4, pitch0: 0.16, dist: 4.8 }, P = { pos: V(0, 0, 0), heading: Math.PI };   // (facing -z: behind him is +z)
  behindHim(rig, P);
  assert.ok(Math.abs(rig.yaw - 2 * Math.PI) < 1e-9 && rig.pitch === 0.16, 'behind him at its usual pitch');
  behindHim(rig, P, { avoid: new THREE.Box3(V(-5, 0, 2), V(5, 8, 12)) });
  const yaw = rig.yaw, end = V(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(5);
  assert.ok(end.z < 1.5, `swung clear of the body (${end.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(Math.abs(Math.atan2(Math.sin(yaw - 2 * Math.PI), Math.cos(yaw - 2 * Math.PI))) < 2.2, 'the smallest turn that clears it');
});

const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: () => {}, skip: () => {} };
  return s;
};
const fakeSound = () => ({ cues: [], musicCue(k) { this.cues.push(k); }, trackBuffer: {}, trackOn: true });

function resolveWith(id, { ship = fakeShip(), skipAt = null, each = null, prep = null } = {}) {
  game.reset();
  const { rt, physics } = house(id);
  rt.logic.store.set('boss', null);
  rt.logic.forced.clear();
  rt.applyDoors();
  const way = wayOut(rt);
  way.piece.setOpen(false, true);
  const player = standBy(rt);
  const sound = fakeSound();
  const moments = new MomentStage({ ship, game, player, physics });
  rt.onFinale = () => playFinale(rt, { moments, sound, game });
  rt.game = game;
  prep?.(rt);
  rt.guardian.state = 'weary';
  quiet(() => rt.guardian.resolve());
  const seen = { playing: moments.playing, open: [], shut: [] };
  const dt = 1 / 30;
  for (let t = 0; t < finaleLength() + 1; t += dt) {
    if (skipAt !== null && t >= skipAt && moments.playing) moments.skip();
    quiet(() => { moments.update(dt); rt.applyDoors(); rt.glowUpdate(dt); each?.(rt, dt, t); });
    seen.lit = Math.max(seen.lit ?? 0, rt.litK ?? 0);
    (rt.logic.isOpen(way.id) ? seen.open : seen.shut).push(t);
  }
  return { rt, way, sound, seen, ship, moments };
}

test('resolving the guardian plays it once, the theme cued, the way out held for its panel', () => {
  const { rt, way, sound, seen, ship } = resolveWith('desert');
  assert.ok(seen.playing, 'playing as the guardian is resolved');
  assert.deepEqual(sound.cues, ['moment'], 'the world’s recorded theme cued under it');
  assert.ok(rt.finaleLog.music.cued && rt.finaleLog.music.on, 'the theme on');
  assert.equal(game.flag(finaleFlag('desert')), true, 'once per save');
  assert.equal(game.flag('temple.desert.done'), true);
  const tD = FINALE.keeper + FINALE.reward + FINALE.house;
  assert.ok(seen.shut.length && Math.max(...seen.shut) >= tD - 0.05, `the door held shut until the way out’s panel (${Math.max(...seen.shut).toFixed(2)} s)`);
  assert.ok(Math.min(...seen.open) < tD + 0.6, 'and opened in it');
  assert.ok(rt.logic.isOpen(way.id), 'open at the end');
  assert.ok(ship.shots.length > 100 && ship.log.some(([k, v]) => k === 'bars' && v === true), 'filmed in the letterbox');
  assert.ok(rt.finaleLog.ended && !rt.finaleLog.skipped);
  // the glyphs came up, and ease back
  assert.ok(seen.lit > 0.9, `the house’s glyphs lit (${seen.lit.toFixed(2)})`);
  const base = rt.glyphGlow;
  for (let i = 0; i < 200; i++) rt.glowUpdate(1 / 30);
  assert.equal(rt.litK, 0, 'and eased back');
  assert.equal(rt.M.glyph.uniforms.uGlow.value, base);
  // a second resolution (another save's?) in the same save: not again
  assert.equal(playFinale(rt, { moments: new MomentStage({ ship: fakeShip(), game, player: rt.player }), sound: fakeSound(), game }), null);
});

test('a skip lands the same: the way out open, the flag set; without a ship the door opens at once', () => {
  const r = resolveWith('arzach', { skipAt: 1.5 });
  assert.ok(r.rt.finaleLog.skipped, 'skipped');
  assert.ok(Math.min(...r.seen.open) < 1.7, 'the door open on the skip');
  assert.ok(r.rt.logic.isOpen(r.way.id));
  const n = resolveWith('spheres', { ship: null });
  assert.equal(n.seen.playing, false, 'no ship’s camera: nothing played');
  assert.equal(n.seen.shut.length, 0, 'the way out opened at once, as before');
  assert.deepEqual(n.sound.cues, []);
});

test('the Greenhouse: its sun hushed while the film looks through it at the Gardener, and back after (#529)', () => {
  const { rt } = house('edena');
  const ship = fakeShip(), seen = [];
  ship.shot = (c) => { ship.shots.push(c); if (c.i < 3) seen.push({ hush: rt.gardenSun.hush, washes: washes(rt, c.pos, keeperBox(rt.guardian.model)).length }); };
  resolveWith('edena', { ship });
  assert.ok(seen.some((f) => f.washes > 0), 'a panel of A–C looks at the Gardener through its sun');
  assert.ok(seen.every((f) => !f.washes || f.hush === FILM_HUSH), 'and the sun is hushed whenever it does');
  assert.equal(rt.gardenSun.hush, 1, 'back to full after the film');
});

// Issue #563: the Casting-House's ending measured the loudest of the cinematics QC (−5.8 dBFS) because the review's
// staging forced every door of the way in open at once (src/cinematics-page/runtime.js): eleven clunks and rushes at the
// film's first second. Set as a stage, the doors open at once and silent; opened in play, one at a time, each is heard.
test('a house\'s doors set open as a stage open at once and silent; in play, heard (issue #563)', () => {
  const { rt } = house('moonfoundry');
  const calls = [];
  const sound = rt.sound;
  rt.sound = { doorOpen: () => calls.push('doorOpen'), whoosh: () => calls.push('whoosh') };
  try {
    const L = rt.logic, way = wayOut(rt);
    const doors = Object.entries(L.def.elements).filter(([id, el]) => id !== way.id && id !== rt.def.arenaDoor && el.type === 'door' && !JSON.stringify(el.opens ?? {}).includes('resolved')).map(([id]) => id);
    assert.ok(doors.length >= 8, `${doors.length} doors on the way in`);
    for (const id of doors) L.force(id, true);
    rt.applyDoors(true);
    assert.equal(calls.length, 0, 'no door heard');
    const shown = doors.map((id) => rt.byId.get(id)).filter((p) => p?.setOpen && 'k' in p);
    assert.ok(shown.length && shown.every((p) => p.open && p.k === 1), 'every door open, all the way');
    L.force(doors[0], false); rt.applyDoors(true);
    L.force(doors[0], true); rt.applyDoors();
    assert.deepEqual(calls, ['doorOpen'], 'opened in play: heard');
  } finally { rt.sound = sound; }
});

// Issue #562 (the v1.87 cinematics audit: the fourteen endings were one film, interest 3.4): C is each house's own, what
// the guardian's waking changes in its hall, held back through A and B and happening over C, and D the way out seen from
// inside the hall. What each house's change is, read off the house (a number that moves when it happens).
const CHANGE = {
  desert: (rt) => rt.spring.k,                                                     // the cistern's water
  incal: (rt) => Math.min(...rt.hallVanes.map((v) => v.left)),                    // the great vanes turning
  arzach2: (rt) => rt.hallStones.list[0].k,                                        // the stones coming down
  spheres: (rt) => (rt.singAll ? 1 : 0),                                           // all three spheres singing
  buried: (rt) => rt.engineGear.w,                                                 // the great gear turning
  perdide2: (rt) => rt.lampRoom.lampM.uniforms.uGlow.value,                        // the great lamp
  perdide: (rt) => rt.motherCrystals.swings[0].theta,                              // the crystals swinging
  arzach: (rt) => rt.roostWinds.filter((w) => w.on).length,                        // both vents breathing
  garage: (rt) => rt.workshopDials[0].minute.rotation.z,                           // the clocks' hands
  edena: (rt) => (rt.bedWater[0].m.visible ? rt.bedWater[0].m.scale.x : 0),        // the water in the beds
  bazaar: (rt) => rt.finaleSung ?? 0,                                              // the line sung round the hall
  spacecity: (rt) => (rt.logic.isOpen('d7') ? 1 : 0),                              // the Warden's gate
  moonfoundry: (rt) => rt.piece('mA').ironM.uniforms.uGlow.value,                  // the moon cast
  underwater: (rt) => (rt.hallTide.m.visible ? rt.hallTide.m.scale.x : 0),         // the tide over the floor
};
/** The house as play leaves it at the guardian's end: the Mother Snapper's crystals all frosted (her lullaby asks it). */
const PREP = { perdide: (rt) => { for (const sw of rt.motherCrystals.swings) { sw.still = Infinity; sw.frost = true; sw.phase0 = undefined; } } };
/** The house's own update as play runs it after the story's (runtime.js update: its pieces, its change, onCalm, the film's panel). */
function houseStep(rt, dt, t) {
  rt.time = (rt.time ?? 0) + dt;
  for (const p of [rt.engineGear, rt.hallStones, ...(rt.motherCrystals?.swings ?? []), ...(rt.hallVanes ?? [])]) p?.update?.(dt, t);
  rt.change?.update?.(dt, t);
  if (rt.logic.resolved) rt.def.onCalm?.(rt, rt.calmK, dt, t);
  rt.finaleRun?.(dt, t);
}

test('every house has its own panel C and frames its way out from inside its hall (#562)', () => {
  const whats = new Set();
  for (const id of Object.keys(TEMPLES)) {
    const S = FINALES[id].sign;
    assert.ok(S?.what?.length > 20 && typeof S.at === 'function', `${id}: what its own panel shows`);
    assert.ok(!whats.has(S.what), `${id}: its own, not another house's`);
    whats.add(S.what);
    const { rt } = house(id);
    standBy(rt);
    const film = finaleShots(rt);
    assert.notEqual(film.picked.sign, null, `${id}: a lens that sees ${S.what}`);
    assert.ok(film.picked.way, `${id}: the way out from inside the hall`);
    assert.ok(Math.abs(finaleLength() - 11) < 0.3, 'the film as long as before');
  }
});

for (const id of Object.keys(TEMPLES)) {
  test(`${id}: what its waking changes waits for its own panel, happens in it, and stays (#562)`, () => {
    const v = CHANGE[id], tC = FINALE.keeper + FINALE.reward, tD = tC + FINALE.house;
    const at = [];
    const { rt } = resolveWith(id, { prep: PREP[id], each: (r, dt, t) => { houseStep(r, dt, t); at.push([t, v(r)]); } });
    const before = at.filter(([t]) => t > 0.2 && t < tC - 0.1).map(([, x]) => x), during = at.filter(([t]) => t > tC && t < tD + 0.3).map(([, x]) => x);
    const v0 = before[0];
    assert.ok(before.every((x) => Math.abs(x - v0) < 1e-6), `${id}: held through the keeper and the purse (${Math.min(...before)}..${Math.max(...before)})`);
    assert.ok(during.some((x) => Math.abs(x - v0) > 0.05), `${id}: it happens in its panel (${v0} → ${during.map((x) => x.toFixed(2)).slice(0, 4)}…)`);
    assert.equal(rt.finaleK, null, 'the film over: the house its own again');
    assert.equal(rt.calmK, 1);
  });
}

test('a skip lands the house as its panel leaves it: the clocks at the time, the tide in, the gate up (#562)', () => {
  const tC = FINALE.keeper + FINALE.reward;
  for (const id of ['garage', 'underwater', 'spacecity', 'edena']) {
    const at = [];
    resolveWith(id, { skipAt: 1.2, each: (r, dt, t) => { houseStep(r, dt, t); at.push([t, CHANGE[id](r)]); } });
    const first = at.find(([t]) => t > 0.1)[1], late = at[at.length - 1][1];
    assert.ok(Math.abs(late - first) > 0.05, `${id}: changed after the skip (${first} → ${late})`);
    assert.ok(at.filter(([t]) => t > 1.4 && t < tC).some(([, x]) => Math.abs(x - first) > 0.05), `${id}: at once, not at C's time`);
  }
});

test('the Whale-House’s purse: close over it from the far side of the Listener’s shell, the chimes in the frame (#562)', () => {
  const { rt } = house('underwater');
  standBy(rt);
  const film = finaleShots(rt), B = film.shots[1];
  assert.ok(film.picked.reward, 'a lens found');
  const chimes = film.at.reward.clone().setY(film.at.reward.y + 0.3);
  for (const c of [B.from, B.to]) {
    assert.ok(c.pos.distanceTo(chimes) < 8, `close to the chimes (${c.pos.distanceTo(chimes).toFixed(1)} m; the shell's underside filled the frame from 11 m)`);
    assert.ok(inFrame(c, chimes), 'the chimes in the frame');
    assert.ok(!keeperBox(rt.guardian.model).containsPoint(c.pos), 'out of its body');
  }
});
