// The foes and the fight in the engines (issue #264), as main.js wires them on the page: the ink blots in the wilds and
// the makers' machines in the temples (src/foes.js Foes, the Enemies setting), the lock-on (R3 / Tab) and its camera
// (lockFollow, a guardian framed whole with you: lock-frame.js guardianBox, the boss framing its fight asks for), the
// hops' perfect dodge and its flurry (src/flurry.js), the drops (chimes and potions: src/chimes.js, potion-drops.js), the
// potion (D-pad ←), the hazards' burns (src/hazards.js), the low-health cue (src/low-health.js), the knock-out's restart,
// and what the page draws over the picture for them, as the screen's state for the engine's HUD (src/platform.js screen; BridgeHud.cs):
//   'lock'    the reticle's four arrows (src/lock-reticle.js, its view: px of the stand-in window, W × H)
//   'warn'    the markers of foes winding up out of sight (Foes.warnings' warnView: x, y -1..1)
//   'edges'   the low-health edges, the flurry's vignette, a moth's white flash (0..1 each)
//   'restart' the knock-out's card ("You were knocked out", A / × to get up)
// The guardians are the temples' own (src/temples/runtime.js, updated by the story): this adds the lock and its camera.
//
//   const combat = makeCombat({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, rig, lib, humans, waters, screen, toast, teach });
//   combat.update(dt, realDt, { busy, paused })   after the traveller and the rig, before the frame is drawn
//   combat.camera(realDt, busy)                   the lock's camera, after the rig
//   combat.key(code) / combat.action(name)        Tab, R3, D-pad ←, the restart's confirm
import * as THREE from 'three';
import { Foes, lockFollow, LOCK_NEAR } from '../src/foes.js';
import { guardianBox } from '../src/lock-frame.js';
import { hopAxis } from '../src/jump.js';
import { lockAim } from '../src/fluid-tool.js';
import { AimNudge, AIM_NUDGE, lockAimStep } from '../src/lock-aim.js';
import { ChimeField, ChimeView, dropPolicy, connectDrops } from '../src/chimes.js';
import { PotionDrops } from '../src/potion-drops.js';
import { LowHealthCue } from '../src/low-health.js';
import { resources, POTION } from '../src/resources.js';
import { kick, flurry, endFlurry, flurryLeft, flurryK } from '../src/feel.js';
import { FLURRY, nextFlurry } from '../src/flurry.js';
import { game as sharedGame } from '../src/game-state.js';
import { rumblePlay } from '../src/rumble.js';
import { updateHazards } from '../src/hazards.js';
import { hintsFor } from '../src/hint-level.js';
import { keyText } from '../src/prompt-keys.js';
import { t as tr } from '../src/i18n.js';

const r2 = (v) => Math.round(v * 100) / 100;

export function makeCombat({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, rig, lib, humans, waters, screen, toast = () => {}, teach = toast, game = sharedGame }) {
  const foes = new Foes({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, lib, humans, waters, notice: teach });
  // chimes, the currency: a foe cut down scatters a few, a guardian a purse once; walked over or drawn in, into the wallet
  const chimePolicy = dropPolicy(level);
  const chimes = new ChimeField({
    groundAt: (x, y, z) => physics.groundAt(x, y + 2, z, 8),
    onTake: (p) => { resources.addChimes(p.value, { source: 'pickup', training: p.training }); sound?.chimePickup?.(p.value); rumblePlay('chime'); C.shown = 3; },
  });
  const chimeView = new ChimeView(scene);
  const purseAt = (pos) => {
    const P = player.pos, at = P.clone();
    if (pos) { const dx = pos.x - P.x, dz = pos.z - P.z, d = Math.hypot(dx, dz); if (d > 0.1) at.set(P.x + (dx / d) * Math.min(3.4, d), P.y, P.z + (dz / d) * Math.min(3.4, d)); }
    return at;
  };
  const offs = [connectDrops(game, chimes, { policy: chimePolicy, purseAt, sound })];
  const potionDrops = new PotionDrops(scene, {
    groundAt: (x, y, z) => physics.groundAt(x, y + 2, z, 8),
    onTake: () => { if (resources.addPotions(1)) { sound?.potionPickup?.(); C.shown = 3; toast(tr('potion.found')); rumblePlay('chime'); } },
  });
  if (chimePolicy !== 'off') offs.push(game.on('foe:burst', (e) => { const pot = resources.potions; potionDrops.maybe(e, { hearts: player.hearts, max: player.maxHearts, potions: pot.count, cap: POTION.cap, infinite: pot.infinite }); }));
  const lowHealth = new LowHealthCue({ sound, parent: null });
  if (tool) tool.lockOn = () => foes.lockTarget();
  // the perfect dodge's flurry (a hop begun just before a blow lands: the world slowed round you a few seconds)
  let flurryAgainAt = 0, flurryChain = null;
  function startFlurry() {
    const now = performance.now() / 1000;
    if (flurryLeft() > 0 || now < flurryAgainAt) return;
    const F = flurryChain = nextFlurry(flurryChain, now);
    flurry(F.time, FLURRY.rate, FLURRY.ease);
    flurryAgainAt = F.nextAt;
    sound?.flurry?.(true); kick(0.1); rumblePlay('flurry');
    if (!game.flag('hint.flurry') && hintsFor('tip')) { game.set('hint.flurry', true); teach(tr('hint.flurry')); }
  }
  player.onHop = (kind, win) => { tool?.blade?.hop(win); if (foes.perfectDodge()) startFlurry(); };
  if (tool?.blade) tool.blade.onHopDodge = () => startFlurry();
  player.untouchable = () => flurryLeft() > 0;
  // the lock's camera (main.js renderFrame): its swing off the line, a guardian's box, the aim on its point
  const lockView = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 };
  const lockBox = { min: new THREE.Vector3(), max: new THREE.Vector3() };
  const aimNudge = new AimNudge();
  const _hopView = new THREE.Vector3();
  let padLook = () => null;
  const aimingLocked = (busy) => !!(foes.lock && !busy && tool && tool.camK > 0.2 && tool.k > 0.2);
  // locked on, the look's sideways motion is the lock's: a quick flick switches to the next foe that way; aiming locked
  // on it shifts the aim off the lock's point instead, within its cone (src/lock-aim.js)
  const look = rig.look.bind(rig);
  let busyNow = false;
  rig.look = (dx, dy) => {
    if (aimingLocked(busyNow)) { const s = padLook(); if (!(s?.x || s?.y)) aimNudge.push(dx, dy, rig.sensitivity); return; }
    if (foes.lock && !busyNow && foes.flickLook(dx)) dx = 0;
    look(dx, dy);
  };
  // the knock-out (main.js updateRestart): after 1.4 s down for good, the card; A / ×, Enter, Space or E gets him up
  let deadFor = 0, knockedOut = null, restartOpen = false;
  const C = {
    foes, chimes, potionDrops, lowHealth, lockView, shown: 0,
    /** The right stick's tilt (aiming locked on, it shifts the aim: src/lock-aim.js). */
    set padLook(fn) { padLook = fn; },
    get restartOpen() { return restartOpen; },
    knockout(why) { knockedOut = why; },
    /** R3 / Tab: lock on to a foe, then the next, then let go; false: none in reach (the scout's ping then, as main.js). */
    lock() {
      const had = foes.lock;
      const got = foes.cycleLock();
      if (foes.lock && !had && !game.flag('hint.hop.taught') && hintsFor('teach')) { game.set('hint.hop.taught', true); teach(keyText(tr('hint.hop'), { teach: true })); }
      return !!got || !!had;
    },
    /** D-pad ←: a healing potion (main.js drinkPotion). */
    drink() {
      const why = player.cantDrink?.();
      if (why === 'full') { sound?.potion?.('no'); toast(tr('potion.full')); C.shown = 3; return false; }
      if (why) return false;
      if (!resources.takePotion()) { sound?.potion?.('no'); toast(tr('potion.none')); return false; }
      player.drinkPotion();
      sound?.potion?.('open'); C.shown = 3;
      return true;
    },
    /** The restart card's confirm: up again at the last safe place. */
    restart() {
      if (!player.dead) return false;
      restartOpen = false; deadFor = 0; knockedOut = null;
      player.restart();
      rig.target?.copy?.(player.pos);
      screen.set('restart', null);
      return true;
    },
    /** A foe near (LB blocks, the right stick only looks: the controller's combat()). */
    near: (r = 20) => foes.near(r),
    /** Per frame, the world's step (dt: slowed by a hit-stop or the flurry) and the real one. */
    update(dt, realDt, { busy = false, paused = false } = {}) {
      busyNow = busy;
      // fire and spines (src/hazards.js: "It burns!" is the hurt's to say; the line, hints full)
      if (!busy && !paused) updateHazards(dt, player, { notice: (t) => { if (hintsFor('tip')) teach(t); } });
      foes.update(dt, busy || paused);
      if (flurryLeft() > 0 && !foes.anyFighting()) endFlurry();
      if (!(busy || paused)) { chimes.update(dt, player.dead ? null : player.pos); potionDrops.update(dt, player.dead ? null : player.pos); }
      chimeView.update(chimes, camera);
      // the knock-out's card
      deadFor = player.dead ? deadFor + realDt : 0;
      const want = player.dead && deadFor > 1.4 && !paused;
      if (want !== restartOpen) {
        restartOpen = want;
        screen.set('restart', want ? { text: tr(knockedOut === 'fall' ? 'restart.fall' : 'restart.out'), key: 'A / ×', label: tr('restart.button') } : null);
      }
      // the edges: one heart or less (the heartbeat's pulse), the flurry's slow time, a moth's flash
      const lh = lowHealth.update(realDt, { hearts: player.hearts, max: player.maxHearts, dead: player.dead, paused: busy || paused });
      const e = { low: r2(lh.k), flurry: r2(flurryK()), blind: r2(foes.blindLevel?.() ?? 0), tone: foes.blindTone ?? '#ff5fa2' };
      const ek = `${e.low}|${e.flurry}|${e.blind}`;
      if (ek !== C._edges) { C._edges = ek; screen.set('edges', e.low || e.flurry || e.blind ? e : null); }
      // the reticle and the markers of foes winding up out of sight, as the page draws them
      const R = foes.reticle?.view;
      screen.set('lock', R && foes.lock && !busy && !paused ? {
        x: r2(R.cx / R.W), y: r2(R.cy / R.H), k: r2(R.k * 720 / R.H), hollow: !!R.hollow, a: r2(R.opacity),
        arrows: R.arrows.map(([x, y, d]) => [+(x / R.H).toFixed(4), +(y / R.H).toFixed(4), Math.round(d)]),
      } : null);
      const W = foes.warnView;
      screen.set('warn', W?.length && !busy && !paused ? W.map((w) => ({ x: r2(w.x), y: r2(w.y), k: r2(w.k ?? 0), tone: w.tone })) : null);
    },
    /** The lock's camera, after the rig has placed it (main.js renderFrame): the traveller faces the foe, strafing round it. */
    frame(realDt, busy) {
      player.lockOn = foes.lock && !busy ? Object.assign(player._lockOn ??= { dir: new THREE.Vector3() }, {}) : null;
      const lockView_ = foes.lock?.steady ? foes.lock.steady(busy ? 0 : realDt) : foes.lock;
      if (player.lockOn) {
        player.lockOn.dir.set(lockView_.pos.x - player.pos.x, 0, lockView_.pos.z - player.pos.z).normalize();
        (player.lockOn.at ??= new THREE.Vector3()).copy(lockView_.pos);
        camera.getWorldDirection(_hopView);
        const a = hopAxis(player.lockOn.dir, _hopView.setY(0).normalize(), Math.hypot(lockView_.pos.x - player.pos.x, lockView_.pos.z - player.pos.z), LOCK_NEAR);
        (player.lockOn.hop ??= new THREE.Vector3()).set(a.x, 0, a.z);
      }
      if (!foes.lock) { lockView.foe = null; lockView.angle = 0; }
      if (!foes.lock || busy) lockView.vel = 0;
      rig.locked = !!(foes.lock && !busy);
      rig.lockAt = rig.locked ? (lockView_.chest ?? lockView_.pos) : null;
      rig.frameWith = rig.locked && foes.lock.guardian && foes.lock.model?.group ? guardianBox(foes.lock.model, lockView_.pos, lockBox, performance.now() / 1000) : null;
      rig.boss = busy ? null : foes.bossFight()?.def.camera ?? null;
      if (!rig.locked) rig.lockRoom?.(realDt, null);
      if (foes.lock && !busy) {
        const f = foes.lock, F = player.frame;
        const aim = aimingLocked(busy) ? lockAim(camera.position, f.aim ?? f.chest, F) : null;
        if (!aim) lockFollow(lockView, rig, lockView_, player.pos, F, realDt);
        else {
          rig.lockRoom?.(realDt, null); lockView.vel = 0;
          aimNudge.update(realDt, padLook());
          lockAimStep(rig, aim, aimNudge, THREE.MathUtils.smoothstep(tool.camK, AIM_NUDGE.ramp[0], AIM_NUDGE.ramp[1]));
        }
      }
      if (!aimingLocked(busy) && (aimNudge.x || aimNudge.y || aimNudge.mx || aimNudge.my)) aimNudge.reset();
      if (tool) tool.nudged = aimingLocked(busy) && aimNudge.nudged;
    },
    dispose() { for (const o of offs) o?.(); foes.dispose(); chimeView.dispose?.(); },
  };
  return C;
}
