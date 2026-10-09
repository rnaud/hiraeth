import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { registerTarget } from '../targets.js';
import { registerItemModel } from '../boxes/model.js';
import { gameMarkerModel, signPlate } from '../minigames/kit/marker.js';
import { standAt } from '../minigames/kit/onfoot.js';
import { formatTime, bestScore } from '../minigames/kit/scores.js';
import { PURSE } from '../chimes.js';
import { ITEMS } from '../items.js';
import { Resources } from '../resources.js';
import { TRIALS } from './data.js';
import { CourseRun, lacks, inMode, parTime, MODES } from './course.js';
import { gatePoints, startPoint } from './check.js';
import { WindColumn } from './winds.js';
import { keyText } from '../prompt-keys.js';
import { kitTrialsFor } from './kit-data.js';
import { buildKitCourse } from './kit-courses.js';
import { KitRun, outOfRun, voiceLine } from './kit-run.js';
import { stripTone } from '../story/tone.js';

// The mastery trials in the worlds (docs/systems/minigames.md, "Trials in the worlds"): one optional run in
// each route world, built from what that world gives you (the hoverbike, the wings and the wind, the bird,
// the skiff, the jets, the gun), started from a makers' sign standing in the world. The interact button at
// the sign opens the minigames' start card (src/minigames/kit/runner.js, played on foot: drives false):
// Start puts you at the line (on your mount, if the run wants one), 3, 2, 1, GO, the clock runs through
// the gates, and the results card keeps the best in the save (minigame.trial-<world>.best). The first finish
// gives the trial's reward (an upgrade to a gadget, src/items.js `trial`; src/trials/upgrades.js does it).
// Quit leaves you where the run left you, in the world: nothing reloads.
//
//   const trials = createTrials({ levelId, scene, physics, level, player, items, game, foes, notice, surfaceAt, open })
//   trials.update(dt, t)    per frame (the wind columns, the sign's lamp)
//   open(def) → bool        main.js: a MinigameRunner for the trial's game definition, in this world

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** What each way of running a trial tells on the start card (Xbox / PlayStation form). */
const CONTROLS = {
  bike: { pad: [['Left stick', 'steer'], ['RT / R2', 'throttle'], ['A / ×', 'hop']], keys: [['W A S D', 'ride'], ['Space', 'hop']] },
  skiff: { pad: [['Left stick', 'steer'], ['RT / R2', 'throttle'], ['Y / △', 'the gust fan, into the sail']], keys: [['W A S D', 'steer'], ['T', 'the gust fan, into the sail']] },
  bird: { pad: [['Left stick', 'fly'], ['A / ×', 'beat the wings']], keys: [['W A S D', 'fly'], ['Space', 'beat the wings']] },
  glider: { pad: [['A / ×', 'jump, then hold to open the wings'], ['Left stick', 'steer; back to float']], keys: [['Space', 'jump, then hold to glide'], ['W A S D', 'steer; S to float']] },
  jets: { pad: [['RT / R2', 'thrust'], ['Left stick', 'fly the nose']], keys: [['Space held', 'thrust'], ['W A S D', 'fly the nose']] },
  foot: { pad: [['Left stick', 'run'], ['A / ×', 'jump']], keys: [['W A S D', 'run'], ['Space', 'jump']] },
  eyes: { pad: [['LT / L2', 'aim'], ['RT / R2', 'splash']], keys: [['Right mouse', 'aim'], ['Left mouse', 'splash']] },
  kitwings: { pad: [['Left stick', 'walk; L3 to run'], ['A / ×', 'jump, then hold to open the wings'], ['Left stick', 'steer the wings; back to float']], keys: [['W A S D', 'walk; Shift to run'], ['Space', 'jump, then hold to glide'], ['W A S D', 'steer the wings; S to float']] },
  kit: { pad: [['Left stick', 'walk; L3 to run'], ['A / ×', 'jump'], ['LT / L2', 'aim'], ['RT / R2', 'splash'], ['D-pad ↑ while aiming', 'the gun’s mode']], keys: [['W A S D', 'walk; Shift to run'], ['Space', 'jump'], ['Right mouse', 'aim'], ['Left mouse', 'splash'], ['X', 'the gun’s mode']] },
  // (the echo relay: the stones splashed, the shell played back: src/echo-shell.js, the whistle's button)
  // (the bell crossing: the bell-note whistle on the same button, src/boxes/effects.js ring())
  kitbell: { pad: [['Left stick', 'walk; L3 to run'], ['A / ×', 'jump'], ['Y / △', 'sound the bell (no gadget in hand)']], keys: [['W A S D', 'walk; Shift to run'], ['Space', 'jump'], ['V', 'sound the bell']] },
  kitecho: { pad: [['Left stick', 'walk; L3 to run'], ['LT / L2', 'aim'], ['RT / R2', 'splash a stone'], ['Y / △', 'play the shell back (no gadget in hand)']], keys: [['W A S D', 'walk; Shift to run'], ['Right mouse', 'aim'], ['Left mouse', 'splash a stone'], ['V', 'play the shell back']] },
};

const COUNT = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };

let mats = null;
const trialMats = (color) => {
  mats ??= { ink: makeMaterial({ color: '#2b211f', flat: true }), paper: makeMaterial({ color: '#f3e7cc', flat: true }), post: makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66' }), eyeOff: makeMaterial({ color: '#6f6658', flat: true }) };
  mats[color] ??= makeMaterial({ color, flat: true, glow: 0.9 });
  return { ...mats, glow: mats[color] };
};

// the Signal Market's reward is a ribbon, not an upgrade to a gadget: its own little model
registerItemModel('racersribbon', () => {
  const g = new THREE.Group();
  const M = (c) => makeMaterial({ color: c, flat: true });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16).rotateX(Math.PI / 2), M('#ff5fa2')));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12).rotateX(Math.PI / 2), M('#f2c54b')));
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.01), M('#71d7cf')); t.position.set(s * 0.04, -0.12, 0); t.rotation.z = s * 0.25; g.add(t); }
  return g;
});

/** A gate: an inked ring facing along the way to it, a glowing band inside, a pale beam over it while it is the next. */
function gateMesh(g, from, M) {
  const grp = new THREE.Group();
  grp.position.set(g.x, g.y, g.z);
  const dir = V(g.x - from.x, 0, g.z - from.z);
  if (dir.lengthSq() > 1e-6) grp.rotation.y = Math.atan2(dir.x, dir.z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(g.r, Math.max(0.12, g.r * 0.03), 6, 40), M.ink);
  const band = new THREE.Mesh(new THREE.TorusGeometry(g.r * 0.93, Math.max(0.08, g.r * 0.018), 4, 40), M.glow);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 60, 6).translate(0, g.r + 30, 0), M.glow);
  grp.add(ring, band, beam);
  grp.userData.band = band; grp.userData.beam = beam;
  grp.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  return grp;
}

/** An eye on a post: asleep (dark) until a splash wakes it. */
function eyeMesh(at, M) {
  const g = new THREE.Group(); g.position.copy(at);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.9, 8).translate(0, 0.95, 0), M.post));
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10).translate(0, 2.2, 0), M.paper);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8).translate(0, 2.2, 0.28), M.eyeOff);
  g.add(lid, eye);
  g.userData.eye = eye;
  g.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  return g;
}

/** The trial as a minigame definition (src/minigames/kit/runner.js reads it), run in this world. */
export function trialGame(T, world) {
  const C = CONTROLS[T.controls ?? T.mode] ?? CONTROLS.foot;
  const reward = ITEMS[T.reward];
  return {
    id: T.id, name: T.name, color: T.color, trial: true,
    blurb: T.blurb,
    rules: `${T.rules}${reward ? ` The first finish: ${reward.name}.` : ''}${world.par ? ` The makers’ mark: ${formatTime(world.par)}.` : ''}`,
    controls: { pad: C.pad, keys: C.keys, touch: C.pad },
    score: { kind: 'time' },
    drives: false,
    start: (ctx) => world.session(ctx),
  };
}

/** This world's vehicle trial alone (the tests' way in; main.js makes them all with createChallenges). */
export function createTrials(args) {
  const T = (args.trials ?? TRIALS)[args.levelId];
  if (!T || !args.physics) return { trial: null, update() {}, dispose() {} };
  return makeTrial(T, args);
}

/**
 * Every challenge standing in this world (docs/systems/challenges.md): its trial (src/trials/data.js) and its
 * makers' runs (src/trials/kit-data.js), each with its sign. { list, byId(id), running, update(dt, t), dispose() }.
 */
export function createChallenges(args) {
  const { levelId, physics } = args;
  const kits = args.kits ? args.kits.filter((T) => T.world === levelId) : kitTrialsFor(levelId);
  const defs = physics ? [(args.trials ?? TRIALS)[levelId], ...kits].filter(Boolean) : [];
  const list = defs.map((T) => makeTrial(T, args));
  return {
    list,
    byId: (id) => list.find((w) => w.trial.id === id) ?? null,
    get running() { return list.find((w) => w.running) ?? null; },
    update(dt, t) { for (const w of list) w.update(dt, t); },
    dispose() { for (const w of list) w.dispose(); },
  };
}

/** One challenge in the world: its sign, its course, its runs. */
/** A makers' run's first finish: its purse (src/chimes.js PURSE.run) into the wallet, and the card's line. */
export function firstPurse(game, items) {
  const got = new Resources(game, items ?? undefined).addChimes(PURSE.run, { source: 'run' });
  return got ? `First finish: ${got} chimes.` : 'First finish.';
}

export function makeTrial(T, { levelId, scene, physics, player, items, game, foes = null, notice = () => {}, surfaceAt = null, open = () => false, npcs = null, sound = null }) {
  const kitRun = T.mode === 'kit';
  const M = trialMats(T.color);
  const offs = [];
  // a makers' run: the temple pieces stood in the open, for good (src/trials/kit-courses.js)
  const course = kitRun ? buildKitCourse(T, { scene, physics, player, notice, sound, game }) : null;
  // its moving floors (a ball, a plate) are the traveller's to stand on and be stopped by, as a temple's are
  if (course?.solids().length && player?.opts) {
    const was = player.opts.dynamic;
    player.opts.dynamic = () => { const base = was ? was() : []; return base.length ? [...base, ...course.solids()] : course.solids(); };
    if (!was) player._feetGround = undefined;   // (src/player.js: it keeps the ground it stands on, once asked)
    offs.push(() => { player.opts.dynamic = was; });
  }
  // the wind columns are the world's for good, run or no run (the foes feel them too)
  const winds = (T.winds ?? []).map(([x, z, r, h, lift]) => new WindColumn(scene, { foot: V(x, physics.groundAt(x, 1e4, z, 2e4), z), r, h, lift }));
  const gates = course ? course.gates : T.gates ? gatePoints(T, { physics, surfaceAt }) : [];
  const start = course ? course.start : startPoint(T, { physics, surfaceAt });
  const eyesAt = (T.eyes ?? []).map(([x, z]) => V(x, physics.groundAt(x, 1e4, z, 2e4), z));
  const par = T.par ?? (T.eyes ? Math.ceil(eyesAt.reduce((d, p, i) => d + p.distanceTo(i ? eyesAt[i - 1] : start), 0) / T.speed * 1.4 + 10) : parTime(gates, start, T.speed));
  const doneKey = kitRun ? `trial.${T.id}.done` : `trial.${levelId}.done`;
  // the sign: a makers' post with the run's colour, a step from the line
  let mPos;
  if (course) mPos = course.markerAt.clone();
  else {
    const [mx, my, mz] = T.marker.length === 3 ? T.marker : [T.marker[0], null, T.marker[1]];
    mPos = V(mx, my ?? physics.groundAt(mx, 1e4, mz, 2e4), mz);
  }
  const sign = gameMarkerModel(T.color);
  sign.position.copy(mPos);
  sign.rotation.y = Math.atan2(start.x - mPos.x, start.z - mPos.z) + Math.PI;
  sign.traverse((o) => { o.userData.noCollide = true; });
  scene?.add(sign);
  const world = {
    trial: T, gates, start, par, sign, winds, course, running: null,
    game: null,
    /** What the traveller lacks for it now ('' if nothing). */
    lacks: () => lacks(T, { has: (id) => new Resources(game, items).meets(id), mount: player?.mount ?? null }),   // ('magic:4': src/resources.js)
    best: () => bestScore(game, { id: T.id }),
    done: () => !!game.flag(doneKey),
    /** The interact button at the sign. */
    try() {
      const why = world.lacks();
      if (why) { notice(`${T.name}: ${why} Come back with it.`); return false; }
      return open(world.game);
    },
    session: (ctx) => (kitRun ? kitSession(ctx) : session(ctx)),
    /** A makers' run's plate on its sign: its name, and your best (or the makers' mark, before you have one). */
    plate() {
      const best = world.best();
      const old = sign.userData.plate;
      if (old) { old.material.map?.dispose?.(); old.geometry.dispose(); old.removeFromParent(); }
      const p = signPlate(T.name, best != null ? `best ${formatTime(best)}` : `mark ${formatTime(par)}`, T.color, 1.5, 0.5);
      sign.userData.plate = p;
      if (p) { p.position.set(0, 1.3, 0.24); sign.add(p); }
    },
    update(dt, t) {
      for (const w of winds) w.update(dt, t, player);
      course?.update(dt, t);
      const lamp = sign.userData.lamp;
      if (lamp) lamp.scale.setScalar(1 + 0.12 * Math.sin(t * 3));
    },
    dispose() { for (const w of winds) w.dispose(); course?.dispose(); sign.removeFromParent(); offs.forEach((f) => f()); },
  };
  world.game = trialGame(T, world);
  if (kitRun) world.plate();
  offs.push(registerInteractable({
    id: kitRun ? `trial.${T.id}` : `trial.${levelId}`, priority: PRIORITY.use, range: 3,
    prompt: `try the ${T.name.toLowerCase()}`,
    at: () => (world._at ??= mPos.clone().add(V(0, 1.6, 0))),
    enabled: () => !world.running && (!player?.riding || (!!MODES[T.mode]?.mount && player.ride === player.mount)),   // (a run on a mount: ride up to the sign)
    distance: (pl) => (Math.abs(pl.pos.y - mPos.y) < 2.5 ? Math.hypot(pl.pos.x - mPos.x, pl.pos.z - mPos.z) : Infinity),
    use: () => world.try(),
  }));

  /** One run (a minigame session): the line, the gates or the eyes, the clock, the reward. */
  function session(ctx) {
    const P = ctx.player;
    const run = new CourseRun(gates);
    const meshes = [], eyes = [];
    let prev = null, off = 0, gone = false;
    gates.forEach((g, i) => { const m = gateMesh(g, i ? gates[i - 1] : start, M); m.visible = false; ctx.add(m); meshes.push(m); });
    eyesAt.forEach((p) => {
      const m = eyeMesh(p, M); ctx.add(m);
      const e = { m, lit: false };
      e.off = registerTarget({ kind: 'switch', radius: 0.7, position: () => (e._c ??= p.clone().add(V(0, 2.2, 0))), enabled: () => !e.lit,
        onHit: () => { if (ctx.phase !== 'play' || e.lit) return false; e.lit = true; e.m.userData.eye.material = M.glow; ctx.sfx.coin(eyes.filter((x) => x.lit).length); return true; } });
      eyes.push(e);
    });
    const unCalm = calmWilds();
    world.running = run;
    const heading = T.heading ?? 0;
    const mount = MODES[T.mode]?.mount ? P.mount : null;
    const place = () => {
      if (mount) {
        if (P.ride !== mount) { if (P.ride) P.dismount(true); standAt(P, start, heading, ctx.rig, heading + Math.PI); }
        mount.pos.set(start.x, start.y + (mount.kind === 'bird' ? 2.2 : 0.6), start.z);
        mount.vel?.set(0, 0, 0); mount.heading = heading; if (mount.speed !== undefined) mount.speed = 0;
        if (mount.kind === 'bird') mount.landed = true;
        if (P.ride !== mount) P.mount_(mount);
      } else standAt(P, start, heading, ctx.rig, heading + Math.PI);
      if (ctx.rig) ctx.rig.yaw = heading + Math.PI;
    };
    place();
    const body = () => (P.ride ?? P).pos;
    const show = () => meshes.forEach((m, i) => {
      m.visible = i >= run.next && i <= run.next + 2;
      m.userData.beam.visible = i === run.next;
      m.userData.band.material = i === run.next ? M.glow : M.paper;
    });
    show();
    const finish = () => {
      const t = ctx.time;
      const first = !world.done();
      game.set(doneKey, true);
      const reward = T.reward && ITEMS[T.reward] && !items.has(T.reward) ? ITEMS[T.reward] : null;
      if (reward) items.grant(T.reward);
      const lines = [`The makers’ mark: ${formatTime(par)}${t <= par ? ' · beaten' : ''}`];
      if (first) lines.push(firstPurse(game, items));
      const html = reward ? `<div class="trial-reward"><p class="kicker">Yours: ${esc(reward.name)}</p><p>${esc(reward.text)}</p><p><b>${keyText(esc(reward.use), { html: true })}</b></p></div>` : '';
      ctx.finish({ lines, html });
      if (reward) notice(`${reward.name}: yours. ${reward.use}`);
    };
    return {
      update(dt, input, { live, phase }) {
        if (phase === 'count') { place(); prev = null; return; }
        if (!live) return;
        const p = body().clone();
        if (!(P.ride)) p.y += 1;   // (on foot, the middle of the body)
        if (T.eyes) {
          const n = eyes.filter((e) => e.lit).length;
          ctx.status(`eyes ${n} / ${eyes.length}`);
          if (n === eyes.length) finish();
        } else if (prev) {
          const r = run.step(prev, p, ctx.time);
          if (r === 'gate') { ctx.sfx.checkpoint(); show(); }
          if (r === 'finish') { show(); finish(); return; }
          ctx.status(`gate ${Math.min(run.next + 1, gates.length)} / ${gates.length}`);
        }
        prev = p;
        // out of the run: knocked out, or off the mount for a few seconds
        if (P.dead && !gone) { gone = true; ctx.finish({ failed: true, title: 'Knocked out' }); return; }
        off = inMode(T, P) ? 0 : off + dt;
        if (off > 3 && !gone) { gone = true; ctx.finish({ failed: true, title: mount?.kind === 'bird' ? 'Off the bird' : mount ? `Off the ${mount.kind === 'skiff' ? 'skiff' : 'bike'}` : 'Off the course' }); }
      },
      end() {
        for (const e of eyes) e.off?.();
        world.running = null;
        unCalm();
      },
    };
  }

  /** The wilds keep their distance while you run (a pack would only be in the way): the returned fn puts them back. */
  function calmWilds() {
    const restWas = foes?.packRest;
    if (foes) { for (const f of foes.list.slice()) if (!f.placed && !f.guard) foes.remove(f); foes.packRest = 1e9; }
    return () => { if (foes && restWas !== undefined) foes.packRest = Math.max(20, restWas === 1e9 ? 20 : restWas); };
  }

  /**
   * One makers' run (src/trials/kit-run.js): on foot (and on the wings) through the gates among the temple
   * pieces, then (the wind hall) the bank of eyes in one breath. It ends in the water (the Hush walk), down on
   * the plain (the feather leap), at a knockout, or up on the jets. The reward is a word from someone nearby (src/trials/kit-data.js `voice`) and the sign's plate.
   */
  function kitSession(ctx) {
    const P = ctx.player;
    const task = course.task;   // (what the gates lead to: the eyes to wake, the balls to roll home)
    const run = new KitRun({ gates, bank: task?.n ?? 0, words: task?.goal });
    const meshes = [];
    let prev = null, gone = false, off = 0;
    gates.forEach((g, i) => { const m = gateMesh(g, i ? gates[i - 1] : start, M); m.visible = false; ctx.add(m); meshes.push(m); });
    const unCalm = calmWilds();
    world.running = run;
    course.reset();
    course.listen(() => run.ready && ctx.phase === 'play');
    const place = () => {
      if (P.ride) P.dismount?.(true);
      standAt(P, start, course.heading, ctx.rig, course.heading + Math.PI);
      if (ctx.rig) ctx.rig.yaw = course.heading + Math.PI;
    };
    place();
    const show = () => meshes.forEach((m, i) => {
      m.visible = !run.ready && i >= run.next && i <= run.next + 2;
      m.userData.beam.visible = i === run.next;
      m.userData.band.material = i === run.next ? M.glow : M.paper;
    });
    show();
    const finish = () => {
      const t = ctx.time;
      const first = !world.done();
      const beatenBefore = !!game.flag(`trial.${T.id}.beaten`);
      const beaten = t <= par;
      game.set(doneKey, true);
      if (beaten) game.set(`trial.${T.id}.beaten`, true);
      const lines = [`The makers’ mark: ${formatTime(par)}${beaten ? ' · beaten' : ''}`];
      if (first) lines.push(firstPurse(game, items));
      // the quiet reward: whoever stands nearby has a word (on the card, and over their head if they are in view)
      const line = voiceLine(T.voice, { first, beaten, beatenBefore });
      let html = '';
      if (line) {
        html = `<div class="trial-reward"><p class="kicker">${esc(T.voice.name)}, ${esc(T.voice.from)}</p><p>“${esc(stripTone(line))}”</p></div>`;
        const who = (npcs ?? []).find((n) => n.def?.id === T.voice.who);
        if (who) who.shout = { text: line, until: (who.time ?? 0) + 6 };
      }
      ctx.finish({ lines, html });
      world.said = line;
      setTimeout(() => world.plate(), 0);   // (once the runner has kept the best)
    };
    return {
      update(dt, input, { live, phase }) {
        if (phase === 'count') { place(); prev = null; return; }
        if (!live || gone) return;
        const p = P.pos.clone(); p.y += 1;   // (the middle of the body)
        if (prev) {
          const r = run.step(prev, p, ctx.time);
          if (r === 'gate') { ctx.sfx.checkpoint(); show(); }
          if (r === 'ready') { ctx.sfx.checkpoint(); show(); ctx.flash(task.kind === 'eyes' ? `Now the eyes: all ${COUNT[task.n] ?? task.n} in one breath` : task.flash, 'big', 2.2); }
          if (r === 'finish') { gone = true; show(); finish(); return; }
        }
        if (run.ready && task && run.wake(task.count(), ctx.time) === 'finish') { gone = true; finish(); return; }
        ctx.status(run.goal());
        prev = p;
        // out of the run: knocked out, in the lake, down on the plain, up on the jets for more than a moment
        const fr = T.fall ? course.kit.local(P.pos) : null;
        const why = outOfRun(T, P, { passed: run.next, height: fr?.y ?? Infinity, along: fr?.z ?? Infinity });
        if (why) { gone = true; ctx.finish({ failed: true, title: why }); return; }
        // (a run with `noWings`: the wings opened end it at once, where a glide would carry you over its gaps)
        off = T.onFoot && P.jetFlight ? off + dt : T.noWings && P.gliding ? off + 6 * dt : 0;
        if (off > 1.5) { gone = true; ctx.finish({ failed: true, title: 'Off your feet', lines: [T.offFeet ?? 'This one is walked: no jets.'] }); }
      },
      end() {
        world.running = null;
        course.listen(null);
        unCalm();
      },
    };
  }
  return world;
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
