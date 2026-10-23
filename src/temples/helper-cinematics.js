import * as THREE from 'three';
import { slots } from '../save-slots.js';
import { spoken } from '../story/tone.js';
import { beginHelperEncounter } from './helper-encounter.js';
import { drawnHit, keeperBox, fitFov } from './finale.js';

// One live source world per GameState. A newly loaded world invalidates deferred
// launches from the old one even if its Moment still receives an end callback.
const worlds = new WeakMap();
export function helperWorldLease(game) {
  const token = {};
  worlds.set(game, token);
  return { live: () => worlds.get(game) === token,
    dispose: () => { if (worlds.get(game) === token) worlds.delete(game); } };
}
export const HELPER_OPENING = { context: 2.8, guide: 4.8 };
export const helperOpeningFlag = id => `temple.${id}.help.opening`;
// Scene captions carry no invented speaker/name knowledge. The actual minigame
// owns its detailed controls, and the pending encounter owns its outcome.
export const HELPER_CAPTIONS = {
  desert: [spoken('scene', '~neutral~ The Keeper’s channels have run dry.'),
    spoken('scene', '~neutral~ Turn the channels toward every trough. Open the valve when the route is ready.')],
  arzach: [spoken('scene', '~neutral~ The Elder needs help reaching her old roost.'),
    spoken('scene', '~neutral~ Stay beside her wing. Return to her side when her courage falls.')],
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const turns = [0, .35, -.35, .7, -.7, 1.1, -1.1, 1.6, -1.6, Math.PI];

/** A lens for an actual room subject, outside the shown body and drawn walls. */
function frame(rt, box, direction, skip = []) {
  const look = box.getCenter(V()), size = box.getSize(V());
  const radius = Math.max(2, size.length() * .5);
  const body = keeperBox(rt.guardian.model).expandByScalar(.6), floor = rt.guardian.arena.y;
  for (const fov of [52, 60, 68]) for (const a of turns) for (const height of [Math.max(2.3, size.y * .35), 4.5, 7]) {
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(fov * .5)) * 1.08;
    const dir = V(direction.x * Math.cos(a) + direction.z * Math.sin(a), 0, -direction.x * Math.sin(a) + direction.z * Math.cos(a));
    const pos = look.clone().addScaledVector(dir, distance); pos.y = Math.max(floor + 1.4, look.y + height);
    // Start behind the lens: drawnHit's near clip must not hide a thin
    // decorative wall within the first 15 cm in front of the camera.
    const probe = pos.clone().addScaledVector(pos.clone().sub(look).normalize(), .4);
    const clear = drawnHit(rt, probe, look, skip) >= probe.distanceTo(look) - .3;
    if (rt.inside?.(pos) !== false && !rt.physics?.embedded?.(pos) && !body.containsPoint(pos) && clear && fitFov(pos, look, box, 4 / 3, .74) <= fov) return { pos, look, fov };
  }
  // No unsafe lens fallback: an unavailable room view goes straight to the
  // invitation's normal launch path without changing any encounter outcome.
  return null;
}

/** Two after-interaction views: the accepted guardian and the real basin/vent. */
export function helperOpeningShots(rt, player) {
  const model = rt?.guardian?.model;
  if (!model?.pos || !player?.pos || !HELPER_CAPTIONS[rt.id]) return null;
  const body = keeperBox(model);
  if (body.isEmpty()) body.setFromCenterAndSize(model.pos.clone().addScaledVector(UP, (model.height ?? 4) * .5), V((model.radius ?? 3) * 2, model.height ?? 4, (model.radius ?? 3) * 2));
  const pair = body.clone().expandByPoint(player.pos).expandByPoint(player.pos.clone().addScaledVector(UP, 1.9));
  const dir = player.pos.clone().sub(model.pos).setY(0);
  if (dir.lengthSq() < .01) dir.set(0, 0, 1); else dir.normalize();
  const first = frame(rt, pair, dir, [model.group]);
  const subject = rt.id === 'desert' ? rt.spring?.pool?.getWorldPosition?.(V()) : rt.roostWinds?.[0]?.foot?.clone();
  if (!first || !subject) return null;
  // The dry basin's centre lies below its stone spout. Aim just above that
  // existing spout so its own opaque stem is in frame, not a false wall blocker.
  subject.y = rt.id === 'desert' ? rt.guardian.arena.y + 1.9 : subject.y + 4;
  const size = rt.id === 'desert' ? V(11, 3, 11) : V(8, 8, 8);
  const second = frame(rt, new THREE.Box3().setFromCenterAndSize(subject, size), dir, rt.id === 'arzach' ? [rt.roostWinds[0].root] : []);
  if (!second) return null;
  return [{ dur: HELPER_OPENING.context, clear: false, from: first },
    { dur: HELPER_OPENING.guide, clear: false, from: second }];
}

/** Opening ownership only: the existing receipt module remains the success owner. */
export function helperInvitation(rt, { game, player, moments, from, playGame, liveWorld = () => true, slot = () => slots.active } = {}) {
  let disposed = false, pending = false, launched = false, film = null;
  const worldSlot = String(slot()), parent = rt.root?.parent;
  const live = () => !disposed && liveWorld() && String(slot()) === worldSlot && (!parent || rt.root?.parent === parent);
  const cancel = () => { disposed = true; pending = false; if (film && !film.done && moments?.current === film) film.finish(true); };
  return {
    dispose: cancel,
    start() {
      if (!live() || pending || launched || rt.logic.resolved || !player?.pos || !playGame) return false;
      const originSlot = String(slot()), origin = { pos: player.pos.toArray(), up: player.frame.up.toArray(), fwd: player.frame.dir(player.heading, V()).toArray() };
      pending = true;
      const launch = () => {
        if (!pending || launched || rt.logic.resolved || !live() || String(slot()) !== originSlot) { pending = false; return false; }
        const href = beginHelperEncounter(game, rt.id, { from, returnPose: origin, slot: originSlot });
        pending = false;
        if (!href) return false;
        launched = true;
        playGame(href);
        return true;
      };
      const flag = helperOpeningFlag(rt.id), shots = !game.flag(flag) && helperOpeningShots(rt, player);
      if (shots && moments?.play) {
        film = moments.play({ id: flag, flag, shots, behind: true,
          beats: [{ t: .15, line: HELPER_CAPTIONS[rt.id][0], secs: HELPER_OPENING.context - .2 },
            { t: HELPER_OPENING.context + .1, line: HELPER_CAPTIONS[rt.id][1], secs: HELPER_OPENING.guide - .15 }],
          onFrame: m => { if (!live()) { disposed = true; pending = false; m.finish(true); } },
          onEnd: launch });
        if (film) return true;
      }
      return launch();
    },
  };
}
