import * as THREE from 'three';
import { game } from '../game-state.js';
import { DECK, HATCH_A, CENTRE_Z, LENGTH, HALF_W, BELLY, LIFT } from './hull.js';
import { CONSOLE_R } from './interior.js';
import { PROLOGUE_CALL, recordingSpan, onHologram, recordingLabel } from '../story/calls.js';
import { callTimeline, NUDGE, nudgeText, nudgeDue, PAUSE, PAUSE_THEME_AT, PROLOGUE_STAGES } from './prologue.js';
import { lightCues, lightEnvelope, lightBeat } from '../story/light-theme.js';
import { loadCue } from '../soundtracks.js';
import { callHum, callHumLevel } from '../story/hum.js';
import { verbKey } from '../prompt-keys.js';
import * as sfx from './sfx.js';
import { exhaust, footPuffs } from './exhaust.js';
import { LANDING_LINE, FOLLOW_LINE, arrivalLine } from '../story/signature.js';
import { showChargeCard, GIVEN as CHARGE_GIVEN, CARD as CHARGE_CARD, CHARGE_CARD_MS } from '../story/charge.js';
import { BUST } from './hologram.js';
import { rumblePlay } from '../rumble.js';
import { FACE } from '../humanoid.js';

// What the ship's cinematics look like: cameras, the moving ship, dust,
// sounds, subtitles. The prologue's timing lives in prologue.js; the
// shorter scenes (a recording at the console, arriving, taking off) are Sequences here.

export const OBJECTIVE = 'Find a new source of power.';
/** The ship's good morning in the prologue: a message is waiting (no word of where from). */
export const WAKE_LINE = { who: 'ship', text: 'Good morning. You have one new message.', tone: 'neutral' };
/** A new game steps out without the backpack: it waits in a makers' box in Qanat, under the great dark tree (src/boxes/, the desert's first stage). */
export const FIRST_OBJECTIVE = 'Walk to the city under the great dark tree.';
const stepOutObjective = () => (game.flag('item.backpack') ? OBJECTIVE : FIRST_OBJECTIVE);
const STEP_OUT_YAW = 0.34;   // rad off straight-behind when the traveller first steps out
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
const SAND = ['#e3c58f', '#d8b884', '#efd29b', '#cfa877'];
const FIRE = ['#ffd27a', '#ff9a4a', '#f2c54b', '#e6503a'];
/** The singing light: pale gold and the makers' cyan (the glyph's colour). */
const LIGHT = ['#fff6d8', '#bff4ff', '#f7e08a', '#9fe6f0', '#ffffff'];
const VAPOUR = ['#eef2f2', '#e2e8ea', '#f6f1e6'];
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
/**
 * The voicemail's frame for the recordings' cameras (ship-local): where he stands behind the console's tail (`me`), the projector (`p`),
 * the way he faces it (`f`, level) and his right (`r`). at(right, up, back): a point off where he stands.
 */
function cockpitFrame(model) {
  const P = model.interior.points, me = P.cockpit, p = P.projector;
  const f = V(p.x - me.x, 0, p.z - me.z).normalize(), r = V(-f.z, 0, f.x);
  const at = (right, y, back) => me.clone().addScaledVector(r, right).addScaledVector(f, -back).setY(DECK + y);
  return { me, p, f, r, at };
}

/** The hologram's size over the projector (1: life size): busts a little under life size, their faces near his. */
export const HOLO_SCALE = 0.9;
/** The projector's lens on the console (m, src/ship/interior.js). */
export const HOLO_LENS = 0.16;
/** How high the busts' faces are over the lens (m): their eyes (hologram.js BUST, FACE), scaled. */
export const CALL_FACE = HOLO_SCALE * (BUST.lift + FACE.m[0] - BUST.m.bottom);
const _up = new THREE.Vector3(), _q = new THREE.Quaternion();
/** The traveller's eyes (world), for the hologram to face: his head bone, else up from his feet (the ship's up). */
export function travellerHead(ship, model, out = new THREE.Vector3()) {
  _up.set(0, 1, 0).applyQuaternion(model.group.getWorldQuaternion(_q));
  const head = ship.player.humanoid?.b?.Head;
  if (head) return head.getWorldPosition(out).addScaledVector(_up, 0.08);
  return out.copy(ship.player.pos).addScaledVector(_up, 1.55);
}

/**
 * The view while a recording plays, in ship-local space: from behind the traveller's right
 * shoulder, so he stands at the left of the frame facing the recording, the hologram over the
 * console in front of him, the little screen with its date stamp behind it and the room beyond, out to the windshield. `close` (0 .. 1) pushes in
 * on the busts while the hologram is up: their faces (CALL_FACE over the lens) just over the middle,
 * clear of the subtitles.
 */
export function callShot(ship, model, t = 0, close = 0) {
  const { p, r, at } = cockpitFrame(model);
  const push = Math.min(t * 0.03, 0.3);
  const k = smooth(close), L = THREE.MathUtils.lerp;
  return {
    pos: ship.world(model, at(L(1.05, 0.85, k), L(1.95, 1.88, k), L(1.6, 1.0, k) - push)),
    look: ship.world(model, p.clone().addScaledVector(r, -L(0.12, 0.2, k)).setY(L(DECK + 1.82, p.y + CALL_FACE - 0.12, k))),
    fov: L(48, 36, k),
  };
}
/**
 * The recordings' other angles while the busts are up (ship-local frames; the console's tail and the projector
 * ahead of him at -z, the holo table and the cockpit beyond, the lockers on his right), each pushing in a little over `u` seconds:
 *   bust    from beside his left shoulder, tight on the two faces in the light
 *   listen  from over the console beside the projector, back at his face, lit by the hologram
 *   window  wide and low from behind his right: him, the busts, the room and the windshield far ahead, where the light comes
 * ('over', the shot behind his right shoulder, is callShot itself.)
 */
export function callAngle(ship, model, angle, u = 0) {
  const { me, p, f, r, at } = cockpitFrame(model);
  const push = Math.min(u * 0.04, 0.3), W = (v) => ship.world(model, v);
  if (angle === 'bust') {
    return { pos: W(at(-0.62 + 0.1 * push, 1.74, 0.42 - push)), look: W(p.clone().addScaledVector(r, -0.05).setY(p.y + CALL_FACE - 0.1)), fov: 30 - 3 * push };
  }
  if (angle === 'listen') {
    // from over the console beside the projector (on his left), back at his face
    return { pos: W(at(-0.7, 1.5, -0.8 - push)), look: W(me.clone().setY(DECK + 1.56)), fov: 34 - 4 * push };
  }
  if (angle === 'window') {
    return { pos: W(at(1.1 - 0.2 * push, 1.3, 1.3 - push)), look: W(p.clone().addScaledVector(r, -0.55).addScaledVector(f, 3).setY(DECK + 1.6)), fov: 50 - 4 * push };
  }
  return null;
}

/** Shortest a recording's angle is held (s), and the order the angles come in (`listen` on his own lines). */
export const CALL_CUTS = { min: 4.5, order: ['bust', 'window', 'over'] };

/**
 * Where a recording cuts, and to what: [{ t, angle }] from t 0. It starts on callShot ('over', pushing in
 * as the busts rise) and cuts only at the start of a line, while the busts are fully up, never sooner than
 * `min` s after the last cut nor `min` s before they fold; a line of his own ('scene', 'you') cuts to his
 * face ('listen'), the others take the next of `order` (never the same angle twice running). At the fold it
 * goes back to 'over', which eases out as before; after that, a line of his own cuts to his face again and the
 * next line back. Words and timing are untouched: only the camera changes.
 * (The QC pass: one push-in for 25–77 s.)
 */
export function callCuts(timeline, span, { min = CALL_CUTS.min, order = CALL_CUTS.order, closeIn = CLOSE_IN, closeOut = CLOSE_OUT } = {}) {
  const cuts = [{ t: 0, angle: 'over' }];
  if (!span) return cuts;
  const up = timeline.lines[span[0]].t0 - 0.9 + closeIn, fold = timeline.lines[span[1]].t1 + 0.15;
  let last = up, k = 0;
  for (const l of timeline.lines) {
    if (l.t0 < up + min || l.t0 > fold - min || l.t0 - last < min) continue;
    const prev = cuts.at(-1).angle;
    let angle = l.line.who === 'scene' || l.line.who === 'you' ? 'listen' : order[k++ % order.length];
    if (angle === prev) angle = order[k++ % order.length];
    if (angle === prev) continue;
    cuts.push({ t: l.t0, angle });
    last = l.t0;
  }
  if (cuts.length > 1 && cuts.at(-1).angle !== 'over') cuts.push({ t: fold, angle: 'over' });
  // after the fold (eased out), the long tails of the later recordings: his own lines on his face, the others back
  // behind him; the same holds
  last = Math.max(last, fold + closeOut - min);
  for (const l of timeline.lines) {
    if (l.t0 < fold + closeOut || l.t0 - last < min || l.t0 > timeline.total - 2) continue;
    const angle = l.line.who === 'scene' || l.line.who === 'you' ? 'listen' : 'over';
    if (angle === cuts.at(-1).angle) continue;
    cuts.push({ t: l.t0, angle });
    last = l.t0;
  }
  return cuts;
}

/** The cut in force at `t` (and when it began). */
export function cutAt(cuts, t) {
  let c = cuts[0];
  for (const x of cuts) if (x.t <= t) c = x;
  return c;
}

/**
 * Course set at the holo table: across the table from the traveller, the planet turning
 * between you, a slow push in (ship-local, then world).
 */
export function tableShot(ship, model, t = 0) {
  const tp = model.interior.points.table;
  // two angles inside the main room, from over the curved console (port, forward) or from the alcove's end (starboard, aft): the one across the table from him
  const me = ship.local(model, ship.player.pos);
  const sides = [V(0.95, 0, 0.9), V(-1.0, 0, -0.45)].map((d) => d.normalize());
  const away = sides.reduce((a, b) => (me.distanceToSquared(tp.clone().add(a)) > me.distanceToSquared(tp.clone().add(b)) ? a : b));
  const d = 2.5 - Math.min(t * 0.2, 0.4);
  return { pos: ship.world(model, V(tp.x + away.x * d, tp.y + 0.38, tp.z + away.z * d)), look: ship.world(model, V(tp.x - away.x * 0.6, tp.y, tp.z - away.z * 0.6)), fov: 54 };
}

/** Seconds the shot takes to push in on the busts, and to ease back out. */
const CLOSE_IN = 2.4, CLOSE_OUT = 1.6;

/** Facing the recording: the traveller turned to the console (ship-local heading PI). */
export function faceRecording(ship, model) {
  const { me, p } = cockpitFrame(model);
  ship.player.heading = ship.worldHeading(model, Math.atan2(p.x - me.x, p.z - me.z));
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
  // the shot pushes in on the busts as they rise, and eases back out once they fold away
  st.close = seg(t, t0, t0 + CLOSE_IN) * (1 - seg(t, t1, t1 + CLOSE_OUT));
  if (!st.shown && t >= t0 && t < t1) {
    st.shown = true;
    const head = new THREE.Vector3();
    H.show({ parent: model.group, at: model.interior.points.projector, scale: HOLO_SCALE, who: st.who ?? 'father', lens: HOLO_LENS, face: () => travellerHead(ship, model, head) });
  }
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
    this.humAt = callHum(this.call);   // the hum under the charge, until the power goes (src/story/hum.js)
    // the singing light's theme over the message, nearer each time (src/story/light-theme.js), and the recorded
    // version if it is there (src/soundtracks.js CUES: it replaces the synth's statements, the same envelope)
    this.cues = lightCues(this.call); this.cueI = 0;
    this.passDur = PROLOGUE_STAGES.find((x) => x.id === 'pass')?.dur ?? 5.4;
    if (ship.sound?.ctx) void loadCue(ship.sound, 'singing-light');
    // the light's way past the ship (ship-local): out of the dark ahead, close past the cockpit's left (the hatch's
    // side, where it leaves its mark on the hull), away behind
    this.LM = V(-HALF_W - 5, DECK + 2.4, -7.5);               // nearest: a few metres off the hull, at the window's height
    this.LD = V(-0.45, -0.08, 0.89).normalize();              // the way it goes
    this.rec = { span: recordingSpan(PROLOGUE_CALL), who: onHologram('prologue'), label: recordingLabel('prologue') };
    const c = ship.site.crash;
    this.T = V(Math.sin(c.travel), 0, Math.cos(c.travel));
    this.N = V(this.T.z, 0, -this.T.x);
    const rest = ship.restPos;
    this.touch = rest.clone().addScaledVector(this.T, -(c.length - 16));
    this.touch.y = ship.groundAt(this.touch.x, this.touch.z) + LIFT - 1.0;   // (its belly just in the sand)
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
        // no lights on the floor, no hint: the voicemail button blinks on the console, and at the
        // console the prompt says what E does (Ship.hud via prompt())
        C.bars(false);      // (yours to walk: the letterbox lifts, and the use prompt can show)
        C.controls(true);   // (on a phone: the stick and buttons, to walk there; the use prompt)
        this.ringT = 2;
        this.pressed = false;
        // (and if the room isn't enough: one quiet line after a while, then it goes: prologue.js NUDGE)
        this.walkT = 0; this.nudged = false; this.nudgeOff = 0; this.walkFrom = s.player.pos.clone();
        break;
      case 'call': {
        if (this.nudgeOff) { C.hint(null); this.nudgeOff = 0; }
        C.controls(false); C.bars(true);
        s.auto = null;
        s.placePlayer(this.W(this.pt('cockpit')), s.worldHeading(sp, Math.PI), true);   // facing the recording
        sp.callScreen?.set({ who: 'tape', statik: 1, label: this.rec.label });
        break;
      }
      case 'pause':
        // he stops the recording, mid-word, and listens: the father still over the console, the theme alone
        sfx.beep(s.sound);
        C.say(null);
        s.holo?.speak(null);
        sp.callScreen?.set({ talk: 0, paused: true, statik: 0.1 });
        sfx.hum(s.sound, 0.6);
        this.light = { on: false, vec: null };
        break;
      case 'pass':
        // the singing light goes by the window, close: everything in the cockpit turns to it
        this.lightOn();
        if (!this.cueRec) s.sound?.lightTheme?.({ vol: 1.2, bend: -2, pan: { from: -0.8, to: 0.9 }, spb: lightBeat() * 0.85 });
        break;
      case 'drain':
        // the power goes with it: the hum winds down, the lamps and the core are dark, then the amber reserve
        this.humming?.stop(); this.humming = null;
        this.lightOff();
        sfx.hum(s.sound, 0);
        s.setPower('dead', sp);
        sp.callScreen?.set({ who: 'off', paused: false, statik: 0 });
        s.holo?.hide();
        C.say({ who: 'ship', text: 'Main power drained. Emergency reserve only.' });
        break;
      case 'glide':
        C.say(null); C.red(0);   // (the white fade from the drain's end lifts: C.fade below)
        s.holo?.clear();
        sfx.alarm(s.sound, 0); sfx.hum(s.sound, 0); sfx.roar(s.sound, 4.2);
        s.removeSpaceCopy();
        // the player waits, hidden, inside the parked ship; the ship itself glides in, dark
        s.placePlayer(this.P(pk.interior.points.hatchIn), s.worldHeading(pk, HATCH_A), false);
        pk.group.visible = true;
        s.crashSite && (s.crashSite.group.visible = true, s.crashSite.berm.visible = false);
        s.setPower('dead', pk);
        C.fade(0, true, 0.5);
        break;
      case 'land':
        sfx.rumble(s.sound, 3.2, 0.7);
        rumblePlay('land', { speed: 44 });   // (on a pad: the belly touching down; src/rumble.js)
        s.shake(1.4);
        break;
      case 'settle':
        pk.group.position.copy(s.restPos); pk.group.quaternion.copy(s.restQuat);
        s.crashSite?.reveal(1);
        if (s.crashSite) s.crashSite.berm.visible = true;
        this.giveCharge();   // as the dust clears: his charge, lettered over the landing site (src/story/charge.js)
        break;
      case 'hatch':
        pk.lightsOff = false;
        s.setPower('emergency', pk);
        {
          // what passed the ship left its signature on the hull (src/story/signature.js), and he chooses to follow it:
          // said once the father's card has gone (and the pulse it tracks is heard, faintly: the hum again, from the mark)
          const wait = Math.max(0, (this.cardUntil ?? 0) - (typeof performance !== 'undefined' ? performance.now() : 0));
          if (wait > 0) setTimeout(() => this.landingLines(), wait + 300);
          else this.landingLines();
        }
        break;
      case 'stepout': {
        const thr = this.P(pk.interior.points.threshold);
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
    if (U && sp && ['black', 'wake', 'rise', 'walk', 'call', 'pause', 'pass', 'drain'].includes(id)) U.uFogMul.value = 0;   // no haze in space
    switch (id) {
      case 'black':
      case 'wake': {
        // lying in bed, looking up at the ceiling, then sitting up
        const eye = this.pt('wakeEye'), look = this.pt('wakeLook');
        const up = id === 'wake' ? smooth(seg(t, 4.6, 6.8)) : 0;
        const sit = eye.clone().lerp(this.pt('wakeSit') ?? eye.clone().add(V(0, 0.4, 0)).lerp(this.pt('bunkStand'), 0.35).setY(DECK + 1.25), up);   // (sitting up, still in the alcove)
        const lk = look.clone().lerp(this.pt('wakeRoom'), up);
        s.shot({ pos: this.W(sit), look: this.W(lk), fov: 62, roll: (1 - up) * 0.12 });
        if (id === 'wake') {
          // eyes: half open, a blink, then open
          const k = t < 0.6 ? 0 : t < 1.6 ? 0.35 * smooth(seg(t, 0.6, 1.6)) : t < 2.1 ? 0.35 - 0.3 * smooth(seg(t, 1.6, 2.0)) : 0.05 + 0.95 * smooth(seg(t, 2.3, 3.6));
          C.eyelids(k);
          if (t > 3.9 && !this.said) { this.said = true; sfx.ring(s.sound); C.say(WAKE_LINE); }
        }
        break;
      }
      case 'rise':
        if (t > 0.3 && !this.risen) {
          this.risen = true;
          C.releaseLids(); C.lids(false); C.bars(true); C.say(null);
          s.showPlayer(true);
          // (swung off the back if the headboard would be between the camera and you)
          s.rig.pitch = 0.1; s.rig.indoor = true; s.rig._wasIndoor = true;   // level, at your height (the camera's indoor rule, src/player.js)
          s.rig.yaw = s.rig.clearYaw(s.player.pos, s.player.heading + Math.PI, { want: 3 });
          s.rig.target.copy(s.player.pos); s.rig.snapTight?.(s.player.pos); s.rig._curDist = 2.5;
          s.release(0); s.blend = null;
          C.fade(0, false, 0.5);
        }
        if (!this.risen) s.shot({ pos: this.W(this.pt('wakeEye')), look: this.W(this.pt('wakeLook')), fov: 62 });
        break;
      case 'walk': {
        // the voicemail chimes now and then and its button blinks; you go when you like
        // (the ship never walks you there itself) and press it
        if ((this.ringT -= dt) <= 0) { this.ringT = 7; sfx.ring(s.sound); }
        this.walkT = (this.walkT ?? 0) + dt;
        if (nudgeDue(this.walkT, { played: this.pressed, shown: this.nudged })) {
          // standing still all this while: how to move and look; else, where the message is (a chime with it)
          const moved = !!this.walkFrom && s.player.pos.distanceTo(this.walkFrom) > 1.5;
          this.nudged = true; this.nudgeOff = this.walkT + NUDGE.show;
          C.hint(nudgeText({ moved, keys: (v) => verbKey(v) }));
          this.ringT = 0.4;
        } else if (this.nudgeOff && this.walkT >= this.nudgeOff) { this.nudgeOff = 0; C.hint(null); }
        break;
      }
      case 'call': {
        s.shot(callShot(s, sp, t, this.rec.close ?? 0));
        // under his last words something sings, nearer and nearer: the hum, and the picture starts to break up
        const hum = callHumLevel(t, this.humAt);
        if (hum > 0 && !this.humming) this.humming = s.sound?.makersHumRise?.(this.humAt.to - t + PAUSE + this.passDur) ?? { stop() {} };
        // the singing light's theme, nearer each time (or the recorded cue, once, from the start)
        if (t < 0.1 && this.cueRec === undefined) this.cueRec = s.sound?.playCue?.('singing-light', lightEnvelope(this.call, { pause: PAUSE, pass: this.passDur })) ?? null;
        while (!this.cueRec && this.cueI < this.cues.length && t >= this.cues[this.cueI].t) {
          const c = this.cues[this.cueI++];
          s.sound?.lightTheme?.({ vol: c.vol, transpose: c.transpose, pan: -0.5 + this.cueI * 0.2 });
        }
        sp.callScreen?.set({ statik: Math.max(0, 1 - t / 0.8, 0.45 * hum) });
        playLines(s, sp, this.call, t, this.rec);
        if (hum > 0) s.holo?.glitch(0.35 * hum);
        faceRecording(s, sp);
        break;
      }
      case 'pause': {
        // the father held still mid-word over the console; his son's face, lit by it, listening; then wide: him, the
        // frozen bust and the window, where the light comes out of the dark
        if (t < 2.2) s.shot(callAngle(s, sp, 'bust', t));
        else if (t < 4.4) s.shot(callAngle(s, sp, 'listen', t - 2.2));
        else s.shot(callAngle(s, sp, 'window', t - 4.4));
        if (t >= PAUSE_THEME_AT && !this.pauseSung) { this.pauseSung = true; if (!this.cueRec) s.sound?.lightTheme?.({ vol: 0.95, pan: { from: -0.4, to: 0.1 } }); }
        s.holo?.speak(null);
        faceRecording(s, sp);
        this.lightFrame(PAUSE + 2.9 - t, dt);   // (far ahead, a speck in the window at the end)
        break;
      }
      case 'pass': {
        // A: over his shoulder, out of the window: it comes out of the dark ahead, growing, and goes by on the right
        // B: outside, wide: the ship against the planet, the light brushing past its hull and away behind it;
        //    its lamps go out as it passes
        const nearAt = 2.9, cut = 2.55;
        if (t < cut) {
          const k = smooth(t / cut);
          s.shot({ pos: this.W(V(0.55, DECK + 1.95, -5.9 - 0.3 * k)), look: this.W(V(-2.6 - 2 * k, DECK + 1.75, -22)), fov: 56 });
        } else {
          const k = smooth((t - cut) / (this.passDur - cut));
          s.shot({ pos: this.W(V(-34, DECK + 2 + 2 * k, 3 + 4 * k)), look: this.W(V(-3 - 5 * k, DECK + 1.2, -6 + 9 * k)), fov: 56 });
        }
        const pos = this.lightFrame(nearAt - t, dt);
        // everything in the cockpit is lit by it as it nears; the father's picture shivers
        if (pos && t < nearAt + 0.4) s.holo?.glitch(0.25 * smooth(t / nearAt));
        if (t > nearAt && !this.drained) { this.drained = true; rumblePlay('found'); s.setPower('dead', sp); sp.callScreen?.set({ statik: 1, talk: 0 }); s.holo?.glitch(1); C.fade(0.3, false, 0.5); }
        if (t > nearAt - 0.6) sp.mats.core.uniforms.uGlow.value = Math.max(0, 0.6 * (1 - (t - nearAt + 0.6) / 1.2));
        if (t > 3.6 && !this.saidPass) { this.saidPass = true; C.say({ who: 'ship', text: 'Power draining.' }); }
        break;
      }
      case 'drain': {
        // dark, then the amber reserve; the planet swings up into the window: she can't hold orbit
        const k = smooth(seg(t, 1.6, 4.8));
        s.shot({ pos: this.W(V(1.0, DECK + 1.8, -5.5)), look: this.W(V(-0.3, DECK + 1.9 - k * 0.7, -12)), fov: 58, roll: k * 0.12 + Math.sin(t * 1.3) * 0.02 });   // (from his right: the pilot's seat out of the way)
        if (t < 0.1 && !this.dark) { this.dark = true; C.fade(0.55, false, 0.35); }   // (the lamps out: dark but for the window)
        if (t > 1.3 && !this.reserve) { this.reserve = true; s.setPower('emergency', sp); C.fade(0.25, false, 0.8); C.red(0.18); }
        if (t > 2.4 && !this.said2) { this.said2 = true; C.say({ who: 'ship', text: 'Not enough to hold orbit. Taking us down.' }); }
        if (this.s.spaceCopy) this.s.spaceCopy.space.rotation.x = 0.76 * k;
        sp.mats.core.uniforms.uGlow.value = 0;
        if (t > 4.35 && !this.white) { this.white = true; C.fade(1, true, 0.4); }
        break;
      }
      case 'glide': {
        // dark, no fire: a long shallow fall on what reserve is left, a thin vapour behind it; the reserve's jets
        // only at the very end, to bring it in
        const u = Math.min(1, t / 5.2);
        const p = this.bez(u);
        pk.group.position.copy(p);
        const vel = this.bez(Math.min(1, u + 0.01)).sub(p).normalize();
        // nose first along its fall (the bow is local -z), a little nose down, rocking about its way
        const yawN = Math.atan2(vel.x, vel.z) - Math.PI, pitch = Math.asin(THREE.MathUtils.clamp(-vel.y, -1, 1)) * 0.6;
        pk.group.quaternion.setFromEuler(new THREE.Euler(-pitch, yawN, Math.sin(t * 0.9) * 0.12, 'YXZ'));
        if (u < 0.75 && Math.random() < 0.8) {
          const g = new THREE.Color(pickOf(VAPOUR));
          s.smoke.emit(p.clone().addScaledVector(vel, -LENGTH * 0.6).add(V((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4)), V(0, 2, 0), 2 + Math.random() * 1.5, 1.6 + Math.random(), g);
        }
        if (u > 0.82) for (let i = 0; i < 2; i++) {
          const under = s.world(pk, V((Math.random() - 0.5) * 3, BELLY - 0.4, CENTRE_Z + (Math.random() - 0.5) * 16));
          s.flame.emit(under, V(0, -14, 0), 1.2 + Math.random(), 0.3, pickOf(FIRE));
        }
        const cam = s.restPos.clone().addScaledVector(this.N, -64).addScaledVector(this.T, 36).add(V(0, 8, 0));   // (the long low hull: nearer than the ball needed)
        if (t < dt * 1.5) this.look.copy(p);
        this.look.lerp(p, 1 - Math.exp(-6 * dt));
        s.shot({ pos: cam, look: this.look, fov: 40 });
        break;
      }
      case 'land': {
        // down on its belly, a short skid through the sand, and still
        const u = Math.min(1, t / 3.6), p = 1 - Math.pow(1 - u, 2.6);
        const pos = this.touch.clone().lerp(s.restPos, p);
        pos.y += Math.sin(p * Math.PI * 2) * (1 - p) * 0.6;
        pk.group.position.copy(pos);
        if (!this.qTouch) this.qTouch = pk.group.quaternion.clone();
        pk.group.quaternion.copy(this.qTouch).slerp(s.restQuat, smooth(p * 1.2));
        s.crashSite?.reveal(p);
        const n = Math.round((1 - p) * 3 + 1);
        for (let i = 0; i < n; i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const at = pos.clone().addScaledVector(this.T, 7).addScaledVector(this.N, side * (5 + Math.random() * 5));
          at.y = s.groundAt(at.x, at.z) + 1;
          const v = this.N.clone().multiplyScalar(side * (4 + Math.random() * 7)).addScaledVector(this.T, 6 * (1 - p)).add(V(0, 3 + Math.random() * 4, 0));
          s.dust.emit(at, v, 1 + Math.random() * 1.3 * (1 - p * 0.5), 1.2 + Math.random(), new THREE.Color(pickOf(SAND)));
        }
        if (s.wind && Math.random() < 0.5) for (let i = 0; i < 4; i++) s.wind.emit(pos.x + (Math.random() - 0.5) * 30, pos.z + (Math.random() - 0.5) * 30, this.N.x * (Math.random() - 0.5) * 20, this.N.z * (Math.random() - 0.5) * 20);
        const cam = s.restPos.clone().addScaledVector(this.N, -40).addScaledVector(this.T, -26).add(V(0, 5, 0));
        cam.y = Math.max(cam.y, s.groundAt(cam.x, cam.z) + 2.5);
        this.look.lerp(pos, 1 - Math.exp(-5 * dt));
        s.shot({ pos: cam, look: this.look, fov: 52 });
        s.shake(0.35 * (1 - p));
        break;
      }
      case 'settle': {
        const k = smooth(seg(t, 0, 3.6));
        const a = s.restPos.clone().addScaledVector(this.N, -40).addScaledVector(this.T, 28).add(V(0, 17, 0));
        const b = s.restPos.clone().addScaledVector(this.N, -31).addScaledVector(this.T, 21).add(V(0, 12, 0));
        s.shot({ pos: a.lerp(b, k), look: s.restPos.clone().addScaledVector(this.T, -16).add(V(0, -2, 0)), fov: 46 });
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

  /**
   * The singing light, `dt0` s before (positive) or after (negative) its nearest pass, drawn as a cluster of
   * glowing puffs and a trail (src/ship/ship.js flame), lighting what is near it. Far off it is a speck; it is
   * only drawn within ~450 m. Returns where it is (world), or null when it isn't drawn.
   */
  lightFrame(dt0, dt) {
    const s = this.s;
    if (!s.spaceCopy) return null;
    const x = -dt0 / 2.5;
    if (x < -1.35 || x > 1.15) return null;
    const along = 165 * x * x * x + 25 * x;
    const local = this.LM.clone().addScaledVector(this.LD, along);
    const at = this.W(local), d = Math.abs(along);
    const core = 0.75 + d * 0.012;
    for (let i = 0; i < 2; i++) {
      const j = V((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(core * 0.5);
      s.flame.emit(at.clone().add(j), V(0, 0, 0), core * (0.8 + Math.random() * 0.4), 0.1 + Math.random() * 0.06, pickOf(LIGHT));
    }
    // its trail, thin, behind it along its way
    const back = this.W(local.clone().addScaledVector(this.LD, -1.5 - Math.random() * 5)).sub(at);
    if (d < 160) s.flame.emit(at.clone().add(back), back.clone().multiplyScalar(0.8), 0.35 + Math.random() * 0.4, 0.45 + Math.random() * 0.3, pickOf(LIGHT));
    if (this.light?.vec) this.light.vec.set(at.x, at.y, at.z, Math.max(0, 30 - d * 0.6));
    return at;
  }

  /** The light lights what is near it (one of the level's point lights, while it passes). */
  lightOn() {
    const s = this.s;
    this.light ??= { on: false, vec: null };
    if (this.light.vec || !s.lights) return;
    this.light.vec = new THREE.Vector4(0, -1e5, 0, 0);
    s.lights.push(this.light.vec);
  }

  lightOff() {
    const v = this.light?.vec, L = this.s.lights;
    if (!v || !L) return;
    const i = L.indexOf(v);
    if (i >= 0) L.splice(i, 1);
    this.light.vec = null;
  }

  /** At the cockpit console, in the orbiting ship (the prologue's walk). */
  atConsole() {
    const s = this.s;
    if (!this.sp || !s.isInside(this.sp, s.player.pos)) return false;
    const l = s.local(this.sp, s.player.pos), c = this.pt('cockpit');
    return Math.hypot(l.x - c.x, l.z - c.z) < CONSOLE_R;
  }

  /** E in the walk: at the console, the voicemail button plays the message. */
  use(id) { if (id === 'walk' && this.atConsole()) { this.pressed = true; sfx.beep(this.s.sound, true); } }
  /** What E does here, for the HUD's prompt. */
  prompt(id) { return id === 'walk' && this.atConsole() ? 'E voicemail' : null; }
  /** The ship whose voicemail button blinks: the orbiting one, until its message plays. */
  waiting(id) { return ['black', 'wake', 'rise', 'walk'].includes(id) ? this.sp : null; }

  ready(id) {
    const s = this.s;
    if (id === 'walk') return !!this.pressed && this.atConsole();
    if (id === 'stepout') return !s.auto;
    return true;
  }

  /**
   * The ship's word on what passed it, and his answer: he will follow the light (said once; they play on past
   * the hand-back, and after a skip too, so the choice is never lost).
   */
  landingLines() {
    if (this.landingSaid) return;
    this.landingSaid = true;
    const C = this.s.cinema;
    C.say(LANDING_LINE, { secs: 6 }); C.say(FOLLOW_LINE, { secs: 4.5, queue: true });
    this.s.sound?.makersHum?.({ vol: 0.55 });
  }

  /** The father's charge, given once: its title card and its sound. */
  giveCharge() {
    if (game.flag(CHARGE_CARD)) return;
    game.set(CHARGE_GIVEN, true); game.set(CHARGE_CARD, true);
    this.cardUntil = (typeof performance !== 'undefined' ? performance.now() : 0) + CHARGE_CARD_MS;
    showChargeCard({ sound: this.s.sound });
  }

  finish(skipped) {
    const s = this.s, C = s.cinema, pk = this.pk;
    this.humming?.stop(); this.humming = null;
    this.lightOff();
    if (skipped) this.cueRec?.stop?.();
    s.holo?.clear();
    // skipped before the dust cleared: the charge is still given, and the objective waits for its card
    if (skipped) this.giveCharge();
    game.set(CHARGE_GIVEN, true);
    const wait = Math.max(0, (this.cardUntil ?? 0) - (typeof performance !== 'undefined' ? performance.now() : 0));
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
      sfx.alarm(s.sound, 0); sfx.hum(s.sound, 0);
      const a = s.arrivalSpot();
      s.placePlayer(a.pos, a.heading, true);
      // over the shoulder, a little low: the city and its great dark tree stand on the horizon beside the traveller
      s.rig.yaw = a.heading + Math.PI + STEP_OUT_YAW; s.rig.pitch = 0.08;
      s.rig.target.copy(a.pos);
      s.cam = null; s.blend = null;
      if (wait > 0) setTimeout(() => C.objective(stepOutObjective()), wait - 500); else C.objective(stepOutObjective());
      setTimeout(() => this.landingLines(), Math.max(0, wait) + 1200);
    } else {
      if (!this.landingSaid) C.say(null);   // (the ship's word and his answer play on as he walks out)
      C.hint(null); C.hud(true); C.bars(false);
    }
    game.set('objective', OBJECTIVE);
    game.set('ship.level', 'desert');
    setTimeout(() => s.onReady?.(), 6800 + (skipped ? Math.max(0, wait - 500) : 0));   // after the objective card (6.5 s) has faded, never on top of it
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
    st.cuts = callCuts(tl, st.span);
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
          const cut = cutAt(st.cuts, t);
          ship.shot((cut.angle !== 'over' && callAngle(ship, m, cut.angle, t - cut.t)) || callShot(ship, m, t, st.close ?? 0));
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
 * The last of the landing, u 0..1 of its time: from 140 m up to on its feet, slowing all the way
 * and arriving at rest (no speed left at touchdown: a landing, not a crash).
 */
export function landingK(u) { u = Math.min(1, Math.max(0, u)); return 1 - Math.pow(1 - u, 3); }

/** m the planet's near surface keeps from the camera in the approach: the ship is ~45 m off, in front of it. */
export const PLANET_NEAR = 110;
/**
 * The planet's distance for an angular radius `ang`: at least `D`, and far enough that its near surface
 * (D·(1 − sin ang) from the camera) stays behind the ship. Close and huge, its face came in front of the
 * ship's legs as it filled the view (the cinematics QC pass); the size on screen is the same either way.
 */
export function planetDistance(D, ang, near = PLANET_NEAR) {
  return Math.max(D, near / Math.max(0.02, 1 - Math.sin(ang)));
}

/**
 * Arriving by ship: out of the jump, the destination planet grows ahead (drawn in its own
 * colours, src/ship/approach.js); the ship levels out and brakes into the air, through the
 * clouds; it comes down upright on its jets over the site and settles onto its feet (no fire,
 * no shaking: only the prologue's arrival is a crash); then it opens, and you walk out.
 */
export class ArrivalDirector extends Sequence {
  constructor(ship) {
    const m = ship.parked, C = ship.cinema;
    const top = ship.restPos.clone().add(V(0, 140, 0));
    const side = V(-ship.outDir.z, 0, ship.outDir.x);
    const look = new THREE.Vector3();
    const dust = () => ship.dustColors();
    // the approach: the ship flies nose first along `fwd` (its bow's way as it will stand), the planet ahead and below
    const fwd = V(0, 0, -1).applyQuaternion(ship.restQuat).setY(0).normalize(), up = V(0, 1, 0), across = V(-fwd.z, 0, fwd.x);
    const cam = new THREE.Vector3(), pl = new THREE.Vector3(), q = new THREE.Quaternion(), tilt = new THREE.Quaternion();
    const fog0 = () => { const U = ship.post?.uniforms; if (U) U.uFogMul.value = 0; };   // no haze in space
    // the planet `D` m off, `drop` rad below the ship's course, `ang` rad its angular radius (so it grows as it nears)
    const placePlanet = (a, from, D, drop, ang) => {
      D = planetDistance(D, ang);
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
          // the first time here: the ship reads the light's signature (src/story/signature.js)
          const sig = arrivalLine(ship.levelId, (k) => game.flag(k));
          if (sig) { C.say(sig, { secs: 5.2 }); for (const [k, v] of Object.entries(sig.set)) game.set(k, v); }
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
        // into the air, under control: the ship levels out and brakes on its jets as the planet
        // fills the view, a thin veil of vapour off the hull, then through the clouds (a soft white)
        dur: APPROACH.entry,
        enter: () => { sfx.descent(ship.sound, APPROACH.entry + APPROACH.sky); sfx.engines(ship.sound, 0.45); m.mats.thrust.uniforms.uGlow.value = 0.8; this.clouded = false; },
        frame: (t, dt) => {
          fog0();
          const a = ship.approach, k = t / APPROACH.entry, e = smooth(k);
          m.group.position.copy(a.centre).addScaledVector(fwd, 14 + 24 * e).addScaledVector(up, -10 * e);
          tilt.setFromAxisAngle(across, -0.35 * (1 - e));   // (nosed down out of the jump: level again)
          m.group.quaternion.copy(tilt).multiply(ship.restQuat);
          cam.copy(m.group.position).addScaledVector(fwd, -44 + 8 * e).addScaledVector(across, 20 - 5 * e).addScaledVector(up, 13 - 3 * e);
          placePlanet(a, cam, 900 - 200 * e, 0.4 + 0.35 * e, Math.min(1.32, 0.38 + 0.95 * e));
          a.update(dt);
          exhaust(ship, m, dt, { power: 0.6 });   // the braking jets (no ground under them yet)
          // vapour: a few pale wisps streaming back off the rim, no fire
          if (Math.random() < dt * 6 * e) {
            const u = Math.random() * Math.PI * 2;
            ship.smoke.emit(ship.world(m, V(Math.sin(u) * HALF_W, 1, CENTRE_Z + Math.cos(u) * LENGTH * 0.5)), pl.clone().multiplyScalar(-6).addScaledVector(fwd, -4), 0.8 + Math.random() * 0.8, 0.9, new THREE.Color('#f7f3ea'));
          }
          ship.shot({ pos: cam.clone(), look: m.group.position.clone().addScaledVector(pl, 18), fov: 50 });
          if (t > APPROACH.entry - 0.7 && !this.clouded) { this.clouded = true; C.fade(1, true, 0.6); }
        },
      },
      {
        // out of the clouds over the landing site: it comes down upright on its jets, slowing
        dur: APPROACH.sky,
        enter: () => {
          ship.removeApproach();
          m.group.quaternion.copy(ship.restQuat);
          m.mats.thrust.uniforms.uGlow.value = 1;
          C.fade(0, true, 0.7);
          sfx.engines(ship.sound, 0.6);
        },
        frame: (t, dt) => {
          const k = Math.min(1, t / APPROACH.sky), e = 1 - Math.pow(1 - k, 1.6);
          const p = ship.restPos.clone().addScaledVector(fwd, -40 * (1 - e)).add(V(0, 140 + 260 * (1 - e), 0));
          m.group.position.copy(p);
          m.group.quaternion.copy(ship.restQuat);
          exhaust(ship, m, dt, { power: 0.8, palette: dust() });
          const c = ship.restPos.clone().addScaledVector(fwd, 70).addScaledVector(side, 85).add(V(0, 230, 0));
          ship.shot({ pos: c, look: p.clone().add(V(0, -6, 0)), fov: 44 });
        },
      },
      {
        // down on its jets, the dust blowing out from under it, and gently onto its feet
        dur: 4.2,
        enter: () => {
          m.group.quaternion.copy(ship.restQuat);
          m.mats.thrust.uniforms.uGlow.value = 1;
          sfx.engines(ship.sound, 0.8);
          look.copy(top);
        },
        frame: (t, dt) => {
          const k = landingK(t / 4.2);
          m.group.position.copy(top).lerp(ship.restPos, k);
          const cam = ship.rampFoot.clone().addScaledVector(ship.outDir, 34).addScaledVector(side, 20);
          cam.y = ship.groundAt(cam.x, cam.z) + 5;
          look.lerp(m.group.position, 1 - Math.exp(-5 * dt));
          ship.shot({ pos: cam, look, fov: 50 });
          const h = m.group.position.y - ship.restPos.y;
          // set every frame, so the engines come in even if the sound starts mid-scene
          if (!this.down) sfx.engines(ship.sound, 0.55 + 0.45 * (1 - Math.min(1, h / 140)));
          if (h < 40 && !this.dusted && ship.sound?.ctx) { this.dusted = true; sfx.rumble(ship.sound, 2.4, 0.22); }
          // the jets out of the bells under the hull, and the dust they blow out along the ground (src/ship/exhaust.js)
          if (!this.down) exhaust(ship, m, dt, { power: 0.75 + 0.25 * (1 - Math.min(1, h / 60)), palette: dust() });
          if (t > 4.0 && !this.down) {
            // touchdown: the feet settle, a puff of dust from under each, the engines spool down (no jolt)
            this.down = true; sfx.rumble(ship.sound, 0.5, 0.15); sfx.engines(ship.sound, 0); m.mats.thrust.uniforms.uGlow.value = 0;
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
          ship.placePlayer(ship.world(m, m.interior.points.threshold), ship.site.heading, true);
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
          ship.shot(tableShot(ship, m, t));
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
          rumblePlay('takeoff');   // (src/rumble.js)
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
