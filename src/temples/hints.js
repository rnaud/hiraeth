import * as THREE from 'three';

// The drone's hints in a guardian's fight (src/scout.js: a ping while a guardian is awake and you are
// in its hall asks for one instead of the objective). Each temple has, for each of its guardian's
// phases, three lines: a nudge, then plainer, then plainest (each ping on the same phase says the
// next); and where the drone turns its lens: the weak point, or the thing to use (at(g, phase), a
// world position; the guardian's own weak point, model.mouth, when there is no at). The gentle way
// first wherever the game has one: the living guardians are calmed, never hurt.
//
//   guardianHint(rt)  { id, lines, at } for the scout's getHint (main.js), or null

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
  // the Givers' House: the Keeper of the cistern (organic: calmed)
  desert: {
    phases: [
      ['It is afraid of the dark round the walls.',
        'Light the four braziers round the rim. Your ember lights them.',
        'Switch the tool to ember and shoot each dark brazier round the rim. Every one lit calms it.'],
      ['It is thirsty. Watch for it to pant.',
        'When it pants with its mouth open, give it water.',
        'Let it strike, then shoot plain fluid into its open mouth while it pants. Four drinks.'],
    ],
    at: (g, i) => (i === 0 ? nearestUnlit(g, ['b6', 'b7', 'b8', 'b9']) : null),
  },
  // the Warden's Well: the warden (a robot: it can only be broken)
  incal: {
    phases: [
      ['Its side vents open after its eye has swept the floor.',
        'Keep out of the line its eye sweeps. When the vents open, glowing, shoot them.',
        'Step out of the beam’s lane, then shoot the glowing vents while they are open. Four hits.'],
      ['Its sides are shut now. Its crown hatch opens, and it backs toward a vane.',
        'Get above its crown with the jets. Over the vane by it, the draught holds the hatch wide.',
        'Hover over its vane, level with its crown, aiming ({key:aim}): the vane turns, and a hit counts twice.'],
      ['It keeps its hatch shut against still air now.',
        'It backs onto a vane when it opens. Make that vane turn: only the jets turn the great ones.',
        'Hover over its vane, level with its crown, aiming ({key:aim}): the draught lifts the hatch. Shoot down.'],
    ],
    // (from its second phase, the hatch open: the vane it backs onto)
    at: (g, i) => (i >= 1 && g.state === 'open' && g.rt.hallVanes?.length ? nearestPiece(g, g.rt.hallVanes.map((v) => v.id), g.model.pos) : null),
  },
  // the Elder's roost (organic: calmed by flying with her)
  arzach: {
    phases: [
      ['She is afraid to fly alone.',
        'When she spreads her wings and looks up, take to the air beside her.',
        'Ride the wind in the middle of the hall up, and glide close round her while her wings are spread.'],
      ['She is in the air now. Go up with her.',
        'When she hangs over a vent, fly in the wind beside her.',
        'Ride the wind out of a vent up beside her while she hangs there: it counts twice.'],
      ['She will not trust still air.',
        'When she hangs over a vent, make the wind rise from it: the stone into the other.',
        'Push the floor’s stone into the far vent, then open your wings in the column by her.'],
    ],
    // (from her second phase: the stone, while the wind rises from the vent away from her)
    at: (g, i) => {
      if (g.state !== 'open') return g.arena.center;
      const w = i >= 1 ? g.rt.roostWinds?.slice().sort((a, b) => a.foot.distanceTo(g.model.pos) - b.foot.distanceTo(g.model.pos))[0] : null;
      if (w && !w.on) return g.rt.piece?.('ballR')?.center ?? g.arena.center;
      return _p.copy(g.model.pos).addScaledVector(UP, 4.4);
    },
  },
  // the Founders' Belfry: the Cloud-Mother (organic: answered with the bell)
  arzach2: {
    phases: [
      ['She cries, and nobody answers.',
        'When she sinks low and cries, answer her with your bell.',
        'Get close while she cries, then ring the bell (V, or Y / △ with empty hands). Not the fluid, never a shove.'],
      ['She is crying again.',
        'Answer every cry with the bell, near her.',
        'Each time she sinks low and cries, run close and ring the bell (V, or Y / △ with empty hands).'],
    ],
  },
  // the First Garage: the Clockwork Foreman (a robot: it can only be stopped)
  garage: {
    phases: [
      ['Watch its face after it strikes.',
        'When the glass over its face swings up, hit all six numerals inside one breath.',
        'Let it strike, then shoot the six glowing numerals fast: three shots, the tank refills, three more.'],
      ['Its face still opens after a strike.',
        'Six numerals, one breath, again. Keep clear of its cogs.',
        'Dodge the cogs, wait for the hammer or the chime, then all six numerals before the glass comes down.'],
    ],
  },
  // the Engine-House: the Tooth-Warden (a robot: it can only be stopped)
  buried: {
    phases: [
      ['Four vents open after its beam. One faces away from you.',
        'All four in one breath. From the front its body hides the back one.',
        'Fly over it and aim with {key:aim} as the vents open: the jets hold you up, and from above all four show.'],
      ['It turns on the great gear in the floor now.',
        'Roll the ball by the west wall into the gear’s teeth: then four vents in a breath count twice.',
        'Push the ball along its groove into the gear, then hit all four vents in one breath when they open.'],
      ['It stamped the ball out of the gear, and opens turning.',
        'One vent faces out at a time while the gear turns. Jam it again with the ball.',
        'Roll the ball back into the gear’s teeth; when it opens, all four face out: hit them in one breath.'],
    ],
    // (from its second phase, the gear free: the ball by the wall)
    at: (g, i) => (i >= 1 && !g.rt.gearJammed?.() ? g.rt.piece?.('bG')?.center ?? null : hiddenVent(g, 4)),
  },
  // the Builders' Greenhouse: the Gardener (organic: bloomed)
  edena: {
    phases: [
      ['It is looking at the dead beds round the walls.',
        'Make the dead beds bloom.',
        'Switch the tool to bloom and shoot each dead bed round the glasshouse.'],
      ['Its back is bare. Wait for it to kneel.',
        'When it kneels, make its back bloom: in the sun the flowers take at once.',
        'Let it kneel. Its quarter’s footstone turns the sun onto it; then shoot bloom onto its back.'],
      ['Nothing grows on it in the shade now.',
        'When it kneels, bring the sun to it first: the footstone of its quarter.',
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
      ['It sings, and waits for an answer.',
        'When it sings, one sphere round the hall glows with its note.',
        'Shoot the sphere that glows while it sings. The wrong one makes it flinch.'],
      ['It sings again, and faster.',
        'Answer each song on the sphere that glows.',
        'Watch which sphere lights when it sings, and splash that one before the song ends.'],
    ],
    at: (g) => (g.state === 'open' && g.rt.sing >= 0 && g.rt.resonators?.[g.rt.sing]?.center) || g.model.mouth,
  },
  // the Hush-House: the Mother Snapper (organic: stilled, never hurt)
  perdide: {
    phases: [
      ['She tires after a lunge.',
        'When her head lies spent on the floor, still her.',
        'Switch to stilling. After a lunge, shoot a cold glob into her open mouth while it lies there.'],
      ['She can be stilled mid-strike now.',
        'Still her as she rears to strike, or when she lies spent.',
        'Keep the stilling mode: shoot her as she winds up to strike, or into her open mouth after a lunge.'],
    ],
  },
  // the Lamp-House: the Lampless (organic: fed with your light)
  perdide2: {
    phases: [
      ['It is searching for light.',
        'When it hangs low, stand still by it with your lantern.',
        'Wait for it to hang low and turn about, then stand still within a few steps of it. Do not move.'],
      ['It wants more of your light.',
        'Again: be still by it while it searches.',
        'When it hangs low, walk under it and stand still, lantern lit, until it has drunk.'],
    ],
    at: (g) => _p.copy(g.model.pos).setY(g.arena.y + 0.5),
  },
  // the Undertower: the First Sign (a machine, given its words back)
  bazaar: {
    phases: [
      ['It is trying to say something.',
        'Catch its word with your shell, then give it back when it listens.',
        'Stay near when it cries its word, then play the shell back (V, or Y / △ with empty hands) while its dish is lowered.'],
      ['It has a new word.',
        'Catch the new word, and play it back when it lowers its dish.',
        'Be close when it cries, then play the shell back (V, or Y / △ with empty hands) close to its dish while it listens.'],
    ],
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
  const lines = H.phases[i];
  if (!lines?.length) return null;
  return { id: `${rt.id}.${i}`, lines, at: () => H.at?.(g, i) ?? g.model.mouth };
}
