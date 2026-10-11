import { V, UP, closeUp } from './film.js';

// The Moon Foundry's climax, filmed (src/story/moment.js): once per save, skippable, never in the way (when it can't
// play, nothing is lost: the Casting-House's change shows all the same, src/temples/moonfoundry.js).
//
//   moon  out of the Casting-House after the Last Founder is stopped (moonfoundry.moment.moon)
//         A  wide, from the floor toward the house: its tower under the hangar's roof, the traveller small at its
//            door; the camera eases in                                                                  0.0–2.6
//         B  up at the hung moon over the floor: it turns slowly on its hook, toward the house            2.6–5.2
//         C  his face, three-quarter, turned up to it: the corner of his mouth goes up; the controls come back
//            with the moon still turning                                                                5.2–7.4
//         sound: the father's theme in the world's mode (sound.swell('father'))
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into C before his mouth goes up; BACK: how far from the door A stands (m). */
export const MOON = { A: 2.6, B: 2.6, C: 2.2, SMIRK: 0.8, BACK: 32, swellAt: 0.7 };
export const MOMENTS = [{ id: 'moonfoundry.moon', flag: 'moonfoundry.moment.moon', beat: 'the last moon is lifted out of its mould onto a hook, and every hung moon turns to it' }];

export function setupMoonFoundryMoments(ctx, { rt, level }) {
  const { player, sound, moments, toast = () => {} } = ctx;
  const off = { moon: () => false };
  if (!moments || !rt?.outside?.door) return off;

  /** The moons turn to the house, seen from the floor: `said` its toast at the end. True if it plays. */
  function moon({ said = null } = {}) {
    const O = rt.outside, door = O.door.at, h = O.door.heading;
    const out = V(Math.sin(h), 0, Math.cos(h)), side = V(out.z, 0, -out.x);
    const hung = level?.hung ? V(level.hung.x, level.hung.y, level.hung.z) : door.clone().addScaledVector(out, 60).addScaledVector(UP, 40);
    const top = door.clone().addScaledVector(UP, 16);
    const toHouse = door.clone().sub(hung).setY(0).normalize(), floor = door.y;
    const B0 = MOON.A, C0 = B0 + MOON.B;
    const m = moments.play({
      id: 'moonfoundry.moon', flag: 'moonfoundry.moment.moon', dur: C0 + MOON.C,
      shots: [
        // A: wide, out on the floor: the house's tower, him small at its door
        { dur: MOON.A, from: { pos: door.clone().addScaledVector(out, MOON.BACK).addScaledVector(side, -10).addScaledVector(UP, 5), look: top, fov: 50 },
          to: { pos: door.clone().addScaledVector(out, MOON.BACK - 5).addScaledVector(side, -8).addScaledVector(UP, 5.5), look: top, fov: 46 } },
        // B: up at the hung moon from the floor on the house's side of it, far enough to see it whole on its hook as it
        // turns toward the house (from under it, 37 m off, it filled the frame: the cinematics QC, v1.43)
        { dur: MOON.B, clear: false, from: { pos: hung.clone().addScaledVector(toHouse, 52).setY(floor + 4), look: hung, fov: 46 },
          to: { pos: hung.clone().addScaledVector(toHouse, 47).setY(floor + 5), look: hung.clone().addScaledVector(UP, 2), fov: 44 } },
        // C: his face, turned up to it
        { dur: MOON.C, clear: false, from: closeUp(player, { angle: 0.5, dur: MOON.C }) },
      ],
      beats: [{ t: MOON.swellAt, run: () => sound?.swell?.('father', top.clone()) }],
      onStart: (mm) => { mm.face = hung.clone(); mm.eyes = hung.clone(); },
      onFrame: (mm, t) => { mm.look = t > C0 + MOON.SMIRK ? 'smirk' : null; },
      onEnd: () => { if (said) toast(said); },
    });
    return !!m;
  }

  return { moon };
}
