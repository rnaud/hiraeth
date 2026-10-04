import * as THREE from 'three';
import { game } from '../game-state.js';
import { polar } from './geo.js';
import { R, DECK, HATCH_A } from './hull.js';
import { CONSOLE_R } from './interior.js';
import { PROLOGUE_CALL, recordingSpan, onHologram, recordingLabel } from '../story/calls.js';
import { callTimeline } from './prologue.js';
import * as sfx from './sfx.js';
import { exhaust, footPuffs } from './exhaust.js';

// What the ship's cinematics look like: cameras, the moving ship, dust,
// sounds, subtitles. The prologue's timing lives in prologue.js; the
// shorter scenes (a recording at the console, arriving, taking off) are Sequences here.

export const OBJECTIVE = 'Find a new source of power.';
/** A new game steps out without the backpack: it waits in a makers' box in Qanat, under the smoke (src/boxes/, the desert's first stage). */
export const FIRST_OBJECTIVE = 'Follow the smoke to the city.';
const stepOutObjective = () => (game.flag('item.backpack') ? OBJECTIVE : FIRST_OBJECTIVE);
const STEP_OUT_YAW = 0.34;   // rad off straight-behind when the traveller first steps out
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
const SAND = ['#e3c58f', '#d8b884', '#efd29b', '#cfa877'];
const FIRE = ['#ffd27a', '#ff9a4a', '#f2c54b', '#e6503a'];
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

/** The hologram's size over the projector (1: life size). */
export const HOLO_SCALE = 0.6;

/**
 * The view while a recording plays, in ship-local space: from behind the traveller's right
 * shoulder, so he stands at the left of the frame facing the recording, the hologram over the
 * dash in front of him and the screen with its date stamp above it.
 */
export function callShot(ship, model, t = 0) {
  const p = model.interior.points.projector ?? polar(7.95, Math.PI, DECK + 1.07);
  const push = Math.min(t * 0.03, 0.3);
  return {
    pos: ship.world(model, V(1.3, DECK + 1.95, -4.8 - push)),
    look: ship.world(model, V(p.x - 0.12, DECK + 1.82, p.z)),
    fov: 48,
  };
}

/** Facing the recording: the traveller turned to the console (ship-local heading PI). */
export function faceRecording(ship, model) {
  ship.player.heading = ship.worldHeading(model, Math.PI);
}

/**
 * Lines on a timeline: subtitles, the screen (the reel turning, its date stamp), and the
 * hologram, which rises just before the first of the parents' lines and folds away after the
 * last (`st`: { span: recordingSpan(lines), who, label }, plus what has happened).
 */
function playLines(ship, model, timeline, t, st = {}) {
  const cur = timeline.lines.find((l) => t >= l.t0 && t < l.t1) ?? null;
  if (cur !== ship._line) { ship._line = cur; ship.cinema.say(cur ? cur.line : null); }
  const who = cur?.line.who;
  const talking = !!cur && t < cur.t0 + (cur.t1 - cur.t0) * 0.9 && (who === 'father' || who === 'mother');
  model.callScreen?.set({ who: 'tape', talk: talking ? 1 : 0, speaker: who ?? 'father', label: st.label ?? '' });
  const H = ship.holo, span = st.span;
  if (!H || !span) return;
  const t0 = timeline.lines[span[0]].t0 - 0.9, t1 = timeline.lines[span[1]].t1 + 0.15;
  if (!st.shown && t >= t0 && t < t1) { st.shown = true; H.show({ parent: model.group, at: model.interior.points.projector, scale: HOLO_SCALE, who: st.who ?? 'father' }); }
  if (st.shown && !st.folded && t >= t1 && !timeline.lines[span[1]].line.cut) { st.folded = true; H.hide(); }
  H.speak(talking ? who : null);
}

// ---------------------------------------------------------------------------
// The prologue

export class PrologueDirector {
  constructor(ship) {
    this.s = ship;
    this.sp = ship.spaceCopy.model;
    this.pk = ship.parked;
    this.call = callTimeline(PROLOGUE_CALL);
    this.rec = { span: recordingSpan(PROLOGUE_CALL), who: onHologram('prologue'), label: recordingLabel('prologue') };
    const c = ship.site.crash;
    this.T = V(Math.sin(c.travel), 0, Math.cos(c.travel));
    this.N = V(this.T.z, 0, -this.T.x);
    const rest = ship.restPos;
    this.touch = rest.clone().addScaledVector(this.T, -(c.length - 16));
    this.touch.y = ship.groundAt(this.touch.x, this.touch.z) + R - 4.2;
    this.S0 = this.touch.clone().addScaledVector(this.T, -1250).addScaledVector(this.N, 160).add(V(0, 620, 0));
    this.S1 = this.touch.clone().addScaledVector(this.T, -430).addScaledVector(this.N, 25).add(V(0, 95, 0));
    this.look = new THREE.Vector3();
  }

  W(v) { return this.s.world(this.sp, v); }
  P(v) { return this.s.world(this.pk, v); }
  pt(name) { return this.sp.interior.points[name]; }

  bez(u) {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return V(0, 0, 0).addScaledVector(this.S0, a).addScaledVector(this.S1, b).addScaledVector(this.touch, c);
  }

  enter(id) {
    const s = this.s, C = s.cinema, sp = this.sp, pk = this.pk;
    switch (id) {
      case 'black':
        C.hud(false); C.bars(true); C.lids(true); C.fade(1, false, 0);
        s.placePlayer(this.W(this.pt('bunkStand')), s.worldHeading(sp, this.pt('bunkStandHeading')), false);
        pk.group.visible = false;
        if (s.crashSite) { s.crashSite.group.visible = false; s.crashSite.reveal(0); }
        pk.lightsOff = true; s.syncLights(pk);
        s.setDoor(pk, 0); s.setRamp(pk, 0);
        s.setPower('on', sp);
        sp.callScreen?.set({ who: 'idle' });
        sfx.hum(s.sound, 1);
        break;
      case 'wake': C.fade(0, false, 1.4); break;
      case 'rise': C.fade(1, false, 0.25); break;
      case 'walk':
        sp.interior.guide.visible = true;
        C.hint('Follow the lights to the cockpit');
        C.controls(true);   // (on a phone: the stick and buttons, to walk there)
        this.ringT = 0;
        break;
      case 'call': {
        C.hint(null); C.controls(false);
        sp.interior.guide.visible = false;
        s.auto = null;
        s.placePlayer(this.W(this.pt('cockpit')), s.worldHeading(sp, Math.PI), true);   // facing the recording
        sp.callScreen?.set({ who: 'tape', statik: 1, label: this.rec.label });
        break;
      }
      case 'impact':
        sfx.impact(s.sound); sfx.staticBurst(s.sound, 1.6); sfx.alarm(s.sound, 1); sfx.hum(s.sound, 0.25);
        s.shake(2.2);
        s.setPower('alarm', sp);
        sp.callScreen?.set({ statik: 1, crack: 1, talk: 0 });
        s.holo?.speak(null); s.holo?.glitch(1);   // the picture tears apart
        C.say({ who: 'ship', text: 'Impact. Hull breach.' });
        C.fade(1, true, 0); setTimeout(() => C.fade(0, true, 0.35), 60);
        break;
      case 'fall':
        C.say({ who: 'ship', text: 'Emergency descent.' });   // (after "Main power lost.": a new line, not an echo)
        break;
      case 'streak':
        C.say(null); C.red(0);
        s.holo?.clear();
        sfx.alarm(s.sound, 0); sfx.hum(s.sound, 0); sfx.roar(s.sound, 4.8);
        s.removeSpaceCopy();
        // the player waits, hidden, inside the parked ship; the ship itself flies in
        s.placePlayer(this.P(pk.interior.points.hatchIn), s.worldHeading(pk, HATCH_A), false);
        pk.group.visible = true;
        s.crashSite && (s.crashSite.group.visible = true, s.crashSite.berm.visible = false);
        s.setPower('dead', pk);
        C.fade(0, true, 0.5);
        break;
      case 'plough':
        sfx.impact(s.sound); sfx.rumble(s.sound, 3.6, 0.8);
        s.shake(2.6);
        break;
      case 'settle':
        pk.group.position.copy(s.restPos); pk.group.quaternion.copy(s.restQuat);
        s.crashSite?.reveal(1);
        if (s.crashSite) s.crashSite.berm.visible = true;
        s.startSmoke = true;
        break;
      case 'hatch':
        pk.lightsOff = false;
        s.setPower('emergency', pk);
        break;
      case 'stepout': {
        const thr = this.P(polar(9.0, HATCH_A, DECK));
        s.placePlayer(thr, s.site.heading, true);
        s.autopilot([s.hinge.clone().addScaledVector(s.outDir, 0.6), s.rampFoot.clone(), s.rampFoot.clone().addScaledVector(s.outDir, 2.2)]);
        break;
      }
      case 'objective':
        s.rig.yaw = s.player.heading + Math.PI;
        s.rig.pitch = 0.2;
        s.release(1.4);
        C.bars(false); C.hud(true);
        C.objective(stepOutObjective());
        s.sound?.chime?.();
        break;
    }
  }

  frame(id, t, dt) {
    const s = this.s, C = s.cinema, sp = this.sp, pk = this.pk;
    const U = s.post?.uniforms;
    if (U && sp && ['black', 'wake', 'rise', 'walk', 'call', 'impact', 'fall'].includes(id)) U.uFogMul.value = 0;   // no haze in space
    switch (id) {
      case 'black':
      case 'wake': {
        // lying in bed: the drawing taped under the shelf over the pillows, then sitting up
        const eye = this.pt('wakeEye'), look = this.pt('wakeLook');
        const up = id === 'wake' ? smooth(seg(t, 4.6, 6.8)) : 0;
        const sit = eye.clone().lerp(eye.clone().add(V(0, 0.4, 0)).lerp(this.pt('bunkStand'), 0.35).setY(DECK + 1.25), up);
        const lk = look.clone().lerp(polar(3.4, 0.05, DECK + 1.4), up);
        s.shot({ pos: this.W(sit), look: this.W(lk), fov: 62, roll: (1 - up) * 0.12 });
        if (id === 'wake') {
          // eyes: half open, a blink, then open
          const k = t < 0.6 ? 0 : t < 1.6 ? 0.35 * smooth(seg(t, 0.6, 1.6)) : t < 2.1 ? 0.35 - 0.3 * smooth(seg(t, 1.6, 2.0)) : 0.05 + 0.95 * smooth(seg(t, 2.3, 3.6));
          C.eyelids(k);
          if (t > 3.9 && !this.said) { this.said = true; sfx.ring(s.sound); C.say({ who: 'ship', text: 'Good morning. The reel is cued in the cockpit, where you left it.' }); }
        }
        break;
      }
      case 'rise':
        if (t > 0.3 && !this.risen) {
          this.risen = true;
          C.releaseLids(); C.lids(false); C.bars(true); C.say(null);
          s.showPlayer(true);
          // (swung off the back if the headboard's shelf would be between the camera and you)
          s.rig.pitch = 0.1; s.rig.indoor = true; s.rig._wasIndoor = true;   // level, at your height (the camera's indoor rule, src/player.js)
          s.rig.yaw = s.rig.clearYaw(s.player.pos, s.player.heading + Math.PI, { want: 3 });
          s.rig.target.copy(s.player.pos); s.rig.snapTight?.(s.player.pos); s.rig._curDist = 2.5;
          s.release(0); s.blend = null;
          C.fade(0, false, 0.5);
        }
        if (!this.risen) s.shot({ pos: this.W(this.pt('wakeEye')), look: this.W(this.pt('wakeLook')), fov: 62 });
        break;
      case 'walk': {
        // the console chimes on, the lights on the floor point the way; you go when you like
        // (the ship never walks you there itself)
        if ((this.ringT -= dt) <= 0) { this.ringT = 3.2; sfx.ring(s.sound); }
        break;
      }
      case 'call':
        s.shot(callShot(s, sp, t));
        sp.callScreen?.set({ statik: Math.max(0, 1 - t / 0.8) });
        playLines(s, sp, this.call, t, this.rec);
        faceRecording(s, sp);
        break;
      case 'impact': {
        // a hand-held view of the cockpit, the red light pulsing, the planet starting to swing
        const k = smooth(seg(t, 1.2, 4.4));
        s.shot({ pos: this.W(V(-1.3, DECK + 1.7, -3.7)), look: this.W(V(0.2, DECK + 1.9 - k * 0.5, -10)), fov: 58, roll: Math.sin(t * 1.7) * 0.06 + k * 0.1 });
        C.red(0.55 + 0.35 * Math.sin(t * 6.5));
        if (Math.random() < dt * 2.2) s.shake(0.8);
        if (t > 2.4 && !this.said2) { this.said2 = true; C.say({ who: 'ship', text: 'Main power lost.' }); }
        if (t > 0.5 && !this.torn) { this.torn = true; s.holo?.hide(); }
        this.s.spaceCopy && (this.s.spaceCopy.space.rotation.x = 0.14 * k);
        // the core and the lamps stutter
        sp.mats.core.uniforms.uGlow.value = Math.random() < 0.5 ? 0 : 0.6 * (1 - k);
        break;
      }
      case 'fall': {
        const k = smooth(seg(t, 0, 2.6));
        s.shot({ pos: this.W(V(0.2, DECK + 1.75, -7.4)), look: this.W(V(0, DECK + 1.2 - k * 0.6, -14)), fov: 64, roll: 0.1 + Math.sin(t * 2.3) * 0.08 });
        if (this.s.spaceCopy) this.s.spaceCopy.space.rotation.x = 0.14 + 0.62 * k;
        C.red(0.6 + 0.3 * Math.sin(t * 6.5));
        s.shake(0.5);
        if (t > 2.15 && !this.white) { this.white = true; C.fade(1, true, 0.4); }
        break;
      }
      case 'streak': {
        const u = Math.min(1, t / 4.8);
        const p = this.bez(u);
        pk.group.position.copy(p);
        const spin = new THREE.Quaternion().setFromAxisAngle(this.T, Math.sin(t * 1.1) * 0.35);
        pk.group.quaternion.copy(spin.multiply(s.restQuat));
        const vel = this.bez(Math.min(1, u + 0.01)).sub(p).normalize();
        for (let i = 0; i < (u < 0.82 ? 3 : 0); i++) {
          const g = 0.55 + Math.random() * 0.25;
          s.smoke.emit(p.clone().addScaledVector(vel, -R * 0.6).add(V((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)), V(0, 5, 0), 3 + Math.random() * 2.5, 2.4 + Math.random() * 1.2, new THREE.Color(g, g * 0.96, g * 0.93));
          s.flame.emit(p.clone().addScaledVector(vel, R * 0.75 + Math.random() * 3).add(V((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9)), vel.clone().multiplyScalar(-30), 3 + Math.random() * 3, 0.35 + Math.random() * 0.25, pickOf(FIRE));
        }
        const cam = s.restPos.clone().addScaledVector(this.N, -82).addScaledVector(this.T, 46).add(V(0, 9, 0));
        if (t < dt * 1.5) this.look.copy(p);
        this.look.lerp(p, 1 - Math.exp(-6 * dt));
        s.shot({ pos: cam, look: this.look, fov: 40 });
        if (u > 0.8) s.shake(0.3);
        break;
      }
      case 'plough': {
        const u = Math.min(1, t / 3.8), p = 1 - Math.pow(1 - u, 2.4);
        const pos = this.touch.clone().lerp(s.restPos, p);
        pos.y += Math.sin(p * Math.PI * 3) * (1 - p) * 1.4;
        pk.group.position.copy(pos);
        if (!this.qTouch) this.qTouch = pk.group.quaternion.clone();
        pk.group.quaternion.copy(this.qTouch).slerp(s.restQuat, smooth(p * 1.15));
        s.crashSite?.reveal(p);
        const n = Math.round((1 - p) * 4 + 1);
        for (let i = 0; i < n; i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const at = pos.clone().addScaledVector(this.T, R * 0.6).addScaledVector(this.N, side * R * (0.5 + Math.random() * 0.5));
          at.y = s.groundAt(at.x, at.z) + 1;
          const v = this.N.clone().multiplyScalar(side * (6 + Math.random() * 10)).addScaledVector(this.T, 8 * (1 - p)).add(V(0, 5 + Math.random() * 6, 0));
          s.dust.emit(at, v, 1 + Math.random() * 1.6 * (1 - p * 0.5), 1.2 + Math.random(), new THREE.Color(pickOf(SAND)));
        }
        if (s.wind && Math.random() < 0.7) for (let i = 0; i < 6; i++) s.wind.emit(pos.x + (Math.random() - 0.5) * 30, pos.z + (Math.random() - 0.5) * 30, this.N.x * (Math.random() - 0.5) * 30, this.N.z * (Math.random() - 0.5) * 30);
        if (u < 0.5 && Math.random() < 0.4) s.flame.emit(pos.clone().addScaledVector(this.T, R * 0.7).add(V(0, -R * 0.4, 0)), V(0, 3, 0), 2 + Math.random() * 2, 0.4, pickOf(FIRE));
        const cam = s.restPos.clone().addScaledVector(this.N, -40).addScaledVector(this.T, -26).add(V(0, 5, 0));
        cam.y = Math.max(cam.y, s.groundAt(cam.x, cam.z) + 2.5);
        this.look.lerp(pos, 1 - Math.exp(-5 * dt));
        s.shot({ pos: cam, look: this.look, fov: 52 });
        s.shake(0.6 * (1 - p));
        break;
      }
      case 'settle': {
        const k = smooth(seg(t, 0, 3.6));
        const a = s.restPos.clone().addScaledVector(this.N, -62).addScaledVector(this.T, 44).add(V(0, 26, 0));
        const b = s.restPos.clone().addScaledVector(this.N, -50).addScaledVector(this.T, 34).add(V(0, 20, 0));
        s.shot({ pos: a.lerp(b, k), look: s.restPos.clone().addScaledVector(this.T, -26).add(V(0, -4, 0)), fov: 46 });
        if (t > 1.6 && !this.creak) { this.creak = true; s.sound?.critter?.('creak', 1); }
        break;
      }
      case 'hatch': {
        const side = V(-s.outDir.z, 0, s.outDir.x);
        const cam = s.rampFoot.clone().addScaledVector(s.outDir, 6.5).addScaledVector(side, 4.5);
        cam.y = Math.max(s.rampFoot.y, s.groundAt(cam.x, cam.z)) + 2.2;
        s.shot({ pos: cam, look: s.hinge.clone().lerp(s.rampFoot, 0.3).add(V(0, 1.4, 0)), fov: 54 });
        if (t > 0.3 && !this.hissed) { this.hissed = true; sfx.hatch(s.sound); }
        // (each eases itself: the door unseals and slides up, then the ramp slides out, tips down, telescopes)
        s.setDoor(pk, seg(t, 0.3, 1.4));
        s.setRamp(pk, seg(t, 1.35, 3.3));
        break;
      }
      case 'stepout': {
        const side = V(-s.outDir.z, 0, s.outDir.x);
        const cam = s.rampFoot.clone().addScaledVector(s.outDir, 5.5).addScaledVector(side, -3.2);
        cam.y = s.groundAt(cam.x, cam.z) + 1.5;
        this.look.lerp(s.player.pos.clone().add(V(0, 1.3, 0)), t < 0.05 ? 1 : 1 - Math.exp(-4 * dt));
        s.shot({ pos: cam, look: this.look, fov: 50 });
        break;
      }
    }
  }

  ready(id) {
    const s = this.s;
    if (id === 'walk') {
      const l = s.local(this.sp, s.player.pos), c = this.pt('cockpit');
      return s.isInside(this.sp, s.player.pos) && Math.hypot(l.x - c.x, l.z - c.z) < CONSOLE_R;
    }
    if (id === 'stepout') return !s.auto;
    return true;
  }

  finish(skipped) {
    const s = this.s, C = s.cinema, pk = this.pk;
    s.holo?.clear();
    if (skipped) {
      C.clear();
      s.auto = null;
      s.removeSpaceCopy();
      pk.group.visible = true;
      pk.group.position.copy(s.restPos); pk.group.quaternion.copy(s.restQuat);
      if (s.crashSite) { s.crashSite.group.visible = true; s.crashSite.berm.visible = true; s.crashSite.reveal(1); }
      s.setDoor(pk, 1); s.setRamp(pk, 1);
      pk.lightsOff = false;
      s.setPower('emergency', pk);
      s.startSmoke = true;
      sfx.alarm(s.sound, 0); sfx.hum(s.sound, 0);
      const a = s.arrivalSpot();
      s.placePlayer(a.pos, a.heading, true);
      // over the shoulder, a little low: the city and its burning tree stand on the horizon beside the traveller
      s.rig.yaw = a.heading + Math.PI + STEP_OUT_YAW; s.rig.pitch = 0.08;
      s.rig.target.copy(a.pos);
      s.cam = null; s.blend = null;
      C.objective(stepOutObjective());
    } else {
      C.say(null); C.hint(null); C.hud(true); C.bars(false);
    }
    game.set('objective', OBJECTIVE);
    game.set('ship.level', 'desert');
    setTimeout(() => s.onReady?.(), 6800);   // after the objective card (6.5 s) has faded, never on top of it
  }
}

// ---------------------------------------------------------------------------
// Shorter scenes

/** Timed steps with hold-to-skip. steps: [{ dur, enter?(), frame?(t, dt) }] */
class Sequence {
  constructor(ship, steps, { onFinish } = {}) {
    Object.assign(this, { s: ship, steps, onFinish });
    this.i = -1; this.t = 0; this.skipT = 0; this.done = false;
  }
  start() { this.next(); }
  next() {
    this.i++; this.t = 0;
    if (this.i >= this.steps.length) return this.finish(false);
    this.steps[this.i].enter?.();
  }
  update(dt, skipHeld) {
    if (this.done) return;
    this.skipT = skipHeld ? this.skipT + dt : 0;
    if (this.skipT > 0.9) return this.finish(true);
    this.t += dt;
    const st = this.steps[this.i];
    st.frame?.(this.t, dt);
    if (this.done) return;
    if (st.until ? st.until() : this.t >= st.dur) this.next();
  }
  finish(skipped) {
    if (this.done) return;
    this.done = true;
    this.onFinish?.(skipped);
  }
}

/** A recording at the console: the traveller faces the projector, the parents rise over it. */
export class CallDirector extends Sequence {
  constructor(ship, { n, lines, onDone, who, label = '' }) {
    const m = ship.parked;
    const tl = callTimeline(lines);
    const C = ship.cinema;
    const st = { span: recordingSpan(lines), who: who ?? onHologram(n), label };
    super(ship, [
      {
        dur: tl.total + 0.6,
        enter: () => {
          C.hud(false); C.bars(true);
          ship.placePlayer(ship.world(m, m.interior.points.cockpit), ship.worldHeading(m, Math.PI), true);   // facing the recording
          m.callScreen?.set({ who: 'tape', statik: 1, label });
          sfx.beep(ship.sound, true);
        },
        frame: (t) => {
          ship.shot(callShot(ship, m, t));
          m.callScreen?.set({ statik: Math.max(0, 1 - t / 0.8) });
          playLines(ship, m, tl, t, st);
          faceRecording(ship, m);
        },
      },
    ], {
      onFinish: (skipped) => {
        C.say(null); C.bars(false); C.hud(true);
        ship._line = null;
        if (skipped) ship.holo?.clear(); else ship.holo?.hide();
        m.callScreen?.set({ who: 'idle', talk: 0, statik: 0, label: '' });
        sfx.staticBurst(ship.sound, 0.4);
        ship.rig.yaw = ship.player.heading + Math.PI;
        ship.release(0.8);
        onDone?.();
      },
    });
    this.rec = st;
  }
}

/** Seconds of each part of the approach from space (before the landing). */
export const APPROACH = { space: 2.8, entry: 2.1, sky: 1.9 };

/**
 * Arriving by ship: out of the jump, the destination planet grows ahead (drawn in its own
 * colours, src/ship/approach.js); the ship dives into the air in a sheet of fire; it falls
 * through the world's sky; then it comes down on its jets, opens, and you walk out.
 */
export class ArrivalDirector extends Sequence {
  constructor(ship) {
    const m = ship.parked, C = ship.cinema;
    const top = ship.restPos.clone().add(V(0, 140, 0));
    const side = V(-ship.outDir.z, 0, ship.outDir.x);
    const look = new THREE.Vector3();
    const dust = () => ship.dustColors();
    // the approach: the ship flies along `fwd` (toward the site, coming in over the ramp's side), the planet ahead and below
    const fwd = ship.outDir.clone().negate(), up = V(0, 1, 0), across = V(-fwd.z, 0, fwd.x);
    const cam = new THREE.Vector3(), pl = new THREE.Vector3(), q = new THREE.Quaternion(), tilt = new THREE.Quaternion();
    const fog0 = () => { const U = ship.post?.uniforms; if (U) U.uFogMul.value = 0; };   // no haze in space
    // the planet `D` m off, `drop` rad below the ship's course, `ang` rad its angular radius (so it grows as it nears)
    const placePlanet = (a, from, D, drop, ang) => {
      pl.copy(fwd).multiplyScalar(Math.cos(drop)).addScaledVector(up, -Math.sin(drop)).normalize();
      a.planet.position.copy(from).addScaledVector(pl, D).sub(a.group.position);
      a.planet.scale.setScalar(D * Math.sin(ang));
      a.planet.lookAt(from);
    };
    super(ship, [
      {
        // out of the jump: the ship cruises on, the planet comes up ahead and grows
        dur: APPROACH.space,
        enter: () => {
          C.hud(false); C.bars(true);
          ship.placePlayer(ship.world(m, m.interior.points.hatchIn), ship.worldHeading(m, HATCH_A), false);
          ship.setDoor(m, 0); ship.setRamp(m, 0);
          const a = ship.buildApproach();
          m.group.position.copy(a.centre); m.group.quaternion.copy(ship.restQuat);
          m.mats.thrust.uniforms.uGlow.value = 0.6;
          sfx.engines(ship.sound, 0.25); sfx.approach(ship.sound, APPROACH.space);
        },
        frame: (t, dt) => {
          fog0();
          const a = ship.approach, k = t / APPROACH.space, e = smooth(k);
          m.group.position.copy(a.centre).addScaledVector(fwd, 14 * k);
          // nosing down toward it as it nears
          tilt.setFromAxisAngle(across, -0.35 * e + Math.sin(t * 0.9) * 0.03);
          m.group.quaternion.copy(tilt).multiply(ship.restQuat);
          cam.copy(a.centre).addScaledVector(fwd, -72 + 22 * e).addScaledVector(across, 30 - 8 * e).addScaledVector(up, 14 - 4 * e);
          placePlanet(a, cam, 1250 - 350 * e, 0.3 + 0.1 * e, 0.08 * Math.exp(1.55 * k));
          a.update(dt);
          look.copy(m.group.position).lerp(_w.copy(a.group.position).add(a.planet.position), 0.1).addScaledVector(up, 4);
          ship.shot({ pos: cam.clone(), look: look.clone(), fov: 42 });
        },
      },
      {
        // into the air: the planet fills the view, fire sheets off the ship's belly, a white flash
        dur: APPROACH.entry,
        enter: () => { sfx.reentry(ship.sound, APPROACH.entry); m.mats.thrust.uniforms.uGlow.value = 0; this.flashed = false; },
        frame: (t, dt) => {
          fog0();
          const a = ship.approach, k = t / APPROACH.entry, e = smooth(k);
          m.group.position.copy(a.centre).addScaledVector(fwd, 14 + 30 * k).addScaledVector(up, -16 * k * k);
          tilt.setFromAxisAngle(across, -0.35 - 0.45 * e + Math.sin(t * 7) * 0.025).multiply(q.setFromAxisAngle(fwd, Math.sin(t * 3.1) * 0.06));
          m.group.quaternion.copy(tilt).multiply(ship.restQuat);
          cam.copy(m.group.position).addScaledVector(fwd, -44 + 8 * e).addScaledVector(across, 20 - 5 * e).addScaledVector(up, 13 - 3 * e);
          placePlanet(a, cam, 900 - 200 * e, 0.4 + 0.35 * e, Math.min(1.32, 0.38 + 0.95 * e));
          a.update(dt);
          // the fire of entry: on the leading face (its belly, toward the planet), streaming back off the hull
          for (let i = 0, n = 3 + Math.round(5 * Math.min(1, k * 2)); i < n; i++) {
            const u = Math.random() * Math.PI * 2, w = Math.random() * 0.75;
            const at = ship.world(m, V(Math.sin(u) * w, -Math.sqrt(1 - w * w), Math.cos(u) * w).multiplyScalar(R + 0.6));
            ship.flame.emit(at, pl.clone().multiplyScalar(-(18 + Math.random() * 14)).addScaledVector(fwd, -8), 0.6 + Math.random() * 0.8, 0.22 + Math.random() * 0.2, pickOf(FIRE));
          }
          if (Math.random() < dt * 5) ship.smoke.emit(ship.world(m, V(0, R * 0.4, 0)).addScaledVector(fwd, -R), pl.clone().multiplyScalar(-10), 0.9 + Math.random() * 0.9, 1.2, new THREE.Color('#efe6d6'));
          ship.shake(0.25 + 0.5 * k);
          ship.shot({ pos: cam.clone(), look: m.group.position.clone().addScaledVector(pl, 18), fov: 50, roll: Math.sin(t * 2.2) * 0.04 });
          if (t > APPROACH.entry - 0.4 && !this.flashed) { this.flashed = true; C.fade(1, true, 0.3); }
        },
      },
      {
        // through the world's own sky, trailing smoke, down toward the landing site
        dur: APPROACH.sky,
        enter: () => {
          ship.removeApproach();
          m.group.quaternion.copy(ship.restQuat);
          C.fade(0, true, 0.55);
          sfx.roar(ship.sound, APPROACH.sky + 1.5);
        },
        frame: (t) => {
          const k = t / APPROACH.sky, e = 1 - Math.pow(1 - k, 2);
          const p = ship.restPos.clone().addScaledVector(fwd, -90 * (1 - e)).add(V(0, 160 + 480 * (1 - e), 0));
          m.group.position.copy(p);
          tilt.setFromAxisAngle(across, -0.25 * (1 - e) + Math.sin(t * 4) * 0.03);
          m.group.quaternion.copy(tilt).multiply(ship.restQuat);
          // fire fading into a trail of smoke as the air slows it
          if (Math.random() < 1 - k * 0.7) ship.flame.emit(ship.world(m, V((Math.random() - 0.5) * 8, -R - 0.5, (Math.random() - 0.5) * 8)), V(0, 30, 0).addScaledVector(fwd, -10), 1.2 + Math.random() * 1.2, 0.3, pickOf(FIRE));
          for (let i = 0; i < 2; i++) {
            const g = 0.86 + Math.random() * 0.1;
            ship.smoke.emit(ship.world(m, V((Math.random() - 0.5) * 10, R * (Math.random() - 0.2), (Math.random() - 0.5) * 10)), V(0, 22, 0).addScaledVector(fwd, -6), 2.4 + Math.random() * 2.2, 2.2, new THREE.Color(g, g * 0.97, g * 0.93));
          }
          const c = ship.restPos.clone().addScaledVector(fwd, 70).addScaledVector(side, 85).add(V(0, 230, 0));
          ship.shot({ pos: c, look: p.clone().add(V(0, -6, 0)), fov: 44 });
          ship.shake(0.2 * (1 - k));
        },
      },
      {
        // down on its jets, the dust blowing out from under it, onto its feet
        dur: 4.2,
        enter: () => {
          m.group.quaternion.copy(ship.restQuat);
          m.mats.thrust.uniforms.uGlow.value = 1;
          sfx.engines(ship.sound, 0.8);
          look.copy(top);
        },
        frame: (t, dt) => {
          const k = 1 - Math.pow(1 - Math.min(1, t / 4.2), 3);
          m.group.position.copy(top).lerp(ship.restPos, k);
          const cam = ship.rampFoot.clone().addScaledVector(ship.outDir, 34).addScaledVector(side, 20);
          cam.y = ship.groundAt(cam.x, cam.z) + 5;
          look.lerp(m.group.position, 1 - Math.exp(-5 * dt));
          ship.shot({ pos: cam, look, fov: 50 });
          const h = m.group.position.y - ship.restPos.y;
          // set every frame, so the engines come in even if the sound starts mid-scene
          if (!this.thud) sfx.engines(ship.sound, 0.55 + 0.45 * (1 - Math.min(1, h / 140)));
          if (!this.whoosh && ship.sound?.ctx) { this.whoosh = true; sfx.roar(ship.sound, Math.max(1, 4.2 - t)); }
          if (h < 40 && !this.dusted && ship.sound?.ctx) { this.dusted = true; sfx.rumble(ship.sound, 2.4, 0.35); }
          // the jets out of the bells under the hull, and the dust they blow out along the ground (src/ship/exhaust.js)
          if (!this.thud) exhaust(ship, m, dt, { power: 0.75 + 0.25 * (1 - Math.min(1, h / 60)), palette: dust() });
          if (t > 3.9 && !this.thud) {
            this.thud = true; ship.shake(0.8); sfx.rumble(ship.sound, 0.8, 0.5); sfx.engines(ship.sound, 0); m.mats.thrust.uniforms.uGlow.value = 0;
            footPuffs(ship, m, { palette: dust() });
          }
        },
      },
      {
        // the door unseals and slides up the hull; then the ramp slides out, tips down and telescopes to the ground
        dur: 2.8,
        enter: () => sfx.hatch(ship.sound),
        frame: (t) => {
          const cam = ship.rampFoot.clone().addScaledVector(ship.outDir, 6.5).addScaledVector(side, 4.5);
          cam.y = ship.groundAt(cam.x, cam.z) + 2.2;
          ship.shot({ pos: cam, look: ship.hinge.clone().lerp(ship.rampFoot, 0.3).add(V(0, 1.4, 0)), fov: 54 });
          ship.setDoor(m, seg(t, 0.05, 1.15));
          ship.setRamp(m, seg(t, 1.1, 2.75));
          if (t > 2.6 && !this.landed) { this.landed = true; sfx.rumble(ship.sound, 0.3, 0.25); }   // the ramp's foot on the ground
        },
      },
      {
        until: () => !ship.auto,
        enter: () => {
          ship.placePlayer(ship.world(m, polar(9.0, HATCH_A, DECK)), ship.site.heading, true);
          ship.autopilot([ship.hinge.clone().addScaledVector(ship.outDir, 0.6), ship.rampFoot.clone(), ship.rampFoot.clone().addScaledVector(ship.outDir, 2)]);
        },
        frame: (t, dt) => {
          const cam = ship.rampFoot.clone().addScaledVector(ship.outDir, 5.5).addScaledVector(side, -3.2);
          cam.y = ship.groundAt(cam.x, cam.z) + 1.5;
          look.lerp(ship.player.pos.clone().add(V(0, 1.3, 0)), t < 0.05 ? 1 : 1 - Math.exp(-4 * dt));
          ship.shot({ pos: cam, look, fov: 50 });
        },
      },
    ], {
      onFinish: (skipped) => {
        ship.removeApproach();
        C.fade(0, true, skipped ? 0.3 : 0);
        m.group.position.copy(ship.restPos); m.group.quaternion.copy(ship.restQuat);
        ship.setDoor(m, 1); ship.setRamp(m, 1);
        m.mats.thrust.uniforms.uGlow.value = 0;
        sfx.engines(ship.sound, 0);
        ship.auto = null;
        const a = ship.arrivalSpot();
        if (skipped || ship.player.pos.distanceTo(a.pos) > 4) ship.placePlayer(a.pos.clone().addScaledVector(ship.outDir, 2), a.heading, true);
        ship.showPlayer(true);
        ship.rig.yaw = ship.player.heading + Math.PI; ship.rig.pitch = 0.2;
        ship.rig.target.copy(ship.player.pos);
        if (skipped) { ship.cam = null; ship.blend = null; } else ship.release(1.2);
        C.clear();
        ship.onReady?.();
      },
    });
    this.interactive = () => !!ship.auto;
  }
}
const _w = new THREE.Vector3();

/** Leaving: the hatch shuts, the ship lifts off in a storm of dust, then the stars rush past. */
export class TakeoffDirector extends Sequence {
  constructor(ship, { to, title, onDone }) {
    const m = ship.parked, C = ship.cinema;
    const side = V(-ship.outDir.z, 0, ship.outDir.x);
    const look = new THREE.Vector3();
    super(ship, [
      {
        dur: 2.0,
        enter: () => {
          C.hud(false); C.bars(true);
          C.say({ who: 'ship', text: `Course set: ${title}. Hold on.` });
          sfx.hatch(ship.sound); sfx.engines(ship.sound, 0.35);
          m.callScreen?.set({ who: 'map' });
        },
        frame: (t) => {
          ship.shot(callShot(ship, m, t));
          // the ramp folds away first (in, up, back into the doorway), then the door slides down and seals
          ship.setRamp(m, 1 - seg(t, 0, 1.25));
          ship.setDoor(m, 1 - seg(t, 1.2, 1.95));
          ship.shake(0.25 * t);
        },
      },
      {
        dur: 3.8,
        enter: () => {
          C.say(null); ship.showPlayer(false); m.mats.thrust.uniforms.uGlow.value = 1; sfx.engines(ship.sound, 1);
          footPuffs(ship, m, { palette: ship.dustColors(), speed: 6 });   // off its feet
        },
        frame: (t, dt) => {
          const k = t / 3.8;
          // it lifts gently off its feet, then climbs faster and faster
          m.group.position.copy(ship.restPos).add(V(0, 0.8 * t + 9 * t * t, 0));
          const cam = ship.rampFoot.clone().addScaledVector(ship.outDir, 34).addScaledVector(side, 22);
          cam.y = ship.groundAt(cam.x, cam.z) + 4;
          look.lerp(m.group.position, t < 0.05 ? 1 : 1 - Math.exp(-4 * dt));
          ship.shot({ pos: cam, look, fov: 52 + k * 8 });
          // the jets out of the bells, and the dust they blow out along the ground until it is too high (src/ship/exhaust.js)
          exhaust(ship, m, dt, { power: 1, palette: ship.dustColors(), rate: 44 });
          ship.shake(0.5 * (1 - k));
          if (t > 3.0 && !this.warped) { this.warped = true; ship.warp.start(title); }
        },
      },
      { dur: 1.6 },
    ], { onFinish: () => { sfx.engines(ship.sound, 0); onDone?.(); } });
    this.to = to;
  }
}
