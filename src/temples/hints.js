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
      ['Its sides are shut now. Look up: the vent on its crown opens.',
        'Only the crown vent takes a hit now. Get above it with the jets.',
        'Fly up over its head with the jets and shoot down into the glowing crown vent while it is open.'],
    ],
  },
  // the Elder's roost (organic: calmed by flying with her)
  arzach: {
    phases: [
      ['She is afraid to fly alone.',
        'When she spreads her wings and looks up, take to the air beside her.',
        'Ride the wind in the middle of the hall up, and glide close round her while her wings are spread.'],
      ['She is in the air now. Go up with her.',
        'When she hangs in the air, glide near her again.',
        'Ride the wind in the middle up, open your wings and stay close to her while she hangs there.'],
    ],
    at: (g) => (g.state === 'open' ? _p.copy(g.model.pos).addScaledVector(UP, 4.4) : g.arena.center),
  },
  // the Founders' Belfry: the Cloud-Mother (organic: answered with the bell)
  arzach2: {
    phases: [
      ['She cries, and nobody answers.',
        'When she sinks low and cries, answer her with your bell.',
        'Get close while she cries, then ring the bell (V, or RS / R3). Not the fluid, never a shove.'],
      ['She is crying again.',
        'Answer every cry with the bell, near her.',
        'Each time she sinks low and cries, run close and ring the bell (V, or RS / R3).'],
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
        'Hover over it with the jets when the vents open: from above you can hit all four.'],
      ['Four vents, one breath, and now it slams too.',
        'Get above it before the vents open: the back one is out of reach from the floor.',
        'Rise with the jets as it strikes, then hit all four glowing vents from over its head.'],
    ],
    at: (g) => hiddenVent(g, 4),
  },
  // the Builders' Greenhouse: the Gardener (organic: bloomed)
  edena: {
    phases: [
      ['It is looking at the dead beds round the walls.',
        'Make the dead beds bloom.',
        'Switch the tool to bloom and shoot each dead bed round the glasshouse.'],
      ['Its back is bare. Wait for it to kneel.',
        'When it kneels, make its back bloom.',
        'Let it strike and kneel, then shoot bloom onto its bare back. Never the ember here.'],
    ],
    at: (g, i) => (i === 0 ? nearestUnlit(g, ['bed1', 'bed2', 'bed3', 'bed4']) : _p.copy(g.model.pos).addScaledVector(UP, (g.model.height ?? 3) * 0.5)),
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
        'Stay near when it cries its word, then play the shell back (V, or RS / R3) while its dish is lowered.'],
      ['It has a new word.',
        'Catch the new word, and play it back when it lowers its dish.',
        'Be close when it cries, then play the shell back (V, or RS / R3) close to its dish while it listens.'],
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
