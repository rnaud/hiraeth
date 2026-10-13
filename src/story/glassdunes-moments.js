import { V, UP, closeUp } from './film.js';

// The Glass Dunes' climax, filmed (src/story/moment.js): once per save, skippable, and never in the way (when it
// can't play, nothing is lost: the clock keeps time all the same, the temple's world change, src/temples/garage.js).
//
//   clock  out of the Clock-House after the Foreman keeps time again (glassdunes.moment.clock)
//          A  wide, down the valley side of the house: the round house in the sand, the great cogs half sunk
//             round it turning, the traveller small at the door; the camera eases in             0.0–2.6
//          B  the great clock over the door, close: its hands come round and settle on the true time   2.6–5.0
//          C  low by a great cog half sunk in the sand, its face to the lens, turning, the house beyond
//             (the beat's second half: three panels and 7.2 s before, the cogs only small in A: QC v1.66) 5.0–7.0
//          D  his face, three-quarter, turned up to the clock: he listens to it tick, and the corner of
//             his mouth goes up; the controls come back with the cogs still turning                 7.0–9.2
//          sound: the father's theme in the world's mode (sound.swell('father'): every clock agreeing)
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into C before his mouth goes up; BACK: how far down the valley A stands (m, from the door). */
export const CLOCK = { A: 2.6, B: 2.4, C: 2.0, D: 2.2, SMIRK: 0.8, BACK: 30, swellAt: 0.6 };
export const MOMENTS = [{ id: 'glassdunes.clock', flag: 'glassdunes.moment.clock', beat: 'the clock over the Clock-House comes round and keeps time, and the great cogs turn in the sand' }];

export function setupGlassDunesMoments(ctx, { rt }) {
  const { player, sound, moments, toast = () => {} } = ctx;
  const off = { clock: () => false };
  if (!moments || !rt?.outside?.hands) return off;

  /** The clock keeps time, seen from outside: `said` its toast at the end. True if it plays. */
  function clock({ said = null } = {}) {
    const O = rt.outside, door = O.door.at, h = O.door.heading;
    const out = V(Math.sin(h), 0, Math.cos(h)), side = V(out.z, 0, -out.x);
    const face = O.hands.position.clone();
    const B0 = CLOCK.A, C0 = B0 + CLOCK.B, D0 = C0 + (O.cogs?.length ? CLOCK.C : 0);
    // C's cog: the one nearest the side A looks from, its face (it stands on edge facing the way round the house)
    const cog = cogShot(O, door, side);
    const m = moments.play({
      id: 'glassdunes.clock', flag: 'glassdunes.moment.clock', dur: D0 + CLOCK.D,
      shots: [
        // A: wide, out from the door and to one side: the house, its cogs, him small at the door (out on the open sand:
        // not pulled in, or the pendulum swinging under the clock, between the lens and the face, jammed it against the
        // wall a second in: the cinematics QC, v1.43)
        { dur: CLOCK.A, clear: false, from: { pos: door.clone().addScaledVector(out, CLOCK.BACK).addScaledVector(side, -12).addScaledVector(UP, 6), look: face.clone().addScaledVector(UP, -5), fov: 46 },
          to: { pos: door.clone().addScaledVector(out, CLOCK.BACK - 4).addScaledVector(side, -10).addScaledVector(UP, 6.5), look: face.clone().addScaledVector(UP, -4), fov: 44 } },
        // B: the clock, close, straight on: its hands come round
        { dur: CLOCK.B, clear: false, from: { pos: face.clone().addScaledVector(out, 8).addScaledVector(UP, -0.6), look: face.clone(), fov: 34 },
          to: { pos: face.clone().addScaledVector(out, 6.8).addScaledVector(UP, -0.4), look: face.clone(), fov: 32 } },
        // C: a great cog turning in the sand, close and low, the house beyond it
        ...(cog ? [{ dur: CLOCK.C, from: cog.from, to: cog.to }] : []),
        // D: his face, turned up to it
        { dur: CLOCK.D, clear: false, from: closeUp(player, { angle: 0.5, dur: CLOCK.D }) },
      ],
      beats: [{ t: CLOCK.swellAt, run: () => sound?.swell?.('father', face.clone()) }],
      onStart: (mm) => { mm.face = face.clone(); mm.eyes = face.clone(); },
      onFrame: (mm, t) => { mm.look = t > D0 + CLOCK.SMIRK ? 'smirk' : null; },
      onEnd: () => { if (said) toast(said); },
    });
    return !!m;
  }

  return { clock };
}

/**
 * The cogs' panel: in front of the great cog on A's side of the house (the nearest to A's lens), low, a little off its
 * axis so the teeth read in depth, easing in; the house past its rim. Null when the house has no cogs.
 */
export function cogShot(O, door, side) {
  if (!O.cogs?.length) return null;
  const a = door.clone().addScaledVector(side, -12);
  const at = (k) => k.g.getWorldPosition(V(0, 0, 0));
  const k = O.cogs.reduce((b, x) => (at(x).distanceTo(a) < at(b).distanceTo(a) ? x : b));
  const c = at(k);
  if (!k.m.geometry.boundingSphere) k.m.geometry.computeBoundingSphere();
  const r = Math.max(4, (k.m.geometry.boundingSphere?.radius ?? 9) - 1.6);   // (to the teeth's roots)
  const n = V(0, 0, 1).applyQuaternion(k.g.getWorldQuaternion(new k.g.quaternion.constructor()));
  const home = O.kit.world(0, 0, 0);
  const toHouse = V(home.x - c.x, 0, home.z - c.z).normalize();
  if (n.dot(toHouse) > 0) n.negate();   // (on the face away from the house: the house beyond it)
  const look = c.clone().addScaledVector(toHouse, r * 0.3);
  return {
    from: { pos: c.clone().addScaledVector(n, r * 1.5).addScaledVector(toHouse, -r * 0.8).addScaledVector(UP, 1.2), look, fov: 44 },
    to: { pos: c.clone().addScaledVector(n, r * 1.3).addScaledVector(toHouse, -r * 0.6).addScaledVector(UP, 1.6), look, fov: 42 },
  };
}
