import { V, UP, closeUp } from './film.js';

// The Glass Dunes' climax, filmed (src/story/moment.js): once per save, skippable, and never in the way (when it
// can't play, nothing is lost: the clock keeps time all the same, the temple's world change, src/temples/garage.js).
//
//   clock  out of the Clock-House after the Foreman keeps time again (glassdunes.moment.clock)
//          A  wide, down the valley side of the house: the round house in the sand, the great cogs half sunk
//             round it turning, the traveller small at the door; the camera eases in             0.0–2.6
//          B  the great clock over the door, close: its hands come round and settle on the true time   2.6–5.0
//          C  his face, three-quarter, turned up to the clock: he listens to it tick, and the corner of
//             his mouth goes up; the controls come back with the cogs still turning                 5.0–7.2
//          sound: the father's theme in the world's mode (sound.swell('father'): every clock agreeing)
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into C before his mouth goes up; BACK: how far down the valley A stands (m, from the door). */
export const CLOCK = { A: 2.6, B: 2.4, C: 2.2, SMIRK: 0.8, BACK: 30, swellAt: 0.6 };
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
    const B0 = CLOCK.A, C0 = B0 + CLOCK.B;
    const m = moments.play({
      id: 'glassdunes.clock', flag: 'glassdunes.moment.clock', dur: C0 + CLOCK.C,
      shots: [
        // A: wide, out from the door and to one side: the house, its cogs, him small at the door
        { dur: CLOCK.A, from: { pos: door.clone().addScaledVector(out, CLOCK.BACK).addScaledVector(side, -12).addScaledVector(UP, 6), look: face.clone().addScaledVector(UP, -5), fov: 46 },
          to: { pos: door.clone().addScaledVector(out, CLOCK.BACK - 4).addScaledVector(side, -10).addScaledVector(UP, 6.5), look: face.clone().addScaledVector(UP, -4), fov: 44 } },
        // B: the clock, close, straight on: its hands come round
        { dur: CLOCK.B, clear: false, from: { pos: face.clone().addScaledVector(out, 8).addScaledVector(UP, -0.6), look: face.clone(), fov: 34 },
          to: { pos: face.clone().addScaledVector(out, 6.8).addScaledVector(UP, -0.4), look: face.clone(), fov: 32 } },
        // C: his face, turned up to it
        { dur: CLOCK.C, clear: false, from: closeUp(player, { angle: 0.5, dur: CLOCK.C }) },
      ],
      beats: [{ t: CLOCK.swellAt, run: () => sound?.swell?.('father', face.clone()) }],
      onStart: (mm) => { mm.face = face.clone(); mm.eyes = face.clone(); },
      onFrame: (mm, t) => { mm.look = t > C0 + CLOCK.SMIRK ? 'smirk' : null; },
      onEnd: () => { if (said) toast(said); },
    });
    return !!m;
  }

  return { clock };
}
