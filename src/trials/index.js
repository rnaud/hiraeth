import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { registerTarget } from '../targets.js';
import { registerItemModel } from '../boxes/model.js';
import { gameMarkerModel } from '../minigames/kit/marker.js';
import { standAt } from '../minigames/kit/onfoot.js';
import { formatTime, bestScore } from '../minigames/kit/scores.js';
import { ITEMS } from '../items.js';
import { TRIALS } from './data.js';
import { CourseRun, lacks, inMode, parTime, MODES } from './course.js';
import { gatePoints, startPoint } from './check.js';
import { WindColumn } from './winds.js';
import { keyText } from '../prompt-keys.js';

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
};

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
  const C = CONTROLS[T.mode] ?? CONTROLS.foot;
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

export function createTrials({ levelId, scene, physics, level, player, items, game, foes = null, notice = () => {}, surfaceAt = null, open = () => false, trials = TRIALS }) {
  const T = trials[levelId];
  if (!T || !physics) return { trial: null, update() {}, dispose() {} };
  const M = trialMats(T.color);
  const offs = [];
  // the wind columns are the world's for good, run or no run (the foes feel them too)
  const winds = (T.winds ?? []).map(([x, z, r, h, lift]) => new WindColumn(scene, { foot: V(x, physics.groundAt(x, 1e4, z, 2e4), z), r, h, lift }));
  const gates = T.gates ? gatePoints(T, { physics, surfaceAt }) : [];
  const start = startPoint(T, { physics, surfaceAt });
  const eyesAt = (T.eyes ?? []).map(([x, z]) => V(x, physics.groundAt(x, 1e4, z, 2e4), z));
  const par = T.eyes ? Math.ceil(eyesAt.reduce((d, p, i) => d + p.distanceTo(i ? eyesAt[i - 1] : start), 0) / T.speed * 1.4 + 10) : parTime(gates, start, T.speed);
  // the sign: a makers' post with the run's colour, a step from the line
  const [mx, my, mz] = T.marker.length === 3 ? T.marker : [T.marker[0], null, T.marker[1]];
  const mPos = V(mx, my ?? physics.groundAt(mx, 1e4, mz, 2e4), mz);
  const sign = gameMarkerModel(T.color);
  sign.position.copy(mPos);
  sign.rotation.y = Math.atan2(start.x - mPos.x, start.z - mPos.z) + Math.PI;
  sign.traverse((o) => { o.userData.noCollide = true; });
  scene?.add(sign);
  const world = {
    trial: T, gates, start, par, sign, winds, running: null,
    game: null,
    /** What the traveller lacks for it now ('' if nothing). */
    lacks: () => lacks(T, { has: (id) => items.has(id), mount: player?.mount ?? null }),
    best: () => bestScore(game, { id: T.id }),
    done: () => !!game.flag(`trial.${levelId}.done`),
    /** The interact button at the sign. */
    try() {
      const why = world.lacks();
      if (why) { notice(`${T.name}: ${why} Come back with it.`); return false; }
      return open(world.game);
    },
    session: (ctx) => session(ctx),
    update(dt, t) {
      for (const w of winds) w.update(dt, t, player);
      const lamp = sign.userData.lamp;
      if (lamp) lamp.scale.setScalar(1 + 0.12 * Math.sin(t * 3));
    },
    dispose() { for (const w of winds) w.dispose(); sign.removeFromParent(); offs.forEach((f) => f()); },
  };
  world.game = trialGame(T, world);
  offs.push(registerInteractable({
    id: `trial.${levelId}`, priority: PRIORITY.use, range: 3,
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
    // the wilds keep their distance while you run (a pack would only be in the way)
    const restWas = foes?.packRest;
    if (foes) { for (const f of foes.list.slice()) if (!f.placed && !f.guard) foes.remove(f); foes.packRest = 1e9; }
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
      game.set(`trial.${levelId}.done`, true);
      const reward = T.reward && ITEMS[T.reward] && !items.has(T.reward) ? ITEMS[T.reward] : null;
      if (reward) items.grant(T.reward);
      const lines = [`The makers’ mark: ${formatTime(par)}${t <= par ? ' · beaten' : ''}`];
      if (first) lines.push('First finish.');
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
        if (foes && restWas !== undefined) foes.packRest = Math.max(20, restWas === 1e9 ? 20 : restWas);
      },
    };
  }
  return world;
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
