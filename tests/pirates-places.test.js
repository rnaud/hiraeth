// Issue #555: "I want the space pirate mini game to have different levels, not just different ships, so it truly feels
// like you are going to another planet." (src/minigames/pirates-rules.js LEVELS' places, SPIRE, STORM; pirates.js
// BACKDROPS' places, groundV, layerPieces, ARRIVAL; pirates-sfx.js PLACE_SOUNDS; docs/systems/minigames.md "Places")
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLY, LEVELS, SPIRE, STORM, newRun, runStep, botInput, seedOf, courseSpires, stormAt, findLock, aimTarget, nextLevel } from '../src/minigames/pirates-rules.js';
import pirates, { BACKDROPS, ARRIVAL, GROUND, groundV, groundGeometry, layerPieces, placeLook, placeScript } from '../src/minigames/pirates.js';
import { pirateSounds, PIRATE_SOUNDS, PLACE_SOUNDS } from '../src/minigames/pirates-sfx.js';
import { AMBUSH_LINES } from '../src/ambush.js';
import { gameLinks } from '../src/minigames/kit/arcade.js';

/** The page built for a level (as ?stage=<id>, and ?to= when given). */
function build(stage, to = null) {
  const was = globalThis.location;
  globalThis.location = { search: `?stage=${stage}${to ? `&to=${to}` : ''}` };
  try { const scene = new THREE.Scene(); const gen = pirates.build(scene); let r; while (!(r = gen.next()).done); return { scene, level: r.value }; }
  finally { if (was === undefined) delete globalThis.location; else globalThis.location = was; }
}
/** A session on a built page with a recording host. */
function session(built) {
  const flashes = [], heard = [], fovs = [];
  const sound = { ctx: { currentTime: 0 }, muted: false, fx: {}, sweep: () => heard.push('sweep'), burst: () => heard.push('burst'), noiseGlide: () => heard.push('glide'), ting: (t, f) => heard.push(`ting ${Math.round(f)}`) };
  const ctx = { camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000), level: built.level, scene: built.scene, player: { object: {} }, sound, state: { data: { flags: {} }, flag: () => undefined, set() {} }, settings: {},
    sfx: { hurt() {} }, setLives() {}, setScore() {}, setFov: (f) => fovs.push(f), flash: (t, k) => flashes.push([t, k]), kick() {}, finish() {}, speed() {}, hintUsed() {}, hintNote() {} };
  const sess = pirates.start(ctx);
  return { sess, S: sess.state, flashes, heard, fovs, sound };
}

test('each level is a place of its own: its name, its line, its light, its sky and what it is flown over', () => {
  const names = LEVELS.map((L) => L.place?.name);
  assert.deepEqual(names, ['The Rose Rings', 'The Iron Moon', 'The Frost Moon', 'The Storm Giant']);
  for (const L of LEVELS) assert.ok(L.place.line && L.place.line.length < 50, `${L.id}: a short line`);
  // the light: four scripts, four suns' colours, each its own hour, fog and nebula
  const B = LEVELS.map((L) => BACKDROPS[L.id]);
  assert.equal(new Set(B.map((b) => b.script.join())).size, 4, 'four lights');
  assert.equal(new Set(B.map((b) => b.script[4])).size, 4, 'four suns');
  assert.equal(new Set(B.map((b) => JSON.stringify(placeLook(b)))).size, 4, 'four looks');
  for (const b of B) {
    assert.equal(b.script.length, 5);
    assert.deepEqual(placeScript(b).day, b.script);
    assert.ok(b.planets.length >= 1 && b.planets.length <= 2, 'one or two bodies of its own (the destination is the third)');
    for (const p of b.planets) assert.ok([p.az, p.el, p.size].every(Number.isFinite));
  }
  // what it is flown over: the rings' rubble (open space), a moon's face, a frozen moon's, a giant's clouds
  assert.ok(!BACKDROPS.drift.ground && BACKDROPS.drift.layer.kind === 'rubble', 'the Rose Rings: open space, its rubble below');
  assert.ok(BACKDROPS.drift.planets.some((p) => p.ring > 0 && p.size > 15), 'the rose giant, ringed');
  assert.deepEqual(['mines', 'ice', 'wrecks'].map((id) => BACKDROPS[id].layer.kind), ['crater', 'spire', 'cloud']);
  for (const id of ['mines', 'ice', 'wrecks']) {
    const G = BACKDROPS[id].ground;
    assert.ok(G, `${id}: a ground`);
    // always well under the ship's box, wherever along the way and across it
    for (let s = 0; s < 6000; s += 37) for (let u = -FLY.boxU - 2; u <= FLY.boxU + 2; u += 3) assert.ok(groundV(G, s, u) < -FLY.boxV - 6, `${id}: the ground ${groundV(G, s, u).toFixed(1)} m at ${s}, ${u}`);
  }
  assert.ok(BACKDROPS.wrecks.murk, 'the storm has a murk to hide pirates in');
  // the ships stay clear against each: the Storm Giant's sky not pale behind the pale bolts
  const lum = (h) => { const c = new THREE.Color(h); return 0.3 * c.r + 0.55 * c.g + 0.15 * c.b; };
  assert.ok(lum(BACKDROPS.wrecks.script[0]) < 0.45, 'the storm\'s sky a mid tone');
});

test('the page builds each place: its sky, its look, its ground (one mesh, no shadow), its layer (one instanced mesh)', () => {
  const draws = {};
  for (const L of LEVELS) {
    const { scene, level } = build(L.id, 'edena');
    const P = level.pirates, B = BACKDROPS[L.id];
    assert.equal(level.defaults.hour, B.hour, `${L.id}: its hour`);
    assert.deepEqual(level.defaults.look.uSpaceTone, B.tone);
    if (B.fog) assert.equal(level.defaults.look.uFogDensity, B.fog[0]);
    assert.equal(level.sky.planets.length, B.planets.length + 1, `${L.id}: its bodies and the destination`);
    assert.deepEqual(level.sky.script.day, B.script);
    if (B.ground) {
      assert.ok(P.ground?.isMesh, `${L.id}: its ground`);
      assert.ok(level.noShadow.includes(P.ground), 'no shadow from the ground');
      const n = P.ground.geometry.attributes.position.count;
      assert.ok(n < 12000, `${L.id}: ${n} points`);
    } else assert.equal(P.ground, null);
    assert.equal(P.layer.parts.length, 1, 'the layer is one instanced mesh');
    assert.ok(level.noShadow.includes(P.layer.parts[0].mesh));
    draws[L.id] = scene.children.filter((o) => o.isMesh && o.visible !== false).length;
  }
  // a place adds two draws at most over the open drift's
  for (const id of ['mines', 'ice', 'wrecks']) assert.ok(draws[id] <= draws.drift + 1, `${id}: ${draws[id]} meshes against ${draws.drift}`);
  // the ribbon follows the rail, its first row behind the start
  const g = groundGeometry(BACKDROPS.mines.ground);
  assert.ok(g.index.count > 0 && -g.attributes.position.getZ(0) <= GROUND.from + 1);
  // the layer's pieces stay off the ship's way where they stand on the ground
  for (const id of ['ice', 'wrecks']) for (const p of layerPieces(BACKDROPS[id].layer, 7)) assert.ok(Math.abs(p.u) >= BACKDROPS[id].layer.inner, `${id}: a piece at ${p.u.toFixed(1)}`);
});

test('the Iron Moon pulls the ship down; climbing beats it; elsewhere nothing pulls', () => {
  const run = (id, y) => { const S = newRun({ level: id }); S.script = []; S.rocks = []; for (let i = 0; i < 180; i++) runStep(S, { y }, 1 / 60); return S.ship.v; };
  assert.ok(LEVELS[1].pull > 0);
  assert.ok(run('mines', 0) < -FLY.boxV + 0.5, `let go, it sinks to the bottom (${run('mines', 0).toFixed(1)})`);
  assert.ok(Math.abs(run('drift', 0) + 1) < 0.05, 'the open drift: it stays where it was left');
  assert.ok(run('mines', 1) > 3, 'climbing, it rises all the same');
});

test('the Frost Moon\'s spires: in the box, never over its top band, spaced; struck below the top, a pip and a knock up; over it, untouched', () => {
  const L = LEVELS[2];
  const sp = courseSpires(seedOf('edena'), L.spires);
  assert.ok(sp.length >= 15, `${sp.length} spires`);
  for (const p of sp) {
    assert.ok(Math.abs(p.u) <= FLY.boxU && p.top <= SPIRE.top[1] && p.top < FLY.boxV - FLY.body.v - 2, `a spire at ${p.u.toFixed(1)} up to ${p.top.toFixed(1)}`);
    assert.ok(L.spires.some(([a, b]) => p.s >= a && p.s <= b), 'in a band');
  }
  for (let i = 1; i < sp.length; i++) assert.ok(sp[i].s - sp[i - 1].s >= SPIRE.gap - 1e-6 || !L.spires.some(([a, b]) => sp[i].s >= a && sp[i - 1].s >= a && sp[i].s <= b && sp[i - 1].s <= b), 'spaced');
  // only in the Frost Moon
  for (const id of ['drift', 'mines', 'wrecks']) assert.equal(newRun({ level: id }).spires.length, 0);
  // parked under one's top, at its place across: struck once
  const S = newRun({ seed: seedOf('edena'), level: 'ice' });
  S.script = []; S.rocks = [];
  const p = S.spires[0];
  S.s = p.s - 30; S.ship.u = p.u; S.ship.v = p.top - 2;
  const ev = [];
  for (let i = 0; i < 60; i++) ev.push(...runStep(S, { x: 0, y: 0 }, 1 / 60));
  assert.equal(ev.filter((e) => e.kind === 'spire').length, 1, 'struck once');
  assert.ok(ev.some((e) => e.kind === 'hurt' && e.by === 'spire'), 'a pip');
  assert.ok(p.hit);
  // over its top: nothing
  const T = newRun({ seed: seedOf('edena'), level: 'ice' });
  T.script = []; T.rocks = [];
  const q = T.spires[0];
  T.s = q.s - 30; T.ship.u = q.u; T.ship.v = Math.min(FLY.boxV, q.top + 1.5);
  const ev2 = [];
  for (let i = 0; i < 60; i++) ev2.push(...runStep(T, { x: 0, y: 0.3 }, 1 / 60));
  assert.ok(!ev2.some((e) => e.kind === 'spire' || e.kind === 'hurt'), 'flown over');
});

test('the Storm Giant\'s storms hide the pirates beyond the veil: drawn in the murk, not to be locked; outside, all seen', () => {
  const L = LEVELS[3];
  assert.ok(L.storms.length >= 2);
  for (const [a, b] of L.storms) assert.ok(a < b && b < 2900, 'none in the captain\'s fight');
  assert.ok(stormAt(L.storms, L.storms[0][0] + 1) && !stormAt(L.storms, L.storms[0][0] - 1) && !stormAt(null, 10));
  const S = newRun({ level: 'wrecks' });
  S.script = []; S.rocks = [];
  S.s = L.storms[0][0] - 5;
  // (two pirates held where they are: no path of their own)
  const near = { id: 1, kind: 'skiff', hp: 1, r: 2.6, age: 9, flash: 0, ds: 40, u: 6, v: 3, path: 'hold', face: 'ship' };
  const far = { id: 2, kind: 'skiff', hp: 1, r: 2.6, age: 9, flash: 0, ds: 150, u: 0, v: -1, path: 'hold', face: 'ship' };
  S.foes.push(near, far);
  const ev = [];
  for (let i = 0; i < 30; i++) { near.ds = 40; far.ds = 150; ev.push(...runStep(S, {}, 1 / 60)); }
  assert.ok(S.inStorm && ev.some((e) => e.kind === 'storm' && e.on), 'into the storm');
  assert.equal(near.veil, 0, 'close by: seen');
  assert.ok(far.veil > 0.9, `far off: hidden (${far.veil})`);
  assert.ok(findLock(S, 1)?.foe !== far, 'the hidden one cannot be locked');
  // out of the storms: all seen again
  const O = newRun({ level: 'wrecks' });
  O.script = []; O.rocks = [];
  O.s = L.storms[0][1] + 20;   // (and the pirate 150 m on, short of the next)
  const f2 = { ...far, id: 3, veil: 1 };
  O.foes.push(f2);
  runStep(O, {}, 1 / 60);
  assert.equal(f2.veil, 0);
  assert.ok(aimTarget(O, 3)?.foe === f2 || findLock(O, 1)?.foe === f2, 'out of the storm, it can be aimed at');
  // the pilot still wins it with the hull nearly whole (pirates-levels.test.js flies each level at three rates)
  const W = newRun({ seed: seedOf('edena'), level: 'wrecks' });
  while (!W.done && W.t < 300) runStep(W, botInput(W), 1 / 60);
  assert.equal(W.done, 'won');
});

test('the arrival: the page opens on the warp\'s last moment, the place\'s name and line flashed, its note heard; a Retry flies on without it', () => {
  for (const L of LEVELS) {
    const built = build(L.id);
    const { sess, flashes, heard, fovs } = session(built);
    assert.equal(sess.feedback.arriveT, ARRIVAL.secs, `${L.id}: arriving`);
    for (let i = 0; i < 20; i++) sess.update(1 / 60, {}, { live: false, phase: 'count', raw: {} });
    assert.ok(Math.max(...fovs) > 60, `${L.id}: the view wide out of the warp (${Math.max(...fovs).toFixed(1)}°)`);
    assert.ok(heard.includes(`ting ${PLACE_SOUNDS[L.id].note}`), `${L.id}: its note`);
    assert.ok(!flashes.length, 'the name after the streaks');
    for (let i = 0; i < 30; i++) sess.update(1 / 60, {}, { live: false, phase: 'count', raw: {} });
    assert.deepEqual(flashes[0], [L.place.name, 'big'], `${L.id}: its name, big`);
    assert.equal(flashes[1][0], L.place.line);
    for (let i = 0; i < 120; i++) sess.update(1 / 60, {}, { live: false, phase: 'count', raw: {} });
    assert.equal(sess.feedback.arriveT, 0);
    assert.ok(Math.abs(fovs.at(-1) - 50) < 0.5, 'the view back to its own');
    sess.end();
    // a Retry (the same page): no arrival, no name
    const again = session(built);
    assert.equal(again.sess.feedback.arriveT, 0);
    for (let i = 0; i < 60; i++) again.sess.update(1 / 60, {}, { live: false, phase: 'count', raw: {} });
    assert.ok(!again.flashes.some(([t]) => t === L.place.name));
    again.sess.end();
  }
});

test('the places\' sounds: an arrival each in its own key, a held bed each, the thunder short and soft', () => {
  for (const k of ['arrive', 'bed', 'thunder']) assert.ok(PIRATE_SOUNDS[k], k);
  assert.equal(new Set(Object.values(PLACE_SOUNDS).map((p) => p.note)).size, 4, 'four notes');
  for (const [id, P] of Object.entries(PLACE_SOUNDS)) { assert.ok(LEVELS.some((l) => l.id === id)); assert.ok(P.vol <= 0.025, `${id}: a soft bed`); }
  const played = [];
  const rec = { ctx: { currentTime: 1 }, muted: false, fx: {}, vary: () => 1, sweep: (...a) => played.push(['sweep', ...a]), burst: (...a) => played.push(['burst', ...a]), noiseGlide: (...a) => played.push(['glide', ...a]), ting: (...a) => played.push(['ting', ...a]) };
  const snd = pirateSounds(rec);
  snd.thunder(0.2); snd.thunder(0.9);
  const rolls = played.filter(([k, , o]) => k === 'burst' && o.type === 'lowpass');
  assert.equal(rolls.length, 2);
  for (const [, , o] of rolls) assert.ok(o.dur <= 1.2 && o.vol <= 0.07 && o.freq < 300, 'a low soft roll');
  for (const [k, , o] of played) if (k === 'burst') assert.ok(o.dur <= 1.2 && o.vol <= 0.07, 'soft and short');
  played.length = 0;
  snd.arrive('ice');
  assert.ok(played.some(([k, , f]) => k === 'ting' && f === PLACE_SOUNDS.ice.note));
  for (const [k, ...a] of played) if (k === 'sweep') assert.ok(a[3] <= 1.2);
});

test('the cards fly on to the next place (the Arcade\'s, the Debug menu\'s); on the way to a world, the landing is the way on', () => {
  assert.deepEqual(LEVELS.map((L) => nextLevel(L.id).id), ['mines', 'ice', 'wrecks', 'drift']);
  const { level } = build('ice');
  const links = gameLinks(pirates, level, 'arcade', [pirates, { id: 'drums', name: 'The drum circle' }]);   // (the games' list: Vite's glob, none in node)
  const on = links.extra.find((l) => l.id === 'place');
  assert.equal(on.sub, 'The Storm Giant');
  assert.equal(on.href, '?game=pirates&stage=wrecks&from=arcade');
  assert.ok(links.quit && links.extra.some((l) => l.id === 'next'), 'the Arcade\'s ways out kept');
  assert.equal(gameLinks(pirates, level, null).extra[0].href, '?game=pirates&stage=wrecks');
  const { level: transit } = build('ice', 'edena');
  assert.equal(pirates.links(transit, null), null);
  // the lines said in the places
  for (const k of ['moon', 'storm', 'ice']) assert.ok(AMBUSH_LINES[k]?.tone, k);
  assert.ok(LEVELS[1].script.some((e) => e.say === 'moon') && LEVELS[3].script.some((e) => e.say === 'storm'));
});
