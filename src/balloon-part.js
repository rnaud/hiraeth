// The speech balloons over people, as data (issue #430): who greets you with one this frame, and the balloons up as the
// screen's 'balloons' part (src/platform.js screen), which an engine draws (BridgeHud.cs DrawBalloons) where the page
// places its own .balloon elements (src/npc.js, src/aliens/alien.js, src/crowd.js placeBalloon). main.js and
// engine/game.js both choose and publish through here, so the two can't drift apart.
//
//   pickBalloon(npcs, { player, talk, filming, greet })  the one person whose balloon shows (the nearest who talks)
//   balloonData(line, at, { lift, kind })                 one balloon: its words, the world point over the head, the lift
//   publishBalloons([...people, crowd])                   each one's `balloonUp` (set by its placeBalloon) as the part

import { screen } from './platform.js';
import { keyText } from './prompt-keys.js';
import { stripTone } from './story/tone.js';
import { markShape, showsMark } from './makers-mark/shape.js';

/**
 * Only the nearest talking person shows a balloon (main.js): none while a ship's scene or a panel has the screen
 * (`talk` false), while a moment is filmed only a shout it asked for (`filming`), and a greeting waits while a notice is
 * up or waiting (`greet` false, issue #78); a shout a scene asked for still comes.
 */
export function pickBalloon(npcs, { player, talk = true, filming = false, greet = true } = {}) {
  if (!talk || !player) return null;
  let best = null, bd = Infinity;
  for (const n of npcs) {
    if (!n.talking || !((!filming && greet) || (n.shout && n.time < n.shout.until))) continue;
    const d = n.pos.distanceTo(player.pos);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

const r2 = (v) => Math.round(v * 100) / 100;
/**
 * One balloon as data: its words (the tone's tag off, a {key:…} as the input in hand; *highlights* and {glyph} kept for
 * the renderer's own type), the world point it hangs over ([x, y, z]), `lift` px more (an E prompt over the same head),
 * `kind` 'shout' for a crowd person's (placed without the page's keep-on-screen).
 */
export function balloonData(line, at, { lift = 0, kind = '' } = {}) {
  const text = keyText(String(stripTone(line ?? '')));
  // (a {glyph}: the makers' mark's own contours with it, for an engine to fill; issue #513)
  return { text, at: [r2(at.x), r2(at.y), r2(at.z)], lift, kind, ...(showsMark(text) ? { mark: markShape() } : {}) };
}

/** The balloons up (each source's `balloonUp`, set as it placed its own) as the screen's 'balloons' part, or null. */
export function publishBalloons(sources) {
  const list = [];
  for (const s of sources) if (s?.balloonUp) list.push(s.balloonUp);
  screen.set('balloons', list.length ? list : null);
  return list;
}
