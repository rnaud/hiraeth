import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { NOTCHES } from '../shaft-mirrors.js';
import { quietOr } from '../hint-level.js';

// The light that goes down, played (issue #169: src/shaft-mirrors.js builds the mirrors and lays the beam out).
// The great mirror on the rim throws the sun across the shaft to the bell quarter's mirrors; three of them were knocked
// round on their rings, and the light stops at the first, thrown at the wall. Each mirror's crank turns its frame a
// notch (eight round); at the right one its beam lands on the next mirror down, and when the last throws it onto the
// little square on the bottom terrace, the light is back down there: the quest's goal is to go and stand in it, and
// the makers' chest that sat cold in the shade there opens (src/boxes/placements.js incal.sunglass).
//
// Quest incal.beam (incal-data.js): it starts as you come near a mirror (or turn one). Locators: 'beam' (the mirror
// the light stops at; the square once it is down), 'beamEnd' (the square). Flags: incal.beam.<mirror id> (its notch),
// incal.beam.lit (the light reaches the square).

export const BQ = 'incal.beam';
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function setupLightDown(ctx, { mirrors }) {
  const { player, quests, game, sound, toast } = ctx;
  if (!mirrors?.places?.length || !mirrors.end) return null;
  const places = mirrors.places, end = mirrors.end, turnable = places.filter((m) => m.turnable);
  const notch = (m) => { const n = game.flag(`incal.beam.${m.id}`); return Number.isFinite(n) ? ((n % NOTCHES) + NOTCHES) % NOTCHES : m.start; };
  mirrors.set(Object.fromEntries(turnable.map((m) => [m.id, notch(m)])));
  const st = { said: {}, bob: new Map() };
  const once = (k, text) => { if (st.said[k]) return; st.said[k] = true; toast(text); };
  const lit = () => !!game.flag('incal.beam.lit');
  /** Does mirror i get the light (the chain reaches it)? */
  const reached = (i, c = mirrors.chain()) => c.done || i <= c.stop;
  const start = () => { if (!quests.isStarted(BQ)) quests.start(BQ); };

  const turn = (m) => {
    start();
    const i = places.indexOf(m), n = (notch(m) + 1) % NOTCHES;
    game.set(`incal.beam.${m.id}`, n);
    const c = mirrors.set({ [m.id]: n });
    st.bob.set(m.id, 0.4);
    sound?.critter?.('clack', 0.7);
    if (c.done && !lit()) {
      game.set('incal.beam.lit', true);
      sound?.chime?.();
      toast('The light falls all the way to the bottom terrace. Doors open into it.');
    } else if (!reached(i, c)) once(`dark.${m.id}`, quietOr('The frame turns a notch. No light reaches it yet.', 'The frame turns. No light yet: the mirror above throws it elsewhere.'));
    else if (n === 0 && i < (c.done ? places.length : c.stop)) { sound?.chime?.(); toast('Click. The beam lands on the next mirror down.'); }
    else once(`swing.${m.id}`, quietOr('The frame grinds round a notch. Its beam swings across the shaft.', 'The beam swings across the shaft. Turn it onto the mirror below.'));
  };
  for (const m of turnable) {
    const at = m.crank.clone().add(V(0, 1.1, 0));
    registerInteractable({ id: `incal.beam.${m.id}`, priority: PRIORITY.use, range: 2.6, prompt: 'turn the mirror’s crank', at: () => at,
      distance: (p) => (Math.abs(p.pos.y - m.y) < 2.5 ? flat(p.pos, m.crank) : Infinity), use: () => turn(m) });
  }
  // the scout finds the mirror the light has stopped at, then the square
  quests.locate('beam', () => { const c = mirrors.chain(); return c.done ? end.at : places[c.stop]?.crank ?? end.at; });
  quests.locate('beamEnd', () => end.at);

  function update(dt) {
    const pp = player.pos;
    // near a mirror (or on its deck), the errand starts: the light is there to be followed
    if (!quests.isStarted(BQ)) for (const m of places) if (flat(pp, m.deck) < (m.great ? 12 : 14) && Math.abs(pp.y - m.y) < 6) { start(); break; }
    // a turned frame jolts on its ring
    for (const [id, k] of st.bob) {
      const h = mirrors.heads.find((x) => x.m.id === id);
      const left = Math.max(0, k - dt);
      if (h) h.tilt.position.y = Math.sin(left * 40) * 0.02;
      if (left <= 0) st.bob.delete(id); else st.bob.set(id, left);
    }
  }
  return { turn, update, notch, reached, state: st };
}
