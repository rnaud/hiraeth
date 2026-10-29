import * as THREE from 'three';
import { slots } from '../save-slots.js';
import { spoken } from '../story/tone.js';
import { sightClear } from '../story/film.js';
import { beginHelperEncounter } from './helper-encounter.js';
import { drawnHit, keeperBox, fitFov, FINALES } from './finale.js';
import { ENDING_CAPTIONS, TEMPLE_ENDINGS } from './endings.js';

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
// (or the guardian's trial) owns its detailed controls, and its own result owns the outcome.
// Every temple's two lines are its entry in endings.js.
export const HELPER_CAPTIONS = ENDING_CAPTIONS;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const turns = [0, .35, -.35, .7, -.7, 1.1, -1.1, 1.6, -1.6, Math.PI];

/**
 * `whole`: the subject's middle and the four corners of its box (drawn a third in) seen past the guardian's body and
 * any pillar or wall well short of them: the warden's leg, then a column, filled the Warden's Well's vanes panel with only
 * its middle ray clear (#655).
 */
function seenWhole(rt, pos, box, body, skip) {
  const c = box.getCenter(V()), pts = [c];
  for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) pts.push(V(x, c.y, z).lerp(c, .45));
  const ray = new THREE.Ray(), hit = V();
  return pts.every((p) => {
    const d = pos.distanceTo(p);
    ray.set(pos, p.clone().sub(pos).divideScalar(d));
    if (ray.intersectBox(body, hit) && pos.distanceTo(hit) < d) return false;
    // (a pillar between: a drawn surface well short of the point; the wall a clock hangs on, at the point, is not one)
    if (drawnHit(rt, pos, p, skip) < d - 1.5) return false;
    // (and past the house's solids: a dressed column the drawn raycast missed stood in the Warden's Well's panel)
    return sightClear(pos, p, { physics: rt.physics ?? null, near: 1.5 });
  });
}

/**
 * Nothing drawn or solid fills the front of the frame: rays through a 3 × 3 grid over the picture (most of its
 * width and height) reach at least a third of the way to the subject. A pillar beside the Warden's Well's lens filled a third of
 * its panel with every ray to the vane clear (#655).
 */
function openFront(rt, pos, look, fov, skip) {
  const d = pos.distanceTo(look), f = look.clone().sub(pos).divideScalar(d);
  const r = f.clone().cross(UP).normalize(), u = r.clone().cross(f);
  const h = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * d * .7, w = h * 16 / 9;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    const p = look.clone().addScaledVector(r, a * w).addScaledVector(u, b * h), dp = pos.distanceTo(p);
    const reach = Math.min(drawnHit(rt, pos, p, skip), rt.physics?.rayDistance?.(pos, p.clone().sub(pos).normalize(), dp) ?? Infinity);
    if (reach < Math.min(dp, d) * .35) return false;
  }
  return true;
}

/** A lens for an actual room subject, outside the shown body and drawn walls. */
function frame(rt, box, direction, skip = [], higher = [], whole = false) {
  const look = box.getCenter(V()), size = box.getSize(V());
  const radius = Math.max(2, size.length() * .5);
  const body = keeperBox(rt.guardian.model).expandByScalar(.6), floor = rt.guardian.arena.y;
  for (const fov of [52, 60, 68]) for (const a of turns) for (const height of (whole ? [7, 10, 4.5, 13, Math.max(2.3, size.y * .35)] : [Math.max(2.3, size.y * .35), 4.5, 7, ...higher])) {
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(fov * .5)) * 1.08;
    const dir = V(direction.x * Math.cos(a) + direction.z * Math.sin(a), 0, -direction.x * Math.sin(a) + direction.z * Math.cos(a));
    const pos = look.clone().addScaledVector(dir, distance); pos.y = Math.max(floor + 1.4, look.y + height);
    // Start behind the lens: drawnHit's near clip must not hide a thin
    // decorative wall within the first 15 cm in front of the camera.
    const probe = pos.clone().addScaledVector(pos.clone().sub(look).normalize(), .4);
    const clear = drawnHit(rt, probe, look, skip) >= probe.distanceTo(look) - .3;
    if (rt.inside?.(pos) !== false && !rt.physics?.embedded?.(pos) && !body.containsPoint(pos) && clear && fitFov(pos, look, box, 4 / 3, .74) <= fov
      && (!whole || (seenWhole(rt, pos, box, body, skip) && openFront(rt, pos, look, fov, skip)))) return { pos, look, fov };
  }
  // No unsafe lens fallback: an unavailable room view goes straight to the
  // invitation's normal launch path without changing any encounter outcome.
  return null;
}

/**
 * What an ending's second panel shows: what is at stake in the hall, before it changes ({ pos, size, skip }), or null.
 * The Rose House's dry basin and the Aerie's still vent; every other house the subject its completion film shows
 * changed (finale.js FINALES[id].sign: the still vanes, the dark lamp, the stopped clocks…), seen as it is now.
 */
export function endingSubjects(rt) {
  if (rt.id === 'desert') {
    const p = rt.spring?.pool?.getWorldPosition?.(V());
    // The dry basin's centre lies below its stone spout. Aim just above that
    // existing spout so its own opaque stem is in frame, not a false wall blocker.
    return p ? [{ pos: p.setY(rt.guardian.arena.y + 1.9), size: V(11, 3, 11), skip: [] }] : [];
  }
  if (rt.id === 'arzach') {
    const w = rt.roostWinds?.[0];
    return w ? [{ pos: w.foot.clone().setY(w.foot.y + 4), size: V(8, 8, 8), skip: [w.root] }] : [];
  }
  let list = [];
  try { list = TEMPLE_ENDINGS[rt.id]?.stake?.(rt) ?? FINALES[rt.id]?.sign?.at?.(rt) ?? []; } catch { list = []; }
  // (each of the house's subjects in turn, the film's own first: the first one a lens sees whole is the panel)
  return [...list].filter((s) => s?.pos).sort((a, b) => (a.pri ?? 0) - (b.pri ?? 0)).map((s) => {
    const d = Math.max(4, Math.min(12, (s.r ?? 4) * 1.6));
    return { pos: s.pos.clone(), size: V(d, Math.min(d, 8), d), skip: s.skip ?? [], higher: [10, 13], whole: true };
  });
}
export const endingSubject = (rt) => endingSubjects(rt)[0] ?? null;

/** Two views: the guardian, then the real subject at stake (the basin, the vent, the house's own). */
export function helperOpeningShots(rt, player, { entrance = false } = {}) {
  const model = rt?.guardian?.model;
  if (!model?.pos || !player?.pos || !HELPER_CAPTIONS[rt.id]) return null;
  const body = keeperBox(model);
  if (body.isEmpty()) body.setFromCenterAndSize(model.pos.clone().addScaledVector(UP, (model.height ?? 4) * .5), V((model.radius ?? 3) * 2, model.height ?? 4, (model.radius ?? 3) * 2));
  const pair = entrance ? body.clone() : body.clone().expandByPoint(player.pos).expandByPoint(player.pos.clone().addScaledVector(UP, 1.9));
  const dir = player.pos.clone().sub(model.pos).setY(0);
  if (dir.lengthSq() < .01) dir.set(0, 0, 1); else dir.normalize();
  const first = frame(rt, pair, dir, [model.group]);
  if (!first) return null;
  let second = null, subject = null;
  for (const sub of endingSubjects(rt)) {
    // (a house's own subject may lie in its floor, the Engine-House's gear: the lens may also look down on it from higher)
    second = frame(rt, new THREE.Box3().setFromCenterAndSize(sub.pos, sub.size), dir, sub.skip, sub.higher ?? [], !!sub.whole);
    if (second) { subject = sub; break; }
  }
  if (!second || !subject) return null;
  return [{ dur: HELPER_OPENING.context, clear: false, from: first },
    { dur: HELPER_OPENING.guide, clear: false, from: second }];
}
/** The same two panels for any temple's ending (endings.js). */
export const endingOpeningShots = helperOpeningShots;

/** Opening ownership only: the existing receipt module remains the success owner. */
export function helperInvitation(rt, { game, player, moments, from, playGame, liveWorld = () => true, slot = () => slots.active } = {}) {
  let disposed = false, pending = false, launched = false, film = null;
  const worldSlot = String(slot()), parent = rt.root?.parent;
  const live = () => !disposed && liveWorld() && String(slot()) === worldSlot && (!parent || rt.root?.parent === parent);
  const cancel = () => { disposed = true; pending = false; if (film && !film.done && moments?.current === film) film.finish(true); };
  return {
    dispose: cancel,
    /** Back from a game played in this page without the win (kit/here.js): it may be asked for again. */
    rearm() { if (!disposed) { pending = false; launched = false; } },
    start({ returnPose = null, completionPose = null, entrance = false, onLaunch = null } = {}) {
      if (!live() || pending || launched || rt.logic.resolved || !player?.pos || !playGame) return false;
      const originSlot = String(slot()), origin = returnPose ?? { pos: player.pos.toArray(), up: player.frame.up.toArray(), fwd: player.frame.dir(player.heading, V()).toArray() };
      pending = true;
      const launch = () => {
        if (!pending || launched || rt.logic.resolved || !live() || String(slot()) !== originSlot) { pending = false; return false; }
        const href = beginHelperEncounter(game, rt.id, { from, returnPose: origin, completionPose, slot: originSlot });
        pending = false;
        if (!href) return false;
        launched = true;
        onLaunch?.();
        playGame(href);
        return true;
      };
      const flag = helperOpeningFlag(rt.id), shots = (entrance || !game.flag(flag)) && helperOpeningShots(rt, player, { entrance });
      if (shots && moments?.play) {
        film = moments.play({ id: flag, ...(entrance ? {} : { flag }), shots, behind: true,
          beats: [{ t: .15, line: HELPER_CAPTIONS[rt.id][0], secs: HELPER_OPENING.context - .2 },
            { t: HELPER_OPENING.context + .1, line: HELPER_CAPTIONS[rt.id][1], secs: HELPER_OPENING.guide - .15 }],
          onFrame: m => { if (!live()) { disposed = true; pending = false; m.finish(true); } },
          onEnd: launch });
        if (film) return true;
      }
      if (entrance) { pending = false; return false; }
      return launch();
    },
  };
}
