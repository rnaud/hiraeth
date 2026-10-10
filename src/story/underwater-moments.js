import { V, UP, closeUp } from './film.js';

// The Underwater City's climax, filmed (src/story/moment.js): once per save, skippable, and never in the way (when it
// can't play, nothing is lost: the whales come to the glass all the same, the temple's world change).
//
//   whales  out of the Whale-House after its keeper is calmed (underwater.moment.whales)
//           A  wide, from down the last tube: the traveller small at the makers' door, the glass arching over him,
//              the dark water beyond; the camera eases toward him                                         0.0–2.6
//           B  through the tube's glass: a whale comes up out of the deep, close, its flank sliding past    2.6–5.4
//           C  his face, three-quarter, turned to the glass: he listens, and the corner of his mouth goes up;
//              the controls come back with the whale still passing                                        5.4–7.6
//           sound: the father's theme in the world's mode (sound.swell('father'): the whales' answer)
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into C before his mouth goes up; BACK: how far down the tube A stands (m, from the door). */
export const WHALES = { A: 2.6, B: 2.8, C: 2.2, SMIRK: 0.9, BACK: 18, swellAt: 0.8 };
export const MOMENTS = [{ id: 'underwater.whales', flag: 'underwater.moment.whales', beat: 'the whales come back to the glass and sing, the light’s note first' }];

export function setupUnderwaterMoments(ctx, { rt, level }) {
  const { player, sound, moments, toast = () => {} } = ctx;
  const off = { whales: () => false };
  if (!moments || !rt?.outside?.door) return off;

  /** The whales come back, seen from the tube: `said` its toast at the end. True if it plays. */
  function whales({ said = null } = {}) {
    const O = rt.outside, door = O.door.at, h = O.door.heading;
    const out = V(Math.sin(h), 0, Math.cos(h)), side = V(out.z, 0, -out.x);
    const whale = level?.whales?.[0];
    const at = () => (whale ? whale.position.clone() : door.clone().addScaledVector(side, 30).addScaledVector(UP, 6));
    const B0 = WHALES.A, C0 = B0 + WHALES.B;
    const m = moments.play({
      id: 'underwater.whales', flag: 'underwater.moment.whales', dur: C0 + WHALES.C,
      shots: [
        // A: wide, down the tube: the door, the arch of glass, him small before it
        { dur: WHALES.A, from: { pos: door.clone().addScaledVector(out, WHALES.BACK).addScaledVector(side, 1.6).addScaledVector(UP, 2.6), look: door.clone().addScaledVector(UP, 2.2), fov: 50 },
          to: { pos: door.clone().addScaledVector(out, WHALES.BACK - 5).addScaledVector(side, 1.2).addScaledVector(UP, 2.4), look: door.clone().addScaledVector(UP, 2.0), fov: 46 } },
        // B: through the glass at the whale passing (the camera at his shoulder in the tube, aimed out)
        { dur: WHALES.B, clear: false, from: (t) => { const w = at(); const eye = door.clone().addScaledVector(out, 6).addScaledVector(UP, 2.2); return { pos: eye, look: w, fov: 44 - t * 2 }; } },
        // C: his face, turned to it
        { dur: WHALES.C, clear: false, from: closeUp(player, { angle: 0.6, dur: WHALES.C }) },
      ],
      beats: [{ t: WHALES.swellAt, run: () => sound?.swell?.('father', door.clone()) }],
      onStart: (mm) => { mm.face = at(); mm.eyes = at(); },
      onFrame: (mm, t) => { mm.look = t > C0 + WHALES.SMIRK ? 'smirk' : null; mm.eyes = at(); },
      onEnd: () => { if (said) toast(said); },
    });
    return !!m;
  }

  return { whales };
}
