import { V, closeUp } from './film.js';

// The Signal Market's climax, filmed (src/story/moment.js): once per save, skippable, and never
// in the way (when it can't play, bazaar.js does what it always did).
//
//   broadcast  the recording slotted in, the silent tower talks again (bazaar.moment.broadcast)
//          A  wide from the square's far side, low, looking up the whole tower: its dark
//             covers lifting row by row, bottom to top                                     0.0–3.2
//          B  high up the avenue, looking back to the tower at its end: the signs facing
//             the street go white, one after another down the canyon                       3.2–5.2
//          C  from the tower's face, high over the square, looking down: the market has
//             stopped, every face turned up to the tower                                   5.2–7.2
//          D  the traveller's face, three-quarter, the white screen behind him: still,
//             listening (a quiet solemn look; no line)                                     7.2–9.6
//          sound: the father's theme swells as his face comes up (sound.swell('father')),
//          and goes on under the voice
//
// It is the lead-in, not the broadcast: the controls come back as the hiss gives way to the
// voice, and the broadcast's conversation (bazaar-data.js THINGS.broadcast, node play) opens at
// its end, skipped or watched. What it shows is applied for sure by the caller (bazaar.js play()):
// the covers lift on the cast's own clock (quicker while filmed), the street signs go white on
// B's beat and again at the end, and the conversation opens there (else the cast opens it).
//
// Show, don't tell: the traveller says nothing; his face stays still (m.look 'solemn', worn
// quietly: no mouth, no hands; src/talk-face.js). Nothing here hints past what the voice says.

export const MOMENTS = [{ id: 'bazaar.broadcast', flag: 'bazaar.moment.broadcast', beat: 'the silent tower broadcasts again' }];

// rowSecs: s per row of covers lifted while filmed (all seven inside A); whiteAt: the street signs
export const BROADCAST = { A: 3.2, B: 2.0, C: 2.0, D: 2.4, rowSecs: 0.42, whiteAt: 3.4, swellAt: 6.9 };

export function setupBazaarMoments(ctx, { moments, towerAim }) {
  const { player, sound } = ctx;
  const off = { broadcast: () => false };
  if (!moments) return off;

  /** Play it; `white()` turns the street signs white (idempotent), `onEnd()` opens the voice. */
  function broadcast({ white, onEnd } = {}) {
    const avenue = V(0, 30, -120);   // what he turns to: the white signs down the canyon, the square below
    const m = moments.play({
      id: 'bazaar.broadcast', flag: 'bazaar.moment.broadcast', dur: BROADCAST.A + BROADCAST.B + BROADCAST.C + BROADCAST.D,
      shots: [
        // A: low on the avenue where it opens into the square, the whole tower up to its crown, its covers lifting
        { dur: BROADCAST.A, clear: false, from: { pos: V(-11, 3.2, -158), look: V(0, 50, -240), fov: 60 }, to: { pos: V(-9, 3.6, -166), look: V(0, 53, -240), fov: 58 } },
        // B: high up the avenue, looking back at the tower: the signs facing the street go white
        { dur: BROADCAST.B, clear: false, from: { pos: V(-14, 28, 36), look: V(57, 62, -25), fov: 50 }, to: { pos: V(-14, 27, 30), look: V(57, 62, -30), fov: 48 } },
        // C: from the tower, high over the square, looking down: everyone has stopped, faces turned up to it
        { dur: BROADCAST.C, clear: false, from: { pos: V(0.4, 20.5, -232.6), look: V(1, 1.2, -210), fov: 46 }, to: { pos: V(0.4, 20, -232.2), look: V(1, 1.4, -208), fov: 44 } },   // (in front of the tower's ledges)
        // D: his face, still, the white screen behind him
        { dur: BROADCAST.D, clear: false, from: closeUp(player, { angle: 0.5, dur: BROADCAST.D, drop: 0.08 }) },
      ],
      beats: [
        { t: BROADCAST.whiteAt, run: () => white?.() },
        { t: BROADCAST.swellAt, run: () => sound.swell?.('father', towerAim.clone()) },
      ],
      onStart: (mm) => { mm.eyes = towerAim; },
      onFrame: (mm, t) => {
        // he looks up at the tower waking, then turns to the white screens across the market
        if (t > BROADCAST.A + BROADCAST.B) { mm.face = avenue; mm.eyes = avenue; }
        mm.look = t > BROADCAST.A + BROADCAST.B + BROADCAST.C ? 'solemn' : null;
      },
      onEnd: (mm, skipped) => { white?.(); onEnd?.(skipped); },
    });
    return !!m;
  }

  return { broadcast };
}
