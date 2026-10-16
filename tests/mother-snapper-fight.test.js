// The Mother Snapper's fight played to its end the way a player plays it (issue #373: "I still can't finish the fight
// with the mother snapper? She almost never opens its mouth? And when it does even if I aim properly sometimes I hear
// the success sound but the health bar doesn't change"). In the Hush-House's own hall, a traveller standing close by,
// in the middle of her hall and toward its door, at 60 and 30 frames a second, fires real stilling globs (src/fluid-tool.js
// Glob, at the fluid's speed, against the real targets and walls) at her lock point, her mouth, and pushes with the real
// cone (targetsInCone, its 6 m): a 'reader' only into her open mouth, an 'eager' one also into the jaws she gapes as
// she winds up; both push as she rears to snap while her second phase asks for it, and still the crystals over her
// smallest first in her last. Each must win; each phase must open often; and every glob that lands bright (the tool's
// splash of a hit, not of a wall: src/targets.js hitTarget's dull) or rings the chime must move her bar.
// Before the fix: from 12 m and 16 m her second phase never opened (her head reared 9 m off, out of the push's reach),
// an eager player never once had her open (a glob in her gaping jaws stopped the strike and she shook it off), and the
// first two crystals chimed with the bar standing still.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { updateHazards } from '../src/hazards.js';
import { buildableById } from '../src/levels/buildable.js';
import { templeOf } from '../src/temples/index.js';
import { setHintLevel } from '../src/hint-level.js';
import { targetsInCone, hitTarget } from '../src/targets.js';
import { Glob, FLUID } from '../src/fluid-tool.js';
import { guardianBar } from '../src/temples/boss.js';
import { MOTHER_STILLED } from '../src/temples/perdide.js';

setHintLevel('full');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
/** s the fight may take at most; openings a minute each phase must give (in its fighting time); s between two shots. */
const FAIR = { total: 150, perMin: 4, shot: 0.6 };

function hall() {
  game.reset();
  for (const k of Object.keys(ITEMS)) if (['backpack', 'gun', 'stun'].includes(k)) items.grant(k); else items.revoke(k);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('perdide').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'perdide') ?? level.temple, G = rt.guardian;
  const P = new Player(physics, { spawn: G.arena.center.clone().add(V(0, 0.2, -G.arena.r * 0.6)), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  rt.connect({ player: P, toast: () => {} });
  const heard = { chime: 0 };
  rt.sound = new Proxy({ chime() { heard.chime++; } }, { get: (o, k) => o[k] ?? (() => {}) });
  G.resolve = () => { G.stop(); G.enter('weary'); };
  return { level, physics, rt, G, P, heard, done: () => { rt.dispose?.(); game.reset(); } };
}

/** Fought through standing `stance` m in front of her at `fps`, in a `manner`: what happened. */
function fight(H, { stance, fps, manner }) {
  const { level, physics, rt, G, P, heard } = H, m = G.model, A = G.arena, dt = 1 / fps;
  const f = V(Math.sin(m.heading), 0, Math.cos(m.heading)), spot = m.pos.clone().addScaledVector(f, stance).setY(A.y + 0.2);
  const stand = () => { P.down = null; P.teleport(spot, V(0, 1, 0), f.clone().negate()); P.vel.set(0, 0, 0); };
  stand();
  P.opts.health = false;
  const r = { won: false, t: 0, open: [0, 0, 0], time: [0, 0, 0], landed: 0, took: 0, bright: 0, chimeNoTake: 0, pushes: 0, log: [] };
  const globs = [];
  let cool = 0, opened = G.opened ?? 0, t = 0;
  const chest = () => P.pos.clone().add(V(0, 1.45, 0));
  const fire = (to) => {
    if (cool > 0 || globs.some((g) => g.state === 'fly')) return;
    cool = FAIR.shot;
    const from = chest();
    globs.push(new Glob(from, to.clone().sub(from).normalize().multiplyScalar(FLUID.shoot.speed)));
  };
  while (t < FAIR.total) {
    t += dt; cool = Math.max(0, cool - dt);
    rt.update(dt, t); P.update(dt, {}, 0); updateHazards(dt, P); level.update(dt, t, {});
    // (knocked down or back: up again on his spot)
    if (P.down || P.dead || Math.hypot(P.pos.x - spot.x, P.pos.z - spot.z) > 0.8) stand();
    if (G.state === 'sleep') { G.wake(); continue; }
    if (G.state === 'weary') { r.won = true; break; }
    const ph = Math.min(2, G.phaseIndex);
    if (G.state === 'fight' || G.state === 'open') r.time[ph] += dt;
    if ((G.opened ?? 0) !== opened) { opened = G.opened; r.open[ph]++; }
    for (const g of globs) {
      const e = g.state === 'fly' ? g.step(dt, { physics, up: V(0, 1, 0) }) : null;
      if (e?.type !== 'target') continue;
      const before = G.meter, bar = guardianBar(G.def, G.meter).fill, chimes = heard.chime;
      hitTarget(e.hit, 'stun', e.dir, {});
      const took = G.meter > before + 1e-9;
      r.landed++; if (took) r.took++;
      if (took) assert.ok(guardianBar(G.def, G.meter).fill < bar - 0.01, `the bar shows it (${bar} → ${guardianBar(G.def, G.meter).fill})`);
      if (!took && !e.hit.dull) { r.bright++; r.log.push(`${t.toFixed(1)} s: a bright splash on ${e.hit.target.kind}, nothing taken (phase ${G.phaseIndex}, ${G.state}, ${G.attack?.id ?? '-'})`); }
      if (!took && heard.chime > chimes) { r.chimeNoTake++; r.log.push(`${t.toFixed(1)} s: a chime, nothing taken`); }
    }
    // his hands: the push as she rears to snap while her phase asks for it
    const Q = G.asking ? G.phase.asks : null;
    if (Q && G.attack && Q.moves.includes(G.attack.id) && G.state === 'fight' && !G.struck && G.at > 0.3) {
      if (cool === 0) {
        cool = FLUID.push.cooldown; r.pushes++;
        const from = chest(), dir = m.mouth.clone().sub(from).normalize();
        for (const h of targetsInCone(from, dir, FLUID.push.range, FLUID.push.angle, physics)) hitTarget(h, 'push', h.dir, { strength: 1 });
      }
      continue;
    }
    if (G.state === 'open' && G.t > 0.35) { fire(m.mouth); continue; }
    if (G.phaseIndex >= 2 && !G.attack && G.state === 'fight') {
      const C = rt.motherCrystals.list.find((s) => s.o.rank === rt.motherCrystals.next);
      if (C) fire(C.center);
      continue;
    }
    if (manner === 'eager' && G.state === 'fight' && G.attack && !G.struck && m.gape > 0.45) fire(m.mouth);
  }
  r.t = t;
  return r;
}

test('the Mother Snapper, fought to her end from close by, the middle of her hall and toward its door, at 60 and 30 frames a second, by a player who shoots only her open mouth and by one who shoots her gaping jaws too: she opens often in every phase, and every glob that sounds like a hit calms her and moves her bar (issue #373)', () => {
  const H = hall();
  try {
    for (const fps of [60, 30]) for (const stance of [5, 12, 16]) for (const manner of ['reader', 'eager']) {
      const r = fight(H, { stance, fps, manner }), say = `${manner} at ${stance} m, ${fps} fps`;
      if (process.env.SHOW) console.log(say, r.won ? `won in ${r.t.toFixed(0)} s` : 'NOT WON', 'openings', r.open.join('/'), 'a minute', r.open.map((n, i) => (n / Math.max(1e-3, r.time[i] / 60)).toFixed(1)).join('/'), `landed ${r.landed}, took ${r.took}`, r.log.join(' / '));
      assert.ok(r.won, `${say}: she is calmed within ${FAIR.total} s (phase ${H.G.phaseIndex}, ${H.G.meter.toFixed(2)})`);
      assert.equal(r.bright, 0, `${say}: no glob lands bright and takes nothing (${r.log.join(' / ')})`);
      assert.equal(r.chimeNoTake, 0, `${say}: no chime without calm (${r.log.join(' / ')})`);
      // (her last phase may end on the crystals before her next move: the openings counted in the first two, and over all)
      for (const i of manner === 'reader' ? [0, 1] : [0]) assert.ok(r.open[i] / (r.time[i] / 60) >= FAIR.perMin, `${say}: phase ${i} opens ${FAIR.perMin} times a minute or more (${r.open[i]} in ${r.time[i].toFixed(0)} s)`);
      // reset for the next
      const G = H.G;
      G.meter = G.floor = 0; G.answered?.clear(); G.stop(); G.enter('sleep'); G.cool = 2.5;
      Object.assign(H.rt.motherCrystals, { next: 0, from: null }); for (const s of H.rt.motherCrystals.list) s.taken = false;
    }
  } finally { H.done(); }
});

test('the Mother Snapper stilled mid-strike in her first phase: the strike never lands, her head drops spent and agape, and the cold in her mouth then calms her; a glob that takes nothing is dull (issue #373)', () => {
  const H = hall();
  const { rt, G, P, level } = H;
  try {
    let t = 0;
    const frame = () => { t += 1 / 60; rt.update(1 / 60, t); P.update(1 / 60, {}, 0); level.update(1 / 60, t, {}); };
    P.opts.health = false;
    G.wake();
    for (let i = 0; i < 60 * 20 && !(G.state === 'fight' && G.attack && !G.struck && G.at > 0.4); i++) frame();
    assert.ok(G.attack && !G.struck, 'she winds up');
    const info = {};
    G.landed('mouth', 'stun', null, info);
    assert.equal(G.attack, null, 'the strike never lands');
    assert.equal(G.state, 'open', 'her head drops spent');
    assert.equal(G.openFor, MOTHER_STILLED);
    assert.equal(info.dull, true, 'no calm yet: the splash is dull');
    for (let i = 0; i < 30; i++) frame();
    const m0 = G.meter, i2 = {};
    G.landed('mouth', 'stun', null, i2);
    assert.ok(G.meter > m0 && !i2.dull, 'the cold in her open mouth calms her, and sounds it');
    const i3 = {};
    G.landed('body', 'stun', null, i3);
    assert.equal(i3.dull, true, 'a glob on her leaves between moves takes nothing, and sounds dull');
  } finally { H.done(); }
});
