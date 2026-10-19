// Issue #494: "The space pirate mini game should have variation between levels. Also the ship is too big, the sounds
// are bad and there is shimmering on the ship at the beginning." (src/minigames/pirates-rules.js LEVELS, pirates.js
// BACKDROPS / SHIP_LENGTH / shipFit, pirates-sfx.js; docs/systems/minigames.md "Levels, a smaller ship, new sounds")
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FLY, LEVELS, levelFor, levelById, ROUTE_ORDER, FIELD, newRun, runStep, botInput, seedOf, chimesFor, CHECKPOINTS, courseRocks, driftRocks } from '../src/minigames/pirates-rules.js';
import pirates, { BACKDROPS, SHIP_LENGTH, shipFit, CAM } from '../src/minigames/pirates.js';
import { pirateSounds, PIRATE_SOUNDS } from '../src/minigames/pirates-sfx.js';
import { AMBUSH_LINES } from '../src/ambush.js';
import { ORDER } from '../src/levels/names.js';
import { buildShipModel } from '../src/ship/model.js';

const play = (S, input, dt, until = 400) => { const ev = []; while (!S.done && S.t < until) ev.push(...runStep(S, typeof input === 'function' ? input(S) : input, dt)); return ev; };
const waves = (L) => new Set(L.script.filter((e) => e.wave).map((e) => e.wave));

test('four levels, each its own formations, hazard and sky, in the same frame as the first', () => {
  assert.equal(LEVELS.length, 4);
  assert.deepEqual(LEVELS.map((l) => l.id), ['drift', 'mines', 'ice', 'wrecks']);
  const own = LEVELS.map((L) => [...waves(L)].filter((w) => !['chase', 'hauler', 'vee', 'line'].includes(w)).sort().join());
  assert.deepEqual(own, ['', 'pincer,wall', 'spiral', 'dive,pincer'], 'formations of their own');
  assert.ok(LEVELS[1].script.some((e) => e.field), 'the minefield lays mines across the way');
  assert.ok(LEVELS[2].drift && LEVELS[3].drift && !LEVELS[0].drift, 'the ice and the wrecks drift');
  assert.deepEqual(LEVELS.map((l) => l.shape), ['rock', 'rock', 'ice', 'wreck']);
  for (const L of LEVELS) {
    const S = L.script;
    assert.equal(S.find((e) => e.boss)?.t, 70, `${L.id}: the captain at 70 s`);
    assert.deepEqual(S.filter((e) => e.checkpoint).map((e) => e.t), CHECKPOINTS.slice(1), `${L.id}: the checkpoints where the first has them`);
    assert.equal(S.filter((e) => e.ring).length, 2, `${L.id}: two repair rings`);
    assert.ok(S.some((e) => e.wave === 'hauler') && S.some((e) => e.say === 'hauler'), `${L.id}: a bomber, announced`);
    for (const e of S) if (e.say) assert.ok(AMBUSH_LINES[e.say], `${L.id}: the line ${e.say}`);
    for (let i = 1; i < S.length; i++) assert.ok(S[i].t >= S[i - 1].t, `${L.id}: in order`);
    // about as many to shoot as the first: the points, and the chimes, stay where they were
    const skiffs = S.reduce((n, e) => n + (e.wave === 'pincer' ? 2 * e.n : ['line', 'vee', 'wall', 'spiral', 'dive'].includes(e.wave) ? e.n : 0), 0);
    const raiders = S.reduce((n, e) => n + (e.wave === 'chase' ? e.n : 0), 0);
    assert.ok(skiffs >= 26 && skiffs <= 31, `${L.id}: ${skiffs} fighters`);
    assert.equal(raiders, 5, `${L.id}: five gunboats`);
    // the hazard's line said before it comes
    const hz = { mines: 'mines', ice: 'ice', wrecks: 'wrecks' }[L.id];
    if (hz) assert.ok(S.some((e) => e.say === hz), `${L.id}: the ship says what is ahead`);
  }
  // each its own sky: the nebula's colour, the hazards' tones, the far moons
  const tones = LEVELS.map((L) => BACKDROPS[L.id].tone.slice(0, 3).join());
  assert.equal(new Set(tones).size, 4, 'four nebulae');
  for (const L of LEVELS) { const B = BACKDROPS[L.id]; assert.ok(B.space.length === 4 && B.tone.length === 4 && B.rocks.length >= 3 && B.far.length >= 3, L.id); }
});

test('which level a flight is: the route\'s worlds take them in turn, two in a row never alike; the Arcade any, or ?stage=', () => {
  assert.deepEqual(ROUTE_ORDER, ORDER, 'the rules\' copy of the route');
  assert.equal(levelFor('arzach').id, 'drift', 'the first ambush is the run it always was');
  const ids = ORDER.slice(1).map((w) => levelFor(w).id);
  for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1], `${ORDER[i]} then ${ORDER[i + 1]}`);
  assert.deepEqual(new Set(ids), new Set(LEVELS.map((l) => l.id)), 'every level met on the route');
  for (const w of ['waterfall', 'eclipse', 'mangrove']) assert.ok(LEVELS.includes(levelFor(w)), `${w}: a detour has one`);
  assert.equal(levelFor(null, { pick: 2 }).id, 'ice');
  assert.equal(levelFor('arzach', { stage: 'wrecks' }).id, 'wrecks');
  assert.equal(levelFor(null, { stage: 'nonsense', pick: 1 }).id, 'mines');
  assert.equal(levelById('nonsense').id, 'drift');
});

test('every level can be won: the pilot wins each at 60, 30 and 20 fps with the hull whole or nearly, the points where they were; an idle ship is lost', () => {
  for (const L of LEVELS) {
    for (const fps of [60, 30, 20]) {
      const S = newRun({ seed: seedOf('edena'), level: L });
      const ev = play(S, botInput, 1 / fps);
      assert.equal(S.done, 'won', `${L.id} at ${fps}: ${S.done} at ${S.t.toFixed(1)} s`);
      assert.ok(S.hits <= 2, `${L.id} at ${fps}: ${S.hits} hits`);
      const win = ev.find((e) => e.kind === 'win');
      assert.ok(win.sunk, `${L.id}: the gunship downed`);
      assert.ok(win.chimes >= 72 && win.chimes <= 92, `${L.id} at ${fps}: ${win.chimes} chimes (about 81 in the first level)`);
      assert.ok(S.t > 80 && S.t < 105, `${L.id}: ${S.t.toFixed(1)} s`);
    }
    const I = newRun({ seed: seedOf('edena'), level: L });
    play(I, {}, 1 / 60);
    assert.equal(I.done, 'dead', `${L.id}: doing nothing, lost`);
    assert.ok(I.t < 70, `${L.id}: before the captain (${I.t.toFixed(1)} s)`);
  }
});

test('the hazards are fair: the belts never a wall, drifting or not; each plane of mines has a gap the ship goes through', () => {
  for (const L of LEVELS) {
    const S = newRun({ seed: seedOf('incal'), level: L });
    assert.deepEqual(S.rocks.map((r) => r.s), courseRocks(seedOf('incal'), L.belts).map((r) => r.s));
    const box = 4 * FLY.boxU * FLY.boxV;
    for (const t of [0, 13.7, 41.2]) {
      S.t = t; S.rockI = 0;
      driftRocks(S, L.drift);
      const inBox = S.rocks.filter((r) => Math.abs(r.u) < FLY.boxU + r.r && Math.abs(r.v) < FLY.boxV + r.r);
      for (let s = L.belts[0][0]; s < L.belts[L.belts.length - 1][1]; s += 60) {
        const area = inBox.filter((r) => r.s >= s && r.s < s + 60).reduce((n, r) => n + Math.PI * r.r * r.r, 0);
        assert.ok(area < 0.45 * box, `${L.id} at ${s} m, ${t} s: ${(area / box * 100).toFixed(0)} % of the box`);
      }
    }
    if (L.drift) {
      // the shards really move: a rock's place across changes with the time, the same at any frame rate
      const r = S.rocks[3], at = (t) => { S.t = t; S.rockI = 0; driftRocks(S, L.drift); return [r.u, r.v]; };
      const a = at(10), b = at(12);
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5, `${L.id}: drifting`);
      assert.deepEqual(at(10), a);
    }
  }
  // the minefield: planes of mines over the box, one gap each, wide enough for the ship with room to spare
  const M = newRun({ seed: 3, level: 'mines' });
  play(M, botInput, 1 / 60, 16.05);
  const mines = M.foes.filter((e) => e.field);
  const planes = [...new Set(mines.map((e) => e.ds))];
  assert.equal(planes.length, 2, 'two planes');
  for (const [k, ds] of planes.entries()) {
    const here = mines.filter((e) => e.ds === ds), gap = M.fields[k];
    assert.ok(here.length >= 18 && here.length <= 24, `${here.length} mines a plane`);
    assert.ok(FIELD.ahead + k * FIELD.apart - 1 < ds + FLY.speed, 'hung far enough ahead to be seen');
    // the ship's body fits through the gap with half its width to spare on every side
    const clear = Math.min(...here.map((e) => Math.max(Math.abs(e.u - gap.u) - FLY.body.u, Math.abs(e.v - gap.v) - FLY.body.v) - e.r * 0.8));
    assert.ok(clear > 1.5, `the gap clears the ship by ${clear.toFixed(1)} m`);
    // and nowhere else: the rest of the plane is a wall
    for (const u of [-FLY.boxU, 0, FLY.boxU]) for (const v of [-FLY.boxV, FLY.boxV]) {
      if (Math.abs(u - gap.u) < FIELD.step * 1.5 && Math.abs(v - gap.v) < FIELD.step * 1.5) continue;
      assert.ok(here.some((e) => Math.abs(e.u - u) <= FIELD.step / 2 + 0.01 && Math.abs(e.v - v) <= FIELD.step / 2 + 0.01), `a mine near ${u}, ${v}`);
    }
  }
  // a field is shot through, one mine at a time, for a point each
  assert.ok(mines.every((e) => e.pts === FIELD.pts && e.hp === 1));
});

test('the new formations come into the view and through it', () => {
  for (const [level, wave] of [['mines', 'wall'], ['mines', 'pincer'], ['ice', 'spiral'], ['wrecks', 'dive']]) {
    const S = newRun({ seed: 5, level });
    S.rocks = [];
    const at = S.script.find((e) => e.wave === wave).t;
    play(S, { y: 0 }, 1 / 60, at + 0.05);
    const ids = new Set(S.foes.filter((e) => e.path === (wave === 'pincer' ? 'line' : wave)).map((e) => e.id));
    assert.ok(ids.size >= 3, `${wave}: ${ids.size} fighters`);
    let inView = 0, sides = new Set();
    for (let i = 0; i < 60 * 8 && S.foes.some((e) => ids.has(e.id)); i++) {
      S.ship.hull = 6; S.ship.iframe = 1;   // (untouchable: the formation's path is what is watched)
      runStep(S, {}, 1 / 60);
      for (const e of S.foes) if (ids.has(e.id) && !e.hidden && e.ds > 20 && e.ds < 150 && Math.abs(e.u) < FLY.boxU + 6 && Math.abs(e.v) < FLY.boxV + 6) { inView++; sides.add(Math.sign(e.u)); }
    }
    assert.ok(inView > 60, `${wave}: in the view a while (${inView} fighter-frames)`);
    assert.ok(!S.foes.some((e) => ids.has(e.id)), `${wave}: gone by in the end`);
    if (wave === 'pincer') assert.ok(sides.has(1) && sides.has(-1), 'from both sides');
  }
});

test('the page builds each level\'s sky and hazards; the ship is fitted small and casts no shadow (issue #494)', () => {
  const was = globalThis.location;
  try {
    for (const L of LEVELS) {
      globalThis.location = { search: `?stage=${L.id}` };
      const scene = new THREE.Scene();
      const gen = pirates.build(scene); let r; while (!(r = gen.next()).done);
      const lv = r.value, P = lv.pirates;
      assert.equal(P.level.id, L.id);
      assert.deepEqual(lv.defaults.look.uSpaceTone, BACKDROPS[L.id].tone, `${L.id}: its nebula`);
      // the ship: SHIP_LENGTH long whatever the family ship's size, its middle on its place
      const box = new THREE.Box3();
      P.ship.updateMatrixWorld(true);
      P.model.group.traverse((o) => { if (!o.isMesh) return; for (let q = o; q; q = q.parent) if (!q.visible) return; box.expandByObject(o); });
      const size = box.getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.z - SHIP_LENGTH) < 0.05, `${size.z.toFixed(2)} m long`);
      assert.ok(size.x < 2.2, `${size.x.toFixed(2)} m across`);
      assert.ok(FLY.body.u <= size.x / 2 + 0.05 && FLY.body.u >= size.x * 0.4, `the hit box (${FLY.body.u}) inside the drawing, not much smaller (${(size.x / 2).toFixed(2)})`);
      assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).z) < 0.3, 'its middle on its place');
      // no sun shadow from it (the shimmer at the start: its masts' shadow crawled over the deck in the far map's texels)
      P.model.group.traverse((o) => { if (o.isMesh) assert.ok(lv.noShadow.includes(o), `${o.name}: casts no shadow`); });
      assert.ok(lv.noShadow.includes(P.flames));
    }
  } finally { if (was === undefined) delete globalThis.location; else globalThis.location = was; }
  // on the screen: from the camera, the ship takes about a tenth of the width (it took about a third)
  const cam = new THREE.PerspectiveCamera(CAM.fov, 16 / 9, 0.3, 5000);
  cam.position.set(0, CAM.up, CAM.back); cam.lookAt(0, 0.4, -CAM.look); cam.updateMatrixWorld();
  const m = buildShipModel({ space: true, legs: 'up' });
  for (const o of [...m.indoor, m.screen]) o.visible = false;
  const fit = shipFit(m.group);
  assert.ok(fit.width / 2 < 1.1 && fit.scale < 0.2, `fitted: ${fit.width.toFixed(2)} m across, scale ${fit.scale.toFixed(3)}`);
  const half = new THREE.Vector3(fit.width / 2, 0, 0).project(cam).x - new THREE.Vector3(0, 0, 0).project(cam).x;
  assert.ok(half * 2 / 2 < 0.13, `the ship ${(half * 50).toFixed(1)} % of the screen's width`);
});

test('the sounds (issue #494): the game\'s own vocabulary, short, none ringing on, the repeated ones varied', () => {
  const played = [];
  const rec = { ctx: { currentTime: 0 }, muted: false, fx: {}, vary: () => 1.03,
    sweep: (...a) => played.push(['sweep', ...a]), burst: (...a) => played.push(['burst', ...a]), noiseGlide: (...a) => played.push(['noiseGlide', ...a]),
    pluck: (...a) => played.push(['pluck', ...a]), ting: (...a) => played.push(['ting', ...a]), crystalTing: (...a) => played.push(['crystalTing', ...a]), lockOn: (...a) => played.push(['lockOn', ...a]) };
  const snd = pirateSounds(rec);
  for (const k of Object.keys(PIRATE_SOUNDS)) { if (k === 'engine') continue; rec.ctx.currentTime += 1; snd[k](); }
  assert.ok(!played.some(([k]) => k === 'pluck'), 'no plucks: each rang 1.6 s');
  assert.ok(played.some(([k]) => k === 'lockOn'), 'the lock is the lock-on\'s own');
  assert.ok(played.some(([k]) => k === 'crystalTing'), 'the tally the chimes\' own glass');
  assert.ok(played.some(([k]) => k === 'ting'), 'the pick-ups the struck glass');
  for (const [k, ...a] of played) {
    if (k === 'sweep') assert.ok(a[3] <= 1.5, `a tone of ${a[3]} s`);
    if (k === 'burst') assert.ok(a[1].dur <= 1.5, `a noise of ${a[1].dur} s`);
  }
  // the bolts and a hit a little different each time (Sound.vary)
  const src = readFileSync(new URL('../src/minigames/pirates-sfx.js', import.meta.url), 'utf8');
  for (const k of ['shot', 'enemy', 'hit', 'boom', 'clank']) assert.match(src.slice(src.indexOf(`    ${k}(`), src.indexOf(`    ${k}(`) + 400), /vary\(/, `${k} varies`);
});

test('the sounds rendered (in memory, silent): the bolts and a hit short and under the explosions, a fight never clipping', async () => {
  const { renderer } = await import('../scripts/sound-qc/render.mjs');
  const { measure } = await import('../scripts/sound-qc/lib.mjs');
  const R = await renderer({ samples: false });
  try {
    const one = async (fn) => { const r = await R.render((s) => fn(pirateSounds(s)), { secs: 1.5 }); return measure(r.pcm, r.rate, { bed: r.bed }); };
    const shot = await one((p) => p.shot()), hit = await one((p) => p.hit()), boom = await one((p) => p.boom(1)), lock = await one((p) => p.lock()), tally = await one((p) => p.tally(2));
    assert.ok(shot.dur <= 0.2 && hit.dur <= 0.2, `the bolts ${shot.dur} s, a hit ${hit.dur} s (a hit rang 1.35 s)`);
    assert.ok(lock.dur <= 0.4 && tally.dur <= 0.6, `the lock ${lock.dur} s, the tally ${tally.dur} s`);
    assert.ok(hit.rms < shot.rms && shot.rms < boom.rms - 10, `a hit ${hit.rms}, the bolts ${shot.rms}, a wreck ${boom.rms} dBFS`);
    assert.ok(hit.centroid < 3000, `a hit not shrill (${hit.centroid} Hz; 6,756 before)`);
    // a fight's loudest moment: bolts, their shots, hits, three wrecks and a pip lost within a second and a half
    const s = await R.fresh('desert', 7), p = pirateSounds(s);
    s.ctx.render(24000);
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      if (i % 4 === 0) p.shot(); if (i % 6 === 3) p.enemy(); if (i === 8 || i === 9) p.hit();
      if (i === 10) p.boom(1.25); if (i === 14) { p.boom(0.85); p.boom(0.85); p.combo(2); } if (i === 20) p.hull();
      for (const x of s.ctx.render(2400)) peak = Math.max(peak, Math.abs(x));
    }
    assert.ok(20 * Math.log10(peak) < -6, `the fight peaks at ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
  } finally { R.close(); }
});
