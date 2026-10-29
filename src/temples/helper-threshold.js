import * as THREE from 'three';
import { slots } from '../save-slots.js';
import { HELPER_KEY } from './helper-encounter.js';
import { HELPER_ENTRANCES } from './endings.js';
// The doorways of the temples whose ending is a kit minigame (endings.js).
export { HELPER_ENTRANCES };
const V = () => new THREE.Vector3();
const markerKey = id => `temple.${id}.help.entry`;
const poseOf = p => ({ pos: p.pos.toArray(), up: p.frame.up.toArray(), fwd: p.frame.dir(p.heading, V()).toArray() });
const validPose = p => ['pos', 'up', 'fwd'].every(k => Array.isArray(p?.[k]) && p[k].length === 3 && p[k].every(Number.isFinite)) && Math.hypot(...p.up) > .5 && Math.hypot(...p.fwd) > .5;

/** Swept ordinary doorway entry; a load already inside gets only explicit recovery. */
export function helperThreshold(rt, { game, player, invitation, moments, live = () => true, slot = () => slots.active }) {
  const def = HELPER_ENTRANCES[rt.id], door = def && rt.piece(def.door);
  if (!door) throw Error(`Missing helper entrance: ${rt.id}`);
  const owner = String(slot()); let disposed = false, initialized = false, previous = null, outside = null, crossed = false, launched = false, legacy = false;
  const local = () => door.group.worldToLocal(player.pos.clone());
  const eligible = () => !disposed && live() && String(slot()) === owner && !rt.logic.resolved && !game.flag(`temple.${rt.id}.done`);
  const prerequisites = () => def.needs.every(id => game.flag(`item.${id}`)) && (!def.upstream || rt.logic.isOpen(def.upstream)) && rt.logic.isOpen(def.door);
  const clear = () => door.open && !door.handle && door.slab.position.y + door.h < .1;
  const restore = p => player.teleport(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.up), new THREE.Vector3(...p.fwd));
  const completion = () => {
    // Explicit successful homecoming: the near rim of the retained guardian room,
    // outside the Rose basin / Aerie vent machinery. Quit never uses this pose.
    const inward = new THREE.Vector3(0, 0, 1).transformDirection(door.group.matrixWorld);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(door.group.matrixWorld);
    const pos = rt.guardian.arena.center.clone().addScaledVector(inward, -rt.guardian.arena.r * .65);
    pos.y = rt.guardian.arena.y + .05;
    return { pos: pos.toArray(), up: up.toArray(), fwd: inward.toArray() };
  };
  const launch = (returnPose, recovery = false) => {
    if (!eligible() || launched || (!recovery && (!prerequisites() || !clear())) || !validPose(returnPose)) return false;
    game.set(markerKey(rt.id), { slot: owner, pose: returnPose });
    const ok = invitation.start({ entrance: true, returnPose, completionPose: completion(), onLaunch: () => game.set(markerKey(rt.id), null) });
    if (ok) { launched = true; crossed = false; legacy = false; }
    else game.set(markerKey(rt.id), null);
    return ok;
  };
  return {
    dispose() { disposed = true; },
    /** Back from a game played in this page without the win (kit/here.js): the doorway asks again next time it is crossed. */
    rearm() { launched = false; crossed = false; previous = null; initialized = false; },
    legacyAvailable: () => eligible() && legacy && !launched,
    continueLegacy() {
      if (!eligible() || !legacy) return false;
      // This compatibility-only continuation preserves the loaded pose on quit.
      // Ordinary door arrivals always use their observed exterior approach pose.
      return launch(poseOf(player), true);
    },
    update() {
      if (!eligible() || launched || !player?.pos) return;
      if (!initialized) {
        initialized = true;
        const interrupted = game.flag(markerKey(rt.id));
        if (interrupted?.slot === owner && validPose(interrupted.pose) && !game.flag(HELPER_KEY)?.success) restore(interrupted.pose);
        if (interrupted) game.set(markerKey(rt.id), null);
        previous = local();
        legacy = rt.inside(player.pos) && previous.z > 1;
        return;
      }
      const p = local(), prior = previous; previous = p.clone();
      const width = Math.max(.1, door.w / 2 - .45);
      const onFloor = p.y >= -.2 && p.y < .7 && player.onGround;
      const inLane = Math.abs(p.x) < width && onFloor;
      const busy = player.dead || player.boarding || player.unboarding || moments?.playing;
      if (p.distanceTo(prior) > 3 || busy) { crossed = false; return; }
      if (inLane && p.z <= -1.5 && p.z >= -4) { outside = poseOf(player); crossed = false; legacy = false; }
      if (outside && inLane && prior.z <= 0 && p.z > 0 && p.z < 1.5 && prerequisites()) crossed = true;
      // Collider removal precedes the 1.8 s visual descent. Retain a genuine
      // crossing while the traveller continues into the room; never require
      // them to stop within a narrow strip before the slab has finished.
      if (crossed && p.z >= 0 && rt.inside(player.pos) && clear()) launch(outside);
      if (p.z < -1.5 || !rt.inside(player.pos)) crossed = false;
    },
  };
}
