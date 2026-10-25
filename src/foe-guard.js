// Defensive stances with a named breaker (issue #661; docs/design/combat-botw-study.md, ranked changes 3 and 4;
// docs/systems/foes.md "Guards and their breakers"). A foe kind with a `guard` raises it between its own blows when you
// are near: a pose of its body (forearms crossed, the sword across, the shell clamped down, a shield up), and while it
// is up the blows it covers glance off it (a clang, sparks, no harm). One action of the traveller's kit breaks it (the
// charged cut, the air cut, a bomb: `breaks`), another goes round it (any blow outside its `arc`: the dash cut past its
// side, a cut in its back), and the parry of the blow it answers with opens it too. Broken, it reels (the hit-reaction's
// stagger, src/foe-react.js) and stands open a short window (`open`, 0.6-1.2 s: BotW's reel), stunned, every cut double.
//
// Never a wall: a guard is held at most `hold` s, then lowered for `rest` s (its next blow comes), and `blocks` blows
// glanced off it in a row are answered at once with its `counter` (a blow you can guard, parry or hop: the parry opens
// it). So spamming the wrong attack is turned away, but never for long, and it always ends in a blow you can answer.
//
// def.guard:
//   pose     what the body does (the plan reads it: 'arms', 'sword', 'tuck', 'shield')
//   arc      rad either side of its front the guard covers (Math.PI: all round)
//   near     m: it raises it only with you this close; close: m it steps in to behind it, between its blows (a duelist)
//   hold     s it keeps it up at most; rest: s down after it lowers (its blow comes, or it closes in)
//   blocks   blows glanced in a row before it answers with `counter` (an attack id of its own)
//   breaks   the blows that break it: 'charged' (the charged cut), 'air' (the air cut's plunge), 'riposte', 'bomb',
//            'parry' (a perfect parry of any blow of its, the stun it already gives: listed for the gallery)
//   open     s it stands open, stunned, after a break; onBreak 'flip': on its back instead (the crab)
//   shots    true: the guard turns shots and embers from the front too (a shield)
//   hint     what the game says the first time a guard turns a blow (hints: tips)
// attack.shielded: through its wind-up the guard covers too (the fencer's bash and shove, its leap's crouch behind the shield)

/** The stance's pace: s to raise it fully, s to drop it; the share of the raise from which it covers. */
export const STANCE = { raise: 0.22, lower: 0.12, up: 0.6 };

/** Which breaker a blow is for a guard `G`, or null: it glances (pure: tests). info: the blade's (src/fluid-blade.js). */
export function guardBreaker(G, mode, info = {}) {
  const B = G?.breaks ?? [];
  const src = info.source;
  if (src === 'bomb') return B.includes('bomb') ? 'bomb' : null;
  if (mode !== 'blade') return null;
  if (info.riposte) return B.includes('riposte') ? 'riposte' : null;
  if (info.charged !== undefined) return B.includes('charged') ? 'charged' : null;   // (the charged cut: full or not)
  // (the air cut's plunge, not the air combo's light swings: the blade says combo 2 for a special)
  if (info.air && (info.combo === 2 || (info.combo == null && (info.damage ?? 1) >= 2))) return B.includes('air') ? 'air' : null;
  return null;
}

/** Does guard `G` on a foe facing `heading` cover a blow travelling along `dir` (flat; from you into it)? (pure: tests) */
export function guardCovers(G, heading, dir) {
  if (!G || !dir) return false;
  if ((G.arc ?? 1) >= Math.PI - 1e-6) return true;
  const l = Math.hypot(dir.x, dir.z);
  if (l < 1e-6) return true;
  // (the blow comes from where it travels from: its front is where it faces, so a frontal blow runs against its heading)
  const cos = -(dir.x * Math.sin(heading) + dir.z * Math.cos(heading)) / l;
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= (G.arc ?? 1);
}

/** Does guard `G` turn this kind of blow at all (a blade, a bomb; a shot only off a shield)? */
export const guardTurns = (G, mode, info = {}) => mode === 'blade' || info.source === 'bomb' || (!!G?.shots && (mode === 'shoot' || mode === 'fire'));

/**
 * Would it hold its guard up now (pure: tests)? Chasing you (between its own blows: winding up, striking, recovering or
 * stunned it is down), you within `near`, not resting after the last one, not held past `hold`; a disarmed foe without
 * its `shield` pose's shield stays down.
 */
export function wantsGuard(f, d, G = f.def?.guard) {
  if (!G || f.state !== 'chase' || !(d <= G.near)) return false;
  if (f.stunned > 0 || f.flipped > 0 || f.toppled > 0 || f.dazed > 0 || f.sleep > 0) return false;
  return !(f.guardRest > 0) && !((f.guardT ?? 0) >= G.hold);
}

/** Is its guard up enough to turn a blow? Raised between its blows, or behind its shield through a `shielded` wind-up (a bash, a leap's crouch). */
export const guardUp = (f) => !!f.def?.guard && (((f.guardK ?? 0) >= STANCE.up && f.state === 'chase') || (f.state === 'wind' && !!f.atk?.shielded));
