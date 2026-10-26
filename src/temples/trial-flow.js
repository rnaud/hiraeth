import { endingOf } from './endings.js';
import { endingOpeningShots, HELPER_OPENING } from './helper-cinematics.js';

// A temple whose ending is its guardian's trial (endings.js kind 'trial', issue #655): the same continuous flow as the
// helper games, played in the guardian's own hall.
//
//   door      crossing into the hall (the arena: the Guardian wakes when you step into it, boss.js update) asks
//             hold() first: the first time this visit, the introduction film plays (two panels, two captions) and the
//             guardian sleeps through it; at its end (or its skip) it wakes and its arena door shuts behind you.
//   retry     knocked out, you wake at the mark outside the hall and the guardian sleeps where its phase began
//             (runtime.js); walking back in wakes it at once, no film.
//   quit      leaving the hall another way while it is awake (the game menu's last mark, the ship, a teleport): after
//             QUIT_AFTER s outside, it settles back to sleep where its phase began and its door opens again. No completion.
//   reload    nothing of the trial is saved but the temple's own completion: a reload mid-trial finds it asleep, and
//             the door's film plays again.
//   success   the guardian resolved: the house's completion film (finale.js) and its world change, as before.
//
//   const trial = guardianTrial(rt, { moments, live })
//   rt.holdWake = trial.hold; each frame trial.update(dt); trial.dispose()

export const QUIT_AFTER = 1.0;   // s outside the hall, awake and not knocked out, before the trial is called off
export const trialOpeningId = (id) => `temple.${id}.trial.opening`;
const OUT_PAST = 12;   // m past the arena's rim (or the far side of its door) that counts as having left the hall

export function guardianTrial(rt, { moments = null, live = () => true } = {}) {
  const E = endingOf(rt.id);
  if (!E || E.kind !== 'trial' || !rt.guardian || rt.guardian.def.helper) return null;
  const G = rt.guardian;
  let disposed = false, introduced = false, film = null, away = 0;
  const parent = rt.root?.parent;
  const alive = () => !disposed && live() && (!parent || rt.root?.parent === parent);
  const door = () => (rt.def.arenaDoor ? rt.piece?.(rt.def.arenaDoor) : null);
  // which side of its door the hall is on (the door's local z toward the arena's middle)
  const hallSide = () => {
    const d = door();
    if (!d?.group) return 0;
    d.group.updateMatrixWorld?.(true);
    return Math.sign(d.group.worldToLocal(G.arena.center.clone()).z) || 1;
  };
  let side = null;
  const left = (p) => {
    const A = G.arena;
    if (Math.hypot(p.x - A.center.x, p.z - A.center.z) > A.r + OUT_PAST || Math.abs(p.y - A.y) > 30) return true;
    if (rt.inside && !rt.inside(p)) return true;
    const d = door();
    if (!d?.group) return false;
    side ??= hallSide();
    return d.group.worldToLocal(p.clone()).z * side < -OUT_PAST / 2;
  };
  const wakeNow = () => {
    const P = rt.player;
    if (!alive() || rt.logic.resolved || G.state !== 'sleep' || P?.dead) return;
    G.wake();
  };
  return {
    get introduced() { return introduced; },
    get playing() { return !!film && !film.done; },
    /** Asked by the guardian before it wakes: true holds it asleep (its introduction playing). */
    hold() {
      if (film && !film.done) return true;
      if (introduced || !alive() || rt.logic.resolved) return false;
      introduced = true;
      const shots = rt.player && endingOpeningShots(rt, rt.player, { entrance: true });
      if (!shots || !moments?.play) return false;
      const [a, b] = E.captions;
      film = moments.play({ id: trialOpeningId(rt.id), shots, behind: true,
        beats: [{ t: 0.15, line: a, secs: HELPER_OPENING.context - 0.2 },
          { t: HELPER_OPENING.context + 0.1, line: b, secs: HELPER_OPENING.guide - 0.15 }],
        onFrame: (m) => { if (!alive()) m.finish(true); },
        onEnd: wakeNow });
      return !!film && !film.done;
    },
    update(dt = 0) {
      const P = rt.player;
      if (!alive() || !P?.pos || rt.logic.resolved || !G.awake || P.dead || moments?.playing) { away = 0; return; }
      away = left(P.pos) ? away + dt : 0;
      if (away < QUIT_AFTER) return;
      away = 0;
      G.reset();
      if (rt.def.arenaDoor) { rt.logic.force(rt.def.arenaDoor, null); rt.applyDoors?.(); }
      rt.notice?.(`${String(G.def.name ?? 'The guardian').replace(/^the /, 'The ')} settles again. Go back through its door to try again.`, 'trial.quit');
    },
    dispose() {
      disposed = true;
      if (film && !film.done && moments?.current === film) film.finish(true);
    },
  };
}
