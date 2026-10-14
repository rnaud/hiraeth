import { V, UP, closeUp } from './film.js';

// The Underwater City's climax, filmed (src/story/moment.js): once per save, skippable, and never in the way (when it
// can't play, nothing is lost: the whales come to the glass all the same, the temple's world change).
//
//   whales  out of the Whale-House after its keeper is calmed (underwater.moment.whales)
//           A  wide, from down the last tube: the traveller small at the makers' door, the glass arching over him,
//              the dark water beyond; the camera eases toward him                                         0.0–2.6
//           B  inside the Whale Gallery, wide, from its floor: the dome's ribs and glass, the people under it, and a
//              whale come up out of the deep against it (the beat's "back to the glass", in one frame: three panels
//              in 7.6 s before, the whale a shape in the dark water, QC v1.66)                            2.6–5.0
//           C  at the Gallery's glass: the whale close, its flank sliding past (a cut across the city: the whales
//              come to the gallery)                                                                       5.0–7.4
//           D  his face, three-quarter, turned to the glass: he listens, and the corner of his mouth goes up;
//              the controls come back with the whale still passing                                        7.4–9.6
//           sound: the father's theme in the world's mode (sound.swell('father'): the whales' answer)
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

/** s per panel; SMIRK: s into D before his mouth goes up; BACK: how far down the tube A stands (m, from the door). */
export const WHALES = { A: 2.6, B: 2.4, C: 2.4, D: 2.2, SMIRK: 0.9, BACK: 18, swellAt: 0.8 };
export const MOMENTS = [{ id: 'underwater.whales', flag: 'underwater.moment.whales', beat: 'the whales come back to the glass and sing, the light’s note first' }];

/** The Whale Gallery (src/levels/underwater.js D.gallery): its floor's middle, radius. */
export const galleryOf = (level) => ({ x: 104, y: -16, z: -108, r: 22, ...(level?.halls?.gallery ?? {}) });
/**
 * B: inside the Whale Gallery, from its floor halfway to the glass on the whale's side (`w`, a Vector3), wide and a
 * little low: the dome's ribs and glass, the people under it, and the whale come up against it; it eases forward.
 * (From the Gallery's back, or out in the sea behind the whale, the dark water swallowed it: the first tries.)
 */
export function galleryWide(G, w, t = 0, dur = WHALES.B) {
  const gc = V(G.x, G.y, G.z), to = w.clone().sub(gc).setY(0).normalize(), side = V(to.z, 0, -to.x);
  const k = Math.min(1, t / dur);
  return {
    pos: gc.clone().addScaledVector(to, G.r * (0.2 + 0.08 * k)).addScaledVector(side, -3).addScaledVector(UP, 1.2),
    look: w.clone(),
    fov: 50 - 2 * k,
  };
}

export function setupUnderwaterMoments(ctx, { rt, level }) {
  const { player, sound, moments, toast = () => {} } = ctx;
  const off = { whales: () => false };
  if (!moments || !rt?.outside?.door) return off;

  /** The whales come back, seen from the tube: `said` its toast at the end. True if it plays. */
  function whales({ said = null } = {}) {
    const O = rt.outside, door = O.door.at, h = O.door.heading;
    const out = V(Math.sin(h), 0, Math.cos(h)), side = V(out.z, 0, -out.x);
    // (B and C are seen from the Whale Gallery, where the whales come to the glass: from the tube at the house they swam
    //  150 m off, dots in the dark: the cinematics QC, v1.43); the whale nearest the gallery's glass, as it passes
    const G = galleryOf(level), gc = V(G.x, G.y, G.z);
    const nearest = () => (level?.whales ?? []).reduce((b, w) => (!b || w.position.distanceTo(gc) < b.position.distanceTo(gc) ? w : b), null);
    const at = () => nearest()?.position.clone() ?? door.clone().addScaledVector(side, 30).addScaledVector(UP, 6);
    const galleryEye = (w) => gc.clone().addScaledVector(w.clone().sub(gc).setY(0).normalize(), G.r - 8).addScaledVector(UP, 2.4);
    const B0 = WHALES.A, C0 = B0 + WHALES.B, D0 = C0 + WHALES.C;
    const m = moments.play({
      id: 'underwater.whales', flag: 'underwater.moment.whales', dur: D0 + WHALES.D,
      shots: [
        // A: wide, down the tube: the door, the arch of glass, him small before it
        { dur: WHALES.A, from: { pos: door.clone().addScaledVector(out, WHALES.BACK).addScaledVector(side, 1.6).addScaledVector(UP, 2.6), look: door.clone().addScaledVector(UP, 2.2), fov: 50 },
          to: { pos: door.clone().addScaledVector(out, WHALES.BACK - 5).addScaledVector(side, 1.2).addScaledVector(UP, 2.4), look: door.clone().addScaledVector(UP, 2.0), fov: 46 } },
        // B: the Gallery, wide from its floor: the dome, the people under it, the whale against the glass
        { dur: WHALES.B, clear: false, from: (t) => galleryWide(G, at(), t) },
        // C: at the Gallery's glass, the whale passing close outside it
        { dur: WHALES.C, clear: false, from: (t) => { const w = at(); return { pos: galleryEye(w), look: w, fov: 50 - t * 2 }; } },
        // D: his face, turned to it
        { dur: WHALES.D, clear: false, from: closeUp(player, { angle: 0.6, dur: WHALES.D }) },
      ],
      beats: [{ t: WHALES.swellAt, run: () => sound?.swell?.('father', door.clone()) }],
      onStart: (mm) => { level?.whaleToGlass?.(C0 + WHALES.C * 0.4); mm.face = at(); mm.eyes = at(); },   // (passing the glass through B and C: staged while A looks down the tube)
      onFrame: (mm, t) => { mm.look = t > D0 + WHALES.SMIRK ? 'smirk' : null; mm.eyes = at(); },
      onEnd: () => { if (said) toast(said); },
    });
    return !!m;
  }

  return { whales };
}
