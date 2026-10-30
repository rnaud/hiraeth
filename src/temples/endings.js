import { spoken } from '../story/tone.js';

// Every makers' temple ends the same way (issue #655): through its special door (the guardian hall's door, the
// temple's `arenaDoor`) → an introduction film (two panels: the guardian, then what is at stake in its hall, each
// with a caption: the situation, then the task) → the ending game → the completion film (finale.js) and the world change.
// The design table is docs/design/temple-endings.md; the systems docs/systems/temples.md, "Temple endings".
//
// Two kinds of ending game:
//   helper   a kit minigame on its own page (?game=<id>), launched by crossing the door (helper-threshold.js), its
//            success receipt carried back by helper-encounter.js. The Rose House's Cistern channels and the Aerie's
//            Elder's flight.
//   trial    the guardian's own staged fight, played as a bounded trial in its hall (trial-flow.js): the door crossed,
//            the introduction plays once a visit, the guardian wakes straight after it; knocked out, you retry from
//            the phase it was in without the film; leaving the hall another way (the last mark, the ship) calls it off.
//
// Each entry: kind, captions [the situation, the task] (scene captions, toned), and for a helper its game, the
// entrance (door, upstream, needs), its prompt and return label. `stake(rt)` → [{ pos, r, skip }]: what the
// introduction's second panel shows, where the completion film's own subject (finale.js FINALES[id].sign) can't be seen
// whole past the guardian.
const scene = (text) => spoken('scene', text);
// The Clock-House's stopped wall clocks: looked at just off their faces, into the hall (their faces are drawn solid).
const wallDials = (rt) => {
  const c = rt.guardian?.arena?.center;
  return c ? (rt.workshopDials ?? []).map((d) => {
    const into = c.clone().sub(d.center).setY(0).normalize();
    return { pos: d.center.clone().addScaledVector(into, 0.8), r: 2 };
  }) : [];
};
// The Mooring-House's barred gate to the hub (its completion film's subject), looked at just off its bars, into the hall.
const barredGate = (rt) => {
  const g = rt.piece?.('d7')?.group, c = rt.guardian?.arena?.center;
  if (!g || !c) return [];
  const at = g.getWorldPosition(c.clone()), into = c.clone().sub(at).setY(0).normalize();
  return [{ pos: at.addScaledVector(into, 1.5).setY(at.y + 3.6), r: 3 }];
};
// The Sounding Hall's dry floor, on the far side of its middle from the Listener's shell (its tide's edges lie by the shell).
const dryFloor = (rt) => {
  const G = rt.guardian, c = G?.arena?.center, k = G?.model?.pos;
  if (!c || !k) return [];
  const away = c.clone().sub(k).setY(0), l = away.length();
  if (l < 1e-3) away.set(0, 0, 1); else away.divideScalar(l);
  return [{ pos: c.clone().addScaledVector(away, G.arena.r * 0.45).setY(G.arena.y + 0.5), r: 4 }];
};

export const TEMPLE_ENDINGS = {
  desert: { kind: 'helper', game: 'cistern', door: 'd4', upstream: 'd3', needs: ['sword', 'shield', 'gun'],
    prompt: 'help the Keeper', returnLabel: 'Return to the Keeper',
    captions: [scene('~neutral~ The Keeper’s channels have run dry.'),
      scene('~neutral~ Turn the channels to every trough, then open the valve. Five minutes, three floods.')] },
  arzach: { kind: 'helper', game: 'elderflight', door: 'd3', needs: ['gun', 'glider'],
    prompt: 'fly with the Elder', returnLabel: 'Return to the Aerie',
    captions: [scene('~neutral~ The Elder needs help reaching her old roost.'),
      scene('~neutral~ Stay beside her wing. Return to her side when her courage falls.')] },
  incal: { kind: 'trial', captions: [scene('~neutral~ The shaft no longer breathes. Its four great vanes stand still.'),
    scene('~solemn~ Stop the warden: shoot its vents when they open, then its crown.')] },
  arzach2: { kind: 'trial', stake: (rt) => (rt.hallStones?.list ?? []).map((st) => ({ pos: st.home.clone(), r: (st.r ?? 1) + 1.5, skip: [st.m].filter(Boolean) })), captions: [scene('~neutral~ The hall’s stones hang in the air. The Cloud-Mother holds them up in fear.'),
    scene('~solemn~ Calm her: hook the bells as she cries, then lay a hand on her brow.')] },
  spheres: { kind: 'trial', stake: (rt) => (rt.resonators ?? []).map((r) => ({ pos: r.center.clone(), r: 4, skip: [r.group].filter(Boolean) })), captions: [scene('~sad~ The three spheres are silent. The Echo is lost.'),
    scene('~neutral~ Answer its notes: splash the sphere that glows with its song.')] },
  buried: { kind: 'trial', captions: [scene('~neutral~ The great gear is jammed. The engine is cold.'),
    scene('~solemn~ Stop the Tooth-Warden: hit its four vents when they open.')] },
  perdide2: { kind: 'trial', captions: [scene('~sad~ The great lamp is dark. The Lampless circles in the black.'),
    scene('~neutral~ Lead it with light: send it bubbles from the lit pools.')] },
  perdide: { kind: 'trial', captions: [scene('~whisper~ The crystals jangle over her. The Mother Snapper cannot sleep.'),
    scene('~neutral~ Still the crystals, then her. Sing her the lullaby.')] },
  garage: { kind: 'trial', stake: wallDials, captions: [scene('~neutral~ Every clock in the workshop has stopped.'),
    scene('~solemn~ Stop the Foreman: hit its numerals when its face opens.')] },
  edena: { kind: 'trial', captions: [scene('~sad~ The beds round the walls are dry and dead.'),
    scene('~neutral~ Bloom the beds, then bloom the Gardener’s back.')] },
  bazaar: { kind: 'trial', captions: [scene('~neutral~ The word stones are silent. The First Sign cries one word.'),
    scene('~solemn~ Play its word back into its dish when it listens.')] },
  spacecity: { kind: 'trial', stake: barredGate, captions: [scene('~neutral~ The hub’s gate is barred. The Anchor-Warden keeps it.'),
    scene('~solemn~ When its drum stalls, tether the anchor home.')] },
  moonfoundry: { kind: 'trial', captions: [scene('~neutral~ The cradle’s moon lies cold. The Last Founder pours without end.'),
    scene('~solemn~ Splash its molten heart when its doors swing open.')] },
  underwater: { kind: 'trial', stake: dryFloor, captions: [scene('~neutral~ The Sounding Hall is dry. The Listener cannot hear the sea.'),
    scene('~solemn~ Stomp close when it spreads its ear: give it the deep note.')] },
};

export const endingOf = (id) => TEMPLE_ENDINGS[id] ?? null;
const helpers = Object.entries(TEMPLE_ENDINGS).filter(([, e]) => e.kind === 'helper');
/** The helper encounters (helper-encounter.js), by temple. */
export const HELPER_ENCOUNTERS = Object.fromEntries(helpers.map(([id, e]) => [id, { game: e.game, prompt: e.prompt, returnLabel: e.returnLabel }]));
/** Their doorways (helper-threshold.js), by temple. */
export const HELPER_ENTRANCES = Object.fromEntries(helpers.map(([id, e]) => [id, { door: e.door, ...(e.upstream ? { upstream: e.upstream } : {}), needs: e.needs }]));
/** Every ending's introduction captions, by temple. */
export const ENDING_CAPTIONS = Object.fromEntries(Object.entries(TEMPLE_ENDINGS).map(([id, e]) => [id, e.captions]));
