import * as THREE from 'three';
import { hintLinesOpen, hintLevel } from '../hint-level.js';

// The drone's hints in a guardian's fight (src/scout.js: a ping while a guardian is awake and you are
// in its hall asks for one instead of the objective). Each temple has, for each of its guardian's
// phases, three lines: a nudge, then plainer, then plainest (each ping on the same phase says the
// next); and where the drone turns its lens: the weak point, or the thing to use (at(g, phase), a
// world position; the guardian's own weak point, model.mouth, when there is no at). The gentle way
// first wherever the game has one: the living guardians are calmed, never hurt.
//
//   guardianHint(rt)  { id, lines, at } for the scout's getHint (main.js), or null
//   openHint(h, secs) the hint as the hint level lets it out: subtle, the lines one by one after a struggle

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _p = V();

/** The nearest of the pieces `ids` that is not lit yet (a brazier, a bed), from where you are; null if all are. */
function nearestUnlit(g, ids) {
  const rt = g.rt, P = rt.player;
  let best = null, bd = Infinity;
  for (const id of ids) {
    const piece = rt.piece?.(id);
    if (!piece?.center || rt.logic?.isLit?.(id)) continue;
    const d = P ? piece.center.distanceTo(P.pos) : 0;
    if (d < bd) { bd = d; best = piece.center; }
  }
  return best;
}

/** The nearest of the pieces `ids` (their positions: pos or center) to a point. */
function nearestPiece(g, ids, to) {
  let best = null, bd = Infinity;
  for (const id of ids) {
    const p = g.rt.piece?.(id), at = p?.pos ?? p?.center;
    if (!at) continue;
    const d = at.distanceTo(to);
    if (d < bd) { bd = d; best = at; }
  }
  return best;
}

/** The vent the guardian hides from you: the one farthest from where you stand (model.vent(i)). */
function hiddenVent(g, n) {
  const P = g.rt.player;
  let best = null, bd = -1;
  for (let i = 0; i < n; i++) {
    const at = g.model.vent?.(i, V());
    if (!at) continue;
    const d = P ? at.distanceTo(P.pos) : i;
    if (d > bd) { bd = d; best = at; }
  }
  return best;
}

export const BOSS_HINTS = {
  // the Rose House: the Keeper of the cistern (organic: calmed)
  desert: {
    phases: [
      ['It is scared of the dark. Light the fire bowls round the walls.',
        'Cut a ball loose on a spoke: it rolls through a small fire and lights a bowl at the edge.',
        'Cut the ball free on each spoke. It rolls through a small fire and lights a covered bowl. Each lit bowl calms it.'],
      ['It is thirsty. When it pants, give it water.',
        'When its mouth hangs open, splash water in it. A burning ball rolled at it makes it pant too.',
        'Block its charge with your guard and it pants: splash water in its mouth. Or roll a burning ball at it.'],
      ['Now it only pants for a moment. Be quick with the water.',
        'Splash water the moment it pants. A burning ball rolled at it makes it pant longer.',
        'Cut loose the ball nearest it: it rolls past a lit bowl and catches fire. Near the flame it pants longer. Splash it.'],
    ],
    // (from its second phase: the spoke ball nearest it, to roll in to it)
    at: (g, i) => (i === 0 ? nearestUnlit(g, ['b6', 'b7', 'b8', 'b9']) : nearestPiece(g, ['kb1', 'kb2', 'kb3', 'kb4'], g.model.pos)),
  },
  // the Warden's Well: the warden (a robot: it can only be broken)
  incal: {
    phases: [
      ['After its eye beam sweeps the floor, its side vents open. Shoot them.',
        'Stay out of its eye beam. When the vents glow open, shoot them.',
        'Step out of the beam’s path, then shoot the glowing vents while they are open. Four hits.'],
      ['Its sides are shut now. Aim for the hatch on its crown, at the very top.',
        'Blow the fan at the vane behind it. The wind holds its crown hatch open and lifts you above it.',
        'Swing the fan ({key:fire}) at the vane it backs onto. Ride the wind up to its crown and shoot down into the hatch.'],
      ['Its crown hatch stays shut now unless the vane under it turns.',
        'Make the vane under it turn: blow on it with the fan.',
        'Swing the fan ({key:fire}) at the vane under it until the hatch lifts, then shoot down into it.'],
    ],
    // (from its second phase, the hatch open: the vane it backs onto)
    at: (g, i) => (i >= 1 && g.state === 'open' && g.rt.hallVanes?.length ? nearestPiece(g, g.rt.hallVanes.map((v) => v.id), g.model.pos) : null),
  },
  // the Elder's roost (organic: calmed by flying with her)
  arzach: {
    phases: [
      ['She is afraid to fly alone. Fly with her.',
        'When she spreads her wings and looks up, fly up beside her.',
        'Ride the wind up from the middle of the hall. Glide close around her while her wings are spread.'],
      ['She is in the air now. Go up with her.',
        'When she hovers over a vent, fly in its wind beside her.',
        'While she hovers over a vent, ride that vent’s wind up beside her. It counts double.'],
      ['She only hovers where the wind blows. Make it blow by her.',
        'Block the other vent with the stone, and the wind rises from the vent by her.',
        'Push the stone on the floor into the vent away from her. Then open your wings in the wind by her.'],
    ],
    // (from her second phase: the stone, while the wind rises from the vent away from her)
    at: (g, i) => {
      if (g.state !== 'open') return g.arena.center;
      const w = i >= 1 ? g.rt.roostWinds?.slice().sort((a, b) => a.foot.distanceTo(g.model.pos) - b.foot.distanceTo(g.model.pos))[0] : null;
      if (w && !w.on) return g.rt.piece?.('ballR')?.center ?? g.arena.center;
      return _p.copy(g.model.pos).addScaledVector(UP, 4.4);
    },
  },
  // the Founders' Belfry: the Cloud-Mother (organic: answered with a bell, its ring hooked: issue #377)
  arzach2: {
    phases: [
      ['She cries out. Answer her with a bell.',
        'When she sinks low and cries, ring the bell nearest her.',
        'While she cries, hook the ring under the bell nearest her ({key:aim}, then {key:fire}). The hook, not water or a push.'],
      ['She is crying again. Ring the bell nearest her.',
        'Each time she cries, ring the bell nearest her.',
        'Each time she sinks low and cries, hook the ring of the bell nearest her ({key:aim}, then {key:fire}).'],
    ],
    // (the drone's lens on the hall's bell nearest her: what to hook)
    at(g) {
      const bells = (g.rt.pieces ?? []).filter((p) => p.id?.startsWith?.('hb.hall.'));
      if (!bells.length) return null;
      return bells.reduce((a, b) => (a.at.distanceTo(g.model.pos) <= b.at.distanceTo(g.model.pos) ? a : b)).at.clone();
    },
  },
  // the First Garage: the Clockwork Foreman (a robot: it can only be stopped)
  garage: {
    phases: [
      ['After it strikes, the glass over its face opens.',
        'When the glass over its face swings up, hit all six numbers inside, quickly, before it shuts.',
        'Let it strike. Aim the boomerang at three numbers ({key:aim}), throw it ({key:fire}), then splash the other three.'],
      ['Its face still opens after a strike. Hit the six numbers again.',
        'All six numbers again, quickly. Keep away from its flying cogs.',
        'Dodge the cogs. After its hammer or its chime, hit all six numbers before the glass comes down.'],
    ],
  },
  // the Engine-House: the Tooth-Warden (a robot: it can only be stopped)
  buried: {
    phases: [
      ['After its beam, four vents open. One is on its far side.',
        'Hit all four vents quickly. Your tank holds three shots: throw a bomb for the ones you can’t splash.',
        'As its vents open, throw a bomb at its feet ({key:fire}), then splash the vents its blast missed.'],
      ['Now it spins on the big gear in the floor. Jam the gear.',
        'Roll the ball by the west wall into the gear’s teeth to jam it. Then hitting all four vents quickly counts double.',
        'Push the ball along its groove into the gear, then hit all four vents quickly when they open.'],
      ['It knocked the ball out of the gear. Now it spins while its vents are open.',
        'While the gear turns, you can reach only one vent at a time. Jam the gear with the ball again.',
        'Roll the ball back into the gear’s teeth. When its vents open, hit all four quickly.'],
    ],
    // (from its second phase, the gear free: the ball by the wall)
    at: (g, i) => (i >= 1 && !g.rt.gearJammed?.() ? g.rt.piece?.('bG')?.center ?? null : hiddenVent(g, 4)),
  },
  // the Builders' Greenhouse: the Gardener (organic: bloomed)
  edena: {
    phases: [
      ['It keeps looking at the dead flower beds round the walls.',
        'Make the dead flower beds bloom.',
        'Switch the tool to bloom and shoot each dead bed round the glasshouse.'],
      ['Its back is bare. Wait for it to kneel.',
        'When it kneels, shoot bloom onto its back. In sunlight the flowers grow at once.',
        'Let it kneel. Stand on the footstone nearest it to turn the sun onto it. Then shoot bloom onto its back.'],
      ['Flowers won’t grow on it in the shade now.',
        'When it kneels, bring the sun to it first: stand on the footstone nearest it.',
        'Let it kneel, stand on the footstone nearest it till the sun settles on it, then bloom its back.'],
    ],
    // (from its second phase: the footstone that brings the sun, while it kneels in the shade)
    at: (g, i) => (i === 0 ? nearestUnlit(g, ['bed1', 'bed2', 'bed3', 'bed4'])
      : g.state === 'open' && !g.rt.gardenSun?.lights(g.model.pos, 1.4) ? nearestPiece(g, ['fs1', 'fs2', 'fs3', 'fs4'], g.model.pos)
        : _p.copy(g.model.pos).addScaledVector(UP, (g.model.height ?? 3) * 0.5)),
  },
  // the Footprint: the Echo (organic: answered note for note)
  spheres: {
    phases: [
      ['It sings a note. Answer it on the sphere that glows.',
        'When it sings, one sphere on the galleries glows. Shoot that one.',
        'Shoot the sphere that glows while it sings. The wrong one makes it flinch.'],
      ['It sings again, and faster.',
        'Each time it sings, shoot the sphere that glows. Your lens shows the walker’s print on it.',
        'Watch which sphere lights when it sings, and splash that one before the song ends.'],
      ['All three spheres glow when it sings now.',
        'Look through your lens: only one glowing sphere has the three-toed print.',
        'When it sings, look for the three-toed print on one glowing sphere, and splash that one.'],
    ],
    at: (g) => (g.state === 'open' && g.rt.sing >= 0 && g.rt.resonators?.[g.rt.sing]?.center) || g.model.mouth,
  },
  // the Hush-House: the Mother Snapper (organic: outwitted, never fought: issue #409). The lens on the next crystal
  perdide: {
    phases: [
      ['She snaps at noise. The swinging crystals above her are noisy.',
        'Stop the three swinging crystals with a stilling shot.',
        'Switch to stilling and shoot each swinging crystal. Walk, don’t run, near her.'],
      ['The hall is quiet. Now sing her to sleep: splash the crystals one by one, in order.',
        'The first crystal is the small one at her root, under her head. Make a noise elsewhere first, so she looks away.',
        'Splash a hanging crystal: she strikes at it. Then splash her root crystal, then the hanging ones, smallest first.'],
    ],
    at: (g) => {
      const C = g.rt.motherCrystals;
      if (!C) return null;
      if (g.phaseIndex === 0) return C.swings.find((s) => !s.frost)?.center ?? null;
      return C.notes.find((n) => !n.taken)?.center ?? null;
    },
  },
  // the Lamp-House: the Lampless (organic: fed with your light)
  perdide2: {
    phases: [
      ['It is looking for light. Give it some.',
        'When it hangs low, send it a bubble of light.',
        'Stand by a lit pool, blow a bubble ({key:aim}, {key:fire}), and send the glowing bubble to the moth.'],
      ['It wants more light.',
        'Again: fill a bubble with light at a lit pool, and send it while the moth hangs low.',
        'When it hangs low, stand by a lit pool, blow a bubble and aim it at the moth until it has drunk.'],
    ],
    at: (g) => _p.copy(g.model.pos).setY(g.arena.y + 0.5),
  },
  // the Undertower: the First Sign (a machine, given its words back)
  bazaar: {
    phases: [
      ['It keeps crying one word. Catch it.',
        'Catch its word in the hourglass. Play it back while its dish is lowered.',
        'Stand near when it cries its word. Then turn the hourglass ({key:fire}) while its dish is lowered.'],
      // (issue #418: its puzzle between its fights)
      ['Its word fills the cables, so it can’t hear anything else.',
        'Pull the lever by the door to shut its word out. Then give it the word from the stone its dish faces.',
        'Pull the lever by the door. Splash the stone its dish faces, then turn the hourglass ({key:fire}) beside that stone.'],
      ['Now it only hears through the dishes on the wall.',
        'Catch its word, then play it into a low dish on the wall.',
        'Be close when it cries, then stand under a low wall dish and turn the hourglass ({key:fire}) while it listens.'],
    ],
  },
  // the Casting-House: the Last Founder (a machine, stopped)
  moonfoundry: {
    phases: [
      ['After it pours, the doors on its chest open.',
        'When the doors swing open, splash water on the glowing heart inside.',
        'Dodge its ladle and its pour. When its chest opens, splash the glowing heart with water.'],
      ['The iron moon, the big ball by the west wall, fits the casting cradle.',
        'Roll the iron moon into the casting cradle. While it sits there, each splash counts double.',
        'Draw the iron moon along its rail into the cradle with the magnet glove (hold {key:fire}), then splash its heart.'],
      ['It tipped the moon out. Its heart is too hot now.',
        'Roll the moon back into the cradle. Water only works while it is there.',
        'Push the iron moon back into the casting cradle, then splash the heart while it stops to look.'],
    ],
    // (from its second phase, the moon out of the cradle: the moon)
    at: (g, i) => (i >= 1 && !g.rt.founderCradled?.() ? g.rt.piece?.('mA')?.center ?? null : g.model.vent?.(0, V()) ?? null),
  },
  // the Mooring-House: the Anchor-Warden (a machine, stopped)
  spacecity: {
    phases: [
      ['After it throws its anchor, its cable drum stops.',
        'When its cable goes slack, pull the anchor back with the tether.',
        'Switch to the tether ({key:mode}), go near the anchor lying on the floor, and pull it while the drum is stalled.'],
      ['Now its anchor hooks onto the posts on the floor.',
        'When it stops pulling, tether the hooked anchor free and back.',
        'Wait for it to stop, stand by the post with the anchor on it, and pull with the tether.'],
      ['Its anchor hangs out over the drop, too far to reach.',
        'Push the bars on its drum to wind the anchor closer, then pull it.',
        'While it is stopped, push it twice to wind the anchor in. Then pull the anchor back with the tether from the edge.'],
    ],
    // (an anchor out: the anchor; else its pawl)
    at: (g) => (g.rt.anchor?.out ? g.rt.anchor.at.clone() : g.model.drumAt?.(V()) ?? null),
  },
  // the Whale-House: the Listener (a living guardian, calmed)
  underwater: {
    phases: [
      ['Its great ear opens after it strikes.',
        'When it stops and spreads its ear, stomp near it. The boom is the deep note it wants.',
        'Dodge its fins and its slam. When its ear spreads wide, jump near it ({key:jump}) and stomp ({key:fire} in the air).'],
      ['Now it shuts its ear when you get close. Use the dishes by the walls.',
        'Roll a ball onto the footstone by a dish. Then stomp beside that dish while the ear is open.',
        'Push a ball onto the footstone by the wall. Then jump by its dish and stomp ({key:fire} in the air) as the ear opens.'],
      ['It knocked the balls off the footstones.',
        'Roll a ball back onto a footstone, and stomp beside its dish while the ear is open.',
        'Push a ball back onto a footstone, then stomp ({key:fire} in the air) beside its dish when the ear spreads.'],
    ],
    // (its first phase: its ear; then a stone off its footstone, or the dish a stone wakes)
    at: (g, i) => {
      if (i < 1) return g.model.mouth.clone();
      const home = ['W', 'E'].find((s) => g.rt.logic?.drumOn?.(`b${s}`, `p${s}`));
      if (home) return g.rt.piece?.(`dish${home}`)?.ends?.[0]?.mouth?.clone() ?? null;
      return g.rt.piece?.('bW')?.center ?? null;
    },
  },
};

/**
 * The drone's hint for the temple's guardian, now: while it is awake (waking, fighting, open, or
 * weary and waiting for your hand) and you are inside the temple. id: the temple and the phase (a new
 * phase starts the lines over); lines: three, first a nudge; at(): where the lens points.
 */
export function guardianHint(rt, hints = BOSS_HINTS) {
  const g = rt?.guardian, P = rt?.player, H = hints[rt?.id];
  if (!g || !H || !P || !g.awake || P.dead || (rt.inside && !rt.inside(P.pos))) return null;
  if (g.state === 'weary') {
    if (!g.def.touch) return null;
    return { id: `${rt.id}.weary`, lines: [`It is calm now. Go to it and ${g.def.touch}.`], at: () => g.model.mouth };
  }
  const i = Math.min(g.phaseIndex, H.phases.length - 1);
  // (the phase's second verb not answered yet, boss.js asks: its own lines, and the lens on the guardian)
  if (g.asking && g.phase.asks.lines?.length) return { id: `${rt.id}.${i}.asks`, lines: g.phase.asks.lines, at: () => g.model.mouth };
  const lines = H.phases[i];
  if (!lines?.length) return null;
  return { id: `${rt.id}.${i}`, lines, at: () => H.at?.(g, i) ?? g.model.mouth };
}

/**
 * The hint as the hint level lets it out (src/hint-level.js), after `secs` in this phase of the fight: full,
 * all its lines at once; subtle, none at first, then the nudge, the plainer line and the plainest one as the
 * struggle goes on (STRUGGLE); off, none. With no line open the hint keeps its id and an empty list: the drone
 * only watches with you (the ping shrugs). null stays null.
 */
export function openHint(hint, secs, lv = hintLevel()) {
  if (!hint) return null;
  const n = hintLinesOpen(secs, lv);
  return n >= hint.lines.length ? hint : { ...hint, lines: hint.lines.slice(0, n) };
}

/** The seconds spent in the guardian's current phase (its hint id), counted while the fight is on: tick(id, dt). */
export class Struggle {
  constructor() { this.id = null; this.t = 0; }
  tick(id, dt) { if (id !== this.id) { this.id = id ?? null; this.t = 0; } else if (id) this.t += dt; return this.t; }
}
