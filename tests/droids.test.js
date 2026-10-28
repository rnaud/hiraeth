// The makers' defunct droids (issue #726, docs/design/enemy-roster-v4.md; docs/systems/foes.md "The makers' droids"):
// the sentinel (a duellist on the humanoid rig's clips), the oracle (a hovering caster: the rig's upper body over a shell)
// and the crawler (a knee-high dome on four legs, on the kit). Every move maps to a clip, a pose or a kit gait; their
// wind-ups are pinned; the sentinel's guard answers a masher; the oracle's ward and wake, its blink; the crawler's call
// and its blast; their tier's look (the same, #748); what each costs; and each one's signature move seen against a masher.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { ARCHETYPES, BUILT } from '../src/enemies/archetypes.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { surfaceFor } from '../src/enemies/surfaces.js';
import { FIGHT, TIERS, RAGE } from '../src/enemies/fight.js';
import { WORLDS, worldArchetypes } from '../src/foe-worlds.js';
import { ORDER, SIDE, partsOf } from '../src/levels/names.js';
import { Foes, FOES, ARENA_WAVES, STING } from '../src/foes.js';
import { foeSections } from '../src/foe-spawner.js';
import { windMin } from '../src/telegraph.js';
import { PROC_POSES } from '../src/enemies/humanoid-rig.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { SENTINEL_MOVES, SENTINEL_BODY } from '../src/enemies/plans/sentinel.js';
import { ORACLE_MOVES } from '../src/enemies/plans/oracle.js';
import { CRAWLER_SIZE } from '../src/enemies/plans/crawler.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const DROIDS = ['sentinel', 'oracle', 'crawler'];
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(o = {}) {
  return { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, knocks: 0, rolling: false,
    hurt() { this.hurts++; }, knockDown() { this.knocks++; return true; }, flinch() {}, stagger() {}, guarding() { return false; }, guard() { return false; },
    dodge() { return this.rolling; }, ...o };
}
function field(o = {}) {
  clearTargets();
  const P = player(o);
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: o.rng });
  return { foes, P, done: () => { foes.dispose(); clearTargets(); } };
}
const run = (foes, s, each) => { for (let i = 0; i < Math.round(s / DT); i++) { each?.(i); foes.update(DT); } };
const FRONT = v(0, 0, 1);
const light = (n = 0) => ({ damage: 1, combo: n });
const CHARGED = { damage: 2, combo: 2, breaks: true, charged: false };
// (the clips the rig plays: the captured moves' names in public/anim/moves.glb, read from its JSON chunk)
const clipNames = (() => { const b = readFileSync(new URL('../public/anim/moves.glb', import.meta.url)); const n = b.readUInt32LE(12); return new Set(JSON.parse(b.subarray(20, 20 + n).toString()).animations.map((a) => a.name.replace(/^mixamo_/, ''))); })();

test('the droids on the roster: three built machines drawn to their picked sheets, in the Arena and the gallery, and in the route worlds (#726)', () => {
  for (const a of DROIDS) {
    const A = ARCHETYPES[a];
    assert.equal(A.status, 'built'); assert.ok(BUILT.includes(a)); assert.equal(A.kind, a); assert.equal(A.family, 'machine');
    assert.equal(A.art, 'sheet-1'); assert.equal(A.roster, 'v4');
    assert.ok(existsSync(new URL(`../references/enemy-archetypes/${a}/sheet-1.jpg`, import.meta.url)), `${a}: its sheet`);
    assert.ok(ORDER.filter((w) => partsOf(w).some((p) => worldArchetypes(p).includes(a))).length >= { crawler: ORDER.length, sentinel: 9, oracle: 6 }[a], `${a}: met along the route`);
    assert.ok(SIDE.every((w) => !worldArchetypes(w).includes(a)), `${a}: not in a discarded world`);
    assert.equal(Object.keys(SKINS[a]).length, 1, `${a}: one skin, worn in every world`);
    assert.ok(ARENA_WAVES.some((w) => w.every((k) => k.startsWith(`${a}@`))), `${a}: an Arena wave of its own`);
    assert.ok(foeSections()[0].items.some((i) => i.kind.startsWith(`${a}@`)), `${a}: in the Arena's foe list`);
  }
  assert.equal(ARCHETYPES.oracle.ranged, true);
});

test('every move maps to a clip, a pose or a kit gait, and every wind-up is pinned and fair', () => {
  // (s: the wind-up of each move, as tuned; a change here is a change to how the fight reads)
  const WIND = {
    sentinel: { thrust: 0.75, cut: 0.95, bash: 0.95, dash: 0.75, riposte: 0.5 },
    oracle: { volley: 1.0, volley2: 0.45, volley3: 0.45, ward: 0.9, wake: 1.0, pulse: 0.95 },
    crawler: { bite: 0.7, call: 0.9, blast: 1.7 },
  };
  for (const a of DROIDS) {
    const D = FOES[a];
    assert.deepEqual(Object.fromEntries(D.attacks.map((x) => [x.id, x.wind])), WIND[a], `${a}: its wind-ups`);
    for (const x of D.attacks) assert.ok(x.wind >= windMin(x) - 1e-9, `${a}.${x.id}: ${x.wind} s ≥ ${windMin(x)} s`);
  }
  for (const [id, M] of Object.entries(SENTINEL_MOVES)) {
    assert.ok(FOES.sentinel.attacks.some((x) => x.id === id), `sentinel: ${id} is one of its moves`);
    assert.ok(clipNames.has(M.clip), `sentinel.${id}: its clip ${M.clip} is in the library`);
    if (M.pose) assert.ok(PROC_POSES[M.pose], `sentinel.${id}: its pose ${M.pose}`);
    assert.ok(M.from <= M.load && M.load <= M.cut && M.cut <= M.to, `sentinel.${id}: from ≤ load ≤ cut ≤ to`);
  }
  for (const x of FOES.sentinel.attacks) assert.ok(SENTINEL_MOVES[x.id], `sentinel.${x.id}: a clip`);
  for (const x of FOES.oracle.attacks) assert.ok(PROC_POSES[ORACLE_MOVES[x.id]?.pose], `oracle.${x.id}: a pose of its arms`);
  assert.ok(clipNames.has('ss_block_idle'), 'the sentinel guards on the sword-and-shield block idle');
  // (the crawler: the kit's trot; each move its plan's pose, its own where it must read apart from the bite)
  const C = PLANS.crawler.poses;
  assert.equal(PLANS.crawler.gait.gait, 'alternate');
  for (const k of ['coil', 'strike', 'recover', 'hurt', 'coil:call', 'coil:blast']) assert.ok(C[k], `crawler: its ${k} pose`);
  assert.ok(C['coil:call'].pitch < -0.5 && C['coil:call'].y > 0.2, 'the call: reared up');
  assert.ok(C['coil:blast'].y < 0 && C['coil:blast'].spread > 1.2, 'the fuse: squatting braced');
  // (sizes: the sentinel 2 m, the crawler knee-high)
  assert.ok(Math.abs(SENTINEL_BODY.hip + SENTINEL_BODY.chest + SENTINEL_BODY.neck + 0.42 - 2.0) < 0.05);
  assert.ok(CRAWLER_SIZE.top < 0.7);
});

test('the sentinel answers a masher: two light cuts in a row and its shield is up; the third is parried and answered with its riposte', () => {
  const { foes, P, done } = field();
  const f = foes.add('sentinel', v(0, 0, 2.4)); f.heading = Math.PI; f.cool = 5;
  f.guardRest = 5;   // (its own guard resting: only the cuts raise it)
  run(foes, 0.3);
  const hp = f.hp;
  foes.hurt(f, 'blade', FRONT, light(0)); run(foes, 0.3);
  assert.ok(f.guardK < 0.6, 'one cut: no guard yet');
  foes.hurt(f, 'blade', FRONT, light(1)); run(foes, 0.05);
  assert.equal(f.guardK, 1, 'the second cut: the shield is up at once');
  assert.equal(f.hp, hp - 2, 'both cuts landed');
  assert.equal(f.stungUp, 1);
  const r = foes.hurt(f, 'blade', FRONT, light(2));
  assert.equal(f.hp, hp - 2, 'the third is turned');
  run(foes, 0.05);
  assert.equal(f.state, 'wind'); assert.equal(f.atk.id, 'riposte', `answered with its riposte (${r})`);
  run(foes, 1.5);
  assert.ok(P.hurts >= 1, 'which lands on a traveller who keeps standing there');
  // (cuts further apart than STING.gap never raise it)
  const g = foes.add('sentinel', v(3, 0, 2.4)); g.heading = Math.PI; g.cool = 9; g.guardRest = 9;
  foes.hurt(g, 'blade', FRONT, light(0)); run(foes, STING.gap + 0.1, () => { g.cool = 9; g.guardRest = 9; });
  foes.hurt(g, 'blade', FRONT, light(1)); run(foes, 0.05);
  assert.ok(g.guardK < 0.6 && !g.stungUp, 'slow cuts: no snap');
  // (a charged cut throws it wide as ever)
  g.guardRest = 0; g.guardK = 1; g.state = 'chase';
  foes.hurt(g, 'blade', FRONT, { ...CHARGED });
  assert.equal(g.reel, 'guardbroken', 'thrown wide');
  done();
});

test('the sentinel overloads at low health (quicker), keeps its recovery after a miss short, and dashes from afar', () => {
  assert.equal(FIGHT.sentinel.low.kind, 'enrage');
  for (const x of FOES.sentinel.attacks.filter((x) => !x.chain)) assert.ok((x.recover ?? FOES.sentinel.recover) <= 0.8, `${x.id}: back on guard within 0.8 s`);
  const dash = FOES.sentinel.attacks.find((x) => x.id === 'dash');
  assert.ok(dash.lunge >= 5 && dash.min >= 3, 'a rush from a few metres off');
  const { foes, done } = field();
  const f = foes.add('sentinel', v(0, 0, 2.4)); f.heading = Math.PI;
  const wind = f.windFor(dash);
  foes.hurt(f, 'blade', FRONT, { damage: f.hp - 2 });
  assert.ok(f.rage, 'overloaded');
  assert.ok(f.windFor(dash) < wind && f.windFor(dash) >= RAGE.min - 1e-9, `its dash quicker (${wind} → ${f.windFor(dash).toFixed(2)} s)`);
  done();
});

test('the oracle wards a packmate: half harm, no staggers, its beam cut half-way ends it; its bolts come in threes', () => {
  const { foes, done } = field();
  const o = foes.add('oracle', v(0, 0, 9)), s = foes.add('sentinel', v(2, 0, 4));
  o.cool = 0;
  run(foes, 0.1);
  assert.ok(o.allies.includes(s), 'it sees its packmate');
  const ward = FOES.oracle.attacks.find((x) => x.id === 'ward');
  assert.ok(o.attacksAt(9).includes(ward), 'its ward offered with a packmate near');
  o.state = 'chase'; o.beginWind(ward, foes.player);
  for (let i = 0; i < 240 && !s.ward; i++) foes.update(DT);   // (its alert beat first, then the wind-up)
  assert.ok(s.ward?.by === o, 'the sentinel is warded');
  assert.equal(o.wards.length, 1);
  assert.ok(!o.attacksAt(9).includes(ward), 'one ward at a time');
  const hp = s.hp; s.guardRest = 9; s.guardK = 0;
  s.state = 'recover'; s.timer = 1;   // (out of its own guard and blows: the ward alone)
  foes.hurt(s, 'blade', v(0, 0, -1), { damage: 2, combo: 2 });
  assert.equal(s.hp, hp - 1, 'half the harm');
  foes.cutWard(s);
  assert.ok(s.ward === null, 'its beam cut: gone');
  // (the volley: three bolts, the 2nd and 3rd quick, each a perfect parry sends back)
  const V = FOES.oracle.attacks.filter((x) => x.id.startsWith('volley'));
  assert.deepEqual(V.map((x) => x.then ?? null), ['volley2', 'volley3', null]);
  assert.ok(V.every((x) => x.onParry === 'reflect' && x.shape === 'lane'));
  done();
});

test('the oracle wakes sleeping droids, and only calls when one sleeps; the crawler rears and calls the same way', () => {
  let seed = 4242;
  const { foes, done } = field({ rng: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });   // (seeded: a patrol's wander is the same each run)
  // (the sleeper further than its pack's alarm, ALERT.pack 14 m, from the oracle: only its call reaches it)
  const o = foes.add('oracle', v(0, 0, 8)), c = foes.add('crawler', v(0, 0, 23.5), { calm: true });
  run(foes, 0.1);
  assert.equal(c.provoked, false, 'the crawler asleep on its round');
  assert.ok(o.sleeper, 'the oracle sees one asleep');
  const wake = FOES.oracle.attacks.find((x) => x.id === 'wake');
  assert.ok(o.attacksAt(8).includes(wake));
  o.state = 'chase'; o.beginWind(wake, foes.player);
  for (let i = 0; i < 240 && !c.provoked; i++) foes.update(DT);
  assert.ok(c.provoked, 'woken by its call');
  run(foes, 0.1);
  assert.ok(!o.sleeper && !o.attacksAt(8).includes(wake), 'none left asleep: no call');
  // the crawler's call: the same, from a scout
  const k = foes.add('crawler', v(-4, 0, 6)), z = foes.add('sentinel', v(-4, 0, 21.5), { calm: true });
  run(foes, 0.1);
  const call = FOES.crawler.attacks.find((x) => x.id === 'call');
  assert.ok(k.attacksAt(5).includes(call));
  k.state = 'chase'; k.beginWind(call, foes.player);
  for (let i = 0; i < 240 && !z.provoked; i++) foes.update(DT);
  assert.ok(z.provoked, 'the sentinel it called is up');
  done();
});

test('the oracle flees at low health and blinks a few metres further off', () => {
  const { foes, done } = field();
  const o = foes.add('oracle', v(0, 0, 4));
  run(foes, 0.2);
  const d0 = o.pos.distanceTo(foes.player.pos);
  foes.hurt(o, 'blade', FRONT, { damage: o.hp - 1 });
  run(foes, DT);
  assert.equal(o.blinked, 1, 'it blinked');
  assert.ok(o.pos.distanceTo(foes.player.pos) >= d0 + FIGHT.oracle.low.blink * 0.8, `further off (${d0.toFixed(1)} → ${o.pos.distanceTo(foes.player.pos).toFixed(1)} m)`);
  assert.ok(o.fleeT > 0, 'and runs');
  done();
});

test('the crawler self-destructs at low health: a fuse it runs at you with, a blast you can roll out of, gone after; finished first, it fizzles', () => {
  const { foes, P, done } = field();
  const c = foes.add('crawler', v(0, 0, 4)); c.heading = Math.PI;
  run(foes, 0.2);
  foes.hurt(c, 'blade', FRONT, { damage: 2, combo: 2 });
  assert.ok(c.hp > 0, 'a blow that would end it leaves a sliver: its last move is seen');
  let fused = false;
  run(foes, 4, () => { if (c.state === 'wind' && c.atk?.id === 'blast') fused = true; });   // (down a moment first: its poise broke)
  assert.ok(fused, 'its fuse burns');
  const blast = FOES.crawler.attacks.find((x) => x.id === 'blast');
  run(foes, blast.wind + 1);
  assert.ok(!c.alive || c.state === 'dead', 'gone in its blast');
  assert.equal(P.hurts, 1, 'caught standing in it');
  // (rolled out of: the evade's frames swallow it)
  { const { foes, P, done } = field({ rolling: true });
    const c = foes.add('crawler', v(0, 0, 3)); c.heading = Math.PI; run(foes, 0.2);
    foes.hurt(c, 'blade', FRONT, { damage: 2, combo: 2 }); run(foes, blast.wind + 2);
    assert.equal(P.hurts, 0, 'rolled out'); done(); }
  // (finished during its fuse: a plain burst, no blast)
  { const { foes, P, done } = field();
    const c = foes.add('crawler', v(0, 0, 3)); c.heading = Math.PI; run(foes, 0.2);
    foes.hurt(c, 'blade', FRONT, { damage: 2, combo: 2 });
    for (let i = 0; i < 300 && !(c.state === 'wind' && c.atk?.id === 'blast'); i++) foes.update(DT);
    assert.ok(c.state === 'wind' && c.atk?.id === 'blast', 'its fuse lit');
    foes.hurt(c, 'blade', FRONT, light(0));
    assert.ok(c.hp <= 0, 'cut down in its fuse');
    run(foes, blast.wind + 1);
    assert.equal(P.hurts, 0, 'it fizzled'); done(); }
  done();
});

test('their stronger tier: the same ivory ceramic and amber eye (one look, #748); one new move each', () => {
  for (const a of DROIDS) {
    const base = skinOf(a, 'desert');
    assert.equal(base.palette.eye, '#ffa51f', `${a}: the amber eye`);
    assert.ok(surfaceFor(a, base, 'ceramic').mottle && !surfaceFor(a, base, 'ceramic').cracks, `${a}: stained, uncracked`);
    assert.ok(TIERS[a].combo, `${a}: its tier's new move`);
    const { foes, done } = field();
    const t = foes.add(`${a}*`, new THREE.Vector3(0, 0, 9));
    assert.equal(t.tierN, 1, `${a}: in tier`);
    assert.equal(t.model.eyeMat.uniforms.uColor.value.getHexString(), 'ffa51f', `${a}: drawn with its amber eye in tier`);
    done();
  }
});

test('what each costs: a handful of draws, and a frame of its pose in well under a millisecond in node', () => {
  // (draws: one skinned mesh a material on the rig's or the kit's joints, the eye and the casts apart)
  const MAX = { sentinel: 7, oracle: 12, crawler: 6 };
  const ms = {};
  for (const a of DROIDS) {
    const m = archetypeModel(a, 'desert');
    let n = 0; m.group.traverse((o) => { if (o.isMesh) n++; });
    assert.ok(n <= MAX[a], `${a}: ${n} meshes`);
    m.dispose?.();
    const { foes, done } = field();
    const f = foes.add(a, v(0, 0, 4));
    run(foes, 0.5);
    const t = [];
    for (let i = 0; i < 200; i++) { const t0 = performance.now(); foes.look(f, DT); t.push(performance.now() - t0); }
    t.sort((x, y) => x - y); ms[a] = t[100];
    assert.ok(ms[a] < 1, `${a}: ${ms[a].toFixed(3)} ms a frame`);
    done();
  }
  console.log(`  pose cost (Foes.look, node, median): ${Object.entries(ms).map(([a, x]) => `${a} ${x.toFixed(3)} ms`).join(', ')}`);
});

test('against a masher in a pack, each droid’s signature move fires: the sentinel’s riposte, the oracle’s ward and volley, the crawler’s blast', () => {
  const seen = { sentinel: new Set(), oracle: new Set(), crawler: new Set() };
  for (let seed = 1; seed <= 3; seed++) {
    let s = seed * 7919;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const { foes, P, done } = field({ rng });
    P.health = 99;
    [['sentinel', 0, 5], ['oracle', 3, 10], ['crawler', -3, 6], ['crawler', 4, 7]].forEach(([k, x, z]) => foes.add(k, v(x, 0, z)));
    // (the masher: runs at the nearest, a light cut every 0.35 s at whatever is within 2.8 m in front, never guards or rolls)
    let t = 0, combo = 0;
    for (let i = 0; i < 60 * 45; i++) {
      const live = foes.list.filter((f) => f.alive && f.dead === undefined && !f.dying);
      if (!live.length) break;
      const near = live.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0], d = near.pos.distanceTo(P.pos);
      const dir = near.pos.clone().sub(P.pos).setY(0).normalize();
      P.heading = Math.atan2(dir.x, dir.z);
      if (d > 1.8) P.pos.addScaledVector(dir, 4 * DT);
      if ((t += DT) >= 0.35 && d < 2.8) { t = 0; foes.hurt(near, 'blade', dir, light(combo)); combo = (combo + 1) % 3; }
      foes.update(DT);
      for (const f of foes.list) if (f.state === 'wind' && f.atk && seen[f.kind]) seen[f.kind].add(f.atk.id);
    }
    done();
  }
  console.log(`  seen against the masher: ${Object.entries(seen).map(([k, x]) => `${k} ${[...x].join('/')}`).join('; ')}`);
  assert.ok(seen.sentinel.has('riposte'), `the sentinel ripostes a masher (${[...seen.sentinel]})`);
  assert.ok(seen.oracle.has('ward') && seen.oracle.has('volley'), `the oracle wards and fires (${[...seen.oracle]})`);
  assert.ok(seen.crawler.has('blast'), `a crawler self-destructs (${[...seen.crawler]})`);
});
