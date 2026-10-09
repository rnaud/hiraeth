import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, Foes, FOES, STRIKE_RISE } from '../src/foes.js';
import { GUARD, BLADE_TOUCH, bladeTouchRadius, inGuard } from '../src/fluid-blade.js';
import { inArea } from '../src/temples/boss.js';
import { BOMB } from '../src/gadgets/bomb.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { collectHitboxes, foeHitboxes, playerHitboxes, gadgetHitboxes, registerHitboxes, hitboxes, HITBOX_COLORS } from '../src/hitboxes.js';
import { HitboxBuilder } from '../src/hitbox-overlay.js';
import { Controller } from '../src/controller.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
const env = { ground: () => 0, seen: () => true };
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };

/** Is p inside a drawn shape, reading only the shape's own fields (what the overlay draws)? */
function insideShape(s, p) {
  const dx = p.x - s.c.x, dz = p.z - s.c.z, d = Math.hypot(dx, dz);
  if (s.kind === 'circle') return d < s.r;
  if (s.kind === 'fan') {
    if (d < 0.01) return true;
    if (d > s.range) return false;
    const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - s.h), Math.cos(Math.atan2(dx, dz) - s.h));
    return Math.abs(da) < s.angle;
  }
  if (s.kind === 'lane') {
    const f = [Math.sin(s.h), Math.cos(s.h)], along = dx * f[0] + dz * f[1], side = Math.abs(dx * f[1] - dz * f[0]);
    return along > -s.back && along < s.range && side < s.width / 2;
  }
  throw new Error(s.kind);
}
const attackShape = (f) => foeHitboxes(f).find((s) => s.tag.startsWith('foe.attack.'));

test('a foe\'s strike is drawn where, and as big as, the combat code tests it: telegraph, then active, then spent', () => {
  for (const kind of ['blot', 'machine', 'skitter', 'shade']) {
    const f = new Foe(kind, v(), { rng: () => 0.5 }); f.state = 'chase'; f.cool = 0; f.heading = 0.7;
    const P = { pos: v(Math.sin(0.7) * (f.def.reach - 0.2), 0, Math.cos(0.7) * (f.def.reach - 0.2)) };
    f.update(dt, P, env);
    assert.equal(f.state, 'wind', kind);
    let s = attackShape(f);
    assert.equal(s.phase, 'telegraph'); assert.equal(s.color, HITBOX_COLORS.telegraph);
    const a = f.def.attack;
    assert.equal(s.kind, { ring: 'circle', cone: 'fan', lane: 'lane' }[a.shape]);
    // sampled points: inside the drawn shape exactly when inArea says the strike would land there
    for (let i = 0; i < 400; i++) {
      const p = v(Math.sin(i * 2.4) * (i % 23) * 0.5, 0, Math.cos(i * 2.4) * (i % 23) * 0.5).add(f.attackOrigin());
      assert.equal(insideShape(s, p), inArea(a, f.attackOrigin(), f.attackH, p), `${kind} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    }
    // through the strike: active until its one check, then spent; a lunge's area travels with the body
    let phases = new Set(), struck = 0;
    for (let i = 0; i < 300 && f.state !== 'recover'; i++) {
      const ev = f.update(dt, P, env);
      if (ev.some((e) => e.type === 'strike')) { struck++; assert.notEqual(attackShape(f)?.phase, 'active', 'checked: no longer active'); }
      s = attackShape(f);
      if (s) {
        phases.add(s.phase);
        assert.ok(s.c.distanceTo(v(f.attackOrigin().x, f.pos.y, f.attackOrigin().z)) < 1e-9, `${kind}: drawn at the strike's origin`);
        if (a.lunge) assert.ok(Math.hypot(s.c.x - f.pos.x, s.c.z - f.pos.z) < 1e-9, 'a lunge carries its ring with it');
      }
    }
    assert.equal(struck, 1, kind);
    assert.ok(phases.has('active') && phases.has('spent'), `${kind}: ${[...phases]}`);
    assert.equal(attackShape(f), undefined, 'recovering: nothing to draw');
  }
});

test('every attack of the worlds\' kinds lands exactly where it is drawn: areas, lobs, flashes, lunges and charges', async () => {
  const { KINDS } = await import('../src/foe-kinds.js');
  const { mulberry32 } = await import('../src/noise.js');
  const rng = mulberry32(9);
  const live = (f) => foeHitboxes(f).filter((s) => s.tag === 'foe.attack.active' || s.tag === 'foe.attack.telegraph');
  for (const kind of Object.keys(KINDS)) for (const a0 of FOES[kind].attacks) {
    if (!(a0.damage > 0)) continue;
    let n = 0, hits = 0;
    for (let trial = 0; trial < 60; trial++) {
      const f = new Foe(kind, v(), { rng: mulberry32(trial) });
      const start = a0.chain ? FOES[kind].attacks.find((x) => x.then === a0.id) : a0;
      f.attacksAt = () => [start];
      f.state = 'chase'; f.cool = 0; f.buried = false; f.heading = 0;
      const lo = Math.max(start.min ?? 0, (f.def.keep ?? 0) + 0.3), hi = start.max ?? f.def.reach;
      const P = { pos: v(0, 0, lo > 2 ? (lo + hi) / 2 : Math.min(hi, 2)) };
      f.update(dt, P, env);
      assert.equal(f.state, 'wind', `${kind}.${start.id} winds up`);
      let moved = false, touched = false, result = null;
      for (let i = 0; i < 600 && result === null; i++) {
        const a = f.atk, mine = a.id === a0.id;
        // once its area holds (past any tracking), the traveller steps somewhere round it
        if (!moved && mine && f.state === 'wind' && (!a.track || f.k > a.track + 0.05)) {
          const c = f.attackOrigin(), r = 0.3 + rng() * ((a.range ?? a.radius ?? 3) + 2.5), t = rng() * Math.PI * 2;
          P.pos.set(c.x + Math.sin(t) * r, 0, c.z + Math.cos(t) * r); moved = true;
        }
        const before = mine ? live(f) : [];
        const ev = f.update(dt, P, env);
        if (mine && f.state === 'strike' && live(f).some((s) => s.phase === 'active' && insideShape(s, P.pos))) touched = true;
        const e = ev.find((x) => x?.type === 'strike' && x.atk.id === a0.id);
        if (!e) continue;
        // an instant one is checked against its last telegraph; a strike against its shape as drawn on the frame it is checked
        const drawn = a0.instant || a0.at === 'target' ? before : foeHitboxes(f).filter((s) => s.tag.startsWith('foe.attack.'));
        result = { hit: e.hit, inside: (a0.sweep && touched) || drawn.some((s) => insideShape(s, P.pos)) };
      }
      if (!result) continue;
      n++; if (result.hit) hits++;
      assert.equal(result.inside, result.hit, `${kind}.${a0.id} trial ${trial}: the traveller at ${P.pos.x.toFixed(2)}, ${P.pos.z.toFixed(2)}, the foe at ${f.pos.x.toFixed(2)}, ${f.pos.z.toFixed(2)}`);
    }
    assert.ok(n > 40 && hits > 0 && hits < n, `${kind}.${a0.id}: ${hits} of ${n} landed`);
  }
});

test('a charge (a sky ray\'s skim, a crab\'s spin): its lane while it winds up; then the circle round its body that hits, the lane kept faint', () => {
  for (const kind of ['ray', 'crab']) {
    const a = FOES[kind].attacks.find((x) => x.sweep);
    const f = new Foe(kind, v(), { rng: () => 0.5 }); f.attacksAt = () => [a]; f.state = 'chase'; f.cool = 0; f.heading = 0; f.buried = false; f.hid = true;   // (a flyer: no hiding first)
    const P = { pos: v(0, 0, 5) };
    f.update(dt, P, env);
    assert.equal(attackShape(f).kind, 'lane');
    assert.equal(attackShape(f).width, a.width);
    while (f.state === 'wind') f.update(dt, P, env);
    for (let i = 0; i < 6; i++) f.update(dt, P, env);
    const shapes = foeHitboxes(f), body = shapes.find((s) => s.tag === 'foe.attack.active' || s.tag === 'foe.attack.spent'), path = shapes.find((s) => s.tag === 'foe.charge.path');
    assert.equal(body.kind, 'circle'); assert.equal(body.r, a.width / 2, `${kind}: as wide as its lane`);
    assert.ok(Math.hypot(body.c.x - f.pos.x, body.c.z - f.pos.z) < 1e-9, 'round the body as it runs');
    assert.ok(path && path.c.z < f.pos.z - 0.5, 'the lane where it set off');
  }
});

test('a bellows toad\'s lobbed glob: the ring where you stood, telegraphed, checked as its wind-up ends', () => {
  const f = new Foe('toad', v(), { rng: () => 0.5 }); f.state = 'chase'; f.cool = 0;
  const P = { pos: v(0, 0, 8) };
  f.update(dt, P, env);
  const s = attackShape(f);
  assert.equal(s.kind, 'circle'); assert.equal(s.r, FOES.toad.attack.radius);
  assert.ok(s.c.distanceTo(v(0, 0, 8)) < 1e-9, 'where the traveller stood');
});

test('a foe\'s hurt sphere is its registered target\'s, the blade ring that plus BLADE_TOUCH; ranges and label', () => {
  clearTargets();
  const P = { pos: v(0, 0, 50), vel: v(), frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  for (const kind of Object.keys(FOES)) {
    const f = foes.add(kind, v(3, 0, 0));
    const t = allTargets().find((x) => x.foe === f);
    const shapes = foeHitboxes(f);
    const hurt = shapes.find((s) => s.tag === 'foe.hurt'), touch = shapes.find((s) => s.tag === 'foe.bladeTouch');
    assert.equal(hurt.r, t.radius, kind); assert.ok(hurt.c.distanceTo(t.position()) < 1e-9);
    assert.equal(touch.r, bladeTouchRadius(t)); assert.equal(touch.r, t.radius + BLADE_TOUCH);
    assert.equal(shapes.find((s) => s.tag === 'foe.sight').r, FOES[kind].sight);
    assert.equal(shapes.find((s) => s.tag === 'foe.reach').r, FOES[kind].reach);
    assert.equal(!!shapes.find((s) => s.tag === 'foe.keep'), !!FOES[kind].keep);
  }
  const f = foes.list[0];
  f.stunned = 1.5; assert.match(foeHitboxes(f).find((s) => s.tag === 'foe.label').text, /stunned 1\.5s/);
  f.stunned = 0; f.staggered(true); assert.match(foeHitboxes(f).find((s) => s.tag === 'foe.label').text, /parried/);
  f.hit('blade', v(0, 0, 1), { damage: 1 }); assert.match(foeHitboxes(f).find((s) => s.tag === 'foe.label').text, /flinched|staggered/);
  foes.dispose(); clearTargets();
});

test('the traveller\'s column is the height window a strike reaches', () => {
  const up = v(0, 1, 0), P = { pos: v(0, 2, 0), frame: { up } };
  const col = playerHitboxes({ player: P }).find((s) => s.tag === 'player.hurt');
  assert.equal(col.h1, STRIKE_RISE); assert.equal(col.h0, -STRIKE_RISE);
  for (const dy of [-1.7, -1.5, 0, 1.5, 1.7]) {
    const f = new Foe('blot', v(0, 2 + dy, -1.5)); f.state = 'wind'; f.attackH = 0; f.timer = 1;
    const hits = [];
    for (let i = 0; i < 60; i++) hits.push(...f.update(dt, { pos: P.pos }, { seen: () => true }).filter((e) => e.type === 'strike'));
    assert.equal(hits[0].hit, Math.abs(-dy) < col.h1, `foe ${dy} m from the feet`);
  }
});

test('the guard: its arc is GUARD.angle round the guard\'s way, white while a parry would land', () => {
  const up = v(0, 1, 0), P = { pos: v(), frame: { up } };
  const blade = { guardK: 1, guarding: true, parryLive: true, guardAge: 0.05, dir: v(1, 0, 0), swinging: false };
  let s = playerHitboxes({ player: P, tool: { blade } }).find((x) => x.tag.startsWith('guard.') && x.kind === 'fan');
  assert.equal(s.tag, 'guard.parry'); assert.equal(s.color, HITBOX_COLORS.parry); assert.equal(s.angle, GUARD.angle);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, from = v(Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2);
    if (Math.abs(Math.abs(Math.atan2(Math.sin(a - s.h), Math.cos(a - s.h))) - GUARD.angle) < 0.02) continue;   // (on the edge)
    assert.equal(insideShape({ ...s, c: v() }, from), inGuard(P.pos, blade.dir, from), `from ${(a * 57.3).toFixed(0)}°`);
  }
  blade.parryLive = false;
  s = playerHitboxes({ player: P, tool: { blade } }).find((x) => x.kind === 'fan');
  assert.equal(s.tag, 'guard.up'); assert.equal(s.color, HITBOX_COLORS.guard);
  // with the shield drawn, the arc it covers as drawn (src/shield.js), the same one block() tests
  blade.guardArc = { dir: v(0.6, 0, 0.8), half: 0.7 };
  s = playerHitboxes({ player: P, tool: { blade } }).find((x) => x.kind === 'fan');
  assert.equal(s.angle, 0.7);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, from = v(Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2);
    if (Math.abs(Math.abs(Math.atan2(Math.sin(a - s.h), Math.cos(a - s.h))) - 0.7) < 0.02) continue;
    assert.equal(insideShape({ ...s, c: v() }, from), inGuard(P.pos, blade.guardArc.dir, from, 0.7), `shield arc from ${(a * 57.3).toFixed(0)}°`);
  }
});

test('bombs show their blast reach; a registered source adds its own shapes; the switch', () => {
  const gadgets = { inst: new Map([['bomb', { live: [{ pos: v(1, 0, 2), fuse: 1.2 }] }]]) };
  const out = gadgetHitboxes(gadgets);
  assert.equal(out.find((s) => s.tag === 'bomb.blast').r, BOMB.radius);
  assert.equal(out.find((s) => s.tag === 'bomb').r, BOMB.r);
  const off = registerHitboxes((o) => o.push({ kind: 'sphere', c: v(), r: 1, color: '#fff', tag: 'mine' }));
  assert.ok(collectHitboxes({ player: null }).some((s) => s.tag === 'mine'));
  off(); assert.ok(!collectHitboxes({ player: null }).some((s) => s.tag === 'mine'));
  const seen = [];
  const stop = hitboxes.listen((on) => seen.push(on));
  hitboxes.set(false); hitboxes.toggle(); hitboxes.toggle(); stop();
  assert.deepEqual(seen, [true, false]);
});

test('the builder draws a circle on its radius and a fan within its angle and range', () => {
  const B = new HitboxBuilder();
  B.build([{ kind: 'circle', c: v(2, 0, 3), r: 1.7, color: '#ff0000' }, { kind: 'fan', c: v(), h: 0.5, range: 3.3, angle: 0.8, color: '#00ff00', fill: 0.2 }]);
  const pts = []; for (let i = 0; i < B.strong.pos.length; i += 3) pts.push(v(B.strong.pos[i], B.strong.pos[i + 1], B.strong.pos[i + 2]));
  const ring = pts.filter((p) => Math.abs(Math.hypot(p.x - 2, p.z - 3) - 1.7) < 1e-6);
  assert.ok(ring.length >= 48, 'the circle\'s points lie on its radius');
  const fan = pts.filter((p) => !ring.includes(p));
  for (const p of fan) {
    const d = Math.hypot(p.x, p.z);
    assert.ok(d < 3.3 + 1e-6);
    if (d > 0.01) assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(p.x, p.z) - 0.5), Math.cos(Math.atan2(p.x, p.z) - 0.5))) <= 0.8 + 1e-6);
  }
  assert.ok(B.fill.pos.length > 0, 'the fan has its see-through floor');
});

test('on the real traveller: the blade is drawn red exactly on the frames it cuts, along its own segment and cone; a fresh guard shows the parry', async () => {
  const { traveller, course, CAM_PLUS_Z } = await import('./gait-sim.js');
  const { FluidTool } = await import('../src/fluid-tool.js');
  const { items } = await import('../src/items.js');
  items.grant('backpack');
  const scene = course(), p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'v1' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const strike = tool.blade.strike.bind(tool.blade);
  let struck = false; tool.blade.strike = () => { struck = true; return strike(); };
  const tick = (input = {}) => { struck = false; p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); };
  for (let i = 0; i < 10; i++) tick({});
  const prev = {};
  let cutFrames = 0, frames = 0;
  tick({ KeyF: true });
  for (let i = 0; i < 90 && tool.blade.swinging; i++) {
    const shapes = playerHitboxes({ player: p, tool }, [], prev);
    const seg = shapes.find((s) => s.tag.startsWith('blade.segment')), cone = shapes.find((s) => s.tag.startsWith('blade.cone'));
    assert.equal(seg.tag === 'blade.segment.active', struck, `frame ${i}: red exactly when strike() ran`);
    const real = tool.blade.bladeSegment();
    assert.ok(seg.a.distanceTo(real.a) < 1e-6 && seg.b.distanceTo(real.b) < 1e-6, 'the blade\'s own segment');
    const K = tool.blade.coarse();
    assert.equal(cone.range, K.reach); assert.equal(cone.angle, K.angle);
    if (struck) { cutFrames++; assert.ok(cutFrames === 1 || shapes.some((s) => s.tag === 'blade.sweep'), 'the sweep from last frame\'s segment'); }
    frames++;
    tick({});
  }
  assert.ok(cutFrames > 0 && cutFrames < frames, `${cutFrames} of ${frames} frames cut`);
  for (let i = 0; i < 40; i++) tick({});
  tick({ KeyZ: true }); tick({ KeyZ: true }); tick({ KeyZ: true });
  const tags = () => playerHitboxes({ player: p, tool }).filter((s) => s.kind === 'fan').map((s) => s.tag);
  assert.ok(tool.blade.parryLive, 'a fresh guard: the parry window is live');
  assert.deepEqual(tags(), ['guard.parry']);
  for (let i = 0; i < Math.ceil(GUARD.perfect / dt) + 2; i++) tick({ KeyZ: true });
  assert.deepEqual(tags(), ['guard.up'], 'past GUARD.perfect: a plain guard');
  tool.dispose();
});

test('L3 + R3 toggles the hitboxes and does not lock on', () => {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  const c = new Controller({ pads: () => [pad], context: () => 'game', action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {} });
  const set = (i, d) => { pad.buttons[i] = { pressed: d, value: +d }; };
  set(10, true); c.update(dt); set(11, true); c.update(dt); set(10, false); set(11, false); c.update(dt);
  assert.ok(actions.includes('hitboxes')); assert.ok(!actions.includes('lock'));
  actions.length = 0; set(11, true); c.update(dt); set(11, false); c.update(dt);
  assert.deepEqual(actions, ['lock'], 'R3 alone still locks on');
});

test('the built archetypes (src/enemies/archetypes.js): each attack’s shape is drawn where it is checked, telegraph then active then spent', () => {
  for (const kind of ['crab', 'lizard', 'hound', 'tripod', 'blot']) for (const a of FOES[kind].attacks.filter((x) => !x.chain && !x.instant && !x.sweep && !x.blink)) {
    const f = new Foe(kind, v(), { rng: () => 0.5 }); f.state = 'chase'; f.cool = 0; f.heading = 0.4;
    f.attacksAt = (d) => (d >= (a.min ?? 0) ? [a] : []); f.retreat = 0;   // (a sniper backs off first: not here)
    const d = Math.min(a.max ?? f.def.reach, f.def.reach) - 0.2;
    const P = { pos: v(Math.sin(0.4) * d, 0, Math.cos(0.4) * d), heading: 0.4 };
    f.update(dt, P, env);
    assert.equal(f.state, 'wind', `${kind}.${a.id}`);
    const phases = new Set();
    for (let i = 0; i < 400 && f.state !== 'recover'; i++) {
      const s = attackShape(f);
      if (s) {
        phases.add(s.phase);
        if (s.phase === 'telegraph') for (let k = 0; k < 60; k++) {
          const p = v(Math.sin(k * 2.4) * (k % 13) * 0.6, 0, Math.cos(k * 2.4) * (k % 13) * 0.6).add(f.pos);
          assert.equal(insideShape(s, p), inArea(a, f.attackOrigin(), f.attackH, p), `${kind}.${a.id}`);
        }
      }
      f.update(dt, P, env);
    }
    assert.ok(phases.has('telegraph') && phases.has('active'), `${kind}.${a.id}: ${[...phases]}`);
  }
});
