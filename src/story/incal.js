import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Taxi } from '../taxi.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glyphGeometry, textGeometry } from './sign-text.js';
import { QUESTS, PEOPLE, THINGS, LINES, ITEMS, CROWD_TALK, PASS_REFUSAL, WREN } from './incal-data.js';
import { setupHalfway } from './halfway.js';
import { setupIncalMoments } from './incal-moments.js';

// The City-Shaft's story, alive (incal-data.js has the words).
//
//   the rim          Corvin, Lio and Tobin (content.js); the ship lands here
//   the high terrace Nima sweeps the first terrace below the rim (y 150)
//   the bottom       Ossa keeps the Upward Shrine (y −290), where the splinter
//                    fell; Pip plays round it; the dead taxi call-lamp at the edge
//   the palace       Dov guards the landing ring round the gold dome (y 320); the
//                    crown on top of the dome, under the Lodestar
//   the middle       Perrine's halfway tea stall and the halfway mirror, by the middle
//                    levels' cab stop (y −24: src/story/halfway.js)
//
// The light: level.shaft.incal.k goes from 0 (dim, guttering) to 1 when the
// splinter is given back and you look up at it from the palace. Then the city
// looks up with you: the crowd's heads turn up, the lines change, lamps come on
// down the lower terraces and the smog thins.
//
// The cabs don't stop for you at all without a cab pass (src/taxi.js): the first refusal starts
// Lio's errand (incal.pass); Tobin's fare buys the pass. With it, they still don't stop in the
// depths (below −200) until you have lit the call-lamp and met Wren, the old cab that still stops
// there; after that, hailing down there brings Wren (it is free: it stops for anyone). Cabs drive
// themselves: Wren speaks from the little screen on its dash when you get in (src/story/cab.js).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Q = 'incal.light';
const DEPTHS = -200;          // below this, the cabs don't stop (except Wren)
const UP = V(0, 1, 0);
const _v = V(0, 0, 0), _d = V(0, 0, 0);

export function setupIncal(ctx) {
  const { level, physics, player, crowd, quests, dialogue, game, sound, story, spawn, scene, toast, npcs } = ctx;
  const S = level.shaft;
  if (!S?.places) return null;
  const P = S.places, rig = S.incal, PY = P.palace.y;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  // the main quest doesn't just appear: it starts when you talk to Nima (the scout finds them till then: src/story/quests.js opensWith)
  if (!quests.isStarted(Q)) quests.opensWith(Q, 'nima');
  // a quest tracked in another world has no marker here: track this world's
  if (!quests.def(quests.tracked() ?? '')) quests.track(quests.isActive(Q) ? Q : quests.active().find((d) => d.world === 'incal')?.id);

  const lit = () => !!game.flag('incal.lit');
  const ground = (p, from = 2) => { const g = physics.groundAt(p.x, p.y + from, p.z, 6); return Number.isFinite(g) ? g : p.y; };
  const onGround = (p) => V(p.x, ground(p), p.z);
  const around = (c, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return onGround(V(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)); });
  const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  // ---------------------------------------------------------------- the people
  const people = {};
  people.nima = npcs.find((n) => n.def?.id === 'nima') ?? spawn(PEOPLE.nima, { route: around(P.nima, 1.8, 4), speed: 0.45 });
  people.ossa = spawn(PEOPLE.ossa, { route: [onGround(P.ossa)], heading: facing(P.ossa, P.shrine), speed: 0.4 });
  people.pip = spawn(PEOPLE.pip, { route: around(P.pip, 2.6, 5, 0.4), speed: 2.1 });
  people.dov = spawn(PEOPLE.dov, { route: [onGround(P.palace.dov), onGround(P.palace.dov.clone().add(V(0, 0, -5)))], speed: 0.5 });
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  // the middle levels: Perrine's halfway stall and its mirror (src/story/halfway.js)
  const midT = S.terraces?.find((t) => t.y === S.LEVELS?.[3]);
  const halfway = setupHalfway(ctx, { terrace: midT, ground: (x, z) => { const g = physics.groundAt(x, midT.y + 2, z, 6); return Number.isFinite(g) ? g : midT.y; }, onGround });
  if (halfway?.perrine) people.perrine = halfway.perrine;

  // ---------------------------------------------------------------- the splinter
  // in the shrine's bowl until Ossa gives it; then it floats at your shoulder, humming,
  // until you give it back to the light
  const splMat = makeMaterial({ color: '#fff8e8', flat: true, glow: 1, key: 'incal.splinter' });
  const splinter = new THREE.Group();
  splinter.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0).scale(1, 2.4, 1), splMat));
  const sg = new THREE.Mesh(glyphGeometry(0.16, 0.01).translate(0, -0.05, 0.075), makeMaterial({ color: '#8a6a3a', flat: true, metal: 'brass' }));
  splinter.add(sg);
  splinter.traverse((o) => { o.userData.noCollide = true; });
  splinter.position.copy(P.bowlTop);
  scene.add(splinter);
  const st = { release: null, lookT: 0, k: lit() ? 1 : 0, shoutT: 0, carryT: 0, refuseT: -1e9, lampK: game.flag('incal.lamp.lit') ? 1 : 0, gaze: 0 };
  splinter.visible = !lit();

  // ---------------------------------------------------------------- things to look at
  const thing = (def, at, { range = 3, prompt, enabled = () => true } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity),
    use: () => dialogue.start(def, null, at),
  });
  thing(THINGS.bowl, P.bowlTop, { range: 3.2, prompt: 'look into the bowl' });
  const lampAt = P.lamp.clone().add(V(0, 1.4, 0));
  thing(THINGS.lamp, lampAt, { range: 3, prompt: 'look at the call-lamp' });

  // ---------------------------------------------------------------- the call-lamp and Wren, the old cab
  const lampHead = P.lampHead, lampWorld = V(0, 0, 0);
  const lampLight = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights.push(lampLight);
  const cab = new Taxi(physics, '#f2c54b', 2.1, null, { fares: false, free: true });   // (it circles for a fare that never calls: no one aboard; it stops for anyone, pass or none)
  cab.routes = level.cabRoutes ?? null;
  // its own voice and its own words as you get in (the first time: who it is), then where to
  cab.voice = { id: WREN.id, name: WREN.name, title: WREN.title, voice: WREN.voice, kind: WREN.kind };
  cab.talk = (where, { greet }) => (greet ? { entry: WREN.talk.entry, nodes: { ...WREN.talk.nodes, where } } : { entry: [{ node: 'where' }], nodes: { where } });
  quests.locate('wren', () => cab.pos);
  const cabHome = P.cab.clone(), cabHeading = facing(P.cab, P.lamp) + Math.PI / 2;
  // before the lamp: it circles low in the depths, looking for a fare that never calls
  const circling = (t, taxi) => {
    const a = t * 0.045 + 1.3, rad = 150;
    taxi.pos.set(Math.cos(a) * rad, -255 + Math.sin(t * 0.3) * 6, Math.sin(a) * rad);
    taxi.heading = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
    taxi.bank = -0.18; taxi.pitch = 0;
  };
  const home = (t, taxi) => { taxi.pos.copy(cabHome); taxi.pos.y += Math.sin(t * 1.3) * 0.15; taxi.heading = cabHeading; taxi.bank = 0; taxi.pitch = 0; };
  cab.lane = game.flag('incal.lamp.lit') ? home : circling;
  cab.update(0, null, 0);
  scene.add(cab.object);
  level.vehicles.push(cab);
  player.vehicles.push(cab);
  if (game.flag('incal.lamp.lit')) { cab.pos.copy(cabHome); cab.mode = 'parked'; cab.parkY = cabHome.y; }
  const lightLamp = () => {
    if (game.flag('incal.lamp.lit')) return;
    if (!quests.isStarted('incal.wren')) quests.start('incal.wren');
    game.set('incal.lamp.lit', true);
    toast('The call-lamp flickers, coughs out a moth, and burns yellow over the void.');
    sound.chime?.();
    // somewhere out in the depths, a cab turns toward it
    cab.lane = home;
    if (cab.mode !== 'aboard' && cab.mode !== 'route') { cab.target = cabHome.clone(); cab.targetHeading = cabHeading; cab.mode = 'hail'; }
  };
  registerTarget({ kind: 'lamp', radius: 0.9, position: () => lampHead.mesh.getWorldPosition(lampWorld), enabled: () => !game.flag('incal.lamp.lit') && flat(player.pos, P.lamp) < 80,
    onHit: (mode) => {
      if (mode === 'shoot') { lightLamp(); return true; }
      st.lampWobble = 1;
      return true;
    } });
  quests.locate('lamp', () => lampAt);

  // ---------------------------------------------------------------- the goods hoist and Pip's tin
  // Pip's mum hangs the day's ration tin in the old hoist's basket, out over the void where the rats
  // can't get it (src/levels/incal.js builds it), and the arm's pin has rusted in. Knock the pin out
  // with a shot, then push the weight on the arm's short end round the post (pushed along the arm,
  // toward the edge, it only rocks) and the basket swings in over the terrace, where you can take
  // the tin. Saves already carrying it (or past it) find the hoist swung in, its basket empty.
  const H = P.hoistRig, RQ = 'incal.ration', SWING = 2.6, PIN_FALL = 0.8;
  const ho = { pinT: 0, swing: null, sway: 0, wobble: 0, hintT: -1e9, clock: 0 };
  const settled = () => quests.reached(RQ, 'carry') || quests.has('ration');
  const pinOut = () => !!game.flag('incal.hoist.pin') || settled();
  const swungIn = () => !!game.flag('incal.hoist.in') || settled();
  const hoistNear = () => flat(player.pos, P.hoist) < 90 && Math.abs(player.pos.y - P.hoist.y) < 40;
  const hoistHint = (text, every = 4) => { if (ho.clock - ho.hintT > every) { ho.hintT = ho.clock; toast(text); } };
  const pinPose = (u) => {
    // out along its own length, then down onto the stones, turning over
    const e = Math.min(1, u);
    H.pin.position.set(0, THREE.MathUtils.lerp(H.pinRest.y, 0.07, e * e), H.pinRest.z + e * 1.1);
    H.pin.rotation.set(0, e * 2.2, 0);
  };
  const hoistWorld = { post: V(0, 0, 0), weight: V(0, 0, 0), pin: V(0, 0, 0), basket: V(0, 0, 0) };
  const basketAt = () => H.hang.localToWorld(hoistWorld.basket.set(0, -3.0, 0));
  if (pinOut()) { ho.pinT = PIN_FALL; pinPose(1); }
  if (swungIn()) H.arm.rotation.y = Math.PI;
  H.tin.visible = !settled();
  const knockPin = () => {
    if (pinOut()) return false;
    game.set('incal.hoist.pin', true);
    ho.pinT = 0.001;
    toast('The shot knocks the rusted pin out of the collar. It rings on the stones. The hoist’s arm is free to turn.');
    sound.chime?.();
    return true;
  };
  const turnHoist = (dir) => {
    if (swungIn() || ho.swing) return false;
    if (!pinOut()) {
      ho.wobble = 1;
      hoistHint('The arm groans against its collar and won’t turn: a rusted pin through the collar is holding it.');
      return false;
    }
    H.weight.getWorldPosition(hoistWorld.weight);
    const rx = hoistWorld.weight.x - P.hoist.x, rz = hoistWorld.weight.z - P.hoist.z, rl = Math.hypot(rx, rz) || 1;
    const dl = Math.hypot(dir.x, dir.z);
    if (dl < 1e-6) return false;
    const tq = (rz * dir.x - rx * dir.z) / (rl * dl);   // the push's turning part, round the post (+: rotation.y grows)
    if (Math.abs(tq) < 0.45) {
      ho.wobble = 1;
      hoistHint('The weight shoves along the arm, and the arm rocks on its sleeve, but it doesn’t turn. Push the weight round the post, not along the arm.');
      return false;
    }
    game.set('incal.hoist.in', true);
    ho.swing = { from: H.arm.rotation.y, to: H.arm.rotation.y + Math.sign(tq) * Math.PI, t: 0 };
    toast('The weight swings round the post, and the arm with it: the basket comes in over the terrace, swaying.');
    sound.whoosh?.();
    return true;
  };
  registerTarget({ kind: 'hoistPin', radius: 0.5, position: () => H.pin.getWorldPosition(hoistWorld.pin), enabled: () => !pinOut() && hoistNear(),
    onHit: (mode) => {
      if (mode === 'shoot') return knockPin();
      ho.wobble = 1;
      hoistHint('The pin is rusted fast: a push only rattles it. Something sharper might knock it out.');
      return true;
    } });
  registerTarget({ kind: 'hoistWeight', radius: 0.75, position: () => H.weight.getWorldPosition(hoistWorld.weight), enabled: () => !swungIn() && !ho.swing && hoistNear(),
    onHit: (mode, point, dir) => {
      if (mode === 'push') return turnHoist(dir);
      ho.wobble = 0.6;
      hoistHint(pinOut() ? 'Clang. The weight sways and settles. It wants a push, round the post.' : 'Clang. The arm doesn’t budge: a rusted pin through the collar holds it.');
      return true;
    } });
  const takeTin = () => {
    quests.give('ration');
    toast(`Picked up ${ITEMS.ration}`);
    H.tin.visible = false;
    quests.advance(RQ, 'hoist');
    sound.chime?.();
  };
  thing(THINGS.hoist, P.hoist, { range: 3.2, prompt: 'look at the goods hoist', enabled: () => !swungIn() });
  registerInteractable({ id: 'hoistBasket', priority: PRIORITY.use, range: 2.4, at: () => basketAt().clone().add(UP), enabled: () => swungIn() && !ho.swing && !settled(),
    prompt: () => (quests.stage(RQ) === 'hoist' ? 'take the ration tin' : 'look in the basket'),
    distance: (p) => { const b = basketAt(); return Math.abs(p.pos.y - P.hoist.y) < 3 ? flat(p.pos, b) : Infinity; },
    use: () => { if (quests.stage(RQ) === 'hoist') takeTin(); else dialogue.start(THINGS.hoist, null, basketAt().clone()); } });
  quests.locate('hoist', () => (swungIn() ? basketAt().clone() : P.hoist));
  const updateHoist = (dt, pp) => {
    ho.clock += dt;
    if (flat(pp, P.hoist) > 300 || Math.abs(pp.y - P.hoist.y) > 170) return;
    if (ho.pinT > 0 && ho.pinT < PIN_FALL) { ho.pinT = Math.min(PIN_FALL, ho.pinT + dt); pinPose(ho.pinT / PIN_FALL); }
    if (ho.swing) {
      const w = ho.swing;
      w.t = Math.min(SWING, w.t + dt);
      H.arm.rotation.y = THREE.MathUtils.lerp(w.from, w.to, THREE.MathUtils.smootherstep(w.t, 0, SWING));
      ho.sway = 0.3 * Math.sin(Math.PI * w.t / SWING) + (w.t >= SWING ? 0.18 : 0);
      if (w.t >= SWING) ho.swing = null;
    }
    ho.sway = Math.max(0, ho.sway - dt * 0.08);
    H.hang.rotation.x = Math.sin(ho.clock * 2.3) * ho.sway;
    if (ho.wobble > 0) {
      ho.wobble = Math.max(0, ho.wobble - dt * 2.2);
      // (only while it's stuck out over the void: the arm rocks on its sleeve, the pin rattles)
      if (!swungIn() && !ho.swing) H.arm.rotation.y = Math.sin(ho.wobble * 26) * 0.025 * ho.wobble;
      if (!pinOut()) H.pin.position.x = Math.sin(ho.wobble * 31) * 0.03 * ho.wobble;
    }
  };

  // no pass, no cab: the City-Shaft's cabs say who writes the passes, and the first refusal starts his errand
  Taxi.refusal = ({ how }) => PASS_REFUSAL[how] ?? PASS_REFUSAL.hail;
  Taxi.onRefuse = () => { if (!quests.isStarted('incal.pass')) quests.start('incal.pass'); };
  for (const id of ['lio', 'hask']) { const n = npcs.find((x) => x.def?.id === id); if (n) quests.locate(id, () => n.pos); }

  // the cabs don't stop in the depths; after Wren, hailing down there brings Wren
  const refuse = () => {
    const now = performance.now?.() ?? 0;
    if (now - st.refuseT < 6000) return;
    st.refuseT = now;
    toast(game.flag('incal.lamp.lit') ? 'The cab slows, looks at the smog, and flies on. Wren is the one who stops down here.' : 'The cab slows, looks at the smog and the laundry, and flies on. Cabs don’t stop down here.');
  };
  const cabHail = cab.hail.bind(cab);
  for (const v of level.vehicles) {
    if (v.kind !== 'taxi') continue;
    const own = v.hail.bind(v), ownRefuses = v.refuses?.bind(v);
    // (in the depths, once you know Wren, a whistle is for Wren: it comes, pass or none)
    if (ownRefuses) v.refuses = (who, how) => (how === 'hail' && who?.pos && who.pos.y <= DEPTHS && game.flag('incal.wren.met') ? false : ownRefuses(who, how));
    v.hail = (p, h) => {
      if (p.y > DEPTHS) return own(p, h);
      if (game.flag('incal.wren.met')) return cabHail(p, h);
      refuse();
    };
  }

  // ---------------------------------------------------------------- the light, given back
  const incalPos = () => V(rig.pos.x, rig.pos.y, rig.pos.z);
  quests.locate('crown', () => P.palace.crown);
  quests.locate('incal', incalPos);
  const onPalace = (p) => Math.hypot(p.x, p.z) < 60 && p.y > PY - 3 && p.y < PY + 60;
  const lowerLights = [];
  {
    // warm lamps along the lower terraces' promenades (only the nearest few reach the shader)
    for (const t of S.terraces) {
      if (t.y > -80 || lowerLights.some((l) => l.ty === t.y)) continue;
      for (let k = 0; k < 6; k++) {
        const a = t.a0 + (k + 0.5) / 6 * (t.a1 - t.a0), r = t.r0 + 8;
        lowerLights.push({ ty: t.y, at: new THREE.Vector4(Math.cos(a) * r, t.y + 4, Math.sin(a) * r, 26), v: new THREE.Vector4(0, -1e5, 0, 0) });
      }
    }
    for (const l of lowerLights) level.lights.push(l.v);
  }
  // what the story's people say in passing follows the story
  const say = () => {
    if (lit()) {
      people.nima.lines = ['~happy~ Once a day.', '~playful~ Did you look up today?', '~happy~ The steps went gold.'];
      people.ossa.lines = ['~solemn~ Eyes open, face up.', '~surprised~ It came all the way down.', '~happy~ It doesn’t sting.'];
      people.dov.lines = ['~playful~ I looked. On duty.', '~happy~ Worth it.', '~playful~ Eyes on the visitors. Mostly.'];
      people.pip.lines = ['~shout~ I SAW IT!', '~happy~ Twelve seconds! More!', '~surprised~ It’s still there!'];
    } else if (quests.has('splinter')) people.ossa.lines = ['~solemn~ Up, all the way up.', '~neutral~ Hold it higher.'];
  };
  say();
  game.on('flag', ({ name }) => { if (name.startsWith('incal.')) say(); });
  const zoneOf = (p) => p.spot?.id ?? (p.pos.y >= S.TOP - 1 ? 'rim' : p.pos.y >= S.LEVELS[1] - 1 ? 'upper' : p.pos.y >= S.LEVELS[4] - 1 ? 'middle' : 'lower');
  // the billboards on the shaft wall stop selling: LOOK UP, on every one (one mesh, shown once it burns)
  const lookUp = (() => {
    const parts = S.billboards.map((b, i) => textGeometry(i % 3 === 2 ? 'ONCE\nA DAY' : 'LOOK\nUP', { width: b.w * (i % 3 === 2 ? 0.62 : 0.42), depth: 0.06 })
      .applyMatrix4(new THREE.Matrix4().compose(b.pos.clone().add(V(0, 0, 0).set(0, 0, 0.47).applyQuaternion(b.quat)), b.quat, V(1, 1, 1))));
    const m = new THREE.Mesh(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#fff8e8', flat: true, glow: 0.9, key: 'incal.lookUp' }));
    m.userData.noCollide = true; m.visible = false;
    scene.add(m);
    return m;
  })();
  const applyLit = (instant) => {
    lookUp.visible = true;
    if (crowd) for (const p of crowd.people) { const z = zoneOf(p); p.lines = LINES.lit[z] ?? p.lines; }
    for (const l of lowerLights) l.v.copy(l.at);
    sound.setBandMode?.('shrine', 'feast');
    splinter.visible = false;
    if (instant) { st.k = 1; rig.k = 1; }
  };
  if (lit()) applyLit(true);
  // the moment, framed: from out beside the palace, low, looking up past the dome to the light
  // (the follow camera can't look that steeply up); blends in, holds through the flare, blends out
  const startCine = () => {
    // from out on the +x side, low beside the dome: the crown below, the light above, open sky beyond
    // (the megastructure hangs over the −x side)
    st.cine = { t: 0, dur: 11, eye: V(100, PY + 4, 34), look: V(0, PY + 80, 0) };
  };
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = V(0, 0, 0);
  const frameCamera = (camera) => {
    const c = st.cine;
    if (!c) return;
    const w = THREE.MathUtils.smootherstep(c.t, 0, 1.6) * (1 - THREE.MathUtils.smootherstep(c.t, c.dur - 1.8, c.dur));
    if (w <= 0) return;
    _e.copy(c.eye).addScaledVector(UP, c.t * 0.5);   // a slow rise
    camera.position.lerp(_e, w);
    _m.lookAt(camera.position, c.look, UP);
    _q.setFromRotationMatrix(_m);
    camera.quaternion.slerp(_q, w);
    camera.updateMatrixWorld();
  };
  const giveBack = (camera) => {
    if (st.release || lit()) return;
    st.release = { t: 0, from: splinter.position.clone() };
    sound.whoosh?.();
    // filmed the first time (src/story/incal-moments.js: the toasts wait for its end); else the old framing
    if (film.lodestar()) return;
    startCine();
    toast('The splinter slips out of your hand and climbs, singing, toward the light.');
  };
  // (while the moment plays, what is said waits for its end: told(), said by its onEnd)
  const told = (text) => { if (st.filming) (st.toldLater ??= []).push(text); else toast(text); };
  /** The splinter home: the light burns (at the end of its climb; at once if the moment is skipped). */
  const land = () => {
    if (!st.release) return;
    st.release = null; splinter.visible = false;
    arrive();
  };
  const arrive = () => {
    quests.take('splinter');
    if (quests.stage(Q) === 'palace') quests.set(Q, 'look');   // straight past the guard: fine
    game.set('incal.lit', true);
    rig.flare = 1.4;
    sound.chime?.();
    applyLit(false);
    // every level looks up with you, for a while; the people near you say so
    if (crowd) {
      crowd.lookAt?.(incalPos(), 28);
      const near = crowd.people.filter((p) => p.pos.distanceToSquared(player.pos) < 60 * 60).slice(0, 8);
      near.forEach((p, i) => { p.say = LINES.shout[i % LINES.shout.length]; p.shoutUntil = crowd.time + 3 + i * 0.4; });
      if (near[0]) crowd.shout = near[0];
    }
    for (const n of Object.values(people)) if (n) n.shout = { text: n === people.dov ? '~solemn~ …' : '~shout~ Look!', until: n.time + 3 };
    told('The Lodestar flares. Light pours down the shaft, level after level, all the way to the bottom.');
  };
  const film = setupIncalMoments(ctx, { st, rig, splinter, incalPos, land, told, P, S });
  // sending messages home: once it burns, the HUD objective is to tell Nima (quest stage 'tell')

  // ---------------------------------------------------------------- the main quest's end
  quests.def(Q).onDone = () => {
    game.set('world.incal.done', true);
    game.addKeepsake({ id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day. Wherever you are, whatever is up there.” Nima, who sweeps the high terrace.' });
    setTimeout(() => story.complete?.(), 1200);
  };
  quests.locate('palaceGate', () => P.palace.gate);

  // ---------------------------------------------------------------- music: the shrine's hum
  sound.setBands?.([
    { id: 'shrine', pos: P.shrine, radius: 70, parts: ['chant', 'bell'], mode: lit() ? 'feast' : 'play', vol: 0.6, duck: 0.4 },
  ]);

  // ---------------------------------------------------------------- per frame
  const look = V(0, 0, 0);
  const update = (dt, t, { camera }) => {
    const pp = player.pos;
    // the light: eases toward its state; a flare fades
    st.k += ((lit() ? 1 : 0) - st.k) * (1 - Math.exp(-dt / 2.2));
    rig.k = st.k;
    rig.flare = Math.max(0, (rig.flare ?? 0) - dt * 0.35);
    if (st.cine && (st.cine.t += dt) > st.cine.dur) st.cine = null;

    // the splinter: in the bowl, at your shoulder, or on its way home
    if (st.release) {
      const r = st.release, k = Math.min(1, (r.t += dt) / 3.6), e = THREE.MathUtils.smootherstep(k, 0, 1);
      const to = incalPos();
      splinter.position.lerpVectors(r.from, to, e);
      splinter.position.x += Math.sin(k * Math.PI) * 6; splinter.position.y += Math.sin(k * Math.PI) * 10;
      splinter.scale.setScalar(1 + e * 6);
      splMat.uniforms.uGlow.value = 1;
      if (k >= 1) land();
    } else if (quests.has('splinter')) {
      splinter.visible = true;
      const f = player.frame?.dir ? player.frame.dir(player.heading, _d) : _d.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      look.copy(pp).addScaledVector(UP, 1.9 + Math.sin(t * 2.1) * 0.08).add(_v.set(-f.z * 0.55, 0, f.x * 0.55)).addScaledVector(f, -0.2);
      splinter.position.lerp(look, 1 - Math.exp(-dt * 10));
      splinter.rotation.y = t * 1.6;
      // the people of the middle and the bottom notice what you carry
      if (crowd && pp.y < S.LEVELS[2] && (st.carryT -= dt) <= 0) {
        st.carryT = 0.8;
        for (const p of crowd.people) {
          if (p.pos.distanceToSquared(pp) > 14 * 14 || Math.abs(p.pos.y - pp.y) > 3) continue;
          p.lookUntil = crowd.time + 2.5;
          if (p.shoutUntil < crowd.time - 6 && Math.random() < 0.05) { p.say = LINES.carrying[Math.floor(Math.random() * LINES.carrying.length)]; p.shoutUntil = crowd.time + 2.6; crowd.shout = p; }
        }
      }
    } else if (!lit() && !game.flag('incal.splinter.given')) {
      // in the bowl (drawn only when you're down there)
      splinter.visible = !camera || camera.position.distanceToSquared(P.bowlTop) < 160 * 160;
      splinter.position.copy(P.bowlTop); splinter.position.y += Math.sin(t * 1.7) * 0.04;
      splinter.rotation.y = t * 0.5;
    }

    // look up at the light from the palace with the splinter: it goes home
    if ((quests.stage(Q) === 'look' || quests.stage(Q) === 'palace') && quests.has('splinter') && !st.release && camera && onPalace(pp)) {
      camera.getWorldDirection(_d);
      const to = _v.copy(incalPos()).sub(camera.position).normalize();
      const up = _d.y > 0.4 || _d.dot(to) > 0.9;
      st.lookT = up ? st.lookT + dt : Math.max(0, st.lookT - dt * 2);
      if (st.lookT > 1.0) giveBack(camera);
      if (!st.hinted && quests.stage(Q) === 'look') { st.hinted = true; toast('The splinter tugs upward. Look up at the light (move the camera up).'); }
    }

    updateHoist(dt, pp);
    halfway?.update(dt, t, pp);

    // the call-lamp: lit, it sways a little and throws light; a push only rattles it
    st.lampK += ((game.flag('incal.lamp.lit') ? 1 : 0) - st.lampK) * (1 - Math.exp(-dt * 3));
    if (flat(pp, P.lamp) < 300) {
      lampHead.mat.uniforms.uColor.value.set('#5d574b').lerp(_c.set('#ffd27a'), st.lampK);
      lampHead.mat.uniforms.uGlow.value = st.lampK * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.3));
      lampHead.signMat.uniforms.uGlow.value = st.lampK * 0.8;
      lampHead.mesh.getWorldPosition(lampWorld);
      if (st.lampK > 0.05) lampLight.set(lampWorld.x, lampWorld.y, lampWorld.z, 14 * st.lampK); else lampLight.set(0, -1e5, 0, 0);
      if (st.lampWobble > 0) { st.lampWobble = Math.max(0, st.lampWobble - dt * 2); lampHead.mesh.position.y = 4.1 + Math.sin(st.lampWobble * 30) * 0.05 * st.lampWobble; }
    }
  };
  const _c = new THREE.Color();

  return {
    people, update, state: st, cab, frameCamera, halfway, film,
    giveBack, lightLamp, hoist: { state: ho, rig: H, knockPin, turnHoist, takeTin, pinOut, swungIn },
    /** E on a crowd person: a short conversation, by where they live (and whether the light is back). */
    crowdTalk(p) {
      const z = zoneOf(p);
      const shone = lit() && (z === 'lower' || z === 'middle' || p.seed < 0.35), list = shone ? CROWD_TALK.lit : CROWD_TALK[z];
      if (!list) return null;
      const k = Math.floor(p.seed * 997) % list.length, base = list[k];
      // a voice of their own (src/story/voice.js voiceOf hashes the seed); `heard`: where the lines they've said are kept (dialogue.js pickListen)
      return { id: `crowd.incal.${z}`, heard: `crowd.incal.${shone ? 'lit' : z}.${k}`, color: p.style?.cloak ?? '#d8a24a', kind: p.kind, seed: `crowd:${p.id}`, scale: p.size, ...base };
    },
  };
}
