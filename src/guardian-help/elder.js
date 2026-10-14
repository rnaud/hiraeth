// Fly with the Elder (issue #339, a prototype: ?level=arzach&guardianHelp=elder; docs/design/helper-guardians.md).
//
// The Roost of the Aerie, the Elder on its floor, afraid to fly alone (LORE.md, "The Aerie"). Open your wings in the
// vent's rising wind and she rises with you to its top, then flies three flights round the roost, each higher
// (FLIGHT.flights: low and level, then swinging out over the vents, then up toward the oculus), her wake holding your
// wings up and carrying you at her pace (FLIGHT.wake: stay in it and you stay up; leave it and you sink). As she beats her
// old wings her stone feathers loosen (the moult: the birds raised here shed their first stone feathers in the Moult):
// each shakes loose on one wingtip first, glowing (the side to fly on), then falls behind her, a ring on the floor under
// it shrinking as it nears. Catch it on the wing before it shatters there. A flight may lose FLIGHT.miss of its
// feathers; lose more and she falters, glides down and sits shaking (FLIGHT.shaken), and that flight begins again from
// the vent. The three flown, she spirals up out of the oculus into the open sky, comes back down calm, and folds her
// wings: the shipped hand on her neck (boss.js final 'touch') resolves the Aerie.
//
// The rules are ElderFlight's own state and a few vectors; the drawn feathers, rings and wake are a view on them.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { annulus } from '../temples/kit.js';
import { poseGuardian } from './pose.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

/**
 * The encounter's numbers. speed: her airspeed (m/s; the wings' own cruise is 15, so you catch her up from behind);
 * flights: r (m round the roost's middle), wob (m: how far the circle swings in and out, twice a turn), y0 → y1 (m over
 * the floor across the flight), turns, feathers, line (said as it begins); miss: feathers a flight may lose.
 * vent: the vent she rises in beside you (x, z off the roost's middle when no wind says which, r its column's; beside:
 * where she hangs, off its axis, outward;
 * from: how high over the floor you must be in it; top: how high she rises with you before she peels off; leave: s you
 * may be out of it before she goes back down). takeoff: s from the column onto her route; slow: m/s she starts at;
 * wait: s at most she hangs by the column, slowly, while you are still in its wind.
 * wake: back / ahead (m behind and before her it reaches), r (m to either side of her line), lift (m/s up at most), rate
 * (1/s the wings settle to it), tow (1/s your pace to hers), catchUp (m/s over hers while you are behind, under it while
 * ahead), steer (1/s it turns you along her line while the stick is let go), draw (rad a metre off her line it turns you
 * back toward it), drop (m under her you are held at).
 * feather: tell (s it shakes loose on her wingtip first), fall (m/s), toss (m/s out of her turn), keep (the share of her
 * pace it keeps: it falls back into her wake), up (m/s up as it comes away), drag (1/s on the toss), sway (m/s of
 * flutter), grab (m from your chest: caught). shaken: s she sits. finale: up (m over the floor she climbs to, out of the
 * oculus), climb and down (s). calm: the meter once she settles.
 */
export const FLIGHT = {
  speed: 11.5,
  flights: [
    { r: 12.5, wob: 0, y0: 9.5, y1: 10, turns: 2.5, feathers: 5, line: 'She lifts off, low and unsteady. Stay in her wake; catch what she sheds.' },
    { r: 12.5, wob: 2, y0: 10.5, y1: 13, turns: 2.5, feathers: 5, line: 'Higher now, swinging out over the vents.' },
    { r: 12.5, wob: 1, y0: 13.5, y1: 17.5, turns: 2.5, feathers: 5, line: 'Up toward the open sky. Her oldest feathers are going.' },
  ],
  miss: 1,
  vent: { x: 8, z: 0, r: 4.5, beside: [2.4, 2.6], from: 2, top: 13, leave: 2.5 },
  takeoff: 2.6, slow: 5.5, wait: 3,
  wake: { back: 10, ahead: 4, r: 7, lift: 4.5, rate: 10, tow: 2.2, catchUp: 2.5, steer: 3, draw: 0.12, drop: 0.4 },
  feather: { tell: 1.4, fall: 2.1, toss: 1.2, keep: 0.65, up: 0.8, drag: 0.7, sway: 0.6, grab: 3.2 },
  shaken: 3.5,
  finale: { up: 30, climb: 5, down: 4.5 },
  calm: 0.9,
};

/** Her route through a flight at angle th (rad from the roost's +z, round toward +x): { x, y, z } over the roost's middle and floor. */
export function routeAt(F, th, k) {
  const r = F.r + F.wob * Math.sin(2 * th);
  return { x: Math.sin(th) * r, y: F.y0 + (F.y1 - F.y0) * k + 0.6 * Math.sin(3 * th), z: Math.cos(th) * r };
}
/** How long a flight takes (s). */
export const flightTime = (F, speed = FLIGHT.speed) => (F.turns * TAU * F.r) / speed;

export class ElderFlight {
  /** rt: the Aerie's temple runtime (its guardian, the Elder; its arena, the Roost); o: { hud }. */
  constructor(rt, { hud = null } = {}) {
    this.rt = rt; this.G = rt.guardian; this.hud = hud;
    const A = this.G.arena;
    this.c = A.center.clone(); this.floor = A.y;
    this.home = (this.G.model.home ?? this.c).clone();
    this.homeHeading = this.G.model.heading;
    this.feathers = [];
    this.caught = 0; this.lost = 0; this.tries = 0;
    this.total = FLIGHT.flights.reduce((n, F) => n + F.feathers, 0);
    this.flight = 0;
    this.phase = 'ground'; this.t = 0; this.time = 0;
    this.th = 0; this.ft = 0; this.dropped = 0; this.flightCaught = 0; this.flightLost = 0;
    this.vel = V(); this.prevPos = this.G.model.pos.clone();
    this.inWake = false; this.wakeT = 0;
    this.view3 = new ElderView(rt, this);
    rt.notice('She will not fly alone. Open your wings in the wind rising out of the vent, and she will rise with you.', 'help.elder.start');
  }

  /** The traveller where the encounter starts: on the roost's floor, between the door and her, facing her. */
  enter(P) {
    const at = this.c.clone().add(V(0, 0.2, -10));
    P.teleport(at, V(0, 1, 0), V(0, 0, 1));
    P.heading = Math.atan2(this.home.x - at.x, this.home.z - at.z);
    P.vel?.set?.(0, 0, 0);
  }

  get F() { return FLIGHT.flights[Math.min(this.flight, FLIGHT.flights.length - 1)]; }
  get done() { return this.phase === 'done'; }
  /** Where she is now (world). */
  get pos() { return this.G.model.pos; }

  /** A point over the roost's floor (x, z off its middle, y over the floor) in the world. */
  at(x, y, z, out = V()) { return out.set(this.c.x + x, this.floor + y, this.c.z + z); }

  enterPhase(p) { this.phase = p; this.t = 0; }

  update(dt, t) {
    const G = this.G, m = G.model, P = this.rt.player;
    this.t += dt; this.time += dt;
    let pose = 'open', phaseN = 0, place = true, bank = 0, solid = true, speed = 0;
    switch (this.phase) {
      case 'ground': {
        // (on her floor, trembling, looking up: once you open your wings in the east vent's wind she comes into it beside you)
        m.pos.copy(this.home); m.heading = this.homeHeading;
        if (P && this.inVent(P) && P.pos.y > this.floor + FLIGHT.vent.from) {
          this.enterPhase('rise'); this.from = m.pos.clone(); this.away = 0;
          this.rt.notice('She hops into the wind beside you, and rises with you.', 'help.elder.rise');
        }
        break;
      }
      case 'rise': {
        // (up the column beside you, a little over you, to its top; out of it too long and she goes back down)
        const Vn = FLIGHT.vent, u = smooth(this.t / 1.4), b = this.besideVent(), spot = this.at(b.x, 0, b.z);
        const y = Math.min(Vn.top, Math.max(this.riseY ?? 0, (P ? P.pos.y - this.floor : 0) + 0.6) * u);
        this.riseY = y;
        m.pos.lerpVectors(this.from, spot, u).setY(this.floor + y);
        m.heading = Math.atan2(Math.cos(Math.PI / 2), -Math.sin(Math.PI / 2));
        pose = 'fight'; phaseN = 1; place = false; solid = false; speed = 0;
        this.away = P && this.inVent(P) ? 0 : this.away + dt;
        if (this.away > Vn.leave) { this.riseY = 0; this.from = m.pos.clone(); this.fromHeading = m.heading; this.enterPhase('land'); break; }
        if (y >= Vn.top - 0.05 && this.t > 1.5) this.beginFlight();
        break;
      }
      case 'land': {
        // (back down to her floor, nothing lost: you left the wind before she was up)
        const u = smooth(this.t / 2);
        m.pos.lerpVectors(this.from, this.home, u);
        pose = u < 0.85 ? 'fight' : 'open'; phaseN = u < 0.85 ? 1 : 0; place = u >= 0.85; solid = u >= 0.85;
        if (this.t >= 2) { this.enterPhase('ground'); this.rt.notice('She drops back to her floor. She will rise only in the wind beside you.', 'help.elder.land'); }
        break;
      }
      case 'takeoff': case 'fly': {
        const F = this.F, T = flightTime(F), k = this.ft / T;
        // (taking off she waits by the column, slowly, until you are out of its wind, then gathers her pace)
        if (this.phase === 'takeoff' && (!P?.hovering || this.t > FLIGHT.wait)) this.ramp += dt;
        const pace = this.phase === 'takeoff' ? (this.ramp > 0 ? THREE.MathUtils.lerp(FLIGHT.slow, FLIGHT.speed, smooth(this.ramp / FLIGHT.takeoff)) : 2.5) : FLIGHT.speed;
        this.th += (pace / Math.max(4, F.r + F.wob * Math.sin(2 * this.th))) * dt;
        this.ft += dt;
        const r = routeAt(F, this.th, clamp(k, 0, 1));
        this.at(r.x, r.y, r.z, m.pos);
        if (this.phase === 'takeoff') {
          // (out of the column's top onto her route, eased)
          m.pos.lerpVectors(this.from, m.pos.clone(), smooth((this.t * 0.25 + this.ramp) / FLIGHT.takeoff));
          if (this.ramp >= FLIGHT.takeoff) this.enterPhase('fly');
        }
        m.heading = Math.atan2(Math.cos(this.th), -Math.sin(this.th));   // (along her circle, turning toward +x from +z: the tangent)
        bank = -0.32; this.pace = pace;
        pose = 'fight'; phaseN = 1; place = false; solid = false; speed = FLIGHT.speed;
        if (this.phase === 'fly' || this.t > 1) this.shed(F, T);
        if (this.flightLost > FLIGHT.miss) { this.falter(); break; }
        if (this.ft >= T && this.dropped >= F.feathers && !this.feathers.some((f) => f.state === 'fall' || f.state === 'loose')) this.flightDone();
        break;
      }
      case 'falter': {
        // (she glides down to her floor, shaking)
        const u = smooth(this.t / 2.6);
        m.pos.lerpVectors(this.from, this.home, u);
        m.heading = this.fromHeading + Math.atan2(Math.sin(this.homeHeading - this.fromHeading), Math.cos(this.homeHeading - this.fromHeading)) * u;
        pose = u < 0.85 ? 'fight' : 'weary'; phaseN = u < 0.85 ? 1 : 0; place = u >= 0.85; solid = u >= 0.85;
        if (this.t >= 2.6) this.enterPhase('shaken');
        break;
      }
      case 'shaken': {
        m.pos.copy(this.home); m.heading = this.homeHeading; pose = 'weary';
        if (this.t >= FLIGHT.shaken) { this.enterPhase('ground'); this.riseY = 0; this.rt.notice('She looks up again. Open your wings in the vent’s wind when you are ready.', `help.elder.again.${this.tries}`); }
        break;
      }
      case 'finale': {
        // (a tight climb up out of the oculus, a turn in the open sky, and down again to her floor)
        const C = FLIGHT.finale, up = this.t < C.climb;
        if (up) {
          const u = smooth(this.t / C.climb), th = this.th + u * TAU * 1.25, rr = THREE.MathUtils.lerp(this.F.r, 5, u);
          this.at(Math.sin(th) * rr, THREE.MathUtils.lerp(this.from.y - this.floor, C.up, u), Math.cos(th) * rr, m.pos);
          m.heading = Math.atan2(Math.cos(th), -Math.sin(th));
          this.top = m.pos.clone(); this.topHeading = m.heading;
        } else {
          const u = smooth((this.t - C.climb) / C.down);
          m.pos.lerpVectors(this.top, this.home, u);
          m.heading = this.topHeading + Math.atan2(Math.sin(this.homeHeading - this.topHeading), Math.cos(this.homeHeading - this.topHeading)) * u;
        }
        pose = 'fight'; phaseN = 1; place = false; solid = false; bank = up ? -0.4 : 0;
        if (this.t >= C.climb + C.down) this.settle();
        break;
      }
      case 'settle': {
        // (calm, wings folded: the shipped hand on her neck, boss.js, is enabled by 'weary')
        m.pos.copy(this.home); m.heading = this.homeHeading; pose = 'weary';
        if (G.state === 'resolved') this.enterPhase('done');
        break;
      }
      case 'done': {
        // (calm, she rides the wind up out of the roost, as the shipped line says, and is gone to the Aerie's crown)
        const u = smooth(this.t / 5);
        this.at(this.home.x - this.c.x, u * (FLIGHT.finale.up + 6), this.home.z - this.c.z, m.pos);
        pose = this.t < 0.6 ? 'resolved' : 'fight'; phaseN = this.t < 0.6 ? 0 : 1; place = false; solid = false;
        if (this.t > 5) m.group.visible = false;
        break;
      }
    }
    this.vel.subVectors(m.pos, this.prevPos).divideScalar(Math.max(dt, 1e-4)); this.prevPos.copy(m.pos);
    this.updateFeathers(dt);
    this.wake(dt, P);
    if (this.phase !== 'settle' && this.phase !== 'done') G.meter = Math.min(FLIGHT.calm - 0.05, FLIGHT.calm * (this.caught / this.total));
    poseGuardian(G, dt, t, { state: pose, phase: phaseN, speed, place, bank, solid });
    this.view3.update(dt, t);
    this.showHud();
  }

  /**
   * Where she will be `s` seconds on along her flight (world; at her pace, the takeoff's ease left out): for whoever
   * flies to meet her (the scripted pilot of tests/guardian-help.test.js; a hint).
   */
  ahead(s, out = V()) {
    if (!['takeoff', 'fly'].includes(this.phase)) return out.copy(this.G.model.pos);
    const F = this.F, pace = this.pace ?? FLIGHT.speed, th = this.th + (pace / Math.max(4, F.r)) * s;
    const r = routeAt(F, th, clamp((this.ft + s) / flightTime(F), 0, 1));
    return this.at(r.x, r.y, r.z, out);
  }
  /** The vent whose wind rises now (the roost's one stone sits in the other), off the roost's middle: { x, z, s (+1 east) }. */
  ventNow() {
    const w = this.rt.roostWinds?.find((u) => u.on), x = w ? w.foot.x - this.c.x : FLIGHT.vent.x;
    return { x, z: w ? w.foot.z - this.c.z : FLIGHT.vent.z, s: Math.sign(x) || 1 };
  }
  /** Where she hangs in its wind beside you (off the roost's middle). */
  besideVent() { const v = this.ventNow(), [bx, bz] = FLIGHT.vent.beside; return { x: v.x + v.s * bx, z: v.z + bz }; }
  /** In the rising vent's column, wings open. */
  inVent(P) {
    const v = this.ventNow();
    return !!P && P.gliding && !P.onGround && Math.hypot(P.pos.x - this.c.x - v.x, P.pos.z - this.c.z - v.z) < FLIGHT.vent.r + 0.5;
  }
  beginFlight() {
    this.from = this.G.model.pos.clone();
    this.enterPhase('takeoff');
    const b = this.besideVent(); this.th = Math.atan2(b.x, b.z); this.ft = 0; this.ramp = 0; this.dropped = 0; this.flightCaught = 0; this.flightLost = 0;
    this.tries++;
    this.rt.notice(this.F.line, `help.elder.flight.${this.flight}.${this.tries}`);
    this.rt.sound?.critter?.('creak', 1.2);
  }
  /** Her feathers come loose at even times over the flight, off one wingtip and then the other. */
  shed(F, T) {
    if (this.dropped >= F.feathers) return;
    const when = ((this.dropped + 0.5) / F.feathers) * T - FLIGHT.feather.tell;
    if (this.ft < when) return;
    // (first it loosens on her wingtip, shaking and glowing, for feather.tell s: the side to fly on; then it falls)
    const side = this.dropped % 2 ? 1 : -1;
    const f = { pos: V(), vel: V(), t: 0, state: 'loose', side, from: 0, phase: this.dropped * 1.7, flight: this.flight };
    this.tip(f, f.pos);
    this.feathers.push(f);
    this.dropped++;
    this.view3.added(f);
    this.rt.notice(`A feather loosens on her ${side < 0 ? 'left' : 'right'} wing: fly on that side, close behind her.`, 'help.elder.loose');
  }
  /** Her wingtip on a feather's side (world). */
  tip(f, out) {
    const m = this.G.model, fx = Math.sin(m.heading), fz = Math.cos(m.heading);
    return out.set(m.pos.x + fz * f.side * 3.4 - fx * 0.6, m.pos.y + 0.5, m.pos.z - fx * f.side * 3.4 - fz * 0.6);
  }
  /**
   * It comes away: off her wingtip, keeping some of her pace, tossed out of her turn (her right wing, on the inside of
   * it, drops its feathers in toward her line, where you can follow; her left wing's fall outside it: swing out for them).
   */
  loosed(f) {
    const m = this.G.model, fx = Math.sin(m.heading), fz = Math.cos(m.heading), Fe = FLIGHT.feather, pace = this.pace ?? FLIGHT.speed;
    f.state = 'fall'; f.t = 0;
    this.tip(f, f.pos);
    f.vel.set(fx * pace * Fe.keep - fz * Fe.toss, Fe.up, fz * pace * Fe.keep + fx * Fe.toss);
    f.from = f.pos.y - this.floor;
  }
  /** Seconds before a falling feather reaches the floor. */
  leftOf(f) { return Math.max(0, (f.pos.y - this.floor) / FLIGHT.feather.fall); }
  updateFeathers(dt) {
    const Fe = FLIGHT.feather, P = this.rt.player, R = this.G.arena.r - 1.4;
    const chest = P ? V(P.pos.x, P.pos.y + 0.9, P.pos.z) : null;
    for (const f of this.feathers) {
      f.t += dt;
      if (f.state === 'loose') {
        // (on her wingtip, until it comes away; she faltering, it goes with her: let go)
        if (!['takeoff', 'fly'].includes(this.phase)) { f.state = 'lost'; f.t = 0; this.view3.lost(f, true); continue; }
        this.tip(f, f.pos);
        if (f.t >= Fe.tell) this.loosed(f);
        continue;
      }
      if (f.state !== 'fall') continue;
      const d = Math.exp(-Fe.drag * dt);
      f.vel.x *= d; f.vel.z *= d;
      f.vel.y += (-Fe.fall - f.vel.y) * (1 - Math.exp(-1.6 * dt));
      f.pos.addScaledVector(f.vel, dt);
      // (its flutter: a slow swing side to side as it tumbles)
      f.pos.x += Math.cos(f.t * 2.3 + f.phase) * Fe.sway * dt; f.pos.z += Math.sin(f.t * 1.9 + f.phase) * Fe.sway * dt;
      const ox = f.pos.x - this.c.x, oz = f.pos.z - this.c.z, o = Math.hypot(ox, oz);
      if (o > R) { f.pos.x = this.c.x + (ox / o) * R; f.pos.z = this.c.z + (oz / o) * R; }
      if (chest && !P.onGround && chest.distanceTo(f.pos) < Fe.grab) { this.catchIt(f); continue; }
      if (f.pos.y <= this.floor + 0.12) this.shatter(f);
    }
    this.feathers = this.feathers.filter((f) => f.state === 'fall' || f.state === 'loose' || f.t < 30);
  }
  catchIt(f) {
    f.state = 'caught'; f.t = 0;
    this.caught++; if (f.flight === this.flight) this.flightCaught++;
    this.rt.sound?.chime?.();
    this.rt.notice('You catch the stone feather on the wing. She calls, and beats on.', 'help.elder.caught');
    this.view3.caught(f);
  }
  shatter(f) {
    f.state = 'lost'; f.t = 0;
    this.lost++; if (f.flight === this.flight) this.flightLost++;
    this.rt.rumble?.(0.4, 0.25);
    this.rt.notice(this.flightLost > FLIGHT.miss ? 'Another shatters. She falters.' : 'A feather shatters on the floor. She flinches, and flies on.', `help.elder.lost.${this.flightLost > FLIGHT.miss ? 'two' : 'one'}`);
    this.view3.lost(f);
  }
  /** Too many lost: she glides down and sits shaking; this flight again. */
  falter() {
    this.from = this.G.model.pos.clone(); this.fromHeading = this.G.model.heading;
    this.caught -= this.flightCaught;   // (this flight's feathers again: what was caught in it is let go with it)
    for (const f of this.feathers) if (f.state === 'fall' || f.state === 'loose') { f.state = 'lost'; f.t = 0; this.view3.lost(f, true); }
    this.enterPhase('falter');
    this.rt.notice('She drops down to her floor and sits shaking. That flight again, when she is ready.', `help.elder.falter.${this.tries}`);
  }
  flightDone() {
    this.flight++;
    this.ft = 0; this.dropped = 0; this.flightCaught = 0; this.flightLost = 0;
    if (this.flight < FLIGHT.flights.length) {
      this.rt.sound?.chime?.();
      this.rt.notice(this.F.line, `help.elder.flight.${this.flight}`);
      return;
    }
    this.flight = FLIGHT.flights.length - 1;
    this.from = this.G.model.pos.clone();
    this.enterPhase('finale');
    this.rt.notice('She climbs, round and round, up out of the oculus into the open sky.', 'help.elder.finale');
  }
  settle() {
    this.flight = FLIGHT.flights.length;
    this.enterPhase('settle');
    const G = this.G;
    G.meter = FLIGHT.calm; G.floor = FLIGHT.calm;
    G.state = 'weary'; G.t = 0;   // (the shipped hand on her neck, boss.js final 'touch': enabled while weary)
    this.rt.notice(G.def.weary, 'help.elder.weary');
  }

  /**
   * Her wake: gliding near the point behind her, your wings are held up level with her (a lift, no more than
   * wake.lift m/s) and carried at her pace. Out of it the wings sink as anywhere.
   */
  wake(dt, P) {
    this.inWake = false;
    if (!P || !P.gliding || P.onGround || !['takeoff', 'fly', 'finale'].includes(this.phase) || P.hovering) return;
    const W = FLIGHT.wake, m = this.G.model;
    // (the air behind and beside her: W.back m behind her to W.ahead in front, W.r m to either side)
    const fx = Math.sin(m.heading), fz = Math.cos(m.heading), ox = P.pos.x - m.pos.x, oz = P.pos.z - m.pos.z;
    const along = ox * fx + oz * fz, side = ox * fz - oz * fx;
    if (along < -W.back || along > W.ahead || Math.abs(side) > W.r || Math.abs(P.pos.y + 0.9 - m.pos.y) > W.r + 2) return;
    this.inWake = true; this.wakeT += dt;
    const want = clamp((m.pos.y - W.drop - P.pos.y) * 1.4 + this.vel.y, -2.5, W.lift);
    P.vel.y += (want - P.vel.y) * (1 - Math.exp(-W.rate * dt));
    // (carried at her pace: behind her a little quicker, so you close up; ahead, a little slower, so she comes up beside you)
    const pace = (this.pace ?? FLIGHT.speed) + (along < -3 ? W.catchUp : along > 1 ? -W.catchUp : 0);
    P.glideSpeed += (pace - (P.glideSpeed ?? pace)) * (1 - Math.exp(-W.tow * dt));
    // (the stick let go, it turns you along her line, as she turns, drawn in toward it: her wake carries you; steering,
    // you leave it as you like)
    if (Math.abs(P.glideTurn ?? 0) < 0.15) {
      const want2 = m.heading - clamp(side * W.draw, -0.6, 0.6);
      P.heading += Math.atan2(Math.sin(want2 - P.heading), Math.cos(want2 - P.heading)) * (1 - Math.exp(-W.steer * dt));
    }
    this.rt.notice('Her wake holds your wings up. Stay in it.', 'help.elder.wake');
  }

  /** The camera (main.js, through startGuardianHelp's frame): wide while she flies, turned onto both of you. */
  view(P) {
    if (this.phase === 'done') return { camera: null };
    const m = this.G.model, flying = ['rise', 'takeoff', 'fly', 'finale', 'falter', 'land'].includes(this.phase);
    const look = V().lerpVectors(P.pos, m.pos, flying ? 0.7 : 1);
    if (flying) look.addScaledVector(V(Math.sin(P.heading), 0, Math.cos(P.heading)), 6);
    return { camera: flying ? { arm: 7, pitch: 0.02, look: 0.6, rate: 1.2 } : { arm: 3, pitch: 0.1, look: 0.6, rate: 1.2 }, look, rate: flying ? 1.6 : 0.8 };
  }

  showHud() {
    if (!this.hud) return;
    const F = FLIGHT.flights, i = Math.min(this.flight, F.length - 1), n = F[i].feathers;
    const mine = this.feathers.filter((f) => f.flight === i && this.flight < F.length);
    const pips = Array.from({ length: n }, (_, k) => { const f = mine[k]; return { on: f?.state === 'caught', miss: f?.state === 'lost' }; });
    const falling = this.feathers.filter((f) => f.state === 'fall');
    const bar = falling.length ? Math.min(...falling.map((f) => this.leftOf(f) / Math.max(0.5, f.from / FLIGHT.feather.fall))) : 0;
    const line = {
      ground: 'Open your wings in the vent’s rising wind (the rings): she will not fly alone.', rise: 'Up the wind beside her, to its top.',
      land: 'She goes back down: stay in the wind with her.',
      takeoff: 'Stay in her wake: it holds your wings up.',
      fly: this.inWake ? 'In her wake. Swoop to the glowing feathers before they reach the floor.' : 'Out of her wake you sink: back behind her, or up the vent’s wind.',
      falter: 'She falters…', shaken: 'She sits shaking. That flight again in a moment.',
      finale: 'She climbs out into the open sky.', settle: 'She settles. Lay a hand on her neck.', done: 'She flies again.',
    }[this.phase];
    const count = this.flight >= F.length ? `${this.caught} / ${this.total} feathers` : `Flight ${i + 1} of ${F.length} · ${this.caught} / ${this.total} feathers`;
    this.hud.set({ line, count, pips: this.phase === 'settle' || this.phase === 'done' || this.phase === 'finale' ? [] : pips, bar, tone: '#e6b86f' });
  }
  dispose() { this.view3.dispose(); this.hud?.dispose(); }
}

// ------------------------------------------------------------------ the view: the feathers, their rings, her wake
const FEATHER_GEO = (() => {
  const vane = new THREE.SphereGeometry(1, 10, 6).scale(0.22, 0.04, 0.85);
  return vane;
})();

class ElderView {
  constructor(rt, E) {
    this.rt = rt; this.E = E;
    this.root = new THREE.Group(); this.root.name = 'Fly with the Elder (prototype)';
    this.root.userData.noCollide = true;
    rt.root.add(this.root);
    this.featherM = makeMaterial({ color: '#f1ece0', glow: 0.45, flat: true, side: THREE.DoubleSide, key: 'help.elder.feather' });
    this.ringM = makeMaterial({ color: '#e6b86f', glow: 0.8, flat: true, side: THREE.DoubleSide, key: 'help.elder.ring' });
    this.lostM = makeMaterial({ color: '#8f8676', glow: 0.2, flat: true, side: THREE.DoubleSide, key: 'help.elder.lost' });
    this.wakeM = makeMaterial({ color: '#fbf7ee', glow: 0.6, flat: true, key: 'help.elder.wake' });
    this.ringG = annulus(0.85, 1.1, 0.04, 28);
    this.items = new Map();
    // her wake: motes of light off each wingtip (her last places, every 0.05 s), shrinking as they fall behind
    this.trail = [[], []];
    this.streaks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), this.wakeM, 2 * 24);
    this.streaks.frustumCulled = false; this.streaks.count = 0; this.streaks.userData.noCollide = true; this.streaks.userData.dynamic = true;
    this.root.add(this.streaks);
    this.sample = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = V(); this._a = V(); this._b = V(); this._z = V(0, 0, 1);
  }
  added(f) {
    const mesh = new THREE.Mesh(FEATHER_GEO, this.featherM);
    const ring = new THREE.Mesh(this.ringG, this.ringM);
    for (const o of [mesh, ring]) { o.userData.noCollide = true; o.userData.dynamic = true; this.root.add(o); }
    this.items.set(f, { mesh, ring });
  }
  caught(f) { const it = this.items.get(f); if (it) it.ring.visible = false; }
  lost(f, quiet = false) { const it = this.items.get(f); if (it) { it.mesh.material = this.lostM; it.quiet = quiet; } }
  update(dt) {
    const E = this.E, P = this.rt.player;
    for (const [f, it] of this.items) {
      const { mesh, ring } = it;
      if (f.state === 'loose') {
        // (shaking loose on her wingtip, glowing: the side to fly on)
        mesh.position.copy(f.pos);
        mesh.rotation.set(0.3 * Math.sin(f.t * 40), E.G.model.heading, 0.4 * Math.sin(f.t * 33 + 1));
        mesh.scale.setScalar(1 + 0.25 * Math.sin(f.t * 12));
        ring.visible = false;
      } else if (f.state === 'fall') {
        mesh.position.copy(f.pos);
        mesh.rotation.set(Math.sin(f.t * 3.1 + f.phase) * 0.9, f.t * 1.3 + f.phase, Math.cos(f.t * 2.7) * 0.6);
        mesh.scale.setScalar(1);
        // (its ring on the floor under it: as wide as the time it has left, the reach of your hand at the last)
        const k = E.leftOf(f) / Math.max(0.5, f.from / FLIGHT.feather.fall);
        ring.visible = true;
        ring.position.set(f.pos.x, E.floor + 0.06, f.pos.z);
        ring.scale.setScalar(0.6 + 2.2 * k);
      } else if (f.state === 'caught') {
        // (into your hands: it flies to you and is gone)
        const u = Math.min(1, f.t / 0.35);
        if (P) mesh.position.lerp(this._a.set(P.pos.x, P.pos.y + 1, P.pos.z), u);
        mesh.scale.setScalar(Math.max(0.01, 1 - u));
        ring.visible = false;
        if (u >= 1) this.drop(f);
      } else {
        // (shattered: its pieces lie a moment and fade; its ring spreads out grey)
        mesh.position.y = Math.max(E.floor + 0.05, mesh.position.y);
        mesh.scale.set(1.4, 0.3, 1.4).multiplyScalar(Math.max(0.01, 1 - f.t / 1.2));
        ring.material = this.lostM;
        ring.scale.setScalar(1 + f.t * 3);
        ring.visible = !it.quiet && f.t < 0.8;
        if (f.t > 1.2) this.drop(f);
      }
    }
    // the wake: two trails of motes from her wingtips while she flies
    const m = E.G.model, flying = ['rise', 'takeoff', 'fly', 'finale'].includes(E.phase);
    this.sample += dt;
    if (this.sample > 0.05) {
      this.sample = 0;
      for (let s = 0; s < 2; s++) {
        const T = this.trail[s];
        if (flying) { const p = m.part?.('wings', V(), s ? 1 : -1) ?? m.pos.clone(); T.unshift(p); }
        else T.pop();
        if (T.length > 24) T.length = 24;
      }
    }
    let n = 0;
    for (const T of this.trail) for (let i = 0; i < T.length; i++) {
      const k = 1 - i / 24, a = T[i];
      this._q.identity();
      this._s.setScalar(Math.max(0.01, k * (0.7 + 0.3 * Math.sin(i * 1.7 + E.time * 9))));
      this._m.compose(this._a.copy(a).add(this._b.set(0, -0.06 * i, 0)), this._q, this._s);
      this.streaks.setMatrixAt(n++, this._m);
    }
    this.streaks.count = n; this.streaks.instanceMatrix.needsUpdate = true;
  }
  drop(f) { const it = this.items.get(f); if (!it) return; it.mesh.removeFromParent(); it.ring.removeFromParent(); this.items.delete(f); }
  dispose() { this.root.removeFromParent(); }
}
