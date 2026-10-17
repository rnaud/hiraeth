// Every temple played through for real (issue #311: "After I get the shield I can't roll the fiery ball to the pillar. It
// always turns off before reaching its target. We need to make sure all temples are solvable through a play through").
// The solver (logic.js solve, tests/temples.test.js) proves a house can be solved as a state machine: a ball "rolled onto
// its plate" is a number set. Here every temple is built in node with its real pieces and a real Player, and the house is
// done the way its logic asks next (logic.next(), the drone's own choice), but every ball is rolled by real hits from
// where the traveller can stand: the gun's push from behind it (its strength from how far he stands, as the fluid's cone
// gives it), the tether's pull from in front, the blade's cut, his hands walked into it; the ball's own physics (its
// friction, the plates' dips, the bridges, the jaws, the pools' currents) and its timers run in real time (a tar ball's
// flame, an orb's glow), and what a ball lights (a hooded bowl, a lamp, a bell) must be lit by the ball arriving: no
// shortcut is taken for those. Never is a ball put back by hand: where it went wrong, it is rolled back from where it
// lies, as a player would. The plates are stood on, the eyes struck, the keys taken from their chests and carried to the
// locks, the arenas walked into; the guardian's fight is its own tests' (it is resolved here once it can be faced).
// A piece this driver can't work for real (a vane the jets turn, a note sung, a sequence in one breath) is done through
// its logic and counted: the walk-throughs in tests/temples.test.js work those on foot.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { Ball, Brazier, Bramble, Switch, Vane, Bank, Seed, Swing, Weight } from '../src/temples/pieces.js';
import { CARRY as CARRYING, pickUp } from '../src/carry.js';
import { HOOK } from '../src/gadgets/hook.js';
import { held } from '../src/temples/logic.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { allTargets, targetsInCone, hitTarget } from '../src/targets.js';
import { bestInteractable } from '../src/interact.js';
import { FLUID } from '../src/fluid-tool.js';
import { BLADE } from '../src/fluid-blade.js';
import { BALL_CUT } from '../src/temples/pieces.js';
import { updateHazards } from '../src/hazards.js';
import { irons } from '../src/gadgets/metal.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const DT = 1 / 60;
/** m/s: how fast the traveller runs between one thing and the next (the time a ball's flame or an orb's glow has to last). */
const RUN = 6;
/** s: a tar ball's flame (an orb's glow) still left, at the least, when it lights what it rolls into: room for a player's own route, not the one perfect cut (issue #311: the Hall of Channels' ball had a fifth of a second). */
export const SPARE = 1.0;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
/** What each house is walked into with: the route's (the lift valve's double jump before every temple, the gun from the desert's Hearth); the Rose House with nothing in hand (v1.44). */
// (and an older house's tool where a late step wants it with the house's own, G2: the Greenhouse's weight #411, the Lamp-House's far door #410, the Warden's Well's crown #413, the Whale-House's weight #412)
const CARRY = { desert: ['backpack', 'doublejump'], edena: ['backpack', 'gun', 'doublejump', 'hook'], perdide2: ['backpack', 'gun', 'doublejump', 'hook'], incal: ['backpack', 'gun', 'doublejump', 'hook'], underwater: ['backpack', 'gun', 'doublejump', 'hook'], moonfoundry: ['backpack', 'gun', 'doublejump', 'hook'] };
const carry = (id) => CARRY[id] ?? ['backpack', 'gun', 'doublejump'];

/**
 * Play temple `id` through: { done, steps: [{ id, how }], failed: [why], logical: [element ids done through the logic] }.
 * o.log: print every step (a CLI: node --test tests/temple-playthrough.test.js --test-name-pattern=<name>).
 */
export function playTemple(id, o = {}) {
  game.reset();
  own(...carry(id));
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, id) ?? level.temple;
  const L = rt.logic, def = rt.def;
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: false });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let time = 0;
  // (a held vane or bell, once done for real, is kept turning as he goes on, as the solver keeps it: he would splash it again on his way)
  const kept = new Set();
  let watch = null;
  const frame = (input = {}, yaw = P.heading ?? 0) => { time += DT; physics.syncMovers(DT); quiet(() => { rt.update(DT, time); P.update(DT, input, yaw); updateHazards(DT, P); }); if (P.dead) P.restart?.(); for (const k of kept) if (!L.isLit(k)) L.light(k); watch?.(); };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const steps = [], failed = [], logical = [], margins = [];
  const say = (s) => { if (o.log) console.error(`  [${id}] ${s}`); };
  const fail = (s) => { failed.push(s); say(`FAILED ${s}`); };
  const has = (it) => L.has(it);

  // ---------------------------------------------------------------- where he stands
  /** A spot to stand at near `at` (a floor within `band` m of y, no wall in it), or null. */
  const standAt = (at, y = at.y, band = 1.6) => {
    const g = physics.groundAt(at.x, y + band + 1.8, at.z, 2 * band + 1.8);
    if (!Number.isFinite(g) || Math.abs(g - y) > band) return null;
    const p = V(at.x, g, at.z), probe = p.clone();
    if (physics.pushCapsule(probe, 0.4, 0.4, 1.7)) return null;
    return p;
  };
  /** Run there (the time it takes passes), and stand. */
  const goTo = (p, face = null) => {
    const d = P.pos.distanceTo(p);
    const fwd = face ? face.clone().setY(0).normalize() : V(0, 0, 1);
    P.teleport(p.clone().addScaledVector(UP, 0.05), UP, fwd.lengthSq() > 0.5 ? fwd : V(0, 0, 1));
    P.vel.set(0, 0, 0);
    wait(Math.min(12, d / RUN) + 0.25);
  };
  const chest = () => P.pos.clone().addScaledVector(UP, 1.15);
  const targetOf = (piece) => allTargets().find((t) => t.position?.() === piece.center);

  // ---------------------------------------------------------------- the balls
  const fires = (b) => !!b.o.tar;
  /** What a ball lights by arriving (a hooded bowl, a lamp, a bell's clapper): its element, or null. */
  const litBy = (b) => {
    const hood = rt.pieces.find((p) => p instanceof Brazier && p.o.hood?.ball === b.id);
    if (hood) return hood.id;
    if (b.o.lamp) return b.o.lamp.id;
    return null;
  };
  /** Where on its groove a ball should go now: [t, plate] (the awaited stop of several, as logic.next chose it, else its plate). */
  const goal = (b, e) => {
    if (!e.stops) return [e.plateAt ?? 1, e.plate];
    const s = Object.entries(e.stops).find(([p]) => !L.drumOn(b.id, p) && L.awaited(p))
      ?? (Object.keys(e.stops).some((p) => L.drumOn(b.id, p) && L.holdsShut(p)) ? Object.entries(e.stops).find(([p]) => !L.drumOn(b.id, p)) : null);
    return s ? [s[1], s[0]] : [e.plateAt ?? 1, e.plate];
  };
  /** At rest (or s seconds). */
  const settle = (b, s = 30) => { wait(s, () => b.rest && !b.drop && Math.abs(b.v) < 1e-3); wait(0.3); };
  /** The ways he can move a ball, best first: [{ kind }]. */
  const tools = (b, e) => {
    const out = [];
    const heavyOk = !b.o.heavy || (b.o.heavy !== 'magnet' && has(b.o.heavy));
    // (an iron moon since issue #377: only the magnet glove's field draws it, src/gadgets/metal.js irons)
    if (b.o.heavy === 'magnet' && has('magnet')) out.push({ kind: 'magnet' });
    if (e.roll === 'hand') out.push({ kind: 'shove' });
    if (e.roll === 'sword' && b.o.blade && has('sword')) out.push({ kind: 'cut' });
    if (has('gun') && heavyOk) out.push({ kind: 'push' });
    if (has('tether') && heavyOk) out.push({ kind: 'tether' });
    if (b.o.shove && e.roll !== 'hand') out.push({ kind: 'shove' });
    if (has('gun') && !b.o.heavy) out.push({ kind: 'nudge' });
    return out;
  };
  /**
   * One hit (or a walk into it) sending ball `b` the way `sign` along its groove, about `dist` m (to an end: as hard as
   * it goes). Returns false when there is nowhere to do it from.
   */
  let hovered = false;
  const strike = (b, tool, sign, dist, toEnd) => {
    hovered = false;
    const along = b.dir.clone().multiplyScalar(sign);
    const floorY = b.group.position.y;
    const side = V().crossVectors(UP, along).normalize();
    const f = b.o.friction ?? 1.6;
    if (tool.kind === 'magnet') {
      // held in the glove's field from where he stands, toward a point `dist` along its groove (to an end: past it), let go
      const x = irons().find((i) => i.pos() === b.center);
      if (!x) return false;
      const goal = b.center.clone().addScaledVector(along, toEnd ? b.len + 2 : dist);
      const t0 = b.t;
      for (let i = 0; i < 6 / DT && Math.abs(b.t - t0) * b.len < (toEnd ? b.len : dist) - 0.05; i++) { x.follow(goal, DT); frame(); if (b.rest && Math.abs(b.v) < 1e-3 && i > 30) break; }
      return true;
    }
    if (tool.kind === 'shove') {
      // his hands: walked into it along its groove, at a walk, until it has gone far enough
      const back = b.group.position.clone().addScaledVector(along, -(b.r + 1.0));
      const s = standAt(back, floorY);
      if (!s) return false;
      goTo(s, along);
      const t0 = b.t, want = toEnd ? 2 : dist / b.len;
      for (let i = 0; i < 40 / DT; i++) {
        const aim = b.center.clone().addScaledVector(along, 2);
        frame({ KeyW: true }, Math.atan2(-(aim.x - P.pos.x), -(aim.z - P.pos.z)));
        if (Math.abs(b.t - t0) >= want - 0.6 / b.len || (toEnd && (sign < 0 ? b.t <= 1e-3 : b.t >= 1 - 1e-3))) break;
        if (P.pos.distanceTo(b.center) > b.r + 6) break;   // (lost it)
      }
      return true;
    }
    // the fluid's push (from behind, its strength how near he stands), the tether's pull (from in front), the blade's cut,
    // a splash's nudge: from where he can stand, in sight of it
    const range = tool.kind === 'cut' ? BLADE.reach : FLUID.push.range;
    let strength = 1;
    if (tool.kind === 'push' || tool.kind === 'tether') strength = toEnd ? 1 : THREE.MathUtils.clamp((dist * f - 4.2) / 4.5, 0, 1);
    const front = tool.kind === 'tether' ? -1 : 1;
    const spots = [];
    const gap = tool.kind === 'cut' ? 0.9 : tool.kind === 'nudge' ? 2 : Math.max(0.35, (1 - strength) * range - 0.2);
    // (the distance that gives the strength wanted first, then nearer or farther: anywhere in reach, as a player would)
    const extras = [0, 0.4, -0.3, 0.9, 1.6, 2.5];
    if (tool.kind === 'push' || tool.kind === 'tether') for (let x = 0.35; x < range - 0.4; x += 0.5) extras.push(x - gap);
    for (const extra of extras) for (const lat of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2]) {
      const d = Math.max(0.3, gap + extra), back = b.r + d + 0.2;
      const at = b.center.clone().addScaledVector(along, -front * back).addScaledVector(side, lat);
      if (back / Math.hypot(back, lat) < 0.6) continue;   // (near enough along its groove that it rolls, not rocks: Ball.hit's `along`)
      spots.push(at);
    }
    // (a floating ball in a pool that stirs: pushed from the plate that stills it, the Footprint's bank)
    // (or a ball whose groove ends at a hatch over a hole, issue #401: pushed from the print that opens the hatch, the
    // Footprint's Sounding Toe)
    const Cu = b.o.current, still = (Cu?.still?.pressed && !L.check(Cu.still) ? rt.piece(Cu.still.pressed) : null) ?? (b.o.hole?.stand && !L.pressed(b.o.hole.stand) ? rt.piece(b.o.hole.stand) : null);
    const cone = tool.kind === 'cut' ? BLADE.angle : FLUID.push.angle, tg = targetOf(b);
    if (!tg) return false;
    const mode = tool.kind === 'cut' ? 'blade' : tool.kind === 'nudge' ? 'shoot' : tool.kind;
    const fire = () => {
      const o2 = chest(), h2 = targetsInCone(o2, b.center.clone().sub(o2).normalize(), range, cone, physics).find((h) => h.target === tg);
      if (!h2) return false;
      const along2 = (h2.dir.x * b.dir.x + h2.dir.z * b.dir.z) * sign * (tool.kind === 'tether' ? -1 : 1);
      if (along2 < 0.3) return false;   // (it would roll the wrong way, or only rock)
      hitTarget(h2, mode, tool.kind === 'tether' ? h2.dir.clone().negate() : h2.dir, { strength: 1 - h2.distance / range });
      return true;
    };
    const inCone = (feet) => { const o1 = feet.clone().addScaledVector(UP, 1.15); return !!targetsInCone(o1, b.center.clone().sub(o1).normalize(), range, cone, physics).find((h) => h.target === tg); };
    // (from the middle of its disc, where he stands to weigh it down: its rim is no place to have to find)
    const onStill = still ? [0, 0.25, -0.25, 0.5].flatMap((k) => [0, 0.3, -0.3].map((lat) => still.pos.clone().addScaledVector(along.clone().setY(0).normalize(), k * still.r).addScaledVector(side, lat * still.r))) : [];
    const floor = [...onStill, ...spots];
    for (const at of floor) {
      const s = onStill.includes(at) ? standAt(at, at.y) : standAt(at, floorY);
      if (!s || !inCone(s)) continue;
      goTo(s, b.center.clone().sub(s));
      if (fire()) return true;
    }
    // hovering on the vane's breath beside it, where no floor is (the Warden's Well's loft shelf: its own lesson; the fan
    // its tool since issue #377, the bellows before)
    if ((has('fan') || has('wardenbellows')) && tool.kind === 'push') {
      for (const at of spots) {
        const feet = at.clone().setY(floorY + 0.1), probe = feet.clone();
        if (physics.pushCapsule(probe, 0.4, 0.4, 1.7) || !inCone(feet)) continue;
        P.teleport(feet, UP, b.center.clone().sub(feet).setY(0).normalize()); P.vel.set(0, 0, 0);
        if (fire()) { hovered = true; return true; }
      }
    }
    return false;
  };

  /** An orb's glow (o.lamp): his lantern held by it at rest, or rested by a lit pool; true once it glows. */
  const charge = (b) => {
    const lp = b.o.lamp;
    if (b.charge > (lp.lasts ?? 25) - 6) return true;
    // (issue #377, the Lamp-House: a bubble of a lamp's light burst on it, src/carried-light.js; the bubble's flight is
    // tests/temples.test.js's, here its light arrives, counted as done through the logic)
    if (lp.carried && has('bubble')) { game.emit('bubble:light', { pos: b.center.clone() }); logical.push(`${b.id} (a bubble's light)`); return b.charge > 0; }
    if (has('lantern') && (lp.reach ?? 2.8) > 0) {
      for (const a of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const ang = (a / 8) * Math.PI * 2, at = b.center.clone().add(V(Math.cos(ang) * (b.r + 0.9), 0, Math.sin(ang) * (b.r + 0.9)));
        const s = standAt(at, b.group.position.y);
        if (!s || s.distanceTo(b.center) > (lp.reach ?? 2.8) - 0.1) continue;
        goTo(s, b.center.clone().sub(s));
        if (wait((lp.hold ?? 2) + 1, () => b.charge > 0)) return true;
      }
    }
    if (lp.pool && L.isLit(lp.pool.id)) {
      // rolled to rest by the pool, and left there a while
      const pool = rt.kit.world(...lp.pool.at), ab = b.b.clone().sub(b.a);
      const t = THREE.MathUtils.clamp(pool.clone().sub(b.a).dot(ab) / ab.lengthSq(), 0, 1);
      if (!moveTo(b, L.el(b.id), t, (lp.pool.reach ?? 4) * 0.6)) return false;
      if (wait((lp.hold ?? 2) + 1.5, () => b.charge > 0)) return true;
    }
    return b.charge > 0;
  };

  let why = '';
  /** Roll ball `b` to t (within `tol` m), from where it lies, in a dozen hits at most. */
  const moveTo = (b, e, t, tol, { until = null, max = 12 } = {}) => {
    const ts = tools(b, e);
    if (!ts.length) { why = 'nothing he carries rolls it'; return false; }
    let ti = 0, best = Infinity;
    for (let k = 0; k < max; k++) {
      if (until?.()) return true;
      const d = (t - b.t) * b.len;
      if (Math.abs(d) <= tol && b.rest) return true;
      const toEnd = (t <= 1e-3 && d < 0) || (t >= 1 - 1e-3 && d > 0);
      // (a short way: the nudge first if he has one, else the gentlest of his own)
      const gentle = (x) => x.kind === 'nudge' || x.kind === 'shove';
      const order = !toEnd && Math.abs(d) * (b.o.friction ?? 1.6) < 3 ? [...ts.filter(gentle), ...ts.filter((x) => !gentle(x))] : ts;
      const tool = order[ti % order.length];
      if (!strike(b, tool, Math.sign(d), Math.abs(d), toEnd)) { ti++; if (ti >= ts.length * 2) { why = `nowhere to ${ts.map((x) => x.kind).join(' or ')} it from at t ${b.t.toFixed(2)}, toward ${t.toFixed(2)}`; return false; } continue; }
      settle(b);
      say(`${b.id}: ${tool.kind}${hovered ? ' (hovering)' : ''} → t ${b.t.toFixed(3)} (want ${t.toFixed(3)}${b.o.tar ? `, burning ${b.burn.toFixed(1)}` : ''})`);
      const now = Math.abs((t - b.t) * b.len);
      if (now > best - 0.05) ti++;   // (no nearer: another way)
      best = Math.min(best, now);
    }
    return Math.abs((t - b.t) * b.len) <= tol || !!until?.();
  };

  /**
   * (issue #401) A lift that carries its sphere between floors (the Footprint's great lift, its element a drum whose stops
   * are the plates on its piers): called to the stop its puzzle wants by standing on that stop's plate, and waited for.
   */
  const ride = (eid) => {
    const lift = rt.piece(eid), e = L.el(eid), [, plate] = goal(lift, e), pl = rt.piece(plate);
    if (!pl?.pos) { fail(`${eid}: no plate ${plate} to call it from`); return false; }
    if (L.drumOn(eid, plate)) return true;
    goTo(pl.pos.clone());
    if (!wait(40, () => L.drumOn(eid, plate))) { fail(`${eid}: called from ${plate}, never came (it rests at t ${L.drumT(eid)})`); return false; }
    const off = near(pl.pos, 2.6);
    if (off) goTo(off);
    return true;
  };
  /**
   * (issue #408) A house-wide state (the Founders' Belfry's bell, its drum's piece keeps `setters`): set to the stop its
   * puzzle wants now from the nearest place he can: a lever pulled (the use button's own entry), or with the hook at a
   * ring, from where it is hooked (the ring's `from`); stilled, it waits for the hum to fade.
   */
  const setState = (eid) => {
    const B = rt.piece(eid), e = L.el(eid), [t, plate] = goal({ id: eid }, e);
    if (L.drumOn(eid, plate)) return true;
    const reach = L.reachable();
    const ways = B.setters.map((s) => {
      const p = rt.piece(s.lever ?? s.ring);
      if (!p) return null;
      if (s.lever) return reach.has(p.o.room) ? { s, p, at: near(p.pos, 1.3) } : null;
      if (!has('hook') || ![p.o.room, ...(p.o.rooms ?? [])].some((r) => reach.has(r))) return null;
      const f = p.o.from && rt.kit.world(...p.o.from);
      return f ? { s, p, at: standAt(f, f.y) } : null;
    }).filter((w) => w?.at).sort((a, b) => a.at.distanceTo(P.pos) - b.at.distanceTo(P.pos));
    if (!ways.length) { fail(`${eid}: nowhere to set it from`); return false; }
    const w = ways[0];
    goTo(w.at, (w.p.pos ?? w.p.at).clone().sub(w.at));
    if (w.s.lever) {
      const pick = bestInteractable(P);
      if (pick?.entry?.id !== `temple.${rt.id}.${w.s.lever}`) { fail(`${eid}: the use button offers ${pick?.entry?.id ?? 'nothing'} by ${w.s.lever}`); return false; }
      pick.entry.use(P);
    } else w.p.hit('push', { mode: 'hook' });
    if (!wait(30, () => L.drumOn(eid, plate))) { fail(`${eid}: set from ${w.s.lever ?? w.s.ring}, never came to ${plate} (t ${L.drumT(eid)}, wanted ${t})`); return false; }
    say(`${eid}: ${w.s.lever ? 'pulled' : 'hooked'} ${w.s.lever ?? w.s.ring} → ${plate}`);
    return true;
  };
  /** Roll a drum onto the stop its puzzle wants now; what it lights must catch from it. */
  const roll = (eid) => {
    if (rt.piece(eid)?.setters) return setState(eid);
    if (rt.piece(eid)?.carries) return ride(eid);
    const b = rt.piece(eid), e = L.el(eid);
    if (!(b instanceof Ball)) { fail(`${eid}: no ball`); return false; }
    const [t, plate] = goal(b, e);
    const lights = litBy(b), lit = () => !lights || L.isLit(lights);
    const on = () => L.drumOn(eid, plate) && b.rest;
    const tol = (e.tolerance ?? 0.06) * b.len * 0.6;
    why = '';
    // (how much of its flame, or its glow, was left when it lit what it lights: the margin a player has)
    let prev = null, spare = null;
    const left = () => (fires(b) ? b.burn : b.o.lamp ? b.charge : null);
    watch = lights ? () => { if (spare == null && L.isLit(lights)) spare = prev; prev = left(); } : null;
    const done = (ok) => { watch = null; if (ok && spare != null) margins.push({ id: eid, lights, spare }); return ok; };
    for (let round = 0; round < 4; round++) {
      if (on() && lit()) return done(true);
      if (b.o.lamp && !L.isLit(b.o.lamp.id) && !charge(b)) { fail(`${eid}: the orb won't glow`); return done(false); }
      if (fires(b) && lights && !L.isLit(lights) && round % 2 === 1) {
        // it came cold: back the other way first, through its fire, then on again (as the house teaches)
        moveTo(b, e, t > 0.5 ? 0 : 1, 0.4, { max: 4 });
      }
      moveTo(b, e, t, tol, { until: () => on() && lit() });
      wait(2.2);   // (a cold ball in a hooded bowl is tipped back out after a moment)
      if (on() && lit()) return done(true);
      say(`${eid}: round ${round + 1}: t ${b.t.toFixed(3)} on ${on()}, ${lights ?? '-'} ${lit() ? 'lit' : 'dark'}`);
    }
    fail(`${eid}: never rolled onto ${plate}${lights ? ` with ${lights} lit by it` : ''} (it lies at t ${b.t.toFixed(3)}, wanted ${t.toFixed(3)}${why ? `; ${why}` : ''})`);
    return done(false);
  };

  // ---------------------------------------------------------------- the rest of the house
  const near = (p, r = 1.4) => {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2, s = standAt(p.clone().add(V(Math.cos(ang) * r, 0, Math.sin(ang) * r)), p.y);
      if (s) return s;
    }
    return standAt(p, p.y, 3);
  };
  const latched = (eid) => {
    const e = L.el(eid), piece = rt.piece(eid);
    // a hooded bowl, a lamp: what its ball lights by arriving
    const ball = rt.pieces.find((p) => p instanceof Ball && (litBy(p) === eid));
    if (ball && L.el(ball.id)) return roll(ball.id) ? 'ball' : null;
    // a seed-ball's bloom where it lies
    const seed = rt.pieces.find((p) => p instanceof Ball && p.o.seed?.id === eid);
    if (seed && has('bloom')) { const s = near(seed.group.position, seed.r + 2); if (s) goTo(s, seed.center.clone().sub(s)); seed.hit('bloom', seed.dir, {}); wait(0.5); return L.isLit(eid) ? 'bloomed' : null; }
    if (e.type === 'arena') {
      const A = def.arenas?.find((x) => x.el === eid);
      if (!A) return null;
      for (const f of rt.machines ?? []) if (f.room === A.room) f.alive = false;
      const c = rt.kit.world((A.zone.min[0] + A.zone.max[0]) / 2, A.zone.min[1] + 1, (A.zone.min[2] + A.zone.max[2]) / 2);
      const s = standAt(c, c.y, 3) ?? near(c, 2);
      if (s) { goTo(s); wait(3, () => L.isLit(eid)); }
      return L.isLit(eid) ? 'arena' : null;
    }
    // an eye, a bowl, thorns: struck, splashed or burnt with what he carries
    if (piece instanceof Switch || piece instanceof Brazier || piece instanceof Bramble) {
      const at = piece.center ?? piece.pos ?? piece.group?.position;
      if (at) { const s = near(at.clone().setY(at.y - 1), 2.2); if (s) goTo(s, at.clone().sub(s)); }
      const modes = piece.o?.blade || piece.o?.cut ? ['blade'] : piece.o?.pull ? ['tether'] : piece instanceof Brazier ? ['fire'] : piece instanceof Bramble ? ['fire', 'blade'] : ['shoot'];
      for (const m of modes) {
        if (m === 'blade' && !has('sword')) continue;
        if (m === 'tether' && !has('tether')) continue;
        if ((m === 'shoot' || m === 'fire') && !has('gun')) continue;
        piece.hit(m, V(0, 0, 1), {});
        wait(0.4);
        if (L.isLit(eid)) return m;
      }
    }
    // (issue #410) a valve on a ring the hook tugs (the Lamp-House's pipe): hooked from where the ring is hooked from
    if (piece?.o?.ringId && has('hook')) {
      const ring = rt.piece(piece.o.ringId), f = ring?.o?.from && rt.kit.world(...ring.o.from), s = f && standAt(f, f.y);
      if (s) { goTo(s, ring.at.clone().sub(s)); ring.hit('push', { mode: 'hook' }); wait(0.4); if (L.isLit(eid)) return 'hooked'; }
    }
    // a small vane splashed (it turns a while, `coast`: the next thing must be done before it stops); a great one wants
    // the bellows' steady wash, the walk-throughs' work
    if (piece instanceof Vane && !piece.o.great && has('gun')) {
      const s = near(piece.center, piece.r + 1.5);
      if (s) goTo(s, piece.center.clone().sub(s));
      piece.hit('shoot');
      wait(0.3);
      if (L.isLit(eid)) return 'splashed';
    }
    // a bank of eyes, every one splashed within its window (in its order; an eye on a piston when it is up), a shot
    // every third of a second from where he stands
    if (piece instanceof Bank && has('gun')) {
      const order = piece.o.order ?? piece.eyes.map((_, i) => i);
      const mid = piece.eyes.reduce((a, x) => a.add(x.base), V()).multiplyScalar(1 / piece.eyes.length);
      const s = near(mid.clone().setY(mid.y - 1.5), 4);
      if (s) goTo(s, mid.clone().sub(s));
      if (piece.o.order) {
        for (let k = 0; k < 3 && !L.isLit(eid); k++) {
          for (const i of order) { wait(8, () => piece.isUp(i)); piece.hit(i); wait(0.35); }
          wait(0.5);
        }
      } else {
        // (any order: each caught as it rises, one shot at a time)
        let ready = 0;
        for (let f = 0; f < 20 / DT && !L.isLit(eid); f++) {
          frame(); ready -= DT;
          if (ready > 0) continue;
          const i = order.find((j) => piece.isUp(j) && piece.time - piece.eyes[j].at > piece.window);
          if (i != null) { piece.hit(i); ready = 0.35; }
        }
      }
      if (L.isLit(eid)) return 'every eye splashed in time';
      if (L.canUse(eid)) { fail(`bank ${eid}: its eyes never all awake at once`); return null; }
    }
    // a seed in the sun, bloomed; a pendulum stilled
    if (piece instanceof Seed && has('bloom')) { const s = near(piece.center, 2.5); if (s) goTo(s, piece.center.clone().sub(s)); piece.hit('bloom'); wait(0.5); if (L.isLit(eid)) return 'bloomed'; }
    if (piece instanceof Swing && has('stun')) { const s = near(piece.center.clone().setY(piece.center.y - 2), 3); if (s) goTo(s, piece.center.clone().sub(s)); piece.hit('stun'); wait(0.5); if (L.isLit(eid)) return 'stilled'; }
    return null;
  };

  // ---------------------------------------------------------------- a weight carried (issue #337)
  /** Walk to the weight, pick it up (the use button's own entry), carry it to its plate and put it down on it. */
  const carryOnto = (eid) => {
    const w = rt.piece(eid), e = L.el(eid), plate = rt.piece(e.plate);
    if (!(w instanceof Weight) || !plate?.pos) { fail(`${eid}: no weight, or no plate ${e.plate}`); return null; }
    const foot = w.prop.pos.clone().addScaledVector(UP, -w.size / 2);
    if (e.needs?.includes('hook')) {
      // (out of reach on a ledge, issue #411: from the plate's floor, in the hook's reach and sight, it is pulled down into
      // his hands, as the hook's drag lands a loose thing, src/gadgets/hook.js)
      const s = standAt(plate.pos.clone().addScaledVector(w.prop.pos.clone().sub(plate.pos).setY(0).normalize(), -2), plate.pos.y);
      if (!s) { fail(`${eid}: nowhere to stand to hook it`); return null; }
      goTo(s, w.prop.pos.clone().sub(s).setY(0));
      const hand = P.pos.clone().addScaledVector(UP, 1.3), d = w.prop.pos.clone().sub(hand), n = d.length();
      if (n > HOOK.range || physics.rayDistance(hand, d.normalize(), n) < n - 0.9) { fail(`${eid}: out of the hook's reach or sight (${n.toFixed(1)} m)`); return null; }
      if (!pickUp(P, w.prop, { from: 'hook' })) { fail(`${eid}: the hook brought it, and it did not land in his hands`); return null; }
    } else {
      const s = near(foot, w.size / 2 + 0.8);
      if (!s) { fail(`${eid}: nowhere to stand by it`); return null; }
      goTo(s, w.prop.pos.clone().sub(s).setY(0));
      const pick = bestInteractable(P);
      if (pick?.entry?.id !== `carry.${w.prop.id}`) { fail(`${eid}: the use button offers ${pick?.entry?.id ?? 'nothing'} beside it, not to pick it up`); return null; }
      pick.entry.use(P);
    }
    wait(0.6);
    if (P.carrying?.thing !== w.prop) { fail(`${eid}: not in his hands`); return null; }
    // (to the plate, from the side he stands on: its middle the length of a put in front of him)
    const dir = plate.pos.clone().sub(P.pos).setY(0).normalize();
    const at = standAt(plate.pos.clone().addScaledVector(dir, -(CARRYING.put + w.size / 2 + 0.05)), plate.pos.y);
    if (!at) { fail(`${eid}: nowhere to stand before ${e.plate}`); return null; }
    goTo(at, dir);
    if (P.carrying?.thing !== w.prop) { fail(`${eid}: dropped on the way`); return null; }
    const put = bestInteractable(P);
    if (put?.entry?.id !== 'carry.put') { fail(`${eid}: the use button offers ${put?.entry?.id ?? 'nothing'}, not to put it down`); return null; }
    put.entry.use(P);
    wait(1);
    return L.weightOn(eid) === e.plate ? 'carried onto its plate' : (fail(`${eid}: put down, but not on ${e.plate} (on ${L.weightOn(eid)})`), null);
  };

  // ---------------------------------------------------------------- the house, as its logic asks
  const LATCH = new Set(['brazier', 'bramble', 'switch', 'bell', 'vane', 'arena']);
  const arenaNext = () => {
    const els = Object.entries(L.def.elements), boss = els.find(([, e]) => e.type === 'boss');
    for (const [k, e] of els) {
      if (e.room !== boss?.[1].room) continue;
      if (e.type === 'drum' && e.plate && !L.drumOn(k, e.plate) && (e.needs ?? []).every(has)) return k;
      if (LATCH.has(e.type) && !L.isLit(k) && L.canUse(k)) return k;
    }
    return boss && (boss[1].needs ?? []).every(has) && L.check(boss[1].requires) ? boss[0] : null;
  };
  wait(1);
  const tries = new Map();
  for (let n = 0; n < 160 && !L.resolved; n++) {
    // (in the arena, its door held shut behind him while its guardian is awake: the arena's own work is done from inside,
    // then the guardian, once what it requires is done; what the house might still want outside waits, issue #412: the
    // Whale-House's tide, which the logic would have let in again for the Sound with nothing else left)
    let eid = rt.guardian?.awake && !L.resolved ? arenaNext() ?? L.next() : L.next();
    if (!eid && rt.guardian?.awake && !L.resolved) eid = arenaNext();
    if (!eid) { fail(`nothing left to do, and the guardian not reached (rooms open: ${[...L.reachable()].join(', ')})`); break; }
    const e = L.el(eid);
    const k = (tries.get(eid) ?? 0) + 1;
    tries.set(eid, k);
    // (a house-wide state is set back and forth on the way: the Casting-House's pour six times and more, issue #416)
    if (k > (held(e) || e.rooms ? 12 : 4)) { fail(`${e.type} ${eid}: asked for again and again (${k} times)`); break; }
    let how = null;
    if (e.type === 'drum') how = roll(eid) ? (rt.piece(eid)?.setters ? 'set' : rt.piece(eid)?.carries ? 'called' : 'rolled') : null;
    else if (e.type === 'weight') how = carryOnto(eid);
    else if (e.type === 'gadget' || e.type === 'find') {
      const item = e.item ?? def.gadget, box = e.type === 'find' ? e.box : def.gadgetBox;
      items.grant(item); game.set(`box.${box}`, true); game.emit('box:opened', { id: box, item });
      wait(0.5); how = 'opened';
    } else if (e.type === 'key' || e.type === 'cache') {
      const piece = rt.piece(eid), at = piece?.pos;
      if (at) { const s = near(at, 1.3); if (s) goTo(s, at.clone().sub(s)); wait(1.5); }
      const nearest = bestInteractable(P);
      if (nearest?.entry?.id === `temple.${rt.id}.${eid}`) { nearest.entry.use(P); wait(1.5); }
      if (L.isFound(eid)) how = 'taken';
      else { L.find(eid); logical.push(eid); how = 'found (logic)'; }
    } else if (e.lock) {
      const door = rt.piece(eid);
      if (door?.group) {
        for (const sd of [1, -1]) {
          const p = door.group.localToWorld(V(0, 0, sd * 1.6));
          const s = standAt(p, door.group.position.y, 1.2);
          if (!s) continue;
          goTo(s);
          wait(1.2 * (L.keyholes?.(eid) ?? 1) + 0.5, () => !L.canUnlock(eid));
          break;
        }
      }
      if (L.unlocked(eid) || !L.canUnlock(eid)) how = 'unlocked';
      else { while (L.canUnlock(eid)) L.unlock(eid); logical.push(eid); how = 'unlocked (logic)'; }
    } else if (e.type === 'plate') {
      const plate = rt.piece(eid);
      if (plate?.pos) { goTo(plate.pos.clone()); wait(1); }
      if (L.pressed(eid)) how = 'stood on';
      else { L.press(eid, 'player'); rt.applyDoors(); wait(1); L.release(eid, 'player'); logical.push(eid); how = 'stood on (logic)'; }
      const off = near(plate?.pos ?? P.pos, 3);
      if (off) goTo(off);
    } else if (e.type === 'boss') {
      // (what it requires that only holds in the fight, a vane turning under it: the fight's own tests turn it)
      if (!L.check(e.requires)) for (const [k, x] of Object.entries(L.def.elements)) if (x.room === e.room && held(x) && JSON.stringify(e.requires).includes(`"${k}"`)) { L.light(k); logical.push(k); if (L.check(e.requires)) break; }
      if (!L.check(e.requires)) { fail(`the guardian faced before what it requires is done (${JSON.stringify(e.requires)})`); break; }
      if (rt.guardian?.resolve) rt.guardian.resolve(); else rt.onBossResolved?.();
      how = 'guardian';
    } else {
      how = latched(eid);
      if (!how) {
        if (e.type === 'brazier' && rt.piece(eid)?.o?.hood) { fail(`brazier ${eid}: its ball never lit it`); break; }
        if (rt.pieces.some((p) => p instanceof Ball && p.o.lamp?.id === eid)) { fail(`${eid}: its orb never woke it`); break; }
        if (L.light(eid)) rt.onLit?.(eid);
        logical.push(eid); how = `${e.type} (logic: ${rt.piece(eid)?.constructor?.name ?? 'no piece'})`;
      }
    }
    if (!how) break;
    steps.push({ id: eid, how });
    if (held(e)) kept.add(eid);
    say(`${e.type} ${eid}: ${how}`);
    rt.applyDoors();
    wait(1);
  }
  return { done: L.resolved, steps, failed, logical, margins, notes, time };
}

for (const id of Object.keys(TEMPLES)) {
  test(`${TEMPLES[id].def.name ?? id} (${id}), played through for real: every ball rolled by real hits, its timers running, what it lights lit by it`, () => {
    const r = playTemple(id, { log: !!process.env.TEMPLE_LOG });
    assert.deepEqual(r.failed, [], `${id}: ${r.failed.join('; ')}\n  (${r.steps.map((s) => `${s.id}: ${s.how}`).join(' / ')})`);
    assert.equal(r.done, true, `${id}: the guardian reached and resolved (${r.steps.map((s) => `${s.id}: ${s.how}`).join(' / ')})`);
    const balls = Object.entries(TEMPLES[id].def.logic.elements).filter(([, e]) => e.type === 'drum').map(([b]) => b);
    for (const b of balls) assert.ok(!r.logical.includes(b), `${id}: ${b} was rolled for real`);
    // (every weight on the way carried for real: picked up, carried and put down on its plate; issue #337)
    const weights = Object.entries(TEMPLES[id].def.logic.elements).filter(([, e]) => e.type === 'weight' && !e.optional).map(([w]) => w);
    for (const w of weights) assert.ok(r.steps.some((s) => s.id === w && s.how === 'carried onto its plate'), `${id}: ${w} carried onto its plate`);
    if (process.env.TEMPLE_LOG) console.error(`  [${id}] margins: ${r.margins.map((m) => `${m.id} → ${m.lights} ${m.spare.toFixed(2)} s`).join(', ') || 'none'}; done through the logic: ${r.logical.join(', ') || 'nothing'}`);
    for (const m of r.margins) assert.ok(m.spare >= SPARE, `${id}: ${m.id} lit ${m.lights} with ${m.spare.toFixed(2)} s to spare (at least ${SPARE})`);
  });
}
