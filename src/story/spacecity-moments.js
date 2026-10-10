import { V, UP, closeUp } from './film.js';

// The City Floating in Space's climax, filmed (src/story/moment.js): once per save, skippable, never in the way (when
// it can't play, nothing is lost: the cables draw taut all the same, the temple's change, src/temples/spacecity.js).
//
//   cables  out of the Mooring-House after the Anchor-Warden is resolved (spacecity.moment.cables)
//           A  wide, from out over the void beside the Moorings' bridge: the house on its island, the traveller
//              small at its door, the stars under it all; the camera eases in                          0.0–2.6
//           B  down past the island's edge: the cables under it drawn taut, lamps running along them toward the
//              city                                                                                    2.6–5.2
//           C  his face, three-quarter: he listens to the cables hum one clear note, and the corner of his mouth
//              goes up; the controls come back with the lamps still running                             5.2–7.4
//           sound: the father's theme in the world's mode (sound.swell('father'))
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into C before his mouth goes up; OUT: how far over the void A stands (m, from the door). */
export const CABLES = { A: 2.6, B: 2.6, C: 2.2, SMIRK: 0.8, OUT: 30, swellAt: 0.7 };
export const MOMENTS = [{ id: 'spacecity.cables', flag: 'spacecity.moment.cables', beat: 'the cables draw taut and the islands come home together, lamps running along them' }];

export function setupSpaceCityMoments(ctx, { rt }) {
  const { player, sound, moments, toast = () => {} } = ctx;
  const off = { cables: () => false };
  if (!moments || !rt?.outside?.door) return off;

  /** The cables draw taut, seen from the void: `said` its toast at the end. True if it plays. */
  function cables({ said = null } = {}) {
    const O = rt.outside, door = O.door.at, h = O.door.heading;
    const out = V(Math.sin(h), 0, Math.cos(h)), side = V(out.z, 0, -out.x);
    const top = door.clone().addScaledVector(UP, 12);
    const under = door.clone().addScaledVector(out, 12).addScaledVector(UP, -14);
    const B0 = CABLES.A, C0 = B0 + CABLES.B;
    const m = moments.play({
      id: 'spacecity.cables', flag: 'spacecity.moment.cables', dur: C0 + CABLES.C,
      shots: [
        // A: wide, out over the void: the house on its island, him small at its door
        { dur: CABLES.A, from: { pos: door.clone().addScaledVector(out, CABLES.OUT).addScaledVector(side, 16).addScaledVector(UP, 4), look: top, fov: 52 },
          to: { pos: door.clone().addScaledVector(out, CABLES.OUT - 5).addScaledVector(side, 13).addScaledVector(UP, 4.5), look: top, fov: 48 } },
        // B: down past the island's edge at the cables, taut, lamps running along them
        { dur: CABLES.B, clear: false, from: { pos: door.clone().addScaledVector(out, 16).addScaledVector(side, 22).addScaledVector(UP, 1), look: under, fov: 46 },
          to: { pos: door.clone().addScaledVector(out, 16).addScaledVector(side, 19).addScaledVector(UP, 0), look: under.clone().addScaledVector(UP, -6), fov: 44 } },
        // C: his face, listening
        { dur: CABLES.C, clear: false, from: closeUp(player, { angle: 0.55, dur: CABLES.C }) },
      ],
      beats: [{ t: CABLES.swellAt, run: () => sound?.swell?.('father', top.clone()) }],
      onStart: (mm) => { mm.face = top.clone(); mm.eyes = top.clone(); },
      onFrame: (mm, t) => { mm.look = t > C0 + CABLES.SMIRK ? 'smirk' : null; },
      onEnd: () => { if (said) toast(said); },
    });
    return !!m;
  }

  return { cables };
}
