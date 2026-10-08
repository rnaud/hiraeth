import { V, UP, closeUp, orbit, from, turn, facing } from './film.js';

// The Garden of Spheres' climax, filmed (src/story/moment.js): once per save, skippable, and
// never in the way (when it can't play, spheres.js does what it always did).
//
//   chord  the pole, splashed with the three sounds, sings them back (spheres.moment.chord)
//          A  wide, low across the plaza's rings: the pole, its crown lit, the traveller small
//             at its foot as the first ring of light runs out over the stone                0.0–2.4
//          B  high over the plaza, turning slowly: ring after ring running out across the
//             concentric stones to the cypresses                                             2.4–4.6
//          C  low behind the pole, a long lens down the garden to the horizon: the great
//             sphere answering, its halo standing up round it                                4.6–6.6
//          D  the traveller's face, three-quarter: he watches the halo, and the corner of
//             his mouth goes up (a slight smirk; no line)                                    6.6–8.6
//          sound: the pole's own tune (Sound.spheresSong, the bell carrying it: the caller
//          plays it), and as its last note lands the world's motif, the glass bell's phrase,
//          swells over it (sound.swell('motif')); the controls come back while the halo is
//          still up and the rings still run, before the pole's band takes up the chord.
//
// What it shows is applied for sure by the caller (spheres.js chord()): the flag, the band, the
// song, the rings and the halo are all started before its first frame and run on their own
// clock (st.chordT); the toast that used to come at once is said at its end.
//
// Show, don't tell: the traveller says nothing, and reacts with his face only, a slight smirk
// at most (m.look 'smirk': worn quietly, no mouth and no hands; src/talk-face.js).

export const MOMENTS = [{ id: 'spheres.chord', flag: 'spheres.moment.chord', beat: 'the pole rings with the three spheres’ chord' }];

// swellAt: as the song's last, long note rings (SPHERES_SONG lands at ~7.8 s); SMIRK: s into D
export const CHORD = { A: 2.4, B: 2.2, C: 2.0, D: 2.0, swellAt: 7.0, SMIRK: 0.9 };

export function setupSpheresMoments(ctx, { moments, G }) {
  const { player, sound } = ctx;
  const off = { chord: () => false };
  if (!moments || !G?.plaza) return off;
  const Pz = G.plaza, Gr = G.great;

  function chord(onEnd) {
    const pole = V(Pz.x, Pz.inner, Pz.z), top = V(Pz.x, Pz.top, Pz.z);
    const great = Gr ? V(Gr.x, Gr.y, Gr.z) : V(Pz.x, Pz.top + 40, Pz.z - 700);
    // which way from the pole he stands (he splashed it from the rings), and which way the great sphere is
    const away = V(player.pos.x - pole.x, 0, player.pos.z - pole.z);
    const d = away.lengthSq() > 1 ? away.normalize() : facing(player).negate();
    const g = V(great.x - pole.x, 0, great.z - pole.z).normalize();
    const out = Math.hypot(player.pos.x - pole.x, player.pos.z - pole.z);
    const a = Math.atan2(d.x, d.z);
    // A: beyond him across the rings, well to his side, the pole and its crown in the frame with him
    const wideFrom = from(pole, turn(d, 0.75), { dist: Math.max(16, out + 12), h: 2.4, lookUp: 4.2, fov: 52 });
    const wideTo = from(pole, turn(d, 0.66), { dist: Math.max(14, out + 10), h: 2.2, lookUp: 4.6, fov: 50 });
    // C: low behind the pole on the near side, off to the side he doesn't stand on, looking past it down the garden at
    // the great sphere's upper half (its centre is far below the horizon) and the halo standing round it
    const side = V(-g.z, 0, g.x), s = Math.sign(side.dot(away)) || 1;
    const lens = pole.clone().addScaledVector(g, -15).addScaledVector(side, -6 * s).addScaledVector(UP, 2.4);
    const sky = Gr ? great.clone().addScaledVector(UP, Gr.R * 0.55) : great;
    const lensLook = lens.clone().addScaledVector(sky.clone().sub(lens).normalize(), 60);
    const m = moments.play({
      id: 'spheres.chord', flag: 'spheres.moment.chord', dur: CHORD.A + CHORD.B + CHORD.C + CHORD.D,
      shots: [
        // A: wide and low across the plaza: the pole, its crown, him at its foot, the first ring running out
        { dur: CHORD.A, clear: false, from: wideFrom, to: wideTo },   // (open stone: and a ray from the pole itself would start inside it)
        // B: high over the rings, turning slowly as they run out over the stones
        { dur: CHORD.B, clear: false, from: orbit({ at: pole, r: 24, h: 24, a0: a - 0.9, a1: a - 0.55, dur: CHORD.B, fov: 54, fov1: 56 }) },
        // C: past the pole down the garden to the horizon, the great sphere's halo standing up
        { dur: CHORD.C, clear: false, from: { pos: lens, look: lensLook, fov: 34 }, to: { pos: lens.clone().addScaledVector(UP, 0.4), look: lensLook.clone().addScaledVector(UP, 0.8), fov: 31 } },
        // D: his face, turned to the horizon
        { dur: CHORD.D, clear: false, from: closeUp(player, { angle: 0.5, dur: CHORD.D, dist: 1.25, drop: 0.1 }) },
      ],
      beats: [
        { t: CHORD.swellAt, run: () => sound.swell?.('motif', top.clone()) },
      ],
      onStart: (mm) => { mm.eyes = top; mm.face = top; },
      onFrame: (mm, t) => {
        const C0 = CHORD.A + CHORD.B;
        // he watches the crown and the rings, then turns to the horizon as the great sphere answers
        if (t > C0 - 0.6) { mm.face = sky; mm.eyes = sky; } else if (t > CHORD.A) mm.eyes = pole.clone().addScaledVector(d, 8);
        mm.look = t > C0 + CHORD.C + CHORD.SMIRK ? 'smirk' : null;
      },
      onEnd: () => { onEnd?.(); },
    });
    return !!m;
  }

  return { chord };
}
