// Every guardian's fight can be won from wherever you stand in its hall (issue #361: "after a while the mother snapper is
// just throwing fireballs so I can no longer shoot its mouth to keep progressing the fight? All bosses should be able to
// be completed by a play through"). Each temple's guardian is fought through in its own arena by a scripted traveller who
// stands still close to it, half way across its hall or at the hall's far side, at 60 frames a second and at a handheld's
// 30, and does only what the fight offers: the phase's second verb (src/temples/boss.js asks) answered as the asked move
// comes (a push or a shot into its wind-up from where he stands, the guard held up to its blow, a perfect dodge as it
// lands), and each opening (state 'open') taken for half a phase's calm or damage. Every phase must give him a way in
// within FIGHT.window s, from every stance, until it is weary: no move list, timer, reach or frame rate that loops it
// without one. (Before the fix: the Mother Snapper, from past her snap's 7 m, threw seeds for ever in her second phase;
// the Foreman's hammer came for a guard only to 4 m and landed 3.7 m out, and at 30 frames it came down past him in a
// frame. The temples' own ways in, the crystals, the bowls, the bells, are their own tests': tests/guardian-twists.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { updateHazards } from '../src/hazards.js';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { setHintLevel } from '../src/hint-level.js';
import { Guardian } from '../src/temples/boss.js';
import { GUARDIANS, RING, sparHit } from '../src/arena-guardians.js';

setHintLevel('full');
// (the fitted skins, the Keeper's and the Elder's, read from public/ without their textures: tests/guardian-fairness.test.js)
globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const bytes = fs.readFileSync(new URL(String(url).replace(/^\/+/, ''), new URL('../public/', import.meta.url))), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
    for (const m of json.meshes) for (const p of m.primitives) delete p.material;
    delete json.materials; delete json.textures; delete json.images;
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
    this.parse(JSON.stringify(json), '', onLoad, onError);
  } catch (e) { onError?.(e); }
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** s: the longest a phase may go without a way in; s: the most a whole fight may take; frames a second it is played at. */
export const FIGHT = { window: 45, total: 260, fps: [60, 30] };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

/** A temple's guardian and a traveller in its world (null: a temple without one). */
function hall(id) {
  game.reset();
  for (const k of Object.keys(ITEMS)) if (['backpack', 'gun'].includes(k)) items.grant(k); else items.revoke(k);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, id) ?? level.temple, G = rt?.guardian;
  if (!G) return null;
  const P = new Player(physics, { spawn: G.arena.center.clone().add(V(0, 0.2, -G.arena.r * 0.6)), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  rt.connect({ player: P, toast: () => {} });
  // (its end is only waited for: resolved, a temple's doors and its world change would follow, and the next fight couldn't begin)
  G.resolve = () => { G.stop(); G.enter('weary'); };
  let t = 0;
  const frame = (dt) => { t += dt; rt.update(dt, t); P.update(dt, {}, 0); updateHazards(dt, P); level.update(dt, t, {}); };
  return { rt, G, P, frame, home: G.model.pos.clone(), heading: G.model.heading, done: () => { rt.dispose?.(); game.reset(); } };
}

/** Fought through standing `stance` ('near' | 'mid' | 'far') off its body at `fps`: { won, log, stuck: the phase that gave no way in }. */
function fightThrough(H, stance, fps) {
  const { G, P } = H, A = G.arena, m = G.model, dt = 1 / fps;
  // (from the start: asleep where it lies, its meter at nothing)
  G.meter = G.floor = 0; G.answered?.clear(); G.stop(); G.enter('sleep'); G.cool = 2.5;
  m.pos.copy(H.home); m.heading = H.heading;
  // (where he stands: in front of it as it lies, this far off its middle, inside the hall)
  const f = V(Math.sin(m.heading), 0, Math.cos(m.heading)), wall = A.r - 3;
  const spot = m.pos.clone().addScaledVector(f, stance === 'near' ? Math.min(wall, (m.radius ?? 3) + 2.5) : stance === 'mid' ? A.r * 0.5 : wall).setY(A.y + 0.2);
  const o = V(spot.x - A.center.x, 0, spot.z - A.center.z);
  if (o.length() > wall) { o.setLength(wall); spot.set(A.center.x + o.x, spot.y, A.center.z + o.z); }
  const stand = () => { P.down = null; P.teleport(spot, V(0, 1, 0), f.clone().negate()); P.vel.set(0, 0, 0); };
  stand();
  P.opts.health = false;
  // his hands: a perfect dodge through everything but the asked move's blow when the guard is asked for (held up to it)
  const asks = () => (G.asking ? G.phase.asks : null), asked = () => !!G.attack && !!asks()?.moves.includes(G.attack.id);
  P.guard = () => (asks()?.verb === 'parry' ? 'perfect' : false);
  P.untouchable = () => !(asks()?.verb === 'parry' && asked());
  const log = [];
  let phase = -1, since = 0, total = 0, opened = G.opened ?? 0, lastAsk = null;
  while (total < FIGHT.total) {
    H.frame(dt); total += dt;
    if (P.down) stand();   // (knocked down: up again on his spot; a body walking into him shoves him aside, as it would)
    if (G.state === 'sleep') { G.wake(); continue; }
    if (G.state === 'weary' || G.state === 'resolved') { log.push(`${G.state} after ${total.toFixed(0)} s`); return { won: true, log, stuck: null }; }
    if (G.phaseIndex !== phase) { phase = G.phaseIndex; since = 0; }
    if (G.state === 'fight' || G.state === 'open') since += dt;
    const Q = asks(), a = G.attack;
    // the phase's second verb: a push or a shot from where he stands into the asked move's wind-up
    if (Q && a && Q.moves.includes(a.id) && G.state === 'fight' && !G.struck) {
      if (lastAsk !== a) { lastAsk = a; log.push(`phase ${phase}: ${a.id} (asked) at ${total.toFixed(0)} s, ${Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z).toFixed(1)} m off`); }
      if (Q.verb === 'push' || Q.verb === 'shot') G.hit('body', Q.verb === 'push' ? 'push' : 'shoot', null, {});
    }
    // an opening (its asked verb's answer among them): taken for half the phase
    if (G.state === 'open' && (G.opened ?? 0) !== opened) {
      opened = G.opened; since = 0;
      const Ph = G.def.phases, lo = phase > 0 ? Ph[phase - 1].to : 0, hi = Ph[Math.min(phase, Ph.length - 1)].to;
      log.push(`phase ${phase}: open at ${total.toFixed(0)} s`);
      if (!G.asking) G.add((hi - lo) / 2 + 1e-4, 'test');
    }
    if (since > FIGHT.window) return { won: false, log, stuck: phase };
  }
  return { won: false, log, stuck: phase };
}

/** The Arena's sparring guardian `g` (src/arena-guardians.js: the temple's own fight, in a ring on flat sand) and a traveller who only stands. */
async function ring(g) {
  const P = { pos: V(), vel: V(), heading: 0, dead: false, down: null, opts: {}, hearts: 3, maxHearts: 3, hurt() {}, knockDown() { this.down = {}; }, teleport(p) { this.pos.copy(p); } };
  const rt = { def: { id: `ring-${g.id}` }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: P, notice() {}, rumble() {} };
  const model = g.model();
  rt.root.add(model.group);
  await model.ready;
  model.pos.set(0, 0, 0); model.heading = 0;
  const G = new Guardian(rt, { def: { ...g.def, onHit: sparHit }, model, arena: { center: V(), r: RING.r, y: 0 } });
  G.resolve = () => { G.stop(); G.enter('weary'); };
  let t = 0;
  // (its body shoves him aside, as the Arena's solids do: src/arena-guardians.js solids())
  const shove = () => { const s = G.solid, o = V(P.pos.x - s.pos.x, 0, P.pos.z - s.pos.z), r = s.r + 0.45; if (o.length() < r) { o.setLength(o.length() > 1e-3 ? r : 0).add(s.pos); P.pos.set(o.x, P.pos.y, o.z); } };
  return { G, P, frame: (dt) => { G.update(dt, (t += dt)); shove(); }, home: model.pos.clone(), heading: 0, done: () => G.dispose() };
}

for (const id of Object.keys(TEMPLES)) {
  test(`${TEMPLES[id].def.name ?? id}’s guardian (${id}): fought through standing close by, half way across its hall and at its far side, at 60 and 30 frames a second, every phase gives a way in`, () => {
    const H = hall(id);
    if (!H) return;   // (a temple without a guardian)
    try {
      for (const fps of FIGHT.fps) for (const stance of ['near', 'mid', 'far']) {
        const r = fightThrough(H, stance, fps);
        if (process.env.SHOW) console.log(id, fps, stance, r.won ? 'won' : `STUCK in phase ${r.stuck}`, r.log.join(' / '));
        assert.ok(r.won, `${id}, standing ${stance} at ${fps} fps: phase ${r.stuck} gave no way in for ${FIGHT.window} s (${H.G.def.phases[r.stuck]?.attacks?.join(', ')}; ${r.log.slice(-4).join(' / ')})`);
      }
    } finally { H.done(); }
  });
}

test('the Arena’s sparring guardians (the temples’ own fights in a ring): fought through from close by, half way out and at the ring’s edge, at 60 and 30 frames a second, every phase gives a way in', async () => {
  for (const g of GUARDIANS) {
    for (const fps of FIGHT.fps) for (const stance of ['near', 'mid', 'far']) {
      const H = await ring(g);
      try {
        const r = fightThrough(H, stance, fps);
        if (process.env.SHOW) console.log('arena', g.id, fps, stance, r.won ? 'won' : `STUCK in phase ${r.stuck}`, r.log.join(' / '));
        assert.ok(r.won, `the Arena’s ${g.id}, standing ${stance} at ${fps} fps: phase ${r.stuck} gave no way in for ${FIGHT.window} s (${r.log.slice(-4).join(' / ')})`);
      } finally { H.done(); }
    }
  }
});
