import { registerInteractable, PRIORITY } from '../interact.js';
import { THINGS } from './arzach-data.js';
import { riderHour } from '../vael-sundial.js';

// Vael's explorations alive (issue #187; the level builds them: src/vael-canyon.js, src/vael-sundial.js, src/vael-edge.js).
// The riders' hour turns with the story (riderHour: the wings, the bird's answer, the bell), and the sun swings round
// to it, the tower's shadow sweeping across the plain to lie the way on; the hour stone it lies on lights its lamp.
// Call into a stone ear of the riders' road and the whisper runs on ahead, round the bends to the tower. The first of
// the stones that rise lifts under you the first time: one line says so. Things to look at: the ears, the hour stones,
// the first broken slab, the highest stone.
//
//   setupVaelExplorations(ctx) → { update(dt, t), hour() } (null without them)

/** The one line when the hour turns (the sun swings round), and the first time a stone lifts under you. */
export const SWING_CUE = 'The tower’s shadow swings round across the plain.';
export const RISE_CUE = 'The stone lifts under your feet.';

export function setupVaelExplorations(ctx) {
  const { level, dialogue, game, toast, player } = ctx;
  const A = level.arzach;
  if (!A?.road || !A?.sundial || !A?.edge) return null;
  const { road, sundial: D, edge: E } = A;
  const flag = (k) => game.flag(k);
  const look = (def, s, { range = 3.4, prompt, height = 4, use } = {}) => registerInteractable({
    id: `${def.id}.${s.at.x.toFixed(0)}.${s.at.z.toFixed(0)}`, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ').replace(/^A /, 'a ')}`,
    at: () => s.stand, distance: (p) => (Math.abs(p.pos.y - s.stand.y) < height ? Math.hypot(p.pos.x - s.stand.x, p.pos.z - s.stand.z) : Infinity),
    use: use ?? (() => dialogue.start(def, null, s.stand.clone(), s.look.clone())),
  });
  // the ears: lean in and whisper; it runs on ahead toward the tower
  road.ears.forEach((e, i) => look(THINGS.ear, e, { range: 3.6, prompt: 'whisper into the ear', use: () => { road.echo(i); dialogue.start(THINGS.ear, null, e.stand.clone(), e.look.clone()); } }));
  // the hour stones: what the shadow is doing there now
  for (const h of D.hours) look(THINGS.hourstone, h, { range: 3.2, prompt: 'look at the hour stone', use: () => { game.set('arzach.hour.here', D.lit(h)); dialogue.start(THINGS.hourstone, null, h.stand.clone(), h.look.clone()); } });
  look(THINGS.broken, E.broken, { range: 5, prompt: 'look at the broken slab' });
  look(THINGS.highstone, E.high, { range: 3.4, prompt: 'look back at the plain' });

  // the riders' hour: set at once as the world loads (a save past it finds the sun where it was), swung after
  D.update(0, 0, flag);
  let lastHour = D.sun.hour, risen = !!flag('arzach.stone.rose');
  // (the sun waits while you are in a house far overhead: the shadow sweeps the plain once you are out on it again)
  const outside = () => !player?.pos || player.pos.y < 1000;
  const update = (dt, t) => {
    D.update(dt, t, outside() ? flag : null);
    if (D.sun.hour !== lastHour) { toast(SWING_CUE); lastHour = D.sun.hour; }
    if (!risen && E.risers.some((q) => q.on && q.h > 0.6)) { risen = true; game.set('arzach.stone.rose', true); toast(RISE_CUE); }
  };
  return { update, hour: () => riderHour(flag), player };
}
