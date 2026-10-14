// Helping a guardian instead of fighting it (issue #339, prototypes for the author to play; docs/design/helper-guardians.md).
// Two encounters, each in its shipped arena and played only from its review switch, so the shipped fights stay as they
// are until the author picks:
//
//   ?level=arzach&guardianHelp=elder    the Aerie's Roost: glide beside the Elder as she flies again and catch the stone
//                                       feathers she sheds before they shatter on the floor (src/guardian-help/elder.js)
//   ?level=desert&guardianHelp=keeper   the Rose House's cistern: the fluid gun lends a water cannon; fill its jars, the
//                                       wheel's trough and the Givers' tank, and the water and the light come back
//                                       (src/guardian-help/keeper.js)
//
// Both are in the Debug menu (src/world-picker.js, "Prototypes"). Progress is a sandboxed save (nothing written), like
// the guardian review (src/guardian-review.js). The encounter takes the guardian over: its update is the encounter's
// (attachHelp), its state 'help' (no lock-on, no blows, no fight); the meter on screen is the encounter's progress, and
// the hand on its brow at the end is the shipped one (boss.js `final: 'touch'`), resolving the temple as the fight would.

import * as THREE from 'three';
import { HELP, helpKind, helpHref, seedGuardianHelp } from './seed.js';
import { ElderFlight } from './elder.js';
import { KeeperFlow } from './keeper.js';
import { HelpHud } from './hud.js';
export { poseGuardian } from './pose.js';

/** The two prototypes: the encounter of each (the world, its temple and its items: seed.js HELP). */
export const HELPS = {
  elder: { ...HELP.elder, Encounter: ElderFlight },
  keeper: { ...HELP.keeper, Encounter: KeeperFlow },
};
export { HELP, helpKind, helpHref, seedGuardianHelp };

const _v = new THREE.Vector3();

/**
 * Take a temple's guardian over with a prototype: the encounter is built in its arena and runs in place of its fight
 * (Guardian.update), the guardian kept in state 'help' until it is calmed (then 'weary': the shipped hand on its brow).
 * o: { tool (the FluidTool, the Keeper's cannon), hud (a HelpHud; one is made), notice }. Returns the encounter.
 */
export function attachHelp(rt, kind, o = {}) {
  const H = HELPS[kind], G = rt?.guardian;
  if (!H || !G || G.state === 'resolved') return null;
  const hud = o.hud ?? new HelpHud(H.name);
  const enc = new H.Encounter(rt, { tool: o.tool ?? null, hud });
  G.stop();
  G.state = 'help';
  G.update = (dt, t) => enc.update(dt, t);
  enc.kind = kind;
  return enc;
}

/**
 * The page's start (main.js, ?guardianHelp=…): the encounter on the world's temple, the traveller put at its start, the
 * camera's framing each frame (frame(dt): rig.boss, the yaw eased onto both of you).
 */
export function startGuardianHelp({ kind, level, player, tool, rig }) {
  const H = HELPS[kind];
  const rt = level.temples?.find((x) => x.id === H.temple) ?? (level.temple?.id === H.temple ? level.temple : null);
  if (!rt?.guardian) { console.warn(`guardianHelp=${kind}: no ${H.temple} guardian in this world`); return null; }
  const enc = attachHelp(rt, kind, { tool });
  if (!enc) return null;
  enc.enter(player);
  if (rig) { rig.yaw = player.heading + Math.PI; rig.pitch = -0.1; }
  if (typeof window !== 'undefined') window.guardianHelp = enc;
  return {
    enc,
    frame(dt, ctx = {}) {
      const R = ctx.rig ?? rig;
      if (!R || !enc.view) return;
      const v = enc.view(player);
      if (!v) return;
      R.boss = v.camera ?? null;
      if (v.look && dt > 0) {
        _v.subVectors(v.look, player.pos);
        const want = Math.atan2(_v.x, _v.z) + Math.PI;
        R.yaw += Math.atan2(Math.sin(want - R.yaw), Math.cos(want - R.yaw)) * (1 - Math.exp(-(v.rate ?? 1.5) * dt));
      }
    },
  };
}
