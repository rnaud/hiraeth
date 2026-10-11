import { V, UP, closeUp } from './film.js';
import { CABLES as CABLE_ENDS } from '../temples/spacecity.js';

// The City Floating in Space's climax, filmed (src/story/moment.js): once per save, skippable, never in the way (when
// it can't play, nothing is lost: the cables draw taut all the same, the temple's change, src/temples/spacecity.js).
//
//   cables  out of the Mooring-House after the Anchor-Warden is resolved (spacecity.moment.cables)
//           A  wide, from out over the void beside the Moorings' bridge: the house on its island, the traveller
//              small at its door, the stars under it all; the camera eases in                          0.0–2.6
//           B  out over the void beside the great cable to the Towers: drawn taut, its lamps running along it
//              toward the city                                                                          2.6–5.2
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
    // (the great cable from the capstan on the roof to the Towers' pipe stack, src/temples/spacecity.js CABLES)
    const roof = O.top?.clone() ?? top.clone(), stack = V(...CABLE_ENDS[0]);
    const along = (t) => roof.clone().lerp(stack, t).addScaledVector(UP, -2.5 * Math.sin(Math.PI * t));
    const across = stack.clone().sub(roof).setY(0).normalize(); across.set(across.z, 0, -across.x);
    const B0 = CABLES.A, C0 = B0 + CABLES.B;
    const m = moments.play({
      id: 'spacecity.cables', flag: 'spacecity.moment.cables', dur: C0 + CABLES.C,
      shots: [
        // A: wide, out over the void: the house on its island, him small at its door
        { dur: CABLES.A, from: { pos: door.clone().addScaledVector(out, CABLES.OUT).addScaledVector(side, 16).addScaledVector(UP, 4), look: top, fov: 52 },
          to: { pos: door.clone().addScaledVector(out, CABLES.OUT - 5).addScaledVector(side, 13).addScaledVector(UP, 4.5), look: top, fov: 48 } },
        // B: out over the void beside the great cable to the Towers, taut, its lamps running away along it toward the city
        // (it looked down at the island's underside, where no cable runs: the cinematics QC, v1.43)
        { dur: CABLES.B, clear: false, from: { pos: along(0.22).addScaledVector(across, 9).addScaledVector(UP, -3), look: along(0.75), fov: 50 },
          to: { pos: along(0.3).addScaledVector(across, 8).addScaledVector(UP, -2.5), look: along(0.85), fov: 46 } },
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
