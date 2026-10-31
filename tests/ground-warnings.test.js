// Ground warnings (issue #758, src/ground-warnings.js): a lob's landing mark, a blast's reach, a shockwave, drawn into
// the ground after the author's picked sheets. Their radii are the hits', they follow the slope, they last exactly as
// long as the attack's wind-up (or the wave's run), and their state and instances are pooled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { GroundWarnings, lobRing, lobShadow, shockHeight, SHOCK, SHOCK_STEP, CAP, LOB } from '../src/ground-warnings.js';
import { groundMark, markRadius, isArea } from '../src/telegraph.js';
import { inArea } from '../src/temples/boss.js';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const _m = new THREE.Matrix4(), _p = v(), _q = new THREE.Quaternion(), _s = v(), _col = v();
/** Every drawn instance of a pool: { p, x, y, z } (its position and its basis' columns). */
function drawn(P) {
  const out = [];
  for (let i = 0; i < P.mesh.count; i++) {
    P.mesh.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
    const e = _m.elements;
    out.push({ p: _p.clone(), x: v(e[0], e[1], e[2]), y: v(e[4], e[5], e[6]), z: v(e[8], e[9], e[10]) });
  }
  return out;
}
const slope = (k) => (x, y, z) => k * x;   // (a plane rising k m a metre along +x)

test('the picked sheets are in the repository, one per effect', () => {
  for (const id of ['lob', 'area', 'wave']) assert.ok(existsSync(new URL(`../references/effects/${id}/sheet-1.jpg`, import.meta.url)), `${id}: its sheet`);
});

test('the radii: a lob ring tightens onto exactly the hit radius, never inside it; an area ring is the blast’s; marks use the hit’s own radius', () => {
  for (const R of [1.2, 1.5, 3.4]) {
    for (let k = 0; k <= 1.0001; k += 0.05) assert.ok(lobRing(R, k) >= R - 1e-9, `R ${R}, k ${k.toFixed(2)}: never inside the hit`);
    assert.ok(Math.abs(lobRing(R, 1) - R) < 1e-9 && Math.abs(lobRing(R, LOB.tight) - R) < 1e-9, 'on the hit’s edge as it lands');
    assert.ok(lobRing(R, 0) > R * 1.3, 'wide at first');
    assert.ok(lobShadow(R, 0) < lobShadow(R, 1) && lobShadow(R, 1) < R, 'the shadow grows, inside the ring');
  }
  // the hit's radius is the ring's (src/temples/boss.js inArea): the mark is drawn exactly there
  for (const a of [...FOES.grunt.attacks, ...FOES.prowler.attacks, ...FOES.crawler.attacks].filter(groundMark)) {
    const R = markRadius(a);
    assert.ok(inArea(a, v(), 0, v(R - 0.01, 0, 0)) && !inArea(a, v(), 0, v(R + 0.01, 0, 0)), `${a.id}: drawn at its hit’s edge (${R} m)`);
  }
  assert.ok(isArea(FOES.crawler.attacks.find((x) => x.id === 'blast')), 'the crawler’s blast marks its reach');
  assert.ok(!groundMark(FOES.hulk.attacks.find((x) => x.id === 'stomp')), 'the hulk’s stomp reads from its body (its wave is drawn as it runs)');
});

test('they follow the slope: every stroke and disc of a lob, an area and its blast sits on the ground under it', () => {
  for (const k of [0, 0.4]) {
    const root = new THREE.Group(), gw = new GroundWarnings(root, { groundAt: slope(k) });
    const lob = {}, area = {};
    gw.lob(lob, v(0, 0, 0), 1.5, 0.5);
    gw.area(area, v(8, 8 * k, 0), 2.6, 0.8);
    gw.impact('area', v(-8, -8 * k, 0), 2.6);
    gw.update(0.2);   // (the flower half grown)
    const all = [...drawn(gw.strokes), ...drawn(gw.discs)];
    assert.ok(all.length > 100, `${all.length} drawn`);
    for (const d of all) {
      const over = d.p.y - k * d.p.x;
      assert.ok(over > 0.005 && over < 0.12, `on the ground at (${d.p.x.toFixed(2)}, ${d.p.z.toFixed(2)}): ${over.toFixed(3)} m over it`);
    }
    // the strokes lie along the ground (their length along the slope), not level over it
    for (const d of drawn(gw.strokes)) { const dir = d.x.clone().normalize(); if (Math.abs(dir.x) > 0.5) assert.ok(Math.abs(dir.y / dir.x - k) < 0.08, 'tilted with the slope'); }
    gw.dispose();
  }
});

test('the blast flower fills exactly the ring; a lob’s grit lands inside it', () => {
  const gw = new GroundWarnings(new THREE.Group(), { groundAt: () => 0 }), R = 2.6;
  gw.impact('area', v(), R);
  let far = 0;
  for (let i = 0; i < 30; i++) { gw.update(1 / 60); for (const d of drawn(gw.discs)) far = Math.max(far, Math.hypot(d.p.x, d.p.z) + d.z.length()); }
  assert.ok(far <= R + 0.02 && far > R * 0.95, `the petals reach ${far.toFixed(2)} of ${R} m`);
  gw.clear(); gw.impact('lob', v(), 1.3);
  let grit = 0;
  for (let i = 0; i < 20; i++) { gw.update(1 / 60); for (const d of drawn(gw.strokes)) for (const e of [1, -1]) grit = Math.max(grit, Math.hypot(d.p.x + e * d.x.x / 2, d.p.z + e * d.x.z / 2)); }
  assert.ok(grit <= 1.3 + 1e-6, `grit and ring inside ${grit.toFixed(2)} m`);
  gw.dispose();
});

test('the wave: its curl spans the hit’s band (r ± width), knee-high, follows the ground, and is not drawn where it cannot hit', () => {
  const gw = new GroundWarnings(new THREE.Group(), { groundAt: (x) => (x > 4.5 ? 3 : 0.2 * x) }), key = {}, W = { r0: 2, reach: 8, width: 0.55 };
  gw.shock(key, v(), 4, W);
  gw.update(DT);
  const segs = drawn(gw.curls);
  assert.ok(segs.length >= SHOCK.min, `${segs.length} segments`);
  for (const s of segs) {
    assert.ok(Math.abs(Math.hypot(s.p.x, s.p.z) - 4) < 0.05, 'on the front');
    assert.ok(Math.abs(Math.hypot(s.z.x, s.z.z) - W.width) < 0.01, `its footprint ±${W.width} m (the hit’s band)`);
    assert.ok(s.y.length() <= SHOCK.height + 1e-6 && s.y.length() > 0.2, 'knee-high');
    assert.ok(Math.abs(s.p.y - 0.2 * s.p.x) < 0.05, 'on the slope');
  }
  assert.equal(drawn(gw.crests).length, segs.length, 'a crest on every segment');
  // (the wave at 6 m crosses the 3 m step at x 4.5: no curl up there, where it does not hit)
  gw.shock(key, v(), 6, W); gw.update(DT);
  assert.ok(drawn(gw.curls).every((s) => s.p.x < 4.5 + 0.2 && Math.abs(s.p.y) < SHOCK_STEP + 0.01), 'not up the step');
  assert.ok(shockHeight(W.r0, W.r0, W.reach) === 0 && shockHeight(W.reach, W.r0, W.reach) === 0 && shockHeight(5, W.r0, W.reach) === SHOCK.height, 'grows in, fades out at its reach');
  gw.dispose();
});

test('pooling: warnings and bursts are reused, the instance buffers never grow, the ground is sampled once a cell', () => {
  const gw = new GroundWarnings(new THREE.Group(), { groundAt: () => 0 });
  const keys = Array.from({ length: 6 }, () => ({}));
  for (let round = 0; round < 40; round++) {
    for (let t = 0; t < 20; t++) { for (const [i, k] of keys.entries()) (i % 2 ? gw.lob(k, v(i * 5, 0, 0), 1.4, t / 20) : gw.area(k, v(i * 5, 0, 5), 2.6, t / 20)); gw.update(DT); }
    gw.update(DT);   // (untouched: let go)
    for (const k of keys) gw.impact('lob', v(), 1.3);
    for (let t = 0; t < 30; t++) gw.update(DT);
  }
  assert.ok(gw.stats.made <= keys.length, `${gw.stats.made} warnings made for 240 shown`);
  assert.ok(gw.freeBursts.length <= keys.length && gw.bursts.length === 0, 'bursts back in their pool');
  assert.equal(gw.live.size, 0, 'nothing left drawn');
  assert.equal(gw.strokes.mesh.instanceMatrix.count, CAP.strokes, 'the buffers keep their size');
  assert.equal(gw.strokes.mesh.visible, false, 'an idle pool is hidden (no draw)');
  const rays = gw.stats.rays;
  gw.lob({}, v(0, 0, 0), 1.4, 0.5); gw.update(DT);
  const first = gw.stats.rays - rays;
  for (let i = 0; i < 10; i++) { gw.lob({}, v(0, 0, 0), 1.4, 0.5); gw.update(DT); }
  assert.ok(gw.stats.rays - rays === first, `the ground sampled once (${first} rays), then cached`);
  gw.dispose();
});

// ---- in the fight: the warnings come and go with the attacks
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function field() {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, rolling: false,
    hurt() { this.hurts++; }, knockDown() { return true; }, flinch() {}, stagger() {}, guarding() { return false; }, guard() { return false; }, dodge() { return false; } };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded() });
  foes.waveRest = 1e9;
  return { foes, P, done: () => { foes.dispose(); clearTargets(); } };
}

test('timing: a lob’s mark is drawn every frame of its wind-up and not a frame after; its grit lands at the strike', () => {
  const { foes, P, done } = field();
  const g = foes.add('grunt', v(0, 0, 8)), rock = FOES.grunt.attacks.find((x) => x.id === 'rock');
  g.attacksAt = () => [rock];
  let winds = 0, wrong = 0, burst = false, R = null;
  for (let i = 0; i < 6 / DT; i++) {
    const was = g.state;
    foes.update(DT); P.health = 1;
    const wind = g.state === 'wind' && g.atk?.id === 'rock';
    if (wind) { winds++; R = foes.gw.of(g)[0]?.R; }
    if (foes.gw.has(g) !== wind) wrong++;
    if (was === 'wind' && g.state !== 'wind' && foes.gw.bursts.some((b) => b.kind === 'lob')) burst = true;
  }
  assert.ok(winds > rock.wind / DT * 0.8, `wound up (${winds} frames)`);
  assert.equal(wrong, 0, 'drawn exactly over its wind-ups');
  assert.equal(R, rock.radius, 'at the hit’s radius');
  assert.ok(burst, 'its grit at the impact');
  done();
});

test('timing: the crawler’s fuse draws its reach while it burns; the blast flower at the blast; a shockwave is drawn as long as it runs', () => {
  const { foes, P, done } = field();
  const c = foes.add('crawler', v(0, 0, 4)); c.heading = Math.PI;
  const blast = FOES.crawler.attacks.find((x) => x.id === 'blast');
  for (let i = 0; i < 12; i++) foes.update(DT);
  foes.hurt(c, 'blade', v(0, 0, 1), { damage: 2, combo: 2 });
  let fuse = 0, wrong = 0, R = null, flower = false;
  for (let i = 0; i < (blast.wind + 5) / DT; i++) {
    foes.update(DT); P.health = 1;
    const wind = c.alive && c.state === 'wind' && c.atk?.id === 'blast';
    if (wind) { fuse++; R = foes.gw.of(c)[0]?.R; }
    if (foes.gw.has(c) !== wind) wrong++;
    flower ||= foes.gw.bursts.some((b) => b.kind === 'area');
  }
  assert.ok(fuse > blast.wind / DT * 0.9, `its fuse drawn (${fuse} frames)`);
  assert.equal(wrong, 0, 'drawn exactly over its fuse');
  assert.equal(R, blast.radius, 'at the blast’s radius');
  assert.ok(flower, 'the blast flower');
  // a shockwave: drawn while it runs, gone at its reach
  const W = { speed: 7, reach: 8, damage: 0.5, width: 0.55 };
  foes.ringOut(null, W, v(20, 0, 20), 2);
  const s = foes.shocks.at(-1);
  let frames = 0;
  while (foes.shocks.includes(s)) { foes.update(DT); P.health = 1; if (foes.shocks.includes(s)) { assert.ok(foes.gw.has(s), `drawn at r ${s.r.toFixed(2)}`); assert.equal(foes.gw.of(s)[0].r, s.r, 'its front is the hit’s'); frames++; } }
  foes.update(DT);
  assert.ok(!foes.gw.has(s), 'gone at its reach');
  assert.ok(foes.gw.bursts.some((b) => b.kind === 'wave' && b.R === W.reach), 'a scored ring left at its reach');
  assert.ok(Math.abs(frames - Math.floor((W.reach - 2) / W.speed / DT)) <= 1, `${frames} frames for a ${((W.reach - 2) / W.speed).toFixed(2)} s run`);
  done();
});
