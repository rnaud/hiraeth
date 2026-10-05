import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Dog } from '../dog.js';
import { spoken } from './tone.js';
import { HOME_SPOTS, unlaidTokens, laidTokens, layTokens, tokensNow, tokenModel } from '../levels/home.js';
import { FLOWERS } from '../levels/home-garden.js';
import { tokenLine } from './ending.js';
import { PEOPLE, THINGS, HOMAGE, PETTED } from './home-data.js';

// Home, alive (home-data.js has the words; src/levels/home.js the place).
//
//   Lou        the traveller's daughter: by the flower border when you come; she
//              runs to meet you and asks what you brought (once a visit), then
//              goes about her day: the garden, the swing, the stone, her door
//   Tove       on the garden bench, shelling beans
//   Moustache  the dog (src/dog.js): follows you everywhere, barks at the bird
//              and the drone; E pets him
//   the stone  E pays your respects (Homage): you kneel; you lay the flower you
//              picked, or what you have found since you were last here (the
//              ending's tokens, consistently: the slab keeps them), or just your
//              hand; a quiet moment with music, framed on the stone; you rise
//   the garden E picks a flower (one in hand at a time)
//   the houses the round house's door (push it open), its memories (the photo,
//              the chair, the scarf, the recorder, the window); in the small
//              house Lou's shelf and drawings, and the window seat (E sits)
//
// The homecoming (src/ship/homecoming.js) borrows Lou and the dog through
// level.family: she runs down the path to meet you and comes to the stone.
//
// Flags: home.lou.met, home.tove.met, home.flower.held (a flower's kind),
// home.flowers (the kinds on the stone), home.stone (src/levels/home.js), home.visits.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = THREE.MathUtils.lerp;
const pick = (list, k) => list[((k % list.length) + list.length) % list.length];

/** A seven-year-old on the people's body (morph.js): a bigger head, shorter limbs, a round face. */
export const LOU_MORPH = PEOPLE.lou.morph;
export const LOU_FACE = PEOPLE.lou.face;

// ------------------------------------------------------------------ poses laid over the clip (player.overlay)

/** Kneeling on the right knee, the left foot forward, head bowed; reach 0..1 sets something down. */
export function kneelPose(c, k, reach = 0) {
  if (k <= 0.001) return;
  const L = (o, axis, v) => { o.rotation[axis] = lerp(o.rotation[axis], v, k); };
  L(c.legs[0], 'x', 0.08); L(c.knees[0], 'x', 1.65); L(c.feet[0], 'x', -0.5);      // the right knee down, the shin along the grass
  L(c.legs[1], 'x', -1.4); L(c.knees[1], 'x', 1.45); L(c.feet[1], 'x', 0);         // the left foot planted in front
  for (const i of [0, 1]) { L(c.legs[i], 'y', 0); L(c.legs[i], 'z', 0); }
  c.body.position.y = lerp(c.body.position.y, -0.42, k);
  c.body.rotation.x = lerp(c.body.rotation.x, 0, k);
  L(c.torso, 'x', 0.22 + reach * 0.3);
  L(c.head, 'x', 0.38 - reach * 0.1);
  // the left hand on the left knee; the right one rests on the thigh, or reaches out to the slab
  L(c.arms[1], 'x', -0.95); L(c.arms[1], 'z', 0.12); L(c.elbows[1], 'x', -0.55);
  L(c.arms[0], 'x', lerp(-0.25, -1.25, reach)); L(c.arms[0], 'z', -0.08); L(c.elbows[0], 'x', lerp(-0.5, -0.15, reach));
}

/** Sitting on a seat ~0.47 m high, hands in the lap. */
export function sitPose(c, k) {
  if (k <= 0.001) return;
  const L = (o, axis, v) => { o.rotation[axis] = lerp(o.rotation[axis], v, k); };
  for (const i of [0, 1]) {
    L(c.legs[i], 'x', -1.5); L(c.legs[i], 'y', 0); L(c.legs[i], 'z', 0); L(c.knees[i], 'x', 1.45); L(c.feet[i], 'x', 0.05);
    L(c.arms[i], 'x', -0.55); L(c.arms[i], 'z', (i ? 1 : -1) * 0.15); L(c.elbows[i], 'x', -1.0);
  }
  c.body.position.y = lerp(c.body.position.y, -0.44, k);
  c.body.position.z = lerp(c.body.position.z, -0.22, k);
  c.body.rotation.x = lerp(c.body.rotation.x, 0, k);
  L(c.torso, 'x', 0.1);
  L(c.head, 'x', 0.05);
}

// ------------------------------------------------------------------ a quiet moment (the stone, the window seat)

/**
 * A short scene of its own: the traveller set in place and posed, the camera framed, a few
 * lines, then back to you. No menus: it plays (Esc hurries it).
 * @param o { player, ship (shot/release/cinema), at, heading, pose: 'kneel' | 'sit', beats: [{ t, line?, run? }], dur, shot(t, k) }
 */
export class Moment {
  constructor(o) { Object.assign(this, o); this.t = 0; this.done = false; this.k = 0; this.reach = 0; this.reachTo = 0; this._next = 0; }
  start() {
    const P = this.player;
    this.from = P.pos.clone();
    this.fromHeading = P.heading;
    P.vel?.set?.(0, 0, 0);
    P.overlay = (p) => { const c = p.char; if (this.pose === 'sit') sitPose(c, smooth(this.k)); else kneelPose(c, smooth(this.k), this.reach); };
    const C = this.ship?.cinema;
    C?.bars?.(true); C?.hud?.(false);
    this.onStart?.();
  }
  /** Esc: on to the end (the beats still happen, quickly). */
  hurry() { if (this.t < this.dur - 1.2) this.t = this.dur - 1.2; }
  update(dt) {
    if (this.done) return;
    this.t += dt;
    const P = this.player, T = this.t, D = this.dur;
    // settle into place, down, (beats), up
    const settle = smooth(T / 0.7);
    if (this.at) { P.pos.x = lerp(this.from.x, this.at.x, settle); P.pos.z = lerp(this.from.z, this.at.z, settle); }
    if (this.heading !== undefined) P.heading = this.fromHeading + Math.atan2(Math.sin(this.heading - this.fromHeading), Math.cos(this.heading - this.fromHeading)) * settle;
    P.vel?.set?.(0, 0, 0);
    this.reach = lerp(this.reach, this.reachTo ?? 0, 1 - Math.exp(-5 * dt));
    this.k = T < 0.5 ? 0 : T < 1.6 ? (T - 0.5) / 1.1 : T > D - 1.3 ? Math.max(0, (D - T) / 1.1) : 1;
    while (this._next < this.beats.length && T >= this.beats[this._next].t) {
      const b = this.beats[this._next++];
      if (b.line) this.ship?.cinema?.say(b.line, { secs: b.secs ?? 3.6 });
      b.run?.(this);
    }
    const shot = this.shot?.(T, this.k);
    if (shot) this.ship?.shot?.(shot);
    if (T >= D) this.finish();
  }
  finish() {
    if (this.done) return;
    while (this._next < this.beats.length) { const b = this.beats[this._next++]; b.run?.(this); }
    this.done = true;
    this.player.overlay = null;
    const c = this.player.char;
    if (c) { c.body.position.set(0, 0, 0); }
    const C = this.ship?.cinema;
    C?.say(null); C?.bars?.(false); C?.hud?.(true);
    this.ship?.release?.(1.2);
    this.onEnd?.();
  }
}

// ------------------------------------------------------------------ the world's setup

export function setupHome(ctx) {
  const { level, physics, player, dialogue, game, sound, spawn, scene, toast, ship = null, drone = null } = ctx;
  const H = level.home;
  if (!H) return null;
  const { garden, parents, small } = H;
  const tomb = level.tomb;
  const shipBusy = () => !!(ship?.playing || ship?.busy?.());
  const ending = () => !!ship?.cinematic?.homecoming && !ship.cinematic.done;
  const ground = (x, z, from = 3) => { const g = physics?.groundAt?.(x, from + 2, z, 12); return Number.isFinite(g) ? g : level.ground.heightAt(x, z); };
  const onGround = (p) => V(p.x, ground(p.x, p.z, p.y + 1), p.z);
  game.set('home.visits', (game.flag('home.visits') ?? 0) + 1);
  game.set('home.flower.held', null);   // (a flower doesn't keep between visits)

  // ---------------------------------------------------------------- Lou, Tove, Moustache
  const louHome = onGround(HOME_SPOTS.lou);
  const louRoute = [louHome, onGround(V(11.4, 0, 21.6)), onGround(garden.spots.gateN), onGround(small.doorOut), onGround(V(-11.6, 0, 37.8)), onGround(V(-4.6, 0, 19.2)), onGround(V(5.2, 0, 21.0))];
  const lou = spawn(PEOPLE.lou, { route: louRoute, speed: 1.2 });
  // (her child's body and face come with her: PEOPLE.lou.morph / .face, src/npc.js)
  lou.heading = Math.PI;
  // (on the bench itself: the ground the NPC finds there is its seat, so `seat` is only a hair)
  const tove = spawn(PEOPLE.tove, { route: [onGround(garden.spots.bench)], seat: 0.01, heading: garden.spots.benchHeading });
  tove.heading = garden.spots.benchHeading;
  const dog = new Dog(scene, { physics, at: onGround(V(louHome.x + 1.2, 0, louHome.z - 0.6)), heading: Math.PI, onBark: () => sound.bark?.() });
  level.family = { lou, tove, dog };

  // ---------------------------------------------------------------- the greeting: once a visit, she runs to you
  const st = { greeted: false, homage: null, moment: null, held: null, heldMesh: null, petT: 0, quietIdx: game.flag('home.visits') ?? 0 };
  const greet = () => { if (!st.greeted && !dialogue.open) dialogue.start(PEOPLE.lou, lou); };
  // (talking to her first counts too: the greeting's words are chosen as the talk opens)
  game.on('dialogue:start', ({ id } = {}) => { if (id === 'lou') { st.greeted = true; lou.greetedThisVisit = true; lou.follow = null; } });

  // ---------------------------------------------------------------- the flower in your hand
  // (held in the rig's right hand: its forearm points down its -y, the character's front is +z)
  const hand = () => player.char?.elbows?.[0] ?? null;
  const showHeld = (kind) => {
    if (st.heldMesh) { st.heldMesh.removeFromParent(); st.heldMesh = null; }
    st.held = kind;
    game.set('home.flower.held', kind ?? null);
    const h = hand();
    if (!kind || !h) return;
    const m = new THREE.Mesh(garden.flowers.find((f) => f.kind === kind)?.geometry ?? new THREE.SphereGeometry(0.04), garden.flowerMaterial);
    m.userData.noCollide = true;
    m.scale.setScalar(1.2 / Math.max(1e-3, player.object.scale.x));
    m.position.set(0, -0.31, 0.05);
    m.rotation.set(Math.PI - 1.0, 0, 0);
    h.add(m);
    st.heldMesh = m;
  };

  // ---------------------------------------------------------------- interactables
  const thing = (def, at, { range = 2.2, prompt, enabled = () => true, use, dy = 2.5 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ').replace(/^Your /, 'your ').replace(/^A /, 'the ')}`,
    at: () => at, enabled: () => !st.moment && enabled(), distance: (p) => (Math.abs(p.pos.y - at.y) < dy ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at)),
  });
  // the stone
  const stand = tomb.stand.clone();
  stand.y = ground(stand.x, stand.z);
  const homagePrompt = () => (st.held ? `lay the ${FLOWERS.find((f) => f.id === st.held)?.name.replace(/^an? /, '') ?? 'flower'} on the stone` : unlaidTokens(game).length && game.flag('ending.done') ? 'set down what you brought' : 'pay your respects');
  registerInteractable({ id: 'home.stone', priority: PRIORITY.use + 2, range: 2.4, prompt: homagePrompt, at: () => tomb.group.localToWorld(V(0, 1.9, -0.5)),
    enabled: () => !st.moment && !ending() && !shipBusy(), distance: (p) => (Math.abs(p.pos.y - stand.y) < 2 ? Math.min(flat(p.pos, stand), flat(p.pos, HOME_SPOTS.tomb) - 0.6) : Infinity),
    use: () => homage() });
  // the flowers in the border
  registerInteractable({ id: 'home.flower', priority: PRIORITY.use, range: 1.5, prompt: () => (st.held ? 'pick another flower' : 'pick a flower'),
    at: () => garden.nearest(player.pos, 1.6)?.at.clone().add(V(0, 1.0, 0)) ?? garden.spots.border, enabled: () => !st.moment && !!garden.nearest(player.pos, 1.6),
    distance: (p) => { const f = garden.nearest(p.pos, 1.6); return f ? flat(p.pos, f.at) : Infinity; },
    use: () => pickFlower() });
  function pickFlower(from = player.pos) {
    const f = garden.pick(from, 1.6);
    if (!f) return null;
    showHeld(f.kind);
    sound.chime?.();
    toast(`You pick ${FLOWERS.find((x) => x.id === f.kind)?.name ?? 'a flower'}.`);
    return f;
  }
  // Moustache
  registerInteractable({ id: 'home.dog', priority: PRIORITY.talk + 1, range: 1.9, prompt: 'pet Moustache', at: () => dog.pos.clone().add(V(0, 1.1, 0)),
    enabled: () => !st.moment && dog.state !== 'bark', distance: (p) => (Math.abs(p.pos.y - dog.pos.y) < 1.5 ? flat(p.pos, dog.pos) : Infinity),
    use: () => {
      dog.pet();
      player.faceToward = dog.pos.clone();
      st.petT = 1.6;
      sound.critter?.('squeak', 0.5);
      toast(spoken('scene', pick(PETTED, Math.floor(Math.random() * 97))).text);
    } });
  // the round house: its door, and what is inside
  registerInteractable({ id: 'home.parents.door', priority: PRIORITY.use + 1, range: 2.6, prompt: 'push the door open', at: () => parents.threshold.clone().add(V(0, 2.2, 0)),
    enabled: () => !st.moment && parents.door.k < 0.5 && !ending(), distance: (p) => flat(p.pos, parents.threshold),
    use: () => { st.doorTo = 1; sound.boxCreak?.(); } });
  const S = parents.spots;
  thing(THINGS.photo, S.photo, { range: 2.0 });
  thing(THINGS.chair, S.chair.clone().setY(S.chair.y + 0.6), { range: 2.2 });
  thing(THINGS.scarf, S.scarf, { range: 1.8 });
  thing(THINGS.recorder, S.recorder, { range: 2.0 });
  thing(THINGS.window, S.window.clone().setY(parents.floor + 0.8), { range: 2.4, prompt: 'look out of the round window', use: () => dialogue.start(THINGS.window, null, S.window.clone().setY(parents.floor + 1.2), S.windowLook) });
  // the small house: the shelf, the drawings, the window seat
  const T = small.spots;
  thing(THINGS.shelf, T.shelf, { range: 2.0 });
  thing(THINGS.wall, T.drawings, { range: 2.0 });
  thing(THINGS.seat, T.seat.clone().setY(small.floor + 0.6), { range: 1.6, prompt: 'sit in the window seat', use: () => windowSeat() });

  // ---------------------------------------------------------------- the stone: paying your respects
  const L = (x, y, z) => tomb.group.localToWorld(V(x, y, z));
  function homage() {
    if (st.moment) return;
    const flower = st.held, fresh = game.flag('ending.done') ? unlaidTokens(game) : [];
    const beats = [{ t: 0.6, line: spoken('scene', HOMAGE.arrive), secs: 3.2 }];
    let t = 3.6;
    const louNear = flat(lou.pos, stand) < 14 && !lou.talkTo;
    if (flower) {
      const name = FLOWERS.find((f) => f.id === flower)?.name ?? 'a flower';
      beats.push({ t, line: spoken('scene', HOMAGE.flower(name)), secs: 3, run: (m) => { m.reachTo = 1; } });
      beats.push({ t: t + 1.3, run: (m) => {
        m.reachTo = 0;
        showHeld(null);
        const kinds = [...(game.flag('home.flowers') ?? []), flower].slice(-12);
        game.set('home.flowers', kinds);
        tomb.addFlower(flower);
        sound.chime?.();
      } });
      t += 3.2;
    } else if (fresh.length) {
      // the slab makes room (everything at its place among all of them), then each new one goes down
      const before = laidTokens(game), ids = new Set([...before, ...fresh].map((x) => x.id));
      const after = tokensNow(game).filter((x) => ids.has(x.id));
      beats.push({ t, line: spoken('scene', HOMAGE.tokens), secs: 2.6, run: () => {
        tomb.clear();
        for (const x of before) tomb.add(tokenModel(x), after.indexOf(x), after.length);
        if (game.flag('ending.done')) tomb.addReel();
      } });
      t += 2.4;
      for (const tok of fresh) {
        beats.push({ t, line: tokenLine(tok), secs: 2.2, run: (m) => { m.reachTo = 1; } });
        beats.push({ t: t + 1.0, run: (m) => { m.reachTo = 0; tomb.add(tokenModel(tok), after.indexOf(tok), after.length); sound.beep?.(); } });
        t += 2.3;
      }
      beats.push({ t, run: () => layTokens(game, fresh) });
    } else {
      beats.push({ t, line: spoken('scene', HOMAGE.empty), secs: 3, run: (m) => { m.reachTo = 0.6; } });
      beats.push({ t: t + 2.2, run: (m) => { m.reachTo = 0; } });
      t += 3.2;
    }
    if (louNear) beats.push({ t: t - 0.4, line: spoken('scene', HOMAGE.lou), secs: 3.4, run: () => { st.louKneel = true; } });
    else beats.push({ t: t - 0.4, line: spoken('scene', pick(HOMAGE.quiet, st.quietIdx++)), secs: 3.4 });
    t += 3.4;
    beats.push({ t, line: spoken('you', pick(HOMAGE.say, st.quietIdx)), secs: 2.6 });
    t += 2.8;
    const heading = Math.atan2(HOME_SPOTS.tomb.x - stand.x, HOME_SPOTS.tomb.z - stand.z);
    st.moment = new Moment({
      player, ship, at: stand, heading, pose: 'kneel', dur: t + 1.6, beats,
      // a low three-quarter shot over his right shoulder onto the slab, pushing in a little; then wider as he rises
      shot: (T, k) => {
        const push = Math.min(T * 0.025, 0.35);
        const rise = Math.max(0, T - (t + 0.2)) / 1.4;
        return { pos: L(2.15 - push + rise * 1.2, 0.95 + rise * 0.8, 2.6 - push + rise * 1.6), look: L(-0.15, 0.62 + (1 - k) * 0.3, 0.15), fov: 38 + rise * 6 };
      },
      onStart: () => { sound.homage?.(HOME_SPOTS.tomb); dog.lie(true); },
      onEnd: () => { st.moment = null; st.louKneel = false; dog.lie(false); },
    });
    st.moment.start();
  }
  // ---------------------------------------------------------------- the window seat
  function windowSeat() {
    if (st.moment) return;
    const at = T.seat.clone();
    const out = T.window;
    st.moment = new Moment({
      player, ship, at, heading: T.seatHeading, pose: 'sit', dur: 9.5,
      beats: [{ t: 1.4, line: spoken('scene', THINGS.seat.talk.nodes.look.say[0]), secs: 3.6 }, { t: 5.2, line: spoken('scene', THINGS.seat.talk.nodes.look.say[1]), secs: 3.6 }],
      // beside him, low, looking past him out of the window (the ring, the ship, the sky)
      shot: (Tt) => ({ pos: at.clone().lerp(small.spots.table, 0.45).setY(small.floor + 1.25), look: out.clone().setY(small.floor + 1.5 + Math.min(Tt * 0.05, 0.4)), fov: 50 }),
      onEnd: () => { st.moment = null; },
    });
    st.moment.start();
  }

  // ---------------------------------------------------------------- per frame
  const _drone = V(0, 0, 0);
  const update = (dt, t) => {
    // the door swings when pushed
    if (st.doorTo !== undefined && parents.door.k < st.doorTo) parents.door.open(Math.min(st.doorTo, parents.door.k + dt * 0.7));
    // a quiet moment plays
    st.moment?.update(dt);
    if (st.petT > 0 && (st.petT -= dt) <= 0) player.faceToward = null;
    // Lou: runs to meet you once a visit, as soon as you are out under the sky (not during the ending)
    const busy = shipBusy() || ending();
    if (!st.greeted && !busy && !ship?.inside && !dialogue.open && !st.moment) {
      const d = flat(lou.pos, player.pos);
      if (d < 48) lou.follow = () => ({ pos: player.pos, speed: 3.6, near: 1.7, max: 4.6 });
      if (d < 2.4) greet();
    }
    if (ending()) st.greeted = true;   // (the ending is her greeting)
    lou.hush = tove.hush = ending() || !!st.moment;   // (no balloons over a scene)
    // at the stone with you, during a moment there: she stands beside you
    if (st.louKneel) lou.follow = () => ({ pos: stand.clone().add(V(-0.9, 0, 0.5)), speed: 1.4, near: 0.4, face: Math.atan2(HOME_SPOTS.tomb.x - stand.x, HOME_SPOTS.tomb.z - stand.z) });
    else if (st.greeted && lou.follow && !level.family.directed) lou.follow = null;
    // Moustache
    const targets = [];
    const m = player.mount;
    if (m?.object?.visible && m.kind === 'bird' && player.ride !== m) targets.push(m.object.position);
    const dp = drone?.(_drone);
    if (dp) targets.push(dp);
    // (at the ending he comes along, and lies down by the stone while you are there)
    const atStone = ending() && ship.cinematic.stage === 'tomb';
    if (atStone !== st.dogDown) { st.dogDown = atStone; dog.lie(atStone); }
    dog.update(dt, { leader: player, targets, busy: !!st.moment || (busy && !ending()) });
    void t;
  };

  // ---------------------------------------------------------------- music: a band by the small house, the fire's crackle
  sound.setBands?.([{ id: 'small', pos: small.spots.hearth, radius: 16, parts: ['bell'], mode: 'play', vol: 0.25, duck: 0.4 }]);
  game.on('keepsake', () => level.home.furnish?.());
  // Esc during a quiet moment hurries it on (it never traps you)
  if (typeof window !== 'undefined') window.addEventListener('keydown', (e) => { if (st.moment && e.code === 'Escape' && !e.repeat) st.moment.hurry(); });

  return {
    people: { lou, tove }, dog, update, state: st, homage, windowSeat, pickFlower,
    /** A scene is playing (the stone, the window seat): the player's input stays out of it. */
    busy: () => !!st.moment,
    /** Esc during a moment hurries it on. */
    hurry: () => st.moment?.hurry(),
  };
}
