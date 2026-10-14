import { V, UP, closeUp } from './film.js';

// The Moon Foundry's climax, filmed (src/story/moment.js): once per save, skippable, never in the way (when it can't
// play, nothing is lost: the Casting-House's change shows all the same, src/temples/moonfoundry.js).
//
//   moon  out of the Casting-House after the Last Founder is stopped (moonfoundry.moment.moon)
//         A  wide, from the floor toward the house: its tower under the hangar's roof, the traveller small at its
//            door; the camera eases in                                                                  0.0–2.6
//         B  low under the jib over the door: the last moon, whole, rises from the door's foot onto the hook (the
//            change's show(): the lift waits for the film)                                              2.6–5.0
//         C  up at the hung moon over the floor: it turns slowly round on its crown toward the house (the change's
//            turn(): the beat's second half, said and never shown before; three panels in 7.4 s, QC v1.66)  5.0–7.4
//         D  his face, three-quarter, turned up to it: the corner of his mouth goes up; the controls come back
//            with the moons still turning                                                               7.4–9.6
//         sound: the father's theme in the world's mode (sound.swell('father'))
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into D before his mouth goes up; BACK: how far from the door A stands (m); TURN: s before C the hung moons start round. */
export const MOON = { A: 2.6, B: 2.4, C: 2.4, D: 2.2, SMIRK: 0.8, BACK: 32, TURN: 0.8, swellAt: 0.7 };
export const MOMENTS = [{ id: 'moonfoundry.moon', flag: 'moonfoundry.moment.moon', beat: 'the last moon is lifted out of its mould onto a hook, and every hung moon turns to it' }];

/**
 * B: out from the door's foot under the jib and a little to the side, low, looking up the way the moon goes from the
 * foot to the hook (`at()`: where it is now), easing up with it. O: the Casting-House outside (kit, foot, hook).
 * Returns { from(t), eye(k) }.
 */
export function liftShot(O, at, dur = MOON.B) {
  const c = O.kit.world(0, 0, 0), foot = O.foot, hook = O.hook;
  const radial = V(foot.x - c.x, 0, foot.z - c.z).normalize(), across = V(radial.z, 0, -radial.x);
  const eye = (k) => foot.clone().addScaledVector(radial, 10 - k).addScaledVector(across, 3.5).setY(foot.y + 1.6 + 0.4 * k);
  return {
    eye,
    from: (t) => {
      const k = Math.min(1, t / dur), m = at?.() ?? hook;
      return { pos: eye(k), look: m.clone().lerp(hook, 0.3).addScaledVector(UP, -0.6), fov: 40 - 2 * k };
    },
  };
}

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
    // (the change: the whole moon on its way to the hook, the hung moons' turn: src/temples/moonfoundry.js)
    const ch = rt.change, newMoon = ch?.moon ?? null;
    const lift = O.foot && O.hook && O.kit ? liftShot(O, () => newMoon?.getWorldPosition(V(0, 0, 0)) ?? null) : null;
    const B0 = MOON.A, C0 = B0 + (lift ? MOON.B : 0), D0 = C0 + MOON.C;
    const m = moments.play({
      id: 'moonfoundry.moon', flag: 'moonfoundry.moment.moon', dur: D0 + MOON.D,
      shots: [
        // A: wide, out on the floor: the house's tower, him small at its door
        { dur: MOON.A, from: { pos: door.clone().addScaledVector(out, MOON.BACK).addScaledVector(side, -10).addScaledVector(UP, 5), look: top, fov: 50 },
          to: { pos: door.clone().addScaledVector(out, MOON.BACK - 5).addScaledVector(side, -8).addScaledVector(UP, 5.5), look: top, fov: 46 } },
        // B: under the jib, the last moon rising onto its hook
        ...(lift ? [{ dur: MOON.B, clear: false, from: (t) => lift.from(t) }] : []),
        // C: up at the hung moon from the floor on the house's side of it, far enough to see it whole on its hook as it
        // turns toward the house (from under it, 37 m off, it filled the frame: the cinematics QC, v1.43)
        { dur: MOON.C, clear: false, from: { pos: hung.clone().addScaledVector(toHouse, 52).setY(floor + 4), look: hung, fov: 46 },
          to: { pos: hung.clone().addScaledVector(toHouse, 47).setY(floor + 5), look: hung.clone().addScaledVector(UP, 2), fov: 44 } },
        // D: his face, turned up to it
        { dur: MOON.D, clear: false, from: closeUp(player, { angle: 0.5, dur: MOON.D }) },
      ],
      beats: [
        { t: MOON.swellAt, run: () => sound?.swell?.('father', top.clone()) },
        // the lift (5 s when filmed) ends as B does; the hung moons start round a little before C
        { t: 0, run: () => ch?.show?.() },
        { t: Math.max(0, C0 - MOON.TURN), run: () => ch?.turn?.() },
      ],
      onStart: (mm) => { mm.face = hung.clone(); mm.eyes = hung.clone(); },
      onFrame: (mm, t) => { mm.look = t > D0 + MOON.SMIRK ? 'smirk' : null; },
      onEnd: () => { ch?.show?.(); ch?.turn?.(); if (said) toast(said); },   // (skipped: they still go)
    });
    return !!m;
  }

  return { moon };
}
